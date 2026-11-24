/**
 * Socket payload version compatibility (#538).
 *
 * Real-time events may change shape between backend releases. This module is
 * the single compatibility gate: only explicitly supported versions are
 * allowed to reach state-updating listeners. Unknown or malformed versions are
 * dropped so an older client fails safe instead of corrupting chat/presence
 * state with data it cannot interpret.
 *
 * Wire format (envelope): `{ version: number, event: string, data: unknown }`.
 * A payload with no `version` field is treated as legacy v1 for backwards
 * compatibility with servers that predate the envelope.
 */

export const SOCKET_EVENT_VERSION = 1;

export const SUPPORTED_SOCKET_EVENT_VERSIONS: readonly number[] = [1];

/** What the client does with a payload it cannot interpret. */
export const UNKNOWN_SOCKET_VERSION_POLICY = 'drop' as const;

export type SocketEventVersionStatus =
  | 'supported'
  | 'legacy'
  | 'unsupported'
  | 'invalid';

export interface SocketEventVersionDecision {
  status: SocketEventVersionStatus;
  version: number | null;
  /** True only when the payload may be passed to a state-updating listener. */
  accepted: boolean;
  /** Reason string for diagnostics; never contains payload content. */
  reason: string;
}

export interface SocketEventEnvelope {
  version?: number;
  event?: string;
  data?: unknown;
}

function isEnvelope(value: unknown): value is SocketEventEnvelope {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Classify a socket payload before any consumer handles it. The returned
 * decision contains no payload content, only version metadata and a reason.
 */
export function classifySocketEventVersion(payload: unknown): SocketEventVersionDecision {
  if (!isEnvelope(payload)) {
    return {
      status: 'invalid',
      version: null,
      accepted: false,
      reason: 'payload is not an envelope object',
    };
  }

  const { version } = payload;
  if (version === undefined) {
    return {
      status: 'legacy',
      version: null,
      accepted: true,
      reason: 'legacy payload without version treated as v1',
    };
  }

  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return {
      status: 'invalid',
      version: null,
      accepted: false,
      reason: 'version must be an integer',
    };
  }

  if (!SUPPORTED_SOCKET_EVENT_VERSIONS.includes(version)) {
    return {
      status: 'unsupported',
      version,
      accepted: false,
      reason: `event version ${version} is not supported`,
    };
  }

  return {
    status: 'supported',
    version,
    accepted: true,
    reason: `event version ${version} is supported`,
  };
}

/** True when a payload is safe to hand to a state-updating listener. */
export function isAcceptedSocketEvent(payload: unknown): boolean {
  return classifySocketEventVersion(payload).accepted;
}
