import { createSlice, PayloadAction, createAction } from "@reduxjs/toolkit";
import { readSavedTheme, saveTheme } from "@/lib/theme";
import { readTranslationLanguage, saveTranslationLanguage, TranslationLanguage } from "@/lib/translation";
import { RETRY_POLICY } from "@/utils/retryUtils";

// ─── Notification Types & Storage ─────────────────────────────────────────────

export type NotificationCategory = "transaction" | "agent" | "system";

export interface NotificationItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: {
    status?: "pending" | "confirmed" | "failed" | "info";
    transactionHash?: string;
    conversationId?: string;
  };
}

export const MAX_NOTIFICATION_HISTORY = 20;
export const NOTIFICATION_STORAGE_KEY = "notification_history";

/**
 * Sanitizes notification before writing to browser storage.
 * Strictly limits length and preserves only non-sensitive metadata (#318).
 */
export function sanitizeNotificationForStorage(item: NotificationItem): NotificationItem {
  return {
    id: String(item.id).slice(0, 100),
    type: item.type || "info",
    category: item.category || "system",
    title: String(item.title || "").slice(0, 150),
    message: String(item.message || "").slice(0, 500),
    timestamp: item.timestamp || new Date().toISOString(),
    read: Boolean(item.read),
    link: item.link ? String(item.link).slice(0, 200) : undefined,
    metadata: item.metadata
      ? {
          status: item.metadata.status,
          transactionHash: item.metadata.transactionHash
            ? String(item.metadata.transactionHash).slice(0, 100)
            : undefined,
          conversationId: item.metadata.conversationId
            ? String(item.metadata.conversationId).slice(0, 100)
            : undefined,
        }
      : undefined,
  };
}

export function loadPersistedNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_NOTIFICATION_HISTORY).map(sanitizeNotificationForStorage);
  } catch (error) {
    console.warn("Failed to load notifications from storage:", error);
    return [];
  }
}

export function savePersistedNotifications(notifications: NotificationItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = notifications.slice(0, MAX_NOTIFICATION_HISTORY).map(sanitizeNotificationForStorage);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    console.warn("Failed to save notifications to storage:", error);
  }
}

export function clearPersistedNotifications(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(NOTIFICATION_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear notifications from storage:", error);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetryStatus {
  label: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: number;
}

export interface ThemeState {
  mode: "light" | "dark";
  language: "en" | "ar" | "es" | "fr";
  /** Language messages are translated into (#83); null follows `language`. */
  translationLanguage: TranslationLanguage | null;
  retryStatus: RetryStatus | null;
  sidebarOpen: boolean;
  notifications: NotificationItem[];
  notificationHistoryOpen: boolean;
  modals: Record<string, boolean>;
}

const initialState: ThemeState = {
  mode: "dark", // Default to dark mode
  language: "en", // Default to English
  translationLanguage: typeof window !== "undefined" ? readTranslationLanguage() : null,
  retryStatus: null,
  sidebarOpen: false,
  notifications: typeof window !== "undefined" ? loadPersistedNotifications() : [],
  notificationHistoryOpen: false,
  modals: {},
};

// Create action for initialization
export const initializeUI = createAction("ui/initialize", () => {
  // Get theme and language from localStorage or use defaults
  const savedTheme = typeof window !== "undefined" ? readSavedTheme() : null;

  const savedLanguage =
    typeof window !== "undefined"
      ? (localStorage.getItem("language") as "en" | "ar" | "es" | "fr" | null)
      : null;

  return {
    payload: {
      theme: savedTheme || "dark",
      language: savedLanguage || "en",
    },
  };
});

// ─── Slice ────────────────────────────────────────────────────────────────────

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === "light" ? "dark" : "light";
      // An explicit user choice is persisted (#296)
      if (typeof window !== "undefined") saveTheme(state.mode);
    },
    setTheme: (state, action: PayloadAction<"light" | "dark">) => {
      state.mode = action.payload;
      // An explicit user choice is persisted (#296)
      if (typeof window !== "undefined") saveTheme(state.mode);
    },
    /** Apply a theme derived from the system preference without persisting it (#296). */
    applyTheme: (state, action: PayloadAction<"light" | "dark">) => {
      state.mode = action.payload;
    },
    /** Set the "translate messages into" preference; null follows the app language (#83). */
    setTranslationLanguage: (state, action: PayloadAction<TranslationLanguage | null>) => {
      state.translationLanguage = action.payload;
      if (typeof window !== "undefined") saveTranslationLanguage(action.payload);
    },
    setLanguage: (state, action: PayloadAction<"en" | "ar" | "es" | "fr">) => {
      state.language = action.payload;
      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("language", state.language);
      }
    },
    /**
     * Called by the retry interceptor before each retry attempt.
     * Overwrites any previous status with the latest attempt info.
     * Defaults maxAttempts to RETRY_POLICY.maxAttempts when omitted.
     */
    setRetryStatus: (
      state,
      action: PayloadAction<Omit<RetryStatus, "maxAttempts"> & { maxAttempts?: number }>
    ) => {
      state.retryStatus = {
        ...action.payload,
        maxAttempts: action.payload.maxAttempts ?? RETRY_POLICY.maxAttempts,
      };
    },
    /**
     * Called by the retry interceptor when the request finally succeeds,
     * permanently fails, or is not eligible for retry.
     */
    clearRetryStatus: (state) => {
      state.retryStatus = null;
    },

    // ── Notification History Reducers (#318) ──

    addNotification: (
      state,
      action: PayloadAction<{
        id?: string;
        type?: "success" | "error" | "warning" | "info";
        category?: NotificationCategory;
        title: string;
        message: string;
        timestamp?: string;
        read?: boolean;
        link?: string;
        metadata?: {
          status?: "pending" | "confirmed" | "failed" | "info";
          transactionHash?: string;
          conversationId?: string;
        };
      }>
    ) => {
      const id = action.payload.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: NotificationItem = {
        id,
        type: action.payload.type || "info",
        category: action.payload.category || "system",
        title: action.payload.title,
        message: action.payload.message,
        timestamp: action.payload.timestamp || new Date().toISOString(),
        read: action.payload.read ?? false,
        link: action.payload.link,
        metadata: action.payload.metadata,
      };

      const existingIndex = state.notifications.findIndex((n) => n.id === id);
      if (existingIndex >= 0) {
        state.notifications[existingIndex] = item;
      } else {
        state.notifications.unshift(item);
      }

      if (state.notifications.length > MAX_NOTIFICATION_HISTORY) {
        state.notifications = state.notifications.slice(0, MAX_NOTIFICATION_HISTORY);
      }

      savePersistedNotifications(state.notifications);
    },
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const item = state.notifications.find((n) => n.id === action.payload);
      if (item) {
        item.read = true;
        savePersistedNotifications(state.notifications);
      }
    },
    markAllNotificationsAsRead: (state) => {
      state.notifications.forEach((n) => {
        n.read = true;
      });
      savePersistedNotifications(state.notifications);
    },
    clearNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
      savePersistedNotifications(state.notifications);
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
      clearPersistedNotifications();
    },
    setNotificationHistoryOpen: (state, action: PayloadAction<boolean>) => {
      state.notificationHistoryOpen = action.payload;
    },
    toggleNotificationHistory: (state) => {
      state.notificationHistoryOpen = !state.notificationHistoryOpen;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(initializeUI, (state, action) => {
      state.mode = action.payload.theme;
      state.language = action.payload.language;
      if (typeof window !== "undefined") {
        state.notifications = loadPersistedNotifications();
      }
    });

    // Clear notifications on logout / auth clear (#318)
    builder.addCase("auth/clearAuth", (state) => {
      state.notifications = [];
      state.notificationHistoryOpen = false;
      clearPersistedNotifications();
    });
    builder.addCase("auth/logout/fulfilled", (state) => {
      state.notifications = [];
      state.notificationHistoryOpen = false;
      clearPersistedNotifications();
    });
  },
});

export const {
  toggleTheme,
  setTheme,
  applyTheme,
  setLanguage,
  setTranslationLanguage,
  setRetryStatus,
  clearRetryStatus,
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotification,
  clearAllNotifications,
  setNotificationHistoryOpen,
  toggleNotificationHistory,
} = uiSlice.actions;

export default uiSlice.reducer;
