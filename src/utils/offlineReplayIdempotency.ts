/**
 * Stable idempotency keys for replaying persisted messages (#550).
 *
 * The offline queue is replayed after a reconnect. Each retry must present the
 * same `clientRequestId` to the backend so a retried request is deduplicated
 * instead of creating a second agent answer. Keys are derived only from stable
 * fields of the queued row — never from `Date.now()` or randomness.
 *
 * Contract limitation: the client can only *offer* a stable key. The backend
 * must actually honour `clientRequestId` for the guarantee to hold. Until that
 * is confirmed, callers surface `OFFLINE_REPLAY_DEDUP_NOTICE` instead of
 * claiming a duplicate-free replay.
 */

export interface ReplayableQueueEntry {
  id: string;
  query: string;
  timestamp?: string;
}

export const OFFLINE_REPLAY_DEDUP_NOTICE =
  'Offline messages were retried with a stable request id. If your backend does not deduplicate by request id, some replies may appear twice.';

export const OFFLINE_REPLAY_KEY_PREFIX = 'replay';

/**
 * Build a deterministic request id for a queued row. Repeated calls for the
 * same row always return the same value; two different rows never collide.
 */
export function replayIdempotencyKey(entry: ReplayableQueueEntry): string {
  return `${OFFLINE_REPLAY_KEY_PREFIX}_${entry.id}`;
}

/**
 * Payload for the chat thunk during replay. Keeping `tempId` and
 * `clientRequestId` together means the optimistic row is reconciled by id and
 * the backend sees the same key across retries.
 */
export function replaySendRequest(entry: ReplayableQueueEntry): {
  query: string;
  tempId: string;
  clientRequestId: string;
} {
  return {
    query: entry.query,
    tempId: entry.id,
    clientRequestId: replayIdempotencyKey(entry),
  };
}
