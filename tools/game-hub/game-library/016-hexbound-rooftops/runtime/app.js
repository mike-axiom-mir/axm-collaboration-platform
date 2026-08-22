(function () {
  'use strict';

  const DATA = window.HEXBOUND_DATA;
  const SYS = window.HEXBOUND_SYSTEMS;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const canvas = $('#battlefield');
  const ctx = canvas.getContext('2d');
  const depthCanvas = $('#rooftop-depth');
  const minimap = $('#minimap');
  const mctx = minimap.getContext('2d');
  const ui = {
    title: $('#title-screen'), warRoom: $('#war-room'), hud: $('#hud'), modal: $('#modal'),
    factionList: $('#faction-list'), mapSelect: $('#map-select'), enemySelect: $('#enemy-select'),
    difficulty: $('#difficulty-select'), mapBrief: $('#map-brief'), trait: $('#selected-trait'),
    commandCards: $('#command-cards'), eventFeed: $('#event-feed'), selectionBox: $('#selection-box'),
    placementTip: $('#placement-tip'), glow: $('#glow-value'), scrap: $('#scrap-value'),
    essence: $('#essence-value'), glowRate: $('#glow-rate'), scrapRate: $('#scrap-rate'),
    population: $('#population-value'), clock: $('#war-clock'), enemyClockHp: $('#enemy-clock-hp'),
    mapName: $('#map-name'), selectionIcon: $('#selection-icon'), selectionName: $('#selection-name'),
    selectionKicker: $('#selection-kicker'), selectionDetail: $('#selection-detail'),
    selectionHealth: $('#selection-health'), stance: $('#stance-label'), autoScout: $('#auto-scout'),
    coopLink: $('#coop-link'), coopStatus: $('#coop-status'), objectiveCopy: $('#objective-copy'), hazardPanel: $('#map-mechanic'),
    hazardIcon: $('#mechanic-icon'), hazardTitle: $('#mechanic-title'), hazardPhase: $('#mechanic-phase'),
    hazardCopy: $('#mechanic-copy'), hazardBar: $('#mechanic-progress'), rivalPanel: $('#rival-scheme'),
    rivalIcon: $('#rival-scheme-icon'), rivalKicker: $('#rival-scheme-kicker'), rivalPhase: $('#rival-scheme-phase'),
    rivalTitle: $('#rival-scheme-title'), rivalCopy: $('#rival-scheme-copy'), rivalTarget: $('#rival-scheme-target')
  };

  const state = {
    phase: 'title', mode: 'skirmish', factionId: DATA.FACTIONS[0].id, enemyFactionId: DATA.FACTIONS[1].id,
    mapId: DATA.MAPS[0].id, difficulty: 'serious', camera: { x: 420, y: 800, zoom: .78 },
    resources: { glow: 260, scrap: 215, essence: 60 }, elapsed: 0, lastTime: 0,
    squads: [], buildings: [], anchors: [], links: [], particles: [], queue: [], selected: new Set(),
    hovered: null, placement: null, drag: null, autoScout: true, scoutTimer: 0,
    allyTimer: 0, income: { glow: 0, scrap: 0, cap: DATA.WORLD.cap }, explored: {}, visible: {}, rivalExplored: {}, rivalVisible: {}, censusReveals: [],
    currentTab: 'recruit', idCounter: 1, gameOver: false, paused: false, shake: 0,
    audio: null, enemyFaction: null, playerFaction: null, map: null, rng: Math.random,
    lastUi: 0, lastMinimap: 0, stance: 'PROBE', cooldowns: {}, keys: {}, cursor: { x: innerWidth / 2, y: innerHeight / 2 },
    relay: { after:0, pollClock:0, publishClock:0, inFlight:false, publishInFlight:false, connected:false },
    hazard: { current:null, lastPulse:-1, lastPhase:'calm', hotAnchors:[] }, charterId:'pumpkin-market', doctrineId:null, enemyDoctrineId:null, allyDoctrineId:null,
    rallyAnchorId:null, tacticalSignal:null, matchId:'',
    rival:{ schemeId:'roof-grab', phase:'idle', countdown:0, cycle:-1, targetId:null, targetAnchorId:null, stagingAnchorId:null, targetLabel:'Unknown roof', stagedIds:[] }
  };
  const depthReducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const depthRenderer = window.HexboundDepth && depthCanvas
    ? window.HexboundDepth.create({ canvas: depthCanvas, host: $('#game-shell'), reducedMotion: depthReducedMotion })
    : null;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = true;
  }

  function initSetup() {
    DATA.FACTIONS.forEach((faction, index) => {
      const card = document.createElement('button');
      card.className = 'faction-card' + (index === 0 ? ' active' : '');
      card.dataset.faction = faction.id; card.dataset.number = String(index + 1).padStart(2, '0');
      card.style.setProperty('--card-color', faction.color);
      card.innerHTML = `<span class="faction-sigil">${faction.sigil}</span><span><h3>${faction.name}</h3><p>${faction.epithet}</p><strong>${faction.trait}</strong></span>`;
      card.addEventListener('click', () => chooseFaction(faction.id)); ui.factionList.appendChild(card);
    });
    DATA.MAPS.forEach(map => ui.mapSelect.add(new Option(map.name, map.id)));
    DATA.FACTIONS.forEach(faction => ui.enemySelect.add(new Option(faction.name, faction.id)));
    ui.enemySelect.value = DATA.FACTIONS[1].id;
    updateSetup();
  }

  function chooseFaction(id) {
    state.factionId = id;
    $$('.faction-card').forEach(card => card.classList.toggle('active', card.dataset.faction === id));
    updateSetup(); sound('tick');
  }

  function updateSetup() {
    state.mapId = ui.mapSelect.value || state.mapId;
    state.enemyFactionId = ui.enemySelect.value || state.enemyFactionId;
    state.difficulty = ui.difficulty.value;
    const faction = SYS.faction(state.factionId); const map = DATA.MAPS.find(item => item.id === state.mapId);
    document.documentElement.style.setProperty('--faction', faction.color);
    const doctrines=SYS.doctrinesForFaction(faction.id);
    ui.trait.innerHTML = `<b>${faction.sigil} ${faction.trait}</b><small>“${faction.quote}”</small><p>${faction.detail}</p><div class="doctrine-preview">${doctrines.map(item=>`<span><i>${item.icon}</i><strong>${item.name}</strong><em>${item.detail}</em></span>`).join('')}</div>`;
    const topology=map.topology,lines=topology.links.map(pair=>{const a=topology.anchors[pair[0]],b=topology.anchors[pair[1]];return `<line x1="${a[0]/10}" y1="${a[1]/10}" x2="${b[0]/10}" y2="${b[1]/10}"/>`;}).join(''),nodes=topology.anchors.map((anchor,index)=>`<circle cx="${anchor[0]/10}" cy="${anchor[1]/10}" r="${index===7||index===12?3.2:1.9}"/>`).join('');
    ui.mapBrief.innerHTML = `<b>${map.kicker}</b><span class="topology-preview"><svg viewBox="0 0 240 150" aria-label="${topology.name} strategic topology"><g>${lines}</g><g>${nodes}</g></svg><em><strong>${topology.name}</strong>${topology.anchors.length} named roofs · ${topology.links.length} bridges<br>${topology.strategy}</em></span><span class="map-rule"><i>${map.mechanic.icon}</i><strong>${map.mechanic.title}</strong>${map.mechanic.effect}</span><small>${map.mechanic.counterplay}</small>`;
  }

  function makeAnchors(map) {
    const random = SYS.seeded(map.seed),topology=map.topology;
    return topology.anchors.map((position, index) => ({
      id: 'a' + index, name:position[2], x: position[0], y: position[1],
      radius: position[3]||92 + random() * 25, occupied: null, sparkle: random() * 6.28
    }));
  }

  function newId(prefix) { return prefix + state.idCounter++; }

  function doctrineForTeam(team, factionId) {
    if(team===0)return SYS.activeDoctrine(factionId,state.doctrineId);
    if(team===1)return SYS.activeDoctrine(factionId,state.allyDoctrineId);
    return SYS.activeDoctrine(factionId,state.enemyDoctrineId);
  }

  function addBuilding(team, kind, x, y, anchor, factionId, progress, charterId) {
    const spec = kind === 'command' ? { hp: 1700 } : SYS.buildingSpec(kind,factionId);
    const branch=doctrineForTeam(team,factionId),maxHp=spec.hp*(kind==='command'?1:SYS.buildingHpMultiplier(kind,factionId,branch&&branch.id));
    const districtCharter=kind==='command'?null:SYS.charter(charterId);
    const conversion=kind==='command'||kind==='wonderwork'?null:SYS.districtConversionFor(factionId,kind);
    const item = { id: newId('b'), team, kind, x, y, anchorId: anchor ? anchor.id : null, factionId,
      doctrineId:branch&&branch.id||null, hp: maxHp, maxHp, progress: progress == null ? 1 : progress, pulse: Math.random() * 6.28,
      charterId:districtCharter?districtCharter.id:null, musterClock:districtCharter&&districtCharter.muster?districtCharter.muster:0,
      wonderClock:kind==='wonderwork'&&spec.effect&&spec.effect.period?spec.effect.period:0,
      conversionClock:conversion&&conversion.effect&&conversion.effect.period?conversion.effect.period:0, conversionPulseUntil:0, conversionTargets:[], conversionPath:[] };
    state.buildings.push(item); if (anchor) anchor.occupied = item.id; return item;
  }

  function addSquad(team, unitId, x, y, factionId, extras) {
    const branch=doctrineForTeam(team,factionId),extraMembers=Number(extras&&extras.extraMembers||0),spec = SYS.squadSpec(unitId, factionId, extras,branch&&branch.id);
    const item = Object.assign({ id: newId('s'), team, unitId, factionId, x, y, tx: x, ty: y,
      hp: spec.maxHp, attackClock: Math.random() * .6, targetEntity: null, selected: false,
      order: team === 0 ? 'ready' : 'march', facing: 0, wobble: Math.random() * 6, ghost: false, reassembled:false, deadlineHaste:0,
      unionShiftUntil:0, unionShiftMoveMultiplier:1, unionShiftAttackRecoveryMultiplier:1,
      temporalAdjournedUntil:0, temporalAdjournmentSourceId:null,
      doctrineId:branch&&branch.id||null,extraMembers,route:[], routeCost:0, routeGoal:null, routeTargetId:null, rerouteClock:0 }, spec);
    state.squads.push(item); return item;
  }

  function resetBattle() {
    state.playerFaction = SYS.faction(state.factionId); state.enemyFaction = SYS.faction(state.enemyFactionId);
    state.map = DATA.MAPS.find(item => item.id === state.mapId); state.rng = SYS.seeded(state.map.seed + 99);
    state.resources = { glow: 260, scrap: 215, essence: 60 }; state.elapsed = 0; state.lastTime = performance.now();
    state.squads = []; state.buildings = []; state.particles = []; state.queue = []; state.selected = new Set();
    state.anchors = makeAnchors(state.map); state.links=state.map.topology.links.map(pair=>pair.slice()); state.explored = {}; state.visible = {}; state.rivalExplored = {}; state.rivalVisible = {}; state.censusReveals = []; state.idCounter = 1;
    state.gameOver = false; state.paused = false; state.placement = null; state.allyTimer = 13;state.enemyEssence=0;
    const enemyDoctrine=SYS.doctrineForBattle(state.enemyFactionId,state.map.seed,state.difficulty),allyDoctrine=SYS.doctrineForBattle('lantern-republic',state.map.seed,'story');
    state.scoutTimer = 0; state.cooldowns = {}; state.stance = 'PROBE'; state.charterId='pumpkin-market';state.doctrineId=null;state.enemyDoctrineId=enemyDoctrine.id;state.allyDoctrineId=allyDoctrine.id; state.rallyAnchorId=null; state.tacticalSignal=null; state.matchId='m'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1679616).toString(36); state.camera = { x: 430, y: 820, zoom: .78 };
    state.hazard = { current:SYS.mapMechanicState(state.map.id,0), lastPulse:-1, lastPhase:'calm', hotAnchors:[] };
    state.rival = { schemeId:'roof-grab', phase:'idle', countdown:0, cycle:-1, targetId:null, targetAnchorId:null, stagingAnchorId:null, targetLabel:'Unknown roof', stagedIds:[] };
    state.cursor = { x: innerWidth / 2, y: innerHeight / 2 };
    state.relay = { after:0, pollClock:0, publishClock:0, inFlight:false, publishInFlight:false, connected:false };
    ui.placementTip.classList.add('hidden');
    ui.objectiveCopy.textContent = 'Master '+state.map.topology.name+', exploit '+state.map.mechanic.title+', and break the rival clock.';
    ui.coopLink.classList.toggle('hidden', state.mode !== 'coop'); ui.coopLink.classList.remove('online'); ui.coopStatus.textContent = 'WAITING';

    addBuilding(0, 'command', 260, 760, null, state.factionId, 1);
    addBuilding(2, 'command', 2160, 740, null, state.enemyFactionId, 1);
    addBuilding(0, 'borough', state.anchors[7].x, state.anchors[7].y, state.anchors[7], state.factionId, 1, state.charterId);
    addBuilding(2, 'borough', state.anchors[12].x, state.anchors[12].y, state.anchors[12], state.enemyFactionId, 1, 'junk-jamboree');
    addSquad(0, 'mobs', 365, 720, state.factionId); addSquad(0, 'hexbows', 370, 785, state.factionId); addSquad(0, 'brooms', 420, 850, state.factionId);
    addSquad(0, SYS.signatureForFaction(state.factionId).id, 455, 925, state.factionId);
    addSquad(2, 'mobs', 2050, 680, state.enemyFactionId); addSquad(2, 'mobs', 2040, 760, state.enemyFactionId);
    addSquad(2, 'hexbows', 2070, 830, state.enemyFactionId); addSquad(2, 'brooms', 1980, 895, state.enemyFactionId);
    addSquad(2, SYS.signatureForFaction(state.enemyFactionId).id, 1995, 970, state.enemyFactionId);
    if (state.mode === 'coop') {
      addBuilding(1, 'command', 300, 1130, null, 'lantern-republic', 1);
      addSquad(1, 'mobs', 405, 1080, 'lantern-republic'); addSquad(1, 'hexbows', 420, 1160, 'lantern-republic'); addSquad(1, 'pocket-paladins', 485, 1215, 'lantern-republic');
    }
    state.currentTab='council';$$('.rack-tabs button').forEach(button=>button.classList.toggle('active',button.dataset.tab==='council'));
    updateExploration(); planRivalScheme(true);
    renderCards(); updateHud(true); feed('The Grand Clock tolls. '+state.map.name+' is open.', DATA.COLORS.orange);
    feed(state.map.mechanic.title+': '+state.map.mechanic.counterplay, state.map.mechanic.color);
    feed('The Grand Council awaits one permanent doctrine. Choose 9 or 0.', state.playerFaction.color);
    feed(state.mode === 'coop' ? 'Tin Lantern ally reporting. Human Quartermaster link is open.' : 'Skirmish rules. One rival. No siege.', DATA.COLORS.mint);
  }

  function startBattle() {
    updateSetup(); state.phase = 'battle'; ui.warRoom.classList.add('hidden'); ui.hud.classList.remove('hidden');
    resetBattle(); sound('start'); requestAnimationFrame(frame);
  }

  function screenToWorld(clientX, clientY) {
    return { x: (clientX - innerWidth / 2) / state.camera.zoom + state.camera.x,
      y: (clientY - innerHeight / 2) / state.camera.zoom + state.camera.y };
  }
  function worldToScreen(x, y) { return { x: (x - state.camera.x) * state.camera.zoom + innerWidth / 2, y: (y - state.camera.y) * state.camera.zoom + innerHeight / 2 }; }

  function isEnemy(a, b) { return (a === 2) !== (b === 2); }
  function routeSquad(squad, x, y) {
    const goal={x:SYS.clamp(x,45,DATA.WORLD.width-45),y:SYS.clamp(y,45,DATA.WORLD.height-45)};
    const route=SYS.bridgeRoute(state.anchors,state.links,squad,goal,{mapId:state.map&&state.map.id,mechanicState:state.hazard&&state.hazard.current,hotAnchorIds:(state.hazard&&state.hazard.hotAnchors||[]).map(anchor=>anchor.id)});
    squad.tx=goal.x;squad.ty=goal.y;squad.routeGoal=goal;squad.routeCost=route.cost;squad.route=[];
    if(route.connected&&!route.direct){
      squad.route=route.indices.map(index=>state.anchors[index]).filter((anchor,index)=>index>0||SYS.distance(squad,anchor)>Math.max(70,anchor.radius*.72)).map(anchor=>({x:anchor.x,y:anchor.y,anchorId:anchor.id}));
      const last=squad.route[squad.route.length-1];if(last&&SYS.distance(last,goal)<55)squad.route.pop();
    }
    return route;
  }
  function orderSquad(squad, x, y, order, target) {
    const nextOrder=order||'move',meaningful=Math.hypot((squad.tx||squad.x)-x,(squad.ty||squad.y)-y)>40;
    if(SYS.unit(squad.unitId).passive==='deadline-dash'&&['move','raid','march','scout'].includes(nextOrder)&&meaningful)squad.deadlineHaste=3;
    routeSquad(squad,x,y);squad.order=nextOrder;squad.targetEntity=target||null;squad.routeTargetId=target||null;squad.rerouteClock=.65;
  }

  function population() { return state.squads.filter(s => s.team === 0 && s.hp > 0).reduce((sum, squad) => sum + squad.members, 0); }
  function canPay(cost) { return state.resources.glow >= (cost.glow || 0) && state.resources.scrap >= (cost.scrap || 0) && state.resources.essence >= (cost.essence || 0); }
  function pay(cost) { state.resources.glow -= cost.glow || 0; state.resources.scrap -= cost.scrap || 0; state.resources.essence -= cost.essence || 0; }

  function train(unitId) {
    const cost = SYS.trainingCost(unitId, state.factionId,state.doctrineId,state.buildings);
    const unit = SYS.unit(unitId),presentation=SYS.doctrineUnitPresentation(unitId,state.factionId,state.doctrineId),expected = SYS.squadSpec(unitId,state.factionId,null,state.doctrineId).members;
    if (unit.signatureOf && unit.signatureOf !== state.factionId) return feed('That signature regiment serves another extremely specific cause.', DATA.COLORS.danger);
    if (population() + expected > state.income.cap) return feed('Crowd cap reached. Raise another Crooked Borough.', DATA.COLORS.danger);
    if (!canPay(cost)) return feed('Not enough Glow or Scrap for that squad.', DATA.COLORS.danger);
    pay(cost); state.queue.push({ id: newId('q'), unitId, remaining: cost.seconds, total: cost.seconds });
    feed(presentation.name + ' assembling — quickly.', presentation.color||unit.color); sound('train'); renderCards();
  }

  function finishTraining(item) {
    const unit=SYS.unit(item.unitId),presentation=SYS.doctrineUnitPresentation(item.unitId,state.factionId,state.doctrineId),enemyClock=state.buildings.find(building=>building.team===2&&building.kind==='command');
    let rally = SYS.nearest({ x: 0, y: 0 }, state.buildings, building => building.team === 0 && building.progress >= 1 && (building.kind === 'moot' || building.kind === 'command')) || state.buildings[0];
    if(unit.passive==='forward-muster'&&enemyClock)rally=SYS.nearest(enemyClock,state.buildings,building=>building.team===0&&building.progress>=1&&building.hp>0)||rally;
    const squad = addSquad(0, item.unitId, rally.x + 85 + state.rng() * 45, rally.y + (state.rng() - .5) * 100, state.factionId);
    adoptCurrentPlan(squad);
    feed(presentation.name+' ready. '+SYS.trainingQuote(item.unitId), presentation.color||unit.color); sound('ready');
  }

  function adoptCurrentPlan(squad) {
    if(!squad||squad.team!==0)return;
    const rally=state.rallyAnchorId&&state.anchors.find(anchor=>anchor.id===state.rallyAnchorId);if(rally){orderSquad(squad,rally.x+(state.idCounter%4-1.5)*34,rally.y+50+(state.idCounter%3)*28,'guard');return;}
    if(state.stance==='GUARD'){const home=state.buildings.find(building=>building.team===0&&building.kind==='command');if(home)orderSquad(squad,home.x+110,home.y-90,'guard');}
    if(state.stance==='RAID'){const target=SYS.nearest(squad,state.buildings,building=>building.team===2&&building.hp>0);if(target)orderSquad(squad,target.x,target.y,'raid',target.id);}
    if(state.stance==='GRAND MARCH'){const target=state.buildings.find(building=>building.team===2&&building.kind==='command');if(target)orderSquad(squad,target.x,target.y,'march',target.id);}
  }

  function setDistrictCharter(charterId, who) {
    const spec=SYS.charter(charterId);if(!spec)return false;
    state.charterId=spec.id;feed((who?who+' filed ':'New district plan: ')+spec.name+'. Future roofs inherit it.',spec.color);renderCards();sound('order');return true;
  }

  function chooseDoctrine(doctrineId, who) {
    const spec=SYS.activeDoctrine(state.factionId,doctrineId);if(!spec)return false;
    if(state.doctrineId&&state.doctrineId!==spec.id){feed('The Grand Council already made one permanent mistake: '+SYS.doctrine(state.doctrineId).name+'.',DATA.COLORS.danger);return false;}
    if(state.doctrineId===spec.id)return true;
    state.doctrineId=spec.id;refreshPlayerDoctrine();renderCards();state.relay.publishClock=0;
    feed((who?who+' ratified ':'Doctrine ratified: ')+spec.name+'. '+spec.detail,spec.color);sound('order');return true;
  }

  function refreshPlayerDoctrine() {
    for(const squad of state.squads.filter(item=>item.team===0&&item.hp>0)){
      const ratio=squad.maxHp?squad.hp/squad.maxHp:1,spec=SYS.squadSpec(squad.unitId,squad.factionId,{extraMembers:squad.extraMembers||0},state.doctrineId);
      Object.assign(squad,spec,{doctrineId:state.doctrineId});squad.hp=Math.max(.01,Math.min(squad.maxHp,squad.maxHp*ratio));squad.members=Math.max(1,Math.min(squad.maxMembers,Math.ceil(squad.hp/squad.memberHp)));
    }
    for(const building of state.buildings.filter(item=>item.team===0&&item.kind!=='command'&&item.hp>0)){
      const ratio=building.maxHp?building.hp/building.maxHp:1,base=SYS.buildingSpec(building.kind,building.factionId),maxHp=base.hp*SYS.buildingHpMultiplier(building.kind,building.factionId,state.doctrineId);
      building.doctrineId=state.doctrineId;building.maxHp=maxHp;building.hp=Math.max(.01,Math.min(maxHp,maxHp*ratio));
    }
    updateSelectionPanel();
  }

  function beginPlacement(kind) {
    if(kind==='wonderwork'){
      const spec=SYS.wonderworkForFaction(state.factionId),count=SYS.wonderworkCount(state.buildings,0,state.factionId);
      if(count>=spec.max)return feed('Wonderwork limit reached. Two impossible civic landmarks are enough paperwork.',DATA.COLORS.danger);
    }
    const cost = SYS.claimCost(kind, state.factionId,state.doctrineId);
    if (!canPay(cost)) return feed('That borough plan needs more Glow or Scrap.', DATA.COLORS.danger);
    const charter=SYS.charter(state.charterId);state.placement = { type: 'building', kind, cost, charterId:charter.id }; ui.placementTip.classList.remove('hidden');
    ui.placementTip.textContent = 'Choose a glowing rooftop anchor · '+charter.name+' will inherit it'; renderCards(); sound('tick');
  }

  function placeBuilding(world) {
    const anchor = SYS.nearest(world, state.anchors, item => !item.occupied && SYS.distance(world, item) < item.radius * 1.1);
    if (!anchor) return feed('Buildings need one of the glowing rooftop anchors.', DATA.COLORS.danger);
    if (!SYS.exploredAt(state.explored, anchor.x, anchor.y, 80)) return feed('That rooftop is still hidden. Scout it first.', DATA.COLORS.danger);
    if (!canPay(state.placement.cost)) return cancelPlacement();
    pay(state.placement.cost); const building = addBuilding(0, state.placement.kind, anchor.x, anchor.y, anchor, state.factionId, .02, state.placement.charterId);
    building.buildSeconds = state.placement.cost.seconds; building.buildRemaining = state.placement.cost.seconds;
    feed(SYS.buildingSpec(building.kind,building.factionId).name + ' unfolding under the '+SYS.charter(building.charterId).name+'.', SYS.charter(building.charterId).color);
    cancelPlacement(); sound('build');
  }

  function usePower(powerId) {
    const cost = SYS.summonCost(powerId, state.factionId,state.doctrineId); const power = DATA.POWERS.find(item => item.id === powerId);
    if ((state.cooldowns[powerId] || 0) > 0) return feed(power.name + ' is still gathering drama.', DATA.COLORS.violet);
    if (state.resources.essence < cost) return feed('Not enough Essence. A battle will fix that.', DATA.COLORS.danger);
    if (powerId === 'pirates') {
      state.placement = { type: 'power', kind: powerId, cost: { essence: cost } }; ui.placementTip.classList.remove('hidden');
      ui.placementTip.textContent = 'Open a pirate rift anywhere you have explored'; renderCards(); return sound('power');
    }
    if (powerId === 'reinforce') {
      const selected = selectedSquads(); if (!selected.length) return feed('Select at least one battered squad first.', DATA.COLORS.danger);
      pay({ essence: cost }); selected.forEach(squad => { const before = squad.members; squad.hp = squad.maxHp; squad.members = squad.maxMembers; burst(squad.x,squad.y,DATA.COLORS.mint,18); if (squad.members > before) floatText(squad.x,squad.y,'+'+(squad.members-before),DATA.COLORS.mint); });
      setCooldown(powerId, power.cooldown); feed('Second Wind returned the missing cast members.', DATA.COLORS.mint); sound('heal');
    }
    if (powerId === 'parade') {
      pay({ essence: cost }); const target = state.buildings.find(building => building.team === 2 && building.kind === 'command');
      for (let i = 0; i < 6; i++) { const squad = addSquad(0, i % 3 === 0 ? 'hexbows' : 'mobs', 520 + i * 35, 590 + (i % 2) * 160, state.factionId, { extraMembers: 1 }); squad.ghost = true; orderSquad(squad,target.x,target.y,'parade',target.id); }
      setCooldown(powerId, power.cooldown); feed('THE GRAND PHANTOM PARADE has no indoor voice.', DATA.COLORS.violet); sound('power'); state.shake = 9;
    }
  }

  function placePower(world) {
    if (!SYS.exploredAt(state.explored, world.x, world.y, 80)) return feed('Ghost pirates refuse to materialise somewhere unscouted.', DATA.COLORS.danger);
    if (!canPay(state.placement.cost)) return cancelPlacement();
    deployPirateCrews(world, state.placement.cost, 'Ghost pirates hired on-site. Receipts unavailable.'); cancelPlacement();
  }

  function deployPirateCrews(world, cost, message) {
    pay(cost); const crewCount = state.factionId === 'moonwake-corsairs' ? 4 : 3,crews=[];
    for (let i = 0; i < crewCount; i++) { const angle = i / crewCount * Math.PI * 2; const squad = addSquad(0, i === 1 ? 'hexbows' : 'mobs', world.x + Math.cos(angle)*54, world.y + Math.sin(angle)*54,state.factionId,{extraMembers:1}); squad.ghost = true; crews.push(squad); }
    burst(world.x,world.y,DATA.COLORS.violet,36); setCooldown('pirates', DATA.POWERS[0].cooldown); feed(message, DATA.COLORS.violet); sound('power');
    return crews;
  }

  function setCooldown(id, seconds) { const works=SYS.wonderworkEmpireEffects(state.buildings,0,state.factionId);state.cooldowns[id] = SYS.doctrinePowerCooldown(id,seconds,state.factionId,state.doctrineId) * (state.playerFaction.mods.cooldown || 1) / works.cooldownSpeed; }
  function cancelPlacement() { state.placement = null; ui.placementTip.classList.add('hidden'); renderCards(); }
  function selectedSquads() { return state.squads.filter(squad => state.selected.has(squad.id) && squad.team === 0 && squad.hp > 0); }

  function applyMacro(plan) {
    const army = state.squads.filter(squad => squad.team === 0 && squad.hp > 0);
    if (!army.length) return;
    if(plan!=='army')state.rallyAnchorId=null;
    if (plan === 'army') state.selected = new Set(army.map(s => s.id));
    if (plan === 'guard') { const home = state.buildings.find(b => b.team === 0 && b.kind === 'command'); army.forEach((s,i)=>orderSquad(s,home.x+100+(i%4)*45,home.y-100+Math.floor(i/4)*55,'guard')); state.stance='GUARD'; }
    if (plan === 'raid') { const target = SYS.nearest({x:state.camera.x,y:state.camera.y},state.buildings,b=>b.team===2); army.forEach((s,i)=>orderSquad(s,target.x+(i%3)*35,target.y+Math.floor(i/3)*35,'raid',target.id)); state.stance='RAID'; }
    if (plan === 'march') { const target = state.buildings.find(b=>b.team===2&&b.kind==='command'); army.forEach((s,i)=>orderSquad(s,target.x+(i%5-2)*40,target.y+(Math.floor(i/5)-1)*40,'march',target.id)); state.stance='GRAND MARCH'; }
    ui.stance.textContent = 'Plan: ' + state.stance; updateSelectionPanel(); sound('order');
  }

  function updateCoopRelay(dt) {
    if (state.mode !== 'coop' || state.phase !== 'battle') return;
    state.relay.pollClock -= dt; state.relay.publishClock -= dt;
    if (state.relay.pollClock <= 0 && !state.relay.inFlight) { state.relay.pollClock = .55; pollQuartermaster(); }
    if (state.relay.publishClock <= 0 && !state.relay.publishInFlight) { state.relay.publishClock = .8; publishHostState(); }
  }

  async function pollQuartermaster() {
    state.relay.inFlight = true;
    try {
      const response = await fetch('/api/coop/commands?after=' + state.relay.after, { cache:'no-store' }); const packet = await response.json();
      if (!response.ok || !packet.ok) throw new Error(packet.error || 'relay unavailable');
      state.relay.connected = !!(packet.seat && packet.seat.connected); ui.coopLink.classList.toggle('online', state.relay.connected); ui.coopStatus.textContent = state.relay.connected ? 'HUMAN LINKED' : 'OPEN DECK';
      for (const command of packet.commands || []) {
        state.relay.after = Math.max(state.relay.after, command.seq); const result = applyQuartermasterCommand(command);
        fetch('/api/coop/ack', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ seq:command.seq, ok:result.ok, message:result.message }) }).catch(()=>{});
      }
    } catch (_) { ui.coopLink.classList.remove('online'); ui.coopStatus.textContent = 'LOCAL ONLY'; }
    finally { state.relay.inFlight = false; }
  }

  async function publishHostState() {
    state.relay.publishInFlight = true;
    try {
      const signature=SYS.signatureForFaction(state.factionId),signatureCost=SYS.trainingCost(signature.id,state.factionId,state.doctrineId,state.buildings),doctrineChoices=SYS.doctrinesForFaction(state.factionId),activeDoctrine=SYS.activeDoctrine(state.factionId,state.doctrineId),recruits=['mobs','hexbows','brooms','lanterns'].map(unitId=>{const unit=SYS.unit(unitId),presentation=SYS.doctrineUnitPresentation(unitId,state.factionId,state.doctrineId),cost=SYS.trainingCost(unitId,state.factionId,state.doctrineId,state.buildings),members=SYS.squadSpec(unitId,state.factionId,null,state.doctrineId).members;return{id:unitId,name:presentation.name,icon:presentation.icon,role:presentation.role.replace(/\s*·\s*\d+\s*$/,''),glow:cost.glow,scrap:cost.scrap,members,color:presentation.color||unit.color};});
      const powers=DATA.POWERS.map(power=>({id:power.id,name:power.name,essence:SYS.summonCost(power.id,state.factionId,state.doctrineId)}));
      const charter=SYS.charter(state.charterId);
      await fetch('/api/coop/host-state', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({
        phase:state.phase, matchId:state.matchId, mode:state.mode, faction:state.playerFaction.name, map:state.map.name, stance:state.stance, autoScout:state.autoScout,
        elapsed:state.elapsed, population:population(), cap:state.income.cap, resources:state.resources,
        signature:{ id:signature.id, name:signature.name, icon:signature.icon, role:signature.passiveLabel, glow:signatureCost.glow, scrap:signatureCost.scrap, color:signature.color },
        recruits,
        powers,
        doctrine:{ active:activeDoctrine&&activeDoctrine.id||'', options:doctrineChoices.map(item=>({id:item.id,name:item.name,icon:item.icon,detail:item.detail,color:item.color})) },
        charter:{ id:charter.id, name:charter.name, icon:charter.icon, detail:charter.detail, color:charter.color },
        mechanic:{ title:state.map.mechanic.title, phase:state.hazard.current.phase, nextIn:state.hazard.current.nextIn, direction:state.hazard.current.direction, color:state.map.mechanic.color, effect:state.hazard.current.active?state.map.mechanic.effect:state.map.mechanic.counterplay },
        rival:rivalSnapshot(),
        tactical:tacticalSnapshot()
      }) });
    } catch (_) {}
    finally { state.relay.publishInFlight = false; }
  }

  function tacticalSnapshot() {
    const anchors=state.anchors.map(anchor=>{
      const explored=SYS.exploredAt(state.explored,anchor.x,anchor.y,80),visible=SYS.exploredAt(state.visible,anchor.x,anchor.y,80);
      const building=anchor.occupied&&state.buildings.find(item=>item.id===anchor.occupied&&item.hp>0);
      const known=building&&(building.team!==2||explored)?building:null,owner=SYS.tacticalOwner(known,explored);
      const charter=known&&known.charterId&&SYS.charter(known.charterId);
      return{id:anchor.id,name:anchor.name,x:anchor.x/DATA.WORLD.width,y:anchor.y/DATA.WORLD.height,explored,visible,owner:explored?owner:'unknown',kind:explored&&known?known.kind:'',charterColor:explored&&charter?charter.color:''};
    });
    const forces=state.squads.filter(squad=>squad.hp>0&&(squad.team!==2||SYS.exploredAt(state.visible,squad.x,squad.y,80))).map(squad=>({team:squad.team===0?'player':squad.team===1?'ally':'enemy',x:squad.x/DATA.WORLD.width,y:squad.y/DATA.WORLD.height,members:squad.members,visible:squad.team!==2||SYS.exploredAt(state.visible,squad.x,squad.y,80)}));
    const signal=state.tacticalSignal&&state.tacticalSignal.until>state.elapsed?{target:state.tacticalSignal.anchorId,kind:state.tacticalSignal.kind,player:state.tacticalSignal.player}:null;
    const routeCounts=new Map();
    for(const squad of state.squads.filter(item=>item.team===0&&item.hp>0&&item.route&&item.route.length)){
      const start=SYS.nearestAnchorIndex(squad,state.anchors),sequence=[start>=0?state.anchors[start].id:null,...squad.route.map(point=>point.anchorId)].filter(Boolean).filter((id,index,list)=>index===0||id!==list[index-1]);
      for(let index=0;index<sequence.length-1;index+=1){const from=sequence[index],to=sequence[index+1],key=from+'>'+to;routeCounts.set(key,(routeCounts.get(key)||0)+1);}
    }
    const routes=Array.from(routeCounts,([key,count])=>{const parts=key.split('>');return{from:parts[0],to:parts[1],count};});
    return{topology:state.map.topology.name,anchors,links:state.links.map(pair=>[state.anchors[pair[0]].id,state.anchors[pair[1]].id]),forces,signal,routes};
  }

  function rivalSnapshot() {
    const scheme=SYS.rivalScheme(state.rival.schemeId);
    return { id:scheme.id, name:scheme.name, icon:scheme.icon, kicker:scheme.kicker, phase:state.rival.phase, nextIn:state.rival.countdown, target:rivalDisplayLabel(), targetAnchor:visibleRivalAnchorId(), counterplay:scheme.counterplay, color:scheme.color };
  }

  function applyQuartermasterCommand(command) {
    const who = command.player || 'Quartermaster';
    if (command.type === 'train') {
      const unitId=command.value==='signature'?SYS.signatureForFaction(state.factionId).id:command.value;
      const unit = SYS.unit(unitId), cost = SYS.trainingCost(unitId, state.factionId,state.doctrineId,state.buildings), expected = SYS.squadSpec(unitId,state.factionId,null,state.doctrineId).members;
      if (population()+expected > state.income.cap) return { ok:false, message:'Crowd cap reached' };
      if (!canPay(cost)) return { ok:false, message:'Shared economy too low' };
      train(unitId); feed(who+' ordered a '+unit.name+'.', DATA.COLORS.mint); return { ok:true, message:unit.name+' assembling' };
    }
    if (command.type === 'macro') {
      if (!state.squads.some(squad=>squad.team===0&&squad.hp>0)) return { ok:false, message:'No host squads available' };
      applyMacro(command.value); feed(who+' called '+state.stance+'.', DATA.COLORS.mint); return { ok:true, message:'Plan changed to '+state.stance };
    }
    if(command.type==='charter'){
      const charter=SYS.charter(command.value);if(!charter)return{ok:false,message:'Unknown district charter'};
      setDistrictCharter(charter.id,who);state.relay.publishClock=0;return{ok:true,message:'Future districts: '+charter.name};
    }
    if(command.type==='doctrine'){
      const doctrine=SYS.activeDoctrine(state.factionId,command.value);if(!doctrine)return{ok:false,message:'Doctrine belongs to another faction'};
      if(state.doctrineId&&state.doctrineId!==doctrine.id)return{ok:false,message:'Council already ratified '+SYS.doctrine(state.doctrineId).name};
      chooseDoctrine(doctrine.id,who);state.relay.publishClock=0;return{ok:true,message:'Doctrine ratified: '+doctrine.name};
    }
    if(command.type==='target')return quartermasterTarget(command,who);
    if (command.type === 'scout') {
      state.autoScout=!state.autoScout;ui.autoScout.classList.toggle('active',state.autoScout);feed(who+' turned auto-scout '+(state.autoScout?'on.':'off.'),DATA.COLORS.mint);return {ok:true,message:'Auto-scout '+(state.autoScout?'on':'off')};
    }
    if (command.type === 'support') return quartermasterSupport(command.value, who);
    return { ok:false, message:'Unknown command' };
  }

  function quartermasterTarget(command,who) {
    const anchor=state.anchors.find(item=>item.id===command.target);if(!anchor)return{ok:false,message:'Unknown rooftop'};
    const roof=anchor.name||'Roof '+String(state.anchors.indexOf(anchor)+1).padStart(2,'0');if(!SYS.exploredAt(state.explored,anchor.x,anchor.y,80))return{ok:false,message:roof+' is still hidden'};
    if(command.value==='rally'){
      const army=state.squads.filter(squad=>squad.team===0&&squad.hp>0);if(!army.length)return{ok:false,message:'No host squads available'};
      state.rallyAnchorId=anchor.id;army.forEach((squad,index)=>orderSquad(squad,anchor.x+(index%5-2)*42,anchor.y+55+Math.floor(index/5)*42,'guard'));
      state.stance='RALLY @ '+roof.toUpperCase();state.tacticalSignal={kind:'rally',anchorId:anchor.id,player:who,until:state.elapsed+9};ui.stance.textContent='Plan: '+state.stance;updateSelectionPanel();feed(who+' lit a rally beacon on '+roof+'.',DATA.COLORS.mint);sound('order');state.relay.publishClock=0;return{ok:true,message:'Rally beacon set at '+roof};
    }
    if(command.value==='pirates'){
      const cost=SYS.summonCost('pirates',state.factionId,state.doctrineId);if((state.cooldowns.pirates||0)>0)return{ok:false,message:'Pirate rift cooling down'};if(state.resources.essence<cost)return{ok:false,message:'Not enough Essence'};
      const crews=deployPirateCrews(anchor,{essence:cost},who+' opened a pirate rift on '+roof+'.');crews.forEach((squad,index)=>orderSquad(squad,anchor.x+(index-1)*38,anchor.y+72,'guard'));
      state.tacticalSignal={kind:'pirates',anchorId:anchor.id,player:who,until:state.elapsed+9};state.relay.publishClock=0;return{ok:true,message:'Pirates deployed at '+roof};
    }
    if(command.value==='wonderwork'){
      const spec=SYS.wonderworkForFaction(state.factionId),count=SYS.wonderworkCount(state.buildings,0,state.factionId);if(anchor.occupied)return{ok:false,message:roof+' is already occupied'};if(count>=spec.max)return{ok:false,message:'Wonderwork limit reached'};
      const cost=SYS.claimCost('wonderwork',state.factionId,state.doctrineId);if(!canPay(cost))return{ok:false,message:'Shared economy too low for '+spec.name};
      pay(cost);const work=addBuilding(0,'wonderwork',anchor.x,anchor.y,anchor,state.factionId,.02,state.charterId);work.buildSeconds=cost.seconds;work.buildRemaining=cost.seconds;
      state.tacticalSignal={kind:'wonderwork',anchorId:anchor.id,player:who,until:state.elapsed+9};feed(who+' commissioned '+spec.name+' on '+roof+'.',spec.color);sound('build');state.relay.publishClock=0;renderCards();return{ok:true,message:spec.name+' commissioned at '+roof};
    }
    return{ok:false,message:'Unknown tactical order'};
  }

  function quartermasterSupport(kind, who) {
    const cost=SYS.summonCost(kind,state.factionId,state.doctrineId);
    if ((state.cooldowns[kind]||0)>0) return {ok:false,message:'Support cooling down'};
    if (state.resources.essence<cost) return {ok:false,message:'Not enough Essence'};
    if(kind==='pirates'){
      const enemy=state.buildings.find(building=>building.team===2&&building.kind==='command');const frontline=enemy&&SYS.nearest(enemy,state.squads,squad=>squad.team===0&&squad.hp>0);
      if(!frontline)return{ok:false,message:'No frontline squad'};
      deployPirateCrews(frontline,{essence:cost},who+' opened a frontline pirate rift.');return{ok:true,message:'Pirates deployed at frontline'};
    }
    if(kind==='reinforce'){
      const damaged=state.squads.filter(squad=>squad.team===0&&squad.hp>0&&squad.hp<squad.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).slice(0,4);
      if(!damaged.length)return{ok:false,message:'No damaged squads'};
      pay({essence:cost});damaged.forEach(squad=>{squad.hp=squad.maxHp;squad.members=squad.maxMembers;burst(squad.x,squad.y,DATA.COLORS.mint,15);});setCooldown('reinforce',DATA.POWERS.find(power=>power.id==='reinforce').cooldown);feed(who+' restored '+damaged.length+' frontline squads.',DATA.COLORS.mint);sound('heal');return{ok:true,message:damaged.length+' squads restored'};
    }
    if(kind==='parade'){usePower('parade');feed(who+' signed the Phantom Parade permit.',DATA.COLORS.violet);return{ok:true,message:'Phantom Parade launched'};}
    return{ok:false,message:'Unknown support order'};
  }

  function renderCards() {
    if (state.phase !== 'battle') return;
    ui.commandCards.innerHTML = ''; ui.commandCards.classList.toggle('five',state.currentTab==='recruit'||state.currentTab==='expand');ui.commandCards.classList.toggle('council',state.currentTab==='council');
    let cards = [];
    if (state.currentTab === 'recruit') cards = SYS.recruitableUnits(state.factionId).map(item => { const cost=SYS.trainingCost(item.id,state.factionId,state.doctrineId,state.buildings),presentation=SYS.doctrineUnitPresentation(item.id,state.factionId,state.doctrineId),members=SYS.squadSpec(item.id,state.factionId,null,state.doctrineId).members; return {...item,...presentation,role:item.signatureOf?item.passiveLabel:presentation.role.replace(/\s*·\s*\d+\s*$/,'')+' · '+members,action:()=>train(item.id),cost:`<i class="g">● ${cost.glow}</i><i class="s">◆ ${cost.scrap}</i>`}; });
    if (state.currentTab === 'expand') { const work=SYS.wonderworkForFaction(state.factionId),count=SYS.wonderworkCount(state.buildings,0,state.factionId);cards=[...DATA.BUILDINGS.map(item => { const cost=SYS.claimCost(item.id,state.factionId,state.doctrineId),presentation=SYS.buildingSpec(item.id,state.factionId); return {...item,name:presentation.name,icon:presentation.icon,detail:presentation.detail,role:presentation.detail,conversion:!!presentation.conversionId,action:()=>beginPlacement(item.id),cost:`<i class="g">● ${cost.glow}</i><i class="s">◆ ${cost.scrap}</i>`}; }),{...work,id:'wonderwork',wonderwork:true,role:'FACTION WONDERWORK '+count+'/'+work.max+' · '+work.detail,action:()=>beginPlacement('wonderwork'),disabled:count>=work.max,cost:`<i class="g">● ${SYS.claimCost('wonderwork',state.factionId,state.doctrineId).glow}</i><i class="s">◆ ${SYS.claimCost('wonderwork',state.factionId,state.doctrineId).scrap}</i>`}]; }
    if (state.currentTab === 'charter') cards = DATA.CHARTERS.map(item => ({...item,role:item.detail,action:()=>setDistrictCharter(item.id),cost:`<i>${state.charterId===item.id?'ACTIVE':'NEW ROOFS'}</i>`}));
    if (state.currentTab === 'essence') cards = DATA.POWERS.map(item => { const cost=SYS.summonCost(item.id,state.factionId,state.doctrineId); const role=item.id==='pirates'&&state.factionId==='moonwake-corsairs'?'Summon 4 larger crews anywhere explored':item.detail; return {...item,role,action:()=>usePower(item.id),cost:`<i class="e">✦ ${cost}</i>${state.cooldowns[item.id]>0?`<i>${state.cooldowns[item.id].toFixed(1)}s</i>`:''}`}; });
    if (state.currentTab === 'council') cards = SYS.doctrinesForFaction(state.factionId).map(item=>({...item,doctrine:true,role:item.detail,action:()=>chooseDoctrine(item.id),disabled:!!state.doctrineId&&state.doctrineId!==item.id,cost:`<i>${state.doctrineId===item.id?'RATIFIED':'CHOOSE ONCE'}</i>`}));
    if (state.currentTab === 'macro') cards = [
      {id:'army',key:'1',name:'Select Army',icon:'◎',role:'All squads, one thought',action:()=>applyMacro('army')},
      {id:'guard',key:'2',name:'Guard the Clock',icon:'♜',role:'Return and defend',action:()=>applyMacro('guard')},
      {id:'raid',key:'3',name:'Comic Raid',icon:'⚡',role:'Hit nearest rival district',action:()=>applyMacro('raid')},
      {id:'march',key:'4',name:'Grand March',icon:'⚑',role:'Commit everything forward',action:()=>applyMacro('march')}
    ];
    cards.forEach(card => {
      const button = document.createElement('button'); button.className='command-card'; button.style.setProperty('--card-color',card.color||state.playerFaction.color); if(card.signatureOf)button.classList.add('signature-card');if(card.doctrine)button.classList.add('doctrine-card');if(card.wonderwork)button.classList.add('wonderwork-card');if(card.conversion)button.classList.add('district-conversion-card');
      button.innerHTML=`<span class="hotkey">${card.key}</span><span class="card-icon">${card.icon}</span><b>${card.name}</b><span class="role">${card.role||card.detail}</span><span class="cost">${card.cost||''}</span>`;
      if (state.placement && state.placement.kind===card.id) button.classList.add('selected');
      if (state.currentTab==='charter'&&state.charterId===card.id) button.classList.add('selected');
      if (state.currentTab==='council'&&state.doctrineId===card.id) button.classList.add('selected');
      button.disabled=!!card.disabled;
      button.addEventListener('click',card.action); ui.commandCards.appendChild(button);
    });
  }

  function feed(message, color) {
    const item=document.createElement('div'); item.className='feed-item'; item.style.setProperty('--feed-color',color||DATA.COLORS.mint); item.textContent=message;
    ui.eventFeed.prepend(item); while(ui.eventFeed.children.length>5) ui.eventFeed.lastElementChild.remove();
    setTimeout(()=>{ if(item.parentNode)item.remove(); },9000);
  }

  function update(dt) {
    if (state.paused || state.gameOver) return;
    state.elapsed += dt; state.scoutTimer -= dt; state.allyTimer -= dt;
    for (const id of Object.keys(state.cooldowns)) state.cooldowns[id] = Math.max(0,state.cooldowns[id]-dt);

    updateMapMechanic(dt);
    const baseIncome = SYS.incomeFor(state.buildings,state.factionId,state.doctrineId), mapIncome = SYS.mapIncomeMultiplier(state.map.id,state.hazard.current);
    state.income = { glow:baseIncome.glow*mapIncome, scrap:baseIncome.scrap*mapIncome, cap:baseIncome.cap };
    state.resources.glow += state.income.glow*dt; state.resources.scrap += state.income.scrap*dt;
    updateCoopRelay(dt);
    updateConstruction(dt); updateDistrictConversions(dt); updateDistrictCharters(dt); updateWonderworks(dt); updateQueue(dt); updateSquads(dt); updateParticles(dt); updateHealing(dt);
    if (state.autoScout && state.scoutTimer<=0) { runAutoScout(); state.scoutTimer=3.5; }
    updateRivalPlanner(dt);
    if (state.mode==='coop'&&state.allyTimer<=0) { allyWave(); state.allyTimer=15; }
    updateExploration(); checkVictory();
  }

  function updateMapMechanic(dt) {
    const current=SYS.mapMechanicState(state.map.id,state.elapsed), mechanic=state.map.mechanic;
    state.hazard.current=current;
    if(current.warning&&state.hazard.lastPhase!=='warning') feed(mechanic.title+' in '+Math.ceil(current.nextIn)+' seconds.',mechanic.color);
    if(current.active&&current.pulse!==state.hazard.lastPulse){
      state.hazard.lastPulse=current.pulse;
      const messages={
        tuesday:'CHRONOGUST! Lit bridges are running ahead of time.',
        'gargoyle-garage':'TOW SHIFT! Gargoyles are policing contested roofs.',
        'royal-table':'BANQUET BELL! Every finished Borough is feasting.',
        'dragon-metro':'THE DRAGON EXHALES! Every army is visible.',
        'cloud-annex':'MEMO WINDFALL! Finished districts caught the paperwork.',
        'witch-mall':'ESCALATORS '+(current.direction>0?'EASTBOUND':'WESTBOUND')+'! March with the arrows.'
      };
      feed(messages[state.map.id],mechanic.color); sound('warning');
      if(state.map.id==='cloud-annex'){
        const districts=state.buildings.filter(building=>building.team===0&&building.kind!=='command'&&building.progress>=1&&building.hp>0).length;
        const glow=18*districts,scrap=12*districts;state.resources.glow+=glow;state.resources.scrap+=scrap;
        feed(districts+' districts filed +'+glow+' Glow / +'+scrap+' Scrap.',mechanic.color);
        state.buildings.filter(building=>building.team===0&&building.kind!=='command'&&building.progress>=1).forEach(building=>burst(building.x,building.y,mechanic.color,12));
      }
    }
    state.hazard.hotAnchors=current.active&&state.map.id==='gargoyle-garage'?contestedAnchors():[];
    if(state.hazard.hotAnchors.length){
      for(const squad of state.squads){
        if(squad.hp<=0||!state.hazard.hotAnchors.some(anchor=>SYS.distance(squad,anchor)<155))continue;
        applyHazardDamage(squad,5.5*dt);
      }
    }
    state.hazard.lastPhase=current.phase;
  }

  function contestedAnchors() {
    return state.anchors.filter(anchor=>{
      let friendly=false,enemy=false;
      for(const squad of state.squads){if(squad.hp<=0||SYS.distance(squad,anchor)>=155)continue;if(squad.team===2)enemy=true;else friendly=true;if(friendly&&enemy)return true;}
      return false;
    });
  }

  function applyHazardDamage(squad,amount) {
    const before=squad.hp,previousMembers=squad.members;squad.hp=Math.max(0,squad.hp-amount);
    const deaths=SYS.casualtyDelta(before,squad.hp,squad.memberHp,previousMembers);squad.members=Math.max(0,Math.ceil(squad.hp/squad.memberHp));
    if(deaths>0){awardCasualtyEssence(squad,deaths,'TOW ',state.map.mechanic.color);burst(squad.x,squad.y,state.map.mechanic.color,deaths*3);}
    if(squad.hp<=0&&!tryReassemble(squad))burst(squad.x,squad.y,state.map.mechanic.color,18);
  }

  function activateWakeDividend(dividend,casualty) {
    if(!dividend||!dividend.sourceId||!(dividend.essence>0))return null;
    const source=state.buildings.find(building=>building.id===dividend.sourceId&&building.hp>0);if(!source)return null;
    const until=state.elapsed+2.1;source.conversionPulseUntil=until;source.conversionTargets=[casualty.id];source.conversionReceipt={x:casualty.x,y:casualty.y,amount:dividend.essence,bonusRate:dividend.bonusRate,until};
    const visible=source.team!==2||SYS.exploredAt(state.visible,source.x,source.y,80)&&SYS.exploredAt(state.visible,casualty.x,casualty.y,80);
    if(visible){const color=SYS.faction(source.factionId).color;floatText(source.x,source.y,'WAKE +'+dividend.essence.toFixed(dividend.essence%1?1:0)+' ✦',color);burst(source.x,source.y,color,12);}
    return source;
  }

  function cashRivalEssence(source,message,color) {
    if(!source||source.team!==2||state.enemyEssence<60)return false;
    state.enemyEssence-=60;const target=state.buildings.find(item=>item.team===0&&item.kind==='command');
    for(let i=0;i<3;i++){const squad=addSquad(2,i===1?'hexbows':'mobs',source.x+(i-1)*42,source.y+70,source.factionId,{extraMembers:1});squad.ghost=true;if(target)orderSquad(squad,target.x,target.y,'raid',target.id);}
    feed(message||'The rival cashed Essence into a ghost audit.',color||SYS.faction(source.factionId).color);return true;
  }

  function awardCasualtyEssence(casualty,deaths,prefix,color) {
    const base=SYS.essenceFromDeaths(deaths,state.factionId)*SYS.essenceAuraMultiplier(casualty,state.squads),playerDividend=SYS.districtWakeDividend(casualty,deaths,state.buildings,0),rivalDividend=SYS.districtWakeDividend(casualty,deaths,state.buildings,2),gained=base+playerDividend.essence;
    state.resources.essence+=gained;state.enemyEssence+=rivalDividend.essence;floatText(casualty.x,casualty.y,(prefix||'')+'+'+gained.toFixed(gained%1?1:0)+' ✦',color||DATA.COLORS.violet);
    activateWakeDividend(playerDividend,casualty);const rivalSource=activateWakeDividend(rivalDividend,casualty);if(rivalSource)cashRivalEssence(rivalSource,'The rival cashed Wake Dividends into a ghost audit.',SYS.faction(rivalSource.factionId).color);
    return {base,gained,playerDividend,rivalDividend};
  }

  function tryReassemble(squad) {
    if(!squad||squad.hp>0||squad.members===undefined||squad.reassembled||SYS.unit(squad.unitId).passive!=='one-reassembly')return false;
    const unit=SYS.unit(squad.unitId);squad.reassembled=true;squad.hp=squad.maxHp*.45;squad.members=Math.max(1,Math.ceil(squad.hp/squad.memberHp));squad.targetEntity=null;squad.route=[];squad.order='ready';
    feed('Coffin Union reassembled under collective agreement.',unit.color);burst(squad.x,squad.y,unit.color,24);floatText(squad.x,squad.y,'BACK ON SHIFT',unit.color);return true;
  }

  function updateConstruction(dt) {
    for (const building of state.buildings) {
      if (building.progress>=1 || !building.buildSeconds) continue;
      building.buildRemaining-=dt*SYS.constructionAuraMultiplier(building,state.squads); building.progress=SYS.clamp(1-building.buildRemaining/building.buildSeconds,.02,1);
      if (building.progress>=1) { building.hp=building.maxHp; const charter=SYS.charter(building.charterId),bonus=SYS.districtNetworkBonus(building,state.buildings),spec=SYS.buildingSpec(building.kind,building.factionId);feed(spec.name+' complete · '+charter.name+(bonus>1?' wonderweb x'+bonus.toFixed(2):'')+'.',charter.color); burst(building.x,building.y,building.kind==='wonderwork'?spec.color:charter.color,building.kind==='wonderwork'?32:18); sound('ready'); if(building.team===0&&state.factionId==='thorn-court') state.squads.filter(s=>s.team===0&&SYS.distance(s,building)<240).forEach(s=>s.hp=Math.min(s.maxHp,s.hp+s.maxHp*.35)); }
    }
  }

  function updateDistrictConversions(dt) {
    for(const building of state.buildings){
      const conversion=SYS.districtConversionFor(building.factionId,building.kind),effect=conversion&&conversion.effect;
      if(effect&&effect.kind==='union-shift'){
        const pulse=SYS.districtUnionShiftPulse(building,state.buildings,state.squads);if(!pulse)continue;
        building.conversionClock=(Number.isFinite(building.conversionClock)&&building.conversionClock>0?building.conversionClock:pulse.period)-dt;
        if(building.conversionClock>0)continue;building.conversionClock=pulse.period;
        if(!pulse.targets.length)continue;
        building.conversionPulseUntil=state.elapsed+pulse.duration;building.conversionTargets=pulse.targets.map(target=>target.id);
        for(const target of pulse.targets){
          const alreadyShifted=target.unionShiftUntil>state.elapsed;
          target.unionShiftUntil=Math.max(Number(target.unionShiftUntil||0),state.elapsed+pulse.duration);
          target.unionShiftMoveMultiplier=Math.max(alreadyShifted?Number(target.unionShiftMoveMultiplier||1):1,pulse.moveMultiplier);
          target.unionShiftAttackRecoveryMultiplier=Math.max(alreadyShifted?Number(target.unionShiftAttackRecoveryMultiplier||1):1,pulse.attackRecoveryMultiplier);
          burst(target.x,target.y,DATA.COLORS.orange,6);
        }
        floatText(building.x,building.y,'THIRTEENTH HOUR ×'+pulse.targets.length,DATA.COLORS.orange);burst(building.x,building.y,DATA.COLORS.orange,20);
        if(building.team===0)feed('Thirteenth-Hour Union Hall rang shift change for '+pulse.targets.length+' formation'+(pulse.targets.length>1?'s':'')+'.',DATA.COLORS.orange);
        continue;
      }
      if(effect&&effect.kind==='spectral-census'){
        const explored=building.team===2?state.rivalExplored:state.explored,pulse=SYS.districtCensusPulse(building,state.buildings,state.anchors,state.links,explored);if(!pulse)continue;
        const remaining=Number.isFinite(building.conversionClock)&&building.conversionClock>0?Math.min(building.conversionClock,pulse.period):pulse.period;
        building.conversionClock=remaining-dt;if(building.conversionClock>0)continue;building.conversionClock=pulse.period;
        if(!pulse.target)continue;
        const reveal={team:building.team===2?2:0,x:pulse.target.x,y:pulse.target.y,radius:pulse.revealRadius,until:state.elapsed+pulse.revealSeconds};state.censusReveals.push(reveal);
        revealCircle(building.team===2?state.rivalVisible:state.visible,building.team===2?state.rivalExplored:state.explored,reveal.x,reveal.y,reveal.radius,80);
        building.conversionPulseUntil=reveal.until;building.conversionTargets=[pulse.target.id];building.conversionPath=pulse.path.map(anchor=>anchor.id);
        if(building.team!==2){floatText(building.x,building.y,'CENSUS FILED',DATA.COLORS.mint);burst(building.x,building.y,DATA.COLORS.mint,16);burst(pulse.target.x,pulse.target.y,DATA.COLORS.cream,12);}
        if(building.team===0)feed('Spectral Census Bureau filed '+(pulse.target.name||'an unnamed roof')+'.',DATA.COLORS.mint);
        continue;
      }
      if(effect&&effect.kind==='lead-role-spotlight'){
        const visible=building.team===2?state.rivalVisible:state.visible,visibleSquads=state.squads.filter(squad=>SYS.exploredAt(visible,squad.x,squad.y,80));
        const pulse=SYS.districtSpotlightPulse(building,state.buildings,visibleSquads);if(!pulse)continue;
        building.conversionClock=(Number.isFinite(building.conversionClock)&&building.conversionClock>0?building.conversionClock:pulse.period)-dt;
        if(building.conversionClock>0)continue;building.conversionClock=pulse.period;
        if(!pulse.target)continue;
        building.conversionPulseUntil=state.elapsed+pulse.duration;building.conversionTargets=[pulse.target.id];
        floatText(pulse.target.x,pulse.target.y,'LEAD ROLE ×'+pulse.damageMultiplier.toFixed(2),DATA.COLORS.gold);burst(building.x,building.y,DATA.COLORS.gold,16);burst(pulse.target.x,pulse.target.y,SYS.faction(building.factionId).color,14);
        if(building.team===0)feed('Foreground Spotlight cast an enemy formation as the lead role.',SYS.faction(building.factionId).color);
        continue;
      }
      if(effect&&effect.kind==='civic-cover'){
        const visible=building.team===2?state.rivalVisible:state.visible,visibleSquads=state.squads.filter(squad=>SYS.exploredAt(visible,squad.x,squad.y,80));
        const pulse=SYS.districtCivicCoverPulse(building,state.buildings,visibleSquads);if(!pulse)continue;
        building.conversionClock=(Number.isFinite(building.conversionClock)&&building.conversionClock>0?building.conversionClock:pulse.period)-dt;
        if(building.conversionClock>0)continue;building.conversionClock=pulse.period;
        if(!pulse.threats.length||!pulse.targets.length)continue;
        building.conversionPulseUntil=state.elapsed+pulse.duration;building.conversionTargets=pulse.targets.map(target=>target.id);
        for(const target of pulse.targets)burst(target.x,target.y,DATA.COLORS.gold,6);
        floatText(building.x,building.y,'CIVIC COVER '+Math.round(pulse.damageReduction*1000)/10+'%',DATA.COLORS.gold);burst(building.x,building.y,DATA.COLORS.gold,20);
        if(building.team===0)feed('Every-Window Assembly raised Civic Cover for '+pulse.targets.length+' formation'+(pulse.targets.length>1?'s':'')+'.',DATA.COLORS.gold);
        continue;
      }
      if(effect&&effect.kind==='deadline-deferral'){
        const visible=building.team===2?state.rivalVisible:state.visible,visibleSquads=state.squads.filter(squad=>SYS.exploredAt(visible,squad.x,squad.y,80));
        const pulse=SYS.districtAdjournmentPulse(building,state.buildings,visibleSquads,state.elapsed);if(!pulse)continue;
        building.conversionClock=(Number.isFinite(building.conversionClock)&&building.conversionClock>0?building.conversionClock:pulse.period)-dt;
        if(building.conversionClock>0)continue;building.conversionClock=pulse.period;
        if(!pulse.target)continue;
        pulse.target.temporalAdjournedUntil=state.elapsed+pulse.duration;pulse.target.temporalAdjournmentSourceId=building.id;
        building.conversionPulseUntil=pulse.target.temporalAdjournedUntil;building.conversionTargets=[pulse.target.id];
        floatText(pulse.target.x,pulse.target.y,'FILED: LATER '+pulse.duration.toFixed(1)+'s',SYS.faction(building.factionId).color);burst(building.x,building.y,SYS.faction(building.factionId).color,18);burst(pulse.target.x,pulse.target.y,DATA.COLORS.cyan,14);
        if(building.team===0)feed('Department of Later deferred one enemy formation without changing its order.',SYS.faction(building.factionId).color);
        continue;
      }
      const pulse=SYS.districtConversionPulse(building,state.buildings);if(!pulse)continue;
      building.conversionClock=(Number.isFinite(building.conversionClock)&&building.conversionClock>0?building.conversionClock:pulse.period)-dt;
      if(building.conversionClock>0)continue;building.conversionClock=pulse.period;
      if(!pulse.targets.length)continue;
      building.conversionPulseUntil=state.elapsed+1.35;building.conversionTargets=pulse.targets.map(target=>target.id);
      for(const target of pulse.targets){target.hp=Math.min(target.maxHp,target.hp+pulse.amount);burst(target.x,target.y,DATA.COLORS.pink,7);}
      floatText(building.x,building.y,'BRIAR MEND ×'+pulse.targets.length,DATA.COLORS.pink);burst(building.x,building.y,DATA.COLORS.pink,16);
      if(building.team===0)feed('Briarway Gatehouse repaired '+pulse.targets.length+' wonderweb district'+(pulse.targets.length>1?'s':'')+'.',DATA.COLORS.pink);
    }
  }

  function updateDistrictCharters(dt) {
    let playerMusters=0;
    for(const building of state.buildings){
      if(building.kind==='command'||building.progress<1||building.hp<=0)continue;
      const effects=SYS.districtCharterEffects(building,state.buildings);if(!Number.isFinite(effects.musterSeconds))continue;
      building.musterClock=(Number.isFinite(building.musterClock)&&building.musterClock>0?building.musterClock:effects.musterSeconds)-dt;
      if(building.musterClock>0)continue;
      const factionId=building.factionId,branch=doctrineForTeam(building.team,factionId),expected=SYS.squadSpec('mobs',factionId,null,branch&&branch.id).members;
      if(building.team===0&&population()+expected>state.income.cap){building.musterClock=3;continue;}
      building.musterClock=effects.musterSeconds;const squad=addSquad(building.team,'mobs',building.x+65+(state.rng()-.5)*30,building.y+55+(state.rng()-.5)*35,factionId);squad.ghost=true;
      if(building.team===0){playerMusters+=1;adoptCurrentPlan(squad);}else if(building.team===2){const target=state.buildings.find(item=>item.team===0&&item.kind==='command');if(target)orderSquad(squad,target.x,target.y,'march',target.id);}
      floatText(building.x,building.y,'FREE MOB',SYS.charter(building.charterId).color);burst(building.x,building.y,SYS.charter(building.charterId).color,12);
    }
    if(playerMusters)feed((playerMusters>1?playerMusters+' Volunteer Séances':'Volunteer Séance')+' mustered '+playerMusters+' free squad'+(playerMusters>1?'s':'')+'.',SYS.charter('volunteer-seance').color);
  }

  function musterWonderworkSquad(building,spec) {
    const unitId=spec.effect.unitId,branch=doctrineForTeam(building.team,building.factionId),expected=SYS.squadSpec(unitId,building.factionId,null,branch&&branch.id).members;
    if(building.team===0&&population()+expected>state.income.cap)return false;
    const squad=addSquad(building.team,unitId,building.x+62+(state.rng()-.5)*35,building.y+55+(state.rng()-.5)*35,building.factionId);squad.ghost=true;
    if(building.team===0)adoptCurrentPlan(squad);else if(building.team===2){const target=state.buildings.find(item=>item.team===0&&item.kind==='command');if(target)orderSquad(squad,target.x,target.y,'march',target.id);}
    floatText(building.x,building.y,unitId==='brooms'?'FREE SCOUTS':'FREE MOB',spec.color);burst(building.x,building.y,spec.color,14);return true;
  }

  function updateWonderworks(dt) {
    for(const building of state.buildings){
      if(building.kind!=='wonderwork'||building.progress<1||building.hp<=0)continue;
      const spec=SYS.wonderworkForFaction(building.factionId),effect=spec.effect||{},network=SYS.districtNetworkBonus(building,state.buildings);
      if(effect.kind==='hedge-heal'){
        state.squads.filter(item=>item.team===building.team&&item.hp>0&&SYS.distance(item,building)<=effect.radius).forEach(item=>{item.hp=Math.min(item.maxHp,item.hp+effect.healPerSecond*network*dt);item.members=Math.max(1,Math.ceil(item.hp/item.memberHp));});
        state.buildings.filter(item=>item!==building&&item.team===building.team&&item.hp>0&&SYS.distance(item,building)<=effect.radius).forEach(item=>{item.hp=Math.min(item.maxHp,item.hp+effect.healPerSecond*.5*network*dt);});
      }
      if(!effect.period)continue;building.wonderClock=(Number.isFinite(building.wonderClock)&&building.wonderClock>0?building.wonderClock:effect.period/network)-dt;if(building.wonderClock>0)continue;building.wonderClock=effect.period/network;
      if(effect.kind==='shift-bell'){
        let advanced=0;if(building.team===0&&state.queue.length){state.queue[0].remaining=Math.max(0,state.queue[0].remaining-effect.queueSeconds*network);advanced+=1;}
        if(building.team===2&&state.rival){state.rival.countdown=Math.max(0,state.rival.countdown-effect.queueSeconds*network);advanced+=1;}
        for(const project of state.buildings){if(project.team!==building.team||project.progress>=1||!project.buildRemaining)continue;project.buildRemaining=Math.max(0,project.buildRemaining-effect.buildSeconds*network);advanced+=1;}
        if(advanced){floatText(building.x,building.y,'SHIFT BELL ×'+advanced,spec.color);burst(building.x,building.y,spec.color,18);}
      }
      if(effect.kind==='essence-stipend'){
        const gained=effect.amount*network;if(building.team===0)state.resources.essence+=gained;else if(building.team===2)state.enemyEssence+=gained;floatText(building.x,building.y,'+'+gained.toFixed(network>1?1:0)+' ESSENCE',spec.color);burst(building.x,building.y,spec.color,12);
        cashRivalEssence(building,'The rival cashed haunting dividends into a ghost audit.',spec.color);
      }
      if(effect.kind==='scout-muster'||effect.kind==='mob-muster')musterWonderworkSquad(building,spec);
      if(effect.kind==='bone-reinforce'){
        const damaged=state.squads.filter(item=>item.team===building.team&&item.hp>0&&item.hp<item.maxHp&&SYS.distance(item,building)<=effect.radius).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        if(damaged){const before=damaged.members;damaged.hp=Math.min(damaged.maxHp,damaged.hp+damaged.memberHp*effect.fighters*network);damaged.members=Math.max(1,Math.ceil(damaged.hp/damaged.memberHp));floatText(damaged.x,damaged.y,'REASSEMBLED +'+Math.max(1,damaged.members-before),spec.color);burst(damaged.x,damaged.y,spec.color,10);}
      }
    }
  }

  function updateQueue(dt) {
    if (!state.queue.length) return; state.queue[0].remaining-=dt;
    if (state.queue[0].remaining<=0) finishTraining(state.queue.shift());
  }

  function squadMovePoint(squad) {
    while(squad.route&&squad.route.length&&SYS.distance(squad,squad.route[0])<28)squad.route.shift();
    return squad.route&&squad.route.length?squad.route[0]:{x:squad.tx,y:squad.ty};
  }

  function updateSquads(dt) {
    const livingSquads=state.squads.filter(s=>s.hp>0); const livingBuildings=state.buildings.filter(b=>b.hp>0&&b.progress>=.4);
    for (const squad of livingSquads) {
      const unionShifted=squad.unionShiftUntil>state.elapsed;if(!unionShifted){squad.unionShiftMoveMultiplier=1;squad.unionShiftAttackRecoveryMultiplier=1;}
      const adjourned=Number(squad.temporalAdjournedUntil||0)>state.elapsed;if(!adjourned)squad.temporalAdjournmentSourceId=null;
      squad.wobble+=dt*(adjourned?.22:1); squad.deadlineHaste=Math.max(0,(squad.deadlineHaste||0)-dt);squad.rerouteClock=Math.max(0,(squad.rerouteClock||0)-dt);
      if(adjourned)continue;
      squad.attackClock-=dt*(unionShifted?Number(squad.unionShiftAttackRecoveryMultiplier||1):1);
      let target = squad.targetEntity && (livingSquads.find(e=>e.id===squad.targetEntity)||livingBuildings.find(e=>e.id===squad.targetEntity));
      if (!target || target.hp<=0 || !isEnemy(squad.team,target.team)) target = SYS.nearest(squad,[...livingSquads,...livingBuildings],e=>e.id!==squad.id&&isEnemy(squad.team,e.team)&&SYS.distance(squad,e)<squad.sight);
      if (target) {
        const range=squad.range+(target.kind?42:18); const d=SYS.distance(squad,target);
        if(d<=range) { squad.targetEntity=target.id; squad.order='fight'; if(squad.attackClock<=0){ attack(squad,target); squad.attackClock=squad.unitId==='hexbows'?.95:.72; } continue; }
        if (squad.order==='fight'||squad.order==='march'||squad.order==='raid'||squad.order==='parade') { const moved=!squad.routeGoal||SYS.distance(squad.routeGoal,target)>110;if(squad.routeTargetId!==target.id||moved&&squad.rerouteClock<=0){routeSquad(squad,target.x,target.y);squad.routeTargetId=target.id;squad.rerouteClock=.65;}squad.targetEntity=target.id; }
      }
      const movePoint=squadMovePoint(squad),dx=movePoint.x-squad.x,dy=movePoint.y-squad.y,d=Math.hypot(dx,dy),routeSupport=SYS.districtRouteSupport(squad,livingBuildings);
      if(routeSupport.multiplier>1&&squad.routeSupportSourceId!==routeSupport.sourceId){const source=livingBuildings.find(building=>building.id===routeSupport.sourceId);if(source&&(!Number.isFinite(source.routeSupportSignalUntil)||source.routeSupportSignalUntil<=state.elapsed)){source.routeSupportSignalUntil=state.elapsed+1.35;floatText(source.x,source.y,'SAIL LANE Ã—'+routeSupport.multiplier.toFixed(2),DATA.COLORS.violet);burst(source.x,source.y,DATA.COLORS.violet,12);if(squad.team===0)feed('Black-Sail Anchorage opened a wonderweb route lane.',DATA.COLORS.violet);}}
      squad.routeSupportSourceId=routeSupport.sourceId;
      if(d>5){ const onBridge=SYS.isNearBridge(squad,state.anchors,state.links,34),onEscalator=state.links.some(pair=>{const a=state.anchors[pair[0]],b=state.anchors[pair[1]];return Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)*.6&&SYS.distanceToSegment(squad,a,b)<=34;}),nearContestedAnchor=state.hazard.hotAnchors.some(anchor=>SYS.distance(squad,anchor)<155); const mapSpeed=SYS.mapSpeedMultiplier(state.map.id,state.hazard.current,{onBridge,onEscalator,nearContestedAnchor,targetDeltaX:dx}); const speed=squad.speed*(squad.order==='parade'?1.18:1)*mapSpeed*SYS.marchAuraMultiplier(squad,livingSquads)*routeSupport.multiplier*(unionShifted?Number(squad.unionShiftMoveMultiplier||1):1)*(squad.deadlineHaste>0?1.6:1); squad.x+=dx/d*Math.min(d,speed*dt); squad.y+=dy/d*Math.min(d,speed*dt); squad.facing=Math.atan2(dy,dx); }
      else if((!squad.route||!squad.route.length)&&squad.order!=='guard') squad.order='ready';
    }
    state.squads=state.squads.filter(s=>s.hp>0);
  }

  function attack(attacker,target) {
    const before=target.hp; const previousMembers=target.members||1;
    const spotlight=SYS.districtSpotlightDamageMultiplier(attacker,target,state.buildings,state.elapsed);
    const cover=SYS.districtCivicCoverDamageMultiplier(target,state.buildings,state.elapsed);
    const damage=attacker.damage*Math.min(attacker.members,7)*(.33+state.rng()*.12)*SYS.lastActMultiplier(attacker)*spotlight.multiplier*cover.multiplier;
    target.hp=Math.max(0,target.hp-damage);
    const angle=Math.atan2(target.y-attacker.y,target.x-attacker.x);
    projectile(attacker.x+Math.cos(angle)*20,attacker.y+Math.sin(angle)*20,target.x,target.y,attacker.unitId==='hexbows'?DATA.COLORS.cyan:attacker.ghost?DATA.COLORS.violet:SYS.faction(attacker.factionId).color);
    if (target.members) {
      const deaths=SYS.casualtyDelta(before,target.hp,target.memberHp,previousMembers); target.members=Math.max(0,Math.ceil(target.hp/target.memberHp));
      if(deaths>0){ awardCasualtyEssence(target,deaths,'',DATA.COLORS.violet); burst(target.x,target.y,isEnemy(0,target.team)?DATA.COLORS.orange:DATA.COLORS.mint,deaths*3); }
    }
    if(target.hp<=0&&!tryReassemble(target)){ state.shake=target.kind?9:4; burst(target.x,target.y,target.kind?DATA.COLORS.orange:DATA.COLORS.violet,target.kind?34:16); if(target.kind) { const anchor=state.anchors.find(a=>a.id===target.anchorId); if(anchor)anchor.occupied=null; feed(target.kind==='command'?(target.team===2?'The enemy Grand Clock is breaking!':'Our Grand Clock has fallen!'):'A rooftop building has fallen.',target.team===2?DATA.COLORS.mint:DATA.COLORS.danger); } }
  }

  function updateHealing(dt) {
    const healers=state.buildings.filter(b=>b.kind==='bridgehead'&&b.progress>=1&&b.hp>0);
    for(const healer of healers) for(const squad of state.squads) if(!isEnemy(healer.team,squad.team)&&SYS.distance(healer,squad)<180) squad.hp=Math.min(squad.maxHp,squad.hp+10*dt);
    const briars=state.squads.filter(squad=>squad.hp>0&&SYS.unit(squad.unitId).passive==='healing-aura');
    for(const briar of briars)for(const squad of state.squads)if(squad.hp>0&&squad.team===briar.team&&SYS.distance(briar,squad)<230)squad.hp=Math.min(squad.maxHp,squad.hp+7.5*dt);
  }

  function runAutoScout() {
    const scouts=state.squads.filter(s=>s.team===0&&SYS.unit(s.unitId).scout&&s.hp>0&&(s.order==='ready'||SYS.distance(s,{x:s.tx,y:s.ty})<20));
    scouts.forEach(scout=>{ const unseen=SYS.nearest(scout,state.anchors,a=>!SYS.exploredAt(state.explored,a.x,a.y,80)); if(unseen) orderSquad(scout,unseen.x,unseen.y,'scout'); });
  }

  function rivalFighters(teamPredicate) { return state.squads.filter(squad=>squad.hp>0&&teamPredicate(squad.team)).reduce((sum,squad)=>sum+squad.members,0); }
  function rivalRoofLabel(anchorId) { const index=state.anchors.findIndex(anchor=>anchor.id===anchorId);return index<0?'Unknown roof':state.anchors[index].name||'Roof '+String(index+1).padStart(2,'0'); }
  function visibleRivalAnchorId() { const displayId=state.rival.schemeId==='roof-grab'&&state.rival.phase==='staging'?state.rival.stagingAnchorId:state.rival.targetAnchorId;const anchor=state.anchors.find(item=>item.id===displayId);return anchor&&SYS.exploredAt(state.explored,anchor.x,anchor.y,80)?anchor.id:null; }
  function rivalDisplayLabel() {
    if(state.rival.schemeId==='roof-grab'&&state.rival.phase==='staging')return visibleRivalAnchorId()?rivalRoofLabel(state.rival.stagingAnchorId)+' forward district':'Fog-hidden forward roof';
    const target=state.buildings.find(item=>item.id===state.rival.targetId&&item.hp>0);
    if(!target)return state.rival.targetLabel||'Fallback route';
    if(target.kind==='command')return 'Your Grand Clock';
    return rivalRoofLabel(target.anchorId)+' · '+SYS.buildingSpec(target.kind,target.factionId).name;
  }

  function updateRivalPlanner(dt) {
    if(!state.rival||state.rival.phase==='idle')return;
    const works=SYS.wonderworkEmpireEffects(state.buildings,2,state.enemyFactionId);state.rival.countdown=Math.max(0,state.rival.countdown-dt*Math.max(works.trainSpeed,works.cooldownSpeed));
    if(state.rival.countdown>0)return;
    if(state.rival.phase==='staging')launchRivalScheme();else planRivalScheme(false);
  }

  function planRivalScheme(reuseOpeningArmy) {
    const enemyHome=state.buildings.find(building=>building.team===2&&building.kind==='command'&&building.hp>0);
    const playerClock=state.buildings.find(building=>building.team===0&&building.kind==='command'&&building.hp>0);
    if(!enemyHome||!playerClock)return;
    const knownBoard=SYS.strategicKnownBuildings(state.buildings,2,state.rivalExplored),knownOpenRoofs=state.anchors.filter(anchor=>SYS.exploredAt(state.rivalExplored,anchor.x,anchor.y,80)&&!anchor.occupied),playerDistricts=knownBoard.filter(building=>building.team===0&&building.kind!=='command'&&building.hp>0&&building.progress>=.4).map(building=>({kind:building.kind,charterId:building.charterId,networkBonus:SYS.districtNetworkBonus(building,knownBoard)}));
    const cycle=state.rival.cycle+1;
    const scheme=SYS.rivalSchemeFor({ cycle, elapsed:state.elapsed, ownDistricts:state.buildings.filter(building=>building.team===2&&building.kind!=='command'&&building.hp>0).length, openRoofs:knownOpenRoofs.length, rivalFighters:rivalFighters(team=>team===2), playerFighters:rivalFighters(team=>team!==2), playerDistricts });
    let target=SYS.rivalTarget(scheme.id,knownBoard),stagingAnchorId=null,stagingBase=enemyHome;
    if(scheme.id==='roof-grab'){
      const open=knownOpenRoofs.sort((a,b)=>(SYS.distance(a,playerClock)*.58+SYS.distance(a,enemyHome)*.42)-(SYS.distance(b,playerClock)*.58+SYS.distance(b,enemyHome)*.42));
      const anchor=open[0];
      if(anchor){const charter=DATA.CHARTERS[Math.abs(cycle)%DATA.CHARTERS.length],kind=SYS.rivalExpansionKind(state.enemyFactionId,state.buildings,2);stagingBase=addBuilding(2,kind,anchor.x,anchor.y,anchor,state.enemyFactionId,1,charter.id);stagingAnchorId=anchor.id;target=SYS.nearest(anchor,knownBoard,building=>building.team===0&&building.hp>0&&building.progress>=.4)||playerClock;}
    }
    if(!target)target=playerClock;
    const cadence=SYS.rivalCadence(state.difficulty),signature=SYS.signatureForFaction(state.enemyFactionId).id,composition=SYS.rivalComposition(scheme.id,state.difficulty,cycle,signature),enemyWorks=SYS.wonderworkEmpireEffects(state.buildings,2,state.enemyFactionId);for(let i=0;i<Math.min(2,Math.round(enemyWorks.cap/100));i++)composition.push('mobs');
    const direction={x:target.x-stagingBase.x,y:target.y-stagingBase.y},length=Math.max(1,Math.hypot(direction.x,direction.y));
    const stage={x:stagingBase.x+direction.x/length*145,y:stagingBase.y+direction.y/length*145};
    const reserves=state.squads.filter(squad=>squad.team===2&&squad.hp>0&&!squad.targetEntity&&(reuseOpeningArmy||squad.order==='ready'||squad.order==='guard')&&SYS.distance(squad,enemyHome)<560);
    const stagedIds=[];
    for(let index=0;index<composition.length;index+=1){const squad=reserves[index]||addSquad(2,composition[index],enemyHome.x-75-state.rng()*65,enemyHome.y+(state.rng()-.5)*210,state.enemyFactionId);orderSquad(squad,stage.x+(index%2)*42,stage.y+(Math.floor(index/2)-.5)*48,'guard');stagedIds.push(squad.id);}
    state.rival={schemeId:scheme.id,phase:'staging',countdown:cadence.stage,cycle,targetId:target.id,targetAnchorId:target.anchorId||null,stagingAnchorId,targetLabel:target.kind==='command'?'Your Grand Clock':rivalRoofLabel(target.anchorId),stagedIds};
    feed('RIVAL SCHEME · '+scheme.name+' staging for '+rivalDisplayLabel()+'.',scheme.color);sound('warning');state.relay.publishClock=0;
  }

  function launchRivalScheme() {
    let target=state.buildings.find(building=>building.id===state.rival.targetId&&building.hp>0&&building.team===0);
    if(!target)target=SYS.rivalTarget('clock-crash',state.buildings);if(!target)return;
    const formation=state.rival.stagedIds.map(id=>state.squads.find(squad=>squad.id===id&&squad.hp>0)).filter(Boolean);
    formation.forEach((squad,index)=>orderSquad(squad,target.x+(index%3-1)*34,target.y+Math.floor(index/3)*36,'raid',target.id));
    state.rival.targetId=target.id;state.rival.phase='launched';state.rival.countdown=SYS.rivalCadence(state.difficulty).regroup;
    const scheme=SYS.rivalScheme(state.rival.schemeId);feed(scheme.name.toUpperCase()+' launched at '+rivalDisplayLabel()+'.',scheme.color);sound('warning');state.relay.publishClock=0;
  }

  function allyWave() {
    const allyHome=state.buildings.find(b=>b.team===1&&b.kind==='command'); const enemyHome=state.buildings.find(b=>b.team===2&&b.kind==='command'); if(!allyHome||!enemyHome)return;
    ['mobs','hexbows','brooms','pocket-paladins'].forEach((type,i)=>{const squad=addSquad(1,type,allyHome.x+80+i*35,allyHome.y-50+i*45,'lantern-republic');orderSquad(squad,enemyHome.x,enemyHome.y,'march',enemyHome.id);});
    feed('Co-op ally launched a coordinated lantern push.',DATA.COLORS.gold);
  }

  function revealCircle(visible,explored,x,y,sight,cell) {
    const span=Math.ceil(sight/cell),cx=Math.floor(x/cell),cy=Math.floor(y/cell);for(let row=cy-span;row<=cy+span;row++)for(let column=cx-span;column<=cx+span;column++){const px=(column+.5)*cell,py=(row+.5)*cell;if(Math.hypot(px-x,py-y)<sight){const key=row+':'+column;visible[key]=true;explored[key]=true;}}
  }

  function updateExploration() {
    const cell=80;state.visible={};state.rivalVisible={};
    const revealObservers=(observers,visible,explored)=>{for(const object of observers){const baseSight=object.kind==='watch'?480:object.kind==='command'?430:260,charterSight=object.kind?SYS.districtCharterEffects(object,state.buildings).sight:0,wonderSight=object.kind==='wonderwork'?Number(SYS.wonderworkForFaction(object.factionId).effect.sight||0)*SYS.districtNetworkBonus(object,state.buildings):0,sight=object.sight||((Math.max(baseSight+charterSight,wonderSight))*(object.factionId?(SYS.faction(object.factionId).mods.sight||1):1));revealCircle(visible,explored,object.x,object.y,sight,cell);}};
    revealObservers([...state.squads.filter(s=>s.team!==2),...state.buildings.filter(b=>b.team!==2&&b.progress>.6)],state.visible,state.explored);
    revealObservers([...state.squads.filter(s=>s.team===2),...state.buildings.filter(b=>b.team===2&&b.progress>.6)],state.rivalVisible,state.rivalExplored);
    state.censusReveals=state.censusReveals.filter(reveal=>reveal.until>state.elapsed);for(const reveal of state.censusReveals)revealCircle(reveal.team===2?state.rivalVisible:state.visible,reveal.team===2?state.rivalExplored:state.explored,reveal.x,reveal.y,reveal.radius,cell);
    if(state.map.id==='dragon-metro'&&state.hazard.current.active){for(let y=0;y<=Math.ceil(DATA.WORLD.height/cell);y++)for(let x=0;x<=Math.ceil(DATA.WORLD.width/cell);x++){const key=y+':'+x;state.visible[key]=true;state.rivalVisible[key]=true;}}
  }

  function checkVictory() {
    const player=state.buildings.find(b=>b.team===0&&b.kind==='command'); const enemy=state.buildings.find(b=>b.team===2&&b.kind==='command');
    if(enemy&&enemy.hp<=0)endGame(true); else if(player&&player.hp<=0)endGame(false);
  }

  function endGame(victory) {
    if(state.gameOver)return;state.gameOver=true;state.phase='outcome';if(state.mode==='coop')publishHostState();sound(victory?'victory':'defeat');
    const casualties=Math.round(state.resources.essence-60); showModal(victory?'THE ROOFTOP IS YOURS':'TUESDAY REPEATS',victory?'A macro victory, with excellent ghost accounting.':'The Grand Clock fell—but fairytales are legally required to offer another attempt.',
      `<p>${victory?'You broke the rival clock':'The rival broke your clock'} in <b>${formatTime(state.elapsed)}</b>. Your war produced approximately <b>${Math.max(0,casualties)} Essence</b> from the glorious administrative fact of things dying.</p><div class="guide-grid"><div><b>${population()} fighters remain</b><span>Squads preserve army scale without individual busywork.</span></div><div><b>${state.buildings.filter(b=>b.team===0&&b.hp>0).length} districts remain</b><span>Expansion was your economy and your map control.</span></div></div>`, 'Return to war room', ()=>{ui.modal.classList.add('hidden');ui.hud.classList.add('hidden');ui.warRoom.classList.remove('hidden');state.phase='setup';});
  }

  function frame(time) {
    if(state.phase!=='battle')return; const dt=Math.min(.04,Math.max(0,(time-state.lastTime)/1000)); state.lastTime=time;
    updateCamera(dt); update(dt); draw();
    if(time-state.lastUi>140){updateHud();state.lastUi=time;} if(time-state.lastMinimap>250){drawMinimap();state.lastMinimap=time;}
    requestAnimationFrame(frame);
  }

  function updateCamera(dt) {
    let dx=0,dy=0;if(state.keys.ArrowLeft||state.keys.a_pan)dx--;if(state.keys.ArrowRight||state.keys.d_pan)dx++;if(state.keys.ArrowUp||state.keys.w_pan)dy--;if(state.keys.ArrowDown||state.keys.s_pan)dy++;
    const margin=18;if(state.cursor.x<margin)dx--;if(state.cursor.x>innerWidth-margin)dx++;if(state.cursor.y<margin)dy--;if(state.cursor.y>innerHeight-margin&&state.cursor.y<innerHeight-205)dy++;
    const speed=620/state.camera.zoom;state.camera.x=SYS.clamp(state.camera.x+dx*speed*dt,0,DATA.WORLD.width);state.camera.y=SYS.clamp(state.camera.y+dy*speed*dt,0,DATA.WORLD.height);
  }

  function draw() {
    ctx.save(); const shake=state.shake>0?(Math.random()-.5)*state.shake:0;state.shake=Math.max(0,state.shake-.5);ctx.translate(shake,shake);
    ctx.clearRect(-20,-20,innerWidth+40,innerHeight+40); drawSky();
    ctx.save();ctx.translate(innerWidth/2-state.camera.x*state.camera.zoom,innerHeight/2-state.camera.y*state.camera.zoom);ctx.scale(state.camera.zoom,state.camera.zoom);
    drawWorld(); drawFog(); ctx.restore(); ctx.restore();
    if(depthRenderer){
      const depthAnchors=state.anchors.map((anchor,index)=>({id:anchor.id,index:index,x:anchor.x,y:anchor.y,radius:anchor.radius,visible:SYS.exploredAt(state.visible,anchor.x,anchor.y,80)}));
      const depthBuildings=state.buildings.filter(building=>building.hp>0&&building.progress>.2&&(building.team!==2||SYS.exploredAt(state.visible,building.x,building.y,80))).map(building=>({x:building.x,y:building.y,kind:building.kind,progress:building.progress,team:building.team,color:teamColor(building.team,building.factionId)}));
      const depthSquads=state.squads.filter(squad=>squad.hp>0&&(squad.team!==2||SYS.exploredAt(state.visible,squad.x,squad.y,80))).map(squad=>({x:squad.x,y:squad.y,team:squad.team,color:teamColor(squad.team,squad.factionId),selected:state.selected.has(squad.id),members:squad.members}));
      depthRenderer.render({anchors:depthAnchors,links:state.links,buildings:depthBuildings,squads:depthSquads,mapColor:state.map.mechanic.color,elapsed:state.elapsed},{cameraX:state.camera.x,cameraY:state.camera.y,zoom:state.camera.zoom,width:innerWidth,height:innerHeight,shake:shake});
    }
  }

  function drawSky() {
    const gradient=ctx.createRadialGradient(innerWidth*.55,innerHeight*.4,40,innerWidth*.5,innerHeight*.5,innerWidth*.8);gradient.addColorStop(0,state.map.tint);gradient.addColorStop(.55,'#10172c');gradient.addColorStop(1,'#070914');ctx.fillStyle=gradient;ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.fillStyle='rgba(255,255,255,.35)';for(let i=0;i<90;i++){const x=(i*173+state.map.seed*7)%innerWidth,y=(i*i*29+state.map.seed)%Math.max(1,innerHeight-180);ctx.globalAlpha=.12+(i%5)*.08;ctx.fillRect(x,y,1+(i%3===0),1+(i%3===0));}ctx.globalAlpha=1;
  }

  function drawWorld() {
    drawBridges(); drawDistrictNetwork(); state.anchors.forEach(drawRoof); drawDecor();
    drawDistrictConversions();
    drawMapMechanic(); drawTacticalSignal(); drawRivalIntent();
    state.buildings.filter(b=>b.hp>0&&(b.team!==2||SYS.exploredAt(state.visible,b.x,b.y,80))).sort((a,b)=>a.y-b.y).forEach(drawBuilding);
    state.squads.filter(s=>s.hp>0&&(s.team!==2||SYS.exploredAt(state.visible,s.x,s.y,80))).sort((a,b)=>a.y-b.y).forEach(drawSquad);
    drawWakeDividendLabels(); drawParticles(); drawOrders();
  }

  function drawDistrictNetwork(){const districts=state.buildings.filter(building=>building.kind!=='command'&&building.progress>=1&&building.hp>0&&building.charterId);ctx.save();ctx.lineWidth=3;ctx.setLineDash([7,11]);for(let i=0;i<districts.length;i++)for(let j=i+1;j<districts.length;j++){const a=districts[i],b=districts[j];if(a.team!==b.team||a.charterId===b.charterId||SYS.distance(a,b)>520)continue;ctx.globalAlpha=.12+.05*Math.sin(state.elapsed*2+i+j);ctx.strokeStyle=SYS.charter(a.charterId).color;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2-45,a.x+(b.x-a.x)*.52,a.y+(b.y-a.y)*.52);ctx.stroke();ctx.strokeStyle=SYS.charter(b.charterId).color;ctx.beginPath();ctx.moveTo(a.x+(b.x-a.x)*.48,a.y+(b.y-a.y)*.48);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2-45,b.x,b.y);ctx.stroke();}ctx.restore();}

  function drawDistrictConversions(){
    const gates=state.buildings.filter(building=>building.progress>=1&&building.hp>0&&SYS.districtConversionFor(building.factionId,building.kind)&& (building.team!==2||SYS.exploredAt(state.visible,building.x,building.y,80)));
    for(const gate of gates){
      const conversion=SYS.districtConversionFor(gate.factionId,gate.kind),effect=conversion.effect||{};
      if(effect.kind==='union-shift'){
        const active=gate.conversionPulseUntil>state.elapsed,network=SYS.districtNetworkBonus(gate,state.buildings),moveMultiplier=1+Number(effect.moveBonus||0)*network,color=SYS.faction(gate.factionId).color;
        ctx.save();ctx.translate(gate.x,gate.y);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=active?5:2;ctx.globalAlpha=active?.86:.24;ctx.beginPath();ctx.arc(0,0,63+(active?Math.sin(state.elapsed*8)*6:Math.sin(state.elapsed*2+gate.pulse)*3),0,Math.PI*2);ctx.stroke();
        for(let hour=0;hour<13;hour++){const angle=hour/13*Math.PI*2;ctx.beginPath();ctx.moveTo(Math.cos(angle)*48,Math.sin(angle)*48);ctx.lineTo(Math.cos(angle)*(active?74:67),Math.sin(angle)*(active?74:67));ctx.stroke();}
        if(active){ctx.globalAlpha=1;ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText('SHIFT CHANGE ×'+moveMultiplier.toFixed(2),0,-82);}ctx.restore();
        continue;
      }
      if(effect.kind==='spectral-census'){
        const color=SYS.faction(gate.factionId).color,active=gate.team!==2&&gate.conversionPulseUntil>state.elapsed,path=(gate.conversionPath||[]).map(id=>state.anchors.find(anchor=>anchor.id===id)).filter(Boolean),target=path[path.length-1];
        ctx.save();ctx.translate(gate.x,gate.y);ctx.strokeStyle=color;ctx.lineWidth=active?5:2;ctx.globalAlpha=active?.82:.24;ctx.setLineDash(active?[2,7]:[6,9]);ctx.beginPath();ctx.arc(0,0,58+(active?Math.sin(state.elapsed*7)*5:Math.sin(state.elapsed*2+gate.pulse)*3),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=color;ctx.font='900 10px Arial';ctx.textAlign='center';if(active)ctx.fillText('CENSUS FILED',0,-69);ctx.restore();
        if(active&&target){ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=.72;ctx.lineWidth=3;ctx.setLineDash([5,8]);ctx.beginPath();ctx.moveTo(gate.x,gate.y);for(const anchor of path)ctx.lineTo(anchor.x,anchor.y);ctx.stroke();ctx.setLineDash([]);for(let index=1;index<path.length;index++){const a=path[index-1],b=path[index],x=(a.x+b.x)/2,y=(a.y+b.y)/2;ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));ctx.fillStyle=index%2?DATA.COLORS.cream:color;ctx.fillRect(-9,-6,18,12);ctx.strokeStyle=color;ctx.strokeRect(-9,-6,18,12);ctx.restore();}ctx.beginPath();ctx.arc(target.x,target.y,36+Math.sin(state.elapsed*6)*6,0,Math.PI*2);ctx.strokeStyle=DATA.COLORS.cream;ctx.lineWidth=4;ctx.stroke();ctx.fillStyle=color;ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText('FILED · '+String(target.name||'FRONTIER').toUpperCase(),target.x,target.y-48);ctx.restore();}
        continue;
      }
      if(effect.kind==='black-sail-route'){
        const routed=state.squads.filter(squad=>squad.hp>0&&squad.team===gate.team&&SYS.districtRouteSupport(squad,state.buildings).sourceId===gate.id),active=routed.length>0,network=SYS.districtNetworkBonus(gate,state.buildings),color=SYS.faction(gate.factionId).color;
        ctx.save();ctx.translate(gate.x,gate.y);ctx.strokeStyle=color;ctx.lineWidth=active?5:2;ctx.globalAlpha=active?.78:.22;ctx.setLineDash(active?[]:[9,8]);ctx.beginPath();ctx.ellipse(0,0,62+(active?Math.sin(state.elapsed*5)*5:0),42,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=color;ctx.font='900 10px Arial';ctx.textAlign='center';if(active)ctx.fillText('SAIL LANE Ã—'+(1+Number(effect.speedBonus||0)*network).toFixed(2),0,-70);ctx.restore();
        for(const squad of routed){ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=.52;ctx.lineWidth=3;ctx.setLineDash([12,9]);ctx.beginPath();ctx.moveTo(gate.x,gate.y);ctx.quadraticCurveTo((gate.x+squad.x)/2,(gate.y+squad.y)/2-62,squad.x,squad.y);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
        continue;
      }
      if(effect.kind==='wake-dividend'){
        const receipt=gate.conversionReceipt,canSee=gate.team!==2||receipt&&SYS.exploredAt(state.visible,gate.x,gate.y,80)&&SYS.exploredAt(state.visible,receipt.x,receipt.y,80),active=canSee&&gate.conversionPulseUntil>state.elapsed&&receipt&&receipt.until>state.elapsed,network=SYS.districtNetworkBonus(gate,state.buildings),bonusRate=Number(effect.essenceBonus||0)*network,color=SYS.faction(gate.factionId).color,light=SYS.districtArchitectureForFaction(gate.factionId).light;
        ctx.save();ctx.translate(gate.x,gate.y);ctx.strokeStyle=color;ctx.fillStyle=light;ctx.lineWidth=active?5:2;ctx.globalAlpha=active?.88:.24;ctx.setLineDash(active?[2,5]:[7,8]);ctx.beginPath();ctx.arc(0,0,62+(active?Math.sin(state.elapsed*8)*6:Math.sin(state.elapsed*2+gate.pulse)*3),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(let slip=0;slip<8;slip++){const angle=slip/8*Math.PI*2,x=Math.cos(angle)*69,y=Math.sin(angle)*69;ctx.save();ctx.translate(x,y);ctx.rotate(angle+.5);ctx.fillRect(-7,-4,14,8);ctx.strokeRect(-7,-4,14,8);ctx.restore();}if(active){ctx.globalAlpha=1;ctx.fillStyle=light;ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText('WAKE DIVIDEND +'+Math.round(bonusRate*1000)/10+'%',0,-82);}ctx.restore();
        if(active){ctx.save();ctx.strokeStyle=color;ctx.fillStyle=light;ctx.globalAlpha=.74;ctx.lineWidth=3;ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(gate.x,gate.y);ctx.quadraticCurveTo((gate.x+receipt.x)/2,(gate.y+receipt.y)/2-58,receipt.x,receipt.y);ctx.stroke();ctx.setLineDash([]);for(const t of [.25,.5,.75]){const x=gate.x+(receipt.x-gate.x)*t,y=gate.y+(receipt.y-gate.y)*t-42*Math.sin(Math.PI*t);ctx.save();ctx.translate(x,y);ctx.rotate(t*1.2);ctx.fillRect(-8,-5,16,10);ctx.strokeRect(-8,-5,16,10);ctx.restore();}ctx.globalAlpha=.96;ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText('LAST RITES +'+Number(receipt.amount||0).toFixed(1)+' ✦',receipt.x,receipt.y-46);ctx.restore();}
        continue;
      }
      if(effect.kind==='lead-role-spotlight'){
        const target=(gate.conversionTargets||[]).map(id=>state.squads.find(squad=>squad.id===id&&squad.hp>0)).find(Boolean),active=gate.conversionPulseUntil>state.elapsed&&target,network=SYS.districtNetworkBonus(gate,state.buildings),multiplier=1+Number(effect.damageBonus||0)*network,color=SYS.faction(gate.factionId).color;
        ctx.save();ctx.translate(gate.x,gate.y);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=active?5:2;ctx.globalAlpha=active?.84:.22;ctx.setLineDash(active?[3,6]:[8,10]);ctx.beginPath();ctx.arc(0,0,61+(active?Math.sin(state.elapsed*7)*5:0),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(const angle of [-.7,0,.7]){ctx.beginPath();ctx.moveTo(Math.cos(angle)*34,Math.sin(angle)*34);ctx.lineTo(Math.cos(angle)*71,Math.sin(angle)*71);ctx.stroke();}if(active){ctx.globalAlpha=1;ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText('LEAD ROLE ×'+multiplier.toFixed(2),0,-76);}ctx.restore();
        if(active){ctx.save();ctx.strokeStyle=color;ctx.fillStyle=DATA.COLORS.gold;ctx.globalAlpha=.72;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(gate.x-18,gate.y-20);ctx.lineTo(target.x-34,target.y+22);ctx.moveTo(gate.x+18,gate.y-20);ctx.lineTo(target.x+34,target.y+22);ctx.stroke();ctx.beginPath();ctx.ellipse(target.x,target.y+8,46+Math.sin(state.elapsed*8)*4,29,0,0,Math.PI*2);ctx.strokeStyle=DATA.COLORS.gold;ctx.stroke();ctx.globalAlpha=.95;ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText('CAST: LEAD',target.x,target.y-45);ctx.restore();}
        continue;
      }
      if(effect.kind==='civic-cover'){
        const active=gate.conversionPulseUntil>state.elapsed,network=SYS.districtNetworkBonus(gate,state.buildings),reduction=Math.min(.45,Number(effect.damageReduction||0)*network),color=SYS.faction(gate.factionId).color;
        ctx.save();ctx.translate(gate.x,gate.y);ctx.strokeStyle=DATA.COLORS.gold;ctx.fillStyle=color;ctx.lineWidth=active?5:2;ctx.globalAlpha=active?.9:.24;ctx.setLineDash(active?[]:[4,7]);ctx.beginPath();ctx.arc(0,0,64+(active?Math.sin(state.elapsed*7)*5:Math.sin(state.elapsed*2+gate.pulse)*3),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(let window=0;window<8;window++){const angle=window/8*Math.PI*2,x=Math.cos(angle)*69,y=Math.sin(angle)*69;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillRect(-5,-7,10,14);ctx.restore();}if(active){ctx.globalAlpha=1;ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillStyle=DATA.COLORS.gold;ctx.fillText('CIVIC COVER '+Math.round(reduction*1000)/10+'%',0,-80);}ctx.restore();
        if(active)for(const id of gate.conversionTargets||[]){const target=state.squads.find(squad=>squad.id===id&&squad.hp>0);if(!target||SYS.distance(gate,target)>Number(effect.range||0)||target.team===2&&!SYS.exploredAt(state.visible,target.x,target.y,80))continue;ctx.save();ctx.strokeStyle=DATA.COLORS.gold;ctx.globalAlpha=.38;ctx.lineWidth=2;ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(gate.x,gate.y);ctx.quadraticCurveTo((gate.x+target.x)/2,(gate.y+target.y)/2-38,target.x,target.y);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
        continue;
      }
      if(effect.kind==='deadline-deferral'){
        const target=(gate.conversionTargets||[]).map(id=>state.squads.find(squad=>squad.id===id&&squad.hp>0)).find(Boolean),active=gate.conversionPulseUntil>state.elapsed&&target&&target.temporalAdjournedUntil>state.elapsed,network=SYS.districtNetworkBonus(gate,state.buildings),duration=Math.min(Number(effect.maxDuration||4.35),Number(effect.duration||3)*network),color=SYS.faction(gate.factionId).color;
        ctx.save();ctx.translate(gate.x,gate.y);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=active?5:2;ctx.globalAlpha=active?.86:.24;ctx.setLineDash(active?[2,5]:[7,9]);ctx.beginPath();ctx.arc(0,0,62+(active?Math.sin(state.elapsed*8)*5:Math.sin(state.elapsed*2+gate.pulse)*3),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(let tick=0;tick<8;tick++){const angle=tick/8*Math.PI*2;ctx.beginPath();ctx.moveTo(Math.cos(angle)*48,Math.sin(angle)*48);ctx.lineTo(Math.cos(angle)*70,Math.sin(angle)*70);ctx.stroke();}if(active){ctx.globalAlpha=1;ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText('DEFERRED '+duration.toFixed(1)+'s',0,-80);}ctx.restore();
        if(active){ctx.save();ctx.strokeStyle=color;ctx.fillStyle=DATA.COLORS.cyan;ctx.globalAlpha=.78;ctx.lineWidth=3;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(gate.x,gate.y);ctx.quadraticCurveTo((gate.x+target.x)/2,(gate.y+target.y)/2-58,target.x,target.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.ellipse(target.x,target.y+8,45+Math.sin(state.elapsed*8)*4,28,0,0,Math.PI*2);ctx.stroke();ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText('FILED: LATER',target.x,target.y-44);ctx.restore();}
        continue;
      }
      const active=gate.conversionPulseUntil>state.elapsed,pulse=active?1-(gate.conversionPulseUntil-state.elapsed)/1.35:0;ctx.save();ctx.translate(gate.x,gate.y);ctx.strokeStyle=DATA.COLORS.pink;ctx.lineWidth=active?5:2;ctx.globalAlpha=active?.82:.22;ctx.setLineDash(active?[]:[5,8]);ctx.beginPath();ctx.arc(0,0,54+(active?pulse*34:Math.sin(state.elapsed*2+gate.pulse)*3),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
      if(!active)continue;
      for(const id of gate.conversionTargets||[]){const target=state.buildings.find(building=>building.id===id&&building.hp>0);if(!target||target.team===2&&!SYS.exploredAt(state.visible,target.x,target.y,80))continue;ctx.save();ctx.strokeStyle=DATA.COLORS.pink;ctx.globalAlpha=.72;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(gate.x,gate.y);ctx.quadraticCurveTo((gate.x+target.x)/2,(gate.y+target.y)/2-55,target.x,target.y);ctx.stroke();for(const t of [.28,.52,.76]){const x=gate.x+(target.x-gate.x)*t,y=gate.y+(target.y-gate.y)*t-28*Math.sin(Math.PI*t);ctx.fillStyle=t<.6?DATA.COLORS.pink:DATA.COLORS.mint;ctx.beginPath();ctx.ellipse(x,y,7,3,Math.atan2(target.y-gate.y,target.x-gate.x),0,Math.PI*2);ctx.fill();}ctx.restore();}
    }
  }

  function drawWakeDividendLabels(){
    for(const gate of state.buildings){
      const conversion=gate.progress>=1&&gate.hp>0&&SYS.districtConversionFor(gate.factionId,gate.kind),effect=conversion&&conversion.effect,receipt=gate.conversionReceipt;
      if(!effect||effect.kind!=='wake-dividend'||!receipt||gate.conversionPulseUntil<=state.elapsed||receipt.until<=state.elapsed)continue;
      if(gate.team===2&&(!SYS.exploredAt(state.visible,gate.x,gate.y,80)||!SYS.exploredAt(state.visible,receipt.x,receipt.y,80)))continue;
      const network=SYS.districtNetworkBonus(gate,state.buildings),bonusRate=Number(effect.essenceBonus||0)*network,color=SYS.faction(gate.factionId).color,light=SYS.districtArchitectureForFaction(gate.factionId).light;
      ctx.save();ctx.font='900 11px Arial';ctx.textAlign='center';ctx.lineWidth=2;ctx.globalAlpha=.96;
      ctx.fillStyle='rgba(7,9,20,.88)';ctx.strokeStyle=color;ctx.fillRect(gate.x-86,gate.y-108,172,23);ctx.strokeRect(gate.x-86,gate.y-108,172,23);ctx.fillStyle=light;ctx.fillText('WAKE DIVIDEND +'+Math.round(bonusRate*1000)/10+'%',gate.x,gate.y-92);
      ctx.fillStyle='rgba(7,9,20,.88)';ctx.strokeStyle=color;ctx.fillRect(receipt.x-68,receipt.y-64,136,22);ctx.strokeRect(receipt.x-68,receipt.y-64,136,22);ctx.fillStyle=light;ctx.fillText('LAST RITES +'+Number(receipt.amount||0).toFixed(1)+' ESS',receipt.x,receipt.y-48);ctx.restore();
    }
  }

  function drawBridges() {
    const lit=state.hazard.current&&state.hazard.current.active&&(state.map.id==='tuesday'||state.map.id==='witch-mall');
    ctx.lineCap='round';state.links.forEach((pair,index)=>{const a=state.anchors[pair[0]],b=state.anchors[pair[1]],linkLit=lit&&(state.map.id!=='witch-mall'||Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)*.6);ctx.strokeStyle='#090d1c';ctx.lineWidth=58;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle=linkLit?state.map.mechanic.color:index%4===0?'#67427a':'#3a4969';ctx.globalAlpha=linkLit?.42:1;ctx.lineWidth=40;ctx.stroke();ctx.globalAlpha=1;ctx.strokeStyle=linkLit?state.map.mechanic.color:index%4===0?'rgba(211,151,255,.48)':'rgba(170,202,242,.34)';ctx.lineWidth=linkLit?4:2;ctx.setLineDash([14,12]);ctx.stroke();ctx.setLineDash([]);});
  }

  function drawRoof(anchor,index) {
    const points=9;ctx.save();ctx.translate(anchor.x,anchor.y);ctx.rotate((index%3-.5)*.08);ctx.beginPath();for(let i=0;i<points;i++){const angle=i/points*Math.PI*2,r=anchor.radius*(i%2?.94:1.08);const x=Math.cos(angle)*r,y=Math.sin(angle)*r*.72;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();
    const fill=ctx.createLinearGradient(0,-anchor.radius,0,anchor.radius);fill.addColorStop(0,'#536684');fill.addColorStop(1,'#252d4b');ctx.fillStyle=fill;ctx.shadowColor='#000';ctx.shadowBlur=18;ctx.shadowOffsetY=12;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(193,218,255,.38)';ctx.lineWidth=3;ctx.stroke();
    ctx.strokeStyle='rgba(163,193,232,.2)';ctx.lineWidth=1;for(let i=-60;i<70;i+=24){ctx.beginPath();ctx.moveTo(-anchor.radius,i);ctx.lineTo(anchor.radius,i-20);ctx.stroke();}
    if(!anchor.occupied&&SYS.exploredAt(state.explored,anchor.x,anchor.y,80)){const pulse=.5+Math.sin(state.elapsed*2+anchor.sparkle)*.25;ctx.beginPath();ctx.arc(0,0,28+Math.sin(state.elapsed*2+anchor.sparkle)*4,0,Math.PI*2);ctx.strokeStyle=`rgba(255,211,106,${pulse})`;ctx.lineWidth=2;ctx.setLineDash([5,6]);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=`rgba(255,211,106,${pulse*.18})`;ctx.fill();ctx.fillStyle='rgba(255,232,170,.8)';ctx.font='700 11px Arial';ctx.textAlign='center';ctx.fillText('CLAIM',0,4);}
    ctx.restore();
  }

  function drawDecor() {
    for(let i=0;i<state.anchors.length;i++){const a=state.anchors[i];if(a.occupied)continue;ctx.fillStyle='rgba(255,154,60,.55)';ctx.beginPath();ctx.arc(a.x-a.radius*.48,a.y-a.radius*.2,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#131629';ctx.fillRect(a.x-a.radius*.51,a.y-a.radius*.55,8,a.radius*.34);}
  }

  function drawMapMechanic() {
    const active=state.hazard.current.active,color=state.map.mechanic.color;ctx.save();
    if(state.map.id==='tuesday'&&active){state.links.filter((_,i)=>i%3===0).forEach(pair=>{const a=state.anchors[pair[0]],b=state.anchors[pair[1]],x=(a.x+b.x)/2,y=(a.y+b.y)/2;ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,22+Math.sin(state.elapsed*5)*5,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(state.elapsed*4)*17,y+Math.sin(state.elapsed*4)*17);ctx.stroke();});}
    if(state.map.id==='gargoyle-garage'){state.anchors.forEach((anchor,index)=>{if(index%2)return;const hot=state.hazard.hotAnchors.includes(anchor);ctx.fillStyle=hot?color:'#171a2b';ctx.strokeStyle=hot?'#fff4d2':'#65708b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(anchor.x-13,anchor.y-38);ctx.lineTo(anchor.x,anchor.y-58);ctx.lineTo(anchor.x+13,anchor.y-38);ctx.lineTo(anchor.x+8,anchor.y-18);ctx.lineTo(anchor.x-8,anchor.y-18);ctx.closePath();ctx.fill();ctx.stroke();if(hot){ctx.strokeStyle=color;ctx.beginPath();ctx.arc(anchor.x,anchor.y,150+Math.sin(state.elapsed*4)*5,0,Math.PI*2);ctx.stroke();}});}
    if(state.map.id==='royal-table'){state.anchors.forEach((anchor,index)=>{if(index%3)return;ctx.strokeStyle=active?color:'rgba(255,211,106,.34)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(anchor.x,anchor.y+30,34,13,0,0,Math.PI*2);ctx.stroke();for(const side of [-1,1]){ctx.fillStyle=active?'#fff4d2':'#8c7755';ctx.fillRect(anchor.x+side*48-2,anchor.y-36,4,31);ctx.fillStyle=active?color:'#594d3b';ctx.beginPath();ctx.arc(anchor.x+side*48,anchor.y-39,5,0,Math.PI*2);ctx.fill();}});}
    if(state.map.id==='dragon-metro'){ctx.strokeStyle=active?color:'rgba(117,255,209,.18)';ctx.lineWidth=active?9:4;for(let x=180;x<DATA.WORLD.width;x+=250){ctx.beginPath();ctx.arc(x,760,150,Math.PI*1.08,Math.PI*1.92);ctx.stroke();}if(active){ctx.fillStyle='rgba(117,255,209,.09)';ctx.fillRect(0,630,DATA.WORLD.width,260);}}
    if(state.map.id==='cloud-annex'){for(let i=0;i<28;i++){const x=(i*197+state.elapsed*(active?52:15))%DATA.WORLD.width,y=180+(i*113)%1120+Math.sin(state.elapsed*1.8+i)*24;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(state.elapsed+i)*.4);ctx.fillStyle=active?'rgba(155,232,255,.75)':'rgba(200,220,242,.25)';ctx.fillRect(-9,-6,18,12);ctx.strokeStyle=color;ctx.strokeRect(-9,-6,18,12);ctx.restore();}}
    if(state.map.id==='witch-mall'&&active){const direction=state.hazard.current.direction;state.links.forEach((pair,index)=>{const a=state.anchors[pair[0]],b=state.anchors[pair[1]];if(index%2||Math.abs(b.x-a.x)<Math.abs(b.y-a.y)*.6)return;for(const t of [.35,.55,.75]){const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,angle=Math.atan2(b.y-a.y,b.x-a.x)+(direction<0?Math.PI:0);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-10,-8);ctx.lineTo(0,0);ctx.lineTo(-10,8);ctx.stroke();ctx.restore();}});}
    ctx.restore();
  }

  function drawTacticalSignal() {
    const signal=state.tacticalSignal;if(!signal||signal.until<=state.elapsed)return;const anchor=state.anchors.find(item=>item.id===signal.anchorId);if(!anchor)return;
    const color=signal.kind==='pirates'?DATA.COLORS.violet:signal.kind==='wonderwork'?DATA.COLORS.gold:DATA.COLORS.mint,pulse=1-(signal.until-state.elapsed)/9;ctx.save();ctx.translate(anchor.x,anchor.y);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=4;ctx.shadowColor=color;ctx.shadowBlur=16;
    for(let ring=0;ring<3;ring++){ctx.globalAlpha=.8-ring*.22;ctx.beginPath();ctx.arc(0,0,48+ring*24+Math.sin(state.elapsed*5+ring)*7,0,Math.PI*2);ctx.stroke();}
    ctx.globalAlpha=1;ctx.beginPath();ctx.moveTo(0,-108);ctx.lineTo(-13,-78);ctx.lineTo(13,-78);ctx.closePath();ctx.fill();ctx.font='900 13px Arial';ctx.textAlign='center';ctx.fillText(signal.kind==='pirates'?'QM PIRATE RIFT':signal.kind==='wonderwork'?'QM WONDERWORK':'QM RALLY',0,-118);ctx.restore();
  }

  function drawRivalIntent() {
    if(!state.rival||state.rival.phase==='idle')return;const scheme=SYS.rivalScheme(state.rival.schemeId);
    const displayAnchor=visibleRivalAnchorId();let target=displayAnchor&&state.anchors.find(anchor=>anchor.id===displayAnchor);if(!target)target=state.buildings.find(building=>building.id===state.rival.targetId&&building.hp>0);
    if(!target||state.rival.schemeId==='roof-grab'&&!visibleRivalAnchorId())return;
    const pulse=8+Math.sin(state.elapsed*(state.rival.phase==='launched'?7:4))*6;ctx.save();ctx.translate(target.x,target.y);ctx.strokeStyle=scheme.color;ctx.fillStyle=scheme.color;ctx.shadowColor=scheme.color;ctx.shadowBlur=15;ctx.lineWidth=3;ctx.globalAlpha=state.rival.phase==='launched'?.95:.72;
    for(let corner=0;corner<4;corner++){ctx.save();ctx.rotate(corner*Math.PI/2);ctx.beginPath();ctx.moveTo(58+pulse,-22);ctx.lineTo(58+pulse,22);ctx.moveTo(58+pulse,-22);ctx.lineTo(80+pulse,-22);ctx.stroke();ctx.restore();}
    ctx.globalAlpha=1;ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText(state.rival.phase==='launched'?'RIVAL COMMITTED':'RIVAL TARGET',0,-92-pulse);ctx.restore();
  }

  function teamColor(team,factionId){return team===0?state.playerFaction.color:team===1?DATA.COLORS.gold:SYS.faction(factionId).color;}

  function drawWonderwork(spec,color) {
    const t=state.elapsed;ctx.fillStyle='rgba(0,0,0,.36)';ctx.beginPath();ctx.ellipse(0,36,58,23,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#171d35';ctx.fillRect(-45,8,90,34);ctx.strokeStyle=spec.color||color;ctx.lineWidth=4;ctx.strokeRect(-45,8,90,34);ctx.shadowColor=spec.color||color;ctx.shadowBlur=13;
    if(spec.silhouette==='clock'){
      ctx.fillStyle='#11172d';ctx.fillRect(-23,-61,46,70);ctx.strokeRect(-23,-61,46,70);ctx.beginPath();ctx.arc(0,-39,20,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(0,-39);ctx.lineTo(Math.cos(t*.6)*14,-39+Math.sin(t*.6)*14);ctx.moveTo(0,-39);ctx.lineTo(Math.cos(t*2)*10,-39+Math.sin(t*2)*10);ctx.stroke();for(const x of [-34,34]){ctx.beginPath();ctx.arc(x,-4,13,0,Math.PI*2);ctx.stroke();}
    }else if(spec.silhouette==='ghost'){
      ctx.fillStyle='#d9fff4';ctx.globalAlpha=.62;ctx.beginPath();ctx.arc(0,-35,34,Math.PI,0);ctx.lineTo(34,8);ctx.lineTo(20,-1);ctx.lineTo(8,9);ctx.lineTo(-5,-1);ctx.lineTo(-18,9);ctx.lineTo(-34,0);ctx.closePath();ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#11172d';ctx.beginPath();ctx.arc(-12,-35,4,0,Math.PI*2);ctx.arc(12,-35,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle=spec.color;ctx.beginPath();ctx.arc(0,-25,8,.2,Math.PI-.2);ctx.stroke();
    }else if(spec.silhouette==='drydock'){
      ctx.strokeStyle=spec.color;ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,-24,37,-1.1,1.1);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-29,-3);ctx.quadraticCurveTo(0,22,31,-3);ctx.lineTo(18,12);ctx.lineTo(-18,12);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(0,-65);ctx.lineTo(0,2);ctx.lineTo(25,-23);ctx.lineTo(0,-23);ctx.stroke();
    }else if(spec.silhouette==='hedge'){
      ctx.fillStyle='#233f31';for(const p of [[-30,-15,22],[0,-38,29],[31,-14,21]]){ctx.beginPath();ctx.arc(p[0],p[1],p[2],0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.fillStyle=spec.color;ctx.beginPath();ctx.moveTo(-30,-61);ctx.lineTo(-17,-42);ctx.lineTo(0,-67);ctx.lineTo(17,-42);ctx.lineTo(30,-61);ctx.lineTo(24,-29);ctx.lineTo(-24,-29);ctx.closePath();ctx.fill();
    }else if(spec.silhouette==='archive'){
      ctx.fillStyle='#222a45';ctx.fillRect(-34,-57,68,65);ctx.strokeRect(-34,-57,68,65);for(let y=-45;y<2;y+=17){ctx.strokeStyle=spec.color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-22,y);ctx.lineTo(22,y);ctx.moveTo(-27,y-5);ctx.lineTo(-17,y+5);ctx.moveTo(27,y-5);ctx.lineTo(17,y+5);ctx.stroke();}
    }else if(spec.silhouette==='windows'){
      ctx.fillStyle='#11172d';ctx.beginPath();ctx.moveTo(-31,8);ctx.lineTo(-25,-65);ctx.lineTo(0,-82);ctx.lineTo(25,-65);ctx.lineTo(31,8);ctx.closePath();ctx.fill();ctx.stroke();for(let y=-54;y<-2;y+=17)for(let x=-16;x<=16;x+=16){ctx.fillStyle=spec.color;ctx.globalAlpha=.55+.35*Math.sin(t*2+x+y);ctx.fillRect(x-4,y,8,10);}ctx.globalAlpha=1;
    }else if(spec.silhouette==='plot'){
      ctx.fillStyle='#202943';ctx.fillRect(-36,-55,72,63);ctx.strokeRect(-36,-55,72,63);ctx.fillStyle='#11172d';ctx.fillRect(-25,-43,50,47);ctx.fillStyle=spec.color;ctx.font='900 58px Georgia';ctx.textAlign='center';ctx.fillText('!',0,1);ctx.beginPath();ctx.moveTo(-44,-55);ctx.lineTo(0,-78);ctx.lineTo(44,-55);ctx.closePath();ctx.stroke();
    }else{
      ctx.strokeStyle=spec.color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-28,-68);ctx.lineTo(28,-68);ctx.lineTo(-22,4);ctx.lineTo(22,4);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.ellipse(0,-32,34,17,t*.12,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(-14,-60);ctx.lineTo(14,-8);ctx.moveTo(14,-60);ctx.lineTo(-14,-8);ctx.stroke();
    }
    ctx.shadowBlur=0;ctx.fillStyle=spec.color||color;ctx.font='900 10px Arial';ctx.textAlign='center';ctx.fillText(spec.icon,0,31);
  }

  function drawFactionDistrict(building,spec,color) {
    const arch=SYS.districtArchitectureForFaction(building.factionId),kind=building.kind,t=state.elapsed+building.pulse;
    const width=kind==='borough'?84:kind==='moot'?76:kind==='watch'?54:82,top=kind==='watch'?-78:kind==='bridgehead'?-59:kind==='moot'?-55:-49;
    ctx.save();ctx.fillStyle='rgba(0,0,0,.34)';ctx.beginPath();ctx.ellipse(0,35,width*.64,21,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=arch.material;ctx.fillRect(-width/2,-8,width,50);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.strokeRect(-width/2,-8,width,50);
    ctx.strokeStyle=arch.trim;ctx.fillStyle=arch.material;ctx.lineWidth=3;ctx.shadowColor=arch.trim;ctx.shadowBlur=10;
    if(arch.motif==='gears'){
      ctx.beginPath();ctx.moveTo(-width*.58,-8);ctx.lineTo(-width*.34,top+13);ctx.lineTo(-10,top+4);ctx.lineTo(0,top-10);ctx.lineTo(11,top+4);ctx.lineTo(width*.34,top+13);ctx.lineTo(width*.58,-8);ctx.closePath();ctx.fill();ctx.stroke();
      for(const x of [-width*.28,width*.28]){ctx.beginPath();ctx.arc(x,top+23,10,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x,top+23,3,0,Math.PI*2);ctx.fillStyle=arch.trim;ctx.fill();}
    }else if(arch.motif==='paperwork'){
      ctx.beginPath();ctx.moveTo(-width*.55,-8);ctx.quadraticCurveTo(-width*.42,top-12,0,top-15);ctx.quadraticCurveTo(width*.42,top-12,width*.55,-8);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.globalAlpha=.72;for(const p of [[-width*.42,top+4,-.2],[width*.38,top-9,.18],[width*.52,top+17,-.12]]){ctx.save();ctx.translate(p[0],p[1]+Math.sin(t*2+p[0]) *3);ctx.rotate(p[2]);ctx.fillStyle=arch.light;ctx.fillRect(-6,-4,12,8);ctx.strokeRect(-6,-4,12,8);ctx.restore();}ctx.globalAlpha=1;
    }else if(arch.motif==='rigging'){
      ctx.beginPath();ctx.moveTo(-width*.58,-8);ctx.quadraticCurveTo(-width*.36,top+8,0,top+18);ctx.quadraticCurveTo(width*.36,top+8,width*.58,-8);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,top-24);ctx.lineTo(0,8);ctx.moveTo(-2,top-18);ctx.lineTo(-width*.42,top+16);ctx.lineTo(-2,top+14);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(4,top-13);ctx.lineTo(width*.4,top+20);ctx.lineTo(4,top+15);ctx.closePath();ctx.stroke();
    }else if(arch.motif==='briars'){
      ctx.fillStyle=arch.material;for(const p of [[-width*.34,top+24,20],[0,top+10,25],[width*.34,top+24,20]]){ctx.beginPath();ctx.arc(p[0],p[1],p[2],0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.fillStyle=arch.trim;ctx.beginPath();ctx.moveTo(-29,top+7);ctx.lineTo(-16,top+22);ctx.lineTo(0,top-5);ctx.lineTo(16,top+22);ctx.lineTo(29,top+7);ctx.lineTo(23,top+34);ctx.lineTo(-23,top+34);ctx.closePath();ctx.globalAlpha=.72;ctx.fill();ctx.globalAlpha=1;
    }else if(arch.motif==='bones'){
      ctx.fillStyle=arch.material;ctx.fillRect(-width*.43,top+12,width*.86,-top-20);ctx.strokeRect(-width*.43,top+12,width*.86,-top-20);ctx.fillRect(-width*.31,top-3,width*.62,18);ctx.strokeRect(-width*.31,top-3,width*.62,18);
      ctx.strokeStyle=arch.light;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-20,top+18);ctx.lineTo(20,top+42);ctx.moveTo(20,top+18);ctx.lineTo(-20,top+42);ctx.stroke();
    }else if(arch.motif==='windows'){
      ctx.beginPath();ctx.moveTo(-width*.54,-8);ctx.lineTo(-width*.38,top+8);ctx.lineTo(-width*.2,top+15);ctx.lineTo(0,top-8);ctx.lineTo(width*.2,top+15);ctx.lineTo(width*.38,top+8);ctx.lineTo(width*.54,-8);ctx.closePath();ctx.fill();ctx.stroke();
      for(const x of [-width*.38,width*.38]){ctx.fillStyle=arch.material;ctx.fillRect(x-7,top-5,14,27);ctx.strokeRect(x-7,top-5,14,27);ctx.beginPath();ctx.moveTo(x-9,top-5);ctx.lineTo(x,top-18);ctx.lineTo(x+9,top-5);ctx.stroke();}
    }else if(arch.motif==='patches'){
      ctx.beginPath();ctx.moveTo(-width*.58,-8);ctx.lineTo(-width*.42,top+12);ctx.lineTo(-8,top-2);ctx.lineTo(12,top+9);ctx.lineTo(width*.4,top-7);ctx.lineTo(width*.58,-8);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle=arch.light;ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(-width*.47,28);ctx.lineTo(width*.45,top+2);ctx.moveTo(-width*.38,top+10);ctx.lineTo(width*.48,26);ctx.stroke();ctx.setLineDash([]);for(const x of [-width*.48,width*.48]){ctx.beginPath();ctx.moveTo(x,38);ctx.lineTo(x,top+4);ctx.stroke();}
    }else{
      ctx.globalAlpha=.34;ctx.strokeStyle=arch.light;ctx.strokeRect(-width/2+8,-15,width,48);ctx.globalAlpha=1;ctx.fillStyle=arch.material;ctx.beginPath();ctx.moveTo(-width*.54,-8);ctx.lineTo(-width*.22,top+7);ctx.lineTo(0,top-12);ctx.lineTo(width*.22,top+7);ctx.lineTo(width*.54,-8);ctx.closePath();ctx.fill();ctx.strokeStyle=arch.trim;ctx.stroke();ctx.beginPath();ctx.moveTo(-15,top+2);ctx.lineTo(15,top+34);ctx.moveTo(15,top+2);ctx.lineTo(-15,top+34);ctx.stroke();
    }
    ctx.shadowBlur=0;
    const windowCount=kind==='borough'?3:kind==='watch'?1:2;for(let index=0;index<windowCount;index++){const x=(index-(windowCount-1)/2)*23;ctx.fillStyle=arch.light;ctx.globalAlpha=.58+.28*Math.sin(t*2+index);ctx.fillRect(x-5,10,10,15);}ctx.globalAlpha=1;
    if(kind==='moot'){ctx.fillStyle='#0c1020';ctx.beginPath();ctx.arc(0,34,15,Math.PI,0);ctx.lineTo(15,42);ctx.lineTo(-15,42);ctx.closePath();ctx.fill();ctx.strokeStyle=arch.trim;ctx.stroke();}
    if(kind==='watch'){ctx.beginPath();ctx.arc(0,top-17,15,0,Math.PI*2);ctx.fillStyle='#0c1020';ctx.fill();ctx.strokeStyle=arch.light;ctx.lineWidth=4;ctx.stroke();ctx.beginPath();ctx.arc(5,top-20,10,0,Math.PI*2);ctx.strokeStyle=arch.trim;ctx.globalAlpha=.45;ctx.stroke();ctx.globalAlpha=1;}
    if(kind==='bridgehead'){ctx.fillStyle=color;ctx.fillRect(-3,top-34,6,43);ctx.beginPath();ctx.moveTo(3,top-33);ctx.lineTo(36,top-21);ctx.lineTo(3,top-7);ctx.fill();ctx.strokeStyle=arch.trim;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,30,23,Math.PI,0);ctx.stroke();}
    if(spec.conversionId==='thirteenth-hour-union-hall'){ctx.strokeStyle=arch.light;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,top+20,24,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,top+20);ctx.lineTo(0,top+2);ctx.moveTo(0,top+20);ctx.lineTo(15,top+28);ctx.stroke();ctx.fillStyle=arch.trim;ctx.font='900 10px Arial';ctx.textAlign='center';ctx.fillText('XIII',0,top+24);}
    if(spec.conversionId==='spectral-census-bureau'){ctx.fillStyle=arch.light;ctx.globalAlpha=.86;for(const x of [-16,0,16]){ctx.fillRect(x-6,1,12,18);ctx.strokeStyle=arch.trim;ctx.strokeRect(x-6,1,12,18);}ctx.globalAlpha=1;ctx.strokeStyle=arch.light;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,top-34);ctx.lineTo(0,top-17);ctx.moveTo(-10,top-30);ctx.quadraticCurveTo(0,top-42,10,top-30);ctx.stroke();ctx.fillStyle=arch.trim;ctx.beginPath();ctx.arc(0,top-35,4,0,Math.PI*2);ctx.fill();}
    if(spec.conversionId==='black-sail-anchorage'){ctx.strokeStyle=arch.light;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-34,30);ctx.quadraticCurveTo(0,49,34,30);ctx.stroke();ctx.beginPath();ctx.moveTo(0,top-31);ctx.lineTo(0,8);ctx.lineTo(31,top+7);ctx.lineTo(1,top+10);ctx.closePath();ctx.stroke();}
    if(spec.conversionId==='briarway-gatehouse'){ctx.strokeStyle=arch.trim;ctx.lineWidth=4;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*31,35);ctx.quadraticCurveTo(side*54,-3,side*26,top+3);ctx.stroke();for(const y of [20,-2,top+20]){ctx.fillStyle=arch.light;ctx.beginPath();ctx.ellipse(side*(34+Math.abs(y)%8),y,8,4,side*.55,0,Math.PI*2);ctx.fill();}}}
    if(spec.conversionId==='last-rites-exchange'){ctx.strokeStyle=arch.light;ctx.fillStyle=arch.trim;ctx.lineWidth=3;ctx.strokeRect(-29,top+2,58,38);for(const y of [top+12,top+23,top+34]){ctx.beginPath();ctx.moveTo(-23,y);ctx.lineTo(23,y);ctx.stroke();for(const x of [-15,0,15]){ctx.beginPath();ctx.arc(x+(y===top+23?5:0),y,4,0,Math.PI*2);ctx.fill();}}ctx.fillStyle=arch.light;ctx.beginPath();ctx.arc(0,top-8,11,0,Math.PI*2);ctx.fill();ctx.fillStyle=arch.material;ctx.beginPath();ctx.arc(-4,top-10,2.5,0,Math.PI*2);ctx.arc(4,top-10,2.5,0,Math.PI*2);ctx.fill();}
    if(spec.conversionId==='foreground-spotlight'){ctx.strokeStyle=arch.light;ctx.fillStyle=arch.trim;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-27,top+5);ctx.lineTo(-27,31);ctx.moveTo(27,top+5);ctx.lineTo(27,31);ctx.moveTo(-34,top+7);ctx.lineTo(34,top+7);ctx.stroke();for(const x of [-20,0,20]){ctx.beginPath();ctx.arc(x,top+7,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x-5,top+13);ctx.lineTo(x-13,8);ctx.lineTo(x+13,8);ctx.closePath();ctx.globalAlpha=.18;ctx.fill();ctx.globalAlpha=1;}}
    if(spec.conversionId==='every-window-assembly'){ctx.strokeStyle=arch.light;ctx.fillStyle=arch.trim;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-39,3);ctx.lineTo(0,top-27);ctx.lineTo(39,3);ctx.closePath();ctx.stroke();for(const x of [-28,-14,0,14,28]){ctx.fillRect(x-4,5,8,13);ctx.strokeRect(x-4,5,8,13);}for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*31,-5);ctx.lineTo(side*31,top-10);ctx.lineTo(side*20,top-3);ctx.closePath();ctx.stroke();}}
    if(spec.conversionId==='department-of-later'){ctx.strokeStyle=arch.light;ctx.fillStyle=arch.trim;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,top-15,20,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,top-15);ctx.lineTo(0,top-30);ctx.moveTo(0,top-15);ctx.lineTo(14,top-5);ctx.stroke();for(const x of [-23,23]){ctx.fillRect(x-6,top+7,12,19);ctx.strokeRect(x-6,top+7,12,19);}}
    const districtLabel=spec.conversionId==='thirteenth-hour-union-hall'?'UNION XIII':spec.conversionId==='spectral-census-bureau'?'CENSUS':spec.conversionId==='black-sail-anchorage'?'ANCHORAGE':spec.conversionId==='briarway-gatehouse'?'BRIARWAY':spec.conversionId==='last-rites-exchange'?'LAST RITES':spec.conversionId==='foreground-spotlight'?'FOREGROUND':spec.conversionId==='every-window-assembly'?'ASSEMBLY':spec.conversionId==='department-of-later'?'LATER':arch.id.split('-')[0].toUpperCase();ctx.fillStyle=arch.trim;ctx.font='900 9px Arial';ctx.textAlign='center';ctx.fillText(districtLabel,0,32);ctx.restore();
  }

  function drawBuilding(building) {
    const color=teamColor(building.team,building.factionId),scale=.45+.55*building.progress;ctx.save();ctx.translate(building.x,building.y);ctx.scale(scale,scale);ctx.globalAlpha=.45+.55*building.progress;
    if(building.kind==='command'){ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(0,34,72,28,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#222a45';ctx.fillRect(-50,-18,100,62);ctx.fillStyle='#13182d';ctx.beginPath();ctx.moveTo(-60,-18);ctx.lineTo(0,-82);ctx.lineTo(60,-18);ctx.closePath();ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();ctx.beginPath();ctx.arc(0,-20,31,0,Math.PI*2);ctx.fillStyle='#0a0d1c';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle=DATA.COLORS.cream;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(0,-42);ctx.moveTo(0,-20);ctx.lineTo(17,-9);ctx.stroke();ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=16;ctx.beginPath();ctx.arc(0,-20,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    else if(building.kind==='wonderwork')drawWonderwork(SYS.wonderworkForFaction(building.factionId),color);
    else drawFactionDistrict(building,SYS.buildingSpec(building.kind,building.factionId),color);
    if(building.kind!=='command'&&building.charterId){const charter=SYS.charter(building.charterId),bonus=SYS.districtNetworkBonus(building,state.buildings),sigilY=building.kind==='watch'?-116:building.kind==='wonderwork'?-96:building.kind==='bridgehead'?-105:building.kind==='moot'?-82:-78;ctx.globalAlpha=.92;ctx.fillStyle=charter.color;ctx.shadowColor=charter.color;ctx.shadowBlur=12;ctx.textAlign='center';ctx.font='900 16px Arial';ctx.fillText(charter.icon,0,sigilY);ctx.shadowBlur=0;if(bonus>1){ctx.strokeStyle=charter.color;ctx.globalAlpha=.32+.12*Math.sin(state.elapsed*3+building.pulse);ctx.lineWidth=3;ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(0,28,48+bonus*3,21+bonus*2,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}}
    ctx.restore(); drawHealth(building,building.kind==='command'?84:building.kind==='wonderwork'?72:58,building.kind==='command'?70:building.kind==='wonderwork'?65:50);
  }

  function drawSquad(squad) {
    const color=teamColor(squad.team,squad.factionId),selected=state.selected.has(squad.id);ctx.save();ctx.translate(squad.x,squad.y);
    if(selected){ctx.beginPath();ctx.ellipse(0,9,32,20,0,0,Math.PI*2);ctx.strokeStyle=DATA.COLORS.mint;ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);}
    const civicCover=SYS.districtCivicCoverDamageMultiplier(squad,state.buildings,state.elapsed);if(civicCover.multiplier<1){ctx.save();ctx.strokeStyle=DATA.COLORS.gold;ctx.fillStyle='rgba(255,212,71,.12)';ctx.lineWidth=3;ctx.globalAlpha=.88;ctx.beginPath();for(let corner=0;corner<8;corner++){const angle=-Math.PI/2+corner/8*Math.PI*2,x=Math.cos(angle)*39,y=8+Math.sin(angle)*27;if(corner===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=DATA.COLORS.gold;ctx.font='900 10px Arial';ctx.textAlign='center';ctx.fillText('CIVIC COVER '+Math.round(civicCover.damageReduction*1000)/10+'%',0,-38);ctx.restore();}
    if(squad.unionShiftUntil>state.elapsed){ctx.save();ctx.strokeStyle=DATA.COLORS.orange;ctx.fillStyle=DATA.COLORS.orange;ctx.lineWidth=3;ctx.globalAlpha=.8;ctx.beginPath();ctx.ellipse(0,8,39+Math.sin(state.elapsed*9)*3,26,0,0,Math.PI*2);ctx.stroke();for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*43,-9);ctx.lineTo(side*32,-2);ctx.lineTo(side*43,5);ctx.stroke();}ctx.font='900 10px Arial';ctx.textAlign='center';ctx.fillText('XIII ×'+Number(squad.unionShiftMoveMultiplier||1).toFixed(2),0,-39);ctx.restore();}
    if(squad.temporalAdjournedUntil>state.elapsed){ctx.save();ctx.strokeStyle=DATA.COLORS.cyan;ctx.fillStyle=SYS.faction('temporal-mischief').color;ctx.lineWidth=3;ctx.globalAlpha=.88;ctx.setLineDash([2,5]);ctx.beginPath();ctx.ellipse(0,8,41+Math.sin(state.elapsed*8)*3,28,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(const side of [-1,1]){ctx.fillRect(side*34-4,-17,8,35);ctx.strokeRect(side*34-4,-17,8,35);}ctx.font='900 10px Arial';ctx.textAlign='center';ctx.fillText('FILED: LATER',0,-41);ctx.restore();}
    if(squad.ghost){ctx.shadowColor=DATA.COLORS.violet;ctx.shadowBlur=16;ctx.globalAlpha=.82;}
    const unit=SYS.unit(squad.unitId),presentation=SYS.doctrineUnitPresentation(squad.unitId,squad.factionId,squad.doctrineId),formation=SYS.coreFormationPresentation(squad.unitId,squad.factionId);
    if(presentation.doctrineId&&!unit.signatureOf){ctx.save();ctx.globalAlpha=.72;ctx.strokeStyle=presentation.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,8,34,22,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=presentation.color;ctx.textAlign='center';ctx.font='900 13px Arial';ctx.fillText(presentation.icon,0,-31);ctx.restore();}
    if(unit.signatureOf){ctx.save();ctx.globalAlpha=.58;ctx.strokeStyle=unit.color;ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(0,8,35,23,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=unit.color;ctx.textAlign='center';ctx.font='900 14px Arial';ctx.fillText(unit.icon,0,-32);if(squad.deadlineHaste>0){ctx.globalAlpha=.75;for(let y=-14;y<=16;y+=10){ctx.beginPath();ctx.moveTo(-39,y);ctx.lineTo(-25,y);ctx.stroke();}}ctx.restore();}
    if(formation)drawFormationStandard(formation);
    for(let i=0;i<squad.members;i++){const point=formationFighterPosition(i,squad.members,formation,squad.wobble);drawFighter(point.x,point.y,unit,color,squad.facing,i,formation);}
    ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.restore();drawHealth(squad,38,27);
  }

  function formationFighterPosition(index,members,formation,wobble){
    const bob=Math.sin(wobble*4+index)*1.2;
    if(!formation){const columns=Math.ceil(Math.sqrt(members)),row=Math.floor(index/columns),col=index%columns;return{x:(col-(Math.min(columns,members-row*columns)-1)/2)*12,y:(row-(Math.ceil(members/columns)-1)/2)*11+bob};}
    if(formation.formation==='wedge'){
      let row=0,start=0;while(index>=start+row+1){start+=row+1;row+=1;}const count=row+1,col=index-start,rows=Math.ceil((Math.sqrt(8*members+1)-1)/2);
      return{x:(col-(count-1)/2)*13,y:(row-(rows-1)/2)*10+bob};
    }
    const columns=formation.formation==='ranks'?4:formation.formation==='diamond'?3:Math.min(6,members),row=Math.floor(index/columns),col=index%columns,current=Math.min(columns,members-row*columns),rows=Math.ceil(members/columns);
    const spread=formation.formation==='diamond'?16:formation.formation==='ranks'?15:11,depth=formation.formation==='diamond'?13:formation.formation==='wall'?9:11,stagger=formation.formation==='diamond'&&row%2?5:0;
    return{x:(col-(current-1)/2)*spread+stagger,y:(row-(rows-1)/2)*depth+bob};
  }

  function drawFormationStandard(formation){
    ctx.save();ctx.translate(-42,-4);ctx.globalAlpha=.92;ctx.strokeStyle=formation.trim;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-26);ctx.lineTo(0,25);ctx.stroke();ctx.fillStyle=formation.light;ctx.beginPath();ctx.arc(0,-27,2.4,0,Math.PI*2);ctx.fill();ctx.fillStyle=formation.material;ctx.strokeStyle=formation.trim;ctx.lineWidth=1.6;ctx.beginPath();
    if(formation.banner==='pennant'){ctx.moveTo(0,-24);ctx.lineTo(29,-16);ctx.lineTo(0,-8);}
    else if(formation.banner==='gonfalon'){ctx.moveTo(0,-24);ctx.lineTo(19,-24);ctx.lineTo(19,2);ctx.lineTo(10,10);ctx.lineTo(0,2);}
    else if(formation.banner==='square'){ctx.rect(0,-24,23,17);}
    else if(formation.banner==='double-tail'){ctx.moveTo(0,-24);ctx.lineTo(27,-24);ctx.lineTo(20,-17);ctx.lineTo(28,-12);ctx.lineTo(20,-7);ctx.lineTo(0,-7);}
    else if(formation.banner==='ragged'){ctx.moveTo(0,-24);ctx.lineTo(26,-24);ctx.lineTo(21,-20);ctx.lineTo(28,-16);ctx.lineTo(20,-12);ctx.lineTo(26,-8);ctx.lineTo(0,-8);}
    else if(formation.banner==='split'){ctx.moveTo(0,-24);ctx.lineTo(27,-24);ctx.lineTo(17,-16);ctx.lineTo(27,-8);ctx.lineTo(0,-8);ctx.lineTo(9,-16);}
    else if(formation.banner==='notched'){ctx.moveTo(0,-24);ctx.lineTo(26,-24);ctx.lineTo(22,-20);ctx.lineTo(26,-16);ctx.lineTo(22,-12);ctx.lineTo(26,-8);ctx.lineTo(0,-8);}
    else{ctx.moveTo(0,-24);ctx.lineTo(27,-24);ctx.lineTo(20,-16);ctx.lineTo(27,-8);ctx.lineTo(0,-8);}
    ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=formation.light;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 5px Arial';ctx.fillText(formation.emblem,11.5,-16);ctx.restore();
  }

  function drawFormationHeadgear(formation){
    ctx.strokeStyle=formation.light;ctx.fillStyle=formation.material;ctx.lineWidth=1.2;ctx.beginPath();
    if(formation.headgear==='cog-cap'){ctx.arc(0,-6.5,4.5,Math.PI,Math.PI*2);ctx.stroke();for(let a=0;a<Math.PI*2;a+=Math.PI/2){ctx.beginPath();ctx.moveTo(Math.cos(a)*3.5,Math.sin(a)*3.5-4);ctx.lineTo(Math.cos(a)*5,Math.sin(a)*5-4);ctx.stroke();}}
    else if(formation.headgear==='file-hood'){ctx.arc(0,-4,5.2,Math.PI*.82,Math.PI*2.18);ctx.stroke();ctx.fillRect(2.5,-10,3,2.5);}
    else if(formation.headgear==='tricorn'){ctx.moveTo(-5,-7);ctx.lineTo(0,-12);ctx.lineTo(5,-7);ctx.closePath();ctx.fill();ctx.stroke();}
    else if(formation.headgear==='thorn-crown'){ctx.moveTo(-5,-7);ctx.lineTo(-3,-12);ctx.lineTo(0,-8);ctx.lineTo(2,-13);ctx.lineTo(5,-7);ctx.stroke();}
    else if(formation.headgear==='skull-helm'){ctx.arc(0,-4,4.6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#090b1a';ctx.fillRect(-2.7,-5.5,1.6,1.7);ctx.fillRect(1.1,-5.5,1.6,1.7);}
    else if(formation.headgear==='lantern-helm'){ctx.rect(-4.5,-9,9,8);ctx.fill();ctx.stroke();ctx.fillStyle=formation.light;ctx.fillRect(-2.2,-7,4.4,3.8);}
    else if(formation.headgear==='patch-cap'){ctx.moveTo(-5,-7);ctx.lineTo(1,-11);ctx.lineTo(5,-7);ctx.lineTo(-1,-8);ctx.closePath();ctx.fill();ctx.stroke();}
    else if(formation.headgear==='hourglass-visor'){ctx.moveTo(-4,-9);ctx.lineTo(4,-9);ctx.lineTo(-3,-1);ctx.lineTo(3,-1);ctx.closePath();ctx.stroke();ctx.globalAlpha*=.45;ctx.strokeRect(-2,-10,8,10);}
  }

  function drawFighter(x,y,unit,color,facing,index,formation){
    ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(0,5,5,3,0,0,Math.PI*2);ctx.fill();
    if(formation&&formation.motif==='echoes'){ctx.globalAlpha=.35;ctx.strokeStyle=formation.light;ctx.strokeRect(2,-9,7,15);ctx.globalAlpha=1;}
    const trim=formation?formation.trim:color,light=formation?formation.light:(index%2?'#d8e0ef':color),material=formation?formation.material:color;
    if(unit.id==='lanterns'){ctx.fillStyle=material;ctx.fillRect(-4.5,-1,9,8);ctx.strokeStyle=trim;ctx.lineWidth=1.4;ctx.strokeRect(-4.5,-1,9,8);}else{ctx.strokeStyle=light;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(0,-1);ctx.lineTo(0,6);ctx.stroke();}
    ctx.fillStyle=trim;ctx.beginPath();ctx.arc(0,-4,3.5,0,Math.PI*2);ctx.fill();if(formation)drawFormationHeadgear(formation);
    if(unit.id==='hexbows'){ctx.strokeStyle=light;ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(Math.cos(facing)*3,1,5,-1.3,1.3);ctx.stroke();ctx.beginPath();ctx.moveTo(-1,-3);ctx.lineTo(5,5);ctx.stroke();}
    else if(unit.id==='brooms'){ctx.strokeStyle=light;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,6);ctx.lineTo(7,-5);ctx.stroke();ctx.strokeStyle=trim;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-6+i,6);ctx.lineTo(-9+i,8);ctx.stroke();}}
    else if(unit.id==='lanterns'){ctx.fillStyle=formation?formation.light:DATA.COLORS.gold;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=6;ctx.fillRect(-2.6,1,5.2,4.2);ctx.shadowBlur=0;ctx.strokeStyle=trim;ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(7,-5);ctx.stroke();}
    else{ctx.strokeStyle=light;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(7,-6);ctx.stroke();}
    ctx.restore();
  }

  function drawHealth(entity,width,offset) {const screenVisible=entity.team!==2||SYS.exploredAt(state.visible,entity.x,entity.y,80);if(!screenVisible)return;const ratio=entity.hp/entity.maxHp;if(ratio>=.995&&!state.selected.has(entity.id)&&entity.kind!=='command')return;ctx.fillStyle='rgba(3,5,12,.75)';ctx.fillRect(entity.x-width/2,entity.y-offset,width,5);ctx.fillStyle=ratio>.55?DATA.COLORS.mint:ratio>.25?DATA.COLORS.gold:DATA.COLORS.danger;ctx.fillRect(entity.x-width/2+1,entity.y-offset+1,(width-2)*ratio,3);}

  function drawFog() {
    const cell=80;const left=Math.floor((state.camera.x-innerWidth/(2*state.camera.zoom))/cell)-1,right=Math.ceil((state.camera.x+innerWidth/(2*state.camera.zoom))/cell)+1;const top=Math.floor((state.camera.y-innerHeight/(2*state.camera.zoom))/cell)-1,bottom=Math.ceil((state.camera.y+innerHeight/(2*state.camera.zoom))/cell)+1;
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const key=y+':'+x;if(state.visible[key])continue;ctx.fillStyle=state.explored[key]?'rgba(5,7,17,.16)':'rgba(3,4,12,.45)';ctx.fillRect(x*cell-1,y*cell-1,cell+2,cell+2);}
  }

  function projectile(x,y,tx,ty,color){state.particles.push({type:'projectile',x,y,tx,ty,color,life:.24,max:.24});}
  function burst(x,y,color,count){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*90;state.particles.push({type:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,color,life:.45+Math.random()*.45,max:1});}}
  function floatText(x,y,text,color){state.particles.push({type:'text',x,y,text,color,life:1.15,max:1.15});}
  function updateParticles(dt){for(const p of state.particles){p.life-=dt;if(p.type==='spark'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;}if(p.type==='projectile'){const t=1-p.life/p.max;p.cx=p.x+(p.tx-p.x)*t;p.cy=p.y+(p.ty-p.y)*t;}}state.particles=state.particles.filter(p=>p.life>0);}
  function drawParticles(){for(const p of state.particles){ctx.globalAlpha=SYS.clamp(p.life/p.max,0,1);if(p.type==='spark'){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();}if(p.type==='projectile'){ctx.strokeStyle=p.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.cx,p.cy);ctx.lineTo(p.cx-(p.tx-p.x)*.04,p.cy-(p.ty-p.y)*.04);ctx.stroke();}if(p.type==='text'){ctx.fillStyle=p.color;ctx.font='800 16px Arial';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y-(1-p.life/p.max)*35);}}ctx.globalAlpha=1;}
  function drawOrders(){const selected=selectedSquads();selected.forEach((squad,index)=>{if(Math.hypot(squad.tx-squad.x,squad.ty-squad.y)<=20)return;const waypoints=[...(squad.route||[]),{x:squad.tx,y:squad.ty}];ctx.save();ctx.strokeStyle=index===0?'rgba(117,255,209,.62)':'rgba(117,255,209,.18)';ctx.lineWidth=index===0?2:1;ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(squad.x,squad.y);waypoints.forEach(point=>ctx.lineTo(point.x,point.y));ctx.stroke();ctx.setLineDash([]);for(const point of squad.route||[]){ctx.save();ctx.translate(point.x,point.y);ctx.rotate(Math.PI/4);ctx.strokeRect(-6,-6,12,12);ctx.restore();}ctx.beginPath();ctx.arc(squad.tx,squad.ty,8+Math.sin(state.elapsed*5)*2,0,Math.PI*2);ctx.stroke();if(index===0&&squad.route&&squad.route.length){const first=squad.route[0];ctx.fillStyle=DATA.COLORS.mint;ctx.font='900 10px Arial';ctx.textAlign='center';ctx.fillText('BRIDGE ROUTE · '+squad.route.length+' HOPS',first.x,first.y-19);}ctx.restore();});}

  function drawMinimap(){const w=minimap.width,h=minimap.height;mctx.fillStyle='#070914';mctx.fillRect(0,0,w,h);const sx=w/DATA.WORLD.width,sy=h/DATA.WORLD.height;mctx.strokeStyle='rgba(125,146,186,.3)';mctx.lineWidth=1;state.anchors.forEach(a=>{mctx.beginPath();mctx.arc(a.x*sx,a.y*sy,3,0,Math.PI*2);mctx.stroke();});state.buildings.filter(b=>b.hp>0&&(b.team!==2||SYS.exploredAt(state.explored,b.x,b.y,80))).forEach(b=>{mctx.fillStyle=teamColor(b.team,b.factionId);mctx.fillRect(b.x*sx-2,b.y*sy-2,5,5);});state.squads.filter(s=>s.hp>0&&(s.team!==2||SYS.exploredAt(state.visible,s.x,s.y,80))).forEach(s=>{mctx.fillStyle=teamColor(s.team,s.factionId);mctx.fillRect(s.x*sx-1,s.y*sy-1,3,3);});const vw=innerWidth/state.camera.zoom*sx,vh=(innerHeight-196)/state.camera.zoom*sy;mctx.strokeStyle=DATA.COLORS.cream;mctx.strokeRect(state.camera.x*sx-vw/2,state.camera.y*sy-vh/2,vw,vh);}

  function updateHud(force) {
    if(state.phase!=='battle')return;ui.glow.textContent=Math.floor(state.resources.glow);ui.scrap.textContent=Math.floor(state.resources.scrap);ui.essence.textContent=Math.floor(state.resources.essence);ui.glowRate.textContent='+'+state.income.glow.toFixed(1)+'/s';ui.scrapRate.textContent='+'+state.income.scrap.toFixed(1)+'/s';ui.population.textContent=population()+' / '+state.income.cap;ui.clock.textContent=formatTime(state.elapsed);ui.mapName.textContent=state.map.name;
    const enemy=state.buildings.find(b=>b.team===2&&b.kind==='command');ui.enemyClockHp.style.width=(enemy?enemy.hp/enemy.maxHp*100:0)+'%';updateMechanicHud();updateRivalHud();updateSelectionPanel();if(force||state.currentTab==='essence'||state.queue.length)renderCards();
  }

  function updateMechanicHud(){const mechanic=state.map.mechanic,current=state.hazard.current||SYS.mapMechanicState(state.map.id,state.elapsed);ui.hazardPanel.style.setProperty('--hazard',mechanic.color);ui.hazardPanel.classList.toggle('active',current.active);ui.hazardPanel.classList.toggle('warning',current.warning);ui.hazardIcon.textContent=mechanic.icon;ui.hazardTitle.textContent=mechanic.title;let label=current.active?'ACTIVE · '+Math.ceil(current.nextIn)+'s':current.warning?'INCOMING · '+Math.ceil(current.nextIn)+'s':'NEXT SHIFT · '+Math.ceil(current.nextIn)+'s';if(state.map.id==='witch-mall'&&current.active)label=(current.direction>0?'EASTBOUND':'WESTBOUND')+' · '+Math.ceil(current.nextIn)+'s';ui.hazardPhase.textContent=label;ui.hazardCopy.textContent=current.active?mechanic.effect:mechanic.counterplay;const fraction=current.active?current.nextIn/mechanic.duration:1-Math.min(1,current.nextIn/mechanic.period);ui.hazardBar.style.width=(SYS.clamp(fraction,0,1)*100)+'%';}

  function updateRivalHud(){const scheme=SYS.rivalScheme(state.rival.schemeId),phase=state.rival.phase;ui.rivalPanel.style.setProperty('--rival',scheme.color);ui.rivalPanel.classList.toggle('staging',phase==='staging');ui.rivalPanel.classList.toggle('launched',phase==='launched');ui.rivalIcon.textContent=scheme.icon;ui.rivalKicker.textContent='RIVAL SCHEME · '+scheme.kicker;ui.rivalTitle.textContent=scheme.name;ui.rivalPhase.textContent=(phase==='staging'?'STAGING':'COMMITTED')+' · '+Math.ceil(state.rival.countdown)+'s';ui.rivalCopy.textContent=scheme.counterplay;ui.rivalTarget.textContent=rivalDisplayLabel().toUpperCase();}

  function updateSelectionPanel(){const selected=selectedSquads();if(!selected.length){ui.selectionIcon.textContent=state.playerFaction.sigil;ui.selectionKicker.textContent=state.doctrineId?SYS.doctrine(state.doctrineId).name.toUpperCase():'YOUR WAR BAND';ui.selectionName.textContent='No squads selected';ui.selectionDetail.textContent='Drag a box across squads, or press 1 for the whole army.';ui.selectionHealth.style.width='0%';return;}const members=selected.reduce((n,s)=>n+s.members,0),max=selected.reduce((n,s)=>n+s.maxMembers,0),hp=selected.reduce((n,s)=>n+s.hp,0),maxHp=selected.reduce((n,s)=>n+s.maxHp,0),single=selected.length===1?SYS.unit(selected[0].unitId):null,presentation=single?SYS.doctrineUnitPresentation(single.id,selected[0].factionId,selected[0].doctrineId):null,routeHops=Math.max(0,...selected.map(squad=>(squad.route||[]).length)),routeCopy=routeHops?' · bridge route '+routeHops+' hops':'',shifted=selected.filter(squad=>squad.unionShiftUntil>state.elapsed),shiftCopy=shifted.length?' · THIRTEENTH HOUR ×'+Math.max(...shifted.map(squad=>Number(squad.unionShiftMoveMultiplier||1))).toFixed(2):'',unitRole=single?(single.signatureOf?single.passiveLabel:presentation.role):'';ui.selectionIcon.textContent=single?presentation.icon:'⚑';ui.selectionKicker.textContent=single?(presentation.doctrineId?'DOCTRINE FORMATION':'SQUAD SELECTED'):'FORMATION SELECTED';ui.selectionName.textContent=single?presentation.name:selected.length+' squads · '+members+' fighters';ui.selectionDetail.textContent=single?unitRole+' · '+members+'/'+max+' fighters'+routeCopy+shiftCopy:members+'/'+max+' fighters present'+routeCopy+shiftCopy+' · right-click for one shared order';ui.selectionHealth.style.width=(hp/maxHp*100)+'%';}

  function formatTime(seconds){const m=Math.floor(seconds/60),s=Math.floor(seconds%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}

  function showGuide(){showModal('COMMAND CROWDS, NOT CHORES','Every click should change the war.',`<p><b>Left-drag</b> selects squads. <b>Right-click</b> moves them or attacks a visible target. Your logical units are full squads, so individual deaths hurt the formation without creating a micro-management emergency.</p><div class="guide-grid"><div><b>1 · Whole army</b><span>Select every squad. 2 guards, 3 raids, 4 grand-marches.</span></div><div><b>A · Auto-scout</b><span>Broom Patrols seek unexplored rooftops on their own.</span></div><div><b>T · Signature regiment</b><span>Recruit your faction's unique squad. Its battlefield ability is automatic.</span></div><div><b>B · Faction Wonderwork</b><span>Claim one of two faction-exclusive landmarks. Its automatic macro effect grows faster inside a mixed charter wonderweb.</span></div><div><b>5–8 · District charters</b><span>Set one global plan for future roofs. Mix nearby charters to strengthen their wonderweb.</span></div><div><b>9 / 0 · Grand Doctrine</b><span>Ratify one of two faction-exclusive constitutions. It permanently mutates a core formation and an empire lever.</span></div><div><b>Bridge logistics</b><span>Macro orders become visible rooftop routes. Stage beside a good crossing, then let whole formations march.</span></div><div><b>Expansion is economy</b><span>Every claimed roof inherits the active charter. No builders or villagers to babysit.</span></div><div><b>Death is currency</b><span>Every casualty—friend or foe—creates Essence for field summons.</span></div><div><b>No siege spiral</b><span>There are no routine siege engines. Mass, routes, claims and powers decide the war.</span></div><div><b>Fog remembers</b><span>Scouted land stays mapped, but armies vanish when vision leaves.</span></div></div>`,'Back to the war',()=>{ui.modal.classList.add('hidden');state.paused=false;});state.paused=true;}
  function showModal(title,eyebrow,content,button,action){$('#modal-title').textContent=title;$('#modal-eyebrow').textContent=eyebrow;$('#modal-content').innerHTML=content;$('#modal-primary').textContent=button;$('#modal-primary').onclick=action;ui.modal.classList.remove('hidden');}
  function dismissBlockingOverlay(){if(ui.modal.classList.contains('hidden'))return false;if(state.gameOver){$('#modal-primary').click();return true;}ui.modal.classList.add('hidden');state.paused=false;return true;}

  function onPointerDown(event){if(state.phase!=='battle'||state.paused||event.button!==0)return;state.cursor={x:event.clientX,y:event.clientY};const world=screenToWorld(event.clientX,event.clientY);if(state.placement){state.placement.type==='building'?placeBuilding(world):placePower(world);return;}state.drag={startX:event.clientX,startY:event.clientY,currentX:event.clientX,currentY:event.clientY};ui.selectionBox.classList.remove('hidden');}
  function onPointerMove(event){state.cursor={x:event.clientX,y:event.clientY};if(!state.drag)return;state.drag.currentX=event.clientX;state.drag.currentY=event.clientY;const x=Math.min(state.drag.startX,event.clientX),y=Math.min(state.drag.startY,event.clientY),w=Math.abs(state.drag.startX-event.clientX),h=Math.abs(state.drag.startY-event.clientY);Object.assign(ui.selectionBox.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});}
  function onPointerUp(event){if(!state.drag)return;const drag=state.drag;state.drag=null;ui.selectionBox.classList.add('hidden');const minX=Math.min(drag.startX,event.clientX),maxX=Math.max(drag.startX,event.clientX),minY=Math.min(drag.startY,event.clientY),maxY=Math.max(drag.startY,event.clientY);const click=Math.hypot(maxX-minX,maxY-minY)<8;if(!event.shiftKey)state.selected.clear();if(click){const world=screenToWorld(event.clientX,event.clientY);const squad=SYS.nearest(world,state.squads,s=>s.team===0&&SYS.distance(world,s)<32);if(squad)state.selected.add(squad.id);}else state.squads.filter(s=>s.team===0).forEach(s=>{const p=worldToScreen(s.x,s.y);if(p.x>=minX&&p.x<=maxX&&p.y>=minY&&p.y<=maxY)state.selected.add(s.id);});updateSelectionPanel();sound('select');}
  function onContext(event){event.preventDefault();if(state.phase!=='battle')return;if(state.placement)return cancelPlacement();const selected=selectedSquads();if(!selected.length)return;const world=screenToWorld(event.clientX,event.clientY);const target=SYS.nearest(world,[...state.squads,...state.buildings],e=>isEnemy(0,e.team)&&e.hp>0&&SYS.distance(world,e)<55);selected.forEach((s,i)=>orderSquad(s,world.x+(i%4-1.5)*22,world.y+Math.floor(i/4)*25,target?'fight':'move',target&&target.id));burst(world.x,world.y,target?DATA.COLORS.danger:DATA.COLORS.mint,7);sound('order');}
  function onWheel(event){if(state.phase!=='battle')return;event.preventDefault();const before=screenToWorld(event.clientX,event.clientY);state.camera.zoom=SYS.clamp(state.camera.zoom*(event.deltaY>0?.9:1.1),.42,1.35);const after=screenToWorld(event.clientX,event.clientY);state.camera.x+=before.x-after.x;state.camera.y+=before.y-after.y;}

  function hotkey(event,down){if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;const key=event.key.toLowerCase();state.keys[event.key]=down;if(!down)return;if(key==='escape'){if(event.repeat)return;event.preventDefault();if(state.placement){cancelPlacement();return;}if(dismissBlockingOverlay())return;if(state.phase==='battle'&&!state.gameOver)showGuide();return;}if(event.key==='F1'){event.preventDefault();showGuide();}if(key==='a'&&!event.ctrlKey){state.autoScout=!state.autoScout;ui.autoScout.classList.toggle('active',state.autoScout);feed('Auto-scout '+(state.autoScout?'enabled. Brooms have permission to wander.':'disabled.'),DATA.COLORS.mint);}if(key==='1')applyMacro('army');if(key==='2')applyMacro('guard');if(key==='3')applyMacro('raid');if(key==='4')applyMacro('march');if(['5','6','7','8'].includes(key))setDistrictCharter(DATA.CHARTERS[Number(key)-5].id);if(key==='9'||key==='0'){const choices=SYS.doctrinesForFaction(state.factionId),choice=choices[key==='9'?0:1];if(choice)chooseDoctrine(choice.id);}if(key==='q')train('mobs');if(key==='w')train('hexbows');if(key==='e')train('brooms');if(key==='r')train('lanterns');if(key==='t')train(SYS.signatureForFaction(state.factionId).id);if(key==='z')beginPlacement('borough');if(key==='x')beginPlacement('moot');if(key==='c')beginPlacement('watch');if(key==='v')beginPlacement('bridgehead');if(key==='b')beginPlacement('wonderwork');if(key==='f')usePower('pirates');if(key==='g')usePower('reinforce');if(key==='h')usePower('parade');if(key===' ')focusBattle();}
  function focusBattle(){const combat=state.squads.find(s=>s.team===0&&s.order==='fight');if(combat){state.camera.x=combat.x;state.camera.y=combat.y;}}
  function sound(kind){try{if(!state.audio)state.audio=new(window.AudioContext||window.webkitAudioContext)();const ac=state.audio,o=ac.createOscillator(),g=ac.createGain();const notes={tick:320,select:440,order:180,train:250,ready:620,build:140,power:110,heal:720,start:90,warning:150,victory:520,defeat:70};o.type=kind==='power'?'sawtooth':kind==='ready'||kind==='victory'?'triangle':'sine';o.frequency.setValueAtTime(notes[kind]||220,ac.currentTime);o.frequency.exponentialRampToValueAtTime((notes[kind]||220)*(kind==='defeat'?.55:1.55),ac.currentTime+.14);g.gain.setValueAtTime(.045,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.18);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.2);}catch(_){} }

  $('#enter-war').addEventListener('click',()=>{state.phase='setup';ui.title.classList.add('hidden');ui.warRoom.classList.remove('hidden');sound('start');});
  $('#start-war').addEventListener('click',startBattle);ui.mapSelect.addEventListener('change',updateSetup);ui.enemySelect.addEventListener('change',updateSetup);ui.difficulty.addEventListener('change',updateSetup);
  $$('.mode-switch button').forEach(button=>button.addEventListener('click',()=>{$$('.mode-switch button').forEach(b=>b.classList.remove('active'));button.classList.add('active');state.mode=button.dataset.mode;sound('tick');}));
  $$('.rack-tabs button').forEach(button=>button.addEventListener('click',()=>{$$('.rack-tabs button').forEach(b=>b.classList.remove('active'));button.classList.add('active');state.currentTab=button.dataset.tab;renderCards();sound('tick');}));
  ui.autoScout.addEventListener('click',()=>{state.autoScout=!state.autoScout;ui.autoScout.classList.toggle('active',state.autoScout);});
  $('#pause-button').addEventListener('click',showGuide);$('#help-button').addEventListener('click',showGuide);$('#modal-close').addEventListener('click',dismissBlockingOverlay);
  minimap.addEventListener('click',event=>{const rect=minimap.getBoundingClientRect();state.camera.x=(event.clientX-rect.left)/rect.width*DATA.WORLD.width;state.camera.y=(event.clientY-rect.top)/rect.height*DATA.WORLD.height;});
  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);window.addEventListener('pointerup',onPointerUp);canvas.addEventListener('contextmenu',onContext);canvas.addEventListener('wheel',onWheel,{passive:false});
  window.addEventListener('keydown',event=>hotkey(event,true));window.addEventListener('keyup',event=>hotkey(event,false));window.addEventListener('resize',resize);

  resize(); initSetup(); drawTitleBackdrop();
  function drawTitleBackdrop(){ctx.fillStyle='#090b1a';ctx.fillRect(0,0,innerWidth,innerHeight);}
})();
