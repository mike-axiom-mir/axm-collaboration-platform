import {
  GAME_VERSION, RARITIES, ITEM_FORMS, CORE_BEHAVIORS, FUTURE_TRIGGERS, QUIRKS,
  MATERIALS, HISTORIES, CONDITIONS, STYLE_FAMILIES, WORLD_EVENTS, LOCATIONS, ACTORS,
  ACTIVITIES, HOME_UPGRADES, PORTAL_UPGRADES, BUSINESS_TYPES, BUSINESS_BUYERS,
  BUSINESS_UPGRADES, BUSINESS_BRANCHES, PET_SPECIES, PET_TRAITS, CASINO_GAMES,
  CASINO_LOTS, LIFE_THREADS, DISTRICT_RESIDENTS, DISTRICT_CONTEXT_REACTIONS,
  DISTRICT_SUPPLIER, DISTRICT_ARCS, NEIGHBORHOOD_WORKS, NEIGHBORHOOD_COMMONS,
  catalogCombinationCount
} from './game-data.js';
import { createRng, secureSeedHex, uniformInt, probabilityReceipt, RNG_ALGORITHM } from './rng.js';

const MILLION = 1_000_000;
const PET_TRAIT_WEIGHT = PET_TRAITS.reduce((sum, trait) => sum + trait.weight, 0);
const RARITY_WEIGHT = RARITIES.reduce((sum, rarity) => sum + rarity.weight, 0);

if (RARITY_WEIGHT !== MILLION) throw new Error(`Rarity table must total exactly ${MILLION}.`);
if (PET_TRAIT_WEIGHT !== MILLION) throw new Error(`Pet trait table must total exactly ${MILLION}.`);
if (new Set(LIFE_THREADS.map(thread => thread.id)).size !== LIFE_THREADS.length) throw new Error('Life-thread ids must be unique.');
if (new Set(BUSINESS_BUYERS.map(buyer => buyer.id)).size !== BUSINESS_BUYERS.length) throw new Error('Business buyer ids must be unique.');
if (new Set(BUSINESS_UPGRADES.map(upgrade => upgrade.id)).size !== BUSINESS_UPGRADES.length) throw new Error('Business upgrade ids must be unique.');
if (new Set(DISTRICT_RESIDENTS.map(resident => resident.id)).size !== DISTRICT_RESIDENTS.length) throw new Error('District resident ids must be unique.');
if (new Set(DISTRICT_ARCS.map(arc => arc.id)).size !== DISTRICT_ARCS.length) throw new Error('District arc ids must be unique.');
if (new Set(NEIGHBORHOOD_WORKS.orders.map(order => order.id)).size !== NEIGHBORHOOD_WORKS.orders.length) throw new Error('Neighborhood work-order ids must be unique.');
if (new Set(NEIGHBORHOOD_WORKS.approaches.map(approach => approach.id)).size !== NEIGHBORHOOD_WORKS.approaches.length) throw new Error('Neighborhood work approaches must be unique.');
if (NEIGHBORHOOD_WORKS.orders.some(order => !DISTRICT_RESIDENTS.some(resident => resident.id === order.residentId))) throw new Error('Every neighborhood work order needs a known resident route.');
if (!DISTRICT_RESIDENTS.some(resident => resident.id === NEIGHBORHOOD_COMMONS.maintenance.workOrder.residentId)) throw new Error('The Hushglass maintenance work override needs a known resident route.');
if (new Set(NEIGHBORHOOD_COMMONS.maintenance.routes.map(route => route.id)).size !== NEIGHBORHOOD_COMMONS.maintenance.routes.length) throw new Error('Hushglass maintenance route ids must be unique.');
if (new Set(NEIGHBORHOOD_COMMONS.maintenance.governance.models.map(model => model.id)).size !== NEIGHBORHOOD_COMMONS.maintenance.governance.models.length) throw new Error('Hushglass governance model ids must be unique.');
if (new Set(NEIGHBORHOOD_COMMONS.maintenance.faults.map(fault => fault.id)).size !== NEIGHBORHOOD_COMMONS.maintenance.faults.length) throw new Error('Hushglass maintenance fault ids must be unique.');
for (const resident of DISTRICT_RESIDENTS) {
  if (!['deepnight','foreglow','highglow','afterglow'].every(phase => resident.schedule?.[phase])) throw new Error(`District resident ${resident.id} needs all four schedule phases.`);
}
for (const arc of DISTRICT_ARCS) {
  if (!DISTRICT_RESIDENTS.some(resident => resident.id === arc.residentId)) throw new Error(`District arc ${arc.id} names an unknown resident.`);
  if (!Array.isArray(arc.choices) || arc.choices.length < 2) throw new Error(`District arc ${arc.id} needs at least two choices.`);
  if (new Set(arc.choices.map(choice => choice.id)).size !== arc.choices.length) throw new Error(`District arc ${arc.id} has duplicate choice ids.`);
}
for (const thread of LIFE_THREADS) {
  if (!LOCATIONS[thread.location]) throw new Error(`Life thread ${thread.id} names an unknown location.`);
  if (!ACTORS[thread.actor]) throw new Error(`Life thread ${thread.id} names an unknown actor.`);
  if (thread.householdId && thread.householdId !== NEIGHBORHOOD_COMMONS.id) throw new Error(`Life thread ${thread.id} names an unknown household.`);
  if (!Array.isArray(thread.choices) || thread.choices.length < 3) throw new Error(`Life thread ${thread.id} needs at least three choices.`);
  if (new Set(thread.choices.map(choice => choice.id)).size !== thread.choices.length) throw new Error(`Life thread ${thread.id} has duplicate choice ids.`);
}

const nowIso = () => new Date().toISOString();
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const intersects = (left = [], right = []) => left.some(tag => right.includes(tag));
const unique = values => [...new Set(values)];

function initialCommonsMaintenance() {
  return {
    integrity:0,
    nextDueDay:null,
    active:null,
    cycles:0,
    overdueCycles:0,
    lastOverdueDueDay:null,
    participantPetIds:[],
    governance:{ modelId:null, selectedDay:null, selectedCycle:null, reviewDueCycle:null, history:[], lastReceipt:null },
    fault:null,
    faultHistory:[],
    history:[],
    sequence:1,
    lastReceipt:null
  };
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function createInitialState(name = 'Pip') {
  return {
    schema: 'small-odds.save/v1',
    version: GAME_VERSION,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    player: {
      name: String(name || 'Pip').trim().slice(0, 24) || 'Pip',
      energy: 62,
      maxEnergy: 100,
      knowledge: 0,
      reputation: 0
    },
    money: 19,
    day: 1,
    hour: 18,
    location: 'shore',
    focus: 1,
    introStep: 0,
    portal: {
      unlocked: false,
      charges: 0,
      maxCharges: 3,
      draws: 0,
      activations: 0,
      upgrades: [],
      receipts: []
    },
    inventory: [],
    installed: [],
    pets: [],
    business: null,
    home: { score: 0, upgrades: [] },
    relationships: { mom: 3, dad: 4, shellby: 0, tavi: 0, oola: 0, nibbin: 0, latch: 0, sumi: 0, vendor: 0, vesper: 0 },
    district: {
      visits: 0,
      encounters: [],
      gifts: [],
      deliveries: [],
      houseMarks: [],
      arcs: [],
      scheduledArcs: [],
      cooldowns: {},
      supplier: { id:DISTRICT_SUPPLIER.id, standing:0, cycles:0, lastReceipt:null },
      households: {
        [NEIGHBORHOOD_COMMONS.id]: { id:NEIGHBORHOOD_COMMONS.id, warmth:0, trust:0, agreements:0, maintenance:initialCommonsMaintenance(), history:[], lastReceipt:null }
      },
      sequence: 1,
      lastReceipt: null
    },
    work: {
      employerId: NEIGHBORHOOD_WORKS.id,
      standing: 0,
      pressure: 0,
      active: null,
      history: [],
      completed: 0,
      sequence: 1,
      lastReceipt: null
    },
    starspite: {
      access: 'locked',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      netCredits: 0,
      insuredItemId: null,
      lotsPurchased: [],
      crimeReported: false,
      lastReceipt: null,
      history: []
    },
    life: {
      active: [],
      scheduled: [],
      history: [],
      sequence: 1,
      lastSpawnDay: 0
    },
    world: {
      eventIndex: 0,
      eventHistory: [WORLD_EVENTS[0].id],
      locations: ['shore'],
      starterPetFound: false,
      casinoTicket: null,
      reactionsSeen: [],
      totalEarned: 0,
      totalLost: 0
    },
    ledger: [{ at: nowIso(), day: 1, hour: 18, kind: 'life', text: 'Fired, evicted, and carrying one box home. A statistically ordinary disaster.' }],
    settings: { sound: true, motion: true, receiptDetail: false },
    stats: { itemsGenerated: 0, itemsSold: 0, itemsGifted: 0, itemsInstalled: 0, reactions: 0, activities: 0, casinoPlays: 0, casinoLots: 0, lifeChoices: 0, lifeConsequences: 0, businessListings: 0, businessSales: 0, businessCounters: 0, businessCallbacks: 0, districtTalks: 0, districtGifts: 0, districtDeliveries: 0, districtArcChoices: 0, districtArcReturns: 0, neighborLifeRoutes: 0, workOrdersStarted: 0, workOrdersCompleted: 0, workLifeRoutes: 0, householdLifeChoices: 0, householdReturns: 0, supplierHouseholdRoutes: 0, petHouseholdRoutes: 0, commonsMaintenanceStarts: 0, commonsMaintenanceReturns: 0, commonsMaintenanceOverdues: 0, commonsWorkConflicts: 0, commonsAssetRoutes: 0, commonsReturningPetRoutes: 0, commonsGovernanceChoices: 0, commonsGovernanceReviews: 0, commonsFaultsActivated: 0, commonsFaultsResolved: 0 }
  };
}

export function migrateState(candidate) {
  if (!candidate || candidate.schema !== 'small-odds.save/v1') throw new Error('This is not a SMALL ODDS save.');
  if (candidate.version > GAME_VERSION) throw new Error('This save comes from a newer version of SMALL ODDS.');
  const sourceVersion = Math.max(1,Math.round(Number(candidate.version) || 1));
  const base = createInitialState(candidate.player?.name);
  const state = {
    ...base,
    ...candidate,
    player: { ...base.player, ...(candidate.player || {}) },
    portal: { ...base.portal, ...(candidate.portal || {}) },
    home: { ...base.home, ...(candidate.home || {}) },
    relationships: { ...base.relationships, ...(candidate.relationships || {}) },
    district: { ...base.district, ...(candidate.district || {}) },
    work: { ...base.work, ...(candidate.work || {}) },
    starspite: { ...base.starspite, ...(candidate.starspite || {}) },
    life: { ...base.life, ...(candidate.life || {}) },
    world: { ...base.world, ...(candidate.world || {}) },
    settings: { ...base.settings, ...(candidate.settings || {}) },
    stats: { ...base.stats, ...(candidate.stats || {}) }
  };
  if (state.world.casinoTicket?.status === 'authentic-unredeemed' && state.starspite.access === 'locked') {
    state.starspite.access = 'invited';
  }
  if (state.world.casinoTicket?.status === 'redeemed') {
    state.starspite.access = 'member';
    if (!state.world.locations.includes('starspite')) state.world.locations.push('starspite');
  }
  if (!Array.isArray(state.starspite.history)) state.starspite.history = [];
  if (!Array.isArray(state.starspite.lotsPurchased)) state.starspite.lotsPurchased = [];
  if (!Array.isArray(state.life.active)) state.life.active = [];
  if (!Array.isArray(state.life.scheduled)) state.life.scheduled = [];
  if (!Array.isArray(state.life.history)) state.life.history = [];
  if (!Array.isArray(state.district.encounters)) state.district.encounters = [];
  if (!Array.isArray(state.district.gifts)) state.district.gifts = [];
  if (!Array.isArray(state.district.deliveries)) state.district.deliveries = [];
  if (!Array.isArray(state.district.houseMarks)) state.district.houseMarks = [];
  if (!Array.isArray(state.district.arcs)) state.district.arcs = [];
  if (!Array.isArray(state.district.scheduledArcs)) state.district.scheduledArcs = [];
  if (!state.district.cooldowns || typeof state.district.cooldowns !== 'object' || Array.isArray(state.district.cooldowns)) state.district.cooldowns = {};
  state.district.supplier = { ...base.district.supplier, ...(state.district.supplier || {}) };
  state.district.supplier.standing = clamp(Math.round(Number(state.district.supplier.standing) || 0),-12,12);
  state.district.supplier.cycles = Math.max(0,Math.round(Number(state.district.supplier.cycles) || 0));
  if (!state.district.households || typeof state.district.households !== 'object' || Array.isArray(state.district.households)) state.district.households = {};
  const baseHousehold = base.district.households[NEIGHBORHOOD_COMMONS.id];
  const household = { ...baseHousehold, ...(state.district.households[NEIGHBORHOOD_COMMONS.id] || {}) };
  household.id = NEIGHBORHOOD_COMMONS.id;
  household.warmth = clamp(Math.round(Number(household.warmth) || 0),-8,12);
  household.trust = clamp(Math.round(Number(household.trust) || 0),-8,12);
  household.agreements = Math.max(0,Math.round(Number(household.agreements) || 0));
  if (!Array.isArray(household.history)) household.history = [];
  household.history = household.history.slice(0,80);
  const maintenanceBase = initialCommonsMaintenance();
  const maintenance = { ...maintenanceBase, ...(household.maintenance && typeof household.maintenance === 'object' && !Array.isArray(household.maintenance) ? household.maintenance : {}) };
  maintenance.integrity = clamp(Math.round(Number(maintenance.integrity) || 0),0,8);
  maintenance.nextDueDay = maintenance.nextDueDay == null ? null : Math.max(1,Math.round(Number(maintenance.nextDueDay) || state.day));
  maintenance.cycles = Math.max(0,Math.round(Number(maintenance.cycles) || 0));
  maintenance.overdueCycles = Math.max(0,Math.round(Number(maintenance.overdueCycles) || 0));
  maintenance.lastOverdueDueDay = maintenance.lastOverdueDueDay == null ? null : Math.max(1,Math.round(Number(maintenance.lastOverdueDueDay) || 1));
  maintenance.sequence = Math.max(1,Math.round(Number(maintenance.sequence) || 1));
  const governanceBase = maintenanceBase.governance;
  maintenance.governance = { ...governanceBase, ...(maintenance.governance && typeof maintenance.governance === 'object' && !Array.isArray(maintenance.governance) ? maintenance.governance : {}) };
  if (!NEIGHBORHOOD_COMMONS.maintenance.governance.models.some(model => model.id === maintenance.governance.modelId)) maintenance.governance.modelId = null;
  maintenance.governance.selectedDay = maintenance.governance.selectedDay == null ? null : Math.max(1,Math.round(Number(maintenance.governance.selectedDay) || state.day));
  maintenance.governance.selectedCycle = maintenance.governance.selectedCycle == null ? null : Math.max(0,Math.round(Number(maintenance.governance.selectedCycle) || 0));
  maintenance.governance.reviewDueCycle = maintenance.governance.reviewDueCycle == null ? null : Math.max(0,Math.round(Number(maintenance.governance.reviewDueCycle) || 0));
  if (!Array.isArray(maintenance.governance.history)) maintenance.governance.history = [];
  maintenance.governance.history = maintenance.governance.history.slice(0,40);
  if (!Array.isArray(maintenance.faultHistory)) maintenance.faultHistory = [];
  maintenance.faultHistory = maintenance.faultHistory.slice(0,40);
  if (maintenance.fault && !NEIGHBORHOOD_COMMONS.maintenance.faults.some(fault => fault.id === maintenance.fault.definitionId)) maintenance.fault = null;
  if (!Array.isArray(maintenance.history)) maintenance.history = [];
  maintenance.history = maintenance.history.slice(0,80);
  const evidencedPetIds = household.history.map(entry => entry?.receipt?.petRoute?.petId).filter(Boolean);
  maintenance.participantPetIds = unique([...(Array.isArray(maintenance.participantPetIds) ? maintenance.participantPetIds : []),...evidencedPetIds].filter(id => typeof id === 'string'));
  if (maintenance.active && (!NEIGHBORHOOD_COMMONS.maintenance.routes.some(route => route.id === maintenance.active.routeId) && maintenance.active.routeId !== 'long-table-contract')) maintenance.active = null;
  if (sourceVersion < 9 && household.agreements > 0 && household.history.some(entry => entry?.kind === 'return')) {
    maintenance.integrity = Math.max(2,maintenance.integrity);
    maintenance.nextDueDay ??= state.day;
  }
  household.maintenance = maintenance;
  state.district.households = { ...state.district.households, [NEIGHBORHOOD_COMMONS.id]:household };
  if (!Array.isArray(state.work.history)) state.work.history = [];
  state.work.employerId = NEIGHBORHOOD_WORKS.id;
  state.work.standing = clamp(Math.round(Number(state.work.standing) || 0),-8,12);
  state.work.pressure = clamp(Math.round(Number(state.work.pressure) || 0),0,12);
  state.work.completed = Math.max(0,Math.round(Number(state.work.completed) || 0));
  state.work.sequence = Math.max(1,Math.round(Number(state.work.sequence) || 1));
  if (state.work.active && (!neighborhoodWorkOrderById(state.work.active.orderId) || !NEIGHBORHOOD_WORKS.approaches.some(approach => approach.id === state.work.active.approachId))) state.work.active = null;
  state.work.history = state.work.history.slice(0,80);
  state.district.visits = Math.max(0, Number(state.district.visits) || 0);
  state.district.sequence = Math.max(1, Number(state.district.sequence) || 1);
  state.life.sequence = Math.max(1, Number(state.life.sequence) || 1);
  state.life.lastSpawnDay = Math.max(0, Number(state.life.lastSpawnDay) || 0);
  if (state.business) state.business = normalizeBusinessState(state.business, state);
  state.version = GAME_VERSION;
  syncLifeThreads(state);
  state.updatedAt = nowIso();
  return state;
}

export function currentWorldEvent(state) {
  return WORLD_EVENTS[((state.world.eventIndex % WORLD_EVENTS.length) + WORLD_EVENTS.length) % WORLD_EVENTS.length];
}

export function formatPlanetTime(state) {
  const hour = ((state.hour % 24) + 24) % 24;
  const phase = hour < 6 ? 'deepnight' : hour < 12 ? 'foreglow' : hour < 18 ? 'highglow' : 'afterglow';
  return `Day ${state.day} · ${String(hour).padStart(2, '0')}:00 ${phase}`;
}

export function districtPhase(state) {
  const hour = ((Number(state?.hour) || 0) % 24 + 24) % 24;
  return hour < 6 ? 'deepnight' : hour < 12 ? 'foreglow' : hour < 18 ? 'highglow' : 'afterglow';
}

function supplierBandForStanding(standing) {
  return DISTRICT_SUPPLIER.bands.find(band =>
    (band.minimum == null || standing >= band.minimum) && (band.maximum == null || standing <= band.maximum)
  ) || DISTRICT_SUPPLIER.bands[1];
}

export function districtSupplierProfile(state) {
  const standing = clamp(Math.round(Number(state.district?.supplier?.standing) || 0),-12,12);
  const band = supplierBandForStanding(standing);
  return {
    id:DISTRICT_SUPPLIER.id,
    name:DISTRICT_SUPPLIER.name,
    household:DISTRICT_SUPPLIER.household,
    description:DISTRICT_SUPPLIER.description,
    glyph:DISTRICT_SUPPLIER.glyph,
    standing,
    state:band.id,
    label:band.label,
    businessFactor:normalizedFactor(band.businessFactor),
    color:band.color,
    summary:band.summary,
    scheduleOverrides:DISTRICT_SUPPLIER.scheduleOverrides[band.id] || {},
    pendingReturns:(state.district?.scheduledArcs || []).length,
    completedReturns:(state.district?.arcs || []).filter(entry => entry.kind === 'return').length
  };
}

function householdBandForWarmth(warmth) {
  return NEIGHBORHOOD_COMMONS.bands.find(band =>
    (band.minimum == null || warmth >= band.minimum) && (band.maximum == null || warmth <= band.maximum)
  ) || NEIGHBORHOOD_COMMONS.bands[1];
}

export function districtHouseholdProfile(state) {
  const source = state.district?.households?.[NEIGHBORHOOD_COMMONS.id] || {};
  const warmth = clamp(Math.round(Number(source.warmth) || 0),-8,12);
  const band = householdBandForWarmth(warmth);
  return {
    id:NEIGHBORHOOD_COMMONS.id,
    name:NEIGHBORHOOD_COMMONS.name,
    household:NEIGHBORHOOD_COMMONS.household,
    glyph:NEIGHBORHOOD_COMMONS.glyph,
    resource:NEIGHBORHOOD_COMMONS.resource,
    description:NEIGHBORHOOD_COMMONS.description,
    warmth,
    trust:clamp(Math.round(Number(source.trust) || 0),-8,12),
    agreements:Math.max(0,Math.round(Number(source.agreements) || 0)),
    state:band.id,
    label:band.label,
    color:band.color,
    summary:band.summary,
    scheduleOverrides:NEIGHBORHOOD_COMMONS.scheduleOverrides[band.id] || {},
    history:Array.isArray(source.history) ? source.history : [],
    lastReceipt:source.lastReceipt || null,
    random:false
  };
}

export function householdPetProfile(state, skillTags = NEIGHBORHOOD_COMMONS.petSkillTags) {
  const pet = state.business?.assignedPetId ? state.pets.find(candidate => candidate.id === state.business.assignedPetId) : null;
  if (!pet) return { pet:null, laborPoints:0, speciesMatches:[], traitMatches:[], reasons:[], skillTags:[...skillTags] };
  const species = PET_SPECIES.find(candidate => candidate.id === pet.speciesId) || null;
  const speciesMatches = (species?.tags || []).filter(tag => skillTags.includes(tag));
  const traitMatches = (pet.traits || []).filter(trait => skillTags.includes(trait.tag)).map(trait => ({ id:trait.id, name:trait.name, tag:trait.tag, points:2 }));
  const laborPoints = speciesMatches.length + traitMatches.reduce((sum,match) => sum + match.points,0);
  const reasons = [
    ...speciesMatches.map(tag => `${species.name} species tag ${tag}: +1 commons point`),
    ...traitMatches.map(match => `${match.name} trait tag ${match.tag}: +${match.points} commons points`)
  ];
  return { pet, species, laborPoints, speciesMatches, traitMatches, reasons, skillTags:[...skillTags] };
}

function maintenanceBandForIntegrity(integrity) {
  return NEIGHBORHOOD_COMMONS.maintenance.integrityBands.find(band =>
    (band.minimum == null || integrity >= band.minimum) && (band.maximum == null || integrity <= band.maximum)
  ) || NEIGHBORHOOD_COMMONS.maintenance.integrityBands[0];
}

const COMMONS_MAINTENANCE_EFFECT_KEYS = [
  'integrityDelta','warmthDelta','trustDelta','agreementsDelta','supplierStandingDelta',
  'workStandingDelta','workPressureDelta','businessRatingGain','homeGain',
  'residentRelationshipGain','petAffectionGain'
];

function maintenanceGovernanceModel(modelId) {
  return NEIGHBORHOOD_COMMONS.maintenance.governance.models.find(model => model.id === modelId) || null;
}

function maintenanceFaultDefinition(faultId) {
  return NEIGHBORHOOD_COMMONS.maintenance.faults.find(fault => fault.id === faultId) || null;
}

function addMaintenanceEffects(...effects) {
  const combined = Object.fromEntries(COMMONS_MAINTENANCE_EFFECT_KEYS.map(key => [key,0]));
  for (const effect of effects.filter(Boolean)) {
    for (const key of COMMONS_MAINTENANCE_EFFECT_KEYS) combined[key] += Math.round(Number(effect[key]) || 0);
  }
  const authored = effects.find(Boolean) || {};
  return { ...authored, ...combined, residentId:authored.residentId || 'sumi', houseMark:authored.houseMark || 'valve-rota-card' };
}

function latestMaintenanceReturnEvidence(state) {
  const maintenance = state.district?.households?.[NEIGHBORHOOD_COMMONS.id]?.maintenance || initialCommonsMaintenance();
  const entry = (maintenance.history || []).find(candidate => candidate?.kind === 'return') || null;
  const receipt = entry?.receipt || null;
  const nested = receipt?.commonsMaintenance || null;
  const routeId = entry?.routeId || receipt?.routeId || nested?.routeId || null;
  return {
    historyAt:entry?.at || null,
    historyDay:entry?.day ?? null,
    routeId,
    assetId:routeId === 'retained-relay' ? receipt?.asset?.id || nested?.asset?.id || null : null,
    petId:routeId === 'returning-pet' ? receipt?.pet?.id || nested?.pet?.id || null : null,
    receiptSchema:receipt?.schema || null,
    workPressure:clamp(Math.round(Number(state.work?.pressure) || 0),0,12)
  };
}

function selectCommonsMaintenanceFault(state) {
  const evidence = latestMaintenanceReturnEvidence(state);
  const faultId = evidence.routeId === 'retained-relay' || evidence.assetId
    ? 'relay-backfeed'
    : evidence.routeId === 'returning-pet' || evidence.petId
      ? 'signature-drift'
      : evidence.routeId === 'long-table-contract' || evidence.workPressure >= 2
        ? 'bid-hammer'
        : 'date-fog';
  const definition = maintenanceFaultDefinition(faultId);
  return {
    id:`fault-${state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.nextDueDay}-${definition.id}`,
    definitionId:definition.id,
    label:definition.label,
    glyph:definition.glyph,
    summary:definition.summary,
    trigger:definition.trigger,
    dueDay:state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.nextDueDay,
    selectedDay:state.day,
    causeEvidence:evidence,
    scheduleOverrides:cloneState(definition.scheduleOverrides),
    random:false
  };
}

export function activateCommonsMaintenanceFault(state) {
  const household = state.district?.households?.[NEIGHBORHOOD_COMMONS.id];
  const maintenance = household?.maintenance;
  if (!maintenance || maintenance.fault || maintenance.active || maintenance.cycles < NEIGHBORHOOD_COMMONS.maintenance.governance.firstChoiceCycle) return maintenance?.fault || null;
  const householdProfile = districtHouseholdProfile(state);
  const accordEvidence = householdProfile.history.some(entry => entry?.kind === 'return' && /^small-odds\.household-accord-return\//.test(entry?.receipt?.schema || '')) || maintenance.cycles > 0;
  const due = householdProfile.agreements >= NEIGHBORHOOD_COMMONS.maintenance.minimumAgreements
    && accordEvidence
    && householdProfile.warmth >= NEIGHBORHOOD_COMMONS.maintenance.minimumWarmth
    && maintenance.nextDueDay != null
    && state.day >= maintenance.nextDueDay;
  if (!due) return null;
  const fault = selectCommonsMaintenanceFault(state);
  const receipt = {
    schema:'small-odds.commons-maintenance-fault/v1', random:false,
    faultId:fault.id, definitionId:fault.definitionId, label:fault.label,
    dueDay:fault.dueDay, activatedDay:state.day, causeEvidence:cloneState(fault.causeEvidence),
    selectionRule:'retained relay > returning named pet > Long Table route or pressure 2+ > public date-fog fallback',
    ignoredInputs:['portal draws','casino history','cash on hand','session length','belief that a fault was due'],
    portalOddsChanged:false
  };
  maintenance.fault = { ...fault, activationReceipt:receipt };
  maintenance.lastReceipt = receipt;
  household.lastReceipt = receipt;
  state.district.lastReceipt = receipt;
  state.stats.commonsFaultsActivated += 1;
  const text = `${fault.label} entered the public Day ${fault.dueDay} record from saved service history; no roll selected it.`;
  maintenanceHistoryEntry(state,{ kind:'fault', routeId:fault.causeEvidence.routeId, text, receipt, random:false });
  householdHistoryEntry(state,{ kind:'maintenance-fault', routeId:fault.causeEvidence.routeId, text, receipt, random:false });
  if (state.business) recordBusinessHistory(state,'commons-maintenance-fault',text,receipt);
  addLedger(state,'commons-maintenance-fault',text,{ receipt });
  return maintenance.fault;
}

export function commonsMaintenanceAssets(state) {
  const requiredTags = NEIGHBORHOOD_COMMONS.maintenance.assetTags;
  const assets = [
    ...(state.business?.assets || []).map(item => ({ item, source:'store-equipment' })),
    ...(state.installed || []).map(item => ({ item, source:'home-installation' }))
  ];
  return assets.map(({ item, source }) => {
    const matchedTags = (item.tags || []).filter(tag => requiredTags.includes(tag));
    return { id:item.id, name:item.name, glyph:item.glyph, source, matchedTags, eligible:matchedTags.length > 0, item };
  }).filter(candidate => candidate.eligible);
}

export function commonsMaintenancePetProfile(state) {
  const household = state.district?.households?.[NEIGHBORHOOD_COMMONS.id] || {};
  const maintenance = household.maintenance || initialCommonsMaintenance();
  const profile = householdPetProfile(state,NEIGHBORHOOD_COMMONS.maintenance.petSkillTags);
  const previouslyParticipated = Boolean(profile.pet && maintenance.participantPetIds?.includes(profile.pet.id));
  return { ...profile, previouslyParticipated, participantPetIds:[...(maintenance.participantPetIds || [])] };
}

export function commonsMaintenanceProfile(state) {
  const household = districtHouseholdProfile(state);
  const source = state.district?.households?.[NEIGHBORHOOD_COMMONS.id]?.maintenance || initialCommonsMaintenance();
  const integrity = clamp(Math.round(Number(source.integrity) || 0),0,8);
  const band = maintenanceBandForIntegrity(integrity);
  const accordEvidence = household.history.some(entry => entry?.kind === 'return' && /^small-odds\.household-accord-return\//.test(entry?.receipt?.schema || '')) || Math.max(0,Number(source.cycles) || 0) > 0;
  const configured = household.agreements >= NEIGHBORHOOD_COMMONS.maintenance.minimumAgreements && accordEvidence;
  const warmEnough = household.warmth >= NEIGHBORHOOD_COMMONS.maintenance.minimumWarmth;
  const nextDueDay = source.nextDueDay == null ? null : Math.max(1,Math.round(Number(source.nextDueDay) || state.day));
  const due = configured && warmEnough && nextDueDay != null && state.day >= nextDueDay && !source.active;
  const overdue = due && state.day > nextDueDay + NEIGHBORHOOD_COMMONS.maintenance.graceDays;
  const scheduleState = source.active ? 'active' : overdue ? 'overdue' : due ? 'due' : null;
  const cycles = Math.max(0,Math.round(Number(source.cycles) || 0));
  const governance = source.governance || initialCommonsMaintenance().governance;
  const governanceModel = maintenanceGovernanceModel(governance.modelId);
  const governanceRequired = due && cycles >= NEIGHBORHOOD_COMMONS.maintenance.governance.firstChoiceCycle && !governanceModel;
  const reviewAvailable = due && Boolean(governanceModel) && governance.reviewDueCycle != null && cycles >= governance.reviewDueCycle;
  const fault = source.fault || (due && cycles >= NEIGHBORHOOD_COMMONS.maintenance.governance.firstChoiceCycle ? selectCommonsMaintenanceFault(state) : null);
  const baseScheduleOverrides = scheduleState ? (NEIGHBORHOOD_COMMONS.maintenance.scheduleOverrides[scheduleState] || {}) : {};
  const scheduleOverrides = scheduleState ? { ...baseScheduleOverrides, ...(fault?.scheduleOverrides || {}) } : {};
  return {
    resource:NEIGHBORHOOD_COMMONS.maintenance.resource,
    integrity,
    integrityState:band.id,
    integrityLabel:band.label,
    integrityColor:band.color,
    integritySummary:band.summary,
    configured,
    accordEvidence,
    warmEnough,
    due,
    overdue,
    scheduleState,
    scheduleOverrides,
    nextDueDay,
    daysUntilDue:nextDueDay == null ? null : nextDueDay - state.day,
    active:source.active || null,
    cycles,
    overdueCycles:Math.max(0,Math.round(Number(source.overdueCycles) || 0)),
    participantPetIds:[...(source.participantPetIds || [])],
    history:Array.isArray(source.history) ? source.history : [],
    lastReceipt:source.lastReceipt || null,
    governance:{ ...governance, model:governanceModel },
    governanceRequired,
    governanceReviewAvailable:reviewAvailable,
    fault,
    faultHistory:Array.isArray(source.faultHistory) ? source.faultHistory : [],
    conflictOrderActive:(due || overdue) && !governanceRequired,
    random:false
  };
}

export function commonsGovernanceOptions(state) {
  const profile = commonsMaintenanceProfile(state);
  const household = districtHouseholdProfile(state);
  const supplier = districtSupplierProfile(state);
  const work = neighborhoodWorkProfile(state);
  const selectionWindow = profile.due && !profile.active && profile.cycles >= NEIGHBORHOOD_COMMONS.maintenance.governance.firstChoiceCycle;
  const mayChoose = profile.governanceRequired || profile.governanceReviewAvailable;
  const models = NEIGHBORHOOD_COMMONS.maintenance.governance.models.map(model => {
    const reasons = [];
    if ((model.minimumTrust || 0) > household.trust) reasons.push(`Hushglass trust ${household.trust}/${model.minimumTrust}`);
    if ((model.minimumBusinessRating || 0) > (state.business?.rating || 0)) reasons.push(`store rating ${state.business?.rating || 0}/${model.minimumBusinessRating}`);
    if ((model.minimumSupplierStanding || 0) > supplier.standing) reasons.push(`Kettle standing ${supplier.standing}/${model.minimumSupplierStanding}`);
    if ((model.minimumWorkStanding || 0) > work.standing) reasons.push(`Long Table standing ${work.standing}/${model.minimumWorkStanding}`);
    const eligible = reasons.length === 0;
    const current = profile.governance.modelId === model.id;
    const open = selectionWindow && mayChoose && eligible && !current;
    const reason = !selectionWindow
      ? `Ownership decisions open on a due date after cycle ${NEIGHBORHOOD_COMMONS.maintenance.governance.firstChoiceCycle}.`
      : !mayChoose
        ? `The current charter can be reviewed at completed cycle ${profile.governance.reviewDueCycle}.`
        : current
          ? 'This is the current ownership model.'
          : reasons.join(' · ');
    return { ...model, current, eligible, open, reason, unmet:reasons };
  });
  return { profile, models, required:profile.governanceRequired, reviewAvailable:profile.governanceReviewAvailable, mayChoose, selectionWindow };
}

function composedCommonsServiceEffect(state, authoredEffect) {
  const profile = commonsMaintenanceProfile(state);
  const model = profile.governance.model;
  const faultDefinition = maintenanceFaultDefinition(profile.fault?.definitionId);
  const governanceEffect = model?.serviceEffect || null;
  const faultEffect = model && faultDefinition ? faultDefinition.serviceByModel?.[model.id] || null : null;
  return {
    effect:addMaintenanceEffects(authoredEffect,governanceEffect,faultEffect),
    breakdown:{ authored:cloneState(authoredEffect), governance:model ? { modelId:model.id, modelLabel:model.label, effect:cloneState(governanceEffect) } : null, fault:faultDefinition && model ? { faultId:profile.fault.id, definitionId:faultDefinition.id, label:faultDefinition.label, effect:cloneState(faultEffect) } : null }
  };
}

export function commonsMaintenanceOptions(state) {
  const profile = commonsMaintenanceProfile(state);
  const assets = commonsMaintenanceAssets(state);
  const pet = commonsMaintenancePetProfile(state);
  const baseReason = profile.active
    ? `${profile.active.label || 'Maintenance'} is already in service until Day ${profile.active.dueDay}.`
    : !profile.configured
      ? 'Complete and preserve one Hushglass accord return before maintenance can recur.'
      : !profile.warmEnough
        ? `Hushglass needs warmth ${NEIGHBORHOOD_COMMONS.maintenance.minimumWarmth} before a repeatable service rota can operate.`
        : !profile.due
          ? `The next authored service day is Day ${profile.nextDueDay}.`
          : profile.governanceRequired
            ? 'Choose who owns the public obligation before selecting a service route.'
            : '';
  const routes = NEIGHBORHOOD_COMMONS.maintenance.routes.map(route => {
    let open = !baseReason;
    let reason = baseReason;
    if (open && route.requiresAsset && !assets.length) {
      open = false;
      reason = 'No retained home installation or storefront equipment has a matching maintenance tag.';
    }
    if (open && route.requiresReturningPet && (!pet.pet || !pet.previouslyParticipated || pet.laborPoints < route.minimumLaborPoints)) {
      open = false;
      reason = !pet.pet ? 'Assign a pet first.' : !pet.previouslyParticipated ? `${pet.pet.name} is not named in the saved Hushglass accord evidence.` : `${pet.pet.name} has ${pet.laborPoints}/${route.minimumLaborPoints} literal maintenance points.`;
    }
    const composed = composedCommonsServiceEffect(state,route.returnEffect);
    return { ...route, returnEffect:composed.effect, effectBreakdown:composed.breakdown, open, reason, assets:route.requiresAsset ? assets : [], pet:route.requiresReturningPet ? pet : null };
  });
  return { profile, routes, assets, pet };
}

export function districtResidentsNow(state) {
  const phase = districtPhase(state);
  const supplier = districtSupplierProfile(state);
  const household = districtHouseholdProfile(state);
  const maintenance = commonsMaintenanceProfile(state);
  return DISTRICT_RESIDENTS.map(resident => ({
    ...resident,
    actor:ACTORS[resident.id],
    phase,
    current:maintenance.scheduleOverrides[resident.id] || household.scheduleOverrides[resident.id] || supplier.scheduleOverrides[resident.id] || resident.schedule[phase],
    scheduleSource:maintenance.scheduleOverrides[resident.id] ? `commons-maintenance:${maintenance.scheduleState}` : household.scheduleOverrides[resident.id] ? `household-state:${household.state}` : supplier.scheduleOverrides[resident.id] ? `supplier-state:${supplier.state}` : `daily-phase:${phase}`,
    supplierState:supplier.state,
    householdState:household.state,
    maintenanceState:maintenance.scheduleState,
    relationship:Number(state.relationships[resident.id]) || 0
  }));
}

function districtArcDefinition(residentId) {
  return DISTRICT_ARCS.find(arc => arc.residentId === residentId) || null;
}

export function districtArcStatus(state, residentId) {
  const definition = districtArcDefinition(residentId);
  if (!definition) return { exists:false, eligible:false, reason:'No authored repeat arc belongs to this resident.' };
  const relationship = Number(state.relationships[residentId]) || 0;
  const pending = (state.district?.scheduledArcs || []).find(entry => entry.arcId === definition.id) || null;
  const nextAvailableDay = Math.max(0,Number(state.district?.cooldowns?.[definition.id]) || 0);
  const enoughRelationship = relationship >= definition.minRelationship;
  const cooledDown = state.day >= nextAvailableDay;
  const eligible = enoughRelationship && cooledDown && !pending;
  const completedCycles = (state.district?.arcs || []).filter(entry => entry.arcId === definition.id && entry.kind === 'return').length;
  const reason = pending
    ? `A consequence is already due on Day ${pending.dueDay}.`
    : !enoughRelationship
      ? `Needs rapport ${definition.minRelationship}; current rapport is ${relationship}.`
      : !cooledDown
        ? `This thread can recur on Day ${nextAvailableDay}.`
        : 'The next authored cycle is available now.';
  return {
    exists:true, eligible, reason, definition, relationship, pending,
    nextAvailableDay, completedCycles, nextCycle:completedCycles + 1,
    prerequisite:{ type:'relationship', residentId, minimum:definition.minRelationship, current:relationship },
    cooldownDays:definition.cooldownDays
  };
}

export function resolveDistrictArcChoice(state, residentId, choiceId) {
  if (state.location !== 'district') return { ok:false, text:'This neighborhood thread can only move on Lopsided Lane.' };
  const status = districtArcStatus(state,residentId);
  if (!status.exists || !status.eligible) return { ok:false, text:status.reason };
  const definition = status.definition;
  const choice = definition.choices.find(candidate => candidate.id === choiceId);
  if (!choice) return { ok:false, text:'That response does not belong to this neighbor.' };
  if (state.player.energy + Number(choice.effect?.energy || 0) < 0) return { ok:false, text:'Pip is too tired for that neighborhood response.' };
  if (choice.cost && state.money < choice.cost) return { ok:false, text:`This response needs ${choice.cost} credits. Pip has ${state.money}.` };

  const beforeSupplier = districtSupplierProfile(state);
  if (choice.cost) {
    state.money -= choice.cost;
    state.world.totalLost += choice.cost;
  }
  const applied = applyLifeEffect(state,{ actor:residentId },choice.effect || {});
  state.district.supplier.standing = clamp(beforeSupplier.standing + Number(choice.supplierStandingDelta || 0),-12,12);
  state.district.supplier.cycles += 1;
  const afterSupplier = districtSupplierProfile(state);
  const cycle = status.nextCycle;
  const choiceRecordId = `district-arc-${state.district.sequence++}`;
  const dueDay = state.day + definition.dueDays;
  const nextAvailableDay = state.day + definition.cooldownDays;
  const receipt = {
    schema:'small-odds.district-arc-choice/v1', random:false,
    arcRecordId:choiceRecordId, arcId:definition.id, residentId, residentName:ACTORS[residentId].name,
    cycle, choiceId:choice.id, day:state.day, hour:state.hour, hours:choice.hours,
    prerequisite:{ ...status.prerequisite, satisfied:true },
    cooldownDays:definition.cooldownDays, nextAvailableDay, dueDay,
    applied, supplier:{ id:DISTRICT_SUPPLIER.id, beforeStanding:beforeSupplier.standing, standingDelta:Number(choice.supplierStandingDelta || 0), afterStanding:afterSupplier.standing, beforeState:beforeSupplier.state, afterState:afterSupplier.state, beforeBusinessFactor:beforeSupplier.businessFactor, afterBusinessFactor:afterSupplier.businessFactor },
    moneyIgnoredForAvailability:true, portalOddsChanged:false
  };
  state.district.arcs.unshift({ id:choiceRecordId, kind:'choice', day:state.day, hour:state.hour, arcId:definition.id, residentId, cycle, choiceId:choice.id, text:choice.result, receipt });
  state.district.arcs = state.district.arcs.slice(0,100);
  state.district.scheduledArcs.push({
    id:`return-${choiceRecordId}`, arcRecordId:choiceRecordId, arcId:definition.id,
    residentId, cycle, choiceId:choice.id, dueDay, followup:cloneState(choice.followup), random:false
  });
  state.district.cooldowns[definition.id] = nextAvailableDay;
  state.district.lastReceipt = receipt;
  state.district.supplier.lastReceipt = receipt;
  state.stats.districtArcChoices += 1;
  const text = `${choice.result} ${DISTRICT_SUPPLIER.name} standing ${beforeSupplier.standing} ${Number(choice.supplierStandingDelta || 0) >= 0 ? '+' : ''}${Number(choice.supplierStandingDelta || 0)} → ${afterSupplier.standing}; a consequence is due Day ${dueDay}.`;
  addLedger(state,'district',text,{ residentId, arcId:definition.id, receipt });
  advanceTime(state,choice.hours);
  state.updatedAt = nowIso();
  return { ok:true, text, receipt, status:districtArcStatus(state,residentId) };
}

export function resolveDistrictArcReturns(state) {
  const due = (state.district?.scheduledArcs || []).filter(entry => entry.dueDay <= state.day);
  if (!due.length) return [];
  const outcomes = [];
  for (const scheduled of due) {
    const definition = DISTRICT_ARCS.find(arc => arc.id === scheduled.arcId);
    const choice = definition?.choices.find(candidate => candidate.id === scheduled.choiceId);
    if (!definition || !choice) continue;
    const followup = scheduled.followup || choice.followup;
    const beforeSupplier = districtSupplierProfile(state);
    const applied = applyLifeEffect(state,{ actor:scheduled.residentId },followup.effect || {});
    const residentRelationshipGain = Math.round(Number(followup.residentRelationshipGain) || 0);
    if (residentRelationshipGain) {
      state.relationships[scheduled.residentId] = (state.relationships[scheduled.residentId] || 0) + residentRelationshipGain;
      applied.residentRelationship = residentRelationshipGain;
    }
    const supplierStandingDelta = Math.round(Number(followup.supplierStandingDelta) || 0);
    state.district.supplier.standing = clamp(beforeSupplier.standing + supplierStandingDelta,-12,12);
    const afterSupplier = districtSupplierProfile(state);
    const businessRatingGain = state.business ? Math.round(Number(followup.businessRatingGain) || 0) : 0;
    if (businessRatingGain) {
      state.business.rating += businessRatingGain;
      applied.businessRating = businessRatingGain;
    }
    const receipt = {
      schema:'small-odds.district-arc-return/v1', random:false,
      arcRecordId:scheduled.arcRecordId, arcId:scheduled.arcId,
      residentId:scheduled.residentId, residentName:ACTORS[scheduled.residentId].name,
      cycle:scheduled.cycle, choiceId:scheduled.choiceId,
      dueDay:scheduled.dueDay, resolvedDay:state.day, applied,
      supplier:{ id:DISTRICT_SUPPLIER.id, beforeStanding:beforeSupplier.standing, standingDelta:supplierStandingDelta, afterStanding:afterSupplier.standing, beforeState:beforeSupplier.state, afterState:afterSupplier.state, businessFactor:afterSupplier.businessFactor },
      businessRatingGain, portalOddsChanged:false
    };
    const text = followup.text;
    const parentText = followup.parentText || `${ACTORS[scheduled.residentId].name}'s cooperative follow-up reached the old window.`;
    const returnId = `district-return-${state.district.sequence++}`;
    state.district.arcs.unshift({ id:returnId, kind:'return', day:state.day, hour:state.hour, arcId:scheduled.arcId, residentId:scheduled.residentId, cycle:scheduled.cycle, choiceId:scheduled.choiceId, text, receipt });
    state.district.arcs = state.district.arcs.slice(0,100);
    state.district.houseMarks.unshift({ id:`house-${returnId}`, kind:'supplier', day:state.day, residentId:scheduled.residentId, parentText, visual:'kettle-crate', receipt });
    state.district.houseMarks = state.district.houseMarks.slice(0,40);
    state.district.lastReceipt = receipt;
    state.district.supplier.lastReceipt = receipt;
    state.stats.districtArcReturns += 1;
    addLedger(state,'district',text,{ residentId:scheduled.residentId, arcId:scheduled.arcId, receipt });
    addLedger(state,'home',parentText,{ residentId:scheduled.residentId, arcId:scheduled.arcId, receipt });
    if (state.business) recordBusinessHistory(state,'supplier',`${text} Storefront rating ${businessRatingGain >= 0 ? '+' : ''}${businessRatingGain}; cooperative service factor ×${afterSupplier.businessFactor.toFixed(2)}.`,receipt);
    outcomes.push({ scheduled, text, parentText, receipt });
  }
  const dueIds = new Set(due.map(entry => entry.id));
  state.district.scheduledArcs = state.district.scheduledArcs.filter(entry => !dueIds.has(entry.id));
  return outcomes;
}

function districtItemSnapshot(item) {
  if (!item) return null;
  return {
    id:item.id,
    name:item.name,
    glyph:item.glyph,
    rarity:item.rarity,
    tags:[...(item.tags || [])]
  };
}

function districtMatchingItem(item, resident) {
  return Boolean(item && intersects(item.tags || [], resident.interests));
}

export function districtResidentObservation(state, residentId) {
  const resident = DISTRICT_RESIDENTS.find(candidate => candidate.id === residentId);
  if (!resident) return { ok:false, text:'That neighbor is not on this street.' };
  const actor = ACTORS[resident.id];
  const residentNow = districtResidentsNow(state).find(candidate => candidate.id === residentId);
  const supplier = districtSupplierProfile(state);
  const phase = residentNow.phase;
  const schedule = residentNow.current;
  const carried = state.inventory.filter(item => districtMatchingItem(item,resident));
  const listed = (state.business?.listings || []).filter(listing => districtMatchingItem(listing.item,resident));
  const gifted = state.district.gifts.find(gift => gift.residentId === resident.id && districtMatchingItem(gift.item,resident)) || null;
  const sold = state.district.deliveries.find(delivery => delivery.residentId === resident.id && delivery.status === 'delivered' && districtMatchingItem(delivery.item,resident)) || null;
  const selected = gifted ? { status:'gifted', item:gifted.item }
    : sold ? { status:'sold', item:sold.item }
      : listed[0] ? { status:'listed', item:listed[0].item }
        : carried[0] ? { status:'carried', item:carried[0] }
          : { status:'ordinary', item:null };
  const event = currentWorldEvent(state);
  const context = selected.item ? DISTRICT_CONTEXT_REACTIONS.find(reaction =>
    reaction.eventTags.every(tag => event.tags.includes(tag)) && intersects(selected.item.tags, reaction.itemTags)
  ) || null : null;
  const statusText = selected.status === 'gifted'
    ? `${actor.name} still keeps ${selected.item.name} close enough to interrupt the conversation.`
    : selected.status === 'sold'
      ? `${actor.name} has seen ${selected.item.name} arrive through the lane's parcel spine after Pip sold it.`
      : selected.status === 'listed'
        ? `${actor.name} has already read the alien-web listing for ${selected.item.name} and has margin notes.`
        : selected.status === 'carried'
          ? `${actor.name} notices ${selected.item.name} in Pip's moving box before Pip says hello.`
          : `${actor.name} is ${schedule.label}. The lane has no object-shaped gossip yet.`;
  const text = `${statusText}${context ? ` ${context.line}` : ''}`;
  const receipt = {
    schema:'small-odds.district-observation/v1',
    random:false,
    day:state.day,
    hour:state.hour,
    phase,
    residentId:resident.id,
    residentName:actor.name,
    schedule:{ ...schedule },
    scheduleSource:residentNow.scheduleSource,
    supplier:{
      id:supplier.id,
      state:supplier.state,
      standing:supplier.standing,
      businessFactor:supplier.businessFactor,
      scheduleOverride:residentNow.scheduleSource.startsWith('supplier-state:')
    },
    interests:[...resident.interests],
    observedSignals:{
      carried:carried.map(item => item.id),
      listed:listed.map(listing => listing.item.id),
      gifted:gifted?.item.id || null,
      sold:sold?.item.id || null
    },
    selectedStatus:selected.status,
    selectedItem:districtItemSnapshot(selected.item),
    contextReactionId:context?.id || null,
    contextEventId:event.id,
    contextMatches:context ? selected.item.tags.filter(tag => context.itemTags.includes(tag)) : [],
    priority:'gifted > sold-and-delivered > listed > carried > ordinary',
    moneyIgnored:true,
    portalOddsChanged:false
  };
  return { ok:true, text, resident:residentNow, actor, schedule, status:selected.status, item:selected.item, context, receipt };
}

export function interactDistrictResident(state, residentId) {
  if (state.location !== 'district') return { ok:false, text:'That conversation is happening on Lopsided Lane.' };
  const observation = districtResidentObservation(state,residentId);
  if (!observation.ok) return observation;
  state.relationships[residentId] = (state.relationships[residentId] || 0) + 1;
  observation.receipt.effect = { relationship:1 };
  state.district.encounters.unshift({
    id:`encounter-${state.district.sequence++}`,
    day:state.day,
    hour:state.hour,
    residentId,
    text:observation.text,
    receipt:observation.receipt
  });
  state.district.encounters = state.district.encounters.slice(0,80);
  state.district.lastReceipt = observation.receipt;
  state.stats.districtTalks += 1;
  addLedger(state,'district',observation.text,{ residentId, receipt:observation.receipt });
  advanceTime(state,1);
  return observation;
}

export function giftDistrictItem(state, residentId, itemId) {
  if (state.location !== 'district') return { ok:false, text:'The neighbor and the object need to meet on Lopsided Lane.' };
  const resident = DISTRICT_RESIDENTS.find(candidate => candidate.id === residentId);
  const actor = ACTORS[residentId];
  if (!resident || !actor) return { ok:false, text:'That gift has no authored recipient.' };
  const item = state.inventory.find(candidate => candidate.id === itemId);
  if (!item) return { ok:false, text:'Listed, installed, equipped, and already-gifted objects cannot be handed over.' };
  const itemRecord = districtItemSnapshot(item);
  const matchedTags = item.tags.filter(tag => resident.interests.includes(tag));
  const relationshipGain = 2 + matchedTags.length * 2 + Math.max(1,Math.round(item.power || 1));
  const homeGain = matchedTags.length ? 1 : 0;
  removeInventoryItem(state,item.id);
  state.relationships[resident.id] = (state.relationships[resident.id] || 0) + relationshipGain;
  state.home.score += homeGain;
  state.stats.itemsGifted += 1;
  state.stats.districtGifts += 1;
  const giftId = `district-gift-${state.district.sequence++}`;
  const parent = ['tavi','nibbin'].includes(resident.id) ? 'Mum' : 'Dad';
  const parentText = homeGain
    ? `${parent} pinned ${actor.name}'s thank-you pennant beside the kitchen light. The house now knows exactly where ${item.name} went.`
    : `${parent} wrote ${actor.name}'s thank-you note into the family ledger under "generous, baffling, valid."`;
  const receipt = {
    schema:'small-odds.district-gift/v1', random:false, giftId,
    day:state.day, hour:state.hour, residentId:resident.id, residentName:actor.name,
    item:itemRecord, residentInterests:[...resident.interests], matchedTags,
    relationshipGain, homeGain, itemRemovedFromInventory:true,
    listingEligible:false, moneyIgnored:true, portalOddsChanged:false
  };
  state.district.gifts.unshift({ id:giftId, day:state.day, residentId:resident.id, item:itemRecord, receipt });
  state.district.gifts = state.district.gifts.slice(0,60);
  state.district.houseMarks.unshift({ id:`house-${giftId}`, kind:'gift', day:state.day, residentId:resident.id, itemName:item.name, parentText, visual:'thank-you-pennant', receipt });
  state.district.houseMarks = state.district.houseMarks.slice(0,40);
  state.district.lastReceipt = receipt;
  const text = `${actor.name} accepted ${item.name}. Relationship +${relationshipGain}${homeGain ? '; the thank-you changed the house +1' : ''}.`;
  addLedger(state,'gift',text,{ residentId, itemId:item.id, receipt });
  addLedger(state,'home',parentText,{ residentId, houseMark:`house-${giftId}` });
  advanceTime(state,1);
  return { ok:true, text, receipt, item:itemRecord, parentText };
}

export function districtFamilyEcho(state) {
  const mark = state.district?.houseMarks?.[0] || null;
  return mark ? { active:true, ...mark } : {
    active:false,
    kind:'ordinary',
    parentText:'Mum and Dad can see Lopsided Lane from the kitchen, but the house has no new neighborhood evidence yet.'
  };
}

export function rarityFromRoll(oneBasedRoll) {
  if (!Number.isInteger(oneBasedRoll) || oneBasedRoll < 1 || oneBasedRoll > MILLION) {
    throw new RangeError('Rarity roll must be an integer from 1 through 1,000,000.');
  }
  let cursor = 0;
  for (const rarity of RARITIES) {
    cursor += rarity.weight;
    if (oneBasedRoll <= cursor) return rarity;
  }
  throw new Error('Rarity table is incomplete.');
}

export function ticketWonFromRoll(oneBasedRoll) {
  if (!Number.isInteger(oneBasedRoll) || oneBasedRoll < 1 || oneBasedRoll > MILLION) {
    throw new RangeError('Ticket roll must be an integer from 1 through 1,000,000.');
  }
  return oneBasedRoll === MILLION;
}

function catalogPick(rng, values) {
  const index = uniformInt(rng, values.length);
  return { value: values[index], index };
}

function componentRecord(picks) {
  return Object.fromEntries(Object.entries(picks).map(([key, pick]) => [key, pick.index]));
}

export function createItemFromSeed(seedHex, drawNumber = 1, options = {}) {
  const algorithm = options.algorithm || RNG_ALGORITHM;
  const rng = createRng(seedHex, algorithm);
  const ticketRoll = uniformInt(rng, MILLION) + 1;
  const rarityRoll = uniformInt(rng, MILLION) + 1;
  const rarity = rarityFromRoll(rarityRoll);
  const picks = {
    form: catalogPick(rng, ITEM_FORMS),
    core: catalogPick(rng, CORE_BEHAVIORS),
    trigger: catalogPick(rng, FUTURE_TRIGGERS),
    quirk: catalogPick(rng, QUIRKS),
    material: catalogPick(rng, MATERIALS),
    history: catalogPick(rng, HISTORIES),
    condition: catalogPick(rng, CONDITIONS)
  };
  const eligibleStyles = rarity.id === 'unknown' ? STYLE_FAMILIES.slice(-1) : STYLE_FAMILIES.slice(0, -1);
  picks.style = catalogPick(rng, eligibleStyles);
  const valueJitter = 90 + uniformInt(rng, 21);
  const { form, core, trigger, quirk, material, history, condition, style } = Object.fromEntries(
    Object.entries(picks).map(([key, pick]) => [key, pick.value])
  );
  const tags = unique([...form.tags, ...core.tags, ...quirk.tags, ...material.tags, ...history.tags]);
  const rawValue = form.baseValue + core.value + quirk.value + material.value + history.value;
  const baseValue = Math.max(1, Math.round(rawValue * condition.value * rarity.value * valueJitter / 100));
  const durability = Math.max(1, form.durability + condition.durability);
  const ticketWon = ticketWonFromRoll(ticketRoll);
  const id = `item-${String(drawNumber).padStart(5, '0')}-${seedHex.slice(0, 10)}`;
  return {
    id,
    name: `${quirk.prefix} ${material.adjective} ${form.name}`,
    subtitle: `${core.name} · ${form.category}`,
    description: `${core.line} ${trigger.line}`,
    provenance: `${history.label}; condition: ${condition.label}.`,
    drawback: `${quirk.line} ${condition.line}`,
    glyph: form.glyph,
    formId: form.id,
    category: form.category,
    coreId: core.id,
    triggerId: trigger.id,
    triggerName: trigger.name,
    triggerTags: [...trigger.tags],
    triggerBonus: trigger.bonus,
    tags,
    effect: { ...core.effect },
    rarity: rarity.id,
    rarityLabel: rarity.label,
    rarityColor: rarity.color,
    aura: rarity.aura,
    styleFamily: { id: style.id, name: style.name, palette: [...style.palette], shape: style.shape, note: style.note },
    baseValue,
    acquiredValue: baseValue,
    durability,
    maxDurability: durability,
    power: Number((rarity.power * (1 + core.value / 50)).toFixed(2)),
    installable: form.installable,
    hatchable: form.category === 'creature',
    reactionHistory: [],
    acquiredDay: null,
    receipt: probabilityReceipt(seedHex, {
      algorithm,
      drawNumber,
      rarityTableTotal: MILLION,
      rarityRoll,
      rarityResult: rarity.id,
      casinoTicketRoll: ticketRoll,
      casinoTicketTarget: MILLION,
      casinoTicketWon: ticketWon,
      componentIndices: componentRecord(picks),
      catalogVersion: GAME_VERSION,
      mechanicalCombinationCount: catalogCombinationCount() / STYLE_FAMILIES.length,
      styleFamilyCount: STYLE_FAMILIES.length
    })
  };
}

export function replayItemFromReceipt(receipt) {
  if (!receipt?.seedHex || !receipt?.algorithm || !receipt?.drawNumber) throw new TypeError('A complete item receipt is required.');
  return createItemFromSeed(receipt.seedHex, receipt.drawNumber, { algorithm: receipt.algorithm });
}

export function unlockPortal(state) {
  if (state.portal.unlocked) return { ok: false, text: 'The portal is already making the room nervous.' };
  state.portal.unlocked = true;
  state.portal.charges = 3;
  state.introStep = 1;
  if (!state.world.locations.includes('room')) state.world.locations.push('room');
  addLedger(state, 'portal', 'The machine-shell creature returned. The impossible device chose your moving box as its new nest.');
  return { ok: true, text: 'RANDOM ITEM PORTAL DEVICE acquired. Three honest charges are humming inside it.' };
}

export function drawItems(state, options = {}) {
  if (!state.portal.unlocked) return { ok: false, items: [], text: 'The creature still owns the portal. Perhaps reach for the escaping bill first.' };
  const parallel = state.portal.upgrades.includes('parallel-aperture') && options.parallel === true;
  const count = parallel ? 2 : 1;
  if (state.portal.charges < count) return { ok: false, items: [], text: `The portal needs ${count} charge${count === 1 ? '' : 's'}.` };
  const entropyFactory = options.entropyFactory || secureSeedHex;
  const items = [];
  for (let index = 0; index < count; index += 1) {
    const seed = entropyFactory();
    const drawNumber = state.portal.draws + 1;
    const item = createItemFromSeed(seed, drawNumber);
    item.acquiredDay = state.day;
    state.portal.draws += 1;
    state.portal.charges -= 1;
    state.portal.receipts.unshift(item.receipt);
    state.portal.receipts = state.portal.receipts.slice(0, 100);
    state.inventory.unshift(item);
    state.stats.itemsGenerated += 1;
    items.push(item);
    addLedger(state, 'draw', `${item.rarityLabel}: ${item.name} arrived from somewhere that may now want it back.`);
    if (item.receipt.casinoTicketWon && !state.world.casinoTicket) {
      state.world.casinoTicket = {
        foundAt: nowIso(),
        drawNumber,
        seedHex: seed,
        status: 'authentic-unredeemed'
      };
      state.starspite.access = 'invited';
      addLedger(state, 'unknown', 'ONE IN A MILLION. A Starspite Casino invitation slid from the aperture and said your full name.');
    }
  }
  state.portal.activations += 1;
  advanceTime(state, 1);
  state.updatedAt = nowIso();
  return { ok: true, items, text: items.length === 2 ? 'Two independent receipts. Same machine, unchanged odds.' : items[0].description };
}

export function marketQuote(item, state) {
  const event = currentWorldEvent(state);
  const multipliers = item.tags.map(tag => event.boosts[tag] || 1);
  const eventMultiplier = Math.max(1, ...multipliers);
  const reputationMultiplier = 1 + clamp(state.player.reputation, -20, 100) * 0.004;
  const petMultiplier = state.pets.some(pet => pet.traits.some(trait => trait.id === 'accountant')) ? 1.12 : 1;
  return Math.max(1, Math.round(item.baseValue * eventMultiplier * reputationMultiplier * petMultiplier));
}

function normalizedFactor(value) {
  return Number(Number(value).toFixed(4));
}

function businessType(businessId) {
  return BUSINESS_TYPES.find(type => type.id === businessId) || null;
}

function businessBranch(state) {
  return BUSINESS_BRANCHES.find(branch => branch.id === state.business?.branchId) || null;
}

export function businessTags(state) {
  if (!state.business) return [];
  return unique([...(state.business.tags || []), ...(businessBranch(state)?.addedTags || [])]);
}

function normalizeBusinessState(candidate, state) {
  const type = businessType(candidate.id) || {
    id:candidate.id || 'oddities', name:candidate.name || 'Inherited Bedroom Commerce',
    cost:Number(candidate.cost) || 0, tags:Array.isArray(candidate.tags) ? candidate.tags : [],
    baseIncome:Number(candidate.baseIncome) || 1, description:candidate.description || 'A migrated enterprise with stubborn paperwork.'
  };
  const business = {
    ...type,
    ...candidate,
    tags:Array.isArray(candidate.tags) ? candidate.tags : [...type.tags],
    rating:Math.max(1, Number(candidate.rating) || 1),
    assets:Array.isArray(candidate.assets) ? candidate.assets : [],
    listings:Array.isArray(candidate.listings) ? candidate.listings.filter(listing => listing?.item) : [],
    upgrades:Array.isArray(candidate.upgrades) ? unique(candidate.upgrades.filter(id => BUSINESS_UPGRADES.some(upgrade => upgrade.id === id))) : [],
    branchId:BUSINESS_BRANCHES.some(branch => branch.id === candidate.branchId && branch.businessId === type.id) ? candidate.branchId : null,
    assignedPetId:state.pets.some(pet => pet.id === candidate.assignedPetId) ? candidate.assignedPetId : null,
    callbacks:Array.isArray(candidate.callbacks) ? candidate.callbacks : [],
    history:Array.isArray(candidate.history) ? candidate.history : [],
    sequence:Math.max(1, Number(candidate.sequence) || 1),
    offersReceived:Math.max(0, Number(candidate.offersReceived) || 0),
    sales:Math.max(0, Number(candidate.sales) || 0),
    salesIncome:Math.max(0, Number(candidate.salesIncome) || 0),
    lifetimeIncome:Math.max(0, Number(candidate.lifetimeIncome) || 0),
    lastIncome:Math.max(0, Number(candidate.lastIncome) || 0),
    lastDailyReceipt:candidate.lastDailyReceipt || null,
    lastSaleReceipt:candidate.lastSaleReceipt || null
  };
  business.listings = business.listings.map((listing, index) => ({
    id:listing.id || `migrated-listing-${index + 1}`,
    item:listing.item,
    createdDay:Number(listing.createdDay) || state.day,
    refreshedDay:Number(listing.refreshedDay) || state.day,
    daysListed:Math.max(0, Number(listing.daysListed) || 0),
    counterCount:Math.max(0, Number(listing.counterCount) || 0),
    ask:Math.max(1, Number(listing.ask) || marketQuote(listing.item, state)),
    offer:Math.max(1, Number(listing.offer) || marketQuote(listing.item, state)),
    ceiling:Math.max(1, Number(listing.ceiling) || Number(listing.offer) || marketQuote(listing.item, state)),
    buyerId:listing.buyerId || BUSINESS_BUYERS[0].id,
    offerReceipt:listing.offerReceipt || null
  }));
  business.history = business.history.slice(0, 80);
  return business;
}

export function businessPetProfile(state) {
  const pet = state.business?.assignedPetId ? state.pets.find(candidate => candidate.id === state.business.assignedPetId) : null;
  let offerFactor = 1;
  let dailyFactor = 1;
  let listingSlots = 0;
  let callbackRating = 0;
  const reasons = [];
  if (!pet) return { pet:null, offerFactor:1, dailyFactor:1, listingSlots:0, callbackRating:0, reasons };
  if (pet.speciesId === 'receipt-eel') {
    dailyFactor *= 1.05;
    reasons.push('Receipt-Eel species: daily service ×1.05');
  }
  for (const trait of pet.traits || []) {
    if (trait.id === 'accountant') {
      offerFactor *= 1.12;
      dailyFactor *= 1.12;
      reasons.push('Instinctive Accountant: offers and service ×1.12');
    } else if (trait.id === 'pockets') {
      listingSlots += 1;
      reasons.push('Additional Pockets: listing slots +1');
    } else if (trait.id === 'helpful') {
      callbackRating += 1;
      reasons.push('Unreasonably Helpful: callback rating +1');
    } else if (trait.id === 'unknown') {
      offerFactor *= 1.15;
      reasons.push('[TRAIT STILL ARRIVING]: offers ×1.15');
    }
  }
  return { pet, offerFactor:normalizedFactor(offerFactor), dailyFactor:normalizedFactor(dailyFactor), listingSlots, callbackRating, reasons };
}

function workPressureBand(state) {
  const pressure = clamp(Math.round(Number(state.work?.pressure) || 0),0,12);
  return NEIGHBORHOOD_WORKS.pressureBands.find(band =>
    (band.minimum == null || pressure >= band.minimum) && (band.maximum == null || pressure <= band.maximum)
  ) || NEIGHBORHOOD_WORKS.pressureBands[0];
}

function neighborhoodWorkOrderById(orderId) {
  return NEIGHBORHOOD_WORKS.orders.find(candidate => candidate.id === orderId)
    || (NEIGHBORHOOD_COMMONS.maintenance.workOrder.id === orderId ? NEIGHBORHOOD_COMMONS.maintenance.workOrder : null);
}

function maintenanceWorkOrderActive(state) {
  return commonsMaintenanceProfile(state).conflictOrderActive;
}

export function availableWorkOrder(state) {
  const maintenance = commonsMaintenanceProfile(state);
  if (maintenance.conflictOrderActive) return NEIGHBORHOOD_COMMONS.maintenance.workOrder;
  const index = ((Math.max(1,Number(state.day) || 1) - 1) % NEIGHBORHOOD_WORKS.orders.length + NEIGHBORHOOD_WORKS.orders.length) % NEIGHBORHOOD_WORKS.orders.length;
  return NEIGHBORHOOD_WORKS.orders[index];
}

export function neighborhoodWorkProfile(state) {
  const band = workPressureBand(state);
  return {
    id:NEIGHBORHOOD_WORKS.id,
    name:NEIGHBORHOOD_WORKS.name,
    household:NEIGHBORHOOD_WORKS.household,
    description:NEIGHBORHOOD_WORKS.description,
    glyph:NEIGHBORHOOD_WORKS.glyph,
    standing:clamp(Math.round(Number(state.work?.standing) || 0),-8,12),
    pressure:clamp(Math.round(Number(state.work?.pressure) || 0),0,12),
    pressureState:band.id,
    pressureLabel:band.label,
    pressureColor:band.color,
    pressureSummary:band.summary,
    pressureWageFactor:band.wageFactor,
    completed:Math.max(0,Math.round(Number(state.work?.completed) || 0)),
    active:state.work?.active || null,
    currentOrder:availableWorkOrder(state),
    rotationRule:maintenanceWorkOrderActive(state) ? 'Hushglass due-day override; otherwise (day - 1) modulo 3 base orders' : '(day - 1) modulo 3 base orders; Hushglass due state can publish one declared override',
    random:false
  };
}

export function workPetProfile(state, orderId = availableWorkOrder(state).id) {
  const order = neighborhoodWorkOrderById(orderId) || availableWorkOrder(state);
  const pet = state.business?.assignedPetId ? state.pets.find(candidate => candidate.id === state.business.assignedPetId) : null;
  if (!pet) return { pet:null, orderId:order.id, laborPoints:0, speciesMatches:[], traitMatches:[], reasons:[] };
  const species = PET_SPECIES.find(candidate => candidate.id === pet.speciesId) || null;
  const speciesMatches = (species?.tags || []).filter(tag => order.skillTags.includes(tag));
  const traitMatches = (pet.traits || []).filter(trait => order.skillTags.includes(trait.tag)).map(trait => ({ id:trait.id, name:trait.name, tag:trait.tag, points:2 }));
  const laborPoints = speciesMatches.length + traitMatches.reduce((sum,match) => sum + match.points,0);
  const reasons = [
    ...speciesMatches.map(tag => `${species.name} species tag ${tag}: +1 labor point`),
    ...traitMatches.map(match => `${match.name} trait tag ${match.tag}: +${match.points} labor points`)
  ];
  return { pet, species, orderId:order.id, laborPoints, speciesMatches, traitMatches, reasons };
}

export function matchingWorkTools(state, orderId = availableWorkOrder(state).id) {
  const order = neighborhoodWorkOrderById(orderId) || availableWorkOrder(state);
  return state.inventory.filter(item => intersects(item.tags,order.requiredTags));
}

export function workOrderQuote(state, orderId, itemId, approachId) {
  if (!state.business) return { ok:false, text:'Open a bedroom business before accepting neighborhood production work.' };
  const order = neighborhoodWorkOrderById(orderId);
  const current = availableWorkOrder(state);
  if (!order || order.id !== current.id) return { ok:false, text:`Today\'s public board carries ${current.title}, not that order.` };
  const approach = NEIGHBORHOOD_WORKS.approaches.find(candidate => candidate.id === approachId);
  if (!approach) return { ok:false, text:'Choose one of the two published work approaches.' };
  const tool = matchingWorkTools(state,order.id).find(candidate => candidate.id === itemId) || null;
  if (!tool) return { ok:false, text:'Choose a carried object whose real tags fit this work order.' };
  const petProfile = workPetProfile(state,order.id);
  if (!petProfile.pet) return { ok:false, text:'Assign one pet to the storefront shift before accepting paid production work.' };
  const supplier = districtSupplierProfile(state);
  const work = neighborhoodWorkProfile(state);
  const toolMatches = tool.tags.filter(tag => order.requiredTags.includes(tag));
  const toolContribution = Math.min(3,toolMatches.length) * 4;
  const petContribution = petProfile.laborPoints * 5;
  const ratingContribution = Math.min(12,Math.max(0,Math.round(Number(state.business.rating) || 0)));
  const subtotal = order.basePay + toolContribution + petContribution + ratingContribution;
  const wage = Math.max(1,Math.round(subtotal * supplier.businessFactor * work.pressureWageFactor * approach.wageFactor));
  return {
    ok:true, order, approach, tool, petProfile, supplier, work,
    toolMatches, toolContribution, petContribution, ratingContribution, subtotal, wage,
    factors:{ supplier:supplier.businessFactor, competitorPressure:work.pressureWageFactor, approach:approach.wageFactor },
    formula:'round((base pay + matching tool tags capped at 3 x 4 + literal pet labor points x 5 + business rating capped at 12) x supplier x competitor pressure x approach)',
    random:false
  };
}

function workHistoryEntry(state, entry) {
  state.work.history.unshift({ at:nowIso(), day:state.day, hour:state.hour, ...entry });
  state.work.history = state.work.history.slice(0,80);
}

export function startWorkOrder(state, orderId, itemId, approachId) {
  if (state.work.active) return { ok:false, text:`${state.work.active.title} is already in production until Day ${state.work.active.dueDay}.` };
  const quote = workOrderQuote(state,orderId,itemId,approachId);
  if (!quote.ok) return quote;
  if (state.player.energy < quote.approach.energyCost) return { ok:false, text:`This shift needs ${quote.approach.energyCost} energy. Pip has ${state.player.energy}.` };
  const startedDay = state.day;
  const startedHour = state.hour;
  const dueDay = startedDay + quote.order.dueDays;
  const commonsAuthored = quote.order.commonsConflict ? quote.order.maintenanceByApproach[quote.approach.id] : null;
  const commonsPromise = commonsAuthored ? composedCommonsServiceEffect(state,{
    integrityDelta:commonsAuthored.integrityDelta,
    warmthDelta:commonsAuthored.warmthDelta,
    trustDelta:commonsAuthored.trustDelta,
    agreementsDelta:0,
    supplierStandingDelta:0,
    workStandingDelta:0,
    workPressureDelta:0,
    businessRatingGain:0,
    homeGain:0,
    residentId:'sumi',
    residentRelationshipGain:commonsAuthored.sumiRelationshipGain,
    petAffectionGain:0,
    houseMark:commonsAuthored.houseMark
  }) : null;
  const toolBefore = quote.tool.durability;
  quote.tool.durability -= quote.order.toolDurability;
  const toolBroke = quote.tool.durability <= 0;
  if (toolBroke) removeInventoryItem(state,quote.tool.id);
  state.player.energy = clamp(state.player.energy - quote.approach.energyCost,0,state.player.maxEnergy);
  const receipt = {
    schema:'small-odds.work-order-start/v1', random:false,
    workId:`work-${state.work.sequence}`, employerId:NEIGHBORHOOD_WORKS.id, employerName:NEIGHBORHOOD_WORKS.name,
    orderId:quote.order.id, title:quote.order.title, requester:quote.order.requester, residentId:quote.order.residentId,
    approachId:quote.approach.id, approachLabel:quote.approach.label,
    startedDay, startedHour, dueDay, hours:quote.approach.hours, energyCost:quote.approach.energyCost,
    tool:{ id:quote.tool.id, name:quote.tool.name, matchedTags:quote.toolMatches, durabilityBefore:toolBefore, durabilityCost:quote.order.toolDurability, durabilityAfter:Math.max(0,quote.tool.durability), broke:toolBroke },
    pet:{ id:quote.petProfile.pet.id, name:quote.petProfile.pet.name, speciesId:quote.petProfile.pet.speciesId, speciesMatches:quote.petProfile.speciesMatches, traitMatches:quote.petProfile.traitMatches, laborPoints:quote.petProfile.laborPoints, reasons:quote.petProfile.reasons },
    arithmetic:{ basePay:quote.order.basePay, toolContribution:quote.toolContribution, petContribution:quote.petContribution, ratingContribution:quote.ratingContribution, subtotal:quote.subtotal, factors:quote.factors, wage:quote.wage, formula:quote.formula },
    calendar:{ rule:quote.work.rotationRule, hushglassOverride:Boolean(quote.order.commonsConflict), maintenanceDueDay:quote.order.commonsConflict ? quote.work.currentOrder.id === quote.order.id ? commonsMaintenanceProfile(state).nextDueDay : null : null },
    commonsServicePromise:commonsPromise ? { promisedReturn:cloneState(commonsPromise.effect), effectBreakdown:cloneState(commonsPromise.breakdown), governance:commonsMaintenanceProfile(state).governance.model ? { modelId:commonsMaintenanceProfile(state).governance.model.id, modelLabel:commonsMaintenanceProfile(state).governance.model.label } : null, fault:commonsMaintenanceProfile(state).fault ? { id:commonsMaintenanceProfile(state).fault.id, definitionId:commonsMaintenanceProfile(state).fault.definitionId, label:commonsMaintenanceProfile(state).fault.label, causeEvidence:cloneState(commonsMaintenanceProfile(state).fault.causeEvidence) } : null } : null,
    consequences:{ standingDelta:quote.approach.standingDelta, pressureDelta:quote.approach.pressureDelta, supplierStandingDelta:quote.approach.supplierStandingDelta, businessRatingGain:quote.approach.businessRatingGain, residentRelationshipGain:quote.approach.residentRelationshipGain, homeGain:quote.approach.homeGain },
    ignoredInputs:['portal draws','item rarity beyond the selected tool tags','casino history','cash on hand','failed offers','session length'],
    portalOddsChanged:false
  };
  state.work.active = {
    id:receipt.workId, orderId:quote.order.id, approachId:quote.approach.id, title:quote.order.title,
    requester:quote.order.requester, residentId:quote.order.residentId, startedDay, startedHour, dueDay,
    wage:quote.wage, tool:receipt.tool, pet:receipt.pet, consequences:{ ...receipt.consequences },
    commonsMaintenanceEffect:commonsPromise ? cloneState(commonsPromise.effect) : null,
    commonsEffectBreakdown:commonsPromise ? cloneState(commonsPromise.breakdown) : null,
    commonsGovernance:receipt.commonsServicePromise?.governance || null,
    commonsFault:receipt.commonsServicePromise?.fault || null,
    startReceipt:receipt, status:'in-production'
  };
  if (quote.order.commonsConflict) {
    const maintenance = state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance;
    maintenance.active = {
      id:`maintenance-work-${receipt.workId}`,
      routeId:'long-table-contract',
      label:`LONG TABLE CONTRACT · ${quote.approach.label}`,
      startedDay,
      startedHour,
      dueDay,
      workId:receipt.workId,
      approachId:quote.approach.id,
      returnEffect:commonsPromise ? cloneState(commonsPromise.effect) : null,
      effectBreakdown:commonsPromise ? cloneState(commonsPromise.breakdown) : null,
      governance:receipt.commonsServicePromise?.governance || null,
      fault:receipt.commonsServicePromise?.fault || null,
      startReceipt:receipt,
      status:'in-service'
    };
    state.stats.commonsWorkConflicts += 1;
  }
  state.work.sequence += 1;
  state.work.lastReceipt = receipt;
  state.stats.workOrdersStarted += 1;
  const text = `${quote.order.title} entered production for ${quote.wage} credits, due Day ${dueDay}. ${quote.petProfile.pet.name} contributes ${quote.petProfile.laborPoints} literal labor points.`;
  workHistoryEntry(state,{ kind:'start', workId:receipt.workId, orderId:quote.order.id, text, receipt, random:false });
  recordBusinessHistory(state,'work-start',text,receipt);
  addLedger(state,'work',text,{ receipt });
  const timeResult = advanceTime(state,quote.approach.hours);
  state.updatedAt = nowIso();
  return { ok:true, text, receipt, active:state.work.active, timeResult };
}

export function resolveWorkReturns(state) {
  const active = state.work?.active;
  if (!active || active.dueDay > state.day) return [];
  const order = neighborhoodWorkOrderById(active.orderId);
  const approach = NEIGHBORHOOD_WORKS.approaches.find(candidate => candidate.id === active.approachId);
  if (!order || !approach) { state.work.active = null; return []; }
  const before = {
    money:state.money, standing:state.work.standing, pressure:state.work.pressure,
    supplierStanding:districtSupplierProfile(state).standing, businessRating:state.business?.rating || 0,
    relationship:Number(state.relationships[active.residentId]) || 0, home:state.home.score
  };
  state.money += active.wage;
  state.world.totalEarned += active.wage;
  state.work.standing = clamp(before.standing + approach.standingDelta,-8,12);
  state.work.pressure = clamp(before.pressure + approach.pressureDelta,0,12);
  state.district.supplier.standing = clamp(before.supplierStanding + approach.supplierStandingDelta,-12,12);
  if (state.business) state.business.rating += approach.businessRatingGain;
  state.relationships[active.residentId] = before.relationship + approach.residentRelationshipGain;
  state.home.score += approach.homeGain;
  const pet = state.pets.find(candidate => candidate.id === active.pet.id) || null;
  if (pet) { pet.affection = Math.max(0,Number(pet.affection || 0) + 1); pet.mood = 'proudly named on the invoice'; }
  let afterSupplier = districtSupplierProfile(state);
  let afterWork = neighborhoodWorkProfile(state);
  let commonsMaintenance = null;
  if (order.commonsConflict) {
    const maintenance = state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance;
    const authored = order.maintenanceByApproach[approach.id];
    const fallbackPromise = composedCommonsServiceEffect(state,{
      integrityDelta:authored.integrityDelta, warmthDelta:authored.warmthDelta, trustDelta:authored.trustDelta,
      agreementsDelta:0, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:0,
      businessRatingGain:0, homeGain:0, residentId:'sumi', residentRelationshipGain:authored.sumiRelationshipGain,
      petAffectionGain:0, houseMark:authored.houseMark
    });
    const effect = active.commonsMaintenanceEffect || fallbackPromise.effect;
    const integrityBefore = clamp(Math.round(Number(maintenance.integrity) || 0),0,8);
    const cycleBefore = Math.max(0,Math.round(Number(maintenance.cycles) || 0));
    const civicWorkBefore = neighborhoodWorkProfile(state);
    const civicBusinessBefore = state.business ? Math.round(Number(state.business.rating) || 0) : null;
    const civicHomeBefore = Math.max(0,Math.round(Number(state.home.score) || 0));
    const residentBefore = Math.round(Number(state.relationships[effect.residentId]) || 0);
    const householdRoute = applyHouseholdStateEffect(state,effect);
    state.work.standing = clamp(civicWorkBefore.standing + Math.round(Number(effect.workStandingDelta) || 0),-8,12);
    state.work.pressure = clamp(civicWorkBefore.pressure + Math.round(Number(effect.workPressureDelta) || 0),0,12);
    if (state.business) state.business.rating = Math.max(1,civicBusinessBefore + Math.round(Number(effect.businessRatingGain) || 0));
    state.home.score = Math.max(0,civicHomeBefore + Math.round(Number(effect.homeGain) || 0));
    state.relationships[effect.residentId] = residentBefore + Math.round(Number(effect.residentRelationshipGain) || 0);
    maintenance.integrity = clamp(integrityBefore + Math.round(Number(effect.integrityDelta) || 0),0,8);
    maintenance.cycles = cycleBefore + 1;
    maintenance.nextDueDay = state.day + NEIGHBORHOOD_COMMONS.maintenance.intervalDays;
    maintenance.active = null;
    const faultResolution = finalizeCommonsMaintenanceFault(state,'long-table-contract','small-odds.work-order-return/v1');
    const civicWorkAfter = neighborhoodWorkProfile(state);
    const civicBusinessAfter = state.business ? Math.round(Number(state.business.rating) || 0) : null;
    const integrityAfterBand = maintenanceBandForIntegrity(maintenance.integrity);
    commonsMaintenance = {
      routeId:'long-table-contract',
      approachId:approach.id,
      dueDay:active.dueDay,
      resolvedDay:state.day,
      householdRoute,
      integrity:{ before:integrityBefore, requestedDelta:Math.round(Number(effect.integrityDelta) || 0), delta:maintenance.integrity - integrityBefore, after:maintenance.integrity, stateAfter:integrityAfterBand.id, labelAfter:integrityAfterBand.label },
      cycles:{ before:cycleBefore, delta:1, after:maintenance.cycles },
      nextDueDay:maintenance.nextDueDay,
      governance:active.commonsGovernance || null,
      fault:active.commonsFault || null,
      faultResolution,
      effectBreakdown:active.commonsEffectBreakdown || fallbackPromise.breakdown,
      applied:{
        supplier:householdRoute.supplier,
        workStanding:{ before:civicWorkBefore.standing, requestedDelta:Math.round(Number(effect.workStandingDelta) || 0), delta:civicWorkAfter.standing - civicWorkBefore.standing, after:civicWorkAfter.standing },
        workPressure:{ before:civicWorkBefore.pressure, requestedDelta:Math.round(Number(effect.workPressureDelta) || 0), delta:civicWorkAfter.pressure - civicWorkBefore.pressure, after:civicWorkAfter.pressure, stateAfter:civicWorkAfter.pressureState },
        businessRating:{ before:civicBusinessBefore, requestedDelta:Math.round(Number(effect.businessRatingGain) || 0), delta:civicBusinessBefore == null ? 0 : civicBusinessAfter - civicBusinessBefore, after:civicBusinessAfter },
        home:{ before:civicHomeBefore, requestedDelta:Math.round(Number(effect.homeGain) || 0), delta:state.home.score - civicHomeBefore, after:state.home.score },
        residentRelationship:{ residentId:effect.residentId, residentName:ACTORS[effect.residentId]?.name || effect.residentId, before:residentBefore, requestedDelta:Math.round(Number(effect.residentRelationshipGain) || 0), delta:state.relationships[effect.residentId] - residentBefore, after:state.relationships[effect.residentId] }
      },
      sumiRelationship:effect.residentId === 'sumi' ? { before:residentBefore, requestedDelta:Math.round(Number(effect.residentRelationshipGain) || 0), delta:state.relationships.sumi - residentBefore, after:state.relationships.sumi } : null,
      scheduleStateAfter:null,
      houseMark:effect.houseMark,
      random:false,
      portalOddsChanged:false
    };
    afterSupplier = districtSupplierProfile(state);
    afterWork = neighborhoodWorkProfile(state);
  }
  const receipt = {
    schema:'small-odds.work-order-return/v1', random:false,
    workId:active.id, orderId:active.orderId, title:active.title, requester:active.requester, residentId:active.residentId,
    approachId:active.approachId, startedDay:active.startedDay, dueDay:active.dueDay, resolvedDay:state.day,
    wage:active.wage, tool:active.tool, pet:{ ...active.pet, affectionGain:pet ? 1 : 0, moodAfter:pet?.mood || null },
    applied:{
      money:{ before:before.money, delta:active.wage, after:state.money },
      standing:{ before:before.standing, delta:state.work.standing - before.standing, after:state.work.standing },
      pressure:{ before:before.pressure, delta:state.work.pressure - before.pressure, after:state.work.pressure, state:afterWork.pressureState, wageFactor:afterWork.pressureWageFactor },
      supplier:{ before:before.supplierStanding, delta:afterSupplier.standing - before.supplierStanding, after:afterSupplier.standing, state:afterSupplier.state, businessFactor:afterSupplier.businessFactor },
      businessRating:{ before:before.businessRating, delta:(state.business?.rating || 0) - before.businessRating, after:state.business?.rating || 0 },
      residentRelationship:{ before:before.relationship, delta:state.relationships[active.residentId] - before.relationship, after:state.relationships[active.residentId] },
      home:{ before:before.home, delta:state.home.score - before.home, after:state.home.score }
    },
    commonsMaintenance,
    houseMark:commonsMaintenance?.houseMark || 'workbench-stamp', portalOddsChanged:false
  };
  const parentText = order.commonsConflict
    ? approach.id === 'share-the-shift'
      ? `Dad stamped the shared Hushglass valve contract into the family workbench: Long Table labor, Crooked Kettle stock, and Sumi's ownership note occupy the same plate.`
      : `Mum pinned the exclusive Hushglass bid beside the heat mobile so the house remembers that a working valve can still leave trust colder.`
    : approach.id === 'share-the-shift'
    ? `Dad stamped ${order.title.toLowerCase()} into the family workbench: ${active.pet.name} is listed as paid creature labor.`
    : `Mum filed the rush invoice beside the kettle crate so the house remembers what speed cost the street.`;
  state.district.houseMarks.unshift({ id:`house-${active.id}`, kind:order.commonsConflict ? 'maintenance' : 'work', day:state.day, residentId:active.residentId, parentText, visual:receipt.houseMark, receipt });
  state.district.houseMarks = state.district.houseMarks.slice(0,40);
  state.work.active = null;
  state.work.completed += 1;
  state.work.lastReceipt = receipt;
  state.stats.workOrdersCompleted += 1;
  if (commonsMaintenance) {
    const household = state.district.households[NEIGHBORHOOD_COMMONS.id];
    household.lastReceipt = receipt;
    maintenanceHistoryEntry(state,{ kind:'return', routeId:'long-table-contract', text:order.returnText, receipt, random:false });
    householdHistoryEntry(state,{ kind:'maintenance-return', routeId:'long-table-contract', text:order.returnText, receipt, random:false });
    state.district.lastReceipt = receipt;
    state.stats.commonsMaintenanceReturns += 1;
  }
  const text = `${order.returnText} ${active.wage} credits were paid; ${afterWork.pressureLabel.toLowerCase()} now describes the rivalry.${commonsMaintenance ? ` Hushglass integrity moved ${commonsMaintenance.integrity.before} -> ${commonsMaintenance.integrity.after}; the next public service day is Day ${commonsMaintenance.nextDueDay}.` : ''}`;
  workHistoryEntry(state,{ kind:'return', workId:active.id, orderId:active.orderId, text, receipt, random:false });
  recordBusinessHistory(state,'work-return',text,receipt);
  addLedger(state,'work-return',text,{ receipt });
  return [{ ...active, text, receipt }];
}

export function businessListingCapacity(state) {
  if (!state.business) return 0;
  return 2
    + (state.business.upgrades.includes('listing-nest') ? 1 : 0)
    + (state.business.upgrades.includes('portal-fulfilment') ? 2 : 0)
    + businessPetProfile(state).listingSlots;
}

function routedBusinessBuyer(state, item, ordinal) {
  const eligible = BUSINESS_BUYERS.filter(buyer => buyer.id !== 'vesper-office' || state.starspite.access === 'member');
  const scored = eligible.map((buyer, index) => {
    const favoriteMatches = item.tags.filter(tag => buyer.favoriteTags.includes(tag));
    const avoidMatches = item.tags.filter(tag => buyer.avoidTags.includes(tag));
    const relationship = Number(state.relationships[buyer.relationKey]) || 0;
    const rotation = eligible.length - ((state.day + ordinal + index) % eligible.length);
    const score = favoriteMatches.length * 100 - avoidMatches.length * 60 + relationship * 2 + rotation;
    return { buyer, index, favoriteMatches, avoidMatches, relationship, rotation, score };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  return scored[0];
}

export function businessOfferQuote(state, item, options = {}) {
  if (!state.business) throw new Error('A storefront is required before routing a buyer.');
  const ordinal = Math.max(1, Number(options.ordinal) || state.business.sequence || 1);
  const route = routedBusinessBuyer(state, item, ordinal);
  const buyer = route.buyer;
  const event = currentWorldEvent(state);
  const branch = businessBranch(state);
  const petProfile = businessPetProfile(state);
  const conditionRatio = clamp(item.durability / Math.max(1, item.maxDurability), 0, 1);
  const conditionFactor = normalizedFactor(.6 + conditionRatio * .4);
  const typeMatches = item.tags.filter(tag => businessTags(state).includes(tag));
  const typeFactor = normalizedFactor(1 + Math.min(.24, typeMatches.length * .08));
  const buyerFactor = normalizedFactor(clamp(1 + route.favoriteMatches.length * .12 - route.avoidMatches.length * .08, .72, 1.36));
  const eventFactor = normalizedFactor(Math.max(1, ...item.tags.map(tag => event.boosts[tag] || 1)));
  const reputationFactor = normalizedFactor(clamp(1 + state.player.reputation * .01, .8, 1.25));
  const relationshipFactor = normalizedFactor(clamp(1 + route.relationship * .005, .85, 1.2));
  const equipmentMatches = state.business.assets.filter(asset => intersects(asset.tags, item.tags)).length;
  const equipmentFactor = normalizedFactor(1 + Math.min(.2, equipmentMatches * .04));
  const branchFactor = normalizedFactor(branch?.offerMultiplier || 1);
  const upgradeFactor = state.business.upgrades.includes('translation-seal') ? 1.08 : 1;
  let traitContextFactor = 1;
  const traitContextReasons = [];
  if (petProfile.pet?.traits.some(trait => trait.id === 'sniffer') && intersects(item.tags,['legal','debt'])) {
    traitContextFactor *= 1.08;
    traitContextReasons.push('Tax-Scented + legal/debt: ×1.08');
  }
  if (petProfile.pet?.traits.some(trait => trait.id === 'weatherproof') && item.tags.includes('weather')) {
    traitContextFactor *= 1.05;
    traitContextReasons.push('Weatherproof item handling: ×1.05');
  }
  traitContextFactor = normalizedFactor(traitContextFactor);
  const factors = {
    condition:conditionFactor,
    storefrontMatch:typeFactor,
    buyerAffinity:buyerFactor,
    worldEvent:eventFactor,
    reputation:reputationFactor,
    buyerRelationship:relationshipFactor,
    equipment:equipmentFactor,
    branch:branchFactor,
    trustSeal:upgradeFactor,
    petTraits:petProfile.offerFactor,
    petContext:traitContextFactor
  };
  const rawOffer = Object.values(factors).reduce((value, factor) => value * factor, item.baseValue);
  const offer = Math.max(1, Math.round(rawOffer));
  const defaultAsk = Math.max(1, Math.round(marketQuote(item, state) * 1.25));
  const ask = Math.max(1, Number(options.ask) || defaultAsk);
  const ceilingFactor = normalizedFactor(1 + buyer.patience * .035 + (state.business.upgrades.includes('translation-seal') ? .04 : 0));
  const ceiling = Math.max(offer, Math.round(offer * ceilingFactor));
  const receipt = {
    schema:'small-odds.storefront-offer/v1', random:false, generatedDay:state.day,
    itemId:item.id, itemName:item.name, itemBaseValue:item.baseValue,
    itemCondition:{ durability:item.durability, maximum:item.maxDurability, ratio:normalizedFactor(conditionRatio) },
    businessId:state.business.id, branchId:branch?.id || null,
    buyerId:buyer.id, buyerName:buyer.name,
    buyerRouting:{ mode:'deterministic-authored-score', favoriteMatches:route.favoriteMatches, avoidMatches:route.avoidMatches, relationshipKey:buyer.relationKey, relationshipValue:route.relationship, rotationTieBreak:route.rotation, score:route.score },
    storefrontTagMatches:typeMatches, equipmentMatches, eventId:event.id, factors,
    petReasons:[...petProfile.reasons, ...traitContextReasons], rawOffer:normalizedFactor(rawOffer), offer,
    postedAsk:ask, patience:buyer.patience, ceilingFactor, deterministicCeiling:ceiling,
    formula:'round(itemBaseValue × condition × storefrontMatch × buyerAffinity × worldEvent × reputation × buyerRelationship × equipment × branch × trustSeal × petTraits × petContext)',
    moneyIgnored:true, portalOddsChanged:false
  };
  return { buyer, offer, ask, ceiling, receipt };
}

export function casinoGameMath(gameId) {
  const game = CASINO_GAMES.find(candidate => candidate.id === gameId);
  if (!game) throw new RangeError('Unknown Starspite game.');
  const winningOutcomes = game.winNumbers.length;
  const rtp = winningOutcomes * game.payoutMultiplier / game.outcomes;
  return {
    gameId: game.id,
    outcomes: game.outcomes,
    winNumbers: [...game.winNumbers],
    winningOutcomes,
    payoutMultiplier: game.payoutMultiplier,
    winProbabilityNumerator: winningOutcomes,
    winProbabilityDenominator: game.outcomes,
    rtpPercent: Number((rtp * 100).toFixed(3)),
    houseEdgePercent: Number(((1 - rtp) * 100).toFixed(3))
  };
}

export function casinoInsuranceQuote(item, stake) {
  if (!item || !Number.isSafeInteger(stake) || stake < 1) return 0;
  return Math.max(0, Math.min(stake - 1, Math.max(1, Math.round(item.power * 2))));
}

export function setCasinoInsurance(state, itemId = null) {
  if (state.starspite.access !== 'member') return { ok:false, text:'Only invited Starspite guests may lodge item insurance.' };
  if (itemId == null) {
    state.starspite.insuredItemId = null;
    return { ok:true, text:'No item is pledged. Losses will be beautifully unsoftened.' };
  }
  const item = state.inventory.find(candidate => candidate.id === itemId);
  if (!item) return { ok:false, text:'That item is not available to insure a wager.' };
  state.starspite.insuredItemId = item.id;
  const text = `${item.name} is pledged as disclosed loss insurance. It cannot alter a roll and loses one durability only when a refund is paid.`;
  addLedger(state, 'casino', text, { itemId:item.id });
  return { ok:true, text };
}

export function redeemCasinoTicket(state) {
  const ticket = state.world.casinoTicket;
  if (!ticket || ticket.status !== 'authentic-unredeemed') return { ok:false, text:'No authentic unredeemed Starspite invitation is present.' };
  ticket.status = 'redeemed';
  ticket.redeemedAt = nowIso();
  state.starspite.access = 'member';
  if (!state.world.locations.includes('starspite')) state.world.locations.push('starspite');
  state.location = 'starspite';
  state.focus = 1;
  state.relationships.vesper ||= 0;
  advanceTime(state, 4);
  const text = 'The one-in-a-million invitation folded the room into a boarding corridor. Starspite now recognizes Pip as statistically inconvenient.';
  addLedger(state, 'unknown', text, { drawNumber:ticket.drawNumber, seedHex:ticket.seedHex });
  return { ok:true, text };
}

export function playCasinoGame(state, gameId, stake, options = {}) {
  const game = CASINO_GAMES.find(candidate => candidate.id === gameId);
  if (!game) return { ok:false, text:'That table left the ship.' };
  if (state.starspite.access !== 'member' || state.location !== 'starspite') return { ok:false, text:'The wager must happen aboard Starspite.' };
  const parsedStake = Number(stake);
  if (!Number.isSafeInteger(parsedStake) || !game.stakes.includes(parsedStake)) return { ok:false, text:'Choose one of the table\'s posted stakes.' };
  if (state.money < parsedStake) return { ok:false, text:`The table requires ${parsedStake} credits. It will not accept optimism.` };

  const seedHex = (options.entropyFactory || secureSeedHex)();
  const rng = createRng(seedHex);
  const roll = uniformInt(rng, game.outcomes) + 1;
  const won = game.winNumbers.includes(roll);
  const grossReturn = won ? parsedStake * game.payoutMultiplier : 0;
  const insuredItem = state.inventory.find(item => item.id === state.starspite.insuredItemId) || null;
  let insuranceRefund = 0;
  let insuranceItemExpired = false;

  state.money -= parsedStake;
  state.world.totalLost += parsedStake;
  if (grossReturn) {
    state.money += grossReturn;
    state.world.totalEarned += grossReturn;
  } else if (insuredItem) {
    insuranceRefund = casinoInsuranceQuote(insuredItem, parsedStake);
    state.money += insuranceRefund;
    state.world.totalEarned += insuranceRefund;
    insuredItem.durability -= 1;
    if (insuredItem.durability <= 0) {
      removeInventoryItem(state, insuredItem.id);
      state.starspite.insuredItemId = null;
      insuranceItemExpired = true;
    }
  }

  const net = grossReturn + insuranceRefund - parsedStake;
  const math = casinoGameMath(game.id);
  const receipt = probabilityReceipt(seedHex, {
    schema:'small-odds.casino-play/v1',
    drawType:'casino-table',
    gameId:game.id,
    gameName:game.name,
    outcomeCount:game.outcomes,
    winningOutcomes:[...game.winNumbers],
    rawOutcomeRoll:roll,
    won,
    stake:parsedStake,
    grossPayoutMultiplier:game.payoutMultiplier,
    grossReturn,
    insuranceItemId:insuredItem?.id || null,
    insuranceRefund,
    insuranceChangesOutcome:false,
    net,
    rtpPercent:math.rtpPercent,
    houseEdgePercent:math.houseEdgePercent
  });

  state.starspite.gamesPlayed += 1;
  state.starspite[won ? 'wins' : 'losses'] += 1;
  state.starspite.netCredits += net;
  state.starspite.lastReceipt = receipt;
  state.starspite.history.unshift(receipt);
  state.starspite.history = state.starspite.history.slice(0, 50);
  state.stats.casinoPlays += 1;
  const outcome = `${game.outcomeLabel} ${roll}`;
  const insuranceText = insuranceRefund ? ` ${insuredItem.name} refunded ${insuranceRefund} credits and lost one durability${insuranceItemExpired ? ' before dissolving' : ''}.` : '';
  let text = won
    ? `${game.name} chose ${outcome}. The posted win returned ${grossReturn} credits; net ${net >= 0 ? '+' : ''}${net}.`
    : `${game.name} chose ${outcome}. The ${parsedStake}-credit stake was lost.${insuranceText}`;
  const reactions = resolveContextReactions(state, ['casino','risk','truth',won ? 'reputation' : 'debt'], `Starspite ${game.name} ${won ? 'win' : 'loss'}`);
  if (reactions.length) text += ` ${reactions.length} item${reactions.length === 1 ? '' : 's'} reacted after the outcome was fixed.`;
  addLedger(state, 'casino', text, { gameId:game.id, receipt });
  advanceTime(state, 1);
  return { ok:true, text, won, net, grossReturn, insuranceRefund, receipt, reactions };
}

function authoredCasinoItem(lot, state) {
  const powerByRarity = { rare:1.8, exotic:2.7, legendary:4.5 };
  return {
    id:`starspite-lot-${lot.id}`,
    name:lot.name,
    subtitle:lot.subtitle,
    description:lot.description,
    provenance:lot.provenance,
    drawback:lot.drawback,
    glyph:lot.glyph,
    formId:lot.id,
    category:'authored-artifact',
    coreId:'authored-starspite-function',
    triggerId:`authored-${lot.id}`,
    triggerName:lot.triggerName,
    triggerTags:[...lot.triggerTags],
    triggerBonus:lot.triggerBonus,
    tags:[...lot.tags],
    effect:{ ...lot.effect },
    rarity:lot.rarity,
    rarityLabel:lot.rarityLabel,
    rarityColor:lot.rarityColor,
    aura:lot.aura,
    styleFamily:{ id:'starspite-authored', name:'Starspite Posted-Price', palette:['#b99aff','#f2bd67'], shape:'orbital', note:'Authored casino provenance; not a portal style roll.' },
    baseValue:lot.baseValue,
    acquiredValue:lot.price,
    durability:lot.durability,
    maxDurability:lot.durability,
    power:powerByRarity[lot.rarity] || 1,
    installable:lot.installable,
    hatchable:false,
    reactionHistory:[],
    acquiredDay:state.day,
    receipt:Object.freeze({
      schema:'small-odds.authored-lot/v1',
      random:false,
      adaptiveLuck:false,
      pitySystem:false,
      source:'Starspite honesty auction',
      lotId:lot.id,
      postedPrice:lot.price,
      purchasedDay:state.day
    })
  };
}

export function buyCasinoLot(state, lotId) {
  if (state.starspite.access !== 'member' || state.location !== 'starspite') return { ok:false, text:'The auction is only physically legal aboard Starspite.' };
  const lot = CASINO_LOTS.find(candidate => candidate.id === lotId);
  if (!lot) return { ok:false, text:'That lot has not been authored.' };
  if (state.starspite.lotsPurchased.includes(lot.id)) return { ok:false, text:'That one-of-this-save artifact already left its plinth.' };
  if (state.money < lot.price) return { ok:false, text:`The posted price is ${lot.price} credits. The auctioneer refuses emotional bids.` };
  state.money -= lot.price;
  state.world.totalLost += lot.price;
  state.starspite.lotsPurchased.push(lot.id);
  const item = authoredCasinoItem(lot, state);
  state.inventory.unshift(item);
  state.stats.casinoLots += 1;
  const text = `${lot.name} joined the moving box for its posted ${lot.price}-credit price. Its receipt declares authored provenance, not random rarity.`;
  addLedger(state, 'casino', text, { lotId:lot.id, itemId:item.id });
  advanceTime(state, 2);
  return { ok:true, text, item };
}

function addLedger(state, kind, text, extra = {}) {
  state.ledger.unshift({ at: nowIso(), day: state.day, hour: state.hour, kind, text, ...extra });
  state.ledger = state.ledger.slice(0, 120);
}

function lifeDefinition(definitionId) {
  return LIFE_THREADS.find(thread => thread.id === definitionId) || null;
}

function applyLifeEffect(state, definition, effect = {}) {
  const applied = {};
  for (const [key, rawValue] of Object.entries(effect)) {
    const amount = Math.round(Number(rawValue) || 0);
    if (!amount) continue;
    if (key === 'energy') {
      const before = state.player.energy;
      state.player.energy = clamp(before + amount, 0, state.player.maxEnergy);
      applied.energy = state.player.energy - before;
    } else if (key === 'money') {
      const before = state.money;
      state.money = Math.max(0, before + amount);
      const actual = state.money - before;
      applied.money = actual;
      if (actual > 0) state.world.totalEarned += actual;
      else state.world.totalLost += Math.abs(actual);
    } else if (key === 'relation') {
      state.relationships[definition.actor] = (state.relationships[definition.actor] || 0) + amount;
      applied.relation = amount;
    } else if (key === 'reputation') {
      state.player.reputation += amount;
      applied.reputation = amount;
    } else if (key === 'knowledge') {
      state.player.knowledge += amount;
      applied.knowledge = amount;
    } else if (key === 'home') {
      const before = state.home.score;
      state.home.score = Math.max(0, before + amount);
      applied.home = state.home.score - before;
    } else if (key === 'charge') {
      const before = state.portal.charges;
      state.portal.charges = clamp(before + amount, 0, state.portal.maxCharges);
      applied.charge = state.portal.charges - before;
    }
  }
  return applied;
}

function lifeHistoryEntry(state, entry) {
  state.life.history.unshift({ at:nowIso(), day:state.day, hour:state.hour, ...entry });
  state.life.history = state.life.history.slice(0, 80);
}

function householdHistoryEntry(state, entry) {
  const household = state.district.households[NEIGHBORHOOD_COMMONS.id];
  household.history.unshift({ at:nowIso(), day:state.day, hour:state.hour, ...entry });
  household.history = household.history.slice(0,80);
}

function maintenanceHistoryEntry(state, entry) {
  const maintenance = state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance;
  maintenance.history.unshift({ at:nowIso(), day:state.day, hour:state.hour, ...entry });
  maintenance.history = maintenance.history.slice(0,80);
}

function applyHouseholdStateEffect(state, effect = {}) {
  const before = districtHouseholdProfile(state);
  const household = state.district.households[NEIGHBORHOOD_COMMONS.id];
  const warmthDelta = Math.round(Number(effect.warmthDelta) || 0);
  const trustDelta = Math.round(Number(effect.trustDelta) || 0);
  const agreementsDelta = Math.round(Number(effect.agreementsDelta) || 0);
  household.warmth = clamp(before.warmth + warmthDelta,-8,12);
  household.trust = clamp(before.trust + trustDelta,-8,12);
  household.agreements = Math.max(0,before.agreements + agreementsDelta);

  let supplier = null;
  if (Object.hasOwn(effect,'supplierStandingDelta')) {
    const supplierBefore = districtSupplierProfile(state);
    const requestedDelta = Math.round(Number(effect.supplierStandingDelta) || 0);
    state.district.supplier.standing = clamp(supplierBefore.standing + requestedDelta,-12,12);
    const supplierAfter = districtSupplierProfile(state);
    supplier = {
      before:supplierBefore.standing,
      requestedDelta,
      delta:supplierAfter.standing - supplierBefore.standing,
      after:supplierAfter.standing,
      stateBefore:supplierBefore.state,
      stateAfter:supplierAfter.state,
      businessFactorAfter:supplierAfter.businessFactor
    };
  }

  const after = districtHouseholdProfile(state);
  return {
    householdId:after.id,
    householdName:after.name,
    resource:after.resource,
    warmth:{ before:before.warmth, requestedDelta:warmthDelta, delta:after.warmth - before.warmth, after:after.warmth },
    trust:{ before:before.trust, requestedDelta:trustDelta, delta:after.trust - before.trust, after:after.trust },
    agreements:{ before:before.agreements, requestedDelta:agreementsDelta, delta:after.agreements - before.agreements, after:after.agreements },
    stateBefore:before.state,
    stateAfter:after.state,
    labelAfter:after.label,
    supplier,
    random:false
  };
}

export function chooseCommonsGovernance(state, modelId) {
  activateCommonsMaintenanceFault(state);
  const options = commonsGovernanceOptions(state);
  const model = options.models.find(candidate => candidate.id === modelId);
  if (!model) return { ok:false, text:'That Hushglass ownership model is not authored.' };
  if (!model.open) return { ok:false, text:model.reason || 'That ownership model is currently locked.' };
  if (state.work.active) return { ok:false, text:`${state.work.active.title} is already using the Long Table schedule.` };
  if (state.player.energy < model.energyCost) return { ok:false, text:`This public charter needs ${model.energyCost} energy. Pip has ${state.player.energy}.` };
  const household = state.district.households[NEIGHBORHOOD_COMMONS.id];
  const maintenance = household.maintenance;
  const governance = maintenance.governance;
  const previousModel = maintenanceGovernanceModel(governance.modelId);
  const review = Boolean(previousModel);
  const effect = model.decisionEffect;
  const energyBefore = state.player.energy;
  const workBefore = neighborhoodWorkProfile(state);
  const businessBefore = state.business ? Math.round(Number(state.business.rating) || 0) : null;
  const homeBefore = Math.max(0,Math.round(Number(state.home.score) || 0));
  const relationshipBefore = Math.round(Number(state.relationships[effect.residentId]) || 0);
  const householdRoute = applyHouseholdStateEffect(state,effect);
  state.player.energy = clamp(energyBefore - model.energyCost,0,state.player.maxEnergy);
  state.work.standing = clamp(workBefore.standing + Math.round(Number(effect.workStandingDelta) || 0),-8,12);
  state.work.pressure = clamp(workBefore.pressure + Math.round(Number(effect.workPressureDelta) || 0),0,12);
  if (state.business) state.business.rating = Math.max(1,businessBefore + Math.round(Number(effect.businessRatingGain) || 0));
  state.home.score = Math.max(0,homeBefore + Math.round(Number(effect.homeGain) || 0));
  state.relationships[effect.residentId] = relationshipBefore + Math.round(Number(effect.residentRelationshipGain) || 0);
  const workAfter = neighborhoodWorkProfile(state);
  const businessAfter = state.business ? Math.round(Number(state.business.rating) || 0) : null;
  const selectedCycle = Math.max(0,Math.round(Number(maintenance.cycles) || 0));
  governance.modelId = model.id;
  governance.selectedDay = state.day;
  governance.selectedCycle = selectedCycle;
  governance.reviewDueCycle = selectedCycle + NEIGHBORHOOD_COMMONS.maintenance.governance.reviewAfterCycles;
  const receipt = {
    schema:'small-odds.commons-governance-choice/v1', random:false,
    householdId:NEIGHBORHOOD_COMMONS.id, resource:NEIGHBORHOOD_COMMONS.maintenance.resource,
    modelId:model.id, modelLabel:model.label, previousModelId:previousModel?.id || null,
    ownership:model.ownership, rights:[...model.rights], obligations:[...model.obligations],
    chosenDay:state.day, chosenHour:state.hour, selectedCycle, review, reviewDueCycle:governance.reviewDueCycle,
    activeFault:options.profile.fault ? { id:options.profile.fault.id, definitionId:options.profile.fault.definitionId, label:options.profile.fault.label, causeEvidence:cloneState(options.profile.fault.causeEvidence) } : null,
    energy:{ before:energyBefore, cost:model.energyCost, after:state.player.energy },
    householdRoute,
    applied:{
      workStanding:{ before:workBefore.standing, requestedDelta:Math.round(Number(effect.workStandingDelta) || 0), delta:workAfter.standing - workBefore.standing, after:workAfter.standing },
      workPressure:{ before:workBefore.pressure, requestedDelta:Math.round(Number(effect.workPressureDelta) || 0), delta:workAfter.pressure - workBefore.pressure, after:workAfter.pressure, stateAfter:workAfter.pressureState },
      businessRating:{ before:businessBefore, requestedDelta:Math.round(Number(effect.businessRatingGain) || 0), delta:businessBefore == null ? 0 : businessAfter - businessBefore, after:businessAfter },
      home:{ before:homeBefore, requestedDelta:Math.round(Number(effect.homeGain) || 0), delta:state.home.score - homeBefore, after:state.home.score },
      residentRelationship:{ residentId:effect.residentId, residentName:ACTORS[effect.residentId]?.name || effect.residentId, before:relationshipBefore, requestedDelta:Math.round(Number(effect.residentRelationshipGain) || 0), delta:state.relationships[effect.residentId] - relationshipBefore, after:state.relationships[effect.residentId] }
    },
    nextServiceModifier:cloneState(model.serviceEffect),
    houseMark:{ kind:'governance', visual:effect.houseMark },
    ignoredInputs:['portal draws','casino history','cash beyond the posted energy cost','session length','belief that one owner is luckier'],
    portal:{ chargesBefore:state.portal.charges, chargesAfter:state.portal.charges, oddsChanged:false },
    portalOddsChanged:false
  };
  const historyEntry = { at:nowIso(), day:state.day, hour:state.hour, modelId:model.id, previousModelId:previousModel?.id || null, review, receipt };
  governance.history.unshift(historyEntry);
  governance.history = governance.history.slice(0,40);
  governance.lastReceipt = receipt;
  maintenance.lastReceipt = receipt;
  household.lastReceipt = receipt;
  state.district.lastReceipt = receipt;
  state.stats.commonsGovernanceChoices += 1;
  if (review) state.stats.commonsGovernanceReviews += 1;
  const markId = `commons-governance-${state.day}-${maintenance.sequence}`;
  const parentText = model.id === 'communal-charter'
    ? `Mum hung the common-valve charter beside the heat mobile: the night valve has obligations, witnesses, and no private owner.`
    : model.id === 'household-trust'
      ? `Dad filed the Hushglass trust deed beside the family heater, including the night veto and the duty to return surplus warmth.`
      : `Mum pinned the service cooperative license beside the workbench with public rates and every retained owner still named.`;
  state.district.houseMarks.unshift({ id:markId, kind:'governance', day:state.day, residentId:effect.residentId, parentText, visual:effect.houseMark, receipt });
  state.district.houseMarks = state.district.houseMarks.slice(0,40);
  const text = `${model.shortLabel} now governs the Hushglass night valve through cycle ${governance.reviewDueCycle}; its rights, obligations, and service modifier are public.`;
  maintenanceHistoryEntry(state,{ kind:'governance', routeId:null, text, receipt, random:false });
  householdHistoryEntry(state,{ kind:'maintenance-governance', routeId:null, text, receipt, random:false });
  if (state.business) recordBusinessHistory(state,'commons-governance',text,receipt);
  addLedger(state,'commons-governance',text,{ receipt });
  const timeResult = advanceTime(state,model.hours);
  state.updatedAt = nowIso();
  return { ok:true, text, receipt, model, timeResult };
}

export function startCommonsMaintenance(state, routeId, assetId = null) {
  activateCommonsMaintenanceFault(state);
  const options = commonsMaintenanceOptions(state);
  const routeView = options.routes.find(candidate => candidate.id === routeId);
  if (!routeView) return { ok:false, text:'That Hushglass maintenance route is not authored.' };
  if (!routeView.open) return { ok:false, text:routeView.reason || 'That maintenance route is currently locked.' };
  if (state.work.active) return { ok:false, text:`${state.work.active.title} is already using the Long Table schedule.` };
  if (state.player.energy < routeView.energyCost) return { ok:false, text:`This service route needs ${routeView.energyCost} energy. Pip has ${state.player.energy}.` };
  const household = state.district.households[NEIGHBORHOOD_COMMONS.id];
  const maintenance = household.maintenance;
  const asset = routeView.requiresAsset ? routeView.assets.find(candidate => candidate.id === assetId) || null : null;
  if (routeView.requiresAsset && !asset) return { ok:false, text:'Choose one currently retained matching installation or store-equipment object.' };
  const petProfile = routeView.requiresReturningPet ? options.pet : null;
  if (routeView.requiresReturningPet && (!petProfile.pet || !petProfile.previouslyParticipated || petProfile.laborPoints < routeView.minimumLaborPoints)) {
    return { ok:false, text:'The returning pet evidence changed before the route began.' };
  }
  const startedDay = state.day;
  const startedHour = state.hour;
  const dueDay = startedDay + routeView.dueDays;
  const energyBefore = state.player.energy;
  state.player.energy = clamp(energyBefore - routeView.energyCost,0,state.player.maxEnergy);
  const activeId = `commons-maintenance-${maintenance.sequence}`;
  let assetEvidence = null;
  if (asset) {
    if (!Array.isArray(asset.item.reactionHistory)) asset.item.reactionHistory = [];
    asset.item.reactionHistory.push({ day:state.day, source:'Hushglass maintenance start', valueGain:0, routeId:routeView.id, ownershipRetained:true });
    assetEvidence = { id:asset.id, name:asset.name, source:asset.source, matchedTags:[...asset.matchedTags], ownershipRetained:true };
    state.stats.commonsAssetRoutes += 1;
  }
  let petEvidence = null;
  if (petProfile?.pet) {
    const moodBefore = petProfile.pet.mood;
    petProfile.pet.mood = 'returning to the Hushglass valve by name';
    petEvidence = {
      id:petProfile.pet.id,
      name:petProfile.pet.name,
      previouslyParticipated:petProfile.previouslyParticipated,
      laborPoints:petProfile.laborPoints,
      speciesMatches:[...petProfile.speciesMatches],
      traitMatches:cloneState(petProfile.traitMatches),
      reasons:[...petProfile.reasons],
      moodBefore,
      moodAfter:petProfile.pet.mood
    };
    state.stats.commonsReturningPetRoutes += 1;
  }
  const receipt = {
    schema:'small-odds.commons-maintenance-start/v1', random:false,
    maintenanceId:activeId, householdId:NEIGHBORHOOD_COMMONS.id,
    routeId:routeView.id, routeLabel:routeView.label,
    startedDay, startedHour, dueDay,
    prerequisites:{
      agreements:districtHouseholdProfile(state).agreements,
      accordEvidence:options.profile.accordEvidence,
      warmth:districtHouseholdProfile(state).warmth,
      minimumWarmth:NEIGHBORHOOD_COMMONS.maintenance.minimumWarmth,
      authoredDueDay:options.profile.nextDueDay
    },
    energy:{ before:energyBefore, cost:routeView.energyCost, after:state.player.energy },
    asset:assetEvidence,
    pet:petEvidence,
    promisedReturn:cloneState(routeView.returnEffect),
    effectBreakdown:cloneState(routeView.effectBreakdown),
    governance:options.profile.governance.model ? { modelId:options.profile.governance.model.id, modelLabel:options.profile.governance.model.label, selectedCycle:options.profile.governance.selectedCycle, reviewDueCycle:options.profile.governance.reviewDueCycle } : null,
    fault:options.profile.fault ? { id:options.profile.fault.id, definitionId:options.profile.fault.definitionId, label:options.profile.fault.label, causeEvidence:cloneState(options.profile.fault.causeEvidence) } : null,
    nextCycleIntervalDays:NEIGHBORHOOD_COMMONS.maintenance.intervalDays,
    ignoredInputs:['portal draws','casino history','cash on hand','failed offers','session length','unrelated pet traits','belief that maintenance is lucky'],
    portal:{ chargesBefore:state.portal.charges, chargesAfter:state.portal.charges, oddsChanged:false },
    portalOddsChanged:false
  };
  const active = {
    id:activeId,
    routeId:routeView.id,
    label:routeView.label,
    startedDay,
    startedHour,
    dueDay,
    asset:assetEvidence,
    pet:petEvidence,
    returnEffect:cloneState(routeView.returnEffect),
    effectBreakdown:cloneState(routeView.effectBreakdown),
    governance:receipt.governance,
    fault:receipt.fault,
    startReceipt:receipt,
    status:'in-service'
  };
  maintenance.sequence += 1;
  maintenance.active = active;
  maintenance.lastReceipt = receipt;
  household.lastReceipt = receipt;
  state.district.lastReceipt = receipt;
  state.stats.commonsMaintenanceStarts += 1;
  const text = `${routeView.label} entered the public service record, due Day ${dueDay}.${assetEvidence ? ` ${assetEvidence.name} stays owned as ${assetEvidence.source}.` : ''}${petEvidence ? ` ${petEvidence.name} returns with ${petEvidence.laborPoints} literal points from the original accord.` : ''}`;
  maintenanceHistoryEntry(state,{ kind:'start', routeId:routeView.id, text, receipt, random:false });
  householdHistoryEntry(state,{ kind:'maintenance-start', routeId:routeView.id, text, receipt, random:false });
  if (state.business) recordBusinessHistory(state,'commons-maintenance-start',text,receipt);
  addLedger(state,'commons-maintenance',text,{ receipt });
  const timeResult = advanceTime(state,routeView.hours);
  state.updatedAt = nowIso();
  return { ok:true, text, receipt, active, timeResult };
}

function finalizeCommonsMaintenanceFault(state, routeId, resolutionSchema) {
  const maintenance = state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance;
  const fault = maintenance.fault;
  if (!fault) return null;
  const resolution = {
    id:fault.id, definitionId:fault.definitionId, label:fault.label,
    dueDay:fault.dueDay, activatedDay:fault.selectedDay, resolvedDay:state.day,
    routeId, governanceModelId:maintenance.governance.modelId,
    causeEvidence:cloneState(fault.causeEvidence), resolutionSchema,
    random:false, portalOddsChanged:false
  };
  maintenance.faultHistory.unshift(resolution);
  maintenance.faultHistory = maintenance.faultHistory.slice(0,40);
  maintenance.fault = null;
  state.stats.commonsFaultsResolved += 1;
  return resolution;
}

export function resolveCommonsMaintenanceReturns(state) {
  const household = state.district?.households?.[NEIGHBORHOOD_COMMONS.id];
  const maintenance = household?.maintenance;
  const active = maintenance?.active;
  if (!active || active.routeId === 'long-table-contract' || active.dueDay > state.day) return [];
  const route = NEIGHBORHOOD_COMMONS.maintenance.routes.find(candidate => candidate.id === active.routeId);
  if (!route) { maintenance.active = null; return []; }
  const effect = active.returnEffect || route.returnEffect;
  const integrityBefore = clamp(Math.round(Number(maintenance.integrity) || 0),0,8);
  const cyclesBefore = Math.max(0,Math.round(Number(maintenance.cycles) || 0));
  const workBefore = neighborhoodWorkProfile(state);
  const businessBefore = state.business ? Math.round(Number(state.business.rating) || 0) : null;
  const homeBefore = Math.max(0,Math.round(Number(state.home.score) || 0));
  const relationshipBefore = Math.round(Number(state.relationships[effect.residentId]) || 0);
  const householdRoute = applyHouseholdStateEffect(state,effect);
  state.work.standing = clamp(workBefore.standing + Math.round(Number(effect.workStandingDelta) || 0),-8,12);
  state.work.pressure = clamp(workBefore.pressure + Math.round(Number(effect.workPressureDelta) || 0),0,12);
  if (state.business) state.business.rating = Math.max(1,businessBefore + Math.round(Number(effect.businessRatingGain) || 0));
  state.home.score = Math.max(0,homeBefore + Math.round(Number(effect.homeGain) || 0));
  state.relationships[effect.residentId] = relationshipBefore + Math.round(Number(effect.residentRelationshipGain) || 0);
  let petApplied = null;
  if (active.pet) {
    const pet = state.pets.find(candidate => candidate.id === active.pet.id) || null;
    if (pet) {
      const before = Math.max(0,Math.round(Number(pet.affection) || 0));
      const requestedDelta = Math.round(Number(effect.petAffectionGain) || 0);
      pet.affection = before + requestedDelta;
      pet.mood = 'certified on the recurring Hushglass rota';
      petApplied = { id:pet.id, name:pet.name, before, requestedDelta, delta:pet.affection - before, after:pet.affection, moodAfter:pet.mood, evidence:active.pet };
    }
  }
  maintenance.integrity = clamp(integrityBefore + Math.round(Number(effect.integrityDelta) || 0),0,8);
  maintenance.cycles = cyclesBefore + 1;
  maintenance.nextDueDay = state.day + NEIGHBORHOOD_COMMONS.maintenance.intervalDays;
  maintenance.active = null;
  const faultResolution = finalizeCommonsMaintenanceFault(state,active.routeId,'small-odds.commons-maintenance-return/v1');
  const workAfter = neighborhoodWorkProfile(state);
  const businessAfter = state.business ? Math.round(Number(state.business.rating) || 0) : null;
  const integrityBand = maintenanceBandForIntegrity(maintenance.integrity);
  const markId = `commons-maintenance-${active.id}`;
  const receipt = {
    schema:'small-odds.commons-maintenance-return/v1', random:false,
    maintenanceId:active.id, householdId:NEIGHBORHOOD_COMMONS.id,
    routeId:active.routeId, routeLabel:active.label,
    startedDay:active.startedDay, dueDay:active.dueDay, resolvedDay:state.day,
    householdRoute,
    integrity:{ before:integrityBefore, requestedDelta:Math.round(Number(effect.integrityDelta) || 0), delta:maintenance.integrity - integrityBefore, after:maintenance.integrity, stateAfter:integrityBand.id, labelAfter:integrityBand.label },
    cycles:{ before:cyclesBefore, delta:1, after:maintenance.cycles },
    nextDueDay:maintenance.nextDueDay,
    asset:active.asset,
    pet:petApplied,
    governance:active.governance || null,
    fault:active.fault || null,
    faultResolution,
    effectBreakdown:active.effectBreakdown || null,
    applied:{
      supplier:householdRoute.supplier,
      workStanding:{ before:workBefore.standing, requestedDelta:Math.round(Number(effect.workStandingDelta) || 0), delta:workAfter.standing - workBefore.standing, after:workAfter.standing },
      workPressure:{ before:workBefore.pressure, requestedDelta:Math.round(Number(effect.workPressureDelta) || 0), delta:workAfter.pressure - workBefore.pressure, after:workAfter.pressure, stateAfter:workAfter.pressureState },
      businessRating:{ before:businessBefore, requestedDelta:Math.round(Number(effect.businessRatingGain) || 0), delta:businessBefore == null ? 0 : businessAfter - businessBefore, after:businessAfter },
      home:{ before:homeBefore, requestedDelta:Math.round(Number(effect.homeGain) || 0), delta:state.home.score - homeBefore, after:state.home.score },
      residentRelationship:{ residentId:effect.residentId, residentName:ACTORS[effect.residentId]?.name || effect.residentId, before:relationshipBefore, requestedDelta:Math.round(Number(effect.residentRelationshipGain) || 0), delta:state.relationships[effect.residentId] - relationshipBefore, after:state.relationships[effect.residentId] }
    },
    houseMark:{ id:markId, kind:'maintenance', visual:effect.houseMark },
    portal:{ chargesBefore:state.portal.charges, chargesAfter:state.portal.charges, oddsChanged:false },
    portalOddsChanged:false
  };
  const parentText = active.routeId === 'retained-relay'
    ? `Mum framed the retained relay's ownership card beside the old window: helping Hushglass did not silently sell the family or storefront object.`
    : active.routeId === 'returning-pet'
      ? `Dad mounted ${active.pet?.name || 'the returning creature'}'s valve seal where the heat mobile can point to who came back.`
      : `Mum pinned the public Hushglass valve rota beside the family heater so every maintenance date has a household name.`;
  state.district.houseMarks.unshift({ id:markId, kind:'maintenance', day:state.day, residentId:effect.residentId, parentText, visual:effect.houseMark, receipt });
  state.district.houseMarks = state.district.houseMarks.slice(0,40);
  maintenance.lastReceipt = receipt;
  household.lastReceipt = receipt;
  state.district.lastReceipt = receipt;
  state.stats.commonsMaintenanceReturns += 1;
  const text = `${active.label} returned exactly once. Hushglass integrity moved ${integrityBefore} -> ${maintenance.integrity}; the next authored service day is Day ${maintenance.nextDueDay}.${faultResolution ? ` ${faultResolution.label} is resolved under ${active.governance?.modelLabel || 'the public service record'}.` : ''}`;
  maintenanceHistoryEntry(state,{ kind:'return', routeId:active.routeId, text, receipt, random:false });
  householdHistoryEntry(state,{ kind:'maintenance-return', routeId:active.routeId, text, receipt, random:false });
  if (state.business) recordBusinessHistory(state,'commons-maintenance-return',text,receipt);
  addLedger(state,'commons-maintenance-return',text,{ receipt });
  return [{ ...active, text, receipt }];
}

export function resolveCommonsMaintenanceOverdue(state) {
  const profile = commonsMaintenanceProfile(state);
  const household = state.district?.households?.[NEIGHBORHOOD_COMMONS.id];
  const maintenance = household?.maintenance;
  if (!profile.overdue || maintenance.lastOverdueDueDay === profile.nextDueDay) return null;
  const integrityBefore = profile.integrity;
  const workBefore = neighborhoodWorkProfile(state);
  const householdRoute = applyHouseholdStateEffect(state,{ warmthDelta:-1, trustDelta:-1 });
  maintenance.integrity = clamp(integrityBefore - 1,0,8);
  state.work.pressure = clamp(workBefore.pressure + 1,0,12);
  maintenance.lastOverdueDueDay = profile.nextDueDay;
  maintenance.overdueCycles += 1;
  const workAfter = neighborhoodWorkProfile(state);
  const band = maintenanceBandForIntegrity(maintenance.integrity);
  const receipt = {
    schema:'small-odds.commons-maintenance-overdue/v1', random:false,
    householdId:NEIGHBORHOOD_COMMONS.id, dueDay:profile.nextDueDay, resolvedDay:state.day,
    graceDays:NEIGHBORHOOD_COMMONS.maintenance.graceDays,
    householdRoute,
    integrity:{ before:integrityBefore, requestedDelta:-1, delta:maintenance.integrity - integrityBefore, after:maintenance.integrity, stateAfter:band.id, labelAfter:band.label },
    workPressure:{ before:workBefore.pressure, requestedDelta:1, delta:workAfter.pressure - workBefore.pressure, after:workAfter.pressure, stateAfter:workAfter.pressureState },
    appliedExactlyOnceForDueDay:profile.nextDueDay,
    portalOddsChanged:false
  };
  maintenance.lastReceipt = receipt;
  household.lastReceipt = receipt;
  state.district.lastReceipt = receipt;
  state.stats.commonsMaintenanceOverdues += 1;
  const text = `The Day ${profile.nextDueDay} Hushglass service became overdue after its public grace day. Integrity, warmth, trust, and rivalry pressure changed once; the route remains repairable.`;
  maintenanceHistoryEntry(state,{ kind:'overdue', routeId:null, text, receipt, random:false });
  householdHistoryEntry(state,{ kind:'maintenance-overdue', text, receipt, random:false });
  if (state.business) recordBusinessHistory(state,'commons-maintenance-overdue',text,receipt);
  addLedger(state,'commons-maintenance-overdue',text,{ receipt });
  return { text, receipt };
}

export function lifeThreadAtLocation(state, locationId = state.location) {
  return state.life?.active?.find(thread => thread.location === locationId) || null;
}

export function lifeThreadChoices(state, threadId) {
  const instance = state.life?.active?.find(thread => thread.id === threadId);
  const definition = instance && lifeDefinition(instance.definitionId);
  if (!instance || !definition) return [];
  const choices = [...definition.choices];
  const neighbor = definition.neighborChoice;
  if (neighbor && Number(state.relationships[neighbor.residentId] || 0) >= neighbor.minRelationship) {
    choices.push({
      ...neighbor,
      neighborRoute:{
        residentId:neighbor.residentId,
        residentName:ACTORS[neighbor.residentId].name,
        minimumRelationship:neighbor.minRelationship,
        currentRelationship:Number(state.relationships[neighbor.residentId] || 0),
        residentRelationshipGain:Number(neighbor.residentRelationshipGain || 0),
        supplierStandingDelta:Number(neighbor.supplierStandingDelta || 0)
      }
    });
  }
  const workChoice = definition.workChoice;
  const workPressure = Number(state.work?.pressure || 0);
  if (workChoice && Number(state.work?.standing || 0) >= workChoice.minStanding && (workChoice.maximumPressure == null || workPressure <= workChoice.maximumPressure)) {
    const employer = neighborhoodWorkProfile(state);
    choices.push({
      ...workChoice,
      workRoute:{
        employerId:employer.id,
        employerName:employer.name,
        minimumStanding:workChoice.minStanding,
        currentStanding:employer.standing,
        maximumPressure:workChoice.maximumPressure ?? null,
        standingDelta:Number(workChoice.standingDelta || 0),
        pressureBefore:employer.pressure,
        pressureDelta:Number(workChoice.pressureDelta || 0)
      }
    });
  }
  const supplierChoice = definition.supplierChoice;
  const supplier = districtSupplierProfile(state);
  if (supplierChoice && supplier.standing >= supplierChoice.minStanding) {
    choices.push({
      ...supplierChoice,
      supplierRoute:{
        supplierId:supplier.id,
        supplierName:supplier.name,
        minimumStanding:supplierChoice.minStanding,
        currentStanding:supplier.standing,
        standingDelta:Number(supplierChoice.supplierStandingDelta || 0)
      }
    });
  }
  const petChoice = definition.petChoice;
  if (petChoice) {
    const profile = householdPetProfile(state,petChoice.skillTags);
    if (profile.pet && profile.laborPoints >= petChoice.minLaborPoints) {
      choices.push({
        ...petChoice,
        petRoute:{
          petId:profile.pet.id,
          petName:profile.pet.name,
          speciesId:profile.pet.speciesId,
          minimumLaborPoints:petChoice.minLaborPoints,
          laborPoints:profile.laborPoints,
          speciesMatches:[...profile.speciesMatches],
          traitMatches:cloneState(profile.traitMatches),
          reasons:[...profile.reasons],
          affectionGain:Number(petChoice.affectionGain || 0),
          supplierStandingDelta:Number(petChoice.supplierStandingDelta || 0),
          workPressureDelta:Number(petChoice.workPressureDelta || 0)
        }
      });
    }
  }
  return choices;
}

export function matchingLifeThreadItems(state, threadId, choiceId) {
  const instance = state.life?.active?.find(thread => thread.id === threadId);
  const choice = instance ? lifeThreadChoices(state,threadId).find(candidate => candidate.id === choiceId) : null;
  if (!instance || !choice?.itemTags?.length) return [];
  return state.inventory.filter(item => intersects(item.tags, choice.itemTags));
}

function lifeThreadEligible(state, definition) {
  if (state.day < definition.minDay) return false;
  if (definition.requiresStarspite && state.starspite.access !== 'member') return false;
  if (definition.location === 'starspite' && state.starspite.access !== 'member') return false;
  if (!state.world.locations.includes(definition.location) && definition.location !== state.location) return false;
  if (state.life.active.some(thread => thread.definitionId === definition.id)) return false;
  const last = state.life.history.find(entry => entry.definitionId === definition.id && ['choice','unattended'].includes(entry.kind));
  return !last || state.day - last.day >= definition.repeatAfterDays;
}

function expireLifeThreads(state) {
  const expired = state.life.active.filter(instance => state.day > instance.expiresDay);
  if (!expired.length) return [];
  const outcomes = [];
  for (const instance of expired) {
    const definition = lifeDefinition(instance.definitionId);
    if (!definition) continue;
    const applied = applyLifeEffect(state, definition, definition.unattended.effect);
    const householdRoute = definition.householdId && definition.unattended.householdEffect
      ? applyHouseholdStateEffect(state,definition.unattended.householdEffect)
      : null;
    const reactions = resolveContextReactions(state, unique([...definition.tags, ...definition.unattended.tags]), `${definition.title} continuing without Pip`);
    const text = `${definition.unattended.text}${reactions.length ? ` ${reactions.length} held item${reactions.length === 1 ? '' : 's'} reacted.` : ''}`;
    const receipt = householdRoute ? {
      schema:'small-odds.household-unattended/v1', random:false, threadId:instance.id,
      definitionId:definition.id, householdId:definition.householdId, resolvedDay:state.day,
      applied, householdRoute, portalOddsChanged:false
    } : null;
    if (receipt) {
      const household = state.district.households[definition.householdId];
      household.lastReceipt = receipt;
      state.district.lastReceipt = receipt;
      householdHistoryEntry(state,{ kind:'unattended', threadId:instance.id, definitionId:definition.id, text, receipt, random:false });
    }
    addLedger(state, 'consequence', text, { lifeThreadId:instance.id, unattended:true, applied, receipt });
    lifeHistoryEntry(state, { kind:'unattended', definitionId:definition.id, threadId:instance.id, actor:definition.actor, location:definition.location, text, applied, householdRoute, receipt, random:false });
    state.stats.lifeConsequences += 1;
    outcomes.push({ threadId:instance.id, text, applied, reactions });
  }
  const expiredIds = new Set(expired.map(instance => instance.id));
  state.life.active = state.life.active.filter(instance => !expiredIds.has(instance.id));
  return outcomes;
}

function resolveHouseholdAccordReturn(state, consequence, definition) {
  const effect = consequence.householdReturn;
  if (!effect || definition.householdId !== NEIGHBORHOOD_COMMONS.id) return null;
  const householdRoute = applyHouseholdStateEffect(state,effect);
  const workBefore = neighborhoodWorkProfile(state);
  const businessBefore = state.business ? Math.round(Number(state.business.rating) || 0) : null;
  const homeBefore = Math.max(0,Math.round(Number(state.home.score) || 0));
  const residentId = effect.residentId || definition.actor;
  const relationshipBefore = Math.round(Number(state.relationships[residentId]) || 0);
  const workStandingRequested = Math.round(Number(effect.workStandingDelta) || 0);
  const workPressureRequested = Math.round(Number(effect.workPressureDelta) || 0);
  const ratingRequested = Math.round(Number(effect.businessRatingGain) || 0);
  const homeRequested = Math.round(Number(effect.homeGain) || 0);
  const relationshipRequested = Math.round(Number(effect.residentRelationshipGain) || 0);

  state.work.standing = clamp(workBefore.standing + workStandingRequested,-8,12);
  state.work.pressure = clamp(workBefore.pressure + workPressureRequested,0,12);
  if (state.business) state.business.rating = Math.max(1,businessBefore + ratingRequested);
  state.home.score = Math.max(0,homeBefore + homeRequested);
  state.relationships[residentId] = relationshipBefore + relationshipRequested;
  const workAfter = neighborhoodWorkProfile(state);
  const businessAfter = state.business ? Math.round(Number(state.business.rating) || 0) : null;

  const markVisual = effect.houseMark || 'heat-share-mobile';
  const markId = `household-${consequence.id}`;
  const household = state.district.households[definition.householdId];
  const maintenance = household.maintenance;
  let maintenanceActivation = null;
  if (household.agreements >= NEIGHBORHOOD_COMMONS.maintenance.minimumAgreements && maintenance.nextDueDay == null) {
    const integrityBefore = maintenance.integrity;
    maintenance.integrity = Math.max(2,maintenance.integrity);
    maintenance.nextDueDay = state.day + 2;
    const band = maintenanceBandForIntegrity(maintenance.integrity);
    maintenanceActivation = {
      integrity:{ before:integrityBefore, delta:maintenance.integrity - integrityBefore, after:maintenance.integrity, stateAfter:band.id, labelAfter:band.label },
      nextDueDay:maintenance.nextDueDay,
      intervalDays:NEIGHBORHOOD_COMMONS.maintenance.intervalDays,
      historyFabricated:false
    };
  }
  const receipt = {
    schema:'small-odds.household-accord-return/v1', random:false,
    consequenceId:consequence.id, threadId:consequence.threadId, definitionId:definition.id,
    choiceId:consequence.choiceId, householdId:definition.householdId,
    dueDay:consequence.dueDay, resolvedDay:state.day,
    householdRoute,
    maintenanceActivation,
    applied:{
      supplier:householdRoute.supplier,
      workStanding:{ before:workBefore.standing, requestedDelta:workStandingRequested, delta:workAfter.standing - workBefore.standing, after:workAfter.standing },
      workPressure:{ before:workBefore.pressure, requestedDelta:workPressureRequested, delta:workAfter.pressure - workBefore.pressure, after:workAfter.pressure, stateAfter:workAfter.pressureState },
      businessRating:{ before:businessBefore, requestedDelta:ratingRequested, delta:businessBefore == null ? 0 : businessAfter - businessBefore, after:businessAfter },
      home:{ before:homeBefore, requestedDelta:homeRequested, delta:state.home.score - homeBefore, after:state.home.score },
      residentRelationship:{ residentId, residentName:ACTORS[residentId]?.name || residentId, before:relationshipBefore, requestedDelta:relationshipRequested, delta:state.relationships[residentId] - relationshipBefore, after:state.relationships[residentId] }
    },
    houseMark:{ id:markId, kind:'commons', visual:markVisual },
    portal:{ chargesBefore:state.portal.charges, chargesAfter:state.portal.charges, oddsChanged:false },
    portalOddsChanged:false
  };
  const parentText = `Mum and Dad hung the Hushglass heat-share mobile over the old window: every warm room is named, and so is every cold one.`;
  state.district.houseMarks.unshift({ id:markId, kind:'commons', day:state.day, residentId, parentText, visual:markVisual, receipt });
  state.district.houseMarks = state.district.houseMarks.slice(0,40);
  household.lastReceipt = receipt;
  state.district.lastReceipt = receipt;
  state.stats.householdReturns += 1;
  householdHistoryEntry(state,{ kind:'return', threadId:consequence.threadId, definitionId:definition.id, choiceId:consequence.choiceId, text:consequence.text, receipt, random:false });
  if (state.business) recordBusinessHistory(state,'household-return',consequence.text,receipt);
  return receipt;
}

export function resolveDueLifeConsequences(state) {
  const due = state.life.scheduled.filter(consequence => consequence.dueDay <= state.day);
  if (!due.length) return [];
  const outcomes = [];
  for (const consequence of due) {
    const definition = lifeDefinition(consequence.definitionId);
    if (!definition) continue;
    const applied = applyLifeEffect(state, definition, consequence.effect);
    const receipt = resolveHouseholdAccordReturn(state,consequence,definition);
    const reactions = resolveContextReactions(state, consequence.tags, consequence.text);
    const householdText = receipt ? ` ${receipt.householdRoute.householdName} moved ${receipt.householdRoute.stateBefore} -> ${receipt.householdRoute.stateAfter}; the exact cross-household return is filed.` : '';
    const text = `${consequence.text}${householdText}${reactions.length ? ` ${reactions.length} held item${reactions.length === 1 ? '' : 's'} reacted to what came back.` : ''}`;
    addLedger(state, 'consequence', text, { lifeThreadId:consequence.threadId, choiceId:consequence.choiceId, applied, receipt });
    lifeHistoryEntry(state, { kind:'consequence', definitionId:definition.id, threadId:consequence.threadId, choiceId:consequence.choiceId, actor:definition.actor, location:definition.location, text, applied, receipt, random:false });
    state.stats.lifeConsequences += 1;
    outcomes.push({ ...consequence, text, applied, receipt, reactions });
  }
  const dueIds = new Set(due.map(consequence => consequence.id));
  state.life.scheduled = state.life.scheduled.filter(consequence => !dueIds.has(consequence.id));
  return outcomes;
}

export function syncLifeThreads(state) {
  if (!state.life) return { spawned:null, expired:[] };
  const expired = expireLifeThreads(state);
  if (state.life.active.length >= 2 || state.life.lastSpawnDay >= state.day) return { spawned:null, expired };
  const eligible = LIFE_THREADS.filter(definition => lifeThreadEligible(state, definition));
  if (!eligible.length) {
    state.life.lastSpawnDay = state.day;
    return { spawned:null, expired };
  }
  const local = eligible.filter(definition => definition.location === state.location);
  const pool = local.length ? local : eligible;
  const relationshipSum = Object.values(state.relationships).reduce((sum, value) => sum + Number(value || 0), 0);
  const index = Math.abs(state.day * 31 + state.world.eventIndex * 7 + relationshipSum) % pool.length;
  const definition = pool[index];
  const instance = {
    id:`life-${state.life.sequence}-${definition.id}`,
    definitionId:definition.id,
    location:definition.location,
    actor:definition.actor,
    openedDay:state.day,
    openedHour:state.hour,
    expiresDay:state.day + definition.expiresInDays,
    worldEventId:currentWorldEvent(state).id,
    random:false
  };
  state.life.sequence += 1;
  state.life.lastSpawnDay = state.day;
  state.life.active.push(instance);
  const text = `${definition.title}. ${definition.summary}`;
  addLedger(state, 'situation', text, { lifeThreadId:instance.id, location:definition.location, random:false });
  return { spawned:instance, expired };
}

export function resolveLifeThread(state, threadId, choiceId, itemId = null) {
  const instance = state.life?.active?.find(thread => thread.id === threadId);
  if (!instance) return { ok:false, text:'That situation has already continued.' };
  const definition = lifeDefinition(instance.definitionId);
  const choice = definition ? lifeThreadChoices(state,threadId).find(candidate => candidate.id === choiceId) : null;
  if (!definition || !choice) return { ok:false, text:'That response does not belong to this life.' };
  if (state.location !== definition.location) return { ok:false, text:'This can only be decided where it is happening.' };
  if (choice.cost && state.money < choice.cost) return { ok:false, text:`This response needs ${choice.cost} credits. Pip has ${state.money}.` };
  if (state.player.energy + Number(choice.effect?.energy || 0) < 0) return { ok:false, text:'Pip is too tired for that response. The situation is still moving.' };

  let item = null;
  let itemContribution = 0;
  let itemBroke = false;
  if (choice.itemTags?.length) {
    item = matchingLifeThreadItems(state, threadId, choiceId).find(candidate => candidate.id === itemId) || null;
    if (!item) return { ok:false, text:'Choose a possession whose actual tags fit this response.' };
  }

  if (choice.cost) {
    state.money -= choice.cost;
    state.world.totalLost += choice.cost;
  }
  const applied = applyLifeEffect(state, definition, choice.effect);
  let neighborRoute = null;
  if (choice.neighborRoute) {
    const beforeSupplier = districtSupplierProfile(state);
    const neighborRelationshipBefore = Number(state.relationships[choice.neighborRoute.residentId]) || 0;
    state.relationships[choice.neighborRoute.residentId] = neighborRelationshipBefore + choice.neighborRoute.residentRelationshipGain;
    state.district.supplier.standing = clamp(beforeSupplier.standing + choice.neighborRoute.supplierStandingDelta,-12,12);
    const afterSupplier = districtSupplierProfile(state);
    neighborRoute = {
      ...choice.neighborRoute,
      relationshipBefore:neighborRelationshipBefore,
      relationshipAfter:state.relationships[choice.neighborRoute.residentId],
      supplierStandingBefore:beforeSupplier.standing,
      supplierStandingAfter:afterSupplier.standing,
      supplierStateBefore:beforeSupplier.state,
      supplierStateAfter:afterSupplier.state,
      supplierBusinessFactorAfter:afterSupplier.businessFactor
    };
    state.stats.neighborLifeRoutes += 1;
  }
  let workRoute = null;
  if (choice.workRoute) {
    const beforeStanding = Number(state.work.standing) || 0;
    const beforePressure = Number(state.work.pressure) || 0;
    state.work.standing = clamp(beforeStanding + choice.workRoute.standingDelta,-8,12);
    state.work.pressure = clamp(beforePressure + choice.workRoute.pressureDelta,0,12);
    const afterWork = neighborhoodWorkProfile(state);
    workRoute = {
      ...choice.workRoute,
      standingBefore:beforeStanding,
      standingAfter:state.work.standing,
      pressureBefore:beforePressure,
      pressureAfter:state.work.pressure,
      pressureStateAfter:afterWork.pressureState,
      wageFactorAfter:afterWork.pressureWageFactor
    };
    state.stats.workLifeRoutes += 1;
  }
  let supplierRoute = null;
  if (choice.supplierRoute) {
    const beforeSupplier = districtSupplierProfile(state);
    state.district.supplier.standing = clamp(beforeSupplier.standing + choice.supplierRoute.standingDelta,-12,12);
    const afterSupplier = districtSupplierProfile(state);
    supplierRoute = {
      ...choice.supplierRoute,
      standingBefore:beforeSupplier.standing,
      standingAfter:afterSupplier.standing,
      standingApplied:afterSupplier.standing - beforeSupplier.standing,
      supplierStateBefore:beforeSupplier.state,
      supplierStateAfter:afterSupplier.state,
      businessFactorAfter:afterSupplier.businessFactor
    };
    state.stats.supplierHouseholdRoutes += 1;
  }
  let petRoute = null;
  if (choice.petRoute) {
    const pet = state.pets.find(candidate => candidate.id === choice.petRoute.petId) || null;
    const currentProfile = householdPetProfile(state,choice.skillTags);
    if (!pet || state.business?.assignedPetId !== pet.id || currentProfile.laborPoints < choice.petRoute.minimumLaborPoints) {
      return { ok:false, text:'The named pet is no longer assigned with enough literal commons skill evidence.' };
    }
    const supplierBefore = districtSupplierProfile(state);
    const workBefore = neighborhoodWorkProfile(state);
    const affectionBefore = Math.max(0,Math.round(Number(pet.affection) || 0));
    state.district.supplier.standing = clamp(supplierBefore.standing + choice.petRoute.supplierStandingDelta,-12,12);
    state.work.pressure = clamp(workBefore.pressure + choice.petRoute.workPressureDelta,0,12);
    pet.affection = affectionBefore + choice.petRoute.affectionGain;
    pet.mood = 'auditing the public heat ledger';
    const supplierAfter = districtSupplierProfile(state);
    const workAfter = neighborhoodWorkProfile(state);
    petRoute = {
      ...choice.petRoute,
      affection:{ before:affectionBefore, requestedDelta:choice.petRoute.affectionGain, delta:pet.affection - affectionBefore, after:pet.affection },
      moodAfter:pet.mood,
      supplier:{ before:supplierBefore.standing, requestedDelta:choice.petRoute.supplierStandingDelta, delta:supplierAfter.standing - supplierBefore.standing, after:supplierAfter.standing, stateBefore:supplierBefore.state, stateAfter:supplierAfter.state },
      workPressure:{ before:workBefore.pressure, requestedDelta:choice.petRoute.workPressureDelta, delta:workAfter.pressure - workBefore.pressure, after:workAfter.pressure, stateAfter:workAfter.pressureState }
    };
    state.stats.petHouseholdRoutes += 1;
  }
  const householdRoute = definition.householdId && choice.householdEffect
    ? applyHouseholdStateEffect(state,choice.householdEffect)
    : null;
  if (householdRoute && petRoute) {
    const maintenance = state.district.households[definition.householdId].maintenance;
    const beforeIds = [...maintenance.participantPetIds];
    maintenance.participantPetIds = unique([...beforeIds,petRoute.petId]);
    petRoute.maintenanceParticipation = {
      participantIdsBefore:beforeIds,
      participantIdsAfter:[...maintenance.participantPetIds],
      evidenceSource:'saved Hushglass life-choice receipt'
    };
  }
  if (item) {
    itemContribution = Math.max(1, Math.round(item.power));
    item.baseValue += itemContribution * 2;
    item.reactionHistory.push({ day:state.day, source:definition.title, valueGain:itemContribution * 2, lifeThreadId:instance.id });
    state.player.knowledge += Math.max(1, Math.floor(itemContribution / 2));
    state.relationships[definition.actor] += Math.min(4, itemContribution);
    item.durability -= choice.itemDurability || 1;
    if (item.durability <= 0) {
      removeInventoryItem(state, item.id);
      itemBroke = true;
    }
  }

  const contextTags = unique([...definition.tags, ...(choice.itemTags || []), ...(item?.tags || []), ...currentWorldEvent(state).tags]);
  const reactions = resolveContextReactions(state, contextTags, `${definition.title}: ${choice.label}`);
  const receipt = {
    schema:'small-odds.life-choice/v1',
    random:false,
    threadId:instance.id,
    definitionId:definition.id,
    choiceId:choice.id,
    actor:definition.actor,
    location:definition.location,
    openedDay:instance.openedDay,
    resolvedDay:state.day,
    worldEventId:instance.worldEventId,
    cost:choice.cost || 0,
    hours:choice.hours,
    itemId:item?.id || null,
    itemName:item?.name || null,
    itemContribution,
    itemBroke,
    applied,
    neighborRoute,
    workRoute,
    supplierRoute,
    petRoute,
    householdRoute:householdRoute ? {
      ...householdRoute,
      routeKind:supplierRoute ? 'supplier' : workRoute ? 'work' : neighborRoute ? 'neighbor' : petRoute ? 'pet' : item ? 'object' : 'direct'
    } : null,
    delayedDueDay:choice.delayed ? state.day + choice.delayed.days : null,
    portalOddsChanged:false
  };
  state.life.active = state.life.active.filter(thread => thread.id !== instance.id);
  lifeHistoryEntry(state, { kind:'choice', definitionId:definition.id, threadId:instance.id, choiceId:choice.id, actor:definition.actor, location:definition.location, text:choice.result, receipt, random:false });
  if (householdRoute) {
    const household = state.district.households[definition.householdId];
    household.lastReceipt = receipt;
    state.district.lastReceipt = receipt;
    state.stats.householdLifeChoices += 1;
    householdHistoryEntry(state,{ kind:'choice', threadId:instance.id, definitionId:definition.id, choiceId:choice.id, text:choice.result, receipt, random:false });
  }
  if (choice.delayed) {
    state.life.scheduled.push({
      id:`consequence-${instance.id}-${choice.id}`,
      threadId:instance.id,
      definitionId:definition.id,
      choiceId:choice.id,
      dueDay:state.day + choice.delayed.days,
      effect:{ ...choice.delayed.effect },
      householdReturn:choice.delayed.householdReturn ? cloneState(choice.delayed.householdReturn) : null,
      tags:unique([...definition.tags, ...choice.delayed.tags]),
      text:choice.delayed.text,
      random:false
    });
  }
  state.stats.lifeChoices += 1;
  const itemText = item ? ` ${item.name} gained a real history and lost ${choice.itemDurability || 1} durability${itemBroke ? ', completing its final shift' : ''}.` : '';
  const neighborText = neighborRoute ? ` ${neighborRoute.residentName} joined through rapport ${neighborRoute.currentRelationship}; cooperative standing moved ${neighborRoute.supplierStandingBefore} → ${neighborRoute.supplierStandingAfter}.` : '';
  const workText = workRoute ? ` ${workRoute.employerName} recognized standing ${workRoute.standingBefore} → ${workRoute.standingAfter}; rivalry pressure moved ${workRoute.pressureBefore} → ${workRoute.pressureAfter}.` : '';
  const supplierText = supplierRoute ? ` ${supplierRoute.supplierName} supplied the route; standing moved ${supplierRoute.standingBefore} → ${supplierRoute.standingAfter}.` : '';
  const petText = petRoute ? ` ${petRoute.petName} contributed ${petRoute.laborPoints} literal commons points; affection moved ${petRoute.affection.before} → ${petRoute.affection.after}.` : '';
  const householdText = householdRoute ? ` ${householdRoute.householdName} moved ${householdRoute.stateBefore} → ${householdRoute.stateAfter}: warmth ${householdRoute.warmth.before} → ${householdRoute.warmth.after}, trust ${householdRoute.trust.before} → ${householdRoute.trust.after}.` : '';
  const reactionText = reactions.length ? ` ${reactions.length} held item${reactions.length === 1 ? '' : 's'} also reacted.` : '';
  const text = `${choice.result}${neighborText}${workText}${supplierText}${petText}${householdText}${itemText}${reactionText}`;
  addLedger(state, 'choice', text, { lifeThreadId:instance.id, choiceId:choice.id, receipt });
  const timeResult = advanceTime(state, choice.hours);
  state.updatedAt = nowIso();
  return { ok:true, text, receipt, reactions, delayed:Boolean(choice.delayed), timeResult };
}

function removeInventoryItem(state, itemId) {
  const index = state.inventory.findIndex(item => item.id === itemId);
  if (index < 0) return null;
  if (state.starspite?.insuredItemId === itemId) state.starspite.insuredItemId = null;
  return state.inventory.splice(index, 1)[0];
}

function visibleItems(state) {
  const businessItems = state.business ? [...state.business.assets, ...state.business.listings.map(listing => listing.item)] : [];
  return [...state.inventory, ...state.installed, ...businessItems];
}

export function resolveContextReactions(state, contextTags, sourceLabel) {
  const results = [];
  const cleanSourceLabel = String(sourceLabel).replace(/[.!?]+$/, '');
  for (const item of visibleItems(state)) {
    // A future trigger is a complete signature, not a bag of loose keywords.
    // Requiring every declared trigger tag prevents, for example, an item waiting
    // for a power+home outage from waking during an ordinary home activity.
    if (!item.triggerTags.every(tag => contextTags.includes(tag))) continue;
    const receiptId = `${state.day}:${cleanSourceLabel}:${item.id}`;
    if (state.world.reactionsSeen.includes(receiptId)) continue;
    const yieldValue = Math.max(1, Math.round(item.power * item.triggerBonus * 3));
    const relationTarget = contextTags.includes('family') ? (state.location === 'kitchen' ? 'mom' : 'dad') : null;
    if (relationTarget) state.relationships[relationTarget] += Math.max(1, Math.round(item.power));
    else state.player.knowledge += Math.max(1, Math.floor(item.power));
    item.baseValue += yieldValue;
    item.reactionHistory.push({ day: state.day, source: cleanSourceLabel, valueGain: yieldValue });
    state.world.reactionsSeen.push(receiptId);
    state.stats.reactions += 1;
    const text = `${item.name} reacted ${item.triggerName} during ${cleanSourceLabel}. Its history—and value—changed by ${yieldValue} credits.`;
    addLedger(state, 'reaction', text);
    results.push({ itemId: item.id, text, valueGain: yieldValue });
    if (results.length >= 3) break;
  }
  state.world.reactionsSeen = state.world.reactionsSeen.slice(-300);
  return results;
}

function applyEffect(state, effect, scale = 1) {
  const applied = {};
  for (const [key, raw] of Object.entries(effect || {})) {
    const amount = Math.round(raw * scale);
    if (!amount) continue;
    applied[key] = amount;
    if (key === 'energy') state.player.energy = clamp(state.player.energy + amount, 0, state.player.maxEnergy);
    else if (key === 'money') {
      state.money = Math.max(0, state.money + amount);
      if (amount > 0) state.world.totalEarned += amount;
      else state.world.totalLost += Math.abs(amount);
    } else if (key === 'relation') {
      const actor = LOCATIONS[state.location]?.actor;
      if (actor && actor in state.relationships) state.relationships[actor] += amount;
    } else if (key === 'reputation') state.player.reputation += amount;
    else if (key === 'knowledge') state.player.knowledge += amount;
    else if (key === 'home') state.home.score += amount;
    else if (key === 'charge') state.portal.charges = clamp(state.portal.charges + amount, 0, state.portal.maxCharges);
  }
  return applied;
}

function derivePet(item) {
  const rng = createRng(item.receipt.seedHex);
  for (let skip = 0; skip < 32; skip += 1) rng.nextUint32();
  const species = PET_SPECIES[uniformInt(rng, PET_SPECIES.length)];
  const traitCount = ['legendary','unknown'].includes(item.rarity) ? 4 : ['rare','exotic'].includes(item.rarity) ? 3 : item.rarity === 'uncommon' ? 2 : 1;
  const traits = [];
  const rolls = [];
  while (traits.length < traitCount) {
    const roll = uniformInt(rng, MILLION) + 1;
    let cursor = 0;
    let chosen = PET_TRAITS[0];
    for (const trait of PET_TRAITS) {
      cursor += trait.weight;
      if (roll <= cursor) { chosen = trait; break; }
    }
    rolls.push(roll);
    if (!traits.some(trait => trait.id === chosen.id)) traits.push({ ...chosen });
  }
  return {
    id: `pet-${item.id}`,
    name: `${item.name.split(' ')[0]} ${species.name}`,
    speciesId: species.id,
    speciesName: species.name,
    glyph: species.glyph,
    tags: [...species.tags],
    baseBonus: species.baseBonus,
    traits,
    affection: 1,
    mood: 'confused but employed',
    originItem: item.id,
    traitReceipt: { seedHex: item.receipt.seedHex, rolls, total: MILLION, adaptiveLuck: false }
  };
}

export function performItemAction(state, itemId, action) {
  const item = state.inventory.find(candidate => candidate.id === itemId);
  if (!item) return { ok: false, text: 'That item has already continued its life elsewhere.' };
  let text = '';
  let consumed = false;
  if (action === 'sell') {
    const quote = marketQuote(item, state);
    removeInventoryItem(state, itemId);
    state.money += quote;
    state.world.totalEarned += quote;
    state.stats.itemsSold += 1;
    consumed = true;
    text = `Auntie Grift paid ${quote} credits for ${item.name}. She immediately priced it at ${quote * 3}.`;
  } else if (action === 'gift') {
    const actor = LOCATIONS[state.location]?.actor;
    if (!actor || !(actor in state.relationships)) return { ok: false, text: 'Nobody nearby can receive this particular mistake.' };
    removeInventoryItem(state, itemId);
    const gain = Math.max(2, Math.round(item.power * 3));
    state.relationships[actor] += gain;
    state.stats.itemsGifted += 1;
    consumed = true;
    text = `${actor === 'mom' ? 'Mum' : actor === 'dad' ? 'Dad' : actor === 'vendor' ? 'Auntie Grift' : 'Shellby'} accepted ${item.name}. Relationship +${gain}.`;
    resolveContextReactions(state, ['gift','emotion'], 'an honest gift');
  } else if (action === 'install') {
    if (!item.installable) return { ok: false, text: 'It refuses to become furniture, even temporarily.' };
    removeInventoryItem(state, itemId);
    item.installedAt = state.location;
    state.installed.unshift(item);
    const homeGain = Math.max(1, Math.round(item.power * 2));
    state.home.score += homeGain;
    state.stats.itemsInstalled += 1;
    consumed = true;
    text = `${item.name} is now part of the house. The house has not been consulted. Home +${homeGain}.`;
  } else if (action === 'business') {
    if (!state.business) return { ok: false, text: 'Start a business before equipping it with incomprehensible assets.' };
    removeInventoryItem(state, itemId);
    state.business.assets.unshift(item);
    const matches = intersects(item.tags, businessTags(state));
    const rating = Math.max(1, Math.round(item.power * (matches ? 3 : 1)));
    state.business.rating += rating;
    consumed = true;
    text = `${item.name} became reusable store equipment at ${state.business.name}. ${matches ? 'Customers understand the synergy.' : 'Customers misunderstand it productively.'} Rating +${rating}.`;
    recordBusinessHistory(state, 'equipment', text, { schema:'small-odds.business-equipment/v1', random:false, itemId:item.id, tagMatch:matches, ratingGain:rating });
  } else if (action === 'hatch') {
    if (!item.hatchable) return { ok: false, text: 'It does not contain a pet. It is flattered by the accusation.' };
    removeInventoryItem(state, itemId);
    const pet = derivePet(item);
    state.pets.push(pet);
    consumed = true;
    text = `${pet.name} hatched with ${pet.traits.length} stackable trait${pet.traits.length === 1 ? '' : 's'}: ${pet.traits.map(trait => trait.name).join(', ')}.`;
  } else if (action === 'recycle') {
    removeInventoryItem(state, itemId);
    const gain = ['legendary','unknown'].includes(item.rarity) ? 3 : ['rare','exotic'].includes(item.rarity) ? 2 : 1;
    const before = state.portal.charges;
    state.portal.charges = clamp(state.portal.charges + gain, 0, state.portal.maxCharges);
    consumed = true;
    text = `${item.name} became ${state.portal.charges - before} usable portal charge. Conservation laws have filed a complaint.`;
  } else if (action === 'use') {
    const applied = applyEffect(state, item.effect, item.power);
    item.durability -= 1;
    text = `${item.name} performed ${Object.entries(applied).map(([key,value]) => `${key} ${value >= 0 ? '+' : ''}${value}`).join(', ') || 'something too contextual to invoice'}.`;
    if (item.durability <= 0) {
      removeInventoryItem(state, itemId);
      consumed = true;
      text += ' It completed its final shift and dissolved into warranty dust.';
    }
    resolveContextReactions(state, [...item.tags, ...LOCATIONS[state.location].tags], `using ${item.name}`);
  } else return { ok: false, text: 'Unknown item action.' };

  addLedger(state, action, text, { itemId });
  advanceTime(state, action === 'sell' ? 1 : 2);
  state.updatedAt = nowIso();
  return { ok: true, text, consumed, item };
}

export function runActivity(state, activityId) {
  const activity = ACTIVITIES.find(candidate => candidate.id === activityId);
  if (!activity || activity.location !== state.location) return { ok: false, text: 'That life is happening somewhere else.' };
  if (activity.special === 'report-probability-crime' && state.starspite.crimeReported) {
    return { ok:false, text:'That probability crime is already in evidence. Re-reporting it would create a paperwork sequel.' };
  }
  if (state.player.energy + (activity.energy || 0) < 0) return { ok: false, text: 'Pip is too tired. Go home, use an energy item, or let the day turn.' };
  const effect = {
    energy: activity.energy || 0,
    money: activity.money || 0,
    reputation: activity.reputation || 0,
    knowledge: activity.knowledge || 0,
    home: activity.home || 0
  };
  const applied = applyEffect(state, effect, 1);
  if (activity.relation && activity.actor in state.relationships) {
    const petHelp = state.pets.some(pet => pet.traits.some(trait => trait.id === 'helpful')) ? 1 : 0;
    state.relationships[activity.actor] += activity.relation + petHelp;
  }
  let special = '';
  if (activity.special === 'adopt-starter-pet') {
    if (state.world.starterPetFound) special = ' The tax-mite already considers you its least temporary employer.';
    else {
      state.world.starterPetFound = true;
      state.pets.push({
        id:'pet-starter-ledger', name:'Ledger', speciesId:'tax-mite', speciesName:'Tax-Mite', glyph:'✣', tags:['legal','money'],
        baseBonus:'Finds one loose credit after legal activities.',
        traits:[{ ...PET_TRAITS.find(trait => trait.id === 'sniffer') }, { ...PET_TRAITS.find(trait => trait.id === 'jealous') }],
        affection:2, mood:'tiny, employed, judgmental', originItem:null,
        traitReceipt:{ mode:'authored-accessible-starter', randomClaim:false }
      });
      special = ' Ledger the tax-mite moved into your jacket with Tax-Scented and Professionally Jealous traits.';
    }
  } else if (activity.special === 'report-probability-crime') {
    state.starspite.crimeReported = true;
    special = ' Vesper sealed the false-luck advertisement in an evidence prism. The casino lights briefly became less dishonest.';
  }
  state.stats.activities += 1;
  const reactions = resolveContextReactions(state, activity.tags, activity.label);
  const summary = `${activity.detail}${special}${reactions.length ? ` ${reactions.length} held item${reactions.length === 1 ? '' : 's'} reacted.` : ''}`;
  addLedger(state, 'activity', summary, { activityId, applied });
  advanceTime(state, activity.hours);
  state.updatedAt = nowIso();
  return { ok: true, text: summary, applied, reactions };
}

function recordBusinessHistory(state, kind, text, receipt = null) {
  state.business.history.unshift({ at:nowIso(), day:state.day, hour:state.hour, kind, text, receipt });
  state.business.history = state.business.history.slice(0, 80);
}

export function listBusinessItem(state, itemId) {
  if (!state.business) return { ok:false, text:'Open a business before putting anything into alien-web escrow.' };
  if (state.business.listings.length >= businessListingCapacity(state)) return { ok:false, text:'Every escrow perch is occupied. Delist something, assign a pocketed pet, or build more listing space.' };
  const item = state.inventory.find(candidate => candidate.id === itemId);
  if (!item) return { ok:false, text:'That object is not available in the moving box.' };
  const ordinal = state.business.sequence;
  const quote = businessOfferQuote(state, item, { ordinal });
  removeInventoryItem(state, itemId);
  const listing = {
    id:`store-${state.day}-${ordinal}`,
    item,
    createdDay:state.day,
    refreshedDay:state.day,
    daysListed:0,
    counterCount:0,
    ask:quote.ask,
    offer:quote.offer,
    ceiling:quote.ceiling,
    buyerId:quote.buyer.id,
    offerReceipt:quote.receipt
  };
  state.business.sequence += 1;
  state.business.offersReceived += 1;
  state.business.listings.unshift(listing);
  state.stats.businessListings += 1;
  const text = `${item.name} entered reversible escrow at ${listing.ask} credits. ${quote.buyer.name} offered ${listing.offer}; every factor and the ${listing.ceiling}-credit ceiling are public.`;
  recordBusinessHistory(state, 'offer', text, quote.receipt);
  addLedger(state, 'business', text, { listingId:listing.id, receipt:quote.receipt });
  advanceTime(state, 1);
  state.updatedAt = nowIso();
  return { ok:true, text, listing, receipt:quote.receipt };
}

export function delistBusinessItem(state, listingId) {
  if (!state.business) return { ok:false, text:'There is no storefront to delist from.' };
  const index = state.business.listings.findIndex(listing => listing.id === listingId);
  if (index < 0) return { ok:false, text:'That listing already continued elsewhere.' };
  const [listing] = state.business.listings.splice(index, 1);
  state.inventory.unshift(listing.item);
  const text = `${listing.item.name} left escrow and returned to the moving box unchanged.`;
  recordBusinessHistory(state, 'delist', text);
  addLedger(state, 'business', text, { listingId });
  state.updatedAt = nowIso();
  return { ok:true, text, item:listing.item };
}

const DISTRICT_DELIVERY_RESIDENT = Object.freeze({
  'choir-six':'nibbin',
  'parcel-ancestor':'oola',
  'municipal-larva':'tavi',
  'grifts-neighbor':'latch',
  'vesper-office':'nibbin'
});

function scheduleDistrictDelivery(state, listing, buyer, salePrice, travelDays) {
  const residentId = DISTRICT_DELIVERY_RESIDENT[buyer.id] || 'oola';
  const delivery = {
    id:`district-delivery-${listing.id}-${state.day}`,
    status:'travelling',
    soldDay:state.day,
    dueDay:state.day + travelDays,
    residentId,
    buyerId:buyer.id,
    salePrice,
    listingId:listing.id,
    item:districtItemSnapshot(listing.item),
    receipt:null
  };
  state.district.deliveries.unshift(delivery);
  state.district.deliveries = state.district.deliveries.slice(0,80);
  return delivery;
}

export function resolveDistrictDeliveries(state) {
  const resolved = [];
  for (const delivery of state.district.deliveries.filter(candidate => candidate.status === 'travelling' && candidate.dueDay <= state.day)) {
    const actor = ACTORS[delivery.residentId];
    const firstVisibleDelivery = !state.district.houseMarks.some(mark => mark.kind === 'delivery');
    const homeGain = firstVisibleDelivery ? 1 : 0;
    state.home.score += homeGain;
    delivery.status = 'delivered';
    delivery.deliveredDay = state.day;
    const parentText = `Dad added a parcel-periscope to the old window after ${delivery.item.name} passed the house on its way to ${actor.name}. Mum labeled it "not surveillance; neighborliness with optics."`;
    const receipt = {
      schema:'small-odds.district-delivery/v1', random:false,
      deliveryId:delivery.id, listingId:delivery.listingId,
      soldDay:delivery.soldDay, dueDay:delivery.dueDay, deliveredDay:state.day,
      buyerId:delivery.buyerId, residentId:delivery.residentId, residentName:actor.name,
      item:delivery.item, salePrice:delivery.salePrice,
      route:'fixed buyer-to-resident map', homeGain,
      moneyIgnoredAfterSale:true, portalOddsChanged:false
    };
    delivery.receipt = receipt;
    state.district.houseMarks.unshift({ id:`house-${delivery.id}`, kind:'delivery', day:state.day, residentId:delivery.residentId, itemName:delivery.item.name, parentText, visual:'parcel-periscope', receipt });
    state.district.houseMarks = state.district.houseMarks.slice(0,40);
    state.district.lastReceipt = receipt;
    state.stats.districtDeliveries += 1;
    const text = `${delivery.item.name} reached ${actor.name} through Lopsided Lane's parcel spine. The route was fixed when the buyer checked out.`;
    addLedger(state,'district',text,{ residentId:delivery.residentId, deliveryId:delivery.id, receipt });
    addLedger(state,'home',parentText,{ deliveryId:delivery.id });
    if (state.business) recordBusinessHistory(state,'delivery',text,receipt);
    resolved.push({ delivery, receipt, text, parentText });
  }
  return resolved;
}

function completeBusinessSale(state, listing, price, decision, counterReceipt = null) {
  const buyer = BUSINESS_BUYERS.find(candidate => candidate.id === listing.buyerId) || BUSINESS_BUYERS[0];
  const index = state.business.listings.findIndex(candidate => candidate.id === listing.id);
  if (index < 0) return { ok:false, text:'That offer is no longer attached to escrow.' };
  state.business.listings.splice(index, 1);
  state.money += price;
  state.world.totalEarned += price;
  state.business.lifetimeIncome += price;
  state.business.salesIncome += price;
  state.business.sales += 1;
  state.business.rating += 1;
  state.stats.itemsSold += 1;
  state.stats.businessSales += 1;
  const travelDays = Math.max(1, buyer.callbackDays - (state.business.upgrades.includes('portal-fulfilment') ? 1 : 0));
  const callback = {
    id:`callback-${listing.id}-${state.day}`,
    dueDay:state.day + travelDays,
    buyerId:buyer.id,
    item:{ id:listing.item.id, name:listing.item.name, rarity:listing.item.rarity, tags:[...listing.item.tags], reactionCount:listing.item.reactionHistory?.length || 0 },
    salePrice:price,
    listingId:listing.id
  };
  state.business.callbacks.push(callback);
  const delivery = scheduleDistrictDelivery(state,listing,buyer,price,travelDays);
  const receipt = {
    schema:'small-odds.storefront-sale/v1', random:false, soldDay:state.day,
    listingId:listing.id, itemId:listing.item.id, itemName:listing.item.name,
    buyerId:buyer.id, buyerName:buyer.name, decision, postedAsk:listing.ask,
    acceptedPrice:price, initialOffer:listing.offerReceipt.offer, latestOffer:listing.offer,
    deterministicCeiling:listing.ceiling, counterReceipt, callbackDueDay:callback.dueDay,
    districtDelivery:{ id:delivery.id, residentId:delivery.residentId, dueDay:delivery.dueDay, random:false },
    offerReceipt:listing.offerReceipt, portalOddsChanged:false
  };
  state.business.lastSaleReceipt = receipt;
  const text = `${buyer.name} bought ${listing.item.name} for ${price} credits. It left Pip’s inventory; a buyer callback and a visible Lopsided Lane delivery are due on Day ${callback.dueDay}.`;
  recordBusinessHistory(state, 'sale', text, receipt);
  addLedger(state, 'business', text, { listingId:listing.id, receipt });
  advanceTime(state, 1);
  state.updatedAt = nowIso();
  return { ok:true, text, receipt, callback, delivery };
}

export function acceptBusinessOffer(state, listingId) {
  const listing = state.business?.listings.find(candidate => candidate.id === listingId);
  if (!listing) return { ok:false, text:'That buyer has no current offer.' };
  return completeBusinessSale(state, listing, listing.offer, 'accept-current-offer');
}

export function counterBusinessOffer(state, listingId) {
  const listing = state.business?.listings.find(candidate => candidate.id === listingId);
  if (!listing) return { ok:false, text:'That buyer has no current offer to counter.' };
  const buyer = BUSINESS_BUYERS.find(candidate => candidate.id === listing.buyerId) || BUSINESS_BUYERS[0];
  const counterNumber = listing.counterCount + 1;
  if (listing.offer >= listing.ask) return { ok:false, text:`${buyer.name} already offered at least the posted ask. Accepting ${listing.offer} credits is strictly better than countering downward.` };
  if (listing.ask <= listing.ceiling) {
    const receipt = {
      schema:'small-odds.storefront-counter/v1', random:false, day:state.day,
      listingId, buyerId:buyer.id, requested:listing.ask, priorOffer:listing.offer,
      deterministicCeiling:listing.ceiling, accepted:true, resultingOffer:listing.ask,
      rule:'posted ask is accepted when ask ≤ disclosed ceiling'
    };
    state.stats.businessCounters += 1;
    return completeBusinessSale(state, listing, listing.ask, 'counter-at-posted-ask', receipt);
  }
  if (listing.offer >= listing.ceiling) return { ok:false, text:`${buyer.name} has reached the disclosed ${listing.ceiling}-credit ceiling. No hidden roll can move it.` };
  const progress = clamp(counterNumber / Math.max(1, buyer.patience), 0, 1);
  const revisedOffer = Math.max(listing.offer + 1, Math.min(listing.ceiling, Math.round(listing.offerReceipt.offer + (listing.ceiling - listing.offerReceipt.offer) * progress)));
  const receipt = {
    schema:'small-odds.storefront-counter/v1', random:false, day:state.day,
    listingId, buyerId:buyer.id, requested:listing.ask, priorOffer:listing.offer,
    patience:buyer.patience, counterNumber, progress:normalizedFactor(progress),
    deterministicCeiling:listing.ceiling, accepted:false, resultingOffer:revisedOffer,
    rule:'initial offer + round((ceiling − initial offer) × min(counterNumber / patience, 1))'
  };
  listing.counterCount = counterNumber;
  listing.offer = revisedOffer;
  state.stats.businessCounters += 1;
  const text = `${buyer.name} refused the ${listing.ask}-credit ask and raised the offer to ${revisedOffer}. Their disclosed ceiling remains ${listing.ceiling}.`;
  recordBusinessHistory(state, 'counter', text, receipt);
  addLedger(state, 'business', text, { listingId, receipt });
  advanceTime(state, 1);
  state.updatedAt = nowIso();
  return { ok:true, text, receipt, listing };
}

export function refreshBusinessOffers(state) {
  if (!state.business) return [];
  const refreshed = [];
  for (let index = 0; index < state.business.listings.length; index += 1) {
    const listing = state.business.listings[index];
    const quote = businessOfferQuote(state, listing.item, { ordinal:index + 1 + listing.createdDay, ask:listing.ask });
    listing.refreshedDay = state.day;
    listing.daysListed += 1;
    listing.counterCount = 0;
    listing.offer = quote.offer;
    listing.ceiling = quote.ceiling;
    listing.buyerId = quote.buyer.id;
    listing.offerReceipt = quote.receipt;
    state.business.offersReceived += 1;
    const text = `${quote.buyer.name} routed a Day ${state.day} offer of ${quote.offer} credits for ${listing.item.name}.`;
    recordBusinessHistory(state, 'offer', text, quote.receipt);
    refreshed.push({ listingId:listing.id, buyerId:quote.buyer.id, offer:quote.offer, receipt:quote.receipt });
  }
  return refreshed;
}

export function resolveBusinessCallbacks(state) {
  if (!state.business) return [];
  const due = state.business.callbacks.filter(callback => callback.dueDay <= state.day);
  if (!due.length) return [];
  state.business.callbacks = state.business.callbacks.filter(callback => callback.dueDay > state.day);
  const petProfile = businessPetProfile(state);
  const packingBonus = state.business.upgrades.includes('family-packing-table') ? 1 : 0;
  const outcomes = [];
  for (const callback of due) {
    const buyer = BUSINESS_BUYERS.find(candidate => candidate.id === callback.buyerId) || BUSINESS_BUYERS[0];
    const rememberedObjectBonus = callback.item.reactionCount > 0 ? 1 : 0;
    const ratingGain = 1 + packingBonus + petProfile.callbackRating + rememberedObjectBonus;
    const reputationGain = callback.item.rarity === 'legendary' || callback.item.rarity === 'unknown' ? 2 : 1;
    state.business.rating += ratingGain;
    state.player.reputation += reputationGain;
    state.stats.businessCallbacks += 1;
    const receipt = {
      schema:'small-odds.business-callback/v1', random:false, resolvedDay:state.day,
      callbackId:callback.id, listingId:callback.listingId, buyerId:buyer.id,
      item:callback.item, ratingGain, reputationGain, packingBonus,
      petCallbackBonus:petProfile.callbackRating, rememberedObjectBonus
    };
    const text = `${buyer.callback} ${callback.item.name} returned as a story: storefront rating +${ratingGain}, reputation +${reputationGain}.`;
    recordBusinessHistory(state, 'callback', text, receipt);
    addLedger(state, 'business', text, { callbackId:callback.id, receipt });
    outcomes.push({ callbackId:callback.id, text, receipt });
  }
  return outcomes;
}

export function dailyBusinessIncome(state) {
  if (!state.business) return 0;
  const event = currentWorldEvent(state);
  const branch = businessBranch(state);
  const tags = businessTags(state);
  const matchingAssets = state.business.assets.filter(item => intersects(item.tags, tags)).length;
  const eventFactor = intersects(tags, event.tags) ? 1.35 : 1;
  const petProfile = businessPetProfile(state);
  const supplierProfile = districtSupplierProfile(state);
  const baseIncome = state.business.baseIncome + (branch?.incomeBonus || 0);
  const ratingIncome = state.business.rating * 1.5;
  const equipmentIncome = matchingAssets * 5;
  const subtotal = baseIncome + ratingIncome + equipmentIncome;
  const income = Math.max(1, Math.round(subtotal * eventFactor * petProfile.dailyFactor * supplierProfile.businessFactor));
  const receipt = {
    schema:'small-odds.business-daily/v1', random:false, day:state.day,
    businessId:state.business.id, branchId:branch?.id || null, baseIncome,
    rating:state.business.rating, ratingIncome, matchingEquipment:matchingAssets,
    equipmentIncome, eventId:event.id, eventFactor, petFactor:petProfile.dailyFactor,
    supplierId:supplierProfile.id, supplierState:supplierProfile.state,
    supplierStanding:supplierProfile.standing, supplierFactor:supplierProfile.businessFactor,
    petReasons:petProfile.reasons, subtotal, income,
    formula:'round((base + branch + rating × 1.5 + matching equipment × 5) × event × assigned pet × neighborhood supplier)',
    portalOddsChanged:false
  };
  state.business.lifetimeIncome += income;
  state.business.lastIncome = income;
  state.business.lastDailyReceipt = receipt;
  state.money += income;
  state.world.totalEarned += income;
  const text = `${state.business.name} earned ${income} service credits. The exact non-random formula is filed in the storefront.`;
  recordBusinessHistory(state, 'daily', text, receipt);
  addLedger(state, 'business', text, { receipt });
  return income;
}

export function advanceTime(state, hours) {
  const previousDay = state.day;
  state.hour += Math.max(0, Math.floor(hours));
  while (state.hour >= 24) {
    state.hour -= 24;
    state.day += 1;
    state.player.energy = clamp(state.player.energy + 28 + (state.home.upgrades.includes('heating-organ') ? 5 : 0), 0, state.player.maxEnergy);
    const dailyCharge = 1 + (state.portal.upgrades.includes('gentle-overclock') ? 1 : 0);
    state.portal.charges = clamp(state.portal.charges + dailyCharge, 0, state.portal.maxCharges);
    state.world.eventIndex = (state.day - 1) % WORLD_EVENTS.length;
    const event = currentWorldEvent(state);
    state.world.eventHistory.push(event.id);
    activateCommonsMaintenanceFault(state);
    resolveWorkReturns(state);
    resolveCommonsMaintenanceReturns(state);
    resolveCommonsMaintenanceOverdue(state);
    resolveDistrictArcReturns(state);
    dailyBusinessIncome(state);
    refreshBusinessOffers(state);
    resolveDistrictDeliveries(state);
    resolveBusinessCallbacks(state);
    resolveContextReactions(state, event.tags, event.name);
    addLedger(state, 'world', `${event.name}: ${event.summary}`);
    resolveDueLifeConsequences(state);
    syncLifeThreads(state);
  }
  state.updatedAt = nowIso();
  return { newDay: state.day !== previousDay, event: currentWorldEvent(state) };
}

export function travelTo(state, locationId) {
  if (!LOCATIONS[locationId]) return { ok:false, text:'That direction has not been invented.' };
  if (locationId === 'starspite' && state.starspite.access !== 'member') {
    return { ok:false, text:'Starspite requires the authentic one-in-a-million invitation. The ship rejects confidence as identification.' };
  }
  if (!state.world.locations.includes(locationId)) state.world.locations.push(locationId);
  state.location = locationId;
  if (locationId === 'district') state.district.visits += 1;
  state.focus = 1;
  advanceTime(state, locationId === 'room' || locationId === 'kitchen' ? 1 : 2);
  syncLifeThreads(state);
  const location = LOCATIONS[locationId];
  const reactions = resolveContextReactions(state, location.tags, `arriving at ${location.name}`);
  const text = `${location.name}. ${location.kicker.toLowerCase()}${reactions.length ? ` ${reactions.length} item reaction${reactions.length === 1 ? '' : 's'} followed you here.` : ''}`;
  addLedger(state, 'travel', text);
  return { ok:true, text, reactions };
}

export function startBusiness(state, businessId) {
  if (state.business) return { ok:false, text:`You already run ${state.business.name}. One bedroom, one zoning violation at a time.` };
  const type = BUSINESS_TYPES.find(candidate => candidate.id === businessId);
  if (!type) return { ok:false, text:'That business model escaped.' };
  if (state.money < type.cost) return { ok:false, text:`You need ${type.cost} credits. Hope remains legal tender only at home.` };
  state.money -= type.cost;
  state.world.totalLost += type.cost;
  state.business = {
    ...type,
    openedDay:state.day,
    rating:1,
    assets:[],
    listings:[],
    upgrades:[],
    branchId:null,
    assignedPetId:null,
    callbacks:[],
    history:[],
    sequence:1,
    offersReceived:0,
    sales:0,
    salesIncome:0,
    lifetimeIncome:0,
    lastIncome:0,
    lastDailyReceipt:null,
    lastSaleReceipt:null
  };
  state.player.reputation += 2;
  const text = `${type.name} opened on the local alien web. Dad made a sign. Mum corrected the sign. The sign became the shipping department.`;
  recordBusinessHistory(state, 'opening', text, { schema:'small-odds.business-opening/v1', random:false, businessId:type.id, openedDay:state.day, cost:type.cost });
  addLedger(state, 'business', text);
  advanceTime(state, 3);
  return { ok:true, text };
}

export function returnBusinessEquipment(state, itemId) {
  if (!state.business) return { ok:false, text:'No business equipment exists.' };
  const index = state.business.assets.findIndex(item => item.id === itemId);
  if (index < 0) return { ok:false, text:'That equipment has already left the storefront.' };
  const [item] = state.business.assets.splice(index, 1);
  state.inventory.unshift(item);
  const text = `${item.name} stopped being store equipment and returned to the moving box.`;
  recordBusinessHistory(state, 'equipment', text);
  addLedger(state, 'business', text, { itemId });
  state.updatedAt = nowIso();
  return { ok:true, text, item };
}

export function assignBusinessPet(state, petId = null) {
  if (!state.business) return { ok:false, text:'Pets require a business before accepting a job title.' };
  if (petId == null) {
    const previous = state.pets.find(pet => pet.id === state.business.assignedPetId);
    state.business.assignedPetId = null;
    const text = previous ? `${previous.name} clocked out and resumed unsupervised pethood.` : 'No pet was on shift.';
    if (previous) recordBusinessHistory(state, 'pet', text);
    state.updatedAt = nowIso();
    return { ok:true, text };
  }
  const pet = state.pets.find(candidate => candidate.id === petId);
  if (!pet) return { ok:false, text:'That pet is not part of this household.' };
  state.business.assignedPetId = pet.id;
  const profile = businessPetProfile(state);
  const text = `${pet.name} joined the shipping shift. ${profile.reasons.length ? profile.reasons.join('; ') : 'Its moral support is real; its numeric multiplier is 1.00.'}`;
  recordBusinessHistory(state, 'pet', text);
  addLedger(state, 'business', text, { petId });
  state.updatedAt = nowIso();
  return { ok:true, text, profile };
}

export function buyBusinessUpgrade(state, upgradeId) {
  if (!state.business) return { ok:false, text:'There is no storefront to upgrade.' };
  const upgrade = BUSINESS_UPGRADES.find(candidate => candidate.id === upgradeId);
  if (!upgrade || state.business.upgrades.includes(upgradeId)) return { ok:false, text:'That storefront organ is already installed.' };
  if (state.business.rating < upgrade.rating) return { ok:false, text:`The storefront needs rating ${upgrade.rating}; it currently has ${state.business.rating}.` };
  if (upgrade.requiresPortal && !state.portal.unlocked) return { ok:false, text:'This upgrade needs the portal machine physically present.' };
  if (state.money < upgrade.cost) return { ok:false, text:`The contractor wants ${upgrade.cost} credits and refuses exposure as payment.` };
  state.money -= upgrade.cost;
  state.world.totalLost += upgrade.cost;
  state.business.upgrades.push(upgrade.id);
  const text = `${upgrade.name} joined the storefront. ${upgrade.effect}. Portal probability remains unchanged.`;
  recordBusinessHistory(state, 'upgrade', text, { schema:'small-odds.business-upgrade/v1', random:false, upgradeId, cost:upgrade.cost, effect:upgrade.effect, portalOddsChanged:false });
  addLedger(state, 'business', text);
  advanceTime(state, 2);
  return { ok:true, text };
}

export function chooseBusinessBranch(state, branchId) {
  if (!state.business) return { ok:false, text:'There is no business to specialize.' };
  if (state.business.branchId) return { ok:false, text:'The bedroom has already grown one permanent specialty wing.' };
  const branch = BUSINESS_BRANCHES.find(candidate => candidate.id === branchId && candidate.businessId === state.business.id);
  if (!branch) return { ok:false, text:'That branch belongs to a different kind of bad idea.' };
  if (state.business.rating < branch.rating) return { ok:false, text:`This branch needs rating ${branch.rating}; the storefront has ${state.business.rating}.` };
  if (branch.requiresPortal && !state.portal.unlocked) return { ok:false, text:'This branch needs the Random Item Portal Device in the room.' };
  if (state.money < branch.cost) return { ok:false, text:`Specialization costs ${branch.cost} credits.` };
  state.money -= branch.cost;
  state.world.totalLost += branch.cost;
  state.business.branchId = branch.id;
  const text = `${state.business.name} grew the ${branch.name}: ${branch.description}`;
  recordBusinessHistory(state, 'branch', text, { schema:'small-odds.business-branch/v1', random:false, branchId, cost:branch.cost, addedTags:branch.addedTags, incomeBonus:branch.incomeBonus, offerMultiplier:branch.offerMultiplier });
  addLedger(state, 'business', text);
  advanceTime(state, 3);
  return { ok:true, text };
}

export function buyHomeUpgrade(state, upgradeId) {
  const upgrade = HOME_UPGRADES.find(candidate => candidate.id === upgradeId);
  if (!upgrade || state.home.upgrades.includes(upgradeId)) return { ok:false, text:'That part of home is already changed.' };
  if (state.home.score < upgrade.requirement) return { ok:false, text:`The house needs ${upgrade.requirement} home trust before it accepts this.` };
  if (state.money < upgrade.cost) return { ok:false, text:`The family budget is ${upgrade.cost - state.money} credits short.` };
  state.money -= upgrade.cost;
  state.world.totalLost += upgrade.cost;
  state.home.upgrades.push(upgradeId);
  state.home.score += upgrade.home;
  const parentGain = Math.max(2, Math.round(upgrade.home / 3));
  state.relationships.mom += parentGain;
  state.relationships.dad += parentGain;
  const text = `${upgrade.name} changed the family house. Both parents noticed where the money went.`;
  addLedger(state, 'home', text);
  advanceTime(state, 4);
  return { ok:true, text };
}

export function buyPortalUpgrade(state, upgradeId) {
  const upgrade = PORTAL_UPGRADES.find(candidate => candidate.id === upgradeId);
  if (!upgrade || state.portal.upgrades.includes(upgradeId)) return { ok:false, text:'That upgrade is already buzzing.' };
  if (state.money < upgrade.cost) return { ok:false, text:`The portal accepts science, but the shop wants ${upgrade.cost} credits.` };
  state.money -= upgrade.cost;
  state.world.totalLost += upgrade.cost;
  state.portal.upgrades.push(upgradeId);
  if (upgradeId === 'charge-rack') {
    state.portal.maxCharges += 2;
    state.portal.charges += 2;
  }
  const text = `${upgrade.name} installed. Published rarity and ticket odds did not change.`;
  addLedger(state, 'portal', text);
  advanceTime(state, 2);
  return { ok:true, text };
}

export function rushPortalCharge(state) {
  const cost = 45;
  if (!state.portal.unlocked) return { ok:false, text:'You need a portal before buying electricity for it.' };
  if (state.portal.charges >= state.portal.maxCharges) return { ok:false, text:'The charge rack is full and making a proud kettle noise.' };
  if (state.money < cost) return { ok:false, text:`Rush power costs ${cost} credits.` };
  state.money -= cost;
  state.world.totalLost += cost;
  state.portal.charges += 1;
  const text = `One rush charge purchased for ${cost} credits. Probability distribution unchanged.`;
  addLedger(state, 'portal', text);
  return { ok:true, text };
}

export function skipToMorning(state) {
  const hours = state.hour < 7 ? 7 - state.hour : 24 - state.hour + 7;
  state.location = 'room';
  const result = advanceTime(state, hours);
  syncLifeThreads(state);
  addLedger(state, 'life', 'Pip slept in the old room. The ceiling performed its usual inspection.');
  return { ok:true, text:`Morning arrived with ${result.event.name}.`, ...result };
}

export function stateSnapshot(state) {
  return {
    day: state.day,
    hour: state.hour,
    money: state.money,
    energy: state.player.energy,
    location: state.location,
    event: currentWorldEvent(state).id,
    portalCharges: state.portal.charges,
    inventory: state.inventory.length,
    pets: state.pets.length,
    home: state.home.score,
    relationships: { ...state.relationships },
    starspite: {
      access:state.starspite.access,
      gamesPlayed:state.starspite.gamesPlayed,
      wins:state.starspite.wins,
      losses:state.starspite.losses,
      netCredits:state.starspite.netCredits,
      lotsPurchased:state.starspite.lotsPurchased.length
    },
    life: {
      active:state.life.active.length,
      scheduled:state.life.scheduled.length,
      history:state.life.history.length,
      choices:state.stats.lifeChoices,
      consequences:state.stats.lifeConsequences
    },
    business:state.business ? {
      id:state.business.id,
      rating:state.business.rating,
      listings:state.business.listings.length,
      capacity:businessListingCapacity(state),
      equipment:state.business.assets.length,
      sales:state.business.sales,
      pendingCallbacks:state.business.callbacks.length,
      branchId:state.business.branchId
    } : null,
    district:{
      visits:state.district.visits,
      phase:districtPhase(state),
      talks:state.stats.districtTalks,
      gifts:state.district.gifts.length,
      deliveries:state.district.deliveries.length,
      delivered:state.district.deliveries.filter(delivery => delivery.status === 'delivered').length,
      houseMarks:state.district.houseMarks.length,
      arcChoices:state.stats.districtArcChoices,
      arcReturns:state.stats.districtArcReturns,
      pendingArcReturns:state.district.scheduledArcs.length,
      supplier:districtSupplierProfile(state),
      household:districtHouseholdProfile(state),
      maintenance:commonsMaintenanceProfile(state),
      householdChoices:state.stats.householdLifeChoices,
      householdReturns:state.stats.householdReturns,
      supplierHouseholdRoutes:state.stats.supplierHouseholdRoutes,
      petHouseholdRoutes:state.stats.petHouseholdRoutes,
      maintenanceStarts:state.stats.commonsMaintenanceStarts,
      maintenanceReturns:state.stats.commonsMaintenanceReturns,
      maintenanceOverdues:state.stats.commonsMaintenanceOverdues,
      maintenanceWorkConflicts:state.stats.commonsWorkConflicts,
      maintenanceAssetRoutes:state.stats.commonsAssetRoutes,
      maintenanceReturningPetRoutes:state.stats.commonsReturningPetRoutes,
      governanceChoices:state.stats.commonsGovernanceChoices,
      governanceReviews:state.stats.commonsGovernanceReviews,
      faultsActivated:state.stats.commonsFaultsActivated,
      faultsResolved:state.stats.commonsFaultsResolved
    },
    work:{
      standing:state.work.standing,
      pressure:state.work.pressure,
      completed:state.work.completed,
      active:state.work.active ? { id:state.work.active.id, orderId:state.work.active.orderId, dueDay:state.work.active.dueDay, wage:state.work.active.wage } : null,
      profile:neighborhoodWorkProfile(state),
      started:state.stats.workOrdersStarted,
      returns:state.stats.workOrdersCompleted,
      lifeRoutes:state.stats.workLifeRoutes
    }
  };
}

export const SYSTEM_CONSTANTS = Object.freeze({
  MILLION,
  rarityWeightTotal: RARITY_WEIGHT,
  petTraitWeightTotal: PET_TRAIT_WEIGHT,
  lifeThreadCount: LIFE_THREADS.length,
  mechanicalCombinations: catalogCombinationCount() / STYLE_FAMILIES.length,
  namedCombinationsIncludingStyleFamilies: catalogCombinationCount(),
  casinoGames: CASINO_GAMES.length,
  casinoLots: CASINO_LOTS.length,
  businessBuyers: BUSINESS_BUYERS.length,
  businessUpgrades: BUSINESS_UPGRADES.length,
  businessBranches: BUSINESS_BRANCHES.length,
  districtResidents: DISTRICT_RESIDENTS.length,
  districtContextReactions: DISTRICT_CONTEXT_REACTIONS.length,
  districtArcs: DISTRICT_ARCS.length,
  districtSupplierBands: DISTRICT_SUPPLIER.bands.length,
  neighborhoodHouseholds: 2,
  neighborhoodCommonsBands: NEIGHBORHOOD_COMMONS.bands.length,
  neighborhoodWorkOrders: NEIGHBORHOOD_WORKS.orders.length + 1,
  neighborhoodWorkApproaches: NEIGHBORHOOD_WORKS.approaches.length,
  neighborhoodWorkPressureBands: NEIGHBORHOOD_WORKS.pressureBands.length,
  neighborhoodCommonsMaintenanceBands: NEIGHBORHOOD_COMMONS.maintenance.integrityBands.length,
  neighborhoodCommonsMaintenanceRoutes: NEIGHBORHOOD_COMMONS.maintenance.routes.length,
  neighborhoodCommonsMaintenanceIntervalDays: NEIGHBORHOOD_COMMONS.maintenance.intervalDays,
  neighborhoodCommonsGovernanceModels: NEIGHBORHOOD_COMMONS.maintenance.governance.models.length,
  neighborhoodCommonsFaults: NEIGHBORHOOD_COMMONS.maintenance.faults.length
});
