import { useCallback, useEffect, useState } from 'react';

/** useState that is saved in localStorage (falls back silently when storage is blocked). */
export function useStored<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
    return initial;
  });
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key]
  );
  return [value, set];
}

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

export const THEMES = [
  { id: 'phoenix', label: 'Phoenix orange', swatch: '#F97316' },
  { id: 'ocean', label: 'Ocean blue', swatch: '#3B82F6' },
  { id: 'violet', label: 'Violet', swatch: '#8B5CF6' },
  { id: 'emerald', label: 'Emerald', swatch: '#10B981' },
  { id: 'crimson', label: 'Crimson', swatch: '#EF4444' },
  { id: 'rose', label: 'Rose', swatch: '#EC4899' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export function applyTheme(id: string) {
  const root = document.documentElement;
  if (id === 'phoenix') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', id);
}

/** Suggests RAM (MB) from installed memory and how many mods are in the profile. */
export function suggestRam(totalMemMb: number, modCount: number): number {
  const wanted = 2560 + modCount * 40;
  const cap = Math.min(8192, Math.floor(totalMemMb * 0.5));
  const value = Math.max(2048, Math.min(wanted, cap));
  return Math.round(value / 512) * 512;
}

export interface PlayLogEntry {
  t: number;
  id: string;
  m: number;
}
export const PLAYLOG_KEY = 'phoenix-playlog';

export function logPlaySession(id: string, minutes: number) {
  const list = readStored<PlayLogEntry[]>(PLAYLOG_KEY, []);
  list.push({ t: Date.now(), id, m: minutes });
  try {
    localStorage.setItem(PLAYLOG_KEY, JSON.stringify(list.slice(-500)));
  } catch {
    /* ignore */
  }
}
