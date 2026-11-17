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
}

export interface PhoenixPresence {
  details: string;
  state?: string;
  startedAt?: number;
}

export interface PhoenixDesktopApi {
  isElectron: true;
  getInfo: () => Promise<{
    platform: string;
    dataDir: string;
    version: string;
    microsoftConfigured: boolean;
    discordConfigured: boolean;
    totalMemMb: number;
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
