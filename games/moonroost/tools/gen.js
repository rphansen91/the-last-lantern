// Picks campaign groves by size + difficulty band. Usage: node tools/gen.js > /tmp/levels.txt
const RL = require('./logic.js');
const PLAN = [ // [n, minScore, maxScore, minMaxCost]
  [5,4,6,0],[5,7,11,0],[5,11,30,2],[6,8,12,0],[6,12,18,2],[6,18,40,3],[7,10,16,0],[6,20,50,3],[7,18,26,2],[7,26,36,3],
  [8,16,24,2],[7,36,60,4],[8,24,32,3],[8,32,42,3],[7,40,70,4],[8,42,55,3],[9,26,36,3],[8,48,70,4],[9,36,46,3],[9,46,56,4],
  [8,52,80,4],[10,36,46,3],[9,52,64,4],[9,56,80,4],[10,46,56,4],[8,56,90,4],[9,60,90,4],[10,54,66,4],[9,64,99,6],[10,60,80,4],
  [10,64,99,4],[9,68,99,6],[10,70,99,4],[10,74,99,6],[9,72,99,6],[10,80,140,6]
];
const out = [], seen = new Set();
PLAN.forEach(([n, lo, hi, mc], i) => {
  for (let s = 1; s < 200000; s++) {
    const g = RL.generate(n, (i + 1) * 100003 + s * 31 + n, { maxTech: 6 });
    if (!g || seen.has(g.str)) continue;
    const { score, maxCost } = g.grade;
    // no 1-cell regions on the first few levels beyond 1, keep shapes chunky
    if (score >= lo && score <= hi && maxCost >= mc) { seen.add(g.str); out.push({ n, s: g.str, score, maxCost, counts: g.grade.counts }); break; }
  }
});
console.error(out.map((o, i) => `${i + 1}: ${o.n}x${o.n} score ${o.score} max ${o.maxCost} ${JSON.stringify(o.counts)}`).join('\n'));
console.log('var LEVELS = [\n' + out.map(o => `  '${o.s}'`).join(',\n') + '\n];');
