import {
  MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
  MAX_NATIVE_LAYER_AIR_TEMPERATURE_C,
  phaseThermalEnvelopeDescription
} from './phase-thermal-envelope.mjs';

export const ATMOSPHERE_PRESSURE_COLUMN_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-column/v2';
export const ATMOSPHERE_PRESSURE_LAYER_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-layer/v2';
export const ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-column-sync-receipt/v2';
export const ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-vertical-interface/v1';
export const ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT = 8;
export const ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT = 2;
export const ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT =
  ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT - 1;

const STANDARD_GRAVITY_MPS2 = 9.80665;
const LEGACY_PRESSURE_COLUMN_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-column/v1';
const STANDARD_SURFACE_PRESSURE_HPA = 1013.25;
const REFERENCE_COLUMN_HEAT_CAPACITY_J_M2_K = 1.02e7;
const DRY_AIR_GAS_CONSTANT_J_KG_K = 287.05;
const LATENT_HEAT_VAPORIZATION_J_KG = 2.45e6;
export const PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG = 334_000;
const MODEL_TOP_PRESSURE_FLOOR_HPA = .1;
const LEGACY_BOUNDARY_REFERENCE_ALTITUDE_M = 500;
const LEGACY_FREE_REFERENCE_ALTITUDE_M = 4500;
const MIN_PRESSURE_THICKNESS_HPA = 1e-9;
const MAX_CONVECTIVE_KINETIC_ENERGY_J_M2 = 5e6;
const MAX_VERTICAL_VELOCITY_MPS = 90;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

export const PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K =
  REFERENCE_COLUMN_HEAT_CAPACITY_J_M2_K /
  (STANDARD_SURFACE_PRESSURE_HPA * 100 / STANDARD_GRAVITY_MPS2);

const BAND_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'boundary-layer',
    layerFractions: Object.freeze([.55, .45]),
    temperatureShapeK: Object.freeze([.7, -.7]),
    vaporShape: Object.freeze([1.18, .82]),
    cloudShape: Object.freeze([.55, 1.45])
  }),
  Object.freeze({
    id: 'free-troposphere',
    layerFractions: Object.freeze([.22, .20, .18, .16, .14, .10]),
    temperatureShapeK: Object.freeze([10, 5, -2, -10, -18, -8]),
    vaporShape: Object.freeze([1.60, 1.35, 1.05, .75, .45, .22]),
    cloudShape: Object.freeze([.80, 1.50, 1.60, 1.10, .45, .10])
  })
]);

function stableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function wind(speedMps, directionDeg, eastwardWindMps, northwardWindMps) {
  const radians = ((finite(directionDeg) % 360) + 360) % 360 * Math.PI / 180;
  let eastward = Number.isFinite(Number(eastwardWindMps))
    ? Number(eastwardWindMps) : Math.sin(radians) * clamp(finite(speedMps), 0, 90);
  let northward = Number.isFinite(Number(northwardWindMps))
    ? Number(northwardWindMps) : Math.cos(radians) * clamp(finite(speedMps), 0, 90);
  const magnitude = Math.hypot(eastward, northward);
  if (magnitude > 90) {
    eastward *= 90 / magnitude;
    northward *= 90 / magnitude;
  }
  return { eastwardWindMps: eastward, northwardWindMps: northward };
}

function windScalars(eastwardWindMps, northwardWindMps, fallbackDirectionDeg = 0) {
  const speed = Math.hypot(eastwardWindMps, northwardWindMps);
  return {
    eastwardWindMps,
    northwardWindMps,
    windSpeedMps: speed,
    windDirectionDeg: speed > 1e-12
      ? ((Math.atan2(eastwardWindMps, northwardWindMps) * 180 / Math.PI) + 360) % 360
      : ((finite(fallbackDirectionDeg) % 360) + 360) % 360
  };
}

function primaryLayerState(layer) {
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

function pressureColumnDigest(pressureColumn) {
  return stableDigest({
    layers: pressureColumn.layers.map(primaryLayerState),
    verticalInterfaces: pressureColumn.verticalInterfaces.map(entry => ({
      index: entry.index,
      convectiveKineticEnergyJm2: round(entry.convectiveKineticEnergyJm2, 9)
    }))
  });
}

function initializeVerticalInterfaces(pressureColumn, legacyConvectiveKineticEnergyJm2 = 0) {
  const existing = Array.isArray(pressureColumn.verticalInterfaces)
    ? pressureColumn.verticalInterfaces : [];
  const hasNativeState = existing.length === ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT;
  const migratedEnergyJm2 = clamp(
    finite(legacyConvectiveKineticEnergyJm2),
    0,
    MAX_CONVECTIVE_KINETIC_ENERGY_J_M2
  );
  pressureColumn.verticalInterfaces = Array.from(
    { length: ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT },
    (_, index) => {
      const source = hasNativeState ? existing[index] : null;
      return {
        schema: ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA,
        id: `pressure-interface-${String(index).padStart(2, '0')}`,
        index,
        lowerLayerId: `pressure-layer-${String(index).padStart(2, '0')}`,
        upperLayerId: `pressure-layer-${String(index + 1).padStart(2, '0')}`,
        convectiveKineticEnergyJm2: Math.max(0, finite(
          source?.convectiveKineticEnergyJm2,
          !hasNativeState && index === ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT - 1
            ? migratedEnergyJm2 : 0
        ))
      };
    }
  );
  pressureColumn.verticalInterfaceStateMigratedFromLegacyTwoBand =
    !hasNativeState && migratedEnergyJm2 > 0;
}

function recomputeVerticalInterfaces(pressureColumn) {
  let remainingEnergyJm2 = MAX_CONVECTIVE_KINETIC_ENERGY_J_M2;
  pressureColumn.verticalInterfaces.forEach((entry, index) => {
    const lower = pressureColumn.layers[index];
    const upper = pressureColumn.layers[index + 1];
    const lowerMassKgM2 = lower.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
    const upperMassKgM2 = upper.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
    const effectiveConvectiveMassKgM2 = Math.max(1,
      2 * lowerMassKgM2 * upperMassKgM2 /
        Math.max(1e-12, lowerMassKgM2 + upperMassKgM2));
    const energyVelocityLimitJm2 = .5 * effectiveConvectiveMassKgM2 *
      MAX_VERTICAL_VELOCITY_MPS ** 2;
    const convectiveKineticEnergyJm2 = clamp(
      finite(entry.convectiveKineticEnergyJm2),
      0,
      Math.min(remainingEnergyJm2, energyVelocityLimitJm2)
    );
    remainingEnergyJm2 -= convectiveKineticEnergyJm2;
    const verticalVelocityMps = Math.sqrt(2 * convectiveKineticEnergyJm2 /
      effectiveConvectiveMassKgM2);
    const verticalMomentumKgMpsM2 = effectiveConvectiveMassKgM2 * verticalVelocityMps;
    Object.assign(entry, {
      schema: ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA,
      id: `pressure-interface-${String(index).padStart(2, '0')}`,
      index,
      lowerLayerId: lower.id,
      upperLayerId: upper.id,
      centerPressureHpa: round(lower.topPressureHpa, 12),
      centerHeightM: round((lower.topHeightM + upper.bottomHeightM) / 2, 6),
      effectiveConvectiveMassKgM2: round(effectiveConvectiveMassKgM2, 9),
      convectiveKineticEnergyJm2: round(convectiveKineticEnergyJm2, 6),
      updraftVelocityMps: round(verticalVelocityMps, 9),
      compensatingDowndraftVelocityMps: round(-verticalVelocityMps, 9),
      updraftVerticalMomentumKgMpsM2: round(verticalMomentumKgMpsM2, 9),
      compensatingDowndraftVerticalMomentumKgMpsM2: round(-verticalMomentumKgMpsM2, 9),
      netVerticalMomentumKgMpsM2: 0
    });
  });
}

function distributeByWeights(total, fractions, shape) {
  const safeTotal = Math.max(0, finite(total));
  const weights = fractions.map((fraction, index) =>
    Math.max(0, fraction * Math.max(0, finite(shape?.[index], 1))));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const values = weights.map(value => safeTotal * value / Math.max(1e-15, weightTotal));
  if (values.length) values[values.length - 1] += safeTotal - values.reduce((sum, value) => sum + value, 0);
  return values;
}

function zeroMeanShape(shape, fractions) {
  const mean = shape.reduce((sum, value, index) => sum + value * fractions[index], 0) /
    Math.max(1e-15, fractions.reduce((sum, value) => sum + value, 0));
  return shape.map(value => value - mean);
}

function legacyTargets(earthColumn) {
  const atmosphere = earthColumn?.atmosphere || {};
  const free = atmosphere.freeTroposphere || {};
  const boundaryWind = wind(
    atmosphere.windSpeedMps,
    atmosphere.windDirectionDeg,
    atmosphere.eastwardWindMps,
    atmosphere.northwardWindMps
  );
  const freeWind = wind(
    free.windSpeedMps,
    free.windDirectionDeg,
    free.eastwardWindMps,
    free.northwardWindMps
  );
  const surfacePressureHpa = Math.max(1,
    finite(atmosphere.surfacePressureHpa, STANDARD_SURFACE_PRESSURE_HPA));
  const boundaryPressureHpa = clamp(
    finite(atmosphere.boundaryLayerPressureHpa, surfacePressureHpa * .25),
    MIN_PRESSURE_THICKNESS_HPA,
    surfacePressureHpa - MIN_PRESSURE_THICKNESS_HPA
  );
  const freePressureHpa = surfacePressureHpa - boundaryPressureHpa;
  return {
    surfacePressureHpa,
    boundaryLayer: {
      id: 'boundary-layer',
      pressureThicknessHpa: boundaryPressureHpa,
      airTemperatureC: finite(atmosphere.airTemperatureC),
      vaporWaterMm: Math.max(0, finite(atmosphere.precipitableWaterMm)),
      cloudWaterMm: Math.max(0, finite(atmosphere.cloudWaterMm)),
      cloudIceMm: Math.max(0, finite(atmosphere.cloudIceMm)),
      ...boundaryWind,
      fallbackDirectionDeg: finite(atmosphere.windDirectionDeg)
    },
    freeTroposphere: {
      id: 'free-troposphere',
      pressureThicknessHpa: freePressureHpa,
      airTemperatureC: finite(free.airTemperatureC, finite(atmosphere.airTemperatureC) - 29),
      vaporWaterMm: Math.max(0, finite(free.precipitableWaterMm)),
      cloudWaterMm: Math.max(0, finite(free.cloudWaterMm)),
      cloudIceMm: Math.max(0, finite(free.cloudIceMm)),
      ...freeWind,
      fallbackDirectionDeg: finite(free.windDirectionDeg)
    }
  };
}

function buildBandLayers(definition, target, startIndex) {
  const temperatureShape = zeroMeanShape(
    definition.temperatureShapeK,
    definition.layerFractions
  );
  const pressureThicknesses = definition.layerFractions.map(fraction =>
    target.pressureThicknessHpa * fraction);
  pressureThicknesses[pressureThicknesses.length - 1] += target.pressureThicknessHpa -
    pressureThicknesses.reduce((sum, value) => sum + value, 0);
  const vapor = distributeByWeights(
    target.vaporWaterMm,
    definition.layerFractions,
    definition.vaporShape
  );
  const cloud = distributeByWeights(
    target.cloudWaterMm,
    definition.layerFractions,
    definition.cloudShape
  );
  const cloudIce = distributeByWeights(
    target.cloudIceMm,
    definition.layerFractions,
    definition.cloudShape
  );
  return definition.layerFractions.map((fraction, localIndex) => ({
    schema: ATMOSPHERE_PRESSURE_LAYER_SCHEMA,
    id: `pressure-layer-${String(startIndex + localIndex).padStart(2, '0')}`,
    index: startIndex + localIndex,
    bandId: definition.id,
    pressureThicknessHpa: pressureThicknesses[localIndex],
    airTemperatureC: target.airTemperatureC + temperatureShape[localIndex],
    vaporWaterMm: vapor[localIndex],
    cloudWaterMm: cloud[localIndex],
    cloudIceMm: cloudIce[localIndex],
    eastwardWindMps: target.eastwardWindMps,
    northwardWindMps: target.northwardWindMps
  }));
}

function layerVirtualTemperatureK(layer) {
  const dryAirMassKgM2 = Math.max(1e-12,
    layer.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2);
  const vaporMixingRatio = Math.max(0, finite(layer.vaporWaterMm)) / dryAirMassKgM2;
  const condensedMixingRatio = (
    Math.max(0, finite(layer.cloudWaterMm)) +
    Math.max(0, finite(layer.cloudIceMm))
  ) / dryAirMassKgM2;
  return Math.max(120, finite(layer.airTemperatureC) + 273.15) *
    Math.max(.75, 1 + .61 * vaporMixingRatio - condensedMixingRatio);
}

function calculateTotals(pressureColumn) {
  const totals = {
    pressureThicknessHpa: 0,
    dryAirMassKgM2: 0,
    vaporWaterMm: 0,
    cloudWaterMm: 0,
    cloudIceMm: 0,
    eastwardMomentumKgMpsM2: 0,
    northwardMomentumKgMpsM2: 0,
    sensibleHeatJm2: 0,
    moistEnthalpyJm2: 0,
    horizontalKineticEnergyJm2: 0,
    convectiveKineticEnergyJm2: 0,
    geopotentialEnergyJm2: 0,
    resolvedEnergyJm2: 0
  };
  for (const layer of pressureColumn.layers) {
    const dryAirMassKgM2 = layer.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
    const sensibleHeatJm2 = layer.airTemperatureC * dryAirMassKgM2 *
      PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K;
    totals.pressureThicknessHpa += layer.pressureThicknessHpa;
    totals.dryAirMassKgM2 += dryAirMassKgM2;
    totals.vaporWaterMm += layer.vaporWaterMm;
    totals.cloudWaterMm += layer.cloudWaterMm;
    totals.cloudIceMm += layer.cloudIceMm;
    totals.eastwardMomentumKgMpsM2 += dryAirMassKgM2 * layer.eastwardWindMps;
    totals.northwardMomentumKgMpsM2 += dryAirMassKgM2 * layer.northwardWindMps;
    totals.sensibleHeatJm2 += sensibleHeatJm2;
    totals.moistEnthalpyJm2 += sensibleHeatJm2 +
      layer.vaporWaterMm * LATENT_HEAT_VAPORIZATION_J_KG -
      layer.cloudIceMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
    totals.horizontalKineticEnergyJm2 += .5 * dryAirMassKgM2 *
      (layer.eastwardWindMps ** 2 + layer.northwardWindMps ** 2);
    totals.geopotentialEnergyJm2 += dryAirMassKgM2 * STANDARD_GRAVITY_MPS2 *
      layer.centerHeightM;
  }
  totals.convectiveKineticEnergyJm2 = pressureColumn.verticalInterfaces.reduce(
    (sum, entry) => sum + finite(entry.convectiveKineticEnergyJm2),
    0
  );
  totals.resolvedEnergyJm2 = totals.moistEnthalpyJm2 +
    totals.horizontalKineticEnergyJm2 + totals.convectiveKineticEnergyJm2 +
    totals.geopotentialEnergyJm2;
  return {
    pressureThicknessHpa: round(totals.pressureThicknessHpa, 12),
    dryAirMassKgM2: round(totals.dryAirMassKgM2, 9),
    vaporWaterMm: round(totals.vaporWaterMm, 12),
    cloudWaterMm: round(totals.cloudWaterMm, 12),
    cloudIceMm: round(totals.cloudIceMm, 12),
    eastwardMomentumKgMpsM2: round(totals.eastwardMomentumKgMpsM2, 9),
    northwardMomentumKgMpsM2: round(totals.northwardMomentumKgMpsM2, 9),
    sensibleHeatJm2: round(totals.sensibleHeatJm2, 6),
    moistEnthalpyJm2: round(totals.moistEnthalpyJm2, 6),
    horizontalKineticEnergyJm2: round(totals.horizontalKineticEnergyJm2, 6),
    convectiveKineticEnergyJm2: round(totals.convectiveKineticEnergyJm2, 6),
    geopotentialEnergyJm2: round(totals.geopotentialEnergyJm2, 6),
    resolvedEnergyJm2: round(totals.resolvedEnergyJm2, 6)
  };
}

function recomputePressureGeometry(pressureColumn, surfaceElevationM) {
  const terrainHeightM = finite(surfaceElevationM);
  let remainingPressureHpa = pressureColumn.layers.reduce((sum, layer) =>
    sum + Math.max(MIN_PRESSURE_THICKNESS_HPA, finite(layer.pressureThicknessHpa)), 0);
  let interfaceHeightM = terrainHeightM;
  for (let index = 0; index < pressureColumn.layers.length; index++) {
    const layer = pressureColumn.layers[index];
    layer.schema = ATMOSPHERE_PRESSURE_LAYER_SCHEMA;
    layer.index = index;
    layer.id = `pressure-layer-${String(index).padStart(2, '0')}`;
    layer.bandId = index < ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT
      ? 'boundary-layer' : 'free-troposphere';
    layer.pressureThicknessHpa = Math.max(MIN_PRESSURE_THICKNESS_HPA,
      finite(layer.pressureThicknessHpa));
    layer.airTemperatureC = clamp(
      finite(layer.airTemperatureC),
      MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
      MAX_NATIVE_LAYER_AIR_TEMPERATURE_C
    );
    layer.vaporWaterMm = Math.max(0, finite(layer.vaporWaterMm));
    layer.cloudWaterMm = Math.max(0, finite(layer.cloudWaterMm));
    layer.cloudIceMm = Math.max(0, finite(layer.cloudIceMm));
    const boundedWind = wind(
      0,
      0,
      layer.eastwardWindMps,
      layer.northwardWindMps
    );
    layer.eastwardWindMps = boundedWind.eastwardWindMps;
    layer.northwardWindMps = boundedWind.northwardWindMps;
    const bottomPressureHpa = remainingPressureHpa;
    const topPressureHpa = index === pressureColumn.layers.length - 1
      ? 0
      : Math.max(0, remainingPressureHpa - layer.pressureThicknessHpa);
    const effectiveBottomPressureHpa = Math.max(MODEL_TOP_PRESSURE_FLOOR_HPA,
      bottomPressureHpa);
    const effectiveTopPressureHpa = Math.max(MODEL_TOP_PRESSURE_FLOOR_HPA,
      topPressureHpa);
    const centerPressureHpa = Math.sqrt(
      effectiveBottomPressureHpa * effectiveTopPressureHpa
    );
    const virtualTemperatureK = layerVirtualTemperatureK(layer);
    const scaleHeightM = DRY_AIR_GAS_CONSTANT_J_KG_K * virtualTemperatureK /
      STANDARD_GRAVITY_MPS2;
    const layerThicknessM = clamp(
      scaleHeightM * Math.log(effectiveBottomPressureHpa / effectiveTopPressureHpa),
      0,
      50_000
    );
    const centerOffsetM = clamp(
      scaleHeightM * Math.log(effectiveBottomPressureHpa / centerPressureHpa),
      0,
      layerThicknessM
    );
    const dryAirMassKgM2 = layer.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
    const windState = windScalars(
      layer.eastwardWindMps,
      layer.northwardWindMps
    );
    Object.assign(layer, {
      pressureThicknessHpa: round(layer.pressureThicknessHpa, 12),
      bottomPressureHpa: round(bottomPressureHpa, 12),
      centerPressureHpa: round(centerPressureHpa, 12),
      topPressureHpa: round(topPressureHpa, 12),
      bottomHeightM: round(interfaceHeightM, 6),
      centerHeightM: round(interfaceHeightM + centerOffsetM, 6),
      topHeightM: round(interfaceHeightM + layerThicknessM, 6),
      layerThicknessM: round(layerThicknessM, 6),
      virtualTemperatureK: round(virtualTemperatureK, 9),
      dryAirMassKgM2: round(dryAirMassKgM2, 9),
      airTemperatureC: round(layer.airTemperatureC, 12),
      vaporWaterMm: round(layer.vaporWaterMm, 12),
      cloudWaterMm: round(layer.cloudWaterMm, 12),
      cloudIceMm: round(layer.cloudIceMm, 12),
      ...Object.fromEntries(Object.entries(windState).map(([key, value]) => [key, round(value, 12)])),
      sensibleHeatJm2: round(layer.airTemperatureC * dryAirMassKgM2 *
        PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K, 6),
      moistEnthalpyJm2: round(
        layer.airTemperatureC * dryAirMassKgM2 *
          PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K +
          layer.vaporWaterMm * LATENT_HEAT_VAPORIZATION_J_KG -
          layer.cloudIceMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG,
        6
      ),
      horizontalKineticEnergyJm2: round(.5 * dryAirMassKgM2 *
        (layer.eastwardWindMps ** 2 + layer.northwardWindMps ** 2), 6),
      geopotentialEnergyJm2: round(dryAirMassKgM2 * STANDARD_GRAVITY_MPS2 *
        (interfaceHeightM + centerOffsetM), 6)
    });
    interfaceHeightM += layerThicknessM;
    remainingPressureHpa = topPressureHpa;
  }
  pressureColumn.surfacePressureHpa = round(pressureColumn.layers.reduce((sum, layer) =>
    sum + layer.pressureThicknessHpa, 0), 12);
  pressureColumn.surfaceReferenceHeightM = round(terrainHeightM, 6);
  pressureColumn.modelTopPressureFloorHpa = MODEL_TOP_PRESSURE_FLOOR_HPA;
  pressureColumn.modelTopHeightM = round(interfaceHeightM, 6);
  recomputeVerticalInterfaces(pressureColumn);
  pressureColumn.totals = calculateTotals(pressureColumn);
  pressureColumn.digest = pressureColumnDigest(pressureColumn);
  return pressureColumn;
}

function aggregateLayers(layers, fallbackDirectionDeg = 0) {
  const pressureThicknessHpa = layers.reduce((sum, layer) =>
    sum + layer.pressureThicknessHpa, 0);
  const dryAirMassKgM2 = pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
  const sensibleTemperatureNumerator = layers.reduce((sum, layer) =>
    sum + layer.airTemperatureC * layer.pressureThicknessHpa, 0);
  const eastwardMomentum = layers.reduce((sum, layer) =>
    sum + layer.eastwardWindMps * layer.pressureThicknessHpa, 0);
  const northwardMomentum = layers.reduce((sum, layer) =>
    sum + layer.northwardWindMps * layer.pressureThicknessHpa, 0);
  const eastwardWindMps = eastwardMomentum / Math.max(MIN_PRESSURE_THICKNESS_HPA,
    pressureThicknessHpa);
  const northwardWindMps = northwardMomentum / Math.max(MIN_PRESSURE_THICKNESS_HPA,
    pressureThicknessHpa);
  return {
    pressureThicknessHpa,
    dryAirMassKgM2,
    airTemperatureC: sensibleTemperatureNumerator /
      Math.max(MIN_PRESSURE_THICKNESS_HPA, pressureThicknessHpa),
    vaporWaterMm: layers.reduce((sum, layer) => sum + layer.vaporWaterMm, 0),
    cloudWaterMm: layers.reduce((sum, layer) => sum + layer.cloudWaterMm, 0),
    cloudIceMm: layers.reduce((sum, layer) => sum + layer.cloudIceMm, 0),
    ...windScalars(eastwardWindMps, northwardWindMps, fallbackDirectionDeg)
  };
}

export function pressureColumnProjection(pressureColumn) {
  if (!pressureColumn?.layers || pressureColumn.layers.length !==
      ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT) {
    throw new Error('Pressure-column projection requires eight layers');
  }
  const boundaryLayer = aggregateLayers(
    pressureColumn.layers.slice(0, ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT)
  );
  const freeTroposphere = aggregateLayers(
    pressureColumn.layers.slice(ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT)
  );
  return {
    surfacePressureHpa: boundaryLayer.pressureThicknessHpa +
      freeTroposphere.pressureThicknessHpa,
    boundaryLayer,
    freeTroposphere
  };
}

function legacyReferenceTotals(targets, surfaceElevationM) {
  const bands = [targets.boundaryLayer, targets.freeTroposphere];
  const heights = [
    finite(surfaceElevationM) + LEGACY_BOUNDARY_REFERENCE_ALTITUDE_M,
    finite(surfaceElevationM) + LEGACY_FREE_REFERENCE_ALTITUDE_M
  ];
  const totals = {
    dryAirMassKgM2: 0,
    vaporWaterMm: 0,
    cloudWaterMm: 0,
    cloudIceMm: 0,
    eastwardMomentumKgMpsM2: 0,
    northwardMomentumKgMpsM2: 0,
    moistEnthalpyJm2: 0,
    horizontalKineticEnergyJm2: 0,
    geopotentialEnergyJm2: 0
  };
  bands.forEach((band, index) => {
    const mass = band.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
    totals.dryAirMassKgM2 += mass;
    totals.vaporWaterMm += band.vaporWaterMm;
    totals.cloudWaterMm += band.cloudWaterMm;
    totals.cloudIceMm += band.cloudIceMm;
    totals.eastwardMomentumKgMpsM2 += mass * band.eastwardWindMps;
    totals.northwardMomentumKgMpsM2 += mass * band.northwardWindMps;
    totals.moistEnthalpyJm2 += band.airTemperatureC * mass *
      PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K +
      band.vaporWaterMm * LATENT_HEAT_VAPORIZATION_J_KG -
      band.cloudIceMm * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
    totals.horizontalKineticEnergyJm2 += .5 * mass *
      (band.eastwardWindMps ** 2 + band.northwardWindMps ** 2);
    totals.geopotentialEnergyJm2 += mass * STANDARD_GRAVITY_MPS2 * heights[index];
  });
  totals.resolvedEnergyJm2 = totals.moistEnthalpyJm2 +
    totals.horizontalKineticEnergyJm2 + totals.geopotentialEnergyJm2;
  return totals;
}

function buildSyncReceipt(earthColumn, pressureColumn, targets, reason, mode, initialTotals = null) {
  const finalProjection = pressureColumnProjection(pressureColumn);
  const finalTotals = calculateTotals(pressureColumn);
  const reference = legacyReferenceTotals(targets, earthColumn?.surface?.elevationM);
  const finalBoundary = finalProjection.boundaryLayer;
  const finalFree = finalProjection.freeTroposphere;
  const targetMomentum = legacyReferenceTotals(targets, earthColumn?.surface?.elevationM);
  const geopotentialRepresentationAdjustmentJm2 = finalTotals.geopotentialEnergyJm2 -
    reference.geopotentialEnergyJm2;
  const verticalShearKineticEnergyJm2 = finalTotals.horizontalKineticEnergyJm2 -
    reference.horizontalKineticEnergyJm2;
  return {
    schema: ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA,
    reason: String(reason || 'aggregate-forcing'),
    mode,
    layerCount: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
    boundaryLayerCount: ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT,
    initialTotals: initialTotals ? clone(initialTotals) : null,
    finalTotals: clone(finalTotals),
    target: {
      surfacePressureHpa: round(targets.surfacePressureHpa, 12),
      boundaryPressureHpa: round(targets.boundaryLayer.pressureThicknessHpa, 12),
      freePressureHpa: round(targets.freeTroposphere.pressureThicknessHpa, 12),
      vaporWaterMm: round(targets.boundaryLayer.vaporWaterMm +
        targets.freeTroposphere.vaporWaterMm, 12),
      cloudWaterMm: round(targets.boundaryLayer.cloudWaterMm +
        targets.freeTroposphere.cloudWaterMm, 12),
      cloudIceMm: round(targets.boundaryLayer.cloudIceMm +
        targets.freeTroposphere.cloudIceMm, 12),
      moistEnthalpyJm2: round(reference.moistEnthalpyJm2, 6),
      eastwardMomentumKgMpsM2: round(targetMomentum.eastwardMomentumKgMpsM2, 9),
      northwardMomentumKgMpsM2: round(targetMomentum.northwardMomentumKgMpsM2, 9)
    },
    residuals: {
      surfacePressureHpa: round(finalProjection.surfacePressureHpa - targets.surfacePressureHpa, 12),
      boundaryPressureHpa: round(finalBoundary.pressureThicknessHpa -
        targets.boundaryLayer.pressureThicknessHpa, 12),
      freePressureHpa: round(finalFree.pressureThicknessHpa -
        targets.freeTroposphere.pressureThicknessHpa, 12),
      dryAirMassKgM2: round(finalTotals.dryAirMassKgM2 - reference.dryAirMassKgM2, 9),
      vaporWaterMm: round(finalTotals.vaporWaterMm - reference.vaporWaterMm, 12),
      cloudWaterMm: round(finalTotals.cloudWaterMm - reference.cloudWaterMm, 12),
      cloudIceMm: round(finalTotals.cloudIceMm - reference.cloudIceMm, 12),
      moistEnthalpyJm2: round(finalTotals.moistEnthalpyJm2 - reference.moistEnthalpyJm2, 6),
      eastwardMomentumKgMpsM2: round(finalTotals.eastwardMomentumKgMpsM2 -
        reference.eastwardMomentumKgMpsM2, 9),
      northwardMomentumKgMpsM2: round(finalTotals.northwardMomentumKgMpsM2 -
        reference.northwardMomentumKgMpsM2, 9),
      horizontalKineticEnergyJm2: round(finalTotals.horizontalKineticEnergyJm2 -
        reference.horizontalKineticEnergyJm2 - verticalShearKineticEnergyJm2, 6),
      resolvedRepresentationJm2: round(finalTotals.resolvedEnergyJm2 -
        reference.resolvedEnergyJm2 - geopotentialRepresentationAdjustmentJm2 -
        verticalShearKineticEnergyJm2, 6)
    },
    verticalShearKineticEnergyJm2: round(verticalShearKineticEnergyJm2, 6),
    geopotentialRepresentationAdjustmentJm2: round(
      geopotentialRepresentationAdjustmentJm2,
      6
    ),
    modelTopHeightM: pressureColumn.modelTopHeightM,
    digest: pressureColumn.digest,
    truth: {
      dryAirMassClosed: Math.abs(finalTotals.dryAirMassKgM2 -
        reference.dryAirMassKgM2) < 1e-6,
      waterClosed: Math.abs(finalTotals.vaporWaterMm - reference.vaporWaterMm) < 1e-8 &&
        Math.abs(finalTotals.cloudWaterMm - reference.cloudWaterMm) < 1e-8 &&
        Math.abs(finalTotals.cloudIceMm - reference.cloudIceMm) < 1e-8,
      momentumClosed: Math.abs(finalTotals.eastwardMomentumKgMpsM2 -
        reference.eastwardMomentumKgMpsM2) < 1e-6 &&
        Math.abs(finalTotals.northwardMomentumKgMpsM2 -
          reference.northwardMomentumKgMpsM2) < 1e-6,
      moistEnthalpyClosed: Math.abs(finalTotals.moistEnthalpyJm2 -
        reference.moistEnthalpyJm2) < 1,
      hydrostaticInterfacesMonotonic: pressureColumn.layers.every((layer, index, layers) =>
        layer.bottomPressureHpa > layer.topPressureHpa &&
        layer.topHeightM >= layer.centerHeightM &&
        layer.centerHeightM >= layer.bottomHeightM &&
        (index === 0 || Math.abs(layer.bottomPressureHpa -
          layers[index - 1].topPressureHpa) < 1e-7)),
      pressureLevelDynamicsResolved: false,
      threeDimensionalAtmosphere: false
    }
  };
}

export function createPressureColumnFromLegacy(earthColumn, options = {}) {
  const targets = legacyTargets(earthColumn);
  const boundaryLayers = buildBandLayers(
    BAND_DEFINITIONS[0],
    targets.boundaryLayer,
    0
  );
  const freeLayers = buildBandLayers(
    BAND_DEFINITIONS[1],
    targets.freeTroposphere,
    boundaryLayers.length
  );
  const pressureColumn = {
    schema: ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    coordinate: 'terrain-following-pressure-thickness',
    order: 'bottom-to-top',
    layerCount: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
    boundaryLayerCount: ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT,
    revision: 0,
    initializedFrom: String(options.reason || 'legacy-two-band-projection'),
    layers: [...boundaryLayers, ...freeLayers]
  };
  initializeVerticalInterfaces(
    pressureColumn,
    earthColumn?.atmosphere?.convectiveKineticEnergyJm2
  );
  recomputePressureGeometry(pressureColumn, earthColumn?.surface?.elevationM);
  const receipt = buildSyncReceipt(
    earthColumn,
    pressureColumn,
    targets,
    options.reason || 'legacy-two-band-projection',
    'created'
  );
  return { pressureColumn, receipt };
}

function scaleBandPressure(layers, targetPressureHpa) {
  const current = layers.reduce((sum, layer) => sum + layer.pressureThicknessHpa, 0);
  const target = Math.max(MIN_PRESSURE_THICKNESS_HPA * layers.length,
    finite(targetPressureHpa));
  if (current <= 0) {
    layers.forEach((layer, index) => {
      layer.pressureThicknessHpa = target / layers.length;
      if (index === layers.length - 1) {
        layer.pressureThicknessHpa += target - layers.reduce((sum, entry) =>
          sum + entry.pressureThicknessHpa, 0);
      }
    });
    return;
  }
  const scale = target / current;
  layers.forEach(layer => { layer.pressureThicknessHpa *= scale; });
  layers[layers.length - 1].pressureThicknessHpa += target -
    layers.reduce((sum, layer) => sum + layer.pressureThicknessHpa, 0);
}

function rescaleReservoir(layers, key, targetTotal) {
  const target = Math.max(0, finite(targetTotal));
  const current = layers.reduce((sum, layer) => sum + Math.max(0, finite(layer[key])), 0);
  if (current > 1e-15) {
    const scale = target / current;
    layers.forEach(layer => { layer[key] = Math.max(0, finite(layer[key])) * scale; });
  } else {
    const pressure = layers.reduce((sum, layer) => sum + layer.pressureThicknessHpa, 0);
    layers.forEach(layer => {
      layer[key] = target * layer.pressureThicknessHpa /
        Math.max(MIN_PRESSURE_THICKNESS_HPA, pressure);
    });
  }
  layers[layers.length - 1][key] += target -
    layers.reduce((sum, layer) => sum + layer[key], 0);
}

function shiftBandMean(layers, key, targetMean) {
  const pressure = layers.reduce((sum, layer) => sum + layer.pressureThicknessHpa, 0);
  const currentMean = layers.reduce((sum, layer) =>
    sum + finite(layer[key]) * layer.pressureThicknessHpa, 0) /
    Math.max(MIN_PRESSURE_THICKNESS_HPA, pressure);
  const shift = finite(targetMean) - currentMean;
  layers.forEach(layer => { layer[key] = finite(layer[key]) + shift; });
}

function fitBandWind(layers, targetEastwardWindMps, targetNorthwardWindMps) {
  const pressure = layers.reduce((sum, layer) => sum + layer.pressureThicknessHpa, 0);
  const meanEastward = layers.reduce((sum, layer) =>
    sum + finite(layer.eastwardWindMps) * layer.pressureThicknessHpa, 0) /
    Math.max(MIN_PRESSURE_THICKNESS_HPA, pressure);
  const meanNorthward = layers.reduce((sum, layer) =>
    sum + finite(layer.northwardWindMps) * layer.pressureThicknessHpa, 0) /
    Math.max(MIN_PRESSURE_THICKNESS_HPA, pressure);
  const anomalies = layers.map(layer => ({
    eastward: finite(layer.eastwardWindMps) - meanEastward,
    northward: finite(layer.northwardWindMps) - meanNorthward
  }));
  const target = wind(0, 0, targetEastwardWindMps, targetNorthwardWindMps);
  const fits = scale => anomalies.every(anomaly => Math.hypot(
    target.eastwardWindMps + anomaly.eastward * scale,
    target.northwardWindMps + anomaly.northward * scale
  ) <= 90.0000000001);
  let anomalyScale = 1;
  if (!fits(anomalyScale)) {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 60; iteration++) {
      const middle = (low + high) / 2;
      if (fits(middle)) low = middle;
      else high = middle;
    }
    anomalyScale = low;
  }
  layers.forEach((layer, index) => {
    layer.eastwardWindMps = target.eastwardWindMps +
      anomalies[index].eastward * anomalyScale;
    layer.northwardWindMps = target.northwardWindMps +
      anomalies[index].northward * anomalyScale;
  });
}

function reconcileBand(layers, target) {
  scaleBandPressure(layers, target.pressureThicknessHpa);
  shiftBandMean(layers, 'airTemperatureC', target.airTemperatureC);
  fitBandWind(layers, target.eastwardWindMps, target.northwardWindMps);
  rescaleReservoir(layers, 'vaporWaterMm', target.vaporWaterMm);
  rescaleReservoir(layers, 'cloudWaterMm', target.cloudWaterMm);
  rescaleReservoir(layers, 'cloudIceMm', target.cloudIceMm);
}

export function validatePressureColumn(pressureColumn) {
  if (!pressureColumn || pressureColumn.schema !== ATMOSPHERE_PRESSURE_COLUMN_SCHEMA ||
      !Array.isArray(pressureColumn.layers) || pressureColumn.layers.length !==
      ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT) return false;
  if (!Array.isArray(pressureColumn.verticalInterfaces) ||
      pressureColumn.verticalInterfaces.length !==
        ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT) return false;
  let priorTopPressureHpa = null;
  let priorTopHeightM = null;
  for (let index = 0; index < pressureColumn.layers.length; index++) {
    const layer = pressureColumn.layers[index];
    if (layer?.schema !== ATMOSPHERE_PRESSURE_LAYER_SCHEMA || layer.index !== index ||
        !Number.isFinite(layer.pressureThicknessHpa) || layer.pressureThicknessHpa <= 0 ||
        !Number.isFinite(layer.airTemperatureC) || !Number.isFinite(layer.vaporWaterMm) ||
        layer.vaporWaterMm < 0 || !Number.isFinite(layer.cloudWaterMm) ||
        layer.cloudWaterMm < 0 || !Number.isFinite(layer.cloudIceMm) ||
        layer.cloudIceMm < 0 || !Number.isFinite(layer.eastwardWindMps) ||
        !Number.isFinite(layer.northwardWindMps) ||
        Math.hypot(layer.eastwardWindMps, layer.northwardWindMps) > 90.000001 ||
        !Number.isFinite(layer.bottomPressureHpa) || !Number.isFinite(layer.topPressureHpa) ||
        layer.bottomPressureHpa <= layer.topPressureHpa ||
        !Number.isFinite(layer.bottomHeightM) || !Number.isFinite(layer.centerHeightM) ||
        !Number.isFinite(layer.topHeightM) || layer.bottomHeightM > layer.centerHeightM ||
        layer.centerHeightM > layer.topHeightM) return false;
    if (priorTopPressureHpa !== null &&
        Math.abs(layer.bottomPressureHpa - priorTopPressureHpa) > 1e-6) return false;
    if (priorTopHeightM !== null && Math.abs(layer.bottomHeightM - priorTopHeightM) > 1e-4) return false;
    priorTopPressureHpa = layer.topPressureHpa;
    priorTopHeightM = layer.topHeightM;
  }
  if (!pressureColumn.verticalInterfaces.every((entry, index) =>
    entry?.schema === ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA &&
    entry.index === index &&
    entry.lowerLayerId === pressureColumn.layers[index].id &&
    entry.upperLayerId === pressureColumn.layers[index + 1].id &&
    Number.isFinite(entry.convectiveKineticEnergyJm2) &&
    entry.convectiveKineticEnergyJm2 >= 0 &&
    Number.isFinite(entry.updraftVelocityMps) &&
    entry.updraftVelocityMps >= 0 && entry.updraftVelocityMps <= 90.000001 &&
    Number.isFinite(entry.compensatingDowndraftVelocityMps) &&
    Math.abs(entry.updraftVelocityMps + entry.compensatingDowndraftVelocityMps) < 1e-7 &&
    Number.isFinite(entry.netVerticalMomentumKgMpsM2) &&
    Math.abs(entry.netVerticalMomentumKgMpsM2) < 1e-7)) return false;
  const pressure = pressureColumn.layers.reduce((sum, layer) =>
    sum + layer.pressureThicknessHpa, 0);
  return pressure >= 300 && pressure <= 1500 && Math.abs(priorTopPressureHpa) < 1e-7;
}

export function normalizePressureColumn(source, surfaceElevationM = 0, options = {}) {
  if (!source || ![ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    LEGACY_PRESSURE_COLUMN_SCHEMA].includes(source.schema) ||
      !Array.isArray(source.layers) || source.layers.length !==
      ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT) {
    throw new Error('Invalid pressure-column state');
  }
  const pressureColumn = clone(source);
  pressureColumn.schema = ATMOSPHERE_PRESSURE_COLUMN_SCHEMA;
  pressureColumn.coordinate = 'terrain-following-pressure-thickness';
  pressureColumn.order = 'bottom-to-top';
  pressureColumn.layerCount = ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT;
  pressureColumn.boundaryLayerCount = ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT;
  pressureColumn.revision = Math.max(0, Math.round(finite(pressureColumn.revision)));
  initializeVerticalInterfaces(
    pressureColumn,
    options.legacyConvectiveKineticEnergyJm2
  );
  recomputePressureGeometry(pressureColumn, surfaceElevationM);
  if (!validatePressureColumn(pressureColumn)) throw new Error('Pressure-column normalization failed');
  return pressureColumn;
}

export function applyPressureColumnProjectionToLegacy(earthColumn) {
  if (!earthColumn?.atmosphere?.pressureColumn ||
      !earthColumn.atmosphere.freeTroposphere) {
    throw new Error('Pressure-column projection requires an atmospheric column');
  }
  const projection = pressureColumnProjection(earthColumn.atmosphere.pressureColumn);
  const atmosphere = earthColumn.atmosphere;
  const free = atmosphere.freeTroposphere;
  atmosphere.surfacePressureHpa = round(projection.surfacePressureHpa, 12);
  atmosphere.boundaryLayerPressureHpa = round(
    projection.boundaryLayer.pressureThicknessHpa,
    12
  );
  atmosphere.airTemperatureC = round(projection.boundaryLayer.airTemperatureC, 12);
  atmosphere.precipitableWaterMm = round(projection.boundaryLayer.vaporWaterMm, 12);
  atmosphere.cloudWaterMm = round(projection.boundaryLayer.cloudWaterMm, 12);
  atmosphere.cloudIceMm = round(projection.boundaryLayer.cloudIceMm, 12);
  Object.assign(atmosphere, Object.fromEntries(Object.entries(windScalars(
    projection.boundaryLayer.eastwardWindMps,
    projection.boundaryLayer.northwardWindMps,
    atmosphere.windDirectionDeg
  )).map(([key, value]) => [key, round(value, 12)])));
  free.pressureThicknessHpa = round(projection.freeTroposphere.pressureThicknessHpa, 12);
  free.airTemperatureC = round(projection.freeTroposphere.airTemperatureC, 12);
  free.precipitableWaterMm = round(projection.freeTroposphere.vaporWaterMm, 12);
  free.cloudWaterMm = round(projection.freeTroposphere.cloudWaterMm, 12);
  free.cloudIceMm = round(projection.freeTroposphere.cloudIceMm, 12);
  Object.assign(free, Object.fromEntries(Object.entries(windScalars(
    projection.freeTroposphere.eastwardWindMps,
    projection.freeTroposphere.northwardWindMps,
    free.windDirectionDeg
  )).map(([key, value]) => [key, round(value, 12)])));
  return projection;
}

export function projectNativePressureColumnToLegacy(earthColumn, options = {}) {
  if (!validatePressureColumn(earthColumn?.atmosphere?.pressureColumn)) {
    throw new Error('Native pressure-column projection requires a valid eight-level column');
  }
  const initialTotals = calculateTotals(earthColumn.atmosphere.pressureColumn);
  earthColumn.atmosphere.pressureColumn = normalizePressureColumn(
    earthColumn.atmosphere.pressureColumn,
    earthColumn?.surface?.elevationM
  );
  applyPressureColumnProjectionToLegacy(earthColumn);
  const targets = legacyTargets(earthColumn);
  const receipt = buildSyncReceipt(
    earthColumn,
    earthColumn.atmosphere.pressureColumn,
    targets,
    String(options.reason || 'native-pressure-column-authority'),
    'native-authority-projection',
    initialTotals
  );
  earthColumn.atmosphere.lastPressureColumnSyncReceipt = receipt;
  return receipt;
}

export function reconcilePressureColumnWithLegacy(earthColumn, options = {}) {
  if (!earthColumn?.atmosphere?.freeTroposphere) {
    throw new Error('Pressure-column reconciliation requires the two-band compatibility projection');
  }
  const reason = String(options.reason || 'aggregate-forcing');
  const targets = legacyTargets(earthColumn);
  let pressureColumn;
  let mode;
  let initialTotals = null;
  if (earthColumn.atmosphere.pressureColumn &&
      [ATMOSPHERE_PRESSURE_COLUMN_SCHEMA, LEGACY_PRESSURE_COLUMN_SCHEMA].includes(
        earthColumn.atmosphere.pressureColumn.schema) &&
      Array.isArray(earthColumn.atmosphere.pressureColumn.layers) &&
      earthColumn.atmosphere.pressureColumn.layers.length ===
        ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT) {
    try {
      pressureColumn = normalizePressureColumn(
        earthColumn.atmosphere.pressureColumn,
        earthColumn?.surface?.elevationM,
        { legacyConvectiveKineticEnergyJm2:
          earthColumn?.atmosphere?.convectiveKineticEnergyJm2 }
      );
      initialTotals = calculateTotals(pressureColumn);
      mode = 'reconciled';
    } catch {
      pressureColumn = null;
    }
  }
  if (!pressureColumn) {
    const created = createPressureColumnFromLegacy(earthColumn, { reason });
    earthColumn.atmosphere.pressureColumn = created.pressureColumn;
    earthColumn.atmosphere.lastPressureColumnSyncReceipt = created.receipt;
    applyPressureColumnProjectionToLegacy(earthColumn);
    return created.receipt;
  }
  reconcileBand(
    pressureColumn.layers.slice(0, ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT),
    targets.boundaryLayer
  );
  reconcileBand(
    pressureColumn.layers.slice(ATMOSPHERE_PRESSURE_COLUMN_BOUNDARY_LAYER_COUNT),
    targets.freeTroposphere
  );
  pressureColumn.revision += 1;
  pressureColumn.lastSyncReason = reason;
  recomputePressureGeometry(pressureColumn, earthColumn?.surface?.elevationM);
  const receipt = buildSyncReceipt(
    earthColumn,
    pressureColumn,
    targets,
    reason,
    mode,
    initialTotals
  );
  earthColumn.atmosphere.pressureColumn = pressureColumn;
  earthColumn.atmosphere.lastPressureColumnSyncReceipt = receipt;
  applyPressureColumnProjectionToLegacy(earthColumn);
  return receipt;
}

export function restorePressureColumn(earthColumn, options = {}) {
  const source = earthColumn?.atmosphere?.pressureColumn;
  const structurallyMigratable = [ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    LEGACY_PRESSURE_COLUMN_SCHEMA].includes(source?.schema) &&
    Array.isArray(source.layers) &&
    source.layers.length === ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT;
  if (structurallyMigratable) {
    const preservedReceipt = earthColumn.atmosphere.lastPressureColumnSyncReceipt;
    if (validatePressureColumn(source) &&
        preservedReceipt?.schema === ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA &&
        preservedReceipt.digest === earthColumn.atmosphere.pressureColumn.digest) {
      return preservedReceipt;
    }
    earthColumn.atmosphere.pressureColumn = normalizePressureColumn(
      earthColumn.atmosphere.pressureColumn,
      earthColumn?.surface?.elevationM,
      { legacyConvectiveKineticEnergyJm2:
        earthColumn?.atmosphere?.convectiveKineticEnergyJm2 }
    );
    applyPressureColumnProjectionToLegacy(earthColumn);
    const targets = legacyTargets(earthColumn);
    const receipt = buildSyncReceipt(
      earthColumn,
      earthColumn.atmosphere.pressureColumn,
      targets,
      options.reason || 'pressure-column-restore',
      'restored',
      calculateTotals(earthColumn.atmosphere.pressureColumn)
    );
    earthColumn.atmosphere.lastPressureColumnSyncReceipt = receipt;
    return receipt;
  }
  delete earthColumn?.atmosphere?.pressureColumn;
  return reconcilePressureColumnWithLegacy(earthColumn, {
    reason: options.reason || 'legacy-v10-migration'
  });
}

export function pressureColumnTotals(pressureColumn) {
  if (!validatePressureColumn(pressureColumn)) throw new Error('Invalid pressure-column totals request');
  return calculateTotals(pressureColumn);
}

export function pressureColumnDescription() {
  return {
    schema: ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    layerSchema: ATMOSPHERE_PRESSURE_LAYER_SCHEMA,
    verticalInterfaceSchema: ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA,
    syncReceiptSchema: ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA,
    phaseThermalEnvelope: phaseThermalEnvelopeDescription(),
    coordinate: 'terrain-following-pressure-thickness',
    order: 'bottom-to-top',
    layerCount: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
    verticalInterfaceCount: ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT,
    compatibilityProjection: ['boundary-layer', 'free-troposphere'],
    reservoirs: ['dry-air-mass', 'water-vapor', 'cloud-liquid', 'cloud-ice', 'sensible-enthalpy',
      'eastward-momentum', 'northward-momentum', 'seven-interface-convective-kinetic-energy',
      'geopotential-energy'],
    hydrostaticInterfaceGeometry: true,
    conservativeAggregateReconciliation: true,
    verticalSubstructurePersisted: true,
    nativeMixedPhaseCloudReservoirs: true,
    pressureLevelDynamicsResolved: true,
    boundedBulkEntrainmentDetrainment: true,
    threeDimensionalAtmosphere: false,
    scientificForecast: false
  };
}
