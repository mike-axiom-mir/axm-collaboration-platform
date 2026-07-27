export const SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.soil-biogeochemistry-state/v1';
export const RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA =
  'axm.foundation-planet.runoff-biogeochemistry-queue/v1';
export const SOIL_RUNOFF_MOBILIZATION_SCHEMA =
  'axm.foundation-planet.soil-runoff-mobilization-receipt/v1';
export const RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA =
  'axm.foundation-planet.runoff-biogeochemistry-transfer-receipt/v1';

export const RUNOFF_BIOGEOCHEMISTRY_POOLS = Object.freeze([
  Object.freeze({
    id: 'dissolvedInorganicCarbonKgCm2',
    absoluteId: 'dissolvedInorganicCarbonKgC',
    element: 'carbon'
  }),
  Object.freeze({
    id: 'dissolvedOrganicCarbonKgCm2',
    absoluteId: 'dissolvedOrganicCarbonKgC',
    element: 'carbon'
  }),
  Object.freeze({
    id: 'dissolvedInorganicNitrogenKgNm2',
    absoluteId: 'dissolvedInorganicNitrogenKgN',
    element: 'nitrogen'
  }),
  Object.freeze({
    id: 'dissolvedInorganicPhosphorusKgPm2',
    absoluteId: 'dissolvedInorganicPhosphorusKgP',
    element: 'phosphorus'
  }),
  Object.freeze({
    id: 'dissolvedOxygenKgO2m2',
    absoluteId: 'dissolvedOxygenKgO2',
    element: 'oxygen'
  })
]);

const ELEMENTS = Object.freeze(['carbon', 'nitrogen', 'phosphorus', 'oxygen']);
const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

function emptyPools() {
  return Object.fromEntries(RUNOFF_BIOGEOCHEMISTRY_POOLS.map(pool =>
    [pool.id, 0]));
}

function normalizePools(source = {}) {
  return Object.fromEntries(RUNOFF_BIOGEOCHEMISTRY_POOLS.map(pool =>
    [pool.id, Math.max(0, finite(source?.[pool.id]))]));
}

function emptyElements() {
  return { carbon: 0, nitrogen: 0, phosphorus: 0, oxygen: 0 };
}

function elementUnits(elements, suffix = 'm2') {
  return {
    carbonKgC: round(elements.carbon),
    nitrogenKgN: round(elements.nitrogen),
    phosphorusKgP: round(elements.phosphorus),
    oxygenKgO2: round(elements.oxygen),
    basis: suffix
  };
}

export function runoffBiogeochemistryPoolElements(source = {}) {
  const pools = source?.pools || source;
  const totals = emptyElements();
  for (const definition of RUNOFF_BIOGEOCHEMISTRY_POOLS) {
    totals[definition.element] += Math.max(0, finite(pools?.[definition.id]));
  }
  return totals;
}

export function runoffBiogeochemistryAbsolutePools(source, areaM2 = 1,
  fraction = 1) {
  const pools = source?.pools || source;
  const area = Math.max(0, finite(areaM2));
  const bounded = clamp(finite(fraction));
  return Object.fromEntries(RUNOFF_BIOGEOCHEMISTRY_POOLS.map(definition => [
    definition.absoluteId,
    Math.max(0, finite(pools?.[definition.id])) * area * bounded
  ]));
}

export function runoffBiogeochemistryAbsoluteElements(source = {}) {
  const totals = emptyElements();
  for (const definition of RUNOFF_BIOGEOCHEMISTRY_POOLS) {
    totals[definition.element] += Math.max(0,
      finite(source?.[definition.absoluteId]));
  }
  return totals;
}

function canonicalConcentrations(sample = {}, substrate = {}, ecology = {},
  temperatureC = 15) {
  const litterSignal = clamp(finite(ecology?.carbon?.litterKgCm2) / .8);
  const mineralSignal = clamp(finite(ecology?.nitrogen?.mineralKgNm2) / .01);
  const moistureSignal = clamp(finite(sample?.moisture, .5));
  const weatheringSignal = clamp(.35 + finite(substrate?.weatheringRate, .4),
    .25, 1.4);
  const oxygenSolubility = clamp(1.08 - Math.max(0,
    finite(temperatureC, 15)) * .012, .52, 1.12);
  return {
    dissolvedInorganicCarbonKgM3: .008 + .006 * weatheringSignal,
    dissolvedOrganicCarbonKgM3: (.0025 + .008 * litterSignal) *
      (.6 + moistureSignal * .4),
    dissolvedInorganicNitrogenKgM3: .00025 + .00155 * mineralSignal,
    dissolvedInorganicPhosphorusKgM3: .000035 + .000085 * weatheringSignal,
    dissolvedOxygenKgM3: .0086 * oxygenSolubility
  };
}

function poolsFromConcentrations(concentrations, accessibleWaterMm) {
  const waterM3m2 = Math.max(0, finite(accessibleWaterMm)) / 1000;
  return {
    dissolvedInorganicCarbonKgCm2: waterM3m2 *
      finite(concentrations.dissolvedInorganicCarbonKgM3),
    dissolvedOrganicCarbonKgCm2: waterM3m2 *
      finite(concentrations.dissolvedOrganicCarbonKgM3),
    dissolvedInorganicNitrogenKgNm2: waterM3m2 *
      finite(concentrations.dissolvedInorganicNitrogenKgM3),
    dissolvedInorganicPhosphorusKgPm2: waterM3m2 *
      finite(concentrations.dissolvedInorganicPhosphorusKgM3),
    dissolvedOxygenKgO2m2: waterM3m2 *
      finite(concentrations.dissolvedOxygenKgM3)
  };
}

function stateTruth() {
  return {
    persistentDissolvedSoilWaterReservoirs: true,
    finiteRunoffDonorPools: true,
    runoffMobilizationWaterCoupled: true,
    carbonNitrogenPhosphorusOxygenTracked: true,
    mechanisticSoilChemistry: false,
    resolvedSoilPoreNetwork: false
  };
}

export function createSoilBiogeochemistry(sample = {}, substrate = {},
  ecology = {}, options = {}) {
  const accessibleWaterMm = clamp(finite(options.accessibleWaterMm), 5, 1000);
  const concentrations = canonicalConcentrations(sample, substrate, ecology,
    finite(options.temperatureC, sample?.temperatureC));
  return {
    schema: SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA,
    migrationCheckpoint: false,
    initialization: {
      status: 'canonical-initial-condition',
      accessibleWaterMm: round(accessibleWaterMm, 9),
      concentrationsKgM3: Object.fromEntries(Object.entries(concentrations)
        .map(([key, value]) => [key, round(value, 12)]))
    },
    pools: poolsFromConcentrations(concentrations, accessibleWaterMm),
    cumulativeMobilized: emptyElements(),
    lastMobilizationReceipt: null,
    truth: stateTruth()
  };
}

export function emptyMigratedSoilBiogeochemistry() {
  return {
    schema: SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA,
    migrationCheckpoint: true,
    initialization: {
      status: 'migration-empty-checkpoint',
      accessibleWaterMm: 0,
      concentrationsKgM3: {}
    },
    pools: emptyPools(),
    cumulativeMobilized: emptyElements(),
    lastMobilizationReceipt: null,
    truth: stateTruth()
  };
}

export function normalizeSoilBiogeochemistry(source) {
  if (source?.schema !== SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA) {
    return emptyMigratedSoilBiogeochemistry();
  }
  const state = clone(source);
  state.migrationCheckpoint = state.migrationCheckpoint === true;
  state.initialization = {
    status: String(state.initialization?.status || 'normalized'),
    accessibleWaterMm: Math.max(0,
      finite(state.initialization?.accessibleWaterMm)),
    concentrationsKgM3: Object.fromEntries(Object.entries(
      state.initialization?.concentrationsKgM3 || {}).filter(([, value]) =>
        Number.isFinite(Number(value))).map(([key, value]) =>
          [key, Math.max(0, Number(value))]))
  };
  state.pools = normalizePools(state.pools);
  state.cumulativeMobilized = Object.fromEntries(ELEMENTS.map(element =>
    [element, Math.max(0, finite(state.cumulativeMobilized?.[element]))]));
  state.lastMobilizationReceipt = state.lastMobilizationReceipt?.schema ===
    SOIL_RUNOFF_MOBILIZATION_SCHEMA ? clone(state.lastMobilizationReceipt) : null;
  state.truth = stateTruth();
  return state;
}

export function emptyRunoffBiogeochemistryQueue() {
  return {
    schema: RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA,
    pools: emptyPools(),
    lastTransferReceipt: null,
    truth: {
      persistentWithRunoffWaterQueue: true,
      finiteMaterialQueue: true,
      exactSenderDebitRequired: true
    }
  };
}

export function normalizeRunoffBiogeochemistryQueue(source) {
  const queue = emptyRunoffBiogeochemistryQueue();
  if (source?.schema !== RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA) return queue;
  queue.pools = normalizePools(source.pools);
  queue.lastTransferReceipt = source.lastTransferReceipt?.schema ===
    RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA
    ? clone(source.lastTransferReceipt) : null;
  return queue;
}

function poolResiduals(initialSoil, initialQueue, finalSoil, finalQueue,
  boundary = emptyPools()) {
  return Object.fromEntries(RUNOFF_BIOGEOCHEMISTRY_POOLS.map(definition => [
    definition.id.replace(/m2$/, 'ResidualM2'),
    round(finite(finalSoil[definition.id]) + finite(finalQueue[definition.id]) -
      finite(initialSoil[definition.id]) - finite(initialQueue[definition.id]) -
      finite(boundary[definition.id]), 15)
  ]));
}

export function mobilizeSoilBiogeochemistry(source, queueSource,
  generatedRunoffMm, context = {}) {
  const initialState = normalizeSoilBiogeochemistry(source);
  const initialQueue = normalizeRunoffBiogeochemistryQueue(queueSource);
  const initialSoilPools = clone(initialState.pools);
  const initialQueuePools = clone(initialQueue.pools);
  const runoffMm = Math.max(0, finite(generatedRunoffMm));
  if (initialState.migrationCheckpoint) {
    const seeded = createSoilBiogeochemistry(context.sample,
      context.substrate, context.ecology, {
        accessibleWaterMm: context.accessibleWaterMm,
        temperatureC: context.temperatureC
      });
    const boundary = clone(seeded.pools);
    const receipt = {
      schema: SOIL_RUNOFF_MOBILIZATION_SCHEMA,
      status: 'initialized-after-migration-no-export',
      generatedRunoffMm: round(runoffMm, 9),
      accessibleSoilWaterMm: round(Math.max(0,
        finite(context.accessibleWaterMm)), 9),
      mobilizedFraction: 0,
      initialConditionBoundaryPools: clone(boundary),
      mobilizedPools: emptyPools(),
      conservation: poolResiduals(initialSoilPools, initialQueuePools,
        seeded.pools, initialQueue.pools, boundary),
      truth: {
        persistentSoilDonorDebited: false,
        persistentRunoffQueueCredited: false,
        initializationBoundary: true,
        migrationInventedHistoricalExport: false,
        donorAvailabilityBounded: true
      }
    };
    seeded.lastMobilizationReceipt = receipt;
    return { state: seeded, queue: initialQueue, receipt: clone(receipt) };
  }
  const state = initialState;
  const queue = initialQueue;
  const accessibleWaterMm = Math.max(0, finite(context.accessibleWaterMm));
  const mobilizedFraction = runoffMm > 0
    ? clamp(runoffMm / Math.max(1e-9, accessibleWaterMm + runoffMm), 0, .35)
    : 0;
  const mobilizedPools = emptyPools();
  for (const definition of RUNOFF_BIOGEOCHEMISTRY_POOLS) {
    const amount = Math.min(state.pools[definition.id],
      state.pools[definition.id] * mobilizedFraction);
    state.pools[definition.id] -= amount;
    queue.pools[definition.id] += amount;
    mobilizedPools[definition.id] = amount;
  }
  const mobilizedElements = runoffBiogeochemistryPoolElements(mobilizedPools);
  for (const element of ELEMENTS) {
    state.cumulativeMobilized[element] += mobilizedElements[element];
  }
  const receipt = {
    schema: SOIL_RUNOFF_MOBILIZATION_SCHEMA,
    status: runoffMm > 0 && mobilizedFraction > 0
      ? 'mobilized-persistent-soil-water-chemistry'
      : 'no-runoff-no-export',
    generatedRunoffMm: round(runoffMm, 9),
    accessibleSoilWaterMm: round(accessibleWaterMm, 9),
    mobilizedFraction: round(mobilizedFraction, 12),
    initialConditionBoundaryPools: emptyPools(),
    mobilizedPools: Object.fromEntries(Object.entries(mobilizedPools)
      .map(([key, value]) => [key, round(value, 15)])),
    mobilizedElements: elementUnits(mobilizedElements),
    conservation: poolResiduals(initialSoilPools, initialQueuePools,
      state.pools, queue.pools),
    truth: {
      persistentSoilDonorDebited: true,
      persistentRunoffQueueCredited: true,
      initializationBoundary: false,
      migrationInventedHistoricalExport: false,
      donorAvailabilityBounded: RUNOFF_BIOGEOCHEMISTRY_POOLS.every(definition =>
        mobilizedPools[definition.id] <= initialSoilPools[definition.id] + 1e-15)
    }
  };
  state.lastMobilizationReceipt = receipt;
  return { state, queue, receipt: clone(receipt) };
}

export function debitRunoffBiogeochemistryQueue(source, fraction, areaM2,
  context = {}) {
  const queue = normalizeRunoffBiogeochemistryQueue(source);
  const bounded = clamp(finite(fraction));
  const area = Math.max(1, finite(areaM2, 1));
  const initialPools = clone(queue.pools);
  const debits = runoffBiogeochemistryAbsolutePools(queue, area, bounded);
  for (const definition of RUNOFF_BIOGEOCHEMISTRY_POOLS) {
    queue.pools[definition.id] = Math.max(0,
      queue.pools[definition.id] -
      debits[definition.absoluteId] / area);
  }
  const receipt = {
    schema: RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA,
    transferId: String(context.transferId || 'unbound-transfer'),
    status: bounded > 0 ? 'sender-debited' : 'no-transfer',
    sourceCellId: context.sourceCellId || null,
    destinationId: context.destinationId || null,
    destinationKind: context.destinationKind || null,
    waterFraction: round(bounded, 12),
    sourceAreaM2: round(area, 3),
    debitedPoolsKg: Object.fromEntries(Object.entries(debits)
      .map(([key, value]) => [key, round(value, 12)])),
    debitedElementsKg: elementUnits(
      runoffBiogeochemistryAbsoluteElements(debits), 'absolute'),
    conservation: Object.fromEntries(RUNOFF_BIOGEOCHEMISTRY_POOLS.map(
      definition => [
        definition.absoluteId.replace(/Kg([A-Z0-9]+)?$/, 'ResidualKg$1'),
        round((initialPools[definition.id] - queue.pools[definition.id]) *
          area - debits[definition.absoluteId], 12)
      ])),
    truth: {
      persistentQueueSenderDebited: true,
      sameFractionAsRunoffWater: true,
      donorAvailabilityBounded: RUNOFF_BIOGEOCHEMISTRY_POOLS.every(definition =>
        debits[definition.absoluteId] <= initialPools[definition.id] * area +
          1e-9)
    }
  };
  queue.lastTransferReceipt = receipt;
  return { queue, poolsKg: debits, receipt: clone(receipt) };
}

export function creditRunoffBiogeochemistryQueue(source, poolsKg, areaM2,
  context = {}) {
  const queue = normalizeRunoffBiogeochemistryQueue(source);
  const area = Math.max(1, finite(areaM2, 1));
  const initialPools = clone(queue.pools);
  for (const definition of RUNOFF_BIOGEOCHEMISTRY_POOLS) {
    queue.pools[definition.id] += Math.max(0,
      finite(poolsKg?.[definition.absoluteId])) / area;
  }
  const credited = runoffBiogeochemistryAbsolutePools({
    pools: Object.fromEntries(RUNOFF_BIOGEOCHEMISTRY_POOLS.map(definition => [
      definition.id,
      queue.pools[definition.id] - initialPools[definition.id]
    ]))
  }, area);
  const receipt = {
    schema: RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA,
    transferId: String(context.transferId || 'unbound-transfer'),
    status: 'receiver-credited',
    sourceCellId: context.sourceCellId || null,
    destinationId: context.destinationId || null,
    destinationKind: 'land',
    waterFraction: round(clamp(finite(context.waterFraction)), 12),
    receivingAreaM2: round(area, 3),
    creditedPoolsKg: Object.fromEntries(Object.entries(credited)
      .map(([key, value]) => [key, round(value, 12)])),
    conservation: Object.fromEntries(RUNOFF_BIOGEOCHEMISTRY_POOLS.map(
      definition => [
        definition.absoluteId.replace(/Kg([A-Z0-9]+)?$/, 'ResidualKg$1'),
        round(credited[definition.absoluteId] -
          Math.max(0, finite(poolsKg?.[definition.absoluteId])), 12)
      ])),
    truth: {
      persistentQueueReceiverCredited: true,
      exactPairedTransferId: Boolean(context.transferId),
      areaWeighted: true
    }
  };
  queue.lastTransferReceipt = receipt;
  return { queue, receipt: clone(receipt) };
}

export function soilBiogeochemistryDescription() {
  return {
    stateSchema: SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA,
    queueSchema: RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA,
    mobilizationReceiptSchema: SOIL_RUNOFF_MOBILIZATION_SCHEMA,
    transferReceiptSchema: RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA,
    pools: RUNOFF_BIOGEOCHEMISTRY_POOLS.map(definition => ({ ...definition })),
    processes: [
      'canonical-soil-water-initial-condition',
      'runoff-fraction-bounded-dissolved-material-mobilization',
      'persistent-runoff-chemistry-queue',
      'paired-area-weighted-sender-debit-and-receiver-credit'
    ],
    sideEffects: ['soil-biogeochemistry-state', 'runoff-biogeochemistry-queue'],
    persistentFiniteDonors: true,
    mechanisticSoilChemistry: false,
    resolvedSoilPoreNetwork: false
  };
}
