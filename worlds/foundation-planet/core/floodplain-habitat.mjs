import {
  FLOODPLAIN_STATE_SCHEMA,
  floodplainTotals,
  normalizeFloodplainState
} from './floodplain.mjs?v=0.61.0-r61.1';

export const FLOODPLAIN_HABITAT_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-habitat-state/v1';
export const FLOODPLAIN_HABITAT_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-habitat-receipt/v1';

export const FLOODPLAIN_HABITAT_TYPES = Object.freeze([
  'openWater', 'mudflat', 'reedSedge', 'wetMeadow',
  'riparianWoodland'
]);

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

function materialDigest(source) {
  return stableDigest(source ?? null);
}

function defaultFractions() {
  return {
    openWater: 0,
    mudflat: 0,
    reedSedge: 0,
    wetMeadow: .35,
    riparianWoodland: .65
  };
}

export function normalizeHabitatFractions(source = {}) {
  const positive = Object.fromEntries(FLOODPLAIN_HABITAT_TYPES.map(id =>
    [id, Math.max(0, finite(source?.[id]))]));
  let sum = FLOODPLAIN_HABITAT_TYPES.reduce((total, id) =>
    total + positive[id], 0);
  if (!(sum > 0)) return defaultFractions();
  const fractions = Object.fromEntries(FLOODPLAIN_HABITAT_TYPES.map(id =>
    [id, positive[id] / sum]));
  const last = FLOODPLAIN_HABITAT_TYPES.at(-1);
  const prior = FLOODPLAIN_HABITAT_TYPES.slice(0, -1).reduce((total, id) =>
    total + fractions[id], 0);
  fractions[last] = Math.max(0, 1 - prior);
  sum = FLOODPLAIN_HABITAT_TYPES.reduce((total, id) =>
    total + fractions[id], 0);
  if (Math.abs(sum - 1) > 1e-12) fractions[last] += 1 - sum;
  return fractions;
}

function habitatClass(fractions) {
  return FLOODPLAIN_HABITAT_TYPES.reduce((best, id) =>
    fractions[id] > fractions[best] ? id : best,
  FLOODPLAIN_HABITAT_TYPES[0]);
}

function truth() {
  return {
    persistentFloodPulseMemory: true,
    readOnlyFloodplainMaterialObserver: true,
    potentialHabitatOnly: true,
    ecologicalPopulationState: false,
    plantBiomassState: false,
    speciesOccupancyState: false,
    resolvedInundationHydraulics: false,
    scientificWetlandForecast: false
  };
}

export function emptyFloodplainHabitatState(options = {}) {
  const fractions = defaultFractions();
  return {
    schema: FLOODPLAIN_HABITAT_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    observedDays: 0,
    inundatedExposureDays: 0,
    wetDays: 0,
    dryDays: 0,
    currentWetSpellDays: 0,
    currentDrySpellDays: 0,
    floodPulseCount: 0,
    rollingHydroperiod30d: 0,
    peakInundatedFraction: 0,
    lastWaterKg: 0,
    lastDepositedSedimentKg: 0,
    cumulativeNewDepositKg: 0,
    fertilityIndex: 0,
    anaerobicStress: 0,
    habitatClass: habitatClass(fractions),
    fractions,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainHabitatState(source, options = {}) {
  const state = emptyFloodplainHabitatState(options);
  if (source?.schema !== FLOODPLAIN_HABITAT_STATE_SCHEMA) return state;
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  for (const key of [
    'observedDays', 'inundatedExposureDays', 'wetDays', 'dryDays',
    'currentWetSpellDays', 'currentDrySpellDays', 'floodPulseCount',
    'lastWaterKg', 'lastDepositedSedimentKg', 'cumulativeNewDepositKg'
  ]) state[key] = Math.max(0, finite(source[key]));
  state.rollingHydroperiod30d = clamp(finite(
    source.rollingHydroperiod30d));
  state.peakInundatedFraction = clamp(finite(
    source.peakInundatedFraction));
  state.fertilityIndex = clamp(finite(source.fertilityIndex));
  state.anaerobicStress = clamp(finite(source.anaerobicStress));
  state.fractions = normalizeHabitatFractions(source.fractions);
  state.habitatClass = habitatClass(state.fractions);
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOODPLAIN_HABITAT_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

export function floodplainHabitatSummary(source) {
  const state = normalizeFloodplainHabitatState(source);
  return {
    observedDays: round(state.observedDays, 8),
    inundatedExposureDays: round(state.inundatedExposureDays, 8),
    wetDays: round(state.wetDays, 8),
    dryDays: round(state.dryDays, 8),
    currentWetSpellDays: round(state.currentWetSpellDays, 8),
    currentDrySpellDays: round(state.currentDrySpellDays, 8),
    floodPulseCount: Math.round(state.floodPulseCount),
    rollingHydroperiod30d: round(state.rollingHydroperiod30d, 9),
    peakInundatedFraction: round(state.peakInundatedFraction, 9),
    cumulativeNewDepositKg: round(state.cumulativeNewDepositKg, 9),
    fertilityIndex: round(state.fertilityIndex, 9),
    anaerobicStress: round(state.anaerobicStress, 9),
    habitatClass: state.habitatClass,
    fractions: Object.fromEntries(FLOODPLAIN_HABITAT_TYPES.map(id =>
      [id, round(state.fractions[id], 12)])),
    truth: truth()
  };
}

function habitatTarget(inundatedFraction, hydroperiod, fertility,
  newDepositSignal, drySpellDays) {
  const wet = clamp(inundatedFraction * .72 + hydroperiod * .38);
  const intermittency = clamp((1 - inundatedFraction) * hydroperiod * 2.1);
  const drought = clamp(drySpellDays / 45);
  return normalizeHabitatFractions({
    openWater: Math.pow(inundatedFraction, .72) * 1.35,
    mudflat: intermittency * (.65 + newDepositSignal * .8),
    reedSedge: wet * (1 - inundatedFraction * .46) * (.65 + fertility * .7),
    wetMeadow: (1 - wet) * (1 - drought * .55) * (.75 + fertility * .2),
    riparianWoodland: (1 - inundatedFraction) *
      (1 - hydroperiod * .72) * (.8 + drought * .35)
  });
}

export function advanceFloodplainHabitat(source, floodplainSource, dtDays,
  context = {}) {
  const durationDays = finite(dtDays);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Floodplain habitat step must be greater than zero and no longer than one day');
  }
  const materialBefore = materialDigest(floodplainSource);
  const state = normalizeFloodplainHabitatState(source);
  const floodplain = normalizeFloodplainState(floodplainSource);
  const material = floodplainTotals(floodplain);
  const depositedSedimentKg = Object.values(
    material.depositedSedimentKg).reduce((sum, value) => sum + value, 0);
  const currentWet = material.waterKg > 1e-6 ||
    material.inundatedFraction > 1e-9;
  const transitionId = String(context.transitionId ||
    `floodplain-habitat:${stableDigest({
      reachId: context.reachId || null,
      startDay: round(context.startDay, 8),
      durationDays: round(durationDays, 8),
      exchangeDigest: context.floodplainExchangeReceipt?.digest || null
    }).slice(9)}`);

  if (state.migrationCheckpoint) {
    state.migrationCheckpoint = false;
    state.lastWaterKg = material.waterKg;
    state.lastDepositedSedimentKg = depositedSedimentKg;
    const receipt = {
      schema: FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
      transitionId,
      reachId: context.reachId || null,
      status: 'initialized-after-migration-no-history',
      startDay: round(context.startDay, 8),
      durationDays: round(durationDays, 8),
      floodplainStateSchema: FLOODPLAIN_STATE_SCHEMA,
      floodplainExchangeDigest:
        context.floodplainExchangeReceipt?.digest || null,
      material: {
        beforeDigest: materialBefore,
        afterDigest: materialDigest(floodplainSource),
        waterKg: round(material.waterKg, 6),
        depositedSedimentKg: round(depositedSedimentKg, 9),
        newDepositKg: 0
      },
      memory: {
        observedDaysBefore: 0, observedDaysAfter: 0,
        floodPulseCountBefore: 0, floodPulseCountAfter: 0,
        rollingHydroperiod30dBefore: 0,
        rollingHydroperiod30dAfter: 0
      },
      habitat: {
        classBefore: state.habitatClass,
        classAfter: state.habitatClass,
        fractionsBefore: clone(state.fractions),
        fractionsAfter: clone(state.fractions),
        fractionSumResidual: 0
      },
      truth: {
        ...truth(), migrationInventedHistory: false,
        floodplainMaterialMutated: false,
        fractionsNormalized: true
      }
    };
    receipt.digest = stableDigest(receipt);
    state.lastTransitionReceipt = clone(receipt);
    return { state: normalizeFloodplainHabitatState(state),
      receipt: clone(receipt) };
  }

  const before = normalizeFloodplainHabitatState(state);
  const startsPulse = currentWet && before.currentWetSpellDays <= 1e-12 &&
    before.lastWaterKg <= 1e-6;
  const newDepositKg = Math.max(0,
    depositedSedimentKg - before.lastDepositedSedimentKg);
  const fineDepositKg = Math.max(0,
    finite(material.depositedSedimentKg.clay) +
      finite(material.depositedSedimentKg.silt));
  const totalChemistryKg = Math.max(0,
    finite(material.chemistry.nitrogenKgN) * 8 +
      finite(material.chemistry.phosphorusKgP) * 24 +
      finite(material.chemistry.carbonKgC) * .04);
  const chemistrySignal = clamp(Math.log1p(totalChemistryKg) / 18);
  const fineDepositSignal = clamp(Math.log1p(fineDepositKg) / 20);
  const newDepositSignal = clamp(Math.log1p(newDepositKg) / 12);
  const hydroAlpha = 1 - Math.exp(-durationDays / 30);
  const memoryAlpha = 1 - Math.exp(-durationDays / 45);
  const habitatAlpha = 1 - Math.exp(-durationDays / 14);

  state.observedDays += durationDays;
  state.inundatedExposureDays += material.inundatedFraction * durationDays;
  state.wetDays += currentWet ? durationDays : 0;
  state.dryDays += currentWet ? 0 : durationDays;
  state.currentWetSpellDays = currentWet
    ? before.currentWetSpellDays + durationDays : 0;
  state.currentDrySpellDays = currentWet
    ? 0 : before.currentDrySpellDays + durationDays;
  state.floodPulseCount += startsPulse ? 1 : 0;
  state.rollingHydroperiod30d += hydroAlpha *
    (material.inundatedFraction - state.rollingHydroperiod30d);
  state.peakInundatedFraction = Math.max(before.peakInundatedFraction,
    material.inundatedFraction);
  state.lastWaterKg = material.waterKg;
  state.lastDepositedSedimentKg = depositedSedimentKg;
  state.cumulativeNewDepositKg += newDepositKg;
  const fertilityTarget = clamp(chemistrySignal * .56 +
    fineDepositSignal * .3 + newDepositSignal * .14);
  state.fertilityIndex += memoryAlpha *
    (fertilityTarget - state.fertilityIndex);
  const anaerobicTarget = clamp(material.inundatedFraction * .7 +
    state.rollingHydroperiod30d * .45);
  state.anaerobicStress += memoryAlpha *
    (anaerobicTarget - state.anaerobicStress);
  const target = habitatTarget(material.inundatedFraction,
    state.rollingHydroperiod30d, state.fertilityIndex,
    newDepositSignal, state.currentDrySpellDays);
  state.fractions = normalizeHabitatFractions(Object.fromEntries(
    FLOODPLAIN_HABITAT_TYPES.map(id => [id,
      before.fractions[id] + habitatAlpha *
        (target[id] - before.fractions[id])])));
  state.habitatClass = habitatClass(state.fractions);

  const fractionSum = FLOODPLAIN_HABITAT_TYPES.reduce((sum, id) =>
    sum + state.fractions[id], 0);
  const materialAfter = materialDigest(floodplainSource);
  const receipt = {
    schema: FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
    transitionId,
    reachId: context.reachId || null,
    status: currentWet ? (startsPulse ? 'flood-pulse-observed' :
      'wet-exposure-observed') : 'dry-exposure-observed',
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    floodplainStateSchema: FLOODPLAIN_STATE_SCHEMA,
    floodplainExchangeDigest:
      context.floodplainExchangeReceipt?.digest || null,
    material: {
      beforeDigest: materialBefore,
      afterDigest: materialAfter,
      waterKg: round(material.waterKg, 6),
      inundatedFraction: round(material.inundatedFraction, 9),
      depositedSedimentKg: round(depositedSedimentKg, 9),
      fineDepositKg: round(fineDepositKg, 9),
      newDepositKg: round(newDepositKg, 9),
      dissolvedFertilitySignal: round(chemistrySignal, 9)
    },
    memory: {
      observedDaysBefore: round(before.observedDays, 8),
      observedDaysAfter: round(state.observedDays, 8),
      wetDaysAfter: round(state.wetDays, 8),
      dryDaysAfter: round(state.dryDays, 8),
      currentWetSpellDaysAfter: round(state.currentWetSpellDays, 8),
      currentDrySpellDaysAfter: round(state.currentDrySpellDays, 8),
      floodPulseCountBefore: Math.round(before.floodPulseCount),
      floodPulseCountAfter: Math.round(state.floodPulseCount),
      rollingHydroperiod30dBefore:
        round(before.rollingHydroperiod30d, 9),
      rollingHydroperiod30dAfter:
        round(state.rollingHydroperiod30d, 9),
      cumulativeNewDepositKgAfter:
        round(state.cumulativeNewDepositKg, 9)
    },
    habitat: {
      classBefore: before.habitatClass,
      classAfter: state.habitatClass,
      fractionsBefore: clone(before.fractions),
      fractionsAfter: clone(state.fractions),
      fertilityIndexAfter: round(state.fertilityIndex, 9),
      anaerobicStressAfter: round(state.anaerobicStress, 9),
      fractionSumResidual: round(fractionSum - 1, 12)
    },
    truth: {
      ...truth(), migrationInventedHistory: false,
      floodplainMaterialMutated: materialBefore !== materialAfter,
      fractionsNormalized: Math.abs(fractionSum - 1) < 1e-9,
      exchangeEvidenceBound: Boolean(
        context.floodplainExchangeReceipt?.digest)
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  return {
    state: normalizeFloodplainHabitatState(state),
    receipt: clone(receipt)
  };
}

export function floodplainHabitatDescription() {
  return {
    stateSchema: FLOODPLAIN_HABITAT_STATE_SCHEMA,
    transitionReceiptSchema: FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
    habitatTypes: [...FLOODPLAIN_HABITAT_TYPES],
    memory: [
      'observed-wet-and-dry-days', 'consecutive-wet-and-dry-spells',
      'flood-pulse-count', 'rolling-thirty-day-hydroperiod',
      'new-fine-deposit-and-dissolved-fertility-signals'
    ],
    materialAuthority: 'read-only-floodplain-state-observer',
    maximumStepDays: 1,
    truth: truth()
  };
}
