import { useCallback } from 'react';
import { dictionaries, type Locale } from './dictionary';
import { useUi } from '../state/ui';

export type { Locale };

/** Interpolates `{name}` placeholders. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}

/** Pure translation lookup, usable outside React (stores, helpers). */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const table = dictionaries[locale] ?? {};
  const value = table[key] ?? key;
  return interpolate(value, vars);
}

/**
 * React hook: `const { t, locale, setLocale } = useI18n()`.
 *
 * `t` is stable per locale so it can be used in `useMemo`/`useEffect`
 * dependencies without causing extra renders.
 */
export function useI18n() {
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
  return { t, locale, setLocale, isZh: locale === 'zh' };
}

export function localeTag(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en-US';
}

export function formatDate(locale: Locale, value: number | Date): string {
  return new Date(value).toLocaleDateString(localeTag(locale));
}

export function formatDateTime(locale: Locale, value: number | Date): string {
  return new Date(value).toLocaleString(localeTag(locale));
}

/** `3m ago` / `3 分钟前` — kept in one place so both halves of the UI agree. */
export function timeAgo(locale: Locale, timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return translate(locale, 'just now');
  if (diff < hour) return translate(locale, '{n}m ago', { n: Math.floor(diff / minute) });
  if (diff < day) return translate(locale, '{n}h ago', { n: Math.floor(diff / hour) });
  if (diff < 7 * day) return translate(locale, '{n}d ago', { n: Math.floor(diff / day) });
  return formatDate(locale, timestamp);
}
