import { autoTuneFor, describeTune } from '../utils/autoTune';
import { makeShareCode, readShareCode } from '../utils/shareCode';
import { useStored } from '../utils/prefs';
import { useEffect, useState } from 'react';
import { useServerStatus } from '../hooks/useServerStatus';
import { ServerIcon } from './ServerIcon';
import {
  Check,
  Copy,
  ChevronDown,
  Gauge,
  Layers,
  Loader2,
  Palette,
  Play,
  Plus,
  Shield,
  Sliders,
  Square,
  Terminal,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  buildJvmArgs,
  estimateFpsRange,
  FPS_PRESETS,
} from '../data/presets';
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
import { SkinViewport3D, type SkinAnimationMode } from './SkinViewport3D';
import type { RuntimeState } from '../hooks/useLauncherRuntime';
import { SkinHeadAvatar } from './SkinHeadAvatar';
import {
  ModBadgeIcon,
  PhoenixModpacksIcon,
} from './PhoenixIcons';
import { VersionPickerModal } from './VersionPickerModal';
import phoenixEmblem from '../assets/images/phoenix_launcher_emblem_1794755342786.jpg';
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
  runtime?: RuntimeState;
  onLaunchInstance: (id: string) => void;
  onStopInstance: (id: string) => void;
  onShowLogs: (id: string) => void;
  onJoinServer?: (host: string) => void;
  onNavigate: (view: 'modpacks' | 'worlds' | 'skins' | 'fps' | 'export') => void;
  onToggleCape: () => void;
  onToggleSword?: () => void;
}

const BOOST_VERSIONS = ['1.21.1', '1.21.2', '1.21.3', '1.21.4', '1.21.5', '1.21.6', '1.21.7', '1.21.8', '1.21.9', '1.21.10', '1.21.11'];
const LOADER_OPTIONS: ModLoader[] = ['fabric', 'forge', 'neoforge', 'quilt', 'vanilla'];
const LOW_END_KEYS: FpsPresetKey[] = ['potato', 'balanced', 'competitive'];
const HIGH_END_KEYS: FpsPresetKey[] = ['esports240', 'ultra_shaders', 'distant_horizons'];

interface FeaturedServer {
  id: string;
  name: string;
  address: string;
  accent: string;
  emblem: 'H' | 'D' | 'M' | 'S' | '2';
}

const FEATURED_SERVERS: FeaturedServer[] = [
  { id: 'hypixel', name: 'Hypixel', address: 'mc.hypixel.net', accent: '#F59E0B', emblem: 'H' },
  { id: 'donutsmp', name: 'DonutSMP', address: 'donutsmp.net', accent: '#38BDF8', emblem: 'D' },
  { id: 'hoplite', name: 'Hoplite', address: 'mc.hoplite.gg', accent: '#FB923C', emblem: 'S' },
  { id: 'mcci', name: 'MCC Island', address: 'play.mccisland.net', accent: '#34D399', emblem: 'M' },
  { id: '2b2t', name: '2b2t', address: 'connect.2b2t.org', accent: '#94A3B8', emblem: '2' },
];

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
  runtime,
  onLaunchInstance,
  onStopInstance,
  onShowLogs,
  onJoinServer,
  onNavigate,
  onToggleCape,
}: HomePlayViewProps) {
  const { manifest, loading: versionsLoading, refresh: refreshVersions } = useMojangVersions();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAllMods, setShowAllMods] = useState(false);
  const [heroAnim, setHeroAnim] = useState<SkinAnimationMode | 'auto'>('auto');
  const [autoAnim, setAutoAnim] = useState<SkinAnimationMode>('idle');
  useEffect(() => {
    if (heroAnim !== 'auto') return;
    const seq: SkinAnimationMode[] = ['idle', 'wave', 'walk', 'idle', 'run'];
    let i = 0;
    const t = window.setInterval(() => {
      i = (i + 1) % seq.length;
      setAutoAnim(seq[i]);
    }, 3500);
    return () => window.clearInterval(t);
  }, [heroAnim]);
  const phase = runtime?.phase ?? 'idle';
  const launching = phase === 'launching';
  const running = phase === 'running';
  const percent = Math.max(0, Math.min(100, Math.round(runtime?.percent ?? 0)));
  const [customServers, setCustomServers] = useState<FeaturedServer[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('phoenix_custom_servers') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [newServerName, setNewServerName] = useState('');
  const [newServerHost, setNewServerHost] = useState('');
  const allServers = [...FEATURED_SERVERS, ...customServers];
  const { status: serverStatus } = useServerStatus(allServers.map((x) => x.address));
  const saveCustomServers = (list: FeaturedServer[]) => {
    setCustomServers(list);
    try {
      localStorage.setItem('phoenix_custom_servers', JSON.stringify(list));
    } catch {
      /* storage blocked */
    }
  };
  const addCustomServer = (e: React.FormEvent) => {
    e.preventDefault();
    const host = newServerHost.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    if (!/^[a-z0-9.-]{3,80}$/.test(host)) return;
    const name = newServerName.trim() || host;
    saveCustomServers([...customServers, { id: `custom-${Date.now()}`, name, address: host, accent: '#A78BFA', emblem: 'S' }]);
    setNewServerName('');
    setNewServerHost('');
  };
  const [shareText, setShareText] = useState('');
  const [shareNote, setShareNote] = useState('');
  const copyShareCode = async () => {
    try {
      await navigator.clipboard.writeText(makeShareCode(activeInstance));
      setShareNote('Share code copied. Send it to a friend.');
    } catch {
      setShareNote('Could not copy. Allow clipboard access and try again.');
    }
  };
  const importShareCode = () => {
    const r = readShareCode(shareText);
    if (!r.ok) {
      setShareNote(r.error);
      return;
    }
    onCreateInstance(r.instance);
    setShareText('');
    setShareNote(`Created "${r.instance.name}". Mods download when you press Play.`);
  };
  const [perfNote, setPerfNote] = useState('');
  const [backupExit, setBackupExit] = useStored<boolean>('phoenix-backup-exit', true);
  const copyPerfReport = async () => {
    const d = window.phoenixDesktop;
    if (!d) return;
    const r = await d.perfReport({
      dataDir: mcDir,
      instanceId: activeInstance.id,
      instance: { name: activeInstance.name, loader: activeInstance.loader, mcVersion: activeInstance.mcVersion, ramMb: activeInstance.ramMb },
    });
    if (!r.ok) {
      setPerfNote(r.error || 'Could not build the report.');
      return;
    }
    try {
      await navigator.clipboard.writeText(r.text);
      setPerfNote('Report copied. Paste it in Discord or a bug report.');
    } catch {
      setPerfNote('Could not copy. Allow clipboard access and try again.');
    }
  };
  const [tuneNote, setTuneNote] = useState('');
  const autoTune = async () => {
    const info = await window.phoenixDesktop?.getInfo();
    const spec = { totalMemMb: info?.totalMemMb ?? 8192, cpus: info?.cpus ?? 4 };
    onUpdateInstance(activeInstance.id, (prev) => ({ ...prev, ...autoTuneFor(spec) }));
    setTuneNote(`Set: ${describeTune(spec)}`);
  };
  const suggestRam = async () => {
    const info = await window.phoenixDesktop?.getInfo();
    const totalMb = info?.totalMemMb ?? 8192;
    const ram = Math.max(2048, Math.min(16384, Math.round((totalMb * 0.4) / 512) * 512));
    onUpdateInstance(activeInstance.id, (prev) => ({
      ...prev,
      ramMb: ram,
      jvmArgs: buildJvmArgs(ram, pcTierMode === 'high-end' ? 'ZGC' : 'G1GC', true),
    }));
  };
  const [showInstanceMenu, setShowInstanceMenu] = useState(false);
  const [showCharacterMenu, setShowCharacterMenu] = useState(false);
  const [versionPickerTarget, setVersionPickerTarget] = useState<'active' | 'create' | null>(null);
  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState<string>('1.21.4');
  const [newLoader, setNewLoader] = useState<ModLoader>('fabric');
  const [newRam, setNewRam] = useState(pcTierMode === 'high-end' ? 8192 : 3072);
  const [copiedServerId, setCopiedServerId] = useState<string | null>(null);

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
      fpsPresetId: newName.startsWith('Phoenix Boost') ? 'balanced' : newRam >= 12288 ? 'ultra_shaders' : newRam <= 3072 ? 'potato' : 'balanced',
      autoFpsMods: true,
      animatedCapes: newName.startsWith('Phoenix Boost') && newVersion === '1.21.11' && newLoader === 'fabric',
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

  return (
    <div className="max-w-[1520px] mx-auto p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Main Stage Column (Hero + Lower Featured Row) */}
      <div className="xl:col-span-8 2xl:col-span-9 space-y-5">
        {/* FastClient-Inspired Centered 3D Character Hero */}
        <section className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0B0F17] min-h-[600px] sm:min-h-[640px] flex flex-col justify-between">
          {/* Atmospheric Backdrop + Scrims */}
          <img
            src={activeInstance.bannerUrl || packVoxelTwilight}
            alt={activeInstance.name}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-55 scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-[#090C12]/35 to-[#090C12]/70" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.14)_0%,transparent_60%)]" />

          {/* Launch animation: one ring + pulsing emblem while the game starts */}
          {launching && (
            <div className="phx-fade-in absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#090C12]/70 backdrop-blur-md">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="url(#phxRing)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 * (1 - percent / 100)}
                    style={{ transition: 'stroke-dashoffset .5s ease' }}
                  />
                  <defs>
                    <linearGradient id="phxRing" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#FDE047" />
                      <stop offset="1" stopColor="#F97316" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="phx-orbit absolute inset-0" aria-hidden="true">
                  <span className="absolute left-1/2 -top-1 w-3 h-3 -ml-1.5 rounded-full bg-amber-300 shadow-[0_0_14px_6px_rgba(251,191,36,0.55)]" />
                </div>
                <img
                  src={phoenixEmblem}
                  alt=""
                  className="phx-pulse absolute inset-6 w-[calc(100%-3rem)] h-[calc(100%-3rem)] rounded-3xl object-cover shadow-[0_0_40px_rgba(249,115,22,0.5)]"
                />
              </div>
              <div className="text-center">
                <div className="font-display text-4xl font-extrabold text-white tabular-nums">{percent}%</div>
                <div className="mt-1 text-sm text-amber-100/90 max-w-[320px] truncate">{runtime?.status || 'Preparing...'}</div>
              </div>
              <button
                type="button"
                onClick={() => onStopInstance(activeInstance.id)}
                className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Cancel
              </button>
            </div>
          )}

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
                  Est. {fpsEstimate.min}–{fpsEstimate.avg} FPS
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

            <div className="w-full max-w-[520px] h-[330px] sm:h-[390px]">
              <SkinViewport3D
                skinDataUrl={activeSkin.dataUrl}
                modelType={activeSkin.modelType}
                showOuterLayer={activeSkin.showOuterLayer}
                showCape={activeSkin.showCape ?? true}
                showSword={false}
                onToggleCape={onToggleCape}
                embeddedHero
                hideHeroControls
                animation={launching ? 'run' : running ? 'wave' : heroAnim === 'auto' ? autoAnim : heroAnim}
              />
            </div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#090C12]/85 border border-white/10 p-1">
              {(['auto', 'idle', 'walk', 'run', 'wave'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setHeroAnim(mode)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors ${
                    heroAnim === mode ? 'bg-orange-500 text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Centered Split LAUNCH GAME Button + 3 Quick Profile Cards */}
          <div className="relative z-20 px-4 sm:px-6 pb-5 flex flex-col items-center gap-3.5">
            {/* Split LAUNCH GAME Primary CTA + Instance Switcher Dropdown */}
            <div className="relative">
              <div className={`inline-flex items-stretch rounded-xl overflow-hidden border border-amber-300/35 ${launching || running ? "shadow-[0_12px_36px_rgba(225,29,72,0.35)]" : "shadow-[0_12px_36px_rgba(249,115,22,0.45)]"}`}>
                <button
                  type="button"
                  onClick={() => (launching || running ? onStopInstance(activeInstance.id) : onLaunchInstance(activeInstance.id))}
                  aria-label={launching || running ? 'Stop game' : 'Launch game'}
                  className={`phx-launch relative overflow-hidden min-w-[250px] sm:min-w-[320px] px-8 sm:px-12 py-3.5 text-center transition-colors ${
                    launching || running
                      ? 'bg-gradient-to-b from-rose-600 to-red-800 hover:from-rose-500 hover:to-red-700'
                      : 'bg-gradient-to-b from-amber-400 via-orange-500 to-orange-700 hover:from-amber-300 hover:to-orange-600'
                  }`}
                >
                  {/* gloss + moving shine for depth */}
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
                  {!launching && !running && <span className="phx-shine pointer-events-none absolute inset-y-0 w-16 -skew-x-12 bg-white/25" />}
                  {launching && (
                    <>
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-amber-300/45 to-orange-300/70 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                      <span className="phx-stripes pointer-events-none absolute inset-0 opacity-30" />
                    </>
                  )}
                  <div className="relative font-display text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2 whitespace-nowrap drop-shadow">
                    {launching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        STARTING... {percent}%
                      </>
                    ) : running ? (
                      <>
                        <Square className="w-4 h-4 fill-current" />
                        STOP
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        LAUNCH GAME
                      </>
                    )}
                  </div>
                  <div className="relative text-[11px] font-mono-tabular text-amber-50/90 truncate max-w-[230px] sm:max-w-[300px] mx-auto">
                    {launching
                      ? runtime?.status || 'Preparing...'
                      : running
                      ? `${activeInstance.name} is running`
                      : `${activeInstance.name} · ${activeInstance.mcVersion} · ${activeInstance.loader}`}
                  </div>
                  {launching && (
                    <span className="absolute bottom-0 left-0 h-[3px] bg-white/90 transition-all duration-500" style={{ width: `${percent}%` }} />
                  )}
                </button>

                {(launching || running || phase === 'error') && (
                  <button
                    type="button"
                    onClick={() => onShowLogs(activeInstance.id)}
                    aria-label="Show launch log"
                    className="bg-black/35 hover:bg-black/50 border-l border-black/20 px-3 flex items-center justify-center text-white transition-colors"
                  >
                    <Terminal className="w-4 h-4" />
                  </button>
                )}

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
                (showAllMods ? activeInstance.mods : activeInstance.mods.slice(0, 5)).map((mod) => (
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
                    <span
                      aria-hidden
                      className={`ml-1 inline-flex w-6 h-3.5 rounded-full p-0.5 transition-colors ${mod.enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-white" />
                    </span>
                  </button>
                ))
              )}
              {activeInstance.mods.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllMods((v) => !v)}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold text-orange-300 border border-orange-500/30 hover:bg-orange-500/10"
                >
                  {showAllMods ? 'See less' : `See more (${activeInstance.mods.length - 5})`}
                </button>
              )}
              {activeInstance.mods.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const turnOn = activeInstance.mods.some((m) => !m.enabled);
                    onUpdateInstance(activeInstance.id, (prev) => ({
                      ...prev,
                      mods: prev.mods.map((m) => ({ ...m, enabled: turnOn })),
                    }));
                  }}
                  className="ml-auto text-[11px] text-slate-400 hover:text-white"
                >
                  {activeInstance.mods.some((m) => !m.enabled) ? 'Turn all on' : 'Turn all off'}
                </button>
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

                {window.phoenixDesktop && (
                  <button
                    type="button"
                    onClick={suggestRam}
                    className="w-full rounded-lg bg-[#1A2130] border border-white/10 hover:border-orange-500/50 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:text-white"
                  >
                    Recommend RAM for my PC
                  </button>
                )}
                {window.phoenixDesktop && (
                  <>
                    <button
                      type="button"
                      onClick={autoTune}
                      className="w-full rounded-lg bg-orange-500 hover:bg-orange-400 px-2.5 py-2 text-xs font-bold text-slate-950"
                    >
                      Auto-tune this profile for my PC
                    </button>
                    {tuneNote && <p className="text-[10px] text-emerald-300">{tuneNote}</p>}
                    <button
                      type="button"
                      onClick={copyPerfReport}
                      className="w-full rounded-lg bg-[#1A2130] border border-white/10 hover:border-orange-500/50 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
                    >
                      Copy lag report (PC + mods + log)
                    </button>
                    {perfNote && <p className="text-[10px] text-slate-300">{perfNote}</p>}
                    <label className="flex items-center justify-between gap-3 rounded-lg bg-[#090C12] border border-white/10 px-2.5 py-2 text-xs text-slate-200">
                      <span>Back up worlds when the game closes</span>
                      <input type="checkbox" checked={backupExit} onChange={(e) => setBackupExit(e.target.checked)} />
                    </label>
                  </>
                )}

                <div className="space-y-1.5 rounded-lg bg-[#090C12] border border-white/10 p-2.5">
                  <div className="text-xs font-semibold text-slate-200">Share this profile</div>
                  <button
                    type="button"
                    onClick={copyShareCode}
                    className="w-full rounded-lg bg-[#1A2130] border border-white/10 hover:border-orange-500/50 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
                  >
                    Copy share code
                  </button>
                  <div className="flex gap-1.5">
                    <input
                      value={shareText}
                      onChange={(e) => setShareText(e.target.value)}
                      placeholder="Paste a PHX1... code"
                      aria-label="Share code"
                      className="min-w-0 flex-1 rounded-md bg-[#1A2130] border border-white/10 px-2 py-1 text-xs text-white placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      disabled={!shareText.trim()}
                      onClick={importShareCode}
                      className="rounded-md bg-orange-500 px-2.5 py-1 text-xs font-bold text-slate-950 disabled:opacity-50"
                    >
                      Import
                    </button>
                  </div>
                  {shareNote && <p className="text-[10px] text-slate-300">{shareNote}</p>}
                </div>

                <label className="flex items-center justify-between gap-3 rounded-lg bg-[#090C12] border border-white/10 px-2.5 py-2 text-xs text-slate-200">
                  <span className="min-w-0">
                    <span className="block font-semibold">Game resolution</span>
                    <span className="block text-[10px] text-slate-400">Window size when Minecraft starts. Lower = more FPS.</span>
                  </span>
                  <select
                    aria-label="Game resolution"
                    value={`${activeInstance.resolution?.width ?? 1280}x${activeInstance.resolution?.height ?? 720}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      onUpdateInstance(activeInstance.id, (prev) => ({ ...prev, resolution: { width: w, height: h } }));
                    }}
                    className="rounded-md bg-[#1A2130] border border-white/10 px-2 py-1 text-xs text-white"
                  >
                    {[[854, 480], [1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440]].map(([w, h]) => (
                      <option key={`${w}x${h}`} value={`${w}x${h}`}>{w} x {h}</option>
                    ))}
                    {![[854, 480], [1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440]].some(
                      ([w, h]) => w === activeInstance.resolution?.width && h === activeInstance.resolution?.height
                    ) && activeInstance.resolution && (
                      <option value={`${activeInstance.resolution.width}x${activeInstance.resolution.height}`}>
                        {activeInstance.resolution.width} x {activeInstance.resolution.height} (custom)
                      </option>
                    )}
                  </select>
                </label>

                <label className="flex items-center justify-between gap-3 rounded-lg bg-[#090C12] border border-white/10 px-2.5 py-2 text-xs text-slate-200">
                  <span className="min-w-0">
                    <span className="block font-semibold">Shaders (one click)</span>
                    <span className="block text-[10px] text-slate-400">Installs Iris + Complementary on Fabric. Lite is light, High needs a good GPU.</span>
                  </span>
                  <select
                    aria-label="Shader preset"
                    value={activeInstance.shaderPreset ?? 'off'}
                    onChange={(e) =>
                      onUpdateInstance(activeInstance.id, (prev) => ({ ...prev, shaderPreset: e.target.value as 'off' | 'lite' | 'high' }))
                    }
                    className="rounded-md bg-[#1A2130] border border-white/10 px-2 py-1 text-xs text-white"
                  >
                    <option value="off">Off</option>
                    <option value="lite">Lite (low GPU)</option>
                    <option value="high">High (strong GPU)</option>
                  </select>
                </label>

                <label className="flex items-center justify-between gap-3 rounded-lg bg-[#090C12] border border-white/10 px-2.5 py-2 text-xs text-slate-200 cursor-pointer">
                  <span className="min-w-0">
                    <span className="block font-semibold">Auto-install FPS mods</span>
                    <span className="block text-[10px] text-slate-400">Sodium, Lithium, ImmediatelyFast and more on Fabric/Quilt</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={activeInstance.autoFpsMods ?? true}
                    onChange={(e) =>
                      onUpdateInstance(activeInstance.id, (prev) => ({ ...prev, autoFpsMods: e.target.checked }))
                    }
                    className="accent-orange-500 w-4 h-4 shrink-0"
                  />
                </label>

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
        {/* Quick links */}
        <button
          type="button"
          onClick={() => onNavigate('modpacks')}
          className="w-full rounded-xl bg-gradient-to-r from-[#0B4F1C] to-[#15803D] border border-emerald-400/25 p-4 flex items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <PhoenixModpacksIcon active className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white truncate">Mods &amp; Modpacks</span>
              <span className="block text-xs text-emerald-100/80 truncate">Search Modrinth and install in one click</span>
            </span>
          </span>
          <span className="rounded-lg bg-[#0B0E14]/90 px-3 py-2 text-xs font-bold text-white shrink-0">BROWSE</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('skins')}
          className="w-full rounded-xl bg-gradient-to-r from-[#7C2D12] to-[#EA580C] border border-orange-300/25 p-4 flex items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5 text-white" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white truncate">Skins &amp; Capes</span>
              <span className="block text-xs text-orange-100/85 truncate">3D studio with the Phoenix cape</span>
            </span>
          </span>
          <span className="rounded-lg bg-[#0B0E14]/90 px-3 py-2 text-xs font-bold text-white shrink-0">OPEN</span>
        </button>

        {/* Servers with live player counts */}
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Featured servers</h2>
            <span className="text-[11px] text-slate-500">Live players · click to copy IP</span>
          </div>

          <div className="space-y-2">
            {allServers.map((srv) => {
              const isCopied = copiedServerId === srv.id;
              const st = serverStatus[srv.address];
              const known = st && st.online && st.players !== null;
              return (
                <div
                  key={srv.id}
                  className="w-full rounded-xl bg-[#111620] hover:bg-[#161D2A] border border-white/[0.08] hover:border-white/20 p-3 flex items-center justify-between gap-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ServerIcon host={srv.address} name={srv.name} accent={srv.accent} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{srv.name}</div>
                      <div className="text-xs font-mono-tabular text-slate-400 truncate">{srv.address}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-xs font-mono-tabular">
                    <button
                      type="button"
                      onClick={() => handleCopyServerIp(srv)}
                      aria-label={`Copy ${srv.name} address`}
                      className="p-1 text-slate-500 hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {onJoinServer && window.phoenixDesktop && !launching && !running && (
                      <button
                        type="button"
                        onClick={() => onJoinServer(srv.address)}
                        className="rounded-md bg-orange-500 hover:bg-orange-400 px-2 py-1 text-[11px] font-bold text-slate-950"
                      >
                        JOIN
                      </button>
                    )}
                    {isCopied ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </span>
                    ) : (
                      <>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            known ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]' : st ? 'bg-red-500' : 'bg-slate-600 animate-pulse'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="text-slate-200 tabular-nums">
                          {known ? st.players!.toLocaleString('en-US') : st ? 'Offline' : '...'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={addCustomServer} className="flex gap-1.5">
            <input
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
              placeholder="Name"
              className="w-1/3 rounded-lg bg-[#111620] border border-white/10 px-2.5 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-orange-500/60"
            />
            <input
              value={newServerHost}
              onChange={(e) => setNewServerHost(e.target.value)}
              placeholder="server.address.net"
              className="flex-1 min-w-0 rounded-lg bg-[#111620] border border-white/10 px-2.5 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-orange-500/60"
            />
            <button type="submit" className="rounded-lg bg-[#1A2130] border border-white/10 px-3 text-xs font-semibold text-slate-200 hover:text-white">
              Add
            </button>
          </form>
          {customServers.length > 0 && (
            <button
              type="button"
              onClick={() => saveCustomServers([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 px-1"
            >
              Remove my servers
            </button>
          )}
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

            <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
              <div className="text-xs font-bold text-white">Phoenix Boost (FPS pack)</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Fabric profile with Sodium, Lithium, FerriteCore, EntityCulling and ImmediatelyFast. Pick a version:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BOOST_VERSIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setNewVersion(v);
                      setNewLoader('fabric');
                      setNewName(`Phoenix Boost ${v}`);
                      setNewRam((r) => Math.min(Math.max(r, 3072), 6144));
                    }}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono-tabular border ${newVersion === v && newLoader === 'fabric' && newName === `Phoenix Boost ${v}` ? 'bg-orange-500 text-[#1a0e05] border-orange-500' : 'bg-[#0B0E14] text-slate-200 border-white/10 hover:border-orange-500/50'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
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
