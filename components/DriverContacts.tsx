'use client';

import { useState } from 'react';

interface DriverContact {
  id: number;
  name: string;
  email?: string | null;
  whatsapp_number?: string | null;
  whatsapp_link?: string | null;
}

interface DriverContactsProps {
  drivers: DriverContact[];
}

export default function DriverContacts({ drivers }: DriverContactsProps) {
  const [rows, setRows] = useState(drivers);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const updateRow = (id: number, key: keyof DriverContact, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  };

  const saveRow = async (driver: DriverContact) => {
    setSavingId(driver.id);
    setMessage('');
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: driver.email || null,
          whatsapp_number: driver.whatsapp_number || null,
          whatsapp_link: driver.whatsapp_link || null
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data?.error || 'Failed to save driver.');
      } else {
        setMessage(`Saved ${driver.name}`);
      }
    } catch (error) {
      console.error(error);
      setMessage('Failed to save driver.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-400">Driver</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-400">Email (optional)</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-400">WhatsApp # (optional)</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-400">WhatsApp Link (optional)</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((driver) => (
              <tr key={driver.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{driver.name}</td>
                <td className="px-4 py-3">
                  <input
                    type="email"
                    value={driver.email || ''}
                    onChange={(e) => updateRow(driver.id, 'email', e.target.value)}
                    className="w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={driver.whatsapp_number || ''}
                    onChange={(e) => updateRow(driver.id, 'whatsapp_number', e.target.value)}
                    className="w-full rounded-lg border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm border p-2 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
                    placeholder="+905366955371"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={driver.whatsapp_link || ''}
                    onChange={(e) => updateRow(driver.id, 'whatsapp_link', e.target.value)}
                    className="w-full rounded-lg border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm border p-2 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
                    placeholder="https://wa.link/..."
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => saveRow(driver)}
                    disabled={savingId === driver.id}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#7a67e7] hover:bg-[#6b59d6] disabled:opacity-60 transition-colors"
                  >
                    {savingId === driver.id ? 'Saving...' : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
    </div>
  );
}
