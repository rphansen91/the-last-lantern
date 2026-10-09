// Renders PWA icons with headless Chrome. node tools/icons.js
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path');
const html = `<canvas id=c></canvas><script>
function phial(ctx,s){
  const g=ctx.createRadialGradient(0,0,0,0,0,s*.55);g.addColorStop(0,'rgba(122,212,196,.3)');g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,s*.55,0,7);ctx.fill();
  const w=s*.42,h=s*.78,x=-w/2,y=-h*.48;
  ctx.beginPath();
  const r=w*.16;
  ctx.moveTo(x+r,y+h*.14);ctx.lineTo(x+w-r,y+h*.14);
  ctx.quadraticCurveTo(x+w,y+h*.14,x+w,y+h*.14+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+h*.14+r);ctx.quadraticCurveTo(x,y+h*.14,x+r,y+h*.14);
  const glass=ctx.createLinearGradient(x,y,x+w,y);
  glass.addColorStop(0,'rgba(190,230,240,.22)');glass.addColorStop(.5,'rgba(100,160,180,.08)');glass.addColorStop(1,'rgba(190,230,240,.18)');
  ctx.fillStyle=glass;ctx.fill();
  ctx.strokeStyle='rgba(200,230,240,.55)';ctx.lineWidth=s*.02;ctx.stroke();
  const cols=['#7ad4c4','#c4adff','#ff8fab','#ffd27a'];
  const unit=(h*.72)/4, bx=x+w*.12, bw=w*.76, base=y+h-s*.015;
  for(let i=0;i<4;i++){
    const yy=base-(i+1)*unit;
    const lg=ctx.createLinearGradient(bx,yy,bx+bw,yy);
    lg.addColorStop(0,cols[i]);lg.addColorStop(.55,cols[i]);lg.addColorStop(1,'#fff8');
    ctx.fillStyle=lg;ctx.fillRect(bx,yy,bw,unit+.6);
    ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(bx+2,yy+1,bw-4,Math.max(1,unit*.2));
  }
  ctx.strokeStyle='#7ad4c4';ctx.lineWidth=s*.022;
  ctx.beginPath();ctx.moveTo(x+w*.2,y);ctx.lineTo(x+w*.8,y);
  ctx.quadraticCurveTo(x+w*.9,y+h*.12,x+w*.78,y+h*.14);
  ctx.lineTo(x+w*.22,y+h*.14);ctx.quadraticCurveTo(x+w*.1,y+h*.12,x+w*.2,y);ctx.stroke();
}
window.render=function(S,pad){
  const c=document.getElementById('c');c.width=c.height=S;const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,S);gr.addColorStop(0,'#151c2c');gr.addColorStop(1,'#080b12');
  g.fillStyle=gr;g.fillRect(0,0,S,S);
  g.save();g.translate(S/2,S/2);g.scale(1-2*pad,1-2*pad);phial(g,S);g.restore();
  return c.toDataURL('image/png');
};
</script>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setContent(html);
  const dir = path.join(__dirname, '../icons');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, s, pad] of [['icon-192.png', 192, .1], ['icon-512.png', 512, .1], ['icon-maskable-512.png', 512, .2], ['apple-touch-icon.png', 180, .1], ['favicon-32.png', 32, .08]]) {
    const url = await p.evaluate((s, pad) => window.render(s, pad), s, pad);
    fs.writeFileSync(path.join(dir, name), Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close(); console.log('icons written');
})();
