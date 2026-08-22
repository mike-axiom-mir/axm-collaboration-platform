import {
  MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
  MAX_NATIVE_LAYER_AIR_TEMPERATURE_C
} from './phase-thermal-envelope.mjs';

export const ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA =
  'axm.foundation-planet.atmosphere-boundary-energy-receipt/v1';

const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));

function moistEnthalpy(receipt, side) {
  const value = receipt?.[side]?.moistEnthalpyJm2;
  if (!Number.isFinite(Number(value))) {
    throw new Error(`Atmosphere boundary energy requires ${side} native moist enthalpy`);
  }
  return Number(value);
}

export function createAtmosphereBoundaryEnergyReceipt({
  atmosphereUpdate,
  compatibilityInputSyncReceipt,
  atmosphericBoundarySyncReceipt,
  pressureColumn
} = {}) {
  const compatibilityInitialMoistEnthalpyJm2 = finite(
    atmosphereUpdate?.initialMoistEnthalpyJm2,
    NaN
  );
  const compatibilityRequestedFinalMoistEnthalpyJm2 = finite(
    atmosphereUpdate?.afterBoundaryMoistEnthalpyJm2,
    NaN
  );
  if (!Number.isFinite(compatibilityInitialMoistEnthalpyJm2) ||
      !Number.isFinite(compatibilityRequestedFinalMoistEnthalpyJm2)) {
    throw new Error('Atmosphere boundary energy requires requested compatibility enthalpy');
  }
  const nativeInitialMoistEnthalpyJm2 = moistEnthalpy(
    compatibilityInputSyncReceipt,
    'finalTotals'
  );
  const nativeFinalMoistEnthalpyJm2 = moistEnthalpy(
    atmosphericBoundarySyncReceipt,
    'finalTotals'
  );
  const requestedBoundaryMoistEnthalpyJm2 =
    compatibilityRequestedFinalMoistEnthalpyJm2 -
    compatibilityInitialMoistEnthalpyJm2;
  const appliedBoundaryMoistEnthalpyJm2 = nativeFinalMoistEnthalpyJm2 -
    nativeInitialMoistEnthalpyJm2;
  const initialCompatibilityProjectionAdjustmentJm2 =
    nativeInitialMoistEnthalpyJm2 - compatibilityInitialMoistEnthalpyJm2;
  const finalCompatibilityProjectionAdjustmentJm2 =
    nativeFinalMoistEnthalpyJm2 - compatibilityRequestedFinalMoistEnthalpyJm2;
  const nativeEnvelopeReconciliationJm2 = appliedBoundaryMoistEnthalpyJm2 -
    requestedBoundaryMoistEnthalpyJm2;
  const ledgerResidualJm2 = appliedBoundaryMoistEnthalpyJm2 -
    requestedBoundaryMoistEnthalpyJm2 - nativeEnvelopeReconciliationJm2;
  const layers = Array.isArray(pressureColumn?.layers) ? pressureColumn.layers : [];
  const nativeEnvelopeLimitedLayerIds = layers.filter(layer =>
    finite(layer?.airTemperatureC) <= MIN_NATIVE_LAYER_AIR_TEMPERATURE_C + 1e-9 ||
    finite(layer?.airTemperatureC) >= MAX_NATIVE_LAYER_AIR_TEMPERATURE_C - 1e-9
  ).map(layer => String(layer.id));
  const layersWithinEnvelope = layers.length > 0 && layers.every(layer =>
    finite(layer?.airTemperatureC, NaN) >= MIN_NATIVE_LAYER_AIR_TEMPERATURE_C - 1e-9 &&
    finite(layer?.airTemperatureC, NaN) <= MAX_NATIVE_LAYER_AIR_TEMPERATURE_C + 1e-9
  );
  return {
    schema: ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA,
    compatibilityInitialMoistEnthalpyJm2: round(
      compatibilityInitialMoistEnthalpyJm2
    ),
    compatibilityRequestedFinalMoistEnthalpyJm2: round(
      compatibilityRequestedFinalMoistEnthalpyJm2
    ),
    nativeInitialMoistEnthalpyJm2: round(nativeInitialMoistEnthalpyJm2),
    nativeFinalMoistEnthalpyJm2: round(nativeFinalMoistEnthalpyJm2),
    requestedBoundaryMoistEnthalpyJm2: round(
      requestedBoundaryMoistEnthalpyJm2
    ),
    appliedBoundaryMoistEnthalpyJm2: round(appliedBoundaryMoistEnthalpyJm2),
    initialCompatibilityProjectionAdjustmentJm2: round(
      initialCompatibilityProjectionAdjustmentJm2
    ),
    finalCompatibilityProjectionAdjustmentJm2: round(
      finalCompatibilityProjectionAdjustmentJm2
    ),
    nativeEnvelopeReconciliationJm2: round(nativeEnvelopeReconciliationJm2),
    boundarySyncMoistEnthalpyResidualJm2: round(
      finite(atmosphericBoundarySyncReceipt?.residuals?.moistEnthalpyJm2)
    ),
    ledgerResidualJm2: round(ledgerResidualJm2),
    nativeEnvelope: {
      minimumAirTemperatureC: MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
      maximumAirTemperatureC: MAX_NATIVE_LAYER_AIR_TEMPERATURE_C,
      limitedLayerCount: nativeEnvelopeLimitedLayerIds.length,
      limitedLayerIds: nativeEnvelopeLimitedLayerIds
    },
    truth: {
      requestedAndAppliedBoundaryForcingDistinguished: true,
      nativeEnvelopeReconciliationReceipted: true,
      ledgerClosed: Math.abs(ledgerResidualJm2) < 1,
      nativeLayersWithinDeclaredEnvelope: layersWithinEnvelope,
      scientificBoundaryLayerModel: false
    }
  };
}

export function atmosphereBoundaryEnergyDescription() {
  return {
    schema: ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA,
    authority: 'native-pressure-column-before-and-after-prescribed-boundary-forcing',
    distinguishes: [
      'requested-compatibility-boundary-moist-enthalpy',
      'applied-native-boundary-moist-enthalpy',
      'native-temperature-envelope-reconciliation'
    ],
    minimumNativeLayerAirTemperatureC: MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
    maximumNativeLayerAirTemperatureC: MAX_NATIVE_LAYER_AIR_TEMPERATURE_C,
    scientificBoundaryLayerModel: false
  };
}
