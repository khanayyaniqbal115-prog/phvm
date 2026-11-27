import { useEffect, useRef } from 'react';

interface SkinHeadAvatarProps {
  skinDataUrl: string;
  alt: string;
  size?: number;
  className?: string;
}

export function SkinHeadAvatar({
  skinDataUrl,
  alt,
  size = 24,
  className = '',
}: SkinHeadAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !skinDataUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 16, 16);
      // Base face region (8, 8, 8, 8)
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 16, 16);
      // Hat/outer face overlay (40, 8, 8, 8)
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 16, 16);
    };
    img.src = skinDataUrl;
  }, [skinDataUrl]);

  return (
    <canvas
      ref={canvasRef}
      width={16}
      height={16}
      aria-label={alt}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      className={`rounded-[4px] bg-[#09060F] shrink-0 ${className}`}
    />
  );
}
