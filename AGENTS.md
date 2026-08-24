# AGENTS.md — THE DAILY GRIND

Vanilla-JS canvas platformer. No framework, no bundler for source; `dist/` is generated output for Cloudflare Pages.

## Layout — single source of truth per concern

| File | Owns |
|---|---|
| `index.html` | All markup **and all CSS** (inline `<style>`, no separate stylesheet) |
| `js/game.js` | Game loop, input, rendering, state machine, dialogue scripts |
| `js/levels.js` | Level data |
| `js/audio.js` | Sound engine |
| `tools/pages-build.sh` | Copies src → `dist/`; run to preview the built output |

Edit source, never `dist/` by hand.

## Verification — done means proven

Run all three before claiming a change works:

1. **Syntax**: `node --check js/game.js` exits 0.
2. **Serve**: `python3 -m http.server 8199` from the repo root (the game needs http:// — file:// breaks script loading).
3. **Visual**: screenshot into `.playwright-mcp/` — that directory is gitignored, so verification artifacts belong there, not the repo root. Delete them when the task closes unless they're evidence for a review.

**Mobile trap**: the browser defaults to `pointer: fine`, leaving every `(pointer: coarse)` media query dormant — touch controls and the rotate-gate render invisible on a desktop session. Emulate a device first: CDP `Emulation.setDeviceMetricsOverride` with `mobile: true` (+ `setTouchEmulationEnabled`), or Playwright device descriptors. Check both orientations when touching responsive surfaces; orientation media queries key off viewport aspect ratio.

## Conventions

- Script tags carry cache-bust query strings (`js/game.js?v=50`). Bump the version of any file you change.
- Commit subjects: `Area: imperative summary` with a short bulleted body explaining the *why* (see `git log`).
- The project has multiple agents working the same tree (pi_messenger mesh). Reserve every file before editing, release after your commit lands, and hand off edit-slots explicitly — one writer per file at a time.
