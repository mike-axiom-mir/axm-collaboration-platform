import * as THREE from '/shared/vendor/three-r160/three.module.js';
import {
  BIOMES, CONDITION_PROFILES, PLANET_DEFAULTS, formatCoordinate, latLonToVector,
  modelDescription, offsetLatLon, sampleLatLon, sampleVector, vectorToLatLon
} from './core/planet-model.mjs';
import { LAYER_DEFINITIONS, LayerSystem } from './core/layer-system.mjs';
import { LivingSystem } from './core/living-system.mjs';
import { geophysicsDescription } from './core/geophysics.mjs';
import { buildHydrologySector, coupleHydrologyToEarthSystem, hydrologyDescription } from './core/hydrology-model.mjs';
import { activityFactor, catalogDescription, speciesById } from './core/species-catalog.mjs';
import { buildSeasonalWeather } from './core/seasonal-weather.mjs';
import { EarthSystemEngine, earthCellIdentity, earthSystemDescription } from './core/earth-system.mjs';
import { earthTransportDescription, transportEarthSystemColumns } from './core/earth-transport.mjs';
import { BasinRoutingEngine, basinRoutingDescription } from './core/basin-routing.mjs';
import { createPhysicsSectorDescriptor, physicsDescription } from './core/physics-contract.mjs';
import { WorldStateStore, worldStateDescription } from './core/world-state.mjs';
import {
  createHostBootstrap, createHostPatch, createSectorSubscription, hostDescription, probeFoundationHost
} from './core/host-protocol.mjs';
import { authorityDescription } from './core/world-authority.mjs';

const WORLD_CONTRACT = Object.freeze({
  schema: 'axm.foundation-planet/v1',
  world_id: 'world.axm.foundation-planet',
  name: 'Caelus',
  lineage: ['world.grafthold.globe', 'foundation-planet-rung-1'],
  state_owner: 'foundation-planet',
  game_rulesets_own_world: false,
  coordinate_model: 'global-latlon-plus-streamed-local-tangent-sector',
  logical_radius_m: PLANET_DEFAULTS.radiusM,
  render_scales: ['orbital', 'surface-sector'],
  replaceable_conditions: true,
  living_layers_independently_controllable: true,
  physics_connection: 'floating-origin-sector-frame-v1',
  earth_system_connection: 'closed-two-layer-atmosphere-basin-routing-v2',
  authoritative_shared_state: false,
  authoritative_host_seam: 'named-world-host-v1',
  multiplayer_input_seam: 'axm.controller-input/v1',
  scientific_claim: false
});

const SAVE_KEY = 'AXM_FOUNDATION_PLANET_SAVE_V2';
const LEGACY_SAVE_KEY = 'AXM_FOUNDATION_PLANET_SAVE_V1';
const ORBIT_RADIUS = 100;
const SURFACE_SIZE_KM = 120;
const SURFACE_SEGMENTS = 72;
const TERRAIN_EXAGGERATION = 1.8;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const worldState = new WorldStateStore({ key: SAVE_KEY, legacyKey: LEGACY_SAVE_KEY });
const savedEnvelope = worldState.load();
const saved = savedEnvelope?.payload || null;
const state = {
  mode: saved?.mode === 'surface' ? 'surface' : 'orbit',
  profileId: CONDITION_PROFILES[saved?.profileId] ? saved.profileId : 'temperate',
  location: saved?.location || { lat: 25.46855, lon: -140.963 },
  day: Number(saved?.day || 118.5),
  year: Math.max(1, Number(saved?.year || 1)),
  surveyCounter: Number(saved?.surveyCounter || 12),
  timeScale: 1800,
  ready: false
};
const orbit = {
  yaw: Number(saved?.orbit?.yaw ?? -0.62), pitch: Number(saved?.orbit?.pitch ?? 0.26),
  distance: Number(saved?.orbit?.distance ?? 258), dragging: false, lastX: 0, lastY: 0
};
const surface = {
  center: { ...state.location }, playerX: 0, playerZ: 0,
  velocityX: 0, velocityZ: 0,
  yaw: Number(saved?.surface?.yaw ?? 0), pitch: Number(saved?.surface?.pitch ?? -0.08),
  groundY: 0, sector: null, currentSample: null, marine: false
};
const keys = Object.create(null);
const layers = new LayerSystem();
const living = new LivingSystem({
  seed: PLANET_DEFAULTS.seed, profileId: state.profileId,
  ageDays: Number(saved?.livingAgeDays || 0), sectorSizeKm: SURFACE_SIZE_KM,
  state: saved?.livingState || null
});
const earthSystem = new EarthSystemEngine({
  seed: PLANET_DEFAULTS.seed,
  profileId: state.profileId,
  resolutionDeg: .25,
  maximumColumns: 32,
  state: saved?.earthSystemState || null
});
const basinRouting = new BasinRoutingEngine({
  maximumReachStates: 4096,
  state: saved?.basinRoutingState || null
});

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#02070c');
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.00025, 1200);
const orbitRoot = new THREE.Group();
const surfaceRoot = new THREE.Group();
scene.add(orbitRoot, surfaceRoot);

const ambient = new THREE.HemisphereLight('#b9d8e5', '#405344', 0.42);
const sun = new THREE.DirectionalLight('#fff0cf', 2.1);
sun.position.set(180, 70, 130);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -65; sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65; sun.shadow.camera.bottom = -65;
sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 500;
scene.add(ambient, sun, sun.target);

let orbitalTerrain, orbitalWater, atmosphere, orbitalClouds, orbitalLife, orbitalGeology;
let surfaceTerrain, surfaceWater, surfaceVegetation, surfaceCanopies, surfaceSoil, surfaceWeather, surfaceSky, surfaceSnow, surfaceFire;
let surfaceRivers, surfaceLakes, surfaceGeology, localHydrology, localPhysics;
let localEarthSystem = null;
let lastEarthTransportReceipt = earthSystem.transportStatus(state.profileId).receipt;
let lastBasinRoutingReceipt = basinRouting.status(state.profileId).receipt;
let faunaObjects = [];
let seasonalWeather = null, lastWeatherQuarter = -1, lastWeatherCoordinateKey = '', lastEcosystemAge = living.ageDays;
let conditionTransitioning = false;
let currentProfile = CONDITION_PROFILES[state.profileId];
let lastFrame = performance.now(), fpsFrames = 0, fpsSince = performance.now(), lastSaveAt = performance.now();
let currentFps = 0;
let sharedHostStatus = {
  schema: 'axm.foundation-planet.host-status/v1', status: 'unprobed',
  available: false, attached: false, authoritative: false,
  worldId: PLANET_DEFAULTS.id, lineageId: null, revision: null, digest: null,
  reason: 'not-probed', automaticMutation: false
};

const ui = Object.fromEntries([
  'clock','season','coordinate','biome','biomeDot','elevation','temperature','moisture','habitability',
  'moistureLabel','habitabilityLabel','annualRainLabel','soilDepthLabel','annualRain','soilDepth','plateId','bedrock','plateBoundary','seasonNow','weatherSummary','dayLength',
  'seasonalTemp','pressure','wind','precipitation','snowpack','drought','droughtBar','fireRisk','fireBar',
  'profileSelect','layerList','lifeMaster',
  'sectorSize','vegetationCount','faunaCount','riverCount','lakeCount','riverHandoffs','physicsFrame','persistenceRevision','hostAuthority','earthCell','soilWater','groundwaterDepth','runoffFlux','waterBudget','energyBudget','seaIce','regionalAnimals','activeRealms','aquaticSpecies','keystoneSpecies','foodWebBalance',
  'transportDomain','transportWater','transportClosure','airMassRoute','momentumClosure','rotationDeflection','kineticClosure','cloudPhaseChange','verticalAtmosphere','convectiveExchange','moistEnthalpyClosure',
  'atmosphereWater','runoffQueue','runoffDestination','channelStorage','channelClosure','riverMouth',
  'populationChange','ageCohorts','migrationNet','activeFire','fps','speciesCount','speciesList','modeLabel',
  'modeHelp','randomLand','freshwater','marineSurvey','resetView','scaleLabel','heading','loading','loadingStatus','loadingBar'
].map(id => [id, document.getElementById(id)]));

function absolutePlanetDay() {
  return (state.year - 1) * PLANET_DEFAULTS.yearLengthDays + state.day;
}

function saveObject() {
  return {
    profileId: state.profileId, mode: state.mode,
    location: { ...state.location }, day: state.day, year: state.year, surveyCounter: state.surveyCounter,
    livingAgeDays: living.ageDays, livingState: living.snapshot(),
    earthSystemState: earthSystem.snapshot(),
    basinRoutingState: basinRouting.snapshot(),
    layers: layers.snapshot(),
    orbit: { yaw: orbit.yaw, pitch: orbit.pitch, distance: orbit.distance },
    surface: { yaw: surface.yaw, pitch: surface.pitch },
    hydrologyGrid: localHydrology?.grid || null
  };
}

function saveNow(kind = 'checkpoint', details = null) {
  try {
    worldState.commit(saveObject(), {
      kind, actor: 'foundation-planet', coordinate: { ...state.location }, details
    }, { expectedRevision: worldState.descriptor().revision });
    if (ui?.persistenceRevision) ui.persistenceRevision.textContent = `r${worldState.descriptor().revision}`;
  } catch (error) {
    if (error?.code === 'REVISION_CONFLICT') console.warn(error.message);
  }
}

function currentHostSource() {
  return {
    ...(worldState.envelope || {}),
    schema: worldState.envelope?.schema || 'axm.foundation-planet.runtime-state/v1',
    lineageId: worldState.descriptor().lineageId,
    revision: worldState.descriptor().revision,
    payload: saveObject()
  };
}

function updateHostDiagnostic() {
  if (!ui?.hostAuthority) return;
  ui.hostAuthority.textContent = sharedHostStatus.attached
    ? `HOST r${sharedHostStatus.revision}`
    : sharedHostStatus.available ? 'HOST READY' : 'LOCAL';
  ui.hostAuthority.title = sharedHostStatus.attached
    ? 'Living World service owns this attached Caelus revision.'
    : sharedHostStatus.available
      ? 'Authoritative host service is available; Caelus has not been explicitly created or attached.'
      : 'Browser-local revisioned state is active.';
  document.body.dataset.worldAuthority = sharedHostStatus.attached ? 'host' : 'local';
}

async function refreshSharedHost() {
  sharedHostStatus = { ...sharedHostStatus, status: 'probing', reason: null };
  updateHostDiagnostic();
  const probe = await probeFoundationHost();
  const localLineageId = worldState.descriptor().lineageId;
  if (probe.attached && probe.projection.lineageId !== localLineageId) {
    sharedHostStatus = {
      ...sharedHostStatus, status: 'lineage-mismatch', available: true, attached: false,
      authoritative: false, lineageId: probe.projection.lineageId,
      revision: probe.projection.hostRevision, digest: probe.projection.worldDigest,
      reason: 'host-lineage-does-not-match-local-lineage'
    };
  } else if (probe.attached) {
    sharedHostStatus = {
      ...sharedHostStatus, status: 'attached', available: true, attached: true,
      authoritative: true, lineageId: probe.projection.lineageId,
      revision: probe.projection.hostRevision, digest: probe.projection.worldDigest,
      reason: null, projection: probe.projection
    };
  } else {
    sharedHostStatus = {
      ...sharedHostStatus, status: probe.available ? 'available' : 'local-only',
      available: probe.available, attached: false, authoritative: false,
      lineageId: null, revision: null, digest: null, reason: probe.reason,
      worldCount: probe.worldCount || 0
    };
  }
  updateHostDiagnostic();
  return sharedHostStatus;
}

function updateLoading(label, progress) {
  ui.loadingStatus.textContent = label;
  ui.loadingBar.style.width = `${progress}%`;
}

function fibonacciVector(index, count) {
  const y = 1 - (index / Math.max(1, count - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = Math.PI * (3 - Math.sqrt(5)) * index;
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
}

function buildStars() {
  const count = 2600, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const vector = fibonacciVector(i + 23, count + 47).multiplyScalar(760 + (i % 31) * 2.8);
    positions.set([vector.x, vector.y, vector.z], i * 3);
    const warmth = (i * 37 % 100) / 100;
    colors.set([0.64 + warmth * .3, 0.78 + warmth * .18, 1], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true, size: 1.1, sizeAttenuation: false, transparent: true, opacity: .85 }));
  scene.add(stars);
}

function disposeObject(object) {
  if (!object) return;
  object.traverse?.(node => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach(material => material.dispose?.());
    else node.material?.dispose?.();
  });
  object.parent?.remove(object);
}

function buildOrbitalPlanet() {
  [orbitalTerrain, orbitalWater, atmosphere, orbitalClouds, orbitalLife, orbitalGeology].forEach(disposeObject);
  const profile = currentProfile;
  const geometry = new THREE.IcosahedronGeometry(ORBIT_RADIUS, 5);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  const vector = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    vector.fromBufferAttribute(positions, i).normalize();
    const sample = sampleVector(vector, { profile, seed: PLANET_DEFAULTS.seed });
    const reliefM = sample.elevationM > 0 ? sample.elevationM : Math.max(sample.elevationM, -3500) * .18;
    const radius = ORBIT_RADIUS + reliefM / PLANET_DEFAULTS.radiusM * ORBIT_RADIUS * 8.5;
    positions.setXYZ(i, vector.x * radius, vector.y * radius, vector.z * radius);
    color.set(sample.color);
    const reliefLight = clamp(sample.elevationM / 8000, -.08, .17);
    color.offsetHSL(0, 0, reliefLight);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  orbitalTerrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, flatShading: false }));
  orbitalTerrain.receiveShadow = true;
  orbitalTerrain.name = 'planet-terrain';
  orbitRoot.add(orbitalTerrain);

  const waterGeometry = new THREE.IcosahedronGeometry(ORBIT_RADIUS + 0.035, 5);
  orbitalWater = new THREE.Mesh(waterGeometry, new THREE.MeshPhysicalMaterial({
    color: profile.id === 'glacial' ? '#779bb2' : '#0b385d', roughness: .26, metalness: .05,
    transparent: true, opacity: .8, clearcoat: .65, clearcoatRoughness: .22, depthWrite: true
  }));
  orbitalWater.name = 'planet-water';
  orbitRoot.add(orbitalWater);

  atmosphere = new THREE.Mesh(new THREE.IcosahedronGeometry(ORBIT_RADIUS * 1.045, 5), new THREE.MeshBasicMaterial({
    color: profile.atmosphereTint, side: THREE.BackSide, transparent: true, opacity: .16,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  orbitRoot.add(atmosphere);

  const cloudPositions = [], lifePositions = [], lifeColors = [], geologyPositions = [];
  for (let i = 0; i < 3200; i++) {
    const point = fibonacciVector(i + 7, 3200);
    const sample = sampleVector(point, { profile, seed: PLANET_DEFAULTS.seed });
    if (sample.moisture > .56 && ((i * 71) % 100) / 100 < (sample.moisture - .48) * .82) {
      const p = point.clone().multiplyScalar(ORBIT_RADIUS * 1.013 + (i % 5) * .015);
      cloudPositions.push(p.x, p.y, p.z);
    }
    if (sample.land && sample.habitability > .22 && ((i * 43) % 100) / 100 < sample.habitability * .7) {
      const p = point.clone().multiplyScalar(ORBIT_RADIUS * 1.008);
      lifePositions.push(p.x, p.y, p.z);
      const c = new THREE.Color(sample.biome === 'rainforest' ? '#2cbb69' : '#75a94d');
      lifeColors.push(c.r, c.g, c.b);
    }
    if (sample.geology.boundaryProximity > .64) {
      const p = point.clone().multiplyScalar(ORBIT_RADIUS * 1.011);
      geologyPositions.push(p.x, p.y, p.z);
    }
  }
  const cloudGeometry = new THREE.BufferGeometry();
  cloudGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cloudPositions, 3));
  orbitalClouds = new THREE.Points(cloudGeometry, new THREE.PointsMaterial({ color: '#effaff', size: 1.25, transparent: true, opacity: .34, depthWrite: false }));
  orbitRoot.add(orbitalClouds);
  const lifeGeometry = new THREE.BufferGeometry();
  lifeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lifePositions, 3));
  lifeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lifeColors, 3));
  orbitalLife = new THREE.Points(lifeGeometry, new THREE.PointsMaterial({ vertexColors: true, size: .62, transparent: true, opacity: .52, depthWrite: false }));
  orbitRoot.add(orbitalLife);
  const geologyGeometry = new THREE.BufferGeometry();
  geologyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(geologyPositions, 3));
  orbitalGeology = new THREE.Points(geologyGeometry, new THREE.PointsMaterial({ color: '#e4b96b', size: .72, transparent: true, opacity: .58, depthWrite: false }));
  orbitRoot.add(orbitalGeology);
}

function localTerrainY(elevationM, xKm, zKm, centerElevationM) {
  const curvatureKm = (xKm * xKm + zKm * zKm) / (2 * (PLANET_DEFAULTS.radiusM / 1000));
  return (elevationM - centerElevationM) / 1000 * TERRAIN_EXAGGERATION - curvatureKm;
}

function sampleLocal(xKm, zKm) {
  const where = offsetLatLon(surface.center.lat, surface.center.lon, xKm, zKm);
  return { where, sample: sampleLatLon(where.lat, where.lon, { profile: currentProfile, seed: PLANET_DEFAULTS.seed }) };
}

function buildSurfaceSector(lat = state.location.lat, lon = state.location.lon) {
  surfaceRoot.children.slice().forEach(disposeObject);
  faunaObjects = [];
  surface.center = { lat, lon };
  surface.playerX = 0; surface.playerZ = 0;
  surface.velocityX = 0; surface.velocityZ = 0;
  const centerSample = sampleLatLon(lat, lon, { profile: currentProfile, seed: PLANET_DEFAULTS.seed });
  surface.currentSample = centerSample;
  surface.marine = !centerSample.land;
  const geometry = new THREE.PlaneGeometry(SURFACE_SIZE_KM, SURFACE_SIZE_KM, SURFACE_SEGMENTS, SURFACE_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const rawX = positions.getX(i), rawZ = positions.getZ(i), half = SURFACE_SIZE_KM / 2;
    const normalizedX = rawX / half, normalizedZ = rawZ / half;
    /* Concentrate the same bounded vertex budget around the expedition.
       Resolution gradually collapses toward the regional horizon. */
    const xKm = Math.sign(normalizedX) * Math.pow(Math.abs(normalizedX), 2.35) * half;
    const zKm = Math.sign(normalizedZ) * Math.pow(Math.abs(normalizedZ), 2.35) * half;
    positions.setX(i, xKm); positions.setZ(i, zKm);
    const { sample } = sampleLocal(xKm, zKm);
    positions.setY(i, localTerrainY(sample.elevationM, xKm, zKm, centerSample.elevationM));
    color.set(sample.color).offsetHSL(0, 0, ((i * 19) % 11 - 5) * .0028);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  surfaceTerrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0,
    emissive: '#142417', emissiveIntensity: .12
  }));
  surfaceTerrain.receiveShadow = true;
  surfaceRoot.add(surfaceTerrain);

  const waterGeometry = new THREE.PlaneGeometry(SURFACE_SIZE_KM, SURFACE_SIZE_KM, 32, 32);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterPositions = waterGeometry.attributes.position;
  for (let i = 0; i < waterPositions.count; i++) {
    const x = waterPositions.getX(i), z = waterPositions.getZ(i);
    waterPositions.setY(i, localTerrainY(0, x, z, centerSample.elevationM) + .002);
  }
  waterGeometry.computeVertexNormals();
  surfaceWater = new THREE.Mesh(waterGeometry, new THREE.MeshBasicMaterial({
    color: currentProfile.id === 'glacial' ? '#8bb8c7' : '#247f9c',
    transparent: false, toneMapped: false, fog: false, side: THREE.DoubleSide
  }));
  surfaceWater.receiveShadow = false;
  surfaceRoot.add(surfaceWater);

  surface.sector = living.buildSector(lat, lon, { dayOfYear: state.day });
  const uncoupledWeather = buildSeasonalWeather(lat, lon, centerSample, {
    dayOfYear: state.day, profile: currentProfile, seed: PLANET_DEFAULTS.seed
  });
  localEarthSystem = earthSystem.advanceAt(lat, lon, centerSample, uncoupledWeather, absolutePlanetDay(), {
    profile: currentProfile,
    livingEnabled: layers.livingEnabled(),
    lifeAbundance: currentProfile.lifeAbundance
  });
  seasonalWeather = buildSeasonalWeather(lat, lon, centerSample, {
    dayOfYear: state.day, profile: currentProfile, seed: PLANET_DEFAULTS.seed,
    earthSystem: localEarthSystem
  });
  surface.environment = seasonalWeather;
  lastEcosystemAge = living.ageDays;
  localHydrology = basinRouting.decorateSector(coupleHydrologyToEarthSystem(
    buildHydrologySector(lat, lon, {
      sizeKm: SURFACE_SIZE_KM, profile: state.profileId, seed: PLANET_DEFAULTS.seed
    }),
    localEarthSystem
  ), state.profileId);
  localPhysics = createPhysicsSectorDescriptor(lat, lon, {
    sizeKm: SURFACE_SIZE_KM, focusKm: 3, profile: state.profileId,
    seed: PLANET_DEFAULTS.seed, sample: centerSample, hydrology: localHydrology
  });
  buildSurfaceLife(centerSample);
  buildSurfaceHydrology(centerSample);
  buildGeologyFeatures(centerSample);
  buildWeather(centerSample);
  surface.groundY = surface.marine
    ? localTerrainY(0, 0, 0, centerSample.elevationM) - .035
    : localTerrainY(centerSample.elevationM, 0, 0, centerSample.elevationM);
  updateLayerVisibility();
  updateDiagnostics();
}

function buildSurfaceHydrology(centerSample) {
  const positions = [], colors = [];
  for (const river of localHydrology.rivers) {
    const dx = river.to.xKm - river.from.xKm, dz = river.to.zKm - river.from.zKm;
    const length = Math.hypot(dx, dz) || 1;
    const visualWidthKm = clamp(river.widthM / 1000, .0018, .05);
    const px = -dz / length * visualWidthKm * .5, pz = dx / length * visualWidthKm * .5;
    const y1 = localTerrainY(river.from.elevationM, river.from.xKm, river.from.zKm, centerSample.elevationM) + .00028;
    const y2 = localTerrainY(river.to.elevationM, river.to.xKm, river.to.zKm, centerSample.elevationM) + .00028;
    const bendSign = river.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 ? 1 : -1;
    const bendKm = Math.min(.16, length * .065) * bendSign;
    const steps = 4;
    const waterColor = new THREE.Color(river.order >= 3 ? '#174854' : '#1d5360');
    for (let step = 0; step < steps; step++) {
      const t0 = step / steps, t1 = (step + 1) / steps;
      const curve0 = Math.sin(t0 * Math.PI) * bendKm, curve1 = Math.sin(t1 * Math.PI) * bendKm;
      const ax = river.from.xKm + dx * t0 + (-dz / length) * curve0;
      const az = river.from.zKm + dz * t0 + (dx / length) * curve0;
      const bx = river.from.xKm + dx * t1 + (-dz / length) * curve1;
      const bz = river.from.zKm + dz * t1 + (dx / length) * curve1;
      const ay = y1 + (y2 - y1) * t0, by = y1 + (y2 - y1) * t1;
      positions.push(
        ax + px, ay, az + pz, ax - px, ay, az - pz, bx + px, by, bz + pz,
        ax - px, ay, az - pz, bx - px, by, bz - pz, bx + px, by, bz + pz
      );
      for (let i = 0; i < 6; i++) colors.push(waterColor.r, waterColor.g, waterColor.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  surfaceRivers = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, fog: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  }));
  surfaceRivers.renderOrder = 4;
  surfaceRoot.add(surfaceRivers);

  surfaceLakes = new THREE.Group();
  const lakeMaterial = new THREE.MeshPhysicalMaterial({ color: '#287e9a', transparent: true, opacity: .82, roughness: .2, clearcoat: .7, side: THREE.DoubleSide });
  localHydrology.lakes.forEach(lake => {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(lake.radiusKm, 28), lakeMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(lake.xKm, localTerrainY(lake.surfaceElevationM, lake.xKm, lake.zKm, centerSample.elevationM) + .0004, lake.zKm);
    mesh.receiveShadow = true;
    surfaceLakes.add(mesh);
  });
  surfaceRoot.add(surfaceLakes);
}

function bedrockColor(bedrock) {
  if (/basalt/.test(bedrock)) return '#3f4548';
  if (/limestone/.test(bedrock)) return '#b2ab91';
  if (/sandstone/.test(bedrock)) return '#a9734f';
  if (/granite|gneiss/.test(bedrock)) return '#8e8782';
  if (/andesite|metamorphic/.test(bedrock)) return '#625d65';
  return '#777265';
}

function buildGeologyFeatures(centerSample) {
  const candidates = 260;
  const geometry = new THREE.DodecahedronGeometry(.0032, 0);
  surfaceGeology = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#81786d', roughness: .97 }), candidates);
  surfaceGeology.castShadow = true;
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  let placed = 0;
  for (let i = 0; i < candidates; i++) {
    const angle = i * 2.399963229728653, radius = Math.sqrt((i + .5) / candidates) * 5.5;
    const xKm = Math.cos(angle) * radius, zKm = Math.sin(angle) * radius;
    const { sample } = sampleLocal(xKm, zKm);
    if (!sample.land) continue;
    const exposure = clamp(sample.geology.erosionRisk * .74 + sample.geology.boundaryProximity * .36 + (sample.geology.soilDepthM < .7 ? .3 : 0), .035, .82);
    if (((i * 67) % 101) / 101 > exposure) continue;
    const y = localTerrainY(sample.elevationM, xKm, zKm, centerSample.elevationM);
    const scale = .55 + ((i * 43) % 100) / 100 * 2.1;
    dummy.position.set(xKm, y + .0014 * scale, zKm);
    dummy.rotation.set((i % 7) * .19, angle, (i % 5) * .13);
    dummy.scale.set(scale * 1.25, scale * .7, scale);
    dummy.updateMatrix();
    surfaceGeology.setMatrixAt(placed, dummy.matrix);
    color.set(bedrockColor(sample.geology.bedrock)).offsetHSL(0, 0, ((i % 9) - 4) * .012);
    surfaceGeology.setColorAt(placed, color);
    placed++;
  }
  surfaceGeology.count = placed;
  surfaceGeology.instanceMatrix.needsUpdate = true;
  if (surfaceGeology.instanceColor) surfaceGeology.instanceColor.needsUpdate = true;
  surfaceRoot.add(surfaceGeology);
}

function buildSurfaceLife(centerSample) {
  const vegetation = surface.sector.vegetation;
  const trunkGeometry = surface.marine ? new THREE.IcosahedronGeometry(.0017, 0) : new THREE.CylinderGeometry(.0007, .00135, .012, 5);
  if (!surface.marine) trunkGeometry.translate(0, .006, 0);
  const canopyGeometry = surface.marine ? new THREE.IcosahedronGeometry(.0032, 0) : new THREE.ConeGeometry(.0053, .019, 7);
  if (!surface.marine) canopyGeometry.translate(0, .017, 0);
  const producerBaseColor = surface.marine ? '#63c9a8' : '#5d4028';
  const producerCrownColor = surface.marine ? '#8be3c7' : '#4a915a';
  surfaceVegetation = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: producerBaseColor, roughness: 1, emissive: producerBaseColor, emissiveIntensity: surface.marine ? .55 : .16 }), Math.max(1, vegetation.length));
  surfaceCanopies = new THREE.InstancedMesh(canopyGeometry, new THREE.MeshStandardMaterial({ color: producerCrownColor, roughness: .92, emissive: producerCrownColor, emissiveIntensity: surface.marine ? .48 : .16 }), Math.max(1, vegetation.length));
  surfaceVegetation.castShadow = surfaceCanopies.castShadow = true;
  const dummy = new THREE.Object3D();
  vegetation.forEach((tree, index) => {
    const y = surface.marine
      ? localTerrainY(0, tree.xKm, tree.zKm, centerSample.elevationM) - (.014 + (index % 11) * .008)
      : localTerrainY(tree.elevationM, tree.xKm, tree.zKm, centerSample.elevationM);
    const scale = surface.marine ? .65 + tree.health * .8 : clamp(tree.heightM / 15, .28, 1.85) * (.62 + tree.health * .38);
    dummy.position.set(tree.xKm, y, tree.zKm); dummy.scale.set(scale, scale, scale); dummy.rotation.y = (index * 2.39996) % (Math.PI * 2); dummy.updateMatrix();
    surfaceVegetation.setMatrixAt(index, dummy.matrix);
    surfaceCanopies.setMatrixAt(index, dummy.matrix);
  });
  surfaceVegetation.count = vegetation.length; surfaceCanopies.count = vegetation.length;
  surfaceRoot.add(surfaceVegetation, surfaceCanopies);

  const soilPositions = [];
  surface.sector.soil.forEach(item => {
    const local = sampleLocal(item.xKm, item.zKm).sample;
    const y = surface.marine
      ? localTerrainY(0, item.xKm, item.zKm, centerSample.elevationM) - (.022 + (soilPositions.length % 37) * .002)
      : localTerrainY(local.elevationM, item.xKm, item.zKm, centerSample.elevationM) + .0007;
    soilPositions.push(item.xKm, y, item.zKm);
  });
  const soilGeometry = new THREE.BufferGeometry();
  soilGeometry.setAttribute('position', new THREE.Float32BufferAttribute(soilPositions, 3));
  surfaceSoil = new THREE.Points(soilGeometry, new THREE.PointsMaterial({ color: surface.marine ? '#b6e6dc' : '#d8a659', size: surface.marine ? .0028 : .0015, transparent: true, opacity: surface.marine ? .5 : .65 }));
  surfaceRoot.add(surfaceSoil);

  surface.sector.fauna.forEach((fauna, index) => {
    const group = new THREE.Group();
    const roleColor = /predator/.test(fauna.trophicRole) ? '#d58968' : fauna.kind === 'aquatic' ? '#8fd7df' : fauna.trophicRole === 'scavenger' ? '#8c7d75' : fauna.kind === 'flock' ? '#d5dee1' : '#a69362';
    const material = new THREE.MeshStandardMaterial({ color: roleColor, roughness: .8, emissive: roleColor, emissiveIntensity: surface.marine ? .16 : 0 });
    const count = Math.min(8, Math.max(1, fauna.groupSize || (fauna.kind === 'flock' ? 5 : 3)));
    const massScale = clamp(Math.pow(Math.max(.03, fauna.bodyMassKg || 8) / 50, 1 / 3), .28, surface.marine ? 1.65 : 2.4);
    for (let i = 0; i < count; i++) {
      const body = new THREE.Mesh(
        fauna.kind === 'flock' ? new THREE.ConeGeometry(.0016, .0045, 3) : fauna.kind === 'aquatic' ? new THREE.SphereGeometry(.0025, 8, 5) : fauna.kind === 'grazer' ? new THREE.DodecahedronGeometry(.0022, 0) : new THREE.IcosahedronGeometry(.0019, 0),
        material
      );
      body.position.set((i - count / 2) * .0035 * massScale, (i % 2) * .0012 * massScale, (i % 3) * .0028 * massScale);
      if (fauna.kind === 'aquatic') {
        body.scale.set(massScale * 1.8, massScale * .68, massScale * .72);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(.0017, .0038, 3), material);
        tail.position.set(-.0042 * massScale, 0, 0);
        tail.rotation.z = -Math.PI / 2;
        tail.scale.setScalar(massScale);
        body.add(tail);
      } else {
        body.rotation.x = Math.PI / 2;
        body.scale.setScalar(massScale);
      }
      group.add(body);
    }
    group.userData = {
      ...fauna, index,
      radiusKm: surface.marine && fauna.kind === 'aquatic' ? .08 + (index % 8) * .05 + massScale * .045 : fauna.radiusKm
    };
    faunaObjects.push(group);
    surfaceRoot.add(group);
  });
}

function buildWeather(centerSample) {
  surfaceSky = new THREE.Mesh(new THREE.SphereGeometry(170, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      topColor: { value: new THREE.Color('#225f8d') },
      bottomColor: { value: new THREE.Color('#b5d6d5') }
    },
    vertexShader: `varying vec3 vLocal; void main(){ vLocal=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vLocal;
      void main(){ float h=clamp(normalize(vLocal).y*.5+.5,0.0,1.0); float band=smoothstep(.18,.82,h);
      gl_FragColor=vec4(mix(bottomColor,topColor,band),1.0); }`
  }));
  surfaceSky.renderOrder = -20;
  surfaceRoot.add(surfaceSky);
  const positions = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    positions[i * 3] = ((i * 73) % 1000) / 1000 * 2 - 1;
    positions[i * 3 + 1] = ((i * 193) % 1000) / 1000 * .7;
    positions[i * 3 + 2] = ((i * 337) % 1000) / 1000 * 2 - 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  surfaceWeather = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#b8d9e1', size: .0018, transparent: true, opacity: .38 }));
  surfaceRoot.add(surfaceWeather);

  const snowPositions = [];
  for (let i = 0; i < 900; i++) {
    const angle = i * 2.3999632297, radius = Math.sqrt((i + .5) / 900) * 5.2;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const sample = sampleLocal(x, z).sample;
    snowPositions.push(x, localTerrainY(sample.elevationM, x, z, centerSample.elevationM) + .00045, z);
  }
  const snowGeometry = new THREE.BufferGeometry();
  snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snowPositions, 3));
  surfaceSnow = new THREE.Points(snowGeometry, new THREE.PointsMaterial({ color: '#e8f2f2', size: .009, transparent: true, opacity: .72, depthWrite: false }));
  surfaceRoot.add(surfaceSnow);

  const firePositions = [];
  for (let i = 0; i < 90; i++) {
    const angle = i * 2.3999632297, radius = Math.sqrt((i + .5) / 90) * .7;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const sample = sampleLocal(x, z).sample;
    firePositions.push(x, localTerrainY(sample.elevationM, x, z, centerSample.elevationM) + .006 + (i % 5) * .002, z);
  }
  const fireGeometry = new THREE.BufferGeometry();
  fireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(firePositions, 3));
  surfaceFire = new THREE.Points(fireGeometry, new THREE.PointsMaterial({ color: '#ff7a32', size: .009, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
  surfaceRoot.add(surfaceFire);
}

function applyEnvironmentVisuals() {
  if (!seasonalWeather) return;
  const weatherVisible = layers.enabled('weather') && layers.enabled('atmosphere') && !surface.marine;
  if (surfaceWeather) {
    surfaceWeather.visible = weatherVisible && seasonalWeather.precipitation.mmHour > 0;
    surfaceWeather.material.color.set(seasonalWeather.precipitation.type === 'snow' ? '#edf5f7' : seasonalWeather.precipitation.type === 'sleet' ? '#cbdde4' : '#8fc9dc');
    surfaceWeather.material.opacity = clamp(.18 + seasonalWeather.precipitation.potential * .65, .18, .82);
    surfaceWeather.material.size = seasonalWeather.precipitation.type === 'snow' ? .0042 : .0018;
  }
  if (surfaceSnow) {
    surfaceSnow.visible = weatherVisible && layers.enabled('cryosphere') && seasonalWeather.snowpackMm > 8;
    surfaceSnow.material.opacity = clamp(seasonalWeather.snowpackMm / 500, .2, .85);
  }
  const activeFire = surface.sector?.community?.dynamics?.activeFire === true;
  if (surfaceFire) surfaceFire.visible = weatherVisible && layers.enabled('vegetation') && activeFire;
  if (surfaceCanopies) {
    surfaceCanopies.material.color.set(surface.marine ? '#8be3c7' : '#4a915a');
    if (!surface.marine) surfaceCanopies.material.color.lerp(new THREE.Color(activeFire ? '#65432e' : '#7b6b35'), clamp(seasonalWeather.droughtIndex * .5 + (activeFire ? .45 : 0)));
    surfaceCanopies.material.emissive.copy(surfaceCanopies.material.color);
  }
}

function updateLayerVisibility() {
  if (orbitalTerrain) orbitalTerrain.visible = true;
  if (orbitalWater) orbitalWater.visible = layers.enabled('hydrology');
  if (atmosphere) atmosphere.visible = layers.enabled('atmosphere');
  if (orbitalClouds) orbitalClouds.visible = layers.enabled('clouds');
  if (orbitalLife) orbitalLife.visible = layers.enabled('vegetation') && currentProfile.lifeAbundance > 0;
  if (orbitalGeology) orbitalGeology.visible = layers.enabled('geology');
  if (surfaceWater) surfaceWater.visible = layers.enabled('hydrology');
  if (surfaceRivers) surfaceRivers.visible = layers.enabled('hydrology');
  if (surfaceLakes) surfaceLakes.visible = layers.enabled('hydrology');
  if (surfaceGeology) surfaceGeology.visible = layers.enabled('geology');
  if (surfaceVegetation) surfaceVegetation.visible = layers.enabled('vegetation') && currentProfile.lifeAbundance > 0;
  if (surfaceCanopies) surfaceCanopies.visible = layers.enabled('vegetation') && currentProfile.lifeAbundance > 0;
  if (surfaceSoil) surfaceSoil.visible = layers.enabled('decomposers') && currentProfile.lifeAbundance > 0;
  faunaObjects.forEach(object => { object.visible = layers.enabled('fauna') && currentProfile.lifeAbundance > 0; });
  if (surfaceWeather) surfaceWeather.visible = layers.enabled('weather') && layers.enabled('atmosphere') && !surface.marine;
  if (surfaceSky) surfaceSky.visible = layers.enabled('atmosphere');
  if (surfaceSnow) surfaceSnow.visible = layers.enabled('weather') && layers.enabled('atmosphere') && layers.enabled('cryosphere');
  if (surfaceFire) surfaceFire.visible = false;
  ambient.intensity = layers.enabled('atmosphere') ? .42 : .12;
  if (state.mode === 'surface') scene.fog = layers.enabled('atmosphere')
    ? new THREE.FogExp2(surface.marine ? '#245c6e' : currentProfile.id === 'arid' ? '#8a735b' : '#9bb7b2', surface.marine ? .075 : .022)
    : null;
  renderLayerControls();
  applyEnvironmentVisuals();
}

function renderLayerControls() {
  ui.layerList.innerHTML = '';
  LAYER_DEFINITIONS.filter(layer => layer.id !== 'terrain').forEach(layer => {
    const button = document.createElement('button');
    const enabled = layers.enabled(layer.id);
    button.className = `layer-toggle ${enabled ? 'on' : ''} ${layer.mutable === false ? 'locked' : ''}`;
    button.dataset.layer = layer.id;
    button.setAttribute('aria-pressed', String(enabled));
    button.innerHTML = `<span class="switch"></span><span class="layer-name">${layer.label}</span><small>${layer.category}</small>`;
    button.addEventListener('click', () => layers.set(layer.id, !layers.enabled(layer.id)));
    ui.layerList.appendChild(button);
  });
  const livingOn = layers.livingEnabled();
  ui.lifeMaster.classList.toggle('on', livingOn);
  ui.lifeMaster.setAttribute('aria-pressed', String(livingOn));
}

function updateSurveyReadout(lat, lon, sample = sampleLatLon(lat, lon, { profile: currentProfile, seed: PLANET_DEFAULTS.seed })) {
  state.location = { lat, lon };
  ui.coordinate.textContent = formatCoordinate(lat, lon);
  ui.biome.textContent = sample.biomeLabel;
  ui.biomeDot.style.background = sample.color;
  ui.biomeDot.style.color = sample.color;
  ui.elevation.textContent = `${Math.round(sample.elevationM).toLocaleString()} m`;
  ui.temperature.textContent = `${sample.temperatureC.toFixed(1)} °C`;
  ui.moistureLabel.textContent = sample.land ? 'Moisture' : 'Salinity';
  ui.habitabilityLabel.textContent = sample.land ? 'Habitability' : 'Eco productivity';
  ui.annualRainLabel.textContent = sample.land ? 'Annual rain' : 'Water mixing';
  ui.soilDepthLabel.textContent = sample.land ? 'Soil depth' : 'Water depth';
  ui.moisture.textContent = sample.land ? `${Math.round(sample.moisture * 100)}%` : `${sample.ecology.salinityPsu.toFixed(1)} psu`;
  ui.habitability.textContent = `${Math.round((sample.land ? sample.habitability : sample.ecology.productivity) * 100)}%`;
  ui.annualRain.textContent = sample.land ? `${Math.round(sample.annualPrecipMm).toLocaleString()} mm` : `${Math.round(sample.ecology.marineMixing * 100)}%`;
  ui.soilDepth.textContent = sample.land ? `${sample.geology.soilDepthM.toFixed(2)} m` : `${Math.round(sample.ecology.waterDepthM).toLocaleString()} m`;
  ui.plateId.textContent = sample.geology.plateId;
  ui.bedrock.textContent = sample.geology.bedrock;
  ui.plateBoundary.textContent = `${sample.geology.boundaryType} · ${Math.round(sample.geology.boundaryProximity * 100)}%`;
  surface.currentSample = sample;
}

function refreshEnvironment(force = false) {
  if (conditionTransitioning && !force) return;
  if (!surface.currentSample) return;
  const quarter = Math.floor(state.day * 4);
  const coordinateKey = `${state.location.lat.toFixed(2)}:${state.location.lon.toFixed(2)}:${state.profileId}`;
  if (!force && quarter === lastWeatherQuarter && coordinateKey === lastWeatherCoordinateKey) return;
  synchronizeEarthTransportDomain();
  seasonalWeather = buildSeasonalWeather(state.location.lat, state.location.lon, surface.currentSample, {
    dayOfYear: state.day, profile: currentProfile, seed: PLANET_DEFAULTS.seed,
    earthSystem: localEarthSystem
  });
  if (localHydrology) {
    localHydrology = coupleHydrologyToEarthSystem(localHydrology, localEarthSystem);
    localHydrology = basinRouting.decorateSector(localHydrology, state.profileId);
  }
  lastWeatherQuarter = quarter; lastWeatherCoordinateKey = coordinateKey;
  ui.seasonNow.textContent = `${seasonalWeather.season} · day ${Math.floor(state.day) + 1}`;
  ui.weatherSummary.textContent = seasonalWeather.summary;
  ui.dayLength.textContent = `${seasonalWeather.solar.daylightHours.toFixed(1)} h`;
  ui.seasonalTemp.textContent = `${seasonalWeather.seasonalTemperatureC.toFixed(1)} °C`;
  ui.pressure.textContent = `${seasonalWeather.pressureHpa.toFixed(1)} hPa`;
  ui.wind.textContent = `${seasonalWeather.windSpeedMps.toFixed(1)} m/s · ${String(seasonalWeather.windDirectionDeg).padStart(3, '0')}°`;
  ui.precipitation.textContent = seasonalWeather.precipitation.type === 'none' ? 'none' : `${seasonalWeather.precipitation.type} ${seasonalWeather.precipitation.mmHour.toFixed(1)} mm/h`;
  ui.snowpack.textContent = `${seasonalWeather.snowpackMm} mm`;
  ui.drought.textContent = `${Math.round(seasonalWeather.droughtIndex * 100)}%`;
  ui.droughtBar.style.width = `${Math.round(seasonalWeather.droughtIndex * 100)}%`;
  ui.fireRisk.textContent = `${Math.round(seasonalWeather.fireRisk * 100)}%`;
  ui.fireBar.style.width = `${Math.round(seasonalWeather.fireRisk * 100)}%`;
  if (surface.sector) surface.sector.environment = seasonalWeather;
  applyEnvironmentVisuals();
}

function synchronizeEarthTransportDomain() {
  const targetDay = absolutePlanetDay();
  const identity = earthCellIdentity(state.location.lat, state.location.lon, { resolutionDeg: earthSystem.resolutionDeg });
  const latitudeCellCount = Math.round(180 / identity.resolutionDeg);
  const longitudeCellCount = Math.round(360 / identity.resolutionDeg);
  for (let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset++) {
    const latitudeIndex = identity.latitudeIndex + latitudeOffset;
    if (latitudeIndex < 0 || latitudeIndex >= latitudeCellCount) continue;
    for (let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset++) {
      const longitudeIndex = (identity.longitudeIndex + longitudeOffset + longitudeCellCount) % longitudeCellCount;
      const latitude = -90 + (latitudeIndex + .5) * identity.resolutionDeg;
      const longitude = ((-180 + (longitudeIndex + .5) * identity.resolutionDeg + 540) % 360) - 180;
      const sample = sampleLatLon(latitude, longitude, { profile: currentProfile, seed: PLANET_DEFAULTS.seed });
      const weather = buildSeasonalWeather(latitude, longitude, sample, {
        dayOfYear: state.day, profile: currentProfile, seed: PLANET_DEFAULTS.seed
      });
      earthSystem.advanceAt(latitude, longitude, sample, weather, targetDay, {
        profile: currentProfile,
        livingEnabled: layers.livingEnabled(),
        lifeAbundance: currentProfile.lifeAbundance
      });
    }
  }
  let status = earthSystem.transportStatus(state.profileId);
  if (status.lastDay === null) {
    earthSystem.commitTransport(state.profileId, targetDay, earthSystem.columnsForProfile(state.profileId), null);
  } else {
    let remainingDays = targetDay - status.lastDay;
    let transportDay = status.lastDay;
    while (remainingDays > 1e-6) {
      const stepDays = Math.min(1, remainingDays);
      const basinResult = basinRouting.advance(
        earthSystem.columnsForProfile(state.profileId),
        localHydrology,
        stepDays,
        { profileId: state.profileId, startDay: transportDay }
      );
      const result = transportEarthSystemColumns(basinResult.columns, stepDays);
      transportDay += stepDays;
      earthSystem.commitTransport(state.profileId, transportDay, result.columns, result.receipt);
      lastEarthTransportReceipt = result.receipt;
      lastBasinRoutingReceipt = basinResult.receipt;
      remainingDays = targetDay - transportDay;
    }
  }
  status = earthSystem.transportStatus(state.profileId);
  lastEarthTransportReceipt = status.receipt;
  lastBasinRoutingReceipt = basinRouting.status(state.profileId).receipt;
  localEarthSystem = earthSystem.getAt(state.location.lat, state.location.lon, state.profileId);
}

function updateDiagnostics() {
  ui.vegetationCount.textContent = layers.enabled('vegetation') ? (surface.sector?.vegetation.length || 0).toLocaleString() : 'OFF';
  ui.faunaCount.textContent = layers.enabled('fauna') ? String(surface.sector?.fauna.length || 0) : 'OFF';
  ui.riverCount.textContent = layers.enabled('hydrology') ? String(localHydrology?.summary.riverSegments || 0) : 'OFF';
  ui.lakeCount.textContent = layers.enabled('hydrology') ? String(localHydrology?.summary.lakeCount || 0) : 'OFF';
  ui.riverHandoffs.textContent = layers.enabled('hydrology') ? String(localHydrology?.summary.boundaryHandoffs || 0) : 'OFF';
  ui.physicsFrame.textContent = localPhysics?.truth?.coordinateFrameReady ? `${localPhysics.gravity.magnitudeMps2.toFixed(3)} m/s²` : '—';
  ui.persistenceRevision.textContent = `r${worldState.descriptor().revision}`;
  updateHostDiagnostic();
  ui.earthCell.textContent = localEarthSystem ? `${localEarthSystem.profileId} ${localEarthSystem.kind} / step ${localEarthSystem.stepCount}` : '--';
  const activeProfileColumnCount = earthSystem.columnsForProfile(state.profileId).length;
  ui.transportDomain.textContent = lastEarthTransportReceipt
    ? `${lastEarthTransportReceipt.columnCount} cells / ${lastEarthTransportReceipt.activeEdgeCount} edges`
    : `${activeProfileColumnCount} cells / spin-up`;
  ui.transportWater.textContent = lastEarthTransportReceipt
    ? `${(lastEarthTransportReceipt.transfers.atmosphereWaterKg / 1e9).toFixed(2)} Gkg air · ${(lastEarthTransportReceipt.transfers.groundwaterKg / 1e6).toFixed(2)} Mkg ground`
    : '--';
  ui.transportClosure.textContent = lastEarthTransportReceipt
    ? `${lastEarthTransportReceipt.conservation.atmosphereWaterResidualKg.toExponential(1)} kg / ${lastEarthTransportReceipt.conservation.atmosphereHeatResidualJ.toExponential(1)} J`
    : '--';
  const hasMomentumReceipt = Number.isFinite(lastEarthTransportReceipt?.transfers?.atmosphereDryAirKg) &&
    Number.isFinite(lastEarthTransportReceipt?.conservation?.atmosphereEastwardMomentumResidualKgMps) &&
    Number.isFinite(lastEarthTransportReceipt?.conservation?.atmosphereNorthwardMomentumResidualKgMps);
  ui.airMassRoute.textContent = hasMomentumReceipt
    ? `${(lastEarthTransportReceipt.transfers.atmosphereDryAirKg / 1e9).toFixed(2)} Gkg · ${lastEarthTransportReceipt.atmosphereMassReceipts?.length || 0} edges`
    : lastEarthTransportReceipt ? 'awaiting v2 step' : '--';
  ui.momentumClosure.textContent = hasMomentumReceipt
    ? `${lastEarthTransportReceipt.conservation.atmosphereEastwardMomentumResidualKgMps.toExponential(1)} E / ${lastEarthTransportReceipt.conservation.atmosphereNorthwardMomentumResidualKgMps.toExponential(1)} N`
    : lastEarthTransportReceipt ? 'awaiting v2 step' : '--';
  const localRotationReceipt = lastEarthTransportReceipt?.atmosphereCoriolisReceipts?.find(
    receipt => receipt.cellId === localEarthSystem?.id
  );
  ui.rotationDeflection.textContent = localRotationReceipt
    ? `${(localRotationReceipt.rotationRadians * 180 / Math.PI).toFixed(1)}°/step · ${lastEarthTransportReceipt.transfers.coriolisWorkJ.toExponential(1)} J work`
    : lastEarthTransportReceipt ? 'awaiting rotation step' : '--';
  ui.kineticClosure.textContent = Number.isFinite(lastEarthTransportReceipt?.conservation?.atmosphereKineticEnergyResidualJ)
    ? `${(lastEarthTransportReceipt.transfers.momentumMixingDissipationJ / 1e9).toFixed(2)} GJ mixed · ${lastEarthTransportReceipt.conservation.atmosphereKineticEnergyResidualJ.toExponential(1)} J residual`
    : lastEarthTransportReceipt ? 'awaiting energy step' : '--';
  const localPhaseChange = localEarthSystem?.atmosphere?.lastPhaseChangeReceipt;
  const localFreePhaseChange = localEarthSystem?.atmosphere?.lastFreeTropospherePhaseReceipt;
  const localVerticalExchange = localEarthSystem?.atmosphere?.lastVerticalExchangeReceipt;
  ui.cloudPhaseChange.textContent = localPhaseChange
    ? `${localPhaseChange.condensationMm.toFixed(2)} mm cond · ${localPhaseChange.cloudEvaporationMm.toFixed(2)} mm evap · ${localPhaseChange.precipitationMm.toFixed(2)} mm precip`
    : localEarthSystem ? 'awaiting phase step' : '--';
  ui.verticalAtmosphere.textContent = localEarthSystem?.atmosphere?.freeTroposphere
    ? `${localEarthSystem.atmosphere.boundaryLayerPressureHpa.toFixed(1)} hPa BL + ${localEarthSystem.atmosphere.freeTroposphere.pressureThicknessHpa.toFixed(1)} hPa FT · ${(localVerticalExchange?.finalLapseRateKPerKm ?? ((localEarthSystem.atmosphere.airTemperatureC - localEarthSystem.atmosphere.freeTroposphere.airTemperatureC) / (localEarthSystem.atmosphere.freeTroposphere.referenceAltitudeM / 1000))).toFixed(2)} K/km`
    : localEarthSystem ? 'awaiting two-layer migration' : '--';
  ui.convectiveExchange.textContent = localVerticalExchange
    ? `${(localVerticalExchange.exchangeFraction * 100).toFixed(2)}% · ${localVerticalExchange.vaporUpwardMm.toFixed(3)} mm vapor / ${localVerticalExchange.cloudWaterUpwardMm.toFixed(3)} mm cloud up · ${localVerticalExchange.moistEnthalpyResidualJm2.toExponential(1)} J/m²`
    : localEarthSystem ? 'awaiting vertical step' : '--';
  ui.moistEnthalpyClosure.textContent = localPhaseChange && Number.isFinite(localEarthSystem?.budget?.atmosphereEnergy?.residualJm2)
    ? `${((localPhaseChange.latentHeatingJm2 + Number(localFreePhaseChange?.latentHeatingJm2 || 0)) / 1e6).toFixed(2)} MJ/m² latent · ${localEarthSystem.budget.atmosphereEnergy.residualJm2.toExponential(1)} J/m² residual`
    : localEarthSystem ? 'awaiting moist-energy step' : '--';
  ui.atmosphereWater.textContent = localEarthSystem
    ? `${localEarthSystem.atmosphere.precipitableWaterMm.toFixed(2)}+${localEarthSystem.atmosphere.cloudWaterMm.toFixed(2)} mm BL · ${(localEarthSystem.atmosphere.freeTroposphere?.precipitableWaterMm || 0).toFixed(2)}+${(localEarthSystem.atmosphere.freeTroposphere?.cloudWaterMm || 0).toFixed(2)} mm FT · boundary ${localEarthSystem.budget.water.atmosphericBoundaryMoistureMm.toFixed(2)} mm`
    : '--';
  ui.runoffQueue.textContent = localEarthSystem
    ? `${localEarthSystem.routing.runoffQueueMm.toFixed(3)} mm queued · ${lastEarthTransportReceipt ? (lastEarthTransportReceipt.transfers.runoffRoutedKg / 1e6).toFixed(2) : '0.00'} Mkg moved`
    : '--';
  const basinStatus = basinRouting.descriptor(state.profileId);
  ui.channelStorage.textContent = `${(basinStatus.activeProfileStoredWaterKg / 1e9).toFixed(3)} Gkg / ${basinStatus.activeProfileReachStates} reaches`;
  ui.channelClosure.textContent = lastBasinRoutingReceipt
    ? `${lastBasinRoutingReceipt.conservation.waterResidualKg.toExponential(1)} kg`
    : '--';
  const mouthDeliveredKg = Number(lastBasinRoutingReceipt?.transfers?.riverToOceanKg || 0);
  const retainedRiverBoundaries = lastBasinRoutingReceipt?.boundaryReceipts?.length || 0;
  ui.riverMouth.textContent = mouthDeliveredKg > 0
    ? `${(mouthDeliveredKg / 1e6).toFixed(2)} Mkg to ocean`
    : retainedRiverBoundaries > 0
      ? `${retainedRiverBoundaries} retained handoff${retainedRiverBoundaries === 1 ? '' : 's'}`
      : 'no active mouth transfer';
  const localBasinInlet = lastBasinRoutingReceipt?.inletReceipts?.find(receipt => receipt.sender.earthCellId === localEarthSystem?.id);
  const localRunoffReceipt = lastEarthTransportReceipt?.runoffReceipts?.find(receipt => receipt.sourceCellId === localEarthSystem?.id);
  ui.runoffDestination.textContent = !localEarthSystem ? '--' : localBasinInlet
    ? `river ${localBasinInlet.receiver.reachId.replace('hydro-reach:v2:', '')}`
    : !localRunoffReceipt
    ? 'no queued outflow'
    : localRunoffReceipt.status === 'routed'
      ? `${localRunoffReceipt.destinationKind} neighbor`
      : `retained · ${localRunoffReceipt.reason}`;
  ui.soilWater.textContent = !localEarthSystem ? '--' : localEarthSystem.kind === 'land'
    ? `${Math.round(localEarthSystem.land.rootZoneSaturation * 100)}% root zone`
    : `${localEarthSystem.ocean.mixedLayerDepthM.toFixed(0)} m mixed layer`;
  ui.groundwaterDepth.textContent = !localEarthSystem ? '--' : !layers.enabled('groundwater') ? 'OFF' : localEarthSystem.land
    ? `${localEarthSystem.land.waterTableDepthM.toFixed(1)} m below`
    : `${localEarthSystem.ocean.salinityPsu.toFixed(2)} psu`;
  ui.runoffFlux.textContent = !localEarthSystem ? '--' : localEarthSystem.kind === 'land'
    ? `${(localEarthSystem.fluxes.surfaceRunoffMmDay + localEarthSystem.fluxes.baseflowMmDay).toFixed(2)} mm/day`
    : `${localEarthSystem.fluxes.freshwaterBalanceMmDay.toFixed(2)} mm/day`;
  ui.waterBudget.textContent = localEarthSystem
    ? `${localEarthSystem.budget.water.residualMm.toExponential(1)} mm`
    : '--';
  ui.energyBudget.textContent = localEarthSystem
    ? `${localEarthSystem.budget.energy.netSurfaceFluxWm2.toFixed(1)} W/m2 / residual ${localEarthSystem.budget.energy.residualJm2.toExponential(1)} J/m2`
    : '--';
  ui.seaIce.textContent = !localEarthSystem ? '--' : !layers.enabled('cryosphere') ? 'OFF' : localEarthSystem.kind === 'ocean'
    ? `${Math.round(localEarthSystem.cryosphere.seaIceFraction * 100)}% / ${localEarthSystem.cryosphere.seaIceThicknessM.toFixed(2)} m`
    : `${Math.round(localEarthSystem.cryosphere.snowWaterEquivalentMm)} mm SWE`;
  const regional = surface.sector?.community?.regional?.summary;
  const dynamics = surface.sector?.community?.dynamics;
  const livingEnabled = layers.livingEnabled() && currentProfile.lifeAbundance > 0;
  ui.regionalAnimals.textContent = layers.enabled('fauna') ? Number(dynamics?.animalPopulationEstimate ?? regional?.animalPopulationEstimate ?? 0).toLocaleString() : 'OFF';
  ui.activeRealms.textContent = livingEnabled ? (regional?.activeRealms || []).map(realm => realm.replace('deep-marine', 'deep sea')).join(' / ') || '--' : 'DORMANT';
  ui.aquaticSpecies.textContent = livingEnabled ? Number(regional?.aquaticSpecies || 0).toLocaleString() : 'OFF';
  ui.keystoneSpecies.textContent = livingEnabled ? Number(regional?.keystoneSpecies?.length || 0).toLocaleString() : 'OFF';
  ui.foodWebBalance.textContent = livingEnabled ? (regional?.balance || '—') : 'DORMANT';
  ui.populationChange.textContent = livingEnabled ? `${Number(dynamics?.births || 0).toLocaleString()} / ${Number(dynamics?.deaths || 0).toLocaleString()}` : 'DORMANT';
  const cohorts = dynamics?.ageCohorts || {};
  ui.ageCohorts.textContent = layers.enabled('fauna') ? `${Number(cohorts.juvenile || 0).toLocaleString()} / ${Number(cohorts.adult || 0).toLocaleString()} / ${Number(cohorts.senescent || 0).toLocaleString()}` : 'OFF';
  ui.migrationNet.textContent = livingEnabled ? Number(dynamics?.migrationNet || 0).toLocaleString() : 'DORMANT';
  ui.activeFire.textContent = livingEnabled ? (dynamics?.activeFire ? 'YES' : 'NO') : 'DORMANT';
  ui.activeFire.style.color = livingEnabled && dynamics?.activeFire ? '#f28a5f' : '';
  ui.fps.textContent = currentFps ? `${currentFps} fps` : '—';
  const observed = surface.sector?.community?.observedSpecies || [];
  const livingActive = livingEnabled;
  ui.speciesCount.textContent = `${observed.length} ${livingActive ? 'species' : 'latent species'}`;
  ui.speciesList.innerHTML = observed.slice(0, 12).map(id => `<span>${speciesById(id)?.commonName || id}</span>`).join('');
}

function updateModePresentation() {
  ui.modeLabel.textContent = state.mode === 'orbit' ? 'Orbital survey' : surface.marine ? 'Marine expedition' : 'Surface expedition';
  ui.modeHelp.textContent = state.mode === 'orbit'
    ? 'Drag to rotate · wheel to change altitude · double-click land to deploy'
    : surface.marine
      ? 'Marine survey · click water for mouse look · W A S D to swim · Shift to traverse faster'
      : 'Click world for mouse look · W A S D to move · Shift to traverse faster · Esc releases cursor';
}

function setMode(mode, options = {}) {
  if (mode !== 'orbit' && mode !== 'surface') return;
  if (mode === 'surface') {
    let sample = sampleLatLon(state.location.lat, state.location.lon, { profile: currentProfile, seed: PLANET_DEFAULTS.seed });
    if (!sample.land && options.allowMarine !== true) {
      const viable = findViableLand();
      state.location = { lat: viable.lat, lon: viable.lon };
      sample = viable.sample;
    }
    buildSurfaceSector(state.location.lat, state.location.lon);
    updateSurveyReadout(state.location.lat, state.location.lon, sample);
  }
  state.mode = mode;
  document.body.dataset.mode = mode;
  document.querySelectorAll('.mode-button').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  orbitRoot.visible = mode === 'orbit';
  surfaceRoot.visible = mode === 'surface';
  scene.fog = mode === 'surface' && layers.enabled('atmosphere')
    ? new THREE.FogExp2(surface.marine ? '#245c6e' : currentProfile.id === 'arid' ? '#8a735b' : '#9bb7b2', surface.marine ? .075 : .022)
    : null;
  updateModePresentation();
  ui.randomLand.textContent = mode === 'orbit' ? 'Find viable land' : 'Relocate expedition';
  ui.scaleLabel.textContent = mode === 'orbit' ? (orbit.distance > 300 ? '4,000 km' : orbit.distance > 190 ? '2,000 km' : '800 km') : '10 km';
  if (!options.skipSave) saveNow('view-mode-change', { mode });
}

function findViableLand() {
  for (let attempt = 0; attempt < 900; attempt++) {
    const index = state.surveyCounter++;
    const vector = fibonacciVector((index * 97) % 4093, 4093);
    const where = vectorToLatLon(vector);
    const sample = sampleVector(vector, { profile: currentProfile, seed: PLANET_DEFAULTS.seed });
    if (sample.land && sample.elevationM < 2300 && sample.habitability > (currentProfile.lifeAbundance ? .32 : 0)) return { ...where, sample };
  }
  return { lat: 0, lon: 0, sample: sampleLatLon(0, 0, { profile: currentProfile }) };
}

function findMarineSector() {
  let best = null;
  for (let attempt = 0; attempt < 1200; attempt++) {
    const index = state.surveyCounter++;
    const vector = fibonacciVector((index * 131 + 17) % 8191, 8191);
    const where = vectorToLatLon(vector);
    const sample = sampleVector(vector, { profile: currentProfile, seed: PLANET_DEFAULTS.seed });
    if (sample.land) continue;
    const depthM = sample.ecology?.waterDepthM || Math.max(0, -sample.elevationM);
    const productivity = sample.ecology?.productivity || 0;
    const score = productivity * 1.8 + clamp(1 - Math.abs(depthM - 850) / 2200, 0, 1) * .7 + (sample.biome === 'ocean' ? .25 : 0);
    if (!best || score > best.score) best = { ...where, sample, score };
    if (sample.biome === 'ocean' && productivity > .42 && depthM > 180 && depthM < 1800) return { ...where, sample };
  }
  return best || { lat: 0, lon: -160, sample: sampleLatLon(0, -160, { profile: currentProfile, seed: PLANET_DEFAULTS.seed }) };
}

function relocate() {
  const viable = findViableLand();
  state.location = { lat: viable.lat, lon: viable.lon };
  updateSurveyReadout(viable.lat, viable.lon, viable.sample);
  if (state.mode === 'surface') { buildSurfaceSector(viable.lat, viable.lon); updateModePresentation(); }
  saveNow('relocate-expedition', { mode: state.mode });
}

function surveyOcean() {
  const marine = findMarineSector();
  state.location = { lat: marine.lat, lon: marine.lon };
  updateSurveyReadout(marine.lat, marine.lon, marine.sample);
  setMode('surface', { allowMarine: true });
  surface.pitch = -.04;
  saveNow('survey-ocean', { biome: marine.sample.biome });
}

function followFreshwater() {
  if (state.mode !== 'surface') setMode('surface');
  if (!localHydrology?.rivers.length) {
    relocate();
    if (!localHydrology?.rivers.length) return;
  }
  const nearest = localHydrology.rivers
    .flatMap(river => [
      { point: river.from, other: river.to, distance: Math.hypot(river.from.xKm - surface.playerX, river.from.zKm - surface.playerZ) },
      { point: river.to, other: river.from, distance: Math.hypot(river.to.xKm - surface.playerX, river.to.zKm - surface.playerZ) }
    ])
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) return;
  state.location = { lat: nearest.point.lat, lon: nearest.point.lon };
  buildSurfaceSector(nearest.point.lat, nearest.point.lon);
  const centeredRiver = localHydrology.rivers
    .map(river => ({ river, distance: Math.min(Math.hypot(river.from.xKm, river.from.zKm), Math.hypot(river.to.xKm, river.to.zKm)) }))
    .sort((a, b) => a.distance - b.distance)[0]?.river;
  if (centeredRiver) {
    const fromDistance = Math.hypot(centeredRiver.from.xKm, centeredRiver.from.zKm);
    const start = fromDistance < Math.hypot(centeredRiver.to.xKm, centeredRiver.to.zKm) ? centeredRiver.from : centeredRiver.to;
    const end = start === centeredRiver.from ? centeredRiver.to : centeredRiver.from;
    const dx = end.xKm - start.xKm, dz = end.zKm - start.zKm, length = Math.hypot(dx, dz) || 1;
    const dirX = dx / length, dirZ = dz / length;
    surface.playerX = -dirZ * .026;
    surface.playerZ = dirX * .026;
    const lookX = dirX * .32 - surface.playerX, lookZ = dirZ * .32 - surface.playerZ;
    surface.yaw = Math.atan2(lookX, -lookZ);
    surface.pitch = -.2;
  }
  updateSurveyReadout(nearest.point.lat, nearest.point.lon, sampleLatLon(nearest.point.lat, nearest.point.lon, { profile: currentProfile, seed: PLANET_DEFAULTS.seed }));
  updateModePresentation();
  saveNow('follow-water', { reachId: centeredRiver?.id || null });
}

function resetView() {
  if (state.mode === 'orbit') Object.assign(orbit, { yaw: -.62, pitch: .26, distance: 258 });
  else Object.assign(surface, { yaw: 0, pitch: -.08, playerX: 0, playerZ: 0, velocityX: 0, velocityZ: 0 });
}

function setProfile(profileId) {
  if (!CONDITION_PROFILES[profileId] || profileId === state.profileId) return;
  conditionTransitioning = true;
  state.profileId = profileId;
  currentProfile = CONDITION_PROFILES[profileId];
  living.setProfile(profileId);
  earthSystem.setProfile(profileId);
  ui.loading.classList.remove('done');
  updateLoading('Reforming climate and biomes', 24);
  setTimeout(() => {
    buildOrbitalPlanet();
    updateLoading('Restreaming local living sector', 72);
    const sample = sampleLatLon(state.location.lat, state.location.lon, { profile: currentProfile, seed: PLANET_DEFAULTS.seed });
    if (state.mode === 'surface') buildSurfaceSector(state.location.lat, state.location.lon);
    updateSurveyReadout(state.location.lat, state.location.lon, sample);
    lastWeatherQuarter = -1;
    lastWeatherCoordinateKey = '';
    conditionTransitioning = false;
    refreshEnvironment(true);
    updateDiagnostics();
    updateLayerVisibility();
    updateLoading('Planet conditions online', 100);
    setTimeout(() => ui.loading.classList.add('done'), 260);
    saveNow('condition-profile-change', { profileId });
  }, 30);
}

function raycastOrbit(event) {
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([orbitalTerrain, orbitalWater].filter(Boolean), false);
  if (!hits.length) return null;
  const local = orbitRoot.worldToLocal(hits[0].point.clone()).normalize();
  const where = vectorToLatLon(local);
  return { ...where, sample: sampleVector(local, { profile: currentProfile, seed: PLANET_DEFAULTS.seed }) };
}

function updateOrbitCamera() {
  const cosPitch = Math.cos(orbit.pitch);
  camera.position.set(
    Math.sin(orbit.yaw) * cosPitch * orbit.distance,
    Math.sin(orbit.pitch) * orbit.distance,
    Math.cos(orbit.yaw) * cosPitch * orbit.distance
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.near = .1; camera.far = 1200; camera.fov = 52; camera.updateProjectionMatrix();
}

function updateSurface(dt, now) {
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const speedKmS = surface.marine ? (sprint ? .032 : .009) : (sprint ? .045 : .008);
  let forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let strafe = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const length = Math.hypot(forward, strafe) || 1; forward /= length; strafe /= length;
  const inputX = Math.sin(surface.yaw) * forward + Math.cos(surface.yaw) * strafe;
  const inputZ = -Math.cos(surface.yaw) * forward + Math.sin(surface.yaw) * strafe;
  const response = 1 - Math.exp(-(forward || strafe ? 9 : 5.5) * dt);
  surface.velocityX += (inputX * speedKmS - surface.velocityX) * response;
  surface.velocityZ += (inputZ * speedKmS - surface.velocityZ) * response;
  surface.playerX += surface.velocityX * dt;
  surface.playerZ += surface.velocityZ * dt;
  const local = sampleLocal(surface.playerX, surface.playerZ);
  const centerElevationM = sampleLatLon(surface.center.lat, surface.center.lon, { profile: currentProfile, seed: PLANET_DEFAULTS.seed }).elevationM;
  surface.groundY = surface.marine
    ? localTerrainY(0, surface.playerX, surface.playerZ, centerElevationM) - .035
    : localTerrainY(local.sample.elevationM, surface.playerX, surface.playerZ, centerElevationM);
  const eye = .0018;
  camera.position.set(surface.playerX, surface.groundY + eye, surface.playerZ);
  camera.up.set(0, 1, 0);
  const direction = new THREE.Vector3(
    Math.sin(surface.yaw) * Math.cos(surface.pitch), Math.sin(surface.pitch), -Math.cos(surface.yaw) * Math.cos(surface.pitch)
  );
  camera.lookAt(camera.position.clone().add(direction));
  camera.near = .00018; camera.far = 210; camera.fov = 68; camera.updateProjectionMatrix();
  state.location = local.where;
  if ((fpsFrames % 12) === 0) updateSurveyReadout(local.where.lat, local.where.lon, local.sample);
  const heading = (surface.yaw * 180 / Math.PI + 360) % 360;
  ui.heading.textContent = `${String(Math.round(heading)).padStart(3, '0')}°`;

  faunaObjects.forEach(group => {
    const fauna = group.userData;
    const species = speciesById(fauna.species);
    const active = activityFactor(species, (state.day % 1) * 24);
    group.visible = layers.enabled('fauna') && currentProfile.lifeAbundance > 0 && active > .14;
    const angle = fauna.phase + now * .001 * fauna.speed * (.25 + active * .9);
    const radius = fauna.radiusKm;
    const x = surface.playerX + Math.cos(angle) * radius, z = surface.playerZ + Math.sin(angle) * radius;
    if ((fpsFrames + fauna.index) % 18 === 0 || !Number.isFinite(fauna.terrainY)) {
      const local = sampleLocal(x, z);
      fauna.terrainY = localTerrainY(local.sample.elevationM, x, z, centerElevationM);
    }
    const mobileAltitudeKm = fauna.locomotion === 'fly' || fauna.locomotion === 'swim' ? fauna.altitudeM / 1000 : .0015;
    const y = surface.marine && fauna.locomotion === 'swim'
      ? localTerrainY(0, x, z, centerElevationM) - (.012 + (fauna.index % 7) * .01)
      : fauna.terrainY + mobileAltitudeKm;
    group.position.set(x, y, z);
    group.rotation.y = -angle;
  });
  if (surfaceWeather) {
    surfaceWeather.position.set(surface.playerX, surface.groundY + .08, surface.playerZ);
    surfaceWeather.rotation.y += dt * .025;
    const positions = surfaceWeather.geometry.attributes.position;
    const fallSpeed = seasonalWeather?.precipitation.type === 'snow' ? .018 : seasonalWeather?.precipitation.type === 'sleet' ? .045 : .095;
    const windX = Math.sin((seasonalWeather?.windDirectionDeg || 0) * Math.PI / 180) * (seasonalWeather?.windSpeedMps || 0) * .00008;
    const windZ = Math.cos((seasonalWeather?.windDirectionDeg || 0) * Math.PI / 180) * (seasonalWeather?.windSpeedMps || 0) * .00008;
    for (let i = 0; i < positions.array.length; i += 3) {
      positions.array[i] += windX * dt; positions.array[i + 2] += windZ * dt;
      positions.array[i + 1] -= dt * fallSpeed;
      if (positions.array[i + 1] < -.05) positions.array[i + 1] = .65;
      if (positions.array[i] > 1) positions.array[i] = -1; else if (positions.array[i] < -1) positions.array[i] = 1;
      if (positions.array[i + 2] > 1) positions.array[i + 2] = -1; else if (positions.array[i + 2] < -1) positions.array[i + 2] = 1;
    }
    positions.needsUpdate = true;
  }
  if (surfaceFire?.visible) {
    surfaceFire.material.size = .007 + (Math.sin(now * .018) + 1) * .0025;
    surfaceFire.material.opacity = .65 + (Math.sin(now * .027) + 1) * .16;
  }
  if (surfaceSky) surfaceSky.position.copy(camera.position);
  if (Math.hypot(surface.playerX, surface.playerZ) > SURFACE_SIZE_KM * .28) buildSurfaceSector(local.where.lat, local.where.lon);
}

function updateTime(dt) {
  const elapsedDays = dt * state.timeScale / PLANET_DEFAULTS.dayLengthSeconds;
  state.day += elapsedDays;
  if (layers.livingEnabled()) living.advance(elapsedDays);
  if (state.day >= PLANET_DEFAULTS.yearLengthDays) { state.day -= PLANET_DEFAULTS.yearLengthDays; state.year++; }
  refreshEnvironment(false);
  const ecosystemElapsed = living.ageDays - lastEcosystemAge;
  if (surface.sector && seasonalWeather && ecosystemElapsed >= .25) {
    const result = living.updateSector(surface.sector, seasonalWeather, ecosystemElapsed);
    lastEcosystemAge = living.ageDays;
    if (result) { updateDiagnostics(); applyEnvironmentVisuals(); }
  }
  const phase = state.day % 1;
  const angle = (phase - .25) * Math.PI * 2;
  const daylight = clamp((Math.sin(angle) + .18) / .78, 0, 1);
  const atmosphereOn = layers.enabled('atmosphere');
  const storm = seasonalWeather?.stormRisk || 0;
  sun.position.set(Math.cos(angle) * 230, Math.sin(angle) * 170, 120);
  sun.target.position.set(0, 0, 0);
  sun.intensity = (atmosphereOn ? 2.2 : 2.7) * (.08 + daylight * .92);
  ambient.intensity = atmosphereOn ? (state.mode === 'surface' ? .28 + daylight * .6 : .36 + daylight * .18) : .14;
  if (surfaceTerrain) surfaceTerrain.material.emissiveIntensity = .07 + daylight * .1;
  const waterDaylight = .42 + daylight * .58;
  if (surfaceWater) surfaceWater.material.color.set(currentProfile.id === 'glacial' ? '#8bb8c7' : '#247f9c').multiplyScalar(waterDaylight);
  if (surfaceRivers) surfaceRivers.material.color.setScalar(waterDaylight);
  if (surfaceVegetation) surfaceVegetation.material.emissiveIntensity = .08 + daylight * .34;
  if (surfaceCanopies) surfaceCanopies.material.emissiveIntensity = .08 + daylight * .34;
  if (surfaceSky) {
    const topDay = new THREE.Color(currentProfile.id === 'arid' ? '#947050' : '#236b9d').lerp(new THREE.Color('#52636a'), storm * .72);
    const bottomDay = new THREE.Color(currentProfile.id === 'arid' ? '#e1bd87' : '#b8d9d7').lerp(new THREE.Color('#768286'), storm * .68);
    surfaceSky.material.uniforms.topColor.value.set('#07101b').lerp(topDay, daylight);
    surfaceSky.material.uniforms.bottomColor.value.set('#17131c').lerp(bottomDay, daylight);
  }
  const hours = phase * 24;
  const hh = String(Math.floor(hours)).padStart(2, '0');
  const mm = String(Math.floor((hours % 1) * 60)).padStart(2, '0');
  ui.clock.textContent = `${hh}:${mm}`;
  ui.season.textContent = `DAY ${Math.floor(state.day) + 1} · YEAR ${state.year}`;
}

function frame(now) {
  const dt = Math.min(.05, (now - lastFrame) / 1000 || 0); lastFrame = now;
  fpsFrames++;
  if (now - fpsSince > 1000) {
    currentFps = Math.round(fpsFrames * 1000 / (now - fpsSince)); fpsFrames = 0; fpsSince = now;
    updateDiagnostics();
  }
  updateTime(dt);
  if (state.mode === 'orbit') {
    updateOrbitCamera();
    if (orbitalClouds) orbitalClouds.rotation.y += dt * .006;
  } else updateSurface(dt, now);
  renderer.render(scene, camera);
  if (now - lastSaveAt > 15000) { saveNow('automatic-checkpoint'); lastSaveAt = now; }
  requestAnimationFrame(frame);
}

function bindUI() {
  Object.values(CONDITION_PROFILES).forEach(profile => {
    const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.name;
    ui.profileSelect.appendChild(option);
  });
  ui.profileSelect.value = state.profileId;
  ui.profileSelect.addEventListener('change', event => setProfile(event.target.value));
  document.querySelectorAll('.mode-button').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  ui.lifeMaster.addEventListener('click', () => layers.setLiving(!layers.livingEnabled()));
  ui.randomLand.addEventListener('click', relocate);
  ui.freshwater.addEventListener('click', followFreshwater);
  ui.marineSurvey.addEventListener('click', surveyOcean);
  ui.resetView.addEventListener('click', resetView);
  layers.addEventListener('change', event => {
    updateLayerVisibility(); updateDiagnostics();
    saveNow('layer-state-change', { id: event.detail?.id, enabled: event.detail?.enabled, reason: event.detail?.reason });
  });

  canvas.addEventListener('pointerdown', event => {
    if (state.mode === 'orbit') {
      orbit.dragging = true; orbit.lastX = event.clientX; orbit.lastY = event.clientY; canvas.setPointerCapture?.(event.pointerId);
    } else canvas.requestPointerLock?.();
  });
  canvas.addEventListener('pointermove', event => {
    if (state.mode !== 'orbit' || !orbit.dragging) return;
    orbit.yaw -= (event.clientX - orbit.lastX) * .005;
    orbit.pitch = clamp(orbit.pitch + (event.clientY - orbit.lastY) * .004, -1.43, 1.43);
    orbit.lastX = event.clientX; orbit.lastY = event.clientY;
  });
  const endDrag = () => { orbit.dragging = false; };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', event => {
    if (state.mode !== 'orbit') return;
    event.preventDefault();
    orbit.distance = clamp(orbit.distance * Math.exp(event.deltaY * .00075), 118, 520);
    ui.scaleLabel.textContent = orbit.distance > 300 ? '4,000 km' : orbit.distance > 190 ? '2,000 km' : '800 km';
  }, { passive: false });
  canvas.addEventListener('dblclick', event => {
    if (state.mode !== 'orbit') return;
    const hit = raycastOrbit(event);
    if (!hit) return;
    updateSurveyReadout(hit.lat, hit.lon, hit.sample);
    setMode('surface');
  });
  canvas.addEventListener('pointermove', event => {
    if (state.mode !== 'orbit' || orbit.dragging || fpsFrames % 4) return;
    const hit = raycastOrbit(event);
    if (hit) updateSurveyReadout(hit.lat, hit.lon, hit.sample);
  });
  document.addEventListener('mousemove', event => {
    if (state.mode !== 'surface' || document.pointerLockElement !== canvas) return;
    surface.yaw -= event.movementX * .0022;
    surface.pitch = clamp(surface.pitch - event.movementY * .0018, -1.35, 1.2);
  });
  addEventListener('keydown', event => { keys[event.code] = true; });
  addEventListener('keyup', event => { keys[event.code] = false; });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  });
  addEventListener('pagehide', () => saveNow('pagehide-checkpoint'));
}

function installWorldAPI() {
  window.AXMFoundationPlanet = Object.freeze({
    describe: () => JSON.parse(JSON.stringify({
      ...WORLD_CONTRACT,
      model: modelDescription(), geophysics: geophysicsDescription(), hydrology: hydrologyDescription(),
      earthSystem: earthSystemDescription(), earthTransport: earthTransportDescription(),
      basinRouting: basinRoutingDescription(),
      physics: physicsDescription(), persistence: worldStateDescription(),
      host: hostDescription(), authorityKernel: authorityDescription(),
      speciesCatalog: catalogDescription(), layerCatalog: LAYER_DEFINITIONS
    })),
    snapshot: () => JSON.parse(JSON.stringify({
      schema: 'axm.foundation-planet.snapshot/v2', world_id: WORLD_CONTRACT.world_id,
      revision: worldState.descriptor().revision, mode: state.mode, profileId: state.profileId,
      location: { ...state.location }, localSample: surface.currentSample ? { ...surface.currentSample } : null,
      layers: layers.snapshot(), living: living.snapshot(), hydrology: localHydrology ? localHydrology.summary : null,
      earthSystem: localEarthSystem ? JSON.parse(JSON.stringify(localEarthSystem)) : null,
      earthTransport: lastEarthTransportReceipt ? JSON.parse(JSON.stringify(lastEarthTransportReceipt)) : null,
      basinRouting: lastBasinRoutingReceipt ? JSON.parse(JSON.stringify(lastBasinRoutingReceipt)) : null,
      physics: localPhysics || null,
      regionalCommunity: surface.sector?.community?.regional?.summary || null,
      ecosystemDynamics: surface.sector?.community?.dynamics || null,
      seasonalWeather: seasonalWeather ? { ...seasonalWeather } : null,
      persistence: worldState.descriptor(), host: sharedHostStatus
    })),
    exportSelected: () => ({
      schema: 'axm.foundation-planet.selected-snapshot/v1', world_id: WORLD_CONTRACT.world_id,
      captured_at: new Date().toISOString(), selected: {
        location: { ...state.location }, profileId: state.profileId, mode: state.mode,
        biome: surface.currentSample?.biome || null, elevationM: surface.currentSample?.elevationM || null,
        layers: layers.snapshot().layers, geology: surface.currentSample?.geology || null,
        weather: seasonalWeather ? { season: seasonalWeather.season, summary: seasonalWeather.summary, seasonalTemperatureC: seasonalWeather.seasonalTemperatureC, snowpackMm: seasonalWeather.snowpackMm, droughtIndex: seasonalWeather.droughtIndex, fireRisk: seasonalWeather.fireRisk } : null,
        earthSystem: localEarthSystem ? {
          cellId: localEarthSystem.id,
          kind: localEarthSystem.kind,
          surface: localEarthSystem.surface,
          atmosphere: localEarthSystem.atmosphere,
          cryosphere: localEarthSystem.cryosphere,
          land: localEarthSystem.land,
          ocean: localEarthSystem.ocean,
          routing: localEarthSystem.routing,
          fluxes: localEarthSystem.fluxes,
          budget: localEarthSystem.budget
        } : null,
        earthTransport: lastEarthTransportReceipt ? {
          schema: lastEarthTransportReceipt.schema,
          digest: lastEarthTransportReceipt.digest,
          columnCount: lastEarthTransportReceipt.columnCount,
          activeEdgeCount: lastEarthTransportReceipt.activeEdgeCount,
          boundaryReceiptCount: lastEarthTransportReceipt.boundaryReceipts.length,
          transfers: lastEarthTransportReceipt.transfers,
          conservation: lastEarthTransportReceipt.conservation
        } : null,
        basinRouting: lastBasinRoutingReceipt ? {
          schema: lastBasinRoutingReceipt.schema,
          digest: lastBasinRoutingReceipt.digest,
          loadedReachCount: lastBasinRoutingReceipt.loadedReachCount,
          inletReceipts: lastBasinRoutingReceipt.inletReceipts,
          routeReceipts: lastBasinRoutingReceipt.routeReceipts,
          boundaryReceipts: lastBasinRoutingReceipt.boundaryReceipts,
          transfers: lastBasinRoutingReceipt.transfers,
          storage: lastBasinRoutingReceipt.storage,
          conservation: lastBasinRoutingReceipt.conservation
        } : null,
        loadedSector: surface.sector ? {
          key: surface.sector.key, vegetation: surface.sector.vegetation.length, faunaGroups: surface.sector.fauna.length,
          riverSegments: localHydrology?.summary.riverSegments || 0, lakes: localHydrology?.summary.lakeCount || 0,
          riverBoundaryHandoffs: localHydrology?.summary.boundaryHandoffs || 0,
          hydrologyTiles: localHydrology?.tiles || [], physicsFrame: localPhysics?.frame || null,
          observedSpecies: surface.sector.community?.observedSpecies || []
        } : null
      },
      persistence: worldState.descriptor(),
       limitations: ['Procedural exploration model', 'Browser-local state remains active until explicitly attached to the named-world host', 'Loaded dry-air, Coriolis and tangent-energy ledgers plus bounded two-layer vertical exchange are not a global circulation, angular-momentum, resolved 3D convection, cloud-microphysics, buoyancy-work, upper-air-horizontal-transport, or scientific forecast model', 'River routing advances only through loaded canonical reaches and retains unresolved handoffs', 'No global depression-filled basin graph yet', 'No general rigid-body engine yet']
    }),
    persistence: () => JSON.parse(JSON.stringify(worldState.descriptor())),
    physicsSector: () => JSON.parse(JSON.stringify(localPhysics)),
    earthSystemColumn: () => JSON.parse(JSON.stringify(localEarthSystem)),
    earthTransport: () => JSON.parse(JSON.stringify(lastEarthTransportReceipt)),
    basinRouting: () => JSON.parse(JSON.stringify(lastBasinRoutingReceipt)),
    host: () => JSON.parse(JSON.stringify(sharedHostStatus)),
    proposeHostBootstrap: () => createHostBootstrap(currentHostSource()),
    proposeHostPatch: (expectedRevision = sharedHostStatus.revision ?? 0, options = {}) => createHostPatch(currentHostSource(), expectedRevision, options),
    createSectorSubscription: (options = {}) => createSectorSubscription({
      subscriberId: options.subscriberId || 'local-explorer',
      lineageId: worldState.descriptor().lineageId,
      center: options.center || { lat: state.location.lat, lon: state.location.lon, elevationM: surface.currentSample?.elevationM || 0 },
      radiusKm: options.radiusKm || SURFACE_SIZE_KM,
      sinceRevision: options.sinceRevision ?? (sharedHostStatus.revision || 0),
      maximumEntities: options.maximumEntities || 1024,
      entityKinds: options.entityKinds
    }),
    refreshHostStatus: () => refreshSharedHost().then(status => JSON.parse(JSON.stringify(status)))
  });
  document.body.dataset.api = 'AXMFoundationPlanet/v11';
}

async function start() {
  bindUI();
  renderLayerControls();
  updateLoading('Continents and ocean basins', 18);
  await new Promise(resolve => requestAnimationFrame(resolve));
  buildStars();
  buildOrbitalPlanet();
  updateLoading('Climate, biomes and habitat', 55);
  await new Promise(resolve => requestAnimationFrame(resolve));
  const current = sampleLatLon(state.location.lat, state.location.lon, { profile: currentProfile, seed: PLANET_DEFAULTS.seed });
  updateSurveyReadout(state.location.lat, state.location.lon, current);
  buildSurfaceSector(state.location.lat, state.location.lon);
  refreshEnvironment(true);
  updateLoading('Living-sector stream and controls', 86);
  setMode(state.mode, { skipSave: true, allowMarine: true });
  updateLayerVisibility();
  updateDiagnostics();
  installWorldAPI();
  if (!savedEnvelope) saveNow('world-lineage-created', { version: '0.15.0' });
  await refreshSharedHost();
  updateLoading('Foundation planet online', 100);
  state.ready = true;
  document.body.dataset.ready = 'true';
  setTimeout(() => ui.loading.classList.add('done'), 320);
  requestAnimationFrame(frame);
}

start().catch(error => {
  console.error(error);
  ui.loadingStatus.textContent = `Planet startup failed: ${error.message}`;
  ui.loadingBar.style.background = '#e36f6f';
});
