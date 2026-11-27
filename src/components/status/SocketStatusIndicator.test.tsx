// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocketConnectionState } from '@/types/socket';
import { SocketStatusIndicator } from './SocketStatusIndicator';

const { socket } = vi.hoisted(() => ({
  socket: { current: undefined as unknown },
}));

vi.mock('@/components/providers/SocketProvider', () => ({
  useOptionalSocket: () => socket.current,
}));

function setSocket(
  connectionState: SocketConnectionState,
  reconnectAttempt = 0,
  maxReconnectAttempts = 5,
) {
  socket.current = { connectionState, reconnectAttempt, maxReconnectAttempts };
}

describe('#540 — SocketStatusIndicator retry count', () => {
  beforeEach(() => {
    setSocket('idle');
  });

  it('shows a bounded attempt count while reconnecting', () => {
    setSocket('reconnecting', 999, 5);
    const { container } = render(<SocketStatusIndicator />);

    expect(screen.getByTestId('socket-reconnect-attempt').textContent).toBe(
      'attempt 5 of 5',
    );
    expect(container.firstChild).toHaveAttribute(
      'aria-label',
      'Socket status: Reconnecting, attempt 5 of 5',
    );
  });

  it('removes the count after a successful connection', () => {
    setSocket('reconnecting', 3, 5);
    const first = render(<SocketStatusIndicator />);
    expect(screen.getByTestId('socket-reconnect-attempt')).toBeTruthy();
    first.unmount();

    setSocket('connected', 0, 5);
    render(<SocketStatusIndicator />);
    expect(screen.queryByTestId('socket-reconnect-attempt')).toBeNull();
    expect(screen.getByText('Connected')).toBeTruthy();
  });

  it('hides diagnostics when rendered outside a provider', () => {
    socket.current = undefined;
    render(<SocketStatusIndicator />);
    expect(screen.getByText('Idle')).toBeTruthy();
    expect(screen.queryByTestId('socket-reconnect-attempt')).toBeNull();
  });
});
