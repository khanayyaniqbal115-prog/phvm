// Netlify function for the web/phone version: /api/mojang/versions, /api/modrinth/* and /api/server-status (same logic as the desktop app).
const UA = 'PhoenixLauncher/1.1 (web)';
const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

const FALLBACK = {
  source: 'offline-curated',
  latestRelease: '1.21.4',
  latestSnapshot: '1.21.4',
  versions: [
    ['1.21.4', '2024-12-03T10:12:57+00:00'],
    ['1.21.1', '2024-08-08T12:24:45+00:00'],
    ['1.20.1', '2023-06-12T13:25:51+00:00'],
    ['1.19.2', '2022-08-05T11:57:05+00:00'],
    ['1.16.5', '2021-01-15T10:03:45+00:00'],
    ['1.12.2', '2017-09-18T08:39:46+00:00'],
    ['1.8.9', '2015-12-03T09:24:39+00:00'],
  ].map(([id, releaseTime]) => ({ id, type: 'release', releaseTime })),
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });

async function remote(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
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

export default async (req) => {
  const url = new URL(req.url);
  const p = url.pathname;
  const q = url.searchParams;

  if (p === '/api/health') return json({ ok: true, web: true });

  if (p === '/api/server-status') return json(await serverStatuses(q.get('hosts')));

  if (p === '/api/skin') {
    const r = await lookupSkin(q.get('name'));
    return json(r.body, r.status);
  }

  if (p === '/api/mojang/versions') {
    try {
      const d = await remote(MANIFEST_URL);
      return json({
        source: 'mojang-live',
        latestRelease: d.latest.release,
        latestSnapshot: d.latest.snapshot,
        versions: d.versions.map((v) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime })),
      });
    } catch {
      return json(FALLBACK);
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
      const d = await remote(`https://api.modrinth.com/v2/search?${params}`);
      return json({ source: 'modrinth-live', hits: d.hits || [], total_hits: d.total_hits || 0 });
    } catch (err) {
      return json({ source: 'offline-curated', warning: err.message, hits: [], total_hits: 0 });
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
      return json({ versions: Array.isArray(list) ? list.slice(0, 8) : [] });
    } catch (err) {
      return json({ versions: [], warning: err.message });
    }
  }

  return json({ error: 'This feature is not available in the web version.' }, 501);
};

export const config = { path: '/api/*' };
