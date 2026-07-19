'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { mergeCombatRules } = require('../shared/party-rules');
const { PARTY_TETHER, TICK_RATE } = require('../shared/constants');
const { initializeActorVitals } = require('./base-system');
const { createInventory } = require('./inventory-system');
const { createHostileNpc } = require('./npc-factory');
const { createEconomyState } = require('./economy-system');

const STATIC_MAP_CACHE = new Map();

const DEFAULT_STATIC_MAP = Object.freeze({
  id: 'district-four-blocks-v0-1',
  source: 'structured-json-fallback-not-tiled',
  width: 1024,
  height: 768,
  tileSize: 16,
  background: '#172f35',
  roads: [
    { id: 'road-horizontal', x: 0, y: 306, width: 1024, height: 148 },
    { id: 'road-vertical', x: 438, y: 0, width: 148, height: 768 },
    { id: 'road-west-loop', x: 40, y: 40, width: 80, height: 688 },
    { id: 'road-east-loop', x: 904, y: 40, width: 80, height: 688 },
  ],
  obstacles: [
    { id: 'building-nw', x: 208, y: 72, width: 190, height: 170, kind: 'building' },
    { id: 'building-ne', x: 628, y: 78, width: 198, height: 158, kind: 'building' },
    { id: 'building-sw', x: 230, y: 510, width: 176, height: 172, kind: 'building' },
    { id: 'building-se', x: 638, y: 522, width: 196, height: 162, kind: 'building' },
    { id: 'park-planter-1', x: 678, y: 276, width: 78, height: 26, kind: 'planter' },
    { id: 'park-planter-2', x: 778, y: 462, width: 76, height: 26, kind: 'planter' },
  ],
  areas: [
    { id: 'spawn-plaza', label: 'Safe Spawn Plaza', x: 82, y: 94, width: 130, height: 130, kind: 'plaza' },
    { id: 'depot', label: 'Courier Depot', x: 70, y: 560, width: 136, height: 128, kind: 'depot' },
    { id: 'park', label: 'Pocket Park', x: 646, y: 252, width: 230, height: 248, kind: 'park' },
    { id: 'garage', label: 'District Garage', x: 72, y: 252, width: 120, height: 210, kind: 'garage' },
    { id: 'combat-yard', label: 'Open Yard', x: 232, y: 250, width: 180, height: 214, kind: 'open' },
    { id: 'alley', label: 'Market Alley', x: 592, y: 246, width: 38, height: 264, kind: 'alley' },
  ],
  safeZones: [
    { id: 'spawn-plaza-safe', x: 70, y: 82, width: 152, height: 152 },
    { id: 'depot-pickup-safe', x: 62, y: 548, width: 156, height: 150 },
  ],
  saveTerminals: [
    { id: 'party-house-save-computer', name: 'GROUP SAVE COMPUTER', x: 174, y: 174, width: 38, height: 34, interactionDistance: 54 },
  ],
  interiorZones: [],
  playerSpawns: [
    { x: 110, y: 125 }, { x: 155, y: 125 }, { x: 110, y: 172 }, { x: 155, y: 172 },
    { x: 868, y: 596 }, { x: 908, y: 596 }, { x: 868, y: 640 }, { x: 908, y: 640 },
  ],
  vehicleSpawns: [
    { id: 'vehicle-001', x: 145, y: 350, rotation: 0, style: 'teal' },
    { id: 'vehicle-002', x: 875, y: 390, rotation: Math.PI, style: 'amber' },
  ],
  npcSpawns: [
    { x: 330, y: 280, routeId: 'route-market-loop' }, { x: 390, y: 470, routeId: 'route-market-loop' },
    { x: 620, y: 335, routeId: 'route-park-loop' }, { x: 720, y: 495, routeId: 'route-park-loop' },
    { x: 475, y: 105, routeId: 'route-central-north' }, { x: 540, y: 660, routeId: 'route-central-south' },
    { x: 900, y: 270, routeId: 'route-east-loop' }, { x: 90, y: 490, routeId: 'route-west-loop' },
  ],
  npcRoutes: {
    'route-market-loop': [{ x: 244, y: 278 }, { x: 406, y: 278 }, { x: 406, y: 474 }, { x: 244, y: 474 }],
    'route-park-loop': [{ x: 654, y: 270 }, { x: 858, y: 270 }, { x: 858, y: 500 }, { x: 654, y: 500 }],
    'route-central-north': [{ x: 470, y: 62 }, { x: 552, y: 62 }, { x: 552, y: 286 }, { x: 470, y: 286 }],
    'route-central-south': [{ x: 470, y: 480 }, { x: 552, y: 480 }, { x: 552, y: 706 }, { x: 470, y: 706 }],
    'route-east-loop': [{ x: 878, y: 80 }, { x: 930, y: 80 }, { x: 930, y: 680 }, { x: 878, y: 680 }],
    'route-west-loop': [{ x: 72, y: 246 }, { x: 174, y: 246 }, { x: 174, y: 512 }, { x: 72, y: 512 }],
  },
  mission: {
    depot: { id: 'depot-zone', x: 92, y: 584, width: 96, height: 84 },
    deliveryZones: [
      { id: 'delivery-north-east', label: 'North Market', x: 852, y: 104, width: 72, height: 74 },
      { id: 'delivery-south-east', label: 'Park Gate', x: 850, y: 610, width: 78, height: 76 },
    ],
    packageSpawns: [{ x: 114, y: 610 }, { x: 150, y: 610 }, { x: 114, y: 650 }, { x: 150, y: 650 }],
  },
});

function cloneStaticMap(staticMap) {
  return {
    ...staticMap,
    roads: [...(staticMap.roads || [])],
    obstacles: [...(staticMap.obstacles || [])],
    areas: [...(staticMap.areas || [])],
    safeZones: (staticMap.safeZones || []).map((zone) => ({ ...zone })),
    baseZones: (staticMap.baseZones || []).map((zone) => ({ ...zone })),
    saveTerminals: (staticMap.saveTerminals || []).map((terminal) => ({ ...terminal })),
    interiorZones: (staticMap.interiorZones || []).map((zone) => ({ ...zone, entrance: zone.entrance ? { ...zone.entrance } : null })),
    playerSpawns: (staticMap.playerSpawns || []).map((spawn) => ({ ...spawn })),
    vehicleSpawns: (staticMap.vehicleSpawns || []).map((spawn) => ({ ...spawn })),
    npcSpawns: (staticMap.npcSpawns || []).map((spawn) => ({ ...spawn })),
    rivalSpawns: (staticMap.rivalSpawns || []).map((spawn) => ({ ...spawn })),
    mission: JSON.parse(JSON.stringify(staticMap.mission || {})),
    territory: JSON.parse(JSON.stringify(staticMap.territory || {})),
  };
}

function loadStaticMap(projectRoot) {
  const mapPath = path.join(projectRoot, 'data', 'map.json');
  const cached = STATIC_MAP_CACHE.get(mapPath);
  if (cached) return cloneStaticMap(cached);
  try {
    const parsed = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    if (parsed && Number(parsed.width) > 0 && Number(parsed.height) > 0) {
      STATIC_MAP_CACHE.set(mapPath, parsed);
      return cloneStaticMap(parsed);
    }
    if (parsed?.world && Number(parsed.world.width) > 0 && Number(parsed.world.height) > 0) {
      const normalized = normalizeClientMap(parsed, projectRoot);
      STATIC_MAP_CACHE.set(mapPath, normalized);
      return cloneStaticMap(normalized);
    }
  } catch {
    // The standalone harness deliberately retains a built-in structured map fallback.
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATIC_MAP));
}

function readOptionalJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalizeRect(entry) {
  return {
    ...entry,
    width: Number(entry.width ?? entry.w) || 0,
    height: Number(entry.height ?? entry.h) || 0,
  };
}

function loadChunkLayers(clientMap, projectRoot) {
  const combined = {
    ground: [], roads: [], sidewalks: [], buildings: [], details_below: [], details_above: [], collision: [],
  };
  if (clientMap.chunking?.enabled !== true || !Array.isArray(clientMap.chunking.chunks)) return combined;
  for (const entry of clientMap.chunking.chunks) {
    const relative = String(entry.path || '').replace(/^\/+/, '');
    if (!relative.startsWith('data/map-chunks/')) continue;
    const chunk = readOptionalJson(path.join(projectRoot, relative), null);
    if (!chunk?.layers) continue;
    for (const layer of Object.keys(combined)) combined[layer].push(...(chunk.layers[layer] || []));
  }
  return combined;
}

function normalizeClientMap(clientMap, projectRoot) {
  const layers = clientMap.layers || {};
  const chunkLayers = loadChunkLayers(clientMap, projectRoot);
  const routeData = readOptionalJson(path.join(projectRoot, 'data', 'npc-routes.json'), { routes: [] });
  const missionData = readOptionalJson(path.join(projectRoot, 'data', 'missions.json'), {});
  const missionLayoutData = readOptionalJson(path.join(projectRoot, 'data', 'mission-layouts.json'), { modes: {} });
  const vehicleData = readOptionalJson(path.join(projectRoot, 'data', 'vehicle-spawns.json'), {});
  const territoryData = readOptionalJson(path.join(projectRoot, 'data', 'territory-zones.json'), {});
  const mode = missionData.courier_chaos || {};
  const pickup = (layers.mission_zones || []).find((zone) => zone.kind === 'pickup')
    || { id: 'depot-zone', x: 650, y: 330, w: 220, h: 70 };
  const deliveryZones = (layers.mission_zones || []).filter((zone) => zone.kind === 'delivery').map(normalizeRect);
  const missionBoard = normalizeRect(
    (layers.mission_zones || []).find((zone) => zone.kind === 'mission_board')
      || { id: 'party-house-mission-board', x: 728, y: 810, w: 88, h: 38 },
  );
  const packageCount = Math.max(1, Math.min(12, Number(mode.deliveryGoal) || 5));
  const columns = Math.min(3, packageCount);
  const packageSpawns = Array.from({ length: packageCount }, (_, index) => ({
    x: pickup.x + 30 + (index % columns) * 46,
    y: pickup.y + 22 + Math.floor(index / columns) * 34,
  }));
  const missionCatalog = JSON.parse(JSON.stringify(missionData));
  for (const [missionMode, layoutEntry] of Object.entries(missionLayoutData.modes || {})) {
    if (!missionCatalog[missionMode] || !Array.isArray(layoutEntry?.layouts)) continue;
    missionCatalog[missionMode].layouts = layoutEntry.layouts.map((layout) => JSON.parse(JSON.stringify(layout)));
  }
  missionCatalog.layoutSchemaVersion = Number(missionLayoutData.schemaVersion) || 1;
  missionCatalog.layoutSelection = missionLayoutData.selectionPolicy || missionData.layoutSelection || 'host-route-deck';
  const layerVehicles = layers.vehicle_spawns || [];
  const vehicleSpawns = Array.isArray(vehicleData.vehicles) && vehicleData.vehicles.length
    ? vehicleData.vehicles
    : layerVehicles;
  const chunkBuildings = chunkLayers.buildings.map((entry) => ({ ...normalizeRect(entry), kind: 'building' }));
  const chunkWaterCollision = chunkLayers.details_below.filter((entry) => entry.collision === true).map(normalizeRect);
  const chunkBuildingCollision = chunkBuildings.filter((entry) => entry.collision === true);
  return {
    id: clientMap.id,
    source: clientMap.generatedWithTiled ? 'tiled' : 'structured-json-not-tiled',
    width: Number(clientMap.world.width),
    height: Number(clientMap.world.height),
    tileSize: Number(clientMap.tileSize) || 16,
    background: clientMap.palette?.ground || '#233a35',
    roads: [...(layers.roads || []), ...chunkLayers.roads].map(normalizeRect),
    obstacles: [
      ...(layers.collision || []).map(normalizeRect),
      ...chunkBuildingCollision,
      ...chunkWaterCollision,
      ...(chunkLayers.collision || []).map(normalizeRect),
    ],
    areas: [
      ...(layers.buildings || []).map((entry) => ({ ...normalizeRect(entry), kind: 'building' })),
      ...(layers.ground || []).filter((entry) => entry.id === 'park').map((entry) => ({ ...normalizeRect(entry), kind: 'park' })),
      ...chunkBuildings,
    ],
    safeZones: (layers.safe_zones || []).map(normalizeRect),
    baseZones: (layers.base_zones || []).map(normalizeRect),
    saveTerminals: (layers.save_terminals || []).map(normalizeRect),
    interiorZones: (layers.interior_zones || []).map(normalizeRect),
    playerSpawns: [...(layers.player_spawns || [])].sort((a, b) => a.slot - b.slot),
    vehicleSpawns,
    npcSpawns: layers.npc_spawns || [],
    rivalSpawns: layers.rival_spawns || [],
    npcRoutes: Object.fromEntries((routeData.routes || []).map((route) => [route.id, route.points || []])),
    mission: {
      depot: normalizeRect(pickup),
      deliveryZones,
      board: missionBoard,
      packageSpawns,
      roundSeconds: Number(mode.roundSeconds) || 180,
      deliveryGoal: packageCount,
      scorePerDelivery: Number(mode.scorePerDelivery) || 100,
      vehicleAssistBonus: Number(mode.vehicleAssistBonus) || 0,
      catalog: missionCatalog,
    },
    territory: territoryData,
    clientMapId: clientMap.id,
    chunking: clientMap.chunking || null,
    spatialCellSize: Number(clientMap.chunking?.chunkSize) || 512,
  };
}

function createActor(player, spawn) {
  return initializeActorVitals({
    id: player.actorId,
    kind: 'player',
    controller: player.controllerType,
    seatId: player.seatId,
    slot: player.slot,
    partyId: player.partyId,
    displayName: player.displayName,
    adapterId: player.adapterId,
    connected: false,
    lastInputAt: 0,
    inputSequence: -1,
    actionHeld: false,
    inputHeld: {},
    pendingPulses: {},
    input: {
      moveX: 0, moveY: 0, aimX: 0, aimY: 0, aimActive: false,
      action: false, attack: false, fire: false, sprint: false, brake: false,
      inventoryToggle: false, inventoryPrev: false, inventoryNext: false, inventoryActivate: false,
    },
    inventory: createInventory(),
    inventoryOpen: false,
    position: { x: spawn.x, y: spawn.y },
    spawnPosition: { x: spawn.x, y: spawn.y },
    velocity: { x: 0, y: 0 },
    facing: { x: 1, y: 0 },
    radius: 10,
    health: 100,
    maxHealth: 100,
    alive: true,
    state: 'alive',
    currentVehicleId: null,
    vehicleSeat: null,
    weaponId: 'pulse-sidearm',
    nextAttackTick: 0,
    fireQueuedUntilTick: null,
    respawnAtTick: null,
    missionSpawnPosition: null,
    damageImmuneUntilTick: 0,
    carryingPackageId: null,
    walletCents: 10000,
    career: { deliveries: 0, missionsCompleted: 0 },
    tether: { level: 'ok', distance: 0, returnToParty: false, movementBlocked: false },
    aiState: player.controllerType === 'ai' ? 'follow_party' : null,
    aiPath: [],
    aiPathTargetKey: null,
    aiRepathAtTick: 0,
  });
}

function createVehicle(spawn) {
  const health = Math.max(1, Number(spawn.health) || 50);
  return {
    id: spawn.id,
    kind: 'vehicle',
    position: { x: spawn.x, y: spawn.y },
    spawnPosition: { x: spawn.x, y: spawn.y },
    rotation: spawn.rotation || 0,
    speed: 0,
    velocity: { x: 0, y: 0 },
    radius: 20,
    driverActorId: null,
    passengerActorIds: [],
    maxOccupants: Number(spawn.maxOccupants ?? spawn.capacity) || 4,
    health,
    maxHealth: health,
    destroyed: false,
    destroyedAtTick: null,
    respawnAtTick: null,
    partyOwnerId: null,
    style: spawn.style || 'teal',
    hostOwned: true,
  };
}

function createNpc(spawn, index) {
  const initialStates = ['idle', 'wander', 'follow_route', 'follow_route'];
  const health = 20 + ((index * 11 + 7) % 31);
  return {
    id: spawn.id || `npc-${String(index + 1).padStart(3, '0')}`,
    kind: 'civilian',
    controller: 'ai',
    partyId: null,
    state: initialStates[index % initialStates.length],
    position: { x: spawn.x, y: spawn.y },
    velocity: { x: 0, y: 0 },
    facing: { x: 0, y: 1 },
    radius: 8,
    health,
    maxHealth: health,
    alive: true,
    spawnPosition: { x: spawn.x, y: spawn.y },
    downedAtTick: null,
    respawnAtTick: null,
    routeId: spawn.routeId,
    routeIndex: index % 4,
    stateUntilTick: index % 4 === 0 ? 45 + index * 3 : index % 4 === 1 ? 60 + index * 4 : 0,
  };
}

function createMissionState(staticMap, tick = 0, status = 'base') {
  const spawns = staticMap.mission.packageSpawns || [];
  if (status !== 'active') {
    return {
      id: 'party-house-mission-board',
      mode: 'free_roam',
      title: 'Party House',
      status: 'base',
      phase: 'base',
      startedAtTick: null,
      endsAtTick: null,
      goal: 0,
      deliveredCount: 0,
      partyScores: { party_a: 0, party_b: 0 },
      individual: {},
      packages: [],
      droppedPackages: 0,
      revives: 0,
      result: null,
      board: {
        options: ['supply_sweep', 'hold_relay', 'courier_chaos', 'chaos_call', 'close'],
        selectedIndex: 0,
        controlActorId: null,
      },
    };
  }
  return {
    id: 'courier-chaos',
    mode: 'courier_chaos',
    status: 'active',
    startedAtTick: tick,
    endsAtTick: tick + TICK_RATE * (Number(staticMap.mission.roundSeconds) || 180),
    goal: Number(staticMap.mission.deliveryGoal) || spawns.length,
    deliveredCount: 0,
    partyScores: { party_a: 0, party_b: 0 },
    individual: {},
    fastestDeliveryTicks: null,
    winnerPartyId: null,
    packages: spawns.map((spawn, index) => ({
      id: `package-${String(index + 1).padStart(2, '0')}`,
      position: { x: spawn.x, y: spawn.y },
      spawnPosition: { x: spawn.x, y: spawn.y },
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
    })),
    droppedPackages: 0,
    revives: 0,
    result: null,
  };
}

function createTerritoryState(staticMap, tick = 0, enabled = false) {
  const config = staticMap.territory || {};
  if (!enabled || config.mode !== 'district_dominion') {
    return {
      enabled: false,
      mode: 'district_dominion',
      status: 'inactive',
      zones: [],
      commandPosts: {},
    };
  }
  const reinforcement = config.reinforcement || {};
  const zones = (config.zones || []).map((zone) => {
    const initialOwnerPartyId = ['party_a', 'party_b'].includes(zone.initialOwnerPartyId)
      ? zone.initialOwnerPartyId
      : null;
    return {
      id: zone.id,
      label: zone.label || zone.id,
      x: Number(zone.x) || 0,
      y: Number(zone.y) || 0,
      radius: Math.max(24, Number(zone.radius) || 52),
      progress: initialOwnerPartyId === 'party_a' ? 100 : initialOwnerPartyId === 'party_b' ? -100 : 0,
      ownerPartyId: initialOwnerPartyId,
      capturingPartyId: null,
      contested: false,
      presence: { party_a: 0, party_b: 0 },
    };
  });
  const roundSeconds = Math.max(30, Number(config.roundSeconds) || 300);
  return {
    enabled: true,
    id: config.id || 'district-dominion-v0-1',
    mode: 'district_dominion',
    title: config.title || 'District Dominion',
    status: 'active',
    phase: 'active',
    startedAtTick: tick,
    endsAtTick: tick + TICK_RATE * roundSeconds,
    completedAtTick: null,
    winnerPartyId: null,
    result: null,
    roundSeconds,
    scoreGoal: Math.max(10, Number(config.scoreGoal) || 180),
    captureRatePerSecond: Math.max(1, Number(config.captureRatePerSecond) || 15),
    scoreIntervalSeconds: Math.max(0.25, Number(config.scoreIntervalSeconds) || 1),
    incomeIntervalSeconds: Math.max(1, Number(config.incomeIntervalSeconds) || 5),
    incomePerOwnedZoneCents: Math.max(0, Math.round(Number(config.incomePerOwnedZoneCents) || 0)),
    startingPartyFundCents: Math.max(0, Math.round(Number(config.startingPartyFundCents) || 0)),
    scoreAccumulator: 0,
    incomeAccumulator: 0,
    scores: { party_a: 0, party_b: 0 },
    zones,
    commandPosts: JSON.parse(JSON.stringify(config.commandPosts || {})),
    reinforcement: {
      costCents: Math.max(1, Math.round(Number(reinforcement.costCents) || 2500)),
      squadSize: Math.max(1, Math.min(4, Math.round(Number(reinforcement.squadSize) || 2))),
      maxActivePerParty: Math.max(1, Math.min(8, Math.round(Number(reinforcement.maxActivePerParty) || 4))),
      lifetimeTicks: TICK_RATE * Math.max(10, Number(reinforcement.lifetimeSeconds) || 75),
      purchaseCooldownTicks: TICK_RATE * Math.max(0, Number(reinforcement.purchaseCooldownSeconds) || 3),
    },
    nextCrewNumber: 1,
    nextPurchaseTick: { party_a: 0, party_b: 0 },
    reinforcementsPurchased: { party_a: 0, party_b: 0 },
  };
}

function createTerritoryMissionState(territory) {
  return {
    id: territory.id,
    mode: territory.mode,
    title: territory.title,
    status: territory.status,
    phase: territory.phase,
    startedAtTick: territory.startedAtTick,
    endsAtTick: territory.endsAtTick,
    goal: territory.scoreGoal,
    deliveredCount: 0,
    partyScores: { ...territory.scores },
    individual: {},
    packages: [],
    droppedPackages: 0,
    result: null,
    board: { options: [], selectedIndex: 0, controlActorId: null },
  };
}

function addTerritorySupportZones(staticMap) {
  const posts = Object.values(staticMap.territory?.commandPosts || {});
  staticMap.safeZones = [];
  staticMap.baseZones = [];
  for (const post of posts) {
    if (post.safeZone && !staticMap.safeZones.some((zone) => zone.id === post.safeZone.id)) {
      staticMap.safeZones.push(normalizeRect(post.safeZone));
    }
    if (post.baseZone && !staticMap.baseZones.some((zone) => zone.id === post.baseZone.id)) {
      staticMap.baseZones.push(normalizeRect(post.baseZone));
    }
  }
}

function createWorldState({ players, settings = {}, projectRoot }) {
  const staticMap = loadStaticMap(projectRoot);
  const territoryMode = settings.mode === 'district_dominion';
  if (territoryMode) addTerritorySupportZones(staticMap);
  const actors = {};
  for (const player of players) {
    const territorySpawn = territoryMode
      ? (staticMap.territory?.playerSpawns || []).find((entry) => entry.slot === player.slot && entry.partyId === player.partyId)
      : null;
    const spawn = territorySpawn || staticMap.playerSpawns[player.slot - 1] || staticMap.playerSpawns[0];
    actors[player.actorId] = createActor(player, spawn);
  }
  const activeVehicleSpawns = territoryMode && Array.isArray(staticMap.territory?.vehicleSpawns)
    ? staticMap.territory.vehicleSpawns
    : staticMap.vehicleSpawns;
  const vehicles = Object.fromEntries(activeVehicleSpawns.map((spawn) => [spawn.id, createVehicle(spawn)]));
  const npcs = Object.fromEntries(staticMap.npcSpawns.slice(0, 8).map((spawn, index) => {
    const npc = createNpc(spawn, index);
    return [npc.id, npc];
  }));
  if (!territoryMode) {
    (staticMap.rivalSpawns?.length ? staticMap.rivalSpawns : [
      { x: staticMap.width / 2 + 250, y: staticMap.height / 2 - 80, role: 'rusher' },
      { x: staticMap.width / 2 + 280, y: staticMap.height / 2, role: 'skirmisher' },
      { x: staticMap.width / 2 + 250, y: staticMap.height / 2 + 80, role: 'blocker' },
    ]).forEach((entry, index) => {
      const npc = createHostileNpc({
        id: `rival-city-${index + 1}`,
        faction: 'neon-rivals',
        role: entry.role,
        position: entry,
        source: 'city',
        kind: 'rival',
      });
      npcs[npc.id] = npc;
    });
  }

  const economy = createEconomyState();
  const territory = createTerritoryState(staticMap, 0, territoryMode);
  if (territory.enabled) {
    economy.partyFunds.party_a = territory.startingPartyFundCents;
    economy.partyFunds.party_b = territory.startingPartyFundCents;
  }
  const world = {
    tick: 0,
    createdAt: Date.now(),
    mode: territory.enabled ? territory.mode : (settings.mode || 'coop_adventure'),
    staticMap,
    actors,
    npcs,
    vehicles,
    projectiles: {},
    effects: [],
    economy,
    mission: territory.enabled ? createTerritoryMissionState(territory) : createMissionState(staticMap, 0, 'base'),
    territory,
    justice: {
      mode: 'forgiving',
      heat: 0,
      stage: 'calm',
      voluntaryChaos: false,
      lastOffenseTick: null,
      civilianDamage: 0,
      civilianDowns: 0,
      warnings: 0,
    },
    rivalGang: {
      id: 'neon-rivals',
      name: 'Neon Rivals',
      pressure: 0,
      territorySystemImplemented: true,
      territoryModeActive: territory.enabled,
    },
    combatRules: mergeCombatRules(settings.combat || settings.combatRules || {}),
    tetherRules: {
      soft: Number(settings.tether?.soft) || PARTY_TETHER.soft,
      warning: Number(settings.tether?.warning) || PARTY_TETHER.warning,
      hard: Number(settings.tether?.hard) || PARTY_TETHER.hard,
    },
    metrics: {
      connectedControllers: 0,
      statePayloadBytes: 0,
      loopDriftMs: 0,
    },
    nextProjectileNumber: 1,
    nextNpcNumber: 100,
    randomSeed: 0x4a584d31,
    missionDirector: {
      seed: (Date.now() ^ 0x4d495353) >>> 0,
      decks: {},
      lastLayoutByMode: {},
      runsByMode: {},
      totalRuns: 0,
    },
  };
  return world;
}

function isPointInZone(position, zone, margin = 0) {
  return position.x >= zone.x - margin
    && position.x <= zone.x + zone.width + margin
    && position.y >= zone.y - margin
    && position.y <= zone.y + zone.height + margin;
}

function isInSafeZone(world, position) {
  return world.staticMap.safeZones.some((zone) => isPointInZone(position, zone));
}

function safeZoneForPosition(world, position) {
  return world.staticMap.safeZones.find((zone) => isPointInZone(position, zone)) || null;
}

module.exports = {
  DEFAULT_STATIC_MAP,
  createActor,
  createMissionState,
  createNpc,
  createTerritoryMissionState,
  createTerritoryState,
  createVehicle,
  createWorldState,
  isInSafeZone,
  isPointInZone,
  loadStaticMap,
  normalizeClientMap,
  safeZoneForPosition,
};
