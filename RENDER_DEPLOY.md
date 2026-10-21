# Deploy TrailGuard AI on Render

This repository has a Render-specific Node server. Do not use the original Sites `build` / `start` scripts on Render, and do not choose Streamlit or Static Site.

## Easiest: Blueprint

1. Sign in at https://dashboard.render.com/ and connect GitHub.
2. Choose **New > Blueprint** and select `prarthana-patel/TrailGuard-AI`.
3. Grant Render access to this private repository if it is not listed.
4. Use the root `render.yaml` and review the Free Web Service configuration.
5. Deploy. The Blueprint generates a secret session-signing key and configures the Node version.
6. Open the actual URL Render provides after deployment succeeds.

This does not move the existing ChatGPT Site or its stored data. The Render deployment starts a new simulation.

## Manual: New > Web Service

| Setting | Value |
|---|---|
| Repository | `prarthana-patel/TrailGuard-AI` |
| Branch | `main` |
| Language / Runtime | Node |
| Root directory | Leave blank |
| Build command | `corepack pnpm install --frozen-lockfile && corepack pnpm run build:render` |
| Start command | `node render/server.mjs` |
| Health check path | `/healthz` |
| Instance type | Free for this demonstration |

Environment variables:

- `NODE_VERSION`: `24.19.0`
- `SESSION_SECRET`: generate a random secret in Render, at least 24 characters. Keep it stable across deploys and never commit its value. Blueprint generates this automatically.
- `TRAILGUARD_DB_PATH`: `/tmp/trailguard.sqlite`

Render supplies `PORT`; the server listens on `0.0.0.0`. No main-file selector is needed. The runtime entry file is `render/server.mjs`.

## Storage limits

The Free configuration uses local SQLite on Render's ephemeral filesystem. Server records may be lost when Render restarts, spins down or redeploys the service. Device-queued reports remain in that browser until acknowledged, subject to browser storage limits. Export mission logs for a demonstration you want to keep.

For persistent server storage, choose a paid service and attach a persistent disk, then set `TRAILGUARD_DB_PATH` to a path under that mount, for example `/var/data/trailguard.sqlite`. Only files under the actual mounted disk persist; changing the environment variable alone does not provision a disk. Do not enable a paid service without reviewing Render's price.

Render visitors receive separate signed HttpOnly session cookies. This is anonymous demo isolation, not a farmer/rescuer account system. Do not enter real personal or emergency data. Deleting the cookie starts a different workspace; the current app has no cross-device login on Render.

## Demo sequence

Generate plan > Approve > Add landslide > inspect revised team assignments > approve the revision. Toggle a team's availability to see limited-resource allocation. Toggle offline mode, save a fictional report, reload and reconnect to test the delivery queue.

Live AI is still not configured. The rule-based demo planner remains clearly labelled; the optional live-model adapter requires server-side credentials and has not been tested with a live model.

## Local verification

After installing dependencies:

```sh
pnpm run build:render
node render/integration.test.mjs
```

To launch manually:

```sh
pnpm run start:render
```

Default port is 10000. For local-only tests, a temporary signing secret is generated if none is set. Render refuses to start without the required configured secret.

The original Cloudflare/Sites path remains available. Render builds use Vite for the React client and reuse the same backend handlers via a SQLite adapter; the Workers/D1 integration is not used on Render.
