import type { SkinAsset } from '../types/launcher';

function setPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function fillBoxTexture(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  d: number,
  base: string,
  shade: string,
  highlight: string
) {
  ctx.fillStyle = base;
  ctx.fillRect(ox + d, oy, w * 2, d);
  ctx.fillRect(ox, oy + d, (w + d) * 2, h);

  ctx.fillStyle = shade;
  ctx.fillRect(ox, oy + d + h - 1, (w + d) * 2, 1);
  ctx.fillRect(ox + d + w + d, oy + d, w, h);

  ctx.fillStyle = highlight;
  ctx.fillRect(ox + d, oy, w, d);
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  return { canvas, ctx };
}

function buildSteveOrHerobrine(isHerobrine: boolean): string {
  const { canvas, ctx } = makeCanvas();
  const skin = '#C6906B';
  const skinShade = '#A97352';
  const hair = '#2F1F14';
  const hairHighlight = '#3F2A1B';
  const shirt = '#00A5A8';
  const shirtShade = '#008184';
  const pants = '#384692';
  const pantsShade = '#2A3573';
  const shoe = '#6E737D';

  // Head (8x8x8 at 0,0)
  fillBoxTexture(ctx, 0, 0, 8, 8, 8, skin, skinShade, skin);
  ctx.fillStyle = hair;
  ctx.fillRect(8, 0, 8, 8); // top
  ctx.fillRect(24, 8, 8, 8); // back
  ctx.fillRect(0, 8, 8, 3); // right hair
  ctx.fillRect(16, 8, 8, 3); // left hair
  ctx.fillRect(8, 8, 8, 2); // bangs
  setPixel(ctx, 8, 10, hair);
  setPixel(ctx, 15, 10, hair);
  setPixel(ctx, 0, 11, hair);
  setPixel(ctx, 23, 11, hair);
  ctx.fillStyle = hairHighlight;
  ctx.fillRect(10, 2, 3, 2);
  ctx.fillRect(26, 10, 3, 2);

  // Face features
  if (isHerobrine) {
    // Glowing white eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(9, 12, 2, 1);
    ctx.fillRect(13, 12, 2, 1);
  } else {
    setPixel(ctx, 9, 12, '#FFFFFF');
    setPixel(ctx, 10, 12, '#444FA8');
    setPixel(ctx, 13, 12, '#444FA8');
    setPixel(ctx, 14, 12, '#FFFFFF');
  }
  // Nose & classic goatee
  ctx.fillStyle = skinShade;
  ctx.fillRect(11, 13, 2, 1);
  ctx.fillStyle = '#5B361F';
  ctx.fillRect(10, 14, 1, 2);
  ctx.fillRect(13, 14, 1, 2);
  ctx.fillRect(11, 15, 2, 1);
  ctx.fillStyle = '#8B5A42';
  ctx.fillRect(11, 14, 2, 1);

  // Torso (8x12x4 at 16,16)
  fillBoxTexture(ctx, 16, 16, 8, 12, 4, shirt, shirtShade, shirt);
  // Teal V-neck collar showing skin
  ctx.fillStyle = skin;
  ctx.fillRect(22, 20, 4, 1);
  ctx.fillRect(23, 21, 2, 1);
  // Subtle shirt tuck shadow
  ctx.fillStyle = shirtShade;
  ctx.fillRect(20, 30, 8, 2);
  ctx.fillStyle = pants;
  ctx.fillRect(20, 31, 4, 1);

  // Right Arm (4x12x4 at 40,16) - short teal sleeve + bare arm
  fillBoxTexture(ctx, 40, 16, 4, 12, 4, skin, skinShade, shirt);
  ctx.fillStyle = shirt;
  ctx.fillRect(40, 20, 16, 4);
  ctx.fillRect(44, 16, 4, 4);

  // Left Arm (4x12x4 at 32,48) - short teal sleeve + bare arm
  fillBoxTexture(ctx, 32, 48, 4, 12, 4, skin, skinShade, shirt);
  ctx.fillStyle = shirt;
  ctx.fillRect(32, 52, 16, 4);
  ctx.fillRect(36, 48, 4, 4);

  // Right Leg (4x12x4 at 0,16)
  fillBoxTexture(ctx, 0, 16, 4, 12, 4, pants, pantsShade, pants);
  ctx.fillStyle = shoe;
  ctx.fillRect(0, 30, 16, 2);
  ctx.fillRect(8, 16, 4, 4);

  // Left Leg (4x12x4 at 16,48)
  fillBoxTexture(ctx, 16, 48, 4, 12, 4, pants, pantsShade, pants);
  ctx.fillStyle = shoe;
  ctx.fillRect(16, 62, 16, 2);
  ctx.fillRect(24, 48, 4, 4);

  return canvas.toDataURL('image/png');
}

function buildAlexSkin(): string {
  const { canvas, ctx } = makeCanvas();
  const skin = '#F3C7A7';
  const skinShade = '#D9A582';
  const hair = '#D86A23';
  const hairHighlight = '#EE8833';
  const hairDark = '#A94912';
  const tunic = '#688F4A';
  const tunicShade = '#4E6F36';
  const belt = '#4A3121';
  const buckle = '#E5B94C';
  const pants = '#3D342E';
  const pantsShade = '#2B2420';
  const boots = '#4B3222';

  // Head (8x8x8 at 0,0)
  fillBoxTexture(ctx, 0, 0, 8, 8, 8, skin, skinShade, skin);
  ctx.fillStyle = hair;
  ctx.fillRect(8, 0, 8, 8); // top
  ctx.fillRect(24, 8, 8, 8); // back
  ctx.fillRect(0, 8, 8, 5); // right hair
  ctx.fillRect(16, 8, 8, 5); // left hair
  ctx.fillRect(8, 8, 8, 2); // forehead
  // Alex signature swept bang on right side of face + side strands
  ctx.fillRect(8, 10, 3, 1);
  ctx.fillRect(8, 11, 1, 2);
  ctx.fillRect(14, 10, 2, 1);
  ctx.fillStyle = hairHighlight;
  ctx.fillRect(10, 1, 4, 3);
  ctx.fillRect(9, 8, 3, 1);
  ctx.fillStyle = hairDark;
  ctx.fillRect(26, 13, 4, 3);

  // Face eyes & soft expression
  setPixel(ctx, 9, 12, '#FFFFFF');
  setPixel(ctx, 10, 12, '#3E8136');
  setPixel(ctx, 13, 12, '#3E8136');
  setPixel(ctx, 14, 12, '#FFFFFF');
  ctx.fillStyle = '#C98972';
  ctx.fillRect(11, 14, 2, 1);

  // Outer hair ponytail detail on hat layer (32,0)
  ctx.fillStyle = hair;
  ctx.fillRect(58, 10, 3, 5);
  ctx.fillStyle = hairHighlight;
  ctx.fillRect(59, 11, 1, 3);

  // Torso (8x12x4 at 16,16)
  fillBoxTexture(ctx, 16, 16, 8, 12, 4, tunic, tunicShade, tunic);
  // Collar
  ctx.fillStyle = skin;
  ctx.fillRect(22, 20, 4, 1);
  // Brown leather belt + brass buckle
  ctx.fillStyle = belt;
  ctx.fillRect(16, 28, 24, 2);
  ctx.fillStyle = buckle;
  ctx.fillRect(23, 28, 2, 2);

  // Right Arm (Slim 3x12x4 at 40,16)
  fillBoxTexture(ctx, 40, 16, 3, 12, 4, tunic, tunicShade, tunic);
  ctx.fillStyle = skin;
  ctx.fillRect(40, 27, 14, 5);
  ctx.fillStyle = tunicShade;
  ctx.fillRect(40, 26, 14, 1);

  // Left Arm (Slim 3x12x4 at 32,48)
  fillBoxTexture(ctx, 32, 48, 3, 12, 4, tunic, tunicShade, tunic);
  ctx.fillStyle = skin;
  ctx.fillRect(32, 59, 14, 5);
  ctx.fillStyle = tunicShade;
  ctx.fillRect(32, 58, 14, 1);

  // Right Leg (4x12x4 at 0,16)
  fillBoxTexture(ctx, 0, 16, 4, 12, 4, pants, pantsShade, pants);
  ctx.fillStyle = boots;
  ctx.fillRect(0, 28, 16, 4);
  ctx.fillRect(8, 16, 4, 4);

  // Left Leg (4x12x4 at 16,48)
  fillBoxTexture(ctx, 16, 48, 4, 12, 4, pants, pantsShade, pants);
  ctx.fillStyle = boots;
  ctx.fillRect(16, 60, 16, 4);
  ctx.fillRect(24, 48, 4, 4);

  return canvas.toDataURL('image/png');
}

interface SkinTheme {
  id: string;
  name: string;
  modelType: 'classic' | 'slim';
  skinTone: string;
  skinShade: string;
  hair: string;
  eye: string;
  jacket: string;
  jacketShade: string;
  accent: string;
  pants: string;
  pantsShade: string;
  boots: string;
  visor?: boolean;
  fullBodyVoid?: boolean;
  hatCrown?: boolean;
}

function buildThemedSkinDataUrl(theme: SkinTheme): string {
  const { canvas, ctx } = makeCanvas();
  const armW = theme.modelType === 'slim' ? 3 : 4;

  // Head
  fillBoxTexture(ctx, 0, 0, 8, 8, 8, theme.skinTone, theme.skinShade, theme.skinTone);
  ctx.fillStyle = theme.hair;
  ctx.fillRect(8, 0, 8, 8);
  ctx.fillRect(24, 8, 8, 8);
  ctx.fillRect(0, 8, 8, 3);
  ctx.fillRect(16, 8, 8, 3);
  ctx.fillRect(8, 8, 8, 2);
  setPixel(ctx, 8, 10, theme.hair);
  setPixel(ctx, 15, 10, theme.hair);

  if (theme.visor) {
    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(9, 11, 6, 2);
    ctx.fillStyle = theme.eye;
    ctx.fillRect(10, 11, 2, 1);
    ctx.fillRect(13, 11, 2, 1);
  } else if (theme.fullBodyVoid) {
    // Glowing Enderman magenta eyes across dark face
    ctx.fillStyle = '#F0ABFC';
    ctx.fillRect(8, 11, 3, 1);
    ctx.fillRect(13, 11, 3, 1);
    ctx.fillStyle = '#C026D3';
    setPixel(ctx, 9, 11, '#FFFFFF');
    setPixel(ctx, 14, 11, '#FFFFFF');
  } else {
    setPixel(ctx, 9, 12, '#FFFFFF');
    setPixel(ctx, 10, 12, theme.eye);
    setPixel(ctx, 13, 12, theme.eye);
    setPixel(ctx, 14, 12, '#FFFFFF');
    ctx.fillStyle = theme.skinShade;
    ctx.fillRect(11, 14, 2, 1);
  }

  // Torso
  fillBoxTexture(ctx, 16, 16, 8, 12, 4, theme.jacket, theme.jacketShade, theme.jacket);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(23, 21, 2, 7);
  ctx.fillRect(21, 22, 6, 2);
  ctx.fillStyle = theme.skinTone;
  ctx.fillRect(22, 20, 4, 1);

  // Arms
  fillBoxTexture(ctx, 40, 16, armW, 12, 4, theme.jacket, theme.jacketShade, theme.jacket);
  ctx.fillStyle = theme.skinTone;
  ctx.fillRect(40, 28, (armW + 4) * 2, 4);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(40, 27, (armW + 4) * 2, 1);

  fillBoxTexture(ctx, 32, 48, armW, 12, 4, theme.jacket, theme.jacketShade, theme.jacket);
  ctx.fillStyle = theme.skinTone;
  ctx.fillRect(32, 60, (armW + 4) * 2, 4);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(32, 59, (armW + 4) * 2, 1);

  // Legs
  fillBoxTexture(ctx, 0, 16, 4, 12, 4, theme.pants, theme.pantsShade, theme.pants);
  ctx.fillStyle = theme.boots;
  ctx.fillRect(0, 29, 16, 3);
  ctx.fillRect(8, 16, 4, 4);

  fillBoxTexture(ctx, 16, 48, 4, 12, 4, theme.pants, theme.pantsShade, theme.pants);
  ctx.fillStyle = theme.boots;
  ctx.fillRect(16, 61, 16, 3);
  ctx.fillRect(24, 48, 4, 4);

  // Outer hat / crown / armor trim
  ctx.fillStyle = theme.accent;
  if (theme.hatCrown) {
    ctx.fillRect(40, 8, 8, 1);
    ctx.fillRect(32, 8, 8, 1);
    ctx.fillRect(48, 8, 8, 1);
    ctx.fillRect(56, 8, 8, 1);
    setPixel(ctx, 43, 7, '#FDE047');
    setPixel(ctx, 44, 7, '#FDE047');
  } else {
    ctx.fillRect(32, 10, 2, 4);
    ctx.fillRect(48, 10, 2, 4);
    ctx.fillRect(40, 0, 8, 1);
  }

  // Outer jacket shoulder trim & belt
  ctx.fillStyle = theme.accent;
  ctx.fillRect(20, 46, 8, 1);
  ctx.fillRect(32, 46, 8, 1);
  ctx.fillStyle = theme.jacketShade;
  ctx.fillRect(20, 36, 2, 10);
  ctx.fillRect(26, 36, 2, 10);

  return canvas.toDataURL('image/png');
}

export function createInitialSkins(): SkinAsset[] {
  const steve: SkinAsset = {
    id: 'skin-steve',
    name: 'Steve',
    modelType: 'classic',
    dataUrl: buildSteveOrHerobrine(false),
    showOuterLayer: true,
    showCape: false,
    showSword: true,
  };

  const alex: SkinAsset = {
    id: 'skin-alex',
    name: 'Alex',
    modelType: 'slim',
    dataUrl: buildAlexSkin(),
    showOuterLayer: true,
    showCape: false,
    showSword: true,
  };

  const herobrine: SkinAsset = {
    id: 'skin-herobrine',
    name: 'Herobrine',
    modelType: 'classic',
    dataUrl: buildSteveOrHerobrine(true),
    showOuterLayer: true,
    showCape: false,
    showSword: false,
  };

  const extraThemes: Array<SkinTheme & { showCape?: boolean; showSword?: boolean }> = [
    {
      id: 'skin-ender',
      name: 'Ender Knight',
      modelType: 'slim',
      skinTone: '#111116',
      skinShade: '#09090D',
      hair: '#09090D',
      eye: '#E879F9',
      jacket: '#1A1625',
      jacketShade: '#0E0B16',
      accent: '#C084FC',
      pants: '#12101B',
      pantsShade: '#08070D',
      boots: '#2E1065',
      fullBodyVoid: true,
      showCape: true,
      showSword: true,
    },
    {
      id: 'skin-netherite',
      name: 'Nether Knight',
      modelType: 'classic',
      skinTone: '#D4A181',
      skinShade: '#B37E5F',
      hair: '#1C1917',
      eye: '#F59E0B',
      jacket: '#3B333C',
      jacketShade: '#262027',
      accent: '#F59E0B',
      pants: '#2B242C',
      pantsShade: '#1C171D',
      boots: '#18141A',
      visor: true,
      hatCrown: true,
      showCape: true,
      showSword: true,
    },
    {
      id: 'skin-diamond',
      name: 'Diamond Paladin',
      modelType: 'classic',
      skinTone: '#DDA985',
      skinShade: '#B88360',
      hair: '#3E2723',
      eye: '#22D3EE',
      jacket: '#1E8EA8',
      jacketShade: '#156A7E',
      accent: '#67E8F9',
      pants: '#16768D',
      pantsShade: '#0E5566',
      boots: '#0C4A6E',
      hatCrown: true,
      showCape: true,
      showSword: true,
    },
    {
      id: 'skin-villager',
      name: 'Villager',
      modelType: 'classic',
      skinTone: '#BA8567',
      skinShade: '#9A694D',
      hair: '#9A694D',
      eye: '#10B981',
      jacket: '#6D4C3D',
      jacketShade: '#4E342A',
      accent: '#34D399',
      pants: '#4E342A',
      pantsShade: '#36231C',
      boots: '#271A14',
      showCape: false,
      showSword: false,
    },
    {
      id: 'skin-phoenix',
      name: 'Phoenix Pilot',
      modelType: 'slim',
      skinTone: '#E8B89A',
      skinShade: '#C99374',
      hair: '#1E1B24',
      eye: '#F97316',
      jacket: '#1A2130',
      jacketShade: '#111622',
      accent: '#F97316',
      pants: '#1E293B',
      pantsShade: '#0F172A',
      boots: '#090C10',
      visor: true,
      showCape: true,
      showSword: true,
    },
  ];

  const extras: SkinAsset[] = extraThemes.map((t) => ({
    id: t.id,
    name: t.name,
    modelType: t.modelType,
    dataUrl: buildThemedSkinDataUrl(t),
    showOuterLayer: true,
    showCape: t.showCape ?? true,
    showSword: t.showSword ?? true,
  }));

  return [steve, alex, herobrine, ...extras];
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
