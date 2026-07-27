'use strict';

const { TICK_RATE } = require('../shared/constants');
const { summarizeAmmo } = require('./inventory-system');
const { missionLabel } = require('./mission-system');
const { safeZoneForPosition } = require('./world-state');
const { publicGroupSaveComputer } = require('./group-save-system');

function publicActor(actor, world) {
  const {
    input, inputHeld, pendingPulses, adapterId, actionHeld, aiPath, aiPathTargetKey, aiRepathAtTick,
    healthRegenAccumulator, regeneration, ...safe
  } = actor;
  const safeZone = safeZoneForPosition(world, actor.position);
  const publicRegeneration = regeneration ? {
    insideBase: regeneration.insideBase === true,
    baseZoneId: regeneration.baseZoneId || null,
    healthPerSecond: Number(regeneration.healthPerSecond) || 0,
    shieldPerSecond: 0,
  } : undefined;
  return {
    ...safe,
    personalFundCents: safe.walletCents,
    ammoSummary: summarizeAmmo(actor.inventory),
    regeneration: publicRegeneration,
    inSafeZone: Boolean(safeZone),
    safeZoneId: safeZone?.id || null,
  };
}

function territoryMissionSnapshot(world, requestedParty) {
  const territory = world.territory;
  const score = requestedParty === 'all'
    ? Math.max(territory.scores.party_a, territory.scores.party_b)
    : territory.scores[requestedParty] || 0;
  const ownedZones = territory.zones.reduce((counts, zone) => {
    if (zone.ownerPartyId) counts[zone.ownerPartyId] += 1;
    return counts;
  }, { party_a: 0, party_b: 0 });
  const winnerPartyId = territory.result?.winnerPartyId || null;
  const perspectiveSuccess = requestedParty === 'all'
    ? winnerPartyId !== null
    : winnerPartyId === requestedParty;
  const result = territory.result ? {
    ...territory.result,
    success: perspectiveSuccess,
    rewardCents: 0,
    personalRewardCents: 0,
    partyContributionCents: 0,
    rewardSplit: { personalPercent: 40, partyPercent: 60 },
    partyFundTotals: { ...world.economy.partyFunds },
  } : null;
  return {
    ...world.mission,
    mode: 'district_dominion',
    title: territory.title,
    status: territory.status,
    phase: territory.status,
    startedAtTick: territory.startedAtTick,
    endsAtTick: territory.endsAtTick,
    goal: territory.scoreGoal,
    deliveredCount: score,
    partyScores: { ...territory.scores },
    winnerPartyId,
    ownedZones,
    zones: territory.zones,
    reinforcement: territory.reinforcement,
    reinforcementsPurchased: territory.reinforcementsPurchased,
    result,
    board: { options: [], selectedIndex: 0 },
  };
}

function serializeWorldState(session, requestedParty = 'all') {
  const world = session.world;
  const mapToggleByParty = world.presentation?.mapToggleSequence || {};
  const mapToggleSequence = requestedParty === 'all'
    ? Object.values(mapToggleByParty).reduce((sum, value) => sum + (Number(value) || 0), 0)
    : Number(mapToggleByParty[requestedParty]) || 0;
  const sourceMission = world.territory?.enabled
    ? territoryMissionSnapshot(world, requestedParty)
    : world.mission;
  const score = requestedParty === 'all'
    ? (sourceMission.mode === 'district_dominion'
      ? Math.max(...Object.values(sourceMission.partyScores))
      : Object.values(sourceMission.partyScores).reduce((sum, value) => sum + value, 0))
    : (sourceMission.partyScores[requestedParty] || 0);
  const deliveries = sourceMission.deliveredCount || 0;
  const remainingSeconds = Number.isFinite(sourceMission.endsAtTick)
    ? Math.max(0, (sourceMission.endsAtTick - world.tick) / TICK_RATE)
    : sourceMission.status === 'countdown'
      ? Math.max(0, (sourceMission.countdownEndsAtTick - world.tick) / TICK_RATE)
      : 0;
  const progress = sourceMission.mode === 'hold_relay'
    ? (sourceMission.wavesCompleted || 0)
    : sourceMission.mode === 'chaos_call'
      ? Math.max(0, Math.floor((world.tick - (sourceMission.startedAtTick || world.tick)) / TICK_RATE))
      : deliveries;
  const selectedOption = sourceMission.board?.options?.[sourceMission.board.selectedIndex || 0] || null;
  const layoutPrefix = sourceMission.layout?.label ? `${sourceMission.layout.label} · ` : '';
  const hints = {
    base: 'Party House · walk to the mission board and press ACTION',
    board: `Mission board · ${missionLabel(selectedOption)} · move up/down, ACTION to choose`,
    countdown: `${world.mission.title} starts in ${Math.ceil(remainingSeconds)} · leader ACTION cancels`,
    results: 'Results break · no time limit · move up/down and press ACTION when ready',
  };
  const activeHint = sourceMission.mode === 'district_dominion'
    ? `Hold districts · A ${sourceMission.partyScores.party_a} — B ${sourceMission.partyScores.party_b} · ACTION at your command post hires a crew squad`
    : sourceMission.mode === 'supply_sweep'
      ? `${layoutPrefix}Collect supplies · ${deliveries}/${sourceMission.goal}${sourceMission.guardCount ? ` · ${sourceMission.guardCount} rival lookout${sourceMission.guardCount === 1 ? '' : 's'}` : ''}`
      : sourceMission.mode === 'hold_relay'
        ? `${layoutPrefix}Defend relay ${sourceMission.relay?.health ?? 0}/${sourceMission.relay?.maxHealth ?? 0} · wave ${sourceMission.wave || 0}/${sourceMission.goal}`
        : sourceMission.mode === 'chaos_call'
        ? `${layoutPrefix}Justice response: ${world.justice.stage.toUpperCase()} · survive until the timer ends`
          : `${layoutPrefix}Collect at dispatch · ${deliveries}/${sourceMission.goal} delivered · ${sourceMission.deliveryZones?.length || 0} active drops`;
  const mission = {
    ...sourceMission,
    phase: sourceMission.status,
    deliveries: progress,
    deliveryGoal: world.mission.goal,
    partyScore: score,
    score,
    timeRemaining: remainingSeconds,
    remainingSeconds,
    hint: hints[sourceMission.status] || activeHint,
    menuOptions: (sourceMission.board?.options || []).map((id, index) => ({
      id,
      label: `${missionLabel(id)}${(sourceMission.board?.layoutCounts?.[id] || 0) > 1 ? ` · ${sourceMission.board.layoutCounts[id]} locations` : ''}`,
      selected: index === sourceMission.board.selectedIndex,
    })),
  };
  const state = {
    actors: Object.values(world.actors).map((actor) => publicActor(actor, world)),
    npcs: Object.values(world.npcs),
    vehicles: Object.values(world.vehicles),
    projectiles: Object.values(world.projectiles),
    mission,
    economy: {
      rewardSplit: { ...world.economy.rewardSplit },
      partyFunds: { ...world.economy.partyFunds },
      lifetimePartyIncome: { ...world.economy.lifetimePartyIncome },
    },
    effects: world.effects.map((effect) => ({ ...effect, type: effect.type || effect.kind })),
    combatRules: world.combatRules,
    justice: world.justice,
    rivalGang: world.rivalGang,
    groupSaveComputer: publicGroupSaveComputer(world.groupSaveComputer),
    loadedGroupSave: world.loadedGroupSave ? { ...world.loadedGroupSave, seatSlots: [...world.loadedGroupSave.seatSlots] } : null,
    territory: world.territory,
    presentation: { mapToggleSequence },
    tetherRules: world.tetherRules,
    metrics: {
      ...world.metrics,
      activeActors: Object.keys(world.actors).length,
      aiCount: Object.keys(world.npcs).length + Object.values(world.actors).filter((actor) => actor.controller === 'ai').length,
      adapterSeatCount: Object.values(world.actors).filter((actor) => actor.controller === 'adapter').length,
      civilianCount: Object.values(world.npcs).filter((npc) => npc.kind === 'civilian').length,
      rivalCount: Object.values(world.npcs).filter((npc) => npc.kind === 'rival').length,
      justiceCount: Object.values(world.npcs).filter((npc) => npc.kind === 'cop').length,
      projectileCount: Object.keys(world.projectiles).length,
      vehicleCount: Object.keys(world.vehicles).length,
    },
    requestedParty,
  };
  const payload = {
    ok: true,
    serverTime: Date.now(),
    tick: world.tick,
    sessionId: session.id,
    roomCode: session.roomCode,
    status: session.status,
    world: state,
  };
  world.metrics.statePayloadBytes = Buffer.byteLength(JSON.stringify(payload));
  state.metrics.statePayloadBytes = world.metrics.statePayloadBytes;
  return payload;
}

function serializeStaticWorld(session) {
  const staticMap = session.world.staticMap;
  return {
    ok: true,
    sessionId: session.id,
    roomCode: session.roomCode,
    map: {
      id: staticMap.id,
      width: staticMap.width,
      height: staticMap.height,
      tileSize: staticMap.tileSize,
      chunking: staticMap.chunking,
      source: staticMap.source,
    },
    mapUrl: staticMap.clientMapUrl || '/data/map.json',
    cityArtUrl: staticMap.clientCityArtUrl || '/data/city-art.json',
    mapId: staticMap.mapSelectionId || staticMap.clientMapId || staticMap.id,
    mapName: staticMap.mapDisplayName || staticMap.id,
    tickRate: 30,
    activePlayerTarget: Object.keys(session.world.actors).length,
    maximumPlayerCapacity: 8,
    reservedSeatCapacity: 8,
  };
}

module.exports = { publicActor, serializeStaticWorld, serializeWorldState };
