# Bayshift

A mobile-first, timed crate-escape puzzle for Night Arcade. The night ferry leaves at the whistle, so drag every crate off the deck through the bay door of its color before the clock runs dry.

Zero dependencies, with a single `index.html` (canvas, WebAudio synth sound effects, `navigator.vibrate` haptics).

## How it plays
- **Crates** are multi-cell shapes: 1×1, bars, squares, L, T, S and plus. Drag one with your finger and it follows your finger through open lanes, stopping at walls, bollards and other crates.
- **Bay doors** sit on the dock edges. A crate ships only through a door of its own color, and only if every row or column it covers fits inside the door span.
- **Clock**: each bay has a countdown that starts on your first drag. There's no move limit, and undo is unlimited. Stars: 3 for ≥50% time left, 2 for ≥20%, 1 for finishing.
- **Obstacles**:
  - **bollards** and void cells make irregular decks;
  - **frost** crates thaw after N loads ship;
  - **rails** lock a crate to one axis;
  - **shrink-wrap** peels a layer per door and shows the color underneath;
  - **roller shutters** open after N loads of their color ship.
- **Boosters** (once per bay): **Break** freezes the clock for 10s and **Lift** removes one crate. If time runs out, you can take one **Overtime** (+30s, caps you at 1 star).
- Every color has its own stencil glyph on crates and doors for colorblind play.

## Levels
18 handcrafted bays, all in `index.html` between the `BAYSHIFT-LEVELS` markers. Check them with:

```
node tools/solve.js index.html        # all bays
node tools/show.js index.html 14      # print a solution
```

The solver runs the game's own rules code (extracted from the `BAYSHIFT-LOGIC` markers), checks that every bay is solvable, and flags bays that force you to park a crate.

Open with `?from=arcade` for a **← Library** chip back to the arcade root.

```
index.html             the whole game (logic, levels, client)
tools/solve.js         level validator / solver
tools/show.js          solution printer
manifest.webmanifest   PWA
sw.js                  offline cache (bump VERSION on ship)
icons/                 procedural amber dock icons
screenshots/cover.png  catalog cover
```
