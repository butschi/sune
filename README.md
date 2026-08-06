# SUNE — CFOP Trainer

A self-contained, offline-capable PWA for learning and drilling the CFOP speedcubing
method: full F2L / OLL / PLL case library with per-case status tracking, recognition
drills, a scramble timer with sessions and ao5/ao12, a 3D algorithm player, and a
finger-tricks guide. All data stays in the browser (`localStorage`) — no accounts,
no backend, no external requests at runtime.

Designed in [Claude Design](https://claude.ai/design) (source of truth in `design/`),
implemented as a static app served by nginx in Docker.

## How it works

- `public/index.html` — production shell; embeds the UI template from the design
  (a declarative HTML dialect with `sc-if` / `sc-for` / `{{binding}}`).
- `public/dc.js` — small runtime (~250 lines) that compiles that template to React
  elements and re-renders it against `Component.renderVals()`. This replaces the
  Claude Design preview runtime, which pulled React and Babel from a CDN.
- `public/logic.js` — the app component, verbatim from the design.
- `public/cube.js` — facelet cube engine: move parser, scrambler, SVG renderers
  (top / isometric / net views), trigger detection, 3D move planning.
- `public/algs.js`, `public/f2l.js` — algorithm and case data.
- `public/vendor/` — React 18.3.1 UMD, self-hosted.
- `public/fonts/` — Outfit + IBM Plex Mono woff2 (latin subsets, OFL), self-hosted.
- `public/sw.js` — service worker: precaches everything, network-first with cache
  fallback, so the app is fully offline-capable and updates land immediately.

## Local development

No build step. Serve `public/` with any static server:

```sh
python3 -m http.server 8480 -d public
```

Or run the production container:

```sh
docker compose up --build   # http://localhost:8480
```

## Deployment (37signals ONCE)

The container serves HTTP on port 80 and exposes an unauthenticated health check at
`GET /up` (returns `200 OK`), as required by ONCE / kamal-proxy. ONCE pulls the
image from GHCR — it does not build from source.

`.github/workflows/build.yml` builds a multi-arch image (amd64 + arm64) on every
push to `main` and pushes:

- `ghcr.io/<owner>/<repo>:production`
- `ghcr.io/<owner>/<repo>:<sha>`

Point the ONCE app at the `:production` tag; TLS is handled by ONCE via
Let's Encrypt.

## Updating from the design

The Claude Design project is the design source of truth. To re-import after design
changes: pull the changed files (`CFOP Trainer.dc.html`, `cube.js`, `algs.js`,
`f2l.js`) from the design project, then:

- `cube.js` / `algs.js` / `f2l.js` → copy verbatim into `public/`
- template (inside `<x-dc>`, minus `<helmet>`) → the
  `<script type="text/x-template" id="dc-template">` block in `public/index.html`
- logic (inside `<script data-dc-script>`) → `public/logic.js`
- helmet `<style>` block → the `<style>` block in `public/index.html`

`design/CFOP Trainer.dc.html` keeps the last imported design for diffing.
