// node tools/make-arcade-icons.js — needs puppeteer-core + Chrome
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'arcade-icons.html'));
  const out = await p.evaluate(() => window.renderAll());
  for (const { name, data } of out) {
    fs.writeFileSync(path.join(__dirname, '..', 'icons', name), Buffer.from(data.split(',')[1], 'base64'));
    console.log('wrote icons/' + name);
  }
  await b.close();
})();
