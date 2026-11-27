// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

import { OfflineGuidance } from './OfflineGuidance';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

function emitOnlineChange(value: boolean) {
  setOnline(value);
  fireEvent(window, new Event(value ? 'online' : 'offline'));
}

const retryButton = () => screen.getByRole('button', { name: /retry|waiting for connection/i }) as HTMLButtonElement;

describe('#553 — OfflineGuidance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnline(false);
  });

  it('starts offline with a disabled retry and the documented allowlist', () => {
    render(<OfflineGuidance next="/dashboard" />);

    expect(screen.getByRole('heading', { level: 1, name: 'You are offline' })).toBeTruthy();
    expect(retryButton().disabled).toBe(true);
    expect(screen.getByText(/retry becomes available automatically/i)).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Available without a connection' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Not available offline' })).toBeTruthy();
    expect(screen.getByText(/_next\/static\//)).toBeTruthy();
    expect(screen.getByText(/manifest\.webmanifest/)).toBeTruthy();
    expect(screen.getByText(/Cached balances \(never stored in the browser cache\)/)).toBeTruthy();
    expect(screen.getByText(/queued on this device/)).toBeTruthy();
  });

  it('does not imply that authenticated data is cached', () => {
    const { container } = render(<OfflineGuidance next="/dashboard" />);
    const text = container.textContent ?? '';

    expect(text).toMatch(/no authenticated response is stored/i);
    expect(text).not.toMatch(/balances are available offline/i);
    expect(text).not.toMatch(/cached wallet details are available/i);
  });

  it('enables retry only after the browser reports connectivity', () => {
    render(<OfflineGuidance next="/chat/123" />);
    expect(retryButton().disabled).toBe(true);

    emitOnlineChange(true);
    expect(screen.getByRole('heading', { level: 1, name: 'Back online' })).toBeTruthy();
    expect(retryButton().disabled).toBe(false);
    expect(screen.getByText(/connection restored/i)).toBeTruthy();

    fireEvent.click(retryButton());
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/chat/123');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('disables retry again if the connection drops', () => {
    render(<OfflineGuidance next="/dashboard" />);
    emitOnlineChange(true);
    expect(retryButton().disabled).toBe(false);

    emitOnlineChange(false);
    expect(retryButton().disabled).toBe(true);
    expect(screen.getByRole('heading', { level: 1, name: 'You are offline' })).toBeTruthy();
  });

  it('does not navigate when a click races an offline event', () => {
    render(<OfflineGuidance next="/dashboard" />);
    emitOnlineChange(true);

    // Simulate connectivity dropping between render and click: the state still
    // says online, but the guard must refuse to navigate.
    setOnline(false);
    fireEvent.click(retryButton());

    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('removes its connectivity listeners on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    const view = render(<OfflineGuidance next="/dashboard" />);
    const online = add.mock.calls.find(([event]) => event === 'online')?.[1];
    const offline = add.mock.calls.find(([event]) => event === 'offline')?.[1];

    expect(online).toBeDefined();
    expect(offline).toBeDefined();
    view.unmount();

    expect(remove).toHaveBeenCalledWith('online', online);
    expect(remove).toHaveBeenCalledWith('offline', offline);

    add.mockRestore();
    remove.mockRestore();
  });
});
