# Gloamglass

A mobile-first water-sort puzzle for Night Arcade. Pour luminous night-inks into glass phials until each holds a single hue under the gloaming.

Zero dependencies: one `index.html` (canvas, WebAudio synth, `navigator.vibrate` haptics).

## How it plays
- Phials hold stacked color layers (capacity 4). Tap one to lift it, tap another to pour. Tap the same again to set it down.
- A pour is legal only onto an **empty** phial or one whose **top color matches**, with free space.
- The largest contiguous top run that fits transfers; leftover stays in the source.
- Clear a loft when every phial is empty or completely filled with a single color.
- **Undo** steps back one pour (unlimited). **Shuffle** rearranges phial positions. **Extra phial** adds one empty glass once per loft (free).
- Harder lofts have a pour budget. At zero you can Retry or spend Extra if unused — no paywall.
- You can queue the next tap while a pour animates.
- Count-up timer, best time, and 1–3 stars from efficiency / pours left.

## Content
- **24 handcrafted campaign lofts**, from 2 colors + 1 empty up through 10 colors. Some mid/late lofts are marked **hard** or **super**.
- Progress is localStorage only (unlocked loft, stars, best times, sound/haptics).

## Tools
- `node tools/solve.js` — BFS/A* checks every loft is solvable **without** Extra Phial.
- `node tools/icons.js` — writes PWA icons via headless Chrome.
- `node tools/cover.js` — writes `screenshots/cover.png`.

## Fiction
A quiet alchemist's loft at dusk. Original name, world, art, and audio. Inspired by the water-sort loop of Magic Sort! (credit in root `inspirations.json` only).
