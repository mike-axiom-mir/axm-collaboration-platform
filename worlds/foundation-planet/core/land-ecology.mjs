export const EARTH_LAND_ECOLOGY_SCHEMA =
  'axm.foundation-planet.land-ecology-state/v1';
export const EARTH_LAND_ECOLOGY_FLUX_SCHEMA =
  'axm.foundation-planet.land-ecology-flux-receipt/v1';
export const LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA =
  'axm.foundation-planet.land-ecology-subgrid-biomass-debit/v1';

const REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2 = 3.45;
const REFERENCE_CO2_PPM = 420;
const DAY_SECONDS = 86_400;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));
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

const FUNCTIONAL_TYPES = Object.freeze({
  'tropical-forest': Object.freeze({
    maximumCover: .98, maximumLai: 7.5, maximumHeightM: 38,
    matureCarbonKgCm2: 18, biomassScaleKgCm2: 5.6, canopyAlbedo: .115,
    liveCN: 34, litterCN: 48, optimumC: 27, thermalWidthC: 16,
    lightUseEfficiencyGCMJ: 1.42, turnoverRateDay: .00032, rootFraction: .95
  }),
  'temperate-forest': Object.freeze({
    maximumCover: .94, maximumLai: 6.2, maximumHeightM: 29,
    matureCarbonKgCm2: 13, biomassScaleKgCm2: 4.3, canopyAlbedo: .135,
    liveCN: 38, litterCN: 50, optimumC: 22, thermalWidthC: 17,
    lightUseEfficiencyGCMJ: 1.31, turnoverRateDay: .00048, rootFraction: .92
  }),
  'boreal-forest': Object.freeze({
    maximumCover: .88, maximumLai: 4.8, maximumHeightM: 21,
    matureCarbonKgCm2: 10, biomassScaleKgCm2: 3.7, canopyAlbedo: .105,
    liveCN: 48, litterCN: 62, optimumC: 15, thermalWidthC: 15,
    lightUseEfficiencyGCMJ: 1.05, turnoverRateDay: .00037, rootFraction: .86
  }),
  savanna: Object.freeze({
    maximumCover: .78, maximumLai: 3.6, maximumHeightM: 9,
    matureCarbonKgCm2: 3.2, biomassScaleKgCm2: 1.05, canopyAlbedo: .165,
    liveCN: 42, litterCN: 54, optimumC: 27, thermalWidthC: 19,
    lightUseEfficiencyGCMJ: 1.24, turnoverRateDay: .00115, rootFraction: .9
  }),
  grassland: Object.freeze({
    maximumCover: .92, maximumLai: 3.2, maximumHeightM: 1.15,
    matureCarbonKgCm2: .95, biomassScaleKgCm2: .27, canopyAlbedo: .19,
    liveCN: 36, litterCN: 46, optimumC: 21, thermalWidthC: 18,
    lightUseEfficiencyGCMJ: 1.38, turnoverRateDay: .0022, rootFraction: .82
  }),
  shrubland: Object.freeze({
    maximumCover: .42, maximumLai: 1.8, maximumHeightM: 2.4,
    matureCarbonKgCm2: 1.25, biomassScaleKgCm2: .42, canopyAlbedo: .205,
    liveCN: 45, litterCN: 58, optimumC: 25, thermalWidthC: 21,
    lightUseEfficiencyGCMJ: .92, turnoverRateDay: .00082, rootFraction: .95
  }),
  tundra: Object.freeze({
    maximumCover: .68, maximumLai: 1.35, maximumHeightM: .34,
    matureCarbonKgCm2: .42, biomassScaleKgCm2: .16, canopyAlbedo: .17,
    liveCN: 52, litterCN: 64, optimumC: 9, thermalWidthC: 13,
    lightUseEfficiencyGCMJ: .76, turnoverRateDay: .0009, rootFraction: .48
  }),
  coastal: Object.freeze({
    maximumCover: .72, maximumLai: 3.4, maximumHeightM: 6.5,
    matureCarbonKgCm2: 2.7, biomassScaleKgCm2: .85, canopyAlbedo: .15,
    liveCN: 40, litterCN: 50, optimumC: 23, thermalWidthC: 19,
    lightUseEfficiencyGCMJ: 1.18, turnoverRateDay: .00115, rootFraction: .78
  }),
  pioneer: Object.freeze({
    maximumCover: .16, maximumLai: .55, maximumHeightM: .22,
    matureCarbonKgCm2: .11, biomassScaleKgCm2: .055, canopyAlbedo: .22,
    liveCN: 55, litterCN: 70, optimumC: 18, thermalWidthC: 22,
    lightUseEfficiencyGCMJ: .55, turnoverRateDay: .001, rootFraction: .35
  }),
  barren: Object.freeze({
    maximumCover: 0, maximumLai: 0, maximumHeightM: 0,
    matureCarbonKgCm2: 0, biomassScaleKgCm2: 1, canopyAlbedo: .2,
    liveCN: 55, litterCN: 70, optimumC: 18, thermalWidthC: 22,
    lightUseEfficiencyGCMJ: 0, turnoverRateDay: 0, rootFraction: 0
  })
});

function functionalTypeFor(sample) {
  switch (sample?.biome) {
    case 'rainforest': return 'tropical-forest';
    case 'temperate_forest': return 'temperate-forest';
    case 'taiga': return 'boreal-forest';
    case 'savanna': return 'savanna';
    case 'grassland': return 'grassland';
    case 'desert': return 'shrubland';
    case 'tundra': return 'tundra';
    case 'coast': return 'coastal';
    case 'alpine': return 'pioneer';
    default: return sample?.land === false ? 'barren' : 'barren';
  }
}

export function deriveLandEcologyTraits(sample = {}, substrate = {}, options = {}) {
  const plantFunctionalType = functionalTypeFor(sample);
  const template = FUNCTIONAL_TYPES[plantFunctionalType];
  const lifeAbundance = Math.max(0, finite(options.lifeAbundance, 1));
  const productivity = clamp(finite(sample?.ecology?.productivity,
    finite(sample?.habitability)) * Math.min(1.5, lifeAbundance));
  const soilDepthM = Math.max(.03, finite(substrate?.soilDepthM,
    finite(sample?.geology?.soilDepthM, .3)));
  return {
    biomeId: String(sample?.biome || 'migration-unknown'),
    plantFunctionalType,
    maximumCanopyCover: round(template.maximumCover * clamp(productivity * 1.55)),
    maximumLeafAreaIndex: template.maximumLai,
    maximumCanopyHeightM: template.maximumHeightM,
    matureBiomassCarbonKgCm2: template.matureCarbonKgCm2,
    biomassScaleKgCm2: template.biomassScaleKgCm2,
    canopyAlbedo: template.canopyAlbedo,
    liveCarbonNitrogenRatio: template.liveCN,
    litterCarbonNitrogenRatio: template.litterCN,
    soilCarbonNitrogenRatio: 12,
    optimumTemperatureC: template.optimumC,
    thermalWidthC: template.thermalWidthC,
    lightUseEfficiencyGCMJ: template.lightUseEfficiencyGCMJ,
    turnoverRateDay: template.turnoverRateDay,
    maximumRootDepthM: round(Math.min(soilDepthM,
      Math.max(.04, soilDepthM * template.rootFraction)))
  };
}

function structuralState(liveCarbonKgCm2, traits) {
  const carbon = Math.max(0, finite(liveCarbonKgCm2));
  const scale = Math.max(.01, finite(traits.biomassScaleKgCm2, 1));
  const development = clamp(1 - Math.exp(-carbon / scale));
  const canopyCover = clamp(finite(traits.maximumCanopyCover) * development);
  const leafAreaIndex = Math.max(0,
    finite(traits.maximumLeafAreaIndex) * (1 - Math.exp(-carbon / (scale * .62))));
  const canopyHeightM = Math.max(0,
    finite(traits.maximumCanopyHeightM) * (1 - Math.exp(-carbon / (scale * 1.8))));
  const rootDepthM = Math.max(0,
    finite(traits.maximumRootDepthM) * (1 - Math.exp(-carbon / (scale * .5))));
  const aerodynamicRoughnessM = clamp(
    canopyHeightM * .123 * canopyCover + .006 * (1 - canopyCover),
    .003,
    4.5
  );
  return {
    canopyCover: round(canopyCover),
    leafAreaIndex: round(leafAreaIndex),
    canopyHeightM: round(canopyHeightM),
    rootDepthM: round(rootDepthM),
    aerodynamicRoughnessM: round(aerodynamicRoughnessM)
  };
}

function carbonTotal(carbon) {
  return finite(carbon?.atmosphericExchangeableKgCm2) +
    finite(carbon?.liveBiomassKgCm2) + finite(carbon?.litterKgCm2) +
    finite(carbon?.soilOrganicKgCm2);
}

function nitrogenTotal(nitrogen) {
  return finite(nitrogen?.liveBiomassKgNm2) + finite(nitrogen?.litterKgNm2) +
    finite(nitrogen?.soilOrganicKgNm2) + finite(nitrogen?.mineralKgNm2);
}

function refreshDiagnostics(state) {
  Object.assign(state, structuralState(state.carbon.liveBiomassKgCm2, state.traits));
  state.carbon.totalKgCm2 = round(carbonTotal(state.carbon));
  state.carbon.co2PpmProxy = round(REFERENCE_CO2_PPM *
    state.carbon.atmosphericExchangeableKgCm2 /
    REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2, 6);
  state.nitrogen.totalKgNm2 = round(nitrogenTotal(state.nitrogen));
  return state;
}

export function createLandEcology(sample, substrate, options = {}) {
  if (!sample?.land) return null;
  const traits = deriveLandEcologyTraits(sample, substrate, options);
  const productivity = clamp(finite(sample?.ecology?.productivity,
    finite(sample?.habitability)) * Math.max(0, finite(options.lifeAbundance, 1)));
  const biologicallyActive = traits.plantFunctionalType !== 'barren' && productivity > 0;
  const liveCarbonKgCm2 = biologicallyActive
    ? Math.max(.001, traits.matureBiomassCarbonKgCm2 * clamp(productivity * 1.08))
    : 0;
  const litterKgCm2 = biologicallyActive
    ? liveCarbonKgCm2 * (.08 + clamp(finite(sample.moisture, .5)) * .08)
    : 0;
  const soilClimate = clamp((finite(sample.temperatureC) + 8) / 38) *
    clamp(finite(sample.moisture, .5) * 1.25);
  const textureFactor = substrate?.texture === 'organic' ? 1.8
    : substrate?.texture === 'sand' ? .52 : 1;
  const soilOrganicKgCm2 = biologicallyActive
    ? clamp(finite(substrate?.soilDepthM, .3) * textureFactor *
      (1.5 + productivity * 7.2) * (.45 + soilClimate * .55), .02, 42)
    : 0;
  const liveNitrogen = liveCarbonKgCm2 / Math.max(1, traits.liveCarbonNitrogenRatio);
  const litterNitrogen = litterKgCm2 / Math.max(1, traits.litterCarbonNitrogenRatio);
  const soilNitrogen = soilOrganicKgCm2 / traits.soilCarbonNitrogenRatio;
  const state = {
    schema: EARTH_LAND_ECOLOGY_SCHEMA,
    migrationCheckpoint: false,
    traits,
    carbon: {
      atmosphericExchangeableKgCm2: REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2,
      liveBiomassKgCm2: liveCarbonKgCm2,
      litterKgCm2,
      soilOrganicKgCm2,
      totalKgCm2: 0,
      co2PpmProxy: REFERENCE_CO2_PPM
    },
    nitrogen: {
      liveBiomassKgNm2: liveNitrogen,
      litterKgNm2: litterNitrogen,
      soilOrganicKgNm2: soilNitrogen,
      mineralKgNm2: biologicallyActive ? clamp(.003 + soilNitrogen * .006, .003, .035) : 0,
      totalKgNm2: 0
    },
    canopyCover: 0,
    leafAreaIndex: 0,
    canopyHeightM: 0,
    rootDepthM: 0,
    aerodynamicRoughnessM: .003,
    physiology: {
      active: biologicallyActive,
      temperatureStress: 0,
      waterStress: 0,
      nitrogenStress: 0,
      absorbedParMjM2: 0,
      potentialTranspirationMm: 0,
      actualTranspirationMm: 0
    },
    lastFluxReceipt: null,
    truth: {
      persistentPools: true,
      localCarbonLedger: true,
      localNitrogenLedger: true,
      canopyRadiationFeedback: true,
      rootZoneWaterFeedback: true,
      globallyMixedAtmosphericCo2: false,
      resolvedPlantIndividuals: false,
      mechanisticBiochemistry: false
    }
  };
  return refreshDiagnostics(state);
}

function migratedLandEcology(substrate = {}) {
  const traits = {
    ...deriveLandEcologyTraits({ land: true, biome: 'alpine', habitability: 0,
      ecology: { productivity: 0 }, geology: { soilDepthM: substrate?.soilDepthM } },
    substrate, { lifeAbundance: 0 }),
    biomeId: 'migration-unknown',
    plantFunctionalType: 'pioneer',
    maximumCanopyCover: 0,
    maximumRootDepthM: Math.min(.2, Math.max(.03, finite(substrate?.rootDepthM, .1)))
  };
  const state = {
    schema: EARTH_LAND_ECOLOGY_SCHEMA,
    migrationCheckpoint: true,
    traits,
    carbon: {
      atmosphericExchangeableKgCm2: REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2,
      liveBiomassKgCm2: 0,
      litterKgCm2: 0,
      soilOrganicKgCm2: 0,
      totalKgCm2: REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2,
      co2PpmProxy: REFERENCE_CO2_PPM
    },
    nitrogen: {
      liveBiomassKgNm2: 0,
      litterKgNm2: 0,
      soilOrganicKgNm2: 0,
      mineralKgNm2: 0,
      totalKgNm2: 0
    },
    canopyCover: 0,
    leafAreaIndex: 0,
    canopyHeightM: 0,
    rootDepthM: 0,
    aerodynamicRoughnessM: .003,
    physiology: {
      active: false,
      temperatureStress: 0,
      waterStress: 0,
      nitrogenStress: 0,
      absorbedParMjM2: 0,
      potentialTranspirationMm: 0,
      actualTranspirationMm: 0
    },
    lastFluxReceipt: null,
    truth: {
      persistentPools: true,
      localCarbonLedger: true,
      localNitrogenLedger: true,
      canopyRadiationFeedback: true,
      rootZoneWaterFeedback: true,
      globallyMixedAtmosphericCo2: false,
      resolvedPlantIndividuals: false,
      mechanisticBiochemistry: false
    }
  };
  return refreshDiagnostics(state);
}

export function normalizeLandEcology(source, context = {}) {
  if (!source || source.schema !== EARTH_LAND_ECOLOGY_SCHEMA) {
    return context.sample?.land
      ? createLandEcology(context.sample, context.substrate, context)
      : migratedLandEcology(context.substrate);
  }
  const state = clone(source);
  state.migrationCheckpoint = state.migrationCheckpoint === true;
  state.traits = { ...migratedLandEcology(context.substrate).traits, ...(state.traits || {}) };
  state.carbon = {
    atmosphericExchangeableKgCm2: Math.max(0,
      finite(state.carbon?.atmosphericExchangeableKgCm2,
        REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2)),
    liveBiomassKgCm2: Math.max(0, finite(state.carbon?.liveBiomassKgCm2)),
    litterKgCm2: Math.max(0, finite(state.carbon?.litterKgCm2)),
    soilOrganicKgCm2: Math.max(0, finite(state.carbon?.soilOrganicKgCm2)),
    totalKgCm2: 0,
    co2PpmProxy: 0
  };
  state.nitrogen = {
    liveBiomassKgNm2: Math.max(0, finite(state.nitrogen?.liveBiomassKgNm2)),
    litterKgNm2: Math.max(0, finite(state.nitrogen?.litterKgNm2)),
    soilOrganicKgNm2: Math.max(0, finite(state.nitrogen?.soilOrganicKgNm2)),
    mineralKgNm2: Math.max(0, finite(state.nitrogen?.mineralKgNm2)),
    totalKgNm2: 0
  };
  state.physiology = {
    active: state.physiology?.active === true,
    temperatureStress: clamp(finite(state.physiology?.temperatureStress)),
    waterStress: clamp(finite(state.physiology?.waterStress)),
    nitrogenStress: clamp(finite(state.physiology?.nitrogenStress)),
    absorbedParMjM2: Math.max(0, finite(state.physiology?.absorbedParMjM2)),
    potentialTranspirationMm: Math.max(0,
      finite(state.physiology?.potentialTranspirationMm)),
    actualTranspirationMm: Math.max(0,
      finite(state.physiology?.actualTranspirationMm))
  };
  state.lastFluxReceipt = state.lastFluxReceipt?.schema === EARTH_LAND_ECOLOGY_FLUX_SCHEMA
    ? state.lastFluxReceipt : null;
  state.truth = {
    persistentPools: true,
    localCarbonLedger: true,
    localNitrogenLedger: true,
    canopyRadiationFeedback: true,
    rootZoneWaterFeedback: true,
    globallyMixedAtmosphericCo2: false,
    resolvedPlantIndividuals: false,
    mechanisticBiochemistry: false
  };
  return refreshDiagnostics(state);
}

export function landEcologyLiveBiomassMass(source, areaM2) {
  const state = normalizeLandEcology(source);
  const area = Math.max(1, finite(areaM2, 1));
  return {
    carbonKgC: round(state.carbon.liveBiomassKgCm2 * area, 9),
    nitrogenKgN: round(state.nitrogen.liveBiomassKgNm2 * area, 9)
  };
}

export function landEcologySubgridDebitCapacity(source, areaM2,
  durationDays = 1, options = {}) {
  const live = landEcologyLiveBiomassMass(source, areaM2);
  const duration = clamp(finite(durationDays, 1), 0, 1);
  const fraction = clamp(finite(options.maximumDailyFraction, .0025) *
    duration, 0, .05);
  return {
    maximumDailyFraction: round(fraction, 9),
    carbonKgC: round(live.carbonKgC * fraction, 9),
    nitrogenKgN: round(live.nitrogenKgN * fraction, 9),
    sourceLiveBiomass: live
  };
}

export function applyLandEcologySubgridBiomassDebit(source, areaM2,
  allocations = [], context = {}) {
  const state = normalizeLandEcology(source);
  const area = Math.max(1, finite(areaM2, 1));
  const durationDays = clamp(finite(context.durationDays, 1), 0, 1);
  const capacity = landEcologySubgridDebitCapacity(state, area,
    durationDays, context);
  const ordered = [...allocations].map(entry => ({
    transferId: String(entry?.transferId || ''),
    reachId: String(entry?.reachId || ''),
    carbonKgC: Math.max(0, finite(entry?.carbonKgC)),
    nitrogenKgN: Math.max(0, finite(entry?.nitrogenKgN))
  })).sort((a, b) => a.transferId.localeCompare(b.transferId));
  if (ordered.some(entry => !entry.transferId || !entry.reachId) ||
    new Set(ordered.map(entry => entry.transferId)).size !== ordered.length) {
    throw new Error('Land ecology subgrid debit requires unique bound transfers');
  }
  const totals = ordered.reduce((sum, entry) => ({
    carbonKgC: sum.carbonKgC + entry.carbonKgC,
    nitrogenKgN: sum.nitrogenKgN + entry.nitrogenKgN
  }), { carbonKgC: 0, nitrogenKgN: 0 });
  if (totals.carbonKgC > capacity.carbonKgC + 1e-6 ||
    totals.nitrogenKgN > capacity.nitrogenKgN + 1e-6) {
    throw new Error('Land ecology subgrid biomass debit exceeds bounded capacity');
  }
  const before = landEcologyLiveBiomassMass(state, area);
  state.carbon.liveBiomassKgCm2 = Math.max(0,
    state.carbon.liveBiomassKgCm2 - totals.carbonKgC / area);
  state.nitrogen.liveBiomassKgNm2 = Math.max(0,
    state.nitrogen.liveBiomassKgNm2 - totals.nitrogenKgN / area);
  refreshDiagnostics(state);
  const after = landEcologyLiveBiomassMass(state, area);
  const receipt = {
    schema: LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA,
    donorCellId: String(context.donorCellId || ''),
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    areaM2: round(area, 3),
    maximumDailyFraction: capacity.maximumDailyFraction,
    allocations: ordered.map(entry => ({
      ...entry,
      carbonKgC: round(entry.carbonKgC, 9),
      nitrogenKgN: round(entry.nitrogenKgN, 9)
    })),
    before,
    debited: {
      carbonKgC: round(totals.carbonKgC, 9),
      nitrogenKgN: round(totals.nitrogenKgN, 9)
    },
    after,
    closure: {
      carbonResidualKgC: round(before.carbonKgC - totals.carbonKgC -
        after.carbonKgC, 9),
      nitrogenResidualKgN: round(before.nitrogenKgN -
        totals.nitrogenKgN - after.nitrogenKgN, 9)
    },
    truth: {
      persistentLandEcologySenderDebited: true,
      exactPerReachTransferIds: true,
      subgridPartitionCreatesMaterial: false,
      boundedDailyDebit: totals.carbonKgC <= capacity.carbonKgC + 1e-6 &&
        totals.nitrogenKgN <= capacity.nitrogenKgN + 1e-6,
      carbonAndNitrogenClosed:
        Math.abs(before.carbonKgC - totals.carbonKgC -
          after.carbonKgC) < 1e-6 &&
        Math.abs(before.nitrogenKgN - totals.nitrogenKgN -
          after.nitrogenKgN) < 1e-6,
      phosphorusTransferred: false
    }
  };
  receipt.digest = stableDigest(receipt);
  return { state, receipt: clone(receipt) };
}

function retargetTraits(state, sample, substrate, lifeAbundance) {
  if (!sample?.land) return state;
  state.traits = deriveLandEcologyTraits(sample, substrate, { lifeAbundance });
  return refreshDiagnostics(state);
}

export function landEcologyWaterDemand(source, environment = {}, options = {}) {
  const state = normalizeLandEcology(source, options);
  const enabled = options.enabled !== false && finite(options.lifeAbundance, 1) > 0 &&
    state.traits.maximumCanopyCover > 0 && state.carbon.liveBiomassKgCm2 > 0;
  const potentialEvapotranspirationMm = Math.max(0,
    finite(environment.potentialEvapotranspirationMm));
  if (!enabled) return {
    potentialTranspirationMm: 0,
    transpirationShare: 0,
    bareSoilExposure: 1,
    fractionAbsorbedPar: 0
  };
  const fractionAbsorbedPar = clamp(1 - Math.exp(-.52 * state.leafAreaIndex));
  const rootWaterStress = clamp(finite(environment.rootZonePlantAvailableFraction));
  const unfrozenFraction = 1 - clamp(finite(environment.soilFrozenFraction)) * .94;
  const transpirationShare = clamp(
    fractionAbsorbedPar * (.42 + state.canopyCover * .5) *
    (.25 + rootWaterStress * .75) * unfrozenFraction,
    0,
    .92
  );
  return {
    potentialTranspirationMm: round(potentialEvapotranspirationMm * transpirationShare),
    transpirationShare: round(transpirationShare),
    bareSoilExposure: round(clamp(1 - state.canopyCover * .82 -
      (1 - Math.exp(-state.carbon.litterKgCm2 * 1.7)) * .22, .08, 1)),
    fractionAbsorbedPar: round(fractionAbsorbedPar)
  };
}

function zeroFluxReceipt(state, environment, durationDays, reason) {
  const totalC = carbonTotal(state.carbon);
  const totalN = nitrogenTotal(state.nitrogen);
  return {
    schema: EARTH_LAND_ECOLOGY_FLUX_SCHEMA,
    durationDays: round(durationDays),
    status: 'dormant',
    reason,
    initial: { totalCarbonKgCm2: round(totalC), totalNitrogenKgNm2: round(totalN) },
    final: { totalCarbonKgCm2: round(totalC), totalNitrogenKgNm2: round(totalN) },
    carbon: {
      grossPrimaryProductionKgCm2: 0,
      autotrophicRespirationKgCm2: 0,
      heterotrophicRespirationKgCm2: 0,
      litterfallKgCm2: 0,
      humificationKgCm2: 0,
      netAtmosphereExchangeKgCm2: 0,
      ecosystemStorageChangeKgCm2: 0,
      residualKgCm2: 0
    },
    nitrogen: {
      plantUptakeKgNm2: 0,
      litterMineralizationKgNm2: 0,
      soilMineralizationKgNm2: 0,
      residualKgNm2: 0
    },
    water: {
      potentialTranspirationMm: Math.max(0,
        round(finite(environment.potentialTranspirationMm))),
      actualTranspirationMm: 0
    },
    surfaceFeedback: {
      canopyCover: round(state.canopyCover),
      leafAreaIndex: round(state.leafAreaIndex),
      canopyHeightM: round(state.canopyHeightM),
      rootDepthM: round(state.rootDepthM),
      aerodynamicRoughnessM: round(state.aerodynamicRoughnessM),
      canopyAlbedo: round(state.traits.canopyAlbedo)
    },
    stresses: { temperature: 0, water: 0, nitrogen: 0, frozen: 0 },
    truth: {
      reservoirsFrozen: true,
      carbonClosed: true,
      nitrogenClosed: true,
      waterCoupled: true,
      localExchangeableAtmosphereOnly: true,
      globallyMixedAtmosphericCo2: false
    }
  };
}

export function advanceLandEcology(source, environment = {}, durationDays = 1, options = {}) {
  const duration = finite(durationDays);
  if (!(duration > 0) || duration > 1.000001) {
    throw new Error('Land-ecology step must be greater than zero and no longer than one day');
  }
  let state = normalizeLandEcology(source, {
    substrate: options.substrate,
    sample: options.sample,
    lifeAbundance: options.lifeAbundance
  });
  if (state.migrationCheckpoint === true && options.sample?.land &&
      finite(options.lifeAbundance, 1) > 0) {
    state = createLandEcology(options.sample, options.substrate, {
      lifeAbundance: options.lifeAbundance
    });
    state.migrationCheckpoint = true;
  }
  state = retargetTraits(state, options.sample, options.substrate,
    options.lifeAbundance);
  const enabled = options.enabled !== false && finite(options.lifeAbundance, 1) > 0 &&
    state.traits.maximumCanopyCover > 0 && state.carbon.liveBiomassKgCm2 > 0;
  if (!enabled) {
    state.physiology = {
      active: false,
      temperatureStress: 0,
      waterStress: 0,
      nitrogenStress: 0,
      absorbedParMjM2: 0,
      potentialTranspirationMm: Math.max(0,
        round(finite(environment.potentialTranspirationMm))),
      actualTranspirationMm: 0
    };
    state.lastFluxReceipt = zeroFluxReceipt(state, environment, duration,
      options.enabled === false ? 'living-layer-disabled' : 'no-active-land-vegetation');
    return { state, receipt: clone(state.lastFluxReceipt) };
  }

  const initialCarbon = clone(state.carbon);
  const initialNitrogen = clone(state.nitrogen);
  const initialTotalCarbon = carbonTotal(initialCarbon);
  const initialTotalNitrogen = nitrogenTotal(initialNitrogen);
  const temperatureC = finite(environment.temperatureC, 15);
  const temperatureStress = clamp(Math.exp(-Math.pow(
    (temperatureC - state.traits.optimumTemperatureC) /
      Math.max(1, state.traits.thermalWidthC), 2)) *
    clamp((temperatureC + 8) / 12));
  const rootWaterStress = clamp(finite(environment.rootZonePlantAvailableFraction));
  const potentialTranspirationMm = Math.max(0,
    finite(environment.potentialTranspirationMm));
  const actualTranspirationMm = clamp(
    finite(environment.actualTranspirationMm),
    0,
    potentialTranspirationMm
  );
  const stomatalSupply = potentialTranspirationMm > 1e-9
    ? clamp(actualTranspirationMm / potentialTranspirationMm)
    : rootWaterStress;
  const waterStress = clamp(rootWaterStress * .58 + stomatalSupply * .42);
  const frozenStress = 1 - clamp(finite(environment.soilFrozenFraction)) * .97;
  const fractionAbsorbedPar = clamp(1 - Math.exp(-.52 * state.leafAreaIndex));
  const absorbedParMjM2 = Math.max(0, finite(environment.absorbedShortwaveWm2)) *
    .45 * DAY_SECONDS * duration / 1e6 * fractionAbsorbedPar;
  const lifeAbundance = clamp(finite(options.lifeAbundance, 1), 0, 1.5);
  const co2Availability = clamp(
    state.carbon.atmosphericExchangeableKgCm2 /
      REFERENCE_ATMOSPHERIC_CARBON_KG_C_M2,
    .08,
    1.7
  );
  const grossPrimaryProductionPotentialKgCm2 = absorbedParMjM2 *
    state.traits.lightUseEfficiencyGCMJ / 1000 * temperatureStress *
    waterStress * frozenStress * lifeAbundance * co2Availability;
  const grossPrimaryProductionKgCm2 = Math.min(
    state.carbon.atmosphericExchangeableKgCm2 * clamp(.035 * duration, 0, .08),
    Math.max(0, grossPrimaryProductionPotentialKgCm2)
  );
  const growthRespirationKgCm2 = grossPrimaryProductionKgCm2 * .24;
  const q10 = Math.pow(2, (temperatureC - 20) / 10);
  const maintenanceRespirationKgCm2 = Math.min(
    state.carbon.liveBiomassKgCm2,
    state.carbon.liveBiomassKgCm2 * clamp(.00032 + .00034 * q10, .00008, .006) *
      duration * (.35 + waterStress * .65)
  );
  const potentialGrowthKgCm2 = Math.max(0,
    grossPrimaryProductionKgCm2 - growthRespirationKgCm2);
  const accessibleMineralNitrogenKgNm2 = state.nitrogen.mineralKgNm2 *
    clamp(.08 + rootWaterStress * .17, .02, .25) * duration;
  const nitrogenLimitedGrowthKgCm2 = accessibleMineralNitrogenKgNm2 *
    state.traits.liveCarbonNitrogenRatio;
  const retainedGrowthKgCm2 = Math.min(potentialGrowthKgCm2,
    nitrogenLimitedGrowthKgCm2);
  const overflowRespirationKgCm2 = potentialGrowthKgCm2 - retainedGrowthKgCm2;
  const plantUptakeKgNm2 = retainedGrowthKgCm2 /
    Math.max(1, state.traits.liveCarbonNitrogenRatio);
  const nitrogenStress = potentialGrowthKgCm2 > 1e-12
    ? clamp(retainedGrowthKgCm2 / potentialGrowthKgCm2) : 1;

  state.carbon.atmosphericExchangeableKgCm2 -= grossPrimaryProductionKgCm2;
  state.carbon.atmosphericExchangeableKgCm2 += growthRespirationKgCm2 +
    overflowRespirationKgCm2 + maintenanceRespirationKgCm2;
  state.carbon.liveBiomassKgCm2 += retainedGrowthKgCm2 -
    maintenanceRespirationKgCm2;
  state.nitrogen.mineralKgNm2 -= plantUptakeKgNm2;
  state.nitrogen.liveBiomassKgNm2 += plantUptakeKgNm2;

  const liveBeforeTurnoverC = state.carbon.liveBiomassKgCm2;
  const liveBeforeTurnoverN = state.nitrogen.liveBiomassKgNm2;
  const litterfallKgCm2 = Math.min(liveBeforeTurnoverC,
    liveBeforeTurnoverC * state.traits.turnoverRateDay * duration *
    (1 + clamp(finite(environment.droughtStress)) * .65));
  const litterfallKgNm2 = liveBeforeTurnoverC > 1e-12
    ? liveBeforeTurnoverN * litterfallKgCm2 / liveBeforeTurnoverC : 0;
  state.carbon.liveBiomassKgCm2 -= litterfallKgCm2;
  state.carbon.litterKgCm2 += litterfallKgCm2;
  state.nitrogen.liveBiomassKgNm2 -= litterfallKgNm2;
  state.nitrogen.litterKgNm2 += litterfallKgNm2;

  const decompositionClimate = clamp(.12 + temperatureStress * .58 +
    rootWaterStress * .3) * frozenStress;
  const litterDecayFraction = clamp(1 - Math.exp(-.0065 * decompositionClimate * duration));
  const litterDecayKgCm2 = state.carbon.litterKgCm2 * litterDecayFraction;
  const litterDecayKgNm2 = state.nitrogen.litterKgNm2 * litterDecayFraction;
  const humificationKgCm2 = litterDecayKgCm2 * .27;
  const litterRespirationKgCm2 = litterDecayKgCm2 - humificationKgCm2;
  const humificationNitrogenKgNm2 = Math.min(
    litterDecayKgNm2,
    humificationKgCm2 / state.traits.soilCarbonNitrogenRatio
  );
  const litterMineralizationKgNm2 = litterDecayKgNm2 -
    humificationNitrogenKgNm2;
  state.carbon.litterKgCm2 -= litterDecayKgCm2;
  state.carbon.soilOrganicKgCm2 += humificationKgCm2;
  state.carbon.atmosphericExchangeableKgCm2 += litterRespirationKgCm2;
  state.nitrogen.litterKgNm2 -= litterDecayKgNm2;
  state.nitrogen.soilOrganicKgNm2 += humificationNitrogenKgNm2;
  state.nitrogen.mineralKgNm2 += litterMineralizationKgNm2;

  const soilDecayFraction = clamp(1 - Math.exp(-.00018 * decompositionClimate * duration));
  const soilRespirationKgCm2 = state.carbon.soilOrganicKgCm2 * soilDecayFraction;
  const soilMineralizationKgNm2 = state.nitrogen.soilOrganicKgNm2 * soilDecayFraction;
  state.carbon.soilOrganicKgCm2 -= soilRespirationKgCm2;
  state.carbon.atmosphericExchangeableKgCm2 += soilRespirationKgCm2;
  state.nitrogen.soilOrganicKgNm2 -= soilMineralizationKgNm2;
  state.nitrogen.mineralKgNm2 += soilMineralizationKgNm2;

  state.carbon.atmosphericExchangeableKgCm2 = Math.max(0,
    state.carbon.atmosphericExchangeableKgCm2);
  state.carbon.liveBiomassKgCm2 = Math.max(0, state.carbon.liveBiomassKgCm2);
  state.carbon.litterKgCm2 = Math.max(0, state.carbon.litterKgCm2);
  state.carbon.soilOrganicKgCm2 = Math.max(0, state.carbon.soilOrganicKgCm2);
  state.nitrogen.liveBiomassKgNm2 = Math.max(0,
    state.nitrogen.liveBiomassKgNm2);
  state.nitrogen.litterKgNm2 = Math.max(0, state.nitrogen.litterKgNm2);
  state.nitrogen.soilOrganicKgNm2 = Math.max(0,
    state.nitrogen.soilOrganicKgNm2);
  state.nitrogen.mineralKgNm2 = Math.max(0, state.nitrogen.mineralKgNm2);
  refreshDiagnostics(state);

  const finalTotalCarbon = carbonTotal(state.carbon);
  const finalTotalNitrogen = nitrogenTotal(state.nitrogen);
  const initialEcosystemCarbon = initialCarbon.liveBiomassKgCm2 +
    initialCarbon.litterKgCm2 + initialCarbon.soilOrganicKgCm2;
  const finalEcosystemCarbon = state.carbon.liveBiomassKgCm2 +
    state.carbon.litterKgCm2 + state.carbon.soilOrganicKgCm2;
  const autotrophicRespirationKgCm2 = growthRespirationKgCm2 +
    overflowRespirationKgCm2 + maintenanceRespirationKgCm2;
  const heterotrophicRespirationKgCm2 = litterRespirationKgCm2 +
    soilRespirationKgCm2;
  const receipt = {
    schema: EARTH_LAND_ECOLOGY_FLUX_SCHEMA,
    durationDays: round(duration),
    status: 'active',
    reason: 'coupled-land-carbon-water-nitrogen-step',
    initial: {
      totalCarbonKgCm2: round(initialTotalCarbon),
      totalNitrogenKgNm2: round(initialTotalNitrogen)
    },
    final: {
      totalCarbonKgCm2: round(finalTotalCarbon),
      totalNitrogenKgNm2: round(finalTotalNitrogen)
    },
    carbon: {
      grossPrimaryProductionKgCm2: round(grossPrimaryProductionKgCm2),
      autotrophicRespirationKgCm2: round(autotrophicRespirationKgCm2),
      heterotrophicRespirationKgCm2: round(heterotrophicRespirationKgCm2),
      litterfallKgCm2: round(litterfallKgCm2),
      humificationKgCm2: round(humificationKgCm2),
      netAtmosphereExchangeKgCm2: round(
        state.carbon.atmosphericExchangeableKgCm2 -
          initialCarbon.atmosphericExchangeableKgCm2),
      ecosystemStorageChangeKgCm2: round(finalEcosystemCarbon -
        initialEcosystemCarbon),
      residualKgCm2: round(finalTotalCarbon - initialTotalCarbon, 12)
    },
    nitrogen: {
      plantUptakeKgNm2: round(plantUptakeKgNm2),
      litterMineralizationKgNm2: round(litterMineralizationKgNm2),
      soilMineralizationKgNm2: round(soilMineralizationKgNm2),
      residualKgNm2: round(finalTotalNitrogen - initialTotalNitrogen, 12)
    },
    water: {
      potentialTranspirationMm: round(potentialTranspirationMm),
      actualTranspirationMm: round(actualTranspirationMm)
    },
    surfaceFeedback: {
      canopyCover: round(state.canopyCover),
      leafAreaIndex: round(state.leafAreaIndex),
      canopyHeightM: round(state.canopyHeightM),
      rootDepthM: round(state.rootDepthM),
      aerodynamicRoughnessM: round(state.aerodynamicRoughnessM),
      canopyAlbedo: round(state.traits.canopyAlbedo)
    },
    stresses: {
      temperature: round(temperatureStress),
      water: round(waterStress),
      nitrogen: round(nitrogenStress),
      frozen: round(frozenStress)
    },
    truth: {
      reservoirsFrozen: false,
      carbonClosed: Math.abs(finalTotalCarbon - initialTotalCarbon) < 1e-9,
      nitrogenClosed: Math.abs(finalTotalNitrogen - initialTotalNitrogen) < 1e-9,
      waterCoupled: true,
      canopyRadiationFeedback: true,
      localExchangeableAtmosphereOnly: true,
      globallyMixedAtmosphericCo2: false,
      resolvedPlantIndividuals: false,
      mechanisticBiochemistry: false
    }
  };
  state.physiology = {
    active: true,
    temperatureStress: round(temperatureStress),
    waterStress: round(waterStress),
    nitrogenStress: round(nitrogenStress),
    absorbedParMjM2: round(absorbedParMjM2),
    potentialTranspirationMm: round(potentialTranspirationMm),
    actualTranspirationMm: round(actualTranspirationMm)
  };
  state.migrationCheckpoint = false;
  state.lastFluxReceipt = receipt;
  return { state, receipt: clone(receipt) };
}

export function landEcologyDescription() {
  return {
    stateSchema: EARTH_LAND_ECOLOGY_SCHEMA,
    fluxReceiptSchema: EARTH_LAND_ECOLOGY_FLUX_SCHEMA,
    subgridBiomassDebitSchema:
      LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA,
    persistentCarbonPools: [
      'local-exchangeable-atmosphere', 'live-biomass', 'litter', 'soil-organic'
    ],
    persistentNitrogenPools: [
      'live-biomass', 'litter', 'soil-organic', 'mineral'
    ],
    physiology: [
      'absorbed-par', 'temperature-stress', 'root-water-stress',
      'nitrogen-limitation', 'gross-primary-production', 'respiration',
      'litterfall', 'humification', 'mineralization', 'transpiration'
    ],
    surfaceFeedbacks: [
      'canopy-cover', 'leaf-area-index', 'canopy-albedo',
      'canopy-height', 'root-depth', 'aerodynamic-roughness'
    ],
    functionalTypes: Object.keys(FUNCTIONAL_TYPES),
    carbonLocallyConservative: true,
    nitrogenLocallyConservative: true,
    pairedSubgridBiomassDebit: true,
    globallyMixedAtmosphericCo2: false,
    mechanisticBiochemistry: false,
    resolvedPlantIndividuals: false
  };
}
