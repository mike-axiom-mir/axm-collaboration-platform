export const ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-state/v4';
export const PREVIOUS_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-state/v3';
export const LEGACY_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-state/v2';
export const OLDEST_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-state/v1';
export const ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-layer/v1';
export const ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT = 8;
export const ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA =
  'axm.foundation-planet.atmosphere-biosphere-gas-flux-receipt/v1';
export const ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA =
  'axm.foundation-planet.atmosphere-gas-boundary-input-receipt/v1';
export const ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA =
  'axm.foundation-planet.atmosphere-floodplain-gas-exchange-receipt/v3';
export const PREVIOUS_ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA =
  'axm.foundation-planet.atmosphere-floodplain-gas-exchange-receipt/v2';
export const ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA =
  'axm.foundation-planet.atmosphere-floodplain-gas-exchange-mass-closure-policy/v1';
export const ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG =
  Object.freeze({ carbonKgC: 1e-3, oxygenKgO2: 1e-3 });
export const ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ULP_FACTOR = 8;
export const ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_ABSOLUTE_TOLERANCE_KG =
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
    .carbonKgC;
export const ATMOSPHERE_BIOGEOCHEMISTRY_HORIZONTAL_LOCAL_RECEIPT_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-horizontal-local-receipt/v2';
export const ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-vertical-transport-receipt/v1';
export const ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_INTERFACE_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-vertical-interface-receipt/v1';

const REFERENCE_CO2_PPM = 420;
const REFERENCE_CO2_CARBON_KG_C_M2 = 3.45;
const REFERENCE_OXYGEN_KG_O2_M2 = 2400;
const REFERENCE_NITROGEN_GAS_KG_N_M2 = 7800;
const STANDARD_SURFACE_PRESSURE_HPA = 1013.25;
const STANDARD_GRAVITY_MPS2 = 9.80665;
const REFERENCE_DRY_AIR_KG_M2 = STANDARD_SURFACE_PRESSURE_HPA * 100 /
  STANDARD_GRAVITY_MPS2;
const DEFAULT_LAYER_DRY_AIR_FRACTIONS = Object.freeze([
  .1375, .1125, .165, .15, .135, .12, .105, .075
]);
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));
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

export function atmosphereFloodplainGasExchangeMassClosureToleranceKg(
  channel, ...values) {
  const absoluteFloorKg =
    ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG[
      channel];
  if (!Number.isFinite(absoluteFloorKg)) {
    throw new Error(`Unknown atmosphere floodplain gas material channel: ${channel}`);
  }
  const magnitudeKg = Math.max(1, ...values.map(value =>
    Math.abs(finite(value))));
  return round(Math.max(absoluteFloorKg,
    magnitudeKg * Number.EPSILON *
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ULP_FACTOR), 12);
}

function atmosphereFloodplainGasNumericClosure(identities = {},
  numericToleranceKg = {}) {
  const pairs = Object.keys(identities).map(key => [
    Math.abs(finite(identities[key])), finite(numericToleranceKg[key])
  ]);
  const maximumResidualKg = Math.max(0,
    ...pairs.map(([residual]) => residual));
  const maximumToleranceUtilization = Math.max(0,
    ...pairs.map(([residual, tolerance]) =>
      tolerance > 0 ? residual / tolerance : Infinity));
  return {
    conservation: {
      maximumResidualKg: round(maximumResidualKg, 12),
      maximumToleranceUtilization: round(
        maximumToleranceUtilization, 12),
      ...identities,
      numericToleranceKg,
      policy: {
        schema:
          ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
        absoluteFloorsKg: {
          ...ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
        },
        ulpFactor:
          ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
        recordedOperandScale: true,
        perIdentity: true,
        arbitraryToleranceAuthority: false
      }
    },
    allIdentitiesClosed: pairs.every(([residual, tolerance]) =>
      tolerance > 0 && residual <= tolerance)
  };
}

function dryAirFractions(pressureColumn) {
  const pressureLayers = pressureColumn?.layers;
  if (!Array.isArray(pressureLayers) || pressureLayers.length !==
      ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT || pressureLayers.some(layer =>
        !(finite(layer?.pressureThicknessHpa) > 0))) {
    return [...DEFAULT_LAYER_DRY_AIR_FRACTIONS];
  }
  const total = pressureLayers.reduce((sum, layer) =>
    sum + finite(layer.pressureThicknessHpa), 0);
  return pressureLayers.map(layer => finite(layer.pressureThicknessHpa) / total);
}

function distribute(total, fractions) {
  const values = fractions.map(fraction => Math.max(0, finite(total)) * fraction);
  values[values.length - 1] += Math.max(0, finite(total)) -
    values.reduce((sum, value) => sum + value, 0);
  return values;
}

function createGasLayers(options = {}) {
  const supplied = Array.isArray(options.layers) && options.layers.length ===
    ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT ? options.layers : null;
  const fractions = dryAirFractions(options.pressureColumn);
  const carbon = supplied ? null : distribute(
    options.carbonDioxideCarbonKgCm2, fractions);
  const oxygen = supplied ? null : distribute(options.oxygenKgO2m2, fractions);
  const nitrogen = supplied ? null : distribute(options.nitrogenGasKgNm2, fractions);
  return Array.from({ length: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT },
    (_, index) => ({
      schema: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA,
      id: `atmosphere-biogeochemistry-layer-${String(index).padStart(2, '0')}`,
      index,
      carbonDioxideCarbonKgCm2: Math.max(0, finite(
        supplied?.[index]?.carbonDioxideCarbonKgCm2, carbon?.[index])),
      oxygenKgO2m2: Math.max(0, finite(
        supplied?.[index]?.oxygenKgO2m2, oxygen?.[index])),
      nitrogenGasKgNm2: Math.max(0, finite(
        supplied?.[index]?.nitrogenGasKgNm2, nitrogen?.[index])),
      co2PpmProxy: 0,
      oxygenFractionProxy: 0,
      nitrogenFractionProxy: 0
    }));
}

function applySurfaceDelta(state, key, requestedDelta) {
  let remaining = finite(requestedDelta);
  const affectedLayerIndices = [];
  if (remaining >= 0) {
    state.layers[0][key] += remaining;
    if (remaining > 0) affectedLayerIndices.push(0);
    return { applied: remaining, affectedLayerIndices };
  }
  const requestedRemoval = -remaining;
  let removalRemaining = requestedRemoval;
  for (const layer of state.layers) {
    if (removalRemaining <= 1e-15) break;
    const removed = Math.min(layer[key], removalRemaining);
    if (removed > 0) affectedLayerIndices.push(layer.index);
    layer[key] -= removed;
    removalRemaining -= removed;
  }
  return {
    applied: -(requestedRemoval - removalRemaining),
    affectedLayerIndices
  };
}

function compatibilityMirrors(landEcology, oceanEcology) {
  return {
    carbonDioxideCarbonKgCm2: Math.max(0, finite(
      landEcology?.carbon?.atmosphericExchangeableKgCm2,
      finite(oceanEcology?.carbon?.atmosphericExchangeableKgCm2,
        REFERENCE_CO2_CARBON_KG_C_M2))),
    oxygenKgO2m2: Math.max(0, finite(
      oceanEcology?.oxygen?.atmosphericExchangeableKgO2m2,
      REFERENCE_OXYGEN_KG_O2_M2))
  };
}

export function refreshAtmosphereBiogeochemistry(state, pressureColumn) {
  state.carbonDioxideCarbonKgCm2 = state.layers.reduce((sum, layer) =>
    sum + layer.carbonDioxideCarbonKgCm2, 0);
  state.oxygenKgO2m2 = state.layers.reduce((sum, layer) =>
    sum + layer.oxygenKgO2m2, 0);
  state.nitrogenGasKgNm2 = state.layers.reduce((sum, layer) =>
    sum + layer.nitrogenGasKgNm2, 0);
  state.co2Ppm = round(REFERENCE_CO2_PPM *
    state.carbonDioxideCarbonKgCm2 / REFERENCE_CO2_CARBON_KG_C_M2, 6);
  state.oxygenFractionProxy = round(.2095 *
    state.oxygenKgO2m2 / REFERENCE_OXYGEN_KG_O2_M2, 9);
  const pressureLayers = pressureColumn?.layers;
  const fractions = dryAirFractions(pressureColumn);
  state.layers.forEach((layer, index) => {
    const dryAirKgM2 = Array.isArray(pressureLayers) &&
      pressureLayers.length === ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT
      ? finite(pressureLayers[index].pressureThicknessHpa) * 100 /
        STANDARD_GRAVITY_MPS2
      : REFERENCE_DRY_AIR_KG_M2 * fractions[index];
    layer.co2PpmProxy = round(REFERENCE_CO2_PPM *
      (layer.carbonDioxideCarbonKgCm2 / Math.max(1e-12, dryAirKgM2)) /
      (REFERENCE_CO2_CARBON_KG_C_M2 / REFERENCE_DRY_AIR_KG_M2), 6);
    layer.oxygenFractionProxy = round(.2095 *
      (layer.oxygenKgO2m2 / Math.max(1e-12, dryAirKgM2)) /
      (REFERENCE_OXYGEN_KG_O2_M2 / REFERENCE_DRY_AIR_KG_M2), 9);
    layer.nitrogenFractionProxy = round(.7808 *
      (layer.nitrogenGasKgNm2 / Math.max(1e-12, dryAirKgM2)) /
      (REFERENCE_NITROGEN_GAS_KG_N_M2 / REFERENCE_DRY_AIR_KG_M2), 9);
  });
  state.truth.nativePressureLayerComposition = true;
  state.truth.layerCount = ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT;
  return state;
}

export function createAtmosphereBiogeochemistry(options = {}) {
  return refreshAtmosphereBiogeochemistry({
    schema: ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
    layers: createGasLayers({
      layers: options.layers,
      pressureColumn: options.pressureColumn,
      carbonDioxideCarbonKgCm2: Math.max(0, finite(
        options.carbonDioxideCarbonKgCm2, REFERENCE_CO2_CARBON_KG_C_M2)),
      oxygenKgO2m2: Math.max(0, finite(options.oxygenKgO2m2,
        REFERENCE_OXYGEN_KG_O2_M2)),
      nitrogenGasKgNm2: Math.max(0, finite(options.nitrogenGasKgNm2,
        REFERENCE_NITROGEN_GAS_KG_N_M2))
    }),
    carbonDioxideCarbonKgCm2: 0,
    oxygenKgO2m2: 0,
    nitrogenGasKgNm2: 0,
    co2Ppm: REFERENCE_CO2_PPM,
    oxygenFractionProxy: .2095,
    cumulative: {
      landCarbonExchangeKgCm2: 0,
      oceanCarbonExchangeKgCm2: 0,
      oceanOxygenExchangeKgO2m2: 0,
      estuaryNitrogenGasInputKgNm2: 0,
      floodplainDenitrificationNitrogenGasInputKgNm2: 0,
      floodplainCarbonInputKgCm2: 0,
      floodplainOxygenOutputKgO2m2: 0,
      horizontalCarbonThroughputKgCm2: 0,
      horizontalOxygenThroughputKgO2m2: 0,
      horizontalNitrogenThroughputKgNm2: 0,
      verticalCarbonThroughputKgCm2: 0,
      verticalOxygenThroughputKgO2m2: 0,
      verticalNitrogenThroughputKgNm2: 0
    },
    migrationCheckpoint: options.migrationCheckpoint === true,
    migrationSourceSchema: options.migrationSourceSchema || null,
    lastBiosphereFluxReceipt: null,
    lastBoundaryInputReceipt: null,
    lastFloodplainGasExchangeReceipt: null,
    lastHorizontalTransportReceipt: null,
    lastVerticalTransportReceipt: null,
    truth: {
      authoritativeLocalGasReservoir: true,
      ecologyAtmosphereFieldsAreCompatibilityMirrors: true,
      nativePressureLayerComposition: true,
      layerCount: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
      surfaceExchangeLayerIndex: 0,
      horizontalTransportEnabled: true,
      horizontallyTransported: false,
      verticalTransportEnabled: true,
      verticallyTransported: false,
      globallyMixed: false
    }
  }, options.pressureColumn);
}

export function normalizeAtmosphereBiogeochemistry(source, options = {}) {
  const currentOrLegacy = source && [
    ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
    PREVIOUS_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
    LEGACY_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
    OLDEST_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA
  ].includes(source.schema);
  if (!currentOrLegacy) {
    const mirrors = compatibilityMirrors(options.landEcology,
      options.oceanEcology);
    return createAtmosphereBiogeochemistry({
      ...mirrors,
      pressureColumn: options.pressureColumn,
      migrationCheckpoint: true,
      migrationSourceSchema: source?.schema || null
    });
  }
  const state = createAtmosphereBiogeochemistry({
    layers: [ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
      PREVIOUS_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA]
      .includes(source.schema)
      ? source.layers : null,
    pressureColumn: options.pressureColumn,
    carbonDioxideCarbonKgCm2: source.carbonDioxideCarbonKgCm2,
    oxygenKgO2m2: source.oxygenKgO2m2,
    nitrogenGasKgNm2: source.nitrogenGasKgNm2,
    migrationCheckpoint: source.schema !==
      ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA ||
      source.migrationCheckpoint === true,
    migrationSourceSchema: source.schema !==
      ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA
      ? source.schema : source.migrationSourceSchema
  });
  for (const key of Object.keys(state.cumulative)) {
    state.cumulative[key] = Math.max(0, finite(source.cumulative?.[key]));
  }
  state.lastBiosphereFluxReceipt = source.lastBiosphereFluxReceipt?.schema ===
    ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA
    ? clone(source.lastBiosphereFluxReceipt) : null;
  state.lastBoundaryInputReceipt = source.lastBoundaryInputReceipt?.schema ===
    ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA
    ? clone(source.lastBoundaryInputReceipt) : null;
  state.lastFloodplainGasExchangeReceipt =
    source.lastFloodplainGasExchangeReceipt?.schema ===
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA
      ? clone(source.lastFloodplainGasExchangeReceipt) : null;
  state.lastHorizontalTransportReceipt =
    source.lastHorizontalTransportReceipt?.schema ===
      ATMOSPHERE_BIOGEOCHEMISTRY_HORIZONTAL_LOCAL_RECEIPT_SCHEMA
      ? clone(source.lastHorizontalTransportReceipt) : null;
  state.lastVerticalTransportReceipt =
    source.lastVerticalTransportReceipt?.schema ===
      ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA
      ? clone(source.lastVerticalTransportReceipt) : null;
  state.truth.horizontallyTransported =
    state.lastHorizontalTransportReceipt?.status === 'transported';
  state.truth.verticallyTransported =
    state.lastVerticalTransportReceipt?.status === 'transported';
  return refreshAtmosphereBiogeochemistry(state, options.pressureColumn);
}

export function synchronizeAtmosphereCompatibilityMirrors(source,
  landEcology, oceanEcology, options = {}) {
  const state = normalizeAtmosphereBiogeochemistry(source, {
    landEcology, oceanEcology, pressureColumn: options.pressureColumn
  });
  if (landEcology?.carbon) {
    landEcology.carbon.atmosphericExchangeableKgCm2 =
      state.carbonDioxideCarbonKgCm2;
    landEcology.carbon.co2PpmProxy = state.co2Ppm;
  }
  if (oceanEcology?.carbon) {
    oceanEcology.carbon.atmosphericExchangeableKgCm2 =
      state.carbonDioxideCarbonKgCm2;
    oceanEcology.carbon.co2PpmProxy = state.co2Ppm;
  }
  if (oceanEcology?.oxygen) {
    oceanEcology.oxygen.atmosphericExchangeableKgO2m2 = state.oxygenKgO2m2;
  }
  return state;
}

export function reconcileAtmosphereBiosphereGases(source, landEcology,
  oceanEcology, durationDays = 1, options = {}) {
  const duration = finite(durationDays);
  if (!(duration > 0) || duration > 1.000001) {
    throw new Error('Atmosphere-biosphere gas step must be greater than zero and no longer than one day');
  }
  const state = normalizeAtmosphereBiogeochemistry(source, {
    landEcology, oceanEcology, pressureColumn: options.pressureColumn
  });
  const initial = {
    carbonDioxideCarbonKgCm2: state.carbonDioxideCarbonKgCm2,
    oxygenKgO2m2: state.oxygenKgO2m2,
    nitrogenGasKgNm2: state.nitrogenGasKgNm2
  };
  const mirrors = compatibilityMirrors(landEcology, oceanEcology);
  const carbonExchangeKgCm2 = mirrors.carbonDioxideCarbonKgCm2 -
    initial.carbonDioxideCarbonKgCm2;
  const oxygenExchangeKgO2m2 = mirrors.oxygenKgO2m2 -
    initial.oxygenKgO2m2;
  const initialSurfaceLayer = clone(state.layers[0]);
  const carbonApplication = applySurfaceDelta(state,
    'carbonDioxideCarbonKgCm2', carbonExchangeKgCm2);
  const oxygenApplication = applySurfaceDelta(state,
    'oxygenKgO2m2', oxygenExchangeKgO2m2);
  if (landEcology) state.cumulative.landCarbonExchangeKgCm2 +=
    Math.abs(carbonExchangeKgCm2);
  if (oceanEcology) {
    state.cumulative.oceanCarbonExchangeKgCm2 += Math.abs(carbonExchangeKgCm2);
    state.cumulative.oceanOxygenExchangeKgO2m2 += Math.abs(oxygenExchangeKgO2m2);
  }
  state.migrationCheckpoint = false;
  state.migrationSourceSchema = null;
  refreshAtmosphereBiogeochemistry(state, options.pressureColumn);
  const receipt = {
    schema: ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA,
    status: landEcology ? 'land-atmosphere-reconciled' :
      oceanEcology ? 'ocean-atmosphere-reconciled' : 'abiotic-no-op',
    durationDays: round(duration, 8),
    initial: Object.fromEntries(Object.entries(initial)
      .map(([key, value]) => [key, round(value)])),
    exchanges: {
      ecologyCarbonToAtmosphereKgCm2: round(carbonApplication.applied),
      oceanOxygenToAtmosphereKgO2m2: round(oxygenApplication.applied)
    },
    nativeLayerReceiver: {
      primaryLayerIndex: 0,
      carbonAffectedLayerIndices: carbonApplication.affectedLayerIndices,
      oxygenAffectedLayerIndices: oxygenApplication.affectedLayerIndices,
      initialSurfaceLayer,
      finalSurfaceLayer: clone(state.layers[0])
    },
    final: {
      carbonDioxideCarbonKgCm2: round(state.carbonDioxideCarbonKgCm2),
      oxygenKgO2m2: round(state.oxygenKgO2m2),
      nitrogenGasKgNm2: round(state.nitrogenGasKgNm2),
      co2Ppm: state.co2Ppm,
      oxygenFractionProxy: state.oxygenFractionProxy
    },
    conservation: {
      carbonResidualKgCm2: round(state.carbonDioxideCarbonKgCm2 -
        initial.carbonDioxideCarbonKgCm2 - carbonExchangeKgCm2),
      oxygenResidualKgO2m2: round(state.oxygenKgO2m2 -
        initial.oxygenKgO2m2 - oxygenExchangeKgO2m2),
      nitrogenResidualKgNm2: round(state.nitrogenGasKgNm2 -
        initial.nitrogenGasKgNm2)
    },
    truth: {
      authoritativeLocalGasReservoir: true,
      compatibilityMirrorsSynchronized: true,
      ecologyGasExchangeReceipted: true,
      nativePressureLayerComposition: true,
      surfaceLayerCoupled: true,
      horizontalTransportEnabled: true,
      horizontallyTransported: state.truth.horizontallyTransported,
      verticalTransportEnabled: true,
      verticallyTransported: state.truth.verticallyTransported,
      globallyMixed: false
    }
  };
  state.lastBiosphereFluxReceipt = receipt;
  return { state, receipt: clone(receipt) };
}

export function applyAtmosphereGasBoundaryInput(source, inputs = {},
  areaM2 = 1, options = {}) {
  const state = normalizeAtmosphereBiogeochemistry(source, {
    pressureColumn: options.pressureColumn
  });
  const area = Math.max(1, finite(areaM2, 1));
  const carbonKgC = Math.max(0, finite(inputs.carbonKgC));
  const oxygenKgO2 = Math.max(0, finite(inputs.oxygenKgO2));
  const nitrogenKgN = Math.max(0, finite(inputs.nitrogenKgN));
  const sourceKind = String(options.sourceKind ||
    'named-external-boundary');
  const transferId = String(options.transferId || '');
  const sourceReachId = String(options.sourceReachId || '');
  const sourceReceiptDigest = String(options.sourceReceiptDigest || '');
  if (sourceKind === 'floodplain-denitrification' &&
    (!transferId || !sourceReachId || !sourceReceiptDigest ||
      carbonKgC + oxygenKgO2 > 1e-12)) {
    throw new Error('Floodplain denitrification atmosphere input requires nitrogen-only bound source evidence');
  }
  state.layers[0].carbonDioxideCarbonKgCm2 += carbonKgC / area;
  state.layers[0].oxygenKgO2m2 += oxygenKgO2 / area;
  state.layers[0].nitrogenGasKgNm2 += nitrogenKgN / area;
  if (sourceKind === 'estuary-denitrification') {
    state.cumulative.estuaryNitrogenGasInputKgNm2 += nitrogenKgN / area;
  }
  if (sourceKind === 'floodplain-denitrification') {
    state.cumulative.floodplainDenitrificationNitrogenGasInputKgNm2 +=
      nitrogenKgN / area;
  }
  refreshAtmosphereBiogeochemistry(state, options.pressureColumn);
  const receipt = {
    schema: ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA,
    status: 'credited',
    sourceKind,
    transferId: transferId || null,
    sourceReachId: sourceReachId || null,
    sourceReceiptDigest: sourceReceiptDigest || null,
    receivingAreaM2: round(area, 3),
    inputs: {
      carbonKgC: round(carbonKgC, 9),
      oxygenKgO2: round(oxygenKgO2, 9),
      nitrogenKgN: round(nitrogenKgN, 9)
    },
    receiverCredits: {
      nativeLayerIndex: 0,
      carbonKgCm2: round(carbonKgC / area),
      oxygenKgO2m2: round(oxygenKgO2 / area),
      nitrogenKgNm2: round(nitrogenKgN / area)
    },
    conservation: {
      carbonResidualKgC: 0,
      oxygenResidualKgO2: 0,
      nitrogenResidualKgN: 0
    },
    truth: {
      persistentAtmosphericReceiver: true,
      nativePressureLayerComposition: true,
      surfaceLayerCoupled: true,
      horizontalTransportEnabled: true,
      horizontallyTransported: state.truth.horizontallyTransported,
      verticalTransportEnabled: true,
      verticallyTransported: state.truth.verticallyTransported,
      globallyMixed: false,
      exactTransferIdentity: sourceKind === 'floodplain-denitrification'
        ? Boolean(transferId && sourceReachId && sourceReceiptDigest) : true
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastBoundaryInputReceipt = clone(receipt);
  return { state, receipt: clone(receipt) };
}

export function applyAtmosphereFloodplainGasExchange(source, exchange = {},
  areaM2 = 1, options = {}) {
  const state = normalizeAtmosphereBiogeochemistry(source, {
    pressureColumn: options.pressureColumn
  });
  const exchangeId = String(options.exchangeId || '');
  const reachId = String(options.reachId || '');
  const atmosphereCellId = String(options.atmosphereCellId || '');
  if (!exchangeId || !reachId || !atmosphereCellId) {
    throw new Error('Atmosphere-floodplain gas exchange requires exchange, reach and cell IDs');
  }
  const area = Math.max(1, finite(areaM2, 1));
  const carbonToAtmosphereKgC = Math.max(0, finite(
    exchange.carbonToAtmosphereKgC));
  const carbonToFloodplainKgC = Math.max(0, finite(
    exchange.carbonToFloodplainKgC));
  const oxygenToFloodplainKgO2 = Math.max(0, finite(
    exchange.oxygenToFloodplainKgO2));
  if (carbonToAtmosphereKgC > 1e-12 &&
    carbonToFloodplainKgC > 1e-12) {
    throw new Error('Atmosphere-floodplain carbon direction must be exclusive');
  }
  const carbonCreditKgCm2 = carbonToAtmosphereKgC / area;
  const carbonDebitKgCm2 = carbonToFloodplainKgC / area;
  const oxygenDebitKgO2m2 = oxygenToFloodplainKgO2 / area;
  const before = {
    carbonDioxideCarbonKgCm2: state.carbonDioxideCarbonKgCm2,
    oxygenKgO2m2: state.oxygenKgO2m2,
    surfaceLayer: clone(state.layers[0])
  };
  if (oxygenDebitKgO2m2 > state.layers[0].oxygenKgO2m2 + 1e-12) {
    throw new Error('Atmosphere-floodplain gas exchange cannot overdraw surface-layer oxygen');
  }
  if (carbonDebitKgCm2 >
    state.layers[0].carbonDioxideCarbonKgCm2 + 1e-12) {
    throw new Error('Atmosphere-floodplain gas exchange cannot overdraw surface-layer carbon dioxide');
  }
  state.layers[0].carbonDioxideCarbonKgCm2 = Math.max(0,
    state.layers[0].carbonDioxideCarbonKgCm2 + carbonCreditKgCm2 -
      carbonDebitKgCm2);
  state.layers[0].oxygenKgO2m2 = Math.max(0,
    state.layers[0].oxygenKgO2m2 - oxygenDebitKgO2m2);
  state.cumulative.floodplainCarbonInputKgCm2 += carbonCreditKgCm2;
  state.cumulative.floodplainOxygenOutputKgO2m2 += oxygenDebitKgO2m2;
  refreshAtmosphereBiogeochemistry(state, options.pressureColumn);
  const operandsKg = {
    carbon: {
      beforeKgC: before.carbonDioxideCarbonKgCm2 * area,
      creditKgC: carbonToAtmosphereKgC,
      debitKgC: carbonToFloodplainKgC,
      afterKgC: state.carbonDioxideCarbonKgCm2 * area
    },
    oxygen: {
      beforeKgO2: before.oxygenKgO2m2 * area,
      debitKgO2: oxygenToFloodplainKgO2,
      afterKgO2: state.oxygenKgO2m2 * area
    }
  };
  const conservationIdentities = {
    carbonResidualKgC: round(
      operandsKg.carbon.afterKgC - operandsKg.carbon.beforeKgC -
        operandsKg.carbon.creditKgC + operandsKg.carbon.debitKgC, 12),
    oxygenResidualKgO2: round(
      operandsKg.oxygen.beforeKgO2 - operandsKg.oxygen.afterKgO2 -
        operandsKg.oxygen.debitKgO2, 12)
  };
  const numericToleranceKg = {
    carbonResidualKgC:
      atmosphereFloodplainGasExchangeMassClosureToleranceKg('carbonKgC',
        operandsKg.carbon.beforeKgC, operandsKg.carbon.creditKgC,
        operandsKg.carbon.debitKgC, operandsKg.carbon.afterKgC),
    oxygenResidualKgO2:
      atmosphereFloodplainGasExchangeMassClosureToleranceKg('oxygenKgO2',
        operandsKg.oxygen.beforeKgO2, operandsKg.oxygen.debitKgO2,
        operandsKg.oxygen.afterKgO2)
  };
  const numericClosure = atmosphereFloodplainGasNumericClosure(
    conservationIdentities, numericToleranceKg);
  const receipt = {
    schema: ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    exchangeId,
    reachId,
    atmosphereCellId,
    status: carbonToAtmosphereKgC + carbonToFloodplainKgC +
      oxygenToFloodplainKgO2 > 1e-12
      ? 'surface-layer-gases-exchanged' : 'surface-layer-no-op',
    receivingAreaM2: round(area, 3),
    exchange: {
      carbonToAtmosphereKgC: round(carbonToAtmosphereKgC, 9),
      carbonToFloodplainKgC: round(carbonToFloodplainKgC, 9),
      oxygenToFloodplainKgO2: round(oxygenToFloodplainKgO2, 9)
    },
    atmosphereCarbonCredit: {
      reservoir: 'atmosphere-surface-layer-carbon-dioxide-carbon',
      nativeLayerIndex: 0,
      carbonKgC: round(carbonToAtmosphereKgC, 9),
      carbonKgCm2: round(carbonCreditKgCm2, 15)
    },
    atmosphereCarbonDebit: {
      reservoir: 'atmosphere-surface-layer-carbon-dioxide-carbon',
      nativeLayerIndex: 0,
      carbonKgC: round(carbonToFloodplainKgC, 9),
      carbonKgCm2: round(carbonDebitKgCm2, 15)
    },
    atmosphereOxygenDebit: {
      reservoir: 'atmosphere-surface-layer-oxygen',
      nativeLayerIndex: 0,
      oxygenKgO2: round(oxygenToFloodplainKgO2, 9),
      oxygenKgO2m2: round(oxygenDebitKgO2m2, 15)
    },
    before: {
      carbonDioxideCarbonKgCm2: round(
        before.carbonDioxideCarbonKgCm2, 12),
      oxygenKgO2m2: round(before.oxygenKgO2m2, 12),
      surfaceLayer: before.surfaceLayer
    },
    after: {
      carbonDioxideCarbonKgCm2: round(
        state.carbonDioxideCarbonKgCm2, 12),
      oxygenKgO2m2: round(state.oxygenKgO2m2, 12),
      surfaceLayer: clone(state.layers[0])
    },
    conservation: {
      ...numericClosure.conservation,
      operandsKg
    },
    truth: {
      authoritativeLocalGasReservoirMutated: true,
      nativePressureLayerComposition: true,
      surfaceLayerOnly: true,
      carbonReceiverCreditedWhenEvasion: true,
      carbonSenderDebitedWhenInvasion: true,
      oxygenSenderDebited: true,
      carbonDirectionExclusive:
        carbonToAtmosphereKgC <= 1e-12 ||
          carbonToFloodplainKgC <= 1e-12,
      carbonAndOxygenClosed: numericClosure.allIdentitiesClosed,
      scaleAwareFloatingPointClosure: numericClosure.allIdentitiesClosed,
      perIdentityNumericBounds: true,
      measuredResidualsPreserved: true,
      fixedAbsoluteToleranceOnly: false,
      floatingPointAbsoluteFloorKg:
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_ABSOLUTE_TOLERANCE_KG,
      floodplainOwnerReceiptRequired: true,
      globallyMixed: false,
      independentCarbonCreation: false,
      independentOxygenCreation: false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastFloodplainGasExchangeReceipt = clone(receipt);
  return { state, receipt: clone(receipt) };
}

export function atmosphereBiogeochemistryDescription() {
  return {
    stateSchema: ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
    biosphereFluxReceiptSchema: ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA,
    boundaryInputReceiptSchema: ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA,
    floodplainGasExchangeReceiptSchema:
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    previousFloodplainGasExchangeReceiptSchema:
      PREVIOUS_ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    floodplainGasExchangeAbsoluteToleranceKg:
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_ABSOLUTE_TOLERANCE_KG,
    floodplainGasExchangeMassClosurePolicySchema:
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
    floodplainGasExchangeMassClosureAbsoluteFloorsKg: {
      ...ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
    },
    floodplainGasExchangeMassClosureUlpFactor:
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
    horizontalLocalReceiptSchema:
      ATMOSPHERE_BIOGEOCHEMISTRY_HORIZONTAL_LOCAL_RECEIPT_SCHEMA,
    layerSchema: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA,
    layerCount: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
    verticalTransportReceiptSchema:
      ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA,
    verticalInterfaceReceiptSchema:
      ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_INTERFACE_SCHEMA,
    reservoirs: ['carbon-dioxide-carbon', 'oxygen', 'nitrogen-gas'],
    ecologyProxyFieldsAreCompatibilityMirrors: true,
    persistentLocalReservoirs: true,
    nativePressureLayerComposition: true,
    surfaceExchangeLayerIndex: 0,
    verticalTransport: 'seven-native-adjacent-dry-air-interfaces',
    horizontalTransport: 'loaded-native-dry-air-routes',
    globalMixing: false,
    scientificAtmosphericChemistry: false
  };
}
