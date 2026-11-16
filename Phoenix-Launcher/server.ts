import express from 'express';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ELECTRON_CACHE_DIR = path.join(os.tmpdir(), 'phoenix-electron-cache');
const ELECTRON_FALLBACK_VERSION = '35.0.0';
const CHUNK_SIZE_BYTES = 12 * 1024 * 1024; // 12 MB per chunk (safely below 32 MB proxy cap)

// Lazy client: GEMINI_API_KEY na ho to server start hi crash na kare
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

const MODRINTH_USER_AGENT = 'PhoenixLauncher/1.0 (contact@phoenixlauncher.local)';

const FALLBACK_MODRINTH_HITS = [
  {
    project_id: 'AANobbMI',
    slug: 'sodium',
    title: 'Sodium',
    description: 'The fastest and most compatible rendering optimization mod for Minecraft.',
    categories: ['optimization', 'fabric', 'neoforge'],
    client_side: 'required',
    server_side: 'unsupported',
    project_type: 'mod',
    downloads: 98400000,
    icon_url: '',
    author: 'jellysquid3',
    versions: ['1.21.4', '1.21.1', '1.20.1', '1.19.2'],
    latest_version: 'mc1.21.4-0.6.5',
    date_modified: '2026-10-12T12:00:00Z',
  },
  {
    project_id: '1KVo5zza',
    slug: 'fabulously-optimized',
    title: 'Fabulously Optimized',
    description: 'A simple Minecraft modpack focusing on FPS improvements and OptiFine parity.',
    categories: ['optimization', 'challenging', 'lightweight'],
    client_side: 'required',
    server_side: 'optional',
    project_type: 'modpack',
    downloads: 16200000,
    icon_url: '',
    author: 'robotkoer',
    versions: ['1.21.4', '1.21.1', '1.20.1', '1.19.2'],
    latest_version: '6.2.0',
    date_modified: '2026-10-28T12:00:00Z',
  },
  {
    project_id: 'gvQqBUqZ',
    slug: 'lithium',
    title: 'Lithium',
    description: 'General-purpose optimization mod which works to improve game physics, mob AI, and chunk ticking.',
    categories: ['optimization', 'fabric', 'neoforge'],
    client_side: 'optional',
    server_side: 'optional',
    project_type: 'mod',
    downloads: 64100000,
    icon_url: '',
    author: 'jellysquid3',
    versions: ['1.21.4', '1.21.1', '1.20.1', '1.19.2'],
    latest_version: 'mc1.21.4-0.14.2',
    date_modified: '2026-10-18T12:00:00Z',
  },
  {
    project_id: 'uXXizFIs',
    slug: 'ferrite-core',
    title: 'FerriteCore',
    description: 'Memory usage optimizations reducing RAM overhead by up to 45% on modded Minecraft.',
    categories: ['optimization', 'fabric', 'forge', 'neoforge'],
    client_side: 'optional',
    server_side: 'optional',
    project_type: 'mod',
    downloads: 52700000,
    icon_url: '',
    author: 'malte0811',
    versions: ['1.21.4', '1.21.1', '1.20.1', '1.19.2', '1.16.5'],
    latest_version: '7.0.2',
    date_modified: '2026-10-05T12:00:00Z',
  },
  {
    project_id: 'Byf7hC2W',
    slug: 'simply-optimized',
    title: 'Simply Optimized',
    description: 'Minimalist Fabric modpack engineered to squeeze maximum FPS out of older laptops and iGPUs.',
    categories: ['optimization', 'lightweight'],
    client_side: 'required',
    server_side: 'unsupported',
    project_type: 'modpack',
    downloads: 4850000,
    icon_url: '',
    author: 'HyperSoop',
    versions: ['1.21.4', '1.21.1', '1.20.1', '1.19.2'],
    latest_version: '1.21.4-2.1',
    date_modified: '2026-10-20T12:00:00Z',
  },
  {
    project_id: 'NNAgCjsB',
    slug: 'entityculling',
    title: 'EntityCulling',
    description: 'Using async path-tracing to skip rendering Entities and TileEntities not visible behind walls.',
    categories: ['optimization', 'fabric', 'forge', 'neoforge'],
    client_side: 'required',
    server_side: 'unsupported',
    project_type: 'mod',
    downloads: 49300000,
    icon_url: '',
    author: 'tr7zw',
    versions: ['1.21.4', '1.21.1', '1.20.1', '1.19.2'],
    latest_version: '1.7.2',
    date_modified: '2026-10-22T12:00:00Z',
  },
  {
    project_id: 'HVnmMxH1',
    slug: 'complementary-reimagined',
    title: 'Complementary Shaders - Reimagined',
    description: 'Preserving vanilla Minecraft aesthetic with volumetric clouds, crisp shadows, and PBR reflections for high-end GPUs.',
    categories: ['iris', 'vanilla-like', 'high'],
    client_side: 'required',
    server_side: 'unsupported',
    project_type: 'shader',
    downloads: 31500000,
    icon_url: '',
    author: 'EminGT',
    versions: ['1.21.5', '1.21.4', '1.21.1', '1.20.1'],
    latest_version: 'r5.4',
    date_modified: '2026-11-01T12:00:00Z',
  },
  {
    project_id: 'uCdwagent',
    slug: 'distanthorizons',
    title: 'Distant Horizons',
    description: 'Level-of-detail (LOD) renderer enabling 32 to 256+ chunk panoramic views with minimal GPU overhead.',
    categories: ['optimization', 'fabric', 'neoforge'],
    client_side: 'required',
    server_side: 'optional',
    project_type: 'mod',
    downloads: 18900000,
    icon_url: '',
    author: 'James_Seibel',
    versions: ['1.21.4', '1.21.1', '1.20.1'],
    latest_version: '2.3.0-a',
    date_modified: '2026-11-04T12:00:00Z',
  },
];

function buildElectronMainCjs(javaPath: string, mcDir: string): string {
  const safeJava = (javaPath || 'javaw.exe').replace(/\\/g, '\\\\');
  const safeDir = (mcDir || '%APPDATA%\\\\.phoenix-launcher').replace(/\\/g, '\\\\');
  return `const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const DEFAULT_JAVA_PATH = '${safeJava}';
const LAUNCHER_DATA_DIR = '${safeDir}';

function createWindow() {
  const win = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#090C12',
    title: 'Phoenix Launcher',
    icon: path.join(__dirname, '../phoenix.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.PHOENIX_DEV_URL) {
    win.loadURL(process.env.PHOENIX_DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

ipcMain.handle('phoenix:pick-java', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select javaw.exe',
    filters: [{ name: 'Java Executable', extensions: ['exe'] }],
    properties: ['openFile'],
  });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('phoenix:launch-instance', async (_event, payload) => {
  const { instanceName, mcVersion, loader, jvmArgs, gameDir } = payload;
  const targetDir = gameDir || path.join(LAUNCHER_DATA_DIR, 'instances', instanceName);
  fs.mkdirSync(targetDir, { recursive: true });

  const args = [
    ...String(jvmArgs || '-Xms2048M -Xmx4096M').split(/\\s+/).filter(Boolean),
    '-Dminecraft.launcher.brand=phoenix-launcher',
    '-Dminecraft.launcher.version=1.0.0',
    '-Dphoenix.instance=' + instanceName,
    '-Dphoenix.loader=' + loader,
    '-Dphoenix.mcVersion=' + mcVersion,
    '-jar',
    path.join(targetDir, 'phoenix-bootstrap.jar'),
  ];

  const proc = spawn(DEFAULT_JAVA_PATH, args, {
    cwd: targetDir,
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();
  return { pid: proc.pid, gameDir: targetDir };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`;
}

const ELECTRON_PRELOAD_CJS = `const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('phoenixDesktop', {
  isElectron: true,
  pickJavaExecutable: () => ipcRenderer.invoke('phoenix:pick-java'),
  launchInstance: (payload) => ipcRenderer.invoke('phoenix:launch-instance', payload),
});
`;

async function ensurePhoenixIco(icoPath: string): Promise<void> {
  if (existsSync(icoPath)) return;
  const pyIco = `
import struct, zlib, sys

def make_png(size):
    raw = bytearray()
    cx, cy = size * 0.5, size * 0.5
    rad = size * 0.44
    for y in range(size):
        raw.append(0)
        for x in range(size):
            # Rounded obsidian square tile
            dx = abs(x - cx)
            dy = abs(y - cy)
            corner = max(0.0, dx - size*0.32)**2 + max(0.0, dy - size*0.32)**2
            if corner > (size*0.14)**2:
                raw.extend((0, 0, 0, 0))
                continue
            # Phoenix geometric crest wing & beak
            nx = (x - cx) / rad
            ny = (y - cy) / rad
            in_wing = (-0.65 <= nx <= 0.15) and (abs(ny - (nx * 0.55 - 0.1)) < 0.28 or abs(ny - (nx * 0.65 + 0.26)) < 0.16)
            in_body = (0.0 <= nx <= 0.52) and (abs(ny + nx * 0.35 - 0.08) < 0.24)
            in_head = (0.28 <= nx <= 0.68) and (-0.42 <= ny <= -0.1) and (ny <= -0.1 + 0.3*(0.68 - nx))
            if in_wing or in_body or in_head:
                # Molten ember orange gradient
                r = 249
                g = int(115 + max(0, min(1, 0.5 - ny)) * 75)
                b = 22
                raw.extend((r, g, b, 255))
            else:
                raw.extend((11, 14, 20, 255))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

sizes = [32, 64, 128]
pngs = [make_png(s) for s in sizes]
header = struct.pack('<HHH', 0, 1, len(pngs))
offset = 6 + 16 * len(pngs)
entries = bytearray()
for s, p in zip(sizes, pngs):
    w = 0 if s >= 256 else s
    entries.extend(struct.pack('<BBBBHHII', w, w, 0, 0, 1, 32, len(p), offset))
    offset += len(p)

with open(sys.argv[1], 'wb') as f:
    f.write(header + entries + b''.join(pngs))
`;
  await execFileAsync('python3', ['-c', pyIco, icoPath]);
}

async function ensureElectronWinZip(): Promise<{ zipPath: string; version: string }> {
  await fs.mkdir(ELECTRON_CACHE_DIR, { recursive: true });

  let version = ELECTRON_FALLBACK_VERSION;
  try {
    const releaseRes = await fetch('https://api.github.com/repos/electron/electron/releases/latest', {
      headers: { 'User-Agent': MODRINTH_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (releaseRes.ok) {
      const json = (await releaseRes.json()) as { tag_name?: string };
      if (json.tag_name) {
        version = json.tag_name.replace(/^v/, '');
      }
    }
  } catch {
    // Use pinned fallback version
  }

  const cachedZip = path.join(ELECTRON_CACHE_DIR, `electron-v${version}-win32-x64.zip`);
  if (existsSync(cachedZip)) {
    const stat = await fs.stat(cachedZip);
    if (stat.size > 50_000_000) {
      return { zipPath: cachedZip, version };
    }
  }

  const downloadUrl = `https://github.com/electron/electron/releases/download/v${version}/electron-v${version}-win32-x64.zip`;
  await execFileAsync('curl', ['-L', '--fail', '--max-time', '120', '-o', cachedZip, downloadUrl]);
  return { zipPath: cachedZip, version };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Phoenix Launcher' });
  });

  const FALLBACK_MOJANG_MANIFEST = {
    latestRelease: '1.21.5',
    latestSnapshot: '26.4-snapshot-8',
    versions: [
      { id: '26.4-snapshot-8', type: 'snapshot', releaseTime: '2026-11-12T14:00:00+00:00' },
      { id: '26.3', type: 'release', releaseTime: '2026-10-20T12:00:00+00:00' },
      { id: '1.21.5', type: 'release', releaseTime: '2025-03-25T12:00:00+00:00' },
      { id: '1.21.4', type: 'release', releaseTime: '2024-12-03T10:12:57+00:00' },
      { id: '1.21.1', type: 'release', releaseTime: '2024-08-08T12:24:45+00:00' },
      { id: '1.20.4', type: 'release', releaseTime: '2023-12-07T12:56:20+00:00' },
      { id: '1.20.1', type: 'release', releaseTime: '2023-06-12T13:25:51+00:00' },
      { id: '1.19.4', type: 'release', releaseTime: '2023-03-14T10:56:15+00:00' },
      { id: '1.19.2', type: 'release', releaseTime: '2022-08-05T11:57:05+00:00' },
      { id: '1.18.2', type: 'release', releaseTime: '2022-02-28T10:42:45+00:00' },
      { id: '1.16.5', type: 'release', releaseTime: '2021-01-15T10:03:45+00:00' },
      { id: '1.12.2', type: 'release', releaseTime: '2017-09-18T08:39:46+00:00' },
      { id: '1.8.9', type: 'release', releaseTime: '2015-12-03T09:24:39+00:00' },
      { id: '1.7.10', type: 'release', releaseTime: '2014-05-14T17:29:23+00:00' },
      { id: '1.0', type: 'release', releaseTime: '2011-11-18T22:00:00+00:00' },
      { id: '25w14craftmine', type: 'snapshot', releaseTime: '2025-04-01T12:00:00+00:00' },
      { id: '25w10a', type: 'snapshot', releaseTime: '2025-03-05T14:00:00+00:00' },
      { id: '24w45a', type: 'snapshot', releaseTime: '2024-11-06T14:00:00+00:00' },
      { id: 'b1.8.1', type: 'old_beta', releaseTime: '2011-09-15T22:00:00+00:00' },
      { id: 'b1.7.3', type: 'old_beta', releaseTime: '2011-07-08T22:00:00+00:00' },
      { id: 'b1.0', type: 'old_beta', releaseTime: '2010-12-20T22:00:00+00:00' },
      { id: 'a1.2.6', type: 'old_alpha', releaseTime: '2010-12-03T22:00:00+00:00' },
      { id: 'a1.1.2_01', type: 'old_alpha', releaseTime: '2010-09-23T22:00:00+00:00' },
      { id: 'a1.0.4', type: 'old_alpha', releaseTime: '2010-07-09T22:00:00+00:00' },
    ],
  };

  let mojangCache: {
    fetchedAt: number;
    latestRelease: string;
    latestSnapshot: string;
    versions: Array<{ id: string; type: string; releaseTime: string }>;
  } | null = null;

  app.get('/api/mojang/versions', async (_req, res) => {
    const now = Date.now();
    if (mojangCache && now - mojangCache.fetchedAt < 15 * 60 * 1000) {
      res.json({
        source: 'mojang-live',
        latestRelease: mojangCache.latestRelease,
        latestSnapshot: mojangCache.latestSnapshot,
        versions: mojangCache.versions,
      });
      return;
    }

    try {
      const response = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', {
        headers: { 'User-Agent': MODRINTH_USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error(`Mojang manifest responded with HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        latest?: { release?: string; snapshot?: string };
        versions?: Array<{ id: string; type: string; releaseTime: string }>;
      };

      const compactVersions = Array.isArray(data.versions)
        ? data.versions.map((v) => ({
            id: v.id,
            type: v.type,
            releaseTime: v.releaseTime,
          }))
        : [];

      if (compactVersions.length > 0) {
        mojangCache = {
          fetchedAt: now,
          latestRelease: data.latest?.release || compactVersions.find((v) => v.type === 'release')?.id || '1.21.4',
          latestSnapshot: data.latest?.snapshot || compactVersions.find((v) => v.type === 'snapshot')?.id || '26.4-snapshot-8',
          versions: compactVersions,
        };

        res.json({
          source: 'mojang-live',
          latestRelease: mojangCache.latestRelease,
          latestSnapshot: mojangCache.latestSnapshot,
          versions: mojangCache.versions,
        });
        return;
      }
      throw new Error('Empty version list from Mojang manifest.');
    } catch {
      res.json({
        source: 'offline-curated',
        ...FALLBACK_MOJANG_MANIFEST,
      });
    }
  });

  app.get('/api/modrinth/search', async (req, res) => {
    const query = String(req.query.query ?? '').trim();
    const projectType = String(req.query.projectType ?? 'all').trim();
    const version = String(req.query.version ?? '').trim();
    const loader = String(req.query.loader ?? '').trim();
    const category = String(req.query.category ?? '').trim();
    const index = String(req.query.index ?? 'downloads').trim();
    const limit = Math.min(Math.max(Number(req.query.limit ?? 18), 1), 30);

    const facets: string[][] = [];
    if (projectType === 'modpack' || projectType === 'mod' || projectType === 'shader') {
      facets.push([`project_type:${projectType}`]);
    } else {
      facets.push(['project_type:modpack', 'project_type:mod', 'project_type:shader']);
    }
    if (version && version !== 'all') {
      facets.push([`versions:${version}`]);
    }
    if (loader && loader !== 'all' && loader !== 'vanilla') {
      facets.push([`categories:${loader}`]);
    }
    if (category && category !== 'all') {
      facets.push([`categories:${category}`]);
    }

    const params = new URLSearchParams({
      query,
      facets: JSON.stringify(facets),
      index,
      limit: String(limit),
    });

    try {
      const response = await fetch(`https://api.modrinth.com/v2/search?${params.toString()}`, {
        headers: {
          'User-Agent': MODRINTH_USER_AGENT,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`Modrinth responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      res.json({
        source: 'modrinth-live',
        hits: data.hits ?? [],
        total_hits: data.total_hits ?? 0,
      });
    } catch (error) {
      const q = query.toLowerCase();
      const filtered = FALLBACK_MODRINTH_HITS.filter((item) => {
        if (projectType !== 'all' && item.project_type !== projectType) return false;
        if (version && version !== 'all' && !item.versions.includes(version)) return false;
        if (loader && loader !== 'all' && loader !== 'vanilla' && !item.categories.includes(loader) && item.project_type === 'mod') {
          return false;
        }
        if (q && !item.title.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      });
      res.json({
        source: 'offline-curated',
        warning: error instanceof Error ? error.message : 'Unable to reach Modrinth API',
        hits: filtered,
        total_hits: filtered.length,
      });
    }
  });

  app.get('/api/modrinth/project/:id/versions', async (req, res) => {
    const projectId = req.params.id;
    const loader = req.query.loader ? String(req.query.loader) : '';
    const version = req.query.version ? String(req.query.version) : '';

    const params = new URLSearchParams();
    if (loader && loader !== 'all' && loader !== 'vanilla') {
      params.set('loaders', JSON.stringify([loader]));
    }
    if (version && version !== 'all') {
      params.set('game_versions', JSON.stringify([version]));
    }

    try {
      const url = `https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}/versions${
        params.toString() ? `?${params.toString()}` : ''
      }`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': MODRINTH_USER_AGENT,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error(`Modrinth versions responded with HTTP ${response.status}`);
      }
      const versions = await response.json();
      res.json({ versions: Array.isArray(versions) ? versions.slice(0, 8) : [] });
    } catch (error) {
      res.json({
        versions: [],
        warning: error instanceof Error ? error.message : 'Unable to fetch version metadata',
      });
    }
  });

  async function ensureNsisCompiler(): Promise<{ makensisBin: string; nsisDir: string }> {
    await fs.mkdir(ELECTRON_CACHE_DIR, { recursive: true });
    const nsisBase = path.join(ELECTRON_CACHE_DIR, 'nsis');
    const nsisBundleDir = path.join(nsisBase, 'nsis-bundle');
    const makensisBin = path.join(nsisBundleDir, 'linux', 'x64', 'makensis');
    const nsisDir = path.join(nsisBundleDir, 'windows');

    if (existsSync(makensisBin) && existsSync(path.join(nsisDir, 'Include', 'MUI2.nsh'))) {
      return { makensisBin, nsisDir };
    }

    await fs.mkdir(nsisBase, { recursive: true });
    const tgzPath = path.join(ELECTRON_CACHE_DIR, 'nsis-bundle-3.13.tar.gz');
    const nsisUrl =
      'https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis%402.0.4/nsis-bundle-3.13.tar.gz';
    await execFileAsync('curl', ['-L', '--fail', '--max-time', '60', '-o', tgzPath, nsisUrl]);
    await execFileAsync('tar', ['-xzf', tgzPath, '-C', nsisBase]);
    await fs.chmod(makensisBin, 0o755);

    return { makensisBin, nsisDir };
  }

  // Prepare real Windows PE NSIS Installer (PhoenixLauncher-Setup.exe) and return chunk manifest
  app.post('/api/download/windows-exe/prepare', async (req, res) => {
    try {
      const { javaPath = 'javaw.exe', mcDir = '%APPDATA%\\.phoenix-launcher', instances = [] } = req.body ?? {};
      const distDir = path.resolve(__dirname, 'dist');

      if (!existsSync(path.join(distDir, 'index.html'))) {
        await execFileAsync('npx', ['vite', 'build'], { cwd: __dirname });
      }

      const [{ zipPath: baseElectronZip, version }, { makensisBin, nsisDir }] = await Promise.all([
        ensureElectronWinZip(),
        ensureNsisCompiler(),
      ]);

      const icoPath = path.join(ELECTRON_CACHE_DIR, 'phoenix.ico');
      await ensurePhoenixIco(icoPath);

      const nsisStageRoot = path.join(ELECTRON_CACHE_DIR, 'nsis-full-stage');
      const baseWinCache = path.join(ELECTRON_CACHE_DIR, `electron-win64-v${version}`);

      // Extract Electron win32-x64 once (keep only en-US locale to trim bloat)
      if (!existsSync(path.join(baseWinCache, 'Phoenix Launcher.exe'))) {
        await fs.rm(baseWinCache, { recursive: true, force: true });
        await fs.mkdir(baseWinCache, { recursive: true });
        const extractScript = `
import os, sys, zipfile
zip_path, out_dir = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path, 'r') as zin:
    for info in zin.infolist():
        name = info.filename
        if name.startswith('locales/') and not name.endswith('en-US.pak') and name != 'locales/':
            continue
        target_name = 'Phoenix Launcher.exe' if name == 'electron.exe' else name
        out_path = os.path.join(out_dir, target_name)
        if name.endswith('/'):
            os.makedirs(out_path, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, 'wb') as fout:
                fout.write(zin.read(name))
`;
        await execFileAsync('python3', ['-c', extractScript, baseElectronZip, baseWinCache]);
      }

      await fs.rm(nsisStageRoot, { recursive: true, force: true });
      await fs.cp(baseWinCache, nsisStageRoot, { recursive: true });

      const appStageDir = path.join(nsisStageRoot, 'resources', 'app');
      await fs.mkdir(path.join(appStageDir, 'electron'), { recursive: true });
      await fs.copyFile(icoPath, path.join(nsisStageRoot, 'phoenix.ico'));

      const appPkgJson = JSON.stringify(
        {
          name: 'phoenix-launcher',
          productName: 'Phoenix Launcher',
          version: '1.0.0',
          main: 'electron/main.cjs',
        },
        null,
        2
      );
      await fs.writeFile(path.join(appStageDir, 'package.json'), appPkgJson, 'utf8');
      await fs.writeFile(path.join(appStageDir, 'electron', 'main.cjs'), buildElectronMainCjs(javaPath, mcDir), 'utf8');
      await fs.writeFile(path.join(appStageDir, 'electron', 'preload.cjs'), ELECTRON_PRELOAD_CJS, 'utf8');
      await fs.writeFile(path.join(appStageDir, 'instances.phoenix.json'), JSON.stringify(instances, null, 2), 'utf8');
      await fs.copyFile(icoPath, path.join(appStageDir, 'phoenix.ico'));
      await fs.cp(distDir, path.join(appStageDir, 'dist'), { recursive: true });

      const indexHtmlPath = path.join(appStageDir, 'dist', 'index.html');
      if (existsSync(indexHtmlPath)) {
        const html = await fs.readFile(indexHtmlPath, 'utf8');
        await fs.writeFile(
          indexHtmlPath,
          html.replace(/(src|href)="\/assets\//g, '$1="./assets/'),
          'utf8'
        );
      }

      const setupExePath = path.join(ELECTRON_CACHE_DIR, 'PhoenixLauncher-Setup.exe');
      const nsiPath = path.join(ELECTRON_CACHE_DIR, 'phoenix-full.nsi');
      const nsiScript = `
Unicode true
!include "MUI2.nsh"

Name "Phoenix Launcher"
OutFile "${setupExePath}"
InstallDir "$LOCALAPPDATA\\Phoenix Launcher"
InstallDirRegKey HKCU "Software\\PhoenixLauncher" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID zlib

!define MUI_ICON "${icoPath}"
!define MUI_UNICON "${icoPath}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\\Phoenix Launcher.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Phoenix Launcher"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Phoenix Launcher" SecMain
  SetOutPath "$INSTDIR"
  File /r "${nsisStageRoot}/*"
  WriteRegStr HKCU "Software\\PhoenixLauncher" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\\Uninstall Phoenix Launcher.exe"
  CreateDirectory "$SMPROGRAMS\\Phoenix Launcher"
  CreateShortcut "$SMPROGRAMS\\Phoenix Launcher\\Phoenix Launcher.lnk" "$INSTDIR\\Phoenix Launcher.exe" "" "$INSTDIR\\phoenix.ico" 0
  CreateShortcut "$SMPROGRAMS\\Phoenix Launcher\\Uninstall.lnk" "$INSTDIR\\Uninstall Phoenix Launcher.exe" "" "$INSTDIR\\phoenix.ico" 0
  CreateShortcut "$DESKTOP\\Phoenix Launcher.lnk" "$INSTDIR\\Phoenix Launcher.exe" "" "$INSTDIR\\phoenix.ico" 0
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\\Phoenix Launcher.lnk"
  RMDir /r "$SMPROGRAMS\\Phoenix Launcher"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\\PhoenixLauncher"
SectionEnd
`;
      await fs.writeFile(nsiPath, nsiScript, 'utf8');
      await execFileAsync(makensisBin, [nsiPath], {
        env: { ...process.env, NSISDIR: nsisDir },
        timeout: 120000,
      });

      const fileBuffer = await fs.readFile(setupExePath);
      const totalBytes = fileBuffer.length;
      const chunkCount = Math.ceil(totalBytes / CHUNK_SIZE_BYTES);
      const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      res.json({
        ready: true,
        exeName: 'PhoenixLauncher-Setup.exe',
        electronVersion: version,
        totalBytes,
        sizeMb: Number((totalBytes / (1024 * 1024)).toFixed(1)),
        chunkSize: CHUNK_SIZE_BYTES,
        chunkCount,
        sha256,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to compile PhoenixLauncher-Setup.exe.',
      });
    }
  });

  // Stream a single 12 MB slice of PhoenixLauncher-Setup.exe (safe below Cloud Run 32MB cap)
  app.get('/api/download/windows-exe/chunk', async (req, res) => {
    try {
      const setupExePath = path.join(ELECTRON_CACHE_DIR, 'PhoenixLauncher-Setup.exe');
      if (!existsSync(setupExePath)) {
        res.status(404).json({ error: 'Setup executable not built yet.' });
        return;
      }

      const index = Number(req.query.index ?? 0);
      const stat = await fs.stat(setupExePath);
      const start = index * CHUNK_SIZE_BYTES;
      if (!Number.isInteger(index) || index < 0 || start >= stat.size) {
        res.status(400).json({ error: 'Invalid chunk index.' });
        return;
      }

      const end = Math.min(start + CHUNK_SIZE_BYTES, stat.size);
      const length = end - start;
      const handle = await fs.open(setupExePath, 'r');
      const buffer = Buffer.allocUnsafe(length);
      await handle.read(buffer, 0, length, start);
      await handle.close();

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', String(length));
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to read chunk.',
      });
    }
  });

  // Instant <500 KB Real Windows PE NSIS Installer (PhoenixLauncher-WebSetup.exe)
  app.post('/api/download/windows-lite', async (req, res) => {
    try {
      const { appUrl = '', javaPath = 'javaw.exe', instances = [] } = req.body ?? {};
      const resolvedUrl =
        appUrl ||
        process.env.APP_URL ||
        `${req.protocol}://${req.get('host')}`;

      const { makensisBin, nsisDir } = await ensureNsisCompiler();
      const icoPath = path.join(ELECTRON_CACHE_DIR, 'phoenix.ico');
      await ensurePhoenixIco(icoPath);

      const webStageDir = path.join(ELECTRON_CACHE_DIR, 'nsis-web-stage');
      await fs.rm(webStageDir, { recursive: true, force: true });
      await fs.mkdir(path.join(webStageDir, 'launch-scripts'), { recursive: true });
      await fs.copyFile(icoPath, path.join(webStageDir, 'phoenix.ico'));

      const launchBat = [
        '@echo off',
        'title Phoenix Launcher',
        `set "TARGET_URL=${resolvedUrl}"`,
        'set "EDGE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"',
        'if not exist "%EDGE%" set "EDGE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"',
        'if exist "%EDGE%" (',
        '  start "" "%EDGE%" --app="%TARGET_URL%" --window-size=1380,860',
        '  exit /b 0',
        ')',
        'start "" "%TARGET_URL%"',
        '',
      ].join('\r\n');

      const launchVbs = [
        'Set sh = CreateObject("WScript.Shell")',
        'fsoDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)',
        'sh.Run """" & fsoDir & "\\Phoenix Launcher.bat""", 0, False',
        '',
      ].join('\r\n');

      await fs.writeFile(path.join(webStageDir, 'Phoenix Launcher.bat'), launchBat, 'utf8');
      await fs.writeFile(path.join(webStageDir, 'Phoenix Launcher.vbs'), launchVbs, 'utf8');
      await fs.writeFile(path.join(webStageDir, 'instances.phoenix.json'), JSON.stringify(instances, null, 2), 'utf8');

      for (const inst of Array.isArray(instances) ? instances : []) {
        const rawName = String(inst?.name || 'instance').toLowerCase().replace(/\s+/g, '-');
        const safeName = rawName.replace(/[^a-z0-9-]/g, '') || 'instance';
        const jvm = String(inst?.jvmArgs || '-Xms2048M -Xmx4096M');
        const bat = [
          '@echo off',
          `echo Launching ${inst?.name || 'Minecraft'} (${inst?.mcVersion || '1.21.4'})...`,
          `"${javaPath}" ${jvm} -Dminecraft.launcher.brand=phoenix-launcher -version`,
          'pause',
          '',
        ].join('\r\n');
        await fs.writeFile(path.join(webStageDir, 'launch-scripts', `launch-${safeName}.bat`), bat, 'utf8');
      }

      const webSetupExe = path.join(ELECTRON_CACHE_DIR, 'PhoenixLauncher-WebSetup.exe');
      const nsiPath = path.join(ELECTRON_CACHE_DIR, 'phoenix-web.nsi');
      const nsiScript = `
Unicode true
!include "MUI2.nsh"

Name "Phoenix Launcher"
OutFile "${webSetupExe}"
InstallDir "$LOCALAPPDATA\\Phoenix Launcher"
InstallDirRegKey HKCU "Software\\PhoenixLauncherWeb" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define MUI_ICON "${icoPath}"
!define MUI_UNICON "${icoPath}"
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchPhoenixWeb
!define MUI_FINISHPAGE_RUN_TEXT "Launch Phoenix Launcher"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Function LaunchPhoenixWeb
  ExecShell "" "$SYSDIR\\wscript.exe" '"$INSTDIR\\Phoenix Launcher.vbs"'
FunctionEnd

Section "Phoenix Launcher" SecMain
  SetOutPath "$INSTDIR"
  File /r "${webStageDir}/*"
  WriteRegStr HKCU "Software\\PhoenixLauncherWeb" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\\Uninstall Phoenix Launcher.exe"
  CreateDirectory "$SMPROGRAMS\\Phoenix Launcher"
  CreateShortcut "$SMPROGRAMS\\Phoenix Launcher\\Phoenix Launcher.lnk" "$SYSDIR\\wscript.exe" '"$INSTDIR\\Phoenix Launcher.vbs"' "$INSTDIR\\phoenix.ico" 0
  CreateShortcut "$DESKTOP\\Phoenix Launcher.lnk" "$SYSDIR\\wscript.exe" '"$INSTDIR\\Phoenix Launcher.vbs"' "$INSTDIR\\phoenix.ico" 0
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\\Phoenix Launcher.lnk"
  RMDir /r "$SMPROGRAMS\\Phoenix Launcher"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\\PhoenixLauncherWeb"
SectionEnd
`;
      await fs.writeFile(nsiPath, nsiScript, 'utf8');
      await execFileAsync(makensisBin, [nsiPath], {
        env: { ...process.env, NSISDIR: nsisDir },
        timeout: 30000,
      });

      res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
      res.download(webSetupExe, 'PhoenixLauncher-WebSetup.exe');
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to build PhoenixLauncher-WebSetup.exe.',
      });
    }
  });

  // Complete Project Archive: All source code, assets & Electron configs in one clean .zip
  app.post('/api/download/all-files', async (req, res) => {
    try {
      const {
        javaPath = 'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\javaw.exe',
        mcDir = '%APPDATA%\\.phoenix-launcher',
        instances = [],
      } = req.body ?? {};

      await fs.mkdir(ELECTRON_CACHE_DIR, { recursive: true });
      const icoPath = path.join(ELECTRON_CACHE_DIR, 'phoenix.ico');
      await ensurePhoenixIco(icoPath);

      const overlayDir = path.join(ELECTRON_CACHE_DIR, 'all-files-overlay');
      await fs.rm(overlayDir, { recursive: true, force: true });
      await fs.mkdir(path.join(overlayDir, 'electron'), { recursive: true });

      const builderYml = `appId: com.phoenixlauncher.desktop
productName: Phoenix Launcher
copyright: Phoenix Launcher
directories:
  output: release
files:
  - dist/**/*
  - electron/**/*
win:
  icon: phoenix.ico
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

      const electronPkgJson = JSON.stringify(
        {
          name: 'phoenix-launcher-desktop',
          version: '1.0.0',
          description: 'Phoenix Launcher — Modpacks, 3D Skin Studio & Performance Optimizer',
          main: 'electron/main.cjs',
          scripts: {
            'build:web': 'vite build',
            'electron:dev': 'electron .',
            'dist:win': 'npm run build:web && electron-builder --win nsis portable',
          },
          devDependencies: {
            electron: '^35.0.0',
            'electron-builder': '^25.1.8',
          },
        },
        null,
        2
      );

      const buildGuideMd = `# Phoenix Launcher — Complete Source & Desktop Bundle

## 1. Run Locally (Web + Backend Server)
\`\`\`bash
npm install
npm run dev
\`\`\`
Open \`http://localhost:3000\` in your browser.

## 2. Build Production Web Bundle
\`\`\`bash
npm run build
\`\`\`

## 3. Build Windows Desktop .exe (Optional)
\`\`\`bash
npm install -D electron electron-builder
npx vite build
npx electron-builder --win nsis portable --config electron-builder.yml
\`\`\`
`;

      // Note: electron/*.cjs, electron-builder.yml and package.json in the project are already correct.
      // Do NOT overwrite the real main.cjs with the overlay (that bug used to break the launcher).
      await fs.copyFile(icoPath, path.join(overlayDir, 'phoenix.ico'));
      await fs.writeFile(path.join(overlayDir, 'instances.phoenix.json'), JSON.stringify(instances, null, 2), 'utf8');

      const allZipPath = path.join(ELECTRON_CACHE_DIR, 'Phoenix-Launcher-All-Files.zip');
      const pyZipScript = `
import os, sys, zipfile

root_dir, overlay_dir, out_zip = sys.argv[1], sys.argv[2], sys.argv[3]
skip_dirs = {'node_modules', 'dist', 'release', '.git', '.aistudio', '.next', '.vite', '__pycache__'}
skip_files = {'.env', '.env.local', '.DS_Store'}

with zipfile.ZipFile(out_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for cur, dirs, files in os.walk(root_dir):
        dirs[:] = sorted([d for d in dirs if d not in skip_dirs and not d.startswith('.tmp')])
        for fname in sorted(files):
            if fname in skip_files or fname.endswith('.log'):
                continue
            full = os.path.join(cur, fname)
            rel = os.path.relpath(full, root_dir).replace('\\\\', '/')
            zf.write(full, f'Phoenix-Launcher/{rel}')

    for cur, dirs, files in os.walk(overlay_dir):
        dirs[:] = sorted(dirs)
        for fname in sorted(files):
            full = os.path.join(cur, fname)
            rel = os.path.relpath(full, overlay_dir).replace('\\\\', '/')
            zf.write(full, f'Phoenix-Launcher/{rel}')

with zipfile.ZipFile(out_zip, 'r') as zchk:
    bad = zchk.testzip()
    if bad is not None:
        raise RuntimeError(f'Zip integrity check failed at {bad}')
`;
      await execFileAsync('python3', ['-c', pyZipScript, __dirname, overlayDir, allZipPath], {
        timeout: 30000,
      });

      const stat = await fs.stat(allZipPath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('Cache-Control', 'no-store');
      res.download(allZipPath, 'Phoenix-Launcher-All-Files.zip');
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to build Phoenix-Launcher-All-Files.zip.',
      });
    }
  });

  app.post('/api/ai/diagnose', async (req, res) => {
    const {
      question,
      hardware,
      instance,
    } = req.body ?? {};

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Please provide a question or symptom to diagnose.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: 'Gemini API key is not configured in environment secrets. Create a .env file next to server.ts with GEMINI_API_KEY=your_key (AI diagnose is optional).',
      });
      return;
    }

    const promptContext = `
You are Phoenix Launcher's senior Minecraft JVM & low-end PC optimization engineer.
Analyze the user's hardware profile, active instance configuration, installed mod list, and specific question.
Give concrete, accurate, actionable advice tailored specifically to Minecraft Java Edition performance, garbage collection, mod compatibility, and low-end hardware bottlenecks.

Hardware Profile:
${JSON.stringify(hardware ?? {}, null, 2)}

Active Minecraft Instance:
${JSON.stringify(instance ?? {}, null, 2)}

User Question / Issue:
${question}
`.trim();

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Concise root-cause diagnosis in 2-3 clear sentences.',
        },
        estimatedFpsGain: {
          type: Type.STRING,
          description: 'Realistic expected FPS or frame-time improvement range (e.g. "+25 to +45 FPS, 70% fewer GC spikes").',
        },
        recommendedJvmFlags: {
          type: Type.STRING,
          description: 'Complete copy-ready JVM argument string optimized for the user hardware and modpack.',
        },
        recommendedMods: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Up to 6 exact Modrinth optimization mod names compatible with their loader/version.',
        },
        conflictWarnings: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Any potential mod conflicts, over-allocated RAM pitfalls, or driver caveats.',
        },
        actionSteps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Ordered list of concrete steps to apply in Phoenix Launcher and Minecraft Video Settings.',
        },
      },
      required: [
        'summary',
        'estimatedFpsGain',
        'recommendedJvmFlags',
        'recommendedMods',
        'conflictWarnings',
        'actionSteps',
      ],
    };

    const runModel = async (modelName: string) => {
      const response = await getAi().models.generateContent({
        model: modelName,
        contents: promptContext,
        config: {
          systemInstruction:
            'Be precise, technical, and grounded in real Minecraft Java optimization mechanics (Sodium, Lithium, FerriteCore, ImmediatelyFast, G1GC/ZGC heap sizing, render distance vs simulation distance). Never hallucinate nonexistent flags.',
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      const text = (response.text ?? '{}').trim();
      return {
        parsed: JSON.parse(text),
        modelUsed: modelName,
      };
    };

    try {
      let result;
      let fallbackNotice: string | undefined;
      try {
        result = await runModel('gemini-2.5-flash');
      } catch (primaryErr: unknown) {
        const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        const isPaidKeyOrQuota =
          /403|429|PERMISSION_DENIED|RESOURCE_EXHAUSTED|paid|billing|quota|not found|404/i.test(msg);
        if (isPaidKeyOrQuota) {
          result = await runModel('gemini-2.0-flash');
          fallbackNotice =
            'Primary model unavailable, so Gemini 2.0 Flash was used instead.';
        } else {
          throw primaryErr;
        }
      }

      res.json({
        ...result.parsed,
        modelUsed: result.modelUsed,
        thinkingLevel: 'standard',
        fallbackNotice,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to run AI diagnostics.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production' && !process.argv.includes('--prod')) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Phoenix Launcher server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
