import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FolderOpen, Loader2, Terminal, X } from 'lucide-react';
import type { MinecraftInstance, PlayerProfile } from '../types/launcher';
import { downloadInstanceLaunchScript } from '../utils/electronExporter';
import type { PhoenixProgressEvent } from '../types/phoenix-desktop';

interface LaunchModalProps {
  instance: MinecraftInstance | null;
  profile: PlayerProfile;
  javaPath: string;
  mcDir: string;
  onClose: () => void;
  onNavigateToExe: () => void;
}

type Phase = 'idle' | 'preparing' | 'running' | 'error' | 'exited';

export function LaunchModal({
  instance,
  profile,
  javaPath,
  mcDir,
  onClose,
  onNavigateToExe,
}: LaunchModalProps) {
  const desktop = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;
  const [phase, setPhase] = useState<Phase>('idle');
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState('');
  const [lines, setLines] = useState<{ text: string; level?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const startedFor = useRef<string | null>(null);

  const pushLine = (text: string, level?: string) =>
    setLines((prev) => [...prev.slice(-300), { text, level }]);

  useEffect(() => {
    if (!instance) {
      startedFor.current = null;
      setPhase('idle');
      setPercent(0);
      setLines([]);
      setError(null);
      setStatus('');
      return;
    }
    if (!desktop) return; // browser mode: sirf .bat download dikhao
    if (startedFor.current === instance.id) return;
    startedFor.current = instance.id;

    setPhase('preparing');
    setPercent(0);
    setLines([]);
    setError(null);
    pushLine(`[Phoenix] Profile "${profile.username}" (offline) ke saath ${instance.name} (${instance.mcVersion}, ${instance.loader}) launch ho raha hai...`);

    const offProgress = desktop.onProgress((e: PhoenixProgressEvent) => {
      if (e.stage === 'game-log') {
        pushLine(e.message);
        return;
      }
      if (typeof e.percent === 'number') setPercent(e.percent);
      if (e.message) {
        setStatus(e.message);
        pushLine(`[Phoenix] ${e.message}`, e.level);
      }
      if (e.stage === 'launched') setPhase('running');
    });
    const offExit = desktop.onExit((info) => {
      if (info.instanceId !== instance.id) return;
      if (info.code === 0) {
        pushLine('[Phoenix] Game band ho gaya.');
        setPhase('exited');
      } else {
        const hint = info.tail.length ? `\n${info.tail.join('\n')}` : '';
        setError(`Game crash/band hua (exit code ${info.code ?? info.signal}).${hint}\nLog file: ${info.logFile}`);
        setPhase('error');
      }
    });

    desktop
      .launchInstance({
        instance: {
          id: instance.id,
          name: instance.name,
          mcVersion: instance.mcVersion,
          loader: instance.loader,
          ramMb: instance.ramMb,
          jvmArgs: instance.jvmArgs,
          resolution: instance.resolution,
          mods: instance.mods,
        },
        username: profile.username,
        javaPath,
        dataDir: mcDir,
      })
      .then((res) => {
        if (!res.ok) {
          setError(res.error || 'Launch fail ho gaya.');
          setPhase('error');
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
      });

    return () => {
      offProgress();
      offExit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance?.id]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  if (!instance) return null;

  const busy = phase === 'preparing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-xl rounded-xl bg-[#131822] border border-white/15 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-orange-400" />
            <h2 className="text-base font-bold text-white">Launching {instance.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close launch modal"
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {desktop ? (
            <>
              {(busy || phase === 'running') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400 shrink-0" />}
                      <span className="truncate">{status || 'Shuru ho raha hai...'}</span>
                    </span>
                    <span className="font-mono-tabular text-orange-400">{percent}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )}

              <div
                ref={logRef}
                className="rounded-lg bg-[#0B0E14] border border-white/[0.08] p-3.5 font-mono-tabular text-[11px] space-y-1 h-56 overflow-y-auto"
              >
                {lines.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.level === 'error'
                        ? 'text-red-400'
                        : l.level === 'warn'
                        ? 'text-amber-300'
                        : l.text.startsWith('[Phoenix]')
                        ? 'text-slate-200'
                        : 'text-slate-500'
                    }
                  >
                    {l.text}
                  </div>
                ))}
              </div>

              {phase === 'running' && (
                <div className="flex items-start gap-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Minecraft chal raha hai</div>
                    <p className="mt-0.5 text-emerald-200/80">
                      Game window thodi der mein khul jayegi. Pehli baar assets download hone ki wajah se zyada time lagta hai.
                    </p>
                  </div>
                </div>
              )}

              {phase === 'error' && error && (
                <div className="flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold">Launch nahi ho saka</div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-red-200/90">{error}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Browser mein Minecraft launch nahi ho sakta</div>
                <p className="mt-0.5 text-amber-100/80">
                  Ye web/phone version hai: profiles, mods, skins aur FPS presets yahan set kar sakte ho, lekin game chalane ke liye
                  Windows par Phoenix Launcher .exe chahiye. Browser ya phone local Java nahi chala sakta.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToExe();
              }}
              className="text-xs font-medium text-orange-400 hover:text-orange-300"
            >
              Open .exe Export Studio
            </button>

            <div className="flex items-center gap-2">
              {desktop ? (
                <button
                  type="button"
                  onClick={() => desktop.openFolder({ dataDir: mcDir, instanceId: instance.id })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A2130] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Instance Folder
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => downloadInstanceLaunchScript(instance, profile.username, javaPath, 'bat')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .bat Launcher
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[#1A2130] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white"
              >
                {busy ? 'Background mein' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
