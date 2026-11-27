export interface PurrlixWorld {
  name: string;
  modified: number;
  sizeMb: number;
}

export interface PurrlixCfWorld {
  id: number;
  name: string;
  summary: string;
  author: string;
  downloads: number;
  thumbnail?: string;
  page?: string;
  fileId: number | null;
  fileName: string | null;
  downloadUrl: string | null;
}

export interface PurrlixProgressEvent {
  stage: string;
  message: string;
  percent?: number;
  level?: 'warn' | 'error';
  instanceId?: string;
}

export interface PurrlixExitInfo {
  code: number | null;
  signal: string | null;
  tail: string[];
  logFile: string;
  instanceId?: string;
  stoppedByUser?: boolean;
}

export interface PurrlixLaunchPayload {
  instance: {
    id: string;
    name: string;
    mcVersion: string;
    loader: string;
    ramMb: number;
    jvmArgs: string;
    fpsPresetId: string;
    autoFpsMods?: boolean;
    animatedCapes?: boolean;
    shaderPreset?: 'off' | 'lite' | 'high';
    resolution: { width: number; height: number };
    mods: unknown[];
  };
  hardware: {
    renderDistance: number;
    simulationDistance: number;
    entityShadows: boolean;
    particles: 'all' | 'decreased' | 'minimal';
    mipmapLevels: number;
  };
  auth: {
    type: 'offline' | 'microsoft';
    username: string;
    uuid?: string;
  };
  skin?: { skinPng: string; capePng?: string; model?: 'classic' | 'slim' };
  quickPlay?: { host: string; port?: number };
  javaPath: string;
  dataDir: string;
  hideOnLaunch?: boolean;
  phoenixClient?: boolean;
  backupOnExit?: boolean;
}

export interface PurrlixPresence {
  details: string;
  state?: string;
  startedAt?: number;
}

export type PurrlixTarget = { dataDir?: string; instanceId: string };
type Res<T = object> = Promise<({ ok: true } & T) | { ok: false; error: string }>;

export interface PurrlixCrashReport {
  hints: { title: string; fix: string }[];
  suspects: string[];
  suspectFiles?: string[];
  crashReport: string | null;
  ram: string | null;
  hasLog: boolean;
}
export interface PurrlixModHit { id: string; slug: string; title: string; description: string; icon: string; image?: string; downloads: number; author: string }
export type PurrlixContentType = 'mod' | 'shader' | 'resourcepack';
export interface PurrlixInstalledItem { type: PurrlixContentType; file: string; enabled: boolean; sizeKb: number; sha1: string; title: string; icon: string; version: string; projectId: string }
export interface PurrlixModUpdate { type: PurrlixContentType; file: string; title: string; from: string; to: string; url: string; newName: string; sha1?: string }
export interface PurrlixBackup { file: string; world: string; created: number; sizeMb: number }
export interface PurrlixScreenshot { name: string; time: number; thumb: string }
export interface PurrlixNewsItem { tag: string; name: string; body: string; date: string; url: string }

export interface PurrlixSpotifyNow {
  idle: boolean;
  title?: string;
  artist?: string;
  album?: string;
  image?: string;
  playing?: boolean;
  progressMs?: number;
  durationMs?: number;
  device?: string;
  volume?: number | null;
  url?: string;
}
export interface PurrlixRecording { name: string; sizeMb: number; time: number }
export interface PurrlixSpotifyTrack { uri: string; title: string; artist: string; image: string }
export interface PurrlixSpotifyStatus { configured: boolean; signedIn: boolean; redirectUri: string }

export interface PurrlixDesktopApi {
  perfReport: (p: PurrlixTarget & { instance: { name?: string; loader?: string; mcVersion?: string; ramMb?: number } }) => Res<{ text: string }>;
  listRecordings: () => Res<{ files: PurrlixRecording[] }>;
  recordingAction: (p: { name: string; action: 'open' | 'show' | 'delete' }) => Res;
  recorderSource: () => Res<{ id: string }>;
  recorderNote: (text: string) => Promise<{ ok: boolean }>;
  spotifyStatus: () => Res<PurrlixSpotifyStatus>;
  spotifyLogin: () => Res<PurrlixSpotifyStatus>;
  spotifyCancel: () => Res;
  spotifyLogout: () => Res;
  spotifyNow: () => Res<{ now: PurrlixSpotifyNow }>;
  spotifySearch: (p: { query: string }) => Res<{ tracks: PurrlixSpotifyTrack[] }>;
  spotifyPlayUri: (p: { uri: string }) => Res;
  spotifyControl: (p: { action: 'play' | 'pause' | 'next' | 'previous' | 'volume'; value?: number }) => Res;
  analyzeCrash: (p: PurrlixTarget & { extra?: string }) => Res<PurrlixCrashReport>;
  searchMods: (p: { query: string; type: PurrlixContentType; loader: string; mcVersion: string }) => Res<{ results: PurrlixModHit[] }>;
  installMod: (p: PurrlixTarget & { projectId: string; type: PurrlixContentType; loader: string; mcVersion: string }) => Res<{ installed: string[] }>;
  clientStatus: (p: PurrlixTarget) => Res<{ files: string[] }>;
  listMods: (p: PurrlixTarget) => Res<{ items: PurrlixInstalledItem[] }>;
  checkModUpdates: (p: PurrlixTarget & { loader: string; mcVersion: string }) => Res<{ updates: PurrlixModUpdate[] }>;
  applyModUpdates: (p: PurrlixTarget & { updates: PurrlixModUpdate[] }) => Res<{ updated: string[] }>;
  toggleMod: (p: PurrlixTarget & { type: PurrlixContentType; file: string; projectId?: string; enable: boolean }) => Res;
  removeMod: (p: PurrlixTarget & { type: PurrlixContentType; file: string; projectId?: string }) => Res;
  exportPack: (p: PurrlixTarget & { name: string; mcVersion: string; loader: string }) => Res<{ cancelled?: boolean; mods?: number; extra?: number; file?: string }>;
  importPack: (p: PurrlixTarget) => Res<{ cancelled?: boolean; name?: string; mcVersion?: string; loader?: string; files?: number }>;
  listBackups: (p: PurrlixTarget) => Res<{ backups: PurrlixBackup[] }>;
  backupWorld: (p: PurrlixTarget & { world: string }) => Res<{ file: string }>;
  restoreBackup: (p: PurrlixTarget & { file: string; world: string }) => Res<{ name: string }>;
  deleteBackup: (p: PurrlixTarget & { file: string }) => Res;
  openBackups: (p: PurrlixTarget) => Res;
  cloneInstance: (p: { dataDir?: string; fromId: string; toId: string }) => Res;
  listScreenshots: (p: PurrlixTarget) => Res<{ shots: PurrlixScreenshot[] }>;
  openScreenshot: (p: PurrlixTarget & { name: string }) => Res;
  deleteScreenshot: (p: PurrlixTarget & { name: string }) => Res;
  openScreenshotsFolder: (p: PurrlixTarget) => Res;
  getNews: () => Res<{ news: PurrlixNewsItem[] }>;
  installUpdate: () => Res<{ file: string }>;
  copyKeybinds: (p: { dataDir?: string; fromId?: string; toId: string }) => Res<{ count: number }>;
  addCape: (p: PurrlixTarget & { name: string; data: string }) => Res<{ file: string }>;
  exportCape: (p: PurrlixTarget & { name: string }) => Res<{ code: string }>;
  importCape: (p: PurrlixTarget & { code: string }) => Res<{ file: string }>;
  listCapes: (p: PurrlixTarget) => Res<{ files: string[] }>;
  fetchSkinByName: (name: string) => Promise<{ found: boolean; uuid?: string; name?: string; model?: 'classic' | 'slim'; dataUrl?: string }>;
  uploadSkin: (p: { uuid: string; skinPng: string; variant: 'classic' | 'slim' }) => Res;
  saveRecording: (buffer: ArrayBuffer) => Promise<{ ok: boolean; file?: string; error?: string }>;
  openRecordings: () => Promise<{ ok: boolean }>;
  onRecorderToggle: (cb: () => void) => () => void;
  isElectron: true;
  getInfo: () => Promise<{
    platform: string;
    dataDir: string;
    version: string;
    microsoftConfigured: boolean;
    discordConfigured: boolean;
    totalMemMb: number;
    cpus?: number;
    curseforgeConfigured: boolean;
  }>;
  pickJavaExecutable: () => Promise<string | null>;
  detectJava: (dataDir?: string) => Promise<{ path: string; major: number }[]>;
  openFolder: (payload: { dataDir?: string; instanceId?: string }) => Promise<{ ok: boolean; path?: string; error?: string }>;
  launchInstance: (
    payload: PurrlixLaunchPayload
  ) => Promise<{ ok: boolean; cancelled?: boolean; error?: string; pid?: number; gameDir?: string }>;
  stopInstance: (id: string) => Promise<{ ok: boolean }>;
  setPresence: (activity: PurrlixPresence | null) => Promise<unknown>;
  listWorlds: (p: { dataDir?: string; instanceId: string }) => Promise<{ ok: boolean; error?: string; worlds: PurrlixWorld[] }>;
  importWorld: (p: { dataDir?: string; instanceId: string }) => Promise<{ ok: boolean; cancelled?: boolean; error?: string; name?: string }>;
  searchWorlds: (query: string) => Promise<{ ok: boolean; error?: string; results: PurrlixCfWorld[] }>;
  downloadWorld: (p: { dataDir?: string; instanceId: string; world: PurrlixCfWorld }) => Promise<{ ok: boolean; error?: string; name?: string }>;
  checkUpdate: () => Promise<{ ok: boolean; latest?: string; newer?: boolean; url?: string }>;
  openMinecraft: (uri: string) => Promise<{ ok: boolean; error?: string }>;
  openExternal: (url: string) => Promise<unknown>;
  getDiscordStatus: () => Promise<{ configured: boolean; connected: boolean; activityShown: boolean; error: string }>;
  microsoftLogin: () => Promise<{ ok: boolean; uuid?: string; username?: string; error?: string }>;
  microsoftCancel: () => Promise<void>;
  microsoftRemove: (uuid: string) => Promise<void>;
  onMicrosoftCode: (cb: (c: { userCode: string; verificationUri: string }) => void) => () => void;
  onProgress: (cb: (e: PurrlixProgressEvent) => void) => () => void;
  onExit: (cb: (e: PurrlixExitInfo) => void) => () => void;
}

declare global {
  interface Window {
    phoenixDesktop?: PurrlixDesktopApi;
  }
}
