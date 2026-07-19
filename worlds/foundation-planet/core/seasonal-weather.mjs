import { CONDITION_PROFILES, PLANET_DEFAULTS, latLonToVector, valueNoise3 } from './planet-model.mjs';

export const WEATHER_SCHEMA = 'axm.foundation-planet.seasonal-weather/v1';
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function seasonName(dayOfYear, northern) {
  const day = ((dayOfYear % 365.25) + 365.25) % 365.25;
  const north = day < 79 ? 'winter' : day < 172 ? 'spring' : day < 265 ? 'summer' : day < 355 ? 'autumn' : 'winter';
  if (northern) return north;
  return { winter: 'summer', spring: 'autumn', summer: 'winter', autumn: 'spring' }[north];
}

function daylightHours(latDeg, declinationRad) {
  const latRad = latDeg * Math.PI / 180;
  const cosine = -Math.tan(latRad) * Math.tan(declinationRad);
  if (cosine <= -1) return 24;
  if (cosine >= 1) return 0;
  return 24 / Math.PI * Math.acos(cosine);
}

export function buildSeasonalWeather(lat, lon, baseSample, options = {}) {
  const dayOfYear = ((Number(options.dayOfYear || 0) % PLANET_DEFAULTS.yearLengthDays) + PLANET_DEFAULTS.yearLengthDays) % PLANET_DEFAULTS.yearLengthDays;
  const profile = typeof options.profile === 'string' ? CONDITION_PROFILES[options.profile] || CONDITION_PROFILES.temperate : options.profile || CONDITION_PROFILES.temperate;
  const seed = Number.isFinite(options.seed) ? options.seed : PLANET_DEFAULTS.seed;
  const axialTiltRad = PLANET_DEFAULTS.axialTiltDeg * Math.PI / 180;
  const declinationRad = axialTiltRad * Math.sin((dayOfYear - 80) / PLANET_DEFAULTS.yearLengthDays * Math.PI * 2);
  const dayHours = daylightHours(lat, declinationRad);
  const declinationDeg = declinationRad * 180 / Math.PI;
  const noonSunElevationDeg = Math.max(0, 90 - Math.abs(lat - declinationDeg));
  const hemisphere = lat >= 0 ? 1 : -1;
  const seasonalWave = Math.cos((dayOfYear - 172) / PLANET_DEFAULTS.yearLengthDays * Math.PI * 2) * hemisphere;
  const seasonalAmplitude = (4 + baseSample.latitudeAbs * 19 + baseSample.continental * 5) * (baseSample.land ? 1 : .36);
  const climateBaselineC = baseSample.land ? baseSample.temperatureC : (baseSample.ecology?.waterTemperatureC ?? baseSample.temperatureC);
  const uncoupledTemperatureC = climateBaselineC + seasonalWave * seasonalAmplitude;
  const earthSystem = options.earthSystem?.schema === 'axm.foundation-planet.earth-system-column/v1'
    ? options.earthSystem : null;
  const seasonalTemperatureC = earthSystem
    ? earthSystem.surface.temperatureC
    : uncoupledTemperatureC;

  const vector = latLonToVector(lat, lon);
  const weatherTime = dayOfYear / 4.5;
  const synoptic = valueNoise3(vector.x * 4.2 + weatherTime, vector.y * 4.2 - weatherTime * .31, vector.z * 4.2 + weatherTime * .17, seed ^ 0x720d);
  const front = valueNoise3(vector.x * 8.1 - weatherTime * .43, vector.y * 8.1 + 19, vector.z * 8.1 + weatherTime * .37, seed ^ 0x3ae1);
  const diagnosticPressureHpa = Math.round((1000 + synoptic * 29 - front * 10) * 10) / 10;
  const pressureGradient = Math.abs(front - synoptic);
  const diagnosticWindSpeedMps = Math.round((1.2 + pressureGradient * 22 + Math.max(0, 1004 - diagnosticPressureHpa) * .25) * 10) / 10;
  const diagnosticWindDirectionDeg = Math.round(((synoptic * 720 + front * 311 + lon + 720) % 360));
  const pressureHpa = earthSystem ? earthSystem.atmosphere.surfacePressureHpa : diagnosticPressureHpa;
  const windSpeedMps = earthSystem ? earthSystem.atmosphere.windSpeedMps : diagnosticWindSpeedMps;
  const windDirectionDeg = earthSystem ? earthSystem.atmosphere.windDirectionDeg : diagnosticWindDirectionDeg;
  const diagnosticHumidity = clamp(baseSample.moisture * .74 + front * .38 - Math.max(0, seasonalTemperatureC - 30) * .007);
  const humidity = earthSystem
    ? clamp(diagnosticHumidity * .55 + earthSystem.atmosphere.relativeHumidity * .45)
    : diagnosticHumidity;
  const diagnosticCloudCover = clamp(humidity * .76 + (1008 - pressureHpa) * .025 + front * .22);
  const cloudLiquidSignal = earthSystem ? clamp(earthSystem.atmosphere.cloudWaterMm / 3) : 0;
  const freeTroposphereCloudLiquidSignal = earthSystem?.atmosphere?.freeTroposphere
    ? clamp(earthSystem.atmosphere.freeTroposphere.cloudWaterMm / 2.4) : 0;
  const cloudCover = earthSystem
    ? clamp(diagnosticCloudCover * .52 + earthSystem.atmosphere.cloudFraction * .24 +
      (earthSystem.atmosphere.freeTroposphere?.cloudFraction || 0) * .14 +
      cloudLiquidSignal * .06 + freeTroposphereCloudLiquidSignal * .04)
    : diagnosticCloudCover;
  const precipitationPotential = clamp((humidity - .48) * 1.8 + (1007 - pressureHpa) * .026 +
    pressureGradient * .45 + cloudLiquidSignal * .12);
  const precipitationMmHour = precipitationPotential > .16 ? Math.round(Math.pow(precipitationPotential, 1.7) * 13 * 10) / 10 : 0;
  const precipitationType = precipitationMmHour <= 0 ? 'none' : seasonalTemperatureC < -1.5 ? 'snow' : seasonalTemperatureC < 2 ? 'sleet' : 'rain';
  const temperatureDemand = Math.max(0, seasonalTemperatureC + 5) * .12;
  const evapotranspirationMmDay = temperatureDemand * (.72 + windSpeedMps * .03) * (1.18 - humidity * .62);
  const expectedRainMmDay = baseSample.annualPrecipMm / 365.25;
  const aridityDeficit = clamp((evapotranspirationMmDay - expectedRainMmDay) / Math.max(.5, evapotranspirationMmDay));
  const soilDryness = clamp((.45 - baseSample.moisture) / .45);
  const frozenWaterStress = clamp(-seasonalTemperatureC / 18) * (1 - baseSample.moisture);
  const diagnosticDroughtIndex = baseSample.land ? clamp(aridityDeficit * .82 + soilDryness * .22 + frozenWaterStress * .25) : 0;
  const droughtIndex = baseSample.land && earthSystem?.land
    ? clamp((1 - earthSystem.land.plantAvailableFraction) * .76 + diagnosticDroughtIndex * .24)
    : diagnosticDroughtIndex;
  const snowfallSupply = precipitationType === 'snow' ? precipitationMmHour * 12 : Math.max(0, -seasonalTemperatureC) * baseSample.moisture * .8;
  const meltPressure = Math.max(0, seasonalTemperatureC) * (dayHours / 12) * 2.2;
  const diagnosticSnowpackMm = baseSample.land ? Math.round(clamp((snowfallSupply * 28 - meltPressure * 18 + Math.max(0, -seasonalTemperatureC) * 12), 0, 1800)) : 0;
  const snowpackMm = earthSystem
    ? Math.round(earthSystem.cryosphere.snowWaterEquivalentMm)
    : diagnosticSnowpackMm;
  const stormRisk = clamp((1008 - pressureHpa) / 25 + pressureGradient * .7 + cloudCover * .2);
  const lightningRisk = precipitationType === 'rain' && seasonalTemperatureC > 18 ? clamp(stormRisk * .8 + windSpeedMps / 45) : 0;
  const fuelLoad = baseSample.land ? clamp((baseSample.moisture * .65 + baseSample.habitability * .7) * Math.sqrt(profile.lifeAbundance)) : 0;
  const coldSuppression = clamp((seasonalTemperatureC + 2) / 12);
  const rainSuppression = Math.exp(-precipitationMmHour * 1.15);
  const fireRisk = clamp(droughtIndex * .58 + Math.max(0, seasonalTemperatureC - 16) / 38 + windSpeedMps / 75) * fuelLoad * coldSuppression * rainSuppression;
  const cellSignal = valueNoise3(vector.x * 13 + Math.floor(dayOfYear), vector.y * 13, vector.z * 13, seed ^ 0x1f35);
  const naturalIgnition = fireRisk > .6 && lightningRisk > .34 && cellSignal > .82;
  return {
    schema: WEATHER_SCHEMA, dayOfYear, season: seasonName(dayOfYear, lat >= 0),
    solar: { declinationDeg, daylightHours: dayHours, noonSunElevationDeg },
    seasonalTemperatureC, humidity, cloudCover, pressureHpa, windSpeedMps, windDirectionDeg,
    boundaryForcing: {
      pressureHpa: diagnosticPressureHpa,
      windSpeedMps: diagnosticWindSpeedMps,
      windDirectionDeg: diagnosticWindDirectionDeg
    },
    precipitation: { type: precipitationType, mmHour: precipitationMmHour, potential: precipitationPotential },
    evapotranspirationMmDay, droughtIndex, snowpackMm, stormRisk, lightningRisk, fireRisk, naturalIgnition,
    coupling: earthSystem ? {
      schema: earthSystem.schema,
      cellId: earthSystem.id,
      stepCount: earthSystem.stepCount,
      waterBudgetResidualMm: earthSystem.budget.water.residualMm,
      energyBudgetResidualJm2: earthSystem.budget.energy.residualJm2,
      moistEnthalpyResidualJm2: earthSystem.budget.atmosphereEnergy?.residualJm2 ?? null,
      cloudWaterMm: earthSystem.atmosphere.cloudWaterMm,
      freeTroposphere: earthSystem.atmosphere.freeTroposphere ? {
        schema: earthSystem.atmosphere.freeTroposphere.schema,
        referenceAltitudeM: earthSystem.atmosphere.freeTroposphere.referenceAltitudeM,
        pressureThicknessHpa: earthSystem.atmosphere.freeTroposphere.pressureThicknessHpa,
        airTemperatureC: earthSystem.atmosphere.freeTroposphere.airTemperatureC,
        precipitableWaterMm: earthSystem.atmosphere.freeTroposphere.precipitableWaterMm,
        cloudWaterMm: earthSystem.atmosphere.freeTroposphere.cloudWaterMm,
        verticalExchangeReceiptSchema:
          earthSystem.atmosphere.lastVerticalExchangeReceipt?.schema || null
      } : null,
      statefulSurfaceTemperature: true,
      statefulSnowAndDrought: true,
      statefulPressureAndWind: true,
      statefulCloudWaterAndLatentHeat: true,
      statefulTwoLayerAtmosphere: Boolean(earthSystem.atmosphere.freeTroposphere)
    } : null,
    summary: precipitationType === 'none' ? (cloudCover > .68 ? 'overcast' : cloudCover > .35 ? 'partly cloudy' : 'clear') :
      `${precipitationType} ${precipitationMmHour > 6 ? 'heavy' : precipitationMmHour > 2 ? 'steady' : 'light'}`,
    truth: {
      deterministicWeatherCell: true,
      derivedSeasonalState: true,
      coupledWaterEnergyColumn: earthSystem !== null,
      coupledPressureAndVectorWind: earthSystem !== null,
      coupledCloudLiquidAndLatentHeat: earthSystem !== null,
      coupledTwoLayerAtmosphere: Boolean(earthSystem?.atmosphere?.freeTroposphere),
      forecast: false,
      scientificModel: false,
      fluidSimulation: false
    }
  };
}
