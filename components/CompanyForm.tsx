'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';

interface CompanyFormData {
  id: number;
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
  invoice_template: 'classic' | 'modern' | 'mh';
  default_percent: number;
  default_tax_percent: number;
  factoring_rate: number;
  dispatch_rate: number;
  auto_deduction_base: 'YTD_INSURANCE';
  invoice_prefix: string;
  footer_note?: string | null;
}

interface CompanyFormProps {
  company: CompanyFormData;
}

export default function CompanyForm({ company }: CompanyFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const buildDefaults = (data: CompanyFormData): CompanyFormData => ({
    ...data,
    address: data.address || '',
    email: data.email || '',
    phone: data.phone || '',
    logo_url: data.logo_url || '',
    brand_color: data.brand_color || '',
    footer_note: data.footer_note || '',
    invoice_template: data.invoice_template || 'classic',
    default_percent: data.default_percent ?? 0,
    default_tax_percent: data.default_tax_percent ?? 0,
    factoring_rate: data.factoring_rate ?? 2,
    dispatch_rate: data.dispatch_rate ?? 6,
    auto_deduction_base: data.auto_deduction_base || 'YTD_INSURANCE'
  });

  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<CompanyFormData>({
    defaultValues: buildDefaults(company)
  });

  useEffect(() => {
    reset(buildDefaults(company));
  }, [company, reset]);

  const onSubmit = async (data: CompanyFormData) => {
    setServerError('');
    setSaveMessage('');
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        const updated = await res.json().catch(() => null);
        if (updated) {
          reset(buildDefaults(updated));
        } else {
          router.refresh();
        }
        setSaveMessage('Saved.');
        return;
      }

      const payload = await res.json().catch(() => ({}));
      if (res.status === 400 && payload?.fields) {
        Object.entries(payload.fields).forEach(([path, message]) => {
          setError(path as any, { type: 'server', message: String(message) });
        });
      } else {
        setServerError(payload?.error || 'Failed to save company settings.');
      }
    } catch (error) {
      console.error(error);
      setServerError('Failed to save company settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300">Company Name</label>
          <input {...register('name', { required: true })} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
          {errors.name?.message ? <p className="text-xs text-red-400 mt-1">{errors.name.message}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Invoice Prefix</label>
          <input {...register('invoice_prefix', { required: true })} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
          {errors.invoice_prefix?.message ? <p className="text-xs text-red-400 mt-1">{errors.invoice_prefix.message}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Default Percent</label>
          <input type="number" step="0.1" {...register('default_percent', { required: true, valueAsNumber: true })} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
          {errors.default_percent?.message ? <p className="text-xs text-red-400 mt-1">{errors.default_percent.message}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Default Tax Percent</label>
          <input type="number" step="0.1" {...register('default_tax_percent', { required: true, valueAsNumber: true })} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
          {errors.default_tax_percent?.message ? <p className="text-xs text-red-400 mt-1">{errors.default_tax_percent.message}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Invoice Template</label>
          <select {...register('invoice_template')} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5">
            <option value="classic">Classic</option>
            <option value="modern">Modern</option>
            <option value="mh">MH</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Brand Color</label>
          <input {...register('brand_color')} placeholder="#2563eb" className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Email</label>
          <input type="email" {...register('email')} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Phone</label>
          <input {...register('phone')} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Address</label>
          <input {...register('address')} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300">Logo URL</label>
          <input {...register('logo_url')} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <h3 className="text-sm font-semibold text-zinc-200">Auto Deductions</h3>
        <p className="text-xs text-zinc-500 mt-1">Factoring and Dispatch are calculated automatically from the selected base.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">Factoring Percent</label>
            <input
              type="number"
              step="0.1"
              {...register('factoring_rate', { required: true, valueAsNumber: true })}
              className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
            />
            {errors.factoring_rate?.message ? <p className="text-xs text-red-400 mt-1">{errors.factoring_rate.message}</p> : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300">Dispatch Percent</label>
            <input
              type="number"
              step="0.1"
              {...register('dispatch_rate', { required: true, valueAsNumber: true })}
              className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
            />
            {errors.dispatch_rate?.message ? <p className="text-xs text-red-400 mt-1">{errors.dispatch_rate.message}</p> : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300">Calculation Base</label>
            <select
              {...register('auto_deduction_base')}
              className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5"
            >
              <option value="YTD_INSURANCE">YTD Insurance</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300">Footer Note</label>
        <textarea {...register('footer_note')} rows={3} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent" />
      </div>

      {serverError ? (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          {serverError}
        </div>
      ) : null}
      {saveMessage ? (
        <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          {saveMessage}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[#7a67e7] hover:bg-[#6b59d6] disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
