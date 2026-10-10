// Renders PWA icons with headless Chrome. node tools/icons.js
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path');
const html = `<canvas id=c></canvas><script>
function tube(g,cx,cy,R,a0,a1,T,c){
  g.lineCap='round';
  g.globalAlpha=.6;g.strokeStyle='#000';g.lineWidth=T+3;g.beginPath();g.arc(cx+T*.15,cy+T*.4,R,a0,a1);g.stroke();
  g.globalCompositeOperation='lighter';g.globalAlpha=.18;g.strokeStyle=c[0];g.lineWidth=T*2.6;g.beginPath();g.arc(cx,cy,R,a0,a1);g.stroke();g.globalCompositeOperation='source-over';
  g.globalAlpha=1;g.strokeStyle=c[1];g.lineWidth=T+T*.18;g.beginPath();g.arc(cx,cy,R,a0,a1);g.stroke();
  g.strokeStyle=c[0];g.lineWidth=T;g.beginPath();g.arc(cx,cy,R,a0,a1);g.stroke();
  g.globalAlpha=.6;g.strokeStyle=c[2];g.lineWidth=T*.4;g.beginPath();g.arc(cx-T*.1,cy-T*.14,R,a0,a1);g.stroke();g.globalAlpha=1;
}
window.render=function(S,pad){
  const c=document.getElementById('c');c.width=c.height=S;const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,S);gr.addColorStop(0,'#141a3c');gr.addColorStop(1,'#06070f');g.fillStyle=gr;g.fillRect(0,0,S,S);
  const rg=g.createRadialGradient(S*.5,S*.45,0,S*.5,S*.45,S*.6);rg.addColorStop(0,'rgba(255,143,177,.22)');rg.addColorStop(1,'transparent');g.fillStyle=rg;g.fillRect(0,0,S,S);
  const k=1-2*pad, u=S*k, cx=S/2, cy=S/2, T=Math.max(2.5,u*.085), R=u*.24, d=u*.15;
  const D=Math.PI/180;
  tube(g,cx-d,cy,R,(115+32)*D,(115+360-32)*D,T,['#6ec8ff','#1d5d8c','#d8f1ff']);
  tube(g,cx+d,cy,R,(-35+32)*D,(-35+360-32)*D,T,['#ff7aa8','#8c2449','#ffd8e6']);
  // clip at the top crossing
  const px=cx, py=cy-Math.sqrt(R*R-d*d);
  g.save();g.translate(px,py);g.rotate(Math.atan2(py-cy,px-(cx-d))+Math.PI/2);
  const lw=T*1.25,hw=T*.95;const sg=g.createLinearGradient(-lw/2,0,lw/2,0);sg.addColorStop(0,'#8c2449');sg.addColorStop(.3,'#ffd8e6');sg.addColorStop(.6,'#ff7aa8');sg.addColorStop(1,'#8c2449');
  g.fillStyle=sg;g.beginPath();g.roundRect(-lw/2,-hw,lw,hw*2,T*.35);g.fill();g.strokeStyle='rgba(8,8,18,.8)';g.lineWidth=Math.max(1,T*.1);g.stroke();g.restore();
  // a star
  g.fillStyle='#fff';g.globalAlpha=.9;g.beginPath();g.arc(cx+u*.33,cy-u*.36,Math.max(1,u*.018),0,7);g.fill();
  return c.toDataURL('image/png');
};
</script>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setContent(html);
  const dir = path.join(__dirname, '../icons'); fs.mkdirSync(dir, { recursive: true });
  for (const [name, s, pad] of [['icon-192.png', 192, .06], ['icon-512.png', 512, .06], ['icon-maskable-512.png', 512, .18], ['apple-touch-icon.png', 180, .06], ['favicon-32.png', 32, 0]]) {
    const url = await p.evaluate((s, pad) => window.render(s, pad), s, pad);
    fs.writeFileSync(path.join(dir, name), Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close(); console.log('icons written');
})();
