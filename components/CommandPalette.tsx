'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { List, Search } from 'lucide-react';
import useCommandPalette from '@/hooks/useCommandPalette';
import { cn } from '@/lib/utils';

interface DriverResult {
  id: number;
  name: string;
  email?: string | null;
  whatsapp_number?: string | null;
}

export default function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [drivers, setDrivers] = useState<DriverResult[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [driversError, setDriversError] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredDrivers = useMemo(() => {
    if (!normalizedQuery) return [];
    return drivers
      .filter((driver) => {
        const nameMatch = driver.name.toLowerCase().includes(normalizedQuery);
        const emailMatch = driver.email?.toLowerCase().includes(normalizedQuery);
        const phoneMatch = driver.whatsapp_number?.toLowerCase().includes(normalizedQuery);
        return nameMatch || emailMatch || phoneMatch;
      })
      .slice(0, 6);
  }, [drivers, normalizedQuery]);

  const selectableItems = useMemo(() => {
    const items: { id: number | string; section: string; driver?: DriverResult }[] = [];
    if (normalizedQuery) {
      items.push(
        ...filteredDrivers.map((item) => ({ id: item.id, section: 'drivers', driver: item }))
      );
    }
    return items;
  }, [filteredDrivers, normalizedQuery]);

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(0);
  }, [normalizedQuery, open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    setLoadingDrivers(true);
    setDriversError('');

    fetch('/api/drivers', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to load drivers.');
        }
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setDrivers(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (active) {
          console.error(error);
          setDriversError('Unable to load drivers.');
        }
      })
      .finally(() => {
        if (active) setLoadingDrivers(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleTrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTrap);
    return () => document.removeEventListener('keydown', handleTrap);
  }, [open]);

  useEffect(() => {
    if (selectableItems.length === 0) return;
    if (selectedIndex >= selectableItems.length) {
      setSelectedIndex(0);
    }
  }, [selectedIndex, selectableItems.length]);

  const applyDriverFilter = (driver: DriverResult) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('driverId', String(driver.id));
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (selectableItems.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % selectableItems.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + selectableItems.length) % selectableItems.length);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const activeItem = selectableItems[selectedIndex];
      if (activeItem?.section === 'drivers' && activeItem.driver) {
        applyDriverFilter(activeItem.driver);
        return;
      }
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-[#7a67e7] hover:bg-[#6b59d6]"
      >
        <Search className="w-4 h-4" />
        Search
      </button>
    );
  }

  let runningIndex = 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white bg-[#7a67e7] hover:bg-[#6b59d6]"
      >
        <Search className="w-4 h-4" />
        Search
      </button>

      <div
        data-auto-submit="ignore"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setOpen(false);
          }
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Universal search"
          className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#181818] shadow-[0_35px_80px_-30px_rgba(0,0,0,0.8)]"
          onKeyDown={handleKeyDown}
        >
          <div className="px-6 pt-5 pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a driver"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {normalizedQuery ? (
              <div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Drivers</span>
                  <span>{filteredDrivers.length}</span>
                </div>
                <div className="mt-3 space-y-1" role="listbox" aria-label="Drivers">
                  {loadingDrivers ? (
                    <div className="px-3 py-2 text-xs text-zinc-500">Searching drivers...</div>
                  ) : driversError ? (
                    <div className="px-3 py-2 text-xs text-red-400">{driversError}</div>
                  ) : filteredDrivers.length ? (
                    filteredDrivers.map((driver) => {
                      const currentIndex = runningIndex++;
                      const isSelected = currentIndex === selectedIndex;
                      const initials = driver.name
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase();
                      const subtitle = driver.email || driver.whatsapp_number || 'Driver';

                      return (
                        <button
                          key={driver.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          onClick={() => applyDriverFilter(driver)}
                          className={cn(
                            'w-full flex items-center justify-between gap-4 px-3 py-2 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10',
                            isSelected ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-zinc-800">
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium">{driver.name}</p>
                              <p className="text-xs text-zinc-500">{subtitle}</p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-500">
                            <List className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-xs text-zinc-500">No drivers found.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
