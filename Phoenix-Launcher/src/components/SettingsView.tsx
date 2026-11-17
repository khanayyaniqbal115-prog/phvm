import { useEffect, useState } from 'react';
import { FolderOpen, Settings } from 'lucide-react';

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

  const field = 'w-full rounded-lg bg-[#090C12] border border-white/10 focus:border-orange-500/60 outline-none px-3 py-2.5 text-sm text-white placeholder:text-slate-500';

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
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A2130] border border-white/10 px-3 text-xs font-medium text-slate-200 hover:text-white shrink-0"
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

      {info && (
        <section className="phx-glass rounded-xl p-5 text-xs text-slate-300 space-y-1 font-mono-tabular">
          <div>Phoenix Launcher v{info.version}</div>
          <div>Installed RAM: {(info.totalMemMb / 1024).toFixed(1)} GB</div>
        </section>
      )}
    </div>
  );
}
