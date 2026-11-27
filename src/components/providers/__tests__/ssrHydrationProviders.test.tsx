import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, Root } from 'react-dom/client';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from '@/store/slices/uiSlice';
import authReducer from '@/store/slices/authSlice';

vi.mock('@/store', () => ({
  useAppDispatch: () => {
    try {
      return useDispatch();
    } catch {
      return vi.fn();
    }
  },
  useAppSelector: (selector: (state: unknown) => unknown) => {
    try {
      return useSelector(selector);
    } catch {
      return selector({ ui: { mode: 'light', language: 'en' }, auth: { user: null } });
    }
  },
}));

import { ThemeProvider } from '../ThemeProvider';
import { LanguageProvider, useLanguageDirection } from '../LanguageProvider';
import { readSavedTheme, saveTheme } from '@/lib/theme';
import {
  readLanguagePreference,
  saveLanguagePreference,
  readActiveUserId,
} from '@/lib/i18n/languagePreference';

function ConsumerComponent() {
  const { language, direction, isRtl } = useLanguageDirection();
  return (
    <div data-testid="consumer" data-language={language} data-direction={direction}>
      <span data-testid="lang-text">{language}</span>
      <span data-testid="rtl-text">{isRtl ? 'RTL' : 'LTR'}</span>
    </div>
  );
}

const createStore = (theme: 'light' | 'dark' = 'dark', language: 'en' | 'ar' | 'es' | 'fr' = 'en', userId: string | null = null) =>
  configureStore({
    reducer: {
      ui: uiReducer,
      auth: authReducer,
    },
    preloadedState: {
      ui: {
        mode: theme,
        language,
        translationLanguage: null,
        retryStatus: null,
        sidebarOpen: false,
        notifications: [],
        modals: {},
      },
      auth: {
        isAuthenticated: !!userId,
        user: userId
          ? ({
              id: userId,
              email: 'test@example.com',
              name: 'Test User',
              address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
              publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
              isDeployed: true,
              isFunded: true,
              tokenType: 'XLM',
              authProvider: 'email',
              isEmailVerified: true,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            } as import('@/types').User)
          : null,
        token: userId ? 'mock-token' : null,
        isLoading: false,
        error: null,
      },
    },
  });

describe('Providers SSR and Hydration (#305)', () => {
  let container: HTMLDivElement;
  let activeRoot: Root | null = null;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    document.documentElement.className = '';
    delete document.documentElement.dataset.direction;

    container = document.createElement('div');
    document.body.appendChild(container);

    consoleErrorSpy = vi.spyOn(console, 'error');
    consoleWarnSpy = vi.spyOn(console, 'warn');
  });

  afterEach(async () => {
    if (activeRoot) {
      await act(async () => {
        activeRoot?.unmount();
      });
      activeRoot = null;
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  const assertNoHydrationWarnings = () => {
    const errorCalls = consoleErrorSpy.mock.calls.map((c) => String(c[0]));
    const warnCalls = consoleWarnSpy.mock.calls.map((c) => String(c[0]));
    const allMessages = [...errorCalls, ...warnCalls].join('\n');

    expect(allMessages).not.toMatch(/hydration/i);
    expect(allMessages).not.toMatch(/did not match/i);
    expect(allMessages).not.toMatch(/server.*?client/i);
  };

  it('hydrates default preferences without hydration warnings', async () => {
    const store = createStore('dark', 'en');

    const app = (
      <Provider store={store}>
        <ThemeProvider>
          <LanguageProvider>
            <ConsumerComponent />
          </LanguageProvider>
        </ThemeProvider>
      </Provider>
    );

    // 1. Server render
    const serverHtml = renderToString(app);
    expect(serverHtml).toContain('data-testid="consumer"');
    expect(serverHtml).toContain('en');

    // 2. Set server HTML into container
    container.innerHTML = serverHtml;

    // 3. Client hydrate
    await act(async () => {
      activeRoot = hydrateRoot(container, app);
    });

    assertNoHydrationWarnings();
    expect(container.querySelector('[data-testid="lang-text"]')?.textContent).toBe('en');
    expect(container.querySelector('[data-testid="rtl-text"]')?.textContent).toBe('LTR');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('hydrates saved Arabic (RTL) preference without hydration warnings and applies RTL styles', async () => {
    localStorage.setItem('language', 'ar');
    localStorage.setItem('theme', 'dark');

    const store = createStore('dark', 'ar');

    const app = (
      <Provider store={store}>
        <ThemeProvider>
          <LanguageProvider>
            <ConsumerComponent />
          </LanguageProvider>
        </ThemeProvider>
      </Provider>
    );

    const serverHtml = renderToString(app);
    expect(serverHtml).toContain('ar');
    expect(serverHtml).toContain('RTL');

    container.innerHTML = serverHtml;

    await act(async () => {
      activeRoot = hydrateRoot(container, app);
    });

    assertNoHydrationWarnings();
    expect(container.querySelector('[data-testid="lang-text"]')?.textContent).toBe('ar');
    expect(container.querySelector('[data-testid="rtl-text"]')?.textContent).toBe('RTL');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.classList.contains('rtl')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('hydrates saved per-user language preference without hydration warnings', async () => {
    const userId = 'user-test-789';
    localStorage.setItem('auth_token', 'jwt-token');
    localStorage.setItem('user_data', JSON.stringify({ id: userId }));
    localStorage.setItem('language_by_user', JSON.stringify({ [userId]: 'fr' }));

    const store = createStore('light', 'fr', userId);

    const app = (
      <Provider store={store}>
        <ThemeProvider>
          <LanguageProvider>
            <ConsumerComponent />
          </LanguageProvider>
        </ThemeProvider>
      </Provider>
    );

    const serverHtml = renderToString(app);
    container.innerHTML = serverHtml;

    await act(async () => {
      activeRoot = hydrateRoot(container, app);
    });

    assertNoHydrationWarnings();
    expect(container.querySelector('[data-testid="lang-text"]')?.textContent).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('handles unavailable window.matchMedia gracefully', async () => {
    // Simulate environment where matchMedia is undefined
    const originalMatchMedia = window.matchMedia;
    // @ts-expect-error simulating unavailable API
    delete window.matchMedia;

    const store = createStore('light', 'en');

    const app = (
      <Provider store={store}>
        <ThemeProvider>
          <LanguageProvider>
            <ConsumerComponent />
          </LanguageProvider>
        </ThemeProvider>
      </Provider>
    );

    const serverHtml = renderToString(app);
    container.innerHTML = serverHtml;

    await act(async () => {
      activeRoot = hydrateRoot(container, app);
    });

    assertNoHydrationWarnings();
    // Restored without throwing
    window.matchMedia = originalMatchMedia;
  });

  it('handles window.matchMedia returning null or missing event listeners', async () => {
    const originalMatchMedia = window.matchMedia;

    // Simulate matchMedia returning null
    window.matchMedia = (() => null) as unknown as typeof window.matchMedia;

    const store = createStore('dark', 'en');
    const app = (
      <Provider store={store}>
        <ThemeProvider>
          <LanguageProvider>
            <ConsumerComponent />
          </LanguageProvider>
        </ThemeProvider>
      </Provider>
    );

    const serverHtml = renderToString(app);
    container.innerHTML = serverHtml;

    await act(async () => {
      activeRoot = hydrateRoot(container, app);
    });

    assertNoHydrationWarnings();

    // Simulate legacy matchMedia with addListener / removeListener
    const addListenerMock = vi.fn();
    const removeListenerMock = vi.fn();
    window.matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: addListenerMock,
      removeListener: removeListenerMock,
    })) as unknown as typeof window.matchMedia;

    const legacyContainer = document.createElement('div');
    document.body.appendChild(legacyContainer);
    const legacyApp = (
      <Provider store={store}>
        <ThemeProvider>
          <div>Legacy matchMedia</div>
        </ThemeProvider>
      </Provider>
    );

    legacyContainer.innerHTML = renderToString(legacyApp);

    let legacyRoot: Root | null = null;
    await act(async () => {
      legacyRoot = hydrateRoot(legacyContainer, legacyApp);
    });

    expect(addListenerMock).toHaveBeenCalled();
    await act(async () => {
      legacyRoot?.unmount();
    });
    expect(removeListenerMock).toHaveBeenCalled();

    legacyContainer.remove();
    window.matchMedia = originalMatchMedia;
  });

  it('handles storage access denials and security errors without throwing', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });

    // Helpers survive security error
    expect(readSavedTheme()).toBeNull();
    expect(readLanguagePreference()).toBe('en');
    expect(readActiveUserId()).toBeNull();
    expect(() => saveTheme('dark')).not.toThrow();
    expect(() => saveLanguagePreference('es')).not.toThrow();

    const store = createStore('dark', 'en');
    const app = (
      <Provider store={store}>
        <ThemeProvider>
          <LanguageProvider>
            <ConsumerComponent />
          </LanguageProvider>
        </ThemeProvider>
      </Provider>
    );

    const serverHtml = renderToString(app);
    container.innerHTML = serverHtml;

    await act(async () => {
      activeRoot = hydrateRoot(container, app);
    });

    assertNoHydrationWarnings();
    expect(container.querySelector('[data-testid="lang-text"]')?.textContent).toBe('en');
  });

  it('handles undefined localStorage safely during render and storage reads', () => {
    const originalLocalStorage = window.localStorage;
    try {
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      expect(readSavedTheme()).toBeNull();
      expect(readLanguagePreference()).toBe('en');
      expect(() => saveTheme('dark')).not.toThrow();
      expect(() => saveLanguagePreference('ar')).not.toThrow();

      const store = createStore('dark', 'en');
      const html = renderToString(
        <Provider store={store}>
          <ThemeProvider>
            <LanguageProvider>
              <ConsumerComponent />
            </LanguageProvider>
          </ThemeProvider>
        </Provider>,
      );

      expect(html).toContain('data-testid="consumer"');
    } finally {
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      });
    }
  });
});
