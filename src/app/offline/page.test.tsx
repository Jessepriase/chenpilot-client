import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { received } = vi.hoisted(() => ({
  received: { current: undefined as string | undefined },
}));

vi.mock('@/components/offline/OfflineGuidance', () => ({
  OfflineGuidance: ({ next }: { next: string }) => {
    received.current = next;
    return <div data-testid="guidance">{next}</div>;
  },
}));

import OfflinePage, { metadata } from './page';

async function renderWith(next?: string | string[]) {
  const element = await OfflinePage({ searchParams: Promise.resolve({ next }) });
  return renderToStaticMarkup(element);
}

describe('#553 — /offline page', () => {
  it('declares descriptive metadata', () => {
    expect(metadata.title).toBe('Offline');
    expect(String(metadata.description)).toMatch(/while you are offline/i);
  });

  it.each([
    [undefined, '/dashboard'],
    ['/chat/123', '/chat/123'],
    ['//evil.example', '/dashboard'],
    [['/send', '/wallet'], '/send'],
  ])('passes a validated retry target (%s)', async (raw, expected) => {
    const markup = await renderWith(raw);
    expect(received.current).toBe(expected);
    expect(markup).toContain(expected);
  });
});
