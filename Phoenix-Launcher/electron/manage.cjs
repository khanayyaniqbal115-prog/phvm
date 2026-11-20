// Profile management helpers: crash analysis, Modrinth mods, modpack import/export, world backups,
// screenshots and release news. Pure Node (no extra dependencies).
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { extractZip, readZipEntry } = require('./zip.cjs');

const UA = 'PhoenixLauncher/1.2 (github.com/khanayyaniqbal115-prog/phvm)';
const MR = 'https://api.modrinth.com/v2';

// ---------------------------------------------------------------- small helpers

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
  return res.json();
}

function hashFile(file, algo) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash(algo);
    fs.createReadStream(file)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

async function downloadTo(url, dest, sha1) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error('Invalid download URL');
  }
  if (u.protocol !== 'https:') throw new Error('Only https downloads are allowed');
  const res = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  if (sha1) {
    const got = await hashFile(tmp, 'sha1');
    if (got !== sha1) {
      fs.rmSync(tmp, { force: true });
      throw new Error('Downloaded file failed its checksum');
    }
  }
  fs.renameSync(tmp, dest);
}

function safeFile(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_').slice(0, 120) || 'file';
}

// ---------------------------------------------------------------- crash analyzer

const RULES = [
  {
    test: /OutOfMemoryError|Java heap space|GC overhead limit/i,
    title: 'The game ran out of memory',
    fix: 'Give this profile more RAM (FPS Boost tab or profile settings). 4 GB is a good start for modded play, 6-8 GB for big packs. Remove heavy mods or lower render distance if you cannot add RAM.',
  },
  {
    test: /Could not reserve enough space|Invalid maximum heap size|Error occurred during initialization of VM/i,
    title: 'Java could not reserve that much RAM',
    fix: 'The RAM value is higher than what your PC can give. Lower the RAM for this profile, or close other programs. Make sure Java is 64-bit.',
  },
  {
    test: /UnsupportedClassVersionError|class file version \d+|has been compiled by a more recent version of the Java Runtime/i,
    title: 'Wrong Java version',
    fix: 'This Minecraft version or mod needs a newer Java. Clear the Java path in Settings so Phoenix downloads and uses the right one automatically.',
  },
  {
    test: /Mixin apply failed|MixinApplyError|InvalidInjectionException|Mixin transformation of .* failed/i,
    title: 'A mod conflicts with another mod or the game version',
    fix: 'Open the Mods tab, check "Updates", and update the suspect mod. If it keeps happening, disable the most recently added mod.',
  },
  {
    test: /Incompatible mods found|Mod resolution failed|Unmet dependency|requires (any version of|version) .*(fabric|fabric-api|fabricloader)|depends on|Could not find required mod/i,
    title: 'A mod is missing a required dependency or is for another version',
    fix: 'Most Fabric mods need Fabric API. Install "Fabric API" from the Mods tab, and make sure every mod matches this profile\'s Minecraft version and loader.',
  },
  {
    test: /NoClassDefFoundError|ClassNotFoundException|NoSuchMethodError|NoSuchFieldError/i,
    title: 'A mod does not match this game version or loader',
    fix: 'A mod was built for a different Minecraft version or loader (Fabric vs Forge). Remove mods that are not for this profile, then update the rest.',
  },
  {
    test: /GLFW error|Pixel format not accepted|WGL: |OpenGL.*(not supported|failed)|Failed to create (the )?window|org\.lwjgl\.LWJGLException/i,
    title: 'Graphics driver or OpenGL problem',
    fix: 'Update your graphics driver from NVIDIA/AMD/Intel. On laptops, make sure the game uses the dedicated GPU. Turn off shaders and overlays (Discord, MSI Afterburner) and try again.',
  },
  {
    test: /EXCEPTION_ACCESS_VIOLATION|SIGSEGV|A fatal error has been detected by the Java Runtime/i,
    title: 'Native crash (usually graphics driver or an overlay)',
    fix: 'Update your graphics driver, close overlay programs (Discord, Steam, GeForce Experience), and remove shader or rendering mods added recently.',
  },
  {
    test: /UnknownHostException|Connection (timed out|refused)|SSLHandshake|Failed to download/i,
    title: 'Network problem',
    fix: 'Check your internet connection or VPN/firewall, then launch again. Phoenix resumes downloads where it stopped.',
  },
  {
    test: /Address already in use|Failed to bind to port/i,
    title: 'Another game or server is already using the port',
    fix: 'Close any other Minecraft instance or local server, then try again.',
  },
  {
    test: /java\.nio\.file\.(AccessDenied|FileSystemException)|Access is denied|being used by another process/i,
    title: 'A file is locked by another program',
    fix: 'Close other Minecraft windows and your antivirus scan of the game folder, then launch again.',
  },
];

function tailOf(file, bytes) {
  try {
    const st = fs.statSync(file);
    const fd = fs.openSync(file, 'r');
    const len = Math.min(bytes, st.size);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, st.size - len);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch {
    return '';
  }
}

function newestFile(dir, re) {
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => re.test(n))
      .map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .map((x) => path.join(dir, x.n))[0];
  } catch {
    return undefined;
  }
}

/** Reads the newest game log / crash report and explains the most likely cause. */
function analyzeCrash(gameDir, extraText = '') {
  let text = extraText;
  text += '\n' + tailOf(path.join(gameDir, 'logs', 'latest.log'), 300 * 1024);
  const crash = newestFile(path.join(gameDir, 'crash-reports'), /\.txt$/i);
  if (crash && Date.now() - fs.statSync(crash).mtimeMs < 6 * 3600 * 1000) text += '\n' + tailOf(crash, 200 * 1024);
  const hs = newestFile(gameDir, /^hs_err_pid\d+\.log$/);
  if (hs && Date.now() - fs.statSync(hs).mtimeMs < 6 * 3600 * 1000) text += '\n' + tailOf(hs, 60 * 1024);

  const hints = RULES.filter((r) => r.test.test(text)).map((r) => ({ title: r.title, fix: r.fix }));
  const suspects = new Set();
  for (const m of text.matchAll(/Suspected Mods?:\s*\n?\s*([^\n]+)/g)) suspects.add(m[1].trim().slice(0, 80));
  for (const m of text.matchAll(/Mod ['"]?([^'"\n(]+?)['"]? \(([a-z0-9_\-]+)\) (requires|conflicts|is incompatible)/gi)) {
    suspects.add(`${m[1].trim()} (${m[2]})`);
  }
  const ramMatch = text.match(/-Xmx(\d+)([MG])/i);
  return {
    hints: hints.slice(0, 4),
    suspects: [...suspects].slice(0, 5),
    crashReport: crash || null,
    ram: ramMatch ? `${ramMatch[1]}${ramMatch[2].toUpperCase()}` : null,
    hasLog: Boolean(text.trim()),
  };
}

// ---------------------------------------------------------------- zip writer

let CRC_TABLE;
function crc32(buf, prev = 0) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = ~prev;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

/** Writes a .zip from [{ name, file } | { name, data }]. Files over ~3.5 GB total are refused (no zip64). */
function writeZip(dest, entries) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const fd = fs.openSync(dest, 'w');
  let offset = 0;
  const central = [];
  let total = 0;
  try {
    for (const e of entries) {
      const raw = e.data ? Buffer.from(e.data) : fs.readFileSync(e.file);
      total += raw.length;
      if (total > 3.5 * 1024 * 1024 * 1024) throw new Error('Too large to zip (over 3.5 GB).');
      const deflated = raw.length > 64 ? zlib.deflateRawSync(raw, { level: 6 }) : raw;
      const method = deflated === raw ? 0 : 8;
      const name = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8');
      const crc = crc32(raw);
      const h = Buffer.alloc(30);
      h.writeUInt32LE(0x04034b50, 0);
      h.writeUInt16LE(20, 4);
      h.writeUInt16LE(0x0800, 6);
      h.writeUInt16LE(method, 8);
      h.writeUInt16LE(0, 10);
      h.writeUInt16LE(0x21, 12);
      h.writeUInt32LE(crc, 14);
      h.writeUInt32LE(deflated.length, 18);
      h.writeUInt32LE(raw.length, 22);
      h.writeUInt16LE(name.length, 26);
      h.writeUInt16LE(0, 28);
      fs.writeSync(fd, h);
      fs.writeSync(fd, name);
      fs.writeSync(fd, deflated);
      central.push({ name, crc, method, csize: deflated.length, size: raw.length, offset });
      offset += 30 + name.length + deflated.length;
    }
    const cdStart = offset;
    for (const c of central) {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0);
      h.writeUInt16LE(20, 4);
      h.writeUInt16LE(20, 6);
      h.writeUInt16LE(0x0800, 8);
      h.writeUInt16LE(c.method, 10);
      h.writeUInt16LE(0, 12);
      h.writeUInt16LE(0x21, 14);
      h.writeUInt32LE(c.crc, 16);
      h.writeUInt32LE(c.csize, 20);
      h.writeUInt32LE(c.size, 24);
      h.writeUInt16LE(c.name.length, 28);
      h.writeUInt32LE(c.offset, 42);
      fs.writeSync(fd, h);
      fs.writeSync(fd, c.name);
      offset += 46 + c.name.length;
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(central.length, 8);
    end.writeUInt16LE(central.length, 10);
    end.writeUInt32LE(offset - cdStart, 12);
    end.writeUInt32LE(cdStart, 16);
    fs.writeSync(fd, end);
  } finally {
    fs.closeSync(fd);
  }
}

function walkFiles(root, base = root, skip = () => false, out = []) {
  let list;
  try {
    list = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of list) {
    const full = path.join(root, e.name);
    const rel = path.relative(base, full);
    if (skip(rel, e)) continue;
    if (e.isDirectory()) walkFiles(full, base, skip, out);
    else if (e.isFile()) out.push({ name: rel.split(path.sep).join('/'), file: full });
  }
  return out;
}

// ---------------------------------------------------------------- world backups

function dirSize(dir) {
  return walkFiles(dir).reduce((s, f) => {
    try {
      return s + fs.statSync(f.file).size;
    } catch {
      return s;
    }
  }, 0);
}

function listBackups(backupsDir) {
  if (!fs.existsSync(backupsDir)) return [];
  return fs
    .readdirSync(backupsDir)
    .filter((n) => n.endsWith('.zip'))
    .map((n) => {
      const st = fs.statSync(path.join(backupsDir, n));
      const m = n.match(/^(.*)__(\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d)\.zip$/);
      return { file: n, world: m ? m[1] : n, created: st.mtimeMs, sizeMb: Math.round(st.size / 1048576) };
    })
    .sort((a, b) => b.created - a.created);
}

function backupWorld(savesDir, worldName, backupsDir, keep = 5) {
  const src = path.join(savesDir, worldName);
  if (!fs.existsSync(path.join(src, 'level.dat'))) throw new Error('World not found.');
  const stamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
  const dest = path.join(backupsDir, `${safeFile(worldName)}__${stamp}.zip`);
  const files = walkFiles(src, src, (rel) => rel === 'session.lock').map((f) => ({ name: `${worldName}/${f.name}`, file: f.file }));
  writeZip(dest, files);
  // keep only the newest `keep` backups of this world
  const mine = listBackups(backupsDir).filter((b) => b.world === safeFile(worldName));
  for (const old of mine.slice(keep)) fs.rmSync(path.join(backupsDir, old.file), { force: true });
  return path.basename(dest);
}

/** Backs up every world that changed since its last backup. Skips worlds over maxMb. Returns names backed up. */
function autoBackup(savesDir, backupsDir, maxMb = 1500) {
  const done = [];
  if (!fs.existsSync(savesDir)) return done;
  const existing = listBackups(backupsDir);
  for (const e of fs.readdirSync(savesDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const level = path.join(savesDir, e.name, 'level.dat');
    if (!fs.existsSync(level)) continue;
    const last = existing.find((b) => b.world === safeFile(e.name));
    if (last && last.created >= fs.statSync(level).mtimeMs) continue;
    if (dirSize(path.join(savesDir, e.name)) > maxMb * 1048576) continue;
    try {
      backupWorld(savesDir, e.name, backupsDir, 3);
      done.push(e.name);
    } catch {
      /* ignore single failures */
    }
  }
  return done;
}

// ---------------------------------------------------------------- instance duplicate

function duplicateFolder(src, dest) {
  if (!fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    return;
  }
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (p) => {
      const rel = path.relative(src, p).split(path.sep)[0];
      return !['logs', 'crash-reports', '.phoenix-packs'].includes(rel);
    },
  });
}

// ---------------------------------------------------------------- screenshots

function listScreenshots(gameDir, limit = 60) {
  const dir = path.join(gameDir, 'screenshots');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => /\.(png|jpe?g)$/i.test(n))
    .map((n) => ({ file: path.join(dir, n), name: n, t: fs.statSync(path.join(dir, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(0, limit);
}

// ---------------------------------------------------------------- Modrinth: browse, install, update

const KINDS = {
  mod: { dir: 'mods', ext: /\.jar(\.disabled)?$/i },
  shader: { dir: 'shaderpacks', ext: /\.zip$/i },
  resourcepack: { dir: 'resourcepacks', ext: /\.zip$/i },
};

function loadersFor(loader) {
  if (loader === 'quilt') return ['quilt', 'fabric'];
  if (loader === 'vanilla') return [];
  return [loader];
}

async function searchProjects({ query, type = 'mod', loader, mcVersion, offset = 0 }) {
  const facets = [[`project_type:${type}`]];
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  if (type === 'mod' && loader && loader !== 'vanilla') facets.push(loadersFor(loader).map((l) => `categories:${l}`));
  const qs = new URLSearchParams({
    query: query || '',
    facets: JSON.stringify(facets),
    limit: '20',
    offset: String(offset),
    index: query ? 'relevance' : 'downloads',
  });
  const data = await getJson(`${MR}/search?${qs}`);
  return (data.hits || []).map((h) => ({
    id: h.project_id,
    slug: h.slug,
    title: h.title,
    description: h.description,
    icon: h.icon_url || '',
    image: h.featured_gallery || (Array.isArray(h.gallery) && h.gallery[0]) || '',
    downloads: h.downloads || 0,
    author: h.author || '',
  }));
}

async function pickVersion(projectId, type, loader, mcVersion) {
  const qs = new URLSearchParams();
  const loaders = type === 'mod' ? loadersFor(loader) : [];
  if (loaders.length) qs.set('loaders', JSON.stringify(loaders));
  if (mcVersion) qs.set('game_versions', JSON.stringify([mcVersion]));
  const list = await getJson(`${MR}/project/${encodeURIComponent(projectId)}/version?${qs}`);
  if (!Array.isArray(list) || !list.length) return null;
  return list.find((v) => v.version_type === 'release') || list[0];
}

/** Installs a project (and its required dependencies) into the instance. Returns installed file names. */
async function installProject({ gameDir, projectId, type = 'mod', loader, mcVersion }) {
  const kind = KINDS[type] || KINDS.mod;
  if (type === 'mod' && loader === 'vanilla') throw new Error('Mods need Fabric, Quilt, Forge or NeoForge. Change this profile\'s loader first.');
  const installed = [];
  const seen = new Set();
  const queue = [{ id: projectId, depth: 0 }];
  while (queue.length && installed.length < 25) {
    const { id, depth } = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const ver = await pickVersion(id, type, loader, mcVersion);
    if (!ver) {
      if (depth === 0) throw new Error(`No version for Minecraft ${mcVersion} (${loader}) was found.`);
      continue;
    }
    const f = (ver.files || []).find((x) => x.primary) || (ver.files || [])[0];
    if (!f) continue;
    const dest = path.join(gameDir, kind.dir, safeFile(f.filename));
    if (!fs.existsSync(dest)) {
      await downloadTo(f.url, dest, f.hashes && f.hashes.sha1);
      installed.push(f.filename);
    }
    if (type === 'mod' && depth < 2) {
      for (const dep of ver.dependencies || []) {
        if (dep.dependency_type === 'required' && dep.project_id) queue.push({ id: dep.project_id, depth: depth + 1 });
      }
    }
  }
  return installed;
}

async function identify(files) {
  // files: [{ file(path), sha1 }] -> Map sha1 -> { version, project }
  const map = new Map();
  if (!files.length) return map;
  try {
    const versions = await postJson(`${MR}/version_files`, { hashes: files.map((f) => f.sha1), algorithm: 'sha1' });
    const ids = [...new Set(Object.values(versions).map((v) => v.project_id))];
    let projects = [];
    if (ids.length) projects = await getJson(`${MR}/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`);
    const byId = new Map(projects.map((p) => [p.id, p]));
    for (const [hash, v] of Object.entries(versions)) map.set(hash, { version: v, project: byId.get(v.project_id) });
  } catch {
    /* offline: fall back to file names */
  }
  return map;
}

async function listInstalled(gameDir, withIcons = true) {
  const out = [];
  const raw = [];
  for (const [type, kind] of Object.entries(KINDS)) {
    const dir = path.join(gameDir, kind.dir);
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir)) {
      if (!kind.ext.test(n)) continue;
      const full = path.join(dir, n);
      if (!fs.statSync(full).isFile()) continue;
      raw.push({ type, name: n, full, sha1: await hashFile(full, 'sha1'), size: fs.statSync(full).size });
    }
  }
  const known = await identify(raw);
  for (const r of raw) {
    const k = known.get(r.sha1);
    out.push({
      type: r.type,
      file: r.name,
      enabled: !r.name.endsWith('.disabled'),
      sizeKb: Math.round(r.size / 1024),
      sha1: r.sha1,
      title: (k && k.project && k.project.title) || r.name.replace(/\.jar(\.disabled)?$|\.zip$/i, ''),
      icon: withIcons && k && k.project ? k.project.icon_url || '' : '',
      version: (k && k.version && k.version.version_number) || '',
      projectId: (k && k.version && k.version.project_id) || '',
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

async function checkUpdates(gameDir, loader, mcVersion) {
  const items = await listInstalled(gameDir, false);
  const updates = [];
  for (const type of Object.keys(KINDS)) {
    const group = items.filter((i) => i.type === type && i.enabled && i.projectId);
    if (!group.length) continue;
    const body = { hashes: group.map((g) => g.sha1), algorithm: 'sha1', game_versions: [mcVersion] };
    if (type === 'mod') body.loaders = loadersFor(loader);
    let result;
    try {
      result = await postJson(`${MR}/version_files/update`, body);
    } catch {
      continue;
    }
    for (const g of group) {
      const v = result[g.sha1];
      if (!v) continue;
      const file = (v.files || []).find((f) => f.primary) || (v.files || [])[0];
      if (!file || (v.files || []).some((f) => f.hashes && f.hashes.sha1 === g.sha1)) continue;
      updates.push({ type, file: g.file, title: g.title, from: g.version, to: v.version_number, url: file.url, newName: file.filename, sha1: file.hashes && file.hashes.sha1 });
    }
  }
  return updates;
}

async function applyUpdates(gameDir, updates) {
  const done = [];
  for (const u of updates) {
    const kind = KINDS[u.type] || KINDS.mod;
    const dir = path.join(gameDir, kind.dir);
    const dest = path.join(dir, safeFile(u.newName));
    await downloadTo(u.url, dest, u.sha1);
    const old = path.join(dir, safeFile(u.file));
    if (old !== dest) fs.rmSync(old, { force: true });
    done.push(u.title);
  }
  return done;
}

function toggleFile(gameDir, type, file, enable) {
  const dir = path.join(gameDir, (KINDS[type] || KINDS.mod).dir);
  const from = path.join(dir, safeFile(file));
  if (path.dirname(from) !== dir || !fs.existsSync(from)) throw new Error('File not found.');
  const to = enable ? from.replace(/\.disabled$/, '') : from.endsWith('.disabled') ? from : `${from}.disabled`;
  if (to !== from) fs.renameSync(from, to);
}

function removeFile(gameDir, type, file) {
  const dir = path.join(gameDir, (KINDS[type] || KINDS.mod).dir);
  const target = path.join(dir, safeFile(file));
  if (path.dirname(target) !== dir) throw new Error('Invalid file.');
  fs.rmSync(target, { force: true });
}

// ---------------------------------------------------------------- modpack export / import (.mrpack)

async function fabricLoaderVersion() {
  try {
    const list = await getJson('https://meta.fabricmc.net/v2/versions/loader');
    return (list.find((l) => l.stable) || list[0]).version;
  } catch {
    return '0.16.10';
  }
}

async function exportMrpack({ gameDir, dest, name, mcVersion, loader }) {
  const mods = await listInstalled(gameDir, false);
  const files = [];
  const entries = [];
  const known = new Map();
  // look up download URLs for recognised files
  const hashes = mods.filter((m) => m.projectId && m.enabled).map((m) => m.sha1);
  if (hashes.length) {
    try {
      const versions = await postJson(`${MR}/version_files`, { hashes, algorithm: 'sha1' });
      for (const [h, v] of Object.entries(versions)) known.set(h, v);
    } catch {
      /* export everything as overrides if offline */
    }
  }
  for (const m of mods) {
    if (!m.enabled) continue;
    const rel = `${(KINDS[m.type] || KINDS.mod).dir}/${m.file}`;
    const full = path.join(gameDir, rel);
    const v = known.get(m.sha1);
    const vf = v && (v.files || []).find((f) => f.hashes && f.hashes.sha1 === m.sha1);
    if (vf) {
      files.push({
        path: rel,
        hashes: { sha1: m.sha1, sha512: await hashFile(full, 'sha512') },
        env: { client: 'required', server: 'unsupported' },
        downloads: [vf.url],
        fileSize: m.sizeKb * 1024 > 0 ? fs.statSync(full).size : 0,
      });
    } else {
      entries.push({ name: `overrides/${rel}`, file: full });
    }
  }
  // settings the player probably wants to share
  for (const rel of ['options.txt']) {
    const f = path.join(gameDir, rel);
    if (fs.existsSync(f)) entries.push({ name: `overrides/${rel}`, file: f });
  }
  for (const f of walkFiles(path.join(gameDir, 'config'))) {
    if (fs.statSync(f.file).size < 512 * 1024) entries.push({ name: `overrides/config/${f.name}`, file: f.file });
  }
  const deps = { minecraft: mcVersion };
  if (loader === 'fabric') deps['fabric-loader'] = await fabricLoaderVersion();
  else if (loader === 'quilt') deps['quilt-loader'] = '0.26.0';
  else if (loader === 'neoforge') deps.neoforge = '*';
  else if (loader === 'forge') deps.forge = '*';
  const index = { formatVersion: 1, game: 'minecraft', versionId: '1.0.0', name, summary: 'Exported from Phoenix Launcher', files, dependencies: deps };
  writeZip(dest, [{ name: 'modrinth.index.json', data: JSON.stringify(index, null, 1) }, ...entries]);
  return { mods: files.length, extra: entries.length };
}

async function importMrpack(file, gameDir) {
  const buf = readZipEntry(file, 'modrinth.index.json');
  if (!buf) throw new Error('This file is not a Modrinth modpack (.mrpack).');
  const index = JSON.parse(buf.toString('utf8'));
  const deps = index.dependencies || {};
  const root = path.resolve(gameDir);
  const list = (index.files || []).filter((f) => !(f.env && f.env.client === 'unsupported'));
  let count = 0;
  for (const f of list) {
    const dest = path.resolve(root, f.path);
    if (!dest.startsWith(root + path.sep)) continue;
    if (!f.downloads || !f.downloads[0]) continue;
    await downloadTo(f.downloads[0], dest, f.hashes && f.hashes.sha1);
    count++;
  }
  extractZip(file, gameDir, { prefix: 'overrides/' });
  extractZip(file, gameDir, { prefix: 'client-overrides/' });
  const loader = deps['fabric-loader'] ? 'fabric' : deps['quilt-loader'] ? 'quilt' : deps.neoforge ? 'neoforge' : deps.forge ? 'forge' : 'vanilla';
  return { name: index.name || 'Imported pack', mcVersion: deps.minecraft || '', loader, files: count };
}

// ---------------------------------------------------------------- keybind profiles

/** Copies all key_* lines from one profile's options.txt into another's (or removes them when fromDir is null). */
function copyKeybinds(fromDir, toDir) {
  const dest = path.join(toDir, 'options.txt');
  const keep = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('key_')) : [];
  let keys = [];
  if (fromDir) {
    const src = path.join(fromDir, 'options.txt');
    if (!fs.existsSync(src)) throw new Error('The other profile has no saved keybinds yet. Start it once first.');
    keys = fs.readFileSync(src, 'utf8').split(/\r?\n/).filter((l) => l.startsWith('key_'));
    if (!keys.length) throw new Error('No custom keybinds were found in the other profile.');
  }
  fs.mkdirSync(toDir, { recursive: true });
  fs.writeFileSync(dest, [...keep, ...keys].join('\n') + '\n');
  return keys.length;
}

// ---------------------------------------------------------------- news

async function fetchNews(repo) {
  const list = await getJson(`https://api.github.com/repos/${repo}/releases?per_page=6`);
  return list.map((r) => ({
    tag: r.tag_name,
    name: r.name || r.tag_name,
    body: String(r.body || '').slice(0, 1500),
    date: r.published_at,
    url: r.html_url,
  }));
}

module.exports = {
  analyzeCrash,
  writeZip,
  listBackups,
  backupWorld,
  autoBackup,
  duplicateFolder,
  listScreenshots,
  searchProjects,
  installProject,
  listInstalled,
  checkUpdates,
  applyUpdates,
  toggleFile,
  removeFile,
  exportMrpack,
  importMrpack,
  fetchNews,
  copyKeybinds,
  downloadTo,
  getJson,
};
