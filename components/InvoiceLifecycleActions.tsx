'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface InvoiceLifecycleActionsProps {
  invoiceId: number;
  status: string;
  defaultTo?: string | null;
  invoiceNumber?: string | null;
  driverWhatsappNumber?: string | null;
  driverWhatsappLink?: string | null;
}

export default function InvoiceLifecycleActions({
  invoiceId,
  status,
  defaultTo,
  invoiceNumber,
  driverWhatsappNumber,
  driverWhatsappLink
}: InvoiceLifecycleActionsProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [to, setTo] = useState(defaultTo || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [creatingShare, setCreatingShare] = useState(false);

  const updateStatus = async (nextStatus: 'draft' | 'sent' | 'paid') => {
    setUpdating(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Failed to update status.');
      } else {
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      setError('Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const sendInvoice = async () => {
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Failed to send invoice.');
      } else {
        setShowSend(false);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      setError('Failed to send invoice.');
    } finally {
      setSending(false);
    }
  };

  const createShareLink = async () => {
    setCreatingShare(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Failed to create share link.');
        return;
      }
      const data = await res.json();
      setShareUrl(data.url);
      const baseMessage = `Invoice ${invoiceNumber || ''}`.trim();
      setShareMessage(baseMessage ? `${baseMessage}: ${data.url}` : data.url);
    } catch (e) {
      console.error(e);
      setError('Failed to create share link.');
    } finally {
      setCreatingShare(false);
    }
  };

  const openWhatsapp = () => {
    if (driverWhatsappNumber) {
      const digits = driverWhatsappNumber.replace(/\D/g, '');
      const text = shareMessage || `Invoice ${invoiceNumber || ''}`.trim();
      const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      return;
    }
    if (driverWhatsappLink) {
      window.open(driverWhatsappLink, '_blank');
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-zinc-400">Status</p>
          <p className="text-lg font-semibold capitalize text-white">{status}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {status !== 'draft' ? (
            <button
              type="button"
              onClick={() => updateStatus('draft')}
              disabled={updating}
              className="px-3 py-1.5 text-sm rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-60"
            >
              Revert to Draft
            </button>
          ) : null}
          {status === 'draft' ? (
            <button
              type="button"
              onClick={() => updateStatus('sent')}
              disabled={updating}
              className="px-3 py-1.5 text-sm rounded-lg border border-[#7a67e7]/30 text-[#7a67e7] hover:bg-[#7a67e7]/10 transition-colors disabled:opacity-60"
            >
              Mark Sent
            </button>
          ) : null}
          {status !== 'paid' ? (
            <button
              type="button"
              onClick={() => updateStatus('paid')}
              disabled={updating}
              className="px-3 py-1.5 text-sm rounded-lg border border-[#7a67e7]/30 text-[#7a67e7] hover:bg-[#7a67e7]/10 transition-colors disabled:opacity-60"
            >
              Mark Paid
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
        <button
          type="button"
          onClick={() => setShowSend((prev) => !prev)}
          className="text-sm text-[#7a67e7] hover:text-[#6b59d6] transition-colors"
        >
          {showSend ? 'Hide Email Form' : 'Send Invoice Email'}
        </button>
        <button
          type="button"
          onClick={createShareLink}
          disabled={creatingShare}
          className="text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-60"
        >
          {creatingShare ? 'Creating link...' : 'Generate PDF Link'}
        </button>
      </div>

      {shareUrl ? (
        <div className="space-y-2 text-sm">
          <input
            value={shareUrl}
            readOnly
            className="w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Copy Link
            </button>
            {(driverWhatsappLink || driverWhatsappNumber) ? (
              <button
                type="button"
                onClick={openWhatsapp}
                className="px-3 py-1.5 rounded-lg border border-[#7a67e7]/30 text-[#7a67e7] hover:bg-[#7a67e7]/10 transition-colors"
              >
                Open WhatsApp
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showSend ? (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full rounded-lg border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm border p-2 text-sm focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional message"
            rows={3}
            className="w-full rounded-lg border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm border p-2 text-sm focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
          />
          <button
            type="button"
            onClick={sendInvoice}
            disabled={sending || !to}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#7a67e7] hover:bg-[#6b59d6] disabled:opacity-60 transition-colors"
          >
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
