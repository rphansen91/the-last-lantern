// Headless touch play-through: node tools/play-test.js [baseUrl] [levels e.g. 1,12,36]
// Plays each grove with real CDP touch events: drag-paints crosses, uses a hint, makes one deliberate wrong double-tap,
// then double-taps every solution cell. Fails on any page error or if a grove doesn't end in the win screen.
const puppeteer = require('puppeteer-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/games/moonroost/';
const LV = (process.argv[3] || '1,2,12,22,36').split(',').map(Number);
const SHOTS = process.env.SHOTS;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await b.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + '?from=arcade', { waitUntil: 'networkidle0' });
  if (SHOTS) await page.screenshot({ path: SHOTS + '/title.png' });
  const cdp = await page.target().createCDPSession();
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const tap = async (x, y) => { await touch('touchStart', x, y); await sleep(25); await touch('touchEnd'); };
  let ok = true;
  for (const lv of LV) {
    await page.evaluate(i => { window.__game.unlockAll(); window.__game.startSpec(window.__game.spec('camp', i)); }, lv - 1); await sleep(400);
    const info = await page.evaluate(() => { const g = window.__game; return { N: g.N, SOL: g.SOL, cc: Array.from({ length: g.N * g.N }, (_, i) => g.cellCenter(i)), cs: g.G.cs }; });
    const { N, SOL, cc } = info; const sol = new Set(SOL); const notes = [];
    // 1) drag-paint a full row that has no... (row 0) then undo it
    const r = 0; await touch('touchStart', cc[r * N][0], cc[r * N][1]);
    for (let k = 1; k <= 24; k++) await touch('touchMove', cc[r * N][0] + (cc[r * N + N - 1][0] - cc[r * N][0]) * k / 24, cc[r * N][1] + Math.sin(k / 3) * info.cs * .3);
    await touch('touchEnd'); await sleep(60);
    const painted = await page.evaluate(n => Array.from(window.__game.mark).slice(0, n).reduce((a, b) => a + b, 0), N);
    if (painted !== N) notes.push(`drag painted ${painted}/${N}`);
    await page.evaluate(() => window.__game.undo()); await sleep(30);
    const after = await page.evaluate(() => Array.from(window.__game.mark).reduce((a, b) => a + b, 0));
    if (after !== 0) notes.push(`undo left ${after} marks`);
    // 2) single tap toggles cross on / off
    const nonSol = [...Array(N * N).keys()].find(i => !sol.has(i));
    await tap(cc[nonSol][0], cc[nonSol][1]); await sleep(400);
    const m1 = await page.evaluate(i => window.__game.mark[i], nonSol);
    await tap(cc[nonSol][0], cc[nonSol][1]); await sleep(400);
    const m2 = await page.evaluate(i => window.__game.mark[i], nonSol);
    if (m1 !== 1 || m2 !== 0) notes.push(`tap toggle ${m1},${m2}`);
    // 3) hint
    await page.evaluate(() => window.__game.hint()); await sleep(900);
    // 4) a wrong double-tap costs a moon
    await tap(cc[nonSol][0], cc[nonSol][1]); await sleep(90); await tap(cc[nonSol][0], cc[nonSol][1]); await sleep(500);
    const moons = await page.evaluate(() => window.__game.moons);
    if (moons !== 2) notes.push(`moons after wrong=${moons}`);
    if (SHOTS && lv === LV[LV.length - 1]) { }
    // 5) double-tap every solution cell
    for (const [k, c] of SOL.entries()) {
      await tap(cc[c][0], cc[c][1]); await sleep(80); await tap(cc[c][0], cc[c][1]); await sleep(k === Math.floor(N / 2) ? 700 : 380);
      if (SHOTS && k === Math.floor(N / 2) && lv === LV[LV.length - 1]) await page.screenshot({ path: SHOTS + `/play-l${lv}.png` });
    }
    const owls = await page.evaluate(() => window.__game.owls);
    await sleep(1600 + N * 130);
    const mode = await page.evaluate(() => window.__game.mode);
    if (SHOTS && lv === LV[0]) await page.screenshot({ path: SHOTS + `/win-l${lv}.png` });
    const pass = owls === N && mode === 'win' && !notes.length;
    ok = ok && pass; console.log(`grove ${lv} (${N}x${N}): owls ${owls}/${N}, mode ${mode} ${pass ? 'OK' : 'FAIL ' + notes.join('; ')}`);
  }
  // extra scenarios on grove 5: slow taps are two crosses (no owl), 3 wrong owls -> fail -> revive, Library chip, daily + deep wood
  {
    await page.evaluate(() => window.__game.startSpec(window.__game.spec('camp', 4))); await sleep(300);
    const { N, SOL, cc } = await page.evaluate(() => { const g = window.__game; return { N: g.N, SOL: g.SOL, cc: Array.from({ length: g.N * g.N }, (_, i) => g.cellCenter(i)) }; });
    const s0 = SOL[0], notes = [];
    await tap(cc[s0][0], cc[s0][1]); await sleep(520); await tap(cc[s0][0], cc[s0][1]); await sleep(300);
    const st = await page.evaluate(i => [window.__game.owl[i], window.__game.mark[i]], s0);
    if (st[0] !== 0 || st[1] !== 0) notes.push('slow taps placed owl or left cross ' + st);
    await tap(cc[s0][0], cc[s0][1]); await sleep(160); await tap(cc[s0][0], cc[s0][1]); await sleep(300);
    if (await page.evaluate(i => window.__game.owl[i], s0) !== 1) notes.push('160ms double-tap did not land owl');
    const wrong = [...Array(N * N).keys()].filter(i => !SOL.includes(i)).slice(-3);
    for (const w of wrong) { await tap(cc[w][0], cc[w][1]); await sleep(90); await tap(cc[w][0], cc[w][1]); await sleep(350); }
    await sleep(900);
    if (await page.evaluate(() => window.__game.mode) !== 'fail') notes.push('3 wrong owls did not fail');
    await page.click('#bRevive'); await sleep(200);
    if (await page.evaluate(() => window.__game.moons) !== 1 || await page.evaluate(() => window.__game.mode) !== 'play') notes.push('revive broken');
    // hint-only solve: keep pressing Listen and follow single hints until solved
    for (let k = 0; k < 80 && await page.evaluate(() => window.__game.owls) < N; k++) {
      await page.evaluate(() => window.__game.hint()); await sleep(40 + 70 * N);
      const tgt = await page.evaluate(() => { const g = window.__game; for (let i = 0; i < g.N * g.N; i++) if (g.SOL.includes(i) && !g.owl[i]) { /* check if it's forced by hint */ } return null; });
      const forced = await page.evaluate(() => { const g = window.__game, RL = g.RL, B = RL.parse(g.SP.str); B.U = RL.units(B); const st = new RL.State(B);
        for (let c = 0; c < g.N * g.N; c++) if (g.owl[c]) st.place(c); for (let c = 0; c < g.N * g.N; c++) if (g.mark[c]) st.cand[c] = 0; const s = RL.next(st, 10); return s && s.place !== undefined ? s.place : -1; });
      if (forced >= 0) { await tap(cc[forced][0], cc[forced][1]); await sleep(90); await tap(cc[forced][0], cc[forced][1]); await sleep(250); }
    }
    await sleep(2200);
    if (await page.evaluate(() => window.__game.mode) !== 'win') notes.push('hint-guided solve did not win');
    if (!(await page.$('#arcadeBack'))) notes.push('no Library chip with ?from=arcade');
    // daily
    await page.evaluate(() => { document.getElementById('bWinMenu').click(); document.getElementById('bLvBack').click(); }); await sleep(200);
    const t0 = Date.now(); await page.click('#bDaily'); await sleep(200);
    for (let k = 0; k < 50 && await page.evaluate(() => window.__game.SP && window.__game.SP.kind) !== 'night'; k++) await sleep(100);
    const dms = Date.now() - t0;
    const dn = await page.evaluate(() => { const g = window.__game; g.SOL.forEach(c => {}); return g.N; });
    const dcc = await page.evaluate(() => { const g = window.__game; return { SOL: g.SOL, cc: Array.from({ length: g.N * g.N }, (_, i) => g.cellCenter(i)) }; });
    for (const c of dcc.SOL) { await tap(dcc.cc[c][0], dcc.cc[c][1]); await sleep(80); await tap(dcc.cc[c][0], dcc.cc[c][1]); await sleep(200); }
    await sleep(1600 + dn * 130);
    const dm = await page.evaluate(() => window.__game.mode); if (dm !== 'win') notes.push('daily not won: ' + dm);
    console.log(`tonight's roost: ${dn}x${dn}, ready in ${dms} ms, ${dm}`);
    await page.evaluate(() => window.__game.startSpec(window.__game.spec('deep', 3))); await sleep(200);
    const dp = await page.evaluate(() => { const g = window.__game; return { N: g.N, SOL: g.SOL, cc: Array.from({ length: g.N * g.N }, (_, i) => g.cellCenter(i)) }; });
    for (const c of dp.SOL) { await tap(dp.cc[c][0], dp.cc[c][1]); await sleep(80); await tap(dp.cc[c][0], dp.cc[c][1]); await sleep(200); }
    await sleep(1600 + dp.N * 130);
    const dpm = await page.evaluate(() => window.__game.mode); if (dpm !== 'win') notes.push('deep not won: ' + dpm);
    console.log(`deep wood 4: ${dp.N}x${dp.N}, ${dpm}`);
    console.log('scenarios: ' + (notes.length ? 'FAIL ' + notes.join('; ') : 'OK (slow taps, 160ms double-tap, fail+revive, hint-guided solve, Library chip, daily, deep wood)'));
    ok = ok && !notes.length;
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await b.close(); process.exit(ok && !errors.length ? 0 : 1);
})();
