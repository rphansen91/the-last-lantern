// Moonroost validator. Usage: node tools/solve.js [index.html]   (from games/moonroost/)
// Loads the exact logic + level blocks shipped in index.html and checks, for every campaign grove:
//   n regions on an n×n board, every region 4-connected, exactly one solution (exhaustive search),
//   and solvable start-to-finish by the in-game hint engine without guessing (so "Listen" never dead-ends).
// Also samples the procedural modes (Tonight's roost for the next 120 nights, Deep wood 0..39) with the same checks.
const fs = require('fs'), path = require('path');
const file = process.argv[2] || path.join(__dirname, '../index.html');
const src = fs.readFileSync(file, 'utf8');
const logic = src.slice(src.indexOf('/*ROOST-LOGIC-START*/'), src.indexOf('/*ROOST-LOGIC-END*/'));
const lv = src.slice(src.indexOf('/*ROOST-LEVELS-START*/'), src.indexOf('/*ROOST-LEVELS-END*/'));
const { RL, LEVELS } = new Function(logic + '\n' + lv + '\nreturn { RL: RL, LEVELS: LEVELS };')();
function check(str) {
  const b = RL.parse(str), n = b.n; if (n * n !== str.length) return 'not square';
  if (b.nreg !== n) return `regions ${b.nreg} != ${n}`;
  for (let g = 0; g < n; g++) { const cells = []; for (let i = 0; i < n * n; i++) if (b.reg[i] === g) cells.push(i);
    const seen = new Set([cells[0]]), q = [cells[0]];
    while (q.length) { const x = q.pop(), r = (x / n) | 0, c = x % n; for (const [y, ok] of [[x - n, r > 0], [x + n, r < n - 1], [x - 1, c > 0], [x + 1, c < n - 1]]) if (ok && !seen.has(y) && b.reg[y] === g) { seen.add(y); q.push(y); } }
    if (seen.size !== cells.length) return `region ${g} disconnected`; }
  const sols = RL.solve(b, 2); if (sols.length !== 1) return `${sols.length} solutions`;
  const gr = RL.grade(b, 10); if (!gr.ok) return 'hint engine stuck';
  return gr;
}
let bad = 0;
LEVELS.forEach((s, i) => { const r = check(s); if (typeof r === 'string') { bad++; console.log(`grove ${i + 1}: FAIL ${r}`); } else console.log(`grove ${String(i + 1).padStart(2)}  ${Math.sqrt(s.length)}x${Math.sqrt(s.length)}  unique  logic-solvable in ${r.steps} steps  difficulty ${r.score}  ${JSON.stringify(r.counts)}`); });
// procedural modes: reproduce the in-game generators
function genBand(n, seed, lo, hi) { for (let s = 0; s < 4000; s++) { const g = RL.generate(n, (seed + s * 977) >>> 0, { maxTech: 6 }); if (g && g.grade.score >= lo && g.grade.score <= hi) return g.str; } return RL.generate(n, seed, { maxTech: 10 }).str; }
function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
let t = Date.now(), pbad = 0, worst = 0;
for (let d = 0; d < 120; d++) { const dt = new Date(Date.UTC(2026, 9, 7 + d, 12)); const key = dt.toISOString().slice(0, 10); const n = [8, 7, 8, 9, 8, 9, 10][new Date(key + 'T12:00:00').getDay()];
  const t0 = Date.now(); const r = check(genBand(n, seedOf('moonroost' + key), 40, 140)); worst = Math.max(worst, Date.now() - t0); if (typeof r === 'string') { pbad++; console.log('night ' + key + ' FAIL ' + r); } }
for (let i = 0; i < 40; i++) { const n = [8, 9, 10][i % 3]; const t0 = Date.now(); const r = check(genBand(n, 0x5eed + i * 104729, 55, 140)); worst = Math.max(worst, Date.now() - t0); if (typeof r === 'string') { pbad++; console.log('deep ' + i + ' FAIL ' + r); } }
console.log(`procedural: 120 nights + 40 deep-wood groves checked, ${pbad} failures, worst generation ${worst} ms, total ${Date.now() - t} ms`);
console.log(bad || pbad ? `FAILED (${bad + pbad})` : `ALL OK: ${LEVELS.length} campaign groves unique + logic-solvable`);
process.exit(bad || pbad ? 1 : 0);
