// Feel tests (needs puppeteer-core + Chrome; serve repo root on :8765). node tools/feel-test.js [url] [shotsDir]
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/games/bayshift/?from=arcade';
const SHOTS = process.argv[3] || require('path').resolve(__dirname, '../../../screenshots') + '/';
const FRAMES = '/tmp/bs-frames/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; const ok = (name, pass, info) => { results.push({ name, pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
(async () => {
  fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await b.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.tap('#bPlay'); await sleep(300);
  const cdp = await page.target().createCDPSession();
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  // path: list of [x,y,ms] waypoints; moves interpolated every ~stepPx
  async function gesture(pts, { stepPx = 4, hold = 0 } = {}) {
    await touch('touchStart', pts[0][0], pts[0][1]); await sleep(30);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1, ms] = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / stepPx)), per = ms / n;
      for (let k = 1; k <= n; k++) { const t0 = Date.now(); await touch('touchMove', x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n); const w = per - (Date.now() - t0); if (w > 0) await sleep(w); }
    }
    if (hold) await sleep(hold);
    await touch('touchEnd');
  }
  // in-page monitor: every rAF, record crate visual positions and check overlaps / off-rail
  await page.evaluate(() => {
    const g = window.__game; window.__mon = { frames: 0, overlaps: [], offRail: [], trace: {} , on: true };
    function cellsOf(p) { return p.cells.map(c => [p.vx + c[0], p.vy + c[1]]); }
    function tick() {
      const M = window.__mon; if (M.on && g.st && g.mode === 'play') {
        M.frames++;
        const ps = g.st.pieces.filter(p => p.alive);
        ps.forEach(p => { (M.trace[p.id] = M.trace[p.id] || []).push([+p.vx.toFixed(4), +p.vy.toFixed(4)]);
          const fx = Math.abs(p.vx - Math.round(p.vx)) > 1e-3, fy = Math.abs(p.vy - Math.round(p.vy)) > 1e-3; if (fx && fy) M.offRail.push([p.id, p.vx, p.vy]); });
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
          const a = cellsOf(ps[i]), bb = cellsOf(ps[j]);
          for (const ca of a) for (const cb of bb) { const ox = 1 - Math.abs(ca[0] - cb[0]), oy = 1 - Math.abs(ca[1] - cb[1]); if (ox > .02 && oy > .02) { M.overlaps.push([ps[i].id, ps[j].id, ca, cb]); } }
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  const reset = async (lv) => { await page.evaluate(i => { window.__game.unlockAll(); window.__game.startLevel(i); const M = window.__mon; M.overlaps = []; M.offRail = []; M.trace = {}; }, lv - 1); await sleep(350); await page.evaluate(() => { document.getElementById('toast').classList.remove('on'); }); };
  const cc = (x, y) => page.evaluate((x, y) => window.__game.cellCenter(x, y), x, y);
  const cs = await page.evaluate(() => window.__game.G.cs);
  const piece = id => page.evaluate(id => { const p = window.__game.st.pieces.find(q => q.id === id); return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, alive: p.alive, mot: !!p.mot }; }, id);
  const mon = () => page.evaluate(() => ({ overlaps: window.__mon.overlaps.length, offRail: window.__mon.offRail.length, trace: window.__mon.trace }));
  console.log('cell size', cs, 'px');

  // T1: slow diagonal-ish drag (right 1.6 cells, drifting down .45 cells with wobble) stays on one rail
  await reset(2); // Twin berth: violet (id 3) at (2,2), 1x1, free row/col
  let s = await cc(2, 2);
  const wob = [];
  for (let i = 1; i <= 8; i++) wob.push([s[0] + cs * 1.6 * i / 8, s[1] + cs * (.45 * i / 8 + (i % 2 ? .09 : -.09)), 110]);
  await gesture([s, ...wob], { stepPx: 3, hold: 150 });
  await sleep(500);
  let p = await piece(3), m = await mon();
  const ys = m.trace[3].map(t => t[1]); const yOff = ys.filter(y => Math.abs(y - 2) > 1e-6).length;
  ok('T1 slow diagonal drag stays on the horizontal rail', yOff === 0 && p.y === 2 && p.x === 4 && Number.isInteger(p.vx),
     `frames=${ys.length} framesOffRow=${yOff} final=(${p.x},${p.y}) visual=(${p.vx},${p.vy})`);
  const moves1 = await page.evaluate(() => [window.__game.moves, window.__game.undoDepth]);
  ok('T1b one undo entry per drag', moves1[0] === 1 && moves1[1] === 1, `moves=${moves1[0]} undo=${moves1[1]}`);

  // T2: intentional turn: drag right 1 cell, then clearly down 1 cell -> (3,3), still one move
  await reset(2);
  s = await cc(2, 2);
  await gesture([s, [s[0] + cs * 1.08, s[1] + cs * .04, 260], [s[0] + cs * 1.02, s[1] + cs * 1.05, 300]], { stepPx: 3, hold: 150 });
  await sleep(500);
  p = await piece(3); m = await mon();
  const moves2 = await page.evaluate(() => [window.__game.moves, window.__game.undoDepth]);
  ok('T2 deliberate perpendicular move turns the corner', p.x === 3 && p.y === 3 && m.offRail === 0 && moves2[0] === 1, `final=(${p.x},${p.y}) offRailFrames=${m.offRail} moves=${moves2[0]}`);
  await page.evaluate(() => window.__game.undo()); await sleep(300); p = await piece(3);
  ok('T2b undo returns the whole drag in one step', p.x === 2 && p.y === 2, `after undo=(${p.x},${p.y})`);

  // T3: flick glides and ships (level 1 teal (0,3) -> right door, 3 cells away), with a frame capture
  await reset(1);
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 780, maxHeight: 1688 });
  let fi = 0; const frameTimes = [];
  cdp.on('Page.screencastFrame', async f => { const n = String(fi++).padStart(3, '0'); fs.writeFileSync(FRAMES + n + '.png', Buffer.from(f.data, 'base64')); frameTimes.push(f.metadata.timestamp); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await sleep(250);
  s = await cc(0, 3);
  const tFlick = Date.now();
  await gesture([s, [s[0] + cs * .45, s[1] - 2, 1], [s[0] + cs * .9, s[1] - 3, 1]], { stepPx: 40 });  // 2 big moves (CDP delivers ~1 touch event per frame)
  await sleep(90);
  const mid = await page.evaluate(() => { const g = window.__game; return { alive: g.st.pieces[1].alive, anims: g.anims.map(a => a.kind), rel: g.lastRelease }; });
  await sleep(700);
  // and coral (1,1) 2x1 flicked up into the top door
  s = await cc(1, 1);
  await gesture([s, [s[0] + 1, s[1] - cs * .45, 1], [s[0] + 2, s[1] - cs * .9, 1]], { stepPx: 40 });
  await sleep(1400);
  await cdp.send('Page.stopScreencast');
  const st3 = await page.evaluate(() => ({ mode: window.__game.mode, left: window.__game.BS.remaining(window.__game.st), moves: window.__game.moves }));
  ok('T3 flick glides 3 cells and ships through the matching door', !mid.alive && st3.left === 0 && st3.mode === 'win', `teal shipped=${!mid.alive} release vA=${mid.rel && mid.rel.vA.toFixed(2)}px/ms fA=${mid.rel && mid.rel.fA.toFixed(2)} anims@90ms=${JSON.stringify(mid.anims)} mode=${st3.mode} moves=${st3.moves}`);

  // T4: very fast flick can never tunnel: level 6, amber (id 3) at (0,2) 2x1, violet (4,2) blocks; finger flies 6 cells in 30ms
  await reset(6);
  s = await cc(0, 2);
  await gesture([s, [s[0] + cs * 6, s[1], 30]], { stepPx: 40 });
  await sleep(700);
  p = await piece(3); m = await mon();
  const maxX = Math.max(...m.trace[3].map(t => t[0]));
  ok('T4 fast flick stops at the blocking crate (no tunneling)', p.x === 2 && p.y === 2 && maxX <= 2 + 1e-6 && m.overlaps === 0, `final=(${p.x},${p.y}) maxVisualX=${maxX} overlapFrames=${m.overlaps}`);
  // T4b: hard drag (finger held) far past the blocker - crate pinned at contact, squashed, never passes
  await reset(6);
  s = await cc(0, 2);
  await touch('touchStart', s[0], s[1]); await sleep(20);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', s[0] + cs * k, s[1]); await sleep(4); }
  await sleep(120);
  const held = await page.evaluate(() => { const d = window.__game.drag; return d ? { fx: d.fx, press: d.press, contact: d.contact } : null; });
  await touch('touchEnd'); await sleep(500);
  m = await mon(); p = await piece(3);
  ok('T4b finger dragged through a crate: crate pins at contact', held && held.fx === 2 && held.contact === 1 && p.x === 2 && m.overlaps === 0, `held=${JSON.stringify(held)} final=(${p.x},${p.y}) overlaps=${m.overlaps}`);

  // T4c: true glide (short flick released early, 0.6 cell) slamming into the blocking crate 1.5 cells later
  await reset(6);
  s = await cc(0, 2);
  await page.evaluate(() => { window.__sq = []; const g = window.__game; (function w() { const p = g.st && g.st.pieces[2]; if (p && p.sq) window.__sq.push(+p.sq.amt.toFixed(2)); if (window.__sq.length < 400) requestAnimationFrame(w); })(); });
  await gesture([s, [s[0] + cs * .3, s[1], 1], [s[0] + cs * .6, s[1], 1]], { stepPx: 40 });
  const rel4 = await page.evaluate(() => window.__game.lastRelease);
  const glide = await page.evaluate(() => { const p = window.__game.st.pieces[2]; return p.mot ? p.mot.k : null; });
  await sleep(600);
  p = await piece(3); m = await mon();
  const maxX4 = Math.max(...m.trace[3].map(t => t[0])), sq = await page.evaluate(() => window.__sq.length ? Math.max(...window.__sq) : 0);
  ok('T4c flick glide into a crate: swept stop + impact squash, no overlap', glide === 'glide' && p.x === 2 && maxX4 <= 2 + 1e-6 && m.overlaps === 0 && sq > 0,
     `release vA=${rel4.vA.toFixed(2)}px/ms from fA=${rel4.fA.toFixed(2)} motion=${glide} final=(${p.x},${p.y}) maxVisualX=${maxX4} overlaps=${m.overlaps} impactSquash=${sq}`);

  // T5: short precise drag (0.7 cell, slow) -> settles one cell over with spring, no glide
  await reset(6);
  s = await cc(1, 4); // lime e (id 5) at (1,4) 2x1 ; row 4 free at 0? '.eeff.' -> (0,4) free
  await gesture([s, [s[0] - cs * .7, s[1], 400]], { stepPx: 2, hold: 120 });
  await sleep(80);
  const springing = await piece(5);
  await sleep(500); p = await piece(5);
  ok('T5 short slow drag settles to nearest cell (spring, no flick)', p.x === 0 && p.y === 4 && Math.abs(p.vx) < 1e-6, `final=(${p.x},${p.y}) mid-settle vx=${springing.vx.toFixed(3)} mot=${springing.mot}`);

  // T6: all frames during the session: never two crates overlapping, never off both rails
  await page.evaluate(() => { window.__mon.on = false; });
  // perf: run an idle+drag sample
  await reset(18); await page.evaluate(() => { window.__game.perf.work.length = 0; window.__game.perf.dts.length = 0; });
  s = await cc(1, 7);
  await gesture([s, [s[0] + cs * 1, s[1], 300], [s[0], s[1], 300]], { stepPx: 3, hold: 100 });
  await sleep(1500);
  const pf = await page.evaluate(() => { const w = window.__game.perf.work.slice().sort((a, b) => a - b), d = window.__game.perf.dts.slice().sort((a, b) => a - b); const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))]; return { n: w.length, workAvg: w.reduce((a, b) => a + b, 0) / w.length, workP95: q(w, .95), workMax: w[w.length - 1], dtAvg: d.reduce((a, b) => a + b, 0) / d.length, dtP95: q(d, .95) }; });
  ok('T7 frame time (update+draw) within budget', pf.workP95 < 8, `frames=${pf.n} work avg ${pf.workAvg.toFixed(2)}ms p95 ${pf.workP95.toFixed(2)}ms max ${pf.workMax.toFixed(2)}ms; rAF dt avg ${pf.dtAvg.toFixed(1)}ms p95 ${pf.dtP95.toFixed(1)}ms`);
  ok('T8 no console errors', errors.length === 0, JSON.stringify(errors));

  // stills
  await reset(14); await sleep(200);
  s = await cc(2, 4); // teal lid in chute (2,4) 2x1? press it into the bollard-side to show squash
  await touch('touchStart', s[0], s[1]); await sleep(20);
  for (let k = 1; k <= 8; k++) { await touch('touchMove', s[0], s[1] - cs * .25 * k); await sleep(16); }
  await sleep(60);
  await page.screenshot({ path: SHOTS + 'bayshift-v3-drag-lift.png' });
  await touch('touchEnd'); await sleep(600);
  fs.writeFileSync('/tmp/bs-feel-results.json', JSON.stringify({ results, perf: pf, frames: fi, frameTimes }, null, 1));
  console.log('screencast frames', fi, 'span', frameTimes.length ? (frameTimes[frameTimes.length - 1] - frameTimes[0]).toFixed(2) + 's' : '-');
  console.log(results.every(r => r.pass) ? 'ALL FEEL TESTS PASS' : 'SOME TESTS FAILED');
  await b.close();
})();
