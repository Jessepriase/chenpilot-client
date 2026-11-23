'use client';

import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { getLanguageDirection } from '@/lib/i18n/i18n';
import { applyLanguage } from '@/store/slices/uiSlice';
import { readLanguagePreference } from '@/lib/i18n/languagePreference';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const language = useAppSelector((state) => state.ui.language);
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);

  // Signing in restores that user's saved language; signing out returns to the device
  // preference, so one user's choice never carries over to another user (#291)
  useEffect(() => {
    dispatch(applyLanguage(readLanguagePreference(userId)));
  }, [dispatch, userId]);

  useEffect(() => {
    const direction = getLanguageDirection(language);
    const htmlElement = document.documentElement;
    htmlElement.lang = language;
    htmlElement.dir = direction;

    // Apply RTL-specific styles for Arabic
    if (direction === 'rtl') {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, [language]);

  return <>{children}</>;
}
