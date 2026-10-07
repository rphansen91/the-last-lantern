# Night Arcade

A **mobile-first** library shell for small, dark, offline-friendly games. Zero dependencies, no build step. Root is the arcade; each game lives in its own folder under `games/`.

```
index.html            browse / play library (portrait-first)
catalog.json          corpus registry (arcade meta + game list)
styles.css / app.js   shell UI
manifest.webmanifest  Night Arcade PWA
sw.js                 caches shell + catalog + listed game assets
icons/                procedural dark / grainy / cyan arcade icons
.nojekyll             GitHub Pages: serve as plain static site
games/
  the-last-lantern/   atmospheric horror exploration
  bayshift/           timed crate-escape puzzle (midnight dock)
  moonroost/          one-owl-per-grove logic puzzle (night wood)
screenshots/          arcade UI captures (phone viewport)
tools/arcade-icons.html  re-render arcade icons in headless Chrome
```

Live: [https://rphansen91.github.io/the-last-lantern/](https://rphansen91.github.io/the-last-lantern/)

Serve locally (`python3 -m http.server` in this folder) and open http://localhost:8000. The library loads `catalog.json`, shows game cards, and **Play** navigates to `games/<slug>/?from=arcade` (full page, not an iframe). Games that understand `?from=arcade` show a small **← Library** chip; otherwise use the browser back gesture.

## How to add a game

1. **Create a folder** `games/<slug>/` with at least an `index.html` that plays standalone (relative asset paths, its own icons/manifest/sw if you want a per-game PWA).
2. **Add a cover** image (screenshot or art) somewhere under that folder, e.g. `games/<slug>/screenshots/cover.png`.
3. **Register it** in `catalog.json`:

```json
{
  "id": "my-game",
  "title": "My Game",
  "blurb": "One-line tease for the card.",
  "description": "Longer copy for the detail sheet.",
  "how": "Optional controls / how-it-plays paragraph.",
  "tags": ["atmospheric", "puzzle"],
  "status": "playable",
  "path": "games/my-game/",
  "cover": "games/my-game/screenshots/cover.png",
  "accent": "#6ec8ff"
}
```

`status` is `playable` or `prototype`. The shell always opens `path + "?from=arcade"`.

4. **Optional Library chip** in the game: if `location.search` contains `from=arcade`, show a fixed top-left link to `../../` (see The Last Lantern for a ~20-line example).
5. **Bump** `VERSION` in root `sw.js` and add any new shell/game URLs you want precached to the `SHELL` array. Ship; stale-while-revalidate means the update often appears on the second visit.

Private inspirations for the daily App Store reimagine pipeline live in `inspirations.json` (source title + date + new slug only — never shown in the arcade UI).

Empty / coming-soon slots are intentional when the library is thin — the grid can show a “More games soon” card.

## Tone

Dark background, film grain, cyan accent — kinship with The Last Lantern without cloning its title screen. Cards, a bottom detail sheet, and a single Play affordance keep the UI phone-thumb friendly.

## The Last Lantern

Nested at [`games/the-last-lantern/`](games/the-last-lantern/). Direct play URL: [`games/the-last-lantern/`](https://rphansen91.github.io/the-last-lantern/games/the-last-lantern/). See that folder’s README for mechanics, controls, and hosting notes for the game itself.

## Bayshift

Nested at [`games/bayshift/`](games/bayshift/). Direct play: [`games/bayshift/`](https://rphansen91.github.io/the-last-lantern/games/bayshift/). A timed crate-escape puzzle: drag multi-cell freight crates out through bay doors of their color, but only if they fit through the door, before the ferry whistle blows. 18 bays with frost, rails, shrink-wrap and roller shutters. Every bay is solver-checked (`node games/bayshift/tools/solve.js games/bayshift/index.html`).
