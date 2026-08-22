import {
  ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA,
  atmosphereCo2RadiationDescription,
  computeAtmosphereCo2RadiativeCoupling
} from './atmosphere-co2-radiation.mjs?v=0.62.0-r62.1';

export const EARTH_SURFACE_RADIATION_SCHEMA =
  'axm.foundation-planet.surface-radiation-receipt/v2';
export const PREVIOUS_EARTH_SURFACE_RADIATION_SCHEMA =
  'axm.foundation-planet.surface-radiation-receipt/v1';
export const EARTH_CLOUD_OPTICS_SCHEMA =
  'axm.foundation-planet.native-cloud-optics/v1';

const STEFAN_BOLTZMANN_W_M2_K4 = 5.670374419e-8;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));

export function snowAlbedoForAge(ageDays = 0) {
  const age = Math.max(0, finite(ageDays));
  return clamp(.82 - .29 * (1 - Math.exp(-age / 18)), .5, .82);
}

export function surfaceAlbedo(column) {
  const cryosphere = column?.cryosphere || {};
  if (column?.kind === 'ocean') {
    const iceFraction = clamp(finite(cryosphere.seaIceFraction));
    const iceThicknessM = Math.max(0, finite(cryosphere.seaIceThicknessM));
    const snowMm = Math.max(0, finite(cryosphere.snowWaterEquivalentMm));
    const snowCoverOnIce = iceFraction > 1e-8
      ? clamp(1 - Math.exp(-snowMm / Math.max(2, iceFraction * 18)))
      : 0;
    const bareIceAlbedo = clamp(.5 + .11 * (1 - Math.exp(-iceThicknessM / .55)), .5, .62);
    const snowIceAlbedo = snowAlbedoForAge(cryosphere.snowAgeDays);
    const iceAlbedo = bareIceAlbedo * (1 - snowCoverOnIce) + snowIceAlbedo * snowCoverOnIce;
    return clamp(.065 * (1 - iceFraction) + iceAlbedo * iceFraction, .05, .84);
  }
  const snowMm = Math.max(0, finite(cryosphere.snowWaterEquivalentMm));
  const snowCover = clamp(1 - Math.exp(-snowMm / 18));
  const texture = column?.substrate?.texture;
  const bareGroundAlbedo = texture === 'sand' ? .31 : texture === 'organic' ? .12 : .19;
  const ecology = column?.land?.ecology;
  const ecologyActive = ecology?.physiology?.active === true;
  const canopyCover = ecologyActive ? clamp(finite(ecology?.canopyCover)) : 0;
  const canopyAlbedo = clamp(finite(ecology?.traits?.canopyAlbedo, .17), .07, .32);
  const snowGroundAlbedo = bareGroundAlbedo * (1 - snowCover) +
    snowAlbedoForAge(cryosphere.snowAgeDays) * snowCover;
  const exposedCanopyCover = canopyCover * (1 - snowCover * .58);
  return clamp(snowGroundAlbedo * (1 - exposedCanopyCover) +
    canopyAlbedo * exposedCanopyCover, .07, .84);
}

export function nativeCloudOpticalProperties(column) {
  const layers = Array.isArray(column?.atmosphere?.pressureColumn?.layers)
    ? column.atmosphere.pressureColumn.layers : [];
  let liquidWaterPathMm = 0;
  let iceWaterPathMm = 0;
  let cloudTemperatureNumerator = 0;
  let cloudTemperatureWeight = 0;
  const layerOpticalDepths = layers.map((layer, layerIndex) => {
    const liquidMm = Math.max(0, finite(layer?.cloudWaterMm));
    const iceMm = Math.max(0, finite(layer?.cloudIceMm));
    const temperatureC = finite(layer?.airTemperatureC,
      finite(column?.atmosphere?.airTemperatureC));
    const shortwaveOpticalDepth = clamp(liquidMm * 14 + iceMm * 8, 0, 80);
    const longwaveOpticalDepth = clamp(liquidMm * 2.4 + iceMm * 1.65, 0, 18);
    liquidWaterPathMm += liquidMm;
    iceWaterPathMm += iceMm;
    cloudTemperatureNumerator += temperatureC * (liquidMm + iceMm);
    cloudTemperatureWeight += liquidMm + iceMm;
    return {
      layerIndex,
      liquidWaterPathMm: round(liquidMm, 9),
      iceWaterPathMm: round(iceMm, 9),
      shortwaveOpticalDepth: round(shortwaveOpticalDepth, 9),
      longwaveOpticalDepth: round(longwaveOpticalDepth, 9)
    };
  });
  const totalCondensateMm = liquidWaterPathMm + iceWaterPathMm;
  const shortwaveOpticalDepth = clamp(
    layerOpticalDepths.reduce((sum, layer) => sum + layer.shortwaveOpticalDepth, 0),
    0,
    80
  );
  const longwaveOpticalDepth = clamp(
    layerOpticalDepths.reduce((sum, layer) => sum + layer.longwaveOpticalDepth, 0),
    0,
    18
  );
  const storedCloudFraction = clamp(Math.max(
    finite(column?.atmosphere?.cloudFraction),
    finite(column?.atmosphere?.freeTroposphere?.cloudFraction)
  ));
  const condensateCover = clamp(1 - Math.exp(-totalCondensateMm * 1.35));
  const condensateActivation = clamp(totalCondensateMm / .08);
  const cloudFraction = clamp(Math.max(
    condensateCover,
    storedCloudFraction * condensateActivation
  ));
  const cloudEmissionTemperatureC = cloudTemperatureWeight > 1e-12
    ? cloudTemperatureNumerator / cloudTemperatureWeight
    : finite(column?.atmosphere?.freeTroposphere?.airTemperatureC,
      finite(column?.atmosphere?.airTemperatureC));
  return {
    schema: EARTH_CLOUD_OPTICS_SCHEMA,
    nativeLayerCount: layers.length,
    liquidWaterPathMm: round(liquidWaterPathMm, 9),
    iceWaterPathMm: round(iceWaterPathMm, 9),
    totalCondensateMm: round(totalCondensateMm, 9),
    cloudFraction: round(cloudFraction, 9),
    shortwaveOpticalDepth: round(shortwaveOpticalDepth, 9),
    longwaveOpticalDepth: round(longwaveOpticalDepth, 9),
    cloudEmissionTemperatureC: round(cloudEmissionTemperatureC, 9),
    layerOpticalDepths,
    truth: {
      sourcedFromNativePressureLayers: layers.length === 8,
      liquidAndIcePathsIndependent: true,
      broadbandBulkParameterization: true,
      resolvedDropletCrystalMicrophysics: false,
      spectralRadiativeTransfer: false
    }
  };
}

export function computeSurfaceRadiation(column, weather = {}) {
  const optics = nativeCloudOpticalProperties(column);
  const sunlight = weather?.solar || {};
  const sunElevation = Math.sin(clamp(
    finite(sunlight.noonSunElevationDeg), 0, 90
  ) * Math.PI / 180);
  const daylightFactor = clamp(finite(sunlight.daylightHours, 12) / 12, 0, 2);
  const topOfAtmosphereShortwaveWm2 = clamp(432 * sunElevation * daylightFactor, 0, 700);
  const vaporPathMm = Math.max(0,
    finite(column?.atmosphere?.precipitableWaterMm) +
    finite(column?.atmosphere?.freeTroposphere?.precipitableWaterMm));
  const clearSkyShortwaveTransmissivity = clamp(
    .79 - .025 * Math.log1p(vaporPathMm), .56, .81
  );
  const cloudyTransmissivity = .16 + .84 * Math.exp(-optics.shortwaveOpticalDepth);
  const cloudShortwaveTransmissivity = clamp(
    1 - optics.cloudFraction * (1 - cloudyTransmissivity), .08, 1
  );
  const downwardShortwaveWm2 = topOfAtmosphereShortwaveWm2 *
    clearSkyShortwaveTransmissivity * cloudShortwaveTransmissivity;
  const albedo = clamp(finite(column?.surface?.albedo, surfaceAlbedo(column)), .02, .9);
  const absorbedShortwaveWm2 = downwardShortwaveWm2 * (1 - albedo);
  const clearAbsorbedShortwaveWm2 = topOfAtmosphereShortwaveWm2 *
    clearSkyShortwaveTransmissivity * (1 - albedo);

  const surfaceKelvin = Math.max(150, finite(column?.surface?.temperatureC) + 273.15);
  const airKelvin = Math.max(150, finite(column?.atmosphere?.airTemperatureC) + 273.15);
  const cloudKelvin = Math.max(150, optics.cloudEmissionTemperatureC + 273.15);
  const surfaceEmissivity = column?.kind === 'ocean' ? .985 : .965;
  const clearSkyEmissivity = clamp(.67 + .055 * Math.log1p(vaporPathMm), .67, .86);
  const cloudEmissivity = clamp(1 - Math.exp(-optics.longwaveOpticalDepth), 0, .995);
  const upwardLongwaveWm2 = surfaceEmissivity * STEFAN_BOLTZMANN_W_M2_K4 *
    Math.pow(surfaceKelvin, 4);
  const clearDownwardLongwaveWm2 = clearSkyEmissivity * STEFAN_BOLTZMANN_W_M2_K4 *
    Math.pow(airKelvin, 4);
  const cloudyDownwardLongwaveWm2 = Math.max(
    clearDownwardLongwaveWm2,
    cloudEmissivity * STEFAN_BOLTZMANN_W_M2_K4 * Math.pow(cloudKelvin, 4)
  );
  const baselineDownwardLongwaveWm2 = clearDownwardLongwaveWm2 * (1 - optics.cloudFraction) +
    cloudyDownwardLongwaveWm2 * optics.cloudFraction;
  const atmosphereCo2RadiativeCoupling =
    computeAtmosphereCo2RadiativeCoupling(column, {
      cloudFraction: optics.cloudFraction,
      cloudLongwaveEmissivity: cloudEmissivity
    });
  const downwardLongwaveWm2 = Math.max(0, baselineDownwardLongwaveWm2 +
    atmosphereCo2RadiativeCoupling.appliedSurfaceAdjustmentWm2);
  const netLongwaveUpWm2 = upwardLongwaveWm2 - downwardLongwaveWm2;
  const netRadiationWm2 = absorbedShortwaveWm2 - netLongwaveUpWm2;

  return {
    schema: EARTH_SURFACE_RADIATION_SCHEMA,
    albedo: round(albedo, 9),
    cloudOptics: optics,
    topOfAtmosphereShortwaveWm2: round(topOfAtmosphereShortwaveWm2, 6),
    clearSkyShortwaveTransmissivity: round(clearSkyShortwaveTransmissivity, 9),
    cloudShortwaveTransmissivity: round(cloudShortwaveTransmissivity, 9),
    downwardShortwaveWm2: round(downwardShortwaveWm2, 6),
    absorbedShortwaveWm2: round(absorbedShortwaveWm2, 6),
    upwardLongwaveWm2: round(upwardLongwaveWm2, 6),
    baselineDownwardLongwaveWm2: round(baselineDownwardLongwaveWm2, 6),
    downwardLongwaveWm2: round(downwardLongwaveWm2, 6),
    co2LongwaveAdjustmentWm2: round(
      atmosphereCo2RadiativeCoupling.appliedSurfaceAdjustmentWm2, 6),
    atmosphereCo2RadiativeCoupling,
    netLongwaveUpWm2: round(netLongwaveUpWm2, 6),
    netRadiationWm2: round(netRadiationWm2, 6),
    cloudShortwaveForcingWm2: round(
      absorbedShortwaveWm2 - clearAbsorbedShortwaveWm2, 6
    ),
    cloudLongwaveForcingWm2: round(
      downwardLongwaveWm2 - clearDownwardLongwaveWm2, 6
    ),
    truth: {
      nativeMixedPhaseCloudOptics: optics.truth.sourcedFromNativePressureLayers,
      dynamicSurfaceAlbedoApplied: true,
      dynamicVegetationAlbedoApplied: column?.kind !== 'land' ||
        column?.land?.ecology?.truth?.canopyRadiationFeedback === true,
      broadbandShortwaveLongwaveReceipted: true,
      nativeLayerCo2RadiativeCoupling:
        atmosphereCo2RadiativeCoupling.schema ===
          ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA &&
        atmosphereCo2RadiativeCoupling.truth
          .nativePressureLayerComposition === true,
      co2SurfaceLongwaveFeedbackApplied: true,
      broadbandGreyGasCo2Parameterization: true,
      spectralRadiativeTransfer: false
    }
  };
}

export function surfaceRadiationDescription() {
  return {
    radiationReceiptSchema: EARTH_SURFACE_RADIATION_SCHEMA,
    cloudOpticsSchema: EARTH_CLOUD_OPTICS_SCHEMA,
    atmosphereCo2Radiation: atmosphereCo2RadiationDescription(),
    nativePressureLayers: 8,
    cloudPhases: ['liquid', 'ice'],
    dynamicSurfaceAlbedo: ['substrate', 'canopy-cover', 'canopy-albedo', 'snow-age', 'sea-ice-fraction', 'sea-ice-thickness', 'snow-on-sea-ice'],
    broadband: true,
    atmosphereOwnedCo2Feedback: true,
    broadbandGreyGasCo2: true,
    spectral: false,
    resolvedDropletsOrCrystals: false
  };
}
