// Bayshift level solver. Usage: node tools/solve.js index.html [levels]  (from games/bayshift/)
// Search model == game model: one drag moves a crate to any reachable cell; a drag may end by shipping it.
const fs = require('fs');
function load(file) {
  const src = fs.readFileSync(file, 'utf8');
  const logic = src.slice(src.indexOf('/*BAYSHIFT-LOGIC-START*/'), src.indexOf('/*BAYSHIFT-LOGIC-END*/'));
  const lv = src.slice(src.indexOf('/*BAYSHIFT-LEVELS-START*/'), src.indexOf('/*BAYSHIFT-LEVELS-END*/'));
  return new Function(logic + '\n' + lv + '\nreturn { BS: BS, LEVELS: LEVELS };')();
}
function pack(st) { const a = []; for (const p of st.pieces) a.push(p.x, p.y, p.li, p.alive ? 1 : 0); return a; }
function unpack(st, a) {
  st.shipped = 0; st.by = {};
  st.pieces.forEach((p, i) => {
    p.x = a[i*4]; p.y = a[i*4+1]; p.li = a[i*4+2]; p.alive = !!a[i*4+3];
    const n = p.li + (p.alive ? 0 : 1);
    for (let j = 0; j < n; j++) { st.shipped++; st.by[p.colors[j]] = (st.by[p.colors[j]] || 0) + 1; }
  });
}
function key(st) { let s = ''; for (const p of st.pieces) s += p.alive ? String.fromCharCode(65 + p.x, 65 + p.y, 48 + p.li) : '~~~'; return s; }
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
function children(BS, st) {
  // returns list of [snapshot, isShip]
  const out = [], g = BS.grid(st), base = pack(st);
  for (const p of st.pieces) {
    if (!p.alive || BS.frozen(st, p)) continue;
    const ox = p.x, oy = p.y;
    for (const [x, y] of BS.reach(st, g, p)) {
      for (const [dx, dy] of DIRS) {
        if (BS.exitDoor(st, g, p, x, y, dx, dy)) {
          p.x = x; p.y = y; BS.ship(st, p);
          out.push([key(st), pack(st), true]);
          unpack(st, base);
          break;
        }
      }
      if (x !== ox || y !== oy) { p.x = x; p.y = y; out.push([key(st), pack(st), false]); p.x = ox; p.y = oy; }
    }
  }
  return out;
}
// Exact BFS (min drags) with a node budget; falls back to best-first for solvability.
function bfs(BS, L, budget) {
  const st = BS.build(L); const seen = new Set([key(st)]);
  let frontier = [pack(st)], depth = 0, n = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      unpack(st, s);
      if (BS.remaining(st) === 0) return { ok: true, moves: depth, exact: true, explored: n };
      if (++n > budget) return null;
      for (const [k, snap] of children(BS, st)) if (!seen.has(k)) { seen.add(k); next.push(snap); }
    }
    frontier = next; depth++;
  }
  return { ok: false, exact: true, explored: n };
}
function bestFirst(BS, L, budget) {
  const st = BS.build(L); const total = st.pieces.reduce((a, p) => a + p.colors.length, 0);
  const seen = new Set([key(st)]);
  // buckets by work left (layers remaining); DFS-ish inside a bucket
  const buckets = []; const push = (s, d) => { let left = 0; for (let i = 0; i < s.length; i += 4) left += s[i+3] ? (st.pieces[i/4].colors.length - s[i+2]) : 0; (buckets[left] = buckets[left] || []).push([s, d]); };
  push(pack(st), 0); let n = 0;
  while (true) {
    let b = -1; for (let i = 0; i < buckets.length; i++) if (buckets[i] && buckets[i].length) { b = i; break; }
    if (b < 0) return { ok: false, exact: true, explored: n };
    const [s, d] = buckets[b].shift();
    unpack(st, s);
    if (BS.remaining(st) === 0) return { ok: true, moves: d, exact: false, explored: n };
    if (++n > budget) return { ok: false, exact: false, reason: 'budget', explored: n };
    for (const [k, snap] of children(BS, st)) if (!seen.has(k)) { seen.add(k); push(snap, d + 1); }
  }
}
function solve(BS, L, opts) {
  opts = opts || {};
  const e = bfs(BS, L, opts.bfsBudget || 4000);
  if (e) return e;
  return bestFirst(BS, L, opts.budget || 400000);
}
function validate(BS, L) {
  const st = BS.build(L); const errs = [];
  const g = new Int16Array(st.w * st.h);
  st.pieces.forEach(p => p.cells.forEach(c => {
    const x = p.x + c[0], y = p.y + c[1];
    if (x < 0 || y < 0 || x >= st.w || y >= st.h) errs.push('crate ' + p.id + ' out of bounds');
    else { const k = y * st.w + x; if (st.solid[k]) errs.push('crate ' + p.id + ' on solid ' + x + ',' + y); if (g[k]) errs.push('crate ' + p.id + ' overlaps ' + g[k]); g[k] = p.id; }
  }));
  st.doors.forEach(d => {
    for (let i = 0; i < d.len; i++) {
      const a = d.at + i; let x, y;
      if (d.side === 'L') { x = 0; y = a; } else if (d.side === 'R') { x = st.w - 1; y = a; } else if (d.side === 'T') { x = a; y = 0; } else { x = a; y = st.h - 1; }
      if (x < 0 || y < 0 || x >= st.w || y >= st.h || st.solid[y * st.w + x]) errs.push('door ' + d.side + d.at + ' not on floor');
    }
  });
  const cols = new Set(); st.pieces.forEach(p => p.colors.forEach(c => cols.add(c)));
  cols.forEach(c => { if (!st.doors.some(d => d.c === c)) errs.push('no door for ' + c); });
  // doors on one side must not overlap
  for (const a of st.doors) for (const b of st.doors) if (a.id < b.id && a.side === b.side && a.at < b.at + b.len && b.at < a.at + a.len) errs.push('doors overlap ' + a.side + a.at + '/' + b.at);
  // static fit: every layer color of every crate needs some door it could physically pass (width + rail)
  st.pieces.forEach(p => p.colors.forEach(col => {
    const ok = st.doors.some(d => {
      if (d.c !== col) return false;
      const horiz = d.side === 'L' || d.side === 'R';
      if (p.rail === 'h' && !horiz) return false;
      if (p.rail === 'v' && horiz) return false;
      return (horiz ? p.bh : p.bw) <= d.len;
    });
    if (!ok) errs.push('crate ' + (p.tag || p.id) + ' (' + col + ') fits no door');
  }));
  return errs;
}
function greedy(BS, L) {
  const st = BS.build(L);
  for (let guard = 0; guard < 200; guard++) {
    if (BS.remaining(st) === 0) return true;
    const g = BS.grid(st); let did = false;
    for (const p of st.pieces) {
      if (!p.alive || BS.frozen(st, p)) continue;
      for (const [x, y] of BS.reach(st, g, p)) {
        for (const [dx, dy] of DIRS) if (BS.exitDoor(st, g, p, x, y, dx, dy)) { p.x = x; p.y = y; BS.ship(st, p); did = true; break; }
        if (did) break;
      }
      if (did) break;
    }
    if (!did) return false;
  }
  return false;
}
module.exports = { load, solve, validate, greedy };
if (require.main === module) {
  const { BS, LEVELS } = load(process.argv[2]);
  const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
  let bad = 0;
  LEVELS.forEach((L, i) => {
    if (only && !only.includes(i + 1)) return;
    const errs = validate(BS, L);
    if (errs.length) { bad++; console.log(String(i + 1).padStart(2), L.name, 'INVALID', errs.join('; ')); return; }
    const t = Date.now(); const r = solve(BS, L); if (!r.ok) bad++;
    const gr = greedy(BS, L);
    console.log(String(i + 1).padStart(2), L.name.padEnd(16), r.ok ? 'SOLVABLE' : 'FAIL    ', 'drags', String(r.moves ?? '-').padStart(2) + (r.exact ? ' (min)' : ' (ub) '),
      'crates', String(BS.build(L).pieces.length).padStart(2), 'parks', r.ok ? r.moves - BS.build(L).pieces.reduce((a,p)=>a+p.colors.length,0) : '-', gr ? 'greedy-ok ' : 'NEEDS-PLAN', 'timer', L.time + 's', 'nodes', r.explored, (Date.now() - t) + 'ms', r.reason || '');
  });
  console.log(bad ? bad + ' BAD' : 'ALL ' + (only ? only.length : LEVELS.length) + ' LEVELS SOLVABLE');
  process.exit(bad ? 1 : 0);
}
