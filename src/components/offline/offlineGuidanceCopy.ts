import { getCacheAllowlistSummary } from '../../../public/offline-cache-policy.js';

/** Structural view of the JS policy module's exported summary. */
export type CacheAllowlistSummary = {
  buildAssetPrefix: string;
  publicFiles: string[];
  sensitiveDataLabels: string[];
};

export type OfflineGuidanceCopy = {
  title: string;
  explanation: string;
  /** Derived from the service worker allowlist, not a second hardcoded list. */
  available: string[];
  /** Derived from the same sensitive-path patterns the worker denies. */
  unavailable: string[];
  /** Local-device storage is different from an HTTP response cache. */
  onDeviceOnly: string;
};

/**
 * Build the /offline page copy from the cache policy itself (#553). Passing a
 * summary explicitly lets tests prove the copy follows the allowlist rather
 * than repeating it.
 */
export function getOfflineGuidanceCopy(
  summary: CacheAllowlistSummary = getCacheAllowlistSummary(),
): OfflineGuidanceCopy {
  return {
    title: 'You are offline',
    explanation:
      'Protected pages need a connection. Only the public shell files below can load without one, and no authenticated response is stored in the browser cache.',
    available: [
      `Previously downloaded app code and styles under ${summary.buildAssetPrefix}`,
      `Named public files: ${summary.publicFiles.join(', ')}`,
    ],
    unavailable: [
      ...summary.sensitiveDataLabels.map(
        (label) => `Cached ${label} (never stored in the browser cache)`,
      ),
      'Live chat history, live prices or fresh account data',
    ],
    onDeviceOnly:
      'Messages you queued on this device are still here, but they stay unsent until you reconnect and retry them from chat. This page does not send them.',
  };
}

const DEFAULT_RETRY_PATH = '/dashboard';

/**
 * Validate the `?next=` navigation target for the retry action (#553).
 * Only same-origin, non-protocol-relative internal paths are accepted. The
 * retry is always a GET navigation: no payment or queued mutation is replayed.
 */
export function getSafeRetryPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) {
    return DEFAULT_RETRY_PATH;
  }

  const path = raw.split('#')[0];
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(path) ||
    path === '/offline' ||
    path.startsWith('/api/')
  ) {
    return DEFAULT_RETRY_PATH;
  }

  return path;
}
