/**
 * Accessible offline-storage diagnostics (#551).
 *
 * These helpers report counts, ages and approximate sizes only. They never
 * accept or emit message text, addresses, queries or other private content,
 * so a quota toast can be announced on a shared screen without leaking a
 * user's offline chat.
 */

export interface OfflineStorageItem {
  id: string;
  /** Creation/expiry timestamp used only to compute an age; never displayed as content. */
  timestamp?: string;
  /** UTF-8 byte length of the serialized row, used for an approximate total. */
  sizeBytes?: number;
}

export interface OfflineStorageDiagnostic {
  itemCount: number;
  oldestAgeDays: number | null;
  approximateBytes: number;
  /** Announced by screen readers; contains no private message content. */
  announcement: string;
}

export const OFFLINE_DIAGNOSTIC_PRIVACY_NOTE =
  'Diagnostics include counts and sizes only. Message text is never included.';

const DAY_MS = 24 * 60 * 60 * 1000;

function ageInDays(timestamp: string | undefined, now: number): number | null {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.floor((now - parsed) / DAY_MS));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Summarise persisted offline rows for an accessible status announcement.
 * The free-text `query`/`content` fields are deliberately absent from the
 * input type so callers cannot accidentally leak them into diagnostics.
 */
export function describeOfflineStorageUsage(
  items: readonly OfflineStorageItem[],
  now: number = Date.now(),
): OfflineStorageDiagnostic {
  const itemCount = items.length;
  const approximateBytes = items.reduce(
    (total, item) => total + (Number.isFinite(item.sizeBytes) ? item.sizeBytes ?? 0 : 0),
    0,
  );
  const ages = items
    .map((item) => ageInDays(item.timestamp, now))
    .filter((age): age is number => age !== null);
  const oldestAgeDays = ages.length > 0 ? Math.max(...ages) : null;

  const noun = itemCount === 1 ? 'item' : 'items';
  const agePart =
    oldestAgeDays === null
      ? ''
      : ` Oldest is ${oldestAgeDays} day${oldestAgeDays === 1 ? '' : 's'} old.`;

  return {
    itemCount,
    oldestAgeDays,
    approximateBytes,
    announcement:
      `${itemCount} offline ${noun} stored (about ${formatBytes(approximateBytes)}).` +
      agePart +
      ' ' +
      OFFLINE_DIAGNOSTIC_PRIVACY_NOTE,
  };
}

/** Announcement used when a quota-exceeded write cannot be persisted. */
export function quotaFailureAnnouncement(
  cleanupDescription: string,
): string {
  return `Offline storage is full. ${cleanupDescription} ${OFFLINE_DIAGNOSTIC_PRIVACY_NOTE}`;
}

/** Accurate description of the cleanup actually performed, never "all data". */
export function staleDataCleanupDescription(removedExpired: boolean): string {
  return removedExpired
    ? 'Expired offline items were removed and the save was retried.'
    : 'No expired offline items were available to remove.';
}
