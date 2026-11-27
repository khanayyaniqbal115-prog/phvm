// World management: list saves, import a world .zip, and search/download worlds from CurseForge.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractZip } = require('./zip.cjs');
const config = require('./config.cjs');

const UA = 'PurrlixLauncher/1.1';
const CF_GAME_MINECRAFT = 432;
const CF_CLASS_WORLDS = 17;

function safeName(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_').trim().slice(0, 60) || 'World';
}

function uniqueDir(parent, name) {
  let candidate = path.join(parent, safeName(name));
  let i = 2;
  while (fs.existsSync(candidate)) candidate = path.join(parent, `${safeName(name)} (${i++})`);
  return candidate;
}

function dirSizeMb(dir) {
  let total = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        try {
          total += fs.statSync(p).size;
        } catch {
          /* ignore */
        }
      }
    }
  };
  try {
    walk(dir);
  } catch {
    /* ignore */
  }
  return Math.round(total / 1048576);
}

function listWorlds(savesDir) {
  if (!fs.existsSync(savesDir)) return [];
  return fs
    .readdirSync(savesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(savesDir, e.name, 'level.dat')))
    .map((e) => {
      const full = path.join(savesDir, e.name);
      return { name: e.name, modified: fs.statSync(path.join(full, 'level.dat')).mtimeMs, sizeMb: dirSizeMb(full) };
    })
    .sort((a, b) => b.modified - a.modified);
}

// Finds the folder that contains level.dat (the zip root or one folder below it).
function findWorldRoot(dir, depth = 0) {
  if (fs.existsSync(path.join(dir, 'level.dat'))) return dir;
  if (depth >= 3) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== '__MACOSX') {
      const found = findWorldRoot(path.join(dir, e.name), depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function installWorldZip(zipPath, savesDir, fallbackName) {
  fs.mkdirSync(savesDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phoenix-world-'));
  try {
    extractZip(zipPath, tmp);
    const root = findWorldRoot(tmp);
    if (!root) throw new Error('This zip does not contain a Minecraft world (no level.dat found).');
    const name = root === tmp ? fallbackName : path.basename(root);
    const dest = uniqueDir(savesDir, name);
    fs.cpSync(root, dest, { recursive: true });
    return { name: path.basename(dest) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function cfConfigured() {
  return Boolean(config.CURSEFORGE_API_KEY);
}

async function cfFetch(url) {
  const res = await fetch(url, {
    headers: { 'x-api-key': config.CURSEFORGE_API_KEY, Accept: 'application/json', 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 403 || res.status === 401) throw new Error('CurseForge rejected the API key. Check CURSEFORGE_API_KEY in electron/config.cjs.');
  if (!res.ok) throw new Error(`CurseForge error HTTP ${res.status}`);
  return res.json();
}

async function curseforgeSearchWorlds(query) {
  if (!cfConfigured()) throw new Error('CurseForge API key missing. Add CURSEFORGE_API_KEY in electron/config.cjs.');
  const url =
    `https://api.curseforge.com/v1/mods/search?gameId=${CF_GAME_MINECRAFT}&classId=${CF_CLASS_WORLDS}` +
    `&pageSize=24&sortField=2&sortOrder=desc&searchFilter=${encodeURIComponent(query || '')}`;
  const data = await cfFetch(url);
  return (data.data || []).map((m) => {
    const files = (m.latestFiles || []).filter((f) => /\.zip$/i.test(f.fileName || ''));
    // newest zip first; prefer one that has a direct link
    files.sort((a, b) => new Date(b.fileDate || 0) - new Date(a.fileDate || 0));
    const file = files.find((f) => f.downloadUrl) || files[0] || null;
    return {
      id: m.id,
      name: m.name,
      summary: m.summary,
      author: (m.authors && m.authors[0] && m.authors[0].name) || '',
      downloads: m.downloadCount || 0,
      thumbnail: m.logo && m.logo.thumbnailUrl,
      page: m.links && m.links.websiteUrl,
      fileId: file ? file.id : null,
      fileName: file ? file.fileName : null,
      downloadUrl: file ? file.downloadUrl : null,
    };
  });
}

// Resolves the direct link: from the search result, or from the official "download-url" endpoint.
async function resolveDownloadUrl(world) {
  if (world.downloadUrl) return world.downloadUrl;
  if (world.id && world.fileId) {
    try {
      const data = await cfFetch(`https://api.curseforge.com/v1/mods/${world.id}/files/${world.fileId}/download-url`);
      if (data && data.data) return data.data;
    } catch (e) {
      if (/rejected the API key/.test(e.message)) throw e;
    }
  }
  throw new Error('The author does not allow downloads outside CurseForge for this world. Use the "Open on CurseForge" button and download it there, then use "Import zip".');
}

async function curseforgeDownloadWorld(world, savesDir, emit) {
  if (!world || !world.id) throw new Error('Invalid world.');
  if (!world.fileId && !world.downloadUrl) {
    throw new Error('This world has no .zip file (only .rar/.7z or none). Open it on CurseForge instead.');
  }
  const downloadUrl = await resolveDownloadUrl(world);
  let u;
  try {
    u = new URL(downloadUrl);
  } catch {
    throw new Error('Invalid download link.');
  }
  if (!/(^|\.)forgecdn\.net$|(^|\.)curseforge\.com$/i.test(u.hostname)) throw new Error('Unexpected download host.');
  if (world.fileName && !/\.zip$/i.test(world.fileName)) {
    throw new Error(`This world is a ${path.extname(world.fileName) || 'non-zip'} file. Purrlix can only install .zip worlds; open it on CurseForge instead.`);
  }
  emit && emit({ message: `Downloading ${world.name}...` });
  let res;
  try {
    res = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10 * 60 * 1000) });
  } catch (e) {
    throw new Error(`Could not reach the download server (${e.message}). Check your internet or VPN and try again.`);
  }
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}).`);
  const tmpZip = path.join(os.tmpdir(), `phoenix-world-${Date.now()}.zip`);
  fs.writeFileSync(tmpZip, Buffer.from(await res.arrayBuffer()));
  try {
    return installWorldZip(tmpZip, savesDir, world.name);
  } catch (e) {
    throw new Error(`The download worked but the world could not be installed: ${e.message}`);
  } finally {
    fs.rmSync(tmpZip, { force: true });
  }
}

module.exports = { listWorlds, installWorldZip, curseforgeSearchWorlds, curseforgeDownloadWorld, cfConfigured };
