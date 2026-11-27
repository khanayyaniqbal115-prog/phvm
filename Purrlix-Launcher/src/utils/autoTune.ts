import { buildJvmArgs } from '../data/presets';
import type { MinecraftInstance } from '../types/launcher';

export interface PcSpecs {
  totalMemMb: number;
  cpus: number;
}

/**
 * Picks safe starting settings from the PC's real RAM and CPU threads: a heap that leaves room for Windows and the launcher,
 * a lighter FPS preset and window size on weak PCs, and the G1 garbage collector (the smoothest choice on 2-8 thread CPUs).
 */
export function autoTuneFor(spec: PcSpecs): Pick<MinecraftInstance, 'ramMb' | 'jvmArgs' | 'fpsPresetId' | 'resolution' | 'autoFpsMods'> {
  const { totalMemMb, cpus } = spec;
  const weak = totalMemMb <= 8192 || cpus <= 4;
  const veryWeak = totalMemMb <= 6144 || cpus <= 2;
  const maxHeap = veryWeak ? 3072 : weak ? 4096 : 8192;
  const ramMb = Math.max(2048, Math.min(maxHeap, Math.round((totalMemMb * 0.4) / 512) * 512));
  return {
    ramMb,
    jvmArgs: buildJvmArgs(ramMb, 'G1GC', true),
    fpsPresetId: veryWeak ? 'potato' : 'balanced',
    resolution: weak ? { width: 1280, height: 720 } : { width: 1920, height: 1080 },
    autoFpsMods: true,
  };
}

export function describeTune(spec: PcSpecs): string {
  const t = autoTuneFor(spec);
  return `${(t.ramMb / 1024).toFixed(1)} GB RAM, ${t.resolution.width}x${t.resolution.height}, ${t.fpsPresetId} preset (PC: ${Math.round(spec.totalMemMb / 1024)} GB RAM, ${spec.cpus} CPU threads)`;
}
