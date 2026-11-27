// Changes the colours of a 64x64 Minecraft skin (hue / saturation / brightness) and returns a new PNG data URL.

export interface RecolorOptions {
  hue: number; // degrees, -180..180
  saturation: number; // percent, 0..200 (100 = unchanged)
  brightness: number; // percent, 50..150 (100 = unchanged)
  keepFace: boolean; // leave the face (front of the head) as it is
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Recolour the pixel data in place (RGBA, 64 wide). Exported so it can be tested without a canvas. */
export function recolorPixels(data: Uint8ClampedArray, width: number, o: RecolorOptions) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const p = i / 4;
    const x = p % width;
    const y = Math.floor(p / width);
    if (o.keepFace && x >= 8 && x < 16 && y >= 8 && y < 16) continue; // head front
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const [r, g, b] = hslToRgb(h + o.hue, Math.min(1, s * (o.saturation / 100)), Math.min(1, l * (o.brightness / 100)));
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
}

export function recolorSkin(dataUrl: string, o: RecolorOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 64, 64);
      const px = ctx.getImageData(0, 0, 64, 64);
      recolorPixels(px.data, 64, o);
      ctx.putImageData(px, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not read the skin.'));
    img.src = dataUrl;
  });
}
