import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  MAX_TIMING_RECORDS,
  getRequestTimings,
  isRequestTimingEnabled,
  recordRequestTiming,
  resetRequestTimings,
  routeClassFor,
  sanitizeServiceLabel,
  statusClassFor,
} from './requestTiming';

const originalNodeEnv = process.env.NODE_ENV;
const originalFlag = process.env.NEXT_PUBLIC_REQUEST_TIMING_ENABLED;

describe('request timing diagnostics (#542)', () => {
  beforeEach(() => {
    resetRequestTimings();
    process.env.NODE_ENV = 'test';
    delete process.env.NEXT_PUBLIC_REQUEST_TIMING_ENABLED;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_REQUEST_TIMING_ENABLED;
    else process.env.NEXT_PUBLIC_REQUEST_TIMING_ENABLED = originalFlag;
    resetRequestTimings();
  });

  it('uses bounded route classes and never keeps identifiers', () => {
    expect(routeClassFor('https://api.example/auth/login')).toBe('auth');
    expect(routeClassFor('/query/stream')).toBe('agent');
    expect(routeClassFor('/payments/pay_abc123')).toBe('payment');
    expect(routeClassFor('/transactions/usr_42')).toBe('transaction');
    expect(routeClassFor('/contacts/c_99')).toBe('contact');
    expect(routeClassFor('/weird/user@example.test/secret')).toBe('other');
  });

  it('records only fixed labels and numbers', () => {
    const record = recordRequestTiming({
      service: 'ApiService',
      method: 'post',
      url: 'https://api.example/auth/login?email=ada@example.test',
      durationMs: 123.6,
      status: 429,
    });

    expect(record).toEqual({
      service: 'apiservice',
      method: 'POST',
      route: 'auth',
      durationMs: 124,
      statusClass: '4xx',
    });
    const serialized = JSON.stringify(getRequestTimings());
    expect(serialized).not.toContain('ada@example.test');
    expect(serialized).not.toContain('login?email');
  });

  it('sanitizes service labels and status classes', () => {
    expect(sanitizeServiceLabel('Agent<script>')).toBe('agentscript');
    expect(sanitizeServiceLabel('')).toBe('unknown');
    expect(statusClassFor(503)).toBe('5xx');
    expect(statusClassFor(302)).toBe('3xx');
    expect(statusClassFor(undefined)).toBe('network');
  });

  it('can be disabled in production configuration', () => {
    process.env.NODE_ENV = 'production';
    expect(isRequestTimingEnabled()).toBe(false);
    expect(recordRequestTiming({ service: 'api', method: 'get', url: '/auth', durationMs: 5 })).toBeNull();

    process.env.NEXT_PUBLIC_REQUEST_TIMING_ENABLED = 'true';
    expect(isRequestTimingEnabled()).toBe(true);
    expect(recordRequestTiming({ service: 'api', method: 'get', url: '/auth', durationMs: 5 })).not.toBeNull();

    process.env.NEXT_PUBLIC_REQUEST_TIMING_ENABLED = 'false';
    process.env.NODE_ENV = 'test';
    expect(isRequestTimingEnabled()).toBe(false);
  });

  it('ignores invalid durations and keeps the buffer bounded', () => {
    expect(recordRequestTiming({ service: 'api', method: 'get', url: '/auth', durationMs: Number.NaN })).toBeNull();
    expect(recordRequestTiming({ service: 'api', method: 'get', url: '/auth', durationMs: -1 })).toBeNull();

    for (let i = 0; i < MAX_TIMING_RECORDS + 10; i += 1) {
      recordRequestTiming({ service: 'api', method: 'get', url: '/auth', durationMs: i });
    }
    expect(getRequestTimings()).toHaveLength(MAX_TIMING_RECORDS);
  });
});
