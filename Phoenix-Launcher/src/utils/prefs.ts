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

// ---------------------------------------------------------------- appearance (accent colour, UI size, lite mode)

export const LITE_KEY = 'phoenix-lite';
export const UI_SCALE_KEY = 'phoenix-ui-scale';
export const ACCENT_KEY = 'phoenix-accent';

function mix(hex: string, to: [number, number, number], amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const out = c.map((v, i) => Math.round(v + (to[i] - v) * amount));
  return `rgb(${out[0]} ${out[1]} ${out[2]})`;
}

/** Applies the saved accent colour, UI size and lite mode to the page. Safe to call any time. */
export function applyAppearance() {
  const root = document.documentElement;
  const lite = readStored<boolean>(LITE_KEY, false);
  root.classList.toggle('lite', lite);

  const scale = readStored<number>(UI_SCALE_KEY, 100);
  root.style.setProperty('zoom', scale === 100 ? '' : String(scale / 100));

  const accent = readStored<string>(ACCENT_KEY, '');
  const names = ['200', '300', '400', '500', '600'];
  if (/^#[0-9a-fA-F]{6}$/.test(accent)) {
    const vals = [mix(accent, [255, 255, 255], 0.6), mix(accent, [255, 255, 255], 0.4), mix(accent, [255, 255, 255], 0.2), accent, mix(accent, [0, 0, 0], 0.15)];
    names.forEach((n, i) => root.style.setProperty(`--color-orange-${n}`, vals[i]));
    root.style.setProperty('--accent-phoenix', accent);
  } else {
    names.forEach((n) => root.style.removeProperty(`--color-orange-${n}`));
    root.style.removeProperty('--accent-phoenix');
  }
}
