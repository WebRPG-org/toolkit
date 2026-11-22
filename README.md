# WebRPG Toolkit — Game Shell

A framework-free, progressively enhanced floating toolbar and optional virtual controls for RPG Maker MV/MZ game entry pages.

## Files

- `shell.css` — namespaced styles for the glass capsule, edge docking, responsive menu and virtual controls.
- `shell.js` — classic browser script, initialized once, without an application runtime or bundled dependencies.

The injecting application is [WebRPG-org/index](https://github.com/WebRPG-org/index); HTML is injected at build time into the **actual game entry HTML**, not every HTML file in the game repository. See `scripts/game-shell-html.mjs` in that repository for the canonical DOM structure.

## Published static assets

The immutable v1 URLs are:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/WebRPG-org/toolkit@v1.0.0/shell.css">
<script src="https://cdn.jsdelivr.net/gh/WebRPG-org/toolkit@v1.0.0/shell.js"></script>
```

The script element **must appear after** the `#webrpg-shell` and `#webrpg-touch-controls` markup and **before** the game's startup scripts, so initialization sees the DOM and preserves the entry's existing behavior. Pin to a version tag; do not use `@main` for production.

## Behavior

- Initial WebRPG capsule animates into a compact translucent draggable edge button; the intro is shown once per tab session.
- Native `<details>` opens toward the available side or downward from the initial capsule.
- Homepage, game detail (if the game is unambiguously matched), fullscreen and on mobile rotation and optional virtual controls.
- Virtual controls are **off by default**. The d-pad uses arrow keys; A = Enter, B = Escape, RUN = Shift, L/R = Q/W.
- Fullscreen targets the document root so the fixed overlay remains visible. Rotation relies on browser support and does not transform or reflow the game Canvas.
- Supports pointer capture, multitouch release on blur/visibility changes, reduced motion and a logo fallback.
- CSS selectors are scoped to the two WebRPG roots; no game-level selectors or framework globals.

The virtual controller sends synthetic keyboard events to match RPG Maker's default keyboard mapper. Some third-party plugins may reject untrusted events and require further compatibility work.

## Local testing

```bash
npm ci
npx playwright install chromium
npm test
```

On Windows you may set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a local Chrome/Edge executable to avoid downloading Chromium for local checks.

The repository intentionally contains only game-shell assets, tests and documentation. It does not include the HTML lab UI, game data, or a stand-alone deployment system.
