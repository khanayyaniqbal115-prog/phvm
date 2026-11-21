export type ModLoader = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt';

export type LauncherView = 'instances' | 'modpacks' | 'worlds' | 'skins' | 'fps' | 'export' | 'mods' | 'library' | 'bedrock';

export type PcTierMode = 'low-end' | 'high-end';

export type GpuTier =
  | 'integrated_low'
  | 'integrated_modern'
  | 'dedicated_entry'
  | 'dedicated_mid'
  | 'dedicated_high'
  | 'dedicated_ultra'
  | 'creator_workstation';

export type GcType = 'G1GC' | 'ZGC' | 'Shenandoah';

export type FpsPresetKey =
  | 'potato'
  | 'balanced'
  | 'competitive'
  | 'esports240'
  | 'ultra_shaders'
  | 'distant_horizons';

export interface InstalledMod {
  id: string;
  slug: string;
  title: string;
  version: string;
  category: string;
  enabled: boolean;
  source: 'modrinth' | 'builtin';
  downloads?: number;
  projectType?: 'mod' | 'modpack' | 'shader';
}

export interface MinecraftInstance {
  id: string;
  name: string;
  mcVersion: string;
  loader: ModLoader;
  ramMb: number;
  fpsPresetId: FpsPresetKey | 'custom';
  autoFpsMods?: boolean;
  jvmArgs: string;
  mods: InstalledMod[];
  lastPlayed: string;
  playTimeMinutes: number;
  resolution: { width: number; height: number };
  bannerUrl?: string;
  /** false = Phoenix Client mod is switched off for this instance (default on) */
  phoenixClient?: boolean;
}

export interface PlayerProfile {
  id: string;
  username: string;
  accountType: 'microsoft' | 'offline';
  activeSkinId: string;
  uuid?: string; // Microsoft accounts only
}

export interface SkinAsset {
  id: string;
  name: string;
  modelType: 'classic' | 'slim';
  dataUrl: string;
  showOuterLayer: boolean;
  showCape?: boolean;
  showSword?: boolean;
  isCustom?: boolean;
}

export type MojangVersionType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha';

export interface MojangVersionEntry {
  id: string;
  type: MojangVersionType;
  releaseTime: string;
}

export interface MojangManifestResponse {
  source: 'mojang-live' | 'offline-curated';
  latestRelease: string;
  latestSnapshot: string;
  versions: MojangVersionEntry[];
}

export interface HardwareProfile {
  cpuCores: number;
  systemRamGb: number;
  gpuTier: GpuTier;
  renderDistance: number;
  simulationDistance: number;
  entityShadows: boolean;
  particles: 'all' | 'decreased' | 'minimal';
  mipmapLevels: number;
  gcType: GcType;
  usePerformanceFlags: boolean;
}

export interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: string;
  server_side: string;
  project_type: 'mod' | 'modpack' | 'shader';
  downloads: number;
  icon_url: string;
  author: string;
  versions: string[];
  latest_version?: string;
  date_modified: string;
}

export interface AiDiagnosticResult {
  summary: string;
  estimatedFpsGain: string;
  recommendedJvmFlags: string;
  recommendedMods: string[];
  conflictWarnings: string[];
  actionSteps: string[];
  modelUsed: string;
  thinkingLevel: string;
  fallbackNotice?: string;
}
