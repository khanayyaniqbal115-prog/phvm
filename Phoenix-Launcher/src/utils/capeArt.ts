/** Draws the Phoenix cape artwork (with the "I AM FROM PHOENIX LAUNCHER" text) into a w x h area. */
export function drawPhoenixCape(ctx: CanvasRenderingContext2D, w: number, h: number, x0 = 0, y0 = 0): void {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(w / 320, h / 528);
  const W = 320;
  const H = 528;
  // Deep crimson cloth with a vertical gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#5B1519');
  grad.addColorStop(0.55, '#3A0E14');
  grad.addColorStop(1, '#1F070C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle woven texture
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#FFFFFF';
  for (let y = 0; y < H; y += 4) {
    for (let x = (y / 4) % 2 === 0 ? 0 : 2; x < W; x += 4) ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Golden border
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.strokeStyle = '#FDE047';
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, W - 44, H - 44);

  // Phoenix emblem (flame + wings)
  const cx = W / 2;
  ctx.save();
  ctx.translate(cx, 150);
  const flame = ctx.createLinearGradient(0, -80, 0, 70);
  flame.addColorStop(0, '#FDE047');
  flame.addColorStop(0.5, '#F97316');
  flame.addColorStop(1, '#DC2626');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(0, -85);
  ctx.bezierCurveTo(30, -45, 85, -40, 105, -75);
  ctx.bezierCurveTo(100, -10, 60, 30, 22, 38);
  ctx.bezierCurveTo(32, 55, 12, 78, 0, 90);
  ctx.bezierCurveTo(-12, 78, -32, 55, -22, 38);
  ctx.bezierCurveTo(-60, 30, -100, -10, -105, -75);
  ctx.bezierCurveTo(-85, -40, -30, -45, 0, -85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFF3B0';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Cape text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#FDE9B8';
  ctx.font = '700 34px Arial, Helvetica, sans-serif';
  ctx.fillText('I AM FROM', cx, 300);
  ctx.fillStyle = '#FDBA3B';
  ctx.font = '900 56px Arial, Helvetica, sans-serif';
  ctx.fillText('PHOENIX', cx, 360);
  ctx.fillStyle = '#FDE9B8';
  ctx.font = '800 46px Arial, Helvetica, sans-serif';
  ctx.fillText('LAUNCHER', cx, 420);
  ctx.shadowBlur = 0;

  ctx.restore();
}

/** HD cape PNG (1024x512, standard 64x32 cape layout at 16x) for in-game use. Returns base64 without the data: prefix. */
export function createCapePngBase64(): string {
  const scale = 16;
  const canvas = document.createElement('canvas');
  canvas.width = 64 * scale;
  canvas.height = 32 * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3A0E14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // outer (back) face: x=1, y=1, 10x16 pixels; inner face (x=12) stays plain
  drawPhoenixCape(ctx, 10 * scale, 16 * scale, 1 * scale, 1 * scale);
  // side/top strips
  ctx.fillStyle = '#2B0A0F';
  ctx.fillRect(0, 1 * scale, 1 * scale, 16 * scale);
  ctx.fillRect(11 * scale, 1 * scale, 1 * scale, 16 * scale);
  ctx.fillRect(1 * scale, 0, 10 * scale, 1 * scale);
  ctx.fillRect(11 * scale, 0, 10 * scale, 1 * scale);
  return canvas.toDataURL('image/png').split(',')[1] || '';
}
