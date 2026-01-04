'use client';

import { format } from 'date-fns';

interface Deduction {
  name: string;
  amount: number;
}

interface WeeklySummaryData {
  id: number;
  weekStart: Date;
  weekEnd: Date;
  companyName: string;
  driverName: string;
  driverType: string;
  loadsCount: number;
  grossTotal: number;
  percentValue: number;
  percentAmount: number;
  subtotalAfterPercent: number;
  fixedDeductions: Deduction[];
  totalFixedDeductions: number;
  taxPercent: number;
  taxAmount: number;
  netPay: number;
  status: string;
}

interface WeeklySummaryCardProps {
  summary: WeeklySummaryData;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date): string {
  return format(new Date(date), 'MM/dd/yy');
}

export default function WeeklySummaryCard({ summary }: WeeklySummaryCardProps) {
  const isOwnerOperator = summary.driverType !== 'Company Driver';
  const percentLabel = isOwnerOperator ? 'Company Cut' : 'Driver Pay';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-full">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Week Start {formatDate(summary.weekStart)} – Week End {formatDate(summary.weekEnd)}
        </h3>
        {summary.status && (
          <span
            className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
              summary.status === 'paid'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : summary.status === 'sent'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
            }`}
          >
            {summary.status}
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="px-5 py-4 space-y-3 flex-1">
        {/* Company & Driver Info */}
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Company</span>
          <span className="text-white font-medium">{summary.companyName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Driver</span>
          <span className="text-white font-medium">{summary.driverName}</span>
        </div>

        <div className="border-t border-zinc-800 my-3" />

        {/* Loads */}
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Loads</span>
          <span className="text-white font-medium">{summary.loadsCount}</span>
        </div>

        {/* Gross Total */}
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Gross Total</span>
          <span className="text-white font-medium">{formatMoney(summary.grossTotal)}</span>
        </div>

        <div className="border-t border-zinc-800 my-3" />

        {/* Company Cut / Driver Pay */}
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">{percentLabel} ({summary.percentValue}%)</span>
          <span className={isOwnerOperator ? 'text-red-400 font-medium' : 'text-emerald-400 font-medium'}>
            {isOwnerOperator ? '-' : ''}{formatMoney(summary.percentAmount)}
          </span>
        </div>

        {/* Subtotal */}
        <div className="flex justify-between text-sm font-medium">
          <span className="text-zinc-300">
            {isOwnerOperator ? 'Subtotal (After Company Cut)' : 'Driver Pay Base'}
          </span>
          <span className="text-white">{formatMoney(summary.subtotalAfterPercent)}</span>
        </div>

        {/* Fixed Deductions Section */}
        {summary.fixedDeductions.length > 0 && (
          <>
            <div className="border-t border-zinc-800 my-3" />
            <div className="space-y-2">
              {summary.fixedDeductions.map((deduction, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-zinc-400">{deduction.name}</span>
                  <span className="text-red-400">- {formatMoney(deduction.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium pt-1">
                <span className="text-zinc-300">Total Fixed Deductions</span>
                <span className="text-red-400">- {formatMoney(summary.totalFixedDeductions)}</span>
              </div>
            </div>
          </>
        )}

        {/* Tax */}
        {summary.taxPercent > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Tax ({summary.taxPercent}%)</span>
            <span className="text-red-400">- {formatMoney(summary.taxAmount)}</span>
          </div>
        )}
      </div>

      {/* Net Pay Footer */}
      <div className="bg-zinc-950 px-5 py-4 flex justify-between items-center">
        <span className="text-sm font-bold text-white">NET PAY</span>
        <span className="text-lg font-bold text-emerald-400">{formatMoney(summary.netPay)}</span>
      </div>
    </div>
  );
}

export type { WeeklySummaryData, Deduction };
