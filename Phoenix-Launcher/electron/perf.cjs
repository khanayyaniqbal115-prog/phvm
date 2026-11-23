'use strict';
// Builds a plain-text "performance report" the player can paste into a chat or a bug report.
const fs = require('fs');
const os = require('os');
const path = require('path');

function tail(file, lines) {
  try {
    const text = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    return text.slice(-lines).join('\n');
  } catch {
    return '(not found)';
  }
}

function build({ gameDir, instance, launcherVersion }) {
  const mem = (n) => `${Math.round(n / 1048576)} MB`;
  let mods = [];
  try {
    mods = fs.readdirSync(path.join(gameDir, 'mods')).filter((f) => /\.jar(\.disabled)?$/i.test(f));
  } catch {
    /* no mods folder */
  }
  const log = tail(path.join(gameDir, 'logs', 'latest.log'), 40);
  const warnings = (log.match(/^.*(Can't keep up|WARN|ERROR|Exception).*$/gim) || []).slice(-15).join('\n');
  const lines = [
    'Phoenix Launcher performance report',
    `Launcher: ${launcherVersion}`,
    `OS: ${os.type()} ${os.release()} (${os.arch()})`,
    `CPU: ${(os.cpus()[0] || {}).model || '?'} x${os.cpus().length}`,
    `RAM: ${mem(os.totalmem())} total, ${mem(os.freemem())} free`,
    `Profile: ${instance && instance.name || '?'}  (${instance && instance.loader || '?'} ${instance && instance.mcVersion || '?'})`,
    `Allocated RAM: ${instance && instance.ramMb || '?'} MB`,
    `Mods (${mods.length}): ${mods.slice(0, 60).join(', ')}${mods.length > 60 ? ', ...' : ''}`,
    '',
    '--- Warnings / errors from the last game log ---',
    warnings || '(none)',
    '',
    '--- End of latest.log ---',
    log,
  ];
  return lines.join('\n');
}

module.exports = { build };
