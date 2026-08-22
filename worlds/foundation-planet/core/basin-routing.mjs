import { HYDROLOGY_SCHEMA } from './hydrology-model.mjs';
import { EARTH_SYSTEM_COLUMN_SCHEMA, earthCellIdentity } from './earth-system.mjs?v=0.63.0-r63.1';
import { earthCellAreaM2 } from './earth-transport.mjs?v=0.63.0-r63.1';
import {
  applyRiverBiogeochemistryInput,
  oceanEcologyElementTotals
} from './ocean-ecology.mjs';
import {
  addRiverChemistry,
  chemistryElementInputs,
  emptyRiverChemistry,
  normalizeRiverChemistry,
  riverNitrogenSpecies,
  riverChemistryDescription,
  riverChemistryFraction,
  riverChemistryTotals,
  applyRunoffBiogeochemistryInput,
  subtractRiverChemistry
} from './river-chemistry.mjs';
import {
  debitRunoffBiogeochemistryQueue,
  runoffBiogeochemistryAbsoluteElements,
  runoffBiogeochemistryAbsolutePools
} from './soil-biogeochemistry.mjs';
import {
  emptyEstuaryState,
  estuaryReactorDescription,
  estuaryStorageTotals,
  normalizeEstuaryState,
  processEstuaryInflow
} from './estuary-reactor.mjs';
import {
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
  ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA,
  applyAtmosphereFloodplainGasExchange,
  applyAtmosphereGasBoundaryInput,
  normalizeAtmosphereBiogeochemistry,
  synchronizeAtmosphereCompatibilityMirrors
} from './atmosphere-biogeochemistry.mjs?v=0.62.0-r62.1';
import {
  debitRunoffSedimentQueue,
  runoffSedimentAbsoluteGrains,
  emptyRiverSediment,
  normalizeRiverSediment,
  riverSedimentTotals,
  riverSedimentTransportLoad,
  applyRunoffSedimentInput,
  routeRiverSedimentLoad,
  creditRiverSediment,
  creditCoastalSediment,
  normalizeCoastalSediment,
  sedimentGrainTotal,
  geomorphicSedimentDescription
} from './geomorphic-sediment.mjs?v=0.63.0-r63.1';
import {
  FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
  FLOODPLAIN_EXCHANGE_MASS_CLOSURE_SCHEMA,
  FLOODPLAIN_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
  FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG,
  FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
  FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
  FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
  FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
  FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
  FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
  FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA,
  FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
  FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
  FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA,
  FLOODPLAIN_STATE_SCHEMA,
  applyFloodplainDetritalReturn,
  applyFloodplainAerobicMineralization,
  applyFloodplainDenitrificationReaction,
  applyFloodplainNitrificationReaction,
  applyFloodplainGasExchange,
  applyFloodplainPlantResourceExchange,
  advanceFloodplainExchange,
  emptyFloodplainState,
  floodplainDescription,
  floodplainPlantResourceCapacity,
  floodplainTotals,
  normalizeFloodplainState
} from './floodplain.mjs?v=0.65.0-r65.1';
import {
  FLOODPLAIN_THERMAL_STATE_SCHEMA,
  FLOODPLAIN_THERMAL_RECEIPT_SCHEMA,
  FLOODPLAIN_THERMAL_ENERGY_CLOSURE_SCHEMA,
  FLOODPLAIN_THERMAL_ENERGY_CLOSURE_POLICY_SCHEMA,
  advanceFloodplainThermal,
  emptyFloodplainThermalState,
  floodplainThermalDescription,
  floodplainThermalSummary,
  normalizeFloodplainThermalState
} from './floodplain-thermal.mjs?v=0.66.0-r66.2';
import {
  FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
  FLOODPLAIN_HABITAT_STATE_SCHEMA,
  FLOODPLAIN_HABITAT_TYPES,
  advanceFloodplainHabitat,
  emptyFloodplainHabitatState,
  floodplainHabitatDescription,
  floodplainHabitatSummary,
  normalizeFloodplainHabitatState
} from './floodplain-habitat.mjs?v=0.61.0-r61.1';
import {
  FLOOD_EVENT_HISTORY_STATE_SCHEMA,
  FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA,
  advanceFloodEventHistory,
  emptyFloodEventHistoryState,
  floodEventHistoryDescription,
  floodEventHistorySummary,
  normalizeFloodEventHistoryState
} from './flood-event-history.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA,
  FLOODPLAIN_SUCCESSION_STATE_SCHEMA,
  advanceFloodplainSuccession,
  emptyFloodplainSuccessionState,
  floodplainSuccessionDescription,
  floodplainSuccessionSummary,
  normalizeFloodplainSuccessionState
} from './floodplain-succession.mjs';
import {
  LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA,
  applyLandEcologySubgridBiomassDebit,
  landEcologyLiveBiomassMass,
  landEcologySubgridDebitCapacity
} from './land-ecology.mjs';
import {
  FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
  FLOODPLAIN_PLANT_MATTER_STATE_SCHEMA,
  FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA,
  applyFloodplainPlantDetritusMatterDebit,
  advanceFloodplainPlantMatter,
  emptyFloodplainPlantMatterState,
  floodplainPlantMatterDemand,
  floodplainPlantMatterDescription,
  floodplainPlantMatterSummary,
  normalizeFloodplainPlantMatterState
} from './floodplain-plant-matter.mjs?v=0.60.0-r60.1';
import {
  FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA,
  FLOODPLAIN_PLANT_RESOURCES_STATE_SCHEMA,
  FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA,
  applyFloodplainPlantDetritusResourceDebit,
  advanceFloodplainPlantResources,
  emptyFloodplainPlantResourcesState,
  floodplainPlantResourceDemandFromMatterDemand,
  floodplainPlantResourcePlan,
  floodplainPlantResourcesDescription,
  floodplainPlantResourcesSummary,
  normalizeFloodplainPlantResourcesState
} from './floodplain-plant-resources.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA,
  FLOODPLAIN_DECOMPOSITION_STATE_SCHEMA,
  advanceFloodplainDecomposition,
  emptyFloodplainDecompositionState,
  floodplainDecompositionDescription,
  floodplainDecompositionPlan,
  floodplainDecompositionSummary,
  normalizeFloodplainDecompositionState
} from './floodplain-decomposition.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA,
  FLOODPLAIN_RESPIRATION_STATE_SCHEMA,
  advanceFloodplainRespiration,
  emptyFloodplainRespirationState,
  floodplainRespirationDescription,
  floodplainRespirationPlan,
  floodplainRespirationSummary,
  normalizeFloodplainRespirationState
} from './floodplain-respiration.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA,
  FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
  advanceFloodplainDenitrification,
  emptyFloodplainDenitrificationState,
  floodplainDenitrificationDescription,
  floodplainDenitrificationPlan,
  floodplainDenitrificationSummary,
  normalizeFloodplainDenitrificationState
} from './floodplain-denitrification.mjs?v=0.62.0-r62.1';
import {
  FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA,
  FLOODPLAIN_NITRIFICATION_STATE_SCHEMA,
  advanceFloodplainNitrification,
  emptyFloodplainNitrificationState,
  floodplainNitrificationDescription,
  floodplainNitrificationPlan,
  floodplainNitrificationSummary,
  normalizeFloodplainNitrificationState
} from './floodplain-nitrification.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
  FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
  advanceFloodplainGasExchange,
  emptyFloodplainGasExchangeState,
  floodplainGasExchangeDescription,
  floodplainGasExchangePlan,
  floodplainGasExchangeSummary,
  normalizeFloodplainGasExchangeState
} from './floodplain-gas-exchange.mjs?v=0.62.0-r62.1';

export const BASIN_ROUTING_ENGINE_SCHEMA = 'axm.foundation-planet.basin-routing-engine/v32';
export const PREVIOUS_BASIN_ROUTING_ENGINE_SCHEMA =
  'axm.foundation-planet.basin-routing-engine/v31';
export const BASIN_ROUTING_STEP_SCHEMA = 'axm.foundation-planet.basin-routing-step/v31';
export const PREVIOUS_BASIN_ROUTING_STEP_SCHEMA =
  'axm.foundation-planet.basin-routing-step/v30';
export const BASIN_AGGREGATE_MASS_CLOSURE_SCHEMA =
  'axm.foundation-planet.basin-aggregate-mass-closure/v1';
export const BASIN_AGGREGATE_MASS_CLOSURE_POLICY_SCHEMA =
  'axm.foundation-planet.basin-aggregate-mass-closure-policy/v1';
export const BASIN_AGGREGATE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG = 1;
export const BASIN_AGGREGATE_MASS_CLOSURE_ULP_FACTOR = 8;
export const BASIN_CLOCK_ALIGNMENT_CHECKPOINT_SCHEMA =
  'axm.foundation-planet.basin-clock-alignment-checkpoint/v1';
export const BASIN_INLET_RECEIPT_SCHEMA = 'axm.foundation-planet.basin-inlet-receipt/v8';
export const RIVER_REACH_TRANSFER_SCHEMA = 'axm.foundation-planet.river-reach-transfer/v7';
export const OCEAN_MOUTH_RECEIPT_SCHEMA = 'axm.foundation-planet.ocean-mouth-receipt/v8';
export const RIVER_BOUNDARY_RECEIPT_SCHEMA = 'axm.foundation-planet.river-boundary-receipt/v1';

const CLOCK_TOLERANCE_DAYS = 1e-6;
const EARTH_RADIUS_M = 6_371_000;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = value => JSON.parse(JSON.stringify(value));
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));

export function basinAggregateMassNumericToleranceKg(
  signedOperandsKg = []
) {
  const absoluteOperandSumKg = signedOperandsKg.reduce((sum, operand) =>
    sum + Math.abs(finite(operand)), 0);
  return round(Math.max(
    BASIN_AGGREGATE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
    absoluteOperandSumKg * Number.EPSILON *
      BASIN_AGGREGATE_MASS_CLOSURE_ULP_FACTOR
  ), 12);
}

function basinAggregateMassClosureIdentity(residualKg, signedOperandsKg) {
  const numericToleranceKg = basinAggregateMassNumericToleranceKg(
    signedOperandsKg);
  return {
    signedOperandsKg: signedOperandsKg.map(Number),
    residualKg: Number(residualKg),
    numericToleranceKg,
    toleranceUtilization: round(Math.abs(Number(residualKg)) /
      numericToleranceKg, 12),
    closed: Math.abs(Number(residualKg)) <= numericToleranceKg
  };
}

function basinAggregateMassClosureReceipt(identityInputs) {
  const identities = Object.fromEntries(Object.entries(identityInputs).map(
    ([identity, input]) => [identity, basinAggregateMassClosureIdentity(
      input.residualKg, input.signedOperandsKg)]));
  const entries = Object.values(identities);
  return {
    schema: BASIN_AGGREGATE_MASS_CLOSURE_SCHEMA,
    policy: {
      schema: BASIN_AGGREGATE_MASS_CLOSURE_POLICY_SCHEMA,
      absoluteFloorKg:
        BASIN_AGGREGATE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
      ulpFactor: BASIN_AGGREGATE_MASS_CLOSURE_ULP_FACTOR,
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

function stableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function transferId(kind, startDay, sourceId, destinationId, amountKg) {
  return `${kind}:${stableDigest({
    startDay: round(startDay, 8), sourceId, destinationId, amountKg: round(amountKg, 3)
  }).slice('fnv1a32:'.length)}`;
}

function reachLengthM(reach) {
  const from = reach.canonicalFrom;
  const to = reach.canonicalTo;
  const lat1 = finite(from?.lat) * Math.PI / 180;
  const lat2 = finite(to?.lat) * Math.PI / 180;
  const deltaLat = lat2 - lat1;
  const deltaLon = (((finite(to?.lon) - finite(from?.lon) + 540) % 360) - 180) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return Math.max(1, 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a))));
}

function reachFloodplainAreaM2(reach) {
  const widthM = clamp(finite(reach?.widthM, 3) * 8, 8, 5000);
  return Math.max(1, reachLengthM(reach) * widthM);
}

function reachDonorCellId(reach, resolutionDeg) {
  const from = reach?.canonicalFrom || {};
  const to = reach?.canonicalTo || {};
  const lat = (finite(from.lat) + finite(to.lat)) / 2;
  const deltaLon = ((finite(to.lon) - finite(from.lon) + 540) % 360) - 180;
  const lon = ((finite(from.lon) + deltaLon / 2 + 540) % 360) - 180;
  return earthCellIdentity(lat, lon, { resolutionDeg }).id;
}

function reachTravelTimeDays(reach) {
  const discharge = Math.max(.001, finite(reach.currentDischargeM3s, finite(reach.dischargeM3s, .001)));
  const slopeBoost = clamp(finite(reach.slope) * 180, 0, 1.8);
  const velocityMps = clamp(.32 + Math.pow(discharge, .18) * .52 + slopeBoost, .25, 4.5);
  return clamp(reachLengthM(reach) / velocityMps / 86_400, .08, 8);
}

function emptyReachState(reachId, day) {
  return {
    reachId,
    storageKg: 0,
    chemistry: emptyRiverChemistry(),
    sediment: emptyRiverSediment(),
    floodplain: emptyFloodplainState(),
    floodplainThermal: emptyFloodplainThermalState(),
    floodplainHabitat: emptyFloodplainHabitatState(),
    floodEvents: emptyFloodEventHistoryState(),
    floodplainSuccession: emptyFloodplainSuccessionState(),
    floodplainPlantMatter: emptyFloodplainPlantMatterState(),
    floodplainPlantResources: emptyFloodplainPlantResourcesState(),
    floodplainDecomposition: emptyFloodplainDecompositionState(),
    floodplainRespiration: emptyFloodplainRespirationState(),
    floodplainDenitrification: emptyFloodplainDenitrificationState(),
    floodplainNitrification: emptyFloodplainNitrificationState(),
    floodplainGasExchange: emptyFloodplainGasExchangeState(),
    estuary: emptyEstuaryState(),
    cumulativeInflowKg: 0,
    cumulativeOutflowKg: 0,
    lastTouchedDay: round(day, 8)
  };
}

function normalizedReachState(source) {
  return {
    reachId: source.reachId,
    storageKg: Math.max(0, finite(source.storageKg)),
    chemistry: normalizeRiverChemistry(source.chemistry),
    sediment: normalizeRiverSediment(source.sediment),
    floodplain: normalizeFloodplainState(source.floodplain),
    floodplainThermal: normalizeFloodplainThermalState(
      source.floodplainThermal, {
        migrationCheckpoint: !source.floodplainThermal
      }),
    floodplainHabitat: normalizeFloodplainHabitatState(
      source.floodplainHabitat),
    floodEvents: normalizeFloodEventHistoryState(source.floodEvents),
    floodplainSuccession: normalizeFloodplainSuccessionState(
      source.floodplainSuccession),
    floodplainPlantMatter: normalizeFloodplainPlantMatterState(
      source.floodplainPlantMatter),
    floodplainPlantResources: normalizeFloodplainPlantResourcesState(
      source.floodplainPlantResources),
    floodplainDecomposition: normalizeFloodplainDecompositionState(
      source.floodplainDecomposition),
    floodplainRespiration: normalizeFloodplainRespirationState(
      source.floodplainRespiration),
    floodplainDenitrification: normalizeFloodplainDenitrificationState(
      source.floodplainDenitrification),
    floodplainNitrification: normalizeFloodplainNitrificationState(
      source.floodplainNitrification),
    floodplainGasExchange: normalizeFloodplainGasExchangeState(
      source.floodplainGasExchange),
    estuary: normalizeEstuaryState(source.estuary),
    cumulativeInflowKg: Math.max(0, finite(source.cumulativeInflowKg)),
    cumulativeOutflowKg: Math.max(0, finite(source.cumulativeOutflowKg)),
    lastTouchedDay: round(finite(source.lastTouchedDay), 8)
  };
}

function profileStorageKg(profile) {
  let total = 0;
  for (const state of profile.reaches.values()) {
    total += state.storageKg + normalizeFloodplainState(
      state.floodplain).waterKg;
  }
  return total;
}

function profileChannelStorageKg(profile) {
  let total = 0;
  for (const state of profile.reaches.values()) total += state.storageKg;
  return total;
}

function profileChemistry(profile) {
  const totals = {
    carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0,
    alkalinityKgCaCO3Eq: 0
  };
  for (const state of profile.reaches.values()) {
    const chemistry = riverChemistryTotals(state.chemistry);
    const floodplain = floodplainTotals(state.floodplain).chemistry;
    for (const key of Object.keys(totals)) {
      totals[key] += chemistry[key] + floodplain[key];
    }
  }
  return totals;
}

function profileNitrogenSpecies(profile) {
  const totals = {
    nitrateNitrogenKgN: 0,
    ammoniumNitrogenKgN: 0,
    dissolvedInorganicNitrogenKgN: 0
  };
  for (const state of profile.reaches.values()) {
    for (const chemistry of [state.chemistry,
      normalizeFloodplainState(state.floodplain).chemistry]) {
      const species = riverNitrogenSpecies(chemistry);
      totals.nitrateNitrogenKgN +=
        species.dissolvedNitrateNitrogenKgN;
      totals.ammoniumNitrogenKgN +=
        species.dissolvedAmmoniumNitrogenKgN;
    }
  }
  totals.dissolvedInorganicNitrogenKgN =
    totals.nitrateNitrogenKgN + totals.ammoniumNitrogenKgN;
  return totals;
}

function emptySedimentTotals() {
  return { clayKg: 0, siltKg: 0, sandKg: 0, gravelKg: 0,
    suspendedKg: 0, bedDepositKg: 0, totalKg: 0 };
}

function profileSediment(profile) {
  const totals = emptySedimentTotals();
  for (const state of profile.reaches.values()) {
    const sediment = riverSedimentTotals(state.sediment);
    const floodplain = floodplainTotals(state.floodplain);
    for (const grain of ['clay', 'silt', 'sand', 'gravel']) {
      totals[`${grain}Kg`] += sediment.suspendedKg[grain] +
        sediment.bedDepositKg[grain] +
        floodplain.suspendedSedimentKg[grain] +
        floodplain.depositedSedimentKg[grain];
    }
    totals.suspendedKg += sedimentGrainTotal(sediment.suspendedKg);
    totals.bedDepositKg += sedimentGrainTotal(sediment.bedDepositKg);
    totals.totalKg += sediment.totalKg + floodplain.totalSedimentKg;
  }
  return totals;
}

function profileFloodplain(profile) {
  const totals = {
    reachCount: 0,
    activeReachCount: 0,
    waterKg: 0,
    chemistry: { carbonKgC: 0, nitrogenKgN: 0,
      phosphorusKgP: 0, oxygenKgO2: 0, alkalinityKgCaCO3Eq: 0 },
    suspendedSedimentKg: { clay: 0, silt: 0, sand: 0, gravel: 0 },
    depositedSedimentKg: { clay: 0, silt: 0, sand: 0, gravel: 0 },
    totalSedimentKg: 0
  };
  for (const state of profile.reaches.values()) {
    const floodplain = floodplainTotals(state.floodplain);
    totals.reachCount += 1;
    if (floodplain.waterKg > 0 || floodplain.totalSedimentKg > 0) {
      totals.activeReachCount += 1;
    }
    totals.waterKg += floodplain.waterKg;
    totals.totalSedimentKg += floodplain.totalSedimentKg;
    for (const key of Object.keys(totals.chemistry)) {
      totals.chemistry[key] += floodplain.chemistry[key];
    }
    for (const grain of ['clay', 'silt', 'sand', 'gravel']) {
      totals.suspendedSedimentKg[grain] +=
        floodplain.suspendedSedimentKg[grain];
      totals.depositedSedimentKg[grain] +=
        floodplain.depositedSedimentKg[grain];
    }
  }
  return totals;
}

function profileFloodplainThermal(profile) {
  const totals = {
    reachCount: 0,
    observedReachCount: 0,
    wetReachCount: 0,
    migrationCheckpointReachCount: 0,
    trackedWaterKg: 0,
    sensibleHeatJ: 0,
    observedThermalDays: 0,
    dryDays: 0,
    cumulativeNetAdvectedHeatJ: 0,
    cumulativeBoundaryHeatJ: 0,
    waterWeightedTemperatureC: 0,
    maximumEnergyResidualJ: 0,
    maximumEnergyToleranceJ: 0,
    maximumEnergyToleranceUtilization: 0
  };
  for (const reach of [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)))) {
    const thermal = floodplainThermalSummary(reach.floodplainThermal);
    totals.reachCount += 1;
    totals.observedReachCount += thermal.observedThermalDays > 0 ? 1 : 0;
    totals.wetReachCount += thermal.trackedWaterKg > 1e-12 ? 1 : 0;
    totals.migrationCheckpointReachCount +=
      thermal.migrationCheckpoint ? 1 : 0;
    totals.trackedWaterKg += thermal.trackedWaterKg;
    totals.sensibleHeatJ += thermal.sensibleHeatJ;
    totals.observedThermalDays += thermal.observedThermalDays;
    totals.dryDays += thermal.dryDays;
    totals.cumulativeNetAdvectedHeatJ +=
      thermal.cumulativeNetAdvectedHeatJ;
    totals.cumulativeBoundaryHeatJ += thermal.cumulativeBoundaryHeatJ;
    totals.waterWeightedTemperatureC +=
      thermal.waterTemperatureC * thermal.trackedWaterKg;
    totals.maximumEnergyResidualJ = Math.max(
      totals.maximumEnergyResidualJ,
      Math.abs(finite(thermal.lastEnergyResidualJ)));
    totals.maximumEnergyToleranceJ = Math.max(
      totals.maximumEnergyToleranceJ,
      Math.max(0, finite(thermal.lastEnergyToleranceJ)));
    totals.maximumEnergyToleranceUtilization = Math.max(
      totals.maximumEnergyToleranceUtilization,
      Math.max(0, finite(thermal.lastEnergyToleranceUtilization)));
  }
  return {
    reachCount: totals.reachCount,
    observedReachCount: totals.observedReachCount,
    wetReachCount: totals.wetReachCount,
    migrationCheckpointReachCount:
      totals.migrationCheckpointReachCount,
    trackedWaterKg: round(totals.trackedWaterKg, 6),
    sensibleHeatJ: round(totals.sensibleHeatJ, 3),
    observedThermalDays: round(totals.observedThermalDays, 8),
    dryDays: round(totals.dryDays, 8),
    cumulativeNetAdvectedHeatJ: round(
      totals.cumulativeNetAdvectedHeatJ, 3),
    cumulativeBoundaryHeatJ: round(totals.cumulativeBoundaryHeatJ, 3),
    meanWaterTemperatureC: round(totals.trackedWaterKg > 1e-12
      ? totals.waterWeightedTemperatureC / totals.trackedWaterKg : 0, 9),
    maximumEnergyResidualJ: Number(totals.maximumEnergyResidualJ),
    maximumEnergyToleranceJ: Number(totals.maximumEnergyToleranceJ),
    maximumEnergyToleranceUtilization:
      round(totals.maximumEnergyToleranceUtilization, 12)
  };
}

function profileFloodplainHabitat(profile) {
  const totals = {
    reachCount: 0,
    observedReachCount: 0,
    activeWetReachCount: 0,
    floodPulseCount: 0,
    observedDays: 0,
    rollingHydroperiod30d: 0,
    cumulativeNewDepositKg: 0,
    classCounts: Object.fromEntries(FLOODPLAIN_HABITAT_TYPES.map(id =>
      [id, 0])),
    fractions: Object.fromEntries(FLOODPLAIN_HABITAT_TYPES.map(id =>
      [id, 0]))
  };
  const states = [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)));
  for (const reach of states) {
    const habitat = floodplainHabitatSummary(reach.floodplainHabitat);
    const floodplain = floodplainTotals(reach.floodplain);
    totals.reachCount += 1;
    totals.observedReachCount += habitat.observedDays > 0 ? 1 : 0;
    totals.activeWetReachCount += floodplain.waterKg > 1e-6 ? 1 : 0;
    totals.floodPulseCount += habitat.floodPulseCount;
    totals.observedDays += habitat.observedDays;
    totals.rollingHydroperiod30d += habitat.rollingHydroperiod30d;
    totals.cumulativeNewDepositKg += habitat.cumulativeNewDepositKg;
    totals.classCounts[habitat.habitatClass] += 1;
    for (const id of FLOODPLAIN_HABITAT_TYPES) {
      totals.fractions[id] += habitat.fractions[id];
    }
  }
  const divisor = Math.max(1, totals.reachCount);
  totals.rollingHydroperiod30d = round(
    totals.rollingHydroperiod30d / divisor, 9);
  totals.cumulativeNewDepositKg = round(
    totals.cumulativeNewDepositKg, 9);
  totals.observedDays = round(totals.observedDays, 8);
  totals.fractions = Object.fromEntries(FLOODPLAIN_HABITAT_TYPES.map(id =>
    [id, round(totals.fractions[id] / divisor, 12)]));
  totals.dominantClass = totals.reachCount > 0
    ? FLOODPLAIN_HABITAT_TYPES.reduce((best, id) =>
      totals.classCounts[id] > totals.classCounts[best] ? id : best,
    FLOODPLAIN_HABITAT_TYPES[0]) : null;
  return totals;
}

function profileFloodEvents(profile) {
  const totals = {
    reachCount: 0,
    observedReachCount: 0,
    activeEventCount: 0,
    completedEventCount: 0,
    archivedEventCount: 0,
    evictedEventCount: 0,
    observedDays: 0,
    totalCompletedDurationDays: 0,
    recurrenceIntervalCount: 0,
    totalRecurrenceIntervalDays: 0,
    historicalPeakWaterKg: 0,
    historicalPeakInundatedFraction: 0
  };
  const states = [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)));
  for (const reach of states) {
    const state = normalizeFloodEventHistoryState(reach.floodEvents);
    totals.reachCount += 1;
    totals.observedReachCount += state.observedDays > 0 ? 1 : 0;
    totals.activeEventCount += state.currentEvent ? 1 : 0;
    totals.completedEventCount += state.completedEventCount;
    totals.archivedEventCount += state.recentEvents.length;
    totals.evictedEventCount += state.evictedEventCount;
    totals.observedDays += state.observedDays;
    totals.totalCompletedDurationDays +=
      state.totalCompletedDurationDays;
    totals.recurrenceIntervalCount += state.recurrenceIntervalCount;
    totals.totalRecurrenceIntervalDays +=
      state.totalRecurrenceIntervalDays;
    totals.historicalPeakWaterKg = Math.max(
      totals.historicalPeakWaterKg,
      state.historicalPeakWaterKg,
      finite(state.currentEvent?.peakWaterKg));
    totals.historicalPeakInundatedFraction = Math.max(
      totals.historicalPeakInundatedFraction,
      state.historicalPeakInundatedFraction,
      finite(state.currentEvent?.peakInundatedFraction));
  }
  return {
    reachCount: totals.reachCount,
    observedReachCount: totals.observedReachCount,
    activeEventCount: totals.activeEventCount,
    completedEventCount: totals.completedEventCount,
    archivedEventCount: totals.archivedEventCount,
    evictedEventCount: totals.evictedEventCount,
    observedDays: round(totals.observedDays, 8),
    meanCompletedDurationDays: totals.completedEventCount > 0
      ? round(totals.totalCompletedDurationDays /
        totals.completedEventCount, 8) : 0,
    meanRecurrenceIntervalDays: totals.recurrenceIntervalCount > 0
      ? round(totals.totalRecurrenceIntervalDays /
        totals.recurrenceIntervalCount, 8) : null,
    historicalPeakWaterKg: round(totals.historicalPeakWaterKg, 6),
    historicalPeakInundatedFraction: round(
      totals.historicalPeakInundatedFraction, 9)
  };
}

function profileFloodplainSuccession(profile) {
  const totals = {
    reachCount: 0,
    observedReachCount: 0,
    colonizedReachCount: 0,
    observedLivingDays: 0,
    dormantDays: 0,
    totalCoverFraction: 0,
    juvenileCoverFraction: 0,
    matureCoverFraction: 0,
    seedBankSeedsM2: 0,
    successionIndex: 0,
    diversityIndex: 0,
    guildCover: Object.fromEntries([
      'aquaticPioneers', 'mudflatAnnuals', 'reedSedge',
      'wetMeadow', 'riparianWoodland'
    ].map(id => [id, 0]))
  };
  const states = [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)));
  for (const reach of states) {
    const community = floodplainSuccessionSummary(
      reach.floodplainSuccession);
    totals.reachCount += 1;
    totals.observedReachCount += community.observedLivingDays > 0 ? 1 : 0;
    totals.colonizedReachCount += community.totalCoverFraction > 1e-12
      ? 1 : 0;
    totals.observedLivingDays += community.observedLivingDays;
    totals.dormantDays += community.dormantDays;
    totals.totalCoverFraction += community.totalCoverFraction;
    totals.juvenileCoverFraction += community.juvenileCoverFraction;
    totals.matureCoverFraction += community.matureCoverFraction;
    totals.seedBankSeedsM2 += community.totalSeedBankSeedsM2;
    totals.successionIndex += community.successionIndex;
    totals.diversityIndex += community.diversityIndex;
    for (const id of Object.keys(totals.guildCover)) {
      totals.guildCover[id] += community.guilds[id].totalCoverFraction;
    }
  }
  const divisor = Math.max(1, totals.reachCount);
  const dominantGuild = totals.colonizedReachCount > 0
    ? Object.keys(totals.guildCover).reduce((best, id) =>
      totals.guildCover[id] > totals.guildCover[best] ? id : best,
    Object.keys(totals.guildCover)[0]) : 'uncolonized';
  return {
    reachCount: totals.reachCount,
    observedReachCount: totals.observedReachCount,
    colonizedReachCount: totals.colonizedReachCount,
    observedLivingDays: round(totals.observedLivingDays, 8),
    dormantDays: round(totals.dormantDays, 8),
    meanTotalCoverFraction: round(totals.totalCoverFraction / divisor, 12),
    meanJuvenileCoverFraction: round(
      totals.juvenileCoverFraction / divisor, 12),
    meanMatureCoverFraction: round(
      totals.matureCoverFraction / divisor, 12),
    meanSeedBankSeedsM2: round(totals.seedBankSeedsM2 / divisor, 9),
    meanSuccessionIndex: round(totals.successionIndex / divisor, 9),
    meanDiversityIndex: round(totals.diversityIndex / divisor, 9),
    dominantGuild,
    guildMeanCover: Object.fromEntries(Object.entries(totals.guildCover)
      .map(([id, value]) => [id, round(value / divisor, 12)]))
  };
}

function profileFloodplainPlantMatter(profile) {
  const totals = {
    reachCount: 0,
    materializedReachCount: 0,
    observedMaterialDays: 0,
    dormantDays: 0,
    live: { carbonKgC: 0, nitrogenKgN: 0 },
    standingDead: { carbonKgC: 0, nitrogenKgN: 0 },
    litter: { carbonKgC: 0, nitrogenKgN: 0 },
    total: { carbonKgC: 0, nitrogenKgN: 0 },
    legacyUnmaterializedCoverFraction: 0,
    guildLiveCarbonKgC: Object.fromEntries([
      'aquaticPioneers', 'mudflatAnnuals', 'reedSedge',
      'wetMeadow', 'riparianWoodland'
    ].map(id => [id, 0]))
  };
  const states = [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)));
  for (const reach of states) {
    const matter = floodplainPlantMatterSummary(
      reach.floodplainPlantMatter);
    totals.reachCount += 1;
    totals.materializedReachCount += matter.total.carbonKgC > 1e-12 ||
      matter.total.nitrogenKgN > 1e-12 ? 1 : 0;
    totals.observedMaterialDays += matter.observedMaterialDays;
    totals.dormantDays += matter.dormantDays;
    totals.legacyUnmaterializedCoverFraction +=
      matter.legacyUnmaterializedCoverFraction;
    for (const pool of ['live', 'standingDead', 'litter', 'total']) {
      totals[pool].carbonKgC += matter[pool].carbonKgC;
      totals[pool].nitrogenKgN += matter[pool].nitrogenKgN;
    }
    for (const id of Object.keys(totals.guildLiveCarbonKgC)) {
      totals.guildLiveCarbonKgC[id] += matter.guilds[id].live.carbonKgC;
    }
  }
  const dominantGuild = totals.live.carbonKgC > 1e-12
    ? Object.keys(totals.guildLiveCarbonKgC).reduce((best, id) =>
      totals.guildLiveCarbonKgC[id] > totals.guildLiveCarbonKgC[best]
        ? id : best, Object.keys(totals.guildLiveCarbonKgC)[0])
    : 'unmaterialized';
  return {
    reachCount: totals.reachCount,
    materializedReachCount: totals.materializedReachCount,
    observedMaterialDays: round(totals.observedMaterialDays, 8),
    dormantDays: round(totals.dormantDays, 8),
    live: Object.fromEntries(Object.entries(totals.live).map(
      ([key, value]) => [key, round(value, 9)])),
    standingDead: Object.fromEntries(Object.entries(totals.standingDead).map(
      ([key, value]) => [key, round(value, 9)])),
    litter: Object.fromEntries(Object.entries(totals.litter).map(
      ([key, value]) => [key, round(value, 9)])),
    total: Object.fromEntries(Object.entries(totals.total).map(
      ([key, value]) => [key, round(value, 9)])),
    legacyUnmaterializedCoverFraction: round(
      totals.legacyUnmaterializedCoverFraction, 12),
    dominantGuild
  };
}

function profileFloodplainPlantResources(profile) {
  const totals = {
    reachCount: 0,
    resourcedReachCount: 0,
    observedResourceDays: 0,
    dormantDays: 0,
    live: { supportedCarbonKgC: 0, phosphorusKgP: 0, waterKg: 0 },
    standingDead: { supportedCarbonKgC: 0, phosphorusKgP: 0 },
    litter: { supportedCarbonKgC: 0, phosphorusKgP: 0 },
    total: { supportedCarbonKgC: 0, phosphorusKgP: 0,
      liveWaterKg: 0 },
    migrationLegacyUnsupportedCarbonKgC: 0,
    cumulativeMortalityWaterReturnKg: 0,
    guildLivePhosphorusKgP: Object.fromEntries([
      'aquaticPioneers', 'mudflatAnnuals', 'reedSedge',
      'wetMeadow', 'riparianWoodland'
    ].map(id => [id, 0]))
  };
  const states = [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)));
  for (const reach of states) {
    const resources = floodplainPlantResourcesSummary(
      reach.floodplainPlantResources);
    totals.reachCount += 1;
    totals.resourcedReachCount += resources.total.phosphorusKgP > 1e-15 ||
      resources.total.liveWaterKg > 1e-12 ? 1 : 0;
    totals.observedResourceDays += resources.observedResourceDays;
    totals.dormantDays += resources.dormantDays;
    totals.migrationLegacyUnsupportedCarbonKgC +=
      resources.migrationLegacyUnsupportedCarbonKgC;
    totals.cumulativeMortalityWaterReturnKg +=
      resources.cumulativeMortalityWaterReturnKg;
    for (const key of Object.keys(totals.live)) {
      totals.live[key] += finite(resources.live[key]);
    }
    for (const pool of ['standingDead', 'litter']) {
      for (const key of Object.keys(totals[pool])) {
        totals[pool][key] += finite(resources[pool][key]);
      }
    }
    for (const key of Object.keys(totals.total)) {
      totals.total[key] += finite(resources.total[key]);
    }
    for (const id of Object.keys(totals.guildLivePhosphorusKgP)) {
      totals.guildLivePhosphorusKgP[id] +=
        finite(resources.guilds[id].live.phosphorusKgP);
    }
  }
  const dominantGuild = totals.total.phosphorusKgP > 1e-15
    ? Object.keys(totals.guildLivePhosphorusKgP).reduce((best, id) =>
      totals.guildLivePhosphorusKgP[id] >
        totals.guildLivePhosphorusKgP[best] ? id : best,
    Object.keys(totals.guildLivePhosphorusKgP)[0]) : 'unresourced';
  return {
    reachCount: totals.reachCount,
    resourcedReachCount: totals.resourcedReachCount,
    observedResourceDays: round(totals.observedResourceDays, 8),
    dormantDays: round(totals.dormantDays, 8),
    live: Object.fromEntries(Object.entries(totals.live).map(
      ([key, value]) => [key, round(value, 9)])),
    standingDead: Object.fromEntries(Object.entries(totals.standingDead).map(
      ([key, value]) => [key, round(value, 9)])),
    litter: Object.fromEntries(Object.entries(totals.litter).map(
      ([key, value]) => [key, round(value, 9)])),
    total: Object.fromEntries(Object.entries(totals.total).map(
      ([key, value]) => [key, round(value, 9)])),
    migrationLegacyUnsupportedCarbonKgC: round(
      totals.migrationLegacyUnsupportedCarbonKgC, 9),
    cumulativeMortalityWaterReturnKg: round(
      totals.cumulativeMortalityWaterReturnKg, 9),
    dominantGuild
  };
}

function profileFloodplainDecomposition(profile) {
  const totals = {
    reachCount: 0,
    observedReachCount: 0,
    activeReachCount: 0,
    observedDecompositionDays: 0,
    dormantDays: 0,
    cumulativeFloodplainReturn: {
      carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0
    },
    eligibleCarbonKgC: 0,
    activityScale: 0
  };
  for (const reach of [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)))) {
    const decomposition = floodplainDecompositionSummary(
      reach.floodplainDecomposition);
    totals.reachCount += 1;
    totals.observedReachCount += decomposition.observedDecompositionDays > 0
      ? 1 : 0;
    totals.activeReachCount +=
      decomposition.lastActivity.activityScale > 0 &&
      decomposition.lastActivity.eligibleCarbonKgC > 1e-12 ? 1 : 0;
    totals.observedDecompositionDays +=
      decomposition.observedDecompositionDays;
    totals.dormantDays += decomposition.dormantDays;
    totals.eligibleCarbonKgC +=
      decomposition.lastActivity.eligibleCarbonKgC;
    totals.activityScale += decomposition.lastActivity.activityScale;
    for (const key of Object.keys(totals.cumulativeFloodplainReturn)) {
      totals.cumulativeFloodplainReturn[key] +=
        finite(decomposition.cumulativeFloodplainReturn[key]);
    }
  }
  const divisor = Math.max(1, totals.reachCount);
  return {
    reachCount: totals.reachCount,
    observedReachCount: totals.observedReachCount,
    activeReachCount: totals.activeReachCount,
    observedDecompositionDays: round(
      totals.observedDecompositionDays, 8),
    dormantDays: round(totals.dormantDays, 8),
    cumulativeFloodplainReturn: Object.fromEntries(Object.entries(
      totals.cumulativeFloodplainReturn).map(([key, value]) =>
      [key, round(value, key === 'phosphorusKgP' ? 12 : 9)])),
    eligibleCarbonKgC: round(totals.eligibleCarbonKgC, 9),
    meanActivityScale: round(totals.activityScale / divisor, 9)
  };
}

function profileFloodplainRespiration(profile) {
  const totals = {
    reachCount: 0,
    observedReachCount: 0,
    activeReachCount: 0,
    oxygenLimitedReachCount: 0,
    observedRespirationDays: 0,
    dormantDays: 0,
    oxygenLimitedDays: 0,
    cumulativeMineralization: {
      dissolvedOrganicCarbonConsumedKgC: 0,
      dissolvedInorganicCarbonProducedKgC: 0,
      dissolvedOxygenConsumedKgO2: 0
    },
    activityScale: 0
  };
  for (const reach of [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)))) {
    const respiration = floodplainRespirationSummary(
      reach.floodplainRespiration);
    totals.reachCount += 1;
    totals.observedReachCount += respiration.observedRespirationDays > 0
      ? 1 : 0;
    totals.activeReachCount += respiration.lastActivity.activityScale > 0 &&
      respiration.lastActivity.potentialMineralizationKgC > 1e-12 ? 1 : 0;
    totals.oxygenLimitedReachCount +=
      respiration.lastActivity.oxygenLimited ? 1 : 0;
    totals.observedRespirationDays += respiration.observedRespirationDays;
    totals.dormantDays += respiration.dormantDays;
    totals.oxygenLimitedDays += respiration.oxygenLimitedDays;
    totals.activityScale += respiration.lastActivity.activityScale;
    for (const key of Object.keys(totals.cumulativeMineralization)) {
      totals.cumulativeMineralization[key] +=
        finite(respiration.cumulativeMineralization[key]);
    }
  }
  const divisor = Math.max(1, totals.reachCount);
  return {
    reachCount: totals.reachCount,
    observedReachCount: totals.observedReachCount,
    activeReachCount: totals.activeReachCount,
    oxygenLimitedReachCount: totals.oxygenLimitedReachCount,
    observedRespirationDays: round(totals.observedRespirationDays, 8),
    dormantDays: round(totals.dormantDays, 8),
    oxygenLimitedDays: round(totals.oxygenLimitedDays, 8),
    cumulativeMineralization: Object.fromEntries(Object.entries(
      totals.cumulativeMineralization).map(([key, value]) =>
      [key, round(value, 9)])),
    meanActivityScale: round(totals.activityScale / divisor, 9)
  };
}

function profileFloodplainDenitrification(profile) {
  const totals = {
    reachCount: 0,
    observedReachCount: 0,
    activeReachCount: 0,
    atmosphereUnavailableReachCount: 0,
    oxicConstrainedReachCount: 0,
    nitrogenLimitedReachCount: 0,
    temperatureConstrainedReachCount: 0,
    observedDenitrificationDays: 0,
    dormantDays: 0,
    atmosphereUnavailableDays: 0,
    oxicConstrainedDays: 0,
    nitrogenLimitedDays: 0,
    temperatureConstrainedDays: 0,
    activityScale: 0,
    waterTemperatureC: 0,
    temperatureResponseFactor: 0,
    cumulativeReaction: {
      dissolvedOrganicCarbonConsumedKgC: 0,
      dissolvedInorganicCarbonProducedKgC: 0,
      dissolvedNitrateNitrogenConsumedKgN: 0,
      nitrogenGasProducedKgN: 0,
      alkalinityGeneratedKgCaCO3Eq: 0
    }
  };
  for (const reach of [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)))) {
    const denitrification = floodplainDenitrificationSummary(
      reach.floodplainDenitrification);
    totals.reachCount += 1;
    totals.observedReachCount +=
      denitrification.observedDenitrificationDays > 0 ? 1 : 0;
    totals.activeReachCount +=
      denitrification.lastActivity.activityScale > 0 ? 1 : 0;
    totals.atmosphereUnavailableReachCount +=
      denitrification.atmosphereUnavailableDays > 0 &&
      !denitrification.lastActivity.atmosphereAvailable ? 1 : 0;
    totals.oxicConstrainedReachCount +=
      denitrification.observedDenitrificationDays > 0 &&
      denitrification.lastActivity.anoxiaFactor < .999999 ? 1 : 0;
    totals.nitrogenLimitedReachCount +=
      denitrification.lastActivity.nitrogenLimited ? 1 : 0;
    totals.temperatureConstrainedReachCount +=
      denitrification.observedDenitrificationDays > 0 &&
      denitrification.lastActivity.temperatureConstrained ? 1 : 0;
    for (const key of ['observedDenitrificationDays', 'dormantDays',
      'atmosphereUnavailableDays', 'oxicConstrainedDays',
      'nitrogenLimitedDays', 'temperatureConstrainedDays']) {
      totals[key] += denitrification[key];
    }
    totals.activityScale += denitrification.lastActivity.activityScale;
    totals.waterTemperatureC +=
      denitrification.lastActivity.waterTemperatureC;
    totals.temperatureResponseFactor +=
      denitrification.lastActivity.temperatureResponseFactor;
    for (const key of Object.keys(totals.cumulativeReaction)) {
      totals.cumulativeReaction[key] += finite(
        denitrification.cumulativeReaction[key]);
    }
  }
  const divisor = Math.max(1, totals.reachCount);
  return {
    reachCount: totals.reachCount,
    observedReachCount: totals.observedReachCount,
    activeReachCount: totals.activeReachCount,
    atmosphereUnavailableReachCount:
      totals.atmosphereUnavailableReachCount,
    oxicConstrainedReachCount: totals.oxicConstrainedReachCount,
    nitrogenLimitedReachCount: totals.nitrogenLimitedReachCount,
    temperatureConstrainedReachCount:
      totals.temperatureConstrainedReachCount,
    observedDenitrificationDays: round(
      totals.observedDenitrificationDays, 8),
    dormantDays: round(totals.dormantDays, 8),
    atmosphereUnavailableDays: round(
      totals.atmosphereUnavailableDays, 8),
    oxicConstrainedDays: round(totals.oxicConstrainedDays, 8),
    nitrogenLimitedDays: round(totals.nitrogenLimitedDays, 8),
    temperatureConstrainedDays: round(
      totals.temperatureConstrainedDays, 8),
    cumulativeReaction: Object.fromEntries(Object.entries(
      totals.cumulativeReaction).map(([key, value]) =>
      [key, round(value, 9)])),
    meanActivityScale: round(totals.activityScale / divisor, 9),
    meanWaterTemperatureC: round(
      totals.waterTemperatureC / divisor, 9),
    meanTemperatureResponseFactor: round(
      totals.temperatureResponseFactor / divisor, 9)
  };
}

function profileFloodplainNitrification(profile) {
  const totals = {
    reachCount: 0,
    observedReachCount: 0,
    activeReachCount: 0,
    oxygenConstrainedReachCount: 0,
    oxygenLimitedReachCount: 0,
    alkalinityLimitedReachCount: 0,
    temperatureConstrainedReachCount: 0,
    observedNitrificationDays: 0,
    dormantDays: 0,
    oxygenConstrainedDays: 0,
    oxygenLimitedDays: 0,
    alkalinityLimitedDays: 0,
    temperatureConstrainedDays: 0,
    legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3: 0,
    activityScale: 0,
    waterTemperatureC: 0,
    temperatureResponseFactor: 0,
    cumulativeReaction: {
      dissolvedAmmoniumNitrogenConsumedKgN: 0,
      dissolvedNitrateNitrogenProducedKgN: 0,
      dissolvedOxygenConsumedKgO2: 0,
      alkalinityDemandKgCaCO3: 0
    }
  };
  for (const reach of [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)))) {
    const nitrification = floodplainNitrificationSummary(
      reach.floodplainNitrification);
    totals.reachCount += 1;
    totals.observedReachCount +=
      nitrification.observedNitrificationDays > 0 ? 1 : 0;
    totals.activeReachCount +=
      nitrification.lastActivity.activityScale > 0 ? 1 : 0;
    totals.oxygenConstrainedReachCount +=
      nitrification.observedNitrificationDays > 0 &&
      nitrification.lastActivity.oxygenResponseFactor < .999999 ? 1 : 0;
    totals.oxygenLimitedReachCount +=
      nitrification.lastActivity.oxygenLimited ? 1 : 0;
    totals.alkalinityLimitedReachCount +=
      nitrification.lastActivity.alkalinityLimited ? 1 : 0;
    totals.temperatureConstrainedReachCount +=
      nitrification.observedNitrificationDays > 0 &&
      nitrification.lastActivity.temperatureConstrained ? 1 : 0;
    for (const key of ['observedNitrificationDays', 'dormantDays',
      'oxygenConstrainedDays', 'oxygenLimitedDays',
      'alkalinityLimitedDays',
      'temperatureConstrainedDays']) {
      totals[key] += nitrification[key];
    }
    totals.activityScale += nitrification.lastActivity.activityScale;
    totals.waterTemperatureC +=
      nitrification.lastActivity.waterTemperatureC;
    totals.temperatureResponseFactor +=
      nitrification.lastActivity.temperatureResponseFactor;
    totals.legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3 += finite(
      nitrification.legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3);
    for (const key of Object.keys(totals.cumulativeReaction)) {
      totals.cumulativeReaction[key] += finite(
        nitrification.cumulativeReaction[key]);
    }
  }
  const divisor = Math.max(1, totals.reachCount);
  return {
    reachCount: totals.reachCount,
    observedReachCount: totals.observedReachCount,
    activeReachCount: totals.activeReachCount,
    oxygenConstrainedReachCount: totals.oxygenConstrainedReachCount,
    oxygenLimitedReachCount: totals.oxygenLimitedReachCount,
    alkalinityLimitedReachCount: totals.alkalinityLimitedReachCount,
    temperatureConstrainedReachCount:
      totals.temperatureConstrainedReachCount,
    observedNitrificationDays: round(
      totals.observedNitrificationDays, 8),
    dormantDays: round(totals.dormantDays, 8),
    oxygenConstrainedDays: round(totals.oxygenConstrainedDays, 8),
    oxygenLimitedDays: round(totals.oxygenLimitedDays, 8),
    alkalinityLimitedDays: round(totals.alkalinityLimitedDays, 8),
    temperatureConstrainedDays: round(
      totals.temperatureConstrainedDays, 8),
    cumulativeReaction: Object.fromEntries(Object.entries(
      totals.cumulativeReaction).map(([key, value]) =>
      [key, round(value, 9)])),
    legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3: round(
      totals.legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3, 9),
    meanActivityScale: round(totals.activityScale / divisor, 9),
    meanWaterTemperatureC: round(
      totals.waterTemperatureC / divisor, 9),
    meanTemperatureResponseFactor: round(
      totals.temperatureResponseFactor / divisor, 9)
  };
}

function profileFloodplainGasExchange(profile) {
  const totals = {
    reachCount: 0,
    observedReachCount: 0,
    activeReachCount: 0,
    atmosphereUnavailableReachCount: 0,
    observedExchangeDays: 0,
    inactiveDays: 0,
    atmosphereUnavailableDays: 0,
    cumulativeExchange: {
      carbonToAtmosphereKgC: 0,
      carbonToFloodplainKgC: 0,
      oxygenToFloodplainKgO2: 0
    }
  };
  for (const reach of [...profile.reaches.values()].sort((a, b) =>
    String(a.reachId).localeCompare(String(b.reachId)))) {
    const exchange = floodplainGasExchangeSummary(
      reach.floodplainGasExchange);
    totals.reachCount += 1;
    totals.observedReachCount += exchange.observedExchangeDays > 0 ? 1 : 0;
    totals.activeReachCount +=
      exchange.lastActivity.equilibrationFraction > 0 &&
      (Math.abs(exchange.lastActivity.signedCarbonGradientKgC) > 1e-12 ||
        exchange.lastActivity.oxygenDeficitKgO2 > 1e-12) ? 1 : 0;
    totals.atmosphereUnavailableReachCount +=
      exchange.atmosphereUnavailableDays > 0 &&
      !exchange.lastActivity.atmosphereAvailable ? 1 : 0;
    totals.observedExchangeDays += exchange.observedExchangeDays;
    totals.inactiveDays += exchange.inactiveDays;
    totals.atmosphereUnavailableDays +=
      exchange.atmosphereUnavailableDays;
    for (const key of Object.keys(totals.cumulativeExchange)) {
      totals.cumulativeExchange[key] +=
        finite(exchange.cumulativeExchange[key]);
    }
  }
  return {
    reachCount: totals.reachCount,
    observedReachCount: totals.observedReachCount,
    activeReachCount: totals.activeReachCount,
    atmosphereUnavailableReachCount:
      totals.atmosphereUnavailableReachCount,
    observedExchangeDays: round(totals.observedExchangeDays, 8),
    inactiveDays: round(totals.inactiveDays, 8),
    atmosphereUnavailableDays: round(
      totals.atmosphereUnavailableDays, 8),
    cumulativeExchange: Object.fromEntries(Object.entries(
      totals.cumulativeExchange).map(([key, value]) =>
      [key, round(value, 9)]))
  };
}

function loadedLandLiveBiomass(columns) {
  const totals = { carbonKgC: 0, nitrogenKgN: 0 };
  for (const column of columns) {
    if (column.kind !== 'land' || !column.land?.ecology) continue;
    const mass = landEcologyLiveBiomassMass(column.land.ecology,
      earthCellAreaM2(column));
    totals.carbonKgC += mass.carbonKgC;
    totals.nitrogenKgN += mass.nitrogenKgN;
  }
  return totals;
}

function profileEstuaryStorage(profile) {
  const totals = {
    carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0,
    alkalinityKgCaCO3Eq: 0,
    cumulativeAlkalinityGeneratedKgCaCO3Eq: 0
  };
  for (const state of profile.reaches.values()) {
    const estuary = estuaryStorageTotals(state.estuary);
    for (const key of ['carbonKgC', 'nitrogenKgN', 'phosphorusKgP',
      'oxygenKgO2', 'alkalinityKgCaCO3Eq']) totals[key] += estuary[key];
    totals.cumulativeAlkalinityGeneratedKgCaCO3Eq += Math.max(0, finite(
      state.estuary?.cumulativeAlkalinityGeneratedKgCaCO3Eq));
  }
  return totals;
}

function earthWaterMass(columns) {
  let runoffQueueKg = 0;
  let oceanFreshwaterKg = 0;
  for (const column of columns) {
    const areaM2 = earthCellAreaM2(column);
    runoffQueueKg += Math.max(0, finite(column.routing?.runoffQueueMm)) * areaM2;
    if (column.kind === 'ocean') oceanFreshwaterKg += finite(column.ocean?.freshwaterAnomalyMm) * areaM2;
  }
  return { runoffQueueKg, oceanFreshwaterKg };
}

function earthRunoffBiogeochemistryMass(columns) {
  const totals = {
    carbonKgC: 0,
    nitrogenKgN: 0,
    phosphorusKgP: 0,
    oxygenKgO2: 0,
    alkalinityKgCaCO3Eq: 0
  };
  for (const column of columns) {
    if (column.kind !== 'land') continue;
    const pools = runoffBiogeochemistryAbsolutePools(
      column.routing?.runoffBiogeochemistryQueue,
      earthCellAreaM2(column)
    );
    const elements = runoffBiogeochemistryAbsoluteElements(pools);
    totals.carbonKgC += elements.carbon;
    totals.nitrogenKgN += elements.nitrogen;
    totals.phosphorusKgP += elements.phosphorus;
    totals.oxygenKgO2 += elements.oxygen;
    totals.alkalinityKgCaCO3Eq += elements.alkalinity;
  }
  return totals;
}

function earthRunoffSedimentMass(columns) {
  const totals = { clayKg: 0, siltKg: 0, sandKg: 0, gravelKg: 0,
    totalKg: 0 };
  for (const column of columns) {
    if (column.kind !== 'land') continue;
    const sediment = runoffSedimentAbsoluteGrains(
      column.routing?.runoffSedimentQueue,
      earthCellAreaM2(column)
    );
    for (const grain of ['clay', 'silt', 'sand', 'gravel']) {
      totals[`${grain}Kg`] += sediment[grain];
    }
    totals.totalKg += sedimentGrainTotal(sediment);
  }
  return totals;
}

function coastalSedimentMass(columns) {
  const totals = { clayKg: 0, siltKg: 0, sandKg: 0, gravelKg: 0,
    suspendedKg: 0, depositedKg: 0, totalKg: 0 };
  for (const column of columns) {
    if (column.kind !== 'ocean') continue;
    const areaM2 = earthCellAreaM2(column);
    const state = normalizeCoastalSediment(column.ocean?.coastalSediment);
    for (const grain of ['clay', 'silt', 'sand', 'gravel']) {
      const suspended = state.suspendedKgM2[grain] * areaM2;
      const deposited = state.depositedKgM2[grain] * areaM2;
      totals[`${grain}Kg`] += suspended + deposited;
      totals.suspendedKg += suspended;
      totals.depositedKg += deposited;
      totals.totalKg += suspended + deposited;
    }
  }
  return totals;
}

function oceanEcologyMass(columns) {
  const totals = {
    carbonKgC: 0,
    nitrogenKgN: 0,
    phosphorusKgP: 0,
    oxygenKgO2: 0,
    alkalinityKgCaCO3Eq: 0
  };
  for (const column of columns) {
    if (column.kind !== 'ocean' || !column.ocean?.ecology) continue;
    const areaM2 = earthCellAreaM2(column);
    const elements = oceanEcologyElementTotals(column.ocean.ecology);
    totals.carbonKgC += elements.carbonKgCm2 * areaM2;
    totals.nitrogenKgN += elements.nitrogenKgNm2 * areaM2;
    totals.phosphorusKgP += elements.phosphorusKgPm2 * areaM2;
    totals.oxygenKgO2 += elements.oxygenKgO2m2 * areaM2;
    totals.alkalinityKgCaCO3Eq +=
      elements.alkalinityKgCaCO3Eqm2 * areaM2;
  }
  return totals;
}

function atmosphereNitrogenGasMass(columns) {
  return columns.reduce((sum, column) => {
    const state = normalizeAtmosphereBiogeochemistry(
      column.atmosphere?.biogeochemistry,
      {
        landEcology: column.land?.ecology,
        oceanEcology: column.ocean?.ecology,
        pressureColumn: column.atmosphere?.pressureColumn
      }
    );
    return sum + (finite(
      state.cumulative?.estuaryNitrogenGasInputKgNm2) + finite(
      state.cumulative
        ?.floodplainDenitrificationNitrogenGasInputKgNm2)) *
      earthCellAreaM2(column);
  }, 0);
}

function addOceanFreshwater(column, amountKg) {
  const areaM2 = earthCellAreaM2(column);
  const referenceWaterMm = Math.max(1, finite(column.ocean.mixedLayerDepthM) * 1000);
  const previousAnomalyMm = finite(column.ocean.freshwaterAnomalyMm);
  const referenceSalinityPsu = finite(column.ocean.salinityPsu) *
    (referenceWaterMm + previousAnomalyMm) / referenceWaterMm;
  column.ocean.freshwaterAnomalyMm = previousAnomalyMm + amountKg / areaM2;
  column.ocean.salinityPsu = clamp(referenceSalinityPsu * referenceWaterMm /
    Math.max(1, referenceWaterMm + column.ocean.freshwaterAnomalyMm), 2, 43);
}

function reachCellId(reach, resolutionDeg) {
  return earthCellIdentity(reach.canonicalFrom.lat, reach.canonicalFrom.lon, { resolutionDeg }).id;
}

function outletRank(reach, resolutionDeg) {
  if (reach.reachesOcean) return 3;
  if (!reach.downstreamReachId) return 2;
  const targetId = earthCellIdentity(reach.canonicalTo.lat, reach.canonicalTo.lon, { resolutionDeg }).id;
  return targetId !== reachCellId(reach, resolutionDeg) ? 1 : 0;
}

function selectInlets(reaches, resolutionDeg) {
  const grouped = new Map();
  for (const reach of reaches) {
    const cellId = reachCellId(reach, resolutionDeg);
    const candidates = grouped.get(cellId) || [];
    candidates.push(reach);
    grouped.set(cellId, candidates);
  }
  const selected = new Map();
  for (const [cellId, candidates] of grouped) {
    candidates.sort((a, b) => outletRank(b, resolutionDeg) - outletRank(a, resolutionDeg) ||
      finite(b.contributingAreaKm2) - finite(a.contributingAreaKm2) || a.id.localeCompare(b.id));
    selected.set(cellId, candidates[0]);
  }
  return selected;
}

function validateColumns(sourceColumns) {
  if (!Array.isArray(sourceColumns) || sourceColumns.length === 0) {
    throw new Error('Basin routing requires at least one Earth-system column');
  }
  const columns = sourceColumns.map(column => {
    if (!column || column.schema !== EARTH_SYSTEM_COLUMN_SCHEMA) {
      throw new Error('Basin routing received an invalid Earth-system column');
    }
    return clone(column);
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(columns.map(column => column.id)).size !== columns.length) {
    throw new Error('Basin routing received duplicate Earth-system columns');
  }
  if (new Set(columns.map(column => column.profileId)).size !== 1) {
    throw new Error('Basin routing cannot mix condition profiles');
  }
  if (new Set(columns.map(column => column.resolutionDeg)).size !== 1) {
    throw new Error('Basin routing cannot mix Earth-cell resolutions');
  }
  return columns;
}

function validateSector(sector) {
  if (sector == null) return [];
  if (sector.schema !== HYDROLOGY_SCHEMA || !Array.isArray(sector.rivers)) {
    throw new Error('Basin routing requires a canonical hydrology sector');
  }
  const reaches = sector.rivers.map(reach => clone(reach)).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(reaches.map(reach => reach.id)).size !== reaches.length) {
    throw new Error('Basin routing received duplicate canonical reach IDs');
  }
  if (reaches.some(reach => !reach.id || !reach.canonicalFrom || !reach.canonicalTo)) {
    throw new Error('Basin routing received an incomplete canonical reach');
  }
  return reaches;
}

function ensureReach(profile, reachId, day, maximumReachStates) {
  let state = profile.reaches.get(reachId);
  if (state) return state;
  if (profile.reaches.size >= maximumReachStates) {
    throw new Error('Basin routing reach-state capacity exceeded; stored water was not discarded');
  }
  state = emptyReachState(reachId, day);
  profile.reaches.set(reachId, state);
  return state;
}

function roundColumnRouting(column) {
  column.routing.runoffQueueMm = round(Math.max(0, column.routing.runoffQueueMm), 15);
  column.routing.cumulativeRoutedRunoffMm = round(Math.max(0, finite(column.routing.cumulativeRoutedRunoffMm)), 15);
  column.routing.cumulativeChannelizedRunoffMm = round(Math.max(0, finite(column.routing.cumulativeChannelizedRunoffMm)), 15);
  column.truth.runoffCanEnterCanonicalRiverReach = true;
}

export class BasinRoutingEngine {
  constructor(options = {}) {
    this.maximumReachStates = Math.max(16, Math.min(65_536, Math.round(finite(options.maximumReachStates, 4096))));
    this.profiles = new Map();
    this.receipts = new Map();
    this.restoredProfileIds = new Set();
    if (options.state) this.restore(options.state);
  }

  profile(profileId) {
    let profile = this.profiles.get(profileId);
    if (!profile) {
      profile = {
        profileId,
        lastDay: null,
        clockAlignmentCheckpoint: null,
        reaches: new Map()
      };
      this.profiles.set(profileId, profile);
    }
    return profile;
  }

  reconcileRestoredClock(profileId, committedTransportDay) {
    const targetDay = Number(committedTransportDay);
    if (!Number.isFinite(targetDay)) {
      throw new Error('Committed transport clock must be finite');
    }
    const profile = this.profiles.get(profileId);
    if (!profile || !this.restoredProfileIds.has(profileId)) {
      return { status: 'NOT_ELIGIBLE', checkpoint: null };
    }
    this.restoredProfileIds.delete(profileId);
    if (profile.lastDay === null ||
        Math.abs(profile.lastDay - targetDay) <= CLOCK_TOLERANCE_DAYS) {
      return { status: 'ALREADY_ALIGNED', checkpoint: null };
    }
    const previousBasinDay = profile.lastDay;
    const checkpoint = {
      schema: BASIN_CLOCK_ALIGNMENT_CHECKPOINT_SCHEMA,
      profileId,
      previousBasinDay,
      committedTransportDay: round(targetDay, 8),
      deltaDays: round(targetDay - previousBasinDay, 8),
      status: 'RESTORED_CLOCK_REBASED_WITHOUT_MATERIAL_REPLAY',
      materialStatePreserved: true,
      latestRoutingReceiptInvalidated: true,
      historicalRoutingReconstructed: false,
      truth: {
        committedEarthTransportClockAuthoritative: true,
        restoredStateOnly: true,
        runtimeClockMismatchMasked: false,
        historicalMaterialTransferClaimed: false
      }
    };
    profile.lastDay = checkpoint.committedTransportDay;
    profile.clockAlignmentCheckpoint = checkpoint;
    this.receipts.delete(profileId);
    return { status: 'REBASED', checkpoint: clone(checkpoint) };
  }

  advance(sourceColumns, sector, dtDays, options = {}) {
    const durationDays = finite(dtDays);
    if (!(durationDays > 0) || durationDays > 1.000001) {
      throw new Error('Basin routing step must be greater than zero and no longer than one day');
    }
    const columns = validateColumns(sourceColumns);
    const reaches = validateSector(sector);
    const profileId = columns[0].profileId;
    if (options.profileId && options.profileId !== profileId) {
      throw new Error('Basin routing profile does not match its Earth-system columns');
    }
    const current = this.profile(profileId);
    const startDay = Number.isFinite(Number(options.startDay))
      ? Number(options.startDay)
      : current.lastDay ?? Math.max(...columns.map(column => finite(column.lastDay))) - durationDays;
    if (current.lastDay !== null && Math.abs(current.lastDay - startDay) > CLOCK_TOLERANCE_DAYS) {
      throw new Error('Basin routing clock does not match the committed transport clock');
    }
    const endDay = startDay + durationDays;
    const working = {
      profileId,
      lastDay: current.lastDay,
      clockAlignmentCheckpoint: current.clockAlignmentCheckpoint ?
        clone(current.clockAlignmentCheckpoint) : null,
      reaches: new Map([...current.reaches.entries()].map(([id, state]) => [id, normalizedReachState(state)]))
    };
    const initialEarth = earthWaterMass(columns);
    const initialRunoffBiogeochemistry =
      earthRunoffBiogeochemistryMass(columns);
    const initialRunoffSediment = earthRunoffSedimentMass(columns);
    const initialCoastalSediment = coastalSedimentMass(columns);
    const initialOceanEcology = oceanEcologyMass(columns);
    const initialAtmosphereNitrogenGasKgN = atmosphereNitrogenGasMass(columns);
    const initialLoadedLandLiveBiomass = loadedLandLiveBiomass(columns);
    const initialRiverStorageKg = profileStorageKg(working);
    const initialRiverChemistry = profileChemistry(working);
    const initialRiverNitrogenSpecies = profileNitrogenSpecies(working);
    const initialRiverSediment = profileSediment(working);
    const initialFloodplain = profileFloodplain(working);
    const initialFloodplainThermal = profileFloodplainThermal(working);
    const initialFloodplainHabitat = profileFloodplainHabitat(working);
    const initialFloodEvents = profileFloodEvents(working);
    const initialFloodplainSuccession =
      profileFloodplainSuccession(working);
    const initialFloodplainPlantMatter =
      profileFloodplainPlantMatter(working);
    const initialFloodplainPlantResources =
      profileFloodplainPlantResources(working);
    const initialFloodplainDecomposition =
      profileFloodplainDecomposition(working);
    const initialFloodplainRespiration =
      profileFloodplainRespiration(working);
    const initialFloodplainDenitrification =
      profileFloodplainDenitrification(working);
    const initialFloodplainNitrification =
      profileFloodplainNitrification(working);
    const initialFloodplainGasExchange =
      profileFloodplainGasExchange(working);
    const initialEstuaryStorage = profileEstuaryStorage(working);
    const reachById = new Map(reaches.map(reach => [reach.id, reach]));
    const floodplainReceipts = [];
    const floodplainThermalReceipts = [];
    const floodplainHabitatReceipts = [];
    const floodEventReceipts = [];
    const floodplainSuccessionReceipts = [];
    const floodplainPlantMatterReceipts = [];
    const floodplainPlantResourcesReceipts = [];
    const floodplainDecompositionReceipts = [];
    const floodplainRespirationReceipts = [];
    const floodplainAerobicMineralizationReceipts = [];
    const floodplainDenitrificationReactionReceipts = [];
    const atmosphereFloodplainDenitrificationReceipts = [];
    const floodplainDenitrificationProcessReceipts = [];
    const floodplainNitrificationReactionReceipts = [];
    const floodplainNitrificationProcessReceipts = [];
    const floodplainGasExchangeReceipts = [];
    const atmosphereFloodplainGasExchangeReceipts = [];
    const floodplainGasExchangeProcessReceipts = [];
    const floodplainPlantDetritusMatterDebitReceipts = [];
    const floodplainPlantDetritusResourceDebitReceipts = [];
    const floodplainDetritalReturnCreditReceipts = [];
    const landEcologySubgridDebitReceipts = [];
    const floodplainPlantResourceDebitReceipts = [];
    const floodplainPlantWaterReturnReceipts = [];
    const landColumnsById = new Map(columns.filter(column =>
      column.kind === 'land' && column.land?.ecology).map(column =>
      [column.id, column]));
    const atmosphereColumnsById = new Map(columns.filter(column =>
      column.atmosphere?.biogeochemistry).map(column =>
      [column.id, column]));
    const pendingPlantMatter = [];
    for (const reach of reaches) {
      const state = working.reaches.get(reach.id);
      if (!state) continue;
      const donorCellId = reachDonorCellId(reach,
        columns[0].resolutionDeg);
      const atmosphereColumn = atmosphereColumnsById.get(
        donorCellId) || null;
      const exchange = advanceFloodplainExchange(
        state.floodplain,
        {
          waterKg: state.storageKg,
          chemistry: state.chemistry,
          sediment: state.sediment
        },
        reach,
        durationDays,
        {
          reachLengthM: reachLengthM(reach),
          reachId: reach.id,
          startDay
        }
      );
      state.storageKg = exchange.channel.waterKg;
      state.chemistry = exchange.channel.chemistry;
      state.sediment = exchange.channel.sediment;
      state.floodplain = exchange.state;
      const thermal = advanceFloodplainThermal(
        state.floodplainThermal,
        state.floodplain,
        {
          reachId: reach.id,
          startDay,
          durationDays,
          surfaceBoundaryTemperatureC: finite(
            atmosphereColumn?.surface?.temperatureC, 15),
          incomingWaterTemperatureC: finite(
            atmosphereColumn?.surface?.temperatureC, 15),
          relaxationTimescaleDays: finite(
            options.floodplainThermalRelaxationTimescaleDays, 3)
        }
      );
      state.floodplainThermal = thermal.state;
      const floodEvents = advanceFloodEventHistory(
        state.floodEvents,
        state.floodplain,
        exchange.receipt,
        durationDays,
        { reachId: reach.id, startDay }
      );
      state.floodEvents = floodEvents.state;
      const habitat = advanceFloodplainHabitat(
        state.floodplainHabitat,
        state.floodplain,
        durationDays,
        {
          reachId: reach.id,
          startDay,
          floodplainExchangeReceipt: exchange.receipt
        }
      );
      state.floodplainHabitat = habitat.state;
      const successionBefore = normalizeFloodplainSuccessionState(
        state.floodplainSuccession);
      const successionProposal = advanceFloodplainSuccession(
        successionBefore,
        state.floodplainHabitat,
        durationDays,
        {
          reachId: reach.id,
          startDay,
          livingEnabled: options.livingEnabled !== false,
          lifeAbundance: finite(options.lifeAbundance, 1),
          floodplainHabitatReceipt: habitat.receipt,
          floodEventReceipt: floodEvents.receipt,
          materialGrowthScale: 1
        }
      );
      const areaM2 = reachFloodplainAreaM2(reach);
      pendingPlantMatter.push({
        reach, state, habitatReceipt: habitat.receipt,
        floodEventReceipt: floodEvents.receipt,
        successionBefore, successionProposal,
        areaM2, donorCellId,
        proposedDemand: floodplainPlantMatterDemand(
          state.floodplainPlantMatter,
          successionProposal.receipt, areaM2)
      });
      floodplainReceipts.push(exchange.receipt);
      floodplainThermalReceipts.push(thermal.receipt);
      floodEventReceipts.push(floodEvents.receipt);
      floodplainHabitatReceipts.push(habitat.receipt);
    }
    const proposedDemandByDonor = new Map();
    for (const pending of pendingPlantMatter) {
      if (!landColumnsById.has(pending.donorCellId) ||
        pending.state.floodplainPlantMatter.migrationCheckpoint ||
        pending.state.floodplainPlantResources.migrationCheckpoint) continue;
      const total = proposedDemandByDonor.get(pending.donorCellId) ||
        { carbonKgC: 0, nitrogenKgN: 0 };
      total.carbonKgC += pending.proposedDemand.totals.carbonKgC;
      total.nitrogenKgN += pending.proposedDemand.totals.nitrogenKgN;
      proposedDemandByDonor.set(pending.donorCellId, total);
    }
    const materialScaleByDonor = new Map();
    for (const [donorCellId, demand] of [...proposedDemandByDonor.entries()]
      .sort(([a], [b]) => a.localeCompare(b))) {
      const column = landColumnsById.get(donorCellId);
      const capacity = landEcologySubgridDebitCapacity(
        column.land.ecology, earthCellAreaM2(column), durationDays, {
          maximumDailyFraction: finite(
            options.maximumLandEcologySubgridDebitFraction, .0025)
        });
      materialScaleByDonor.set(donorCellId, clamp(Math.min(
        demand.carbonKgC > 1e-12
          ? capacity.carbonKgC / demand.carbonKgC : 1,
        demand.nitrogenKgN > 1e-12
          ? capacity.nitrogenKgN / demand.nitrogenKgN : 1
      )));
    }
    const allocationsByDonor = new Map();
    for (const pending of [...pendingPlantMatter].sort((a, b) =>
      a.reach.id.localeCompare(b.reach.id))) {
      const donorAvailable = landColumnsById.has(pending.donorCellId);
      const proposedResourceDemand =
        floodplainPlantResourceDemandFromMatterDemand(
          pending.proposedDemand);
      const resourceCapacity = floodplainPlantResourceCapacity(
        pending.state.floodplain, durationDays, {
          maximumDailyWaterFraction: finite(
            options.maximumFloodplainPlantWaterUptakeFraction, .01),
          maximumDailyPhosphorusFraction: finite(
            options.maximumFloodplainPlantPhosphorusUptakeFraction, .02)
        });
      const resourceGrowthScale = clamp(Math.min(
        proposedResourceDemand.totals.waterKg > 1e-12
          ? resourceCapacity.waterKg /
            proposedResourceDemand.totals.waterKg : 1,
        proposedResourceDemand.totals.phosphorusKgP > 1e-15
          ? resourceCapacity.phosphorusKgP /
            proposedResourceDemand.totals.phosphorusKgP : 1
      ));
      const materialGrowthScale =
        pending.state.floodplainPlantMatter.migrationCheckpoint ||
        pending.state.floodplainPlantResources.migrationCheckpoint
          ? 0 : donorAvailable
            ? Math.min(finite(materialScaleByDonor.get(
              pending.donorCellId), 1), resourceGrowthScale) : 0;
      pending.resourceCapacity = resourceCapacity;
      pending.resourceGrowthScale = resourceGrowthScale;
      const succession = advanceFloodplainSuccession(
        pending.successionBefore,
        pending.state.floodplainHabitat,
        durationDays,
        {
          reachId: pending.reach.id,
          startDay,
          livingEnabled: options.livingEnabled !== false,
          lifeAbundance: finite(options.lifeAbundance, 1),
          floodplainHabitatReceipt: pending.habitatReceipt,
          floodEventReceipt: pending.floodEventReceipt,
          materialGrowthScale
        }
      );
      pending.state.floodplainSuccession = succession.state;
      pending.succession = succession;
      pending.finalDemand = floodplainPlantMatterDemand(
        pending.state.floodplainPlantMatter,
        succession.receipt, pending.areaM2);
      pending.credit = {
        donorCellId: donorAvailable ? pending.donorCellId : null,
        totals: clone(pending.finalDemand.totals),
        perGuild: Object.fromEntries(Object.entries(
          pending.finalDemand.perGuild).map(([id, entry]) =>
          [id, clone(entry.demand)])),
        transferIds: {}
      };
      if (donorAvailable) {
        const allocations = allocationsByDonor.get(pending.donorCellId) || [];
        for (const [guildId, entry] of Object.entries(
          pending.finalDemand.perGuild)) {
          const material = entry.demand;
          if (material.carbonKgC <= 1e-12 &&
            material.nitrogenKgN <= 1e-12) continue;
          const id = transferId('land-ecology-to-floodplain-plant',
            startDay, pending.donorCellId,
            `${pending.reach.id}:${guildId}`, material.carbonKgC);
          pending.credit.transferIds[guildId] = id;
          allocations.push({
            transferId: id,
            reachId: pending.reach.id,
            carbonKgC: material.carbonKgC,
            nitrogenKgN: material.nitrogenKgN
          });
        }
        allocationsByDonor.set(pending.donorCellId, allocations);
      } else if (pending.finalDemand.totals.carbonKgC > 1e-9 ||
        pending.finalDemand.totals.nitrogenKgN > 1e-9) {
        throw new Error('Floodplain plant matter demand lacks a loaded land-ecology donor');
      }
      floodplainSuccessionReceipts.push(succession.receipt);
    }
    const debitReceiptByDonor = new Map();
    for (const [donorCellId, allocations] of [...allocationsByDonor.entries()]
      .sort(([a], [b]) => a.localeCompare(b))) {
      if (!allocations.length) continue;
      const column = landColumnsById.get(donorCellId);
      const debit = applyLandEcologySubgridBiomassDebit(
        column.land.ecology, earthCellAreaM2(column), allocations, {
          donorCellId, startDay, durationDays,
          maximumDailyFraction: finite(
            options.maximumLandEcologySubgridDebitFraction, .0025)
        });
      column.land.ecology = debit.state;
      debitReceiptByDonor.set(donorCellId, debit.receipt);
      landEcologySubgridDebitReceipts.push(debit.receipt);
    }
    for (const pending of [...pendingPlantMatter].sort((a, b) =>
      a.reach.id.localeCompare(b.reach.id))) {
      const senderReceipt = debitReceiptByDonor.get(pending.donorCellId);
      pending.credit.senderReceiptDigest = senderReceipt?.digest || null;
      const matter = advanceFloodplainPlantMatter(
        pending.state.floodplainPlantMatter,
        pending.succession.receipt,
        pending.credit,
        {
          reachId: pending.reach.id,
          startDay, durationDays, areaM2: pending.areaM2
        }
      );
      pending.state.floodplainPlantMatter = matter.state;
      const resourcePlan = floodplainPlantResourcePlan(
        pending.state.floodplainPlantResources, matter.receipt);
      const uptakeAllocations = [];
      const waterReturns = [];
      const resourceExchange = {
        totals: clone(resourcePlan.uptakeTotals),
        waterReturnKg: resourcePlan.waterReturnKg,
        perGuild: {},
        uptakeTransferIds: {},
        waterReturnTransferIds: {}
      };
      for (const [guildId, planned] of Object.entries(
        resourcePlan.perGuild)) {
        resourceExchange.perGuild[guildId] = clone(planned.uptake);
        if (planned.uptake.phosphorusKgP > 1e-15 ||
          planned.uptake.waterKg > 1e-12) {
          const id = transferId('floodplain-to-plant-resource', startDay,
            pending.reach.id, guildId,
            planned.uptake.waterKg + planned.uptake.phosphorusKgP);
          resourceExchange.uptakeTransferIds[guildId] = id;
          uptakeAllocations.push({
            transferId: id, guildId,
            phosphorusKgP: planned.uptake.phosphorusKgP,
            waterKg: planned.uptake.waterKg
          });
        }
        if (planned.returnedWaterKg > 1e-12) {
          const id = transferId('plant-water-to-floodplain', startDay,
            `${pending.reach.id}:${guildId}`, pending.reach.id,
            planned.returnedWaterKg);
          resourceExchange.waterReturnTransferIds[guildId] = id;
          waterReturns.push({ transferId: id, guildId,
            waterKg: planned.returnedWaterKg });
        }
      }
      const floodplainResourceExchange =
        applyFloodplainPlantResourceExchange(
          pending.state.floodplain, uptakeAllocations, waterReturns, {
            reachId: pending.reach.id, startDay, durationDays,
            maximumDailyWaterFraction: finite(
              options.maximumFloodplainPlantWaterUptakeFraction, .01),
            maximumDailyPhosphorusFraction: finite(
              options.maximumFloodplainPlantPhosphorusUptakeFraction, .02)
          });
      pending.state.floodplain = floodplainResourceExchange.state;
      resourceExchange.debitReceiptDigest =
        floodplainResourceExchange.debitReceipt.digest;
      resourceExchange.returnReceiptDigest =
        floodplainResourceExchange.returnReceipt.digest;
      const resources = advanceFloodplainPlantResources(
        pending.state.floodplainPlantResources, matter.receipt,
        resourceExchange, {
          reachId: pending.reach.id, startDay, durationDays
        });
      pending.state.floodplainPlantResources = resources.state;
      const decompositionPlan = floodplainDecompositionPlan(
        pending.state.floodplainDecomposition,
        pending.state.floodplainPlantMatter,
        pending.state.floodplainPlantResources,
        pending.state.floodplain,
        {
          durationDays,
          livingEnabled: options.livingEnabled !== false,
          lifeAbundance: finite(options.lifeAbundance, 1)
        });
      const matterDetritusAllocations = [];
      const resourceDetritusAllocations = [];
      const floodplainDetritalReturns = [];
      for (const guildId of Object.keys(decompositionPlan.perGuild).sort()) {
        for (const pool of ['standingDead', 'litter']) {
          const returned = decompositionPlan.perGuild[guildId][pool].returned;
          if (returned.carbonKgC <= 1e-12 &&
            returned.nitrogenKgN <= 1e-12 &&
            returned.phosphorusKgP <= 1e-15) continue;
          const id = transferId('plant-detritus-to-floodplain', startDay,
            `${pending.reach.id}:${guildId}:${pool}`, pending.reach.id,
            returned.carbonKgC + returned.nitrogenKgN +
              returned.phosphorusKgP);
          matterDetritusAllocations.push({
            transferId: id, guildId, pool,
            carbonKgC: returned.carbonKgC,
            nitrogenKgN: returned.nitrogenKgN
          });
          resourceDetritusAllocations.push({
            transferId: id, guildId, pool,
            supportedCarbonKgC: returned.carbonKgC,
            phosphorusKgP: returned.phosphorusKgP
          });
          floodplainDetritalReturns.push({
            transferId: id, guildId, pool,
            carbonKgC: returned.carbonKgC,
            nitrogenKgN: returned.nitrogenKgN,
            phosphorusKgP: returned.phosphorusKgP
          });
        }
      }
      const livingEnabled = options.livingEnabled !== false;
      const detritusMatterDebit =
        applyFloodplainPlantDetritusMatterDebit(
          pending.state.floodplainPlantMatter,
          matterDetritusAllocations,
          { reachId: pending.reach.id, startDay, durationDays,
            livingEnabled });
      pending.state.floodplainPlantMatter = detritusMatterDebit.state;
      const detritusResourceDebit =
        applyFloodplainPlantDetritusResourceDebit(
          pending.state.floodplainPlantResources,
          resourceDetritusAllocations,
          { reachId: pending.reach.id, startDay, durationDays,
            livingEnabled });
      pending.state.floodplainPlantResources =
        detritusResourceDebit.state;
      const detritalReturn = applyFloodplainDetritalReturn(
        pending.state.floodplain, floodplainDetritalReturns,
        { reachId: pending.reach.id, startDay, durationDays,
          livingEnabled });
      pending.state.floodplain = detritalReturn.state;
      const decomposition = advanceFloodplainDecomposition(
        pending.state.floodplainDecomposition, decompositionPlan,
        detritusMatterDebit.receipt, detritusResourceDebit.receipt,
        detritalReturn.receipt,
        { reachId: pending.reach.id, startDay, durationDays });
      pending.state.floodplainDecomposition = decomposition.state;
      const respirationPlan = floodplainRespirationPlan(
        pending.state.floodplainRespiration,
        pending.state.floodplain,
        {
          durationDays,
          livingEnabled,
          lifeAbundance: finite(options.lifeAbundance, 1),
          maximumDailyDocFraction: finite(
            options.maximumFloodplainDailyDocMineralizationFraction, .04)
        });
      const mineralization = applyFloodplainAerobicMineralization(
        pending.state.floodplain, respirationPlan.reaction,
        { reachId: pending.reach.id, startDay, durationDays,
          livingEnabled });
      pending.state.floodplain = mineralization.state;
      const respiration = advanceFloodplainRespiration(
        pending.state.floodplainRespiration, respirationPlan,
        mineralization.receipt,
        { reachId: pending.reach.id, startDay, durationDays });
      pending.state.floodplainRespiration = respiration.state;
      const atmosphereColumn = atmosphereColumnsById.get(
        pending.donorCellId) || null;
      const atmosphereAvailable = Boolean(
        atmosphereColumn?.atmosphere?.biogeochemistry);
      const atmosphereAreaM2 = atmosphereAvailable
        ? earthCellAreaM2(atmosphereColumn) : 1;
      const denitrificationPlan = floodplainDenitrificationPlan(
        pending.state.floodplainDenitrification,
        pending.state.floodplain,
        {
          durationDays,
          atmosphereAvailable,
          livingEnabled,
          lifeAbundance: finite(options.lifeAbundance, 1),
          anoxicThresholdMgL: finite(
            options.floodplainDenitrificationAnoxicThresholdMgL, 2),
          maximumDailyDocFraction: finite(
            options.maximumFloodplainDailyDenitrificationDocFraction, .015),
          waterTemperatureC: pending.state.floodplainThermal
            .waterTemperatureC,
          floodplainThermalReceiptDigest:
            pending.state.floodplainThermal.lastTransitionReceipt?.digest,
          referenceTemperatureC: finite(
            options.floodplainDenitrificationReferenceTemperatureC, 20),
          temperatureQ10: finite(
            options.floodplainDenitrificationTemperatureQ10, 2)
        });
      const denitrificationTransferId = transferId(
        'floodplain-denitrification', startDay,
        pending.reach.id, pending.donorCellId,
        denitrificationPlan.reaction.nitrogenGasProducedKgN);
      let denitrificationReactionReceipt = null;
      let denitrificationAtmosphereReceipt = null;
      if (atmosphereAvailable) {
        const denitrificationReaction =
          applyFloodplainDenitrificationReaction(
            pending.state.floodplain,
            denitrificationPlan.reaction,
            {
              transferId: denitrificationTransferId,
              reachId: pending.reach.id,
              startDay,
              durationDays,
              livingEnabled
            });
        pending.state.floodplain = denitrificationReaction.state;
        denitrificationReactionReceipt = denitrificationReaction.receipt;
        const atmosphereNitrogen = applyAtmosphereGasBoundaryInput(
          atmosphereColumn.atmosphere.biogeochemistry,
          {
            nitrogenKgN:
              denitrificationPlan.reaction.nitrogenGasProducedKgN
          },
          atmosphereAreaM2,
          {
            sourceKind: 'floodplain-denitrification',
            transferId: denitrificationTransferId,
            sourceReachId: pending.reach.id,
            sourceReceiptDigest: denitrificationReaction.receipt.digest,
            pressureColumn: atmosphereColumn.atmosphere.pressureColumn
          });
        atmosphereColumn.atmosphere.biogeochemistry =
          synchronizeAtmosphereCompatibilityMirrors(
            atmosphereNitrogen.state,
            atmosphereColumn.land?.ecology,
            atmosphereColumn.ocean?.ecology,
            {
              pressureColumn:
                atmosphereColumn.atmosphere.pressureColumn
            });
        denitrificationAtmosphereReceipt = atmosphereNitrogen.receipt;
        floodplainDenitrificationReactionReceipts.push(
          denitrificationReaction.receipt);
        atmosphereFloodplainDenitrificationReceipts.push(
          atmosphereNitrogen.receipt);
      }
      const denitrification = advanceFloodplainDenitrification(
        pending.state.floodplainDenitrification,
        denitrificationPlan,
        denitrificationReactionReceipt,
        denitrificationAtmosphereReceipt,
        {
          transferId: denitrificationTransferId,
          reachId: pending.reach.id,
          atmosphereCellId: pending.donorCellId,
          startDay,
          durationDays
        });
      pending.state.floodplainDenitrification = denitrification.state;
      const gasExchangePlan = floodplainGasExchangePlan(
        pending.state.floodplainGasExchange,
        pending.state.floodplain,
        atmosphereColumn?.atmosphere?.biogeochemistry,
        {
          durationDays,
          atmosphereAvailable,
          receivingAreaM2: atmosphereAreaM2,
          pressureColumn: atmosphereColumn?.atmosphere?.pressureColumn,
          waterTemperatureC: pending.state.floodplainThermal
            .waterTemperatureC,
          floodplainThermalReceiptDigest:
            pending.state.floodplainThermal.lastTransitionReceipt?.digest,
          maximumDailyEquilibrationFraction: finite(
            options.maximumFloodplainDailyGasEquilibrationFraction, .35),
          exchangeableDicFraction: finite(
            options.floodplainExchangeableDicFraction, .025)
        });
      const gasExchangeId = transferId(
        'floodplain-atmosphere-gas-exchange', startDay,
        pending.reach.id, pending.donorCellId,
        gasExchangePlan.exchange.carbonToAtmosphereKgC +
          gasExchangePlan.exchange.carbonToFloodplainKgC +
          gasExchangePlan.exchange.oxygenToFloodplainKgO2);
      let floodplainGasOwnerReceipt = null;
      let atmosphereGasOwnerReceipt = null;
      if (atmosphereAvailable) {
        const floodplainGas = applyFloodplainGasExchange(
          pending.state.floodplain, gasExchangePlan.exchange, {
            exchangeId: gasExchangeId,
            reachId: pending.reach.id,
            atmosphereCellId: pending.donorCellId,
            startDay,
            durationDays
          });
        pending.state.floodplain = floodplainGas.state;
        floodplainGasOwnerReceipt = floodplainGas.receipt;
        const atmosphereGas = applyAtmosphereFloodplainGasExchange(
          atmosphereColumn.atmosphere.biogeochemistry,
          gasExchangePlan.exchange,
          atmosphereAreaM2,
          {
            exchangeId: gasExchangeId,
            reachId: pending.reach.id,
            atmosphereCellId: pending.donorCellId,
            startDay,
            durationDays,
            pressureColumn: atmosphereColumn.atmosphere.pressureColumn
          });
        atmosphereColumn.atmosphere.biogeochemistry =
          synchronizeAtmosphereCompatibilityMirrors(
            atmosphereGas.state,
            atmosphereColumn.land?.ecology,
            atmosphereColumn.ocean?.ecology,
            {
              pressureColumn:
                atmosphereColumn.atmosphere.pressureColumn
            });
        atmosphereGasOwnerReceipt = atmosphereGas.receipt;
        floodplainGasExchangeReceipts.push(floodplainGas.receipt);
        atmosphereFloodplainGasExchangeReceipts.push(
          atmosphereGas.receipt);
      }
      const gasExchange = advanceFloodplainGasExchange(
        pending.state.floodplainGasExchange,
        gasExchangePlan,
        floodplainGasOwnerReceipt,
        atmosphereGasOwnerReceipt,
        {
          exchangeId: gasExchangeId,
          reachId: pending.reach.id,
          atmosphereCellId: pending.donorCellId,
          startDay,
          durationDays
      });
      pending.state.floodplainGasExchange = gasExchange.state;
      const nitrificationPlan = floodplainNitrificationPlan(
        pending.state.floodplainNitrification,
        pending.state.floodplain,
        {
          durationDays,
          livingEnabled,
          lifeAbundance: finite(options.lifeAbundance, 1),
          minimumDissolvedOxygenMgL: finite(
            options.floodplainNitrificationMinimumDissolvedOxygenMgL, 2),
          optimalDissolvedOxygenMgL: finite(
            options.floodplainNitrificationOptimalDissolvedOxygenMgL, 6),
          maximumDailyAmmoniumFraction: finite(
            options.maximumFloodplainDailyNitrificationAmmoniumFraction,
            .02),
          waterTemperatureC: pending.state.floodplainThermal
            .waterTemperatureC,
          floodplainThermalReceiptDigest:
            pending.state.floodplainThermal.lastTransitionReceipt?.digest,
          referenceTemperatureC: finite(
            options.floodplainNitrificationReferenceTemperatureC, 20),
          temperatureQ10: finite(
            options.floodplainNitrificationTemperatureQ10, 2)
        });
      const nitrificationTransferId = transferId(
        'floodplain-nitrification', startDay,
        pending.reach.id, pending.donorCellId,
        nitrificationPlan.reaction
          .dissolvedAmmoniumNitrogenConsumedKgN);
      const nitrificationReaction =
        applyFloodplainNitrificationReaction(
          pending.state.floodplain,
          nitrificationPlan.reaction,
          {
            transferId: nitrificationTransferId,
            reachId: pending.reach.id,
            startDay,
            durationDays,
            livingEnabled
          });
      pending.state.floodplain = nitrificationReaction.state;
      const nitrification = advanceFloodplainNitrification(
        pending.state.floodplainNitrification,
        nitrificationPlan,
        nitrificationReaction.receipt,
        {
          transferId: nitrificationTransferId,
          reachId: pending.reach.id,
          startDay,
          durationDays
        });
      pending.state.floodplainNitrification = nitrification.state;
      pending.state.lastTouchedDay = round(endDay, 8);
      floodplainPlantMatterReceipts.push(matter.receipt);
      floodplainPlantResourcesReceipts.push(resources.receipt);
      floodplainPlantResourceDebitReceipts.push(
        floodplainResourceExchange.debitReceipt);
      floodplainPlantWaterReturnReceipts.push(
        floodplainResourceExchange.returnReceipt);
      floodplainPlantDetritusMatterDebitReceipts.push(
        detritusMatterDebit.receipt);
      floodplainPlantDetritusResourceDebitReceipts.push(
        detritusResourceDebit.receipt);
      floodplainDetritalReturnCreditReceipts.push(
        detritalReturn.receipt);
      floodplainDecompositionReceipts.push(decomposition.receipt);
      floodplainAerobicMineralizationReceipts.push(
        mineralization.receipt);
      floodplainRespirationReceipts.push(respiration.receipt);
      floodplainDenitrificationProcessReceipts.push(
        denitrification.receipt);
      floodplainGasExchangeProcessReceipts.push(gasExchange.receipt);
      floodplainNitrificationReactionReceipts.push(
        nitrificationReaction.receipt);
      floodplainNitrificationProcessReceipts.push(
        nitrification.receipt);
    }
    const preRouteStorage = new Map([...working.reaches.entries()].map(([id, state]) => [id, {
      storageKg: state.storageKg,
      chemistry: normalizeRiverChemistry(state.chemistry),
      sediment: normalizeRiverSediment(state.sediment),
      floodplain: normalizeFloodplainState(state.floodplain),
      floodplainHabitat: normalizeFloodplainHabitatState(
        state.floodplainHabitat),
      floodEvents: normalizeFloodEventHistoryState(state.floodEvents),
      floodplainSuccession: normalizeFloodplainSuccessionState(
        state.floodplainSuccession),
      floodplainPlantMatter: normalizeFloodplainPlantMatterState(
        state.floodplainPlantMatter),
      floodplainPlantResources: normalizeFloodplainPlantResourcesState(
        state.floodplainPlantResources),
      floodplainDecomposition: normalizeFloodplainDecompositionState(
        state.floodplainDecomposition),
      floodplainRespiration: normalizeFloodplainRespirationState(
        state.floodplainRespiration),
      floodplainDenitrification: normalizeFloodplainDenitrificationState(
        state.floodplainDenitrification),
      floodplainNitrification: normalizeFloodplainNitrificationState(
        state.floodplainNitrification),
      floodplainGasExchange: normalizeFloodplainGasExchangeState(
        state.floodplainGasExchange)
    }]));
    const selectedInlets = reaches.length ? selectInlets(reaches, columns[0].resolutionDeg) : new Map();
    const inletReceipts = [];
    const captureTimeDays = clamp(finite(options.captureTimeDays, .55), .02, 20);
    const captureFraction = 1 - Math.exp(-durationDays / captureTimeDays);

    for (const column of columns) {
      if (column.kind !== 'land' || finite(column.routing?.runoffQueueMm) <= 0) continue;
      const reach = selectedInlets.get(column.id);
      if (!reach) continue;
      const areaM2 = earthCellAreaM2(column);
      const queuedBeforeKg = column.routing.runoffQueueMm * areaM2;
      const amountKg = queuedBeforeKg * captureFraction;
      if (amountKg <= 1e-9) continue;
      const id = transferId('basin-inlet', startDay, column.id, reach.id,
        amountKg);
      const runoffBiogeochemistryTransfer =
        debitRunoffBiogeochemistryQueue(
          column.routing.runoffBiogeochemistryQueue,
          amountKg / queuedBeforeKg,
          areaM2,
          {
            transferId: id,
            sourceCellId: column.id,
            destinationId: reach.id,
            destinationKind: 'river-reach'
          }
        );
      const runoffSedimentTransfer = debitRunoffSedimentQueue(
        column.routing.runoffSedimentQueue,
        amountKg / queuedBeforeKg,
        areaM2,
        {
          transferId: id,
          sourceCellId: column.id,
          destinationId: reach.id,
          destinationKind: 'river-reach'
        }
      );
      column.routing.runoffBiogeochemistryQueue =
        runoffBiogeochemistryTransfer.queue;
      column.routing.runoffSedimentQueue = runoffSedimentTransfer.queue;
      const state = ensureReach(working, reach.id, endDay, this.maximumReachStates);
      column.routing.runoffQueueMm -= amountKg / areaM2;
      column.routing.cumulativeRoutedRunoffMm = finite(column.routing.cumulativeRoutedRunoffMm) + amountKg / areaM2;
      column.routing.cumulativeChannelizedRunoffMm = finite(column.routing.cumulativeChannelizedRunoffMm) + amountKg / areaM2;
      column.routing.lastDownstreamReachId = reach.id;
      state.storageKg += amountKg;
      state.cumulativeInflowKg += amountKg;
      state.lastTouchedDay = round(endDay, 8);
      const chemistryInput = applyRunoffBiogeochemistryInput(
        state.chemistry,
        runoffBiogeochemistryTransfer.poolsKg,
        amountKg,
        {
          transferId: id,
          sourceCellId: column.id,
          reachId: reach.id,
          nitrateFraction: finite(
            options.riverRunoffDinNitrateFraction, .5)
        }
      );
      state.chemistry = chemistryInput.state;
      const sedimentInput = applyRunoffSedimentInput(
        state.sediment,
        runoffSedimentTransfer.grainsKg,
        { transferId: id, sourceCellId: column.id, reachId: reach.id }
      );
      state.sediment = sedimentInput.state;
      inletReceipts.push({
        schema: BASIN_INLET_RECEIPT_SCHEMA,
        transferId: id,
        status: 'accepted',
        reason: 'canonical-main-reach-inside-earth-cell',
        sender: {
          schema: 'axm.foundation-planet.basin-inlet-sender/v1',
          earthCellId: column.id,
          debitedKg: round(amountKg, 3),
          queueBeforeKg: round(queuedBeforeKg, 3),
          queueAfterKg: round(column.routing.runoffQueueMm * areaM2, 3)
        },
        receiver: {
          schema: 'axm.foundation-planet.basin-inlet-receiver/v1',
          reachId: reach.id,
          creditedKg: round(amountKg, 3)
        },
        runoffBiogeochemistrySenderDebit:
          runoffBiogeochemistryTransfer.receipt,
        riverChemistryInput: chemistryInput.receipt,
        runoffSedimentSenderDebit: runoffSedimentTransfer.receipt,
        riverSedimentInput: sedimentInput.receipt
      });
    }

    const routeProposals = [];
    const routeReceipts = [];
    const boundaryReceipts = [];
    const oceanColumns = new Map(columns.filter(column => column.kind === 'ocean').map(column => [column.id, column]));

    for (const [reachId, stored] of [...preRouteStorage.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const storedKg = stored.storageKg;
      const storedFloodplain = floodplainTotals(stored.floodplain);
      const storedFloodplainThermal = floodplainThermalSummary(
        stored.floodplainThermal);
      const storedSuccession = floodplainSuccessionSummary(
        stored.floodplainSuccession);
      const storedPlantMatter = floodplainPlantMatterSummary(
        stored.floodplainPlantMatter);
      const storedPlantResources = floodplainPlantResourcesSummary(
        stored.floodplainPlantResources);
      const storedDecomposition = floodplainDecompositionSummary(
        stored.floodplainDecomposition);
      const storedRespiration = floodplainRespirationSummary(
        stored.floodplainRespiration);
      const storedDenitrification = floodplainDenitrificationSummary(
        stored.floodplainDenitrification);
      const storedNitrification = floodplainNitrificationSummary(
        stored.floodplainNitrification);
      const storedGasExchange = floodplainGasExchangeSummary(
        stored.floodplainGasExchange);
      if (storedKg <= 1e-9 && storedFloodplain.waterKg <= 1e-9 &&
        storedFloodplain.totalSedimentKg <= 1e-9 &&
        storedSuccession.totalCoverFraction <= 1e-12 &&
        storedSuccession.totalSeedBankSeedsM2 <= 1e-9 &&
        storedPlantMatter.total.carbonKgC <= 1e-9 &&
        storedPlantMatter.total.nitrogenKgN <= 1e-9 &&
        storedPlantResources.total.phosphorusKgP <= 1e-12 &&
        storedPlantResources.total.liveWaterKg <= 1e-9 &&
        storedFloodplainThermal.observedThermalDays <= 1e-12 &&
        storedFloodplainThermal.dryDays <= 1e-12 &&
        Math.abs(storedFloodplainThermal
          .cumulativeNetAdvectedHeatJ) <= 1e-6 &&
        Math.abs(storedFloodplainThermal.cumulativeBoundaryHeatJ) <=
          1e-6 &&
        storedDecomposition.cumulativeFloodplainReturn.carbonKgC <= 1e-9 &&
        storedDecomposition.cumulativeFloodplainReturn.nitrogenKgN <= 1e-9 &&
        storedDecomposition.cumulativeFloodplainReturn.phosphorusKgP <=
          1e-12 &&
        storedRespiration.observedRespirationDays <= 1e-12 &&
        storedRespiration.dormantDays <= 1e-12 &&
        storedRespiration.oxygenLimitedDays <= 1e-12 &&
        storedRespiration.cumulativeMineralization
          .dissolvedOrganicCarbonConsumedKgC <= 1e-9 &&
        storedRespiration.cumulativeMineralization
          .dissolvedInorganicCarbonProducedKgC <= 1e-9 &&
        storedRespiration.cumulativeMineralization
          .dissolvedOxygenConsumedKgO2 <= 1e-9 &&
        storedDenitrification.observedDenitrificationDays <= 1e-12 &&
        storedDenitrification.dormantDays <= 1e-12 &&
        storedDenitrification.atmosphereUnavailableDays <= 1e-12 &&
        Object.values(storedDenitrification.cumulativeReaction)
          .every(value => value <= 1e-9) &&
        storedNitrification.observedNitrificationDays <= 1e-12 &&
        storedNitrification.dormantDays <= 1e-12 &&
        Object.values(storedNitrification.cumulativeReaction)
          .every(value => value <= 1e-9) &&
        storedGasExchange.observedExchangeDays <= 1e-12 &&
        storedGasExchange.atmosphereUnavailableDays <= 1e-12 &&
        storedGasExchange.cumulativeExchange
          .carbonToAtmosphereKgC <= 1e-9 &&
        storedGasExchange.cumulativeExchange
          .carbonToFloodplainKgC <= 1e-9 &&
        storedGasExchange.cumulativeExchange
          .oxygenToFloodplainKgO2 <= 1e-9) continue;
      const reach = reachById.get(reachId);
      if (!reach) {
        boundaryReceipts.push({
          schema: RIVER_BOUNDARY_RECEIPT_SCHEMA,
          reachId,
          status: 'retained',
          reason: 'reach-not-in-loaded-sector',
          retainedWaterKg: round(storedKg, 3),
          retainedFloodplainWaterKg: round(storedFloodplain.waterKg, 3),
          retainedFloodplainWaterTemperatureC: round(
            storedFloodplainThermal.waterTemperatureC, 9),
          retainedFloodplainTrackedThermalWaterKg: round(
            storedFloodplainThermal.trackedWaterKg, 6),
          retainedFloodplainSensibleHeatJ: round(
            storedFloodplainThermal.sensibleHeatJ, 3),
          retainedFloodplainThermalObservedDays: round(
            storedFloodplainThermal.observedThermalDays, 8),
          retainedFloodplainCumulativeBoundaryHeatJ: round(
            storedFloodplainThermal.cumulativeBoundaryHeatJ, 3),
          retainedFloodplainHabitatObservedDays: round(
            floodplainHabitatSummary(stored.floodplainHabitat)
              .observedDays, 8),
          retainedFloodPulseCount: floodplainHabitatSummary(
            stored.floodplainHabitat).floodPulseCount,
          retainedFloodEventCount: floodEventHistorySummary(
            stored.floodEvents).completedEventCount,
          retainedActiveFloodEvent: floodEventHistorySummary(
            stored.floodEvents).active,
          retainedFloodplainSuccessionCoverFraction: round(
            storedSuccession.totalCoverFraction, 12),
          retainedFloodplainSeedBankSeedsM2: round(
            storedSuccession.totalSeedBankSeedsM2, 9),
          retainedFloodplainDominantGuild:
            storedSuccession.dominantGuild,
          retainedFloodplainPlantCarbonKgC: round(
            storedPlantMatter.total.carbonKgC, 9),
          retainedFloodplainPlantNitrogenKgN: round(
            storedPlantMatter.total.nitrogenKgN, 9),
          retainedFloodplainPlantMatterDominantGuild:
            storedPlantMatter.dominantGuild,
          retainedFloodplainPlantPhosphorusKgP: round(
            storedPlantResources.total.phosphorusKgP, 12),
          retainedFloodplainPlantWaterKg: round(
            storedPlantResources.total.liveWaterKg, 9),
          retainedFloodplainPlantResourcesDominantGuild:
            storedPlantResources.dominantGuild,
          retainedFloodplainDecompositionCarbonReturnedKgC: round(
            storedDecomposition.cumulativeFloodplainReturn.carbonKgC, 9),
          retainedFloodplainDecompositionNitrogenReturnedKgN: round(
            storedDecomposition.cumulativeFloodplainReturn.nitrogenKgN, 9),
          retainedFloodplainDecompositionPhosphorusReturnedKgP: round(
            storedDecomposition.cumulativeFloodplainReturn.phosphorusKgP,
            12),
          retainedFloodplainRespirationObservedDays: round(
            storedRespiration.observedRespirationDays, 8),
          retainedFloodplainRespirationOxygenLimitedDays: round(
            storedRespiration.oxygenLimitedDays, 8),
          retainedFloodplainRespirationDocConsumedKgC: round(
            storedRespiration.cumulativeMineralization
              .dissolvedOrganicCarbonConsumedKgC, 9),
          retainedFloodplainRespirationDicProducedKgC: round(
            storedRespiration.cumulativeMineralization
              .dissolvedInorganicCarbonProducedKgC, 9),
          retainedFloodplainRespirationOxygenConsumedKgO2: round(
            storedRespiration.cumulativeMineralization
              .dissolvedOxygenConsumedKgO2, 9),
          retainedFloodplainDenitrificationObservedDays: round(
            storedDenitrification.observedDenitrificationDays, 8),
          retainedFloodplainDenitrificationCarbonKgC: round(
            storedDenitrification.cumulativeReaction
              .dissolvedOrganicCarbonConsumedKgC, 9),
          retainedFloodplainDenitrificationNitrogenGasKgN: round(
            storedDenitrification.cumulativeReaction
              .nitrogenGasProducedKgN, 9),
          retainedFloodplainNitrificationObservedDays: round(
            storedNitrification.observedNitrificationDays, 8),
          retainedFloodplainNitrificationAmmoniumConsumedKgN: round(
            storedNitrification.cumulativeReaction
              .dissolvedAmmoniumNitrogenConsumedKgN, 9),
          retainedFloodplainNitrificationNitrateProducedKgN: round(
            storedNitrification.cumulativeReaction
              .dissolvedNitrateNitrogenProducedKgN, 9),
          retainedFloodplainNitrificationOxygenConsumedKgO2: round(
            storedNitrification.cumulativeReaction
              .dissolvedOxygenConsumedKgO2, 9),
          retainedFloodplainNitrificationAlkalinityDemandKgCaCO3: round(
            storedNitrification.cumulativeReaction
              .alkalinityDemandKgCaCO3, 9),
          retainedRiverAndFloodplainAlkalinityKgCaCO3Eq: round(
            riverChemistryTotals(stored.chemistry)
              .alkalinityKgCaCO3Eq +
            storedFloodplain.chemistry.alkalinityKgCaCO3Eq, 9),
          retainedFloodplainGasExchangeObservedDays: round(
            storedGasExchange.observedExchangeDays, 8),
          retainedFloodplainGasExchangeAtmosphereUnavailableDays: round(
            storedGasExchange.atmosphereUnavailableDays, 8),
          retainedFloodplainCarbonEvadedKgC: round(
            storedGasExchange.cumulativeExchange
              .carbonToAtmosphereKgC, 9),
          retainedFloodplainCarbonInvadedKgC: round(
            storedGasExchange.cumulativeExchange
              .carbonToFloodplainKgC, 9),
          retainedFloodplainOxygenReaeratedKgO2: round(
            storedGasExchange.cumulativeExchange
              .oxygenToFloodplainKgO2, 9),
          retainedSedimentKg: round(
            riverSedimentTotals(stored.sediment).totalKg +
              storedFloodplain.totalSedimentKg, 9)
        });
        continue;
      }
      if (storedKg <= 1e-9) continue;
      const routedFraction = 1 - Math.exp(-durationDays / reachTravelTimeDays(reach));
      const amountKg = storedKg * routedFraction;
      const chemistry = riverChemistryFraction(stored.chemistry, amountKg / storedKg);
      const sediment = riverSedimentTransportLoad(stored.sediment,
        amountKg / storedKg);
      if (amountKg <= 1e-9) continue;
      if (reach.downstreamReachId && reachById.has(reach.downstreamReachId)) {
        routeProposals.push({ kind: 'reach-to-reach', sourceReachId: reachId, destinationReachId: reach.downstreamReachId, amountKg, chemistry, sediment });
        continue;
      }
      if (reach.reachesOcean) {
        const oceanCellId = earthCellIdentity(reach.canonicalTo.lat, reach.canonicalTo.lon, {
          resolutionDeg: columns[0].resolutionDeg
        }).id;
        if (oceanColumns.has(oceanCellId)) {
          routeProposals.push({ kind: 'ocean-mouth', sourceReachId: reachId, destinationCellId: oceanCellId, amountKg, chemistry, sediment });
        } else {
          boundaryReceipts.push({
            schema: RIVER_BOUNDARY_RECEIPT_SCHEMA,
            reachId,
            downstreamReachId: null,
            oceanCellId,
            status: 'retained',
            reason: 'ocean-mouth-cell-not-loaded',
            retainedWaterKg: round(storedKg, 3),
            retainedFloodplainWaterKg: round(storedFloodplain.waterKg, 3),
            retainedFloodplainWaterTemperatureC: round(
              storedFloodplainThermal.waterTemperatureC, 9),
            retainedFloodplainTrackedThermalWaterKg: round(
              storedFloodplainThermal.trackedWaterKg, 6),
            retainedFloodplainSensibleHeatJ: round(
              storedFloodplainThermal.sensibleHeatJ, 3),
            retainedFloodplainThermalObservedDays: round(
              storedFloodplainThermal.observedThermalDays, 8),
            retainedFloodplainCumulativeBoundaryHeatJ: round(
              storedFloodplainThermal.cumulativeBoundaryHeatJ, 3),
            retainedFloodplainPlantCarbonKgC: round(
              storedPlantMatter.total.carbonKgC, 9),
            retainedFloodplainPlantNitrogenKgN: round(
              storedPlantMatter.total.nitrogenKgN, 9),
            retainedFloodplainPlantMatterDominantGuild:
              storedPlantMatter.dominantGuild,
            retainedFloodplainPlantPhosphorusKgP: round(
              storedPlantResources.total.phosphorusKgP, 12),
            retainedFloodplainPlantWaterKg: round(
              storedPlantResources.total.liveWaterKg, 9),
            retainedFloodplainPlantResourcesDominantGuild:
              storedPlantResources.dominantGuild,
            retainedFloodplainDecompositionCarbonReturnedKgC: round(
              storedDecomposition.cumulativeFloodplainReturn.carbonKgC, 9),
            retainedFloodplainDecompositionNitrogenReturnedKgN: round(
              storedDecomposition.cumulativeFloodplainReturn.nitrogenKgN,
              9),
            retainedFloodplainDecompositionPhosphorusReturnedKgP: round(
              storedDecomposition.cumulativeFloodplainReturn.phosphorusKgP,
              12),
            retainedSedimentKg: round(
              riverSedimentTotals(stored.sediment).totalKg +
                storedFloodplain.totalSedimentKg, 9)
          });
        }
        continue;
      }
      boundaryReceipts.push({
        schema: RIVER_BOUNDARY_RECEIPT_SCHEMA,
        reachId,
        downstreamReachId: reach.downstreamReachId || null,
        status: 'retained',
        reason: reach.downstreamReachId ? 'downstream-reach-not-loaded' : 'no-canonical-downstream',
        retainedWaterKg: round(storedKg, 3),
        retainedFloodplainWaterKg: round(storedFloodplain.waterKg, 3),
        retainedFloodplainWaterTemperatureC: round(
          storedFloodplainThermal.waterTemperatureC, 9),
        retainedFloodplainTrackedThermalWaterKg: round(
          storedFloodplainThermal.trackedWaterKg, 6),
        retainedFloodplainSensibleHeatJ: round(
          storedFloodplainThermal.sensibleHeatJ, 3),
        retainedFloodplainThermalObservedDays: round(
          storedFloodplainThermal.observedThermalDays, 8),
        retainedFloodplainCumulativeBoundaryHeatJ: round(
          storedFloodplainThermal.cumulativeBoundaryHeatJ, 3),
        retainedFloodplainPlantCarbonKgC: round(
          storedPlantMatter.total.carbonKgC, 9),
        retainedFloodplainPlantNitrogenKgN: round(
          storedPlantMatter.total.nitrogenKgN, 9),
        retainedFloodplainPlantMatterDominantGuild:
          storedPlantMatter.dominantGuild,
        retainedFloodplainPlantPhosphorusKgP: round(
          storedPlantResources.total.phosphorusKgP, 12),
        retainedFloodplainPlantWaterKg: round(
          storedPlantResources.total.liveWaterKg, 9),
        retainedFloodplainPlantResourcesDominantGuild:
          storedPlantResources.dominantGuild,
        retainedFloodplainDecompositionCarbonReturnedKgC: round(
          storedDecomposition.cumulativeFloodplainReturn.carbonKgC, 9),
        retainedFloodplainDecompositionNitrogenReturnedKgN: round(
          storedDecomposition.cumulativeFloodplainReturn.nitrogenKgN, 9),
        retainedFloodplainDecompositionPhosphorusReturnedKgP: round(
          storedDecomposition.cumulativeFloodplainReturn.phosphorusKgP,
          12),
        retainedSedimentKg: round(
          riverSedimentTotals(stored.sediment).totalKg +
            storedFloodplain.totalSedimentKg, 9)
      });
    }

    let deliveredToOceanKg = 0;
    let reachToReachKg = 0;
    const oceanEcologyBoundaryInputs = {
      carbonKgC: 0,
      nitrogenKgN: 0,
      phosphorusKgP: 0,
      oxygenKgO2: 0,
      alkalinityKgCaCO3Eq: 0
    };
    const estuaryBoundaryFluxes = {
      denitrifiedNitrogenKgN: 0,
      oxygenConsumptionKgO2: 0,
      alkalinityGeneratedKgCaCO3Eq: 0
    };
    const estuaryRiverInputs = {
      carbonKgC: 0,
      nitrogenKgN: 0,
      phosphorusKgP: 0,
      oxygenKgO2: 0,
      alkalinityKgCaCO3Eq: 0
    };
    const estuaryRiverNitrogenSpecies = {
      nitrateNitrogenKgN: 0,
      ammoniumNitrogenKgN: 0
    };
    const coastalSedimentInputs = {
      clay: 0, silt: 0, sand: 0, gravel: 0
    };
    const riverBedDeposits = {
      clay: 0, silt: 0, sand: 0, gravel: 0
    };
    for (const proposal of routeProposals) {
      const source = ensureReach(working, proposal.sourceReachId, endDay, this.maximumReachStates);
      const destinationId = proposal.kind === 'reach-to-reach'
        ? proposal.destinationReachId : proposal.destinationCellId;
      const id = transferId(proposal.kind === 'reach-to-reach'
        ? 'river-reach' : 'ocean-mouth', startDay,
      proposal.sourceReachId, destinationId, proposal.amountKg);
      const sourceReach = reachById.get(proposal.sourceReachId);
      const sedimentRoute = routeRiverSedimentLoad(
        source.sediment,
        proposal.sediment,
        {
          transferId: id,
          sourceReachId: proposal.sourceReachId,
          destinationId,
          destinationKind: proposal.kind === 'reach-to-reach'
            ? 'river-reach' : 'coastal-ocean',
          residenceDays: reachTravelTimeDays(sourceReach),
          slope: sourceReach?.slope,
          dischargeM3s: sourceReach?.currentDischargeM3s ||
            sourceReach?.dischargeM3s
        }
      );
      source.sediment = sedimentRoute.state;
      for (const grain of Object.keys(riverBedDeposits)) {
        riverBedDeposits[grain] += sedimentRoute.depositedKg[grain];
      }
      source.storageKg -= proposal.amountKg;
      source.chemistry = subtractRiverChemistry(source.chemistry, proposal.chemistry);
      source.cumulativeOutflowKg += proposal.amountKg;
      source.lastTouchedDay = round(endDay, 8);
      if (proposal.kind === 'reach-to-reach') {
        const receiver = ensureReach(working, proposal.destinationReachId, endDay, this.maximumReachStates);
        receiver.storageKg += proposal.amountKg;
        receiver.chemistry = addRiverChemistry(receiver.chemistry, proposal.chemistry);
        const sedimentCredit = creditRiverSediment(
          receiver.sediment,
          sedimentRoute.exportedKg,
          {
            transferId: id,
            sourceCellId: proposal.sourceReachId,
            reachId: proposal.destinationReachId
          }
        );
        receiver.sediment = sedimentCredit.state;
        receiver.cumulativeInflowKg += proposal.amountKg;
        receiver.lastTouchedDay = round(endDay, 8);
        reachToReachKg += proposal.amountKg;
        routeReceipts.push({
          schema: RIVER_REACH_TRANSFER_SCHEMA,
          transferId: id,
          status: 'routed',
          sourceReachId: proposal.sourceReachId,
          destinationReachId: proposal.destinationReachId,
          routedWaterKg: round(proposal.amountKg, 3),
          chemistryTransfer: {
            pools: Object.fromEntries(Object.entries(proposal.chemistry)
              .map(([key, value]) => [key, round(value, 9)])),
            elements: Object.fromEntries(Object.entries(chemistryElementInputs(proposal.chemistry))
              .map(([key, value]) => [key, round(value, 9)])),
            senderDebited: true,
            receiverCredited: true
          },
          sedimentTransfer: {
            senderDebitAndDeposition: sedimentRoute.receipt,
            receiverCredit: sedimentCredit.receipt,
            exportedKg: Object.fromEntries(Object.entries(
              sedimentRoute.exportedKg).map(([key, value]) =>
              [key, round(value, 9)])),
            senderDebited: true,
            receiverCredited: true
          },
          simultaneous: true
        });
      } else {
        const ocean = oceanColumns.get(proposal.destinationCellId);
        addOceanFreshwater(ocean, proposal.amountKg);
        const mouthReach = reachById.get(proposal.sourceReachId);
        const estuaryResult = processEstuaryInflow(source.estuary, proposal.chemistry, {
          waterKg: proposal.amountKg,
          residenceDays: reachTravelTimeDays(mouthReach) * .65,
          temperatureC: finite(ocean.surface?.temperatureC,
            finite(ocean.ocean?.surfaceTemperatureC, 15))
        });
        source.estuary = estuaryResult.state;
        const estuaryInputElements = chemistryElementInputs(proposal.chemistry);
        const estuaryInputNitrogenSpecies = riverNitrogenSpecies(
          proposal.chemistry);
        for (const key of Object.keys(estuaryRiverInputs)) {
          estuaryRiverInputs[key] += finite(estuaryInputElements[key]);
        }
        estuaryRiverNitrogenSpecies.nitrateNitrogenKgN += finite(
          estuaryInputNitrogenSpecies.dissolvedNitrateNitrogenKgN);
        estuaryRiverNitrogenSpecies.ammoniumNitrogenKgN += finite(
          estuaryInputNitrogenSpecies.dissolvedAmmoniumNitrogenKgN);
        estuaryBoundaryFluxes.denitrifiedNitrogenKgN += finite(
          estuaryResult.receipt.transformations.denitrifiedNitrogenKgN);
        estuaryBoundaryFluxes.oxygenConsumptionKgO2 += finite(
          estuaryResult.receipt.transformations.oxygenConsumedKgO2);
        estuaryBoundaryFluxes.alkalinityGeneratedKgCaCO3Eq += finite(
          estuaryResult.receipt.transformations
            .alkalinityGeneratedKgCaCO3Eq);
        const atmosphereNitrogenInput = applyAtmosphereGasBoundaryInput(
          ocean.atmosphere.biogeochemistry,
          { nitrogenKgN: estuaryResult.receipt.transformations.denitrifiedNitrogenKgN },
          earthCellAreaM2(ocean),
          {
            sourceKind: 'estuary-denitrification',
            pressureColumn: ocean.atmosphere.pressureColumn
          }
        );
        ocean.atmosphere.biogeochemistry = atmosphereNitrogenInput.state;
        const oceanEcologyInput = applyRiverBiogeochemistryInput(
          ocean.ocean.ecology,
          proposal.amountKg,
          earthCellAreaM2(ocean),
          { ocean: ocean.ocean, explicitInputsKg: estuaryResult.transmitted,
            transferId: id }
        );
        ocean.ocean.ecology = oceanEcologyInput.state;
        for (const key of Object.keys(oceanEcologyBoundaryInputs)) {
          oceanEcologyBoundaryInputs[key] += finite(
            oceanEcologyInput.receipt.inputs[key]);
        }
        deliveredToOceanKg += proposal.amountKg;
        const coastalSedimentInput = creditCoastalSediment(
          ocean.ocean.coastalSediment,
          sedimentRoute.exportedKg,
          earthCellAreaM2(ocean),
          {
            transferId: id,
            sourceId: proposal.sourceReachId,
            destinationCellId: proposal.destinationCellId
          }
        );
        ocean.ocean.coastalSediment = coastalSedimentInput.state;
        for (const grain of Object.keys(coastalSedimentInputs)) {
          coastalSedimentInputs[grain] += sedimentRoute.exportedKg[grain];
        }
        routeReceipts.push({
          schema: OCEAN_MOUTH_RECEIPT_SCHEMA,
          transferId: id,
          status: 'delivered',
          sourceReachId: proposal.sourceReachId,
          destinationCellId: proposal.destinationCellId,
          deliveredFreshwaterKg: round(proposal.amountKg, 3),
          riverChemistrySenderDebit: {
            pools: Object.fromEntries(Object.entries(proposal.chemistry)
              .map(([key, value]) => [key, round(value, 9)])),
            elements: Object.fromEntries(Object.entries(chemistryElementInputs(proposal.chemistry))
              .map(([key, value]) => [key, round(value, 9)])),
            senderDebited: true
          },
          estuaryTransformation: estuaryResult.receipt,
          atmosphereNitrogenBoundaryInput: atmosphereNitrogenInput.receipt,
          oceanEcologyBoundaryInput: oceanEcologyInput.receipt,
          riverSedimentSenderDebitAndDeposition: sedimentRoute.receipt,
          coastalSedimentReceiverCredit: coastalSedimentInput.receipt,
          simultaneous: true
        });
      }
    }

    for (const column of columns) {
      roundColumnRouting(column);
      if (column.ocean) {
        column.ocean.freshwaterAnomalyMm = round(column.ocean.freshwaterAnomalyMm, 15);
        column.ocean.salinityPsu = round(column.ocean.salinityPsu, 15);
      }
    }
    for (const state of working.reaches.values()) {
      state.storageKg = round(Math.max(0, state.storageKg), 6);
      state.cumulativeInflowKg = round(Math.max(0, state.cumulativeInflowKg), 6);
      state.cumulativeOutflowKg = round(Math.max(0, state.cumulativeOutflowKg), 6);
      state.chemistry = normalizeRiverChemistry(state.chemistry);
      state.sediment = normalizeRiverSediment(state.sediment);
      state.floodplain = normalizeFloodplainState(state.floodplain);
      state.floodplainThermal = normalizeFloodplainThermalState(
        state.floodplainThermal);
      state.floodplainPlantMatter = normalizeFloodplainPlantMatterState(
        state.floodplainPlantMatter);
      state.floodplainPlantResources =
        normalizeFloodplainPlantResourcesState(
          state.floodplainPlantResources);
      state.estuary = normalizeEstuaryState(state.estuary);
      for (const pool of [
        'dissolvedInorganicCarbonKgC', 'dissolvedOrganicCarbonKgC',
        'dissolvedInorganicNitrogenKgN', 'dissolvedInorganicPhosphorusKgP',
        'dissolvedOxygenKgO2', 'alkalinityKgCaCO3Eq'
      ]) state.chemistry[pool] = round(Math.max(0, state.chemistry[pool]), 9);
    }
    working.lastDay = round(endDay, 8);
    const finalEarth = earthWaterMass(columns);
    const finalRunoffBiogeochemistry =
      earthRunoffBiogeochemistryMass(columns);
    const finalRunoffSediment = earthRunoffSedimentMass(columns);
    const finalCoastalSediment = coastalSedimentMass(columns);
    const finalOceanEcology = oceanEcologyMass(columns);
    const finalAtmosphereNitrogenGasKgN = atmosphereNitrogenGasMass(columns);
    const finalLoadedLandLiveBiomass = loadedLandLiveBiomass(columns);
    const finalRiverStorageKg = profileStorageKg(working);
    const finalRiverChemistry = profileChemistry(working);
    const finalRiverNitrogenSpecies = profileNitrogenSpecies(working);
    const finalRiverSediment = profileSediment(working);
    const finalFloodplain = profileFloodplain(working);
    const finalFloodplainThermal = profileFloodplainThermal(working);
    const finalFloodplainHabitat = profileFloodplainHabitat(working);
    const finalFloodEvents = profileFloodEvents(working);
    const finalFloodplainSuccession =
      profileFloodplainSuccession(working);
    const finalFloodplainPlantMatter =
      profileFloodplainPlantMatter(working);
    const finalFloodplainPlantResources =
      profileFloodplainPlantResources(working);
    const finalFloodplainDecomposition =
      profileFloodplainDecomposition(working);
    const finalFloodplainRespiration =
      profileFloodplainRespiration(working);
    const finalFloodplainDenitrification =
      profileFloodplainDenitrification(working);
    const finalFloodplainNitrification =
      profileFloodplainNitrification(working);
    const finalFloodplainGasExchange =
      profileFloodplainGasExchange(working);
    const finalEstuaryStorage = profileEstuaryStorage(working);
    const landRunoffBiogeochemistryInputs = {
      carbonKgC: inletReceipts.reduce((sum, receipt) => sum +
        finite(receipt.riverChemistryInput?.inputs?.carbonKgC), 0),
      nitrogenKgN: inletReceipts.reduce((sum, receipt) => sum +
        finite(receipt.riverChemistryInput?.inputs?.nitrogenKgN), 0),
      phosphorusKgP: inletReceipts.reduce((sum, receipt) => sum +
        finite(receipt.riverChemistryInput?.inputs?.phosphorusKgP), 0),
      oxygenKgO2: inletReceipts.reduce((sum, receipt) => sum +
        finite(receipt.riverChemistryInput?.inputs?.oxygenKgO2), 0),
      alkalinityKgCaCO3Eq: inletReceipts.reduce((sum, receipt) => sum +
        finite(receipt.riverChemistryInput?.inputs
          ?.alkalinityKgCaCO3Eq), 0)
    };
    const landRunoffNitrogenSpeciesInputs = {
      nitrateNitrogenKgN: inletReceipts.reduce((sum, receipt) => sum +
        finite(receipt.riverChemistryInput?.nitrogenSpeciation
          ?.nitrateNitrogenKgN), 0),
      ammoniumNitrogenKgN: inletReceipts.reduce((sum, receipt) => sum +
        finite(receipt.riverChemistryInput?.nitrogenSpeciation
          ?.ammoniumNitrogenKgN), 0)
    };
    const detritalReturnInputs = {
      carbonKgC: floodplainDetritalReturnCreditReceipts.reduce((sum,
        receipt) => sum + finite(receipt.credited?.carbonKgC), 0),
      nitrogenKgN: floodplainDetritalReturnCreditReceipts.reduce((sum,
        receipt) => sum + finite(receipt.credited?.nitrogenKgN), 0),
      phosphorusKgP: floodplainDetritalReturnCreditReceipts.reduce((sum,
        receipt) => sum + finite(receipt.credited?.phosphorusKgP), 0)
    };
    const floodplainRespirationFluxes = {
      dissolvedOrganicCarbonConsumedKgC:
        floodplainAerobicMineralizationReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.dissolvedOrganicCarbonConsumedKgC), 0),
      dissolvedInorganicCarbonProducedKgC:
        floodplainAerobicMineralizationReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.dissolvedInorganicCarbonProducedKgC), 0),
      dissolvedOxygenConsumedKgO2:
        floodplainAerobicMineralizationReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.dissolvedOxygenConsumedKgO2), 0)
    };
    const floodplainDenitrificationFluxes = {
      dissolvedOrganicCarbonConsumedKgC:
        floodplainDenitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.dissolvedOrganicCarbonConsumedKgC), 0),
      dissolvedInorganicCarbonProducedKgC:
        floodplainDenitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.dissolvedInorganicCarbonProducedKgC), 0),
      dissolvedNitrateNitrogenConsumedKgN:
        floodplainDenitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.dissolvedNitrateNitrogenConsumedKgN), 0),
      nitrogenGasProducedKgN:
        floodplainDenitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction?.nitrogenGasProducedKgN), 0),
      alkalinityGeneratedKgCaCO3Eq:
        floodplainDenitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.alkalinityGeneratedKgCaCO3Eq), 0)
    };
    const floodplainNitrificationFluxes = {
      dissolvedAmmoniumNitrogenConsumedKgN:
        floodplainNitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.dissolvedAmmoniumNitrogenConsumedKgN), 0),
      dissolvedNitrateNitrogenProducedKgN:
        floodplainNitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.dissolvedNitrateNitrogenProducedKgN), 0),
      dissolvedOxygenConsumedKgO2:
        floodplainNitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.dissolvedOxygenConsumedKgO2), 0),
      alkalinityDemandKgCaCO3:
        floodplainNitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.reaction
            ?.alkalinityDemandKgCaCO3), 0)
    };
    const floodplainGasExchangeFluxes = {
      carbonToAtmosphereKgC: floodplainGasExchangeReceipts.reduce(
        (sum, receipt) => sum + finite(
          receipt.exchange?.carbonToAtmosphereKgC), 0),
      carbonToFloodplainKgC: floodplainGasExchangeReceipts.reduce(
        (sum, receipt) => sum + finite(
          receipt.exchange?.carbonToFloodplainKgC), 0),
      oxygenToFloodplainKgO2: floodplainGasExchangeReceipts.reduce(
        (sum, receipt) => sum + finite(
          receipt.exchange?.oxygenToFloodplainKgO2), 0)
    };
    const landRunoffSedimentInputs = Object.fromEntries(
      ['clay', 'silt', 'sand', 'gravel'].map(grain => [grain,
        inletReceipts.reduce((sum, receipt) => sum +
          finite(receipt.riverSedimentInput?.inputKg?.[grain]), 0)]));
    const waterResidualKg = finalEarth.runoffQueueKg +
      finalEarth.oceanFreshwaterKg + finalRiverStorageKg +
      finalFloodplainPlantResources.total.liveWaterKg -
      initialEarth.runoffQueueKg - initialEarth.oceanFreshwaterKg -
      initialRiverStorageKg -
      initialFloodplainPlantResources.total.liveWaterKg;
    const oceanEcologyResiduals = {
      carbonResidualKgC: finalOceanEcology.carbonKgC -
        initialOceanEcology.carbonKgC - oceanEcologyBoundaryInputs.carbonKgC,
      nitrogenResidualKgN: finalOceanEcology.nitrogenKgN -
        initialOceanEcology.nitrogenKgN - oceanEcologyBoundaryInputs.nitrogenKgN,
      phosphorusResidualKgP: finalOceanEcology.phosphorusKgP -
        initialOceanEcology.phosphorusKgP - oceanEcologyBoundaryInputs.phosphorusKgP,
      oxygenResidualKgO2: finalOceanEcology.oxygenKgO2 -
        initialOceanEcology.oxygenKgO2 - oceanEcologyBoundaryInputs.oxygenKgO2,
      alkalinityResidualKgCaCO3Eq:
        finalOceanEcology.alkalinityKgCaCO3Eq -
        initialOceanEcology.alkalinityKgCaCO3Eq -
        oceanEcologyBoundaryInputs.alkalinityKgCaCO3Eq
    };
    const riverChemistryResiduals = {
      riverCarbonResidualKgC: finalRiverChemistry.carbonKgC -
        initialRiverChemistry.carbonKgC - landRunoffBiogeochemistryInputs.carbonKgC -
        detritalReturnInputs.carbonKgC +
        estuaryRiverInputs.carbonKgC +
        floodplainGasExchangeFluxes.carbonToAtmosphereKgC -
        floodplainGasExchangeFluxes.carbonToFloodplainKgC,
      riverNitrogenResidualKgN: finalRiverChemistry.nitrogenKgN -
        initialRiverChemistry.nitrogenKgN - landRunoffBiogeochemistryInputs.nitrogenKgN -
        detritalReturnInputs.nitrogenKgN +
        estuaryRiverInputs.nitrogenKgN +
        floodplainDenitrificationFluxes
          .dissolvedNitrateNitrogenConsumedKgN,
      riverPhosphorusResidualKgP: finalRiverChemistry.phosphorusKgP -
        initialRiverChemistry.phosphorusKgP - landRunoffBiogeochemistryInputs.phosphorusKgP -
        detritalReturnInputs.phosphorusKgP +
        estuaryRiverInputs.phosphorusKgP,
      riverOxygenResidualKgO2: finalRiverChemistry.oxygenKgO2 -
        initialRiverChemistry.oxygenKgO2 - landRunoffBiogeochemistryInputs.oxygenKgO2 +
        estuaryRiverInputs.oxygenKgO2 +
        floodplainRespirationFluxes.dissolvedOxygenConsumedKgO2 +
        floodplainNitrificationFluxes.dissolvedOxygenConsumedKgO2 -
        floodplainGasExchangeFluxes.oxygenToFloodplainKgO2,
      riverAlkalinityResidualKgCaCO3Eq:
        finalRiverChemistry.alkalinityKgCaCO3Eq -
        initialRiverChemistry.alkalinityKgCaCO3Eq -
        landRunoffBiogeochemistryInputs.alkalinityKgCaCO3Eq +
        estuaryRiverInputs.alkalinityKgCaCO3Eq +
        floodplainNitrificationFluxes.alkalinityDemandKgCaCO3 -
        floodplainDenitrificationFluxes.alkalinityGeneratedKgCaCO3Eq
    };
    const riverNitrogenSpeciesResiduals = {
      riverNitrateNitrogenResidualKgN:
        finalRiverNitrogenSpecies.nitrateNitrogenKgN -
        initialRiverNitrogenSpecies.nitrateNitrogenKgN -
        landRunoffNitrogenSpeciesInputs.nitrateNitrogenKgN +
        estuaryRiverNitrogenSpecies.nitrateNitrogenKgN +
        floodplainDenitrificationFluxes
          .dissolvedNitrateNitrogenConsumedKgN -
        floodplainNitrificationFluxes
          .dissolvedNitrateNitrogenProducedKgN,
      riverAmmoniumNitrogenResidualKgN:
        finalRiverNitrogenSpecies.ammoniumNitrogenKgN -
        initialRiverNitrogenSpecies.ammoniumNitrogenKgN -
        landRunoffNitrogenSpeciesInputs.ammoniumNitrogenKgN -
        detritalReturnInputs.nitrogenKgN +
        estuaryRiverNitrogenSpecies.ammoniumNitrogenKgN +
        floodplainNitrificationFluxes
          .dissolvedAmmoniumNitrogenConsumedKgN,
      riverDinCompatibilityResidualKgN:
        finalRiverNitrogenSpecies.dissolvedInorganicNitrogenKgN -
        finalRiverNitrogenSpecies.nitrateNitrogenKgN -
        finalRiverNitrogenSpecies.ammoniumNitrogenKgN
    };
    const runoffBiogeochemistryResiduals = {
      runoffCarbonResidualKgC: finalRunoffBiogeochemistry.carbonKgC -
        initialRunoffBiogeochemistry.carbonKgC +
        landRunoffBiogeochemistryInputs.carbonKgC,
      runoffNitrogenResidualKgN: finalRunoffBiogeochemistry.nitrogenKgN -
        initialRunoffBiogeochemistry.nitrogenKgN +
        landRunoffBiogeochemistryInputs.nitrogenKgN,
      runoffPhosphorusResidualKgP: finalRunoffBiogeochemistry.phosphorusKgP -
        initialRunoffBiogeochemistry.phosphorusKgP +
        landRunoffBiogeochemistryInputs.phosphorusKgP,
      runoffOxygenResidualKgO2: finalRunoffBiogeochemistry.oxygenKgO2 -
        initialRunoffBiogeochemistry.oxygenKgO2 +
        landRunoffBiogeochemistryInputs.oxygenKgO2,
      runoffAlkalinityResidualKgCaCO3Eq:
        finalRunoffBiogeochemistry.alkalinityKgCaCO3Eq -
        initialRunoffBiogeochemistry.alkalinityKgCaCO3Eq +
        landRunoffBiogeochemistryInputs.alkalinityKgCaCO3Eq
    };
    const estuaryResiduals = {
      estuaryCarbonResidualKgC: finalEstuaryStorage.carbonKgC -
        initialEstuaryStorage.carbonKgC - estuaryRiverInputs.carbonKgC +
        oceanEcologyBoundaryInputs.carbonKgC,
      estuaryNitrogenResidualKgN: finalEstuaryStorage.nitrogenKgN -
        initialEstuaryStorage.nitrogenKgN - estuaryRiverInputs.nitrogenKgN +
        oceanEcologyBoundaryInputs.nitrogenKgN +
        estuaryBoundaryFluxes.denitrifiedNitrogenKgN,
      estuaryPhosphorusResidualKgP: finalEstuaryStorage.phosphorusKgP -
        initialEstuaryStorage.phosphorusKgP - estuaryRiverInputs.phosphorusKgP +
        oceanEcologyBoundaryInputs.phosphorusKgP,
      estuaryOxygenResidualKgO2: -estuaryRiverInputs.oxygenKgO2 +
        oceanEcologyBoundaryInputs.oxygenKgO2 +
        estuaryBoundaryFluxes.oxygenConsumptionKgO2,
      estuaryAlkalinityResidualKgCaCO3Eq:
        -estuaryRiverInputs.alkalinityKgCaCO3Eq +
        oceanEcologyBoundaryInputs.alkalinityKgCaCO3Eq -
        estuaryBoundaryFluxes.alkalinityGeneratedKgCaCO3Eq
    };
    const coupledChemistryResiduals = {
      coupledCarbonResidualKgC: finalRunoffBiogeochemistry.carbonKgC +
        finalRiverChemistry.carbonKgC + finalOceanEcology.carbonKgC +
        finalEstuaryStorage.carbonKgC - initialRiverChemistry.carbonKgC -
        initialRunoffBiogeochemistry.carbonKgC - initialOceanEcology.carbonKgC -
        initialEstuaryStorage.carbonKgC - detritalReturnInputs.carbonKgC +
        floodplainGasExchangeFluxes.carbonToAtmosphereKgC -
        floodplainGasExchangeFluxes.carbonToFloodplainKgC,
      coupledNitrogenResidualKgN: finalRunoffBiogeochemistry.nitrogenKgN +
        finalRiverChemistry.nitrogenKgN + finalOceanEcology.nitrogenKgN +
        finalEstuaryStorage.nitrogenKgN + finalAtmosphereNitrogenGasKgN -
        initialRunoffBiogeochemistry.nitrogenKgN - initialRiverChemistry.nitrogenKgN -
        initialOceanEcology.nitrogenKgN - initialEstuaryStorage.nitrogenKgN -
        initialAtmosphereNitrogenGasKgN - detritalReturnInputs.nitrogenKgN,
      coupledPhosphorusResidualKgP: finalRunoffBiogeochemistry.phosphorusKgP +
        finalRiverChemistry.phosphorusKgP + finalOceanEcology.phosphorusKgP +
        finalEstuaryStorage.phosphorusKgP +
        finalFloodplainPlantResources.total.phosphorusKgP -
        initialRiverChemistry.phosphorusKgP -
        initialRunoffBiogeochemistry.phosphorusKgP - initialOceanEcology.phosphorusKgP -
        initialEstuaryStorage.phosphorusKgP -
        initialFloodplainPlantResources.total.phosphorusKgP,
      coupledOxygenResidualKgO2: finalRunoffBiogeochemistry.oxygenKgO2 +
        finalRiverChemistry.oxygenKgO2 + finalOceanEcology.oxygenKgO2 -
        initialRunoffBiogeochemistry.oxygenKgO2 - initialRiverChemistry.oxygenKgO2 -
        initialOceanEcology.oxygenKgO2 + estuaryBoundaryFluxes.oxygenConsumptionKgO2 +
        floodplainRespirationFluxes.dissolvedOxygenConsumedKgO2 +
        floodplainNitrificationFluxes.dissolvedOxygenConsumedKgO2 -
        floodplainGasExchangeFluxes.oxygenToFloodplainKgO2,
      coupledAlkalinityResidualKgCaCO3Eq:
        finalRunoffBiogeochemistry.alkalinityKgCaCO3Eq +
        finalRiverChemistry.alkalinityKgCaCO3Eq +
        finalOceanEcology.alkalinityKgCaCO3Eq -
        initialRunoffBiogeochemistry.alkalinityKgCaCO3Eq -
        initialRiverChemistry.alkalinityKgCaCO3Eq -
        initialOceanEcology.alkalinityKgCaCO3Eq +
        floodplainNitrificationFluxes.alkalinityDemandKgCaCO3 -
        floodplainDenitrificationFluxes.alkalinityGeneratedKgCaCO3Eq -
        estuaryBoundaryFluxes.alkalinityGeneratedKgCaCO3Eq
    };
    const coupledPlantMatterResiduals = {
      loadedLandFloodplainPlantCarbonResidualKgC:
        finalLoadedLandLiveBiomass.carbonKgC +
        finalFloodplainPlantMatter.total.carbonKgC -
        initialLoadedLandLiveBiomass.carbonKgC -
        initialFloodplainPlantMatter.total.carbonKgC +
        detritalReturnInputs.carbonKgC,
      loadedLandFloodplainPlantNitrogenResidualKgN:
        finalLoadedLandLiveBiomass.nitrogenKgN +
        finalFloodplainPlantMatter.total.nitrogenKgN -
        initialLoadedLandLiveBiomass.nitrogenKgN -
        initialFloodplainPlantMatter.total.nitrogenKgN +
        detritalReturnInputs.nitrogenKgN
    };
    const plantResourceResiduals = {
      plantResourceWaterResidualKg: waterResidualKg,
      plantResourcePhosphorusResidualKgP:
        coupledChemistryResiduals.coupledPhosphorusResidualKgP
    };
    const decompositionResiduals = {
      detritalReturnCarbonResidualKgC:
        floodplainPlantDetritusMatterDebitReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.debited?.carbonKgC), 0) -
        detritalReturnInputs.carbonKgC,
      detritalReturnNitrogenResidualKgN:
        floodplainPlantDetritusMatterDebitReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.debited?.nitrogenKgN), 0) -
        detritalReturnInputs.nitrogenKgN,
      detritalReturnPhosphorusResidualKgP:
        floodplainPlantDetritusResourceDebitReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.debited?.phosphorusKgP), 0) -
        detritalReturnInputs.phosphorusKgP,
      detritalSupportedCarbonReferenceResidualKgC:
        floodplainPlantDetritusMatterDebitReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.debited?.carbonKgC), 0) -
        floodplainPlantDetritusResourceDebitReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.debited?.supportedCarbonKgC), 0)
    };
    const respirationResiduals = {
      floodplainDocToDicCarbonResidualKgC:
        floodplainRespirationFluxes.dissolvedOrganicCarbonConsumedKgC -
        floodplainRespirationFluxes.dissolvedInorganicCarbonProducedKgC,
      floodplainOxygenConsumptionResidualKgO2:
        floodplainAerobicMineralizationReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.closure
            ?.dissolvedOxygenDebitResidualKgO2), 0),
      floodplainOxygenStoichiometryResidualKgO2:
        floodplainAerobicMineralizationReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.closure
            ?.stoichiometricOxygenResidualKgO2), 0)
    };
    const denitrificationResiduals = {
      floodplainDenitrificationCarbonResidualKgC:
        floodplainDenitrificationFluxes
          .dissolvedOrganicCarbonConsumedKgC -
        floodplainDenitrificationFluxes
          .dissolvedInorganicCarbonProducedKgC,
      floodplainDenitrificationNitrogenReactionResidualKgN:
        floodplainDenitrificationFluxes
          .dissolvedNitrateNitrogenConsumedKgN -
        floodplainDenitrificationFluxes.nitrogenGasProducedKgN,
      floodplainAtmosphereDenitrificationTransferResidualKgN:
        floodplainDenitrificationFluxes.nitrogenGasProducedKgN -
        atmosphereFloodplainDenitrificationReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.inputs?.nitrogenKgN), 0),
      floodplainDenitrificationOwnerResidualKgN:
        floodplainDenitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.closure?.nitrogenResidualKgN), 0),
      atmosphereDenitrificationOwnerResidualKgN:
        atmosphereFloodplainDenitrificationReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.conservation?.nitrogenResidualKgN), 0),
      floodplainDenitrificationAlkalinityOwnerResidualKgCaCO3Eq:
        floodplainDenitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.closure
            ?.alkalinityCreditResidualKgCaCO3Eq), 0),
      floodplainDenitrificationAlkalinityStoichiometryResidualKgCaCO3Eq:
        floodplainDenitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.closure
            ?.stoichiometricAlkalinityResidualKgCaCO3Eq), 0)
    };
    const nitrificationResiduals = {
      floodplainNitrificationNitrogenResidualKgN:
        floodplainNitrificationFluxes
          .dissolvedAmmoniumNitrogenConsumedKgN -
        floodplainNitrificationFluxes
          .dissolvedNitrateNitrogenProducedKgN,
      floodplainNitrificationOxygenResidualKgO2:
        floodplainNitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.closure
            ?.dissolvedOxygenDebitResidualKgO2), 0),
      floodplainNitrificationOxygenStoichiometryResidualKgO2:
        floodplainNitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.closure
            ?.stoichiometricOxygenResidualKgO2), 0),
      floodplainNitrificationAlkalinityOwnerResidualKgCaCO3Eq:
        floodplainNitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.closure
            ?.alkalinityDebitResidualKgCaCO3Eq), 0),
      floodplainNitrificationAlkalinityStoichiometryResidualKgCaCO3Eq:
        floodplainNitrificationReactionReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.closure
            ?.stoichiometricAlkalinityResidualKgCaCO3Eq), 0)
    };
    const gasExchangeResiduals = {
      floodplainAtmosphereCarbonTransferResidualKgC:
        floodplainGasExchangeReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.exchange?.carbonToAtmosphereKgC) -
            finite(receipt.exchange?.carbonToFloodplainKgC), 0) -
        atmosphereFloodplainGasExchangeReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.exchange?.carbonToAtmosphereKgC) -
            finite(receipt.exchange?.carbonToFloodplainKgC), 0),
      floodplainAtmosphereOxygenTransferResidualKgO2:
        floodplainGasExchangeReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.exchange?.oxygenToFloodplainKgO2), 0) -
        atmosphereFloodplainGasExchangeReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.exchange?.oxygenToFloodplainKgO2), 0),
      atmosphereFloodplainCarbonReservoirResidualKgC:
        atmosphereFloodplainGasExchangeReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.conservation?.carbonResidualKgC), 0),
      atmosphereFloodplainOxygenReservoirResidualKgO2:
        atmosphereFloodplainGasExchangeReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.conservation?.oxygenResidualKgO2), 0)
    };
    const sedimentResiduals = {};
    for (const grain of ['clay', 'silt', 'sand', 'gravel']) {
      const key = `${grain}Kg`;
      sedimentResiduals[`runoff${grain[0].toUpperCase()}${grain.slice(1)}ResidualKg`] =
        finalRunoffSediment[key] - initialRunoffSediment[key] +
          landRunoffSedimentInputs[grain];
      sedimentResiduals[`river${grain[0].toUpperCase()}${grain.slice(1)}ResidualKg`] =
        finalRiverSediment[key] - initialRiverSediment[key] -
          landRunoffSedimentInputs[grain] + coastalSedimentInputs[grain];
      sedimentResiduals[`coastal${grain[0].toUpperCase()}${grain.slice(1)}ResidualKg`] =
        finalCoastalSediment[key] - initialCoastalSediment[key] -
          coastalSedimentInputs[grain];
      sedimentResiduals[`coupled${grain[0].toUpperCase()}${grain.slice(1)}ResidualKg`] =
        finalRunoffSediment[key] + finalRiverSediment[key] +
          finalCoastalSediment[key] - initialRunoffSediment[key] -
          initialRiverSediment[key] - initialCoastalSediment[key];
    }
    const coupledBasinAggregateIdentityInputs = {
      waterResidualKg: {
        residualKg: waterResidualKg,
        signedOperandsKg: [
          finalEarth.runoffQueueKg,
          finalEarth.oceanFreshwaterKg,
          finalRiverStorageKg,
          finalFloodplainPlantResources.total.liveWaterKg,
          -initialEarth.runoffQueueKg,
          -initialEarth.oceanFreshwaterKg,
          -initialRiverStorageKg,
          -initialFloodplainPlantResources.total.liveWaterKg
        ]
      },
      coupledCarbonResidualKgC: {
        residualKg: coupledChemistryResiduals.coupledCarbonResidualKgC,
        signedOperandsKg: [
          finalRunoffBiogeochemistry.carbonKgC,
          finalRiverChemistry.carbonKgC,
          finalOceanEcology.carbonKgC,
          finalEstuaryStorage.carbonKgC,
          -initialRiverChemistry.carbonKgC,
          -initialRunoffBiogeochemistry.carbonKgC,
          -initialOceanEcology.carbonKgC,
          -initialEstuaryStorage.carbonKgC,
          -detritalReturnInputs.carbonKgC,
          floodplainGasExchangeFluxes.carbonToAtmosphereKgC,
          -floodplainGasExchangeFluxes.carbonToFloodplainKgC
        ]
      },
      coupledNitrogenResidualKgN: {
        residualKg: coupledChemistryResiduals.coupledNitrogenResidualKgN,
        signedOperandsKg: [
          finalRunoffBiogeochemistry.nitrogenKgN,
          finalRiverChemistry.nitrogenKgN,
          finalOceanEcology.nitrogenKgN,
          finalEstuaryStorage.nitrogenKgN,
          finalAtmosphereNitrogenGasKgN,
          -initialRunoffBiogeochemistry.nitrogenKgN,
          -initialRiverChemistry.nitrogenKgN,
          -initialOceanEcology.nitrogenKgN,
          -initialEstuaryStorage.nitrogenKgN,
          -initialAtmosphereNitrogenGasKgN,
          -detritalReturnInputs.nitrogenKgN
        ]
      },
      coupledPhosphorusResidualKgP: {
        residualKg: coupledChemistryResiduals.coupledPhosphorusResidualKgP,
        signedOperandsKg: [
          finalRunoffBiogeochemistry.phosphorusKgP,
          finalRiverChemistry.phosphorusKgP,
          finalOceanEcology.phosphorusKgP,
          finalEstuaryStorage.phosphorusKgP,
          finalFloodplainPlantResources.total.phosphorusKgP,
          -initialRiverChemistry.phosphorusKgP,
          -initialRunoffBiogeochemistry.phosphorusKgP,
          -initialOceanEcology.phosphorusKgP,
          -initialEstuaryStorage.phosphorusKgP,
          -initialFloodplainPlantResources.total.phosphorusKgP
        ]
      },
      coupledOxygenResidualKgO2: {
        residualKg: coupledChemistryResiduals.coupledOxygenResidualKgO2,
        signedOperandsKg: [
          finalRunoffBiogeochemistry.oxygenKgO2,
          finalRiverChemistry.oxygenKgO2,
          finalOceanEcology.oxygenKgO2,
          -initialRunoffBiogeochemistry.oxygenKgO2,
          -initialRiverChemistry.oxygenKgO2,
          -initialOceanEcology.oxygenKgO2,
          estuaryBoundaryFluxes.oxygenConsumptionKgO2,
          floodplainRespirationFluxes.dissolvedOxygenConsumedKgO2,
          floodplainNitrificationFluxes.dissolvedOxygenConsumedKgO2,
          -floodplainGasExchangeFluxes.oxygenToFloodplainKgO2
        ]
      },
      coupledAlkalinityResidualKgCaCO3Eq: {
        residualKg:
          coupledChemistryResiduals.coupledAlkalinityResidualKgCaCO3Eq,
        signedOperandsKg: [
          finalRunoffBiogeochemistry.alkalinityKgCaCO3Eq,
          finalRiverChemistry.alkalinityKgCaCO3Eq,
          finalOceanEcology.alkalinityKgCaCO3Eq,
          -initialRunoffBiogeochemistry.alkalinityKgCaCO3Eq,
          -initialRiverChemistry.alkalinityKgCaCO3Eq,
          -initialOceanEcology.alkalinityKgCaCO3Eq,
          floodplainNitrificationFluxes.alkalinityDemandKgCaCO3,
          -floodplainDenitrificationFluxes.alkalinityGeneratedKgCaCO3Eq,
          -estuaryBoundaryFluxes.alkalinityGeneratedKgCaCO3Eq
        ]
      },
      loadedLandFloodplainPlantCarbonResidualKgC: {
        residualKg: coupledPlantMatterResiduals
          .loadedLandFloodplainPlantCarbonResidualKgC,
        signedOperandsKg: [
          finalLoadedLandLiveBiomass.carbonKgC,
          finalFloodplainPlantMatter.total.carbonKgC,
          -initialLoadedLandLiveBiomass.carbonKgC,
          -initialFloodplainPlantMatter.total.carbonKgC,
          detritalReturnInputs.carbonKgC
        ]
      },
      loadedLandFloodplainPlantNitrogenResidualKgN: {
        residualKg: coupledPlantMatterResiduals
          .loadedLandFloodplainPlantNitrogenResidualKgN,
        signedOperandsKg: [
          finalLoadedLandLiveBiomass.nitrogenKgN,
          finalFloodplainPlantMatter.total.nitrogenKgN,
          -initialLoadedLandLiveBiomass.nitrogenKgN,
          -initialFloodplainPlantMatter.total.nitrogenKgN,
          detritalReturnInputs.nitrogenKgN
        ]
      }
    };
    for (const grain of ['clay', 'silt', 'sand', 'gravel']) {
      const title = `${grain[0].toUpperCase()}${grain.slice(1)}`;
      const identity = `coupled${title}ResidualKg`;
      const key = `${grain}Kg`;
      coupledBasinAggregateIdentityInputs[identity] = {
        residualKg: sedimentResiduals[identity],
        signedOperandsKg: [
          finalRunoffSediment[key],
          finalRiverSediment[key],
          finalCoastalSediment[key],
          -initialRunoffSediment[key],
          -initialRiverSediment[key],
          -initialCoastalSediment[key]
        ]
      };
    }
    const aggregateMassClosure = basinAggregateMassClosureReceipt(
      coupledBasinAggregateIdentityInputs);
    inletReceipts.sort((a, b) => a.sender.earthCellId.localeCompare(b.sender.earthCellId));
    floodplainReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainThermalReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainHabitatReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodEventReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainSuccessionReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainPlantMatterReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainPlantResourcesReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainPlantResourceDebitReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainPlantWaterReturnReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainPlantDetritusMatterDebitReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    floodplainPlantDetritusResourceDebitReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    floodplainDetritalReturnCreditReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    floodplainDecompositionReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainAerobicMineralizationReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    floodplainRespirationReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    floodplainDenitrificationReactionReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    atmosphereFloodplainDenitrificationReceipts.sort((a, b) =>
      String(a.sourceReachId).localeCompare(String(b.sourceReachId)));
    floodplainDenitrificationProcessReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    floodplainNitrificationReactionReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    floodplainNitrificationProcessReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    floodplainGasExchangeReceipts.sort((a, b) => String(a.reachId)
      .localeCompare(String(b.reachId)));
    atmosphereFloodplainGasExchangeReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    floodplainGasExchangeProcessReceipts.sort((a, b) =>
      String(a.reachId).localeCompare(String(b.reachId)));
    landEcologySubgridDebitReceipts.sort((a, b) =>
      String(a.donorCellId).localeCompare(String(b.donorCellId)));
    routeReceipts.sort((a, b) => a.transferId.localeCompare(b.transferId));
    boundaryReceipts.sort((a, b) => a.reachId.localeCompare(b.reachId));
    const sedimentOwnerReceipts = [
      ...inletReceipts.flatMap(entry => [entry.runoffSedimentSenderDebit,
        entry.riverSedimentInput]),
      ...routeReceipts.flatMap(entry => entry.schema ===
        RIVER_REACH_TRANSFER_SCHEMA
        ? [entry.sedimentTransfer?.senderDebitAndDeposition,
          entry.sedimentTransfer?.receiverCredit]
        : [entry.riverSedimentSenderDebitAndDeposition,
          entry.coastalSedimentReceiverCredit])
    ].filter(Boolean);
    const receipt = {
      schema: BASIN_ROUTING_STEP_SCHEMA,
      profileId,
      startDay: round(startDay, 8),
      endDay: round(endDay, 8),
      durationDays: round(durationDays, 8),
      loadedReachCount: reaches.length,
      persistedReachStateCount: working.reaches.size,
      inletReceipts,
      floodplainReceipts,
      floodplainThermalReceipts,
      floodplainHabitatReceipts,
      floodEventReceipts,
      floodplainSuccessionReceipts,
      floodplainPlantMatterReceipts,
      floodplainPlantResourcesReceipts,
      landEcologySubgridDebitReceipts,
      floodplainPlantResourceDebitReceipts,
      floodplainPlantWaterReturnReceipts,
      floodplainPlantDetritusMatterDebitReceipts,
      floodplainPlantDetritusResourceDebitReceipts,
      floodplainDetritalReturnCreditReceipts,
      floodplainDecompositionReceipts,
      floodplainAerobicMineralizationReceipts,
      floodplainRespirationReceipts,
      floodplainDenitrificationReactionReceipts,
      atmosphereFloodplainDenitrificationReceipts,
      floodplainDenitrificationProcessReceipts,
      floodplainNitrificationReactionReceipts,
      floodplainNitrificationProcessReceipts,
      floodplainGasExchangeReceipts,
      atmosphereFloodplainGasExchangeReceipts,
      floodplainGasExchangeProcessReceipts,
      routeReceipts,
      boundaryReceipts,
      aggregateMassClosure,
      transfers: {
        earthCellToRiverKg: round(inletReceipts.reduce((sum, receipt) => sum + receipt.receiver.creditedKg, 0), 3),
        channelToFloodplainKg: round(floodplainReceipts.reduce((sum, entry) =>
          sum + finite(entry.water?.overbankKg), 0), 3),
        floodplainToChannelKg: round(floodplainReceipts.reduce((sum, entry) =>
          sum + finite(entry.water?.returnKg), 0), 3),
        floodplainDepositedSedimentKg: Object.fromEntries(
          ['clay', 'silt', 'sand', 'gravel'].map(grain => [grain,
            round(floodplainReceipts.reduce((sum, entry) => sum +
              finite(entry.sediment?.depositedKg?.[grain]), 0), 9)])),
        reachToReachKg: round(reachToReachKg, 3),
        riverToOceanKg: round(deliveredToOceanKg, 3),
        landRunoffBiogeochemistryInputs: Object.fromEntries(Object.entries(
          landRunoffBiogeochemistryInputs).map(([key, value]) => [key, round(value, 9)])),
        landRunoffSedimentInputs: Object.fromEntries(Object.entries(
          landRunoffSedimentInputs).map(([key, value]) => [key, round(value, 9)])),
        riverBedDeposits: Object.fromEntries(Object.entries(
          riverBedDeposits).map(([key, value]) => [key, round(value, 9)])),
        coastalSedimentInputs: Object.fromEntries(Object.entries(
          coastalSedimentInputs).map(([key, value]) => [key, round(value, 9)])),
        oceanEcologyBoundaryInputs: Object.fromEntries(Object.entries(
          oceanEcologyBoundaryInputs).map(([key, value]) => [key, round(value, 6)])),
        estuaryRiverInputs: Object.fromEntries(Object.entries(
          estuaryRiverInputs).map(([key, value]) => [key, round(value, 9)])),
        estuaryBoundaryFluxes: Object.fromEntries(Object.entries(
          estuaryBoundaryFluxes).map(([key, value]) => [key, round(value, 9)])),
        landEcologySubgridBiomassDebits: {
          carbonKgC: round(landEcologySubgridDebitReceipts.reduce(
            (sum, entry) => sum + finite(entry.debited?.carbonKgC), 0), 9),
          nitrogenKgN: round(landEcologySubgridDebitReceipts.reduce(
            (sum, entry) => sum + finite(entry.debited?.nitrogenKgN), 0), 9)
        },
        floodplainDetritalReturns: {
          carbonKgC: round(detritalReturnInputs.carbonKgC, 9),
          nitrogenKgN: round(detritalReturnInputs.nitrogenKgN, 9),
          phosphorusKgP: round(detritalReturnInputs.phosphorusKgP, 12)
        },
        floodplainAerobicRespiration: {
          dissolvedOrganicCarbonConsumedKgC: round(
            floodplainRespirationFluxes
              .dissolvedOrganicCarbonConsumedKgC, 9),
          dissolvedInorganicCarbonProducedKgC: round(
            floodplainRespirationFluxes
              .dissolvedInorganicCarbonProducedKgC, 9),
          dissolvedOxygenConsumedKgO2: round(
            floodplainRespirationFluxes
              .dissolvedOxygenConsumedKgO2, 9)
        },
        floodplainDenitrification: {
          dissolvedOrganicCarbonConsumedKgC: round(
            floodplainDenitrificationFluxes
              .dissolvedOrganicCarbonConsumedKgC, 9),
          dissolvedInorganicCarbonProducedKgC: round(
            floodplainDenitrificationFluxes
              .dissolvedInorganicCarbonProducedKgC, 9),
          dissolvedNitrateNitrogenConsumedKgN: round(
            floodplainDenitrificationFluxes
              .dissolvedNitrateNitrogenConsumedKgN, 9),
          nitrogenGasProducedKgN: round(
            floodplainDenitrificationFluxes.nitrogenGasProducedKgN, 9),
          alkalinityGeneratedKgCaCO3Eq: round(
            floodplainDenitrificationFluxes
              .alkalinityGeneratedKgCaCO3Eq, 9)
        },
        floodplainNitrification: {
          dissolvedAmmoniumNitrogenConsumedKgN: round(
            floodplainNitrificationFluxes
              .dissolvedAmmoniumNitrogenConsumedKgN, 9),
          dissolvedNitrateNitrogenProducedKgN: round(
            floodplainNitrificationFluxes
              .dissolvedNitrateNitrogenProducedKgN, 9),
          dissolvedOxygenConsumedKgO2: round(
            floodplainNitrificationFluxes
              .dissolvedOxygenConsumedKgO2, 9),
          alkalinityDemandKgCaCO3: round(
            floodplainNitrificationFluxes
              .alkalinityDemandKgCaCO3, 9)
        },
        floodplainAtmosphereGasExchange: {
          carbonToAtmosphereKgC: round(
            floodplainGasExchangeFluxes.carbonToAtmosphereKgC, 9),
          carbonToFloodplainKgC: round(
            floodplainGasExchangeFluxes.carbonToFloodplainKgC, 9),
          oxygenToFloodplainKgO2: round(
            floodplainGasExchangeFluxes.oxygenToFloodplainKgO2, 9)
        }
      },
      storage: {
        initialRiverKg: round(initialRiverStorageKg, 3),
        finalRiverKg: round(finalRiverStorageKg, 3),
        initialRiverChemistry: Object.fromEntries(Object.entries(initialRiverChemistry)
          .map(([key, value]) => [key, round(value, 9)])),
        finalRiverChemistry: Object.fromEntries(Object.entries(finalRiverChemistry)
          .map(([key, value]) => [key, round(value, 9)])),
        initialRiverNitrogenSpecies: Object.fromEntries(Object.entries(
          initialRiverNitrogenSpecies)
          .map(([key, value]) => [key, round(value, 9)])),
        finalRiverNitrogenSpecies: Object.fromEntries(Object.entries(
          finalRiverNitrogenSpecies)
          .map(([key, value]) => [key, round(value, 9)])),
        initialRunoffBiogeochemistry: Object.fromEntries(Object.entries(
          initialRunoffBiogeochemistry)
          .map(([key, value]) => [key, round(value, 9)])),
        finalRunoffBiogeochemistry: Object.fromEntries(Object.entries(
          finalRunoffBiogeochemistry)
          .map(([key, value]) => [key, round(value, 9)])),
        initialRunoffSediment: Object.fromEntries(Object.entries(
          initialRunoffSediment)
          .map(([key, value]) => [key, round(value, 9)])),
        finalRunoffSediment: Object.fromEntries(Object.entries(
          finalRunoffSediment)
          .map(([key, value]) => [key, round(value, 9)])),
        initialRiverSediment: Object.fromEntries(Object.entries(
          initialRiverSediment)
          .map(([key, value]) => [key, round(value, 9)])),
        finalRiverSediment: Object.fromEntries(Object.entries(
          finalRiverSediment)
          .map(([key, value]) => [key, round(value, 9)])),
        initialFloodplain: clone(initialFloodplain),
        finalFloodplain: clone(finalFloodplain),
        initialFloodplainThermal: clone(initialFloodplainThermal),
        finalFloodplainThermal: clone(finalFloodplainThermal),
        initialFloodplainHabitat: clone(initialFloodplainHabitat),
        finalFloodplainHabitat: clone(finalFloodplainHabitat),
        initialFloodEvents: clone(initialFloodEvents),
        finalFloodEvents: clone(finalFloodEvents),
        initialFloodplainSuccession: clone(initialFloodplainSuccession),
        finalFloodplainSuccession: clone(finalFloodplainSuccession),
        initialLoadedLandLiveBiomass: Object.fromEntries(Object.entries(
          initialLoadedLandLiveBiomass).map(([key, value]) =>
          [key, round(value, 9)])),
        finalLoadedLandLiveBiomass: Object.fromEntries(Object.entries(
          finalLoadedLandLiveBiomass).map(([key, value]) =>
          [key, round(value, 9)])),
        initialFloodplainPlantMatter: clone(initialFloodplainPlantMatter),
        finalFloodplainPlantMatter: clone(finalFloodplainPlantMatter),
        initialFloodplainPlantResources:
          clone(initialFloodplainPlantResources),
        finalFloodplainPlantResources:
          clone(finalFloodplainPlantResources),
        initialFloodplainDecomposition:
          clone(initialFloodplainDecomposition),
        finalFloodplainDecomposition:
          clone(finalFloodplainDecomposition),
        initialFloodplainRespiration:
          clone(initialFloodplainRespiration),
        finalFloodplainRespiration:
          clone(finalFloodplainRespiration),
        initialFloodplainDenitrification:
          clone(initialFloodplainDenitrification),
        finalFloodplainDenitrification:
          clone(finalFloodplainDenitrification),
        initialFloodplainNitrification:
          clone(initialFloodplainNitrification),
        finalFloodplainNitrification:
          clone(finalFloodplainNitrification),
        initialFloodplainGasExchange:
          clone(initialFloodplainGasExchange),
        finalFloodplainGasExchange:
          clone(finalFloodplainGasExchange),
        initialCoastalSediment: Object.fromEntries(Object.entries(
          initialCoastalSediment)
          .map(([key, value]) => [key, round(value, 9)])),
        finalCoastalSediment: Object.fromEntries(Object.entries(
          finalCoastalSediment)
          .map(([key, value]) => [key, round(value, 9)])),
        initialEstuaryStorage: Object.fromEntries(Object.entries(initialEstuaryStorage)
          .map(([key, value]) => [key, round(value, 9)])),
        finalEstuaryStorage: Object.fromEntries(Object.entries(finalEstuaryStorage)
          .map(([key, value]) => [key, round(value, 9)])),
        initialAtmosphereNitrogenGasKgN: round(initialAtmosphereNitrogenGasKgN, 6),
        finalAtmosphereNitrogenGasKgN: round(finalAtmosphereNitrogenGasKgN, 6)
      },
      conservation: {
        waterResidualKg: round(waterResidualKg, 3),
        ...Object.fromEntries(Object.entries(oceanEcologyResiduals)
          .map(([key, value]) => [key, round(value, 6)])),
        ...Object.fromEntries(Object.entries(riverChemistryResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(riverNitrogenSpeciesResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(runoffBiogeochemistryResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(estuaryResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(coupledChemistryResiduals)
          .map(([key, value]) => [key, round(value, 6)])),
        ...Object.fromEntries(Object.entries(coupledPlantMatterResiduals)
          .map(([key, value]) => [key, round(value, 6)])),
        ...Object.fromEntries(Object.entries(plantResourceResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(decompositionResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(respirationResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(denitrificationResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(nitrificationResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(gasExchangeResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(sedimentResiduals)
          .map(([key, value]) => [key, round(value, 6)]))
      },
      truth: {
        pairedEarthCellAndReachReceipts: true,
        simultaneousReachRouting: true,
        coupledBasinAggregateScaleAwareNumericClosure:
          aggregateMassClosure.conservationClosed,
        coupledBasinAggregatePerIdentityNumericBounds:
          aggregateMassClosure.identityCount === 12,
        coupledBasinAggregateMeasuredResidualsPreserved:
          aggregateMassClosure.measuredResidualsPreserved,
        coupledBasinAggregateFixedAbsoluteToleranceOnly: false,
        canonicalReachIds: true,
        parameterizedRiverBiogeochemistryBoundary: false,
        parameterizedLandRunoffChemistryBoundary: false,
        persistentLandRunoffBiogeochemistryQueue: true,
        landRunoffBiogeochemistrySenderDebited: true,
        persistentLandRunoffSedimentQueue: true,
        landRunoffSedimentSenderDebited: true,
        exactLandRunoffRiverTransferIds: inletReceipts.every(entry =>
          entry.runoffBiogeochemistrySenderDebit?.transferId ===
            entry.riverChemistryInput?.transferId &&
          entry.transferId === entry.riverChemistryInput?.transferId),
        parameterizedRunoffDinSpeciation: inletReceipts.every(entry =>
          entry.riverChemistryInput?.truth
            ?.nitrateAndAmmoniumReceiverPoolsCredited === true &&
          entry.riverChemistryInput?.truth
            ?.measuredInputSpeciationClaimed === false),
        upstreamRiverChemistryReservoirs: true,
        persistentRiverAndFloodplainNitrateAmmoniumPools: true,
        exactNitrateAmmoniumReachTransport: routeReceipts.every(entry => {
          const pools = entry.chemistryTransfer?.pools ||
            entry.riverChemistrySenderDebit?.pools;
          if (!pools) return true;
          return Number.isFinite(pools.dissolvedNitrateNitrogenKgN) &&
            Number.isFinite(pools.dissolvedAmmoniumNitrogenKgN) &&
            Math.abs(finite(pools.dissolvedInorganicNitrogenKgN) -
              finite(pools.dissolvedNitrateNitrogenKgN) -
              finite(pools.dissolvedAmmoniumNitrogenKgN)) < 1e-7;
        }),
        nitrateAmmoniumConservationClosed:
          Object.values(riverNitrogenSpeciesResiduals).every(value =>
            Math.abs(value) < 1),
        persistentRiverSuspendedAndBedSediment: true,
        persistentFloodplainWaterChemistryAndSediment: true,
        geometryDerivedBankfullExchange: true,
        finiteFloodplainReturnFlow: true,
        grainSelectiveFloodplainDeposition: true,
        floodplainExchangeConservationClosed: floodplainReceipts.every(entry =>
          entry.schema === FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA &&
          entry.truth?.conservationClosed === true),
        floodplainExchangeScaleAwareNumericClosure:
          floodplainReceipts.every(entry =>
            entry.truth?.scaleAwareNumericClosure === true &&
            entry.massClosure?.conservationClosed === true),
        floodplainExchangePerIdentityNumericBounds:
          floodplainReceipts.every(entry =>
            entry.truth?.perIdentityNumericBounds === true &&
            entry.massClosure?.identityCount === 12),
        floodplainExchangeMeasuredResidualsPreserved:
          floodplainReceipts.every(entry =>
            entry.truth?.measuredResidualsPreserved === true &&
            entry.massClosure?.measuredResidualsPreserved === true),
        floodplainExchangeFixedAbsoluteToleranceOnly: false,
        persistentFloodplainWaterTemperatureState:
          floodplainThermalReceipts.every(entry =>
            entry.schema === FLOODPLAIN_THERMAL_RECEIPT_SCHEMA &&
            entry.truth?.persistentFloodplainWaterTemperatureState ===
              true),
        persistentFloodplainSensibleHeatOwner:
          floodplainThermalReceipts.every(entry =>
            entry.truth?.persistentFloodplainSensibleHeatOwner === true),
        floodplainThermalEnergyClosure:
          floodplainThermalReceipts.every(entry =>
            entry.energyClosure?.schema ===
              FLOODPLAIN_THERMAL_ENERGY_CLOSURE_SCHEMA &&
            (entry.energyClosure.applicable === false
              ? entry.status ===
                  'initialized-after-migration-no-historical-heat' &&
                entry.truth?.migrationInventedHistoricalHeat === false
              : entry.energyClosure.conservationClosed === true &&
                entry.truth?.energyClosureClosed === true)),
        floodplainThermalScaleAwareNumericClosure:
          floodplainThermalReceipts.every(entry =>
            entry.energyClosure?.policy?.schema ===
              FLOODPLAIN_THERMAL_ENERGY_CLOSURE_POLICY_SCHEMA &&
            (entry.energyClosure.applicable === false ||
              entry.truth?.scaleAwareNumericEnergyClosure === true)),
        floodplainThermalMeasuredResidualsPreserved:
          floodplainThermalReceipts.every(entry =>
            entry.energyClosure?.applicable === false ||
            entry.truth?.measuredEnergyResidualPreserved === true),
        floodplainThermalFixedAbsoluteToleranceOnly: false,
        floodplainThermalReactionTemperatureEvidenceBound:
          floodplainThermalReceipts.every(thermal => {
            const temperatureC = finite(
              thermal.temperatures?.finalWaterTemperatureC);
            const consumers = [
              floodplainDenitrificationProcessReceipts.find(entry =>
                entry.reachId === thermal.reachId),
              floodplainNitrificationProcessReceipts.find(entry =>
                entry.reachId === thermal.reachId),
              floodplainGasExchangeProcessReceipts.find(entry =>
                entry.reachId === thermal.reachId)
            ].filter(Boolean);
            return consumers.every(entry =>
              entry.activity?.floodplainThermalReceiptDigest ===
                thermal.digest &&
              Math.abs(finite(entry.activity?.waterTemperatureC) -
                temperatureC) <= 1e-6);
          }),
        floodplainThermalChannelWaterTemperatureResolved: false,
        floodplainThermalExternalBoundaryOwnerDebited: false,
        resolvedFloodplainFreezeThawState: false,
        persistentFloodplainHabitatMemory: true,
        floodplainHabitatPotentialOnly: true,
        floodplainHabitatMaterialObserverReadOnly:
          floodplainHabitatReceipts.every(entry =>
            entry.schema === FLOODPLAIN_HABITAT_RECEIPT_SCHEMA &&
            entry.truth?.floodplainMaterialMutated === false),
        floodplainHabitatFractionsNormalized:
          floodplainHabitatReceipts.every(entry =>
            entry.truth?.fractionsNormalized === true),
        persistentBoundedFloodEventHistory: true,
        floodEventHistoryMaterialObserverReadOnly:
          floodEventReceipts.every(entry =>
            entry.schema === FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA &&
            entry.truth?.floodplainMaterialMutated === false),
        floodEventHistoryExchangeEvidenceBound:
          floodEventReceipts.every(entry =>
            typeof entry.floodplainExchangeDigest === 'string'),
        floodEventHistoryArchiveBounded:
          floodEventReceipts.every(entry =>
            entry.truth?.archiveWithinBound !== false),
        persistentFloodplainSuccession: true,
        floodplainSuccessionEvidenceBound:
          floodplainSuccessionReceipts.every(entry =>
            entry.schema === FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA &&
            typeof entry.floodplainHabitatReceiptDigest === 'string' &&
            typeof entry.floodEventTransitionReceiptDigest === 'string'),
        floodplainSuccessionLedgersClosed:
          floodplainSuccessionReceipts.every(entry =>
            entry.truth?.ledgersClosed === true),
        floodplainSuccessionCompetitionBounded:
          floodplainSuccessionReceipts.every(entry =>
            entry.truth?.competitionCapacityHonored === true),
        floodplainSuccessionMaterialAuthority: false,
        persistentFloodplainPlantMatter: true,
        floodplainPlantMatterEvidenceBound:
          floodplainPlantMatterReceipts.every(entry =>
            entry.schema === FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA &&
            typeof entry.floodplainSuccessionReceiptDigest === 'string'),
        floodplainPlantMatterLedgersClosed:
          floodplainPlantMatterReceipts.every(entry =>
            entry.truth?.carbonAndNitrogenClosed === true &&
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.perMaterialChannelNumericBounds === true &&
            entry.truth?.measuredResidualsPreserved === true),
        floodplainPlantMatterScaleAwareNumericClosure:
          floodplainPlantMatterReceipts.every(entry =>
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.perMaterialChannelNumericBounds === true &&
            entry.truth?.fixedAbsoluteToleranceOnly === false),
        floodplainPlantMatterMeasuredResidualsPreserved:
          floodplainPlantMatterReceipts.every(entry =>
            entry.truth?.measuredResidualsPreserved === true),
        landEcologySubgridSenderDebited:
          landEcologySubgridDebitReceipts.every(entry =>
            entry.schema === LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA &&
            entry.truth?.persistentLandEcologySenderDebited === true &&
            entry.truth?.carbonAndNitrogenClosed === true &&
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.measuredResidualsPreserved === true),
        exactLandEcologyFloodplainPlantTransferIds:
          floodplainPlantMatterReceipts.every(entry => {
            const sender = landEcologySubgridDebitReceipts.find(candidate =>
              candidate.donorCellId === entry.donorCellId);
            if (!entry.transferIds.length) {
              const senderIds = (sender?.allocations || []).filter(
                allocation => allocation.reachId === entry.reachId);
              return senderIds.length === 0 &&
                (entry.landEcologySenderReceiptDigest == null ||
                  sender?.digest === entry.landEcologySenderReceiptDigest);
            }
            const senderIds = new Set((sender?.allocations || [])
              .filter(allocation => allocation.reachId === entry.reachId)
              .map(allocation => allocation.transferId));
            return sender?.digest === entry.landEcologySenderReceiptDigest &&
              entry.transferIds.every(id => senderIds.has(id)) &&
              senderIds.size === entry.transferIds.length;
          }),
        loadedLandFloodplainPlantCarbonNitrogenClosed:
          aggregateMassClosure.identities
            .loadedLandFloodplainPlantCarbonResidualKgC.closed &&
          aggregateMassClosure.identities
            .loadedLandFloodplainPlantNitrogenResidualKgN.closed,
        floodplainPlantMatterPhosphorusAuthority: false,
        floodplainPlantMatterDoubleCountedWithLandEcology: false,
        persistentFloodplainPlantResources: true,
        floodplainPlantResourcesEvidenceBound:
          floodplainPlantResourcesReceipts.every(entry => {
            const matter = floodplainPlantMatterReceipts.find(candidate =>
              candidate.reachId === entry.reachId);
            return entry.schema ===
              FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA &&
              entry.plantMatterReceiptDigest === matter?.digest;
          }),
        floodplainPlantResourcesLedgersClosed:
          floodplainPlantResourcesReceipts.every(entry =>
            entry.truth?.resourceLedgersClosed === true &&
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.perMaterialChannelNumericBounds === true &&
            entry.truth?.measuredResidualsPreserved === true),
        floodplainPlantResourceScaleAwareNumericClosure:
          floodplainPlantResourcesReceipts.every(entry =>
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.perMaterialChannelNumericBounds === true &&
            entry.truth?.fixedAbsoluteToleranceOnly === false),
        floodplainPlantResourceMeasuredResidualsPreserved:
          floodplainPlantResourcesReceipts.every(entry =>
            entry.truth?.measuredResidualsPreserved === true),
        floodplainPlantResourceSendersAndReceiversClosed:
          floodplainPlantResourceDebitReceipts.every(entry =>
            entry.schema === FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA &&
            entry.truth?.waterAndPhosphorusClosed === true) &&
          floodplainPlantWaterReturnReceipts.every(entry =>
            entry.schema === FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA &&
            entry.truth?.waterClosed === true),
        exactFloodplainPlantResourceTransferIds:
          floodplainPlantResourcesReceipts.every(entry => {
            const debit = floodplainPlantResourceDebitReceipts.find(
              candidate => candidate.reachId === entry.reachId);
            const returned = floodplainPlantWaterReturnReceipts.find(
              candidate => candidate.reachId === entry.reachId);
            const debitIds = new Set((debit?.allocations || []).map(
              allocation => allocation.transferId));
            const returnIds = new Set((returned?.transfers || []).map(
              transfer => transfer.transferId));
            return debit?.digest ===
                entry.floodplainResourceDebitReceiptDigest &&
              returned?.digest ===
                entry.floodplainWaterReturnReceiptDigest &&
              entry.uptakeTransferIds.every(id => debitIds.has(id)) &&
              debitIds.size === entry.uptakeTransferIds.length &&
              entry.waterReturnTransferIds.every(id =>
                returnIds.has(id)) &&
              returnIds.size === entry.waterReturnTransferIds.length;
          }),
        jointCarbonNitrogenPhosphorusWaterLimitedPlantGrowth:
          pendingPlantMatter.every(entry =>
            finite(entry.resourceGrowthScale, 1) >= 0 &&
            finite(entry.resourceGrowthScale, 1) <= 1),
        floodplainPlantResourcesWaterPhosphorusClosed:
          Math.abs(plantResourceResiduals
            .plantResourceWaterResidualKg) < 1 &&
          Math.abs(plantResourceResiduals
            .plantResourcePhosphorusResidualKgP) < 1,
        floodplainPlantResourceIndependentCreation: false,
        persistentFloodplainDecomposition:
          floodplainDecompositionReceipts.every(entry =>
            entry.schema === FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA),
        floodplainDecompositionEvidenceBound:
          floodplainDecompositionReceipts.every(entry => {
            const matterDebit =
              floodplainPlantDetritusMatterDebitReceipts.find(candidate =>
                candidate.reachId === entry.reachId);
            const resourceDebit =
              floodplainPlantDetritusResourceDebitReceipts.find(candidate =>
                candidate.reachId === entry.reachId);
            const credit = floodplainDetritalReturnCreditReceipts.find(
              candidate => candidate.reachId === entry.reachId);
            return entry.matterDebitReceiptDigest === matterDebit?.digest &&
              entry.resourceDebitReceiptDigest === resourceDebit?.digest &&
              entry.floodplainCreditReceiptDigest === credit?.digest;
          }),
        floodplainDetritalReturnScaleAwareNumericClosure:
          floodplainDetritalReturnCreditReceipts.every(entry =>
            entry.schema === FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA &&
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.fixedAbsoluteToleranceOnly === false),
        floodplainDetritalReturnPerMaterialChannelNumericBounds:
          floodplainDetritalReturnCreditReceipts.every(entry =>
            entry.truth?.perMaterialChannelNumericBounds === true),
        floodplainDetritalReturnMeasuredResidualsPreserved:
          floodplainDetritalReturnCreditReceipts.every(entry =>
            entry.truth?.measuredResidualsPreserved === true),
        floodplainDecompositionSendersAndReceiverClosed:
          floodplainPlantDetritusMatterDebitReceipts.every(entry =>
            entry.schema ===
              FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA &&
            entry.truth?.carbonAndNitrogenClosed === true) &&
          floodplainPlantDetritusResourceDebitReceipts.every(entry =>
            entry.schema ===
              FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA &&
            entry.truth?.phosphorusClosed === true) &&
          floodplainDetritalReturnCreditReceipts.every(entry =>
            entry.schema === FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA &&
            entry.truth?.carbonNitrogenPhosphorusClosed === true &&
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.perMaterialChannelNumericBounds === true &&
            entry.truth?.measuredResidualsPreserved === true),
        exactFloodplainDecompositionTransferIds:
          floodplainDecompositionReceipts.every(entry => {
            const matterDebit =
              floodplainPlantDetritusMatterDebitReceipts.find(candidate =>
                candidate.reachId === entry.reachId);
            const resourceDebit =
              floodplainPlantDetritusResourceDebitReceipts.find(candidate =>
                candidate.reachId === entry.reachId);
            const credit = floodplainDetritalReturnCreditReceipts.find(
              candidate => candidate.reachId === entry.reachId);
            const matterIds = new Set((matterDebit?.allocations || [])
              .map(allocation => allocation.transferId));
            const resourceIds = new Set((resourceDebit?.allocations || [])
              .map(allocation => allocation.transferId));
            const creditIds = new Set((credit?.allocations || [])
              .map(allocation => allocation.transferId));
            return entry.transferIds.every(id => matterIds.has(id) &&
              resourceIds.has(id) && creditIds.has(id)) &&
              matterIds.size === entry.transferIds.length &&
              resourceIds.size === entry.transferIds.length &&
              creditIds.size === entry.transferIds.length;
          }),
        floodplainDecompositionLedgersClosed:
          floodplainDecompositionReceipts.every(entry =>
            entry.truth?.carbonNitrogenPhosphorusClosed === true) &&
          Object.values(decompositionResiduals).every(value =>
            Math.abs(value) < 1),
        onlyResourceBackedFloodplainDetritusDecomposes:
          floodplainDecompositionReceipts.every(entry =>
            entry.truth?.onlyResourceBackedDetritusEligible === true),
        floodplainDecompositionIndependentCreation: false,
        floodplainDecompositionAtmosphericRespirationModeled: false,
        floodplainDecompositionOxygenConsumptionModeled: false,
        persistentFloodplainAerobicRespiration:
          floodplainRespirationReceipts.every(entry =>
            entry.schema === FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA),
        floodplainRespirationEvidenceBound:
          floodplainRespirationReceipts.every(entry => {
            const reaction = floodplainAerobicMineralizationReceipts.find(
              candidate => candidate.reachId === entry.reachId);
            return reaction?.digest === entry.mineralizationReceiptDigest;
          }),
        floodplainRespirationChemistryReceiptsClosed:
          floodplainAerobicMineralizationReceipts.every(entry =>
            entry.schema ===
              FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA &&
            entry.truth?.localDocToDicCarbonClosed === true &&
            entry.truth?.dissolvedOxygenConsumptionClosed === true),
        floodplainRespirationScaleAwareNumericClosure:
          floodplainAerobicMineralizationReceipts.every(entry =>
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.fixedAbsoluteToleranceOnly === false),
        floodplainRespirationPerIdentityNumericBounds:
          floodplainAerobicMineralizationReceipts.every(entry =>
            entry.truth?.perIdentityNumericBounds === true),
        floodplainRespirationMeasuredResidualsPreserved:
          floodplainAerobicMineralizationReceipts.every(entry =>
            entry.truth?.measuredResidualsPreserved === true),
        floodplainRespirationCarbonAndOxygenLedgersClosed:
          Object.values(respirationResiduals).every(value =>
            Math.abs(value) < 1),
        floodplainRespirationOxygenLimited:
          floodplainRespirationReceipts.every(entry =>
            entry.truth?.oxygenLimited === true),
        floodplainRespirationIndependentCreation: false,
        floodplainRespirationAtmosphericGasExchangeModeled: false,
        floodplainRespirationAnaerobicPathwayModeled: false,
        persistentFloodplainDenitrification:
          floodplainDenitrificationProcessReceipts.every(entry =>
            entry.schema === FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA),
        floodplainDenitrificationOwnerReceiptsTyped:
          floodplainDenitrificationReactionReceipts.every(entry =>
            entry.schema ===
              FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA) &&
          atmosphereFloodplainDenitrificationReceipts.every(entry =>
            entry.schema === ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA &&
            entry.sourceKind === 'floodplain-denitrification'),
        floodplainDenitrificationScaleAwareNumericClosure:
          floodplainDenitrificationReactionReceipts.every(entry =>
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.fixedAbsoluteToleranceOnly === false),
        floodplainDenitrificationPerIdentityNumericBounds:
          floodplainDenitrificationReactionReceipts.every(entry =>
            entry.truth?.perIdentityNumericBounds === true),
        floodplainDenitrificationMeasuredResidualsPreserved:
          floodplainDenitrificationReactionReceipts.every(entry =>
            entry.truth?.measuredResidualsPreserved === true),
        floodplainDenitrificationEvidenceBound:
          floodplainDenitrificationProcessReceipts.every(entry => {
            if (entry.atmosphereCellId == null) {
              return entry.reactionReceiptDigest == null &&
                entry.atmosphereReceiptDigest == null;
            }
            const reactionOwner =
              floodplainDenitrificationReactionReceipts.find(candidate =>
                candidate.transferId === entry.transferId);
            const atmosphereOwner =
              atmosphereFloodplainDenitrificationReceipts.find(candidate =>
                candidate.transferId === entry.transferId);
            return reactionOwner?.digest === entry.reactionReceiptDigest &&
              atmosphereOwner?.digest === entry.atmosphereReceiptDigest &&
              atmosphereOwner?.sourceReceiptDigest === reactionOwner?.digest;
          }),
        exactFloodplainDenitrificationTransferIds:
          floodplainDenitrificationReactionReceipts.length ===
            atmosphereFloodplainDenitrificationReceipts.length &&
          floodplainDenitrificationReactionReceipts.every(entry =>
            atmosphereFloodplainDenitrificationReceipts.some(candidate =>
              candidate.transferId === entry.transferId &&
              candidate.sourceReachId === entry.reachId)),
        floodplainDenitrificationCarbonNitrogenAndAlkalinityLedgersClosed:
          Object.values(denitrificationResiduals).every(value =>
            Math.abs(value) < 1),
        floodplainDenitrificationOxygenGated: true,
        floodplainDenitrificationNitrogenLimited: true,
        floodplainDenitrificationSurfaceTemperatureProxyResponsive: false,
        floodplainDenitrificationQ10TemperatureResponseParameterized: true,
        floodplainDenitrificationPersistentWaterTemperatureState: true,
        floodplainDenitrificationArrheniusKineticsResolved: false,
        floodplainDenitrificationReactiveNitrateEquivalentParameterized:
          false,
        floodplainDenitrificationNitrateSpeciationResolved: true,
        persistentRiverAndFloodplainNitrateAmmoniumPools: true,
        exactNitrateAmmoniumWaterFractionTransport: true,
        parameterizedRunoffDinSpeciation: true,
        measuredRunoffDinSpeciation: false,
        floodplainDenitrificationNitrateOnly: true,
        floodplainDenitrificationAmmoniumConsumption: false,
        floodplainDenitrificationIndependentCreation: false,
        persistentFloodplainNitrification:
          floodplainNitrificationProcessReceipts.every(entry =>
            entry.schema === FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA),
        floodplainNitrificationOwnerReceiptsTyped:
          floodplainNitrificationReactionReceipts.every(entry =>
            entry.schema ===
              FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA),
        floodplainNitrificationScaleAwareNumericClosure:
          floodplainNitrificationReactionReceipts.every(entry =>
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.fixedAbsoluteToleranceOnly === false),
        floodplainNitrificationPerIdentityNumericBounds:
          floodplainNitrificationReactionReceipts.every(entry =>
            entry.truth?.perIdentityNumericBounds === true),
        floodplainNitrificationMeasuredResidualsPreserved:
          floodplainNitrificationReactionReceipts.every(entry =>
            entry.truth?.measuredResidualsPreserved === true),
        floodplainNitrificationEvidenceBound:
          floodplainNitrificationProcessReceipts.length ===
            floodplainNitrificationReactionReceipts.length &&
          floodplainNitrificationProcessReceipts.every(entry => {
            const owner = floodplainNitrificationReactionReceipts.find(
              candidate => candidate.transferId === entry.transferId);
            return owner?.digest === entry.reactionReceiptDigest &&
              owner?.reachId === entry.reachId;
          }),
        exactFloodplainNitrificationTransferIds:
          floodplainNitrificationProcessReceipts.every(entry =>
            floodplainNitrificationReactionReceipts.some(candidate =>
              candidate.transferId === entry.transferId &&
              candidate.reachId === entry.reachId)),
        floodplainNitrificationNitrogenOxygenAndAlkalinityLedgersClosed:
          Object.values(nitrificationResiduals).every(value =>
            Math.abs(value) < 1),
        floodplainNitrificationReactionModeled: true,
        floodplainNitrificationAmmoniumToNitrate: true,
        floodplainNitrificationDissolvedOxygenConsumed: true,
        floodplainNitrificationMinimumOxygenReserveHonored:
          floodplainNitrificationProcessReceipts.every(entry =>
            finite(entry.reaction?.dissolvedOxygenConsumedKgO2) <=
              finite(entry.activity?.reactiveDissolvedOxygenKgO2) +
                1e-7),
        floodplainNitrificationAlkalinityCapacityHonored:
          floodplainNitrificationProcessReceipts.every(entry =>
            finite(entry.reaction?.alkalinityDemandKgCaCO3) <=
              finite(entry.activity?.availableAlkalinityKgCaCO3Eq) +
                1e-7),
        floodplainNitrificationSurfaceTemperatureProxyResponsive: false,
        floodplainNitrificationQ10TemperatureResponseParameterized: true,
        floodplainNitrificationPersistentWaterTemperatureState: true,
        floodplainNitrificationNitriteIntermediateResolved: false,
        floodplainNitrificationAlkalinityDemandDiagnostic: false,
        floodplainNitrificationAlkalinityMaterialOwnerDebited: true,
        persistentEndToEndAlkalinityLedger: true,
        alkalinityIsAcidNeutralizingCapacityEquivalent: true,
        alkalinityCarbonateSpeciationResolved: false,
        alkalinityPHResolved: false,
        floodplainNitrificationPHFeedbackModeled: false,
        floodplainNitrificationIndependentCreation: false,
        persistentFloodplainAtmosphereGasExchange:
          floodplainGasExchangeProcessReceipts.every(entry =>
            entry.schema ===
              FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA),
        floodplainGasExchangeOwnerReceiptsTyped:
          floodplainGasExchangeReceipts.every(entry =>
            entry.schema === FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA) &&
          atmosphereFloodplainGasExchangeReceipts.every(entry =>
            entry.schema ===
              ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA),
        floodplainGasExchangeScaleAwareNumericClosure:
          floodplainGasExchangeReceipts.every(entry =>
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.fixedAbsoluteToleranceOnly === false),
        floodplainGasExchangePerIdentityNumericBounds:
          floodplainGasExchangeReceipts.every(entry =>
            entry.truth?.perIdentityNumericBounds === true),
        floodplainGasExchangeMeasuredResidualsPreserved:
          floodplainGasExchangeReceipts.every(entry =>
            entry.truth?.measuredResidualsPreserved === true),
        atmosphereFloodplainGasExchangeScaleAwareNumericClosure:
          atmosphereFloodplainGasExchangeReceipts.every(entry =>
            entry.truth?.scaleAwareFloatingPointClosure === true &&
            entry.truth?.fixedAbsoluteToleranceOnly === false),
        atmosphereFloodplainGasExchangePerIdentityNumericBounds:
          atmosphereFloodplainGasExchangeReceipts.every(entry =>
            entry.truth?.perIdentityNumericBounds === true),
        atmosphereFloodplainGasExchangeMeasuredResidualsPreserved:
          atmosphereFloodplainGasExchangeReceipts.every(entry =>
            entry.truth?.measuredResidualsPreserved === true),
        floodplainGasExchangeEvidenceBound:
          floodplainGasExchangeProcessReceipts.every(entry => {
            if (entry.atmosphereCellId == null) {
              return entry.floodplainReceiptDigest == null &&
                entry.atmosphereReceiptDigest == null;
            }
            const floodplainOwner = floodplainGasExchangeReceipts.find(
              candidate => candidate.exchangeId === entry.exchangeId);
            const atmosphereOwner =
              atmosphereFloodplainGasExchangeReceipts.find(candidate =>
                candidate.exchangeId === entry.exchangeId);
            return floodplainOwner?.digest ===
                entry.floodplainReceiptDigest &&
              atmosphereOwner?.digest === entry.atmosphereReceiptDigest;
          }),
        exactFloodplainAtmosphereGasExchangeIds:
          floodplainGasExchangeReceipts.length ===
            atmosphereFloodplainGasExchangeReceipts.length &&
          floodplainGasExchangeReceipts.every(entry =>
            atmosphereFloodplainGasExchangeReceipts.some(candidate =>
              candidate.exchangeId === entry.exchangeId &&
              candidate.reachId === entry.reachId &&
              candidate.atmosphereCellId === entry.atmosphereCellId)),
        floodplainAtmosphereGasExchangeLedgersClosed:
          Object.values(gasExchangeResiduals).every(value =>
            Math.abs(value) < 1),
        floodplainGasExchangeUsesNativeAtmosphereSurfaceLayer:
          atmosphereFloodplainGasExchangeReceipts.every(entry =>
            entry.truth?.surfaceLayerOnly === true &&
            entry.atmosphereCarbonCredit?.nativeLayerIndex === 0 &&
            entry.atmosphereCarbonDebit?.nativeLayerIndex === 0 &&
            entry.atmosphereOxygenDebit?.nativeLayerIndex === 0),
        floodplainGasExchangePhysicalWithLifeOff: true,
        floodplainGasExchangeIndependentCreation: false,
        floodplainGasExchangeBidirectionalCarbonGradientParameterized: true,
        floodplainGasExchangeBidirectionalHenryLawSolved: false,
        floodplainGasExchangeResolvedAirWaterTurbulence: false,
        grainSelectiveRiverAndMouthDeposition: true,
        sedimentScaleAwareNumericClosure: sedimentOwnerReceipts.every(entry =>
          entry.truth?.scaleAwareFloatingPointClosure === true &&
          entry.truth?.fixedAbsoluteToleranceOnly === false),
        sedimentPerGrainNumericBounds: sedimentOwnerReceipts.every(entry =>
          entry.truth?.perGrainNumericBounds === true),
        sedimentMeasuredResidualsPreserved: sedimentOwnerReceipts.every(entry =>
          entry.truth?.measuredResidualsPreserved === true),
        exactLandRunoffRiverSedimentTransferIds: inletReceipts.every(entry =>
          entry.runoffSedimentSenderDebit?.transferId ===
            entry.riverSedimentInput?.transferId &&
          entry.transferId === entry.riverSedimentInput?.transferId),
        riverSedimentSenderDebitsAndReceiverCredits: routeReceipts.every(entry =>
          entry.schema === RIVER_REACH_TRANSFER_SCHEMA
            ? entry.sedimentTransfer?.senderDebited === true &&
              entry.sedimentTransfer?.receiverCredited === true
            : entry.riverSedimentSenderDebitAndDeposition?.truth
                ?.senderDebited === true &&
              entry.coastalSedimentReceiverCredit?.truth
                ?.receiverCredited === true),
        sedimentMassConservationClosed:
          ['clay', 'silt', 'sand', 'gravel'].every(grain =>
            aggregateMassClosure.identities[
              `coupled${grain[0].toUpperCase()}${grain.slice(1)}ResidualKg`
            ].closed) &&
          sedimentOwnerReceipts.every(entry =>
            entry.truth?.scaleAwareFloatingPointClosure === true),
        reachChemistrySenderDebits: true,
        riverOceanChemistryCoupledClosure: true,
        persistentEstuarySedimentReservoirs: true,
        explicitEstuaryNitrogenGasBoundary: true,
        explicitEstuaryAtmosphericGasReceiver: true,
        persistentEstuaryNitrogenGasReceiver: true,
        oceanDeliveryRequiresLoadedMouthCell: true,
        unresolvedReachWaterRetained: true,
        unresolvedReachSedimentRetained: true,
        unresolvedReachFloodplainRetained: true,
        unresolvedReachFloodplainThermalRetained: true,
        unresolvedReachFloodplainPlantMatterRetained: true,
        unresolvedReachFloodplainPlantResourcesRetained: true,
        unresolvedReachFloodplainDecompositionRetained: true,
        unresolvedReachFloodplainRespirationRetained: true,
        unresolvedReachFloodplainDenitrificationRetained: true,
        unresolvedReachFloodplainGasExchangeRetained: true,
        resolvedFloodplainInundationHydraulics: false,
        resolvedChannelMorphodynamics: false,
        resolvedCoastalMorphodynamics: false,
        globalBasinNetwork: false,
        scientificRiverForecast: false
      }
    };
    receipt.digest = stableDigest(receipt);
    this.profiles.set(profileId, working);
    this.receipts.set(profileId, clone(receipt));
    return { columns: columns.map(clone), receipt: clone(receipt) };
  }

  decorateSector(sector, profileId) {
    if (!sector || sector.schema !== HYDROLOGY_SCHEMA) return sector;
    const profile = this.profiles.get(profileId);
    const receipt = this.receipts.get(profileId) || null;
    const routedByReach = new Map();
    for (const route of receipt?.routeReceipts || []) {
      const amountKg = finite(route.routedWaterKg, finite(route.deliveredFreshwaterKg));
      routedByReach.set(route.sourceReachId, amountKg /
        Math.max(1, finite(receipt.durationDays) * 86_400 * 1000));
    }
    const rivers = sector.rivers.map(reach => {
      const state = profile?.reaches.get(reach.id);
      return {
        ...reach,
        channelStorageKg: state?.storageKg || 0,
        channelChemistry: state ? riverChemistryTotals(state.chemistry) :
          { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0,
            oxygenKgO2: 0, alkalinityKgCaCO3Eq: 0 },
        channelNitrogenSpecies: state ? (() => {
          const species = riverNitrogenSpecies(state.chemistry);
          return {
            nitrateNitrogenKgN: round(
              species.dissolvedNitrateNitrogenKgN, 9),
            ammoniumNitrogenKgN: round(
              species.dissolvedAmmoniumNitrogenKgN, 9),
            dissolvedInorganicNitrogenKgN: round(
              species.dissolvedInorganicNitrogenKgN, 9)
          };
        })() : {
          nitrateNitrogenKgN: 0,
          ammoniumNitrogenKgN: 0,
          dissolvedInorganicNitrogenKgN: 0
        },
        channelSediment: state ? riverSedimentTotals(state.sediment) :
          { suspendedKg: { clay: 0, silt: 0, sand: 0, gravel: 0 },
            bedDepositKg: { clay: 0, silt: 0, sand: 0, gravel: 0 },
            totalKg: 0 },
        floodplain: state ? floodplainTotals(state.floodplain) :
          floodplainTotals(emptyFloodplainState()),
        floodplainLastExchange: state?.floodplain?.lastExchangeReceipt ?
          clone(state.floodplain.lastExchangeReceipt) : null,
        floodplainThermal: state ? floodplainThermalSummary(
          state.floodplainThermal) : floodplainThermalSummary(
          emptyFloodplainThermalState()),
        floodplainThermalLastTransition:
          state?.floodplainThermal?.lastTransitionReceipt
            ? clone(state.floodplainThermal.lastTransitionReceipt) : null,
        floodplainHabitat: state ? floodplainHabitatSummary(
          state.floodplainHabitat) : floodplainHabitatSummary(
          emptyFloodplainHabitatState()),
        floodplainHabitatLastTransition:
          state?.floodplainHabitat?.lastTransitionReceipt
            ? clone(state.floodplainHabitat.lastTransitionReceipt) : null,
        floodEvents: state ? floodEventHistorySummary(
          state.floodEvents) : floodEventHistorySummary(
          emptyFloodEventHistoryState()),
        floodEventLastTransition:
          state?.floodEvents?.lastTransitionReceipt
            ? clone(state.floodEvents.lastTransitionReceipt) : null,
        floodplainSuccession: state ? floodplainSuccessionSummary(
          state.floodplainSuccession) : floodplainSuccessionSummary(
          emptyFloodplainSuccessionState()),
        floodplainSuccessionLastTransition:
          state?.floodplainSuccession?.lastTransitionReceipt
            ? clone(state.floodplainSuccession.lastTransitionReceipt) : null,
        floodplainPlantMatter: state ? floodplainPlantMatterSummary(
          state.floodplainPlantMatter) : floodplainPlantMatterSummary(
          emptyFloodplainPlantMatterState()),
        floodplainPlantMatterLastTransition:
          state?.floodplainPlantMatter?.lastTransitionReceipt
            ? clone(state.floodplainPlantMatter.lastTransitionReceipt) : null,
        floodplainPlantResources: state ? floodplainPlantResourcesSummary(
          state.floodplainPlantResources) : floodplainPlantResourcesSummary(
          emptyFloodplainPlantResourcesState()),
        floodplainPlantResourcesLastTransition:
          state?.floodplainPlantResources?.lastTransitionReceipt
            ? clone(state.floodplainPlantResources.lastTransitionReceipt)
            : null,
        floodplainDecomposition: state ? floodplainDecompositionSummary(
          state.floodplainDecomposition) : floodplainDecompositionSummary(
          emptyFloodplainDecompositionState()),
        floodplainDecompositionLastTransition:
          state?.floodplainDecomposition?.lastTransitionReceipt
            ? clone(state.floodplainDecomposition.lastTransitionReceipt)
            : null,
        floodplainRespiration: state ? floodplainRespirationSummary(
          state.floodplainRespiration) : floodplainRespirationSummary(
          emptyFloodplainRespirationState()),
        floodplainRespirationLastTransition:
          state?.floodplainRespiration?.lastTransitionReceipt
            ? clone(state.floodplainRespiration.lastTransitionReceipt)
            : null,
        floodplainDenitrification: state ?
          floodplainDenitrificationSummary(
            state.floodplainDenitrification) :
          floodplainDenitrificationSummary(
            emptyFloodplainDenitrificationState()),
        floodplainDenitrificationLastTransition:
          state?.floodplainDenitrification?.lastTransitionReceipt
            ? clone(state.floodplainDenitrification.lastTransitionReceipt)
            : null,
        floodplainNitrification: state ?
          floodplainNitrificationSummary(
            state.floodplainNitrification) :
          floodplainNitrificationSummary(
            emptyFloodplainNitrificationState()),
        floodplainNitrificationLastTransition:
          state?.floodplainNitrification?.lastTransitionReceipt
            ? clone(state.floodplainNitrification.lastTransitionReceipt)
            : null,
        floodplainGasExchange: state ? floodplainGasExchangeSummary(
          state.floodplainGasExchange) : floodplainGasExchangeSummary(
          emptyFloodplainGasExchangeState()),
        floodplainGasExchangeLastTransition:
          state?.floodplainGasExchange?.lastTransitionReceipt
            ? clone(state.floodplainGasExchange.lastTransitionReceipt)
            : null,
        estuaryStorage: state ? estuaryStorageTotals(state.estuary) :
          { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0,
            oxygenKgO2: 0, alkalinityKgCaCO3Eq: 0,
            cumulativeAlkalinityGeneratedKgCaCO3Eq: 0 },
        estuaryLastFlux: state?.estuary?.lastFluxReceipt ?
          clone(state.estuary.lastFluxReceipt) : null,
        cumulativeChannelInflowKg: state?.cumulativeInflowKg || 0,
        cumulativeChannelOutflowKg: state?.cumulativeOutflowKg || 0,
        routedDischargeM3s: routedByReach.get(reach.id) || 0
      };
    });
    const activeStates = rivers.filter(reach => reach.channelStorageKg > 0);
    return {
      ...sector,
      rivers,
      basinRouting: receipt ? clone(receipt) : null,
      summary: {
        ...sector.summary,
        activeChannelReachStates: activeStates.length,
        channelStorageKg: activeStates.reduce((sum, reach) => sum + reach.channelStorageKg, 0),
        channelChemistry: profile ? profileChemistry(profile) :
          { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0,
            oxygenKgO2: 0, alkalinityKgCaCO3Eq: 0 },
        channelSediment: profile ? profileSediment(profile) :
          emptySedimentTotals(),
        floodplain: profile ? profileFloodplain(profile) :
          profileFloodplain({ reaches: new Map() }),
        floodplainThermal: profile ? profileFloodplainThermal(profile) :
          profileFloodplainThermal({ reaches: new Map() }),
        floodplainHabitat: profile ? profileFloodplainHabitat(profile) :
          profileFloodplainHabitat({ reaches: new Map() }),
        floodEvents: profile ? profileFloodEvents(profile) :
          profileFloodEvents({ reaches: new Map() }),
        floodplainSuccession: profile ?
          profileFloodplainSuccession(profile) :
          profileFloodplainSuccession({ reaches: new Map() }),
        floodplainPlantMatter: profile ?
          profileFloodplainPlantMatter(profile) :
          profileFloodplainPlantMatter({ reaches: new Map() }),
        floodplainPlantResources: profile ?
          profileFloodplainPlantResources(profile) :
          profileFloodplainPlantResources({ reaches: new Map() }),
        floodplainDecomposition: profile ?
          profileFloodplainDecomposition(profile) :
          profileFloodplainDecomposition({ reaches: new Map() }),
        floodplainRespiration: profile ?
          profileFloodplainRespiration(profile) :
          profileFloodplainRespiration({ reaches: new Map() }),
        floodplainDenitrification: profile ?
          profileFloodplainDenitrification(profile) :
          profileFloodplainDenitrification({ reaches: new Map() }),
        floodplainNitrification: profile ?
          profileFloodplainNitrification(profile) :
          profileFloodplainNitrification({ reaches: new Map() }),
        floodplainGasExchange: profile ?
          profileFloodplainGasExchange(profile) :
          profileFloodplainGasExchange({ reaches: new Map() }),
        estuaryStorage: profile ? profileEstuaryStorage(profile) :
          { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0,
            oxygenKgO2: 0, alkalinityKgCaCO3Eq: 0,
            cumulativeAlkalinityGeneratedKgCaCO3Eq: 0 },
        riverToOceanKg: finite(receipt?.transfers?.riverToOceanKg),
        riverBoundaryRetentions: receipt?.boundaryReceipts?.length || 0
      },
      truth: {
        ...sector.truth,
        statefulBasinRouting: true,
        persistentRiverChemistry: true,
        persistentRiverSediment: true,
        grainSelectiveSedimentDeposition: true,
        persistentFloodplainStorage: true,
        bankfullOverbankAndReturnFlow: true,
        grainSelectiveFloodplainDeposition: true,
        persistentFloodplainWaterTemperatureState: true,
        persistentFloodplainSensibleHeatOwner: true,
        floodplainReactionTemperatureSourceShared: true,
        floodplainChannelWaterTemperatureResolved: false,
        floodplainExternalThermalBoundaryOwnerDebited: false,
        resolvedFloodplainFreezeThawState: false,
        persistentFloodplainHabitatMemory: true,
        floodplainHabitatPotentialOnly: true,
        floodplainHabitatReadsMaterialWithoutMutation: true,
        persistentBoundedFloodEventHistory: true,
        floodEventHistoryReadsMaterialWithoutMutation: true,
        persistentFloodplainSuccession: true,
        floodplainSuccessionFunctionalGuildState: true,
        floodplainSuccessionMaterialAuthority: false,
        persistentFloodplainPlantMatter: true,
        pairedLandEcologyFloodplainPlantMaterialOwnership: true,
        floodplainPlantMatterCarbonNitrogenOnly: true,
        floodplainPlantMatterPhosphorusAuthority: false,
        persistentFloodplainPlantResources: true,
        pairedFloodplainPlantWaterPhosphorusOwnership: true,
        plantGrowthJointlyCarbonNitrogenPhosphorusWaterLimited: true,
        persistentFloodplainDecomposition: true,
        pairedPlantDetritusFloodplainChemistryReturn: true,
        onlyResourceBackedDetritusDecomposes: true,
        decompositionAtmosphericRespirationModeled: false,
        decompositionOxygenConsumptionModeled: false,
        persistentFloodplainAerobicRespiration: true,
        oxygenLimitedFloodplainDocMineralization: true,
        localFloodplainDocToDicCarbonClosure: true,
        localFloodplainDissolvedOxygenConsumptionClosure: true,
        respirationAtmosphericGasExchangeModeled: false,
        respirationAnaerobicPathwayModeled: false,
        persistentFloodplainDenitrification: true,
        pairedFloodplainAtmosphereDenitrificationOwnership: true,
        oxygenGatedFloodplainDenitrification: true,
        nitrogenLimitedFloodplainDenitrification: true,
        surfaceTemperatureProxyResponsiveFloodplainDenitrification: false,
        q10TemperatureResponseParameterized: true,
        floodplainDenitrificationArrheniusKineticsResolved: false,
        floodplainDenitrificationNitrateSpeciationResolved: true,
        persistentRiverAndFloodplainNitrateAmmoniumPools: true,
        exactNitrateAmmoniumWaterFractionTransport: true,
        parameterizedRunoffDinSpeciation: true,
        measuredRunoffDinSpeciation: false,
        floodplainDenitrificationNitrateOnly: true,
        persistentFloodplainNitrification: true,
        floodplainNitrificationReactionModeled: true,
        floodplainNitrificationAmmoniumToNitrate: true,
        floodplainNitrificationDissolvedOxygenConsumed: true,
        floodplainNitrificationMinimumOxygenReserveHonored: true,
        floodplainNitrificationNitriteIntermediateResolved: false,
        floodplainNitrificationAlkalinityDemandDiagnostic: true,
        floodplainNitrificationAlkalinityMaterialOwnerDebited: false,
        floodplainNitrificationPHFeedbackModeled: false,
        persistentFloodplainAtmosphereGasExchange: true,
        pairedFloodplainAtmosphereGasOwnership: true,
        parameterizedFloodplainCo2EvasionAndOxygenReaeration: true,
        parameterizedFloodplainCo2Invasion: true,
        bidirectionalFloodplainAtmosphereCarbonGradientExchange: true,
        floodplainGasExchangeGloballyMixedAtmosphere: false,
        exactRiverChemistrySenderDebits: true,
        persistentEstuaryProcessing: true,
        oceanMouthReceipts: true,
        unresolvedReachWaterRetained: true
      }
    };
  }

  status(profileId) {
    const profile = this.profiles.get(profileId);
    return {
      schema: BASIN_ROUTING_ENGINE_SCHEMA,
      profileId,
      lastDay: profile?.lastDay ?? null,
      clockAlignmentCheckpoint: profile?.clockAlignmentCheckpoint ?
        clone(profile.clockAlignmentCheckpoint) : null,
      reachStateCount: profile?.reaches.size || 0,
      storedWaterKg: profile ? round(profileStorageKg(profile), 3) : 0,
      storedChannelWaterKg: profile ? round(profileChannelStorageKg(profile), 3) : 0,
      storedChemistry: profile ? Object.fromEntries(Object.entries(profileChemistry(profile))
        .map(([key, value]) => [key, round(value, 9)])) :
        { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0,
          oxygenKgO2: 0, alkalinityKgCaCO3Eq: 0,
          cumulativeAlkalinityGeneratedKgCaCO3Eq: 0 },
      storedNitrogenSpecies: profile ? Object.fromEntries(Object.entries(
        profileNitrogenSpecies(profile)).map(([key, value]) =>
        [key, round(value, 9)])) : {
        nitrateNitrogenKgN: 0, ammoniumNitrogenKgN: 0,
        dissolvedInorganicNitrogenKgN: 0
      },
      storedMineralSediment: profile ? Object.fromEntries(Object.entries(
        profileSediment(profile)).map(([key, value]) => [key, round(value, 9)])) :
        emptySedimentTotals(),
      storedFloodplain: profile ? clone(profileFloodplain(profile)) :
        profileFloodplain({ reaches: new Map() }),
      storedFloodplainThermal: profile ?
        clone(profileFloodplainThermal(profile)) :
        profileFloodplainThermal({ reaches: new Map() }),
      storedFloodplainHabitat: profile ?
        clone(profileFloodplainHabitat(profile)) :
        profileFloodplainHabitat({ reaches: new Map() }),
      storedFloodEvents: profile ? clone(profileFloodEvents(profile)) :
        profileFloodEvents({ reaches: new Map() }),
      storedFloodplainSuccession: profile ?
        clone(profileFloodplainSuccession(profile)) :
        profileFloodplainSuccession({ reaches: new Map() }),
      storedFloodplainPlantMatter: profile ?
        clone(profileFloodplainPlantMatter(profile)) :
        profileFloodplainPlantMatter({ reaches: new Map() }),
      storedFloodplainPlantResources: profile ?
        clone(profileFloodplainPlantResources(profile)) :
        profileFloodplainPlantResources({ reaches: new Map() }),
      storedFloodplainDecomposition: profile ?
        clone(profileFloodplainDecomposition(profile)) :
        profileFloodplainDecomposition({ reaches: new Map() }),
      storedFloodplainRespiration: profile ?
        clone(profileFloodplainRespiration(profile)) :
        profileFloodplainRespiration({ reaches: new Map() }),
      storedFloodplainDenitrification: profile ?
        clone(profileFloodplainDenitrification(profile)) :
        profileFloodplainDenitrification({ reaches: new Map() }),
      storedFloodplainNitrification: profile ?
        clone(profileFloodplainNitrification(profile)) :
        profileFloodplainNitrification({ reaches: new Map() }),
      storedFloodplainGasExchange: profile ?
        clone(profileFloodplainGasExchange(profile)) :
        profileFloodplainGasExchange({ reaches: new Map() }),
      storedEstuarySediment: profile ? Object.fromEntries(Object.entries(profileEstuaryStorage(profile))
        .map(([key, value]) => [key, round(value, 9)])) :
        { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0,
          oxygenKgO2: 0, alkalinityKgCaCO3Eq: 0 },
      receipt: this.receipts.has(profileId) ? clone(this.receipts.get(profileId)) : null
    };
  }

  snapshot() {
    return {
      schema: BASIN_ROUTING_ENGINE_SCHEMA,
      maximumReachStates: this.maximumReachStates,
      profiles: [...this.profiles.values()].sort((a, b) => a.profileId.localeCompare(b.profileId)).map(profile => ({
        profileId: profile.profileId,
        lastDay: profile.lastDay,
        clockAlignmentCheckpoint: profile.clockAlignmentCheckpoint ?
          clone(profile.clockAlignmentCheckpoint) : null,
        reaches: [...profile.reaches.values()].map(normalizedReachState).sort((a, b) => a.reachId.localeCompare(b.reachId))
      })),
      receipts: [...this.receipts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([profileId, receipt]) => ({
        profileId, receipt: clone(receipt)
      }))
    };
  }

  restore(state) {
    if (!state || ![
      BASIN_ROUTING_ENGINE_SCHEMA,
      PREVIOUS_BASIN_ROUTING_ENGINE_SCHEMA,
      'axm.foundation-planet.basin-routing-engine/v29',
      'axm.foundation-planet.basin-routing-engine/v28',
      'axm.foundation-planet.basin-routing-engine/v27',
      'axm.foundation-planet.basin-routing-engine/v26',
      'axm.foundation-planet.basin-routing-engine/v25',
      'axm.foundation-planet.basin-routing-engine/v24',
      'axm.foundation-planet.basin-routing-engine/v23',
      'axm.foundation-planet.basin-routing-engine/v22',
      'axm.foundation-planet.basin-routing-engine/v21',
      'axm.foundation-planet.basin-routing-engine/v20',
      'axm.foundation-planet.basin-routing-engine/v18',
      'axm.foundation-planet.basin-routing-engine/v17',
      'axm.foundation-planet.basin-routing-engine/v16',
      'axm.foundation-planet.basin-routing-engine/v15',
      'axm.foundation-planet.basin-routing-engine/v14',
      'axm.foundation-planet.basin-routing-engine/v13',
      'axm.foundation-planet.basin-routing-engine/v12',
      'axm.foundation-planet.basin-routing-engine/v11',
      'axm.foundation-planet.basin-routing-engine/v10',
      'axm.foundation-planet.basin-routing-engine/v9',
      'axm.foundation-planet.basin-routing-engine/v8',
      'axm.foundation-planet.basin-routing-engine/v7',
      'axm.foundation-planet.basin-routing-engine/v6',
      'axm.foundation-planet.basin-routing-engine/v5',
      'axm.foundation-planet.basin-routing-engine/v4',
      'axm.foundation-planet.basin-routing-engine/v3',
      'axm.foundation-planet.basin-routing-engine/v2',
      'axm.foundation-planet.basin-routing-engine/v1'
    ].includes(state.schema) || !Array.isArray(state.profiles)) return false;
    const migratedFromLegacy = ![
      BASIN_ROUTING_ENGINE_SCHEMA,
      PREVIOUS_BASIN_ROUTING_ENGINE_SCHEMA
    ].includes(state.schema);
    const migratedFromV1 = state.schema === 'axm.foundation-planet.basin-routing-engine/v1';
    const profiles = new Map();
    for (const candidate of state.profiles) {
      if (!candidate || typeof candidate.profileId !== 'string' || !Array.isArray(candidate.reaches)) continue;
      const reaches = new Map();
      for (const reach of candidate.reaches.slice(-this.maximumReachStates)) {
        if (!reach || typeof reach.reachId !== 'string') continue;
        const normalized = normalizedReachState(reach);
        if (migratedFromV1 && !reach.chemistry) normalized.chemistry.migrationCheckpoint = true;
        if (migratedFromLegacy && !reach.estuary) normalized.estuary.migrationCheckpoint = true;
        if (migratedFromLegacy && !reach.sediment) {
          normalized.sediment = emptyRiverSediment({ migrationCheckpoint: true });
        }
        if (migratedFromLegacy && !reach.floodplain) {
          normalized.floodplain = emptyFloodplainState({
            migrationCheckpoint: true
          });
        }
        if (!reach.floodplainThermal) {
          normalized.floodplainThermal = emptyFloodplainThermalState({
            migrationCheckpoint: true
          });
        }
        if (migratedFromLegacy && !reach.floodplainHabitat) {
          normalized.floodplainHabitat = emptyFloodplainHabitatState({
            migrationCheckpoint: true
          });
        }
        if (migratedFromLegacy && !reach.floodEvents) {
          normalized.floodEvents = emptyFloodEventHistoryState({
            migrationCheckpoint: true
          });
        }
        if (migratedFromLegacy && !reach.floodplainSuccession) {
          normalized.floodplainSuccession = emptyFloodplainSuccessionState({
            migrationCheckpoint: true
          });
        }
        if (migratedFromLegacy && !reach.floodplainPlantMatter) {
          normalized.floodplainPlantMatter =
            emptyFloodplainPlantMatterState({
              migrationCheckpoint: true
            });
        }
        if (migratedFromLegacy && !reach.floodplainPlantResources) {
          normalized.floodplainPlantResources =
            emptyFloodplainPlantResourcesState({
              migrationCheckpoint: true
            });
        }
        if (migratedFromLegacy && !reach.floodplainDecomposition) {
          normalized.floodplainDecomposition =
            emptyFloodplainDecompositionState({
              migrationCheckpoint: true
            });
        }
        if (migratedFromLegacy && !reach.floodplainRespiration) {
          normalized.floodplainRespiration =
            emptyFloodplainRespirationState({
              migrationCheckpoint: true
            });
        }
        if (migratedFromLegacy && !reach.floodplainDenitrification) {
          normalized.floodplainDenitrification =
            emptyFloodplainDenitrificationState({
              migrationCheckpoint: true
            });
        }
        if (migratedFromLegacy && !reach.floodplainNitrification) {
          normalized.floodplainNitrification =
            emptyFloodplainNitrificationState({
              migrationCheckpoint: true
            });
        }
        if (migratedFromLegacy && !reach.floodplainGasExchange) {
          normalized.floodplainGasExchange =
            emptyFloodplainGasExchangeState({
              migrationCheckpoint: true
            });
        }
        reaches.set(reach.reachId, normalized);
      }
      profiles.set(candidate.profileId, {
        profileId: candidate.profileId,
        lastDay: candidate.lastDay === null ? null : round(finite(candidate.lastDay), 8),
        clockAlignmentCheckpoint:
          candidate.clockAlignmentCheckpoint?.schema ===
            BASIN_CLOCK_ALIGNMENT_CHECKPOINT_SCHEMA ?
            clone(candidate.clockAlignmentCheckpoint) : null,
        reaches
      });
    }
    this.profiles = profiles;
    this.restoredProfileIds = new Set(profiles.keys());
    this.receipts = migratedFromLegacy ? new Map() :
      new Map((Array.isArray(state.receipts) ? state.receipts : [])
        .filter(entry => entry && typeof entry.profileId === 'string' &&
          entry.receipt?.schema === BASIN_ROUTING_STEP_SCHEMA)
        .map(entry => [entry.profileId, clone(entry.receipt)]));
    return true;
  }

  descriptor(profileId = null) {
    const profile = profileId ? this.profiles.get(profileId) : null;
    return {
      schema: BASIN_ROUTING_ENGINE_SCHEMA,
      maximumReachStates: this.maximumReachStates,
      activeProfiles: this.profiles.size,
      activeProfileId: profileId,
      activeProfileLastDay: profile?.lastDay ?? null,
      activeProfileClockAlignmentCheckpoint:
        profile?.clockAlignmentCheckpoint ?
          clone(profile.clockAlignmentCheckpoint) : null,
      activeProfileReachStates: profile?.reaches.size || 0,
      activeProfileStoredWaterKg: profile ? round(profileStorageKg(profile), 3) : 0,
      activeProfileChannelWaterKg: profile ?
        round(profileChannelStorageKg(profile), 3) : 0,
      activeProfileStoredChemistry: profile ? Object.fromEntries(Object.entries(profileChemistry(profile))
        .map(([key, value]) => [key, round(value, 9)])) :
        { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0,
          oxygenKgO2: 0, alkalinityKgCaCO3Eq: 0 },
      activeProfileStoredNitrogenSpecies: profile ?
        Object.fromEntries(Object.entries(profileNitrogenSpecies(profile))
          .map(([key, value]) => [key, round(value, 9)])) : {
          nitrateNitrogenKgN: 0, ammoniumNitrogenKgN: 0,
          dissolvedInorganicNitrogenKgN: 0
        },
      activeProfileStoredMineralSediment: profile ? Object.fromEntries(
        Object.entries(profileSediment(profile))
          .map(([key, value]) => [key, round(value, 9)])) :
        emptySedimentTotals(),
      activeProfileFloodplain: profile ? clone(profileFloodplain(profile)) :
        profileFloodplain({ reaches: new Map() }),
      activeProfileFloodplainThermal: profile ?
        clone(profileFloodplainThermal(profile)) :
        profileFloodplainThermal({ reaches: new Map() }),
      activeProfileFloodplainHabitat: profile ?
        clone(profileFloodplainHabitat(profile)) :
        profileFloodplainHabitat({ reaches: new Map() }),
      activeProfileFloodEvents: profile ?
        clone(profileFloodEvents(profile)) :
        profileFloodEvents({ reaches: new Map() }),
      activeProfileFloodplainSuccession: profile ?
        clone(profileFloodplainSuccession(profile)) :
        profileFloodplainSuccession({ reaches: new Map() }),
      activeProfileFloodplainPlantMatter: profile ?
        clone(profileFloodplainPlantMatter(profile)) :
        profileFloodplainPlantMatter({ reaches: new Map() }),
      activeProfileFloodplainPlantResources: profile ?
        clone(profileFloodplainPlantResources(profile)) :
        profileFloodplainPlantResources({ reaches: new Map() }),
      activeProfileFloodplainDecomposition: profile ?
        clone(profileFloodplainDecomposition(profile)) :
        profileFloodplainDecomposition({ reaches: new Map() }),
      activeProfileFloodplainRespiration: profile ?
        clone(profileFloodplainRespiration(profile)) :
        profileFloodplainRespiration({ reaches: new Map() }),
      activeProfileFloodplainDenitrification: profile ?
        clone(profileFloodplainDenitrification(profile)) :
        profileFloodplainDenitrification({ reaches: new Map() }),
      activeProfileFloodplainNitrification: profile ?
        clone(profileFloodplainNitrification(profile)) :
        profileFloodplainNitrification({ reaches: new Map() }),
      activeProfileFloodplainGasExchange: profile ?
        clone(profileFloodplainGasExchange(profile)) :
        profileFloodplainGasExchange({ reaches: new Map() }),
      activeProfileEstuaryStorage: profile ? Object.fromEntries(Object.entries(profileEstuaryStorage(profile))
        .map(([key, value]) => [key, round(value, 9)])) :
        { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0,
          oxygenKgO2: 0, alkalinityKgCaCO3Eq: 0,
          cumulativeAlkalinityGeneratedKgCaCO3Eq: 0 },
      deterministic: true,
      persistent: true
    };
  }
}

export function basinRoutingDescription() {
  return {
    engineSchema: BASIN_ROUTING_ENGINE_SCHEMA,
    stepSchema: BASIN_ROUTING_STEP_SCHEMA,
    aggregateMassClosureSchema: BASIN_AGGREGATE_MASS_CLOSURE_SCHEMA,
    aggregateMassClosurePolicy: {
      schema: BASIN_AGGREGATE_MASS_CLOSURE_POLICY_SCHEMA,
      absoluteFloorKg:
        BASIN_AGGREGATE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
      ulpFactor: BASIN_AGGREGATE_MASS_CLOSURE_ULP_FACTOR,
      scaleBasis: 'sum-of-absolute-unrounded-signed-operands-kg'
    },
    clockAlignmentCheckpointSchema:
      BASIN_CLOCK_ALIGNMENT_CHECKPOINT_SCHEMA,
    inletReceiptSchema: BASIN_INLET_RECEIPT_SCHEMA,
    reachTransferSchema: RIVER_REACH_TRANSFER_SCHEMA,
    oceanMouthReceiptSchema: OCEAN_MOUTH_RECEIPT_SCHEMA,
    boundaryReceiptSchema: RIVER_BOUNDARY_RECEIPT_SCHEMA,
    floodplainStateSchema: FLOODPLAIN_STATE_SCHEMA,
    floodplainExchangeReceiptSchema: FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
    floodplainExchangeMassClosureSchema:
      FLOODPLAIN_EXCHANGE_MASS_CLOSURE_SCHEMA,
    floodplainExchangeMassClosurePolicy: {
      schema: FLOODPLAIN_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
      absoluteFloorsKg: {
        ...FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
      },
      ulpFactor: FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
      scaleBasis: 'sum-of-absolute-unrounded-signed-operands-kg'
    },
    floodplainThermalStateSchema: FLOODPLAIN_THERMAL_STATE_SCHEMA,
    floodplainThermalReceiptSchema: FLOODPLAIN_THERMAL_RECEIPT_SCHEMA,
    floodplainThermalEnergyClosureSchema:
      FLOODPLAIN_THERMAL_ENERGY_CLOSURE_SCHEMA,
    floodplainThermalEnergyClosurePolicySchema:
      FLOODPLAIN_THERMAL_ENERGY_CLOSURE_POLICY_SCHEMA,
    floodplainHabitatStateSchema: FLOODPLAIN_HABITAT_STATE_SCHEMA,
    floodplainHabitatReceiptSchema: FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
    floodEventHistoryStateSchema: FLOOD_EVENT_HISTORY_STATE_SCHEMA,
    floodEventTransitionReceiptSchema:
      FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA,
    floodplainSuccessionStateSchema: FLOODPLAIN_SUCCESSION_STATE_SCHEMA,
    floodplainSuccessionReceiptSchema:
      FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA,
    floodplainPlantMatterStateSchema:
      FLOODPLAIN_PLANT_MATTER_STATE_SCHEMA,
    floodplainPlantMatterReceiptSchema:
      FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
    floodplainPlantResourcesStateSchema:
      FLOODPLAIN_PLANT_RESOURCES_STATE_SCHEMA,
    floodplainPlantResourcesReceiptSchema:
      FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA,
    floodplainPlantResourceDebitSchema:
      FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
    floodplainPlantWaterReturnSchema:
      FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA,
    floodplainPlantDetritusMatterDebitSchema:
      FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA,
    floodplainPlantDetritusResourceDebitSchema:
      FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA,
    floodplainDetritalReturnCreditSchema:
      FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
    floodplainDetritalReturnMassClosurePolicySchema:
      FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA,
    floodplainDecompositionStateSchema:
      FLOODPLAIN_DECOMPOSITION_STATE_SCHEMA,
    floodplainDecompositionReceiptSchema:
      FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA,
    floodplainAerobicMineralizationReceiptSchema:
      FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
    floodplainRespirationStateSchema:
      FLOODPLAIN_RESPIRATION_STATE_SCHEMA,
    floodplainRespirationReceiptSchema:
      FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA,
    floodplainDenitrificationStateSchema:
      FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
    floodplainDenitrificationReceiptSchema:
      FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA,
    floodplainDenitrificationReactionReceiptSchema:
      FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
    floodplainNitrificationStateSchema:
      FLOODPLAIN_NITRIFICATION_STATE_SCHEMA,
    floodplainNitrificationReceiptSchema:
      FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA,
    floodplainNitrificationReactionReceiptSchema:
      FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
    floodplainGasExchangeStateSchema:
      FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
    floodplainGasExchangeProcessReceiptSchema:
      FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
    floodplainGasExchangeReceiptSchema:
      FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    floodplainReactionMassClosurePolicySchema:
      FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
    atmosphereFloodplainGasExchangeReceiptSchema:
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    atmosphereFloodplainGasExchangeMassClosurePolicySchema:
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
    landEcologySubgridBiomassDebitSchema:
      LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA,
    riverChemistry: riverChemistryDescription(),
    estuaryReactor: estuaryReactorDescription(),
    geomorphicSediment: geomorphicSedimentDescription(),
    floodplain: floodplainDescription(),
    floodplainThermal: floodplainThermalDescription(),
    floodplainHabitat: floodplainHabitatDescription(),
    floodEventHistory: floodEventHistoryDescription(),
    floodplainSuccession: floodplainSuccessionDescription(),
    floodplainPlantMatter: floodplainPlantMatterDescription(),
    floodplainPlantResources: floodplainPlantResourcesDescription(),
    floodplainDecomposition: floodplainDecompositionDescription(),
    floodplainRespiration: floodplainRespirationDescription(),
    floodplainDenitrification: floodplainDenitrificationDescription(),
    floodplainNitrification: floodplainNitrificationDescription(),
    floodplainGasExchange: floodplainGasExchangeDescription(),
    topology: 'loaded canonical hydrology reaches bridged from canonical Earth-system cells',
    processes: ['earth-cell-to-main-reach-capture', 'persistent-land-runoff-queue-sender-debit', 'parameterized-runoff-din-to-nitrate-ammonium-receiver-credit', 'exact-runoff-queue-to-river-chemistry-and-alkalinity-credit', 'exact-runoff-sediment-queue-to-river-suspended-load-credit', 'geometry-derived-bankfull-overbank-exchange', 'finite-channel-to-floodplain-nitrate-ammonium-alkalinity-transfer', 'finite-floodplain-to-channel-nitrate-ammonium-alkalinity-return', 'grain-selective-floodplain-deposition', 'persistent-floodplain-water-temperature-and-sensible-heat', 'net-water-owner-change-thermal-reconciliation', 'parameterized-external-floodplain-heat-boundary', 'shared-floodplain-reaction-temperature-state', 'read-only-bounded-flood-event-chronicle', 'read-only-flood-pulse-and-habitat-potential-observation', 'persistent-functional-guild-seed-juvenile-mature-succession', 'flood-disturbance-mortality-and-post-flood-recovery', 'paired-land-ecology-subgrid-to-floodplain-plant-carbon-nitrogen-partition', 'joint-carbon-nitrogen-phosphorus-water-limited-growth', 'paired-floodplain-to-plant-water-phosphorus-uptake', 'mortality-tissue-water-return-to-local-floodplain', 'live-plant-to-standing-dead-to-litter-transfer', 'resource-backed-standing-dead-and-litter-decomposition', 'paired-plant-detritus-to-local-floodplain-ammonium-return', 'oxygen-limited-local-floodplain-doc-to-dic-aerobic-mineralization', 'persistent-water-temperature-responsive-oxygen-gated-nitrate-only-floodplain-denitrification-with-alkalinity-generation', 'paired-floodplain-atmosphere-nitrogen-gas-transfer', 'persistent-water-temperature-responsive-bidirectional-floodplain-atmosphere-carbon-and-oxygen-exchange', 'persistent-water-temperature-responsive-oxygen-and-alkalinity-limited-ammonium-to-nitrate-floodplain-nitrification', 'nitrification-alkalinity-owner-debit', 'simultaneous-reach-water-nitrate-ammonium-alkalinity-chemistry-and-sediment-routing', 'grain-selective-river-bed-deposition', 'persistent-estuary-reaction-organic-sediment-retention-and-alkalinity-transmission', 'grain-selective-coastal-mineral-sediment-deposition', 'estuary-denitrification-alkalinity-generation-and-local-atmosphere-nitrogen-transfer', 'loaded-coastal-ocean-delivery-after-estuary-processing'],
    persistentReachStorage: true,
    persistentRiverSediment: true,
    persistentCoastalSediment: true,
    persistentFloodplainStorage: true,
    floodplainWaterChemistryAndSedimentConservationChecked: true,
    persistentFloodplainWaterTemperatureState: true,
    persistentFloodplainSensibleHeatOwner: true,
    floodplainThermalEnergyConservationChecked: true,
    floodplainThermalScaleAwareNumericClosure: true,
    floodplainThermalMeasuredResidualsPreserved: true,
    floodplainThermalFixedAbsoluteToleranceOnly: false,
    floodplainReactionTemperatureSourceShared: true,
    floodplainChannelWaterTemperatureResolved: false,
    floodplainExternalThermalBoundaryOwnerDebited: false,
    resolvedFloodplainFreezeThawState: false,
    persistentFloodplainHabitatMemory: true,
    floodplainHabitatPotentialOnly: true,
    floodplainHabitatMaterialObserverReadOnly: true,
    persistentBoundedFloodEventHistory: true,
    floodEventHistoryMaterialObserverReadOnly: true,
    persistentFloodplainSuccession: true,
    floodplainSuccessionFunctionalGuildDemography: true,
    floodplainSuccessionMaterialAuthority: false,
    persistentFloodplainPlantMatter: true,
    pairedLandEcologySubgridBiomassDebits: true,
    floodplainPlantMatterCarbonNitrogenConservationChecked: true,
    floodplainPlantMatterPhosphorusAuthority: false,
    persistentFloodplainPlantResources: true,
    pairedFloodplainPlantResourceDebitsAndWaterReturns: true,
    floodplainPlantWaterPhosphorusConservationChecked: true,
    floodplainPlantGrowthJointlyCarbonNitrogenPhosphorusWaterLimited: true,
    persistentFloodplainDecomposition: true,
    pairedPlantDetritusFloodplainChemistryReturn: true,
    onlyResourceBackedDetritusDecomposes: true,
    floodplainPlantResourceTranspiration: false,
    decompositionAtmosphericRespiration: false,
    decompositionOxygenConsumption: false,
    persistentFloodplainAerobicRespiration: true,
    floodplainRespirationLocalDocToDicCarbonClosure: true,
    floodplainRespirationDissolvedOxygenConsumptionClosure: true,
    floodplainRespirationOxygenLimited: true,
    floodplainRespirationAtmosphericGasExchange: false,
    floodplainRespirationAnaerobicPathway: false,
    persistentFloodplainDenitrification: true,
    pairedFloodplainAtmosphereDenitrificationOwnership: true,
    floodplainDenitrificationOxygenGated: true,
    floodplainDenitrificationNitrogenLimited: true,
    floodplainDenitrificationSurfaceTemperatureProxyResponsive: false,
    floodplainDenitrificationQ10TemperatureResponseParameterized: true,
    floodplainDenitrificationPersistentWaterTemperatureState: true,
    floodplainDenitrificationArrheniusKineticsResolved: false,
    floodplainDenitrificationReactiveNitrateEquivalentParameterized: false,
    floodplainDenitrificationNitrateSpeciationResolved: true,
    persistentRiverAndFloodplainNitrateAmmoniumPools: true,
    exactNitrateAmmoniumWaterFractionTransport: true,
    parameterizedRunoffDinSpeciation: true,
    measuredRunoffDinSpeciation: false,
    floodplainDenitrificationNitrateOnly: true,
    floodplainDenitrificationAmmoniumConsumption: false,
    persistentFloodplainNitrification: true,
    floodplainNitrificationReactionModeled: true,
    floodplainNitrificationAmmoniumToNitrate: true,
    floodplainNitrificationDissolvedOxygenConsumed: true,
    floodplainNitrificationMinimumOxygenReserveHonored: true,
    floodplainNitrificationSurfaceTemperatureProxyResponsive: false,
    floodplainNitrificationPersistentWaterTemperatureState: true,
    floodplainNitrificationQ10TemperatureResponseParameterized: true,
    floodplainNitrificationNitriteIntermediateResolved: false,
    floodplainNitrificationAlkalinityDemandDiagnostic: false,
    floodplainNitrificationAlkalinityMaterialOwnerDebited: true,
    persistentEndToEndAlkalinityLedger: true,
    alkalinityUnit: 'kg-CaCO3-equivalent',
    alkalinityCarbonateSpeciationResolved: false,
    alkalinityPHResolved: false,
    floodplainNitrificationPHFeedbackModeled: false,
    floodplainNitrificationMicrobialPopulationState: false,
    floodplainDenitrificationMicrobialPopulationState: false,
    persistentFloodplainAtmosphereGasExchange: true,
    pairedFloodplainAtmosphereGasOwnership: true,
    floodplainGasExchangeBidirectionalCarbonGradientParameterized: true,
    floodplainGasExchangeBidirectionalHenryLawSolved: false,
    floodplainSuccessionResolvedIndividuals: false,
    floodplainSuccessionScientificModel: false,
    sedimentMassConservationChecked: true,
    resolvedFloodplainInundationHydraulics: false,
    resolvedChannelMorphodynamics: false,
    unresolvedWaterRetained: true,
    parameterizedRiverBiogeochemistryBoundary: false,
    parameterizedLandRunoffChemistryBoundary: false,
    persistentLandRunoffBiogeochemistryQueue: true,
    exactLandRunoffBiogeochemistrySenderDebits: true,
    upstreamRiverChemistryReservoirs: true,
    exactReachAndOceanChemistrySenderDebits: true,
    persistentEstuarySedimentReservoirs: true,
    explicitEstuaryNitrogenGasBoundary: true,
    explicitEstuaryAtmosphericGasReceiver: true,
    resolvedEstuaryHydrodynamics: false,
    maximumStepDays: 1,
    globalBasinNetwork: false,
    scientificRiverForecast: false
  };
}
