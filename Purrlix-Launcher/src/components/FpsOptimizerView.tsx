import { useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Check,
  Copy,
  Cpu,
  Gauge,
  Loader2,
  Send,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  buildJvmArgs,
  estimateFpsRange,
  FPS_PRESETS,
} from '../data/presets';
import type {
  AiDiagnosticResult,
  FpsPresetKey,
  GcType,
  GpuTier,
  HardwareProfile,
  MinecraftInstance,
  PcTierMode,
} from '../types/launcher';

interface FpsOptimizerViewProps {
  hardware: HardwareProfile;
  pcTierMode: PcTierMode;
  activeInstance: MinecraftInstance;
  onChangePcTierMode: (mode: PcTierMode) => void;
  onUpdateHardware: (updater: (prev: HardwareProfile) => HardwareProfile) => void;
  onApplyToInstance: (
    instanceId: string,
    ramMb: number,
    jvmArgs: string,
    presetId: FpsPresetKey | 'custom'
  ) => void;
  onApplyQuickBoost: (presetKey: FpsPresetKey) => void;
  onAddCoreFpsMods: (instanceId: string) => void;
  onAddUltraShaderStack: (instanceId: string) => void;
}

const LOW_END_PROMPTS = [
  'My 4GB RAM Intel UHD laptop stutters every 5 seconds in 1.20.1 Fabric — what JVM flags and mods fix it?',
  'Optimize this active instance for steady 60 FPS on an older dual-core CPU without breaking multiplayer.',
  'Compare G1GC vs ZGC for my current hardware and tell me if I allocated too much RAM.',
];

const HIGH_END_PROMPTS = [
  'Tune Generational ZGC and 16GB heap for RTX 4090 + 32GB RAM running Complementary Shaders and Distant Horizons at 32 chunks.',
  'How do I lock 240+ FPS with zero micro-stutter on a 240Hz monitor using Sodium, Lithium, and Nvidium?',
  'What heap size and thread flags prevent Distant Horizons LOD generation stutter during 4K recording?',
];

export function FpsOptimizerView({
  hardware,
  pcTierMode,
  activeInstance,
  onChangePcTierMode,
  onUpdateHardware,
  onApplyToInstance,
  onApplyQuickBoost,
  onAddCoreFpsMods,
  onAddUltraShaderStack,
}: FpsOptimizerViewProps) {
  const [appliedToast, setAppliedToast] = useState(false);
  const [stackToast, setStackToast] = useState<'core' | 'shader' | null>(null);
  const [question, setQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiDiagnosticResult | null>(null);
  const [copiedAiFlags, setCopiedAiFlags] = useState(false);

  const enabledMods = activeInstance.mods.filter((m) => m.enabled);
  const hasSodium = enabledMods.some(
    (m) => m.slug.includes('sodium') || m.slug.includes('fabulously') || m.slug.includes('simply')
  );
  const hasShaders = enabledMods.some(
    (m) => m.projectType === 'shader' || m.slug.includes('iris') || m.slug.includes('complementary')
  );
  const estimate = estimateFpsRange(hardware, enabledMods.length, hasSodium, hasShaders);

  const recommendedRamMb = Math.min(
    estimate.maxRamSafeMb,
    activeInstance.ramMb > estimate.maxRamSafeMb ? estimate.maxRamSafeMb : activeInstance.ramMb
  );
  const previewJvmArgs = buildJvmArgs(
    recommendedRamMb,
    hardware.gcType,
    hardware.usePerformanceFlags
  );

  const handleSelectPreset = (presetKey: FpsPresetKey) => {
    onApplyQuickBoost(presetKey);
    setAppliedToast(true);
    window.setTimeout(() => setAppliedToast(false), 2000);
  };

  const handleApplyCurrent = () => {
    onApplyToInstance(activeInstance.id, recommendedRamMb, previewJvmArgs, 'custom');
    setAppliedToast(true);
    window.setTimeout(() => setAppliedToast(false), 2000);
  };

  const handleRunDiagnosis = async (promptText?: string) => {
    const q = (promptText ?? question).trim();
    if (!q) return;
    if (promptText) setQuestion(promptText);

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          hardware: { ...hardware, pcTierMode },
          instance: {
            name: activeInstance.name,
            mcVersion: activeInstance.mcVersion,
            loader: activeInstance.loader,
            ramMb: activeInstance.ramMb,
            mods: activeInstance.mods.map((m) => ({
              title: m.title,
              version: m.version,
              enabled: m.enabled,
            })),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setAiResult(data as AiDiagnosticResult);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to run AI optimization analysis.');
    } finally {
      setAiLoading(false);
    }
  };

  const ramWarning = activeInstance.ramMb > estimate.maxRamSafeMb;
  const samplePrompts = pcTierMode === 'high-end' ? HIGH_END_PROMPTS : LOW_END_PROMPTS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">
            PC Hardware &amp; FPS Optimizer
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Switch between Low-End laptop FPS tuning and High-End 4K Ultra Shader / 240Hz profiles for{' '}
            <span className="text-slate-200 font-medium">{activeInstance.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-[#160F27] border border-white/10 p-1">
            <button
              type="button"
              onClick={() => onChangePcTierMode('low-end')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                pcTierMode === 'low-end'
                  ? 'bg-orange-500 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Low-End PC
            </button>
            <button
              type="button"
              onClick={() => onChangePcTierMode('high-end')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                pcTierMode === 'high-end'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              High-End PC
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onAddCoreFpsMods(activeInstance.id);
              setStackToast('core');
              window.setTimeout(() => setStackToast(null), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E1536] border border-white/10 px-3 py-2 text-xs font-medium text-slate-100 hover:border-orange-500/50 transition-colors whitespace-nowrap shrink-0"
          >
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            {stackToast === 'core' ? 'Core FPS Added' : 'Add Core FPS Mods'}
          </button>

          <button
            type="button"
            onClick={() => {
              onAddUltraShaderStack(activeInstance.id);
              setStackToast('shader');
              window.setTimeout(() => setStackToast(null), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E1536] border border-amber-500/35 px-3 py-2 text-xs font-medium text-amber-200 hover:border-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {stackToast === 'shader' ? 'Shader Stack Added' : 'Add Ultra Shader Stack'}
          </button>

          <button
            type="button"
            onClick={handleApplyCurrent}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-400 transition-colors whitespace-nowrap shrink-0"
          >
            {appliedToast ? <Check className="w-3.5 h-3.5" /> : <Sliders className="w-3.5 h-3.5" />}
            {appliedToast ? 'Applied' : 'Apply to Instance'}
          </button>
        </div>
      </div>

      {/* Hardware Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-[#160F27] border border-white/[0.08] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Projected Frame Rate</span>
            <Gauge className="w-4 h-4 text-orange-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-white">
            {estimate.min} – {estimate.avg} FPS
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {hasShaders
              ? 'Iris Shaders + Sodium PBR pipeline active'
              : hasSodium
              ? 'Sodium/Optimization pipeline active'
              : 'Add Core FPS Mods or Ultra Shader Stack for optimized frames'}
          </p>
        </div>

        <div className="rounded-xl bg-[#160F27] border border-white/[0.08] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Safe Heap Ceiling</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-white">
            {estimate.maxRamSafeMb} MB ({(estimate.maxRamSafeMb / 1024).toFixed(0)} GB)
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Reserves OS &amp; GPU VRAM headroom from your {hardware.systemRamGb} GB RAM
          </p>
        </div>

        <div className="rounded-xl bg-[#160F27] border border-white/[0.08] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Memory Health Check</span>
            {ramWarning ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-white">
            {activeInstance.ramMb} MB Allocated
          </div>
          <p className={`mt-1 text-xs ${ramWarning ? 'text-amber-300' : 'text-emerald-300'}`}>
            {ramWarning
              ? 'Warning: Exceeds safe OS ceiling and may trigger paging stutter'
              : `Nominal: Tuned for ${hardware.gcType} on ${hardware.renderDistance}ch render`}
          </p>
        </div>
      </div>

      {/* Presets + Sliders */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 space-y-5">
          {/* High-End & Low-End Presets */}
          <div className="rounded-xl bg-[#160F27] border border-white/[0.08] p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-amber-300">
                High-End Gaming &amp; Content Creator Presets
              </h2>
              <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['esports240', 'ultra_shaders', 'distant_horizons'] as const).map((key) => {
                  const preset = FPS_PRESETS[key];
                  const isActive = activeInstance.fpsPresetId === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectPreset(key)}
                      className={`text-left rounded-lg border p-3.5 transition-colors ${
                        isActive
                          ? 'bg-[#1E1536] border-amber-400/70'
                          : 'bg-[#09060F] border-white/[0.08] hover:border-amber-500/40'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white">{preset.label}</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                        {preset.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06]">
              <h2 className="text-sm font-semibold text-slate-200">
                Low-End &amp; Laptop Presets
              </h2>
              <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['potato', 'balanced', 'competitive'] as const).map((key) => {
                  const preset = FPS_PRESETS[key];
                  const isActive = activeInstance.fpsPresetId === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectPreset(key)}
                      className={`text-left rounded-lg border p-3.5 transition-colors ${
                        isActive
                          ? 'bg-[#1E1536] border-orange-500/60'
                          : 'bg-[#09060F] border-white/[0.08] hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-100">{preset.label}</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                        {preset.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hardware & Graphics Tuning */}
          <div className="rounded-xl bg-[#160F27] border border-white/[0.08] p-5 space-y-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Your PC Specs &amp; Video Tuning
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  GPU Class
                </label>
                <select
                  value={hardware.gpuTier}
                  onChange={(e) =>
                    onUpdateHardware((prev) => ({ ...prev, gpuTier: e.target.value as GpuTier }))
                  }
                  className="w-full rounded-lg bg-[#09060F] border border-white/10 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                >
                  <option value="integrated_low">Intel UHD / Celeron iGPU</option>
                  <option value="integrated_modern">Radeon Vega / Iris Xe</option>
                  <option value="dedicated_entry">GTX 1050 / 1650 / RX 570</option>
                  <option value="dedicated_mid">RTX 3060 / RX 6600+</option>
                  <option value="dedicated_high">RTX 4070 / RX 7800 XT (1440p)</option>
                  <option value="dedicated_ultra">RTX 4090 / 5090 / RX 7900 XTX</option>
                  <option value="creator_workstation">Creator Workstation (4K Shader + Record)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  System RAM (GB)
                </label>
                <select
                  value={hardware.systemRamGb}
                  onChange={(e) =>
                    onUpdateHardware((prev) => ({ ...prev, systemRamGb: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg bg-[#09060F] border border-white/10 px-3 py-2 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-orange-500"
                >
                  {[4, 6, 8, 12, 16, 24, 32, 48, 64].map((gb) => (
                    <option key={gb} value={gb}>
                      {gb} GB RAM
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Garbage Collector
                </label>
                <select
                  value={hardware.gcType}
                  onChange={(e) =>
                    onUpdateHardware((prev) => ({ ...prev, gcType: e.target.value as GcType }))
                  }
                  className="w-full rounded-lg bg-[#09060F] border border-white/10 px-3 py-2 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-orange-500"
                >
                  <option value="G1GC">G1GC (4–12GB Balanced)</option>
                  <option value="ZGC">Generational ZGC (Zero Pause 16–32GB)</option>
                  <option value="Shenandoah">Shenandoah GC</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300">Render Distance</span>
                  <span className="font-mono-tabular text-orange-400">
                    {hardware.renderDistance} chunks
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={32}
                  value={hardware.renderDistance}
                  onChange={(e) =>
                    onUpdateHardware((prev) => ({
                      ...prev,
                      renderDistance: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300">Simulation Distance</span>
                  <span className="font-mono-tabular text-orange-400">
                    {hardware.simulationDistance} chunks
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={24}
                  value={hardware.simulationDistance}
                  onChange={(e) =>
                    onUpdateHardware((prev) => ({
                      ...prev,
                      simulationDistance: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!hardware.entityShadows}
                  onChange={(e) =>
                    onUpdateHardware((prev) => ({ ...prev, entityShadows: !e.target.checked }))
                  }
                  className="accent-orange-500 rounded"
                />
                Disable Entity Shadows (+10% FPS)
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hardware.usePerformanceFlags}
                  onChange={(e) =>
                    onUpdateHardware((prev) => ({
                      ...prev,
                      usePerformanceFlags: e.target.checked,
                    }))
                  }
                  className="accent-orange-500 rounded"
                />
                AlwaysPreTouch, LargePages &amp; Low-Latency GC Flags
              </label>
            </div>
          </div>
        </div>

        {/* Right: AI High-Thinking Diagnostic Advisor */}
        <div className="xl:col-span-5 rounded-xl bg-[#160F27] border border-white/[0.08] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-slate-100">
                  AI Deep Bottleneck Advisor
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                High-thinking diagnostic engine for both low-end stutter and high-end 4K shader / Distant Horizons tuning.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {samplePrompts.map((sample) => (
              <button
                key={sample}
                type="button"
                disabled={aiLoading}
                onClick={() => handleRunDiagnosis(sample)}
                className="w-full text-left rounded-lg bg-[#09060F] border border-white/[0.06] px-3 py-2 text-xs text-slate-300 hover:border-orange-500/40 hover:text-white transition-colors"
              >
                {sample}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRunDiagnosis();
            }}
            className="space-y-2.5"
          >
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Describe your PC specs (e.g. RTX 4080 / 32GB RAM or Intel UHD / 8GB), FPS target, or shaders..."
              className="w-full rounded-lg bg-[#09060F] border border-white/10 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={aiLoading || !question.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-400 disabled:opacity-50 transition-colors"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deep Reasoning in Progress...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Analyze Bottleneck
                </>
              )}
            </button>
          </form>

          {aiError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
              {aiError}
            </div>
          )}

          {aiResult && (
            <div className="space-y-3 pt-2 border-t border-white/[0.08]">
              {aiResult.fallbackNotice && (
                <p className="text-[11px] text-amber-300">{aiResult.fallbackNotice}</p>
              )}

              <div>
                <div className="text-xs font-semibold text-slate-100">Diagnosis Summary</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{aiResult.summary}</p>
                <div className="mt-1.5 text-xs font-mono-tabular text-emerald-400">
                  Expected Gain: {aiResult.estimatedFpsGain}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200">Recommended JVM Flags</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(aiResult.recommendedJvmFlags);
                        setCopiedAiFlags(true);
                        window.setTimeout(() => setCopiedAiFlags(false), 1500);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
                    >
                      {copiedAiFlags ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedAiFlags ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyToInstance(
                          activeInstance.id,
                          activeInstance.ramMb,
                          aiResult.recommendedJvmFlags,
                          'custom'
                        );
                        setAppliedToast(true);
                        window.setTimeout(() => setAppliedToast(false), 2000);
                      }}
                      className="text-[11px] font-medium text-orange-400 hover:text-orange-300"
                    >
                      Apply to Instance
                    </button>
                  </div>
                </div>
                <pre className="rounded-lg bg-[#09060F] border border-white/[0.08] p-2.5 text-[11px] font-mono-tabular text-slate-300 whitespace-pre-wrap break-all">
                  {aiResult.recommendedJvmFlags}
                </pre>
              </div>

              {aiResult.recommendedMods?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-200">Recommended Mods</div>
                  <p className="mt-1 text-xs text-slate-300">
                    {aiResult.recommendedMods.join(' · ')}
                  </p>
                </div>
              )}

              {aiResult.actionSteps?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-200">Action Plan</div>
                  <ol className="mt-1.5 space-y-1 text-xs text-slate-300 list-decimal list-inside">
                    {aiResult.actionSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {aiResult.conflictWarnings?.length > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-200">
                  <div className="font-semibold mb-1">Warnings</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {aiResult.conflictWarnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
