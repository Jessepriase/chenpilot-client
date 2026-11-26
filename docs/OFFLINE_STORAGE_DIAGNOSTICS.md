# Offline Storage Diagnostics and Quota Announcements

## Purpose

When `localStorage` is full, the client removes only expired offline data and retries the write. If the write still fails, the user needs an explanation that is both accurate and safe to announce aloud (#551). `src/utils/offlineStorageDiagnostics.ts` provides that reporting layer.

## Privacy rule

Diagnostics contain **counts, approximate sizes and ages only**. The helper's input type deliberately omits `query`/`content`, and its output never includes message text, recipient addresses, account identifiers or tokens. The announcement always ends with: “Diagnostics include counts and sizes only. Message text is never included.”

## Announcement format

`describeOfflineStorageUsage(items, now)` returns:

- `itemCount` — number of persisted offline rows.
- `approximateBytes` — sum of serialized row sizes (bytes/KB).
- `oldestAgeDays` — age of the oldest row, or `null` when unknown.
- `announcement` — a screen-reader-ready sentence, e.g. “2 offline items stored (about 2.0 KB). Oldest is 4 days old. Diagnostics include counts and sizes only. Message text is never included.”

Invalid timestamps are ignored rather than reported as a misleading age; non-finite sizes contribute zero.

## Quota failures and cleanup accuracy

`quotaFailureAnnouncement(staleDataCleanupDescription(removedExpired))` builds the toast text. Cleanup is described as it actually happened:

- expired rows removed → “Expired offline items were removed and the save was retried.”
- nothing expired → “No expired offline items were available to remove.”

The client never claims “all data was deleted” when only expired rows were eligible. The quota toast uses a stable id (`offline-storage-quota`) so repeated failures do not stack duplicate announcements.

## Verification

`src/utils/offlineStorageDiagnostics.test.ts` covers counts/ages/sizes, singular and empty cases, invalid metadata, absence of private content in every diagnostic field, and accurate cleanup wording.
