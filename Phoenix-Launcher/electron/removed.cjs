'use strict';
// Remembers mods the player switched off or deleted, so the launcher does not download them again on the next launch.
const fs = require('fs');
const path = require('path');

const FILE = '.phoenix-removed.json';

// "ferrite-core", "FerriteCore" and "ferritecore-6.0.1-fabric" all compare as "ferritecore".
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Best-effort project name from a jar file name: "entityculling-fabric-1.12.1-mc1.21.4.jar" -> "entityculling".
function slugFromFile(file) {
  const base = String(file || '').replace(/\.jar(\.disabled)?$/i, '');
  const m = base.match(/^(.*?)[-_+ ](?:fabric|quilt|forge|neoforge|mc|v)?[-_+ ]?\d/i);
  return norm(m ? m[1].replace(/[-_+ ](fabric|quilt|forge|neoforge)$/i, '') : base);
}

function load(gameDir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(gameDir, FILE), 'utf8'));
    return { ids: new Set(j.ids || []), slugs: new Set((j.slugs || []).map(norm)) };
  } catch {
    return { ids: new Set(), slugs: new Set() };
  }
}

function save(gameDir, state) {
  try {
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(path.join(gameDir, FILE), JSON.stringify({ ids: [...state.ids], slugs: [...state.slugs] }, null, 2));
  } catch {
    /* best effort */
  }
}

function mark(gameDir, { projectId, file }) {
  const s = load(gameDir);
  if (projectId) s.ids.add(projectId);
  const slug = slugFromFile(file);
  if (slug) s.slugs.add(slug);
  save(gameDir, s);
}

function unmark(gameDir, { projectId, file, slug }) {
  const s = load(gameDir);
  if (projectId) s.ids.delete(projectId);
  const n = norm(slug) || slugFromFile(file);
  if (n) s.slugs.delete(n);
  save(gameDir, s);
}

// ids: Modrinth project ids to test, names: slugs / titles / file names to test.
function isRemoved(state, { ids = [], names = [] }) {
  return ids.some((i) => i && state.ids.has(i)) || names.some((n) => n && state.slugs.has(norm(n)));
}

module.exports = { load, mark, unmark, isRemoved, norm, slugFromFile };
