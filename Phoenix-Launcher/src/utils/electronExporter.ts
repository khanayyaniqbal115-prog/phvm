import JSZip from 'jszip';
import realMainCjs from '../../electron/main.cjs?raw';
import realPreloadCjs from '../../electron/preload.cjs?raw';
import realLauncherCjs from '../../electron/launcher.cjs?raw';
import realLocalServerCjs from '../../electron/localServer.cjs?raw';
import realZipCjs from '../../electron/zip.cjs?raw';
import realConfigCjs from '../../electron/config.cjs?raw';
import realDiscordCjs from '../../electron/discord.cjs?raw';
import realMicrosoftCjs from '../../electron/microsoft.cjs?raw';
import type { MinecraftInstance } from '../types/launcher';

export interface ElectronBundleFiles {
  mainCjs: string;
  preloadCjs: string;
  packageJson: string;
  builderYml: string;
  readmeMd: string;
}

export function generateElectronFiles(instances: MinecraftInstance[], javaPath: string, mcDir: string): ElectronBundleFiles {
  // Real, working files (an earlier version generated a fake -jar bootstrap launcher here)
  void javaPath;
  void mcDir;
  const mainCjs = realMainCjs;
  const preloadCjs = realPreloadCjs;

  const packageJson = JSON.stringify(
    {
      name: 'phoenix-launcher-desktop',
      version: '1.0.0',
      description: 'Purrlix Launcher — Modpacks, 3D Skin Studio & Low-End FPS Optimizer',
      main: 'electron/main.cjs',
      scripts: {
        'build:web': 'vite build',
        'electron:dev': 'electron .',
        'dist:win': 'npm run build:web && electron-builder --win nsis portable',
      },
      build: {
        appId: 'com.phoenixlauncher.desktop',
        productName: 'Purrlix Launcher',
        directories: {
          output: 'release',
        },
        files: ['dist/**/*', 'electron/**/*'],
        win: {
          target: ['nsis', 'portable'],
        },
      },
      devDependencies: {
        electron: '^35.0.0',
        'electron-builder': '^25.1.8',
      },
    },
    null,
    2
  );

  const builderYml = `appId: com.phoenixlauncher.desktop
productName: Purrlix Launcher
copyright: Purrlix Launcher
directories:
  output: release
files:
  - dist/**/*
  - electron/**/*
win:
  target:
    - target: nsis
      arch:
        - x64
    - target: portable
      arch:
        - x64
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
`;

  const instanceSummary = instances
    .map((inst) => `- **${inst.name}** (${inst.mcVersion} / ${inst.loader}) — ${inst.ramMb} MB RAM`)
    .join('\n');

  const readmeMd = `# Purrlix Launcher — Windows .exe Build Guide

This bundle packages Purrlix Launcher into a native Windows \`.exe\` desktop application using Electron and \`electron-builder\`.

## Included Instances Snapshot
${instanceSummary}

## Build Steps on Windows 10 / 11

1. Install **Node.js 20+** and **Java 21 (Temurin / Adoptium)** for Minecraft 1.20.5+.
2. Extract this zip into your Purrlix Launcher project folder.
3. Install dependencies:
   \`\`\`bash
   npm install
   npm install -D electron electron-builder
   \`\`\`
4. Build the Windows \`.exe\` installer & portable executable:
   \`\`\`bash
   npx vite build
   npx electron-builder --win nsis portable --config electron-builder.yml
   \`\`\`
5. Find your compiled executables inside the \`release/\` folder:
   - \`Purrlix Launcher Setup 1.0.0.exe\` (Installer)
   - \`Purrlix Launcher 1.0.0.exe\` (Portable .exe)
`;

  return {
    mainCjs,
    preloadCjs,
    packageJson,
    builderYml,
    readmeMd,
  };
}

export async function downloadElectronBundleZip(instances: MinecraftInstance[], javaPath: string, mcDir: string) {
  const files = generateElectronFiles(instances, javaPath, mcDir);
  const zip = new JSZip();
  zip.file('electron/main.cjs', files.mainCjs);
  zip.file('electron/preload.cjs', files.preloadCjs);
  zip.file('electron/launcher.cjs', realLauncherCjs);
  zip.file('electron/localServer.cjs', realLocalServerCjs);
  zip.file('electron/zip.cjs', realZipCjs);
  zip.file('electron/config.cjs', realConfigCjs);
  zip.file('electron/discord.cjs', realDiscordCjs);
  zip.file('electron/microsoft.cjs', realMicrosoftCjs);
  zip.file('electron-builder.yml', files.builderYml);
  zip.file('package.electron.json', files.packageJson);
  zip.file('BUILD-WINDOWS-EXE.md', files.readmeMd);
  zip.file('instances.phoenix.json', JSON.stringify(instances, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'phoenix-launcher-electron-exe-bundle.zip';
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadInstanceLaunchScript(instance: MinecraftInstance, username: string, javaPath: string, format: 'bat' | 'sh') {
  const safeName = instance.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const enabledMods = instance.mods.filter((m) => m.enabled).map((m) => m.title).join(', ') || 'None (Vanilla)';

  const content =
    format === 'bat'
      ? `@echo off
title Purrlix Launcher - ${instance.name}
echo Starting ${instance.name} (${instance.mcVersion} / ${instance.loader}) for ${username}...
echo Active Mods: ${enabledMods}
"${javaPath || 'javaw.exe'}" ${instance.jvmArgs} -Dminecraft.launcher.brand=phoenix-launcher -Dphoenix.user="${username}" -Dphoenix.width=${instance.resolution.width} -Dphoenix.height=${instance.resolution.height} -version
echo.
echo [Phoenix] Verify Java 17/21 is installed and place your Minecraft client jar in this instance folder.
pause
`
      : `#!/usr/bin/env bash
echo "Starting ${instance.name} (${instance.mcVersion} / ${instance.loader}) for ${username}..."
echo "Active Mods: ${enabledMods}"
"${javaPath || 'java'}" ${instance.jvmArgs} -Dminecraft.launcher.brand=phoenix-launcher -Dphoenix.user="${username}" -Dphoenix.width=${instance.resolution.width} -Dphoenix.height=${instance.resolution.height} -version
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `launch-${safeName}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadAllProjectFilesZip(
  instances: MinecraftInstance[],
  javaPath: string,
  mcDir: string
): Promise<number> {
  const res = await fetch('/api/download/all-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ javaPath, mcDir, instances }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson.error) msg = errJson.error;
    } catch {
      // Ignore parse failure
    }
    throw new Error(msg);
  }

  const rawBuf = await res.arrayBuffer();
  const blob = new Blob([rawBuf], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Phoenix-Launcher-All-Files.zip';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return rawBuf.byteLength;
}
