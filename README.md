# The Last Lantern

A small top-down game of eerie dread, built **mobile-first** for playing in portrait on a phone (landscape works too, and so do keyboard and mouse on a desktop). It has no dependencies and no build step:

```
index.html             the whole game (still works opened straight from disk)
manifest.webmanifest   PWA manifest (fullscreen, black theme, icons)
sw.js                  service worker: caches the game for offline play
icons/                 procedurally drawn app icons (192, 512, maskable 512, apple-touch 180, favicon 32)
tools/icons.html       the icon drawing code; tools/make-icons.js re-renders the PNGs with headless Chrome
screenshots/           m-title, m-play, m-puzzle, m-landscape (phone) + the older desktop shots
```

Serve the folder over http(s) (`python3 -m http.server`, then open http://localhost:8000) and it becomes an installable PWA that plays offline. If you open `index.html` directly from disk, the game still runs; the manifest and service worker are simply not attached.

You go down through three procedurally generated catacomb depths with a lantern that keeps burning low. Pick up oil flasks to keep the flame going, collect 12 lore fragments, and find the stair down at each depth.

## Mechanics
- **Oil** drains all the time, and faster at each depth. Holding **Raise** (Shift/Space on a keyboard) raises the lantern: the light gets bigger, but oil burns about 2.6× faster. Oil keeps draining while the journal is open.
- **The watchers** are tall, thin black figures with cold cyan eyes that stand just past the edge of the light. Some of them drift to wherever you aren't looking. When light reaches them, they pull back into the dark. As the oil runs low, more of them appear, they come closer, and they test the edge. If the flame goes out, a small ember is left, and they close in slowly over about 25–30 s. Find oil before they reach you.
- **The dimmer the lantern, the more oppressive the world:** the view zooms in, the view cone narrows, the fog thickens, the vignette tightens, the film grain gets heavier, roots sway more, the flicker and guttering get worse, faint shapes drift through the dark, and whispered words float up near the watchers.
- **Audio** is procedural Web Audio: a low beating drone, a dissonant cluster that swells as the oil drops, whispers panned around you, a heartbeat near empty, and cave reverb.
- **Lowering the lantern** (hold **Lower**, or Q) shrinks the light to an ember and burns oil at only 0.3× the normal rate. The catch: the watchers treat it as darkness and close in. Let them reach you and the run ends.
- There is no gore and there are no jump scares. Every threat appears gradually.

## Light puzzles (one per depth; the stair stays sealed until it's solved)
- **Depth I: the cold braziers.** Four stone braziers, each with a rune and a count scratched into the floor beside it (|, ||, |||, ||||). Stand next to one and press **Use** (E) to give it some of your flame (costs a little oil). They must be lit in the order of the counts. Light one out of order and all of them go out at once, you lose some oil, and something whispers close by.
- **Depth II: the mirrors.** A thin grey light falls through a crack in the ceiling onto a broken flagstone and runs along the floor. Two or three standing mirrors (silvered on one side) sit on its path. Tap a mirror, or stand beside it and press **Use** (E), to turn it 90°. Get the light to the glyph on the sealed stair. Light that hits the back of a mirror is blocked.
- **Depth III: the unlit sigils.** Three smooth stones look blank in lantern light. Stand on one and hold **Lower** (Q) to lower the lantern. In the dark, a sigil draws itself in about 4 s while the eyes close in. Raise the light too soon and it slowly fades again. Read all three to open the stair.
- **Solving a puzzle** plays a cold sting: an inhaled swell cut off dead, then high glassy dissonance and a sub-bass thump. Then every eye in the dark closes at once and the drone and whispers stop for about 5 s. The watchers hold still. Then their eyes open again, slowly.
- **Every layout is solvable:** puzzle objects are always placed on the single connected floor region. Braziers only go on fully open tiles, so their collision never blocks a path. The mirror route is found by searching back from the stair for straight floor runs. If no route exists, a zig-zag corridor is carved, which only ever turns wall into floor. The generator checks that the correct mirror setting reaches the seal and that the starting setting doesn't.

## Look
The art direction blends three references into a single style:
- **View cone and line of sight (Darkwood):** your gaze is a cone of about 110°. It follows your walking on a phone, and you aim it with a drag (or the mouse on a desktop). Walls cast hard, ray-cast shadows, and anything outside your line of sight or the cone is pure black. You can only hear what is behind you. A small "near sense" circle lights the ground at your feet. The cone narrows as the oil runs low.
- **Gritty painted ground and oppressive fog (Darkwood):** the flagstones are broken and stained, with brush strokes, grit, cracks and tally marks. Two layers of drifting fog are lit only where your light falls.
- **Silhouettes, monochrome and grain (Limbo):** walls are jagged black rock silhouettes. The player and the watchers are black silhouettes. The whole frame is graded to monochrome film, with grain, gate flicker, scratches, dust and a heavy vignette. Shadows are true black.
- **One cold colour (Inside):** everything else is desaturated grey. A single cold cyan marks only the things that belong to the dark: the watchers' eyes, the brazier flames, the ceiling-light shaft and its beam, the sigils and the stair seal. The light shaft and the lantern glow read as soft volumetric light. Motion stays subtle: figures sway and twitch, roots creep, the fog drifts, and shy watchers slide away from where you look.

## Controls
**Phone (touch)**
- **Walk:** put a thumb down anywhere in the lower half of the screen (the left half when the phone is sideways). A floating stick appears where your thumb lands and follows it if you drag past the rim. Your gaze (the view cone) follows the direction you walk.
- **Look:** drag anywhere in the upper half (the right half when sideways) to aim your gaze freely, even while walking. When you let go, the gaze stays where you aimed while you stand still, and goes back to following your walk about 1.6 s after you move on.
- **Raise**, **Lower** and **Use** are large round buttons in the bottom-right thumb zone. Raise and Lower work while held. **Use** pulses and changes its label (LIGHT, TURN) when something is in reach. **Lower** pulses when you stand on a blank stone at depth III.
- **Tap a mirror** to turn it (it must be within about 4 tiles and in your line of sight). Tapping something right beside you uses it.
- **Journal** and **Pause** are the small icons in the top-right corner. The pause menu also has Sound on/off, Vibration on/off and Give up.
- **Vibration** (where the browser supports it): a heartbeat pulse at low oil or while the lantern is lowered, a short buzz when a seal breaks, and a tick on a wrong brazier.

**Desktop:** move with WASD or the arrow keys and **aim your gaze with the mouse**. If you stop moving the mouse for 3 s while walking, the gaze goes back to facing your walking direction. Hold Shift or Space to raise the lantern, hold Q to lower it, and press E to interact (you can also click a mirror to turn it). J opens the journal, Esc pauses, and M mutes.

The UI switches live: touching the screen brings up the thumb controls, and using the keyboard or mouse hides them again.

## Mobile details
- **Layout:** portrait first, using 100dvh sizing and safe-area insets so nothing sits under a notch, the Dynamic Island or the home indicator. Pinch-zoom, double-tap zoom, page scrolling, pull-to-refresh, text selection and the long-press menu are all blocked (the journal list still scrolls).
- **HUD on phones:** depth, fragments and seal status sit top-left with a horizontal oil vial, clear of the thumbs. Story and puzzle text appears at the top, under the HUD, at 15px. Short control hints appear just above the thumb zone.
- **Audio** unlocks on the first touch, which iOS Safari requires. Audio stops and the game pauses when the tab is hidden or the app goes to the background.
- **Adaptive quality** has four levels. It measures frame time and CPU time every second, drops a level after 2 slow seconds, and climbs back after 6 seconds with headroom. A level that proves too heavy within 30 s of climbing to it becomes the ceiling, with one more try allowed after 2 minutes. The levels scale the lighting buffer resolution (25–50% of screen), the devicePixelRatio cap (1–2), the fog layers (1–2), the film grain, the particles and the ray count (160–420). Phones start at level 2. A phone held at 30 Hz by low-power mode with light CPU load counts as a steady 30 and isn't downgraded. You can force a level with `?q=0` to `?q=3`.

## Hosting it at a public URL (to open it on a real phone)
Any static host works because it's plain files. HTTPS is needed for the service worker and install prompt (localhost is the only http exception).
- **GitHub Pages:** push this folder's contents to a repo (for example to `main`, or to `docs/`), then Settings → Pages → deploy from branch. It will be served at `https://<user>.github.io/<repo>/`. All paths are relative, so a sub-path is fine.
- **Netlify:** drag the folder onto app.netlify.com/drop, or run `netlify deploy --dir . --prod`. Cloudflare Pages and Vercel (`vercel deploy`) work the same way.
- Then open the URL on the phone. **Android Chrome:** menu → Install app. **iOS Safari:** Share → Add to Home Screen. After one online visit it works offline.
- When you ship changes, bump `VERSION` in `sw.js` so phones drop the old cache. Because the cache is stale-while-revalidate, an update shows up on the second launch.

Add `?seed=N` to the URL to replay a specific layout.

`window.__game` exposes state for debugging (`__game.setOil(0.1)`, `__game.perf`).
