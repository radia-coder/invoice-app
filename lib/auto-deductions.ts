export type AutoDeductionBase = 'YTD_INSURANCE';

export type AutoDeductionConfig = {
  base: AutoDeductionBase;
  factoringPercent: number;
  dispatchPercent: number;
};

export type AutoDeductionAmounts = {
  baseValue: number;
  factoring: number;
  dispatch: number;
};

export type DeductionLike = {
  deduction_type: string;
  amount: number;
  note?: string | null;
};

export function normalizeDeductionType(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isFactoringDeduction(value: string): boolean {
  return normalizeDeductionType(value).includes('FACTORING');
}

export function isDispatchDeduction(value: string): boolean {
  return normalizeDeductionType(value).includes('DISPATCH');
}

export function isInsuranceDeduction(value: string): boolean {
  return normalizeDeductionType(value).includes('INSURANCE');
}

export function getAutoDeductionConfigFromCompany(company: {
  factoring_rate?: number | null;
  dispatch_rate?: number | null;
  auto_deduction_base?: string | null;
}): AutoDeductionConfig {
  if (process.env.AUTO_DEDUCTIONS_ENABLED === 'false') {
    return {
      base: 'YTD_INSURANCE',
      factoringPercent: 0,
      dispatchPercent: 0
    };
  }

  return {
    base: company.auto_deduction_base === 'YTD_INSURANCE' ? 'YTD_INSURANCE' : 'YTD_INSURANCE',
    factoringPercent: company.factoring_rate ?? 2,
    dispatchPercent: company.dispatch_rate ?? 6,
  };
}

export function calculateAutoDeductions(
  baseValue: number,
  config: AutoDeductionConfig
): AutoDeductionAmounts {
  const factoring = baseValue * (config.factoringPercent / 100);
  const dispatch = baseValue * (config.dispatchPercent / 100);
  return { baseValue, factoring, dispatch };
}

export function buildAutoDeductionEntries(
  amounts: AutoDeductionAmounts,
  config: AutoDeductionConfig
): DeductionLike[] {
  const baseLabel = config.base === 'YTD_INSURANCE' ? 'YTD Insurance' : 'Base';
  const entries: DeductionLike[] = [];

  // Only add factoring if amount is greater than 0
  if (amounts.factoring > 0) {
    entries.push({
      deduction_type: 'Factoring',
      amount: amounts.factoring,
      note: `${config.factoringPercent}% of ${baseLabel}`,
    });
  }

  // Only add dispatch if amount is greater than 0
  if (amounts.dispatch > 0) {
    entries.push({
      deduction_type: 'Dispatch',
      amount: amounts.dispatch,
      note: `${config.dispatchPercent}% of ${baseLabel}`,
    });
  }

  return entries;
}

export function mergeDeductionsWithAuto(
  deductions: DeductionLike[],
  autoEntries: DeductionLike[]
): DeductionLike[] {
  const filtered = deductions.filter(
    (ded) => !isFactoringDeduction(ded.deduction_type) && !isDispatchDeduction(ded.deduction_type)
  );
  return [...filtered, ...autoEntries];
}

export function sumInsuranceDeductions(deductions: DeductionLike[]): number {
  return deductions.reduce((sum, ded) => {
    if (isInsuranceDeduction(ded.deduction_type)) {
      return sum + (ded.amount || 0);
    }
    return sum;
  }, 0);
}

export function buildYtdInsuranceIndex(
  invoices: Array<{ driver_id: number; week_end: Date; deductions: DeductionLike[] }>
): Map<number, Map<number, Map<number, number>>> {
  const grouped = new Map<string, Array<{ week_end: Date; deductions: DeductionLike[] }>>();

  invoices.forEach((invoice) => {
    const year = invoice.week_end.getFullYear();
    const key = `${invoice.driver_id}:${year}`;
    const existing = grouped.get(key) || [];
    existing.push({ week_end: invoice.week_end, deductions: invoice.deductions });
    grouped.set(key, existing);
  });

  const index = new Map<number, Map<number, Map<number, number>>>();

  for (const [key, driverInvoices] of grouped.entries()) {
    const [driverIdStr, yearStr] = key.split(':');
    const driverId = Number(driverIdStr);
    const year = Number(yearStr);
    driverInvoices.sort((a, b) => a.week_end.getTime() - b.week_end.getTime());

    let running = 0;
    const yearMap = index.get(driverId) || new Map<number, Map<number, number>>();
    const weekMap = new Map<number, number>();

    for (const invoice of driverInvoices) {
      running += sumInsuranceDeductions(invoice.deductions);
      weekMap.set(invoice.week_end.getTime(), running);
    }

    yearMap.set(year, weekMap);
    index.set(driverId, yearMap);
  }

  return index;
}

export function getYtdInsurance(
  index: Map<number, Map<number, Map<number, number>>>,
  driverId: number,
  weekEnd: Date
): number {
  const yearMap = index.get(driverId);
  if (!yearMap) return 0;
  const weekMap = yearMap.get(weekEnd.getFullYear());
  if (!weekMap) return 0;
  return weekMap.get(weekEnd.getTime()) ?? 0;
}
