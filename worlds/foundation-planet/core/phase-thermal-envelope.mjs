export const ATMOSPHERE_PHASE_THERMAL_ENVELOPE_SCHEMA =
  'axm.foundation-planet.atmosphere-phase-thermal-envelope/v1';

export const MIN_NATIVE_LAYER_AIR_TEMPERATURE_C = -120;
export const MAX_NATIVE_LAYER_AIR_TEMPERATURE_C = 70;

const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;

export function boundPhaseChangeByThermalHeadroom({
  requestedMm,
  airTemperatureC,
  heatCapacityJm2K,
  latentHeatJkg,
  direction
} = {}) {
  const requested = Math.max(0, finite(requestedMm));
  const temperature = finite(airTemperatureC);
  const capacity = Math.max(1, finite(heatCapacityJm2K, 1));
  const latentHeat = Math.max(1, finite(latentHeatJkg, 1));
  if (!['warming', 'cooling'].includes(direction)) {
    throw new Error('Phase thermal headroom requires warming or cooling direction');
  }
  const sourceWithinEnvelope = temperature >=
      MIN_NATIVE_LAYER_AIR_TEMPERATURE_C - 1e-12 &&
    temperature <= MAX_NATIVE_LAYER_AIR_TEMPERATURE_C + 1e-12;
  const headroomK = direction === 'warming'
    ? Math.max(0, MAX_NATIVE_LAYER_AIR_TEMPERATURE_C - temperature)
    : Math.max(0, temperature - MIN_NATIVE_LAYER_AIR_TEMPERATURE_C);
  const maximumMm = sourceWithinEnvelope
    ? headroomK * capacity / latentHeat : 0;
  const appliedMm = Math.min(requested, maximumMm);
  const temperatureChangeC = appliedMm * latentHeat / capacity *
    (direction === 'warming' ? 1 : -1);
  return {
    schema: ATMOSPHERE_PHASE_THERMAL_ENVELOPE_SCHEMA,
    direction,
    requestedMm: requested,
    appliedMm,
    limitedMm: Math.max(0, requested - appliedMm),
    initialAirTemperatureC: temperature,
    finalAirTemperatureC: temperature + temperatureChangeC,
    heatCapacityJm2K: capacity,
    latentHeatJkg: latentHeat,
    temperatureHeadroomK: headroomK,
    minimumAirTemperatureC: MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
    maximumAirTemperatureC: MAX_NATIVE_LAYER_AIR_TEMPERATURE_C,
    truth: {
      sourceWithinEnvelope,
      appliedWithinThermalHeadroom: appliedMm <= maximumMm + 1e-12,
      materialMovePrecedesNoTemperatureClip: true,
      scientificCloudMicrophysics: false
    }
  };
}

export function phaseThermalEnvelopeDescription() {
  return {
    schema: ATMOSPHERE_PHASE_THERMAL_ENVELOPE_SCHEMA,
    minimumAirTemperatureC: MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
    maximumAirTemperatureC: MAX_NATIVE_LAYER_AIR_TEMPERATURE_C,
    boundedProcesses: [
      'condensation-and-deposition-warming',
      'evaporation-and-sublimation-cooling',
      'freezing-warming',
      'melting-cooling'
    ],
    refusalBehavior: 'unsupported phase-change mass remains in its source phase',
    resolvedCloudMicrophysics: false,
    scientificForecast: false
  };
}
