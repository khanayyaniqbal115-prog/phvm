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

const THEMES: SkinTheme[] = [
  { id: 'skin-phoenix', name: 'Phoenix Knight', modelType: 'classic', skin: '#E6B08F', hair: '#2B1A14', eye: '#F97316', armor: '#1B2130', trim: '#F97316', glow: '#FBBF24', showCape: true, showSword: true },
  { id: 'skin-inferno', name: 'Inferno Scout', modelType: 'slim', skin: '#D9A07C', hair: '#8B1E12', eye: '#FDE047', armor: '#3B1210', trim: '#EF4444', glow: '#FB923C', showCape: true, showSword: true },
  { id: 'skin-frost', name: 'Frost Warden', modelType: 'classic', skin: '#EBC4A8', hair: '#CBD5E1', eye: '#38BDF8', armor: '#1E3A5F', trim: '#7DD3FC', glow: '#E0F2FE', showCape: true, showSword: true },
  { id: 'skin-void', name: 'Void Walker', modelType: 'slim', skin: '#C9A18A', hair: '#1E1038', eye: '#C084FC', armor: '#1A1030', trim: '#A855F7', glow: '#E9D5FF', showCape: true, showSword: false },
  { id: 'skin-jade', name: 'Jade Ranger', modelType: 'classic', skin: '#C58F6B', hair: '#16301F', eye: '#34D399', armor: '#123D2D', trim: '#34D399', glow: '#D1FAE5', showCape: true, showSword: true },
  { id: 'skin-gold', name: 'Golden Paladin', modelType: 'slim', skin: '#F0C3A0', hair: '#B98A2B', eye: '#2563EB', armor: '#4A3410', trim: '#FBBF24', glow: '#FEF3C7', showCape: true, showSword: true },
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
      const n = (noise(r.x + i, r.y + j, seed) - 0.5) * 0.12;
      const k = shade(c, 1 + n);
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
  paintRect(ctx, head.right, 5, (i, j) => (j < 3 || (i > 4 && j < 5) ? shade(hair, 1 + (j === 2 ? -0.12 : 0)) : shade(skin, 0.96)));
  paintRect(ctx, head.left, 6, (i, j) => (j < 3 || (i < 3 && j < 5) ? shade(hair, 1 + (j === 2 ? -0.12 : 0)) : shade(skin, 0.96)));
  paintRect(ctx, head.back, 7, (i, j) => (j < 6 ? shade(hair, 1 + noise(i, j, 9) * 0.1) : shade(skin, 0.88)));
  // face
  paintRect(ctx, head.front, 8, (i, j) => {
    if (j === 0) return hair;
    if (j === 1) return i === 0 || i === 7 ? hair : shade(hair, 1.15);
    if (j === 2 && (i === 0 || i === 7)) return hair;
    // eyebrows
    if (j === 3 && ((i >= 1 && i <= 2) || (i >= 5 && i <= 6))) return shade(hair, 0.9);
    // eyes: white + iris
    if (j === 4) {
      if (i === 1 || i === 5) return white;
      if (i === 2 || i === 6) return eye;
    }
    // nose + mouth
    if (j === 5 && (i === 3 || i === 4)) return shade(skin, 0.9);
    if (j === 6 && i >= 3 && i <= 4) return shade(skin, 0.68);
    // blush / cheeks
    if (j === 5 && (i === 1 || i === 6)) return mix(skin, [220, 120, 110], 0.25);
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
  paintRect(ctx, body.right, 22, (i, j) => (j >= 9 ? trim : shade(armor, 0.9)));
  paintRect(ctx, body.left, 23, (i, j) => (j >= 9 ? trim : shade(armor, 0.9)));
  paintRect(ctx, body.front, 24, (i, j) => {
    if (j === 9 || j === 10) return i === 3 || i === 4 ? glow : trim; // belt + buckle
    if (j > 10) return shade(armor, 0.85);
    if (i === 0 || i === 7) return shade(armor, 0.82);
    // vertical flame gradient chest plate
    return mix(armor, shade(armor, 1.5), j / 11);
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
        if (j >= 6) return trim; // bracer
        if (j <= 1) return shade(trim, 0.9); // pauldron edge
        return mix(armor, armorLight, (i % 2) * 0.12 + 0.05);
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
      paintRect(ctx, face, seed + 1 + idx, (i, j) => (j <= 1 ? (j === 1 ? shade(trim, 0.75) : trim) : null))
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
        if (j >= 10) return shade(trim, 0.6); // boot
        if (j === 9) return trim; // boot cuff
        return mix(armorDark, armor, 0.2 + (i === 0 ? 0 : 0.12));
      })
    );
  };
  leg(0, 16, 80);
  leg(16, 48, 90);

  // ---- LEG overlays: knee guards ----
  const knee = (ox: number, oy: number, seed: number) => {
    const f = boxFaces(ox, oy, 4, 12, 4);
    paintRect(ctx, f.front, seed, (i, j) => (j >= 5 && j <= 6 ? trim : null));
    paintRect(ctx, f.right, seed + 1, (i, j) => (j >= 5 && j <= 6 ? shade(trim, 0.8) : null));
    paintRect(ctx, f.left, seed + 2, (i, j) => (j >= 5 && j <= 6 ? shade(trim, 0.8) : null));
    paintRect(ctx, f.back, seed + 3, (i, j) => (j >= 5 && j <= 6 ? shade(trim, 0.8) : null));
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
