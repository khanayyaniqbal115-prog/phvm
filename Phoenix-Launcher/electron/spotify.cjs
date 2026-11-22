'use strict';
// Spotify: sign in (PKCE, no client secret), show what is playing and control playback through the Spotify Web API.
// Needs a free Spotify Developer app: its Client ID goes in config.cjs (SPOTIFY_CLIENT_ID) and this Redirect URI must be added to it:
//   http://127.0.0.1:43821/callback
// Playback control (play / pause / next / previous) needs Spotify Premium; showing the current song works on Free.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const config = require('./config.cjs');

const PORT = 43821;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const API = 'https://api.spotify.com/v1';

let storeFile = null;
let safe = null; // electron safeStorage (optional)
let tokens = null; // { access, refresh, expires }
let loginServer = null;

let opener = () => {};

function init(userDataDir, safeStorage, openExternal) {
  if (openExternal) opener = openExternal;
  storeFile = path.join(userDataDir, 'spotify.json');
  safe = safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage : null;
  try {
    const raw = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    const text = raw.enc && safe ? safe.decryptString(Buffer.from(raw.enc, 'base64')) : raw.plain;
    if (text) tokens = JSON.parse(text);
  } catch {
    tokens = null;
  }
}

function save() {
  try {
    if (!tokens) {
      fs.rmSync(storeFile, { force: true });
      return;
    }
    const text = JSON.stringify(tokens);
    fs.mkdirSync(path.dirname(storeFile), { recursive: true });
    fs.writeFileSync(storeFile, JSON.stringify(safe ? { enc: safe.encryptString(text).toString('base64') } : { plain: text }));
  } catch {
    /* best effort */
  }
}

const clientId = () => String(config.SPOTIFY_CLIENT_ID || '').trim();
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function tokenRequest(params) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), ...params }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.error || `Spotify sign-in failed (${res.status})`);
  return j;
}

function status() {
  return { configured: Boolean(clientId()), signedIn: Boolean(tokens && tokens.refresh), redirectUri: REDIRECT };
}

function cancelLogin() {
  if (loginServer) {
    try {
      loginServer.close();
    } catch {
      /* already closed */
    }
    loginServer = null;
  }
}

/** Opens Spotify's sign-in page in the browser and waits for the redirect on 127.0.0.1. */
async function login(openExternal) {
  if (!clientId()) throw new Error('Spotify is not set up yet: add SPOTIFY_CLIENT_ID in electron/config.cjs.');
  cancelLogin();
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(12));

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cancelLogin();
      reject(new Error('Spotify sign-in timed out. Try again.'));
    }, 5 * 60 * 1000);
    const finish = (fn, v) => {
      clearTimeout(timer);
      cancelLogin();
      fn(v);
    };
    loginServer = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const ok = u.searchParams.get('code') && u.searchParams.get('state') === state;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<body style="font-family:sans-serif;background:#0b0e14;color:#fff;text-align:center;padding-top:20vh"><h2>${ok ? 'Spotify connected' : 'Spotify sign-in failed'}</h2><p>You can close this tab and go back to Phoenix Launcher.</p></body>`);
      if (ok) finish(resolve, u.searchParams.get('code'));
      else finish(reject, new Error(u.searchParams.get('error') || 'Spotify sign-in was cancelled.'));
    });
    loginServer.on('error', (e) => finish(reject, new Error(e.code === 'EADDRINUSE' ? `Port ${PORT} is busy. Close the other sign-in window and try again.` : e.message)));
    loginServer.listen(PORT, '127.0.0.1', () => {
      const url =
        'https://accounts.spotify.com/authorize?' +
        new URLSearchParams({ client_id: clientId(), response_type: 'code', redirect_uri: REDIRECT, scope: SCOPE, state, code_challenge_method: 'S256', code_challenge: challenge });
      openExternal(url);
    });
  });

  const j = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier });
  tokens = { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
  save();
}

function logout() {
  cancelLogin();
  tokens = null;
  save();
}

async function accessToken() {
  if (!tokens) throw new Error('Not signed in to Spotify.');
  if (Date.now() < tokens.expires) return tokens.access;
  try {
    const j = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh });
    tokens = { access: j.access_token, refresh: j.refresh_token || tokens.refresh, expires: Date.now() + (j.expires_in - 60) * 1000 };
    save();
    return tokens.access;
  } catch (e) {
    tokens = null; // refresh token was revoked: ask the player to sign in again
    save();
    throw e;
  }
}

async function api(method, route, body) {
  const headers = { Authorization: `Bearer ${await accessToken()}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + route, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  if (res.status === 204 || res.status === 202) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (j.error && j.error.message) || `Spotify error ${res.status}`;
    if (res.status === 403) throw new Error('Spotify Premium is needed to control playback.');
    if (res.status === 404) throw new Error('No active Spotify device. Open Spotify on this PC or phone and play something.');
    throw new Error(msg);
  }
  return j;
}

/** What is playing right now (or { idle: true } when nothing is). */
async function nowPlaying() {
  const p = await api('GET', '/me/player');
  if (!p || !p.item) return { idle: true };
  const it = p.item;
  const img = (it.album && it.album.images && (it.album.images[1] || it.album.images[0])) || (it.images && it.images[0]);
  return {
    idle: false,
    title: it.name,
    artist: (it.artists || []).map((a) => a.name).join(', ') || (it.show && it.show.name) || '',
    album: (it.album && it.album.name) || '',
    image: img ? img.url : '',
    playing: Boolean(p.is_playing),
    progressMs: p.progress_ms || 0,
    durationMs: it.duration_ms || 0,
    device: (p.device && p.device.name) || '',
    volume: p.device && typeof p.device.volume_percent === 'number' ? p.device.volume_percent : null,
    url: (it.external_urls && it.external_urls.spotify) || '',
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Finds a Spotify device to play on (opens the desktop app if none is running) and returns its id. */
async function wakeDevice() {
  let list = ((await api('GET', '/me/player/devices')) || {}).devices || [];
  if (!list.length) {
    opener('spotify:');
    for (let i = 0; i < 10 && !list.length; i++) {
      await sleep(1500);
      list = ((await api('GET', '/me/player/devices')) || {}).devices || [];
    }
  }
  if (!list.length) throw new Error('Spotify is not running. Install / open the Spotify app on this PC (or phone) and try again.');
  const d = list.find((x) => x.is_active) || list.find((x) => x.type === 'Computer') || list[0];
  return d.id;
}

/** No active player: move playback to a device and start it. */
async function wakeAndPlay() {
  const id = await wakeDevice();
  await api('PUT', '/me/player', { device_ids: [id], play: true });
}

/** Songs matching a name (most relevant first). */
async function search(query) {
  const q = String(query || '').trim().slice(0, 100);
  if (!q) return [];
  const j = await api('GET', `/search?type=track&limit=6&q=${encodeURIComponent(q)}`);
  return ((j && j.tracks && j.tracks.items) || []).map((t) => ({
    uri: t.uri,
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    image: (t.album && t.album.images && (t.album.images[2] || t.album.images[0]) && (t.album.images[2] || t.album.images[0]).url) || '',
  }));
}

/** Plays one song right away (starts Spotify first when it is not running). */
async function playUri(uri) {
  if (!/^spotify:track:[A-Za-z0-9]+$/.test(String(uri))) throw new Error('Invalid song.');
  try {
    await api('PUT', '/me/player/play', { uris: [uri] });
  } catch (e) {
    if (!/No active Spotify device/i.test(e.message)) throw e;
    const id = await wakeDevice();
    await sleep(800);
    await api('PUT', `/me/player/play?device_id=${encodeURIComponent(id)}`, { uris: [uri] });
  }
}

async function control(action, value) {
  switch (action) {
    case 'play':
      try {
        await api('PUT', '/me/player/play');
      } catch (e) {
        if (!/No active Spotify device/i.test(e.message)) throw e;
        await wakeAndPlay();
      }
      break;
    case 'pause':
      await api('PUT', '/me/player/pause');
      break;
    case 'next':
      await api('POST', '/me/player/next');
      break;
    case 'previous':
      await api('POST', '/me/player/previous');
      break;
    case 'volume': {
      const v = Math.max(0, Math.min(100, Math.round(Number(value))));
      if (!Number.isFinite(v)) throw new Error('Invalid volume.');
      await api('PUT', `/me/player/volume?volume_percent=${v}`);
      break;
    }
    default:
      throw new Error('Unknown Spotify action.');
  }
}

module.exports = { init, status, login, cancelLogin, logout, nowPlaying, control, search, playUri };
