import {
  FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
  normalizeFloodplainState
} from './floodplain.mjs';

export const FLOODPLAIN_RESPIRATION_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-respiration-state/v1';
export const FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-respiration-receipt/v1';
export const AEROBIC_OXYGEN_KG_O2_PER_KG_C = 32 / 12;

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

function mineralization(source = {}) {
  return {
    dissolvedOrganicCarbonConsumedKgC: Math.max(0, finite(
      source.dissolvedOrganicCarbonConsumedKgC)),
    dissolvedInorganicCarbonProducedKgC: Math.max(0, finite(
      source.dissolvedInorganicCarbonProducedKgC)),
    dissolvedOxygenConsumedKgO2: Math.max(0, finite(
      source.dissolvedOxygenConsumedKgO2))
  };
}

function roundedMineralization(source = {}) {
  return Object.fromEntries(Object.entries(mineralization(source)).map(
    ([key, value]) => [key, round(value, 9)]));
}

function truth() {
  return {
    persistentAerobicRespirationProcessMemory: true,
    chemistryOwnership: false,
    localFloodplainDocSenderRequired: true,
    localFloodplainDicReceiverRequired: true,
    localFloodplainOxygenSenderRequired: true,
    carbonClosureRequired: true,
    oxygenConsumptionClosureRequired: true,
    oxygenLimited: true,
    atmosphericGasExchangeModeled: false,
    anaerobicPathwayModeled: false,
    microbialPopulationsResolved: false,
    mechanisticRespirationModel: false,
    scientificCalibrationClaimed: false
  };
}

export function emptyFloodplainRespirationState(options = {}) {
  return {
    schema: FLOODPLAIN_RESPIRATION_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    observedRespirationDays: 0,
    dormantDays: 0,
    oxygenLimitedDays: 0,
    cumulativeMineralization: mineralization(),
    lastActivity: {
      moistureFactor: 0,
      lifeAbundance: 0,
      activityScale: 0,
      availableDissolvedOrganicCarbonKgC: 0,
      availableDissolvedOxygenKgO2: 0,
      potentialMineralizationKgC: 0,
      oxygenCapacityKgC: 0,
      oxygenLimited: false
    },
    lastMineralizationReceiptDigest: null,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainRespirationState(source, options = {}) {
  const state = emptyFloodplainRespirationState(options);
  if (source?.schema !== FLOODPLAIN_RESPIRATION_STATE_SCHEMA) return state;
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  state.observedRespirationDays = Math.max(0,
    finite(source.observedRespirationDays));
  state.dormantDays = Math.max(0, finite(source.dormantDays));
  state.oxygenLimitedDays = Math.max(0, finite(source.oxygenLimitedDays));
  state.cumulativeMineralization = mineralization(
    source.cumulativeMineralization);
  state.lastActivity = {
    moistureFactor: clamp(finite(source.lastActivity?.moistureFactor)),
    lifeAbundance: clamp(finite(source.lastActivity?.lifeAbundance), 0, 2),
    activityScale: clamp(finite(source.lastActivity?.activityScale), 0, 1.5),
    availableDissolvedOrganicCarbonKgC: Math.max(0, finite(
      source.lastActivity?.availableDissolvedOrganicCarbonKgC)),
    availableDissolvedOxygenKgO2: Math.max(0, finite(
      source.lastActivity?.availableDissolvedOxygenKgO2)),
    potentialMineralizationKgC: Math.max(0, finite(
      source.lastActivity?.potentialMineralizationKgC)),
    oxygenCapacityKgC: Math.max(0, finite(
      source.lastActivity?.oxygenCapacityKgC)),
    oxygenLimited: source.lastActivity?.oxygenLimited === true
  };
  state.lastMineralizationReceiptDigest =
    typeof source.lastMineralizationReceiptDigest === 'string'
      ? source.lastMineralizationReceiptDigest : null;
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

export function floodplainRespirationSummary(source) {
  const state = normalizeFloodplainRespirationState(source);
  return {
    observedRespirationDays: round(state.observedRespirationDays, 8),
    dormantDays: round(state.dormantDays, 8),
    oxygenLimitedDays: round(state.oxygenLimitedDays, 8),
    cumulativeMineralization: roundedMineralization(
      state.cumulativeMineralization),
    lastActivity: {
      moistureFactor: round(state.lastActivity.moistureFactor, 9),
      lifeAbundance: round(state.lastActivity.lifeAbundance, 9),
      activityScale: round(state.lastActivity.activityScale, 9),
      availableDissolvedOrganicCarbonKgC: round(
        state.lastActivity.availableDissolvedOrganicCarbonKgC, 9),
      availableDissolvedOxygenKgO2: round(
        state.lastActivity.availableDissolvedOxygenKgO2, 9),
      potentialMineralizationKgC: round(
        state.lastActivity.potentialMineralizationKgC, 9),
      oxygenCapacityKgC: round(state.lastActivity.oxygenCapacityKgC, 9),
      oxygenLimited: state.lastActivity.oxygenLimited
    },
    truth: truth()
  };
}

export function floodplainRespirationPlan(source, floodplainSource,
  context = {}) {
  const state = normalizeFloodplainRespirationState(source);
  const floodplain = normalizeFloodplainState(floodplainSource);
  const durationDays = finite(context.durationDays, 1);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Floodplain respiration step must be greater than zero and no longer than one day');
  }
  const livingEnabled = context.livingEnabled !== false;
  const lifeAbundance = livingEnabled
    ? clamp(finite(context.lifeAbundance, 1), 0, 2) : 0;
  const hasFreeWater = floodplain.waterKg > 1e-9;
  const moistureFactor = hasFreeWater
    ? clamp(.25 + .75 * Math.sqrt(clamp(floodplain.inundatedFraction))) : 0;
  const activityScale = state.migrationCheckpoint || !livingEnabled ||
    !hasFreeWater ? 0 : clamp(moistureFactor * lifeAbundance, 0, 1.5);
  const maximumDailyDocFraction = clamp(finite(
    context.maximumDailyDocFraction, .04), 0, .25);
  const availableDoc = Math.max(0,
    finite(floodplain.chemistry.dissolvedOrganicCarbonKgC));
  const availableOxygen = Math.max(0,
    finite(floodplain.chemistry.dissolvedOxygenKgO2));
  const potentialMineralization = availableDoc * (1 - Math.exp(
    -maximumDailyDocFraction * durationDays * activityScale));
  const oxygenCapacity = availableOxygen /
    AEROBIC_OXYGEN_KG_O2_PER_KG_C;
  const carbonMineralized = Math.min(availableDoc,
    potentialMineralization, oxygenCapacity);
  const oxygenConsumed = carbonMineralized *
    AEROBIC_OXYGEN_KG_O2_PER_KG_C;
  const oxygenLimited = potentialMineralization > oxygenCapacity + 1e-12;
  return {
    durationDays: round(durationDays, 8),
    livingEnabled,
    migrationCheckpoint: state.migrationCheckpoint,
    activity: {
      moistureFactor: round(moistureFactor, 9),
      lifeAbundance: round(lifeAbundance, 9),
      activityScale: round(activityScale, 9),
      maximumDailyDocFraction: round(maximumDailyDocFraction, 9),
      availableDissolvedOrganicCarbonKgC: round(availableDoc, 9),
      availableDissolvedOxygenKgO2: round(availableOxygen, 9),
      potentialMineralizationKgC: round(potentialMineralization, 9),
      oxygenCapacityKgC: round(oxygenCapacity, 9),
      oxygenLimited
    },
    reaction: roundedMineralization({
      dissolvedOrganicCarbonConsumedKgC: carbonMineralized,
      dissolvedInorganicCarbonProducedKgC: carbonMineralized,
      dissolvedOxygenConsumedKgO2: oxygenConsumed
    }),
    stoichiometry: {
      oxygenKgO2PerKgC: round(AEROBIC_OXYGEN_KG_O2_PER_KG_C, 12)
    },
    truth: {
      localFloodplainChemistryOnly: true,
      oxygenCapacityLimitsAerobicMineralization: true,
      LifeOffHasZeroActivity: !livingEnabled ? activityScale === 0 : true,
      migrationHasZeroActivity: state.migrationCheckpoint
        ? activityScale === 0 : true,
      atmosphericGasExchangeModeled: false,
      anaerobicPathwayModeled: false
    }
  };
}

export function advanceFloodplainRespiration(source, plan,
  mineralizationSource, context = {}) {
  const state = normalizeFloodplainRespirationState(source);
  const mineralizationReceipt = mineralizationSource?.schema ===
    FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA
    ? mineralizationSource : null;
  if (!mineralizationReceipt) {
    throw new TypeError('Floodplain respiration requires the current aerobic mineralization receipt');
  }
  const reachId = String(context.reachId || '');
  if (!reachId || mineralizationReceipt.reachId !== reachId) {
    throw new Error('Floodplain respiration receipt reach lineage mismatch');
  }
  const durationDays = finite(context.durationDays, 1);
  const planned = mineralization(plan?.reaction);
  const reacted = mineralization(mineralizationReceipt.reaction);
  const amountsMatch = Object.keys(planned).every(key =>
    Math.abs(planned[key] - reacted[key]) < 1e-7);
  if (!amountsMatch) {
    throw new Error('Floodplain respiration plan and chemistry reaction quantities differ');
  }
  const before = floodplainRespirationSummary(state);
  const transferMagnitude = reacted.dissolvedOrganicCarbonConsumedKgC +
    reacted.dissolvedInorganicCarbonProducedKgC +
    reacted.dissolvedOxygenConsumedKgO2;
  let status;
  if (state.migrationCheckpoint) {
    if (transferMagnitude > 1e-12) {
      throw new Error('Floodplain respiration migration cannot move material');
    }
    state.migrationCheckpoint = false;
    status = 'initialized-after-v13-migration-no-invented-history';
  } else if (plan?.livingEnabled === false) {
    if (transferMagnitude > 1e-12) {
      throw new Error('Life-off floodplain respiration must have zero transfers');
    }
    state.dormantDays += durationDays;
    status = 'life-disabled-dormant';
  } else {
    state.observedRespirationDays += durationDays;
    if (plan?.activity?.oxygenLimited === true) {
      state.oxygenLimitedDays += durationDays;
    }
    state.cumulativeMineralization = mineralization({
      dissolvedOrganicCarbonConsumedKgC:
        state.cumulativeMineralization
          .dissolvedOrganicCarbonConsumedKgC +
        reacted.dissolvedOrganicCarbonConsumedKgC,
      dissolvedInorganicCarbonProducedKgC:
        state.cumulativeMineralization
          .dissolvedInorganicCarbonProducedKgC +
        reacted.dissolvedInorganicCarbonProducedKgC,
      dissolvedOxygenConsumedKgO2:
        state.cumulativeMineralization.dissolvedOxygenConsumedKgO2 +
        reacted.dissolvedOxygenConsumedKgO2
    });
    status = reacted.dissolvedOrganicCarbonConsumedKgC > 1e-12
      ? plan?.activity?.oxygenLimited === true
        ? 'oxygen-limited-aerobic-doc-mineralization'
        : 'aerobic-doc-mineralization'
      : plan?.activity?.oxygenLimited === true
        ? 'oxygen-limited-no-aerobic-capacity'
        : 'respiration-maintained-no-reactive-doc';
  }
  state.lastActivity = {
    moistureFactor: clamp(finite(plan?.activity?.moistureFactor)),
    lifeAbundance: clamp(finite(plan?.activity?.lifeAbundance), 0, 2),
    activityScale: clamp(finite(plan?.activity?.activityScale), 0, 1.5),
    availableDissolvedOrganicCarbonKgC: Math.max(0, finite(
      plan?.activity?.availableDissolvedOrganicCarbonKgC)),
    availableDissolvedOxygenKgO2: Math.max(0, finite(
      plan?.activity?.availableDissolvedOxygenKgO2)),
    potentialMineralizationKgC: Math.max(0, finite(
      plan?.activity?.potentialMineralizationKgC)),
    oxygenCapacityKgC: Math.max(0, finite(
      plan?.activity?.oxygenCapacityKgC)),
    oxygenLimited: plan?.activity?.oxygenLimited === true
  };
  state.lastMineralizationReceiptDigest = mineralizationReceipt.digest;
  const after = floodplainRespirationSummary(state);
  const receipt = {
    schema: FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA,
    transitionId: String(context.transitionId ||
      `floodplain-respiration:${stableDigest({
        reachId, startDay: round(context.startDay, 8),
        mineralizationDigest: mineralizationReceipt.digest
      }).slice(9)}`),
    reachId,
    status,
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    mineralizationReceiptDigest: mineralizationReceipt.digest,
    activity: clone(plan?.activity || {}),
    reaction: roundedMineralization(reacted),
    before,
    after,
    closure: clone(mineralizationReceipt.closure),
    truth: {
      ...truth(),
      localFloodplainChemistryReaction:
        mineralizationReceipt.truth?.localFloodplainChemistryOnly === true,
      localDocToDicCarbonClosed:
        mineralizationReceipt.truth?.localDocToDicCarbonClosed === true,
      dissolvedOxygenConsumptionClosed:
        mineralizationReceipt.truth
          ?.dissolvedOxygenConsumptionClosed === true,
      oxygenLimitedThisStep: plan?.activity?.oxygenLimited === true,
      migrationInventedHistory: false,
      respirationPoolsFrozen: status === 'life-disabled-dormant'
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  return {
    state: normalizeFloodplainRespirationState(state),
    receipt: clone(receipt)
  };
}

export function floodplainRespirationDescription() {
  return {
    stateSchema: FLOODPLAIN_RESPIRATION_STATE_SCHEMA,
    transitionReceiptSchema: FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA,
    chemistryReactionReceiptSchema:
      FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
    donorPools: ['floodplain-dissolved-organic-carbon',
      'floodplain-dissolved-oxygen'],
    receiverPools: ['floodplain-dissolved-inorganic-carbon'],
    processes: ['bounded-first-order-doc-mineralization',
      'oxygen-stoichiometry-and-cap', 'local-doc-debit-and-dic-credit',
      'local-dissolved-oxygen-consumption',
      'v13-zero-history-migration', 'Life-off-freeze'],
    oxygenKgO2PerKgC:
      round(AEROBIC_OXYGEN_KG_O2_PER_KG_C, 12),
    maximumStepDays: 1,
    truth: truth()
  };
}
