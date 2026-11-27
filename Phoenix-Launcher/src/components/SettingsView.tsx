import { useEffect, useState } from 'react';
import { Download, FolderOpen, Loader2, Newspaper, RefreshCw, Settings } from 'lucide-react';
import type { PhoenixNewsItem } from '../types/phoenix-desktop';
import { THEMES, applyTheme, useStored } from '../utils/prefs';
import { SettingsExtras } from './SettingsExtras';

interface SettingsViewProps {
  javaPath: string;
  mcDir: string;
  onChangeJavaPath: (value: string) => void;
  onChangeMcDir: (value: string) => void;
}

/** Java and data-folder settings. Both are optional: empty means automatic. */
export function SettingsView({ javaPath, mcDir, onChangeJavaPath, onChangeMcDir }: SettingsViewProps) {
  const desktop = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;
  const [info, setInfo] = useState<{ version: string; dataDir: string; totalMemMb: number } | null>(null);

  useEffect(() => {
    void desktop?.getInfo().then((i) => setInfo({ version: i.version, dataDir: i.dataDir, totalMemMb: i.totalMemMb }));
  }, [desktop]);

  const [theme, setTheme] = useStored<string>('phoenix-theme', 'phoenix');
  const [hideOnLaunch, setHideOnLaunch] = useStored<boolean>('phoenix-hide-on-launch', false);
  const [installClient, setInstallClient] = useStored<boolean>('phoenix-install-client', true);
  const [news, setNews] = useState<PhoenixNewsItem[]>([]);
  const [update, setUpdate] = useState<{ latest?: string; newer?: boolean } | null>(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    void desktop?.getNews().then((r) => r.ok && setNews(r.news));
    void desktop?.checkUpdate().then((r) => r.ok && setUpdate({ latest: r.latest, newer: r.newer }));
  }, [desktop]);

  const recheck = async () => {
    if (!desktop) return;
    setBusy('check');
    const r = await desktop.checkUpdate();
    setBusy('');
    if (r.ok) setUpdate({ latest: r.latest, newer: r.newer });
    setNote(r.ok ? (r.newer ? `Version ${r.latest} is available.` : 'You are on the latest version.') : 'Could not reach GitHub.');
  };

  const install = async () => {
    if (!desktop) return;
    setBusy('install');
    setNote('Downloading the update...');
    const r = await desktop.installUpdate();
    setBusy('');
    if (!r.ok) setNote(r.error);
  };

  const field = 'w-full rounded-lg bg-[#07040D] border border-white/10 focus:border-orange-500/60 outline-none px-3 py-2.5 text-sm text-white placeholder:text-slate-500';

  return (
    <div className="max-w-2xl mx-auto p-1 space-y-5">
      <div className="flex items-center gap-2.5">
        <Settings className="w-5 h-5 text-orange-400" />
        <h1 className="text-xl font-bold text-white">Settings</h1>
      </div>

      <section className="phx-glass rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-white mb-1.5" htmlFor="java-path">Java path</label>
          <div className="flex gap-2">
            <input id="java-path" value={javaPath} onChange={(e) => onChangeJavaPath(e.target.value)} placeholder="Automatic (Phoenix finds or downloads Java)" className={field} />
            {desktop && (
              <button
                type="button"
                onClick={async () => {
                  const picked = await desktop.pickJavaExecutable();
                  if (picked) onChangeJavaPath(picked);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E1536] border border-white/10 px-3 text-xs font-medium text-slate-200 hover:text-white shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Leave empty unless you want a specific Java installation.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-white mb-1.5" htmlFor="data-dir">Game data folder</label>
          <input id="data-dir" value={mcDir} onChange={(e) => onChangeMcDir(e.target.value)} placeholder={info?.dataDir || 'Automatic (%APPDATA%\\.phoenix-launcher)'} className={field} />
          <p className="mt-1.5 text-xs text-slate-400">Versions, libraries, assets and profiles are stored here. Leave empty for the default.</p>
        </div>
      </section>

      <section className="phx-glass rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white mb-2">Theme</h2>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTheme(t.id);
                  applyTheme(t.id);
                }}
                aria-pressed={theme === t.id}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${theme === t.id ? 'border-white/40 text-white bg-white/10' : 'border-white/10 text-slate-300 hover:text-white'}`}
              >
                <span className="w-3.5 h-3.5 rounded-full" style={{ background: t.swatch }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {desktop && (
          <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={installClient} onChange={(e) => setInstallClient(e.target.checked)} className="mt-0.5 accent-orange-500" />
            <span>
              <span className="block text-sm font-semibold text-white">Install Phoenix Client in Fabric 1.21.4 profiles</span>
              Adds the Phoenix HUD, Fast Place, Fullbright and the Phoenix loading screen (needs a release with the mod attached).
            </span>
          </label>
        )}
        {desktop && (
          <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={hideOnLaunch} onChange={(e) => setHideOnLaunch(e.target.checked)} className="mt-0.5 accent-orange-500" />
            <span>
              <span className="block text-sm font-semibold text-white">Hide the launcher while the game runs</span>
              It goes to the tray when the game starts and comes back when the game closes.
            </span>
          </label>
        )}
      </section>

      {desktop && (
        <section className="phx-glass rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Updates</h2>
            <div className="flex gap-2">
              <button type="button" onClick={recheck} disabled={busy !== ''} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E1536] border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white disabled:opacity-50">
                {busy === 'check' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Check
              </button>
              {update?.newer && (
                <button type="button" onClick={install} disabled={busy !== ''} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
                  {busy === 'install' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Update to {update.latest}
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">{note || (update?.newer ? `Version ${update.latest} is available.` : 'Phoenix checks GitHub for new versions. The installer downloads and starts for you.')}</p>
        </section>
      )}

      {news.length > 0 && (
        <section className="phx-glass rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Newspaper className="w-4 h-4 text-orange-400" /> What's new</h2>
          {news.map((n) => (
            <article key={n.tag} className="border-t border-white/[0.08] pt-3 first:border-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{n.name}</h3>
                <span className="text-[11px] text-slate-500 shrink-0">{n.date ? new Date(n.date).toLocaleDateString() : ''}</span>
              </div>
              {n.body && <p className="mt-1 text-xs text-slate-400 whitespace-pre-wrap line-clamp-6">{n.body}</p>}
              <button type="button" onClick={() => desktop?.openExternal(n.url)} className="mt-1 text-[11px] text-orange-400 hover:text-orange-300">Open release page</button>
            </article>
          ))}
        </section>
      )}

      <SettingsExtras version={info?.version ?? ''} dataDir={info?.dataDir ?? ''} totalMemMb={info?.totalMemMb ?? 0} />

      {info && (
        <section className="phx-glass rounded-xl p-5 text-xs text-slate-300 space-y-1 font-mono-tabular">
          <div>Purrlix Launcher v{info.version}</div>
          <div>Installed RAM: {(info.totalMemMb / 1024).toFixed(1)} GB</div>
        </section>
      )}
    </div>
  );
}
