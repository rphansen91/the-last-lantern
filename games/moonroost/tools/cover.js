// Captures the catalog cover (16:10) and phone screenshots from real gameplay. node tools/cover.js [baseUrl]
const puppeteer = require('puppeteer-core'), path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/games/moonroost/';
const OUT = path.join(__dirname, '../screenshots');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle0' }); await sleep(300);
  await page.screenshot({ path: OUT + '/title.png' });
  const cdp = await page.target().createCDPSession();
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const tap = async (x, y) => { await touch('touchStart', x, y); await sleep(20); await touch('touchEnd'); };
  await page.evaluate(() => { window.__game.unlockAll(); window.__game.startSpec(window.__game.spec('camp', 15)); }); await sleep(400);
  const { N, SOL, cc } = await page.evaluate(() => { const g = window.__game; return { N: g.N, SOL: g.SOL, cc: Array.from({ length: g.N * g.N }, (_, i) => g.cellCenter(i)) }; });
  const sol = [...SOL].sort((a, b) => a - b);
  for (const c of [sol[1], sol[4], sol[6]]) { await tap(cc[c][0], cc[c][1]); await sleep(70); await tap(cc[c][0], cc[c][1]); await sleep(300); }
  // a couple of manual crosses
  const free = await page.evaluate(() => { const g = window.__game, o = []; for (let i = 0; i < g.N * g.N; i++) if (!g.owl[i] && !g.SOL.includes(i)) o.push(i); return o; });
  for (const c of free.slice(0, 3)) { await tap(cc[c][0], cc[c][1]); await sleep(380); }
  await page.evaluate(() => window.__game.hint()); await sleep(1500);
  await page.screenshot({ path: OUT + '/play.png' });
  // catalog cover: same renderer in a 16:10 viewport (?cover=1 hides the HUD and places the board right of the title)
  await page.setViewport({ width: 512, height: 320, deviceScaleFactor: 2 });
  await page.goto(BASE + '?cover=1', { waitUntil: 'networkidle0' });
  await page.evaluate(() => { window.__game.unlockAll(); window.__game.startSpec(window.__game.spec('camp', 11)); }); await sleep(300);
  const C = await page.evaluate(() => { const g = window.__game; return { N: g.N, SOL: g.SOL, cc: Array.from({ length: g.N * g.N }, (_, i) => g.cellCenter(i)) }; });
  await page.mouse.move(5, 5);
  const s2 = [...C.SOL].sort((a, b) => a - b);
  for (const c of [s2[0], s2[2], s2[3], s2[5]]) await page.evaluate(i => { window.__game.startSpec; }, c);
  for (const c of [s2[0], s2[2], s2[3], s2[5]]) { await page.mouse.click(C.cc[c][0], C.cc[c][1], { count: 1 }); await sleep(60); await page.mouse.click(C.cc[c][0], C.cc[c][1]); await sleep(250); }
  const free2 = await page.evaluate(() => { const g = window.__game, o = []; for (let i = 0; i < g.N * g.N; i++) if (!g.owl[i] && !g.SOL.includes(i)) o.push(i); return o; });
  for (const c of [free2[2], free2[9]]) { await page.mouse.click(C.cc[c][0], C.cc[c][1]); await sleep(380); }
  await page.mouse.move(C.cc[s2[1]][0], C.cc[s2[1]][1] - 4);
  await sleep(1200);
  await page.screenshot({ path: OUT + '/cover.png' });
  await b.close(); console.log('shots written');
})();
