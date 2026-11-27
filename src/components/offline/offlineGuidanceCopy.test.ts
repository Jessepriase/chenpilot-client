import { describe, expect, it } from 'vitest';
import { getCacheAllowlistSummary } from '../../../public/offline-cache-policy.js';
import { getOfflineGuidanceCopy, getSafeRetryPath } from './offlineGuidanceCopy';

describe('#553 — offline guidance copy', () => {
  it('derives available and unavailable lists from the cache policy', () => {
    const summary = getCacheAllowlistSummary();
    const copy = getOfflineGuidanceCopy(summary);

    expect(copy.available).toHaveLength(2);
    expect(copy.available[0]).toContain(summary.buildAssetPrefix);
    expect(copy.available[1]).toContain(summary.publicFiles[0]);
    expect(copy.available[1]).toContain(summary.publicFiles[summary.publicFiles.length - 1]);

    for (const label of summary.sensitiveDataLabels) {
      expect(copy.unavailable.some((line) => line.includes(label))).toBe(true);
    }
    expect(copy.explanation).toMatch(/no authenticated response is stored/i);
  });

  it('does not hardcode the allowlist in the UI layer', () => {
    const fixture = {
      buildAssetPrefix: '/build/assets/',
      publicFiles: ['/only-this.webmanifest'],
      sensitiveDataLabels: ['secret account data'],
    };
    const copy = getOfflineGuidanceCopy(fixture);

    expect(copy.available.join(' ')).toContain('/build/assets/');
    expect(copy.available.join(' ')).toContain('/only-this.webmanifest');
    expect(copy.available.join(' ')).not.toContain('/_next/static/');
    expect(copy.unavailable.join(' ')).toContain('secret account data');
  });

  it('distinguishes on-device queued messages from cached server data', () => {
    const copy = getOfflineGuidanceCopy();
    expect(copy.onDeviceOnly).toMatch(/queued on this device/i);
    expect(copy.onDeviceOnly).toMatch(/until you reconnect/i);
    expect(copy.onDeviceOnly).toMatch(/does not send them/i);
  });
});

describe('#553 — safe retry target', () => {
  it.each([
    [undefined, '/dashboard'],
    [null, '/dashboard'],
    ['', '/dashboard'],
    ['https://evil.example/phishing', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['/dashboard\nLocation: https://evil.example', '/dashboard'],
    ['/offline', '/dashboard'],
    ['/api/auth/login', '/dashboard'],
    ['x'.repeat(513), '/dashboard'],
  ])('rejects %s and falls back to %s', (raw, expected) => {
    expect(getSafeRetryPath(raw)).toBe(expected);
  });

  it.each([
    ['/dashboard', '/dashboard'],
    ['/chat/123', '/chat/123'],
    ['/send?contactId=c_1', '/send?contactId=c_1'],
    ['/transactions#latest', '/transactions'],
    ['/', '/'],
  ])('keeps safe internal target %s', (raw, expected) => {
    expect(getSafeRetryPath(raw)).toBe(expected);
  });
});
