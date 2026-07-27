import {
  FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
  FLOODPLAIN_HABITAT_STATE_SCHEMA,
  floodplainHabitatSummary,
  normalizeFloodplainHabitatState
} from './floodplain-habitat.mjs';
import {
  FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA
} from './flood-event-history.mjs';

export const FLOODPLAIN_SUCCESSION_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-succession-state/v1';
export const FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-succession-receipt/v1';
export const FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER = .98;

export const FLOODPLAIN_SUCCESSION_GUILDS = Object.freeze([
  'aquaticPioneers', 'mudflatAnnuals', 'reedSedge',
  'wetMeadow', 'riparianWoodland'
]);

const GUILD_TRAITS = Object.freeze({
  aquaticPioneers: Object.freeze({
    habitat: 'openWater', successionWeight: .08, floodTolerance: .96,
    recoveryAffinity: .72, seedLongevityDays: 110,
    germinationRate: .12, maturationRate: .018,
    juvenileMortalityRate: .006, matureMortalityRate: .0025,
    fecunditySeedsM2: 22, externalSeedRainSeedsM2: 1.8,
    recruitmentCoverPerSeed: .00072
  }),
  mudflatAnnuals: Object.freeze({
    habitat: 'mudflat', successionWeight: .2, floodTolerance: .58,
    recoveryAffinity: 1, seedLongevityDays: 420,
    germinationRate: .16, maturationRate: .032,
    juvenileMortalityRate: .008, matureMortalityRate: .005,
    fecunditySeedsM2: 38, externalSeedRainSeedsM2: 2.4,
    recruitmentCoverPerSeed: .00066
  }),
  reedSedge: Object.freeze({
    habitat: 'reedSedge', successionWeight: .48, floodTolerance: .9,
    recoveryAffinity: .78, seedLongevityDays: 310,
    germinationRate: .09, maturationRate: .014,
    juvenileMortalityRate: .004, matureMortalityRate: .0015,
    fecunditySeedsM2: 17, externalSeedRainSeedsM2: 1.25,
    recruitmentCoverPerSeed: .00054
  }),
  wetMeadow: Object.freeze({
    habitat: 'wetMeadow', successionWeight: .68, floodTolerance: .5,
    recoveryAffinity: .52, seedLongevityDays: 520,
    germinationRate: .075, maturationRate: .01,
    juvenileMortalityRate: .0035, matureMortalityRate: .0012,
    fecunditySeedsM2: 13, externalSeedRainSeedsM2: 1.05,
    recruitmentCoverPerSeed: .00046
  }),
  riparianWoodland: Object.freeze({
    habitat: 'riparianWoodland', successionWeight: 1,
    floodTolerance: .34, recoveryAffinity: .3,
    seedLongevityDays: 180, germinationRate: .034,
    maturationRate: .0022, juvenileMortalityRate: .002,
    matureMortalityRate: .00045, fecunditySeedsM2: 5.5,
    externalSeedRainSeedsM2: .42, recruitmentCoverPerSeed: .00024
  })
});

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
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

function truth() {
  return {
    persistentFunctionalGuildSuccession: true,
    ecologicalCommunityState: true,
    finiteSeedBankAndCoverLedgers: true,
    parameterizedExternalSeedRainBoundary: true,
    habitatEvidenceBound: true,
    floodEventEvidenceBound: true,
    materialAuthority: false,
    plantBiomassMaterialOwnership: false,
    speciesOccupancyState: false,
    resolvedPlantIndividuals: false,
    mechanisticPlantBiochemistry: false,
    scientificSuccessionModel: false
  };
}

function emptyGuildState(id) {
  return {
    id,
    seedBankSeedsM2: 0,
    juvenileCoverFraction: 0,
    matureCoverFraction: 0,
    cumulativeLocalSeedProductionSeedsM2: 0,
    cumulativeExternalSeedRainSeedsM2: 0,
    cumulativeGerminatedSeedsM2: 0,
    cumulativeDecayedSeedsM2: 0,
    cumulativeRecruitmentCover: 0,
    cumulativeMaturedCover: 0,
    cumulativeJuvenileMortalityCover: 0,
    cumulativeMatureMortalityCover: 0,
    cumulativeCompetitionLossCover: 0
  };
}

function normalizeGuildState(source, id) {
  const state = emptyGuildState(id);
  if (!source || source.id !== id) return state;
  for (const key of Object.keys(state).filter(key => key !== 'id')) {
    state[key] = Math.max(0, finite(source[key]));
  }
  state.juvenileCoverFraction = clamp(state.juvenileCoverFraction);
  state.matureCoverFraction = clamp(state.matureCoverFraction);
  return state;
}

export function emptyFloodplainSuccessionState(options = {}) {
  return {
    schema: FLOODPLAIN_SUCCESSION_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    observedLivingDays: 0,
    dormantDays: 0,
    guilds: Object.fromEntries(FLOODPLAIN_SUCCESSION_GUILDS.map(id =>
      [id, emptyGuildState(id)])),
    lastHabitatReceiptDigest: null,
    lastFloodEventReceiptDigest: null,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainSuccessionState(source, options = {}) {
  const state = emptyFloodplainSuccessionState(options);
  if (source?.schema !== FLOODPLAIN_SUCCESSION_STATE_SCHEMA) return state;
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  state.observedLivingDays = Math.max(0, finite(source.observedLivingDays));
  state.dormantDays = Math.max(0, finite(source.dormantDays));
  state.guilds = Object.fromEntries(FLOODPLAIN_SUCCESSION_GUILDS.map(id =>
    [id, normalizeGuildState(source.guilds?.[id], id)]));
  state.lastHabitatReceiptDigest = typeof source.lastHabitatReceiptDigest ===
    'string' ? source.lastHabitatReceiptDigest : null;
  state.lastFloodEventReceiptDigest = typeof source.lastFloodEventReceiptDigest ===
    'string' ? source.lastFloodEventReceiptDigest : null;
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

function communityMetrics(guilds) {
  const covers = FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
    id,
    juvenile: guilds[id].juvenileCoverFraction,
    mature: guilds[id].matureCoverFraction,
    total: guilds[id].juvenileCoverFraction +
      guilds[id].matureCoverFraction
  }));
  const juvenileCoverFraction = covers.reduce((sum, entry) =>
    sum + entry.juvenile, 0);
  const matureCoverFraction = covers.reduce((sum, entry) =>
    sum + entry.mature, 0);
  const totalCoverFraction = juvenileCoverFraction + matureCoverFraction;
  const dominantGuild = totalCoverFraction > 1e-12
    ? covers.reduce((best, entry) => entry.total > best.total
      ? entry : best, covers[0]).id : 'uncolonized';
  const successionIndex = totalCoverFraction > 1e-12
    ? covers.reduce((sum, entry) => sum + entry.total *
      GUILD_TRAITS[entry.id].successionWeight, 0) / totalCoverFraction : 0;
  const diversityIndex = totalCoverFraction > 1e-12
    ? -covers.reduce((sum, entry) => {
      const share = entry.total / totalCoverFraction;
      return share > 0 ? sum + share * Math.log(share) : sum;
    }, 0) / Math.log(FLOODPLAIN_SUCCESSION_GUILDS.length) : 0;
  return {
    juvenileCoverFraction,
    matureCoverFraction,
    totalCoverFraction,
    bareFraction: Math.max(0, 1 - totalCoverFraction),
    totalSeedBankSeedsM2: covers.reduce((sum, entry) =>
      sum + guilds[entry.id].seedBankSeedsM2, 0),
    dominantGuild,
    successionIndex: clamp(successionIndex),
    diversityIndex: clamp(diversityIndex)
  };
}

export function floodplainSuccessionSummary(source) {
  const state = normalizeFloodplainSuccessionState(source);
  const metrics = communityMetrics(state.guilds);
  return {
    observedLivingDays: round(state.observedLivingDays, 8),
    dormantDays: round(state.dormantDays, 8),
    juvenileCoverFraction: round(metrics.juvenileCoverFraction, 12),
    matureCoverFraction: round(metrics.matureCoverFraction, 12),
    totalCoverFraction: round(metrics.totalCoverFraction, 12),
    bareFraction: round(metrics.bareFraction, 12),
    totalSeedBankSeedsM2: round(metrics.totalSeedBankSeedsM2, 9),
    dominantGuild: metrics.dominantGuild,
    successionIndex: round(metrics.successionIndex, 9),
    diversityIndex: round(metrics.diversityIndex, 9),
    guilds: Object.fromEntries(FLOODPLAIN_SUCCESSION_GUILDS.map(id => [id, {
      seedBankSeedsM2: round(state.guilds[id].seedBankSeedsM2, 9),
      juvenileCoverFraction: round(
        state.guilds[id].juvenileCoverFraction, 12),
      matureCoverFraction: round(state.guilds[id].matureCoverFraction, 12),
      totalCoverFraction: round(state.guilds[id].juvenileCoverFraction +
        state.guilds[id].matureCoverFraction, 12),
      habitat: GUILD_TRAITS[id].habitat,
      floodTolerance: GUILD_TRAITS[id].floodTolerance
    }])),
    maximumTotalCoverFraction: FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER,
    truth: truth()
  };
}

function eventDisturbance(receipt) {
  const event = receipt?.event?.after || receipt?.event?.completed ||
    receipt?.event?.before || null;
  const lifecycleActive = ['flood-event-started', 'flood-event-continued',
    'flood-event-completed'].includes(receipt?.status);
  const peak = Math.max(0, finite(event?.peakInundatedFraction));
  const current = Math.max(0, finite(
    receipt?.observation?.inundatedFraction));
  const durationDays = Math.max(0, finite(event?.durationDays));
  const intensity = lifecycleActive ? clamp(Math.max(peak, current) *
    (.55 + .45 * clamp(durationDays / 30))) : 0;
  const depositedKg = Object.values(event?.depositedSedimentKg || {})
    .reduce((sum, value) => sum + Math.max(0, finite(value)), 0);
  const recoverySignal = receipt?.status === 'flood-event-completed'
    ? clamp(.2 + Math.log1p(depositedKg) / 20) : 0;
  return {
    lifecycleStatus: receipt?.status || null,
    active: lifecycleActive,
    intensity,
    durationDays,
    peakInundatedFraction: peak,
    recoverySignal
  };
}

function zeroFlow(id) {
  return {
    guildId: id,
    suitability: 0,
    floodMortalityPressure: 0,
    seed: {
      beforeSeedsM2: 0, localProductionSeedsM2: 0,
      externalSeedRainSeedsM2: 0, germinatedSeedsM2: 0,
      decayedSeedsM2: 0, afterSeedsM2: 0, residualSeedsM2: 0
    },
    cover: {
      juvenileBefore: 0, recruited: 0, matured: 0,
      juvenileMortality: 0, juvenileCompetitionLoss: 0,
      juvenileAfter: 0, juvenileResidual: 0,
      matureBefore: 0, matureMortality: 0,
      matureCompetitionLoss: 0, matureAfter: 0, matureResidual: 0
    }
  };
}

function receiptBase(state, habitat, disturbance, durationDays, context,
  status, flows, communityBefore, communityAfter) {
  const seedResidualMaximum = Math.max(0, ...flows.map(flow =>
    Math.abs(flow.seed.residualSeedsM2)));
  const coverResidualMaximum = Math.max(0, ...flows.flatMap(flow => [
    Math.abs(flow.cover.juvenileResidual),
    Math.abs(flow.cover.matureResidual)
  ]));
  const receipt = {
    schema: FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA,
    transitionId: String(context.transitionId ||
      `floodplain-succession:${stableDigest({
        reachId: context.reachId || null,
        startDay: round(context.startDay, 8),
        durationDays: round(durationDays, 8),
        habitatDigest: context.floodplainHabitatReceipt?.digest || null,
        eventDigest: context.floodEventReceipt?.digest || null
      }).slice(9)}`),
    reachId: context.reachId || null,
    status,
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    habitatStateSchema: FLOODPLAIN_HABITAT_STATE_SCHEMA,
    floodplainHabitatReceiptDigest:
      context.floodplainHabitatReceipt?.digest || null,
    floodEventTransitionReceiptDigest:
      context.floodEventReceipt?.digest || null,
    controls: {
      livingEnabled: context.livingEnabled !== false,
      lifeAbundance: round(clamp(finite(context.lifeAbundance, 1), 0, 3), 9),
      materialGrowthScale: round(clamp(finite(
        context.materialGrowthScale, 1)), 9),
      maximumTotalCoverFraction: FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER,
      externalSeedRainBoundary: true
    },
    habitat: {
      class: habitat.habitatClass,
      fractions: clone(habitat.fractions),
      fertilityIndex: habitat.fertilityIndex,
      anaerobicStress: habitat.anaerobicStress
    },
    disturbance: clone(disturbance),
    community: {
      before: clone(communityBefore),
      after: clone(communityAfter),
      competitionApplied: flows.some(flow =>
        flow.cover.juvenileCompetitionLoss > 0 ||
        flow.cover.matureCompetitionLoss > 0)
    },
    guildFlows: clone(flows),
    closure: {
      maximumSeedResidualSeedsM2: round(seedResidualMaximum, 12),
      maximumCoverResidual: round(coverResidualMaximum, 12)
    },
    truth: {
      ...truth(),
      migrationInventedLivingHistory: false,
      demographicStateFrozen: status === 'life-disabled-dormant',
      ledgersClosed: seedResidualMaximum < 1e-8 &&
        coverResidualMaximum < 1e-10,
      competitionCapacityHonored:
        communityAfter.totalCoverFraction <=
          FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER + 1e-10,
      habitatReceiptEvidenceBound: Boolean(
        context.floodplainHabitatReceipt?.digest),
      floodEventReceiptEvidenceBound: Boolean(
        context.floodEventReceipt?.digest),
      plantMatterGrowthConstraintObserved: true
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  state.lastHabitatReceiptDigest = receipt.floodplainHabitatReceiptDigest;
  state.lastFloodEventReceiptDigest =
    receipt.floodEventTransitionReceiptDigest;
  return receipt;
}

export function advanceFloodplainSuccession(source, habitatSource, dtDays,
  context = {}) {
  const durationDays = finite(dtDays);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Floodplain succession step must be greater than zero and no longer than one day');
  }
  if (context.floodplainHabitatReceipt?.schema !==
    FLOODPLAIN_HABITAT_RECEIPT_SCHEMA) {
    throw new TypeError('Floodplain succession requires the current habitat transition receipt');
  }
  if (context.floodEventReceipt?.schema !==
    FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA) {
    throw new TypeError('Floodplain succession requires the current flood-event transition receipt');
  }
  const state = normalizeFloodplainSuccessionState(source);
  const habitatState = normalizeFloodplainHabitatState(habitatSource);
  const habitat = floodplainHabitatSummary(habitatState);
  const disturbance = eventDisturbance(context.floodEventReceipt);
  const communityBefore = floodplainSuccessionSummary(state);

  if (state.migrationCheckpoint) {
    state.migrationCheckpoint = false;
    const flows = FLOODPLAIN_SUCCESSION_GUILDS.map(zeroFlow);
    const receipt = receiptBase(state, habitat, disturbance, durationDays,
      context, 'initialized-after-migration-no-history', flows,
      communityBefore, communityBefore);
    return { state: normalizeFloodplainSuccessionState(state),
      receipt: clone(receipt) };
  }

  if (context.livingEnabled === false) {
    state.dormantDays += durationDays;
    const flows = FLOODPLAIN_SUCCESSION_GUILDS.map(id => {
      const flow = zeroFlow(id);
      const guild = state.guilds[id];
      flow.suitability = habitat.fractions[GUILD_TRAITS[id].habitat];
      flow.seed.beforeSeedsM2 = guild.seedBankSeedsM2;
      flow.seed.afterSeedsM2 = guild.seedBankSeedsM2;
      flow.cover.juvenileBefore = guild.juvenileCoverFraction;
      flow.cover.juvenileAfter = guild.juvenileCoverFraction;
      flow.cover.matureBefore = guild.matureCoverFraction;
      flow.cover.matureAfter = guild.matureCoverFraction;
      return flow;
    });
    const communityAfter = floodplainSuccessionSummary(state);
    const receipt = receiptBase(state, habitat, disturbance, durationDays,
      context, 'life-disabled-dormant', flows, communityBefore,
      communityAfter);
    return { state: normalizeFloodplainSuccessionState(state),
      receipt: clone(receipt) };
  }

  const lifeAbundance = clamp(finite(context.lifeAbundance, 1), 0, 3);
  const materialGrowthScale = clamp(finite(
    context.materialGrowthScale, 1));
  const working = {};
  for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
    const traits = GUILD_TRAITS[id];
    const before = state.guilds[id];
    const suitability = clamp(habitat.fractions[traits.habitat] * .72 +
      habitat.fertilityIndex * .2 +
      (1 - habitat.anaerobicStress) * .08);
    const floodMortalityPressure = clamp(disturbance.intensity *
      (1 - traits.floodTolerance));
    const recoveryMultiplier = 1 + disturbance.recoverySignal *
      traits.recoveryAffinity * 1.8;
    const localProductionSeedsM2 = before.matureCoverFraction *
      traits.fecunditySeedsM2 * durationDays * lifeAbundance;
    const externalSeedRainSeedsM2 = traits.externalSeedRainSeedsM2 *
      (.18 + .82 * suitability) * recoveryMultiplier *
      durationDays * lifeAbundance;
    const availableSeedsM2 = before.seedBankSeedsM2 +
      localProductionSeedsM2 + externalSeedRainSeedsM2;
    const germinationFraction = clamp((1 - Math.exp(
      -traits.germinationRate * durationDays)) * suitability *
      recoveryMultiplier * materialGrowthScale);
    const germinatedSeedsM2 = Math.min(availableSeedsM2,
      availableSeedsM2 * germinationFraction);
    const remainingSeedsM2 = availableSeedsM2 - germinatedSeedsM2;
    const decayedSeedsM2 = remainingSeedsM2 * (1 - Math.exp(
      -durationDays / traits.seedLongevityDays));
    const afterSeedsM2 = Math.max(0, remainingSeedsM2 - decayedSeedsM2);
    const recruited = germinatedSeedsM2 *
      traits.recruitmentCoverPerSeed * (.25 + .75 * suitability);
    const matured = Math.min(before.juvenileCoverFraction,
      before.juvenileCoverFraction * (1 - Math.exp(
        -traits.maturationRate * durationDays)) *
        (.35 + .65 * suitability) * materialGrowthScale);
    const juvenileMortalityRate = traits.juvenileMortalityRate *
      (1 + (1 - suitability) * 2.2) + floodMortalityPressure * .045;
    const matureMortalityRate = traits.matureMortalityRate *
      (1 + (1 - suitability) * 1.4) + floodMortalityPressure * .026;
    const juvenileMortality = Math.min(
      Math.max(0, before.juvenileCoverFraction - matured),
      before.juvenileCoverFraction * (1 - Math.exp(
        -juvenileMortalityRate * durationDays)));
    const matureMortality = Math.min(before.matureCoverFraction,
      before.matureCoverFraction * (1 - Math.exp(
        -matureMortalityRate * durationDays)));
    working[id] = {
      guildId: id, suitability, floodMortalityPressure,
      seed: {
        beforeSeedsM2: before.seedBankSeedsM2,
        localProductionSeedsM2, externalSeedRainSeedsM2,
        germinatedSeedsM2, decayedSeedsM2, afterSeedsM2
      },
      cover: {
        juvenileBefore: before.juvenileCoverFraction,
        recruited, matured, juvenileMortality,
        proposedJuvenileAfter: Math.max(0,
          before.juvenileCoverFraction + recruited - matured -
            juvenileMortality),
        matureBefore: before.matureCoverFraction,
        matureMortality,
        proposedMatureAfter: Math.max(0,
          before.matureCoverFraction + matured - matureMortality)
      }
    };
  }

  const proposedTotal = FLOODPLAIN_SUCCESSION_GUILDS.reduce((sum, id) =>
    sum + working[id].cover.proposedJuvenileAfter +
      working[id].cover.proposedMatureAfter, 0);
  const competitionScale = proposedTotal >
    FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER
    ? FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER / proposedTotal : 1;

  const flows = [];
  for (const id of FLOODPLAIN_SUCCESSION_GUILDS) {
    const flow = working[id];
    const cover = flow.cover;
    const juvenileAfter = cover.proposedJuvenileAfter * competitionScale;
    const matureAfter = cover.proposedMatureAfter * competitionScale;
    const juvenileCompetitionLoss = cover.proposedJuvenileAfter -
      juvenileAfter;
    const matureCompetitionLoss = cover.proposedMatureAfter - matureAfter;
    const guild = state.guilds[id];
    guild.seedBankSeedsM2 = flow.seed.afterSeedsM2;
    guild.juvenileCoverFraction = juvenileAfter;
    guild.matureCoverFraction = matureAfter;
    guild.cumulativeLocalSeedProductionSeedsM2 +=
      flow.seed.localProductionSeedsM2;
    guild.cumulativeExternalSeedRainSeedsM2 +=
      flow.seed.externalSeedRainSeedsM2;
    guild.cumulativeGerminatedSeedsM2 += flow.seed.germinatedSeedsM2;
    guild.cumulativeDecayedSeedsM2 += flow.seed.decayedSeedsM2;
    guild.cumulativeRecruitmentCover += cover.recruited;
    guild.cumulativeMaturedCover += cover.matured;
    guild.cumulativeJuvenileMortalityCover += cover.juvenileMortality;
    guild.cumulativeMatureMortalityCover += cover.matureMortality;
    guild.cumulativeCompetitionLossCover += juvenileCompetitionLoss +
      matureCompetitionLoss;
    flow.seed.residualSeedsM2 = flow.seed.beforeSeedsM2 +
      flow.seed.localProductionSeedsM2 +
      flow.seed.externalSeedRainSeedsM2 -
      flow.seed.germinatedSeedsM2 - flow.seed.decayedSeedsM2 -
      guild.seedBankSeedsM2;
    flow.cover.juvenileCompetitionLoss = juvenileCompetitionLoss;
    flow.cover.juvenileAfter = juvenileAfter;
    flow.cover.juvenileResidual = cover.juvenileBefore +
      cover.recruited - cover.matured - cover.juvenileMortality -
      juvenileCompetitionLoss - juvenileAfter;
    flow.cover.matureCompetitionLoss = matureCompetitionLoss;
    flow.cover.matureAfter = matureAfter;
    flow.cover.matureResidual = cover.matureBefore + cover.matured -
      cover.matureMortality - matureCompetitionLoss - matureAfter;
    delete flow.cover.proposedJuvenileAfter;
    delete flow.cover.proposedMatureAfter;
    flows.push(flow);
  }
  state.observedLivingDays += durationDays;
  const normalized = normalizeFloodplainSuccessionState(state);
  const communityAfter = floodplainSuccessionSummary(normalized);
  const status = disturbance.active ?
    (disturbance.lifecycleStatus === 'flood-event-completed'
      ? 'post-flood-recovery' : 'flood-disturbance-observed') :
    communityAfter.totalCoverFraction > communityBefore.totalCoverFraction
      ? 'community-establishing' : 'community-succession';
  const receipt = receiptBase(normalized, habitat, disturbance,
    durationDays, context, status, flows, communityBefore, communityAfter);
  return {
    state: normalizeFloodplainSuccessionState(normalized),
    receipt: clone(receipt)
  };
}

export function floodplainSuccessionDescription() {
  return {
    stateSchema: FLOODPLAIN_SUCCESSION_STATE_SCHEMA,
    transitionReceiptSchema: FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA,
    guilds: FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
      id, habitat: GUILD_TRAITS[id].habitat,
      floodTolerance: GUILD_TRAITS[id].floodTolerance,
      successionWeight: GUILD_TRAITS[id].successionWeight
    })),
    stages: ['seed-bank', 'juvenile-cover', 'mature-cover'],
    processes: [
      'local-seed-production', 'explicit-external-seed-rain',
      'germination', 'seed-decay', 'juvenile-recruitment',
      'maturation', 'habitat-and-flood-mortality',
      'bounded-cover-competition', 'post-flood-recovery',
      'material-availability-growth-constraint'
    ],
    evidenceInputs: [FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
      FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA],
    maximumTotalCoverFraction: FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER,
    maximumStepDays: 1,
    truth: truth()
  };
}
