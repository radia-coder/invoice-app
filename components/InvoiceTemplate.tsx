import React from 'react';
import { format } from 'date-fns';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import { getCompanyDetails } from '@/lib/company-config';

// Helper for currency
const formatCurrency = (amount: number, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }
};

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string | Date;
  week_start: string | Date;
  week_end: string | Date;
  company: {
    name: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    logo_url?: string | null;
    footer_note?: string | null;
    brand_color?: string | null;
    invoice_template?: string | null;
  };
  driver: {
    name: string;
    type: string;
    address?: string | null;
    email?: string | null;
  };
  loads: Array<{
    load_ref?: string | null;
    vendor?: string | null;
    from_location: string;
    to_location: string;
    load_date: string | Date;
    amount: number;
  }>;
  deductions: Array<{
    deduction_type: string;
    amount: number;
    note?: string | null;
  }>;
  credits?: Array<{
    credit_type: string;
    amount: number;
    note?: string | null;
  }>;
  percent: number;
  tax_percent?: number;
  manual_net_pay?: number | null;
  status?: string;
  due_date?: string | Date | null;
  currency?: string;
  notes?: string | null;
  ytdGrossIncome?: number;
  ytdNetPay?: number;
  ytdCredit?: number;
  ytdAdditions?: number;
  ytdFixedDed?: number;
  ytdCreditPayback?: number;
  credit_payback?: number | null;
}

export const generateInvoiceHTML = (data: InvoiceData) => {
  const normalizeAmount = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const displayedDeductions = data.deductions
    .map((deduction) => ({
      ...deduction,
      deduction_type: deduction.deduction_type || '',
      amount: normalizeAmount(deduction.amount)
    }))
    .filter(
      (deduction) =>
        deduction.deduction_type.trim().toLowerCase() !== 'date del' &&
        deduction.amount > 0
    );

  const normalizedCredits = (data.credits || [])
    .map((credit) => ({
      ...credit,
      credit_type: credit.credit_type || '',
      amount: normalizeAmount(credit.amount)
    }));

  const displayedAdditions = normalizedCredits.filter((credit) => credit.amount > 0);
  const displayedCredits = normalizedCredits.filter((credit) => credit.amount < 0);

  const totals = calculateInvoiceTotals({
    loads: data.loads,
    deductions: displayedDeductions,
    credits: normalizedCredits,
    percent: data.percent,
    tax_percent: data.tax_percent || 0,
    driver_type: data.driver.type,
    manual_net_pay: data.manual_net_pay
  });
  const taxPercent = data.tax_percent || 0;
  const currency = data.currency || 'USD';
  const template = data.company.invoice_template || 'classic';
  const brandColor = /^#[0-9a-fA-F]{3,8}$/.test(data.company.brand_color || '')
    ? data.company.brand_color
    : '#2563eb';

  // Get company email and address from config (falls back to data if not in config)
  const companyDetails = getCompanyDetails(data.company.name);
  const companyEmail = companyDetails.email || data.company.email;
  const companyAddress = companyDetails.address || data.company.address;

  // Determine driver type and calculate accordingly
  const isCompanyDriver = data.driver.type === 'Company Driver';

  // Company Driver: percent is driver pay, net = driverPay - fixedDeductions
  // Owner-Operator: percent is company cut, net = gross - companyCut - fixedDeductions
  const netTotal = totals.net;

  // Label and styling for percentage line
  const percentLabel = isCompanyDriver
    ? `Driver Pay (${data.percent}%)`
    : `Company Cut (${data.percent}%)`;
  const percentColor = isCompanyDriver ? 'text-green-600' : 'text-red-600';
  const percentSign = isCompanyDriver ? '' : '- ';

  // Helper for safe HTML (basic escaping)
  const escapeHtml = (value: string | null | undefined) =>
    value
      ? value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
      : '';

  const safeUrl = (value: string | null | undefined) => {
    if (!value) return '';
    if (value.startsWith('data:') || value.startsWith('blob:')) return value;
    if (value.startsWith('/')) return value;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : '';
    } catch {
      return '';
    }
  };

  // Helper for safe date formatting
  const formatDate = (dateStr: string | Date | null | undefined, fmt: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return format(d, fmt);
    } catch {
      return '-';
    }
  };

  const logoUrl = safeUrl(data.company.logo_url);
  const loadsRows = data.loads.length === 0
    ? `<tr><td colspan="5" class="py-4 text-center text-gray-400 italic">No loads recorded</td></tr>`
    : data.loads.map(load => `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-2 px-3">${formatDate(load.load_date, 'MM/dd/yy')}</td>
        <td class="py-2 px-3">${escapeHtml(load.load_ref) || '-'}</td>
        <td class="py-2 px-3">${escapeHtml(load.from_location) || '-'}</td>
        <td class="py-2 px-3">${escapeHtml(load.to_location) || '-'}</td>
        <td class="py-2 px-3 text-right font-medium">${formatCurrency(load.amount || 0, currency)}</td>
      </tr>
    `).join('');

  // Filter deductions to only include non-zero amounts
  const deductionsRows = displayedDeductions.map(d => `
    <div class="flex justify-between text-sm text-gray-600">
        <span>${escapeHtml(d.deduction_type)} ${d.note ? `(${escapeHtml(d.note)})` : ''}</span>
        <span class="text-red-600">- ${formatCurrency(d.amount, currency)}</span>
    </div>
  `).join('');

  const additionsRows = displayedAdditions.map(c => `
    <div class="flex justify-between text-sm text-gray-600">
        <span>${escapeHtml(c.credit_type)} ${c.note ? `(${escapeHtml(c.note)})` : ''}</span>
        <span class="text-green-600">+ ${formatCurrency(c.amount, currency)}</span>
    </div>
  `).join('');

  const creditsRows = displayedCredits.map(c => `
    <div class="flex justify-between text-sm text-gray-600">
        <span>${escapeHtml(c.credit_type)} ${c.note ? `(${escapeHtml(c.note)})` : ''}</span>
        <span class="text-red-600">- ${formatCurrency(Math.abs(c.amount), currency)}</span>
    </div>
  `).join('');

  if (template === 'mh') {
    const statementDate = formatDate(data.invoice_date, 'MM/dd/yyyy');
    const periodStart = formatDate(data.week_start, 'MM/dd/yyyy');
    const periodEnd = formatDate(data.week_end, 'MM/dd/yyyy');
    const checkDate = data.due_date ? formatDate(data.due_date, 'MM/dd/yyyy') : statementDate;
    const showYtd = !isCompanyDriver && data.ytdGrossIncome !== undefined && data.ytdNetPay !== undefined;
    const ytdGrossIncome = data.ytdGrossIncome ?? 0;
    const ytdNetPay = data.ytdNetPay ?? 0;
    const ytdCredit = data.ytdCredit ?? 0;
    const ytdAdditions = data.ytdAdditions ?? 0;
    const ytdFixedDed = data.ytdFixedDed ?? 0;
    const ytdCreditPayback = data.ytdCreditPayback ?? 0;
    const outstandingCredit = Math.max(0, ytdCredit - ytdCreditPayback);

    const formatSigned = (amount: number) => {
      if (!Number.isFinite(amount)) return formatCurrency(0, currency);
      return amount < 0
        ? `(${formatCurrency(Math.abs(amount), currency)})`
        : formatCurrency(amount, currency);
    };

    const summaryRows = [
      {
        label: 'Earnings',
        value: totals.gross,
        ytdLabel: 'YTD Earnings',
        ytdValue: ytdGrossIncome,
        format: 'plain'
      },
      {
        label: 'Advances',
        value: totals.credits,
        ytdLabel: 'YTD Advances',
        ytdValue: ytdCredit - ytdCreditPayback,
        format: 'deduct'
      },
      {
        label: 'Reimbursements',
        value: totals.additions,
        ytdLabel: 'YTD Reimbursements',
        ytdValue: ytdAdditions,
        format: 'plain'
      },
      {
        label: 'Deductions',
        value: totals.fixedDed,
        ytdLabel: 'YTD Deductions',
        ytdValue: ytdFixedDed,
        format: 'deduct'
      },
      {
        label: 'Other Pay',
        value: 0,
        ytdLabel: 'YTD Other Pay',
        ytdValue: 0,
        format: 'plain'
      },
      {
        label: 'Net Pay',
        value: netTotal,
        ytdLabel: 'YTD Net Pay',
        ytdValue: ytdNetPay,
        format: 'net'
      }
    ];

    const sectionHeaderStyle = [
      'background:#6674a8',
      'color:#ffffff',
      'font-weight:700',
      'text-align:center',
      'font-size:12px',
      'letter-spacing:0.08em',
      'padding:6px 8px',
      'text-transform:uppercase'
    ].join(';');
    const tableHeaderStyle = [
      'background:#e1e8f6',
      'color:#1f2a56',
      'font-weight:700',
      'font-size:11px',
      'text-transform:uppercase'
    ].join(';');
    const cellStyle = 'border:1px solid #cfd6ea;padding:6px 6px;font-size:11px;';
    const labelCellStyle = `${cellStyle}background:#f3f6fc;color:#1f2a56;font-weight:600;`;
    const valueCellStyle = `${cellStyle}text-align:right;`;

    const loadRows = data.loads.length === 0
      ? `<tr><td colspan="6" style="${cellStyle}text-align:center;color:#6b7280;font-style:italic;">No loads recorded</td></tr>`
      : data.loads.map(load => `
          <tr>
            <td style="${cellStyle}">${escapeHtml(load.load_ref) || '-'}</td>
            <td style="${cellStyle}">${escapeHtml(load.from_location) || '-'}</td>
            <td style="${cellStyle}">${escapeHtml(load.to_location) || '-'}</td>
            <td style="${cellStyle}">${escapeHtml(load.vendor || 'Linehaul')}</td>
            <td style="${valueCellStyle}">${formatCurrency(load.amount || 0, currency)}</td>
            <td style="${valueCellStyle}">${formatCurrency(load.amount || 0, currency)}</td>
          </tr>
        `).join('');

    const summaryRowsHtml = summaryRows.map((row) => {
      const formatValue = (value: number) => {
        if (row.format === 'deduct') {
          return formatSigned(-Math.abs(value || 0));
        }
        return formatSigned(value);
      };
      return `
        <tr>
          <td style="${labelCellStyle}">${row.label}</td>
          <td style="${valueCellStyle}">${formatValue(row.value)}</td>
          <td style="${labelCellStyle}">${row.ytdLabel}</td>
          <td style="${valueCellStyle}">${showYtd ? formatValue(row.ytdValue) : '-'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="max-w-4xl mx-auto bg-white p-8 text-sm text-gray-800 font-sans" id="invoice-container">
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="vertical-align:top;width:60%;">
              <div style="font-size:16px;font-weight:700;text-transform:uppercase;">${escapeHtml(data.company.name)}</div>
              <div style="font-size:11px;color:#4b5563;margin-top:4px;">
                ${companyAddress ? `<div>${escapeHtml(companyAddress)}</div>` : ''}
                ${companyEmail ? `<div>${escapeHtml(companyEmail)}</div>` : ''}
                ${data.company.phone ? `<div>${escapeHtml(data.company.phone)}</div>` : ''}
              </div>
            </td>
            <td style="vertical-align:top;width:40%;">
              <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <tr>
                  <td style="padding:2px 0;color:#374151;font-weight:600;">Statement Date:</td>
                  <td style="padding:2px 0;text-align:right;">${statementDate}</td>
                </tr>
                <tr>
                  <td style="padding:2px 0;color:#374151;font-weight:600;">Period Start:</td>
                  <td style="padding:2px 0;text-align:right;">${periodStart}</td>
                </tr>
                <tr>
                  <td style="padding:2px 0;color:#374151;font-weight:600;">Period End:</td>
                  <td style="padding:2px 0;text-align:right;">${periodEnd}</td>
                </tr>
                <tr>
                  <td style="padding:2px 0;color:#374151;font-weight:600;">Check Date:</td>
                  <td style="padding:2px 0;text-align:right;">${checkDate}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div style="font-size:11px;margin-bottom:12px;">
          <span style="font-weight:600;color:#374151;">Driver:</span>
          <span>${escapeHtml(data.driver.name)}</span>
        </div>

        <div style="${sectionHeaderStyle}">Load Information</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          <thead>
            <tr style="${tableHeaderStyle}">
              <th style="${cellStyle}">Load Number</th>
              <th style="${cellStyle}">PU</th>
              <th style="${cellStyle}">DEL</th>
              <th style="${cellStyle}">Payment Type</th>
              <th style="${cellStyle}text-align:right;">Load Gross</th>
              <th style="${cellStyle}text-align:right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${loadRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="${labelCellStyle}text-align:right;">Total</td>
              <td style="${valueCellStyle}font-weight:700;">${formatCurrency(totals.gross, currency)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="${sectionHeaderStyle}">Adjustments</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          <thead>
            <tr style="${tableHeaderStyle}">
              <th style="${cellStyle}">Deduction Type</th>
              <th style="${cellStyle}">Description</th>
              <th style="${cellStyle}text-align:center;">Quantity</th>
              <th style="${cellStyle}text-align:right;">Rate</th>
              <th style="${cellStyle}text-align:right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${displayedDeductions.length === 0 && displayedCredits.length === 0
              ? `<tr><td colspan="5" style="${cellStyle}text-align:center;color:#6b7280;font-style:italic;">No adjustments</td></tr>`
              : ''}
            ${displayedDeductions.map(d => `
              <tr>
                <td style="${cellStyle}">${escapeHtml(d.deduction_type)}</td>
                <td style="${cellStyle}">${d.note ? escapeHtml(d.note) : '-'}</td>
                <td style="${cellStyle}text-align:center;">1</td>
                <td style="${valueCellStyle}">${formatCurrency(d.amount, currency)}</td>
                <td style="${valueCellStyle}">${formatSigned(-d.amount)}</td>
              </tr>
            `).join('')}
            ${displayedCredits.map(c => `
              <tr>
                <td style="${cellStyle}">${escapeHtml(c.credit_type)}</td>
                <td style="${cellStyle}">${c.note ? escapeHtml(c.note) : '-'}</td>
                <td style="${cellStyle}text-align:center;">1</td>
                <td style="${valueCellStyle}">${formatCurrency(Math.abs(c.amount), currency)}</td>
                <td style="${valueCellStyle}">${formatSigned(c.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="${labelCellStyle}text-align:right;">Total</td>
              <td style="${valueCellStyle}font-weight:700;color:#dc2626;">${formatSigned(-(totals.fixedDed + totals.credits))}</td>
            </tr>
          </tfoot>
        </table>

        <div style="${sectionHeaderStyle}">Summary</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          <tbody>
            ${summaryRowsHtml}
          </tbody>
        </table>

        <div style="${sectionHeaderStyle}">Balances</div>
        <table style="width:45%;border-collapse:collapse;margin-bottom:18px;">
          <tbody>
            <tr>
              <td style="${labelCellStyle}">Cash Advance</td>
              <td style="${valueCellStyle}">${formatSigned(-outstandingCredit)}</td>
            </tr>
            <tr>
              <td style="${labelCellStyle}font-weight:700;">Total</td>
              <td style="${valueCellStyle}font-weight:700;">${formatSigned(-outstandingCredit)}</td>
            </tr>
          </tbody>
        </table>

        ${(data.notes || data.company.footer_note) ? `
          <div style="border-top:1px solid #e5e7eb;padding-top:10px;font-size:11px;color:#6b7280;">
            ${data.notes ? `<div style="margin-bottom:6px;"><span style="font-weight:600;">Notes:</span> ${escapeHtml(data.notes)}</div>` : ''}
            ${data.company.footer_note ? `<div style="font-style:italic;">${escapeHtml(data.company.footer_note)}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="max-w-4xl mx-auto bg-white p-8 text-sm text-gray-800 font-sans" id="invoice-container">
      <!-- Header -->
      ${template === 'modern' ? `
        <div class="rounded-lg overflow-hidden mb-6 border border-gray-100">
          <div style="background:${brandColor};" class="px-6 py-4 text-white flex justify-between items-center">
            <div>
              <p class="text-xs uppercase tracking-wide">Statement</p>
              ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="h-10 mb-2" />` : ''}
              <h1 class="text-2xl font-semibold">${escapeHtml(data.company.name)}</h1>
            </div>
            <div class="text-right text-sm">
              <p>${formatDate(data.invoice_date, 'MMM dd, yyyy')}</p>
            </div>
          </div>
          <div class="px-6 py-4 flex justify-between text-sm text-gray-600">
            <div>
              ${companyAddress ? `<p>${escapeHtml(companyAddress)}</p>` : ''}
              ${companyEmail ? `<p>${escapeHtml(companyEmail)}</p>` : ''}
              ${data.company.phone ? `<p>${escapeHtml(data.company.phone)}</p>` : ''}
            </div>
            <div class="text-right">
              <p>Week start : ${formatDate(data.week_start, 'MM/dd/yy')}</p>
              <p>Week end : ${formatDate(data.week_end, 'MM/dd/yy')}</p>
              ${data.due_date ? `<p><span class="font-medium">Due:</span> ${formatDate(data.due_date, 'MMM dd, yyyy')}</p>` : ''}
            </div>
          </div>
        </div>
      ` : `
        <div class="flex justify-between items-start border-b pb-6 mb-6">
          <div>
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="h-10 mb-2" />` : ''}
            <div style="background:${brandColor};" class="h-1 w-12 rounded-full mb-2"></div>
            <h1 class="text-2xl font-bold text-gray-900 uppercase tracking-wide mb-1">
              ${escapeHtml(data.company.name)}
            </h1>
            <div class="text-gray-500 space-y-1">
              ${companyAddress ? `<p>${escapeHtml(companyAddress)}</p>` : ''}
              ${companyEmail ? `<p>${escapeHtml(companyEmail)}</p>` : ''}
              ${data.company.phone ? `<p>${escapeHtml(data.company.phone)}</p>` : ''}
            </div>
          </div>
          <div class="text-right">
            <h2 class="text-xl font-semibold text-gray-700">STATEMENT</h2>
            <div class="mt-2 space-y-1">
              <p><span class="font-medium">Date:</span> ${formatDate(data.invoice_date, 'MMM dd, yyyy')}</p>
              <p>Week start : ${formatDate(data.week_start, 'MM/dd/yy')}</p>
              <p>Week end : ${formatDate(data.week_end, 'MM/dd/yy')}</p>
              ${data.due_date ? `<p><span class="font-medium">Due:</span> ${formatDate(data.due_date, 'MMM dd, yyyy')}</p>` : ''}
            </div>
          </div>
        </div>
      `}

      <!-- Bill To -->
      <div class="mb-8">
        <h3 class="text-gray-500 uppercase text-xs font-bold tracking-wider mb-2">Driver / Recipient</h3>
        <div class="p-4 bg-gray-50 rounded border border-gray-100">
            <p class="text-lg font-semibold text-gray-900">${escapeHtml(data.driver.name)}</p>
            <p class="text-gray-600">${escapeHtml(data.driver.type)}</p>
            ${data.driver.address ? `<p class="text-gray-500">${escapeHtml(data.driver.address)}</p>` : ''}
        </div>
      </div>

      <!-- Loads Table -->
      <div class="mb-8">
        <h3 class="text-gray-500 uppercase text-xs font-bold tracking-wider mb-2">Loads</h3>
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-100 border-b border-gray-200">
              <th class="py-2 px-3 font-semibold text-gray-600">Date PU</th>
              <th class="py-2 px-3 font-semibold text-gray-600">Load</th>
              <th class="py-2 px-3 font-semibold text-gray-600">From</th>
              <th class="py-2 px-3 font-semibold text-gray-600">To</th>
              <th class="py-2 px-3 font-semibold text-gray-600 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${loadsRows}
          </tbody>
          <tfoot>
            <tr class="bg-gray-50 font-semibold">
                <td colspan="4" class="py-2 px-3 text-right">Total Load Amount</td>
                <td class="py-2 px-3 text-right">${formatCurrency(totals.gross, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Deductions & Net -->
      <div class="flex justify-end mb-8">
        <div class="w-1/2 space-y-3">
            ${data.percent > 0 ? `
             <!-- Percentage Line (Driver Pay for Company Driver, Company Cut for Owner-Operator) -->
            <div class="flex justify-between text-gray-600 border-b border-gray-100 pb-2">
                <span>${percentLabel}</span>
                <span class="${percentColor}">${percentSign}${formatCurrency(totals.percentAmount, currency)}</span>
            </div>

            ${isCompanyDriver ? `
            <!-- For Company Driver: show that this is the base amount before deductions -->
            <div class="flex justify-between font-medium text-gray-800 pb-2">
                <span>Driver Pay Base</span>
                <span>${formatCurrency(totals.percentAmount, currency)}</span>
            </div>
            ` : `
            <!-- For Owner-Operator: show subtotal after company cut -->
            <div class="flex justify-between font-medium text-gray-800 pb-2">
                <span>Subtotal (After Company Cut)</span>
                <span>${formatCurrency(totals.gross - totals.percentAmount, currency)}</span>
            </div>
            `}
            ` : ''}

            <!-- Fixed Deductions -->
            ${displayedDeductions.length > 0 ? `
                <div class="border-t border-gray-200 pt-2 space-y-1">
                    ${deductionsRows}
                    <div class="flex justify-between font-medium text-gray-800 pt-1 border-t border-gray-100">
                         <span>Total Fixed Deductions</span>
                         <span class="text-red-600">- ${formatCurrency(totals.fixedDed, currency)}</span>
                    </div>
                </div>
            ` : ''}

            <!-- Additions -->
            ${displayedAdditions.length > 0 ? `
                <div class="border-t border-gray-200 pt-2 space-y-1">
                    <div class="text-xs uppercase tracking-wider text-gray-500 font-bold">Additions</div>
                    ${additionsRows}
                    <div class="flex justify-between font-medium text-gray-800 pt-1 border-t border-gray-100">
                         <span>Total Additions</span>
                         <span class="text-green-600">+ ${formatCurrency(totals.additions, currency)}</span>
                    </div>
                </div>
            ` : ''}

            <!-- Credits -->
            ${displayedCredits.length > 0 ? `
                <div class="border-t border-gray-200 pt-2 space-y-1">
                    <div class="text-xs uppercase tracking-wider text-gray-500 font-bold">Credit (Deducted)</div>
                    ${creditsRows}
                    <div class="flex justify-between font-medium text-gray-800 pt-1 border-t border-gray-100">
                         <span>Total Credit</span>
                         <span class="text-red-600">- ${formatCurrency(totals.credits, currency)}</span>
                    </div>
                </div>
            ` : ''}

            ${taxPercent > 0 ? `
            <div class="flex justify-between text-gray-600 border-t border-gray-200 pt-2">
                <span>Tax (${taxPercent}%)</span>
                <span class="text-red-600">- ${formatCurrency(totals.taxAmount, currency)}</span>
            </div>
            ` : ''}

            <!-- Net Total -->
            <div class="flex justify-between items-center bg-gray-900 text-white p-3 rounded text-lg font-bold mt-4">
                <span>NET PAY</span>
                <span>${formatCurrency(netTotal, currency)}</span>
            </div>

            <!-- YTD Section - Only for Owner-Operators -->
            ${!isCompanyDriver && (data.ytdGrossIncome !== undefined && data.ytdNetPay !== undefined) ? `
            <div class="border-t border-gray-300 pt-4 mt-4 space-y-2">
                <div class="flex justify-between text-sm text-gray-700">
                    <span class="font-semibold uppercase tracking-wide">YTD GROSS INCOME</span>
                    <span class="font-bold">${formatCurrency(data.ytdGrossIncome, currency)}</span>
                </div>
                <div class="flex justify-between text-sm text-gray-700">
                    <span class="font-semibold uppercase tracking-wide">YTD NET PAY</span>
                    <span class="font-bold">${formatCurrency(data.ytdNetPay, currency)}</span>
                </div>
                ${data.ytdCredit !== undefined ? `
                <div class="flex justify-between text-sm text-gray-700">
                    <span class="font-semibold uppercase tracking-wide">YTD CREDIT</span>
                    <span class="font-bold ${(data.ytdCredit - (data.ytdCreditPayback || 0)) > 0 ? 'text-red-600' : 'text-green-600'}">${(data.ytdCredit - (data.ytdCreditPayback || 0)) > 0 ? '- ' : ''}${formatCurrency(Math.abs(data.ytdCredit - (data.ytdCreditPayback || 0)), currency)}</span>
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>
      </div>

      <!-- Footer -->
      ${(data.notes || data.company.footer_note) ? `
        <div class="border-t pt-4 text-gray-500 text-sm">
            ${data.notes ? `<p class="mb-2"><span class="font-semibold">Notes:</span> ${escapeHtml(data.notes)}</p>` : ''}
            ${data.company.footer_note ? `<p class="italic">${escapeHtml(data.company.footer_note)}</p>` : ''}
        </div>
      ` : ''}
    </div>
  `;
};

export const InvoiceTemplate: React.FC<{ data: InvoiceData }> = ({ data }) => {
  const html = generateInvoiceHTML(data);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};
