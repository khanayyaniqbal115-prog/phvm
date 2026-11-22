import emblemUrl from '../assets/images/phoenix_launcher_emblem_1794755342786.jpg';

/** The real app icon, loaded once. Until it is ready the cape shows only the cloth and flames; the 3D viewer redraws every few frames. */
let emblem: HTMLImageElement | null = null;
if (typeof Image !== 'undefined') {
  const img = new Image();
  img.onload = () => {
    emblem = img;
  };
  img.src = emblemUrl;
}

/** The animation repeats every CAPE_LOOP seconds, so frames can be exported as a seamless loop. */
export const CAPE_LOOP = 2.4;
const wf = (x: number) => (Math.max(1, Math.round((x * CAPE_LOOP) / (2 * Math.PI))) * 2 * Math.PI) / CAPE_LOOP;

/**
 * Draws the Phoenix cape (dark cloth, spread phoenix wings, flame hem and the "I AM FROM PHOENIX LAUNCHER" text)
 * into a w x h area. `t` is the time in seconds: flames, embers and the glow move with it (t = 0 is the still image
 * used for in-game capes, because Minecraft cannot play animated capes).
 */
export function drawPhoenixCape(ctx: CanvasRenderingContext2D, w: number, h: number, x0 = 0, y0 = 0, t = 0): void {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(w / 320, h / 528);
  ctx.beginPath();
  ctx.rect(0, 0, 320, 528);
  ctx.clip();
  const W = 320;
  const H = 528;
  const cx = W / 2;

  // Dark cloth, glowing from below
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0B0508');
  bg.addColorStop(0.6, '#1E070B');
  bg.addColorStop(1, '#5A0F08');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Woven cloth texture
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#FFFFFF';
  for (let y = 0; y < H; y += 4) for (let x = (y / 4) % 2 === 0 ? 0 : 2; x < W; x += 4) ctx.fillRect(x, y, 2, 2);
  ctx.globalAlpha = 1;

  // Aura behind the emblem (pulses)
  const pulse = 0.5 + 0.5 * Math.sin(t * wf(2.4));
  const aura = ctx.createRadialGradient(cx, 170, 10, cx, 170, 170);
  aura.addColorStop(0, `rgba(255,140,30,${0.38 + pulse * 0.2})`);
  aura.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, W, 360);

  // The real Phoenix Launcher app icon, as a rounded tile with a gold edge
  const size = 190;
  const ix = cx - size / 2;
  const iy = 70;
  ctx.save();
  ctx.shadowColor = `rgba(255,140,30,${0.55 + pulse * 0.25})`;
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.roundRect(ix, iy, size, size, 40);
  ctx.fillStyle = '#0B0E14';
  ctx.fill();
  ctx.restore();
  if (emblem) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(ix, iy, size, size, 40);
    ctx.clip();
    ctx.drawImage(emblem, ix, iy, size, size);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(245,158,11,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(ix, iy, size, size, 40);
  ctx.stroke();

  // Small name under the icon, with a light sheen that sweeps across
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 5;
  const sheenX = ((t / CAPE_LOOP) % 1) * (W + 160) - 80;
  const g = ctx.createLinearGradient(sheenX - 50, 0, sheenX + 50, 0);
  g.addColorStop(0, '#FBA524');
  g.addColorStop(0.5, '#FFFFFF');
  g.addColorStop(1, '#FBA524');
  ctx.fillStyle = g;
  ctx.font = '800 26px Arial, Helvetica, sans-serif';
  ctx.fillText('PHOENIX LAUNCHER', cx, 300);
  ctx.shadowBlur = 0;

  // Flame hem: tongues that wave
  for (let layer = 0; layer < 3; layer++) {
    const base = H - 8 - layer * 6;
    const g = ctx.createLinearGradient(0, base - 80, 0, H);
    g.addColorStop(0, layer === 2 ? 'rgba(253,224,71,0.95)' : 'rgba(249,115,22,0.9)');
    g.addColorStop(1, layer === 0 ? 'rgba(122,14,18,0.95)' : 'rgba(220,38,38,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const wave = Math.sin(x * 0.07 + t * wf(3 + layer) + layer * 2) * 10 + Math.sin(x * 0.19 - t * wf(5)) * 5;
      const tongue = 22 + layer * 9 + (Math.sin(x * 0.045 + layer) + 1) * 12;
      ctx.lineTo(x, base - tongue - wave);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  // Rising embers
  for (let i = 0; i < 26; i++) {
    const seed = Math.sin(i * 91.7) * 0.5 + 0.5;
    const life = ((t / CAPE_LOOP) * (1 + Math.floor(seed * 3)) + seed * 7) % 1;
    const x = ((i * 53) % W) + Math.sin(t * wf(2) + i) * 8;
    const y = H - life * 330;
    ctx.globalAlpha = (1 - life) * 0.9;
    ctx.fillStyle = life < 0.4 ? '#FDE047' : '#F97316';
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.globalAlpha = 1;

  // Thin gold edge
  ctx.strokeStyle = 'rgba(245,158,11,0.75)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  ctx.restore();
}

/**
 * Draws a full 64x32 cape/elytra texture sheet at `scale` pixels per texel.
 * Outer face (x=1, y=1, 10x16) carries the artwork; everything else (inner face, edges, elytra wings) is matching cloth.
 */
export function drawCapeSheet(ctx: CanvasRenderingContext2D, scale: number, t = 0): void {
  const W = 64 * scale;
  const H = 32 * scale;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1A070B');
  g.addColorStop(0.7, '#3A0C0E');
  g.addColorStop(1, '#8A1A0A');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // feather streaks: gives the elytra wings and edges a phoenix look
  ctx.lineWidth = Math.max(1, scale * 0.5);
  for (let i = 0; i < 26; i++) {
    const x = (i * 37) % 64;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(253,224,71,0.5)' : 'rgba(249,115,22,0.45)';
    ctx.beginPath();
    ctx.moveTo(x * scale, 0);
    ctx.lineTo((x - 5 + ((i * 7) % 5)) * scale, H);
    ctx.stroke();
  }
  // inner face stays plain dark cloth
  ctx.fillStyle = '#1E070B';
  ctx.fillRect(12 * scale, 1 * scale, 10 * scale, 16 * scale);
  drawPhoenixCape(ctx, 10 * scale, 16 * scale, 1 * scale, 1 * scale, t);
}

/** HD cape PNG (1024x512, standard 64x32 cape layout at 16x) for in-game use. Returns base64 without the data: prefix. */
export function createCapePngBase64(): string {
  const scale = 16;
  const canvas = document.createElement('canvas');
  canvas.width = 64 * scale;
  canvas.height = 32 * scale;
  drawCapeSheet(canvas.getContext('2d')!, scale, 0);
  return canvas.toDataURL('image/png').split(',')[1] || '';
}
