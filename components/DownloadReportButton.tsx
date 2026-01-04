'use client';

import { useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';

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

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query params
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

      const response = await fetch(`/api/reports/export?${params.toString()}`);

      // Check if it's a JSON response (error or no changes)
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

      // Get the blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'settlement-report.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Check for warnings
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
    <div className="flex items-center gap-2">
      {/* Mode Toggle */}
      <div className="flex rounded-lg overflow-hidden border border-zinc-700">
        <button
          type="button"
          onClick={() => setMode('full')}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            mode === 'full'
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          Full Export
        </button>
        <button
          type="button"
          onClick={() => setMode('changes')}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            mode === 'changes'
              ? 'bg-amber-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          Changes Only
        </button>
      </div>

      {/* Download Button */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 h-12 rounded-lg px-5 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          mode === 'changes'
            ? 'bg-amber-600 hover:bg-amber-500'
            : 'bg-emerald-600 hover:bg-emerald-500'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : mode === 'changes' ? (
          <>
            <RefreshCw className="h-4 w-4" />
            Download Delta
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download XLSX
          </>
        )}
      </button>

      {/* Error Display */}
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
    </div>
  );
}
