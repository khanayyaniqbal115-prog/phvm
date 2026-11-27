import { useState } from 'react';

/** Server icon from mcstatus.io. Falls back to a letter tile if the server has no icon or the request fails. */
export function ServerIcon({ host, name, size = 36, accent = '#8B5CF6' }: { host: string; name: string; size?: number; accent?: string }) {
  const [failed, setFailed] = useState(false);
  const clean = host.replace(/^.*:\/\//, '').trim();
  const letter = (name || host || '?').trim().charAt(0).toUpperCase();
  const box = { width: size, height: size } as const;
  if (failed || !clean) {
    return (
      <div className="rounded-lg flex items-center justify-center shrink-0 border border-white/10 font-display font-extrabold text-sm" style={{ ...box, backgroundColor: `${accent}1A`, color: accent }} aria-hidden>
        {letter}
      </div>
    );
  }
  return (
    <img
      src={`https://api.mcstatus.io/v2/icon/${encodeURIComponent(clean)}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="rounded-lg shrink-0 border border-white/10 bg-black/30"
      style={{ ...box, imageRendering: 'pixelated' }}
    />
  );
}
