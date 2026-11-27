import { describe, expect, it } from 'vitest';
import {
  OFFLINE_DIAGNOSTIC_PRIVACY_NOTE,
  describeOfflineStorageUsage,
  quotaFailureAnnouncement,
  staleDataCleanupDescription,
  type OfflineStorageItem,
} from './offlineStorageDiagnostics';

const NOW = Date.parse('2026-11-24T12:00:00.000Z');

const items: OfflineStorageItem[] = [
  { id: 'one', timestamp: '2026-11-24T10:00:00.000Z', sizeBytes: 512 },
  { id: 'two', timestamp: '2026-11-20T10:00:00.000Z', sizeBytes: 1536 },
];

describe('accessible offline storage diagnostics (#551)', () => {
  it('reports counts, approximate size and oldest age', () => {
    const result = describeOfflineStorageUsage(items, NOW);

    expect(result.itemCount).toBe(2);
    expect(result.approximateBytes).toBe(2048);
    expect(result.oldestAgeDays).toBe(4);
    expect(result.announcement).toContain('2 offline items');
    expect(result.announcement).toContain('2.0 KB');
    expect(result.announcement).toContain('Oldest is 4 days old');
  });

  it('uses singular wording for one item and handles an empty queue', () => {
    expect(describeOfflineStorageUsage([items[0]], NOW).announcement).toContain(
      '1 offline item',
    );
    const empty = describeOfflineStorageUsage([], NOW);
    expect(empty.itemCount).toBe(0);
    expect(empty.oldestAgeDays).toBeNull();
    expect(empty.announcement).toContain('0 offline items');
    expect(empty.announcement).not.toContain('Oldest');
  });

  it('never includes private content in any diagnostic field', () => {
    const serialized = JSON.stringify(describeOfflineStorageUsage(items, NOW));
    expect(serialized).not.toContain('query');
    expect(serialized).not.toContain('message');
    expect(serialized).not.toContain('secret');
    expect(describeOfflineStorageUsage(items, NOW).announcement).toContain(
      OFFLINE_DIAGNOSTIC_PRIVACY_NOTE,
    );
  });

  it('ignores invalid timestamps and non-finite sizes', () => {
    const result = describeOfflineStorageUsage(
      [{ id: 'bad', timestamp: 'not-a-date', sizeBytes: Number.NaN }],
      NOW,
    );
    expect(result.oldestAgeDays).toBeNull();
    expect(result.approximateBytes).toBe(0);
  });

  it('announces quota failures with an accurate cleanup description', () => {
    expect(quotaFailureAnnouncement(staleDataCleanupDescription(true))).toContain(
      'Expired offline items were removed',
    );
    const noneAvailable = quotaFailureAnnouncement(staleDataCleanupDescription(false));
    expect(noneAvailable).toContain('No expired offline items were available');
    expect(noneAvailable).not.toContain('all data was deleted');
  });
});
