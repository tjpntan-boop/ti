/* ちくわうらない — 名前を入れると、あなたを「あったらいいけど無くても気にならないもの」に例えて
   それらしい言葉で哀愁たっぷりに鼓舞する診断うらない。最後は流れ星キラーンで終わる。 */
(function(){
  var URVER='2.48.2';
  var actx=null, master=null, muted=false;
  var intro, reading, result, nameIn, drawBtn, againBtn, muteBtn, star, readTxt, titleEl;
  var rTimer=null, sTimer=null;
  var bgmNodes=[], bgmTimer=null, bgmGain=null;

  // あったらいいけど無くても気にならないもの → タイプ別診断
  var TYPES=[
    {t:'ホテルの使い捨てスリッパ', d:'あなたは、誰かのほんの一夜のために生まれ、静かに役目を終える人。無くても、困りはしない。けれど、あれば確かに、足もとはやわらかくなる。その控えめなやさしさを、どうか恥じないで。'},
    {t:'ドレッシングの最後のひとしずく', d:'あなたは、最後まで振り絞る人。出し切れず、瓶の底に残ることもある。それでも、あなたが注いだひとしずくは、確かに誰かのサラダを変えた。気づかれなくても、味は、もう届いている。'},
    {t:'食パンの袋をとめる、あのプラスチック', d:'あなたは、ゆるんだ何かを、そっと留めておく人。名前も呼ばれず、すぐに捨てられる。でも、あなたがいた数日間、パンは確かに守られていた。それで、十分じゃないか。'},
    {t:'リモコンの、一度も押さないボタン', d:'あなたは、いつか来るかもしれない出番を、ずっと待っている人。その日は、来ないかもしれない。それでも、あなたがそこにいるだけで、誰かは静かに安心している。'},
    {t:'醤油さしの、使わない方の小さな穴', d:'あなたは、もう一つの可能性として存在する人。たいてい、選ばれない。けれど、あなたがいるから、世界には「選べる」という、ささやかな余白がある。'},
    {t:'お菓子の袋に入っている乾燥剤', d:'あなたは、誰かのサクサクを、見えないところで守る人。食べられはしない。礼も言われない。けれど、あなたがいなければ、湿気は静かに、すべてを台無しにしていた。'},
    {t:'エレベーターの「閉」ボタン', d:'あなたは、押しても何も変わらないかもしれない、と言われる人。それでも人は、あなたを押す。その一秒を、信じたいから。あなたは、希望のかたちをしている。'},
    {t:'カレンダーのすみっこの、六曜', d:'あなたは、誰も気にしないのに、ずっとそこにいる人。大安、仏滅。意味は薄れても、あなたが今日に、ほんの少しの物語を、そっと足している。'},
    {t:'自販機の「あったか〜い」の、最後の一本', d:'あなたは、寒い夜に、最後の一本として残る人。選ばれるまで、ずいぶん長く待つ。でも、あなたを買った誰かの手のひらは、確かにあたたかくなった。'},
    {t:'ボールペンの、ノックする上のところ', d:'あなたは、本体ではないのに、なぜか毎日さわられる人。役目は、よくわからない。それでも、あなたを押すあの感触が、誰かの手なぐさめになっている。'},
    {t:'新幹線の窓ぎわの、小さなテーブル', d:'あなたは、たいしたものは載せられない人。缶コーヒーひとつで、もう精一杯。でも、その上で誰かが書いた一通の手紙が、人生を変えたかもしれない。'},
    {t:'ノートの、最後まで使われない数ページ', d:'あなたは、いつか書かれるはずだった言葉のための、余白。たぶん、白いまま終わる。けれど、余白があるから、人は安心して、書き始められるのだ。'},
    {t:'説明書の、読まれないトラブル対処ページ', d:'あなたは、困ったときだけ思い出される人。ふだんは、忘れられている。それでも、いざという夜、あなたの一行が、誰かを静かに救う。'},
    {t:'結婚式のテーブルに置かれた、小さな花', d:'あなたは、主役ではない人。誰も、あなたの名前を覚えていない。でも、あなたがいたから、その一日は、ほんの少しだけ、美しかった。'},
    {t:'コンビニのレジ横の、いちばん端のガム', d:'あなたは、「ついで」として手に取られる人。目的には、なれない。けれど、あなたを噛んだあの午後、誰かの口の中だけは、すこし爽やかだった。'},
    {t:'駅の時刻表の、終電のさらに下の余白', d:'あなたは、もう電車の来ない時間に、それでもそこにいる人。誰も、見ない。でも、終わったあとの静けさを、あなただけが知っている。'},
    {t:'コップの水に浮かぶ、レモンの薄切り', d:'あなたは、香りだけ残して、最後まで食べられない人。役に立っているのか、わからない。でも、あなたがいた一杯は、確かに、少しだけ特別だった。'},
    {t:'防災リュックの、奥に入れた笛', d:'あなたは、鳴る日が来ないことを、いちばん願われている人。出番がない＝しあわせ。その逆説を、あなたは静かに引き受けている。'},
    {t:'靴の中の、丸めた詰め紙', d:'あなたは、誰かが歩き出すまでの間だけ、そっと形を守る人。役目が終われば、まっさきに捨てられる。それでも、あなたがいたから、その靴は型崩れせずに、初めての一歩を待てた。'},
    {t:'お弁当のすみの、緑の仕切り（バラン）', d:'あなたは、味には関係ないのに、そこにいる人。食べられもしない。でも、あなたがいるだけで、隣のおかずは、にじまずに、きちんと自分でいられた。'},
    {t:'冷蔵庫のドアポケットの、半分残ったジャム', d:'あなたは、忘れられたまま、静かに甘さを守っている人。使いきられないかもしれない。それでも、ふと思い出された朝、あなたはまだ、ちゃんと甘い。'},
    {t:'卓上カレンダーの、もうめくられた先月のページ', d:'あなたは、役目を終えても、すぐには切り離されない人。もう、誰も見ない。けれど、あなたが過ぎたぶんだけ、その人は、ちゃんと前へ進んでいる。'}
  ];
  var APH=[
    '無くても、世界は回る。あっても、世界は回る。あなたは、その「あっても」の側に、いていい。',
    '誰にも気づかれない優しさが、いちばん長く、世界に残る。',
    '急がなくていい。星は、何万年も前から、あなたを待っていた。',
    '意味なんて、たぶん後からついてくる。今日のところは、ちくわでも食べよう。',
    'あなたがいてもいなくても、明日は来る。だからこそ、あなたがいる今日は、すこし特別だ。',
    'うまく言えないけれど、あなたは、たぶん、だいじょうぶ。',
    '小さなものほど、無くなってから、ながく思い出される。'
  ];
  var LUCKY=['磯辺揚げ','チーズちくわ','ちくわの天ぷら','きゅうりちくわ','ちくわぶ','焼きちくわ','ちくわサラダ','ちくわの磯辺巻き','ちくわの煮物'];
  var DIR=['北','北東','東','南東','南','南西','西','北西'];
  var TIME=['夜明け前','朝のひかりの中','正午すぎ','夕暮れどき','星が出るころ','真夜中'];

  function hashStr(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }

  function tone(freq,dur,when,type,gain){ if(!actx||!master) return; var t=when||actx.currentTime;
    var o=actx.createOscillator(), g=actx.createGain(); o.type=type||'sine'; o.frequency.value=freq;
    o.connect(g); g.connect(master); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(gain||0.18,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur+0.03); }
  function twinkle(){ if(!actx) return; var t=actx.currentTime; tone(1200,0.2,t,'sine',0.07); tone(1840,0.18,t+0.05,'sine',0.04); }
  function revealChime(){ if(!actx) return; var t=actx.currentTime; [523.25,659.25,783.99].forEach(function(f,i){ tone(f,0.7,t+i*0.09,'sine',0.14); }); }
  function starSparkle(){ if(!actx) return; var t=actx.currentTime; tone(2093,0.5,t,'sine',0.16); tone(2793,0.55,t+0.05,'sine',0.11); tone(3520,0.6,t+0.10,'triangle',0.08); }

  // 神秘的なBGM（アンビエントパッド＋ゆらぎ＋きらめき）
  function startBGM(){
    if(!actx||!master) return; stopBGM();
    bgmGain=actx.createGain(); bgmGain.gain.value=0.0001; bgmGain.connect(master);
    bgmGain.gain.linearRampToValueAtTime(0.5, actx.currentTime+4);
    var filt=actx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=780; filt.Q.value=3; filt.connect(bgmGain);
    var chord=[146.83,220.00,261.63,392.00]; // D3 A3 C4 G4：開いた神秘的な響き
    chord.forEach(function(f,i){
      var o=actx.createOscillator(); o.type=(i%2?'sine':'triangle'); o.frequency.value=f; o.detune.value=(i-1.5)*4;
      var g=actx.createGain(); g.gain.value=0.0001; o.connect(g); g.connect(filt);
      g.gain.linearRampToValueAtTime(0.05, actx.currentTime+5);
      var lfo=actx.createOscillator(); lfo.frequency.value=0.06+i*0.017; var lg=actx.createGain(); lg.gain.value=0.022;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(); o.start(); bgmNodes.push(o,lfo);
    });
    var flfo=actx.createOscillator(); flfo.frequency.value=0.035; var flg=actx.createGain(); flg.gain.value=320;
    flfo.connect(flg); flg.connect(filt.frequency); flfo.start(); bgmNodes.push(flfo);
    var scale=[587.33,659.25,783.99,880.00,1046.50,1174.66]; // 高音のきらめき（ペンタ）
    (function sparkle(){ if(!actx||!bgmGain) return;
      var f=scale[(Math.random()*scale.length)|0], t=actx.currentTime;
      var o=actx.createOscillator(), g=actx.createGain(); o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(bgmGain);
      g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.05,t+0.03); g.gain.exponentialRampToValueAtTime(0.0001,t+2.4);
      o.start(t); o.stop(t+2.5);
      bgmTimer=setTimeout(sparkle, 1800+Math.random()*2800);
    })();
  }
  function stopBGM(){ if(bgmTimer){ clearTimeout(bgmTimer); bgmTimer=null; }
    bgmNodes.forEach(function(n){ try{ n.stop(); }catch(e){} try{ n.disconnect(); }catch(e){} }); bgmNodes=[];
    if(bgmGain){ try{ bgmGain.disconnect(); }catch(e){} bgmGain=null; } }

  function runTitle(){ if(titleEl){ titleEl.classList.remove('run'); void titleEl.offsetWidth; titleEl.classList.add('run'); } }

  function show(panel){ [intro,reading,result].forEach(function(p){ if(p) p.classList.add('hidden'); }); if(panel) panel.classList.remove('hidden'); }

  function doDraw(){
    var name=(nameIn&&nameIn.value||'').trim(); if(!name) name='ちくわ'; name=name.slice(0,12);
    try{ if(nameIn) nameIn.blur(); }catch(e){}
    show(reading); twinkle();
    var steps=['星を読んでいます…','ちくわが、かすかに揺れました。','「'+name+'」さんの、こころのかたちを……'];
    var si=0; if(readTxt) readTxt.textContent=steps[0];
    clearInterval(rTimer);
    rTimer=setInterval(function(){ si++; if(si<steps.length){ if(readTxt) readTxt.textContent=steps[si]; twinkle(); } }, 1300);
    clearTimeout(sTimer);
    sTimer=setTimeout(function(){ clearInterval(rTimer); reveal(name); }, 4300);
  }

  function reveal(name){
    var h=hashStr(name);
    var ty=TYPES[h%TYPES.length];
    var aph=APH[(h>>>3)%APH.length];
    var luck=LUCKY[(h>>>5)%LUCKY.length];
    var dir=DIR[(h>>>8)%DIR.length];
    var num=((h>>>11)%90)+1;
    var tm=TIME[(h>>>15)%TIME.length];
    document.getElementById('uranai-rname').textContent='「'+name+'」さん、あなたは——';
    document.getElementById('uranai-type').textContent='『'+ty.t+'』タイプ';
    document.getElementById('uranai-diag').textContent=ty.d;
    document.getElementById('uranai-lucky').innerHTML=
      '<span>ラッキーちくわ：'+luck+'</span><span>幸運の数：'+num+'</span><span>たたずむ方角：'+dir+'</span><span>満ちる時刻：'+tm+'</span>';
    document.getElementById('uranai-aph').textContent=aph;
    show(result); revealChime();
    clearTimeout(sTimer);
    sTimer=setTimeout(function(){ if(star){ star.classList.remove('go'); void star.offsetWidth; star.classList.add('go'); } starSparkle(); }, 5200);
  }

  function againf(){ show(intro); if(star) star.classList.remove('go'); runTitle(); try{ if(nameIn){ nameIn.value=''; nameIn.focus(); } }catch(e){} }

  window.uranaiLaunch=function(ctx){
    actx=ctx||null;
    if(actx){ try{ master=actx.createGain(); master.gain.value=muted?0:0.5; master.connect(actx.destination); }catch(e){ master=null; } }
    intro=document.getElementById('uranai-intro'); reading=document.getElementById('uranai-reading'); result=document.getElementById('uranai-result');
    nameIn=document.getElementById('uranai-name'); drawBtn=document.getElementById('uranai-draw'); againBtn=document.getElementById('uranai-again');
    muteBtn=document.getElementById('uranai-mute'); star=document.getElementById('uranai-star'); readTxt=document.getElementById('uranai-readtext');
    titleEl=document.getElementById('uranai-title');
    if(drawBtn && !drawBtn.__ub){ drawBtn.__ub=1;
      drawBtn.addEventListener('click', function(e){ e.stopPropagation(); doDraw(); });
      if(againBtn) againBtn.addEventListener('click', function(e){ e.stopPropagation(); againf(); });
      if(nameIn) nameIn.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); doDraw(); } });
      if(muteBtn) muteBtn.addEventListener('click', function(e){ e.stopPropagation(); muted=!muted; muteBtn.textContent=muted?'🔇':'🔊'; if(master) master.gain.value=muted?0:0.5; });
    }
    show(intro); if(star) star.classList.remove('go');
    runTitle(); startBGM();
  };
  window.uranaiShutdown=function(){ clearInterval(rTimer); clearTimeout(sTimer); stopBGM(); try{ if(master) master.disconnect(); }catch(e){} master=null; };
})();
