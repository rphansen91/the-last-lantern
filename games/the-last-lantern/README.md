# The Last Lantern

A small top-down game of eerie dread, built **mobile-first** for portrait play on a phone. No dependencies, no build step.

This folder is the game. The parent repo is **Night Arcade** — the library at the site root. Open with `?from=arcade` to show a **← Library** chip back to the arcade.

```
index.html             the whole game
manifest.webmanifest   PWA (fullscreen, black theme)
sw.js                  offline cache (bump VERSION on ship)
icons/                 procedural lantern icons
tools/                 icon generator
screenshots/           phone + desktop captures
```

Serve this folder (or the arcade root) over http(s). Oil drains as you descend three catacomb depths; solve a light puzzle per depth, collect lore, and keep the flame alive — when it dies, the watchers close in.

**Phone:** floating stick (lower half) to walk; drag upper half to aim gaze; Raise / Lower / Use in the thumb zone. **Desktop:** WASD + mouse aim; Shift/Space raise, Q lower, E use.

Add `?seed=N` to replay a layout. `window.__game` exposes debug hooks.

Full mechanics, puzzles, look references, and adaptive quality notes lived in the original root README; the arcade README now describes the library. Hosting: any static HTTPS host (GitHub Pages already serves the arcade from `main`).
