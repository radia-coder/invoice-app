'use client';

import { useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';

interface DownloadReportButtonProps {
  companyId: number | null;
  driverId: number | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export default function DownloadReportButton({
  companyId,
  driverId,
  dateFrom,
  dateTo,
}: DownloadReportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'full' | 'changes'>('full');
  const [error, setError] = useState<string | null>(null);
  const [vendor, setVendor] = useState('');

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('mode', mode);

      if (driverId) {
        params.set('scope', 'driver');
        params.set('driverId', driverId.toString());
      } else if (companyId) {
        params.set('scope', 'company');
        params.set('companyId', companyId.toString());
      } else {
        params.set('scope', 'all');
      }

      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (vendor.trim()) params.set('vendor', vendor.trim());

      const response = await fetch(`/api/reports/export?${params.toString()}`);

      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.error) {
          setError(data.error + (data.details ? `: ${JSON.stringify(data.details)}` : ''));
          return;
        }
        if (data.message) {
          setError(data.message);
          return;
        }
      }

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `OP Exp Weyrah ${new Date().getFullYear()}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const warnings = response.headers.get('X-Export-Warnings');
      if (warnings) {
        console.warn('Export warnings:', warnings);
      }
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-none">
        {/* 6. Vendor search input */}
        <div className="relative flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Search"
            className="h-11 w-[130px] rounded-xl border border-zinc-700 bg-zinc-800 pl-9 pr-3 text-sm text-white placeholder-zinc-500"
          />
        </div>

        {/* 7. Export mode toggle (icon-only) */}
        <div className="flex rounded-xl overflow-hidden border border-zinc-700 flex-none">
          <button
            type="button"
            onClick={() => setMode('full')}
            title="Full Export"
            className={`h-11 w-11 flex items-center justify-center text-lg transition-colors ${
              mode === 'full'
                ? 'bg-[#7a67e7] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            🗂️
          </button>
          <button
            type="button"
            onClick={() => setMode('changes')}
            title="Changes Only"
            className={`h-11 w-11 flex items-center justify-center text-lg transition-colors border-l border-zinc-700 ${
              mode === 'changes'
                ? 'bg-[#7a67e7] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            🔁
          </button>
        </div>

        {/* 8. Download button (green) */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={isLoading}
          className="h-11 flex-none inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Download className="h-4 w-4" />
              XLSX
            </>
          )}
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-md bg-red-900/90 border border-red-700 text-red-100 px-4 py-3 rounded-lg shadow-lg z-50">
          <p className="text-sm">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="absolute top-1 right-2 text-red-300 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}
