#!/usr/bin/env node
/**
 * Gloamglass solvability checker.
 * Usage: node tools/solve.js [path/to/index.html]
 * Extracts GLOAM-LOGIC and GLOAM-LEVELS blocks and BFS/A*-validates every loft.
 * Every level must be solvable WITHOUT the Extra Phial booster.
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, '../index.html');
const src = fs.readFileSync(file, 'utf8');
const logic = src.slice(src.indexOf('/*GLOAM-LOGIC-START*/'), src.indexOf('/*GLOAM-LOGIC-END*/') + '/*GLOAM-LOGIC-END*/'.length);
const levels = src.slice(src.indexOf('/*GLOAM-LEVELS-START*/'), src.indexOf('/*GLOAM-LEVELS-END*/') + '/*GLOAM-LEVELS-END*/'.length);
if (!logic || logic.indexOf('GLOAM-LOGIC-START') < 0) {
  console.error('Missing GLOAM-LOGIC block in', file);
  process.exit(2);
}
const { GG, LEVELS, CAP } = new Function(logic + '\n' + levels + '\nreturn { GG: GG, LEVELS: LEVELS, CAP: CAP };')();

function validate(L) {
  const errs = [];
  if (!L.bottles || !L.bottles.length) errs.push('no bottles');
  const cnt = {};
  let empties = 0;
  for (const b of L.bottles) {
    if (!Array.isArray(b)) { errs.push('bad bottle'); continue; }
    if (b.length > CAP) errs.push('overfull bottle');
    if (!b.length) empties++;
    for (const c of b) {
      if (!Number.isInteger(c) || c < 1) errs.push('bad color ' + c);
      cnt[c] = (cnt[c] || 0) + 1;
    }
  }
  for (const c of Object.keys(cnt)) {
    if (cnt[c] !== CAP) errs.push('color ' + c + ' has ' + cnt[c] + ' units (need ' + CAP + ')');
  }
  if (empties < 1) errs.push('need at least one empty phial');
  return errs;
}

const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
let bad = 0;
LEVELS.forEach((L, i) => {
  if (only && !only.includes(i + 1)) return;
  const errs = validate(L);
  if (errs.length) {
    bad++;
    console.log(String(i + 1).padStart(2), (L.name || '').padEnd(16), 'INVALID', errs.join('; '));
    return;
  }
  const t0 = Date.now();
  const r = GG.solve(L.bottles, { maxNodes: i < 12 ? 250000 : 800000 });
  if (!r.ok) bad++;
  const empty = L.bottles.filter(b => !b.length).length;
  const cols = new Set();
  L.bottles.forEach(b => b.forEach(c => cols.add(c)));
  console.log(
    String(i + 1).padStart(2),
    (L.name || '').padEnd(16),
    r.ok ? 'SOLVABLE' : 'FAIL    ',
    'opt', String(r.moves ?? '-').padStart(3),
    'c' + cols.size + 'e' + empty,
    'budget', L.moves ? L.moves : '-',
    (L.tier || 'normal').padEnd(5),
    'nodes', r.nodes,
    (Date.now() - t0) + 'ms',
    r.reason || ''
  );
  if (r.ok && L.moves > 0 && r.moves > L.moves) {
    console.log('   WARN move budget', L.moves, '< optimal', r.moves);
  }
});
console.log(bad ? bad + ' BAD' : 'ALL ' + (only ? only.length : LEVELS.length) + ' LEVELS SOLVABLE (no Extra Phial)');
process.exit(bad ? 1 : 0);
