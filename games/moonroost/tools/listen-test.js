// Listen-charge ("songs") economy test: node tools/listen-test.js [baseUrl]
// Real CDP touch on a 390x844 phone viewport. Checks the starter balance, spending, the empty state + toast, flawless awards
// (+1 once per campaign grove / nightly date / deep board), the cap, migration of pre-charge saves, and that undo still works.
// SHOTS=dir saves moonroost-listen-*.png screenshots.
const puppeteer = require('puppeteer-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/games/moonroost/';
const SHOTS = process.env.SHOTS;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await b.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await page.target().createCDPSession();
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const tap = async (x, y) => { await touch('touchStart', x, y); await sleep(25); await touch('touchEnd'); };
  const tapEl = async sel => { const r = await page.$eval(sel, e => { const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }); await tap(r[0], r[1]); };
  const g = expr => page.evaluate(expr);
  const results = []; const check = (name, cond, extra) => { results.push([name, !!cond, extra]); console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra !== undefined ? '  (' + extra + ')' : ''}`); };
  const fresh = async (saveObj) => {
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await page.evaluate(s => { localStorage.clear(); if (s) localStorage.setItem('moonroost-v1', JSON.stringify(s)); }, saveObj || null);
    await page.reload({ waitUntil: 'networkidle0' }); await sleep(150);
  };
  const start = async (kind, idx) => { await page.evaluate((k, i) => window.__game.startSpec(window.__game.spec(k, i)), kind, idx); await sleep(350); };
  const board = () => g(() => { const G = window.__game; return { N: G.N, SOL: G.SOL, cc: Array.from({ length: G.N * G.N }, (_, i) => G.cellCenter(i)) }; });
  const solveFlawless = async (shot) => {
    const { N, SOL, cc } = await board();
    for (const c of SOL) { await tap(cc[c][0], cc[c][1]); await sleep(80); await tap(cc[c][0], cc[c][1]); await sleep(220); }
    for (let k = 0; k < 60 && await g(() => window.__game.mode) !== 'win'; k++) await sleep(100);
    await sleep(1150); if (shot) await page.screenshot({ path: shot });
    await sleep(500);
  };
  const winSong = () => g(() => ({ cls: document.getElementById('winSong').className, txt: document.getElementById('winSongTxt').textContent, n: document.getElementById('winSongN').textContent, mode: window.__game.mode }));
  const badge = () => g(() => ({ n: document.getElementById('hintN').textContent, empty: document.getElementById('tHint').classList.contains('empty') }));
  const tk = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }).catch(() => null);

  // 1) brand-new player
  await fresh();
  check('new player starts with 3 songs', await g(() => window.__game.listen) === 3);
  await start('camp', 0);
  let bd = await badge(); check('badge shows 3 on the Listen button', bd.n === '3' && !bd.empty, JSON.stringify(bd));
  if (SHOTS) await page.screenshot({ path: SHOTS + '/moonroost-listen-badge.png' });
  // 2) spending via a real touch on the button
  await tapEl('#tHint'); await sleep(500);
  check('Listen tap decrements 3 -> 2', await g(() => window.__game.listen) === 2 && (await badge()).n === '2' && await g(() => window.__game.hints) === 1);
  // wrong-cross correction path also costs a song
  { const { cc } = await board(); const free = await g(() => window.__game.SOL.find(c => !window.__game.owl[c] && !window.__game.mark[c]));
    await tap(cc[free][0], cc[free][1]); await sleep(420);
    const m = await g(`window.__game.mark[${free}]`);
    await tapEl('#tHint'); await sleep(400);
    check('cross-on-needed-perch correction costs a song (2 -> 1) and clears it', m === 1 && await g(`window.__game.mark[${free}]`) === 0 && await g(() => window.__game.listen) === 1); }
  // undo still works after Listen
  { const { SOL, N, cc } = await board(); const non = await g(() => { const G = window.__game; for (let i = 0; i < G.N * G.N; i++) if (!G.SOL.includes(i) && !G.mark[i]) return i; return -1; });
    await tap(cc[non][0], cc[non][1]); await sleep(420); const m1 = await g(`window.__game.mark[${non}]`);
    await page.evaluate(() => window.__game.undo()); await sleep(100);
    check('undo still works alongside Listen', m1 === 1 && await g(`window.__game.mark[${non}]`) === 0); }
  await tapEl('#tHint'); await sleep(400);
  bd = await badge(); check('last song spent -> 0, button shows empty', await g(() => window.__game.listen) === 0 && bd.n === '0' && bd.empty, JSON.stringify(bd));
  const hintsAt0 = await g(() => window.__game.hints);
  await tapEl('#tHint'); await sleep(450);
  const t = await g(() => ({ on: document.getElementById('toast').classList.contains('on'), txt: document.getElementById('toast').textContent }));
  check('at 0, Listen is blocked (no hint, no negative balance)', await g(() => window.__game.hints) === hintsAt0 && await g(() => window.__game.listen) === 0);
  check('at 0, an in-theme toast explains how to earn more', t.on && /flawlessly/.test(t.txt) && /\+1 Listen/.test(t.txt) && /logic/.test(t.txt), t.txt.slice(0, 60) + '…');
  if (SHOTS) await page.screenshot({ path: SHOTS + '/moonroost-listen-empty.png' });
  await page.keyboard.press('h'); await sleep(100);
  check('keyboard h is gated too', await g(() => window.__game.hints) === hintsAt0);
  // finish grove 1 with hints -> no award, "Listen is quiet" nudge
  await solveFlawless();
  let ws = await winSong();
  check('non-flawless win awards nothing', await g(() => window.__game.listen) === 0 && ws.mode === 'win' && /quiet/.test(ws.txt), ws.txt);
  // 3) first flawless clear of grove 2 -> +1, with win-screen animation
  await start('camp', 1);
  await solveFlawless(SHOTS && SHOTS + '/moonroost-listen-win.png');
  ws = await winSong();
  check('first flawless clear of a grove awards +1 (0 -> 1)', await g(() => window.__game.listen) === 1 && /new/.test(ws.cls) && /\+1 Listen/.test(ws.txt) && ws.n === '1', JSON.stringify(ws));
  // 4) replay the same grove flawlessly -> no award
  await page.evaluate(() => document.getElementById('bWinReplay').click()); await sleep(350);
  check('badge carries the earned song into play', (await badge()).n === '1');
  await solveFlawless();
  ws = await winSong();
  check('flawless replay of the same grove does not award again', await g(() => window.__game.listen) === 1 && /already know/.test(ws.txt) && !/new/.test(ws.cls), ws.txt);
  // persists across reload
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(150);
  check('balance persists across reload', await g(() => window.__game.listen) === 1);
  // 5) tonight's roost: once per date
  await start('night', tk); await solveFlawless(); ws = await winSong();
  const st1 = await g(() => JSON.parse(localStorage.getItem('moonroost-v1')).daily);
  check("tonight's roost flawless awards +1 (1 -> 2), streak intact", await g(() => window.__game.listen) === 2 && /new/.test(ws.cls) && st1.streak === 1 && st1.song === tk, JSON.stringify({ streak: st1.streak, song: st1.song }));
  await start('night', tk); await solveFlawless(); ws = await winSong();
  check("tonight's roost replay does not award again", await g(() => window.__game.listen) === 2 && /already yours/.test(ws.txt), ws.txt);
  // 6) deep wood: once per board
  await start('deep', 0); await solveFlawless(); ws = await winSong();
  check('deep wood board flawless awards +1 (2 -> 3)', await g(() => window.__game.listen) === 3 && /new/.test(ws.cls));
  await start('deep', 0); await solveFlawless();
  check('deep wood replay does not award again', await g(() => window.__game.listen) === 3);
  // 7) cap
  await page.evaluate(() => window.__game.setListen(9));
  await start('camp', 2); await solveFlawless(); ws = await winSong();
  check('cap: at 9 a fresh flawless clear stays 9 ("ears are full")', await g(() => window.__game.listen) === 9 && /full/.test(ws.txt), ws.txt);
  // 8) migration of a pre-Listen save (with existing flawless marks + best times + streak)
  const old = { unlocked: 5, best: { 0: 31, 1: 44, 2: 52, 3: 60 }, flaw: { 0: 1, 2: 1 }, sound: true, auto: true, seenHow: true, daily: { last: '2026-10-06', streak: 4, best: { '2026-10-06': 120 } }, cur: 3 };
  await fresh(old);
  check('old save migrates: starter 3 songs, progress kept', await g(() => window.__game.listen) === 3 && await g(() => JSON.stringify(window.__game.SP)) === 'null');
  await start('camp', 0); await solveFlawless(); ws = await winSong();
  check('old save: grove already flawless before update does not award', await g(() => window.__game.listen) === 3 && /already know/.test(ws.txt));
  const sv = await g(() => JSON.parse(localStorage.getItem('moonroost-v1')));
  check('old save: best times, unlocks, streak untouched', sv.best['1'] === 44 && sv.unlocked === 5 && sv.daily.streak === 4 && sv.flaw['2'] === 1, JSON.stringify({ unlocked: sv.unlocked, streak: sv.daily.streak }));
  await start('camp', 1); await solveFlawless();
  check('old save: grove cleared but never flawless awards +1 (3 -> 4)', await g(() => window.__game.listen) === 4);
  // tampered value is clamped
  await fresh({ listen: 400, unlocked: 1 });
  check('corrupt/oversized balance clamps to cap', await g(() => window.__game.listen) === 9);
  await fresh({ listen: 0, unlocked: 1 });
  check('a saved 0 stays 0 (no re-granting the starter)', await g(() => window.__game.listen) === 0);

  const fails = results.filter(r => !r[1]).length;
  console.log(`\n${results.length - fails}/${results.length} listen checks passed`);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await b.close(); process.exit(!fails && !errors.length ? 0 : 1);
})();
