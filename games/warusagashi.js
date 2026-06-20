
(function(){
"use strict";
var WARVER='2.48.0';
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
const PAX=16, PAY=150, PAW=568, PAH=735;   // 群衆エリア
const KEY='chikuwa_warusagashi_best';

// ===== キャラ素材 =====
const HATS=['none','beret','cap','bobble','tophat'];
const HCOL=['#e23b3b','#3b7be2','#2ec27e','#f0a93b','#9b59b6','#39424f'];
const BODY=['#f3dca8','#e9c98a','#dcb673'];
function ri(n){ return Math.random()*n|0; }
function randSig(){ return { body:ri(BODY.length), hat:ri(HATS.length), hcol:ri(HCOL.length),
  glasses:ri(2), scarf:ri(2), scol:ri(HCOL.length), face:ri(3) }; }
function sigEq(a,b){ return a.body===b.body&&a.hat===b.hat&&a.hcol===b.hcol&&a.glasses===b.glasses&&a.scarf===b.scarf&&a.scol===b.scol; }
function nearMiss(t){ // 手本に近いが必ずどこか違う
  const s=Object.assign({},t); const keys=['hat','hcol','glasses','scarf','scol','body'];
  const n=1+ri(2); for(let i=0;i<n;i++){ const k=keys[ri(keys.length)];
    if(k==='hat')s.hat=(t.hat+1+ri(HATS.length-1))%HATS.length;
    else if(k==='hcol')s.hcol=(t.hcol+1+ri(HCOL.length-1))%HCOL.length;
    else if(k==='glasses')s.glasses=1-s.glasses;
    else if(k==='scarf')s.scarf=1-s.scarf;
    else if(k==='scol')s.scol=(t.scol+1+ri(HCOL.length-1))%HCOL.length;
    else if(k==='body')s.body=(t.body+1+ri(BODY.length-1))%BODY.length; }
  if(sigEq(s,t)) s.glasses=1-s.glasses; return s;
}

// ===== 描画：ちくわキャラ =====
function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawChar(cx,cy,s,sig){
  const bw=s*0.62, bh=s*0.94, top=cy-bh/2;
  // 体
  const g=ctx.createLinearGradient(0,top,0,top+bh);
  g.addColorStop(0,BODY[sig.body]); g.addColorStop(1,'#caa45e');
  ctx.fillStyle=g; rr(cx-bw/2,top,bw,bh,bw*0.42); ctx.fill();
  ctx.strokeStyle='rgba(150,110,50,.6)'; ctx.lineWidth=Math.max(1,s*0.03); ctx.stroke();
  // 穴（上）
  ctx.fillStyle='#7a5a2a'; ctx.beginPath(); ctx.ellipse(cx,top+bh*0.06,bw*0.28,bh*0.05,0,0,7); ctx.fill();
  // マフラー
  if(sig.scarf){ ctx.fillStyle=HCOL[sig.scol]; rr(cx-bw/2,cy+bh*0.16,bw,bh*0.14,3); ctx.fill();
    ctx.fillRect(cx+bw*0.18,cy+bh*0.22,bw*0.16,bh*0.22); }
  // 顔
  const ey=cy-bh*0.04, ex=bw*0.20;
  ctx.fillStyle='#222';
  ctx.beginPath(); ctx.arc(cx-ex,ey,Math.max(1,s*0.045),0,7); ctx.arc(cx+ex,ey,Math.max(1,s*0.045),0,7); ctx.fill();
  ctx.strokeStyle='#7a4a2a'; ctx.lineWidth=Math.max(1,s*0.03);
  ctx.beginPath();
  if(sig.face===0) ctx.arc(cx,cy+bh*0.06,bw*0.18,0.15,Math.PI-0.15);       // にこ
  else if(sig.face===1){ ctx.moveTo(cx-bw*0.14,cy+bh*0.10); ctx.lineTo(cx+bw*0.14,cy+bh*0.10); } // むす
  else ctx.arc(cx,cy+bh*0.12,bw*0.16,Math.PI+0.2,-0.2);                     // への字
  ctx.stroke();
  // メガネ
  if(sig.glasses){ ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=Math.max(1,s*0.04);
    ctx.beginPath(); ctx.arc(cx-ex,ey,s*0.10,0,7); ctx.arc(cx+ex,ey,s*0.10,0,7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-ex+s*0.10,ey); ctx.lineTo(cx+ex-s*0.10,ey); ctx.stroke(); }
  // 帽子
  const hat=HATS[sig.hat], hc=HCOL[sig.hcol], hy=top;
  ctx.fillStyle=hc;
  if(hat==='beret'){ ctx.beginPath(); ctx.ellipse(cx,hy-s*0.02,bw*0.5,s*0.12,0,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+bw*0.28,hy-s*0.10,s*0.04,0,7); ctx.fill(); }
  else if(hat==='cap'){ ctx.beginPath(); ctx.arc(cx,hy+s*0.02,bw*0.42,Math.PI,0); ctx.fill();
    ctx.fillRect(cx-bw*0.05,hy+s*0.02,bw*0.5,s*0.05); }
  else if(hat==='bobble'){ ctx.beginPath(); ctx.moveTo(cx-bw*0.42,hy+s*0.04); ctx.lineTo(cx+bw*0.42,hy+s*0.04); ctx.lineTo(cx,hy-s*0.22); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#fff'; ctx.fillRect(cx-bw*0.42,hy+s*0.02,bw*0.84,s*0.05);
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx,hy-s*0.24,s*0.07,0,7); ctx.fill(); }
  else if(hat==='tophat'){ ctx.fillRect(cx-bw*0.30,hy-s*0.22,bw*0.60,s*0.24);
    ctx.fillRect(cx-bw*0.48,hy-s*0.02,bw*0.96,s*0.05); }
}

// ===== 状態 =====
const ST={TITLE:0,PLAY:1,FOUND:2,OVER:3};
let state=ST.TITLE;
const NLEV=5;
let target=randSig(), lvl=0, chars=[], tIndex=0;
let tStart=0, elapsed=0, penalty=0, miss=0, best=0;
let foundT=0, flash=0, shakeT=0;
try{ best=parseFloat(localStorage.getItem(KEY)||'0')||0; }catch(e){}

// ===== Audio =====
var actx=null, master=null;
function tone(f,d,t,v,sl){ if(!actx)return; const tt=actx.currentTime; const o=actx.createOscillator(),g=actx.createGain();
  o.type=t||'sine'; o.frequency.setValueAtTime(f,tt); if(sl)o.frequency.exponentialRampToValueAtTime(sl,tt+d);
  g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime(v||0.18,tt+0.01); g.gain.exponentialRampToValueAtTime(0.0001,tt+d);
  o.connect(g).connect(master); o.start(tt); o.stop(tt+d); }
const SFX={ found(){ [659,880,1175].forEach((f,i)=>setTimeout(()=>tone(f,0.25,'triangle',0.16),i*80)); },
  miss(){ tone(200,0.2,'sawtooth',0.16,120); }, fin(){ [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>tone(f,0.3,'sine',0.14),i*100)); } };

// ===== BGM（魔界村風オリジナル：Em短調・疾走マーチ i-i-VI-V＋導音D#）=====
const NB={E2:82.41,G2:98,A2:110,B2:123.47,C3:130.81,D3:146.83,E3:164.81,'F#3':185,G3:196,A3:220,B3:246.94,
  C4:261.63,D4:293.66,'D#4':311.13,E4:329.63,'F#4':369.99,G4:392,A4:440,B4:493.88,C5:523.25,D5:587.33,E5:659.25};
const LEAD=['E4',0,'B4',0,'G4',0,'B4','A4', 'G4',0,'E4',0,'F#4',0,0,0,
            'E4',0,'G4',0,'C5',0,'B4','A4', 'G4',0,'F#4',0,'D#4',0,'F#4',0];
const BASS=['E2','E2','B2','E2','E2','E2','B2','E2', 'E2','E2','B2','E2','E2','E2','B2','E2',
            'C3','C3','G2','C3','C3','C3','G2','C3', 'B2','B2','F#3','B2','B2','B2','F#3','B2'];
const BSTEP=0.135;
let bgm={on:false,step:0,next:0,timer:null}, bgmGain=null, bgmSteps=0;
function bsq(freq,t,dur,v,type){ if(!actx||!bgmGain)return; const o=actx.createOscillator(),g=actx.createGain();
  o.type=type||'square'; o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g).connect(bgmGain); o.start(t); o.stop(t+dur+0.02); }
function bnoise(t,dur,v,cut){ if(!actx||!bgmGain)return; const n=Math.max(1,Math.floor(actx.sampleRate*dur));
  const b=actx.createBuffer(1,n,actx.sampleRate),d=b.getChannelData(0); for(let k=0;k<n;k++)d[k]=Math.random()*2-1;
  const s=actx.createBufferSource();s.buffer=b; const g=actx.createGain(),f=actx.createBiquadFilter();
  f.type='highpass'; f.frequency.value=cut||6000; g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(f).connect(g).connect(bgmGain); s.start(t); s.stop(t+dur); }
function bkick(t){ if(!actx||!bgmGain)return; const o=actx.createOscillator(),g=actx.createGain(); o.type='sine';
  o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(45,t+0.11);
  g.gain.setValueAtTime(0.45,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.14);
  o.connect(g).connect(bgmGain); o.start(t); o.stop(t+0.16); }
function bgmPlay(i,t){
  const ln=LEAD[i]; if(ln){ bsq(NB[ln],t,BSTEP*0.95,0.15,'square'); bsq(NB[ln]*2,t,BSTEP*0.5,0.04,'square'); }
  const bn=BASS[i]; if(bn) bsq(NB[bn],t,BSTEP*0.55,0.22,'square');   // 駆け足ベース（スタッカート）
  if(i%2===1) bnoise(t,0.03,0.05,7000);   // 裏拍ハイハット
  if(i%4===0) bkick(t);                    // 4分キック
  if(i===8||i===24) bnoise(t,0.10,0.10,2500); // スネア的バックビート
  bgmSteps++;
}
function bgmSched(){ if(!actx||!bgm.on)return;
  while(bgm.next < actx.currentTime+0.12){ bgmPlay(bgm.step,bgm.next); bgm.next+=BSTEP; bgm.step=(bgm.step+1)%32; } }
function startBGM(){ if(!actx)return; stopBGM();
  bgmGain=actx.createGain(); bgmGain.gain.value=0.0001; bgmGain.connect(master);
  bgmGain.gain.linearRampToValueAtTime(0.45,actx.currentTime+0.4);
  bgm.on=true; bgm.step=0; bgm.next=actx.currentTime+0.06; bgm.timer=setInterval(bgmSched,25); }
function stopBGM(){ bgm.on=false; if(bgm.timer){clearInterval(bgm.timer);bgm.timer=null;}
  if(bgmGain){ try{ const t=actx.currentTime; bgmGain.gain.cancelScheduledValues(t); bgmGain.gain.setValueAtTime(bgmGain.gain.value,t); bgmGain.gain.linearRampToValueAtTime(0.0001,t+0.12);}catch(e){}
    const bg=bgmGain; setTimeout(()=>{try{bg.disconnect();}catch(e){}},220); bgmGain=null; } }

// ===== 生成 =====
function genLevel(){
  const s=[56,50,44,40,36][lvl]||34;
  const cell=s*1.18, cols=Math.floor(PAW/cell), rows=Math.floor(PAH/cell);
  const cw=PAW/cols, ch=PAH/rows;
  chars=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=PAX+cw*(c+0.5)+(Math.random()-0.5)*cw*0.30;
    const y=PAY+ch*(r+0.5)+(Math.random()-0.5)*ch*0.30;
    let sig; do{ sig = Math.random()<0.5 ? nearMiss(target) : randSig(); }while(sigEq(sig,target));
    chars.push({x,y,s,sig});
  }
  tIndex=ri(chars.length); chars[tIndex].sig=Object.assign({},target);
}
function startGame(){ startBGM(); target=randSig(); lvl=0; elapsed=0; penalty=0; miss=0; genLevel(); tStart=performance.now(); state=ST.PLAY; }
function nextLevel(){ lvl++; if(lvl>=NLEV){ finish(); } else { genLevel(); state=ST.PLAY; } }
function finish(){ stopBGM(); const total=elapsed+penalty; if(best===0||total<best){ best=total; try{localStorage.setItem(KEY,String(best));}catch(e){} }
  SFX.fin(); state=ST.OVER; }

// ===== 入力 =====
function getXY(e){ const r=cv.getBoundingClientRect(); const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
  const cy=(e.touches?e.touches[0].clientY:e.clientY)-r.top; return {x:cx/r.width*DW, y:cy/r.height*DH}; }
function onDown(e){ e.preventDefault(); const p=getXY(e);
  if(state===ST.TITLE){ startGame(); return; }
  if(state===ST.OVER){ startGame(); return; }
  if(state===ST.FOUND) return;
  if(state===ST.PLAY){
    const t=chars[tIndex], d=Math.hypot(p.x-t.x,p.y-t.y);
    if(d < t.s*0.55){ // みつけた！
      foundT=1.0; SFX.found(); state=ST.FOUND; setTimeout(nextLevel,1000); return; }
    // お手つき
    if(p.y>PAY){ penalty+=3; miss++; flash=0.5; shakeT=0.4; SFX.miss(); }
  }
}

// ===== 描画 =====
function fmt(t){ return t.toFixed(1)+'秒'; }
function drawTopBar(){
  ctx.fillStyle='#161d2c'; ctx.fillRect(0,0,DW,PAY-6);
  // お手本
  ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.font='bold 20px sans-serif';
  ctx.fillText('コレを探せ！',16,34);
  ctx.fillStyle='#0e1320'; rr(18,44,86,86,12); ctx.fill();
  ctx.strokeStyle='#ffd23f'; ctx.lineWidth=3; rr(18,44,86,86,12); ctx.stroke();
  drawChar(61,90,66,target);
  // 情報
  ctx.textAlign='right'; ctx.fillStyle='#ffd23f'; ctx.font='bold 30px sans-serif';
  ctx.fillText(fmt(elapsed+penalty),DW-16,40);
  ctx.fillStyle='#cdd5e6'; ctx.font='bold 18px sans-serif';
  ctx.fillText('ステージ '+(lvl+1)+' / '+NLEV,DW-16,72);
  if(miss>0){ ctx.fillStyle='#ff7a7a'; ctx.font='14px sans-serif'; ctx.fillText('お手つき '+miss+'（+'+penalty+'秒）',DW-16,96); }
  ctx.fillStyle='#8a93a8'; ctx.font='13px sans-serif'; ctx.fillText('タップで探す',DW-16,118);
}
function drawCrowd(){
  ctx.save(); ctx.beginPath(); rr(PAX-2,PAY,PAW+4,PAH,6); ctx.clip();
  let sx=0,sy=0; if(shakeT>0){ sx=(Math.random()-0.5)*8; sy=(Math.random()-0.5)*8; }
  ctx.translate(sx,sy);
  for(let i=0;i<chars.length;i++){ if(i===tIndex)continue; const c=chars[i]; drawChar(c.x,c.y,c.s,c.sig); }
  const t=chars[tIndex]; drawChar(t.x,t.y,t.s,t.sig); // 手本は最前面（隠れすぎ防止）
  ctx.restore();
  if(flash>0){ ctx.fillStyle='rgba(255,60,60,'+(flash*0.5)+')'; ctx.fillRect(PAX,PAY,PAW,PAH); }
}
function drawFound(){
  const t=chars[tIndex];
  ctx.strokeStyle='#ffd23f'; ctx.lineWidth=6;
  ctx.beginPath(); ctx.arc(t.x,t.y,t.s*0.7+(1-foundT)*30,0,7); ctx.stroke();
  ctx.fillStyle='rgba(10,12,20,.35)'; ctx.fillRect(0,PAY,DW,PAH);
  ctx.textAlign='center'; ctx.font='bold 56px sans-serif'; ctx.lineWidth=8; ctx.strokeStyle='#1a1020';
  ctx.strokeText('みつけた！',DW/2,DH/2); ctx.fillStyle='#ffd23f'; ctx.fillText('みつけた！',DW/2,DH/2);
}
let titleDeco=null;
function drawTitle(){
  ctx.fillStyle='#141b2a'; ctx.fillRect(0,0,DW,DH);
  // 飾り群衆（一度だけ生成して固定）
  if(!titleDeco){ titleDeco=[]; for(let i=0;i<32;i++) titleDeco.push(randSig()); }
  for(let i=0;i<32;i++){ drawChar(40+(i%8)*70, 602+Math.floor(i/8)*66, 50, titleDeco[i]); }
  ctx.save(); ctx.translate(DW/2,180); ctx.rotate(-0.03);
  ctx.fillStyle='#e23b3b'; rr(-262,-58,524,116,16); ctx.fill(); ctx.restore();
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 50px sans-serif';
  ctx.fillText('チクーワーを探せ',DW/2,198);
  drawChar(DW/2,330,90,{body:0,hat:1,hcol:0,glasses:1,scarf:1,scol:2,face:0});
  ctx.fillStyle='#e8def6'; ctx.font='bold 19px sans-serif';
  ctx.fillText('大量のちくわの中から、お手本のチクーワーを探せ！',DW/2,420);
  ctx.fillText('5ステージ・タイムアタック（お手つき+3秒）',DW/2,450);
  if(best>0){ ctx.fillStyle='#ffd23f'; ctx.font='bold 22px sans-serif'; ctx.fillText('ベスト '+fmt(best),DW/2,492); }
  if(Math.floor(Date.now()/500)%2===0){ ctx.font='bold 30px sans-serif'; ctx.fillStyle='#ffd23f';
    ctx.fillText('タップでスタート',DW/2,540); }
}
function drawOver(){
  ctx.fillStyle='#141b2a'; ctx.fillRect(0,0,DW,DH);
  ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='bold 40px sans-serif'; ctx.fillText('クリア！',DW/2,220);
  ctx.font='bold 80px sans-serif'; ctx.fillStyle='#ffd23f'; ctx.fillText(fmt(elapsed+penalty),DW/2,330);
  ctx.font='bold 22px sans-serif'; ctx.fillStyle='#cdd5e6';
  ctx.fillText('お手つき '+miss+' 回（+'+penalty+'秒）',DW/2,380);
  ctx.fillStyle='#cdb8e6'; ctx.fillText((elapsed+penalty)<=best?'★ ベスト更新！':'ベスト '+fmt(best),DW/2,420);
  drawChar(DW/2,520,90,target);
  if(Math.floor(Date.now()/500)%2===0){ ctx.font='bold 28px sans-serif'; ctx.fillStyle='#6bd968';
    ctx.fillText('タップでもう一回',DW/2,640); }
}

// ===== ループ =====
let last=performance.now();
function loop(now){ let dt=(now-last)/1000; last=now; if(dt>0.05)dt=0.05;
  if(state===ST.PLAY){ elapsed=(now-tStart)/1000; }
  if(flash>0)flash-=dt; if(shakeT>0)shakeT-=dt; if(foundT>0)foundT-=dt;
  ctx.clearRect(0,0,DW,DH);
  if(state===ST.TITLE){ drawTitle(); if(running) rafId=requestAnimationFrame(loop); return; }
  if(state===ST.OVER){ drawOver(); if(running) rafId=requestAnimationFrame(loop); return; }
  ctx.fillStyle='#243049'; ctx.fillRect(0,0,DW,DH);
  drawCrowd();
  drawTopBar();
  if(state===ST.FOUND) drawFound();
  if(running) rafId=requestAnimationFrame(loop);
}



window.warusagashiLaunch=function(ctx2){
  actx=ctx2||null;
  if(actx){ try{ master=actx.createGain(); master.gain.value=0.9; master.connect(actx.destination); }catch(e){ master=null; } }
  cv=document.getElementById('war-cv'); ctx=cv?cv.getContext('2d'):null;
  var v=document.getElementById('war-ver'); if(v) v.textContent='js '+WARVER;
  if(cv && !cv.__warb){ cv.__warb=1;
    if('PointerEvent' in window){ cv.addEventListener('pointerdown',onDown,{passive:false}); }
    else { cv.addEventListener('touchstart',onDown,{passive:false}); cv.addEventListener('mousedown',onDown,{passive:false}); }
  }
  window.addEventListener('resize',onResize);
  state=ST.TITLE; resize();
  running=true; last=performance.now(); rafId=requestAnimationFrame(loop);
};
window.warusagashiShutdown=function(){
  running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0;
  try{ stopBGM(); }catch(e){}
  window.removeEventListener('resize',onResize);
  try{ if(master) master.disconnect(); }catch(e){} master=null; actx=null;
};
})();
