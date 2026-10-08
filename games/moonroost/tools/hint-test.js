// Listen explanation test: node tools/hint-test.js [baseUrl]
// Part 1 (logic, no browser): walks the full hint-engine solve of every campaign grove, 60 procedural boards and a few
//   chain-only boards; every step's explanation must name a concrete row / column / grove, carry highlight data, stay short,
//   and the highlight must match the deduction (crossed squares == elim, ghost owl == the ruled-out square, emptied line really empties).
// Part 2 (headless Chrome, 390x844 touch): reproduces Ryan's Grove 8 report, then plays several groves using only Listen,
//   checking the on-screen bar (visible, between board and dock, <= 2 lines), the ghost/outline state, the hold-then-commit,
//   tap-to-commit, undo of a committed hint, and the unchanged song economy. SHOTS=dir saves one screenshot per technique.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const { RL, LEVELS } = new Function(src.slice(src.indexOf('/*ROOST-LOGIC-START*/'), src.indexOf('/*ROOST-LOGIC-END*/')) + '\n' +
  src.slice(src.indexOf('/*ROOST-LEVELS-START*/'), src.indexOf('/*ROOST-LEVELS-END*/')) + '\nreturn { RL: RL, LEVELS: LEVELS };')();
const C = ['blue', 'purple', 'green', 'orange', 'yellow', 'pink', 'teal', 'indigo', 'brown', 'lime'];
const nm = { reg: i => '<b>' + C[i % 10] + '</b>' };
const plain = t => t.replace(/<[^>]*>/g, '');
const results = []; const check = (name, cond, extra) => { results.push([name, !!cond]); console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra !== undefined ? '  (' + extra + ')' : ''}`); };
const CONCRETE = /\b(row|column)s? \d|\b(blue|purple|green|orange|yellow|pink|teal|indigo|brown|lime)\b/i;
const tally = {}, bad = [], samples = {}; let maxLen = 0, maxText = '';
function walk(str, label) {
  const b = RL.parse(str); b.U = RL.units(b); const st = new RL.State(b); const n = b.n;
  for (let g = 0; g < 400 && !st.solved(); g++) {
    const s = RL.next(st, 10); if (!s || s.tech === 'dead') { bad.push(label + ': engine stuck'); return; }
    const d = RL.describe(st, s, nm), t = plain(d.text), units = d.focus.length + d.into.length + d.empty.length, cells = d.ghost.length + d.shadeStrong.length + d.targets.length;
    tally[s.tech] = (tally[s.tech] || 0) + 1; if (!samples[s.tech]) samples[s.tech] = t;
    if (t.length > maxLen) { maxLen = t.length; maxText = t; }
    const why = [];
    if (!CONCRETE.test(t)) why.push('names nothing concrete');
    if (/undefined|NaN|\[object/.test(d.text)) why.push('bad interpolation');
    if (!units) why.push('no highlighted row/column/grove');
    if (!cells) why.push('no highlighted cells');
    if (t.length > 125) why.push('too long ' + t.length);
    if (s.elim) { const E = new Set(s.elim);
      if (/^confine/.test(s.tech) && (d.shadeStrong.length !== E.size || !d.shadeStrong.every(c => E.has(c)))) why.push('crossed squares != elim');
      if ((s.tech === 'crowd' || s.tech === 'chain') && (d.ghost[0] !== s.from || !E.has(s.from))) why.push('ghost owl not on the ruled-out square'); }
    if (s.tech === 'crowd') { const u = d.empty[0]; if (!u || !st.cands(u).every(c => RL.blocks(b, s.from, c))) why.push('emptied unit is not actually emptied'); }
    if (s.tech === 'chain' && !d.empty.length) why.push('chain without the line that runs dry');
    if (s.tech === 'single' && d.ghost[0] !== s.place) why.push('single ghost not on the answer');
    if (why.length) bad.push(`${label} step ${g + 1} ${s.tech}: ${why.join(', ')} :: ${t}`);
    RL.apply(st, s);
  }
}
LEVELS.forEach((s, i) => walk(s, 'grove ' + (i + 1)));
function genBand(n, seed, lo, hi) { for (let s = 0; s < 4000; s++) { const g = RL.generate(n, (seed + s * 977) >>> 0, { maxTech: 6 }); if (g && g.grade.score >= lo && g.grade.score <= hi) return g.str; } return RL.generate(n, seed, { maxTech: 10 }).str; }
function seedOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
for (let d = 0; d < 40; d++) { const key = new Date(Date.UTC(2026, 9, 7 + d, 12)).toISOString().slice(0, 10); walk(genBand([8, 7, 8, 9, 8, 9, 10][new Date(key + 'T12:00:00').getDay()], seedOf('moonroost' + key), 40, 140), 'night ' + key); }
for (let i = 0; i < 20; i++) walk(genBand([8, 9, 10][i % 3], 0x5eed + i * 104729, 55, 140), 'deep ' + i);
// chain steps are rare in shipped content; hunt boards that need them so their text is exercised too
const chainBoards = [];
for (let seed = 1; seed < 4000 && chainBoards.length < 8; seed++) { const g = RL.generate(8, seed, { maxTech: 10 }); if (!g || !g.grade.counts.chain) continue; chainBoards.push(g.str); walk(g.str, 'chain-board ' + seed); }
console.log('techniques seen:', JSON.stringify(tally));
Object.keys(samples).forEach(k => console.log('  ' + k.padEnd(9) + samples[k]));
console.log('longest (' + maxLen + '): ' + maxText);
check('every technique type was exercised (single, confine1-3, crowd, chain)', ['single', 'confine1', 'confine2', 'confine3', 'crowd', 'chain'].every(k => tally[k]), Object.keys(tally).join(','));
check(`every explanation names a concrete row/column/grove, has highlights, matches its deduction (${Object.values(tally).reduce((a, b) => a + b, 0)} steps)`, !bad.length, bad.slice(0, 5).join(' | '));

(async () => {
  const puppeteer = require('puppeteer-core');
  const BASE = process.argv[2] || 'http://127.0.0.1:8765/games/moonroost/';
  const SHOTS = process.env.SHOTS; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const br = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await br.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await page.target().createCDPSession();
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  const tap = async (x, y) => { await touch('touchStart', x, y); await sleep(25); await touch('touchEnd'); };
  const tapEl = async sel => { const r = await page.$eval(sel, e => { const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }); await tap(r[0], r[1]); };
  const g = (f, ...a) => page.evaluate(f, ...a);
  await page.goto(BASE + '?from=arcade', { waitUntil: 'networkidle0' });
  await g(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
  const barState = () => g(() => { const G = window.__game, el = document.getElementById('hintbar'), r = el.getBoundingClientRect(), dock = document.getElementById('dock').getBoundingClientRect(), fx = G.hintFx;
    const lh = parseFloat(getComputedStyle(el).lineHeight), pad = parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom);
    return { on: el.classList.contains('on'), text: el.innerText, top: r.top, bottom: r.bottom, lines: Math.round((r.height - pad - 2) / lh), boardBottom: G.G.oy + G.G.size, dockTop: dock.top,
      fx: fx && { mode: fx.mode, committed: fx.committed, ghost: fx.ghost.slice(), units: fx.focus.length + fx.into.length + fx.empty.length, cells: fx.ghost.length + fx.shade.length + fx.shadeStrong.length + fx.rings.length, elim: fx.elim.slice() } }; });

  // A) Ryan's Grove 8 state
  await g(() => { const G = window.__game; G.setListen(2); G.unlockAll(); G.startSpec(G.spec('camp', 7)); }); await sleep(400);
  await g(() => { const G = window.__game, n = G.N; [[0, 0], [1, 0], [2, 0], [3, 0], [4, 1], [5, 1]].forEach(([r, c]) => { G.mark[r * n + c] = 1; }); });
  await tapEl('#tHint'); await sleep(700);
  let bs = await barState();
  check('Grove 8: Listen explains the (row 2, col 2) cross by naming column 3', /column 3/.test(bs.text) && /touches 2/.test(bs.text) && /blue grove/.test(bs.text), bs.text);
  check('Grove 8: ghost owl on row 2 col 2, column 3 outlined, not yet crossed (held)', bs.fx && bs.fx.ghost[0] === 7 && !bs.fx.committed && await g(() => window.__game.mark[7]) === 0 && bs.fx.units === 1);
  check('Grove 8: bar sits between board and dock, <= 2 lines', bs.on && bs.top >= bs.boardBottom && bs.bottom <= bs.dockTop && bs.lines <= 2, `top ${bs.top} board ${bs.boardBottom} bottom ${bs.bottom} dock ${bs.dockTop} lines ${bs.lines}`);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/grove8-crowd.png' });
  await sleep(3300);
  check('hold then commit: the X lands by itself after ~3.6s', await g(() => window.__game.mark[7]) === 1 && (await barState()).fx.committed);
  check('song economy unchanged: one Listen cost one song (2 -> 1)', await g(() => window.__game.listen) === 1);
  await g(() => window.__game.undo()); await sleep(80);
  check('undo removes the hint\'s cross', await g(() => window.__game.mark[7]) === 0);
  // tap-to-commit: tapping the ghost square during the hold crosses it (and does not toggle it back off)
  await tapEl('#tHint'); await sleep(500);
  const cc7 = await g(() => window.__game.cellCenter(7)); await tap(cc7[0], cc7[1]); await sleep(150);
  check('tap during the hold commits now; tapping the ghost square leaves it crossed', await g(() => window.__game.mark[7]) === 1 && (await barState()).fx.committed);
  // tap elsewhere during the hold: commits AND the tap still crosses the square you touched
  await g(() => { const G = window.__game; G.setListen(5); G.startSpec(G.spec('camp', 11)); }); await sleep(350);
  await tapEl('#tHint'); await sleep(400); bs = await barState();
  if (bs.fx && bs.fx.elim.length) { const free = await g(e => { const G = window.__game; for (let i = 0; i < G.N * G.N; i++) if (!G.SOL.includes(i) && !G.mark[i] && !e.includes(i)) return i; return -1; }, bs.fx.elim);
    const p = await g(i => window.__game.cellCenter(i), free); await tap(p[0], p[1]); await sleep(150);
    const st = await g((i, e) => ({ m: window.__game.mark[i], e: e.every(c => window.__game.mark[c] === 1) }), free, bs.fx.elim);
    check('tap elsewhere during the hold: hint commits and your tap still counts', st.m === 1 && st.e); }

  // B) Listen-only solves: every bar must be concrete, highlighted and fit
  const levels = [[0, 'camp', 0], [1, 'camp', 7], [2, 'camp', 11], [3, 'camp', 21], [4, 'camp', 35], [5, 'deep', 2]];
  const seenTech = {}; let steps = 0; const barBad = [];
  const runBoard = async (startExpr, label) => {
    await page.evaluate(startExpr); await sleep(350);
    for (let k = 0; k < 160 && await g(() => window.__game.mode) === 'play'; k++) {
      await g(() => window.__game.setListen(9));
      await g(() => { window.__hintLog = []; }); await tapEl('#tHint'); await sleep(260);
      const log = await g(() => window.__hintLog[0]); const b2 = await barState(); steps++;
      if (!log) { barBad.push(label + ': no hint'); break; }
      const t = b2.text; seenTech[log.tech] = (seenTech[log.tech] || 0) + 1;
      const why = [];
      if (!b2.on) why.push('bar hidden'); if (!CONCRETE.test(t)) why.push('nothing concrete'); if (!b2.fx || !b2.fx.units || !b2.fx.cells) why.push('no highlight');
      if (b2.top < b2.boardBottom - 1 || b2.bottom > b2.dockTop + 1) why.push(`overlaps (top ${b2.top} board ${b2.boardBottom})`); if (b2.lines > 2) why.push(b2.lines + ' lines');
      if (why.length) barBad.push(`${label} ${log.tech}: ${why.join(',')} :: ${t}`);
      if (SHOTS && seenTech[log.tech] === 1) { await sleep(500); await page.screenshot({ path: `${SHOTS}/${log.tech}.png` }); }
      if (log.tech === 'single') { const p = await g(c => window.__game.cellCenter(c), log.targets[0]); await tap(p[0], p[1]); await sleep(90); await tap(p[0], p[1]); await sleep(260); }
      else { await g(() => window.__game.commitHint()); await sleep(60); }
    }
    return g(() => window.__game.mode);
  };
  for (const [_, kind, idx] of levels) { const m = await runBoard(`window.__game.startSpec(window.__game.spec('${kind}', ${idx}))`, `${kind} ${idx + 1}`); await sleep(2400);
    check(`${kind} ${idx + 1}: solved using only Listen`, ['won', 'win'].includes(await g(() => window.__game.mode)), m); }
  for (const [i, str] of chainBoards.slice(0, 2).entries()) { await runBoard(`window.__game.startSpec({ kind: 'deep', idx: ${900 + i}, str: '${str}', label: 'TEST' })`, 'chain-board ' + i); await sleep(2400);
    check(`chain board ${i + 1}: solved using only Listen`, ['won', 'win'].includes(await g(() => window.__game.mode))); }
  console.log('in-game techniques:', JSON.stringify(seenTech));
  check(`every in-game hint bar (${steps}) is visible, concrete, highlighted, between board and dock, <= 2 lines`, !barBad.length, barBad.slice(0, 6).join(' | '));
  const fails = results.filter(r => !r[1]).length;
  console.log(`\n${results.length - fails}/${results.length} hint checks passed`);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await br.close(); process.exit(!fails && !errors.length ? 0 : 1);
})();
