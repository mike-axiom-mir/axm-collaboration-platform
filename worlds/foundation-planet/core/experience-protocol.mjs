import { PLANET_DEFAULTS } from './planet-model.mjs';
import { checksum } from './world-state.mjs';

export const EXPERIENCE_SOURCE_SCHEMA =
  'axm.foundation-planet.experience-source/v1';
export const EXPERIENCE_SECTOR_CAPSULE_SCHEMA =
  'axm.foundation-planet.experience-sector-capsule/v1';
export const EXPERIENCE_LEASE_SCHEMA =
  'axm.foundation-planet.experience-lease/v1';
export const EXPERIENCE_INTENT_SCHEMA =
  'axm.foundation-planet.experience-intent/v1';
export const EXPERIENCE_OBSERVATION_SCHEMA =
  'axm.foundation-planet.experience-observation/v1';
export const EXPERIENCE_INTENT_RECEIPT_SCHEMA =
  'axm.foundation-planet.experience-intent-receipt/v1';
export const WORLD_ACTION_PROPOSAL_SCHEMA =
  'axm.foundation-planet.world-action-proposal/v1';
export const DETACHED_SANDBOX_FORK_SCHEMA =
  'axm.foundation-planet.detached-sandbox-fork/v1';
export const EXPERIENCE_PROTOCOL_AUDIT_SCHEMA =
  'axm.foundation-planet.experience-protocol-audit/v1';

export const EXPERIENCE_MODES = Object.freeze(['observer', 'player', 'sandbox']);
export const EXPERIENCE_INTENT_KINDS = Object.freeze([
  'OBSERVE', 'WORLD_ACTION_PROPOSE', 'SANDBOX_FORK'
]);

const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeLongitude = longitude => ((Number(longitude) + 540) % 360) - 180;

function cleanText(value, fallback = '', maximum = 160) {
  const text = String(value ?? fallback).trim().slice(0, maximum);
  return text || String(fallback).slice(0, maximum);
}

function cleanId(value, fallback = 'local') {
  const cleaned = cleanText(value, fallback, 120).toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function finite(value, fallback = 0, minimum = -Number.MAX_VALUE,
  maximum = Number.MAX_VALUE) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, minimum, maximum) : fallback;
}

function stableValue(value, depth = 0) {
  if (depth > 8) throw new RangeError('experience payload exceeds maximum depth');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('experience payload numbers must be finite');
    return value;
  }
  if (typeof value === 'string') return value.slice(0, 2048);
  if (Array.isArray(value)) {
    if (value.length > 256) throw new RangeError('experience payload array exceeds 256 entries');
    return value.map(item => stableValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter(key => value[key] !== undefined).sort();
    if (keys.length > 256) throw new RangeError('experience payload object exceeds 256 fields');
    return keys.reduce((result, key) => {
      result[key.slice(0, 120)] = stableValue(value[key], depth + 1);
      return result;
    }, {});
  }
  throw new TypeError('experience payload must be JSON-compatible');
}

function digestRecord(record, field) {
  const clean = clone(record);
  delete clean[field];
  return checksum(clean);
}

function canonicalCoordinate(input = {}) {
  const latitudeDeg = Number(input.latitudeDeg ?? input.lat);
  const longitudeDeg = Number(input.longitudeDeg ?? input.lon);
  if (!Number.isFinite(latitudeDeg) || !Number.isFinite(longitudeDeg) ||
    latitudeDeg < -90 || latitudeDeg > 90) {
    throw new TypeError('experience source requires a finite canonical coordinate');
  }
  return {
    schema: 'axm.foundation-planet.coordinate/v1',
    worldId: PLANET_DEFAULTS.id,
    latitudeDeg,
    longitudeDeg: normalizeLongitude(longitudeDeg),
    elevationM: finite(input.elevationM, 0, -12_000, 100_000),
    reference: 'planet-mean-sea-level'
  };
}

function normalizeActor(actor = {}) {
  const kind = ['human', 'machine', 'service'].includes(actor.kind)
    ? actor.kind : 'machine';
  return {
    id: cleanId(actor.id, 'observer'),
    kind,
    name: cleanText(actor.name, actor.id || 'Observer', 120)
  };
}

function normalizeLayers(input = {}) {
  const layers = input.layers && typeof input.layers === 'object'
    ? input.layers : input;
  return Object.keys(layers || {}).sort().reduce((result, key) => {
    if (typeof layers[key] === 'boolean') result[key] = layers[key];
    return result;
  }, {});
}

function normalizeSample(sample = {}) {
  return {
    biome: cleanId(sample.biome, 'unknown'),
    elevationM: finite(sample.elevationM, 0, -12_000, 100_000),
    temperatureC: finite(sample.temperatureC, 0, -150, 100),
    moisture: finite(sample.moisture, 0, 0, 1),
    habitability: finite(sample.habitability, 0, 0, 1),
    annualRainMm: finite(sample.annualRainMm, 0, 0, 30_000),
    soilDepthM: finite(sample.soilDepthM, 0, 0, 100),
    geology: stableValue(sample.geology || {})
  };
}

function normalizePhysics(physics = {}) {
  const frame = physics.frame || {};
  return {
    schema: physics.schema || null,
    frame: frame.schema ? stableValue(frame) : null,
    floatingOrigin: physics.floatingOrigin === true,
    gravity: physics.gravity ? stableValue(physics.gravity) : null,
    bounds: physics.bounds ? stableValue(physics.bounds) : null,
    colliders: physics.colliders ? stableValue(physics.colliders) : null,
    truth: {
      coordinateFrameReady: physics.truth?.coordinateFrameReady === true,
      generalRigidBodyEngine: physics.truth?.generalRigidBodyEngine === true,
      wholePlanetRigidBodyScene: physics.truth?.wholePlanetRigidBodyScene === true
    }
  };
}

function normalizeHydrology(hydrology = {}) {
  const rivers = (hydrology.rivers || []).slice(0, 512).map(reach => ({
    id: cleanText(reach.id, 'reach', 160),
    downstreamId: reach.downstreamId ? cleanText(reach.downstreamId, '', 160) : null,
    from: reach.canonicalFrom ? stableValue(reach.canonicalFrom) : null,
    to: reach.canonicalTo ? stableValue(reach.canonicalTo) : null,
    streamOrder: Math.max(0, Math.floor(finite(reach.streamOrder, 0, 0, 32))),
    currentDischargeM3s: finite(reach.currentDischargeM3s ?? reach.dischargeM3s,
      0, 0, 1e9),
    widthM: finite(reach.widthM, 0, 0, 1e6),
    depthM: finite(reach.depthM, 0, 0, 1e5),
    channelStorageKg: finite(reach.channelStorageKg, 0, 0, 1e30),
    floodplain: reach.floodplain ? stableValue({
      waterKg: reach.floodplain.waterKg,
      chemistry: reach.floodplain.chemistry,
      suspendedSedimentKg: reach.floodplain.suspendedSedimentKg,
      depositedSedimentKg: reach.floodplain.depositedSedimentKg,
      totalSedimentKg: reach.floodplain.totalSedimentKg,
      inundatedFraction: reach.floodplain.inundatedFraction
    }) : null,
    floodplainHabitat: reach.floodplainHabitat ? stableValue({
      observedDays: reach.floodplainHabitat.observedDays,
      inundatedExposureDays:
        reach.floodplainHabitat.inundatedExposureDays,
      wetDays: reach.floodplainHabitat.wetDays,
      dryDays: reach.floodplainHabitat.dryDays,
      currentWetSpellDays: reach.floodplainHabitat.currentWetSpellDays,
      currentDrySpellDays: reach.floodplainHabitat.currentDrySpellDays,
      floodPulseCount: reach.floodplainHabitat.floodPulseCount,
      rollingHydroperiod30d:
        reach.floodplainHabitat.rollingHydroperiod30d,
      cumulativeNewDepositKg:
        reach.floodplainHabitat.cumulativeNewDepositKg,
      fertilityIndex: reach.floodplainHabitat.fertilityIndex,
      anaerobicStress: reach.floodplainHabitat.anaerobicStress,
      habitatClass: reach.floodplainHabitat.habitatClass,
      fractions: reach.floodplainHabitat.fractions,
      truth: reach.floodplainHabitat.truth
    }) : null,
    floodEvents: reach.floodEvents ? stableValue({
      observedDays: reach.floodEvents.observedDays,
      awaitingDryBoundary: reach.floodEvents.awaitingDryBoundary,
      active: reach.floodEvents.active,
      currentEvent: reach.floodEvents.currentEvent,
      recentEvents: (reach.floodEvents.recentEvents || []).slice(-8),
      archivedEventCount: reach.floodEvents.archivedEventCount,
      completedEventCount: reach.floodEvents.completedEventCount,
      evictedEventCount: reach.floodEvents.evictedEventCount,
      meanCompletedDurationDays:
        reach.floodEvents.meanCompletedDurationDays,
      meanRecurrenceIntervalDays:
        reach.floodEvents.meanRecurrenceIntervalDays,
      historicalPeakWaterKg:
        reach.floodEvents.historicalPeakWaterKg,
      historicalPeakInundatedFraction:
        reach.floodEvents.historicalPeakInundatedFraction,
      archiveLimit: reach.floodEvents.archiveLimit,
      truth: reach.floodEvents.truth
    }) : null,
    floodplainSuccession: reach.floodplainSuccession ? stableValue({
      observedLivingDays:
        reach.floodplainSuccession.observedLivingDays,
      dormantDays: reach.floodplainSuccession.dormantDays,
      juvenileCoverFraction:
        reach.floodplainSuccession.juvenileCoverFraction,
      matureCoverFraction:
        reach.floodplainSuccession.matureCoverFraction,
      totalCoverFraction: reach.floodplainSuccession.totalCoverFraction,
      bareFraction: reach.floodplainSuccession.bareFraction,
      totalSeedBankSeedsM2:
        reach.floodplainSuccession.totalSeedBankSeedsM2,
      dominantGuild: reach.floodplainSuccession.dominantGuild,
      successionIndex: reach.floodplainSuccession.successionIndex,
      diversityIndex: reach.floodplainSuccession.diversityIndex,
      guilds: reach.floodplainSuccession.guilds,
      maximumTotalCoverFraction:
        reach.floodplainSuccession.maximumTotalCoverFraction,
      truth: reach.floodplainSuccession.truth
    }) : null,
    floodplainPlantMatter: reach.floodplainPlantMatter ? stableValue({
      observedMaterialDays:
        reach.floodplainPlantMatter.observedMaterialDays,
      dormantDays: reach.floodplainPlantMatter.dormantDays,
      live: reach.floodplainPlantMatter.live,
      standingDead: reach.floodplainPlantMatter.standingDead,
      litter: reach.floodplainPlantMatter.litter,
      total: reach.floodplainPlantMatter.total,
      legacyUnmaterializedCoverFraction:
        reach.floodplainPlantMatter.legacyUnmaterializedCoverFraction,
      dominantGuild: reach.floodplainPlantMatter.dominantGuild,
      guilds: reach.floodplainPlantMatter.guilds,
      truth: reach.floodplainPlantMatter.truth
    }) : null,
    floodplainPlantResources: reach.floodplainPlantResources
      ? stableValue({
        observedResourceDays:
          reach.floodplainPlantResources.observedResourceDays,
        dormantDays: reach.floodplainPlantResources.dormantDays,
        live: reach.floodplainPlantResources.live,
        standingDead: reach.floodplainPlantResources.standingDead,
        litter: reach.floodplainPlantResources.litter,
        total: reach.floodplainPlantResources.total,
        migrationLegacyUnsupportedCarbonKgC:
          reach.floodplainPlantResources
            .migrationLegacyUnsupportedCarbonKgC,
        cumulativeMortalityWaterReturnKg:
          reach.floodplainPlantResources
            .cumulativeMortalityWaterReturnKg,
        dominantGuild: reach.floodplainPlantResources.dominantGuild,
        guilds: reach.floodplainPlantResources.guilds,
        truth: reach.floodplainPlantResources.truth
      }) : null,
    floodplainDecomposition: reach.floodplainDecomposition
      ? stableValue({
        observedDecompositionDays:
          reach.floodplainDecomposition.observedDecompositionDays,
        dormantDays: reach.floodplainDecomposition.dormantDays,
        cumulativeFloodplainReturn:
          reach.floodplainDecomposition.cumulativeFloodplainReturn,
        lastActivity: reach.floodplainDecomposition.lastActivity,
        truth: reach.floodplainDecomposition.truth
      }) : null,
    floodplainRespiration: reach.floodplainRespiration
      ? stableValue({
        observedRespirationDays:
          reach.floodplainRespiration.observedRespirationDays,
        dormantDays: reach.floodplainRespiration.dormantDays,
        oxygenLimitedDays:
          reach.floodplainRespiration.oxygenLimitedDays,
        cumulativeMineralization:
          reach.floodplainRespiration.cumulativeMineralization,
        lastActivity: reach.floodplainRespiration.lastActivity,
        truth: reach.floodplainRespiration.truth
      }) : null,
    floodplainGasExchange: reach.floodplainGasExchange
      ? stableValue({
        observedExchangeDays:
          reach.floodplainGasExchange.observedExchangeDays,
        inactiveDays: reach.floodplainGasExchange.inactiveDays,
        atmosphereUnavailableDays:
          reach.floodplainGasExchange.atmosphereUnavailableDays,
        cumulativeExchange:
          reach.floodplainGasExchange.cumulativeExchange,
        lastActivity: reach.floodplainGasExchange.lastActivity,
        truth: reach.floodplainGasExchange.truth
      }) : null
  })).sort((a, b) => a.id.localeCompare(b.id));
  const lakes = (hydrology.lakes || []).slice(0, 128).map(lake => ({
    id: cleanText(lake.id, 'lake', 160),
    center: lake.center ? stableValue(lake.center) : null,
    elevationM: finite(lake.elevationM, 0, -12_000, 100_000),
    areaKm2: finite(lake.areaKm2, 0, 0, 1e9)
  })).sort((a, b) => a.id.localeCompare(b.id));
  const handoffs = (hydrology.handoffs || []).slice(0, 256)
    .map(handoff => stableValue(handoff))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    summary: stableValue(hydrology.summary || {}),
    rivers,
    lakes,
    boundaryHandoffs: handoffs,
    truth: stableValue(hydrology.truth || {})
  };
}

function normalizeEarthSystem(column = {}) {
  const land = column.land ? {
    waterTableDepthM: column.land.waterTableDepthM,
    rootZoneWaterMm: column.land.rootZoneWaterMm,
    deepSoilWaterMm: column.land.deepSoilWaterMm,
    groundwaterMm: column.land.groundwaterMm,
    soilBiogeochemistry: column.land.soilBiogeochemistry || null,
    surfaceSediment: column.land.surfaceSediment || null,
    ecology: column.land.ecology || null
  } : null;
  const ocean = column.ocean ? {
    mixedLayerDepthM: column.ocean.mixedLayerDepthM,
    mixedLayerTemperatureC: column.ocean.mixedLayerTemperatureC,
    salinityPsu: column.ocean.salinityPsu,
    coastalSediment: column.ocean.coastalSediment || null,
    ecology: column.ocean.ecology || null
  } : null;
  return stableValue({
    schema: column.schema || null,
    id: column.id || null,
    profileId: column.profileId || null,
    kind: column.kind || null,
    stepCount: Math.max(0, Math.floor(finite(column.stepCount, 0, 0, 1e12))),
    day: finite(column.day, 0, -1e12, 1e12),
    surface: column.surface || null,
    atmosphere: column.atmosphere ? {
      surfacePressureHpa: column.atmosphere.surfacePressureHpa,
      carbonDioxidePpm: column.atmosphere.carbonDioxidePpm,
      oxygenMoleFraction: column.atmosphere.oxygenMoleFraction,
      eastwardWindMps: column.atmosphere.eastwardWindMps,
      northwardWindMps: column.atmosphere.northwardWindMps
    } : null,
    cryosphere: column.cryosphere || null,
    land,
    ocean,
    routing: column.routing || null,
    fluxes: column.fluxes || null
  });
}

function normalizeEcology(source = {}) {
  const community = source.community || {};
  const observedSpecies = Array.from(new Set(
    (source.observedSpecies || community.observedSpecies || [])
      .map(species => cleanId(typeof species === 'string' ? species : species.id, 'species'))
  )).sort().slice(0, 512);
  return stableValue({
    observedSpecies,
    regionalCommunity: source.regionalCommunity || community.regional || null,
    ecosystemDynamics: source.ecosystemDynamics || community.dynamics || null
  });
}

function normalizeAuthority(source = {}) {
  const host = source.host || {};
  return {
    sourceOwner: host.attached === true
      ? 'living-world-state-server' : 'foundation-planet-browser-state',
    sourceAuthoritative: host.authoritative === true,
    hostAttached: host.attached === true,
    hostRevision: Number.isSafeInteger(host.revision) ? host.revision : null,
    hostDigest: typeof host.digest === 'string' ? host.digest : null,
    capsuleAuthoritative: false,
    capsuleCanApplyWorldActions: false
  };
}

export function createExperienceSectorCapsule(source, options = {}) {
  if (!source || source.schema !== EXPERIENCE_SOURCE_SCHEMA) {
    throw new TypeError(`experience source must use ${EXPERIENCE_SOURCE_SCHEMA}`);
  }
  if (source.worldId !== PLANET_DEFAULTS.id) {
    throw new TypeError('experience source world identity does not match Caelus');
  }
  if (!source.lineageId || !Number.isSafeInteger(source.revision) || source.revision < 0) {
    throw new TypeError('experience source requires lineage and non-negative revision');
  }
  const anchor = canonicalCoordinate(source.location);
  const environment = stableValue({
    profileId: cleanId(source.profileId, 'temperate'),
    clock: {
      day: finite(source.clock?.day, 1, -1e12, 1e12),
      year: Math.max(1, Math.floor(finite(source.clock?.year, 1, 1, 1e9))),
      dayLengthSeconds: PLANET_DEFAULTS.dayLengthSeconds,
      yearLengthDays: PLANET_DEFAULTS.yearLengthDays
    },
    sample: normalizeSample(source.sample),
    weather: source.weather ? stableValue(source.weather) : null
  });
  const layers = normalizeLayers(source.layers);
  const hydrology = normalizeHydrology(source.hydrology);
  const earthSystem = normalizeEarthSystem(source.earthSystem);
  const ecology = normalizeEcology(source);
  const physics = normalizePhysics(source.physics);
  const components = { environment, layers, hydrology, earthSystem, ecology, physics };
  const componentDigests = Object.keys(components).sort().reduce((result, key) => {
    result[key] = checksum(components[key]);
    return result;
  }, {});
  const base = {
    schema: EXPERIENCE_SECTOR_CAPSULE_SCHEMA,
    version: '1.0.0',
    id: cleanId(options.id,
      `capsule-${source.revision}-${anchor.latitudeDeg.toFixed(4)}-${anchor.longitudeDeg.toFixed(4)}`),
    worldId: PLANET_DEFAULTS.id,
    title: cleanText(options.title, 'Caelus sector experience capsule', 180),
    source: {
      schema: EXPERIENCE_SOURCE_SCHEMA,
      lineageId: String(source.lineageId).slice(0, 240),
      revision: source.revision,
      stateChecksum: typeof source.stateChecksum === 'string'
        ? source.stateChecksum : null,
      componentDigests
    },
    authority: normalizeAuthority(source),
    anchor,
    coordinateSystem: {
      canonical: 'planet-centered-latitude-longitude-elevation',
      localProjection: physics.frame?.schema || null,
      localUnits: physics.frame?.units || 'meters',
      renderCoordinatesCanonical: false,
      logicalRadiusM: PLANET_DEFAULTS.radiusM,
      sectorSizeKm: finite(source.sectorSizeKm, 120, 1, 500)
    },
    components,
    access: {
      modes: [...EXPERIENCE_MODES],
      defaultMode: 'observer',
      automaticMirrorConnection: false,
      automaticHolodeckConnection: false,
      automaticExperimentWorldIntake: false,
      writebackRequiresGovernedAdapter: true
    },
    truth: {
      rendererIndependent: true,
      rendererObjectsIncluded: false,
      readOnlyProjection: true,
      canonicalWorldState: false,
      worldMutationAuthority: false,
      detachedSandboxCanWriteBack: false,
      detachedSandboxCanPromoteItself: false,
      observerCanProposeWorldActions: false,
      playerCanProposeWorldActions: true,
      playerCanApplyWorldActions: false,
      floodplainPlantMatterProjected: true,
      floodplainPlantResourcesProjected: true,
      floodplainDecompositionProjected: true,
      floodplainRespirationProjected: true,
      floodplainGasExchangeProjected: true,
      mirrorConnected: false,
      holodeckConnected: false
    },
    boundaries: [
      'capsule-is-a-digest-bound-read-only-projection',
      'renderer-coordinates-are-disposable',
      'observer-has-no-world-action-authority',
      'player-actions-are-proposals-only',
      'sandbox-is-a-detached-candidate-without-writeback',
      'mirror-holodeck-and-experiment-world-integration-remains-unattached',
      'canonical-promotion-requires-human-governed-review'
    ]
  };
  return { ...base, capsuleDigest: checksum(base) };
}

export function validateExperienceSectorCapsule(capsule) {
  const errors = [];
  if (!capsule || capsule.schema !== EXPERIENCE_SECTOR_CAPSULE_SCHEMA) errors.push('schema');
  if (capsule?.worldId !== PLANET_DEFAULTS.id) errors.push('world-id');
  if (!capsule?.source?.lineageId) errors.push('lineage');
  if (!Number.isSafeInteger(capsule?.source?.revision) || capsule.source.revision < 0) errors.push('revision');
  if (capsule?.authority?.capsuleAuthoritative !== false ||
    capsule?.authority?.capsuleCanApplyWorldActions !== false) errors.push('authority');
  if (capsule?.truth?.rendererIndependent !== true ||
    capsule?.truth?.rendererObjectsIncluded !== false ||
    capsule?.truth?.floodplainPlantMatterProjected !== true ||
    capsule?.truth?.floodplainPlantResourcesProjected !== true ||
    capsule?.truth?.floodplainDecompositionProjected !== true ||
    capsule?.truth?.floodplainRespirationProjected !== true ||
    capsule?.truth?.floodplainGasExchangeProjected !== true) {
    errors.push('renderer-boundary');
  }
  if (capsule?.truth?.worldMutationAuthority !== false ||
    capsule?.truth?.detachedSandboxCanWriteBack !== false ||
    capsule?.truth?.playerCanApplyWorldActions !== false) errors.push('writeback-boundary');
  for (const key of ['environment', 'layers', 'hydrology', 'earthSystem', 'ecology', 'physics']) {
    if (!capsule?.components || capsule.components[key] === undefined) {
      errors.push(`component:${key}`);
    } else if (capsule.source?.componentDigests?.[key] !==
      checksum(capsule.components[key])) {
      errors.push(`component-digest:${key}`);
    }
  }
  if (!capsule?.capsuleDigest || digestRecord(capsule, 'capsuleDigest') !==
    capsule.capsuleDigest) errors.push('capsule-digest');
  return { valid: errors.length === 0, errors };
}

function leaseCapabilities(mode) {
  if (mode === 'player') return [
    'observe-structured-sector', 'propose-governed-world-action'
  ];
  if (mode === 'sandbox') return [
    'observe-structured-sector', 'fork-detached-candidate',
    'mutate-detached-candidate'
  ];
  return ['observe-structured-sector'];
}

export function openExperienceLease(capsule, options = {}) {
  const validation = validateExperienceSectorCapsule(capsule);
  if (!validation.valid) throw new Error(
    `experience capsule refused: ${validation.errors.join(', ')}`);
  const mode = EXPERIENCE_MODES.includes(options.mode) ? options.mode : 'observer';
  const actor = normalizeActor(options.actor);
  const maximumIntents = Math.floor(finite(options.maximumIntents, 128, 1, 10_000));
  const base = {
    schema: EXPERIENCE_LEASE_SCHEMA,
    id: cleanId(options.id,
      `lease-${mode}-${actor.id}-${capsule.capsuleDigest.slice(-8)}`),
    capsuleDigest: capsule.capsuleDigest,
    worldId: capsule.worldId,
    lineageId: capsule.source.lineageId,
    sourceRevision: capsule.source.revision,
    actor,
    mode,
    capabilities: leaseCapabilities(mode),
    sequence: { next: 0, used: 0, maximum: maximumIntents },
    truth: {
      canonicalWorldMutation: false,
      applyAuthority: false,
      observerReadOnly: mode === 'observer',
      playerProposalOnly: mode === 'player',
      sandboxDetached: mode === 'sandbox',
      sandboxWriteback: false,
      automaticPromotion: false
    }
  };
  return { ...base, leaseDigest: checksum(base) };
}

export function validateExperienceLease(lease, capsule = null) {
  const errors = [];
  if (!lease || lease.schema !== EXPERIENCE_LEASE_SCHEMA) errors.push('schema');
  if (!EXPERIENCE_MODES.includes(lease?.mode)) errors.push('mode');
  if (!lease?.actor?.id || !['human', 'machine', 'service'].includes(
    lease?.actor?.kind)) errors.push('actor');
  if (!Number.isSafeInteger(lease?.sequence?.next) ||
    !Number.isSafeInteger(lease?.sequence?.used) ||
    !Number.isSafeInteger(lease?.sequence?.maximum) ||
    lease?.sequence?.next !== lease?.sequence?.used ||
    lease?.sequence?.used < 0 ||
    lease?.sequence?.used > lease?.sequence?.maximum) errors.push('sequence');
  if (lease?.truth?.canonicalWorldMutation !== false ||
    lease?.truth?.applyAuthority !== false ||
    lease?.truth?.sandboxWriteback !== false ||
    lease?.truth?.automaticPromotion !== false) errors.push('authority');
  if (!lease?.leaseDigest || digestRecord(lease, 'leaseDigest') !==
    lease.leaseDigest) errors.push('lease-digest');
  if (capsule && (lease?.capsuleDigest !== capsule.capsuleDigest ||
    lease?.worldId !== capsule.worldId ||
    lease?.lineageId !== capsule.source.lineageId ||
    lease?.sourceRevision !== capsule.source.revision)) errors.push('capsule-lineage');
  return { valid: errors.length === 0, errors };
}

function nextLease(lease) {
  const base = clone(lease);
  delete base.leaseDigest;
  base.sequence.next += 1;
  base.sequence.used += 1;
  return { ...base, leaseDigest: checksum(base) };
}

function createObservation(capsule, lease) {
  const base = {
    schema: EXPERIENCE_OBSERVATION_SCHEMA,
    capsuleDigest: capsule.capsuleDigest,
    leaseId: lease.id,
    observer: clone(lease.actor),
    mode: lease.mode,
    anchor: clone(capsule.anchor),
    environment: clone(capsule.components.environment),
    hydrology: {
      summary: clone(capsule.components.hydrology.summary),
      riverCount: capsule.components.hydrology.rivers.length,
      lakeCount: capsule.components.hydrology.lakes.length,
      boundaryHandoffCount: capsule.components.hydrology.boundaryHandoffs.length
    },
    ecology: {
      observedSpecies: clone(capsule.components.ecology.observedSpecies),
      regionalCommunity: clone(capsule.components.ecology.regionalCommunity)
    },
    truth: {
      structuredStateObservation: true,
      cameraVision: false,
      visualOcclusionResolved: false,
      worldMutationAuthority: false
    }
  };
  return { ...base, observationDigest: checksum(base) };
}

function createWorldActionProposal(capsule, lease, intent) {
  const payload = stableValue(intent.payload || {});
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 32_768) {
    throw new RangeError('world-action proposal payload exceeds 32768 bytes');
  }
  const base = {
    schema: WORLD_ACTION_PROPOSAL_SCHEMA,
    id: cleanId(intent.id, `proposal-${lease.id}-${intent.sequence}`),
    worldId: capsule.worldId,
    lineageId: capsule.source.lineageId,
    expectedRevision: capsule.source.revision,
    sourceCapsuleDigest: capsule.capsuleDigest,
    leaseId: lease.id,
    actor: clone(lease.actor),
    sequence: intent.sequence,
    action: {
      kind: cleanId(intent.action?.kind, 'interact'),
      targetId: intent.action?.targetId
        ? cleanText(intent.action.targetId, '', 180) : null,
      coordinate: intent.action?.coordinate
        ? canonicalCoordinate(intent.action.coordinate) : clone(capsule.anchor),
      payload
    },
    authority: {
      applyAuthority: false,
      directWorldMutation: false,
      resetAuthority: false,
      humanGovernedReviewRequired: true,
      compatibleHostPatchGenerated: false
    },
    truth: {
      proposalOnly: true,
      sourceCapsuleMutated: false,
      canonicalWorldMutated: false,
      automaticPromotion: false
    }
  };
  return { ...base, proposalDigest: checksum(base) };
}

function normalizeSandboxBudgets(input = {}) {
  return {
    maximumArtifacts: Math.floor(finite(input.maximumArtifacts,
      256, 1, 10_000)),
    maximumEvents: Math.floor(finite(input.maximumEvents,
      1024, 1, 100_000)),
    maximumSerializedBytes: Math.floor(finite(input.maximumSerializedBytes,
      16_777_216, 1_048_576, 536_870_912))
  };
}

function createDetachedSandboxFork(capsule, lease, intent) {
  const base = {
    schema: DETACHED_SANDBOX_FORK_SCHEMA,
    id: cleanId(intent.id, `sandbox-${lease.id}-${intent.sequence}`),
    branch: `candidate/${cleanId(intent.payload?.branch,
      `caelus-sector-${capsule.capsuleDigest.slice(-8)}`)}`,
    sourceCapsuleDigest: capsule.capsuleDigest,
    leaseId: lease.id,
    actor: clone(lease.actor),
    capsule: clone(capsule),
    budgets: normalizeSandboxBudgets(intent.payload?.budgets),
    truth: {
      detachedCandidate: true,
      creativeMutationInsideCandidateAllowed: true,
      canonicalWorldMutation: false,
      canonicalWriteback: false,
      automaticPromotion: false,
      mirrorConnected: false
    }
  };
  return { ...base, forkDigest: checksum(base) };
}

function receiptFor(capsule, lease, intent, status, code, detail = {}) {
  const base = {
    schema: EXPERIENCE_INTENT_RECEIPT_SCHEMA,
    intentId: cleanText(intent?.id, 'unknown-intent', 180),
    capsuleDigest: capsule.capsuleDigest,
    leaseId: lease.id,
    actor: clone(lease.actor),
    mode: lease.mode,
    sequence: Number.isSafeInteger(intent?.sequence) ? intent.sequence : null,
    kind: cleanText(intent?.kind, 'UNKNOWN', 80),
    status,
    code,
    proposalDigest: detail.proposal?.proposalDigest || null,
    forkDigest: detail.sandboxFork?.forkDigest || null,
    observationDigest: detail.observation?.observationDigest || null,
    truth: {
      canonicalWorldMutated: false,
      sourceCapsuleMutated: false,
      applyAuthorityUsed: false
    }
  };
  return { ...base, receiptDigest: checksum(base) };
}

function refused(capsule, lease, intent, code) {
  return {
    lease: clone(lease),
    receipt: receiptFor(capsule, lease, intent, 'REFUSED', code),
    observation: null,
    proposal: null,
    sandboxFork: null
  };
}

export function dispatchExperienceIntent(capsule, lease, intent) {
  const capsuleValidation = validateExperienceSectorCapsule(capsule);
  if (!capsuleValidation.valid) throw new Error(
    `experience capsule refused: ${capsuleValidation.errors.join(', ')}`);
  const leaseValidation = validateExperienceLease(lease, capsule);
  if (!leaseValidation.valid) throw new Error(
    `experience lease refused: ${leaseValidation.errors.join(', ')}`);
  if (!intent || intent.schema !== EXPERIENCE_INTENT_SCHEMA) {
    return refused(capsule, lease, intent, 'UNSUPPORTED_INTENT_SCHEMA');
  }
  if (!Number.isSafeInteger(intent.sequence) ||
    intent.sequence !== lease.sequence.next) {
    return refused(capsule, lease, intent, 'STALE_OR_REPLAYED_SEQUENCE');
  }
  const actor = normalizeActor(intent.actor);
  if (actor.id !== lease.actor.id || actor.kind !== lease.actor.kind) {
    return refused(capsule, lease, intent, 'ACTOR_LEASE_MISMATCH');
  }
  if (!EXPERIENCE_INTENT_KINDS.includes(intent.kind)) {
    return refused(capsule, lease, intent, 'UNSUPPORTED_INTENT_KIND');
  }
  if (lease.sequence.used >= lease.sequence.maximum) {
    return refused(capsule, lease, intent, 'LEASE_RESOURCE_BUDGET_EXHAUSTED');
  }
  const advancedLease = nextLease(lease);
  let observation = null, proposal = null, sandboxFork = null;
  let status = 'ACCEPTED', code = 'OBSERVATION_CREATED';
  if (intent.kind === 'OBSERVE') {
    observation = createObservation(capsule, advancedLease);
  } else if (intent.kind === 'WORLD_ACTION_PROPOSE') {
    if (lease.mode !== 'player') {
      return {
        lease: advancedLease,
        receipt: receiptFor(capsule, lease, intent, 'REFUSED',
          'MODE_HAS_NO_WORLD_ACTION_PROPOSAL_AUTHORITY'),
        observation: null, proposal: null, sandboxFork: null
      };
    }
    try {
      proposal = createWorldActionProposal(capsule, lease, intent);
    } catch (_) {
      return {
        lease: advancedLease,
        receipt: receiptFor(capsule, lease, intent, 'REFUSED',
          'PROPOSAL_PAYLOAD_INVALID_OR_OVER_BUDGET'),
        observation: null, proposal: null, sandboxFork: null
      };
    }
    code = 'WORLD_ACTION_PROPOSAL_CREATED_NOT_APPLIED';
  } else if (intent.kind === 'SANDBOX_FORK') {
    if (lease.mode !== 'sandbox') {
      return {
        lease: advancedLease,
        receipt: receiptFor(capsule, lease, intent, 'REFUSED',
          'MODE_HAS_NO_SANDBOX_FORK_AUTHORITY'),
        observation: null, proposal: null, sandboxFork: null
      };
    }
    try {
      sandboxFork = createDetachedSandboxFork(capsule, lease, intent);
    } catch (_) {
      return {
        lease: advancedLease,
        receipt: receiptFor(capsule, lease, intent, 'REFUSED',
          'SANDBOX_FORK_INVALID_OR_OVER_BUDGET'),
        observation: null, proposal: null, sandboxFork: null
      };
    }
    code = 'DETACHED_SANDBOX_FORK_CREATED_NO_WRITEBACK';
  }
  return {
    lease: advancedLease,
    receipt: receiptFor(capsule, lease, intent, status, code,
      { observation, proposal, sandboxFork }),
    observation,
    proposal,
    sandboxFork
  };
}

function validateDigestRecord(record, field, schema) {
  return Boolean(record && record.schema === schema && record[field] &&
    digestRecord(record, field) === record[field]);
}

function check(id, status, detail) { return { id, status, detail }; }

export function auditExperienceProtocol(input = {}) {
  const capsule = input.capsule;
  const leases = input.leases || [];
  const receipts = input.receipts || [];
  const proposals = input.proposals || [];
  const sandboxForks = input.sandboxForks || [];
  const capsuleValidation = validateExperienceSectorCapsule(capsule);
  const checks = [
    check('experience-capsule-integrity', capsuleValidation.valid ? 'PASS' : 'FAIL',
      capsuleValidation.valid ? capsule?.capsuleDigest : capsuleValidation.errors.join(', ')),
    check('experience-authority-membrane', capsule?.truth?.readOnlyProjection === true &&
      capsule?.truth?.worldMutationAuthority === false &&
      capsule?.truth?.playerCanApplyWorldActions === false &&
      capsule?.truth?.detachedSandboxCanWriteBack === false ? 'PASS' : 'FAIL',
    'projection, player proposal and sandbox fork cannot apply canonical changes'),
    leases.length
      ? check('experience-lease-integrity', leases.every(lease =>
        validateExperienceLease(lease, capsule).valid) ? 'PASS' : 'FAIL',
      `${leases.length} lease(s) checked`)
      : check('experience-lease-integrity', 'NOT_APPLICABLE', 'no lease supplied'),
    receipts.length
      ? check('experience-intent-receipt-integrity', receipts.every(receipt =>
        validateDigestRecord(receipt, 'receiptDigest',
          EXPERIENCE_INTENT_RECEIPT_SCHEMA) &&
        receipt.capsuleDigest === capsule?.capsuleDigest &&
        receipt.truth?.canonicalWorldMutated === false) ? 'PASS' : 'FAIL',
      `${receipts.length} receipt(s) checked`)
      : check('experience-intent-receipt-integrity', 'NOT_APPLICABLE',
        'no intent receipt supplied'),
    proposals.length
      ? check('experience-proposal-authority', proposals.every(proposal =>
        validateDigestRecord(proposal, 'proposalDigest',
          WORLD_ACTION_PROPOSAL_SCHEMA) &&
        proposal.sourceCapsuleDigest === capsule?.capsuleDigest &&
        proposal.authority?.applyAuthority === false &&
        proposal.truth?.canonicalWorldMutated === false) ? 'PASS' : 'FAIL',
      `${proposals.length} proposal(s) checked`)
      : check('experience-proposal-authority', 'NOT_APPLICABLE',
        'no world-action proposal supplied'),
    sandboxForks.length
      ? check('experience-sandbox-detachment', sandboxForks.every(fork =>
        validateDigestRecord(fork, 'forkDigest',
          DETACHED_SANDBOX_FORK_SCHEMA) &&
        fork.sourceCapsuleDigest === capsule?.capsuleDigest &&
        fork.truth?.detachedCandidate === true &&
        fork.truth?.canonicalWriteback === false &&
        fork.truth?.automaticPromotion === false) ? 'PASS' : 'FAIL',
      `${sandboxForks.length} detached fork(s) checked`)
      : check('experience-sandbox-detachment', 'NOT_APPLICABLE',
        'no sandbox fork supplied')
  ];
  const counts = {
    pass: checks.filter(item => item.status === 'PASS').length,
    fail: checks.filter(item => item.status === 'FAIL').length,
    notApplicable: checks.filter(item => item.status === 'NOT_APPLICABLE').length
  };
  const verdict = counts.fail ? 'FAIL'
    : counts.notApplicable ? 'PASS_WITH_UNOBSERVED_OPTIONAL_SEAMS' : 'PASS';
  const base = {
    schema: EXPERIENCE_PROTOCOL_AUDIT_SCHEMA,
    capsuleDigest: capsule?.capsuleDigest || null,
    verdict,
    counts,
    checks,
    truth: {
      readOnlyAudit: true,
      worldMutation: false,
      mirrorConnectionClaimed: false,
      holodeckConnectionClaimed: false,
      experimentWorldConnectionClaimed: false
    }
  };
  return { ...base, auditDigest: checksum(base) };
}

export function experienceProtocolDescription() {
  return {
    schema: 'axm.foundation-planet.experience-protocol/v1',
    sourceSchema: EXPERIENCE_SOURCE_SCHEMA,
    capsuleSchema: EXPERIENCE_SECTOR_CAPSULE_SCHEMA,
    leaseSchema: EXPERIENCE_LEASE_SCHEMA,
    intentSchema: EXPERIENCE_INTENT_SCHEMA,
    observationSchema: EXPERIENCE_OBSERVATION_SCHEMA,
    intentReceiptSchema: EXPERIENCE_INTENT_RECEIPT_SCHEMA,
    worldActionProposalSchema: WORLD_ACTION_PROPOSAL_SCHEMA,
    detachedSandboxForkSchema: DETACHED_SANDBOX_FORK_SCHEMA,
    auditSchema: EXPERIENCE_PROTOCOL_AUDIT_SCHEMA,
    modes: [...EXPERIENCE_MODES],
    sideEffects: [],
    permissions: {
      observerWorldActions: false,
      playerDirectWorldMutation: false,
      sandboxCanonicalWriteback: false,
      automaticPromotion: false
    },
    resourceBudget: {
      maximumLeaseIntents: 10_000,
      defaultLeaseIntents: 128,
      maximumProposalPayloadBytes: 32_768,
      maximumHydrologyReaches: 512,
      maximumObservedSpecies: 512,
      maximumSandboxArtifacts: 10_000,
      maximumSandboxEvents: 100_000,
      maximumSandboxSerializedBytes: 536_870_912
    },
    failureRecovery: 'refusals preserve the source capsule and return no applied world mutation',
    compatibility: {
      rendererIndependent: true,
      externalBrokerRequired: true,
      mirrorConnected: false,
      holodeckConnected: false,
      experimentWorldConnected: false
    },
    verification: [
      'canonical-digest-replay',
      'component-tamper-refusal',
      'observer-action-refusal',
      'sequence-replay-refusal',
      'proposal-purity',
      'sandbox-no-writeback',
      'read-only-integrity-audit'
    ]
  };
}
