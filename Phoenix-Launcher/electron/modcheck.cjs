'use strict';
// Looks at the mods folder before the game starts and warns about problems that are known to crash or slow the game.
const fs = require('fs');
const path = require('path');
const { norm } = require('./removed.cjs');

// Pairs of mods that do the same job (running both causes crashes or odd behaviour). Names are compared without punctuation.
const CONFLICTS = [
  [['sodium'], ['rubidium', 'embeddium'], 'Sodium and Rubidium/Embeddium are both renderers. Keep only one.'],
  [['optifine', 'optifabric'], ['sodium', 'iris'], 'OptiFine does not work with Sodium/Iris. Keep only one of them.'],
  [['lithium'], ['canary'], 'Lithium and Canary do the same job. Keep only one.'],
  [['ferritecore'], ['memoryleakfix'], null],
  [['starlight'], ['scalablelux'], 'Starlight and ScalableLux are both light engines. Keep only one.'],
  [['modernfix'], ['dynamicfps'], null],
];

function modNames(modsDir) {
  let files = [];
  try {
    files = fs.readdirSync(modsDir).filter((f) => /\.jar$/i.test(f));
  } catch {
    return [];
  }
  return files.map((f) => {
    const base = f.replace(/\.jar$/i, '');
    const m = base.match(/^(.*?)[-_+ ](?:fabric|quilt|forge|neoforge|mc|v)?[-_+ ]?\d/i);
    return { file: f, key: norm(m ? m[1].replace(/[-_+ ](fabric|quilt|forge|neoforge)$/i, '') : base) };
  });
}

/** Returns a list of human readable warnings (empty when everything looks fine). */
function check(gameDir) {
  const mods = modNames(path.join(gameDir, 'mods'));
  const warnings = [];
  const seen = new Map();
  for (const m of mods) {
    if (!m.key) continue;
    if (seen.has(m.key)) warnings.push(`Two copies of the same mod: ${seen.get(m.key)} and ${m.file}. Delete the older one.`);
    else seen.set(m.key, m.file);
  }
  const has = (names) => mods.some((m) => names.some((n) => m.key === n || m.key.startsWith(n)));
  for (const [a, b, msg] of CONFLICTS) {
    if (msg && has(a) && has(b)) warnings.push(msg);
  }
  return warnings;
}

module.exports = { check };
