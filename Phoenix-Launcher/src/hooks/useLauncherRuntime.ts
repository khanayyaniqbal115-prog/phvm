import { useCallback, useEffect, useRef, useState } from 'react';
import type { PhoenixLaunchPayload } from '../types/phoenix-desktop';
import { readStored } from '../utils/prefs';

export type RuntimePhase = 'idle' | 'launching' | 'running' | 'error';

export interface RuntimeLine {
  text: string;
  level?: 'warn' | 'error';
  game?: boolean;
}

export interface RuntimeState {
  phase: RuntimePhase;
  percent: number;
  status: string;
  lines: RuntimeLine[];
  error?: string;
}

const EMPTY: RuntimeState = { phase: 'idle', percent: 0, status: '', lines: [] };
const MAX_LINES = 400;

/** Tracks launch progress, running state and logs for every profile (works only in the desktop app). */
export function useLauncherRuntime(onSessionEnd?: (id: string, minutes: number) => void) {
  const sessionStart = useRef<Record<string, number>>({});
  const endCb = useRef(onSessionEnd);
  endCb.current = onSessionEnd;
  const [runtime, setRuntime] = useState<Record<string, RuntimeState>>({});
  const desktop = typeof window !== 'undefined' ? window.phoenixDesktop : undefined;

  const patch = useCallback((id: string, fn: (prev: RuntimeState) => RuntimeState) => {
    setRuntime((prev) => ({ ...prev, [id]: fn(prev[id] ?? EMPTY) }));
  }, []);

  useEffect(() => {
    if (!desktop) return;
    const offProgress = desktop.onProgress((e) => {
      const id = e.instanceId;
      if (!id) return;
      patch(id, (prev) => {
        if (e.stage === 'game-log') {
          return { ...prev, lines: [...prev.lines.slice(-MAX_LINES), { text: e.message, game: true }] };
        }
        const next: RuntimeState = {
          ...prev,
          percent: typeof e.percent === 'number' ? e.percent : prev.percent,
          status: e.message || prev.status,
          lines: e.message
            ? [...prev.lines.slice(-MAX_LINES), { text: e.message, level: e.level }]
            : prev.lines,
        };
        if (e.stage === 'launched') {
          next.phase = 'running';
          sessionStart.current[id] = Date.now();
        }
        else if (e.stage === 'error') {
          next.phase = 'error';
          next.error = e.message;
        } else if (e.stage === 'cancelled') {
          next.phase = 'idle';
          next.percent = 0;
          next.status = '';
        }
        return next;
      });
    });
    const offExit = desktop.onExit((info) => {
      const id = info.instanceId;
      if (!id) return;
      const started = sessionStart.current[id];
      if (started) {
        delete sessionStart.current[id];
        const minutes = Math.round((Date.now() - started) / 60000);
        if (minutes > 0) endCb.current?.(id, minutes);
      }
      patch(id, (prev) => {
        if (info.code === 0 || info.stoppedByUser) {
          return {
            ...prev,
            phase: 'idle',
            percent: 0,
            status: '',
            lines: [...prev.lines, { text: info.stoppedByUser ? 'Game stopped.' : 'Game closed.' }],
          };
        }
        const hint = info.tail.length ? `\n${info.tail.join('\n')}` : '';
        return {
          ...prev,
          phase: 'error',
          error: `The game closed unexpectedly (exit code ${info.code ?? info.signal}).${hint}\nLog file: ${info.logFile}`,
        };
      });
    });
    return () => {
      offProgress();
      offExit();
    };
  }, [desktop, patch]);

  const launch = useCallback(
    async (id: string, payload: PhoenixLaunchPayload) => {
      if (!desktop) return;
      patch(id, () => ({
        phase: 'launching',
        percent: 0,
        status: 'Starting...',
        lines: [{ text: `Launching ${payload.instance.name} (${payload.instance.mcVersion}, ${payload.instance.loader}) as ${payload.auth.username}` }],
      }));
      try {
        const res = await desktop.launchInstance({ ...payload, backupOnExit: readStored<boolean>('phoenix-backup-exit', true) });
        if (!res.ok && !res.cancelled) {
          patch(id, (prev) => ({ ...prev, phase: 'error', error: res.error || 'Launch failed.' }));
        }
      } catch (err) {
        patch(id, (prev) => ({ ...prev, phase: 'error', error: err instanceof Error ? err.message : String(err) }));
      }
    },
    [desktop, patch]
  );

  const stop = useCallback(
    async (id: string) => {
      if (!desktop) return;
      patch(id, (prev) => ({ ...prev, status: 'Stopping...' }));
      await desktop.stopInstance(id);
      // If the exit event never arrives, return the button to Launch after a few seconds.
      window.setTimeout(() => {
        patch(id, (prev) =>
          prev.phase === 'running' || prev.phase === 'launching' ? { ...prev, phase: 'idle', percent: 0, status: '' } : prev
        );
      }, 5000);
    },
    [desktop, patch]
  );

  const dismissError = useCallback(
    (id: string) => patch(id, (prev) => ({ ...prev, phase: 'idle', error: undefined, percent: 0, status: '' })),
    [patch]
  );

  return { runtime, launch, stop, dismissError, isDesktop: Boolean(desktop) };
}
