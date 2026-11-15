import type { GcType, GpuTier, HardwareProfile, MinecraftInstance, PlayerProfile } from '../types/launcher';
import packVoxelTwilight from '../assets/images/pack_voxel_twilight_1794755345704.jpg';
import packSkyIsland from '../assets/images/pack_sky_island_1794755344762.jpg';

export const MC_VERSIONS = ['1.21.4', '1.21.1', '1.20.1', '1.19.2', '1.16.5', '1.12.2'] as const;

export const DEFAULT_HARDWARE_PROFILE: HardwareProfile = {
  cpuCores: 4,
  systemRamGb: 8,
  gpuTier: 'integrated_low',
  renderDistance: 6,
  simulationDistance: 5,
  entityShadows: false,
  particles: 'minimal',
  mipmapLevels: 1,
  gcType: 'G1GC',
  usePerformanceFlags: true,
};

export const HIGH_END_DEFAULT_HARDWARE: HardwareProfile = {
  cpuCores: 16,
  systemRamGb: 32,
  gpuTier: 'dedicated_ultra',
  renderDistance: 24,
  simulationDistance: 12,
  entityShadows: true,
  particles: 'all',
  mipmapLevels: 4,
  gcType: 'ZGC',
  usePerformanceFlags: true,
};

export function buildJvmArgs(ramMb: number, gcType: GcType, usePerformanceFlags: boolean): string {
  const safeRam = Math.max(1024, Math.min(ramMb, 32768));
  const minRam = Math.max(1024, Math.floor(safeRam * 0.75));
  const base = [`-Xms${minRam}M`, `-Xmx${safeRam}M`];

  if (!usePerformanceFlags) {
    return base.join(' ');
  }

  if (gcType === 'ZGC') {
    return [
      ...base,
      '-XX:+UseZGC',
      '-XX:+ZGenerational',
      '-XX:+AlwaysPreTouch',
      '-XX:+DisableExplicitGC',
      '-XX:+PerfDisableSharedMem',
      ...(safeRam >= 12288 ? ['-XX:+UseLargePages'] : []),
    ].join(' ');
  }

  if (gcType === 'Shenandoah') {
    return [
      ...base,
      '-XX:+UseShenandoahGC',
      '-XX:ShenandoahGCHeuristics=compact',
      '-XX:+AlwaysPreTouch',
      '-XX:+DisableExplicitGC',
    ].join(' ');
  }

  // Optimized G1GC scaled for low-end or high-memory heaps
  const regionSize = safeRam >= 12288 ? '16M' : '8M';
  return [
    ...base,
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=35',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    '-XX:G1NewSizePercent=25',
    '-XX:G1MaxNewSizePercent=40',
    `-XX:G1HeapRegionSize=${regionSize}`,
    '-XX:G1ReservePercent=15',
    '-XX:InitiatingHeapOccupancyPercent=20',
  ].join(' ');
}

export function estimateFpsRange(
  hw: HardwareProfile,
  activeModCount: number,
  hasSodium: boolean,
  hasShaders = false
): { min: number; avg: number; maxRamSafeMb: number } {
  const gpuBase: Record<GpuTier, number> = {
    integrated_low: 34,
    integrated_modern: 68,
    dedicated_entry: 115,
    dedicated_mid: 195,
    dedicated_high: 295,
    dedicated_ultra: 430,
    creator_workstation: 460,
  };

  let fps = gpuBase[hw.gpuTier] ?? 68;
  if (hasSodium) fps *= 1.85;
  if (hw.usePerformanceFlags) fps *= 1.1;
  if (!hw.entityShadows) fps *= 1.1;
  if (hw.particles === 'minimal') fps *= 1.07;
  if (hw.mipmapLevels <= 1) fps *= 1.04;

  // Shader pipeline overhead (modern GPUs handle shaders cleanly while keeping strong FPS)
  if (hasShaders) {
    const shaderRetention =
      hw.gpuTier === 'dedicated_ultra' || hw.gpuTier === 'creator_workstation'
        ? 0.44
        : hw.gpuTier === 'dedicated_high'
        ? 0.36
        : hw.gpuTier === 'dedicated_mid'
        ? 0.28
        : 0.16;
    fps *= shaderRetention;
  }

  // Render distance penalty (gentle curve past 16ch for high-end LOD setups)
  const distFactor =
    hw.renderDistance <= 16
      ? Math.max(0.38, 1 - (hw.renderDistance - 4) * 0.036)
      : Math.max(0.28, 0.568 - (hw.renderDistance - 16) * 0.015);
  fps *= distFactor;

  // Mod overhead penalty beyond lightweight core mods
  const heavyMods = Math.max(0, activeModCount - 6);
  fps *= Math.max(0.55, 1 - heavyMods * 0.014);

  const avg = Math.round(Math.max(18, fps));
  const min = Math.round(avg * 0.76);
  const osReserveGb = hw.systemRamGb >= 32 ? 4 : 2;
  const maxRamSafeMb = Math.min(32768, Math.max(2048, Math.floor((hw.systemRamGb - osReserveGb) * 1024)));

  return { min, avg, maxRamSafeMb };
}

export const FPS_PRESETS = {
  potato: {
    id: 'potato' as const,
    tier: 'low-end' as const,
    label: 'Potato PC (Max FPS)',
    summary: '5 chunk render, shadows off, minimal particles, compact G1GC heap for 4–8GB laptops.',
    renderDistance: 5,
    simulationDistance: 5,
    entityShadows: false,
    particles: 'minimal' as const,
    mipmapLevels: 0,
    gcType: 'G1GC' as GcType,
    recommendedRamMb: 2560,
    minGpuTier: 'integrated_low' as GpuTier,
    recommendedMods: ['Sodium', 'Lithium', 'FerriteCore', 'EntityCulling', 'ImmediatelyFast'],
  },
  balanced: {
    id: 'balanced' as const,
    tier: 'low-end' as const,
    label: 'Balanced 60 FPS',
    summary: '8 chunk render, crisp textures, smooth chunk generation with low memory footprint.',
    renderDistance: 8,
    simulationDistance: 6,
    entityShadows: false,
    particles: 'decreased' as const,
    mipmapLevels: 2,
    gcType: 'G1GC' as GcType,
    recommendedRamMb: 4096,
    minGpuTier: 'integrated_modern' as GpuTier,
    recommendedMods: ['Sodium', 'Lithium', 'FerriteCore', 'EntityCulling'],
  },
  competitive: {
    id: 'competitive' as const,
    tier: 'low-end' as const,
    label: 'Low-Latency PvP',
    summary: 'Generational ZGC pause-free GC, 10 chunk visibility, zero input stutter.',
    renderDistance: 10,
    simulationDistance: 6,
    entityShadows: true,
    particles: 'decreased' as const,
    mipmapLevels: 4,
    gcType: 'ZGC' as GcType,
    recommendedRamMb: 6144,
    minGpuTier: 'dedicated_entry' as GpuTier,
    recommendedMods: ['Sodium', 'Lithium', 'ImmediatelyFast', 'ModernFix'],
  },
  esports240: {
    id: 'esports240' as const,
    tier: 'high-end' as const,
    label: '240Hz Esports Max',
    summary: '16 chunk render, Generational ZGC, Sodium + Nvidium + ImmediatelyFast for 240–500+ FPS.',
    renderDistance: 16,
    simulationDistance: 10,
    entityShadows: true,
    particles: 'decreased' as const,
    mipmapLevels: 4,
    gcType: 'ZGC' as GcType,
    recommendedRamMb: 12288,
    minGpuTier: 'dedicated_high' as GpuTier,
    recommendedMods: ['Sodium', 'Lithium', 'ImmediatelyFast', 'Nvidium'],
  },
  ultra_shaders: {
    id: 'ultra_shaders' as const,
    tier: 'high-end' as const,
    label: '4K Ultra Shaders',
    summary: '20 chunk render, 16GB ZGC heap, Iris + Complementary Shaders for flagship GPUs.',
    renderDistance: 20,
    simulationDistance: 12,
    entityShadows: true,
    particles: 'all' as const,
    mipmapLevels: 4,
    gcType: 'ZGC' as GcType,
    recommendedRamMb: 16384,
    minGpuTier: 'dedicated_ultra' as GpuTier,
    recommendedMods: ['Iris Shaders', 'Complementary Shaders', 'Sodium', 'Lithium'],
  },
  distant_horizons: {
    id: 'distant_horizons' as const,
    tier: 'high-end' as const,
    label: 'Distant Horizons 32ch',
    summary: '32 chunk render + LOD vista engine, 24GB heap for 4K cinematic & content creation.',
    renderDistance: 32,
    simulationDistance: 16,
    entityShadows: true,
    particles: 'all' as const,
    mipmapLevels: 4,
    gcType: 'ZGC' as GcType,
    recommendedRamMb: 24576,
    minGpuTier: 'creator_workstation' as GpuTier,
    recommendedMods: ['Distant Horizons', 'Iris Shaders', 'Sodium', 'Lithium'],
  },
};

export const INITIAL_INSTANCES: MinecraftInstance[] = [
  {
    id: 'inst-potato-boost',
    name: 'Phoenix Potato Boost',
    mcVersion: '1.20.1',
    loader: 'fabric',
    ramMb: 2560,
    fpsPresetId: 'potato',
    jvmArgs: buildJvmArgs(2560, 'G1GC', true),
    lastPlayed: 'Today, 06:42',
    playTimeMinutes: 840,
    resolution: { width: 1280, height: 720 },
    bannerUrl: packSkyIsland,
    mods: [
      { id: 'AANobbMI', slug: 'sodium', title: 'Sodium', version: '0.5.11+mc1.20.1', category: 'Optimization', enabled: true, source: 'modrinth', downloads: 98400000, projectType: 'mod' },
      { id: 'gvQqBUqZ', slug: 'lithium', title: 'Lithium', version: '0.11.2+mc1.20.1', category: 'Optimization', enabled: true, source: 'modrinth', downloads: 64100000, projectType: 'mod' },
      { id: 'uXXizFIs', slug: 'ferrite-core', title: 'FerriteCore', version: '6.0.1-fabric', category: 'Memory', enabled: true, source: 'modrinth', downloads: 52700000, projectType: 'mod' },
      { id: 'NNAgCjsB', slug: 'entityculling', title: 'EntityCulling', version: '1.6.6-mc1.20.1', category: 'Optimization', enabled: true, source: 'modrinth', downloads: 49300000, projectType: 'mod' },
      { id: '5ZwdcRci', slug: 'immediatelyfast', title: 'ImmediatelyFast', version: '1.2.21+1.20.4', category: 'Rendering', enabled: true, source: 'modrinth', downloads: 31200000, projectType: 'mod' },
    ],
  },
  {
    id: 'inst-ultra-shaders',
    name: 'Phoenix Ultra Shaders 4K',
    mcVersion: '1.21.4',
    loader: 'fabric',
    ramMb: 16384,
    fpsPresetId: 'ultra_shaders',
    jvmArgs: buildJvmArgs(16384, 'ZGC', true),
    lastPlayed: 'Today, 07:15',
    playTimeMinutes: 690,
    resolution: { width: 2560, height: 1440 },
    bannerUrl: packVoxelTwilight,
    mods: [
      { id: 'YL57xq9U', slug: 'iris', title: 'Iris Shaders', version: '1.8.1+mc1.21.4', category: 'Shaders', enabled: true, source: 'modrinth', downloads: 44800000, projectType: 'mod' },
      { id: 'HVnmMxH1', slug: 'complementary-reimagined', title: 'Complementary Reimagined', version: 'r5.4', category: 'Shaders', enabled: true, source: 'modrinth', downloads: 31500000, projectType: 'shader' },
      { id: 'uCdwagent', slug: 'distanthorizons', title: 'Distant Horizons', version: '2.3.0-a-1.21.4', category: 'Optimization', enabled: true, source: 'modrinth', downloads: 18900000, projectType: 'mod' },
      { id: 'AANobbMI', slug: 'sodium', title: 'Sodium', version: '0.6.5+mc1.21.4', category: 'Optimization', enabled: true, source: 'modrinth', downloads: 98400000, projectType: 'mod' },
      { id: 'gvQqBUqZ', slug: 'lithium', title: 'Lithium', version: '0.14.2+mc1.21.4', category: 'Optimization', enabled: true, source: 'modrinth', downloads: 64100000, projectType: 'mod' },
    ],
  },
  {
    id: 'inst-fabulously-opt',
    name: 'Fabulously Optimized',
    mcVersion: '1.21.4',
    loader: 'fabric',
    ramMb: 4096,
    fpsPresetId: 'balanced',
    jvmArgs: buildJvmArgs(4096, 'G1GC', true),
    lastPlayed: 'Yesterday',
    playTimeMinutes: 1420,
    resolution: { width: 1920, height: 1080 },
    bannerUrl: packVoxelTwilight,
    mods: [
      { id: '1KVo5zza', slug: 'fabulously-optimized', title: 'Fabulously Optimized Core', version: '6.2.0', category: 'Modpack', enabled: true, source: 'modrinth', downloads: 16200000, projectType: 'modpack' },
      { id: 'AANobbMI', slug: 'sodium', title: 'Sodium', version: '0.6.5+mc1.21.4', category: 'Optimization', enabled: true, source: 'modrinth', downloads: 98400000, projectType: 'mod' },
      { id: 'YL57xq9U', slug: 'iris', title: 'Iris Shaders', version: '1.8.1+mc1.21.4', category: 'Shaders', enabled: false, source: 'modrinth', downloads: 44800000, projectType: 'mod' },
    ],
  },
  {
    id: 'inst-vanilla-clean',
    name: 'Vanilla 1.21.4 Clean',
    mcVersion: '1.21.4',
    loader: 'vanilla',
    ramMb: 2048,
    fpsPresetId: 'balanced',
    jvmArgs: buildJvmArgs(2048, 'G1GC', true),
    lastPlayed: '3 days ago',
    playTimeMinutes: 315,
    resolution: { width: 1280, height: 720 },
    bannerUrl: packSkyIsland,
    mods: [],
  },
];

export const INITIAL_PROFILES: PlayerProfile[] = [
  {
    id: 'prof-1',
    username: 'Steve',
    accountType: 'offline',
    activeSkinId: 'skin-steve',
  },
  {
    id: 'prof-2',
    username: 'Alex',
    accountType: 'microsoft',
    activeSkinId: 'skin-alex',
  },
];
