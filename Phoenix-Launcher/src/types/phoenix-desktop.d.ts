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
  }>;
  pickJavaExecutable: () => Promise<string | null>;
  detectJava: (dataDir?: string) => Promise<{ path: string; major: number }[]>;
  openFolder: (payload: { dataDir?: string; instanceId?: string }) => Promise<{ ok: boolean; path?: string; error?: string }>;
  launchInstance: (
    payload: PhoenixLaunchPayload
  ) => Promise<{ ok: boolean; cancelled?: boolean; error?: string; pid?: number; gameDir?: string }>;
  stopInstance: (id: string) => Promise<{ ok: boolean }>;
  setPresence: (activity: PhoenixPresence | null) => Promise<void>;
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
