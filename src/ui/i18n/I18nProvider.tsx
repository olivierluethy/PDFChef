import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { messages } from './messages';
import type { Locale } from './types';

const STORAGE_KEY = 'pdfchef.locale';

/** Persisted choice wins; otherwise default to English. */
function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'de') return saved;
  } catch {
    // Storage may be unavailable (private mode, blocked cookies) — fall through.
  }
  return 'en';
}

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: string, params?: TranslateParams) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    try {
      document.documentElement.lang = locale;
    } catch {
      // Non-DOM environments (tests) can ignore this.
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore persistence failures; the in-memory choice still applies.
    }
  }, []);

  const t = useCallback<Translate>(
    (key, params) => {
      const dict = messages[locale];
      let value = dict[key] ?? messages.en[key] ?? key;
      if (params) {
        for (const [name, replacement] of Object.entries(params)) {
          value = value.split(`{${name}}`).join(String(replacement));
        }
      }
      return value;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider.');
  return ctx;
}

/** Convenience hook for components that only need the translate function. */
export function useT(): Translate {
  return useI18n().t;
}
