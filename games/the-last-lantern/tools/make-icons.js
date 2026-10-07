// node tools/make-icons.js  — renders tools/icons.html in headless Chrome and writes the PNGs to icons/
// needs puppeteer-core and Chrome (CHROME=/path/to/chrome); nothing else.
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'icons.html'));
  const out = await p.evaluate(() => window.renderAll());
  for (const { name, data } of out) { fs.writeFileSync(path.join(__dirname, '..', 'icons', name), Buffer.from(data.split(',')[1], 'base64')); console.log('wrote icons/' + name); }
  await b.close();
})();
