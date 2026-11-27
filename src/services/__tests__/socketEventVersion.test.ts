import { describe, expect, it } from 'vitest';
import {
  SOCKET_EVENT_VERSION,
  SUPPORTED_SOCKET_EVENT_VERSIONS,
  UNKNOWN_SOCKET_VERSION_POLICY,
  classifySocketEventVersion,
  isAcceptedSocketEvent,
} from '../socketEventVersion';

describe('socket event version compatibility (#538)', () => {
  it('publishes the supported versions and the fail-safe policy', () => {
    expect(SUPPORTED_SOCKET_EVENT_VERSIONS).toContain(SOCKET_EVENT_VERSION);
    expect(UNKNOWN_SOCKET_VERSION_POLICY).toBe('drop');
  });

  it('accepts the current supported version', () => {
    const decision = classifySocketEventVersion({
      version: SOCKET_EVENT_VERSION,
      event: 'chat:message',
      data: { id: 'm1' },
    });

    expect(decision).toMatchObject({ status: 'supported', accepted: true });
    expect(isAcceptedSocketEvent({ version: SOCKET_EVENT_VERSION })).toBe(true);
  });

  it('treats a payload with no version as legacy v1', () => {
    expect(classifySocketEventVersion({ event: 'presence', data: {} })).toMatchObject({
      status: 'legacy',
      version: null,
      accepted: true,
    });
  });

  it('drops an unknown future version instead of applying it to state', () => {
    const decision = classifySocketEventVersion({
      version: SOCKET_EVENT_VERSION + 1,
      event: 'chat:message',
      data: { id: 'from-the-future' },
    });

    expect(decision).toMatchObject({ status: 'unsupported', accepted: false });
    expect(decision.reason).not.toContain('from-the-future');
    expect(isAcceptedSocketEvent({ version: 999 })).toBe(false);
  });

  it('drops malformed versions and non-envelope payloads', () => {
    expect(classifySocketEventVersion({ version: '1' }).status).toBe('invalid');
    expect(classifySocketEventVersion({ version: 1.5 }).status).toBe('invalid');
    expect(classifySocketEventVersion('chat:message').status).toBe('invalid');
    expect(classifySocketEventVersion(null).accepted).toBe(false);
    expect(isAcceptedSocketEvent([])).toBe(false);
  });

  it('never echoes payload content in diagnostic reasons', () => {
    const secret = 'super-secret-message-body';
    const decision = classifySocketEventVersion({
      version: 42,
      event: 'chat:message',
      data: { text: secret },
    });

    expect(JSON.stringify(decision)).not.toContain(secret);
  });
});
