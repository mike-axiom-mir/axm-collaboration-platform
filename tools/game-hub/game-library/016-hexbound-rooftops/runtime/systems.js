(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./game-data.js') : root.HEXBOUND_DATA);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HEXBOUND_SYSTEMS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA) {
  'use strict';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function faction(id) { return DATA.FACTIONS.find(item => item.id === id) || DATA.FACTIONS[0]; }
  function unit(id) { return DATA.UNITS.find(item => item.id === id) || DATA.UNITS[0]; }
  function building(id) { return DATA.BUILDINGS.find(item => item.id === id) || DATA.BUILDINGS[0]; }
  function districtArchitectureForFaction(factionId) { return (DATA.DISTRICT_ARCHITECTURES || []).find(item => item.factionId === factionId) || DATA.DISTRICT_ARCHITECTURES[0]; }
  function districtConversionFor(factionId, buildingId) { return (DATA.DISTRICT_CONVERSIONS || []).find(item => item.factionId === factionId && item.buildingId === buildingId) || null; }
  function districtPresentation(buildingId, factionId) {
    const base = building(buildingId), conversion = districtConversionFor(factionId, buildingId);
    return conversion ? Object.assign({}, base, { name:conversion.name, icon:conversion.icon || base.icon, detail:conversion.detail, conversionId:conversion.id, conversionEffect:conversion.effect }) : base;
  }
  function wonderworkForFaction(factionId) { return DATA.WONDERWORKS.find(item => item.factionId === factionId) || DATA.WONDERWORKS[0]; }
  function buildingSpec(id, factionId) { return id === 'wonderwork' ? wonderworkForFaction(factionId) : districtPresentation(id, factionId); }
  function charter(id) { return DATA.CHARTERS.find(item => item.id === id) || null; }
  function doctrine(id) { return DATA.DOCTRINES.find(item => item.id === id) || null; }
  function doctrinesForFaction(factionId) { return DATA.DOCTRINES.filter(item => item.factionId === factionId); }
  function activeDoctrine(factionId, doctrineId) { const item=doctrine(doctrineId);return item&&item.factionId===factionId?item:null; }
  function doctrineForBattle(factionId, seed, difficulty) { const choices=doctrinesForFaction(factionId);if(!choices.length)return null;const index=difficulty==='story'?0:difficulty==='nightmare'?1:Math.abs(Math.floor(Number(seed)||0))%choices.length;return choices[index]; }
  function rivalScheme(id) { return DATA.RIVAL_SCHEMES.find(item => item.id === id) || DATA.RIVAL_SCHEMES[0]; }
  function signatureForFaction(factionId) { return DATA.UNITS.find(item => item.signatureOf === factionId) || null; }
  function recruitableUnits(factionId) { return DATA.UNITS.filter(item => !item.signatureOf || item.signatureOf === factionId); }
  function formationKitForFaction(factionId) { return (DATA.FORMATION_KITS || []).find(item => item.factionId === factionId) || null; }
  function formationRoleForUnit(unitId) { return (DATA.FORMATION_ROLES || []).find(item => item.unitId === unitId) || null; }
  function coreFormationPresentation(unitId, factionId) {
    const role=formationRoleForUnit(unitId),kit=formationKitForFaction(factionId);
    if(!role||!kit)return null;
    return Object.assign({variantId:kit.id+'-'+role.unitId,unitId:role.unitId,factionId:kit.factionId,kitId:kit.id},role,kit);
  }

  function seeded(seed) {
    let value = (Number(seed) || 1) >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function squadSpec(unitId, factionId, overrides, doctrineId) {
    const base = unit(unitId);
    const side = faction(factionId);
    const branch=activeDoctrine(factionId,doctrineId),variant=branch&&branch.variant&&branch.variant.unitId===unitId?branch.variant:{};
    const extra = side.mods.squad || 0;
    const members = Math.max(1, base.members + extra + Number(variant.members||0) + Number(overrides && overrides.extraMembers || 0));
    const memberHp=base.hp*Number(variant.hp||1);
    return {
      members,
      maxMembers: members,
      memberHp,
      maxHp: members * memberHp,
      speed: base.speed * (side.mods.move || 1) * Number(variant.speed||1),
      damage: base.damage * (side.mods.attack || 1) * Number(variant.damage||1),
      range: base.range + Number(variant.range||0),
      sight: base.sight * (side.mods.sight || 1) * Number(variant.sight||1)
    };
  }

  function doctrineUnitPresentation(unitId, factionId, doctrineId) {
    const base=unit(unitId),branch=activeDoctrine(factionId,doctrineId),variant=branch&&branch.variant&&branch.variant.unitId===unitId?branch.variant:null;
    return variant?{name:variant.name,icon:variant.icon,role:variant.role,color:branch.color,doctrineId:branch.id}:{name:base.name,icon:base.icon,role:base.role,color:base.color,doctrineId:null};
  }

  function trainingQuote(unitId) {
    const quotes = {
      mobs: ['Mob assembled. Nobody read the agenda.', 'Swords out. Manners optional.'],
      hexbows: ['Choir tuned to the key of trouble.', 'Hexbows ready. Rhyming still prohibited.'],
      brooms: ['Brooms airborne. Dust deeply concerned.', 'Scouts ready to discover poor decisions.'],
      lanterns: ['Lantern Guard lit and extremely visible.', 'Heavy squad ready. Stairs objected.']
      ,'overtime-witches': ['Overtime approved. The clocks lodged a complaint.']
      ,'audit-wraiths': ['Audit complete. Mortality remains badly filed.']
      ,'deckfall-raiders': ['Deckfall! The nearest roof is now a harbour.']
      ,'briar-retinue': ['The royal hedge has entered the chat.']
      ,'coffin-union': ['Local 13 assembled. Again, if necessary.']
      ,'pocket-paladins': ['Tiny standards raised. Civic volume enormous.']
      ,'plot-rioters': ['The background cast found the foreground.']
      ,'deadline-dragoons': ['Arrived three minutes before being ordered.']
    };
    const list = quotes[unitId] || quotes.mobs;
    return list[Math.floor(Math.random() * list.length)];
  }

  function trainingCost(unitId, factionId, doctrineId, buildings) {
    const base = unit(unitId);
    const side = faction(factionId);
    const branch=activeDoctrine(factionId,doctrineId),variant=branch&&branch.variant&&branch.variant.unitId===unitId?branch.variant:{};
    const works=wonderworkEmpireEffects(buildings,0,factionId);
    return { glow: Math.ceil(base.glow*Number(variant.glow||1)), scrap: Math.ceil(base.scrap*Number(variant.scrap||1)), seconds: base.train*Number(variant.train||1) / ((side.mods.trainSpeed || 1)*works.trainSpeed) };
  }

  function claimCost(buildingId, factionId, doctrineId) {
    const base = buildingSpec(buildingId,factionId);
    const side = faction(factionId);
    const branch=activeDoctrine(factionId,doctrineId),empire=branch&&branch.empire&&branch.empire.buildingId===buildingId?branch.empire:{};
    const discount = side.mods.claimDiscount || 1;
    return { glow: Math.ceil(base.glow * discount * Number(empire.buildingGlow||1)), scrap: Math.ceil(base.scrap * discount * Number(empire.buildingScrap||1)), seconds: base.time * Number(empire.buildingTime||1) / (side.mods.buildSpeed || 1) };
  }

  function buildingHpMultiplier(buildingId, factionId, doctrineId) {
    const branch=activeDoctrine(factionId,doctrineId),empire=branch&&branch.empire&&branch.empire.buildingId===buildingId?branch.empire:null;
    return empire?Number(empire.buildingHp||1):1;
  }

  function districtNetworkBonus(buildingObject, buildings) {
    if (!buildingObject || !charter(buildingObject.charterId)) return 1;
    const nearby = new Set();
    for (const other of buildings || []) {
      if (other === buildingObject || other.id && buildingObject.id && other.id === buildingObject.id) continue;
      if (other.team !== buildingObject.team || other.kind === 'command' || other.progress < 1 || other.hp <= 0) continue;
      if (!charter(other.charterId) || other.charterId === buildingObject.charterId) continue;
      if (!Number.isFinite(other.x) || !Number.isFinite(other.y) || !Number.isFinite(buildingObject.x) || !Number.isFinite(buildingObject.y)) continue;
      if (distance(buildingObject, other) <= 520) nearby.add(other.charterId);
    }
    return 1 + Math.min(3, nearby.size) * .15;
  }

  function districtConversionPulse(buildingObject, buildings) {
    const conversion = buildingObject && districtConversionFor(buildingObject.factionId, buildingObject.kind);
    const effect = conversion && conversion.effect;
    if (!effect || effect.kind !== 'briar-mend' || buildingObject.progress < 1 || buildingObject.hp <= 0) return null;
    const networkBonus = districtNetworkBonus(buildingObject, buildings), range = Number(effect.range || 0), amount = Number(effect.repair || 0) * networkBonus;
    const ordinaryKinds = new Set(DATA.BUILDINGS.map(item => item.id));
    const targets = (buildings || []).filter(item => item && item !== buildingObject && item.team === buildingObject.team && ordinaryKinds.has(item.kind) && item.progress >= 1 && item.hp > 0 && item.hp < Number(item.maxHp || item.hp) && distance(buildingObject, item) <= range);
    return { conversionId:conversion.id, kind:effect.kind, period:Number(effect.period || 8), range, amount, networkBonus, targets };
  }

  function districtUnionShiftPulse(buildingObject, buildings, squads) {
    const conversion = buildingObject && districtConversionFor(buildingObject.factionId, buildingObject.kind), effect = conversion && conversion.effect;
    if (!effect || effect.kind !== 'union-shift' || buildingObject.progress < 1 || buildingObject.hp <= 0) return null;
    const networkBonus = districtNetworkBonus(buildingObject, buildings), range = Number(effect.range || 0);
    const targets = (squads || []).filter(item => item && item.team === buildingObject.team && item.hp > 0 && Number.isFinite(item.x) && Number.isFinite(item.y) && distance(buildingObject, item) <= range);
    return {
      conversionId:conversion.id,
      kind:effect.kind,
      period:Number(effect.period || 12),
      duration:Number(effect.duration || 4),
      range,
      networkBonus,
      moveMultiplier:1 + Number(effect.moveBonus || 0) * networkBonus,
      attackRecoveryMultiplier:1 + Number(effect.attackRecoveryBonus || 0) * networkBonus,
      targets
    };
  }

  function districtSpotlightPulse(buildingObject, buildings, squads) {
    const conversion = buildingObject && districtConversionFor(buildingObject.factionId, buildingObject.kind), effect = conversion && conversion.effect;
    if (!effect || effect.kind !== 'lead-role-spotlight' || buildingObject.progress < 1 || buildingObject.hp <= 0) return null;
    const networkBonus = districtNetworkBonus(buildingObject, buildings), range = Number(effect.range || 0);
    const targets = (squads || []).filter(item => item && !item.kind && item.hp > 0 && (buildingObject.team === 2) !== (item.team === 2) && Number.isFinite(item.x) && Number.isFinite(item.y) && distance(buildingObject, item) <= range);
    targets.sort((a,b)=>distance(buildingObject,a)-distance(buildingObject,b) || String(a.id||'').localeCompare(String(b.id||'')));
    return {
      conversionId:conversion.id,
      kind:effect.kind,
      period:Number(effect.period || 13),
      duration:Number(effect.duration || 5),
      range,
      networkBonus,
      damageMultiplier:1 + Number(effect.damageBonus || 0) * networkBonus,
      target:targets[0] || null
    };
  }

  function districtSpotlightDamageMultiplier(attacker, target, buildings, elapsed) {
    const inactive = { conversionId:null, sourceId:null, multiplier:1, networkBonus:1, range:0 };
    if (!attacker || !target || target.kind || attacker.hp <= 0 || target.hp <= 0 || !Number.isFinite(attacker.x) || !Number.isFinite(attacker.y)) return inactive;
    let best = inactive;
    for (const buildingObject of buildings || []) {
      if (!buildingObject || buildingObject.progress < 1 || buildingObject.hp <= 0 || (buildingObject.team === 2) !== (attacker.team === 2)) continue;
      const conversion = districtConversionFor(buildingObject.factionId, buildingObject.kind), effect = conversion && conversion.effect;
      if (!effect || effect.kind !== 'lead-role-spotlight' || Number(buildingObject.conversionPulseUntil || 0) <= Number(elapsed || 0) || !(buildingObject.conversionTargets || []).includes(target.id)) continue;
      const range = Number(effect.range || 0);
      if (distance(attacker, buildingObject) > range) continue;
      const networkBonus = districtNetworkBonus(buildingObject, buildings), multiplier = 1 + Number(effect.damageBonus || 0) * networkBonus;
      if (multiplier > best.multiplier) best = { conversionId:conversion.id, sourceId:buildingObject.id || null, multiplier, networkBonus, range };
    }
    return best;
  }

  function districtCivicCoverPulse(buildingObject, buildings, squads) {
    const conversion = buildingObject && districtConversionFor(buildingObject.factionId, buildingObject.kind), effect = conversion && conversion.effect;
    if (!effect || effect.kind !== 'civic-cover' || buildingObject.progress < 1 || buildingObject.hp <= 0) return null;
    const networkBonus = districtNetworkBonus(buildingObject, buildings), range = Number(effect.range || 0);
    const formations = (squads || []).filter(item => item && !item.kind && item.hp > 0 && Number.isFinite(item.x) && Number.isFinite(item.y) && distance(buildingObject, item) <= range);
    const allied = item => (buildingObject.team === 2) === (item.team === 2);
    const sortLocal = (a,b) => distance(buildingObject,a)-distance(buildingObject,b) || String(a.id||'').localeCompare(String(b.id||''));
    const threats = formations.filter(item => !allied(item)).sort(sortLocal), targets = formations.filter(allied).sort(sortLocal);
    const damageReduction = Math.min(.45, Number(effect.damageReduction || 0) * networkBonus);
    return {
      conversionId:conversion.id,
      kind:effect.kind,
      period:Number(effect.period || 13),
      duration:Number(effect.duration || 5),
      range,
      networkBonus,
      damageReduction,
      damageMultiplier:1-damageReduction,
      threats,
      targets
    };
  }

  function districtCivicCoverDamageMultiplier(target, buildings, elapsed) {
    const inactive = { conversionId:null, sourceId:null, multiplier:1, damageReduction:0, networkBonus:1, range:0 };
    if (!target || target.kind || target.hp <= 0 || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return inactive;
    let best = inactive;
    for (const buildingObject of buildings || []) {
      if (!buildingObject || buildingObject.progress < 1 || buildingObject.hp <= 0 || (buildingObject.team === 2) !== (target.team === 2)) continue;
      const conversion = districtConversionFor(buildingObject.factionId, buildingObject.kind), effect = conversion && conversion.effect;
      if (!effect || effect.kind !== 'civic-cover' || Number(buildingObject.conversionPulseUntil || 0) <= Number(elapsed || 0) || !(buildingObject.conversionTargets || []).includes(target.id)) continue;
      const range = Number(effect.range || 0);
      if (distance(target, buildingObject) > range) continue;
      const networkBonus = districtNetworkBonus(buildingObject, buildings), damageReduction = Math.min(.45, Number(effect.damageReduction || 0) * networkBonus), multiplier = 1-damageReduction;
      if (multiplier < best.multiplier) best = { conversionId:conversion.id, sourceId:buildingObject.id || null, multiplier, damageReduction, networkBonus, range };
    }
    return best;
  }

  function districtCensusPulse(buildingObject, buildings, anchors, links, explored) {
    const conversion = buildingObject && districtConversionFor(buildingObject.factionId, buildingObject.kind), effect = conversion && conversion.effect;
    if (!effect || effect.kind !== 'spectral-census' || buildingObject.progress < 1 || buildingObject.hp <= 0) return null;
    const points = Array.isArray(anchors) ? anchors : [], start = nearestAnchorIndex(buildingObject, points), maxHops = Math.max(1, Math.floor(Number(effect.maxHops) || 4));
    const networkBonus = districtNetworkBonus(buildingObject, buildings), period = Number(effect.period || 11) / networkBonus;
    const base = { conversionId:conversion.id, kind:effect.kind, period, basePeriod:Number(effect.period || 11), maxHops, revealRadius:Number(effect.revealRadius || 185), revealSeconds:Number(effect.revealSeconds || 4.5), networkBonus, target:null, path:[] };
    if (start < 0 || !points.length) return base;
    const byId = new Map(points.map((point,index)=>[String(point.id == null ? index : point.id),index])), adjacency = points.map(()=>[]);
    const resolve = value => Number.isInteger(value) ? value : byId.get(String(value));
    for (const pair of links || []) {
      const a = resolve(pair && pair[0]), b = resolve(pair && pair[1]);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= points.length || b >= points.length || a === b) continue;
      adjacency[a].push(b); adjacency[b].push(a);
    }
    adjacency.forEach(neighbors=>neighbors.sort((a,b)=>a-b));
    const hops = Array(points.length).fill(Infinity), previous = Array(points.length).fill(-1), queue = [start]; hops[start] = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor]; if (hops[current] >= maxHops) continue;
      for (const next of adjacency[current]) if (!Number.isFinite(hops[next])) { hops[next] = hops[current] + 1; previous[next] = current; queue.push(next); }
    }
    const candidates = points.map((point,index)=>({point,index,hops:hops[index]})).filter(item=>item.index !== start && item.hops <= maxHops && !exploredAt(explored,item.point.x,item.point.y,80));
    candidates.sort((a,b)=>a.hops-b.hops || distance(buildingObject,a.point)-distance(buildingObject,b.point) || a.index-b.index);
    if (!candidates.length) return base;
    const winner = candidates[0], indices = [];
    for (let cursor = winner.index; cursor >= 0; cursor = previous[cursor]) { indices.push(cursor); if (cursor === start) break; }
    indices.reverse();
    return Object.assign(base, { target:winner.point, path:indices.map(index=>points[index]) });
  }

  function districtRouteSupport(squad, buildings) {
    const inactive = { conversionId:null, sourceId:null, multiplier:1, networkBonus:1, range:0 };
    if (!squad || squad.hp <= 0 || !Number.isFinite(squad.x) || !Number.isFinite(squad.y)) return inactive;
    const routed = Array.isArray(squad.route) && squad.route.length > 0 || squad.routeGoal && distance(squad, squad.routeGoal) > 40 && ['move','guard','raid','march','scout','parade','fight'].includes(squad.order);
    if (!routed) return inactive;
    let best = inactive;
    for (const buildingObject of buildings || []) {
      if (!buildingObject || buildingObject.team !== squad.team || buildingObject.progress < 1 || buildingObject.hp <= 0) continue;
      const conversion = districtConversionFor(buildingObject.factionId, buildingObject.kind), effect = conversion && conversion.effect;
      if (!effect || effect.kind !== 'black-sail-route') continue;
      const range = Number(effect.range || 0);
      if (distance(squad, buildingObject) > range) continue;
      const networkBonus = districtNetworkBonus(buildingObject, buildings), multiplier = 1 + Number(effect.speedBonus || 0) * networkBonus;
      if (multiplier > best.multiplier) best = { conversionId:conversion.id, sourceId:buildingObject.id || null, multiplier, networkBonus, range };
    }
    return best;
  }

  function districtWakeDividend(casualty, deaths, buildings, owningTeam) {
    const inactive = { conversionId:null, sourceId:null, sourceFactionId:null, essence:0, bonusRate:0, networkBonus:1, range:0 };
    if (!casualty || casualty.kind || !casualty.unitId || !Number.isFinite(casualty.x) || !Number.isFinite(casualty.y) || !(deaths > 0)) return inactive;
    let best = inactive;
    for (const buildingObject of buildings || []) {
      if (!buildingObject || buildingObject.team !== owningTeam || buildingObject.progress < 1 || buildingObject.hp <= 0) continue;
      const conversion = districtConversionFor(buildingObject.factionId, buildingObject.kind), effect = conversion && conversion.effect;
      if (!effect || effect.kind !== 'wake-dividend') continue;
      const range = Number(effect.range || 0);
      if (distance(casualty, buildingObject) > range) continue;
      const networkBonus = districtNetworkBonus(buildingObject, buildings), bonusRate = Number(effect.essenceBonus || 0) * networkBonus;
      if (bonusRate > best.bonusRate) best = { conversionId:conversion.id, sourceId:buildingObject.id || null, sourceFactionId:buildingObject.factionId || null, essence:Number(deaths) * bonusRate, bonusRate, networkBonus, range };
    }
    return best;
  }

  function districtCharterEffects(buildingObject, buildings) {
    const spec = buildingObject && charter(buildingObject.charterId);
    if (!spec) return { glow:0, scrap:0, cap:0, sight:0, musterSeconds:Infinity, networkBonus:1 };
    const networkBonus = districtNetworkBonus(buildingObject, buildings);
    return {
      glow: spec.glow * networkBonus,
      scrap: spec.scrap * networkBonus,
      cap: Math.round(spec.cap * networkBonus),
      sight: Math.round(spec.sight * networkBonus),
      musterSeconds: spec.muster ? spec.muster / networkBonus : Infinity,
      networkBonus
    };
  }

  function wonderworkCount(buildings, team, factionId) {
    return (buildings || []).filter(item => item && item.kind === 'wonderwork' && item.team === team && item.factionId === factionId && item.hp > 0).length;
  }

  function rivalExpansionKind(factionId, buildings, team) {
    const work = wonderworkForFaction(factionId);
    if (wonderworkCount(buildings, team, factionId) < work.max) return 'wonderwork';
    const conversion = (DATA.DISTRICT_CONVERSIONS || []).find(item => item.factionId === factionId);
    return conversion ? conversion.buildingId : 'borough';
  }

  function wonderworkEmpireEffects(buildings, team, factionId) {
    const result={count:0,cap:0,sight:0,trainSpeed:1,cooldownSpeed:1};
    for(const item of buildings||[]){
      if(!item||item.kind!=='wonderwork'||item.team!==team||item.factionId!==factionId||item.progress<1||item.hp<=0)continue;
      const effect=wonderworkForFaction(item.factionId).effect||{},network=districtNetworkBonus(item,buildings);result.count+=1;
      result.cap+=Math.round(Number(effect.cap||0)*network);result.sight=Math.max(result.sight,Math.round(Number(effect.sight||0)*network));
      result.trainSpeed*=Number(effect.trainSpeed||1);result.cooldownSpeed*=Number(effect.cooldownSpeed||1);
    }
    return result;
  }

  function incomeFor(buildings, factionId, doctrineId) {
    const side = faction(factionId);
    const branch=activeDoctrine(factionId,doctrineId),empire=branch&&branch.empire||{};
    let boroughs = 0;
    let moots = 0;
    let charterGlow = 0;
    let charterScrap = 0;
    let charterCap = 0;
    for (const item of buildings || []) {
      if (item.team !== 0 || item.progress < 1) continue;
      if (item.kind === 'borough') boroughs += 1;
      if (item.kind === 'moot') moots += 1;
      const effects = districtCharterEffects(item, buildings);
      charterGlow += effects.glow; charterScrap += effects.scrap; charterCap += effects.cap;
    }
    const works=wonderworkEmpireEffects(buildings,0,factionId);
    return {
      glow: (2.2 + boroughs * 1.35 + moots * 0.25 + charterGlow) * (side.mods.glowIncome || 1) * Number(empire.incomeGlow||1),
      scrap: (1.35 + boroughs * 0.92 + moots * 0.35 + charterScrap) * (side.mods.scrapIncome || 1) * Number(empire.incomeScrap||1),
      cap: DATA.WORLD.cap + boroughs * 80 + charterCap + Number(empire.cap||0) + works.cap
    };
  }

  function casualtyDelta(oldHp, newHp, memberHp, oldMembers) {
    const before = Math.max(0, Math.min(oldMembers, Math.ceil(Math.max(0, oldHp) / memberHp)));
    const after = Math.max(0, Math.min(oldMembers, Math.ceil(Math.max(0, newHp) / memberHp)));
    return Math.max(0, before - after);
  }

  function essenceFromDeaths(deaths, factionId) {
    return Math.max(0, deaths) * (faction(factionId).mods.essence || 1);
  }

  function summonCost(powerId, factionId, doctrineId) {
    const power = DATA.POWERS.find(item => item.id === powerId);
    if (!power) return Infinity;
    const side = faction(factionId);
    const branch=activeDoctrine(factionId,doctrineId),empire=branch&&branch.empire&&branch.empire.powerId===powerId?branch.empire:{};
    return Math.ceil(power.essence * (powerId === 'pirates' ? (side.mods.summonDiscount || 1) : 1) * Number(empire.powerCost||1));
  }

  function doctrinePowerCooldown(powerId, seconds, factionId, doctrineId) {
    const branch=activeDoctrine(factionId,doctrineId),empire=branch&&branch.empire&&branch.empire.powerId===powerId?branch.empire:{};
    return Number(seconds||0)*Number(empire.powerCooldown||1);
  }

  function exploredAt(grid, x, y, cellSize) {
    const cell = cellSize || 80;
    return !!grid[Math.floor(y / cell) + ':' + Math.floor(x / cell)];
  }

  function nearest(origin, list, predicate) {
    let best = null;
    let bestDistance = Infinity;
    for (const item of list || []) {
      if (predicate && !predicate(item)) continue;
      const d = distance(origin, item);
      if (d < bestDistance) { best = item; bestDistance = d; }
    }
    return best;
  }

  function mapMechanicState(mapId, elapsed) {
    const map = DATA.MAPS.find(item => item.id === mapId) || DATA.MAPS[0];
    const mechanic = map.mechanic;
    const time = Math.max(0, Number(elapsed) || 0);
    if (!mechanic) return { phase: 'calm', active: false, warning: false, nextIn: Infinity, pulse: -1, direction: 1 };
    if (time < mechanic.first) return { phase: 'calm', active: false, warning: false, nextIn: mechanic.first - time, pulse: -1, direction: 1 };
    const sinceFirst = time - mechanic.first;
    const pulse = Math.floor(sinceFirst / mechanic.period);
    const cycle = sinceFirst - pulse * mechanic.period;
    const active = cycle < mechanic.duration;
    const warning = !active && cycle >= mechanic.period - mechanic.warning;
    const nextIn = active ? mechanic.duration - cycle : mechanic.period - cycle;
    return {
      phase: active ? 'active' : warning ? 'warning' : 'calm',
      active, warning, nextIn: Math.max(0, nextIn), pulse,
      direction: pulse % 2 === 0 ? 1 : -1
    };
  }

  function mapIncomeMultiplier(mapId, mechanicState) {
    return mapId === 'royal-table' && mechanicState && mechanicState.active ? 1.65 : 1;
  }

  function mapSpeedMultiplier(mapId, mechanicState, context) {
    if (!mechanicState || !mechanicState.active) return 1;
    const info = context || {};
    if (mapId === 'tuesday' && info.onBridge) return 1.65;
    if (mapId === 'gargoyle-garage' && info.nearContestedAnchor) return .55;
    if (mapId === 'witch-mall' && info.onEscalator && Math.sign(info.targetDeltaX || 0) === mechanicState.direction) return 1.55;
    return 1;
  }

  function distanceToSegment(point, start, end) {
    const dx = end.x - start.x, dy = end.y - start.y;
    if (!dx && !dy) return distance(point, start);
    const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
  }

  function isNearBridge(point, anchors, links, threshold) {
    const limit = threshold == null ? 34 : threshold;
    return (links || []).some(pair => anchors[pair[0]] && anchors[pair[1]] && distanceToSegment(point, anchors[pair[0]], anchors[pair[1]]) <= limit);
  }

  function nearestAnchorIndex(point, anchors) {
    if (!point || !Array.isArray(anchors) || !anchors.length) return -1;
    let best = -1, bestDistance = Infinity;
    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchors[index];
      if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) continue;
      const candidate = distance(point, anchor);
      if (candidate < bestDistance) { best = index; bestDistance = candidate; }
    }
    return best;
  }

  function bridgeTraversalMultiplier(mapId, mechanicState, from, to, context) {
    const info = context || {}, hot = new Set((info.hotAnchorIds || []).map(String));
    if (mapId === 'gargoyle-garage' && (hot.has(String(from && from.id)) || hot.has(String(to && to.id)))) return 2.6;
    if (!mechanicState || !mechanicState.active) return 1;
    if (mapId === 'tuesday') return .62;
    if (mapId === 'witch-mall') {
      const dx = (to && to.x || 0) - (from && from.x || 0), dy = (to && to.y || 0) - (from && from.y || 0);
      if (Math.abs(dx) < Math.abs(dy) * .6) return 1;
      return Math.sign(dx) === Math.sign(mechanicState.direction || 1) ? .62 : 1.35;
    }
    return 1;
  }

  function bridgeRoute(anchors, links, origin, destination, options) {
    const points = Array.isArray(anchors) ? anchors : [], edges = Array.isArray(links) ? links : [], settings = options || {};
    const directCost = origin && destination ? distance(origin, destination) : Infinity;
    const start = nearestAnchorIndex(origin, points), goal = nearestAnchorIndex(destination, points);
    if (start < 0 || goal < 0) return { indices:[], anchorIds:[], cost:directCost, connected:false, direct:true };
    const anchorId = index => String(points[index].id == null ? index : points[index].id);
    if (start === goal) return { indices:[start], anchorIds:[anchorId(start)], cost:directCost, connected:true, direct:true };
    const byId = new Map(points.map((point,index)=>[String(point.id == null ? index : point.id),index]));
    const adjacency = points.map(()=>[]);
    const resolve = value => Number.isInteger(value) ? value : byId.get(String(value));
    for (const pair of edges) {
      const a = resolve(pair && pair[0]), b = resolve(pair && pair[1]);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= points.length || b >= points.length || a === b) continue;
      adjacency[a].push(b); adjacency[b].push(a);
    }
    const costs = Array(points.length).fill(Infinity), previous = Array(points.length).fill(-1), visited = new Set(); costs[start] = 0;
    while (visited.size < points.length) {
      let current = -1, currentCost = Infinity;
      for (let index = 0; index < costs.length; index += 1) if (!visited.has(index) && (costs[index] < currentCost || costs[index] === currentCost && index < current)) { current = index; currentCost = costs[index]; }
      if (current < 0 || currentCost === Infinity) break;
      if (current === goal) break; visited.add(current);
      for (const next of adjacency[current]) {
        const multiplier = bridgeTraversalMultiplier(settings.mapId, settings.mechanicState, points[current], points[next], settings);
        const nextCost = currentCost + distance(points[current], points[next]) * multiplier;
        if (nextCost < costs[next]) { costs[next] = nextCost; previous[next] = current; }
      }
    }
    if (!Number.isFinite(costs[goal])) return { indices:[], anchorIds:[], cost:directCost, connected:false, direct:true };
    const indices = []; for (let cursor = goal; cursor >= 0; cursor = previous[cursor]) { indices.push(cursor); if (cursor === start) break; }
    indices.reverse();
    return { indices, anchorIds:indices.map(anchorId), cost:costs[goal], connected:true, direct:false };
  }

  function tacticalOwner(buildingObject, explored) {
    if (!explored) return 'unknown';
    if (!buildingObject) return 'neutral';
    return buildingObject.team === 0 ? 'player' : buildingObject.team === 1 ? 'ally' : 'enemy';
  }

  function strategicKnownBuildings(buildings, observingTeam, explored) {
    return (buildings || []).filter(item => item && item.hp > 0 && (item.team === observingTeam || item.kind === 'command' || exploredAt(explored,item.x,item.y,80)));
  }

  function constructionAuraMultiplier(buildingObject, squads) {
    return (squads || []).some(squad => squad.hp > 0 && squad.team === buildingObject.team && unit(squad.unitId).passive === 'work-aura' && distance(squad, buildingObject) < 260) ? 1.5 : 1;
  }

  function essenceAuraMultiplier(casualty, squads) {
    return (squads || []).some(squad => squad.hp > 0 && squad.team === 0 && unit(squad.unitId).passive === 'death-audit' && distance(squad, casualty) < 260) ? 1.5 : 1;
  }

  function lastActMultiplier(squad) {
    if (unit(squad.unitId).passive !== 'last-act') return 1;
    const missing = 1 - clamp((squad.members || 0) / Math.max(1, squad.maxMembers || squad.members || 1), 0, 1);
    return 1 + missing * .8;
  }

  function marchAuraMultiplier(squad, squads) {
    return (squads || []).some(ally => ally.id !== squad.id && ally.hp > 0 && ally.team === squad.team && unit(ally.unitId).passive === 'march-aura' && distance(ally, squad) < 230) ? 1.12 : 1;
  }

  function rivalSchemeFor(context) {
    const info = context || {};
    const districts = Array.isArray(info.playerDistricts) ? info.playerDistricts : [];
    const openRoofs = Math.max(0, Number(info.openRoofs) || 0);
    const ownDistricts = Math.max(0, Number(info.ownDistricts) || 0);
    const elapsed = Math.max(0, Number(info.elapsed) || 0);
    const rivalFighters = Math.max(0, Number(info.rivalFighters) || 0);
    const playerFighters = Math.max(1, Number(info.playerFighters) || 1);
    if (ownDistricts < 2 && openRoofs > 0) return rivalScheme('roof-grab');
    if (elapsed >= 120 && rivalFighters >= playerFighters * .8) return rivalScheme('clock-crash');
    const available = {
      'market-heist': districts.some(item => item.charterId === 'pumpkin-market' || item.charterId === 'junk-jamboree'),
      'web-cutter': districts.some(item => Number(item.networkBonus) > 1),
      'lantern-blackout': districts.some(item => item.kind === 'watch' || item.charterId === 'impossible-housing'),
      'clock-crash': true,
      'roof-grab': openRoofs > 0
    };
    const rotation = ['market-heist', 'web-cutter', 'lantern-blackout', 'clock-crash', 'roof-grab'];
    const start = Math.abs(Math.floor(Number(info.cycle) || 0)) % rotation.length;
    for (let offset = 0; offset < rotation.length; offset += 1) {
      const id = rotation[(start + offset) % rotation.length];
      if (available[id]) return rivalScheme(id);
    }
    return rivalScheme('clock-crash');
  }

  function rivalTarget(schemeId, buildings) {
    const living = (buildings || []).filter(item => item && item.team === 0 && item.hp > 0 && Number(item.progress) >= .4);
    const command = living.find(item => item.kind === 'command') || null;
    let candidates = living.filter(item => item.kind !== 'command');
    if (schemeId === 'market-heist') candidates = candidates.filter(item => item.charterId === 'pumpkin-market' || item.charterId === 'junk-jamboree');
    if (schemeId === 'lantern-blackout') candidates = candidates.filter(item => item.kind === 'watch' || item.charterId === 'impossible-housing');
    if (schemeId === 'clock-crash' || schemeId === 'roof-grab') return command || living[0] || null;
    let best = null, bestScore = -Infinity;
    for (const item of candidates) {
      const network = districtNetworkBonus(item, living);
      const hpRatio = clamp(item.hp / Math.max(1, item.maxHp || item.hp), 0, 1);
      let score = (1 - hpRatio) * 30;
      if (schemeId === 'market-heist') score += item.charterId === 'pumpkin-market' ? 110 : 100;
      if (schemeId === 'web-cutter') score += network * 100;
      if (schemeId === 'lantern-blackout') score += item.kind === 'watch' ? 140 : 100;
      if (score > bestScore || score === bestScore && String(item.id) < String(best && best.id)) { best = item; bestScore = score; }
    }
    return best || command || living[0] || null;
  }

  function rivalComposition(schemeId, difficulty, cycle, signatureId) {
    const plan = rivalScheme(schemeId);
    const size = difficulty === 'story' ? 2 : difficulty === 'nightmare' ? 5 : 4;
    const offset = Math.abs(Math.floor(Number(cycle) || 0)) % plan.composition.length;
    const result = [];
    for (let index = 0; index < size; index += 1) {
      const type = plan.composition[(index + offset) % plan.composition.length];
      result.push(type === 'signature' ? signatureId : type);
    }
    return result;
  }

  function rivalCadence(difficulty) {
    if (difficulty === 'story') return { stage: 7, regroup: 24 };
    if (difficulty === 'nightmare') return { stage: 4, regroup: 13 };
    return { stage: 5.5, regroup: 18 };
  }

  return { clamp, distance, faction, unit, building, districtArchitectureForFaction, districtConversionFor, districtPresentation, wonderworkForFaction, buildingSpec, charter, doctrine, doctrinesForFaction, activeDoctrine, doctrineForBattle, rivalScheme, signatureForFaction, recruitableUnits, formationKitForFaction, formationRoleForUnit, coreFormationPresentation, seeded, squadSpec, doctrineUnitPresentation, trainingQuote, trainingCost, claimCost, buildingHpMultiplier, districtNetworkBonus, districtConversionPulse, districtUnionShiftPulse, districtSpotlightPulse, districtSpotlightDamageMultiplier, districtCivicCoverPulse, districtCivicCoverDamageMultiplier, districtCensusPulse, districtRouteSupport, districtWakeDividend, districtCharterEffects, wonderworkCount, rivalExpansionKind, wonderworkEmpireEffects, incomeFor, casualtyDelta, essenceFromDeaths, summonCost, doctrinePowerCooldown, exploredAt, nearest, mapMechanicState, mapIncomeMultiplier, mapSpeedMultiplier, distanceToSegment, isNearBridge, nearestAnchorIndex, bridgeTraversalMultiplier, bridgeRoute, tacticalOwner, strategicKnownBuildings, constructionAuraMultiplier, essenceAuraMultiplier, lastActMultiplier, marchAuraMultiplier, rivalSchemeFor, rivalTarget, rivalComposition, rivalCadence };
});
