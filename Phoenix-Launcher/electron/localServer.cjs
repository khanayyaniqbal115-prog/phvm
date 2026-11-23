// Small local web server: serves dist/ and handles /api/* (Mojang versions + Modrinth).
// This lets the app run from http://127.0.0.1 instead of file://, which avoids white screens,
// broken asset paths and fetch('/api/...') errors.
const http = require('http');
const fs = require('fs');
const path = require('path');

const UA = 'PhoenixLauncher/1.1 (desktop)';
const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

const FALLBACK_VERSIONS = {
  source: 'offline-curated',
  latestRelease: '1.21.4',
  latestSnapshot: '1.21.4',
  versions: [
    ['1.21.4', 'release', '2024-12-03T10:12:57+00:00'],
    ['1.21.1', 'release', '2024-08-08T12:24:45+00:00'],
    ['1.20.4', 'release', '2023-12-07T12:56:20+00:00'],
    ['1.20.1', 'release', '2023-06-12T13:25:51+00:00'],
    ['1.19.4', 'release', '2023-03-14T12:56:18+00:00'],
    ['1.19.2', 'release', '2022-08-05T11:57:05+00:00'],
    ['1.18.2', 'release', '2022-02-28T15:25:46+00:00'],
    ['1.16.5', 'release', '2021-01-15T10:03:45+00:00'],
    ['1.12.2', 'release', '2017-09-18T08:39:46+00:00'],
    ['1.8.9', 'release', '2015-12-03T09:24:39+00:00'],
  ].map(([id, type, releaseTime]) => ({ id, type, releaseTime })),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

let manifestCache = null;

async function remote(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}


// Live player counts for the server list. Uses the public mcstatus.io API.
const STATUS_HOST_RE = /^[a-z0-9.-]{3,80}$/i;
async function serverStatuses(hostsParam) {
  const hosts = String(hostsParam || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => STATUS_HOST_RE.test(h))
    .slice(0, 12);
  const out = {};
  await Promise.all(
    hosts.map(async (host) => {
      try {
        const data = await remote(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}`);
        out[host] = {
          online: Boolean(data.online),
          players: data.players && typeof data.players.online === 'number' ? data.players.online : null,
          max: data.players && typeof data.players.max === 'number' ? data.players.max : null,
        };
      } catch {
        out[host] = { online: false, players: null, max: null };
      }
    })
  );
  return out;
}

function sendJson(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}


// Looks up a Minecraft player's skin through Mojang's public APIs. Returns { name, model, skinPng(base64) }.
async function lookupSkin(nameParam) {
  const name = String(nameParam || '').trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) return { status: 400, body: { ok: false, error: 'Enter a valid Minecraft name (1 to 16 letters, numbers or _).' } };
  try {
    const prof = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`, { headers: { 'User-Agent': UA } });
    if (prof.status === 404 || prof.status === 204) return { status: 404, body: { ok: false, error: `No Minecraft player named ${name} was found.` } };
    if (!prof.ok) throw new Error(`HTTP ${prof.status}`);
    const p = await prof.json();
    const sess = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${p.id}`, { headers: { 'User-Agent': UA } });
    if (!sess.ok) throw new Error(`HTTP ${sess.status}`);
    const sp = await sess.json();
    const prop = (sp.properties || []).find((x) => x.name === 'textures');
    const tex = prop ? JSON.parse(Buffer.from(prop.value, 'base64').toString('utf8')) : null;
    const skin = tex && tex.textures && tex.textures.SKIN;
    if (!skin || !/^https?:\/\/textures\.minecraft\.net\//.test(skin.url)) return { status: 200, body: { ok: false, error: `${p.name} has no custom skin (uses Steve or Alex).` } };
    const img = await fetch(skin.url, { headers: { 'User-Agent': UA } });
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    const buf = Buffer.from(await img.arrayBuffer());
    return { status: 200, body: { ok: true, name: p.name, model: skin.metadata && skin.metadata.model === 'slim' ? 'slim' : 'classic', skinPng: buf.toString('base64') } };
  } catch (e) {
    return { status: 502, body: { ok: false, error: 'Could not reach Mojang right now. Check your internet and try again.' } };
  }
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  const q = url.searchParams;

  if (p === '/api/health') return sendJson(res, 200, { ok: true, desktop: true });

  if (p === '/api/server-status') return sendJson(res, 200, await serverStatuses(q.get('hosts')));

  if (p === '/api/skin') {
    const r = await lookupSkin(q.get('name'));
    return sendJson(res, r.status, r.body);
  }

  if (p === '/api/mojang/versions') {
    try {
      if (!manifestCache || Date.now() - manifestCache.at > 15 * 60 * 1000) {
        const data = await remote(MANIFEST_URL);
        manifestCache = {
          at: Date.now(),
          value: {
            source: 'mojang-live',
            latestRelease: data.latest.release,
            latestSnapshot: data.latest.snapshot,
            versions: data.versions.map((v) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime })),
          },
        };
      }
      return sendJson(res, 200, manifestCache.value);
    } catch {
      return sendJson(res, 200, FALLBACK_VERSIONS);
    }
  }

  if (p === '/api/modrinth/search') {
    const projectType = q.get('projectType') || 'all';
    const version = q.get('version') || '';
    const loader = q.get('loader') || '';
    const category = q.get('category') || '';
    const facets = [];
    if (['modpack', 'mod', 'shader'].includes(projectType)) facets.push([`project_type:${projectType}`]);
    else facets.push(['project_type:modpack', 'project_type:mod', 'project_type:shader']);
    if (version && version !== 'all') facets.push([`versions:${version}`]);
    if (loader && loader !== 'all' && loader !== 'vanilla') facets.push([`categories:${loader}`]);
    if (category && category !== 'all') facets.push([`categories:${category}`]);
    const params = new URLSearchParams({
      query: (q.get('query') || '').trim(),
      facets: JSON.stringify(facets),
      index: q.get('index') || 'downloads',
      limit: String(Math.min(Math.max(Number(q.get('limit') || 18), 1), 30)),
    });
    try {
      const data = await remote(`https://api.modrinth.com/v2/search?${params}`);
      return sendJson(res, 200, { source: 'modrinth-live', hits: data.hits || [], total_hits: data.total_hits || 0 });
    } catch (err) {
      return sendJson(res, 200, { source: 'offline-curated', warning: err.message, hits: [], total_hits: 0 });
    }
  }

  const m = p.match(/^\/api\/modrinth\/project\/([^/]+)\/versions$/);
  if (m) {
    const params = new URLSearchParams();
    const loader = q.get('loader');
    const version = q.get('version');
    if (loader && loader !== 'all' && loader !== 'vanilla') params.set('loaders', JSON.stringify([loader]));
    if (version && version !== 'all') params.set('game_versions', JSON.stringify([version]));
    try {
      const list = await remote(`https://api.modrinth.com/v2/project/${encodeURIComponent(decodeURIComponent(m[1]))}/version?${params}`);
      return sendJson(res, 200, { versions: Array.isArray(list) ? list.slice(0, 8) : [] });
    } catch (err) {
      return sendJson(res, 200, { versions: [], warning: err.message });
    }
  }

  return sendJson(res, 501, {
    error: 'This feature is only available in the web/dev server version (AI diagnose / exe export). The desktop app does not need it.',
  });
}

function serveStatic(req, res, url, distDir) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  let file = path.normalize(path.join(distDir, rel));
  if (file !== distDir && !file.startsWith(distDir + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html'); // SPA fallback
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(500);
      return res.end('Read error');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}

function startLocalServer(distDir, preferredPort = 38417) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res, url).catch((err) => sendJson(res, 500, { error: err.message }));
    } else {
      serveStatic(req, res, url, distDir);
    }
  });
  return new Promise((resolve, reject) => {
    const tryListen = (port, retried) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && !retried) tryListen(0, true); // pick another port
        else reject(err);
      });
      server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    };
    tryListen(preferredPort, false);
  });
}

module.exports = { startLocalServer };
