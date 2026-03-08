'use client';

import { useState } from 'react';

interface InvoiceWhatsappShareProps {
  invoiceId: number;
  invoiceNumber?: string | null;
  weekEnd?: Date | null;
  driverWhatsappNumber?: string | null;
  driverWhatsappLink?: string | null;
}

function buildWhatsappUrl(number: string, message: string) {
  const digits = number.replace(/\D/g, '');
  if (!digits) return '';
  return `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`;
}

function normalizeLink(link: string) {
  if (!link) return '';
  if (link.startsWith('http://') || link.startsWith('https://')) {
    return link;
  }
  return `https://${link}`;
}

export default function InvoiceWhatsappShare({
  invoiceId,
  invoiceNumber,
  weekEnd,
  driverWhatsappNumber,
  driverWhatsappLink
}: InvoiceWhatsappShareProps) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const hasNumber = Boolean(driverWhatsappNumber && driverWhatsappNumber.replace(/\D/g, ''));

  const ensureShareLink = async () => {
    if (shareUrl) return shareUrl;
    const res = await fetch(`/api/invoices/${invoiceId}/share`, { method: 'POST' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let message = 'Failed to create PDF link.';
      try {
        const data = text ? JSON.parse(text) : {};
        if (data?.error) message = data.error;
      } catch {
        if (text) message = text;
      }
      throw new Error(message);
    }
    const data = await res.json();
    setShareUrl(data.url);
    return data.url as string;
  };

  const createShare = async () => {
    setLoading(true);
    setError('');
    try {
      await ensureShareLink();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to create PDF link.');
    } finally {
      setLoading(false);
    }
  };

  const isElectron = typeof window !== 'undefined' && (window as any).electronApp?.isElectron;

  const formatMessage = () => {
    if (weekEnd) {
      const d = new Date(weekEnd);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `INVOICE - ${mm}/${dd}/${yyyy}`;
    }
    return invoiceNumber ? `INVOICE - ${invoiceNumber}` : 'INVOICE';
  };

  const sendOnWhatsapp = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!hasNumber || !driverWhatsappNumber) {
        setError('Add a driver WhatsApp number to include the PDF link.');
        return;
      }

      if (isElectron) {
        // Copy PDF to clipboard + open WhatsApp — user presses Cmd+V to attach
        await (window as any).electronApp.openWhatsApp(driverWhatsappNumber, invoiceId, formatMessage());
        setSuccess('PDF copied to clipboard! WhatsApp is opening — press Cmd+V to attach the PDF.');
      } else {
        // Web: generate a shareable PDF link and open WhatsApp Web
        const url = await ensureShareLink();
        const message = `${formatMessage()}: ${url}`;
        const whatsapp = buildWhatsappUrl(driverWhatsappNumber, message);
        if (!whatsapp) {
          setError('Driver WhatsApp number is invalid.');
          return;
        }
        setWhatsappUrl(whatsapp);
        window.open(whatsapp, '_blank');
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to send on WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  const normalizedLink = driverWhatsappLink ? normalizeLink(driverWhatsappLink) : '';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm text-zinc-400">WhatsApp</p>
        <p className="text-lg font-semibold text-white">Send PDF to Driver</p>
      </div>

      {driverWhatsappNumber ? (
        <p className="text-sm text-zinc-300">Number: {driverWhatsappNumber}</p>
      ) : normalizedLink ? (
        <p className="text-sm text-zinc-300">Saved link: {normalizedLink}</p>
      ) : (
        <p className="text-sm text-zinc-400">No WhatsApp info saved for this driver.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sendOnWhatsapp}
          disabled={loading || !hasNumber}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Opening...' : 'Send on WhatsApp'}
        </button>
        {isElectron ? (
          <button
            type="button"
            onClick={() => (window as any).electronApp.showPdfInFinder(invoiceId)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            Show PDF in Finder
          </button>
        ) : (
          <button
            type="button"
            onClick={createShare}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:text-white disabled:opacity-60 transition-colors"
          >
            Generate PDF Link
          </button>
        )}
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
              Copy PDF Link
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg border border-[#7a67e7]/30 text-[#7a67e7] hover:bg-[#7a67e7]/10 transition-colors"
            >
              Open PDF
            </a>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg border border-[#7a67e7]/30 text-[#7a67e7] hover:bg-[#7a67e7]/10 transition-colors"
              >
                Open WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {normalizedLink && !whatsappUrl ? (
        <a
          href={normalizedLink}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[#7a67e7] hover:text-[#6b59d6] transition-colors"
        >
          Open saved WhatsApp link
        </a>
      ) : null}

      {success ? <p className="text-sm text-emerald-400 font-medium">{success}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
