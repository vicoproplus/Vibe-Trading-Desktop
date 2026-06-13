import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createTranslator, type Translator } from "./translator";
import { zh } from "./locales/zh";
import { en } from "./locales/en";
import { DEFAULT_LANG, LANG_STORAGE_KEY, LANGS, type Lang, type NestedKeyOf, type Vars } from "./types";
import type { Translation } from "./locales/zh";

type Dictionaries = Record<Lang, Translation>;
const DICTS: Dictionaries = { zh, en };

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && (LANGS as readonly string[]).includes(stored)) return stored as Lang;
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return DEFAULT_LANG;
}

interface I18nValue extends Translator<Translation> {
  /** Loose translator for dynamically-built keys (e.g. metric labels). Bypasses compile-time key check. */
  tRaw: (path: string, vars?: Vars) => string;
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const { t } = createTranslator<Translation>(DICTS[lang]);
    const tRaw = (path: string, vars?: Vars): string => t(path as NestedKeyOf<Translation>, vars);
    const setLang = (next: Lang) => {
      setLangState(next);
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        /* ignore persistence errors */
      }
      document.documentElement.lang = next;
    };
    return { t, tRaw, lang, setLang };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within a LanguageProvider");
  return ctx;
}
