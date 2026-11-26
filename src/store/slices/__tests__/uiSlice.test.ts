import { describe, it, expect, beforeEach } from 'vitest';
import uiReducer, {
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotification,
  clearAllNotifications,
  setNotificationHistoryOpen,
  toggleNotificationHistory,
  setRetryStatus,
  clearRetryStatus,
  MAX_NOTIFICATION_HISTORY,
  NOTIFICATION_STORAGE_KEY,
  sanitizeNotificationForStorage,
  loadPersistedNotifications,
  savePersistedNotifications,
  clearPersistedNotifications,
  NotificationItem,
} from '../uiSlice';
import { RETRY_POLICY } from '@/utils/retryUtils';

describe('uiSlice notification history and retryStatus (#318)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('notification history actions', () => {
    const initial = uiReducer(undefined, { type: '@@INIT' });

    it('adds a notification with default read:false and links to route', () => {
      const state = uiReducer(
        initial,
        addNotification({
          id: 'notif-1',
          type: 'success',
          category: 'transaction',
          title: 'Payment Confirmed',
          message: 'Received 100 XLM',
          link: '/transactions',
          metadata: { status: 'confirmed', transactionHash: '0x123' },
        }),
      );

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0]).toMatchObject({
        id: 'notif-1',
        type: 'success',
        category: 'transaction',
        title: 'Payment Confirmed',
        message: 'Received 100 XLM',
        read: false,
        link: '/transactions',
        metadata: { status: 'confirmed', transactionHash: '0x123' },
      });
    });

    it('bounds retained notification items to MAX_NOTIFICATION_HISTORY (20 items)', () => {
      let state = initial;
      for (let i = 0; i < MAX_NOTIFICATION_HISTORY + 10; i++) {
        state = uiReducer(
          state,
          addNotification({
            id: `notif-${i}`,
            title: `Notification ${i}`,
            message: `Message ${i}`,
          }),
        );
      }

      expect(state.notifications).toHaveLength(MAX_NOTIFICATION_HISTORY);
      // Newest should be at the front
      expect(state.notifications[0].id).toBe(`notif-${MAX_NOTIFICATION_HISTORY + 9}`);
    });

    it('updates an existing notification in place if the ID matches', () => {
      let state = uiReducer(
        initial,
        addNotification({
          id: 'tx-abc',
          type: 'info',
          category: 'transaction',
          title: 'Transaction Submitted',
          message: 'Awaiting confirmation',
          link: '/transactions',
          metadata: { status: 'pending', transactionHash: 'abc' },
        }),
      );

      state = uiReducer(
        state,
        addNotification({
          id: 'tx-abc',
          type: 'success',
          category: 'transaction',
          title: 'Transaction Confirmed',
          message: 'Ledger confirmation successful',
          link: '/transactions',
          metadata: { status: 'confirmed', transactionHash: 'abc' },
        }),
      );

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].title).toBe('Transaction Confirmed');
      expect(state.notifications[0].type).toBe('success');
    });

    it('marks a single notification as read', () => {
      let state = uiReducer(
        initial,
        addNotification({ id: 'n1', title: 'T1', message: 'M1' }),
      );
      state = uiReducer(state, markNotificationAsRead('n1'));

      expect(state.notifications[0].read).toBe(true);
    });

    it('marks all notifications as read', () => {
      let state = initial;
      state = uiReducer(state, addNotification({ id: 'n1', title: 'T1', message: 'M1' }));
      state = uiReducer(state, addNotification({ id: 'n2', title: 'T2', message: 'M2' }));

      state = uiReducer(state, markAllNotificationsAsRead());
      expect(state.notifications.every((n) => n.read)).toBe(true);
    });

    it('clears a single notification', () => {
      let state = initial;
      state = uiReducer(state, addNotification({ id: 'n1', title: 'T1', message: 'M1' }));
      state = uiReducer(state, addNotification({ id: 'n2', title: 'T2', message: 'M2' }));

      state = uiReducer(state, clearNotification('n1'));
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('n2');
    });

    it('clears all notifications and wipes storage', () => {
      let state = initial;
      state = uiReducer(state, addNotification({ id: 'n1', title: 'T1', message: 'M1' }));
      state = uiReducer(state, clearAllNotifications());

      expect(state.notifications).toHaveLength(0);
      expect(localStorage.getItem(NOTIFICATION_STORAGE_KEY)).toBeNull();
    });

    it('toggles notification history open state', () => {
      let state = initial;
      expect(state.notificationHistoryOpen).toBe(false);

      state = uiReducer(state, toggleNotificationHistory());
      expect(state.notificationHistoryOpen).toBe(true);

      state = uiReducer(state, setNotificationHistoryOpen(false));
      expect(state.notificationHistoryOpen).toBe(false);
    });
  });

  describe('Non-sensitive storage sanitization & logout clearing', () => {
    it('persists only non-sensitive metadata and limits field lengths', () => {
      const item: NotificationItem = {
        id: 'n1',
        type: 'success',
        category: 'transaction',
        title: 'Safe Title',
        message: 'Safe Message',
        timestamp: '2026-01-01T12:00:00Z',
        read: false,
        link: '/transactions',
        metadata: {
          status: 'confirmed',
          transactionHash: 'hash123',
          // Unexpected or sensitive fields will not be preserved
          ...({ secretKey: 'SECRET_KEY_NEVER_PERSIST' } as unknown as object),
        },
      };

      const sanitized = sanitizeNotificationForStorage(item);
      expect(sanitized.title).toBe('Safe Title');
      expect(sanitized.metadata?.transactionHash).toBe('hash123');
      expect((sanitized.metadata as Record<string, unknown>).secretKey).toBeUndefined();
    });

    it('clears notifications on auth/logout/fulfilled and auth/clearAuth', () => {
      const initial = uiReducer(undefined, { type: '@@INIT' });
      let state = uiReducer(
        initial,
        addNotification({ id: 'n1', title: 'T1', message: 'M1' }),
      );
      state = uiReducer(state, setNotificationHistoryOpen(true));
      expect(state.notifications).toHaveLength(1);

      const loggedOutState = uiReducer(state, { type: 'auth/logout/fulfilled' });
      expect(loggedOutState.notifications).toHaveLength(0);
      expect(loggedOutState.notificationHistoryOpen).toBe(false);
      expect(localStorage.getItem(NOTIFICATION_STORAGE_KEY)).toBeNull();

      const clearedAuthState = uiReducer(state, { type: 'auth/clearAuth' });
      expect(clearedAuthState.notifications).toHaveLength(0);
      expect(clearedAuthState.notificationHistoryOpen).toBe(false);
    });
  });

  describe('retry status state', () => {
    const initial = uiReducer(undefined, { type: '@@INIT' });

    it('sets retryStatus with explicit or default maxAttempts', () => {
      const stateWithExplicit = uiReducer(
        initial,
        setRetryStatus({
          label: 'GET /profile',
          attempt: 1,
          maxAttempts: 5,
          nextRetryAt: 12345,
        }),
      );
      expect(stateWithExplicit.retryStatus?.maxAttempts).toBe(5);

      const stateWithDefault = uiReducer(
        initial,
        setRetryStatus({
          label: 'GET /profile',
          attempt: 1,
          nextRetryAt: 12345,
        }),
      );
      expect(stateWithDefault.retryStatus?.maxAttempts).toBe(RETRY_POLICY.maxAttempts);
    });

    it('clears retryStatus back to null', () => {
      const state = uiReducer(
        initial,
        setRetryStatus({
          label: 'GET /profile',
          attempt: 1,
          nextRetryAt: 12345,
        }),
      );
      const cleared = uiReducer(state, clearRetryStatus());
      expect(cleared.retryStatus).toBeNull();
    });
  });
});
