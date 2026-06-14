'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { createSession, fetchTranslations } from '@/lib/api';
import type { SupportedLanguage } from '@arrivalos/core';

export type Theme = 'light' | 'dark';

interface AppState {
  language: SupportedLanguage;
  theme: Theme;
  sessionId: string | null;
  translations: Record<string, string>;
  setLanguage: (lang: SupportedLanguage) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: (key: string) => string;
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('arrivalos-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [theme, setThemeState] = useState<Theme>('dark');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    setThemeState(getInitialTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('arrivalos-theme', theme);
  }, [theme]);

  useEffect(() => {
    createSession({ userProfile: { language } })
      .then(setSessionId)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchTranslations(language).then(setTranslations).catch(console.error);
  }, [language]);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const t = useCallback(
    (key: string) => translations[key] ?? key,
    [translations]
  );

  return (
    <AppContext.Provider value={{
      language,
      theme,
      sessionId,
      translations,
      setLanguage,
      setTheme,
      toggleTheme,
      t,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
