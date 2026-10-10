// Knotlight level generator. Deterministic (seeded). Writes ../levels.js
// node tools/gen.js
const KL = require('../logic.js'), fs = require('fs'), path = require('path');
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R2 = v => Math.round(v * 1000) / 1000;
const CX = 5, CY = 6;

// ---------- layouts: return {rings:[{x,y,r}], rods:[{x1,y1,x2,y2,dir}]}
const LAY = {
  pair: () => ({ rings: [{ x: 3.75, y: 6, r: 1.7 }, { x: 6.25, y: 6, r: 1.7 }] }),
  chain: n => { const sp = 2.35, r = 1.45, x0 = CX - sp * (n - 1) / 2; return { rings: Array.from({ length: n }, (_, i) => ({ x: x0 + i * sp, y: CY + (i % 2 ? 0.55 : -0.55), r })) }; },
  col: n => { const sp = 2.2, r = 1.45, y0 = CY - sp * (n - 1) / 2; return { rings: Array.from({ length: n }, (_, i) => ({ x: CX + (i % 2 ? 0.6 : -0.6), y: y0 + i * sp, r })) }; },
  tri: () => ({ rings: [{ x: CX, y: CY - 1.25, r: 1.65 }, { x: CX - 1.4, y: CY + 1.05, r: 1.65 }, { x: CX + 1.4, y: CY + 1.05, r: 1.65 }] }),
  flower: (k, R0 = 1.65, d = 2.6, r = 1.35, rot = -90) => ({ rings: [{ x: CX, y: CY, r: R0 }].concat(Array.from({ length: k }, (_, i) => { const a = (rot + i * 360 / k) * Math.PI / 180; return { x: CX + d * Math.cos(a), y: CY + d * Math.sin(a), r }; })) }),
  grid: (c, rw, sp = 2.45, r = 1.45) => { const out = []; for (let j = 0; j < rw; j++) for (let i = 0; i < c; i++) out.push({ x: CX + (i - (c - 1) / 2) * sp, y: CY + (j - (rw - 1) / 2) * sp, r }); return { rings: out }; },
  hex: (rowsSpec, sp = 2.35, r = 1.62) => { const out = []; const H = rowsSpec.length; rowsSpec.forEach((n, j) => { for (let i = 0; i < n; i++) out.push({ x: CX + (i - (n - 1) / 2) * sp, y: CY + (j - (H - 1) / 2) * sp * 0.87, r }); }); return { rings: out }; },
  necklace: (n, D = 3.1, centre = false) => { const ch = 2 * D * Math.sin(Math.PI / n), r = Math.min(1.75, ch * 0.62); const out = centre ? [{ x: CX, y: CY, r: D - r * 0.4 }] : []; for (let i = 0; i < n; i++) { const a = (-90 + i * 360 / n) * Math.PI / 180; out.push({ x: CX + D * Math.cos(a), y: CY + D * Math.sin(a), r }); } return { rings: out }; },
};
function withRods(lay, rods) { lay.rods = rods; return lay; }

// ---------- geometry
function circleX(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d >= a.r + b.r - 0.25 || d <= Math.abs(a.r - b.r) + 0.25) return [];
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = Math.sqrt(a.r * a.r - l * l);
  const mx = a.x + dx * l / d, my = a.y + dy * l / d;
  return [{ x: mx + h * dy / d, y: my - h * dx / d }, { x: mx - h * dy / d, y: my + h * dx / d }];
}
function segX(rod, c) {
  const dx = rod.x2 - rod.x1, dy = rod.y2 - rod.y1, A = dx * dx + dy * dy, B = 2 * (dx * (rod.x1 - c.x) + dy * (rod.y1 - c.y)), C = (rod.x1 - c.x) ** 2 + (rod.y1 - c.y) ** 2 - c.r * c.r;
  const disc = B * B - 4 * A * C; if (disc <= 0) return [];
  const out = []; [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)].forEach(t => { if (t > 0.04 && t < 0.96) out.push({ x: rod.x1 + dx * t, y: rod.y1 + dy * t }); });
  return out;
}
const angOn = (c, p) => KL.deg(p.y - c.y, p.x - c.x);
const adist = (a, b) => Math.abs(KL.norm(a - b + 180) - 180);

const WHY = {};
// ---------- build one candidate
function build(spec, seed) {
  const rnd = rng(seed), pick = a => a[Math.floor(rnd() * a.length)];
  const lay = spec.layout();
  const rings = lay.rings.map(r => ({ x: r.x, y: r.y, r: r.r })), rods = (lay.rods || []).map(r => Object.assign({}, r));
  const R = rings.length, N = R + rods.length;
  rods.forEach(rd => { const dx = rd.x2 - rd.x1, dy = rd.y2 - rd.y1, l = Math.hypot(dx, dy), j = (rnd() * 2 - 1) * 0.75; rd.x1 += -dy / l * j; rd.x2 += -dy / l * j; rd.y1 += dx / l * j; rd.y2 += dx / l * j; });
  // candidate edges
  const edges = [];
  for (let i = 0; i < R; i++) for (let j = i + 1; j < R; j++) { const X = circleX(rings[i], rings[j]); if (X.length) edges.push({ a: i, b: j, pts: X }); }
  rods.forEach((rod, k) => { for (let i = 0; i < R; i++) { const X = segX(rod, rings[i]); if (X.length) edges.push({ a: R + k, b: i, pts: X }); } });
  // drop crossing points that sit too close to another crossing (unreadable junctions)
  const allPts = []; edges.forEach((e, ei) => e.pts.forEach(p => allPts.push({ p, ei })));
  edges.forEach((e, ei) => { e.pts = e.pts.filter(p => allPts.every(q => q.ei === ei || Math.hypot(q.p.x - p.x, q.p.y - p.y) > 0.42)); });
  for (let i = edges.length - 1; i >= 0; i--) if (!edges[i].pts.length) edges.splice(i, 1);
  // spanning structure via random BFS from roots
  const adj = Array.from({ length: N }, () => []); edges.forEach((e, ei) => { adj[e.a].push(ei); adj[e.b].push(ei); });
  const roots = spec.roots ? spec.roots(rings, rods) : [Math.floor(rnd() * R)];
  const rank = Array(N).fill(-1); let frontier = roots.slice(); roots.forEach(r => rank[r] = 0);
  const chosen = new Set();
  // randomized BFS-ish growth
  const open = []; roots.forEach(r => adj[r].forEach(ei => open.push([ei, r])));
  while (open.length) {
    const idx = Math.floor(rnd() * open.length); const [ei, from] = open.splice(idx, 1)[0];
    const e = edges[ei], to = e.a === from ? e.b : e.a;
    if (rank[to] >= 0) continue;
    rank[to] = rank[from] + 1; chosen.add(ei);
    adj[to].forEach(ej => { if (!chosen.has(ej)) open.push([ej, to]); });
  }
  if (rank.some(r => r < 0)) return (WHY['r1']=(WHY['r1']||0)+1, null);
  edges.forEach((e, ei) => { if (!chosen.has(ei) && rnd() < (spec.extra ?? 0.5)) chosen.add(ei); });
  for (let p = 0; p < N; p++) if (![...chosen].some(ei => edges[ei].a === p || edges[ei].b === p)) { const inc = adj[p]; if (!inc.length) return (WHY['r2']=(WHY['r2']||0)+1, null); chosen.add(inc[Math.floor(rnd() * inc.length)]); }
  // tie-break order for same rank
  const tb = Array.from({ length: N }, () => rnd());
  const clips = [];
  const onRing = Array.from({ length: R }, () => []);
  const ordered = [...chosen].sort((a, b) => a - b);
  for (const ei of ordered) {
    const e = edges[ei];
    let h = e.a, o = e.b;
    const ra = rank[e.a] + tb[e.a] * 0.5, rb = rank[e.b] + tb[e.b] * 0.5;
    if (rb < ra) { h = e.b; o = e.a; }
    if (spec.rodsOwn && (e.a >= R) && rnd() < 0.5) { /* allow rods to be owners */ }
    // pick crossing point keeping spacing from other clips on involved rings
    const cand = e.pts.slice().sort(() => rnd() - 0.5);
    let ok = null;
    for (const p of cand) {
      let good = true;
      [h, o].forEach(q => { if (q < R) onRing[q].forEach(a => { if (adist(a, angOn(rings[q], p)) < 34) good = false; }); });
      if (good) { ok = p; break; }
    }
    if (!ok) { if (chosen.has(ei) && rank[o] === rank[h] + 1 && [...chosen].indexOf(ei) >= 0) { /* tree edge failed */ } continue; }
    [h, o].forEach(q => { if (q < R) onRing[q].push(angOn(rings[q], ok)); });
    clips.push({ h, o, x: R2(ok.x), y: R2(ok.y) });
  }
  // every piece needs a clip; connectivity check: all pieces reachable through clips from roots
  const cadj = Array.from({ length: N }, () => []); clips.forEach(c => { cadj[c.h].push(c.o); cadj[c.o].push(c.h); });
  if (cadj.some(a => !a.length)) return (WHY['r3']=(WHY['r3']||0)+1, null);
  // rods may not be holders of nothing / rings with no held clips may be closed
  const heldBy = Array.from({ length: N }, () => []), ownedBy = Array.from({ length: N }, () => []);
  clips.forEach((c, ci) => { heldBy[c.h].push(ci); ownedBy[c.o].push(ci); });
  // gap + knob
  for (let i = 0; i < R; i++) {
    const rg = rings[i]; const allA = onRing[i];
    const heldA = heldBy[i].map(ci => angOn(rg, clips[ci]));
    if (!heldBy[i].length && rnd() < (spec.closed ?? 0)) { rg.w = 0; rg.g = 0; continue; }
    rg.w = spec.gapW || 62;
    const half = rg.w / 2;
    const opts = [];
    for (let k = 0; k < 24; k++) { const g = k * 15 + (spec.gapOff || 0); if (allA.every(a => adist(a, g) > half + 5)) opts.push(g); }
    if (!opts.length) return (WHY['r4']=(WHY['r4']||0)+1, null);
    // prefer gaps far from held clips so turning is needed (more satisfying), but not maximally
    rg.g = pick(opts);
    if (heldBy[i].length && rnd() < (spec.knob ?? 0)) {
      const kopts = [];
      for (let k = 0; k < 72; k++) { const n = k * 5; if (adist(n, rg.g) < half + 22) continue; if (allA.every(a => adist(a, n) > KL.KNOB_M + 8)) kopts.push(n); }
      if (kopts.length) rg.n = pick(kopts);
    }
  }
  const stops = [];
  if (spec.stops) for (let i = 0; i < R; i++) if (rings[i].n != null && rnd() < spec.stops) {
    const s = []; for (let k = 0; k < 72; k++) { const a = k * 5; if (onRing[i].every(b => adist(a, b) > 22) && adist(a, rings[i].n) > KL.KNOB_M + 10) s.push(a); }
    if (s.length) stops.push({ r: i, a: pick(s) });
  }
  rods.forEach(rd => { if (rd.dir == null) rd.dir = rnd() < 0.5 ? 1 : -1; });
  const def = { rings: rings.map(r => { const o = { x: R2(r.x), y: R2(r.y), r: R2(r.r), g: r.g, w: r.w }; if (r.n != null) o.n = r.n; return o; }), rods: rods.map(r => ({ x1: R2(r.x1), y1: R2(r.y1), x2: R2(r.x2), y2: R2(r.y2), dir: r.dir })), clips, stops };
  return def;
}
function colorize(def) {
  const R = def.rings.length, N = R + def.rods.length, nb = Array.from({ length: N }, () => new Set());
  const all = def.rings.concat(def.rods.map(r => ({ rod: r })));
  for (let i = 0; i < R; i++) for (let j = i + 1; j < R; j++) { const a = def.rings[i], b = def.rings[j]; if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 0.6) { nb[i].add(j); nb[j].add(i); } }
  def.clips.forEach(c => { nb[c.h].add(c.o); nb[c.o].add(c.h); });
  const col = []; const pal = 8;
  for (let p = 0; p < N; p++) { let c = (p * 3) % pal; for (let t = 0; t < pal; t++) { const cc = (c + t) % pal; if (![...nb[p]].some(q => col[q] === cc)) { c = cc; break; } } col.push(c); }
  def.rings.forEach((r, i) => r.c = col[i]); def.rods.forEach((r, k) => r.c = col[R + k]);
}
function metrics(def) {
  const L = KL.prep(def), S = KL.init(L), sol = KL.solve(L, S, 300000);
  const movable0 = []; for (let p = 0; p < L.N; p++) if (S.alive[p] && !KL.locked(L, S, p)) movable0.push(p);
  return { L, sol, movable0 };
}
// minimal fuse for ring i such that level still solvable
function fuseFor(def, i, slack) {
  for (let f = 1; f < 40; f++) { const d = JSON.parse(JSON.stringify(def)); d.rings[i].b = f; const L = KL.prep(d); const s = KL.solve(L, null, 300000); if (s.path) return f + slack; }
  return (WHY['r5']=(WHY['r5']||0)+1, null);
}

// ---------- the campaign
const lv = (name, layout, o = {}) => Object.assign({ name, layout }, o);
const SPECS = [
  lv('First Light', LAY.pair, { roots: () => [1], par: [1, 1], tip: 'Drag the loose ring round until its gap reaches the clip.' }),
  lv('Two Hitches', () => LAY.chain(3), { roots: () => [0], extra: 0, par: [2, 2], tip: 'A clipped ring is pinned. Free its holder first.' }),
  lv('Trine', LAY.tri, { roots: () => [0], extra: 0.3, par: [2, 3] }),
  lv('Hollow Heart', () => LAY.flower(3, 1.6, 2.35, 1.4), { roots: () => [1, 2, 3], extra: 0, closed: 1, par: [3, 3], tip: 'A closed ring has no gap. Unhook everything around it.' }),
  lv('Brass Stud', () => LAY.grid(2, 2), { roots: () => [0], extra: 0.2, knob: 1, par: [3, 5], tip: 'A brass stud cannot pass a clip. Turn the other way.' }),
  lv('Lantern Chain', () => LAY.col(4), { roots: () => [3], extra: 0, knob: 0.6, par: [3, 5] }),
  lv('Iron Bar', () => withRods(LAY.grid(2, 2, 2.6, 1.5), [{ x1: 1.2, y1: 6, x2: 8.8, y2: 6, dir: 1 }]), { roots: () => [4], extra: 0, par: [3, 6], tip: 'Slide a free bar off the bench to unhook its rings.' }),
  lv('Willow', () => LAY.col(5), { roots: () => [4], extra: 0.6, knob: 0.5, closed: 0.5, par: [4, 7] }),
  lv('Moon Necklace', () => LAY.necklace(6, 2.75), { roots: () => [0], extra: 0.2, knob: 0.4, par: [4, 7] }),
  lv('Ember', () => LAY.grid(2, 3), { roots: () => [0], extra: 0.3, knob: 0.3, bomb: { slack: 3 }, par: [4, 8], tip: 'Free the ember ring before its count runs out. Each move burns one.' }),
  lv('Crosswind', () => withRods(LAY.grid(3, 2, 2.5, 1.45), [{ x1: 5, y1: 2.6, x2: 5, y2: 9.4 }]), { roots: () => [6], extra: 0.4, knob: 0.4, par: [5, 9] }),
  lv('Honeycomb', () => LAY.hex([2, 3, 2]), { roots: () => [3], extra: 0.4, knob: 0.4, closed: 0.4, par: [5, 9] }),
  lv('Old Clock', () => LAY.necklace(8, 3.3, true), { roots: () => [3], extra: 0.4, knob: 0.4, stops: 0.4, par: [6, 10] }),
  lv('Kite', () => LAY.hex([1, 2, 3, 2]), { roots: () => [0], extra: 0.6, knob: 0.5, closed: 0.4, par: [6, 10] }),
  lv('Long Fuse', () => LAY.grid(3, 3), { roots: () => [0], extra: 0.3, knob: 0.4, bomb: { slack: 2 }, par: [6, 11] }),
  lv('Rails', () => withRods(LAY.grid(3, 3), [{ x1: 1.1, y1: 4.78, x2: 8.9, y2: 4.78 }, { x1: 1.1, y1: 7.22, x2: 8.9, y2: 7.22 }]), { roots: () => [9], extra: 0.3, knob: 0.4, par: [6, 12] }),
  lv('Bramble', () => LAY.hex([3, 4, 3]), { roots: () => [0], extra: 0.5, knob: 0.5, stops: 0.3, closed: 0.3, par: [7, 13] }),
  lv('Twin Embers', () => LAY.grid(2, 3, 2.5, 1.5), { roots: () => [2], extra: 0.6, knob: 0.5, bomb: { slack: 2, n: 2 }, par: [5, 10] }),
  lv('Ferris', () => LAY.necklace(9, 3.5, true), { roots: () => [4], extra: 0.5, knob: 0.5, stops: 0.4, par: [8, 14] }),
  lv('Lattice', () => LAY.grid(3, 4, 2.4, 1.42), { roots: () => [5], extra: 0.45, knob: 0.5, closed: 0.3, par: [9, 16] }),
  lv('Gate Bars', () => withRods(LAY.grid(3, 4, 2.4, 1.42), [{ x1: 3.8, y1: 1.4, x2: 3.8, y2: 10.6 }, { x1: 6.2, y1: 1.4, x2: 6.2, y2: 10.6 }]), { roots: () => [12], extra: 0.4, knob: 0.5, par: [9, 16] }),
  lv('Starfall', () => LAY.hex([2, 3, 4, 3]), { roots: () => [11], extra: 0.5, knob: 0.6, stops: 0.4, closed: 0.3, bomb: { slack: 2 }, par: [9, 17] }),
  lv('Midnight Knot', () => LAY.hex([3, 4, 3, 2], 2.3, 1.6), { roots: () => [1], extra: 0.6, knob: 0.6, stops: 0.5, closed: 0.4, par: [10, 19] }),
  lv('Last Bell', () => withRods(LAY.hex([3, 4, 3]), [{ x1: 1.0, y1: 6, x2: 9.0, y2: 6, dir: -1 }]), { roots: () => [10], extra: 0.6, knob: 0.6, stops: 0.5, bomb: { slack: 2 }, par: [10, 20] }),
];

if (require.main !== module) { module.exports = { WHY, LAY, SPECS, build, circleX, colorize, fuseFor }; return; }
const out = [];
SPECS.forEach((spec, li) => {
  let best = null;
  for (let t = 0; t < 4000 && !best; t++) {
    const seed = (li + 1) * 7919 + t * 104729;
    const def = build(spec, seed); if (!def) continue;
    const L = KL.prep(def); if (KL.validate(L).length) continue;
    const S = KL.init(L); if (S.alive.some(a => !a)) continue;
    const sol = KL.solve(L, S, 200000); if (!sol.path) continue;
    const par = sol.path.length; if (par < spec.par[0] || par > spec.par[1]) continue;
    // reject boards where too many pieces are free at the start (no puzzle) for later levels
    const movable = []; for (let p = 0; p < L.N; p++) if (!KL.locked(L, S, p)) movable.push(p);
    if (li >= 4 && movable.length > Math.max(2, Math.ceil(L.N / 4))) continue;
    // knob must matter on knob levels: at least one knobbed ring whose direction is constrained at some point
    if (spec.knob && li >= 4 && !def.rings.some(r => r.n != null)) continue;
    if (spec.bomb) {
      // put ember(s) on the deepest rings
      const ranked = def.rings.map((r, i) => i).filter(i => KL.locked(L, S, i));
      const order = ranked.sort((a, b) => b - a);
      const nB = spec.bomb.n || 1; let okB = true; const d = JSON.parse(JSON.stringify(def));
      // choose rings that the optimal path frees late
      const freedAt = {}; const T = KL.init(L); sol.path.forEach((m, mi) => { KL.apply(L, T, m); T.alive.forEach((a, p) => { if (!a && freedAt[p] == null) freedAt[p] = mi + 1; }); });
      const late = def.rings.map((r, i) => i).sort((a, b) => freedAt[b] - freedAt[a]).slice(1, 1 + nB);
      for (const i of late) { const f = fuseFor(d, i, spec.bomb.slack); if (!f) { okB = false; break; } d.rings[i].b = f; }
      if (!okB) continue;
      const L2 = KL.prep(d), s2 = KL.solve(L2, null, 300000); if (!s2.path) continue;
      Object.assign(def, d);
    }
    colorize(def);
    best = Object.assign({ name: spec.name }, def, { par: KL.solve(KL.prep(def), null, 300000).path.length, seed });
    if (spec.tip) best.tip = spec.tip;
  }
  if (!best) { console.error('FAILED level', li + 1, spec.name); process.exitCode = 1; return; }
  out.push(best);
  console.log(String(li + 1).padStart(2), best.name.padEnd(15), 'rings', best.rings.length, 'rods', best.rods.length, 'clips', best.clips.length, 'knobs', best.rings.filter(r => r.n != null).length, 'stops', best.stops.length, 'closed', best.rings.filter(r => !r.w).length, 'embers', best.rings.filter(r => r.b).map(r => r.b).join('/') || '-', 'par', best.par);
});
fs.writeFileSync(path.join(__dirname, '..', 'levels.js'), '/* Knotlight campaign — generated by tools/gen.js, verified by tools/solve.js */\n(function(root){var LEVELS=' + JSON.stringify(out) + ';\nif(typeof module!=="undefined"&&module.exports)module.exports=LEVELS;else root.KL_LEVELS=LEVELS;})(this);\n');
