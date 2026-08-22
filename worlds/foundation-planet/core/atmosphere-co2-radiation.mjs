import {
  ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT
} from './atmosphere-biogeochemistry.mjs?v=0.62.0-r62.1';
import {
  ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT
} from './pressure-column.mjs';

export const ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA =
  'axm.foundation-planet.atmosphere-co2-radiative-coupling-receipt/v1';

const STEFAN_BOLTZMANN_W_M2_K4 = 5.670374419e-8;
const STANDARD_SURFACE_PRESSURE_HPA = 1013.25;
const STANDARD_GRAVITY_MPS2 = 9.80665;
const REFERENCE_DRY_AIR_KG_M2 = STANDARD_SURFACE_PRESSURE_HPA * 100 /
  STANDARD_GRAVITY_MPS2;
const REFERENCE_CO2_PPM = 420;
const REFERENCE_CO2_CARBON_KG_C_M2 = 3.45;
const REFERENCE_CO2_GREY_OPTICAL_DEPTH = .035;
const MAX_RADIATIVE_CO2_PPM = 42_000;
const MAX_SURFACE_ADJUSTMENT_W_M2 = 20;
const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));

function validateInputs(gasState, pressureColumn) {
  const gasLayers = gasState?.layers;
  const pressureLayers = pressureColumn?.layers;
  if (gasState?.schema !== ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA ||
      !Array.isArray(gasLayers) || gasLayers.length !==
        ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT ||
      gasLayers.some((layer, index) =>
        layer?.schema !== ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA ||
        layer.index !== index ||
        !Number.isFinite(layer.carbonDioxideCarbonKgCm2) ||
        layer.carbonDioxideCarbonKgCm2 < 0)) {
    throw new Error('CO2 radiation requires eight typed native atmospheric gas layers');
  }
  if (pressureColumn?.schema !== ATMOSPHERE_PRESSURE_COLUMN_SCHEMA ||
      !Array.isArray(pressureLayers) || pressureLayers.length !==
        ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT ||
      pressureLayers.some(layer =>
        !(finite(layer?.pressureThicknessHpa) > 0) ||
        !Number.isFinite(layer?.airTemperatureC))) {
    throw new Error('CO2 radiation requires eight positive native pressure-temperature paths');
  }
}

export function computeAtmosphereCo2RadiativeCoupling(column, options = {}) {
  const gasState = column?.atmosphere?.biogeochemistry;
  const pressureColumn = column?.atmosphere?.pressureColumn;
  validateInputs(gasState, pressureColumn);
  const totalPressureHpa = pressureColumn.layers.reduce((sum, layer) =>
    sum + finite(layer.pressureThicknessHpa), 0);
  let currentTransmissionBelow = 1;
  let referenceTransmissionBelow = 1;
  let currentDownwardLongwaveWm2 = 0;
  let referenceDownwardLongwaveWm2 = 0;
  let pressureWeightedCo2Ppm = 0;
  let currentTotalOpticalDepth = 0;
  let referenceTotalOpticalDepth = 0;
  let clippedLayerCount = 0;
  const layers = pressureColumn.layers.map((pressureLayer, layerIndex) => {
    const gasLayer = gasState.layers[layerIndex];
    const pressureThicknessHpa = finite(pressureLayer.pressureThicknessHpa);
    const pressurePathFraction = pressureThicknessHpa / totalPressureHpa;
    const dryAirKgM2 = pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
    const rawCo2Ppm = REFERENCE_CO2_PPM *
      (gasLayer.carbonDioxideCarbonKgCm2 / Math.max(1e-12, dryAirKgM2)) /
      (REFERENCE_CO2_CARBON_KG_C_M2 / REFERENCE_DRY_AIR_KG_M2);
    const radiativeCo2Ppm = clamp(rawCo2Ppm, 0, MAX_RADIATIVE_CO2_PPM);
    if (radiativeCo2Ppm !== rawCo2Ppm) clippedLayerCount++;
    const concentrationRatio = radiativeCo2Ppm / REFERENCE_CO2_PPM;
    const currentOpticalDepth = clamp(REFERENCE_CO2_GREY_OPTICAL_DEPTH *
      pressurePathFraction * Math.sqrt(concentrationRatio), 0, 1.5);
    const referenceOpticalDepth = REFERENCE_CO2_GREY_OPTICAL_DEPTH *
      pressurePathFraction;
    const currentEmissivity = 1 - Math.exp(-currentOpticalDepth);
    const referenceEmissivity = 1 - Math.exp(-referenceOpticalDepth);
    const airTemperatureK = Math.max(150,
      finite(pressureLayer.airTemperatureC) + 273.15);
    const blackbodyLongwaveWm2 = STEFAN_BOLTZMANN_W_M2_K4 *
      Math.pow(airTemperatureK, 4);
    const currentSurfaceContributionWm2 = currentEmissivity *
      blackbodyLongwaveWm2 * currentTransmissionBelow;
    const referenceSurfaceContributionWm2 = referenceEmissivity *
      blackbodyLongwaveWm2 * referenceTransmissionBelow;
    const layer = {
      schema: 'axm.foundation-planet.atmosphere-co2-radiative-layer/v1',
      layerIndex,
      pressureThicknessHpa: round(pressureThicknessHpa, 9),
      pressurePathFraction: round(pressurePathFraction, 12),
      dryAirKgM2: round(dryAirKgM2, 9),
      carbonDioxideCarbonKgCm2: round(
        gasLayer.carbonDioxideCarbonKgCm2, 12),
      rawCo2Ppm: round(rawCo2Ppm, 6),
      radiativeCo2Ppm: round(radiativeCo2Ppm, 6),
      airTemperatureC: round(pressureLayer.airTemperatureC, 9),
      currentOpticalDepth: round(currentOpticalDepth, 12),
      referenceOpticalDepth: round(referenceOpticalDepth, 12),
      currentTransmissionBelow: round(currentTransmissionBelow, 12),
      referenceTransmissionBelow: round(referenceTransmissionBelow, 12),
      currentSurfaceContributionWm2: round(
        currentSurfaceContributionWm2, 9),
      referenceSurfaceContributionWm2: round(
        referenceSurfaceContributionWm2, 9)
    };
    currentDownwardLongwaveWm2 += currentSurfaceContributionWm2;
    referenceDownwardLongwaveWm2 += referenceSurfaceContributionWm2;
    pressureWeightedCo2Ppm += rawCo2Ppm * pressurePathFraction;
    currentTotalOpticalDepth += currentOpticalDepth;
    referenceTotalOpticalDepth += referenceOpticalDepth;
    currentTransmissionBelow *= Math.exp(-currentOpticalDepth);
    referenceTransmissionBelow *= Math.exp(-referenceOpticalDepth);
    return layer;
  });
  const unmaskedAdjustmentWm2 = currentDownwardLongwaveWm2 -
    referenceDownwardLongwaveWm2;
  const cloudFraction = clamp(finite(options.cloudFraction));
  const cloudLongwaveEmissivity = clamp(finite(options.cloudLongwaveEmissivity));
  const cloudOverlapTransmission = clamp(
    1 - cloudFraction * cloudLongwaveEmissivity * .72, .2, 1);
  const cloudMaskedAdjustmentWm2 = unmaskedAdjustmentWm2 *
    cloudOverlapTransmission;
  const appliedSurfaceAdjustmentWm2 = clamp(cloudMaskedAdjustmentWm2,
    -MAX_SURFACE_ADJUSTMENT_W_M2, MAX_SURFACE_ADJUSTMENT_W_M2);
  const referenceStateDetected = layers.every(layer =>
    Math.abs(layer.rawCo2Ppm - REFERENCE_CO2_PPM) < 1e-6);
  return {
    schema: ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA,
    status: Math.abs(appliedSurfaceAdjustmentWm2) < 1e-9
      ? 'reference-neutral'
      : appliedSurfaceAdjustmentWm2 > 0
        ? 'positive-surface-longwave-adjustment'
        : 'negative-surface-longwave-adjustment',
    gasStateSchema: gasState.schema,
    pressureColumnSchema: pressureColumn.schema,
    referenceCo2Ppm: REFERENCE_CO2_PPM,
    referenceTotalGreyOpticalDepth: REFERENCE_CO2_GREY_OPTICAL_DEPTH,
    maximumRadiativeCo2Ppm: MAX_RADIATIVE_CO2_PPM,
    maximumSurfaceAdjustmentWm2: MAX_SURFACE_ADJUSTMENT_W_M2,
    layerCount: layers.length,
    pressureWeightedCo2Ppm: round(pressureWeightedCo2Ppm, 6),
    currentTotalOpticalDepth: round(currentTotalOpticalDepth, 12),
    referenceTotalOpticalDepth: round(referenceTotalOpticalDepth, 12),
    currentDownwardLongwaveProxyWm2: round(currentDownwardLongwaveWm2, 9),
    referenceDownwardLongwaveProxyWm2: round(referenceDownwardLongwaveWm2, 9),
    unmaskedAdjustmentWm2: round(unmaskedAdjustmentWm2, 9),
    cloudOverlap: {
      cloudFraction: round(cloudFraction, 9),
      cloudLongwaveEmissivity: round(cloudLongwaveEmissivity, 9),
      transmission: round(cloudOverlapTransmission, 9)
    },
    cloudMaskedAdjustmentWm2: round(cloudMaskedAdjustmentWm2, 9),
    appliedSurfaceAdjustmentWm2: round(appliedSurfaceAdjustmentWm2, 9),
    boundingResidualWm2: round(appliedSurfaceAdjustmentWm2 -
      cloudMaskedAdjustmentWm2, 9),
    clippedLayerCount,
    layers,
    truth: {
      authoritativeAtmosphereGasState: true,
      nativePressureLayerComposition: true,
      nativePressureTemperaturePaths: true,
      referenceComparisonUsesSameTemperatures: true,
      referenceStateDetected,
      referenceNeutralWhenDetected: !referenceStateDetected ||
        Math.abs(appliedSurfaceAdjustmentWm2) < 1e-9,
      cloudOverlapParameterized: true,
      boundedSurfaceLongwaveAdjustment: true,
      broadbandGreyGasParameterization: true,
      spectralRadiativeTransfer: false,
      lineByLineAbsorption: false,
      scientificRadiativeTransfer: false
    }
  };
}

export function atmosphereCo2RadiationDescription() {
  return {
    receiptSchema: ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA,
    layerReceiptSchema:
      'axm.foundation-planet.atmosphere-co2-radiative-layer/v1',
    gasStateSchema: ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
    pressureColumnSchema: ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    layerCount: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
    referenceCo2Ppm: REFERENCE_CO2_PPM,
    referenceTotalGreyOpticalDepth: REFERENCE_CO2_GREY_OPTICAL_DEPTH,
    maximumSurfaceAdjustmentWm2: MAX_SURFACE_ADJUSTMENT_W_M2,
    concentrationResponse: 'square-root-bounded-grey-optical-depth',
    cloudOverlap: 'bounded-bulk-mask',
    sideEffects: [],
    broadbandGreyGasParameterization: true,
    spectralRadiativeTransfer: false,
    lineByLineAbsorption: false,
    scientificRadiativeTransfer: false
  };
}
