import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, FolderOpen, Terminal, X } from 'lucide-react';
import type { MinecraftInstance } from '../types/launcher';
import type { RuntimeState } from '../hooks/useLauncherRuntime';

interface LaunchModalProps {
  instance: MinecraftInstance | null;
  runtime?: RuntimeState;
  isDesktop: boolean;
  mcDir: string;
  onClose: () => void;
  onNavigateToExe: () => void;
}

/** Shows the launch log for an instance, or explains that the browser version cannot start the game. */
export function LaunchModal({ instance, runtime, isDesktop, mcDir, onClose, onNavigateToExe }: LaunchModalProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const lines = runtime?.lines ?? [];

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines.length]);

  if (!instance) return null;
  const desktop = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-xl rounded-xl bg-[#131822] border border-white/15 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-orange-400" />
            <h2 className="text-base font-bold text-white">{instance.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isDesktop ? (
            <>
              <div
                ref={logRef}
                className="rounded-lg bg-[#0B0E14] border border-white/[0.08] p-3.5 font-mono-tabular text-[11px] space-y-1 h-64 overflow-y-auto"
              >
                {lines.length === 0 && <div className="text-slate-500">No log output yet. Press Launch to start.</div>}
                {lines.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.level === 'error'
                        ? 'text-red-400'
                        : l.level === 'warn'
                        ? 'text-amber-300'
                        : l.game
                        ? 'text-slate-500'
                        : 'text-slate-200'
                    }
                  >
                    {l.text}
                  </div>
                ))}
              </div>

              {runtime?.phase === 'running' && (
                <div className="flex items-start gap-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Minecraft is running</div>
                    <p className="mt-0.5 text-emerald-200/80">The game window opens in a moment. The first launch takes longer while assets download.</p>
                  </div>
                </div>
              )}

              {runtime?.phase === 'error' && runtime.error && (
                <div className="flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold">Launch failed</div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-red-200/90">{runtime.error}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Minecraft cannot start in a browser</div>
                <p className="mt-0.5 text-amber-100/80">
                  This is the web version: you can manage accounts, mods, skins and FPS presets here, but starting the game needs the
                  Phoenix Launcher desktop app for Windows. A browser or phone cannot run Java.
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
              {desktop && (
                <button
                  type="button"
                  onClick={() => desktop.openFolder({ dataDir: mcDir, instanceId: instance.id })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A2130] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Instance folder
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[#1A2130] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
