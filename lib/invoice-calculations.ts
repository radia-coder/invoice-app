export interface InvoiceTotalsInput {
  loads: Array<{ amount: number }>;
  deductions: Array<{ amount: number }>;
  percent: number;
  tax_percent?: number;
  driver_type: string;
}

export function calculateInvoiceTotals(input: InvoiceTotalsInput) {
  const gross = input.loads.reduce((sum, load) => sum + (load.amount || 0), 0);
  const percentAmount = gross * (input.percent / 100);
  const fixedDed = input.deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
  const taxAmount = gross * ((input.tax_percent || 0) / 100);
  const isCompanyDriver = input.driver_type === 'Company Driver';
  const net = isCompanyDriver
    ? percentAmount - fixedDed - taxAmount
    : gross - percentAmount - fixedDed - taxAmount;

  return { gross, percentAmount, fixedDed, taxAmount, net };
}
