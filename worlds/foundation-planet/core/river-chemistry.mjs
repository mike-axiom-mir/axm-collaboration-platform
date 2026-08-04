export const RIVER_CHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.river-chemistry-state/v4';
export const PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.river-chemistry-state/v3';
export const LEGACY_RIVER_CHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.river-chemistry-state/v2';
export const OLDEST_RIVER_CHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.river-chemistry-state/v1';
export const RIVER_CHEMISTRY_INPUT_SCHEMA =
  'axm.foundation-planet.river-chemistry-input-receipt/v4';
export const PREVIOUS_RIVER_CHEMISTRY_INPUT_SCHEMA =
  'axm.foundation-planet.river-chemistry-input-receipt/v3';

export const DEFAULT_DIN_NITRATE_FRACTION = .5;

export const RIVER_CHEMISTRY_POOLS = Object.freeze([
  'dissolvedInorganicCarbonKgC',
  'dissolvedOrganicCarbonKgC',
  'dissolvedInorganicNitrogenKgN',
  'dissolvedInorganicPhosphorusKgP',
  'dissolvedOxygenKgO2',
  'alkalinityKgCaCO3Eq'
]);

export const RIVER_NITROGEN_SPECIES_POOLS = Object.freeze([
  'dissolvedNitrateNitrogenKgN',
  'dissolvedAmmoniumNitrogenKgN'
]);

const NON_NITROGEN_POOLS = Object.freeze([
  'dissolvedInorganicCarbonKgC',
  'dissolvedOrganicCarbonKgC',
  'dissolvedInorganicPhosphorusKgP',
  'dissolvedOxygenKgO2',
  'alkalinityKgCaCO3Eq'
]);
const MATERIAL_POOLS = Object.freeze([
  ...NON_NITROGEN_POOLS,
  ...RIVER_NITROGEN_SPECIES_POOLS
]);
const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));
const owns = (source, key) => Object.prototype.hasOwnProperty.call(
  source || {}, key);

function syncDissolvedInorganicNitrogen(state) {
  state.dissolvedInorganicNitrogenKgN = Math.max(0,
    finite(state.dissolvedNitrateNitrogenKgN) +
    finite(state.dissolvedAmmoniumNitrogenKgN));
  return state;
}

export function riverNitrogenSpecies(source = {}, options = {}) {
  const nitrateFraction = clamp(finite(options.nitrateFraction,
    DEFAULT_DIN_NITRATE_FRACTION));
  const explicitNitrate = Math.max(0, finite(
    source.dissolvedNitrateNitrogenKgN));
  const explicitAmmonium = Math.max(0, finite(
    source.dissolvedAmmoniumNitrogenKgN));
  const hasExplicitSpecies = owns(source,
    'dissolvedNitrateNitrogenKgN') || owns(source,
    'dissolvedAmmoniumNitrogenKgN');
  const aggregate = Math.max(0, finite(
    source.dissolvedInorganicNitrogenKgN));
  if (hasExplicitSpecies) {
    const explicitTotal = explicitNitrate + explicitAmmonium;
    if (owns(source, 'dissolvedInorganicNitrogenKgN') &&
      Math.abs(aggregate - explicitTotal) > 1e-7) {
      throw new Error('River chemistry DIN aggregate does not match nitrate plus ammonium');
    }
    return {
      dissolvedNitrateNitrogenKgN: explicitNitrate,
      dissolvedAmmoniumNitrogenKgN: explicitAmmonium,
      dissolvedInorganicNitrogenKgN: explicitTotal,
      nitrateFraction: explicitTotal > 0
        ? explicitNitrate / explicitTotal : nitrateFraction,
      parameterized: false
    };
  }
  return {
    dissolvedNitrateNitrogenKgN: aggregate * nitrateFraction,
    dissolvedAmmoniumNitrogenKgN: aggregate * (1 - nitrateFraction),
    dissolvedInorganicNitrogenKgN: aggregate,
    nitrateFraction,
    parameterized: aggregate > 0
  };
}

export function emptyRiverChemistry() {
  return {
    schema: RIVER_CHEMISTRY_STATE_SCHEMA,
    dissolvedInorganicCarbonKgC: 0,
    dissolvedOrganicCarbonKgC: 0,
    dissolvedNitrateNitrogenKgN: 0,
    dissolvedAmmoniumNitrogenKgN: 0,
    dissolvedInorganicNitrogenKgN: 0,
    dissolvedInorganicPhosphorusKgP: 0,
    dissolvedOxygenKgO2: 0,
    alkalinityKgCaCO3Eq: 0,
    cumulativeLandRunoffInputs: {
      carbonKgC: 0,
      nitrogenKgN: 0,
      phosphorusKgP: 0,
      oxygenKgO2: 0,
      alkalinityKgCaCO3Eq: 0
    },
    legacyParameterizedBoundaryInputs: {
      carbonKgC: 0,
      nitrogenKgN: 0,
      phosphorusKgP: 0,
      oxygenKgO2: 0,
      alkalinityKgCaCO3Eq: 0
    },
    migrationCheckpoint: false,
    lastInputReceipt: null,
    truth: {
      nitrateAndAmmoniumMaterialPools: true,
      dissolvedInorganicNitrogenIsCompatibilitySum: true,
      inputSpeciationMayBeParameterized: true,
      measuredSpeciationClaimed: false,
      nitritePoolResolved: false,
      nitrificationReactionModeled: false,
      persistentAlkalinityPool: true,
      alkalinityIsAcidNeutralizingCapacityEquivalent: true,
      measuredAlkalinityClaimed: false,
      carbonateSpeciationResolved: false,
      pHResolved: false
    }
  };
}

export function normalizeRiverChemistry(source, options = {}) {
  const state = emptyRiverChemistry();
  if (!source || ![
    RIVER_CHEMISTRY_STATE_SCHEMA,
    PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA,
    LEGACY_RIVER_CHEMISTRY_STATE_SCHEMA,
    OLDEST_RIVER_CHEMISTRY_STATE_SCHEMA
  ].includes(source.schema)) return state;
  for (const pool of NON_NITROGEN_POOLS) {
    state[pool] = Math.max(0, finite(source[pool]));
  }
  const species = [
    RIVER_CHEMISTRY_STATE_SCHEMA,
    PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA
  ].includes(source.schema)
    ? riverNitrogenSpecies(source, options)
    : riverNitrogenSpecies({
      dissolvedInorganicNitrogenKgN:
        source.dissolvedInorganicNitrogenKgN
    }, {
      nitrateFraction: finite(options.migrationNitrateFraction,
        DEFAULT_DIN_NITRATE_FRACTION)
    });
  state.dissolvedNitrateNitrogenKgN =
    species.dissolvedNitrateNitrogenKgN;
  state.dissolvedAmmoniumNitrogenKgN =
    species.dissolvedAmmoniumNitrogenKgN;
  syncDissolvedInorganicNitrogen(state);
  for (const key of Object.keys(state.cumulativeLandRunoffInputs)) {
    state.cumulativeLandRunoffInputs[key] = Math.max(0,
      finite(source.cumulativeLandRunoffInputs?.[key]));
    state.legacyParameterizedBoundaryInputs[key] = Math.max(0,
      finite(source.legacyParameterizedBoundaryInputs?.[key],
        finite(source.cumulativeBoundaryInputs?.[key])));
  }
  state.migrationCheckpoint = source.schema !==
    RIVER_CHEMISTRY_STATE_SCHEMA || source.migrationCheckpoint === true;
  state.lastInputReceipt = source.lastInputReceipt?.schema ===
    RIVER_CHEMISTRY_INPUT_SCHEMA
    ? clone(source.lastInputReceipt) : null;
  return state;
}

export function riverChemistryTotals(source) {
  const state = normalizeRiverChemistry(source);
  return {
    carbonKgC: state.dissolvedInorganicCarbonKgC +
      state.dissolvedOrganicCarbonKgC,
    nitrogenKgN: state.dissolvedNitrateNitrogenKgN +
      state.dissolvedAmmoniumNitrogenKgN,
    phosphorusKgP: state.dissolvedInorganicPhosphorusKgP,
    oxygenKgO2: state.dissolvedOxygenKgO2,
    alkalinityKgCaCO3Eq: state.alkalinityKgCaCO3Eq
  };
}

export function addRiverChemistry(target, inputs = {}, options = {}) {
  const state = normalizeRiverChemistry(target, options);
  for (const pool of NON_NITROGEN_POOLS) {
    state[pool] += Math.max(0, finite(inputs[pool]));
  }
  const species = riverNitrogenSpecies(inputs, options);
  state.dissolvedNitrateNitrogenKgN +=
    species.dissolvedNitrateNitrogenKgN;
  state.dissolvedAmmoniumNitrogenKgN +=
    species.dissolvedAmmoniumNitrogenKgN;
  if (MATERIAL_POOLS.some(pool => Math.max(0, finite(inputs[pool])) > 0) ||
    species.dissolvedInorganicNitrogenKgN > 0) {
    state.migrationCheckpoint = false;
  }
  return syncDissolvedInorganicNitrogen(state);
}

export function subtractRiverChemistry(target, debits = {}, options = {}) {
  const state = normalizeRiverChemistry(target, options);
  for (const pool of NON_NITROGEN_POOLS) {
    const debit = Math.max(0, finite(debits[pool]));
    if (debit > state[pool] + 1e-9) {
      throw new Error(`River chemistry donor exhausted: ${pool}`);
    }
    state[pool] = Math.max(0, state[pool] - debit);
  }
  let species;
  if (owns(debits, 'dissolvedNitrateNitrogenKgN') ||
    owns(debits, 'dissolvedAmmoniumNitrogenKgN')) {
    species = riverNitrogenSpecies(debits, options);
  } else {
    const aggregateDebit = Math.max(0, finite(
      debits.dissolvedInorganicNitrogenKgN));
    const available = state.dissolvedInorganicNitrogenKgN;
    const nitrateFraction = available > 0
      ? state.dissolvedNitrateNitrogenKgN / available
      : DEFAULT_DIN_NITRATE_FRACTION;
    species = riverNitrogenSpecies({
      dissolvedInorganicNitrogenKgN: aggregateDebit
    }, { nitrateFraction });
  }
  for (const pool of RIVER_NITROGEN_SPECIES_POOLS) {
    const debit = species[pool];
    if (debit > state[pool] + 1e-9) {
      throw new Error(`River chemistry donor exhausted: ${pool}`);
    }
    state[pool] = Math.max(0, state[pool] - debit);
  }
  if (MATERIAL_POOLS.some(pool => Math.max(0, finite(debits[pool])) > 0) ||
    species.dissolvedInorganicNitrogenKgN > 0) {
    state.migrationCheckpoint = false;
  }
  return syncDissolvedInorganicNitrogen(state);
}

export function riverChemistryFraction(source, fraction) {
  const state = normalizeRiverChemistry(source);
  const bounded = clamp(finite(fraction));
  const result = Object.fromEntries(MATERIAL_POOLS.map(pool =>
    [pool, state[pool] * bounded]));
  result.dissolvedInorganicNitrogenKgN =
    result.dissolvedNitrateNitrogenKgN +
    result.dissolvedAmmoniumNitrogenKgN;
  return result;
}

export function chemistryElementInputs(source = {}) {
  const species = riverNitrogenSpecies(source);
  return {
    carbonKgC: Math.max(0, finite(source.dissolvedInorganicCarbonKgC)) +
      Math.max(0, finite(source.dissolvedOrganicCarbonKgC)),
    nitrogenKgN: species.dissolvedInorganicNitrogenKgN,
    phosphorusKgP: Math.max(0,
      finite(source.dissolvedInorganicPhosphorusKgP)),
    oxygenKgO2: Math.max(0, finite(source.dissolvedOxygenKgO2)),
    alkalinityKgCaCO3Eq: Math.max(0,
      finite(source.alkalinityKgCaCO3Eq))
  };
}

export function applyRunoffBiogeochemistryInput(source, pools = {},
  deliveredFreshwaterKg, context = {}) {
  const state = normalizeRiverChemistry(source);
  const waterKg = Math.max(0, finite(deliveredFreshwaterKg));
  const nitrateFraction = clamp(finite(context.nitrateFraction,
    DEFAULT_DIN_NITRATE_FRACTION));
  const species = riverNitrogenSpecies(pools, { nitrateFraction });
  const inputs = {
    ...Object.fromEntries(NON_NITROGEN_POOLS.map(pool =>
      [pool, Math.max(0, finite(pools?.[pool]))])),
    dissolvedNitrateNitrogenKgN:
      species.dissolvedNitrateNitrogenKgN,
    dissolvedAmmoniumNitrogenKgN:
      species.dissolvedAmmoniumNitrogenKgN,
    dissolvedInorganicNitrogenKgN:
      species.dissolvedInorganicNitrogenKgN
  };
  const updated = addRiverChemistry(state, inputs);
  const elementInputs = chemistryElementInputs(inputs);
  for (const key of Object.keys(updated.cumulativeLandRunoffInputs)) {
    updated.cumulativeLandRunoffInputs[key] += elementInputs[key];
  }
  updated.migrationCheckpoint = false;
  const conservation = Object.fromEntries(MATERIAL_POOLS.map(pool => [
    `${pool}Residual`,
    round(updated[pool] - state[pool] - inputs[pool], 12)
  ]));
  conservation.dissolvedInorganicNitrogenKgNResidual = round(
    updated.dissolvedInorganicNitrogenKgN -
    state.dissolvedInorganicNitrogenKgN -
    inputs.dissolvedInorganicNitrogenKgN, 12);
  const receipt = {
    schema: RIVER_CHEMISTRY_INPUT_SCHEMA,
    transferId: String(context.transferId || 'unbound-transfer'),
    status: 'credited-from-persistent-land-runoff-queue-with-parameterized-din-speciation',
    deliveredFreshwaterKg: round(waterKg, 3),
    inputs: Object.fromEntries(Object.entries(elementInputs)
      .map(([key, value]) => [key, round(value, 9)])),
    pools: Object.fromEntries(Object.entries(inputs)
      .map(([key, value]) => [key, round(value, 9)])),
    nitrogenSpeciation: {
      nitrateNitrogenKgN: round(
        species.dissolvedNitrateNitrogenKgN, 9),
      ammoniumNitrogenKgN: round(
        species.dissolvedAmmoniumNitrogenKgN, 9),
      nitrateFraction: round(nitrateFraction, 9),
      parameterizedAtReceiverBoundary: species.parameterized
    },
    conservation,
    truth: {
      persistentReceivingRiverReservoir: true,
      parameterizedLandRunoffBoundary: false,
      landCarbonNitrogenPhosphorusOxygenSenderDebited: true,
      exactPairedTransferId: Boolean(context.transferId),
      riverToRiverAndRiverToOceanSenderDebited: true,
      nitrateAndAmmoniumReceiverPoolsCredited: true,
      nitratePlusAmmoniumEqualsDin: Math.abs(
        species.dissolvedNitrateNitrogenKgN +
        species.dissolvedAmmoniumNitrogenKgN -
        species.dissolvedInorganicNitrogenKgN) < 1e-9,
      inputSpeciationParameterized: species.parameterized,
      measuredInputSpeciationClaimed: false,
      nitritePoolResolved: false,
      nitrificationReactionModeled: false,
      alkalinitySenderDebited: true,
      alkalinityReceiverPoolCredited: true,
      carbonateSpeciationResolved: false,
      pHResolved: false
    }
  };
  receipt.digest = stableDigest(receipt);
  updated.lastInputReceipt = receipt;
  return { state: updated, receipt: clone(receipt) };
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

export function riverChemistryDescription() {
  return {
    stateSchema: RIVER_CHEMISTRY_STATE_SCHEMA,
    inputReceiptSchema: RIVER_CHEMISTRY_INPUT_SCHEMA,
    compatibilityPools: [...RIVER_CHEMISTRY_POOLS],
    nitrogenSpeciesPools: [...RIVER_NITROGEN_SPECIES_POOLS],
    defaultParameterizedInputNitrateFraction:
      DEFAULT_DIN_NITRATE_FRACTION,
    persistentReachReservoirs: true,
    exactReachTransferDebitsAndCredits: true,
    exactNitrateAmmoniumTransport: true,
    dissolvedInorganicNitrogenCompatibilitySum: true,
    parameterizedLandRunoffBoundary: false,
    parameterizedRunoffNitrogenSpeciation: true,
    measuredRunoffNitrogenSpeciation: false,
    landBiogeochemicalSenderDebits: true,
    persistentLandRunoffQueueRequired: true,
    persistentAlkalinityPool: true,
    alkalinityUnit: 'kg-CaCO3-equivalent',
    alkalinityMeasured: false,
    carbonateSpeciationResolved: false,
    pHResolved: false,
    inChannelReactionKinetics: false,
    nitritePoolResolved: false,
    nitrificationReactionModeled: false
  };
}
