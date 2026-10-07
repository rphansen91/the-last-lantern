// node tools/plan.js index.html <level#>  — solver plan as JSON steps (used by replay-test.js)
const { load } = require('./solve.js');
const { BS, LEVELS } = load(process.argv[2]);
const L = LEVELS[+process.argv[3] - 1];
const st = BS.build(L);
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
function pack() { const a = []; for (const p of st.pieces) a.push(p.x, p.y, p.li, p.alive ? 1 : 0); return a; }
function unpack(a) { st.shipped = 0; st.by = {}; st.pieces.forEach((p, i) => { p.x = a[i*4]; p.y = a[i*4+1]; p.li = a[i*4+2]; p.alive = !!a[i*4+3]; const n = p.li + (p.alive ? 0 : 1); for (let j = 0; j < n; j++) { st.shipped++; st.by[p.colors[j]] = (st.by[p.colors[j]] || 0) + 1; } }); }
const total = st.pieces.reduce((a, p) => a + p.colors.length, 0);
const seen = new Map(); const start = pack(); seen.set(start.join(), null);
const buckets = []; const push = (s) => { let left = 0; for (let i = 0; i < s.length; i += 4) left += s[i+3] ? st.pieces[i/4].colors.length - s[i+2] : 0; (buckets[left] = buckets[left] || []).push(s); };
push(start); let goal = null, n = 0;
const BFS = process.argv[4] === 'bfs';
let frontier = [start];
outer: while (true) {
  let s;
  if (BFS) { if (!frontier.length) break; s = frontier.shift(); }
  else { let b = -1; for (let i = 0; i < buckets.length; i++) if (buckets[i] && buckets[i].length) { b = i; break; } if (b < 0) break; s = buckets[b].shift(); }
  unpack(s); if (BS.remaining(st) === 0) { goal = s; break; }
  if (++n > 3e6) break;
  const g = BS.grid(st), base = pack();
  for (const p of st.pieces) {
    if (!p.alive || BS.frozen(st, p)) continue;
    const ox = p.x, oy = p.y;
    for (const [x, y] of BS.reach(st, g, p)) {
      const cand = [];
      for (const [dx, dy] of DIRS) if (BS.exitDoor(st, g, p, x, y, dx, dy)) { p.x = x; p.y = y; BS.ship(st, p); cand.push([pack(), JSON.stringify({ i: st.pieces.indexOf(p), x, y, dx, dy })]); unpack(base); break; }
      if (x !== ox || y !== oy) { p.x = x; p.y = y; cand.push([pack(), JSON.stringify({ i: st.pieces.indexOf(p), x, y })]); p.x = ox; p.y = oy; }
      for (const [c, label] of cand) { const k = c.join(); if (!seen.has(k)) { seen.set(k, [s.join(), label]); if (BFS) frontier.push(c); else push(c); } }
    }
  }
}
if (!goal) { console.log('no solution', n); process.exit(1); }
const steps = []; let k = goal.join(); while (seen.get(k)) { const [prev, label] = seen.get(k); steps.unshift(label); k = prev; }
process.stdout.write(JSON.stringify(steps.map(s => JSON.parse(s))));
