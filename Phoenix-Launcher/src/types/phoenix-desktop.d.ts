export interface PhoenixWorld {
  name: string;
  modified: number;
  sizeMb: number;
}

export interface PhoenixCfWorld {
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

export interface PhoenixProgressEvent {
  stage: string;
  message: string;
  percent?: number;
  level?: 'warn' | 'error';
  instanceId?: string;
}

export interface PhoenixExitInfo {
  code: number | null;
  signal: string | null;
  tail: string[];
  logFile: string;
  instanceId?: string;
  stoppedByUser?: boolean;
}

export interface PhoenixLaunchPayload {
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
  skin?: { skinPng: string; capePng?: string };
  quickPlay?: { host: string; port?: number };
  javaPath: string;
  dataDir: string;
  hideOnLaunch?: boolean;
  phoenixClient?: boolean;
  backupOnExit?: boolean;
}

export interface PhoenixPresence {
  details: string;
  state?: string;
  startedAt?: number;
}

export type PhoenixTarget = { dataDir?: string; instanceId: string };
type Res<T = object> = Promise<({ ok: true } & T) | { ok: false; error: string }>;

export interface PhoenixCrashReport {
  hints: { title: string; fix: string }[];
  suspects: string[];
  suspectFiles?: string[];
  crashReport: string | null;
  ram: string | null;
  hasLog: boolean;
}
export interface PhoenixModHit { id: string; slug: string; title: string; description: string; icon: string; image?: string; downloads: number; author: string }
export type PhoenixContentType = 'mod' | 'shader' | 'resourcepack';
export interface PhoenixInstalledItem { type: PhoenixContentType; file: string; enabled: boolean; sizeKb: number; sha1: string; title: string; icon: string; version: string; projectId: string }
export interface PhoenixModUpdate { type: PhoenixContentType; file: string; title: string; from: string; to: string; url: string; newName: string; sha1?: string }
export interface PhoenixBackup { file: string; world: string; created: number; sizeMb: number }
export interface PhoenixScreenshot { name: string; time: number; thumb: string }
export interface PhoenixNewsItem { tag: string; name: string; body: string; date: string; url: string }

export interface PhoenixSpotifyNow {
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
export interface PhoenixRecording { name: string; sizeMb: number; time: number }
export interface PhoenixSpotifyTrack { uri: string; title: string; artist: string; image: string }
export interface PhoenixSpotifyStatus { configured: boolean; signedIn: boolean; redirectUri: string }

export interface PhoenixDesktopApi {
  perfReport: (p: PhoenixTarget & { instance: { name?: string; loader?: string; mcVersion?: string; ramMb?: number } }) => Res<{ text: string }>;
  listRecordings: () => Res<{ files: PhoenixRecording[] }>;
  recordingAction: (p: { name: string; action: 'open' | 'show' | 'delete' }) => Res;
  recorderSource: () => Res<{ id: string }>;
  recorderNote: (text: string) => Promise<{ ok: boolean }>;
  spotifyStatus: () => Res<PhoenixSpotifyStatus>;
  spotifyLogin: () => Res<PhoenixSpotifyStatus>;
  spotifyCancel: () => Res;
  spotifyLogout: () => Res;
  spotifyNow: () => Res<{ now: PhoenixSpotifyNow }>;
  spotifySearch: (p: { query: string }) => Res<{ tracks: PhoenixSpotifyTrack[] }>;
  spotifyPlayUri: (p: { uri: string }) => Res;
  spotifyControl: (p: { action: 'play' | 'pause' | 'next' | 'previous' | 'volume'; value?: number }) => Res;
  analyzeCrash: (p: PhoenixTarget & { extra?: string }) => Res<PhoenixCrashReport>;
  searchMods: (p: { query: string; type: PhoenixContentType; loader: string; mcVersion: string }) => Res<{ results: PhoenixModHit[] }>;
  installMod: (p: PhoenixTarget & { projectId: string; type: PhoenixContentType; loader: string; mcVersion: string }) => Res<{ installed: string[] }>;
  clientStatus: (p: PhoenixTarget) => Res<{ files: string[] }>;
  listMods: (p: PhoenixTarget) => Res<{ items: PhoenixInstalledItem[] }>;
  checkModUpdates: (p: PhoenixTarget & { loader: string; mcVersion: string }) => Res<{ updates: PhoenixModUpdate[] }>;
  applyModUpdates: (p: PhoenixTarget & { updates: PhoenixModUpdate[] }) => Res<{ updated: string[] }>;
  toggleMod: (p: PhoenixTarget & { type: PhoenixContentType; file: string; projectId?: string; enable: boolean }) => Res;
  removeMod: (p: PhoenixTarget & { type: PhoenixContentType; file: string; projectId?: string }) => Res;
  exportPack: (p: PhoenixTarget & { name: string; mcVersion: string; loader: string }) => Res<{ cancelled?: boolean; mods?: number; extra?: number; file?: string }>;
  importPack: (p: PhoenixTarget) => Res<{ cancelled?: boolean; name?: string; mcVersion?: string; loader?: string; files?: number }>;
  listBackups: (p: PhoenixTarget) => Res<{ backups: PhoenixBackup[] }>;
  backupWorld: (p: PhoenixTarget & { world: string }) => Res<{ file: string }>;
  restoreBackup: (p: PhoenixTarget & { file: string; world: string }) => Res<{ name: string }>;
  deleteBackup: (p: PhoenixTarget & { file: string }) => Res;
  openBackups: (p: PhoenixTarget) => Res;
  cloneInstance: (p: { dataDir?: string; fromId: string; toId: string }) => Res;
  listScreenshots: (p: PhoenixTarget) => Res<{ shots: PhoenixScreenshot[] }>;
  openScreenshot: (p: PhoenixTarget & { name: string }) => Res;
  deleteScreenshot: (p: PhoenixTarget & { name: string }) => Res;
  openScreenshotsFolder: (p: PhoenixTarget) => Res;
  getNews: () => Res<{ news: PhoenixNewsItem[] }>;
  installUpdate: () => Res<{ file: string }>;
  copyKeybinds: (p: { dataDir?: string; fromId?: string; toId: string }) => Res<{ count: number }>;
  addCape: (p: PhoenixTarget & { name: string; data: string }) => Res<{ file: string }>;
  exportCape: (p: PhoenixTarget & { name: string }) => Res<{ code: string }>;
  importCape: (p: PhoenixTarget & { code: string }) => Res<{ file: string }>;
  listCapes: (p: PhoenixTarget) => Res<{ files: string[] }>;
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
    payload: PhoenixLaunchPayload
  ) => Promise<{ ok: boolean; cancelled?: boolean; error?: string; pid?: number; gameDir?: string }>;
  stopInstance: (id: string) => Promise<{ ok: boolean }>;
  setPresence: (activity: PhoenixPresence | null) => Promise<unknown>;
  listWorlds: (p: { dataDir?: string; instanceId: string }) => Promise<{ ok: boolean; error?: string; worlds: PhoenixWorld[] }>;
  importWorld: (p: { dataDir?: string; instanceId: string }) => Promise<{ ok: boolean; cancelled?: boolean; error?: string; name?: string }>;
  searchWorlds: (query: string) => Promise<{ ok: boolean; error?: string; results: PhoenixCfWorld[] }>;
  downloadWorld: (p: { dataDir?: string; instanceId: string; world: PhoenixCfWorld }) => Promise<{ ok: boolean; error?: string; name?: string }>;
  checkUpdate: () => Promise<{ ok: boolean; latest?: string; newer?: boolean; url?: string }>;
  openMinecraft: (uri: string) => Promise<{ ok: boolean; error?: string }>;
  openExternal: (url: string) => Promise<unknown>;
  getDiscordStatus: () => Promise<{ configured: boolean; connected: boolean; activityShown: boolean; error: string }>;
  microsoftLogin: () => Promise<{ ok: boolean; uuid?: string; username?: string; error?: string }>;
  microsoftCancel: () => Promise<void>;
  microsoftRemove: (uuid: string) => Promise<void>;
  onMicrosoftCode: (cb: (c: { userCode: string; verificationUri: string }) => void) => () => void;
  onProgress: (cb: (e: PhoenixProgressEvent) => void) => () => void;
  onExit: (cb: (e: PhoenixExitInfo) => void) => () => void;
}

declare global {
  interface Window {
    phoenixDesktop?: PhoenixDesktopApi;
  }
}
