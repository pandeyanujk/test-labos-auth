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
| `LABOS_ENV` | `prod` | `prod` or `dev` (or pass `--dev`) |
| `PORT` | `3000` | Listen port |
| `PUBLIC_URL` | `https://<Host header>` | Public URL of this app, used as the login `backlink` |
| `TLS_CERT`, `TLS_KEY` | `certs/cert.pem`, `certs/key.pem` | Cert/key paths. If the files exist the app serves HTTPS (port 443 by default) |

## Testing locally (fake hostname under the cookie domain)

The cookie is only sent to hosts under the LabOS cookie domain, so on `localhost`
you will always get 401. The trick is to give your machine a hostname under that
domain, serve HTTPS on it, and open it in the browser where you are signed in to
LabOS. Nothing leaves your machine except the calls to the LabOS API.

### macOS / Linux

```sh
# 1. Point a *.os.pl.xyz name at your machine (prod cookie domain)
echo "127.0.0.1 labos-test.os.pl.xyz" | sudo tee -a /etc/hosts
#    or, for dev:  echo "127.0.0.1 labos-test.dev.os.pl.xyz" | sudo tee -a /etc/hosts

# 2. Make a locally trusted cert (brew install mkcert / see mkcert README)
mkcert -install
mkdir -p certs
mkcert -cert-file certs/cert.pem -key-file certs/key.pem labos-test.os.pl.xyz labos-test.dev.os.pl.xyz

# 3. Run. The app finds certs/ and serves HTTPS on 443 (sudo for the port).
sudo env "PATH=$PATH" npm start          # prod
sudo env "PATH=$PATH" npm run start:dev  # dev
```

Don't want sudo? `PORT=8443 npm start` and open `https://labos-test.os.pl.xyz:8443/`.

### Windows (cmd)

```bat
:: 1. Hosts entry. Run this from an *Administrator* command prompt:
echo 127.0.0.1 labos-test.os.pl.xyz>> %WINDIR%\System32\drivers\etc\hosts
::    or, for dev:  echo 127.0.0.1 labos-test.dev.os.pl.xyz>> %WINDIR%\System32\drivers\etc\hosts

:: 2. Locally trusted cert (winget is built into Windows 10/11)
winget install FiloSottile.mkcert
::    close and reopen the terminal so mkcert is on PATH, then:
mkcert -install
mkdir certs
mkcert -cert-file certs\cert.pem -key-file certs\key.pem labos-test.os.pl.xyz labos-test.dev.os.pl.xyz

:: 3. Run on a high port (no admin needed for the port on Windows, but 443 is
::    often taken by other software)
set PORT=8443&& npm start            :: prod
set PORT=8443&& npm run start:dev    :: dev
```

Then open **https://labos-test.os.pl.xyz:8443/** (or `:8443` on the dev host).

### What to expect

The login backlink includes the port, so the redirect back still works.

If you already have the LabOS cookie from signing in at `https://os.pl.xyz`, the
page should show your member card straight away. Otherwise click "Sign in with
LabOS", sign in, and you get redirected back.

## Testing on a real host

Serve this app on a host like `<something>.os.pl.xyz` or
`<something>.dev.os.pl.xyz`, then open it:

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
