# TrailGuard AI — working coordination prototype

**Hosting on Render?** Follow [RENDER_DEPLOY.md](RENDER_DEPLOY.md) or use the included `render.yaml` Blueprint. The Render entry point is `render/server.mjs`, built with `build:render`.

A hackathon demonstration with real offline queueing, persistent server storage, route computation, allocation validation, disruption controls, human review and inspectable activity events. All locations, incidents, teams and travel times are simulated. This is not an emergency service.

## Current mode

The deployed app runs the **Rule-based demo planner**. No LLM credential has been configured and no live model calls were tested. This mode is not evidence of autonomous LLM planning. It demonstrates the operational workflow and hard constraints.

`lib/agent.ts` includes a bounded OpenAI Responses tool-calling adapter. When both `OPENAI_API_KEY` (secret) and `OPENAI_MODEL` are configured server-side, it uses live tool calls, validates the proposed allocations and falls back explicitly on failure. It never exposes credentials in the client. Live AI setup was declined during this build; do not assume it is connected.

## Implemented stack

The original Site uses React + Vinext on Cloudflare Workers with D1. The Render target uses a Vite-built React client, Node server and local SQLite, with signed per-visitor demo sessions. Both share the TypeScript planner and IndexedDB queue. Render Free storage is ephemeral; see the deployment guide. This differs from the proposal's planned Python FastAPI + NetworkX stack. No Python server is hosted by this project.

## Walkthrough

1. Open the dashboard; the starter incident is an injured trekker.
2. Generate a plan: Alpha is proposed via River crossing (18 simulated minutes).
3. Approve the plan. No dispatch is sent.
4. Add landslide incident: adds immediate-danger Incident B, blocks e3 and invalidates previous approval. Alpha is allocated to B; Bravo goes via Ridge junction to the trekker (28 simulated minutes).
5. Mark a team unavailable: the highest priority feasible incident receives the remaining team; the other is explicitly unassigned.
6. Toggle Offline mode, create a fictional report and reload. The report stays in IndexedDB. Reconnect: delete the queued copy only after acknowledgement from D1-backed API.
7. Inspect plan history and actual tool results in Activity; export a JSON evidence log.

## Safety and correctness boundaries

- Dijkstra route calculation excludes blocked edges. Edge weights are invented travel times, not predictions.
- Urgency is explicit demonstration logic: danger, then inability to move, then report timestamp. It is not clinical triage.
- Location flags use a 15-minute threshold, a 100m accuracy threshold, source and missing metadata. These are demo rules. No confidence percentages or search radius is generated.
- Hard constraints enforce available compatible teams, valid routes and no double assignment. Overrides are revalidated. Changed conditions and edited plans require fresh approval.
- API mutation uses optimistic version checks, including after asynchronous planning, to reject stale updates. Report IDs provide idempotent retry delivery.
- Server state is isolated by authenticated Site user when present; the anonymous fallback is only for local preview / owner-private operation. Do not make this app public without adding explicit authorization for anonymous API writes.
- Browser-local queued reports and snapshots are specific to the device/origin. Authenticated users should not share devices; sign-out storage management is not included.
- The offline shell needs an initial successful HTTPS visit to install the service worker. In an insecure HTTP preview, only the loaded page's IndexedDB workflow can be tested. Browser storage eviction or clearing data can remove pending reports.
- Offline reports cannot reach the server without a communication path. No background guarantee, satellite, SMS, radio, mesh or dispatch integration.
- Report limit 10; history stores 12 prior plans and log keeps 150 events for this small demo.
- Live LLM adapter is present but unverified without credentials. Optional baseline comparison and uncertainty radius are not implemented.

## Source map

- `app/page.tsx`, `app/globals.css`: responsive mission control UI
- `app/api/mission/route.ts`: D1-backed API, state mutations, human review, concurrency checks
- `lib/engine.ts`: graph, Dijkstra, deterministic allocator and hard constraints
- `lib/agent.ts`: optional model tool loop
- `lib/offline.ts`, `public/offline.html`, `public/sw.js`: offline queue and fallback form
- `db/schema.ts`, `drizzle/`: durable schema migration

## Checks

`node node_modules/typescript/bin/tsc --noEmit`

`node --experimental-strip-types lib/engine.test.mjs`

Build using `node /root/.codex/plugins/cache/openai-curated-remote/sites/1.1.0/scripts/build-site.mjs` in this managed workspace, or the retained `build` script in an ordinary checkout. Local D1 setup follows the generated migration and `dist/server/wrangler.json`.

Verified in browser: generate → approve → landslide → revised review; offline save → reload → reconnect → server acknowledgement. Engine checks cover rerouting, priority allocation, unavailable teams, unreachable incidents, invalid routes, capability mismatch, double assignment and stale fixes. Production HTTPS service-worker offline navigation and live LLM behavior were not browser-tested in the internal HTTP preview.
