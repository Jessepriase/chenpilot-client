'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WifiOff, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getOfflineGuidanceCopy } from './offlineGuidanceCopy';

type OfflineGuidanceProps = {
  /** Validated by the server page; only internal GET paths reach this point. */
  next: string;
};

export function OfflineGuidance({ next }: OfflineGuidanceProps) {
  const router = useRouter();
  // Start offline so server and first client render agree; hydration then reads
  // the real browser state and subscribes to changes.
  const [isOnline, setIsOnline] = useState(false);
  const copy = getOfflineGuidanceCopy();

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const retry = () => {
    // Guard against a click racing an `offline` event: never navigate on a
    // stale "online" value, and only ever issue a GET to a validated path.
    if (!navigator.onLine) return;
    router.push(next);
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-white dark:bg-gray-900">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          {isOnline ? (
            <Wifi aria-hidden="true" className="h-6 w-6 text-green-600 dark:text-green-400" />
          ) : (
            <WifiOff aria-hidden="true" className="h-6 w-6 text-red-600 dark:text-red-400" />
          )}
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {isOnline ? 'Back online' : copy.title}
          </h1>
        </div>

        <p className="text-gray-600 dark:text-gray-400">{copy.explanation}</p>

        <section aria-labelledby="offline-available-heading" className="space-y-2">
          <h2 id="offline-available-heading" className="font-semibold text-gray-900 dark:text-white">
            Available without a connection
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
            {copy.available.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="offline-unavailable-heading" className="space-y-2">
          <h2 id="offline-unavailable-heading" className="font-semibold text-gray-900 dark:text-white">
            Not available offline
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
            {copy.unavailable.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <p className="text-sm text-gray-600 dark:text-gray-400">{copy.onDeviceOnly}</p>

        <div className="flex flex-col sm:flex-row items-start gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={!isOnline}
            onClick={retry}
          >
            {isOnline ? 'Retry' : 'Waiting for connection…'}
          </Button>
          <p role="status" aria-live="polite" className="text-sm text-gray-500 dark:text-gray-400">
            {isOnline
              ? 'Connection restored. Retry takes you back without resending anything.'
              : 'Retry becomes available automatically when you are back online.'}
          </p>
        </div>
      </div>
    </main>
  );
}
