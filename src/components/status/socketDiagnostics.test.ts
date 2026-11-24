import { describe, expect, it } from 'vitest';
import {
  MAX_DISPLAYED_RECONNECT_ATTEMPTS,
  boundReconnectAttempt,
  describeReconnectAttempt,
  getSocketDiagnostics,
} from './socketDiagnostics';

describe('#540 — bounded socket retry diagnostics', () => {
  it('reports a normal attempt within the configured maximum', () => {
    expect(describeReconnectAttempt(2, 5)).toBe('attempt 2 of 5');
    expect(boundReconnectAttempt(2, 5)).toBe(2);
  });

  it('never reports an attempt above the maximum or the hard cap', () => {
    expect(describeReconnectAttempt(99, 5)).toBe('attempt 5 of 5');
    expect(describeReconnectAttempt(9999, 1000)).toBe(
      `attempt ${MAX_DISPLAYED_RECONNECT_ATTEMPTS} of ${MAX_DISPLAYED_RECONNECT_ATTEMPTS}`,
    );
    expect(boundReconnectAttempt(Number.MAX_SAFE_INTEGER, 3)).toBe(3);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'hides non-positive or invalid attempt %s',
    (attempt) => {
      expect(describeReconnectAttempt(attempt, 5)).toBeNull();
      expect(boundReconnectAttempt(attempt, 5)).toBeNull();
    },
  );

  it('treats a missing or invalid maximum as a single bounded attempt', () => {
    expect(describeReconnectAttempt(3, 0)).toBe('attempt 1 of 1');
    expect(describeReconnectAttempt(3, Number.NaN)).toBe('attempt 1 of 1');
  });

  it('clears the count after a successful connection and on idle', () => {
    // A stale attempt supplied alongside `connected` must not be displayed.
    expect(getSocketDiagnostics('connected', 4, 5).detail).toBeNull();
    expect(getSocketDiagnostics('idle', 4, 5).detail).toBeNull();
    expect(getSocketDiagnostics('connected', 4, 5)).toMatchObject({
      label: 'Connected',
      tone: 'healthy',
      detail: null,
    });
  });

  it('shows the count while reconnecting and when retries are exhausted', () => {
    expect(getSocketDiagnostics('reconnecting', 2, 5)).toMatchObject({
      label: 'Reconnecting',
      tone: 'pending',
      detail: 'attempt 2 of 5',
    });
    expect(getSocketDiagnostics('exhausted', 5, 5)).toMatchObject({
      label: 'Live updates unavailable',
      tone: 'error',
      detail: 'attempt 5 of 5',
    });
  });

  it('does not carry tokens or payload data into diagnostics', () => {
    const rendered = JSON.stringify(
      [
        getSocketDiagnostics('reconnecting', 1, 5),
        getSocketDiagnostics('exhausted', 5, 5),
      ],
    );
    expect(rendered).not.toMatch(/token|bearer|secret|auth/i);
  });
});
