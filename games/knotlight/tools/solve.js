// Knotlight level verifier. Uses the live rules (../logic.js) and campaign (../levels.js).
// For every board: structural validation, BFS proof that it can be cleared (fewest moves = par),
// every ember survives on the found route, replay of the route, and random-play sampling of
// how often an aimless player fails (dead ends only exist on ember boards; rules are monotone).
// node tools/solve.js [--json]
const KL = require('../logic.js'), LEVELS = require('../levels.js');
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rows = []; let bad = 0;
LEVELS.forEach((def, i) => {
  const L = KL.prep(def), errs = KL.validate(L), S0 = KL.init(L);
  if (S0.alive.some(a => !a)) errs.push('a piece starts free');
  const sol = KL.solve(L, KL.init(L), 2e6);
  let replay = 'n/a';
  if (sol.path) { const S = KL.init(L); let ok = true; for (const m of sol.path) if (!KL.apply(L, S, m)) ok = false; replay = ok && KL.won(L, S) ? 'won' : 'FAILED'; }
  // first-move friendliness: of the pieces a player can grab at the start, how many lead to a still-solvable board?
  const firsts = KL.successors(L, KL.init(L));
  const deadFirst = firsts.filter(s => !KL.solve(L, s.S, 2e5).path).length;
  // random play: pick random productive drags until clear or fail
  const r = rng(1234 + i); let fails = 0, stuck = 0, N = 300, movesSum = 0;
  for (let t = 0; t < N; t++) {
    const S = KL.init(L); let guard = 0;
    while (!KL.won(L, S) && !S.failed && guard++ < 400) {
      const succ = KL.successors(L, S); if (!succ.length) { stuck++; break; }
      const pick = succ[Math.floor(r() * succ.length)]; Object.assign(S, pick.S);
    }
    if (S.failed) fails++; else movesSum += S.moves;
  }
  const embers = def.rings.map((g, k) => g.b ? k : -1).filter(k => k >= 0);
  const ok = !errs.length && sol.path && replay === 'won' && sol.path.length === def.par && stuck === 0;
  if (!ok) bad++;
  rows.push({ level: i + 1, name: def.name, rings: L.R, rods: L.D, clips: L.clips.length, knobs: def.rings.filter(g => g.n != null).length, stops: def.stops.length,
    closed: def.rings.filter(g => !g.w).length, embers: embers.map(k => def.rings[k].b), par: def.par, solverMin: sol.path ? sol.path.length : null, nodes: sol.nodes,
    replay, firstMoves: firsts.length, deadFirstMoves: deadFirst, randomFailRate: +(fails / N).toFixed(3), randomStuck: stuck, randomAvgMoves: +(movesSum / Math.max(1, N - fails)).toFixed(1),
    errors: errs, ok, path: sol.path });
});
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
else {
  console.log('lvl name            R  D  C  stud peg shut ember   par min  nodes  first dead  rndFail rndStuck  ok');
  rows.forEach(r => console.log(String(r.level).padStart(3), r.name.padEnd(15), String(r.rings).padStart(2), String(r.rods).padStart(2), String(r.clips).padStart(2),
    String(r.knobs).padStart(4), String(r.stops).padStart(3), String(r.closed).padStart(4), (r.embers.join('/') || '-').padStart(6), String(r.par).padStart(5), String(r.solverMin).padStart(3),
    String(r.nodes).padStart(6), String(r.firstMoves).padStart(5), String(r.deadFirstMoves).padStart(4), String(r.randomFailRate).padStart(8), String(r.randomStuck).padStart(8), r.ok ? '  ✓' : '  ✗ ' + r.errors.join(';')));
  console.log(bad ? `\n${bad} board(s) FAILED` : `\nAll ${rows.length} boards verified clearable (par = proven fewest moves, embers survive, no stuck states in ${300} random plays each).`);
}
process.exitCode = bad ? 1 : 0;
