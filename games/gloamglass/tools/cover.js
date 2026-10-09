// Cover art for catalog. node tools/cover.js
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path');
const html = `<canvas id=c></canvas><script>
window.render=function(W,H){
  const c=document.getElementById('c');c.width=W;c.height=H;const ctx=c.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#182234');bg.addColorStop(.55,'#0a0e18');bg.addColorStop(1,'#06080e');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  const rg=ctx.createRadialGradient(W*.5,H*.2,0,W*.5,H*.3,W*.6);
  rg.addColorStop(0,'rgba(122,212,196,.18)');rg.addColorStop(1,'transparent');ctx.fillStyle=rg;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(122,212,196,.85)';ctx.font='600 '+Math.floor(W*.045)+'px system-ui';ctx.textAlign='center';
  ctx.letterSpacing='.35em';ctx.fillText('GLOAMGLASS',W/2,H*.16);
  const bottles=[[1,1,2,3],[3,2,2,1],[],[1,3,2,3],[2,1,3,1]];
  const cols=['','#7ad4c4','#c4adff','#ff8fab','#ffd27a'];
  const pw=W*.12,ph=pw*2.45,gap=W*.03,total=bottles.length*(pw+gap)-gap;
  let x0=(W-total)/2,y0=H*.38;
  bottles.forEach((bot,i)=>{
    const x=x0+i*(pw+gap),y=y0+(i===2?-12:0);
    // glass
    ctx.beginPath();
    const r=pw*.12,bx=x+pw*.12,bw=pw*.76,by=y+ph*.12,bh=ph*.88;
    ctx.moveTo(bx+r,by);ctx.lineTo(bx+bw-r,by);ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+r);
    ctx.lineTo(bx+bw,by+bh-r);ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-r,by+bh);
    ctx.lineTo(bx+r,by+bh);ctx.quadraticCurveTo(bx,by+bh,bx,by+bh-r);
    ctx.lineTo(bx,by+r);ctx.quadraticCurveTo(bx,by,bx+r,by);
    ctx.fillStyle='rgba(170,210,220,.12)';ctx.fill();
    ctx.strokeStyle='rgba(190,230,240,.5)';ctx.lineWidth=2;ctx.stroke();
    const unit=(bh-6)/4;
    bot.forEach((c,li)=>{
      const yy=by+bh-4-(li+1)*unit;
      ctx.fillStyle=cols[c];ctx.fillRect(bx+4,yy,bw-8,unit+.5);
      ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(bx+6,yy+1,bw-12,Math.max(2,unit*.2));
    });
    ctx.strokeStyle='#7ad4c4';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x+pw*.28,y);ctx.lineTo(x+pw*.72,y);
    ctx.quadraticCurveTo(x+pw*.82,y+ph*.1,x+pw*.72,by);ctx.lineTo(x+pw*.28,by);
    ctx.quadraticCurveTo(x+pw*.18,y+ph*.1,x+pw*.28,y);ctx.stroke();
  });
  ctx.fillStyle='rgba(180,200,210,.7)';ctx.font='400 '+Math.floor(W*.032)+'px system-ui';
  ctx.fillText('Pour night-inks until every phial holds one hue',W/2,H*.88);
  return c.toDataURL('image/png');
};
</script>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setContent(html);
  const dir = path.join(__dirname, '../screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const url = await p.evaluate(() => window.render(1200, 630));
  fs.writeFileSync(path.join(dir, 'cover.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close(); console.log('cover written');
})();
