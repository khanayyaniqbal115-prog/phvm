import { useCallback, useEffect, useState } from 'react';
import { Archive, Copy, Cpu, Flame, FolderOpen, Image as ImageIcon, Keyboard, Loader2, Play, Plus, RefreshCw, RotateCcw, Trash2, Users } from 'lucide-react';
import { computeAchievements } from '../utils/achievements';
import { PLAYLOG_KEY, suggestRam, useStored, type PlayLogEntry } from '../utils/prefs';
import { useServerStatus } from '../hooks/useServerStatus';
import { ServerIcon } from './ServerIcon';
import type { MinecraftInstance } from '../types/launcher';
import type { PhoenixBackup, PhoenixScreenshot, PhoenixWorld } from '../types/phoenix-desktop';

interface LibraryViewProps {
  instance: MinecraftInstance;
  instances: MinecraftInstance[];
  mcDir: string;
  onDuplicate: (newId: string) => void;
  onJoin: (host: string) => void;
  onUpdateInstance: (patch: Partial<MinecraftInstance>) => void;
}

type Tab = 'screenshots' | 'backups' | 'servers' | 'stats' | 'profile';
interface SavedServer { name: string; host: string }
interface Friend { name: string; host: string }
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold';
const primary = `${btn} bg-orange-500 text-slate-950 hover:bg-orange-400 disabled:opacity-50`;
const secondary = `${btn} bg-[#1A2130] border border-white/10 text-slate-200 hover:text-white disabled:opacity-50`;

/** Screenshots gallery, world backups and profile duplication (desktop app only). */
export function LibraryView({ instance, instances, mcDir, onDuplicate, onJoin, onUpdateInstance }: LibraryViewProps) {
  const desktop = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;
  const [tab, setTab] = useState<Tab>('screenshots');
  const [shots, setShots] = useState<PhoenixScreenshot[]>([]);
  const [backups, setBackups] = useState<PhoenixBackup[]>([]);
  const [worlds, setWorlds] = useState<PhoenixWorld[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [servers, setServers] = useStored<SavedServer[]>('phoenix-servers', []);
  const [friends, setFriends] = useStored<Friend[]>('phoenix-friends', []);
  const [log] = useStored<PlayLogEntry[]>(PLAYLOG_KEY, []);
  const [srvName, setSrvName] = useState('');
  const [srvHost, setSrvHost] = useState('');
  const [fName, setFName] = useState('');
  const [fHost, setFHost] = useState('');
  const [keysFrom, setKeysFrom] = useState('');
  const { status } = useServerStatus([...new Set([...servers.map((x) => x.host), ...friends.map((f) => f.host).filter(Boolean)])]);
  const achievements = computeAchievements(log);
  const [clientFiles, setClientFiles] = useState<string[] | null>(null);
  const target = { dataDir: mcDir, instanceId: instance.id };
  const say = (text: string, error = false) => setMessage({ text, error });

  useEffect(() => {
    if (tab !== 'profile' || !desktop?.clientStatus) return;
    let alive = true;
    void desktop.clientStatus({ dataDir: mcDir, instanceId: instance.id }).then((r) => {
      if (alive) setClientFiles(r.ok ? r.files : null);
    });
    return () => {
      alive = false;
    };
  }, [tab, desktop, mcDir, instance.id, instance.phoenixClient]);

  const load = useCallback(async () => {
    if (!desktop) return;
    setLoading(true);
    const t = { dataDir: mcDir, instanceId: instance.id };
    if (tab === 'screenshots') {
      const r = await desktop.listScreenshots(t);
      if (r.ok) setShots(r.shots);
    } else if (tab === 'backups') {
      const [b, w] = await Promise.all([desktop.listBackups(t), desktop.listWorlds(t)]);
      if (b.ok) setBackups(b.backups);
      setWorlds(w.worlds);
    }
    setLoading(false);
  }, [desktop, tab, mcDir, instance.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!desktop) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-5 text-sm text-amber-100">
          <div className="font-semibold">Library needs the desktop app</div>
          <p className="mt-1 text-amber-100/80">Screenshots, backups and profile copies live in your game folder. Open Phoenix Launcher on Windows.</p>
        </div>
      </div>
    );
  }

  const backup = async (world: string) => {
    setBusy(world);
    const r = await desktop.backupWorld({ ...target, world });
    setBusy('');
    say(r.ok ? `Backup saved: ${r.file}` : r.error, !r.ok);
    void load();
  };

  const restore = async (b: PhoenixBackup) => {
    if (!window.confirm(`Restore "${b.world}"? It is added as a new world copy, your current world is not replaced.`)) return;
    setBusy(b.file);
    const r = await desktop.restoreBackup({ ...target, file: b.file, world: `${b.world} (restored)` });
    setBusy('');
    say(r.ok ? `Restored as "${r.name}". Open Singleplayer to play it.` : r.error, !r.ok);
  };

  const removeBackup = async (b: PhoenixBackup) => {
    await desktop.deleteBackup({ ...target, file: b.file });
    void load();
  };

  const removeShot = async (s: PhoenixScreenshot) => {
    if (!window.confirm('Delete this screenshot?')) return;
    await desktop.deleteScreenshot({ ...target, name: s.name });
    void load();
  };

  const duplicate = async () => {
    const newId = `copy-${Math.random().toString(36).slice(2, 8)}`;
    setBusy('dup');
    const r = await desktop.cloneInstance({ dataDir: mcDir, fromId: instance.id, toId: newId });
    setBusy('');
    if (r.ok) {
      onDuplicate(newId);
      say('Profile duplicated.');
    } else say(r.error, true);
  };

  const autoRam = async () => {
    const info = await desktop.getInfo();
    const mods = await desktop.listMods(target);
    const count = Math.max(instance.mods.length, mods.ok ? mods.items.filter((m) => m.type === 'mod' && m.enabled).length : 0);
    const mb = suggestRam(info.totalMemMb, count);
    onUpdateInstance({ ramMb: mb });
    say(`RAM set to ${(mb / 1024).toFixed(1)} GB (${count} mods, ${(info.totalMemMb / 1024).toFixed(0)} GB installed).`);
  };

  const copyKeys = async (reset: boolean) => {
    if (!reset && !keysFrom) return say('Choose a profile to copy from.', true);
    const r = await desktop.copyKeybinds({ dataDir: mcDir, fromId: reset ? undefined : keysFrom, toId: instance.id });
    say(r.ok ? (reset ? 'Keybinds reset to default.' : `Copied ${r.count} keybinds.`) : r.error, !r.ok);
  };

  const addServer = () => {
    const host = srvHost.trim();
    if (!host || !/^[\w.\-]+(:\d{1,5})?$/.test(host)) return say('Enter a valid server address, for example play.example.com', true);
    setServers((l) => [...l.filter((x) => x.host !== host), { name: srvName.trim() || host, host }]);
    setSrvName('');
    setSrvHost('');
  };

  const addFriend = () => {
    const name = fName.trim();
    const host = fHost.trim();
    if (!/^\w{3,16}$/.test(name)) return say('Minecraft names are 3-16 letters, numbers or underscores.', true);
    if (host && !/^[\w.\-]+(:\d{1,5})?$/.test(host)) return say('Enter a valid server address or leave it empty.', true);
    setFriends((l) => [...l.filter((x) => x.name.toLowerCase() !== name.toLowerCase()), { name, host }]);
    setFName('');
    setFHost('');
  };

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const weekMinutes = log.filter((e) => e.t >= weekAgo).reduce((a, e) => a + e.m, 0);
  const totalMinutes = instances.reduce((a, i) => a + (i.playTimeMinutes ?? 0), 0);
  const maxMin = Math.max(1, ...instances.map((i) => i.playTimeMinutes ?? 0));
  const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
  const field = 'rounded-lg bg-[#090C12] border border-white/10 focus:border-orange-500/60 outline-none px-3 py-2 text-sm text-white placeholder:text-slate-500';

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-xs font-semibold rounded-lg border ${tab === id ? 'bg-orange-500/15 text-orange-300 border-orange-500/40' : 'border-transparent text-slate-400 hover:text-white'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ImageIcon className="w-5 h-5 text-orange-400" />
          <h1 className="text-xl font-bold text-white">Library</h1>
          <span className="text-xs text-slate-400">{instance.name}</span>
        </div>
        <div className="flex gap-1">
          {tabBtn('screenshots', 'Screenshots')}
          {tabBtn('backups', 'Backups')}
          {tabBtn('servers', 'Servers')}
          {tabBtn('stats', 'Stats')}
          {tabBtn('profile', 'Profile')}
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border p-3 text-xs break-words ${message.error ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>
          {message.text}
        </div>
      )}

      {tab === 'screenshots' && (
        <>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className={secondary}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            <button type="button" onClick={() => desktop.openScreenshotsFolder(target)} className={secondary}><FolderOpen className="w-3.5 h-3.5" /> Folder</button>
            <button type="button" onClick={() => desktop.openRecordings()} className={secondary}><FolderOpen className="w-3.5 h-3.5" /> Recordings</button>
          </div>
          {loading && <div className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}
          {!loading && shots.length === 0 && <p className="text-xs text-slate-400">No screenshots yet. Press F2 in the game to take one.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {shots.map((s) => (
              <figure key={s.name} className="group relative rounded-lg overflow-hidden bg-[#111620] border border-white/10">
                {s.thumb ? (
                  <button type="button" onClick={() => desktop.openScreenshot({ ...target, name: s.name })} className="block w-full">
                    <img src={s.thumb} alt={s.name} className="w-full aspect-video object-cover" />
                  </button>
                ) : (
                  <div className="aspect-video grid place-items-center text-xs text-slate-500">No preview</div>
                )}
                <figcaption className="flex items-center justify-between px-2 py-1.5 text-[10px] text-slate-400">
                  <span className="truncate">{new Date(s.time).toLocaleString()}</span>
                  <button type="button" onClick={() => removeShot(s)} aria-label="Delete screenshot" className="text-red-300 hover:text-red-200 shrink-0 ml-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {tab === 'backups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2"><Archive className="w-4 h-4 text-orange-400" /> Worlds</h2>
            <p className="text-xs text-slate-400">Phoenix also backs up changed worlds automatically before each launch (the newest 3 are kept).</p>
            {worlds.length === 0 && <p className="text-xs text-slate-400">No worlds in this profile yet.</p>}
            <ul className="space-y-1.5">
              {worlds.map((w) => (
                <li key={w.name} className="flex items-center justify-between gap-2 rounded-lg bg-[#090C12] border border-white/[0.08] px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white truncate">{w.name}</span>
                    <span className="block text-[11px] text-slate-400 font-mono-tabular">{w.sizeMb} MB</span>
                  </span>
                  <button type="button" disabled={busy === w.name} onClick={() => backup(w.name)} className={primary}>
                    {busy === w.name && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Back up
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Saved backups</h2>
              <button type="button" onClick={() => desktop.openBackups(target)} className={secondary}><FolderOpen className="w-3.5 h-3.5" /> Folder</button>
            </div>
            {backups.length === 0 && <p className="text-xs text-slate-400">No backups yet.</p>}
            <ul className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {backups.map((b) => (
                <li key={b.file} className="flex items-center justify-between gap-2 rounded-lg bg-[#090C12] border border-white/[0.08] px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white truncate">{b.world}</span>
                    <span className="block text-[11px] text-slate-400 font-mono-tabular">{new Date(b.created).toLocaleString()} · {b.sizeMb} MB</span>
                  </span>
                  <span className="flex gap-1.5 shrink-0">
                    <button type="button" disabled={busy === b.file} onClick={() => restore(b)} className={secondary}>
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                    <button type="button" onClick={() => removeBackup(b)} aria-label="Delete backup" className={`${secondary} text-red-300`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'servers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">My servers</h2>
            <div className="flex flex-wrap gap-2">
              <input value={srvName} onChange={(e) => setSrvName(e.target.value)} placeholder="Name" className={`${field} w-32`} />
              <input value={srvHost} onChange={(e) => setSrvHost(e.target.value)} placeholder="play.example.com" className={`${field} flex-1 min-w-[150px]`} />
              <button type="button" onClick={addServer} className={primary}><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            {servers.length === 0 && <p className="text-xs text-slate-400">No saved servers yet.</p>}
            <ul className="space-y-1.5">
              {servers.map((x) => {
                const st = status[x.host];
                return (
                  <li key={x.host} className="flex items-center justify-between gap-2 rounded-lg bg-[#090C12] border border-white/[0.08] px-3 py-2">
                    <ServerIcon host={x.host.replace(/:\d+$/, '')} name={x.name} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white truncate">{x.name}</span>
                      <span className="block text-[11px] text-slate-400 font-mono-tabular truncate">
                        {x.host} · {st ? (st.online ? `${st.players ?? '?'}/${st.max ?? '?'} online` : 'offline') : '...'}
                      </span>
                    </span>
                    <span className="flex gap-1.5 shrink-0">
                      <button type="button" onClick={() => onJoin(x.host)} className={primary}><Play className="w-3.5 h-3.5" /> Join</button>
                      <button type="button" onClick={() => setServers((l) => l.filter((y) => y.host !== x.host))} aria-label="Remove server" className={`${secondary} text-red-300`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-orange-400" /> Friends</h2>
            <p className="text-xs text-slate-400">Save friends and the server they play on. Phoenix cannot see who is online; the number shown is the server's player count.</p>
            <div className="flex flex-wrap gap-2">
              <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Username" className={`${field} w-32`} />
              <input value={fHost} onChange={(e) => setFHost(e.target.value)} placeholder="Server (optional)" className={`${field} flex-1 min-w-[150px]`} />
              <button type="button" onClick={addFriend} className={primary}><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            <ul className="space-y-1.5">
              {friends.map((f) => (
                <li key={f.name} className="flex items-center gap-3 rounded-lg bg-[#090C12] border border-white/[0.08] px-3 py-2">
                  <img src={`https://mc-heads.net/avatar/${encodeURIComponent(f.name)}/32`} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-md shrink-0 [image-rendering:pixelated]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white truncate">{f.name}</span>
                    <span className="block text-[11px] text-slate-400 font-mono-tabular truncate">
                      {f.host ? `${f.host} · ${status[f.host]?.online ? `${status[f.host].players ?? '?'} players` : '...'}` : 'No server saved'}
                    </span>
                  </span>
                  {f.host && <button type="button" onClick={() => onJoin(f.host)} className={primary}><Play className="w-3.5 h-3.5" /> Join</button>}
                  <button type="button" onClick={() => setFriends((l) => l.filter((y) => y.name !== f.name))} aria-label="Remove friend" className={`${secondary} text-red-300`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'stats' && (
        <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-4 max-w-2xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#090C12] border border-white/[0.08] p-3">
              <div className="text-[11px] text-slate-400">Last 7 days</div>
              <div className="text-lg font-bold text-white">{fmt(weekMinutes)}</div>
            </div>
            <div className="rounded-lg bg-[#090C12] border border-white/[0.08] p-3">
              <div className="text-[11px] text-slate-400">All time</div>
              <div className="text-lg font-bold text-white">{fmt(totalMinutes)}</div>
            </div>
          </div>
          <ul className="space-y-2">
            {instances.map((i) => (
              <li key={i.id}>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="truncate">{i.name}</span>
                  <span className="font-mono-tabular text-slate-400">{fmt(i.playTimeMinutes ?? 0)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#090C12] overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${Math.round(((i.playTimeMinutes ?? 0) / maxMin) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500">Weekly time counts sessions played from this launcher version on.</p>
          <div>
            <h3 className="text-sm font-bold text-white mb-2">Achievements ({achievements.filter((a) => a.done).length}/{achievements.length})</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {achievements.map((a) => (
                <li key={a.id} className={`rounded-lg border p-3 ${a.done ? 'bg-orange-500/10 border-orange-500/40' : 'bg-[#090C12] border-white/[0.08]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold ${a.done ? 'text-orange-300' : 'text-slate-300'}`}>{a.title}</span>
                    <span className="text-[10px] text-slate-500">{a.done ? 'Unlocked' : `${Math.round(a.progress * 100)}%`}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{a.text}</p>
                  {!a.done && (
                    <div className="mt-2 h-1.5 rounded-full bg-black/40 overflow-hidden">
                      <div className="h-full bg-orange-500/70" style={{ width: `${Math.round(a.progress * 100)}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {tab === 'profile' && (
        <div className="space-y-4 max-w-xl">
        <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Keyboard className="w-4 h-4 text-orange-400" /> Notes</h2>
          <p className="text-xs text-slate-300">Anything you want to remember about {instance.name}: server logins, mod ideas, to-do.</p>
          <textarea
            value={instance.notes ?? ''}
            onChange={(e) => onUpdateInstance({ notes: e.target.value.slice(0, 4000) })}
            rows={5}
            placeholder="Write notes here..."
            className="w-full rounded-lg bg-[#090C12] border border-white/10 focus:border-orange-500/60 outline-none px-3 py-2 text-xs text-white placeholder:text-slate-500"
          />
        </section>
        <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><ImageIcon className="w-4 h-4 text-orange-400" /> Animated cape</h2>
          <p className="text-xs text-slate-300">Uses the ClientCapes mod from Modrinth. Only for Fabric on Minecraft 1.21.11. Only you can see the cape. Add a .gif or .png (2:1 ratio, 64x32 or 128x64 is best), start the game, then pick it in Mod Menu.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={instance.animatedCapes === true}
              onClick={() => onUpdateInstance({ animatedCapes: instance.animatedCapes !== true })}
              className={instance.animatedCapes === true ? primary : secondary}
            >
              {instance.animatedCapes === true ? 'On - click to turn off' : 'Off - click to turn on'}
            </button>
            <label className={`${secondary} cursor-pointer`}>
              Add cape file
              <input
                type="file"
                accept=".gif,.png,image/gif,image/png"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f || !desktop?.addCape) return say('Adding cape files needs the desktop app.', true);
                  const data = btoa(new Uint8Array(await f.arrayBuffer()).reduce((s, b) => s + String.fromCharCode(b), ''));
                  const r = await desktop.addCape({ ...target, name: f.name, data });
                  if (r.ok) say(`Cape "${r.file}" added to ${instance.name}. Pick it in Mod Menu in game.`);
                  else say(r.error || 'Could not add the cape.', true);
                }}
              />
            </label>
          </div>
          {instance.animatedCapes === true && !(instance.loader === 'fabric' && instance.mcVersion === '1.21.11') && (
            <p className="text-[11px] text-amber-300">This profile is not Fabric 1.21.11, so the mod will be skipped. Create a "Phoenix Boost 1.21.11" profile.</p>
          )}
        </section>
        <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Phoenix Client mod</h2>
          <p className="text-xs text-slate-300">HUD, fast place, fullbright, zoom and the Phoenix loading screen for {instance.name}. Switching it off parks the mod jar so the game starts as plain Minecraft. Works on Fabric or Quilt, Minecraft 1.21.4.</p>
          <button
            type="button"
            role="switch"
            aria-checked={instance.phoenixClient !== false}
            onClick={() => onUpdateInstance({ phoenixClient: instance.phoenixClient === false })}
            className={instance.phoenixClient === false ? secondary : primary}
          >
            <Flame className="w-3.5 h-3.5" /> {instance.phoenixClient === false ? 'Off - click to turn on' : 'On - click to turn off'}
          </button>
          {clientFiles && (
            <p className="text-[11px] text-slate-400">
              {clientFiles.length === 0
                ? 'Status: not installed in this profile yet. It is installed when you press Play (Fabric or Quilt, Minecraft 1.21.4).'
                : `Status: ${clientFiles.join(', ')}${clientFiles.every((f) => f.endsWith('.disabled')) ? ' (switched off)' : ' (active)'}`}
            </p>
          )}
        </section>
        <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Cpu className="w-4 h-4 text-orange-400" /> Auto RAM</h2>
          <p className="text-xs text-slate-300">Picks a RAM amount for {instance.name} from your PC's memory and the number of mods. Now: {(instance.ramMb / 1024).toFixed(1)} GB.</p>
          <button type="button" onClick={autoRam} className={primary}><Cpu className="w-3.5 h-3.5" /> Set automatically</button>
        </section>
        <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Keyboard className="w-4 h-4 text-orange-400" /> Keybind profile</h2>
          <p className="text-xs text-slate-300">Copy the custom keybinds of another profile into {instance.name}, or reset them. Close the game first.</p>
          <div className="flex flex-wrap gap-2">
            <select value={keysFrom} onChange={(e) => setKeysFrom(e.target.value)} className={`${field} flex-1 min-w-[160px]`}>
              <option value="">Copy from...</option>
              {instances.filter((i) => i.id !== instance.id).map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => copyKeys(false)} className={primary}>Copy</button>
            <button type="button" onClick={() => copyKeys(true)} className={secondary}>Reset to default</button>
          </div>
        </section>
        <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Copy className="w-4 h-4 text-orange-400" /> Duplicate this profile</h2>
          <p className="text-xs text-slate-300">Makes a full copy of {instance.name} (mods, worlds, settings, screenshots) so you can test new mods without risking the original. Logs and crash reports are not copied.</p>
          <button type="button" onClick={duplicate} disabled={busy === 'dup'} className={primary}>
            {busy === 'dup' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            Duplicate profile
          </button>
        </section>
        </div>
      )}
    </div>
  );
}
