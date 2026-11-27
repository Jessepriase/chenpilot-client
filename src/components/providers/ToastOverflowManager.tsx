'use client';

import React, { useEffect } from 'react';
import toast, { useToasterStore } from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  addNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  clearAllNotifications,
  clearNotification,
  setNotificationHistoryOpen,
} from '@/store/slices/uiSlice';
import { Bell, CheckCheck, Trash2, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const MAX_VISIBLE_TOASTS = 3;
export const OVERFLOW_TOAST_ID = 'toast-overflow-summary';

export function getOverflowToastCount(visibleCount: number, limit = MAX_VISIBLE_TOASTS) {
  return Math.max(0, visibleCount - (limit - 1));
}

export function ToastOverflowManager() {
  const { toasts } = useToasterStore();
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.ui.notifications) || [];
  const isOpen = useAppSelector((state) => state.ui.notificationHistoryOpen);

  useEffect(() => {
    const visible = toasts.filter((item) => item.visible && item.id !== OVERFLOW_TOAST_ID);
    const overflowCount = getOverflowToastCount(visible.length);
    if (overflowCount === 0) return;

    // Archive overflowing toasts into notification history before dismissing (#318)
    const overflowing = visible.slice(0, overflowCount);
    overflowing.forEach((item) => {
      const text = typeof item.message === 'string' ? item.message : '';
      if (text && item.id) {
        dispatch(
          addNotification({
            id: `toast-${item.id}`,
            type: item.type === 'error' ? 'error' : item.type === 'success' ? 'success' : 'info',
            category: item.id.startsWith('tx-') ? 'transaction' : item.id.startsWith('agent-') ? 'agent' : 'system',
            title: item.type === 'error' ? 'Error Notification' : item.type === 'success' ? 'Success Notification' : 'Notification',
            message: text,
            link: item.id.startsWith('tx-') ? '/transactions' : item.id.startsWith('agent-') ? '/chat' : undefined,
          }),
        );
      }
      toast.dismiss(item.id);
    });

    toast.custom(
      (item) => (
        <div
          data-testid="toast-overflow-banner"
          className="flex items-center gap-3 bg-gray-900 border border-gray-700 text-white px-4 py-2.5 rounded-xl shadow-2xl text-sm"
        >
          <span>{overflowCount} earlier notification{overflowCount === 1 ? '' : 's'} hidden</span>
          <button
            type="button"
            data-testid="view-notification-history-btn"
            onClick={() => {
              toast.dismiss(item.id);
              dispatch(setNotificationHistoryOpen(true));
            }}
            className="text-purple-400 hover:text-purple-300 font-semibold underline text-xs focus:outline-none"
          >
            View history
          </button>
          <button
            type="button"
            aria-label="Dismiss notification summary"
            onClick={() => toast.dismiss(item.id)}
            className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-white focus:outline-none focus:ring-1 focus:ring-white"
          >
            Dismiss
          </button>
        </div>
      ),
      { id: OVERFLOW_TOAST_ID, duration: 6000 },
    );
  }, [toasts, dispatch]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notification History"
      data-testid="notification-history-modal"
      className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => dispatch(setNotificationHistoryOpen(false))}
    >
      <div
        className="w-full max-w-sm sm:max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900/90">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Notification History</h2>
            <span
              data-testid="notification-count-badge"
              className="text-xs text-purple-300 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded-full font-medium"
            >
              {notifications.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  data-testid="mark-all-read-btn"
                  onClick={() => dispatch(markAllNotificationsAsRead())}
                  title="Mark all as read"
                  aria-label="Mark all as read"
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  data-testid="clear-all-notifications-btn"
                  onClick={() => dispatch(clearAllNotifications())}
                  title="Clear all notifications"
                  aria-label="Clear all notifications"
                  className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              data-testid="close-notification-history-btn"
              onClick={() => dispatch(setNotificationHistoryOpen(false))}
              aria-label="Close notification history"
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List of notifications */}
        <div
          data-testid="notification-history-list"
          className="flex-1 overflow-y-auto divide-y divide-gray-800/60 p-2 space-y-1"
        >
          {notifications.length === 0 ? (
            <div data-testid="empty-notifications" className="py-12 text-center text-sm text-gray-400">
              No earlier notifications to review.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                data-testid={`notification-item-${notif.id}`}
                className={`p-3 rounded-xl flex flex-col gap-1.5 transition-colors ${
                  notif.read ? 'bg-transparent opacity-75' : 'bg-gray-800/40 border border-gray-750'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        notif.type === 'success'
                          ? 'bg-emerald-400'
                          : notif.type === 'error'
                            ? 'bg-rose-400'
                            : 'bg-purple-400'
                      }`}
                    />
                    <span className="text-xs font-semibold text-gray-200 truncate">{notif.title}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded font-mono shrink-0">
                      {notif.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!notif.read && (
                      <button
                        type="button"
                        data-testid={`mark-read-${notif.id}`}
                        onClick={() => dispatch(markNotificationAsRead(notif.id))}
                        aria-label={`Mark ${notif.title} as read`}
                        className="text-[11px] text-purple-400 hover:text-purple-300 hover:underline px-1 py-0.5"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid={`clear-notif-${notif.id}`}
                      onClick={() => dispatch(clearNotification(notif.id))}
                      aria-label={`Delete notification ${notif.title}`}
                      className="p-1 text-gray-400 hover:text-red-400 rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-300 break-words leading-relaxed">{notif.message}</p>

                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-0.5">
                  <span>{new Date(notif.timestamp).toLocaleTimeString()}</span>
                  {notif.link && (
                    <Link
                      href={notif.link}
                      data-testid={`notification-link-${notif.id}`}
                      onClick={() => {
                        dispatch(markNotificationAsRead(notif.id));
                        dispatch(setNotificationHistoryOpen(false));
                      }}
                      className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-medium transition-colors"
                    >
                      <span>View details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
