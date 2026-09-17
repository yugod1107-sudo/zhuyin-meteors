/* Standard Zhuyin keys and character-only phonetic recall with mandatory tones. */
'use strict';
const ROWS = [
 [['1','ㄅ'],['2','ㄉ'],['3',''],['4',''],['5','ㄓ'],['6',''],['7',''],['8','ㄚ'],['9','ㄞ'],['0','ㄢ'],['-','ㄦ']],
 [['q','ㄆ'],['w','ㄊ'],['e','ㄍ'],['r','ㄐ'],['t','ㄔ'],['y','ㄗ'],['u','ㄧ'],['i','ㄛ'],['o','ㄟ'],['p','ㄣ']],
 [['a','ㄇ'],['s','ㄋ'],['d','ㄎ'],['f','ㄑ'],['g','ㄕ'],['h','ㄘ'],['j','ㄨ'],['k','ㄜ'],['l','ㄠ'],[';','ㄤ']],
 [['z','ㄈ'],['x','ㄌ'],['c','ㄏ'],['v','ㄒ'],['b','ㄖ'],['n','ㄙ'],['m','ㄩ'],[',','ㄝ'],['.','ㄡ'],['/','ㄥ']]
];
const MAP = Object.fromEntries(ROWS.flat().filter(x=>x[1]));
const ALL = [...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦㄧㄨㄩ'];
const MODES = {practice:{duration:20,count:1,lives:Infinity},challenge:{duration:15,count:2,lives:5},expert:{duration:10,count:3,lives:3}};
const $=id=>document.getElementById(id);
let saved={};try{saved=JSON.parse(localStorage.getItem('zhuyin-meteors-settings')||'{}')}catch{}
let mode=MODES[saved.mode]?saved.mode:'practice', muted=!!saved.muted, selected=new Set(Array.isArray(saved.selected)?saved.selected.filter(s=>ALL.includes(s)):ALL.slice(0,4));
let lesson=saved.lesson==='spelling'||saved.lesson==='chinese'?'spelling':'keys';

const TONE_KEYS={'3':'ˇ','4':'ˋ','6':'ˊ','7':'˙',' ':' '};
const SPEEDS=[.5,1,1.5,2,3];
function selectedSpeed(){const value=Number($('speed').value);return SPEEDS.includes(value)?value:1.5}
const TURRET={pivotBottom:79.75,muzzle:33.54};
const questionDecks=new Map();
function drawSymbol(){
 const id=game.lesson+'|'+game.tones+'|'+[...game.pool].sort().join(',');
 let deck=questionDecks.get(id);
 if(!deck){deck={remaining:[],last:null};questionDecks.set(id,deck)}
 if(!deck.remaining.length){deck.remaining=[...new Set(game.pool)];for(let i=deck.remaining.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck.remaining[i],deck.remaining[j]]=[deck.remaining[j],deck.remaining[i]]}}
 const active=new Set(game.meteors.map(m=>m.symbol));
 let index=deck.remaining.findIndex(s=>!active.has(s)&&s!==deck.last);
 if(index<0)index=deck.remaining.findIndex(s=>!active.has(s));
 if(index<0)index=0;
 const symbol=deck.remaining.splice(index,1)[0];deck.last=symbol;return symbol;
}
let phase='setup', game=null, last=0, spawnIn=0, feedbackUntil=0, audio;
const keys=new Map();
let shots=[], activeShot=null, cannonAngle=0;
const SHOT_AIM=.14, SHOT_BEAM=.16, SHOT_BURST=.32;
function resetShots(){shots=[];activeShot=null;cannonAngle=0;$('effects').replaceChildren();$('turret-barrel').style.transform='rotate(0deg)'}
function queueShot(m,destroy=true){
 if(destroy)game.meteors.splice(game.meteors.indexOf(m),1);
 shots.push({meteor:m,destroy,age:0,from:cannonAngle,beam:null,flash:null,ring:null,sparks:[]});
}
function effect(className){const el=document.createElement('div');el.className=className;$('effects').append(el);return el}
function shotGeometry(m,width,height,duration){
 const target=meteorPosition(m,m.age,width,height,duration);
 const x=target.x+target.size/2,y=target.y+target.size/2;
 // Matches the sprite hub (50%, 48%) and its CSS position above the planet.
 const pivotX=width/2,pivotY=height-TURRET.pivotBottom;
 const angle=Math.atan2(x-pivotX,pivotY-y)*180/Math.PI;
 const rad=angle*Math.PI/180;
 return {x,y,angle,muzzleX:pivotX+Math.sin(rad)*TURRET.muzzle,muzzleY:pivotY-Math.cos(rad)*TURRET.muzzle};
}
function updateShots(dt){
 if(!activeShot&&shots.length){activeShot=shots.shift();activeShot.from=cannonAngle}
 if(!activeShot)return;
 const shot=activeShot,m=shot.meteor;
 const width=$('arena').clientWidth,height=$('arena').clientHeight;
 placeMeteor(m,width,height,config().duration);
 const g=shotGeometry(m,width,height,config().duration);
 shot.age+=dt;
 const aim=Math.min(1,shot.age/SHOT_AIM),smooth=aim*aim*(3-2*aim);
 cannonAngle=shot.from+(g.angle-shot.from)*smooth;
 $('turret-barrel').style.transform=`rotate(${cannonAngle}deg)`;
 if(shot.age>=SHOT_AIM){
  if(!shot.beam){shot.beam=effect('laser');shot.flash=effect('shot-flash');tone()}
  const beamProgress=Math.min(1,(shot.age-SHOT_AIM)/SHOT_BEAM);
  const dx=g.x-g.muzzleX,dy=g.y-g.muzzleY;
  shot.beam.style.left=g.muzzleX+'px';shot.beam.style.top=(g.muzzleY-2.5)+'px';
  shot.beam.style.width=Math.hypot(dx,dy)*Math.min(1,beamProgress*2)+'px';
  shot.beam.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;
  shot.beam.style.opacity=1-Math.max(0,(beamProgress-.6)*2.5);
  shot.flash.style.left=g.muzzleX+'px';shot.flash.style.top=g.muzzleY+'px';shot.flash.style.opacity=1-beamProgress;
 }
 if(shot.age>=SHOT_AIM+SHOT_BEAM){
  if(!shot.ring){shot.ring=effect('impact-ring');for(let i=0;i<10;i++)shot.sparks.push(effect('impact-spark'))}
  const p=Math.min(1,(shot.age-SHOT_AIM-SHOT_BEAM)/SHOT_BURST);
  if(shot.destroy){m.el.style.opacity=1-p;m.el.style.transform=`scale(${1+p*.35})`}
  shot.ring.style.left=g.x+'px';shot.ring.style.top=g.y+'px';shot.ring.style.transform=`scale(${1+p*4})`;shot.ring.style.opacity=1-p;
  shot.sparks.forEach((spark,i)=>{const a=i*Math.PI/5;const distance=12+p*58;spark.style.left=g.x+Math.cos(a)*distance+'px';spark.style.top=g.y+Math.sin(a)*distance+'px';spark.style.opacity=1-p});
 }
 if(shot.age>=SHOT_AIM+SHOT_BEAM+SHOT_BURST){if(shot.destroy)m.el.remove();for(const el of [shot.beam,shot.flash,shot.ring,...shot.sparks])if(el)el.remove();activeShot=null}
}
function config(){const base=MODES[game?.mode||mode];const kind=game?.lesson||lesson;const speed=game?.speed||selectedSpeed();return {...base,speed,duration:base.duration*(kind==='spelling'?1.5:1)/speed}}
function currentTarget(){return game?.meteors.find(m=>m===game.target)||[...(game?.meteors||[])].sort((a,b)=>b.age-a.age)[0]}
function sequenceFor(symbol){const w=WORD_BY_TEXT[symbol];return game.lesson==='keys'?[symbol]:[...w.zhuyin,...(game.tones?[TONE_SYMBOLS[w.tone]]:[])]}
function selectTarget(m){if(phase!=='playing'||game.lesson==='keys')return;game.target=m;hints()}
function renderMeteor(m){if(!m.label)return;m.label.replaceChildren();m.label.textContent=m.symbol;}
function renderLearning(){
 const live=!!game&&['ready','playing','paused','ending'].includes(phase);
 const kind=live?game.lesson:lesson;
 $('keyboard').hidden=false;$('keyboard-heading').hidden=false;
 $('learning-bar').hidden=!live||kind==='keys';
 const target=currentTarget();
 $('target-caption').textContent='看國字，自己拼音 · 點隕石可切換目標';
 $('target-progress').textContent=target?target.symbol+'　已命中 '+target.progress+' / '+target.sequence.length:'等待下一顆隕石';
 $('keyboard-note').textContent=kind==='keys'?'亮起的按鍵，是你的小幫手':'依序拼音，含聲調；一聲按空白鍵';
 if(game)for(const m of game.meteors)m.el.classList.toggle('selected-target',kind==='spelling'&&m===target);
 for(const [symbol,button]of keys)if(Object.values(TONE_KEYS).includes(symbol))button.disabled=kind!=='spelling';
}
function updateSetup(){
 document.querySelectorAll('[data-lesson]').forEach(b=>{b.classList.toggle('selected',b.dataset.lesson===lesson);b.setAttribute('aria-pressed',b.dataset.lesson===lesson)});
 $('key-range-label').hidden=lesson!=='keys';$('word-range-label').hidden=lesson==='keys';$('hints-option').hidden=lesson!=='keys';$('custom').hidden=lesson!=='keys'||$('range').value!=='custom';$('calm-label').hidden=mode!=='practice';
 $('setup-note').textContent=lesson==='spelling'?'切換英文輸入模式。自行拼出完整注音與聲調，一聲用空白鍵；按錯不發射。':'切換英文輸入模式；也可以點下方注音鍵盤。';
 $('lesson-description').textContent=lesson==='spelling'?'隕石只顯示國字。每按對一個注音就射擊一次，拼完整才擊碎！':'找到隕石上的注音，按對鍵就能消除。';
 const seconds=MODES[mode].duration*(lesson==='spelling'?1.5:1)/selectedSpeed();
 $('speed-note').textContent=mode==='practice'&&$('calm').checked?'隕石會停住；取消「停住慢慢練」就會按設定速度掉落。':`目前設定：約 ${Number(seconds.toFixed(1))} 秒落到底部`;
 renderLearning();
}
function persist(){try{localStorage.setItem('zhuyin-meteors-settings',JSON.stringify({mode,lesson,muted,speed:selectedSpeed(),range:$('range').value,wordRange:$('word-range').value,calm:$('calm').checked,hints:$('hints').checked,selected:[...selected]}))}catch{}}
function tone(ok=true){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);osc.frequency.setValueAtTime(ok?640:180,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(ok?1100:130,audio.currentTime+.12);gain.gain.setValueAtTime(.045,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.17);osc.start();osc.stop(audio.currentTime+.18)}catch{}}
function feedback(text){$('feedback').textContent=text;feedbackUntil=performance.now()+1900}
function setMode(value){mode=value;document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on)});updateSetup();persist()}
for(const row of ROWS){const div=document.createElement('div');div.className='key-row';for(const [key,symbol] of row){const b=document.createElement('button');b.className='key';b.disabled=!symbol;b.innerHTML=`<span class="latin">${key.toUpperCase()}</span><span class="symbol">${symbol||'·'}</span>`;b.setAttribute('aria-label',symbol?`${symbol}，${key} 鍵`:'聲調鍵，本次不練習');b.addEventListener('click',()=>input(symbol));if(symbol)keys.set(symbol,b);div.append(b)}$('keyboard').append(div)}
// Replace the four tone placeholders without changing the 37-key mapping.
for(const [key,symbol]of Object.entries(TONE_KEYS)){
 if(key===' '){const row=document.createElement('div');row.className='key-row';const b=document.createElement('button');b.className='key space-key';b.textContent='空白鍵 · 一聲';b.setAttribute('aria-label','空白鍵，一聲');b.onclick=()=>input(' ');row.append(b);$('keyboard').append(row);keys.set(' ',b)}
 else{const index=ROWS[0].findIndex(pair=>pair[0]===key);const b=$('keyboard').children[0].children[index];b.innerHTML=`<span class="latin">${key}</span><span class="symbol">${symbol}</span>`;b.setAttribute('aria-label',`${symbol}，${key} 聲調鍵`);b.onclick=()=>input(symbol);keys.set(symbol,b)}
}
for(const s of ALL){const b=document.createElement('button');b.textContent=s;b.classList.toggle('selected',selected.has(s));b.setAttribute('aria-pressed',selected.has(s));b.onclick=()=>{selected.has(s)?selected.delete(s):selected.add(s);b.classList.toggle('selected',selected.has(s));b.setAttribute('aria-pressed',selected.has(s));persist()};$('custom').append(b)}
function pool(){if(lesson!=='keys')return WORDS.filter(w=>$('word-range').value==='all'||w.group===$('word-range').value).map(w=>w.text);const range=$('range').value;return range==='initial'?ALL.slice(0,21):range==='final'?ALL.slice(21):range==='custom'?[...selected]:[...ALL]}
function overlays(id){for(const name of ['setup','ready','paused','result'])$(name).hidden=name!==id}
function hints(){for(const b of keys.values())b.classList.remove('hint');renderLearning();if(phase==='ready'){keys.get('ㄅ').classList.add('hint');return}if(phase!=='playing'||game.lesson!=='keys')return;const target=currentTarget();if(target&&(game.hints||game.reveal))keys.get(target.symbol)?.classList.add('hint')}
function prepare(symbols){if(!symbols.length){$('start').textContent='請先選至少一個練習項目';return}resetShots();game={pool:[...symbols],lesson,speed:selectedSpeed(),tones:lesson==='spelling',calm:mode==='practice'&&$('calm').checked,hints:$('hints').checked,mode,meteors:[],elapsed:0,hits:0,correct:0,wrong:0,missed:0,combo:0,maxCombo:0,score:0,lives:MODES[mode].lives,weak:new Set(),reveal:false,target:null};phase='ready';$('meteors').replaceChildren();overlays('ready');$('feedback').textContent='';$('pause').disabled=true;$('ready-title').textContent='先試按「ㄅ」';$('ready-text').textContent=lesson==='spelling'?'切換英文輸入模式，先按數字 1 試按。遊戲中只看國字，依序拼音和聲調；一聲按空白鍵。':'切換英文輸入模式，按數字 1，或點下方的「ㄅ」。';hints();persist()}
function begin(){phase='playing';overlays(null);last=performance.now();spawnIn=0;$('pause').disabled=false;feedback(game.lesson==='spelling'?'看國字，自己拼音！':'任務開始！找到注音，按對就出擊');spawn();renderStatus();hints()}
// Store paths as fractions so a resized playfield keeps every meteor in bounds.
function meteorPosition(m, age, width, height, duration) {
 const progress = Math.max(0, Math.min(1, age / duration));
 const size = m.spelling ? (width<620?160:180) : m.sequence?.length>1 ? (width<620?130:150) : (width < 620 ? 82 : 96);
 const travelWidth = Math.max(0, width - size - 20);
 // Enter fully in under a second, then use the chosen falling speed.
 const entry=Math.min(.7/Math.max(1,m.speed||1),duration*.1);
 const t=Math.max(0,Math.min(duration,age));
 const bottom=height-size-7;
 const y=t<entry?-size+(size+12)*(t/entry):12+(bottom-12)*(t-entry)/(duration-entry);
 return {x: 10 + (m.startX + (m.endX - m.startX) * progress) * travelWidth,y,size};
}
function choosePath() {
 const arena = $('arena'), duration = config().duration;
 let best, bestClearance = -Infinity;
 for (let attempt = 0; attempt < 24; attempt++) {
  const startX = Math.random();
  const direction = startX < .22 ? 1 : startX > .78 ? -1 : Math.random() < .5 ? -1 : 1;
  const endX = Math.max(.02, Math.min(.98, startX + direction * (.18 + Math.random() * .3)));
  const candidate = {startX, endX};
  let clearance = game.lastStart === undefined ? 1000 : Math.abs(startX - game.lastStart) * arena.clientWidth;
  for (const other of game.meteors) {
   for (let t = 0; t <= duration - other.age; t += .5) {
    const a = meteorPosition(candidate, t, arena.clientWidth, arena.clientHeight, duration);
    const b = meteorPosition(other, other.age + t, arena.clientWidth, arena.clientHeight, duration);
    clearance = Math.min(clearance, Math.hypot(a.x - b.x, a.y - b.y));
   }
  }
  if (clearance > bestClearance) {best = candidate; bestClearance = clearance;}
  if (clearance >= 120) break;
 }
 game.lastStart = best.startX;
 return best;
}
function placeMeteor(m, width, height, duration) {
 const p = meteorPosition(m, m.age, width, height, duration);
 m.el.style.left = p.x + 'px';
 m.el.style.top = p.y + 'px';
 m.el.style.width = m.el.style.height = p.size + 'px';
}
function spawn(){const symbol=drawSymbol();const path=choosePath();const el=document.createElement('div');el.className='meteor'+(game.lesson==='keys'?'':' learning-meteor')+(game.lesson==='spelling'?' spelling-meteor':'');const art=document.createElement('img');art.className='meteor-art';art.src='assets/meteor.png';art.alt='';art.draggable=false;art.style.transform=`rotate(${Math.round(Math.random()*20-10)}deg)`;const label=document.createElement('span');label.className='meteor-symbol';el.append(art);el.append(label);$('meteors').append(el);const meteor={symbol,speed:game.speed,age:game.calm?config().duration*.38:0,...path,el,label,spelling:game.lesson==='spelling',sequence:sequenceFor(symbol),progress:0};if(game.lesson!=='keys'){el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',`選擇目標 ${symbol}`);el.onclick=()=>selectTarget(meteor);el.onkeydown=e=>{if(e.key==='Enter'){e.stopPropagation();selectTarget(meteor)}}}renderMeteor(meteor);placeMeteor(meteor,$('arena').clientWidth,$('arena').clientHeight,config().duration);game.meteors.push(meteor);spawnIn=1.6/config().speed;hints()}
function renderStatus(){$('score').textContent=game.score;$('progress-label').textContent=game.mode==='practice'?'任務進度':'剩餘時間';$('progress').textContent=game.mode==='practice'?`${game.hits} / 10`:`${Math.max(0,Math.ceil(90-game.elapsed))} 秒`;$('lives').textContent=game.mode==='practice'?'安心練習':'♥'.repeat(Math.max(0,game.lives))||'—'}
function remove(m){m.el.remove();game.meteors.splice(game.meteors.indexOf(m),1)}
function completeTarget(m){queueShot(m);game.hits++;game.combo++;game.maxCombo=Math.max(game.combo,game.maxCombo);game.score+=10+(game.combo%5===0?10:0);game.reveal=false;game.target=null;feedback(game.combo%5===0?`${game.combo} 連擊！太棒了！`:'瞄準，發射！');if(game.mode==='practice'&&game.hits>=10)endRound();renderStatus();hints()}
function wrongAnswer(target,message){game.wrong++;game.combo=0;game.reveal=true;if(target)game.weak.add(target.symbol);tone(false);feedback(message);hints()}
function input(symbol){
 if(!symbol)return;const b=keys.get(symbol);if(b){b.classList.add('pressed');setTimeout(()=>b.classList.remove('pressed'),150)}
 if(phase==='ready'){if(symbol==='ㄅ')begin();else feedback('找找「ㄅ」，在數字 1 的位置');return}
 if(phase!=='playing'||!game.meteors.length)return;
 if(game.lesson==='spelling'){
  let m=game.meteors.includes(game.target)?game.target:null;
  if(!m)m=[...game.meteors].sort((a,b)=>b.age-a.age).find(m=>m.sequence[m.progress]===symbol)||currentTarget();
  game.target=m;
  if(m.sequence[m.progress]===symbol){m.progress++;game.correct++;game.reveal=false;renderMeteor(m);if(m.progress===m.sequence.length)completeTarget(m);else{queueShot(m,false);feedback('拼對了！繼續下一個注音');hints()}}
  else wrongAnswer(m,'這個音不對，再想想看；已命中的進度會保留');
  return;
 }
 const m=game.meteors.filter(m=>m.symbol===symbol).sort((a,b)=>b.age-a.age)[0];
 if(m){game.correct++;completeTarget(m)}
 else{if(activeShot?.meteor.symbol===symbol||shots.some(s=>s.meteor.symbol===symbol))return;const target=currentTarget();wrongAnswer(target,`再找找「${target.symbol}」，下方有提示喔`)}
}

function endRound(){renderStatus();if(activeShot||shots.length){phase='ending';$('pause').disabled=false;hints()}else finish()}
function finish(){phase='result';$('pause').disabled=true;overlays('result');hints();renderStatus();const accuracy=game.correct+game.wrong?Math.round(game.correct/(game.correct+game.wrong)*100):0;$('result-title').textContent=game.mode==='practice'?'完成 10 顆隕石！':game.lives<=0?'辛苦了，太空人！':'成功守護星球！';$('result-message').textContent=game.lesson==='spelling'?'把注音拼起來，你做到了！':'每一次練習，都讓你的手指更熟悉注音。';$('stats').innerHTML=[['消除隕石',game.hits],['按鍵正確率',accuracy+'%'],['漏接隕石',game.missed],['最長連擊',game.maxCombo]].map(([label,value])=>`<div><strong>${value}</strong><small>${label}</small></div>`).join('');const bestKey='zhuyin-meteors-recall-best-'+game.lesson+'-'+game.tones+'-'+game.calm+'-'+game.speed+'-'+game.mode+'-'+[...game.pool].sort().join('');let best=game.score;try{best=Math.max(Number(localStorage.getItem(bestKey))||0,best);localStorage.setItem(bestKey,best)}catch{}$('best').textContent=`本次 ${game.score} 分 · 相同任務最高 ${best} 分`;$('review').textContent=game.weak.size?'一起再練練：'+[...game.weak].join('　'):'全部完成得很好，再接再厲！';$('retry').hidden=!game.weak.size}
function pause(){if(!['playing','ending'].includes(phase))return;game.resumePhase=phase;phase='paused';overlays('paused');$('pause').disabled=true;hints()}
function home(){resetShots();phase='setup';game=null;overlays('setup');$('meteors').replaceChildren();$('feedback').textContent='';$('pause').disabled=true;$('score').textContent='0';$('progress-label').textContent='任務進度';$('progress').textContent='0 / 10';$('lives').textContent='練習中';hints()}
function frame(now){const dt=Math.min((now-last)/1000,.08);last=now;if(phase==='playing'){game.elapsed+=dt;spawnIn-=dt;const cfg=config(),width=$('arena').clientWidth,height=$('arena').clientHeight;for(const m of [...game.meteors]){m.age=game.calm?Math.min(m.age+dt,cfg.duration*.38):m.age+dt;placeMeteor(m,width,height,cfg.duration);m.el.classList.toggle('urgent',m.age/cfg.duration>.75);if(m.age>=cfg.duration){game.missed++;game.combo=0;game.weak.add(m.symbol);game.lives--;remove(m);feedback(game.mode==='practice'?'沒關係，下一顆再試試！':'漏接了！繼續加油');hints()}}if(game.lives<=0||(game.mode!=='practice'&&game.elapsed>=90))endRound();else if(spawnIn<=0&&game.meteors.length+shots.filter(s=>s.destroy).length+(activeShot?.destroy?1:0)<cfg.count)spawn();renderStatus()}if(phase==='playing'||phase==='ending'){updateShots(dt);if(phase==='ending'&&!activeShot&&!shots.length)finish()}if(now>feedbackUntil)$('feedback').textContent='';requestAnimationFrame(frame)}
document.addEventListener('keydown',e=>{if(!['playing','ready','paused','ending'].includes(phase))return;if(e.key==='Escape'){pause();return}if(e.isComposing||e.keyCode===229){if(phase!=='paused')feedback('請切換到英文輸入模式，再按注音鍵');return}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Backspace'&&game.lesson==='spelling'){e.preventDefault();return}const symbol=MAP[e.key.toLowerCase()]||(game.lesson==='spelling'&&game.tones?TONE_KEYS[e.key]:'');if(symbol&&phase!=='paused'){e.preventDefault();input(symbol)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});window.addEventListener('blur',pause);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('range').value=['all','initial','final','custom'].includes(saved.range)?saved.range:'all';$('custom').hidden=$('range').value!=='custom';$('hints').checked=saved.hints!==false;
$('word-range').replaceChildren();
for(const [value,label]of [['all',`全部生活單字 · ${WORDS.length} 字`],...Object.entries(WORD_GROUPS).map(([id,g])=>[id,`${g.label} · ${g.entries.length} 字`])]){const option=document.createElement('option');option.value=value;option.textContent=label;$('word-range').append(option)}
$('word-range').value=saved.wordRange==='all'||WORD_GROUPS[saved.wordRange]?saved.wordRange:'all';$('calm').checked=!!saved.calm;
$('speed').value=String(SPEEDS.includes(Number(saved.speed))?Number(saved.speed):1.5);
$('range').onchange=()=>{updateSetup();$('start').innerHTML='開始任務 <span>→</span>';persist()};$('hints').onchange=persist;
document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{lesson=b.dataset.lesson;updateSetup();persist()});
for(const id of ['word-range','calm','speed'])$(id).onchange=()=>{updateSetup();persist()};
$('start').onclick=()=>prepare(pool());$('cancel-ready').onclick=home;$('pause').onclick=pause;$('resume').onclick=()=>{phase=game.resumePhase||'playing';last=performance.now();overlays(null);$('pause').disabled=false;hints()};$('quit').onclick=home;$('home').onclick=home;$('again').onclick=()=>prepare(game.pool);$('retry').onclick=()=>{const symbols=[...game.weak];setMode('practice');prepare(symbols)};

function soundLabel(){$('sound').textContent=muted?'音效：關':'音效：開';$('sound').setAttribute('aria-pressed',muted)}$('sound').onclick=()=>{muted=!muted;soundLabel();persist()};soundLabel();setMode(mode);requestAnimationFrame(frame);
