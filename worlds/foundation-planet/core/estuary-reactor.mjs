import {
  RIVER_CHEMISTRY_POOLS,
  chemistryElementInputs
} from './river-chemistry.mjs';

export const ESTUARY_STATE_SCHEMA = 'axm.foundation-planet.estuary-state/v1';
export const ESTUARY_FLUX_RECEIPT_SCHEMA = 'axm.foundation-planet.estuary-flux-receipt/v1';

const OXYGEN_KG_PER_RESPIRATED_KG_C = 32 / 12;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

function chemistryPools(source = {}) {
  return Object.fromEntries(RIVER_CHEMISTRY_POOLS.map(pool => [
    pool,
    Math.max(0, finite(source[pool]))
  ]));
}

export function emptyEstuaryState() {
  return {
    schema: ESTUARY_STATE_SCHEMA,
    sedimentOrganicCarbonKgC: 0,
    sedimentNitrogenKgN: 0,
    sedimentPhosphorusKgP: 0,
    cumulativeDenitrifiedNitrogenKgN: 0,
    cumulativeOxygenConsumptionKgO2: 0,
    cumulativeProcessedWaterKg: 0,
    migrationCheckpoint: false,
    lastFluxReceipt: null
  };
}

export function normalizeEstuaryState(source) {
  const state = emptyEstuaryState();
  if (!source || source.schema !== ESTUARY_STATE_SCHEMA) return state;
  for (const key of [
    'sedimentOrganicCarbonKgC',
    'sedimentNitrogenKgN',
    'sedimentPhosphorusKgP',
    'cumulativeDenitrifiedNitrogenKgN',
    'cumulativeOxygenConsumptionKgO2',
    'cumulativeProcessedWaterKg'
  ]) state[key] = Math.max(0, finite(source[key]));
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  state.lastFluxReceipt = source.lastFluxReceipt?.schema === ESTUARY_FLUX_RECEIPT_SCHEMA
    ? clone(source.lastFluxReceipt) : null;
  return state;
}

export function estuaryStorageTotals(source) {
  const state = normalizeEstuaryState(source);
  return {
    carbonKgC: state.sedimentOrganicCarbonKgC,
    nitrogenKgN: state.sedimentNitrogenKgN,
    phosphorusKgP: state.sedimentPhosphorusKgP,
    oxygenKgO2: 0
  };
}

export function processEstuaryInflow(sourceState, incomingChemistry, context = {}) {
  const state = normalizeEstuaryState(sourceState);
  const incoming = chemistryPools(incomingChemistry);
  const waterKg = Math.max(0, finite(context.waterKg));
  const waterM3 = waterKg / 1000;
  const residenceDays = clamp(finite(context.residenceDays, .8), .04, 12);
  const temperatureC = clamp(finite(context.temperatureC, 15), -2, 38);
  const temperatureFactor = clamp(2 ** ((temperatureC - 20) / 10), .25, 3.4);
  const reactionExposure = clamp(1 - Math.exp(-.42 * residenceDays * temperatureFactor));
  const oxygenCapacityKg = waterM3 * .0092;
  const initialOxygenSaturation = oxygenCapacityKg > 0
    ? clamp(incoming.dissolvedOxygenKgO2 / oxygenCapacityKg, 0, 1.35)
    : 0;

  const potentialRespiredCarbonKgC = incoming.dissolvedOrganicCarbonKgC *
    (.08 + .28 * reactionExposure);
  const respiredOrganicCarbonKgC = Math.min(
    potentialRespiredCarbonKgC,
    incoming.dissolvedOxygenKgO2 / OXYGEN_KG_PER_RESPIRATED_KG_C
  );
  const oxygenConsumedKgO2 = respiredOrganicCarbonKgC * OXYGEN_KG_PER_RESPIRATED_KG_C;
  const organicAfterRespiration = Math.max(0,
    incoming.dissolvedOrganicCarbonKgC - respiredOrganicCarbonKgC);
  const buriedOrganicCarbonKgC = organicAfterRespiration * .055 * reactionExposure;
  const buriedNitrogenKgN = incoming.dissolvedInorganicNitrogenKgN * .11 * reactionExposure;
  const buriedPhosphorusKgP = incoming.dissolvedInorganicPhosphorusKgP * .24 * reactionExposure;
  const oxygenAfterRespiration = Math.max(0,
    incoming.dissolvedOxygenKgO2 - oxygenConsumedKgO2);
  const postReactionOxygenSaturation = oxygenCapacityKg > 0
    ? clamp(oxygenAfterRespiration / oxygenCapacityKg, 0, 1.35)
    : 0;
  const anoxiaSignal = clamp(1 - postReactionOxygenSaturation);
  const nitrogenAfterBurial = Math.max(0,
    incoming.dissolvedInorganicNitrogenKgN - buriedNitrogenKgN);
  const denitrifiedNitrogenKgN = nitrogenAfterBurial * .12 * reactionExposure *
    (.12 + .88 * anoxiaSignal);

  const transmitted = {
    dissolvedInorganicCarbonKgC: incoming.dissolvedInorganicCarbonKgC +
      respiredOrganicCarbonKgC,
    dissolvedOrganicCarbonKgC: Math.max(0, organicAfterRespiration - buriedOrganicCarbonKgC),
    dissolvedInorganicNitrogenKgN: Math.max(0,
      nitrogenAfterBurial - denitrifiedNitrogenKgN),
    dissolvedInorganicPhosphorusKgP: Math.max(0,
      incoming.dissolvedInorganicPhosphorusKgP - buriedPhosphorusKgP),
    dissolvedOxygenKgO2: oxygenAfterRespiration
  };
  state.sedimentOrganicCarbonKgC += buriedOrganicCarbonKgC;
  state.sedimentNitrogenKgN += buriedNitrogenKgN;
  state.sedimentPhosphorusKgP += buriedPhosphorusKgP;
  state.cumulativeDenitrifiedNitrogenKgN += denitrifiedNitrogenKgN;
  state.cumulativeOxygenConsumptionKgO2 += oxygenConsumedKgO2;
  state.cumulativeProcessedWaterKg += waterKg;

  const inputs = chemistryElementInputs(incoming);
  const outputs = chemistryElementInputs(transmitted);
  const receipt = {
    schema: ESTUARY_FLUX_RECEIPT_SCHEMA,
    status: waterKg > 0 ? 'processed-and-transmitted' : 'dry-no-op',
    waterKg: round(waterKg, 3),
    residenceDays: round(residenceDays, 6),
    temperatureC: round(temperatureC, 6),
    reactionExposure: round(reactionExposure, 9),
    initialOxygenSaturation: round(initialOxygenSaturation, 9),
    postReactionOxygenSaturation: round(postReactionOxygenSaturation, 9),
    incomingPools: Object.fromEntries(Object.entries(incoming)
      .map(([key, value]) => [key, round(value, 9)])),
    transmittedPools: Object.fromEntries(Object.entries(transmitted)
      .map(([key, value]) => [key, round(value, 9)])),
    transformations: {
      respiredOrganicCarbonKgC: round(respiredOrganicCarbonKgC, 9),
      oxygenConsumedKgO2: round(oxygenConsumedKgO2, 9),
      buriedOrganicCarbonKgC: round(buriedOrganicCarbonKgC, 9),
      buriedNitrogenKgN: round(buriedNitrogenKgN, 9),
      buriedPhosphorusKgP: round(buriedPhosphorusKgP, 9),
      denitrifiedNitrogenKgN: round(denitrifiedNitrogenKgN, 9)
    },
    conservation: {
      carbonResidualKgC: round(inputs.carbonKgC - outputs.carbonKgC -
        buriedOrganicCarbonKgC, 9),
      nitrogenResidualKgN: round(inputs.nitrogenKgN - outputs.nitrogenKgN -
        buriedNitrogenKgN - denitrifiedNitrogenKgN, 9),
      phosphorusResidualKgP: round(inputs.phosphorusKgP - outputs.phosphorusKgP -
        buriedPhosphorusKgP, 9),
      oxygenResidualKgO2: round(inputs.oxygenKgO2 - outputs.oxygenKgO2 -
        oxygenConsumedKgO2, 9)
    },
    truth: {
      persistentEstuarySedimentReservoirs: true,
      oxygenLimitedOrganicCarbonRespiration: true,
      carbonNitrogenPhosphorusRetention: true,
      explicitNitrogenGasBoundary: true,
      dissolvedOutputCreditedToOcean: true,
      resolvedEstuaryHydrodynamics: false,
      explicitAtmosphericGasReceiver: false
    }
  };
  state.lastFluxReceipt = receipt;
  return { state, transmitted, receipt: clone(receipt) };
}

export function estuaryReactorDescription() {
  return {
    stateSchema: ESTUARY_STATE_SCHEMA,
    fluxReceiptSchema: ESTUARY_FLUX_RECEIPT_SCHEMA,
    persistentSedimentReservoirs: true,
    processes: [
      'oxygen-limited-organic-carbon-respiration',
      'carbon-nitrogen-phosphorus-sediment-retention',
      'oxygen-sensitive-denitrification',
      'dissolved-river-to-coastal-ocean-transmission'
    ],
    explicitNitrogenGasBoundary: true,
    explicitAtmosphericGasReceiver: false,
    resolvedEstuaryHydrodynamics: false
  };
}
