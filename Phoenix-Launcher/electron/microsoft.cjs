// Microsoft account sign-in (device code flow) -> Xbox Live -> XSTS -> Minecraft services.
const fs = require('fs');
const path = require('path');
const { MICROSOFT_CLIENT_ID } = require('./config.cjs');

const TENANT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const SCOPE = 'XboxLive.signin offline_access';

let storeFile = null;
let safe = null; // electron safeStorage (optional)

function init(userDataDir, safeStorage) {
  storeFile = path.join(userDataDir, 'ms-accounts.json');
  safe = safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage : null;
}

function readStore() {
  try {
    const raw = fs.readFileSync(storeFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeStore(obj) {
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  fs.writeFileSync(storeFile, JSON.stringify(obj));
}

function saveRefresh(uuid, refreshToken) {
  const store = readStore();
  store[uuid] = safe ? { enc: safe.encryptString(refreshToken).toString('base64') } : { plain: refreshToken };
  writeStore(store);
}

function loadRefresh(uuid) {
  const e = readStore()[uuid];
  if (!e) return null;
  if (e.enc && safe) return safe.decryptString(Buffer.from(e.enc, 'base64'));
  return e.plain || null;
}

function removeAccount(uuid) {
  const store = readStore();
  delete store[uuid];
  writeStore(store);
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { data, status: res.status });
  return data;
}

async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

async function minecraftLogin(msAccessToken) {
  const xbl = await postJson('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  });
  let xsts;
  try {
    xsts = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
      Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    });
  } catch (e) {
    if (e.data && e.data.XErr === 2148916233) throw new Error('This Microsoft account has no Xbox profile. Sign in at xbox.com once, then try again.');
    if (e.data && e.data.XErr === 2148916238) throw new Error('This is a child account. Add it to a Microsoft family to continue.');
    throw new Error('Xbox Live sign-in failed.');
  }
  const uhs = xsts.DisplayClaims.xui[0].uhs;
  const mc = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
    identityToken: `XBL3.0 x=${uhs};${xsts.Token}`,
  });
  const profRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${mc.access_token}` },
  });
  if (profRes.status === 404) throw new Error('This Microsoft account does not own Minecraft Java Edition.');
  if (!profRes.ok) throw new Error(`Could not load the Minecraft profile (HTTP ${profRes.status}).`);
  const profile = await profRes.json();
  return { accessToken: mc.access_token, uuid: profile.id, username: profile.name, xuid: uhs };
}

/** Starts the device-code flow. onCode({userCode, verificationUri}) is called so the UI can show it. */
async function login(onCode, isCancelled) {
  if (!MICROSOFT_CLIENT_ID) {
    throw new Error('Microsoft sign-in is not set up yet. Add MICROSOFT_CLIENT_ID in electron/config.cjs (see the comments there).');
  }
  const dc = await postForm(`${TENANT}/devicecode`, { client_id: MICROSOFT_CLIENT_ID, scope: SCOPE });
  if (!dc.ok) throw new Error(dc.data.error_description || 'Could not start Microsoft sign-in.');
  onCode({ userCode: dc.data.user_code, verificationUri: dc.data.verification_uri });

  const deadline = Date.now() + dc.data.expires_in * 1000;
  let interval = (dc.data.interval || 5) * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    if (isCancelled && isCancelled()) throw new Error('Sign-in cancelled.');
    const t = await postForm(`${TENANT}/token`, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: MICROSOFT_CLIENT_ID,
      device_code: dc.data.device_code,
    });
    if (t.ok) {
      const mc = await minecraftLogin(t.data.access_token);
      saveRefresh(mc.uuid, t.data.refresh_token);
      return { uuid: mc.uuid, username: mc.username };
    }
    if (t.data.error === 'authorization_pending') continue;
    if (t.data.error === 'slow_down') {
      interval += 5000;
      continue;
    }
    throw new Error(t.data.error_description || 'Microsoft sign-in failed.');
  }
  throw new Error('The sign-in code expired. Try again.');
}

/** Returns fresh Minecraft credentials for a saved account. */
async function getCredentials(uuid) {
  const refresh = loadRefresh(uuid);
  if (!refresh) throw new Error('This Microsoft account needs to sign in again.');
  const t = await postForm(`${TENANT}/token`, {
    grant_type: 'refresh_token',
    client_id: MICROSOFT_CLIENT_ID,
    refresh_token: refresh,
    scope: SCOPE,
  });
  if (!t.ok) throw new Error('Your Microsoft session expired. Sign in again.');
  if (t.data.refresh_token) saveRefresh(uuid, t.data.refresh_token);
  return minecraftLogin(t.data.access_token);
}

module.exports = { init, login, getCredentials, removeAccount, isConfigured: () => Boolean(MICROSOFT_CLIENT_ID) };
