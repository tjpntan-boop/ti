
(function(){
"use strict";
var FTVER='2.46.0';
const DW=600, DH=900;
var cv=null, ctx=null;
let scale=1;
var rafId=0, running=false, wrapEl=null;
function resize(){
  if(!cv||!ctx) return;
  var st=cv.parentElement, w=st.clientWidth, h=st.clientHeight, dpr=window.devicePixelRatio||1;
  if(!w||!h) return;
  scale=Math.min(w/DW, h/DH);
  cv.width=Math.max(1,(DW*dpr*scale)|0); cv.height=Math.max(1,(DH*dpr*scale)|0);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
}
function onResize(){ resize(); }

// 座標定数
const GROUND=800, LAUNCH_X=95, LAUNCH_Y=700;
const RIM_Y=300, RIM_FX=388, BB_X=478, BB_TOP=150, BB_BOT=330;
const BASKET_L=RIM_FX+8, BASKET_R=BB_X-6, RIM_R=7, G=1750;

// 状態
const ST={TITLE:0,INTRO:1,AIM:2,CPU:3,FLY:4,PINCH:5,EVENT:6,RES:7,OVER:8,AIM2:9};
let state=ST.TITLE;
let turn='player';              // 'player' | 'cpu'
let pShot=0,cShot=0, pMade=0,cMade=0, pRes=[],cRes=[];
let meter=0,meterDir=1, vmeter=0,vmeterDir=1, lockedP=0.5;
let cpuTargetP=0.6, cpuTargetV=0.5, cpuPhase=1;
let introT=0, resTimer=0, resText='', resColor='#fff', resBig=false;
let pinchT=0, cheerT=0;

const chikuwa={x:LAUNCH_X,y:LAUNCH_Y,vx:0,vy:0,ang:-0.5,av:0,L:70,r:10,scored:false,caught:false,settleT:0};
let ev=null, succeedLater=null;

// ===== Audio =====
var actx=null, master=null;
function tone(f,dur,type,vol,slideTo){ if(!actx)return; const t=actx.currentTime;
  const o=actx.createOscillator(),g=actx.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
  if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,t+dur);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol||0.2,t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g).connect(master); o.start(t); o.stop(t+dur); }
function noise(dur,vol,filterF){ if(!actx)return; const t=actx.currentTime;
  const n=Math.floor(actx.sampleRate*dur), b=actx.createBuffer(1,n,actx.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const s=actx.createBufferSource(); s.buffer=b; const g=actx.createGain(), f=actx.createBiquadFilter();
  f.type='lowpass'; f.frequency.value=filterF||1200;
  g.gain.setValueAtTime(vol||0.25,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t+dur); }
// 口笛（ヒュー）：mode 'up'=上昇 / 'updown'=上がって下がる（指笛・もてはやし）
function whistle(delay,mode){ if(!actx)return; const t=actx.currentTime+(delay||0);
  const o=actx.createOscillator(),g=actx.createGain(),f=actx.createBiquadFilter(),vib=actx.createOscillator(),vg=actx.createGain();
  o.type='sine'; f.type='bandpass'; f.frequency.value=1700; f.Q.value=5;
  vib.type='sine'; vib.frequency.value=6; vg.gain.value=40; vib.connect(vg).connect(o.frequency);
  if(mode==='updown'){
    o.frequency.setValueAtTime(900,t); o.frequency.exponentialRampToValueAtTime(2000,t+0.18);
    o.frequency.exponentialRampToValueAtTime(1100,t+0.46);
  } else {
    o.frequency.setValueAtTime(800,t); o.frequency.exponentialRampToValueAtTime(1900,t+0.34);
  }
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.16,t+0.05);
  g.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
  o.connect(f).connect(g).connect(master);
  o.start(t); o.stop(t+0.52); vib.start(t); vib.stop(t+0.52); }
const SFX={
  whoosh(){noise(0.25,0.18,900);},
  clank(){tone(520,0.12,'square',0.18,300);tone(180,0.1,'triangle',0.12);},
  swish(){noise(0.3,0.22,2500);tone(880,0.18,'sine',0.12,1400);},
  cheer(){ // 歓声（強め・長め）
    noise(0.7,0.26,2000); tone(660,0.4,'sine',0.12,990);
    setTimeout(()=>{noise(0.5,0.2,1600);tone(784,0.3,'sine',0.1);} ,150);
    setTimeout(()=>tone(988,0.3,'sine',0.1),300);
  },
  fart(){ if(!actx)return; const t=actx.currentTime; const o=actx.createOscillator(),g=actx.createGain();
    o.type='sawtooth'; o.frequency.setValueAtTime(120,t); o.frequency.exponentialRampToValueAtTime(55,t+0.18);
    g.gain.setValueAtTime(0.25,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
    o.connect(g).connect(master); o.start(t); o.stop(t+0.2); noise(0.18,0.12,500); },
  obahan(){tone(440,0.12,'square',0.16,660);setTimeout(()=>tone(660,0.14,'square',0.16,520),120);},
  neko(){tone(900,0.1,'sine',0.16,1300);setTimeout(()=>tone(1300,0.08,'sine',0.12),90);},
  tsubame(){tone(1600,0.06,'sine',0.14,2200);setTimeout(()=>tone(2000,0.06,'sine',0.12,2600),70);},
  pinch(){tone(300,0.18,'triangle',0.14,220);},
  fail(){tone(300,0.3,'sine',0.18,120);},
  lock(){tone(720,0.06,'square',0.14,520);},
  fanfare(){ // 結果発表：ヒューヒュー＋歓声＋ファンファーレ
    whistle(0,'up'); whistle(0.38,'updown'); whistle(0.95,'up');
    noise(0.9,0.22,2200); setTimeout(()=>noise(0.7,0.18,1800),300);
    [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.3,'triangle',0.12),200+i*110));
  }
};

// ===== オープニングBGM（オリジナル・ファミコン風の怪しい冒険曲）=====
let bgmGain=null, bgm={on:false,timer:null,step:0,time:0}, bgmReady=false;
const NT={'-':0,E2:82.41,F2:87.31,G2:98.00,A2:110.00,
  E4:329.63,F4:349.23,G4:392.00,A4:440.00,Bb4:466.16,B4:493.88,
  C5:523.25,D5:587.33,Eb5:622.25,E5:659.25,F5:698.46,G5:783.99};
// 16ステップ×4小節。Aマイナー＋Phrygian(Bb)で怪しい冒険感
const LEAD=['A4','-','C5','-','E5','-','D5','C5', 'B4','-','C5','-','A4','-','-','-',
            'F4','-','A4','-','C5','-','Bb4','A4','G4','-','E4','-','A4','-','-','-'];
const BASS=['A2','-','A2','-','A2','-','A2','-', 'A2','-','A2','-','A2','-','A2','-',
            'F2','-','F2','-','F2','-','F2','-', 'E2','-','E2','-','E2','-','E2','-'];
const HAT =[0,1,0,1,0,1,0,1, 0,1,0,1,0,1,0,1, 0,1,0,1,0,1,0,1, 0,1,0,1,0,1,0,1];
const KICK=[1,0,0,0,1,0,0,0, 1,0,0,0,1,0,0,0, 1,0,0,0,1,0,0,0, 1,0,0,0,1,0,0,0];
const LEN=LEAD.length, STEP=0.135;
function bsq(freq,t,dur,vol,type){ if(!freq||!actx)return; const o=actx.createOscillator(),g=actx.createGain();
  o.type=type||'square'; o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur*0.95);
  o.connect(g).connect(bgmGain); o.start(t); o.stop(t+dur); }
function bnoise(t,dur,vol,f){ if(!actx)return; const n=Math.floor(actx.sampleRate*dur),b=actx.createBuffer(1,n,actx.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1; const s=actx.createBufferSource();s.buffer=b;
  const g=actx.createGain(),fl=actx.createBiquadFilter(); fl.type='highpass'; fl.frequency.value=f||5000;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(fl).connect(g).connect(bgmGain); s.start(t); s.stop(t+dur); }
function bgmStep(i,t){
  bsq(NT[LEAD[i]],t,STEP*1.25,0.13,'square');
  bsq(NT[BASS[i]],t,STEP*1.7,0.13,'triangle');
  if(HAT[i]) bnoise(t,0.025,0.05,7000);
  if(KICK[i]){ const o=actx.createOscillator(),g=actx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(50,t+0.12);
    g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.14);
    o.connect(g).connect(bgmGain); o.start(t); o.stop(t+0.15); } }
function startBGM(){ if(!actx||bgm.on)return; bgm.on=true;
  bgmGain=actx.createGain(); bgmGain.gain.setValueAtTime(0,actx.currentTime);
  bgmGain.gain.linearRampToValueAtTime(0.18,actx.currentTime+0.4); bgmGain.connect(master);
  bgm.step=0; bgm.time=actx.currentTime+0.1; bgm.timer=setInterval(bgmSched,25); }
function bgmSched(){ if(!bgm.on)return; const ahead=actx.currentTime+0.2;
  while(bgm.time<ahead){ bgmStep(bgm.step%LEN,bgm.time); bgm.time+=STEP; bgm.step++; } }
function stopBGM(){ if(!bgm.on)return; bgm.on=false; clearInterval(bgm.timer);
  if(bgmGain) bgmGain.gain.linearRampToValueAtTime(0,actx.currentTime+0.2); }

// ===== 入力 =====
function tap(e){ e.preventDefault();
  if(state===ST.TITLE){ if(!bgmReady){ bgmReady=true; startBGM(); } else { stopBGM(); startGame(); } }
  else if(state===ST.AIM){ lockedP=meter; SFX.lock&&SFX.lock(); vmeter=0; vmeterDir=1; state=ST.AIM2; }
  else if(state===ST.AIM2) shoot();
  else if(state===ST.OVER) startGame();
}

// ===== 進行 =====
function startGame(){ stopBGM(); turn='player'; pShot=cShot=pMade=cMade=0; pRes=[];cRes=[]; startTurn(); }
function startTurn(){ introT=0.85; state=ST.INTRO; }
function beginShot(){ resetChikuwa(); meter=0; meterDir=1; vmeter=0; vmeterDir=1; cheerT=0;
  if(turn==='player'){ state=ST.AIM; }
  else { cpuTargetP=pickCpuPower(); cpuTargetV=pickCpuAngle(); cpuPhase=1; state=ST.CPU; }
}
function advance(){
  if(turn==='player'){ pShot++; turn='cpu'; }
  else { cShot++; turn='player'; }
  if(pShot>=3 && cShot>=3){ state=ST.OVER; SFX.fanfare(); return; }
  startTurn();
}
function resetChikuwa(){ const c=chikuwa;
  c.x=LAUNCH_X;c.y=LAUNCH_Y;c.vx=0;c.vy=0;c.ang=-0.5;c.av=0;c.scored=false;c.caught=false;c.settleT=0; }
function pickCpuPower(){ const r=Math.random();
  if(r<0.60) return 0.55+Math.random()*0.13;   // 好機
  if(r<0.85) return 0.44+Math.random()*0.10;   // 短い→つっかえ・ラッキー
  return 0.30+Math.random()*0.12;               // ミス寄り
}
function pickCpuAngle(){ const r=Math.random();
  if(r<0.62) return 0.42+Math.random()*0.16;    // 良い角度帯
  if(r<0.84) return 0.28+Math.random()*0.12;    // やや低い
  return 0.60+Math.random()*0.18;               // 高すぎ・ミス寄り
}
function shoot(){ SFX.whoosh();
  const p=lockedP, speed=1040+p*520;
  const angle=-1.02-vmeter*0.34+(Math.random()-0.5)*0.02; // 縦メーターで角度（約58°〜78°）
  const c=chikuwa; c.vx=Math.cos(angle)*speed; c.vy=Math.sin(angle)*speed;
  c.av=(Math.random()*2-1)*5+7; c.scored=false; c.caught=false; c.settleT=0;
  state=ST.FLY;
}
function tips(c){ const dx=Math.cos(c.ang)*c.L/2, dy=Math.sin(c.ang)*c.L/2;
  return [{x:c.x-dx,y:c.y-dy},{x:c.x+dx,y:c.y+dy}]; }

// ===== 物理 =====
let prevCY=LAUNCH_Y;
function physics(dt){ const c=chikuwa; prevCY=c.y;
  c.vy+=G*dt; c.x+=c.vx*dt; c.y+=c.vy*dt; c.ang+=c.av*dt; c.av*=0.995;
  let hit=false; const ps=tips(c);
  // 前リム
  for(const t of ps){ const dx=t.x-RIM_FX,dy=t.y-RIM_Y,d=Math.hypot(dx,dy);
    if(d<c.r+RIM_R){ const nx=dx/(d||1),ny=dy/(d||1),vn=c.vx*nx+c.vy*ny;
      if(vn<0){ c.vx-=1.45*vn*nx;c.vy-=1.45*vn*ny;c.vx*=0.72;c.vy*=0.72;
        c.av+=(t.x>c.x?1:-1)*Math.abs(vn)*0.012+(Math.random()-0.5)*2;
        const pen=(c.r+RIM_R)-d; c.x+=nx*pen;c.y+=ny*pen; if(!hit)SFX.clank(); hit=true;
        const sp2=Math.hypot(c.vx,c.vy);
        if(sp2<620 && !c.scored && !c.caught){ // つっかえ → ピンチ演出へ
          c.caught=true; c.x=RIM_FX+16+Math.random()*34; c.y=RIM_Y-c.r-1;
          c.vx=0;c.vy=0;c.av=0;c.ang=0; pinchT=0.85; SFX.pinch(); state=ST.PINCH; return; }
      } } }
  // バックボード
  for(const t of ps){ if(t.x>BB_X-2&&t.x<BB_X+14&&t.y>BB_TOP&&t.y<BB_BOT){
    if(c.vx>0){c.vx=-c.vx*0.5;c.av+=(Math.random()-0.5)*4;} c.x-=(t.x-(BB_X-2)); if(!hit)SFX.clank(); hit=true; } }
  // ゴール（クリーン）
  if(!c.scored && prevCY<=RIM_Y && c.y>RIM_Y && c.vy>0 && c.x>BASKET_L-4 && c.x<BASKET_R+4){
    c.scored=true; succeed('入った！',false); return; }
  // 床・場外
  if(c.y>GROUND-c.r || c.x>DW+80 || c.x<-80){ if(!c.scored) miss('ハズレ…'); }
}

// ===== 結果 =====
function storeRes(txt,made){ if(turn==='player'){ pRes[pShot]=txt; if(made)pMade++; }
  else { cRes[cShot]=txt; if(made)cMade++; } }
function succeed(txt,lucky){ storeRes(lucky?'ラッキー！':'入った！',true);
  resText=txt; resColor='#ffd23f'; resBig=true; cheerT=1.4;
  SFX.swish(); setTimeout(()=>SFX.cheer(),120); toResult(); }
function miss(txt){ storeRes(txt,false); resText=txt; resColor='#9aa6c0'; resBig=false; SFX.fail(); toResult(); }
function toResult(){ state=ST.RES; resTimer=1.6; }

function rollLucky(){
  if(Math.random()<0.62){ const t=['fart','obahan','neko','tsubame'][Math.floor(Math.random()*4)]; startEvent(t); }
  else miss('ポロリ…ハズレ');
}
function startEvent(type){ state=ST.EVENT; ev={type,t:0,dur:1.4,pushed:false};
  if(SFX[type])SFX[type](); }
function updateEvent(dt){ const c=chikuwa; ev.t+=dt;
  if(!ev.pushed && ev.t>0.5){ ev.pushed=true;
    c.vx=120+Math.random()*60; c.vy=30; c.av=4; c.scored=true; succeedLater=true; }
  if(ev.pushed){ c.vy+=G*dt*0.5; c.x+=c.vx*dt; c.y+=c.vy*dt; c.ang+=c.av*dt;
    if(c.y>RIM_Y+12){ succeedLater=null; ev=null; succeed('ラッキー！入った！',true); } }
  if(ev && ev.t>ev.dur+0.7){ ev=null; if(!c.scored) miss('ポロリ…ハズレ'); }
}

// ===== 描画 =====
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawChikuwa(c){ ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.ang);
  const g=ctx.createLinearGradient(0,-c.r,0,c.r);
  g.addColorStop(0,'#f6e2b8');g.addColorStop(0.5,'#e8c884');g.addColorStop(1,'#caa45e');
  ctx.fillStyle=g; roundRect(-c.L/2,-c.r,c.L,c.r*2,c.r); ctx.fill();
  ctx.strokeStyle='#a9823f'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='rgba(150,100,40,.35)'; for(let i=-2;i<=2;i++)ctx.fillRect(i*12-1,-c.r+1,2,c.r*2-2);
  ctx.fillStyle='#3a2a14';
  ctx.beginPath();ctx.ellipse(-c.L/2+3,0,4,c.r-3,0,0,7);ctx.fill();
  ctx.beginPath();ctx.ellipse(c.L/2-3,0,4,c.r-3,0,0,7);ctx.fill(); ctx.restore(); }
function drawHoop(){
  ctx.fillStyle='#fdfdfd'; ctx.strokeStyle='#c2c8d6'; ctx.lineWidth=3;
  ctx.fillRect(BB_X,BB_TOP,16,BB_BOT-BB_TOP); ctx.strokeRect(BB_X,BB_TOP,16,BB_BOT-BB_TOP);
  ctx.strokeStyle='#ff7043'; ctx.lineWidth=2; ctx.strokeRect(BB_X+3,RIM_Y-46,9,36);
  ctx.fillStyle='#8b95a8'; ctx.fillRect(BB_X+16,BB_TOP+10,8,GROUND-BB_TOP-10);
  ctx.strokeStyle='#ff5722'; ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(RIM_FX,RIM_Y);ctx.lineTo(BB_X,RIM_Y);ctx.stroke();
  ctx.fillStyle='#ff5722'; ctx.beginPath();ctx.arc(RIM_FX,RIM_Y,5,0,7);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.4;
  for(let i=0;i<=6;i++){ const x=RIM_FX+i*((BB_X-RIM_FX)/6);
    ctx.beginPath();ctx.moveTo(x,RIM_Y);ctx.lineTo(RIM_FX+12+(i*((BB_X-RIM_FX-24)/6)),RIM_Y+50);ctx.stroke(); }
  ctx.beginPath();ctx.moveTo(RIM_FX+10,RIM_Y+28);ctx.lineTo(BB_X-2,RIM_Y+28);ctx.stroke(); }
function drawCourt(){
  ctx.fillStyle='#1d2740'; ctx.fillRect(0,0,DW,DH);
  const bounce = cheerT>0 ? Math.sin(Date.now()/60)*4 : 0;
  for(let y=40;y<150;y+=22){ for(let x=10;x<DW;x+=26){
    ctx.fillStyle=`hsl(${(x*7+y*3)%360},45%,${50+((x+y)%20)}%)`; ctx.globalAlpha=.5;
    const by = cheerT>0 ? Math.sin(Date.now()/60 + x*0.3)*4 : 0;
    ctx.beginPath();ctx.arc(x+13,y+by,6,0,7);ctx.fill(); } }
  ctx.globalAlpha=1;
  const fg=ctx.createLinearGradient(0,GROUND-30,0,DH);
  fg.addColorStop(0,'#d8a35a');fg.addColorStop(1,'#b07e3c'); ctx.fillStyle=fg;
  ctx.fillRect(0,GROUND-20,DW,DH-GROUND+20);
  ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(0,GROUND-20);ctx.lineTo(DW,GROUND-20);ctx.stroke();
  ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(LAUNCH_X+30,GROUND-20);ctx.lineTo(LAUNCH_X+30,GROUND+30);ctx.stroke();ctx.setLineDash([]); }
function drawShooter(col){ ctx.fillStyle=col||'#3a3f55';
  ctx.beginPath();ctx.arc(LAUNCH_X,LAUNCH_Y+70,18,0,7);ctx.fill();
  ctx.fillStyle='#5a6178'; roundRect(LAUNCH_X-16,LAUNCH_Y+85,32,55,8); ctx.fill(); }
function drawMeter(label,frozen){
  const mx=70,my=GROUND+55,mw=DW-140,mh=22;
  ctx.fillStyle='#0d1322'; roundRect(mx,my,mw,mh,11); ctx.fill();
  const g=ctx.createLinearGradient(mx,0,mx+mw,0);
  g.addColorStop(0,'#ff5252');g.addColorStop(0.45,'#ffd23f');g.addColorStop(0.6,'#6bd968');g.addColorStop(0.75,'#ffd23f');g.addColorStop(1,'#ff5252');
  ctx.globalAlpha=frozen?0.5:1; ctx.fillStyle=g; roundRect(mx+3,my+3,mw-6,mh-6,8); ctx.fill(); ctx.globalAlpha=1;
  const val=frozen?lockedP:meter, px=mx+3+(mw-6)*val;
  ctx.fillStyle=frozen?'#ffd23f':'#fff'; ctx.fillRect(px-2,my-6,4,mh+12);
  ctx.fillStyle=frozen?'#ffd23f':'#fff'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center'; ctx.fillText(label,DW/2,my-14); }
function drawMeterV(label){
  const mx=30,my=250,mw=24,mh=380;
  ctx.fillStyle='#0d1322'; roundRect(mx,my,mw,mh,12); ctx.fill();
  const g=ctx.createLinearGradient(0,my,0,my+mh); // 上=高い角度 下=低い角度、中央が好機
  g.addColorStop(0,'#ff5252');g.addColorStop(0.30,'#ffd23f');g.addColorStop(0.46,'#6bd968');g.addColorStop(0.62,'#ffd23f');g.addColorStop(1,'#ff5252');
  ctx.fillStyle=g; roundRect(mx+3,my+3,mw-6,mh-6,9); ctx.fill();
  const py=my+3+(mh-6)*(1-vmeter); // vmeter=1 を上に
  ctx.fillStyle='#fff'; ctx.fillRect(mx-6,py-2,mw+12,4);
  ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
  ctx.save(); ctx.translate(mx+mw/2,my-12); ctx.fillText(label,0,0); ctx.restore(); }
function drawHUD(){
  ctx.textAlign='left'; ctx.font='bold 24px sans-serif';
  ctx.fillStyle = turn==='player'?'#ffd23f':'#fff'; ctx.fillText(`あなた ${pMade}`,20,40);
  ctx.textAlign='right'; ctx.fillStyle = turn==='cpu'?'#ff7043':'#fff'; ctx.fillText(`${cMade} CPU`,DW-20,40);
  ctx.textAlign='center'; ctx.fillStyle='#cdd5e6'; ctx.font='bold 18px sans-serif';
  const n = turn==='player'?pShot:cShot;
  ctx.fillText(`${turn==='player'?'あなた':'CPU'}の ${Math.min(n+1,3)}本目 / 3`,DW/2,40);
  // 残弾
  for(let i=0;i<3;i++){ const arr=turn==='player'?pRes:cRes;
    ctx.fillStyle = i<n ? (arr[i]&&(arr[i].includes('入')||arr[i].includes('ラッキー'))?'#ffd23f':'#566') : '#888';
    ctx.beginPath();ctx.arc(34+i*26,62,8,0,7);ctx.fill(); } }
function banner(txt,col,y){ ctx.textAlign='center'; ctx.font='bold 40px sans-serif';
  ctx.lineWidth=6; ctx.strokeStyle='#1a1020'; ctx.strokeText(txt,DW/2,y||170);
  ctx.fillStyle=col; ctx.fillText(txt,DW/2,y||170); }
function drawCheer(){ if(cheerT<=0)return;
  ctx.save(); ctx.globalAlpha=Math.min(1,cheerT*1.5);
  banner('わーっ！🎉','#fff',110); ctx.restore(); }

// 助っ人たち
function drawHelper(type){
  if(type==='fart'){
    ctx.globalAlpha=.85; ctx.fillStyle='#bfe6a0';
    for(let i=0;i<6;i++){ const a=i/6*7+ev.t*2;
      ctx.beginPath();ctx.arc(RIM_FX-10+Math.cos(a)*16,RIM_Y+25+Math.sin(a)*14,14,0,7);ctx.fill(); }
    ctx.globalAlpha=1; ctx.fillStyle='#fff'; ctx.font='bold 28px sans-serif'; ctx.textAlign='center';
    ctx.fillText('プッ💨',RIM_FX-10,RIM_Y+30); banner('神様のおなら！','#9be15d');
  } else if(type==='obahan'){
    const px=BB_X+62,py=RIM_Y+8;
    ctx.fillStyle='#f3c8a0';ctx.beginPath();ctx.arc(px,py,26,0,7);ctx.fill();
    ctx.fillStyle='#c026d3';for(let i=0;i<8;i++){const a=i/8*7;ctx.beginPath();ctx.arc(px+Math.cos(a)*24,py-14+Math.sin(a)*10,8,0,7);ctx.fill();}
    ctx.fillStyle='#000';ctx.beginPath();ctx.arc(px-9,py-2,3,0,7);ctx.arc(px+9,py-2,3,0,7);ctx.fill();
    ctx.strokeStyle='#a00';ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py+8,9,0.1,Math.PI-0.1);ctx.stroke();
    ctx.fillStyle='#e8a33d';roundRect(px-26,py+24,52,40,10);ctx.fill();
    ctx.fillStyle='#6b3e0a';for(let i=0;i<8;i++)ctx.fillRect(px-22+(i%4)*12,py+30+((i>>2)*14),5,5);
    banner('ええやないのー！','#ffb74d');
  } else if(type==='neko'){
    const px=RIM_FX-30,py=RIM_Y+12;
    ctx.fillStyle='#9aa0ad';ctx.beginPath();ctx.arc(px,py,22,0,7);ctx.fill(); // 顔
    ctx.beginPath();ctx.moveTo(px-18,py-14);ctx.lineTo(px-26,py-34);ctx.lineTo(px-6,py-20);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(px+18,py-14);ctx.lineTo(px+26,py-34);ctx.lineTo(px+6,py-20);ctx.closePath();ctx.fill();
    ctx.fillStyle='#000';ctx.beginPath();ctx.arc(px-8,py-2,3,0,7);ctx.arc(px+8,py-2,3,0,7);ctx.fill();
    ctx.strokeStyle='#000';ctx.lineWidth=1.5; // ひげ
    for(let s=-1;s<=1;s+=2){ctx.beginPath();ctx.moveTo(px+s*6,py+6);ctx.lineTo(px+s*26,py+2);ctx.stroke();ctx.beginPath();ctx.moveTo(px+s*6,py+9);ctx.lineTo(px+s*26,py+11);ctx.stroke();}
    ctx.fillStyle='#f7c6d2';ctx.beginPath();ctx.arc(px,py+6,3,0,7);ctx.fill(); // 鼻
    banner('ねこパンチ！','#cfd6e6');
    ctx.fillStyle='#fff';ctx.font='bold 24px sans-serif';ctx.fillText('ニャッ！',px,py-40);
  } else { // tsubame
    const px=RIM_FX+10,py=RIM_Y-40+Math.sin(ev.t*12)*6;
    ctx.fillStyle='#2b3a55';
    ctx.beginPath();ctx.ellipse(px,py,16,8,0,0,7);ctx.fill(); // 胴
    ctx.beginPath();ctx.moveTo(px-4,py);ctx.lineTo(px-30,py-16);ctx.lineTo(px-8,py+2);ctx.closePath();ctx.fill(); // 翼
    ctx.beginPath();ctx.moveTo(px+10,py);ctx.lineTo(px+30,py-6);ctx.lineTo(px+30,py+6);ctx.closePath();ctx.fill(); // 尾
    ctx.fillStyle='#e0a020';ctx.beginPath();ctx.moveTo(px+14,py-2);ctx.lineTo(px+22,py);ctx.lineTo(px+14,py+2);ctx.closePath();ctx.fill();
    banner('つばめアタック！','#8fd0ff');
    ctx.fillStyle='#fff';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText('チュン！',px,py-18);
  }
}

function drawTitle(){
  drawCourt(); drawHoop();
  ctx.fillStyle='rgba(255,82,34,.95)'; ctx.save(); ctx.translate(DW/2,205); ctx.rotate(-0.04);
  roundRect(-262,-58,524,116,16); ctx.fill(); ctx.restore();
  ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.font='bold 54px sans-serif'; ctx.fillText('ちくわ',DW/2-2,195);
  ctx.font='bold 48px sans-serif'; ctx.fillText('フリースロー',DW/2,246);
  const tc={x:DW/2,y:420,ang:Math.sin(Date.now()/400)*0.5,L:90,r:13}; drawChikuwa(tc);
  ctx.fillStyle='#fff'; ctx.font='bold 22px sans-serif'; ctx.fillText('CPUと3本勝負！',DW/2,545);
  ctx.font='18px sans-serif'; ctx.fillText('つっかえても…助っ人が押し込む！？',DW/2,578);
  if(Math.floor(Date.now()/500)%2===0){ ctx.font='bold 30px sans-serif'; ctx.fillStyle='#ffd23f';
    ctx.fillText(bgmReady?'タップでスタート ▶':'タップ ♪',DW/2,680); }
  if(bgmReady){ ctx.fillStyle='#7fd6ff'; ctx.font='15px sans-serif'; ctx.fillText('♪ オープニングテーマ',DW/2,712); } }

function drawOver(){
  drawCourt(); drawHoop();
  ctx.fillStyle='rgba(10,12,20,.66)'; ctx.fillRect(0,0,DW,DH);
  ctx.textAlign='center';
  const win = pMade>cMade?'あなたの勝ち！🎉': pMade<cMade?'CPUの勝ち…':'ひきわけ！';
  const wcol= pMade>cMade?'#ffd23f': pMade<cMade?'#ff7043':'#cdd5e6';
  ctx.font='bold 46px sans-serif'; ctx.fillStyle=wcol; ctx.fillText(win,DW/2,180);
  ctx.font='bold 80px sans-serif'; ctx.fillStyle='#fff'; ctx.fillText(`${pMade} - ${cMade}`,DW/2,300);
  ctx.font='bold 22px sans-serif'; ctx.fillStyle='#9fb0d0';
  ctx.fillText('あなた                CPU',DW/2,335);
  ctx.font='20px sans-serif';
  for(let i=0;i<3;i++){
    ctx.fillStyle=(pRes[i]&&(pRes[i].includes('入')||pRes[i].includes('ラッキー')))?'#ffd23f':'#8a93a8';
    ctx.textAlign='right'; ctx.fillText(pRes[i]||'-',DW/2-30,400+i*32);
    ctx.fillStyle=(cRes[i]&&(cRes[i].includes('入')||cRes[i].includes('ラッキー')))?'#ff7043':'#8a93a8';
    ctx.textAlign='left'; ctx.fillText(cRes[i]||'-',DW/2+30,400+i*32);
  }
  ctx.textAlign='center';
  if(Math.floor(Date.now()/500)%2===0){ ctx.font='bold 28px sans-serif'; ctx.fillStyle='#6bd968';
    ctx.fillText('タップでもう一回',DW/2,600); } }

function drawIntro(){ drawCourt(); drawHoop(); drawShooter(turn==='cpu'?'#7a3030':'#3a3f55');
  const label = turn==='player'?'あなたのターン':'CPUのターン';
  const col = turn==='player'?'#ffd23f':'#ff7043';
  ctx.save(); const s=1+Math.max(0,(introT-0.7))*0.5; ctx.translate(DW/2,DH/2); ctx.scale(s,s);
  ctx.textAlign='center'; ctx.font='bold 40px sans-serif';
  ctx.lineWidth=6; ctx.strokeStyle='#1a1020'; ctx.strokeText(label,0,0);
  ctx.fillStyle=col; ctx.fillText(label,0,0); ctx.restore();
  ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='bold 30px sans-serif';
  ctx.fillText(`あなた ${pMade} - ${cMade} CPU`,DW/2,DH/2+58);
  const round=Math.min((turn==='player'?pShot:cShot)+1,3);
  ctx.fillStyle='#9fb0d0'; ctx.font='18px sans-serif';
  ctx.fillText(`第${round}ラウンド`,DW/2,DH/2+90); }

// ===== ループ =====
let last=performance.now();
function loop(now){ let dt=(now-last)/1000; last=now; if(dt>0.05)dt=0.05;
  if(cheerT>0)cheerT-=dt;
  if(state===ST.INTRO){ introT-=dt; if(introT<=0) beginShot(); }
  else if(state===ST.AIM){ meter+=meterDir*dt*1.7; if(meter>=1){meter=1;meterDir=-1;} if(meter<=0){meter=0;meterDir=1;} }
  else if(state===ST.AIM2){ vmeter+=vmeterDir*dt*2.0; if(vmeter>=1){vmeter=1;vmeterDir=-1;} if(vmeter<=0){vmeter=0;vmeterDir=1;} }
  else if(state===ST.CPU){
    if(cpuPhase===1){ meter+=meterDir*dt*1.7; if(meter>=1){meter=1;meterDir=-1;} if(meter<=0){meter=0;meterDir=1;}
      if(Math.abs(meter-cpuTargetP)<0.025){ lockedP=meter; SFX.lock(); cpuPhase=2; vmeter=0; vmeterDir=1; } }
    else { vmeter+=vmeterDir*dt*2.0; if(vmeter>=1){vmeter=1;vmeterDir=-1;} if(vmeter<=0){vmeter=0;vmeterDir=1;}
      if(Math.abs(vmeter-cpuTargetV)<0.03){ shoot(); } } }
  else if(state===ST.FLY){ physics(dt); }
  else if(state===ST.PINCH){ pinchT-=dt; chikuwa.ang=Math.sin((0.85-pinchT)*20)*0.08*Math.max(0,pinchT*1.2);
    if(pinchT<=0) rollLucky(); }
  else if(state===ST.EVENT){ updateEvent(dt); }
  else if(state===ST.RES){ resTimer-=dt; if(resTimer<=0) advance(); }

  ctx.clearRect(0,0,DW,DH);
  if(state===ST.TITLE){ drawTitle(); }
  else if(state===ST.OVER){ drawOver(); }
  else if(state===ST.INTRO){ drawIntro(); }
  else {
    drawCourt(); drawHoop(); drawShooter(turn==='cpu'?'#7a3030':'#3a3f55');
    drawChikuwa(chikuwa); drawHUD();
    if(state===ST.AIM) drawMeter('①パワー：タップ！',false);
    if(state===ST.AIM2){ drawMeter('パワー決定！',true); drawMeterV('②角度！'); }
    if(state===ST.CPU){ if(cpuPhase===1) drawMeter('CPU パワー…',false);
      else { drawMeter('',true); drawMeterV('CPU 角度…'); } }
    if(state===ST.PINCH) banner('つっかえた…！','#ff8a3d');
    if(state===ST.EVENT && ev) drawHelper(ev.type);
    if(state===ST.RES){ ctx.fillStyle='rgba(10,12,20,.45)'; ctx.fillRect(0,0,DW,DH);
      ctx.textAlign='center'; ctx.font=`bold ${resBig?54:46}px sans-serif`;
      ctx.lineWidth=7; ctx.strokeStyle='#1a1020'; ctx.strokeText(resText,DW/2,DH/2);
      ctx.fillStyle=resColor; ctx.fillText(resText,DW/2,DH/2); }
    drawCheer();
  }
  if(running) rafId=requestAnimationFrame(loop);
}








function ftTap(e){ if(e.target && e.target.closest && e.target.closest('button')) return; tap(e); }
window.freethrowLaunch=function(ctx2){
  actx=ctx2||null;
  if(actx){ try{ master=actx.createGain(); master.gain.value=0.9; master.connect(actx.destination); }catch(e){ master=null; } }
  cv=document.getElementById('ft-cv'); ctx=cv?cv.getContext('2d'):null;
  var v=document.getElementById('ft-ver'); if(v) v.textContent='js '+FTVER;
  wrapEl=document.getElementById('ft-wrap');
  if(wrapEl && !wrapEl.__ftb){ wrapEl.__ftb=1;
    wrapEl.addEventListener('pointerdown',ftTap,{passive:false});
    wrapEl.addEventListener('touchstart',ftTap,{passive:false});
  }
  window.addEventListener('resize',onResize);
  state=ST.TITLE; bgmReady=true; cheerT=0;
  resize(); startBGM();
  running=true; last=performance.now(); rafId=requestAnimationFrame(loop);
};
window.freethrowShutdown=function(){
  running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0;
  try{ stopBGM(); }catch(e){}
  window.removeEventListener('resize',onResize);
  try{ if(master) master.disconnect(); }catch(e){} master=null; actx=null;
};
})();
