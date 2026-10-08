/*ROOST-LOGIC-START*/
var RL = (function () {
  'use strict';
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, R) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // ---- board model ----
  function parse(str) {
    var n = Math.round(Math.sqrt(str.length)), reg = new Array(n * n), map = {}, k = 0;
    for (var i = 0; i < n * n; i++) { var ch = str[i]; if (!(ch in map)) map[ch] = k++; reg[i] = map[ch]; }
    return { n: n, reg: reg, nreg: k };
  }
  function encode(b) { var s = ''; for (var i = 0; i < b.n * b.n; i++) s += String.fromCharCode(97 + b.reg[i]); return s; }
  function units(b) {
    var n = b.n, U = [];
    for (var r = 0; r < n; r++) { var c1 = []; for (var c = 0; c < n; c++) c1.push(r * n + c); U.push({ kind: 'row', idx: r, cells: c1 }); }
    for (var c = 0; c < n; c++) { var c2 = []; for (var r = 0; r < n; r++) c2.push(r * n + c); U.push({ kind: 'col', idx: c, cells: c2 }); }
    for (var g = 0; g < b.nreg; g++) U.push({ kind: 'reg', idx: g, cells: [] });
    for (var i = 0; i < n * n; i++) U[2 * n + b.reg[i]].cells.push(i);
    return U;
  }
  function blocks(b, a, c) { // would a cat at a forbid a cat at c?
    if (a === c) return false;
    var n = b.n, ar = (a / n) | 0, ac = a % n, cr = (c / n) | 0, cc = c % n;
    return ar === cr || ac === cc || b.reg[a] === b.reg[c] || (Math.abs(ar - cr) <= 1 && Math.abs(ac - cc) <= 1);
  }
  // ---- exact solver: count solutions up to limit ----
  function solve(b, limit) {
    limit = limit || 2; var n = b.n, sols = [], cur = new Array(n);
    function rec(r, colMask, regMask) {
      if (sols.length >= limit) return;
      if (r === n) { sols.push(cur.slice()); return; }
      for (var c = 0; c < n; c++) {
        if (colMask & (1 << c)) continue;
        var g = b.reg[r * n + c]; if (regMask & (1 << g)) continue;
        if (r > 0 && Math.abs(cur[r - 1] - c) <= 1) continue;
        cur[r] = c; rec(r + 1, colMask | (1 << c), regMask | (1 << g));
      }
    }
    rec(0, 0, 0);
    return sols.map(function (s) { return s.map(function (c, r) { return r * n + c; }); });
  }
  // ---- deduction engine (human techniques) ----
  function State(b) { this.b = b; this.n = b.n; this.cand = new Uint8Array(b.n * b.n).fill(1); this.cat = new Uint8Array(b.n * b.n); this.U = b.U || (b.U = units(b)); }
  State.prototype.clone = function () { var s = Object.create(State.prototype); s.b = this.b; s.n = this.n; s.U = this.U; s.cand = this.cand.slice(); s.cat = this.cat.slice(); return s; };
  State.prototype.place = function (c) {
    var N = this.n * this.n, out = [];
    for (var i = 0; i < N; i++) if (this.cand[i] && blocks(this.b, c, i)) { this.cand[i] = 0; out.push(i); }
    this.cand[c] = 0; this.cat[c] = 1; return out;
  };
  State.prototype.done = function (u) { for (var i = 0; i < u.cells.length; i++) if (this.cat[u.cells[i]]) return true; return false; };
  State.prototype.cands = function (u) { var o = []; for (var i = 0; i < u.cells.length; i++) if (this.cand[u.cells[i]]) o.push(u.cells[i]); return o; };
  State.prototype.solved = function () { var k = 0; for (var i = 0; i < this.cat.length; i++) k += this.cat[i]; return k === this.n; };
  function combos(arr, k, f) { var idx = []; (function rec(s, d) { if (d === k) return f(idx.map(function (i) { return arr[i]; })); for (var i = s; i < arr.length; i++) { idx[d] = i; if (rec(i + 1, d + 1) === true) return true; } })(0, 0); }
  // A step: {tech, place?:cell, elim?:[cells], focus:[unit...], why}
  function stepSingles(st) {
    var U = st.U, order = [];
    for (var i = 2 * st.n; i < U.length; i++) order.push(U[i]);
    for (var i = 0; i < 2 * st.n; i++) order.push(U[i]);
    for (var k = 0; k < order.length; k++) {
      var u = order[k]; if (st.done(u)) continue; var cs = st.cands(u);
      if (cs.length === 0) return { tech: 'dead', focus: [u] };
      if (cs.length === 1) return { tech: 'single', place: cs[0], focus: [u] };
    }
    return null;
  }
  function spanOf(st, u, kind) { // which units of kind ('row'|'col'|'reg') the candidates of u touch
    var n = st.n, set = {}, cs = st.cands(u);
    for (var i = 0; i < cs.length; i++) { var c = cs[i]; set[kind === 'row' ? (c / n) | 0 : kind === 'col' ? c % n : st.b.reg[c]] = 1; }
    return Object.keys(set).map(Number);
  }
  function unitOf(st, kind, idx) { var n = st.n; return st.U[kind === 'row' ? idx : kind === 'col' ? n + idx : 2 * n + idx]; }
  function stepConfine(st, kmin, kmax) {
    var pairs = [['reg', 'row'], ['reg', 'col'], ['row', 'reg'], ['col', 'reg'], ['row', 'col'], ['col', 'row']];
    for (var k = kmin; k <= kmax; k++) {
      for (var p = 0; p < pairs.length; p++) {
        var A = pairs[p][0], B = pairs[p][1], open = [];
        for (var i = 0; i < st.U.length; i++) { var u = st.U[i]; if (u.kind === A && !st.done(u)) open.push(u); }
        if (open.length <= k) continue;
        var found = null;
        combos(open, k, function (grp) {
          var span = {}; for (var g = 0; g < grp.length; g++) { var sp = spanOf(st, grp[g], B); for (var s = 0; s < sp.length; s++) span[sp[s]] = 1; }
          var keys = Object.keys(span).map(Number); if (keys.length !== k) return;
          var inGrp = {}; grp.forEach(function (u) { u.cells.forEach(function (c) { inGrp[c] = 1; }); });
          var elim = [];
          keys.forEach(function (bi) { st.cands(unitOf(st, B, bi)).forEach(function (c) { if (!inGrp[c]) elim.push(c); }); });
          if (elim.length) { found = { tech: 'confine' + k, elim: elim, focus: grp.slice(), into: keys.map(function (bi) { return unitOf(st, B, bi); }) }; return true; }
        });
        if (found) return found;
      }
    }
    return null;
  }
  function stepCrowd(st) { // a cat here would empty some unit
    var N = st.n * st.n;
    for (var c = 0; c < N; c++) {
      if (!st.cand[c]) continue;
      for (var i = 0; i < st.U.length; i++) {
        var u = st.U[i]; if (st.done(u) || u.cells.indexOf(c) >= 0) continue;
        var cs = st.cands(u), alive = 0;
        for (var j = 0; j < cs.length; j++) if (!blocks(st.b, c, cs[j])) { alive = 1; break; }
        if (!alive) return { tech: 'crowd', elim: [c], focus: [u], from: c };
      }
    }
    return null;
  }
  function propagateDead(st) { // singles-only propagation; true if contradiction
    for (var g = 0; g < 40; g++) {
      var s = stepSingles(st); if (!s) return false; if (s.tech === 'dead') return true; st.place(s.place);
    }
    return false;
  }
  function stepChain(st) {
    var N = st.n * st.n;
    for (var c = 0; c < N; c++) { if (!st.cand[c]) continue; var t = st.clone(); t.place(c); if (propagateDead(t)) return { tech: 'chain', elim: [c], focus: [], from: c }; }
    return null;
  }
  var TECH_COST = { single: 1, confine1: 2, crowd: 3, confine2: 4, confine3: 6, chain: 10 };
  function next(st, maxTech) {
    maxTech = maxTech || 10;
    var s = stepSingles(st); if (s) return s;
    s = stepConfine(st, 1, 1); if (s) return s;
    s = stepCrowd(st); if (s) return s;
    s = stepConfine(st, 2, 3); if (s && TECH_COST[s.tech] <= maxTech) return s;
    if (maxTech >= 10) { s = stepChain(st); if (s) return s; }
    return null;
  }
  function apply(st, s) { if (s.place !== undefined) st.place(s.place); else s.elim.forEach(function (c) { st.cand[c] = 0; }); }
  // full logical solve; returns {ok, steps, score, maxCost, counts}
  function grade(b, maxTech) {
    var st = new State(b), steps = 0, score = 0, maxCost = 0, counts = {};
    for (var g = 0; g < 400; g++) {
      if (st.solved()) return { ok: true, steps: steps, score: score, maxCost: maxCost, counts: counts };
      var s = next(st, maxTech); if (!s || s.tech === 'dead') return { ok: false, steps: steps, score: score, maxCost: maxCost, counts: counts };
      apply(st, s); steps++; var w = TECH_COST[s.tech]; score += w; if (w > maxCost) maxCost = w; counts[s.tech] = (counts[s.tech] || 0) + 1;
    }
    return { ok: false };
  }
  // ---- plain-language explanations for Listen (shared by the game and the tests) ----
  // describe(st, s, nm) -> { text, ghost:[cell], forced:[cells], shadeStrong:[cells], shade:[cells], focus:[units], into:[units], empty:[units], targets:[cells] }
  //   ghost: hypothetical (or answer) owl; forced: owls that would be forced after it; shadeStrong: squares that decide the step;
  //   shade: other squares the hypothetical owl rules out; focus/into: lines/groves that force it; empty: the line/grove left with no spot.
  // nm.reg(idx) returns the display name (html) of grove idx, e.g. a colored "blue".
  function chainTrace(st, c) { // place c, follow forced singles; report the forced owls and the line/grove that runs dry
    var t = st.clone(); t.place(c); var forced = [];
    for (var g = 0; g < 40; g++) {
      var s = stepSingles(t); if (!s) return null;
      if (s.tech === 'dead') return { forced: forced, dead: s.focus[0], t: t };
      forced.push({ cell: s.place, unit: s.focus[0] }); t.place(s.place);
    }
    return null;
  }
  function describe(st, s, nm) {
    var n = st.n, N = n * n;
    function one(u) { return u.kind === 'row' ? 'row ' + (u.idx + 1) : u.kind === 'col' ? 'column ' + (u.idx + 1) : 'the ' + nm.reg(u.idx) + ' grove'; }
    function and(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
    function sorted(us) { return us.map(function (u) { return u.idx; }).sort(function (a, b) { return a - b; }); }
    function nums(idx) { // 1-based, consecutive runs as ranges: "4–5", "1, 3 and 5"
      var r = [], i = 0;
      while (i < idx.length) { var j = i; while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
        if (j > i && idx.length === j - i + 1) r.push((idx[i] + 1) + '–' + (idx[j] + 1)); else for (var q = i; q <= j; q++) r.push(String(idx[q] + 1)); i = j + 1; }
      return and(r);
    }
    function many(us) {
      if (us.length === 1) return one(us[0]);
      var k = us[0].kind, idx = sorted(us);
      if (k === 'reg') return 'the ' + and(idx.map(nm.reg)) + ' groves';
      return (k === 'row' ? 'rows ' : 'columns ') + nums(idx);
    }
    function colors(us) { return and(sorted(us).map(nm.reg)); }
    function poss(x) { return x + "'s"; }
    function cap(x) { return x.replace(/^((?:<[^>]*>)*)([a-z])/, function (m, tags, ch) { return tags + ch.toUpperCase(); }); }
    var out = { text: '', ghost: [], forced: [], shadeStrong: [], shade: [], focus: [], into: [], empty: [], targets: [] };
    if (s.tech === 'single') {
      var u = s.focus[0];
      out.focus = [u]; out.targets = [s.place]; out.ghost = [s.place];
      out.text = cap(one(u)) + ' has one open square left, so its owl goes there. <b>Double-tap</b> it.';
    } else if (/^confine/.test(s.tech)) {
      var A = s.focus, Bu = s.into, a = many(A), b = many(Bu), k = A.length, ak = A[0].kind, bk = Bu[0].kind;
      out.focus = A.slice(); out.into = Bu.slice(); out.shadeStrong = s.elim.slice(); out.targets = s.elim.slice();
      if (k === 1) {
        if (ak === 'reg') out.text = cap(a) + ' only fits in ' + b + ', so ' + poss(b) + ' owl is ' + nm.reg(A[0].idx) + '. Crossing out the rest.';
        else if (bk === 'reg') out.text = cap(poss(a)) + ' open squares are all ' + nm.reg(Bu[0].idx) + ', so the ' + nm.reg(Bu[0].idx) + ' owl is in ' + a + '. Crossing out the rest of ' + nm.reg(Bu[0].idx) + '.';
        else out.text = cap(poss(a)) + ' open squares are all in ' + b + ', so ' + poss(b) + ' owl is in ' + a + '. Crossing out the rest.';
      } else {
        var plural = bk === 'row' ? 'rows' : bk === 'col' ? 'columns' : 'groves';
        if (ak === 'reg') { out.text = cap(a) + ' only fit in ' + b + ', so those ' + plural + '\u2019 owls are theirs. Crossing out the rest.';
          if (out.text.replace(/<[^>]*>/g, '').length > 104) out.text = cap(colors(A)) + ' only fit in ' + b + ', so those ' + plural + '\u2019 owls are theirs. Crossing out the rest.'; }
        else out.text = cap(a) + ' only have room in ' + (bk === 'reg' ? colors(Bu) : b) + ', so those ' + plural + '\u2019 owls sit here. Crossing out the rest.';
      }
    } else if (s.tech === 'crowd') {
      var c = s.from, U = s.focus[0], cr = (c / n) | 0, cc = c % n, cs = st.cands(U), why = { grove: [], touch: [], row: [], col: [] };
      cs.forEach(function (x) {
        var xr = (x / n) | 0, xc = x % n;
        if (U.kind !== 'reg' && st.b.reg[x] === st.b.reg[c]) why.grove.push(x);
        else if (Math.abs(xr - cr) <= 1 && Math.abs(xc - cc) <= 1) why.touch.push(x);
        else if (xr === cr) why.row.push(x); else if (xc === cc) why.col.push(x); else why.grove.push(x);
      });
      // clauses: verb phrases (subject "it" = the owl) or, for the grove, a full clause
      var kinds = [], parts = [], line = why.row.length + why.col.length, gw = nm.reg(st.b.reg[c]), saidIt = false;
      if (why.touch.length) kinds.push([why.touch.length, function (q) { return 'touches ' + q; }, 1]);
      if (line) kinds.push([line, function (q) { return 'lines up with ' + q; }, 1]);
      if (why.grove.length) kinds.push([why.grove.length, function (q, only) { return only ? q + ' in its own ' + gw + ' grove' : 'its ' + gw + ' grove holds ' + q; }, 0]);
      kinds.forEach(function (kd, i) {
        var m = kd[0], q, only = kinds.length === 1;
        if (only) q = kd[2] ? (m === 1 ? 'its last open square' : m === 2 ? 'both of its squares' : 'all ' + m + ' of its squares') : (m === 1 ? 'its last open square is' : 'all ' + m + ' of its squares are');
        else if (i === 0) q = m + (m === 1 ? ' square' : ' squares');
        else if (i === kinds.length - 1) q = m === 1 ? 'the last one' : 'the other ' + m;
        else q = m + ' more';
        var cl = kd[1](q, only); if (kd[2] && !saidIt) { cl = 'it ' + cl; saidIt = true; }
        parts.push(cl);
      });
      out.ghost = [c]; out.targets = [c]; out.empty = [U]; out.shadeStrong = cs.slice();
      for (var i = 0; i < N; i++) if (st.cand[i] && i !== c && blocks(st.b, c, i) && cs.indexOf(i) < 0) out.shade.push(i);
      out.text = 'An owl here blocks all of ' + one(U) + ': ' + and(parts) + '.';
    } else if (s.tech === 'chain') {
      var tr = chainTrace(st, s.from), c2 = s.from;
      out.ghost = [c2]; out.targets = [c2];
      if (tr) {
        out.forced = tr.forced.map(function (f) { return f.cell; }); out.empty = [tr.dead];
        out.focus = tr.forced.map(function (f) { return f.unit; });
        out.shadeStrong = st.cands(tr.dead);
        for (var j = 0; j < N; j++) if (st.cand[j] && !tr.t.cand[j] && j !== c2 && out.forced.indexOf(j) < 0 && out.shadeStrong.indexOf(j) < 0) out.shade.push(j);
        var steps = tr.forced.map(function (f, i) { return one(f.unit) + (i ? ' only one' : ' only one spot'); });
        if (tr.forced.length && tr.forced.length <= 2) out.text = 'An owl here leaves ' + steps.join(', then ') + ', and then ' + one(tr.dead) + ' none.';
        else if (tr.forced.length) out.text = 'An owl here forces ' + tr.forced.length + ' more owls (faint), and then ' + one(tr.dead) + ' has no spot left.';
        else out.text = 'An owl here blocks all of ' + one(tr.dead) + '.';
      } else out.text = 'An owl here would run its neighbors out of room.';
    }
    return out;
  }
  // ---- generator ----
  function randomPerm(n, R) {
    var cur = [], used = new Array(n).fill(false);
    function rec(r) {
      if (r === n) return true;
      var cs = shuffle(Array.from({ length: n }, function (_, i) { return i; }), R);
      for (var i = 0; i < n; i++) { var c = cs[i]; if (used[c] || (r > 0 && Math.abs(cur[r - 1] - c) <= 1)) continue; used[c] = true; cur[r] = c; if (rec(r + 1)) return true; used[c] = false; }
      return false;
    }
    return rec(0) ? cur : null;
  }
  function nbrs4(n, i) { var r = (i / n) | 0, c = i % n, o = []; if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; }
  function connectedWithout(b, g, skip) {
    var cells = []; for (var i = 0; i < b.reg.length; i++) if (b.reg[i] === g && i !== skip) cells.push(i);
    if (!cells.length) return false; var seen = {}, q = [cells[0]]; seen[cells[0]] = 1; var k = 1;
    while (q.length) { var x = q.pop(); nbrs4(b.n, x).forEach(function (y) { if (!seen[y] && y !== skip && b.reg[y] === g) { seen[y] = 1; k++; q.push(y); } }); }
    return k === cells.length;
  }
  function generate(n, seed, opts) {
    opts = opts || {}; var R = rng(seed);
    for (var attempt = 0; attempt < 60; attempt++) {
      var perm = randomPerm(n, R), sol = perm.map(function (c, r) { return r * n + c; });
      var reg = new Array(n * n).fill(-1), solSet = {};
      sol.forEach(function (c, g) { reg[c] = g; solSet[c] = 1; });
      // weighted random growth: some regions greedy, some small
      var wt = []; for (var g = 0; g < n; g++) wt.push(Math.pow(R(), opts.skew || 1.6) + 0.05);
      var left = n * n - n;
      while (left > 0) {
        var tot = 0; for (var g = 0; g < n; g++) tot += wt[g];
        var pick = R() * tot, g = 0; while (pick > wt[g] && g < n - 1) { pick -= wt[g]; g++; }
        var front = []; for (var i = 0; i < n * n; i++) if (reg[i] === g) nbrs4(n, i).forEach(function (y) { if (reg[y] < 0) front.push(y); });
        if (!front.length) { wt[g] *= 0.5; if (wt.every(function (w) { return w < 1e-6; })) break; continue; }
        reg[front[Math.floor(R() * front.length)]] = g; left--;
      }
      var b = { n: n, reg: reg, nreg: n };
      // repair uniqueness
      var ok = false;
      for (var it = 0; it < 200; it++) {
        var sols = solve(b, 2);
        if (sols.length === 1) { ok = true; break; }
        var alt = sols[0].join() === sol.join() ? sols[1] : sols[0];
        var cand = alt.filter(function (c) { return !solSet[c]; }); shuffle(cand, R);
        var moved = false;
        for (var k = 0; k < cand.length && !moved; k++) {
          var c = cand[k], from = reg[c];
          if (!connectedWithout(b, from, c)) continue;
          var opts2 = shuffle(nbrs4(n, c).map(function (y) { return reg[y]; }).filter(function (g2) { return g2 !== from; }), R);
          if (opts2.length) { reg[c] = opts2[0]; moved = true; }
        }
        if (!moved) break;
      }
      if (!ok) continue;
      b.U = null;
      var gr = grade(b, opts.maxTech || 6);
      if (!gr.ok) continue;
      return { str: encode(b), sol: sol, grade: gr };
    }
    return null;
  }
  return { rng: rng, parse: parse, encode: encode, units: units, blocks: blocks, solve: solve, State: State, next: next, apply: apply, grade: grade, generate: generate, TECH_COST: TECH_COST, describe: describe, chainTrace: chainTrace };
})();
/*ROOST-LOGIC-END*/
if (typeof module !== 'undefined') module.exports = RL;
