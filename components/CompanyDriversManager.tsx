'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CompanyOption {
  id: number;
  name: string;
}

interface DriverItem {
  id: number;
  name: string;
  email?: string | null;
  whatsapp_number?: string | null;
  company_name?: string | null;
}

interface CompanyDriversManagerProps {
  companies: CompanyOption[];
  selectedCompanyId: number;
  assignedDrivers: DriverItem[];
  availableDrivers: DriverItem[];
  canSelectCompany: boolean;
}

export default function CompanyDriversManager({
  companies,
  selectedCompanyId,
  assignedDrivers,
  availableDrivers,
  canSelectCompany
}: CompanyDriversManagerProps) {
  const router = useRouter();
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createCompanyId, setCreateCompanyId] = useState(String(selectedCompanyId));
  const [createError, setCreateError] = useState('');
  const [createMessage, setCreateMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const [assignDriverId, setAssignDriverId] = useState(availableDrivers[0]?.id ? String(availableDrivers[0].id) : '');
  const [assignCompanyId, setAssignCompanyId] = useState(String(selectedCompanyId));
  const [assignError, setAssignError] = useState('');
  const [assignMessage, setAssignMessage] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [unassigningId, setUnassigningId] = useState<number | null>(null);
  const [unassignError, setUnassignError] = useState('');

  useEffect(() => {
    setCreateCompanyId(String(selectedCompanyId));
    setAssignCompanyId(String(selectedCompanyId));
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!availableDrivers.length) {
      setAssignDriverId('');
      return;
    }
    setAssignDriverId((current) => {
      if (current && availableDrivers.some((driver) => String(driver.id) === current)) {
        return current;
      }
      return String(availableDrivers[0].id);
    });
  }, [availableDrivers]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    setCreateMessage('');
    setUnassignError('');

    if (!createName.trim()) {
      setCreateError('Name is required.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          email: createEmail.trim() || null,
          whatsapp_number: createPhone.trim() || null,
          company_id: Number(createCompanyId)
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data?.error || 'Failed to create driver.');
        return;
      }

      setCreateMessage('Driver created.');
      setCreateName('');
      setCreateEmail('');
      setCreatePhone('');
      router.refresh();
    } catch (error) {
      console.error(error);
      setCreateError('Failed to create driver.');
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    setAssignError('');
    setAssignMessage('');
    setUnassignError('');

    if (!assignDriverId) {
      setAssignError('Select a driver to assign.');
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch(`/api/drivers/${assignDriverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: Number(assignCompanyId)
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAssignError(data?.error || 'Failed to assign driver.');
        return;
      }

      setAssignMessage('Driver assigned.');
      router.refresh();
    } catch (error) {
      console.error(error);
      setAssignError('Failed to assign driver.');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (driverId: number) => {
    setUnassignError('');
    setCreateMessage('');
    setAssignMessage('');
    setAssignError('');
    setCreateError('');
    setUnassigningId(driverId);

    try {
      const res = await fetch(`/api/drivers/${driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: null })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUnassignError(data?.error || 'Failed to unassign driver.');
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setUnassignError('Failed to unassign driver.');
    } finally {
      setUnassigningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white">Add New Driver</h2>
        <p className="mt-1 text-sm text-zinc-400">Create a driver and assign them to a company.</p>
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Driver Name</label>
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300">Company</label>
            <select
              value={createCompanyId}
              onChange={(event) => setCreateCompanyId(event.target.value)}
              disabled={!canSelectCompany && companies.length === 1}
              className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300">Email (optional)</label>
            <input
              type="email"
              value={createEmail}
              onChange={(event) => setCreateEmail(event.target.value)}
              className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300">Phone (optional)</label>
            <input
              value={createPhone}
              onChange={(event) => setCreatePhone(event.target.value)}
              placeholder="+1 555 000 1234"
              className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <div>
              {createError ? <p className="text-sm text-red-400">{createError}</p> : null}
              {createMessage ? <p className="text-sm text-emerald-400">{createMessage}</p> : null}
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[#7a67e7] hover:bg-[#6b59d6] disabled:opacity-60 transition-colors"
            >
              {creating ? 'Saving...' : 'Add Driver'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white">Assign Existing Driver</h2>
        <p className="mt-1 text-sm text-zinc-400">Attach an existing driver to a company.</p>
        <form onSubmit={handleAssign} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Driver</label>
            <select
              value={assignDriverId}
              onChange={(event) => setAssignDriverId(event.target.value)}
              className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5"
              disabled={!availableDrivers.length}
            >
              {availableDrivers.length ? (
                availableDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.company_name ? `${driver.name} (${driver.company_name})` : `${driver.name} (Unassigned)`}
                  </option>
                ))
              ) : (
                <option value="">No unassigned drivers</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300">Company</label>
            <select
              value={assignCompanyId}
              onChange={(event) => setAssignCompanyId(event.target.value)}
              disabled={!canSelectCompany && companies.length === 1}
              className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <div>
              {assignError ? <p className="text-sm text-red-400">{assignError}</p> : null}
              {assignMessage ? <p className="text-sm text-emerald-400">{assignMessage}</p> : null}
            </div>
            <button
              type="submit"
              disabled={assigning || !availableDrivers.length}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[#7a67e7] hover:bg-[#6b59d6] disabled:opacity-60 transition-colors"
            >
              {assigning ? 'Assigning...' : 'Assign Driver'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white">Company Drivers</h2>
        <p className="mt-1 text-sm text-zinc-400">Drivers currently assigned to this company.</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Driver</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Email</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Phone</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {assignedDrivers.length ? (
                assignedDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{driver.name}</td>
                    <td className="px-4 py-3 text-zinc-300">{driver.email || '-'}</td>
                    <td className="px-4 py-3 text-zinc-300">{driver.whatsapp_number || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleUnassign(driver.id)}
                        disabled={unassigningId === driver.id}
                        className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-[#301b1f] hover:bg-[#3a2428] disabled:opacity-60"
                      >
                        {unassigningId === driver.id ? 'Removing...' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    No drivers assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {unassignError ? <p className="mt-3 text-sm text-red-400">{unassignError}</p> : null}
      </div>
    </div>
  );
}
