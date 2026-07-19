import { bedrockFor, tectonicSample } from './geophysics.mjs';

export const MODEL_SCHEMA = 'axm.foundation-planet.model/v1';

export const PLANET_DEFAULTS = Object.freeze({
  id: 'world.axm.foundation-planet',
  seed: 18470219,
  radiusM: 6_371_000,
  circumferenceM: 40_030_173,
  axialTiltDeg: 23.4,
  dayLengthSeconds: 86_400,
  yearLengthDays: 365.25,
  gravityMps2: 9.81,
  seaLevelM: 0
});

export const CONDITION_PROFILES = Object.freeze({
  temperate: Object.freeze({
    id: 'temperate', name: 'Temperate Genesis', seaThreshold: 0.535,
    seaLevelOffsetM: 0, temperatureOffsetC: 0, moistureScale: 1,
    lifeAbundance: 1, iceLine: 0.83, atmosphereTint: '#7cc8ff'
  }),
  verdant: Object.freeze({
    id: 'verdant', name: 'Verdant World', seaThreshold: 0.51,
    seaLevelOffsetM: 180, temperatureOffsetC: 3.5, moistureScale: 1.25,
    lifeAbundance: 1.45, iceLine: 0.9, atmosphereTint: '#75e3d0'
  }),
  arid: Object.freeze({
    id: 'arid', name: 'Dry World', seaThreshold: 0.59,
    seaLevelOffsetM: -320, temperatureOffsetC: 7, moistureScale: 0.48,
    lifeAbundance: 0.38, iceLine: 0.94, atmosphereTint: '#e6b879'
  }),
  glacial: Object.freeze({
    id: 'glacial', name: 'Ice World', seaThreshold: 0.525,
    seaLevelOffsetM: 40, temperatureOffsetC: -24, moistureScale: 0.8,
    lifeAbundance: 0.22, iceLine: 0.55, atmosphereTint: '#afd9ff'
  }),
  barren: Object.freeze({
    id: 'barren', name: 'Barren Substrate', seaThreshold: 0.57,
    seaLevelOffsetM: -650, temperatureOffsetC: 1, moistureScale: 0.12,
    lifeAbundance: 0, iceLine: 0.86, atmosphereTint: '#b9a68d'
  })
});

export const BIOMES = Object.freeze({
  deep_ocean: { label: 'Deep ocean', color: '#071d35', vegetation: 0, roughness: 0.05 },
  ocean: { label: 'Ocean', color: '#0d4267', vegetation: 0, roughness: 0.08 },
  coast: { label: 'Coastal shelf', color: '#b4a46e', vegetation: 0.16, roughness: 0.2 },
  desert: { label: 'Desert', color: '#c69a58', vegetation: 0.05, roughness: 0.42 },
  savanna: { label: 'Savanna', color: '#9e9b43', vegetation: 0.34, roughness: 0.35 },
  grassland: { label: 'Temperate grassland', color: '#6f963f', vegetation: 0.46, roughness: 0.28 },
  temperate_forest: { label: 'Temperate forest', color: '#275f37', vegetation: 0.9, roughness: 0.5 },
  rainforest: { label: 'Rainforest', color: '#154a32', vegetation: 1, roughness: 0.62 },
  taiga: { label: 'Taiga', color: '#365b45', vegetation: 0.7, roughness: 0.55 },
  tundra: { label: 'Tundra', color: '#78806f', vegetation: 0.18, roughness: 0.32 },
  alpine: { label: 'Alpine', color: '#858680', vegetation: 0.03, roughness: 0.9 },
  ice: { label: 'Permanent ice', color: '#d9edf0', vegetation: 0, roughness: 0.18 }
});

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = value => value * value * (3 - 2 * value);
const mix = (a, b, t) => a + (b - a) * t;

function hash3(x, y, z, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) +
    Math.imul(z | 0, 2147483647) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

export function valueNoise3(x, y, z, seed = PLANET_DEFAULTS.seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const tx = smooth(x - x0), ty = smooth(y - y0), tz = smooth(z - z0);
  const a000 = hash3(x0, y0, z0, seed), a100 = hash3(x0 + 1, y0, z0, seed);
  const a010 = hash3(x0, y0 + 1, z0, seed), a110 = hash3(x0 + 1, y0 + 1, z0, seed);
  const a001 = hash3(x0, y0, z0 + 1, seed), a101 = hash3(x0 + 1, y0, z0 + 1, seed);
  const a011 = hash3(x0, y0 + 1, z0 + 1, seed), a111 = hash3(x0 + 1, y0 + 1, z0 + 1, seed);
  const x00 = mix(a000, a100, tx), x10 = mix(a010, a110, tx);
  const x01 = mix(a001, a101, tx), x11 = mix(a011, a111, tx);
  return mix(mix(x00, x10, ty), mix(x01, x11, ty), tz);
}

export function fbm3(x, y, z, seed = PLANET_DEFAULTS.seed, octaves = 5) {
  let value = 0, amplitude = 0.5, frequency = 1, total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    value += valueNoise3(x * frequency, y * frequency, z * frequency, seed + octave * 1013) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / total;
}

export function latLonToVector(latDeg, lonDeg) {
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
  const cosLat = Math.cos(lat);
  return { x: cosLat * Math.cos(lon), y: Math.sin(lat), z: cosLat * Math.sin(lon) };
}

export function vectorToLatLon(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    lat: Math.asin(clamp(vector.y / length, -1, 1)) * 180 / Math.PI,
    lon: Math.atan2(vector.z, vector.x) * 180 / Math.PI
  };
}

export function offsetLatLon(latDeg, lonDeg, eastKm, northKm, radiusM = PLANET_DEFAULTS.radiusM) {
  const radiusKm = radiusM / 1000;
  const lat = clamp(latDeg + (northKm / radiusKm) * 180 / Math.PI, -89.999, 89.999);
  const cosLat = Math.max(0.02, Math.cos(lat * Math.PI / 180));
  let lon = lonDeg + (eastKm / (radiusKm * cosLat)) * 180 / Math.PI;
  lon = ((lon + 540) % 360) - 180;
  return { lat, lon };
}

function profileOf(profile) {
  if (typeof profile === 'string') return CONDITION_PROFILES[profile] || CONDITION_PROFILES.temperate;
  return profile || CONDITION_PROFILES.temperate;
}

function classifyBiome(elevationM, temperatureC, moisture, latitudeAbs, profile) {
  if (elevationM < -1800) return 'deep_ocean';
  if (elevationM < -30) return 'ocean';
  if (elevationM < 55) return 'coast';
  if (temperatureC < -8 || latitudeAbs > profile.iceLine) return 'ice';
  if (elevationM > 3300 || (elevationM > 2300 && temperatureC < 5)) return 'alpine';
  if (temperatureC < 2) return moisture > 0.38 ? 'taiga' : 'tundra';
  if (moisture < 0.36) return 'desert';
  if (temperatureC > 22 && moisture < 0.55) return 'savanna';
  if (temperatureC > 21 && moisture > 0.7) return 'rainforest';
  if (moisture > 0.59) return 'temperate_forest';
  return 'grassland';
}

export function sampleVector(vector, options = {}) {
  const seed = Number.isFinite(options.seed) ? options.seed : PLANET_DEFAULTS.seed;
  const profile = profileOf(options.profile);
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  const x = vector.x / length, y = vector.y / length, z = vector.z / length;
  const warpA = fbm3(x * 2.1 + 9, y * 2.1 - 4, z * 2.1 + 2, seed ^ 0x41a7, 3) - 0.5;
  const warpB = fbm3(x * 2.1 - 3, y * 2.1 + 8, z * 2.1 - 7, seed ^ 0x91e1, 3) - 0.5;
  const continental = fbm3(x * 1.22 + warpA * 0.32, y * 1.22 + warpB * 0.32, z * 1.22 - warpA * 0.2, seed, 6);
  const shelves = fbm3(x * 3.1 - 5, y * 3.1 + 3, z * 3.1 + 6, seed ^ 0x779b, 4);
  const ridgeRaw = Math.abs(fbm3(x * 5.5 + 11, y * 5.5 - 9, z * 5.5 + 1, seed ^ 0x2f6d, 5) * 2 - 1);
  const ridge = Math.pow(1 - ridgeRaw, 3.2);
  const landSignal = continental * 0.82 + shelves * 0.18 - profile.seaThreshold;
  const tectonics = tectonicSample({ x, y, z }, seed);
  let elevationM;
  if (landSignal >= 0) {
    const land = clamp(landSignal / 0.22);
    elevationM = 35 + Math.pow(land, 1.35) * 2850 + ridge * Math.pow(land, 0.72) * 4300;
    elevationM += tectonics.upliftM * Math.pow(land, .68);
  } else {
    const depth = clamp(-landSignal / 0.31);
    elevationM = -70 - Math.pow(depth, 1.22) * 7200;
  }
  elevationM -= profile.seaLevelOffsetM;

  const latitudeAbs = Math.abs(Math.asin(y)) / (Math.PI / 2);
  const thermalNoise = fbm3(x * 2.8 + 17, y * 2.8, z * 2.8 - 13, seed ^ 0x3dd9, 3) - 0.5;
  const temperatureC = 29 - 54 * Math.pow(latitudeAbs, 1.38) - Math.max(0, elevationM) * 0.0062 +
    thermalNoise * 7 + profile.temperatureOffsetC;
  const wetNoise = fbm3(x * 4.4 - 8, y * 4.4 + 15, z * 4.4 + 4, seed ^ 0x6c35, 5);
  const circulation = 0.72 + 0.28 * Math.cos(latitudeAbs * Math.PI * 5.5);
  const moisture = elevationM < 0 ? 1 : clamp((wetNoise * 0.78 + circulation * 0.22) * profile.moistureScale);
  const biome = classifyBiome(elevationM, temperatureC, moisture, latitudeAbs, profile);
  const biomeInfo = BIOMES[biome];
  const annualPrecipMm = elevationM < 0 ? 0 : Math.round(clamp(Math.pow(moisture, 1.45) * 2650 * (1 + Math.max(0, temperatureC) / 95), 35, 4200));
  const rockVariation = fbm3(x * 7.2 + 21, y * 7.2 - 6, z * 7.2 + 14, seed ^ 0x52b1, 3);
  const bedrock = bedrockFor(tectonics, elevationM, temperatureC, moisture, rockVariation);
  const soilClimate = clamp((temperatureC + 12) / 44) * clamp(moisture * 1.35);
  const soilDepthM = elevationM < 0 ? 0 : clamp((.12 + soilClimate * 3.8) * (1 - ridge * .72) * (1 - tectonics.boundaryProximity * .28), .03, 5.5);
  const erosionRisk = elevationM < 0 ? 0 : clamp((ridge * .62 + tectonics.boundaryProximity * .28) * (.35 + annualPrecipMm / 2400));
  const habitability = clamp(biomeInfo.vegetation * profile.lifeAbundance *
    (1 - clamp(Math.abs(temperatureC - 17) / 50)) * (0.65 + moisture * 0.35));
  const waterDepthM = Math.max(0, -elevationM);
  const freshwaterPotential = elevationM >= 0 ? clamp(
    moisture * .55 + annualPrecipMm / 4200 * .32 + (biome === 'coast' ? .1 : 0) - Math.max(0, temperatureC - 34) * .012
  ) : 0;
  const marineMixing = elevationM < 0 ? clamp(
    .2 + tectonics.boundaryProximity * .22 + rockVariation * .24 + Math.abs(Math.sin(latitudeAbs * Math.PI * 3)) * .2
  ) : 0;
  const marineThermalSuitability = elevationM < 0 ? clamp(1 - Math.abs(Math.max(-1.8, temperatureC) - 16) / 34) : 0;
  const shelfProductivity = biome === 'coast' ? .72 : biome === 'ocean' ? .48 : biome === 'deep_ocean' ? .24 : 0;
  const marineProductivity = elevationM < 0 ? clamp(
    profile.lifeAbundance * (shelfProductivity * .55 + marineThermalSuitability * .25 + marineMixing * .2)
  ) : 0;
  const ecologicalProductivity = elevationM >= 0 ? habitability : marineProductivity;
  const realms = elevationM < 0
    ? (biome === 'deep_ocean' ? ['marine', 'deep-marine'] : biome === 'coast' ? ['marine', 'coastal'] : ['marine'])
    : (biome === 'coast' ? ['terrestrial', 'coastal', 'freshwater'] : freshwaterPotential > .22 ? ['terrestrial', 'freshwater'] : ['terrestrial']);
  return {
    elevationM, temperatureC, moisture, annualPrecipMm, biome, biomeLabel: biomeInfo.label,
    color: biomeInfo.color, habitability, land: elevationM >= 0,
    latitudeAbs, continental, ridge, profile: profile.id,
    ecology: {
      realms, productivity: ecologicalProductivity, freshwaterPotential, marineProductivity, marineMixing,
      waterDepthM, waterTemperatureC: elevationM < 0 ? Math.max(-1.8, temperatureC) : null,
      salinityPsu: elevationM < 0 ? (biome === 'coast' ? 28 : 35) : 0
    },
    geology: {
      plateId: tectonics.plateId, secondaryPlateId: tectonics.secondaryPlateId,
      continentalCrust: tectonics.continentalCrust, crustAgeMyr: tectonics.crustAgeMyr,
      boundaryProximity: tectonics.boundaryProximity, boundaryType: tectonics.boundaryType,
      relativeMotionCmYear: tectonics.relativeMotionCmYear, bedrock, soilDepthM, erosionRisk
    }
  };
}

export function sampleLatLon(latDeg, lonDeg, options = {}) {
  return sampleVector(latLonToVector(latDeg, lonDeg), options);
}

export function formatCoordinate(lat, lon, digits = 3) {
  const ns = lat >= 0 ? 'N' : 'S', ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(digits)}\u00b0 ${ns}  ${Math.abs(lon).toFixed(digits)}\u00b0 ${ew}`;
}

export function sectorKey(lat, lon, sizeDeg = 0.25) {
  const la = Math.floor((lat + 90) / sizeDeg), lo = Math.floor((lon + 180) / sizeDeg);
  return `${sizeDeg}:${la}:${lo}`;
}

export function modelDescription() {
  return {
    schema: MODEL_SCHEMA,
    coordinateSystem: 'WGS84-like spherical latitude/longitude with local tangent sectors',
    radiusM: PLANET_DEFAULTS.radiusM,
    procedural: true,
    deterministic: true,
    scientificModel: false,
    profiles: Object.keys(CONDITION_PROFILES),
    biomes: Object.keys(BIOMES)
  };
}
