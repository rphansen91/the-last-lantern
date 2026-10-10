#!/usr/bin/env node
/**
 * Gloamglass solvability + optimality checker.
 *
 * Usage: node tools/solve.js [path/to/index.html] [--walks N] [--json out.json] [--only 1,5,24]
 *
 * Pulls the GLOAM-LOGIC (rules) and GLOAM-LEVELS blocks straight out of the shipped
 * index.html and, for every loft:
 *   - validates the board: phial count/capacity, each color fills exactly one phial,
 *     not already solved
 *   - finds the MINIMUM number of pours with the game's own GG.canPour / GG.pour, with
 *     no Extra phial and no Shuffle, using A* with an admissible heuristic, so the
 *     result is optimal. Heuristic: (#color segments - #colors). One pour can lower
 *     the segment count by at most 1, so the heuristic never overestimates.
 *   - compares that minimum to the loft's pour budget (L.moves), if it has one
 *   - (info) random-play dead ends: N random walks of 1..25 legal pours, then checks
 *     whether the board is still winnable (and still winnable within the remaining
 *     budget)
 * States are canonical (sorted multiset of phials). Shuffle only reorders phials, so
 * it can never change whether a board is winnable.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const file = args[0] && !args[0].startsWith('--') ? args[0] : path.join(__dirname, '../index.html');
const WALKS = +flag('--walks', 200);
const ONLY = flag('--only', null) ? flag('--only').split(',').map(Number) : null;
const JSON_OUT = flag('--json', null);

const src = fs.readFileSync(file, 'utf8');
function block(a, b) { const i = src.indexOf(a), j = src.indexOf(b); if (i < 0 || j < 0) throw new Error('missing ' + a); return src.slice(i, j + b.length); }
const { GG, LEVELS, CAP } = new Function(block('/*GLOAM-LOGIC-START*/', '/*GLOAM-LOGIC-END*/') + '\n' +
  block('/*GLOAM-LEVELS-START*/', '/*GLOAM-LEVELS-END*/') + '\nreturn { GG: GG, LEVELS: LEVELS, CAP: CAP };')();

const key = st => st.map(b => b.join(',')).sort().join('|');
function segments(st) { let s = 0; for (const b of st) for (let i = 0; i < b.length; i++) if (i === 0 || b[i] !== b[i - 1]) s++; return s; }
function colorCount(st) { const s = new Set(); st.forEach(b => b.forEach(c => s.add(c))); return s.size; }
// legal pours that change the canonical state (skips no-ops: complete phial, or a one-colour phial into an empty one)
function moves(st) {
  const out = [];
  for (let i = 0; i < st.length; i++) {
    const s = st[i];
    if (!s.length || GG.isComplete(s)) continue;
    const uniform = GG.topRun(s) === s.length;
    let emptyDone = false;
    for (let j = 0; j < st.length; j++) {
      if (i === j || !GG.canPour(s, st[j])) continue;
      if (!st[j].length) { if (uniform || emptyDone) continue; emptyDone = true; } // all empties equivalent
      out.push([i, j]);
    }
  }
  return out;
}
function apply(st, m) { const nb = GG.clone(st); GG.pour(nb[m[0]], nb[m[1]]); return nb; }

// A* (bucketed). Returns {ok, min, path:[[from,to],...] in ORIGINAL phial indices, nodes, exhausted}
function astar(start, maxNodes) {
  const nc = colorCount(start);
  const h = st => segments(st) - nc;
  const g = new Map(); const parent = new Map();
  const k0 = key(start); g.set(k0, 0); parent.set(k0, null);
  const buckets = []; const push = (f, item) => (buckets[f] || (buckets[f] = [])).push(item);
  push(h(start), [start, 0, k0]);
  let f = 0, nodes = 0;
  while (true) {
    while (f < buckets.length && (!buckets[f] || !buckets[f].length)) f++;
    if (f >= buckets.length) return { ok: false, nodes, exhausted: true };
    const [st, gs, k] = buckets[f].pop();
    if (g.get(k) < gs) continue;
    if (GG.isWon(st)) {
      const pathK = []; let cur = k; while (parent.get(cur)) { pathK.push(parent.get(cur)); cur = parent.get(cur).prev; }
      return { ok: true, min: gs, nodes, endKey: k, chain: pathK.reverse() };
    }
    if (++nodes > maxNodes) return { ok: false, nodes, exhausted: false };
    for (const m of moves(st)) {
      const nb = apply(st, m), nk = key(nb), ng = gs + 1, prev = g.get(nk);
      if (prev !== undefined && prev <= ng) continue;
      g.set(nk, ng); parent.set(nk, { prev: k, state: st, move: m });
      push(ng + h(nb), [nb, ng, nk]);
    }
  }
}
// Replay the chain on the real starting array to get moves in on-screen phial indices.
// Canonical states lose phial positions, so re-find the pour by matching the next canonical state.
function concretePath(start, res) {
  let st = GG.clone(start); const out = [];
  for (const step of res.chain) {
    const target = key(apply(step.state, step.move));
    let found = null;
    for (let i = 0; i < st.length && !found; i++) for (let j = 0; j < st.length && !found; j++)
      if (i !== j && GG.canPour(st[i], st[j]) && key(apply(st, [i, j])) === target) found = [i, j];
    if (!found) throw new Error('path reconstruction failed');
    st = apply(st, found); out.push(found);
  }
  if (!GG.isWon(st)) throw new Error('replayed path does not win');
  return out;
}
// simulate with the game's rules + budget semantics: fail when movesLeft hits 0 and not won
function simulate(start, pathM, budget) {
  const st = GG.clone(start); let left = budget;
  for (const [i, j] of pathM) {
    if (!GG.canPour(st[i], st[j])) return 'illegal pour';
    GG.pour(st[i], st[j]);
    if (GG.isWon(st)) return 'win';
    if (budget > 0) { left--; if (left <= 0) return 'fail (out of pours)'; }
  }
  return 'not won';
}

function validate(L) {
  const errs = []; const cnt = {};
  if (!L.bottles || L.bottles.length < 2) errs.push('too few phials');
  for (const b of L.bottles) { if (b.length > CAP) errs.push('overfull phial'); for (const c of b) { if (!Number.isInteger(c) || c < 1) errs.push('bad color ' + c); cnt[c] = (cnt[c] || 0) + 1; } }
  for (const c in cnt) if (cnt[c] !== CAP) errs.push(`color ${c} has ${cnt[c]} units (need ${CAP})`);
  const colors = Object.keys(cnt).length;
  if (colors > L.bottles.length) errs.push('more colors than phials');
  if (GG.isWon(L.bottles)) errs.push('already solved at start');
  return { errs, colors };
}

// seeded RNG for reproducible random-play sampling
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
function deadEnds(L, walks) {
  let dead = 0, overBudget = 0, unknown = 0, done = 0;
  for (let w = 0; w < walks; w++) {
    let st = GG.clone(L.bottles), n = 1 + Math.floor(rnd() * 25), used = 0;
    for (; used < n; used++) {
      if (GG.isWon(st)) break;
      const ms = []; // every legal non-noop pour, positions included (what a player can tap)
      for (let i = 0; i < st.length; i++) for (let j = 0; j < st.length; j++) if (i !== j && GG.canPour(st[i], st[j]) && !GG.isComplete(st[i])) ms.push([i, j]);
      if (!ms.length) break;
      st = apply(st, ms[Math.floor(rnd() * ms.length)]);
    }
    if (L.moves && used >= L.moves) { overBudget++; continue; }
    const r = astar(st, 400000);
    if (r.ok) { done++; if (L.moves && r.min > L.moves - used) overBudget++; }
    else if (r.exhausted) dead++; else unknown++;
  }
  return { dead, overBudget, unknown, walks };
}

const rows = []; let bad = 0;
LEVELS.forEach((L, idx) => {
  const n = idx + 1; if (ONLY && !ONLY.includes(n)) return;
  const v = validate(L);
  const t0 = Date.now();
  const r = v.errs.length ? { ok: false } : astar(L.bottles, 6e6);
  const row = { loft: n, name: L.name, tier: L.tier || 'normal', phials: L.bottles.length, empties: L.bottles.filter(b => !b.length).length,
    colors: v.colors, budget: L.moves || null, errs: v.errs };
  if (r.ok) {
    row.min = r.min; row.path = concretePath(L.bottles, r);
    row.sim = simulate(L.bottles, row.path, L.moves | 0);
    row.slack = L.moves ? L.moves - r.min : null;
    row.ms = Date.now() - t0; row.nodes = r.nodes;
  } else { row.min = null; row.status = v.errs.length ? 'INVALID' : (r.exhausted ? 'UNWINNABLE' : 'SEARCH LIMIT'); }
  if (!r.ok || v.errs.length || row.sim !== 'win' || (row.slack != null && row.slack < 0)) bad++;
  if (WALKS > 0 && r.ok) row.random = deadEnds(L, WALKS);
  rows.push(row);
  const rd = row.random ? `dead ${(100 * row.random.dead / WALKS).toFixed(0)}%` + (L.moves ? ` overBudget ${(100 * row.random.overBudget / WALKS).toFixed(0)}%` : '') + (row.random.unknown ? ` unk ${row.random.unknown}` : '') : '';
  console.log(`${String(n).padStart(2)} ${L.name.padEnd(17)} ${row.tier.padEnd(6)} ph ${String(row.phials).padStart(2)} col ${String(row.colors).padStart(2)} budget ${String(row.budget ?? '-').padStart(3)} min ${String(row.min ?? '-').padStart(3)} slack ${String(row.slack ?? '-').padStart(3)} sim=${row.sim || row.status} ${row.ms ?? ''}ms nodes ${row.nodes ?? ''} | ${rd} ${v.errs.join('; ')}`);
});
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 1));
console.log(bad ? `${bad} PROBLEM LOFT(S)` : `ALL ${rows.length} LOFTS WINNABLE at optimum (no Extra, no Shuffle), within budget`);
process.exit(bad ? 1 : 0);
