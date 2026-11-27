import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Music, Pause, Play, Search, SkipBack, SkipForward } from 'lucide-react';
import type { PurrlixSpotifyNow, PurrlixSpotifyStatus, PurrlixSpotifyTrack } from '../types/purrlix-desktop';

const GREEN = '#1ed760';

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem('phoenix.spotify.collapsed') === '1';
  } catch {
    return false;
  }
}

/** Small Spotify player in the bottom-right corner of the desktop launcher. Hidden until SPOTIFY_CLIENT_ID is set in config.cjs. */
export function SpotifyBar() {
  const api = window.phoenixDesktop;
  const [status, setStatus] = useState<PurrlixSpotifyStatus | null>(null);
  const [now, setNow] = useState<PurrlixSpotifyNow | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PurrlixSpotifyTrack[]>([]);
  const [finding, setFinding] = useState(false);
  const syncedAt = useRef(0);
  const nowRef = useRef<PurrlixSpotifyNow | null>(null);
  const savedVolume = useRef<number | null>(null);
  const [duck, setDuck] = useState(() => {
    try {
      return window.localStorage.getItem('phoenix.spotify.duck') !== '0';
    } catch {
      return true;
    }
  });
  const duckRef = useRef(duck);

  const refreshStatus = useCallback(async () => {
    if (!api) return;
    const r = await api.spotifyStatus();
    if (r.ok) setStatus({ configured: r.configured, signedIn: r.signedIn, redirectUri: r.redirectUri });
  }, [api]);

  const poll = useCallback(async () => {
    if (!api) return;
    const r = await api.spotifyNow();
    if (r.ok) {
      setNow(r.now);
      setError('');
      syncedAt.current = Date.now();
    } else {
      setError(r.error);
      if (/not signed in|invalid_grant|revoked/i.test(r.error)) void refreshStatus();
    }
  }, [api, refreshStatus]);

  useEffect(() => {
    nowRef.current = now;
    duckRef.current = duck;
  }, [now, duck]);

  // The launcher adds the "game-running" class to <html> while Minecraft runs: lower Spotify's volume then, restore it afterwards
  useEffect(() => {
    if (!api) return;
    const root = document.documentElement;
    const apply = () => {
      const running = root.classList.contains('game-running');
      if (running && duckRef.current && savedVolume.current === null) {
        const vol = nowRef.current?.volume;
        if (typeof vol === 'number' && vol > 25) {
          savedVolume.current = vol;
          void api.spotifyControl({ action: 'volume', value: 25 });
        }
      } else if (!running && savedVolume.current !== null) {
        void api.spotifyControl({ action: 'volume', value: savedVolume.current });
        savedVolume.current = null;
      }
    };
    const obs = new MutationObserver(apply);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [api]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // ask Spotify every 5 s while signed in and the window is visible; in between the time bar moves on its own
  useEffect(() => {
    if (!status?.signedIn) return;
    void poll();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void poll();
    }, 5000);
    return () => window.clearInterval(id);
  }, [status?.signedIn, poll]);

  useEffect(() => {
    if (!now?.playing) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [now?.playing]);

  if (!api || !status || !status.configured) return null;

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem('phoenix.spotify.collapsed', c ? '0' : '1');
      } catch {
        /* optional */
      }
      return !c;
    });
  };

  const signIn = async () => {
    setBusy(true);
    setError('');
    const r = await api.spotifyLogin();
    setBusy(false);
    if (r.ok) setStatus({ configured: r.configured, signedIn: r.signedIn, redirectUri: r.redirectUri });
    else setError(r.error);
  };

  const signOut = async () => {
    await api.spotifyLogout();
    setNow(null);
    void refreshStatus();
  };

  const playTrack = async (t: PurrlixSpotifyTrack) => {
    setError('');
    setFinding(true);
    const r = await api.spotifyPlayUri({ uri: t.uri });
    setFinding(false);
    if (!r.ok) setError(r.error);
    window.setTimeout(() => void poll(), 1200);
  };

  // type a song name and press Enter: the best match starts playing at once, the others are listed to pick from
  const findAndPlay = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError('');
    setFinding(true);
    const r = await api.spotifySearch({ query: q });
    if (!r.ok) {
      setFinding(false);
      setError(r.error);
      return;
    }
    setMatches(r.tracks);
    if (!r.tracks.length) {
      setFinding(false);
      setError(`No song found for "${q}".`);
      return;
    }
    await playTrack(r.tracks[0]);
  };

  const control = async (action: 'play' | 'pause' | 'next' | 'previous') => {
    setError('');
    if (now && (action === 'play' || action === 'pause')) setNow({ ...now, playing: action === 'play' });
    const r = await api.spotifyControl({ action });
    if (!r.ok) setError(r.error);
    window.setTimeout(() => void poll(), 600);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Open Spotify player"
        className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#160F27] shadow-xl hover:border-white/30"
      >
        <Music className="h-5 w-5" style={{ color: GREEN }} />
      </button>
    );
  }

  const progress =
    now && !now.idle ? Math.min(now.durationMs ?? 0, (now.progressMs ?? 0) + (now.playing ? Date.now() - syncedAt.current : 0)) : 0;
  void tick; // re-render each second so the time bar moves

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-xl border border-white/10 bg-[#160F27]/95 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
          <Music className="h-3.5 w-3.5" style={{ color: GREEN }} />
          Spotify
        </div>
        <div className="flex items-center gap-1">
          {status.signedIn && (
            <button type="button" onClick={signOut} title="Sign out of Spotify" aria-label="Sign out of Spotify" className="p-1 text-slate-500 hover:text-white">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={toggleCollapsed} aria-label="Minimise Spotify player" className="p-1 text-slate-500 hover:text-white">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {status.signedIn && (
        <form onSubmit={findAndPlay} className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#09060F] px-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Song name, then Enter"
            aria-label="Song name"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-white outline-none placeholder:text-slate-500"
          />
          {finding && <span className="text-[10px] text-slate-400">...</span>}
        </form>
      )}
      {matches.length > 1 && status.signedIn && (
        <ul className="mb-2.5 max-h-28 space-y-0.5 overflow-y-auto">
          {matches.slice(1).map((m) => (
            <li key={m.uri}>
              <button type="button" onClick={() => void playTrack(m)} className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-white/5">
                {m.image ? <img src={m.image} alt="" className="h-6 w-6 rounded object-cover" /> : <Music className="h-4 w-4 text-slate-500" />}
                <span className="min-w-0">
                  <span className="block truncate text-[11px] text-white">{m.title}</span>
                  <span className="block truncate text-[10px] text-slate-500">{m.artist}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!status.signedIn ? (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">Sign in to see what is playing and control it from the launcher.</p>
          <button
            type="button"
            disabled={busy}
            onClick={signIn}
            className="w-full rounded-lg px-3 py-1.5 text-xs font-bold text-black disabled:opacity-60"
            style={{ background: GREEN }}
          >
            {busy ? 'Waiting for the browser...' : 'Connect Spotify'}
          </button>
          {busy && (
            <button type="button" onClick={() => void api.spotifyCancel()} className="w-full text-[11px] text-slate-400 hover:text-white">
              Cancel
            </button>
          )}
        </div>
      ) : !now || now.idle ? (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">Nothing is playing right now.</p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              const r = await api.spotifyControl({ action: 'play' });
              if (!r.ok) setError(r.error);
              await poll();
              setBusy(false);
            }}
            className="w-full rounded-lg px-3 py-1.5 text-xs font-bold text-black disabled:opacity-60"
            style={{ background: GREEN }}
          >
            {busy ? 'Starting Spotify...' : 'Play music'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {now.image ? (
              <img src={now.image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#09060F]">
                <Music className="h-5 w-5 text-slate-500" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white" title={now.title}>
                {now.title}
              </div>
              <div className="truncate text-[11px] text-slate-400" title={now.artist}>
                {now.artist}
              </div>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${now.durationMs ? (progress / now.durationMs) * 100 : 0}%`, background: GREEN }} />
            </div>
            <div className="mt-1 flex justify-between font-mono-tabular text-[10px] text-slate-500">
              <span>{fmt(progress)}</span>
              <span>{fmt(now.durationMs ?? 0)}</span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-center gap-3">
            <button type="button" onClick={() => void control('previous')} aria-label="Previous song" className="p-1.5 text-slate-300 hover:text-white">
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void control(now.playing ? 'pause' : 'play')}
              aria-label={now.playing ? 'Pause' : 'Play'}
              className="flex h-9 w-9 items-center justify-center rounded-full text-black"
              style={{ background: GREEN }}
            >
              {now.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => void control('next')} aria-label="Next song" className="p-1.5 text-slate-300 hover:text-white">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
          <label className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={duck}
              onChange={(e) => {
                setDuck(e.target.checked);
                try {
                  window.localStorage.setItem('phoenix.spotify.duck', e.target.checked ? '1' : '0');
                } catch {
                  /* optional */
                }
              }}
              className="accent-green-500"
            />
            Lower volume while the game runs
          </label>
          {now.device && <div className="mt-1 truncate text-center text-[10px] text-slate-500">on {now.device}</div>}
        </>
      )}
      {error && <p className="mt-2 text-[11px] text-amber-300">{error}</p>}
    </div>
  );
}
