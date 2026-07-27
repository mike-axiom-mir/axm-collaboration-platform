import { checksum } from './world-state.mjs';

export const SURFACE_SEDIMENT_STATE_SCHEMA =
  'axm.foundation-planet.surface-sediment-state/v1';
export const RUNOFF_SEDIMENT_QUEUE_SCHEMA =
  'axm.foundation-planet.runoff-sediment-queue/v1';
export const SURFACE_EROSION_RECEIPT_SCHEMA =
  'axm.foundation-planet.surface-erosion-receipt/v1';
export const RUNOFF_SEDIMENT_TRANSFER_SCHEMA =
  'axm.foundation-planet.runoff-sediment-transfer-receipt/v1';
export const RIVER_SEDIMENT_STATE_SCHEMA =
  'axm.foundation-planet.river-sediment-state/v1';
export const RIVER_SEDIMENT_INPUT_SCHEMA =
  'axm.foundation-planet.river-sediment-input-receipt/v1';
export const RIVER_SEDIMENT_ROUTE_SCHEMA =
  'axm.foundation-planet.river-sediment-route-receipt/v1';
export const COASTAL_SEDIMENT_STATE_SCHEMA =
  'axm.foundation-planet.coastal-sediment-state/v1';
export const COASTAL_SEDIMENT_INPUT_SCHEMA =
  'axm.foundation-planet.coastal-sediment-input-receipt/v1';

export const SEDIMENT_GRAINS = Object.freeze([
  Object.freeze({ id: 'clay', diameterMm: .002, settlingRank: .04 }),
  Object.freeze({ id: 'silt', diameterMm: .035, settlingRank: .18 }),
  Object.freeze({ id: 'sand', diameterMm: .55, settlingRank: .58 }),
  Object.freeze({ id: 'gravel', diameterMm: 12, settlingRank: .9 })
]);

const GRAIN_IDS = Object.freeze(SEDIMENT_GRAINS.map(grain => grain.id));
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));

function grains(source = {}) {
  return Object.fromEntries(GRAIN_IDS.map(id => [id,
    Math.max(0, finite(source?.[id]))]));
}

function sumGrains(source = {}) {
  return GRAIN_IDS.reduce((total, id) => total + Math.max(0,
    finite(source?.[id])), 0);
}

function roundedGrains(source = {}, digits = 12) {
  return Object.fromEntries(GRAIN_IDS.map(id => [id,
    round(Math.max(0, finite(source?.[id])), digits)]));
}

function addGrains(left = {}, right = {}) {
  return Object.fromEntries(GRAIN_IDS.map(id => [id,
    Math.max(0, finite(left?.[id])) + Math.max(0, finite(right?.[id]))]));
}

function subtractGrains(left = {}, right = {}, tolerance = 1e-9) {
  const result = {};
  for (const id of GRAIN_IDS) {
    const available = Math.max(0, finite(left?.[id]));
    const debit = Math.max(0, finite(right?.[id]));
    if (debit > available + tolerance) {
      throw new Error(`Sediment donor exhausted: ${id}`);
    }
    result[id] = Math.max(0, available - debit);
  }
  return result;
}

function scaleGrains(source = {}, fraction = 1) {
  const bounded = clamp(finite(fraction));
  return Object.fromEntries(GRAIN_IDS.map(id => [id,
    Math.max(0, finite(source?.[id])) * bounded]));
}

function grainResidual(initial, final, debit = {}, credit = {}) {
  return Object.fromEntries(GRAIN_IDS.map(id => [id, round(
    finite(final?.[id]) + finite(debit?.[id]) - finite(initial?.[id]) -
      finite(credit?.[id]), 9)]));
}

function digestReceipt(receipt) {
  return { ...receipt, digest: checksum(receipt) };
}

function textureFractions(texture) {
  const table = {
    sand: { clay: .04, silt: .11, sand: .72, gravel: .13 },
    loam: { clay: .18, silt: .42, sand: .32, gravel: .08 },
    clay: { clay: .51, silt: .34, sand: .12, gravel: .03 },
    organic: { clay: .22, silt: .47, sand: .25, gravel: .06 },
    fractured: { clay: .07, silt: .15, sand: .31, gravel: .47 }
  };
  return table[texture] || table.loam;
}

function bulkDensityKgM3(texture) {
  return texture === 'organic' ? 760 : texture === 'clay' ? 1340
    : texture === 'sand' ? 1580 : texture === 'fractured' ? 1720 : 1460;
}

function stateTruth() {
  return {
    finiteMineralOwnership: true,
    grainResolved: true,
    bedrockWeatheringResolved: false,
    mechanisticSoilFormation: false,
    scientificErosionModel: false
  };
}

export function createSurfaceSediment(sample = {}, substrate = {}) {
  if (sample.land === false) return null;
  const texture = String(substrate.texture || 'loam');
  const soilDepthM = clamp(finite(substrate.soilDepthM,
    finite(sample?.geology?.soilDepthM, .3)), .001, 8);
  const bulkDensity = bulkDensityKgM3(texture);
  const totalKgM2 = soilDepthM * bulkDensity;
  const fractions = textureFractions(texture);
  const availableKgM2 = Object.fromEntries(GRAIN_IDS.map(id => [id,
    totalKgM2 * fractions[id]]));
  return {
    schema: SURFACE_SEDIMENT_STATE_SCHEMA,
    migrationCheckpoint: false,
    texture,
    bulkDensityKgM3: bulkDensity,
    initialSoilDepthM: round(soilDepthM, 9),
    effectiveSoilDepthM: round(soilDepthM, 9),
    geomorphicElevationAdjustmentM: 0,
    availableKgM2: roundedGrains(availableKgM2),
    cumulativeErodedKgM2: grains(),
    lastErosionReceipt: null,
    truth: stateTruth()
  };
}

export function emptyMigratedSurfaceSediment() {
  return {
    schema: SURFACE_SEDIMENT_STATE_SCHEMA,
    migrationCheckpoint: true,
    texture: 'migration-unknown',
    bulkDensityKgM3: 1460,
    initialSoilDepthM: 0,
    effectiveSoilDepthM: 0,
    geomorphicElevationAdjustmentM: 0,
    availableKgM2: grains(),
    cumulativeErodedKgM2: grains(),
    lastErosionReceipt: null,
    truth: stateTruth()
  };
}

export function normalizeSurfaceSediment(source) {
  if (source?.schema !== SURFACE_SEDIMENT_STATE_SCHEMA) {
    return emptyMigratedSurfaceSediment();
  }
  const state = clone(source);
  state.migrationCheckpoint = state.migrationCheckpoint === true;
  state.texture = String(state.texture || 'migration-unknown');
  state.bulkDensityKgM3 = clamp(finite(state.bulkDensityKgM3, 1460), 400, 2600);
  state.initialSoilDepthM = Math.max(0, finite(state.initialSoilDepthM));
  state.availableKgM2 = grains(state.availableKgM2);
  state.cumulativeErodedKgM2 = grains(state.cumulativeErodedKgM2);
  const remainingDepthM = sumGrains(state.availableKgM2) /
    state.bulkDensityKgM3;
  state.effectiveSoilDepthM = round(remainingDepthM, 12);
  state.geomorphicElevationAdjustmentM = round(Math.min(0,
    remainingDepthM - state.initialSoilDepthM), 12);
  state.lastErosionReceipt = state.lastErosionReceipt?.schema ===
    SURFACE_EROSION_RECEIPT_SCHEMA ? clone(state.lastErosionReceipt) : null;
  state.truth = stateTruth();
  return state;
}

export function emptyRunoffSedimentQueue() {
  return {
    schema: RUNOFF_SEDIMENT_QUEUE_SCHEMA,
    suspendedKgM2: grains(),
    cumulativeDebitedKgM2: grains(),
    cumulativeCreditedKgM2: grains(),
    lastTransferReceipt: null,
    truth: {
      persistent: true,
      carriedByRunoffFraction: true,
      mineralSediment: true
    }
  };
}

export function normalizeRunoffSedimentQueue(source) {
  const queue = emptyRunoffSedimentQueue();
  if (source?.schema !== RUNOFF_SEDIMENT_QUEUE_SCHEMA) return queue;
  queue.suspendedKgM2 = grains(source.suspendedKgM2);
  queue.cumulativeDebitedKgM2 = grains(source.cumulativeDebitedKgM2);
  queue.cumulativeCreditedKgM2 = grains(source.cumulativeCreditedKgM2);
  queue.lastTransferReceipt = source.lastTransferReceipt?.schema ===
    RUNOFF_SEDIMENT_TRANSFER_SCHEMA ? clone(source.lastTransferReceipt) : null;
  return queue;
}

function noErosionReceipt(state, queue, status, runoffMm, context = {}) {
  const receipt = {
    schema: SURFACE_EROSION_RECEIPT_SCHEMA,
    status,
    durationDays: round(Math.max(0, finite(context.durationDays, 1)), 9),
    surfaceRunoffMm: round(Math.max(0, finite(runoffMm)), 9),
    rainfallMm: round(Math.max(0, finite(context.rainfallMm)), 9),
    snowmeltMm: round(Math.max(0, finite(context.snowmeltMm)), 9),
    mobilizedKgM2: grains(),
    totalMobilizedKgM2: 0,
    surfaceResidualKgM2: grains(),
    queueResidualKgM2: grains(),
    truth: {
      finiteDonorDebited: true,
      runoffQueueCredited: true,
      conservationClosed: true,
      dryStepExportsSediment: false,
      migrationInventedHistoricalErosion: false,
      parameterizedErosion: true
    }
  };
  const sealedReceipt = digestReceipt(receipt);
  state.lastErosionReceipt = sealedReceipt;
  return { state, queue, receipt: clone(sealedReceipt) };
}

export function erodeSurfaceSediment(source, queueSource, surfaceRunoffMm,
  context = {}) {
  let state = normalizeSurfaceSediment(source);
  const queue = normalizeRunoffSedimentQueue(queueSource);
  const runoffMm = Math.max(0, finite(surfaceRunoffMm));
  if (state.migrationCheckpoint) {
    state = createSurfaceSediment(context.sample || { land: true },
      context.substrate || {});
    return noErosionReceipt(state, queue,
      'initialized-after-migration-no-export', runoffMm, context);
  }
  if (!(runoffMm > 1e-12) || sumGrains(state.availableKgM2) <= 1e-12) {
    return noErosionReceipt(state, queue, 'no-surface-runoff-no-export',
      runoffMm, context);
  }
  const initialSurface = grains(state.availableKgM2);
  const initialQueue = grains(queue.suspendedKgM2);
  const durationDays = clamp(finite(context.durationDays, 1), 1e-6, 1);
  const rainfallMm = Math.max(0, finite(context.rainfallMm));
  const erosionRisk = clamp(finite(context.sample?.geology?.erosionRisk,
    .25));
  const slopeProxy = clamp(finite(context.slope,
    .006 + erosionRisk * .12), 0, .7);
  const canopy = clamp(finite(context.ecology?.canopyCover));
  const litterKgCm2 = Math.max(0,
    finite(context.ecology?.carbon?.litterKgCm2));
  const protection = clamp(1 - canopy * .72 -
    (1 - Math.exp(-litterKgCm2 * 1.7)) * .2, .06, 1);
  const thaw = 1 - clamp(finite(context.soilFrozenFraction)) * .9;
  const rainfallImpact = clamp(rainfallMm / 55);
  const runoffEnergy = runoffMm * (.28 + rainfallImpact * .72) *
    (.18 + slopeProxy * 9.5) * (.12 + erosionRisk * .88) * protection *
    thaw * durationDays;
  const requestedKgM2 = Math.min(sumGrains(initialSurface),
    runoffEnergy * .018);
  const mobility = { clay: 1, silt: .92, sand: .48, gravel: .075 };
  const weights = Object.fromEntries(GRAIN_IDS.map(id => [id,
    initialSurface[id] * mobility[id]]));
  const weightTotal = Math.max(1e-30, sumGrains(weights));
  const mobilized = Object.fromEntries(GRAIN_IDS.map(id => [id,
    Math.min(initialSurface[id], requestedKgM2 * weights[id] / weightTotal)]));
  state.availableKgM2 = subtractGrains(initialSurface, mobilized);
  state.cumulativeErodedKgM2 = addGrains(state.cumulativeErodedKgM2,
    mobilized);
  queue.suspendedKgM2 = addGrains(initialQueue, mobilized);
  queue.cumulativeCreditedKgM2 = addGrains(queue.cumulativeCreditedKgM2,
    mobilized);
  const remainingDepthM = sumGrains(state.availableKgM2) /
    state.bulkDensityKgM3;
  state.effectiveSoilDepthM = round(remainingDepthM, 12);
  state.geomorphicElevationAdjustmentM = round(Math.min(0,
    remainingDepthM - state.initialSoilDepthM), 12);
  const surfaceResidualKgM2 = grainResidual(initialSurface,
    state.availableKgM2, mobilized);
  const queueResidualKgM2 = grainResidual(initialQueue,
    queue.suspendedKgM2, {}, mobilized);
  const receipt = digestReceipt({
    schema: SURFACE_EROSION_RECEIPT_SCHEMA,
    status: sumGrains(mobilized) > 0
      ? 'finite-surface-sediment-mobilized' : 'no-mobile-grain',
    durationDays: round(durationDays, 9),
    surfaceRunoffMm: round(runoffMm, 9),
    rainfallMm: round(rainfallMm, 9),
    snowmeltMm: round(Math.max(0, finite(context.snowmeltMm)), 9),
    controls: {
      erosionRisk: round(erosionRisk, 9),
      slopeProxy: round(slopeProxy, 9),
      canopyProtection: round(canopy, 9),
      surfaceProtectionFraction: round(1 - protection, 9),
      unfrozenFraction: round(thaw, 9)
    },
    mobilizedKgM2: roundedGrains(mobilized),
    totalMobilizedKgM2: round(sumGrains(mobilized), 12),
    surfaceResidualKgM2,
    queueResidualKgM2,
    geomorphicElevationAdjustmentM:
      state.geomorphicElevationAdjustmentM,
    truth: {
      finiteDonorDebited: true,
      runoffQueueCredited: true,
      conservationClosed: [...Object.values(surfaceResidualKgM2),
        ...Object.values(queueResidualKgM2)].every(value =>
        Math.abs(value) < 1e-8),
      dryStepExportsSediment: false,
      migrationInventedHistoricalErosion: false,
      parameterizedErosion: true
    }
  });
  state.lastErosionReceipt = receipt;
  return { state, queue, receipt: clone(receipt) };
}

export function runoffSedimentAbsoluteGrains(source, areaM2 = 1,
  fraction = 1) {
  const queue = normalizeRunoffSedimentQueue(source);
  const area = Math.max(1, finite(areaM2, 1));
  return Object.fromEntries(GRAIN_IDS.map(id => [id,
    queue.suspendedKgM2[id] * area * clamp(finite(fraction, 1))]));
}

export function debitRunoffSedimentQueue(source, fraction, areaM2,
  context = {}) {
  const queue = normalizeRunoffSedimentQueue(source);
  const initial = grains(queue.suspendedKgM2);
  const area = Math.max(1, finite(areaM2, 1));
  const bounded = clamp(finite(fraction));
  const debitedKg = runoffSedimentAbsoluteGrains(queue, area, bounded);
  const debitedKgM2 = Object.fromEntries(GRAIN_IDS.map(id => [id,
    debitedKg[id] / area]));
  queue.suspendedKgM2 = subtractGrains(initial, debitedKgM2);
  queue.cumulativeDebitedKgM2 = addGrains(queue.cumulativeDebitedKgM2,
    debitedKgM2);
  const residualKg = Object.fromEntries(GRAIN_IDS.map(id => [id, round(
    (initial[id] - queue.suspendedKgM2[id]) * area - debitedKg[id], 9)]));
  const receipt = digestReceipt({
    schema: RUNOFF_SEDIMENT_TRANSFER_SCHEMA,
    transferId: String(context.transferId || 'local-sediment-debit'),
    role: 'sender-debit',
    sourceCellId: context.sourceCellId || null,
    destinationId: context.destinationId || null,
    destinationKind: context.destinationKind || null,
    waterFraction: round(bounded, 12),
    grainsKg: roundedGrains(debitedKg, 9),
    totalKg: round(sumGrains(debitedKg), 9),
    residualKg,
    truth: { senderDebited: true, receiverCredited: false,
      sameWaterFraction: true, conservationClosed: Object.values(residualKg)
        .every(value => Math.abs(value) < 1e-7) }
  });
  queue.lastTransferReceipt = receipt;
  return { queue, grainsKg: debitedKg, receipt: clone(receipt) };
}

export function creditRunoffSedimentQueue(source, grainsKg, areaM2,
  context = {}) {
  const queue = normalizeRunoffSedimentQueue(source);
  const initial = grains(queue.suspendedKgM2);
  const area = Math.max(1, finite(areaM2, 1));
  const creditKg = grains(grainsKg);
  const creditKgM2 = Object.fromEntries(GRAIN_IDS.map(id => [id,
    creditKg[id] / area]));
  queue.suspendedKgM2 = addGrains(initial, creditKgM2);
  queue.cumulativeCreditedKgM2 = addGrains(queue.cumulativeCreditedKgM2,
    creditKgM2);
  const residualKg = Object.fromEntries(GRAIN_IDS.map(id => [id, round(
    (queue.suspendedKgM2[id] - initial[id]) * area - creditKg[id], 9)]));
  const receipt = digestReceipt({
    schema: RUNOFF_SEDIMENT_TRANSFER_SCHEMA,
    transferId: String(context.transferId || 'local-sediment-credit'),
    role: 'receiver-credit',
    sourceCellId: context.sourceCellId || null,
    destinationId: context.destinationId || null,
    destinationKind: 'land-runoff-queue',
    waterFraction: round(clamp(finite(context.waterFraction)), 12),
    grainsKg: roundedGrains(creditKg, 9),
    totalKg: round(sumGrains(creditKg), 9),
    residualKg,
    truth: { senderDebited: false, receiverCredited: true,
      sameWaterFraction: true, conservationClosed: Object.values(residualKg)
        .every(value => Math.abs(value) < 1e-7) }
  });
  queue.lastTransferReceipt = receipt;
  return { queue, receipt: clone(receipt) };
}

export function emptyCoastalSediment() {
  return {
    schema: COASTAL_SEDIMENT_STATE_SCHEMA,
    suspendedKgM2: grains(),
    depositedKgM2: grains(),
    cumulativeInputKgM2: grains(),
    lastInputReceipt: null,
    truth: {
      persistent: true,
      grainSelectiveDeposition: true,
      resolvedCoastalMorphodynamics: false
    }
  };
}

export function normalizeCoastalSediment(source) {
  const state = emptyCoastalSediment();
  if (source?.schema !== COASTAL_SEDIMENT_STATE_SCHEMA) return state;
  state.suspendedKgM2 = grains(source.suspendedKgM2);
  state.depositedKgM2 = grains(source.depositedKgM2);
  state.cumulativeInputKgM2 = grains(source.cumulativeInputKgM2);
  state.lastInputReceipt = source.lastInputReceipt?.schema ===
    COASTAL_SEDIMENT_INPUT_SCHEMA ? clone(source.lastInputReceipt) : null;
  return state;
}

export function creditCoastalSediment(source, grainsKg, areaM2,
  context = {}) {
  const state = normalizeCoastalSediment(source);
  const area = Math.max(1, finite(areaM2, 1));
  const inputKg = grains(grainsKg);
  const initialSuspended = grains(state.suspendedKgM2);
  const initialDeposited = grains(state.depositedKgM2);
  const deposition = { clay: .12, silt: .34, sand: .78, gravel: .98 };
  const depositedKg = Object.fromEntries(GRAIN_IDS.map(id => [id,
    inputKg[id] * deposition[id]]));
  const suspendedKg = subtractGrains(inputKg, depositedKg);
  state.suspendedKgM2 = addGrains(initialSuspended,
    Object.fromEntries(GRAIN_IDS.map(id => [id, suspendedKg[id] / area])));
  state.depositedKgM2 = addGrains(initialDeposited,
    Object.fromEntries(GRAIN_IDS.map(id => [id, depositedKg[id] / area])));
  state.cumulativeInputKgM2 = addGrains(state.cumulativeInputKgM2,
    Object.fromEntries(GRAIN_IDS.map(id => [id, inputKg[id] / area])));
  const residualKg = Object.fromEntries(GRAIN_IDS.map(id => [id, round(
    (state.suspendedKgM2[id] - initialSuspended[id] +
      state.depositedKgM2[id] - initialDeposited[id]) * area - inputKg[id],
    9)]));
  const receipt = digestReceipt({
    schema: COASTAL_SEDIMENT_INPUT_SCHEMA,
    transferId: String(context.transferId || 'coastal-sediment-input'),
    sourceId: context.sourceId || null,
    destinationCellId: context.destinationCellId || null,
    inputKg: roundedGrains(inputKg, 9),
    suspendedKg: roundedGrains(suspendedKg, 9),
    depositedKg: roundedGrains(depositedKg, 9),
    residualKg,
    truth: {
      receiverCredited: true,
      grainSelectiveDeposition: true,
      conservationClosed: Object.values(residualKg).every(value =>
        Math.abs(value) < 1e-7),
      resolvedCoastalMorphodynamics: false
    }
  });
  state.lastInputReceipt = receipt;
  return { state, receipt: clone(receipt) };
}

export function emptyRiverSediment(options = {}) {
  return {
    schema: RIVER_SEDIMENT_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    suspendedKg: grains(),
    bedDepositKg: grains(),
    cumulativeInflowKg: grains(),
    cumulativeOutflowKg: grains(),
    cumulativeDepositedKg: grains(),
    lastInputReceipt: null,
    lastRouteReceipt: null,
    truth: {
      persistent: true,
      grainResolved: true,
      suspendedAndBedIndependent: true,
      resolvedChannelMorphodynamics: false
    }
  };
}

export function normalizeRiverSediment(source, options = {}) {
  const state = emptyRiverSediment(options);
  if (source?.schema !== RIVER_SEDIMENT_STATE_SCHEMA) return state;
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  state.suspendedKg = grains(source.suspendedKg);
  state.bedDepositKg = grains(source.bedDepositKg);
  state.cumulativeInflowKg = grains(source.cumulativeInflowKg);
  state.cumulativeOutflowKg = grains(source.cumulativeOutflowKg);
  state.cumulativeDepositedKg = grains(source.cumulativeDepositedKg);
  state.lastInputReceipt = source.lastInputReceipt?.schema ===
    RIVER_SEDIMENT_INPUT_SCHEMA ? clone(source.lastInputReceipt) : null;
  state.lastRouteReceipt = source.lastRouteReceipt?.schema ===
    RIVER_SEDIMENT_ROUTE_SCHEMA ? clone(source.lastRouteReceipt) : null;
  return state;
}

export function riverSedimentTotals(source) {
  const state = normalizeRiverSediment(source);
  return {
    suspendedKg: roundedGrains(state.suspendedKg, 9),
    bedDepositKg: roundedGrains(state.bedDepositKg, 9),
    totalKg: round(sumGrains(state.suspendedKg) +
      sumGrains(state.bedDepositKg), 9)
  };
}

export function applyRunoffSedimentInput(source, grainsKg, context = {}) {
  const state = normalizeRiverSediment(source);
  const initial = grains(state.suspendedKg);
  const inputKg = grains(grainsKg);
  state.suspendedKg = addGrains(initial, inputKg);
  state.cumulativeInflowKg = addGrains(state.cumulativeInflowKg, inputKg);
  state.migrationCheckpoint = false;
  const residualKg = grainResidual(initial, state.suspendedKg, {}, inputKg);
  const receipt = digestReceipt({
    schema: RIVER_SEDIMENT_INPUT_SCHEMA,
    transferId: String(context.transferId || 'river-sediment-input'),
    sourceCellId: context.sourceCellId || null,
    reachId: context.reachId || null,
    inputKg: roundedGrains(inputKg, 9),
    totalInputKg: round(sumGrains(inputKg), 9),
    residualKg,
    truth: {
      receiverCredited: true,
      migrationInventedHistoricalSediment: false,
      conservationClosed: Object.values(residualKg).every(value =>
        Math.abs(value) < 1e-7)
    }
  });
  state.lastInputReceipt = receipt;
  return { state, receipt: clone(receipt) };
}

export function riverSedimentTransportLoad(source, waterFraction) {
  const state = normalizeRiverSediment(source);
  return scaleGrains(state.suspendedKg, waterFraction);
}

export function routeRiverSedimentLoad(source, requestedKg, context = {}) {
  const state = normalizeRiverSediment(source);
  const initialSuspended = grains(state.suspendedKg);
  const initialBed = grains(state.bedDepositKg);
  const request = grains(requestedKg);
  for (const id of GRAIN_IDS) {
    if (request[id] > initialSuspended[id] + 1e-7) {
      throw new Error(`River sediment donor exhausted: ${id}`);
    }
  }
  const residenceDays = clamp(finite(context.residenceDays, .5), .01, 30);
  const slope = clamp(finite(context.slope), 0, 1);
  const dischargeM3s = Math.max(.001, finite(context.dischargeM3s, 1));
  const competence = clamp(slope * 95 + Math.log1p(dischargeM3s) * .11,
    0, 1);
  const residenceFactor = clamp(residenceDays / (residenceDays + .42),
    .02, .99);
  const mouthFactor = context.destinationKind === 'coastal-ocean' ? 1.18 : 1;
  const depositedKg = Object.fromEntries(SEDIMENT_GRAINS.map(grain => {
    const fraction = clamp(grain.settlingRank * residenceFactor *
      (1 - competence * .68) * mouthFactor, 0, .995);
    return [grain.id, request[grain.id] * fraction];
  }));
  const exportedKg = subtractGrains(request, depositedKg);
  state.suspendedKg = subtractGrains(initialSuspended, request);
  state.bedDepositKg = addGrains(initialBed, depositedKg);
  state.cumulativeDepositedKg = addGrains(state.cumulativeDepositedKg,
    depositedKg);
  state.cumulativeOutflowKg = addGrains(state.cumulativeOutflowKg,
    exportedKg);
  const residualKg = Object.fromEntries(GRAIN_IDS.map(id => [id, round(
    initialSuspended[id] - state.suspendedKg[id] - depositedKg[id] -
      exportedKg[id], 9)]));
  const receipt = digestReceipt({
    schema: RIVER_SEDIMENT_ROUTE_SCHEMA,
    transferId: String(context.transferId || 'river-sediment-route'),
    sourceReachId: context.sourceReachId || null,
    destinationId: context.destinationId || null,
    destinationKind: context.destinationKind || null,
    requestedKg: roundedGrains(request, 9),
    depositedToBedKg: roundedGrains(depositedKg, 9),
    exportedKg: roundedGrains(exportedKg, 9),
    totalExportedKg: round(sumGrains(exportedKg), 9),
    controls: {
      residenceDays: round(residenceDays, 9),
      slope: round(slope, 12),
      dischargeM3s: round(dischargeM3s, 9),
      competence: round(competence, 9)
    },
    residualKg,
    truth: {
      senderDebited: true,
      grainSelectiveDeposition: true,
      conservationClosed: Object.values(residualKg).every(value =>
        Math.abs(value) < 1e-7),
      resolvedChannelMorphodynamics: false
    }
  });
  state.lastRouteReceipt = receipt;
  return { state, exportedKg, depositedKg, receipt: clone(receipt) };
}

export function creditRiverSediment(source, grainsKg, context = {}) {
  return applyRunoffSedimentInput(source, grainsKg, context);
}

export function sedimentGrainTotal(source = {}) {
  return sumGrains(source);
}

export function geomorphicSedimentDescription() {
  return {
    surfaceStateSchema: SURFACE_SEDIMENT_STATE_SCHEMA,
    runoffQueueSchema: RUNOFF_SEDIMENT_QUEUE_SCHEMA,
    surfaceErosionReceiptSchema: SURFACE_EROSION_RECEIPT_SCHEMA,
    runoffTransferReceiptSchema: RUNOFF_SEDIMENT_TRANSFER_SCHEMA,
    riverStateSchema: RIVER_SEDIMENT_STATE_SCHEMA,
    riverInputReceiptSchema: RIVER_SEDIMENT_INPUT_SCHEMA,
    riverRouteReceiptSchema: RIVER_SEDIMENT_ROUTE_SCHEMA,
    coastalStateSchema: COASTAL_SEDIMENT_STATE_SCHEMA,
    coastalInputReceiptSchema: COASTAL_SEDIMENT_INPUT_SCHEMA,
    grains: SEDIMENT_GRAINS.map(grain => ({ ...grain })),
    processes: [
      'finite-parameterized-surface-erosion',
      'persistent-runoff-sediment-queue',
      'same-water-fraction-loaded-neighbor-transfer',
      'persistent-river-suspended-and-bed-storage',
      'grain-selective-reach-and-coastal-deposition'
    ],
    truth: {
      finiteMineralOwnership: true,
      massConservationReceipted: true,
      scientificErosionModel: false,
      mechanisticSoilFormation: false,
      resolvedChannelMorphodynamics: false,
      resolvedCoastalMorphodynamics: false,
      globalSedimentNetwork: false
    }
  };
}
