import { HYDROLOGY_SCHEMA } from './hydrology-model.mjs';
import { EARTH_SYSTEM_COLUMN_SCHEMA, earthCellIdentity } from './earth-system.mjs';
import { earthCellAreaM2 } from './earth-transport.mjs';
import {
  applyRiverBiogeochemistryInput,
  oceanEcologyElementTotals
} from './ocean-ecology.mjs';
import {
  addRiverChemistry,
  chemistryElementInputs,
  emptyRiverChemistry,
  normalizeRiverChemistry,
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
  applyAtmosphereFloodplainGasExchange,
  applyAtmosphereGasBoundaryInput,
  normalizeAtmosphereBiogeochemistry,
  synchronizeAtmosphereCompatibilityMirrors
} from './atmosphere-biogeochemistry.mjs';
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
} from './geomorphic-sediment.mjs';
import {
  FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
  FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
  FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
  FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
  FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
  FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA,
  FLOODPLAIN_STATE_SCHEMA,
  applyFloodplainDetritalReturn,
  applyFloodplainAerobicMineralization,
  applyFloodplainGasExchange,
  applyFloodplainPlantResourceExchange,
  advanceFloodplainExchange,
  emptyFloodplainState,
  floodplainDescription,
  floodplainPlantResourceCapacity,
  floodplainTotals,
  normalizeFloodplainState
} from './floodplain.mjs';
import {
  FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
  FLOODPLAIN_HABITAT_STATE_SCHEMA,
  FLOODPLAIN_HABITAT_TYPES,
  advanceFloodplainHabitat,
  emptyFloodplainHabitatState,
  floodplainHabitatDescription,
  floodplainHabitatSummary,
  normalizeFloodplainHabitatState
} from './floodplain-habitat.mjs';
import {
  FLOOD_EVENT_HISTORY_STATE_SCHEMA,
  FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA,
  advanceFloodEventHistory,
  emptyFloodEventHistoryState,
  floodEventHistoryDescription,
  floodEventHistorySummary,
  normalizeFloodEventHistoryState
} from './flood-event-history.mjs';
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
} from './floodplain-plant-matter.mjs';
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
} from './floodplain-plant-resources.mjs';
import {
  FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA,
  FLOODPLAIN_DECOMPOSITION_STATE_SCHEMA,
  advanceFloodplainDecomposition,
  emptyFloodplainDecompositionState,
  floodplainDecompositionDescription,
  floodplainDecompositionPlan,
  floodplainDecompositionSummary,
  normalizeFloodplainDecompositionState
} from './floodplain-decomposition.mjs';
import {
  FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA,
  FLOODPLAIN_RESPIRATION_STATE_SCHEMA,
  advanceFloodplainRespiration,
  emptyFloodplainRespirationState,
  floodplainRespirationDescription,
  floodplainRespirationPlan,
  floodplainRespirationSummary,
  normalizeFloodplainRespirationState
} from './floodplain-respiration.mjs';
import {
  FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
  FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
  advanceFloodplainGasExchange,
  emptyFloodplainGasExchangeState,
  floodplainGasExchangeDescription,
  floodplainGasExchangePlan,
  floodplainGasExchangeSummary,
  normalizeFloodplainGasExchangeState
} from './floodplain-gas-exchange.mjs';

export const BASIN_ROUTING_ENGINE_SCHEMA = 'axm.foundation-planet.basin-routing-engine/v15';
export const PREVIOUS_BASIN_ROUTING_ENGINE_SCHEMA =
  'axm.foundation-planet.basin-routing-engine/v14';
export const BASIN_ROUTING_STEP_SCHEMA = 'axm.foundation-planet.basin-routing-step/v15';
export const PREVIOUS_BASIN_ROUTING_STEP_SCHEMA =
  'axm.foundation-planet.basin-routing-step/v14';
export const BASIN_INLET_RECEIPT_SCHEMA = 'axm.foundation-planet.basin-inlet-receipt/v5';
export const RIVER_REACH_TRANSFER_SCHEMA = 'axm.foundation-planet.river-reach-transfer/v4';
export const OCEAN_MOUTH_RECEIPT_SCHEMA = 'axm.foundation-planet.ocean-mouth-receipt/v5';
export const RIVER_BOUNDARY_RECEIPT_SCHEMA = 'axm.foundation-planet.river-boundary-receipt/v1';

const CLOCK_TOLERANCE_DAYS = 1e-6;
const EARTH_RADIUS_M = 6_371_000;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = value => JSON.parse(JSON.stringify(value));
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));

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
    floodplainHabitat: emptyFloodplainHabitatState(),
    floodEvents: emptyFloodEventHistoryState(),
    floodplainSuccession: emptyFloodplainSuccessionState(),
    floodplainPlantMatter: emptyFloodplainPlantMatterState(),
    floodplainPlantResources: emptyFloodplainPlantResourcesState(),
    floodplainDecomposition: emptyFloodplainDecompositionState(),
    floodplainRespiration: emptyFloodplainRespirationState(),
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
  const totals = { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 };
  for (const state of profile.reaches.values()) {
    const chemistry = riverChemistryTotals(state.chemistry);
    const floodplain = floodplainTotals(state.floodplain).chemistry;
    for (const key of Object.keys(totals)) {
      totals[key] += chemistry[key] + floodplain[key];
    }
  }
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
      phosphorusKgP: 0, oxygenKgO2: 0 },
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
      (exchange.lastActivity.exchangeableDicKgC > 1e-12 ||
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
  const totals = { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 };
  for (const state of profile.reaches.values()) {
    const estuary = estuaryStorageTotals(state.estuary);
    for (const key of Object.keys(totals)) totals[key] += estuary[key];
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
    oxygenKgO2: 0
  };
  for (const column of columns) {
    if (column.kind !== 'land') continue;
    const pools = runoffBiogeochemistryAbsolutePools(
      column.routing?.runoffBiogeochemistryQueue,
      earthCellAreaM2(column)
    );
    const elements = runoffBiogeochemistryAbsoluteElements(pools);
    for (const key of Object.keys(totals)) totals[key] += elements[
      key.replace(/Kg(C|N|P|O2)$/, '')
    ] || 0;
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
    oxygenKgO2: 0
  };
  for (const column of columns) {
    if (column.kind !== 'ocean' || !column.ocean?.ecology) continue;
    const areaM2 = earthCellAreaM2(column);
    const elements = oceanEcologyElementTotals(column.ocean.ecology);
    totals.carbonKgC += elements.carbonKgCm2 * areaM2;
    totals.nitrogenKgN += elements.nitrogenKgNm2 * areaM2;
    totals.phosphorusKgP += elements.phosphorusKgPm2 * areaM2;
    totals.oxygenKgO2 += elements.oxygenKgO2m2 * areaM2;
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
    return sum + finite(state.cumulative?.estuaryNitrogenGasInputKgNm2) *
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
    if (options.state) this.restore(options.state);
  }

  profile(profileId) {
    let profile = this.profiles.get(profileId);
    if (!profile) {
      profile = { profileId, lastDay: null, reaches: new Map() };
      this.profiles.set(profileId, profile);
    }
    return profile;
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
    const initialRiverSediment = profileSediment(working);
    const initialFloodplain = profileFloodplain(working);
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
    const initialFloodplainGasExchange =
      profileFloodplainGasExchange(working);
    const initialEstuaryStorage = profileEstuaryStorage(working);
    const reachById = new Map(reaches.map(reach => [reach.id, reach]));
    const floodplainReceipts = [];
    const floodplainHabitatReceipts = [];
    const floodEventReceipts = [];
    const floodplainSuccessionReceipts = [];
    const floodplainPlantMatterReceipts = [];
    const floodplainPlantResourcesReceipts = [];
    const floodplainDecompositionReceipts = [];
    const floodplainRespirationReceipts = [];
    const floodplainAerobicMineralizationReceipts = [];
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
      const donorCellId = reachDonorCellId(reach,
        columns[0].resolutionDeg);
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
      const gasExchangePlan = floodplainGasExchangePlan(
        pending.state.floodplainGasExchange,
        pending.state.floodplain,
        atmosphereColumn?.atmosphere?.biogeochemistry,
        {
          durationDays,
          atmosphereAvailable,
          receivingAreaM2: atmosphereAreaM2,
          pressureColumn: atmosphereColumn?.atmosphere?.pressureColumn,
          waterTemperatureC: finite(
            atmosphereColumn?.surface?.temperatureC, 15),
          maximumDailyEquilibrationFraction: finite(
            options.maximumFloodplainDailyGasEquilibrationFraction, .35),
          exchangeableDicFraction: finite(
            options.floodplainExchangeableDicFraction, .025)
        });
      const gasExchangeId = transferId(
        'floodplain-atmosphere-gas-exchange', startDay,
        pending.reach.id, pending.donorCellId,
        gasExchangePlan.exchange.carbonToAtmosphereKgC +
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
      floodplainGasExchangeProcessReceipts.push(gasExchange.receipt);
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
        { transferId: id, sourceCellId: column.id, reachId: reach.id }
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
        storedGasExchange.observedExchangeDays <= 1e-12 &&
        storedGasExchange.atmosphereUnavailableDays <= 1e-12 &&
        storedGasExchange.cumulativeExchange
          .carbonToAtmosphereKgC <= 1e-9 &&
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
          retainedFloodplainGasExchangeObservedDays: round(
            storedGasExchange.observedExchangeDays, 8),
          retainedFloodplainGasExchangeAtmosphereUnavailableDays: round(
            storedGasExchange.atmosphereUnavailableDays, 8),
          retainedFloodplainCarbonEvadedKgC: round(
            storedGasExchange.cumulativeExchange
              .carbonToAtmosphereKgC, 9),
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
      oxygenKgO2: 0
    };
    const estuaryBoundaryFluxes = {
      denitrifiedNitrogenKgN: 0,
      oxygenConsumptionKgO2: 0
    };
    const estuaryRiverInputs = {
      carbonKgC: 0,
      nitrogenKgN: 0,
      phosphorusKgP: 0,
      oxygenKgO2: 0
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
        for (const key of Object.keys(estuaryRiverInputs)) {
          estuaryRiverInputs[key] += finite(estuaryInputElements[key]);
        }
        estuaryBoundaryFluxes.denitrifiedNitrogenKgN += finite(
          estuaryResult.receipt.transformations.denitrifiedNitrogenKgN);
        estuaryBoundaryFluxes.oxygenConsumptionKgO2 += finite(
          estuaryResult.receipt.transformations.oxygenConsumedKgO2);
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
          { ocean: ocean.ocean, explicitInputsKg: estuaryResult.transmitted }
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
      state.floodplainPlantMatter = normalizeFloodplainPlantMatterState(
        state.floodplainPlantMatter);
      state.floodplainPlantResources =
        normalizeFloodplainPlantResourcesState(
          state.floodplainPlantResources);
      state.estuary = normalizeEstuaryState(state.estuary);
      for (const pool of [
        'dissolvedInorganicCarbonKgC', 'dissolvedOrganicCarbonKgC',
        'dissolvedInorganicNitrogenKgN', 'dissolvedInorganicPhosphorusKgP',
        'dissolvedOxygenKgO2'
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
    const finalRiverSediment = profileSediment(working);
    const finalFloodplain = profileFloodplain(working);
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
        finite(receipt.riverChemistryInput?.inputs?.oxygenKgO2), 0)
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
    const floodplainGasExchangeFluxes = {
      carbonToAtmosphereKgC: floodplainGasExchangeReceipts.reduce(
        (sum, receipt) => sum + finite(
          receipt.exchange?.carbonToAtmosphereKgC), 0),
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
        initialOceanEcology.oxygenKgO2 - oceanEcologyBoundaryInputs.oxygenKgO2
    };
    const riverChemistryResiduals = {
      riverCarbonResidualKgC: finalRiverChemistry.carbonKgC -
        initialRiverChemistry.carbonKgC - landRunoffBiogeochemistryInputs.carbonKgC -
        detritalReturnInputs.carbonKgC +
        estuaryRiverInputs.carbonKgC +
        floodplainGasExchangeFluxes.carbonToAtmosphereKgC,
      riverNitrogenResidualKgN: finalRiverChemistry.nitrogenKgN -
        initialRiverChemistry.nitrogenKgN - landRunoffBiogeochemistryInputs.nitrogenKgN -
        detritalReturnInputs.nitrogenKgN +
        estuaryRiverInputs.nitrogenKgN,
      riverPhosphorusResidualKgP: finalRiverChemistry.phosphorusKgP -
        initialRiverChemistry.phosphorusKgP - landRunoffBiogeochemistryInputs.phosphorusKgP -
        detritalReturnInputs.phosphorusKgP +
        estuaryRiverInputs.phosphorusKgP,
      riverOxygenResidualKgO2: finalRiverChemistry.oxygenKgO2 -
        initialRiverChemistry.oxygenKgO2 - landRunoffBiogeochemistryInputs.oxygenKgO2 +
        estuaryRiverInputs.oxygenKgO2 +
        floodplainRespirationFluxes.dissolvedOxygenConsumedKgO2 -
        floodplainGasExchangeFluxes.oxygenToFloodplainKgO2
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
        landRunoffBiogeochemistryInputs.oxygenKgO2
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
        estuaryBoundaryFluxes.oxygenConsumptionKgO2
    };
    const coupledChemistryResiduals = {
      coupledCarbonResidualKgC: finalRunoffBiogeochemistry.carbonKgC +
        finalRiverChemistry.carbonKgC + finalOceanEcology.carbonKgC +
        finalEstuaryStorage.carbonKgC - initialRiverChemistry.carbonKgC -
        initialRunoffBiogeochemistry.carbonKgC - initialOceanEcology.carbonKgC -
        initialEstuaryStorage.carbonKgC - detritalReturnInputs.carbonKgC +
        floodplainGasExchangeFluxes.carbonToAtmosphereKgC,
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
        floodplainRespirationFluxes.dissolvedOxygenConsumedKgO2 -
        floodplainGasExchangeFluxes.oxygenToFloodplainKgO2
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
    const gasExchangeResiduals = {
      floodplainAtmosphereCarbonTransferResidualKgC:
        floodplainGasExchangeReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.exchange?.carbonToAtmosphereKgC), 0) -
        atmosphereFloodplainGasExchangeReceipts.reduce((sum, receipt) =>
          sum + finite(receipt.exchange?.carbonToAtmosphereKgC), 0),
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
    inletReceipts.sort((a, b) => a.sender.earthCellId.localeCompare(b.sender.earthCellId));
    floodplainReceipts.sort((a, b) => String(a.reachId)
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
      floodplainGasExchangeReceipts,
      atmosphereFloodplainGasExchangeReceipts,
      floodplainGasExchangeProcessReceipts,
      routeReceipts,
      boundaryReceipts,
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
        floodplainAtmosphereGasExchange: {
          carbonToAtmosphereKgC: round(
            floodplainGasExchangeFluxes.carbonToAtmosphereKgC, 9),
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
        ...Object.fromEntries(Object.entries(gasExchangeResiduals)
          .map(([key, value]) => [key, round(value, 9)])),
        ...Object.fromEntries(Object.entries(sedimentResiduals)
          .map(([key, value]) => [key, round(value, 6)]))
      },
      truth: {
        pairedEarthCellAndReachReceipts: true,
        simultaneousReachRouting: true,
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
        upstreamRiverChemistryReservoirs: true,
        persistentRiverSuspendedAndBedSediment: true,
        persistentFloodplainWaterChemistryAndSediment: true,
        geometryDerivedBankfullExchange: true,
        finiteFloodplainReturnFlow: true,
        grainSelectiveFloodplainDeposition: true,
        floodplainExchangeConservationClosed: floodplainReceipts.every(entry =>
          entry.schema === FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA &&
          entry.truth?.conservationClosed === true),
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
            entry.truth?.carbonAndNitrogenClosed === true),
        landEcologySubgridSenderDebited:
          landEcologySubgridDebitReceipts.every(entry =>
            entry.schema === LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA &&
            entry.truth?.persistentLandEcologySenderDebited === true &&
            entry.truth?.carbonAndNitrogenClosed === true),
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
          Math.abs(coupledPlantMatterResiduals
            .loadedLandFloodplainPlantCarbonResidualKgC) < 1 &&
          Math.abs(coupledPlantMatterResiduals
            .loadedLandFloodplainPlantNitrogenResidualKgN) < 1,
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
            entry.truth?.resourceLedgersClosed === true),
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
            entry.truth?.carbonNitrogenPhosphorusClosed === true),
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
        floodplainRespirationCarbonAndOxygenLedgersClosed:
          Object.values(respirationResiduals).every(value =>
            Math.abs(value) < 1),
        floodplainRespirationOxygenLimited:
          floodplainRespirationReceipts.every(entry =>
            entry.truth?.oxygenLimited === true),
        floodplainRespirationIndependentCreation: false,
        floodplainRespirationAtmosphericGasExchangeModeled: false,
        floodplainRespirationAnaerobicPathwayModeled: false,
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
            entry.senderDebit?.nativeLayerIndex === 0 &&
            entry.receiverCredit?.nativeLayerIndex === 0),
        floodplainGasExchangePhysicalWithLifeOff: true,
        floodplainGasExchangeIndependentCreation: false,
        floodplainGasExchangeBidirectionalHenryLawSolved: false,
        floodplainGasExchangeResolvedAirWaterTurbulence: false,
        grainSelectiveRiverAndMouthDeposition: true,
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
        sedimentMassConservationClosed: Object.values(sedimentResiduals)
          .every(value => Math.abs(value) < 1),
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
        unresolvedReachFloodplainPlantMatterRetained: true,
        unresolvedReachFloodplainPlantResourcesRetained: true,
        unresolvedReachFloodplainDecompositionRetained: true,
        unresolvedReachFloodplainRespirationRetained: true,
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
          { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 },
        channelSediment: state ? riverSedimentTotals(state.sediment) :
          { suspendedKg: { clay: 0, silt: 0, sand: 0, gravel: 0 },
            bedDepositKg: { clay: 0, silt: 0, sand: 0, gravel: 0 },
            totalKg: 0 },
        floodplain: state ? floodplainTotals(state.floodplain) :
          floodplainTotals(emptyFloodplainState()),
        floodplainLastExchange: state?.floodplain?.lastExchangeReceipt ?
          clone(state.floodplain.lastExchangeReceipt) : null,
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
        floodplainGasExchange: state ? floodplainGasExchangeSummary(
          state.floodplainGasExchange) : floodplainGasExchangeSummary(
          emptyFloodplainGasExchangeState()),
        floodplainGasExchangeLastTransition:
          state?.floodplainGasExchange?.lastTransitionReceipt
            ? clone(state.floodplainGasExchange.lastTransitionReceipt)
            : null,
        estuaryStorage: state ? estuaryStorageTotals(state.estuary) :
          { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 },
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
          { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 },
        channelSediment: profile ? profileSediment(profile) :
          emptySedimentTotals(),
        floodplain: profile ? profileFloodplain(profile) :
          profileFloodplain({ reaches: new Map() }),
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
        floodplainGasExchange: profile ?
          profileFloodplainGasExchange(profile) :
          profileFloodplainGasExchange({ reaches: new Map() }),
        estuaryStorage: profile ? profileEstuaryStorage(profile) :
          { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 },
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
        persistentFloodplainAtmosphereGasExchange: true,
        pairedFloodplainAtmosphereGasOwnership: true,
        parameterizedFloodplainCo2EvasionAndOxygenReaeration: true,
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
      reachStateCount: profile?.reaches.size || 0,
      storedWaterKg: profile ? round(profileStorageKg(profile), 3) : 0,
      storedChannelWaterKg: profile ? round(profileChannelStorageKg(profile), 3) : 0,
      storedChemistry: profile ? Object.fromEntries(Object.entries(profileChemistry(profile))
        .map(([key, value]) => [key, round(value, 9)])) :
        { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 },
      storedMineralSediment: profile ? Object.fromEntries(Object.entries(
        profileSediment(profile)).map(([key, value]) => [key, round(value, 9)])) :
        emptySedimentTotals(),
      storedFloodplain: profile ? clone(profileFloodplain(profile)) :
        profileFloodplain({ reaches: new Map() }),
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
      storedFloodplainGasExchange: profile ?
        clone(profileFloodplainGasExchange(profile)) :
        profileFloodplainGasExchange({ reaches: new Map() }),
      storedEstuarySediment: profile ? Object.fromEntries(Object.entries(profileEstuaryStorage(profile))
        .map(([key, value]) => [key, round(value, 9)])) :
        { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 },
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
    const migratedFromLegacy = state.schema !== BASIN_ROUTING_ENGINE_SCHEMA;
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
        reaches
      });
    }
    this.profiles = profiles;
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
      activeProfileReachStates: profile?.reaches.size || 0,
      activeProfileStoredWaterKg: profile ? round(profileStorageKg(profile), 3) : 0,
      activeProfileChannelWaterKg: profile ?
        round(profileChannelStorageKg(profile), 3) : 0,
      activeProfileStoredChemistry: profile ? Object.fromEntries(Object.entries(profileChemistry(profile))
        .map(([key, value]) => [key, round(value, 9)])) :
        { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 },
      activeProfileStoredMineralSediment: profile ? Object.fromEntries(
        Object.entries(profileSediment(profile))
          .map(([key, value]) => [key, round(value, 9)])) :
        emptySedimentTotals(),
      activeProfileFloodplain: profile ? clone(profileFloodplain(profile)) :
        profileFloodplain({ reaches: new Map() }),
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
      activeProfileFloodplainGasExchange: profile ?
        clone(profileFloodplainGasExchange(profile)) :
        profileFloodplainGasExchange({ reaches: new Map() }),
      activeProfileEstuaryStorage: profile ? Object.fromEntries(Object.entries(profileEstuaryStorage(profile))
        .map(([key, value]) => [key, round(value, 9)])) :
        { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0, oxygenKgO2: 0 },
      deterministic: true,
      persistent: true
    };
  }
}

export function basinRoutingDescription() {
  return {
    engineSchema: BASIN_ROUTING_ENGINE_SCHEMA,
    stepSchema: BASIN_ROUTING_STEP_SCHEMA,
    inletReceiptSchema: BASIN_INLET_RECEIPT_SCHEMA,
    reachTransferSchema: RIVER_REACH_TRANSFER_SCHEMA,
    oceanMouthReceiptSchema: OCEAN_MOUTH_RECEIPT_SCHEMA,
    boundaryReceiptSchema: RIVER_BOUNDARY_RECEIPT_SCHEMA,
    floodplainStateSchema: FLOODPLAIN_STATE_SCHEMA,
    floodplainExchangeReceiptSchema: FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
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
    floodplainGasExchangeStateSchema:
      FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
    floodplainGasExchangeProcessReceiptSchema:
      FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
    floodplainGasExchangeReceiptSchema:
      FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    atmosphereFloodplainGasExchangeReceiptSchema:
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    landEcologySubgridBiomassDebitSchema:
      LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA,
    riverChemistry: riverChemistryDescription(),
    estuaryReactor: estuaryReactorDescription(),
    geomorphicSediment: geomorphicSedimentDescription(),
    floodplain: floodplainDescription(),
    floodplainHabitat: floodplainHabitatDescription(),
    floodEventHistory: floodEventHistoryDescription(),
    floodplainSuccession: floodplainSuccessionDescription(),
    floodplainPlantMatter: floodplainPlantMatterDescription(),
    floodplainPlantResources: floodplainPlantResourcesDescription(),
    floodplainDecomposition: floodplainDecompositionDescription(),
    floodplainRespiration: floodplainRespirationDescription(),
    floodplainGasExchange: floodplainGasExchangeDescription(),
    topology: 'loaded canonical hydrology reaches bridged from canonical Earth-system cells',
    processes: ['earth-cell-to-main-reach-capture', 'persistent-land-runoff-queue-sender-debit', 'exact-runoff-queue-to-river-chemistry-credit', 'exact-runoff-sediment-queue-to-river-suspended-load-credit', 'geometry-derived-bankfull-overbank-exchange', 'finite-floodplain-recession-return', 'grain-selective-floodplain-deposition', 'read-only-bounded-flood-event-chronicle', 'read-only-flood-pulse-and-habitat-potential-observation', 'persistent-functional-guild-seed-juvenile-mature-succession', 'flood-disturbance-mortality-and-post-flood-recovery', 'paired-land-ecology-subgrid-to-floodplain-plant-carbon-nitrogen-partition', 'joint-carbon-nitrogen-phosphorus-water-limited-growth', 'paired-floodplain-to-plant-water-phosphorus-uptake', 'mortality-tissue-water-return-to-local-floodplain', 'live-plant-to-standing-dead-to-litter-transfer', 'resource-backed-standing-dead-and-litter-decomposition', 'paired-plant-detritus-to-local-floodplain-chemistry-return', 'oxygen-limited-local-floodplain-doc-to-dic-aerobic-mineralization', 'simultaneous-reach-water-chemistry-and-sediment-routing', 'grain-selective-river-bed-deposition', 'persistent-estuary-reaction-and-organic-sediment-retention', 'grain-selective-coastal-mineral-sediment-deposition', 'estuary-denitrification-to-local-atmosphere', 'loaded-coastal-ocean-delivery-after-estuary-processing'],
    persistentReachStorage: true,
    persistentRiverSediment: true,
    persistentCoastalSediment: true,
    persistentFloodplainStorage: true,
    floodplainWaterChemistryAndSedimentConservationChecked: true,
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
