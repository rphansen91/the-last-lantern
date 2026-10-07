# Bayshift

A mobile-first, timed crate-escape puzzle for Night Arcade. The night ferry leaves at the whistle, so drag every crate off the deck through the bay door of its color before the clock runs dry.

Zero dependencies, with a single `index.html` (canvas, WebAudio synth sound effects, `navigator.vibrate` haptics).

## How it plays
- **Crates** are multi-cell shapes: 1×1, bars, squares, L, T, S and plus. Drag one and it tracks your finger 1:1 along a row or column. It turns a corner only when you clearly move sideways and it's lined up with the grid. **Flick** a crate to send it gliding until it hits something, or out through a matching door.
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

## Feel (input and motion)
All tunables live in `FEEL` at the top of the input section in `index.html`:

| constant | value | what it does |
|---|---|---|
| `LOCK_PX` | 7 px | finger travel before an axis is chosen |
| `SWITCH_MIN` | 0.30 cells | sideways finger offset needed before a turn is considered |
| `SWITCH_RATIO` | 1.6 | recent sideways motion must beat on-axis motion by this much (hysteresis; drops to 1.0 when pushing into a wall) |
| `ALIGN_TOL` / `ALIGN_RATE` | 0.34 cells / 30 s⁻¹ | how close to a grid line a turn may start, and how hard the crate is pulled onto it |
| `MAGNET` | 0.30 | sine detent toward cell lines while dragging (0 = none) |
| `CATCH_RATE` | 55 s⁻¹ | smoothing used only for big jumps (right after a turn); small moves are exact 1:1 |
| `EXIT_PUSH` / `DOOR_PEEK` | 0.30 cells / 0.45 | push past a matching door that triggers shipping, and how far the crate leans into it |
| `FLICK_PXMS` / `FLICK_WIN` / `REST_MS` | 0.45 px/ms / 70 ms / 60 ms | flick threshold, velocity window, and the pause that cancels a flick |
| `GLIDE_GAIN` / `GLIDE_MIN` / `GLIDE_MAX` | 1.1 / 14 / 46 cells/s | flick-to-glide speed mapping |
| `FRICTION` | 20 cells/s² | glide deceleration (the weakest flick still travels about 4.9 cells) |
| `SUCK_ACC` | 150 cells/s² | acceleration once a door grabs the crate |
| `SPRING_W` / `SPRING_Z` | 30 rad/s / 0.6 | settle spring (slight overshoot, clamped so it never enters a neighbor) |
| `TICK_MS` / `BUMP_V` | 55 ms / 1.2 cells/s | haptic tick throttle and the minimum speed that counts as an impact |
| `GRAB` | 0.55 cells | forgiving grab radius around crates |

Collision is swept. The free range along the rail is scanned from the logical grid when an axis locks, and the crate is clamped to it, so no flick can tunnel. Logical state is committed once per drag or flick, on release, which gives one undo step per gesture.

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
tools/plan.js          solver plan as JSON
tools/feel-test.js     headless touch tests: rails, turns, flicks, tunneling, undo, frame time
tools/replay-test.js   replays solver plans through real touch drags (all 18 bays)
manifest.webmanifest   PWA
sw.js                  offline cache (bump VERSION on ship)
icons/                 procedural amber dock icons
screenshots/cover.png  catalog cover
```
