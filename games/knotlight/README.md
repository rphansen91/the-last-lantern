# Knotlight

Twist glowing hoops until their gaps slip every clip, and send each freed ring up into the night as a star.

Play: https://rphansen91.github.io/night-arcade/games/knotlight/

## Rules (logic.js)
- Rings are open C-hoops (or closed loops). Bars are straight rods. Pieces are joined by **clips**: a sleeve welded to its *owner* piece (drawn in the owner's colour) and hooked around its *holder* piece's tube.
- A piece that owns any clip is **pinned**: it can't turn or slide.
- Turning a holder ring slides its tube through its clips. When the ring's **gap** reaches a clip, the clip slips off.
- A ring's **brass stud** can't pass a clip on that ring or an **iron peg**, so some rings only turn one way until other clips are gone.
- A free **bar** slides off along its arrows and unhooks every clip hanging on it.
- A piece with no clips left flies away. Clear the board to win.
- An **ember** on a ring burns down one per move; free the ring before it reaches zero.
- Rotation runs in 15° notches (the drag is continuous and snaps). A "move" is one drag (or slide). Par is the proven fewest moves.

## Files
- `index.html` shell + overlays, `game.js` rendering/input/audio, `logic.js` rules engine (UMD), `levels.js` campaign (generated).
- `tools/gen.js` seeded generator (layouts, dependency order, gaps, studs, pegs, embers), filtered by the solver.
- `tools/solve.js` verifier: validation, BFS proof each board is clearable (par = fewest moves), ember budgets, route replay, random-play stuck/fail sampling.
- `tools/icons.js` (headless Chrome) and `tools/cover.js` (WebKit, needs a local server) render icons and cover.

The rules are monotone (clips are only ever removed, turns are reversible), so a board can never become unwinnable except by letting an ember burn out, which shows an Undo / Restart prompt. A generic "No moves left" prompt also exists as a safety net.
