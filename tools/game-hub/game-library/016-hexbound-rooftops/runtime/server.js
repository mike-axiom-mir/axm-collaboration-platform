#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8816);
const GAME_ID = '016-hexbound-rooftops';
const GAME_PREFIX = '/games/016/';
const COOP_SCHEMA = 'hexbound.coop-command/v2';
const RELEASE_VERSION = '0.20.0-department-of-later';
const RELEASE_FEATURES = { factionDistrictConversions:8, everyWindowAssemblyCivicCover:true, everyWindowAssemblyPeriodSeconds:13, everyWindowAssemblyDurationSeconds:5, everyWindowAssemblyRange:520, everyWindowAssemblyDamageReduction:.14, everyWindowAssemblyMixedCharterScaling:true, everyWindowAssemblyEffectsStack:false, everyWindowAssemblyProtectsBuildings:false, everyWindowAssemblyBenefitsAiAllies:true, lastRitesExchangeWakeDividend:true, lastRitesExchangeRange:520, lastRitesExchangeEssenceBonus:.55, lastRitesExchangeMixedCharterScaling:true, lastRitesExchangeEffectsStack:false, lastRitesExchangeTargetsBuildings:false, lastRitesExchangeRivalParity:true, rivalSpendsWakeDividends:true, departmentOfLaterDeadlineDeferral:true, departmentOfLaterPeriodSeconds:14, departmentOfLaterDurationSeconds:3, departmentOfLaterMaxDurationSeconds:4.35, departmentOfLaterRange:520, departmentOfLaterMixedCharterDurationScaling:true, departmentOfLaterEffectsStack:false, departmentOfLaterTargetsBuildings:false, departmentOfLaterPreservesOrders:true, departmentOfLaterRivalParity:true };
const MIME = { '.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png' };
const DOCTRINE_IDS = new Set(['midnight-union','borrowed-tomorrow','universal-aftercare','spectral-audit','letters-of-marque','black-sail-logistics','hedge-knight-tour','open-banquet','closed-casket-formation','graveyard-collective','every-window-fortress','tiny-marches','everyone-protagonist','subplot-chorus','preapproved-invasion','deadline-extension']);
const CORE_UNIT_IDS = new Set(['mobs','hexbows','brooms','lanterns']);
const POWER_IDS = new Set(['pirates','reinforce','parade']);
const COMMAND_VALUES = {
  train: new Set(['mobs','hexbows','brooms','lanterns','signature']),
  macro: new Set(['guard','raid','march']),
  charter: new Set(['pumpkin-market','junk-jamboree','impossible-housing','volunteer-seance']),
  doctrine: DOCTRINE_IDS,
  target: new Set(['rally','pirates','wonderwork']),
  scout: new Set(['toggle']),
  support: new Set(['pirates','reinforce','parade'])
};

function safeFile(urlPath) {
  let relative = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else if (relative === '/games/016') relative = '';
  else if (['/app.js','/styles.css','/game-data.js','/systems.js','/controller.html','/controller.js','/controller.css'].includes(relative)) relative = relative.slice(1);
  else if (relative.startsWith('/assets/')) relative = relative.slice(1);
  else return null;
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const candidate = path.resolve(__dirname, relative.replace(/^\/+/, ''));
  return candidate.startsWith(__dirname + path.sep) ? candidate : null;
}

function readJson(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = ''; const limit = Number(maxBytes || 16384);
    request.on('data', chunk => { body += chunk; if (body.length > limit) request.destroy(new Error('request body too large')); });
    request.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (_) { reject(new Error('invalid JSON')); } });
    request.on('error', reject);
  });
}

function sendJson(response, status, value) {
  if (value && value.gameId === GAME_ID) { value.version=RELEASE_VERSION; Object.assign(value.features || value,RELEASE_FEATURES); }
  response.writeHead(status, { 'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type' });
  response.end(JSON.stringify(value));
}

function cleanName(value) {
  const clean = String(value || 'Quartermaster').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 24);
  return clean || 'Quartermaster';
}

function finite(value, fallback, min, max) {
  const number = Number(value); if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

const TACTICAL_ANCHOR = /^a(?:[0-9]|1[0-9]|2[0-3])$/;
function cleanAnchorId(value) { const id=String(value||''); return TACTICAL_ANCHOR.test(id)?id:null; }

function sanitizeTactical(value) {
  const source=value&&typeof value==='object'?value:{}; const anchors=[]; const seen=new Set();
  for(const raw of Array.isArray(source.anchors)?source.anchors.slice(0,48):[]){
    const id=cleanAnchorId(raw&&raw.id);if(!id||seen.has(id)||anchors.length>=24)continue;seen.add(id);
    const explored=!!raw.explored,owner=explored&&['neutral','player','ally','enemy'].includes(raw.owner)?raw.owner:'unknown';
    const kind=explored&&['borough','moot','watch','bridgehead','wonderwork'].includes(raw.kind)?raw.kind:'';
    const proposedColor=String(raw.charterColor||'');
    anchors.push({id,name:String(raw&&raw.name||'').slice(0,48),x:finite(raw.x,0,0,1),y:finite(raw.y,0,0,1),explored,visible:explored&&!!raw.visible,owner,kind,charterColor:/^#[0-9a-f]{6}$/i.test(proposedColor)?proposedColor:''});
  }
  const ids=new Set(anchors.map(anchor=>anchor.id)),links=[];
  for(const raw of Array.isArray(source.links)?source.links.slice(0,80):[]){const a=cleanAnchorId(raw&&raw[0]),b=cleanAnchorId(raw&&raw[1]);if(a&&b&&a!==b&&ids.has(a)&&ids.has(b)&&links.length<40)links.push([a,b]);}
  const forces=[];
  for(const raw of Array.isArray(source.forces)?source.forces.slice(0,80):[]){
    const team=raw&&['player','ally','enemy'].includes(raw.team)?raw.team:null;if(!team||(team==='enemy'&&!raw.visible)||forces.length>=40)continue;
    forces.push({team,x:finite(raw.x,0,0,1),y:finite(raw.y,0,0,1),members:Math.round(finite(raw.members,1,1,200)),visible:team==='enemy'?true:!!raw.visible});
  }
  const rawSignal=source.signal||{},target=cleanAnchorId(rawSignal.target),kind=['rally','pirates','wonderwork'].includes(rawSignal.kind)?rawSignal.kind:null;
  const signal=target&&kind&&ids.has(target)?{target,kind,player:cleanName(rawSignal.player)}:null;
  const linkKeys=new Set(links.map(pair=>[pair[0],pair[1]].sort().join('>'))),routes=[],routeKeys=new Set();
  for(const raw of Array.isArray(source.routes)?source.routes.slice(0,80):[]){const from=cleanAnchorId(raw&&raw.from),to=cleanAnchorId(raw&&raw.to),key=from&&to?from+'>'+to:null,linkKey=from&&to?[from,to].sort().join('>'):null;if(!from||!to||from===to||!ids.has(from)||!ids.has(to)||!linkKeys.has(linkKey)||routeKeys.has(key)||routes.length>=40)continue;routeKeys.add(key);routes.push({from,to,count:Math.round(finite(raw.count,1,1,40))});}
  return {topology:String(source.topology||'Rooftop Network').slice(0,60),anchors,links,forces,signal,routes};
}

function sanitizeRival(value) {
  const source=value&&typeof value==='object'?value:{};
  const id=['market-heist','web-cutter','lantern-blackout','clock-crash','roof-grab'].includes(source.id)?source.id:'clock-crash';
  const phase=['staging','launched'].includes(source.phase)?source.phase:'staging';const proposedColor=String(source.color||'');
  return {id,name:String(source.name||'Rival Scheme').slice(0,60),icon:String(source.icon||'?').slice(0,5),kicker:String(source.kicker||'MACRO PLAN').slice(0,30),phase,nextIn:finite(source.nextIn,0,0,3600),target:String(source.target||'Unknown roof').slice(0,80),targetAnchor:cleanAnchorId(source.targetAnchor),counterplay:String(source.counterplay||'Counter-mass and protect the marked roof.').slice(0,180),color:/^#[0-9a-f]{6}$/i.test(proposedColor)?proposedColor:'#ff5876'};
}

function sanitizeDoctrine(value) {
  const source=value&&typeof value==='object'?value:{},options=[],seen=new Set();
  for(const raw of Array.isArray(source.options)?source.options.slice(0,4):[]){
    const id=String(raw&&raw.id||''),proposedColor=String(raw&&raw.color||'');if(!DOCTRINE_IDS.has(id)||seen.has(id)||options.length>=2)continue;seen.add(id);
    options.push({id,name:String(raw.name||'Grand Doctrine').slice(0,60),icon:String(raw.icon||'★').slice(0,4),detail:String(raw.detail||'One permanent faction-wide macro choice.').slice(0,180),color:/^#[0-9a-f]{6}$/i.test(proposedColor)?proposedColor:'#b27cff'});
  }
  const active=String(source.active||'');return{active:seen.has(active)?active:'',options};
}

function sanitizeRecruits(value) {
  const recruits=[],seen=new Set();for(const raw of Array.isArray(value)?value.slice(0,8):[]){const id=String(raw&&raw.id||''),proposedColor=String(raw&&raw.color||'');if(!CORE_UNIT_IDS.has(id)||seen.has(id)||recruits.length>=4)continue;seen.add(id);recruits.push({id,name:String(raw.name||'Formation').slice(0,60),icon:String(raw.icon||'★').slice(0,4),role:String(raw.role||'Core formation').slice(0,120),glow:finite(raw.glow,0,0,10000),scrap:finite(raw.scrap,0,0,10000),members:Math.round(finite(raw.members,1,1,200)),color:/^#[0-9a-f]{6}$/i.test(proposedColor)?proposedColor:'#b27cff'});}return recruits;
}

function sanitizePowers(value) {
  const powers=[],seen=new Set();for(const raw of Array.isArray(value)?value.slice(0,6):[]){const id=String(raw&&raw.id||'');if(!POWER_IDS.has(id)||seen.has(id)||powers.length>=3)continue;seen.add(id);powers.push({id,name:String(raw.name||'Field support').slice(0,60),essence:Math.round(finite(raw.essence,0,0,10000))});}return powers;
}

function createCoopRelay(options) {
  const settings = options || {}; const clock = typeof settings.clock === 'function' ? settings.clock : () => Date.now();
  let seat = null; let hostState = null; let nextSeq = 1; const commands = [];

  function seatView() {
    if (!seat) return { seatId:'quartermaster', occupied:false, connected:false, player:null };
    return { seatId:seat.seatId, occupied:true, connected:clock()-seat.lastSeen<6500, player:seat.player, joinedAt:seat.joinedAt, lastSeen:seat.lastSeen };
  }

  function authorize(token) {
    if (!seat || typeof token !== 'string' || token.length < 20) return false;
    const supplied = Buffer.from(token), stored = Buffer.from(seat.token);
    return supplied.length === stored.length && crypto.timingSafeEqual(supplied, stored);
  }

  function join(body) {
    const requested = String(body && body.token || ''); const now = clock();
    if (seat && !authorize(requested)) return { status:409, body:{ ok:false, error:'quartermaster seat occupied', seat:seatView() } };
    if (!seat) seat = { seatId:'quartermaster', player:cleanName(body && body.player), token:crypto.randomBytes(18).toString('hex'), joinedAt:now, lastSeen:now };
    else { seat.player = cleanName(body && body.player || seat.player); seat.lastSeen = now; }
    return { status:200, body:{ ok:true, schema:COOP_SCHEMA, token:seat.token, seat:seatView(), reconnect:true } };
  }

  function controllerState(token) {
    if (!authorize(String(token || ''))) return { status:403, body:{ ok:false, error:'invalid quartermaster token' } };
    seat.lastSeen = clock();
    return { status:200, body:{ ok:true, schema:COOP_SCHEMA, seat:seatView(), host:hostState, commands:commands.slice(-12).map(command => ({ seq:command.seq, matchId:command.matchId, type:command.type, value:command.value, target:command.target, status:command.status, message:command.message || null, at:command.at, ackAt:command.ackAt || null })) } };
  }

  function enqueue(body) {
    if (!authorize(String(body && body.token || ''))) return { status:403, body:{ ok:false, error:'invalid quartermaster token' } };
    const type = String(body && body.type || ''); const value = String(body && body.value || '');
    if (!COMMAND_VALUES[type] || !COMMAND_VALUES[type].has(value)) return { status:400, body:{ ok:false, error:'unsupported command', allowed:Object.fromEntries(Object.entries(COMMAND_VALUES).map(([key,set])=>[key,Array.from(set)])) } };
    if(!hostState||hostState.phase!=='battle'||!hostState.matchId)return{status:409,body:{ok:false,error:'battlefield is not accepting orders'}};
    if(type==='doctrine'&&!(hostState.doctrine&&hostState.doctrine.options.some(item=>item.id===value)))return{status:400,body:{ok:false,error:'doctrine is not offered by the Commander faction'}};
    const target=type==='target'?cleanAnchorId(body&&body.target):null;if(type==='target'&&!target)return{status:400,body:{ok:false,error:'unsupported tactical target'}};
    seat.lastSeen = clock();
    const command = { seq:nextSeq++, schema:COOP_SCHEMA, matchId:hostState.matchId, seatId:seat.seatId, player:seat.player, type, value, target, at:clock(), status:'queued' };
    commands.push(command); if (commands.length > 160) commands.splice(0, commands.length - 160);
    return { status:202, body:{ ok:true, command:{ seq:command.seq, type, value, target, status:command.status } } };
  }

  function drain(after) {
    const cursor = Math.max(0,Number(after)||0); const activeMatch=hostState&&hostState.phase==='battle'?hostState.matchId:null;const ready = commands.filter(command => command.seq > cursor && command.status === 'queued'&&command.matchId===activeMatch).slice(0,24);
    return { ok:true, schema:COOP_SCHEMA, matchId:activeMatch, seat:seatView(), commands:ready.map(command=>({ seq:command.seq, matchId:command.matchId, seatId:command.seatId, player:command.player, type:command.type, value:command.value, target:command.target, at:command.at })), latestSeq:nextSeq-1 };
  }

  function acknowledge(body) {
    const seq = Number(body && body.seq); const command = commands.find(item => item.seq === seq);
    if (!command) return { status:404, body:{ ok:false, error:'unknown command' } };
    command.status = body && body.ok === false ? 'rejected' : 'applied'; command.message = String(body && body.message || '').slice(0,120); command.ackAt = clock();
    return { status:200, body:{ ok:true, seq, status:command.status } };
  }

  function publish(body) {
    const resources = body && body.resources || {};
    const mechanic = body && body.mechanic || {}; const proposedColor=String(mechanic.color||'');
    const signature = body && body.signature || {}; const proposedSignatureColor=String(signature.color||'');
    const charter = body && body.charter || {}; const proposedCharterColor=String(charter.color||'');
    const nextPhase=String(body&&body.phase||'unknown').slice(0,20),proposedMatch=String(body&&body.matchId||''),nextMatchId=/^[a-z0-9-]{6,40}$/i.test(proposedMatch)?proposedMatch:'legacy-host';
    for(const command of commands)if(command.status==='queued'&&(nextPhase!=='battle'||command.matchId!==nextMatchId)){command.status='rejected';command.message='Match ended before application';command.ackAt=clock();}
    hostState = {
      updatedAt:clock(), phase:nextPhase, matchId:nextMatchId, mode:String(body && body.mode || 'unknown').slice(0,20),
      faction:String(body && body.faction || '').slice(0,40), map:String(body && body.map || '').slice(0,60), stance:String(body && body.stance || '').slice(0,30),
      autoScout:!!(body && body.autoScout), elapsed:finite(body && body.elapsed,0,0,86400), population:finite(body && body.population,0,0,2000), cap:finite(body && body.cap,400,1,4000),
      resources:{ glow:finite(resources.glow,0,0,100000), scrap:finite(resources.scrap,0,0,100000), essence:finite(resources.essence,0,0,100000) },
      signature:{ id:String(signature.id||'').slice(0,40), name:String(signature.name||'Faction Signature').slice(0,60), icon:String(signature.icon||'★').slice(0,4), role:String(signature.role||'Automatic battlefield passive').slice(0,120), glow:finite(signature.glow,0,0,10000), scrap:finite(signature.scrap,0,0,10000), color:/^#[0-9a-f]{6}$/i.test(proposedSignatureColor)?proposedSignatureColor:'#b27cff' },
      recruits:sanitizeRecruits(body&&body.recruits),
      powers:sanitizePowers(body&&body.powers),
      doctrine:sanitizeDoctrine(body&&body.doctrine),
      charter:{ id:String(charter.id||'').slice(0,40), name:String(charter.name||'District Charter').slice(0,60), icon:String(charter.icon||'⌂').slice(0,4), detail:String(charter.detail||'Future claimed roofs inherit this plan.').slice(0,140), color:/^#[0-9a-f]{6}$/i.test(proposedCharterColor)?proposedCharterColor:'#ffb15b' },
      mechanic:{ title:String(mechanic.title||'').slice(0,60), phase:String(mechanic.phase||'calm').slice(0,12), nextIn:finite(mechanic.nextIn,0,0,3600), direction:finite(mechanic.direction,1,-1,1), color:/^#[0-9a-f]{6}$/i.test(proposedColor)?proposedColor:'#b27cff', effect:String(mechanic.effect||'').slice(0,180) },
      rival:sanitizeRival(body&&body.rival),
      tactical:sanitizeTactical(body&&body.tactical)
    };
    return { status:200, body:{ ok:true, updatedAt:hostState.updatedAt } };
  }

  return { acknowledge, controllerState, drain, enqueue, join, publish, seatView, snapshot:()=>({ seat:seatView(), host:hostState, latestSeq:nextSeq-1 }) };
}

function createRuntime(options) {
  const settings = options || {}; const launchedAt = Date.now(); const coop = createCoopRelay(settings);
  const server = http.createServer(async (request,response) => {
    try {
      if (request.method === 'OPTIONS') return sendJson(response,200,{ok:true});
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/health') return sendJson(response,200,{ ok:true, gameId:GAME_ID, version:'0.17.0-foreground-spotlight', status:'PLAYABLE LOCAL ALPHA', maxHumanPlayers:2, livingMapMechanics:6, authoredMapTopologies:6, namedRooftops:114, topologyMinLinks:30, topologyMaxLinks:38, singleBridgeCutMaps:0, quartermasterNamedRoofIntel:true, factionSignatureRegiments:8, factionFormationKits:8, coreFormationRoleSilhouettes:4, coreFormationVisualVariants:32, formationPresentationChangesBalance:false, factionWonderworks:8, uniqueWonderworkEffects:8, uniqueWonderworkSilhouettes:8, wonderworkLimitPerFaction:2, rivalsBuildWonderworks:true, quartermasterCommissionsWonderworks:true, factionDistrictArchitectures:8, ordinaryDistrictRoles:4, factionDistrictConversions:5, thirteenthHourShiftPulse:true, thirteenthHourPeriodSeconds:12, thirteenthHourDurationSeconds:4, thirteenthHourRange:520, thirteenthHourMoveBonus:.18, thirteenthHourAttackRecoveryBonus:.16, thirteenthHourMixedCharterScaling:true, thirteenthHourEffectsStack:false, spectralCensusFrontierReports:true, spectralCensusBridgeHops:4, blackSailRouteSupport:true, briarwayRepairPulse:true, foregroundSpotlightTargetCoordination:true, foregroundSpotlightPeriodSeconds:13, foregroundSpotlightDurationSeconds:5, foregroundSpotlightRange:520, foregroundSpotlightDamageBonus:.18, foregroundSpotlightMixedCharterScaling:true, foregroundSpotlightEffectsStack:false, foregroundSpotlightTargetsBuildings:false, foregroundSpotlightBenefitsAiAllies:true, rivalsUseDistrictConversions:true, grandDoctrines:16, doctrineBranchesPerFaction:2, doctrineCoreVariants:16, quartermasterDoctrineControl:true, rivalDoctrineSelection:true, synchronizedSpecializedRecruitCards:true, districtCharters:4, rivalSchemes:5, strategicSkirmishPlanner:true, rivalStrategicFog:true, telegraphedRivalIntent:true, quartermasterRivalIntel:true, tacticalAtlas:true, targetedQuartermasterOrders:3, bridgeRouting:true, authoritativeBridgeGraph:true, quartermasterRouteIntel:true, mapAwareRouteCosts:3, coopSchema:COOP_SCHEMA, matchScopedCommands:true, modes:['skirmish','cooperative-ai','cooperative-human-quartermaster'], simulationAuthority:'browser-host', commandTransportAuthority:'server-relay', coop:coop.snapshot(), runtimeInternetRequired:false });
      if (request.method === 'GET' && url.pathname === '/api/launcher-state') return sendJson(response,200,{ ok:true, schema:'axm.game-runtime-launcher-state/v1', gameId:GAME_ID, version:'0.17.0-foreground-spotlight', playablePath:GAME_PREFIX, controllerPath:GAME_PREFIX+'controller.html', localOnly:true, features:{livingMapMechanics:6,authoredMapTopologies:6,namedRooftops:114,topologyMinLinks:30,topologyMaxLinks:38,singleBridgeCutMaps:0,quartermasterNamedRoofIntel:true,factionSignatureRegiments:8,automaticSignaturePassives:8,signatureRecruitmentForBothHumanRoles:true,factionFormationKits:8,coreFormationRoleSilhouettes:4,coreFormationVisualVariants:32,formationPresentationChangesBalance:false,factionWonderworks:8,uniqueWonderworkEffects:8,uniqueWonderworkSilhouettes:8,wonderworkLimitPerFaction:2,wonderworksScaleWithMixedCharters:true,rivalsBuildWonderworks:true,quartermasterCommissionsWonderworks:true,factionDistrictArchitectures:8,ordinaryDistrictRoles:4,factionDistrictConversions:5,thirteenthHourShiftPulse:true,thirteenthHourPeriodSeconds:12,thirteenthHourDurationSeconds:4,thirteenthHourRange:520,thirteenthHourMoveBonus:.18,thirteenthHourAttackRecoveryBonus:.16,thirteenthHourMixedCharterScaling:true,thirteenthHourEffectsStack:false,spectralCensusFrontierReports:true,spectralCensusBridgeHops:4,blackSailRouteSupport:true,briarwayRepairPulse:true,foregroundSpotlightTargetCoordination:true,foregroundSpotlightPeriodSeconds:13,foregroundSpotlightDurationSeconds:5,foregroundSpotlightRange:520,foregroundSpotlightDamageBonus:.18,foregroundSpotlightMixedCharterScaling:true,foregroundSpotlightEffectsStack:false,foregroundSpotlightTargetsBuildings:false,foregroundSpotlightBenefitsAiAllies:true,rivalsUseDistrictConversions:true,grandDoctrines:16,doctrineBranchesPerFaction:2,doctrineCoreVariants:16,quartermasterDoctrineControl:true,rivalDoctrineSelection:true,synchronizedSpecializedRecruitCards:true,anomalySyncToQuartermaster:true,districtCharters:4,mixedCharterWonderweb:true,automaticCharterMustering:true,quartermasterCharterControl:true,rivalSchemes:5,strategicSkirmishPlanner:true,rivalStrategicFog:true,telegraphedRivalIntent:true,quartermasterRivalIntel:true,tacticalAtlas:true,fogRespectingTacticalIntel:true,targetedQuartermasterOrders:3,bridgeRouting:true,authoritativeBridgeGraph:true,quartermasterRouteIntel:true,mapAwareRouteCosts:3,matchScopedCommands:true}, team:{ humanSeats:2, roles:['commander','quartermaster'], aiAlly:true, sharedScreen:false }, authority:{ launchSession:'server', commandTransport:'server-relay', simulation:'browser-host' }, launchedAt });
      if (request.method === 'POST' && url.pathname === '/api/coop/join') { const result=coop.join(await readJson(request)); return sendJson(response,result.status,result.body); }
      if (request.method === 'GET' && url.pathname === '/api/coop/state') { const result=coop.controllerState(url.searchParams.get('token')); return sendJson(response,result.status,result.body); }
      if (request.method === 'POST' && url.pathname === '/api/coop/command') { const result=coop.enqueue(await readJson(request)); return sendJson(response,result.status,result.body); }
      if (request.method === 'GET' && url.pathname === '/api/coop/commands') return sendJson(response,200,coop.drain(url.searchParams.get('after')));
      if (request.method === 'POST' && url.pathname === '/api/coop/ack') { const result=coop.acknowledge(await readJson(request)); return sendJson(response,result.status,result.body); }
      if (request.method === 'POST' && url.pathname === '/api/coop/host-state') { const result=coop.publish(await readJson(request)); return sendJson(response,result.status,result.body); }
      if (url.pathname === '/') { response.writeHead(302,{ location:GAME_PREFIX,'cache-control':'no-store' }); return response.end(); }
      const file = safeFile(url.pathname);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404,{'content-type':'text/plain; charset=utf-8'}); return response.end('HEXBOUND route not found.'); }
      response.writeHead(200,{ 'content-type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':/\.(?:html|js|css|json)$/i.test(file)?'no-store':'public, max-age=3600','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'none'; object-src 'none'; form-action 'self'" });
      fs.createReadStream(file).pipe(response);
    } catch (error) { sendJson(response,error.message==='invalid JSON'?400:500,{ok:false,error:error.message}); }
  });
  return { server, launchedAt, coop };
}

if (require.main === module) {
  const runtime = createRuntime(); runtime.server.listen(PORT,HOST,()=>console.log('HEXBOUND listening on http://'+HOST+':'+PORT+GAME_PREFIX));
}
module.exports = { HOST, PORT, GAME_ID, GAME_PREFIX, COOP_SCHEMA, createCoopRelay, createRuntime, safeFile, sanitizeTactical, sanitizeRival };
