/* ===== 🚇 8番ダッシュ 本体（独立スコープ / モジュール）=====
   ハブ(index.html)から games/dash.js として遅延ロードされる。
   window.dash8Launch(audioCtx) / window.dash8Shutdown() を公開。 */
(function(){
  'use strict';

  var LW = 900, LH = 506;
  var GROUND_Y = LH - 64;
  var PLAYER_X = 150;
  var GRAVITY = 2300;
  var JUMP_V  = -790;
  var STAND_W = 42, STAND_H = 56;
  var SLIDE_W = 58, SLIDE_H = 28;
  var BASE_SPEED = 360, MAX_SPEED = 730;
  var BEST_KEY = 'dash8_best_v1';

  var wrap, stage, canvas, ctx, elDist, elCw, elBest, elHud, titleScr, overScr, startBtn, retryBtn, muteBtn;

  var state = 'title';
  var player, obstacles, pickups, speed, distAccum, chikuwa, spawnTimer, pickTimer, shake, runPhase;
  var sliding = false, slidePointerId = null;
  var lastTime = 0, rafId = 0, running = false, bound = false;

  var actx = null, master = null, muted = false, bgmTimer = null, bgmStep = 0;
  var BGM_NOTES = [220,277,330,277, 196,247,294,247];

  function normRec(r){ return { dist: Math.max(0, Math.floor((r && r.dist) || 0)), cw: Math.max(0, Math.floor((r && r.cw) || 0)) }; }
  function loadScores(){
    try {
      var raw = localStorage.getItem(BEST_KEY);
      if (!raw) return [];
      var v = JSON.parse(raw);
      var list;
      if (Array.isArray(v)) list = v.map(normRec);
      else if (v && typeof v === 'object') list = (v.dist ? [normRec(v)] : []); // 旧：単一ベスト→1件配列へ移行
      else list = []; // 旧：数値スコアは距離不明なので破棄
      list = list.filter(function(r){ return r.dist > 0; });
      list.sort(function(a,b){ return (b.dist - a.dist) || (b.cw - a.cw); });
      return list.slice(0,3);
    } catch(e){ return []; }
  }
  function saveScores(list){ try { localStorage.setItem(BEST_KEY, JSON.stringify(list.slice(0,3))); } catch(e){} }
  function submitScore(dist, cw){
    var list = loadScores();
    var entry = normRec({ dist:dist, cw:cw });
    list.push(entry);
    list.sort(function(a,b){ return (b.dist - a.dist) || (b.cw - a.cw); });
    var rank = list.indexOf(entry) + 1;
    saveScores(list);
    return rank <= 3 ? rank : 0; // 0=ランク外
  }
  function bestHTML(scores, hi){
    var medals = ['🥇','🥈','🥉'];
    var out = '<span class="dbest-head">🏆 ベスト距離 TOP3</span>';
    if (!scores.length) return out + '<span class="dbest-row">まだ記録なし</span>';
    for (var i=0;i<3;i++){
      var r = scores[i];
      var txt = r ? (r.dist + 'm（ちくわ ' + r.cw + '本）') : '—';
      out += '<span class="dbest-row' + (hi===i ? ' dbest-hi' : '') + '">' + medals[i] + ' ' + txt + '</span>';
    }
    return out;
  }

  function ensureMaster(){
    if (!actx || master) return;
    try { master = actx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(actx.destination); }
    catch(e){ master = null; }
  }
  function blip(freq, dur, type, vol){
    if (!actx || !master || muted) return;
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, actx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(actx.currentTime + dur + 0.02);
  }
  function noiseHit(){
    if (!actx || !master || muted) return;
    var len = actx.sampleRate * 0.35;
    var buf = actx.createBuffer(1, len, actx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i=0;i<len;i++){ d[i] = (Math.random()*2-1) * (1 - i/len); }
    var src = actx.createBufferSource(); src.buffer = buf;
    var g = actx.createGain(); g.gain.value = 0.4;
    var f = actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1200;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function startBgm(){
    if (!actx || bgmTimer) return;
    bgmStep = 0;
    bgmTimer = setInterval(function(){
      if (state !== 'playing' || muted || !actx) return;
      var n = BGM_NOTES[bgmStep % BGM_NOTES.length];
      blip(n, 0.12, 'triangle', 0.12);
      if (bgmStep % 4 === 0) blip(n/2, 0.18, 'sawtooth', 0.10);
      bgmStep++;
    }, 150);
  }
  function stopBgm(){ if (bgmTimer){ clearInterval(bgmTimer); bgmTimer = null; } }

  function resize(){
    if (!stage) return;
    var r = stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  function toLogical(){ ctx.setTransform(canvas.width / LW, 0, 0, canvas.height / LH, 0, 0); }

  function reset(){
    player = { feet: GROUND_Y, vy: 0, onGround: true };
    obstacles = []; pickups = [];
    speed = BASE_SPEED; distAccum = 0; chikuwa = 0;
    spawnTimer = 0.8; pickTimer = 1.4; shake = 0; runPhase = 0; sliding = false;
    if (elDist) elDist.textContent = '0';
    if (elCw) elCw.textContent = '0';
  }

  function showTitle(){
    state = 'title';
    stopBgm();
    reset();
    if (elBest) elBest.innerHTML = bestHTML(loadScores(), -1);
    if (elHud) elHud.style.display = 'none';
    overScr.classList.add('hidden');
    titleScr.classList.remove('hidden');
  }

  function startGame(){
    if (actx && actx.state === 'suspended'){ try { actx.resume(); } catch(e){} }
    ensureMaster();
    reset();
    state = 'playing';
    if (elHud) elHud.style.display = 'flex';
    titleScr.classList.add('hidden');
    overScr.classList.add('hidden');
    startBgm();
    blip(660, 0.1, 'square', 0.25);
    lastTime = performance.now();
  }

  function gameOver(){
    state = 'over';
    stopBgm();
    noiseHit();
    if (elHud) elHud.style.display = 'none';
    var dist = Math.floor(distAccum);
    var rank = submitScore(dist, chikuwa);
    var scores = loadScores();
    document.getElementById('dash-over-dist').textContent = dist;
    document.getElementById('dash-over-cw').textContent   = chikuwa;
    var msg = rank > 0 ? ('🎉 TOP3入り！ ' + rank + '位！') : 'ランク外…（次こそTOP3へ）';
    document.getElementById('dash-over-best').innerHTML =
      '<span class="dbest-msg' + (rank>0 ? ' dbest-msg-in' : '') + '">' + msg + '</span>' +
      bestHTML(scores, rank>0 ? rank-1 : -1);
    overScr.classList.remove('hidden');
  }

  function jump(){
    if (state !== 'playing') return;
    if (player.onGround){ player.vy = JUMP_V; player.onGround = false; sliding = false; blip(880, 0.12, 'square', 0.22); }
  }
  function setSlide(on){ if (state !== 'playing') return; sliding = on && player.onGround; }

  function spawnObstacle(){
    var overhead = Math.random() < 0.42;
    if (overhead){
      obstacles.push({ type:'over', x: LW + 40, w: 50, top: GROUND_Y - 132, h: 98 });
    } else {
      var tall = Math.random() < 0.25;
      var h = tall ? 64 : 46;
      obstacles.push({ type:'ground', x: LW + 40, w: 44, top: GROUND_Y - h, h: h });
    }
  }
  function spawnPickup(){
    var high = Math.random() < 0.6;
    var cy = high ? GROUND_Y - 96 : GROUND_Y - 30;
    pickups.push({ x: LW + 30, y: cy, r: 16, got:false });
  }

  function update(dt){
    var d = Math.floor(distAccum);
    speed = Math.min(BASE_SPEED + d * 0.9, MAX_SPEED);
    distAccum += speed * dt * 0.1;
    runPhase += dt * speed * 0.05;

    if (!player.onGround){
      player.vy += GRAVITY * dt;
      player.feet += player.vy * dt;
      if (player.feet >= GROUND_Y){ player.feet = GROUND_Y; player.vy = 0; player.onGround = true; }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0){ spawnObstacle(); var interval = Math.max(0.72, 1.45 - d * 0.0011); spawnTimer = interval + Math.random() * 0.5; }
    pickTimer -= dt;
    if (pickTimer <= 0){ if (Math.random() < 0.7) spawnPickup(); pickTimer = 1.0 + Math.random() * 1.6; }

    var i;
    for (i = obstacles.length - 1; i >= 0; i--){ obstacles[i].x -= speed * dt; if (obstacles[i].x + obstacles[i].w < -20) obstacles.splice(i,1); }
    for (i = pickups.length - 1; i >= 0; i--){ pickups[i].x -= speed * dt; if (pickups[i].x + pickups[i].r < -20) pickups.splice(i,1); }

    var ph = sliding ? SLIDE_H : STAND_H;
    var pw = sliding ? SLIDE_W : STAND_W;
    var box = { x: PLAYER_X - pw/2, y: player.feet - ph, w: pw, h: ph };

    for (i = 0; i < obstacles.length; i++){
      var o = obstacles[i];
      if (box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.top + o.h && box.y + box.h > o.top){
        shake = 14; gameOver(); return;
      }
    }
    for (i = 0; i < pickups.length; i++){
      var p = pickups[i]; if (p.got) continue;
      var cx = Math.max(box.x, Math.min(p.x, box.x + box.w));
      var cy = Math.max(box.y, Math.min(p.y, box.y + box.h));
      var dx = p.x - cx, dy = p.y - cy;
      if (dx*dx + dy*dy < p.r*p.r){ p.got = true; chikuwa++; blip(1320, 0.08, 'square', 0.2); blip(1760, 0.08, 'square', 0.18); }
    }
    pickups = pickups.filter(function(p){ return !p.got; });

    if (shake > 0) shake -= dt * 40;
    if (elDist) elDist.textContent = String(Math.floor(distAccum));
    if (elCw) elCw.textContent = String(chikuwa);
  }

  function roundRect(x,y,w,h,r){
    ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }
  function drawBg(scroll){
    var g = ctx.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, '#1c1c2b'); g.addColorStop(0.6, '#23233a'); g.addColorStop(1, '#15151f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
    var off = scroll % 220;
    ctx.fillStyle = 'rgba(255,240,180,0.16)';
    for (var x = -off; x < LW; x += 220){ ctx.fillRect(x + 60, 24, 100, 12); }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
    var off2 = (scroll*0.7) % 120;
    for (var x2 = -off2; x2 < LW; x2 += 120){ ctx.beginPath(); ctx.moveTo(x2, 40); ctx.lineTo(x2, GROUND_Y); ctx.stroke(); }
    ctx.fillStyle = '#2c2c3e'; ctx.fillRect(0, GROUND_Y, LW, LH - GROUND_Y);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(LW, GROUND_Y); ctx.stroke();
    var off3 = scroll % 90;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 2;
    for (var x3 = -off3; x3 < LW; x3 += 90){ ctx.beginPath(); ctx.moveTo(x3, GROUND_Y + 14); ctx.lineTo(x3 - 20, LH); ctx.stroke(); }
  }
  function drawPlayer(){
    var ph = sliding ? SLIDE_H : STAND_H;
    var pw = sliding ? SLIDE_W : STAND_W;
    var x = PLAYER_X - pw/2, y = player.feet - ph;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(PLAYER_X, GROUND_Y + 2, pw*0.55, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#e8c98a'; roundRect(x, y, pw, ph, 12); ctx.fill();
    ctx.strokeStyle = '#a9803f'; ctx.lineWidth = 3;
    for (var k=0;k<3;k++){ ctx.beginPath(); ctx.moveTo(x + 6 + k*((pw-12)/3), y + 6); ctx.lineTo(x + 6 + k*((pw-12)/3), y + ph - 6); ctx.stroke(); }
    ctx.fillStyle = '#5a3d1e'; ctx.beginPath(); ctx.ellipse(x + pw - 8, y + ph/2, 4, ph*0.28, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(x + pw*0.35, y + ph*0.4, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + pw*0.6, y + ph*0.4, 3, 0, Math.PI*2); ctx.fill();
    if (player.onGround && !sliding){
      var swing = Math.sin(runPhase) * 8;
      ctx.strokeStyle = '#caa25f'; ctx.lineWidth = 5; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x+pw*0.35, GROUND_Y-6); ctx.lineTo(x+pw*0.35+swing, GROUND_Y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+pw*0.6, GROUND_Y-6); ctx.lineTo(x+pw*0.6-swing, GROUND_Y); ctx.stroke();
    }
    ctx.restore();
  }
  function drawObstacle(o){
    ctx.save();
    if (o.type === 'ground'){
      ctx.font = (o.h*0.95) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('👴', o.x + o.w/2, o.top + o.h + 2);
    } else {
      var grd = ctx.createLinearGradient(o.x, o.top, o.x, o.top + o.h);
      grd.addColorStop(0,'#6b6b88'); grd.addColorStop(1,'#3a3a52');
      ctx.fillStyle = grd; roundRect(o.x, o.top, o.w, o.h, 6); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(o.x - 4, o.top + o.h - 16, o.w + 8, 10);
      ctx.fillStyle = '#222'; ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⚠', o.x + o.w/2, o.top + o.h - 11);
    }
    ctx.restore();
  }
  function drawPickup(p){
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(runPhase*0.6 + p.x*0.05)*3);
    ctx.fillStyle = '#e8c98a'; roundRect(-p.r, -p.r*0.6, p.r*2, p.r*1.2, 6); ctx.fill();
    ctx.fillStyle = '#5a3d1e'; ctx.beginPath(); ctx.ellipse(p.r-3, 0, 3, p.r*0.4, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,120,0.6)'; ctx.lineWidth=2; roundRect(-p.r-3, -p.r*0.6-3, p.r*2+6, p.r*1.2+6, 8); ctx.stroke();
    ctx.restore();
  }
  function render(){
    toLogical();
    ctx.save();
    if (shake > 0){ ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); }
    drawBg(distAccum * 6);
    if (state !== 'title'){
      var i;
      for (i=0;i<pickups.length;i++) drawPickup(pickups[i]);
      for (i=0;i<obstacles.length;i++) drawObstacle(obstacles[i]);
      drawPlayer();
    }
    ctx.restore();
  }

  function loop(now){
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    var dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (state === 'playing') update(dt);
    render();
  }
  function startLoop(){ if (running) return; running = true; lastTime = performance.now(); rafId = requestAnimationFrame(loop); }
  function stopLoop(){ running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  function isOpen(){ return wrap && wrap.classList.contains('show'); }

  function bind(){
    if (bound) return; bound = true;
    wrap   = document.getElementById('dash-wrap');
    stage  = document.getElementById('dash-stage');
    canvas = document.getElementById('dash-canvas');
    ctx    = canvas.getContext('2d');
    elDist = document.getElementById('dash-dist');
    elCw   = document.getElementById('dash-cw');
    elHud  = document.getElementById('dash-hud');
    elBest = document.getElementById('dash-best');
    titleScr = document.getElementById('dash-title');
    overScr  = document.getElementById('dash-over');
    startBtn = document.getElementById('dash-start');
    retryBtn = document.getElementById('dash-retry');
    muteBtn  = document.getElementById('dash-mute');

    startBtn.addEventListener('click', function(e){ e.stopPropagation(); startGame(); });
    retryBtn.addEventListener('click', function(e){ e.stopPropagation(); startGame(); });
    muteBtn.addEventListener('click', function(e){
      e.stopPropagation(); muted = !muted; muteBtn.textContent = muted ? '🔇' : '🔊';
      if (master) master.gain.value = muted ? 0 : 0.5;
    });

    stage.addEventListener('pointerdown', function(e){
      if (state !== 'playing') return;
      if (e.target && e.target.closest && e.target.closest('#dash-back-btn,#dash-mute')) return;
      var r = stage.getBoundingClientRect();
      var y = e.clientY - r.top;
      if (y < r.height * 0.5){ jump(); }
      else { slidePointerId = e.pointerId; setSlide(true); }
    });
    stage.addEventListener('pointerup', function(e){ if (e.pointerId === slidePointerId){ slidePointerId = null; setSlide(false); } });
    stage.addEventListener('pointercancel', function(e){ if (e.pointerId === slidePointerId){ slidePointerId = null; setSlide(false); } });

    window.addEventListener('keydown', function(e){
      if (!isOpen()) return;
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW'){
        e.preventDefault();
        if (state === 'playing') jump(); else startGame();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS'){ e.preventDefault(); setSlide(true); }
    });
    window.addEventListener('keyup', function(e){ if (!isOpen()) return; if (e.code === 'ArrowDown' || e.code === 'KeyS') setSlide(false); });
    window.addEventListener('resize', function(){ if (isOpen()){ resize(); render(); } });
  }

  // ハブから呼ばれる起動／終了
  window.dash8Launch = function(ctxAudio){
    actx = ctxAudio || actx;
    bind();
    ensureMaster();
    resize();
    showTitle();
    startLoop();
    render();
  };
  window.dash8Shutdown = function(){
    state = 'title';
    stopBgm();
    stopLoop();
    sliding = false; slidePointerId = null;
  };

  if (document.readyState !== 'loading') bind(); else document.addEventListener('DOMContentLoaded', bind);
})();
