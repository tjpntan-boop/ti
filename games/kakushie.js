
(function(){
"use strict";
var KAKVER='2.47.1';
const DW=600, DH=900;
var cv=null, ctx=null;
let scale=1;
var rafId=0, running=false;
function resize(){ if(!cv||!ctx) return;
  var st=cv.parentElement, w=st.clientWidth, h=st.clientHeight, dpr=window.devicePixelRatio||1;
  if(!w||!h) return;
  scale=Math.min(w/DW, h/DH);
  cv.width=Math.max(1,(DW*dpr*scale)|0); cv.height=Math.max(1,(DH*dpr*scale)|0);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0); }
function onResize(){ resize(); }

// ===== レイアウト =====
const GRID=6, PX=60, PY=176, PS=480, CS=PS/GRID;  // 絵の領域＆マス
const KEY='chikuwa_kakushie_best';

// ===== 絵の定義（Android対策でcanvas手描き）=====
function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
const PICS=[
  {id:'bigchi', name:'大きなちくわ', draw:function(x,y,w,h){
    ctx.fillStyle='#f0d8a0'; ctx.fillRect(x,y,w,h);
    const g=ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,'#f6e2b8'); g.addColorStop(.5,'#e8c884'); g.addColorStop(1,'#c79a52');
    ctx.fillStyle=g; rr(x+30,y+h*0.28,w-60,h*0.44,40); ctx.fill();
    ctx.strokeStyle='#a9823f'; ctx.lineWidth=5; ctx.stroke();
    ctx.fillStyle='rgba(150,100,40,.3)';
    for(let i=1;i<7;i++) ctx.fillRect(x+30+i*((w-60)/7)-3,y+h*0.28+4,6,h*0.44-8);
    ctx.fillStyle='#3a2a14';
    ctx.beginPath(); ctx.ellipse(x+50,y+h/2,16,h*0.16,0,0,7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+w-50,y+h/2,16,h*0.16,0,0,7); ctx.fill(); } },
  {id:'banana', name:'バナナ', draw:function(x,y,w,h){
    ctx.fillStyle='#1f7a3a'; ctx.fillRect(x,y,w,h);
    ctx.save(); ctx.translate(x+w/2,y+h/2); ctx.rotate(-0.25);
    ctx.fillStyle='#ffd83b'; ctx.beginPath();
    ctx.moveTo(-150,-40);
    ctx.bezierCurveTo(-60,120,120,120,170,-10);
    ctx.bezierCurveTo(150,30,-40,70,-110,-20);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#e0b100'; ctx.lineWidth=4; ctx.stroke();
    ctx.fillStyle='#6b4a1a'; ctx.beginPath(); ctx.arc(170,-10,12,0,7); ctx.fill();
    ctx.fillStyle='#3a2a10'; ctx.fillRect(-160,-46,18,12);
    ctx.restore(); } },
  {id:'oden', name:'おでん', draw:function(x,y,w,h){
    ctx.fillStyle='#2a3550'; ctx.fillRect(x,y,w,h);
    // 鍋
    ctx.fillStyle='#3a3f4d'; rr(x+30,y+h*0.42,w-60,h*0.5,26); ctx.fill();
    ctx.fillStyle='#caa05a'; rr(x+44,y+h*0.46,w-88,h*0.34,18); ctx.fill(); // つゆ
    // 具：たまご
    ctx.fillStyle='#fff7e0'; ctx.beginPath(); ctx.arc(x+w*0.30,y+h*0.55,40,0,7); ctx.fill();
    // 大根
    ctx.fillStyle='#f2f0e6'; ctx.beginPath(); ctx.arc(x+w*0.60,y+h*0.58,38,0,7); ctx.fill();
    ctx.strokeStyle='#d8d4c0'; ctx.lineWidth=4; ctx.stroke();
    // こんにゃく（三角）
    ctx.fillStyle='#9a9588'; ctx.beginPath();
    ctx.moveTo(x+w*0.78,y+h*0.50); ctx.lineTo(x+w*0.90,y+h*0.70); ctx.lineTo(x+w*0.66,y+h*0.70); ctx.closePath(); ctx.fill();
    // ちくわ（串）
    ctx.strokeStyle='#caa45e'; ctx.lineWidth=22; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x+w*0.18,y+h*0.40); ctx.lineTo(x+w*0.18,y+h*0.72); ctx.stroke();
    ctx.fillStyle='#7a5a2a'; ctx.beginPath(); ctx.arc(x+w*0.18,y+h*0.40,7,0,7); ctx.fill();
    ctx.fillStyle='#cfae6a'; ctx.fillRect(x+w*0.40,y+h*0.30,4,h*0.42); } },
  {id:'tempura', name:'ちくわの天ぷら', draw:function(x,y,w,h){
    ctx.fillStyle='#5a3a20'; ctx.fillRect(x,y,w,h);
    ctx.save(); ctx.translate(x+w/2,y+h/2); ctx.rotate(0.2);
    ctx.fillStyle='#e0a64a'; ctx.beginPath();
    for(let i=0;i<28;i++){ const a=i/28*Math.PI*2; const rr2=150+((i%3)*12)+Math.sin(i)*8;
      const px=Math.cos(a)*rr2, py=Math.sin(a)*rr2*0.78; i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#c8862f'; for(let i=0;i<30;i++){ ctx.beginPath();
      ctx.arc((Math.random()-0.5)*240,(Math.random()-0.5)*180,4+Math.random()*5,0,7); ctx.fill(); }
    // 断面のちくわ穴
    ctx.fillStyle='#f0dca8'; ctx.beginPath(); ctx.ellipse(130,0,30,52,0,0,7); ctx.fill();
    ctx.strokeStyle='#caa45e'; ctx.lineWidth=5; ctx.stroke();
    ctx.fillStyle='#5a3a18'; ctx.beginPath(); ctx.ellipse(130,0,11,24,0,0,7); ctx.fill();
    ctx.restore(); } },
  {id:'bamboo', name:'竹林', draw:function(x,y,w,h){
    const g=ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,'#d6ecc0'); g.addColorStop(1,'#9fd07a'); ctx.fillStyle=g; ctx.fillRect(x,y,w,h);
    const xs=[0.16,0.34,0.52,0.70,0.86];
    xs.forEach(function(fx,k){ const bx=x+w*fx, bw=20+(k%2)*6;
      ctx.fillStyle=k%2?'#4f9e3a':'#5fb04a'; ctx.fillRect(bx-bw/2,y,bw,h);
      ctx.strokeStyle='#3a7e2a'; ctx.lineWidth=3;
      for(let yy=y+30;yy<y+h;yy+=70){ ctx.beginPath(); ctx.moveTo(bx-bw/2,yy); ctx.lineTo(bx+bw/2,yy); ctx.stroke(); }
      // 葉
      ctx.fillStyle='#3f8f30';
      for(let m=0;m<3;m++){ const ly=y+30+m*120; ctx.save(); ctx.translate(bx,ly); ctx.rotate(-0.6+m*0.5);
        ctx.beginPath(); ctx.ellipse(26,0,28,7,0,0,7); ctx.fill(); ctx.restore(); }
    }); } },
  {id:'fish', name:'さかな', draw:function(x,y,w,h){
    const g=ctx.createLinearGradient(0,y,0,y+h); g.addColorStop(0,'#7fd0ff'); g.addColorStop(1,'#2e8fd0');
    ctx.fillStyle=g; ctx.fillRect(x,y,w,h);
    ctx.save(); ctx.translate(x+w/2,y+h/2);
    ctx.fillStyle='#ff8a3d'; ctx.beginPath(); ctx.ellipse(-10,0,150,90,0,0,7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(120,0); ctx.lineTo(190,-70); ctx.lineTo(190,70); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ffb27a'; ctx.beginPath(); ctx.moveTo(-30,-80); ctx.lineTo(30,-150); ctx.lineTo(60,-70); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-90,-20,26,0,7); ctx.fill();
    ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(-96,-20,12,0,7); ctx.fill();
    ctx.strokeStyle='#d96a1f'; ctx.lineWidth=4;
    for(let i=-40;i<110;i+=34){ ctx.beginPath(); ctx.arc(i,0,30,-1,1); ctx.stroke(); }
    ctx.restore(); } },
  {id:'rocket', name:'ロケット', draw:function(x,y,w,h){
    ctx.fillStyle='#0b1030'; ctx.fillRect(x,y,w,h);
    ctx.fillStyle='#fff'; for(let i=0;i<40;i++){ ctx.globalAlpha=0.5+Math.random()*0.5;
      ctx.fillRect(x+Math.random()*w, y+Math.random()*h, 2,2); } ctx.globalAlpha=1;
    ctx.save(); ctx.translate(x+w/2,y+h/2);
    ctx.fillStyle='#eef'; rr(-50,-150,100,230,30); ctx.fill();
    ctx.fillStyle='#ff5252'; ctx.beginPath(); ctx.moveTo(-50,-90); ctx.lineTo(0,-200); ctx.lineTo(50,-90); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ff5252'; ctx.beginPath(); ctx.moveTo(-50,40); ctx.lineTo(-110,110); ctx.lineTo(-50,90); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(50,40); ctx.lineTo(110,110); ctx.lineTo(50,90); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#7fd6ff'; ctx.beginPath(); ctx.arc(0,-40,28,0,7); ctx.fill();
    ctx.strokeStyle='#3a6'; ctx.lineWidth=5; ctx.stroke();
    ctx.fillStyle='#ffb23b'; ctx.beginPath(); ctx.moveTo(-34,80); ctx.lineTo(0,180); ctx.lineTo(34,80); ctx.closePath(); ctx.fill();
    ctx.restore(); } },
  {id:'sun', name:'たいよう', draw:function(x,y,w,h){
    ctx.fillStyle='#9fd6ff'; ctx.fillRect(x,y,w,h);
    ctx.save(); ctx.translate(x+w/2,y+h/2);
    ctx.fillStyle='#ffcf3b';
    for(let i=0;i<12;i++){ ctx.save(); ctx.rotate(i/12*7);
      ctx.beginPath(); ctx.moveTo(-22,-150); ctx.lineTo(22,-150); ctx.lineTo(0,-210); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.fillStyle='#ffd83b'; ctx.beginPath(); ctx.arc(0,0,120,0,7); ctx.fill();
    ctx.strokeStyle='#f0b800'; ctx.lineWidth=6; ctx.stroke();
    ctx.fillStyle='#c98a00'; ctx.beginPath(); ctx.arc(-40,-20,12,0,7); ctx.arc(40,-20,12,0,7); ctx.fill();
    ctx.strokeStyle='#c98a00'; ctx.lineWidth=8; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(0,20,46,0.2,Math.PI-0.2); ctx.stroke();
    ctx.restore(); } }
];

// ===== 状態 =====
const ST={TITLE:0,PLAY:1,SPIN:2,CHOOSE:3,RESULT:4,OVER:5};
let state=ST.TITLE;
let order=[], pIdx=0, total=0, best=0;
let cur=null, covered=[], remaining=0, anyRevealed=false, spinsUsed=0;
const MAXSPIN=3;
let pops=[]; // {c,r,t0}
let spinT=0, spinTarget=0, spinShown=1, spinDur=0;
let choices=[], resText='', resPts=0, resTimer=0;
try{ best=parseInt(localStorage.getItem(KEY)||'0',10)||0; }catch(e){}

// ===== Audio =====
var actx=null, master=null;
function tone(f,d,t,v,sl){ if(!actx)return; const tt=actx.currentTime; const o=actx.createOscillator(),g=actx.createGain();
  o.type=t||'sine'; o.frequency.setValueAtTime(f,tt); if(sl)o.frequency.exponentialRampToValueAtTime(sl,tt+d);
  g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime(v||0.18,tt+0.01); g.gain.exponentialRampToValueAtTime(0.0001,tt+d);
  o.connect(g).connect(master); o.start(tt); o.stop(tt+d); }
function nz(d,v,f){ if(!actx)return; const tt=actx.currentTime; const n=Math.floor(actx.sampleRate*d),b=actx.createBuffer(1,n,actx.sampleRate),dd=b.getChannelData(0);
  for(let i=0;i<n;i++)dd[i]=Math.random()*2-1; const s=actx.createBufferSource();s.buffer=b; const g=actx.createGain(),fl=actx.createBiquadFilter();
  fl.type='lowpass'; fl.frequency.value=f||1200; g.gain.setValueAtTime(v||0.2,tt); g.gain.exponentialRampToValueAtTime(0.0001,tt+d);
  s.connect(fl).connect(g).connect(master); s.start(tt); s.stop(tt+d); }
const SFX={
  pop(){ nz(0.08,0.16,1800); tone(600,0.07,'square',0.1,900); },
  spin(){ tone(880,0.04,'square',0.08); },
  stop(){ tone(440,0.18,'square',0.16,660); },
  correct(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.3,'triangle',0.14),i*90)); nz(0.5,0.14,2000); },
  wrong(){ tone(300,0.3,'sine',0.18,120); },
  fin(){ [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>tone(f,0.35,'sine',0.13),i*110)); }
};

// ===== 進行 =====
function startGame(){ order=shuffle(PICS.map((_,i)=>i)).slice(0,5); pIdx=0; total=0; loadPic(); }
function loadPic(){ cur=PICS[order[pIdx]];
  covered=[]; for(let r=0;r<GRID;r++){ covered.push([]); for(let c=0;c<GRID;c++) covered[r].push(true); }
  remaining=0; anyRevealed=false; spinsUsed=0; pops=[]; state=ST.PLAY; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
function coveredCount(){ let n=0; for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++) if(covered[r][c])n++; return n; }

function doSpin(){ spinsUsed++; const pool=[1,2,2,3,3,3,4,4,5,6]; spinTarget=pool[Math.random()*pool.length|0];
  spinT=0; spinDur=1.3; spinShown=1; state=ST.SPIN; }
function revealCell(c,r){ if(!covered[r][c])return false; covered[r][c]=false; anyRevealed=true;
  pops.push({c,r,t0:performance.now()}); SFX.pop(); return true; }

function openChoices(){ curPointsAtAnswer=curPoints(); const correct=cur.name;
  const others=shuffle(PICS.filter(p=>p.name!==correct).map(p=>p.name)).slice(0,2);
  choices=shuffle([correct].concat(others)); state=ST.CHOOSE; }
function curPoints(){ return coveredCount()*10; }
function pickChoice(name){
  for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++) covered[r][c]=false; // 答え合わせで全部めくる
  if(name===cur.name){ resPts=curPointsAtAnswer; total+=resPts; resText='せいかい！'; SFX.correct(); }
  else { resPts=0; resText='ざんねん…'; SFX.wrong(); }
  state=ST.RESULT; resTimer=2.4;
}
var curPointsAtAnswer=0;
function nextPic(){ pIdx++; if(pIdx>=order.length){ if(total>best){ best=total; try{localStorage.setItem(KEY,String(best));}catch(e){} } SFX.fin(); state=ST.OVER; } else loadPic(); }

// ===== 入力 =====
function getXY(e){ const r=cv.getBoundingClientRect(); const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
  const cy=(e.touches?e.touches[0].clientY:e.clientY)-r.top; return {x:cx/r.width*DW, y:cy/r.height*DH}; }
function inRect(p,x,y,w,h){ return p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h; }
// ボタン領域
const BTN_SPIN={x:80,y:724,w:200,h:74}, BTN_ANS={x:320,y:724,w:200,h:74};
const CH=[{x:90,y:560,w:420,h:80},{x:90,y:655,w:420,h:80},{x:90,y:750,w:420,h:80}];

function onDown(e){ e.preventDefault(); const p=getXY(e);
  if(state===ST.TITLE){ startGame(); return; }
  if(state===ST.OVER){ startGame(); return; }
  if(state===ST.RESULT) return;
  if(state===ST.SPIN) return;
  if(state===ST.CHOOSE){ for(let i=0;i<3;i++){ if(inRect(p,CH[i].x,CH[i].y,CH[i].w,CH[i].h)){ pickChoice(choices[i]); return; } }
    // 領域外タップでキャンセル（戻る）
    if(p.y<540) state=ST.PLAY; return; }
  if(state===ST.PLAY){
    // こたえるは常時OK（1マス以上めくっていれば、はがし途中でも）
    if(anyRevealed && inRect(p,BTN_ANS.x,BTN_ANS.y,BTN_ANS.w,BTN_ANS.h)){ openChoices(); return; }
    if(remaining>0){ // はがすモード（途中でやめて答えてもいい）
      if(inRect(p,PX,PY,PS,PS)){ const c=Math.floor((p.x-PX)/CS), r=Math.floor((p.y-PY)/CS);
        if(c>=0&&c<GRID&&r>=0&&r<GRID&&covered[r][c]){ revealCell(c,r); remaining--; }
        if(remaining<=0||coveredCount()===0){ remaining=0; SFX.stop();
          if(spinsUsed>=MAXSPIN) setTimeout(openChoices,500); } }
      return;
    }
    // ルーレット（残あり）
    if(spinsUsed<MAXSPIN && inRect(p,BTN_SPIN.x,BTN_SPIN.y,BTN_SPIN.w,BTN_SPIN.h)){ doSpin(); return; }
  }
}

// ===== 描画 =====
function drawPicture(){ ctx.save(); ctx.beginPath(); rr(PX,PY,PS,PS,10); ctx.clip();
  cur.draw(PX,PY,PS,PS); ctx.restore(); }
function drawChikuwaTile(x,y,s,k){ // 上から見たちくわ（穴つき）・隙間なしで絵を完全に隠す
  ctx.fillStyle='#e6c47e'; ctx.fillRect(x,y,s,s);              // 不透明ベース（角まで覆う）
  const g=ctx.createLinearGradient(0,y,0,y+s);
  g.addColorStop(0,'#f3dca8'); g.addColorStop(1,'#d8b46e'); ctx.fillStyle=g;
  rr(x+0.5,y+0.5,s-1,s-1,7*(k||1)); ctx.fill();
  ctx.strokeStyle='#b9913f'; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,s-2,s-2);
  ctx.fillStyle='#7a5a2a'; ctx.beginPath(); ctx.ellipse(x+s/2,y+s/2,s*0.16,s*0.16,0,0,7); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x+s*0.34,y+s*0.32,s*0.10,s*0.06,-0.5,0,7); ctx.fill();
}
function drawGrid(){
  for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++){ if(covered[r][c]) drawChikuwaTile(PX+c*CS,PY+r*CS,CS,1); }
  // ポップ演出（縮みながら消える）
  const now=performance.now();
  pops=pops.filter(function(p){ const t=(now-p.t0)/180; if(t>=1)return false;
    const s=CS*(1-t*0.9), off=(CS-s)/2; ctx.globalAlpha=1-t; drawChikuwaTile(PX+p.c*CS+off,PY+p.r*CS+off,s,1); ctx.globalAlpha=1; return true; });
  // 枠
  ctx.strokeStyle='#5a4a6a'; ctx.lineWidth=4; rr(PX-2,PY-2,PS+4,PS+4,12); ctx.stroke();
}
function btn(b,label,col,sub){ ctx.fillStyle=col; rr(b.x,b.y,b.w,b.h,16); ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 24px sans-serif';
  ctx.fillText(label,b.x+b.w/2,b.y+b.h/2+(sub?-4:8));
  if(sub){ ctx.font='12px sans-serif'; ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fillText(sub,b.x+b.w/2,b.y+b.h/2+18); } }

function drawHeader(){
  ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.font='bold 26px sans-serif';
  ctx.fillText('ちくわ隠し絵',20,42);
  ctx.textAlign='right'; ctx.font='bold 22px sans-serif'; ctx.fillStyle='#ffd23f';
  ctx.fillText('スコア '+total,DW-20,40);
  ctx.textAlign='center'; ctx.fillStyle='#cdb8e6'; ctx.font='bold 20px sans-serif';
  ctx.fillText((pIdx+1)+' / '+order.length+'まい',DW/2,40);
  ctx.fillStyle='#e8def6'; ctx.font='bold 22px sans-serif';
  ctx.fillText('なんの絵？',DW/2,138);
  ctx.fillStyle='#9a8fb8'; ctx.font='13px sans-serif';
  ctx.fillText('かくれてるマス1つ＝10点（少なくはがして当てるほど高得点）',DW/2,160);
}

function drawTitle(){
  ctx.fillStyle='#1d1730'; ctx.fillRect(0,0,DW,DH);
  // 飾りちくわ
  for(let i=0;i<24;i++){ drawChikuwaTile(40+(i%6)*90, 600+Math.floor(i/6)*70, 70,1); }
  ctx.save(); ctx.translate(DW/2,210); ctx.rotate(-0.03);
  ctx.fillStyle='#b06bd8'; rr(-250,-58,500,116,18); ctx.fill(); ctx.restore();
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 52px sans-serif';
  ctx.fillText('ちくわ隠し絵',DW/2,228);
  ctx.font='bold 20px sans-serif'; ctx.fillStyle='#e8def6';
  ctx.fillText('ルーレットで決まった数だけ ちくわをはがして',DW/2,322);
  ctx.fillText('かくれた絵を3択で当てよう！',DW/2,350);
  ctx.fillStyle='#ffd23f'; ctx.font='bold 17px sans-serif';
  ctx.fillText('★ かくれてるマス1つ＝10点',DW/2,392);
  ctx.fillStyle='#ff9a9a'; ctx.font='15px sans-serif';
  ctx.fillText('ルーレットは3回まで→強制こたえ。はずれたら0点！',DW/2,420);
  ctx.fillText('いつでも答えてOK！少なくはがすほど高得点。狙え一発！',DW/2,444);
  if(best>0){ ctx.fillStyle='#ffd23f'; ctx.font='bold 22px sans-serif'; ctx.fillText('ベスト '+best,DW/2,484); }
  if(Math.floor(Date.now()/500)%2===0){ ctx.font='bold 30px sans-serif'; ctx.fillStyle='#ffd23f';
    ctx.fillText('タップでスタート',DW/2,540); }
}
function drawOver(){
  ctx.fillStyle='rgba(20,16,30,.7)'; ctx.fillRect(0,0,DW,DH);
  ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='bold 38px sans-serif';
  ctx.fillText('けっか',DW/2,260);
  ctx.font='bold 90px sans-serif'; ctx.fillStyle='#ffd23f'; ctx.fillText(String(total),DW/2,370);
  ctx.font='bold 26px sans-serif'; ctx.fillStyle='#fff'; ctx.fillText('点',DW/2,410);
  ctx.font='bold 22px sans-serif'; ctx.fillStyle='#cdb8e6';
  ctx.fillText(total>=best?'★ ベスト更新！':'ベスト '+best,DW/2,460);
  if(Math.floor(Date.now()/500)%2===0){ ctx.font='bold 28px sans-serif'; ctx.fillStyle='#6bd968';
    ctx.fillText('タップでもう一回',DW/2,560); }
}

// ===== ループ =====
let last=performance.now();
function loop(now){ let dt=(now-last)/1000; last=now; if(dt>0.05)dt=0.05;
  if(state===ST.SPIN){ spinT+=dt;
    if(spinT<spinDur){ if(Math.random()<0.5)SFX.spin(); spinShown=1+(Math.random()*6|0); }
    else { spinShown=spinTarget; remaining=spinTarget; SFX.stop(); state=ST.PLAY; } }
  if(state===ST.RESULT){ resTimer-=dt; if(resTimer<=0) nextPic(); }

  ctx.clearRect(0,0,DW,DH);
  if(state===ST.TITLE){ drawTitle(); if(running) rafId=requestAnimationFrame(loop); return; }
  // 背景
  ctx.fillStyle='#241c34'; ctx.fillRect(0,0,DW,DH);
  drawHeader();
  drawPicture();
  drawGrid();

  if(state===ST.PLAY){
    if(remaining>0){ ctx.textAlign='center';
      ctx.fillStyle='#ffe08a'; ctx.font='bold 17px sans-serif';
      ctx.fillText('ここで答えてもOK！大きい数字は使い切らなくていい',DW/2,692);
      // 左：のこり表示
      ctx.fillStyle='#0d1322'; rr(BTN_SPIN.x,BTN_SPIN.y,BTN_SPIN.w,BTN_SPIN.h,16); ctx.fill();
      ctx.fillStyle='#ffd23f'; ctx.font='bold 24px sans-serif'; ctx.fillText('あと '+remaining+'コ',BTN_SPIN.x+BTN_SPIN.w/2,BTN_SPIN.y+34);
      ctx.fillStyle='#cdb8e6'; ctx.font='12px sans-serif'; ctx.fillText('タップではがす',BTN_SPIN.x+BTN_SPIN.w/2,BTN_SPIN.y+56);
      // 右：こたえる（常時）
      btn(BTN_ANS,'❓ こたえる','#c0392b','+'+curPoints()+'点ねらえる');
    } else {
      const left=MAXSPIN-spinsUsed;
      // 誘導文
      ctx.textAlign='center'; ctx.fillStyle='#ffe08a'; ctx.font='bold 22px sans-serif';
      if(spinsUsed===0) ctx.fillText('🎰 ルーレットを回してマス目を外そう！',DW/2,686);
      else if(left>0) ctx.fillText('もっとはがす？ それとも今こたえる？',DW/2,686);
      else ctx.fillText('ルーレットは終わり！こたえよう',DW/2,686);
      ctx.font='bold 16px sans-serif'; ctx.fillStyle='#cdb8e6';
      ctx.fillText('ルーレットのこり '+left+' 回',DW/2,710);
      if(left>0) btn(BTN_SPIN,'🎰 まわす','#7a4ab0','のこり'+left+'回');
      else { ctx.fillStyle='#3a3346'; rr(BTN_SPIN.x,BTN_SPIN.y,BTN_SPIN.w,BTN_SPIN.h,16); ctx.fill();
        ctx.fillStyle='#7a6f88'; ctx.font='bold 20px sans-serif'; ctx.textAlign='center'; ctx.fillText('回せない',BTN_SPIN.x+BTN_SPIN.w/2,BTN_SPIN.y+BTN_SPIN.h/2+7); }
      if(anyRevealed) btn(BTN_ANS,'❓ こたえる','#c0392b','+'+curPoints()+'点ねらえる');
      else btn(BTN_ANS,'まず回そう','#555');
    }
  }
  if(state===ST.SPIN){ ctx.textAlign='center';
    ctx.fillStyle='#0d1322'; rr(DW/2-90,690,180,90,16); ctx.fill();
    ctx.fillStyle='#ffd23f'; ctx.font='bold 70px sans-serif'; ctx.fillText(String(spinShown),DW/2,762);
    ctx.fillStyle='#fff'; ctx.font='bold 18px sans-serif'; ctx.fillText('ルーレット…',DW/2,690-6); }
  if(state===ST.CHOOSE){ ctx.fillStyle='rgba(10,8,16,.55)'; ctx.fillRect(0,0,DW,DH);
    drawPicture(); drawGrid();
    ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='bold 26px sans-serif'; ctx.fillText('この絵はなに？',DW/2,512);
    ctx.fillStyle='#ffd23f'; ctx.font='bold 18px sans-serif';
    ctx.fillText('当たれば +'+curPointsAtAnswer+'点／はずれたら 0点',DW/2,538);
    const cols=['#2e7d52','#2e5d9d','#9d5a2e'];
    for(let i=0;i<3;i++){ btn(CH[i],choices[i],cols[i]); }
  }
  if(state===ST.RESULT){ ctx.fillStyle='rgba(10,8,16,.5)'; ctx.fillRect(0,0,DW,DH);
    drawPicture();
    ctx.textAlign='center'; ctx.font='bold 52px sans-serif'; ctx.lineWidth=7; ctx.strokeStyle='#1a1020';
    ctx.strokeText(resText,DW/2,120); ctx.fillStyle='#ffd23f'; ctx.fillText(resText,DW/2,120);
    ctx.font='bold 30px sans-serif'; ctx.fillStyle='#fff'; ctx.strokeText(cur.name,DW/2,690); ctx.fillText(cur.name,DW/2,690);
    ctx.font='bold 26px sans-serif'; ctx.fillStyle='#6bd968'; ctx.fillText('+'+resPts+'点',DW/2,732); }
  if(state===ST.OVER){ drawOver(); }
  if(running) rafId=requestAnimationFrame(loop);
}







window.kakushieLaunch=function(ctx2){
  actx=ctx2||null;
  if(actx){ try{ master=actx.createGain(); master.gain.value=0.9; master.connect(actx.destination); }catch(e){ master=null; } }
  cv=document.getElementById('kak-cv'); ctx=cv?cv.getContext('2d'):null;
  var v=document.getElementById('kak-ver'); if(v) v.textContent='js '+KAKVER;
  if(cv && !cv.__kakb){ cv.__kakb=1;
    if('PointerEvent' in window){ cv.addEventListener('pointerdown',onDown,{passive:false}); }
    else { cv.addEventListener('touchstart',onDown,{passive:false}); cv.addEventListener('mousedown',onDown,{passive:false}); }
  }
  window.addEventListener('resize',onResize);
  state=ST.TITLE; resize();
  running=true; last=performance.now(); rafId=requestAnimationFrame(loop);
};
window.kakushieShutdown=function(){
  running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0;
  window.removeEventListener('resize',onResize);
  try{ if(master) master.disconnect(); }catch(e){} master=null; actx=null;
};
})();
