export interface InvoiceTotalsInput {
  loads: Array<{ amount: number }>;
  deductions: Array<{ amount: number }>;
  credits?: Array<{ amount: number }>;
  percent: number;
  tax_percent?: number;
  driver_type: string;
  manual_net_pay?: number | null;
}

export function calculateInvoiceTotals(input: InvoiceTotalsInput) {
  const gross = input.loads.reduce((sum, load) => sum + (load.amount || 0), 0);
  const percentAmount = gross * (input.percent / 100);
  const fixedDed = input.deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
  const credits = (input.credits || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  const taxAmount = gross * ((input.tax_percent || 0) / 100);
  const isCompanyDriver = input.driver_type === 'Company Driver';
  const calculatedNet = isCompanyDriver
    ? percentAmount - fixedDed + credits - taxAmount
    : gross - percentAmount - fixedDed + credits - taxAmount;

  // Use manual net pay if provided, otherwise use calculated
  const net = input.manual_net_pay !== null && input.manual_net_pay !== undefined
    ? input.manual_net_pay
    : calculatedNet;

  return { gross, percentAmount, fixedDed, credits, taxAmount, net };
}
