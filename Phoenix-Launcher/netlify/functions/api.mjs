// Netlify function: web/phone version ke liye /api/mojang/versions aur /api/modrinth/* (desktop app wali logic jaisi).
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

export default async (req) => {
  const url = new URL(req.url);
  const p = url.pathname;
  const q = url.searchParams;

  if (p === '/api/health') return json({ ok: true, web: true });

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
