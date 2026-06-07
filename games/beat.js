/* ===== 🎵 ちくわビート 本体（独立スコープ / モジュール）=====
   4レーンを流れるちくわを判定ラインでタップするリズムゲーム。
   レーン入力＝画面の左右4分割タップ／キー D F J K。
   window.beatLaunch(audioCtx)/window.beatShutdown()を公開。 */
(function(){
  'use strict';

  var LW=900, LH=506;
  var LANES=4, JUDGE_Y=LH*0.82, TOP_Y=-50, APPROACH=1.4;
  var BPM=128, beatDur=60/BPM;
  var W_PERFECT=0.06, W_GOOD=0.13;            // 判定ウィンドウ(秒)
  var SC_PERFECT=300, SC_GOOD=100;
  var LANE_COL=['#ff6b6b','#ffd23f','#4dd2ff','#7cff8a'];
  var LANE_KEY={KeyD:0,KeyF:1,KeyJ:2,KeyK:3};
  var PENTA=[330,392,440,523];                // E G A C（レーン別メロディ）
  var BEST_KEY='beat_best_v1';

  var wrap, stage, canvas, ctx, elBest, titleScr, overScr, startBtn, retryBtn, muteBtn;
  var state='title';   // title | play | result
  var actx=null, master=null, muted=false;

  var chart, songStart, drumIdx, melIdx, songEndT;
  var score, combo, maxCombo, nPerfect, nGood, nMiss, nTotal;
  var laneFlash, judgePop;
  var lastTime=0, rafId=0, running=false, bound=false;

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

  // ---------- ベスト ----------
  function loadBest(){ try{ var v=JSON.parse(localStorage.getItem(BEST_KEY)); return (v&&typeof v.score==='number')?v:null; }catch(e){ return null; } }
  function saveBest(b){ try{ localStorage.setItem(BEST_KEY, JSON.stringify(b)); }catch(e){} }
  function bestHTML(){
    var b=loadBest();
    if(!b) return '<span class="beat-best-head">🏆 ベスト</span><span class="beat-best-row">まだ記録なし</span>';
    var tag = b.ap?'👑 全PERFECT':(b.fc?'🔥 フルコンボ':('ランク '+(b.rank||'-')));
    return '<span class="beat-best-head">🏆 ベスト</span><span class="beat-best-row">'+b.score+' 点（'+tag+'）</span>';
  }

  // ---------- オーディオ ----------
  function ensureMaster(){ if(!actx||master) return; try{ master=actx.createGain(); master.gain.value=muted?0:0.5; master.connect(actx.destination);}catch(e){master=null;} }
  function tone(time,freq,dur,type,vol,glideTo){
    if(!actx||!master) return;
    var o=actx.createOscillator(),g=actx.createGain(); o.type=type||'square'; o.frequency.setValueAtTime(freq,time);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo,time+dur);
    g.gain.setValueAtTime(0.0001,time); g.gain.exponentialRampToValueAtTime(vol||0.2,time+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,time+dur); o.connect(g); g.connect(master); o.start(time); o.stop(time+dur+0.02);
  }
  function noise(time,dur,vol,lp){
    if(!actx||!master) return; var len=Math.max(1,Math.floor(actx.sampleRate*dur)), buf=actx.createBuffer(1,len,actx.sampleRate), d=buf.getChannelData(0);
    for(var i=0;i<len;i++){ d[i]=(Math.random()*2-1)*(1-i/len); }
    var s=actx.createBufferSource(); s.buffer=buf; var f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp||4000;
    var g=actx.createGain(); g.gain.value=vol||0.2; s.connect(f); f.connect(g); g.connect(master); s.start(time);
  }
  function scheduleDrum(time, beat){
    tone(time, 120, 0.16, 'sine', 0.5, 50);            // キック
    if(beat%2===1) noise(time, 0.06, 0.18, 7000);      // ハイハット(裏)
    if(beat%4===2) noise(time, 0.14, 0.3, 3000);       // スネア
    if(beat%4===0){ var roots=[110,110,146.8,98]; tone(time, roots[(Math.floor(beat/4))%4], beatDur*3.4, 'triangle', 0.16); } // ベース
  }
  function scheduleMelody(time, lane){ tone(time, PENTA[lane], 0.22, 'square', 0.14); tone(time, PENTA[lane]*2, 0.10, 'triangle', 0.06); }
  function hitSfx(perfect){ if(!actx||!master||muted) return; var t=actx.currentTime; tone(t, perfect?1320:880, 0.08, 'square', 0.2); if(perfect) tone(t,1760,0.06,'triangle',0.1); }
  function missSfx(){ if(!actx||!master||muted) return; tone(actx.currentTime, 160, 0.12, 'sawtooth', 0.18, 80); }
  function fanfare(){ if(!actx||!master||muted) return; [523,659,784,1047].forEach(function(f,i){ setTimeout(function(){ tone(actx.currentTime,f,0.2,'triangle',0.2); }, i*120); }); }

  // ---------- 譜面生成 ----------
  function buildChart(){
    var seq=[0,2,1,3, 0,2,3,1, 2,0,1,3, 3,1,2,0,
            0,1,2,3, 3,2,1,0, 0,2,1,3, 2,3,1,0,
            0,2,1,3, 0,2,3,1, 1,3,0,2, 2,0,3,1];   // 48拍ぶんのレーン
    var notes=[];
    for(var i=0;i<seq.length;i++){ notes.push({t:(4+i)*beatDur, lane:seq[i], judged:false, hit:false}); }
    // 8分の追い打ち（後半・盛り上げ）
    for(var j=16;j<seq.length;j+=2){ if(j>=24) notes.push({t:(4+j+0.5)*beatDur, lane:(seq[j]+2)%4, judged:false, hit:false}); }
    notes.sort(function(a,b){return a.t-b.t;});
    return notes;
  }

  // ---------- 進行 ----------
  function showTitle(){ state='title'; if(elBest) elBest.innerHTML=bestHTML(); overScr.classList.add('hidden'); titleScr.classList.remove('hidden'); }
  function startPlay(){
    titleScr.classList.add('hidden'); overScr.classList.add('hidden');
    chart=buildChart(); nTotal=chart.length;
    score=0; combo=0; maxCombo=0; nPerfect=0; nGood=0; nMiss=0;
    drumIdx=0; melIdx=0; laneFlash=[0,0,0,0]; judgePop=null;
    songStart=actx ? actx.currentTime+0.25 : performance.now()/1000+0.25;
    songEndT=chart[chart.length-1].t+2.0;
    state='play';
  }
  function songTime(){ return (actx?actx.currentTime:performance.now()/1000) - songStart; }
  function judgeLane(lane){
    if(state!=='play') return; var now=songTime();
    var best=-1, bestDt=999;
    for(var i=0;i<chart.length;i++){ var n=chart[i]; if(n.judged||n.lane!==lane) continue;
      var dt=Math.abs(n.t-now); if(dt<=W_GOOD && dt<bestDt){ bestDt=dt; best=i; } }
    laneFlash[lane]=0.18;
    if(best<0) return;  // 空打ちはノーペナルティ
    var n=chart[best]; n.judged=true; n.hit=true;
    if(bestDt<=W_PERFECT){ score+=SC_PERFECT; nPerfect++; popJudge('PERFECT!','#ffd23f'); hitSfx(true); }
    else { score+=SC_GOOD; nGood++; popJudge('GOOD','#9fe6ff'); hitSfx(false); }
    combo++; if(combo>maxCombo) maxCombo=combo;
  }
  function popJudge(text,color){ judgePop={text:text,color:color,life:0.45}; }
  function rankOf(acc){ if(acc>=0.95) return 'S'; if(acc>=0.85) return 'A'; if(acc>=0.70) return 'B'; return 'C'; }
  function showResult(){
    state='result';
    var maxScore=nTotal*SC_PERFECT; var acc=maxScore?score/maxScore:0;
    var fc=(nMiss===0); var ap=(fc&&nGood===0&&nPerfect===nTotal); var rank=rankOf(acc);
    var b=loadBest(); if(!b || score>b.score){ saveBest({score:score, fc:fc, ap:ap, rank:rank}); }
    var title = ap?'👑 全ちくわPERFECT！':(fc?'🔥 フルコンボ！':('ランク '+rank));
    document.getElementById('beat-res-title').textContent = title;
    document.getElementById('beat-res-score').textContent = score;
    document.getElementById('beat-res-detail').textContent = 'PERFECT '+nPerfect+' ／ GOOD '+nGood+' ／ MISS '+nMiss+'　最大コンボ '+maxCombo;
    document.getElementById('beat-res-acc').textContent = '精度 '+Math.round(acc*100)+'%';
    document.getElementById('beat-res-best').innerHTML = bestHTML();
    overScr.classList.remove('hidden'); fanfare();
  }

  // ---------- 更新 ----------
  function update(dt){
    if(state!=='play') return;
    var now=songTime();
    // オーディオ先読みスケジュール
    if(actx && master){
      var ahead=now+0.18;
      while(drumIdx*beatDur < ahead && drumIdx < 4+48){ scheduleDrum(songStart+drumIdx*beatDur, drumIdx); drumIdx++; }
      while(melIdx<chart.length && chart[melIdx].t < ahead){ scheduleMelody(songStart+chart[melIdx].t, chart[melIdx].lane); melIdx++; }
    }
    // 取り逃し→MISS
    for(var i=0;i<chart.length;i++){ var n=chart[i]; if(!n.judged && (now-n.t) > W_GOOD){ n.judged=true; n.hit=false; nMiss++; combo=0; popJudge('MISS','#ff6b6b'); missSfx(); } }
    for(var l=0;l<LANES;l++){ if(laneFlash[l]>0) laneFlash[l]=Math.max(0,laneFlash[l]-dt); }
    if(judgePop){ judgePop.life-=dt; if(judgePop.life<=0) judgePop=null; }
    if(now>=songEndT) showResult();
  }

  // ---------- 描画 ----------
  function resize(){ if(!stage) return; var r=stage.getBoundingClientRect(); var dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(r.width*dpr)); canvas.height=Math.max(1,Math.round(r.height*dpr)); }
  function toLogical(){ ctx.setTransform(canvas.width/LW,0,0,canvas.height/LH,0,0); }
  function laneCx(l){ return (l+0.5)*LW/LANES; }
  function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function drawChikuwaNote(cx,cy,col){
    var w=LW/LANES*0.62, h=34;
    ctx.save(); ctx.translate(cx,cy);
    ctx.fillStyle='#e8c98a'; roundRect(-w/2,-h/2,w,h,10); ctx.fill();
    ctx.lineWidth=4; ctx.strokeStyle=col; roundRect(-w/2,-h/2,w,h,10); ctx.stroke();
    ctx.strokeStyle='#a9803f'; ctx.lineWidth=2; for(var k=-1;k<=1;k++){ ctx.beginPath(); ctx.moveTo(k*w*0.26,-h/2+4); ctx.lineTo(k*w*0.26,h/2-4); ctx.stroke(); }
    ctx.fillStyle='#5a3d1e'; ctx.beginPath(); ctx.ellipse(w/2-6,0,4,h*0.3,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function render(){
    toLogical();
    var g=ctx.createLinearGradient(0,0,0,LH); g.addColorStop(0,'#171a2e'); g.addColorStop(1,'#0c0e1c'); ctx.fillStyle=g; ctx.fillRect(0,0,LW,LH);
    // レーン
    for(var l=0;l<LANES;l++){ var x=l*LW/LANES;
      ctx.fillStyle = l%2? 'rgba(255,255,255,0.03)':'rgba(255,255,255,0.06)'; ctx.fillRect(x,0,LW/LANES,LH);
      ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,LH); ctx.stroke();
    }
    // 判定ライン＋受け皿
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,JUDGE_Y); ctx.lineTo(LW,JUDGE_Y); ctx.stroke();
    for(var l2=0;l2<LANES;l2++){ var cx=laneCx(l2); var fl=laneFlash?laneFlash[l2]:0;
      ctx.globalAlpha=0.35+fl*3; ctx.strokeStyle=LANE_COL[l2]; ctx.lineWidth=fl>0?6:3;
      roundRect(cx-LW/LANES*0.34, JUDGE_Y-22, LW/LANES*0.68, 44, 12); ctx.stroke(); ctx.globalAlpha=1;
    }
    if(state==='play'){
      var now=songTime();
      // ノーツ
      for(var i=0;i<chart.length;i++){ var n=chart[i]; if(n.judged) continue;
        var frac=(n.t-now)/APPROACH; if(frac>1.05||frac<-0.4) continue;
        var y=JUDGE_Y - frac*(JUDGE_Y-TOP_Y);
        drawChikuwaNote(laneCx(n.lane), y, LANE_COL[n.lane]);
      }
      // HUD
      ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.font='bold 26px sans-serif'; ctx.fillText('SCORE '+score, 16, 14);
      if(combo>=2){ ctx.textAlign='center'; ctx.fillStyle='#ffe27a'; ctx.font='bold 54px sans-serif'; ctx.fillText(combo, LW/2, LH*0.30);
        ctx.font='bold 20px sans-serif'; ctx.fillText('COMBO', LW/2, LH*0.30+50); }
      // カウントイン
      if(now < 4*beatDur){ var cn=Math.ceil((4*beatDur-now)/beatDur);
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.font='bold 80px sans-serif'; ctx.fillText(cn>0?cn:'', LW/2, LH*0.45); }
      // 判定ポップ
      if(judgePop){ ctx.globalAlpha=clamp(judgePop.life/0.45,0,1); ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle=judgePop.color; ctx.font='bold 40px sans-serif'; ctx.fillText(judgePop.text, LW/2, JUDGE_Y-70); ctx.globalAlpha=1; }
    }
  }

  function loop(now){ if(!running) return; rafId=requestAnimationFrame(loop); var dt=Math.min((now-lastTime)/1000,0.05); lastTime=now; if(state==='play') update(dt); render(); }
  function startLoop(){ if(running) return; running=true; lastTime=performance.now(); rafId=requestAnimationFrame(loop); }
  function stopLoop(){ running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0; }
  function isOpen(){ return wrap && wrap.classList.contains('show'); }

  function bind(){ if(bound) return; bound=true;
    wrap=document.getElementById('beat-wrap'); stage=document.getElementById('beat-stage');
    canvas=document.getElementById('beat-canvas'); ctx=canvas.getContext('2d');
    elBest=document.getElementById('beat-best'); titleScr=document.getElementById('beat-title');
    overScr=document.getElementById('beat-over'); startBtn=document.getElementById('beat-start');
    retryBtn=document.getElementById('beat-retry'); muteBtn=document.getElementById('beat-mute');

    startBtn.addEventListener('click', function(e){ e.stopPropagation(); startPlay(); });
    retryBtn.addEventListener('click', function(e){ e.stopPropagation(); startPlay(); });
    muteBtn.addEventListener('click', function(e){ e.stopPropagation(); muted=!muted; muteBtn.textContent=muted?'🔇':'🔊'; if(master) master.gain.value=muted?0:0.5; });
    stage.addEventListener('pointerdown', function(e){ if(state!=='play') return; e.preventDefault();
      var r=stage.getBoundingClientRect(); var lx=(e.clientX-r.left)/r.width*LW; judgeLane(clamp(Math.floor(lx/(LW/LANES)),0,LANES-1)); });
    window.addEventListener('keydown', function(e){ if(!isOpen()) return;
      if(e.code in LANE_KEY){ e.preventDefault(); if(!e.repeat) judgeLane(LANE_KEY[e.code]); }
      else if(e.code==='Space'||e.code==='Enter'){ e.preventDefault(); if(state==='title'||state==='result') startPlay(); } });
    window.addEventListener('resize', function(){ if(isOpen()){ resize(); render(); } });
  }

  window.beatLaunch=function(ctxAudio){ actx=ctxAudio||actx; bind(); ensureMaster(); resize(); showTitle(); startLoop(); render(); };
  window.beatShutdown=function(){ state='title'; stopLoop(); if(master){ try{ master.disconnect(); }catch(e){} master=null; } };
  if(document.readyState!=='loading') bind(); else document.addEventListener('DOMContentLoaded', bind);
})();
