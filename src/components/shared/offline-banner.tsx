'use client';
import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
import { t } from '@/lib/i18n/t';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** Shown when the browser reports no connection — common on school networks (MP §11). */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-white"
    >
      <WifiOff className="size-4" aria-hidden="true" />
      {t('common.offline')}
    </div>
  );
}
