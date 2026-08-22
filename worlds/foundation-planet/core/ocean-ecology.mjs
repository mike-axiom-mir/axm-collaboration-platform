import {
  advanceDeepOcean,
  createDeepOceanState,
  deepOceanDescription,
  deepOceanElementTotals,
  emptyDeepOceanState,
  normalizeDeepOceanState
} from './deep-ocean.mjs';
import {
  carbonateSystemDescription,
  solveMixedLayerCarbonateSystem
} from './carbonate-system.mjs';
import {
  airSeaCarbonExchangeDescription,
  proposeAirSeaCarbonExchange
} from './air-sea-carbon-exchange.mjs';

export const EARTH_OCEAN_ECOLOGY_SCHEMA =
  'axm.foundation-planet.ocean-ecology-state/v6';
export const PREVIOUS_EARTH_OCEAN_ECOLOGY_SCHEMA =
  'axm.foundation-planet.ocean-ecology-state/v5';
export const EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA =
  'axm.foundation-planet.ocean-ecology-flux-receipt/v6';
export const PREVIOUS_EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA =
  'axm.foundation-planet.ocean-ecology-flux-receipt/v5';
export const EARTH_OCEAN_ECOLOGY_RIVER_INPUT_SCHEMA =
  'axm.foundation-planet.ocean-ecology-river-input-receipt/v2';
export const EARTH_OCEAN_ECOLOGY_RUNOFF_INPUT_SCHEMA =
  'axm.foundation-planet.ocean-ecology-runoff-input-receipt/v2';
const LEGACY_OCEAN_ECOLOGY_SCHEMA = 'axm.foundation-planet.ocean-ecology-state/v1';
const ALKALINITY_FREE_OCEAN_ECOLOGY_SCHEMA =
  'axm.foundation-planet.ocean-ecology-state/v2';
const PRE_DEEP_ALKALINITY_OCEAN_ECOLOGY_SCHEMA =
  'axm.foundation-planet.ocean-ecology-state/v3';
const PRE_CARBONATE_DIAGNOSTIC_OCEAN_ECOLOGY_SCHEMA =
  'axm.foundation-planet.ocean-ecology-state/v4';

const REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2 = 3.45;
const REFERENCE_CO2_PPM = 420;
const REFERENCE_ATMOSPHERIC_OXYGEN_KG_O2_M2 = 2400;
const REDFIELD_C_TO_N_MASS = 106 * 12 / (16 * 14);
const REDFIELD_C_TO_P_MASS = 106 * 12 / 31;
const ZOOPLANKTON_C_TO_N_MASS = 5.2;
const ZOOPLANKTON_C_TO_P_MASS = 48;
const OXYGEN_PER_RESPIRATION_C = 32 / 12;
const DAY_SECONDS = 86_400;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

export const OCEAN_ECOLOGY_TRANSPORT_POOLS = Object.freeze([
  Object.freeze({ id: 'carbon.dissolvedInorganicKgCm2', element: 'carbon' }),
  Object.freeze({ id: 'carbon.dissolvedOrganicKgCm2', element: 'carbon' }),
  Object.freeze({ id: 'carbon.phytoplanktonKgCm2', element: 'carbon' }),
  Object.freeze({ id: 'carbon.zooplanktonKgCm2', element: 'carbon' }),
  Object.freeze({ id: 'carbon.detritusKgCm2', element: 'carbon' }),
  Object.freeze({ id: 'nitrogen.dissolvedInorganicKgNm2', element: 'nitrogen' }),
  Object.freeze({ id: 'nitrogen.phytoplanktonKgNm2', element: 'nitrogen' }),
  Object.freeze({ id: 'nitrogen.zooplanktonKgNm2', element: 'nitrogen' }),
  Object.freeze({ id: 'nitrogen.detritusKgNm2', element: 'nitrogen' }),
  Object.freeze({ id: 'phosphorus.dissolvedInorganicKgPm2', element: 'phosphorus' }),
  Object.freeze({ id: 'phosphorus.phytoplanktonKgPm2', element: 'phosphorus' }),
  Object.freeze({ id: 'phosphorus.zooplanktonKgPm2', element: 'phosphorus' }),
  Object.freeze({ id: 'phosphorus.detritusKgPm2', element: 'phosphorus' }),
  Object.freeze({ id: 'oxygen.dissolvedKgO2m2', element: 'oxygen' }),
  Object.freeze({
    id: 'alkalinity.dissolvedKgCaCO3Eqm2', element: 'alkalinity'
  })
]);

function pathParts(path) {
  const [group, field] = String(path).split('.');
  return { group, field };
}

export function oceanEcologyTransportValue(source, poolId) {
  const { group, field } = pathParts(poolId);
  return Math.max(0, finite(source?.[group]?.[field]));
}

export function setOceanEcologyTransportValue(source, poolId, value) {
  if (!source || source.schema !== EARTH_OCEAN_ECOLOGY_SCHEMA) return source;
  const { group, field } = pathParts(poolId);
  if (!source[group] || typeof source[group] !== 'object') return source;
  source[group][field] = Math.max(0, finite(value));
  return refreshDiagnostics(source);
}

function oxygenSaturationKgM3(temperatureC, salinityPsu) {
  const temperature = clamp(finite(temperatureC, 12), -2.5, 38);
  const salinity = clamp(finite(salinityPsu, 35), 2, 43);
  const milligramsPerLiter = clamp(
    14.62 - .389 * temperature + .0062 * temperature * temperature -
      .032 * salinity,
    2.2,
    14.8
  );
  return milligramsPerLiter / 1000;
}

export function deriveOceanEcologyTraits(sample = {}, ocean = {}, options = {}) {
  const depthM = clamp(finite(ocean?.mixedLayerDepthM,
    24 + finite(sample?.ecology?.marineMixing, .4) * 90), 12, 180);
  const productivity = clamp(finite(sample?.ecology?.productivity,
    finite(sample?.habitability, .35)));
  const mixing = clamp(finite(sample?.ecology?.marineMixing, .45));
  const lifeAbundance = clamp(finite(options.lifeAbundance, 1), 0, 1.5);
  return {
    biomeId: sample?.biome || 'ocean',
    mixedLayerDepthM: round(depthM),
    referenceDissolvedInorganicCarbonKgCm2: round(depthM *
      (.0205 + mixing * .0035)),
    maximumDailyCarbonAssimilationFraction: round(.018 + productivity * .022),
    lightUseEfficiencyGCMJ: round(1.05 + productivity * .62),
    optimumTemperatureC: round(clamp(17 - Math.abs(finite(sample?.latitudeAbs)) * .08,
      4, 23)),
    thermalWidthC: round(13 + mixing * 5),
    baseEuphoticDepthM: round(clamp(34 + productivity * 48 - mixing * 9,
      18, 82)),
    potentialProductivity: round(productivity * lifeAbundance)
  };
}

function carbonTotal(carbon, deepOcean) {
  return finite(carbon?.atmosphericExchangeableKgCm2) +
    finite(carbon?.dissolvedInorganicKgCm2) +
    finite(carbon?.dissolvedOrganicKgCm2) +
    finite(carbon?.phytoplanktonKgCm2) + finite(carbon?.zooplanktonKgCm2) +
    finite(carbon?.detritusKgCm2) +
    deepOceanElementTotals(deepOcean).carbonKgCm2;
}

function nitrogenTotal(nitrogen, deepOcean) {
  return finite(nitrogen?.dissolvedInorganicKgNm2) +
    finite(nitrogen?.phytoplanktonKgNm2) +
    finite(nitrogen?.zooplanktonKgNm2) + finite(nitrogen?.detritusKgNm2) +
    deepOceanElementTotals(deepOcean).nitrogenKgNm2;
}

function phosphorusTotal(phosphorus, deepOcean) {
  return finite(phosphorus?.dissolvedInorganicKgPm2) +
    finite(phosphorus?.phytoplanktonKgPm2) +
    finite(phosphorus?.zooplanktonKgPm2) + finite(phosphorus?.detritusKgPm2) +
    deepOceanElementTotals(deepOcean).phosphorusKgPm2;
}

function oxygenTotal(oxygen, deepOcean) {
  return finite(oxygen?.atmosphericExchangeableKgO2m2) +
    finite(oxygen?.dissolvedKgO2m2) +
    deepOceanElementTotals(deepOcean).oxygenKgO2m2;
}

function alkalinityTotal(alkalinity, deepOcean) {
  return finite(alkalinity?.dissolvedKgCaCO3Eqm2) +
    deepOceanElementTotals(deepOcean).alkalinityKgCaCO3Eqm2;
}

export function oceanEcologyElementTotals(source) {
  return {
    carbonKgCm2: carbonTotal(source?.carbon, source?.deepOcean),
    nitrogenKgNm2: nitrogenTotal(source?.nitrogen, source?.deepOcean),
    phosphorusKgPm2: phosphorusTotal(source?.phosphorus, source?.deepOcean),
    oxygenKgO2m2: oxygenTotal(source?.oxygen, source?.deepOcean),
    alkalinityKgCaCO3Eqm2: alkalinityTotal(source?.alkalinity,
      source?.deepOcean)
  };
}

function refreshDiagnostics(state) {
  state.carbon.totalKgCm2 = round(carbonTotal(state.carbon, state.deepOcean));
  state.carbon.co2PpmProxy = round(REFERENCE_CO2_PPM *
    state.carbon.atmosphericExchangeableKgCm2 /
      REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2, 6);
  state.nitrogen.totalKgNm2 = round(nitrogenTotal(state.nitrogen, state.deepOcean));
  state.phosphorus.totalKgPm2 = round(phosphorusTotal(state.phosphorus, state.deepOcean));
  state.oxygen.totalKgO2m2 = round(oxygenTotal(state.oxygen, state.deepOcean));
  state.alkalinity.totalKgCaCO3Eqm2 = round(
    alkalinityTotal(state.alkalinity, state.deepOcean));
  const depthM = Math.max(1, finite(state.traits?.mixedLayerDepthM, 50));
  const chlorophyllProxyMgM3 = clamp(
    state.carbon.phytoplanktonKgCm2 / depthM * 1000 * 1.35,
    0,
    80
  );
  const detritalTurbidity = clamp(state.carbon.detritusKgCm2 / depthM * 35);
  state.waterColumn = {
    chlorophyllProxyMgM3: round(chlorophyllProxyMgM3, 6),
    euphoticDepthM: round(clamp(
      state.traits.baseEuphoticDepthM /
        (1 + chlorophyllProxyMgM3 * .055 + detritalTurbidity),
      4,
      100
    ), 6),
    oxygenSaturationFraction: round(clamp(
      state.oxygen.dissolvedKgO2m2 /
        Math.max(.001, oxygenSaturationKgM3(state.physiology.temperatureC,
          state.physiology.salinityPsu) * depthM),
      0,
      2.5
    ), 6),
    hypoxiaRisk: round(clamp(1 - state.oxygen.dissolvedKgO2m2 /
      Math.max(.001, .003 * depthM)), 6)
  };
  state.carbonateSystem = solveMixedLayerCarbonateSystem({
    dissolvedInorganicCarbonKgCm2:
      state.carbon.dissolvedInorganicKgCm2,
    alkalinityKgCaCO3Eqm2:
      state.alkalinity.dissolvedKgCaCO3Eqm2,
    dissolvedInorganicPhosphorusKgPm2:
      state.phosphorus.dissolvedInorganicKgPm2,
    mixedLayerDepthM: depthM,
    temperatureC: state.physiology.temperatureC,
    salinityPsu: state.physiology.salinityPsu
  });
  const carbonateSolved = state.carbonateSystem.status === 'SOLVED';
  state.truth.carbonateSpeciationResolved = carbonateSolved;
  state.truth.pHResolved = carbonateSolved;
  state.truth.carbonateDiagnosticOnly = true;
  state.truth.carbonateDiagnosticMutatesMaterial = false;
  state.truth.mixedLayerSurfacePressureOnly = true;
  state.truth.deepOceanPHResolved = false;
  state.truth.silicateAlkalinityIncluded = false;
  state.truth.pHFeedbackModeled = false;
  return state;
}

function emptyMigrationInputs() {
  return {
    carbonKgCm2: 0,
    nitrogenKgNm2: 0,
    phosphorusKgPm2: 0,
    oxygenKgO2m2: 0,
    alkalinityKgCaCO3Eqm2: 0
  };
}

export function createOceanEcology(sample, ocean = {}, options = {}) {
  if (sample?.land === true) return null;
  const traits = deriveOceanEcologyTraits(sample, ocean, options);
  const depthM = traits.mixedLayerDepthM;
  const productivity = clamp(traits.potentialProductivity);
  const mixing = clamp(finite(sample?.ecology?.marineMixing, .45));
  const temperatureC = finite(ocean?.mixedLayerTemperatureC,
    finite(sample?.ecology?.waterTemperatureC, finite(sample?.temperatureC, 12)));
  const salinityPsu = clamp(finite(ocean?.salinityPsu,
    finite(sample?.ecology?.salinityPsu, 35)), 2, 43);
  const phytoplanktonC = productivity > 0
    ? clamp(.003 + productivity * .028 * (1.08 - mixing * .2), .001, .055)
    : 0;
  const zooplanktonC = phytoplanktonC * (.12 + productivity * .18);
  const detritusC = phytoplanktonC * (.22 + mixing * .18);
  const dissolvedOrganicC = depthM * (.00055 + productivity * .0004);
  const dissolvedInorganicN = depthM * (.00008 +
    clamp(finite(sample?.latitudeAbs) / 90) * .00028 + mixing * .00007);
  const dissolvedInorganicP = depthM * (.000014 + mixing * .000018);
  const dissolvedAlkalinity = depthM * .115 * (salinityPsu / 35);
  const state = {
    schema: EARTH_OCEAN_ECOLOGY_SCHEMA,
    migrationCheckpoint: false,
    alkalinityMigrationCheckpoint: false,
    migrationBoundaryInputs: emptyMigrationInputs(),
    traits,
    carbon: {
      atmosphericExchangeableKgCm2: REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2,
      dissolvedInorganicKgCm2: traits.referenceDissolvedInorganicCarbonKgCm2,
      dissolvedOrganicKgCm2: dissolvedOrganicC,
      phytoplanktonKgCm2: phytoplanktonC,
      zooplanktonKgCm2: zooplanktonC,
      detritusKgCm2: detritusC,
      totalKgCm2: 0,
      co2PpmProxy: REFERENCE_CO2_PPM
    },
    nitrogen: {
      dissolvedInorganicKgNm2: dissolvedInorganicN,
      phytoplanktonKgNm2: phytoplanktonC / REDFIELD_C_TO_N_MASS,
      zooplanktonKgNm2: zooplanktonC / ZOOPLANKTON_C_TO_N_MASS,
      detritusKgNm2: detritusC / REDFIELD_C_TO_N_MASS,
      totalKgNm2: 0
    },
    phosphorus: {
      dissolvedInorganicKgPm2: dissolvedInorganicP,
      phytoplanktonKgPm2: phytoplanktonC / REDFIELD_C_TO_P_MASS,
      zooplanktonKgPm2: zooplanktonC / ZOOPLANKTON_C_TO_P_MASS,
      detritusKgPm2: detritusC / REDFIELD_C_TO_P_MASS,
      totalKgPm2: 0
    },
    oxygen: {
      atmosphericExchangeableKgO2m2: REFERENCE_ATMOSPHERIC_OXYGEN_KG_O2_M2,
      dissolvedKgO2m2: oxygenSaturationKgM3(temperatureC, salinityPsu) * depthM *
        (.82 + mixing * .14),
      totalKgO2m2: 0
    },
    alkalinity: {
      dissolvedKgCaCO3Eqm2: dissolvedAlkalinity,
      totalKgCaCO3Eqm2: 0,
      initialization: 'parameterized-open-ocean-2300-umol-kg-reference'
    },
    deepOcean: createDeepOceanState(sample, ocean),
    waterColumn: {
      chlorophyllProxyMgM3: 0,
      euphoticDepthM: traits.baseEuphoticDepthM,
      oxygenSaturationFraction: 0,
      hypoxiaRisk: 0
    },
    carbonateSystem: null,
    physiology: {
      active: productivity > 0,
      temperatureC: round(temperatureC),
      salinityPsu: round(salinityPsu),
      lightStress: 0,
      temperatureStress: 0,
      nitrogenStress: 0,
      phosphorusStress: 0,
      oxygenStress: 0,
      absorbedParMjM2: 0
    },
    lastFluxReceipt: null,
    lastRiverInputReceipt: null,
    lastRunoffInputReceipt: null,
    truth: {
      persistentPools: true,
      localCarbonLedger: true,
      localNitrogenLedger: true,
      localPhosphorusLedger: true,
      oxygenFluxLedger: true,
      persistentAlkalinityLedger: true,
      alkalinityIsAcidNeutralizingCapacityEquivalent: true,
      measuredAlkalinityClaimed: false,
      carbonateSpeciationResolved: false,
      pHResolved: false,
      carbonateDiagnosticOnly: true,
      carbonateDiagnosticMutatesMaterial: false,
      carbonateInformedAirSeaCo2Exchange: false,
      airSeaCarbonExchangeTypedRefusal: false,
      airSeaCo2FugacityCorrection: false,
      scientificAirSeaGasTransferVelocity: false,
      measuredAirSeaPco2: false,
      measuredOceanSkinTemperature: false,
      mixedLayerSurfacePressureOnly: true,
      deepOceanPHResolved: false,
      silicateAlkalinityIncluded: false,
      pHFeedbackModeled: false,
      persistentDeepOceanReservoirs: true,
      persistentDeepOceanAlkalinity: true,
      conservativeMixedToDeepAlkalinityExchange: true,
      sinkingCarbonExportAndBurial: true,
      physicalChemistryContinuesWithLifeOff: true,
      localExchangeableAtmosphereOnly: true,
      globallyMixedAtmosphericGases: false,
      threeDimensionalOceanCirculation: false,
      mechanisticPlanktonBiochemistry: false
    }
  };
  return refreshDiagnostics(state);
}

function migratedOceanEcology(ocean = {}) {
  const traits = deriveOceanEcologyTraits({ land: false, biome: 'ocean',
    ecology: { productivity: 0, marineMixing: .4 } }, ocean,
  { lifeAbundance: 0 });
  const state = createOceanEcology({ land: false, biome: 'ocean',
    ecology: { productivity: 0, marineMixing: .4 } }, ocean,
  { lifeAbundance: 0 });
  state.migrationCheckpoint = true;
  state.traits = { ...traits, biomeId: 'migration-unknown' };
  state.carbon.dissolvedInorganicKgCm2 = 0;
  state.carbon.dissolvedOrganicKgCm2 = 0;
  state.oxygen.dissolvedKgO2m2 = 0;
  state.alkalinity.dissolvedKgCaCO3Eqm2 = 0;
  state.alkalinityMigrationCheckpoint = true;
  state.nitrogen.dissolvedInorganicKgNm2 = 0;
  state.phosphorus.dissolvedInorganicKgPm2 = 0;
  state.deepOcean = emptyDeepOceanState({ migrationCheckpoint: true });
  state.physiology.active = false;
  return refreshDiagnostics(state);
}

export function normalizeOceanEcology(source, context = {}) {
  if (!source || ![
    EARTH_OCEAN_ECOLOGY_SCHEMA,
    PREVIOUS_EARTH_OCEAN_ECOLOGY_SCHEMA,
    PRE_CARBONATE_DIAGNOSTIC_OCEAN_ECOLOGY_SCHEMA,
    PRE_DEEP_ALKALINITY_OCEAN_ECOLOGY_SCHEMA,
    ALKALINITY_FREE_OCEAN_ECOLOGY_SCHEMA,
    LEGACY_OCEAN_ECOLOGY_SCHEMA
  ].includes(source.schema)) {
    return context.sample && context.sample.land !== true
      ? createOceanEcology(context.sample, context.ocean, context)
      : migratedOceanEcology(context.ocean);
  }
  const migratedFromV1 = source.schema === LEGACY_OCEAN_ECOLOGY_SCHEMA;
  const migratedAlkalinity = [
    ALKALINITY_FREE_OCEAN_ECOLOGY_SCHEMA,
    LEGACY_OCEAN_ECOLOGY_SCHEMA
  ].includes(source.schema);
  const state = clone(source);
  state.schema = EARTH_OCEAN_ECOLOGY_SCHEMA;
  state.migrationCheckpoint = state.migrationCheckpoint === true;
  state.alkalinityMigrationCheckpoint = migratedAlkalinity ||
    state.alkalinityMigrationCheckpoint === true;
  state.migrationBoundaryInputs = {
    ...emptyMigrationInputs(),
    ...(state.migrationBoundaryInputs || {})
  };
  state.traits = {
    ...migratedOceanEcology(context.ocean).traits,
    ...(state.traits || {})
  };
  state.carbon = {
    atmosphericExchangeableKgCm2: Math.max(0, finite(
      state.carbon?.atmosphericExchangeableKgCm2,
      REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2)),
    dissolvedInorganicKgCm2: Math.max(0, finite(state.carbon?.dissolvedInorganicKgCm2)),
    dissolvedOrganicKgCm2: Math.max(0, finite(state.carbon?.dissolvedOrganicKgCm2)),
    phytoplanktonKgCm2: Math.max(0, finite(state.carbon?.phytoplanktonKgCm2)),
    zooplanktonKgCm2: Math.max(0, finite(state.carbon?.zooplanktonKgCm2)),
    detritusKgCm2: Math.max(0, finite(state.carbon?.detritusKgCm2)),
    totalKgCm2: 0,
    co2PpmProxy: 0
  };
  state.nitrogen = {
    dissolvedInorganicKgNm2: Math.max(0, finite(state.nitrogen?.dissolvedInorganicKgNm2)),
    phytoplanktonKgNm2: Math.max(0, finite(state.nitrogen?.phytoplanktonKgNm2)),
    zooplanktonKgNm2: Math.max(0, finite(state.nitrogen?.zooplanktonKgNm2)),
    detritusKgNm2: Math.max(0, finite(state.nitrogen?.detritusKgNm2)),
    totalKgNm2: 0
  };
  state.phosphorus = {
    dissolvedInorganicKgPm2: Math.max(0, finite(state.phosphorus?.dissolvedInorganicKgPm2)),
    phytoplanktonKgPm2: Math.max(0, finite(state.phosphorus?.phytoplanktonKgPm2)),
    zooplanktonKgPm2: Math.max(0, finite(state.phosphorus?.zooplanktonKgPm2)),
    detritusKgPm2: Math.max(0, finite(state.phosphorus?.detritusKgPm2)),
    totalKgPm2: 0
  };
  state.oxygen = {
    atmosphericExchangeableKgO2m2: Math.max(0, finite(
      state.oxygen?.atmosphericExchangeableKgO2m2,
      REFERENCE_ATMOSPHERIC_OXYGEN_KG_O2_M2)),
    dissolvedKgO2m2: Math.max(0, finite(state.oxygen?.dissolvedKgO2m2)),
    totalKgO2m2: 0
  };
  state.alkalinity = {
    dissolvedKgCaCO3Eqm2: Math.max(0, finite(
      state.alkalinity?.dissolvedKgCaCO3Eqm2)),
    totalKgCaCO3Eqm2: 0,
    initialization: String(state.alkalinity?.initialization ||
      (migratedAlkalinity ? 'explicit-zero-migration' : 'normalized'))
  };
  state.deepOcean = migratedFromV1
    ? emptyDeepOceanState({ migrationCheckpoint: true })
    : normalizeDeepOceanState(state.deepOcean, {
      deepWaterDepthM: Math.max(120, finite(context.sample?.depthM, 3200) -
        finite(context.ocean?.mixedLayerDepthM, 60)),
      migrationCheckpoint: !state.deepOcean
    });
  state.physiology = {
    active: state.physiology?.active === true,
    temperatureC: finite(state.physiology?.temperatureC,
      finite(context.ocean?.mixedLayerTemperatureC, 12)),
    salinityPsu: clamp(finite(state.physiology?.salinityPsu,
      finite(context.ocean?.salinityPsu, 35)), 2, 43),
    lightStress: clamp(finite(state.physiology?.lightStress)),
    temperatureStress: clamp(finite(state.physiology?.temperatureStress)),
    nitrogenStress: clamp(finite(state.physiology?.nitrogenStress)),
    phosphorusStress: clamp(finite(state.physiology?.phosphorusStress)),
    oxygenStress: clamp(finite(state.physiology?.oxygenStress)),
    absorbedParMjM2: Math.max(0, finite(state.physiology?.absorbedParMjM2))
  };
  state.lastFluxReceipt = state.lastFluxReceipt?.schema ===
    EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA ? state.lastFluxReceipt : null;
  state.lastRiverInputReceipt = state.lastRiverInputReceipt?.schema ===
    EARTH_OCEAN_ECOLOGY_RIVER_INPUT_SCHEMA ? state.lastRiverInputReceipt : null;
  state.lastRunoffInputReceipt = state.lastRunoffInputReceipt?.schema ===
    EARTH_OCEAN_ECOLOGY_RUNOFF_INPUT_SCHEMA
    ? state.lastRunoffInputReceipt : null;
  state.truth = {
    persistentPools: true,
    localCarbonLedger: true,
    localNitrogenLedger: true,
    localPhosphorusLedger: true,
    oxygenFluxLedger: true,
    persistentAlkalinityLedger: true,
    alkalinityIsAcidNeutralizingCapacityEquivalent: true,
    measuredAlkalinityClaimed: false,
    carbonateSpeciationResolved: false,
    pHResolved: false,
    carbonateDiagnosticOnly: true,
    carbonateDiagnosticMutatesMaterial: false,
    carbonateInformedAirSeaCo2Exchange: state.lastFluxReceipt?.carbon
      ?.airSeaCarbonExchange?.status?.startsWith('SOLVED_') === true,
    airSeaCarbonExchangeTypedRefusal: Boolean(state.lastFluxReceipt?.carbon
      ?.airSeaCarbonExchange) && state.lastFluxReceipt.carbon
      .airSeaCarbonExchange.status?.startsWith('SOLVED_') !== true,
    airSeaCo2FugacityCorrection: state.lastFluxReceipt?.carbon
      ?.airSeaCarbonExchange?.truth?.fugacityNonidealityIncluded === true,
    scientificAirSeaGasTransferVelocity: false,
    measuredAirSeaPco2: false,
    measuredOceanSkinTemperature: false,
    mixedLayerSurfacePressureOnly: true,
    deepOceanPHResolved: false,
    silicateAlkalinityIncluded: false,
    pHFeedbackModeled: false,
    persistentDeepOceanReservoirs: true,
    persistentDeepOceanAlkalinity: true,
    conservativeMixedToDeepAlkalinityExchange: true,
    sinkingCarbonExportAndBurial: true,
    physicalChemistryContinuesWithLifeOff: true,
    localExchangeableAtmosphereOnly: true,
    globallyMixedAtmosphericGases: false,
    threeDimensionalOceanCirculation: false,
    mechanisticPlanktonBiochemistry: false
  };
  return refreshDiagnostics(state);
}

function moveBetweenPools(state, group, sourceField, destinationField, signedToDestination) {
  const amount = finite(signedToDestination);
  if (Math.abs(amount) <= 1e-15) return 0;
  if (amount > 0) {
    const moved = Math.min(state[group][sourceField], amount);
    state[group][sourceField] -= moved;
    state[group][destinationField] += moved;
    return moved;
  }
  const moved = Math.min(state[group][destinationField], -amount);
  state[group][destinationField] -= moved;
  state[group][sourceField] += moved;
  return -moved;
}

function retargetTraits(state, sample, ocean, lifeAbundance) {
  if (sample && sample.land !== true) {
    state.traits = deriveOceanEcologyTraits(sample, ocean, { lifeAbundance });
  }
  return refreshDiagnostics(state);
}

function applyMigrationInputs(state, inputs) {
  state.carbon.dissolvedInorganicKgCm2 += finite(inputs?.carbonKgCm2) * .66;
  state.carbon.dissolvedOrganicKgCm2 += finite(inputs?.carbonKgCm2) * .34;
  state.nitrogen.dissolvedInorganicKgNm2 += finite(inputs?.nitrogenKgNm2);
  state.phosphorus.dissolvedInorganicKgPm2 += finite(inputs?.phosphorusKgPm2);
  state.oxygen.dissolvedKgO2m2 += finite(inputs?.oxygenKgO2m2);
  state.alkalinity.dissolvedKgCaCO3Eqm2 += finite(
    inputs?.alkalinityKgCaCO3Eqm2);
  return refreshDiagnostics(state);
}

function physicalExchange(state, environment, duration) {
  const temperatureC = finite(environment.temperatureC,
    state.physiology.temperatureC);
  const salinityPsu = clamp(finite(environment.salinityPsu,
    state.physiology.salinityPsu), 2, 43);
  const depthM = clamp(finite(environment.mixedLayerDepthM,
    state.traits.mixedLayerDepthM), 12, 180);
  const openWater = 1 - clamp(finite(environment.seaIceFraction));
  const windFactor = clamp(.18 + finite(environment.windSpeedMps, 3) / 18,
    .08, 1.35);
  const exchangeFraction = clamp((.012 + windFactor * .022) *
    (.08 + openWater * .92) * duration, 0, .08);
  const carbonExchangeProposal = proposeAirSeaCarbonExchange({
    carbonateSystem: state.carbonateSystem,
    atmosphericCo2PpmProxy: state.carbon.co2PpmProxy,
    atmosphericCarbonKgCm2:
      state.carbon.atmosphericExchangeableKgCm2,
    dissolvedInorganicCarbonKgCm2:
      state.carbon.dissolvedInorganicKgCm2,
    alkalinityKgCaCO3Eqm2:
      state.alkalinity.dissolvedKgCaCO3Eqm2,
    dissolvedInorganicPhosphorusKgPm2:
      state.phosphorus.dissolvedInorganicKgPm2,
    mixedLayerDepthM: depthM,
    temperatureC,
    salinityPsu,
    surfacePressureHpa: finite(environment.surfacePressureHpa, 1013.25),
    relaxationFraction: exchangeFraction
  });
  const co2ToOceanKgCm2 = moveBetweenPools(state, 'carbon',
    'atmosphericExchangeableKgCm2', 'dissolvedInorganicKgCm2',
    carbonExchangeProposal.signedCarbonToOceanKgCm2);
  const ownerMoveMatchedProposal = Math.abs(co2ToOceanKgCm2 -
    carbonExchangeProposal.signedCarbonToOceanKgCm2) <= 1e-12;
  const carbonExchange = {
    ...clone(carbonExchangeProposal),
    application: {
      pairedOwnerMove: true,
      appliedSignedCarbonToOceanKgCm2: round(co2ToOceanKgCm2, 12),
      proposalMatched: ownerMoveMatchedProposal,
      combinedAtmosphereAndOceanCarbonClosed: ownerMoveMatchedProposal
    }
  };
  const carbonExchangeSolved = carbonExchange.status.startsWith('SOLVED_');
  state.truth.carbonateInformedAirSeaCo2Exchange = carbonExchangeSolved;
  state.truth.airSeaCarbonExchangeTypedRefusal = !carbonExchangeSolved;
  state.truth.airSeaCo2FugacityCorrection =
    carbonExchange.truth.fugacityNonidealityIncluded === true;
  state.truth.scientificAirSeaGasTransferVelocity = false;
  state.truth.measuredAirSeaPco2 = false;
  state.truth.measuredOceanSkinTemperature = false;
  const targetOxygen = oxygenSaturationKgM3(temperatureC, salinityPsu) * depthM;
  const oxygenToOceanKgO2m2 = moveBetweenPools(state, 'oxygen',
    'atmosphericExchangeableKgO2m2', 'dissolvedKgO2m2',
    (targetOxygen - state.oxygen.dissolvedKgO2m2) * exchangeFraction * 1.4);
  return {
    co2ToOceanKgCm2,
    carbonExchange,
    oxygenToOceanKgO2m2,
    targetDissolvedOxygenKgO2m2: targetOxygen,
    exchangeFraction
  };
}

function fluxReceipt(state, initial, duration, exchange, biology, deepOceanReceipt,
  status, reason) {
  const final = oceanEcologyElementTotals(state);
  const carbonResidual = final.carbonKgCm2 - initial.carbonKgCm2;
  const nitrogenResidual = final.nitrogenKgNm2 - initial.nitrogenKgNm2;
  const phosphorusResidual = final.phosphorusKgPm2 - initial.phosphorusKgPm2;
  const oxygenResidual = final.oxygenKgO2m2 - initial.oxygenKgO2m2 -
    biology.photosyntheticOxygenKgO2m2 + biology.respirationOxygenKgO2m2 +
    finite(deepOceanReceipt?.deepRemineralization?.oxygenConsumedKgO2m2);
  const alkalinityResidual = final.alkalinityKgCaCO3Eqm2 -
    initial.alkalinityKgCaCO3Eqm2;
  return {
    schema: EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA,
    durationDays: round(duration),
    status,
    reason,
    initial: {
      totalCarbonKgCm2: round(initial.carbonKgCm2),
      totalNitrogenKgNm2: round(initial.nitrogenKgNm2),
      totalPhosphorusKgPm2: round(initial.phosphorusKgPm2),
      totalOxygenKgO2m2: round(initial.oxygenKgO2m2),
      totalAlkalinityKgCaCO3Eqm2: round(
        initial.alkalinityKgCaCO3Eqm2)
    },
    final: {
      totalCarbonKgCm2: round(final.carbonKgCm2),
      totalNitrogenKgNm2: round(final.nitrogenKgNm2),
      totalPhosphorusKgPm2: round(final.phosphorusKgPm2),
      totalOxygenKgO2m2: round(final.oxygenKgO2m2),
      totalAlkalinityKgCaCO3Eqm2: round(
        final.alkalinityKgCaCO3Eqm2)
    },
    carbon: {
      grossPrimaryProductionKgCm2: round(biology.grossPrimaryProductionKgCm2),
      retainedPrimaryProductionKgCm2: round(biology.retainedPrimaryProductionKgCm2),
      communityRespirationKgCm2: round(biology.communityRespirationKgCm2),
      grazingKgCm2: round(biology.grazingKgCm2),
      detritusRemineralizationKgCm2: round(biology.detritusRemineralizationKgCm2),
      dissolvedOrganicRespirationKgCm2: round(biology.dissolvedOrganicRespirationKgCm2),
      airSeaCo2FluxToOceanKgCm2: round(exchange.co2ToOceanKgCm2),
      airSeaCarbonExchange: clone(exchange.carbonExchange),
      residualKgCm2: round(carbonResidual, 12)
    },
    nitrogen: {
      phytoplanktonUptakeKgNm2: round(biology.nitrogenUptakeKgNm2),
      remineralizationKgNm2: round(biology.nitrogenRemineralizationKgNm2),
      residualKgNm2: round(nitrogenResidual, 12)
    },
    phosphorus: {
      phytoplanktonUptakeKgPm2: round(biology.phosphorusUptakeKgPm2),
      remineralizationKgPm2: round(biology.phosphorusRemineralizationKgPm2),
      residualKgPm2: round(phosphorusResidual, 12)
    },
    oxygen: {
      photosyntheticProductionKgO2m2: round(biology.photosyntheticOxygenKgO2m2),
      respirationConsumptionKgO2m2: round(biology.respirationOxygenKgO2m2),
      airSeaFluxToOceanKgO2m2: round(exchange.oxygenToOceanKgO2m2),
      residualKgO2m2: round(oxygenResidual, 12)
    },
    alkalinity: {
      mixedToDeepKgCaCO3Eqm2: round(finite(deepOceanReceipt
        ?.dissolvedExchange?.alkalinitySurfaceToDeepKgCaCO3Eqm2), 12),
      residualKgCaCO3Eqm2: round(alkalinityResidual, 12)
    },
    carbonateSystem: clone(state.carbonateSystem),
    waterColumn: clone(state.waterColumn),
    deepOcean: deepOceanReceipt ? clone(deepOceanReceipt) : null,
    stresses: {
      light: round(state.physiology.lightStress),
      temperature: round(state.physiology.temperatureStress),
      nitrogen: round(state.physiology.nitrogenStress),
      phosphorus: round(state.physiology.phosphorusStress),
      oxygen: round(state.physiology.oxygenStress),
      seaIce: round(1 - finite(state.physiology.openWaterFraction, 1))
    },
    truth: {
      biologicalReservoirsFrozen: status !== 'active',
      physicalGasExchangeActive: true,
      carbonateInformedAirSeaCo2Exchange:
        exchange.carbonExchange.status.startsWith('SOLVED_'),
      airSeaCarbonExchangeTypedRefusal:
        !exchange.carbonExchange.status.startsWith('SOLVED_'),
      airSeaCo2FugacityCorrection:
        exchange.carbonExchange.truth.fugacityNonidealityIncluded === true,
      airSeaCarbonExchangeSourceBound:
        exchange.carbonExchange.truth.senderBounded === true,
      airSeaCarbonOwnerMoveMatchedProposal:
        exchange.carbonExchange.application.proposalMatched === true,
      scientificAirSeaGasTransferVelocity: false,
      measuredAirSeaPco2: false,
      measuredOceanSkinTemperature: false,
      carbonClosed: Math.abs(carbonResidual) < 1e-9,
      nitrogenClosed: Math.abs(nitrogenResidual) < 1e-9,
      phosphorusClosed: Math.abs(phosphorusResidual) < 1e-9,
      oxygenFluxClosed: Math.abs(oxygenResidual) < 1e-9,
      alkalinityClosed: Math.abs(alkalinityResidual) < 1e-9,
      persistentDeepOceanReservoirs: true,
      persistentDeepOceanAlkalinity: true,
      conservativeMixedToDeepAlkalinityExchange: deepOceanReceipt?.truth
        ?.conservativeVerticalAlkalinityExchange === true,
      mixedToDeepAlkalinityClosed: deepOceanReceipt
        ? Math.abs(finite(deepOceanReceipt.conservation
          ?.alkalinityResidualKgCaCO3Eqm2)) < 1e-9
        : false,
      mixedToDeepMaterialClosure: deepOceanReceipt
        ? Object.values(deepOceanReceipt.conservation)
          .every(value => Math.abs(finite(value)) < 1e-9)
        : false,
      mixedLayerCarbonateDiagnosticSolved:
        state.carbonateSystem?.status === 'SOLVED',
      mixedLayerCarbonateDiagnosticOnly: true,
      mixedLayerCarbonateDiagnosticMutatesMaterial: false,
      mixedLayerCarbonateMassClosed:
        state.carbonateSystem?.truth?.carbonateMassClosed === true,
      mixedLayerCarbonateAlkalinityResidualClosed:
        state.carbonateSystem?.truth?.alkalinityResidualClosed === true,
      mixedLayerPHFeedbackModeled: false,
      deepOceanPHResolved: false,
      localExchangeableAtmosphereOnly: true,
      globallyMixedAtmosphericGases: false,
      threeDimensionalOceanCirculation: false,
      mechanisticPlanktonBiochemistry: false
    }
  };
}

function zeroBiology() {
  return {
    grossPrimaryProductionKgCm2: 0,
    retainedPrimaryProductionKgCm2: 0,
    communityRespirationKgCm2: 0,
    grazingKgCm2: 0,
    detritusRemineralizationKgCm2: 0,
    dissolvedOrganicRespirationKgCm2: 0,
    nitrogenUptakeKgNm2: 0,
    nitrogenRemineralizationKgNm2: 0,
    phosphorusUptakeKgPm2: 0,
    phosphorusRemineralizationKgPm2: 0,
    photosyntheticOxygenKgO2m2: 0,
    respirationOxygenKgO2m2: 0
  };
}

export function advanceOceanEcology(source, environment = {}, durationDays = 1,
  options = {}) {
  const duration = finite(durationDays);
  if (!(duration > 0) || duration > 1.000001) {
    throw new Error('Ocean-ecology step must be greater than zero and no longer than one day');
  }
  let state = normalizeOceanEcology(source, {
    sample: options.sample,
    ocean: options.ocean,
    lifeAbundance: options.lifeAbundance
  });
  if (state.migrationCheckpoint === true && options.sample &&
      options.sample.land !== true) {
    const migrationInputs = clone(state.migrationBoundaryInputs);
    state = createOceanEcology(options.sample, options.ocean, {
      lifeAbundance: options.lifeAbundance
    });
    applyMigrationInputs(state, migrationInputs);
    state.migrationCheckpoint = true;
  }
  state = retargetTraits(state, options.sample, options.ocean,
    options.lifeAbundance);
  const initial = oceanEcologyElementTotals(state);
  const temperatureC = finite(environment.temperatureC,
    finite(options.ocean?.mixedLayerTemperatureC, 12));
  const salinityPsu = clamp(finite(environment.salinityPsu,
    finite(options.ocean?.salinityPsu, 35)), 2, 43);
  const depthM = clamp(finite(environment.mixedLayerDepthM,
    finite(options.ocean?.mixedLayerDepthM, state.traits.mixedLayerDepthM)),
  12, 180);
  state.physiology.temperatureC = temperatureC;
  state.physiology.salinityPsu = salinityPsu;
  state.traits.mixedLayerDepthM = round(depthM);
  refreshDiagnostics(state);
  const exchange = physicalExchange(state, {
    ...environment,
    temperatureC,
    salinityPsu,
    mixedLayerDepthM: depthM
  }, duration);
  const biology = zeroBiology();
  const enabled = options.enabled !== false &&
    finite(options.lifeAbundance, 1) > 0 &&
    state.traits.potentialProductivity > 0;
  if (!enabled) {
    state.physiology = {
      ...state.physiology,
      active: false,
      lightStress: 0,
      temperatureStress: 0,
      nitrogenStress: 0,
      phosphorusStress: 0,
      oxygenStress: 0,
      absorbedParMjM2: 0,
      openWaterFraction: round(1 - clamp(finite(environment.seaIceFraction)))
    };
    const deepOceanStep = advanceDeepOcean(state.deepOcean, state, {
      mixedLayerDepthM: depthM,
      mixing: finite(options.sample?.ecology?.marineMixing, .45),
      overturning: clamp(finite(environment.windSpeedMps, 3) / 18),
      deepTemperatureC: clamp(temperatureC - 9, -1.8, 5)
    }, duration, { enabled: false });
    state.deepOcean = deepOceanStep.state;
    refreshDiagnostics(state);
    state.lastFluxReceipt = fluxReceipt(state, initial, duration, exchange,
      biology, deepOceanStep.receipt, 'physical-only', options.enabled === false
        ? 'living-layer-disabled-physical-gas-exchange-continues'
        : 'no-active-marine-producers');
    state.migrationCheckpoint = false;
    return { state, receipt: clone(state.lastFluxReceipt) };
  }

  const openWaterFraction = 1 - clamp(finite(environment.seaIceFraction));
  const temperatureStress = clamp(Math.exp(-Math.pow(
    (temperatureC - state.traits.optimumTemperatureC) /
      Math.max(1, state.traits.thermalWidthC), 2)) *
    clamp((temperatureC + 2.5) / 8));
  const mixedLayerLightFraction = clamp(state.waterColumn.euphoticDepthM / depthM,
    .03, 1);
  const absorbedParMjM2 = Math.max(0, finite(environment.absorbedShortwaveWm2)) *
    .45 * DAY_SECONDS * duration / 1e6 * mixedLayerLightFraction *
    (.08 + openWaterFraction * .92);
  const lightStress = clamp(absorbedParMjM2 / Math.max(.25,
    4.5 * duration));
  const potentialGpp = absorbedParMjM2 * state.traits.lightUseEfficiencyGCMJ /
    1000 * temperatureStress * clamp(finite(options.lifeAbundance, 1), 0, 1.5);
  const grossPrimaryProductionKgCm2 = Math.min(
    state.carbon.dissolvedInorganicKgCm2 *
      state.traits.maximumDailyCarbonAssimilationFraction * duration,
    Math.max(0, potentialGpp)
  );
  state.carbon.dissolvedInorganicKgCm2 -= grossPrimaryProductionKgCm2;
  const photosyntheticOxygenKgO2m2 = grossPrimaryProductionKgCm2 *
    OXYGEN_PER_RESPIRATION_C;
  state.oxygen.dissolvedKgO2m2 += photosyntheticOxygenKgO2m2;

  let respirationOxygenKgO2m2 = 0;
  const oxidize = potentialCarbon => {
    const actualCarbon = Math.min(Math.max(0, potentialCarbon),
      state.oxygen.dissolvedKgO2m2 / OXYGEN_PER_RESPIRATION_C);
    const oxygen = actualCarbon * OXYGEN_PER_RESPIRATION_C;
    state.oxygen.dissolvedKgO2m2 -= oxygen;
    respirationOxygenKgO2m2 += oxygen;
    return actualCarbon;
  };

  const growthRespirationPotential = grossPrimaryProductionKgCm2 * .18;
  const growthRespiration = oxidize(growthRespirationPotential);
  state.carbon.dissolvedInorganicKgCm2 += growthRespiration;
  const potentialNetGrowth = grossPrimaryProductionKgCm2 - growthRespiration;
  const accessibleNitrogen = state.nitrogen.dissolvedInorganicKgNm2 *
    clamp(.08 + duration * .18, .04, .28);
  const accessiblePhosphorus = state.phosphorus.dissolvedInorganicKgPm2 *
    clamp(.08 + duration * .18, .04, .28);
  const retainedPrimaryProduction = Math.min(
    potentialNetGrowth,
    accessibleNitrogen * REDFIELD_C_TO_N_MASS,
    accessiblePhosphorus * REDFIELD_C_TO_P_MASS
  );
  const nitrogenUptake = retainedPrimaryProduction / REDFIELD_C_TO_N_MASS;
  const phosphorusUptake = retainedPrimaryProduction / REDFIELD_C_TO_P_MASS;
  state.nitrogen.dissolvedInorganicKgNm2 -= nitrogenUptake;
  state.phosphorus.dissolvedInorganicKgPm2 -= phosphorusUptake;
  state.carbon.phytoplanktonKgCm2 += retainedPrimaryProduction;
  state.nitrogen.phytoplanktonKgNm2 += nitrogenUptake;
  state.phosphorus.phytoplanktonKgPm2 += phosphorusUptake;
  const overflowCarbon = Math.max(0, potentialNetGrowth - retainedPrimaryProduction);
  const overflowRespiration = oxidize(overflowCarbon * .45);
  state.carbon.dissolvedInorganicKgCm2 += overflowRespiration;
  state.carbon.dissolvedOrganicKgCm2 += overflowCarbon - overflowRespiration;

  const maintenanceRespiration = oxidize(Math.min(
    state.carbon.phytoplanktonKgCm2,
    state.carbon.phytoplanktonKgCm2 *
      clamp(.003 + Math.pow(2, (temperatureC - 15) / 10) * .0022,
        .001, .016) * duration
  ));
  state.carbon.phytoplanktonKgCm2 -= maintenanceRespiration;
  state.carbon.dissolvedInorganicKgCm2 += maintenanceRespiration;

  const phytoBeforeGrazingC = state.carbon.phytoplanktonKgCm2;
  const grazingC = Math.min(phytoBeforeGrazingC,
    (state.carbon.zooplanktonKgCm2 * .12 + phytoBeforeGrazingC * .006) *
      temperatureStress * duration);
  const grazingFraction = phytoBeforeGrazingC > 1e-15
    ? grazingC / phytoBeforeGrazingC : 0;
  const grazingN = state.nitrogen.phytoplanktonKgNm2 * grazingFraction;
  const grazingP = state.phosphorus.phytoplanktonKgPm2 * grazingFraction;
  state.carbon.phytoplanktonKgCm2 -= grazingC;
  state.nitrogen.phytoplanktonKgNm2 -= grazingN;
  state.phosphorus.phytoplanktonKgPm2 -= grazingP;
  const assimilationFraction = .32;
  const detritusFraction = .4;
  state.carbon.zooplanktonKgCm2 += grazingC * assimilationFraction;
  state.nitrogen.zooplanktonKgNm2 += grazingN * assimilationFraction;
  state.phosphorus.zooplanktonKgPm2 += grazingP * assimilationFraction;
  state.carbon.detritusKgCm2 += grazingC * detritusFraction;
  state.nitrogen.detritusKgNm2 += grazingN * detritusFraction;
  state.phosphorus.detritusKgPm2 += grazingP * detritusFraction;
  const grazingRespirationPotential = grazingC *
    (1 - assimilationFraction - detritusFraction);
  const grazingRespiration = oxidize(grazingRespirationPotential);
  state.carbon.dissolvedInorganicKgCm2 += grazingRespiration;
  state.carbon.dissolvedOrganicKgCm2 +=
    grazingRespirationPotential - grazingRespiration;
  state.nitrogen.dissolvedInorganicKgNm2 += grazingN *
    (1 - assimilationFraction - detritusFraction);
  state.phosphorus.dissolvedInorganicKgPm2 += grazingP *
    (1 - assimilationFraction - detritusFraction);

  const phytoMortalityFraction = clamp(1 - Math.exp(-.006 * duration *
    (1 + (1 - lightStress) * .7)));
  const phytoMortalityC = state.carbon.phytoplanktonKgCm2 *
    phytoMortalityFraction;
  const phytoMortalityN = state.nitrogen.phytoplanktonKgNm2 *
    phytoMortalityFraction;
  const phytoMortalityP = state.phosphorus.phytoplanktonKgPm2 *
    phytoMortalityFraction;
  state.carbon.phytoplanktonKgCm2 -= phytoMortalityC;
  state.nitrogen.phytoplanktonKgNm2 -= phytoMortalityN;
  state.phosphorus.phytoplanktonKgPm2 -= phytoMortalityP;
  state.carbon.detritusKgCm2 += phytoMortalityC;
  state.nitrogen.detritusKgNm2 += phytoMortalityN;
  state.phosphorus.detritusKgPm2 += phytoMortalityP;

  const zooBeforeRespirationC = state.carbon.zooplanktonKgCm2;
  const zooRespiration = oxidize(Math.min(zooBeforeRespirationC,
    zooBeforeRespirationC * clamp(.004 + temperatureStress * .005,
      .002, .012) * duration));
  state.carbon.zooplanktonKgCm2 -= zooRespiration;
  state.carbon.dissolvedInorganicKgCm2 += zooRespiration;
  const zooMortalityFraction = clamp(1 - Math.exp(-.0035 * duration));
  const zooMortalityC = state.carbon.zooplanktonKgCm2 * zooMortalityFraction;
  const zooMortalityN = state.nitrogen.zooplanktonKgNm2 * zooMortalityFraction;
  const zooMortalityP = state.phosphorus.zooplanktonKgPm2 * zooMortalityFraction;
  state.carbon.zooplanktonKgCm2 -= zooMortalityC;
  state.nitrogen.zooplanktonKgNm2 -= zooMortalityN;
  state.phosphorus.zooplanktonKgPm2 -= zooMortalityP;
  state.carbon.detritusKgCm2 += zooMortalityC;
  state.nitrogen.detritusKgNm2 += zooMortalityN;
  state.phosphorus.detritusKgPm2 += zooMortalityP;

  const detritusBeforeC = state.carbon.detritusKgCm2;
  const detritusPotential = detritusBeforeC * clamp(
    .004 + temperatureStress * .009, .002, .016) * duration;
  const detritusRemineralization = oxidize(detritusPotential);
  const remineralizedDetritusFraction = detritusBeforeC > 1e-15
    ? detritusRemineralization / detritusBeforeC : 0;
  const nitrogenRemineralization = state.nitrogen.detritusKgNm2 *
    remineralizedDetritusFraction;
  const phosphorusRemineralization = state.phosphorus.detritusKgPm2 *
    remineralizedDetritusFraction;
  state.carbon.detritusKgCm2 -= detritusRemineralization;
  state.nitrogen.detritusKgNm2 -= nitrogenRemineralization;
  state.phosphorus.detritusKgPm2 -= phosphorusRemineralization;
  state.carbon.dissolvedInorganicKgCm2 += detritusRemineralization;
  state.nitrogen.dissolvedInorganicKgNm2 += nitrogenRemineralization;
  state.phosphorus.dissolvedInorganicKgPm2 += phosphorusRemineralization;

  const dissolvedOrganicRespiration = oxidize(
    state.carbon.dissolvedOrganicKgCm2 * clamp(.0007 +
      temperatureStress * .0018, .0003, .003) * duration);
  state.carbon.dissolvedOrganicKgCm2 -= dissolvedOrganicRespiration;
  state.carbon.dissolvedInorganicKgCm2 += dissolvedOrganicRespiration;

  biology.grossPrimaryProductionKgCm2 = grossPrimaryProductionKgCm2;
  biology.retainedPrimaryProductionKgCm2 = retainedPrimaryProduction;
  biology.communityRespirationKgCm2 = growthRespiration +
    overflowRespiration + maintenanceRespiration + grazingRespiration +
    zooRespiration + detritusRemineralization + dissolvedOrganicRespiration;
  biology.grazingKgCm2 = grazingC;
  biology.detritusRemineralizationKgCm2 = detritusRemineralization;
  biology.dissolvedOrganicRespirationKgCm2 = dissolvedOrganicRespiration;
  biology.nitrogenUptakeKgNm2 = nitrogenUptake;
  biology.nitrogenRemineralizationKgNm2 = nitrogenRemineralization;
  biology.phosphorusUptakeKgPm2 = phosphorusUptake;
  biology.phosphorusRemineralizationKgPm2 = phosphorusRemineralization;
  biology.photosyntheticOxygenKgO2m2 = photosyntheticOxygenKgO2m2;
  biology.respirationOxygenKgO2m2 = respirationOxygenKgO2m2;
  const oxygenTarget = Math.max(.001,
    exchange.targetDissolvedOxygenKgO2m2);
  state.physiology = {
    active: true,
    temperatureC: round(temperatureC),
    salinityPsu: round(salinityPsu),
    lightStress: round(lightStress),
    temperatureStress: round(temperatureStress),
    nitrogenStress: round(potentialNetGrowth > 1e-15
      ? clamp(retainedPrimaryProduction /
        Math.min(potentialNetGrowth,
          accessiblePhosphorus * REDFIELD_C_TO_P_MASS)) : 1),
    phosphorusStress: round(potentialNetGrowth > 1e-15
      ? clamp(retainedPrimaryProduction /
        Math.min(potentialNetGrowth,
          accessibleNitrogen * REDFIELD_C_TO_N_MASS)) : 1),
    oxygenStress: round(clamp(state.oxygen.dissolvedKgO2m2 / oxygenTarget)),
    absorbedParMjM2: round(absorbedParMjM2),
    openWaterFraction: round(openWaterFraction)
  };
  const deepOceanStep = advanceDeepOcean(state.deepOcean, state, {
    mixedLayerDepthM: depthM,
    mixing: finite(options.sample?.ecology?.marineMixing, .45),
    overturning: clamp(finite(environment.windSpeedMps, 3) / 18),
    deepTemperatureC: clamp(temperatureC - 9, -1.8, 5)
  }, duration, { enabled: true });
  state.deepOcean = deepOceanStep.state;
  refreshDiagnostics(state);
  state.lastFluxReceipt = fluxReceipt(state, initial, duration, exchange,
    biology, deepOceanStep.receipt, 'active',
    'coupled-mixed-layer-and-deep-ocean-carbon-oxygen-nutrient-step');
  state.migrationCheckpoint = false;
  return { state, receipt: clone(state.lastFluxReceipt) };
}

export function applyRiverBiogeochemistryInput(source, deliveredFreshwaterKg,
  areaM2, options = {}) {
  const landRunoffInput = options.inputKind === 'land-runoff';
  const waterKg = Math.max(0, finite(deliveredFreshwaterKg));
  const area = Math.max(1, finite(areaM2, 1));
  const state = normalizeOceanEcology(source, {
    sample: options.sample,
    ocean: options.ocean,
    lifeAbundance: options.lifeAbundance
  });
  const initial = oceanEcologyElementTotals(state);
  const initialReceivingPools = {
    dissolvedInorganicCarbonKgCm2:
      state.carbon.dissolvedInorganicKgCm2,
    dissolvedOrganicCarbonKgCm2: state.carbon.dissolvedOrganicKgCm2,
    dissolvedInorganicNitrogenKgNm2:
      state.nitrogen.dissolvedInorganicKgNm2,
    dissolvedInorganicPhosphorusKgPm2:
      state.phosphorus.dissolvedInorganicKgPm2,
    dissolvedOxygenKgO2m2: state.oxygen.dissolvedKgO2m2
    , alkalinityKgCaCO3Eqm2:
      state.alkalinity.dissolvedKgCaCO3Eqm2
  };
  const waterVolumeM3m2 = waterKg / 1000 / area;
  const explicit = options.explicitInputsKg && typeof options.explicitInputsKg === 'object'
    ? options.explicitInputsKg : null;
  const concentrations = explicit ? {
    dissolvedInorganicCarbonKgM3: waterKg > 0
      ? Math.max(0, finite(explicit.dissolvedInorganicCarbonKgC)) / (waterKg / 1000) : 0,
    dissolvedOrganicCarbonKgM3: waterKg > 0
      ? Math.max(0, finite(explicit.dissolvedOrganicCarbonKgC)) / (waterKg / 1000) : 0,
    dissolvedInorganicNitrogenKgM3: waterKg > 0
      ? Math.max(0, finite(explicit.dissolvedInorganicNitrogenKgN)) / (waterKg / 1000) : 0,
    dissolvedInorganicPhosphorusKgM3: waterKg > 0
      ? Math.max(0, finite(explicit.dissolvedInorganicPhosphorusKgP)) / (waterKg / 1000) : 0,
    dissolvedOxygenKgM3: waterKg > 0
      ? Math.max(0, finite(explicit.dissolvedOxygenKgO2)) / (waterKg / 1000) : 0,
    alkalinityKgCaCO3EqM3: waterKg > 0
      ? Math.max(0, finite(explicit.alkalinityKgCaCO3Eq)) /
        (waterKg / 1000) : 0
  } : {
    dissolvedInorganicCarbonKgM3: Math.max(0,
      finite(options.dissolvedInorganicCarbonKgM3, .012)),
    dissolvedOrganicCarbonKgM3: Math.max(0,
      finite(options.dissolvedOrganicCarbonKgM3, .006)),
    dissolvedInorganicNitrogenKgM3: Math.max(0,
      finite(options.dissolvedInorganicNitrogenKgM3, .0018)),
    dissolvedInorganicPhosphorusKgM3: Math.max(0,
      finite(options.dissolvedInorganicPhosphorusKgM3, .00012)),
    dissolvedOxygenKgM3: Math.max(0,
      finite(options.dissolvedOxygenKgM3, .008)),
    alkalinityKgCaCO3EqM3: Math.max(0,
      finite(options.alkalinityKgCaCO3EqM3, .05))
  };
  const inputs = explicit ? {
    dissolvedInorganicCarbonKgCm2:
      Math.max(0, finite(explicit.dissolvedInorganicCarbonKgC)) / area,
    dissolvedOrganicCarbonKgCm2:
      Math.max(0, finite(explicit.dissolvedOrganicCarbonKgC)) / area,
    dissolvedInorganicNitrogenKgNm2:
      Math.max(0, finite(explicit.dissolvedInorganicNitrogenKgN)) / area,
    dissolvedInorganicPhosphorusKgPm2:
      Math.max(0, finite(explicit.dissolvedInorganicPhosphorusKgP)) / area,
    dissolvedOxygenKgO2m2:
      Math.max(0, finite(explicit.dissolvedOxygenKgO2)) / area,
    alkalinityKgCaCO3Eqm2:
      Math.max(0, finite(explicit.alkalinityKgCaCO3Eq)) / area
  } : {
    dissolvedInorganicCarbonKgCm2: waterVolumeM3m2 *
      concentrations.dissolvedInorganicCarbonKgM3,
    dissolvedOrganicCarbonKgCm2: waterVolumeM3m2 *
      concentrations.dissolvedOrganicCarbonKgM3,
    dissolvedInorganicNitrogenKgNm2: waterVolumeM3m2 *
      concentrations.dissolvedInorganicNitrogenKgM3,
    dissolvedInorganicPhosphorusKgPm2: waterVolumeM3m2 *
      concentrations.dissolvedInorganicPhosphorusKgM3,
    dissolvedOxygenKgO2m2: waterVolumeM3m2 *
      concentrations.dissolvedOxygenKgM3,
    alkalinityKgCaCO3Eqm2: waterVolumeM3m2 *
      concentrations.alkalinityKgCaCO3EqM3
  };
  state.carbon.dissolvedInorganicKgCm2 +=
    inputs.dissolvedInorganicCarbonKgCm2;
  state.carbon.dissolvedOrganicKgCm2 += inputs.dissolvedOrganicCarbonKgCm2;
  state.nitrogen.dissolvedInorganicKgNm2 +=
    inputs.dissolvedInorganicNitrogenKgNm2;
  state.phosphorus.dissolvedInorganicKgPm2 +=
    inputs.dissolvedInorganicPhosphorusKgPm2;
  state.oxygen.dissolvedKgO2m2 += inputs.dissolvedOxygenKgO2m2;
  state.alkalinity.dissolvedKgCaCO3Eqm2 +=
    inputs.alkalinityKgCaCO3Eqm2;
  const inputTotals = {
    carbonKgCm2: inputs.dissolvedInorganicCarbonKgCm2 +
      inputs.dissolvedOrganicCarbonKgCm2,
    nitrogenKgNm2: inputs.dissolvedInorganicNitrogenKgNm2,
    phosphorusKgPm2: inputs.dissolvedInorganicPhosphorusKgPm2,
    oxygenKgO2m2: inputs.dissolvedOxygenKgO2m2,
    alkalinityKgCaCO3Eqm2: inputs.alkalinityKgCaCO3Eqm2
  };
  if (state.migrationCheckpoint) {
    for (const [key, value] of Object.entries(inputTotals)) {
      state.migrationBoundaryInputs[key] += value;
    }
  }
  refreshDiagnostics(state);
  const final = oceanEcologyElementTotals(state);
  const credited = {
    carbonKgCm2: state.carbon.dissolvedInorganicKgCm2 -
      initialReceivingPools.dissolvedInorganicCarbonKgCm2 +
      state.carbon.dissolvedOrganicKgCm2 -
      initialReceivingPools.dissolvedOrganicCarbonKgCm2,
    nitrogenKgNm2: state.nitrogen.dissolvedInorganicKgNm2 -
      initialReceivingPools.dissolvedInorganicNitrogenKgNm2,
    phosphorusKgPm2: state.phosphorus.dissolvedInorganicKgPm2 -
      initialReceivingPools.dissolvedInorganicPhosphorusKgPm2,
    oxygenKgO2m2: state.oxygen.dissolvedKgO2m2 -
      initialReceivingPools.dissolvedOxygenKgO2m2,
    alkalinityKgCaCO3Eqm2:
      state.alkalinity.dissolvedKgCaCO3Eqm2 -
      initialReceivingPools.alkalinityKgCaCO3Eqm2
  };
  const receipt = {
    schema: landRunoffInput
      ? EARTH_OCEAN_ECOLOGY_RUNOFF_INPUT_SCHEMA
      : EARTH_OCEAN_ECOLOGY_RIVER_INPUT_SCHEMA,
    transferId: options.transferId ? String(options.transferId) : null,
    status: explicit
      ? landRunoffInput
        ? 'applied-persistent-land-runoff-transfer'
        : 'applied-persistent-river-transfer'
      : 'applied-parameterized-boundary',
    deliveredFreshwaterKg: round(waterKg, 3),
    receivingAreaM2: round(area, 3),
    concentrations,
    inputs: {
      carbonKgC: round(inputTotals.carbonKgCm2 * area, 6),
      nitrogenKgN: round(inputTotals.nitrogenKgNm2 * area, 6),
      phosphorusKgP: round(inputTotals.phosphorusKgPm2 * area, 6),
      oxygenKgO2: round(inputTotals.oxygenKgO2m2 * area, 6),
      alkalinityKgCaCO3Eq: round(
        inputTotals.alkalinityKgCaCO3Eqm2 * area, 6)
    },
    conservation: {
      carbonResidualKgC: round((credited.carbonKgCm2 -
        inputTotals.carbonKgCm2) * area, 9),
      nitrogenResidualKgN: round((credited.nitrogenKgNm2 -
        inputTotals.nitrogenKgNm2) * area, 9),
      phosphorusResidualKgP: round((credited.phosphorusKgPm2 -
        inputTotals.phosphorusKgPm2) * area, 9),
      oxygenResidualKgO2: round((credited.oxygenKgO2m2 -
        inputTotals.oxygenKgO2m2) * area, 9),
      alkalinityResidualKgCaCO3Eq: round((
        credited.alkalinityKgCaCO3Eqm2 -
        inputTotals.alkalinityKgCaCO3Eqm2) * area, 9)
    },
    truth: {
      explicitBoundaryConcentrations: !explicit,
      upstreamRiverChemistryReservoirs: Boolean(explicit) && !landRunoffInput,
      persistentLandRunoffQueue: Boolean(explicit) && landRunoffInput,
      landRunoffQueueSenderDebited: Boolean(explicit) && landRunoffInput,
      exactPairedTransferId: Boolean(options.transferId),
      senderNutrientsDebited: Boolean(explicit),
      receivingOceanPoolsCredited: true,
      alkalinitySenderDebited: Boolean(explicit),
      alkalinityReceiverPoolCredited: true,
      carbonateSpeciationResolved: false,
      pHResolved: false
    }
  };
  if (landRunoffInput) state.lastRunoffInputReceipt = receipt;
  else state.lastRiverInputReceipt = receipt;
  return { state, receipt: clone(receipt) };
}

export function applyLandRunoffBiogeochemistryInput(source,
  deliveredFreshwaterKg, areaM2, options = {}) {
  if (!options.explicitInputsKg || typeof options.explicitInputsKg !== 'object') {
    throw new Error('Land-runoff ocean input requires explicit debited pools');
  }
  return applyRiverBiogeochemistryInput(source, deliveredFreshwaterKg,
    areaM2, { ...options, inputKind: 'land-runoff' });
}

export function oceanEcologyDescription() {
  return {
    stateSchema: EARTH_OCEAN_ECOLOGY_SCHEMA,
    fluxReceiptSchema: EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA,
    riverInputReceiptSchema: EARTH_OCEAN_ECOLOGY_RIVER_INPUT_SCHEMA,
    runoffInputReceiptSchema: EARTH_OCEAN_ECOLOGY_RUNOFF_INPUT_SCHEMA,
    deepOcean: deepOceanDescription(),
    carbonateSystem: carbonateSystemDescription(),
    airSeaCarbonExchange: airSeaCarbonExchangeDescription(),
    reservoirs: [
      'local-exchangeable-atmospheric-carbon',
      'dissolved-inorganic-carbon',
      'dissolved-organic-carbon',
      'phytoplankton-carbon-nitrogen-phosphorus',
      'zooplankton-carbon-nitrogen-phosphorus',
      'detrital-carbon-nitrogen-phosphorus',
      'dissolved-inorganic-nitrogen',
      'dissolved-inorganic-phosphorus',
      'local-exchangeable-atmospheric-oxygen',
      'dissolved-oxygen',
      'dissolved-alkalinity-as-CaCO3-equivalent'
      , 'read-only-mixed-layer-carbonate-equilibrium-diagnostic'
      , 'deep-ocean-dissolved-carbon-nitrogen-phosphorus-and-oxygen'
      , 'deep-ocean-detritus-and-seafloor-buried-organic-matter'
    ],
    processes: [
      'light-temperature-ice-and-nutrient-limited-primary-production',
      'grazing-mortality-and-detritus-formation',
      'oxygen-limited-community-respiration-and-remineralization',
      'carbonate-informed-local-air-sea-carbon-and-oxygen-exchange',
      'mixed-layer-to-deep-dissolved-exchange',
      'sinking-particle-export-deep-remineralization-and-seafloor-burial',
      'parameterized-river-mouth-biogeochemistry-boundary',
      'explicit-persistent-land-runoff-queue-input',
      'loaded-neighbor-mixed-layer-tracer-seam'
    ],
    physicalGasExchangeWhenLifeDisabled: true,
    physicalDeepExchangeWhenLifeDisabled: true,
    persistentDeepOceanReservoirs: true,
    persistentDeepOceanAlkalinity: true,
    maximumStepDays: 1,
    globallyMixedAtmosphericGases: false,
    upstreamRiverChemistryReservoirs: true,
    persistentLandRunoffQueueInputs: true,
    persistentMixedLayerAlkalinity: true,
    alkalinityUnit: 'kg-CaCO3-equivalent',
    alkalinityReferenceInitialization: '2300-umol-kg-at-salinity-35',
    deepOceanAlkalinityExchange: true,
    deepOceanAlkalinityMigration: 'explicit-zero-for-v1-deep-ocean-state',
    carbonateSpeciationResolved: true,
    pHResolved: true,
    carbonateDiagnosticOnly: true,
    carbonateDiagnosticMutatesMaterial: false,
    carbonateInformedAirSeaCo2Exchange: true,
    airSeaCo2FugacityCorrection: true,
    scientificAirSeaGasTransferVelocity: false,
    measuredAirSeaPco2: false,
    measuredOceanSkinTemperature: false,
    carbonateValidityEnvelope: 'surface-pressure-2-to-35-C-salinity-19-to-43',
    carbonateOutOfEnvelopeBehavior: 'typed-non-solution-without-clamping',
    carbonateSilicateAlkalinityIncluded: false,
    carbonatePHFeedbackModeled: false,
    deepOceanPHResolved: false,
    threeDimensionalOceanCirculation: false,
    mechanisticPlanktonBiochemistry: false,
    scientificModel: false
  };
}
