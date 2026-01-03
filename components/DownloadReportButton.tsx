'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

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

  const handleDownload = async () => {
    setIsLoading(true);

    try {
      // Build query params
      const params = new URLSearchParams();

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
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isLoading}
      className="inline-flex items-center gap-2 h-12 rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download XLSX
        </>
      )}
    </button>
  );
}
