# test-labos-auth

Minimal standalone app to test LabOS auth from outside AI Apps. No deps.

It reads the `authToken` cookie LabOS sets on `.os.pl.xyz` (or `.dev.os.pl.xyz`),
calls `GET /v1/ai-apps/me` with it as a Bearer token, and shows the result.
Both paths are exercised:

- **Server-side**: `GET /api/me` on this app reads the `Cookie` header and calls `/me`.
- **Browser-side**: `public/app.js` reads `document.cookie` and calls `/me` directly.

## Run

```
npm start                 # prod: api-directory.os.pl.xyz, portal os.pl.xyz
npm run start:dev         # dev:  dev-directory.os.pl.xyz, portal directoryv2.dev.os.pl.xyz
```

| Env var | Default | Purpose |
|---|---|---|
| `LABOS_ENV` | `prod` | `prod` or `dev` |
| `PORT` | `3000` | Listen port |
| `PUBLIC_URL` | `https://<Host header>` | Public URL of this app, used as the login `backlink` |

## Testing

The cookie is only sent to hosts under the LabOS cookie domain, so on `localhost`
you will always get 401 (expected). To test for real, serve this app on a host like
`<something>.os.pl.xyz` or `<something>.dev.os.pl.xyz`, e.g. via a reverse proxy
or tunnel that has a hostname under that domain, then open it:

1. Signed out → status 401, "Sign in with LabOS" button. Clicking it goes to
   `https://os.pl.xyz/members?backlink=<this app url>#login`.
2. After login LabOS redirects back here → status 200, member card.
3. A member without `ai_apps.read`/`ai_apps.write` → 403, access-denied message.

Endpoints on the app:

- `/` UI
- `/api/me` server-side check (JSON, passes through 200/401/403)
- `/api/config` env + login URL
- `/healthz`

The token is only held in memory per request and never logged or printed.
