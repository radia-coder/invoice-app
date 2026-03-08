'use client';

import { useEffect, useState } from 'react';

type UpdateState = 'idle' | 'available' | 'downloaded';

export function UpdateToast() {
  const [state, setState] = useState<UpdateState>('idle');

  useEffect(() => {
    const ea = (window as any).electronApp;
    if (!ea) return;

    ea.onUpdateAvailable?.(() => setState('available'));
    ea.onUpdateDownloaded?.(() => setState('downloaded'));
  }, []);

  if (state === 'idle') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-2xl">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-white">
          {state === 'downloaded' ? 'Update ready to install' : 'Update available'}
        </span>
        <span className="text-xs text-zinc-400">
          {state === 'downloaded'
            ? 'Restart the app to apply the latest version.'
            : 'Downloading update in the background…'}
        </span>
      </div>
      {state === 'downloaded' && (
        <button
          onClick={() => (window as any).electronApp?.installUpdate()}
          className="ml-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-200 transition-colors"
        >
          Restart & Update
        </button>
      )}
    </div>
  );
}
