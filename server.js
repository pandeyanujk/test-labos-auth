// Standalone LabOS auth test app. No dependencies.
//
//   LABOS_ENV=prod|dev   picks API + portal (default: prod)
//   PORT                 listen port (default: 3000)
//   PUBLIC_URL           public https URL of this app, used as the login backlink
//                        (default: https://<Host header>)
//   TLS_CERT, TLS_KEY    paths to a cert/key pair; when both are set the app
//                        serves HTTPS (needed for the LabOS cookie on a local
//                        *.os.pl.xyz hostname, see README)

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENVS = {
  prod: {
    meUrl: 'https://api-directory.os.pl.xyz/v1/ai-apps/me',
    portal: 'https://os.pl.xyz',
    cookieDomain: '.os.pl.xyz',
  },
  dev: {
    meUrl: 'https://dev-directory.os.pl.xyz/v1/ai-apps/me',
    portal: 'https://directoryv2.dev.os.pl.xyz',
    cookieDomain: '.dev.os.pl.xyz',
  },
};

const ENV_NAME = process.env.LABOS_ENV === 'dev' ? 'dev' : 'prod';
const ENV = ENVS[ENV_NAME];
const TLS =
  process.env.TLS_CERT && process.env.TLS_KEY
    ? { cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY) }
    : null;
const PORT = Number(process.env.PORT) || (TLS ? 443 : 3000);

// --- cookie -> token -----------------------------------------------------

function readAuthToken(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)authToken=([^;]*)/);
  if (!match) return null;
  let raw;
  try {
    raw = decodeURIComponent(match[1]);
  } catch {
    raw = match[1];
  }
  raw = raw.replace(/^"|"$/g, '');
  return raw || null;
}

// --- /me lookup ------------------------------------------------------------

async function lookupMember(token) {
  if (!token) return { status: 401, reason: 'no authToken cookie' };
  let res;
  try {
    res = await fetch(ENV.meUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return { status: 0, reason: `fetch failed: ${err.message}` };
  }
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (res.status === 200) return { status: 200, member: body?.member ?? null, body };
  return { status: res.status, reason: `${res.status} ${res.statusText}`, body };
}

// backlink must be an https URL under the LabOS cookie domain, otherwise LabOS
// drops it and the member never comes back here. Always point at the page, not
// at the API path that happened to be called.
function loginUrl(req, returnPath = '/') {
  const base =
    process.env.PUBLIC_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const backlink = new URL(returnPath, base).toString();
  return `${ENV.portal}/members?backlink=${encodeURIComponent(backlink)}#login`;
}

// --- http ------------------------------------------------------------------

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': `${type}; charset=utf-8`,
    'Cache-Control': 'no-store',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}

function serveStatic(res, file, type) {
  fs.readFile(path.join(__dirname, 'public', file), (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, data.toString(), type);
  });
}

async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');

  // Public config for the browser side.
  if (url.pathname === '/api/config') {
    return send(res, 200, {
      env: ENV_NAME,
      meUrl: ENV.meUrl,
      portal: ENV.portal,
      cookieDomain: ENV.cookieDomain,
      loginUrl: loginUrl(req),
    });
  }

  // Server-side check: cookie -> Bearer -> /me. Token stays in memory.
  if (url.pathname === '/api/me') {
    const token = readAuthToken(req.headers.cookie);
    const result = await lookupMember(token);
    const payload = {
      checkedFrom: 'server',
      env: ENV_NAME,
      hasCookie: Boolean(token),
      status: result.status,
      reason: result.reason ?? null,
      member: result.member ?? null,
      loginUrl: result.status === 401 ? loginUrl(req) : null,
    };
    // 403 = signed in but no AI Apps access. Pass status through so the
    // browser can distinguish it from 401.
    return send(res, result.status === 0 ? 502 : result.status, payload);
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    return serveStatic(res, 'index.html', 'text/html');
  }
  if (url.pathname === '/app.js') {
    return serveStatic(res, 'app.js', 'text/javascript');
  }
  if (url.pathname === '/healthz') return send(res, 200, 'ok', 'text/plain');

  send(res, 404, 'not found', 'text/plain');
}

const server = TLS ? https.createServer(TLS, handler) : http.createServer(handler);

server.listen(PORT, () => {
  const scheme = TLS ? 'https' : 'http';
  console.log(`labos-auth test app (${ENV_NAME}) listening on ${scheme}://localhost:${PORT}`);
  console.log(`  /me endpoint: ${ENV.meUrl}`);
  console.log(`  portal:       ${ENV.portal}`);
  console.log(`  cookie domain must be ${ENV.cookieDomain} -> serve this app on a host under it`);
});
