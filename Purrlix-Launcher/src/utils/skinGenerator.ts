import type { SkinAsset } from '../types/launcher';

// ---------------------------------------------------------------------------
// Original themed skins painted pixel by pixel with the correct Minecraft 64x64 UV layout.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

interface SkinTheme {
  id: string;
  name: string;
  modelType: 'classic' | 'slim';
  skin: string;
  hair: string;
  eye: string;
  armor: string; // main outfit colour
  trim: string; // stripes, boots, bracers
  glow: string; // emblem and highlights
  showCape: boolean;
  showSword: boolean;
}

// No ready-made skins any more: one plain starting skin that can be painted, recolored or replaced by an upload / a username import.
const THEMES: SkinTheme[] = [
  { id: 'skin-default', name: 'My skin', modelType: 'classic', skin: '#C99A7C', hair: '#4A3220', eye: '#FFFFFF', armor: '#2F5F9E', trim: '#3A3F8A', glow: '#8B5CF6', showCape: false, showSword: false },
];

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function shade(rgb: RGB, f: number): RGB {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * f))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * f))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * f))),
  ];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Deterministic noise so the texture looks hand-shaded, not flat
function noise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Faces of a Minecraft box texture. ox/oy = texture origin, w/h/d = box size.
function boxFaces(ox: number, oy: number, w: number, h: number, d: number) {
  return {
    top: { x: ox + d, y: oy, w, h: d },
    bottom: { x: ox + d + w, y: oy, w, h: d },
    right: { x: ox, y: oy + d, w: d, h },
    front: { x: ox + d, y: oy + d, w, h },
    left: { x: ox + d + w, y: oy + d, w: d, h },
    back: { x: ox + d + w + d, y: oy + d, w, h },
  };
}

type Painter = (u: number, v: number, x: number, y: number) => RGB | null;

function paintRect(ctx: CanvasRenderingContext2D, r: Rect, seed: number, fn: Painter) {
  for (let j = 0; j < r.h; j++) {
    for (let i = 0; i < r.w; i++) {
      const c = fn(i, j, r.w, r.h);
      if (!c) continue;
      const n = (noise(r.x + i, r.y + j, seed) - 0.5) * 0.08;
      // top-lit gradient + a thin light rim on the left edge gives the pixels depth
      const depth = 0.95 - (j / Math.max(1, r.h - 1)) * 0.2 + (i === 0 && r.w > 3 ? 0.04 : 0);
      const k = shade(c, depth + n);
      ctx.fillStyle = `rgb(${k[0]},${k[1]},${k[2]})`;
      ctx.fillRect(r.x + i, r.y + j, 1, 1);
    }
  }
}

function paintSolid(ctx: CanvasRenderingContext2D, r: Rect, seed: number, color: RGB, edgeDark = true) {
  paintRect(ctx, r, seed, (i, j, w, h) => {
    const edge = edgeDark && (i === 0 || j === h - 1 || i === w - 1) ? 0.86 : 1;
    return shade(color, edge);
  });
}

function buildSkin(t: SkinTheme): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);

  const skin = hexToRgb(t.skin);
  const hair = hexToRgb(t.hair);
  const eye = hexToRgb(t.eye);
  const armor = hexToRgb(t.armor);
  const trim = hexToRgb(t.trim);
  const glow = hexToRgb(t.glow);
  const white: RGB = [240, 240, 245];
  const armorDark = shade(armor, 0.7);
  const armorLight = shade(armor, 1.35);

  // ---- HEAD (base layer) ----
  const head = boxFaces(0, 0, 8, 8, 8);
  paintSolid(ctx, head.top, 1, hair, false);
  paintSolid(ctx, head.bottom, 2, shade(skin, 0.8), false);
  paintSolid(ctx, head.right, 3, skin, false);
  paintSolid(ctx, head.left, 4, skin, false);
  // hair on sides + back
  paintRect(ctx, head.right, 5, (i, j) => (j < 3 || (i > 4 && j < 5) ? shade(hair, 1 + (j === 2 ? -0.12 : 0)) : j >= 6 && i >= 4 ? shade(armor, 0.9) : shade(skin, 0.9)));
  paintRect(ctx, head.left, 6, (i, j) => (j < 3 || (i < 3 && j < 5) ? shade(hair, 1 + (j === 2 ? -0.12 : 0)) : j >= 6 && i <= 3 ? shade(armor, 0.9) : shade(skin, 0.9)));
  paintRect(ctx, head.back, 7, (i, j) => (j < 6 ? shade(hair, 1 + noise(i, j, 9) * 0.1) : shade(skin, 0.88)));
  // face: angry glowing eyes, scar and a dark face mask
  const scar: RGB = [150, 55, 55];
  const mask = shade(armor, 0.9);
  paintRect(ctx, head.front, 8, (i, j) => {
    if (j === 0) return hair;
    if (j === 1) return i === 0 || i === 7 ? hair : shade(hair, 1.1);
    if (j === 2 && (i === 0 || i === 7)) return hair;
    // heavy angry brows (inner ends point down)
    if (j === 3 && (i === 1 || i === 2 || i === 5 || i === 6)) return shade(hair, 0.6);
    if (j === 2 && (i === 3 || i === 4)) return shade(hair, 0.9);
    // glowing slit eyes
    if (j === 4) {
      if (i === 1 || i === 6) return shade(eye, 0.8);
      if (i === 2 || i === 5) return mix(eye, glow, 0.6);
      if (i === 3 || i === 4) return shade(skin, 0.7);
    }
    if (j === 5 && (i === 2 || i === 5)) return shade(eye, 0.4); // glow bleeding below the eyes
    if (j === 5 && i === 6) return scar; // scar across the right cheek
    if (j === 5) return shade(skin, 0.85);
    // face mask over nose and mouth
    if (j === 6) return i === 0 || i === 7 ? shade(trim, 0.7) : mask;
    if (j === 7) return i === 2 || i === 5 ? shade(trim, 0.9) : shade(mask, 0.85);
    return skin;
  });

  // ---- HEAD overlay: headband + flame crest ----
  const headO = boxFaces(32, 0, 8, 8, 8);
  paintRect(ctx, headO.front, 10, (i, j) => (j === 2 ? trim : j === 1 && i % 2 === 0 ? shade(trim, 0.8) : null));
  paintRect(ctx, headO.right, 11, (i, j) => (j === 2 ? trim : null));
  paintRect(ctx, headO.left, 12, (i, j) => (j === 2 ? trim : null));
  paintRect(ctx, headO.back, 13, (i, j) => (j === 2 ? trim : null));
  paintRect(ctx, headO.top, 14, (i, j) => (i >= 3 && i <= 4 && j >= 1 && j <= 6 ? (j % 2 ? glow : trim) : null));

  // ---- BODY ----
  const body = boxFaces(16, 16, 8, 12, 4);
  paintSolid(ctx, body.top, 20, armorLight, false);
  paintSolid(ctx, body.bottom, 21, armorDark, false);
  paintRect(ctx, body.right, 22, (i, j) => (j === 9 ? trim : shade(armor, 0.9)));
  paintRect(ctx, body.left, 23, (i, j) => (j === 9 ? trim : shade(armor, 0.9)));
  paintRect(ctx, body.front, 24, (i, j) => {
    if (j === 9 || j === 10) return i === 3 || i === 4 ? glow : trim; // belt + buckle
    if (j > 10) return shade(armor, 0.85);
    if (i === 0 || i === 7) return shade(armor, 0.82);
    // vertical flame gradient chest plate
    return mix(armor, shade(armor, 1.28), j / 11);
  });
  paintRect(ctx, body.back, 25, (i, j) => (j === 9 || j === 10 ? trim : mix(armor, armorDark, j / 11)));

  // ---- BODY overlay: chest emblem (flame) ----
  const bodyO = boxFaces(16, 32, 8, 12, 4);
  const flame = ['...G...', '..GOG..', '.GOROG.', '.GORRG.', '..GOG..', '...G...'];
  paintRect(ctx, bodyO.front, 26, (i, j) => {
    const fx = i - 0; // 8 wide, flame 7 wide centered at i=0.5
    const row = j - 1;
    if (row >= 0 && row < flame.length && fx >= 0 && fx < 7) {
      const ch = flame[row][fx];
      if (ch === 'G') return glow;
      if (ch === 'O') return trim;
      if (ch === 'R') return shade(trim, 0.7);
    }
    return j === 0 && (i === 0 || i === 7) ? shade(trim, 0.9) : null;
  });
  paintRect(ctx, bodyO.right, 27, (i, j) => (j === 0 ? trim : null));
  paintRect(ctx, bodyO.left, 28, (i, j) => (j === 0 ? trim : null));
  paintRect(ctx, bodyO.back, 29, (i, j) => (j === 0 ? trim : null));

  // ---- ARMS (right at 40,16 / left at 32,48) ----
  const arm = (ox: number, oy: number, seed: number) => {
    const f = boxFaces(ox, oy, 4, 12, 4);
    paintSolid(ctx, f.top, seed, armorLight, false);
    paintSolid(ctx, f.bottom, seed + 1, skin, false);
    [f.right, f.front, f.left, f.back].forEach((face, idx) =>
      paintRect(ctx, face, seed + 2 + idx, (i, j) => {
        if (j >= 9) return skin; // hand
        if (j === 8) return shade(skin, 0.8);
        if (j === 7) return shade(trim, 0.85); // thin bracer line
        if (j === 6) return shade(armor, 0.8);
        if (j <= 1) return shade(trim, 0.9); // pauldron edge
        return mix(armor, armorLight, (i % 2) * 0.1 + 0.08);
      })
    );
  };
  arm(40, 16, 40);
  arm(32, 48, 50);

  // ---- ARM overlays: pauldrons ----
  const pauldron = (ox: number, oy: number, seed: number) => {
    const f = boxFaces(ox, oy, 4, 12, 4);
    paintSolid(ctx, f.top, seed, trim, false);
    [f.right, f.front, f.left, f.back].forEach((face, idx) =>
      paintRect(ctx, face, seed + 1 + idx, (i, j) => (j === 0 ? trim : j === 1 ? shade(trim, 0.6) : null))
    );
  };
  pauldron(40, 32, 60);
  pauldron(48, 48, 70);

  // ---- LEGS (right at 0,16 / left at 16,48) ----
  const leg = (ox: number, oy: number, seed: number) => {
    const f = boxFaces(ox, oy, 4, 12, 4);
    paintSolid(ctx, f.top, seed, armorDark, false);
    paintSolid(ctx, f.bottom, seed + 1, shade(trim, 0.55), false);
    [f.right, f.front, f.left, f.back].forEach((face, idx) =>
      paintRect(ctx, face, seed + 2 + idx, (i, j) => {
        if (j === 11) return shade(trim, 0.7); // sole highlight
        if (j >= 10) return shade(armor, 0.55); // boot
        if (j === 9) return shade(trim, 0.9); // boot cuff
        return mix(armorDark, armor, 0.2 + (i === 0 ? 0 : 0.12));
      })
    );
  };
  leg(0, 16, 80);
  leg(16, 48, 90);

  // ---- LEG overlays: knee guards ----
  const knee = (ox: number, oy: number, seed: number) => {
    const f = boxFaces(ox, oy, 4, 12, 4);
    paintRect(ctx, f.front, seed, (i, j) => (j === 5 ? shade(trim, 0.85) : null));
    paintRect(ctx, f.right, seed + 1, (i, j) => (j === 5 ? shade(trim, 0.7) : null));
    paintRect(ctx, f.left, seed + 2, (i, j) => (j === 5 ? shade(trim, 0.7) : null));
    paintRect(ctx, f.back, seed + 3, (i, j) => (j === 5 ? shade(trim, 0.7) : null));
  };
  knee(0, 32, 100);
  knee(0, 48, 110);

  return canvas.toDataURL('image/png');
}

export function createInitialSkins(): SkinAsset[] {
  return THEMES.map((t) => ({
    id: t.id,
    name: t.name,
    modelType: t.modelType,
    dataUrl: buildSkin(t),
    showOuterLayer: true,
    showCape: t.showCape,
    showSword: t.showSword,
  }));
}

export async function normalizeUploadedSkinFile(file: File): Promise<{ dataUrl: string; name: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode PNG skin file.'));
      image.src = objectUrl;
    });

    if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) {
      throw new Error(`Invalid skin dimensions (${img.width}x${img.height}). Minecraft skins must be 64x64 or 64x32 PNG.`);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    if (img.height === 32) {
      ctx.drawImage(img, 0, 16, 16, 16, 16, 48, 16, 16);
      ctx.drawImage(img, 40, 16, 16, 16, 32, 48, 16, 16);
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      name: file.name.replace(/\.png$/i, ''),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
