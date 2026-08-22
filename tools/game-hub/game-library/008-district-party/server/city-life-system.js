'use strict';

const { TICK_RATE } = require('../shared/constants');
const { normalizeCents, spendPersonalFunds } = require('./economy-system');
const { createHostileNpc } = require('./npc-factory');
const {
  cycleBodyKit,
  cycleTunePreset,
  cycleVehiclePaint,
  ensureVehicleTuning,
  publicVehicleBuild,
  quoteVehicleUpgrade,
  upgradeVehiclePart,
} = require('./vehicle-tuning-system');
const {
  CITY_CONTRACT_OPTIONS,
  cityContractPrompt,
  ensureContractState,
  interactWithCityContract,
  startCityContract,
  updateCityContracts,
} = require('./city-contract-system');
const {
  canInstallArmoryGear,
  canRefillAmmo,
  collectCombatDrop,
  installArmoryGear,
  nearestCombatDrop,
  refillAmmo,
  startCombatDrill,
} = require('./combat-gear-system');

const VENUE_RADIUS = 72;
const ACTIVITY_RADIUS = 58;
const EVENT_TICKS = TICK_RATE * 45;
const CITIZEN_TALK_RADIUS = 48;
const CITY_DAY_TICKS = TICK_RATE * 120;
const CITY_DAY_START_MINUTE = 7 * 60 + 30;
const DUTY_STEP_TICKS = TICK_RATE * 8;

const VENUES = Object.freeze([
  Object.freeze({
    id: 'iron-lantern-armory',
    kind: 'armory',
    label: 'IRON LANTERN ARMORY',
    subtitle: 'weapons, armor, ammo and an optional mixed-role drill',
    position: Object.freeze({ x: 6240, y: 4190 }),
    accent: '#ffbd62',
    options: Object.freeze([
      Object.freeze({ id: 'sidearm-mk2', label: 'PULSE SIDEARM MK II', detail: '+2 damage and faster fire', priceCents: 2500 }),
      Object.freeze({ id: 'scatter-blaster', label: 'LANTERN SCATTER BLASTER', detail: 'three-projectile close-range spread plus 24 shells', priceCents: 3200 }),
      Object.freeze({ id: 'arc-carbine', label: 'UNDERCITY ARC CARBINE', detail: '10 damage, fast bolt and one-target pierce plus 20 cells', priceCents: 4500 }),
      Object.freeze({ id: 'ammo-refill', label: 'MATCHED AMMO REFILL', detail: '30 rounds for the currently equipped finite weapon', priceCents: 600 }),
      Object.freeze({ id: 'armor-lining', label: 'STREET WEAVE ARMOR', detail: '+25 maximum health and 12% damage reduction', priceCents: 2000 }),
      Object.freeze({ id: 'riot-plate', label: 'RIVALBREAKER RIOT PLATE', detail: '+40 maximum health and 22% damage reduction', priceCents: 3200 }),
      Object.freeze({ id: 'kinetic-boots', label: 'KINETIC STREET BOOTS', detail: '+12% movement speed with visible step trails', priceCents: 1600 }),
      Object.freeze({ id: 'combat-drill', label: 'START MIXED-ROLE DRILL', detail: 'optional four-enemy fight with gear drops and DC 8,00 clear bonus', priceCents: 0 }),
    ]),
  }),
  Object.freeze({
    id: 'neon-crown-casino',
    kind: 'casino',
    label: 'NEON CROWN CASINO',
    subtitle: 'high-card table and city intel',
    position: Object.freeze({ x: 6600, y: 4190 }),
    accent: '#db86ff',
    options: Object.freeze([
      Object.freeze({ id: 'high-card', label: 'PLAY HIGH CARD', detail: 'deterministic DC 5,00 table', priceCents: 500 }),
      Object.freeze({ id: 'vip-pass', label: 'VIP STREET PASS', detail: '+DC 2,00 on table wins', priceCents: 1500 }),
      Object.freeze({ id: 'street-tip', label: 'ASK FOR A STREET TIP', detail: 'reveal the current optional cache', priceCents: 0 }),
    ]),
  }),
  Object.freeze({
    id: 'party-crew-garage',
    kind: 'garage',
    label: 'PARTY CREW GARAGE',
    subtitle: 'bodyguards, gang cars and road control',
    position: Object.freeze({ x: 6045, y: 4680 }),
    accent: '#59e0b8',
    options: Object.freeze([
      Object.freeze({ id: 'hire-bodyguard', label: 'HIRE BODYGUARD', detail: 'armed NPC follows and protects you', priceCents: 3000 }),
      Object.freeze({ id: 'gang-car', label: 'ORDER ARMORED GANG CAR', detail: 'four seats, 100 vehicle health', priceCents: 4000 }),
      Object.freeze({ id: 'deploy-roadblock', label: 'DEPLOY STREET ROADBLOCK', detail: 'blocks the civic crossing for 60 seconds', priceCents: 1200 }),
    ]),
  }),
  Object.freeze({
    id: 'metro-dispatch',
    kind: 'jobs',
    label: 'METRO DISPATCH',
    subtitle: 'repeatable cooperative city jobs',
    position: Object.freeze({ x: 7040, y: 4680 }),
    accent: '#75efff',
    options: CITY_CONTRACT_OPTIONS,
  }),
  Object.freeze({
    id: 'undercroft-chop-shop',
    kind: 'chop-shop',
    label: 'UNDERCROFT CHOP SHOP',
    subtitle: 'tow, repair, tune and restyle a party car on the service pad',
    position: Object.freeze({ x: 7460, y: 4680 }),
    accent: '#ff766f',
    options: Object.freeze([
      Object.freeze({ id: 'repair-vehicle', label: 'REPAIR NEARBY CAR', detail: 'restore the nearest empty car to full health', priceCents: 700 }),
      Object.freeze({ id: 'tow-vehicle', label: 'TOW PARTY CAR', detail: 'bring the nearest empty claimed car to the shop pad', priceCents: 600 }),
      Object.freeze({ id: 'engine-vehicle', label: 'UPGRADE ENGINE', detail: 'three stages of acceleration and top speed', priceCents: 1400 }),
      Object.freeze({ id: 'tires-vehicle', label: 'UPGRADE TIRES', detail: 'three stages of steering response', priceCents: 900 }),
      Object.freeze({ id: 'brakes-vehicle', label: 'UPGRADE BRAKES', detail: 'two stages of braking and reverse response', priceCents: 700 }),
      Object.freeze({ id: 'armor-vehicle', label: 'FIT STREET ARMOR', detail: '+35 maximum vehicle health once', priceCents: 1600 }),
      Object.freeze({ id: 'tune-vehicle', label: 'TUNE HANDLING SETUP', detail: 'cycle Balanced, Grip, Drift and Sprint', priceCents: 500 }),
      Object.freeze({ id: 'body-vehicle', label: 'CHANGE BODY KIT', detail: 'cycle Stock, Street, Wide and Rally kits', priceCents: 700 }),
      Object.freeze({ id: 'paint-vehicle', label: 'PAINT + LIVERY', detail: 'cycle six visible paint packages', priceCents: 350 }),
      Object.freeze({ id: 'legalize-vehicle', label: 'SWAP PLATES + PAINT', detail: 'claim a stolen car and reduce justice heat', priceCents: 900 }),
    ]),
  }),
]);

const TRAFFIC_ROUTES = Object.freeze({
  'civic-clockwise': Object.freeze([
    Object.freeze({ x: 5000, y: 4066 }), Object.freeze({ x: 7350, y: 4066 }),
    Object.freeze({ x: 7350, y: 5218 }), Object.freeze({ x: 5000, y: 5218 }),
  ]),
  'civic-counter': Object.freeze([
    Object.freeze({ x: 7200, y: 4126 }), Object.freeze({ x: 5000, y: 4126 }),
    Object.freeze({ x: 5000, y: 5280 }), Object.freeze({ x: 7200, y: 5280 }),
  ]),
});

const ACTIVITY_SPOTS = Object.freeze([
  Object.freeze({ id: 'centre-cache', label: 'CENTRE STREET CACHE', position: Object.freeze({ x: 6144, y: 3820 }) }),
  Object.freeze({ id: 'market-cache', label: 'MARKET BACK-DOOR CACHE', position: Object.freeze({ x: 7040, y: 3690 }) }),
  Object.freeze({ id: 'harbour-cache', label: 'HARBOUR CREW CACHE', position: Object.freeze({ x: 7424, y: 5248 }) }),
]);

const EVENT_LABELS = Object.freeze([
  'COMMUTER RUN · stealable traffic active',
  'CASINO NIGHT · Neon Crown table open',
  'CREW PATROL · bodyguards and garage online',
]);

function citizenProfile(id, name, label, badge, colour, shiftStartMinute, shiftDurationMinutes, workLabel, workPoints, dutyActions, leisureLabel, leisurePosition, options = {}) {
  return Object.freeze({
    id, name, label, badge, colour, shiftStartMinute, shiftDurationMinutes, workLabel,
    commuteMinutes: options.commuteMinutes || 60,
    leisureMinutes: options.leisureMinutes || 120,
    moveSpeed: options.moveSpeed || 36,
    workPoints: Object.freeze(workPoints.map((point) => Object.freeze({ ...point }))),
    dutyActions: Object.freeze([...dutyActions]),
    leisureLabel,
    leisurePosition: Object.freeze({ ...leisurePosition }),
  });
}

const CITIZEN_PROFILES = Object.freeze([
  citizenProfile('armorer', 'Mira Vos', 'ARMORER', 'ARM', '#ffbd62', 480, 540, 'Iron Lantern Armory', [{ x: 6218, y: 4216 }, { x: 6262, y: 4216 }], ['RESTOCKING SIDEARMS', 'CHECKING ARMOR FIT'], 'Centre Cafe', { x: 6420, y: 4490 }),
  citizenProfile('mechanic', 'Daan Vermeer', 'MECHANIC', 'MEC', '#59e0b8', 480, 540, 'Party Crew Garage', [{ x: 6020, y: 4710 }, { x: 6090, y: 4730 }], ['TUNING GANG CARS', 'CHECKING STREET ENGINES'], 'Market Food Stand', { x: 6760, y: 4510 }),
  citizenProfile('casino-dealer', 'Noura El Amrani', 'CASINO DEALER', 'DLR', '#db86ff', 960, 540, 'Neon Crown Casino', [{ x: 6578, y: 4215 }, { x: 6622, y: 4215 }], ['DEALING HIGH CARD', 'BALANCING THE TABLE'], 'Night Market', { x: 7000, y: 4510 }, { leisureMinutes: 90 }),
  citizenProfile('casino-host', 'Jules de Jong', 'CASINO HOST', 'VIP', '#e7a1ff', 1020, 480, 'Neon Crown Casino', [{ x: 6560, y: 4164 }, { x: 6640, y: 4164 }], ['GREETING PLAYERS', 'CHECKING VIP PASSES'], 'Centre Cafe', { x: 6420, y: 4490 }, { leisureMinutes: 90 }),
  citizenProfile('venue-security', 'Amina Bakker', 'VENUE SECURITY', 'SEC', '#79a9ff', 1080, 480, 'Casino and Armory Patrol', [{ x: 6500, y: 4140 }, { x: 6680, y: 4140 }, { x: 6320, y: 4140 }, { x: 6150, y: 4140 }], ['PATROLLING ENTRANCES', 'WATCHING THE STREET'], 'Garage Break Area', { x: 6120, y: 4650 }, { leisureMinutes: 60, moveSpeed: 40 }),
  citizenProfile('day-security', 'Ravi Mulder', 'DAY SECURITY', 'SEC', '#6ac4ff', 420, 540, 'Civic Crossing', [{ x: 6080, y: 4090 }, { x: 6200, y: 4090 }, { x: 6260, y: 4300 }], ['DIRECTING TRAFFIC', 'CHECKING ROAD ACCESS'], 'Centre Park', { x: 6500, y: 4590 }, { leisureMinutes: 90, moveSpeed: 40 }),
  citizenProfile('courier', 'Tess Smits', 'CITY COURIER', 'RUN', '#ff8d73', 540, 540, 'Venue Delivery Circuit', [{ x: 6240, y: 4190 }, { x: 6600, y: 4190 }, { x: 6045, y: 4680 }, { x: 7040, y: 4510 }], ['DELIVERING ARMORY PARTS', 'CARRYING CASINO MAIL', 'RUNNING GARAGE ORDERS'], 'Centre Park', { x: 6500, y: 4590 }, { moveSpeed: 46 }),
  citizenProfile('street-medic', 'Omar Visser', 'STREET MEDIC', 'MED', '#7effbb', 420, 480, 'Civic Aid Patrol', [{ x: 6360, y: 4320 }, { x: 6740, y: 4320 }, { x: 6500, y: 4550 }], ['CHECKING FIRST AID', 'WALKING THE AID ROUTE'], 'Market Food Stand', { x: 6760, y: 4510 }, { moveSpeed: 40 }),
  citizenProfile('market-vendor', 'Isa Hendriks', 'MARKET VENDOR', 'MKT', '#ffd36a', 480, 600, 'Centre Market', [{ x: 6920, y: 4470 }, { x: 7000, y: 4470 }], ['OPENING THE STALL', 'SERVING MARKET CUSTOMERS'], 'Centre Cafe', { x: 6420, y: 4490 }, { leisureMinutes: 90 }),
  citizenProfile('sanitation', 'Milan Smit', 'SANITATION CREW', 'SAN', '#a8e3a1', 300, 480, 'Morning Street Circuit', [{ x: 6060, y: 4170 }, { x: 7400, y: 4170 }, { x: 7400, y: 4530 }, { x: 6060, y: 4530 }], ['CLEARING THE PAVEMENT', 'EMPTYING STREET BINS'], 'Garage Break Area', { x: 6120, y: 4650 }, { leisureMinutes: 90, moveSpeed: 38 }),
  citizenProfile('cafe-cook', 'Lina Jacobs', 'CAFE COOK', 'COOK', '#ffab74', 660, 540, 'Centre Cafe', [{ x: 6390, y: 4470 }, { x: 6450, y: 4470 }], ['PREPPING STREET FOOD', 'SERVING THE LUNCH RUSH'], 'Night Market', { x: 7000, y: 4510 }, { leisureMinutes: 90 }),
  citizenProfile('dock-loader', 'Noah Willems', 'DOCK LOADER', 'DOCK', '#6cc6d7', 360, 480, 'Harbour Freight Route', [{ x: 7240, y: 4940 }, { x: 7424, y: 5248 }, { x: 7100, y: 5100 }], ['MOVING FREIGHT', 'CHECKING THE LOADING BAY'], 'Market Food Stand', { x: 6760, y: 4510 }, { moveSpeed: 38 }),
  citizenProfile('busker', 'Sara Meijer', 'STREET MUSICIAN', 'MUS', '#ff83bb', 1020, 360, 'Centre Performance Spots', [{ x: 6460, y: 4380 }, { x: 6840, y: 4380 }, { x: 6660, y: 4550 }], ['PLAYING A STREET SET', 'TAKING SONG REQUESTS'], 'Night Market', { x: 7000, y: 4510 }),
  citizenProfile('night-clerk', 'Finn Bos', 'NIGHT CLERK', 'NITE', '#9a98ff', 1320, 480, 'Night Market Office', [{ x: 7000, y: 4450 }, { x: 7040, y: 4450 }], ['LOGGING NIGHT ORDERS', 'WATCHING THE NIGHT TILL'], 'Centre Cafe', { x: 6420, y: 4490 }, { leisureMinutes: 60 }),
  citizenProfile('taxi-dispatcher', 'Yara de Wit', 'TAXI DISPATCHER', 'CAB', '#ffe36b', 420, 540, 'East Civic Taxi Rank', [{ x: 9250, y: 4090 }, { x: 9340, y: 4090 }], ['CALLING THE NEXT CAB', 'TRACKING TRAFFIC ROUTES'], 'East Corner Cafe', { x: 9180, y: 4350 }),
  citizenProfile('delivery-rider', 'Samir Peters', 'DELIVERY RIDER', 'DEL', '#ff766f', 600, 480, 'Harbour Delivery Circuit', [{ x: 8240, y: 5200 }, { x: 8448, y: 5000 }, { x: 8080, y: 5400 }], ['COLLECTING A HARBOUR ORDER', 'DELIVERING ALONG THE QUAY'], 'Harbour Break Area', { x: 8320, y: 5480 }, { moveSpeed: 48 }),
  citizenProfile('park-keeper', 'Elin van Dijk', 'PARK KEEPER', 'PARK', '#85d67d', 420, 480, 'North Rail Park', [{ x: 4950, y: 2048 }, { x: 5100, y: 2200 }, { x: 4864, y: 2300 }], ['CHECKING THE GARDENS', 'OPENING THE PARK PATH'], 'Rail Cafe', { x: 5150, y: 2400 }),
  citizenProfile('electrician', 'Ilias Vos', 'CITY ELECTRICIAN', 'ELEC', '#75efff', 480, 480, 'Rail Power Circuit', [{ x: 7300, y: 2944 }, { x: 7600, y: 3100 }, { x: 7200, y: 3300 }], ['CHECKING STREET LIGHTS', 'SERVICING RAIL POWER'], 'Rail Food Stand', { x: 7550, y: 3400 }, { moveSpeed: 39 }),
  citizenProfile('news-seller', 'Zoe Kuiper', 'NEWS SELLER', 'NEWS', '#f1d7a3', 360, 420, 'South Station News Corners', [{ x: 4864, y: 6300 }, { x: 5200, y: 6400 }, { x: 5400, y: 6200 }], ['CALLING THE HEADLINES', 'RESTOCKING THE NEWS STAND'], 'South Station Cafe', { x: 5100, y: 6600 }),
  citizenProfile('warehouse-runner', 'Bo Martens', 'WAREHOUSE RUNNER', 'WH', '#b6b7bc', 480, 540, 'West Warehouse Route', [{ x: 2150, y: 4096 }, { x: 2500, y: 4300 }, { x: 2800, y: 4000 }], ['COUNTING WAREHOUSE STOCK', 'RUNNING PARTS TO WEST MARKET'], 'West Canteen', { x: 2350, y: 4450 }, { leisureMinutes: 90, moveSpeed: 42 }),
]);

function distance(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

function cyclicMinutes(fromMinute, toMinute) {
  return (toMinute - fromMinute + 1440) % 1440;
}

function cityClockForTick(tick = 0) {
  const safeTick = Math.max(0, Math.floor(Number(tick) || 0));
  const dayTick = safeTick % CITY_DAY_TICKS;
  const elapsedMinutes = Math.floor(dayTick / CITY_DAY_TICKS * 1440);
  const minuteOfDay = (CITY_DAY_START_MINUTE + elapsedMinutes) % 1440;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const period = hour < 6 ? 'NIGHT' : hour < 12 ? 'MORNING' : hour < 17 ? 'DAY' : hour < 22 ? 'EVENING' : 'NIGHT';
  return {
    day: Math.floor(safeTick / CITY_DAY_TICKS) + 1,
    minuteOfDay,
    hour,
    minute,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    period,
    dayTick,
    dayTicks: CITY_DAY_TICKS,
  };
}

function citizenPhase(profile, minuteOfDay) {
  const sinceShiftStart = cyclicMinutes(profile.shiftStartMinute, minuteOfDay);
  if (sinceShiftStart < profile.shiftDurationMinutes) return 'duty';
  if (cyclicMinutes(minuteOfDay, profile.shiftStartMinute) <= profile.commuteMinutes) return 'commute';
  if (sinceShiftStart < profile.shiftDurationMinutes + profile.leisureMinutes) return 'leisure';
  return 'home';
}

function scheduleForCitizen(world, npc, profile, profileIndex, clock) {
  const phase = citizenPhase(profile, clock.minuteOfDay);
  const step = Math.floor((world.tick + profileIndex * TICK_RATE * 2) / DUTY_STEP_TICKS);
  let target = npc.spawnPosition;
  let destinationLabel = 'Home';
  let action = 'OFF SHIFT AT HOME';
  let destinationId = 'home';
  if (phase === 'commute') {
    target = profile.workPoints[0];
    destinationLabel = profile.workLabel;
    action = 'COMMUTING TO WORK';
    destinationId = 'commute-work';
  } else if (phase === 'duty') {
    const workIndex = step % profile.workPoints.length;
    target = profile.workPoints[workIndex];
    destinationLabel = profile.workLabel;
    action = profile.dutyActions[step % profile.dutyActions.length];
    destinationId = `duty-${workIndex}`;
  } else if (phase === 'leisure') {
    target = profile.leisurePosition;
    destinationLabel = profile.leisureLabel;
    action = `OFF DUTY AT ${profile.leisureLabel.toUpperCase()}`;
    destinationId = 'leisure';
  }
  return {
    phase,
    action,
    destinationId,
    destinationLabel,
    target: { x: target.x, y: target.y },
    taskStep: step,
    taskProgress: (world.tick % DUTY_STEP_TICKS) / DUTY_STEP_TICKS,
    moveSpeed: profile.moveSpeed,
  };
}

function assignCitizenProfile(npc, profile) {
  npc.cityLifeResident = true;
  npc.source ||= 'city-life';
  npc.displayName = profile.name;
  npc.role = profile.id;
  npc.roleLabel = profile.label;
  npc.roleBadge = profile.badge;
  npc.roleColour = profile.colour;
  npc.dailySchedule = {
    shiftStartMinute: profile.shiftStartMinute,
    shiftDurationMinutes: profile.shiftDurationMinutes,
    commuteMinutes: profile.commuteMinutes,
    leisureMinutes: profile.leisureMinutes,
    workLabel: profile.workLabel,
  };
}

function updateCitizenRoutines(world) {
  if (!world.cityLife?.enabled) return null;
  const clock = cityClockForTick(world.tick);
  const residents = Object.values(world.npcs || {})
    .filter((npc) => npc.kind === 'civilian' && npc.cityLifeResident)
    .sort((a, b) => a.id.localeCompare(b.id));
  const summary = { total: residents.length, duty: 0, commute: 0, leisure: 0, home: 0 };
  residents.forEach((npc, index) => {
    const profile = CITIZEN_PROFILES[index % CITIZEN_PROFILES.length];
    if (npc.role !== profile.id || !npc.dailySchedule) assignCitizenProfile(npc, profile);
    npc.routine = scheduleForCitizen(world, npc, profile, index, clock);
    summary[npc.routine.phase] += 1;
  });
  world.cityLife.clock = clock;
  world.cityLife.routineSummary = summary;
  return summary;
}

function createResident(id, position, routeIndex) {
  const health = 24 + routeIndex % 18;
  return {
    id,
    kind: 'civilian',
    controller: 'ai',
    partyId: null,
    state: routeIndex % 3 === 0 ? 'idle' : 'follow_route',
    position: { ...position },
    velocity: { x: 0, y: 0 },
    facing: { x: routeIndex % 2 === 0 ? 1 : -1, y: 0 },
    radius: 8,
    health,
    maxHealth: health,
    alive: true,
    spawnPosition: { ...position },
    downedAtTick: null,
    respawnAtTick: null,
    routeId: 'city-life-market-walk',
    routeIndex: routeIndex % 4,
    stateUntilTick: routeIndex % 3 === 0 ? 35 + routeIndex * 3 : 0,
    cityLifeResident: true,
    source: 'city-life',
  };
}

function createCityVehicle({ id, position, rotation = 0, style = 'teal', traffic = null, maxHealth = 50 }) {
  const vehicle = {
    id,
    kind: 'vehicle',
    vehicleClass: traffic ? 'traffic' : 'parked',
    position: { ...position },
    spawnPosition: { ...position },
    rotation,
    spawnRotation: rotation,
    speed: 0,
    velocity: { x: 0, y: 0 },
    radius: 20,
    driverActorId: null,
    passengerActorIds: [],
    maxOccupants: 4,
    health: maxHealth,
    maxHealth,
    destroyed: false,
    destroyedAtTick: null,
    respawnAtTick: null,
    partyOwnerId: null,
    style,
    hostOwned: true,
    parked: !traffic,
    stealable: true,
    ambientDriver: Boolean(traffic),
    traffic,
  };
  ensureVehicleTuning(vehicle);
  return vehicle;
}

function initializeCityLife(world) {
  if (!world || world.cityLife) return world?.cityLife || null;
  const enabled = world.territory?.enabled !== true;
  world.cityLife = {
    enabled,
    version: 4,
    venues: VENUES.map((venue) => ({ ...venue, position: { ...venue.position }, options: venue.options.map((option) => ({ ...option })) })),
    menus: {},
    activity: {
      ...ACTIVITY_SPOTS[0],
      position: { ...ACTIVITY_SPOTS[0].position },
      index: 0,
      rewardCents: 1500,
      available: true,
      collectedByActorIds: [],
      rotateAtTick: EVENT_TICKS,
    },
    streetEvent: { index: 0, label: EVENT_LABELS[0], startedAtTick: 0, endsAtTick: EVENT_TICKS },
    roadblock: { active: false, deployedByActorId: null, expiresAtTick: null, barriers: [] },
    counters: { casinoHands: 0, bodyguards: 0, gangCars: 0, roadblocks: 0, caches: 0, contracts: 0, contractsCompleted: 0, vehicleServices: 0, vehicleUpgrades: 0 },
    contracts: { party_a: null, party_b: null },
    clock: cityClockForTick(world.tick),
    routineSummary: { total: 0, duty: 0, commute: 0, leisure: 0, home: 0 },
  };
  ensureContractState(world);
  if (!enabled) return world.cityLife;

  for (const vehicle of Object.values(world.vehicles || {})) {
    ensureVehicleTuning(vehicle);
    vehicle.vehicleClass ||= 'parked';
    vehicle.parked = true;
    vehicle.stealable = true;
    vehicle.spawnRotation ??= vehicle.rotation || 0;
  }

  const traffic = [
    { id: 'traffic-civic-1', routeId: 'civic-clockwise', waypointIndex: 1, position: { x: 5750, y: 4066 }, style: 'teal', cruiseSpeed: 76 },
    { id: 'traffic-civic-2', routeId: 'civic-clockwise', waypointIndex: 2, position: { x: 7350, y: 4620 }, style: 'amber', cruiseSpeed: 68 },
    { id: 'traffic-civic-3', routeId: 'civic-counter', waypointIndex: 1, position: { x: 6760, y: 4126 }, style: 'silver', cruiseSpeed: 72 },
    { id: 'traffic-civic-4', routeId: 'civic-counter', waypointIndex: 3, position: { x: 5000, y: 4900 }, style: 'red', cruiseSpeed: 82 },
  ];
  for (const entry of traffic) {
    const points = TRAFFIC_ROUTES[entry.routeId];
    world.vehicles[entry.id] = createCityVehicle({
      id: entry.id,
      position: entry.position,
      style: entry.style,
      traffic: {
        active: true,
        routeId: entry.routeId,
        points: points.map((point) => ({ ...point })),
        waypointIndex: entry.waypointIndex,
        cruiseSpeed: entry.cruiseSpeed,
        waitUntilTick: 0,
      },
    });
  }

  world.staticMap.npcRoutes['city-life-market-walk'] = [
    { x: 6060, y: 4170 }, { x: 7400, y: 4170 }, { x: 7400, y: 4530 }, { x: 6060, y: 4530 },
  ];
  const residentPositions = [
    { x: 6100, y: 4170 }, { x: 6320, y: 4170 }, { x: 6540, y: 4170 }, { x: 6760, y: 4170 },
    { x: 6980, y: 4170 }, { x: 7200, y: 4170 }, { x: 7380, y: 4320 }, { x: 7180, y: 4530 },
    { x: 6920, y: 4530 }, { x: 6660, y: 4530 }, { x: 6400, y: 4530 }, { x: 6140, y: 4530 },
  ];
  residentPositions.forEach((position, index) => {
    const id = `city-resident-${String(index + 1).padStart(2, '0')}`;
    world.npcs[id] = createResident(id, position, index);
  });
  Object.values(world.npcs)
    .filter((npc) => npc.kind === 'civilian')
    .forEach((npc) => { npc.cityLifeResident = true; });
  updateCitizenRoutines(world);
  refreshCityLifePrompts(world);
  return world.cityLife;
}

function nearestVenue(world, actor, maximumDistance = VENUE_RADIUS) {
  if (!world.cityLife?.enabled || actor.currentVehicleId) return null;
  return world.cityLife.venues
    .map((venue) => ({ venue, distance: distance(actor.position, venue.position) }))
    .filter((entry) => entry.distance <= maximumDistance)
    .sort((a, b) => a.distance - b.distance)[0]?.venue || null;
}

function nearestAvailableVehicle(world, actor, maximumDistance = 58) {
  return Object.values(world.vehicles || {})
    .map((vehicle) => ({ vehicle, distance: distance(actor.position, vehicle.position) }))
    .filter((entry) => !entry.vehicle.destroyed && entry.distance <= maximumDistance)
    .sort((a, b) => a.distance - b.distance)[0]?.vehicle || null;
}

function nearestCitizen(world, actor, maximumDistance = CITIZEN_TALK_RADIUS) {
  if (actor.currentVehicleId) return null;
  return Object.values(world.npcs || {})
    .map((npc) => ({ npc, distance: distance(actor.position, npc.position) }))
    .filter((entry) => entry.npc.alive && entry.npc.kind === 'civilian' && entry.npc.dailySchedule && entry.distance <= maximumDistance)
    .sort((a, b) => a.distance - b.distance || a.npc.id.localeCompare(b.npc.id))[0]?.npc || null;
}

function talkToCitizen(world, actor, citizen) {
  const routine = citizen.routine || {};
  const message = `${citizen.displayName} - ${citizen.roleLabel} - ${routine.action || 'OFF SHIFT'} - ${routine.destinationLabel || 'CITY STREETS'}`;
  actor.cityMessage = message;
  actor.cityMessageUntilTick = world.tick + TICK_RATE * 10;
  citizen.lastConversationAtTick = world.tick;
  citizen.lastConversationActorId = actor.id;
  return { ok: true, kind: 'city-citizen', citizenId: citizen.id, role: citizen.role, message };
}

function menuForActor(world, actorId) {
  return world.cityLife?.menus?.[actorId] || null;
}

function isCityLifeMenuOpen(world, actorId = null) {
  if (!world.cityLife?.enabled) return false;
  if (actorId) return Boolean(menuForActor(world, actorId));
  return Object.keys(world.cityLife.menus || {}).length > 0;
}

function closeCityLifeMenu(world, actor, message = 'Back on the street.') {
  if (!world.cityLife?.menus?.[actor.id]) return false;
  delete world.cityLife.menus[actor.id];
  actor.cityMenuOpen = false;
  actor.cityMessage = message;
  actor.cityMessageUntilTick = world.tick + 90;
  return true;
}

function openVenue(world, actor, venue) {
  world.cityLife.menus[actor.id] = {
    actorId: actor.id,
    venueId: venue.id,
    venueKind: venue.kind,
    label: venue.label,
    subtitle: venue.subtitle,
    accent: venue.accent,
    options: venue.options.map((option) => ({ ...option })),
    selectedIndex: 0,
    message: `${venue.label} is open. Choose an optional upgrade or activity.`,
    openedAtTick: world.tick,
    navLatch: 0,
  };
  if (venue.kind === 'chop-shop') decorateChopShopMenu(world, actor, world.cityLife.menus[actor.id]);
  actor.cityMenuOpen = true;
  actor.velocity = { x: 0, y: 0 };
  return { ok: true, kind: 'city-venue', action: 'opened', venueId: venue.id };
}

function activeBodyguards(world, actorId) {
  return Object.values(world.npcs || {}).filter((npc) => npc.kind === 'crew' && npc.source === 'bodyguard' && npc.ownerActorId === actorId && npc.alive !== false);
}

function spawnBodyguard(world, actor) {
  const active = activeBodyguards(world, actor.id);
  if (active.length >= 2) return { ok: false, reason: 'bodyguard-cap', message: 'You already have two active bodyguards.' };
  const payment = spendPersonalFunds(world, actor, 3000, 'city-bodyguard');
  if (!payment.ok) return { ...payment, message: 'Not enough personal funds for a bodyguard.' };
  const serial = ++world.cityLife.counters.bodyguards;
  const npc = createHostileNpc({
    id: `bodyguard-${actor.id}-${serial}`,
    faction: `${actor.partyId}-bodyguards`,
    role: serial % 2 === 0 ? 'skirmisher' : 'blocker',
    position: { x: actor.position.x + 26, y: actor.position.y + (serial % 2 ? 20 : -20) },
    source: 'bodyguard',
    kind: 'crew',
  });
  npc.partyId = actor.partyId;
  npc.ownerActorId = actor.id;
  npc.displayName = `${actor.displayName || `P${actor.slot}`} Guard ${active.length + 1}`;
  npc.expiresAtTick = null;
  world.npcs[npc.id] = npc;
  return { ok: true, npcId: npc.id, message: `${npc.displayName} joined and will follow you.` };
}

function spawnGangCar(world, actor) {
  const existing = Object.values(world.vehicles).filter((vehicle) => vehicle.vehicleClass === 'gang-car' && vehicle.partyOwnerId === actor.partyId && !vehicle.destroyed);
  if (existing.length >= 2) return { ok: false, reason: 'gang-car-cap', message: 'Your party already has two active gang cars.' };
  const payment = spendPersonalFunds(world, actor, 4000, 'city-gang-car');
  if (!payment.ok) return { ...payment, message: 'Not enough personal funds for an armored gang car.' };
  const serial = ++world.cityLife.counters.gangCars;
  const position = { x: 6100 + existing.length * 48, y: 4740 };
  const vehicle = createCityVehicle({ id: `gang-car-${actor.partyId}-${serial}`, position, style: 'gang', maxHealth: 100 });
  vehicle.vehicleClass = 'gang-car';
  vehicle.partyOwnerId = actor.partyId;
  vehicle.purchasedByActorId = actor.id;
  vehicle.stealable = false;
  world.vehicles[vehicle.id] = vehicle;
  return { ok: true, vehicleId: vehicle.id, message: 'Armored gang car delivered outside the garage.' };
}

function deployRoadblock(world, actor) {
  if (world.cityLife.roadblock.active && world.tick < world.cityLife.roadblock.expiresAtTick) {
    return { ok: false, reason: 'roadblock-active', message: 'A crew roadblock is already active.' };
  }
  const payment = spendPersonalFunds(world, actor, 1200, 'city-roadblock');
  if (!payment.ok) return { ...payment, message: 'Not enough personal funds for the roadblock crew.' };
  world.cityLife.counters.roadblocks += 1;
  world.cityLife.roadblock = {
    active: true,
    deployedByActorId: actor.id,
    deployedByPartyId: actor.partyId,
    label: 'PARTY STREET BLOCK',
    position: { x: 6144, y: 4096 },
    expiresAtTick: world.tick + TICK_RATE * 60,
    barriers: [
      { x: 6084, y: 4087, width: 38, height: 18 },
      { x: 6125, y: 4087, width: 38, height: 18 },
      { x: 6166, y: 4087, width: 38, height: 18 },
    ],
  };
  return { ok: true, message: 'Roadblock deployed at the civic crossing for 60 seconds.' };
}

function playHighCard(world, actor) {
  const payment = spendPersonalFunds(world, actor, 500, 'casino-high-card-wager');
  if (!payment.ok) return { ...payment, message: 'You need DC 5,00 to sit at the table.' };
  const hand = world.cityLife.counters.casinoHands++;
  const outcomes = [
    { rank: 'KING over NINE', payoutCents: 1000 },
    { rank: 'SEVEN under JACK', payoutCents: 0 },
    { rank: 'TEN ties TEN', payoutCents: 500 },
    { rank: 'ACE over QUEEN', payoutCents: 1500 },
    { rank: 'FOUR under EIGHT', payoutCents: 0 },
  ];
  const outcome = outcomes[hand % outcomes.length];
  const vipBonus = actor.cityUpgrades?.vipPass && outcome.payoutCents > 500 ? 200 : 0;
  const payout = outcome.payoutCents + vipBonus;
  actor.walletCents = normalizeCents(actor.walletCents + payout);
  return {
    ok: true,
    rank: outcome.rank,
    payoutCents: payout,
    message: payout > 500 ? `${outcome.rank} · WIN DC ${(payout / 100).toFixed(2)}` : payout === 500 ? `${outcome.rank} · PUSH` : `${outcome.rank} · TABLE WINS`,
  };
}

function nearestServiceVehicle(world, actor, maximumDistance = 150) {
  return Object.values(world.vehicles || {})
    .map((vehicle) => ({ vehicle, distance: distance(actor.position, vehicle.position) }))
    .filter((entry) => !entry.vehicle.destroyed && entry.vehicle.passengerActorIds.length === 0 && entry.vehicle.driverActorId === null && entry.distance <= maximumDistance)
    .sort((a, b) => a.distance - b.distance || a.vehicle.id.localeCompare(b.vehicle.id))[0]?.vehicle || null;
}

function resolveServiceVehicle(world, actor, vehicleId = null, maximumDistance = 150) {
  const vehicle = vehicleId ? world.vehicles?.[vehicleId] : nearestServiceVehicle(world, actor, maximumDistance);
  if (!vehicle || vehicle.destroyed || vehicle.driverActorId !== null || vehicle.passengerActorIds.length > 0) return null;
  if (distance(actor.position, vehicle.position) > maximumDistance) return null;
  ensureVehicleTuning(vehicle);
  return vehicle;
}

function previewVehiclePart(vehicle, part) {
  const clone = { ...vehicle, tuning: { ...vehicle.tuning, installedByActorIds: [...(vehicle.tuning?.installedByActorIds || [])] } };
  upgradeVehiclePart(clone, part);
  return publicVehicleBuild(clone);
}

function decorateChopShopMenu(world, actor, menu) {
  if (!menu || menu.venueKind !== 'chop-shop') return menu;
  const vehicle = resolveServiceVehicle(world, actor, menu.serviceVehicleId);
  if (!vehicle) {
    menu.serviceVehicleId = null;
    menu.vehicleBuild = null;
    menu.options = menu.options.map((option) => ({
      ...option,
      detail: option.id === 'tow-vehicle' ? 'Tow the nearest empty car already claimed by your party.' : 'Park an empty working car beside the shop first, or use TOW PARTY CAR.',
    }));
    return menu;
  }
  menu.serviceVehicleId = vehicle.id;
  const build = publicVehicleBuild(vehicle);
  menu.vehicleBuild = build;
  const ownershipOk = vehicle.partyOwnerId === actor.partyId;
  menu.options = menu.options.map((base) => {
    const option = { ...base, priceCents: quoteVehicleUpgrade(vehicle, base.id, base.priceCents) };
    if (base.id === 'repair-vehicle') {
      option.detail = `${build.stats.currentHealth}/${build.stats.health} health now - restore this exact car to full health`;
    } else if (base.id === 'tow-vehicle') {
      option.detail = `${vehicle.id} is already on the service pad`;
    } else if (base.id === 'engine-vehicle') {
      const next = previewVehiclePart(vehicle, 'engine');
      option.label = build.engineTier >= build.engineMaximum ? 'ENGINE STAGE MAX' : `UPGRADE ENGINE - STAGE ${build.engineTier + 1}`;
      option.detail = build.engineTier >= build.engineMaximum ? `Top ${build.stats.topSpeed} - acceleration ${build.stats.acceleration}` : `Top ${build.stats.topSpeed} -> ${next.stats.topSpeed} - acceleration ${build.stats.acceleration} -> ${next.stats.acceleration}`;
    } else if (base.id === 'tires-vehicle') {
      const next = previewVehiclePart(vehicle, 'tires');
      option.label = build.tireTier >= build.tireMaximum ? 'TIRE STAGE MAX' : `UPGRADE TIRES - STAGE ${build.tireTier + 1}`;
      option.detail = build.tireTier >= build.tireMaximum ? `Steering ${build.stats.steering}` : `Steering ${build.stats.steering} -> ${next.stats.steering}`;
    } else if (base.id === 'brakes-vehicle') {
      option.label = build.brakeTier >= build.brakeMaximum ? 'BRAKE STAGE MAX' : `UPGRADE BRAKES - STAGE ${build.brakeTier + 1}`;
      option.detail = build.brakeTier >= build.brakeMaximum ? 'Maximum brake stage installed.' : `Braking stage ${build.brakeTier} -> ${build.brakeTier + 1} - stronger stop and reverse`;
    } else if (base.id === 'tune-vehicle') option.detail = `${build.presetLabel} now - ACTION cycles handling${build.tuneUnlocked ? ' for free' : ' after one ECU unlock'}`;
    else if (base.id === 'body-vehicle') option.detail = `${build.bodyKitLabel} now - ACTION fits the next visible kit`;
    else if (base.id === 'paint-vehicle') option.detail = `${build.paintLabel} now - ACTION applies the next paint/livery`;
    else if (base.id === 'armor-vehicle' && build.armorTier) { option.label = 'STREET ARMOR INSTALLED'; option.detail = `${build.stats.health} maximum vehicle health`; option.priceCents = 0; }
    else if (base.id === 'armor-vehicle') option.detail = `Maximum health ${build.stats.health} -> ${build.stats.health + 35}`;
    else if (base.id === 'legalize-vehicle') option.detail = vehicle.stolenByActorId ? 'Swap plates, keep this build and reduce justice heat.' : 'This car has no active stolen marker.';
    if (!ownershipOk && ['engine-vehicle', 'tires-vehicle', 'brakes-vehicle', 'armor-vehicle', 'tune-vehicle', 'body-vehicle', 'paint-vehicle'].includes(base.id)) {
      option.detail = 'Take or claim this car for your party before modifying it.';
    }
    return option;
  });
  return menu;
}

function serviceVehicle(world, actor, option, vehicleId = null) {
  if (option.id === 'tow-vehicle') {
    const vehicle = Object.values(world.vehicles || {})
      .filter((entry) => !entry.destroyed && entry.driverActorId === null && entry.passengerActorIds.length === 0 && entry.partyOwnerId === actor.partyId)
      .sort((a, b) => distance(actor.position, a.position) - distance(actor.position, b.position) || a.id.localeCompare(b.id))[0];
    if (!vehicle) return { ok: false, reason: 'tow-car-missing', message: 'Claim a car for your party and leave it empty before requesting a tow.' };
    const payment = spendPersonalFunds(world, actor, option.priceCents, 'city-vehicle-tow');
    if (!payment.ok) return { ...payment, message: 'Not enough personal funds for the tow crew.' };
    vehicle.position = { x: 7510, y: 4740 };
    vehicle.rotation = 0;
    vehicle.travelRotation = 0;
    vehicle.speed = 0;
    vehicle.velocity = { x: 0, y: 0 };
    vehicle.parked = true;
    world.cityLife.counters.vehicleServices += 1;
    return { ok: true, vehicleId: vehicle.id, message: `${vehicle.id} towed onto the Chop Shop pad.` };
  }
  const vehicle = resolveServiceVehicle(world, actor, vehicleId);
  if (!vehicle) return { ok: false, reason: 'service-car-missing', message: 'Park an empty working car beside the shop first.' };
  const modifying = ['engine-vehicle', 'tires-vehicle', 'brakes-vehicle', 'armor-vehicle', 'tune-vehicle', 'body-vehicle', 'paint-vehicle'].includes(option.id);
  if (modifying && vehicle.partyOwnerId !== actor.partyId) return { ok: false, reason: 'vehicle-not-party-owned', message: 'Take or claim this car for your party before modifying it.' };
  if (option.id === 'repair-vehicle') {
    if (vehicle.health >= vehicle.maxHealth) return { ok: false, reason: 'vehicle-full-health', message: `${vehicle.id} already has full health.` };
    const payment = spendPersonalFunds(world, actor, option.priceCents, 'city-vehicle-repair');
    if (!payment.ok) return { ...payment, message: 'Not enough personal funds for the repair.' };
    vehicle.health = vehicle.maxHealth;
    world.cityLife.counters.vehicleServices += 1;
    return { ok: true, vehicleId: vehicle.id, message: `${vehicle.id} repaired to ${vehicle.health}/${vehicle.maxHealth}.` };
  }
  if (option.id === 'armor-vehicle') {
    if (vehicle.cityArmorInstalled) return { ok: false, reason: 'vehicle-armor-owned', message: `${vehicle.id} already has street armor.` };
    const payment = spendPersonalFunds(world, actor, option.priceCents, 'city-vehicle-armor');
    if (!payment.ok) return { ...payment, message: 'Not enough personal funds for vehicle armor.' };
    vehicle.cityArmorInstalled = true;
    const tuning = ensureVehicleTuning(vehicle);
    tuning.armorTier = 1;
    tuning.revision += 1;
    if (!tuning.installedByActorIds.includes(actor.id)) tuning.installedByActorIds.push(actor.id);
    vehicle.maxHealth += 35;
    vehicle.health += 35;
    world.cityLife.counters.vehicleServices += 1;
    world.cityLife.counters.vehicleUpgrades += 1;
    return { ok: true, vehicleId: vehicle.id, message: `${vehicle.id} armored to ${vehicle.maxHealth} vehicle health.` };
  }
  const partByOption = { 'engine-vehicle': 'engine', 'tires-vehicle': 'tires', 'brakes-vehicle': 'brakes' };
  if (partByOption[option.id]) {
    const part = partByOption[option.id];
    const quote = quoteVehicleUpgrade(vehicle, option.id, option.priceCents);
    const preview = previewVehiclePart(vehicle, part);
    const upgraded = upgradeVehiclePart({ ...vehicle, tuning: { ...vehicle.tuning, installedByActorIds: [...vehicle.tuning.installedByActorIds] } }, part);
    if (!upgraded.ok) return { ...upgraded, message: `${part.toUpperCase()} is already at maximum stage.` };
    const payment = spendPersonalFunds(world, actor, quote, `city-vehicle-${part}`);
    if (!payment.ok) return { ...payment, message: `Not enough personal funds for the ${part} upgrade.` };
    upgradeVehiclePart(vehicle, part, actor.id);
    world.cityLife.counters.vehicleServices += 1;
    world.cityLife.counters.vehicleUpgrades += 1;
    const tierKey = { engine: 'engineTier', tires: 'tireTier', brakes: 'brakeTier' }[part];
    return { ok: true, vehicleId: vehicle.id, message: `${part.toUpperCase()} stage ${vehicle.tuning[tierKey]} installed - top ${preview.stats.topSpeed}, steering ${preview.stats.steering}.` };
  }
  if (option.id === 'tune-vehicle') {
    const quote = quoteVehicleUpgrade(vehicle, option.id);
    if (quote > 0) {
      const payment = spendPersonalFunds(world, actor, quote, 'city-vehicle-tune');
      if (!payment.ok) return { ...payment, message: 'Not enough personal funds to unlock ECU tuning.' };
    }
    const preset = cycleTunePreset(vehicle, actor.id);
    world.cityLife.counters.vehicleServices += 1;
    world.cityLife.counters.vehicleUpgrades += 1;
    return { ok: true, vehicleId: vehicle.id, message: `${preset.label} setup active. Tuning changes are now free.` };
  }
  if (option.id === 'body-vehicle') {
    const payment = spendPersonalFunds(world, actor, quoteVehicleUpgrade(vehicle, option.id), 'city-vehicle-body-kit');
    if (!payment.ok) return { ...payment, message: 'Not enough personal funds for the body kit.' };
    const body = cycleBodyKit(vehicle, actor.id);
    world.cityLife.counters.vehicleServices += 1;
    world.cityLife.counters.vehicleUpgrades += 1;
    return { ok: true, vehicleId: vehicle.id, message: `${body.label} fitted to ${vehicle.id}.` };
  }
  if (option.id === 'paint-vehicle') {
    const payment = spendPersonalFunds(world, actor, quoteVehicleUpgrade(vehicle, option.id), 'city-vehicle-paint');
    if (!payment.ok) return { ...payment, message: 'Not enough personal funds for paint and livery.' };
    const paint = cycleVehiclePaint(vehicle, actor.id);
    world.cityLife.counters.vehicleServices += 1;
    world.cityLife.counters.vehicleUpgrades += 1;
    return { ok: true, vehicleId: vehicle.id, message: `${paint.label} paint and livery applied.` };
  }
  if (option.id === 'legalize-vehicle') {
    if (!vehicle.stolenByActorId) return { ok: false, reason: 'vehicle-not-stolen', message: 'Only a marked stolen car needs new plates.' };
    const payment = spendPersonalFunds(world, actor, option.priceCents, 'city-vehicle-legalize');
    if (!payment.ok) return { ...payment, message: 'Not enough personal funds for plates and paint.' };
    vehicle.stolenByActorId = null;
    vehicle.ambientDriver = false;
    vehicle.parked = true;
    vehicle.traffic = null;
    vehicle.vehicleClass = 'custom';
    vehicle.partyOwnerId = actor.partyId;
    vehicle.purchasedByActorId = actor.id;
    const tuning = ensureVehicleTuning(vehicle);
    tuning.paintId = actor.partyId === 'party_b' ? 'magenta-night' : 'mint-circuit';
    tuning.revision += 1;
    vehicle.style = tuning.paintId;
    if (world.justice) {
      world.justice.heat = Math.max(0, Number(world.justice.heat || 0) - 25);
      world.justice.lastOffenseTick = Math.min(Number(world.justice.lastOffenseTick || 0), world.tick - 301);
    }
    world.cityLife.counters.vehicleServices += 1;
    return { ok: true, vehicleId: vehicle.id, message: `${vehicle.id} is now your party car. Justice heat reduced by 25.` };
  }
  return { ok: false, reason: 'unknown-service', message: 'That vehicle service is unavailable.' };
}

function buyOption(world, actor, menu) {
  const option = menu.options[menu.selectedIndex] || menu.options[0];
  actor.cityUpgrades ||= { weaponTier: 0, armorTier: 0, vipPass: false };
  let result;
  const gearOption = ['sidearm-mk2', 'scatter-blaster', 'arc-carbine', 'armor-lining', 'riot-plate', 'kinetic-boots'].includes(option.id);
  if (gearOption) {
    const fit = canInstallArmoryGear(actor, option.id);
    if (!fit.ok) result = { ...fit, message: fit.reason === 'owned' ? 'That gear is already in your loadout or pack.' : 'Make room in your pack before buying this gear.' };
    else {
      const payment = spendPersonalFunds(world, actor, option.priceCents, `city-gear-${option.id}`);
      result = payment.ok ? installArmoryGear(world, actor, option.id) : { ...payment, message: `Not enough personal funds for ${option.label}.` };
    }
  } else if (option.id === 'ammo-refill') {
    const fit = canRefillAmmo(actor);
    if (!fit.ok) result = { ...fit, message: fit.reason === 'no-finite-weapon' ? 'Equip an Armory weapon before buying matched ammo.' : 'Make room in your pack before buying ammo.' };
    else {
      const payment = spendPersonalFunds(world, actor, option.priceCents, 'city-ammo-refill');
      result = payment.ok ? refillAmmo(world, actor, 30) : { ...payment, message: 'Not enough personal funds for matched ammo.' };
    }
  } else if (option.id === 'combat-drill') result = startCombatDrill(world, actor);
  else if (option.id === 'hire-bodyguard') result = spawnBodyguard(world, actor);
  else if (option.id === 'gang-car') result = spawnGangCar(world, actor);
  else if (option.id === 'deploy-roadblock') result = deployRoadblock(world, actor);
  else if (option.id === 'high-card') result = playHighCard(world, actor);
  else if (option.id === 'vip-pass') {
    if (actor.cityUpgrades.vipPass) result = { ok: false, reason: 'owned', message: 'Your VIP street pass is already active.' };
    else {
      const payment = spendPersonalFunds(world, actor, option.priceCents, 'casino-vip-pass');
      if (payment.ok) { actor.cityUpgrades.vipPass = true; result = { ok: true, message: 'VIP pass active: table wins pay an extra DC 2,00.' }; }
      else result = { ...payment, message: 'Not enough personal funds for the VIP pass.' };
    }
  } else if (option.id === 'street-tip') {
    const activity = world.cityLife.activity;
    actor.cityActivityTip = { activityId: activity.id, position: { ...activity.position }, label: activity.label };
    result = { ok: true, message: `${activity.label} marked at ${Math.round(activity.position.x)}, ${Math.round(activity.position.y)}.` };
  } else if (option.id === 'contract-courier') result = startCityContract(world, actor, 'courier');
  else if (option.id === 'contract-race') result = startCityContract(world, actor, 'streetRace');
  else if (option.id === 'contract-patrol') result = startCityContract(world, actor, 'patrol');
  else if (['repair-vehicle', 'tow-vehicle', 'engine-vehicle', 'tires-vehicle', 'brakes-vehicle', 'armor-vehicle', 'tune-vehicle', 'body-vehicle', 'paint-vehicle', 'legalize-vehicle'].includes(option.id)) result = serviceVehicle(world, actor, option, menu.serviceVehicleId);
  else result = { ok: false, reason: 'unknown-option', message: 'That option is not available.' };
  if (result.vehicleId && menu.venueKind === 'chop-shop') menu.serviceVehicleId = result.vehicleId;
  if (menu.venueKind === 'chop-shop') decorateChopShopMenu(world, actor, menu);
  menu.message = result.message;
  menu.lastResultOk = result.ok === true;
  menu.updatedAtTick = world.tick;
  if (option.id === 'combat-drill' && result.ok) {
    delete world.cityLife.menus[actor.id];
    actor.cityMenuOpen = false;
  }
  return { kind: 'city-purchase', venueId: menu.venueId, optionId: option.id, ...result };
}

function collectActivity(world, actor) {
  const activity = world.cityLife.activity;
  if (!activity.available || distance(actor.position, activity.position) > ACTIVITY_RADIUS) return { ok: false, reason: 'activity-not-in-range' };
  if (activity.collectedByActorIds.includes(actor.id)) return { ok: false, reason: 'activity-already-collected' };
  activity.collectedByActorIds.push(actor.id);
  activity.available = false;
  activity.rotateAtTick = world.tick + TICK_RATE * 12;
  world.cityLife.counters.caches += 1;
  const personal = Math.round(activity.rewardCents * 0.4);
  const party = activity.rewardCents - personal;
  actor.walletCents = normalizeCents(actor.walletCents + personal);
  world.economy.partyFunds[actor.partyId] = normalizeCents((world.economy.partyFunds[actor.partyId] || 0) + party);
  world.economy.lifetimePartyIncome[actor.partyId] = normalizeCents((world.economy.lifetimePartyIncome[actor.partyId] || 0) + party);
  world.effects.push({ id: `effect-city-cache-${world.tick}`, kind: 'city-cache', partyId: actor.partyId, position: { ...activity.position }, expiresAtTick: world.tick + 45 });
  actor.cityMessage = `Street cache secured · DC ${(personal / 100).toFixed(2)} personal · DC ${(party / 100).toFixed(2)} party`;
  actor.cityMessageUntilTick = world.tick + 150;
  return { ok: true, kind: 'city-activity', activityId: activity.id, personalCents: personal, partyCents: party };
}

function interactWithCityLife(world, actor) {
  if (!world.cityLife?.enabled || !actor?.alive) return { ok: false, reason: 'city-life-disabled' };
  const menu = menuForActor(world, actor.id);
  if (menu) return buyOption(world, actor, menu);
  const combatDrop = collectCombatDrop(world, actor);
  if (combatDrop.ok) return combatDrop;
  const contractResult = interactWithCityContract(world, actor);
  if (contractResult.ok) return contractResult;
  const activityResult = collectActivity(world, actor);
  if (activityResult.ok) return activityResult;
  const venue = nearestVenue(world, actor);
  if (venue) return openVenue(world, actor, venue);
  if (!nearestAvailableVehicle(world, actor)) {
    const citizen = nearestCitizen(world, actor);
    if (citizen) return talkToCitizen(world, actor, citizen);
  }
  return { ok: false, reason: 'city-life-not-in-range' };
}

function updateCityLifeActorInput(world, actor) {
  const menu = menuForActor(world, actor.id);
  if (!menu) {
    actor.cityMenuOpen = false;
    return false;
  }
  actor.cityMenuOpen = true;
  actor.inventoryOpen = false;
  actor.velocity = { x: 0, y: 0 };
  if (actor.input.fire) {
    actor.input.fire = false;
    actor.input.attack = false;
    if (actor.pendingPulses) actor.pendingPulses.fire = false;
    closeCityLifeMenu(world, actor);
    return true;
  }
  const navigation = Number(actor.input.moveY) || 0;
  if (Math.abs(navigation) < 0.35) menu.navLatch = 0;
  else if (menu.navLatch === 0) {
    const offset = navigation > 0 ? 1 : -1;
    menu.selectedIndex = (menu.selectedIndex + offset + menu.options.length) % menu.options.length;
    menu.navLatch = offset;
    menu.message = `${menu.options[menu.selectedIndex].label} selected.`;
  }
  actor.input.moveX = 0;
  actor.input.moveY = 0;
  actor.input.sprint = false;
  actor.input.brake = false;
  return true;
}

function cityLifePrompt(world, actor) {
  if (!world.cityLife?.enabled || !actor?.alive) return null;
  const menu = menuForActor(world, actor.id);
  if (menu) {
    const option = menu.options[menu.selectedIndex] || menu.options[0];
    return `ACTION · ${option.label} · FIRE closes`;
  }
  if (actor.cityMessage && world.tick <= (actor.cityMessageUntilTick || 0)) return actor.cityMessage;
  const combatDrop = nearestCombatDrop(world, actor);
  if (combatDrop) return `ACTION - COLLECT ${combatDrop.label}`;
  const activeContractPrompt = cityContractPrompt(world, actor);
  if (activeContractPrompt) return activeContractPrompt;
  if (actor.currentVehicleId) return 'ACTION · EXIT VEHICLE';
  const activity = world.cityLife.activity;
  if (activity.available && distance(actor.position, activity.position) <= ACTIVITY_RADIUS) return `ACTION · COLLECT ${activity.label}`;
  const venue = nearestVenue(world, actor);
  if (venue) return `ACTION · ENTER ${venue.label}`;
  const nearbyVehicle = nearestAvailableVehicle(world, actor);
  if (nearbyVehicle) {
    if (nearbyVehicle.traffic?.active) return 'ACTION · HIJACK MOVING TRAFFIC CAR';
    if (nearbyVehicle.vehicleClass === 'gang-car') return 'ACTION · ENTER ARMORED GANG CAR';
    return 'ACTION · TAKE PARKED CAR';
  }
  const citizen = nearestCitizen(world, actor);
  if (citizen) return `ACTION - ASK ${citizen.displayName.toUpperCase()} ABOUT SHIFT`;
  return null;
}

function refreshCityLifePrompts(world) {
  for (const actor of Object.values(world.actors || {})) actor.interactionPrompt = cityLifePrompt(world, actor);
}

function rotateActivity(world) {
  const previous = world.cityLife.activity;
  const index = (previous.index + 1) % ACTIVITY_SPOTS.length;
  const next = ACTIVITY_SPOTS[index];
  world.cityLife.activity = {
    ...next,
    position: { ...next.position },
    index,
    rewardCents: 1500,
    available: true,
    collectedByActorIds: [],
    rotateAtTick: world.tick + EVENT_TICKS,
  };
}

function updateCityLife(world) {
  if (!world.cityLife?.enabled) return world.cityLife || null;
  if (world.cityLife.roadblock.active && world.tick >= world.cityLife.roadblock.expiresAtTick) {
    world.cityLife.roadblock = { active: false, deployedByActorId: null, expiresAtTick: null, barriers: [] };
  }
  if (world.tick >= world.cityLife.activity.rotateAtTick) rotateActivity(world);
  const eventIndex = Math.floor(world.tick / EVENT_TICKS) % EVENT_LABELS.length;
  if (eventIndex !== world.cityLife.streetEvent.index) {
    world.cityLife.streetEvent = {
      index: eventIndex,
      label: EVENT_LABELS[eventIndex],
      startedAtTick: world.tick,
      endsAtTick: world.tick + EVENT_TICKS,
    };
  }
  updateCityContracts(world);
  updateCitizenRoutines(world);
  refreshCityLifePrompts(world);
  return world.cityLife;
}

function collidesCityRoadblock(world, position, radius = 0) {
  const roadblock = world.cityLife?.roadblock;
  if (!roadblock?.active) return false;
  return roadblock.barriers.some((barrier) => (
    position.x + radius >= barrier.x
    && position.x - radius <= barrier.x + barrier.width
    && position.y + radius >= barrier.y
    && position.y - radius <= barrier.y + barrier.height
  ));
}

module.exports = {
  ACTIVITY_RADIUS,
  CITIZEN_PROFILES,
  CITIZEN_TALK_RADIUS,
  CITY_DAY_START_MINUTE,
  CITY_DAY_TICKS,
  TRAFFIC_ROUTES,
  VENUE_RADIUS,
  activeBodyguards,
  cityClockForTick,
  cityLifePrompt,
  closeCityLifeMenu,
  collidesCityRoadblock,
  initializeCityLife,
  interactWithCityLife,
  isCityLifeMenuOpen,
  menuForActor,
  nearestServiceVehicle,
  nearestCitizen,
  nearestVenue,
  refreshCityLifePrompts,
  updateCitizenRoutines,
  updateCityLife,
  updateCityLifeActorInput,
  serviceVehicle,
};
