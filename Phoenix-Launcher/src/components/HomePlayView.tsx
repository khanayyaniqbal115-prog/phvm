import { useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FolderArchive,
  Gauge,
  Layers,
  Loader2,
  Palette,
  Play,
  Plus,
  Shield,
  Sliders,
  Sword,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  buildJvmArgs,
  estimateFpsRange,
  FPS_PRESETS,
} from '../data/presets';
import { downloadAllProjectFilesZip } from '../utils/electronExporter';
import { useMojangVersions } from '../hooks/useMojangVersions';
import type {
  FpsPresetKey,
  HardwareProfile,
  MinecraftInstance,
  ModLoader,
  PcTierMode,
  PlayerProfile,
  SkinAsset,
} from '../types/launcher';
import { SkinViewport3D } from './SkinViewport3D';
import { SkinHeadAvatar } from './SkinHeadAvatar';
import {
  ModBadgeIcon,
  PhoenixExeIcon,
  PhoenixModpacksIcon,
} from './PhoenixIcons';
import { VersionPickerModal } from './VersionPickerModal';
import packSkyIsland from '../assets/images/pack_sky_island_1794755344762.jpg';
import packVoxelTwilight from '../assets/images/pack_voxel_twilight_1794755345704.jpg';

interface HomePlayViewProps {
  instances: MinecraftInstance[];
  activeInstance: MinecraftInstance;
  activeProfile: PlayerProfile;
  activeSkin: SkinAsset;
  skins: SkinAsset[];
  hardware: HardwareProfile;
  pcTierMode: PcTierMode;
  javaPath: string;
  mcDir: string;
  onChangePcTierMode: (mode: PcTierMode) => void;
  onSelectInstance: (id: string) => void;
  onSelectCharacter: (skinId: string) => void;
  onCreateInstance: (inst: MinecraftInstance) => void;
  onUpdateInstance: (id: string, updater: (prev: MinecraftInstance) => MinecraftInstance) => void;
  onDeleteInstance: (id: string) => void;
  onApplyQuickBoost: (presetKey: FpsPresetKey) => void;
  onLaunchInstance: (id: string) => void;
  onNavigate: (view: 'modpacks' | 'skins' | 'fps' | 'export') => void;
  onToggleCape: () => void;
  onToggleSword: () => void;
}

const LOADER_OPTIONS: ModLoader[] = ['fabric', 'forge', 'neoforge', 'quilt', 'vanilla'];
const LOW_END_KEYS: FpsPresetKey[] = ['potato', 'balanced', 'competitive'];
const HIGH_END_KEYS: FpsPresetKey[] = ['esports240', 'ultra_shaders', 'distant_horizons'];

interface FeaturedServer {
  id: string;
  name: string;
  address: string;
  players: string;
  accent: string;
  emblem: 'H' | 'D' | 'M' | 'S' | '2';
}

const FEATURED_SERVERS: FeaturedServer[] = [
  { id: 'hypixel', name: 'Hypixel', address: 'mc.hypixel.net', players: '35,400', accent: '#F59E0B', emblem: 'H' },
  { id: 'donutsmp', name: 'DonutSMP', address: 'donutsmp.net', players: '31,800', accent: '#38BDF8', emblem: 'D' },
  { id: 'hoplite', name: 'Hoplite', address: 'hoplite.gg', players: '2,150', accent: '#FB923C', emblem: 'S' },
  { id: 'mcci', name: 'MCC Island', address: 'mcci.gg', players: '640', accent: '#34D399', emblem: 'M' },
  { id: '2b2t', name: '2b2t', address: 'connect.2b2t.org', players: '1,280', accent: '#94A3B8', emblem: '2' },
];

function ServerEmblem({ emblem, accent }: { emblem: FeaturedServer['emblem']; accent: string }) {
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-white/10 font-display font-extrabold text-sm"
      style={{
        backgroundColor: `${accent}1A`,
        color: accent,
      }}
    >
      {emblem}
    </div>
  );
}

export function HomePlayView({
  instances,
  activeInstance,
  activeProfile,
  activeSkin,
  skins,
  hardware,
  pcTierMode,
  javaPath,
  mcDir,
  onChangePcTierMode,
  onSelectInstance,
  onSelectCharacter,
  onCreateInstance,
  onUpdateInstance,
  onDeleteInstance,
  onApplyQuickBoost,
  onLaunchInstance,
  onNavigate,
  onToggleCape,
  onToggleSword,
}: HomePlayViewProps) {
  const { manifest, loading: versionsLoading, refresh: refreshVersions } = useMojangVersions();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInstanceMenu, setShowInstanceMenu] = useState(false);
  const [showCharacterMenu, setShowCharacterMenu] = useState(false);
  const [versionPickerTarget, setVersionPickerTarget] = useState<'active' | 'create' | null>(null);
  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState<string>('1.21.4');
  const [newLoader, setNewLoader] = useState<ModLoader>('fabric');
  const [newRam, setNewRam] = useState(pcTierMode === 'high-end' ? 16384 : 4096);
  const [copiedServerId, setCopiedServerId] = useState<string | null>(null);
  const [quickExeLoading, setQuickExeLoading] = useState(false);
  const [quickExeStatus, setQuickExeStatus] = useState<string | null>(null);
  const [quickAllZipLoading, setQuickAllZipLoading] = useState(false);
  const [quickAllZipStatus, setQuickAllZipStatus] = useState<string | null>(null);

  const enabledMods = activeInstance.mods.filter((m) => m.enabled);
  const hasSodium = enabledMods.some(
    (m) => m.slug.includes('sodium') || m.slug.includes('fabulously') || m.slug.includes('simply')
  );
  const hasShaders = enabledMods.some(
    (m) => m.projectType === 'shader' || m.slug.includes('iris') || m.slug.includes('complementary')
  );
  const fpsEstimate = estimateFpsRange(hardware, enabledMods.length, hasSodium, hasShaders);
  const activePresetKeys = pcTierMode === 'high-end' ? HIGH_END_KEYS : LOW_END_KEYS;
  const maxSliderRamMb = pcTierMode === 'high-end' || activeInstance.ramMb > 12288 ? 32768 : 12288;

  const quickProfileSlots = instances.slice(0, 2);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed =
      newName.trim() || `${newLoader === 'vanilla' ? 'Vanilla' : newLoader.toUpperCase()} ${newVersion}`;
    const created: MinecraftInstance = {
      id: `inst-${Date.now()}`,
      name: trimmed,
      mcVersion: newVersion,
      loader: newLoader,
      ramMb: newRam,
      fpsPresetId: newRam >= 12288 ? 'ultra_shaders' : newRam <= 3072 ? 'potato' : 'balanced',
      jvmArgs: buildJvmArgs(newRam, pcTierMode === 'high-end' ? 'ZGC' : 'G1GC', true),
      mods: [],
      lastPlayed: 'Never',
      playTimeMinutes: 0,
      resolution: pcTierMode === 'high-end' ? { width: 2560, height: 1440 } : { width: 1280, height: 720 },
      bannerUrl: newLoader === 'vanilla' ? packSkyIsland : packVoxelTwilight,
    };
    onCreateInstance(created);
    setNewName('');
    setShowCreateModal(false);
  };

  const handleCopyServerIp = async (srv: FeaturedServer) => {
    try {
      await navigator.clipboard.writeText(srv.address);
      setCopiedServerId(srv.id);
      window.setTimeout(() => setCopiedServerId((prev) => (prev === srv.id ? null : prev)), 1600);
    } catch {
      // Clipboard blocked
    }
  };

  const handleInstantWebSetupExe = async () => {
    setQuickExeLoading(true);
    setQuickExeStatus(null);
    try {
      const res = await fetch('/api/download/windows-lite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appUrl: window.location.origin,
          javaPath,
          instances,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.microsoft.portable-executable' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PhoenixLauncher-WebSetup.exe';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setQuickExeStatus('Saved!');
      window.setTimeout(() => setQuickExeStatus(null), 3000);
    } catch {
      onNavigate('export');
    } finally {
      setQuickExeLoading(false);
    }
  };

  const handleQuickAllFilesZip = async () => {
    setQuickAllZipLoading(true);
    setQuickAllZipStatus(null);
    try {
      const bytes = await downloadAllProjectFilesZip(instances, javaPath, mcDir);
      setQuickAllZipStatus(`Saved (${(bytes / (1024 * 1024)).toFixed(1)} MB)`);
      window.setTimeout(() => setQuickAllZipStatus(null), 3500);
    } catch {
      onNavigate('export');
    } finally {
      setQuickAllZipLoading(false);
    }
  };

  return (
    <div className="max-w-[1520px] mx-auto p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Main Stage Column (Hero + Lower Featured Row) */}
      <div className="xl:col-span-8 2xl:col-span-9 space-y-5">
        {/* FastClient-Inspired Centered 3D Character Hero */}
        <section className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0B0F17] min-h-[520px] sm:min-h-[545px] flex flex-col justify-between">
          {/* Atmospheric Backdrop + Scrims */}
          <img
            src={activeInstance.bannerUrl || packVoxelTwilight}
            alt={activeInstance.name}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-55 scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-[#090C12]/35 to-[#090C12]/70" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.14)_0%,transparent_60%)]" />

          {/* Top Hero HUD Bar (Version Selector + Hardware Tier Toggle + Cape/Sword) */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setVersionPickerTarget('active')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#090C12]/90 border border-white/15 hover:border-orange-500/60 px-3 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <span className="font-mono-tabular">Minecraft {activeInstance.mcVersion}</span>
                <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs font-mono-tabular text-slate-300">
                <span className="capitalize">{activeInstance.loader}</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="text-emerald-400 font-semibold">
                  {fpsEstimate.min}–{fpsEstimate.avg} FPS
                </span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span>{(activeInstance.ramMb / 1024).toFixed(1)} GB</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Low-End vs High-End PC Quick Switch */}
              <div className="flex items-center gap-0.5 rounded-lg bg-[#090C12]/90 border border-white/15 p-0.5">
                <button
                  type="button"
                  onClick={() => onChangePcTierMode('low-end')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    pcTierMode === 'low-end'
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Low-End PC
                </button>
                <button
                  type="button"
                  onClick={() => onChangePcTierMode('high-end')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    pcTierMode === 'high-end'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  High-End PC
                </button>
              </div>

              <button
                type="button"
                onClick={onToggleCape}
                aria-label="Toggle 3D Phoenix Cape"
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeSkin.showCape ?? true
                    ? 'bg-[#090C12]/90 border-orange-500/45 text-amber-300'
                    : 'bg-[#090C12]/80 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3 h-3" />
                Cape
              </button>

              <button
                type="button"
                onClick={onToggleSword}
                aria-label="Toggle 3D Enchanted Sword"
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeSkin.showSword ?? true
                    ? 'bg-[#090C12]/90 border-orange-500/45 text-amber-300'
                    : 'bg-[#090C12]/80 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Sword className="w-3 h-3" />
                Sword
              </button>

              <button
                type="button"
                onClick={() => onNavigate('skins')}
                className="hidden md:inline-flex items-center gap-1 rounded-lg bg-[#090C12]/90 border border-white/15 hover:border-orange-500/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Palette className="w-3 h-3 text-orange-400" />
                3D Studio
              </button>
            </div>
          </div>

          {/* Centered 3D Character Stage + Interactive Character Nametag */}
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center pt-2">
            {/* Clickable Floating Minecraft Character Nametag */}
            <div className="relative z-30 mb-[-14px]">
              <button
                type="button"
                onClick={() => setShowCharacterMenu((v) => !v)}
                aria-label="Switch Minecraft character"
                className="inline-flex items-center gap-2 rounded-md bg-[#090C12]/92 border border-white/20 hover:border-orange-400 px-3 py-1 text-xs font-mono-tabular font-semibold text-white shadow-lg transition-colors whitespace-nowrap shrink-0"
              >
                <SkinHeadAvatar
                  skinDataUrl={activeSkin.dataUrl}
                  alt={activeSkin.name}
                  size={16}
                />
                <span>{activeProfile.username}</span>
                <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
              </button>

              {showCharacterMenu && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-72 sm:w-80 rounded-xl bg-[#111620] border border-white/15 p-2 shadow-2xl z-40">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-400">
                    <span>Switch Minecraft Character</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCharacterMenu(false);
                        onNavigate('skins');
                      }}
                      className="text-orange-400 hover:text-orange-300"
                    >
                      Skin Studio
                    </button>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
                    {skins.map((skin) => {
                      const selected = skin.id === activeSkin.id;
                      return (
                        <button
                          key={skin.id}
                          type="button"
                          onClick={() => {
                            onSelectCharacter(skin.id);
                            setShowCharacterMenu(false);
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                            selected
                              ? 'bg-orange-500/20 border-orange-500/60 text-white'
                              : 'bg-[#090C12] border-white/10 text-slate-200 hover:border-white/25'
                          }`}
                        >
                          <SkinHeadAvatar
                            skinDataUrl={skin.dataUrl}
                            alt={skin.name}
                            size={24}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold truncate">{skin.name}</div>
                            <div className="text-[10px] font-mono-tabular text-slate-400">
                              {skin.modelType === 'slim' ? 'Slim 3px' : 'Classic 4px'}
                            </div>
                          </div>
                          {selected && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full max-w-[460px] h-[290px] sm:h-[315px]">
              <SkinViewport3D
                skinDataUrl={activeSkin.dataUrl}
                modelType={activeSkin.modelType}
                showOuterLayer={activeSkin.showOuterLayer}
                showCape={activeSkin.showCape ?? true}
                showSword={activeSkin.showSword ?? true}
                onToggleCape={onToggleCape}
                onToggleSword={onToggleSword}
                embeddedHero
                hideHeroControls
              />
            </div>
          </div>

          {/* Bottom Centered Split LAUNCH GAME Button + 3 Quick Profile Cards */}
          <div className="relative z-20 px-4 sm:px-6 pb-5 flex flex-col items-center gap-3.5">
            {/* Split LAUNCH GAME Primary CTA + Instance Switcher Dropdown */}
            <div className="relative">
              <div className="inline-flex items-stretch rounded-xl overflow-hidden shadow-[0_12px_36px_rgba(249,115,22,0.38)] border border-amber-300/35">
                <button
                  type="button"
                  onClick={() => onLaunchInstance(activeInstance.id)}
                  className="bg-gradient-to-b from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 px-8 sm:px-12 py-3 text-center transition-colors"
                >
                  <div className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2 whitespace-nowrap">
                    <Play className="w-4 h-4 fill-current" />
                    LAUNCH GAME
                  </div>
                  <div className="text-[11px] font-mono-tabular text-amber-50/90 truncate max-w-[230px] sm:max-w-[280px]">
                    {activeInstance.name} · {activeInstance.mcVersion} · {activeInstance.loader}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInstanceMenu((v) => !v)}
                  aria-label="Switch active instance or version"
                  className="bg-orange-600 hover:bg-orange-500 border-l border-black/20 px-3.5 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {showInstanceMenu && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 rounded-xl bg-[#111620] border border-white/15 p-1.5 shadow-2xl z-30">
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">
                    Switch Active Instance
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1">
                    {instances.map((inst) => {
                      const selected = inst.id === activeInstance.id;
                      return (
                        <button
                          key={inst.id}
                          type="button"
                          onClick={() => {
                            onSelectInstance(inst.id);
                            setShowInstanceMenu(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                            selected
                              ? 'bg-orange-500/20 text-amber-300'
                              : 'text-slate-200 hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{inst.name}</div>
                            <div className="text-[11px] font-mono-tabular text-slate-400">
                              {inst.mcVersion} · {inst.loader} · {(inst.ramMb / 1024).toFixed(1)} GB
                            </div>
                          </div>
                          {selected && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInstanceMenu(false);
                        setVersionPickerTarget('active');
                      }}
                      className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-orange-400 hover:bg-white/[0.06]"
                    >
                      Change Minecraft Version ({manifest?.versions.length ?? 'All'} builds)...
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3 Quick Profile Cards Row (2 Quick Profiles + Add a Profile) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
              {quickProfileSlots.map((inst) => {
                const isSelected = inst.id === activeInstance.id;
                return (
                  <div
                    key={inst.id}
                    onClick={() => onSelectInstance(inst.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectInstance(inst.id);
                      }
                    }}
                    className={`group relative h-[64px] rounded-xl overflow-hidden border px-3.5 py-2 flex flex-col justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-[#141B27]'
                        : 'border-white/15 bg-[#0D1119]/90 hover:border-white/35'
                    }`}
                  >
                    <img
                      src={inst.bannerUrl || packSkyIsland}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-35 transition-opacity"
                    />
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono-tabular text-amber-300/90 truncate">
                        {inst.mcVersion} · {inst.loader}
                      </span>
                      {instances.length > 1 && isSelected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteInstance(inst.id);
                          }}
                          aria-label={`Delete ${inst.name}`}
                          className="p-0.5 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="relative text-xs font-semibold text-white truncate">
                      {inst.name}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="h-[64px] rounded-xl border border-white/15 bg-[#0D1119]/90 hover:bg-[#141A26] hover:border-orange-500/50 px-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4 text-orange-400" />
                Add a Profile
              </button>
            </div>
          </div>
        </section>

        {/* Lower Row: Featured Packs & Mods + PC Performance Tuning */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Featured Packs & Active Mods */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-wider uppercase text-slate-300">
                Featured Packs &amp; Active Mods
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('modpacks')}
                className="text-xs font-medium text-orange-400 hover:text-orange-300"
              >
                Browse All Modrinth
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onChangePcTierMode('high-end');
                  onApplyQuickBoost('ultra_shaders');
                }}
                className="group relative h-28 rounded-xl overflow-hidden border border-white/10 hover:border-orange-500/60 text-left transition-all"
              >
                <img
                  src={packVoxelTwilight}
                  alt="4K Ultra Shaders Stack"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-[#090C12]/55 to-transparent" />
                <div className="relative h-full p-3.5 flex flex-col justify-end">
                  <div className="font-display text-base font-extrabold tracking-tight text-amber-300">
                    4K ULTRA SHADERS
                  </div>
                  <div className="text-xs text-slate-200">
                    Iris + Complementary + Distant Horizons
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChangePcTierMode('low-end');
                  onApplyQuickBoost('potato');
                }}
                className="group relative h-28 rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/60 text-left transition-all"
              >
                <img
                  src={packSkyIsland}
                  alt="Low-End Potato FPS Boost"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-[#090C12]/55 to-transparent" />
                <div className="relative h-full p-3.5 flex flex-col justify-end">
                  <div className="font-display text-base font-extrabold tracking-tight text-emerald-300">
                    POTATO FPS BOOST
                  </div>
                  <div className="text-xs text-slate-200">
                    Sodium + Lithium + FerriteCore 5ch
                  </div>
                </div>
              </button>
            </div>

            {/* Active Instance Mod Quick-Toggles */}
            <div className="rounded-xl bg-[#111620] border border-white/[0.08] p-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 inline-flex items-center gap-1.5 mr-1">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                Mods ({enabledMods.length}):
              </span>
              {activeInstance.mods.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigate('modpacks')}
                  className="text-xs font-medium text-orange-400 hover:text-orange-300"
                >
                  + Add FPS mods from Modrinth
                </button>
              ) : (
                activeInstance.mods.slice(0, 5).map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() =>
                      onUpdateInstance(activeInstance.id, (prev) => ({
                        ...prev,
                        mods: prev.mods.map((m) =>
                          m.id === mod.id ? { ...m, enabled: !m.enabled } : m
                        ),
                      }))
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      mod.enabled
                        ? 'bg-[#0B0E14] border-emerald-500/35 text-emerald-200'
                        : 'bg-[#0B0E14] border-white/10 text-slate-500 line-through'
                    }`}
                  >
                    <ModBadgeIcon
                      slug={mod.slug}
                      category={mod.category}
                      projectType={mod.projectType}
                      className="w-3.5 h-3.5 shrink-0"
                    />
                    {mod.title}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Performance & RAM Quick-Tuner */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-wider uppercase text-slate-300">
                Performance &amp; RAM Tuning
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('fps')}
                className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300"
              >
                <Gauge className="w-3.5 h-3.5" />
                Full Optimizer
              </button>
            </div>

            <div className="rounded-xl bg-[#111620] border border-white/[0.08] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Sliders className="w-3.5 h-3.5 text-orange-400" />
                  <span>JVM Heap Allocation</span>
                </div>
                <span className="text-xs font-mono-tabular font-semibold text-white">
                  {activeInstance.ramMb} MB ({(activeInstance.ramMb / 1024).toFixed(1)} GB)
                </span>
              </div>

              <input
                type="range"
                min={1024}
                max={maxSliderRamMb}
                step={512}
                value={activeInstance.ramMb}
                onChange={(e) => {
                  const nextRam = Number(e.target.value);
                  onUpdateInstance(activeInstance.id, (prev) => ({
                    ...prev,
                    ramMb: nextRam,
                    jvmArgs: buildJvmArgs(nextRam, hardware.gcType, hardware.usePerformanceFlags),
                  }));
                }}
                aria-label="Allocated RAM"
                className="w-full accent-orange-500 cursor-pointer"
              />

              <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Zap className="w-3 h-3 text-orange-400" />
                    {pcTierMode === 'high-end' ? 'High-End Profiles' : 'Low-End FPS Profiles'}
                  </span>
                  <span className="font-mono-tabular">
                    {hardware.renderDistance}ch · {hardware.gcType}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {activePresetKeys.map((key) => {
                    const preset = FPS_PRESETS[key];
                    const active = activeInstance.fpsPresetId === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onApplyQuickBoost(key)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-orange-500 text-slate-950 font-semibold'
                            : 'bg-[#090C12] text-slate-300 border border-white/10 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar Column (Matches FastClient Right Sidebar) */}
      <aside className="xl:col-span-4 2xl:col-span-3 space-y-3.5">
        {/* Highlight Card 1: Instant Windows Setup.exe Installer + All Files (.zip) */}
        <div className="rounded-xl bg-gradient-to-r from-[#2D387A] to-[#4338CA] border border-indigo-400/25 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div
              onClick={() => onNavigate('export')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigate('export');
                }
              }}
              className="flex items-center gap-3 min-w-0 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <PhoenixExeIcon active className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  Windows Setup.exe
                </div>
                <div className="text-xs text-indigo-100/80 truncate">
                  Installer &amp; full project zip
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={quickExeLoading}
              onClick={handleInstantWebSetupExe}
              className="rounded-lg bg-[#0B0E14]/90 hover:bg-[#0B0E14] px-3 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
            >
              {quickExeLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : quickExeStatus ? (
                quickExeStatus
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-indigo-300" />
                  INSTALL
                </>
              )}
            </button>
          </div>

          <div className="pt-2.5 border-t border-white/15 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={quickAllZipLoading}
              onClick={handleQuickAllFilesZip}
              className="flex-1 rounded-lg bg-white/12 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            >
              {quickAllZipLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Zipping...
                </>
              ) : quickAllZipStatus ? (
                quickAllZipStatus
              ) : (
                <>
                  <FolderArchive className="w-3.5 h-3.5 text-amber-300" />
                  All Files (.zip)
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('export')}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-100 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              Full .exe
            </button>
          </div>
        </div>

        {/* Highlight Card 2: Modrinth Shaders & Packs */}
        <div className="rounded-xl bg-gradient-to-r from-[#0B4F1C] to-[#15803D] border border-emerald-400/25 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <PhoenixModpacksIcon active className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">
                Modpacks &amp; Shaders
              </div>
              <div className="text-xs text-emerald-100/80 truncate">
                Modrinth live search &amp; Iris
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('modpacks')}
            className="rounded-lg bg-[#0B0E14]/90 hover:bg-[#0B0E14] px-3 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0"
          >
            BROWSE
          </button>
        </div>

        {/* Featured Servers List (Clean Tabular Counts + 1-Click Copy IP, Zero Green Dots) */}
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Featured Servers
            </h2>
            <span className="text-[11px] text-slate-500">Click to copy IP</span>
          </div>

          <div className="space-y-2">
            {FEATURED_SERVERS.map((srv) => {
              const isCopied = copiedServerId === srv.id;
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => handleCopyServerIp(srv)}
                  className="w-full rounded-xl bg-[#111620] hover:bg-[#161D2A] border border-white/[0.08] hover:border-white/20 p-3 flex items-center justify-between gap-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ServerEmblem emblem={srv.emblem} accent={srv.accent} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {srv.name}
                      </div>
                      <div className="text-xs font-mono-tabular text-slate-400 truncate">
                        {srv.address}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-xs font-mono-tabular">
                    {isCopied ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </span>
                    ) : (
                      <>
                        <span className="text-slate-300 tabular-nums">{srv.players}</span>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Create Instance Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl bg-[#131822] border border-white/15 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Create Minecraft Profile</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close modal"
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Snapshot 26.4 Fabric"
                  className="w-full rounded-lg bg-[#0B0E14] border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Minecraft Version
                  </label>
                  <button
                    type="button"
                    onClick={() => setVersionPickerTarget('create')}
                    className="w-full flex items-center justify-between rounded-lg bg-[#0B0E14] border border-white/10 hover:border-orange-500/50 px-3 py-2 text-sm text-slate-100 font-mono-tabular transition-colors"
                  >
                    <span className="truncate">{newVersion}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Modloader
                  </label>
                  <select
                    value={newLoader}
                    onChange={(e) => setNewLoader(e.target.value as ModLoader)}
                    className="w-full rounded-lg bg-[#0B0E14] border border-white/10 px-3 py-2 text-sm text-slate-100 capitalize focus:outline-none focus:border-orange-500"
                  >
                    {LOADER_OPTIONS.map((loader) => (
                      <option key={loader} value={loader}>
                        {loader}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-300">Initial RAM Allocation</span>
                  <span className="font-mono-tabular text-orange-400">{newRam} MB</span>
                </div>
                <input
                  type="range"
                  min={1536}
                  max={32768}
                  step={512}
                  value={newRam}
                  onChange={(e) => setNewRam(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400 transition-colors"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <VersionPickerModal
        open={versionPickerTarget !== null}
        selectedVersion={versionPickerTarget === 'create' ? newVersion : activeInstance.mcVersion}
        manifest={manifest}
        loading={versionsLoading}
        onRefresh={refreshVersions}
        onSelect={(verId) => {
          if (versionPickerTarget === 'create') {
            setNewVersion(verId);
          } else if (versionPickerTarget === 'active') {
            onUpdateInstance(activeInstance.id, (prev) => ({
              ...prev,
              mcVersion: verId,
            }));
          }
        }}
        onClose={() => setVersionPickerTarget(null)}
        title={
          versionPickerTarget === 'create'
            ? 'Choose Version or Snapshot for New Profile'
            : `Switch Version for ${activeInstance.name}`
        }
      />
    </div>
  );
}
