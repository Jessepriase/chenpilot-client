import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ToastOverflowManager,
  getOverflowToastCount,
  MAX_VISIBLE_TOASTS,
} from './ToastOverflowManager';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn();
let mockNotifications: Array<{
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}> = [];
let mockIsOpen = false;

vi.mock('@/store', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      ui: {
        notifications: mockNotifications,
        notificationHistoryOpen: mockIsOpen,
      },
    }),
}));

const mockDismiss = vi.fn();
const mockCustom = vi.fn();
let mockToasts: Array<{ id: string; visible: boolean; message: string; type?: string }> = [];

vi.mock('react-hot-toast', () => ({
  default: {
    dismiss: (...args: unknown[]) => mockDismiss(...args),
    custom: (...args: unknown[]) => mockCustom(...args),
  },
  useToasterStore: () => ({
    toasts: mockToasts,
  }),
}));

describe('ToastOverflowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToasts = [];
    mockNotifications = [];
    mockIsOpen = false;
  });

  describe('getOverflowToastCount', () => {
    it('returns 0 when visible toasts are within the limit', () => {
      expect(getOverflowToastCount(0)).toBe(0);
      expect(getOverflowToastCount(1)).toBe(0);
      expect(getOverflowToastCount(2)).toBe(0);
    });

    it('returns overflow count exceeding limit - 1', () => {
      expect(getOverflowToastCount(3)).toBe(1);
      expect(getOverflowToastCount(5)).toBe(3);
    });
  });

  describe('Overflow handling & notification archiving', () => {
    it('archives overflowing toasts into notification history and dismisses them', () => {
      mockToasts = [
        { id: 'toast-1', visible: true, message: 'Message 1', type: 'info' },
        { id: 'toast-2', visible: true, message: 'Message 2', type: 'success' },
        { id: 'toast-3', visible: true, message: 'Message 3', type: 'error' },
      ];

      render(<ToastOverflowManager />);

      // Overflow count is 1 for 3 toasts (limit is 3, limit - 1 is 2, so 3 - 2 = 1)
      expect(mockDismiss).toHaveBeenCalledWith('toast-1');
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ui/addNotification',
          payload: expect.objectContaining({
            id: 'toast-toast-1',
            message: 'Message 1',
          }),
        }),
      );
      expect(mockCustom).toHaveBeenCalled();
    });
  });

  describe('Notification History Dialog UI', () => {
    it('renders nothing when notificationHistoryOpen is false', () => {
      mockIsOpen = false;
      const { container } = render(<ToastOverflowManager />);
      expect(container.firstChild).toBeNull();
    });

    it('renders dialog and empty message when open and no notifications', () => {
      mockIsOpen = true;
      mockNotifications = [];

      render(<ToastOverflowManager />);

      expect(screen.getByTestId('notification-history-modal')).toBeInTheDocument();
      expect(screen.getByTestId('empty-notifications')).toBeInTheDocument();
    });

    it('renders notification items with title, message, and route link', () => {
      mockIsOpen = true;
      mockNotifications = [
        {
          id: 'n1',
          type: 'success',
          category: 'transaction',
          title: 'Transaction Confirmed',
          message: 'Sent 50 XLM to Bob',
          timestamp: '2026-01-01T12:00:00Z',
          read: false,
          link: '/transactions',
        },
      ];

      render(<ToastOverflowManager />);

      expect(screen.getByText('Transaction Confirmed')).toBeInTheDocument();
      expect(screen.getByText('Sent 50 XLM to Bob')).toBeInTheDocument();
      expect(screen.getByTestId('notification-link-n1')).toHaveAttribute('href', '/transactions');
    });

    it('allows marking a notification as read', () => {
      mockIsOpen = true;
      mockNotifications = [
        {
          id: 'n1',
          type: 'info',
          category: 'system',
          title: 'System Notice',
          message: 'Maintenance scheduled',
          timestamp: '2026-01-01T12:00:00Z',
          read: false,
        },
      ];

      render(<ToastOverflowManager />);

      const markReadBtn = screen.getByTestId('mark-read-n1');
      fireEvent.click(markReadBtn);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ui/markNotificationAsRead',
        payload: 'n1',
      });
    });

    it('allows clearing all notifications', () => {
      mockIsOpen = true;
      mockNotifications = [
        {
          id: 'n1',
          type: 'info',
          category: 'system',
          title: 'Notice 1',
          message: 'Msg 1',
          timestamp: '2026-01-01T12:00:00Z',
          read: true,
        },
      ];

      render(<ToastOverflowManager />);

      const clearAllBtn = screen.getByTestId('clear-all-notifications-btn');
      fireEvent.click(clearAllBtn);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ui/clearAllNotifications',
      });
    });

    it('closes dialog when clicking close button', () => {
      mockIsOpen = true;
      render(<ToastOverflowManager />);

      const closeBtn = screen.getByTestId('close-notification-history-btn');
      fireEvent.click(closeBtn);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'ui/setNotificationHistoryOpen',
        payload: false,
      });
    });
  });
});
