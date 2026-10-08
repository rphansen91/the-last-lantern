// Reproduces Ryan's Grove 8 report and screenshots the Listen explanation mid-highlight.
// node tools/hint-shot.js [baseUrl] [out.png]
const puppeteer = require('puppeteer-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/games/moonroost/';
const OUT = process.argv[3] || '/workspace/moonroost-hint.png';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + '?from=arcade', { waitUntil: 'networkidle0' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => { const g = window.__game; g.setListen(1); g.unlockAll(); g.startSpec(g.spec('camp', 7)); }); await sleep(400);
  // Ryan's crosses: (0,0) (1,0) (2,0) (3,0) (4,1) (5,1)
  await page.evaluate(() => { const g = window.__game, n = g.N; [[0,0],[1,0],[2,0],[3,0],[4,1],[5,1]].forEach(([r, c]) => { g.mark[r * n + c] = 1; }); });
  await sleep(300);
  await page.evaluate(() => { window.__hintLog = []; document.getElementById('tHint').click(); });
  await sleep(1400);
  await page.screenshot({ path: OUT });
  const info = await page.evaluate(() => {
    const g = window.__game, fx = g.hintFx, bar = document.getElementById('hintbar').getBoundingClientRect(), dock = document.getElementById('dock').getBoundingClientRect();
    return { log: window.__hintLog, text: document.getElementById('hintbar').innerText, mode: fx && fx.mode, committed: fx && fx.committed, ghost: fx && fx.ghost,
      empty: fx && fx.empty.map(u => u.kind + (u.idx + 1)), barTop: bar.top, barBottom: bar.bottom, barH: bar.height, boardBottom: g.G.oy + g.G.size, dockTop: dock.top, markBefore: g.mark[7] };
  });
  await sleep(2800);
  const after = await page.evaluate(() => ({ mark: window.__game.mark[7], committed: window.__game.hintFx && window.__game.hintFx.committed, listen: window.__game.listen }));
  console.log(JSON.stringify(info, null, 1)); console.log('after hold:', JSON.stringify(after));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await b.close();
})();
