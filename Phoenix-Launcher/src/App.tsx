import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import phoenixEmblem from './assets/images/phoenix_launcher_emblem_1794755342786.jpg';
import packVoxelTwilight from './assets/images/pack_voxel_twilight_1794755345704.jpg';
import {
  buildJvmArgs,
  DEFAULT_HARDWARE_PROFILE,
  FPS_PRESETS,
  HIGH_END_DEFAULT_HARDWARE,
  INITIAL_INSTANCES,
} from './data/presets';
import type {
  FpsPresetKey,
  HardwareProfile,
  InstalledMod,
  LauncherView,
  MinecraftInstance,
  ModLoader,
  ModrinthHit,
  PcTierMode,
  PlayerProfile,
  SkinAsset,
} from './types/launcher';
import { createInitialSkins } from './utils/skinGenerator';
import { HomePlayView } from './components/HomePlayView';
import { ModpacksView } from './components/ModpacksView';
import { SkinStudioView } from './components/SkinStudioView';
import { FpsOptimizerView } from './components/FpsOptimizerView';
import { SettingsView } from './components/SettingsView';
import { LaunchModal } from './components/LaunchModal';
import { AccountModal } from './components/AccountModal';
import { Globe2, Settings, Puzzle, Images } from 'lucide-react';
import { ModsView } from './components/ModsView';
import { LibraryView } from './components/LibraryView';
import { WorldsView } from './components/WorldsView';
import { DiscordChip } from './components/DiscordChip';
import { RecorderButton } from './components/RecorderButton';
import { applyAppearance, applyTheme, logPlaySession, readStored } from './utils/prefs';
import { CHANGELOG_VERSION } from './utils/changelog';
import { CommandPalette, type PaletteItem } from './components/CommandPalette';
import { WhatsNewModal } from './components/WhatsNewModal';
import { WebBanner } from './components/WebBanner';
import { SpotifyBar } from './components/SpotifyBar';
import { createCapePngBase64 } from './utils/capeArt';
import { useLauncherRuntime } from './hooks/useLauncherRuntime';
import { SkinHeadAvatar } from './components/SkinHeadAvatar';
import {
  PhoenixFpsIcon,
  PhoenixModpacksIcon,
  PhoenixPlayIcon,
  PhoenixSkinsIcon,
} from './components/PhoenixIcons';

const STORAGE_KEY = 'phoenix_launcher_state_v2';

interface PersistedState {
  pcTierMode: PcTierMode;
  instances: MinecraftInstance[];
  activeInstanceId: string;
  profiles: PlayerProfile[];
  activeProfileId: string;
  skins: SkinAsset[];
  hardware: HardwareProfile;
  javaPath: string;
  mcDir: string;
}

const OLD_DEFAULT_JAVA = 'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\javaw.exe';

function cleanJavaPath(value: unknown): string {
  const v = typeof value === 'string' ? value.trim() : '';
  return v === OLD_DEFAULT_JAVA ? '' : v;
}

function cleanMcDir(value: unknown): string {
  const v = typeof value === 'string' ? value.trim() : '';
  return v.includes('%') ? '' : v;
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.instances?.length && parsed.skins?.length) {
        const freshPresets = createInitialSkins();
        const customSkins = parsed.skins.filter((s) => s.isCustom);
        const mergedSkins = [
          ...freshPresets.map((preset) => {
            const existing = parsed.skins?.find((s) => s.id === preset.id);
            return existing
              ? {
                  ...preset,
                  showOuterLayer: existing.showOuterLayer,
                  showCape: existing.showCape ?? preset.showCape,
                  showSword: existing.showSword ?? preset.showSword,
                }
              : preset;
          }),
          ...customSkins,
        ];
        const profiles = (parsed.profiles ?? []).filter((p) => p && p.username);
        return {
          pcTierMode: parsed.pcTierMode ?? 'low-end',
          instances: parsed.instances,
          activeInstanceId: parsed.activeInstanceId || parsed.instances[0].id,
          profiles,
          activeProfileId: profiles.find((p) => p.id === parsed.activeProfileId)?.id ?? profiles[0]?.id ?? '',
          skins: mergedSkins,
          hardware: parsed.hardware ?? DEFAULT_HARDWARE_PROFILE,
          // Empty means automatic (Java is detected, the data folder is created for you)
          javaPath: cleanJavaPath(parsed.javaPath),
          mcDir: cleanMcDir(parsed.mcDir),
        };
      }
    }
  } catch {
    // Fall back to clean defaults
  }

  return {
    pcTierMode: 'low-end',
    instances: INITIAL_INSTANCES,
    activeInstanceId: INITIAL_INSTANCES[0].id,
    profiles: [],
    activeProfileId: '',
    skins: createInitialSkins(),
    hardware: DEFAULT_HARDWARE_PROFILE,
    javaPath: '',
    mcDir: '',
  };
}

const SettingsIcon = (({ className }: { className?: string }) => <Settings className={className} />) as unknown as typeof PhoenixPlayIcon;
const ModsIcon = (({ className }: { className?: string }) => <Puzzle className={className} />) as unknown as typeof PhoenixPlayIcon;
const LibraryIcon = (({ className }: { className?: string }) => <Images className={className} />) as unknown as typeof PhoenixPlayIcon;
const WorldsIcon = (({ className }: { className?: string }) => <Globe2 className={className} />) as unknown as typeof PhoenixPlayIcon;

const NAV_ITEMS: {
  id: LauncherView;
  label: string;
  Icon: typeof PhoenixPlayIcon;
}[] = [
  { id: 'instances', label: 'Play', Icon: PhoenixPlayIcon },
  { id: 'modpacks', label: 'Modpacks', Icon: PhoenixModpacksIcon },
  { id: 'mods', label: 'Mods', Icon: ModsIcon },
  { id: 'worlds', label: 'Worlds', Icon: WorldsIcon },
  { id: 'library', label: 'Library', Icon: LibraryIcon },
  { id: 'skins', label: 'Skins', Icon: PhoenixSkinsIcon },
  { id: 'fps', label: 'FPS Boost', Icon: PhoenixFpsIcon },
  { id: 'export', label: 'Settings', Icon: SettingsIcon },
];

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadInitialState());
  const [activeView, setActiveView] = useState<LauncherView>('instances');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const handleLaunchRef = useRef<((id: string) => void) | null>(null);
  const stateRef = useRef<{ activeInstanceId: string }>({ activeInstanceId: '' });
  const [showAccounts, setShowAccounts] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ latest: string; url: string } | null>(null);
  const { runtime, launch, stop, dismissError, isDesktop } = useLauncherRuntime((id, minutes) => {
    logPlaySession(id, minutes);
    setState((prev) => ({
      ...prev,
      instances: prev.instances.map((i) =>
        i.id === id
          ? { ...i, playTimeMinutes: (i.playTimeMinutes ?? 0) + minutes, lastPlayed: new Date().toLocaleDateString() }
          : i
      ),
    }));
  });

  // While Minecraft is running the launcher goes quiet (no animations, blur or 3D loop) so the game gets the GPU.
  const gameRunning = Object.values(runtime).some((r) => r.phase === 'running' || r.phase === 'launching');
  useEffect(() => {
    document.documentElement.classList.toggle('game-running', gameRunning);
  }, [gameRunning]);

  useEffect(() => {
    applyTheme(readStored<string>('phoenix-theme', 'phoenix'));
    applyAppearance();
  }, []);

  // "What's new" once after an update (not on the very first start)
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  useEffect(() => {
    const seen = readStored<string>('phoenix-seen-version', '');
    if (seen !== CHANGELOG_VERSION) {
      if (seen) setShowWhatsNew(true);
      try {
        localStorage.setItem('phoenix-seen-version', JSON.stringify(CHANGELOG_VERSION));
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Desktop messages when the game starts or closes while the launcher is in the background
  const lastPhase = useRef<Record<string, string>>({});
  useEffect(() => {
    if (typeof Notification === 'undefined' || !readStored<boolean>('phoenix-notify', true)) return;
    for (const [id, r] of Object.entries(runtime)) {
      const before = lastPhase.current[id];
      lastPhase.current[id] = r.phase;
      if (before === r.phase || document.hasFocus() || Notification.permission !== 'granted') continue;
      const name = state.instances.find((i) => i.id === id)?.name ?? 'Minecraft';
      if (r.phase === 'running') new Notification('Minecraft is running', { body: `${name} has started.`, silent: true });
      else if (r.phase === 'idle' && (before === 'running' || before === 'launching')) new Notification('Minecraft closed', { body: `${name} has closed.`, silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime]);

  // Command palette and keyboard shortcuts
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (/^[1-9]$/.test(e.key)) {
        const item = NAV_ITEMS[Number(e.key) - 1];
        if (item) {
          e.preventDefault();
          setActiveView(item.id);
        }
      } else if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT') return; // do not start the game while typing
        e.preventDefault();
        handleLaunchRef.current?.(stateRef.current.activeInstanceId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const api = window.phoenixDesktop;
    if (!api?.checkUpdate) return;
    void api.checkUpdate().then((r) => {
      if (r.ok && r.newer && r.latest && r.url) setUpdateInfo({ latest: r.latest, url: r.url });
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota exceeded on large skins
    }
  }, [state]);

  const activeInstance =
    state.instances.find((i) => i.id === state.activeInstanceId) ?? state.instances[0];
  const needsAccount = state.profiles.length === 0;
  const activeProfile: PlayerProfile = useMemo(
    () =>
      state.profiles.find((p) => p.id === state.activeProfileId) ??
      state.profiles[0] ?? {
        id: 'no-account',
        username: 'Player',
        accountType: 'offline',
        activeSkinId: state.skins[0]?.id ?? '',
      },
    [state.profiles, state.activeProfileId, state.skins]
  );
  const activeSkin =
    state.skins.find((s) => s.id === activeProfile.activeSkinId) ?? state.skins[0];
  const logsInstance = logsFor ? state.instances.find((i) => i.id === logsFor) ?? null : null;

  const handleLaunch = (id: string, quickPlay?: { host: string; port?: number }) => {
    const inst = state.instances.find((i) => i.id === id);
    if (!inst) return;
    if (needsAccount) {
      setShowAccounts(true);
      return;
    }
    if (!isDesktop) {
      setLogsFor(id); // browser: explains that the game only starts from the desktop app
      return;
    }
    void launch(id, {
      instance: {
        id: inst.id,
        name: inst.name,
        mcVersion: inst.mcVersion,
        loader: inst.loader,
        ramMb: inst.ramMb,
        jvmArgs: inst.jvmArgs,
        fpsPresetId: inst.fpsPresetId,
        autoFpsMods: inst.autoFpsMods,
        phoenixClient: inst.phoenixClient,
        animatedCapes: inst.animatedCapes,
        resolution: inst.resolution,
        mods: inst.mods,
      },
      hardware: {
        renderDistance: state.hardware.renderDistance,
        simulationDistance: state.hardware.simulationDistance,
        entityShadows: state.hardware.entityShadows,
        particles: state.hardware.particles,
        mipmapLevels: state.hardware.mipmapLevels,
      },
      auth: {
        type: activeProfile.accountType,
        username: activeProfile.username,
        uuid: activeProfile.uuid,
      },
      skin:
        activeProfile.accountType === 'offline' && activeSkin
          ? {
              skinPng: activeSkin.dataUrl.split(',')[1] ?? '',
              capePng: activeSkin.showCape ?? true ? createCapePngBase64() : '',
            }
          : undefined,
      quickPlay,
      javaPath: state.javaPath,
      dataDir: state.mcDir,
      hideOnLaunch: readStored<boolean>('phoenix-hide-on-launch', false),
      phoenixClient: readStored<boolean>('phoenix-install-client', true),
    });
  };


  handleLaunchRef.current = (id: string) => handleLaunch(id);
  stateRef.current = { activeInstanceId: state.activeInstanceId };

  const paletteItems: PaletteItem[] = [
    {
      id: 'play',
      label: `Play ${activeInstance.name}`,
      hint: 'Ctrl+Enter',
      group: 'Actions',
      run: () => handleLaunch(activeInstance.id),
    },
    ...NAV_ITEMS.map((n, i) => ({
      id: `page-${n.id}`,
      label: n.label,
      hint: i < 9 ? `Ctrl+${i + 1}` : undefined,
      group: 'Pages' as const,
      run: () => setActiveView(n.id),
    })),
    ...state.instances.map((inst) => ({
      id: `inst-${inst.id}`,
      label: inst.name,
      hint: `${inst.loader} ${inst.mcVersion}`,
      group: 'Profiles' as const,
      run: () => {
        setState((prev) => ({ ...prev, activeInstanceId: inst.id }));
        setActiveView('instances');
      },
    })),
  ];

  const handleSelectCharacter = (skinId: string) => {
    const picked = state.skins.find((s) => s.id === skinId);
    if (!picked) return;
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === activeProfile.id ? { ...p, activeSkinId: skinId } : p
      ),
    }));
  };

  const handleInstallToInstance = (instanceId: string, mod: InstalledMod) => {
    setState((prev) => ({
      ...prev,
      instances: prev.instances.map((inst) => {
        if (inst.id !== instanceId) return inst;
        if (inst.mods.some((m) => m.id === mod.id)) return inst;
        return { ...inst, mods: [...inst.mods, mod] };
      }),
    }));
  };

  const handleCreateInstanceFromModpack = (hit: ModrinthHit, versionLabel: string, pickedMc?: string) => {
    const loaderGuess: ModLoader = hit.categories.includes('forge')
      ? 'forge'
      : hit.categories.includes('neoforge')
      ? 'neoforge'
      : 'fabric';
    // the Minecraft version chosen in the filter wins; otherwise the newest one the pack supports
    const mcVer = pickedMc && (hit.versions.length === 0 || hit.versions.includes(pickedMc)) ? pickedMc : hit.versions[hit.versions.length - 1] || '1.20.1';
    const created: MinecraftInstance = {
      id: `inst-${Date.now()}`,
      name: hit.title,
      mcVersion: mcVer,
      loader: loaderGuess,
      ramMb: 4096,
      fpsPresetId: 'balanced',
      jvmArgs: buildJvmArgs(4096, 'G1GC', true),
      lastPlayed: 'Just created',
      playTimeMinutes: 0,
      resolution: { width: 1280, height: 720 },
      bannerUrl: packVoxelTwilight,
      mods: [
        {
          id: hit.project_id,
          slug: hit.slug,
          title: hit.title,
          version: versionLabel,
          category: 'Modpack',
          enabled: true,
          source: 'modrinth',
          downloads: hit.downloads,
          projectType: 'modpack',
        },
      ],
    };

    setState((prev) => ({
      ...prev,
      instances: [created, ...prev.instances],
      activeInstanceId: created.id,
    }));
    setActiveView('instances');
  };

  const handlePackImported = (newId: string, info: { name: string; mcVersion: string; loader: MinecraftInstance['loader'] }) => {
    const base = state.instances.find((i) => i.id === state.activeInstanceId) ?? state.instances[0];
    const created: MinecraftInstance = {
      ...base,
      id: newId,
      name: info.name,
      mcVersion: info.mcVersion || base.mcVersion,
      loader: info.loader,
      mods: [],
      lastPlayed: 'Never',
      playTimeMinutes: 0,
    };
    setState((prev) => ({ ...prev, instances: [created, ...prev.instances], activeInstanceId: created.id }));
  };

  const handleDuplicated = (newId: string) => {
    const base = state.instances.find((i) => i.id === state.activeInstanceId) ?? state.instances[0];
    const created: MinecraftInstance = { ...base, id: newId, name: `${base.name} (copy)`, mods: base.mods.map((m) => ({ ...m })), lastPlayed: 'Never', playTimeMinutes: 0 };
    setState((prev) => ({ ...prev, instances: [created, ...prev.instances], activeInstanceId: created.id }));
  };

  const handleAddCoreFpsMods = (instanceId: string) => {
    const coreMods: InstalledMod[] = [
      { id: 'AANobbMI', slug: 'sodium', title: 'Sodium', version: '0.6.5', category: 'Optimization', enabled: true, source: 'modrinth' },
      { id: 'gvQqBUqZ', slug: 'lithium', title: 'Lithium', version: '0.14.2', category: 'Optimization', enabled: true, source: 'modrinth' },
      { id: 'uXXizFIs', slug: 'ferrite-core', title: 'FerriteCore', version: '7.0.2', category: 'Memory', enabled: true, source: 'modrinth' },
      { id: 'NNAgCjsB', slug: 'entityculling', title: 'EntityCulling', version: '1.7.2', category: 'Optimization', enabled: true, source: 'modrinth' },
    ];

    setState((prev) => ({
      ...prev,
      instances: prev.instances.map((inst) => {
        if (inst.id !== instanceId) return inst;
        const existingIds = new Set(inst.mods.map((m) => m.id));
        const toAdd = coreMods.filter((m) => !existingIds.has(m.id));
        return {
          ...inst,
          loader: inst.loader === 'vanilla' ? 'fabric' : inst.loader,
          mods: [...inst.mods, ...toAdd],
        };
      }),
    }));
  };

  const handleAddUltraShaderStack = (instanceId: string) => {
    const shaderStack: InstalledMod[] = [
      { id: 'YL57xq9U', slug: 'iris', title: 'Iris Shaders', version: '1.8.1+mc1.21.4', category: 'Shaders', enabled: true, source: 'modrinth', projectType: 'mod' },
      { id: 'HVnmMxH1', slug: 'complementary-reimagined', title: 'Complementary Reimagined', version: 'r5.4', category: 'Shaders', enabled: true, source: 'modrinth', projectType: 'shader' },
      { id: 'uCdwagent', slug: 'distanthorizons', title: 'Distant Horizons', version: '2.3.0-a', category: 'Optimization', enabled: true, source: 'modrinth', projectType: 'mod' },
      { id: 'AANobbMI', slug: 'sodium', title: 'Sodium', version: '0.6.5', category: 'Optimization', enabled: true, source: 'modrinth', projectType: 'mod' },
      { id: 'gvQqBUqZ', slug: 'lithium', title: 'Lithium', version: '0.14.2', category: 'Optimization', enabled: true, source: 'modrinth', projectType: 'mod' },
    ];

    setState((prev) => ({
      ...prev,
      instances: prev.instances.map((inst) => {
        if (inst.id !== instanceId) return inst;
        const existingIds = new Set(inst.mods.map((m) => m.id));
        const toAdd = shaderStack.filter((m) => !existingIds.has(m.id));
        return {
          ...inst,
          loader: inst.loader === 'vanilla' ? 'fabric' : inst.loader,
          mods: [...inst.mods, ...toAdd],
        };
      }),
    }));
  };

  const handleTogglePcTierMode = (nextMode: PcTierMode) => {
    setState((prev) => {
      if (nextMode === 'high-end') {
        const isLowGpu =
          prev.hardware.gpuTier === 'integrated_low' ||
          prev.hardware.gpuTier === 'integrated_modern' ||
          prev.hardware.gpuTier === 'dedicated_entry';
        const nextHardware = isLowGpu
          ? HIGH_END_DEFAULT_HARDWARE
          : {
              ...prev.hardware,
              systemRamGb: Math.max(32, prev.hardware.systemRamGb),
              renderDistance: Math.max(16, prev.hardware.renderDistance),
              gcType: 'ZGC' as const,
            };
        const hasUltra = prev.instances.some((i) => i.id === 'inst-ultra-shaders');
        const nextActiveId =
          prev.activeInstanceId === 'inst-potato-boost' && hasUltra
            ? 'inst-ultra-shaders'
            : prev.activeInstanceId;
        return {
          ...prev,
          pcTierMode: 'high-end',
          hardware: nextHardware,
          activeInstanceId: nextActiveId,
        };
      }

      const isHighGpu =
        prev.hardware.gpuTier === 'dedicated_high' ||
        prev.hardware.gpuTier === 'dedicated_ultra' ||
        prev.hardware.gpuTier === 'creator_workstation';
      const nextHardware = isHighGpu ? DEFAULT_HARDWARE_PROFILE : prev.hardware;
      const hasPotato = prev.instances.some((i) => i.id === 'inst-potato-boost');
      const nextActiveId =
        prev.activeInstanceId === 'inst-ultra-shaders' && hasPotato
          ? 'inst-potato-boost'
          : prev.activeInstanceId;

      return {
        ...prev,
        pcTierMode: 'low-end',
        hardware: nextHardware,
        activeInstanceId: nextActiveId,
      };
    });
  };

  const handleApplyQuickBoost = (presetKey: FpsPresetKey) => {
    const preset = FPS_PRESETS[presetKey];
    const isHighEndPreset = preset.tier === 'high-end';

    setState((prev) => {
      const minSystemRam =
        presetKey === 'distant_horizons'
          ? 64
          : isHighEndPreset
          ? 32
          : prev.hardware.systemRamGb;
      const nextSystemRamGb = Math.max(prev.hardware.systemRamGb, minSystemRam);
      const osReserveGb = nextSystemRamGb >= 32 ? 4 : 2;
      const safeCeiling = Math.min(32768, Math.max(2048, (nextSystemRamGb - osReserveGb) * 1024));
      const targetRam = Math.min(preset.recommendedRamMb, safeCeiling);
      const args = buildJvmArgs(targetRam, preset.gcType, true);

      const nextGpuTier = isHighEndPreset
        ? preset.minGpuTier
        : prev.hardware.gpuTier;

      return {
        ...prev,
        pcTierMode: preset.tier,
        hardware: {
          ...prev.hardware,
          gpuTier: nextGpuTier,
          systemRamGb: nextSystemRamGb,
          cpuCores: isHighEndPreset ? Math.max(12, prev.hardware.cpuCores) : prev.hardware.cpuCores,
          renderDistance: preset.renderDistance,
          simulationDistance: preset.simulationDistance,
          entityShadows: preset.entityShadows,
          particles: preset.particles,
          mipmapLevels: preset.mipmapLevels,
          gcType: preset.gcType,
          usePerformanceFlags: true,
        },
        instances: prev.instances.map((inst) =>
          inst.id === activeInstance.id
            ? { ...inst, ramMb: targetRam, jvmArgs: args, fpsPresetId: presetKey }
            : inst
        ),
      };
    });
  };

  return (
    <div className="min-h-screen flex phx-app text-slate-100">
      {/* Compact Lunar/Feather-Style Left Rail with Custom Icons */}
      <aside className="hidden lg:flex lg:w-[88px] lg:flex-col lg:fixed lg:inset-y-0 bg-[#0B0F17] border-r border-white/[0.08] z-40">
        <div className="h-14 flex items-center justify-center border-b border-white/[0.08]">
          <button
            type="button"
            onClick={() => setActiveView('instances')}
            aria-label="Phoenix Launcher Home"
            className="p-1 rounded-xl hover:scale-105 transition-transform"
          >
            <img
              src={phoenixEmblem}
              alt="Phoenix Launcher"
              className="w-9 h-9 rounded-lg object-cover border border-orange-500/30"
            />
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 flex flex-col items-center gap-2">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveView(id)}
                className={`w-full flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/40'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100 border border-transparent'
                }`}
              >
                <Icon active={active} className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="py-3 border-t border-white/[0.08] flex flex-col items-center">
          <span className="text-[11px] font-mono-tabular text-slate-500">v{CHANGELOG_VERSION}</span>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative w-64 bg-[#0B0F17] border-r border-white/10 flex flex-col p-4 z-10">
            <div className="flex items-center justify-between mb-6">
              <span className="font-display text-lg font-bold text-white">Phoenix Launcher</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = activeView === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveView(id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    <Icon active={active} className="w-5 h-5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Window Area */}
      <div className="flex-1 lg:pl-[88px] flex flex-col min-w-0">
        {/* Slim 3-Zone Launcher Window Bar */}
        <header className="h-14 sticky top-0 z-30 bg-[#090C12]/95 border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white border border-white/10"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveView('instances')}
              className="font-display text-sm sm:text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
            >
              PHOENIX LAUNCHER
            </button>
          </div>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            {NAV_ITEMS.map(({ id, label }) => {
              const active = activeView === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveView(id)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-orange-500 text-white'
                      : 'border-transparent hover:text-slate-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Player Skin-Head Profile Selector */}
          <div className="flex items-center gap-3 shrink-0">
            <RecorderButton />
            <DiscordChip />
            <button
              type="button"
              onClick={() => setShowAccounts(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#111620] border border-white/15 hover:border-orange-500/50 px-3 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <SkinHeadAvatar
                skinDataUrl={activeSkin.dataUrl}
                alt={activeProfile.username}
                size={20}
              />
              <span>{activeProfile.username}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </header>

        {!isDesktop && !(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() && <WebBanner />}

        {updateInfo && (
          <div className="bg-orange-500/15 border-b border-orange-500/30 px-4 py-2 text-xs text-orange-100 flex items-center justify-between gap-3">
            <span>Phoenix Launcher {updateInfo.latest} is available.</span>
            <button
              type="button"
              onClick={() => window.phoenixDesktop?.openExternal(updateInfo.url)}
              className="rounded bg-orange-500 px-2.5 py-1 font-semibold text-slate-950 hover:bg-orange-400"
            >
              Download update
            </button>
          </div>
        )}

        {/* Active View Content */}
        <main className="flex-1 w-full">
          {activeView === 'instances' && (
            <HomePlayView
              instances={state.instances}
              activeInstance={activeInstance}
              activeProfile={activeProfile}
              activeSkin={activeSkin}
              skins={state.skins}
              hardware={state.hardware}
              pcTierMode={state.pcTierMode}
              javaPath={state.javaPath}
              mcDir={state.mcDir}
              onChangePcTierMode={handleTogglePcTierMode}
              onSelectInstance={(id) =>
                setState((prev) => ({ ...prev, activeInstanceId: id }))
              }
              onSelectCharacter={handleSelectCharacter}
              onCreateInstance={(inst) =>
                setState((prev) => ({
                  ...prev,
                  instances: [inst, ...prev.instances],
                  activeInstanceId: inst.id,
                }))
              }
              onUpdateInstance={(id, updater) =>
                setState((prev) => ({
                  ...prev,
                  instances: prev.instances.map((i) => (i.id === id ? updater(i) : i)),
                }))
              }
              onDeleteInstance={(id) =>
                setState((prev) => {
                  const next = prev.instances.filter((i) => i.id !== id);
                  return {
                    ...prev,
                    instances: next,
                    activeInstanceId:
                      prev.activeInstanceId === id ? next[0]?.id ?? '' : prev.activeInstanceId,
                  };
                })
              }
              onApplyQuickBoost={handleApplyQuickBoost}
              runtime={runtime[activeInstance.id]}
              onLaunchInstance={(id) => handleLaunch(id)}
              onJoinServer={(host) => handleLaunch(activeInstance.id, { host })}
              onStopInstance={(id) => void stop(id)}
              onShowLogs={(id) => setLogsFor(id)}
              onNavigate={(view) => setActiveView(view)}
              onToggleCape={() =>
                setState((prev) => ({
                  ...prev,
                  skins: prev.skins.map((s) =>
                    s.id === activeSkin.id ? { ...s, showCape: !(s.showCape ?? true) } : s
                  ),
                }))
              }
              onToggleSword={() =>
                setState((prev) => ({
                  ...prev,
                  skins: prev.skins.map((s) =>
                    s.id === activeSkin.id ? { ...s, showSword: !(s.showSword ?? true) } : s
                  ),
                }))
              }
            />
          )}

          {activeView === 'mods' && <ModsView instance={activeInstance} mcDir={state.mcDir} onPackImported={handlePackImported} />}

          {activeView === 'library' && <LibraryView
              instance={activeInstance}
              instances={state.instances}
              mcDir={state.mcDir}
              onDuplicate={handleDuplicated}
              onJoin={(host) => handleLaunch(activeInstance.id, { host })}
              onUpdateInstance={(patch) =>
                setState((prev) => ({ ...prev, instances: prev.instances.map((i) => (i.id === activeInstance.id ? { ...i, ...patch } : i)) }))
              }
            />}

          {activeView === 'worlds' && <WorldsView instance={activeInstance} mcDir={state.mcDir} />}

          {activeView === 'modpacks' && (
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1380px] mx-auto">
              <ModpacksView
                instances={state.instances}
                activeInstanceId={activeInstance.id}
                onInstallToInstance={handleInstallToInstance}
                onCreateInstanceFromModpack={handleCreateInstanceFromModpack}
              />
            </div>
          )}

          {activeView === 'skins' && (
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1380px] mx-auto">
              <SkinStudioView
                skins={state.skins}
                activeProfile={activeProfile}
                onSelectSkinForProfile={handleSelectCharacter}
                onUpdateSkin={(skinId, updater) =>
                  setState((prev) => ({
                    ...prev,
                    skins: prev.skins.map((s) => (s.id === skinId ? updater(s) : s)),
                  }))
                }
                onAddSkin={(skin) =>
                  setState((prev) => ({ ...prev, skins: [skin, ...prev.skins] }))
                }
                onDeleteSkin={(skinId) =>
                  setState((prev) => {
                    if (prev.skins.length <= 1) return prev; // keep at least one skin, otherwise the app crashes
                    const nextSkins = prev.skins.filter((s) => s.id !== skinId);
                    return {
                      ...prev,
                      skins: nextSkins,
                      profiles: prev.profiles.map((p) =>
                        p.activeSkinId === skinId
                          ? { ...p, activeSkinId: nextSkins[0]?.id ?? '' }
                          : p
                      ),
                    };
                  })
                }
              />
            </div>
          )}

          {activeView === 'fps' && (
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1380px] mx-auto">
              <FpsOptimizerView
                hardware={state.hardware}
                pcTierMode={state.pcTierMode}
                activeInstance={activeInstance}
                onChangePcTierMode={handleTogglePcTierMode}
                onUpdateHardware={(updater) =>
                  setState((prev) => ({ ...prev, hardware: updater(prev.hardware) }))
                }
                onApplyToInstance={(instanceId, ramMb, jvmArgs, presetId) =>
                  setState((prev) => ({
                    ...prev,
                    instances: prev.instances.map((i) =>
                      i.id === instanceId
                        ? { ...i, ramMb, jvmArgs, fpsPresetId: presetId }
                        : i
                    ),
                  }))
                }
                onApplyQuickBoost={handleApplyQuickBoost}
                onAddCoreFpsMods={handleAddCoreFpsMods}
                onAddUltraShaderStack={handleAddUltraShaderStack}
              />
            </div>
          )}

          {activeView === 'export' && (
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1380px] mx-auto">
              <SettingsView
                javaPath={state.javaPath}
                mcDir={state.mcDir}
                onChangeJavaPath={(val) =>
                  setState((prev) => ({ ...prev, javaPath: val }))
                }
                onChangeMcDir={(val) =>
                  setState((prev) => ({ ...prev, mcDir: val }))
                }
              />
            </div>
          )}
        </main>
      </div>

      {isDesktop && <SpotifyBar />}

      {/* Launch logs / browser notice */}
      <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />
      {showWhatsNew && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}
      <LaunchModal
        instance={logsInstance}
        runtime={logsInstance ? runtime[logsInstance.id] : undefined}
        isDesktop={isDesktop}
        mcDir={state.mcDir}
        onClose={() => {
          if (logsFor) dismissError(logsFor);
          setLogsFor(null);
        }}
      />

      {/* Account chooser: shown on first start and from the profile button */}
      {(needsAccount || showAccounts) && (
        <AccountModal
          profiles={state.profiles}
          activeProfileId={activeProfile.id}
          skins={state.skins}
          required={needsAccount}
          onClose={() => setShowAccounts(false)}
          onSelect={(id) => {
            setState((prev) => ({ ...prev, activeProfileId: id }));
            setShowAccounts(false);
          }}
          onAddLocal={(username) => {
            const id = `acc-${Date.now()}`;
            setState((prev) => ({
              ...prev,
              profiles: [...prev.profiles, { id, username, accountType: 'offline', activeSkinId: prev.skins[0]?.id ?? '' }],
              activeProfileId: id,
            }));
            setShowAccounts(false);
          }}
          onAddMicrosoft={({ uuid, username }) => {
            setState((prev) => {
              const existing = prev.profiles.find((p) => p.uuid === uuid);
              if (existing) {
                return {
                  ...prev,
                  profiles: prev.profiles.map((p) => (p.id === existing.id ? { ...p, username } : p)),
                  activeProfileId: existing.id,
                };
              }
              const id = `acc-${Date.now()}`;
              return {
                ...prev,
                profiles: [...prev.profiles, { id, username, uuid, accountType: 'microsoft', activeSkinId: prev.skins[0]?.id ?? '' }],
                activeProfileId: id,
              };
            });
            setShowAccounts(false);
          }}
          onRemove={(id) =>
            setState((prev) => {
              const next = prev.profiles.filter((p) => p.id !== id);
              return {
                ...prev,
                profiles: next,
                activeProfileId: prev.activeProfileId === id ? next[0]?.id ?? '' : prev.activeProfileId,
              };
            })
          }
        />
      )}
    </div>
  );
}
