// Minimal Discord Rich Presence client (talks to the local Discord app over its IPC pipe, no dependencies).
const net = require('net');
const path = require('path');
const { randomUUID } = require('crypto');
const { DISCORD_CLIENT_ID, DISCORD_LARGE_IMAGE_KEY } = require('./config.cjs');

let socket = null;
let ready = false;
let connecting = false;
let current = null; // last activity we want to show
let retryTimer = null;
let readBuf = Buffer.alloc(0);

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
  s.on('error', () => {
    if (!opened) tryConnect(i + 1);
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
  const activity = current
    ? {
        details: current.details,
        state: current.state,
        timestamps: current.startedAt ? { start: Math.floor(current.startedAt / 1000) } : undefined,
        assets: { large_image: DISCORD_LARGE_IMAGE_KEY, large_text: 'Phoenix Launcher' },
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

module.exports = { setPresence, shutdown, enabled: () => Boolean(DISCORD_CLIENT_ID) };
