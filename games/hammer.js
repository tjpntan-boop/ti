/* ===== 🔨 ちくわなげハンマー 本体（独立スコープ / モジュール）=====
   操作はすべて画面タップ。パワー(減らない/上がりにくい)→角度→タイミングの3値＋ハンマー種別で距離決定。
   window.hammerLaunch(audioCtx)/window.hammerShutdown()を公開。 */
(function(){
  'use strict';

  var LW=900, LH=506, GROUND_Y=LH-70;
  var TX=235, PIVOT_Y=GROUND_Y-86, HANDLE=74;
  var MAXD=13500, ARC_MAX=GROUND_Y-56;
  var READY_DUR=2.4, POWER_TIME=5.0, P_INC=0.045, P_EXP=2;
  var GOT_DUR=1.4, BEAT_RELEASE=1.5, LAND_HOLD=1.7;
  var BEST_KEY='hammer_best_v1';
  var CHARS={ stable:{name:'安定'}, gamble:{name:'一か八か'}, genius:{name:'天才'} };

  var wrap, stage, canvas, ctx, elBest, titleScr, overScr, retryBtn, muteBtn;
  var bonusKey='base', FOUND_KEY='hammer_found_v1';
  var RULES=[
    {key:'triple_prime', m:'×25', name:'三つ子素数', cond:'値が3つとも同じ素数', freq:'約4万回に1回'},
    {key:'triple', m:'×20', name:'パーフェクト三つ子', cond:'値が3つとも同じ', freq:'約1.3万回に1回'},
    {key:'zorome', m:'×10〜19', name:'下一桁ぞろ目', cond:'その数字＋10倍（0→×10 … 9→×19）', freq:'各 約1000回に1回'},
    {key:'pair789', m:'×7〜9', name:'ハイぞろ', cond:'下一桁が全部7〜9で 7/8/9 が2つ', freq:'各 約0.6%'},
    {key:'dbl_prime', m:'×6', name:'ダブル素数', cond:'値の2つが同じ素数', freq:'約0.6%'},
    {key:'all_prime', m:'×5', name:'オール素数', cond:'値が3つとも素数', freq:'約1.3%'},
    {key:'dbl', m:'×4', name:'ダブル', cond:'値の2つが同じ', freq:'約1.9%'},
    {key:'d369', m:'×3.8', name:'3・6・9ぞろい', cond:'下一桁が全部 3/6/9', freq:'約2.1%'},
    {key:'sum22', m:'×3.6', name:'合計22', cond:'下一桁の合計が22', freq:'約1.7%'},
    {key:'sum20', m:'×3.2', name:'合計20', cond:'下一桁の合計が20', freq:'約3.5%'},
    {key:'dig_prime', m:'×2.5', name:'安定爆発', cond:'下一桁ぜんぶ素数(2/3/5/7)', freq:'約5%'},
    {key:'sum10', m:'×2.4', name:'合計10', cond:'下一桁の合計が10', freq:'約5.6%'},
    {key:'two_same', m:'×1.8', name:'2つ同じ', cond:'下一桁が2つ同じ', freq:'約15%'},
    {key:'base369', m:'×1.5', name:'基準ラッキー', cond:'基準距離の1の位が 3/6/9', freq:'約18%'},
    {key:'base', m:'×1.2', name:'基本', cond:'特別な役なし', freq:'約42%'}
  ];
  function loadFound(){ try{ var v=JSON.parse(localStorage.getItem(FOUND_KEY)); return (v&&typeof v==='object')?v:{}; }catch(e){ return {}; } }
  function markFound(k){ var f=loadFound(); var isNew=!f[k]; f[k]=1; try{ localStorage.setItem(FOUND_KEY, JSON.stringify(f)); }catch(e){} return isNew; }
  function ruleName(k){ for(var i=0;i<RULES.length;i++){ if(RULES[i].key===k) return RULES[i].name; } return ''; }
  function renderRules(){ var f=loadFound(), list=document.getElementById('hammer-rules-list'); if(!list) return; var found=0, html='';
    for(var i=0;i<RULES.length;i++){ var r=RULES[i], got=!!f[r.key]; if(got) found++;
      if(got) html+='<div class="hr-row"><span class="hr-m">'+r.m+'</span><span class="hr-c">'+r.name+'：'+r.cond+'<small>'+r.freq+'</small></span></div>';
      else html+='<div class="hr-row hr-locked"><span class="hr-m">？？？</span><span class="hr-c">？？？<small>まだ見つけていない役</small></span></div>'; }
    var cnt=document.getElementById('hammer-rules-count'); if(cnt) cnt.textContent='発見 '+found+' / '+RULES.length;
    list.innerHTML=html; }
  var state='title';  // title ready power powerGot angle angleGot timing timingGot release flight landing result
  var resultType='stable';
  var power, powerTime, tapFx, spinAngle, spinSpeed;
  var ang, angDir, angAcc, tm, tmDir, accuracy, timingElapsed, angleElapsed;
  var distance, baseDist, bonusInfo, currentDist, flightT, flightDur, maxAltZone;
  var beatTimer, landTimer, planeX, stars;
  var lastTime=0, rafId=0, running=false, bound=false;
  var actx=null, master=null, muted=false;

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function lerpCol(c1,c2,t){ return 'rgb('+Math.round(lerp(c1[0],c2[0],t))+','+Math.round(lerp(c1[1],c2[1],t))+','+Math.round(lerp(c1[2],c2[2],t))+')'; }

  // ---------- スコア（距離TOP3 + 内訳）----------
  function gpct(v){ return (typeof v==='number' && v>=0) ? Math.min(100,Math.floor(v)) : -1; }
  function normRec(r){ return {
    dist: Math.max(0, Math.floor((r&&r.dist)||0)),
    type: (r&&typeof r.type==='string')?r.type:'',
    pw: gpct(r&&r.pw), ang: gpct(r&&r.ang), tm: gpct(r&&r.tm) }; }
  function loadScores(){ try{ var raw=localStorage.getItem(BEST_KEY); if(!raw) return [];
      var v=JSON.parse(raw); var list;
      if(Array.isArray(v)) list=v.map(normRec);
      else if(v&&typeof v==='object') list=(v.dist?[normRec(v)]:[]); else list=[];
      list=list.filter(function(r){return r.dist>0;}); list.sort(function(a,b){return b.dist-a.dist;});
      return list.slice(0,3);
    }catch(e){ return []; } }
  function saveScores(list){ try{ localStorage.setItem(BEST_KEY, JSON.stringify(list.slice(0,3))); }catch(e){} }
  function submitScore(d, rec){ var list=loadScores();
    var entry={dist:d, type:rec.type, pw:rec.pw, ang:rec.ang, tm:rec.tm}; list.push(entry);
    list.sort(function(a,b){return b.dist-a.dist;}); var rank=list.indexOf(entry)+1; saveScores(list);
    return rank<=3?rank:0; }
  function bestHTML(scores, hi){
    var medals=['🥇','🥈','🥉']; var out='<span class="hbest-head">🏆 ベスト飛距離 TOP3</span>';
    if(!scores.length) return out+'<span class="hbest-row">まだ記録なし</span>';
    for(var i=0;i<3;i++){ var r=scores[i];
      if(!r){ out+='<span class="hbest-row'+(hi===i?' hbest-hi':'')+'">'+medals[i]+' —</span>'; continue; }
      var parts=[]; if(r.pw>=0) parts.push('パワー'+r.pw+'%'); if(r.ang>=0) parts.push('角度'+r.ang+'%'); if(r.tm>=0) parts.push('タイミング'+r.tm+'%');
      var tn=(r.type&&CHARS[r.type])?CHARS[r.type].name:'';
      var subtxt=(tn?tn+'型 ／ ':'')+parts.join(' ');
      var sub=(parts.length||tn)?'<span class="hbest-sub">'+subtxt+'</span>':'';
      out+='<span class="hbest-row'+(hi===i?' hbest-hi':'')+'">'+medals[i]+' '+r.dist+'m'+sub+'</span>';
    }
    return out; }

  // ---------- オーディオ ----------
  function ensureMaster(){ if(!actx||master) return; try{ master=actx.createGain(); master.gain.value=muted?0:0.5; master.connect(actx.destination);}catch(e){master=null;} }
  function blip(freq,dur,type,vol){ if(!actx||!master||muted) return;
    var o=actx.createOscillator(),g=actx.createGain(); o.type=type||'square'; o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,actx.currentTime); g.gain.exponentialRampToValueAtTime(vol||0.2,actx.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+dur); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime+dur+0.02); }
  function whoosh(){ if(!actx||!master||muted) return; var o=actx.createOscillator(),g=actx.createGain(); o.type='sawtooth';
    o.frequency.setValueAtTime(180,actx.currentTime); o.frequency.exponentialRampToValueAtTime(900,actx.currentTime+0.4);
    g.gain.setValueAtTime(0.0001,actx.currentTime); g.gain.exponentialRampToValueAtTime(0.25,actx.currentTime+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.5); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime+0.55); }
  function thud(){ if(!actx||!master||muted) return; var len=actx.sampleRate*0.25, buf=actx.createBuffer(1,len,actx.sampleRate), d=buf.getChannelData(0);
    for(var i=0;i<len;i++){ d[i]=(Math.random()*2-1)*(1-i/len); } var s=actx.createBufferSource(); s.buffer=buf;
    var f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=500; var g=actx.createGain(); g.gain.value=0.5;
    s.connect(f); f.connect(g); g.connect(master); s.start(); blip(90,0.2,'sine',0.3); }
  function fanfare(){ if(!actx||!master||muted) return; [523,659,784,1047].forEach(function(f,i){ setTimeout(function(){ blip(f,0.18,'triangle',0.2); }, i*110); }); }

  var SKY=[ {a:0,top:[127,199,255],bot:[205,238,255]}, {a:0.35,top:[96,120,206],bot:[244,165,96]},
            {a:0.65,top:[14,20,56],bot:[30,46,92]}, {a:1.0,top:[0,0,12],bot:[4,0,22]}, {a:1.6,top:[14,0,30],bot:[2,0,14]} ];
  function skyColors(a){ for(var i=0;i<SKY.length-1;i++){ if(a<=SKY[i+1].a){ var t=(a-SKY[i].a)/(SKY[i+1].a-SKY[i].a);
        return {top:lerpCol(SKY[i].top,SKY[i+1].top,t),bot:lerpCol(SKY[i].bot,SKY[i+1].bot,t)};}}
    var L=SKY[SKY.length-1]; return {top:'rgb('+L.top.join(',')+')',bot:'rgb('+L.bot.join(',')+')'}; }
  function fade(v,start,span){ return clamp((v-start)/span,0,1); }

  function resize(){ if(!stage) return; var r=stage.getBoundingClientRect(); var dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(r.width*dpr)); canvas.height=Math.max(1,Math.round(r.height*dpr)); }
  function toLogical(){ ctx.setTransform(canvas.width/LW,0,0,canvas.height/LH,0,0); }

  // ---------- フェーズ ----------
  function showTitle(){ state='title'; spinAngle=-Math.PI/2; power=0;
    if(elBest) elBest.innerHTML=bestHTML(loadScores(),-1);
    overScr.classList.add('hidden'); titleScr.classList.remove('hidden'); }
  function startReady(){
    titleScr.classList.add('hidden'); overScr.classList.add('hidden');
    state='ready'; beatTimer=READY_DUR; power=0; spinAngle=-Math.PI/2; spinSpeed=4; blip(660,0.12,'square',0.18); }
  function startPowerCharge(){ state='power'; power=0; powerTime=POWER_TIME; tapFx=[]; blip(880,0.12,'square',0.2); }
  function addPower(x,y){ if(state!=='power') return;
    power=Math.min(1, power+P_INC*Math.pow(1-power,P_EXP));   // 減らない・上ほど鈍い（限界95%くらい）
    if(tapFx.length<28) tapFx.push({x:(x==null?LW/2:x),y:(y==null?180:y),life:0.45});
    blip(420+power*460,0.04,'square',0.10); }
  function toPowerGot(){ state='powerGot'; beatTimer=GOT_DUR; blip(700,0.14,'square',0.2); }
  function startAngle(){ state='angle'; ang=0; angDir=1; angleElapsed=0; }
  function doAngleTap(){ if(state!=='angle') return; angAcc=clamp(1-Math.abs(ang-0.5)*2,0,1); blip(820,0.1,'square',0.2); state='angleGot'; beatTimer=GOT_DUR; }
  function startTiming(){ state='timing'; tm=0; tmDir=1; timingElapsed=0; }
  function doTimingTap(){ if(state!=='timing') return; accuracy=clamp(1-Math.abs(tm-0.5)*2,0,1); blip(900,0.1,'square',0.2);
    computeDistance(); state='timingGot'; beatTimer=GOT_DUR; }
  function toRelease(){ state='release'; beatTimer=BEAT_RELEASE; }

  function computeDistance(){
    var pf=0.6+0.4*power, af=0.6+0.4*angAcc, tf=0.6+0.4*accuracy;
    baseDist=Math.round(MAXD*pf*af*tf);
    var pd=Math.round(power*100)%10, ad=Math.round(angAcc*100)%10, td=Math.round(accuracy*100)%10;
    var P=Math.round(power*100), A=Math.round(angAcc*100), T=Math.round(accuracy*100);
    var b1=baseDist%10, sum=pd+ad+td, span=Math.max(pd,ad,td)-Math.min(pd,ad,td);
    var isPrimeN=function(n){ if(n<2) return false; for(var k=2;k*k<=n;k++){ if(n%k===0) return false; } return true; };
    var pdig=function(x){ return x===2||x===3||x===5||x===7; };
    var d369=function(x){ return x===3||x===6||x===9; };
    var cnt=function(v){ var n=0; if(pd===v)n++; if(ad===v)n++; if(td===v)n++; return n; };
    var is789=function(x){ return x===7||x===8||x===9; };
    var all789=is789(pd)&&is789(ad)&&is789(td);
    var mult, info, type, key;
    // 全ルールを1本化：高い倍率から判定＝最初に当てはまったタイプが結果
    if(P===A&&A===T&&isPrimeN(P)){ mult=25.0; type='genius'; key='triple_prime'; info='👑 天才：奇跡の三つ子素数（'+P+'）！ ×25.0'; }
    else if(P===A&&A===T){ mult=20.0; type='genius'; key='triple'; info='🏆 天才：パーフェクト三つ子（'+P+'）！ ×20.0'; }
    else if(pd===ad&&ad===td){ mult=10+pd; type='genius'; key='zorome'; info='✨ 天才：下一桁ぞろ目（'+pd+'）！ ×'+mult.toFixed(1); }
    else if(all789&&cnt(9)>=2){ mult=9.0; type='genius'; key='pair789'; info='天才：下一桁7〜9＆9が2つ！ ×9.0'; }
    else if(all789&&cnt(8)>=2){ mult=8.0; type='genius'; key='pair789'; info='天才：下一桁7〜9＆8が2つ！ ×8.0'; }
    else if(all789&&cnt(7)>=2){ mult=7.0; type='genius'; key='pair789'; info='天才：下一桁7〜9＆7が2つ！ ×7.0'; }
    else if((P===A&&isPrimeN(P))||(A===T&&isPrimeN(A))||(P===T&&isPrimeN(P))){ mult=6.0; type='gamble'; key='dbl_prime'; info='💎 一か八か：ダブル素数（同じ素数が2つ）！ ×6.0'; }
    else if(isPrimeN(P)&&isPrimeN(A)&&isPrimeN(T)){ mult=5.0; type='gamble'; key='all_prime'; info='🎰 一か八か：全部素数！ ×5.0'; }
    else if(P===A||A===T||P===T){ mult=4.0; type='genius'; key='dbl'; info='👯 天才：ダブル（値が2つ同じ）！ ×4.0'; }
    else if(d369(pd)&&d369(ad)&&d369(td)){ mult=3.8; type='gamble'; key='d369'; info='🎯 一か八か：3・6・9ぞろい！ ×3.8'; }
    else if(sum===22){ mult=3.6; type='genius'; key='sum22'; info='天才：下一桁の合計22！ ×3.6'; }
    else if(sum===20){ mult=3.2; type='genius'; key='sum20'; info='天才：下一桁の合計20！ ×3.2'; }
    else if(pdig(pd)&&pdig(ad)&&pdig(td)){ mult=2.5; type='stable'; key='dig_prime'; info='💥 安定：下一桁ぜんぶ素数！ ×2.5'; }
    else if(sum===10){ mult=2.4; type='genius'; key='sum10'; info='天才：下一桁の合計10！ ×2.4'; }
    else if(pd===ad||ad===td||pd===td){ mult=1.8; type='genius'; key='two_same'; info='天才：下一桁が2つ同じ！ ×1.8'; }
    else if(d369(b1)){ mult=1.5; type='gamble'; key='base369'; info='🎲 一か八か：基準の1の位'+b1+'！ ×1.5'; }
    else { mult=1.2; type='stable'; key='base'; info='安定：×1.2'; }
    resultType=type; bonusInfo=info; bonusKey=key;
    distance=Math.max(200, Math.round(baseDist*mult));
  }

  function makeStars(){ var a=[]; for(var i=0;i<70;i++){ a.push({x:Math.random()*LW,y:Math.random()*(GROUND_Y-20),r:Math.random()*1.6+0.4,tw:Math.random()*6}); } return a; }
  function startFlight(){ currentDist=0; flightT=0; maxAltZone=clamp(distance/MAXD*1.5,0,1.6);
    flightDur=3.0+clamp(distance/MAXD,0,1)*2.2; planeX=LW+80; stars=makeStars(); state='flight'; whoosh(); }
  function startLanding(){ state='landing'; landTimer=LAND_HOLD; currentDist=distance; thud(); }
  function resultComment(d){
    if(d<2500) return 'ぽとり…';
    if(d<5000) return 'まあまあ！';
    if(d<8000) return 'ナイススロー！';
    if(d<10000) return '大気圏突破！？';
    if(d<11500) return '土星に到達！🪐';
    if(d<12700) return '銀河の彼方へ！🌌';
    return '神様に会った…！？😇';
  }
  function showResult(){ state='result'; var rec={type:resultType, pw:Math.round(power*100), ang:Math.round(angAcc*100), tm:Math.round(accuracy*100)};
    var rank=submitScore(distance, rec), scores=loadScores();
    document.getElementById('hammer-res-dist').textContent=distance;
    document.getElementById('hammer-res-comment').textContent=resultComment(distance);
    document.getElementById('hammer-res-bonus').textContent=bonusInfo||'';
    document.getElementById('hammer-res-pct').textContent='パワー'+rec.pw+'% ／ 角度'+rec.ang+'% ／ タイミング'+rec.tm+'%';
    var isNewFind=markFound(bonusKey);
    var rn=document.getElementById('hammer-res-new'); if(rn) rn.textContent = isNewFind ? ('🎉 新発見！「'+ruleName(bonusKey)+'」を倍率ずかんに追加！') : '';
    document.getElementById('hammer-res-title').textContent=rank>0?('🎉 TOP3入り！ '+rank+'位！'):'記録！';
    document.getElementById('hammer-res-best').innerHTML=bestHTML(scores,rank>0?rank-1:-1);
    overScr.classList.remove('hidden'); fanfare(); }

  // ---------- 更新 ----------
  function update(dt){
    if(state==='ready'){ spinAngle+=4*dt; beatTimer-=dt; if(beatTimer<=0) startPowerCharge(); }
    else if(state==='power'){ spinSpeed=4+power*18; spinAngle+=spinSpeed*dt;
      if(tapFx){ for(var fi=tapFx.length-1;fi>=0;fi--){ tapFx[fi].life-=dt; if(tapFx[fi].life<=0) tapFx.splice(fi,1); } }
      powerTime-=dt; if(powerTime<=0){ powerTime=0; toPowerGot(); } }
    else if(state==='powerGot'){ spinAngle+=(4+power*18)*dt; beatTimer-=dt; if(beatTimer<=0) startAngle(); }
    else if(state==='angle'){ spinAngle+=(4+power*18)*dt*0.55; ang+=angDir*1.3*dt; if(ang>=1){ang=1;angDir=-1;}else if(ang<=0){ang=0;angDir=1;}
      angleElapsed+=dt; if(angleElapsed>8) doAngleTap(); }
    else if(state==='angleGot'){ spinAngle+=(4+power*18)*dt*0.55; beatTimer-=dt; if(beatTimer<=0) startTiming(); }
    else if(state==='timing'){ spinAngle+=(4+power*18)*dt*0.55; tm+=tmDir*1.5*dt; if(tm>=1){tm=1;tmDir=-1;}else if(tm<=0){tm=0;tmDir=1;}
      timingElapsed+=dt; if(timingElapsed>8) doTimingTap(); }
    else if(state==='timingGot'){ beatTimer-=dt; if(beatTimer<=0) toRelease(); }
    else if(state==='release'){ beatTimer-=dt; if(beatTimer<=0) startFlight(); }
    else if(state==='flight'){ flightT+=dt; var p=clamp(flightT/flightDur,0,1); var ep=1-Math.pow(1-p,1.7);
      currentDist=Math.round(distance*ep); if(planeX>-120) planeX-=240*dt; if(p>=1) startLanding(); }
    else if(state==='landing'){ landTimer-=dt; if(landTimer<=0) showResult(); }
  }

  // ---------- 描画 ----------
  function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function drawChikuwa(cx,cy,scale,rot){ var w=42*scale,h=26*scale;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot||0); ctx.fillStyle='#e8c98a'; roundRect(-w/2,-h/2,w,h,8*scale); ctx.fill();
    ctx.strokeStyle='#a9803f'; ctx.lineWidth=2*scale;
    for(var k=-1;k<=1;k++){ ctx.beginPath(); ctx.moveTo(k*w*0.28,-h/2+3*scale); ctx.lineTo(k*w*0.28,h/2-3*scale); ctx.stroke(); }
    ctx.fillStyle='#5a3d1e'; ctx.beginPath(); ctx.ellipse(w/2-5*scale,0,3.5*scale,h*0.32,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
  function drawThrower(){ ctx.strokeStyle='#dfe6f5'; ctx.fillStyle='#dfe6f5'; ctx.lineWidth=7; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(TX,GROUND_Y-104,12,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(TX,GROUND_Y-92); ctx.lineTo(TX,GROUND_Y-44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(TX,GROUND_Y-44); ctx.lineTo(TX-14,GROUND_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(TX,GROUND_Y-44); ctx.lineTo(TX+14,GROUND_Y); ctx.stroke();
    var hx=TX+Math.cos(spinAngle)*HANDLE, hy=PIVOT_Y+Math.sin(spinAngle)*HANDLE*0.62;
    for(var t=1;t<=3;t++){ var a=spinAngle-t*0.32; ctx.globalAlpha=0.12*(4-t); drawChikuwa(TX+Math.cos(a)*HANDLE,PIVOT_Y+Math.sin(a)*HANDLE*0.62,0.9,a); } ctx.globalAlpha=1;
    ctx.strokeStyle='#cfd6e6'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(TX,GROUND_Y-80); ctx.lineTo(hx,hy); ctx.stroke();
    drawChikuwa(hx,hy,1,spinAngle); }
  function drawGround(){ ctx.fillStyle='#3a7a3a'; ctx.fillRect(0,GROUND_Y,LW,LH-GROUND_Y);
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,GROUND_Y); ctx.lineTo(LW,GROUND_Y); ctx.stroke(); }
  function drawLaunchScene(){ var g=ctx.createLinearGradient(0,0,0,LH); g.addColorStop(0,'#7fc7ff'); g.addColorStop(1,'#cdeeff');
    ctx.fillStyle=g; ctx.fillRect(0,0,LW,LH);
    ctx.fillStyle='rgba(70,80,107,0.5)'; for(var b=0;b<7;b++){ ctx.fillRect(b*150+10,GROUND_Y-70-((b*37)%4)*16,80,70+((b*37)%4)*16); }
    drawGround(); drawThrower(); }
  function drawPowerBar(){
    if(tapFx){ for(var i=0;i<tapFx.length;i++){ var f=tapFx[i]; var a=clamp(f.life/0.45,0,1);
      ctx.globalAlpha=a; ctx.strokeStyle='#ffe27a'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(f.x,f.y,(0.45-f.life)*70+6,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font='bold 22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('+',f.x,f.y); } ctx.globalAlpha=1; }
    var bw=360,bh=22,bx=(LW-bw)/2,by=LH-44;
    ctx.fillStyle='rgba(0,0,0,0.45)'; roundRect(bx-4,by-4,bw+8,bh+8,8); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.15)'; roundRect(bx,by,bw,bh,6); ctx.fill();
    var col=power<0.5?'#6fcf6f':(power<0.85?'#ffd23f':'#ff6b4a'); ctx.fillStyle=col; roundRect(bx,by,bw*power,bh,6); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('パワー '+Math.round(power*100)+'%', LW/2, by-22);
    ctx.font='bold 24px sans-serif'; ctx.fillStyle='#ffe27a'; ctx.fillText('画面をたくさんタップ！', LW/2, 34);
    ctx.font='bold 26px sans-serif'; ctx.fillStyle='#fff'; ctx.fillText('のこり '+powerTime.toFixed(1)+'s', LW/2, 64); }
  function drawTimingGauge(){ var bw=420,bh=30,bx=(LW-bw)/2,by=LH-58;
    ctx.fillStyle='rgba(0,0,0,0.5)'; roundRect(bx-5,by-5,bw+10,bh+10,10); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.12)'; roundRect(bx,by,bw,bh,8); ctx.fill();
    var zw=bw*0.18,zx=bx+bw*0.5-zw/2; ctx.fillStyle='rgba(110,220,110,0.55)'; roundRect(zx,by,zw,bh,6); ctx.fill();
    var pz=bw*0.06; ctx.fillStyle='rgba(255,210,80,0.5)'; roundRect(bx+bw*0.5-pz/2,by,pz,bh,4); ctx.fill();
    var mx=bx+tm*bw; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(mx,by-8); ctx.lineTo(mx-8,by-20); ctx.lineTo(mx+8,by-20); ctx.closePath(); ctx.fill(); ctx.fillRect(mx-2,by,4,bh);
    ctx.fillStyle='#ffe27a'; ctx.font='bold 23px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('タイミング！ 真ん中でタップ！！！', LW/2, 36); }
  function drawAngleGauge(){ var gh=210,gw=30,gx=LW-92,gy=(LH-gh)/2+6;
    ctx.fillStyle='rgba(0,0,0,0.5)'; roundRect(gx-5,gy-5,gw+10,gh+10,10); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.12)'; roundRect(gx,gy,gw,gh,8); ctx.fill();
    var zh=gh*0.18,zy=gy+gh*0.5-zh/2; ctx.fillStyle='rgba(110,180,255,0.55)'; roundRect(gx,zy,gw,zh,6); ctx.fill();
    var pzh=gh*0.06; ctx.fillStyle='rgba(255,210,80,0.5)'; roundRect(gx,gy+gh*0.5-pzh/2,gw,pzh,4); ctx.fill();
    var my=gy+ang*gh; ctx.fillStyle='#fff'; ctx.fillRect(gx-6,my-2,gw+12,4);
    ctx.beginPath(); ctx.moveTo(gx-8,my); ctx.lineTo(gx-22,my-9); ctx.lineTo(gx-22,my+9); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#9fe6ff'; ctx.font='bold 23px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('角度！ まん中でタップ！', LW/2-30, 36); }
  function drawBeat(lines,color){ var lh=52,bh=lines.length*lh+22;
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,LH/2-bh/2,LW,bh);
    ctx.fillStyle=color; ctx.font='bold 40px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=10; var y0=LH/2-(lines.length-1)*lh/2;
    for(var i=0;i<lines.length;i++) ctx.fillText(lines[i],LW/2,y0+i*lh); ctx.shadowBlur=0; }
  function drawCelestial(emoji,x,y,size,alpha){ if(alpha<=0) return; ctx.globalAlpha=alpha; ctx.font=size+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(emoji,x,y); ctx.globalAlpha=1; }
  function drawGod(x,y,alpha){ if(alpha<=0) return; ctx.save(); ctx.globalAlpha=alpha; ctx.strokeStyle='rgba(255,230,140,0.8)'; ctx.lineWidth=3;
    for(var r=0;r<12;r++){ var an=r/12*Math.PI*2+(flightT*0.6); ctx.beginPath(); ctx.moveTo(x+Math.cos(an)*44,y+Math.sin(an)*44); ctx.lineTo(x+Math.cos(an)*72,y+Math.sin(an)*72); ctx.stroke(); }
    ctx.font='72px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('😇',x,y); ctx.restore(); }
  function drawFlightScene(){
    var p=clamp(flightT/flightDur,0,1); var altFrac=(state==='landing')?0:Math.sin(p*Math.PI)*maxAltZone;
    var sc=skyColors(altFrac); var g=ctx.createLinearGradient(0,0,0,LH); g.addColorStop(0,sc.top); g.addColorStop(1,sc.bot); ctx.fillStyle=g; ctx.fillRect(0,0,LW,LH);
    var starA=fade(altFrac,0.45,0.2);
    if(starA>0&&stars){ for(var i=0;i<stars.length;i++){ var s=stars[i]; ctx.globalAlpha=starA*(0.5+0.5*Math.abs(Math.sin(flightT*3+s.tw))); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1; }
    drawCelestial('🌙',LW-150,110,70,fade(altFrac,0.6,0.15));
    drawCelestial('🪐',210,150,84,fade(altFrac,0.9,0.12));
    drawCelestial('🛸',LW-250,235,64,fade(altFrac,1.12,0.1));
    drawCelestial('🌌',300,100,96,fade(altFrac,1.28,0.1));
    drawGod(LW/2,135,fade(altFrac,1.42,0.08));
    var cloudA=clamp(Math.min((altFrac-0.06)/0.1,(0.5-altFrac)/0.15),0,1);
    if(cloudA>0){ ctx.globalAlpha=cloudA; ctx.font='56px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; var cs=(currentDist*0.25)%(LW+200);
      ctx.fillText('☁️',(LW+100-cs),120); ctx.fillText('☁️',((LW+100-cs)+380)%(LW+200)-80,200); ctx.fillText('☁️',((LW+100-cs)+700)%(LW+200)-80,90); ctx.globalAlpha=1; }
    if(altFrac>0.18&&altFrac<0.45&&maxAltZone>0.3&&planeX>-120){ ctx.font='44px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('✈️',planeX,170); }
    var groundA=clamp(1-altFrac/0.22,0,1);
    if(groundA>0){ ctx.globalAlpha=groundA; ctx.fillStyle='#2e6b2e'; ctx.fillRect(0,GROUND_Y,LW,LH-GROUND_Y);
      var off=(currentDist*0.6)%140; ctx.fillStyle='#46506b'; for(var b=-1;b<8;b++){ var bx2=b*140-off, bh2=70+((b*53)%5)*18; ctx.fillRect(bx2+20,GROUND_Y-bh2,90,bh2); } ctx.globalAlpha=1; }
    var cx=190, cy=GROUND_Y-18-Math.min(altFrac,1.0)*ARC_MAX;
    if(state==='landing'){ cy=GROUND_Y-16; var tt=(LAND_HOLD-landTimer); ctx.strokeStyle='rgba(180,160,120,0.6)'; ctx.lineWidth=3;
      for(var dN=0;dN<3;dN++){ var rr=20+tt*120+dN*10; ctx.globalAlpha=clamp(1-tt/1.2,0,0.6); ctx.beginPath(); ctx.arc(cx,GROUND_Y,rr,Math.PI*1.05,Math.PI*1.95); ctx.stroke(); } ctx.globalAlpha=1; drawChikuwa(cx,cy,1.2,0);
    } else { for(var tr=1;tr<=4;tr++){ ctx.globalAlpha=0.10*(5-tr); drawChikuwa(cx-tr*16,cy+tr*2,1.1,flightT*16); } ctx.globalAlpha=1; drawChikuwa(cx,cy,1.2,flightT*16); }
    ctx.fillStyle='#fff'; ctx.font='bold 46px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=8; ctx.fillText(currentDist+' m', LW/2, 24); ctx.shadowBlur=0;
    if(state==='landing'){ ctx.fillStyle='#ffe27a'; ctx.font='bold 34px sans-serif'; ctx.fillText('着地！', LW/2, 78); }
  }
  function render(){ toLogical();
    if(state==='flight'||state==='landing'){ drawFlightScene(); return; }
    drawLaunchScene();
    if(state==='power'){ drawPowerBar(); }
    else if(state==='angle'){ drawAngleGauge(); }
    else if(state==='timing'){ drawTimingGauge(); }
    else if(state==='ready'){ if(beatTimer>0.9) drawBeat(['画面をたくさん','タップしてね！','よーい…'],'#ffe27a'); else drawBeat(['スタート！'],'#ff6b4a'); }
    else if(state==='powerGot'){ drawBeat(['パワー', Math.round(power*100)+'% ゲット！'],'#ffe27a'); }
    else if(state==='angleGot'){ drawBeat(['角度', Math.round(angAcc*100)+'% ゲット！'],'#9fe6ff'); }
    else if(state==='timingGot'){ drawBeat(['タイミング', Math.round(accuracy*100)+'% ゲット！'],'#9fe6ff'); }
    else if(state==='release'){ drawBeat(['さあ、','結果は…！？'],'#fff36b'); }
  }

  function loop(now){ if(!running) return; rafId=requestAnimationFrame(loop);
    var dt=Math.min((now-lastTime)/1000,0.05); lastTime=now; if(state!=='title'&&state!=='result') update(dt); render(); }
  function startLoop(){ if(running) return; running=true; lastTime=performance.now(); rafId=requestAnimationFrame(loop); }
  function stopLoop(){ running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0; }
  function isOpen(){ return wrap && wrap.classList.contains('show'); }
  function tapInput(x,y){ if(state==='power') addPower(x,y); else if(state==='angle') doAngleTap(); else if(state==='timing') doTimingTap(); }

  function bind(){ if(bound) return; bound=true;
    wrap=document.getElementById('hammer-wrap'); stage=document.getElementById('hammer-stage');
    canvas=document.getElementById('hammer-canvas'); ctx=canvas.getContext('2d');
    elBest=document.getElementById('hammer-best'); titleScr=document.getElementById('hammer-title');
    overScr=document.getElementById('hammer-over'); retryBtn=document.getElementById('hammer-retry'); muteBtn=document.getElementById('hammer-mute');
    var startBtn=document.getElementById('hammer-start');
    if(startBtn) startBtn.addEventListener('click', function(e){ e.stopPropagation(); startReady(); });
    retryBtn.addEventListener('click', function(e){ e.stopPropagation(); showTitle(); });
    muteBtn.addEventListener('click', function(e){ e.stopPropagation(); muted=!muted; muteBtn.textContent=muted?'🔇':'🔊'; if(master) master.gain.value=muted?0:0.5; });
    var rulesBtn=document.getElementById('hammer-rules-btn'), rulesScr=document.getElementById('hammer-rules'), rulesClose=document.getElementById('hammer-rules-close');
    if(rulesBtn&&rulesScr) rulesBtn.addEventListener('click', function(e){ e.stopPropagation(); renderRules(); rulesScr.classList.remove('hidden'); });
    if(rulesClose&&rulesScr) rulesClose.addEventListener('click', function(e){ e.stopPropagation(); rulesScr.classList.add('hidden'); });
    wrap.addEventListener('pointerdown', function(e){ if(state!=='power'&&state!=='angle'&&state!=='timing') return;
      if(e.target&&e.target.closest&&e.target.closest('button')) return; e.preventDefault();
      var r=stage.getBoundingClientRect(); var x=(e.clientX-r.left)/r.width*LW, y=(e.clientY-r.top)/r.height*LH;
      if(x<0||x>LW||y<0||y>LH){ x=null; y=null; } tapInput(x,y); });
    window.addEventListener('keydown', function(e){ if(!isOpen()) return;
      if(e.code==='Space'||e.code==='ArrowUp'){ e.preventDefault(); if(e.repeat&&state!=='power') return;
        if(state==='power'||state==='angle'||state==='timing') tapInput(); else if(state==='title'||state==='result') startReady(); } });
    window.addEventListener('resize', function(){ if(isOpen()){ resize(); render(); } });
  }

  window.hammerLaunch=function(ctxAudio){ actx=ctxAudio||actx; bind(); ensureMaster(); resize(); showTitle(); startLoop(); render(); };
  window.hammerShutdown=function(){ state='title'; stopLoop(); };
  if(document.readyState!=='loading') bind(); else document.addEventListener('DOMContentLoaded', bind);
})();
