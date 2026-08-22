import { CONDITION_PROFILES, PLANET_DEFAULTS } from './planet-model.mjs';
import {
  ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
  ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT,
  ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA,
  PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG,
  createPressureColumnFromLegacy,
  pressureColumnDescription,
  reconcilePressureColumnWithLegacy,
  restorePressureColumn,
  validatePressureColumn
} from './pressure-column.mjs';
import {
  ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_PHASE_SCHEMA,
  ATMOSPHERE_ADJACENT_LAYER_EXCHANGE_SCHEMA,
  ATMOSPHERE_PRESSURE_INTERFACE_BUOYANCY_SCHEMA,
  ATMOSPHERE_PRECIPITATION_DESCENT_SCHEMA,
  advancePressureColumnDynamics,
  pressureDynamicsDescription
} from './pressure-dynamics.mjs';
import {
  MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
  MAX_NATIVE_LAYER_AIR_TEMPERATURE_C,
  phaseThermalEnvelopeDescription
} from './phase-thermal-envelope.mjs';
import {
  ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA,
  createAtmosphereBoundaryEnergyReceipt,
  atmosphereBoundaryEnergyDescription
} from './atmosphere-boundary-energy.mjs';
import {
  ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA,
  pressureHorizontalTransportDescription
} from './pressure-transport.mjs';
import {
  EARTH_SURFACE_RADIATION_SCHEMA,
  PREVIOUS_EARTH_SURFACE_RADIATION_SCHEMA,
  EARTH_CLOUD_OPTICS_SCHEMA,
  computeSurfaceRadiation,
  surfaceAlbedo,
  surfaceRadiationDescription
} from './surface-radiation.mjs?v=0.62.0-r62.1';
import {
  ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA,
  atmosphereCo2RadiationDescription
} from './atmosphere-co2-radiation.mjs?v=0.62.0-r62.1';
import {
  EARTH_LAND_ECOLOGY_SCHEMA,
  EARTH_LAND_ECOLOGY_FLUX_SCHEMA,
  createLandEcology,
  normalizeLandEcology,
  landEcologyWaterDemand,
  advanceLandEcology,
  landEcologyDescription
} from './land-ecology.mjs';
import {
  EARTH_OCEAN_ECOLOGY_SCHEMA,
  EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA,
  EARTH_OCEAN_ECOLOGY_RIVER_INPUT_SCHEMA,
  EARTH_OCEAN_ECOLOGY_RUNOFF_INPUT_SCHEMA,
  createOceanEcology,
  normalizeOceanEcology,
  advanceOceanEcology,
  oceanEcologyDescription
} from './ocean-ecology.mjs';
import {
  DEEP_OCEAN_STATE_SCHEMA,
  PREVIOUS_DEEP_OCEAN_STATE_SCHEMA,
  DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA,
  PREVIOUS_DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA
} from './deep-ocean.mjs';
import {
  ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
  ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA,
  ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA,
  atmosphereBiogeochemistryDescription,
  createAtmosphereBiogeochemistry,
  normalizeAtmosphereBiogeochemistry,
  reconcileAtmosphereBiosphereGases,
  synchronizeAtmosphereCompatibilityMirrors
} from './atmosphere-biogeochemistry.mjs?v=0.62.0-r62.1';
import {
  atmosphereBiogeochemistryVerticalDescription,
  transportAtmosphereBiogeochemistryVertically
} from './atmosphere-biogeochemistry-vertical.mjs?v=0.62.0-r62.1';
import {
  SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA,
  PREVIOUS_SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA,
  RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA,
  SOIL_RUNOFF_MOBILIZATION_SCHEMA,
  RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA,
  createSoilBiogeochemistry,
  emptyMigratedSoilBiogeochemistry,
  normalizeSoilBiogeochemistry,
  emptyRunoffBiogeochemistryQueue,
  normalizeRunoffBiogeochemistryQueue,
  mobilizeSoilBiogeochemistry,
  soilBiogeochemistryDescription
} from './soil-biogeochemistry.mjs';
import {
  SURFACE_SEDIMENT_STATE_SCHEMA,
  RUNOFF_SEDIMENT_QUEUE_SCHEMA,
  SURFACE_EROSION_RECEIPT_SCHEMA,
  COASTAL_SEDIMENT_STATE_SCHEMA,
  createSurfaceSediment,
  emptyMigratedSurfaceSediment,
  normalizeSurfaceSediment,
  emptyRunoffSedimentQueue,
  normalizeRunoffSedimentQueue,
  emptyCoastalSediment,
  normalizeCoastalSediment,
  erodeSurfaceSediment,
  geomorphicSedimentDescription
} from './geomorphic-sediment.mjs?v=0.63.0-r63.1';

export {
  ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
  ATMOSPHERE_PRESSURE_COLUMN_INTERFACE_COUNT,
  ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_PHASE_SCHEMA,
  ATMOSPHERE_ADJACENT_LAYER_EXCHANGE_SCHEMA,
  ATMOSPHERE_PRESSURE_INTERFACE_BUOYANCY_SCHEMA,
  ATMOSPHERE_PRECIPITATION_DESCENT_SCHEMA,
  ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA,
  EARTH_SURFACE_RADIATION_SCHEMA,
  PREVIOUS_EARTH_SURFACE_RADIATION_SCHEMA,
  EARTH_CLOUD_OPTICS_SCHEMA,
  ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA,
  EARTH_LAND_ECOLOGY_SCHEMA,
  EARTH_LAND_ECOLOGY_FLUX_SCHEMA,
  EARTH_OCEAN_ECOLOGY_SCHEMA,
  EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA,
  EARTH_OCEAN_ECOLOGY_RIVER_INPUT_SCHEMA,
  EARTH_OCEAN_ECOLOGY_RUNOFF_INPUT_SCHEMA,
  DEEP_OCEAN_STATE_SCHEMA,
  PREVIOUS_DEEP_OCEAN_STATE_SCHEMA,
  DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA,
  PREVIOUS_DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
  ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA,
  ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA,
  SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA,
  RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA,
  SOIL_RUNOFF_MOBILIZATION_SCHEMA,
  RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA,
  SURFACE_SEDIMENT_STATE_SCHEMA,
  RUNOFF_SEDIMENT_QUEUE_SCHEMA,
  SURFACE_EROSION_RECEIPT_SCHEMA,
  COASTAL_SEDIMENT_STATE_SCHEMA
};

export const EARTH_SYSTEM_COLUMN_SCHEMA = 'axm.foundation-planet.earth-system-column/v1';
export const EARTH_SYSTEM_ENGINE_SCHEMA = 'axm.foundation-planet.earth-system-engine/v32';
export const PREVIOUS_EARTH_SYSTEM_ENGINE_SCHEMA =
  'axm.foundation-planet.earth-system-engine/v31';
export const EARTH_SYSTEM_FLUX_SCHEMA = 'axm.foundation-planet.earth-system-flux/v4';
const COMPATIBLE_EARTH_TRANSPORT_RECEIPT_SCHEMA =
  'axm.foundation-planet.earth-transport-step/v12';
export const EARTH_CRYOSPHERE_PHASE_SCHEMA =
  'axm.foundation-planet.cryosphere-phase-receipt/v1';
export const EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA = 'axm.foundation-planet.atmosphere-phase-change-receipt/v3';
export const EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA = 'axm.foundation-planet.atmosphere-vertical-exchange-receipt/v3';
export const EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA = 'axm.foundation-planet.free-troposphere-phase-receipt/v3';
export const EARTH_FREE_TROPOSPHERE_SCHEMA = 'axm.foundation-planet.free-troposphere/v2';
const EARTH_FREE_TROPOSPHERE_LEGACY_SCHEMA = 'axm.foundation-planet.free-troposphere/v1';

const DAY_SECONDS = 86_400;
const WATER_DENSITY_KG_M3 = 1000;
const ICE_DENSITY_KG_M3 = 917;
const WATER_HEAT_CAPACITY_J_M3_K = 4.186e6;
const ATMOSPHERE_HEAT_CAPACITY_J_M2_K = 1.02e7;
const LATENT_HEAT_VAPORIZATION_J_KG = 2.45e6;
const MIN_ATMOSPHERIC_WATER_MM = .2;
const MAX_ATMOSPHERIC_WATER_MM = 75;
const MAX_CLOUD_WATER_MM = 12;
const MAX_FREE_TROPOSPHERE_WATER_MM = 20;
const MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM = 8;
const BOUNDARY_LAYER_PRESSURE_FRACTION = .25;
const BOUNDARY_LAYER_VAPOR_FRACTION = .82;
const BOUNDARY_LAYER_REFERENCE_ALTITUDE_M = 500;
const FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M = 4500;
const STANDARD_GRAVITY_MPS2 = 9.80665;
const STANDARD_SURFACE_PRESSURE_HPA = 1013.25;
const MAX_CONVECTIVE_KINETIC_ENERGY_J_M2 = 5e6;
const CONVECTIVE_DISSIPATION_TIMESCALE_DAYS = .35;
const CHECKPOINT_CLOCK_SKEW_TOLERANCE_DAYS = 1e-6;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));
const normalizeLon = lon => ((finite(lon) + 540) % 360) - 180;

const SOIL_TEXTURES = Object.freeze({
  sand: Object.freeze({ porosity: .40, fieldCapacity: .16, wiltingPoint: .06, conductivityMmDay: 190 }),
  loam: Object.freeze({ porosity: .46, fieldCapacity: .29, wiltingPoint: .12, conductivityMmDay: 48 }),
  clay: Object.freeze({ porosity: .50, fieldCapacity: .39, wiltingPoint: .21, conductivityMmDay: 9 }),
  organic: Object.freeze({ porosity: .62, fieldCapacity: .46, wiltingPoint: .18, conductivityMmDay: 34 }),
  fractured: Object.freeze({ porosity: .34, fieldCapacity: .20, wiltingPoint: .09, conductivityMmDay: 78 })
});

function soilTexture(sample) {
  const bedrock = String(sample?.geology?.bedrock || '').toLowerCase();
  if (/sandstone|dune|sand/.test(bedrock)) return 'sand';
  if (/shale|mudstone|clay/.test(bedrock)) return 'clay';
  if (/peat|organic|alluv/.test(bedrock)) return 'organic';
  if (/basalt|granite|gneiss|andesite|metamorphic/.test(bedrock)) return 'fractured';
  return 'loam';
}

function aquiferFactor(sample) {
  const bedrock = String(sample?.geology?.bedrock || '').toLowerCase();
  if (/limestone|karst/.test(bedrock)) return 1.35;
  if (/sandstone|alluv/.test(bedrock)) return 1.18;
  if (/granite|gneiss|metamorphic/.test(bedrock)) return .58;
  if (/basalt|volcan/.test(bedrock)) return .82;
  return 1;
}

export function earthCellIdentity(lat, lon, options = {}) {
  const resolutionDeg = clamp(finite(options.resolutionDeg, .25), .05, 2);
  const latitudeIndex = Math.floor((clamp(finite(lat), -89.999999, 89.999999) + 90) / resolutionDeg);
  const longitudeIndex = Math.floor((normalizeLon(lon) + 180) / resolutionDeg);
  const centerLat = -90 + (latitudeIndex + .5) * resolutionDeg;
  const centerLon = normalizeLon(-180 + (longitudeIndex + .5) * resolutionDeg);
  return {
    id: `earth-cell:v1:${resolutionDeg}:${latitudeIndex}:${longitudeIndex}`,
    resolutionDeg,
    latitudeIndex,
    longitudeIndex,
    center: { latitudeDeg: round(centerLat, 8), longitudeDeg: round(centerLon, 8) }
  };
}

export function deriveSubstrate(sample) {
  if (!sample?.land) return null;
  const texture = soilTexture(sample);
  const properties = SOIL_TEXTURES[texture];
  const soilDepthM = clamp(finite(sample?.geology?.soilDepthM, .3), .03, 5.5);
  const rootDepthM = clamp(soilDepthM, .08, 1.25);
  const deepDepthM = Math.max(0, soilDepthM - rootDepthM);
  const aquiferDepthM = clamp(8 + soilDepthM * 10 + aquiferFactor(sample) * 22, 8, 90);
  const specificYield = clamp(.08 + properties.porosity * .28 * aquiferFactor(sample), .06, .28);
  return {
    texture,
    soilDepthM: round(soilDepthM),
    rootDepthM: round(rootDepthM),
    deepDepthM: round(deepDepthM),
    porosity: properties.porosity,
    fieldCapacity: properties.fieldCapacity,
    wiltingPoint: properties.wiltingPoint,
    conductivityMmDay: properties.conductivityMmDay,
    rootCapacityMm: round(rootDepthM * properties.porosity * 1000),
    rootFieldCapacityMm: round(rootDepthM * properties.fieldCapacity * 1000),
    rootWiltingPointMm: round(rootDepthM * properties.wiltingPoint * 1000),
    deepCapacityMm: round(deepDepthM * properties.porosity * 1000),
    deepFieldCapacityMm: round(deepDepthM * properties.fieldCapacity * 1000),
    aquiferDepthM: round(aquiferDepthM),
    aquiferSpecificYield: round(specificYield),
    aquiferCapacityMm: round(aquiferDepthM * specificYield * 1000)
  };
}

function initialSnow(weather, temperatureC, land) {
  if (!land) return 0;
  return round(clamp(finite(weather?.snowpackMm, Math.max(0, -temperatureC) * 8), 0, 2500));
}

function initialSeaIce(temperatureC, latitudeAbs) {
  const cold = clamp((-temperatureC + 1.6) / 13);
  const polar = clamp((finite(latitudeAbs) - .58) / .30);
  const fraction = clamp(cold * .72 + polar * .38);
  return {
    fraction: round(fraction),
    thicknessM: round(fraction * (.22 + cold * 1.9)),
    waterEquivalentMm: round(fraction * (.22 + cold * 1.9) * ICE_DENSITY_KG_M3 / WATER_DENSITY_KG_M3 * 1000)
  };
}

function albedoFor(column) {
  return surfaceAlbedo(column);
}

function saturationVaporPressureHpa(temperatureC) {
  return 6.112 * Math.exp(17.67 * temperatureC / (temperatureC + 243.5));
}

function precipitableWaterMm(temperatureC, relativeHumidity) {
  return clamp(saturationVaporPressureHpa(temperatureC) * relativeHumidity * 1.55, .2, 75);
}

function atmosphericVaporCapacityMm(temperatureC) {
  return saturationVaporPressureHpa(temperatureC) * 1.55;
}

export function boundaryLayerVaporCapacityMm(temperatureC) {
  return atmosphericVaporCapacityMm(temperatureC) * BOUNDARY_LAYER_VAPOR_FRACTION;
}

export function freeTroposphereVaporCapacityMm(temperatureC) {
  return atmosphericVaporCapacityMm(temperatureC) * .58;
}

export function atmosphereWaterStorageMm(column) {
  return finite(column?.atmosphere?.precipitableWaterMm) + finite(column?.atmosphere?.cloudWaterMm) +
    finite(column?.atmosphere?.cloudIceMm) +
    finite(column?.atmosphere?.freeTroposphere?.precipitableWaterMm) +
    finite(column?.atmosphere?.freeTroposphere?.cloudWaterMm) +
    finite(column?.atmosphere?.freeTroposphere?.cloudIceMm);
}

export function atmosphereLayerHeatCapacitiesJm2K(column) {
  const hasFreeTroposphere = column?.atmosphere?.freeTroposphere &&
    Number.isFinite(column.atmosphere.freeTroposphere.airTemperatureC);
  if (!hasFreeTroposphere) {
    return {
      boundaryLayerJm2K: ATMOSPHERE_HEAT_CAPACITY_J_M2_K *
        Math.max(1, finite(column?.atmosphere?.surfacePressureHpa, STANDARD_SURFACE_PRESSURE_HPA)) /
        STANDARD_SURFACE_PRESSURE_HPA,
      freeTroposphereJm2K: 0
    };
  }
  const surfacePressureHpa = Math.max(1, finite(column.atmosphere.surfacePressureHpa, 1013.25));
  const boundaryPressureHpa = clamp(
    finite(column.atmosphere.boundaryLayerPressureHpa, surfacePressureHpa * BOUNDARY_LAYER_PRESSURE_FRACTION),
    surfacePressureHpa * .08,
    surfacePressureHpa * .5
  );
  const freePressureHpa = Math.max(1e-9,
    finite(column.atmosphere.freeTroposphere.pressureThicknessHpa,
      surfacePressureHpa - boundaryPressureHpa));
  return {
    boundaryLayerJm2K: ATMOSPHERE_HEAT_CAPACITY_J_M2_K *
      boundaryPressureHpa / STANDARD_SURFACE_PRESSURE_HPA,
    freeTroposphereJm2K: ATMOSPHERE_HEAT_CAPACITY_J_M2_K *
      freePressureHpa / STANDARD_SURFACE_PRESSURE_HPA
  };
}

export function atmosphereLayerDryAirMassesKgM2(column) {
  const surfacePressureHpa = Math.max(1, finite(column?.atmosphere?.surfacePressureHpa, 1013.25));
  const boundaryPressureHpa = clamp(
    finite(column?.atmosphere?.boundaryLayerPressureHpa,
      surfacePressureHpa * BOUNDARY_LAYER_PRESSURE_FRACTION),
    surfacePressureHpa * .08,
    surfacePressureHpa * .5
  );
  const freePressureHpa = Math.max(1e-9,
    finite(column?.atmosphere?.freeTroposphere?.pressureThicknessHpa,
      surfacePressureHpa - boundaryPressureHpa));
  return {
    boundaryLayerKgM2: boundaryPressureHpa * 100 / STANDARD_GRAVITY_MPS2,
    freeTroposphereKgM2: freePressureHpa * 100 / STANDARD_GRAVITY_MPS2
  };
}

export function atmosphereLayerGeopotentialHeightsM(column) {
  const surfaceReferenceM = column?.kind === 'ocean' ? 0 : finite(column?.surface?.elevationM);
  return {
    boundaryLayerM: surfaceReferenceM + BOUNDARY_LAYER_REFERENCE_ALTITUDE_M,
    freeTroposphereM: surfaceReferenceM + Math.max(1,
      finite(column?.atmosphere?.freeTroposphere?.referenceAltitudeM,
        FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M))
  };
}

export function atmosphereGeopotentialEnergyJm2(column) {
  const masses = atmosphereLayerDryAirMassesKgM2(column);
  const heights = atmosphereLayerGeopotentialHeightsM(column);
  return STANDARD_GRAVITY_MPS2 * (
    masses.boundaryLayerKgM2 * heights.boundaryLayerM +
    masses.freeTroposphereKgM2 * heights.freeTroposphereM
  );
}

export function atmosphereLayerMoistEnthalpiesJm2(column) {
  const capacities = atmosphereLayerHeatCapacitiesJm2K(column);
  return {
    boundaryLayerJm2: finite(column?.atmosphere?.airTemperatureC) * capacities.boundaryLayerJm2K +
      finite(column?.atmosphere?.precipitableWaterMm) * LATENT_HEAT_VAPORIZATION_J_KG -
      finite(column?.atmosphere?.cloudIceMm) * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG,
    freeTroposphereJm2: finite(column?.atmosphere?.freeTroposphere?.airTemperatureC) *
      capacities.freeTroposphereJm2K +
      finite(column?.atmosphere?.freeTroposphere?.precipitableWaterMm) *
        LATENT_HEAT_VAPORIZATION_J_KG -
      finite(column?.atmosphere?.freeTroposphere?.cloudIceMm) *
        PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG
  };
}

export function atmosphereSensibleHeatJm2(column) {
  const capacities = atmosphereLayerHeatCapacitiesJm2K(column);
  return finite(column?.atmosphere?.airTemperatureC) * capacities.boundaryLayerJm2K +
    finite(column?.atmosphere?.freeTroposphere?.airTemperatureC) * capacities.freeTroposphereJm2K;
}

export function atmosphereMoistEnthalpyJm2(column) {
  const layers = atmosphereLayerMoistEnthalpiesJm2(column);
  return layers.boundaryLayerJm2 + layers.freeTroposphereJm2;
}

export function atmosphereHorizontalKineticEnergyJm2(column) {
  const masses = atmosphereLayerDryAirMassesKgM2(column);
  const boundary = column?.atmosphere || {};
  const free = boundary.freeTroposphere || {};
  return .5 * (
    masses.boundaryLayerKgM2 *
      (finite(boundary.eastwardWindMps) ** 2 + finite(boundary.northwardWindMps) ** 2) +
    masses.freeTroposphereKgM2 *
      (finite(free.eastwardWindMps) ** 2 + finite(free.northwardWindMps) ** 2)
  );
}

export function atmosphereResolvedEnergyJm2(column) {
  return atmosphereMoistEnthalpyJm2(column) +
    atmosphereHorizontalKineticEnergyJm2(column) +
    Math.max(0, finite(column?.atmosphere?.convectiveKineticEnergyJm2)) +
    atmosphereGeopotentialEnergyJm2(column);
}

function windVector(speedMps, directionDeg) {
  const speed = clamp(finite(speedMps, 2), 0, 90);
  const radians = ((finite(directionDeg) % 360) + 360) % 360 * Math.PI / 180;
  return {
    eastwardWindMps: Math.sin(radians) * speed,
    northwardWindMps: Math.cos(radians) * speed
  };
}

function synchronizeWindVector(atmosphere) {
  const fallback = windVector(atmosphere.windSpeedMps, atmosphere.windDirectionDeg);
  let eastward = Number.isFinite(atmosphere.eastwardWindMps)
    ? atmosphere.eastwardWindMps : fallback.eastwardWindMps;
  let northward = Number.isFinite(atmosphere.northwardWindMps)
    ? atmosphere.northwardWindMps : fallback.northwardWindMps;
  const rawSpeed = Math.hypot(eastward, northward);
  if (rawSpeed > 90) {
    const scale = 90 / rawSpeed;
    eastward *= scale;
    northward *= scale;
  }
  const speed = Math.hypot(eastward, northward);
  atmosphere.eastwardWindMps = eastward;
  atmosphere.northwardWindMps = northward;
  atmosphere.windSpeedMps = speed;
  if (speed > 1e-12) atmosphere.windDirectionDeg = ((Math.atan2(eastward, northward) * 180 / Math.PI) + 360) % 360;
  else atmosphere.windDirectionDeg = ((finite(atmosphere.windDirectionDeg) % 360) + 360) % 360;
  return atmosphere;
}

function freeTroposphereWindTarget(surfaceWind, latitudeDeg) {
  const latitudeAbs = Math.abs(finite(latitudeDeg));
  const midLatitudeJet = clamp(1 - Math.abs(latitudeAbs - 45) / 30);
  return synchronizeWindVector({
    eastwardWindMps: finite(surfaceWind?.eastwardWindMps) + midLatitudeJet * 7.5,
    northwardWindMps: finite(surfaceWind?.northwardWindMps) * .82,
    windSpeedMps: finite(surfaceWind?.windSpeedMps),
    windDirectionDeg: finite(surfaceWind?.windDirectionDeg)
  });
}

export function createEarthSystemColumn(lat, lon, sample, weather, options = {}) {
  if (!sample || typeof sample !== 'object') throw new Error('Earth-system column requires a planet sample');
  const identity = earthCellIdentity(lat, lon, options);
  const profileId = typeof options.profile === 'string' ? options.profile : options.profile?.id || sample.profile || 'temperate';
  if (!CONDITION_PROFILES[profileId]) throw new Error(`Unknown Earth-system profile: ${profileId}`);
  const temperatureC = finite(weather?.seasonalTemperatureC, sample.temperatureC);
  const humidity = clamp(finite(weather?.humidity, sample.moisture));
  const seaIce = initialSeaIce(temperatureC, sample.latitudeAbs);
  const substrate = deriveSubstrate(sample);
  const moisture = clamp(finite(sample.moisture, .5));
  const freshwaterPotential = clamp(finite(sample?.ecology?.freshwaterPotential, moisture));
  const land = sample.land === true;
  const rootZoneWaterMm = land ? clamp(
    substrate.rootWiltingPointMm + moisture * (substrate.rootCapacityMm - substrate.rootWiltingPointMm),
    0, substrate.rootCapacityMm
  ) : 0;
  const deepSoilWaterMm = land ? clamp(
    substrate.deepFieldCapacityMm * (.45 + moisture * .7), 0, substrate.deepCapacityMm
  ) : 0;
  const groundwaterMm = land ? clamp(
    substrate.aquiferCapacityMm * (.08 + freshwaterPotential * .58), 0, substrate.aquiferCapacityMm
  ) : 0;
  const mixedLayerDepthM = land ? 0 : clamp(
    18 + finite(sample?.ecology?.marineMixing, .4) * 92 + sample.latitudeAbs * 55,
    12, 180
  );
  const initialIceMm = land ? 0 : seaIce.waterEquivalentMm;
  const initialSnowMm = initialSnow(weather, temperatureC, land);
  const initialWind = windVector(weather?.windSpeedMps, weather?.windDirectionDeg);
  const initialFreeWind = freeTroposphereWindTarget(initialWind, identity.center.latitudeDeg);
  const surfacePressureHpa = finite(weather?.pressureHpa, 1013.25);
  const boundaryLayerPressureHpa = surfacePressureHpa * BOUNDARY_LAYER_PRESSURE_FRACTION;
  const totalAtmosphericVaporMm = precipitableWaterMm(temperatureC, humidity);
  const boundaryLayerVaporMm = totalAtmosphericVaporMm * BOUNDARY_LAYER_VAPOR_FRACTION;
  const freeTroposphereVaporMm = totalAtmosphericVaporMm - boundaryLayerVaporMm;
  const initialLapseRateKPerKm = clamp(5.8 + (1 - humidity) * 2.2, 5.5, 8.2);
  const freeTroposphereTemperatureC = temperatureC -
    initialLapseRateKPerKm * FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M / 1000;
  const initialLandEcology = land ? createLandEcology(sample, substrate, {
    lifeAbundance: finite(options.lifeAbundance,
      CONDITION_PROFILES[profileId].lifeAbundance)
  }) : null;
  if (initialLandEcology && options.livingEnabled === false) {
    initialLandEcology.physiology.active = false;
  }
  const column = {
    schema: EARTH_SYSTEM_COLUMN_SCHEMA,
    id: identity.id,
    coordinate: identity.center,
    resolutionDeg: identity.resolutionDeg,
    profileId,
    seed: Number.isFinite(options.seed) ? options.seed : PLANET_DEFAULTS.seed,
    kind: land ? 'land' : 'ocean',
    lastDay: round(finite(options.day, 0), 8),
    stepCount: 0,
    surface: {
      baseElevationM: round(finite(sample.elevationM)),
      elevationM: round(finite(sample.elevationM)),
      geomorphicElevationAdjustmentM: 0,
      temperatureC: round(temperatureC),
      albedo: 0,
      pondedWaterMm: 0,
      skinWetness: land ? moisture : 1,
      lastRadiationReceipt: null
    },
    atmosphere: {
      surfacePressureHpa: round(surfacePressureHpa),
      boundaryLayerPressureHpa: round(boundaryLayerPressureHpa),
      airTemperatureC: round(temperatureC),
      relativeHumidity: round(clamp(boundaryLayerVaporMm /
        Math.max(.01, boundaryLayerVaporCapacityMm(temperatureC)), .01, 1)),
      precipitableWaterMm: round(boundaryLayerVaporMm),
      cloudWaterMm: 0,
      cloudIceMm: 0,
      cloudFraction: round(clamp(finite(weather?.cloudCover, humidity * .7))),
      windSpeedMps: round(clamp(finite(weather?.windSpeedMps, 2), 0, 90)),
      windDirectionDeg: round(((finite(weather?.windDirectionDeg) % 360) + 360) % 360),
      eastwardWindMps: round(initialWind.eastwardWindMps),
      northwardWindMps: round(initialWind.northwardWindMps),
      lastPhaseChangeReceipt: null,
      convectiveKineticEnergyJm2: 0,
      verticalVelocityProxyMps: 0,
      freeTroposphere: {
        schema: EARTH_FREE_TROPOSPHERE_SCHEMA,
        referenceAltitudeM: FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M,
        pressureThicknessHpa: round(surfacePressureHpa - boundaryLayerPressureHpa),
        airTemperatureC: round(freeTroposphereTemperatureC),
        relativeHumidity: round(clamp(freeTroposphereVaporMm /
          Math.max(.01, freeTroposphereVaporCapacityMm(freeTroposphereTemperatureC)), .01, 1)),
        precipitableWaterMm: round(freeTroposphereVaporMm),
        cloudWaterMm: 0,
        cloudIceMm: 0,
        cloudFraction: round(clamp(finite(weather?.cloudCover, humidity * .7) * .62)),
        windSpeedMps: round(initialFreeWind.windSpeedMps),
        windDirectionDeg: round(initialFreeWind.windDirectionDeg),
        eastwardWindMps: round(initialFreeWind.eastwardWindMps),
        northwardWindMps: round(initialFreeWind.northwardWindMps)
      },
      lastFreeTropospherePhaseReceipt: null,
      lastVerticalExchangeReceipt: null,
      lastPressureColumnDynamicsReceipt: null,
      lastBoundaryEnergyReceipt: null,
      lastPressureColumnHorizontalTransportReceipt: null,
      biogeochemistry: createAtmosphereBiogeochemistry()
    },
    cryosphere: {
      snowWaterEquivalentMm: initialSnowMm,
      snowAgeDays: initialSnowMm > 0 ? 12 : 0,
      soilFrozenFraction: land ? round(clamp((-temperatureC + 1) / 16)) : 0,
      seaIceFraction: land ? 0 : seaIce.fraction,
      seaIceThicknessM: land ? 0 : seaIce.thicknessM,
      seaIceWaterEquivalentMm: initialIceMm,
      lastPhaseChangeReceipt: null
    },
    substrate,
    land: land ? {
      rootZoneWaterMm: round(rootZoneWaterMm),
      deepSoilWaterMm: round(deepSoilWaterMm),
      groundwaterStorageMm: round(groundwaterMm),
      waterTableDepthM: round(substrate.aquiferDepthM * (1 - groundwaterMm / Math.max(1, substrate.aquiferCapacityMm))),
      rootZoneSaturation: round(rootZoneWaterMm / Math.max(1, substrate.rootCapacityMm)),
      plantAvailableFraction: round(clamp((rootZoneWaterMm - substrate.rootWiltingPointMm) /
        Math.max(1, substrate.rootFieldCapacityMm - substrate.rootWiltingPointMm))),
      ecology: initialLandEcology,
      surfaceSediment: createSurfaceSediment(sample, substrate),
      soilBiogeochemistry: createSoilBiogeochemistry(sample, substrate,
        initialLandEcology, {
          accessibleWaterMm: rootZoneWaterMm + deepSoilWaterMm + groundwaterMm,
          temperatureC
        })
    } : null,
    ocean: land ? null : {
      mixedLayerDepthM: round(mixedLayerDepthM),
      mixedLayerTemperatureC: round(finite(sample?.ecology?.waterTemperatureC, temperatureC)),
      salinityPsu: round(finite(sample?.ecology?.salinityPsu, 35)),
      freshwaterAnomalyMm: round(-initialIceMm),
      heatContentJm2: 0,
      coastalSediment: emptyCoastalSediment(),
      ecology: null
    },
    routing: {
      runoffQueueMm: 0,
      runoffBiogeochemistryQueue: emptyRunoffBiogeochemistryQueue(),
      runoffSedimentQueue: emptyRunoffSedimentQueue(),
      cumulativeGeneratedRunoffMm: 0,
      cumulativeRoutedRunoffMm: 0,
      cumulativeChannelizedRunoffMm: 0,
      lastDownstreamCellId: null,
      lastDownstreamReachId: null
    },
    fluxes: emptyFluxes(),
    budget: {
      water: {
        initialStorageMm: 0, atmosphericBoundaryMoistureMm: 0,
        precipitationMm: 0, unmetPrecipitationMm: 0, evaporationMm: 0,
        generatedRunoffMm: 0, exportedRunoffMm: 0, finalStorageMm: 0, residualMm: 0,
        atmosphere: { initialWaterMm: 0, afterBoundaryWaterMm: 0, finalWaterMm: 0 }
      },
      energy: { netSurfaceFluxWm2: 0, boundaryHeatFluxWm2: 0, storageChangeJm2: 0, residualJm2: 0 },
      atmosphereEnergy: {
        initialMoistEnthalpyJm2: 0,
        requestedBoundaryMoistEnthalpyJm2: 0,
        boundaryMoistEnthalpyJm2: 0,
        boundaryNativeEnvelopeReconciliationJm2: 0,
        boundaryEnergyReceipt: null,
        phaseChangeLatentHeatingJm2: 0, surfaceLatentInputJm2: 0,
        surfacePrecipitationPhaseEnthalpyJm2: 0,
        verticalMechanicalConversionJm2: 0,
        nativeMomentumMixingConversionJm2: 0,
        finalMoistEnthalpyJm2: 0, residualJm2: 0
      },
      atmosphereBiogeochemistry: null,
      atmosphereBiogeochemistryVertical: null,
      landEcology: null,
      soilBiogeochemistry: null,
      geomorphicSediment: null,
      oceanEcology: null
    },
    truth: {
      deterministic: true,
      statefulReservoirs: true,
      waterBudgetClosed: true,
      energyBudgetClosed: true,
      canonicalSparseCell: true,
      localColumnModel: true,
      neighborTransportReady: true,
      atmosphereCoupledToPrecipitationBudget: true,
      cloudLiquidWaterReservoir: true,
      cloudIceWaterReservoir: true,
      nativeMixedPhaseClouds: true,
      nativeMixedPhaseCloudRadiation: false,
      nativeLayerCo2RadiativeCoupling: false,
      co2SurfaceLongwaveFeedbackApplied: false,
      spectralAtmosphericRadiativeTransfer: false,
      dynamicCryosphereAlbedo: true,
      cryosphereFusionEnergyReceipted: false,
      snowAgePersisted: true,
      snowOnSeaIcePersisted: true,
      persistentLandEcology: land,
      localCarbonBudgetClosed: land,
      localNitrogenBudgetClosed: land,
      persistentOceanEcology: !land,
      localOceanCarbonBudgetClosed: !land,
      localOceanNitrogenBudgetClosed: !land,
      localOceanPhosphorusBudgetClosed: !land,
      localOceanOxygenFluxClosed: !land,
      localOceanAlkalinityBudgetClosed: !land,
      mixedLayerCarbonateDiagnostic: false,
      mixedLayerCarbonateDiagnosticSolved: false,
      mixedLayerCarbonateMassClosed: false,
      mixedLayerCarbonateAlkalinityResidualClosed: false,
      mixedLayerPHTotalResolved: false,
      mixedLayerCarbonateSurfacePressureOnly: false,
      carbonateInformedAirSeaCo2Exchange: false,
      airSeaCo2FugacityCorrection: false,
      airSeaCarbonExchangeTypedRefusal: false,
      airSeaCarbonOwnerMoveMatchedProposal: false,
      scientificAirSeaGasTransferVelocity: false,
      measuredAirSeaPco2: false,
      measuredOceanSkinTemperature: false,
      deepOceanPHResolved: false,
      carbonatePHFeedbackModeled: false,
      physicalOceanChemistryWithLifeOff: !land,
      persistentDeepOceanReservoirs: !land,
      persistentDeepOceanAlkalinity: !land,
      mixedToDeepMaterialClosure: !land,
      mixedToDeepAlkalinityClosure: !land,
      persistentAtmosphereBiogeochemistry: true,
      nativePressureLayerAtmosphericBiogeochemistry: true,
      atmosphereBiosphereGasLedgerClosed: true,
      atmosphericBiogeochemistryVerticalTransport: false,
      atmosphericBiogeochemistryVerticalConservationClosed: true,
      ecologyGasFieldsAreCompatibilityMirrors: true,
      atmosphericBiogeochemistryHorizontalTransport: false,
      loadedOceanBiogeochemicalTransport: false,
      vegetationAlbedoCoupled: false,
      physiologicalTranspirationCoupled: false,
      globallyMixedAtmosphericCo2: false,
      typedRainSnowDescent: false,
      atmosphericPhaseChangeReceipted: true,
      moistEnthalpyBudgetClosed: true,
      boundaryForcingEnergyReceipted: false,
      freeTroposphereReservoir: true,
      hydrostaticVerticalPressurePartition: true,
      verticalAtmosphereExchangeReceipted: false,
      verticalWaterClosed: true,
      verticalMoistEnthalpyClosed: true,
      verticalMomentumClosed: true,
      verticalGeopotentialExchangeReceipted: true,
      verticalResolvedEnergyClosed: true,
      boundedTwoLayerBuoyancyConversionResolved: false,
      pressureCoordinateColumnPersisted: true,
      pressureColumnConservativeProjection: true,
      pressureColumnHydrostaticInterfaces: true,
      nativePressureLevelThermodynamics: true,
      nativePressureLevelPhaseChangeReceipted: false,
      nativePhaseChangesBoundedByThermalHeadroom: false,
      nativeLayerTemperaturesWithinDeclaredEnvelope: true,
      postMaterialTemperatureClipRequired: false,
      nativePrecipitationDescentReceipted: false,
      nativeAdjacentLevelExchangeReceipted: false,
      nativePressureLevelWaterClosed: true,
      nativePressureLevelMoistEnthalpyClosed: true,
      nativePressureLevelMomentumClosed: true,
      nativePressureLevelResolvedEnergyClosed: true,
      nativePressureInterfaceBuoyancyReceipted: false,
      nativePressureInterfaceVerticalMomentum: false,
      nativePressureInterfaceConvectiveKineticEnergy: false,
      nativePressureInterfaceEntrainmentDetrainment: false,
      nativePressureLevelHorizontalTransport: false,
      nativePressureLevelHorizontalWaterClosed: false,
      nativePressureLevelHorizontalMoistEnthalpyClosed: false,
      nativePressureLevelHorizontalMomentumClosed: false,
      nativePressureLevelHorizontalResolvedEnergyClosed: false,
      pressureLevelDynamicsResolved: false,
      resolvedThreeDimensionalConvection: false,
      vectorAtmosphericMomentum: true,
      independentLayerAtmosphericMomentum: true,
      conservativeNeighborAtmosphereMomentumReady: true,
      runoffHeldForReceiptedRouting: true,
      runoffCanEnterCanonicalRiverReach: true,
      persistentSoilWaterBiogeochemistry: land,
      persistentRunoffBiogeochemistryQueue: land,
      soilRunoffBiogeochemistryClosed: land,
      persistentSurfaceSediment: land,
      persistentRunoffSedimentQueue: land,
      surfaceRunoffSedimentClosed: land,
      persistentCoastalSediment: !land,
      dynamicGeomorphicElevation: land,
      resolvedChannelMorphodynamics: false,
      parameterizedLandRunoffChemistryBoundary: false,
      globalCirculationModel: false,
      scientificForecast: false
    }
  };
  column.surface.albedo = round(albedoFor(column));
  if (column.ocean) {
    column.ocean.ecology = createOceanEcology(sample, column.ocean, {
      lifeAbundance: finite(options.lifeAbundance,
        CONDITION_PROFILES[profileId].lifeAbundance)
    });
    if (column.ocean.ecology && options.livingEnabled === false) {
      column.ocean.ecology.physiology.active = false;
    }
    column.truth.mixedLayerCarbonateDiagnostic =
      column.ocean.ecology?.carbonateSystem?.truth?.diagnosticOnly === true &&
      column.ocean.ecology.carbonateSystem.truth?.mutatesMaterial === false;
    column.truth.mixedLayerCarbonateDiagnosticSolved =
      column.ocean.ecology?.carbonateSystem?.status === 'SOLVED';
    column.truth.mixedLayerCarbonateMassClosed =
      column.ocean.ecology?.carbonateSystem?.truth?.carbonateMassClosed === true;
    column.truth.mixedLayerCarbonateAlkalinityResidualClosed =
      column.ocean.ecology?.carbonateSystem?.truth
        ?.alkalinityResidualClosed === true;
    column.truth.mixedLayerPHTotalResolved = Number.isFinite(Number(
      column.ocean.ecology?.carbonateSystem?.solution?.pHTotal));
    column.truth.mixedLayerCarbonateSurfacePressureOnly =
      column.ocean.ecology?.carbonateSystem?.truth?.surfacePressureOnly === true;
    column.truth.scientificAirSeaGasTransferVelocity = false;
    column.truth.measuredAirSeaPco2 = false;
    column.truth.measuredOceanSkinTemperature = false;
    column.ocean.heatContentJm2 = round(
      column.ocean.mixedLayerTemperatureC * WATER_HEAT_CAPACITY_J_M3_K *
        column.ocean.mixedLayerDepthM,
      2
    );
  }
  const pressureColumnInitialization = createPressureColumnFromLegacy(column, {
    reason: 'new-earth-system-column'
  });
  column.atmosphere.pressureColumn = pressureColumnInitialization.pressureColumn;
  column.atmosphere.lastPressureColumnSyncReceipt = pressureColumnInitialization.receipt;
  column.atmosphere.biogeochemistry = normalizeAtmosphereBiogeochemistry(
    column.atmosphere.biogeochemistry,
    { pressureColumn: column.atmosphere.pressureColumn }
  );
  return column;
}

function emptyFluxes() {
  return {
    schema: EARTH_SYSTEM_FLUX_SCHEMA,
    precipitationMmDay: 0,
    rainfallMmDay: 0,
    snowfallMmDay: 0,
    snowmeltMmDay: 0,
    evaporationMmDay: 0,
    transpirationMmDay: 0,
    infiltrationMmDay: 0,
    rechargeMmDay: 0,
    capillaryRiseMmDay: 0,
    surfaceRunoffMmDay: 0,
    baseflowMmDay: 0,
    freshwaterBalanceMmDay: 0,
    netRadiationWm2: 0,
    latentHeatWm2: 0,
    sensibleHeatWm2: 0,
    condensationMmDay: 0,
    cloudEvaporationMmDay: 0,
    atmosphericLatentHeatingWm2: 0,
    verticalSensibleHeatWm2: 0,
    verticalBuoyancyConversionWm2: 0,
    convectiveKineticDissipationWm2: 0,
    convectiveExchangeFractionDay: 0,
    absorbedShortwaveWm2: 0,
    upwardLongwaveWm2: 0,
    downwardLongwaveWm2: 0,
    cloudShortwaveForcingWm2: 0,
    cloudLongwaveForcingWm2: 0,
    cryospherePhaseChangeWm2: 0,
    grossPrimaryProductionKgCm2Day: 0,
    autotrophicRespirationKgCm2Day: 0,
    heterotrophicRespirationKgCm2Day: 0,
    netAtmosphereCarbonExchangeKgCm2Day: 0,
    litterfallKgCm2Day: 0,
    nitrogenUptakeKgNm2Day: 0,
    marineGrossPrimaryProductionKgCm2Day: 0,
    marineCommunityRespirationKgCm2Day: 0,
    airSeaCo2FluxToOceanKgCm2Day: 0,
    marinePhotosyntheticOxygenKgO2m2Day: 0,
    marineRespirationOxygenKgO2m2Day: 0,
    marineNitrogenUptakeKgNm2Day: 0,
    marinePhosphorusUptakeKgPm2Day: 0
  };
}

export function earthSystemWaterStorageMm(column) {
  const atmosphericWaterMm = atmosphereWaterStorageMm(column);
  const routingWaterMm = finite(column?.routing?.runoffQueueMm);
  if (column.kind === 'land') return atmosphericWaterMm + routingWaterMm + column.surface.pondedWaterMm +
    column.cryosphere.snowWaterEquivalentMm + column.land.rootZoneWaterMm +
    column.land.deepSoilWaterMm + column.land.groundwaterStorageMm;
  return atmosphericWaterMm + routingWaterMm + column.ocean.freshwaterAnomalyMm +
    column.cryosphere.seaIceWaterEquivalentMm +
    finite(column.cryosphere.snowWaterEquivalentMm);
}

function dailyPrecipitation(weather, sample) {
  const rate = Math.max(0, finite(weather?.precipitation?.mmHour));
  const potential = clamp(finite(weather?.precipitation?.potential));
  if (rate <= 0) return 0;
  const eventHours = clamp(1.25 + potential * 6.25, 1.25, 8);
  const orographic = sample.land ? 1 + clamp(finite(sample?.geology?.erosionRisk)) * .12 : 1;
  return clamp(rate * eventHours * orographic, 0, 120);
}

function syncAtmosphericHumidity(column) {
  column.atmosphere.relativeHumidity = clamp(
    column.atmosphere.precipitableWaterMm /
      Math.max(.01, boundaryLayerVaporCapacityMm(column.atmosphere.airTemperatureC)),
    .01, 1
  );
}

function syncFreeTroposphereHumidity(column) {
  const free = column.atmosphere.freeTroposphere;
  free.relativeHumidity = clamp(
    free.precipitableWaterMm / Math.max(.01, freeTroposphereVaporCapacityMm(free.airTemperatureC)),
    .01,
    1
  );
}

function syncVerticalPressurePartition(column) {
  const atmosphere = column.atmosphere;
  const previousBoundaryHpa = finite(atmosphere.boundaryLayerPressureHpa,
    atmosphere.surfacePressureHpa * BOUNDARY_LAYER_PRESSURE_FRACTION);
  const previousFreeHpa = finite(atmosphere.freeTroposphere?.pressureThicknessHpa,
    atmosphere.surfacePressureHpa - previousBoundaryHpa);
  const boundaryFraction = clamp(
    previousBoundaryHpa / Math.max(1, previousBoundaryHpa + previousFreeHpa),
    .08,
    .5
  );
  atmosphere.boundaryLayerPressureHpa = atmosphere.surfacePressureHpa * boundaryFraction;
  atmosphere.freeTroposphere.pressureThicknessHpa =
    atmosphere.surfacePressureHpa - atmosphere.boundaryLayerPressureHpa;
}

function verticalLapseRateKPerKm(column) {
  return (finite(column.atmosphere.airTemperatureC) -
    finite(column.atmosphere.freeTroposphere?.airTemperatureC)) /
    (Math.max(1, finite(column.atmosphere.freeTroposphere?.referenceAltitudeM,
      FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M)) / 1000);
}

function updateAtmosphere(column, weather, dtDays) {
  const initialWaterMm = atmosphereWaterStorageMm(column);
  const initialMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  const response = 1 - Math.exp(-dtDays * 3.2);
  const freeResponse = 1 - Math.exp(-dtDays * .72);
  const boundaryForcing = weather?.boundaryForcing || weather;
  const targetTemperature = finite(weather?.seasonalTemperatureC, column.atmosphere.airTemperatureC);
  const targetHumidity = clamp(finite(weather?.humidity, column.atmosphere.relativeHumidity));
  const targetLapseRateKPerKm = clamp(5.8 + (1 - targetHumidity) * 2.2, 5.5, 8.2);
  const targetFreeTemperatureC = targetTemperature - targetLapseRateKPerKm *
    column.atmosphere.freeTroposphere.referenceAltitudeM / 1000;
  column.atmosphere.airTemperatureC += (targetTemperature - column.atmosphere.airTemperatureC) * response;
  column.atmosphere.freeTroposphere.airTemperatureC +=
    (targetFreeTemperatureC - column.atmosphere.freeTroposphere.airTemperatureC) * freeResponse;
  column.atmosphere.surfacePressureHpa += (finite(boundaryForcing?.pressureHpa, column.atmosphere.surfacePressureHpa) - column.atmosphere.surfacePressureHpa) * response;
  syncVerticalPressurePartition(column);
  column.atmosphere.cloudFraction += (clamp(finite(weather?.cloudCover, column.atmosphere.cloudFraction)) - column.atmosphere.cloudFraction) * response;
  column.atmosphere.freeTroposphere.cloudFraction +=
    (clamp(finite(weather?.cloudCover, column.atmosphere.cloudFraction) * .62) -
      column.atmosphere.freeTroposphere.cloudFraction) * freeResponse;
  synchronizeWindVector(column.atmosphere);
  const targetWind = windVector(
    finite(boundaryForcing?.windSpeedMps, column.atmosphere.windSpeedMps),
    finite(boundaryForcing?.windDirectionDeg, column.atmosphere.windDirectionDeg)
  );
  column.atmosphere.eastwardWindMps += (targetWind.eastwardWindMps - column.atmosphere.eastwardWindMps) * response;
  column.atmosphere.northwardWindMps += (targetWind.northwardWindMps - column.atmosphere.northwardWindMps) * response;
  synchronizeWindVector(column.atmosphere);
  synchronizeWindVector(column.atmosphere.freeTroposphere);
  const targetFreeWind = freeTroposphereWindTarget(targetWind, column.coordinate.latitudeDeg);
  column.atmosphere.freeTroposphere.eastwardWindMps +=
    (targetFreeWind.eastwardWindMps - column.atmosphere.freeTroposphere.eastwardWindMps) * freeResponse;
  column.atmosphere.freeTroposphere.northwardWindMps +=
    (targetFreeWind.northwardWindMps - column.atmosphere.freeTroposphere.northwardWindMps) * freeResponse;
  synchronizeWindVector(column.atmosphere.freeTroposphere);
  const targetTotalVaporMm = precipitableWaterMm(column.atmosphere.airTemperatureC, targetHumidity);
  const targetBoundaryVaporMm = targetTotalVaporMm * BOUNDARY_LAYER_VAPOR_FRACTION;
  const targetFreeVaporMm = targetTotalVaporMm - targetBoundaryVaporMm;
  column.atmosphere.precipitableWaterMm +=
    (targetBoundaryVaporMm - column.atmosphere.precipitableWaterMm) * response;
  column.atmosphere.precipitableWaterMm = clamp(column.atmosphere.precipitableWaterMm,
    MIN_ATMOSPHERIC_WATER_MM,
    Math.max(MIN_ATMOSPHERIC_WATER_MM, MAX_ATMOSPHERIC_WATER_MM -
      finite(column.atmosphere.cloudWaterMm) - finite(column.atmosphere.cloudIceMm)));
  column.atmosphere.freeTroposphere.precipitableWaterMm +=
    (targetFreeVaporMm - column.atmosphere.freeTroposphere.precipitableWaterMm) * freeResponse;
  column.atmosphere.freeTroposphere.precipitableWaterMm = clamp(
    column.atmosphere.freeTroposphere.precipitableWaterMm,
    0,
    Math.max(0, MAX_FREE_TROPOSPHERE_WATER_MM -
      finite(column.atmosphere.freeTroposphere.cloudWaterMm) -
      finite(column.atmosphere.freeTroposphere.cloudIceMm))
  );
  syncAtmosphericHumidity(column);
  syncFreeTroposphereHumidity(column);
  const afterBoundaryWaterMm = atmosphereWaterStorageMm(column);
  const afterBoundaryMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  return {
    initialWaterMm,
    afterBoundaryWaterMm,
    boundaryMoistureMm: afterBoundaryWaterMm - initialWaterMm,
    initialMoistEnthalpyJm2,
    afterBoundaryMoistEnthalpyJm2,
    boundaryMoistEnthalpyJm2: afterBoundaryMoistEnthalpyJm2 - initialMoistEnthalpyJm2
  };
}

function maximumCloudEvaporationMm(column, requestedMm) {
  const boundaryLayerHeatCapacityJm2K =
    atmosphereLayerHeatCapacitiesJm2K(column).boundaryLayerJm2K;
  const requested = Math.min(
    Math.max(0, requestedMm),
    finite(column.atmosphere.cloudWaterMm),
    MAX_ATMOSPHERIC_WATER_MM - finite(column.atmosphere.precipitableWaterMm)
  );
  let low = 0;
  let high = requested;
  const initialTemperatureC = column.atmosphere.airTemperatureC;
  const initialVaporMm = column.atmosphere.precipitableWaterMm;
  for (let iteration = 0; iteration < 28; iteration++) {
    const candidate = (low + high) * .5;
    const cooledTemperatureC = initialTemperatureC -
      candidate * LATENT_HEAT_VAPORIZATION_J_KG / boundaryLayerHeatCapacityJm2K;
    if (initialVaporMm + candidate <= boundaryLayerVaporCapacityMm(cooledTemperatureC)) low = candidate;
    else high = candidate;
  }
  return low;
}

function phaseChangeAndPrecipitation(column, desiredPrecipitationMm, dtDays) {
  const boundaryLayerHeatCapacityJm2K =
    atmosphereLayerHeatCapacitiesJm2K(column).boundaryLayerJm2K;
  const desiredMm = Math.max(0, finite(desiredPrecipitationMm));
  const initialVaporMm = finite(column.atmosphere.precipitableWaterMm);
  const initialCloudWaterMm = clamp(finite(column.atmosphere.cloudWaterMm), 0, MAX_CLOUD_WATER_MM);
  column.atmosphere.cloudWaterMm = initialCloudWaterMm;
  const initialAirTemperatureC = finite(column.atmosphere.airTemperatureC);
  const initialWaterMm = atmosphereWaterStorageMm(column);
  const initialMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  let condensationMm = 0;
  let cloudEvaporationMm = 0;

  const condense = requestedMm => {
    const amount = Math.min(
      Math.max(0, requestedMm),
      Math.max(0, column.atmosphere.precipitableWaterMm - MIN_ATMOSPHERIC_WATER_MM),
      Math.max(0, MAX_CLOUD_WATER_MM - column.atmosphere.cloudWaterMm -
        finite(column.atmosphere.cloudIceMm))
    );
    column.atmosphere.precipitableWaterMm -= amount;
    column.atmosphere.cloudWaterMm += amount;
    column.atmosphere.airTemperatureC +=
      amount * LATENT_HEAT_VAPORIZATION_J_KG / boundaryLayerHeatCapacityJm2K;
    condensationMm += amount;
    return amount;
  };
  const evaporateCloud = requestedMm => {
    const amount = maximumCloudEvaporationMm(column, requestedMm);
    column.atmosphere.cloudWaterMm -= amount;
    column.atmosphere.precipitableWaterMm += amount;
    column.atmosphere.airTemperatureC -=
      amount * LATENT_HEAT_VAPORIZATION_J_KG / boundaryLayerHeatCapacityJm2K;
    cloudEvaporationMm += amount;
    return amount;
  };

  const supersaturationMm = Math.max(0,
    column.atmosphere.precipitableWaterMm - boundaryLayerVaporCapacityMm(column.atmosphere.airTemperatureC));
  condense(supersaturationMm);
  const relativeSaturation = clamp(
    column.atmosphere.precipitableWaterMm /
      Math.max(.01, boundaryLayerVaporCapacityMm(column.atmosphere.airTemperatureC)),
    0, 1.4
  );
  const targetCloudWaterMm = clamp(
    column.atmosphere.cloudFraction * clamp((relativeSaturation - .58) / .42) * 3.5,
    0,
    MAX_CLOUD_WATER_MM
  );
  const response = 1 - Math.exp(-Math.max(0, finite(dtDays)) * 6);
  if (column.atmosphere.cloudWaterMm < targetCloudWaterMm) {
    condense((targetCloudWaterMm - column.atmosphere.cloudWaterMm) * response);
  } else if (desiredMm <= 0 && column.atmosphere.cloudWaterMm > targetCloudWaterMm) {
    evaporateCloud((column.atmosphere.cloudWaterMm - targetCloudWaterMm) * response);
  }

  let precipitationMm = 0;
  for (let cycle = 0; cycle < 16 && precipitationMm < desiredMm - 1e-12; cycle++) {
    const remainingMm = desiredMm - precipitationMm;
    const drainedMm = Math.min(remainingMm, column.atmosphere.cloudWaterMm);
    column.atmosphere.cloudWaterMm -= drainedMm;
    precipitationMm += drainedMm;
    if (precipitationMm >= desiredMm - 1e-12) break;
    const condensedMm = condense(desiredMm - precipitationMm);
    if (condensedMm <= 1e-12) break;
  }
  syncAtmosphericHumidity(column);
  const finalWaterMm = atmosphereWaterStorageMm(column);
  const finalMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  const latentHeatingJm2 = (condensationMm - cloudEvaporationMm) * LATENT_HEAT_VAPORIZATION_J_KG;
  return {
    schema: EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA,
    durationDays: round(dtDays, 9),
    desiredPrecipitationMm: round(desiredMm, 9),
    precipitationMm: round(precipitationMm, 9),
    unmetPrecipitationMm: round(Math.max(0, desiredMm - precipitationMm), 9),
    condensationMm: round(condensationMm, 9),
    cloudEvaporationMm: round(cloudEvaporationMm, 9),
    latentHeatingJm2: round(latentHeatingJm2, 3),
    initialVaporMm: round(initialVaporMm, 9),
    initialCloudWaterMm: round(initialCloudWaterMm, 9),
    finalVaporMm: round(column.atmosphere.precipitableWaterMm, 9),
    finalCloudWaterMm: round(column.atmosphere.cloudWaterMm, 9),
    initialAirTemperatureC: round(initialAirTemperatureC, 9),
    finalAirTemperatureC: round(column.atmosphere.airTemperatureC, 9),
    waterResidualMm: round(finalWaterMm + precipitationMm - initialWaterMm, 9),
    moistEnthalpyResidualJm2: round(finalMoistEnthalpyJm2 - initialMoistEnthalpyJm2, 3),
    truth: {
      waterConservative: true,
      latentHeatCoupledToAir: true,
      precipitationWithdrawsCloudLiquid: true,
      boundedSingleLayerParameterization: true,
      resolvedCloudMicrophysics: false,
      resolvedVerticalConvectionModel: false
    }
  };
}

function maximumFreeTroposphereCloudEvaporationMm(column, requestedMm) {
  const free = column.atmosphere.freeTroposphere;
  const freeHeatCapacityJm2K = atmosphereLayerHeatCapacitiesJm2K(column).freeTroposphereJm2K;
  const requested = Math.min(
    Math.max(0, requestedMm),
    finite(free.cloudWaterMm),
    MAX_FREE_TROPOSPHERE_WATER_MM - finite(free.precipitableWaterMm)
  );
  let low = 0;
  let high = requested;
  const initialTemperatureC = free.airTemperatureC;
  const initialVaporMm = free.precipitableWaterMm;
  for (let iteration = 0; iteration < 28; iteration++) {
    const candidate = (low + high) * .5;
    const cooledTemperatureC = initialTemperatureC -
      candidate * LATENT_HEAT_VAPORIZATION_J_KG / freeHeatCapacityJm2K;
    if (initialVaporMm + candidate <= freeTroposphereVaporCapacityMm(cooledTemperatureC)) low = candidate;
    else high = candidate;
  }
  return low;
}

function phaseChangeFreeTroposphere(column, dtDays) {
  const free = column.atmosphere.freeTroposphere;
  const freeHeatCapacityJm2K = atmosphereLayerHeatCapacitiesJm2K(column).freeTroposphereJm2K;
  const initialVaporMm = finite(free.precipitableWaterMm);
  const initialCloudWaterMm = clamp(finite(free.cloudWaterMm), 0, MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM);
  const initialAirTemperatureC = finite(free.airTemperatureC);
  const initialWaterMm = atmosphereWaterStorageMm(column);
  const initialMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  free.cloudWaterMm = initialCloudWaterMm;
  let condensationMm = 0;
  let cloudEvaporationMm = 0;

  const condense = requestedMm => {
    const amount = Math.min(
      Math.max(0, requestedMm),
      Math.max(0, free.precipitableWaterMm),
      Math.max(0, MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM - free.cloudWaterMm -
        finite(free.cloudIceMm))
    );
    free.precipitableWaterMm -= amount;
    free.cloudWaterMm += amount;
    free.airTemperatureC += amount * LATENT_HEAT_VAPORIZATION_J_KG / freeHeatCapacityJm2K;
    condensationMm += amount;
    return amount;
  };
  const evaporateCloud = requestedMm => {
    const amount = maximumFreeTroposphereCloudEvaporationMm(column, requestedMm);
    free.cloudWaterMm -= amount;
    free.precipitableWaterMm += amount;
    free.airTemperatureC -= amount * LATENT_HEAT_VAPORIZATION_J_KG / freeHeatCapacityJm2K;
    cloudEvaporationMm += amount;
    return amount;
  };

  condense(Math.max(0, free.precipitableWaterMm - freeTroposphereVaporCapacityMm(free.airTemperatureC)));
  const relativeSaturation = clamp(
    free.precipitableWaterMm / Math.max(.01, freeTroposphereVaporCapacityMm(free.airTemperatureC)),
    0,
    1.4
  );
  const targetCloudWaterMm = clamp(
    free.cloudFraction * clamp((relativeSaturation - .68) / .32) * 2.4,
    0,
    MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM
  );
  const response = 1 - Math.exp(-Math.max(0, finite(dtDays)) * 3.2);
  if (free.cloudWaterMm < targetCloudWaterMm) {
    condense((targetCloudWaterMm - free.cloudWaterMm) * response);
  } else if (free.cloudWaterMm > targetCloudWaterMm) {
    evaporateCloud((free.cloudWaterMm - targetCloudWaterMm) * response);
  }
  syncFreeTroposphereHumidity(column);
  const finalWaterMm = atmosphereWaterStorageMm(column);
  const finalMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  return {
    schema: EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA,
    durationDays: round(dtDays, 9),
    condensationMm: round(condensationMm, 9),
    cloudEvaporationMm: round(cloudEvaporationMm, 9),
    latentHeatingJm2: round((condensationMm - cloudEvaporationMm) * LATENT_HEAT_VAPORIZATION_J_KG, 3),
    initialVaporMm: round(initialVaporMm, 9),
    initialCloudWaterMm: round(initialCloudWaterMm, 9),
    finalVaporMm: round(free.precipitableWaterMm, 9),
    finalCloudWaterMm: round(free.cloudWaterMm, 9),
    initialAirTemperatureC: round(initialAirTemperatureC, 9),
    finalAirTemperatureC: round(free.airTemperatureC, 9),
    waterResidualMm: round(finalWaterMm - initialWaterMm, 9),
    moistEnthalpyResidualJm2: round(finalMoistEnthalpyJm2 - initialMoistEnthalpyJm2, 3),
    truth: {
      waterConservative: true,
      latentHeatCoupledToFreeTroposphere: true,
      directPrecipitation: false,
      resolvedCloudMicrophysics: false
    }
  };
}

function layerVirtualTemperatureK(temperatureC, vaporMm, cloudWaterMm, dryAirKgM2) {
  const vaporMixingRatio = clamp(finite(vaporMm) / Math.max(1e-9, dryAirKgM2), 0, .08);
  const liquidMixingRatio = clamp(finite(cloudWaterMm) / Math.max(1e-9, dryAirKgM2), 0, .04);
  return Math.max(150, finite(temperatureC) + 273.15) *
    Math.max(.9, 1 + .61 * vaporMixingRatio - liquidMixingRatio);
}

function verticalAtmosphereExchange(column, dtDays) {
  const atmosphere = column.atmosphere;
  const free = atmosphere.freeTroposphere;
  synchronizeWindVector(atmosphere);
  synchronizeWindVector(free);
  const capacities = atmosphereLayerHeatCapacitiesJm2K(column);
  const layerMasses = atmosphereLayerDryAirMassesKgM2(column);
  const boundaryDryAirKgM2 = layerMasses.boundaryLayerKgM2;
  const freeDryAirKgM2 = layerMasses.freeTroposphereKgM2;
  const initialWaterMm = atmosphereWaterStorageMm(column);
  const initialMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  const initialGeopotentialEnergyJm2 = atmosphereGeopotentialEnergyJm2(column);
  const initialConvectiveKineticEnergyJm2 = clamp(
    finite(atmosphere.convectiveKineticEnergyJm2),
    0,
    MAX_CONVECTIVE_KINETIC_ENERGY_J_M2
  );
  const initialBoundaryTemperatureC = atmosphere.airTemperatureC;
  const initialFreeTemperatureC = free.airTemperatureC;
  const initialBoundaryVaporMm = finite(atmosphere.precipitableWaterMm);
  const initialFreeVaporMm = finite(free.precipitableWaterMm);
  const initialBoundaryCloudWaterMm = finite(atmosphere.cloudWaterMm);
  const initialFreeCloudWaterMm = finite(free.cloudWaterMm);
  const initialLapseRateKPerKm = verticalLapseRateKPerKm(column);
  const moistureSignal = clamp(
    (atmosphere.relativeHumidity + free.relativeHumidity) * .42 +
      (atmosphere.cloudWaterMm + free.cloudWaterMm) / 8 * .16
  );
  const criticalLapseRateKPerKm = 9.8 - moistureSignal * 3.4;
  const instabilityKPerKm = Math.max(0, initialLapseRateKPerKm - criticalLapseRateKPerKm);
  const backgroundFraction = clamp(.004 * dtDays, 0, .008);
  const instabilityFraction = (1 - Math.exp(-instabilityKPerKm * dtDays * .22)) * .35;
  const exchangeFraction = clamp(backgroundFraction + instabilityFraction, 0, .35);
  const grossDryAirExchangeKgM2 = Math.min(boundaryDryAirKgM2, freeDryAirKgM2) *
    exchangeFraction;

  const initialBoundaryEastwardWindMps = atmosphere.eastwardWindMps;
  const initialBoundaryNorthwardWindMps = atmosphere.northwardWindMps;
  const initialFreeEastwardWindMps = free.eastwardWindMps;
  const initialFreeNorthwardWindMps = free.northwardWindMps;
  const initialEastwardMomentumKgMpsM2 =
    boundaryDryAirKgM2 * initialBoundaryEastwardWindMps +
    freeDryAirKgM2 * initialFreeEastwardWindMps;
  const initialNorthwardMomentumKgMpsM2 =
    boundaryDryAirKgM2 * initialBoundaryNorthwardWindMps +
    freeDryAirKgM2 * initialFreeNorthwardWindMps;
  const initialKineticEnergyJm2 = .5 * (
    boundaryDryAirKgM2 * (initialBoundaryEastwardWindMps ** 2 + initialBoundaryNorthwardWindMps ** 2) +
    freeDryAirKgM2 * (initialFreeEastwardWindMps ** 2 + initialFreeNorthwardWindMps ** 2)
  );
  const initialResolvedEnergyJm2 = initialMoistEnthalpyJm2 + initialKineticEnergyJm2 +
    initialConvectiveKineticEnergyJm2 + initialGeopotentialEnergyJm2;
  const boundaryEastwardMomentumKgMpsM2 =
    boundaryDryAirKgM2 * initialBoundaryEastwardWindMps +
    grossDryAirExchangeKgM2 * (initialFreeEastwardWindMps - initialBoundaryEastwardWindMps);
  const boundaryNorthwardMomentumKgMpsM2 =
    boundaryDryAirKgM2 * initialBoundaryNorthwardWindMps +
    grossDryAirExchangeKgM2 * (initialFreeNorthwardWindMps - initialBoundaryNorthwardWindMps);
  const freeEastwardMomentumKgMpsM2 =
    freeDryAirKgM2 * initialFreeEastwardWindMps +
    grossDryAirExchangeKgM2 * (initialBoundaryEastwardWindMps - initialFreeEastwardWindMps);
  const freeNorthwardMomentumKgMpsM2 =
    freeDryAirKgM2 * initialFreeNorthwardWindMps +
    grossDryAirExchangeKgM2 * (initialBoundaryNorthwardWindMps - initialFreeNorthwardWindMps);
  atmosphere.eastwardWindMps = boundaryEastwardMomentumKgMpsM2 / boundaryDryAirKgM2;
  atmosphere.northwardWindMps = boundaryNorthwardMomentumKgMpsM2 / boundaryDryAirKgM2;
  free.eastwardWindMps = freeEastwardMomentumKgMpsM2 / freeDryAirKgM2;
  free.northwardWindMps = freeNorthwardMomentumKgMpsM2 / freeDryAirKgM2;
  synchronizeWindVector(atmosphere);
  synchronizeWindVector(free);
  const finalEastwardMomentumKgMpsM2 =
    boundaryDryAirKgM2 * atmosphere.eastwardWindMps + freeDryAirKgM2 * free.eastwardWindMps;
  const finalNorthwardMomentumKgMpsM2 =
    boundaryDryAirKgM2 * atmosphere.northwardWindMps + freeDryAirKgM2 * free.northwardWindMps;
  const finalKineticEnergyJm2 = .5 * (
    boundaryDryAirKgM2 * (atmosphere.eastwardWindMps ** 2 + atmosphere.northwardWindMps ** 2) +
    freeDryAirKgM2 * (free.eastwardWindMps ** 2 + free.northwardWindMps ** 2)
  );
  const momentumMixingDissipationJm2 = Math.max(0, initialKineticEnergyJm2 - finalKineticEnergyJm2);
  const verticalReferenceSeparationM = Math.max(0,
    finite(free.referenceAltitudeM, FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M) -
      BOUNDARY_LAYER_REFERENCE_ALTITUDE_M);
  const grossUpwardGeopotentialEnergyJm2 = grossDryAirExchangeKgM2 *
    STANDARD_GRAVITY_MPS2 * verticalReferenceSeparationM;

  const sensibleHeatUpwardJm2 = (atmosphere.airTemperatureC - free.airTemperatureC) *
    Math.min(capacities.boundaryLayerJm2K, capacities.freeTroposphereJm2K) * exchangeFraction;
  atmosphere.airTemperatureC -= sensibleHeatUpwardJm2 / capacities.boundaryLayerJm2K;
  free.airTemperatureC += sensibleHeatUpwardJm2 / capacities.freeTroposphereJm2K;

  const transferTracer = (boundaryKey, freeKey, bounds) => {
    const boundaryMixingRatio = finite(atmosphere[boundaryKey]) /
      Math.max(1e-9, boundaryDryAirKgM2);
    const freeMixingRatio = finite(free[freeKey]) /
      Math.max(1e-9, freeDryAirKgM2);
    const requestedUpward = grossDryAirExchangeKgM2 *
      (boundaryMixingRatio - freeMixingRatio);
    let appliedUpward = requestedUpward;
    if (requestedUpward >= 0) {
      appliedUpward = Math.min(
        requestedUpward,
        Math.max(0, finite(atmosphere[boundaryKey]) - bounds.boundaryMin),
        Math.max(0, bounds.freeMax - finite(free[freeKey]))
      );
    } else {
      appliedUpward = -Math.min(
        -requestedUpward,
        Math.max(0, finite(free[freeKey]) - bounds.freeMin),
        Math.max(0, bounds.boundaryMax - finite(atmosphere[boundaryKey]))
      );
    }
    atmosphere[boundaryKey] -= appliedUpward;
    free[freeKey] += appliedUpward;
    return appliedUpward;
  };

  const vaporUpwardMm = transferTracer('precipitableWaterMm', 'precipitableWaterMm', {
    boundaryMin: MIN_ATMOSPHERIC_WATER_MM,
    boundaryMax: MAX_ATMOSPHERIC_WATER_MM,
    freeMin: 0,
    freeMax: MAX_FREE_TROPOSPHERE_WATER_MM
  });
  const cloudWaterUpwardMm = transferTracer('cloudWaterMm', 'cloudWaterMm', {
    boundaryMin: 0,
    boundaryMax: MAX_CLOUD_WATER_MM,
    freeMin: 0,
    freeMax: MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM
  });

  const liftedBoundaryTemperatureC = initialBoundaryTemperatureC -
    criticalLapseRateKPerKm * verticalReferenceSeparationM / 1000;
  const liftedBoundaryVirtualTemperatureK = layerVirtualTemperatureK(
    liftedBoundaryTemperatureC,
    initialBoundaryVaporMm,
    initialBoundaryCloudWaterMm,
    boundaryDryAirKgM2
  );
  const ambientFreeVirtualTemperatureK = layerVirtualTemperatureK(
    initialFreeTemperatureC,
    initialFreeVaporMm,
    initialFreeCloudWaterMm,
    freeDryAirKgM2
  );
  const rawBuoyancyAccelerationMps2 = STANDARD_GRAVITY_MPS2 *
    (liftedBoundaryVirtualTemperatureK - ambientFreeVirtualTemperatureK) /
    Math.max(150, ambientFreeVirtualTemperatureK);
  const buoyancyAccelerationMps2 = instabilityKPerKm > 0
    ? clamp(rawBuoyancyAccelerationMps2, 0, .6)
    : 0;
  const requestedBuoyancyWorkJm2 = grossDryAirExchangeKgM2 *
    buoyancyAccelerationMps2 * verticalReferenceSeparationM;
  const convectiveDissipationFraction = clamp(
    1 - Math.exp(-dtDays / CONVECTIVE_DISSIPATION_TIMESCALE_DAYS),
    0,
    1
  );
  const convectiveDissipationJm2 = initialConvectiveKineticEnergyJm2 *
    convectiveDissipationFraction;
  const retainedConvectiveKineticEnergyJm2 = initialConvectiveKineticEnergyJm2 -
    convectiveDissipationJm2;
  const availableConvectiveCapacityJm2 = Math.max(0,
    MAX_CONVECTIVE_KINETIC_ENERGY_J_M2 - retainedConvectiveKineticEnergyJm2);
  const availableBoundaryThermalEnergyJm2 = Math.max(0,
    (atmosphere.airTemperatureC + 273.15 - 180) * capacities.boundaryLayerJm2K);
  const buoyancyWorkJm2 = Math.min(
    requestedBuoyancyWorkJm2,
    availableConvectiveCapacityJm2,
    availableBoundaryThermalEnergyJm2
  );
  const thermalizedKineticEnergyJm2 = momentumMixingDissipationJm2 +
    convectiveDissipationJm2;
  const boundaryThermalizationFraction = clamp(
    capacities.boundaryLayerJm2K /
      Math.max(1, capacities.boundaryLayerJm2K + capacities.freeTroposphereJm2K),
    .08,
    .5
  );
  atmosphere.airTemperatureC +=
    (thermalizedKineticEnergyJm2 * boundaryThermalizationFraction - buoyancyWorkJm2) /
    capacities.boundaryLayerJm2K;
  free.airTemperatureC +=
    thermalizedKineticEnergyJm2 * (1 - boundaryThermalizationFraction) /
    capacities.freeTroposphereJm2K;
  atmosphere.convectiveKineticEnergyJm2 = retainedConvectiveKineticEnergyJm2 +
    buoyancyWorkJm2;
  atmosphere.verticalVelocityProxyMps = clamp(Math.sqrt(
    2 * atmosphere.convectiveKineticEnergyJm2 /
      Math.max(1, boundaryDryAirKgM2 + freeDryAirKgM2)
  ), 0, 90);
  syncAtmosphericHumidity(column);
  syncFreeTroposphereHumidity(column);

  const finalWaterMm = atmosphereWaterStorageMm(column);
  const finalMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  const finalGeopotentialEnergyJm2 = atmosphereGeopotentialEnergyJm2(column);
  const finalResolvedEnergyJm2 = finalMoistEnthalpyJm2 + finalKineticEnergyJm2 +
    atmosphere.convectiveKineticEnergyJm2 + finalGeopotentialEnergyJm2;
  const moistEnthalpyChangeJm2 = finalMoistEnthalpyJm2 - initialMoistEnthalpyJm2;
  const expectedMoistEnthalpyChangeJm2 = thermalizedKineticEnergyJm2 - buoyancyWorkJm2;
  return {
    schema: EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA,
    durationDays: round(dtDays, 9),
    exchangeFraction: round(exchangeFraction, 12),
    boundaryDryAirKgM2: round(boundaryDryAirKgM2, 9),
    freeDryAirKgM2: round(freeDryAirKgM2, 9),
    grossDryAirExchangeKgM2: round(grossDryAirExchangeKgM2, 9),
    grossUpdraftDryAirKgM2: round(grossDryAirExchangeKgM2, 9),
    grossCompensatingDowndraftDryAirKgM2: round(grossDryAirExchangeKgM2, 9),
    dryAirMassContinuityResidualKgM2: 0,
    grossUpwardGeopotentialEnergyJm2: round(grossUpwardGeopotentialEnergyJm2, 3),
    grossDownwardGeopotentialEnergyJm2: round(grossUpwardGeopotentialEnergyJm2, 3),
    grossUpwardPressureExpansionWorkJm2: round(grossUpwardGeopotentialEnergyJm2, 3),
    grossDownwardPressureCompressionWorkJm2: round(grossUpwardGeopotentialEnergyJm2, 3),
    netHydrostaticPressureWorkJm2: 0,
    netGeopotentialEnergyChangeJm2: round(
      finalGeopotentialEnergyJm2 - initialGeopotentialEnergyJm2,
      3
    ),
    initialLapseRateKPerKm: round(initialLapseRateKPerKm, 9),
    criticalLapseRateKPerKm: round(criticalLapseRateKPerKm, 9),
    finalLapseRateKPerKm: round(verticalLapseRateKPerKm(column), 9),
    instabilityKPerKm: round(instabilityKPerKm, 9),
    liftedBoundaryVirtualTemperatureK: round(liftedBoundaryVirtualTemperatureK, 9),
    ambientFreeVirtualTemperatureK: round(ambientFreeVirtualTemperatureK, 9),
    rawBuoyancyAccelerationMps2: round(rawBuoyancyAccelerationMps2, 9),
    buoyancyAccelerationMps2: round(buoyancyAccelerationMps2, 9),
    requestedBuoyancyWorkJm2: round(requestedBuoyancyWorkJm2, 3),
    buoyancyWorkJm2: round(buoyancyWorkJm2, 3),
    sensibleHeatUpwardJm2: round(sensibleHeatUpwardJm2, 3),
    initialBoundaryEastwardWindMps: round(initialBoundaryEastwardWindMps, 9),
    initialBoundaryNorthwardWindMps: round(initialBoundaryNorthwardWindMps, 9),
    initialFreeEastwardWindMps: round(initialFreeEastwardWindMps, 9),
    initialFreeNorthwardWindMps: round(initialFreeNorthwardWindMps, 9),
    finalBoundaryEastwardWindMps: round(atmosphere.eastwardWindMps, 9),
    finalBoundaryNorthwardWindMps: round(atmosphere.northwardWindMps, 9),
    finalFreeEastwardWindMps: round(free.eastwardWindMps, 9),
    finalFreeNorthwardWindMps: round(free.northwardWindMps, 9),
    eastwardMomentumResidualKgMpsM2: round(
      finalEastwardMomentumKgMpsM2 - initialEastwardMomentumKgMpsM2, 9),
    northwardMomentumResidualKgMpsM2: round(
      finalNorthwardMomentumKgMpsM2 - initialNorthwardMomentumKgMpsM2, 9),
    initialKineticEnergyJm2: round(initialKineticEnergyJm2, 3),
    finalKineticEnergyJm2: round(finalKineticEnergyJm2, 3),
    momentumMixingDissipationJm2: round(momentumMixingDissipationJm2, 3),
    momentumMixingThermalizationJm2: round(momentumMixingDissipationJm2, 3),
    kineticEnergyResidualJm2: round(
      finalKineticEnergyJm2 + momentumMixingDissipationJm2 - initialKineticEnergyJm2,
      3
    ),
    initialConvectiveKineticEnergyJm2: round(initialConvectiveKineticEnergyJm2, 3),
    convectiveDissipationFraction: round(convectiveDissipationFraction, 12),
    convectiveDissipationJm2: round(convectiveDissipationJm2, 3),
    thermalizedKineticEnergyJm2: round(thermalizedKineticEnergyJm2, 3),
    finalConvectiveKineticEnergyJm2: round(atmosphere.convectiveKineticEnergyJm2, 3),
    verticalVelocityProxyMps: round(atmosphere.verticalVelocityProxyMps, 9),
    convectiveKineticEnergyResidualJm2: round(
      atmosphere.convectiveKineticEnergyJm2 + convectiveDissipationJm2 -
        initialConvectiveKineticEnergyJm2 - buoyancyWorkJm2,
      3
    ),
    vaporUpwardMm: round(vaporUpwardMm, 9),
    cloudWaterUpwardMm: round(cloudWaterUpwardMm, 9),
    initialBoundaryVaporMm: round(initialBoundaryVaporMm, 9),
    initialFreeVaporMm: round(initialFreeVaporMm, 9),
    finalBoundaryVaporMm: round(atmosphere.precipitableWaterMm, 9),
    finalFreeVaporMm: round(free.precipitableWaterMm, 9),
    initialBoundaryCloudWaterMm: round(initialBoundaryCloudWaterMm, 9),
    initialFreeCloudWaterMm: round(initialFreeCloudWaterMm, 9),
    finalBoundaryCloudWaterMm: round(atmosphere.cloudWaterMm, 9),
    finalFreeCloudWaterMm: round(free.cloudWaterMm, 9),
    initialBoundaryTemperatureC: round(initialBoundaryTemperatureC, 9),
    initialFreeTemperatureC: round(initialFreeTemperatureC, 9),
    finalBoundaryTemperatureC: round(atmosphere.airTemperatureC, 9),
    finalFreeTemperatureC: round(free.airTemperatureC, 9),
    hydrostaticPressureResidualHpa: round(
      atmosphere.boundaryLayerPressureHpa + free.pressureThicknessHpa - atmosphere.surfacePressureHpa,
      12
    ),
    waterResidualMm: round(finalWaterMm - initialWaterMm, 9),
    moistEnthalpyChangeJm2: round(moistEnthalpyChangeJm2, 3),
    expectedMoistEnthalpyChangeJm2: round(expectedMoistEnthalpyChangeJm2, 3),
    moistEnthalpyResidualJm2: round(
      moistEnthalpyChangeJm2 - expectedMoistEnthalpyChangeJm2,
      3
    ),
    initialResolvedEnergyJm2: round(initialResolvedEnergyJm2, 3),
    finalResolvedEnergyJm2: round(finalResolvedEnergyJm2, 3),
    resolvedEnergyResidualJm2: round(finalResolvedEnergyJm2 - initialResolvedEnergyJm2, 3),
    truth: {
      equalGrossDryAirParcelExchange: true,
      explicitUpdraftAndCompensatingDowndraft: true,
      netDryAirLayerMassChange: false,
      convectiveMassContinuityClosed: true,
      tracersCarriedByParcelMixingRatioContrast: true,
      horizontalMomentumCarriedByParcelExchange: true,
      verticalMomentumConservative: true,
      momentumMixingDissipationReceipted: true,
      momentumMixingDissipationThermalized: true,
      waterConservative: true,
      moistEnthalpyConservative: buoyancyWorkJm2 === 0 && thermalizedKineticEnergyJm2 === 0,
      moistEnthalpyMechanicalConversionClosed: true,
      resolvedEnergyConservative: true,
      hydrostaticPressurePartitionClosed: true,
      equalGrossGeopotentialExchange: true,
      hydrostaticPressureWorkReceipted: true,
      geopotentialExchangeReceipted: true,
      convectiveKineticEnergyReservoir: true,
      buoyancyWorkResolved: true,
      boundedTwoLayerParameterization: true,
      threeDimensionalConvection: false
    }
  };
}

function atmosphericEvaporationCapacityMm(column) {
  return Math.max(0, MAX_ATMOSPHERIC_WATER_MM - column.atmosphere.precipitableWaterMm);
}

function returnEvaporationToAtmosphere(column, evaporationMm) {
  column.atmosphere.precipitableWaterMm = clamp(
    column.atmosphere.precipitableWaterMm + evaporationMm,
    0,
    Math.max(MIN_ATMOSPHERIC_WATER_MM, MAX_ATMOSPHERIC_WATER_MM -
      finite(column.atmosphere.cloudWaterMm) - finite(column.atmosphere.cloudIceMm))
  );
  syncAtmosphericHumidity(column);
}

function atmosphereEnergyBudget(
  column,
  waterContext,
  evaporationMm,
  phaseChange,
  freePhaseChange,
  verticalExchange,
  pressureDynamics
) {
  const finalMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  const surfaceLatentInputJm2 = evaporationMm * LATENT_HEAT_VAPORIZATION_J_KG;
  const verticalMechanicalConversionJm2 = finite(verticalExchange?.moistEnthalpyChangeJm2);
  const nativeMomentumMixingConversionJm2 = finite(
    pressureDynamics?.momentumMixingDissipationJm2
  );
  const surfacePrecipitationPhaseEnthalpyJm2 = -finite(
    pressureDynamics?.surfaceSnowfallMm
  ) * PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  return {
    initialMoistEnthalpyJm2: waterContext.initialMoistEnthalpyJm2,
    requestedBoundaryMoistEnthalpyJm2:
      waterContext.requestedBoundaryMoistEnthalpyJm2,
    boundaryMoistEnthalpyJm2: waterContext.boundaryMoistEnthalpyJm2,
    boundaryNativeEnvelopeReconciliationJm2:
      waterContext.boundaryNativeEnvelopeReconciliationJm2,
    boundaryEnergyReceipt: clone(waterContext.boundaryEnergyReceipt),
    phaseChangeLatentHeatingJm2: phaseChange.latentHeatingJm2 + freePhaseChange.latentHeatingJm2,
    surfaceLatentInputJm2,
    surfacePrecipitationPhaseEnthalpyJm2,
    verticalMechanicalConversionJm2,
    nativeMomentumMixingConversionJm2,
    finalMoistEnthalpyJm2,
    residualJm2: finalMoistEnthalpyJm2 + surfacePrecipitationPhaseEnthalpyJm2 -
      waterContext.initialMoistEnthalpyJm2 -
      waterContext.boundaryMoistEnthalpyJm2 - surfaceLatentInputJm2 -
      verticalMechanicalConversionJm2 - nativeMomentumMixingConversionJm2
  };
}

function snowAgeAfterStep(initialSnowMm, initialAgeDays, snowfallMm, finalSnowMm, dtDays) {
  if (finalSnowMm <= 1e-9) return 0;
  const combinedSnowMm = Math.max(0, initialSnowMm) + Math.max(0, snowfallMm);
  const mixedAgeDays = combinedSnowMm > 1e-9
    ? Math.max(0, finite(initialAgeDays)) * Math.max(0, initialSnowMm) / combinedSnowMm
    : 0;
  return clamp(mixedAgeDays + dtDays, 0, 3650);
}

function cryospherePhaseReceipt({
  kind,
  initialSnowMm,
  finalSnowMm,
  initialSeaIceMm = 0,
  finalSeaIceMm = 0,
  snowfallMm = 0,
  snowmeltMm = 0,
  snowSublimationMm = 0,
  seaIceFreezeMm = 0,
  seaIceMeltMm = 0,
  freezingPointC = 0
}) {
  const initialFrozenWaterMm = Math.max(0, initialSnowMm) + Math.max(0, initialSeaIceMm);
  const finalFrozenWaterMm = Math.max(0, finalSnowMm) + Math.max(0, finalSeaIceMm);
  const initialPhaseEnthalpyJm2 = -initialFrozenWaterMm *
    PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  const finalPhaseEnthalpyJm2 = -finalFrozenWaterMm *
    PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  const precipitationPhaseInputJm2 = -Math.max(0, snowfallMm) *
    PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  const phaseStorageChangeJm2 = finalPhaseEnthalpyJm2 - initialPhaseEnthalpyJm2;
  const sensibleToFusionJm2 = phaseStorageChangeJm2 - precipitationPhaseInputJm2;
  return {
    schema: EARTH_CRYOSPHERE_PHASE_SCHEMA,
    kind,
    initialSnowWaterEquivalentMm: initialSnowMm,
    finalSnowWaterEquivalentMm: finalSnowMm,
    initialSeaIceWaterEquivalentMm: initialSeaIceMm,
    finalSeaIceWaterEquivalentMm: finalSeaIceMm,
    snowfallMm,
    snowmeltMm,
    snowSublimationMm,
    seaIceFreezeMm,
    seaIceMeltMm,
    freezingPointC,
    initialFrozenWaterMm,
    finalFrozenWaterMm,
    initialPhaseEnthalpyJm2,
    precipitationPhaseInputJm2,
    sensibleToFusionJm2,
    finalPhaseEnthalpyJm2,
    phaseStorageChangeJm2,
    residualJm2: finalPhaseEnthalpyJm2 - initialPhaseEnthalpyJm2 -
      precipitationPhaseInputJm2 - sensibleToFusionJm2,
    truth: {
      frozenWaterMassReceipted: true,
      latentHeatOfFusionReceipted: true,
      snowAndSeaIceIndependent: true,
      resolvedSnowGrainsOrSeaIceDynamics: false
    }
  };
}

function seawaterFreezingPointC(salinityPsu) {
  return clamp(-.0575 * clamp(finite(salinityPsu, 35), 2, 43), -2.5, -.1);
}

function synchronizeSeaIceGeometry(column) {
  const waterEquivalentMm = clamp(
    finite(column.cryosphere.seaIceWaterEquivalentMm), 0, 5000
  );
  if (waterEquivalentMm <= 1e-9) {
    column.cryosphere.seaIceWaterEquivalentMm = 0;
    column.cryosphere.seaIceFraction = 0;
    column.cryosphere.seaIceThicknessM = 0;
    return;
  }
  const meanIceThicknessM = waterEquivalentMm / 1000 *
    WATER_DENSITY_KG_M3 / ICE_DENSITY_KG_M3;
  const concentration = clamp(1 - Math.exp(-meanIceThicknessM / .16), .01, 1);
  column.cryosphere.seaIceWaterEquivalentMm = waterEquivalentMm;
  column.cryosphere.seaIceFraction = concentration;
  column.cryosphere.seaIceThicknessM = clamp(meanIceThicknessM / concentration, .02, 5);
}

function energyStep(column, weather, evaporationMm, dtDays, cryospherePhase) {
  column.surface.albedo = albedoFor(column);
  const radiation = computeSurfaceRadiation(column, weather);
  column.surface.lastRadiationReceipt = radiation;
  const wind = clamp(finite(weather?.windSpeedMps, 2), 0, 80);
  const vegetationRoughnessM = column.kind === 'land' &&
    column.land?.ecology?.physiology?.active === true
    ? Math.max(.003, finite(column.land.ecology.aerodynamicRoughnessM, .003))
    : .003;
  const roughnessExchangeFactor = column.kind === 'land'
    ? clamp(.72 + Math.log1p(vegetationRoughnessM * 28) * .36, .72, 2.15)
    : 1;
  const sensibleWm2 = clamp(3.6 * roughnessExchangeFactor * (1 + wind * .12) *
    (column.surface.temperatureC - column.atmosphere.airTemperatureC), -180, 240);
  const latentWm2 = Math.max(0, evaporationMm / Math.max(dtDays, 1e-9) *
    LATENT_HEAT_VAPORIZATION_J_KG / DAY_SECONDS);
  const netSurfaceFluxWm2 = radiation.netRadiationWm2 - sensibleWm2 - latentWm2;
  const targetTemperature = finite(weather?.seasonalTemperatureC, column.surface.temperatureC) -
    (column.surface.albedo - .2) * (column.kind === 'ocean' ? 5 : 8);
  const timeConstantDays = column.kind === 'ocean' ? Math.max(9, column.ocean.mixedLayerDepthM * .34) : 2.8;
  const heatCapacityJm2K = column.kind === 'ocean'
    ? WATER_HEAT_CAPACITY_J_M3_K * column.ocean.mixedLayerDepthM
    : 2.35e6 + finite(column.substrate?.soilDepthM) * 1.15e6;
  const elapsedSeconds = Math.max(1, dtDays * DAY_SECONDS);
  const surfaceFluxEnergyJm2 = netSurfaceFluxWm2 * elapsedSeconds;
  const relaxationTemperatureChange = (targetTemperature - column.surface.temperatureC) *
    (1 - Math.exp(-dtDays / timeConstantDays));
  const prescribedBoundaryHeatEnergyJm2 = relaxationTemperatureChange * heatCapacityJm2K;
  const phaseStorageChangeJm2 = finite(cryospherePhase?.phaseStorageChangeJm2);
  const precipitationPhaseInputJm2 = finite(cryospherePhase?.precipitationPhaseInputJm2);
  const unboundedSensibleStorageChangeJm2 = surfaceFluxEnergyJm2 +
    prescribedBoundaryHeatEnergyJm2 + precipitationPhaseInputJm2 - phaseStorageChangeJm2;
  const unboundedTemperatureChangeC = unboundedSensibleStorageChangeJm2 / heatCapacityJm2K;
  const temperatureChange = clamp(unboundedTemperatureChangeC, -12 * dtDays, 12 * dtDays);
  const sensibleStorageChangeJm2 = temperatureChange * heatCapacityJm2K;
  const stabilityLimiterHeatEnergyJm2 = sensibleStorageChangeJm2 -
    unboundedSensibleStorageChangeJm2;
  const boundaryHeatEnergyJm2 = prescribedBoundaryHeatEnergyJm2 +
    stabilityLimiterHeatEnergyJm2;
  const storageChangeJm2 = sensibleStorageChangeJm2 + phaseStorageChangeJm2;
  const boundaryHeatFluxWm2 = boundaryHeatEnergyJm2 / elapsedSeconds;
  column.surface.temperatureC += temperatureChange;
  if (column.ocean) {
    column.ocean.mixedLayerTemperatureC = column.surface.temperatureC;
    column.ocean.heatContentJm2 = column.ocean.mixedLayerTemperatureC * heatCapacityJm2K;
  }
  return {
    netSurfaceFluxWm2,
    boundaryHeatFluxWm2,
    surfaceFluxEnergyJm2,
    boundaryHeatEnergyJm2,
    prescribedBoundaryHeatEnergyJm2,
    stabilityLimiterHeatEnergyJm2,
    sensibleStorageChangeJm2,
    phaseStorageChangeJm2,
    precipitationPhaseInputJm2,
    storageChangeJm2,
    residualJm2: storageChangeJm2 - surfaceFluxEnergyJm2 - boundaryHeatEnergyJm2 -
      precipitationPhaseInputJm2,
    radiation,
    netRadiationWm2: radiation.netRadiationWm2,
    latentHeatWm2: latentWm2,
    sensibleHeatWm2: sensibleWm2,
    cryospherePhaseChangeWm2: finite(cryospherePhase?.sensibleToFusionJm2) /
      elapsedSeconds
  };
}

function advanceLand(column, weather, sample, dtDays, options, waterContext) {
  const substrate = column.substrate;
  const initialStorageMm = waterContext.initialStorageMm;
  const desiredPrecipitationMm = dailyPrecipitation(weather, sample) * dtDays;
  const pressureDynamics = advancePressureColumnDynamics(column, {
    durationDays: dtDays,
    desiredPrecipitationMm,
    reason: 'local-pressure-level-thermodynamics',
    boundaryPhaseSchema: EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA,
    freePhaseSchema: EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA,
    verticalExchangeSchema: EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA
  });
  const phaseChange = pressureDynamics.phaseChange;
  const freePhaseChange = pressureDynamics.freePhaseChange;
  const verticalExchange = pressureDynamics.verticalExchange;
  const precipitationMm = pressureDynamics.precipitationMm;
  const rainfallMm = pressureDynamics.rainfallMm;
  const snowfallMm = pressureDynamics.snowfallMm;
  const initialSnowMm = column.cryosphere.snowWaterEquivalentMm;
  const initialSnowAgeDays = finite(column.cryosphere.snowAgeDays);
  column.cryosphere.snowWaterEquivalentMm += snowfallMm;
  column.cryosphere.snowAgeDays = column.cryosphere.snowWaterEquivalentMm > 1e-9
    ? initialSnowAgeDays * initialSnowMm /
      Math.max(1e-9, column.cryosphere.snowWaterEquivalentMm)
    : 0;
  column.surface.albedo = albedoFor(column);
  const preliminaryRadiation = computeSurfaceRadiation(column, weather);
  const phaseTemperatureC = column.surface.temperatureC * .34 +
    finite(weather?.seasonalTemperatureC, column.atmosphere.airTemperatureC) * .66;
  const radiativeMeltPotentialMm = Math.max(0, preliminaryRadiation.netRadiationWm2) *
    dtDays * DAY_SECONDS / PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG * .18;
  const meltPotentialMm = Math.max(0, phaseTemperatureC) * 1.45 * dtDays *
    clamp(finite(weather?.solar?.daylightHours, 12) / 12, .15, 1.8) +
    radiativeMeltPotentialMm;
  const snowmeltMm = Math.min(column.cryosphere.snowWaterEquivalentMm, meltPotentialMm);
  column.cryosphere.snowWaterEquivalentMm -= snowmeltMm;
  const potentialEtMm = Math.min(
    Math.max(0, finite(weather?.evapotranspirationMmDay)) * dtDays,
    atmosphericEvaporationCapacityMm(column)
  );
  const sublimationMm = Math.min(column.cryosphere.snowWaterEquivalentMm, potentialEtMm * .1);
  column.cryosphere.snowWaterEquivalentMm -= sublimationMm;

  let mobileWaterMm = rainfallMm + snowmeltMm + column.surface.pondedWaterMm;
  column.surface.pondedWaterMm = 0;
  const frozenSuppression = 1 - column.cryosphere.soilFrozenFraction * .88;
  const infiltrationCapacityMm = substrate.conductivityMmDay * frozenSuppression * dtDays;
  const rootSpaceMm = Math.max(0, substrate.rootCapacityMm - column.land.rootZoneWaterMm);
  const infiltrationMm = Math.min(mobileWaterMm, infiltrationCapacityMm, rootSpaceMm);
  column.land.rootZoneWaterMm += infiltrationMm;
  mobileWaterMm -= infiltrationMm;
  column.surface.pondedWaterMm = Math.min(12, mobileWaterMm);
  let surfaceRunoffMm = Math.max(0, mobileWaterMm - column.surface.pondedWaterMm);

  const vegetationEnabled = options.livingEnabled !== false &&
    finite(options.lifeAbundance, 1) > 0;
  const ecologyDemand = landEcologyWaterDemand(column.land.ecology, {
    potentialEvapotranspirationMm: potentialEtMm,
    rootZonePlantAvailableFraction: clamp((column.land.rootZoneWaterMm -
      substrate.rootWiltingPointMm) /
      Math.max(1, substrate.rootFieldCapacityMm - substrate.rootWiltingPointMm)),
    soilFrozenFraction: column.cryosphere.soilFrozenFraction
  }, {
    enabled: vegetationEnabled,
    lifeAbundance: finite(options.lifeAbundance, 1),
    substrate,
    sample
  });
  const surfaceEvaporationMm = Math.min(column.surface.pondedWaterMm,
    potentialEtMm * .32);
  column.surface.pondedWaterMm -= surfaceEvaporationMm;
  const availableAboveWilt = Math.max(0, column.land.rootZoneWaterMm - substrate.rootWiltingPointMm);
  const waterStress = clamp(availableAboveWilt / Math.max(1, substrate.rootFieldCapacityMm - substrate.rootWiltingPointMm));
  const transpirationMm = Math.min(
    availableAboveWilt,
    Math.max(0, potentialEtMm - surfaceEvaporationMm),
    ecologyDemand.potentialTranspirationMm * waterStress
  );
  column.land.rootZoneWaterMm -= transpirationMm;
  const bareSoilEvaporationMm = Math.min(
    Math.max(0, column.land.rootZoneWaterMm - substrate.rootWiltingPointMm * .55),
    Math.max(0, potentialEtMm - surfaceEvaporationMm - transpirationMm) *
      (vegetationEnabled ? .58 : .72) * ecologyDemand.bareSoilExposure * waterStress
  );
  column.land.rootZoneWaterMm -= bareSoilEvaporationMm;

  const rootExcessMm = Math.max(0, column.land.rootZoneWaterMm - substrate.rootFieldCapacityMm);
  const percolationMm = Math.min(rootExcessMm, substrate.conductivityMmDay * .31 * dtDays);
  column.land.rootZoneWaterMm -= percolationMm;
  column.land.deepSoilWaterMm += percolationMm;
  if (column.land.deepSoilWaterMm > substrate.deepCapacityMm) {
    const spill = column.land.deepSoilWaterMm - substrate.deepCapacityMm;
    column.land.deepSoilWaterMm = substrate.deepCapacityMm;
    surfaceRunoffMm += spill;
  }
  const deepThresholdMm = substrate.deepFieldCapacityMm;
  const deepExcessMm = Math.max(0, column.land.deepSoilWaterMm - deepThresholdMm);
  const rechargeMm = Math.min(deepExcessMm, substrate.conductivityMmDay * .08 * dtDays);
  column.land.deepSoilWaterMm -= rechargeMm;
  column.land.groundwaterStorageMm += rechargeMm;
  let groundwaterOverflowMm = Math.max(0, column.land.groundwaterStorageMm - substrate.aquiferCapacityMm);
  column.land.groundwaterStorageMm -= groundwaterOverflowMm;

  const rootDeficitMm = Math.max(0, substrate.rootFieldCapacityMm * .72 - column.land.rootZoneWaterMm);
  const waterTableFraction = clamp(column.land.groundwaterStorageMm / Math.max(1, substrate.aquiferCapacityMm));
  const capillaryRiseMm = Math.min(rootDeficitMm, column.land.groundwaterStorageMm,
    substrate.conductivityMmDay * .012 * waterTableFraction * dtDays);
  column.land.groundwaterStorageMm -= capillaryRiseMm;
  column.land.rootZoneWaterMm += capillaryRiseMm;
  const recessionRateDay = .00045 + (1 - aquiferFactor(sample) / 1.35) * .00055;
  const regularBaseflowMm = Math.min(column.land.groundwaterStorageMm,
    column.land.groundwaterStorageMm * recessionRateDay * dtDays);
  column.land.groundwaterStorageMm -= regularBaseflowMm;
  const baseflowMm = groundwaterOverflowMm + regularBaseflowMm;

  const ecologyStep = advanceLandEcology(column.land.ecology, {
    absorbedShortwaveWm2: preliminaryRadiation.absorbedShortwaveWm2,
    temperatureC: phaseTemperatureC,
    rootZonePlantAvailableFraction: clamp((column.land.rootZoneWaterMm -
      substrate.rootWiltingPointMm) /
      Math.max(1, substrate.rootFieldCapacityMm - substrate.rootWiltingPointMm)),
    soilFrozenFraction: column.cryosphere.soilFrozenFraction,
    potentialTranspirationMm: ecologyDemand.potentialTranspirationMm,
    actualTranspirationMm: transpirationMm,
    droughtStress: finite(weather?.droughtIndex)
  }, dtDays, {
    enabled: vegetationEnabled,
    lifeAbundance: finite(options.lifeAbundance, 1),
    substrate,
    sample
  });
  column.land.ecology = ecologyStep.state;
  const evaporationMm = sublimationMm + surfaceEvaporationMm + bareSoilEvaporationMm + transpirationMm;
  returnEvaporationToAtmosphere(column, evaporationMm);
  const generatedRunoffMm = surfaceRunoffMm + baseflowMm;
  column.routing.runoffQueueMm += generatedRunoffMm;
  column.routing.cumulativeGeneratedRunoffMm += generatedRunoffMm;
  const soilBiogeochemistryStep = mobilizeSoilBiogeochemistry(
    column.land.soilBiogeochemistry,
    column.routing.runoffBiogeochemistryQueue,
    generatedRunoffMm,
    {
      sample,
      substrate,
      ecology: column.land.ecology,
      accessibleWaterMm: column.land.rootZoneWaterMm +
        column.land.deepSoilWaterMm + column.land.groundwaterStorageMm,
      temperatureC: phaseTemperatureC
    }
  );
  column.land.soilBiogeochemistry = soilBiogeochemistryStep.state;
  column.routing.runoffBiogeochemistryQueue = soilBiogeochemistryStep.queue;
  const geomorphicSedimentStep = erodeSurfaceSediment(
    column.land.surfaceSediment,
    column.routing.runoffSedimentQueue,
    surfaceRunoffMm,
    {
      sample,
      substrate,
      ecology: column.land.ecology,
      rainfallMm,
      snowmeltMm,
      soilFrozenFraction: column.cryosphere.soilFrozenFraction,
      durationDays: dtDays
    }
  );
  column.land.surfaceSediment = geomorphicSedimentStep.state;
  column.routing.runoffSedimentQueue = geomorphicSedimentStep.queue;
  column.surface.geomorphicElevationAdjustmentM =
    geomorphicSedimentStep.state.geomorphicElevationAdjustmentM;
  column.surface.elevationM = finite(column.surface.baseElevationM,
    finite(sample.elevationM)) +
    column.surface.geomorphicElevationAdjustmentM;
  column.cryosphere.snowAgeDays = snowAgeAfterStep(
    initialSnowMm,
    initialSnowAgeDays,
    snowfallMm,
    column.cryosphere.snowWaterEquivalentMm,
    dtDays
  );
  const cryospherePhase = cryospherePhaseReceipt({
    kind: 'land-snow',
    initialSnowMm,
    finalSnowMm: column.cryosphere.snowWaterEquivalentMm,
    snowfallMm,
    snowmeltMm,
    snowSublimationMm: sublimationMm
  });
  column.cryosphere.lastPhaseChangeReceipt = cryospherePhase;
  const energy = energyStep(column, weather, evaporationMm, dtDays, cryospherePhase);
  const atmosphereEnergy = atmosphereEnergyBudget(
    column, waterContext, evaporationMm, phaseChange, freePhaseChange, verticalExchange,
    pressureDynamics.receipt
  );
  const freezeTarget = clamp((-column.surface.temperatureC + 1) / 14);
  column.cryosphere.soilFrozenFraction += (freezeTarget - column.cryosphere.soilFrozenFraction) * (1 - Math.exp(-dtDays / 3));
  column.surface.albedo = albedoFor(column);
  column.surface.skinWetness = clamp((column.surface.pondedWaterMm / 12) * .35 +
    (column.land.rootZoneWaterMm / Math.max(1, substrate.rootCapacityMm)) * .65);
  column.land.rootZoneSaturation = clamp(column.land.rootZoneWaterMm / Math.max(1, substrate.rootCapacityMm));
  column.land.plantAvailableFraction = clamp((column.land.rootZoneWaterMm - substrate.rootWiltingPointMm) /
    Math.max(1, substrate.rootFieldCapacityMm - substrate.rootWiltingPointMm));
  column.land.waterTableDepthM = substrate.aquiferDepthM *
    (1 - clamp(column.land.groundwaterStorageMm / Math.max(1, substrate.aquiferCapacityMm)));
  const finalStorageMm = earthSystemWaterStorageMm(column);
  const residualMm = finalStorageMm - initialStorageMm - waterContext.boundaryMoistureMm;
  return {
    fluxes: {
      ...emptyFluxes(),
      precipitationMmDay: precipitationMm / dtDays,
      rainfallMmDay: rainfallMm / dtDays,
      snowfallMmDay: snowfallMm / dtDays,
      snowmeltMmDay: snowmeltMm / dtDays,
      evaporationMmDay: (surfaceEvaporationMm + bareSoilEvaporationMm + sublimationMm) / dtDays,
      transpirationMmDay: transpirationMm / dtDays,
      infiltrationMmDay: infiltrationMm / dtDays,
      rechargeMmDay: rechargeMm / dtDays,
      capillaryRiseMmDay: capillaryRiseMm / dtDays,
      surfaceRunoffMmDay: surfaceRunoffMm / dtDays,
      baseflowMmDay: baseflowMm / dtDays,
      freshwaterBalanceMmDay: (precipitationMm - evaporationMm - generatedRunoffMm) / dtDays,
      netRadiationWm2: energy.netRadiationWm2,
      latentHeatWm2: energy.latentHeatWm2,
      sensibleHeatWm2: energy.sensibleHeatWm2,
      absorbedShortwaveWm2: energy.radiation.absorbedShortwaveWm2,
      upwardLongwaveWm2: energy.radiation.upwardLongwaveWm2,
      downwardLongwaveWm2: energy.radiation.downwardLongwaveWm2,
      cloudShortwaveForcingWm2: energy.radiation.cloudShortwaveForcingWm2,
      cloudLongwaveForcingWm2: energy.radiation.cloudLongwaveForcingWm2,
      cryospherePhaseChangeWm2: energy.cryospherePhaseChangeWm2,
      grossPrimaryProductionKgCm2Day:
        ecologyStep.receipt.carbon.grossPrimaryProductionKgCm2 / dtDays,
      autotrophicRespirationKgCm2Day:
        ecologyStep.receipt.carbon.autotrophicRespirationKgCm2 / dtDays,
      heterotrophicRespirationKgCm2Day:
        ecologyStep.receipt.carbon.heterotrophicRespirationKgCm2 / dtDays,
      netAtmosphereCarbonExchangeKgCm2Day:
        ecologyStep.receipt.carbon.netAtmosphereExchangeKgCm2 / dtDays,
      litterfallKgCm2Day: ecologyStep.receipt.carbon.litterfallKgCm2 / dtDays,
      nitrogenUptakeKgNm2Day:
        ecologyStep.receipt.nitrogen.plantUptakeKgNm2 / dtDays,
      condensationMmDay: phaseChange.condensationMm / dtDays,
      cloudEvaporationMmDay: phaseChange.cloudEvaporationMm / dtDays,
      atmosphericLatentHeatingWm2: (phaseChange.latentHeatingJm2 + freePhaseChange.latentHeatingJm2) /
        (dtDays * DAY_SECONDS),
      verticalSensibleHeatWm2: verticalExchange.sensibleHeatUpwardJm2 / (dtDays * DAY_SECONDS),
      verticalBuoyancyConversionWm2: verticalExchange.buoyancyWorkJm2 /
        (dtDays * DAY_SECONDS),
      convectiveKineticDissipationWm2: verticalExchange.convectiveDissipationJm2 /
        (dtDays * DAY_SECONDS),
      convectiveExchangeFractionDay: verticalExchange.exchangeFraction / dtDays
    },
    water: {
      initialStorageMm,
      atmosphericBoundaryMoistureMm: waterContext.boundaryMoistureMm,
      precipitationMm,
      unmetPrecipitationMm: phaseChange.unmetPrecipitationMm,
      evaporationMm,
      generatedRunoffMm,
      exportedRunoffMm: 0,
      finalStorageMm,
      residualMm,
      atmosphere: {
        initialWaterMm: waterContext.initialAtmosphereWaterMm,
        afterBoundaryWaterMm: waterContext.afterBoundaryAtmosphereWaterMm,
        finalWaterMm: atmosphereWaterStorageMm(column),
        finalVaporMm: column.atmosphere.precipitableWaterMm,
        finalCloudWaterMm: column.atmosphere.cloudWaterMm,
        finalCloudIceMm: column.atmosphere.cloudIceMm,
        finalFreeTroposphereVaporMm: column.atmosphere.freeTroposphere.precipitableWaterMm,
        finalFreeTroposphereCloudWaterMm: column.atmosphere.freeTroposphere.cloudWaterMm,
        finalFreeTroposphereCloudIceMm: column.atmosphere.freeTroposphere.cloudIceMm
      }
    },
    energy,
    atmosphereEnergy,
    phaseChange,
    freePhaseChange,
    verticalExchange,
    cryospherePhase,
    landEcology: ecologyStep.receipt,
    soilBiogeochemistry: soilBiogeochemistryStep.receipt,
    geomorphicSediment: geomorphicSedimentStep.receipt,
    oceanEcology: null,
    pressureDynamics: pressureDynamics.receipt
  };
}

function advanceOcean(column, weather, sample, dtDays, options, waterContext) {
  const initialStorageMm = waterContext.initialStorageMm;
  const desiredPrecipitationMm = dailyPrecipitation(weather, sample) * dtDays;
  const pressureDynamics = advancePressureColumnDynamics(column, {
    durationDays: dtDays,
    desiredPrecipitationMm,
    reason: 'local-pressure-level-thermodynamics',
    boundaryPhaseSchema: EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA,
    freePhaseSchema: EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA,
    verticalExchangeSchema: EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA
  });
  const phaseChange = pressureDynamics.phaseChange;
  const freePhaseChange = pressureDynamics.freePhaseChange;
  const verticalExchange = pressureDynamics.verticalExchange;
  const precipitationMm = pressureDynamics.precipitationMm;
  const rainfallMm = pressureDynamics.rainfallMm;
  const snowfallMm = pressureDynamics.snowfallMm;
  const initialSnowMm = finite(column.cryosphere.snowWaterEquivalentMm);
  const initialSnowAgeDays = finite(column.cryosphere.snowAgeDays);
  const initialSeaIceMm = finite(column.cryosphere.seaIceWaterEquivalentMm);
  const snowRetainedOnIceMm = snowfallMm * clamp(column.cryosphere.seaIceFraction);
  let snowmeltMm = snowfallMm - snowRetainedOnIceMm;
  column.cryosphere.snowWaterEquivalentMm = initialSnowMm + snowRetainedOnIceMm;
  column.cryosphere.snowAgeDays = column.cryosphere.snowWaterEquivalentMm > 1e-9
    ? initialSnowAgeDays * initialSnowMm /
      Math.max(1e-9, column.cryosphere.snowWaterEquivalentMm)
    : 0;
  const potentialEvapMm = Math.min(
    Math.max(0, finite(weather?.evapotranspirationMmDay)) * dtDays,
    atmosphericEvaporationCapacityMm(column)
  );
  const iceSuppression = 1 - column.cryosphere.seaIceFraction * .94;
  const snowSublimationMm = Math.min(
    column.cryosphere.snowWaterEquivalentMm,
    potentialEvapMm * .1 * clamp(column.cryosphere.seaIceFraction)
  );
  column.cryosphere.snowWaterEquivalentMm -= snowSublimationMm;
  const oceanEvaporationMm = Math.min(
    atmosphericEvaporationCapacityMm(column),
    Math.max(0, potentialEvapMm - snowSublimationMm) *
      (.72 + clamp(finite(weather?.windSpeedMps) / 40) * .45) * iceSuppression
  );
  const evaporationMm = oceanEvaporationMm + snowSublimationMm;
  column.ocean.freshwaterAnomalyMm += rainfallMm + snowmeltMm - oceanEvaporationMm;
  returnEvaporationToAtmosphere(column, evaporationMm);
  column.surface.albedo = albedoFor(column);
  const preliminaryRadiation = computeSurfaceRadiation(column, weather);
  const freezingPointC = seawaterFreezingPointC(column.ocean.salinityPsu);
  const freezePowerWm2 = Math.max(0,
    (freezingPointC - column.ocean.mixedLayerTemperatureC) * 18 +
    Math.max(0, -preliminaryRadiation.netRadiationWm2) * .08
  );
  const meltPowerWm2 = Math.max(0,
    (column.ocean.mixedLayerTemperatureC - freezingPointC) * 18 +
    Math.max(0, preliminaryRadiation.netRadiationWm2) * .18
  );
  const netThermodynamicIcePotentialMm = (freezePowerWm2 - meltPowerWm2) *
    dtDays * DAY_SECONDS / PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
  const seaIceFreezeMm = clamp(netThermodynamicIcePotentialMm, 0, 120 * dtDays);
  const seaIceMeltMm = Math.min(initialSeaIceMm,
    clamp(-netThermodynamicIcePotentialMm, 0, 120 * dtDays));
  column.cryosphere.seaIceWaterEquivalentMm = clamp(
    initialSeaIceMm + seaIceFreezeMm - seaIceMeltMm,
    0,
    5000
  );
  const iceStorageChangeMm = column.cryosphere.seaIceWaterEquivalentMm - initialSeaIceMm;
  column.ocean.freshwaterAnomalyMm -= iceStorageChangeMm;
  synchronizeSeaIceGeometry(column);
  const snowPhaseTemperatureC = .5 * column.surface.temperatureC +
    .5 * finite(weather?.seasonalTemperatureC, column.atmosphere.airTemperatureC);
  const snowRadiativeMeltMm = Math.max(0, preliminaryRadiation.netRadiationWm2) *
    dtDays * DAY_SECONDS / PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG * .12;
  const retainedSnowMeltMm = Math.min(
    column.cryosphere.snowWaterEquivalentMm,
    Math.max(0, snowPhaseTemperatureC - freezingPointC) * .85 * dtDays +
      snowRadiativeMeltMm
  );
  column.cryosphere.snowWaterEquivalentMm -= retainedSnowMeltMm;
  snowmeltMm += retainedSnowMeltMm;
  column.ocean.freshwaterAnomalyMm += retainedSnowMeltMm;
  if (column.cryosphere.seaIceFraction <= 1e-9 &&
      column.cryosphere.snowWaterEquivalentMm > 0) {
    snowmeltMm += column.cryosphere.snowWaterEquivalentMm;
    column.ocean.freshwaterAnomalyMm += column.cryosphere.snowWaterEquivalentMm;
    column.cryosphere.snowWaterEquivalentMm = 0;
  }
  column.cryosphere.snowAgeDays = snowAgeAfterStep(
    initialSnowMm,
    initialSnowAgeDays,
    snowRetainedOnIceMm,
    column.cryosphere.snowWaterEquivalentMm,
    dtDays
  );
  const cryospherePhase = cryospherePhaseReceipt({
    kind: 'ocean-snow-sea-ice',
    initialSnowMm,
    finalSnowMm: column.cryosphere.snowWaterEquivalentMm,
    initialSeaIceMm,
    finalSeaIceMm: column.cryosphere.seaIceWaterEquivalentMm,
    snowfallMm,
    snowmeltMm,
    snowSublimationMm,
    seaIceFreezeMm,
    seaIceMeltMm,
    freezingPointC
  });
  column.cryosphere.lastPhaseChangeReceipt = cryospherePhase;
  const energy = energyStep(column, weather, evaporationMm, dtDays, cryospherePhase);
  const atmosphereEnergy = atmosphereEnergyBudget(
    column, waterContext, evaporationMm, phaseChange, freePhaseChange, verticalExchange,
    pressureDynamics.receipt
  );
  const referenceWaterMassMm = column.ocean.mixedLayerDepthM * 1000;
  column.ocean.salinityPsu = clamp(finite(sample?.ecology?.salinityPsu, 35) *
    referenceWaterMassMm / Math.max(1, referenceWaterMassMm + column.ocean.freshwaterAnomalyMm), 2, 43);
  const oceanEcologyStep = advanceOceanEcology(column.ocean.ecology, {
    absorbedShortwaveWm2: energy.radiation.absorbedShortwaveWm2,
    temperatureC: column.ocean.mixedLayerTemperatureC,
    salinityPsu: column.ocean.salinityPsu,
    mixedLayerDepthM: column.ocean.mixedLayerDepthM,
    surfacePressureHpa: column.atmosphere.surfacePressureHpa,
    seaIceFraction: column.cryosphere.seaIceFraction,
    windSpeedMps: finite(weather?.windSpeedMps)
  }, dtDays, {
    enabled: options.livingEnabled !== false,
    lifeAbundance: finite(options.lifeAbundance, 1),
    sample,
    ocean: column.ocean
  });
  column.ocean.ecology = oceanEcologyStep.state;
  column.surface.albedo = albedoFor(column);
  const finalStorageMm = earthSystemWaterStorageMm(column);
  const residualMm = finalStorageMm - initialStorageMm - waterContext.boundaryMoistureMm;
  return {
    fluxes: {
      ...emptyFluxes(),
      precipitationMmDay: precipitationMm / dtDays,
      rainfallMmDay: rainfallMm / dtDays,
      snowfallMmDay: snowfallMm / dtDays,
      snowmeltMmDay: snowmeltMm / dtDays,
      evaporationMmDay: evaporationMm / dtDays,
      freshwaterBalanceMmDay: (precipitationMm - evaporationMm) / dtDays,
      netRadiationWm2: energy.netRadiationWm2,
      latentHeatWm2: energy.latentHeatWm2,
      sensibleHeatWm2: energy.sensibleHeatWm2,
      absorbedShortwaveWm2: energy.radiation.absorbedShortwaveWm2,
      upwardLongwaveWm2: energy.radiation.upwardLongwaveWm2,
      downwardLongwaveWm2: energy.radiation.downwardLongwaveWm2,
      cloudShortwaveForcingWm2: energy.radiation.cloudShortwaveForcingWm2,
      cloudLongwaveForcingWm2: energy.radiation.cloudLongwaveForcingWm2,
      cryospherePhaseChangeWm2: energy.cryospherePhaseChangeWm2,
      condensationMmDay: phaseChange.condensationMm / dtDays,
      cloudEvaporationMmDay: phaseChange.cloudEvaporationMm / dtDays,
      atmosphericLatentHeatingWm2: (phaseChange.latentHeatingJm2 + freePhaseChange.latentHeatingJm2) /
        (dtDays * DAY_SECONDS),
      verticalSensibleHeatWm2: verticalExchange.sensibleHeatUpwardJm2 / (dtDays * DAY_SECONDS),
      verticalBuoyancyConversionWm2: verticalExchange.buoyancyWorkJm2 /
        (dtDays * DAY_SECONDS),
      convectiveKineticDissipationWm2: verticalExchange.convectiveDissipationJm2 /
        (dtDays * DAY_SECONDS),
      convectiveExchangeFractionDay: verticalExchange.exchangeFraction / dtDays,
      marineGrossPrimaryProductionKgCm2Day:
        oceanEcologyStep.receipt.carbon.grossPrimaryProductionKgCm2 / dtDays,
      marineCommunityRespirationKgCm2Day:
        oceanEcologyStep.receipt.carbon.communityRespirationKgCm2 / dtDays,
      airSeaCo2FluxToOceanKgCm2Day:
        oceanEcologyStep.receipt.carbon.airSeaCo2FluxToOceanKgCm2 / dtDays,
      marinePhotosyntheticOxygenKgO2m2Day:
        oceanEcologyStep.receipt.oxygen.photosyntheticProductionKgO2m2 / dtDays,
      marineRespirationOxygenKgO2m2Day:
        oceanEcologyStep.receipt.oxygen.respirationConsumptionKgO2m2 / dtDays,
      marineNitrogenUptakeKgNm2Day:
        oceanEcologyStep.receipt.nitrogen.phytoplanktonUptakeKgNm2 / dtDays,
      marinePhosphorusUptakeKgPm2Day:
        oceanEcologyStep.receipt.phosphorus.phytoplanktonUptakeKgPm2 / dtDays
    },
    water: {
      initialStorageMm,
      atmosphericBoundaryMoistureMm: waterContext.boundaryMoistureMm,
      precipitationMm,
      unmetPrecipitationMm: phaseChange.unmetPrecipitationMm,
      evaporationMm,
      generatedRunoffMm: 0,
      exportedRunoffMm: 0,
      finalStorageMm,
      residualMm,
      atmosphere: {
        initialWaterMm: waterContext.initialAtmosphereWaterMm,
        afterBoundaryWaterMm: waterContext.afterBoundaryAtmosphereWaterMm,
        finalWaterMm: atmosphereWaterStorageMm(column),
        finalVaporMm: column.atmosphere.precipitableWaterMm,
        finalCloudWaterMm: column.atmosphere.cloudWaterMm,
        finalCloudIceMm: column.atmosphere.cloudIceMm,
        finalFreeTroposphereVaporMm: column.atmosphere.freeTroposphere.precipitableWaterMm,
        finalFreeTroposphereCloudWaterMm: column.atmosphere.freeTroposphere.cloudWaterMm,
        finalFreeTroposphereCloudIceMm: column.atmosphere.freeTroposphere.cloudIceMm
      }
    },
    energy,
    atmosphereEnergy,
    phaseChange,
    freePhaseChange,
    verticalExchange,
    cryospherePhase,
    landEcology: null,
    oceanEcology: oceanEcologyStep.receipt,
    pressureDynamics: pressureDynamics.receipt
  };
}

function roundColumn(column) {
  const visit = value => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return typeof value === 'number' ? round(value) : value;
    for (const key of Object.keys(value)) value[key] = visit(value[key]);
    return value;
  };
  return visit(column);
}

export function advanceEarthSystemColumn(source, weather, sample, dtDays, options = {}) {
  if (!source || source.schema !== EARTH_SYSTEM_COLUMN_SCHEMA) throw new Error('Invalid Earth-system column');
  const duration = finite(dtDays);
  if (!(duration > 0) || duration > 1.000001) throw new Error('Earth-system step must be greater than zero and no longer than one day');
  const column = clone(source);
  const compatibilityInputSyncReceipt = reconcilePressureColumnWithLegacy(
    column,
    { reason: 'compatibility-projection-input' }
  );
  syncAtmosphericHumidity(column);
  syncFreeTroposphereHumidity(column);
  const initialStorageMm = earthSystemWaterStorageMm(column);
  const atmosphereUpdate = updateAtmosphere(column, weather, duration);
  const atmosphericBoundarySyncReceipt = reconcilePressureColumnWithLegacy(column, {
    reason: 'atmospheric-boundary-forcing'
  });
  const boundaryEnergyReceipt = createAtmosphereBoundaryEnergyReceipt({
    atmosphereUpdate,
    compatibilityInputSyncReceipt,
    atmosphericBoundarySyncReceipt,
    pressureColumn: column.atmosphere.pressureColumn
  });
  column.atmosphere.lastBoundaryEnergyReceipt = boundaryEnergyReceipt;
  const waterContext = {
    initialStorageMm,
    initialAtmosphereWaterMm: atmosphereUpdate.initialWaterMm,
    afterBoundaryAtmosphereWaterMm: atmosphereUpdate.afterBoundaryWaterMm,
    boundaryMoistureMm: atmosphereUpdate.boundaryMoistureMm,
    initialMoistEnthalpyJm2:
      boundaryEnergyReceipt.nativeInitialMoistEnthalpyJm2,
    requestedBoundaryMoistEnthalpyJm2:
      boundaryEnergyReceipt.requestedBoundaryMoistEnthalpyJm2,
    boundaryMoistEnthalpyJm2:
      boundaryEnergyReceipt.appliedBoundaryMoistEnthalpyJm2,
    boundaryNativeEnvelopeReconciliationJm2:
      boundaryEnergyReceipt.nativeEnvelopeReconciliationJm2,
    boundaryEnergyReceipt
  };
  column.atmosphere.biogeochemistry =
    synchronizeAtmosphereCompatibilityMirrors(
      column.atmosphere.biogeochemistry,
      column.land?.ecology,
      column.ocean?.ecology,
      { pressureColumn: column.atmosphere.pressureColumn }
    );
  const initialAtmosphereBiogeochemistry = clone(
    column.atmosphere.biogeochemistry);
  const result = column.kind === 'land'
    ? advanceLand(column, weather, sample, duration, options, waterContext)
    : advanceOcean(column, weather, sample, duration, options, waterContext);
  const atmosphereBiogeochemistryVerticalStep =
    transportAtmosphereBiogeochemistryVertically(
      initialAtmosphereBiogeochemistry,
      column.atmosphere.pressureColumn,
      result.pressureDynamics.adjacentExchangeReceipts,
      {
        durationDays: duration,
        reason: 'native-adjacent-interface-gas-mixing'
      }
    );
  const atmosphereBiogeochemistryStep = reconcileAtmosphereBiosphereGases(
    atmosphereBiogeochemistryVerticalStep.state,
    column.land?.ecology,
    column.ocean?.ecology,
    duration,
    { pressureColumn: column.atmosphere.pressureColumn }
  );
  column.atmosphere.biogeochemistry = atmosphereBiogeochemistryStep.state;
  column.fluxes = result.fluxes;
  column.atmosphere.lastPhaseChangeReceipt = result.phaseChange;
  column.atmosphere.lastFreeTropospherePhaseReceipt = result.freePhaseChange;
  column.atmosphere.lastVerticalExchangeReceipt = result.verticalExchange;
  column.atmosphere.lastPressureColumnDynamicsReceipt = result.pressureDynamics;
  column.budget = {
    water: result.water,
    energy: result.energy,
    atmosphereEnergy: result.atmosphereEnergy,
    atmosphereBiogeochemistry: atmosphereBiogeochemistryStep.receipt,
    atmosphereBiogeochemistryVertical:
      atmosphereBiogeochemistryVerticalStep.receipt,
    landEcology: result.landEcology,
    soilBiogeochemistry: result.soilBiogeochemistry || null,
    geomorphicSediment: result.geomorphicSediment || null,
    oceanEcology: result.oceanEcology
  };
  column.lastDay += duration;
  column.stepCount += 1;
  const pressureColumnSyncReceipt = reconcilePressureColumnWithLegacy(column, {
    reason: 'local-earth-system-step'
  });
  syncAtmosphericHumidity(column);
  syncFreeTroposphereHumidity(column);
  const preciseAtmosphere = {
    surfacePressureHpa: round(column.atmosphere.surfacePressureHpa, 9),
    boundaryLayerPressureHpa: round(column.atmosphere.boundaryLayerPressureHpa, 9),
    airTemperatureC: round(column.atmosphere.airTemperatureC, 9),
    convectiveKineticEnergyJm2: round(column.atmosphere.convectiveKineticEnergyJm2, 6),
    verticalVelocityProxyMps: round(column.atmosphere.verticalVelocityProxyMps, 9),
    precipitableWaterMm: round(column.atmosphere.precipitableWaterMm, 9),
    cloudWaterMm: round(column.atmosphere.cloudWaterMm, 9),
    cloudIceMm: round(column.atmosphere.cloudIceMm, 9),
    freeTroposphere: {
      ...column.atmosphere.freeTroposphere,
      pressureThicknessHpa: round(column.atmosphere.freeTroposphere.pressureThicknessHpa, 9),
      airTemperatureC: round(column.atmosphere.freeTroposphere.airTemperatureC, 9),
      precipitableWaterMm: round(column.atmosphere.freeTroposphere.precipitableWaterMm, 9),
      cloudWaterMm: round(column.atmosphere.freeTroposphere.cloudWaterMm, 9),
      cloudIceMm: round(column.atmosphere.freeTroposphere.cloudIceMm, 9),
      relativeHumidity: round(column.atmosphere.freeTroposphere.relativeHumidity, 9),
      eastwardWindMps: round(column.atmosphere.freeTroposphere.eastwardWindMps, 9),
      northwardWindMps: round(column.atmosphere.freeTroposphere.northwardWindMps, 9),
      windSpeedMps: round(column.atmosphere.freeTroposphere.windSpeedMps, 9),
      windDirectionDeg: round(column.atmosphere.freeTroposphere.windDirectionDeg, 9)
    },
    pressureColumn: clone(column.atmosphere.pressureColumn)
  };
  const preciseAtmosphereReceipts = {
    lastPhaseChangeReceipt: clone(result.phaseChange),
    lastFreeTropospherePhaseReceipt: clone(result.freePhaseChange),
    lastVerticalExchangeReceipt: clone(result.verticalExchange),
    lastPressureColumnDynamicsReceipt: clone(result.pressureDynamics),
    lastBoundaryEnergyReceipt: clone(boundaryEnergyReceipt),
    lastPressureColumnSyncReceipt: clone(pressureColumnSyncReceipt)
  };
  const preciseLandEcology = column.kind === 'land' && column.land?.ecology
    ? clone(column.land.ecology)
    : null;
  const preciseSoilBiogeochemistry = column.kind === 'land' &&
    column.land?.soilBiogeochemistry
    ? clone(column.land.soilBiogeochemistry)
    : null;
  const preciseSurfaceSediment = column.kind === 'land' &&
    column.land?.surfaceSediment
    ? clone(column.land.surfaceSediment)
    : null;
  const preciseRunoffBiogeochemistryQueue = column.kind === 'land' &&
    column.routing?.runoffBiogeochemistryQueue
    ? clone(column.routing.runoffBiogeochemistryQueue)
    : null;
  const preciseRunoffSedimentQueue = column.kind === 'land' &&
    column.routing?.runoffSedimentQueue
    ? clone(column.routing.runoffSedimentQueue)
    : null;
  const preciseOceanEcology = column.kind === 'ocean' && column.ocean?.ecology
    ? clone(column.ocean.ecology)
    : null;
  const preciseAtmosphereBiogeochemistry = clone(
    column.atmosphere.biogeochemistry);
  roundColumn(column);
  Object.assign(column.atmosphere, preciseAtmosphere, {
    freeTroposphere: preciseAtmosphere.freeTroposphere,
    ...preciseAtmosphereReceipts
  });
  column.atmosphere.biogeochemistry = preciseAtmosphereBiogeochemistry;
  column.budget.atmosphereBiogeochemistry = clone(
    preciseAtmosphereBiogeochemistry.lastBiosphereFluxReceipt);
  column.budget.atmosphereBiogeochemistryVertical = clone(
    preciseAtmosphereBiogeochemistry.lastVerticalTransportReceipt);
  if (preciseLandEcology) {
    column.land.ecology = preciseLandEcology;
    column.budget.landEcology = clone(preciseLandEcology.lastFluxReceipt);
  }
  if (preciseSoilBiogeochemistry) {
    column.land.soilBiogeochemistry = preciseSoilBiogeochemistry;
    column.budget.soilBiogeochemistry = clone(
      preciseSoilBiogeochemistry.lastMobilizationReceipt);
  }
  if (preciseSurfaceSediment) {
    column.land.surfaceSediment = preciseSurfaceSediment;
    column.budget.geomorphicSediment = clone(
      preciseSurfaceSediment.lastErosionReceipt);
  }
  if (preciseRunoffBiogeochemistryQueue) {
    column.routing.runoffBiogeochemistryQueue =
      preciseRunoffBiogeochemistryQueue;
  }
  if (preciseRunoffSedimentQueue) {
    column.routing.runoffSedimentQueue = preciseRunoffSedimentQueue;
  }
  if (preciseOceanEcology) {
    column.ocean.ecology = preciseOceanEcology;
    column.budget.oceanEcology = clone(preciseOceanEcology.lastFluxReceipt);
  }
  column.budget.atmosphereEnergy.finalMoistEnthalpyJm2 = round(atmosphereMoistEnthalpyJm2(column), 6);
  column.budget.atmosphereEnergy.residualJm2 = round(
    column.budget.atmosphereEnergy.finalMoistEnthalpyJm2 +
      finite(column.budget.atmosphereEnergy.surfacePrecipitationPhaseEnthalpyJm2) -
      column.budget.atmosphereEnergy.initialMoistEnthalpyJm2 -
      column.budget.atmosphereEnergy.boundaryMoistEnthalpyJm2 -
      column.budget.atmosphereEnergy.surfaceLatentInputJm2 -
      column.budget.atmosphereEnergy.verticalMechanicalConversionJm2 -
      column.budget.atmosphereEnergy.nativeMomentumMixingConversionJm2,
    6
  );
  column.budget.energy.residualJm2 = round(
    column.budget.energy.storageChangeJm2 -
      column.budget.energy.surfaceFluxEnergyJm2 -
      column.budget.energy.boundaryHeatEnergyJm2 -
      column.budget.energy.precipitationPhaseInputJm2,
    6
  );
  column.truth.waterBudgetClosed = Math.abs(column.budget.water.residualMm) < 1e-5;
  column.truth.atmosphereCoupledToPrecipitationBudget = true;
  column.truth.cloudLiquidWaterReservoir = true;
  column.truth.cloudIceWaterReservoir = true;
  column.truth.nativeMixedPhaseClouds =
    result.pressureDynamics.truth.nativeMixedPhaseClouds === true;
  column.truth.nativeMixedPhaseCloudRadiation =
    result.energy.radiation?.truth?.nativeMixedPhaseCloudOptics === true;
  column.truth.nativeLayerCo2RadiativeCoupling =
    result.energy.radiation?.atmosphereCo2RadiativeCoupling?.schema ===
      ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA &&
    result.energy.radiation?.truth?.nativeLayerCo2RadiativeCoupling === true;
  column.truth.co2SurfaceLongwaveFeedbackApplied =
    result.energy.radiation?.truth?.co2SurfaceLongwaveFeedbackApplied === true;
  column.truth.spectralAtmosphericRadiativeTransfer = false;
  column.truth.dynamicCryosphereAlbedo =
    result.energy.radiation?.truth?.dynamicSurfaceAlbedoApplied === true;
  column.truth.cryosphereFusionEnergyReceipted =
    result.cryospherePhase?.schema === EARTH_CRYOSPHERE_PHASE_SCHEMA &&
    Math.abs(finite(result.cryospherePhase.residualJm2)) < 1;
  column.truth.snowAgePersisted = Number.isFinite(column.cryosphere.snowAgeDays);
  column.truth.snowOnSeaIcePersisted = true;
  column.truth.persistentLandEcology = column.kind === 'land' &&
    column.land?.ecology?.schema === EARTH_LAND_ECOLOGY_SCHEMA;
  column.truth.localCarbonBudgetClosed = column.kind === 'land'
    ? result.landEcology?.truth?.carbonClosed === true &&
      Math.abs(finite(result.landEcology?.carbon?.residualKgCm2)) < 1e-8
    : false;
  column.truth.localNitrogenBudgetClosed = column.kind === 'land'
    ? result.landEcology?.truth?.nitrogenClosed === true &&
      Math.abs(finite(result.landEcology?.nitrogen?.residualKgNm2)) < 1e-8
    : false;
  column.truth.persistentOceanEcology = column.kind === 'ocean' &&
    column.ocean?.ecology?.schema === EARTH_OCEAN_ECOLOGY_SCHEMA;
  column.truth.localOceanCarbonBudgetClosed = column.kind === 'ocean'
    ? result.oceanEcology?.truth?.carbonClosed === true &&
      Math.abs(finite(result.oceanEcology?.carbon?.residualKgCm2)) < 1e-8
    : false;
  column.truth.localOceanNitrogenBudgetClosed = column.kind === 'ocean'
    ? result.oceanEcology?.truth?.nitrogenClosed === true &&
      Math.abs(finite(result.oceanEcology?.nitrogen?.residualKgNm2)) < 1e-8
    : false;
  column.truth.localOceanPhosphorusBudgetClosed = column.kind === 'ocean'
    ? result.oceanEcology?.truth?.phosphorusClosed === true &&
      Math.abs(finite(result.oceanEcology?.phosphorus?.residualKgPm2)) < 1e-8
    : false;
  column.truth.localOceanOxygenFluxClosed = column.kind === 'ocean'
    ? result.oceanEcology?.truth?.oxygenFluxClosed === true &&
      Math.abs(finite(result.oceanEcology?.oxygen?.residualKgO2m2)) < 1e-8
    : false;
  column.truth.localOceanAlkalinityBudgetClosed = column.kind === 'ocean'
    ? result.oceanEcology?.truth?.alkalinityClosed === true &&
      Math.abs(finite(result.oceanEcology?.alkalinity
        ?.residualKgCaCO3Eqm2)) < 1e-8
    : false;
  column.truth.mixedLayerCarbonateDiagnostic = column.kind === 'ocean' &&
    column.ocean.ecology?.carbonateSystem?.truth?.diagnosticOnly === true &&
    column.ocean.ecology.carbonateSystem.truth?.mutatesMaterial === false;
  column.truth.mixedLayerCarbonateDiagnosticSolved = column.kind === 'ocean' &&
    column.ocean.ecology?.carbonateSystem?.status === 'SOLVED';
  column.truth.mixedLayerCarbonateMassClosed = column.kind === 'ocean' &&
    column.ocean.ecology?.carbonateSystem?.truth?.carbonateMassClosed === true;
  column.truth.mixedLayerCarbonateAlkalinityResidualClosed =
    column.kind === 'ocean' && column.ocean.ecology?.carbonateSystem?.truth
      ?.alkalinityResidualClosed === true;
  column.truth.mixedLayerPHTotalResolved = column.kind === 'ocean' &&
    Number.isFinite(Number(column.ocean.ecology?.carbonateSystem?.solution
      ?.pHTotal));
  column.truth.mixedLayerCarbonateSurfacePressureOnly =
    column.kind === 'ocean' && column.ocean.ecology?.carbonateSystem?.truth
      ?.surfacePressureOnly === true;
  column.truth.carbonateInformedAirSeaCo2Exchange = column.kind === 'ocean' &&
    result.oceanEcology?.truth?.carbonateInformedAirSeaCo2Exchange === true;
  column.truth.airSeaCo2FugacityCorrection = column.kind === 'ocean' &&
    result.oceanEcology?.truth?.airSeaCo2FugacityCorrection === true;
  column.truth.airSeaCarbonExchangeTypedRefusal = column.kind === 'ocean' &&
    result.oceanEcology?.truth?.airSeaCarbonExchangeTypedRefusal === true;
  column.truth.airSeaCarbonOwnerMoveMatchedProposal = column.kind === 'ocean' &&
    result.oceanEcology?.truth?.airSeaCarbonOwnerMoveMatchedProposal === true;
  column.truth.scientificAirSeaGasTransferVelocity = false;
  column.truth.measuredAirSeaPco2 = false;
  column.truth.measuredOceanSkinTemperature = false;
  column.truth.deepOceanPHResolved = false;
  column.truth.carbonatePHFeedbackModeled = false;
  column.truth.physicalOceanChemistryWithLifeOff = column.kind === 'ocean'
    ? result.oceanEcology?.truth?.physicalGasExchangeActive === true
    : false;
  column.truth.persistentAtmosphereBiogeochemistry =
    column.atmosphere.biogeochemistry?.schema ===
      ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA;
  column.truth.nativePressureLayerAtmosphericBiogeochemistry =
    column.atmosphere.biogeochemistry?.layers?.length ===
      ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT &&
    column.atmosphere.biogeochemistry.layers.every((layer, index) =>
      layer.schema === ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA &&
      layer.index === index);
  column.truth.atmosphereBiosphereGasLedgerClosed =
    Object.values(atmosphereBiogeochemistryStep.receipt.conservation)
      .every(value => Math.abs(finite(value)) < 1e-9);
  column.truth.atmosphericBiogeochemistryVerticalTransport =
    atmosphereBiogeochemistryVerticalStep.receipt.interfaceCount ===
      ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT - 1;
  column.truth.atmosphericBiogeochemistryVerticalConservationClosed =
    Object.values(atmosphereBiogeochemistryVerticalStep.receipt.conservation)
      .every(value => Math.abs(finite(value)) < 1e-9);
  column.truth.ecologyGasFieldsAreCompatibilityMirrors = true;
  column.truth.atmosphericBiogeochemistryHorizontalTransport =
    column.atmosphere.biogeochemistry.truth?.horizontallyTransported === true;
  column.truth.persistentDeepOceanReservoirs = column.kind === 'ocean' &&
    result.oceanEcology?.truth?.persistentDeepOceanReservoirs === true;
  column.truth.persistentDeepOceanAlkalinity = column.kind === 'ocean' &&
    result.oceanEcology?.truth?.persistentDeepOceanAlkalinity === true;
  column.truth.mixedToDeepAlkalinityClosure = column.kind === 'ocean' &&
    result.oceanEcology?.truth?.mixedToDeepAlkalinityClosed === true;
  column.truth.mixedToDeepMaterialClosure = column.kind === 'ocean' &&
    result.oceanEcology?.truth?.mixedToDeepMaterialClosure === true;
  column.truth.vegetationAlbedoCoupled = column.kind === 'land'
    ? result.energy.radiation?.truth?.dynamicVegetationAlbedoApplied === true &&
      result.landEcology?.truth?.canopyRadiationFeedback === true
    : false;
  column.truth.physiologicalTranspirationCoupled = column.kind === 'land'
    ? result.landEcology?.truth?.waterCoupled === true
    : false;
  column.truth.globallyMixedAtmosphericCo2 = false;
  column.truth.typedRainSnowDescent =
    result.pressureDynamics.truth.typedRainSnowDescent === true;
  column.truth.atmosphericPhaseChangeReceipted = true;
  column.truth.freeTroposphereReservoir = true;
  column.truth.hydrostaticVerticalPressurePartition =
    Math.abs(column.atmosphere.boundaryLayerPressureHpa +
      column.atmosphere.freeTroposphere.pressureThicknessHpa -
      column.atmosphere.surfacePressureHpa) < 1e-8;
  column.truth.verticalAtmosphereExchangeReceipted = true;
  column.truth.verticalWaterClosed = Math.abs(result.verticalExchange.waterResidualMm) < 1e-7;
  column.truth.verticalMoistEnthalpyClosed =
    Math.abs(result.verticalExchange.moistEnthalpyResidualJm2) < 1;
  column.truth.verticalMomentumClosed =
    Math.abs(result.verticalExchange.eastwardMomentumResidualKgMpsM2) < 1e-7 &&
    Math.abs(result.verticalExchange.northwardMomentumResidualKgMpsM2) < 1e-7;
  column.truth.verticalGeopotentialExchangeReceipted = true;
  column.truth.verticalResolvedEnergyClosed =
    Math.abs(result.verticalExchange.resolvedEnergyResidualJm2) < 1;
  column.truth.boundedTwoLayerBuoyancyConversionResolved =
    false;
  column.truth.pressureCoordinateColumnPersisted =
    validatePressureColumn(column.atmosphere.pressureColumn);
  column.truth.pressureColumnConservativeProjection =
    pressureColumnSyncReceipt.truth.dryAirMassClosed === true &&
    pressureColumnSyncReceipt.truth.waterClosed === true &&
    pressureColumnSyncReceipt.truth.momentumClosed === true &&
    pressureColumnSyncReceipt.truth.moistEnthalpyClosed === true;
  column.truth.pressureColumnHydrostaticInterfaces =
    pressureColumnSyncReceipt.truth.hydrostaticInterfacesMonotonic === true;
  column.truth.nativePressureLevelThermodynamics = true;
  column.truth.nativePressureLevelPhaseChangeReceipted =
    result.pressureDynamics.schema === ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA &&
    result.pressureDynamics.truth.nativeLayerSaturationAndPhaseChange === true;
  column.truth.nativePhaseChangesBoundedByThermalHeadroom =
    result.pressureDynamics.truth
      .nativePhaseChangesBoundedByThermalHeadroom === true;
  column.truth.nativeLayerTemperaturesWithinDeclaredEnvelope =
    result.pressureDynamics.truth
      .nativeLayerTemperaturesWithinDeclaredEnvelope === true;
  column.truth.postMaterialTemperatureClipRequired =
    result.pressureDynamics.truth.postMaterialTemperatureClipRequired === true;
  column.truth.nativePrecipitationDescentReceipted =
    result.pressureDynamics.truth.precipitationDescentAcrossNativeInterfaces === true;
  column.truth.nativeAdjacentLevelExchangeReceipted =
    result.pressureDynamics.truth.adjacentNativeLayerExchange === true;
  column.truth.nativePressureLevelWaterClosed =
    result.pressureDynamics.truth.nativeWaterClosed === true;
  column.truth.nativePressureLevelMoistEnthalpyClosed =
    result.pressureDynamics.truth.nativeMoistEnthalpyClosed === true;
  column.truth.nativePressureLevelMomentumClosed =
    result.pressureDynamics.truth.nativeTangentMomentumClosed === true;
  column.truth.nativePressureLevelResolvedEnergyClosed =
    result.pressureDynamics.truth.nativeResolvedEnergyClosed === true;
  column.truth.nativePressureInterfaceBuoyancyReceipted =
    result.pressureDynamics.truth.nativeVirtualTemperatureBuoyancy === true;
  column.truth.nativePressureInterfaceVerticalMomentum =
    result.pressureDynamics.truth.nativeVerticalMomentum === true;
  column.truth.nativePressureInterfaceConvectiveKineticEnergy =
    result.pressureDynamics.truth.nativeConvectiveKineticEnergyReservoirs === true;
  column.truth.nativePressureInterfaceEntrainmentDetrainment =
    result.pressureDynamics.truth.nativeBulkEntrainmentDetrainment === true;
  const nativeHorizontalTransportReceipt =
    column.atmosphere.lastPressureColumnHorizontalTransportReceipt;
  column.truth.nativePressureLevelHorizontalTransport =
    nativeHorizontalTransportReceipt?.truth?.nativePressureLevelHorizontalTransport === true;
  column.truth.nativePressureLevelHorizontalWaterClosed =
    column.truth.nativePressureLevelHorizontalTransport &&
    column.truth.nativePressureLevelHorizontalWaterClosed === true;
  column.truth.nativePressureLevelHorizontalMoistEnthalpyClosed =
    column.truth.nativePressureLevelHorizontalTransport &&
    column.truth.nativePressureLevelHorizontalMoistEnthalpyClosed === true;
  column.truth.nativePressureLevelHorizontalMomentumClosed =
    column.truth.nativePressureLevelHorizontalTransport &&
    column.truth.nativePressureLevelHorizontalMomentumClosed === true;
  column.truth.nativePressureLevelHorizontalResolvedEnergyClosed =
    column.truth.nativePressureLevelHorizontalTransport &&
    column.truth.nativePressureLevelHorizontalResolvedEnergyClosed === true;
  column.truth.pressureLevelDynamicsResolved =
    result.pressureDynamics.truth.pressureLevelDynamicsResolved === true;
  column.truth.resolvedThreeDimensionalConvection = false;
  column.truth.vectorAtmosphericMomentum = true;
  column.truth.independentLayerAtmosphericMomentum = true;
  column.truth.conservativeNeighborAtmosphereMomentumReady = true;
  column.truth.runoffHeldForReceiptedRouting = true;
  column.truth.runoffCanEnterCanonicalRiverReach = true;
  column.truth.persistentSoilWaterBiogeochemistry = column.kind === 'land' &&
    column.land?.soilBiogeochemistry?.schema ===
      SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA;
  column.truth.persistentRunoffBiogeochemistryQueue =
    column.kind === 'land' &&
    column.routing?.runoffBiogeochemistryQueue?.schema ===
      RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA;
  column.truth.soilRunoffBiogeochemistryClosed = column.kind === 'land' &&
    (!result.soilBiogeochemistry ||
      Object.values(result.soilBiogeochemistry.conservation || {})
        .every(value => Math.abs(finite(value)) < 1e-10));
  column.truth.persistentSurfaceSediment = column.kind === 'land' &&
    column.land?.surfaceSediment?.schema === SURFACE_SEDIMENT_STATE_SCHEMA;
  column.truth.persistentRunoffSedimentQueue = column.kind === 'land' &&
    column.routing?.runoffSedimentQueue?.schema ===
      RUNOFF_SEDIMENT_QUEUE_SCHEMA;
  column.truth.surfaceRunoffSedimentClosed = column.kind === 'land' &&
    result.geomorphicSediment?.truth?.conservationClosed === true;
  column.truth.persistentCoastalSediment = column.kind === 'ocean' &&
    column.ocean?.coastalSediment?.schema === COASTAL_SEDIMENT_STATE_SCHEMA;
  column.truth.dynamicGeomorphicElevation = column.kind === 'land' &&
    Number.isFinite(column.surface.geomorphicElevationAdjustmentM);
  column.truth.resolvedChannelMorphodynamics = false;
  column.truth.parameterizedLandRunoffChemistryBoundary = false;
  column.truth.energyBudgetClosed = Math.abs(column.budget.energy.residualJm2) < 1;
  column.truth.moistEnthalpyBudgetClosed = Math.abs(column.budget.atmosphereEnergy.residualJm2) < 1;
  column.truth.boundaryForcingEnergyReceipted =
    boundaryEnergyReceipt.schema === ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA &&
    boundaryEnergyReceipt.truth?.ledgerClosed === true;
  return column;
}

function validateRestoredColumn(column) {
  return column && column.schema === EARTH_SYSTEM_COLUMN_SCHEMA && typeof column.id === 'string' &&
    ['land', 'ocean'].includes(column.kind) && Number.isFinite(column.lastDay) &&
    column.surface && column.atmosphere && column.cryosphere && column.truth?.canonicalSparseCell === true;
}

function normalizeRestoredColumn(source, options = {}) {
  const column = clone(source);
  const sourceEngineSchema = String(options.sourceEngineSchema ||
    EARTH_SYSTEM_ENGINE_SCHEMA);
  const migratingThermalEnvelopeReceipts =
    column.atmosphere?.lastPressureColumnDynamicsReceipt &&
      column.atmosphere.lastPressureColumnDynamicsReceipt.schema !==
        ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA;
  const migratingBoundaryEnergyReceipt =
    sourceEngineSchema !== EARTH_SYSTEM_ENGINE_SCHEMA;
  const migratingAtmosphereEnergyReceipts =
    migratingThermalEnvelopeReceipts || migratingBoundaryEnergyReceipt;
  column.surface.baseElevationM = finite(column.surface.baseElevationM,
    finite(column.surface.elevationM));
  column.surface.geomorphicElevationAdjustmentM = finite(
    column.surface.geomorphicElevationAdjustmentM);
  column.surface.elevationM = column.surface.baseElevationM +
    column.surface.geomorphicElevationAdjustmentM;
  column.surface.lastRadiationReceipt =
    column.surface.lastRadiationReceipt?.schema === EARTH_SURFACE_RADIATION_SCHEMA
      ? column.surface.lastRadiationReceipt : null;
  column.cryosphere.snowWaterEquivalentMm = Math.max(0,
    finite(column.cryosphere.snowWaterEquivalentMm));
  column.cryosphere.snowAgeDays = column.cryosphere.snowWaterEquivalentMm > 1e-9
    ? clamp(finite(column.cryosphere.snowAgeDays), 0, 3650) : 0;
  column.cryosphere.seaIceWaterEquivalentMm = Math.max(0,
    finite(column.cryosphere.seaIceWaterEquivalentMm));
  column.cryosphere.seaIceFraction = clamp(finite(column.cryosphere.seaIceFraction));
  column.cryosphere.seaIceThicknessM = clamp(
    finite(column.cryosphere.seaIceThicknessM), 0, 5
  );
  column.cryosphere.lastPhaseChangeReceipt =
    column.cryosphere.lastPhaseChangeReceipt?.schema === EARTH_CRYOSPHERE_PHASE_SCHEMA
      ? column.cryosphere.lastPhaseChangeReceipt : null;
  if (column.kind === 'land' && column.land) {
    column.land.ecology = normalizeLandEcology(column.land.ecology, {
      substrate: column.substrate
    });
    column.land.soilBiogeochemistry =
      [SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA,
        PREVIOUS_SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA].includes(
        column.land.soilBiogeochemistry?.schema)
        ? normalizeSoilBiogeochemistry(column.land.soilBiogeochemistry)
        : emptyMigratedSoilBiogeochemistry();
    column.land.surfaceSediment = column.land.surfaceSediment?.schema ===
      SURFACE_SEDIMENT_STATE_SCHEMA
      ? normalizeSurfaceSediment(column.land.surfaceSediment)
      : emptyMigratedSurfaceSediment();
    column.surface.geomorphicElevationAdjustmentM =
      column.land.surfaceSediment.geomorphicElevationAdjustmentM;
    column.surface.elevationM = column.surface.baseElevationM +
      column.surface.geomorphicElevationAdjustmentM;
  }
  if (column.kind === 'ocean' && column.ocean) {
    column.ocean.ecology = normalizeOceanEcology(column.ocean.ecology, {
      ocean: column.ocean
    });
    column.ocean.coastalSediment = normalizeCoastalSediment(
      column.ocean.coastalSediment);
  }
  column.atmosphere.biogeochemistry = normalizeAtmosphereBiogeochemistry(
    column.atmosphere.biogeochemistry,
    {
      landEcology: column.land?.ecology,
      oceanEcology: column.ocean?.ecology,
      pressureColumn: column.atmosphere?.pressureColumn
    }
  );
  column.fluxes = {
    ...emptyFluxes(),
    ...(column.fluxes || {}),
    schema: EARTH_SYSTEM_FLUX_SCHEMA
  };
  const hadFreeTroposphere = [
    EARTH_FREE_TROPOSPHERE_SCHEMA,
    EARTH_FREE_TROPOSPHERE_LEGACY_SCHEMA
  ].includes(column.atmosphere.freeTroposphere?.schema) &&
    Number.isFinite(column.atmosphere.freeTroposphere.airTemperatureC);
  if (!hadFreeTroposphere) {
    const totalVaporMm = Math.max(MIN_ATMOSPHERIC_WATER_MM,
      finite(column.atmosphere.precipitableWaterMm, MIN_ATMOSPHERIC_WATER_MM));
    const totalCloudWaterMm = clamp(finite(column.atmosphere.cloudWaterMm), 0,
      MAX_CLOUD_WATER_MM + MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM);
    const boundaryVaporMm = Math.min(totalVaporMm,
      Math.max(MIN_ATMOSPHERIC_WATER_MM, totalVaporMm * BOUNDARY_LAYER_VAPOR_FRACTION));
    const boundaryCloudWaterMm = totalCloudWaterMm * .68;
    const surfacePressureHpa = finite(column.atmosphere.surfacePressureHpa, 1013.25);
    const humidity = clamp(finite(column.atmosphere.relativeHumidity, .5));
    const lapseRateKPerKm = clamp(5.8 + (1 - humidity) * 2.2, 5.5, 8.2);
    column.atmosphere.precipitableWaterMm = boundaryVaporMm;
    column.atmosphere.cloudWaterMm = boundaryCloudWaterMm;
    column.atmosphere.boundaryLayerPressureHpa =
      surfacePressureHpa * BOUNDARY_LAYER_PRESSURE_FRACTION;
    column.atmosphere.freeTroposphere = {
      schema: EARTH_FREE_TROPOSPHERE_SCHEMA,
      referenceAltitudeM: FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M,
      pressureThicknessHpa: surfacePressureHpa - column.atmosphere.boundaryLayerPressureHpa,
      airTemperatureC: finite(column.atmosphere.airTemperatureC) -
        lapseRateKPerKm * FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M / 1000,
      relativeHumidity: .5,
      precipitableWaterMm: totalVaporMm - boundaryVaporMm,
      cloudWaterMm: totalCloudWaterMm - boundaryCloudWaterMm,
      cloudIceMm: 0,
      cloudFraction: clamp(finite(column.atmosphere.cloudFraction, .5) * .62),
      windSpeedMps: column.atmosphere.windSpeedMps,
      windDirectionDeg: column.atmosphere.windDirectionDeg,
      eastwardWindMps: column.atmosphere.eastwardWindMps,
      northwardWindMps: column.atmosphere.northwardWindMps
    };
    syncFreeTroposphereHumidity(column);
    const migratedMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
    column.budget = column.budget || {};
    column.budget.atmosphereEnergy = {
      initialMoistEnthalpyJm2: migratedMoistEnthalpyJm2,
      requestedBoundaryMoistEnthalpyJm2: 0,
      boundaryMoistEnthalpyJm2: 0,
      boundaryNativeEnvelopeReconciliationJm2: 0,
      boundaryEnergyReceipt: null,
      phaseChangeLatentHeatingJm2: 0,
      surfaceLatentInputJm2: 0,
      surfacePrecipitationPhaseEnthalpyJm2: 0,
      finalMoistEnthalpyJm2: migratedMoistEnthalpyJm2,
      residualJm2: 0,
      migrationCheckpoint: true
    };
  }
  const restoredSurfacePressureHpa = finite(column.atmosphere.surfacePressureHpa, 1013.25);
  column.atmosphere.boundaryLayerPressureHpa = clamp(
    finite(column.atmosphere.boundaryLayerPressureHpa,
      restoredSurfacePressureHpa * BOUNDARY_LAYER_PRESSURE_FRACTION),
    restoredSurfacePressureHpa * .08,
    restoredSurfacePressureHpa * .5
  );
  column.atmosphere.convectiveKineticEnergyJm2 = clamp(
    finite(column.atmosphere.convectiveKineticEnergyJm2),
    0,
    MAX_CONVECTIVE_KINETIC_ENERGY_J_M2
  );
  const restoredLayerMasses = atmosphereLayerDryAirMassesKgM2(column);
  column.atmosphere.verticalVelocityProxyMps = round(clamp(Math.sqrt(
    2 * column.atmosphere.convectiveKineticEnergyJm2 /
      Math.max(1, restoredLayerMasses.boundaryLayerKgM2 + restoredLayerMasses.freeTroposphereKgM2)
  ), 0, 90), 9);
  column.atmosphere.freeTroposphere.schema = EARTH_FREE_TROPOSPHERE_SCHEMA;
  column.atmosphere.freeTroposphere.referenceAltitudeM = Math.max(1,
    finite(column.atmosphere.freeTroposphere.referenceAltitudeM,
      FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M));
  const restoredPressureResidualHpa = column.atmosphere.boundaryLayerPressureHpa +
    finite(column.atmosphere.freeTroposphere.pressureThicknessHpa, Number.NaN) -
    restoredSurfacePressureHpa;
  if (!Number.isFinite(restoredPressureResidualHpa) ||
      Math.abs(restoredPressureResidualHpa) > 1e-7) {
    column.atmosphere.freeTroposphere.pressureThicknessHpa =
      restoredSurfacePressureHpa - column.atmosphere.boundaryLayerPressureHpa;
  }
  column.atmosphere.freeTroposphere.airTemperatureC = finite(
    column.atmosphere.freeTroposphere.airTemperatureC,
    finite(column.atmosphere.airTemperatureC) - 29
  );
  column.atmosphere.freeTroposphere.cloudWaterMm = clamp(
    finite(column.atmosphere.freeTroposphere.cloudWaterMm),
    0,
    MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM
  );
  column.atmosphere.freeTroposphere.cloudIceMm = clamp(
    finite(column.atmosphere.freeTroposphere.cloudIceMm),
    0,
    Math.max(0, MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM -
      column.atmosphere.freeTroposphere.cloudWaterMm)
  );
  column.atmosphere.freeTroposphere.precipitableWaterMm = clamp(
    finite(column.atmosphere.freeTroposphere.precipitableWaterMm),
    0,
    Math.max(0, MAX_FREE_TROPOSPHERE_WATER_MM -
      column.atmosphere.freeTroposphere.cloudWaterMm -
      column.atmosphere.freeTroposphere.cloudIceMm)
  );
  column.atmosphere.freeTroposphere.cloudFraction = clamp(
    finite(column.atmosphere.freeTroposphere.cloudFraction,
      finite(column.atmosphere.cloudFraction, .5) * .62)
  );
  if (!hadFreeTroposphere ||
      !Number.isFinite(column.atmosphere.freeTroposphere.relativeHumidity)) {
    syncFreeTroposphereHumidity(column);
  }
  const storedFreeVectorIsConsistent =
    Number.isFinite(column.atmosphere.freeTroposphere.eastwardWindMps) &&
    Number.isFinite(column.atmosphere.freeTroposphere.northwardWindMps) &&
    Number.isFinite(column.atmosphere.freeTroposphere.windSpeedMps) &&
    Number.isFinite(column.atmosphere.freeTroposphere.windDirectionDeg) &&
    Math.abs(Math.hypot(
      column.atmosphere.freeTroposphere.eastwardWindMps,
      column.atmosphere.freeTroposphere.northwardWindMps
    ) - column.atmosphere.freeTroposphere.windSpeedMps) < 1e-5 &&
    column.atmosphere.freeTroposphere.windSpeedMps <= 90;
  if (!storedFreeVectorIsConsistent) {
    column.atmosphere.freeTroposphere.eastwardWindMps = column.atmosphere.eastwardWindMps;
    column.atmosphere.freeTroposphere.northwardWindMps = column.atmosphere.northwardWindMps;
    column.atmosphere.freeTroposphere.windSpeedMps = column.atmosphere.windSpeedMps;
    column.atmosphere.freeTroposphere.windDirectionDeg = column.atmosphere.windDirectionDeg;
    synchronizeWindVector(column.atmosphere.freeTroposphere);
  }
  column.atmosphere.lastFreeTropospherePhaseReceipt =
    column.atmosphere.lastFreeTropospherePhaseReceipt?.schema ===
      EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA
      ? column.atmosphere.lastFreeTropospherePhaseReceipt : null;
  column.atmosphere.lastVerticalExchangeReceipt =
    column.atmosphere.lastVerticalExchangeReceipt?.schema ===
      EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA
      ? column.atmosphere.lastVerticalExchangeReceipt : null;
  column.atmosphere.lastPressureColumnDynamicsReceipt =
    column.atmosphere.lastPressureColumnDynamicsReceipt?.schema ===
      ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA
      ? column.atmosphere.lastPressureColumnDynamicsReceipt : null;
  column.atmosphere.lastPressureColumnHorizontalTransportReceipt =
    column.atmosphere.lastPressureColumnHorizontalTransportReceipt?.schema ===
      ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA
      ? column.atmosphere.lastPressureColumnHorizontalTransportReceipt : null;
  column.budget = column.budget || {};
  column.budget.landEcology = column.kind === 'land'
    ? column.land?.ecology?.lastFluxReceipt || null
    : null;
  column.budget.soilBiogeochemistry = column.kind === 'land'
    ? column.land?.soilBiogeochemistry?.lastMobilizationReceipt || null
    : null;
  column.budget.geomorphicSediment = column.kind === 'land'
    ? column.land?.surfaceSediment?.lastErosionReceipt || null
    : null;
  column.budget.oceanEcology = column.kind === 'ocean'
    ? column.ocean?.ecology?.lastFluxReceipt || null
    : null;
  column.budget.atmosphereBiogeochemistry =
    column.atmosphere.biogeochemistry.lastBiosphereFluxReceipt || null;
  column.budget.atmosphereBiogeochemistryVertical =
    column.atmosphere.biogeochemistry.lastVerticalTransportReceipt || null;
  if (column.budget.atmosphereEnergy) {
    column.budget.atmosphereEnergy.requestedBoundaryMoistEnthalpyJm2 = finite(
      column.budget.atmosphereEnergy.requestedBoundaryMoistEnthalpyJm2,
      column.budget.atmosphereEnergy.boundaryMoistEnthalpyJm2
    );
    column.budget.atmosphereEnergy.boundaryNativeEnvelopeReconciliationJm2 =
      finite(column.budget.atmosphereEnergy
        .boundaryNativeEnvelopeReconciliationJm2);
    column.budget.atmosphereEnergy.boundaryEnergyReceipt =
      column.budget.atmosphereEnergy.boundaryEnergyReceipt?.schema ===
        ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA
        ? column.budget.atmosphereEnergy.boundaryEnergyReceipt : null;
    column.budget.atmosphereEnergy.verticalMechanicalConversionJm2 = finite(
      column.budget.atmosphereEnergy.verticalMechanicalConversionJm2
    );
    column.budget.atmosphereEnergy.nativeMomentumMixingConversionJm2 = finite(
      column.budget.atmosphereEnergy.nativeMomentumMixingConversionJm2
    );
    column.budget.atmosphereEnergy.surfacePrecipitationPhaseEnthalpyJm2 = finite(
      column.budget.atmosphereEnergy.surfacePrecipitationPhaseEnthalpyJm2
    );
  }
  const hadCloudWaterReservoir = Number.isFinite(column.atmosphere.cloudWaterMm);
  column.atmosphere.cloudWaterMm = clamp(finite(column.atmosphere.cloudWaterMm), 0, MAX_CLOUD_WATER_MM);
  column.atmosphere.cloudIceMm = clamp(
    finite(column.atmosphere.cloudIceMm),
    0,
    Math.max(0, MAX_CLOUD_WATER_MM - column.atmosphere.cloudWaterMm)
  );
  column.atmosphere.lastPhaseChangeReceipt = column.atmosphere.lastPhaseChangeReceipt?.schema ===
    EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA ? column.atmosphere.lastPhaseChangeReceipt : null;
  column.atmosphere.precipitableWaterMm = clamp(
    finite(column.atmosphere.precipitableWaterMm, MIN_ATMOSPHERIC_WATER_MM),
    MIN_ATMOSPHERIC_WATER_MM,
    Math.max(MIN_ATMOSPHERIC_WATER_MM, MAX_ATMOSPHERIC_WATER_MM -
      column.atmosphere.cloudWaterMm - column.atmosphere.cloudIceMm)
  );
  if (!hadCloudWaterReservoir || !Number.isFinite(column.atmosphere.relativeHumidity)) {
    syncAtmosphericHumidity(column);
  }
  const storedVectorIsConsistent = Number.isFinite(column.atmosphere.eastwardWindMps) &&
    Number.isFinite(column.atmosphere.northwardWindMps) && Number.isFinite(column.atmosphere.windSpeedMps) &&
    Number.isFinite(column.atmosphere.windDirectionDeg) &&
    Math.abs(Math.hypot(column.atmosphere.eastwardWindMps, column.atmosphere.northwardWindMps) -
      column.atmosphere.windSpeedMps) < 1e-5 && column.atmosphere.windSpeedMps <= 90;
  if (!storedVectorIsConsistent) synchronizeWindVector(column.atmosphere);
  const hadValidPressureColumn = validatePressureColumn(column.atmosphere.pressureColumn);
  const pressureColumnRestoreReceipt = restorePressureColumn(column, {
    reason: column.atmosphere.pressureColumn
      ? 'pressure-column-v1-restore'
      : 'legacy-v10-pressure-column-migration'
  });
  column.atmosphere.biogeochemistry = normalizeAtmosphereBiogeochemistry(
    column.atmosphere.biogeochemistry,
    { pressureColumn: column.atmosphere.pressureColumn }
  );
  column.atmosphere.convectiveKineticEnergyJm2 =
    column.atmosphere.pressureColumn.totals.convectiveKineticEnergyJm2;
  column.atmosphere.verticalVelocityProxyMps =
    column.atmosphere.pressureColumn.verticalInterfaces.reduce((maximum, entry) =>
      Math.max(maximum, finite(entry.updraftVelocityMps)), 0);
  column.atmosphere.lastBoundaryEnergyReceipt =
    column.atmosphere.lastBoundaryEnergyReceipt?.schema ===
      ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA
      ? column.atmosphere.lastBoundaryEnergyReceipt : null;
  if (!hadValidPressureColumn) {
    syncAtmosphericHumidity(column);
    syncFreeTroposphereHumidity(column);
  }
  if (migratingAtmosphereEnergyReceipts) {
    const currentMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
    if (migratingThermalEnvelopeReceipts) {
      column.atmosphere.lastPhaseChangeReceipt = null;
      column.atmosphere.lastFreeTropospherePhaseReceipt = null;
      column.atmosphere.lastPressureColumnDynamicsReceipt = null;
    }
    if (migratingBoundaryEnergyReceipt) {
      column.atmosphere.lastBoundaryEnergyReceipt = null;
    }
    column.budget.atmosphereEnergy = {
      initialMoistEnthalpyJm2: currentMoistEnthalpyJm2,
      requestedBoundaryMoistEnthalpyJm2: 0,
      boundaryMoistEnthalpyJm2: 0,
      boundaryNativeEnvelopeReconciliationJm2: 0,
      boundaryEnergyReceipt: null,
      phaseChangeLatentHeatingJm2: 0,
      surfaceLatentInputJm2: 0,
      surfacePrecipitationPhaseEnthalpyJm2: 0,
      verticalMechanicalConversionJm2: 0,
      nativeMomentumMixingConversionJm2: 0,
      finalMoistEnthalpyJm2: currentMoistEnthalpyJm2,
      residualJm2: 0,
      migrationCheckpoint: true,
      legacyPhaseReceiptDiscarded: Boolean(migratingThermalEnvelopeReceipts),
      legacyBoundaryEnergyReceiptDiscarded: Boolean(
        migratingBoundaryEnergyReceipt
      ),
      sourceEngineSchema
    };
  }
  column.routing = {
    runoffQueueMm: Math.max(0, finite(column.routing?.runoffQueueMm)),
    runoffBiogeochemistryQueue: column.kind === 'land'
      ? normalizeRunoffBiogeochemistryQueue(
          column.routing?.runoffBiogeochemistryQueue)
      : emptyRunoffBiogeochemistryQueue(),
    runoffSedimentQueue: column.kind === 'land'
      ? normalizeRunoffSedimentQueue(column.routing?.runoffSedimentQueue)
      : emptyRunoffSedimentQueue(),
    cumulativeGeneratedRunoffMm: Math.max(0, finite(column.routing?.cumulativeGeneratedRunoffMm)),
    cumulativeRoutedRunoffMm: Math.max(0, finite(column.routing?.cumulativeRoutedRunoffMm)),
    cumulativeChannelizedRunoffMm: Math.max(0, finite(column.routing?.cumulativeChannelizedRunoffMm)),
    lastDownstreamCellId: typeof column.routing?.lastDownstreamCellId === 'string'
      ? column.routing.lastDownstreamCellId : null,
    lastDownstreamReachId: typeof column.routing?.lastDownstreamReachId === 'string'
      ? column.routing.lastDownstreamReachId : null
  };
  column.truth.neighborTransportReady = true;
  column.truth.atmosphereCoupledToPrecipitationBudget = true;
  column.truth.cloudLiquidWaterReservoir = true;
  column.truth.cloudIceWaterReservoir = true;
  column.truth.nativeMixedPhaseClouds = true;
  column.truth.nativeMixedPhaseCloudRadiation =
    column.surface.lastRadiationReceipt?.truth?.nativeMixedPhaseCloudOptics === true;
  column.truth.nativeLayerCo2RadiativeCoupling =
    column.surface.lastRadiationReceipt?.atmosphereCo2RadiativeCoupling?.schema ===
      ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA &&
    column.surface.lastRadiationReceipt?.truth
      ?.nativeLayerCo2RadiativeCoupling === true;
  column.truth.co2SurfaceLongwaveFeedbackApplied =
    column.surface.lastRadiationReceipt?.truth
      ?.co2SurfaceLongwaveFeedbackApplied === true;
  column.truth.spectralAtmosphericRadiativeTransfer = false;
  column.truth.dynamicCryosphereAlbedo = true;
  column.truth.cryosphereFusionEnergyReceipted =
    column.cryosphere.lastPhaseChangeReceipt?.truth?.latentHeatOfFusionReceipted === true &&
    Math.abs(finite(column.cryosphere.lastPhaseChangeReceipt?.residualJm2)) < 1;
  column.truth.snowAgePersisted = true;
  column.truth.snowOnSeaIcePersisted = true;
  column.truth.persistentLandEcology = column.kind === 'land' &&
    column.land?.ecology?.schema === EARTH_LAND_ECOLOGY_SCHEMA;
  column.truth.localCarbonBudgetClosed = column.kind === 'land' &&
    (!column.land.ecology.lastFluxReceipt ||
      Math.abs(finite(column.land.ecology.lastFluxReceipt.carbon?.residualKgCm2)) < 1e-8);
  column.truth.localNitrogenBudgetClosed = column.kind === 'land' &&
    (!column.land.ecology.lastFluxReceipt ||
      Math.abs(finite(column.land.ecology.lastFluxReceipt.nitrogen?.residualKgNm2)) < 1e-8);
  column.truth.persistentOceanEcology = column.kind === 'ocean' &&
    column.ocean?.ecology?.schema === EARTH_OCEAN_ECOLOGY_SCHEMA;
  column.truth.localOceanCarbonBudgetClosed = column.kind === 'ocean' &&
    (!column.ocean.ecology.lastFluxReceipt ||
      Math.abs(finite(column.ocean.ecology.lastFluxReceipt.carbon?.residualKgCm2)) < 1e-8);
  column.truth.localOceanNitrogenBudgetClosed = column.kind === 'ocean' &&
    (!column.ocean.ecology.lastFluxReceipt ||
      Math.abs(finite(column.ocean.ecology.lastFluxReceipt.nitrogen?.residualKgNm2)) < 1e-8);
  column.truth.localOceanPhosphorusBudgetClosed = column.kind === 'ocean' &&
    (!column.ocean.ecology.lastFluxReceipt ||
      Math.abs(finite(column.ocean.ecology.lastFluxReceipt.phosphorus?.residualKgPm2)) < 1e-8);
  column.truth.localOceanOxygenFluxClosed = column.kind === 'ocean' &&
    (!column.ocean.ecology.lastFluxReceipt ||
      Math.abs(finite(column.ocean.ecology.lastFluxReceipt.oxygen?.residualKgO2m2)) < 1e-8);
  column.truth.localOceanAlkalinityBudgetClosed = column.kind === 'ocean' &&
    (!column.ocean.ecology.lastFluxReceipt ||
      Math.abs(finite(column.ocean.ecology.lastFluxReceipt.alkalinity
        ?.residualKgCaCO3Eqm2)) < 1e-8);
  column.truth.mixedLayerCarbonateDiagnostic = column.kind === 'ocean' &&
    column.ocean.ecology?.carbonateSystem?.truth?.diagnosticOnly === true &&
    column.ocean.ecology.carbonateSystem.truth?.mutatesMaterial === false;
  column.truth.mixedLayerCarbonateDiagnosticSolved = column.kind === 'ocean' &&
    column.ocean.ecology?.carbonateSystem?.status === 'SOLVED';
  column.truth.mixedLayerCarbonateMassClosed = column.kind === 'ocean' &&
    column.ocean.ecology?.carbonateSystem?.truth?.carbonateMassClosed === true;
  column.truth.mixedLayerCarbonateAlkalinityResidualClosed =
    column.kind === 'ocean' && column.ocean.ecology?.carbonateSystem?.truth
      ?.alkalinityResidualClosed === true;
  column.truth.mixedLayerPHTotalResolved = column.kind === 'ocean' &&
    Number.isFinite(Number(column.ocean.ecology?.carbonateSystem?.solution
      ?.pHTotal));
  column.truth.mixedLayerCarbonateSurfacePressureOnly =
    column.kind === 'ocean' && column.ocean.ecology?.carbonateSystem?.truth
      ?.surfacePressureOnly === true;
  const restoredAirSeaExchange = column.ocean?.ecology?.lastFluxReceipt
    ?.carbon?.airSeaCarbonExchange;
  column.truth.carbonateInformedAirSeaCo2Exchange = column.kind === 'ocean' &&
    restoredAirSeaExchange?.status?.startsWith('SOLVED_') === true;
  column.truth.airSeaCo2FugacityCorrection = column.kind === 'ocean' &&
    restoredAirSeaExchange?.truth?.fugacityNonidealityIncluded === true;
  column.truth.airSeaCarbonExchangeTypedRefusal = column.kind === 'ocean' &&
    Boolean(restoredAirSeaExchange) &&
    restoredAirSeaExchange.status?.startsWith('SOLVED_') !== true;
  column.truth.airSeaCarbonOwnerMoveMatchedProposal = column.kind === 'ocean' &&
    restoredAirSeaExchange?.application?.proposalMatched === true;
  column.truth.scientificAirSeaGasTransferVelocity = false;
  column.truth.measuredAirSeaPco2 = false;
  column.truth.measuredOceanSkinTemperature = false;
  column.truth.deepOceanPHResolved = false;
  column.truth.carbonatePHFeedbackModeled = false;
  column.truth.physicalOceanChemistryWithLifeOff = column.kind === 'ocean';
  column.truth.persistentAtmosphereBiogeochemistry =
    column.atmosphere.biogeochemistry?.schema ===
      ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA;
  column.truth.nativePressureLayerAtmosphericBiogeochemistry =
    column.atmosphere.biogeochemistry?.layers?.length ===
      ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT &&
    column.atmosphere.biogeochemistry.layers.every((layer, index) =>
      layer.schema === ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA &&
      layer.index === index);
  column.truth.atmosphereBiosphereGasLedgerClosed =
    !column.atmosphere.biogeochemistry.lastBiosphereFluxReceipt ||
    Object.values(column.atmosphere.biogeochemistry.lastBiosphereFluxReceipt
      .conservation || {}).every(value => Math.abs(finite(value)) < 1e-9);
  column.truth.atmosphericBiogeochemistryVerticalTransport =
    column.atmosphere.biogeochemistry.lastVerticalTransportReceipt
      ?.interfaceCount === ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT - 1;
  column.truth.atmosphericBiogeochemistryVerticalConservationClosed =
    !column.atmosphere.biogeochemistry.lastVerticalTransportReceipt ||
    Object.values(column.atmosphere.biogeochemistry.lastVerticalTransportReceipt
      .conservation || {}).every(value => Math.abs(finite(value)) < 1e-9);
  column.truth.ecologyGasFieldsAreCompatibilityMirrors = true;
  column.truth.atmosphericBiogeochemistryHorizontalTransport =
    column.atmosphere.biogeochemistry.truth?.horizontallyTransported === true;
  column.truth.persistentDeepOceanReservoirs = column.kind === 'ocean' &&
    column.ocean?.ecology?.deepOcean?.schema ===
      DEEP_OCEAN_STATE_SCHEMA;
  column.truth.persistentDeepOceanAlkalinity = column.kind === 'ocean' &&
    Number.isFinite(Number(column.ocean?.ecology?.deepOcean?.alkalinity
      ?.dissolvedKgCaCO3Eqm2)) &&
    Number(column.ocean.ecology.deepOcean.alkalinity
      .dissolvedKgCaCO3Eqm2) >= 0;
  column.truth.mixedToDeepAlkalinityClosure = column.kind === 'ocean' &&
    (!column.ocean.ecology.lastFluxReceipt ||
      column.ocean.ecology.lastFluxReceipt.truth
        ?.mixedToDeepAlkalinityClosed === true);
  column.truth.mixedToDeepMaterialClosure = column.kind === 'ocean' &&
    (!column.ocean.ecology.lastFluxReceipt ||
      column.ocean.ecology.lastFluxReceipt.truth?.mixedToDeepMaterialClosure === true);
  column.truth.vegetationAlbedoCoupled = column.kind === 'land' &&
    column.surface.lastRadiationReceipt?.truth?.dynamicVegetationAlbedoApplied === true &&
    column.land.ecology.lastFluxReceipt?.truth?.canopyRadiationFeedback === true;
  column.truth.physiologicalTranspirationCoupled = column.kind === 'land' &&
    column.land.ecology.lastFluxReceipt?.truth?.waterCoupled === true;
  column.truth.globallyMixedAtmosphericCo2 = false;
  column.truth.atmosphericPhaseChangeReceipted = true;
  column.truth.freeTroposphereReservoir = true;
  column.truth.hydrostaticVerticalPressurePartition = true;
  column.truth.verticalAtmosphereExchangeReceipted =
    typeof column.truth.verticalAtmosphereExchangeReceipted === 'boolean'
      ? column.truth.verticalAtmosphereExchangeReceipted
      : column.atmosphere.lastVerticalExchangeReceipt !== null;
  column.truth.verticalWaterClosed = !column.atmosphere.lastVerticalExchangeReceipt ||
    Math.abs(finite(column.atmosphere.lastVerticalExchangeReceipt.waterResidualMm)) < 1e-7;
  column.truth.verticalMoistEnthalpyClosed = !column.atmosphere.lastVerticalExchangeReceipt ||
    Math.abs(finite(column.atmosphere.lastVerticalExchangeReceipt.moistEnthalpyResidualJm2)) < 1;
  column.truth.verticalMomentumClosed = !column.atmosphere.lastVerticalExchangeReceipt ||
    (Math.abs(finite(column.atmosphere.lastVerticalExchangeReceipt.eastwardMomentumResidualKgMpsM2)) < 1e-7 &&
      Math.abs(finite(column.atmosphere.lastVerticalExchangeReceipt.northwardMomentumResidualKgMpsM2)) < 1e-7);
  column.truth.verticalGeopotentialExchangeReceipted = true;
  column.truth.verticalResolvedEnergyClosed = !column.atmosphere.lastVerticalExchangeReceipt ||
    Math.abs(finite(column.atmosphere.lastVerticalExchangeReceipt.resolvedEnergyResidualJm2)) < 1;
  column.truth.boundedTwoLayerBuoyancyConversionResolved = false;
  column.truth.pressureCoordinateColumnPersisted =
    validatePressureColumn(column.atmosphere.pressureColumn);
  column.truth.pressureColumnConservativeProjection =
    pressureColumnRestoreReceipt.truth.dryAirMassClosed === true &&
    pressureColumnRestoreReceipt.truth.waterClosed === true &&
    pressureColumnRestoreReceipt.truth.momentumClosed === true &&
    pressureColumnRestoreReceipt.truth.moistEnthalpyClosed === true;
  column.truth.pressureColumnHydrostaticInterfaces =
    pressureColumnRestoreReceipt.truth.hydrostaticInterfacesMonotonic === true;
  const nativePressureDynamics = column.atmosphere.lastPressureColumnDynamicsReceipt;
  column.truth.typedRainSnowDescent =
    nativePressureDynamics?.truth?.typedRainSnowDescent === true;
  column.truth.nativePressureLevelThermodynamics = true;
  column.truth.nativePressureLevelPhaseChangeReceipted =
    nativePressureDynamics?.truth?.nativeLayerSaturationAndPhaseChange === true;
  column.truth.nativePhaseChangesBoundedByThermalHeadroom =
    nativePressureDynamics?.truth
      ?.nativePhaseChangesBoundedByThermalHeadroom === true;
  column.truth.nativeLayerTemperaturesWithinDeclaredEnvelope =
    nativePressureDynamics
      ? nativePressureDynamics.truth
          ?.nativeLayerTemperaturesWithinDeclaredEnvelope === true
      : validatePressureColumn(column.atmosphere.pressureColumn) &&
        column.atmosphere.pressureColumn.layers.every(layer =>
          layer.airTemperatureC >=
            MIN_NATIVE_LAYER_AIR_TEMPERATURE_C - 1e-9 &&
          layer.airTemperatureC <=
            MAX_NATIVE_LAYER_AIR_TEMPERATURE_C + 1e-9);
  column.truth.postMaterialTemperatureClipRequired =
    nativePressureDynamics?.truth?.postMaterialTemperatureClipRequired === true;
  column.truth.nativePrecipitationDescentReceipted =
    nativePressureDynamics?.truth?.precipitationDescentAcrossNativeInterfaces === true;
  column.truth.nativeAdjacentLevelExchangeReceipted =
    nativePressureDynamics?.truth?.adjacentNativeLayerExchange === true;
  column.truth.nativePressureLevelWaterClosed =
    !nativePressureDynamics || nativePressureDynamics.truth?.nativeWaterClosed === true;
  column.truth.nativePressureLevelMoistEnthalpyClosed =
    !nativePressureDynamics || nativePressureDynamics.truth?.nativeMoistEnthalpyClosed === true;
  column.truth.nativePressureLevelMomentumClosed =
    !nativePressureDynamics || nativePressureDynamics.truth?.nativeTangentMomentumClosed === true;
  column.truth.nativePressureLevelResolvedEnergyClosed =
    !nativePressureDynamics || nativePressureDynamics.truth?.nativeResolvedEnergyClosed === true;
  column.truth.nativePressureInterfaceBuoyancyReceipted =
    nativePressureDynamics?.truth?.nativeVirtualTemperatureBuoyancy === true;
  column.truth.nativePressureInterfaceVerticalMomentum =
    nativePressureDynamics?.truth?.nativeVerticalMomentum === true;
  column.truth.nativePressureInterfaceConvectiveKineticEnergy =
    nativePressureDynamics?.truth?.nativeConvectiveKineticEnergyReservoirs === true;
  column.truth.nativePressureInterfaceEntrainmentDetrainment =
    nativePressureDynamics?.truth?.nativeBulkEntrainmentDetrainment === true;
  const nativeHorizontalTransportReceipt =
    column.atmosphere.lastPressureColumnHorizontalTransportReceipt;
  column.truth.nativePressureLevelHorizontalTransport =
    nativeHorizontalTransportReceipt?.truth?.nativePressureLevelHorizontalTransport === true;
  column.truth.nativePressureLevelHorizontalWaterClosed =
    column.truth.nativePressureLevelHorizontalTransport &&
    column.truth.nativePressureLevelHorizontalWaterClosed === true;
  column.truth.nativePressureLevelHorizontalMoistEnthalpyClosed =
    column.truth.nativePressureLevelHorizontalTransport &&
    column.truth.nativePressureLevelHorizontalMoistEnthalpyClosed === true;
  column.truth.nativePressureLevelHorizontalMomentumClosed =
    column.truth.nativePressureLevelHorizontalTransport &&
    column.truth.nativePressureLevelHorizontalMomentumClosed === true;
  column.truth.nativePressureLevelHorizontalResolvedEnergyClosed =
    column.truth.nativePressureLevelHorizontalTransport &&
    column.truth.nativePressureLevelHorizontalResolvedEnergyClosed === true;
  column.truth.pressureLevelDynamicsResolved =
    nativePressureDynamics?.truth?.pressureLevelDynamicsResolved === true;
  column.truth.resolvedThreeDimensionalConvection = false;
  column.truth.moistEnthalpyBudgetClosed = column.budget?.atmosphereEnergy
    ? Math.abs(finite(column.budget.atmosphereEnergy.residualJm2)) < 1
    : true;
  column.truth.boundaryForcingEnergyReceipted =
    column.atmosphere.lastBoundaryEnergyReceipt?.schema ===
      ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA &&
    column.atmosphere.lastBoundaryEnergyReceipt.truth?.ledgerClosed === true;
  column.truth.vectorAtmosphericMomentum = true;
  column.truth.independentLayerAtmosphericMomentum = true;
  column.truth.conservativeNeighborAtmosphereMomentumReady = true;
  column.truth.runoffHeldForReceiptedRouting = true;
  column.truth.runoffCanEnterCanonicalRiverReach = true;
  column.truth.persistentSoilWaterBiogeochemistry = column.kind === 'land' &&
    column.land?.soilBiogeochemistry?.schema ===
      SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA;
  column.truth.persistentRunoffBiogeochemistryQueue =
    column.kind === 'land' &&
    column.routing?.runoffBiogeochemistryQueue?.schema ===
      RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA;
  column.truth.soilRunoffBiogeochemistryClosed = column.kind === 'land' &&
    (!column.land.soilBiogeochemistry.lastMobilizationReceipt ||
      Object.values(column.land.soilBiogeochemistry
        .lastMobilizationReceipt.conservation || {})
        .every(value => Math.abs(finite(value)) < 1e-10));
  column.truth.persistentSurfaceSediment = column.kind === 'land' &&
    column.land?.surfaceSediment?.schema === SURFACE_SEDIMENT_STATE_SCHEMA;
  column.truth.persistentRunoffSedimentQueue = column.kind === 'land' &&
    column.routing?.runoffSedimentQueue?.schema ===
      RUNOFF_SEDIMENT_QUEUE_SCHEMA;
  column.truth.surfaceRunoffSedimentClosed = column.kind === 'land' &&
    (!column.land.surfaceSediment.lastErosionReceipt ||
      column.land.surfaceSediment.lastErosionReceipt.truth
        ?.conservationClosed === true);
  column.truth.persistentCoastalSediment = column.kind === 'ocean' &&
    column.ocean?.coastalSediment?.schema === COASTAL_SEDIMENT_STATE_SCHEMA;
  column.truth.dynamicGeomorphicElevation = column.kind === 'land' &&
    Number.isFinite(column.surface.geomorphicElevationAdjustmentM);
  column.truth.resolvedChannelMorphodynamics = false;
  column.truth.parameterizedLandRunoffChemistryBoundary = false;
  column.truth.energyBudgetClosed = column.budget?.energy
    ? Math.abs(finite(column.budget.energy.residualJm2)) < 1
    : true;
  return column;
}

export class EarthSystemEngine {
  constructor(options = {}) {
    this.seed = Number.isFinite(options.seed) ? options.seed : PLANET_DEFAULTS.seed;
    this.profileId = CONDITION_PROFILES[options.profileId] ? options.profileId : 'temperate';
    this.resolutionDeg = clamp(finite(options.resolutionDeg, .25), .05, 2);
    this.maximumColumns = Math.max(4, Math.min(96, Math.round(finite(options.maximumColumns, 32))));
    this.maximumAdvanceDays = Math.max(1, Math.min(1461, finite(options.maximumAdvanceDays, 730)));
    this.columns = new Map();
    this.transportDays = new Map();
    this.transportReceipts = new Map();
    if (options.state) this.restore(options.state);
  }

  setProfile(profileId) {
    if (!CONDITION_PROFILES[profileId]) throw new Error(`Unknown Earth-system profile: ${profileId}`);
    this.profileId = profileId;
  }

  key(lat, lon, profileId = this.profileId) {
    return `${profileId}:${earthCellIdentity(lat, lon, { resolutionDeg: this.resolutionDeg }).id}`;
  }

  remember(key, column) {
    if (this.columns.has(key)) this.columns.delete(key);
    this.columns.set(key, column);
    while (this.columns.size > this.maximumColumns) this.columns.delete(this.columns.keys().next().value);
    return column;
  }

  advanceAt(lat, lon, sample, weather, absoluteDay, options = {}) {
    const targetDay = finite(absoluteDay);
    const profileId = typeof options.profile === 'string' ? options.profile : options.profile?.id || sample.profile || this.profileId;
    const key = this.key(lat, lon, profileId);
    let column = this.columns.get(key);
    if (!column) {
      column = createEarthSystemColumn(lat, lon, sample, weather, {
        profile: profileId, seed: this.seed, day: targetDay,
        resolutionDeg: this.resolutionDeg,
        livingEnabled: options.livingEnabled,
        lifeAbundance: options.lifeAbundance
      });
      this.remember(key, column);
      return clone(column);
    }
    column.surface.baseElevationM = round(finite(sample.elevationM));
    column.surface.geomorphicElevationAdjustmentM = finite(
      column.land?.surfaceSediment?.geomorphicElevationAdjustmentM);
    column.surface.elevationM = round(column.surface.baseElevationM +
      column.surface.geomorphicElevationAdjustmentM, 12);
    if (targetDay < column.lastDay - CHECKPOINT_CLOCK_SKEW_TOLERANCE_DAYS) {
      throw new Error(`Earth-system clock cannot run backward: target ${targetDay.toFixed(8)}, column ${column.lastDay.toFixed(8)}, cell ${column.id}`);
    }
    const elapsedDays = targetDay - column.lastDay;
    if (elapsedDays > this.maximumAdvanceDays) throw new Error(`Earth-system catch-up exceeds ${this.maximumAdvanceDays} days`);
    let remaining = elapsedDays;
    while (remaining > 1e-9) {
      const stepDays = Math.min(1, remaining);
      column = advanceEarthSystemColumn(column, weather, sample, stepDays, {
        livingEnabled: options.livingEnabled,
        lifeAbundance: options.lifeAbundance
      });
      remaining -= stepDays;
    }
    this.remember(key, column);
    return clone(column);
  }

  getAt(lat, lon, profileId = this.profileId) {
    const column = this.columns.get(this.key(lat, lon, profileId));
    return column ? clone(column) : null;
  }

  columnsForProfile(profileId = this.profileId) {
    if (!CONDITION_PROFILES[profileId]) throw new Error(`Unknown Earth-system profile: ${profileId}`);
    return [...this.columns.values()]
      .filter(column => column.profileId === profileId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(clone);
  }

  commitTransport(profileId, absoluteDay, columns, receipt) {
    if (!CONDITION_PROFILES[profileId]) throw new Error(`Unknown Earth-system profile: ${profileId}`);
    if (!Array.isArray(columns) || !columns.length) throw new Error('Earth-system transport commit requires columns');
    const targetDay = finite(absoluteDay);
    const previousDay = this.transportDays.get(profileId);
    if (Number.isFinite(previousDay) && targetDay < previousDay - CHECKPOINT_CLOCK_SKEW_TOLERANCE_DAYS) {
      throw new Error(`Earth-system transport clock cannot run backward: target ${targetDay.toFixed(8)}, transport ${previousDay.toFixed(8)}`);
    }
    for (const source of columns) {
      if (!validateRestoredColumn(source) || source.profileId !== profileId || source.seed !== this.seed) {
        throw new Error('Earth-system transport commit received an incompatible column');
      }
      this.remember(`${profileId}:${source.id}`, normalizeRestoredColumn(source));
    }
    this.transportDays.set(profileId, round(targetDay, 8));
    if (receipt) this.transportReceipts.set(profileId, clone(receipt));
    return this.transportStatus(profileId);
  }

  transportStatus(profileId = this.profileId) {
    return {
      profileId,
      lastDay: this.transportDays.has(profileId) ? this.transportDays.get(profileId) : null,
      receipt: this.transportReceipts.has(profileId) ? clone(this.transportReceipts.get(profileId)) : null
    };
  }

  snapshot() {
    return {
      schema: EARTH_SYSTEM_ENGINE_SCHEMA,
      seed: this.seed,
      activeProfileId: this.profileId,
      resolutionDeg: this.resolutionDeg,
      maximumColumns: this.maximumColumns,
      transportDays: [...this.transportDays.entries()].map(([profileId, day]) => ({ profileId, day })),
      transportReceipts: [...this.transportReceipts.entries()].map(([profileId, receipt]) => ({ profileId, receipt: clone(receipt) })),
      columns: [...this.columns.entries()].map(([key, column]) => ({ key, column: clone(column) }))
    };
  }

  restore(state) {
    if (!state || ![
      EARTH_SYSTEM_ENGINE_SCHEMA,
      PREVIOUS_EARTH_SYSTEM_ENGINE_SCHEMA,
      'axm.foundation-planet.earth-system-engine/v30',
      'axm.foundation-planet.earth-system-engine/v29',
      'axm.foundation-planet.earth-system-engine/v28',
      'axm.foundation-planet.earth-system-engine/v27',
      'axm.foundation-planet.earth-system-engine/v26',
      'axm.foundation-planet.earth-system-engine/v25',
      'axm.foundation-planet.earth-system-engine/v23',
      'axm.foundation-planet.earth-system-engine/v22',
      'axm.foundation-planet.earth-system-engine/v21',
      'axm.foundation-planet.earth-system-engine/v20',
      'axm.foundation-planet.earth-system-engine/v19',
      'axm.foundation-planet.earth-system-engine/v18',
      'axm.foundation-planet.earth-system-engine/v17',
      'axm.foundation-planet.earth-system-engine/v16',
      'axm.foundation-planet.earth-system-engine/v15',
      'axm.foundation-planet.earth-system-engine/v14',
      'axm.foundation-planet.earth-system-engine/v13',
      'axm.foundation-planet.earth-system-engine/v12',
      'axm.foundation-planet.earth-system-engine/v11',
      'axm.foundation-planet.earth-system-engine/v10',
      'axm.foundation-planet.earth-system-engine/v9',
      'axm.foundation-planet.earth-system-engine/v8',
      'axm.foundation-planet.earth-system-engine/v7',
      'axm.foundation-planet.earth-system-engine/v6',
      'axm.foundation-planet.earth-system-engine/v5',
      'axm.foundation-planet.earth-system-engine/v4',
      'axm.foundation-planet.earth-system-engine/v3',
      'axm.foundation-planet.earth-system-engine/v2'
    ].includes(state.schema) || !Array.isArray(state.columns)) return false;
    if (finite(state.seed, this.seed) !== this.seed) return false;
    const restored = [];
    for (const entry of state.columns.slice(-this.maximumColumns)) {
      if (!entry || typeof entry.key !== 'string' || !validateRestoredColumn(entry.column)) continue;
      if (entry.column.seed !== this.seed) continue;
      restored.push([entry.key, normalizeRestoredColumn(entry.column, {
        sourceEngineSchema: state.schema
      })]);
    }
    this.columns = new Map(restored);
    this.transportDays = new Map((Array.isArray(state.transportDays) ? state.transportDays : [])
      .filter(entry => CONDITION_PROFILES[entry?.profileId] && Number.isFinite(entry?.day))
      .map(entry => [entry.profileId, round(entry.day, 8)]));
    this.transportReceipts = new Map(([
      EARTH_SYSTEM_ENGINE_SCHEMA,
      PREVIOUS_EARTH_SYSTEM_ENGINE_SCHEMA
    ].includes(state.schema) &&
      Array.isArray(state.transportReceipts) ? state.transportReceipts : [])
      .filter(entry => CONDITION_PROFILES[entry?.profileId] &&
        entry?.receipt?.schema === COMPATIBLE_EARTH_TRANSPORT_RECEIPT_SCHEMA)
      .map(entry => [entry.profileId, clone(entry.receipt)]));
    return true;
  }

  descriptor() {
    return {
      schema: EARTH_SYSTEM_ENGINE_SCHEMA,
      seed: this.seed,
      activeProfileId: this.profileId,
      resolutionDeg: this.resolutionDeg,
      loadedColumns: this.columns.size,
      maximumColumns: this.maximumColumns,
      activeTransportProfiles: this.transportDays.size,
      activeTransportDay: this.transportDays.get(this.profileId) ?? null,
      stateful: true,
      deterministic: true
    };
  }
}

export function earthSystemDescription() {
  return {
    schema: EARTH_SYSTEM_COLUMN_SCHEMA,
    engineSchema: EARTH_SYSTEM_ENGINE_SCHEMA,
    phaseChangeReceiptSchema: EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA,
    freeTroposphereSchema: EARTH_FREE_TROPOSPHERE_SCHEMA,
    freeTropospherePhaseReceiptSchema: EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA,
    verticalExchangeReceiptSchema: EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA,
    cryospherePhaseReceiptSchema: EARTH_CRYOSPHERE_PHASE_SCHEMA,
    pressureColumn: pressureColumnDescription(),
    pressureDynamics: pressureDynamicsDescription(),
    phaseThermalEnvelope: phaseThermalEnvelopeDescription(),
    atmosphereBoundaryEnergy: atmosphereBoundaryEnergyDescription(),
    pressureHorizontalTransport: pressureHorizontalTransportDescription(),
    surfaceRadiation: surfaceRadiationDescription(),
    atmosphereCo2Radiation: atmosphereCo2RadiationDescription(),
    landEcology: landEcologyDescription(),
    soilBiogeochemistry: soilBiogeochemistryDescription(),
    geomorphicSediment: geomorphicSedimentDescription(),
    oceanEcology: oceanEcologyDescription(),
    atmosphereBiogeochemistry: atmosphereBiogeochemistryDescription(),
    atmosphereBiogeochemistryVertical:
      atmosphereBiogeochemistryVerticalDescription(),
    reservoirs: ['surface-pressure-dry-air-mass', 'eight-level-pressure-coordinate-dry-air-water-heat-and-momentum', 'eight-native-cloud-liquid-reservoirs', 'eight-native-cloud-ice-reservoirs', 'seven-native-pressure-interface-convective-kinetic-energy-reservoirs', 'boundary-layer-dry-air-compatibility-projection', 'free-troposphere-dry-air-compatibility-projection', 'independent-boundary-layer-eastward-and-northward-momentum', 'independent-free-troposphere-eastward-and-northward-momentum', 'column-convective-kinetic-energy-projection', 'local-atmosphere-carbon-dioxide-carbon', 'local-atmosphere-oxygen', 'local-atmosphere-nitrogen-gas', 'aged-land-snow', 'snow-on-sea-ice', 'surface-water', 'root-zone', 'deep-soil', 'groundwater', 'land-ecology-atmospheric-carbon-compatibility-mirror', 'live-biomass-carbon-and-nitrogen', 'litter-carbon-and-nitrogen', 'soil-organic-carbon-and-nitrogen', 'mineral-nitrogen', 'finite-dissolved-soil-water-carbon-nitrogen-phosphorus-oxygen-and-alkalinity', 'finite-clay-silt-sand-and-gravel-surface-sediment', 'runoff-routing-queue', 'persistent-runoff-biogeochemistry-and-alkalinity-queue', 'persistent-runoff-sediment-queue', 'external-persistent-river-reach-storage', 'persistent-coastal-suspended-and-deposited-sediment', 'ocean-mixed-layer', 'ocean-dissolved-inorganic-and-organic-carbon', 'ocean-phytoplankton-zooplankton-and-detritus', 'ocean-dissolved-nitrogen-phosphorus-oxygen-and-alkalinity', 'ocean-atmospheric-carbon-and-oxygen-compatibility-mirrors', 'deep-ocean-dissolved-carbon-nutrients-oxygen-and-alkalinity', 'deep-ocean-detritus', 'seafloor-buried-organic-carbon-nitrogen-and-phosphorus', 'sea-ice'],
    fluxes: ['explicit-atmospheric-boundary-moisture-and-enthalpy', 'local-weather-pressure-momentum-and-two-band-thermal-boundary-forcing', 'loaded-neighbor-eight-level-dry-air-momentum-vapor-cloud-and-heat', 'native-pressure-level-vapor-to-cloud-condensation', 'native-pressure-level-cloud-to-vapor-evaporation', 'receipted-native-precipitation-descent-to-surface', 'seven-adjacent-native-equal-gross-dry-air-exchanges', 'native-adjacent-tracer-sensible-heat-and-tangent-momentum-exchange', 'seven-interface-virtual-temperature-buoyancy', 'seven-interface-bulk-entrainment-and-detrainment', 'explicit-updraft-and-compensating-downdraft-momentum', 'snowmelt', 'evaporation-to-boundary-layer', 'physiological-transpiration-to-boundary-layer', 'land-atmosphere-carbon-exchange', 'gross-primary-production', 'autotrophic-and-heterotrophic-respiration', 'litterfall', 'humification', 'nitrogen-uptake-and-mineralization', 'soil-water-to-runoff-queue-dissolved-carbon-nitrogen-phosphorus-and-oxygen', 'surface-runoff-detachment-of-finite-clay-silt-sand-and-gravel', 'same-water-fraction-runoff-sediment-routing', 'marine-primary-production', 'plankton-grazing-and-mortality', 'marine-community-respiration-and-remineralization', 'carbonate-informed-receipted-air-sea-carbon-and-oxygen-exchange', 'estuary-denitrification-to-local-atmospheric-nitrogen', 'marine-nitrogen-and-phosphorus-uptake', 'mixed-to-deep-dissolved-carbon-nutrient-oxygen-and-alkalinity-exchange', 'sinking-particle-export', 'deep-ocean-remineralization', 'seafloor-organic-burial', 'infiltration', 'recharge', 'capillary-rise', 'runoff-to-routing-queue', 'baseflow-to-routing-queue', 'runoff-queue-to-canonical-river-reach'],
    energy: ['native-liquid-ice-cloud-shortwave-optical-depth', 'native-liquid-ice-cloud-longwave-emissivity', 'eight-level-carbon-dioxide-grey-gas-longwave-adjustment', 'dynamic-vegetation-snow-and-sea-ice-albedo', 'canopy-roughness-sensible-exchange', 'shortwave', 'longwave', 'surface-latent', 'surface-snow-and-sea-ice-fusion', 'eight-level-atmospheric-phase-change-latent', 'eight-level-moist-enthalpy', 'native-adjacent-sensible-exchange', 'native-tangent-momentum-mixing-dissipation-to-sensible-heat', 'seven-interface-virtual-temperature-buoyancy-to-convective-kinetic-energy', 'seven-interface-convective-kinetic-energy-dissipation-to-sensible-heat', 'equal-gross-vertical-pressure-and-geopotential-work', 'surface-sensible', 'boundary-heat', 'surface-storage'],
    spatialModel: 'sparse canonical 0.25-degree surface columns with a conservative neighbor-transport commit seam',
    fixedMaximumStepDays: 1,
    checkpointClockSkewToleranceSeconds: CHECKPOINT_CLOCK_SKEW_TOLERANCE_DAYS * DAY_SECONDS,
    deterministic: true,
    locallyConservative: true,
    atmospherePrecipitationEvaporationClosed: true,
    cloudLiquidWaterReservoir: true,
    cloudIceWaterReservoir: true,
    nativeMixedPhaseClouds: true,
    nativeMixedPhaseCloudRadiation: true,
    nativeLayerCo2RadiativeCoupling: true,
    co2SurfaceLongwaveFeedbackApplied: true,
    broadbandGreyGasCo2Parameterization: true,
    spectralAtmosphericRadiativeTransfer: false,
    dynamicCryosphereAlbedo: true,
    cryosphereFusionEnergyReceipted: true,
    snowAgePersisted: true,
    snowOnSeaIcePersisted: true,
    persistentLandEcology: true,
    localCarbonBudget: true,
    localNitrogenBudget: true,
    persistentOceanEcology: true,
    persistentDeepOceanReservoirs: true,
    persistentDeepOceanAlkalinity: true,
    mixedToDeepMaterialClosure: true,
    mixedToDeepAlkalinityClosure: true,
    mixedLayerCarbonateDiagnostic: true,
    mixedLayerCarbonateDiagnosticMutatesMaterial: false,
    mixedLayerPHTotalResolvedWithinEnvelope: true,
    mixedLayerCarbonateSurfacePressureOnly: true,
    carbonateInformedAirSeaCo2Exchange: true,
    airSeaCo2FugacityCorrection: true,
    scientificAirSeaGasTransferVelocity: false,
    measuredAirSeaPco2: false,
    measuredOceanSkinTemperature: false,
    deepOceanPHResolved: false,
    carbonatePHFeedbackModeled: false,
    sinkingCarbonExportAndSeafloorBurial: true,
    persistentAtmosphereBiogeochemistry: true,
    nativePressureLayerAtmosphericBiogeochemistry: true,
    atmosphereBiosphereGasLedger: true,
    atmosphericBiogeochemistryVerticalTransport: true,
    atmosphericBiogeochemistryVerticalConservation: true,
    ecologyGasFieldsAreCompatibilityMirrors: true,
    atmosphericBiogeochemistryHorizontalTransport: true,
    atmosphericBiogeochemistryTransportDomain: 'loaded-canonical-neighbors',
    localOceanCarbonNitrogenPhosphorusOxygenAndAlkalinityLedgers: true,
    marineLightTemperatureIceAndNutrientCoupling: true,
    physicalOceanChemistryContinuesWithLifeOff: true,
    physiologicalTranspirationCoupled: true,
    dynamicVegetationAlbedoAndRoughness: true,
    globallyMixedAtmosphericCo2: false,
    resolvedPlantIndividuals: false,
    mechanisticPlantBiochemistry: false,
    globallyMixedAtmosphericOxygen: false,
    mechanisticPlanktonBiochemistry: false,
    threeDimensionalOceanCirculation: false,
    typedRainSnowDescent: true,
    latentFusionEnergyCoupled: true,
    freeTroposphereReservoir: true,
    hydrostaticVerticalPressurePartition: true,
    verticalAtmosphereExchangeReceipted: true,
    verticalMomentumExchangeReceipted: true,
    verticalGeopotentialExchangeReceipted: true,
    convectiveKineticEnergyReservoir: true,
    boundedTwoLayerBuoyancyConversionResolved: false,
    nativePressureInterfaceBuoyancyReceipted: true,
    nativePressureInterfaceVerticalMomentum: true,
    nativePressureInterfaceConvectiveKineticEnergy: true,
    nativePressureInterfaceEntrainmentDetrainment: true,
    verticalResolvedEnergyBudget: true,
    pressureCoordinateColumnPersisted: true,
    pressureColumnLayerCount: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
    pressureColumnConservativeProjection: true,
    pressureColumnHydrostaticInterfaces: true,
    nativePressureLevelThermodynamics: true,
    nativePressureLevelPhaseChangeReceipted: true,
    nativePhaseChangesBoundedByThermalHeadroom: true,
    nativeLayerTemperatureEnvelope: {
      minimumAirTemperatureC: MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
      maximumAirTemperatureC: MAX_NATIVE_LAYER_AIR_TEMPERATURE_C
    },
    unsupportedPhaseChangeRemainsInSourcePhase: true,
    postMaterialTemperatureClipRequired: false,
    nativePrecipitationDescentReceipted: true,
    nativeAdjacentLevelExchangeReceipted: true,
    nativePressureLevelWaterClosed: true,
    nativePressureLevelMoistEnthalpyClosed: true,
    nativePressureLevelMomentumClosed: true,
    nativePressureLevelResolvedEnergyClosed: true,
    nativePressureLevelHorizontalTransport: true,
    nativePressureLevelHorizontalWaterClosed: true,
    nativePressureLevelHorizontalMoistEnthalpyClosed: true,
    nativePressureLevelHorizontalMomentumClosed: true,
    nativePressureLevelHorizontalResolvedEnergyClosed: true,
    pressureLevelDynamicsResolved: true,
    phaseChangeLatentHeatCoupled: true,
    moistEnthalpyBudget: true,
    runoffQueuedUntilReceiptedRouting: true,
    canonicalRiverReachBridge: true,
    finiteSurfaceSediment: true,
    grainResolvedRunoffSedimentQueue: true,
    dynamicGeomorphicElevation: true,
    persistentCoastalSediment: true,
    resolvedChannelMorphodynamics: false,
    vectorAtmosphericMomentum: true,
    independentLayerAtmosphericMomentum: true,
    resolvedCloudMicrophysics: false,
    scientificallyCalibratedConvection: false,
    resolvedThreeDimensionalConvection: false,
    buoyancyAndGravitationalWorkResolved: true,
    fullAtmosphericBuoyancyAndGravitationalWorkResolved: false,
    upperAirHorizontalTransport: true,
    globalCirculationModel: false,
    scientificForecast: false
  };
}
