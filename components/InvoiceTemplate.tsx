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
  percent: number;
  tax_percent?: number;
  status?: string;
  due_date?: string | Date | null;
  currency?: string;
  notes?: string | null;
}

export const generateInvoiceHTML = (data: InvoiceData) => {
  const totals = calculateInvoiceTotals({
    loads: data.loads,
    deductions: data.deductions,
    percent: data.percent,
    tax_percent: data.tax_percent || 0,
    driver_type: data.driver.type
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

  const deductionsRows = data.deductions.map(d => `
    <div class="flex justify-between text-sm text-gray-600">
        <span>${escapeHtml(d.deduction_type)} ${d.note ? `(${escapeHtml(d.note)})` : ''}</span>
        <span class="text-red-600">- ${formatCurrency(d.amount, currency)}</span>
    </div>
  `).join('');

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

            <!-- Fixed Deductions -->
            ${data.deductions.length > 0 ? `
                <div class="border-t border-gray-200 pt-2 space-y-1">
                    ${deductionsRows}
                    <div class="flex justify-between font-medium text-gray-800 pt-1 border-t border-gray-100">
                         <span>Total Fixed Deductions</span>
                         <span class="text-red-600">- ${formatCurrency(totals.fixedDed, currency)}</span>
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
