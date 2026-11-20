import { useEffect, useState } from 'react';

type Status = { configured: boolean; connected: boolean; activityShown: boolean; error: string };

/** Small header indicator that shows whether Discord Rich Presence is working (desktop app only). */
export function DiscordChip() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const api = window.phoenixDesktop;
    if (!api?.getDiscordStatus) return;
    let alive = true;
    const poll = () =>
      api
        .getDiscordStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => undefined);
    void poll();
    const t = window.setInterval(poll, 4000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  if (!status || !status.configured) return null;
  const good = status.connected && status.activityShown;
  const label = good ? 'Discord: showing' : status.connected ? 'Discord: connected' : 'Discord: waiting';
  return (
    <span
      title={status.error || (good ? 'Your Discord profile shows Phoenix Launcher' : 'Connected to Discord')}
      className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-[#111620] border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300"
    >
      <span className={`w-2 h-2 rounded-full ${good ? 'bg-emerald-400' : status.connected ? 'bg-amber-400' : 'bg-slate-500'}`} />
      {label}
    </span>
  );
}
