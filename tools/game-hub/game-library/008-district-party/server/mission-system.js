'use strict';

const { TICK_RATE } = require('../shared/constants');
const { createMissionState, isPointInZone } = require('./world-state');
const { createHostileNpc } = require('./npc-factory');
const { clearVoluntaryChaos, triggerVoluntaryChaos } = require('./justice-system');
const { ejectAllOccupants } = require('./vehicle-system');
const { creditSplitReward, splitRewardCents } = require('./economy-system');
const { collidesObstacle } = require('./spatial-index');

const BOARD_OPTIONS = Object.freeze(['supply_sweep', 'hold_relay', 'courier_chaos', 'chaos_call', 'close']);
const RESULT_OPTIONS = Object.freeze(['continue', 'replay', 'mission_list']);
const MISSION_LABELS = Object.freeze({
  supply_sweep: 'Supply Sweep',
  hold_relay: 'Hold the Relay',
  courier_chaos: 'Courier Chaos',
  chaos_call: 'Call the Heat',
  close: 'Close board',
  continue: 'Continue in base',
  replay: 'Replay mission',
  mission_list: 'Mission list',
});

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function definitionFor(world, mode) {
  return world.staticMap.mission.catalog?.[mode] || {};
}

function missionLabel(mode) {
  return MISSION_LABELS[mode] || mode;
}

function layoutsFor(world, mode) {
  return (definitionFor(world, mode).layouts || []).filter((layout) => (
    layout && typeof layout.id === 'string' && layout.id && Number.isFinite(Number(layout.start?.x)) && Number.isFinite(Number(layout.start?.y))
  ));
}

function layoutFor(world, mode, layoutId) {
  return layoutsFor(world, mode).find((layout) => layout.id === layoutId) || null;
}

function publicLayout(layout, index, total) {
  if (!layout) return null;
  return {
    id: layout.id,
    label: layout.label || layout.id,
    index: index + 1,
    total,
    twist: layout.twist || '',
  };
}

function missionDirector(world) {
  world.missionDirector ||= {
    seed: (Number(world.randomSeed) || 0x4d495353) >>> 0,
    decks: {},
    lastLayoutByMode: {},
    runsByMode: {},
    totalRuns: 0,
  };
  return world.missionDirector;
}

function nextDirectorRandom(director) {
  director.seed = (Math.imul(director.seed, 1664525) + 1013904223) >>> 0;
  return director.seed;
}

function refillLayoutDeck(director, mode, layouts) {
  const ids = layouts.map((layout) => layout.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const other = nextDirectorRandom(director) % (index + 1);
    [ids[index], ids[other]] = [ids[other], ids[index]];
  }
  const previous = director.lastLayoutByMode[mode];
  if (ids.length > 1 && ids[0] === previous) [ids[0], ids[1]] = [ids[1], ids[0]];
  director.decks[mode] = { ids, cursor: 0 };
  return director.decks[mode];
}

function reserveMissionLayout(world, mode, requestedLayoutId = null) {
  const layouts = layoutsFor(world, mode);
  if (!layouts.length) return null;
  const director = missionDirector(world);
  let selected = requestedLayoutId ? layoutFor(world, mode, requestedLayoutId) : null;
  if (!selected) {
    let deck = director.decks[mode];
    const currentIds = layouts.map((layout) => layout.id).sort().join('|');
    const deckIds = (deck?.ids || []).slice().sort().join('|');
    if (!deck || deck.cursor >= deck.ids.length || currentIds !== deckIds) deck = refillLayoutDeck(director, mode, layouts);
    const id = deck.ids[deck.cursor];
    deck.cursor += 1;
    selected = layoutFor(world, mode, id) || layouts[0];
  }
  director.lastLayoutByMode[mode] = selected.id;
  director.runsByMode[mode] = (director.runsByMode[mode] || 0) + 1;
  director.totalRuns += 1;
  const index = layouts.findIndex((layout) => layout.id === selected.id);
  return publicLayout(selected, Math.max(0, index), layouts.length);
}

function layoutCounts(world) {
  return Object.fromEntries(BOARD_OPTIONS.filter((mode) => !['close'].includes(mode)).map((mode) => [mode, layoutsFor(world, mode).length]));
}

function activeDeliveryZones(world) {
  const ids = world.mission?.activeDeliveryZoneIds;
  const zones = world.staticMap.mission.deliveryZones || [];
  if (!Array.isArray(ids) || ids.length === 0) return zones;
  const allowed = new Set(ids);
  return zones.filter((zone) => allowed.has(zone.id));
}

function activeActors(world) {
  return Object.values(world.actors);
}

function livingActors(world) {
  return activeActors(world).filter((actor) => actor.alive);
}

function removeMissionHostiles(world) {
  for (const npc of Object.values(world.npcs)) {
    if (npc.source === 'mission') delete world.npcs[npc.id];
  }
}

function clearTransientCombat(world) {
  world.projectiles = {};
  world.effects = world.effects.filter((effect) => effect.kind === 'vehicle-explosion').slice(-8);
}

function closeActorOverlays(world) {
  for (const actor of activeActors(world)) {
    actor.inventoryOpen = false;
    actor.velocity = { x: 0, y: 0 };
    actor.input.attack = false;
    actor.input.sprint = false;
    actor.input.brake = false;
  }
}

function ejectPartyVehicles(world, reason) {
  for (const vehicle of Object.values(world.vehicles)) {
    if (vehicle.driverActorId || vehicle.passengerActorIds.length) ejectAllOccupants(world, vehicle, reason);
  }
}

function formationPosition(centre, index) {
  const offsets = [
    [-28, -22], [28, -22], [-28, 22], [28, 22],
    [-56, -22], [56, -22], [-56, 22], [56, 22],
  ];
  const [x, y] = offsets[index] || [0, index * 16];
  return { x: centre.x + x, y: centre.y + y };
}

function findOpenMissionPosition(world, preferred, radius = 10, occupied = [], maximumDistance = 264) {
  const safeRadius = Math.max(0, Number(radius) || 0);
  const minimumSeparation = safeRadius * 2 + 6;
  const candidates = [{ x: Number(preferred.x), y: Number(preferred.y) }];
  for (let distanceFromPreferred = 24; distanceFromPreferred <= maximumDistance; distanceFromPreferred += 24) {
    const points = Math.max(8, Math.round(distanceFromPreferred / 12));
    for (let index = 0; index < points; index += 1) {
      const angle = index / points * Math.PI * 2;
      candidates.push({
        x: Number(preferred.x) + Math.cos(angle) * distanceFromPreferred,
        y: Number(preferred.y) + Math.sin(angle) * distanceFromPreferred,
      });
    }
  }
  return candidates.find((candidate) => {
    const position = {
      x: Math.max(safeRadius, Math.min(world.staticMap.width - safeRadius, candidate.x)),
      y: Math.max(safeRadius, Math.min(world.staticMap.height - safeRadius, candidate.y)),
    };
    candidate.x = position.x;
    candidate.y = position.y;
    return !collidesObstacle(world, position, safeRadius)
      && occupied.every((entry) => distance(entry, position) >= minimumSeparation);
  }) || null;
}

function teleportActors(world, centre, options = {}) {
  const occupied = [];
  activeActors(world).sort((a, b) => a.slot - b.slot).forEach((actor, index) => {
    const preferred = formationPosition(centre, index);
    const position = findOpenMissionPosition(world, preferred, actor.radius || 10, occupied, 216)
      || findOpenMissionPosition(world, actor.spawnPosition || centre, actor.radius || 10, occupied, 320)
      || preferred;
    occupied.push(position);
    actor.position = position;
    actor.velocity = { x: 0, y: 0 };
    actor.tether = { level: 'ok', distance: 0, returnToParty: false, movementBlocked: false };
    actor.inventoryOpen = false;
    actor.carryingPackageId = null;
    if (options.missionSpawn) actor.missionSpawnPosition = { ...position };
    else actor.missionSpawnPosition = null;
    if (actor.alive === false) {
      actor.alive = true;
      actor.state = 'alive';
      actor.respawnAtTick = null;
      actor.health = options.returnHealth ?? Math.max(1, actor.maxHealth);
      actor.shield = options.returnShield ?? actor.shield;
    } else if (options.healAll) {
      actor.health = options.returnHealth ?? Math.max(1, actor.maxHealth);
      actor.shield = options.returnShield ?? actor.shield;
    }
  });
}

function baseCentre(world) {
  const zone = world.staticMap.baseZones?.[0];
  if (zone) return { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
  return { ...activeActors(world)[0]?.spawnPosition };
}

function enterBaseState(world) {
  const base = createMissionState(world.staticMap, world.tick, 'base');
  base.board.options = [...BOARD_OPTIONS];
  base.board.layoutCounts = layoutCounts(world);
  world.mission = base;
  clearVoluntaryChaos(world);
  removeMissionHostiles(world);
  clearTransientCombat(world);
  closeActorOverlays(world);
  return base;
}

function openMissionBoard(world, actor) {
  if (!actor?.alive) return { ok: false, reason: 'actor-not-alive' };
  world.mission.status = 'board';
  world.mission.phase = 'board';
  world.mission.title = 'Party House Mission Board';
  world.mission.board = {
    options: [...BOARD_OPTIONS],
    selectedIndex: 0,
    controlActorId: actor.id,
    navigationHeld: false,
    layoutCounts: layoutCounts(world),
  };
  closeActorOverlays(world);
  return { ok: true, kind: 'mission-board-open', actorId: actor.id };
}

function beginCountdown(world, mode, actorId = null) {
  const definition = definitionFor(world, mode);
  if (!BOARD_OPTIONS.includes(mode) || mode === 'close') return { ok: false, reason: 'unknown-mission' };
  const layout = reserveMissionLayout(world, mode);
  world.mission.status = 'countdown';
  world.mission.phase = 'countdown';
  world.mission.mode = mode;
  world.mission.title = `${definition.title || missionLabel(mode)}${layout ? ` · ${layout.label}` : ''}`;
  world.mission.selectedMode = mode;
  world.mission.pendingLayout = layout;
  world.mission.countdownStartedAtTick = world.tick;
  world.mission.countdownEndsAtTick = world.tick + TICK_RATE * 10;
  world.mission.board.controlActorId = actorId || world.mission.board.controlActorId;
  world.mission.board.navigationHeld = false;
  closeActorOverlays(world);
  return { ok: true, kind: 'mission-countdown', mode, seconds: 10, layout };
}

function packageEntity(id, position, kind = 'courier') {
  return {
    id,
    kind,
    position: { ...position },
    spawnPosition: { ...position },
    status: 'available',
    ownerActorId: null,
    claimedAtTick: null,
    deliveredAtTick: null,
    deliveredByActorId: null,
    deliveryZoneId: null,
    vehicleAssisted: false,
    carrierActorId: null,
    delivered: false,
    claimVersion: 0,
  };
}

function individualStats(world) {
  return Object.fromEntries(activeActors(world).map((actor) => [actor.id, {
    actorId: actor.id,
    displayName: actor.displayName,
    deliveries: 0,
    collections: 0,
    vehicleAssistedDeliveries: 0,
    fastestDeliveryTicks: null,
  }]));
}

function commonActiveMission(world, mode, definition, centre, layout = null) {
  const roundSeconds = Math.max(1, Number(definition.roundSeconds) || 120);
  const baseTitle = definition.title || missionLabel(mode);
  return {
    id: mode.replaceAll('_', '-'),
    mode,
    title: `${baseTitle}${layout ? ` · ${layout.label}` : ''}`,
    baseTitle,
    description: definition.description || '',
    layout,
    status: 'active',
    phase: 'active',
    startedAtTick: world.tick,
    endsAtTick: world.tick + TICK_RATE * roundSeconds,
    selectedMode: mode,
    missionStart: { ...centre },
    rewardCents: Math.max(0, Number(definition.rewardCents) || 0),
    rewardGranted: false,
    goal: Math.max(0, Number(definition.goal) || 0),
    deliveredCount: 0,
    partyScores: { party_a: 0, party_b: 0 },
    individual: individualStats(world),
    fastestDeliveryTicks: null,
    winnerPartyId: null,
    packages: [],
    activeDeliveryZoneIds: [],
    deliveryZones: [],
    pickupZone: null,
    droppedPackages: 0,
    revives: 0,
    result: null,
    board: { options: [...BOARD_OPTIONS], selectedIndex: 0, controlActorId: null, navigationHeld: false },
  };
}

function partyThreatScale(world) {
  const count = Math.max(1, Math.min(4, activeActors(world).filter((actor) => actor.partyId === 'party_a').length));
  return [0, 1, 1.5, 2, 2.5][count];
}

function spawnRelayWave(world, wave) {
  const baseCounts = [2, 3, 4];
  const maximums = [0, 5, 7, 9, 11];
  const playerCount = Math.max(1, Math.min(4, activeActors(world).filter((actor) => actor.partyId === 'party_a').length));
  const count = Math.min(maximums[playerCount], Math.ceil(baseCounts[wave - 1] * partyThreatScale(world)));
  const centre = world.mission.relay.position;
  const layout = layoutFor(world, 'hold_relay', world.mission.layout?.id);
  const offsets = Array.isArray(layout?.enemySpawnOffsets) && layout.enemySpawnOffsets.length
    ? layout.enemySpawnOffsets
    : [[-220, 0], [220, 0], [0, -220], [0, 220], [-180, -150], [180, 150]];
  const configuredRoles = layout?.waveRoles?.[wave - 1];
  const roles = Array.isArray(configuredRoles) && configuredRoles.length
    ? configuredRoles
    : wave === 1 ? ['rusher', 'skirmisher'] : wave === 2
      ? ['rusher', 'skirmisher', 'blocker'] : ['blocker', 'rusher', 'sapper', 'skirmisher'];
  const occupied = [];
  for (let index = 0; index < count; index += 1) {
    const [offsetX, offsetY] = offsets[index % offsets.length];
    const preferred = { x: centre.x + offsetX, y: centre.y + offsetY };
    const point = findOpenMissionPosition(world, preferred, 9, occupied, 168) || preferred;
    occupied.push(point);
    const id = `rival-wave-${wave}-${index + 1}`;
    world.npcs[id] = createHostileNpc({
      id,
      faction: 'neon-rivals',
      role: roles[index % roles.length],
      position: { ...point },
      source: 'mission',
      kind: 'rival',
    });
  }
  world.mission.wave = wave;
  world.mission.waveSpawnedAtTick = world.tick;
  world.mission.nextWaveAtTick = null;
  return count;
}

function spawnSupplyGuards(world, layout) {
  const count = Math.max(0, Math.min(3, Number(layout?.guardCount) || 0));
  const offsets = Array.isArray(layout?.guardOffsets) && layout.guardOffsets.length
    ? layout.guardOffsets
    : [[-150, 0], [150, 0], [0, 150]];
  const occupied = [];
  for (let index = 0; index < count; index += 1) {
    const [offsetX, offsetY] = offsets[index % offsets.length];
    const preferred = { x: world.mission.missionStart.x + offsetX, y: world.mission.missionStart.y + offsetY };
    const point = findOpenMissionPosition(world, preferred, 9, occupied, 144) || preferred;
    occupied.push(point);
    const id = `rival-supply-${index + 1}`;
    world.npcs[id] = createHostileNpc({
      id,
      faction: 'neon-rivals',
      role: index === 2 ? 'sapper' : index % 2 === 0 ? 'rusher' : 'skirmisher',
      position: point,
      source: 'mission',
      kind: 'rival',
    });
  }
  world.mission.guardCount = count;
  return count;
}

function startMission(world, mode, options = {}) {
  const definition = definitionFor(world, mode);
  const controlActorId = world.mission?.board?.controlActorId || world.mission?.controlActorId || null;
  const pendingLayout = !options.layoutId && world.mission?.selectedMode === mode ? world.mission.pendingLayout : null;
  const selectedLayout = pendingLayout && layoutFor(world, mode, pendingLayout.id)
    ? pendingLayout
    : reserveMissionLayout(world, mode, options.layoutId || null);
  const layout = layoutFor(world, mode, selectedLayout?.id);
  const requestedCentre = layout?.start || definition.start || (mode === 'courier_chaos'
    ? { x: world.staticMap.mission.depot.x + world.staticMap.mission.depot.width / 2, y: world.staticMap.mission.depot.y + world.staticMap.mission.depot.height / 2 }
    : { x: world.staticMap.width / 2, y: world.staticMap.height / 2 });
  const centre = findOpenMissionPosition(world, requestedCentre, 16, [], 192) || requestedCentre;
  removeMissionHostiles(world);
  clearTransientCombat(world);
  ejectPartyVehicles(world, 'mission-teleport');
  closeActorOverlays(world);
  teleportActors(world, centre, { missionSpawn: true, healAll: true, returnHealth: 100, returnShield: 1 });
  const mission = commonActiveMission(world, mode, definition, centre, selectedLayout);
  mission.controlActorId = controlActorId;

  if (mode === 'supply_sweep') {
    const offsets = Array.isArray(layout?.packageOffsets) && layout.packageOffsets.length
      ? layout.packageOffsets
      : [[-90,-60],[0,-70],[90,-55],[-80,65],[0,76],[86,58]];
    mission.goal = Math.max(1, Number(definition.goal) || 6);
    const occupied = [];
    mission.packages = offsets.slice(0, mission.goal).map(([x, y], index) => {
      const preferred = { x: centre.x + x, y: centre.y + y };
      const point = findOpenMissionPosition(world, preferred, 8, occupied, 132) || preferred;
      occupied.push(point);
      return packageEntity(`supply-${index + 1}`, point, 'supply');
    });
  } else if (mode === 'courier_chaos') {
    const configuredOffsets = Array.isArray(layout?.packageOffsets) ? layout.packageOffsets : [];
    const staticSpawns = world.staticMap.mission.packageSpawns || [];
    const requestedSpawns = configuredOffsets.length
      ? configuredOffsets.map(([x, y]) => ({ x: centre.x + x, y: centre.y + y }))
      : staticSpawns;
    mission.goal = Math.max(1, Number(definition.deliveryGoal) || requestedSpawns.length);
    const occupied = [];
    mission.packages = requestedSpawns.slice(0, mission.goal).map((spawn, index) => {
      const point = findOpenMissionPosition(world, spawn, 8, occupied, 132) || spawn;
      occupied.push(point);
      return packageEntity(`package-${String(index + 1).padStart(2, '0')}`, point);
    });
    const configuredZoneIds = Array.isArray(layout?.deliveryZoneIds) ? layout.deliveryZoneIds : definition.deliveryZoneIds;
    const knownZoneIds = new Set((world.staticMap.mission.deliveryZones || []).map((zone) => zone.id));
    mission.activeDeliveryZoneIds = (configuredZoneIds || []).filter((id) => knownZoneIds.has(id));
    if (!mission.activeDeliveryZoneIds.length) mission.activeDeliveryZoneIds = [...knownZoneIds];
    mission.deliveryZones = (world.staticMap.mission.deliveryZones || [])
      .filter((zone) => mission.activeDeliveryZoneIds.includes(zone.id))
      .map((zone) => ({ ...zone }));
    mission.pickupZone = {
      id: `dispatch-${selectedLayout?.id || 'default'}`,
      label: selectedLayout?.label || 'Courier Dispatch',
      x: centre.x - 112,
      y: centre.y - 62,
      width: 224,
      height: 124,
    };
  } else if (mode === 'hold_relay') {
    mission.goal = Math.max(1, Number(definition.waves) || 3);
    mission.wave = 0;
    mission.wavesCompleted = 0;
    mission.relay = {
      id: 'district-relay',
      position: { ...centre },
      includeInCamera: true,
      health: Math.max(1, Number(definition.relayHealth) || 30),
      maxHealth: Math.max(1, Number(definition.relayHealth) || 30),
    };
  } else if (mode === 'chaos_call') {
    mission.goal = Math.max(1, Number(definition.roundSeconds) || 90);
    triggerVoluntaryChaos(world);
  } else {
    return enterBaseState(world);
  }

  world.mission = mission;
  if (mode === 'supply_sweep') spawnSupplyGuards(world, layout);
  if (mode === 'hold_relay') spawnRelayWave(world, 1);
  return mission;
}

function nearestAvailablePackage(world, actor, maximumDistance = 38) {
  let nearest = null;
  let best = maximumDistance;
  for (const packageEntity of world.mission.packages || []) {
    if (packageEntity.status !== 'available') continue;
    const d = distance(actor.position, packageEntity.position);
    if (d <= best) {
      nearest = packageEntity;
      best = d;
    }
  }
  return nearest;
}

function claimPackage(world, actorId, packageId) {
  const actor = world.actors[actorId];
  const packageEntry = (world.mission.packages || []).find((entry) => entry.id === packageId);
  if (!actor || !packageEntry) return { ok: false, reason: 'not-found' };
  if (world.mission.status !== 'active') return { ok: false, reason: 'round-not-active' };
  if (!actor.alive) return { ok: false, reason: 'actor-not-alive' };
  if (actor.carryingPackageId) return { ok: false, reason: 'actor-already-carrying' };
  if (packageEntry.status !== 'available' || packageEntry.ownerActorId) return { ok: false, reason: 'package-unavailable' };
  if (distance(actor.position, packageEntry.position) > 42) return { ok: false, reason: 'package-too-far' };

  packageEntry.claimVersion += 1;
  packageEntry.claimedAtTick = world.tick;
  if (packageEntry.kind === 'supply') {
    packageEntry.status = 'delivered';
    packageEntry.delivered = true;
    packageEntry.deliveredAtTick = world.tick;
    packageEntry.deliveredByActorId = actor.id;
    world.mission.deliveredCount += 1;
    world.mission.partyScores[actor.partyId] = (world.mission.partyScores[actor.partyId] || 0) + 1;
    world.mission.individual[actor.id].collections += 1;
    if (world.mission.deliveredCount >= world.mission.goal) completeMission(world, true, 'supplies-collected');
    return { ok: true, packageId, actorId, collected: true };
  }

  packageEntry.status = 'carried';
  packageEntry.ownerActorId = actor.id;
  packageEntry.carrierActorId = actor.id;
  actor.carryingPackageId = packageEntry.id;
  return { ok: true, packageId, actorId };
}

function deliverPackage(world, actorId, deliveryZoneId) {
  const actor = world.actors[actorId];
  const zone = activeDeliveryZones(world).find((entry) => entry.id === deliveryZoneId);
  if (!actor || !zone || !actor.carryingPackageId) return { ok: false, reason: 'not-ready' };
  if (!isPointInZone(actor.position, zone, 6)) return { ok: false, reason: 'outside-delivery-zone' };
  const packageEntry = world.mission.packages.find((entry) => entry.id === actor.carryingPackageId);
  if (!packageEntry || packageEntry.status !== 'carried' || packageEntry.ownerActorId !== actor.id) {
    actor.carryingPackageId = null;
    return { ok: false, reason: 'stale-package-ownership' };
  }

  packageEntry.status = 'delivered';
  packageEntry.ownerActorId = null;
  packageEntry.carrierActorId = null;
  packageEntry.delivered = true;
  packageEntry.deliveredAtTick = world.tick;
  packageEntry.deliveredByActorId = actor.id;
  packageEntry.deliveryZoneId = zone.id;
  packageEntry.vehicleAssisted = actor.currentVehicleId !== null;
  actor.carryingPackageId = null;

  world.mission.deliveredCount += 1;
  const baseScore = Number(world.staticMap.mission.scorePerDelivery) || 100;
  const vehicleBonus = packageEntry.vehicleAssisted ? (Number(world.staticMap.mission.vehicleAssistBonus) || 0) : 0;
  world.mission.partyScores[actor.partyId] = (world.mission.partyScores[actor.partyId] || 0) + baseScore + vehicleBonus;
  const stats = world.mission.individual[actor.id];
  const deliveryTicks = world.tick - packageEntry.claimedAtTick;
  stats.deliveries += 1;
  if (packageEntry.vehicleAssisted) stats.vehicleAssistedDeliveries += 1;
  stats.fastestDeliveryTicks = stats.fastestDeliveryTicks == null ? deliveryTicks : Math.min(stats.fastestDeliveryTicks, deliveryTicks);
  world.mission.fastestDeliveryTicks = world.mission.fastestDeliveryTicks == null ? deliveryTicks : Math.min(world.mission.fastestDeliveryTicks, deliveryTicks);

  if (world.mission.deliveredCount >= world.mission.goal) completeMission(world, true, 'delivery-goal');
  return { ok: true, packageId: packageEntry.id, actorId, deliveryZoneId: zone.id, deliveryTicks };
}

function applyResultChoice(world, choice, actorId) {
  if (choice === 'continue') return { ok: true, kind: 'mission-continue', mission: enterBaseState(world) };
  if (choice === 'replay') return beginCountdown(world, world.mission.selectedMode, actorId);
  if (choice === 'mission_list') {
    const selectedMode = world.mission.selectedMode;
    enterBaseState(world);
    const actor = world.actors[actorId] || activeActors(world)[0];
    const opened = openMissionBoard(world, actor);
    world.mission.lastCompletedMode = selectedMode;
    return opened;
  }
  return { ok: false, reason: 'unknown-result-choice' };
}

function interactWithMission(world, actor) {
  if (!actor.alive) return { ok: false, reason: 'actor-not-alive' };
  const mission = world.mission;
  if (mission.status === 'base') {
    return isPointInZone(actor.position, world.staticMap.mission.board, 22)
      ? openMissionBoard(world, actor)
      : { ok: false, reason: 'mission-board-not-in-range' };
  }
  if (mission.status === 'board') {
    if (mission.board.controlActorId !== actor.id) return { ok: false, reason: 'mission-board-controlled-by-other-player' };
    const choice = mission.board.options[mission.board.selectedIndex];
    if (choice === 'close') return { ok: true, kind: 'mission-board-close', mission: enterBaseState(world) };
    return beginCountdown(world, choice, actor.id);
  }
  if (mission.status === 'countdown') {
    if (mission.board.controlActorId !== actor.id) return { ok: false, reason: 'countdown-controlled-by-other-player' };
    mission.status = 'board';
    mission.phase = 'board';
    delete mission.countdownEndsAtTick;
    return { ok: true, kind: 'mission-countdown-cancelled' };
  }
  if (mission.status === 'results') {
    if (world.tick < mission.resultsReadyAtTick) return { ok: false, reason: 'results-break-locked' };
    if (mission.board.controlActorId && mission.board.controlActorId !== actor.id) return { ok: false, reason: 'results-controlled-by-other-player' };
    mission.board.controlActorId ||= actor.id;
    return applyResultChoice(world, mission.board.options[mission.board.selectedIndex], actor.id);
  }
  if (mission.status !== 'active') return { ok: false, reason: 'round-not-active' };
  if (mission.mode === 'hold_relay' || mission.mode === 'chaos_call') return { ok: false, reason: 'no-mission-interaction-here' };
  if (actor.carryingPackageId) {
    const zone = activeDeliveryZones(world).find((entry) => isPointInZone(actor.position, entry, 6));
    return zone ? deliverPackage(world, actor.id, zone.id) : { ok: false, reason: 'no-delivery-zone' };
  }
  const packageEntry = nearestAvailablePackage(world, actor);
  return packageEntry ? claimPackage(world, actor.id, packageEntry.id) : { ok: false, reason: 'no-package-nearby' };
}

function dropActorPackage(world, actor) {
  if (!actor.carryingPackageId) return false;
  const packageEntry = (world.mission.packages || []).find((entry) => entry.id === actor.carryingPackageId);
  if (packageEntry && packageEntry.status === 'carried') {
    packageEntry.status = 'available';
    packageEntry.ownerActorId = null;
    packageEntry.carrierActorId = null;
    packageEntry.position = { ...actor.position };
    world.mission.droppedPackages += 1;
  }
  actor.carryingPackageId = null;
  return true;
}

function completeMission(world, success, reason) {
  if (world.mission.status !== 'active') return world.mission.result;
  const mission = world.mission;
  const rewardCents = success && !mission.rewardGranted ? mission.rewardCents : 0;
  const rewardSplit = splitRewardCents(rewardCents);
  const rewardAllocations = [];
  if (rewardCents > 0) {
    for (const actor of activeActors(world)) rewardAllocations.push(creditSplitReward(world, actor, rewardCents));
    mission.rewardGranted = true;
  }
  mission.status = 'results';
  mission.phase = 'results';
  mission.completedAtTick = world.tick;
  mission.resultsReadyAtTick = world.tick + 60;
  mission.result = {
    success,
    reason,
    completedAtTick: world.tick,
    deliveredCount: mission.deliveredCount,
    wavesCompleted: mission.wavesCompleted || 0,
    relayHealth: mission.relay?.health ?? null,
    layout: mission.layout ? { ...mission.layout } : null,
    guardCount: mission.guardCount || 0,
    partyScores: { ...mission.partyScores },
    rewardCents,
    personalRewardCents: rewardSplit.personalCents,
    partyContributionCents: rewardSplit.partyCents,
    rewardSplit: {
      personalPercent: rewardSplit.personalPercent,
      partyPercent: rewardSplit.partyPercent,
    },
    rewardAllocations,
    partyFundContributions: rewardAllocations.reduce((totals, allocation) => {
      if (allocation.ok) totals[allocation.partyId] = (totals[allocation.partyId] || 0) + allocation.partyCreditedCents;
      return totals;
    }, { party_a: 0, party_b: 0 }),
    partyFundTotals: { ...world.economy.partyFunds },
  };
  mission.board = {
    options: [...RESULT_OPTIONS],
    selectedIndex: 0,
    controlActorId: mission.controlActorId || null,
    navigationHeld: false,
  };
  clearVoluntaryChaos(world);
  removeMissionHostiles(world);
  clearTransientCombat(world);
  ejectPartyVehicles(world, 'mission-return');
  teleportActors(world, baseCentre(world), { returnHealth: 50, returnShield: 0 });
  closeActorOverlays(world);
  return mission.result;
}

function finishRound(world, reason) {
  return completeMission(world, reason !== 'timer' && reason !== 'party-downed' && reason !== 'relay-destroyed', reason);
}

function updateNavigation(world) {
  const mission = world.mission;
  if (!['board', 'results'].includes(mission.status)) return;
  const controller = world.actors[mission.board.controlActorId]
    || activeActors(world).find((actor) => ['human', 'adapter'].includes(actor.controller))
    || activeActors(world)[0];
  if (!controller) return;
  mission.board.controlActorId ||= controller.id;
  const moveY = Number(controller.input?.moveY) || 0;
  if (Math.abs(moveY) < 0.25) mission.board.navigationHeld = false;
  if (Math.abs(moveY) >= 0.55 && !mission.board.navigationHeld) {
    const direction = moveY > 0 ? 1 : -1;
    const length = mission.board.options.length;
    mission.board.selectedIndex = (mission.board.selectedIndex + direction + length) % length;
    mission.board.navigationHeld = true;
  }
}

function updateHeldPackages(world) {
  for (const packageEntry of world.mission.packages || []) {
    if (packageEntry.status !== 'carried') continue;
    const owner = world.actors[packageEntry.ownerActorId];
    if (owner?.alive) packageEntry.position = { ...owner.position };
    else if (owner) dropActorPackage(world, owner);
  }
}

function updateRelayMission(world) {
  const mission = world.mission;
  if (mission.relay.health <= 0) {
    completeMission(world, false, 'relay-destroyed');
    return;
  }
  const livingMissionHostiles = Object.values(world.npcs).filter((npc) => npc.source === 'mission' && npc.alive);
  if (livingMissionHostiles.length === 0 && mission.nextWaveAtTick == null) {
    mission.wavesCompleted = mission.wave;
    if (mission.wave >= mission.goal) {
      completeMission(world, true, 'waves-cleared');
      return;
    }
    mission.nextWaveAtTick = world.tick + 60;
  }
  if (mission.nextWaveAtTick !== null && world.tick >= mission.nextWaveAtTick) spawnRelayWave(world, mission.wave + 1);
}

function updateMission(world) {
  if (world.territory?.enabled) return;
  updateNavigation(world);
  const mission = world.mission;
  if (mission.status === 'countdown' && world.tick >= mission.countdownEndsAtTick) {
    startMission(world, mission.selectedMode);
    return;
  }
  if (mission.status !== 'active') return;
  updateHeldPackages(world);
  if (livingActors(world).length === 0) {
    completeMission(world, false, 'party-downed');
    return;
  }
  if (mission.mode === 'hold_relay') updateRelayMission(world);
  if (world.mission.status !== 'active') return;
  if (world.tick >= mission.endsAtTick) {
    completeMission(world, mission.mode === 'chaos_call', mission.mode === 'chaos_call' ? 'chaos-survived' : 'timer');
  }
}

function restartMission(world) {
  const mode = world.mission.selectedMode || world.mission.mode || 'courier_chaos';
  return startMission(world, mode === 'free_roam' ? 'courier_chaos' : mode);
}

function isMissionInputLocked(world) {
  return world.territory?.status === 'results'
    || ['board', 'countdown', 'results'].includes(world.mission?.status);
}

module.exports = {
  BOARD_OPTIONS,
  MISSION_LABELS,
  RESULT_OPTIONS,
  activeDeliveryZones,
  applyResultChoice,
  beginCountdown,
  claimPackage,
  completeMission,
  deliverPackage,
  dropActorPackage,
  enterBaseState,
  finishRound,
  findOpenMissionPosition,
  interactWithMission,
  isMissionInputLocked,
  layoutsFor,
  missionLabel,
  nearestAvailablePackage,
  openMissionBoard,
  partyThreatScale,
  reserveMissionLayout,
  restartMission,
  spawnRelayWave,
  startMission,
  updateMission,
};
