import {
  addRiverChemistry,
  chemistryElementInputs,
  emptyRiverChemistry,
  normalizeRiverChemistry,
  riverNitrogenSpecies,
  riverChemistryFraction,
  riverChemistryTotals,
  subtractRiverChemistry
} from './river-chemistry.mjs';
import {
  normalizeRiverSediment,
  riverSedimentTotals,
  sedimentGrainTotal
} from './geomorphic-sediment.mjs?v=0.63.0-r63.1';

export const FLOODPLAIN_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-state/v5';
export const PREVIOUS_FLOODPLAIN_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-state/v4';
export const LEGACY_FLOODPLAIN_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-state/v3';
export const OLDEST_FLOODPLAIN_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-state/v2';
export const EARLIEST_FLOODPLAIN_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-state/v1';
export const FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-exchange-receipt/v4';
export const PREVIOUS_FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-exchange-receipt/v3';
export const FLOODPLAIN_EXCHANGE_MASS_CLOSURE_SCHEMA =
  'axm.foundation-planet.floodplain-exchange-mass-closure/v1';
export const FLOODPLAIN_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA =
  'axm.foundation-planet.floodplain-exchange-mass-closure-policy/v1';
export const FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG =
  Object.freeze({
    waterResidualKg: 1,
    carbonResidualKgC: 1e-6,
    nitrogenResidualKgN: 1e-6,
    nitrateNitrogenResidualKgN: 1e-6,
    ammoniumNitrogenResidualKgN: 1e-6,
    phosphorusResidualKgP: 1e-6,
    oxygenResidualKgO2: 1e-6,
    alkalinityResidualKgCaCO3Eq: 1e-6,
    clayResidualKg: 1e-6,
    siltResidualKg: 1e-6,
    sandResidualKg: 1e-6,
    gravelResidualKg: 1e-6
  });
export const FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR = 8;
export const FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA =
  'axm.foundation-planet.floodplain-plant-resource-debit/v1';
export const FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA =
  'axm.foundation-planet.floodplain-plant-water-return/v1';
export const FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA =
  'axm.foundation-planet.floodplain-detrital-return-credit/v3';
export const PREVIOUS_FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA =
  'axm.foundation-planet.floodplain-detrital-return-credit/v2';
export const FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA =
  'axm.foundation-planet.floodplain-detrital-return-mass-closure-policy/v1';
export const FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ABSOLUTE_FLOORS_KG =
  Object.freeze({
    carbonKgC: 1e-7,
    nitrogenKgN: 1e-7,
    ammoniumNitrogenKgN: 1e-7,
    nitrateNitrogenKgN: 1e-9,
    phosphorusKgP: 1e-9
  });
export const FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ULP_FACTOR = 8;
export const FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-aerobic-mineralization-receipt/v2';
export const PREVIOUS_FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-aerobic-mineralization-receipt/v1';
export const FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-denitrification-reaction-receipt/v4';
export const PREVIOUS_FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-denitrification-reaction-receipt/v3';
export const FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-nitrification-reaction-receipt/v3';
export const PREVIOUS_FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-nitrification-reaction-receipt/v2';
export const FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-gas-exchange-receipt/v3';
export const PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-gas-exchange-receipt/v2';
export const FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA =
  'axm.foundation-planet.floodplain-reaction-mass-closure-policy/v1';
export const FLOODPLAIN_REACTION_MASS_CLOSURE_ABSOLUTE_FLOORS_KG =
  Object.freeze({
    carbonKgC: 1e-7,
    nitrogenKgN: 1e-7,
    ammoniumNitrogenKgN: 1e-9,
    oxygenKgO2: 1e-7,
    alkalinityKgCaCO3Eq: 1e-7
  });
export const FLOODPLAIN_REACTION_MASS_CLOSURE_ULP_FACTOR = 8;

const GRAINS = Object.freeze(['clay', 'silt', 'sand', 'gravel']);
const CHEMISTRY_KEYS = Object.freeze([
  'carbonKgC', 'nitrogenKgN', 'nitrateNitrogenKgN',
  'ammoniumNitrogenKgN', 'phosphorusKgP', 'oxygenKgO2',
  'alkalinityKgCaCO3Eq'
]);
const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

export function floodplainExchangeMassClosureToleranceKg(identity,
  signedOperandsKg = []) {
  const absoluteFloorKg =
    FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG[identity];
  if (!Number.isFinite(absoluteFloorKg)) {
    throw new Error(`Unknown floodplain exchange closure identity: ${identity}`);
  }
  const absoluteOperandSumKg = signedOperandsKg.reduce((sum, operand) =>
    sum + Math.abs(finite(operand)), 0);
  return round(Math.max(absoluteFloorKg,
    absoluteOperandSumKg * Number.EPSILON *
      FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR), 12);
}

function floodplainExchangeMassClosureIdentity(identity, signedOperandsKg) {
  const measuredResidualKg = signedOperandsKg.reduce((sum, operand) =>
    sum + finite(operand), 0);
  const numericToleranceKg = floodplainExchangeMassClosureToleranceKg(
    identity, signedOperandsKg);
  return {
    signedOperandsKg: signedOperandsKg.map(Number),
    residualKg: Number(measuredResidualKg),
    numericToleranceKg,
    toleranceUtilization: round(Math.abs(measuredResidualKg) /
      numericToleranceKg, 12),
    closed: Math.abs(measuredResidualKg) <= numericToleranceKg
  };
}

function floodplainExchangeMassClosureReceipt(identityInputs) {
  const identities = Object.fromEntries(Object.entries(identityInputs).map(
    ([identity, signedOperandsKg]) => [identity,
      floodplainExchangeMassClosureIdentity(identity, signedOperandsKg)]));
  const entries = Object.values(identities);
  return {
    schema: FLOODPLAIN_EXCHANGE_MASS_CLOSURE_SCHEMA,
    policy: {
      schema: FLOODPLAIN_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
      absoluteFloorsKg: {
        ...FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
      },
      ulpFactor: FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
      scaleBasis: 'sum-of-absolute-unrounded-signed-operands-kg'
    },
    identities,
    identityCount: entries.length,
    maximumResidualKg: Math.max(0, ...entries.map(entry =>
      Math.abs(entry.residualKg))),
    maximumToleranceKg: Math.max(0, ...entries.map(entry =>
      entry.numericToleranceKg)),
    maximumToleranceUtilization: Math.max(0, ...entries.map(entry =>
      entry.toleranceUtilization)),
    conservationClosed: entries.every(entry => entry.closed),
    measuredResidualsPreserved: true
  };
}

export function floodplainDetritalReturnMassClosureToleranceKg(channel,
  ...values) {
  const absoluteFloorKg =
    FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ABSOLUTE_FLOORS_KG[channel];
  if (!Number.isFinite(absoluteFloorKg)) {
    throw new Error(`Unknown floodplain detrital-return material channel: ${channel}`);
  }
  const magnitudeKg = Math.max(1, ...values.map(value =>
    Math.abs(finite(value))));
  return round(Math.max(absoluteFloorKg,
    magnitudeKg * Number.EPSILON *
      FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ULP_FACTOR), 12);
}

export function floodplainReactionMassClosureToleranceKg(channel,
  ...values) {
  const absoluteFloorKg =
    FLOODPLAIN_REACTION_MASS_CLOSURE_ABSOLUTE_FLOORS_KG[channel];
  if (!Number.isFinite(absoluteFloorKg)) {
    throw new Error(`Unknown floodplain reaction material channel: ${channel}`);
  }
  const magnitudeKg = Math.max(1, ...values.map(value =>
    Math.abs(finite(value))));
  return round(Math.max(absoluteFloorKg,
    magnitudeKg * Number.EPSILON *
      FLOODPLAIN_REACTION_MASS_CLOSURE_ULP_FACTOR), 12);
}

function reactionNumericClosure(identities = {}, numericToleranceKg = {}) {
  const pairs = Object.keys(identities).map(key => [
    Math.abs(finite(identities[key])),
    finite(numericToleranceKg[key])
  ]);
  const maximumResidualKg = Math.max(0,
    ...pairs.map(([residual]) => residual));
  const maximumToleranceUtilization = Math.max(0,
    ...pairs.map(([residual, tolerance]) =>
      tolerance > 0 ? residual / tolerance : Infinity));
  return {
    closure: {
      maximumResidualKg: round(maximumResidualKg, 12),
      maximumToleranceUtilization: round(
        maximumToleranceUtilization, 12),
      ...identities,
      numericToleranceKg,
      policy: {
        schema: FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
        absoluteFloorsKg: {
          ...FLOODPLAIN_REACTION_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
        },
        ulpFactor: FLOODPLAIN_REACTION_MASS_CLOSURE_ULP_FACTOR,
        recordedOperandScale: true,
        perIdentity: true,
        arbitraryToleranceAuthority: false
      }
    },
    allIdentitiesClosed: pairs.every(([residual, tolerance]) =>
      tolerance > 0 && residual <= tolerance)
  };
}

function grains(source = {}) {
  return Object.fromEntries(GRAINS.map(id => [id,
    Math.max(0, finite(source?.[id]))]));
}

function addGrains(left = {}, right = {}) {
  return Object.fromEntries(GRAINS.map(id => [id,
    Math.max(0, finite(left?.[id])) + Math.max(0, finite(right?.[id]))]));
}

function subtractGrains(left = {}, right = {}) {
  const result = {};
  for (const id of GRAINS) {
    const available = Math.max(0, finite(left?.[id]));
    const debit = Math.max(0, finite(right?.[id]));
    if (debit > available + 1e-7) {
      throw new Error(`Floodplain sediment donor exhausted: ${id}`);
    }
    result[id] = Math.max(0, available - debit);
  }
  return result;
}

function scaleGrains(source = {}, fraction = 1) {
  const bounded = clamp(finite(fraction));
  return Object.fromEntries(GRAINS.map(id => [id,
    Math.max(0, finite(source?.[id])) * bounded]));
}

function roundedGrains(source = {}, digits = 9) {
  return Object.fromEntries(GRAINS.map(id => [id,
    round(Math.max(0, finite(source?.[id])), digits)]));
}

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
    persistentReachAdjacentReservoir: true,
    waterChemistryAndMineralSedimentOwned: true,
    detritalCarbonNitrogenPhosphorusReceiverAvailable: true,
    nitrateAndAmmoniumMaterialPools: true,
    dissolvedInorganicNitrogenIsCompatibilitySum: true,
    exactNitrateAmmoniumWaterFractionTransport: true,
    nitritePoolResolved: false,
    nitrificationReactionModeled: true,
    nitrificationAmmoniumToNitrate: true,
    nitrificationDissolvedOxygenDebited: true,
    persistentAlkalinityMaterialPool: true,
    nitrificationAlkalinityDemandDiagnostic: false,
    nitrificationAlkalinityMaterialOwnerDebited: true,
    denitrificationAlkalinityMaterialOwnerCredited: true,
    channelFloodplainExchangeScaleAwareNumericClosure: true,
    channelFloodplainExchangePerIdentityNumericBounds: true,
    channelFloodplainExchangeMeasuredResidualsPreserved: true,
    channelFloodplainExchangeFixedAbsoluteToleranceOnly: false,
    reactionReceiptsScaleAwareNumericClosure: true,
    reactionReceiptsPerIdentityNumericBounds: true,
    reactionReceiptsMeasuredResidualsPreserved: true,
    reactionReceiptsFixedAbsoluteToleranceOnly: false,
    alkalinityIsAcidNeutralizingCapacityEquivalent: true,
    carbonateSpeciationResolved: false,
    nitrificationPHFeedbackModeled: false,
    bankfullThresholdParameterized: true,
    finiteReturnFlow: true,
    grainSelectiveDeposition: true,
    resolvedInundationHydraulics: false,
    resolvedFloodplainTopography: false,
    scientificFloodForecast: false
  };
}

export function emptyFloodplainState(options = {}) {
  return {
    schema: FLOODPLAIN_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    waterKg: 0,
    chemistry: emptyRiverChemistry(),
    suspendedSedimentKg: grains(),
    depositedSedimentKg: grains(),
    cumulativeOverbankWaterKg: 0,
    cumulativeReturnWaterKg: 0,
    cumulativeDepositedSedimentKg: grains(),
    cumulativeDetritalReturn: {
      carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0
    },
    inundatedFraction: 0,
    lastDetritalReturnReceipt: null,
    lastAerobicMineralizationReceipt: null,
    lastDenitrificationReactionReceipt: null,
    lastNitrificationReactionReceipt: null,
    lastGasExchangeReceipt: null,
    lastExchangeReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainState(source, options = {}) {
  const state = emptyFloodplainState(options);
  if (![FLOODPLAIN_STATE_SCHEMA, PREVIOUS_FLOODPLAIN_STATE_SCHEMA,
    LEGACY_FLOODPLAIN_STATE_SCHEMA, OLDEST_FLOODPLAIN_STATE_SCHEMA,
    EARLIEST_FLOODPLAIN_STATE_SCHEMA]
    .includes(source?.schema)) return state;
  state.migrationCheckpoint = source.schema !== FLOODPLAIN_STATE_SCHEMA ||
    source.migrationCheckpoint === true;
  state.waterKg = Math.max(0, finite(source.waterKg));
  state.chemistry = normalizeRiverChemistry(source.chemistry);
  state.suspendedSedimentKg = grains(source.suspendedSedimentKg);
  state.depositedSedimentKg = grains(source.depositedSedimentKg);
  state.cumulativeOverbankWaterKg = Math.max(0,
    finite(source.cumulativeOverbankWaterKg));
  state.cumulativeReturnWaterKg = Math.max(0,
    finite(source.cumulativeReturnWaterKg));
  state.cumulativeDepositedSedimentKg = grains(
    source.cumulativeDepositedSedimentKg);
  state.cumulativeDetritalReturn = {
    carbonKgC: Math.max(0, finite(
      source.cumulativeDetritalReturn?.carbonKgC)),
    nitrogenKgN: Math.max(0, finite(
      source.cumulativeDetritalReturn?.nitrogenKgN)),
    phosphorusKgP: Math.max(0, finite(
      source.cumulativeDetritalReturn?.phosphorusKgP))
  };
  state.inundatedFraction = clamp(finite(source.inundatedFraction));
  state.lastDetritalReturnReceipt =
    source.lastDetritalReturnReceipt?.schema ===
      FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA
      ? clone(source.lastDetritalReturnReceipt) : null;
  state.lastAerobicMineralizationReceipt =
    source.lastAerobicMineralizationReceipt?.schema ===
      FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA
      ? clone(source.lastAerobicMineralizationReceipt) : null;
  state.lastDenitrificationReactionReceipt =
    source.lastDenitrificationReactionReceipt?.schema ===
      FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA
      ? clone(source.lastDenitrificationReactionReceipt) : null;
  state.lastNitrificationReactionReceipt =
    source.lastNitrificationReactionReceipt?.schema ===
      FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA
      ? clone(source.lastNitrificationReactionReceipt) : null;
  state.lastGasExchangeReceipt = source.lastGasExchangeReceipt?.schema ===
    FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA
    ? clone(source.lastGasExchangeReceipt) : null;
  state.lastExchangeReceipt = source.lastExchangeReceipt?.schema ===
    FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA
    ? clone(source.lastExchangeReceipt) : null;
  return state;
}

export function floodplainTotals(source) {
  const state = normalizeFloodplainState(source);
  const nitrogenSpecies = riverNitrogenSpecies(state.chemistry);
  return {
    waterKg: round(state.waterKg, 6),
    chemistry: Object.fromEntries(Object.entries(
      riverChemistryTotals(state.chemistry)).map(([key, value]) =>
        [key, round(value, 9)])),
    nitrogenSpecies: {
      nitrateNitrogenKgN: round(
        nitrogenSpecies.dissolvedNitrateNitrogenKgN, 9),
      ammoniumNitrogenKgN: round(
        nitrogenSpecies.dissolvedAmmoniumNitrogenKgN, 9),
      dissolvedInorganicNitrogenKgN: round(
        nitrogenSpecies.dissolvedInorganicNitrogenKgN, 9)
    },
    suspendedSedimentKg: roundedGrains(state.suspendedSedimentKg),
    depositedSedimentKg: roundedGrains(state.depositedSedimentKg),
    totalSedimentKg: round(sedimentGrainTotal(state.suspendedSedimentKg) +
      sedimentGrainTotal(state.depositedSedimentKg), 9),
    cumulativeDetritalReturn: Object.fromEntries(Object.entries(
      state.cumulativeDetritalReturn).map(([key, value]) =>
      [key, round(value, 9)])),
    inundatedFraction: round(state.inundatedFraction, 9)
  };
}

export function floodplainPlantResourceCapacity(source, durationDays = 1,
  options = {}) {
  const state = normalizeFloodplainState(source);
  const duration = clamp(finite(durationDays, 1), 0, 1);
  const maximumDailyWaterFraction = clamp(finite(
    options.maximumDailyWaterFraction, .01) * duration, 0, .25);
  const maximumDailyPhosphorusFraction = clamp(finite(
    options.maximumDailyPhosphorusFraction, .02) * duration, 0, .25);
  const phosphorusKgP = Math.max(0, finite(
    state.chemistry.dissolvedInorganicPhosphorusKgP));
  return {
    maximumDailyWaterFraction: round(maximumDailyWaterFraction, 9),
    maximumDailyPhosphorusFraction: round(
      maximumDailyPhosphorusFraction, 9),
    waterKg: round(state.waterKg * maximumDailyWaterFraction, 9),
    phosphorusKgP: round(phosphorusKgP *
      maximumDailyPhosphorusFraction, 12),
    source: {
      waterKg: round(state.waterKg, 9),
      dissolvedInorganicPhosphorusKgP: round(phosphorusKgP, 12)
    }
  };
}

function normalizedPlantResourceAllocations(allocations = []) {
  const normalized = [...allocations].map(entry => ({
    transferId: String(entry?.transferId || ''),
    guildId: String(entry?.guildId || ''),
    phosphorusKgP: Math.max(0, finite(entry?.phosphorusKgP)),
    waterKg: Math.max(0, finite(entry?.waterKg))
  })).sort((a, b) => a.transferId.localeCompare(b.transferId));
  if (normalized.some(entry => !entry.transferId || !entry.guildId) ||
    new Set(normalized.map(entry => entry.transferId)).size !==
      normalized.length) {
    throw new Error('Floodplain plant resource exchange requires unique bound uptake transfers');
  }
  return normalized;
}

function normalizedPlantWaterReturns(returns = []) {
  const normalized = [...returns].map(entry => ({
    transferId: String(entry?.transferId || ''),
    guildId: String(entry?.guildId || ''),
    waterKg: Math.max(0, finite(entry?.waterKg))
  })).sort((a, b) => a.transferId.localeCompare(b.transferId));
  if (normalized.some(entry => !entry.transferId || !entry.guildId) ||
    new Set(normalized.map(entry => entry.transferId)).size !==
      normalized.length) {
    throw new Error('Floodplain plant water return requires unique bound transfers');
  }
  return normalized;
}

export function applyFloodplainPlantResourceExchange(source,
  uptakeAllocations = [], waterReturns = [], context = {}) {
  const state = normalizeFloodplainState(source);
  const durationDays = clamp(finite(context.durationDays, 1), 0, 1);
  const capacity = floodplainPlantResourceCapacity(state, durationDays,
    context);
  const uptake = normalizedPlantResourceAllocations(uptakeAllocations);
  const returns = normalizedPlantWaterReturns(waterReturns);
  const uptakeTotals = uptake.reduce((sum, entry) => ({
    phosphorusKgP: sum.phosphorusKgP + entry.phosphorusKgP,
    waterKg: sum.waterKg + entry.waterKg
  }), { phosphorusKgP: 0, waterKg: 0 });
  const returnedWaterKg = returns.reduce((sum, entry) =>
    sum + entry.waterKg, 0);
  if (uptakeTotals.waterKg > capacity.waterKg + 1e-6 ||
    uptakeTotals.phosphorusKgP > capacity.phosphorusKgP + 1e-9) {
    throw new Error('Floodplain plant resource uptake exceeds bounded local capacity');
  }
  const reachId = String(context.reachId || '');
  if (!reachId) {
    throw new Error('Floodplain plant resource exchange requires a reach ID');
  }
  const before = {
    waterKg: state.waterKg,
    phosphorusKgP: finite(
      state.chemistry.dissolvedInorganicPhosphorusKgP)
  };
  state.waterKg = Math.max(0, state.waterKg - uptakeTotals.waterKg);
  state.chemistry.dissolvedInorganicPhosphorusKgP = Math.max(0,
    finite(state.chemistry.dissolvedInorganicPhosphorusKgP) -
      uptakeTotals.phosphorusKgP);
  const afterDebit = {
    waterKg: state.waterKg,
    phosphorusKgP: finite(
      state.chemistry.dissolvedInorganicPhosphorusKgP)
  };
  const debitReceipt = {
    schema: FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
    reachId,
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    allocations: uptake.map(entry => ({
      ...entry,
      phosphorusKgP: round(entry.phosphorusKgP, 12),
      waterKg: round(entry.waterKg, 9)
    })),
    before: { waterKg: round(before.waterKg, 9),
      phosphorusKgP: round(before.phosphorusKgP, 12) },
    debited: { waterKg: round(uptakeTotals.waterKg, 9),
      phosphorusKgP: round(uptakeTotals.phosphorusKgP, 12) },
    after: { waterKg: round(afterDebit.waterKg, 9),
      phosphorusKgP: round(afterDebit.phosphorusKgP, 12) },
    capacity,
    closure: {
      waterResidualKg: round(before.waterKg - uptakeTotals.waterKg -
        afterDebit.waterKg, 9),
      phosphorusResidualKgP: round(before.phosphorusKgP -
        uptakeTotals.phosphorusKgP - afterDebit.phosphorusKgP, 12)
    },
    truth: {
      persistentFloodplainSenderDebited: true,
      exactPerGuildTransferIds: true,
      finiteWaterAndPhosphorusDonors: true,
      boundedDailyUptake: uptakeTotals.waterKg <= capacity.waterKg + 1e-6 &&
        uptakeTotals.phosphorusKgP <= capacity.phosphorusKgP + 1e-9,
      waterAndPhosphorusClosed:
        Math.abs(before.waterKg - uptakeTotals.waterKg -
          afterDebit.waterKg) < 1e-6 &&
        Math.abs(before.phosphorusKgP - uptakeTotals.phosphorusKgP -
          afterDebit.phosphorusKgP) < 1e-9,
      plantUptakeCreatesResources: false
    }
  };
  debitReceipt.digest = stableDigest(debitReceipt);

  const beforeReturnWaterKg = state.waterKg;
  state.waterKg += returnedWaterKg;
  const referenceCapacityKg = Math.max(0, finite(
    state.lastExchangeReceipt?.controls?.floodplainReferenceCapacityKg));
  if (referenceCapacityKg > 0) {
    state.inundatedFraction = clamp(state.waterKg / referenceCapacityKg);
  }
  const returnReceipt = {
    schema: FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA,
    reachId,
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    transfers: returns.map(entry => ({
      ...entry, waterKg: round(entry.waterKg, 9)
    })),
    beforeWaterKg: round(beforeReturnWaterKg, 9),
    creditedWaterKg: round(returnedWaterKg, 9),
    afterWaterKg: round(state.waterKg, 9),
    closure: {
      waterResidualKg: round(beforeReturnWaterKg + returnedWaterKg -
        state.waterKg, 9)
    },
    truth: {
      persistentFloodplainReceiverCredited: true,
      exactPerGuildTransferIds: true,
      mortalityWaterCreatesWater: false,
      localReceiverOnly: true,
      atmospherePartitionResolved: false,
      waterClosed: Math.abs(beforeReturnWaterKg + returnedWaterKg -
        state.waterKg) < 1e-6
    }
  };
  returnReceipt.digest = stableDigest(returnReceipt);
  return {
    state: normalizeFloodplainState(state),
    debitReceipt: clone(debitReceipt),
    returnReceipt: clone(returnReceipt)
  };
}

function normalizedDetritalReturns(allocations = []) {
  const normalized = [...allocations].map(entry => ({
    transferId: String(entry?.transferId || ''),
    guildId: String(entry?.guildId || ''),
    pool: String(entry?.pool || ''),
    carbonKgC: Math.max(0, finite(entry?.carbonKgC)),
    nitrogenKgN: Math.max(0, finite(entry?.nitrogenKgN)),
    phosphorusKgP: Math.max(0, finite(entry?.phosphorusKgP))
  })).sort((a, b) => a.transferId.localeCompare(b.transferId));
  if (normalized.some(entry => !entry.transferId || !entry.guildId ||
      !['standingDead', 'litter'].includes(entry.pool)) ||
    new Set(normalized.map(entry => entry.transferId)).size !==
      normalized.length) {
    throw new Error('Floodplain detrital return requires unique bound guild-pool transfers');
  }
  return normalized;
}

export function applyFloodplainDetritalReturn(source, allocations = [],
  context = {}) {
  const state = normalizeFloodplainState(source);
  const reachId = String(context.reachId || '');
  if (!reachId) throw new Error('Floodplain detrital return requires a reach ID');
  const entries = normalizedDetritalReturns(allocations);
  if (context.livingEnabled === false && entries.some(entry =>
    entry.carbonKgC > 1e-12 || entry.nitrogenKgN > 1e-12 ||
    entry.phosphorusKgP > 1e-15)) {
    throw new Error('Life-off cannot credit detrital return');
  }
  const totals = entries.reduce((sum, entry) => ({
    carbonKgC: sum.carbonKgC + entry.carbonKgC,
    nitrogenKgN: sum.nitrogenKgN + entry.nitrogenKgN,
    phosphorusKgP: sum.phosphorusKgP + entry.phosphorusKgP
  }), { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0 });
  const before = riverChemistryTotals(state.chemistry);
  const beforeNitrogenSpecies = riverNitrogenSpecies(state.chemistry);
  state.chemistry = addRiverChemistry(state.chemistry, {
    dissolvedOrganicCarbonKgC: totals.carbonKgC,
    dissolvedAmmoniumNitrogenKgN: totals.nitrogenKgN,
    dissolvedInorganicPhosphorusKgP: totals.phosphorusKgP
  });
  state.cumulativeDetritalReturn.carbonKgC += totals.carbonKgC;
  state.cumulativeDetritalReturn.nitrogenKgN += totals.nitrogenKgN;
  state.cumulativeDetritalReturn.phosphorusKgP += totals.phosphorusKgP;
  const after = riverChemistryTotals(state.chemistry);
  const afterNitrogenSpecies = riverNitrogenSpecies(state.chemistry);
  const recordedBefore = Object.fromEntries(Object.entries(before)
    .map(([key, value]) => [key, round(value, 9)]));
  const recordedBeforeNitrogenSpecies = {
    nitrateNitrogenKgN: round(
      beforeNitrogenSpecies.dissolvedNitrateNitrogenKgN, 9),
    ammoniumNitrogenKgN: round(
      beforeNitrogenSpecies.dissolvedAmmoniumNitrogenKgN, 9)
  };
  const recordedCredited = {
    carbonKgC: round(totals.carbonKgC, 9),
    nitrogenKgN: round(totals.nitrogenKgN, 9),
    phosphorusKgP: round(totals.phosphorusKgP, 12)
  };
  const recordedAfter = Object.fromEntries(Object.entries(after)
    .map(([key, value]) => [key, round(value, 9)]));
  const recordedAfterNitrogenSpecies = {
    nitrateNitrogenKgN: round(
      afterNitrogenSpecies.dissolvedNitrateNitrogenKgN, 9),
    ammoniumNitrogenKgN: round(
      afterNitrogenSpecies.dissolvedAmmoniumNitrogenKgN, 9)
  };
  const closure = {
    carbonResidualKgC: round(recordedAfter.carbonKgC -
      recordedBefore.carbonKgC - recordedCredited.carbonKgC, 12),
    nitrogenResidualKgN: round(recordedAfter.nitrogenKgN -
      recordedBefore.nitrogenKgN - recordedCredited.nitrogenKgN, 12),
    ammoniumNitrogenResidualKgN: round(
      recordedAfterNitrogenSpecies.ammoniumNitrogenKgN -
      recordedBeforeNitrogenSpecies.ammoniumNitrogenKgN -
      recordedCredited.nitrogenKgN, 12),
    nitrateNitrogenResidualKgN: round(
      recordedAfterNitrogenSpecies.nitrateNitrogenKgN -
      recordedBeforeNitrogenSpecies.nitrateNitrogenKgN, 12),
    phosphorusResidualKgP: round(recordedAfter.phosphorusKgP -
      recordedBefore.phosphorusKgP - recordedCredited.phosphorusKgP, 12)
  };
  const numericToleranceKg = {
    carbonKgC: floodplainDetritalReturnMassClosureToleranceKg(
      'carbonKgC', recordedBefore.carbonKgC,
      recordedCredited.carbonKgC, recordedAfter.carbonKgC),
    nitrogenKgN: floodplainDetritalReturnMassClosureToleranceKg(
      'nitrogenKgN', recordedBefore.nitrogenKgN,
      recordedCredited.nitrogenKgN, recordedAfter.nitrogenKgN),
    ammoniumNitrogenKgN: floodplainDetritalReturnMassClosureToleranceKg(
      'ammoniumNitrogenKgN',
      recordedBeforeNitrogenSpecies.ammoniumNitrogenKgN,
      recordedCredited.nitrogenKgN,
      recordedAfterNitrogenSpecies.ammoniumNitrogenKgN),
    nitrateNitrogenKgN: floodplainDetritalReturnMassClosureToleranceKg(
      'nitrateNitrogenKgN',
      recordedBeforeNitrogenSpecies.nitrateNitrogenKgN,
      recordedAfterNitrogenSpecies.nitrateNitrogenKgN),
    phosphorusKgP: floodplainDetritalReturnMassClosureToleranceKg(
      'phosphorusKgP', recordedBefore.phosphorusKgP,
      recordedCredited.phosphorusKgP, recordedAfter.phosphorusKgP)
  };
  const residualTolerancePairs = [
    [Math.abs(closure.carbonResidualKgC), numericToleranceKg.carbonKgC],
    [Math.abs(closure.nitrogenResidualKgN), numericToleranceKg.nitrogenKgN],
    [Math.abs(closure.ammoniumNitrogenResidualKgN),
      numericToleranceKg.ammoniumNitrogenKgN],
    [Math.abs(closure.nitrateNitrogenResidualKgN),
      numericToleranceKg.nitrateNitrogenKgN],
    [Math.abs(closure.phosphorusResidualKgP),
      numericToleranceKg.phosphorusKgP]
  ];
  const maximumResidualKg = Math.max(0,
    ...residualTolerancePairs.map(([residual]) => residual));
  const maximumToleranceUtilization = Math.max(0,
    ...residualTolerancePairs.map(([residual, tolerance]) =>
      residual / tolerance));
  const allChannelsClosed = residualTolerancePairs.every(
    ([residual, tolerance]) => residual <= tolerance);
  const receipt = {
    schema: FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
    reachId,
    startDay: round(context.startDay, 8),
    durationDays: round(finite(context.durationDays, 1), 8),
    allocations: entries.map(entry => ({
      ...entry,
      carbonKgC: round(entry.carbonKgC, 9),
      nitrogenKgN: round(entry.nitrogenKgN, 9),
      phosphorusKgP: round(entry.phosphorusKgP, 12)
    })),
    before: recordedBefore,
    beforeNitrogenSpecies: recordedBeforeNitrogenSpecies,
    credited: recordedCredited,
    after: recordedAfter,
    afterNitrogenSpecies: recordedAfterNitrogenSpecies,
    pools: {
      carbon: 'dissolvedOrganicCarbonKgC',
      nitrogen: 'dissolvedAmmoniumNitrogenKgN',
      phosphorus: 'dissolvedInorganicPhosphorusKgP'
    },
    closure: {
      maximumResidualKg: round(maximumResidualKg, 12),
      maximumToleranceUtilization: round(
        maximumToleranceUtilization, 12),
      ...closure,
      numericToleranceKg,
      policy: {
        schema: FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA,
        absoluteFloorsKg: {
          ...FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
        },
        ulpFactor: FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ULP_FACTOR,
        recordedOperandScale: true,
        perMaterialChannel: true,
        arbitraryToleranceAuthority: false
      }
    },
    truth: {
      persistentFloodplainChemistryReceiverCredited: true,
      exactPerGuildPoolTransferIds: true,
      detritalNitrogenCreditedToAmmoniumPool: true,
      nitratePoolUnchanged: Math.abs(closure.nitrateNitrogenResidualKgN) <=
        numericToleranceKg.nitrateNitrogenKgN,
      carbonNitrogenPhosphorusClosed: allChannelsClosed,
      scaleAwareFloatingPointClosure: true,
      perMaterialChannelNumericBounds: true,
      measuredResidualsPreserved: true,
      fixedAbsoluteToleranceOnly: false,
      localReceiverOnly: true,
      soilReceiverModeled: false,
      atmosphereRespirationModeled: false,
      oxygenConsumptionModeled: false,
      decompositionCreatesMaterial: false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastDetritalReturnReceipt = clone(receipt);
  return { state: normalizeFloodplainState(state), receipt: clone(receipt) };
}

export function applyFloodplainAerobicMineralization(source, reaction = {},
  context = {}) {
  const state = normalizeFloodplainState(source);
  const reachId = String(context.reachId || '');
  if (!reachId) {
    throw new Error('Floodplain aerobic mineralization requires a reach ID');
  }
  const carbonConsumedKgC = Math.max(0, finite(
    reaction.dissolvedOrganicCarbonConsumedKgC));
  const carbonProducedKgC = Math.max(0, finite(
    reaction.dissolvedInorganicCarbonProducedKgC));
  const oxygenConsumedKgO2 = Math.max(0, finite(
    reaction.dissolvedOxygenConsumedKgO2));
  const oxygenKgO2PerKgC = 32 / 12;
  if (Math.abs(carbonConsumedKgC - carbonProducedKgC) >
      floodplainReactionMassClosureToleranceKg('carbonKgC',
        carbonConsumedKgC, carbonProducedKgC) ||
    Math.abs(oxygenConsumedKgO2 - carbonConsumedKgC *
      oxygenKgO2PerKgC) >
      floodplainReactionMassClosureToleranceKg('oxygenKgO2',
        oxygenConsumedKgO2, carbonConsumedKgC,
        carbonConsumedKgC * oxygenKgO2PerKgC)) {
    throw new Error('Floodplain aerobic mineralization reaction is not stoichiometrically closed');
  }
  if (context.livingEnabled === false &&
    carbonConsumedKgC + carbonProducedKgC + oxygenConsumedKgO2 > 1e-12) {
    throw new Error('Life-off cannot apply floodplain aerobic mineralization');
  }
  const before = normalizeRiverChemistry(state.chemistry);
  state.chemistry = subtractRiverChemistry(state.chemistry, {
    dissolvedOrganicCarbonKgC: carbonConsumedKgC,
    dissolvedOxygenKgO2: oxygenConsumedKgO2
  });
  state.chemistry = addRiverChemistry(state.chemistry, {
    dissolvedInorganicCarbonKgC: carbonProducedKgC
  });
  const after = normalizeRiverChemistry(state.chemistry);
  const recordedReaction = {
    dissolvedOrganicCarbonConsumedKgC: round(carbonConsumedKgC, 9),
    dissolvedInorganicCarbonProducedKgC: round(carbonProducedKgC, 9),
    dissolvedOxygenConsumedKgO2: round(oxygenConsumedKgO2, 9)
  };
  const recordedBefore = {
    dissolvedOrganicCarbonKgC: round(
      before.dissolvedOrganicCarbonKgC, 9),
    dissolvedInorganicCarbonKgC: round(
      before.dissolvedInorganicCarbonKgC, 9),
    dissolvedOxygenKgO2: round(before.dissolvedOxygenKgO2, 9)
  };
  const recordedAfter = {
    dissolvedOrganicCarbonKgC: round(
      after.dissolvedOrganicCarbonKgC, 9),
    dissolvedInorganicCarbonKgC: round(
      after.dissolvedInorganicCarbonKgC, 9),
    dissolvedOxygenKgO2: round(after.dissolvedOxygenKgO2, 9)
  };
  const closure = {
    dissolvedOrganicCarbonDebitResidualKgC: round(
      recordedBefore.dissolvedOrganicCarbonKgC -
      recordedAfter.dissolvedOrganicCarbonKgC -
      recordedReaction.dissolvedOrganicCarbonConsumedKgC, 12),
    dissolvedInorganicCarbonCreditResidualKgC: round(
      recordedAfter.dissolvedInorganicCarbonKgC -
      recordedBefore.dissolvedInorganicCarbonKgC -
      recordedReaction.dissolvedInorganicCarbonProducedKgC, 12),
    carbonResidualKgC: round(
      recordedAfter.dissolvedOrganicCarbonKgC +
      recordedAfter.dissolvedInorganicCarbonKgC -
      recordedBefore.dissolvedOrganicCarbonKgC -
      recordedBefore.dissolvedInorganicCarbonKgC, 12),
    dissolvedOxygenDebitResidualKgO2: round(
      recordedBefore.dissolvedOxygenKgO2 -
      recordedAfter.dissolvedOxygenKgO2 -
      recordedReaction.dissolvedOxygenConsumedKgO2, 12),
    stoichiometricOxygenResidualKgO2: round(
      recordedReaction.dissolvedOxygenConsumedKgO2 -
      recordedReaction.dissolvedOrganicCarbonConsumedKgC *
      oxygenKgO2PerKgC, 12)
  };
  const numericToleranceKg = {
    dissolvedOrganicCarbonDebitResidualKgC:
      floodplainReactionMassClosureToleranceKg('carbonKgC',
        recordedBefore.dissolvedOrganicCarbonKgC,
        recordedAfter.dissolvedOrganicCarbonKgC,
        recordedReaction.dissolvedOrganicCarbonConsumedKgC),
    dissolvedInorganicCarbonCreditResidualKgC:
      floodplainReactionMassClosureToleranceKg('carbonKgC',
        recordedAfter.dissolvedInorganicCarbonKgC,
        recordedBefore.dissolvedInorganicCarbonKgC,
        recordedReaction.dissolvedInorganicCarbonProducedKgC),
    carbonResidualKgC: floodplainReactionMassClosureToleranceKg(
      'carbonKgC', recordedAfter.dissolvedOrganicCarbonKgC,
      recordedAfter.dissolvedInorganicCarbonKgC,
      recordedBefore.dissolvedOrganicCarbonKgC,
      recordedBefore.dissolvedInorganicCarbonKgC),
    dissolvedOxygenDebitResidualKgO2:
      floodplainReactionMassClosureToleranceKg('oxygenKgO2',
        recordedBefore.dissolvedOxygenKgO2,
        recordedAfter.dissolvedOxygenKgO2,
        recordedReaction.dissolvedOxygenConsumedKgO2),
    stoichiometricOxygenResidualKgO2:
      floodplainReactionMassClosureToleranceKg('oxygenKgO2',
        recordedReaction.dissolvedOxygenConsumedKgO2,
        recordedReaction.dissolvedOrganicCarbonConsumedKgC,
        recordedReaction.dissolvedOrganicCarbonConsumedKgC *
          oxygenKgO2PerKgC)
  };
  const numericClosure = reactionNumericClosure(closure,
    numericToleranceKg);
  const receipt = {
    schema: FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
    reachId,
    startDay: round(context.startDay, 8),
    durationDays: round(finite(context.durationDays, 1), 8),
    reaction: recordedReaction,
    before: recordedBefore,
    after: recordedAfter,
    closure: numericClosure.closure,
    truth: {
      persistentFloodplainChemistryMutated: true,
      localFloodplainChemistryOnly: true,
      dissolvedOrganicCarbonSenderDebited: true,
      dissolvedInorganicCarbonReceiverCredited: true,
      dissolvedOxygenSenderDebited: true,
      localDocToDicCarbonClosed:
        Math.abs(closure.dissolvedOrganicCarbonDebitResidualKgC) <=
          numericToleranceKg.dissolvedOrganicCarbonDebitResidualKgC &&
        Math.abs(closure.dissolvedInorganicCarbonCreditResidualKgC) <=
          numericToleranceKg.dissolvedInorganicCarbonCreditResidualKgC &&
        Math.abs(closure.carbonResidualKgC) <=
          numericToleranceKg.carbonResidualKgC,
      dissolvedOxygenConsumptionClosed:
        Math.abs(closure.dissolvedOxygenDebitResidualKgO2) <=
          numericToleranceKg.dissolvedOxygenDebitResidualKgO2 &&
        Math.abs(closure.stoichiometricOxygenResidualKgO2) <=
          numericToleranceKg.stoichiometricOxygenResidualKgO2,
      scaleAwareFloatingPointClosure: numericClosure.allIdentitiesClosed,
      perIdentityNumericBounds: true,
      measuredResidualsPreserved: true,
      fixedAbsoluteToleranceOnly: false,
      atmosphericGasExchangeModeled: false,
      anaerobicPathwayModeled: false,
      independentCarbonCreation: false,
      independentOxygenCreation: false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastAerobicMineralizationReceipt = clone(receipt);
  return { state: normalizeFloodplainState(state), receipt: clone(receipt) };
}

export function applyFloodplainDenitrificationReaction(source,
  reaction = {}, context = {}) {
  const state = normalizeFloodplainState(source);
  const reachId = String(context.reachId || '');
  const transferId = String(context.transferId || '');
  if (!reachId || !transferId) {
    throw new Error('Floodplain denitrification reaction requires reach and transfer IDs');
  }
  const carbonConsumedKgC = Math.max(0, finite(
    reaction.dissolvedOrganicCarbonConsumedKgC));
  const carbonProducedKgC = Math.max(0, finite(
    reaction.dissolvedInorganicCarbonProducedKgC));
  const nitrogenConsumedKgN = Math.max(0, finite(
    reaction.dissolvedNitrateNitrogenConsumedKgN,
      finite(reaction.dissolvedInorganicNitrogenConsumedKgN)));
  const nitrogenGasProducedKgN = Math.max(0, finite(
    reaction.nitrogenGasProducedKgN));
  const alkalinityGeneratedKgCaCO3Eq = Math.max(0, finite(
    reaction.alkalinityGeneratedKgCaCO3Eq));
  const nitrogenKgNPerCarbonKgC = 14 / 15;
  const alkalinityKgCaCO3EqPerKgN = 3.57;
  if (Math.abs(carbonConsumedKgC - carbonProducedKgC) >
      floodplainReactionMassClosureToleranceKg('carbonKgC',
        carbonConsumedKgC, carbonProducedKgC) ||
    Math.abs(nitrogenConsumedKgN - nitrogenGasProducedKgN) >
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        nitrogenConsumedKgN, nitrogenGasProducedKgN) ||
    Math.abs(nitrogenConsumedKgN - carbonConsumedKgC *
      nitrogenKgNPerCarbonKgC) >
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        nitrogenConsumedKgN, carbonConsumedKgC,
        carbonConsumedKgC * nitrogenKgNPerCarbonKgC) ||
    Math.abs(alkalinityGeneratedKgCaCO3Eq - nitrogenConsumedKgN *
      alkalinityKgCaCO3EqPerKgN) >
      floodplainReactionMassClosureToleranceKg('alkalinityKgCaCO3Eq',
        alkalinityGeneratedKgCaCO3Eq, nitrogenConsumedKgN,
        nitrogenConsumedKgN * alkalinityKgCaCO3EqPerKgN)) {
    throw new Error('Floodplain denitrification reaction is not stoichiometrically closed');
  }
  if (context.livingEnabled === false &&
    carbonConsumedKgC + carbonProducedKgC + nitrogenConsumedKgN +
      nitrogenGasProducedKgN + alkalinityGeneratedKgCaCO3Eq > 1e-12) {
    throw new Error('Life-off cannot apply floodplain denitrification');
  }
  const before = normalizeRiverChemistry(state.chemistry);
  state.chemistry = subtractRiverChemistry(state.chemistry, {
    dissolvedOrganicCarbonKgC: carbonConsumedKgC,
    dissolvedNitrateNitrogenKgN: nitrogenConsumedKgN
  });
  state.chemistry = addRiverChemistry(state.chemistry, {
    dissolvedInorganicCarbonKgC: carbonProducedKgC,
    alkalinityKgCaCO3Eq: alkalinityGeneratedKgCaCO3Eq
  });
  const after = normalizeRiverChemistry(state.chemistry);
  const recordedReaction = {
    dissolvedOrganicCarbonConsumedKgC: round(carbonConsumedKgC, 9),
    dissolvedInorganicCarbonProducedKgC: round(carbonProducedKgC, 9),
    dissolvedNitrateNitrogenConsumedKgN: round(
      nitrogenConsumedKgN, 9),
    nitrogenGasProducedKgN: round(nitrogenGasProducedKgN, 9),
    alkalinityGeneratedKgCaCO3Eq: round(
      alkalinityGeneratedKgCaCO3Eq, 9)
  };
  const recordedBefore = {
    dissolvedOrganicCarbonKgC: round(
      before.dissolvedOrganicCarbonKgC, 9),
    dissolvedInorganicCarbonKgC: round(
      before.dissolvedInorganicCarbonKgC, 9),
    dissolvedInorganicNitrogenKgN: round(
      before.dissolvedInorganicNitrogenKgN, 9),
    dissolvedNitrateNitrogenKgN: round(
      before.dissolvedNitrateNitrogenKgN, 9),
    dissolvedAmmoniumNitrogenKgN: round(
      before.dissolvedAmmoniumNitrogenKgN, 9),
    alkalinityKgCaCO3Eq: round(before.alkalinityKgCaCO3Eq, 9)
  };
  const recordedAfter = {
    dissolvedOrganicCarbonKgC: round(
      after.dissolvedOrganicCarbonKgC, 9),
    dissolvedInorganicCarbonKgC: round(
      after.dissolvedInorganicCarbonKgC, 9),
    dissolvedInorganicNitrogenKgN: round(
      after.dissolvedInorganicNitrogenKgN, 9),
    dissolvedNitrateNitrogenKgN: round(
      after.dissolvedNitrateNitrogenKgN, 9),
    dissolvedAmmoniumNitrogenKgN: round(
      after.dissolvedAmmoniumNitrogenKgN, 9),
    alkalinityKgCaCO3Eq: round(after.alkalinityKgCaCO3Eq, 9)
  };
  const closure = {
    dissolvedOrganicCarbonDebitResidualKgC: round(
      recordedBefore.dissolvedOrganicCarbonKgC -
      recordedAfter.dissolvedOrganicCarbonKgC -
      recordedReaction.dissolvedOrganicCarbonConsumedKgC, 12),
    dissolvedInorganicCarbonCreditResidualKgC: round(
      recordedAfter.dissolvedInorganicCarbonKgC -
      recordedBefore.dissolvedInorganicCarbonKgC -
      recordedReaction.dissolvedInorganicCarbonProducedKgC, 12),
    carbonResidualKgC: round(
      recordedAfter.dissolvedOrganicCarbonKgC +
      recordedAfter.dissolvedInorganicCarbonKgC -
      recordedBefore.dissolvedOrganicCarbonKgC -
      recordedBefore.dissolvedInorganicCarbonKgC, 12),
    dissolvedNitrateNitrogenDebitResidualKgN: round(
      recordedBefore.dissolvedNitrateNitrogenKgN -
      recordedAfter.dissolvedNitrateNitrogenKgN -
      recordedReaction.dissolvedNitrateNitrogenConsumedKgN, 12),
    dissolvedAmmoniumNitrogenResidualKgN: round(
      recordedAfter.dissolvedAmmoniumNitrogenKgN -
      recordedBefore.dissolvedAmmoniumNitrogenKgN, 12),
    dissolvedInorganicNitrogenDebitResidualKgN: round(
      recordedBefore.dissolvedInorganicNitrogenKgN -
      recordedAfter.dissolvedInorganicNitrogenKgN -
      recordedReaction.dissolvedNitrateNitrogenConsumedKgN, 12),
    nitrogenGasBoundaryResidualKgN: round(
      recordedReaction.dissolvedNitrateNitrogenConsumedKgN -
      recordedReaction.nitrogenGasProducedKgN, 12),
    nitrogenResidualKgN: round(
      recordedBefore.dissolvedInorganicNitrogenKgN -
      recordedAfter.dissolvedInorganicNitrogenKgN -
      recordedReaction.nitrogenGasProducedKgN, 12),
    stoichiometricNitrogenResidualKgN: round(
      recordedReaction.dissolvedNitrateNitrogenConsumedKgN -
      recordedReaction.dissolvedOrganicCarbonConsumedKgC *
      nitrogenKgNPerCarbonKgC, 12),
    alkalinityCreditResidualKgCaCO3Eq: round(
      recordedAfter.alkalinityKgCaCO3Eq -
      recordedBefore.alkalinityKgCaCO3Eq -
      recordedReaction.alkalinityGeneratedKgCaCO3Eq, 12),
    stoichiometricAlkalinityResidualKgCaCO3Eq: round(
      recordedReaction.alkalinityGeneratedKgCaCO3Eq -
      recordedReaction.dissolvedNitrateNitrogenConsumedKgN *
      alkalinityKgCaCO3EqPerKgN, 12)
  };
  const numericToleranceKg = {
    dissolvedOrganicCarbonDebitResidualKgC:
      floodplainReactionMassClosureToleranceKg('carbonKgC',
        recordedBefore.dissolvedOrganicCarbonKgC,
        recordedAfter.dissolvedOrganicCarbonKgC,
        recordedReaction.dissolvedOrganicCarbonConsumedKgC),
    dissolvedInorganicCarbonCreditResidualKgC:
      floodplainReactionMassClosureToleranceKg('carbonKgC',
        recordedAfter.dissolvedInorganicCarbonKgC,
        recordedBefore.dissolvedInorganicCarbonKgC,
        recordedReaction.dissolvedInorganicCarbonProducedKgC),
    carbonResidualKgC: floodplainReactionMassClosureToleranceKg(
      'carbonKgC', recordedAfter.dissolvedOrganicCarbonKgC,
      recordedAfter.dissolvedInorganicCarbonKgC,
      recordedBefore.dissolvedOrganicCarbonKgC,
      recordedBefore.dissolvedInorganicCarbonKgC),
    dissolvedNitrateNitrogenDebitResidualKgN:
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        recordedBefore.dissolvedNitrateNitrogenKgN,
        recordedAfter.dissolvedNitrateNitrogenKgN,
        recordedReaction.dissolvedNitrateNitrogenConsumedKgN),
    dissolvedAmmoniumNitrogenResidualKgN:
      floodplainReactionMassClosureToleranceKg('ammoniumNitrogenKgN',
        recordedAfter.dissolvedAmmoniumNitrogenKgN,
        recordedBefore.dissolvedAmmoniumNitrogenKgN),
    dissolvedInorganicNitrogenDebitResidualKgN:
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        recordedBefore.dissolvedInorganicNitrogenKgN,
        recordedAfter.dissolvedInorganicNitrogenKgN,
        recordedReaction.dissolvedNitrateNitrogenConsumedKgN),
    nitrogenGasBoundaryResidualKgN:
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        recordedReaction.dissolvedNitrateNitrogenConsumedKgN,
        recordedReaction.nitrogenGasProducedKgN),
    nitrogenResidualKgN: floodplainReactionMassClosureToleranceKg(
      'nitrogenKgN', recordedBefore.dissolvedInorganicNitrogenKgN,
      recordedAfter.dissolvedInorganicNitrogenKgN,
      recordedReaction.nitrogenGasProducedKgN),
    stoichiometricNitrogenResidualKgN:
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        recordedReaction.dissolvedNitrateNitrogenConsumedKgN,
        recordedReaction.dissolvedOrganicCarbonConsumedKgC,
        recordedReaction.dissolvedOrganicCarbonConsumedKgC *
          nitrogenKgNPerCarbonKgC),
    alkalinityCreditResidualKgCaCO3Eq:
      floodplainReactionMassClosureToleranceKg('alkalinityKgCaCO3Eq',
        recordedAfter.alkalinityKgCaCO3Eq,
        recordedBefore.alkalinityKgCaCO3Eq,
        recordedReaction.alkalinityGeneratedKgCaCO3Eq),
    stoichiometricAlkalinityResidualKgCaCO3Eq:
      floodplainReactionMassClosureToleranceKg('alkalinityKgCaCO3Eq',
        recordedReaction.alkalinityGeneratedKgCaCO3Eq,
        recordedReaction.dissolvedNitrateNitrogenConsumedKgN,
        recordedReaction.dissolvedNitrateNitrogenConsumedKgN *
          alkalinityKgCaCO3EqPerKgN)
  };
  const numericClosure = reactionNumericClosure(closure,
    numericToleranceKg);
  const receipt = {
    schema: FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
    transferId,
    reachId,
    startDay: round(context.startDay, 8),
    durationDays: round(finite(context.durationDays, 1), 8),
    reaction: recordedReaction,
    before: recordedBefore,
    after: recordedAfter,
    closure: numericClosure.closure,
    truth: {
      persistentFloodplainChemistryMutated: true,
      localFloodplainChemistryOnly: true,
      dissolvedOrganicCarbonSenderDebited: true,
      dissolvedInorganicCarbonReceiverCredited: true,
      dissolvedNitrateNitrogenSenderDebited: true,
      alkalinityReceiverCredited: true,
      dissolvedAmmoniumNitrogenUntouched: Math.abs(
        closure.dissolvedAmmoniumNitrogenResidualKgN) <=
          numericToleranceKg.dissolvedAmmoniumNitrogenResidualKgN,
      atmosphereNitrogenReceiverRequired: true,
      localDocToDicCarbonClosed:
        Math.abs(closure.dissolvedOrganicCarbonDebitResidualKgC) <=
          numericToleranceKg.dissolvedOrganicCarbonDebitResidualKgC &&
        Math.abs(closure.dissolvedInorganicCarbonCreditResidualKgC) <=
          numericToleranceKg.dissolvedInorganicCarbonCreditResidualKgC &&
        Math.abs(closure.carbonResidualKgC) <=
          numericToleranceKg.carbonResidualKgC,
      nitrogenGasBoundaryClosed:
        Math.abs(closure.dissolvedNitrateNitrogenDebitResidualKgN) <=
          numericToleranceKg.dissolvedNitrateNitrogenDebitResidualKgN &&
        Math.abs(closure.dissolvedAmmoniumNitrogenResidualKgN) <=
          numericToleranceKg.dissolvedAmmoniumNitrogenResidualKgN &&
        Math.abs(closure.dissolvedInorganicNitrogenDebitResidualKgN) <=
          numericToleranceKg.dissolvedInorganicNitrogenDebitResidualKgN &&
        Math.abs(closure.nitrogenGasBoundaryResidualKgN) <=
          numericToleranceKg.nitrogenGasBoundaryResidualKgN &&
        Math.abs(closure.nitrogenResidualKgN) <=
          numericToleranceKg.nitrogenResidualKgN &&
        Math.abs(closure.stoichiometricNitrogenResidualKgN) <=
          numericToleranceKg.stoichiometricNitrogenResidualKgN,
      denitrificationAlkalinityClosed:
        Math.abs(closure.alkalinityCreditResidualKgCaCO3Eq) <=
          numericToleranceKg.alkalinityCreditResidualKgCaCO3Eq &&
        Math.abs(closure.stoichiometricAlkalinityResidualKgCaCO3Eq) <=
          numericToleranceKg.stoichiometricAlkalinityResidualKgCaCO3Eq,
      scaleAwareFloatingPointClosure: numericClosure.allIdentitiesClosed,
      perIdentityNumericBounds: true,
      measuredResidualsPreserved: true,
      fixedAbsoluteToleranceOnly: false,
      dissolvedInorganicNitrogenTreatedAsFullyNitrate: false,
      nitrateSpeciationResolved: true,
      nitrateAndAmmoniumMaterialPools: true,
      nitritePoolResolved: false,
      independentCarbonCreation: false,
      independentNitrogenCreation: false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastDenitrificationReactionReceipt = clone(receipt);
  return { state: normalizeFloodplainState(state), receipt: clone(receipt) };
}

export function applyFloodplainNitrificationReaction(source,
  reaction = {}, context = {}) {
  const state = normalizeFloodplainState(source);
  const reachId = String(context.reachId || '');
  const transferId = String(context.transferId || '');
  if (!reachId || !transferId) {
    throw new Error('Floodplain nitrification reaction requires reach and transfer IDs');
  }
  const ammoniumConsumedKgN = Math.max(0, finite(
    reaction.dissolvedAmmoniumNitrogenConsumedKgN));
  const nitrateProducedKgN = Math.max(0, finite(
    reaction.dissolvedNitrateNitrogenProducedKgN));
  const oxygenConsumedKgO2 = Math.max(0, finite(
    reaction.dissolvedOxygenConsumedKgO2));
  const alkalinityDemandKgCaCO3 = Math.max(0, finite(
    reaction.alkalinityDemandKgCaCO3));
  const oxygenKgO2PerKgN = 4.57;
  const alkalinityDemandKgCaCO3PerKgN = 7.14;
  if (Math.abs(ammoniumConsumedKgN - nitrateProducedKgN) >
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        ammoniumConsumedKgN, nitrateProducedKgN) ||
    Math.abs(oxygenConsumedKgO2 - ammoniumConsumedKgN *
      oxygenKgO2PerKgN) >
      floodplainReactionMassClosureToleranceKg('oxygenKgO2',
        oxygenConsumedKgO2, ammoniumConsumedKgN,
        ammoniumConsumedKgN * oxygenKgO2PerKgN) ||
    Math.abs(alkalinityDemandKgCaCO3 - ammoniumConsumedKgN *
      alkalinityDemandKgCaCO3PerKgN) >
      floodplainReactionMassClosureToleranceKg('alkalinityKgCaCO3Eq',
        alkalinityDemandKgCaCO3, ammoniumConsumedKgN,
        ammoniumConsumedKgN * alkalinityDemandKgCaCO3PerKgN)) {
    throw new Error('Floodplain nitrification reaction is not stoichiometrically closed');
  }
  if (context.livingEnabled === false &&
    ammoniumConsumedKgN + nitrateProducedKgN + oxygenConsumedKgO2 +
      alkalinityDemandKgCaCO3 > 1e-12) {
    throw new Error('Life-off cannot apply floodplain nitrification');
  }
  const before = normalizeRiverChemistry(state.chemistry);
  state.chemistry = subtractRiverChemistry(state.chemistry, {
    dissolvedAmmoniumNitrogenKgN: ammoniumConsumedKgN,
    dissolvedOxygenKgO2: oxygenConsumedKgO2,
    alkalinityKgCaCO3Eq: alkalinityDemandKgCaCO3
  });
  state.chemistry = addRiverChemistry(state.chemistry, {
    dissolvedNitrateNitrogenKgN: nitrateProducedKgN
  });
  const after = normalizeRiverChemistry(state.chemistry);
  const recordedReaction = {
    dissolvedAmmoniumNitrogenConsumedKgN: round(
      ammoniumConsumedKgN, 9),
    dissolvedNitrateNitrogenProducedKgN: round(
      nitrateProducedKgN, 9),
    dissolvedOxygenConsumedKgO2: round(oxygenConsumedKgO2, 9),
    alkalinityDemandKgCaCO3: round(alkalinityDemandKgCaCO3, 9)
  };
  const recordedBefore = {
    dissolvedInorganicNitrogenKgN: round(
      before.dissolvedInorganicNitrogenKgN, 9),
    dissolvedNitrateNitrogenKgN: round(
      before.dissolvedNitrateNitrogenKgN, 9),
    dissolvedAmmoniumNitrogenKgN: round(
      before.dissolvedAmmoniumNitrogenKgN, 9),
    dissolvedOxygenKgO2: round(before.dissolvedOxygenKgO2, 9),
    alkalinityKgCaCO3Eq: round(before.alkalinityKgCaCO3Eq, 9)
  };
  const recordedAfter = {
    dissolvedInorganicNitrogenKgN: round(
      after.dissolvedInorganicNitrogenKgN, 9),
    dissolvedNitrateNitrogenKgN: round(
      after.dissolvedNitrateNitrogenKgN, 9),
    dissolvedAmmoniumNitrogenKgN: round(
      after.dissolvedAmmoniumNitrogenKgN, 9),
    dissolvedOxygenKgO2: round(after.dissolvedOxygenKgO2, 9),
    alkalinityKgCaCO3Eq: round(after.alkalinityKgCaCO3Eq, 9)
  };
  const closure = {
    dissolvedAmmoniumNitrogenDebitResidualKgN: round(
      recordedBefore.dissolvedAmmoniumNitrogenKgN -
      recordedAfter.dissolvedAmmoniumNitrogenKgN -
      recordedReaction.dissolvedAmmoniumNitrogenConsumedKgN, 12),
    dissolvedNitrateNitrogenCreditResidualKgN: round(
      recordedAfter.dissolvedNitrateNitrogenKgN -
      recordedBefore.dissolvedNitrateNitrogenKgN -
      recordedReaction.dissolvedNitrateNitrogenProducedKgN, 12),
    dissolvedInorganicNitrogenResidualKgN: round(
      recordedAfter.dissolvedInorganicNitrogenKgN -
      recordedBefore.dissolvedInorganicNitrogenKgN, 12),
    dissolvedOxygenDebitResidualKgO2: round(
      recordedBefore.dissolvedOxygenKgO2 -
      recordedAfter.dissolvedOxygenKgO2 -
      recordedReaction.dissolvedOxygenConsumedKgO2, 12),
    stoichiometricOxygenResidualKgO2: round(
      recordedReaction.dissolvedOxygenConsumedKgO2 -
      recordedReaction.dissolvedAmmoniumNitrogenConsumedKgN *
      oxygenKgO2PerKgN, 12),
    alkalinityDebitResidualKgCaCO3Eq: round(
      recordedBefore.alkalinityKgCaCO3Eq -
      recordedAfter.alkalinityKgCaCO3Eq -
      recordedReaction.alkalinityDemandKgCaCO3, 12),
    stoichiometricAlkalinityResidualKgCaCO3Eq: round(
      recordedReaction.alkalinityDemandKgCaCO3 -
      recordedReaction.dissolvedAmmoniumNitrogenConsumedKgN *
      alkalinityDemandKgCaCO3PerKgN, 12)
  };
  const numericToleranceKg = {
    dissolvedAmmoniumNitrogenDebitResidualKgN:
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        recordedBefore.dissolvedAmmoniumNitrogenKgN,
        recordedAfter.dissolvedAmmoniumNitrogenKgN,
        recordedReaction.dissolvedAmmoniumNitrogenConsumedKgN),
    dissolvedNitrateNitrogenCreditResidualKgN:
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        recordedAfter.dissolvedNitrateNitrogenKgN,
        recordedBefore.dissolvedNitrateNitrogenKgN,
        recordedReaction.dissolvedNitrateNitrogenProducedKgN),
    dissolvedInorganicNitrogenResidualKgN:
      floodplainReactionMassClosureToleranceKg('nitrogenKgN',
        recordedAfter.dissolvedInorganicNitrogenKgN,
        recordedBefore.dissolvedInorganicNitrogenKgN),
    dissolvedOxygenDebitResidualKgO2:
      floodplainReactionMassClosureToleranceKg('oxygenKgO2',
        recordedBefore.dissolvedOxygenKgO2,
        recordedAfter.dissolvedOxygenKgO2,
        recordedReaction.dissolvedOxygenConsumedKgO2),
    stoichiometricOxygenResidualKgO2:
      floodplainReactionMassClosureToleranceKg('oxygenKgO2',
        recordedReaction.dissolvedOxygenConsumedKgO2,
        recordedReaction.dissolvedAmmoniumNitrogenConsumedKgN,
        recordedReaction.dissolvedAmmoniumNitrogenConsumedKgN *
          oxygenKgO2PerKgN),
    alkalinityDebitResidualKgCaCO3Eq:
      floodplainReactionMassClosureToleranceKg('alkalinityKgCaCO3Eq',
        recordedBefore.alkalinityKgCaCO3Eq,
        recordedAfter.alkalinityKgCaCO3Eq,
        recordedReaction.alkalinityDemandKgCaCO3),
    stoichiometricAlkalinityResidualKgCaCO3Eq:
      floodplainReactionMassClosureToleranceKg('alkalinityKgCaCO3Eq',
        recordedReaction.alkalinityDemandKgCaCO3,
        recordedReaction.dissolvedAmmoniumNitrogenConsumedKgN,
        recordedReaction.dissolvedAmmoniumNitrogenConsumedKgN *
          alkalinityDemandKgCaCO3PerKgN)
  };
  const numericClosure = reactionNumericClosure(closure,
    numericToleranceKg);
  const receipt = {
    schema: FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
    transferId,
    reachId,
    startDay: round(context.startDay, 8),
    durationDays: round(finite(context.durationDays, 1), 8),
    reaction: recordedReaction,
    before: recordedBefore,
    after: recordedAfter,
    closure: numericClosure.closure,
    truth: {
      persistentFloodplainChemistryMutated: true,
      localFloodplainChemistryOnly: true,
      dissolvedAmmoniumNitrogenSenderDebited: true,
      dissolvedNitrateNitrogenReceiverCredited: true,
      dissolvedOxygenSenderDebited: true,
      alkalinitySenderDebited: true,
      ammoniumToNitrateNitrogenClosed:
        Math.abs(closure.dissolvedAmmoniumNitrogenDebitResidualKgN) <=
          numericToleranceKg.dissolvedAmmoniumNitrogenDebitResidualKgN &&
        Math.abs(closure.dissolvedNitrateNitrogenCreditResidualKgN) <=
          numericToleranceKg.dissolvedNitrateNitrogenCreditResidualKgN &&
        Math.abs(closure.dissolvedInorganicNitrogenResidualKgN) <=
          numericToleranceKg.dissolvedInorganicNitrogenResidualKgN,
      dissolvedOxygenConsumptionClosed:
        Math.abs(closure.dissolvedOxygenDebitResidualKgO2) <=
          numericToleranceKg.dissolvedOxygenDebitResidualKgO2 &&
        Math.abs(closure.stoichiometricOxygenResidualKgO2) <=
          numericToleranceKg.stoichiometricOxygenResidualKgO2,
      alkalinityConsumptionClosed:
        Math.abs(closure.alkalinityDebitResidualKgCaCO3Eq) <=
          numericToleranceKg.alkalinityDebitResidualKgCaCO3Eq &&
        Math.abs(closure.stoichiometricAlkalinityResidualKgCaCO3Eq) <=
          numericToleranceKg.stoichiometricAlkalinityResidualKgCaCO3Eq,
      scaleAwareFloatingPointClosure: numericClosure.allIdentitiesClosed,
      perIdentityNumericBounds: true,
      measuredResidualsPreserved: true,
      fixedAbsoluteToleranceOnly: false,
      alkalinityDemandDiagnosticOnly: false,
      alkalinityMaterialOwnerDebited: true,
      pHFeedbackModeled: false,
      nitriteIntermediateResolved: false,
      independentNitrogenCreation: false,
      independentOxygenCreation: false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastNitrificationReactionReceipt = clone(receipt);
  return { state: normalizeFloodplainState(state), receipt: clone(receipt) };
}

export function applyFloodplainGasExchange(source, exchange = {},
  context = {}) {
  const state = normalizeFloodplainState(source);
  const reachId = String(context.reachId || '');
  const atmosphereCellId = String(context.atmosphereCellId || '');
  const exchangeId = String(context.exchangeId || '');
  if (!reachId || !atmosphereCellId || !exchangeId) {
    throw new Error('Floodplain gas exchange requires reach, atmosphere-cell and exchange IDs');
  }
  const carbonToAtmosphereKgC = Math.max(0, finite(
    exchange.carbonToAtmosphereKgC));
  const carbonToFloodplainKgC = Math.max(0, finite(
    exchange.carbonToFloodplainKgC));
  const oxygenToFloodplainKgO2 = Math.max(0, finite(
    exchange.oxygenToFloodplainKgO2));
  if (carbonToAtmosphereKgC > 1e-12 &&
    carbonToFloodplainKgC > 1e-12) {
    throw new Error('Floodplain gas exchange carbon direction must be exclusive');
  }
  const before = normalizeRiverChemistry(state.chemistry);
  if (carbonToAtmosphereKgC >
    before.dissolvedInorganicCarbonKgC + 1e-7) {
    throw new Error('Floodplain gas exchange cannot overdraw dissolved inorganic carbon');
  }
  state.chemistry = subtractRiverChemistry(state.chemistry, {
    dissolvedInorganicCarbonKgC: carbonToAtmosphereKgC
  });
  state.chemistry = addRiverChemistry(state.chemistry, {
    dissolvedInorganicCarbonKgC: carbonToFloodplainKgC,
    dissolvedOxygenKgO2: oxygenToFloodplainKgO2
  });
  const after = normalizeRiverChemistry(state.chemistry);
  const recordedExchange = {
    carbonToAtmosphereKgC: round(carbonToAtmosphereKgC, 9),
    carbonToFloodplainKgC: round(carbonToFloodplainKgC, 9),
    oxygenToFloodplainKgO2: round(oxygenToFloodplainKgO2, 9)
  };
  const recordedBefore = {
    dissolvedInorganicCarbonKgC: round(
      before.dissolvedInorganicCarbonKgC, 9),
    dissolvedOxygenKgO2: round(before.dissolvedOxygenKgO2, 9)
  };
  const recordedAfter = {
    dissolvedInorganicCarbonKgC: round(
      after.dissolvedInorganicCarbonKgC, 9),
    dissolvedOxygenKgO2: round(after.dissolvedOxygenKgO2, 9)
  };
  const closure = {
    carbonTransferResidualKgC: round(
      recordedAfter.dissolvedInorganicCarbonKgC -
      recordedBefore.dissolvedInorganicCarbonKgC +
      recordedExchange.carbonToAtmosphereKgC -
      recordedExchange.carbonToFloodplainKgC, 12),
    oxygenTransferResidualKgO2: round(
      recordedAfter.dissolvedOxygenKgO2 -
      recordedBefore.dissolvedOxygenKgO2 -
      recordedExchange.oxygenToFloodplainKgO2, 12)
  };
  const numericToleranceKg = {
    carbonTransferResidualKgC:
      floodplainReactionMassClosureToleranceKg('carbonKgC',
        recordedAfter.dissolvedInorganicCarbonKgC,
        recordedBefore.dissolvedInorganicCarbonKgC,
        recordedExchange.carbonToAtmosphereKgC,
        recordedExchange.carbonToFloodplainKgC),
    oxygenTransferResidualKgO2:
      floodplainReactionMassClosureToleranceKg('oxygenKgO2',
        recordedAfter.dissolvedOxygenKgO2,
        recordedBefore.dissolvedOxygenKgO2,
        recordedExchange.oxygenToFloodplainKgO2)
  };
  const numericClosure = reactionNumericClosure(closure,
    numericToleranceKg);
  const receipt = {
    schema: FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    exchangeId,
    reachId,
    atmosphereCellId,
    startDay: round(context.startDay, 8),
    durationDays: round(finite(context.durationDays, 1), 8),
    exchange: recordedExchange,
    floodplainCarbonDebit: {
      reservoir: 'floodplain-dissolved-inorganic-carbon',
      carbonKgC: round(carbonToAtmosphereKgC, 9)
    },
    floodplainCarbonCredit: {
      reservoir: 'floodplain-dissolved-inorganic-carbon',
      carbonKgC: round(carbonToFloodplainKgC, 9)
    },
    floodplainOxygenCredit: {
      reservoir: 'floodplain-dissolved-oxygen',
      oxygenKgO2: round(oxygenToFloodplainKgO2, 9)
    },
    before: recordedBefore,
    after: recordedAfter,
    closure: numericClosure.closure,
    truth: {
      persistentFloodplainChemistryMutated: true,
      dissolvedInorganicCarbonSenderDebitedWhenEvasion: true,
      dissolvedInorganicCarbonReceiverCreditedWhenInvasion: true,
      dissolvedOxygenReceiverCredited: true,
      atmosphereOwnerReceiptRequired: true,
      carbonTransferClosed:
        Math.abs(closure.carbonTransferResidualKgC) <=
          numericToleranceKg.carbonTransferResidualKgC,
      oxygenTransferClosed:
        Math.abs(closure.oxygenTransferResidualKgO2) <=
          numericToleranceKg.oxygenTransferResidualKgO2,
      scaleAwareFloatingPointClosure: numericClosure.allIdentitiesClosed,
      perIdentityNumericBounds: true,
      measuredResidualsPreserved: true,
      fixedAbsoluteToleranceOnly: false,
      carbonDirectionExclusive:
        carbonToAtmosphereKgC <= 1e-12 ||
          carbonToFloodplainKgC <= 1e-12,
      atmosphericReservoirMutatedHere: false,
      independentCarbonCreation: false,
      independentOxygenCreation: false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastGasExchangeReceipt = clone(receipt);
  return { state: normalizeFloodplainState(state), receipt: clone(receipt) };
}

function chemistryTransportTotals(source) {
  const totals = chemistryElementInputs(source);
  const species = riverNitrogenSpecies(source);
  return {
    ...totals,
    nitrateNitrogenKgN: species.dissolvedNitrateNitrogenKgN,
    ammoniumNitrogenKgN: species.dissolvedAmmoniumNitrogenKgN
  };
}

function floodplainExchangeOwnerSnapshot(channelWaterKg, channelChemistry,
  channelSediment, floodplain) {
  const channelMineral = normalizeRiverSediment(channelSediment);
  return {
    water: {
      channelKg: finite(channelWaterKg),
      floodplainKg: finite(floodplain.waterKg)
    },
    chemistry: {
      channel: chemistryTransportTotals(channelChemistry),
      floodplain: chemistryTransportTotals(floodplain.chemistry)
    },
    sediment: {
      channelSuspendedKg: grains(channelMineral.suspendedKg),
      channelBedDepositKg: grains(channelMineral.bedDepositKg),
      floodplainSuspendedKg: grains(floodplain.suspendedSedimentKg),
      floodplainDepositedKg: grains(floodplain.depositedSedimentKg)
    }
  };
}

function floodplainExchangeMassClosureFromOwners(initial, final) {
  const identityInputs = {
    waterResidualKg: [
      final.water.channelKg,
      final.water.floodplainKg,
      -initial.water.channelKg,
      -initial.water.floodplainKg
    ]
  };
  for (const key of CHEMISTRY_KEYS) {
    const identity = key.replace('Kg', 'ResidualKg');
    identityInputs[identity] = [
      finite(final.chemistry.channel[key]),
      finite(final.chemistry.floodplain[key]),
      -finite(initial.chemistry.channel[key]),
      -finite(initial.chemistry.floodplain[key])
    ];
  }
  for (const grain of GRAINS) {
    const identity = `${grain}ResidualKg`;
    identityInputs[identity] = [
      final.sediment.channelSuspendedKg[grain],
      final.sediment.channelBedDepositKg[grain],
      final.sediment.floodplainSuspendedKg[grain],
      final.sediment.floodplainDepositedKg[grain],
      -initial.sediment.channelSuspendedKg[grain],
      -initial.sediment.channelBedDepositKg[grain],
      -initial.sediment.floodplainSuspendedKg[grain],
      -initial.sediment.floodplainDepositedKg[grain]
    ];
  }
  return floodplainExchangeMassClosureReceipt(identityInputs);
}

export function advanceFloodplainExchange(source, channelSource, reach,
  dtDays, context = {}) {
  const durationDays = clamp(finite(dtDays), 0, 1);
  const state = normalizeFloodplainState(source);
  let channelWaterKg = Math.max(0, finite(channelSource?.waterKg));
  let channelChemistry = normalizeRiverChemistry(channelSource?.chemistry);
  let channelSediment = normalizeRiverSediment(channelSource?.sediment);
  const initialWaterKg = channelWaterKg + state.waterKg;
  const initialOwners = floodplainExchangeOwnerSnapshot(channelWaterKg,
    channelChemistry, channelSediment, state);
  const reachLengthM = Math.max(1, finite(context.reachLengthM, 1000));
  const widthM = clamp(finite(reach?.widthM, 3), .5, 2000);
  const depthM = clamp(finite(reach?.depthM, .25), .05, 100);
  const bankfullCapacityKg = Math.max(1,
    reachLengthM * widthM * depthM * 1000 * .72);
  const floodplainReferenceCapacityKg = bankfullCapacityKg * clamp(
    finite(context.floodplainStorageMultiplier, 6), 1.5, 24);
  const exchangeId = String(context.exchangeId ||
    `floodplain:${stableDigest({ reachId: reach?.id || null,
      startDay: round(context.startDay, 8), durationDays,
      channelWaterKg: round(channelWaterKg, 3) }).slice(9)}`);

  if (state.migrationCheckpoint) {
    state.migrationCheckpoint = false;
    const massClosure = floodplainExchangeMassClosureFromOwners(initialOwners,
      floodplainExchangeOwnerSnapshot(channelWaterKg, channelChemistry,
        channelSediment, state));
    const receipt = {
      schema: FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
      exchangeId,
      reachId: reach?.id || context.reachId || null,
      status: 'initialized-after-migration-no-transfer',
      startDay: round(context.startDay, 8),
      durationDays: round(durationDays, 8),
      controls: {
        reachLengthM: round(reachLengthM, 3), widthM: round(widthM, 6),
        depthM: round(depthM, 6),
        bankfullCapacityKg: round(bankfullCapacityKg, 3),
        floodplainReferenceCapacityKg: round(floodplainReferenceCapacityKg, 3)
      },
      water: { overbankKg: 0, returnKg: 0, residualKg: 0 },
      chemistry: { overbank: {}, returned: {}, residuals: Object.fromEntries(
        CHEMISTRY_KEYS.map(key => [key.replace('Kg', 'ResidualKg'), 0])) },
      sediment: {
        overbankKg: roundedGrains(), returnedKg: roundedGrains(),
        depositedKg: roundedGrains(), residualKg: roundedGrains()
      },
      massClosure,
      inundatedFraction: 0,
      truth: {
        ...truth(), migrationInventedHistoricalFloodplain: false,
        senderDebitsAndReceiverCreditsPaired: true,
        nitrateAndAmmoniumSenderReceiverTransfersPaired: true,
        nitrateAndAmmoniumConservationClosed: true,
        scaleAwareNumericClosure: massClosure.conservationClosed,
        perIdentityNumericBounds: massClosure.identityCount === 12,
        measuredResidualsPreserved: massClosure.measuredResidualsPreserved,
        fixedAbsoluteToleranceOnly: false,
        conservationClosed: true
      }
    };
    receipt.digest = stableDigest(receipt);
    state.lastExchangeReceipt = receipt;
    return {
      state,
      channel: { waterKg: channelWaterKg, chemistry: channelChemistry,
        sediment: channelSediment },
      receipt: clone(receipt)
    };
  }

  const recessionDays = clamp(finite(context.recessionDays, 4.5), .25, 60);
  const returnFraction = state.waterKg > 0
    ? clamp(1 - Math.exp(-durationDays / recessionDays), 0, .8) : 0;
  const returnWaterKg = state.waterKg * returnFraction;
  const returnedChemistry = riverChemistryFraction(state.chemistry,
    returnFraction);
  const returnedSedimentKg = scaleGrains(state.suspendedSedimentKg,
    returnFraction);
  state.waterKg -= returnWaterKg;
  state.chemistry = subtractRiverChemistry(state.chemistry,
    returnedChemistry);
  state.suspendedSedimentKg = subtractGrains(state.suspendedSedimentKg,
    returnedSedimentKg);
  channelWaterKg += returnWaterKg;
  channelChemistry = addRiverChemistry(channelChemistry, returnedChemistry);
  channelSediment.suspendedKg = addGrains(channelSediment.suspendedKg,
    returnedSedimentKg);
  channelSediment.cumulativeInflowKg = addGrains(
    channelSediment.cumulativeInflowKg, returnedSedimentKg);
  state.cumulativeReturnWaterKg += returnWaterKg;

  const excessWaterKg = Math.max(0, channelWaterKg - bankfullCapacityKg);
  const overflowResponse = clamp(1 - Math.exp(-durationDays / .12));
  const overbankWaterKg = Math.min(channelWaterKg,
    excessWaterKg * overflowResponse);
  const overbankWaterFraction = channelWaterKg > 0
    ? overbankWaterKg / channelWaterKg : 0;
  const overbankChemistry = riverChemistryFraction(channelChemistry,
    overbankWaterFraction);
  const entrainment = { clay: 1.25, silt: 1.12, sand: .62, gravel: .18 };
  const overbankSedimentKg = Object.fromEntries(GRAINS.map(id => [id,
    finite(channelSediment.suspendedKg?.[id]) * clamp(
      overbankWaterFraction * entrainment[id]) ]));
  channelWaterKg -= overbankWaterKg;
  channelChemistry = subtractRiverChemistry(channelChemistry,
    overbankChemistry);
  channelSediment.suspendedKg = subtractGrains(channelSediment.suspendedKg,
    overbankSedimentKg);
  channelSediment.cumulativeOutflowKg = addGrains(
    channelSediment.cumulativeOutflowKg, overbankSedimentKg);
  state.waterKg += overbankWaterKg;
  state.chemistry = addRiverChemistry(state.chemistry, overbankChemistry);
  state.suspendedSedimentKg = addGrains(state.suspendedSedimentKg,
    overbankSedimentKg);
  state.cumulativeOverbankWaterKg += overbankWaterKg;

  const settlingExposure = clamp(1 - Math.exp(-durationDays / 1.8));
  const settling = { clay: .06, silt: .2, sand: .58, gravel: .88 };
  const depositedKg = Object.fromEntries(GRAINS.map(id => [id,
    state.suspendedSedimentKg[id] * settlingExposure * settling[id]]));
  state.suspendedSedimentKg = subtractGrains(state.suspendedSedimentKg,
    depositedKg);
  state.depositedSedimentKg = addGrains(state.depositedSedimentKg,
    depositedKg);
  state.cumulativeDepositedSedimentKg = addGrains(
    state.cumulativeDepositedSedimentKg, depositedKg);
  state.inundatedFraction = clamp(state.waterKg /
    floodplainReferenceCapacityKg);

  const finalOwners = floodplainExchangeOwnerSnapshot(channelWaterKg,
    channelChemistry, channelSediment, state);
  const massClosure = floodplainExchangeMassClosureFromOwners(initialOwners,
    finalOwners);
  const waterResidualKg = massClosure.identities.waterResidualKg.residualKg;
  const chemistryResiduals = Object.fromEntries(CHEMISTRY_KEYS.map(key =>
    [key.replace('Kg', 'ResidualKg'), round(massClosure.identities[
      key.replace('Kg', 'ResidualKg')].residualKg, 9)]));
  const sedimentResidualKg = Object.fromEntries(GRAINS.map(id => [id,
    round(massClosure.identities[`${id}ResidualKg`].residualKg, 9)]));
  const conservationClosed = massClosure.conservationClosed;
  const receipt = {
    schema: FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
    exchangeId,
    reachId: reach?.id || context.reachId || null,
    status: overbankWaterKg > 0 ? 'overbank-storage-active'
      : returnWaterKg > 0 ? 'finite-return-flow' : 'within-bankfull-channel',
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    controls: {
      reachLengthM: round(reachLengthM, 3), widthM: round(widthM, 6),
      depthM: round(depthM, 6),
      bankfullCapacityKg: round(bankfullCapacityKg, 3),
      floodplainReferenceCapacityKg: round(floodplainReferenceCapacityKg, 3),
      recessionDays: round(recessionDays, 6),
      overflowResponse: round(overflowResponse, 9)
    },
    water: {
      channelInitialKg: round(initialWaterKg -
        normalizeFloodplainState(source).waterKg, 3),
      floodplainInitialKg: round(normalizeFloodplainState(source).waterKg, 3),
      overbankKg: round(overbankWaterKg, 3),
      returnKg: round(returnWaterKg, 3),
      channelFinalKg: round(channelWaterKg, 3),
      floodplainFinalKg: round(state.waterKg, 3),
      residualKg: round(waterResidualKg, 3)
    },
    chemistry: {
      overbank: Object.fromEntries(Object.entries(
        chemistryTransportTotals(overbankChemistry)).map(([key, value]) =>
          [key, round(value, 9)])),
      returned: Object.fromEntries(Object.entries(
        chemistryTransportTotals(returnedChemistry)).map(([key, value]) =>
          [key, round(value, 9)])),
      residuals: chemistryResiduals
    },
    sediment: {
      overbankKg: roundedGrains(overbankSedimentKg),
      returnedKg: roundedGrains(returnedSedimentKg),
      depositedKg: roundedGrains(depositedKg),
      residualKg: sedimentResidualKg
    },
    massClosure,
    inundatedFraction: round(state.inundatedFraction, 9),
    truth: {
      ...truth(), migrationInventedHistoricalFloodplain: false,
      senderDebitsAndReceiverCreditsPaired: true,
      nitrateAndAmmoniumSenderReceiverTransfersPaired: true,
      nitrateAndAmmoniumConservationClosed:
        massClosure.identities.nitrateNitrogenResidualKgN.closed &&
        massClosure.identities.ammoniumNitrogenResidualKgN.closed,
      scaleAwareNumericClosure: massClosure.conservationClosed,
      perIdentityNumericBounds: massClosure.identityCount === 12,
      measuredResidualsPreserved: massClosure.measuredResidualsPreserved,
      fixedAbsoluteToleranceOnly: false,
      waterUsesBankfullThreshold: true,
      returnFlowDonorBounded: returnWaterKg <=
        normalizeFloodplainState(source).waterKg + 1e-6,
      conservationClosed
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastExchangeReceipt = receipt;
  return {
    state: normalizeFloodplainState(state),
    channel: {
      waterKg: Math.max(0, channelWaterKg),
      chemistry: normalizeRiverChemistry(channelChemistry),
      sediment: normalizeRiverSediment(channelSediment)
    },
    receipt: clone(receipt)
  };
}

export function floodplainDescription() {
  return {
    stateSchema: FLOODPLAIN_STATE_SCHEMA,
    exchangeReceiptSchema: FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
    exchangeMassClosureSchema: FLOODPLAIN_EXCHANGE_MASS_CLOSURE_SCHEMA,
    exchangeMassClosurePolicy: {
      schema: FLOODPLAIN_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
      absoluteFloorsKg: {
        ...FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
      },
      ulpFactor: FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
      scaleBasis: 'sum-of-absolute-unrounded-signed-operands-kg'
    },
    plantResourceDebitSchema: FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
    plantWaterReturnSchema: FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA,
    detritalReturnCreditSchema:
      FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
    previousDetritalReturnCreditSchema:
      PREVIOUS_FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
    detritalReturnMassClosurePolicySchema:
      FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA,
    detritalReturnMassClosureAbsoluteFloorsKg: {
      ...FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
    },
    detritalReturnMassClosureUlpFactor:
      FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ULP_FACTOR,
    aerobicMineralizationReceiptSchema:
      FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
    previousAerobicMineralizationReceiptSchema:
      PREVIOUS_FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
    denitrificationReactionReceiptSchema:
      FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
    previousDenitrificationReactionReceiptSchema:
      PREVIOUS_FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
    nitrificationReactionReceiptSchema:
      FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
    previousNitrificationReactionReceiptSchema:
      PREVIOUS_FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
    gasExchangeReceiptSchema: FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    previousGasExchangeReceiptSchema:
      PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    reactionMassClosurePolicySchema:
      FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
    reactionMassClosureAbsoluteFloorsKg: {
      ...FLOODPLAIN_REACTION_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
    },
    reactionMassClosureUlpFactor:
      FLOODPLAIN_REACTION_MASS_CLOSURE_ULP_FACTOR,
    reservoirs: [
      'overbank-water',
      'dissolved-carbon-nitrate-ammonium-phosphorus-oxygen-alkalinity',
      'suspended-clay-silt-sand-gravel',
      'deposited-clay-silt-sand-gravel'
    ],
    processes: [
      'geometry-derived-bankfull-threshold',
      'finite-channel-to-floodplain-overbank-transfer',
      'finite-floodplain-to-channel-recession-return',
      'grain-selective-floodplain-deposition',
      'bounded-plant-water-phosphorus-uptake',
      'mortality-tissue-water-return',
      'paired-plant-detritus-to-floodplain-chemistry-return',
      'detrital-nitrogen-to-ammonium-credit',
      'paired-nitrate-ammonium-water-fraction-transport',
      'oxygen-limited-local-doc-to-dic-aerobic-mineralization',
      'oxygen-gated-local-doc-nitrate-to-dic-nitrogen-gas-denitrification',
      'oxygen-stoichiometric-local-ammonium-to-nitrate-nitrification',
      'denitrification-alkalinity-generation',
      'nitrification-alkalinity-owner-debit',
      'paired-bidirectional-floodplain-atmosphere-carbon-gradient-and-oxygen-exchange'
    ],
    maximumStepDays: 1,
    truth: truth()
  };
}
