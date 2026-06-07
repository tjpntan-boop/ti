/* ===== 🐰 ちくわクラッシュ 本体（独立スコープ / モジュール）=====
   バニーちゃんのお皿に流れてくる具を見極め、ちくわだけを画面タップで潰す。
   ちくわ以外を潰すと減点、見送ればOK。腰振り＆右手スラム演出。
   window.crushLaunch(audioCtx)/window.crushShutdown()を公開。 */
(function(){
  'use strict';

  var LW=900, LH=506;
  var PLATE_X=560, PLATE_Y=322, BUNNY_X=290, GY=LH-34;
  var SPAWN_X=950, EXIT_X=-90, APPROACH=1.5;
  var SPEED=(SPAWN_X-PLATE_X)/APPROACH;
  var W_PERFECT=0.06, W_GOOD=0.14;
  var BPM=120, beatDur=60/BPM;
  var DECOYS=['🍙','🍣','🍅','🥚','🧨','🍓','🧅'];
  var BEST_KEY='crush_best_v1';

  var wrap, stage, canvas, ctx, elBest, titleScr, overScr, startBtn, retryBtn, muteBtn;
  var state='title';   // title | play | result
  var actx=null, master=null, muted=false;

  var items, grid, songStart, gridIdx, genT, genStep, loopIdx, curBpm, lives, firstItemT;
  var score, combo, maxCombo, nCrush, nWrong, nMissChikuwa, nAvoid, nChikuwa, nDecoy;
  var handAnim, judgePop, splats, shake, impact;
  var lastTime=0, rafId=0, running=false, bound=false;

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

  // ---------- ベスト ----------
  function loadBest(){ try{ var v=JSON.parse(localStorage.getItem(BEST_KEY)); var b={scores:[],combos:[]};
      if(v){ if(Array.isArray(v.scores)) b.scores=v.scores.filter(function(x){return typeof x==='number';}).slice(0,3);
             else if(typeof v.score==='number') b.scores=[v.score];          // 旧形式から移行
             if(Array.isArray(v.combos)) b.combos=v.combos.filter(function(x){return typeof x==='number';}).slice(0,3); }
      return b; }catch(e){ return {scores:[],combos:[]}; } }
  function saveBest(b){ try{ localStorage.setItem(BEST_KEY, JSON.stringify(b)); }catch(e){} }
  function submitBest(s,c){ var b=loadBest();
    b.scores.push(s); b.scores.sort(function(a,z){return z-a;}); var sr=b.scores.indexOf(s)+1; b.scores=b.scores.slice(0,3);
    b.combos.push(c); b.combos.sort(function(a,z){return z-a;}); var cr=b.combos.indexOf(c)+1; b.combos=b.combos.slice(0,3);
    saveBest(b); return { scoreRank: sr<=3?sr:0, comboRank: cr<=3?cr:0 }; }
  function fmtTop(list,hi){ var m=['🥇','🥈','🥉'], out=[];
    for(var i=0;i<3;i++){ var v=(i<list.length)?list[i]:null; var t=m[i]+' '+(v==null?'—':v);
      out.push(hi===i?('<span class="crush-hi">'+t+'</span>'):t); } return out.join('　'); }
  function bestHTML(hiS,hiC){ var b=loadBest();
    return '<span class="crush-best-head">🏆 ハイスコア TOP3</span><span class="crush-best-row">'+fmtTop(b.scores, hiS==null?-1:hiS)+'</span>'
         + '<span class="crush-best-head crush-best-head2">🔥 最高コンボ TOP3</span><span class="crush-best-row">'+fmtTop(b.combos, hiC==null?-1:hiC)+'</span>'; }

  // ---------- オーディオ ----------
  function ensureMaster(){ if(!actx||master) return; try{ master=actx.createGain(); master.gain.value=muted?0:0.5; master.connect(actx.destination);}catch(e){master=null;} }
  function tone(time,freq,dur,type,vol,glide){ if(!actx||!master) return;
    var o=actx.createOscillator(),g=actx.createGain(); o.type=type||'square'; o.frequency.setValueAtTime(freq,time);
    if(glide) o.frequency.exponentialRampToValueAtTime(glide,time+dur);
    g.gain.setValueAtTime(0.0001,time); g.gain.exponentialRampToValueAtTime(vol||0.2,time+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,time+dur); o.connect(g); g.connect(master); o.start(time); o.stop(time+dur+0.02); }
  function noise(time,dur,vol,lp){ if(!actx||!master) return; var len=Math.max(1,Math.floor(actx.sampleRate*dur)),buf=actx.createBuffer(1,len,actx.sampleRate),d=buf.getChannelData(0);
    for(var i=0;i<len;i++){ d[i]=(Math.random()*2-1)*(1-i/len); } var s=actx.createBufferSource(); s.buffer=buf;
    var f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp||4000; var g=actx.createGain(); g.gain.value=vol||0.2; s.connect(f); f.connect(g); g.connect(master); s.start(time); }
  function scheduleDrum(time,beat){ tone(time,120,0.16,'sine',0.5,50);
    if(beat%2===1) noise(time,0.13,0.3,3000);      // スネア(パン)＝裏
    if(beat%1===0) noise(time+beatDur*0.5,0.05,0.12,8000); // ハイハット
    if(beat%4===0){ var roots=[98,98,130.8,87.3]; tone(time,roots[(Math.floor(beat/4))%4],beatDur*3.4,'triangle',0.16); } }
  function crushSfx(perfect){ if(!actx||!master||muted) return; var t=actx.currentTime; noise(t,0.12,0.35,2500); tone(t,perfect?1320:880,0.09,'square',0.18); }
  function wrongSfx(){ if(!actx||!master||muted) return; tone(actx.currentTime,200,0.22,'sawtooth',0.22,90); }
  function fanfare(){ if(!actx||!master||muted) return; [523,659,784,1047].forEach(function(f,i){ setTimeout(function(){ tone(actx.currentTime,f,0.2,'triangle',0.2); }, i*120); }); }
  function hatTick(time){ noise(time,0.03,0.07,9000); }
  function banSound(time){ tone(time,120,0.14,'sine',0.42,55); noise(time,0.10,0.26,3500); tone(time,330,0.08,'square',0.10); } // バンッ
  function puuSound(time){ tone(time,520,0.20,'sawtooth',0.16,240); tone(time,260,0.18,'square',0.05); }                       // プウ♪（合いの手）
  var BASS=[110,110,130.81,146.83,164.81,146.83,130.81,110];        // 2小節=8拍のベースリフ（Aペンタ）
  var LEAD=[220,261.63,329.63,293.66,220,261.63,293.66,329.63];     // メロディ
  function scheduleStep(time,g){
    hatTick(time);                                                  // 毎8分でハイハット
    if(g.step%2===0){ var beat=Math.floor(g.step/2)%8;              // 拍頭
      tone(time,120,0.14,'sine',0.34,55);                           // キック
      tone(time,BASS[beat],0.40,'triangle',0.15);                   // ベース
      tone(time,LEAD[beat],0.28,'square',0.06);                     // メロディ
      if(beat%2===1) noise(time,0.12,0.20,3000);                    // スネア(裏拍)
    }
    if(g.ch==='B') banSound(time); else if(g.ch==='D') puuSound(time);  // バン/プウの合いの手
  }

  // ---------- 譜面（パン パン ツーツーパン つー のノリ）----------
  var LOOP_PAT=['B','D','B','D','B','B','D','.', 'B','B','D','D','B','B','D','.'];  // 2小節ループ
  function genIntro(){ var bpm=92, eighth=30/bpm; curBpm=bpm;        // ベースだけ先に1小節鳴らす
    for(var i=0;i<8;i++){ grid.push({t:genT, ch:'.', step:genStep, bpm:bpm}); genT+=eighth; genStep++; } }
  function genLoop(){
    var bpm=Math.min(92+loopIdx*9,156); curBpm=bpm; var eighth=30/bpm; var baseSpeed=(SPAWN_X-PLATE_X)/1.4;
    for(var i=0;i<LOOP_PAT.length;i++){ var ch=LOOP_PAT[i];
      grid.push({t:genT, ch:ch, step:genStep, bpm:bpm});
      if(ch!=='.'){ var isC=(ch==='B'); if(isC)nChikuwa++; else nDecoy++;
        items.push({ t:genT, chikuwa:isC, emoji: isC?null:DECOYS[Math.floor(Math.random()*DECOYS.length)], judged:false, speed: baseSpeed*(bpm/92) }); }
      genT+=eighth; genStep++;
    }
    loopIdx++;
  }

  // ---------- 進行 ----------
  function showTitle(){ state='title'; if(elBest) elBest.innerHTML=bestHTML(); overScr.classList.add('hidden'); titleScr.classList.remove('hidden'); }
  function startPlay(){
    titleScr.classList.add('hidden'); overScr.classList.add('hidden');
    grid=[]; items=[]; genT=0; genStep=0; loopIdx=0; curBpm=92; nChikuwa=0; nDecoy=0;
    genIntro(); genLoop(); genLoop();                 // ベース先出し＋先に2ループ
    firstItemT = items.length ? items[0].t : 0;
    score=0; combo=0; maxCombo=0; nCrush=0; nWrong=0; nMissChikuwa=0; nAvoid=0; lives=3;
    gridIdx=0; handAnim=0; judgePop=null; splats=[]; shake=0; impact=null;
    songStart=(actx?actx.currentTime:performance.now()/1000)+0.4;
    state='play';
  }
  function songTime(){ return (actx?actx.currentTime:performance.now()/1000) - songStart; }
  function itemX(it,now){ return PLATE_X + (it.t-now)*it.speed; }
  function popJudge(text,color){ judgePop={text:text,color:color,life:0.5}; }

  function doTap(){
    if(state!=='play') return;
    handAnim=0.22; shake=Math.max(shake,0.12); var now=songTime();
    var best=-1,bestDt=999;
    for(var i=0;i<items.length;i++){ var it=items[i]; if(it.judged) continue; var dt=Math.abs(it.t-now);
      if(dt<=W_GOOD && dt<bestDt){ bestDt=dt; best=i; } }
    if(best<0) return;                  // 空振り＝ノーペナルティ
    var it=items[best]; it.judged=true;
    if(it.chikuwa){
      var perfect=bestDt<=W_PERFECT; score+=perfect?300:150; nCrush++; combo++; if(combo>maxCombo)maxCombo=combo;
      popJudge('バーン！','#ffd23f'); makeSplat(); impact={x:PLATE_X,y:PLATE_Y-10,life:0.4}; shake=0.22; crushSfx(perfect);
    } else {
      score=Math.max(0,score-200); nWrong++; combo=0; lives--; popJudge('ブー！ちくわ以外！','#ff6b6b'); shake=0.42; wrongSfx();
    }
  }
  function makeSplat(){ for(var i=0;i<10;i++){ splats.push({x:PLATE_X,y:PLATE_Y-14,vx:(Math.random()-0.5)*220,vy:-Math.random()*200-40,life:0.5}); } }

  function showResult(){
    state='result';
    var r=submitBest(score, maxCombo);
    document.getElementById('crush-res-title').textContent = 'ゲームオーバー！';
    document.getElementById('crush-res-score').textContent = score;
    document.getElementById('crush-res-acc').textContent = 'たどりついた はやさ '+curBpm+' BPM　最大コンボ '+maxCombo;
    document.getElementById('crush-res-detail').textContent = 'つぶし '+nCrush+' ／ お手つき '+nWrong+' ／ 逃し '+nMissChikuwa;
    document.getElementById('crush-res-best').innerHTML = bestHTML(r.scoreRank>0?r.scoreRank-1:-1, r.comboRank>0?r.comboRank-1:-1);
    overScr.classList.remove('hidden'); fanfare();
  }

  // ---------- 更新 ----------
  function update(dt){
    if(state!=='play') return; var now=songTime();
    while(genT < now+4) genLoop();                          // 永遠に先生成（少しずつ加速）
    if(actx&&master){ var ahead=now+0.2;
      while(gridIdx<grid.length && grid[gridIdx].t<ahead){ scheduleStep(songStart+grid[gridIdx].t, grid[gridIdx]); gridIdx++; } }
    // 取り逃し/見送り判定
    for(var i=0;i<items.length;i++){ var it=items[i]; if(it.judged) continue;
      if((now-it.t)>W_GOOD){ it.judged=true;
        if(it.chikuwa){ nMissChikuwa++; combo=0; lives--; popJudge('にがした…','#9fb0d0'); }
        else { nAvoid++; score+=50; combo++; if(combo>maxCombo)maxCombo=combo; } } }
    if(handAnim>0) handAnim=Math.max(0,handAnim-dt);
    if(shake>0) shake=Math.max(0,shake-dt);
    if(impact){ impact.life-=dt; if(impact.life<=0) impact=null; }
    if(judgePop){ judgePop.life-=dt; if(judgePop.life<=0) judgePop=null; }
    for(var s=splats.length-1;s>=0;s--){ var p=splats[s]; p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=900*dt; if(p.life<=0) splats.splice(s,1); }
    if(lives<=0){ showResult(); return; }                   // ライフ切れで終了
    // メモリ抑制：通過済みを間引き
    if(items.length>140){ var cut=0; while(cut<items.length && items[cut].judged && (now-items[cut].t)>1.2) cut++; if(cut>0) items.splice(0,cut); }
    if(gridIdx>240){ grid.splice(0,gridIdx); gridIdx=0; }
  }

  // ---------- 描画 ----------
  function resize(){ if(!stage) return; var r=stage.getBoundingClientRect(); var dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(r.width*dpr)); canvas.height=Math.max(1,Math.round(r.height*dpr)); }
  function toLogical(){ ctx.setTransform(canvas.width/LW,0,0,canvas.height/LH,0,0); }
  function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function drawChikuwa(cx,cy,scale){ var w=58*scale,h=34*scale;
    ctx.save(); ctx.translate(cx,cy); ctx.fillStyle='#e8c98a'; roundRect(-w/2,-h/2,w,h,10*scale); ctx.fill();
    ctx.strokeStyle='#a9803f'; ctx.lineWidth=2*scale; for(var k=-1;k<=1;k++){ ctx.beginPath(); ctx.moveTo(k*w*0.26,-h/2+4*scale); ctx.lineTo(k*w*0.26,h/2-4*scale); ctx.stroke(); }
    ctx.fillStyle='#5a3d1e'; ctx.beginPath(); ctx.ellipse(w/2-6*scale,0,4*scale,h*0.3,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
  function poseOf(now){
    var bp=now/beatDur, bi=Math.floor(bp), fr=bp-bi;
    var lean=(bi%2===0)?-1:1;                          // 拍ごとにカクッと左右
    return { sway:lean*16, bob:Math.max(0,1-fr*3)*12, lean:lean };  // 拍頭でヘコッと沈むぎこちなさ
  }
  function drawLady(now){
    var pz=poseOf(now); var bx=BUNNY_X+pz.sway, bob=pz.bob; var kap='#f5f3ee';
    ctx.save();
    // 脚（肌色）＋スリッパ
    ctx.fillStyle='#f4c79e'; ctx.fillRect(bx-32,GY-72,28,72); ctx.fillRect(bx+6,GY-72,28,72);
    ctx.fillStyle='#b5485f'; ctx.beginPath(); ctx.ellipse(bx-20,GY-5,22,9,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(bx+20,GY-5,22,9,0,0,Math.PI*2); ctx.fill();
    // 胴＝割烹着（白・どっしり）
    ctx.fillStyle=kap; ctx.beginPath(); ctx.ellipse(bx,GY-128+bob,68,76,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#ddd6c8'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(bx,GY-128+bob,68,76,0,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#e8e2d4'; ctx.beginPath(); ctx.ellipse(bx,GY-74+bob,62,16,0,0,Math.PI*2); ctx.fill();   // 裾フリル
    ctx.strokeStyle='#cfc7b6'; ctx.lineWidth=2; ctx.strokeRect(bx+14,GY-152+bob,24,22);                    // 胸ポケット
    // 割烹着の襟（合わせ）
    ctx.fillStyle='#ece5d6'; ctx.beginPath(); ctx.moveTo(bx-26,GY-190+bob); ctx.lineTo(bx,GY-150+bob); ctx.lineTo(bx+26,GY-190+bob); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#cfc7b6'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(bx-26,GY-190+bob); ctx.lineTo(bx,GY-150+bob); ctx.lineTo(bx+26,GY-190+bob); ctx.stroke();
    // 左腕（白い袖）→お皿（手は肌）
    ctx.strokeStyle=kap; ctx.lineWidth=22; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(bx+42,GY-150+bob); ctx.lineTo(PLATE_X-46,PLATE_Y-2); ctx.stroke();
    ctx.fillStyle='#f4c79e'; ctx.beginPath(); ctx.arc(PLATE_X-42,PLATE_Y,11,0,Math.PI*2); ctx.fill();
    // 頭（肌）
    var hy=GY-238+bob;
    ctx.fillStyle='#f4c79e'; ctx.beginPath(); ctx.arc(bx,hy,38,0,Math.PI*2); ctx.fill();
    // パーマ（もこもこ）
    ctx.fillStyle='#7d5a6a';
    var curls=[[-34,-16,16],[-30,-36,15],[-12,-47,16],[12,-47,16],[30,-36,15],[34,-16,16],[-41,4,13],[41,4,13],[-22,-44,12],[22,-44,12]];
    for(var c=0;c<curls.length;c++){ ctx.beginPath(); ctx.arc(bx+curls[c][0],hy+curls[c][1],curls[c][2],0,Math.PI*2); ctx.fill(); }
    // 顔を出す（額〜ほお）
    ctx.fillStyle='#f4c79e'; ctx.beginPath(); ctx.arc(bx,hy+5,29,0,Math.PI*2); ctx.fill();
    // 眉・目
    ctx.strokeStyle='#6b5440'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(bx-22,hy-7); ctx.lineTo(bx-8,hy-9); ctx.moveTo(bx+8,hy-9); ctx.lineTo(bx+22,hy-7); ctx.stroke();
    ctx.fillStyle='#33323a'; ctx.beginPath(); ctx.ellipse(bx-13,hy+3,4,6,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(bx+13,hy+3,4,6,0,0,Math.PI*2); ctx.fill();
    // ほお・口紅（濃いめ）
    ctx.fillStyle='rgba(255,110,140,0.55)'; ctx.beginPath(); ctx.arc(bx-22,hy+15,8,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(bx+22,hy+15,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#d12a5c'; ctx.beginPath(); ctx.ellipse(bx,hy+23,10,5,0,0,Math.PI*2); ctx.fill();
    // うさ耳カチューシャ（パーマの上から）
    ctx.strokeStyle='#e9e4ef'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(bx,hy-8,41,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
    for(var e=-1;e<=1;e+=2){ ctx.save(); ctx.translate(bx+e*16,hy-44); ctx.rotate(e*0.2+pz.lean*0.06);
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(0,-28,9,32,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffc0cb'; ctx.beginPath(); ctx.ellipse(0,-28,4,22,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  function drawHand(cx,cy,sc){
    ctx.save(); ctx.translate(cx,cy);
    ctx.fillStyle='#f4c79e'; ctx.strokeStyle='#c98f63'; ctx.lineWidth=2;
    roundRect(-28*sc,-20*sc,56*sc,38*sc,12*sc); ctx.fill(); ctx.stroke();             // 手のひら
    for(var i=-1.5;i<=1.5;i++){ roundRect(i*13*sc-5*sc,14*sc,10*sc,24*sc,5*sc); ctx.fill(); ctx.stroke(); } // 指4本
    roundRect(-40*sc,-8*sc,16*sc,22*sc,8*sc); ctx.fill(); ctx.stroke();                // 親指
    ctx.restore();
  }
  function drawPalm(now){
    var pz=poseOf(now); var bx=BUNNY_X+pz.sway;
    var shoulderX=bx+48, shoulderY=GY-152+pz.bob;
    var p = handAnim>0 ? 1-handAnim/0.22 : 0;
    var drop = p<0.25 ? p/0.25 : 1-(p-0.25)/0.75;       // 0→1(バーン)→0(戻す)、雑に速く落とす
    var palmX=PLATE_X+4, palmY=(PLATE_Y-150)+drop*128;
    ctx.strokeStyle='#f5f3ee'; ctx.lineWidth=20; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(shoulderX,shoulderY); ctx.lineTo(palmX,palmY-12); ctx.stroke();
    drawHand(palmX,palmY,1+drop*0.2);
  }
  function drawPlate(){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(PLATE_X,PLATE_Y+14,76,16,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#d7dbe6'; ctx.beginPath(); ctx.ellipse(PLATE_X,PLATE_Y+6,72,18,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#eef1f8'; ctx.beginPath(); ctx.ellipse(PLATE_X,PLATE_Y,66,14,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function render(){
    toLogical();
    var sx=(shake>0)?(Math.random()-0.5)*shake*40:0;
    ctx.save(); ctx.translate(sx,0);
    var g=ctx.createLinearGradient(0,0,0,LH); g.addColorStop(0,'#2a1f3d'); g.addColorStop(1,'#15101f'); ctx.fillStyle=g; ctx.fillRect(-20,0,LW+40,LH);
    // 床
    ctx.fillStyle='#3a2c52'; ctx.fillRect(-20,GY,LW+40,LH-GY);
    // ディスコの光
    for(var d=0;d<6;d++){ ctx.globalAlpha=0.06; ctx.fillStyle=d%2?'#ff7ad9':'#7ad9ff';
      ctx.beginPath(); ctx.moveTo(d*180-40,0); ctx.lineTo(d*180+60,0); ctx.lineTo(d*180+10,GY); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha=1;
    var now=(state==='play')?songTime():0;
    drawLady(now);
    drawPlate();
    drawPalm(now);
    // トラック上の具
    if(state==='play'){
      for(var i=0;i<items.length;i++){ var it=items[i]; if(it.judged) continue;
        var x=itemX(it,now); if(x<EXIT_X-40||x>SPAWN_X+40) continue;
        var y=PLATE_Y-14 - Math.max(0,(1-Math.abs(x-PLATE_X)/300))*4;
        if(it.chikuwa) drawChikuwa(x,y,1);
        else { ctx.font='44px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(it.emoji,x,y-2); }
      }
      // インパクト（バーンの輪）
      if(impact){ var ia=clamp(impact.life/0.4,0,1); var rr=(0.4-impact.life)*300+8;
        ctx.globalAlpha=ia; ctx.strokeStyle='#fff'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(impact.x,impact.y,rr,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle='#ffd23f'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(impact.x,impact.y,rr*0.66,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
      // スプラット
      for(var s=0;s<splats.length;s++){ var p=splats[s]; ctx.globalAlpha=clamp(p.life/0.5,0,1); ctx.fillStyle='#e8c98a';
        ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1;
      // HUD
      ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.font='bold 26px sans-serif'; ctx.fillText('SCORE '+score,16,14);
      ctx.fillStyle='#9fe6ff'; ctx.font='bold 17px sans-serif'; ctx.fillText('♪ '+curBpm+'BPM',16,46);
      var hh=''; for(var L=0;L<Math.max(0,lives);L++) hh+='♥'; ctx.fillStyle='#ff5b7a'; ctx.font='bold 26px sans-serif'; ctx.textAlign='right'; ctx.fillText(hh,LW-16,14);
      if(combo>=2){ ctx.textAlign='center'; ctx.fillStyle='#ffe27a'; ctx.font='bold 48px sans-serif'; ctx.fillText(combo,LW/2,40); ctx.font='bold 18px sans-serif'; ctx.fillText('COMBO',LW/2,86); }
      if(now<firstItemT){ var cn=Math.ceil((firstItemT-now)/0.5); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.font='bold 80px sans-serif'; ctx.fillText(cn>0?cn:'',LW/2,LH*0.4); }
      if(judgePop){ ctx.globalAlpha=clamp(judgePop.life/0.5,0,1); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=judgePop.color; ctx.font='bold 38px sans-serif'; ctx.fillText(judgePop.text,PLATE_X,PLATE_Y-90); ctx.globalAlpha=1; }
    }
    ctx.restore();
  }

  function loop(now){ if(!running) return; rafId=requestAnimationFrame(loop); var dt=Math.min((now-lastTime)/1000,0.05); lastTime=now; if(state==='play') update(dt); render(); }
  function startLoop(){ if(running) return; running=true; lastTime=performance.now(); rafId=requestAnimationFrame(loop); }
  function stopLoop(){ running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0; }
  function isOpen(){ return wrap && wrap.classList.contains('show'); }

  function bind(){ if(bound) return; bound=true;
    wrap=document.getElementById('crush-wrap'); stage=document.getElementById('crush-stage');
    canvas=document.getElementById('crush-canvas'); ctx=canvas.getContext('2d');
    elBest=document.getElementById('crush-best'); titleScr=document.getElementById('crush-title');
    overScr=document.getElementById('crush-over'); startBtn=document.getElementById('crush-start');
    retryBtn=document.getElementById('crush-retry'); muteBtn=document.getElementById('crush-mute');
    startBtn.addEventListener('click',function(e){ e.stopPropagation(); startPlay(); });
    retryBtn.addEventListener('click',function(e){ e.stopPropagation(); startPlay(); });
    muteBtn.addEventListener('click',function(e){ e.stopPropagation(); muted=!muted; muteBtn.textContent=muted?'🔇':'🔊'; if(master) master.gain.value=muted?0:0.5; });
    wrap.addEventListener('pointerdown',function(e){ if(state!=='play') return; if(e.target&&e.target.closest&&e.target.closest('button')) return; e.preventDefault(); doTap(); });
    window.addEventListener('keydown',function(e){ if(!isOpen()) return;
      if(e.code==='Space'||e.code==='ArrowUp'||e.code==='Enter'){ e.preventDefault(); if(e.repeat) return;
        if(state==='play') doTap(); else if(state==='title'||state==='result') startPlay(); } });
    window.addEventListener('resize',function(){ if(isOpen()){ resize(); render(); } });
  }

  window.crushLaunch=function(ctxAudio){ actx=ctxAudio||actx; bind(); ensureMaster(); resize(); showTitle(); startLoop(); render(); };
  window.crushShutdown=function(){ state='title'; stopLoop(); if(master){ try{ master.disconnect(); }catch(e){} master=null; } };
  if(document.readyState!=='loading') bind(); else document.addEventListener('DOMContentLoaded', bind);
})();
