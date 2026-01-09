'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useFieldArray, Controller, type FieldErrors } from 'react-hook-form';
import { Plus, Trash, Save, Eye, EyeOff, DollarSign, X } from 'lucide-react';
import { InvoiceTemplate } from './InvoiceTemplate';
import { useRouter } from 'next/navigation';
import { LocationInput, validateLocation } from './ui/location-input';
import { normalizeState } from '@/lib/us-states';

interface Company {
  id: number;
  name: string;
  default_percent: number;
  default_tax_percent?: number | null;
  invoice_template?: string | null;
  brand_color?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  footer_note?: string | null;
}

interface DeductionType {
  id: number;
  name: string;
  company_id: number | null;
  is_default: boolean;
}

interface Driver {
  id: number;
  name: string;
  type: string;
  address?: string | null;
  email?: string | null;
  whatsapp_number?: string | null;
  whatsapp_link?: string | null;
  truck_number?: string | null;
}

interface LoadItem {
  load_ref?: string;
  vendor?: string | null;
  from_location: string;
  to_location: string;
  load_date: string;
  delivery_date?: string | null;
  amount: number | string;
}

interface DeductionItem {
  deduction_type: string;
  amount: number | string;
  note?: string;
  deduction_date?: string;
}

interface InvoiceFormData {
  company_id: string | number;
  driver_id: string | number;
  week_start: string;
  week_end: string;
  invoice_date: string;
  percent: number | string;
  tax_percent: number | string;
  status: 'draft' | 'sent' | 'paid';
  due_date?: string;
  notes?: string;
  invoice_number?: string;
  manual_net_pay?: number | null;
  loads: LoadItem[];
  deductions: DeductionItem[];
}

interface Invoice {
  id: number;
  company_id: number;
  driver_id: number;
  week_start: Date | string;
  week_end: Date | string;
  invoice_date: Date | string;
  percent: number;
  tax_percent: number;
  status: 'draft' | 'sent' | 'paid';
  due_date?: Date | string | null;
  notes?: string | null;
  invoice_number: string;
  manual_net_pay?: number | null;
  driver: Driver;
  loads: Array<{
    load_ref?: string | null;
    vendor?: string | null;
    from_location: string;
    to_location: string;
    load_date: Date | string;
    delivery_date?: Date | string | null;
    amount: number;
  }>;
  deductions: Array<{
    deduction_type: string;
    amount: number;
    note?: string | null;
    deduction_date?: Date | string | null;
  }>;
}

interface InvoiceFormProps {
    companies: Company[];
    initialData?: Invoice;
}

export default function InvoiceForm({ companies, initialData }: InvoiceFormProps) {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [creatingType, setCreatingType] = useState(false);
  const [showDeleteTypeInput, setShowDeleteTypeInput] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<number | null>(null);
  const [typeMessage, setTypeMessage] = useState('');
  const [typeError, setTypeError] = useState('');
  const [showEditNetPay, setShowEditNetPay] = useState(false);
  const [editNetPayValue, setEditNetPayValue] = useState('');
  const requiredDateMessage = 'Please fill all required dates.';

  // Format date helper
  const formatDate = (d: string | Date) => {
      if (!d) return '';
      return new Date(d).toISOString().split('T')[0];
  }

  const initialValues = useMemo<InvoiceFormData>(() => {
    if (initialData) {
      return {
        company_id: initialData.company_id.toString(),
        driver_id: initialData.driver_id.toString(),
        week_start: formatDate(initialData.week_start),
        week_end: formatDate(initialData.week_end),
        invoice_date: formatDate(initialData.invoice_date),
        percent: initialData.percent,
        tax_percent: initialData.tax_percent || 0,
        status: initialData.status || 'draft',
        due_date: formatDate(initialData.due_date || ''),
        notes: initialData.notes || '',
        invoice_number: initialData.invoice_number,
        manual_net_pay: initialData.manual_net_pay ?? null,
        loads: initialData.loads.map((l) => ({
          load_ref: l.load_ref || '',
          vendor: l.vendor || '',
          from_location: l.from_location,
          to_location: l.to_location,
          load_date: formatDate(l.load_date),
          delivery_date: formatDate(l.delivery_date || ''),
          amount: l.amount
        })),
        deductions: initialData.deductions
          .filter((d) => d.deduction_type.trim().toLowerCase() !== 'date del')
          .map((d) => ({
            deduction_type: d.deduction_type,
            amount: d.amount,
            note: d.note || '',
            deduction_date: formatDate(d.deduction_date || '')
          }))
      };
    }

    return {
      company_id: '',
      driver_id: '',
      week_start: '',
      week_end: '',
      invoice_date: new Date().toISOString().split('T')[0],
      percent: 12.0,
      tax_percent: 0,
      status: 'draft',
      due_date: '',
      notes: '',
      manual_net_pay: null,
      loads: [{ load_ref: '', vendor: '', from_location: '', to_location: '', load_date: '', delivery_date: '', amount: 0 }],
      deductions: []
    };
  }, [initialData]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    trigger,
    reset,
    formState: { errors }
  } = useForm<InvoiceFormData>({
    defaultValues: initialValues
  });

  const didInitialize = useRef(false);

  useEffect(() => {
    if (!initialData || didInitialize.current) return;
    reset(initialValues);
    didInitialize.current = true;
  }, [initialData, initialValues, reset]);

  const { fields: loadFields, append: appendLoad, remove: removeLoad } = useFieldArray({
    control,
    name: 'loads'
  });

  const { fields: deductionFields, append: appendDeduction, remove: removeDeduction } = useFieldArray({
    control,
    name: 'deductions'
  });

  const selectedCompanyId = watch('company_id');
  const selectedDriverId = watch('driver_id');
  const watchedWeekStart = watch('week_start');
  const watchedWeekEnd = watch('week_end');
  const watchedInvoiceDate = watch('invoice_date');
  const watchedDueDate = watch('due_date');
  const watchedPercent = watch('percent');
  const watchedTaxPercent = watch('tax_percent');
  const watchedLoads = watch('loads');
  const watchedDeductions = watch('deductions');
  const visibleDeductionTypes = deductionTypes.filter(
    (type) => type.name.trim().toLowerCase() !== 'date del'
  );

  // Fetch deduction types (initially and when company changes)
  const fetchDeductionTypes = async (companyId?: string | number) => {
    try {
      const url = companyId
        ? `/api/deduction-types?companyId=${companyId}`
        : '/api/deduction-types';
      const res = await fetch(url);
      const data = await res.json();
      setDeductionTypes(data);
      return data as DeductionType[];
    } catch (error) {
      console.error('Error fetching deduction types:', error);
      // Fallback to hardcoded defaults if API fails
      const fallback = [
        { id: 0, name: 'Factoring', company_id: null, is_default: true },
        { id: 1, name: 'Dispatch', company_id: null, is_default: true },
        { id: 2, name: 'Fuel', company_id: null, is_default: true },
        { id: 3, name: 'Maintenance', company_id: null, is_default: true },
        { id: 4, name: 'Tolls/Violations', company_id: null, is_default: true },
        { id: 5, name: 'Insurance', company_id: null, is_default: true },
        { id: 6, name: 'Trailer', company_id: null, is_default: true },
        { id: 7, name: 'Payback', company_id: null, is_default: true },
        { id: 8, name: 'ELD', company_id: null, is_default: true },
        { id: 9, name: 'Camera', company_id: null, is_default: true },
        { id: 10, name: 'Advanced', company_id: null, is_default: true },
        { id: 11, name: 'Other', company_id: null, is_default: true },
      ];
      setDeductionTypes(fallback);
      return fallback;
    }
  };

  // Fetch drivers and deduction types when company changes
  useEffect(() => {
    if (selectedCompanyId) {
      fetch(`/api/drivers?companyId=${selectedCompanyId}`)
        .then(res => res.json())
        .then(data => {
            setDrivers(data);

            // Set default percent if not editing
            if (!initialData) {
                const comp = companies.find(c => c.id === parseInt(selectedCompanyId.toString()));
                if (comp) {
                  setValue('percent', comp.default_percent);
                  if (comp.default_tax_percent !== undefined && comp.default_tax_percent !== null) {
                    setValue('tax_percent', comp.default_tax_percent);
                  }
                }
            }
        });
      // Fetch deduction types for this company
      fetchDeductionTypes(selectedCompanyId);
    } else {
      setDrivers([]);
      // Still fetch global deduction types
      fetchDeductionTypes();
    }
  }, [selectedCompanyId, companies, setValue, initialData]);

  // Initial fetch for deduction types
  useEffect(() => {
    fetchDeductionTypes();
  }, []);

  // Create new deduction type
  const handleCreateNewType = async () => {
    if (!newTypeName.trim()) {
      setTypeError('Please enter a type name.');
      return;
    }
    if (!selectedCompanyId) {
      setTypeError('Select a company before adding a deduction type.');
      return;
    }

    setTypeError('');
    setTypeMessage('');
    setCreatingType(true);
    try {
      const res = await fetch('/api/deduction-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTypeName.trim(),
          companyId: Number(selectedCompanyId)
        })
      });

      if (res.ok) {
        const newType = await res.json();
        await fetchDeductionTypes(selectedCompanyId);
        setNewTypeName('');
        setShowNewTypeInput(false);
        // Append a new deduction with this type
        appendDeduction({ deduction_type: newType.name, amount: 0, note: '', deduction_date: '' });
        setTypeMessage('Deduction type added.');
      } else if (res.status === 409) {
        setTypeError('This deduction type already exists.');
      } else {
        const data = await res.json().catch(() => ({}));
        setTypeError(data?.error || 'Failed to create deduction type.');
      }
    } catch (error) {
      console.error('Error creating deduction type:', error);
      setTypeError('Failed to create deduction type.');
    } finally {
      setCreatingType(false);
    }
  };

  const handleDeleteDeductionType = async (type: DeductionType) => {
    if (type.is_default) return;
    const confirmed = window.confirm(
      `Remove "${type.name}"? This will only remove it from the list. Existing invoices stay unchanged.`
    );
    if (!confirmed) return;

    setDeletingTypeId(type.id);
    setTypeError('');
    setTypeMessage('');
    try {
      const res = await fetch(`/api/deduction-types/${type.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTypeError(data?.error || 'Failed to delete deduction type.');
        return;
      }

      const nextTypes = await fetchDeductionTypes(selectedCompanyId);
      const fallbackType =
        nextTypes.find((dt: DeductionType) => dt.name === 'Other')?.name || nextTypes[0]?.name || 'Other';
      watchedDeductions.forEach((deduction, index) => {
        if (deduction.deduction_type === type.name) {
          setValue(`deductions.${index}.deduction_type`, fallbackType);
        }
      });

      setTypeMessage('Deduction type removed.');
    } catch (error) {
      console.error('Error deleting deduction type:', error);
      setTypeError('Failed to delete deduction type.');
    } finally {
      setDeletingTypeId(null);
    }
  };

  // Helper to normalize location: "Columbus, Ohio" -> "Columbus, OH"
  const normalizeLocation = (location: string): string => {
    if (!location) return location;
    const commaIndex = location.lastIndexOf(',');
    if (commaIndex === -1) {
      const normalized = normalizeState(location);
      return normalized || location;
    }
    const city = location.slice(0, commaIndex).trim();
    const statePart = location.slice(commaIndex + 1).trim();
    const normalized = normalizeState(statePart);
    if (!normalized) return location;
    return city ? `${city}, ${normalized}` : normalized;
  };

  const onSubmit = async (data: InvoiceFormData) => {
    setSubmitting(true);
    clearErrors();
    try {
      // Normalize locations to ensure "City, ST" format
      const transformedLoads = data.loads.map((l: LoadItem) => ({
        load_ref: l.load_ref,
        vendor: l.vendor || null,
        from_location: normalizeLocation(l.from_location),
        to_location: normalizeLocation(l.to_location),
        load_date: l.load_date,
        delivery_date: l.delivery_date || null,
        amount: parseFloat(l.amount.toString())
      }));

      const payload = {
        ...data,
        company_id: parseInt(data.company_id.toString()),
        driver_id: parseInt(data.driver_id.toString()),
        percent: parseFloat(data.percent.toString()),
        tax_percent: parseFloat(data.tax_percent.toString()),
        currency: 'USD',
        manual_net_pay: data.manual_net_pay !== null && data.manual_net_pay !== undefined ? data.manual_net_pay : null,
        loads: transformedLoads,
        deductions: data.deductions
          .filter((d: DeductionItem) => d.deduction_type.trim().toLowerCase() !== 'date del')
          .map((d: DeductionItem) => ({
            deduction_type: d.deduction_type,
            amount: parseFloat(d.amount.toString()),
            note: d.note || null,
            deduction_date: d.deduction_date || null
          }))
      };

      const url = initialData ? `/api/invoices/${initialData.id}` : '/api/invoices';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && data?.fields) {
          Object.entries(data.fields).forEach(([path, message]) => {
            setError(path as any, { type: 'server', message: String(message) });
          });
        } else {
          alert(data?.error || 'Failed to save invoice');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Error saving invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const hasDateErrors = (formErrors: FieldErrors<InvoiceFormData>) => {
    if (formErrors.week_start || formErrors.week_end || formErrors.invoice_date || formErrors.due_date) {
      return true;
    }
    if (Array.isArray(formErrors.loads)) {
      return formErrors.loads.some((load) => load?.load_date);
    }
    return false;
  };

  const onInvalid = (formErrors: FieldErrors<InvoiceFormData>) => {
    if (hasDateErrors(formErrors)) {
      setError('root', { type: 'manual', message: requiredDateMessage });
    }
  };

  const ensureRequiredDates = async () => {
    clearErrors('root');
    const dateValid = await trigger(['week_start', 'week_end', 'invoice_date', 'due_date']);
    let loadDateValid = true;
    watchedLoads.forEach((load, index) => {
      if (!load?.load_date) {
        loadDateValid = false;
        setError(`loads.${index}.load_date`, { type: 'manual', message: 'Date PU is required' });
      }
    });

    if (!dateValid || !loadDateValid) {
      setError('root', { type: 'manual', message: requiredDateMessage });
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!errors.root?.message) return;
    if (!watchedWeekStart || !watchedWeekEnd || !watchedInvoiceDate || !watchedDueDate) return;
    if (watchedLoads.some((load) => !load?.load_date)) return;
    if (errors.week_start || errors.week_end || errors.invoice_date || errors.due_date) return;
    clearErrors('root');
  }, [
    clearErrors,
    errors.root?.message,
    errors.week_start,
    errors.week_end,
    errors.invoice_date,
    errors.due_date,
    watchedWeekStart,
    watchedWeekEnd,
    watchedInvoiceDate,
    watchedDueDate,
    watchedLoads
  ]);

  // Preview Data Construction
  const getPreviewData = () => {
    const comp = companies.find(c => c.id === parseInt(selectedCompanyId.toString()));
    const drv = drivers.find(d => d.id === parseInt(selectedDriverId.toString())) || (initialData?.driver);
    
    if (!comp || !drv) return null;

    return {
      invoice_number: initialData?.invoice_number || 'PREVIEW',
      invoice_date: watch('invoice_date'),
      week_start: watch('week_start'),
      week_end: watch('week_end'),
      company: comp,
      driver: drv,
      loads: watchedLoads.map((l: LoadItem) => ({
          from_location: l.from_location,
          to_location: l.to_location,
          load_date: l.load_date,
          amount: Number(l.amount),
          load_ref: l.load_ref
      })),
      deductions: watchedDeductions.map((d: DeductionItem) => ({
          deduction_type: d.deduction_type,
          amount: Number(d.amount),
          note: d.note
      })),
      percent: Number(watchedPercent),
      tax_percent: Number(watchedTaxPercent),
      manual_net_pay: watch('manual_net_pay'),
      status: watch('status'),
      due_date: watch('due_date'),
      currency: 'USD',
      notes: watch('notes')
    };
  };

  const previewData = getPreviewData();

  if (previewMode && previewData) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-zinc-800 border border-zinc-700 p-4 rounded-xl">
            <h2 className="text-lg font-bold text-white">Preview Mode</h2>
            <div className="space-x-2">
                <button
                    onClick={() => setPreviewMode(false)}
                    className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
                >
                    <EyeOff className="inline w-4 h-4 mr-1" /> Edit
                </button>
                <button
                    onClick={handleSubmit(onSubmit, onInvalid)}
                    disabled={submitting}
                    className="px-4 py-2 bg-[#7a67e7] text-white rounded-lg hover:bg-[#6b59d6] transition-colors"
                >
                    {submitting ? 'Saving...' : 'Save Invoice'}
                </button>
            </div>
        </div>
        <div className="border border-zinc-700 rounded-xl shadow-lg overflow-hidden">
            <InvoiceTemplate data={previewData} />
        </div>
      </div>
    );
  }

  // Calculate totals for Edit View Summary
  const totalLoad = watchedLoads?.reduce((sum: number, l: LoadItem) => sum + (Number(l.amount) || 0), 0) || 0;
  const percentValue = Number(watchedPercent) || 0;
  const percentAmount = totalLoad * (percentValue / 100);
  const taxPercentValue = Number(watchedTaxPercent) || 0;
  const taxAmount = totalLoad * (taxPercentValue / 100);
  const fixedDed = watchedDeductions?.reduce((sum: number, d: DeductionItem) => sum + (Number(d.amount) || 0), 0) || 0;

  // Get selected driver to determine calculation type
  const selectedDriver = drivers.find(d => d.id === parseInt(selectedDriverId?.toString() || '0')) || initialData?.driver;
  const isCompanyDriver = selectedDriver?.type === 'Company Driver';

  // Company Driver: percent is driver pay, net = driverPay - fixedDeductions
  // Owner-Operator: percent is company cut, net = gross - companyCut - fixedDeductions
  const calculatedNet = isCompanyDriver
    ? percentAmount - fixedDed - taxAmount
    : totalLoad - percentAmount - fixedDed - taxAmount;

  // Use manual net pay if set, otherwise use calculated
  const manualNetPay = watch('manual_net_pay');
  const net = manualNetPay !== null && manualNetPay !== undefined ? manualNetPay : calculatedNet;

  const formatMoney = (amount: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    } catch {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-8 bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
      {errors.root?.message ? (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          {errors.root.message}
        </div>
      ) : null}
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-zinc-300">Company</label>
                <select {...register('company_id', { required: true })} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2.5">
                    <option value="">Select Company</option>
                    {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                {errors.company_id?.message ? <p className="text-xs text-red-400 mt-1">{errors.company_id.message}</p> : null}
            </div>
            <div>
                <label className="block text-sm font-medium text-zinc-300">Driver</label>
                <select {...register('driver_id', { required: true })} disabled={!selectedCompanyId} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2.5 disabled:bg-zinc-900 disabled:text-zinc-500">
                    <option value="">Select Driver</option>
                    {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}{d.truck_number ? ` — ${d.truck_number}` : ''}</option>
                    ))}
                </select>
                {errors.driver_id?.message ? <p className="text-xs text-red-400 mt-1">{errors.driver_id.message}</p> : null}
            </div>
        </div>
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-zinc-300">Week Start *</label>
                    <input
                        type="date"
                        {...register('week_start', { required: 'Week Start is required' })}
                        className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2.5"
                    />
                    {errors.week_start?.message ? <p className="text-xs text-red-400 mt-1">{errors.week_start.message}</p> : null}
                </div>
                <div>
                    <label className="block text-sm font-medium text-zinc-300">Week End *</label>
                    <input
                        type="date"
                        {...register('week_end', {
                            required: 'Week End is required',
                            validate: (value) => {
                                if (!watchedWeekStart || !value) return true;
                                const start = new Date(watchedWeekStart);
                                const end = new Date(value);
                                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                                    return 'Week End must be a valid date';
                                }
                                return end >= start || 'Week End must be on or after Week Start';
                            }
                        })}
                        className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2.5"
                    />
                    {errors.week_end?.message ? <p className="text-xs text-red-400 mt-1">{errors.week_end.message}</p> : null}
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-zinc-300">Invoice Date *</label>
                <input
                    type="date"
                    {...register('invoice_date', { required: 'Invoice Date is required' })}
                    className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2.5"
                />
                {errors.invoice_date?.message ? <p className="text-xs text-red-400 mt-1">{errors.invoice_date.message}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-zinc-300">Status</label>
                    <select {...register('status', { required: true })} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5">
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-zinc-300">Due Date *</label>
                    <input
                        type="date"
                        {...register('due_date', { required: 'Due Date is required' })}
                        className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border p-2.5"
                    />
                    {errors.due_date?.message ? <p className="text-xs text-red-400 mt-1">{errors.due_date.message}</p> : null}
                </div>
            </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium leading-6 text-white">Loads</h3>
            <button type="button" onClick={() => appendLoad({ load_ref: '', vendor: '', from_location: '', to_location: '', load_date: '', delivery_date: '', amount: 0 })} className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-[#7a67e7] bg-[#7a67e7]/10 hover:bg-[#7a67e7]/20 transition-colors">
                <Plus className="w-4 h-4 mr-1" /> Add Load
            </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-800">
                <thead className="bg-zinc-800/50">
                    <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Date PU *</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Date DEL</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Load</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase">From (ST)</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase">To (ST)</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Amount</th>
                        <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                    {loadFields.map((field, index) => (
                        <tr key={field.id} className="hover:bg-zinc-800/30">
                            <td className="px-2 py-2">
                                <input type="hidden" {...register(`loads.${index}.vendor` as const)} />
                                <input
                                    type="date"
                                    {...register(`loads.${index}.load_date` as const, { required: 'Date PU is required' })}
                                    className="block w-full border-zinc-700 bg-zinc-800 text-white rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2 sm:text-sm"
                                />
                                {errors.loads?.[index]?.load_date?.message ? (
                                    <p className="mt-1 text-xs text-red-400">{errors.loads[index]?.load_date?.message}</p>
                                ) : null}
                            </td>
                            <td className="px-2 py-2">
                                <input
                                    type="date"
                                    {...register(`loads.${index}.delivery_date` as const)}
                                    className="block w-full border-zinc-700 bg-zinc-800 text-white rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2 sm:text-sm"
                                />
                            </td>
                            <td className="px-2 py-2"><input type="text" {...register(`loads.${index}.load_ref` as const)} className="block w-full border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2 sm:text-sm" placeholder="Load #" /></td>
                            <td className="px-2 py-2">
                                <Controller
                                    name={`loads.${index}.from_location` as const}
                                    control={control}
                                    rules={{
                                        required: 'Required',
                                        validate: (v) => validateLocation(v).valid || validateLocation(v).error
                                    }}
                                    render={({ field }) => (
                                        <LocationInput
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            placeholder="State or ST"
                                            error={!!errors.loads?.[index]?.from_location}
                                        />
                                    )}
                                />
                                {errors.loads?.[index]?.from_location && <p className="mt-1 text-xs text-red-400">{errors.loads[index]?.from_location?.message}</p>}
                            </td>
                            <td className="px-2 py-2">
                                <Controller
                                    name={`loads.${index}.to_location` as const}
                                    control={control}
                                    rules={{
                                        required: 'Required',
                                        validate: (v) => validateLocation(v).valid || validateLocation(v).error
                                    }}
                                    render={({ field }) => (
                                        <LocationInput
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            placeholder="State or ST"
                                            error={!!errors.loads?.[index]?.to_location}
                                        />
                                    )}
                                />
                                {errors.loads?.[index]?.to_location && <p className="mt-1 text-xs text-red-400">{errors.loads[index]?.to_location?.message}</p>}
                            </td>
                            <td className="px-2 py-2"><input type="number" step="0.01" {...register(`loads.${index}.amount` as const, { required: true })} className="block w-full border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2 sm:text-sm" placeholder="0.00" /></td>
                            <td className="px-2 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeLoad(index)}
                                  title="Remove load"
                                  className="inline-flex items-center justify-center rounded-md bg-[#301b1f] p-2 text-red-300 hover:bg-[#3a2428] transition-colors"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-zinc-800 pt-6">
          {/* Deductions */}
          <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-white">Fixed Deductions</h3>
                <div className="flex gap-2">
                    <button type="button" onClick={() => appendDeduction({ deduction_type: visibleDeductionTypes[0]?.name || 'Other', amount: 0, note: '', deduction_date: '' })} className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-[#7a67e7] bg-[#7a67e7]/10 hover:bg-[#7a67e7]/20 transition-colors">
                        <Plus className="w-4 h-4 mr-1" /> Add
                    </button>
                    <button type="button" onClick={() => setShowNewTypeInput(true)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-[#7a67e7] bg-[#7a67e7]/10 hover:bg-[#7a67e7]/20 transition-colors">
                        <Plus className="w-4 h-4 mr-1" /> New Type
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteTypeInput(true)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-red-300 bg-[#301b1f] hover:bg-[#3a2428] transition-colors"
                      title="Delete custom type"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* New Type Input */}
            {showNewTypeInput && (
              <div className="mb-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="e.g., Parking, Lumpar, Late Fee"
                    className="flex-1 border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 rounded-lg shadow-sm border p-2.5 sm:text-sm focus:ring-2 focus:ring-[#7a67e7]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateNewType();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateNewType}
                    disabled={creatingType}
                    className="px-4 py-2.5 bg-[#7a67e7] text-white rounded-lg text-sm hover:bg-[#6b59d6] disabled:opacity-50 transition-colors"
                  >
                    {creatingType ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewTypeInput(false);
                      setNewTypeName('');
                    }}
                    className="px-4 py-2.5 bg-zinc-600 text-white rounded-lg text-sm hover:bg-zinc-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-400">Enter a new deduction type name (e.g., EZPass Fee, Lumpar)</p>
                {typeError ? <p className="mt-2 text-xs text-red-400">{typeError}</p> : null}
              </div>
            )}

            {showDeleteTypeInput ? (
              <div className="mb-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                <div className="flex gap-2 items-center">
                  <select
                    className="flex-1 border-zinc-600 bg-zinc-700 text-white rounded-lg shadow-sm border p-2.5 sm:text-sm focus:ring-2 focus:ring-red-500"
                    defaultValue=""
                    onChange={(event) => {
                      const selected = deductionTypes.find((type) => type.id === Number(event.target.value));
                      if (selected) {
                        handleDeleteDeductionType(selected);
                        event.currentTarget.value = '';
                      }
                    }}
                  >
                    <option value="" disabled>Select custom type to delete</option>
                    {deductionTypes.filter((type) => !type.is_default).map((type) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowDeleteTypeInput(false)}
                    className="px-4 py-2.5 bg-zinc-600 text-white rounded-lg text-sm hover:bg-zinc-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
                {typeMessage ? <p className="mt-2 text-xs text-emerald-400">{typeMessage}</p> : null}
                {typeError ? <p className="mt-2 text-xs text-red-400">{typeError}</p> : null}
                {deletingTypeId ? <p className="mt-2 text-xs text-zinc-400">Removing...</p> : null}
              </div>
            ) : null}

            <div className="space-y-2">
                {deductionFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                        <select {...register(`deductions.${index}.deduction_type` as const)} className="block w-[140px] flex-none border-zinc-700 bg-zinc-800 text-white rounded-lg shadow-sm border p-2.5 sm:text-sm">
                            {visibleDeductionTypes.length > 0 ? (
                              visibleDeductionTypes.map(dt => (
                                <option key={dt.id} value={dt.name}>{dt.name}</option>
                              ))
                            ) : (
                              <>
                                <option value="Fuel">Fuel</option>
                                <option value="Toll">Toll</option>
                                <option value="ELD">ELD</option>
                                <option value="Insurance">Insurance</option>
                                <option value="Other">Other</option>
                              </>
                            )}
                        </select>
                        <input type="number" step="0.01" {...register(`deductions.${index}.amount` as const)} placeholder="Amount" className="block w-[100px] flex-none border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 rounded-lg shadow-sm border p-2.5 sm:text-sm" />
                        <input type="text" {...register(`deductions.${index}.note` as const)} placeholder="Note" className="block flex-1 min-w-[80px] border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 rounded-lg shadow-sm border p-2.5 sm:text-sm" />
                        <button
                          type="button"
                          onClick={() => removeDeduction(index)}
                          className="mt-0.5 inline-flex items-center justify-center rounded-md bg-[#301b1f] p-2 text-red-300 hover:bg-[#3a2428] transition-colors"
                          title="Remove deduction"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
          </div>

          {/* Totals & Notes */}
          <div className="bg-zinc-800/50 border border-zinc-700 p-5 rounded-xl space-y-4">
            <h3 className="text-lg font-medium text-white">Summary</h3>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-zinc-400">Total Loads</span>
                    <span className="font-medium text-white">{formatMoney(totalLoad)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-zinc-400 flex items-center gap-2">
                        {isCompanyDriver ? 'Driver Pay' : 'Company Cut'}
                        <div className="flex items-center">
                            <input type="number" step="0.1" {...register('percent', { required: true })} className="w-16 border-zinc-600 bg-zinc-700 text-white rounded-lg shadow-sm border p-1.5 text-xs" />
                            <span className="ml-1 text-zinc-400">%</span>
                        </div>
                    </span>
                    <span className={isCompanyDriver ? "text-emerald-400" : "text-red-400"}>
                        {isCompanyDriver ? '' : '-'}{formatMoney(percentAmount)}
                    </span>
                </div>
                {isCompanyDriver && (
                    <div className="flex justify-between text-zinc-500 text-xs italic">
                        <span>(Driver receives {percentValue}% of gross)</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-zinc-400">Fixed Deductions</span>
                    <span className="text-red-400">-{formatMoney(fixedDed)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-zinc-400 flex items-center gap-2">
                        Tax
                        <div className="flex items-center">
                            <input type="number" step="0.1" {...register('tax_percent')} className="w-16 border-zinc-600 bg-zinc-700 text-white rounded-lg shadow-sm border p-1.5 text-xs" />
                            <span className="ml-1 text-zinc-400">%</span>
                        </div>
                    </span>
                    <span className="text-red-400">-{formatMoney(taxAmount)}</span>
                </div>
                <div className="border-t border-zinc-600 pt-3 flex justify-between text-lg font-bold">
                    <span className="text-white">Net Pay</span>
                    <span className="text-emerald-400">
                      {formatMoney(net)}
                      {manualNetPay !== null && manualNetPay !== undefined && (
                        <span className="text-xs text-zinc-400 ml-2">(Manual)</span>
                      )}
                    </span>
                </div>
            </div>

            <div className="mt-4">
                <label className="block text-sm font-medium text-zinc-300">Notes / Footer</label>
                <textarea {...register('notes')} rows={3} className="mt-1 block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2.5 sm:text-sm" />
            </div>
          </div>
      </div>

      <div className="flex justify-end space-x-4 border-t border-zinc-800 pt-6">
        <button
            type="button"
            onClick={() => {
              setEditNetPayValue(manualNetPay !== null && manualNetPay !== undefined ? manualNetPay.toString() : '');
              setShowEditNetPay(true);
            }}
            className="inline-flex items-center px-5 py-2.5 border border-zinc-700 shadow-sm text-sm font-medium rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
            <DollarSign className="w-4 h-4 mr-2" /> Edit Net Pay
        </button>
        <button
            type="button"
            onClick={async () => {
                if (!selectedCompanyId || !selectedDriverId) {
                    alert('Please select company and driver first');
                    return;
                }
                const validDates = await ensureRequiredDates();
                if (!validDates) {
                    return;
                }
                setPreviewMode(true);
            }}
            className="inline-flex items-center px-5 py-2.5 border border-zinc-700 shadow-sm text-sm font-medium rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
            <Eye className="w-4 h-4 mr-2" /> Preview
        </button>
        <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-[#7a67e7] hover:bg-[#6b59d6] transition-colors"
        >
            <Save className="w-4 h-4 mr-2" /> {submitting ? 'Saving...' : 'Save Invoice'}
        </button>
      </div>

      {/* Edit Net Pay Modal */}
      {showEditNetPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Edit Net Pay</h3>
              <button
                type="button"
                onClick={() => setShowEditNetPay(false)}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Calculated Net Pay: <span className="text-emerald-400">{formatMoney(calculatedNet)}</span>
                </label>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Manual Net Pay Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editNetPayValue}
                  onChange={(e) => setEditNetPayValue(e.target.value)}
                  placeholder="Enter net pay amount"
                  className="block w-full rounded-lg border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm focus:ring-2 focus:ring-[#7a67e7] border p-2.5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const value = parseFloat(editNetPayValue);
                      if (editNetPayValue === '' || isNaN(value)) {
                        setValue('manual_net_pay', null);
                      } else if (value < 0) {
                        alert('Net pay cannot be negative');
                        return;
                      } else {
                        setValue('manual_net_pay', value);
                      }
                      setShowEditNetPay(false);
                    }
                  }}
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Leave empty to use calculated net pay
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                {manualNetPay !== null && manualNetPay !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      setValue('manual_net_pay', null);
                      setEditNetPayValue('');
                      setShowEditNetPay(false);
                    }}
                    className="px-4 py-2 border border-zinc-700 text-sm font-medium rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    Reset to Calculated
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowEditNetPay(false)}
                  className="px-4 py-2 border border-zinc-700 text-sm font-medium rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const value = parseFloat(editNetPayValue);
                    if (editNetPayValue === '' || isNaN(value)) {
                      setValue('manual_net_pay', null);
                    } else if (value < 0) {
                      alert('Net pay cannot be negative');
                      return;
                    } else {
                      setValue('manual_net_pay', value);
                    }
                    setShowEditNetPay(false);
                  }}
                  className="px-4 py-2 bg-[#7a67e7] text-white rounded-lg text-sm hover:bg-[#6b59d6] transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
