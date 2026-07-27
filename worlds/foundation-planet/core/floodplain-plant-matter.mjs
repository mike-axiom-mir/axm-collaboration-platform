import {
  FLOODPLAIN_SUCCESSION_GUILDS,
  FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA
} from './floodplain-succession.mjs';

export const FLOODPLAIN_PLANT_MATTER_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-plant-matter-state/v1';
export const FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-plant-matter-receipt/v1';
export const FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA =
  'axm.foundation-planet.floodplain-plant-detritus-matter-debit/v1';

const GUILD_MATTER_TRAITS = Object.freeze({
  aquaticPioneers: Object.freeze({
    matureCarbonKgCm2: .24, juvenileDensityFraction: .16,
    liveCarbonNitrogenRatio: 22, standingToLitterRateDay: .018
  }),
  mudflatAnnuals: Object.freeze({
    matureCarbonKgCm2: .13, juvenileDensityFraction: .14,
    liveCarbonNitrogenRatio: 28, standingToLitterRateDay: .028
  }),
  reedSedge: Object.freeze({
    matureCarbonKgCm2: 1.65, juvenileDensityFraction: .2,
    liveCarbonNitrogenRatio: 35, standingToLitterRateDay: .007
  }),
  wetMeadow: Object.freeze({
    matureCarbonKgCm2: .78, juvenileDensityFraction: .18,
    liveCarbonNitrogenRatio: 32, standingToLitterRateDay: .011
  }),
  riparianWoodland: Object.freeze({
    matureCarbonKgCm2: 10.5, juvenileDensityFraction: .12,
    liveCarbonNitrogenRatio: 45, standingToLitterRateDay: .0014
  })
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

function stableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function elements(source = {}) {
  return {
    carbonKgC: Math.max(0, finite(source.carbonKgC)),
    nitrogenKgN: Math.max(0, finite(source.nitrogenKgN))
  };
}

function addElements(...sources) {
  return sources.reduce((total, source) => ({
    carbonKgC: total.carbonKgC + Math.max(0, finite(source?.carbonKgC)),
    nitrogenKgN: total.nitrogenKgN +
      Math.max(0, finite(source?.nitrogenKgN))
  }), { carbonKgC: 0, nitrogenKgN: 0 });
}

function roundedElements(source = {}, digits = 9) {
  return Object.fromEntries(Object.entries(elements(source)).map(
    ([key, value]) => [key, round(value, digits)]));
}

function truth() {
  return {
    persistentFloodplainPlantCarbonAndNitrogen: true,
    pairedLandEcologySubgridPartitionRequired: true,
    independentBoundaryCreation: false,
    plantPhosphorusOwnership: false,
    plantWaterOwnership: false,
    decompositionAndRespirationCoupling: false,
    detritalDecompositionSenderDebitAvailable: true,
    atmosphericRespirationCoupling: false,
    speciesOccupancyState: false,
    resolvedPlantIndividuals: false,
    mechanisticPlantBiochemistry: false,
    scientificBiomassModel: false
  };
}

function emptyGuildState(id) {
  return {
    id,
    legacyUnmaterializedCover: {
      juvenileCoverFraction: 0,
      matureCoverFraction: 0
    },
    live: elements(),
    standingDead: elements(),
    litter: elements(),
    cumulativeLandEcologyCredits: elements(),
    cumulativeMortalityToStandingDead: elements(),
    cumulativeStandingDeadToLitter: elements(),
    cumulativeDetritusDecompositionDebits: elements()
  };
}

function normalizeGuildState(source, id) {
  const state = emptyGuildState(id);
  if (!source || source.id !== id) return state;
  state.legacyUnmaterializedCover = {
    juvenileCoverFraction: clamp(finite(
      source.legacyUnmaterializedCover?.juvenileCoverFraction)),
    matureCoverFraction: clamp(finite(
      source.legacyUnmaterializedCover?.matureCoverFraction))
  };
  for (const key of [
    'live', 'standingDead', 'litter', 'cumulativeLandEcologyCredits',
    'cumulativeMortalityToStandingDead',
    'cumulativeStandingDeadToLitter',
    'cumulativeDetritusDecompositionDebits'
  ]) state[key] = elements(source[key]);
  return state;
}

export function emptyFloodplainPlantMatterState(options = {}) {
  return {
    schema: FLOODPLAIN_PLANT_MATTER_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    observedMaterialDays: 0,
    dormantDays: 0,
    guilds: Object.fromEntries(FLOODPLAIN_SUCCESSION_GUILDS.map(id =>
      [id, emptyGuildState(id)])),
    lastSuccessionReceiptDigest: null,
    lastLandEcologySenderReceiptDigest: null,
    lastDetritusDebitReceipt: null,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainPlantMatterState(source, options = {}) {
  const state = emptyFloodplainPlantMatterState(options);
  if (source?.schema !== FLOODPLAIN_PLANT_MATTER_STATE_SCHEMA) return state;
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  state.observedMaterialDays = Math.max(0,
    finite(source.observedMaterialDays));
  state.dormantDays = Math.max(0, finite(source.dormantDays));
  state.guilds = Object.fromEntries(FLOODPLAIN_SUCCESSION_GUILDS.map(id =>
    [id, normalizeGuildState(source.guilds?.[id], id)]));
  state.lastSuccessionReceiptDigest = typeof source.lastSuccessionReceiptDigest ===
    'string' ? source.lastSuccessionReceiptDigest : null;
  state.lastLandEcologySenderReceiptDigest =
    typeof source.lastLandEcologySenderReceiptDigest === 'string'
      ? source.lastLandEcologySenderReceiptDigest : null;
  state.lastDetritusDebitReceipt = source.lastDetritusDebitReceipt?.schema ===
    FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA
    ? clone(source.lastDetritusDebitReceipt) : null;
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

function stateTotals(source) {
  const state = normalizeFloodplainPlantMatterState(source);
  const totals = {
    live: elements(), standingDead: elements(), litter: elements(),
    legacyUnmaterializedCoverFraction: 0
  };
  for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
    const guild = state.guilds[id];
    totals.live = addElements(totals.live, guild.live);
    totals.standingDead = addElements(totals.standingDead,
      guild.standingDead);
    totals.litter = addElements(totals.litter, guild.litter);
    totals.legacyUnmaterializedCoverFraction +=
      guild.legacyUnmaterializedCover.juvenileCoverFraction +
      guild.legacyUnmaterializedCover.matureCoverFraction;
  }
  totals.all = addElements(totals.live, totals.standingDead, totals.litter);
  return totals;
}

export function floodplainPlantMatterSummary(source) {
  const state = normalizeFloodplainPlantMatterState(source);
  const totals = stateTotals(state);
  const guilds = Object.fromEntries(FLOODPLAIN_SUCCESSION_GUILDS.map(id => {
    const guild = state.guilds[id];
    return [id, {
      live: roundedElements(guild.live),
      standingDead: roundedElements(guild.standingDead),
      litter: roundedElements(guild.litter),
      total: roundedElements(addElements(guild.live, guild.standingDead,
        guild.litter)),
      legacyUnmaterializedCoverFraction: round(
        guild.legacyUnmaterializedCover.juvenileCoverFraction +
        guild.legacyUnmaterializedCover.matureCoverFraction, 12)
    }];
  }));
  const dominantGuild = totals.live.carbonKgC > 1e-12
    ? FLOODPLAIN_SUCCESSION_GUILDS.reduce((best, id) =>
      state.guilds[id].live.carbonKgC > state.guilds[best].live.carbonKgC
        ? id : best, FLOODPLAIN_SUCCESSION_GUILDS[0])
    : 'unmaterialized';
  return {
    observedMaterialDays: round(state.observedMaterialDays, 8),
    dormantDays: round(state.dormantDays, 8),
    live: roundedElements(totals.live),
    standingDead: roundedElements(totals.standingDead),
    litter: roundedElements(totals.litter),
    total: roundedElements(totals.all),
    legacyUnmaterializedCoverFraction: round(
      totals.legacyUnmaterializedCoverFraction, 12),
    dominantGuild,
    guilds,
    truth: truth()
  };
}

function afterCommunity(receipt) {
  if (receipt?.schema !== FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA ||
    !receipt.community?.after?.guilds) {
    throw new TypeError('Floodplain plant matter requires the current succession transition receipt');
  }
  return receipt.community.after;
}

function targetForGuild(stateGuild, communityGuild, areaM2, id) {
  const traits = GUILD_MATTER_TRAITS[id];
  const juvenileCover = clamp(finite(
    communityGuild?.juvenileCoverFraction));
  const matureCover = clamp(finite(
    communityGuild?.matureCoverFraction));
  const baseline = {
    juvenileCoverFraction: Math.min(juvenileCover,
      stateGuild.legacyUnmaterializedCover.juvenileCoverFraction),
    matureCoverFraction: Math.min(matureCover,
      stateGuild.legacyUnmaterializedCover.matureCoverFraction)
  };
  const materializedJuvenile = Math.max(0,
    juvenileCover - baseline.juvenileCoverFraction);
  const materializedMature = Math.max(0,
    matureCover - baseline.matureCoverFraction);
  const carbonKgC = areaM2 * traits.matureCarbonKgCm2 *
    (materializedMature + materializedJuvenile *
      traits.juvenileDensityFraction);
  return {
    baseline,
    materializedCoverFraction: materializedJuvenile + materializedMature,
    live: {
      carbonKgC,
      nitrogenKgN: carbonKgC / traits.liveCarbonNitrogenRatio
    }
  };
}

export function floodplainPlantMatterDemand(source, successionReceipt,
  areaM2) {
  const state = normalizeFloodplainPlantMatterState(source);
  const community = afterCommunity(successionReceipt);
  const boundedAreaM2 = Math.max(1, finite(areaM2, 1));
  const perGuild = {};
  let totals = elements();
  for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
    const target = targetForGuild(state.guilds[id], community.guilds[id],
      boundedAreaM2, id);
    const demand = {
      carbonKgC: state.migrationCheckpoint ||
        successionReceipt.status === 'life-disabled-dormant' ? 0 :
        Math.max(0, target.live.carbonKgC -
          state.guilds[id].live.carbonKgC),
      nitrogenKgN: state.migrationCheckpoint ||
        successionReceipt.status === 'life-disabled-dormant' ? 0 :
        Math.max(0, target.live.nitrogenKgN -
          state.guilds[id].live.nitrogenKgN)
    };
    perGuild[id] = {
      targetLive: roundedElements(target.live),
      materializedCoverFraction: round(target.materializedCoverFraction, 12),
      legacyBaselineAfter: clone(target.baseline),
      demand: roundedElements(demand)
    };
    totals = addElements(totals, demand);
  }
  return {
    areaM2: round(boundedAreaM2, 3),
    perGuild,
    totals: roundedElements(totals)
  };
}

function makeReceipt(state, successionReceipt, context, status, areaM2,
  before, after, flows, credit) {
  const maximumResidual = Math.max(0, ...flows.flatMap(flow => [
    Math.abs(flow.closure.carbonResidualKgC),
    Math.abs(flow.closure.nitrogenResidualKgN)
  ]));
  const credited = addElements(...flows.map(flow => flow.landEcologyCredit));
  const receipt = {
    schema: FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
    transitionId: String(context.transitionId ||
      `floodplain-plant-matter:${stableDigest({
        reachId: context.reachId || null,
        startDay: round(context.startDay, 8),
        successionDigest: successionReceipt.digest,
        senderDigest: credit?.senderReceiptDigest || null
      }).slice(9)}`),
    reachId: context.reachId || null,
    status,
    startDay: round(context.startDay, 8),
    durationDays: round(context.durationDays, 8),
    floodplainAreaM2: round(areaM2, 3),
    floodplainSuccessionReceiptDigest: successionReceipt.digest,
    landEcologySenderReceiptDigest: credit?.senderReceiptDigest || null,
    donorCellId: credit?.donorCellId || null,
    transferIds: flows.map(flow => flow.transferId).filter(Boolean).sort(),
    before: clone(before),
    after: clone(after),
    guildFlows: clone(flows),
    transfers: {
      landEcologyCredits: roundedElements(credited),
      liveToStandingDead: roundedElements(addElements(...flows.map(flow =>
        flow.liveToStandingDead))),
      standingDeadToLitter: roundedElements(addElements(...flows.map(flow =>
        flow.standingDeadToLitter)))
    },
    closure: {
      maximumElementResidualKg: round(maximumResidual, 12),
      carbonResidualKgC: round(after.total.carbonKgC -
        before.total.carbonKgC - credited.carbonKgC, 12),
      nitrogenResidualKgN: round(after.total.nitrogenKgN -
        before.total.nitrogenKgN - credited.nitrogenKgN, 12)
    },
    truth: {
      ...truth(),
      successionEvidenceBound: typeof successionReceipt.digest === 'string',
      landEcologySenderDebited: credited.carbonKgC <= 1e-12 &&
        credited.nitrogenKgN <= 1e-12
        ? true : typeof credit?.senderReceiptDigest === 'string',
      pairedTransferIds: flows.every(flow =>
        flow.landEcologyCredit.carbonKgC <= 1e-12 &&
          flow.landEcologyCredit.nitrogenKgN <= 1e-12 ||
          typeof flow.transferId === 'string'),
      carbonAndNitrogenClosed: maximumResidual < 1e-7 &&
        Math.abs(after.total.carbonKgC - before.total.carbonKgC -
          credited.carbonKgC) < 1e-7 &&
        Math.abs(after.total.nitrogenKgN - before.total.nitrogenKgN -
          credited.nitrogenKgN) < 1e-7,
      migrationInventedMaterial: false,
      materialPoolsFrozen: status === 'life-disabled-dormant'
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  state.lastSuccessionReceiptDigest = successionReceipt.digest;
  state.lastLandEcologySenderReceiptDigest =
    receipt.landEcologySenderReceiptDigest;
  return receipt;
}

export function advanceFloodplainPlantMatter(source, successionReceipt,
  credit = {}, context = {}) {
  const durationDays = finite(context.durationDays, 1);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Floodplain plant matter step must be greater than zero and no longer than one day');
  }
  const state = normalizeFloodplainPlantMatterState(source);
  const community = afterCommunity(successionReceipt);
  const areaM2 = Math.max(1, finite(context.areaM2, 1));
  const before = floodplainPlantMatterSummary(state);

  if (state.migrationCheckpoint) {
    for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
      state.guilds[id].legacyUnmaterializedCover = {
        juvenileCoverFraction: clamp(finite(
          community.guilds[id]?.juvenileCoverFraction)),
        matureCoverFraction: clamp(finite(
          community.guilds[id]?.matureCoverFraction))
      };
    }
    state.migrationCheckpoint = false;
    const flows = FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
      guildId: id, transferId: null,
      landEcologyCredit: elements(), liveToStandingDead: elements(),
      standingDeadToLitter: elements(),
      after: {
        live: elements(), standingDead: elements(), litter: elements(),
        legacyBaseline: clone(state.guilds[id].legacyUnmaterializedCover)
      },
      closure: { carbonResidualKgC: 0, nitrogenResidualKgN: 0 }
    }));
    const after = floodplainPlantMatterSummary(state);
    const receipt = makeReceipt(state, successionReceipt, context,
      'initialized-after-migration-no-invented-material', areaM2,
      before, after, flows, {});
    return { state: normalizeFloodplainPlantMatterState(state),
      receipt: clone(receipt) };
  }

  if (successionReceipt.status === 'life-disabled-dormant') {
    state.dormantDays += durationDays;
    const flows = FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
      guildId: id, transferId: null,
      landEcologyCredit: elements(), liveToStandingDead: elements(),
      standingDeadToLitter: elements(),
      after: {
        live: clone(state.guilds[id].live),
        standingDead: clone(state.guilds[id].standingDead),
        litter: clone(state.guilds[id].litter),
        legacyBaseline: clone(state.guilds[id].legacyUnmaterializedCover)
      },
      closure: { carbonResidualKgC: 0, nitrogenResidualKgN: 0 }
    }));
    const after = floodplainPlantMatterSummary(state);
    const receipt = makeReceipt(state, successionReceipt, context,
      'life-disabled-dormant', areaM2, before, after, flows, {});
    return { state: normalizeFloodplainPlantMatterState(state),
      receipt: clone(receipt) };
  }

  const demand = floodplainPlantMatterDemand(state, successionReceipt,
    areaM2);
  const supplied = elements(credit.totals);
  if (Math.abs(supplied.carbonKgC - demand.totals.carbonKgC) > 1e-6 ||
    Math.abs(supplied.nitrogenKgN - demand.totals.nitrogenKgN) > 1e-6) {
    throw new Error('Floodplain plant matter credit does not match material demand');
  }
  const flows = [];
  for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
    const guild = state.guilds[id];
    const beforeGuild = clone(guild);
    const planned = demand.perGuild[id];
    const guildCredit = elements(credit.perGuild?.[id]);
    if (Math.abs(guildCredit.carbonKgC -
        planned.demand.carbonKgC) > 1e-6 ||
      Math.abs(guildCredit.nitrogenKgN -
        planned.demand.nitrogenKgN) > 1e-6) {
      throw new Error(`Floodplain plant matter guild credit mismatch: ${id}`);
    }
    const liveToStandingDead = {
      carbonKgC: Math.max(0, guild.live.carbonKgC -
        planned.targetLive.carbonKgC),
      nitrogenKgN: Math.max(0, guild.live.nitrogenKgN -
        planned.targetLive.nitrogenKgN)
    };
    const fallFraction = 1 - Math.exp(-GUILD_MATTER_TRAITS[id]
      .standingToLitterRateDay * durationDays);
    const standingDeadToLitter = {
      carbonKgC: guild.standingDead.carbonKgC * fallFraction,
      nitrogenKgN: guild.standingDead.nitrogenKgN * fallFraction
    };
    guild.live = elements(planned.targetLive);
    guild.standingDead = addElements({
      carbonKgC: Math.max(0, beforeGuild.standingDead.carbonKgC -
        standingDeadToLitter.carbonKgC),
      nitrogenKgN: Math.max(0, beforeGuild.standingDead.nitrogenKgN -
        standingDeadToLitter.nitrogenKgN)
    }, liveToStandingDead);
    guild.litter = addElements(beforeGuild.litter,
      standingDeadToLitter);
    guild.legacyUnmaterializedCover = clone(
      planned.legacyBaselineAfter);
    guild.cumulativeLandEcologyCredits = addElements(
      guild.cumulativeLandEcologyCredits, guildCredit);
    guild.cumulativeMortalityToStandingDead = addElements(
      guild.cumulativeMortalityToStandingDead, liveToStandingDead);
    guild.cumulativeStandingDeadToLitter = addElements(
      guild.cumulativeStandingDeadToLitter, standingDeadToLitter);
    const beforeTotal = addElements(beforeGuild.live,
      beforeGuild.standingDead, beforeGuild.litter);
    const afterTotal = addElements(guild.live, guild.standingDead,
      guild.litter);
    flows.push({
      guildId: id,
      transferId: credit.transferIds?.[id] || null,
      before: {
        live: roundedElements(beforeGuild.live),
        standingDead: roundedElements(beforeGuild.standingDead),
        litter: roundedElements(beforeGuild.litter),
        legacyBaseline: clone(beforeGuild.legacyUnmaterializedCover)
      },
      targetLive: roundedElements(planned.targetLive),
      materializedCoverFraction: planned.materializedCoverFraction,
      landEcologyCredit: roundedElements(guildCredit),
      liveToStandingDead: roundedElements(liveToStandingDead),
      standingDeadToLitter: roundedElements(standingDeadToLitter),
      after: {
        live: roundedElements(guild.live),
        standingDead: roundedElements(guild.standingDead),
        litter: roundedElements(guild.litter),
        legacyBaseline: clone(guild.legacyUnmaterializedCover)
      },
      closure: {
        carbonResidualKgC: round(afterTotal.carbonKgC -
          beforeTotal.carbonKgC - guildCredit.carbonKgC, 12),
        nitrogenResidualKgN: round(afterTotal.nitrogenKgN -
          beforeTotal.nitrogenKgN - guildCredit.nitrogenKgN, 12)
      }
    });
  }
  state.observedMaterialDays += durationDays;
  const after = floodplainPlantMatterSummary(state);
  const status = demand.totals.carbonKgC > 1e-12 ||
    demand.totals.nitrogenKgN > 1e-12
    ? 'land-biomass-partition-credited' :
    flows.some(flow => flow.liveToStandingDead.carbonKgC > 1e-12)
      ? 'mortality-transferred-to-detritus' : 'plant-matter-maintained';
  const receipt = makeReceipt(state, successionReceipt, context, status,
    areaM2, before, after, flows, credit);
  return { state: normalizeFloodplainPlantMatterState(state),
    receipt: clone(receipt) };
}

function normalizedDetritusMatterAllocations(allocations = []) {
  const normalized = [...allocations].map(entry => ({
    transferId: String(entry?.transferId || ''),
    guildId: String(entry?.guildId || ''),
    pool: String(entry?.pool || ''),
    carbonKgC: Math.max(0, finite(entry?.carbonKgC)),
    nitrogenKgN: Math.max(0, finite(entry?.nitrogenKgN))
  })).sort((a, b) => a.transferId.localeCompare(b.transferId));
  if (normalized.some(entry => !entry.transferId ||
      !FLOODPLAIN_SUCCESSION_GUILDS.includes(entry.guildId) ||
      !['standingDead', 'litter'].includes(entry.pool)) ||
    new Set(normalized.map(entry => entry.transferId)).size !==
      normalized.length) {
    throw new Error('Plant detritus matter debit requires unique bound guild-pool transfers');
  }
  return normalized;
}

export function applyFloodplainPlantDetritusMatterDebit(source,
  allocations = [], context = {}) {
  const state = normalizeFloodplainPlantMatterState(source);
  const reachId = String(context.reachId || '');
  if (!reachId) throw new Error('Plant detritus matter debit requires a reach ID');
  const entries = normalizedDetritusMatterAllocations(allocations);
  if (context.livingEnabled === false && entries.some(entry =>
    entry.carbonKgC > 1e-12 || entry.nitrogenKgN > 1e-12)) {
    throw new Error('Life-off cannot debit plant detritus matter');
  }
  const before = floodplainPlantMatterSummary(state);
  const flows = [];
  for (const entry of entries) {
    const guild = state.guilds[entry.guildId];
    const pool = elements(guild[entry.pool]);
    if (entry.carbonKgC > pool.carbonKgC + 1e-7 ||
      entry.nitrogenKgN > pool.nitrogenKgN + 1e-7) {
      throw new Error(`Plant detritus matter donor exhausted: ${entry.guildId}/${entry.pool}`);
    }
    guild[entry.pool] = elements({
      carbonKgC: pool.carbonKgC - entry.carbonKgC,
      nitrogenKgN: pool.nitrogenKgN - entry.nitrogenKgN
    });
    guild.cumulativeDetritusDecompositionDebits = addElements(
      guild.cumulativeDetritusDecompositionDebits, entry);
    flows.push({
      ...entry,
      carbonKgC: round(entry.carbonKgC, 9),
      nitrogenKgN: round(entry.nitrogenKgN, 9),
      before: roundedElements(pool),
      after: roundedElements(guild[entry.pool]),
      closure: {
        carbonResidualKgC: round(pool.carbonKgC - entry.carbonKgC -
          guild[entry.pool].carbonKgC, 12),
        nitrogenResidualKgN: round(pool.nitrogenKgN - entry.nitrogenKgN -
          guild[entry.pool].nitrogenKgN, 12)
      }
    });
  }
  const debited = addElements(...entries);
  const after = floodplainPlantMatterSummary(state);
  const receipt = {
    schema: FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA,
    reachId,
    startDay: round(context.startDay, 8),
    durationDays: round(finite(context.durationDays, 1), 8),
    allocations: flows,
    before,
    debited: roundedElements(debited),
    after,
    closure: {
      carbonResidualKgC: round(before.total.carbonKgC -
        debited.carbonKgC - after.total.carbonKgC, 12),
      nitrogenResidualKgN: round(before.total.nitrogenKgN -
        debited.nitrogenKgN - after.total.nitrogenKgN, 12)
    },
    truth: {
      persistentPlantMatterSenderDebited: true,
      standingDeadAndLitterOnly: true,
      exactPerGuildPoolTransferIds: true,
      carbonAndNitrogenClosed:
        Math.abs(before.total.carbonKgC - debited.carbonKgC -
          after.total.carbonKgC) < 1e-7 &&
        Math.abs(before.total.nitrogenKgN - debited.nitrogenKgN -
          after.total.nitrogenKgN) < 1e-7,
      decompositionCreatesMatter: false,
      lifeOffFrozen: context.livingEnabled === false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastDetritusDebitReceipt = clone(receipt);
  return { state: normalizeFloodplainPlantMatterState(state),
    receipt: clone(receipt) };
}

export function floodplainPlantMatterDescription() {
  return {
    stateSchema: FLOODPLAIN_PLANT_MATTER_STATE_SCHEMA,
    transitionReceiptSchema: FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
    detritusDebitReceiptSchema:
      FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA,
    senderContract: 'axm.foundation-planet.land-ecology-subgrid-biomass-debit/v1',
    guilds: FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
      id, ...GUILD_MATTER_TRAITS[id]
    })),
    pools: ['live-carbon-and-nitrogen',
      'standing-dead-carbon-and-nitrogen',
      'litter-carbon-and-nitrogen'],
    processes: ['paired-land-ecology-subgrid-partition',
      'cover-density-material-target', 'mortality-to-standing-dead',
      'standing-dead-to-litter',
      'paired-detritus-decomposition-sender-debit', 'Life-off-freeze'],
    maximumStepDays: 1,
    truth: truth()
  };
}
