export const DEEP_OCEAN_STATE_SCHEMA = 'axm.foundation-planet.deep-ocean-state/v1';
export const DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA =
  'axm.foundation-planet.deep-ocean-exchange-receipt/v1';

const OXYGEN_KG_PER_RESPIRATED_KG_C = 32 / 12;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

export function emptyDeepOceanState(options = {}) {
  return {
    schema: DEEP_OCEAN_STATE_SCHEMA,
    deepWaterDepthM: clamp(finite(options.deepWaterDepthM, 3200), 120, 6000),
    carbon: {
      dissolvedInorganicKgCm2: 0,
      dissolvedOrganicKgCm2: 0,
      detritusKgCm2: 0,
      seafloorBuriedOrganicKgCm2: 0
    },
    nitrogen: {
      dissolvedInorganicKgNm2: 0,
      detritusKgNm2: 0,
      seafloorBuriedKgNm2: 0
    },
    phosphorus: {
      dissolvedInorganicKgPm2: 0,
      detritusKgPm2: 0,
      seafloorBuriedKgPm2: 0
    },
    oxygen: {
      dissolvedKgO2m2: 0,
      saturationFraction: 0
    },
    cumulative: {
      sinkingCarbonKgCm2: 0,
      remineralizedCarbonKgCm2: 0,
      buriedCarbonKgCm2: 0,
      oxygenConsumedKgO2m2: 0
    },
    migrationCheckpoint: options.migrationCheckpoint === true,
    lastExchangeReceipt: null
  };
}

export function createDeepOceanState(sample = {}, ocean = {}) {
  const depthM = clamp(finite(sample?.depthM,
    3600 - finite(ocean?.mixedLayerDepthM, 60)), 350, 5600);
  const temperatureC = clamp(finite(ocean?.mixedLayerTemperatureC,
    finite(sample?.temperatureC, 8)) - 9, -1.8, 5);
  const oxygenConcentrationKgM3 = clamp(.0062 -
    Math.max(0, temperatureC + 1) * .00018, .0022, .0072);
  const state = emptyDeepOceanState({ deepWaterDepthM: depthM });
  state.carbon.dissolvedInorganicKgCm2 = depthM * .0232;
  state.carbon.dissolvedOrganicKgCm2 = depthM * .00062;
  state.carbon.detritusKgCm2 = .006 +
    clamp(finite(sample?.ecology?.productivity, .35)) * .025;
  state.nitrogen.dissolvedInorganicKgNm2 = depthM * .00042;
  state.nitrogen.detritusKgNm2 = state.carbon.detritusKgCm2 / 7.1;
  state.phosphorus.dissolvedInorganicKgPm2 = depthM * .000052;
  state.phosphorus.detritusKgPm2 = state.carbon.detritusKgCm2 / 72;
  state.oxygen.dissolvedKgO2m2 = depthM * oxygenConcentrationKgM3;
  state.oxygen.saturationFraction = .72;
  return state;
}

export function normalizeDeepOceanState(source, options = {}) {
  if (!source || source.schema !== DEEP_OCEAN_STATE_SCHEMA) {
    return options.initialize === true
      ? createDeepOceanState(options.sample, options.ocean)
      : emptyDeepOceanState({
        deepWaterDepthM: options.deepWaterDepthM,
        migrationCheckpoint: options.migrationCheckpoint === true
      });
  }
  const state = emptyDeepOceanState({ deepWaterDepthM: source.deepWaterDepthM });
  for (const [group, fields] of Object.entries({
    carbon: ['dissolvedInorganicKgCm2', 'dissolvedOrganicKgCm2',
      'detritusKgCm2', 'seafloorBuriedOrganicKgCm2'],
    nitrogen: ['dissolvedInorganicKgNm2', 'detritusKgNm2',
      'seafloorBuriedKgNm2'],
    phosphorus: ['dissolvedInorganicKgPm2', 'detritusKgPm2',
      'seafloorBuriedKgPm2']
  })) {
    for (const field of fields) state[group][field] = Math.max(0,
      finite(source[group]?.[field]));
  }
  state.oxygen.dissolvedKgO2m2 = Math.max(0,
    finite(source.oxygen?.dissolvedKgO2m2));
  state.oxygen.saturationFraction = clamp(
    finite(source.oxygen?.saturationFraction));
  for (const key of Object.keys(state.cumulative)) {
    state.cumulative[key] = Math.max(0, finite(source.cumulative?.[key]));
  }
  state.migrationCheckpoint = source.migrationCheckpoint === true;
  state.lastExchangeReceipt = source.lastExchangeReceipt?.schema ===
    DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA ? clone(source.lastExchangeReceipt) : null;
  return state;
}

export function deepOceanElementTotals(source) {
  const state = normalizeDeepOceanState(source);
  return {
    carbonKgCm2: state.carbon.dissolvedInorganicKgCm2 +
      state.carbon.dissolvedOrganicKgCm2 + state.carbon.detritusKgCm2 +
      state.carbon.seafloorBuriedOrganicKgCm2,
    nitrogenKgNm2: state.nitrogen.dissolvedInorganicKgNm2 +
      state.nitrogen.detritusKgNm2 + state.nitrogen.seafloorBuriedKgNm2,
    phosphorusKgPm2: state.phosphorus.dissolvedInorganicKgPm2 +
      state.phosphorus.detritusKgPm2 + state.phosphorus.seafloorBuriedKgPm2,
    oxygenKgO2m2: state.oxygen.dissolvedKgO2m2
  };
}

function moveDissolved(surfaceGroup, surfaceField, deepGroup, deepField,
  surfaceDepthM, deepDepthM, exchangeDepthM) {
  const surfaceConcentration = finite(surfaceGroup[surfaceField]) / surfaceDepthM;
  const deepConcentration = finite(deepGroup[deepField]) / deepDepthM;
  const signedSurfaceToDeep = (surfaceConcentration - deepConcentration) *
    exchangeDepthM;
  if (signedSurfaceToDeep >= 0) {
    const amount = Math.min(surfaceGroup[surfaceField], signedSurfaceToDeep);
    surfaceGroup[surfaceField] -= amount;
    deepGroup[deepField] += amount;
    return amount;
  }
  const amount = Math.min(deepGroup[deepField], -signedSurfaceToDeep);
  deepGroup[deepField] -= amount;
  surfaceGroup[surfaceField] += amount;
  return -amount;
}

export function advanceDeepOcean(source, surface, environment = {},
  durationDays = 1, options = {}) {
  const duration = finite(durationDays);
  if (!(duration > 0) || duration > 1.000001) {
    throw new Error('Deep-ocean step must be greater than zero and no longer than one day');
  }
  const state = normalizeDeepOceanState(source);
  const initialDeep = deepOceanElementTotals(state);
  const initialSurface = {
    carbonKgCm2: finite(surface.carbon?.dissolvedInorganicKgCm2) +
      finite(surface.carbon?.dissolvedOrganicKgCm2) +
      finite(surface.carbon?.detritusKgCm2),
    nitrogenKgNm2: finite(surface.nitrogen?.dissolvedInorganicKgNm2) +
      finite(surface.nitrogen?.detritusKgNm2),
    phosphorusKgPm2: finite(surface.phosphorus?.dissolvedInorganicKgPm2) +
      finite(surface.phosphorus?.detritusKgPm2),
    oxygenKgO2m2: finite(surface.oxygen?.dissolvedKgO2m2)
  };
  const surfaceDepthM = clamp(finite(environment.mixedLayerDepthM, 60), 12, 180);
  const deepDepthM = state.deepWaterDepthM;
  const mixing = clamp(finite(environment.mixing, .45));
  const overturning = clamp(finite(environment.overturning, .3));
  const exchangeDepthM = clamp((.012 + mixing * .055 + overturning * .035) *
    duration, .002, .18);
  const dissolvedExchange = {
    carbonDissolvedInorganicSurfaceToDeepKgCm2: moveDissolved(surface.carbon,
      'dissolvedInorganicKgCm2', state.carbon, 'dissolvedInorganicKgCm2',
      surfaceDepthM, deepDepthM, exchangeDepthM),
    carbonDissolvedOrganicSurfaceToDeepKgCm2: moveDissolved(surface.carbon,
      'dissolvedOrganicKgCm2', state.carbon, 'dissolvedOrganicKgCm2',
      surfaceDepthM, deepDepthM, exchangeDepthM),
    nitrogenSurfaceToDeepKgNm2: moveDissolved(surface.nitrogen,
      'dissolvedInorganicKgNm2', state.nitrogen, 'dissolvedInorganicKgNm2',
      surfaceDepthM, deepDepthM, exchangeDepthM),
    phosphorusSurfaceToDeepKgPm2: moveDissolved(surface.phosphorus,
      'dissolvedInorganicKgPm2', state.phosphorus, 'dissolvedInorganicKgPm2',
      surfaceDepthM, deepDepthM, exchangeDepthM),
    oxygenSurfaceToDeepKgO2m2: moveDissolved(surface.oxygen,
      'dissolvedKgO2m2', state.oxygen, 'dissolvedKgO2m2',
      surfaceDepthM, deepDepthM, exchangeDepthM)
  };

  let sinkingCarbonKgCm2 = 0;
  let sinkingNitrogenKgNm2 = 0;
  let sinkingPhosphorusKgPm2 = 0;
  let remineralizedCarbonKgCm2 = 0;
  let remineralizedNitrogenKgNm2 = 0;
  let remineralizedPhosphorusKgPm2 = 0;
  let oxygenConsumedKgO2m2 = 0;
  let buriedCarbonKgCm2 = 0;
  let buriedNitrogenKgNm2 = 0;
  let buriedPhosphorusKgPm2 = 0;
  const biologicalEnabled = options.enabled !== false;
  if (biologicalEnabled) {
    const sinkingFraction = clamp(1 - Math.exp(-(.005 + mixing * .008) * duration));
    sinkingCarbonKgCm2 = surface.carbon.detritusKgCm2 * sinkingFraction;
    sinkingNitrogenKgNm2 = surface.nitrogen.detritusKgNm2 * sinkingFraction;
    sinkingPhosphorusKgPm2 = surface.phosphorus.detritusKgPm2 * sinkingFraction;
    surface.carbon.detritusKgCm2 -= sinkingCarbonKgCm2;
    surface.nitrogen.detritusKgNm2 -= sinkingNitrogenKgNm2;
    surface.phosphorus.detritusKgPm2 -= sinkingPhosphorusKgPm2;
    state.carbon.detritusKgCm2 += sinkingCarbonKgCm2;
    state.nitrogen.detritusKgNm2 += sinkingNitrogenKgNm2;
    state.phosphorus.detritusKgPm2 += sinkingPhosphorusKgPm2;

    const temperatureFactor = clamp(2 ** ((finite(environment.deepTemperatureC, 2) - 4) / 10),
      .3, 1.4);
    const potentialRemineralizedCarbon = state.carbon.detritusKgCm2 *
      .0018 * temperatureFactor * duration;
    remineralizedCarbonKgCm2 = Math.min(potentialRemineralizedCarbon,
      state.oxygen.dissolvedKgO2m2 / OXYGEN_KG_PER_RESPIRATED_KG_C);
    const remineralizedFraction = state.carbon.detritusKgCm2 > 1e-15
      ? remineralizedCarbonKgCm2 / state.carbon.detritusKgCm2 : 0;
    remineralizedNitrogenKgNm2 = state.nitrogen.detritusKgNm2 *
      remineralizedFraction;
    remineralizedPhosphorusKgPm2 = state.phosphorus.detritusKgPm2 *
      remineralizedFraction;
    oxygenConsumedKgO2m2 = remineralizedCarbonKgCm2 *
      OXYGEN_KG_PER_RESPIRATED_KG_C;
    state.carbon.detritusKgCm2 -= remineralizedCarbonKgCm2;
    state.nitrogen.detritusKgNm2 -= remineralizedNitrogenKgNm2;
    state.phosphorus.detritusKgPm2 -= remineralizedPhosphorusKgPm2;
    state.carbon.dissolvedInorganicKgCm2 += remineralizedCarbonKgCm2;
    state.nitrogen.dissolvedInorganicKgNm2 += remineralizedNitrogenKgNm2;
    state.phosphorus.dissolvedInorganicKgPm2 += remineralizedPhosphorusKgPm2;
    state.oxygen.dissolvedKgO2m2 -= oxygenConsumedKgO2m2;

    const burialFraction = clamp(1 - Math.exp(-.00016 * duration));
    buriedCarbonKgCm2 = state.carbon.detritusKgCm2 * burialFraction;
    const buriedFraction = state.carbon.detritusKgCm2 > 1e-15
      ? buriedCarbonKgCm2 / state.carbon.detritusKgCm2 : 0;
    buriedNitrogenKgNm2 = state.nitrogen.detritusKgNm2 * buriedFraction;
    buriedPhosphorusKgPm2 = state.phosphorus.detritusKgPm2 * buriedFraction;
    state.carbon.detritusKgCm2 -= buriedCarbonKgCm2;
    state.nitrogen.detritusKgNm2 -= buriedNitrogenKgNm2;
    state.phosphorus.detritusKgPm2 -= buriedPhosphorusKgPm2;
    state.carbon.seafloorBuriedOrganicKgCm2 += buriedCarbonKgCm2;
    state.nitrogen.seafloorBuriedKgNm2 += buriedNitrogenKgNm2;
    state.phosphorus.seafloorBuriedKgPm2 += buriedPhosphorusKgPm2;
  }
  state.cumulative.sinkingCarbonKgCm2 += sinkingCarbonKgCm2;
  state.cumulative.remineralizedCarbonKgCm2 += remineralizedCarbonKgCm2;
  state.cumulative.buriedCarbonKgCm2 += buriedCarbonKgCm2;
  state.cumulative.oxygenConsumedKgO2m2 += oxygenConsumedKgO2m2;
  state.oxygen.saturationFraction = clamp(state.oxygen.dissolvedKgO2m2 /
    Math.max(.001, state.deepWaterDepthM * .0065), 0, 1.5);
  state.migrationCheckpoint = false;

  const finalDeep = deepOceanElementTotals(state);
  const finalSurface = {
    carbonKgCm2: finite(surface.carbon?.dissolvedInorganicKgCm2) +
      finite(surface.carbon?.dissolvedOrganicKgCm2) +
      finite(surface.carbon?.detritusKgCm2),
    nitrogenKgNm2: finite(surface.nitrogen?.dissolvedInorganicKgNm2) +
      finite(surface.nitrogen?.detritusKgNm2),
    phosphorusKgPm2: finite(surface.phosphorus?.dissolvedInorganicKgPm2) +
      finite(surface.phosphorus?.detritusKgPm2),
    oxygenKgO2m2: finite(surface.oxygen?.dissolvedKgO2m2)
  };
  const receipt = {
    schema: DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA,
    status: biologicalEnabled ? 'physical-and-biological' : 'physical-only',
    durationDays: round(duration, 8),
    surfaceDepthM: round(surfaceDepthM, 6),
    deepWaterDepthM: round(deepDepthM, 6),
    exchangeDepthM: round(exchangeDepthM, 12),
    dissolvedExchange: Object.fromEntries(Object.entries(dissolvedExchange)
      .map(([key, value]) => [key, round(value)])),
    particleExport: {
      sinkingCarbonKgCm2: round(sinkingCarbonKgCm2),
      sinkingNitrogenKgNm2: round(sinkingNitrogenKgNm2),
      sinkingPhosphorusKgPm2: round(sinkingPhosphorusKgPm2)
    },
    deepRemineralization: {
      carbonKgCm2: round(remineralizedCarbonKgCm2),
      nitrogenKgNm2: round(remineralizedNitrogenKgNm2),
      phosphorusKgPm2: round(remineralizedPhosphorusKgPm2),
      oxygenConsumedKgO2m2: round(oxygenConsumedKgO2m2)
    },
    seafloorBurial: {
      carbonKgCm2: round(buriedCarbonKgCm2),
      nitrogenKgNm2: round(buriedNitrogenKgNm2),
      phosphorusKgPm2: round(buriedPhosphorusKgPm2)
    },
    conservation: {
      carbonResidualKgCm2: round(finalSurface.carbonKgCm2 + finalDeep.carbonKgCm2 -
        initialSurface.carbonKgCm2 - initialDeep.carbonKgCm2),
      nitrogenResidualKgNm2: round(finalSurface.nitrogenKgNm2 + finalDeep.nitrogenKgNm2 -
        initialSurface.nitrogenKgNm2 - initialDeep.nitrogenKgNm2),
      phosphorusResidualKgPm2: round(finalSurface.phosphorusKgPm2 + finalDeep.phosphorusKgPm2 -
        initialSurface.phosphorusKgPm2 - initialDeep.phosphorusKgPm2),
      oxygenResidualKgO2m2: round(finalSurface.oxygenKgO2m2 + finalDeep.oxygenKgO2m2 -
        initialSurface.oxygenKgO2m2 - initialDeep.oxygenKgO2m2 +
        oxygenConsumedKgO2m2)
    },
    truth: {
      persistentDeepReservoirs: true,
      physicalVerticalDissolvedExchange: true,
      sinkingParticleExport: biologicalEnabled,
      oxygenLimitedDeepRemineralization: biologicalEnabled,
      persistentSeafloorBurial: true,
      biologicalPoolsFrozenWhenLifeDisabled: !biologicalEnabled,
      resolvedThreeDimensionalCirculation: false
    }
  };
  state.lastExchangeReceipt = receipt;
  return { state, receipt: clone(receipt) };
}

export function deepOceanDescription() {
  return {
    stateSchema: DEEP_OCEAN_STATE_SCHEMA,
    exchangeReceiptSchema: DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA,
    persistentReservoirs: true,
    processes: [
      'mixed-to-deep-dissolved-exchange',
      'sinking-detrital-carbon-nitrogen-phosphorus-export',
      'oxygen-limited-deep-remineralization',
      'persistent-seafloor-organic-burial'
    ],
    physicalExchangeWhenLifeDisabled: true,
    biologicalExportAndRemineralizationWhenLifeDisabled: false,
    resolvedThreeDimensionalCirculation: false
  };
}
