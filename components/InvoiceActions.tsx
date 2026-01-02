'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';

interface InvoiceActionsProps {
  invoiceId: number;
  status?: string;
}

export default function InvoiceActions({ invoiceId }: InvoiceActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Delete this invoice?')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to delete invoice');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting invoice');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <a
        href={`/api/invoices/${invoiceId}/pdf`}
        target="_blank"
        className="text-gray-400 hover:text-gray-600"
        title="Download PDF"
      >
        <Download className="h-5 w-5" />
      </a>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-md bg-[#301b1f] p-1.5 text-red-300 hover:bg-[#3a2428] disabled:opacity-50"
        title="Delete Invoice"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  );
}
