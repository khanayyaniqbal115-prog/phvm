import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, FolderOpen, Globe2, Loader2, RefreshCw, Search, Upload } from 'lucide-react';
import type { MinecraftInstance } from '../types/launcher';
import type { PhoenixCfWorld, PhoenixWorld } from '../types/phoenix-desktop';

interface WorldsViewProps {
  instance: MinecraftInstance;
  mcDir: string;
}

/** Local worlds, world import from .zip, and CurseForge world downloads (desktop app only). */
export function WorldsView({ instance, mcDir }: WorldsViewProps) {
  const desktop = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;
  const [worlds, setWorlds] = useState<PhoenixWorld[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhoenixCfWorld[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const refresh = useCallback(async () => {
    if (!desktop) return;
    const res = await desktop.listWorlds({ dataDir: mcDir, instanceId: instance.id });
    setWorlds(res.worlds);
  }, [desktop, mcDir, instance.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // show the most popular worlds as soon as the page opens, so nobody has to search first
  useEffect(() => {
    if (!desktop) return;
    let alive = true;
    void desktop.searchWorlds('').then((res) => {
      if (!alive) return;
      if (res.ok) setResults(res.results);
      else setMessage({ text: res.error || 'Could not load popular worlds.', error: true });
    });
    return () => {
      alive = false;
    };
  }, [desktop]);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!desktop) return;
    setSearching(true);
    setMessage(null);
    const res = await desktop.searchWorlds(query.trim());
    setSearching(false);
    if (!res.ok) setMessage({ text: res.error || 'Search failed.', error: true });
    setResults(res.results);
  };

  const importZip = async () => {
    if (!desktop) return;
    const res = await desktop.importWorld({ dataDir: mcDir, instanceId: instance.id });
    if (res.cancelled) return;
    setMessage(res.ok ? { text: `Imported "${res.name}".` } : { text: res.error || 'Import failed.', error: true });
    void refresh();
  };

  const download = async (world: PhoenixCfWorld) => {
    if (!desktop) return;
    setBusyId(world.id);
    setMessage(null);
    const res = await desktop.downloadWorld({ dataDir: mcDir, instanceId: instance.id, world });
    setBusyId(null);
    setMessage(
      res.ok ? { text: `Downloaded "${res.name}" into ${instance.name}. Start the game and open Singleplayer.` } : { text: res.error || 'Download failed.', error: true }
    );
    void refresh();
  };

  if (!desktop) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-5 text-sm text-amber-100">
          <div className="font-semibold">Worlds need the desktop app</div>
          <p className="mt-1 text-amber-100/80">World downloads and imports write into your game folder, which a browser cannot do. Open Phoenix Launcher on Windows.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <section className="lg:col-span-4 rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-orange-400" />
            Worlds in {instance.name}
          </h2>
          <button type="button" onClick={() => void refresh()} aria-label="Refresh worlds" className="p-1.5 text-slate-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={importZip}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400"
          >
            <Upload className="w-3.5 h-3.5" />
            Import world .zip
          </button>
          <button
            type="button"
            onClick={() => desktop.openFolder({ dataDir: mcDir, instanceId: instance.id })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A2130] border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Folder
          </button>
        </div>

        {worlds.length === 0 ? (
          <p className="text-xs text-slate-400">No worlds yet. Import a .zip or download one from CurseForge.</p>
        ) : (
          <ul className="space-y-1.5 max-h-[420px] overflow-y-auto">
            {worlds.map((w) => (
              <li key={w.name} className="flex items-center gap-3 rounded-lg bg-[#090C12] border border-white/[0.08] px-3 py-2 transition-colors hover:border-orange-500/30">
                <span className="shrink-0 w-9 h-9 rounded-md bg-gradient-to-br from-emerald-600/40 to-orange-500/30 flex items-center justify-center">
                  <Globe2 className="w-4 h-4 text-white/80" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white truncate">{w.name}</span>
                  <span className="block text-[11px] font-mono-tabular text-slate-400">
                    {w.sizeMb} MB · {new Date(w.modified).toLocaleDateString()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lg:col-span-8 space-y-3">
        <form onSubmit={search} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search CurseForge worlds (parkour, survival island, adventure map...)"
              className="w-full rounded-lg bg-[#111620] border border-white/10 focus:border-orange-500/60 outline-none pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500"
            />
          </div>
          <button type="submit" className="rounded-lg bg-orange-500 hover:bg-orange-400 px-4 text-sm font-semibold text-slate-950">
            Search
          </button>
        </form>

        {message && (
          <div className={`rounded-lg border p-3 text-xs ${message.error ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>
            {message.text}
          </div>
        )}

        {searching && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin" /> Searching...
          </div>
        )}

        {results.length > 0 && !searching && !query.trim() && <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Popular worlds</h2>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {results.map((w) => (
            <article key={w.id} className="group rounded-xl bg-[#111620] border border-white/10 overflow-hidden flex flex-col transition-all hover:border-orange-500/40 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,.45)]">
              {w.thumbnail ? (
                <img src={w.thumbnail} alt="" referrerPolicy="no-referrer" className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              ) : (
                <div className="h-32 w-full bg-gradient-to-br from-orange-500/25 via-[#1b2233] to-[#0e131d] flex items-center justify-center">
                  <Globe2 className="w-9 h-9 text-orange-300/70" />
                </div>
              )}
              <div className="p-3 flex-1 flex flex-col gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white truncate">{w.name}</h3>
                  <p className="text-[11px] text-slate-400">by {w.author || 'unknown'} · {w.downloads.toLocaleString('en-US')} downloads</p>
                </div>
                <p className="text-xs text-slate-300 line-clamp-3 flex-1">{w.summary}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === w.id || !(w.downloadUrl || w.fileId)}
                    onClick={() => download(w)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400"
                  >
                    {busyId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {w.downloadUrl || w.fileId ? 'Download' : 'No .zip file'}
                  </button>
                  {w.page && (
                    <button
                      type="button"
                      onClick={() => desktop.openExternal(w.page!)}
                      aria-label="Open on CurseForge"
                      className="rounded-lg bg-[#1A2130] border border-white/10 px-2.5 text-slate-200 hover:text-white"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
