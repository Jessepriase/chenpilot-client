import { beforeEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import {
  SocketManager,
  type SocketConfig,
  computeReconnectDelay,
  getSocketManager,
  initializeSocketManager,
  RECONNECT_POLICY,
} from '../socketManager';

// The manager registers all lifecycle handlers on the socket itself. Keeping
// one shared mock lets tests fire handlers and inspect registrations directly.
const mockSocket = {
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
  once: vi.fn().mockReturnThis(),
  emit: vi.fn().mockReturnThis(),
  disconnect: vi.fn().mockReturnThis(),
  connect: vi.fn().mockReturnThis(),
  connected: false,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
  Socket: vi.fn(),
}));

function fire(event: string, ...args: unknown[]) {
  const calls = mockSocket.on.mock.calls.filter(([name]) => name === event);
  const handler = calls[calls.length - 1]?.[1] as
    | ((...a: unknown[]) => void)
    | undefined;
  if (!handler) throw new Error(`No handler registered for ${event}`);
  handler(...args);
}

const registrations = (event: string) =>
  mockSocket.on.mock.calls.filter(([name]) => name === event);

const config: SocketConfig = {
  url: 'http://localhost:3001',
  options: { reconnectionAttempts: 3, timeout: 10000 },
};

describe('SocketManager construction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  it('passes the supplied options through to socket.io', () => {
    new SocketManager(config).connect();
    expect(io).toHaveBeenCalledWith('http://localhost:3001', {
      reconnectionAttempts: 3,
      timeout: 10000,
    });
  });

  it('does not invent options when none were configured', () => {
    new SocketManager({ url: 'http://test.com' }).connect();
    expect(io).toHaveBeenCalledWith('http://test.com', undefined);
  });

  it('clamps caller-supplied reconnection attempts to 1…20', () => {
    const manager = new SocketManager({
      url: 'http://a',
      options: { reconnectionAttempts: Infinity },
    });
    expect(manager.getMaxReconnectAttempts()).toBe(RECONNECT_POLICY.maxAttemptsCap);

    const capped = new SocketManager({
      url: 'http://b',
      options: { reconnectionAttempts: 1000 },
    });
    expect(capped.getMaxReconnectAttempts()).toBe(RECONNECT_POLICY.maxAttemptsCap);

    const floored = new SocketManager({
      url: 'http://c',
      options: { reconnectionAttempts: 0 },
    });
    expect(floored.getMaxReconnectAttempts()).toBe(1);
  });

  it('uses the documented default of five attempts', () => {
    expect(new SocketManager({ url: 'http://a' }).getMaxReconnectAttempts()).toBe(5);
  });
});

describe('SocketManager connection state machine', () => {
  let manager: SocketManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    manager = new SocketManager(config);
  });

  it('starts idle, moves to connecting and then connected, resetting attempts', () => {
    const events: Array<[string, number]> = [];
    manager.onStateChange((state, attempt) => events.push([state, attempt]));
    expect(manager.getConnectionState()).toBe('idle');

    manager.connect();
    fire('reconnect_attempt', 2);
    fire('connect');

    expect(manager.getConnectionState()).toBe('connected');
    expect(events).toContainEqual(['connected', 0]);
  });

  it('reports bounded reconnect attempts and recovers on a later connect', () => {
    const events: Array<[string, number]> = [];
    manager.onStateChange((state, attempt) => events.push([state, attempt]));
    manager.connect();
    fire('connect');

    fire('disconnect', 'transport close');
    fire('reconnect_attempt', 1);
    fire('reconnect_attempt', 2);
    expect(manager.getConnectionState()).toBe('reconnecting');
    expect(events[events.length - 1]).toEqual(['reconnecting', 2]);

    fire('connect');
    expect(manager.getConnectionState()).toBe('connected');
    expect(events[events.length - 1]).toEqual(['connected', 0]);
  });

  it('marks the connection exhausted once the maximum is reached', () => {
    const events: Array<[string, number]> = [];
    manager.onStateChange((state, attempt) => events.push([state, attempt]));
    manager.connect();
    fire('connect');
    fire('disconnect', 'ping timeout');
    fire('reconnect_attempt', manager.getMaxReconnectAttempts());

    expect(manager.getConnectionState()).toBe('exhausted');
    expect(events[events.length - 1]).toEqual(['exhausted', 3]);
  });

  it('treats a reconnect_failed or unexpected connect_error as exhausted', () => {
    manager.connect();
    fire('reconnect_attempt', 1);
    fire('reconnect_failed');
    expect(manager.getConnectionState()).toBe('exhausted');

    manager.retry();
    fire('connect_error', new Error('refused'));
    expect(manager.getConnectionState()).toBe('exhausted');
  });

  it('does not downgrade a reconnect in progress on connect_error', () => {
    manager.connect();
    fire('reconnect_attempt', 1);
    expect(manager.getConnectionState()).toBe('reconnecting');
    fire('connect_error', new Error('still retrying'));
    expect(manager.getConnectionState()).toBe('reconnecting');
  });

  it('does not reconnect after an intentional disconnect', () => {
    manager.connect();
    fire('connect');
    fire('disconnect', 'io client disconnect');
    expect(manager.getConnectionState()).toBe('disconnected');

    fire('disconnect', 'io server disconnect');
    expect(manager.getConnectionState()).toBe('disconnected');
  });

  it('retry() resets attempts and reconnects the existing socket', () => {
    const events: Array<[string, number]> = [];
    manager.onStateChange((state, attempt) => events.push([state, attempt]));
    manager.connect();
    fire('reconnect_attempt', 3);
    fire('reconnect_failed');

    manager.retry();
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    expect(manager.getConnectionState()).toBe('connecting');
    expect(events[events.length - 1]).toEqual(['connecting', 0]);
  });

  it('retry() connects a fresh socket after a disconnect', () => {
    manager.connect();
    manager.disconnect();
    manager.retry();
    expect(io).toHaveBeenCalledTimes(2);
  });
});

describe('SocketManager listener lifecycle', () => {
  let manager: SocketManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    manager = new SocketManager(config);
  });

  it('registers each internal lifecycle handler exactly once per connect', () => {
    manager.connect();
    manager.connect();
    expect(io).toHaveBeenCalledTimes(1);

    for (const event of [
      'connect',
      'disconnect',
      'connect_error',
      'reconnect_attempt',
      'reconnect_failed',
    ]) {
      expect(registrations(event)).toHaveLength(1);
    }
  });

  it('delegates on/off/once to the socket with the same handler reference', () => {
    const socket = manager.connect();
    const handler = vi.fn();

    manager.on('chat:message', handler);
    expect(socket.on).toHaveBeenCalledWith('chat:message', handler);

    manager.once('chat:message', handler);
    expect(socket.once).toHaveBeenCalledWith('chat:message', handler);

    manager.off('chat:message', handler);
    expect(socket.off).toHaveBeenCalledWith('chat:message', handler);

    manager.off('chat:message');
    expect(socket.off).toHaveBeenCalledWith('chat:message', undefined);
  });

  it('does not throw when listeners are changed without a socket', () => {
    expect(() => manager.on('x', vi.fn())).not.toThrow();
    expect(() => manager.once('x', vi.fn())).not.toThrow();
    expect(() => manager.off('x', vi.fn())).not.toThrow();
  });

  it('notifies subscribers immediately and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = manager.onStateChange(listener);
    expect(listener).toHaveBeenCalledWith('idle', 0);

    listener.mockClear();
    manager.connect();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    manager.disconnect();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('disconnect closes the socket, clears it and reports disconnected', () => {
    const socket = manager.connect();
    manager.disconnect();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(manager.getSocket()).toBeNull();
    expect(manager.getConnectionState()).toBe('disconnected');
    expect(() => manager.disconnect()).not.toThrow();
  });
});

describe('SocketManager emit', () => {
  let manager: SocketManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    manager = new SocketManager(config);
  });

  it('emits and returns true only while connected', () => {
    expect(manager.emit('event', 1)).toBe(false);
    manager.connect();
    expect(manager.emit('event', 1)).toBe(false);

    mockSocket.connected = true;
    expect(manager.emit('event', { data: 1 })).toBe(true);
    expect(mockSocket.emit).toHaveBeenCalledWith('event', { data: 1 });
  });
});

describe('Reconnect delay policy', () => {
  it('stays within jitter bounds and never exceeds the maximum', () => {
    const { baseDelayMs, maxDelayMs, randomizationFactor } = RECONNECT_POLICY;
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const nominal = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      for (const random of [0, 0.25, 0.5, 0.99]) {
        const delay = computeReconnectDelay(attempt, {}, () => random);
        expect(delay).toBeGreaterThanOrEqual(
          Math.floor(nominal * (1 - randomizationFactor)) - 1,
        );
        expect(delay).toBeLessThanOrEqual(maxDelayMs);
      }
    }
  });

  it('returns the nominal delay without jitter', () => {
    expect(computeReconnectDelay(1, { randomizationFactor: 0 })).toBe(1000);
    expect(computeReconnectDelay(3, { randomizationFactor: 0 })).toBe(4000);
    expect(computeReconnectDelay(10, { randomizationFactor: 0 })).toBe(30000);
  });
});

describe('SocketManager singleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  it('returns null before initialization', () => {
    expect(getSocketManager()).toBeNull();
  });

  it('returns the existing instance on repeated initialization', () => {
    const first = initializeSocketManager({ url: 'http://first' });
    const second = initializeSocketManager({ url: 'http://second' });
    expect(second).toBe(first);
    expect(getSocketManager()).toBe(first);
  });
});
