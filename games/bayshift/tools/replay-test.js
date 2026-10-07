// Replays solver plans through real touch gestures. node tools/replay-test.js [url] [levels e.g. 1,4,18]
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('child_process');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/games/bayshift/';
const LEVELS = (process.argv[3] || '4,9,11,13,14,18').split(',').map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  const cdp = await page.target().createCDPSession();
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  let allOk = true;
  for (const lv of LEVELS) {
    const plan = JSON.parse(execFileSync('node', [require('path').join(__dirname, 'plan.js'), require('path').join(__dirname, '../index.html'), String(lv)]).toString());
    await page.evaluate(i => { window.__game.unlockAll(); window.__game.startLevel(i); }, lv - 1); await sleep(300);
    const cs = await page.evaluate(() => window.__game.G.cs);
    let fails = [], t0 = Date.now();
    for (const [k, st] of plan.entries()) {
      // in-page: BFS path for piece i from current pos to (x,y); return grab point + corner waypoints (in cells)
      const info = await page.evaluate(s => {
        const g = window.__game, BS = g.BS, S = g.st, p = S.pieces[s.i], grid = BS.grid(S);
        const key = (x, y) => x + ',' + y, prev = {}, q = [[p.x, p.y]]; prev[key(p.x, p.y)] = null;
        while (q.length) { const [x, y] = q.shift(); if (x === s.x && y === s.y) break;
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { if (!BS.axisOk(p, dx, dy)) continue; const nx = x + dx, ny = y + dy; if (key(nx, ny) in prev) continue; if (!BS.fits(S, grid, p, nx, ny)) continue; prev[key(nx, ny)] = [x, y]; q.push([nx, ny]); } }
        if (!(key(s.x, s.y) in prev)) return null;
        const path = []; let c = [s.x, s.y]; while (c) { path.unshift(c); c = prev[key(c[0], c[1])]; }
        const way = [path[0]]; for (let i = 1; i < path.length; i++) { const last = i === path.length - 1; if (last) { way.push(path[i]); break; } const d1 = [path[i][0] - path[i-1][0], path[i][1] - path[i-1][1]], d2 = [path[i+1][0] - path[i][0], path[i+1][1] - path[i][1]]; if (d1[0] !== d2[0] || d1[1] !== d2[1]) way.push(path[i]); }
        if (s.dx !== undefined) { const far = Math.max(S.w, S.h) + .6; way.push([s.x + s.dx * far, s.y + s.dy * far]); }
        const c0 = p.cells[0]; return { grab: g.cellCenter(p.x + c0[0], p.y + c0[1]), start: [p.x, p.y], way, id: p.id };
      }, st);
      if (!info) { fails.push(`step ${k + 1}: no path`); break; }
      const liBefore = await page.evaluate(i => window.__game.st.pieces[i].li, st.i);
      await touch('touchStart', info.grab[0], info.grab[1]); await sleep(30);
      let cur = [0, 0];
      for (const w of info.way.slice(1)) {
        const tgt = [(w[0] - info.start[0]) * cs, (w[1] - info.start[1]) * cs], n = Math.max(1, Math.ceil(Math.hypot(tgt[0] - cur[0], tgt[1] - cur[1]) / 9));
        for (let j = 1; j <= n; j++) await touch('touchMove', info.grab[0] + cur[0] + (tgt[0] - cur[0]) * j / n, info.grab[1] + cur[1] + (tgt[1] - cur[1]) * j / n);
        cur = tgt; await sleep(40);
      }
      await sleep(90); await touch('touchEnd');
      for (let w = 0; w < 40; w++) { await sleep(60); const busy = await page.evaluate(() => window.__game.anims.some(a => a.block) || window.__game.st.pieces.some(p => p.mot)); if (!busy) break; }
      const got = await page.evaluate(s => { const p = window.__game.st.pieces[s.i]; return { x: p.x, y: p.y, alive: p.alive, li: p.li, rel: window.__game.lastRelease && { ax: window.__game.lastRelease.ax, fA: window.__game.lastRelease.fA, r: window.__game.lastRelease.r } }; }, st);
      const okStep = st.dx !== undefined ? (!got.alive || got.li > liBefore) : (got.x === st.x && got.y === st.y);
      if (process.env.V) console.log('   step', k + 1, JSON.stringify(st), 'way', JSON.stringify(info.way), '->', JSON.stringify(got));
      if (!okStep) { fails.push(`step ${k + 1} ${JSON.stringify(st)} -> got ${JSON.stringify(got)}`); break; }
    }
    await sleep(900);
    const res = await page.evaluate(() => ({ mode: window.__game.mode, left: window.__game.BS.remaining(window.__game.st), moves: window.__game.moves }));
    const pass = !fails.length && res.mode === 'win';
    allOk = allOk && pass;
    console.log(`${pass ? 'PASS' : 'FAIL'} bay ${lv}: ${plan.length} solver drags -> mode=${res.mode} left=${res.left} moves=${res.moves} (${((Date.now() - t0) / 1000).toFixed(1)}s) ${fails.join('; ')}`);
  }
  console.log('errors', JSON.stringify(errors)); console.log(allOk ? 'REPLAY ALL PASS' : 'REPLAY FAILURES');
  await b.close();
})();
