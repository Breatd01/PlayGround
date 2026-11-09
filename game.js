(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const $ = id => document.getElementById(id);
  const path = [{x:-30,y:122},{x:158,y:122},{x:158,y:278},{x:348,y:278},{x:348,y:112},{x:548,y:112},{x:548,y:438},{x:746,y:438},{x:746,y:258},{x:1030,y:258}];
  const pads = [{x:92,y:218},{x:245,y:174},{x:264,y:355},{x:421,y:203},{x:482,y:323},{x:620,y:181},{x:663,y:514},{x:831,y:362},{x:900,y:178},{x:880,y:510}];
  const towerTypes = {
    teapot:{name:'Caffeinated Teapot',short:'TEAPOT',icon:'🫖',cost:90,color:'#70e2d0',desc:'Scalding sips. Quick, precise shots.',base:{damage:15,rate:1.05,range:148},paths:[{name:'Double Espresso',desc:'More damage',cost:65},{name:'Whisk Tactics',desc:'Faster firing',cost:55}]},
    sock:{name:'Sock Puppet',short:'SOCK PUPPET',icon:'🧦',cost:125,color:'#ff86a6',desc:'A deeply judgmental long-range heckler.',base:{damage:34,rate:.58,range:180},paths:[{name:'Roast Master',desc:'Huge heckles',cost:75},{name:'Cold Shoulder',desc:'Slows targets',cost:65}]},
    shroom:{name:'Disco Mushroom',short:'DISCO SHROOM',icon:'🍄',cost:145,color:'#ffd16a',desc:'Funky spores pop in a tiny area.',base:{damage:12,rate:.72,range:130},paths:[{name:'Bigger Dancefloor',desc:'Wider splash',cost:70},{name:'Fever Spores',desc:'More damage',cost:65}]}
  };
  const waves = [8,10,12,14,16,18,20,22,25,28];
  let coins=260,lives=20,wave=0,active=false,spawnLeft=0,spawnTimer=0,spawnGap=.85,gameOver=false,paused=false,speed=1;
  let towers=[],aliens=[],shots=[],particles=[],selectedPad=-1,selectedTower=null,buildType=null,last=0,toastTimer=0,soundOn=false,audio;
  let idSeq=0;
  const stars=Array.from({length:105},(_,i)=>({x:(i*173+31)%W,y:(i*293+19)%H,r:.45+(i%4)*.35,a:.18+(i%5)*.11,tw:i*.7}));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const pathLengths=[];let totalPath=0;
  for(let i=0;i<path.length-1;i++){const len=dist(path[i],path[i+1]);pathLengths.push(len);totalPath+=len;}
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function showToast(text){const el=$('toast');el.textContent=text;el.classList.add('show');toastTimer=2.1;}
  function beep(freq=520,duration=.08){if(!soundOn)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.055,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch(e){}}
  function addTower(type,padIndex){if(coins<towerTypes[type].cost){showToast('Not enough scrap for that gadget!');return;}const p=pads[padIndex];coins-=towerTypes[type].cost;towers.push({id:++idSeq,type,x:p.x,y:p.y,levels:[0,0],cooldown:.1,angle:0});selectedTower=towers[towers.length-1];selectedPad=padIndex;buildType=null;beep(640,.12);showToast(`${towerTypes[type].name} deployed!`);updateUI();}
  function getStats(t){const base={...towerTypes[t.type].base},[a,b]=t.levels;
    if(t.type==='teapot'){base.damage+=a*11;base.rate+=b*.28;base.range+=b*10;}
    if(t.type==='sock'){base.damage+=a*23;base.slow=b>0?.48:0;base.range+=a*7;}
    if(t.type==='shroom'){base.splash=34+a*19;base.damage+=b*9;base.range+=a*9;}
    return base;}
  function upgradeCost(t,pathIndex){const l=t.levels[pathIndex];return towerTypes[t.type].paths[pathIndex].cost+ l*35;}
  function upgrade(t,pathIndex){const cost=upgradeCost(t,pathIndex);if(t.levels[pathIndex]>=3)return;if(coins<cost){showToast('Not enough scrap for that upgrade.');return;}coins-=cost;t.levels[pathIndex]++;beep(820,.13);showToast(`${towerTypes[t.type].paths[pathIndex].name} upgraded!`);updateUI();}
  function sell(t){coins+=Math.floor(towerTypes[t.type].cost*.65+t.levels.reduce((s,n)=>s+n,0)*24);towers=towers.filter(x=>x!==t);selectedTower=null;selectedPad=-1;updateUI();showToast('Gadget recycled for scrap.');}
  function setSelection(t){selectedTower=t;selectedPad=t?pads.findIndex(p=>p.x===t.x&&p.y===t.y):-1;updateUI();}
  function updateUI(){
    $('coins').textContent=coins;$('lives').textContent=lives;$('wave').textContent=`${wave} / 10`;
    $('wave-count').textContent=active?`${aliens.length+spawnLeft} INCOMING`:gameOver?'SECTOR CLOSED':wave===0?'READY':wave>=10?'CLEARED':`${wave} CLEARED`;
    document.querySelectorAll('.tower-card').forEach(el=>{el.classList.toggle('active',buildType===el.dataset.type);el.setAttribute('aria-pressed',buildType===el.dataset.type);});
    const panel=$('selection-panel');
    if(selectedTower){const t=selectedTower,def=towerTypes[t.type],stats=getStats(t);const affordable=def.paths.map((_,i)=>t.levels[i]<3&&coins>=upgradeCost(t,i));const renderKey=`${t.id}:${t.levels.join(',')}:${affordable.join(',')}`;if(panel.dataset.renderKey!==renderKey){panel.dataset.renderKey=renderKey;panel.innerHTML=`<div class="selected-head"><div class="tower-art" style="background:${def.color}22">${def.icon}</div><div><strong>${def.name}</strong><small>Range ${Math.round(stats.range)} · ${stats.damage} dmg</small></div><button class="sell-btn" id="sell-btn">↻ Recycle</button></div><div class="range-note">LEVEL ${t.levels.reduce((a,b)=>a+b,0)} · ${stats.rate.toFixed(1)} shots/sec</div><div class="path-title">CHOOSE AN UPGRADE</div><div class="upgrade-row">${def.paths.map((p,i)=>{const max=t.levels[i]>=3,cost=upgradeCost(t,i);return `<button class="upgrade-btn" data-upgrade="${i}" ${max||!affordable[i]?'disabled':''}><b>${p.name} · ${t.levels[i]}/3</b><small>${p.desc}${max?' · MAX':''}</small><em>${max?'MAX':`◉ ${cost}`}</em></button>`;}).join('')}</div>`;$('sell-btn').onclick=()=>sell(t);panel.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>upgrade(t,+b.dataset.upgrade));}
    }else{const renderKey='empty';if(panel.dataset.renderKey!==renderKey){panel.dataset.renderKey=renderKey;panel.innerHTML='<div class="empty-select"><span class="empty-icon">⌖</span><strong>Nothing selected</strong><span>Choose a gadget or tap one on the map.</span></div>';}}
    const btn=$('wave-btn'),label=btn.querySelector('b'),sub=btn.querySelector('small');
    btn.disabled=active||gameOver||paused||wave>=10;
    if(gameOver){label.textContent='Sector complete';sub.textContent='Tap play again to restart';}
    else if(active){label.textContent='Wave in progress';sub.textContent=`${spawnLeft+aliens.length} weirdos left in wave ${wave}`;}
    else if(wave>=10){label.textContent='All waves defeated!';sub.textContent='The warp gate is safe';}
    else{label.textContent=wave===0?'Send the weirdos':'Send next wave';sub.textContent=`Start wave ${wave+1} · ${waves[wave]} aliens`;}
    $('pause-btn').textContent=paused?'▶ Resume':'Ⅱ Pause';
  }
  function startWave(){if(active||wave>=10||gameOver)return;wave++;spawnLeft=waves[wave-1];spawnGap=Math.max(.48,.86-wave*.035);spawnTimer=.45;active=true;beep(440,.18);showToast(`Wave ${wave} incoming — ${spawnLeft} aliens!`);updateUI();}
  function spawnAlien(){const hp=Math.round(39+wave*14+(wave>=5?20:0));const fast=wave%4===0;aliens.push({id:++idSeq,d:0,hp,maxHp:hp,speed:(fast?65:48)+wave*2.4,slow:0,r:wave>=7&&Math.random()<.22?14:11,kind:wave>=7&&Math.random()<.22?'brute':fast?'zippy':'regular',phase:Math.random()*6.28});spawnLeft--;}
  function posAt(d){let left=d;for(let i=0;i<pathLengths.length;i++){if(left<=pathLengths[i]){const a=path[i],b=path[i+1],f=left/pathLengths[i];return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}left-=pathLengths[i];}return path[path.length-1];}
  function damageAlien(a,amount){if(!aliens.includes(a))return;a.hp-=amount;if(a.hp<=0){aliens=aliens.filter(x=>x!==a);coins+=a.kind==='brute'?16:10;for(let i=0;i<7;i++)particles.push({x:a.x,y:a.y,vx:(Math.random()-.5)*95,vy:(Math.random()-.5)*95,life:.45,color:a.kind==='brute'?'#ff8aaa':'#b4f57a'});beep(250+Math.random()*160,.055);}}
  function fire(t,target,stats){t.cooldown=1/stats.rate;t.angle=Math.atan2(target.y-t.y,target.x-t.x);shots.push({x:t.x,y:t.y,target,damage:stats.damage,splash:stats.splash||0,slow:stats.slow||0,type:t.type,speed:460,color:towerTypes[t.type].color});}
  function update(dt){if(paused||gameOver)return;const step=dt*speed;
    if(active&&spawnLeft>0){spawnTimer-=step;if(spawnTimer<=0){spawnAlien();spawnTimer=spawnGap;}}
    for(const a of aliens){a.slow=Math.max(0,a.slow-step);a.d+=a.speed*(a.slow?0.48:1)*step;const p=posAt(a.d);a.x=p.x;a.y=p.y;}
    for(const a of [...aliens])if(a.d>=totalPath){aliens=aliens.filter(x=>x!==a);lives=Math.max(0,lives-(a.kind==='brute'?3:1));for(let i=0;i<9;i++)particles.push({x:W-15,y:258,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,life:.5,color:'#ff7798'});showToast(a.kind==='brute'?'A chunky alien broke through!':'An alien slipped past!');if(lives===0){finish(false);break;}}
    for(const t of towers){t.cooldown-=step;const s=getStats(t);let target=null,best=-1;for(const a of aliens){if(dist(t,a)<=s.range&&a.d>best){best=a.d;target=a;}}if(target&&t.cooldown<=0)fire(t,target,s);}
    for(const shot of [...shots]){if(!aliens.includes(shot.target)){shots=shots.filter(s=>s!==shot);continue;}const dx=shot.target.x-shot.x,dy=shot.target.y-shot.y,d=Math.hypot(dx,dy),move=shot.speed*step;if(d<=move+shot.target.r){const x=shot.target.x,y=shot.target.y;const hit=shot.target;shots=shots.filter(s=>s!==shot);if(shot.splash){for(const a of [...aliens])if(dist(a,{x,y})<=shot.splash+ a.r){damageAlien(a,shot.damage);if(shot.type==='sock'&&shot.slow)a.slow=shot.slow;}}else{if(shot.slow)hit.slow=shot.slow;damageAlien(hit,shot.damage);}for(let i=0;i<4;i++)particles.push({x,y,vx:(Math.random()-.5)*75,vy:(Math.random()-.5)*75,life:.23,color:shot.color});}else{shot.x+=dx/d*move;shot.y+=dy/d*move;}}
    for(const p of particles){p.x+=p.vx*step;p.y+=p.vy*step;p.life-=step;}particles=particles.filter(p=>p.life>0);
    if(active&&spawnLeft===0&&aliens.length===0){active=false;const bonus=25+wave*7;coins+=bonus;showToast(wave===10?'All waves defeated! Warp gate saved!':`Wave ${wave} cleared · ${bonus} scrap bonus`);if(wave===10)finish(true);}
    if(toastTimer>0){toastTimer-=step;if(toastTimer<=0)$('toast').classList.remove('show');}
    updateUI();
  }
  function finish(win){gameOver=true;active=false;paused=false;$('modal-emoji').textContent=win?'✦':'☄';$('modal-title').textContent=win?'The galaxy is gloriously weird!':'The warp gate has fallen';$('modal-copy').textContent=win?`You stopped all 10 waves and saved the sector with ${lives} shield${lives===1?'':'s'} left. The aliens have been thoroughly out-weirded.`:`You made it to wave ${wave}. The aliens got through, but the galaxy believes in you. Try a different tower mix!`;$('modal').hidden=false;updateUI();}
  function draw(){ctx.clearRect(0,0,W,H);
    const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#142332');bg.addColorStop(.55,'#13202d');bg.addColorStop(1,'#192330');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    for(const s of stars){ctx.globalAlpha=s.a*(.78+.22*Math.sin(performance.now()/900+s.tw));ctx.fillStyle='#d5e5e8';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    ctx.strokeStyle='#6be5d015';ctx.lineWidth=1;for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    drawTrack();drawPads();for(const t of towers)drawTower(t);for(const a of aliens)drawAlien(a);for(const s of shots)drawShot(s);for(const p of particles){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2.4,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    if(paused){ctx.fillStyle='#08111bcc';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle='#d8f36a';ctx.font='bold 34px Space Grotesk';ctx.fillText('PAUSED',W/2,H/2);ctx.fillStyle='#c2ccd6';ctx.font='14px Space Grotesk';ctx.fillText('Tap Resume when you are ready',W/2,H/2+27);}
    if(buildType){ctx.fillStyle='#d8f36a';ctx.font='11px DM Mono';ctx.textAlign='center';ctx.fillText(`PICK A GLOWING PAD · ${towerTypes[buildType].name}`,W/2,24);}
    requestAnimationFrame(draw);
  }
  function drawTrack(){ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);for(let i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);ctx.strokeStyle='#314152';ctx.lineWidth=75;ctx.stroke();ctx.strokeStyle='#425365';ctx.lineWidth=3;ctx.setLineDash([9,13]);ctx.stroke();ctx.setLineDash([]);
    // Direction chevrons along each straight track segment
    for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],len=pathLengths[i],horizontal=Math.abs(a.y-b.y)<2;for(let d=38;d<len-10;d+=56){const x=a.x+(b.x-a.x)*d/len,y=a.y+(b.y-a.y)*d/len;ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));ctx.strokeStyle='#8798a64d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(1,0);ctx.lineTo(-5,5);ctx.stroke();ctx.restore();}}
    ctx.fillStyle='#ff7798';ctx.beginPath();ctx.arc(965,258,17,0,Math.PI*2);ctx.fill();ctx.fillStyle='#281827';ctx.font='bold 16px Space Grotesk';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',965,258);ctx.textBaseline='alphabetic';
    ctx.fillStyle='#9caebd';ctx.font='9px DM Mono';ctx.textAlign='left';ctx.fillText('WARP GATE',912,287);
  }
  function drawPads(){pads.forEach((p,i)=>{const taken=towers.some(t=>t.x===p.x&&t.y===p.y);ctx.beginPath();ctx.arc(p.x,p.y,22,0,Math.PI*2);ctx.fillStyle=taken?'#152331':'#8297a312';ctx.fill();ctx.strokeStyle=taken?'#75839445':(buildType?'#d8f36a':'#93a9b733');ctx.lineWidth=buildType?2:1.5;ctx.setLineDash(buildType&&!taken?[4,4]:[]);ctx.stroke();ctx.setLineDash([]);if(!taken){ctx.strokeStyle=buildType?'#d8f36a':'#a7b5c377';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-5,p.y);ctx.lineTo(p.x+5,p.y);ctx.moveTo(p.x,p.y-5);ctx.lineTo(p.x,p.y+5);ctx.stroke();if(buildType){ctx.beginPath();ctx.arc(p.x,p.y,26,0,Math.PI*2);ctx.strokeStyle='#d8f36a40';ctx.lineWidth=1;ctx.stroke();}}});}
  function drawTower(t){const def=towerTypes[t.type],stats=getStats(t),sel=t===selectedTower;if(sel){ctx.beginPath();ctx.arc(t.x,t.y,stats.range,0,Math.PI*2);ctx.fillStyle=def.color+'0b';ctx.fill();ctx.strokeStyle=def.color+'45';ctx.setLineDash([6,7]);ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);}
    ctx.save();ctx.translate(t.x,t.y);ctx.fillStyle='#09121b';ctx.beginPath();ctx.ellipse(2,7,22,17,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=def.color;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f8f2d5';ctx.lineWidth=2;ctx.stroke();
    if(t.type==='teapot'){ctx.fillStyle='#24303a';ctx.beginPath();ctx.ellipse(-1,1,7,8,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(1,-8,3,Math.PI,0);ctx.strokeStyle='#24303a';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(8,1,5,-1,1);ctx.stroke();ctx.beginPath();ctx.moveTo(-7,1);ctx.lineTo(-12,-2);ctx.lineTo(-7,-3);ctx.fill();ctx.fillStyle='#24303a';ctx.beginPath();ctx.arc(0,1,1,0,Math.PI*2);ctx.fill();}
    if(t.type==='sock'){ctx.fillStyle='#3b2834';ctx.beginPath();ctx.ellipse(0,2,9,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff1d8';ctx.beginPath();ctx.arc(-3,-4,2.5,0,Math.PI*2);ctx.arc(4,-4,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#31303c';ctx.beginPath();ctx.arc(-3,-4,1,0,Math.PI*2);ctx.arc(4,-4,1,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#3b2834';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-5,5);ctx.quadraticCurveTo(1,9,7,4);ctx.stroke();}
    if(t.type==='shroom'){ctx.fillStyle='#403326';ctx.beginPath();ctx.ellipse(0,5,5,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff0c8';ctx.beginPath();ctx.ellipse(0,-2,12,8,0,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#bd5147';ctx.beginPath();ctx.ellipse(0,-2,12,8,0,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#fff0c8';for(const [x,y] of [[-5,-6],[2,-8],[6,-4]]){ctx.beginPath();ctx.arc(x,y,1.4,0,Math.PI*2);ctx.fill();}}
    ctx.restore();if(t.levels.reduce((a,b)=>a+b,0)>0){ctx.fillStyle='#d8f36a';ctx.beginPath();ctx.arc(t.x+14,t.y-14,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1b2832';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 9px DM Mono';ctx.fillText(t.levels.reduce((a,b)=>a+b,0),t.x+14,t.y-14);ctx.textBaseline='alphabetic';}}
  function drawAlien(a){ctx.save();ctx.translate(a.x,a.y+Math.sin(performance.now()/120+a.phase)*2);const r=a.r;ctx.fillStyle=a.kind==='brute'?'#bc82f0':a.kind==='zippy'?'#8ce9e0':'#a9ee83';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;ctx.beginPath();ctx.ellipse(0,0,r,r*.82,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#26323d';ctx.beginPath();ctx.ellipse(-r*.34,-1,r*.2,r*.27,-.15,0,Math.PI*2);ctx.ellipse(r*.34,-1,r*.2,r*.27,.15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff2d6';ctx.beginPath();ctx.arc(-r*.33,-2,1.2,0,Math.PI*2);ctx.arc(r*.35,-2,1.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#435546';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-r*.4,-r*.55);ctx.lineTo(-r*.75,-r*1.1);ctx.moveTo(r*.4,-r*.55);ctx.lineTo(r*.75,-r*1.1);ctx.stroke();ctx.fillStyle='#f6d5f4';ctx.beginPath();ctx.arc(-r*.75,-r*1.1,2,0,Math.PI*2);ctx.arc(r*.75,-r*1.1,2,0,Math.PI*2);ctx.fill();ctx.restore();
    const bw=a.kind==='brute'?34:28;ctx.fillStyle='#101922';ctx.fillRect(a.x-bw/2,a.y-r-11,bw,3);ctx.fillStyle=a.hp/a.maxHp>.5?'#b8f16d':'#ff829a';ctx.fillRect(a.x-bw/2,a.y-r-11,bw*clamp(a.hp/a.maxHp,0,1),3);}
  function drawShot(s){ctx.fillStyle=s.color;ctx.shadowColor=s.color;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(s.x,s.y,s.type==='shroom'?5:3.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;if(s.type==='shroom'){ctx.strokeStyle=s.color+'75';ctx.lineWidth=1;ctx.beginPath();ctx.arc(s.x,s.y,7,0,Math.PI*2);ctx.stroke();}}
  function getPoint(e){const rect=canvas.getBoundingClientRect();const scale=Math.min(rect.width/W,rect.height/H);const ox=rect.left+(rect.width-W*scale)/2,oy=rect.top+(rect.height-H*scale)/2;return{x:(e.clientX-ox)/scale,y:(e.clientY-oy)/scale};}
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();const p=getPoint(e);if(p.x<0||p.y<0||p.x>W||p.y>H)return;
    const hit=[...towers].reverse().find(t=>dist(t,p)<23);if(hit){buildType=null;setSelection(hit);return;}
    const padIndex=pads.findIndex((pad,i)=>!towers.some(t=>t.x===pad.x&&t.y===pad.y)&&dist(p,pad)<30);
    if(padIndex>=0){if(buildType)addTower(buildType,padIndex);else{selectedTower=null;selectedPad=padIndex;showToast('Pick a gadget, then tap here to deploy it.');updateUI();}return;}
    if(buildType){showToast('Tap one of the glowing pads to place it.');return;}selectedTower=null;selectedPad=-1;updateUI();
  });
  document.getElementById('tower-list').innerHTML=Object.entries(towerTypes).map(([type,t])=>`<button class="tower-card" data-type="${type}" aria-pressed="false"><span class="tower-art">${t.icon}</span><span class="tower-info"><b>${t.name}</b><small>${t.desc}</small></span><span class="tower-cost">◉ ${t.cost}</span></button>`).join('');
  document.querySelectorAll('.tower-card').forEach(b=>b.onclick=()=>{const type=b.dataset.type;if(coins<towerTypes[type].cost){showToast('Not enough scrap for that gadget!');return;}if(!selectedTower&&selectedPad>=0){addTower(type,selectedPad);return;}buildType=buildType===type?null:type;selectedTower=null;selectedPad=-1;updateUI();if(buildType)showToast(`Tap a glowing pad to place ${towerTypes[type].name}.`);});
  $('wave-btn').onclick=startWave;$('cancel-btn').onclick=()=>{buildType=null;selectedPad=-1;updateUI();};$('pause-btn').onclick=()=>{if(gameOver)return;paused=!paused;updateUI();};$('speed-btn').onclick=()=>{speed=speed===1?1.5:speed===1.5?2:1;$('speed-btn').textContent=`${speed}×`;};$('sound-btn').onclick=()=>{soundOn=!soundOn;$('sound-btn').textContent=soundOn?'♫':'♪';$('sound-btn').title=soundOn?'Sound on':'Sound off';beep(660,.1);};$('restart-btn').onclick=()=>location.reload();
  function frame(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;update(dt);requestAnimationFrame(frame);}updateUI();requestAnimationFrame(frame);requestAnimationFrame(draw);
})();
