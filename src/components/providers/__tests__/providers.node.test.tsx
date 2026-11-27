// @vitest-environment node
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
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
import { readSavedTheme, resolveTheme } from '@/lib/theme';
import { readLanguagePreference } from '@/lib/i18n/languagePreference';

describe('Providers in server environment without window/localStorage (#305)', () => {
  it('confirms window, document, and localStorage are undefined in Node', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(typeof localStorage).toBe('undefined');
  });

  it('safely reads theme and language fallbacks without browser globals', () => {
    expect(readSavedTheme()).toBeNull();
    expect(resolveTheme(readSavedTheme(), false)).toBe('light');
    expect(readLanguagePreference()).toBe('en');
    expect(readLanguagePreference('user-123')).toBe('en');
  });

  it('renders ThemeProvider and LanguageProvider to HTML string without errors', () => {
    const store = configureStore({
      reducer: {
        ui: uiReducer,
        auth: authReducer,
      },
    });

    function TestChild() {
      const { language, direction, isRtl } = useLanguageDirection();
      return (
        <div data-testid="ssr-node-child" data-lang={language} data-dir={direction}>
          <span>Status: {isRtl ? 'RTL' : 'LTR'}</span>
        </div>
      );
    }

    const html = renderToString(
      <Provider store={store}>
        <ThemeProvider>
          <LanguageProvider>
            <TestChild />
          </LanguageProvider>
        </ThemeProvider>
      </Provider>,
    );

    expect(html).toContain('data-testid="ssr-node-child"');
    expect(html).toContain('data-lang="en"');
    expect(html).toContain('data-dir="ltr"');
    expect(html).toContain('LTR');
  });

  it('renders LanguageProvider standalone with fallback when store is missing or partial', () => {
    function StandaloneChild() {
      const { language, direction } = useLanguageDirection();
      return <span data-testid="standalone" data-lang={language} data-dir={direction}>standalone</span>;
    }

    const html = renderToString(
      <LanguageProvider>
        <StandaloneChild />
      </LanguageProvider>,
    );

    expect(html).toContain('data-testid="standalone"');
    expect(html).toContain('data-lang="en"');
    expect(html).toContain('data-dir="ltr"');
  });

  it('renders ThemeProvider standalone without store or browser globals', () => {
    const html = renderToString(
      <ThemeProvider>
        <div>Themed Content</div>
      </ThemeProvider>,
    );

    expect(html).toContain('Themed Content');
  });
});
