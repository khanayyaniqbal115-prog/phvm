import { useRef, useState } from 'react';
import { Bell, ClipboardCopy, Download, Gauge, Palette, Upload } from 'lucide-react';
import { ACCENT_KEY, LITE_KEY, UI_SCALE_KEY, applyAppearance, isWeakPc, useStored } from '../utils/prefs';

interface SettingsExtrasProps {
  version: string;
  dataDir: string;
  totalMemMb: number;
}

const BACKUP_VERSION = 1;

/** Appearance, notifications, backup and support tools for the Settings page. */
export function SettingsExtras({ version, dataDir, totalMemMb }: SettingsExtrasProps) {
  const [lite, setLite] = useStored<boolean>(LITE_KEY, isWeakPc());
  const [scale, setScale] = useStored<number>(UI_SCALE_KEY, 100);
  const [accent, setAccent] = useStored<string>(ACCENT_KEY, '');
  const [notify, setNotify] = useStored<boolean>('phoenix-notify', true);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const change = <T,>(setter: (v: T) => void, v: T) => {
    setter(v);
    // localStorage is written by the setter; apply on the next tick so the new value is read
    window.setTimeout(applyAppearance, 0);
  };

  const exportData = () => {
    const data: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('phoenix')) data[k] = localStorage.getItem(k) ?? '';
      }
    } catch {
      setNote('Could not read the launcher data.');
      return;
    }
    const blob = new Blob([JSON.stringify({ phoenixBackup: BACKUP_VERSION, version, data })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `phoenix-launcher-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNote('Backup saved. It holds profiles, skins, settings and play history (not the game files).');
  };

  const importData = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setNote('That file is too big to be a Purrlix backup.');
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as { phoenixBackup?: number; data?: Record<string, unknown> };
      if (parsed.phoenixBackup !== BACKUP_VERSION || !parsed.data || typeof parsed.data !== 'object') throw new Error('bad file');
      let count = 0;
      for (const [k, v] of Object.entries(parsed.data)) {
        if (!k.startsWith('phoenix') || typeof v !== 'string') continue;
        localStorage.setItem(k, v);
        count++;
      }
      setNote(`Restored ${count} items. Reloading...`);
      window.setTimeout(() => window.location.reload(), 800);
    } catch {
      setNote('That is not a Purrlix Launcher backup file.');
    }
  };

  const copyInfo = async () => {
    const lines = [
      `Purrlix Launcher v${version}`,
      `Data folder: ${dataDir || 'default'}`,
      `RAM: ${(totalMemMb / 1024).toFixed(1)} GB, CPU threads: ${navigator.hardwareConcurrency || '?'}`,
      `System: ${navigator.userAgent}`,
      `Lite mode: ${lite}, UI size: ${scale}%`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setNote('System info copied. Paste it into your bug report.');
    } catch {
      setNote('Could not copy. Select the text yourself:\n' + lines.join('\n'));
    }
  };

  const toggleNotify = (on: boolean) => {
    setNotify(on);
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
  };

  const btn = 'inline-flex items-center gap-1.5 rounded-lg bg-[#1E1536] border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white';
  const check = 'w-4 h-4 accent-orange-500';

  return (
    <>
      <section className="phx-glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Palette className="w-4 h-4 text-orange-400" /> Appearance</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-300" htmlFor="phx-accent">Accent colour</label>
          <input
            id="phx-accent"
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#8B5CF6'}
            onChange={(e) => change(setAccent, e.target.value)}
            className="h-8 w-12 rounded border border-white/10 bg-transparent"
          />
          {accent && (
            <button type="button" className={btn} onClick={() => change(setAccent, '')}>Back to the theme colour</button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-300" htmlFor="phx-scale">UI size</label>
          <input
            id="phx-scale"
            type="range"
            min={90}
            max={125}
            step={5}
            value={scale}
            onChange={(e) => change(setScale, Number(e.target.value))}
            className="accent-orange-500"
          />
          <span className="text-xs text-slate-400 w-10">{scale}%</span>
        </div>
        <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" className={`${check} mt-0.5`} checked={lite} onChange={(e) => change(setLite, e.target.checked)} />
          <span>
            <span className="font-semibold text-white flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-orange-400" /> Lite mode</span>
            Turns off animations and blur. It starts on by itself on PCs with 4 CPU threads or less. Turn it on if the game lags while the launcher is open.
          </span>
        </label>
      </section>

      <section className="phx-glass rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Bell className="w-4 h-4 text-orange-400" /> Notifications</h2>
        <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" className={`${check} mt-0.5`} checked={notify} onChange={(e) => toggleNotify(e.target.checked)} />
          <span>Show a desktop message when Minecraft has started or closed (only while the launcher is in the background).</span>
        </label>
      </section>

      <section className="phx-glass rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Download className="w-4 h-4 text-orange-400" /> Backup and support</h2>
        <p className="text-xs text-slate-400">A backup holds your profiles, skins, accounts list, settings and play history. Game files and worlds are not included (use Library &gt; Backups for worlds).</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={exportData}><Download className="w-3.5 h-3.5" /> Export launcher data</button>
          <button type="button" className={btn} onClick={() => fileRef.current?.click()}><Upload className="w-3.5 h-3.5" /> Import launcher data</button>
          <button type="button" className={btn} onClick={copyInfo}><ClipboardCopy className="w-3.5 h-3.5" /> Copy system info</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void importData(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {note && <p className="text-xs text-amber-200 whitespace-pre-wrap">{note}</p>}
      </section>
    </>
  );
}
