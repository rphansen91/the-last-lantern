// Cover art from the live game renderer (WebKit). Needs a local server on :8817 serving the repo root.
// node tools/cover.js   (run from /tmp/pw or with NODE_PATH pointing at playwright)
const pw = require('playwright'), path = require('path');
(async () => {
  const b = await pw.webkit.launch();
  const p = await b.newPage({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:8817/games/knotlight/'); await p.waitForTimeout(300);
  await p.evaluate(() => { document.documentElement.classList.add('cover'); Knot.startLevel(11); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:0;right:0;top:26px;text-align:center;z-index:50;font:800 34px system-ui;letter-spacing:.32em;color:#fff4f8;text-shadow:0 0 24px rgba(255,143,177,.55)';
    t.textContent = 'KNOTLIGHT'; document.body.appendChild(t);
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname, '../screenshots/cover.png') });
  await b.close(); console.log('cover written');
})();
