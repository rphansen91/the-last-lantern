# Moonroost

A mobile-first logic puzzle for Night Arcade. Settle exactly one owl in every moonlit grove. Owls keep to themselves: no two share a row or a column, and none may touch, not even at a corner.

Zero dependencies, with a single `index.html` (canvas, WebAudio synth sound, `navigator.vibrate` haptics).

## How it plays
- The board is an n×n grid split into n colored **groves**. Place n owls: one per row, one per column, one per grove, and never adjacent (all 8 neighbors).
- **Tap** a cell to cross it out, and tap a cross to clear it. **Drag** to cross out (or clear) a run of cells. The stroke snaps to a magnetic row or column rail until your finger clearly leaves the line.
- **Double-tap** to land an owl. A correct owl locks in place. A wrong perch costs a **moon** and the owl flies off, leaving a cross. You get three moons per grove, then one free "One more moon" revive.
- **Auto-cross** (on by default, toggle in pause): once an owl lands, the cells it rules out are dimmed in a ripple outward from it.
- **Listen** (hint) costs one **song** (charge). Everyone starts with 3, max 9; the count shows as a badge on the button. Settling a grove **flawlessly** (no lost moons, no hints) earns +1 the first time per campaign grove, per Deep wood board, and per nightly date, so replays can't farm it. Groves already flawless before this update count as already earned. At 0 the button goes quiet and explains how to earn more. Each press: first it clears any cross covering a needed perch. Otherwise it shows the next logical step on the board and in a one-to-two-line bar between the board and the dock, in plain words that name the rows, columns and groves (by color) involved. For "an owl here would…" steps it draws a ghost owl on the square, shades every square that owl would rule out, and outlines in red the row, column or grove it would leave with no spot (chain steps also show the forced owls, faint). For confinement steps it outlines the groves or lines in gold, the lines they claim in dashed lavender, and previews the crosses. The explanation holds for 3.6 s (or until your next tap, which still counts) and then the crosses land as one undoable step. Row and column chips label the highlighted lines.
- **Undo** steps back one tap or stroke of crosses. Owls are permanent. **Clear** wipes crosses only.
- Each grove tracks your time and best time. Finishing with no lost moons and no hints earns **Silent wings** (flawless).

## Content
- **36 campaign groves**, 5×5 up to 10×10. Sizes jump around like a real campaign, and difficulty is graded by technique.
- **Deep wood**: endless generated 8–10 grid groves, unlocked after grove 36.
- **Tonight's roost**: one daily board seeded by the local date, 7×7 to 10×10 depending on the weekday, with a streak counter.

## Tools
- `node tools/solve.js` checks every campaign grove. Each must have n connected regions and exactly one solution (exhaustive search), and the in-game hint engine must solve it start to finish with no guessing. It also samples 120 nights and 40 deep-wood boards.
- `node tools/listen-test.js [url]` checks the Listen economy with real touches: starter balance, spend, the empty state + toast, +1 once per grove/night/deep board, the cap, and migration of older saves. `SHOTS=dir` saves screenshots.
- `node tools/hint-test.js [url]` checks every Listen explanation. Across all 36 groves, 60 procedural boards and some chain-only boards, every step must name a concrete row, column or grove, carry highlight data that matches the deduction, and stay short. Then, in headless Chrome at 390x844, it reproduces the Grove 8 report and solves several groves with Listen alone, checking that the bar sits between the board and the dock in two lines or fewer, plus the hold-then-commit, tap-to-commit, undo and song cost. `SHOTS=dir` saves one screenshot per technique. `node tools/hint-shot.js [url] [out.png]` screenshots the Grove 8 case.
- `node tools/play-test.js [url] [groves]` runs a headless touch play-through with real CDP touch events. It covers drag-paint, undo, the tap toggle, a wrong double-tap, a full solve, slow-vs-fast taps, fail+revive, a hint-guided solve, the Library chip, daily, and deep wood.
- `node tools/gen.js` regenerates campaign groves from size and difficulty bands. `node tools/icons.js` writes icons, and `node tools/cover.js` writes screenshots and cover.
- `tools/logic.js` is the dev copy of the logic block that gets embedded in `index.html` between `/*ROOST-LOGIC-START*/` and `/*ROOST-LOGIC-END*/`.
