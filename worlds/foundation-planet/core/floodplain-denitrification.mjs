import {
  ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA
} from './atmosphere-biogeochemistry.mjs?v=0.62.0-r62.1';
import {
  FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
  floodplainReactionMassClosureToleranceKg,
  normalizeFloodplainState
} from './floodplain.mjs?v=0.61.0-r61.1';

export const FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-denitrification-state/v4';
export const PREVIOUS_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-denitrification-state/v3';
export const LEGACY_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-denitrification-state/v2';
export const OLDEST_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-denitrification-state/v1';
export const FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-denitrification-receipt/v4';
export const PREVIOUS_FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-denitrification-receipt/v3';
export const DENITRIFICATION_KG_N_PER_KG_C = 14 / 15;
export const DENITRIFICATION_ALKALINITY_KG_CACO3_EQ_PER_KG_N = 3.57;
export const DENITRIFICATION_REFERENCE_TEMPERATURE_C = 20;
export const DENITRIFICATION_DEFAULT_Q10 = 2;

const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function stableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function reaction(source = {}) {
  return {
    dissolvedOrganicCarbonConsumedKgC: Math.max(0, finite(
      source.dissolvedOrganicCarbonConsumedKgC)),
    dissolvedInorganicCarbonProducedKgC: Math.max(0, finite(
      source.dissolvedInorganicCarbonProducedKgC)),
    dissolvedNitrateNitrogenConsumedKgN: Math.max(0, finite(
      source.dissolvedNitrateNitrogenConsumedKgN,
        finite(source.dissolvedInorganicNitrogenConsumedKgN))),
    nitrogenGasProducedKgN: Math.max(0, finite(
      source.nitrogenGasProducedKgN)),
    alkalinityGeneratedKgCaCO3Eq: Math.max(0, finite(
      source.alkalinityGeneratedKgCaCO3Eq))
  };
}

function roundedReaction(source = {}) {
  return Object.fromEntries(Object.entries(reaction(source)).map(
    ([key, value]) => [key, round(value, 9)]));
}

function truth() {
  return {
    persistentDenitrificationProcessMemory: true,
    floodplainChemistryOwnership: false,
    atmosphereNitrogenOwnership: false,
    pairedOwnerReceiptsRequiredWhenAtmosphereLoaded: true,
    oxygenGated: true,
    nitrogenLimited: true,
    surfaceTemperatureProxyResponsive: false,
    q10TemperatureResponseParameterized: true,
    persistentFloodplainWaterTemperatureState: true,
    floodplainThermalReceiptBindingRequired: true,
    resolvedFloodplainFreezeThawState: false,
    arrheniusKineticsResolved: false,
    reactiveNitrateEquivalentFractionParameterized: false,
    dissolvedInorganicNitrogenTreatedAsFullyNitrate: false,
    carbonClosureRequired: true,
    nitrogenClosureRequired: true,
    alkalinityGenerationClosureRequired: true,
    physicalNitrogenGasReceiverRequired: true,
    lifeRequired: true,
    nitrateSpeciationResolved: true,
    nitrateAndAmmoniumMaterialPools: true,
    nitrateOnlyDenitrification: true,
    ammoniumConsumedByDenitrification: false,
    nitritePoolResolved: false,
    nitrificationReactionModeled: false,
    microbialPopulationsResolved: false,
    mechanisticRedoxModel: false,
    scientificCalibrationClaimed: false
  };
}

export function emptyFloodplainDenitrificationState(options = {}) {
  return {
    schema: FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    observedDenitrificationDays: 0,
    dormantDays: 0,
    atmosphereUnavailableDays: 0,
    oxicConstrainedDays: 0,
    nitrogenLimitedDays: 0,
    temperatureConstrainedDays: 0,
    cumulativeReaction: reaction(),
    lastActivity: {
      atmosphereAvailable: false,
      moistureFactor: 0,
      lifeAbundance: 0,
      dissolvedOxygenMgL: 0,
      anoxicThresholdMgL: 0,
      anoxiaFactor: 0,
      waterTemperatureC: DENITRIFICATION_REFERENCE_TEMPERATURE_C,
      floodplainThermalReceiptDigest: null,
      referenceTemperatureC: DENITRIFICATION_REFERENCE_TEMPERATURE_C,
      temperatureQ10: DENITRIFICATION_DEFAULT_Q10,
      unclampedTemperatureResponseFactor: 1,
      temperatureResponseFactor: 1,
      temperatureConstrained: false,
      activityScale: 0,
      availableDissolvedOrganicCarbonKgC: 0,
      availableDissolvedInorganicNitrogenKgN: 0,
      availableDissolvedNitrateNitrogenKgN: 0,
      availableDissolvedAmmoniumNitrogenKgN: 0,
      maximumDailyDocFraction: 0,
      potentialDenitrificationKgC: 0,
      nitrogenCapacityKgC: 0,
      nitrogenLimited: false
    },
    lastReactionReceiptDigest: null,
    lastAtmosphereReceiptDigest: null,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainDenitrificationState(source,
  options = {}) {
  const state = emptyFloodplainDenitrificationState(options);
  if (![FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
    PREVIOUS_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
    LEGACY_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
    OLDEST_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA]
    .includes(source?.schema)) {
    return state;
  }
  state.migrationCheckpoint = source.schema !==
    FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA ||
    source.migrationCheckpoint === true;
  for (const key of ['observedDenitrificationDays', 'dormantDays',
    'atmosphereUnavailableDays', 'oxicConstrainedDays',
    'nitrogenLimitedDays', 'temperatureConstrainedDays']) {
    state[key] = Math.max(0, finite(source[key]));
  }
  state.cumulativeReaction = reaction(source.cumulativeReaction);
  state.lastActivity = {
    atmosphereAvailable: source.lastActivity?.atmosphereAvailable === true,
    moistureFactor: clamp(finite(source.lastActivity?.moistureFactor)),
    lifeAbundance: clamp(finite(source.lastActivity?.lifeAbundance), 0, 2),
    dissolvedOxygenMgL: Math.max(0, finite(
      source.lastActivity?.dissolvedOxygenMgL)),
    anoxicThresholdMgL: Math.max(0, finite(
      source.lastActivity?.anoxicThresholdMgL)),
    anoxiaFactor: clamp(finite(source.lastActivity?.anoxiaFactor)),
    waterTemperatureC: clamp(finite(
      source.lastActivity?.waterTemperatureC,
      DENITRIFICATION_REFERENCE_TEMPERATURE_C), -80, 80),
    floodplainThermalReceiptDigest:
      typeof source.lastActivity?.floodplainThermalReceiptDigest ===
        'string'
        ? source.lastActivity.floodplainThermalReceiptDigest : null,
    referenceTemperatureC: clamp(finite(
      source.lastActivity?.referenceTemperatureC,
      DENITRIFICATION_REFERENCE_TEMPERATURE_C), -20, 40),
    temperatureQ10: clamp(finite(
      source.lastActivity?.temperatureQ10,
      DENITRIFICATION_DEFAULT_Q10), .5, 4),
    unclampedTemperatureResponseFactor: Math.max(0, finite(
      source.lastActivity?.unclampedTemperatureResponseFactor, 1)),
    temperatureResponseFactor: clamp(finite(
      source.lastActivity?.temperatureResponseFactor, 1), .05, 4),
    temperatureConstrained:
      source.lastActivity?.temperatureConstrained === true,
    activityScale: clamp(finite(source.lastActivity?.activityScale), 0, 2),
    availableDissolvedOrganicCarbonKgC: Math.max(0, finite(
      source.lastActivity?.availableDissolvedOrganicCarbonKgC)),
    availableDissolvedInorganicNitrogenKgN: Math.max(0, finite(
      source.lastActivity?.availableDissolvedInorganicNitrogenKgN)),
    availableDissolvedNitrateNitrogenKgN: Math.max(0, finite(
      source.lastActivity?.availableDissolvedNitrateNitrogenKgN,
      finite(source.lastActivity?.reactiveNitrateEquivalentKgN))),
    availableDissolvedAmmoniumNitrogenKgN: Math.max(0, finite(
      source.lastActivity?.availableDissolvedAmmoniumNitrogenKgN)),
    maximumDailyDocFraction: clamp(finite(
      source.lastActivity?.maximumDailyDocFraction), 0, .2),
    potentialDenitrificationKgC: Math.max(0, finite(
      source.lastActivity?.potentialDenitrificationKgC)),
    nitrogenCapacityKgC: Math.max(0, finite(
      source.lastActivity?.nitrogenCapacityKgC)),
    nitrogenLimited: source.lastActivity?.nitrogenLimited === true
  };
  state.lastReactionReceiptDigest =
    typeof source.lastReactionReceiptDigest === 'string'
      ? source.lastReactionReceiptDigest : null;
  state.lastAtmosphereReceiptDigest =
    typeof source.lastAtmosphereReceiptDigest === 'string'
      ? source.lastAtmosphereReceiptDigest : null;
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

export function floodplainDenitrificationSummary(source) {
  const state = normalizeFloodplainDenitrificationState(source);
  return {
    observedDenitrificationDays: round(
      state.observedDenitrificationDays, 8),
    dormantDays: round(state.dormantDays, 8),
    atmosphereUnavailableDays: round(
      state.atmosphereUnavailableDays, 8),
    oxicConstrainedDays: round(state.oxicConstrainedDays, 8),
    nitrogenLimitedDays: round(state.nitrogenLimitedDays, 8),
    temperatureConstrainedDays: round(
      state.temperatureConstrainedDays, 8),
    cumulativeReaction: roundedReaction(state.cumulativeReaction),
    lastActivity: Object.fromEntries(Object.entries(state.lastActivity).map(
      ([key, value]) => [key, typeof value === 'number'
        ? round(value, 9) : value])),
    truth: truth()
  };
}

export function floodplainDenitrificationPlan(source, floodplainSource,
  context = {}) {
  const state = normalizeFloodplainDenitrificationState(source);
  const floodplain = normalizeFloodplainState(floodplainSource);
  const durationDays = finite(context.durationDays, 1);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Floodplain denitrification step must be greater than zero and no longer than one day');
  }
  const atmosphereAvailable = context.atmosphereAvailable !== false;
  const livingEnabled = context.livingEnabled !== false;
  const lifeAbundance = livingEnabled
    ? clamp(finite(context.lifeAbundance, 1), 0, 2) : 0;
  const hasFreeWater = floodplain.waterKg > 1e-9;
  const dissolvedOxygenMgL = hasFreeWater
    ? floodplain.chemistry.dissolvedOxygenKgO2 /
      floodplain.waterKg * 1e6 : 0;
  const anoxicThresholdMgL = clamp(finite(
    context.anoxicThresholdMgL, 2), .1, 8);
  const anoxiaFactor = hasFreeWater
    ? clamp((anoxicThresholdMgL - dissolvedOxygenMgL) /
      anoxicThresholdMgL) : 0;
  const moistureFactor = hasFreeWater
    ? clamp(.2 + .8 * Math.sqrt(clamp(floodplain.inundatedFraction))) : 0;
  const waterTemperatureC = clamp(finite(context.waterTemperatureC,
    DENITRIFICATION_REFERENCE_TEMPERATURE_C), -80, 80);
  const floodplainThermalReceiptDigest =
    typeof context.floodplainThermalReceiptDigest === 'string'
      ? context.floodplainThermalReceiptDigest : null;
  const referenceTemperatureC = clamp(finite(
    context.referenceTemperatureC,
    DENITRIFICATION_REFERENCE_TEMPERATURE_C), -20, 40);
  const temperatureQ10 = clamp(finite(context.temperatureQ10,
    DENITRIFICATION_DEFAULT_Q10), .5, 4);
  const unclampedTemperatureResponseFactor = Math.pow(temperatureQ10,
    (waterTemperatureC - referenceTemperatureC) / 10);
  const temperatureResponseFactor = clamp(
    unclampedTemperatureResponseFactor, .05, 4);
  const temperatureConstrained = temperatureResponseFactor < .999999;
  const activityScale = state.migrationCheckpoint || !atmosphereAvailable ||
    !livingEnabled ? 0 : clamp(
      moistureFactor * anoxiaFactor * lifeAbundance *
      temperatureResponseFactor, 0, 2);
  const maximumDailyDocFraction = clamp(finite(
    context.maximumDailyDocFraction, .015), 0, .2);
  const availableDoc = Math.max(0, finite(
    floodplain.chemistry.dissolvedOrganicCarbonKgC));
  const availableDin = Math.max(0, finite(
    floodplain.chemistry.dissolvedInorganicNitrogenKgN));
  const availableNitrate = Math.max(0, finite(
    floodplain.chemistry.dissolvedNitrateNitrogenKgN));
  const availableAmmonium = Math.max(0, finite(
    floodplain.chemistry.dissolvedAmmoniumNitrogenKgN));
  const potentialDenitrificationKgC = availableDoc * (1 - Math.exp(
    -maximumDailyDocFraction * durationDays * activityScale));
  const nitrogenCapacityKgC = availableNitrate /
    DENITRIFICATION_KG_N_PER_KG_C;
  const carbonConsumedKgC = Math.min(availableDoc,
    potentialDenitrificationKgC, nitrogenCapacityKgC);
  const nitrogenConsumedKgN = carbonConsumedKgC *
    DENITRIFICATION_KG_N_PER_KG_C;
  const nitrogenLimited = potentialDenitrificationKgC >
    nitrogenCapacityKgC + 1e-12;
  return {
    durationDays: round(durationDays, 8),
    livingEnabled,
    migrationCheckpoint: state.migrationCheckpoint,
    activity: {
      atmosphereAvailable,
      moistureFactor: round(moistureFactor, 9),
      lifeAbundance: round(lifeAbundance, 9),
      dissolvedOxygenMgL: round(dissolvedOxygenMgL, 9),
      anoxicThresholdMgL: round(anoxicThresholdMgL, 9),
      anoxiaFactor: round(anoxiaFactor, 9),
      waterTemperatureC: round(waterTemperatureC, 9),
      floodplainThermalReceiptDigest,
      referenceTemperatureC: round(referenceTemperatureC, 9),
      temperatureQ10: round(temperatureQ10, 9),
      unclampedTemperatureResponseFactor: round(
        unclampedTemperatureResponseFactor, 9),
      temperatureResponseFactor: round(temperatureResponseFactor, 9),
      temperatureConstrained,
      activityScale: round(activityScale, 9),
      maximumDailyDocFraction: round(maximumDailyDocFraction, 9),
      availableDissolvedOrganicCarbonKgC: round(availableDoc, 9),
      availableDissolvedInorganicNitrogenKgN: round(availableDin, 9),
      availableDissolvedNitrateNitrogenKgN: round(
        availableNitrate, 9),
      availableDissolvedAmmoniumNitrogenKgN: round(
        availableAmmonium, 9),
      potentialDenitrificationKgC: round(
        potentialDenitrificationKgC, 9),
      nitrogenCapacityKgC: round(nitrogenCapacityKgC, 9),
      nitrogenLimited
    },
    reaction: roundedReaction({
      dissolvedOrganicCarbonConsumedKgC: carbonConsumedKgC,
      dissolvedInorganicCarbonProducedKgC: carbonConsumedKgC,
      dissolvedNitrateNitrogenConsumedKgN: nitrogenConsumedKgN,
      nitrogenGasProducedKgN: nitrogenConsumedKgN,
      alkalinityGeneratedKgCaCO3Eq: nitrogenConsumedKgN *
        DENITRIFICATION_ALKALINITY_KG_CACO3_EQ_PER_KG_N
    }),
    stoichiometry: {
      nitrogenKgNPerCarbonKgC: round(
        DENITRIFICATION_KG_N_PER_KG_C, 12),
      alkalinityKgCaCO3EqPerKgN:
        DENITRIFICATION_ALKALINITY_KG_CACO3_EQ_PER_KG_N
    },
    truth: {
      ...truth(),
      localFloodplainChemistryOnlyInPlan: true,
      surfaceTemperatureForcingUsedAsWaterTemperatureProxy: false,
      persistentFloodplainThermalStateUsed:
        typeof floodplainThermalReceiptDigest === 'string',
      atmosphereLoaded: atmosphereAvailable,
      migrationHasZeroReaction: state.migrationCheckpoint
        ? carbonConsumedKgC + nitrogenConsumedKgN <= 1e-12 : true,
      atmosphereUnavailableHasZeroReaction: !atmosphereAvailable
        ? carbonConsumedKgC + nitrogenConsumedKgN <= 1e-12 : true,
      LifeOffHasZeroReaction: !livingEnabled
        ? carbonConsumedKgC + nitrogenConsumedKgN <= 1e-12 : true
    }
  };
}

export function advanceFloodplainDenitrification(source, plan,
  reactionReceiptSource, atmosphereReceiptSource, context = {}) {
  const state = normalizeFloodplainDenitrificationState(source);
  const reachId = String(context.reachId || '');
  const atmosphereCellId = String(context.atmosphereCellId || '');
  const transferId = String(context.transferId || '');
  if (!reachId || !transferId) {
    throw new Error('Floodplain denitrification transition requires reach and transfer IDs');
  }
  const atmosphereAvailable = plan?.activity?.atmosphereAvailable === true;
  const planned = reaction(plan?.reaction);
  const reactionReceipt = reactionReceiptSource?.schema ===
    FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA
    ? reactionReceiptSource : null;
  const atmosphereReceipt = atmosphereReceiptSource?.schema ===
    ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA
    ? atmosphereReceiptSource : null;
  const plannedMagnitude = Object.values(planned).reduce(
    (sum, value) => sum + value, 0);
  if (atmosphereAvailable && (!reactionReceipt || !atmosphereReceipt)) {
    throw new TypeError('Loaded floodplain denitrification requires both owner receipts');
  }
  if (!atmosphereAvailable && (reactionReceipt || atmosphereReceipt ||
    plannedMagnitude > 1e-12)) {
    throw new Error('Unloaded atmosphere cannot accept floodplain denitrification or owner receipts');
  }
  if (atmosphereAvailable) {
    const reacted = reaction(reactionReceipt.reaction);
    const reactionChannels = {
      dissolvedOrganicCarbonConsumedKgC: 'carbonKgC',
      dissolvedInorganicCarbonProducedKgC: 'carbonKgC',
      dissolvedNitrateNitrogenConsumedKgN: 'nitrogenKgN',
      nitrogenGasProducedKgN: 'nitrogenKgN',
      alkalinityGeneratedKgCaCO3Eq: 'alkalinityKgCaCO3Eq'
    };
    const quantitiesMatch = Object.keys(planned).every(key =>
      Math.abs(planned[key] - reacted[key]) <=
        floodplainReactionMassClosureToleranceKg(reactionChannels[key],
          planned[key], reacted[key])) &&
      Math.abs(planned.nitrogenGasProducedKgN -
        finite(atmosphereReceipt.inputs?.nitrogenKgN)) <=
          floodplainReactionMassClosureToleranceKg('nitrogenKgN',
            planned.nitrogenGasProducedKgN,
            atmosphereReceipt.inputs?.nitrogenKgN);
    if (!quantitiesMatch || reactionReceipt.transferId !== transferId ||
      atmosphereReceipt.transferId !== transferId ||
      reactionReceipt.reachId !== reachId ||
      atmosphereReceipt.sourceReachId !== reachId ||
      atmosphereReceipt.sourceReceiptDigest !== reactionReceipt.digest ||
      atmosphereReceipt.sourceKind !== 'floodplain-denitrification') {
      throw new Error('Floodplain denitrification owner receipts do not match the plan lineage');
    }
  }
  const durationDays = finite(context.durationDays, 1);
  const before = floodplainDenitrificationSummary(state);
  let status;
  if (state.migrationCheckpoint) {
    if (plannedMagnitude > 1e-12) {
      throw new Error('Floodplain denitrification migration cannot move material');
    }
    state.migrationCheckpoint = false;
    status = 'initialized-after-v18-migration-no-invented-history';
  } else if (!atmosphereAvailable) {
    state.atmosphereUnavailableDays += durationDays;
    status = 'atmosphere-unloaded-no-denitrification';
  } else if (plan?.livingEnabled === false) {
    if (plannedMagnitude > 1e-12) {
      throw new Error('Life-off floodplain denitrification must have zero transfers');
    }
    state.dormantDays += durationDays;
    status = 'life-disabled-dormant';
  } else {
    state.observedDenitrificationDays += durationDays;
    if (finite(plan?.activity?.anoxiaFactor) < .999999) {
      state.oxicConstrainedDays += durationDays;
    }
    if (plan?.activity?.nitrogenLimited === true) {
      state.nitrogenLimitedDays += durationDays;
    }
    if (plan?.activity?.temperatureConstrained === true) {
      state.temperatureConstrainedDays += durationDays;
    }
    state.cumulativeReaction = reaction({
      dissolvedOrganicCarbonConsumedKgC:
        state.cumulativeReaction.dissolvedOrganicCarbonConsumedKgC +
        planned.dissolvedOrganicCarbonConsumedKgC,
      dissolvedInorganicCarbonProducedKgC:
        state.cumulativeReaction.dissolvedInorganicCarbonProducedKgC +
        planned.dissolvedInorganicCarbonProducedKgC,
      dissolvedNitrateNitrogenConsumedKgN:
        state.cumulativeReaction.dissolvedNitrateNitrogenConsumedKgN +
        planned.dissolvedNitrateNitrogenConsumedKgN,
      nitrogenGasProducedKgN:
        state.cumulativeReaction.nitrogenGasProducedKgN +
        planned.nitrogenGasProducedKgN,
      alkalinityGeneratedKgCaCO3Eq:
        state.cumulativeReaction.alkalinityGeneratedKgCaCO3Eq +
        planned.alkalinityGeneratedKgCaCO3Eq
    });
    status = planned.dissolvedOrganicCarbonConsumedKgC > 1e-12
      ? plan?.activity?.nitrogenLimited === true
        ? 'nitrogen-limited-anoxic-denitrification'
        : plan?.activity?.temperatureConstrained === true
          ? 'temperature-constrained-anoxic-denitrification'
          : 'anoxic-doc-denitrification'
      : finite(plan?.activity?.anoxiaFactor) <= 1e-12
        ? 'oxic-no-denitrification'
        : 'denitrification-maintained-no-reactive-doc-or-nitrate';
  }
  state.lastActivity = clone(plan?.activity || state.lastActivity);
  state.lastReactionReceiptDigest = reactionReceipt?.digest || null;
  state.lastAtmosphereReceiptDigest = atmosphereReceipt?.digest || null;
  const after = floodplainDenitrificationSummary(state);
  const receipt = {
    schema: FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA,
    transitionId: String(context.transitionId ||
      `floodplain-denitrification:${stableDigest({
        reachId, atmosphereCellId, transferId,
        startDay: round(context.startDay, 8)
      }).slice(9)}`),
    transferId,
    reachId,
    atmosphereCellId: atmosphereAvailable ? atmosphereCellId : null,
    status,
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    reaction: roundedReaction(planned),
    reactionReceiptDigest: reactionReceipt?.digest || null,
    atmosphereReceiptDigest: atmosphereReceipt?.digest || null,
    activity: clone(plan?.activity || {}),
    before,
    after,
    closure: {
      carbonResidualKgC: round(finite(
        reactionReceipt?.closure?.carbonResidualKgC), 12),
      nitrogenTransferResidualKgN: round(
        planned.nitrogenGasProducedKgN -
        finite(atmosphereReceipt?.inputs?.nitrogenKgN), 12),
      floodplainNitrogenResidualKgN: round(finite(
        reactionReceipt?.closure?.nitrogenResidualKgN), 12),
      floodplainAlkalinityResidualKgCaCO3Eq: round(finite(
        reactionReceipt?.closure?.alkalinityCreditResidualKgCaCO3Eq),
      12),
      atmosphereNitrogenResidualKgN: round(finite(
        atmosphereReceipt?.conservation?.nitrogenResidualKgN), 12)
    },
    truth: {
      ...truth(),
      surfaceTemperatureForcingUsedAsWaterTemperatureProxy: false,
      persistentFloodplainThermalStateUsed:
        typeof plan?.activity?.floodplainThermalReceiptDigest === 'string',
      pairedOwnerReceiptsPresent: atmosphereAvailable
        ? Boolean(reactionReceipt && atmosphereReceipt) : true,
      exactTransferIdentity: atmosphereAvailable
        ? reactionReceipt.transferId === atmosphereReceipt.transferId : true,
      ownerLedgersClosed: atmosphereAvailable
        ? reactionReceipt.truth?.scaleAwareFloatingPointClosure === true &&
          Math.abs(finite(atmosphereReceipt.conservation
            ?.nitrogenResidualKgN)) < 1e-7
        : true,
      migrationInventedHistory: false,
      denitrificationPoolsFrozen: status === 'life-disabled-dormant'
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  return {
    state: normalizeFloodplainDenitrificationState(state),
    receipt: clone(receipt)
  };
}

export function floodplainDenitrificationDescription() {
  return {
    stateSchema: FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
    transitionReceiptSchema: FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA,
    floodplainReactionReceiptSchema:
      FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
    atmosphereReceiverReceiptSchema:
      ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA,
    donorPools: ['floodplain-dissolved-organic-carbon',
      'floodplain-dissolved-nitrate-nitrogen'],
    localReceiverPools: ['floodplain-dissolved-inorganic-carbon',
      'floodplain-alkalinity-as-CaCO3-equivalent'],
    atmosphericReceiverPools: ['native-surface-layer-nitrogen-gas'],
    processes: ['oxygen-gated-doc-denitrification',
      'bounded-q10-surface-temperature-response',
      'nitrate-only-material-cap',
      'denitrification-alkalinity-generation',
      'paired-floodplain-atmosphere-nitrogen-transfer',
      'v18-zero-history-migration', 'Life-off-freeze'],
    nitrogenKgNPerCarbonKgC: round(
      DENITRIFICATION_KG_N_PER_KG_C, 12),
    alkalinityKgCaCO3EqPerKgN:
      DENITRIFICATION_ALKALINITY_KG_CACO3_EQ_PER_KG_N,
    referenceTemperatureC: DENITRIFICATION_REFERENCE_TEMPERATURE_C,
    defaultTemperatureQ10: DENITRIFICATION_DEFAULT_Q10,
    boundedTemperatureResponseFactor: { minimum: .05, maximum: 4 },
    maximumStepDays: 1,
    truth: truth()
  };
}
