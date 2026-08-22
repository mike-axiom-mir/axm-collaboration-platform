import {
  FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
  floodplainReactionMassClosureToleranceKg,
  normalizeFloodplainState
} from './floodplain.mjs?v=0.61.0-r61.1';

export const FLOODPLAIN_NITRIFICATION_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-nitrification-state/v2';
export const PREVIOUS_FLOODPLAIN_NITRIFICATION_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-nitrification-state/v1';
export const FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-nitrification-receipt/v2';
export const NITRIFICATION_OXYGEN_KG_O2_PER_KG_N = 4.57;
export const NITRIFICATION_ALKALINITY_DEMAND_KG_CACO3_PER_KG_N = 7.14;
export const NITRIFICATION_REFERENCE_TEMPERATURE_C = 20;
export const NITRIFICATION_DEFAULT_Q10 = 2;

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
    dissolvedAmmoniumNitrogenConsumedKgN: Math.max(0, finite(
      source.dissolvedAmmoniumNitrogenConsumedKgN)),
    dissolvedNitrateNitrogenProducedKgN: Math.max(0, finite(
      source.dissolvedNitrateNitrogenProducedKgN)),
    dissolvedOxygenConsumedKgO2: Math.max(0, finite(
      source.dissolvedOxygenConsumedKgO2)),
    alkalinityDemandKgCaCO3: Math.max(0, finite(
      source.alkalinityDemandKgCaCO3))
  };
}

function roundedReaction(source = {}) {
  return Object.fromEntries(Object.entries(reaction(source)).map(
    ([key, value]) => [key, round(value, 9)]));
}

function truth() {
  return {
    persistentNitrificationProcessMemory: true,
    floodplainChemistryOwnership: false,
    localAmmoniumSenderRequired: true,
    localNitrateReceiverRequired: true,
    localDissolvedOxygenSenderRequired: true,
    localAlkalinitySenderRequired: true,
    nitrogenClosureRequired: true,
    oxygenConsumptionClosureRequired: true,
    aerobicProcess: true,
    minimumDissolvedOxygenReserveRequired: true,
    surfaceTemperatureProxyResponsive: false,
    q10TemperatureResponseParameterized: true,
    persistentFloodplainWaterTemperatureState: true,
    floodplainThermalReceiptBindingRequired: true,
    ammoniumToNitrateOneStepApproximation: true,
    nitriteIntermediateResolved: false,
    alkalinityDemandDiagnostic: false,
    alkalinityMaterialOwnerDebited: true,
    legacyAlkalinityDemandDiagnosticHistorySeparated: true,
    alkalinityLimitedReaction: true,
    alkalinityIsAcidNeutralizingCapacityEquivalent: true,
    carbonateSpeciationResolved: false,
    pHFeedbackModeled: false,
    microbialPopulationsResolved: false,
    mechanisticNitrifierModel: false,
    scientificCalibrationClaimed: false
  };
}

export function emptyFloodplainNitrificationState(options = {}) {
  return {
    schema: FLOODPLAIN_NITRIFICATION_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    observedNitrificationDays: 0,
    dormantDays: 0,
    oxygenConstrainedDays: 0,
    oxygenLimitedDays: 0,
    alkalinityLimitedDays: 0,
    temperatureConstrainedDays: 0,
    legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3: 0,
    cumulativeReaction: reaction(),
    lastActivity: {
      moistureFactor: 0,
      lifeAbundance: 0,
      dissolvedOxygenMgL: 0,
      minimumDissolvedOxygenMgL: 0,
      optimalDissolvedOxygenMgL: 0,
      oxygenResponseFactor: 0,
      waterTemperatureC: NITRIFICATION_REFERENCE_TEMPERATURE_C,
      floodplainThermalReceiptDigest: null,
      referenceTemperatureC: NITRIFICATION_REFERENCE_TEMPERATURE_C,
      temperatureQ10: NITRIFICATION_DEFAULT_Q10,
      unclampedTemperatureResponseFactor: 1,
      temperatureResponseFactor: 1,
      temperatureConstrained: false,
      activityScale: 0,
      availableDissolvedAmmoniumNitrogenKgN: 0,
      availableDissolvedOxygenKgO2: 0,
      minimumOxygenReserveKgO2: 0,
      reactiveDissolvedOxygenKgO2: 0,
      maximumDailyAmmoniumFraction: 0,
      potentialNitrificationKgN: 0,
      oxygenCapacityKgN: 0,
      oxygenLimited: false,
      availableAlkalinityKgCaCO3Eq: 0,
      alkalinityCapacityKgN: 0,
      alkalinityLimited: false
    },
    lastReactionReceiptDigest: null,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainNitrificationState(source,
  options = {}) {
  const state = emptyFloodplainNitrificationState(options);
  if (![
    FLOODPLAIN_NITRIFICATION_STATE_SCHEMA,
    PREVIOUS_FLOODPLAIN_NITRIFICATION_STATE_SCHEMA
  ].includes(source?.schema)) {
    return state;
  }
  state.migrationCheckpoint = source.schema !==
    FLOODPLAIN_NITRIFICATION_STATE_SCHEMA ||
    source.migrationCheckpoint === true;
  for (const key of ['observedNitrificationDays', 'dormantDays',
    'oxygenConstrainedDays', 'oxygenLimitedDays',
    'alkalinityLimitedDays',
    'temperatureConstrainedDays']) {
    state[key] = Math.max(0, finite(source[key]));
  }
  const migratedLegacyDiagnostic = source.schema ===
    PREVIOUS_FLOODPLAIN_NITRIFICATION_STATE_SCHEMA
    ? Math.max(0, finite(source.cumulativeReaction
      ?.alkalinityDemandKgCaCO3)) : 0;
  state.legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3 = Math.max(0,
    finite(source.legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3)) +
    migratedLegacyDiagnostic;
  state.cumulativeReaction = reaction({
    ...source.cumulativeReaction,
    alkalinityDemandKgCaCO3: source.schema ===
      PREVIOUS_FLOODPLAIN_NITRIFICATION_STATE_SCHEMA
      ? 0 : source.cumulativeReaction?.alkalinityDemandKgCaCO3
  });
  state.lastActivity = {
    moistureFactor: clamp(finite(source.lastActivity?.moistureFactor)),
    lifeAbundance: clamp(finite(source.lastActivity?.lifeAbundance), 0, 2),
    dissolvedOxygenMgL: Math.max(0, finite(
      source.lastActivity?.dissolvedOxygenMgL)),
    minimumDissolvedOxygenMgL: Math.max(0, finite(
      source.lastActivity?.minimumDissolvedOxygenMgL)),
    optimalDissolvedOxygenMgL: Math.max(0, finite(
      source.lastActivity?.optimalDissolvedOxygenMgL)),
    oxygenResponseFactor: clamp(finite(
      source.lastActivity?.oxygenResponseFactor)),
    waterTemperatureC: clamp(finite(
      source.lastActivity?.waterTemperatureC,
      NITRIFICATION_REFERENCE_TEMPERATURE_C), -80, 80),
    floodplainThermalReceiptDigest:
      typeof source.lastActivity?.floodplainThermalReceiptDigest ===
        'string'
        ? source.lastActivity.floodplainThermalReceiptDigest : null,
    referenceTemperatureC: clamp(finite(
      source.lastActivity?.referenceTemperatureC,
      NITRIFICATION_REFERENCE_TEMPERATURE_C), -20, 40),
    temperatureQ10: clamp(finite(source.lastActivity?.temperatureQ10,
      NITRIFICATION_DEFAULT_Q10), .5, 4),
    unclampedTemperatureResponseFactor: Math.max(0, finite(
      source.lastActivity?.unclampedTemperatureResponseFactor, 1)),
    temperatureResponseFactor: clamp(finite(
      source.lastActivity?.temperatureResponseFactor, 1), .05, 4),
    temperatureConstrained:
      source.lastActivity?.temperatureConstrained === true,
    activityScale: clamp(finite(source.lastActivity?.activityScale), 0, 4),
    availableDissolvedAmmoniumNitrogenKgN: Math.max(0, finite(
      source.lastActivity?.availableDissolvedAmmoniumNitrogenKgN)),
    availableDissolvedOxygenKgO2: Math.max(0, finite(
      source.lastActivity?.availableDissolvedOxygenKgO2)),
    minimumOxygenReserveKgO2: Math.max(0, finite(
      source.lastActivity?.minimumOxygenReserveKgO2)),
    reactiveDissolvedOxygenKgO2: Math.max(0, finite(
      source.lastActivity?.reactiveDissolvedOxygenKgO2)),
    maximumDailyAmmoniumFraction: clamp(finite(
      source.lastActivity?.maximumDailyAmmoniumFraction), 0, .25),
    potentialNitrificationKgN: Math.max(0, finite(
      source.lastActivity?.potentialNitrificationKgN)),
    oxygenCapacityKgN: Math.max(0, finite(
      source.lastActivity?.oxygenCapacityKgN)),
    oxygenLimited: source.lastActivity?.oxygenLimited === true
    , availableAlkalinityKgCaCO3Eq: Math.max(0, finite(
      source.lastActivity?.availableAlkalinityKgCaCO3Eq))
    , alkalinityCapacityKgN: Math.max(0, finite(
      source.lastActivity?.alkalinityCapacityKgN))
    , alkalinityLimited:
      source.lastActivity?.alkalinityLimited === true
  };
  state.lastReactionReceiptDigest =
    typeof source.lastReactionReceiptDigest === 'string'
      ? source.lastReactionReceiptDigest : null;
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

export function floodplainNitrificationSummary(source) {
  const state = normalizeFloodplainNitrificationState(source);
  return {
    observedNitrificationDays: round(state.observedNitrificationDays, 8),
    dormantDays: round(state.dormantDays, 8),
    oxygenConstrainedDays: round(state.oxygenConstrainedDays, 8),
    oxygenLimitedDays: round(state.oxygenLimitedDays, 8),
    alkalinityLimitedDays: round(state.alkalinityLimitedDays, 8),
    legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3: round(
      state.legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3, 9),
    temperatureConstrainedDays: round(
      state.temperatureConstrainedDays, 8),
    cumulativeReaction: roundedReaction(state.cumulativeReaction),
    lastActivity: Object.fromEntries(Object.entries(state.lastActivity).map(
      ([key, value]) => [key, typeof value === 'number'
        ? round(value, 9) : value])),
    truth: truth()
  };
}

export function floodplainNitrificationPlan(source, floodplainSource,
  context = {}) {
  const state = normalizeFloodplainNitrificationState(source);
  const floodplain = normalizeFloodplainState(floodplainSource);
  const durationDays = finite(context.durationDays, 1);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Floodplain nitrification step must be greater than zero and no longer than one day');
  }
  const livingEnabled = context.livingEnabled !== false;
  const lifeAbundance = livingEnabled
    ? clamp(finite(context.lifeAbundance, 1), 0, 2) : 0;
  const hasFreeWater = floodplain.waterKg > 1e-9;
  const moistureFactor = hasFreeWater
    ? clamp(.25 + .75 * Math.sqrt(clamp(floodplain.inundatedFraction))) : 0;
  const dissolvedOxygenMgL = floodplain.waterKg > 0
    ? floodplain.chemistry.dissolvedOxygenKgO2 * 1e6 /
      floodplain.waterKg : 0;
  const minimumDissolvedOxygenMgL = clamp(finite(
    context.minimumDissolvedOxygenMgL, 2), 0, 12);
  const optimalDissolvedOxygenMgL = clamp(finite(
    context.optimalDissolvedOxygenMgL, 6),
  minimumDissolvedOxygenMgL + .1, 20);
  const oxygenResponseFactor = clamp((dissolvedOxygenMgL -
    minimumDissolvedOxygenMgL) /
    (optimalDissolvedOxygenMgL - minimumDissolvedOxygenMgL));
  const waterTemperatureC = clamp(finite(context.waterTemperatureC,
    NITRIFICATION_REFERENCE_TEMPERATURE_C), -80, 80);
  const floodplainThermalReceiptDigest =
    typeof context.floodplainThermalReceiptDigest === 'string'
      ? context.floodplainThermalReceiptDigest : null;
  const referenceTemperatureC = clamp(finite(
    context.referenceTemperatureC,
    NITRIFICATION_REFERENCE_TEMPERATURE_C), -20, 40);
  const temperatureQ10 = clamp(finite(context.temperatureQ10,
    NITRIFICATION_DEFAULT_Q10), .5, 4);
  const unclampedTemperatureResponseFactor = Math.pow(temperatureQ10,
    (waterTemperatureC - referenceTemperatureC) / 10);
  const temperatureResponseFactor = clamp(
    unclampedTemperatureResponseFactor, .05, 4);
  const temperatureConstrained = Math.abs(temperatureResponseFactor -
    unclampedTemperatureResponseFactor) > 1e-12 ||
    temperatureResponseFactor < .999999;
  const activityScale = state.migrationCheckpoint || !livingEnabled ||
    !hasFreeWater ? 0 : clamp(moistureFactor * lifeAbundance *
      oxygenResponseFactor * temperatureResponseFactor, 0, 4);
  const maximumDailyAmmoniumFraction = clamp(finite(
    context.maximumDailyAmmoniumFraction, .02), 0, .25);
  const availableAmmonium = Math.max(0, finite(
    floodplain.chemistry.dissolvedAmmoniumNitrogenKgN));
  const availableOxygen = Math.max(0, finite(
    floodplain.chemistry.dissolvedOxygenKgO2));
  const minimumOxygenReserve = Math.min(availableOxygen,
    minimumDissolvedOxygenMgL * floodplain.waterKg / 1e6);
  const reactiveOxygen = Math.max(0,
    availableOxygen - minimumOxygenReserve);
  const potentialNitrification = availableAmmonium * (1 - Math.exp(
    -maximumDailyAmmoniumFraction * durationDays * activityScale));
  const oxygenCapacity = reactiveOxygen /
    NITRIFICATION_OXYGEN_KG_O2_PER_KG_N;
  const availableAlkalinity = Math.max(0, finite(
    floodplain.chemistry.alkalinityKgCaCO3Eq));
  const alkalinityCapacity = availableAlkalinity /
    NITRIFICATION_ALKALINITY_DEMAND_KG_CACO3_PER_KG_N;
  const nitrogenNitrified = Math.min(availableAmmonium,
    potentialNitrification, oxygenCapacity, alkalinityCapacity);
  const oxygenConsumed = nitrogenNitrified *
    NITRIFICATION_OXYGEN_KG_O2_PER_KG_N;
  const alkalinityDemand = nitrogenNitrified *
    NITRIFICATION_ALKALINITY_DEMAND_KG_CACO3_PER_KG_N;
  const oxygenLimited = potentialNitrification > oxygenCapacity + 1e-12;
  const alkalinityLimited = Math.min(potentialNitrification,
    oxygenCapacity) > alkalinityCapacity + 1e-12;
  return {
    durationDays: round(durationDays, 8),
    livingEnabled,
    migrationCheckpoint: state.migrationCheckpoint,
    activity: {
      moistureFactor: round(moistureFactor, 9),
      lifeAbundance: round(lifeAbundance, 9),
      dissolvedOxygenMgL: round(dissolvedOxygenMgL, 9),
      minimumDissolvedOxygenMgL: round(minimumDissolvedOxygenMgL, 9),
      optimalDissolvedOxygenMgL: round(optimalDissolvedOxygenMgL, 9),
      oxygenResponseFactor: round(oxygenResponseFactor, 9),
      waterTemperatureC: round(waterTemperatureC, 9),
      floodplainThermalReceiptDigest,
      referenceTemperatureC: round(referenceTemperatureC, 9),
      temperatureQ10: round(temperatureQ10, 9),
      unclampedTemperatureResponseFactor: round(
        unclampedTemperatureResponseFactor, 9),
      temperatureResponseFactor: round(temperatureResponseFactor, 9),
      temperatureConstrained,
      activityScale: round(activityScale, 9),
      availableDissolvedAmmoniumNitrogenKgN: round(
        availableAmmonium, 9),
      availableDissolvedOxygenKgO2: round(availableOxygen, 9),
      minimumOxygenReserveKgO2: round(minimumOxygenReserve, 9),
      reactiveDissolvedOxygenKgO2: round(reactiveOxygen, 9),
      maximumDailyAmmoniumFraction: round(
        maximumDailyAmmoniumFraction, 9),
      potentialNitrificationKgN: round(potentialNitrification, 9),
      oxygenCapacityKgN: round(oxygenCapacity, 9),
      oxygenLimited,
      availableAlkalinityKgCaCO3Eq: round(availableAlkalinity, 9),
      alkalinityCapacityKgN: round(alkalinityCapacity, 9),
      alkalinityLimited
    },
    reaction: roundedReaction({
      dissolvedAmmoniumNitrogenConsumedKgN: nitrogenNitrified,
      dissolvedNitrateNitrogenProducedKgN: nitrogenNitrified,
      dissolvedOxygenConsumedKgO2: oxygenConsumed,
      alkalinityDemandKgCaCO3: alkalinityDemand
    }),
    stoichiometry: {
      oxygenKgO2PerKgN: NITRIFICATION_OXYGEN_KG_O2_PER_KG_N,
      alkalinityDemandKgCaCO3PerKgN:
        NITRIFICATION_ALKALINITY_DEMAND_KG_CACO3_PER_KG_N
    },
    truth: {
      localFloodplainChemistryOnly: true,
      oxygenCapacityLimitsNitrification: true,
      alkalinityCapacityLimitsNitrification: true,
      minimumDissolvedOxygenReserveHonored:
        oxygenConsumed <= reactiveOxygen + 1e-12,
      LifeOffHasZeroActivity: !livingEnabled ? activityScale === 0 : true,
      migrationHasZeroActivity: state.migrationCheckpoint
        ? activityScale === 0 : true,
      alkalinityDemandDiagnosticOnly: false,
      alkalinityMaterialOwnerDebited: true,
      pHFeedbackModeled: false,
      nitriteIntermediateResolved: false
    }
  };
}

export function advanceFloodplainNitrification(source, plan,
  reactionSource, context = {}) {
  const state = normalizeFloodplainNitrificationState(source);
  const reactionReceipt = reactionSource?.schema ===
    FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA
    ? reactionSource : null;
  if (!reactionReceipt) {
    throw new TypeError('Floodplain nitrification requires the current local chemistry receipt');
  }
  const reachId = String(context.reachId || '');
  const transferId = String(context.transferId || '');
  if (!reachId || !transferId || reactionReceipt.reachId !== reachId ||
    reactionReceipt.transferId !== transferId) {
    throw new Error('Floodplain nitrification receipt reach lineage mismatch');
  }
  const durationDays = finite(context.durationDays, 1);
  const planned = reaction(plan?.reaction);
  const reacted = reaction(reactionReceipt.reaction);
  const reactionChannels = {
    dissolvedAmmoniumNitrogenConsumedKgN: 'ammoniumNitrogenKgN',
    dissolvedNitrateNitrogenProducedKgN: 'nitrogenKgN',
    dissolvedOxygenConsumedKgO2: 'oxygenKgO2',
    alkalinityDemandKgCaCO3: 'alkalinityKgCaCO3Eq'
  };
  const amountsMatch = Object.keys(planned).every(key =>
    Math.abs(planned[key] - reacted[key]) <=
      floodplainReactionMassClosureToleranceKg(reactionChannels[key],
        planned[key], reacted[key]));
  if (!amountsMatch) {
    throw new Error('Floodplain nitrification plan and chemistry reaction quantities differ');
  }
  const before = floodplainNitrificationSummary(state);
  const transferMagnitude = Object.values(reacted)
    .reduce((sum, value) => sum + value, 0);
  let status;
  if (state.migrationCheckpoint) {
    if (transferMagnitude > 1e-12) {
      throw new Error('Floodplain nitrification migration cannot move material');
    }
    state.migrationCheckpoint = false;
    status = 'initialized-after-schema-migration-no-invented-history';
  } else if (plan?.livingEnabled === false) {
    if (transferMagnitude > 1e-12) {
      throw new Error('Life-off floodplain nitrification must have zero transfers');
    }
    state.dormantDays += durationDays;
    status = 'life-disabled-dormant';
  } else {
    state.observedNitrificationDays += durationDays;
    if (finite(plan?.activity?.oxygenResponseFactor) < .999999) {
      state.oxygenConstrainedDays += durationDays;
    }
    if (plan?.activity?.oxygenLimited === true) {
      state.oxygenLimitedDays += durationDays;
    }
    if (plan?.activity?.alkalinityLimited === true) {
      state.alkalinityLimitedDays += durationDays;
    }
    if (plan?.activity?.temperatureConstrained === true) {
      state.temperatureConstrainedDays += durationDays;
    }
    state.cumulativeReaction = reaction(Object.fromEntries(
      Object.keys(reacted).map(key => [key,
        state.cumulativeReaction[key] + reacted[key]])));
    status = reacted.dissolvedAmmoniumNitrogenConsumedKgN > 1e-12
      ? plan?.activity?.alkalinityLimited === true
        ? 'alkalinity-limited-ammonium-nitrification'
        : plan?.activity?.oxygenLimited === true
        ? 'oxygen-limited-ammonium-nitrification'
        : plan?.activity?.temperatureConstrained === true
          ? 'temperature-constrained-ammonium-nitrification'
          : 'aerobic-ammonium-nitrification'
      : finite(plan?.activity?.oxygenResponseFactor) <= 1e-12
        ? 'oxygen-constrained-no-nitrification'
        : 'nitrification-maintained-no-ammonium';
  }
  state.lastActivity = normalizeFloodplainNitrificationState({
    ...state,
    lastActivity: plan?.activity || {}
  }).lastActivity;
  state.lastReactionReceiptDigest = reactionReceipt.digest;
  const after = floodplainNitrificationSummary(state);
  const receipt = {
    schema: FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA,
    transitionId: String(context.transitionId ||
      `floodplain-nitrification:${stableDigest({
        reachId, startDay: round(context.startDay, 8),
        reactionDigest: reactionReceipt.digest
      }).slice(9)}`),
    transferId,
    reachId,
    status,
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    reactionReceiptDigest: reactionReceipt.digest,
    activity: clone(plan?.activity || {}),
    reaction: roundedReaction(reacted),
    before,
    after,
    closure: clone(reactionReceipt.closure),
    truth: {
      ...truth(),
      localFloodplainChemistryReaction:
        reactionReceipt.truth?.localFloodplainChemistryOnly === true,
      ammoniumToNitrateNitrogenClosed:
        reactionReceipt.truth?.ammoniumToNitrateNitrogenClosed === true,
      dissolvedOxygenConsumptionClosed:
        reactionReceipt.truth?.dissolvedOxygenConsumptionClosed === true,
      alkalinityConsumptionClosed:
        reactionReceipt.truth?.alkalinityConsumptionClosed === true,
      migrationInventedHistory: false,
      nitrificationPoolsFrozen: status === 'life-disabled-dormant'
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  return {
    state: normalizeFloodplainNitrificationState(state),
    receipt: clone(receipt)
  };
}

export function floodplainNitrificationDescription() {
  return {
    stateSchema: FLOODPLAIN_NITRIFICATION_STATE_SCHEMA,
    transitionReceiptSchema: FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA,
    chemistryReactionReceiptSchema:
      FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
    donorPools: ['floodplain-dissolved-ammonium-nitrogen',
      'floodplain-dissolved-oxygen',
      'floodplain-alkalinity-as-CaCO3-equivalent'],
    receiverPools: ['floodplain-dissolved-nitrate-nitrogen'],
    processes: ['bounded-first-order-ammonium-nitrification',
      'oxygen-stoichiometry-cap-and-minimum-reserve',
      'local-ammonium-debit-and-nitrate-credit',
      'local-dissolved-oxygen-consumption',
      'local-alkalinity-consumption',
      'surface-temperature-proxy-q10-response',
      'alkalinity-capacity-limited-reaction',
      'schema-zero-transfer-migration', 'Life-off-freeze'],
    oxygenKgO2PerKgN: NITRIFICATION_OXYGEN_KG_O2_PER_KG_N,
    alkalinityDemandKgCaCO3PerKgN:
      NITRIFICATION_ALKALINITY_DEMAND_KG_CACO3_PER_KG_N,
    maximumStepDays: 1,
    truth: truth()
  };
}
