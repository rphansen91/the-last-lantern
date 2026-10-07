// Renders PWA icons with headless Chrome. node tools/icons.js
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path');
const html = `<canvas id=c></canvas><script>
function owl(ctx,s){ctx.fillStyle='#10131c';[-1,1].forEach(d=>{ctx.save();ctx.translate(d*s*.28,s*.02);ctx.rotate(d*.25);ctx.beginPath();ctx.ellipse(d*s*.04,s*.1,s*.13,s*.27,0,0,7);ctx.fill();ctx.restore();});
const bg=ctx.createLinearGradient(0,-s*.4,0,s*.45);bg.addColorStop(0,'#252c44');bg.addColorStop(1,'#0f1119');ctx.fillStyle=bg;ctx.beginPath();ctx.moveTo(0,-s*.36);
ctx.bezierCurveTo(s*.36,-s*.36,s*.38,s*.12,s*.26,s*.34);ctx.quadraticCurveTo(0,s*.48,-s*.26,s*.34);ctx.bezierCurveTo(-s*.38,s*.12,-s*.36,-s*.36,0,-s*.36);ctx.fill();
ctx.beginPath();ctx.moveTo(-s*.3,-s*.2);ctx.lineTo(-s*.31,-s*.48);ctx.lineTo(-s*.1,-s*.33);ctx.closePath();ctx.moveTo(s*.3,-s*.2);ctx.lineTo(s*.31,-s*.48);ctx.lineTo(s*.1,-s*.33);ctx.closePath();ctx.fill();
ctx.fillStyle='#2a3044';ctx.beginPath();ctx.ellipse(-s*.13,-s*.1,s*.145,s*.14,0,0,7);ctx.ellipse(s*.13,-s*.1,s*.145,s*.14,0,0,7);ctx.fill();
[-1,1].forEach(d=>{ctx.save();ctx.translate(d*s*.13,-s*.1);ctx.shadowColor='rgba(255,200,90,.9)';ctx.shadowBlur=s*.25;const eg=ctx.createRadialGradient(0,-s*.02,0,0,0,s*.11);eg.addColorStop(0,'#ffe39a');eg.addColorStop(1,'#e8962a');ctx.fillStyle=eg;ctx.beginPath();ctx.arc(0,0,s*.105,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#07070b';ctx.beginPath();ctx.arc(0,s*.01,s*.052,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*.02,-s*.015,s*.018,0,7);ctx.fill();ctx.restore();});
ctx.fillStyle='#c98b3c';ctx.beginPath();ctx.moveTo(-s*.04,-s*.03);ctx.lineTo(s*.04,-s*.03);ctx.lineTo(0,s*.06);ctx.closePath();ctx.fill();}
window.render=function(S,pad){const c=document.getElementById('c');c.width=c.height=S;const g=c.getContext('2d');
const gr=g.createLinearGradient(0,0,0,S);gr.addColorStop(0,'#16163a');gr.addColorStop(1,'#08080f');g.fillStyle=gr;g.fillRect(0,0,S,S);
const m=S*pad,cs=(S-2*m)/3,cols=['#3d7bb0','#8d5fb8','#4d9c62','#8d5fb8','#5c68d6','#4d9c62','#c4713f','#c4713f','#2c9e98'];
if(S>=64){for(let i=0;i<9;i++){g.fillStyle=cols[i];g.globalAlpha=.85;g.fillRect(m+(i%3)*cs,m+((i/3)|0)*cs,cs+.5,cs+.5);}g.globalAlpha=1;
g.strokeStyle='#0a0a13';g.lineWidth=S*.02;for(let k=1;k<3;k++){g.beginPath();g.moveTo(m+k*cs,m);g.lineTo(m+k*cs,S-m);g.moveTo(m,m+k*cs);g.lineTo(S-m,m+k*cs);g.stroke();}
g.lineWidth=S*.03;g.strokeRect(m,m,S-2*m,S-2*m);
const mg=g.createRadialGradient(S*.5,S*.45,0,S*.5,S*.5,S*.6);mg.addColorStop(0,'rgba(255,230,160,.25)');mg.addColorStop(1,'rgba(0,0,0,.25)');g.fillStyle=mg;g.fillRect(0,0,S,S);}
g.save();g.translate(S/2,S*.52);owl(g,S>=64?S*.62:S*.95);g.restore();return c.toDataURL('image/png');};</script>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setContent(html);
  for (const [name, s, pad] of [['icon-192.png', 192, .1], ['icon-512.png', 512, .1], ['icon-maskable-512.png', 512, .2], ['apple-touch-icon.png', 180, .1], ['favicon-32.png', 32, .1]]) {
    const url = await p.evaluate((s, pad) => window.render(s, pad), s, pad);
    fs.writeFileSync(path.join(__dirname, '../icons', name), Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close(); console.log('icons written');
})();
