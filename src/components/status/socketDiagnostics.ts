import type { SocketConnectionState } from '@/types/socket';

/**
 * Diagnostics shown for the live socket connection (#540).
 *
 * The helpers deliberately accept only the connection state and two bounded
 * numbers. No token, auth payload, socket id or error text is ever passed in,
 * so none of those can reach the UI through this path.
 */

/** Matches `RECONNECT_POLICY.maxAttemptsCap`; display never exceeds it. */
export const MAX_DISPLAYED_RECONNECT_ATTEMPTS = 20;

export type SocketDiagnostics = {
  state: SocketConnectionState;
  label: string;
  /** Bounded retry detail, or null when it must not be shown. */
  detail: string | null;
  tone: 'idle' | 'healthy' | 'pending' | 'error';
};

function boundedMaxAttempts(maxAttempts: number): number {
  if (!Number.isFinite(maxAttempts) || maxAttempts <= 0) return 1;
  return Math.min(Math.floor(maxAttempts), MAX_DISPLAYED_RECONNECT_ATTEMPTS);
}

/**
 * Clamp a reported attempt to the known maximum. Unknown/negative values and
 * a successful connection (represented by attempt 0 on `connect`) produce no
 * detail at all.
 */
export function boundReconnectAttempt(
  attempt: number,
  maxAttempts: number,
): number | null {
  if (!Number.isFinite(attempt) || attempt <= 0) return null;
  return Math.min(Math.floor(attempt), boundedMaxAttempts(maxAttempts));
}

export function describeReconnectAttempt(
  attempt: number,
  maxAttempts: number,
): string | null {
  const bounded = boundReconnectAttempt(attempt, maxAttempts);
  if (bounded === null) return null;
  return `attempt ${bounded} of ${boundedMaxAttempts(maxAttempts)}`;
}

/** A successful connection clears retry diagnostics even if a stale attempt was supplied. */
export function getSocketDiagnostics(
  state: SocketConnectionState,
  attempt = 0,
  maxAttempts = 0,
): SocketDiagnostics {
  const detail = describeReconnectAttempt(attempt, maxAttempts);

  switch (state) {
    case 'connected':
      return { state, label: 'Connected', detail: null, tone: 'healthy' };
    case 'connecting':
      return { state, label: 'Connecting', detail: null, tone: 'pending' };
    case 'reconnecting':
      return { state, label: 'Reconnecting', detail, tone: 'pending' };
    case 'exhausted':
      return {
        state,
        label: 'Live updates unavailable',
        detail,
        tone: 'error',
      };
    case 'disconnected':
      return { state, label: 'Disconnected', detail: null, tone: 'error' };
    case 'idle':
    default:
      return { state, label: 'Idle', detail: null, tone: 'idle' };
  }
}
