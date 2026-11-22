import { useCallback, useEffect, useState } from 'react';
import { WebModBrowser } from './WebModBrowser';
import { ArrowUpCircle, Download, FolderOpen, Loader2, PackageOpen, Puzzle, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import type { MinecraftInstance, ModLoader } from '../types/launcher';
import type { PhoenixContentType, PhoenixInstalledItem, PhoenixModHit, PhoenixModUpdate } from '../types/phoenix-desktop';

interface ModsViewProps {
  instance: MinecraftInstance;
  mcDir: string;
  onPackImported: (newId: string, info: { name: string; mcVersion: string; loader: ModLoader }) => void;
}

type Tab = 'discover' | 'installed' | 'packs';
const TYPES: { id: PhoenixContentType; label: string }[] = [
  { id: 'mod', label: 'Mods' },
  { id: 'shader', label: 'Shaders' },
  { id: 'resourcepack', label: 'Resource packs' },
];

const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold';
const primary = `${btn} bg-orange-500 text-slate-950 hover:bg-orange-400 disabled:opacity-50`;
const secondary = `${btn} bg-[#1A2130] border border-white/10 text-slate-200 hover:text-white disabled:opacity-50`;

/** Modrinth search + install, installed content with update checker, and modpack import / export (desktop app only). */
export function ModsView({ instance, mcDir, onPackImported }: ModsViewProps) {
  const desktop = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;
  const [tab, setTab] = useState<Tab>('discover');
  const [type, setType] = useState<PhoenixContentType>('mod');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PhoenixModHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string>('');
  const [items, setItems] = useState<PhoenixInstalledItem[]>([]);
  const [updates, setUpdates] = useState<PhoenixModUpdate[] | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const target = { dataDir: mcDir, instanceId: instance.id };
  const say = (text: string, error = false) => setMessage({ text, error });

  const search = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!desktop) return;
      setLoading(true);
      const res = await desktop.searchMods({ query: query.trim(), type, loader: instance.loader, mcVersion: instance.mcVersion });
      setLoading(false);
      if (res.ok) setHits(res.results);
      else say(res.error, true);
    },
    [desktop, query, type, instance.loader, instance.mcVersion]
  );

  const refreshInstalled = useCallback(async () => {
    if (!desktop) return;
    setLoading(true);
    const res = await desktop.listMods(target);
    setLoading(false);
    if (res.ok) setItems(res.items);
    else say(res.error, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop, mcDir, instance.id]);

  useEffect(() => {
    if (tab === 'discover') void search();
    if (tab === 'installed') void refreshInstalled();
    setUpdates(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, type, instance.id]);

  if (!desktop) return <WebModBrowser mcVersion={instance.mcVersion} loader={instance.loader} />;

  const install = async (h: PhoenixModHit) => {
    setBusy(h.id);
    setMessage(null);
    const res = await desktop.installMod({ ...target, projectId: h.id, type, loader: instance.loader, mcVersion: instance.mcVersion });
    setBusy('');
    if (res.ok) say(res.installed.length ? `Installed ${res.installed.join(', ')}` : `${h.title} is already installed.`);
    else say(res.error, true);
  };

  const checkUpdates = async () => {
    setBusy('updates');
    setMessage(null);
    const res = await desktop.checkModUpdates({ ...target, loader: instance.loader, mcVersion: instance.mcVersion });
    setBusy('');
    if (res.ok) {
      setUpdates(res.updates);
      if (!res.updates.length) say('Everything is up to date.');
    } else say(res.error, true);
  };

  const applyUpdates = async (list: PhoenixModUpdate[]) => {
    setBusy('apply');
    const res = await desktop.applyModUpdates({ ...target, updates: list });
    setBusy('');
    if (res.ok) {
      say(`Updated ${res.updated.join(', ')}`);
      setUpdates(null);
      void refreshInstalled();
    } else say(res.error, true);
  };

  const toggle = async (i: PhoenixInstalledItem) => {
    const res = await desktop.toggleMod({ ...target, type: i.type, file: i.file, enable: !i.enabled });
    if (!res.ok) say(res.error, true);
    void refreshInstalled();
  };

  const remove = async (i: PhoenixInstalledItem) => {
    if (!window.confirm(`Delete ${i.title}?`)) return;
    const res = await desktop.removeMod({ ...target, type: i.type, file: i.file });
    if (!res.ok) say(res.error, true);
    void refreshInstalled();
  };

  const exportPack = async () => {
    setBusy('export');
    const res = await desktop.exportPack({ ...target, name: instance.name, mcVersion: instance.mcVersion, loader: instance.loader });
    setBusy('');
    if (!res.ok) say(res.error, true);
    else if (!res.cancelled) say(`Exported ${res.mods} mods (+${res.extra} files) to ${res.file}`);
  };

  const importPack = async () => {
    const newId = `pack-${Math.random().toString(36).slice(2, 8)}`;
    setBusy('import');
    say('Downloading the pack, this can take a few minutes...');
    const res = await desktop.importPack({ dataDir: mcDir, instanceId: newId });
    setBusy('');
    if (!res.ok) return say(res.error, true);
    if (res.cancelled) return setMessage(null);
    onPackImported(newId, { name: res.name || 'Imported pack', mcVersion: res.mcVersion || instance.mcVersion, loader: (res.loader as ModLoader) || 'fabric' });
    say(`Created profile "${res.name}" with ${res.files} downloaded files.`);
  };

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
          <Puzzle className="w-5 h-5 text-orange-400" />
          <h1 className="text-xl font-bold text-white">Mods</h1>
          <span className="text-xs text-slate-400">
            {instance.name} · {instance.mcVersion} · {instance.loader}
          </span>
        </div>
        <div className="flex gap-1">
          {tabBtn('discover', 'Discover')}
          {tabBtn('installed', 'Installed')}
          {tabBtn('packs', 'Modpacks')}
        </div>
      </div>

      {instance.loader === 'vanilla' && type === 'mod' && tab !== 'packs' && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-100">
          This profile is Vanilla. Switch it to Fabric (in the Play tab) before installing mods.
        </div>
      )}

      {message && (
        <div className={`rounded-lg border p-3 text-xs break-words ${message.error ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>
          {message.text}
        </div>
      )}

      {tab === 'discover' && (
        <>
          <form onSubmit={search} className="flex flex-wrap gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as PhoenixContentType)} className="rounded-lg bg-[#111620] border border-white/10 px-3 py-2.5 text-sm text-white">
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Modrinth (sodium, iris, minimap...)"
                className="w-full rounded-lg bg-[#111620] border border-white/10 focus:border-orange-500/60 outline-none pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <button type="submit" className={primary}>Search</button>
          </form>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {hits.map((h) => (
              <article key={h.id} className="rounded-xl bg-[#111620] border border-white/10 overflow-hidden">
                {h.image && <img src={h.image} alt={`${h.title} preview`} referrerPolicy="no-referrer" loading="lazy" className="w-full h-32 object-cover" />}
                <div className="p-3 flex gap-3">
                {h.icon ? <img src={h.icon} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-lg object-cover shrink-0" /> : <div className="w-12 h-12 rounded-lg bg-[#1A2130] shrink-0" />}
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-white truncate">{h.title}</h3>
                  <p className="text-[11px] text-slate-400">by {h.author} · {h.downloads.toLocaleString('en-US')} downloads</p>
                  <p className="text-xs text-slate-300 line-clamp-2 flex-1">{h.description}</p>
                  <button type="button" disabled={busy === h.id} onClick={() => install(h)} className={`${primary} self-start`}>
                    {busy === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Install
                  </button>
                </div>
                </div>
              </article>
            ))}
          </div>
          {!loading && hits.length === 0 && <p className="text-xs text-slate-400">No results for {instance.mcVersion}. Try another search.</p>}
        </>
      )}

      {tab === 'installed' && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={checkUpdates} disabled={busy === 'updates'} className={primary}>
              {busy === 'updates' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
              Check for updates
            </button>
            <button type="button" onClick={() => void refreshInstalled()} className={secondary}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button type="button" onClick={() => desktop.openFolder(target)} className={secondary}>
              <FolderOpen className="w-3.5 h-3.5" /> Folder
            </button>
          </div>

          {updates && updates.length > 0 && (
            <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-orange-200">{updates.length} update{updates.length > 1 ? 's' : ''} available</span>
                <button type="button" disabled={busy === 'apply'} onClick={() => applyUpdates(updates)} className={primary}>
                  {busy === 'apply' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Update all
                </button>
              </div>
              <ul className="text-xs text-orange-100/90 space-y-0.5">
                {updates.map((u) => (
                  <li key={u.file}>{u.title}: {u.from || 'current'} → {u.to}</li>
                ))}
              </ul>
            </div>
          )}

          {loading && <div className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="w-4 h-4 animate-spin" /> Reading files...</div>}
          {!loading && items.length === 0 && <p className="text-xs text-slate-400">Nothing installed yet. Use Discover to add mods, shaders or resource packs.</p>}
          <ul className="space-y-1.5">
            {items.map((i) => (
              <li key={`${i.type}-${i.file}`} className="flex items-center gap-3 rounded-lg bg-[#111620] border border-white/[0.08] px-3 py-2">
                {i.icon ? <img src={i.icon} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-md shrink-0" /> : <div className="w-8 h-8 rounded-md bg-[#1A2130] shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold truncate ${i.enabled ? 'text-white' : 'text-slate-500 line-through'}`}>{i.title}</div>
                  <div className="text-[11px] text-slate-400 font-mono-tabular truncate">
                    {i.type} · {i.version || i.file} · {i.sizeKb} KB ·{' '}
                    {i.projectId ? <span className="text-emerald-400">Verified on Modrinth</span> : <span className="text-amber-300" title="Not found on Modrinth. Only keep files from sources you trust.">Unverified</span>}
                  </div>
                </div>
                <button type="button" onClick={() => toggle(i)} className={secondary}>{i.enabled ? 'Disable' : 'Enable'}</button>
                <button type="button" onClick={() => remove(i)} aria-label={`Delete ${i.title}`} className={`${secondary} text-red-300`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'packs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2"><PackageOpen className="w-4 h-4 text-orange-400" /> Export this profile</h2>
            <p className="text-xs text-slate-300">Creates a <b>.mrpack</b> file with your mods, shaders, resource packs, config and options. Send it to a friend; they can import it here or in Modrinth-compatible launchers.</p>
            <button type="button" onClick={exportPack} disabled={busy === 'export'} className={primary}>
              {busy === 'export' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export .mrpack
            </button>
          </section>
          <section className="rounded-xl bg-[#111620] border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2"><Upload className="w-4 h-4 text-orange-400" /> Import a modpack</h2>
            <p className="text-xs text-slate-300">Pick a <b>.mrpack</b> file. Phoenix creates a new profile with the right Minecraft version and loader, then downloads everything.</p>
            <button type="button" onClick={importPack} disabled={busy === 'import'} className={primary}>
              {busy === 'import' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Import .mrpack
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
