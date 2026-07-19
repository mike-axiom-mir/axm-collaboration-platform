import { CONDITION_PROFILES, PLANET_DEFAULTS } from './planet-model.mjs';

export const EARTH_SYSTEM_COLUMN_SCHEMA = 'axm.foundation-planet.earth-system-column/v1';
export const EARTH_SYSTEM_ENGINE_SCHEMA = 'axm.foundation-planet.earth-system-engine/v8';
export const EARTH_SYSTEM_FLUX_SCHEMA = 'axm.foundation-planet.earth-system-flux/v1';
export const EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA = 'axm.foundation-planet.atmosphere-phase-change-receipt/v1';
export const EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA = 'axm.foundation-planet.atmosphere-vertical-exchange-receipt/v1';
export const EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA = 'axm.foundation-planet.free-troposphere-phase-receipt/v1';
export const EARTH_FREE_TROPOSPHERE_SCHEMA = 'axm.foundation-planet.free-troposphere/v1';

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
const FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M = 4500;
const STANDARD_GRAVITY_MPS2 = 9.80665;
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
  if (column.kind === 'ocean') return clamp(.065 + column.cryosphere.seaIceFraction * .54, .05, .7);
  const snowCover = clamp(column.cryosphere.snowWaterEquivalentMm / 45);
  const base = column.substrate.texture === 'sand' ? .31 : column.substrate.texture === 'organic' ? .12 : .19;
  return clamp(base * (1 - snowCover) + .72 * snowCover, .08, .78);
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

function freeTroposphereVaporCapacityMm(temperatureC) {
  return atmosphericVaporCapacityMm(temperatureC) * .58;
}

export function atmosphereWaterStorageMm(column) {
  return finite(column?.atmosphere?.precipitableWaterMm) + finite(column?.atmosphere?.cloudWaterMm) +
    finite(column?.atmosphere?.freeTroposphere?.precipitableWaterMm) +
    finite(column?.atmosphere?.freeTroposphere?.cloudWaterMm);
}

export function atmosphereLayerHeatCapacitiesJm2K(column) {
  const hasFreeTroposphere = column?.atmosphere?.freeTroposphere &&
    Number.isFinite(column.atmosphere.freeTroposphere.airTemperatureC);
  if (!hasFreeTroposphere) {
    return { boundaryLayerJm2K: ATMOSPHERE_HEAT_CAPACITY_J_M2_K, freeTroposphereJm2K: 0 };
  }
  const surfacePressureHpa = Math.max(1, finite(column.atmosphere.surfacePressureHpa, 1013.25));
  const boundaryPressureHpa = clamp(
    finite(column.atmosphere.boundaryLayerPressureHpa, surfacePressureHpa * BOUNDARY_LAYER_PRESSURE_FRACTION),
    surfacePressureHpa * .08,
    surfacePressureHpa * .5
  );
  const boundaryFraction = boundaryPressureHpa / surfacePressureHpa;
  return {
    boundaryLayerJm2K: ATMOSPHERE_HEAT_CAPACITY_J_M2_K * boundaryFraction,
    freeTroposphereJm2K: ATMOSPHERE_HEAT_CAPACITY_J_M2_K * (1 - boundaryFraction)
  };
}

export function atmosphereSensibleHeatJm2(column) {
  const capacities = atmosphereLayerHeatCapacitiesJm2K(column);
  return finite(column?.atmosphere?.airTemperatureC) * capacities.boundaryLayerJm2K +
    finite(column?.atmosphere?.freeTroposphere?.airTemperatureC) * capacities.freeTroposphereJm2K;
}

export function atmosphereMoistEnthalpyJm2(column) {
  return atmosphereSensibleHeatJm2(column) +
    (finite(column?.atmosphere?.precipitableWaterMm) +
      finite(column?.atmosphere?.freeTroposphere?.precipitableWaterMm)) *
      LATENT_HEAT_VAPORIZATION_J_KG;
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
  const initialWind = windVector(weather?.windSpeedMps, weather?.windDirectionDeg);
  const surfacePressureHpa = finite(weather?.pressureHpa, 1013.25);
  const boundaryLayerPressureHpa = surfacePressureHpa * BOUNDARY_LAYER_PRESSURE_FRACTION;
  const totalAtmosphericVaporMm = precipitableWaterMm(temperatureC, humidity);
  const boundaryLayerVaporMm = totalAtmosphericVaporMm * BOUNDARY_LAYER_VAPOR_FRACTION;
  const freeTroposphereVaporMm = totalAtmosphericVaporMm - boundaryLayerVaporMm;
  const initialLapseRateKPerKm = clamp(5.8 + (1 - humidity) * 2.2, 5.5, 8.2);
  const freeTroposphereTemperatureC = temperatureC -
    initialLapseRateKPerKm * FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M / 1000;
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
      elevationM: round(finite(sample.elevationM)),
      temperatureC: round(temperatureC),
      albedo: 0,
      pondedWaterMm: 0,
      skinWetness: land ? moisture : 1
    },
    atmosphere: {
      surfacePressureHpa: round(surfacePressureHpa),
      boundaryLayerPressureHpa: round(boundaryLayerPressureHpa),
      airTemperatureC: round(temperatureC),
      relativeHumidity: round(clamp(boundaryLayerVaporMm /
        Math.max(.01, boundaryLayerVaporCapacityMm(temperatureC)), .01, 1)),
      precipitableWaterMm: round(boundaryLayerVaporMm),
      cloudWaterMm: 0,
      cloudFraction: round(clamp(finite(weather?.cloudCover, humidity * .7))),
      windSpeedMps: round(clamp(finite(weather?.windSpeedMps, 2), 0, 90)),
      windDirectionDeg: round(((finite(weather?.windDirectionDeg) % 360) + 360) % 360),
      eastwardWindMps: round(initialWind.eastwardWindMps),
      northwardWindMps: round(initialWind.northwardWindMps),
      lastPhaseChangeReceipt: null,
      freeTroposphere: {
        schema: EARTH_FREE_TROPOSPHERE_SCHEMA,
        referenceAltitudeM: FREE_TROPOSPHERE_REFERENCE_ALTITUDE_M,
        pressureThicknessHpa: round(surfacePressureHpa - boundaryLayerPressureHpa),
        airTemperatureC: round(freeTroposphereTemperatureC),
        relativeHumidity: round(clamp(freeTroposphereVaporMm /
          Math.max(.01, freeTroposphereVaporCapacityMm(freeTroposphereTemperatureC)), .01, 1)),
        precipitableWaterMm: round(freeTroposphereVaporMm),
        cloudWaterMm: 0,
        cloudFraction: round(clamp(finite(weather?.cloudCover, humidity * .7) * .62))
      },
      lastFreeTropospherePhaseReceipt: null,
      lastVerticalExchangeReceipt: null
    },
    cryosphere: {
      snowWaterEquivalentMm: initialSnow(weather, temperatureC, land),
      soilFrozenFraction: land ? round(clamp((-temperatureC + 1) / 16)) : 0,
      seaIceFraction: land ? 0 : seaIce.fraction,
      seaIceThicknessM: land ? 0 : seaIce.thicknessM,
      seaIceWaterEquivalentMm: initialIceMm
    },
    substrate,
    land: land ? {
      rootZoneWaterMm: round(rootZoneWaterMm),
      deepSoilWaterMm: round(deepSoilWaterMm),
      groundwaterStorageMm: round(groundwaterMm),
      waterTableDepthM: round(substrate.aquiferDepthM * (1 - groundwaterMm / Math.max(1, substrate.aquiferCapacityMm))),
      rootZoneSaturation: round(rootZoneWaterMm / Math.max(1, substrate.rootCapacityMm)),
      plantAvailableFraction: round(clamp((rootZoneWaterMm - substrate.rootWiltingPointMm) /
        Math.max(1, substrate.rootFieldCapacityMm - substrate.rootWiltingPointMm)))
    } : null,
    ocean: land ? null : {
      mixedLayerDepthM: round(mixedLayerDepthM),
      mixedLayerTemperatureC: round(finite(sample?.ecology?.waterTemperatureC, temperatureC)),
      salinityPsu: round(finite(sample?.ecology?.salinityPsu, 35)),
      freshwaterAnomalyMm: round(-initialIceMm),
      heatContentJm2: 0
    },
    routing: {
      runoffQueueMm: 0,
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
        initialMoistEnthalpyJm2: 0, boundaryMoistEnthalpyJm2: 0,
        phaseChangeLatentHeatingJm2: 0, surfaceLatentInputJm2: 0,
        finalMoistEnthalpyJm2: 0, residualJm2: 0
      }
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
      atmosphericPhaseChangeReceipted: true,
      moistEnthalpyBudgetClosed: true,
      freeTroposphereReservoir: true,
      hydrostaticVerticalPressurePartition: true,
      verticalAtmosphereExchangeReceipted: false,
      verticalWaterClosed: true,
      verticalMoistEnthalpyClosed: true,
      resolvedThreeDimensionalConvection: false,
      vectorAtmosphericMomentum: true,
      conservativeNeighborAtmosphereMomentumReady: true,
      runoffHeldForReceiptedRouting: true,
      runoffCanEnterCanonicalRiverReach: true,
      globalCirculationModel: false,
      scientificForecast: false
    }
  };
  column.surface.albedo = round(albedoFor(column));
  if (column.ocean) column.ocean.heatContentJm2 = round(
    column.ocean.mixedLayerTemperatureC * WATER_HEAT_CAPACITY_J_M3_K * column.ocean.mixedLayerDepthM,
    2
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
    convectiveExchangeFractionDay: 0
  };
}

export function earthSystemWaterStorageMm(column) {
  const atmosphericWaterMm = atmosphereWaterStorageMm(column);
  const routingWaterMm = finite(column?.routing?.runoffQueueMm);
  if (column.kind === 'land') return atmosphericWaterMm + routingWaterMm + column.surface.pondedWaterMm +
    column.cryosphere.snowWaterEquivalentMm + column.land.rootZoneWaterMm +
    column.land.deepSoilWaterMm + column.land.groundwaterStorageMm;
  return atmosphericWaterMm + routingWaterMm + column.ocean.freshwaterAnomalyMm +
    column.cryosphere.seaIceWaterEquivalentMm;
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
  atmosphere.boundaryLayerPressureHpa = atmosphere.surfacePressureHpa * BOUNDARY_LAYER_PRESSURE_FRACTION;
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
  const targetTotalVaporMm = precipitableWaterMm(column.atmosphere.airTemperatureC, targetHumidity);
  const targetBoundaryVaporMm = targetTotalVaporMm * BOUNDARY_LAYER_VAPOR_FRACTION;
  const targetFreeVaporMm = targetTotalVaporMm - targetBoundaryVaporMm;
  column.atmosphere.precipitableWaterMm +=
    (targetBoundaryVaporMm - column.atmosphere.precipitableWaterMm) * response;
  column.atmosphere.precipitableWaterMm = clamp(column.atmosphere.precipitableWaterMm,
    MIN_ATMOSPHERIC_WATER_MM,
    Math.max(MIN_ATMOSPHERIC_WATER_MM, MAX_ATMOSPHERIC_WATER_MM - finite(column.atmosphere.cloudWaterMm)));
  column.atmosphere.freeTroposphere.precipitableWaterMm +=
    (targetFreeVaporMm - column.atmosphere.freeTroposphere.precipitableWaterMm) * freeResponse;
  column.atmosphere.freeTroposphere.precipitableWaterMm = clamp(
    column.atmosphere.freeTroposphere.precipitableWaterMm,
    0,
    Math.max(0, MAX_FREE_TROPOSPHERE_WATER_MM -
      finite(column.atmosphere.freeTroposphere.cloudWaterMm))
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
      Math.max(0, MAX_CLOUD_WATER_MM - column.atmosphere.cloudWaterMm)
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
      Math.max(0, MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM - free.cloudWaterMm)
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

function verticalAtmosphereExchange(column, dtDays) {
  const atmosphere = column.atmosphere;
  const free = atmosphere.freeTroposphere;
  const capacities = atmosphereLayerHeatCapacitiesJm2K(column);
  const initialWaterMm = atmosphereWaterStorageMm(column);
  const initialMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
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
  const boundaryDryAirKgM2 = atmosphere.boundaryLayerPressureHpa * 100 / STANDARD_GRAVITY_MPS2;
  const freeDryAirKgM2 = free.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2;
  const grossDryAirExchangeKgM2 = Math.min(boundaryDryAirKgM2, freeDryAirKgM2) *
    exchangeFraction;

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
  syncAtmosphericHumidity(column);
  syncFreeTroposphereHumidity(column);

  const finalWaterMm = atmosphereWaterStorageMm(column);
  const finalMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  return {
    schema: EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA,
    durationDays: round(dtDays, 9),
    exchangeFraction: round(exchangeFraction, 12),
    boundaryDryAirKgM2: round(boundaryDryAirKgM2, 9),
    freeDryAirKgM2: round(freeDryAirKgM2, 9),
    grossDryAirExchangeKgM2: round(grossDryAirExchangeKgM2, 9),
    initialLapseRateKPerKm: round(initialLapseRateKPerKm, 9),
    criticalLapseRateKPerKm: round(criticalLapseRateKPerKm, 9),
    finalLapseRateKPerKm: round(verticalLapseRateKPerKm(column), 9),
    instabilityKPerKm: round(instabilityKPerKm, 9),
    sensibleHeatUpwardJm2: round(sensibleHeatUpwardJm2, 3),
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
    moistEnthalpyResidualJm2: round(finalMoistEnthalpyJm2 - initialMoistEnthalpyJm2, 3),
    truth: {
      equalGrossDryAirParcelExchange: true,
      netDryAirLayerMassChange: false,
      tracersCarriedByParcelMixingRatioContrast: true,
      waterConservative: true,
      moistEnthalpyConservative: true,
      hydrostaticPressurePartitionClosed: true,
      buoyancyWorkResolved: false,
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
    MIN_ATMOSPHERIC_WATER_MM,
    Math.max(MIN_ATMOSPHERIC_WATER_MM, MAX_ATMOSPHERIC_WATER_MM - finite(column.atmosphere.cloudWaterMm))
  );
  syncAtmosphericHumidity(column);
}

function atmosphereEnergyBudget(column, waterContext, evaporationMm, phaseChange, freePhaseChange) {
  const finalMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
  const surfaceLatentInputJm2 = evaporationMm * LATENT_HEAT_VAPORIZATION_J_KG;
  return {
    initialMoistEnthalpyJm2: waterContext.initialMoistEnthalpyJm2,
    boundaryMoistEnthalpyJm2: waterContext.boundaryMoistEnthalpyJm2,
    phaseChangeLatentHeatingJm2: phaseChange.latentHeatingJm2 + freePhaseChange.latentHeatingJm2,
    surfaceLatentInputJm2,
    finalMoistEnthalpyJm2,
    residualJm2: finalMoistEnthalpyJm2 - waterContext.initialMoistEnthalpyJm2 -
      waterContext.boundaryMoistEnthalpyJm2 - surfaceLatentInputJm2
  };
}

function energyStep(column, weather, evaporationMm, dtDays) {
  const sunlight = weather?.solar || {};
  const sunElevation = Math.sin(clamp(finite(sunlight.noonSunElevationDeg), 0, 90) * Math.PI / 180);
  const daylightFactor = clamp(finite(sunlight.daylightHours, 12) / 12, 0, 2);
  const cloud = clamp(column.atmosphere.cloudFraction);
  const shortwaveWm2 = clamp(420 * sunElevation * daylightFactor * (1 - cloud * .58) * (1 - column.surface.albedo), 0, 520);
  const surfaceKelvin = Math.max(150, column.surface.temperatureC + 273.15);
  const airKelvin = Math.max(150, column.atmosphere.airTemperatureC + 273.15);
  const longwaveWm2 = 5.670374419e-8 * (Math.pow(surfaceKelvin, 4) - .82 * Math.pow(airKelvin, 4));
  const wind = clamp(finite(weather?.windSpeedMps, 2), 0, 80);
  const sensibleWm2 = clamp(3.6 * (1 + wind * .12) * (column.surface.temperatureC - column.atmosphere.airTemperatureC), -120, 180);
  const latentWm2 = Math.max(0, evaporationMm / Math.max(dtDays, 1e-9) * 2.45e6 / DAY_SECONDS);
  const netSurfaceFluxWm2 = shortwaveWm2 - longwaveWm2 - sensibleWm2 - latentWm2;
  const targetTemperature = finite(weather?.seasonalTemperatureC, column.surface.temperatureC) -
    (column.surface.albedo - .2) * (column.kind === 'ocean' ? 5 : 8);
  const timeConstantDays = column.kind === 'ocean' ? Math.max(9, column.ocean.mixedLayerDepthM * .34) : 2.8;
  const heatCapacityJm2K = column.kind === 'ocean'
    ? WATER_HEAT_CAPACITY_J_M3_K * column.ocean.mixedLayerDepthM
    : 2.35e6 + finite(column.substrate?.soilDepthM) * 1.15e6;
  const temperatureChange = (targetTemperature - column.surface.temperatureC) * (1 - Math.exp(-dtDays / timeConstantDays));
  const storageChangeJm2 = temperatureChange * heatCapacityJm2K;
  const elapsedSeconds = Math.max(1, dtDays * DAY_SECONDS);
  const surfaceFluxEnergyJm2 = netSurfaceFluxWm2 * elapsedSeconds;
  const boundaryHeatEnergyJm2 = storageChangeJm2 - surfaceFluxEnergyJm2;
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
    storageChangeJm2,
    residualJm2: storageChangeJm2 - surfaceFluxEnergyJm2 - boundaryHeatEnergyJm2,
    netRadiationWm2: shortwaveWm2 - longwaveWm2,
    latentHeatWm2: latentWm2,
    sensibleHeatWm2: sensibleWm2
  };
}

function advanceLand(column, weather, sample, dtDays, options, waterContext) {
  const substrate = column.substrate;
  const initialStorageMm = waterContext.initialStorageMm;
  const desiredPrecipitationMm = dailyPrecipitation(weather, sample) * dtDays;
  const phaseChange = phaseChangeAndPrecipitation(column, desiredPrecipitationMm, dtDays);
  const freePhaseChange = phaseChangeFreeTroposphere(column, dtDays);
  const verticalExchange = verticalAtmosphereExchange(column, dtDays);
  const precipitationMm = phaseChange.precipitationMm;
  const snowFraction = weather?.precipitation?.type === 'snow' ? 1 : weather?.precipitation?.type === 'sleet' ? .45 : 0;
  const snowfallMm = precipitationMm * snowFraction;
  const rainfallMm = precipitationMm - snowfallMm;
  column.cryosphere.snowWaterEquivalentMm += snowfallMm;
  const phaseTemperatureC = column.surface.temperatureC * .34 +
    finite(weather?.seasonalTemperatureC, column.atmosphere.airTemperatureC) * .66;
  const meltPotentialMm = Math.max(0, phaseTemperatureC) * 3.1 * dtDays *
    clamp(finite(weather?.solar?.daylightHours, 12) / 12, .15, 1.8);
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

  const surfaceEvaporationMm = Math.min(column.surface.pondedWaterMm, potentialEtMm * .32);
  column.surface.pondedWaterMm -= surfaceEvaporationMm;
  const availableAboveWilt = Math.max(0, column.land.rootZoneWaterMm - substrate.rootWiltingPointMm);
  const waterStress = clamp(availableAboveWilt / Math.max(1, substrate.rootFieldCapacityMm - substrate.rootWiltingPointMm));
  const vegetationEnabled = options.livingEnabled !== false && finite(options.lifeAbundance, 1) > 0;
  const transpirationShare = vegetationEnabled ? clamp(.32 + finite(sample.habitability) * .46, .25, .78) : 0;
  const transpirationMm = Math.min(availableAboveWilt, Math.max(0, potentialEtMm - surfaceEvaporationMm) * transpirationShare * waterStress);
  column.land.rootZoneWaterMm -= transpirationMm;
  const bareSoilEvaporationMm = Math.min(
    Math.max(0, column.land.rootZoneWaterMm - substrate.rootWiltingPointMm * .55),
    Math.max(0, potentialEtMm - surfaceEvaporationMm - transpirationMm) * (vegetationEnabled ? .42 : .72) * waterStress
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

  const evaporationMm = sublimationMm + surfaceEvaporationMm + bareSoilEvaporationMm + transpirationMm;
  returnEvaporationToAtmosphere(column, evaporationMm);
  const generatedRunoffMm = surfaceRunoffMm + baseflowMm;
  column.routing.runoffQueueMm += generatedRunoffMm;
  column.routing.cumulativeGeneratedRunoffMm += generatedRunoffMm;
  const energy = energyStep(column, weather, evaporationMm, dtDays);
  const atmosphereEnergy = atmosphereEnergyBudget(
    column, waterContext, evaporationMm, phaseChange, freePhaseChange
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
      condensationMmDay: phaseChange.condensationMm / dtDays,
      cloudEvaporationMmDay: phaseChange.cloudEvaporationMm / dtDays,
      atmosphericLatentHeatingWm2: (phaseChange.latentHeatingJm2 + freePhaseChange.latentHeatingJm2) /
        (dtDays * DAY_SECONDS),
      verticalSensibleHeatWm2: verticalExchange.sensibleHeatUpwardJm2 / (dtDays * DAY_SECONDS),
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
        finalFreeTroposphereVaporMm: column.atmosphere.freeTroposphere.precipitableWaterMm,
        finalFreeTroposphereCloudWaterMm: column.atmosphere.freeTroposphere.cloudWaterMm
      }
    },
    energy,
    atmosphereEnergy,
    phaseChange,
    freePhaseChange,
    verticalExchange
  };
}

function advanceOcean(column, weather, sample, dtDays, waterContext) {
  const initialStorageMm = waterContext.initialStorageMm;
  const desiredPrecipitationMm = dailyPrecipitation(weather, sample) * dtDays;
  const phaseChange = phaseChangeAndPrecipitation(column, desiredPrecipitationMm, dtDays);
  const freePhaseChange = phaseChangeFreeTroposphere(column, dtDays);
  const verticalExchange = verticalAtmosphereExchange(column, dtDays);
  const precipitationMm = phaseChange.precipitationMm;
  const potentialEvapMm = Math.min(
    Math.max(0, finite(weather?.evapotranspirationMmDay)) * dtDays,
    atmosphericEvaporationCapacityMm(column)
  );
  const iceSuppression = 1 - column.cryosphere.seaIceFraction * .94;
  const evaporationMm = Math.min(
    atmosphericEvaporationCapacityMm(column),
    potentialEvapMm * (.72 + clamp(finite(weather?.windSpeedMps) / 40) * .45) * iceSuppression
  );
  column.ocean.freshwaterAnomalyMm += precipitationMm - evaporationMm;
  returnEvaporationToAtmosphere(column, evaporationMm);
  const energy = energyStep(column, weather, evaporationMm, dtDays);
  const atmosphereEnergy = atmosphereEnergyBudget(
    column, waterContext, evaporationMm, phaseChange, freePhaseChange
  );
  const freezePotentialM = Math.max(0, -1.8 - column.ocean.mixedLayerTemperatureC) * .012 * dtDays;
  const meltPotentialM = Math.max(0, column.ocean.mixedLayerTemperatureC + 1.2) * .009 * dtDays;
  const oldIceWaterMm = column.cryosphere.seaIceWaterEquivalentMm;
  let thicknessM = column.cryosphere.seaIceThicknessM + freezePotentialM - meltPotentialM;
  thicknessM = clamp(thicknessM, 0, 5);
  const thermalFraction = clamp((-column.ocean.mixedLayerTemperatureC + 1.3) / 10);
  const latitudeFraction = clamp((finite(sample.latitudeAbs) - .52) / .38);
  const targetFraction = clamp(thermalFraction * .78 + latitudeFraction * .32);
  column.cryosphere.seaIceFraction += (targetFraction - column.cryosphere.seaIceFraction) * (1 - Math.exp(-dtDays / 6));
  if (thicknessM === 0) column.cryosphere.seaIceFraction = 0;
  column.cryosphere.seaIceThicknessM = thicknessM;
  column.cryosphere.seaIceWaterEquivalentMm = thicknessM * column.cryosphere.seaIceFraction *
    ICE_DENSITY_KG_M3 / WATER_DENSITY_KG_M3 * 1000;
  const iceStorageChangeMm = column.cryosphere.seaIceWaterEquivalentMm - oldIceWaterMm;
  column.ocean.freshwaterAnomalyMm -= iceStorageChangeMm;
  const referenceWaterMassMm = column.ocean.mixedLayerDepthM * 1000;
  column.ocean.salinityPsu = clamp(finite(sample?.ecology?.salinityPsu, 35) *
    referenceWaterMassMm / Math.max(1, referenceWaterMassMm + column.ocean.freshwaterAnomalyMm), 2, 43);
  column.surface.albedo = albedoFor(column);
  const finalStorageMm = earthSystemWaterStorageMm(column);
  const residualMm = finalStorageMm - initialStorageMm - waterContext.boundaryMoistureMm;
  return {
    fluxes: {
      ...emptyFluxes(),
      precipitationMmDay: precipitationMm / dtDays,
      rainfallMmDay: precipitationMm / dtDays,
      evaporationMmDay: evaporationMm / dtDays,
      freshwaterBalanceMmDay: (precipitationMm - evaporationMm) / dtDays,
      netRadiationWm2: energy.netRadiationWm2,
      latentHeatWm2: energy.latentHeatWm2,
      sensibleHeatWm2: energy.sensibleHeatWm2,
      condensationMmDay: phaseChange.condensationMm / dtDays,
      cloudEvaporationMmDay: phaseChange.cloudEvaporationMm / dtDays,
      atmosphericLatentHeatingWm2: (phaseChange.latentHeatingJm2 + freePhaseChange.latentHeatingJm2) /
        (dtDays * DAY_SECONDS),
      verticalSensibleHeatWm2: verticalExchange.sensibleHeatUpwardJm2 / (dtDays * DAY_SECONDS),
      convectiveExchangeFractionDay: verticalExchange.exchangeFraction / dtDays
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
        finalFreeTroposphereVaporMm: column.atmosphere.freeTroposphere.precipitableWaterMm,
        finalFreeTroposphereCloudWaterMm: column.atmosphere.freeTroposphere.cloudWaterMm
      }
    },
    energy,
    atmosphereEnergy,
    phaseChange,
    freePhaseChange,
    verticalExchange
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
  const initialStorageMm = earthSystemWaterStorageMm(column);
  const atmosphereUpdate = updateAtmosphere(column, weather, duration);
  const waterContext = {
    initialStorageMm,
    initialAtmosphereWaterMm: atmosphereUpdate.initialWaterMm,
    afterBoundaryAtmosphereWaterMm: atmosphereUpdate.afterBoundaryWaterMm,
    boundaryMoistureMm: atmosphereUpdate.boundaryMoistureMm,
    initialMoistEnthalpyJm2: atmosphereUpdate.initialMoistEnthalpyJm2,
    boundaryMoistEnthalpyJm2: atmosphereUpdate.boundaryMoistEnthalpyJm2
  };
  const result = column.kind === 'land'
    ? advanceLand(column, weather, sample, duration, options, waterContext)
    : advanceOcean(column, weather, sample, duration, waterContext);
  column.fluxes = result.fluxes;
  column.atmosphere.lastPhaseChangeReceipt = result.phaseChange;
  column.atmosphere.lastFreeTropospherePhaseReceipt = result.freePhaseChange;
  column.atmosphere.lastVerticalExchangeReceipt = result.verticalExchange;
  column.budget = { water: result.water, energy: result.energy, atmosphereEnergy: result.atmosphereEnergy };
  column.lastDay += duration;
  column.stepCount += 1;
  const preciseAtmosphere = {
    surfacePressureHpa: round(column.atmosphere.surfacePressureHpa, 9),
    boundaryLayerPressureHpa: round(column.atmosphere.boundaryLayerPressureHpa, 9),
    airTemperatureC: round(column.atmosphere.airTemperatureC, 9),
    precipitableWaterMm: round(column.atmosphere.precipitableWaterMm, 9),
    cloudWaterMm: round(column.atmosphere.cloudWaterMm, 9),
    freeTroposphere: {
      ...column.atmosphere.freeTroposphere,
      pressureThicknessHpa: round(column.atmosphere.freeTroposphere.pressureThicknessHpa, 9),
      airTemperatureC: round(column.atmosphere.freeTroposphere.airTemperatureC, 9),
      precipitableWaterMm: round(column.atmosphere.freeTroposphere.precipitableWaterMm, 9),
      cloudWaterMm: round(column.atmosphere.freeTroposphere.cloudWaterMm, 9),
      relativeHumidity: round(column.atmosphere.freeTroposphere.relativeHumidity, 9)
    }
  };
  const preciseAtmosphereReceipts = {
    lastPhaseChangeReceipt: clone(result.phaseChange),
    lastFreeTropospherePhaseReceipt: clone(result.freePhaseChange),
    lastVerticalExchangeReceipt: clone(result.verticalExchange)
  };
  roundColumn(column);
  Object.assign(column.atmosphere, preciseAtmosphere, {
    freeTroposphere: preciseAtmosphere.freeTroposphere,
    ...preciseAtmosphereReceipts
  });
  column.budget.atmosphereEnergy.finalMoistEnthalpyJm2 = round(atmosphereMoistEnthalpyJm2(column), 6);
  column.budget.atmosphereEnergy.residualJm2 = round(
    column.budget.atmosphereEnergy.finalMoistEnthalpyJm2 -
      column.budget.atmosphereEnergy.initialMoistEnthalpyJm2 -
      column.budget.atmosphereEnergy.boundaryMoistEnthalpyJm2 -
      column.budget.atmosphereEnergy.surfaceLatentInputJm2,
    6
  );
  column.truth.waterBudgetClosed = Math.abs(column.budget.water.residualMm) < 1e-5;
  column.truth.atmosphereCoupledToPrecipitationBudget = true;
  column.truth.cloudLiquidWaterReservoir = true;
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
  column.truth.resolvedThreeDimensionalConvection = false;
  column.truth.vectorAtmosphericMomentum = true;
  column.truth.conservativeNeighborAtmosphereMomentumReady = true;
  column.truth.runoffHeldForReceiptedRouting = true;
  column.truth.runoffCanEnterCanonicalRiverReach = true;
  column.truth.energyBudgetClosed = Math.abs(column.budget.energy.residualJm2) < 1;
  column.truth.moistEnthalpyBudgetClosed = Math.abs(column.budget.atmosphereEnergy.residualJm2) < 1;
  return column;
}

function validateRestoredColumn(column) {
  return column && column.schema === EARTH_SYSTEM_COLUMN_SCHEMA && typeof column.id === 'string' &&
    ['land', 'ocean'].includes(column.kind) && Number.isFinite(column.lastDay) &&
    column.surface && column.atmosphere && column.cryosphere && column.truth?.canonicalSparseCell === true;
}

function normalizeRestoredColumn(source) {
  const column = clone(source);
  column.surface.elevationM = finite(column.surface.elevationM);
  const hadFreeTroposphere = column.atmosphere.freeTroposphere?.schema ===
    EARTH_FREE_TROPOSPHERE_SCHEMA &&
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
      cloudFraction: clamp(finite(column.atmosphere.cloudFraction, .5) * .62)
    };
    syncFreeTroposphereHumidity(column);
    const migratedMoistEnthalpyJm2 = atmosphereMoistEnthalpyJm2(column);
    column.budget = column.budget || {};
    column.budget.atmosphereEnergy = {
      initialMoistEnthalpyJm2: migratedMoistEnthalpyJm2,
      boundaryMoistEnthalpyJm2: 0,
      phaseChangeLatentHeatingJm2: 0,
      surfaceLatentInputJm2: 0,
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
  column.atmosphere.freeTroposphere.precipitableWaterMm = clamp(
    finite(column.atmosphere.freeTroposphere.precipitableWaterMm),
    0,
    Math.max(0, MAX_FREE_TROPOSPHERE_WATER_MM -
      column.atmosphere.freeTroposphere.cloudWaterMm)
  );
  column.atmosphere.freeTroposphere.cloudFraction = clamp(
    finite(column.atmosphere.freeTroposphere.cloudFraction,
      finite(column.atmosphere.cloudFraction, .5) * .62)
  );
  if (!hadFreeTroposphere ||
      !Number.isFinite(column.atmosphere.freeTroposphere.relativeHumidity)) {
    syncFreeTroposphereHumidity(column);
  }
  column.atmosphere.lastFreeTropospherePhaseReceipt =
    column.atmosphere.lastFreeTropospherePhaseReceipt?.schema ===
      EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA
      ? column.atmosphere.lastFreeTropospherePhaseReceipt : null;
  column.atmosphere.lastVerticalExchangeReceipt =
    column.atmosphere.lastVerticalExchangeReceipt?.schema ===
      EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA
      ? column.atmosphere.lastVerticalExchangeReceipt : null;
  const hadCloudWaterReservoir = Number.isFinite(column.atmosphere.cloudWaterMm);
  column.atmosphere.cloudWaterMm = clamp(finite(column.atmosphere.cloudWaterMm), 0, MAX_CLOUD_WATER_MM);
  column.atmosphere.lastPhaseChangeReceipt = column.atmosphere.lastPhaseChangeReceipt?.schema ===
    EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA ? column.atmosphere.lastPhaseChangeReceipt : null;
  column.atmosphere.precipitableWaterMm = clamp(
    finite(column.atmosphere.precipitableWaterMm, MIN_ATMOSPHERIC_WATER_MM),
    MIN_ATMOSPHERIC_WATER_MM,
    Math.max(MIN_ATMOSPHERIC_WATER_MM, MAX_ATMOSPHERIC_WATER_MM - column.atmosphere.cloudWaterMm)
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
  column.routing = {
    runoffQueueMm: Math.max(0, finite(column.routing?.runoffQueueMm)),
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
  column.truth.resolvedThreeDimensionalConvection = false;
  column.truth.moistEnthalpyBudgetClosed = column.budget?.atmosphereEnergy
    ? Math.abs(finite(column.budget.atmosphereEnergy.residualJm2)) < 1
    : true;
  column.truth.vectorAtmosphericMomentum = true;
  column.truth.conservativeNeighborAtmosphereMomentumReady = true;
  column.truth.runoffHeldForReceiptedRouting = true;
  column.truth.runoffCanEnterCanonicalRiverReach = true;
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
        profile: profileId, seed: this.seed, day: targetDay, resolutionDeg: this.resolutionDeg
      });
      this.remember(key, column);
      return clone(column);
    }
    column.surface.elevationM = round(finite(sample.elevationM));
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
      restored.push([entry.key, normalizeRestoredColumn(entry.column)]);
    }
    this.columns = new Map(restored);
    this.transportDays = new Map((Array.isArray(state.transportDays) ? state.transportDays : [])
      .filter(entry => CONDITION_PROFILES[entry?.profileId] && Number.isFinite(entry?.day))
      .map(entry => [entry.profileId, round(entry.day, 8)]));
    this.transportReceipts = new Map((Array.isArray(state.transportReceipts) ? state.transportReceipts : [])
      .filter(entry => CONDITION_PROFILES[entry?.profileId] && entry?.receipt)
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
    phaseChangeReceiptSchema: EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA,
    freeTroposphereSchema: EARTH_FREE_TROPOSPHERE_SCHEMA,
    freeTropospherePhaseReceiptSchema: EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA,
    verticalExchangeReceiptSchema: EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA,
    reservoirs: ['surface-pressure-dry-air-mass', 'boundary-layer-dry-air', 'free-troposphere-dry-air', 'eastward-and-northward-column-mean-atmospheric-momentum', 'boundary-layer-water-vapor', 'boundary-layer-cloud-liquid-water', 'free-troposphere-water-vapor', 'free-troposphere-cloud-liquid-water', 'snow', 'surface-water', 'root-zone', 'deep-soil', 'groundwater', 'runoff-routing-queue', 'external-persistent-river-reach-storage', 'ocean-mixed-layer', 'sea-ice'],
    fluxes: ['explicit-atmospheric-boundary-moisture-and-enthalpy', 'local-weather-pressure-momentum-and-two-layer-thermal-boundary-forcing', 'loaded-neighbor-boundary-layer-dry-air-momentum-vapor-cloud-and-heat', 'boundary-and-free-troposphere-vapor-to-cloud-condensation', 'boundary-and-free-troposphere-cloud-to-vapor-evaporation', 'boundary-layer-cloud-liquid-to-precipitation', 'bounded-vertical-dry-parcel-tracer-and-sensible-heat-exchange', 'snowmelt', 'evaporation-to-boundary-layer', 'transpiration-to-boundary-layer', 'infiltration', 'recharge', 'capillary-rise', 'runoff-to-routing-queue', 'baseflow-to-routing-queue', 'runoff-queue-to-canonical-river-reach'],
    energy: ['shortwave', 'longwave', 'surface-latent', 'two-layer-atmospheric-phase-change-latent', 'two-layer-moist-enthalpy', 'vertical-sensible-exchange', 'surface-sensible', 'boundary-heat', 'surface-storage'],
    spatialModel: 'sparse canonical 0.25-degree surface columns with a conservative neighbor-transport commit seam',
    fixedMaximumStepDays: 1,
    checkpointClockSkewToleranceSeconds: CHECKPOINT_CLOCK_SKEW_TOLERANCE_DAYS * DAY_SECONDS,
    deterministic: true,
    locallyConservative: true,
    atmospherePrecipitationEvaporationClosed: true,
    cloudLiquidWaterReservoir: true,
    freeTroposphereReservoir: true,
    hydrostaticVerticalPressurePartition: true,
    verticalAtmosphereExchangeReceipted: true,
    phaseChangeLatentHeatCoupled: true,
    moistEnthalpyBudget: true,
    runoffQueuedUntilReceiptedRouting: true,
    canonicalRiverReachBridge: true,
    vectorAtmosphericMomentum: true,
    resolvedCloudMicrophysics: false,
    resolvedThreeDimensionalConvection: false,
    buoyancyAndGravitationalWorkResolved: false,
    upperAirHorizontalTransport: false,
    globalCirculationModel: false,
    scientificForecast: false
  };
}
