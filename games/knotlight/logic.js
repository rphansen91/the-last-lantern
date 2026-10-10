/* Knotlight — rules engine. Shared by the game (window.KL) and tools (require).
   Board: rings (open C-hoops or closed loops) and rods, joined by clips.
   A clip is a sleeve welded to its OWNER piece, hooked around its HOLDER piece's tube.
   - A piece that owns any clip is pinned: it cannot turn or slide.
   - Turning a holder ring slides its tube through its clips; when the ring's GAP
     reaches a clip, the clip slips off and is gone.
   - A ring's KNOB (brass stud) cannot pass a clip sleeve on that ring, or a stop peg.
   - Sliding a free rod out of the board unhooks every clip that hangs on it.
   - A piece with no clips left floats free and flies away. Clear every piece to win.
   - A ring with a fuse (ember) burns down one per move; free it before it reaches 0. */
(function (root) {
  'use strict';
  var NOTCH = 15, STEPS = 24, KNOB_M = 9, GAP_M = 7;
  function norm(a) { a %= 360; return a < 0 ? a + 360 : a; }
  function deg(y, x) { return norm(Math.atan2(y, x) * 180 / Math.PI); }

  // Precompute geometry for a level definition.
  function prep(def) {
    var L = { def: def, rings: def.rings || [], rods: def.rods || [], clips: def.clips || [], stops: def.stops || [] };
    L.R = L.rings.length; L.D = L.rods.length; L.N = L.R + L.D;
    L.clipAng = L.clips.map(function (c) {
      var o = {};
      [c.h, c.o].forEach(function (p) { if (p < L.R) { var r = L.rings[p]; o[p] = deg(c.y - r.y, c.x - r.x); } });
      return o;
    });
    L.held = []; L.owned = []; L.stopsOn = [];
    for (var p = 0; p < L.N; p++) { L.held.push([]); L.owned.push([]); }
    for (var i = 0; i < L.R; i++) L.stopsOn.push([]);
    L.clips.forEach(function (c, ci) { L.held[c.h].push(ci); L.owned[c.o].push(ci); });
    L.stops.forEach(function (s) { L.stopsOn[s.r].push(s.a); });
    return L;
  }

  function init(L) {
    var S = { k: L.rings.map(function (r) { return r.k || 0; }), alive: [], clips: L.clips.map(function () { return true; }),
      fuse: L.rings.map(function (r) { return r.b || 0; }), moves: 0, failed: false };
    for (var p = 0; p < L.N; p++) S.alive.push(true);
    cascade(L, S);
    return S;
  }
  function clone(S) {
    return { k: S.k.slice(), alive: S.alive.slice(), clips: S.clips.slice(), fuse: S.fuse.slice(), moves: S.moves, failed: S.failed };
  }
  function locked(L, S, p) { var a = L.owned[p]; for (var j = 0; j < a.length; j++) if (S.clips[a[j]]) return true; return false; }
  function clipCount(L, S, p) {
    var n = 0, a = L.held[p], b = L.owned[p];
    for (var j = 0; j < a.length; j++) if (S.clips[a[j]]) n++;
    for (j = 0; j < b.length; j++) if (S.clips[b[j]]) n++;
    return n;
  }
  function gapAt(L, i, kf) { return norm(L.rings[i].g + kf * NOTCH); }
  function knobAt(L, i, kf) { var r = L.rings[i]; return r.n == null ? null : norm(r.n + kf * NOTCH); }
  function gapHalf(L, i) { var w = L.rings[i].w || 0; return w > 0 ? w / 2 - GAP_M : -1; }
  // Is clip ci's point inside ring i's open gap when the ring sits at fractional notch kf?
  function covers(L, i, kf, ci) {
    var e = gapHalf(L, i); if (e < 0) return false;
    var d = Math.abs(norm(L.clipAng[ci][i] - gapAt(L, i, kf) + 180) - 180);
    return d <= e;
  }
  // Blockers for ring i's knob: live clip sleeves on it + stop pegs.
  function blockers(L, S, i) {
    var out = L.stopsOn[i].slice(), a = L.held[i];
    for (var j = 0; j < a.length; j++) if (S.clips[a[j]]) out.push(L.clipAng[a[j]][i]);
    return out;
  }
  // Can ring i move one notch in dir (+1/-1) from its current notch?
  function canStep(L, S, i, dir) {
    if (!S.alive[i] || locked(L, S, i)) return false;
    var kn = knobAt(L, i, S.k[i]); if (kn == null) return true;
    var bl = blockers(L, S, i);
    for (var j = 0; j < bl.length; j++) { var t = norm(dir * (bl[j] - kn)); if (t <= NOTCH + KNOB_M) return false; }
    return true;
  }
  // Clips released by sweeping ring i's gap from notch k to k+dir (continuous).
  function sweepReleases(L, S, i, dir) {
    var e = gapHalf(L, i), out = []; if (e < 0) return out;
    var g0 = gapAt(L, i, S.k[i]), a = L.held[i];
    for (var j = 0; j < a.length; j++) {
      var ci = a[j]; if (!S.clips[ci]) continue;
      var t = norm(dir * (L.clipAng[ci][i] - g0));
      if (t <= NOTCH + e || t >= 360 - e) out.push(ci);
    }
    return out;
  }
  // Remove pieces with no clips. Returns list of freed pieces.
  function cascade(L, S) {
    var freed = [];
    for (var p = 0; p < L.N; p++) if (S.alive[p] && clipCount(L, S, p) === 0) { S.alive[p] = false; freed.push(p); }
    return freed;
  }
  // One notch step (no move bookkeeping). Returns {rel:[clips], freed:[pieces]} or null if blocked.
  function step(L, S, i, dir) {
    if (!canStep(L, S, i, dir)) return null;
    var rel = sweepReleases(L, S, i, dir);
    S.k[i] += dir;
    rel.forEach(function (ci) { S.clips[ci] = false; });
    return { rel: rel, freed: cascade(L, S) };
  }
  function canSlide(L, S, p) { return p >= L.R && S.alive[p] && !locked(L, S, p); }
  function slide(L, S, p) {
    if (!canSlide(L, S, p)) return null;
    var rel = L.held[p].filter(function (ci) { return S.clips[ci]; });
    rel.forEach(function (ci) { S.clips[ci] = false; });
    S.alive[p] = false;
    return { rel: rel, freed: [p].concat(cascade(L, S)) };
  }
  // Called once per completed move: burns fuses. Returns list of rings that blew.
  function endMove(L, S) {
    S.moves++;
    var blown = [];
    for (var i = 0; i < L.R; i++) if (S.alive[i] && L.rings[i].b) { S.fuse[i]--; if (S.fuse[i] <= 0) blown.push(i); }
    if (blown.length) S.failed = true;
    return blown;
  }
  function won(L, S) { for (var p = 0; p < L.N; p++) if (S.alive[p]) return false; return !S.failed; }
  // Any legal productive action at all?
  function anyMove(L, S) {
    for (var p = 0; p < L.N; p++) {
      if (!S.alive[p]) continue;
      if (p >= L.R) { if (canSlide(L, S, p)) return true; continue; }
      if (!locked(L, S, p) && (canStep(L, S, p, 1) || canStep(L, S, p, -1))) return true;
    }
    return false;
  }

  // Successor moves for search: a turn is one drag in one direction, stopping after a release
  // (or at the end of travel). Returns [{m:{t,i,d,s}, S}]
  function successors(L, S) {
    var out = [];
    for (var p = 0; p < L.N; p++) {
      if (!S.alive[p] || locked(L, S, p)) continue;
      if (p >= L.R) { var T = clone(S); slide(L, T, p); endMove(L, T); out.push({ m: { t: 'rod', i: p }, S: T }); continue; }
      for (var d = -1; d <= 1; d += 2) {
        var W = clone(S), s = 0;
        while (s < STEPS - 1) {
          var r = step(L, W, p, d); if (!r) break; s++;
          if (r.rel.length) { var X = clone(W); endMove(L, X); out.push({ m: { t: 'rot', i: p, d: d, s: s }, S: X }); }
          if (!W.alive[p]) break;
        }
      }
    }
    out.sort(function (a, b) { return (a.m.s || 0) - (b.m.s || 0); });
    return out;
  }
  function key(L, S) {
    var s = '';
    for (var j = 0; j < S.clips.length; j++) s += S.clips[j] ? '1' : '0';
    for (var i = 0; i < L.R; i++) s += ',' + (S.alive[i] ? ((S.k[i] % STEPS) + STEPS) % STEPS : '-');
    return s;
  }
  // BFS for the fewest moves. Returns {path:[moves], nodes} or {path:null}
  function solve(L, S0, cap) {
    cap = cap || 400000;
    var S = S0 || init(L);
    if (won(L, S)) return { path: [], nodes: 1 };
    var q = [S], par = [null], mv = [null], seen = {}; seen[key(L, S)] = 1;
    for (var h = 0; h < q.length; h++) {
      if (q.length > cap) return { path: null, nodes: q.length, capped: true };
      var succ = successors(L, q[h]);
      for (var j = 0; j < succ.length; j++) {
        var T = succ[j].S; if (T.failed) continue;
        var kk = key(L, T); if (seen[kk]) continue; seen[kk] = 1;
        q.push(T); par.push(h); mv.push(succ[j].m);
        if (won(L, T)) {
          var path = [], x = q.length - 1;
          while (x > 0) { path.unshift(mv[x]); x = par[x]; }
          return { path: path, nodes: q.length };
        }
      }
    }
    return { path: null, nodes: q.length };
  }
  // Apply a search move to a state (used by tools / replay)
  function apply(L, S, m) {
    if (m.t === 'rod') { if (!slide(L, S, m.i)) return false; }
    else for (var s = 0; s < m.s; s++) { if (!S.alive[m.i]) break; if (!step(L, S, m.i, m.d)) return false; }
    endMove(L, S); return true;
  }
  // Structural checks for a level definition
  function validate(L) {
    var errs = [], S = init(L);
    L.clips.forEach(function (c, ci) {
      if (c.h === c.o) errs.push('clip ' + ci + ' self');
      if (c.h < L.R) {
        var r = L.rings[c.h], d = Math.hypot(c.x - r.x, c.y - r.y);
        if (Math.abs(d - r.r) > 0.02) errs.push('clip ' + ci + ' not on holder ring');
        if (!(r.w > 0)) errs.push('clip ' + ci + ' held by closed ring ' + c.h);
        if (covers(L, c.h, S.k[c.h], ci)) errs.push('clip ' + ci + ' starts inside gap');
      }
      if (c.o < L.R) { var ro = L.rings[c.o], d2 = Math.hypot(c.x - ro.x, c.y - ro.y); if (Math.abs(d2 - ro.r) > 0.02) errs.push('clip ' + ci + ' not on owner ring'); }
    });
    for (var p = 0; p < L.N; p++) if (!L.held[p].length && !L.owned[p].length) errs.push('piece ' + p + ' has no clips');
    return errs;
  }
  var KL = { NOTCH: NOTCH, STEPS: STEPS, KNOB_M: KNOB_M, GAP_M: GAP_M, norm: norm, deg: deg, prep: prep, init: init, clone: clone,
    locked: locked, clipCount: clipCount, gapAt: gapAt, knobAt: knobAt, gapHalf: gapHalf, covers: covers, blockers: blockers,
    canStep: canStep, sweepReleases: sweepReleases, cascade: cascade, step: step, canSlide: canSlide, slide: slide,
    endMove: endMove, won: won, anyMove: anyMove, successors: successors, key: key, solve: solve, apply: apply, validate: validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = KL; else root.KL = KL;
})(this);
