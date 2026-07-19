import { PLANET_DEFAULTS, latLonToVector, sampleLatLon } from './planet-model.mjs';

export const PHYSICS_SCHEMA = 'axm.foundation-planet.physics-sector/v1';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

function addScaled(origin, axis, scale) {
  origin.x += axis.x * scale;
  origin.y += axis.y * scale;
  origin.z += axis.z * scale;
  return origin;
}

function normalizeLongitude(lon) { return ((lon + 540) % 360) - 180; }

export function gravityMagnitude(latitudeDeg, elevationM = 0) {
  const latitude = clamp(latitudeDeg, -90, 90) * DEG2RAD;
  const sinLat = Math.sin(latitude), sin2Lat = Math.sin(latitude * 2);
  const normalGravity = 9.780327 * (1 + .0053024 * sinLat * sinLat - .0000058 * sin2Lat * sin2Lat);
  const radiusScale = PLANET_DEFAULTS.radiusM / (PLANET_DEFAULTS.radiusM + Math.max(-10_000, elevationM));
  return normalGravity * radiusScale * radiusScale;
}

export function createSectorFrame(centerLat, centerLon, centerElevationM = 0) {
  const lat = clamp(Number(centerLat), -89.999999, 89.999999);
  const lon = normalizeLongitude(Number(centerLon));
  const up = normalize(latLonToVector(lat, lon));
  const longitude = lon * DEG2RAD;
  const east = normalize({ x: -Math.sin(longitude), y: 0, z: Math.cos(longitude) });
  const north = normalize({
    x: east.y * up.z - east.z * up.y,
    y: east.z * up.x - east.x * up.z,
    z: east.x * up.y - east.y * up.x
  });
  const radius = PLANET_DEFAULTS.radiusM + centerElevationM;
  return Object.freeze({
    schema: 'axm.foundation-planet.sector-frame/v1',
    worldId: PLANET_DEFAULTS.id,
    units: 'meters',
    handedness: 'right',
    axes: Object.freeze({ x: 'east', y: 'radial-up', z: 'north' }),
    center: Object.freeze({ latitudeDeg: lat, longitudeDeg: lon, elevationM: centerElevationM }),
    originEcefM: Object.freeze({ x: up.x * radius, y: up.y * radius, z: up.z * radius }),
    basis: Object.freeze({ east: Object.freeze(east), up: Object.freeze(up), north: Object.freeze(north) })
  });
}

export function canonicalToLocal(frame, coordinate) {
  const radial = normalize(latLonToVector(coordinate.latitudeDeg, coordinate.longitudeDeg));
  const radius = PLANET_DEFAULTS.radiusM + Number(coordinate.elevationM || 0);
  const point = { x: radial.x * radius, y: radial.y * radius, z: radial.z * radius };
  const delta = {
    x: point.x - frame.originEcefM.x,
    y: point.y - frame.originEcefM.y,
    z: point.z - frame.originEcefM.z
  };
  return {
    xM: dot(delta, frame.basis.east),
    yM: dot(delta, frame.basis.up),
    zM: dot(delta, frame.basis.north)
  };
}

export function localToCanonical(frame, local) {
  const point = { ...frame.originEcefM };
  addScaled(point, frame.basis.east, Number(local.xM || 0));
  addScaled(point, frame.basis.up, Number(local.yM || 0));
  addScaled(point, frame.basis.north, Number(local.zM || 0));
  const radius = Math.hypot(point.x, point.y, point.z) || PLANET_DEFAULTS.radiusM;
  return {
    latitudeDeg: Math.asin(clamp(point.y / radius, -1, 1)) * RAD2DEG,
    longitudeDeg: normalizeLongitude(Math.atan2(point.z, point.x) * RAD2DEG),
    elevationM: radius - PLANET_DEFAULTS.radiusM
  };
}

export function createPhysicsSectorDescriptor(centerLat, centerLon, options = {}) {
  const profile = options.profile || 'temperate';
  const sample = options.sample || sampleLatLon(centerLat, centerLon, { profile, seed: options.seed });
  const sizeKm = Number(options.sizeKm || 120);
  const focusKm = Number(options.focusKm || 3);
  const frame = createSectorFrame(centerLat, centerLon, sample.elevationM);
  const gravity = gravityMagnitude(centerLat, sample.elevationM);
  return {
    schema: PHYSICS_SCHEMA,
    worldId: PLANET_DEFAULTS.id,
    frame,
    floatingOrigin: true,
    integration: {
      fixedStepSeconds: 1 / 60,
      maximumSubsteps: 4,
      broadphase: 'local-sector-aabb',
      sleepingAllowed: true,
      authoritativeWrites: 'governed-world-actions-only'
    },
    gravity: {
      magnitudeMps2: gravity,
      localVectorMps2: { x: 0, y: -gravity, z: 0 },
      planetVectorMode: 'radial'
    },
    bounds: {
      regionalHalfExtentM: sizeKm * 500,
      highFidelityHalfExtentM: focusKm * 500,
      verticalMinM: -12_000,
      verticalMaxM: 12_000
    },
    colliders: {
      terrain: { type: 'streamed-heightfield', material: sample.geology?.bedrock || 'rock' },
      ocean: { type: 'buoyancy-trigger-plane', elevationM: 0 },
      rivers: { type: 'flow-trigger-ribbons', reaches: Number(options.hydrology?.summary?.riverSegments || 0) },
      organisms: { type: 'runtime-proxies', authoritative: false }
    },
    truth: {
      coordinateFrameReady: true,
      kinematicSurfaceController: true,
      generalRigidBodyEngine: false,
      wholePlanetRigidBodyScene: false
    }
  };
}

export function physicsDescription() {
  return {
    schema: PHYSICS_SCHEMA,
    units: 'meters-kilograms-seconds',
    localAxes: ['east', 'radial-up', 'north'],
    floatingOrigin: true,
    radialGravity: true,
    canonicalRoundTrip: true,
    generalRigidBodyEngine: false
  };
}
