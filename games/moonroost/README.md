# Moonroost

A mobile-first logic puzzle for Night Arcade. Settle exactly one owl in every moonlit grove. Owls keep to themselves: no two share a row or a column, and none may touch, not even at a corner.

Zero dependencies, with a single `index.html` (canvas, WebAudio synth sound, `navigator.vibrate` haptics).

## How it plays
- The board is an n×n grid split into n colored **groves**. Place n owls: one per row, one per column, one per grove, and never adjacent (all 8 neighbors).
- **Tap** a cell to cross it out, and tap a cross to clear it. **Drag** to cross out (or clear) a run of cells. The stroke snaps to a magnetic row or column rail until your finger clearly leaves the line.
- **Double-tap** to land an owl. A correct owl locks in place. A wrong perch costs a **moon** and the owl flies off, leaving a cross. You get three moons per grove, then one free "One more moon" revive.
- **Auto-cross** (on by default, toggle in pause): once an owl lands, the cells it rules out are dimmed in a ripple outward from it.
- **Listen** (hint): first it clears any cross covering a needed perch. Then it explains the next logical deduction (last open perch, grove-confined-to-line, two groves claiming two lines, or "an owl here would leave a grove empty") and applies the crosses.
- **Undo** steps back one tap or stroke of crosses. Owls are permanent. **Clear** wipes crosses only.
- Each grove tracks your time and best time. Finishing with no lost moons and no hints earns **Silent wings** (flawless).

## Content
- **36 campaign groves**, 5×5 up to 10×10. Sizes jump around like a real campaign, and difficulty is graded by technique.
- **Deep wood**: endless generated 8–10 grid groves, unlocked after grove 36.
- **Tonight's roost**: one daily board seeded by the local date, 7×7 to 10×10 depending on the weekday, with a streak counter.

## Tools
- `node tools/solve.js` checks every campaign grove. Each must have n connected regions and exactly one solution (exhaustive search), and the in-game hint engine must solve it start to finish with no guessing. It also samples 120 nights and 40 deep-wood boards.
- `node tools/play-test.js [url] [groves]` runs a headless touch play-through with real CDP touch events. It covers drag-paint, undo, the tap toggle, a wrong double-tap, a full solve, slow-vs-fast taps, fail+revive, a hint-guided solve, the Library chip, daily, and deep wood.
- `node tools/gen.js` regenerates campaign groves from size and difficulty bands. `node tools/icons.js` writes icons, and `node tools/cover.js` writes screenshots and cover.
- `tools/logic.js` is the dev copy of the logic block that gets embedded in `index.html` between `/*ROOST-LOGIC-START*/` and `/*ROOST-LOGIC-END*/`.
