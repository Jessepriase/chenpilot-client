import { describe, expect, it, vi } from 'vitest';
import type { AxiosError } from 'axios';

// auth.service imports api at module load; that constructor reads localStorage,
// which jsdom does not provide in this environment. These tests only need the
// pure helpers, so stub the service module the same way reauth.test.ts does.
vi.mock('../api', () => ({ default: { stepUpReauthenticate: vi.fn() } }));

import { RETRY_CONFIG } from '@/constants';
import { isRetryableError } from '@/utils/retryUtils';
import { getReauthChallenge } from '../auth.service';
import {
  PROTOCOL_ERROR,
  parseAgentEnvelope,
  protocolErrorResult,
} from '../agentEnvelope';
import {
  agentErrorMessage,
  classifyAgentError,
  decideRetry,
  isRetryableErrorKind,
} from '../agentService';

function httpError(status: number, data?: unknown, code?: string): AxiosError {
  return {
    code,
    config: { method: 'get' },
    response: { status, data },
  } as unknown as AxiosError;
}

describe('#544 — code REAUTH_REQUIRED', () => {
  it('recognizes the step-up challenge only on 401/403', () => {
    const challenge = getReauthChallenge(
      httpError(403, { code: 'REAUTH_REQUIRED', maxAgeSeconds: 300 }),
    );
    expect(challenge).toEqual({ maxAgeSeconds: 300 });
    expect(getReauthChallenge(httpError(500, { code: 'REAUTH_REQUIRED' }))).toBeNull();
  });

  it('is never replayed by the transport retry layer', () => {
    expect(isRetryableError(httpError(403, { code: 'REAUTH_REQUIRED' }))).toBe(false);
  });
});

describe('#544 — code protocol_error', () => {
  it('rejects malformed envelopes instead of treating them as success', () => {
    expect(parseAgentEnvelope({ result: { success: true } }).ok).toBe(false);
    expect(parseAgentEnvelope('plain text').ok).toBe(false);
  });

  it('returns a failed result with the documented code and safe copy', () => {
    const result = protocolErrorResult('missing result object');
    expect(result.success).toBe(false);
    expect(result.error).toContain(PROTOCOL_ERROR);
    expect(result.data).toContain('could not understand');
  });
});

describe('#544 — agent errorKind codes', () => {
  it.each([
    [httpError(408), 'timeout', true],
    [httpError(504), 'timeout', true],
    [httpError(500, undefined, 'ECONNABORTED'), 'timeout', true],
    [{ code: 'ERR_NETWORK' }, 'network', true],
    [httpError(429), 'server', true],
    [httpError(503), 'server', true],
    [httpError(401), 'unauthenticated', false],
    [httpError(403), 'unauthenticated', false],
    [httpError(400, { message: 'invalid query' }), 'invalid_query', false],
    [{ message: 'something unexpected' }, 'unknown', true],
  ] as const)('classifies %o as %s (retryable: %s)', (error, kind, retryable) => {
    expect(classifyAgentError(error)).toBe(kind);
    expect(isRetryableErrorKind(kind)).toBe(retryable);
  });

  it('gives state-changing timeouts status-check copy, never a blind retry', () => {
    expect(agentErrorMessage('timeout', true)).toMatch(/check its status/i);
    expect(agentErrorMessage('timeout', false)).toMatch(/try again/i);
    expect(agentErrorMessage('invalid_query', false)).toMatch(/rephrase/i);
    expect(agentErrorMessage('unauthenticated', false)).toMatch(/sign in again/i);
  });

  it('never auto-retries a payment POST, including on 503', () => {
    const payment = {
      config: { method: 'post', paymentOperation: true },
      response: { status: 503 },
    } as unknown as AxiosError;
    expect(isRetryableError(payment)).toBe(false);
  });
});

describe('#544 — agent operation status codes', () => {
  const status = (value: string) => ({ requestId: 'req_1', status: value });

  it.each([
    ['not_found', 'retry'],
    ['failed', 'retry'],
    ['completed', 'completed'],
    ['pending', 'pending'],
    ['unknown', 'confirm'],
  ] as const)('maps %s to %s', (value, action) => {
    expect(decideRetry(true, status(value)).action).toBe(action);
  });

  it('never resends a read-only query regardless of status', () => {
    expect(decideRetry(false, status('completed')).action).toBe('retry');
  });

  it('requires confirmation when no status endpoint answered', () => {
    expect(decideRetry(true, null).action).toBe('confirm');
  });
});

describe('#544 — transport retry allowlist', () => {
  it('documents only 408, 429 and 5xx as retryable statuses', () => {
    for (const code of [408, 429, 500, 503, 599]) {
      expect(RETRY_CONFIG.RETRYABLE_STATUS_CODES).toContain(code);
    }
    for (const code of [400, 401, 403, 404]) {
      expect(RETRY_CONFIG.RETRYABLE_STATUS_CODES).not.toContain(code);
    }
  });

  it('replays 503 on any non-payment method but other codes only when idempotent', () => {
    expect(isRetryableError(httpError(503))).toBe(true);
    const post = (status: number) =>
      ({
        config: { method: 'post' },
        response: { status },
      }) as unknown as AxiosError;
    expect(isRetryableError(post(503))).toBe(true);
    expect(isRetryableError(post(429))).toBe(false);
    expect(isRetryableError(post(401))).toBe(false);
  });
});
