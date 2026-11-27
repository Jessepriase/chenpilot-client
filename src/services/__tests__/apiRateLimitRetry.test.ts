import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRY_CONFIG } from '@/constants';
import {
  computeBackoffMs,
  incrementRetryCount,
  isRetryableError,
  retryLabel,
} from '@/utils/retryUtils';

function rateLimitError(options: {
  method: string;
  status?: number;
  retryCount?: number;
  paymentOperation?: boolean;
  retryAfter?: string;
}): AxiosError {
  return {
    config: {
      method: options.method,
      url: options.paymentOperation ? '/payments/submit' : '/auth/funding/stats',
      paymentOperation: options.paymentOperation,
      _retryCount: options.retryCount ?? 0,
    },
    response: {
      status: options.status ?? 429,
      statusText: 'Too Many Requests',
      headers: options.retryAfter ? { 'retry-after': options.retryAfter } : {},
      config: {} as never,
      data: { message: 'rate limited' },
    },
  } as unknown as AxiosError;
}

describe('rate-limit retry policy (#546)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries a 429 only on idempotent methods', () => {
    expect(isRetryableError(rateLimitError({ method: 'get' }))).toBe(true);
    expect(isRetryableError(rateLimitError({ method: 'head' }))).toBe(true);
    expect(isRetryableError(rateLimitError({ method: 'options' }))).toBe(true);
    expect(isRetryableError(rateLimitError({ method: 'post' }))).toBe(false);
    expect(isRetryableError(rateLimitError({ method: 'put' }))).toBe(false);
    expect(isRetryableError(rateLimitError({ method: 'delete' }))).toBe(false);
  });

  it('never retries wallet or payment operations even on a 503', () => {
    expect(
      isRetryableError(rateLimitError({ method: 'post', status: 503, paymentOperation: true })),
    ).toBe(false);
    expect(
      isRetryableError(rateLimitError({ method: 'get', paymentOperation: true })),
    ).toBe(false);
  });

  it('stops after the configured retry budget', () => {
    const error = rateLimitError({ method: 'get', retryCount: RETRY_CONFIG.MAX_ATTEMPTS });
    expect(isRetryableError(error)).toBe(false);
    expect(isRetryableError(rateLimitError({ method: 'get', retryCount: RETRY_CONFIG.MAX_ATTEMPTS - 1 }))).toBe(true);
  });

  it('increments the retry count on the same config', () => {
    const config = { method: 'get' };
    expect(incrementRetryCount(config)).toBe(1);
    expect(incrementRetryCount(config)).toBe(2);
    expect(config).toMatchObject({ _retryCount: 2 });
  });

  it('keeps exponential backoff within bounds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const first = computeBackoffMs(0, rateLimitError({ method: 'get' }));
    const later = computeBackoffMs(10, rateLimitError({ method: 'get' }));

    expect(first).toBe(RETRY_CONFIG.BASE_DELAY_MS);
    expect(later).toBeLessThanOrEqual(RETRY_CONFIG.MAX_DELAY_MS + RETRY_CONFIG.JITTER_MS);
  });

  it('honours Retry-After seconds but caps it at the maximum delay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(computeBackoffMs(0, rateLimitError({ method: 'get', retryAfter: '2' }))).toBe(2000);
    expect(computeBackoffMs(0, rateLimitError({ method: 'get', retryAfter: '9999' }))).toBe(
      RETRY_CONFIG.MAX_DELAY_MS,
    );
  });

  it('produces a method-and-path label without query strings', () => {
    const label = retryLabel(rateLimitError({ method: 'get' }));
    expect(label).toBe('GET /auth/funding/stats');
    expect(label).not.toContain('?');
  });

  it('does not retry non-retryable client errors', () => {
    expect(isRetryableError(rateLimitError({ method: 'get', status: 401 }))).toBe(false);
    expect(isRetryableError(rateLimitError({ method: 'get', status: 404 }))).toBe(false);
  });
});
