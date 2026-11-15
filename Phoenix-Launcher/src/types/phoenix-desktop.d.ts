export interface PhoenixProgressEvent {
  stage: string;
  message: string;
  percent?: number;
  level?: 'warn' | 'error';
}

export interface PhoenixExitInfo {
  code: number | null;
  signal: string | null;
  tail: string[];
  logFile: string;
  instanceId?: string;
}

export interface PhoenixLaunchPayload {
  instance: {
    id: string;
    name: string;
    mcVersion: string;
    loader: string;
    ramMb: number;
    jvmArgs: string;
    resolution: { width: number; height: number };
    mods: unknown[];
  };
  username: string;
  javaPath: string;
  dataDir: string;
}

export interface PhoenixDesktopApi {
  isElectron: true;
  getInfo: () => Promise<{ platform: string; dataDir: string; version: string }>;
  pickJavaExecutable: () => Promise<string | null>;
  detectJava: (dataDir?: string) => Promise<{ path: string; major: number }[]>;
  openFolder: (payload: { dataDir?: string; instanceId?: string }) => Promise<{ ok: boolean; path?: string; error?: string }>;
  launchInstance: (
    payload: PhoenixLaunchPayload
  ) => Promise<{ ok: boolean; error?: string; pid?: number; gameDir?: string }>;
  onProgress: (cb: (e: PhoenixProgressEvent) => void) => () => void;
  onExit: (cb: (e: PhoenixExitInfo) => void) => () => void;
}

declare global {
  interface Window {
    phoenixDesktop?: PhoenixDesktopApi;
  }
}
