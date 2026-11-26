import { describe, expect, it } from 'vitest';
import {
  getCacheAllowlistSummary,
  isCacheablePublicResource,
} from '../../public/offline-cache-policy.js';

const APP_ORIGIN = 'https://chenpilot.example';

describe('offline cache allowlist', () => {
  it('allows only same-origin GET requests for build assets and named public files', () => {
    expect(isCacheablePublicResource(`${APP_ORIGIN}/_next/static/chunks/app.js`, 'GET', APP_ORIGIN)).toBe(true);
    expect(isCacheablePublicResource(`${APP_ORIGIN}/manifest.webmanifest`, 'GET', APP_ORIGIN)).toBe(true);
    expect(isCacheablePublicResource(`${APP_ORIGIN}/chenpilot.png`, 'GET', APP_ORIGIN)).toBe(true);

    expect(isCacheablePublicResource(`${APP_ORIGIN}/_next/image?url=%2Fchenpilot.png`, 'GET', APP_ORIGIN)).toBe(false);
    expect(isCacheablePublicResource(`${APP_ORIGIN}/dashboard`, 'GET', APP_ORIGIN)).toBe(false);
    expect(isCacheablePublicResource(`${APP_ORIGIN}/manifest.webmanifest`, 'POST', APP_ORIGIN)).toBe(false);
    expect(isCacheablePublicResource('https://cdn.example/chenpilot.png', 'GET', APP_ORIGIN)).toBe(false);
  });

  it.each([
    '/api/auth/login',
    '/api/v1/auth/login',
    '/auth/session',
    '/api/protected/profile',
    '/api/v1/balance',
    '/account/user-1/balance',
    '/auth/starknet/balance',
    '/contacts',
    '/contacts/user-1',
    '/api/transactions',
    '/account/user-1/transactions',
  ])('never caches sensitive endpoint %s', (path) => {
    expect(isCacheablePublicResource(`${APP_ORIGIN}${path}`, 'GET', APP_ORIGIN)).toBe(false);
  });

  it('exposes a summary that exactly matches the enforced allowlist (#553)', () => {
    const summary = getCacheAllowlistSummary();

    for (const file of summary.publicFiles) {
      expect(isCacheablePublicResource(`${APP_ORIGIN}${file}`, 'GET', APP_ORIGIN)).toBe(true);
    }
    for (const file of ['/chenpilot.png', '/manifest.webmanifest', '/favicon.ico']) {
      expect(summary.publicFiles).toContain(file);
    }

    expect(
      isCacheablePublicResource(
        `${APP_ORIGIN}${summary.buildAssetPrefix}chunks/app.js`,
        'GET',
        APP_ORIGIN,
      ),
    ).toBe(true);
    expect(summary.buildAssetPrefix).toBe('/_next/static/');

    // The labels are plain-language views of the same patterns the worker denies.
    expect(summary.sensitiveDataLabels).toContain('wallet details');
    expect(summary.sensitiveDataLabels).toContain('balances');
    expect(summary.sensitiveDataLabels).toContain('contacts');
    expect(summary.sensitiveDataLabels).toContain('transactions');
    for (const path of ['/wallet', '/balance', '/contacts/1', '/transactions/1']) {
      expect(isCacheablePublicResource(`${APP_ORIGIN}${path}`, 'GET', APP_ORIGIN)).toBe(false);
    }
  });

  it('returns a fresh summary each call so UI cannot mutate worker policy (#553)', () => {
    const first = getCacheAllowlistSummary();
    first.publicFiles.push('/injected');
    first.sensitiveDataLabels.pop();
    const second = getCacheAllowlistSummary();

    expect(second.publicFiles).not.toContain('/injected');
    expect(second.sensitiveDataLabels).toHaveLength(first.sensitiveDataLabels.length + 1);
    expect(isCacheablePublicResource(`${APP_ORIGIN}/injected`, 'GET', APP_ORIGIN)).toBe(false);
  });
});
