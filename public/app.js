// Browser side of the LabOS auth test.

const $ = (id) => document.getElementById(id);

function readAuthToken() {
  const match = document.cookie.match(/(?:^|;\s*)authToken=([^;]*)/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]).replace(/^"|"$/g, '');
  return raw || null;
}

function setPill(id, cls, text) {
  const el = $(id);
  el.className = `pill ${cls}`;
  el.textContent = text;
}

function pillFor(status) {
  if (status === 200) return ['ok', '200 signed in'];
  if (status === 401) return ['warn', '401 signed out'];
  if (status === 403) return ['err', '403 no AI Apps access'];
  return ['err', `${status || 'network error'}`];
}

function redact(obj) {
  // Never print the token; everything else is fine for a test page.
  return JSON.stringify(obj, null, 2);
}

async function serverCheck() {
  const res = await fetch('/api/me', { cache: 'no-store' });
  const body = await res.json();
  const [cls, text] = pillFor(body.status);
  setPill('server-pill', cls, text);
  $('server-out').textContent = redact(body);
  return body;
}

async function browserCheck(config) {
  const token = readAuthToken();
  const out = { checkedFrom: 'browser', env: config.env, hasCookie: Boolean(token) };
  if (!token) {
    out.status = 401;
    out.reason = 'no authToken cookie visible to document.cookie';
  } else {
    try {
      const res = await fetch(config.meUrl, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit',
      });
      out.status = res.status;
      let body = null;
      try { body = await res.json(); } catch { body = null; }
      if (res.status === 200) out.member = body?.member ?? null;
      else out.reason = `${res.status} ${res.statusText}`;
      if (res.status !== 200) out.body = body;
    } catch (err) {
      out.status = 0;
      out.reason = `fetch failed (CORS or network): ${err.message}`;
    }
  }
  const [cls, text] = pillFor(out.status);
  setPill('browser-pill', cls, text);
  $('browser-out').textContent = redact(out);
  return out;
}

function renderStatus(config, server, browser) {
  const primary = server.status === 200 ? server : browser.status === 200 ? browser : server;
  const status = primary.status;
  const [cls, text] = pillFor(status);
  setPill('status-pill', cls, text);
  const body = $('status-body');
  const actions = $('status-actions');
  actions.innerHTML = '';

  if (status === 200 && primary.member) {
    const m = primary.member;
    const mainTeam = (m.teams || []).find((t) => t.mainTeam) || (m.teams || [])[0];
    const loc = m.location ? [m.location.city, m.location.country].filter(Boolean).join(', ') : '';
    body.className = '';
    body.innerHTML = `
      <div class="member">
        ${m.image ? `<img src="${m.image}" alt="" referrerpolicy="no-referrer" />` : '<div style="width:56px;height:56px;border-radius:50%;background:var(--line)"></div>'}
        <div>
          <div class="name">${escapeHtml(m.name || '(no name)')}</div>
          <div class="muted">${escapeHtml(mainTeam ? `${mainTeam.role || 'Member'} · ${mainTeam.name}` : 'No team')}${loc ? ` · ${escapeHtml(loc)}` : ''}</div>
          <div class="muted" style="font-size:12px">uid ${escapeHtml(m.uid || '')}</div>
        </div>
      </div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Re-check';
    btn.onclick = run;
    actions.appendChild(btn);
    return;
  }

  if (status === 401) {
    body.className = 'muted';
    body.textContent = onLocalhost()
      ? 'No LabOS cookie on localhost (expected). Deploy under the cookie domain to test login.'
      : 'Not signed in to LabOS, or session expired.';
    const a = document.createElement('a');
    a.className = 'btn primary';
    a.href = server.loginUrl || config.loginUrl;
    a.textContent = 'Sign in with LabOS';
    actions.appendChild(a);
    const btn = document.createElement('button');
    btn.textContent = 'Re-check';
    btn.onclick = run;
    actions.appendChild(btn);
    return;
  }

  if (status === 403) {
    body.className = 'muted';
    body.textContent = 'Signed in to LabOS, but this member has no AI Apps access (needs ai_apps.read or ai_apps.write). Not sending you through login again.';
    return;
  }

  body.className = 'muted';
  body.textContent = `Could not reach LabOS: ${primary.reason || 'unknown error'}`;
  const btn = document.createElement('button');
  btn.textContent = 'Retry';
  btn.onclick = run;
  actions.appendChild(btn);
}

function onLocalhost() {
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderEnv(config) {
  const rows = {
    'LabOS env': config.env,
    '/me endpoint': config.meUrl,
    'Portal': config.portal,
    'Cookie domain': config.cookieDomain,
    'This origin': location.origin,
    'Login URL': config.loginUrl,
  };
  $('env').innerHTML = Object.entries(rows)
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join('');
}

async function run() {
  setPill('status-pill', '', 'checking…');
  const config = await (await fetch('/api/config', { cache: 'no-store' })).json();
  renderEnv(config);
  const [server, browser] = await Promise.all([
    serverCheck().catch((e) => ({ status: 0, reason: e.message })),
    browserCheck(config),
  ]);
  renderStatus(config, server, browser);
}

run();
