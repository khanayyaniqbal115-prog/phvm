import { buildJvmArgs } from '../data/presets';
import type { InstalledMod, MinecraftInstance, ModLoader } from '../types/launcher';

const PREFIX = 'PHX1.';
const LOADERS: ModLoader[] = ['vanilla', 'fabric', 'quilt', 'forge'];

function toB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(code: string): string {
  const pad = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Turns a profile (name, Minecraft version, loader, RAM, mods) into a short text code a friend can paste. */
export function makeShareCode(inst: MinecraftInstance): string {
  const payload = {
    n: inst.name,
    v: inst.mcVersion,
    l: inst.loader,
    r: inst.ramMb,
    p: inst.fpsPresetId,
    s: [inst.resolution?.width ?? 1280, inst.resolution?.height ?? 720],
    f: inst.autoFpsMods ?? true,
    c: inst.phoenixClient ?? true,
    m: inst.mods.map((m) => [m.id, m.slug, m.title, m.version, m.category, m.enabled ? 1 : 0, m.projectType ?? 'mod']),
  };
  return PREFIX + toB64(JSON.stringify(payload));
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Reads a share code. Returns a new profile or an error text. Every value is checked: a pasted code is never trusted. */
export function readShareCode(raw: string): { ok: true; instance: MinecraftInstance } | { ok: false; error: string } {
  try {
    const code = raw.trim();
    if (!code.startsWith(PREFIX)) return { ok: false, error: 'This is not a Purrlix share code (it should start with PHX1.).' };
    const d = JSON.parse(fromB64(code.slice(PREFIX.length)));
    const mcVersion = str(d.v, 20);
    if (!/^\d+\.\d+(\.\d+)?$/.test(mcVersion)) return { ok: false, error: 'The code has no valid Minecraft version.' };
    const loader = LOADERS.includes(d.l) ? (d.l as ModLoader) : 'fabric';
    const ramMb = Math.max(1024, Math.min(32768, Number(d.r) || 3072));
    const mods: InstalledMod[] = (Array.isArray(d.m) ? d.m.slice(0, 250) : [])
      .filter((m: unknown) => Array.isArray(m) && /^[A-Za-z0-9]{6,12}$/.test(str(m[0], 12)))
      .map((m: unknown[]) => ({
        id: str(m[0], 12),
        slug: str(m[1], 80).replace(/[^A-Za-z0-9_.-]/g, ''),
        title: str(m[2], 80),
        version: str(m[3], 60),
        category: str(m[4], 30) || 'Mod',
        enabled: m[5] !== 0,
        source: 'modrinth' as const,
        projectType: (['mod', 'shader', 'modpack'] as const).find((t) => t === m[6]) ?? 'mod',
      }));
    const w = Math.max(640, Math.min(7680, Number(d.s?.[0]) || 1280));
    const h = Math.max(360, Math.min(4320, Number(d.s?.[1]) || 720));
    const instance: MinecraftInstance = {
      id: `inst-${Date.now()}`,
      name: str(d.n, 40) || `Shared ${mcVersion}`,
      mcVersion,
      loader,
      ramMb,
      fpsPresetId: (['potato', 'balanced', 'competitive', 'esports240', 'ultra_shaders', 'distant_horizons'] as const).find((p) => p === d.p) ?? 'balanced',
      autoFpsMods: d.f !== false,
      jvmArgs: buildJvmArgs(ramMb, 'G1GC', true),
      mods,
      lastPlayed: 'Never',
      playTimeMinutes: 0,
      resolution: { width: w, height: h },
      phoenixClient: d.c !== false,
    };
    return { ok: true, instance };
  } catch {
    return { ok: false, error: 'This code is damaged or incomplete. Copy it again.' };
  }
}
