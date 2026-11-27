import { describe, expect, it } from 'vitest';
import {
  OFFLINE_REPLAY_DEDUP_NOTICE,
  replayIdempotencyKey,
  replaySendRequest,
} from './offlineReplayIdempotency';

const entry = {
  id: 'queued_1763980800000_ab12cd34',
  query: 'summarise my account activity',
  timestamp: '2026-11-24T10:00:00.000Z',
};

describe('offline replay idempotency (#550)', () => {
  it('returns the same request id on every retry of the same queued row', () => {
    expect(replayIdempotencyKey(entry)).toBe(replayIdempotencyKey(entry));
  });

  it('never derives the request id from the current time or randomness', () => {
    const first = replayIdempotencyKey(entry);
    const second = replayIdempotencyKey(entry);
    expect(first).toBe(second);
    expect(first).toContain(entry.id);
    expect(first).not.toMatch(/Date\.now|Math\.random/);
  });

  it('gives distinct queued rows distinct request ids', () => {
    expect(replayIdempotencyKey(entry)).not.toBe(
      replayIdempotencyKey({ ...entry, id: 'queued_other_row' }),
    );
  });

  it('keeps tempId and clientRequestId together for the chat thunk', () => {
    expect(replaySendRequest(entry)).toEqual({
      query: entry.query,
      tempId: entry.id,
      clientRequestId: replayIdempotencyKey(entry),
    });
  });

  it('works for legacy rows that have no timestamp', () => {
    expect(replayIdempotencyKey({ id: 'legacy-row', query: 'hello' })).toBe(
      'replay_legacy-row',
    );
  });

  it('does not claim a duplicate-free replay when the backend contract is unconfirmed', () => {
    expect(OFFLINE_REPLAY_DEDUP_NOTICE.toLowerCase()).toContain('may appear twice');
    expect(OFFLINE_REPLAY_DEDUP_NOTICE).not.toContain(entry.query);
  });
});
