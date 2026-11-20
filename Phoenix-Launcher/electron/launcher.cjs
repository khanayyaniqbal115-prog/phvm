// Phoenix Launcher — Minecraft launch engine.
// Handles version download, libraries, assets, natives, Java, mods (Modrinth), Fabric/Quilt/Forge/NeoForge and game start.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { execFile, spawn } = require('child_process');
const { extractZip, readZipEntry } = require('./zip.cjs');

const UA = 'PhoenixLauncher/1.1 (desktop)';
const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const IS_WIN = process.platform === 'win32';
const OS_NAME = IS_WIN ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
const LAUNCHER_VERSION = '1.1.0';

// ---------------------------------------------------------------- helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await sleep(400 * (i + 1));
    }
  }
  throw new Error(`Network or server problem: ${lastErr && lastErr.message}`);
}

function sha1OfFile(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha1');
    fs.createReadStream(file)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

async function fileOk(file, sha1, size) {
  try {
    const st = fs.statSync(file);
    if (!st.isFile() || st.size === 0) return false;
    if (size && st.size !== size) return false;
    if (sha1) return (await sha1OfFile(file)) === sha1;
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest, { sha1, size } = {}, tries = 3) {
  if (await fileOk(dest, sha1, size)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const tmp = dest + '.part';
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
      if (sha1 && (await sha1OfFile(tmp)) !== sha1) {
        fs.rmSync(tmp, { force: true });
        throw new Error('SHA1 mismatch (corrupted download)');
      }
      fs.renameSync(tmp, dest);
      return true;
    } catch (err) {
      lastErr = err;
      await sleep(500 * (i + 1));
    }
  }
  throw new Error(`Download failed: ${url} — ${lastErr && lastErr.message}`);
}

class CancelledError extends Error {
  constructor() {
    super('Launch cancelled');
    this.name = 'CancelledError';
  }
}

function checkCancel(ctx) {
  if (ctx && ctx.cancelled) throw new CancelledError();
}

async function runPool(items, limit, worker, ctx) {
  let idx = 0;
  let firstErr = null;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length && !firstErr) {
      if (ctx && ctx.cancelled) {
        firstErr = new CancelledError();
        break;
      }
      const i = idx++;
      try {
        await worker(items[i], i);
      } catch (err) {
        firstErr = firstErr || err;
      }
    }
  });
  await Promise.all(runners);
  if (firstErr) throw firstErr;
}

function mavenPath(name) {
  // group:artifact:version[:classifier][@ext]
  let ext = 'jar';
  let n = name;
  const at = n.indexOf('@');
  if (at >= 0) {
    ext = n.slice(at + 1);
    n = n.slice(0, at);
  }
  const [group, artifact, version, classifier] = n.split(':');
  const file = `${artifact}-${version}${classifier ? '-' + classifier : ''}.${ext}`;
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${file}`;
}

function libKey(name) {
  const [g, a, , c] = name.replace(/@.*$/, '').split(':');
  return `${g}:${a}${c ? ':' + c : ''}`;
}

function ruleMatches(rule, features) {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== OS_NAME) return false;
    if (rule.os.arch) {
      const a = rule.os.arch;
      const ok =
        (a === 'x86' && process.arch === 'ia32') ||
        (a === 'x64' && process.arch === 'x64') ||
        (a === 'arm64' && process.arch === 'arm64');
      if (!ok) return false;
    }
    if (rule.os.version) {
      try {
        if (!new RegExp(rule.os.version).test(os.release())) return false;
      } catch {
        /* ignore */
      }
    }
  }
  if (rule.features) {
    for (const [k, v] of Object.entries(rule.features)) {
      if (Boolean(features[k]) !== Boolean(v)) return false;
    }
  }
  return true;
}

function rulesAllow(rules, features = {}) {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const r of rules) {
    if (ruleMatches(r, features)) allowed = r.action === 'allow';
  }
  return allowed;
}

function offlineUuid(name) {
  const b = crypto.createHash('md5').update('OfflinePlayer:' + name).digest();
  b[6] = (b[6] & 0x0f) | 0x30;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function sanitizeName(raw) {
  const cleaned = String(raw || '').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 16);
  return cleaned.length >= 3 ? cleaned : (cleaned + '___').slice(0, 3);
}

// ---------------------------------------------------------------- Java

function javaMajor(javaBin) {
  return new Promise((resolve) => {
    execFile(javaBin, ['-version'], { timeout: 10000, windowsHide: true }, (err, stdout, stderr) => {
      const out = `${stderr || ''}${stdout || ''}`;
      const m = out.match(/version "(\d+)(?:\.(\d+))?/);
      if (!m) return resolve(null);
      let major = parseInt(m[1], 10);
      if (major === 1 && m[2]) major = parseInt(m[2], 10);
      resolve(major);
    });
  });
}

function javaExeName() {
  return IS_WIN ? 'java.exe' : 'java';
}

function toConsoleJava(p) {
  // use java.exe instead of javaw.exe so we can read the game log
  if (IS_WIN && /javaw\.exe$/i.test(p)) {
    const alt = p.replace(/javaw\.exe$/i, 'java.exe');
    if (fs.existsSync(alt)) return alt;
  }
  return p;
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(dir, d.name));
  } catch {
    return [];
  }
}

function candidateJavaPaths(dataDir) {
  const exe = javaExeName();
  const list = [];
  const add = (p) => p && list.push(p);

  if (process.env.JAVA_HOME) add(path.join(process.env.JAVA_HOME, 'bin', exe));
  add(exe); // from PATH

  // Phoenix's own downloaded runtimes
  for (const d of listDirs(path.join(dataDir, 'runtime'))) add(path.join(d, 'bin', exe));

  if (IS_WIN) {
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramW6432].filter(Boolean);
    const vendors = ['Java', 'Eclipse Adoptium', 'Microsoft', 'Zulu', 'BellSoft', 'Amazon Corretto', 'Semeru', 'AdoptOpenJDK', 'Eclipse Foundation'];
    for (const r of roots) for (const v of vendors) for (const d of listDirs(path.join(r, v))) add(path.join(d, 'bin', exe));
    // Runtimes bundled with the official Minecraft launcher
    const appdata = process.env.APPDATA;
    const local = process.env.LOCALAPPDATA;
    const mcRuntimes = [
      appdata && path.join(appdata, '.minecraft', 'runtime'),
      local && path.join(local, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime'),
    ].filter(Boolean);
    for (const base of mcRuntimes) {
      for (const comp of listDirs(base)) {
        for (const plat of listDirs(comp)) {
          for (const inner of listDirs(plat)) add(path.join(inner, 'bin', exe));
        }
      }
    }
  } else if (process.platform === 'darwin') {
    for (const d of listDirs('/Library/Java/JavaVirtualMachines')) add(path.join(d, 'Contents', 'Home', 'bin', exe));
  } else {
    for (const d of listDirs('/usr/lib/jvm')) add(path.join(d, 'bin', exe));
  }
  return list;
}

async function detectJavas(dataDir, extra) {
  const seen = new Set();
  const found = [];
  const cands = [...(extra ? [extra] : []), ...candidateJavaPaths(dataDir)].map(toConsoleJava);
  for (const c of cands) {
    if (seen.has(c)) continue;
    seen.add(c);
    if (c !== javaExeName() && !fs.existsSync(c)) continue;
    const major = await javaMajor(c);
    if (major) found.push({ path: c, major });
  }
  return found;
}

function pickJava(javas, required) {
  const ok = javas.filter((j) => (required <= 8 ? j.major === 8 : j.major >= required));
  if (!ok.length) return null;
  ok.sort((a, b) => a.major - b.major);
  return ok[0];
}

function findJavaBinary(root, depth = 0) {
  const exe = javaExeName();
  const direct = path.join(root, 'bin', exe);
  if (fs.existsSync(direct)) return direct;
  if (depth > 3) return null;
  for (const d of listDirs(root)) {
    const r = findJavaBinary(d, depth + 1);
    if (r) return r;
  }
  return null;
}

async function installRuntime(major, dataDir, emit) {
  const lts = [8, 11, 17, 21, 25];
  const target = lts.find((v) => v >= major) || major;
  const dest = path.join(dataDir, 'runtime', `jre-${target}`);
  const existing = fs.existsSync(dest) ? findJavaBinary(dest) : null;
  if (existing && (await javaMajor(existing))) return { path: existing, major: target };

  const osId = IS_WIN ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  const url = `https://api.adoptium.net/v3/binary/latest/${target}/ga/${osId}/${arch}/jre/hotspot/normal/eclipse`;
  const archive = path.join(dataDir, 'runtime', `jre-${target}${IS_WIN ? '.zip' : '.tar.gz'}`);
  emit({ stage: 'java', message: `Java ${target} not found. Downloading it automatically (one-time)...` });
  await download(url, archive, {}, 3);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  emit({ stage: 'java', message: `Extracting Java ${target}...` });
  if (IS_WIN) {
    extractZip(archive, dest, { stripTop: true });
  } else {
    await new Promise((resolve, reject) =>
      execFile('tar', ['-xzf', archive, '-C', dest, '--strip-components=1'], (e) => (e ? reject(e) : resolve()))
    );
  }
  fs.rmSync(archive, { force: true });
  const bin = findJavaBinary(dest);
  if (!bin) throw new Error(`Java ${target} was extracted but the java binary was not found`);
  if (!IS_WIN) fs.chmodSync(bin, 0o755);
  return { path: bin, major: target };
}

// Drop JVM flags this Java version does not support (otherwise the game will not start)
function sanitizeJvmFlags(flags, javaMajorVer) {
  return flags.filter((f) => {
    if (f === '-XX:+ZGenerational' || f === '-XX:-ZGenerational') return javaMajorVer >= 21 && javaMajorVer <= 23;
    if (f === '-XX:+UseZGC') return javaMajorVer >= 15;
    if (f === '-XX:+UseShenandoahGC') return javaMajorVer >= 12;
    if (f.startsWith('-XX:ShenandoahGCHeuristics')) return javaMajorVer >= 12;
    if (f === '-XX:+UseLargePages') return false; // needs admin rights, otherwise warns or crashes
    return true;
  });
}

// ---------------------------------------------------------------- version json

async function getVanillaJson(mcVersion, dirs) {
  const jsonPath = path.join(dirs.versions, mcVersion, `${mcVersion}.json`);
  if (fs.existsSync(jsonPath)) {
    try {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch {
      /* download again */
    }
  }
  const manifest = await fetchJson(MANIFEST_URL);
  const entry = manifest.versions.find((v) => v.id === mcVersion);
  if (!entry) throw new Error(`Minecraft version "${mcVersion}" was not found in Mojang's version list. Pick another version.`);
  await download(entry.url, jsonPath, { sha1: entry.sha1 });
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

async function getFabricLikeJson(loader, mcVersion, dirs) {
  const meta = loader === 'quilt' ? 'https://meta.quiltmc.org/v3' : 'https://meta.fabricmc.net/v2';
  const list = await fetchJson(`${meta}/versions/loader/${encodeURIComponent(mcVersion)}`);
  if (!Array.isArray(list) || !list.length) throw new Error(`${loader} is not available for Minecraft ${mcVersion}. Pick another version or loader.`);
  const stable = list.find((x) => x.loader && x.loader.stable !== false) || list[0];
  const loaderVer = stable.loader.version;
  const id = `${loader}-loader-${loaderVer}-${mcVersion}`;
  const jsonPath = path.join(dirs.versions, id, `${id}.json`);
  if (!fs.existsSync(jsonPath)) {
    const profile = await fetchJson(
      `${meta}/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVer)}/profile/json`
    );
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(profile, null, 2));
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

async function getForgeLikeJson(loader, mcVersion, dirs, javaBin, emit) {
  const registryFile = path.join(dirs.root, 'phoenix-loaders.json');
  let registry = {};
  try {
    registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
  } catch {
    /* empty */
  }
  const key = `${loader}:${mcVersion}`;
  if (registry[key]) {
    const p = path.join(dirs.versions, registry[key], `${registry[key]}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  let installerUrl;
  if (loader === 'forge') {
    const promos = await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
    const ver = promos.promos[`${mcVersion}-recommended`] || promos.promos[`${mcVersion}-latest`];
    if (!ver) throw new Error(`Forge is not available for Minecraft ${mcVersion}. Try Fabric or another version.`);
    const full = `${mcVersion}-${ver}`;
    installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${full}/forge-${full}-installer.jar`;
  } else {
    // NeoForge: MC 1.21.4 -> 21.4.x
    const parts = mcVersion.split('.');
    const prefix = `${parts[1]}.${parts[2] || '0'}.`;
    const all = await fetchJson('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
    const cands = (all.versions || []).filter((v) => v.startsWith(prefix) && !v.includes('beta'));
    const picked = cands[cands.length - 1] || (all.versions || []).filter((v) => v.startsWith(prefix)).pop();
    if (!picked) throw new Error(`NeoForge is not available for Minecraft ${mcVersion}. Try Fabric or another version.`);
    installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${picked}/neoforge-${picked}-installer.jar`;
  }

  const installer = path.join(dirs.root, 'installers', `${loader}-${mcVersion}-installer.jar`);
  emit({ stage: 'loader', message: `Downloading ${loader} installer...` });
  await download(installerUrl, installer);
  const profilesFile = path.join(dirs.root, 'launcher_profiles.json');
  if (!fs.existsSync(profilesFile)) fs.writeFileSync(profilesFile, JSON.stringify({ profiles: {}, version: 3 }));

  const before = new Set(listDirs(dirs.versions).map((d) => path.basename(d)));
  emit({ stage: 'loader', message: `Installing ${loader} (the first time can take a few minutes)...` });
  await new Promise((resolve, reject) => {
    const p = spawn(javaBin, ['-jar', installer, '--installClient', dirs.root], { cwd: dirs.root, windowsHide: true });
    let tail = '';
    const onData = (d) => {
      tail = (tail + d.toString()).slice(-1500);
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${loader} installer fail (code ${code}): ${tail.trim().split('\n').slice(-3).join(' | ')}`))));
  });

  const created = listDirs(dirs.versions)
    .map((d) => path.basename(d))
    .filter((n) => !before.has(n) && n.toLowerCase().includes(loader === 'forge' ? 'forge' : 'neoforge'));
  const id = created[0] || listDirs(dirs.versions).map((d) => path.basename(d)).find((n) => n.toLowerCase().includes(loader) && n.includes(mcVersion));
  if (!id) throw new Error(`${loader} installed but its version folder was not found`);
  registry[key] = id;
  fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));
  return JSON.parse(fs.readFileSync(path.join(dirs.versions, id, `${id}.json`), 'utf8'));
}

function mergeVersions(parent, child) {
  const libMap = new Map();
  for (const l of [...(child.libraries || []), ...(parent.libraries || [])]) {
    const k = libKey(l.name) + (l.natives ? ':natives' : '');
    if (!libMap.has(k)) libMap.set(k, l);
  }
  const merged = { ...parent, ...child };
  merged.libraries = [...libMap.values()];
  if (child.minecraftArguments && !child.arguments) {
    merged.minecraftArguments = child.minecraftArguments;
    delete merged.arguments;
  } else {
    merged.arguments = {
      game: [...((parent.arguments && parent.arguments.game) || []), ...((child.arguments && child.arguments.game) || [])],
      jvm: [...((parent.arguments && parent.arguments.jvm) || []), ...((child.arguments && child.arguments.jvm) || [])],
    };
  }
  merged.assetIndex = child.assetIndex || parent.assetIndex;
  merged.assets = child.assets || parent.assets;
  merged.downloads = child.downloads || parent.downloads;
  merged.javaVersion = child.javaVersion || parent.javaVersion;
  merged.logging = child.logging || parent.logging;
  merged.mainClass = child.mainClass || parent.mainClass;
  return merged;
}

// ---------------------------------------------------------------- libraries / assets

async function prepareLibraries(vjson, dirs, nativesDir, progress, ctx) {
  const classpath = [];
  const jobs = [];
  const nativeJobs = [];

  for (const lib of vjson.libraries) {
    if (!rulesAllow(lib.rules)) continue;

    const dl = lib.downloads && lib.downloads.artifact;
    if (lib.natives) {
      const classifier = (lib.natives[OS_NAME] || '').replace('${arch}', process.arch === 'ia32' ? '32' : '64');
      const nat = classifier && lib.downloads && lib.downloads.classifiers && lib.downloads.classifiers[classifier];
      if (nat) {
        const dest = path.join(dirs.libraries, nat.path);
        jobs.push({ url: nat.url, dest, sha1: nat.sha1, size: nat.size });
        nativeJobs.push({ dest, exclude: (lib.extract && lib.extract.exclude) || ['META-INF/'] });
      }
      if (!dl) continue;
    }

    let rel;
    let url;
    let sha1;
    let size;
    if (dl && dl.path) {
      rel = dl.path;
      url = dl.url;
      sha1 = dl.sha1;
      size = dl.size;
    } else {
      rel = mavenPath(lib.name);
      const base = lib.url || 'https://libraries.minecraft.net/';
      url = base.replace(/\/?$/, '/') + rel;
    }
    const dest = path.join(dirs.libraries, rel);
    if (url) jobs.push({ url, dest, sha1, size });
    else if (!fs.existsSync(dest)) throw new Error(`No download URL for library: ${lib.name}`);
    classpath.push(dest);
  }

  let done = 0;
  await runPool(jobs, 12, async (j) => {
    await download(j.url, j.dest, { sha1: j.sha1, size: j.size });
    done++;
    progress(done / jobs.length, `Libraries ${done}/${jobs.length}`);
  }, ctx);

  fs.mkdirSync(nativesDir, { recursive: true });
  for (const n of nativeJobs) extractZip(n.dest, nativesDir, { exclude: n.exclude });

  return Array.from(new Set(classpath));
}

async function prepareAssets(vjson, dirs, gameDir, progress, ctx) {
  const idx = vjson.assetIndex;
  if (!idx) return { assetsRoot: dirs.assets, gameAssets: dirs.assets };
  const indexPath = path.join(dirs.assets, 'indexes', `${idx.id}.json`);
  await download(idx.url, indexPath, { sha1: idx.sha1 });
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const objects = Object.entries(index.objects || {});

  let done = 0;
  await runPool(objects, 24, async ([, obj]) => {
    const sub = obj.hash.slice(0, 2);
    const dest = path.join(dirs.assets, 'objects', sub, obj.hash);
    await download(`https://resources.download.minecraft.net/${sub}/${obj.hash}`, dest, { size: obj.size });
    done++;
    if (done % 40 === 0 || done === objects.length) progress(done / objects.length, `Assets ${done}/${objects.length}`);
  }, ctx);

  let gameAssets = dirs.assets;
  if (index.virtual || index.map_to_resources) {
    const target = index.map_to_resources ? path.join(gameDir, 'resources') : path.join(dirs.assets, 'virtual', idx.id);
    for (const [name, obj] of objects) {
      const from = path.join(dirs.assets, 'objects', obj.hash.slice(0, 2), obj.hash);
      const to = path.join(target, ...name.split('/'));
      if (!fs.existsSync(to)) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
      }
    }
    gameAssets = target;
  }
  return { assetsRoot: dirs.assets, gameAssets };
}

// ---------------------------------------------------------------- Modrinth (mods + .mrpack)

async function modrinthVersion(slugOrId, loaders, mcVersion) {
  const qs = new URLSearchParams();
  if (loaders.length) qs.set('loaders', JSON.stringify(loaders));
  qs.set('game_versions', JSON.stringify([mcVersion]));
  const list = await fetchJson(`https://api.modrinth.com/v2/project/${encodeURIComponent(slugOrId)}/version?${qs}`, 2);
  if (!Array.isArray(list) || !list.length) return null;
  return list.find((v) => v.version_type === 'release') || list[0];
}

async function installMrpack(file, gameDir, emit, ctx) {
  const marker = path.join(gameDir, `.phoenix-pack-${path.basename(file)}.done`);
  const indexBuf = readZipEntry(file, 'modrinth.index.json');
  if (!indexBuf) throw new Error('The modpack file has no modrinth.index.json');
  const index = JSON.parse(indexBuf.toString('utf8'));
  const deps = index.dependencies || {};
  if (!fs.existsSync(marker)) {
    const files = (index.files || []).filter((f) => !(f.env && f.env.client === 'unsupported'));
    emit({ stage: 'mods', message: `Downloading ${files.length} files for modpack "${index.name}"...` });
    const root = path.resolve(gameDir);
    await runPool(files, 8, async (f) => {
      const dest = path.resolve(root, f.path);
      if (!dest.startsWith(root + path.sep)) return; // path traversal block
      await download(f.downloads[0], dest, { sha1: f.hashes && f.hashes.sha1 });
    }, ctx);
    extractZip(file, gameDir, { prefix: 'overrides/' });
    extractZip(file, gameDir, { prefix: 'client-overrides/' });
    fs.writeFileSync(marker, 'ok');
  }
  return deps;
}

async function installMods(instance, effective, gameDir, emit, ctx, extraRefs = []) {
  const mods = (instance.mods || []).filter((m) => m.enabled);
  if (!mods.length && !extraRefs.length) return { overrides: null };
  const loader = effective.loader;
  const loaders = loader === 'quilt' ? ['quilt', 'fabric'] : loader === 'vanilla' ? [] : [loader];
  const visited = new Set();
  const queue = [];
  let overrides = null;
  const warnings = [];

  for (const m of mods) queue.push({ ref: m.slug || m.id, type: m.projectType || 'mod', title: m.title });
  for (const x of extraRefs) queue.push(x);

  let count = 0;
  while (queue.length && count < 80) {
    checkCancel(ctx);
    const item = queue.shift();
    if (visited.has(item.ref)) continue;
    visited.add(item.ref);
    count++;
    try {
      if (item.type === 'mod' && loader === 'vanilla') {
        warnings.push(`${item.title || item.ref}: mods do not work on a Vanilla profile (choose Fabric)`);
        continue;
      }
      let ver;
      if (item.versionId) ver = await fetchJson(`https://api.modrinth.com/v2/version/${item.versionId}`, 2);
      else ver = await modrinthVersion(item.ref, item.type === 'mod' ? loaders : [], effective.mcVersion);
      if (!ver) {
        warnings.push(`${item.title || item.ref}: no compatible version for ${effective.mcVersion}, skipped`);
        continue;
      }
      const f = (ver.files || []).find((x) => x.primary) || (ver.files || [])[0];
      if (!f) continue;

      if (item.type === 'modpack') {
        const packPath = path.join(gameDir, '.phoenix-packs', f.filename);
        emit({ stage: 'mods', message: `Modpack download: ${item.title || item.ref}` });
        await download(f.url, packPath, { sha1: f.hashes && f.hashes.sha1 });
        const deps = await installMrpack(packPath, gameDir, emit, ctx);
        overrides = {
          mcVersion: deps.minecraft,
          loader: deps['fabric-loader'] ? 'fabric' : deps['quilt-loader'] ? 'quilt' : deps.neoforge ? 'neoforge' : deps.forge ? 'forge' : null,
        };
        continue;
      }

      const sub = item.type === 'shader' ? 'shaderpacks' : item.type === 'resourcepack' ? 'resourcepacks' : 'mods';
      const dest = path.join(gameDir, sub, f.filename);
      emit({ stage: 'mods', message: `${item.type === 'shader' ? 'Shader' : 'Mod'}: ${f.filename}` });
      await download(f.url, dest, { sha1: f.hashes && f.hashes.sha1 });

      for (const dep of ver.dependencies || []) {
        if (dep.dependency_type !== 'required') continue;
        if (dep.version_id) queue.push({ ref: dep.project_id || dep.version_id, versionId: dep.version_id, type: 'mod', title: 'dependency' });
        else if (dep.project_id) queue.push({ ref: dep.project_id, type: 'mod', title: 'dependency' });
      }
    } catch (err) {
      if (err instanceof CancelledError) throw err;
      warnings.push(`${item.title || item.ref}: ${err.message}`);
    }
  }
  for (const w of warnings) emit({ stage: 'mods', message: `Warning: ${w}`, level: 'warn' });
  return { overrides };
}


// ---------------------------------------------------------------- FPS boost

// Performance mods per preset (Modrinth slugs). Installed automatically on Fabric / Quilt profiles.
const PERF_MODS = {
  potato: ['sodium', 'lithium', 'ferrite-core', 'entityculling', 'immediatelyfast', 'modernfix'],
  balanced: ['sodium', 'lithium', 'ferrite-core', 'entityculling', 'immediatelyfast'],
  competitive: ['sodium', 'lithium', 'immediatelyfast', 'modernfix'],
  esports240: ['sodium', 'lithium', 'immediatelyfast', 'modernfix', 'nvidium'],
  ultra_shaders: ['sodium', 'lithium', 'iris', 'immediatelyfast'],
  distant_horizons: ['sodium', 'lithium', 'iris', 'distanthorizons'],
};

function perfModRefs(presetId) {
  const list = PERF_MODS[presetId] || PERF_MODS.balanced;
  const refs = list.map((slug) => ({ ref: slug, type: 'mod', title: slug }));
  if (presetId === 'ultra_shaders' || presetId === 'distant_horizons') {
    refs.push({ ref: 'complementary-reimagined', type: 'shader', title: 'Complementary Reimagined' });
  }
  return refs;
}

// Writes the selected skin/cape where CustomSkinLoader reads local skins (<gameDir>/CustomSkinLoader/LocalSkin).
function writeLocalSkin(gameDir, username, skin, emit) {
  try {
    const base = path.join(gameDir, 'CustomSkinLoader', 'LocalSkin');
    fs.mkdirSync(path.join(base, 'skins'), { recursive: true });
    fs.mkdirSync(path.join(base, 'capes'), { recursive: true });
    const safe = String(username).replace(/[^A-Za-z0-9_]/g, '_');
    fs.writeFileSync(path.join(base, 'skins', `${safe}.png`), Buffer.from(skin.skinPng, 'base64'));
    const capeFile = path.join(base, 'capes', `${safe}.png`);
    if (skin.capePng) fs.writeFileSync(capeFile, Buffer.from(skin.capePng, 'base64'));
    else if (fs.existsSync(capeFile)) fs.unlinkSync(capeFile);
    emit({ stage: 'skin', message: 'Skin and cape ready for in-game display', percent: 40 });
  } catch (e) {
    emit({ stage: 'skin', message: `Warning: could not write skin: ${e.message}`, level: 'warn' });
  }
}

// Fixes the usual causes of a laggy game: pre-touching the whole heap (starves low-RAM PCs) and a heap
// larger than the PC can really give (causes swapping, which makes mobs and the whole game stutter).
function tuneJvmForSpeed(flags, emit) {
  const totalMb = Math.round(os.totalmem() / 1048576);
  for (let i = flags.length - 1; i >= 0; i--) if (flags[i] === '-XX:+AlwaysPreTouch') flags.splice(i, 1);
  const num = (f) => parseInt(f.replace(/^-Xm[sx]/, ''), 10) * (/g$/i.test(f) ? 1024 : 1);
  const xmxI = flags.findIndex((f) => /^-Xmx/i.test(f));
  const xmsI = flags.findIndex((f) => /^-Xms/i.test(f));
  if (xmxI >= 0) {
    const cap = Math.max(1536, Math.floor(totalMb * 0.65));
    const xmx = num(flags[xmxI]);
    if (xmx > cap) {
      flags[xmxI] = `-Xmx${cap}M`;
      emit({ stage: 'fps', message: `RAM limit lowered to ${cap} MB (your PC has ${totalMb} MB) to avoid swapping`, level: 'warn' });
    }
  }
  if (xmsI >= 0) {
    const xmx = xmxI >= 0 ? num(flags[xmxI]) : 4096;
    flags[xmsI] = `-Xms${Math.min(1024, xmx)}M`;
  }
}

// Laptops with two GPUs often run Java on the weak integrated GPU. Ask Windows to use the fast one.
function preferHighPerformanceGpu(javaPath, emit) {
  if (process.platform !== 'win32') return;
  try {
    const exes = [javaPath, javaPath.replace(/java\.exe$/i, 'javaw.exe')];
    for (const exe of exes) {
      if (!fs.existsSync(exe)) continue;
      require('child_process').execFileSync(
        'reg',
        ['add', 'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences', '/v', exe, '/t', 'REG_SZ', '/d', 'GpuPreference=2;', '/f'],
        { windowsHide: true, stdio: 'ignore', timeout: 5000 }
      );
    }
    emit({ stage: 'fps', message: 'Windows told to use the high-performance GPU for Minecraft' });
  } catch {
    /* optional */
  }
}

// Installs the Phoenix Client HUD mod (built from /phoenix-client-mod) when a download link is configured.
async function ensurePhoenixClient(instance, effective, gameDir, emit) {
  const config = require('./config.cjs');
  if (!config.PHOENIX_CLIENT_JAR_URL || instance.phoenixClient === false) return;
  if ((effective.loader !== 'fabric' && effective.loader !== 'quilt') || String(instance.mcVersion) !== config.PHOENIX_CLIENT_MC) return;
  const target = path.join(gameDir, 'mods', 'phoenix-client.jar');
  if (fs.existsSync(target)) return;
  try {
    const u = new URL(config.PHOENIX_CLIENT_JAR_URL);
    if (u.protocol !== 'https:') throw new Error('link must be https');
    emit({ stage: 'mods', message: 'Installing Phoenix Client...' });
    const res = await fetch(u, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    emit({ stage: 'mods', message: `Phoenix Client not installed: ${e.message}`, level: 'warn' });
  }
}

function mcAtMost(mcVersion, major, minor, patch) {
  const m = String(mcVersion).match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return false;
  const v = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3] || '0', 10)];
  const lim = [major, minor, patch];
  for (let i = 0; i < 3; i++) {
    if (v[i] < lim[i]) return true;
    if (v[i] > lim[i]) return false;
  }
  return true;
}

// Writes graphics settings into options.txt. Only runs when the preset changed, so in-game tweaks are kept.
function applyFpsOptions(instance, hardware, mcVersion, gameDir, emit) {
  if (!hardware) return;
  const presetId = instance.fpsPresetId || 'custom';
  const signature = JSON.stringify([presetId, hardware.renderDistance, hardware.simulationDistance, hardware.entityShadows, hardware.particles, hardware.mipmapLevels]);
  const marker = path.join(gameDir, '.phoenix-fps-applied');
  try {
    if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === signature) return;
  } catch {
    /* apply again */
  }

  const optionsFile = path.join(gameDir, 'options.txt');
  const map = new Map();
  try {
    for (const line of fs.readFileSync(optionsFile, 'utf8').split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i > 0) map.set(line.slice(0, i), line.slice(i + 1));
    }
  } catch {
    /* new file */
  }

  const lowEnd = hardware.renderDistance <= 10;
  const particles = { all: '0', decreased: '1', minimal: '2' }[hardware.particles] || '1';
  map.set('renderDistance', String(hardware.renderDistance));
  if (!mcAtMost(mcVersion, 1, 17, 99)) map.set('simulationDistance', String(hardware.simulationDistance));
  map.set('entityShadows', hardware.entityShadows ? 'true' : 'false');
  map.set('particles', particles);
  map.set('mipmapLevels', String(hardware.mipmapLevels));
  map.set('maxFps', lowEnd ? '120' : '260');
  map.set('enableVsync', 'false');
  map.set('biomeBlendRadius', lowEnd ? '1' : '3');
  map.set('entityDistanceScaling', lowEnd ? '0.75' : '1.0');
  if (mcAtMost(mcVersion, 1, 21, 4)) map.set('graphicsMode', lowEnd ? '0' : '1');
  map.set('ao', lowEnd ? 'false' : 'true');
  map.set('renderClouds', lowEnd ? 'false' : '"fast"');

  const out = [...map.entries()].map(([k, v]) => `${k}:${v}`).join('\n') + '\n';
  fs.mkdirSync(gameDir, { recursive: true });
  fs.writeFileSync(optionsFile, out);
  fs.writeFileSync(marker, signature);
  emit({ stage: 'fps', message: `FPS boost applied: ${hardware.renderDistance} chunks, particles ${hardware.particles}, shadows ${hardware.entityShadows ? 'on' : 'off'}` });
}

// ---------------------------------------------------------------- launch

function substitute(str, vars) {
  return String(str).replace(/\$\{([^}]+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function flattenArgs(list, features, vars) {
  const out = [];
  for (const a of list || []) {
    if (typeof a === 'string') {
      out.push(substitute(a, vars));
    } else if (a && rulesAllow(a.rules, features)) {
      const vals = Array.isArray(a.value) ? a.value : [a.value];
      for (const v of vals) out.push(substitute(v, vars));
    }
  }
  return out;
}

function makeDirs(root) {
  const dirs = {
    root,
    versions: path.join(root, 'versions'),
    libraries: path.join(root, 'libraries'),
    assets: path.join(root, 'assets'),
  };
  for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });
  return dirs;
}

/**
 * payload: { instance, username, javaPath, dataDir }
 * hooks: { emit(evt), onExit(info) }
 */
const activeLaunches = new Map(); // instanceId -> { cancelled, child }

function stopLaunch(instanceId) {
  const entry = activeLaunches.get(instanceId);
  if (!entry) return false;
  entry.cancelled = true;
  entry.stoppedByUser = true;
  if (entry.child && entry.child.pid) killProcessTree(entry.child.pid, entry.child);
  return true;
}

// Kills a process and its children. Tries taskkill first, then plain kill, and checks again after 2.5 s.
function killProcessTree(pid, child) {
  const hardKill = () => {
    try {
      if (IS_WIN) {
        const sysRoot = process.env.SystemRoot || 'C:\\Windows';
        execFile(path.join(sysRoot, 'System32', 'taskkill.exe'), ['/pid', String(pid), '/t', '/f'], { windowsHide: true }, () => {});
      } else {
        process.kill(-pid, 'SIGKILL');
      }
    } catch {
      /* already gone */
    }
    try {
      if (child) child.kill('SIGKILL');
      else process.kill(pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  };
  hardKill();
  setTimeout(() => {
    try {
      process.kill(pid, 0); // still alive?
      hardKill();
    } catch {
      /* gone */
    }
  }, 2500);
}

async function launch(payload, hooks) {
  const instanceId = payload.instance && payload.instance.id;
  const ctx = { cancelled: false, child: null, stoppedByUser: false };
  if (instanceId) activeLaunches.set(instanceId, ctx);
  try {
    return await launchInner(payload, hooks, ctx, instanceId);
  } catch (err) {
    if (instanceId) activeLaunches.delete(instanceId);
    throw err;
  }
}

async function launchInner(payload, hooks, ctx, instanceId) {
  const emit = (evt) => hooks.emit({ ...evt, instanceId });
  const instance = payload.instance;
  if (!instance || !instance.mcVersion) throw new Error('Profile data is missing');
  const dataDir = payload.dataDir;
  const dirs = makeDirs(dataDir);
  const gameDir = path.join(dataDir, 'instances', String(instance.id || instance.name).replace(/[^\w.-]+/g, '_'));
  fs.mkdirSync(path.join(gameDir, 'logs'), { recursive: true });

  const prog = (base, span) => (frac, message) =>
    emit({ stage: 'progress', percent: Math.round(base + span * Math.min(1, Math.max(0, frac))), message });

  // 0) a modpack can override the Minecraft version / loader
  const effective = { mcVersion: instance.mcVersion, loader: instance.loader || 'vanilla' };

  // 1) Detect Java (the loader installer needs it too); required version comes from the vanilla json
  emit({ stage: 'version', message: `Loading Minecraft ${effective.mcVersion} info...`, percent: 2 });
  checkCancel(ctx);
  let vanilla = await getVanillaJson(effective.mcVersion, dirs);
  const requiredJava = (vanilla.javaVersion && vanilla.javaVersion.majorVersion) || 8;

  emit({ stage: 'java', message: `Looking for Java (needs Java ${requiredJava})...`, percent: 5 });
  const found = await detectJavas(dataDir, payload.javaPath);
  let java = pickJava(found, requiredJava);
  if (!java) java = await installRuntime(requiredJava, dataDir, emit);
  emit({ stage: 'java', message: `Using Java ${java.major}: ${java.path}`, percent: 8 });

  // 2) mods / modpack
  checkCancel(ctx);
  const autoFps = instance.autoFpsMods !== false && (effective.loader === 'fabric' || effective.loader === 'quilt');
  // Offline accounts have no skin server, so the CustomSkinLoader mod shows the chosen skin/cape in game.
  const wantSkin =
    payload.auth && payload.auth.type === 'offline' && payload.skin && payload.skin.skinPng && effective.loader !== 'vanilla' && effective.loader !== 'forge' && effective.loader !== 'neoforge';
  const extraRefs = [
    ...(autoFps ? perfModRefs(instance.fpsPresetId) : []),
    ...(wantSkin ? [{ ref: 'customskinloader', type: 'mod', title: 'CustomSkinLoader' }] : []),
  ];
  const modResult = await installMods(instance, effective, gameDir, emit, ctx, extraRefs).catch((e) => {
    if (e instanceof CancelledError) throw e;
    emit({ stage: 'mods', message: `Warning: mods install error: ${e.message}`, level: 'warn' });
    return { overrides: null };
  });
  checkCancel(ctx);
  applyFpsOptions(instance, payload.hardware, effective.mcVersion, gameDir, emit);
  await ensurePhoenixClient(instance, effective, gameDir, emit);
  if (wantSkin) writeLocalSkin(gameDir, payload.auth.username, payload.skin, emit);
  if (modResult.overrides) {
    if (modResult.overrides.mcVersion && modResult.overrides.mcVersion !== effective.mcVersion) {
      emit({ stage: 'mods', message: `The modpack needs Minecraft ${modResult.overrides.mcVersion}, using that version`, level: 'warn' });
      effective.mcVersion = modResult.overrides.mcVersion;
      vanilla = await getVanillaJson(effective.mcVersion, dirs);
    }
    if (modResult.overrides.loader) effective.loader = modResult.overrides.loader;
  }

  // 3) loader profile
  let vjson = vanilla;
  if (effective.loader === 'fabric' || effective.loader === 'quilt') {
    emit({ stage: 'loader', message: `Setting up ${effective.loader} loader...`, percent: 12 });
    const profile = await getFabricLikeJson(effective.loader, effective.mcVersion, dirs);
    vjson = mergeVersions(vanilla, profile);
  } else if (effective.loader === 'forge' || effective.loader === 'neoforge') {
    // The installer needs the vanilla client jar first
    const clientTmp = path.join(dirs.versions, effective.mcVersion, `${effective.mcVersion}.jar`);
    await download(vanilla.downloads.client.url, clientTmp, { sha1: vanilla.downloads.client.sha1 });
    const profile = await getForgeLikeJson(effective.loader, effective.mcVersion, dirs, java.path, emit);
    vjson = mergeVersions(vanilla, profile);
  }

  // 4) client jar
  const clientJar = path.join(dirs.versions, effective.mcVersion, `${effective.mcVersion}.jar`);
  emit({ stage: 'client', message: 'Game client download/verify...', percent: 15 });
  await download(vanilla.downloads.client.url, clientJar, { sha1: vanilla.downloads.client.sha1 });

  // 5) libraries
  const nativesDir = path.join(dirs.versions, effective.mcVersion, 'natives');
  fs.rmSync(nativesDir, { recursive: true, force: true });
  checkCancel(ctx);
  const libs = await prepareLibraries(vjson, dirs, nativesDir, prog(18, 22), ctx);

  // 6) assets
  checkCancel(ctx);
  const { assetsRoot, gameAssets } = await prepareAssets(vjson, dirs, gameDir, prog(40, 45), ctx);
  checkCancel(ctx);

  // 7) logging config
  let loggingArg = null;
  const logCfg = vjson.logging && vjson.logging.client;
  if (logCfg && logCfg.file) {
    const logPath = path.join(dirs.assets, 'log_configs', logCfg.file.id);
    await download(logCfg.file.url, logPath, { sha1: logCfg.file.sha1 });
    loggingArg = logCfg.argument.replace('${path}', logPath);
  }

  // 8) arguments
  const auth = payload.auth || {};
  const isMicrosoft = auth.type === 'microsoft' && auth.accessToken;
  const username = isMicrosoft ? auth.username : sanitizeName(auth.username || payload.username);
  const uuid = isMicrosoft ? String(auth.uuid).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5') : offlineUuid(username);
  const features = {
    has_custom_resolution: true,
    is_demo_user: false,
    has_quick_plays_support: false,
    is_quick_play_singleplayer: false,
    is_quick_play_multiplayer: false,
    is_quick_play_realms: false,
  };
  const sep = IS_WIN ? ';' : ':';
  const classpath = [...libs, clientJar].join(sep);
  const res = instance.resolution || { width: 1280, height: 720 };
  const versionName = vjson.id || effective.mcVersion;
  const vars = {
    auth_player_name: username,
    version_name: versionName,
    game_directory: gameDir,
    assets_root: assetsRoot,
    game_assets: gameAssets,
    assets_index_name: (vjson.assetIndex && vjson.assetIndex.id) || vjson.assets || 'legacy',
    auth_uuid: uuid.replace(/-/g, ''),
    auth_access_token: isMicrosoft ? auth.accessToken : '0',
    auth_session: isMicrosoft ? auth.accessToken : '0',
    auth_xuid: isMicrosoft ? auth.xuid || '0' : '0',
    clientid: '0',
    user_type: isMicrosoft ? 'msa' : 'legacy',
    user_properties: '{}',
    version_type: 'Phoenix',
    natives_directory: nativesDir,
    launcher_name: 'phoenix-launcher',
    launcher_version: LAUNCHER_VERSION,
    classpath,
    classpath_separator: sep,
    library_directory: dirs.libraries,
    resolution_width: String(res.width),
    resolution_height: String(res.height),
  };

  let jvmFromJson;
  let gameArgs;
  if (vjson.arguments) {
    jvmFromJson = flattenArgs(vjson.arguments.jvm, features, vars);
    gameArgs = flattenArgs(vjson.arguments.game, features, vars);
  } else {
    jvmFromJson = flattenArgs(
      ['-Djava.library.path=${natives_directory}', '-Dminecraft.launcher.brand=${launcher_name}', '-Dminecraft.launcher.version=${launcher_version}', '-cp', '${classpath}'],
      features,
      vars
    );
    gameArgs = String(vjson.minecraftArguments || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((a) => substitute(a, vars));
    gameArgs.push('--width', String(res.width), '--height', String(res.height));
  }
  // Join a server straight from the launcher (Minecraft 1.20+ uses quickPlay, older versions use --server).
  if (payload.quickPlay && payload.quickPlay.host && /^[a-z0-9.-]{3,80}$/i.test(payload.quickPlay.host)) {
    const port = Number(payload.quickPlay.port) || 25565;
    const m = String(instance.mcVersion).match(/^1\.(\d+)/);
    const modern = /^\d\dw/.test(String(instance.mcVersion)) || (m && Number(m[1]) >= 20);
    if (modern) gameArgs.push('--quickPlayMultiplayer', `${payload.quickPlay.host}:${port}`);
    else gameArgs.push('--server', payload.quickPlay.host, '--port', String(port));
  }
  if (!jvmFromJson.includes('-cp') && !jvmFromJson.includes('-classpath')) jvmFromJson.push('-cp', classpath);
  if (!jvmFromJson.some((a) => a.startsWith('-Djava.library.path'))) jvmFromJson.unshift(`-Djava.library.path=${nativesDir}`);
  if (process.platform === 'darwin' && !jvmFromJson.includes('-XstartOnFirstThread')) jvmFromJson.unshift('-XstartOnFirstThread');

  const userFlags = sanitizeJvmFlags(String(instance.jvmArgs || `-Xmx${instance.ramMb || 4096}M`).split(/\s+/).filter(Boolean), java.major);
  if (!userFlags.some((f) => f.startsWith('-Xmx'))) userFlags.unshift(`-Xmx${instance.ramMb || 4096}M`);
  tuneJvmForSpeed(userFlags, emit);
  {
    const xmx = userFlags.find((f) => /^-Xmx/i.test(f)) || 'default';
    emit({ stage: 'fps', message: `Java ${java.major} | heap ${xmx.replace('-Xmx', '')} | ${effective.loader} ${instance.mcVersion} | PC RAM ${Math.round(os.totalmem() / 1073741824)} GB` });
    if (effective.loader === 'vanilla' && instance.autoFpsMods !== false) {
      emit({ stage: 'fps', message: 'Tip: Vanilla has no FPS mods. Create a Fabric profile to get Sodium, Lithium and more automatically.', level: 'warn' });
    }
  }
  preferHighPerformanceGpu(java.path, emit);

  const args = [...userFlags, ...(loggingArg ? [loggingArg] : []), ...jvmFromJson, vjson.mainClass, ...gameArgs];

  // 9) spawn
  emit({ stage: 'launch', message: `Starting Minecraft as ${username} (${isMicrosoft ? 'Microsoft account' : 'local account'})...`, percent: 96 });
  const logFile = path.join(gameDir, 'logs', 'phoenix-launch.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'w' });
  logStream.write(`# ${new Date().toISOString()}\n# ${java.path}\n# ${args.join(' ').replace(/--accessToken \S+/g, '--accessToken ***')}\n\n`);

  checkCancel(ctx);
  const child = spawn(java.path, args, { cwd: gameDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  ctx.child = child;
  await new Promise((resolve, reject) => {
    child.once('spawn', () => {
      try {
        os.setPriority(child.pid, os.constants.priority.PRIORITY_ABOVE_NORMAL);
      } catch {
        /* not allowed: ignore */
      }
      resolve();
    });
    child.once('error', (e) => reject(new Error(`Java could not start: ${e.message}`)));
  });

  const tail = [];
  const pushLines = (buf) => {
    const text = buf.toString();
    logStream.write(text);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      tail.push(line);
      if (tail.length > 40) tail.shift();
      hooks.emit({ stage: 'game-log', message: line });
    }
  };
  child.stdout.on('data', pushLines);
  child.stderr.on('data', pushLines);
  child.on('exit', (code, signal) => {
    logStream.end();
    activeLaunches.delete(instanceId);
    hooks.onExit({ code, signal, tail: tail.slice(-12), logFile, instanceId: instance.id, stoppedByUser: ctx.stoppedByUser });
  });

  emit({ stage: 'launched', message: 'Minecraft started. The game window can take 10-30 seconds to appear.', percent: 100 });
  return { pid: child.pid, gameDir, java: java.path, javaMajor: java.major, logFile, username, uuid };
}

module.exports = { launch, stopLaunch, killProcessTree, CancelledError, detectJavas, offlineUuid, rulesAllow, mavenPath, mergeVersions, sanitizeJvmFlags, sanitizeName, substitute };
