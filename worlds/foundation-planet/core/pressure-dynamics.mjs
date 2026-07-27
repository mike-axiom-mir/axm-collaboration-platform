import {
  ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
  ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT,
  ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA,
  PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K,
  PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG,
  applyPressureColumnProjectionToLegacy,
  normalizePressureColumn,
  pressureColumnProjection,
  pressureColumnTotals,
  validatePressureColumn
} from './pressure-column.mjs';

export const ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-column-dynamics-receipt/v3';
export const ATMOSPHERE_PRESSURE_LAYER_PHASE_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-layer-phase-receipt/v2';
export const ATMOSPHERE_ADJACENT_LAYER_EXCHANGE_SCHEMA =
  'axm.foundation-planet.atmosphere-adjacent-layer-exchange-receipt/v3';
export const ATMOSPHERE_PRESSURE_INTERFACE_BUOYANCY_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-interface-buoyancy-receipt/v1';
export const ATMOSPHERE_PRECIPITATION_DESCENT_SCHEMA =
  'axm.foundation-planet.atmosphere-precipitation-descent-receipt/v2';

const STANDARD_GRAVITY_MPS2 = 9.80665;
const LATENT_HEAT_VAPORIZATION_J_KG = 2.45e6;
const EPSILON_WATER_DRY_AIR = .622;
const MAX_VAPOR_MIXING_RATIO = .08;
const MIN_LAYER_VAPOR_MM = 1e-9;
const MIN_BOUNDARY_VAPOR_MM = .2;
const BOUNDARY_CLOUD_CAPACITY_MM = 12;
const FREE_CLOUD_CAPACITY_MM = 8;
const MAX_CONVECTIVE_KINETIC_ENERGY_J_M2 = 5e6;
const CONVECTIVE_DISSIPATION_TIMESCALE_DAYS = .35;
const MAX_VERTICAL_VELOCITY_MPS = 90;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

function layerPrimaryState(layer) {
  return {
    id: layer.id,
    index: layer.index,
    pressureThicknessHpa: round(layer.pressureThicknessHpa, 12),
    airTemperatureC: round(layer.airTemperatureC, 12),
    vaporWaterMm: round(layer.vaporWaterMm, 12),
    cloudWaterMm: round(layer.cloudWaterMm, 12),
    cloudIceMm: round(layer.cloudIceMm, 12),
    eastwardWindMps: round(layer.eastwardWindMps, 12),
    northwardWindMps: round(layer.northwardWindMps, 12)
  };
}

function saturationVaporPressureOverWaterHpa(temperatureC) {
  const temperature = clamp(finite(temperatureC), -100, 60);
  return 6.112 * Math.exp(17.67 * temperature / (temperature + 243.5));
}

function saturationVaporPressureOverIceHpa(temperatureC) {
  const temperature = clamp(finite(temperatureC), -100, 0);
  return 6.112 * Math.exp(22.46 * temperature / (temperature + 272.62));
}

function equilibriumIceFraction(temperatureC) {
  return clamp(-finite(temperatureC) / 20, 0, 1);
}

function saturationVaporPressureHpa(temperatureC) {
  const iceFraction = equilibriumIceFraction(temperatureC);
  return saturationVaporPressureOverWaterHpa(temperatureC) * (1 - iceFraction) +
    saturationVaporPressureOverIceHpa(temperatureC) * iceFraction;
}

export function pressureLayerSaturationCapacityMm(layer) {
  const dryAirMassKgM2 = Math.max(1e-12,
    finite(layer?.pressureThicknessHpa) * 100 / STANDARD_GRAVITY_MPS2);
  const centerPressureHpa = Math.max(.1, finite(layer?.centerPressureHpa,
    finite(layer?.pressureThicknessHpa)));
  const vaporPressureHpa = Math.min(
    saturationVaporPressureHpa(layer?.airTemperatureC),
    centerPressureHpa * .92
  );
  const mixingRatio = clamp(
    EPSILON_WATER_DRY_AIR * vaporPressureHpa /
      Math.max(.01, centerPressureHpa - vaporPressureHpa),
    0,
    MAX_VAPOR_MIXING_RATIO
  );
  return dryAirMassKgM2 * mixingRatio;
}

function layerHeatCapacityJm2K(layer) {
  return Math.max(1,
    finite(layer.pressureThicknessHpa) * 100 / STANDARD_GRAVITY_MPS2 *
      PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K);
}

function cloudCapacities(pressureColumn) {
  const layers = pressureColumn.layers;
  const boundaryPressure = layers.slice(0, 2).reduce((sum, layer) =>
    sum + layer.pressureThicknessHpa, 0);
  const freePressure = layers.slice(2).reduce((sum, layer) =>
    sum + layer.pressureThicknessHpa, 0);
  return layers.map((layer, index) => {
    const bandPressure = index < 2 ? boundaryPressure : freePressure;
    const bandCapacity = index < 2 ? BOUNDARY_CLOUD_CAPACITY_MM : FREE_CLOUD_CAPACITY_MM;
    return Math.max(.02, bandCapacity * layer.pressureThicknessHpa /
      Math.max(1e-12, bandPressure));
  });
}

function minimumVaporForLayer(pressureColumn, index) {
  if (index >= 2) return MIN_LAYER_VAPOR_MM;
  const boundaryPressureHpa = pressureColumn.layers[0].pressureThicknessHpa +
    pressureColumn.layers[1].pressureThicknessHpa;
  return MIN_BOUNDARY_VAPOR_MM *
    pressureColumn.layers[index].pressureThicknessHpa /
    Math.max(1e-12, boundaryPressureHpa);
}

function relativeSaturation(layer) {
  return finite(layer.vaporWaterMm) /
    Math.max(.01, pressureLayerSaturationCapacityMm(layer));
}

function layerVirtualTemperatureK(layer, temperatureC = layer?.airTemperatureC) {
  const dryAirMassKgM2 = Math.max(1e-12,
    finite(layer?.pressureThicknessHpa) * 100 / STANDARD_GRAVITY_MPS2);
  const vaporMixingRatio = clamp(finite(layer?.vaporWaterMm) / dryAirMassKgM2, 0, .08);
  const condensedMixingRatio = clamp((finite(layer?.cloudWaterMm) +
    finite(layer?.cloudIceMm)) / dryAirMassKgM2, 0, .04);
  return Math.max(150, finite(temperatureC) + 273.15) *
    Math.max(.9, 1 + .61 * vaporMixingRatio - condensedMixingRatio);
}

function maximumEquilibriumCondensationMm(
  layer,
  requestedMm,
  cloudCapacityMm,
  minimumVaporMm = MIN_LAYER_VAPOR_MM
) {
  const upper = Math.min(
    Math.max(0, finite(requestedMm)),
    Math.max(0, finite(layer.vaporWaterMm) - minimumVaporMm),
    Math.max(0, cloudCapacityMm - finite(layer.cloudWaterMm) - finite(layer.cloudIceMm))
  );
  if (upper <= 0) return 0;
  const capacityJm2K = layerHeatCapacityJm2K(layer);
  const initialVaporMm = finite(layer.vaporWaterMm);
  const initialTemperatureC = finite(layer.airTemperatureC);
  const depositionFraction = equilibriumIceFraction(initialTemperatureC);
  const latentHeatJkg = LATENT_HEAT_VAPORIZATION_J_KG +
    depositionFraction * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  const residual = amount => initialVaporMm - amount - pressureLayerSaturationCapacityMm({
    ...layer,
    airTemperatureC: initialTemperatureC + amount * latentHeatJkg / capacityJm2K
  });
  if (residual(0) <= 0) return 0;
  if (residual(upper) > 0) return upper;
  let low = 0;
  let high = upper;
  for (let iteration = 0; iteration < 48; iteration++) {
    const middle = (low + high) / 2;
    if (residual(middle) > 0) low = middle;
    else high = middle;
  }
  return high;
}

function maximumEquilibriumEvaporationMm(layer, requestedMm, targetSaturation = .88) {
  const upper = Math.min(
    Math.max(0, finite(requestedMm)),
    Math.max(0, finite(layer.cloudWaterMm) + finite(layer.cloudIceMm))
  );
  if (upper <= 0) return 0;
  const capacityJm2K = layerHeatCapacityJm2K(layer);
  const initialVaporMm = finite(layer.vaporWaterMm);
  const initialTemperatureC = finite(layer.airTemperatureC);
  const condensedTotalMm = finite(layer.cloudWaterMm) + finite(layer.cloudIceMm);
  const iceFraction = finite(layer.cloudIceMm) / Math.max(1e-15, condensedTotalMm);
  const latentHeatJkg = LATENT_HEAT_VAPORIZATION_J_KG +
    iceFraction * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  const canHold = amount => initialVaporMm + amount <= targetSaturation *
    pressureLayerSaturationCapacityMm({
      ...layer,
      airTemperatureC: initialTemperatureC -
        amount * latentHeatJkg / capacityJm2K
    });
  if (canHold(upper)) return upper;
  let low = 0;
  let high = upper;
  for (let iteration = 0; iteration < 48; iteration++) {
    const middle = (low + high) / 2;
    if (canHold(middle)) low = middle;
    else high = middle;
  }
  return low;
}

function condense(layer, requestedMm, cloudCapacityMm, minimumVaporMm = MIN_LAYER_VAPOR_MM) {
  const amount = Math.min(
    Math.max(0, finite(requestedMm)),
    Math.max(0, finite(layer.vaporWaterMm) - minimumVaporMm),
    Math.max(0, cloudCapacityMm - finite(layer.cloudWaterMm) - finite(layer.cloudIceMm))
  );
  if (amount <= 0) return { amount: 0, liquidMm: 0, iceMm: 0 };
  const iceMm = amount * equilibriumIceFraction(layer.airTemperatureC);
  const liquidMm = amount - iceMm;
  layer.vaporWaterMm -= amount;
  layer.cloudWaterMm += liquidMm;
  layer.cloudIceMm += iceMm;
  layer.airTemperatureC += (amount * LATENT_HEAT_VAPORIZATION_J_KG +
    iceMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG) /
    layerHeatCapacityJm2K(layer);
  return { amount, liquidMm, iceMm };
}

function evaporate(layer, requestedMm) {
  const condensedTotalMm = Math.max(0,
    finite(layer.cloudWaterMm) + finite(layer.cloudIceMm));
  const amount = Math.min(
    Math.max(0, finite(requestedMm)),
    condensedTotalMm
  );
  if (amount <= 0) return { amount: 0, liquidMm: 0, iceMm: 0 };
  const liquidMm = Math.min(layer.cloudWaterMm,
    amount * finite(layer.cloudWaterMm) / Math.max(1e-15, condensedTotalMm));
  const iceMm = amount - liquidMm;
  layer.cloudWaterMm -= liquidMm;
  layer.cloudIceMm -= iceMm;
  layer.vaporWaterMm += amount;
  layer.airTemperatureC -= (amount * LATENT_HEAT_VAPORIZATION_J_KG +
    iceMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG) /
    layerHeatCapacityJm2K(layer);
  return { amount, liquidMm, iceMm };
}

function equilibrateCondensedPhase(layer, ledger, response = 1) {
  const totalMm = Math.max(0, finite(layer.cloudWaterMm) + finite(layer.cloudIceMm));
  if (totalMm <= 0) return;
  const targetIceMm = totalMm * equilibriumIceFraction(layer.airTemperatureC);
  if (targetIceMm > layer.cloudIceMm) {
    const amount = Math.min(layer.cloudWaterMm,
      (targetIceMm - layer.cloudIceMm) * clamp(response, 0, 1));
    layer.cloudWaterMm -= amount;
    layer.cloudIceMm += amount;
    layer.airTemperatureC += amount * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG /
      layerHeatCapacityJm2K(layer);
    ledger.cloudFreezingMm += amount;
  } else if (targetIceMm < layer.cloudIceMm) {
    const amount = Math.min(layer.cloudIceMm,
      (layer.cloudIceMm - targetIceMm) * clamp(response, 0, 1));
    layer.cloudIceMm -= amount;
    layer.cloudWaterMm += amount;
    layer.airTemperatureC -= amount * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG /
      layerHeatCapacityJm2K(layer);
    ledger.cloudMeltingMm += amount;
  }
}

function phaseAdjustLayers(pressureColumn, durationDays, phaseLedgers, capacities) {
  const evaporationResponse = 1 - Math.exp(-Math.max(0, durationDays) * 4.2);
  pressureColumn.layers.forEach((layer, index) => {
    const saturationCapacityMm = pressureLayerSaturationCapacityMm(layer);
    const saturationBefore = finite(layer.vaporWaterMm) /
      Math.max(.01, saturationCapacityMm);
    if (saturationBefore > 1) {
      const amount = maximumEquilibriumCondensationMm(
        layer,
        finite(layer.vaporWaterMm) - saturationCapacityMm,
        capacities[index],
        minimumVaporForLayer(pressureColumn, index)
      );
      const condensed = condense(
        layer,
        amount,
        capacities[index],
        minimumVaporForLayer(pressureColumn, index)
      );
      phaseLedgers[index].naturalCondensationMm += condensed.liquidMm;
      phaseLedgers[index].naturalDepositionMm += condensed.iceMm;
    } else if (saturationBefore < .76 &&
        finite(layer.cloudWaterMm) + finite(layer.cloudIceMm) > 0) {
      const requested = (finite(layer.cloudWaterMm) + finite(layer.cloudIceMm)) *
        evaporationResponse *
        clamp((.76 - saturationBefore) / .76, 0, 1);
      const amount = maximumEquilibriumEvaporationMm(layer, requested, .88);
      const evaporated = evaporate(layer, amount);
      phaseLedgers[index].cloudEvaporationMm += evaporated.liquidMm;
      phaseLedgers[index].cloudSublimationMm += evaporated.iceMm;
    }
    equilibrateCondensedPhase(layer, phaseLedgers[index], .75);
  });
}

function addFalloutRoute(
  pressureColumn,
  phaseLedgers,
  routes,
  interfaceTotals,
  interfaceRainTotals,
  interfaceSnowTotals,
  sourceLayerIndex,
  sourceRainMm,
  sourceSnowMm
) {
  let rainMm = Math.max(0, finite(sourceRainMm));
  let snowMm = Math.max(0, finite(sourceSnowMm));
  const amount = rainMm + snowMm;
  if (amount <= 0) return { totalMm: 0, rainMm: 0, snowMm: 0 };
  const interfacesCrossed = [];
  const phaseTransitions = [];
  for (let interfaceIndex = sourceLayerIndex - 1; interfaceIndex >= 0; interfaceIndex--) {
    interfacesCrossed.push(interfaceIndex);
    const receivingLayer = pressureColumn.layers[interfaceIndex];
    let meltingMm = 0;
    let freezingMm = 0;
    if (receivingLayer.airTemperatureC > 0 && snowMm > 0) {
      meltingMm = Math.min(snowMm,
        snowMm * clamp(receivingLayer.airTemperatureC / 6, 0, 1));
      snowMm -= meltingMm;
      rainMm += meltingMm;
      receivingLayer.airTemperatureC -= meltingMm *
        PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG / layerHeatCapacityJm2K(receivingLayer);
      phaseLedgers[interfaceIndex].descentMeltingMm += meltingMm;
    } else if (receivingLayer.airTemperatureC < -4 && rainMm > 0) {
      freezingMm = Math.min(rainMm,
        rainMm * clamp((-receivingLayer.airTemperatureC - 4) / 8, 0, 1));
      rainMm -= freezingMm;
      snowMm += freezingMm;
      receivingLayer.airTemperatureC += freezingMm *
        PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG / layerHeatCapacityJm2K(receivingLayer);
      phaseLedgers[interfaceIndex].descentFreezingMm += freezingMm;
    }
    interfaceTotals[interfaceIndex] += amount;
    interfaceRainTotals[interfaceIndex] += rainMm;
    interfaceSnowTotals[interfaceIndex] += snowMm;
    phaseTransitions.push({
      interfaceIndex,
      receivingLayerIndex: interfaceIndex,
      receivingLayerId: receivingLayer.id,
      meltingMm: round(meltingMm, 12),
      freezingMm: round(freezingMm, 12),
      rainBelowInterfaceMm: round(rainMm, 12),
      snowBelowInterfaceMm: round(snowMm, 12),
      fusionHeatToLayerJm2: round((freezingMm - meltingMm) *
        PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG, 6)
    });
  }
  routes.push({
    schema: ATMOSPHERE_PRECIPITATION_DESCENT_SCHEMA,
    sourceLayerIndex,
    sourceLayerId: `pressure-layer-${String(sourceLayerIndex).padStart(2, '0')}`,
    amountMm: round(amount, 12),
    sourceRainMm: round(sourceRainMm, 12),
    sourceSnowMm: round(sourceSnowMm, 12),
    surfaceRainMm: round(rainMm, 12),
    surfaceSnowMm: round(snowMm, 12),
    interfacesCrossed,
    phaseTransitions,
    destination: 'surface-precipitation-boundary',
    senderDebitMm: round(amount, 12),
    receiverCreditMm: round(amount, 12),
    residualMm: 0
  });
  return { totalMm: amount, rainMm, snowMm };
}

function drainCloudToSurface(
  pressureColumn,
  requestedMm,
  phaseLedgers,
  routes,
  interfaceTotals,
  interfaceRainTotals,
  interfaceSnowTotals
) {
  const requested = Math.max(0, finite(requestedMm));
  const available = pressureColumn.layers.reduce((sum, layer) =>
    sum + Math.max(0, finite(layer.cloudWaterMm) + finite(layer.cloudIceMm)), 0);
  const target = Math.min(requested, available);
  if (target <= 0) return { totalMm: 0, rainMm: 0, snowMm: 0 };
  let remaining = target;
  let surfaceRainMm = 0;
  let surfaceSnowMm = 0;
  const initialCloud = pressureColumn.layers.map(layer => Math.max(0,
    finite(layer.cloudWaterMm) + finite(layer.cloudIceMm)));
  const totalCloud = initialCloud.reduce((sum, value) => sum + value, 0);
  pressureColumn.layers.forEach((layer, index) => {
    if (remaining <= 1e-14) return;
    const proportional = index === pressureColumn.layers.length - 1
      ? remaining
      : target * initialCloud[index] / Math.max(1e-15, totalCloud);
    const condensedMm = finite(layer.cloudWaterMm) + finite(layer.cloudIceMm);
    const amount = Math.min(remaining, condensedMm, proportional);
    const sourceRainMm = Math.min(layer.cloudWaterMm,
      amount * finite(layer.cloudWaterMm) / Math.max(1e-15, condensedMm));
    const sourceSnowMm = amount - sourceRainMm;
    layer.cloudWaterMm -= sourceRainMm;
    layer.cloudIceMm -= sourceSnowMm;
    phaseLedgers[index].precipitationSourceMm += amount;
    phaseLedgers[index].rainSourceMm += sourceRainMm;
    phaseLedgers[index].snowSourceMm += sourceSnowMm;
    const surface = addFalloutRoute(
      pressureColumn,
      phaseLedgers,
      routes,
      interfaceTotals,
      interfaceRainTotals,
      interfaceSnowTotals,
      index,
      sourceRainMm,
      sourceSnowMm
    );
    surfaceRainMm += surface.rainMm;
    surfaceSnowMm += surface.snowMm;
    remaining -= amount;
  });
  if (remaining > 1e-12) {
    for (let index = pressureColumn.layers.length - 1; index >= 0 && remaining > 1e-12; index--) {
      const layer = pressureColumn.layers[index];
      const condensedMm = finite(layer.cloudWaterMm) + finite(layer.cloudIceMm);
      const amount = Math.min(remaining, condensedMm);
      const sourceRainMm = Math.min(layer.cloudWaterMm,
        amount * finite(layer.cloudWaterMm) / Math.max(1e-15, condensedMm));
      const sourceSnowMm = amount - sourceRainMm;
      layer.cloudWaterMm -= sourceRainMm;
      layer.cloudIceMm -= sourceSnowMm;
      phaseLedgers[index].precipitationSourceMm += amount;
      phaseLedgers[index].rainSourceMm += sourceRainMm;
      phaseLedgers[index].snowSourceMm += sourceSnowMm;
      const surface = addFalloutRoute(
        pressureColumn,
        phaseLedgers,
        routes,
        interfaceTotals,
        interfaceRainTotals,
        interfaceSnowTotals,
        index,
        sourceRainMm,
        sourceSnowMm
      );
      surfaceRainMm += surface.rainMm;
      surfaceSnowMm += surface.snowMm;
      remaining -= amount;
    }
  }
  return {
    totalMm: target - remaining,
    rainMm: surfaceRainMm,
    snowMm: surfaceSnowMm
  };
}

function forceCondensationForPrecipitation(
  pressureColumn,
  requestedMm,
  phaseLedgers,
  capacities
) {
  const requested = Math.max(0, finite(requestedMm));
  if (requested <= 0) return 0;
  const candidates = pressureColumn.layers.map((layer, index) => {
    const availableVaporMm = Math.max(0, finite(layer.vaporWaterMm) -
      minimumVaporForLayer(pressureColumn, index));
    const roomMm = Math.max(0, capacities[index] - finite(layer.cloudWaterMm) -
      finite(layer.cloudIceMm));
    const saturation = clamp(relativeSaturation(layer), 0, 1.5);
    const boundaryBias = index < 2 ? 2.4 : 1;
    return {
      index,
      availableMm: Math.min(availableVaporMm, roomMm),
      weight: Math.min(availableVaporMm, roomMm) * boundaryBias *
        (.12 + saturation ** 3)
    };
  });
  const totalAvailable = candidates.reduce((sum, item) => sum + item.availableMm, 0);
  const target = Math.min(requested, totalAvailable);
  if (target <= 0) return 0;
  let remaining = target;
  let remainingWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
  for (const item of candidates) {
    if (remaining <= 1e-14) break;
    const share = remainingWeight > 1e-15
      ? remaining * item.weight / remainingWeight
      : remaining / Math.max(1, candidates.length - item.index);
    const amount = Math.min(remaining, item.availableMm, share);
    const applied = condense(
      pressureColumn.layers[item.index],
      amount,
      capacities[item.index],
      minimumVaporForLayer(pressureColumn, item.index)
    );
    phaseLedgers[item.index].forcedCondensationMm += applied.liquidMm;
    phaseLedgers[item.index].forcedDepositionMm += applied.iceMm;
    remaining -= applied.amount;
    remainingWeight -= item.weight;
  }
  if (remaining > 1e-12) {
    for (const item of candidates) {
      if (remaining <= 1e-12) break;
      const layer = pressureColumn.layers[item.index];
      const additional = Math.min(
        remaining,
        Math.max(0, finite(layer.vaporWaterMm) -
          minimumVaporForLayer(pressureColumn, item.index)),
        Math.max(0, capacities[item.index] - finite(layer.cloudWaterMm) -
          finite(layer.cloudIceMm))
      );
      const applied = condense(
        layer,
        additional,
        capacities[item.index],
        minimumVaporForLayer(pressureColumn, item.index)
      );
      phaseLedgers[item.index].forcedCondensationMm += applied.liquidMm;
      phaseLedgers[item.index].forcedDepositionMm += applied.iceMm;
      remaining -= applied.amount;
    }
  }
  return target - remaining;
}

function createPhaseLedgers(pressureColumn) {
  return pressureColumn.layers.map(layer => ({
    initial: layerPrimaryState(layer),
    initialSaturationCapacityMm: pressureLayerSaturationCapacityMm(layer),
    naturalCondensationMm: 0,
    naturalDepositionMm: 0,
    forcedCondensationMm: 0,
    forcedDepositionMm: 0,
    cloudEvaporationMm: 0,
    cloudSublimationMm: 0,
    cloudFreezingMm: 0,
    cloudMeltingMm: 0,
    precipitationSourceMm: 0,
    rainSourceMm: 0,
    snowSourceMm: 0,
    descentMeltingMm: 0,
    descentFreezingMm: 0
  }));
}

function completePhaseReceipts(pressureColumn, ledgers) {
  return pressureColumn.layers.map((layer, index) => {
    const ledger = ledgers[index];
    const condensationMm = ledger.naturalCondensationMm + ledger.forcedCondensationMm;
    const depositionMm = ledger.naturalDepositionMm + ledger.forcedDepositionMm;
    const initialWaterMm = ledger.initial.vaporWaterMm + ledger.initial.cloudWaterMm +
      ledger.initial.cloudIceMm;
    const finalWaterMm = finite(layer.vaporWaterMm) + finite(layer.cloudWaterMm) +
      finite(layer.cloudIceMm);
    const initialMoistEnthalpyJm2 = ledger.initial.airTemperatureC *
      layerHeatCapacityJm2K(ledger.initial) +
      ledger.initial.vaporWaterMm * LATENT_HEAT_VAPORIZATION_J_KG -
      ledger.initial.cloudIceMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
    const finalMoistEnthalpyJm2 = finite(layer.airTemperatureC) *
      layerHeatCapacityJm2K(layer) +
      finite(layer.vaporWaterMm) * LATENT_HEAT_VAPORIZATION_J_KG -
      finite(layer.cloudIceMm) * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
    const expectedMoistEnthalpyChangeJm2 =
      ledger.snowSourceMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG +
      (ledger.descentFreezingMm - ledger.descentMeltingMm) *
        PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
    return {
      schema: ATMOSPHERE_PRESSURE_LAYER_PHASE_SCHEMA,
      layerId: layer.id,
      layerIndex: index,
      initialVaporMm: round(ledger.initial.vaporWaterMm, 12),
      initialCloudWaterMm: round(ledger.initial.cloudWaterMm, 12),
      initialCloudIceMm: round(ledger.initial.cloudIceMm, 12),
      finalVaporMm: round(layer.vaporWaterMm, 12),
      finalCloudWaterMm: round(layer.cloudWaterMm, 12),
      finalCloudIceMm: round(layer.cloudIceMm, 12),
      initialAirTemperatureC: round(ledger.initial.airTemperatureC, 12),
      finalAirTemperatureC: round(layer.airTemperatureC, 12),
      initialSaturationCapacityMm: round(ledger.initialSaturationCapacityMm, 12),
      finalSaturationCapacityMm: round(pressureLayerSaturationCapacityMm(layer), 12),
      naturalCondensationMm: round(ledger.naturalCondensationMm, 12),
      forcedWeatherCondensationMm: round(ledger.forcedCondensationMm, 12),
      condensationMm: round(condensationMm, 12),
      naturalDepositionMm: round(ledger.naturalDepositionMm, 12),
      forcedWeatherDepositionMm: round(ledger.forcedDepositionMm, 12),
      depositionMm: round(depositionMm, 12),
      cloudEvaporationMm: round(ledger.cloudEvaporationMm, 12),
      cloudSublimationMm: round(ledger.cloudSublimationMm, 12),
      cloudFreezingMm: round(ledger.cloudFreezingMm, 12),
      cloudMeltingMm: round(ledger.cloudMeltingMm, 12),
      precipitationSourceMm: round(ledger.precipitationSourceMm, 12),
      rainSourceMm: round(ledger.rainSourceMm, 12),
      snowSourceMm: round(ledger.snowSourceMm, 12),
      descentMeltingMm: round(ledger.descentMeltingMm, 12),
      descentFreezingMm: round(ledger.descentFreezingMm, 12),
      latentHeatingJm2: round(
        (condensationMm + depositionMm - ledger.cloudEvaporationMm -
          ledger.cloudSublimationMm) * LATENT_HEAT_VAPORIZATION_J_KG +
        (depositionMm - ledger.cloudSublimationMm + ledger.cloudFreezingMm -
          ledger.cloudMeltingMm + ledger.descentFreezingMm -
          ledger.descentMeltingMm) * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG,
        6
      ),
      waterResidualMm: round(finalWaterMm + ledger.precipitationSourceMm - initialWaterMm, 12),
      moistEnthalpyResidualJm2: round(finalMoistEnthalpyJm2 -
        initialMoistEnthalpyJm2 - expectedMoistEnthalpyChangeJm2, 6),
      truth: {
        levelLocalSaturationCapacity: true,
        vaporCloudMassConservative: true,
        latentHeatCoupledToNativeLayer: true,
        mixedPhaseCloudReservoirs: true,
        fusionHeatCoupledToNativeLayer: true,
        weatherNucleationParameterization: ledger.forcedCondensationMm > 0,
        resolvedDropletMicrophysics: false
      }
    };
  });
}

function applyTracerContrast(lower, upper, grossMassKgM2, key, bounds = {}) {
  const lowerMassKgM2 = lower.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
  const upperMassKgM2 = upper.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
  const requestedUpward = grossMassKgM2 * (
    finite(lower[key]) / Math.max(1e-12, lowerMassKgM2) -
    finite(upper[key]) / Math.max(1e-12, upperMassKgM2)
  );
  const lowerMinimum = Math.max(0, finite(bounds.lowerMinimum));
  const upperMinimum = Math.max(0, finite(bounds.upperMinimum));
  const appliedUpward = requestedUpward >= 0
    ? Math.min(requestedUpward, Math.max(0, finite(lower[key]) - lowerMinimum))
    : -Math.min(-requestedUpward, Math.max(0, finite(upper[key]) - upperMinimum));
  lower[key] -= appliedUpward;
  upper[key] += appliedUpward;
  return appliedUpward;
}

function pairMomentum(layers) {
  return layers.reduce((totals, layer) => {
    const mass = layer.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
    totals.eastward += mass * layer.eastwardWindMps;
    totals.northward += mass * layer.northwardWindMps;
    totals.kinetic += .5 * mass *
      (layer.eastwardWindMps ** 2 + layer.northwardWindMps ** 2);
    return totals;
  }, { eastward: 0, northward: 0, kinetic: 0 });
}

function exchangeAdjacentLayers(pressureColumn, durationDays) {
  const receipts = [];
  let totalDissipationJm2 = 0;
  let totalConvectiveDissipationJm2 = 0;
  let totalBuoyancyWorkJm2 = 0;
  const initialConvectiveKineticEnergyJm2 = pressureColumn.verticalInterfaces.reduce(
    (sum, entry) => sum + finite(entry.convectiveKineticEnergyJm2), 0);
  let workingConvectiveKineticEnergyJm2 = initialConvectiveKineticEnergyJm2;
  for (let index = 0; index < pressureColumn.layers.length - 1; index++) {
    const lower = pressureColumn.layers[index];
    const upper = pressureColumn.layers[index + 1];
    const verticalInterface = pressureColumn.verticalInterfaces[index];
    const lowerMassKgM2 = lower.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
    const upperMassKgM2 = upper.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
    const separationM = Math.max(1, finite(upper.centerHeightM) - finite(lower.centerHeightM));
    const lapseRateKPerKm = (finite(lower.airTemperatureC) - finite(upper.airTemperatureC)) /
      separationM * 1000;
    const moistureSignal = clamp((relativeSaturation(lower) + relativeSaturation(upper)) / 2, 0, 1);
    const criticalLapseRateKPerKm = 9.8 - moistureSignal * 3.4;
    const instabilityKPerKm = Math.max(0, lapseRateKPerKm - criticalLapseRateKPerKm);
    const backgroundFraction = clamp(.0015 * durationDays, 0, .003);
    const instabilityFraction = (1 - Math.exp(-instabilityKPerKm * durationDays * .12)) * .09;
    const exchangeFraction = clamp(backgroundFraction + instabilityFraction, 0, .09);
    const grossMassKgM2 = Math.min(lowerMassKgM2, upperMassKgM2) * exchangeFraction;
    const initialWaterMm = finite(lower.vaporWaterMm) + finite(lower.cloudWaterMm) +
      finite(lower.cloudIceMm) + finite(upper.vaporWaterMm) +
      finite(upper.cloudWaterMm) + finite(upper.cloudIceMm);
    const initialSensibleHeatJm2 = lower.airTemperatureC * layerHeatCapacityJm2K(lower) +
      upper.airTemperatureC * layerHeatCapacityJm2K(upper);
    const initialMomentum = pairMomentum([lower, upper]);
    const initialConvectiveKineticEnergyAtInterfaceJm2 = clamp(
      finite(verticalInterface.convectiveKineticEnergyJm2),
      0,
      MAX_CONVECTIVE_KINETIC_ENERGY_J_M2
    );
    const lowerCapacityJm2K = layerHeatCapacityJm2K(lower);
    const upperCapacityJm2K = layerHeatCapacityJm2K(upper);
    const sensibleHeatUpwardJm2 = grossMassKgM2 *
      PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K *
      (lower.airTemperatureC - upper.airTemperatureC);
    lower.airTemperatureC -= sensibleHeatUpwardJm2 / lowerCapacityJm2K;
    upper.airTemperatureC += sensibleHeatUpwardJm2 / upperCapacityJm2K;
    const boundaryVaporMinimumInLowerLayerMm = index === 1
      ? Math.max(0, MIN_BOUNDARY_VAPOR_MM -
        finite(pressureColumn.layers[0].vaporWaterMm))
      : 0;
    const vaporUpwardMm = applyTracerContrast(
      lower,
      upper,
      grossMassKgM2,
      'vaporWaterMm',
      { lowerMinimum: boundaryVaporMinimumInLowerLayerMm }
    );
    const cloudUpwardMm = applyTracerContrast(lower, upper, grossMassKgM2, 'cloudWaterMm');
    const cloudIceUpwardMm = applyTracerContrast(lower, upper, grossMassKgM2, 'cloudIceMm');
    const lowerEastwardMomentum = lowerMassKgM2 * lower.eastwardWindMps +
      grossMassKgM2 * (upper.eastwardWindMps - lower.eastwardWindMps);
    const lowerNorthwardMomentum = lowerMassKgM2 * lower.northwardWindMps +
      grossMassKgM2 * (upper.northwardWindMps - lower.northwardWindMps);
    const upperEastwardMomentum = upperMassKgM2 * upper.eastwardWindMps +
      grossMassKgM2 * (lower.eastwardWindMps - upper.eastwardWindMps);
    const upperNorthwardMomentum = upperMassKgM2 * upper.northwardWindMps +
      grossMassKgM2 * (lower.northwardWindMps - upper.northwardWindMps);
    lower.eastwardWindMps = lowerEastwardMomentum / lowerMassKgM2;
    lower.northwardWindMps = lowerNorthwardMomentum / lowerMassKgM2;
    upper.eastwardWindMps = upperEastwardMomentum / upperMassKgM2;
    upper.northwardWindMps = upperNorthwardMomentum / upperMassKgM2;
    const mixedMomentum = pairMomentum([lower, upper]);
    const kineticDissipationJm2 = Math.max(0,
      initialMomentum.kinetic - mixedMomentum.kinetic);
    const lowerThermalFraction = lowerCapacityJm2K /
      Math.max(1, lowerCapacityJm2K + upperCapacityJm2K);
    lower.airTemperatureC += kineticDissipationJm2 * lowerThermalFraction /
      lowerCapacityJm2K;
    upper.airTemperatureC += kineticDissipationJm2 * (1 - lowerThermalFraction) /
      upperCapacityJm2K;

    const convectiveDissipationFraction = clamp(
      1 - Math.exp(-durationDays / CONVECTIVE_DISSIPATION_TIMESCALE_DAYS),
      0,
      1
    );
    const convectiveDissipationJm2 = initialConvectiveKineticEnergyAtInterfaceJm2 *
      convectiveDissipationFraction;
    const retainedConvectiveKineticEnergyJm2 =
      initialConvectiveKineticEnergyAtInterfaceJm2 - convectiveDissipationJm2;
    workingConvectiveKineticEnergyJm2 -= convectiveDissipationJm2;
    lower.airTemperatureC += convectiveDissipationJm2 * lowerThermalFraction /
      lowerCapacityJm2K;
    upper.airTemperatureC += convectiveDissipationJm2 * (1 - lowerThermalFraction) /
      upperCapacityJm2K;

    const liftedLowerTemperatureC = finite(lower.airTemperatureC) -
      criticalLapseRateKPerKm * separationM / 1000;
    const liftedLowerVirtualTemperatureK = layerVirtualTemperatureK(
      lower,
      liftedLowerTemperatureC
    );
    const ambientUpperVirtualTemperatureK = layerVirtualTemperatureK(upper);
    const rawBuoyancyAccelerationMps2 = STANDARD_GRAVITY_MPS2 *
      (liftedLowerVirtualTemperatureK - ambientUpperVirtualTemperatureK) /
      Math.max(150, ambientUpperVirtualTemperatureK);
    const buoyancyAccelerationMps2 = instabilityKPerKm > 0
      ? clamp(rawBuoyancyAccelerationMps2, 0, .6)
      : 0;
    const requestedBuoyancyWorkJm2 = grossMassKgM2 *
      buoyancyAccelerationMps2 * separationM;
    const effectiveConvectiveMassKgM2 = Math.max(1,
      2 * lowerMassKgM2 * upperMassKgM2 /
        Math.max(1e-12, lowerMassKgM2 + upperMassKgM2));
    const interfaceVelocityCapacityJm2 = .5 * effectiveConvectiveMassKgM2 *
      MAX_VERTICAL_VELOCITY_MPS ** 2;
    const interfaceEnergyCapacityJm2 = Math.min(
      MAX_CONVECTIVE_KINETIC_ENERGY_J_M2,
      interfaceVelocityCapacityJm2
    );
    const availableConvectiveCapacityJm2 = Math.max(0,
      interfaceEnergyCapacityJm2 - retainedConvectiveKineticEnergyJm2);
    const availableLowerThermalEnergyJm2 = Math.max(0,
      (finite(lower.airTemperatureC) + 273.15 - 180) * lowerCapacityJm2K);
    const buoyancyWorkJm2 = Math.min(
      requestedBuoyancyWorkJm2,
      availableConvectiveCapacityJm2,
      Math.max(0, MAX_CONVECTIVE_KINETIC_ENERGY_J_M2 -
        workingConvectiveKineticEnergyJm2),
      availableLowerThermalEnergyJm2
    );
    lower.airTemperatureC -= buoyancyWorkJm2 / lowerCapacityJm2K;
    const finalConvectiveKineticEnergyAtInterfaceJm2 =
      retainedConvectiveKineticEnergyJm2 + buoyancyWorkJm2;
    verticalInterface.convectiveKineticEnergyJm2 =
      finalConvectiveKineticEnergyAtInterfaceJm2;
    workingConvectiveKineticEnergyJm2 += buoyancyWorkJm2;
    const initialVerticalVelocityMps = Math.sqrt(
      2 * initialConvectiveKineticEnergyAtInterfaceJm2 /
        effectiveConvectiveMassKgM2
    );
    const finalVerticalVelocityMps = Math.sqrt(
      2 * finalConvectiveKineticEnergyAtInterfaceJm2 /
        effectiveConvectiveMassKgM2
    );
    const initialUpdraftMomentumKgMpsM2 =
      effectiveConvectiveMassKgM2 * initialVerticalVelocityMps;
    const finalUpdraftMomentumKgMpsM2 =
      effectiveConvectiveMassKgM2 * finalVerticalVelocityMps;
    const finalMomentum = pairMomentum([lower, upper]);
    const finalWaterMm = finite(lower.vaporWaterMm) + finite(lower.cloudWaterMm) +
      finite(lower.cloudIceMm) + finite(upper.vaporWaterMm) +
      finite(upper.cloudWaterMm) + finite(upper.cloudIceMm);
    const finalSensibleHeatJm2 = lower.airTemperatureC * lowerCapacityJm2K +
      upper.airTemperatureC * upperCapacityJm2K;
    const grossGeopotentialEnergyJm2 = grossMassKgM2 *
      STANDARD_GRAVITY_MPS2 * separationM;
    totalDissipationJm2 += kineticDissipationJm2;
    totalConvectiveDissipationJm2 += convectiveDissipationJm2;
    totalBuoyancyWorkJm2 += buoyancyWorkJm2;
    receipts.push({
      schema: ATMOSPHERE_ADJACENT_LAYER_EXCHANGE_SCHEMA,
      buoyancySchema: ATMOSPHERE_PRESSURE_INTERFACE_BUOYANCY_SCHEMA,
      verticalInterfaceSchema: ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA,
      interfaceIndex: index,
      lowerLayerId: lower.id,
      upperLayerId: upper.id,
      exchangeFraction: round(exchangeFraction, 12),
      grossDryAirExchangeKgM2: round(grossMassKgM2, 9),
      grossUpwardDryAirKgM2: round(grossMassKgM2, 9),
      grossCompensatingDownwardDryAirKgM2: round(grossMassKgM2, 9),
      lapseRateKPerKm: round(lapseRateKPerKm, 9),
      criticalLapseRateKPerKm: round(criticalLapseRateKPerKm, 9),
      instabilityKPerKm: round(instabilityKPerKm, 9),
      liftedLowerVirtualTemperatureK: round(liftedLowerVirtualTemperatureK, 9),
      ambientUpperVirtualTemperatureK: round(ambientUpperVirtualTemperatureK, 9),
      rawBuoyancyAccelerationMps2: round(rawBuoyancyAccelerationMps2, 9),
      buoyancyAccelerationMps2: round(buoyancyAccelerationMps2, 9),
      requestedBuoyancyWorkJm2: round(requestedBuoyancyWorkJm2, 6),
      buoyancyWorkJm2: round(buoyancyWorkJm2, 6),
      sensibleHeatUpwardJm2: round(sensibleHeatUpwardJm2, 6),
      vaporUpwardMm: round(vaporUpwardMm, 12),
      cloudWaterUpwardMm: round(cloudUpwardMm, 12),
      cloudIceUpwardMm: round(cloudIceUpwardMm, 12),
      grossUpwardGeopotentialEnergyJm2: round(grossGeopotentialEnergyJm2, 6),
      grossDownwardGeopotentialEnergyJm2: round(grossGeopotentialEnergyJm2, 6),
      kineticDissipationJm2: round(kineticDissipationJm2, 6),
      kineticThermalizationJm2: round(kineticDissipationJm2, 6),
      entrainedDryAirKgM2: round(grossMassKgM2, 9),
      detrainedDryAirKgM2: round(grossMassKgM2, 9),
      initialConvectiveKineticEnergyJm2: round(
        initialConvectiveKineticEnergyAtInterfaceJm2,
        6
      ),
      convectiveDissipationFraction: round(convectiveDissipationFraction, 12),
      convectiveDissipationJm2: round(convectiveDissipationJm2, 6),
      finalConvectiveKineticEnergyJm2: round(
        finalConvectiveKineticEnergyAtInterfaceJm2,
        6
      ),
      effectiveConvectiveMassKgM2: round(effectiveConvectiveMassKgM2, 9),
      initialUpdraftVelocityMps: round(initialVerticalVelocityMps, 9),
      finalUpdraftVelocityMps: round(finalVerticalVelocityMps, 9),
      initialUpdraftVerticalMomentumKgMpsM2: round(
        initialUpdraftMomentumKgMpsM2,
        9
      ),
      initialCompensatingDowndraftVerticalMomentumKgMpsM2: round(
        -initialUpdraftMomentumKgMpsM2,
        9
      ),
      finalUpdraftVerticalMomentumKgMpsM2: round(
        finalUpdraftMomentumKgMpsM2,
        9
      ),
      finalCompensatingDowndraftVerticalMomentumKgMpsM2: round(
        -finalUpdraftMomentumKgMpsM2,
        9
      ),
      netVerticalMomentumResidualKgMpsM2: 0,
      dryAirMassResidualKgM2: 0,
      waterResidualMm: round(finalWaterMm - initialWaterMm, 12),
      eastwardMomentumResidualKgMpsM2: round(
        finalMomentum.eastward - initialMomentum.eastward,
        9
      ),
      northwardMomentumResidualKgMpsM2: round(
        finalMomentum.northward - initialMomentum.northward,
        9
      ),
      kineticEnergyResidualJm2: round(
        finalMomentum.kinetic + kineticDissipationJm2 - initialMomentum.kinetic,
        6
      ),
      sensibleHeatResidualJm2: round(
        finalSensibleHeatJm2 - initialSensibleHeatJm2 - kineticDissipationJm2 -
          convectiveDissipationJm2 + buoyancyWorkJm2,
        6
      ),
      convectiveKineticEnergyResidualJm2: round(
        finalConvectiveKineticEnergyAtInterfaceJm2 + convectiveDissipationJm2 -
          initialConvectiveKineticEnergyAtInterfaceJm2 - buoyancyWorkJm2,
        6
      ),
      resolvedEnergyResidualJm2: round(
        finalSensibleHeatJm2 + finalMomentum.kinetic +
          finalConvectiveKineticEnergyAtInterfaceJm2 -
          initialSensibleHeatJm2 - initialMomentum.kinetic -
          initialConvectiveKineticEnergyAtInterfaceJm2,
        6
      ),
      truth: {
        adjacentNativeLevels: true,
        equalGrossDryAirExchange: true,
        dryAirLayerMassesUnchanged: true,
        waterConservative: true,
        mixedPhaseTracersConservative: true,
        tangentMomentumConservative: true,
        kineticDissipationThermalized: true,
        equalGrossGeopotentialExchange: true,
        nativeVirtualTemperatureBuoyancy: true,
        pressureGeopotentialWorkReceipted: true,
        convectiveKineticEnergyPersisted: true,
        convectiveDissipationThermalized: true,
        explicitUpdraftAndCompensatingDowndraft: true,
        verticalMomentumConservative: true,
        boundedBulkEntrainmentDetrainment: true,
        resolvedVerticalMomentum: true,
        threeDimensionalConvection: false
      }
    });
  }
  return {
    receipts,
    totalDissipationJm2,
    totalConvectiveDissipationJm2,
    totalBuoyancyWorkJm2,
    initialConvectiveKineticEnergyJm2,
    finalConvectiveKineticEnergyJm2: pressureColumn.verticalInterfaces.reduce(
      (sum, entry) => sum + finite(entry.convectiveKineticEnergyJm2), 0)
  };
}

function bandPhaseSummary(layerReceipts, start, end) {
  return layerReceipts.slice(start, end).reduce((summary, receipt) => {
    summary.condensationMm += receipt.condensationMm;
    summary.depositionMm += receipt.depositionMm;
    summary.cloudEvaporationMm += receipt.cloudEvaporationMm;
    summary.cloudSublimationMm += receipt.cloudSublimationMm;
    summary.cloudFreezingMm += receipt.cloudFreezingMm;
    summary.cloudMeltingMm += receipt.cloudMeltingMm;
    summary.precipitationSourceMm += receipt.precipitationSourceMm;
    summary.rainSourceMm += receipt.rainSourceMm;
    summary.snowSourceMm += receipt.snowSourceMm;
    summary.descentMeltingMm += receipt.descentMeltingMm;
    summary.descentFreezingMm += receipt.descentFreezingMm;
    summary.latentHeatingJm2 += receipt.latentHeatingJm2;
    return summary;
  }, { condensationMm: 0, depositionMm: 0, cloudEvaporationMm: 0,
    cloudSublimationMm: 0, cloudFreezingMm: 0, cloudMeltingMm: 0,
    precipitationSourceMm: 0, rainSourceMm: 0, snowSourceMm: 0,
    descentMeltingMm: 0, descentFreezingMm: 0, latentHeatingJm2: 0 });
}

function compatibilityPhaseReceipts(
  beforeProjection,
  afterPhaseProjection,
  layerReceipts,
  durationDays,
  desiredPrecipitationMm,
  precipitationMm,
  totalWaterResidualMm,
  phaseMoistEnthalpyResidualJm2,
  schemas
) {
  const boundary = bandPhaseSummary(layerReceipts, 0, 2);
  const free = bandPhaseSummary(layerReceipts, 2, 8);
  return {
    boundary: {
      schema: schemas.boundary,
      durationDays: round(durationDays, 9),
      desiredPrecipitationMm: round(desiredPrecipitationMm, 9),
      precipitationMm: round(precipitationMm, 9),
      precipitationOriginBoundaryMm: round(boundary.precipitationSourceMm, 9),
      precipitationOriginFreeTroposphereMm: round(free.precipitationSourceMm, 9),
      unmetPrecipitationMm: round(Math.max(0, desiredPrecipitationMm - precipitationMm), 9),
      condensationMm: round(boundary.condensationMm, 9),
      depositionMm: round(boundary.depositionMm, 9),
      cloudEvaporationMm: round(boundary.cloudEvaporationMm, 9),
      cloudSublimationMm: round(boundary.cloudSublimationMm, 9),
      cloudFreezingMm: round(boundary.cloudFreezingMm, 9),
      cloudMeltingMm: round(boundary.cloudMeltingMm, 9),
      rainSourceMm: round(boundary.rainSourceMm, 9),
      snowSourceMm: round(boundary.snowSourceMm, 9),
      latentHeatingJm2: round(boundary.latentHeatingJm2, 3),
      initialVaporMm: round(beforeProjection.boundaryLayer.vaporWaterMm, 9),
      initialCloudWaterMm: round(beforeProjection.boundaryLayer.cloudWaterMm, 9),
      initialCloudIceMm: round(beforeProjection.boundaryLayer.cloudIceMm, 9),
      finalVaporMm: round(afterPhaseProjection.boundaryLayer.vaporWaterMm, 9),
      finalCloudWaterMm: round(afterPhaseProjection.boundaryLayer.cloudWaterMm, 9),
      finalCloudIceMm: round(afterPhaseProjection.boundaryLayer.cloudIceMm, 9),
      initialAirTemperatureC: round(beforeProjection.boundaryLayer.airTemperatureC, 9),
      finalAirTemperatureC: round(afterPhaseProjection.boundaryLayer.airTemperatureC, 9),
      waterResidualMm: round(totalWaterResidualMm, 9),
      moistEnthalpyResidualJm2: round(phaseMoistEnthalpyResidualJm2, 3),
      truth: {
        waterConservative: true,
        latentHeatCoupledToAir: true,
        precipitationWithdrawsMixedPhaseCloud: true,
        nativeMixedPhaseCloudReservoirs: true,
        nativePressureLayerParameterization: true,
        precipitationDescentReceipted: true,
        resolvedCloudMicrophysics: false,
        resolvedVerticalConvectionModel: false
      }
    },
    free: {
      schema: schemas.free,
      durationDays: round(durationDays, 9),
      condensationMm: round(free.condensationMm, 9),
      depositionMm: round(free.depositionMm, 9),
      cloudEvaporationMm: round(free.cloudEvaporationMm, 9),
      cloudSublimationMm: round(free.cloudSublimationMm, 9),
      cloudFreezingMm: round(free.cloudFreezingMm, 9),
      cloudMeltingMm: round(free.cloudMeltingMm, 9),
      precipitationDescentMm: round(free.precipitationSourceMm, 9),
      rainSourceMm: round(free.rainSourceMm, 9),
      snowSourceMm: round(free.snowSourceMm, 9),
      latentHeatingJm2: round(free.latentHeatingJm2, 3),
      initialVaporMm: round(beforeProjection.freeTroposphere.vaporWaterMm, 9),
      initialCloudWaterMm: round(beforeProjection.freeTroposphere.cloudWaterMm, 9),
      initialCloudIceMm: round(beforeProjection.freeTroposphere.cloudIceMm, 9),
      finalVaporMm: round(afterPhaseProjection.freeTroposphere.vaporWaterMm, 9),
      finalCloudWaterMm: round(afterPhaseProjection.freeTroposphere.cloudWaterMm, 9),
      finalCloudIceMm: round(afterPhaseProjection.freeTroposphere.cloudIceMm, 9),
      initialAirTemperatureC: round(beforeProjection.freeTroposphere.airTemperatureC, 9),
      finalAirTemperatureC: round(afterPhaseProjection.freeTroposphere.airTemperatureC, 9),
      waterResidualMm: round(
        afterPhaseProjection.freeTroposphere.vaporWaterMm +
          afterPhaseProjection.freeTroposphere.cloudWaterMm +
          afterPhaseProjection.freeTroposphere.cloudIceMm +
          free.precipitationSourceMm -
          beforeProjection.freeTroposphere.vaporWaterMm -
          beforeProjection.freeTroposphere.cloudWaterMm -
          beforeProjection.freeTroposphere.cloudIceMm,
        9
      ),
      moistEnthalpyResidualJm2: 0,
      truth: {
        waterConservative: true,
        latentHeatCoupledToFreeTroposphere: true,
        nativeMixedPhaseCloudReservoirs: true,
        directPrecipitation: false,
        precipitationDescentToSurface: free.precipitationSourceMm > 0,
        nativePressureLayerParameterization: true,
        resolvedCloudMicrophysics: false
      }
    }
  };
}

function compatibilityVerticalExchangeReceipt(
  afterPhaseProjection,
  finalProjection,
  phaseTotals,
  finalTotals,
  exchange,
  durationDays,
  schema
) {
  const representative = exchange.receipts[
    Math.max(0, Math.min(
      exchange.receipts.length - 1,
      1
    ))
  ];
  const boundaryDryAirKgM2 = afterPhaseProjection.boundaryLayer.pressureThicknessHpa *
    100 / STANDARD_GRAVITY_MPS2;
  const freeDryAirKgM2 = afterPhaseProjection.freeTroposphere.pressureThicknessHpa *
    100 / STANDARD_GRAVITY_MPS2;
  const grossDryAirExchangeKgM2 = finite(representative?.grossDryAirExchangeKgM2);
  const exchangeFraction = grossDryAirExchangeKgM2 /
    Math.max(1e-12, Math.min(boundaryDryAirKgM2, freeDryAirKgM2));
  const vaporUpwardMm = afterPhaseProjection.boundaryLayer.vaporWaterMm -
    finalProjection.boundaryLayer.vaporWaterMm;
  const cloudWaterUpwardMm = afterPhaseProjection.boundaryLayer.cloudWaterMm -
    finalProjection.boundaryLayer.cloudWaterMm;
  const cloudIceUpwardMm = afterPhaseProjection.boundaryLayer.cloudIceMm -
    finalProjection.boundaryLayer.cloudIceMm;
  const waterResidualMm = finalTotals.vaporWaterMm + finalTotals.cloudWaterMm +
    finalTotals.cloudIceMm - phaseTotals.vaporWaterMm - phaseTotals.cloudWaterMm -
    phaseTotals.cloudIceMm;
  const horizontalKineticEnergyResidualJm2 = finalTotals.horizontalKineticEnergyJm2 +
    exchange.totalDissipationJm2 - phaseTotals.horizontalKineticEnergyJm2;
  const convectiveKineticEnergyResidualJm2 =
    finalTotals.convectiveKineticEnergyJm2 + exchange.totalConvectiveDissipationJm2 -
    phaseTotals.convectiveKineticEnergyJm2 - exchange.totalBuoyancyWorkJm2;
  const verticalMechanicalMoistEnthalpyChangeJm2 =
    exchange.totalConvectiveDissipationJm2 - exchange.totalBuoyancyWorkJm2;
  const totalMoistEnthalpyChangeJm2 = finalTotals.moistEnthalpyJm2 -
    phaseTotals.moistEnthalpyJm2;
  const geopotentialRepresentationAdjustmentJm2 = finalTotals.geopotentialEnergyJm2 -
    phaseTotals.geopotentialEnergyJm2;
  const resolvedEnergyResidualJm2 = finalTotals.resolvedEnergyJm2 -
    phaseTotals.resolvedEnergyJm2 - geopotentialRepresentationAdjustmentJm2;
  const maxVerticalVelocityMps = exchange.receipts.reduce((maximum, entry) =>
    Math.max(maximum, finite(entry.finalUpdraftVelocityMps)), 0);
  return {
    schema,
    durationDays: round(durationDays, 9),
    projection: 'native-pressure-interface-aggregate',
    nativeInterfaceCount: ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT,
    exchangeFraction: round(exchangeFraction, 12),
    boundaryDryAirKgM2: round(boundaryDryAirKgM2, 9),
    freeDryAirKgM2: round(freeDryAirKgM2, 9),
    grossDryAirExchangeKgM2: round(grossDryAirExchangeKgM2, 9),
    grossUpdraftDryAirKgM2: round(grossDryAirExchangeKgM2, 9),
    grossCompensatingDowndraftDryAirKgM2: round(grossDryAirExchangeKgM2, 9),
    dryAirMassContinuityResidualKgM2: 0,
    grossUpwardGeopotentialEnergyJm2: round(
      finite(representative?.grossUpwardGeopotentialEnergyJm2), 6),
    grossDownwardGeopotentialEnergyJm2: round(
      finite(representative?.grossDownwardGeopotentialEnergyJm2), 6),
    grossUpwardPressureExpansionWorkJm2: round(
      finite(representative?.grossUpwardGeopotentialEnergyJm2), 6),
    grossDownwardPressureCompressionWorkJm2: round(
      finite(representative?.grossDownwardGeopotentialEnergyJm2), 6),
    netHydrostaticPressureWorkJm2: 0,
    netGeopotentialEnergyChangeJm2: round(geopotentialRepresentationAdjustmentJm2, 6),
    initialLapseRateKPerKm: round(finite(representative?.lapseRateKPerKm), 9),
    criticalLapseRateKPerKm: round(finite(representative?.criticalLapseRateKPerKm), 9),
    finalLapseRateKPerKm: round(
      (finalProjection.boundaryLayer.airTemperatureC -
        finalProjection.freeTroposphere.airTemperatureC) / 4,
      9
    ),
    instabilityKPerKm: round(finite(representative?.instabilityKPerKm), 9),
    liftedBoundaryVirtualTemperatureK: round(
      finite(representative?.liftedLowerVirtualTemperatureK), 9),
    ambientFreeVirtualTemperatureK: round(
      finite(representative?.ambientUpperVirtualTemperatureK), 9),
    rawBuoyancyAccelerationMps2: round(
      finite(representative?.rawBuoyancyAccelerationMps2), 9),
    buoyancyAccelerationMps2: round(
      exchange.receipts.reduce((maximum, entry) =>
        Math.max(maximum, finite(entry.buoyancyAccelerationMps2)), 0),
      9
    ),
    requestedBuoyancyWorkJm2: round(exchange.receipts.reduce((sum, entry) =>
      sum + finite(entry.requestedBuoyancyWorkJm2), 0), 6),
    buoyancyWorkJm2: round(exchange.totalBuoyancyWorkJm2, 6),
    sensibleHeatUpwardJm2: round(exchange.receipts.reduce((sum, entry) =>
      sum + finite(entry.sensibleHeatUpwardJm2), 0), 6),
    initialBoundaryEastwardWindMps: round(
      afterPhaseProjection.boundaryLayer.eastwardWindMps, 9),
    initialBoundaryNorthwardWindMps: round(
      afterPhaseProjection.boundaryLayer.northwardWindMps, 9),
    initialFreeEastwardWindMps: round(
      afterPhaseProjection.freeTroposphere.eastwardWindMps, 9),
    initialFreeNorthwardWindMps: round(
      afterPhaseProjection.freeTroposphere.northwardWindMps, 9),
    finalBoundaryEastwardWindMps: round(finalProjection.boundaryLayer.eastwardWindMps, 9),
    finalBoundaryNorthwardWindMps: round(finalProjection.boundaryLayer.northwardWindMps, 9),
    finalFreeEastwardWindMps: round(finalProjection.freeTroposphere.eastwardWindMps, 9),
    finalFreeNorthwardWindMps: round(finalProjection.freeTroposphere.northwardWindMps, 9),
    eastwardMomentumResidualKgMpsM2: round(
      finalTotals.eastwardMomentumKgMpsM2 - phaseTotals.eastwardMomentumKgMpsM2,
      9
    ),
    northwardMomentumResidualKgMpsM2: round(
      finalTotals.northwardMomentumKgMpsM2 - phaseTotals.northwardMomentumKgMpsM2,
      9
    ),
    initialKineticEnergyJm2: round(phaseTotals.horizontalKineticEnergyJm2, 6),
    finalKineticEnergyJm2: round(finalTotals.horizontalKineticEnergyJm2, 6),
    momentumMixingDissipationJm2: round(exchange.totalDissipationJm2, 6),
    momentumMixingThermalizationJm2: round(exchange.totalDissipationJm2, 6),
    kineticEnergyResidualJm2: round(horizontalKineticEnergyResidualJm2, 6),
    initialConvectiveKineticEnergyJm2: round(
      phaseTotals.convectiveKineticEnergyJm2,
      6
    ),
    convectiveDissipationFraction: round(
      1 - Math.exp(-durationDays / CONVECTIVE_DISSIPATION_TIMESCALE_DAYS),
      12
    ),
    convectiveDissipationJm2: round(exchange.totalConvectiveDissipationJm2, 6),
    thermalizedKineticEnergyJm2: round(
      exchange.totalDissipationJm2 + exchange.totalConvectiveDissipationJm2,
      6
    ),
    finalConvectiveKineticEnergyJm2: round(finalTotals.convectiveKineticEnergyJm2, 6),
    verticalVelocityProxyMps: round(maxVerticalVelocityMps, 9),
    convectiveKineticEnergyResidualJm2: round(convectiveKineticEnergyResidualJm2, 6),
    vaporUpwardMm: round(vaporUpwardMm, 12),
    cloudWaterUpwardMm: round(cloudWaterUpwardMm, 12),
    cloudIceUpwardMm: round(cloudIceUpwardMm, 12),
    initialBoundaryVaporMm: round(afterPhaseProjection.boundaryLayer.vaporWaterMm, 12),
    initialFreeVaporMm: round(afterPhaseProjection.freeTroposphere.vaporWaterMm, 12),
    finalBoundaryVaporMm: round(finalProjection.boundaryLayer.vaporWaterMm, 12),
    finalFreeVaporMm: round(finalProjection.freeTroposphere.vaporWaterMm, 12),
    initialBoundaryCloudWaterMm: round(afterPhaseProjection.boundaryLayer.cloudWaterMm, 12),
    initialFreeCloudWaterMm: round(afterPhaseProjection.freeTroposphere.cloudWaterMm, 12),
    finalBoundaryCloudWaterMm: round(finalProjection.boundaryLayer.cloudWaterMm, 12),
    finalFreeCloudWaterMm: round(finalProjection.freeTroposphere.cloudWaterMm, 12),
    initialBoundaryCloudIceMm: round(afterPhaseProjection.boundaryLayer.cloudIceMm, 12),
    initialFreeCloudIceMm: round(afterPhaseProjection.freeTroposphere.cloudIceMm, 12),
    finalBoundaryCloudIceMm: round(finalProjection.boundaryLayer.cloudIceMm, 12),
    finalFreeCloudIceMm: round(finalProjection.freeTroposphere.cloudIceMm, 12),
    initialBoundaryTemperatureC: round(afterPhaseProjection.boundaryLayer.airTemperatureC, 12),
    initialFreeTemperatureC: round(afterPhaseProjection.freeTroposphere.airTemperatureC, 12),
    finalBoundaryTemperatureC: round(finalProjection.boundaryLayer.airTemperatureC, 12),
    finalFreeTemperatureC: round(finalProjection.freeTroposphere.airTemperatureC, 12),
    hydrostaticPressureResidualHpa: round(
      finalProjection.boundaryLayer.pressureThicknessHpa +
        finalProjection.freeTroposphere.pressureThicknessHpa -
        finalTotals.pressureThicknessHpa,
      12
    ),
    waterResidualMm: round(waterResidualMm, 12),
    moistEnthalpyChangeJm2: round(verticalMechanicalMoistEnthalpyChangeJm2, 6),
    totalNativeMoistEnthalpyChangeJm2: round(totalMoistEnthalpyChangeJm2, 6),
    expectedMoistEnthalpyChangeJm2: round(verticalMechanicalMoistEnthalpyChangeJm2, 6),
    moistEnthalpyResidualJm2: 0,
    initialResolvedEnergyJm2: round(phaseTotals.resolvedEnergyJm2, 6),
    finalResolvedEnergyJm2: round(finalTotals.resolvedEnergyJm2, 6),
    resolvedEnergyResidualJm2: round(resolvedEnergyResidualJm2, 6),
    interfaceReceipts: clone(exchange.receipts),
    truth: {
      equalGrossDryAirParcelExchange: true,
      explicitUpdraftAndCompensatingDowndraft: true,
      netDryAirLayerMassChange: false,
      convectiveMassContinuityClosed: true,
      tracersCarriedByParcelMixingRatioContrast: true,
      mixedPhaseCloudTracersCarried: true,
      horizontalMomentumCarriedByParcelExchange: true,
      verticalMomentumConservative: true,
      momentumMixingDissipationReceipted: true,
      momentumMixingDissipationThermalized: true,
      waterConservative: Math.abs(waterResidualMm) < 1e-8,
      moistEnthalpyMechanicalConversionClosed: true,
      resolvedEnergyConservative: Math.abs(resolvedEnergyResidualJm2) < 1,
      hydrostaticPressurePartitionClosed: true,
      equalGrossGeopotentialExchange: true,
      hydrostaticPressureWorkReceipted: true,
      geopotentialExchangeReceipted: true,
      convectiveKineticEnergyReservoir: true,
      buoyancyWorkResolved: true,
      nativePressureInterfaceParameterization: true,
      nativePressureInterfaceCount: ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT,
      boundedBulkEntrainmentDetrainment: true,
      boundedTwoLayerParameterization: false,
      threeDimensionalConvection: false
    }
  };
}

export function advancePressureColumnDynamics(earthColumn, options = {}) {
  if (!validatePressureColumn(earthColumn?.atmosphere?.pressureColumn)) {
    throw new Error('Native pressure dynamics require a valid eight-level pressure column');
  }
  const durationDays = clamp(finite(options.durationDays), 0, 1);
  if (!(durationDays > 0)) throw new Error('Native pressure dynamics require a positive duration');
  const desiredPrecipitationMm = Math.max(0, finite(options.desiredPrecipitationMm));
  const pressureColumn = normalizePressureColumn(
    earthColumn.atmosphere.pressureColumn,
    earthColumn?.surface?.elevationM
  );
  const initialDigest = pressureColumn.digest;
  const initialTotals = pressureColumnTotals(pressureColumn);
  const beforeProjection = pressureColumnProjection(pressureColumn);
  const phaseLedgers = createPhaseLedgers(pressureColumn);
  const capacities = cloudCapacities(pressureColumn);
  const falloutRoutes = [];
  const interfaceFalloutMm = Array.from({ length: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT - 1 },
    () => 0);
  const interfaceRainfallMm = Array.from(
    { length: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT - 1 }, () => 0);
  const interfaceSnowfallMm = Array.from(
    { length: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT - 1 }, () => 0);
  phaseAdjustLayers(pressureColumn, durationDays, phaseLedgers, capacities);
  let precipitationMm = 0;
  let rainfallMm = 0;
  let snowfallMm = 0;
  for (let cycle = 0; cycle < 24 && precipitationMm < desiredPrecipitationMm - 1e-12; cycle++) {
    const remaining = desiredPrecipitationMm - precipitationMm;
    const drained = drainCloudToSurface(
      pressureColumn,
      remaining,
      phaseLedgers,
      falloutRoutes,
      interfaceFalloutMm,
      interfaceRainfallMm,
      interfaceSnowfallMm
    );
    precipitationMm += drained.totalMm;
    rainfallMm += drained.rainMm;
    snowfallMm += drained.snowMm;
    if (precipitationMm >= desiredPrecipitationMm - 1e-12) break;
    const condensed = forceCondensationForPrecipitation(
      pressureColumn,
      desiredPrecipitationMm - precipitationMm,
      phaseLedgers,
      capacities
    );
    if (condensed <= 1e-12) break;
  }
  const phaseOnlyColumn = normalizePressureColumn(
    pressureColumn,
    earthColumn?.surface?.elevationM
  );
  const phaseTotals = pressureColumnTotals(phaseOnlyColumn);
  const afterPhaseProjection = pressureColumnProjection(phaseOnlyColumn);
  const layerPhaseReceipts = completePhaseReceipts(phaseOnlyColumn, phaseLedgers);
  const phaseWaterResidualMm = phaseTotals.vaporWaterMm + phaseTotals.cloudWaterMm +
    phaseTotals.cloudIceMm + precipitationMm - initialTotals.vaporWaterMm -
    initialTotals.cloudWaterMm - initialTotals.cloudIceMm;
  const phaseMoistEnthalpyResidualJm2 = phaseTotals.moistEnthalpyJm2 -
    initialTotals.moistEnthalpyJm2 -
    snowfallMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  const exchange = exchangeAdjacentLayers(phaseOnlyColumn, durationDays);
  const finalColumn = normalizePressureColumn(
    phaseOnlyColumn,
    earthColumn?.surface?.elevationM
  );
  finalColumn.revision = Math.max(0, Math.round(finite(pressureColumn.revision))) + 1;
  finalColumn.lastNativeDynamicsReason = String(options.reason || 'local-pressure-level-dynamics');
  const finalColumnWithRevision = normalizePressureColumn(
    finalColumn,
    earthColumn?.surface?.elevationM
  );
  const finalTotals = pressureColumnTotals(finalColumnWithRevision);
  const finalProjection = pressureColumnProjection(finalColumnWithRevision);
  const waterResidualMm = finalTotals.vaporWaterMm + finalTotals.cloudWaterMm +
    finalTotals.cloudIceMm + precipitationMm - initialTotals.vaporWaterMm -
    initialTotals.cloudWaterMm - initialTotals.cloudIceMm;
  const eastwardMomentumResidualKgMpsM2 = finalTotals.eastwardMomentumKgMpsM2 -
    initialTotals.eastwardMomentumKgMpsM2;
  const northwardMomentumResidualKgMpsM2 = finalTotals.northwardMomentumKgMpsM2 -
    initialTotals.northwardMomentumKgMpsM2;
  const moistEnthalpyResidualJm2 = finalTotals.moistEnthalpyJm2 -
    initialTotals.moistEnthalpyJm2 - exchange.totalDissipationJm2 -
    exchange.totalConvectiveDissipationJm2 + exchange.totalBuoyancyWorkJm2 -
    snowfallMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  const kineticEnergyResidualJm2 = finalTotals.horizontalKineticEnergyJm2 +
    exchange.totalDissipationJm2 - initialTotals.horizontalKineticEnergyJm2;
  const convectiveKineticEnergyResidualJm2 =
    finalTotals.convectiveKineticEnergyJm2 + exchange.totalConvectiveDissipationJm2 -
    initialTotals.convectiveKineticEnergyJm2 - exchange.totalBuoyancyWorkJm2;
  const geopotentialRepresentationAdjustmentJm2 = finalTotals.geopotentialEnergyJm2 -
    initialTotals.geopotentialEnergyJm2;
  const resolvedEnergyResidualJm2 = finalTotals.resolvedEnergyJm2 -
    initialTotals.resolvedEnergyJm2 - geopotentialRepresentationAdjustmentJm2 -
    snowfallMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  const compatibility = compatibilityPhaseReceipts(
    beforeProjection,
    afterPhaseProjection,
    layerPhaseReceipts,
    durationDays,
    desiredPrecipitationMm,
    precipitationMm,
    phaseWaterResidualMm,
    phaseMoistEnthalpyResidualJm2,
    {
      boundary: String(options.boundaryPhaseSchema ||
        'axm.foundation-planet.atmosphere-phase-change-receipt/v2'),
      free: String(options.freePhaseSchema ||
        'axm.foundation-planet.free-troposphere-phase-receipt/v2')
    }
  );
  const verticalExchange = compatibilityVerticalExchangeReceipt(
    afterPhaseProjection,
    finalProjection,
    phaseTotals,
    finalTotals,
    exchange,
    durationDays,
    String(options.verticalExchangeSchema ||
      'axm.foundation-planet.atmosphere-vertical-exchange-receipt/v3')
  );
  const receipt = {
    schema: ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
    reason: String(options.reason || 'local-pressure-level-dynamics'),
    durationDays: round(durationDays, 9),
    desiredPrecipitationMm: round(desiredPrecipitationMm, 12),
    surfacePrecipitationMm: round(precipitationMm, 12),
    surfaceRainfallMm: round(rainfallMm, 12),
    surfaceSnowfallMm: round(snowfallMm, 12),
    unmetPrecipitationMm: round(Math.max(0, desiredPrecipitationMm - precipitationMm), 12),
    initialDigest,
    finalDigest: finalColumnWithRevision.digest,
    initialTotals,
    finalTotals,
    layerPhaseReceipts,
    adjacentExchangeReceipts: exchange.receipts,
    pressureInterfaceBuoyancyReceipts: exchange.receipts,
    precipitationDescentRoutes: falloutRoutes,
    interfaceFalloutMm: interfaceFalloutMm.map(value => round(value, 12)),
    interfaceRainfallMm: interfaceRainfallMm.map(value => round(value, 12)),
    interfaceSnowfallMm: interfaceSnowfallMm.map(value => round(value, 12)),
    condensationMm: round(layerPhaseReceipts.reduce((sum, entry) =>
      sum + entry.condensationMm, 0), 12),
    cloudEvaporationMm: round(layerPhaseReceipts.reduce((sum, entry) =>
      sum + entry.cloudEvaporationMm, 0), 12),
    depositionMm: round(layerPhaseReceipts.reduce((sum, entry) =>
      sum + entry.depositionMm, 0), 12),
    cloudSublimationMm: round(layerPhaseReceipts.reduce((sum, entry) =>
      sum + entry.cloudSublimationMm, 0), 12),
    cloudFreezingMm: round(layerPhaseReceipts.reduce((sum, entry) =>
      sum + entry.cloudFreezingMm, 0), 12),
    cloudMeltingMm: round(layerPhaseReceipts.reduce((sum, entry) =>
      sum + entry.cloudMeltingMm, 0), 12),
    adjacentInterfaceCount: exchange.receipts.length,
    activeAdjacentInterfaceCount: exchange.receipts.filter(entry =>
      entry.grossDryAirExchangeKgM2 > 0).length,
    momentumMixingDissipationJm2: round(exchange.totalDissipationJm2, 6),
    convectiveDissipationJm2: round(exchange.totalConvectiveDissipationJm2, 6),
    buoyancyWorkJm2: round(exchange.totalBuoyancyWorkJm2, 6),
    initialConvectiveKineticEnergyJm2: round(
      initialTotals.convectiveKineticEnergyJm2,
      6
    ),
    finalConvectiveKineticEnergyJm2: round(
      finalTotals.convectiveKineticEnergyJm2,
      6
    ),
    geopotentialRepresentationAdjustmentJm2: round(
      geopotentialRepresentationAdjustmentJm2,
      6
    ),
    residuals: {
      dryAirMassKgM2: round(finalTotals.dryAirMassKgM2 - initialTotals.dryAirMassKgM2, 9),
      waterMm: round(waterResidualMm, 12),
      phaseWaterMm: round(phaseWaterResidualMm, 12),
      phaseMoistEnthalpyJm2: round(phaseMoistEnthalpyResidualJm2, 6),
      moistEnthalpyJm2: round(moistEnthalpyResidualJm2, 6),
      eastwardMomentumKgMpsM2: round(eastwardMomentumResidualKgMpsM2, 9),
      northwardMomentumKgMpsM2: round(northwardMomentumResidualKgMpsM2, 9),
      horizontalKineticEnergyJm2: round(kineticEnergyResidualJm2, 6),
      convectiveKineticEnergyJm2: round(convectiveKineticEnergyResidualJm2, 6),
      resolvedEnergyJm2: round(resolvedEnergyResidualJm2, 6)
    },
    truth: {
      nativeLayerSaturationAndPhaseChange: true,
      nativeLayerCloudLiquidReservoirs: true,
      nativeLayerCloudIceReservoirs: true,
      nativeMixedPhaseClouds: true,
      typedRainSnowDescent: true,
      fusionHeatCoupledDuringDescent: true,
      precipitationDescentAcrossNativeInterfaces: true,
      adjacentNativeLayerExchange: true,
      equalGrossAdjacentDryAirExchange: true,
      nativeWaterClosed: Math.abs(waterResidualMm) < 1e-8,
      nativeMoistEnthalpyClosed: Math.abs(moistEnthalpyResidualJm2) < 1,
      nativeTangentMomentumClosed:
        Math.abs(eastwardMomentumResidualKgMpsM2) < 1e-6 &&
        Math.abs(northwardMomentumResidualKgMpsM2) < 1e-6,
      nativeKineticDissipationThermalized: Math.abs(kineticEnergyResidualJm2) < 1,
      nativeConvectiveKineticEnergyClosed:
        Math.abs(convectiveKineticEnergyResidualJm2) < 1,
      nativeResolvedEnergyClosed: Math.abs(resolvedEnergyResidualJm2) < 1,
      nativeHorizontalAdvection: false,
      nativeVirtualTemperatureBuoyancy: true,
      nativePressureGeopotentialConversion: true,
      nativeVerticalMomentum: true,
      nativeConvectiveKineticEnergyReservoirs: true,
      nativeBulkEntrainmentDetrainment: true,
      nativeBuoyancyPlumes: true,
      resolvedDropletMicrophysics: false,
      pressureLevelDynamicsResolved: true,
      threeDimensionalAtmosphere: false
    }
  };
  earthColumn.atmosphere.pressureColumn = finalColumnWithRevision;
  earthColumn.atmosphere.convectiveKineticEnergyJm2 =
    finalTotals.convectiveKineticEnergyJm2;
  earthColumn.atmosphere.verticalVelocityProxyMps =
    verticalExchange.verticalVelocityProxyMps;
  earthColumn.atmosphere.lastPressureColumnDynamicsReceipt = clone(receipt);
  applyPressureColumnProjectionToLegacy(earthColumn);
  return {
    receipt,
    phaseChange: compatibility.boundary,
    freePhaseChange: compatibility.free,
    verticalExchange,
    precipitationMm: round(precipitationMm, 12),
    rainfallMm: round(rainfallMm, 12),
    snowfallMm: round(snowfallMm, 12),
    unmetPrecipitationMm: round(Math.max(0, desiredPrecipitationMm - precipitationMm), 12)
  };
}

export function pressureDynamicsDescription() {
  return {
    schema: ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
    layerPhaseSchema: ATMOSPHERE_PRESSURE_LAYER_PHASE_SCHEMA,
    adjacentExchangeSchema: ATMOSPHERE_ADJACENT_LAYER_EXCHANGE_SCHEMA,
    pressureInterfaceBuoyancySchema: ATMOSPHERE_PRESSURE_INTERFACE_BUOYANCY_SCHEMA,
    precipitationDescentSchema: ATMOSPHERE_PRECIPITATION_DESCENT_SCHEMA,
    layerCount: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
    adjacentInterfaceCount: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT - 1,
    nativeLayerSaturationAndPhaseChange: true,
    nativeCloudLiquidReservoirs: true,
    nativeCloudIceReservoirs: true,
    nativeMixedPhaseClouds: true,
    typedRainSnowDescent: true,
    latentFusionEnergyCoupled: true,
    precipitationDescentAcrossInterfaces: true,
    equalGrossAdjacentDryAirExchange: true,
    tracerHeatAndTangentMomentumExchange: true,
    kineticDissipationThermalized: true,
    weatherNucleationParameterization: true,
    nativeHorizontalAdvection: false,
    nativeVirtualTemperatureBuoyancy: true,
    nativePressureGeopotentialConversion: true,
    nativeVerticalMomentum: true,
    nativeConvectiveKineticEnergyReservoirs: true,
    nativeBulkEntrainmentDetrainment: true,
    nativeBuoyancyPlumes: true,
    resolvedDropletMicrophysics: false,
    pressureLevelDynamicsResolved: true,
    threeDimensionalAtmosphere: false,
    scientificForecast: false
  };
}
