// Minimal Discord Rich Presence client (talks to the local Discord app over its IPC pipe, no dependencies).
const net = require('net');
const path = require('path');
const { randomUUID } = require('crypto');
const { DISCORD_CLIENT_ID, DISCORD_LARGE_IMAGE_KEY, WEBSITE_URL } = require('./config.cjs');

let socket = null;
let ready = false;
let connecting = false;
let current = null; // last activity we want to show
let retryTimer = null;
let readBuf = Buffer.alloc(0);
let lastError = '';
let lastActivityOk = false;

function pipePath(i) {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`;
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  return path.join(base, `discord-ipc-${i}`);
}

function frame(op, payload) {
  const data = Buffer.from(JSON.stringify(payload));
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(data.length, 4);
  return Buffer.concat([header, data]);
}

function tryConnect(i = 0) {
  if (i > 9) {
    connecting = false;
    scheduleRetry();
    return;
  }
  const s = net.createConnection(pipePath(i));
  let opened = false;
  s.once('connect', () => {
    opened = true;
    socket = s;
    readBuf = Buffer.alloc(0);
    s.write(frame(0, { v: 1, client_id: DISCORD_CLIENT_ID }));
  });
  s.on('data', (chunk) => {
    readBuf = Buffer.concat([readBuf, chunk]);
    while (readBuf.length >= 8) {
      const len = readBuf.readInt32LE(4);
      if (readBuf.length < 8 + len) break;
      const body = readBuf.subarray(8, 8 + len).toString();
      readBuf = readBuf.subarray(8 + len);
      try {
        const msg = JSON.parse(body);
        if (msg.evt === 'ERROR' || (msg.cmd === 'SET_ACTIVITY' && msg.evt === 'ERROR')) {
          lastError = (msg.data && msg.data.message) || 'Discord rejected the activity';
          lastActivityOk = false;
        } else if (msg.cmd === 'SET_ACTIVITY') {
          lastError = '';
          lastActivityOk = true;
        }
        if (msg.evt === 'READY') {
          ready = true;
          connecting = false;
          send();
        }
      } catch {
        /* ignore */
      }
    }
  });
  s.on('error', (err) => {
    if (!opened) tryConnect(i + 1);
    else lastError = String((err && err.message) || err);
  });
  s.on('close', () => {
    if (!opened) return;
    ready = false;
    socket = null;
    connecting = false;
    scheduleRetry();
  });
}

function scheduleRetry() {
  if (retryTimer || !DISCORD_CLIENT_ID) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, 15000);
}

function connect() {
  if (!DISCORD_CLIENT_ID || connecting || ready) return;
  connecting = true;
  tryConnect(0);
}

function send() {
  if (!ready || !socket) return;
  const assets = {};
  if (current && current.headUrl) {
    assets.large_image = current.headUrl; // the player's real skin head
    assets.large_text = current.username || 'Player';
    if (DISCORD_LARGE_IMAGE_KEY) {
      assets.small_image = DISCORD_LARGE_IMAGE_KEY;
      assets.small_text = 'Purrlix Launcher';
    }
  } else if (DISCORD_LARGE_IMAGE_KEY) {
    assets.large_image = DISCORD_LARGE_IMAGE_KEY;
    assets.large_text = 'Purrlix Launcher';
  }
  const activity = current
    ? {
        details: current.details,
        state: current.state,
        timestamps: current.startedAt ? { start: Math.floor(current.startedAt / 1000) } : undefined,
        assets: Object.keys(assets).length ? assets : undefined,
        buttons: WEBSITE_URL ? [{ label: 'Download Purrlix', url: WEBSITE_URL }] : undefined,
      }
    : null;
  socket.write(
    frame(1, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity },
      nonce: randomUUID(),
    })
  );
}

function setPresence(activity) {
  current = activity;
  if (!DISCORD_CLIENT_ID) return;
  if (ready) send();
  else connect();
}

function shutdown() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  try {
    if (socket) socket.destroy();
  } catch {
    /* ignore */
  }
}

function status() {
  return {
    configured: Boolean(DISCORD_CLIENT_ID),
    connected: ready,
    activityShown: lastActivityOk,
    error: lastError || (DISCORD_CLIENT_ID && !ready ? 'Discord desktop app not found. Open Discord on this PC.' : ''),
  };
}

module.exports = { setPresence, shutdown, status, enabled: () => Boolean(DISCORD_CLIENT_ID) };
