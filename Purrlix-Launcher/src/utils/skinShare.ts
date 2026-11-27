// Share a skin as a short text code: "PHXS1." + base64url(JSON { n: name, m: 'classic'|'slim', d: PNG as base64 }).
import type { SkinAsset } from '../types/launcher';

const PREFIX = 'PHXS1.';
const MAX_PNG_BYTES = 120 * 1024;

const toB64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function makeSkinCode(skin: Pick<SkinAsset, 'name' | 'modelType' | 'dataUrl'>): string {
  const d = skin.dataUrl.split(',')[1] ?? '';
  return PREFIX + toB64Url(JSON.stringify({ n: skin.name.slice(0, 40), m: skin.modelType, d }));
}

export type SkinCodeResult = { ok: true; name: string; modelType: 'classic' | 'slim'; dataUrl: string } | { ok: false; error: string };

export function readSkinCode(text: string): SkinCodeResult {
  const t = text.trim();
  if (!t.startsWith(PREFIX)) return { ok: false, error: 'That is not a Purrlix skin code (it should start with PHXS1.).' };
  try {
    const o = JSON.parse(fromB64Url(t.slice(PREFIX.length))) as { n?: unknown; m?: unknown; d?: unknown };
    const d = typeof o.d === 'string' ? o.d : '';
    if (!d || d.length > (MAX_PNG_BYTES * 4) / 3 || !/^[A-Za-z0-9+/=]+$/.test(d) || !atob(d).startsWith('\x89PNG')) throw new Error('bad');
    return {
      ok: true,
      name: typeof o.n === 'string' && o.n.trim() ? o.n.trim().slice(0, 40) : 'Shared skin',
      modelType: o.m === 'slim' ? 'slim' : 'classic',
      dataUrl: `data:image/png;base64,${d}`,
    };
  } catch {
    return { ok: false, error: 'The skin code is damaged. Copy it again.' };
  }
}
