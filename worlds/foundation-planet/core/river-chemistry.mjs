export const RIVER_CHEMISTRY_STATE_SCHEMA = 'axm.foundation-planet.river-chemistry-state/v2';
export const PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.river-chemistry-state/v1';
export const RIVER_CHEMISTRY_INPUT_SCHEMA = 'axm.foundation-planet.river-chemistry-input-receipt/v2';
export const PREVIOUS_RIVER_CHEMISTRY_INPUT_SCHEMA =
  'axm.foundation-planet.river-chemistry-input-receipt/v1';

export const RIVER_CHEMISTRY_POOLS = Object.freeze([
  'dissolvedInorganicCarbonKgC',
  'dissolvedOrganicCarbonKgC',
  'dissolvedInorganicNitrogenKgN',
  'dissolvedInorganicPhosphorusKgP',
  'dissolvedOxygenKgO2'
]);

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

export function emptyRiverChemistry() {
  return {
    schema: RIVER_CHEMISTRY_STATE_SCHEMA,
    dissolvedInorganicCarbonKgC: 0,
    dissolvedOrganicCarbonKgC: 0,
    dissolvedInorganicNitrogenKgN: 0,
    dissolvedInorganicPhosphorusKgP: 0,
    dissolvedOxygenKgO2: 0,
    cumulativeLandRunoffInputs: {
      carbonKgC: 0,
      nitrogenKgN: 0,
      phosphorusKgP: 0,
      oxygenKgO2: 0
    },
    legacyParameterizedBoundaryInputs: {
      carbonKgC: 0,
      nitrogenKgN: 0,
      phosphorusKgP: 0,
      oxygenKgO2: 0
    },
    migrationCheckpoint: false,
    lastInputReceipt: null
  };
}

export function normalizeRiverChemistry(source) {
  const state = emptyRiverChemistry();
  if (!source || ![
    RIVER_CHEMISTRY_STATE_SCHEMA,
    PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA
  ].includes(source.schema)) return state;
  for (const pool of RIVER_CHEMISTRY_POOLS) state[pool] = Math.max(0, finite(source[pool]));
  for (const key of Object.keys(state.cumulativeLandRunoffInputs)) {
    state.cumulativeLandRunoffInputs[key] = Math.max(0,
      finite(source.cumulativeLandRunoffInputs?.[key]));
    state.legacyParameterizedBoundaryInputs[key] = Math.max(0,
      finite(source.legacyParameterizedBoundaryInputs?.[key],
        finite(source.cumulativeBoundaryInputs?.[key])));
  }
  state.migrationCheckpoint = source.schema ===
    PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA || source.migrationCheckpoint === true;
  state.lastInputReceipt = source.lastInputReceipt?.schema ===
    RIVER_CHEMISTRY_INPUT_SCHEMA
    ? clone(source.lastInputReceipt) : null;
  return state;
}

export function riverChemistryTotals(source) {
  const state = normalizeRiverChemistry(source);
  return {
    carbonKgC: state.dissolvedInorganicCarbonKgC + state.dissolvedOrganicCarbonKgC,
    nitrogenKgN: state.dissolvedInorganicNitrogenKgN,
    phosphorusKgP: state.dissolvedInorganicPhosphorusKgP,
    oxygenKgO2: state.dissolvedOxygenKgO2
  };
}

export function addRiverChemistry(target, inputs = {}) {
  const state = normalizeRiverChemistry(target);
  for (const pool of RIVER_CHEMISTRY_POOLS) state[pool] += Math.max(0, finite(inputs[pool]));
  return state;
}

export function subtractRiverChemistry(target, debits = {}) {
  const state = normalizeRiverChemistry(target);
  for (const pool of RIVER_CHEMISTRY_POOLS) {
    const debit = Math.max(0, finite(debits[pool]));
    if (debit > state[pool] + 1e-9) throw new Error(`River chemistry donor exhausted: ${pool}`);
    state[pool] = Math.max(0, state[pool] - debit);
  }
  return state;
}

export function riverChemistryFraction(source, fraction) {
  const state = normalizeRiverChemistry(source);
  const bounded = clamp(finite(fraction));
  return Object.fromEntries(RIVER_CHEMISTRY_POOLS.map(pool => [pool, state[pool] * bounded]));
}

export function chemistryElementInputs(source = {}) {
  return {
    carbonKgC: Math.max(0, finite(source.dissolvedInorganicCarbonKgC)) +
      Math.max(0, finite(source.dissolvedOrganicCarbonKgC)),
    nitrogenKgN: Math.max(0, finite(source.dissolvedInorganicNitrogenKgN)),
    phosphorusKgP: Math.max(0, finite(source.dissolvedInorganicPhosphorusKgP)),
    oxygenKgO2: Math.max(0, finite(source.dissolvedOxygenKgO2))
  };
}

export function applyRunoffBiogeochemistryInput(source, pools = {},
  deliveredFreshwaterKg, context = {}) {
  const state = normalizeRiverChemistry(source);
  const waterKg = Math.max(0, finite(deliveredFreshwaterKg));
  const inputs = Object.fromEntries(RIVER_CHEMISTRY_POOLS.map(pool =>
    [pool, Math.max(0, finite(pools?.[pool]))]));
  const updated = addRiverChemistry(state, inputs);
  const elementInputs = chemistryElementInputs(inputs);
  for (const key of Object.keys(updated.cumulativeLandRunoffInputs)) {
    updated.cumulativeLandRunoffInputs[key] += elementInputs[key];
  }
  updated.migrationCheckpoint = false;
  const receipt = {
    schema: RIVER_CHEMISTRY_INPUT_SCHEMA,
    transferId: String(context.transferId || 'unbound-transfer'),
    status: 'credited-from-persistent-land-runoff-queue',
    deliveredFreshwaterKg: round(waterKg, 3),
    inputs: Object.fromEntries(Object.entries(elementInputs)
      .map(([key, value]) => [key, round(value, 9)])),
    pools: Object.fromEntries(RIVER_CHEMISTRY_POOLS.map(pool => [pool, round(inputs[pool], 9)])),
    conservation: Object.fromEntries(RIVER_CHEMISTRY_POOLS.map(pool => [
      `${pool}Residual`,
      round(updated[pool] - state[pool] - inputs[pool], 12)
    ])),
    truth: {
      persistentReceivingRiverReservoir: true,
      parameterizedLandRunoffBoundary: false,
      landCarbonNitrogenPhosphorusOxygenSenderDebited: true,
      exactPairedTransferId: Boolean(context.transferId),
      riverToRiverAndRiverToOceanSenderDebited: true
    }
  };
  updated.lastInputReceipt = receipt;
  return { state: updated, receipt: clone(receipt) };
}

export function riverChemistryDescription() {
  return {
    stateSchema: RIVER_CHEMISTRY_STATE_SCHEMA,
    inputReceiptSchema: RIVER_CHEMISTRY_INPUT_SCHEMA,
    pools: [...RIVER_CHEMISTRY_POOLS],
    persistentReachReservoirs: true,
    exactReachTransferDebitsAndCredits: true,
    parameterizedLandRunoffBoundary: false,
    landBiogeochemicalSenderDebits: true,
    persistentLandRunoffQueueRequired: true,
    inChannelReactionKinetics: false
  };
}
