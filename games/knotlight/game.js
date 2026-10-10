/* Knotlight — game shell: rendering, input, audio, flow. Rules live in logic.js. */
'use strict';
var KL = window.KL, LEVELS = window.KL_LEVELS;
var $ = function (id) { return document.getElementById(id); };
var cv = $('c'), ctx = cv.getContext('2d');
var W = 0, H = 0, DPR = 1, RAD = Math.PI / 180;
var PAL = [
  ['#6ec8ff', '#1d5d8c', '#d8f1ff'], ['#ff7aa8', '#8c2449', '#ffd8e6'], ['#ffb454', '#8a5313', '#fff0d2'], ['#5fe0a8', '#1b7552', '#d6fff0'],
  ['#b89bff', '#4f3594', '#ece4ff'], ['#ff8a5c', '#8f3517', '#ffe0d2'], ['#d4f06a', '#5f7414', '#f6ffd6'], ['#9fe8ff', '#2d7187', '#ecfbff']
];
function prepLevel(d) { var P = KL.prep(d); P.pieceCol = function (p) { return p < P.R ? P.rings[p].c : P.rods[p - P.R].c; }; return P; }

// ---------------- save
var SAVE_KEY = 'knotlight-v1';
var save = (function () { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })();
save.unlocked = save.unlocked || 1; save.best = save.best || {}; save.stars = save.stars || {};
if (save.sound == null) save.sound = true; if (save.haptics == null) save.haptics = true;
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ---------------- audio (all generated)
var AC = null, master = null, verb = null, drone = null, noiseBuf = null;
function audio() {
  if (AC) { if (AC.state === 'suspended' && save.sound) AC.resume(); return AC; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  master = AC.createGain(); master.gain.value = save.sound ? 0.9 : 0; master.connect(AC.destination);
  var d = AC.createDelay(); d.delayTime.value = 0.19; var fb = AC.createGain(); fb.gain.value = 0.32;
  var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  verb = AC.createGain(); verb.gain.value = 0.35; verb.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
  startDrone();
  return AC;
}
function out(node, wet) { node.connect(master); if (wet) { var g = AC.createGain(); g.gain.value = wet; node.connect(g); g.connect(verb); } }
function tone(f, t0, dur, type, vol, wet, f2) {
  if (!AC) return; var o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); out(g, wet); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, fType, f, q, vol, f2, wet) {
  if (!AC) return;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate * 1.2, AC.sampleRate); var a = noiseBuf.getChannelData(0); for (var i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
  var s = AC.createBufferSource(); s.buffer = noiseBuf; var bq = AC.createBiquadFilter(); bq.type = fType; bq.frequency.setValueAtTime(f, t0); bq.Q.value = q;
  if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  var g = AC.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bq); bq.connect(g); out(g, wet); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
function startDrone() {
  if (drone) return; var t = AC.currentTime; drone = AC.createGain(); drone.gain.value = 0; drone.gain.linearRampToValueAtTime(0.045, t + 4);
  var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 3;
  var lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.05; lg.gain.value = 180; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  [55, 82.4, 110.2, 164.8].forEach(function (f, i) { var o = AC.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6;
    var g = AC.createGain(); g.gain.value = i ? 0.3 : 0.5; o.connect(g); g.connect(lp); o.start(); });
  lp.connect(drone); drone.connect(master); var g2 = AC.createGain(); g2.gain.value = 0.5; drone.connect(g2); g2.connect(verb);
}
var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24], lastTick = 0;
var SFX = {
  tap: function () { if (!audio()) return; tone(880, AC.currentTime, 0.06, 'triangle', 0.06); },
  tick: function (rpx, speed) { if (!audio()) return; var t = AC.currentTime; if (t - lastTick < 0.028) return; lastTick = t;
    var f = 1900 - Math.min(900, rpx * 9); noise(t, 0.035, 'bandpass', f, 9, 0.12 + Math.min(0.1, speed * 0.002)); tone(f * 0.5, t, 0.03, 'sine', 0.035); },
  clank: function () { if (!audio()) return; var t = AC.currentTime; noise(t, 0.12, 'bandpass', 520, 4, 0.35); tone(170, t, 0.16, 'triangle', 0.18, 0, 120); tone(1240, t, 0.07, 'square', 0.025); },
  locked: function () { if (!audio()) return; var t = AC.currentTime; noise(t, 0.08, 'bandpass', 380, 6, 0.22); noise(t + 0.07, 0.07, 'bandpass', 330, 6, 0.16); tone(110, t, 0.14, 'sine', 0.12); },
  snick: function (i) { if (!audio()) return; var t = AC.currentTime; noise(t, 0.05, 'highpass', 4200, 1, 0.22); tone(2093 + i * 140, t + 0.005, 0.12, 'sine', 0.08, 0.3); tone(3136 + i * 200, t + 0.03, 0.09, 'sine', 0.04, 0.3); },
  free: function (n) { if (!audio()) return; var t = AC.currentTime, base = 392;
    var a = PENTA[Math.min(PENTA.length - 1, n)], b = PENTA[Math.min(PENTA.length - 1, n + 2)];
    tone(base * Math.pow(2, a / 12), t, 0.9, 'sine', 0.13, 0.6); tone(base * Math.pow(2, b / 12), t + 0.07, 0.8, 'sine', 0.09, 0.6);
    tone(base * 2 * Math.pow(2, a / 12), t + 0.02, 0.5, 'triangle', 0.03, 0.6); noise(t, 0.5, 'bandpass', 1400, 2, 0.05, 6000, 0.5); },
  star: function (n) { if (!audio()) return; tone(1568 * Math.pow(2, PENTA[n % 6] / 12), AC.currentTime, 0.35, 'sine', 0.035, 0.8); },
  whoosh: function () { if (!audio()) return; var t = AC.currentTime; noise(t, 0.45, 'bandpass', 300, 1.5, 0.3, 3200, 0.3); tone(220, t, 0.3, 'sine', 0.06, 0, 520); },
  ember: function (urgent) { if (!audio()) return; var t = AC.currentTime, f = urgent ? 95 : 75; tone(f, t, 0.16, 'sine', urgent ? 0.25 : 0.14); tone(f, t + 0.18, 0.14, 'sine', urgent ? 0.2 : 0.1); noise(t, 0.12, 'lowpass', 900, 1, 0.08); },
  boom: function () { if (!audio()) return; var t = AC.currentTime; noise(t, 1.2, 'lowpass', 2400, 0.7, 0.7, 80, 0.4); tone(70, t, 0.9, 'sine', 0.5, 0, 30); },
  cut: function () { if (!audio()) return; var t = AC.currentTime; noise(t, 0.06, 'highpass', 3000, 2, 0.35); noise(t + 0.05, 0.08, 'bandpass', 6000, 3, 0.2); tone(2600, t + 0.04, 0.12, 'sine', 0.05); },
  win: function () { if (!audio()) return; var t = AC.currentTime;
    [0, 4, 7, 12, 16, 19, 24].forEach(function (s, i) { tone(392 * Math.pow(2, s / 12), t + i * 0.085, 1.4 - i * 0.1, 'sine', 0.1, 0.7); });
    [0, 7, 12].forEach(function (s) { tone(196 * Math.pow(2, s / 12), t + 0.5, 2.2, 'triangle', 0.05, 0.6); }); },
  undo: function () { if (!audio()) return; tone(660, AC.currentTime, 0.1, 'triangle', 0.06, 0, 440); },
  hint: function () { if (!audio()) return; var t = AC.currentTime; tone(988, t, 0.25, 'sine', 0.06, 0.6); tone(1319, t + 0.09, 0.3, 'sine', 0.05, 0.6); }
};
function hap(ms) { if (save.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

// ---------------- game state
var LV = 0, L = null, S = null, hist = [], mode = 'title', snipLeft = 1, snipMode = false, levelDone = false;
var waves = [], vis = [], flyers = [], parts = [], sleevesFx = [], sky = [], spins = [], springs = [], clipFlash = {};
var shake = 0, now = 0, lastInput = 0, hintFx = null, tutorial = null, constel = null, drag = null, comboN = 0, comboT = 0;
var view = { s: 36, ox: 0, oy: 0, T: 11 };

function startLevel(i) {
  LV = i; L = prepLevel(LEVELS[i]); S = KL.init(L); hist = []; snipLeft = 1; snipMode = false; levelDone = false;
  vis = []; for (var p = 0; p < L.N; p++) vis.push({ th: (p < L.R ? S.k[p] : 0) * KL.NOTCH, rub: 0, lift: 0, shake: 0, flash: 0, alpha: 1, born: now + p * 0.045, slide: 0, emberPulse: 0, scorch: 0 });
  waves = []; flyers = []; parts = []; sleevesFx = []; sky = []; spins = []; springs = []; clipFlash = {}; hintFx = null; constel = null; drag = null;
  tutorial = i === 0 ? { t0: now + 1.0 } : null;
  layout(); syncHud(); setMode('play');
  if (LEVELS[i].tip) setTimeout(function () { if (LV === i && mode === 'play') toast(LEVELS[i].tip, 4500); }, 650);
  lastInput = now;
}
function syncHud() {
  $('lvNum').textContent = (LV + 1) + ' ·'; $('lvName').textContent = LEVELS[LV].name;
  $('mvCount').textContent = S.moves; $('mvPar').textContent = LEVELS[LV].par;
  $('bUndo').disabled = !hist.length; $('bSnip').disabled = snipLeft <= 0 && !snipMode;
  $('snipSub').textContent = snipLeft > 0 ? '1 per board' : 'used';
  $('bSnip').classList.toggle('on', snipMode);
}

// ---------------- layout
var SAFE = { t: 0, b: 0 };
function measureSafe() {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-top,0px);width:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(d); var r = d.getBoundingClientRect(); SAFE.t = r.height || 0; SAFE.b = r.width || 0; d.remove();
}
function layout() {
  var r = cv.getBoundingClientRect(); W = r.width || innerWidth; H = r.height || innerHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  measureSafe();
  if (!L) return;
  var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  L.rings.forEach(function (g) { x0 = Math.min(x0, g.x - g.r); x1 = Math.max(x1, g.x + g.r); y0 = Math.min(y0, g.y - g.r); y1 = Math.max(y1, g.y + g.r); });
  L.rods.forEach(function (d) { x0 = Math.min(x0, d.x1, d.x2); x1 = Math.max(x1, d.x1, d.x2); y0 = Math.min(y0, d.y1, d.y2); y1 = Math.max(y1, d.y1, d.y2); });
  var top = 58 + SAFE.t, bot = 80 + SAFE.b, pad = 0.42, aw = W - 16, ah = H - top - bot;
  var s = Math.min(aw / (x1 - x0 + pad * 2), ah / (y1 - y0 + pad * 2), 72);
  view.s = s; view.ox = W / 2 - (x0 + x1) / 2 * s; view.oy = top + ah / 2 - (y0 + y1) / 2 * s;
  view.T = Math.max(8, Math.min(18, s * 0.3));
}
function X(u) { return view.ox + u * view.s; }
function Y(u) { return view.oy + u * view.s; }

// ---------------- helpers
function ringTh(i) { return vis[i].th + vis[i].rub; }
function clipPx(ci) { var c = L.clips[ci]; return { x: X(c.x), y: Y(c.y) }; }
function pieceCenter(p) {
  if (p < L.R) { var g = L.rings[p]; return { x: X(g.x), y: Y(g.y) }; }
  var d = L.rods[p - L.R]; return { x: X((d.x1 + d.x2) / 2), y: Y((d.y1 + d.y2) / 2) };
}
function burst(x, y, col, n, spd, life, size) {
  for (var k = 0; k < n; k++) { var a = Math.random() * Math.PI * 2, v = spd * (0.35 + Math.random() * 0.8);
    parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.15, life: life * (0.6 + Math.random() * 0.6), age: 0, col: col, size: size * (0.5 + Math.random()), g: 120 }); }
}
function toast(msg, ms) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('show'); }, ms || 2200); }

// sleeves pop off, freed pieces fly
function onReleased(rel, freed) {
  rel.forEach(function (ci, j) {
    var c = L.clips[ci], p = clipPx(ci), ang;
    if (c.h < L.R) ang = L.clipAng[ci][c.h] + 90; else { var d = L.rods[c.h - L.R]; ang = Math.atan2(d.y2 - d.y1, d.x2 - d.x1) / RAD; }
    var dir = Math.random() < 0.5 ? 1 : -1;
    sleevesFx.push({ x: p.x, y: p.y, ang: ang, vx: Math.cos(ang * RAD) * 150 * dir + (Math.random() - 0.5) * 60, vy: Math.sin(ang * RAD) * 150 * dir - 160, spin: (Math.random() - 0.5) * 14, age: 0, col: L.pieceCol(c.o) });
    burst(p.x, p.y, '#fff6e0', 10, 220, 0.45, 2.2); burst(p.x, p.y, PAL[L.pieceCol(c.o)][0], 8, 160, 0.6, 2.6);
    SFX.snick(j); hap(12);
  });
  if (now - comboT > 1.6) comboN = 0;
  freed.forEach(function (p, j) { launch(p, j); });
}
function launch(p, j, delay) {
  delay = (delay || 0) + j * 0.09;
  if (p >= L.R) { launchRodVisual(p, delay); return; }
  comboT = now; var n = comboN++;
  var c = pieceCenter(p), col = L.pieceCol(p);
  var tx = W * (0.1 + Math.random() * 0.8), ty = SAFE.t + 14 + Math.random() * Math.max(30, H * 0.09);
  flyers.push({ p: p, t0: now + delay, x0: c.x, y0: c.y, tx: tx, ty: ty, th: ringTh(p), spin: (Math.random() < 0.5 ? -1 : 1) * (220 + Math.random() * 200), col: col, n: n });
  vis[p].alpha = 0;
  var R0 = L.rings[p].r * view.s;
  setTimeout(function () { SFX.free(n); burst(c.x, c.y, PAL[col][2], 22, 300, 0.8, 2.6); burst(c.x, c.y, '#ffffff', 10, 380, 0.4, 1.8); hap(18);
    waves.push({ x: c.x, y: c.y, r0: R0, t0: now, col: PAL[col][0] }); waves.push({ x: c.x, y: c.y, r0: R0 * 0.6, t0: now + 0.08, col: '#ffffff' }); }, delay * 1000);
}
function launchRodVisual(p, delay) {
  var rd = L.rods[p - L.R], c = pieceCenter(p), dx = rd.x2 - rd.x1, dy = rd.y2 - rd.y1, l = Math.hypot(dx, dy);
  flyers.push({ p: p, rod: true, t0: now + delay, ux: dx / l * rd.dir, uy: dy / l * rd.dir, slide: vis[p].slide, col: L.pieceCol(p), x0: c.x, y0: c.y });
  vis[p].alpha = 0;
}

// ---------------- input
function ptr(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function segDist(p, a, b) { var dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t); }
function pickPiece(pt) {
  var best = -1, bd = 1e9, tol = Math.max(26, view.T * 2.2), i, g, d, e;
  for (i = 0; i < L.R; i++) { if (!S.alive[i]) continue; g = L.rings[i]; d = Math.hypot(pt.x - X(g.x), pt.y - Y(g.y)); e = Math.abs(d - g.r * view.s);
    if (e < tol && e < bd) { bd = e; best = i; } }
  for (var k = 0; k < L.D; k++) { var p = L.R + k; if (!S.alive[p]) continue; var rd = L.rods[k];
    e = segDist(pt, { x: X(rd.x1), y: Y(rd.y1) }, { x: X(rd.x2), y: Y(rd.y2) }); if (e < tol && e < bd) { bd = e; best = p; } }
  if (best >= 0) return best;
  var br = 1e9; // inside a ring: smallest ring containing the touch
  for (i = 0; i < L.R; i++) { if (!S.alive[i]) continue; g = L.rings[i]; d = Math.hypot(pt.x - X(g.x), pt.y - Y(g.y)); if (d < g.r * view.s && d > 14 && g.r < br) { br = g.r; best = i; } }
  return best;
}
function pickClip(pt) {
  var best = -1, bd = 36;
  L.clips.forEach(function (c, ci) { if (!S.clips[ci]) return; var p = clipPx(ci), d = Math.hypot(pt.x - p.x, pt.y - p.y); if (d < bd) { bd = d; best = ci; } });
  return best;
}
function angAt(i, pt) { var g = L.rings[i]; return Math.atan2(pt.y - Y(g.y), pt.x - X(g.x)) / RAD; }
// finish any coasting ring immediately so every gesture is its own clean move
function settleAll() {
  var list = spins.slice(); spins = [];
  list.forEach(function (sp) { var i = sp.p; if (!S.alive[i]) return; var v = vis[i], k = S.k[i];
    var tgt = Math.round(v.th / KL.NOTCH) * KL.NOTCH; turnTo(i, tgt); if (S.alive[i]) { v.th = S.k[i] * KL.NOTCH; v.rub = 0; v.lift = 0; }
    if (S.k[i] !== sp.k0 || sp.released || !S.alive[i]) commitMove(sp.start); });
}

cv.addEventListener('pointerdown', function (e) {
  e.preventDefault(); audio();
  if (mode !== 'play' || levelDone || S.failed || drag) return;
  lastInput = now; if (tutorial) tutorial.t0 = 1e9; hintFx = null;
  var pt = ptr(e);
  if (snipMode) { var ci = pickClip(pt); if (ci >= 0) doSnip(ci); else toast('Tap a clip to snip it'); return; }
  var p = pickPiece(pt); if (p < 0) return;
  settleAll(); if (levelDone || !S.alive[p]) return;
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  var start = KL.clone(S);
  if (KL.locked(L, S, p)) { lockedFeedback(p); drag = { p: p, locked: true, id: e.pointerId }; return; }
  if (p < L.R) {
    drag = { p: p, ring: true, id: e.pointerId, start: start, k0: S.k[p], a0: angAt(p, pt), acc: 0, th0: vis[p].th, samples: [{ t: now, th: vis[p].th }], released: false, contact: false };
    vis[p].lift = 1; SFX.tick(L.rings[p].r * view.s, 0); hap(6);
  } else {
    var rd = L.rods[p - L.R], dx = rd.x2 - rd.x1, dy = rd.y2 - rd.y1, l = Math.hypot(dx, dy);
    drag = { p: p, rod: true, id: e.pointerId, start: start, pt0: pt, ux: dx / l * rd.dir, uy: dy / l * rd.dir, samples: [{ t: now, u: 0 }] };
    vis[p].lift = 1; hap(6);
  }
}, { passive: false });
cv.addEventListener('pointermove', function (e) {
  if (!drag || e.pointerId !== drag.id) return; e.preventDefault();
  var pt = ptr(e); lastInput = now;
  if (drag.locked) return;
  if (drag.ring) {
    var a = angAt(drag.p, pt), da = a - drag.a0; da = ((da + 540) % 360) - 180; drag.a0 = a; drag.acc += da;
    var tgt = drag.th0 + drag.acc;
    turnTo(drag.p, tgt);
    if (drag) { drag.samples.push({ t: now, th: tgt }); if (drag.samples.length > 6) drag.samples.shift(); }
  } else if (drag.rod) {
    var u = (pt.x - drag.pt0.x) * drag.ux + (pt.y - drag.pt0.y) * drag.uy;
    vis[drag.p].slide = u > 0 ? u : -16 * (1 - Math.exp(u / 30));
    drag.samples.push({ t: now, u: u }); if (drag.samples.length > 6) drag.samples.shift();
    if (u > Math.max(44, view.s * 1.1)) { var d = drag; drag = null; launchRod(d.p, d.start); }
  }
}, { passive: false });
function endPointer(e) {
  if (!drag || e.pointerId !== drag.id) return;
  var d = drag; drag = null;
  if (d.locked) return;
  if (d.ring) {
    var sm = d.samples, a = sm[0], b = sm[sm.length - 1], dt = Math.max(0.016, b.t - a.t), w = (b.th - a.th) / dt;
    if (now - b.t > 0.09) w = 0;
    spins.push({ p: d.p, w: Math.max(-900, Math.min(900, w)), start: d.start, k0: d.k0, released: d.released, vel: 0 });
  } else if (d.rod) {
    var s2 = d.samples, a2 = s2[0], b2 = s2[s2.length - 1], v = (b2.u - a2.u) / Math.max(0.016, b2.t - a2.t);
    if (v > 380 && b2.u > 6) launchRod(d.p, d.start); else { springs.push({ p: d.p }); vis[d.p].lift = 0; }
  }
}
cv.addEventListener('pointerup', endPointer); cv.addEventListener('pointercancel', endPointer);

// Drive ring i toward visual angle `target` (deg), obeying the rules notch by notch.
function turnTo(i, target) {
  var v = vis[i], NOTCH = KL.NOTCH, guard = 0;
  while (guard++ < 80 && S.alive[i]) {
    var k = S.k[i], cu = KL.canStep(L, S, i, 1), cd = KL.canStep(L, S, i, -1);
    var lo = cd ? (k - 1) * NOTCH : k * NOTCH, hi = cu ? (k + 1) * NOTCH : k * NOTCH;
    var prev = v.th, th = Math.max(lo, Math.min(hi, target));
    v.th = th;
    if (Math.floor(prev / 7.5) !== Math.floor(th / 7.5)) SFX.tick(L.rings[i].r * view.s, Math.abs(th - prev) * 60);
    // the opening sweeps a clip: it slips off right now
    var rel = [];
    L.held[i].forEach(function (ci) { if (S.clips[ci] && KL.covers(L, i, th / NOTCH, ci)) { S.clips[ci] = false; rel.push(ci); } });
    if (rel.length) { var fr = KL.cascade(L, S); markReleased(i); onReleased(rel, fr); if (!S.alive[i]) { freedWhileTurning(i); return; } continue; }
    if (cu && hi > k * NOTCH && th >= hi - 1e-6) { var r = KL.step(L, S, i, 1); if (r.rel.length || r.freed.length) { markReleased(i); onReleased(r.rel, r.freed); if (!S.alive[i]) { freedWhileTurning(i); return; } } continue; }
    if (cd && lo < k * NOTCH && th <= lo + 1e-6) { var r2 = KL.step(L, S, i, -1); if (r2.rel.length || r2.freed.length) { markReleased(i); onReleased(r2.rel, r2.freed); if (!S.alive[i]) { freedWhileTurning(i); return; } } continue; }
    break;
  }
  if (!S.alive[i]) return;
  // rubber band against a blocked stud
  var over = target - v.th, k2 = S.k[i];
  var blocked = (over > 0.5 && !KL.canStep(L, S, i, 1) && v.th >= k2 * NOTCH - 1e-6) || (over < -0.5 && !KL.canStep(L, S, i, -1) && v.th <= k2 * NOTCH + 1e-6);
  if (blocked) {
    var room = studRoom(i, over > 0 ? 1 : -1);
    v.rub = (over > 0 ? 1 : -1) * Math.min(room, 7 * (1 - Math.exp(-Math.abs(over) / 18)));
    if (drag && drag.p === i && !drag.contact && Math.abs(over) > 2) { drag.contact = true; studHit(i); }
  } else { v.rub = 0; if (drag && drag.p === i && Math.abs(over) < 1) drag.contact = false; }
}
function markReleased(i) { if (drag && drag.p === i) drag.released = true; spins.forEach(function (s) { if (s.p === i) s.released = true; }); }
function freedWhileTurning(i) {
  var st = null;
  if (drag && drag.p === i) { st = drag.start; drag = null; }
  spins = spins.filter(function (s) { if (s.p === i) { st = st || s.start; return false; } return true; });
  if (st) commitMove(st);
}
function studRoom(i, dir) {
  var kn = KL.knobAt(L, i, S.k[i]); if (kn == null) return 0;
  var bl = KL.blockers(L, S, i), best = 360;
  bl.forEach(function (b) { var t = KL.norm(dir * (b - kn)); if (t < best) best = t; });
  var contact = (view.T * 1.15) / (L.rings[i].r * view.s) / RAD;
  return Math.max(0, best - contact);
}
function studHit(i) {
  SFX.clank(); hap(25); vis[i].shake = 0.8;
  var g = L.rings[i], kn = KL.knobAt(L, i, ringTh(i) / KL.NOTCH), R = g.r * view.s + view.T * 0.32;
  burst(X(g.x) + Math.cos(kn * RAD) * R, Y(g.y) + Math.sin(kn * RAD) * R, '#ffd27a', 12, 180, 0.4, 2);
  if (!studHit.told) { studHit.told = true; toast('The brass stud can\u2019t pass a clip. Try the other way.', 2600); }
}
function lockedFeedback(p) {
  SFX.locked(); hap(30); vis[p].shake = 1;
  L.owned[p].forEach(function (ci) { if (S.clips[ci]) { clipFlash[ci] = 1; vis[L.clips[ci].h].flash = 0.9; } });
  if (!lockedFeedback.n) lockedFeedback.n = 0;
  if (lockedFeedback.n++ < 2) toast('Pinned by its clip. Free the piece that clip hooks first.', 2600);
}
function commitMove(start) {
  hist.push(start); var blown = KL.endMove(L, S); syncHud();
  for (var i = 0; i < L.R; i++) if (S.alive[i] && L.rings[i].b) { vis[i].emberPulse = 1; SFX.ember(S.fuse[i] <= 2); }
  if (blown.length) { blowUp(blown); return; }
  checkEnd();
}
function launchRod(p, start) {
  var r = KL.slide(L, S, p); if (!r) return;
  vis[p].lift = 0; SFX.whoosh(); hap(20); shake = Math.max(shake, 0.25);
  launchRodVisual(p, 0);
  var others = r.freed.filter(function (q) { return q !== p; });
  r.rel.forEach(function (ci, j) { setTimeout(function () { if (L && L.clips[ci]) onReleased([ci], []); }, 60 + j * 70); });
  others.forEach(function (q, j) { launch(q, j, 0.12 + r.rel.length * 0.07); });
  commitMove(start);
}
function doSnip(ci) {
  settleAll(); if (levelDone || !S.clips[ci]) return;
  var start = KL.clone(S); S.clips[ci] = false; var fr = KL.cascade(L, S);
  snipLeft--; snipMode = false; SFX.cut(); hap(20);
  var p = clipPx(ci); burst(p.x, p.y, '#ffffff', 22, 260, 0.6, 2.4);
  onReleased([ci], fr); commitMove(start); syncHud();
}
function checkEnd() {
  if (KL.won(L, S)) { levelDone = true; setTimeout(winSequence, 950); return; }
  if (!KL.anyMove(L, S)) setTimeout(showStuck, 600);
}
function blowUp(blown) {
  levelDone = true; spins = []; drag = null; SFX.boom(); hap(120); shake = 1.2;
  blown.forEach(function (i) { var g = L.rings[i]; burst(X(g.x), Y(g.y), '#ff6a3d', 60, 420, 1.1, 3.4); burst(X(g.x), Y(g.y), '#ffd27a', 40, 300, 0.9, 2.6); vis[i].scorch = 1; });
  setTimeout(function () {
    if (!S.failed) return;
    $('failEyebrow').textContent = 'The ember burned out'; $('failTitle').textContent = 'Too slow for the spark';
    $('failText').textContent = 'Free the ember\u2019s ring before its count reaches zero. Undo takes the last move back.';
    setMode('fail');
  }, 1100);
}
function showStuck() {
  if (mode !== 'play' || levelDone || KL.anyMove(L, S) || KL.won(L, S)) return;
  $('failEyebrow').textContent = 'Knotted'; $('failTitle').textContent = 'No moves left';
  $('failText').textContent = 'Nothing on the board can turn or slide. Undo a move or restart.'; setMode('fail');
}
function undo() {
  if (!hist.length) return;
  spins = []; drag = null;
  S = hist.pop(); levelDone = false; snipMode = false;
  for (var p = 0; p < L.N; p++) { var v = vis[p]; if (p < L.R) v.th = S.k[p] * KL.NOTCH; v.rub = 0; v.slide = 0; v.lift = 0; v.scorch = 0; if (S.alive[p] && v.alpha < 1) { v.alpha = 1; v.born = now; } }
  flyers = flyers.filter(function (f) { return !S.alive[f.p]; });
  sky = sky.filter(function (s) { return !S.alive[s.p]; });
  SFX.undo(); syncHud();
}

// ---------------- per-frame physics
function updatePhysics(dt) {
  for (var j = spins.length - 1; j >= 0; j--) {
    var sp = spins[j]; if (!sp) continue; var i = sp.p, v = vis[i];
    if (!S.alive[i]) { spins.splice(j, 1); continue; }
    if (Math.abs(sp.w) > 70) {
      turnTo(i, v.th + sp.w * dt);
      if (!S.alive[i] || spins.indexOf(sp) < 0) continue;
      if (Math.abs(v.rub) > 0.2) { sp.w = -sp.w * 0.2; v.shake = 0.5; SFX.clank(); hap(15); }
      sp.w *= Math.exp(-dt * 4.5);
    } else {
      var k = S.k[i], tgt = Math.round(v.th / KL.NOTCH) * KL.NOTCH;
      if (tgt > k * KL.NOTCH && !KL.canStep(L, S, i, 1)) tgt = k * KL.NOTCH;
      if (tgt < k * KL.NOTCH && !KL.canStep(L, S, i, -1)) tgt = k * KL.NOTCH;
      if (sp.vel === 0 && sp.w) sp.vel = sp.w * 0.5, sp.w = 0;
      sp.vel += ((tgt - v.th) * 320 - sp.vel * 24) * dt;
      v.rub *= Math.exp(-dt * 20);
      var nt = v.th + sp.vel * dt;
      if (Math.abs(tgt - nt) < 0.12 && Math.abs(sp.vel) < 5) nt = tgt;
      var keepRub = v.rub; turnTo(i, nt); v.rub = keepRub * 0.85;
      if (!S.alive[i] || spins.indexOf(sp) < 0) continue;
      if (Math.abs(v.th - tgt) < 1e-6 && Math.abs(v.rub) < 0.1) {
        v.th = tgt; v.rub = 0; v.lift = 0; spins.splice(spins.indexOf(sp), 1);
        if (S.k[i] !== sp.k0 || sp.released) commitMove(sp.start);
      }
    }
  }
  for (j = springs.length - 1; j >= 0; j--) { var s = springs[j], vv = vis[s.p]; vv.slide *= Math.exp(-dt * 14); if (Math.abs(vv.slide) < 0.3) { vv.slide = 0; springs.splice(j, 1); } }
  for (var p = 0; p < L.N; p++) { var q = vis[p]; q.shake = Math.max(0, q.shake - dt * 3.2); q.flash = Math.max(0, q.flash - dt * 1.6); q.emberPulse = Math.max(0, q.emberPulse - dt * 1.5);
    if (!(drag && drag.p === p) && !spins.some(function (z) { return z.p === p; })) q.lift = Math.max(0, q.lift - dt * 5); }
  for (var ck in clipFlash) { clipFlash[ck] -= dt * 1.4; if (clipFlash[ck] <= 0) delete clipFlash[ck]; }
  for (j = parts.length - 1; j >= 0; j--) { var pa = parts[j]; pa.age += dt; if (pa.age > pa.life) { parts.splice(j, 1); continue; }
    pa.vx *= Math.exp(-dt * 2.4); pa.vy = pa.vy * Math.exp(-dt * 2.4) + pa.g * dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt; }
  for (j = sleevesFx.length - 1; j >= 0; j--) { var sf = sleevesFx[j]; sf.age += dt; if (sf.age > 0.9) { sleevesFx.splice(j, 1); continue; } sf.vy += 700 * dt; sf.x += sf.vx * dt; sf.y += sf.vy * dt; sf.ang += sf.spin * dt * 57; }
  shake = Math.max(0, shake - dt * 2.2);
}

// ---------------- drawing
function strokeArc(cx, cy, R, a0, a1, w, col, alpha) { ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke(); }
function segIntersect(a0, a1, s0, s1) {
  var o = [], TP = Math.PI * 2;
  for (var k = -1; k <= 2; k++) { var b0 = s0 + k * TP, b1 = s1 + k * TP, x0 = Math.max(a0, b0), x1 = Math.min(a1, b1); if (x1 > x0 + 0.02) o.push([x0, x1]); }
  return o;
}
// a glossy neon-glass tube along an arc
function drawTubeArc(cx, cy, R, a0, a1, colIdx, T, glow, A) {
  var P = PAL[colIdx]; A = A == null ? 1 : A;
  ctx.lineCap = 'round';
  strokeArc(cx + T * 0.18, cy + T * 0.5, R, a0, a1, T + 3, 'rgba(0,0,0,.6)', A * 0.8);
  ctx.globalCompositeOperation = 'lighter';
  strokeArc(cx, cy, R, a0, a1, T * 3, P[0], A * (0.05 + glow * 0.12));
  strokeArc(cx, cy, R, a0, a1, T * 1.8, P[0], A * (0.08 + glow * 0.14));
  ctx.globalCompositeOperation = 'source-over';
  strokeArc(cx, cy, R, a0, a1, T + 2.6, P[1], A);
  strokeArc(cx, cy, R, a0, a1, T, P[0], A);
  strokeArc(cx - T * 0.1, cy - T * 0.14, R, a0, a1, T * 0.42, P[2], A * (0.5 + glow * 0.3));
  segIntersect(a0, a1, 195 * RAD, 280 * RAD).forEach(function (sg) { strokeArc(cx - T * 0.13, cy - T * 0.17, R, sg[0], sg[1], T * 0.17, '#ffffff', A * 0.8); });
  segIntersect(a0, a1, 20 * RAD, 70 * RAD).forEach(function (sg) { strokeArc(cx + T * 0.1, cy + T * 0.12, R, sg[0], sg[1], T * 0.12, '#ffffff', A * 0.18); });
  ctx.globalAlpha = 1;
}
function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function shimmer(p) {
  // after a quiet spell, movable pieces catch a slow glint so a stuck player sees where to start
  if (levelDone || now - lastInput < 8 || !S.alive[p] || KL.locked(L, S, p)) return 0;
  var ph = ((now - lastInput) * 0.5 + p * 0.13) % 2.2; return ph < 0.6 ? Math.sin(ph / 0.6 * Math.PI) * 0.55 : 0;
}
function hintGlow(p) { return hintFx && hintFx.p === p ? 0.6 + 0.5 * Math.sin(now * 8) : 0; }
function drawRing(i, A) {
  var g = L.rings[i], v = vis[i], T = view.T;
  var age = Math.max(0, Math.min(1, (now - v.born) / 0.45)), pop = age < 1 ? easeOutBack(age) : 1;
  A = (A == null ? 1 : A) * Math.min(1, age * 2.5); if (A <= 0) return;
  var sh = v.shake > 0 ? Math.sin(now * 70) * v.shake * 3.2 : 0;
  var cx = X(g.x) + sh, cy = Y(g.y), R = g.r * view.s * (1 + v.lift * 0.025) * pop, th = ringTh(i);
  var glow = v.scorch ? 0 : v.lift * 0.9 + v.flash * 0.8 + hintGlow(i) + shimmer(i);
  if (g.w > 0) { var gc = (g.g + th) * RAD, hw = g.w / 2 * RAD; drawTubeArc(cx, cy, R, gc + hw, gc + Math.PI * 2 - hw, g.c, T, glow, A); }
  else drawTubeArc(cx, cy, R, 0, Math.PI * 2, g.c, T, glow, A);
  ctx.globalAlpha = A;
  L.stopsOn[i].forEach(function (a) { // fixed iron pegs
    var x = cx + Math.cos(a * RAD) * (R + T * 0.95), y = cy + Math.sin(a * RAD) * (R + T * 0.95);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(x + 1, y + 2, T * 0.5, 0, 7); ctx.fill();
    var gr = ctx.createRadialGradient(x - T * 0.15, y - T * 0.15, 1, x, y, T * 0.5); gr.addColorStop(0, '#d5dae6'); gr.addColorStop(1, '#4a5168');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, T * 0.46, 0, 7); ctx.fill(); ctx.strokeStyle = '#1b1f2c'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - T * 0.22, y); ctx.lineTo(x + T * 0.22, y); ctx.stroke(); });
  if (g.n != null) { // brass stud riding on the ring
    var na = (g.n + th) * RAD, kx = cx + Math.cos(na) * (R + T * 0.32), ky = cy + Math.sin(na) * (R + T * 0.32), kr = T * 0.62;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(kx + 1.5, ky + 2.5, kr, 0, 7); ctx.fill();
    var kg = ctx.createRadialGradient(kx - kr * 0.35, ky - kr * 0.4, 1, kx, ky, kr); kg.addColorStop(0, '#fff3c2'); kg.addColorStop(0.45, '#e6b450'); kg.addColorStop(1, '#7a5214');
    ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, 7); ctx.fill(); ctx.strokeStyle = '#3d2806'; ctx.lineWidth = 1.2; ctx.stroke(); }
  if (g.b && !v.scorch) drawEmber(i, cx, cy);
  ctx.globalAlpha = 1;
}
function drawEmber(i, x, y) {
  var T = view.T, f = S.alive[i] ? S.fuse[i] : L.rings[i].b, urgent = f <= 2, wob = 1 + 0.08 * Math.sin(now * (urgent ? 12 : 5)) + vis[i].emberPulse * 0.3;
  var r = Math.max(12, T * 1.1) * wob;
  var gl = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6); gl.addColorStop(0, urgent ? 'rgba(255,90,40,.55)' : 'rgba(255,140,60,.35)'); gl.addColorStop(1, 'rgba(255,80,30,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 7); ctx.fill();
  var cg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r); cg.addColorStop(0, '#fff2b0'); cg.addColorStop(0.4, '#ff9a3c'); cg.addColorStop(1, '#a3260e');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a0800'; ctx.font = '800 ' + Math.round(r * 1.05) + 'px system-ui,-apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f, x, y + 1);
  if (Math.random() < 0.2) parts.push({ x: x + (Math.random() - 0.5) * r, y: y - r * 0.6, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 40, life: 0.7, age: 0, col: '#ffb060', size: 1.6, g: -20 });
}
function drawRod(p, A, slideOverride) {
  var rd = L.rods[p - L.R], v = vis[p], T = view.T * 0.95, P = PAL[rd.c];
  var age = Math.max(0, Math.min(1, (now - v.born) / 0.45));
  A = (A == null ? 1 : A) * Math.min(1, age * 2.5); if (A <= 0) return;
  var dx = rd.x2 - rd.x1, dy = rd.y2 - rd.y1, l = Math.hypot(dx, dy), ux = dx / l * rd.dir, uy = dy / l * rd.dir;
  var sl = slideOverride != null ? slideOverride : v.slide, sh = v.shake > 0 ? Math.sin(now * 70) * v.shake * 3 : 0;
  var x1 = X(rd.x1) + ux * sl - uy * sh, y1 = Y(rd.y1) + uy * sl + ux * sh, x2 = X(rd.x2) + ux * sl - uy * sh, y2 = Y(rd.y2) + uy * sl + ux * sh;
  var glow = v.lift * 0.9 + v.flash * 0.8 + hintGlow(p) + shimmer(p);
  ctx.lineCap = 'round';
  function ln(w, c, a, ox, oy) { ctx.globalAlpha = A * a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1 + (ox || 0), y1 + (oy || 0)); ctx.lineTo(x2 + (ox || 0), y2 + (oy || 0)); ctx.stroke(); }
  ln(T + 3, 'rgba(0,0,0,.6)', 0.8, T * 0.18, T * 0.5);
  ctx.globalCompositeOperation = 'lighter'; ln(T * 2.8, P[0], 0.06 + glow * 0.12); ctx.globalCompositeOperation = 'source-over';
  ln(T + 2.6, P[1], 1); ln(T, P[0], 1); ln(T * 0.42, P[2], 0.55, -T * 0.1, -T * 0.14); ln(T * 0.16, '#fff', 0.6, -T * 0.16, -T * 0.2);
  // end caps (steel ferrules)
  [[x1, y1], [x2, y2]].forEach(function (e) { ctx.globalAlpha = A; ctx.fillStyle = '#c8cedc'; ctx.beginPath(); ctx.arc(e[0], e[1], T * 0.55, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a4054'; ctx.lineWidth = 1.2; ctx.stroke(); });
  // direction chevrons, drifting when the bar is free
  var n = Math.max(2, Math.floor(l * view.s / 64)), free = !KL.locked(L, S, p) || slideOverride != null, ph = free ? (now * 0.8) % 1 : 0;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  for (var j = 0; j < n; j++) { var t = (j + 0.5 + ph * 0.35) / n, cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t, s = T * 0.28;
    ctx.globalAlpha = A * (free ? 0.85 : 0.45); ctx.beginPath(); ctx.moveTo(cx - ux * s - uy * s, cy - uy * s + ux * s); ctx.lineTo(cx + ux * s * 0.5, cy + uy * s * 0.5); ctx.lineTo(cx - ux * s + uy * s, cy - uy * s - ux * s); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); }
function drawSleeve(ci) {
  var c = L.clips[ci], p = clipPx(ci), ang;
  if (c.h < L.R) ang = (L.clipAng[ci][c.h] + 90) * RAD;
  else { var d = L.rods[c.h - L.R], dd = Math.hypot(d.x2 - d.x1, d.y2 - d.y1); ang = Math.atan2(d.y2 - d.y1, d.x2 - d.x1);
    p.x += (d.x2 - d.x1) / dd * d.dir * vis[c.h].slide; p.y += (d.y2 - d.y1) / dd * d.dir * vis[c.h].slide; }
  var near = 0; // anticipation: glows as the holder's opening approaches
  if (c.h < L.R && L.rings[c.h].w > 0) { var g = L.rings[c.h], gd = Math.abs(KL.norm(L.clipAng[ci][c.h] - (g.g + ringTh(c.h)) + 180) - 180) - g.w / 2; near = Math.max(0, 1 - gd / 45); }
  sleeveShape(p.x, p.y, ang, L.pieceCol(c.o), view.T, 1, clipFlash[ci] || 0, near);
}
function sleeveShape(x, y, ang, oc, T, A, fl, near) {
  var P = PAL[oc], lw = T * 1.25, hw = T * 0.95 * (1 + near * 0.08);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  if (near > 0 || fl > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = fl > 0 ? '#ff5050' : P[0]; ctx.globalAlpha = A * (fl > 0 ? 0.55 * fl * (0.6 + 0.4 * Math.sin(now * 30)) : near * 0.35);
    ctx.beginPath(); ctx.arc(0, 0, T * 1.7, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = A * 0.55; ctx.fillStyle = '#000'; rr(-lw / 2 + 1.5, -hw + 2.5, lw, hw * 2, T * 0.35); ctx.fill();
  ctx.globalAlpha = A;
  var gr = ctx.createLinearGradient(-lw / 2, 0, lw / 2, 0); gr.addColorStop(0, P[1]); gr.addColorStop(0.3, P[2]); gr.addColorStop(0.55, P[0]); gr.addColorStop(1, P[1]);
  ctx.fillStyle = gr; rr(-lw / 2, -hw, lw, hw * 2, T * 0.35); ctx.fill();
  ctx.strokeStyle = 'rgba(8,8,18,.8)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-lw / 2 + 2, -hw * 0.45); ctx.lineTo(lw / 2 - 2, -hw * 0.45); ctx.moveTo(-lw / 2 + 2, hw * 0.45); ctx.lineTo(lw / 2 - 2, hw * 0.45); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}

// background: night sky, drifting motes, earned stars
var bgStars = [], motes = [];
function seedBg() {
  for (var i = 0; i < 110; i++) bgStars.push({ x: Math.random(), y: Math.random() * 0.75, r: Math.random() * 1.1 + 0.2, tw: Math.random() * 6, s: 0.5 + Math.random() * 2 });
  for (i = 0; i < 24; i++) motes.push({ x: Math.random(), y: Math.random(), v: 0.004 + Math.random() * 0.01, r: 0.6 + Math.random() * 1.5, ph: Math.random() * 6 });
}
var bgGrad = null, bgKey = '';
function drawBg(dt) {
  var key = W + 'x' + H;
  if (key !== bgKey) { bgKey = key; bgGrad = ctx.createLinearGradient(0, 0, 0, H); bgGrad.addColorStop(0, '#0f1434'); bgGrad.addColorStop(0.55, '#090c1d'); bgGrad.addColorStop(1, '#05060d'); }
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);
  var mx = W * 0.84, my = H * 0.08, mg = ctx.createRadialGradient(mx, my, 0, mx, my, W * 0.6); mg.addColorStop(0, 'rgba(255,180,210,.14)'); mg.addColorStop(1, 'rgba(255,180,210,0)');
  ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  bgStars.forEach(function (s) { ctx.globalAlpha = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(now * s.s + s.tw)); ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#ffd6e6';
  motes.forEach(function (m) { m.y -= m.v * dt; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); } ctx.globalAlpha = 0.1 + 0.08 * Math.sin(now + m.ph);
    ctx.beginPath(); ctx.arc(m.x * W + Math.sin(now * 0.4 + m.ph) * 12, m.y * H, m.r, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;
  if (constel) drawConstellation();
  sky.forEach(function (s) { var a = Math.min(1, (now - s.t) / 0.5), tw = 0.8 + 0.2 * Math.sin(now * 3 + s.ph);
    starGlyph(s.x, s.y, (3 + s.big) * (a < 1 ? easeOutBack(a) : 1) * tw, PAL[s.col][2], PAL[s.col][0]); });
}
function vignette() {
  var vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.4, W / 2, H * 0.55, Math.max(W, H) * 0.85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
function starGlyph(x, y, r, core, halo) {
  ctx.globalCompositeOperation = 'lighter';
  var g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, halo); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.45; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.9; ctx.strokeStyle = core; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - r * 2.2, y); ctx.lineTo(x + r * 2.2, y); ctx.moveTo(x, y - r * 2.2); ctx.lineTo(x, y + r * 2.2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}
function drawConstellation() {
  var t = Math.min(1, (now - constel.t0) / 1.3), pts = constel.pts, n = pts.length; if (n < 2) return;
  ctx.strokeStyle = 'rgba(255,214,230,.6)'; ctx.lineWidth = 1.3; ctx.setLineDash([3, 5]); ctx.beginPath();
  var total = (n - 1) * t; ctx.moveTo(pts[0].x, pts[0].y);
  for (var i = 1; i < n; i++) { var f = Math.max(0, Math.min(1, total - (i - 1))); if (f <= 0) break; ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f); }
  ctx.stroke(); ctx.setLineDash([]);
}

function drawFlyers() {
  for (var j = flyers.length - 1; j >= 0; j--) {
    var f = flyers[j], t = now - f.t0;
    if (f.rod) {
      if (t < 0) { drawRod(f.p, 1, f.slide); continue; }
      var sl = f.slide + 1100 * t * t + 300 * t, a = Math.max(0, 1 - t / 0.75);
      drawRod(f.p, a, sl);
      if (Math.random() < 0.7) { var c = pieceCenter(f.p); parts.push({ x: c.x + f.ux * sl + (Math.random() - 0.5) * 30 * f.uy, y: c.y + f.uy * sl + (Math.random() - 0.5) * 30 * f.ux, vx: -f.ux * 60, vy: -f.uy * 60, life: 0.4, age: 0, col: PAL[f.col][0], size: 2, g: 0 }); }
      if (t > 0.75) flyers.splice(j, 1);
      continue;
    }
    var g = L.rings[f.p], u = Math.max(0, Math.min(1, t / 1.05));
    var pop = t > 0 && t < 0.16 ? 1 + 0.16 * Math.sin(t / 0.16 * Math.PI) : 1;   // squash-pop on release
    var e = u < 0.13 ? 0 : Math.pow((u - 0.13) / 0.87, 2.1);
    var x = f.x0 + (f.tx - f.x0) * e, y = f.y0 + (f.ty - f.y0) * e - Math.sin(e * Math.PI) * 50;
    var sc = pop * (1 - e * 0.93), A = 1 - Math.max(0, (u - 0.78) / 0.22);
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc * (t > 0 && t < 0.16 ? 1 - 0.08 * Math.sin(t / 0.16 * Math.PI) : 1)); ctx.translate(-X(g.x), -Y(g.y));
    var keep = vis[f.p].th, keepR = vis[f.p].rub, keepA = vis[f.p].alpha; vis[f.p].th = f.th + f.spin * e; vis[f.p].rub = 0; vis[f.p].alpha = 1;
    drawRing(f.p, A);
    if (t > 0 && t < 0.22) { ctx.globalCompositeOperation = 'lighter'; drawRing(f.p, (1 - t / 0.22) * 0.9); ctx.globalCompositeOperation = 'source-over'; }
    vis[f.p].th = keep; vis[f.p].rub = keepR; vis[f.p].alpha = keepA;
    ctx.restore();
    if (e > 0 && f.lx != null) for (var q = 0; q < 3; q++) { var fr = Math.random(); parts.push({ x: f.lx + (x - f.lx) * fr + (Math.random() - 0.5) * 12 * sc, y: f.ly + (y - f.ly) * fr, vx: (Math.random() - 0.5) * 24, vy: 30, life: 0.5, age: 0, col: q ? PAL[f.col][0] : PAL[f.col][2], size: 0.8 + 1.6 * sc * Math.random(), g: 0 }); }
    f.lx = x; f.ly = y;
    if (u >= 1) { flyers.splice(j, 1); sky.push({ x: f.tx, y: f.ty, col: f.col, t: now, ph: Math.random() * 6, big: Math.min(2.5, g.r), p: f.p }); burst(f.tx, f.ty, PAL[f.col][2], 12, 120, 0.5, 1.6); SFX.star(f.n); }
  }
}
function drawWaves() {
  ctx.globalCompositeOperation = 'lighter';
  for (var j = waves.length - 1; j >= 0; j--) { var w = waves[j], t = (now - w.t0) / 0.55; if (t < 0) continue; if (t > 1) { waves.splice(j, 1); continue; }
    var e = 1 - Math.pow(1 - t, 3); ctx.globalAlpha = (1 - t) * 0.7; ctx.strokeStyle = w.col; ctx.lineWidth = 1 + 5 * (1 - t); ctx.beginPath(); ctx.arc(w.x, w.y, w.r0 + e * 70, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawHint() {
  if (!hintFx) return; if (hintFx.until < now) { hintFx = null; return; }
  var m = hintFx.m, a = 0.6 + 0.4 * Math.sin(now * 6);
  if (!S.alive[m.i]) { hintFx = null; return; }
  ctx.save();
  if (m.t === 'rot') {
    var g = L.rings[m.i], cx = X(g.x), cy = Y(g.y), R = g.r * view.s + view.T * 1.7, gc = g.g + ringTh(m.i), sweep = m.s * KL.NOTCH * m.d;
    var p0 = gc * RAD, p1 = (gc + sweep) * RAD;
    ctx.strokeStyle = 'rgba(255,230,160,' + (0.8 * a) + ')'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -now * 30 * m.d;
    ctx.beginPath(); ctx.arc(cx, cy, R, Math.min(p0, p1), Math.max(p0, p1)); ctx.stroke(); ctx.setLineDash([]);
    var hx = cx + Math.cos(p1) * R, hy = cy + Math.sin(p1) * R, ta = p1 + m.d * Math.PI / 2;
    ctx.fillStyle = 'rgba(255,230,160,' + a + ')'; ctx.beginPath(); ctx.moveTo(hx + Math.cos(ta) * 11, hy + Math.sin(ta) * 11);
    ctx.lineTo(hx + Math.cos(ta + 2.4) * 9, hy + Math.sin(ta + 2.4) * 9); ctx.lineTo(hx + Math.cos(ta - 2.4) * 9, hy + Math.sin(ta - 2.4) * 9); ctx.fill();
    var gp = (gc + sweep * ((now * 0.8) % 1)) * RAD; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,240,200,.95)'; ctx.beginPath(); ctx.arc(cx + Math.cos(gp) * R, cy + Math.sin(gp) * R, 4.5, 0, 7); ctx.fill();
  } else {
    var rd = L.rods[m.i - L.R], dx = rd.x2 - rd.x1, dy = rd.y2 - rd.y1, l = Math.hypot(dx, dy), ux = dx / l * rd.dir, uy = dy / l * rd.dir;
    var ex = X(rd.dir > 0 ? rd.x2 : rd.x1), ey = Y(rd.dir > 0 ? rd.y2 : rd.y1), o = ((now * 1.2) % 1) * 30;
    ctx.strokeStyle = 'rgba(255,230,160,' + a + ')'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ex + ux * (12 + o), ey + uy * (12 + o)); ctx.lineTo(ex + ux * (34 + o), ey + uy * (34 + o)); ctx.stroke();
  }
  ctx.restore();
}
function drawTutorial() {
  if (!tutorial || now < tutorial.t0 || levelDone) return;
  if (!tutorial.m) { var r = KL.solve(L, KL.clone(S), 4000); tutorial.m = r.path && r.path[0]; } var m = tutorial.m; if (!m || m.t !== 'rot' || !S.alive[m.i]) return;
  var g = L.rings[m.i], cx = X(g.x), cy = Y(g.y), R = g.r * view.s, ph = ((now - tutorial.t0) % 2.6) / 2.6;
  var a0 = (g.g + ringTh(m.i) + 180) * RAD, a = a0 + m.d * Math.min(1, ph / 0.8) * Math.PI * 0.75;
  var x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, al = ph < 0.1 ? ph / 0.1 : ph > 0.85 ? Math.max(0, (1 - ph) / 0.15) : 1;
  ctx.globalAlpha = al * 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill();
  ctx.globalAlpha = al * 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
}
function drawTitleRings() {
  var cx = W / 2, s = Math.min(W, H) * 0.17, cy = Math.max(SAFE.t + 30 + s * 1.3, H * 0.19), T = Math.max(10, s * 0.14);
  [[-0.55, -0.35, 0, 11], [0.55, -0.35, 1, -14], [0, 0.55, 4, 9]].forEach(function (r, i) {
    var gc = (now * r[3] + i * 120) * RAD; drawTubeArc(cx + r[0] * s, cy + r[1] * s, s * 0.8, gc + 0.55, gc + Math.PI * 2 - 0.55, r[2], T, 0.5 + 0.3 * Math.sin(now + i), mode === 'title' ? 0.9 : 0.25); });
}

var last = 0, frameTimes = [];
function frame(ts) {
  var t = ts / 1000, dt = Math.min(0.05, last ? t - last : 0.016); last = t; now = t;
  frameTimes.push(dt); if (frameTimes.length > 120) frameTimes.shift();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (L && mode !== 'title' && mode !== 'levels' && mode !== 'how') updatePhysics(dt);
  drawBg(dt);
  if (L && mode !== 'title' && mode !== 'levels' && mode !== 'how') {
    var sx = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;
    ctx.save(); ctx.translate(sx, sy);
    var order = []; for (var p = 0; p < L.N; p++) if (S.alive[p] && vis[p].alpha > 0) order.push(p);
    order.sort(function (a, b) { return (vis[a].lift - vis[b].lift) || (a - b); });
    order.forEach(function (p) { if (p >= L.R) drawRod(p); });
    order.forEach(function (p) { if (p < L.R) drawRing(p); });
    L.clips.forEach(function (c, ci) { if (S.clips[ci]) drawSleeve(ci); });
    sleevesFx.forEach(function (sf) { sleeveShape(sf.x, sf.y, sf.ang * RAD, sf.col, view.T, Math.max(0, 1 - sf.age / 0.9), 0, 0); });
    drawFlyers(); drawWaves(); drawHint(); drawTutorial();
    if (snipMode) L.clips.forEach(function (c, ci) { if (!S.clips[ci]) return; var q = clipPx(ci); ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * Math.sin(now * 7)) + ')'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(q.x, q.y, view.T * 1.8, 0, 7); ctx.stroke(); ctx.setLineDash([]); });
    ctx.restore();
  } else drawTitleRings();
  ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < parts.length; i++) { var pa = parts[i], k = 1 - pa.age / pa.life, rad = pa.size * (0.5 + k * 0.7) * 1.35; ctx.fillStyle = pa.col;
    if (pa.size > 1.7) { ctx.globalAlpha = Math.max(0, k) * 0.22; ctx.beginPath(); ctx.arc(pa.x, pa.y, rad * 3, 0, 7); ctx.fill(); }
    ctx.globalAlpha = Math.max(0, k); ctx.beginPath(); ctx.arc(pa.x, pa.y, rad, 0, 7); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  vignette();
  requestAnimationFrame(frame);
}

// ---------------- flow
function setMode(m) {
  mode = m; document.body.dataset.mode = m; if (m !== 'play') $('toast').classList.remove('show');
  ['title', 'how', 'levels', 'win', 'fail', 'pause'].forEach(function (id) { $(id).classList.toggle('hidden', id !== m); });
}
function winSequence() {
  if (!KL.won(L, S)) return;
  var par = LEVELS[LV].par, stars = S.moves <= par ? 3 : S.moves <= par + 2 ? 2 : 1;
  if (snipLeft < 1 && stars > 2) stars = 2;
  constel = { t0: now, pts: sky.slice().sort(function (a, b) { return a.x - b.x; }).map(function (s) { return { x: s.x, y: s.y }; }) };
  SFX.win(); hap(40);
  sky.forEach(function (s, i) { setTimeout(function () { burst(s.x, s.y, PAL[s.col][2], 14, 160, 0.8, 2); }, i * 80); });
  var prevBest = save.best[LV];
  save.best[LV] = Math.min(prevBest || 999, S.moves); save.stars[LV] = Math.max(save.stars[LV] || 0, stars);
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, LV + 2)); writeSave();
  setTimeout(function () {
    if (mode !== 'play') return;
    $('winStars').textContent = '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars);
    $('winTitle').textContent = ['Loose ends', 'Untangled', 'Unknotted'][stars - 1];
    $('winEyebrow').textContent = 'Board ' + (LV + 1) + ' clear';
    $('winStat').textContent = S.moves + (S.moves === 1 ? ' move' : ' moves') + ' · par ' + par + (prevBest && prevBest < S.moves ? ' · best ' + prevBest : '');
    $('bNext').textContent = LV + 1 < LEVELS.length ? 'Next board' : 'All boards';
    setMode('win');
  }, 1400);
}
function showHint() {
  if (levelDone) return; settleAll(); if (levelDone) return;
  var r = KL.solve(L, KL.clone(S), 80000);
  if (!r.path || !r.path.length) { toast(S.failed ? 'Undo first' : 'No clean route from here. Try Undo.'); return; }
  var m = r.path[0]; hintFx = { m: m, p: m.i, until: now + 5 }; SFX.hint(); lastInput = now;
  toast(m.t === 'rod' ? 'Slide the glowing bar off along its arrows' : 'Turn the glowing ring ' + (m.d > 0 ? 'clockwise' : 'anticlockwise') + ' until its gap reaches the clip', 2800);
}
function buildLevelGrid() {
  var g = $('lvlGrid'); g.innerHTML = '';
  LEVELS.forEach(function (lv, i) {
    var b = document.createElement('button'), st = save.stars[i] || 0;
    b.innerHTML = (i + 1) + '<small>' + (st ? '★★★'.slice(0, st) : (lv.rings.some(function (r) { return r.b; }) ? 'EMBER' : '')) + '</small>';
    if (st) b.classList.add('done'); if (i === save.unlocked - 1) b.classList.add('cur');
    b.disabled = i >= save.unlocked; b.addEventListener('click', function () { audio(); SFX.tap(); startLevel(i); });
    g.appendChild(b);
  });
}
function on(id, fn) { $(id).addEventListener('click', function (e) { e.preventDefault(); audio(); fn(); }); }
var howBack = 'title';
function bind() {
  on('bPlay', function () { SFX.tap(); startLevel(Math.min(save.unlocked - 1, LEVELS.length - 1)); });
  on('bLevels', function () { SFX.tap(); buildLevelGrid(); setMode('levels'); });
  on('bHow', function () { SFX.tap(); howBack = 'title'; setMode('how'); });
  on('bHowOk', function () { SFX.tap(); setMode(howBack); });
  on('bLevelsBack', function () { SFX.tap(); setMode('title'); });
  on('bUndo', function () { if (drag) return; undo(); });
  on('bHint', function () { showHint(); });
  on('bSnip', function () { if (snipLeft <= 0 || levelDone) return; snipMode = !snipMode; SFX.tap(); syncHud(); if (snipMode) toast('Tap any clip to snip it'); });
  on('bRestart', function () { SFX.undo(); startLevel(LV); });
  on('bPause', function () { SFX.tap(); setMode('pause'); });
  on('bResume', function () { SFX.tap(); setMode('play'); });
  on('bPauseHow', function () { SFX.tap(); howBack = 'pause'; setMode('how'); });
  on('bPauseLevels', function () { SFX.tap(); buildLevelGrid(); setMode('levels'); });
  on('bNext', function () { SFX.tap(); if (LV + 1 < LEVELS.length) startLevel(LV + 1); else { buildLevelGrid(); setMode('levels'); } });
  on('bWinRetry', function () { SFX.tap(); startLevel(LV); });
  on('bWinLevels', function () { SFX.tap(); buildLevelGrid(); setMode('levels'); });
  on('bFailUndo', function () { setMode('play'); undo(); });
  on('bFailRetry', function () { SFX.tap(); startLevel(LV); });
  on('bFailLevels', function () { SFX.tap(); buildLevelGrid(); setMode('levels'); });
  on('tSound', function () { save.sound = !save.sound; writeSave(); if (master) master.gain.value = save.sound ? 0.9 : 0; syncToggles(); SFX.tap(); });
  on('tHaptic', function () { save.haptics = !save.haptics; writeSave(); syncToggles(); hap(10); });
}
function syncToggles() { $('tSound').textContent = save.sound ? 'On' : 'Off'; $('tHaptic').textContent = save.haptics ? 'On' : 'Off'; }
function arcadeChip() {
  if (!/\bfrom=arcade\b/.test(location.search || '')) return;
  document.documentElement.classList.add('arcade');
  var a = document.createElement('a'); a.href = '../../?from=game'; a.id = 'arcadeBack';
  a.innerHTML = '<span aria-hidden="true">←</span><span class="lbl">&nbsp;Library</span>';
  a.setAttribute('aria-label', 'Back to Night Arcade library');
  document.body.appendChild(a);
}
if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });
window.addEventListener('resize', layout);
document.addEventListener('visibilitychange', function () { if (AC) { if (document.hidden) AC.suspend(); else if (save.sound) AC.resume(); } });
seedBg(); layout(); bind(); syncToggles(); arcadeChip(); setMode('title'); requestAnimationFrame(frame);

// exposed for tools/tests
window.Knot = { KL: KL, LEVELS: LEVELS, save: save, startLevel: startLevel, view: view, frameTimes: frameTimes, X: X, Y: Y,
  get L() { return L; }, get S() { return S; }, get mode() { return mode; }, get vis() { return vis; }, get hist() { return hist; },
  get busy() { return !!drag || spins.length > 0 || flyers.length > 0; }, setNow: null,
  unlockAll: function () { save.unlocked = LEVELS.length; writeSave(); buildLevelGrid(); } };
