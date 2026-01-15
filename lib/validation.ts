import { z } from 'zod';
import { normalizeState } from './us-states';

// Validate that location has a valid US state (state-only or "City, ST")
const locationSchema = z.string().min(1, 'Location is required').refine(
  (val) => {
    const trimmed = val.trim();
    if (!trimmed) return false;
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length === 1) {
      return !!normalizeState(parts[0]);
    }
    const city = parts.slice(0, -1).join(', ').trim();
    const state = parts[parts.length - 1];
    if (!city) return false;
    return !!normalizeState(state);
  },
  { message: 'Enter a valid US state (e.g. "CA" or "City, CA")' }
);

export const loadSchema = z.object({
  load_ref: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  from_location: locationSchema,
  to_location: locationSchema,
  load_date: z.string().min(1, 'Load date is required'),
  delivery_date: z.string().optional().nullable(),
  amount: z.number().finite().min(0, 'Amount must be at least 0')
});

export const deductionSchema = z.object({
  deduction_type: z.string().min(1, 'Deduction type is required'),
  amount: z.number().finite().min(0, 'Amount must be at least 0'),
  note: z.string().optional().nullable(),
  deduction_date: z.string().optional().nullable()
});

export const creditSchema = z.object({
  credit_type: z.string().min(1, 'Credit type is required'),
  amount: z.number().finite().min(0, 'Amount must be at least 0'),
  note: z.string().optional().nullable()
});

export const invoiceInputSchema = z.object({
  company_id: z.number(),
  driver_id: z.number(),
  week_start: z.string().min(1, 'Week start is required'),
  week_end: z.string().min(1, 'Week end is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  percent: z.number().finite().min(0).max(100),
  tax_percent: z.number().finite().min(0).max(100).default(0),
  status: z.enum(['draft', 'sent', 'paid']).default('draft'),
  due_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  currency: z.string().min(3).max(3).default('USD'),
  manual_net_pay: z.number().finite().min(0).optional().nullable(),
  loads: z.array(loadSchema).min(1, 'At least one load is required'),
  deductions: z.array(deductionSchema).optional().default([]),
  credits: z.array(creditSchema).optional().default([])
}).superRefine((data, ctx) => {
  const start = new Date(data.week_start);
  const end = new Date(data.week_end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['week_start'], message: 'Invalid week range' });
  } else if (start > end) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['week_end'], message: 'Week end must be after start' });
  }
});

export const companyUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  brand_color: z.string().optional().nullable(),
  invoice_template: z.enum(['classic', 'modern']).default('classic'),
  default_percent: z.number().finite().min(0).max(100),
  default_tax_percent: z.number().finite().min(0).max(100),
  default_currency: z.string().min(3).max(3).default('USD'),
  factoring_rate: z.number().finite().min(0).max(100).default(2),
  dispatch_rate: z.number().finite().min(0).max(100).default(6),
  auto_deduction_base: z.enum(['YTD_INSURANCE']).default('YTD_INSURANCE'),
  invoice_prefix: z.string().min(1),
  footer_note: z.string().optional().nullable()
});

export const driverContactSchema = z.object({
  email: z.string().email().optional().nullable(),
  whatsapp_number: z.string().optional().nullable(),
  whatsapp_link: z.string().optional().nullable()
});

export const driverCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company_id: z.number().int(),
  truck_number: z.string().min(1).max(31).optional().nullable(),
  email: z.string().email().optional().nullable(),
  whatsapp_number: z.string().optional().nullable()
});

export const driverCompanySchema = z.object({
  company_id: z.number().int().nullable()
});

export const driverUpdateSchema = z.object({
  company_id: z.number().int().nullable().optional(),
  truck_number: z.string().min(1).max(31).optional().nullable()
});

export function formatZodErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
