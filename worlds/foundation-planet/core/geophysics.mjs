export const GEOPHYSICS_SCHEMA = 'axm.foundation-planet.geophysics/v1';
export const PLATE_COUNT = 14;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function mix32(value) {
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function hash01(value, seed) { return mix32((value | 0) ^ (seed | 0)) / 4294967295; }

function fibonacciVector(index, count) {
  const y = 1 - ((index + .5) / count) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = Math.PI * (3 - Math.sqrt(5)) * (index + 0.37);
  return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function plateCatalog(seed) {
  const north = { x: 0, y: 1, z: 0 };
  return Array.from({ length: PLATE_COUNT }, (_, index) => {
    const center = fibonacciVector((index * 5) % PLATE_COUNT, PLATE_COUNT);
    let tangent = cross(center, north);
    if (Math.hypot(tangent.x, tangent.y, tangent.z) < .05) tangent = cross(center, { x: 1, y: 0, z: 0 });
    tangent = normalize(tangent);
    const motionAngle = hash01(index * 97 + 11, seed) * Math.PI * 2;
    const secondTangent = normalize(cross(center, tangent));
    const speedCmYear = 1.2 + hash01(index * 313 + 29, seed) * 7.6;
    return Object.freeze({
      id: `plate-${String(index + 1).padStart(2, '0')}`, index, center,
      continental: hash01(index * 43 + 17, seed) > .43,
      crustAgeMyr: Math.round(8 + hash01(index * 61 + 7, seed) * 280),
      motion: {
        x: (tangent.x * Math.cos(motionAngle) + secondTangent.x * Math.sin(motionAngle)) * speedCmYear,
        y: (tangent.y * Math.cos(motionAngle) + secondTangent.y * Math.sin(motionAngle)) * speedCmYear,
        z: (tangent.z * Math.cos(motionAngle) + secondTangent.z * Math.sin(motionAngle)) * speedCmYear,
        speedCmYear
      }
    });
  });
}

const catalogs = new Map();
export function platesForSeed(seed = 18470219) {
  const key = seed | 0;
  if (!catalogs.has(key)) catalogs.set(key, Object.freeze(plateCatalog(key)));
  return catalogs.get(key);
}

export function tectonicSample(vector, seed = 18470219) {
  const direction = normalize(vector), plates = platesForSeed(seed);
  let primary = null, secondary = null, bestDot = -Infinity, secondDot = -Infinity;
  for (const plate of plates) {
    const dot = direction.x * plate.center.x + direction.y * plate.center.y + direction.z * plate.center.z;
    if (dot > bestDot) { secondary = primary; secondDot = bestDot; primary = plate; bestDot = dot; }
    else if (dot > secondDot) { secondary = plate; secondDot = dot; }
  }
  const margin = Math.max(0, bestDot - secondDot);
  const boundaryProximity = Math.pow(1 - clamp(margin / .16), 2.2);
  const pairCode = (Math.min(primary.index, secondary.index) * 31 + Math.max(primary.index, secondary.index) * 17 + (seed & 255)) % 3;
  const boundaryType = pairCode === 0 ? 'convergent' : pairCode === 1 ? 'divergent' : 'transform';
  const relativeSpeed = Math.hypot(
    primary.motion.x - secondary.motion.x,
    primary.motion.y - secondary.motion.y,
    primary.motion.z - secondary.motion.z
  );
  const upliftM = boundaryProximity * (boundaryType === 'convergent' ? 1900 + relativeSpeed * 95 : boundaryType === 'transform' ? 260 : -360);
  return {
    schema: GEOPHYSICS_SCHEMA, plateId: primary.id, plateIndex: primary.index,
    secondaryPlateId: secondary.id, continentalCrust: primary.continental,
    crustAgeMyr: primary.crustAgeMyr, boundaryProximity, boundaryType,
    relativeMotionCmYear: relativeSpeed, upliftM,
    plateMotion: { ...primary.motion }
  };
}

export function bedrockFor(tectonics, elevationM, temperatureC, moisture, variation = .5) {
  if (elevationM < 0) return tectonics.crustAgeMyr < 55 ? 'young oceanic basalt' : 'oceanic basalt';
  if (tectonics.boundaryProximity > .72 && tectonics.boundaryType === 'convergent') return variation > .55 ? 'metamorphic belt' : 'volcanic andesite';
  if (tectonics.boundaryProximity > .78 && tectonics.boundaryType === 'divergent') return 'rift basalt';
  if (elevationM > 2800) return variation > .4 ? 'exposed granite' : 'metamorphic gneiss';
  if (temperatureC > 16 && moisture < .38) return variation > .48 ? 'sandstone' : 'limestone';
  if (moisture > .72 && elevationM < 800) return variation > .5 ? 'sedimentary shale' : 'limestone';
  return tectonics.continentalCrust ? (variation > .58 ? 'granite' : 'sedimentary rock') : 'basaltic terrane';
}

export function geophysicsDescription(seed = 18470219) {
  return {
    schema: GEOPHYSICS_SCHEMA, plateCount: PLATE_COUNT,
    plates: platesForSeed(seed).map(plate => ({
      id: plate.id, continental: plate.continental, crustAgeMyr: plate.crustAgeMyr,
      speedCmYear: plate.motion.speedCmYear
    })),
    model: 'deterministic spherical Voronoi plate provinces with boundary uplift proxy',
    scientificModel: false
  };
}
