import { PLANET_DEFAULTS, offsetLatLon, sampleLatLon } from './planet-model.mjs';

export const HYDROLOGY_SCHEMA = 'axm.foundation-planet.hydrology-sector/v2';
export const HYDROLOGY_GRID_SCHEMA = 'axm.foundation-planet.hydrology-grid/v1';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const NEIGHBORS = Object.freeze([
  [-1,-1], [0,-1], [1,-1], [-1,0], [1,0], [-1,1], [0,1], [1,1]
]);
const TILE_CACHE = new Map();
const MAX_CACHED_TILES = 20;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, size) => ((value % size) + size) % size;
const normalizeLon = lon => ((lon + 540) % 360) - 180;

function streamOrder(areaKm2) {
  if (areaKm2 > 3600) return 5;
  if (areaKm2 > 1500) return 4;
  if (areaKm2 > 560) return 3;
  if (areaKm2 > 180) return 2;
  return 1;
}

function gridDefinition(options = {}) {
  const requestedCellKm = clamp(Number(options.cellSizeKm || 2.5), 1.25, 8);
  const tileCells = Math.max(24, Math.min(64, Math.round(options.tileCells || 48)));
  const tileColumns = Math.max(32, Math.round(PLANET_DEFAULTS.circumferenceM / 1000 / requestedCellKm / tileCells));
  const widthCells = tileColumns * tileCells;
  const heightCells = Math.round(widthCells / 2 / tileCells) * tileCells;
  const cellSizeKm = PLANET_DEFAULTS.circumferenceM / 1000 / widthCells;
  return {
    schema: HYDROLOGY_GRID_SCHEMA,
    widthCells, heightCells, tileCells,
    tileColumns, tileRows: heightCells / tileCells,
    cellSizeKm,
    haloCells: Math.max(4, Math.min(16, Math.round(options.haloCells || 8)))
  };
}

function gridCellForLatLon(lat, lon, grid) {
  return {
    gx: wrap(Math.floor((normalizeLon(lon) + 180) / 360 * grid.widthCells), grid.widthCells),
    gz: clamp(Math.floor((clamp(lat, -89.999999, 89.999999) + 90) / 180 * grid.heightCells), 0, grid.heightCells - 1)
  };
}

function latLonForGridCell(gx, gz, grid) {
  return {
    lat: ((clamp(gz, 0, grid.heightCells - 1) + .5) / grid.heightCells * 180) - 90,
    lon: normalizeLon(((wrap(gx, grid.widthCells) + .5) / grid.widthCells * 360) - 180)
  };
}

function localOffsetKm(centerLat, centerLon, lat, lon) {
  const deltaLon = normalizeLon(lon - centerLon) * DEG2RAD;
  const meanLat = (lat + centerLat) * .5 * DEG2RAD;
  const radiusKm = PLANET_DEFAULTS.radiusM / 1000;
  return {
    xKm: deltaLon * radiusKm * Math.max(.02, Math.cos(meanLat)),
    zKm: (lat - centerLat) * DEG2RAD * radiusKm
  };
}

function tileKey(profileId, seed, tileX, tileZ, grid, thresholdKm2) {
  return `${HYDROLOGY_SCHEMA}:${profileId}:${seed}:${tileX}:${tileZ}:${grid.widthCells}:${grid.tileCells}:${grid.haloCells}:${thresholdKm2.toFixed(3)}`;
}

function annualRunoff(sample) {
  if (!sample.land) return 0;
  const potentialEvaporationMm = Math.max(80, sample.temperatureC * 21 + 320) * (1 - sample.moisture * .35);
  return Math.max(0, sample.annualPrecipMm - potentialEvaporationMm);
}

function rememberTile(key, tile) {
  if (TILE_CACHE.has(key)) TILE_CACHE.delete(key);
  TILE_CACHE.set(key, tile);
  while (TILE_CACHE.size > MAX_CACHED_TILES) TILE_CACHE.delete(TILE_CACHE.keys().next().value);
  return tile;
}

function buildCanonicalTile(tileX, tileZ, options) {
  const { grid, profile, profileId, seed, riverThresholdKm2 } = options;
  const normalizedTileX = wrap(tileX, grid.tileColumns);
  const normalizedTileZ = clamp(tileZ, 0, grid.tileRows - 1);
  const cacheKey = tileKey(profileId, seed, normalizedTileX, normalizedTileZ, grid, riverThresholdKm2);
  if (TILE_CACHE.has(cacheKey)) {
    const cached = TILE_CACHE.get(cacheKey);
    TILE_CACHE.delete(cacheKey); TILE_CACHE.set(cacheKey, cached);
    return cached;
  }

  const coreStartX = normalizedTileX * grid.tileCells;
  const coreStartZ = normalizedTileZ * grid.tileCells;
  const minX = coreStartX - grid.haloCells, maxX = coreStartX + grid.tileCells + grid.haloCells - 1;
  const minZ = Math.max(0, coreStartZ - grid.haloCells);
  const maxZ = Math.min(grid.heightCells - 1, coreStartZ + grid.tileCells + grid.haloCells - 1);
  const cells = new Map();

  const keyFor = (gx, gz) => `${gx}:${gz}`;
  for (let gz = minZ; gz <= maxZ; gz++) {
    for (let unwrappedX = minX; unwrappedX <= maxX; unwrappedX++) {
      const gx = wrap(unwrappedX, grid.widthCells);
      const where = latLonForGridCell(gx, gz, grid);
      const sample = sampleLatLon(where.lat, where.lon, { profile, seed });
      const eastWestScale = Math.max(.02, Math.cos(where.lat * DEG2RAD));
      const cellAreaKm2 = grid.cellSizeKm * grid.cellSizeKm * eastWestScale;
      const runoffMm = annualRunoff(sample);
      cells.set(keyFor(unwrappedX, gz), {
        gx, unwrappedX, gz, ...where,
        elevationM: sample.elevationM,
        land: sample.land,
        biome: sample.biome,
        moisture: sample.moisture,
        annualRunoffMm: runoffMm,
        cellAreaKm2,
        contributingAreaKm2: sample.land ? cellAreaKm2 : 0,
        runoffVolumeMmKm2: sample.land ? runoffMm * cellAreaKm2 : 0,
        downstream: null,
        slope: 0
      });
    }
  }

  for (const cell of cells.values()) {
    if (!cell.land) continue;
    let best = null, bestSlope = 0;
    for (const [dx, dz] of NEIGHBORS) {
      const candidate = cells.get(keyFor(cell.unwrappedX + dx, cell.gz + dz));
      if (!candidate) continue;
      const eastWestKm = grid.cellSizeKm * Math.max(.02, Math.cos((cell.lat + candidate.lat) * .5 * DEG2RAD));
      const northSouthKm = grid.cellSizeKm;
      const distanceKm = Math.hypot(dx * eastWestKm, dz * northSouthKm);
      const slope = (cell.elevationM - candidate.elevationM) / Math.max(1, distanceKm * 1000);
      if (slope > bestSlope) { bestSlope = slope; best = candidate; }
    }
    cell.downstream = best;
    cell.slope = bestSlope;
  }

  const descending = [...cells.values()].sort((a, b) => b.elevationM - a.elevationM);
  for (const cell of descending) {
    if (!cell.downstream) continue;
    cell.downstream.contributingAreaKm2 += cell.contributingAreaKm2;
    cell.downstream.runoffVolumeMmKm2 += cell.runoffVolumeMmKm2;
  }

  const reaches = [], lakes = [];
  const ownerTile = `hydro-tile:${normalizedTileX}:${normalizedTileZ}`;
  const inCore = cell => cell.unwrappedX >= coreStartX && cell.unwrappedX < coreStartX + grid.tileCells &&
    cell.gz >= coreStartZ && cell.gz < coreStartZ + grid.tileCells;
  for (const cell of cells.values()) {
    if (!inCore(cell) || !cell.land) continue;
    const effectiveRunoffMm = cell.contributingAreaKm2 > 0 ? cell.runoffVolumeMmKm2 / cell.contributingAreaKm2 : 0;
    if (cell.downstream && cell.contributingAreaKm2 >= riverThresholdKm2 && effectiveRunoffMm > 35) {
      const target = cell.downstream;
      const dischargeM3s = cell.runoffVolumeMmKm2 * 1000 / 31_557_600;
      const reachId = `hydro-reach:v2:${cell.gx}:${cell.gz}`;
      const downstreamReachId = target.land ? `hydro-reach:v2:${target.gx}:${target.gz}` : null;
      const order = streamOrder(cell.contributingAreaKm2);
      reaches.push({
        id: reachId, reachId, downstreamReachId, ownerTile,
        canonicalFrom: { gridX: cell.gx, gridZ: cell.gz, lat: cell.lat, lon: cell.lon, elevationM: cell.elevationM },
        canonicalTo: { gridX: target.gx, gridZ: target.gz, lat: target.lat, lon: target.lon, elevationM: target.elevationM },
        contributingAreaKm2: cell.contributingAreaKm2,
        annualRunoffMm: effectiveRunoffMm,
        dischargeM3s,
        dischargeProxy: dischargeM3s,
        widthM: clamp(2.4 + 5.2 * Math.pow(Math.max(.01, dischargeM3s), .43), 2.5, 320),
        depthM: clamp(.22 + .31 * Math.pow(Math.max(.01, dischargeM3s), .34), .18, 18),
        slope: cell.slope,
        order,
        reachesOcean: !target.land,
        continuation: target.land ? 'downstream-reach' : 'ocean-outlet'
      });
    }
    const isSink = !cell.downstream && cell.elevationM > 0 && cell.contributingAreaKm2 >= riverThresholdKm2 * 1.7;
    if (isSink) {
      const areaKm2 = Math.min(cell.contributingAreaKm2 * .045, 64);
      lakes.push({
        id: `hydro-lake:v2:${cell.gx}:${cell.gz}`, ownerTile,
        canonical: { gridX: cell.gx, gridZ: cell.gz, lat: cell.lat, lon: cell.lon },
        surfaceElevationM: cell.elevationM,
        catchmentAreaKm2: cell.contributingAreaKm2,
        areaKm2, radiusKm: Math.sqrt(areaKm2 / Math.PI), annualRunoffMm: effectiveRunoffMm
      });
    }
  }

  return rememberTile(cacheKey, {
    schema: 'axm.foundation-planet.hydrology-tile/v1',
    id: ownerTile,
    tileX: normalizedTileX, tileZ: normalizedTileZ,
    reaches, lakes,
    summary: {
      riverSegments: reaches.length,
      lakeCount: lakes.length,
      maxDrainageAreaKm2: reaches.reduce((max, reach) => Math.max(max, reach.contributingAreaKm2), 0)
    }
  });
}

function visibleTiles(centerLat, centerLon, sizeKm, grid) {
  const center = gridCellForLatLon(centerLat, centerLon, grid);
  const halfKm = sizeKm * .5 + grid.cellSizeKm * 2;
  const cosLat = Math.max(.12, Math.cos(centerLat * DEG2RAD));
  const spanX = Math.ceil(halfKm / (grid.cellSizeKm * cosLat));
  const spanZ = Math.ceil(halfKm / grid.cellSizeKm);
  const minTileX = Math.floor((center.gx - spanX) / grid.tileCells);
  const maxTileX = Math.floor((center.gx + spanX) / grid.tileCells);
  const minTileZ = clamp(Math.floor((center.gz - spanZ) / grid.tileCells), 0, grid.tileRows - 1);
  const maxTileZ = clamp(Math.floor((center.gz + spanZ) / grid.tileCells), 0, grid.tileRows - 1);
  const tiles = [];
  for (let tileZ = minTileZ; tileZ <= maxTileZ; tileZ++) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX++) tiles.push({ tileX, tileZ });
  }
  return tiles;
}

export function buildHydrologySector(centerLat, centerLon, options = {}) {
  const sizeKm = Number(options.sizeKm || 120);
  const profile = options.profile || 'temperate';
  const profileId = typeof profile === 'string' ? profile : profile.id;
  const seed = Number.isFinite(options.seed) ? options.seed : PLANET_DEFAULTS.seed;
  const grid = gridDefinition(options);
  const representativeCellAreaKm2 = grid.cellSizeKm * grid.cellSizeKm * Math.max(.12, Math.cos(centerLat * DEG2RAD));
  const riverThresholdKm2 = Number(options.riverThresholdKm2 || Math.max(300, representativeCellAreaKm2 * 30));
  const tileCoordinates = visibleTiles(centerLat, centerLon, sizeKm, grid);
  const tiles = tileCoordinates.map(tile => buildCanonicalTile(tile.tileX, tile.tileZ, {
    grid, profile, profileId, seed, riverThresholdKm2
  }));
  const reachById = new Map(), lakeById = new Map();
  const half = sizeKm * .5 + grid.cellSizeKm * 1.75;
  for (const tile of tiles) {
    for (const reach of tile.reaches) {
      const fromLocal = localOffsetKm(centerLat, centerLon, reach.canonicalFrom.lat, reach.canonicalFrom.lon);
      const toLocal = localOffsetKm(centerLat, centerLon, reach.canonicalTo.lat, reach.canonicalTo.lon);
      const fromVisible = Math.abs(fromLocal.xKm) <= half && Math.abs(fromLocal.zKm) <= half;
      const toVisible = Math.abs(toLocal.xKm) <= half && Math.abs(toLocal.zKm) <= half;
      if (!fromVisible && !toVisible) continue;
      reachById.set(reach.id, {
        ...reach,
        from: { ...fromLocal, elevationM: reach.canonicalFrom.elevationM, lat: reach.canonicalFrom.lat, lon: reach.canonicalFrom.lon },
        to: { ...toLocal, elevationM: reach.canonicalTo.elevationM, lat: reach.canonicalTo.lat, lon: reach.canonicalTo.lon },
        boundaryHandoff: fromVisible !== toVisible
      });
    }
    for (const lake of tile.lakes) {
      const local = localOffsetKm(centerLat, centerLon, lake.canonical.lat, lake.canonical.lon);
      if (Math.abs(local.xKm) > half || Math.abs(local.zKm) > half) continue;
      lakeById.set(lake.id, { ...lake, ...local, lat: lake.canonical.lat, lon: lake.canonical.lon });
    }
  }

  const rivers = [...reachById.values()];
  const upstream = new Map();
  for (const reach of rivers) {
    if (!reach.downstreamReachId) continue;
    const list = upstream.get(reach.downstreamReachId) || [];
    list.push(reach.id); upstream.set(reach.downstreamReachId, list);
  }
  for (const reach of rivers) reach.upstreamReachIds = (upstream.get(reach.id) || []).sort();
  const lakes = [...lakeById.values()];
  const landCells = tiles.reduce((sum, tile) => sum + tile.reaches.length + tile.lakes.length, 0);
  const weightedRunoff = rivers.reduce((sum, river) => sum + river.annualRunoffMm * river.contributingAreaKm2, 0);
  const runoffWeight = rivers.reduce((sum, river) => sum + river.contributingAreaKm2, 0);
  const maxDrainageAreaKm2 = rivers.reduce((max, river) => Math.max(max, river.contributingAreaKm2), 0);
  const handoffs = rivers.filter(river => river.boundaryHandoff);
  const continuityLinks = rivers.filter(river => river.downstreamReachId && reachById.has(river.downstreamReachId)).length;

  return {
    schema: HYDROLOGY_SCHEMA,
    center: { lat: centerLat, lon: centerLon },
    sizeKm,
    resolution: Math.round(sizeKm / grid.cellSizeKm) + 1,
    spacingKm: grid.cellSizeKm,
    cellAreaKm2: representativeCellAreaKm2,
    riverThresholdKm2,
    grid,
    tiles: tiles.map(tile => tile.id),
    rivers,
    lakes,
    handoffs: handoffs.map(reach => ({ reachId: reach.id, downstreamReachId: reach.downstreamReachId, from: reach.canonicalFrom, to: reach.canonicalTo })),
    summary: {
      riverSegments: rivers.length,
      lakeCount: lakes.length,
      maxDrainageAreaKm2,
      meanRunoffMm: runoffWeight ? weightedRunoff / runoffWeight : 0,
      watershedSinks: lakes.length,
      perennialRiverSegments: rivers.filter(river => river.annualRunoffMm > 240).length,
      canonicalTiles: tiles.length,
      boundaryHandoffs: handoffs.length,
      continuityLinks,
      stableReachIds: rivers.length,
      sampledHydrologicFeatures: landCells
    },
    truth: {
      deterministic: true,
      planetAnchoredGrid: true,
      crossSectorReachIdentity: true,
      explicitBoundaryHandoffs: true,
      bufferedCanonicalTiles: true,
      depressionFilling: false,
      longTermSedimentTransport: false,
      scientificModel: false
    }
  };
}

export function compareSharedReaches(firstSector, secondSector) {
  const secondById = new Map((secondSector?.rivers || []).map(reach => [reach.id, reach]));
  const shared = [];
  for (const reach of firstSector?.rivers || []) {
    const other = secondById.get(reach.id);
    if (!other) continue;
    shared.push({
      reachId: reach.id,
      identicalCanonicalEndpoints: JSON.stringify(reach.canonicalFrom) === JSON.stringify(other.canonicalFrom) &&
        JSON.stringify(reach.canonicalTo) === JSON.stringify(other.canonicalTo),
      identicalRouting: reach.downstreamReachId === other.downstreamReachId,
      identicalDischarge: Math.abs(reach.dischargeM3s - other.dischargeM3s) < 1e-12
    });
  }
  return shared;
}

export function coupleHydrologyToEarthSystem(sector, column) {
  if (!sector || sector.schema !== HYDROLOGY_SCHEMA) throw new Error('Hydrology coupling requires a canonical sector');
  if (!column || column.schema !== 'axm.foundation-planet.earth-system-column/v1') {
    throw new Error('Hydrology coupling requires an Earth-system column');
  }
  const landFlux = column.kind === 'land'
    ? Math.max(0, Number(column.fluxes.surfaceRunoffMmDay || 0) + Number(column.fluxes.baseflowMmDay || 0))
    : 0;
  const climatologicalDailyRunoff = Math.max(.05, Number(sector.summary.meanRunoffMm || 0) / 365.25);
  const flowFactor = column.kind === 'land' && column.stepCount > 0
    ? clamp(landFlux / climatologicalDailyRunoff, .04, 8)
    : 1;
  const rivers = sector.rivers.map(reach => ({
    ...reach,
    currentDischargeM3s: reach.dischargeM3s * flowFactor,
    flowFactor,
    flowState: flowFactor < .2 ? 'very-low' : flowFactor < .65 ? 'low' : flowFactor > 3 ? 'flood' : flowFactor > 1.55 ? 'high' : 'seasonal-normal'
  }));
  const lakeBalanceMmDay = column.kind === 'land'
    ? Number(column.fluxes.precipitationMmDay || 0) - Number(column.fluxes.evaporationMmDay || 0) + landFlux * .12
    : 0;
  const lakes = sector.lakes.map(lake => ({
    ...lake,
    currentWaterBalanceMmDay: lakeBalanceMmDay,
    currentAreaKm2: lake.areaKm2 * clamp(1 + lakeBalanceMmDay / 500, .72, 1.22)
  }));
  return {
    ...sector,
    rivers,
    lakes,
    earthSystem: {
      schema: 'axm.foundation-planet.hydrology-earth-coupling/v1',
      cellId: column.id,
      columnStepCount: column.stepCount,
      flowFactor,
      runoffMmDay: Number(column.fluxes.surfaceRunoffMmDay || 0),
      baseflowMmDay: Number(column.fluxes.baseflowMmDay || 0),
      groundwaterTableDepthM: column.land?.waterTableDepthM ?? null,
      lakeBalanceMmDay,
      canonicalAnnualDischargePreserved: true
    },
    summary: {
      ...sector.summary,
      currentFlowFactor: flowFactor,
      currentRunoffMmDay: Number(column.fluxes.surfaceRunoffMmDay || 0),
      currentBaseflowMmDay: Number(column.fluxes.baseflowMmDay || 0),
      currentGroundwaterTableDepthM: column.land?.waterTableDepthM ?? null
    },
    truth: {
      ...sector.truth,
      statefulSurfaceGroundwaterCoupling: true,
      canonicalAnnualDischargePreserved: true
    }
  };
}

export function hydrologyDescription(options = {}) {
  const grid = gridDefinition(options);
  return {
    schema: HYDROLOGY_SCHEMA,
    grid,
    planetAnchored: true,
    stableReachIds: true,
    downstreamReachLinks: true,
    bufferedCanonicalTiles: true,
    statefulSurfaceGroundwaterCoupling: true,
    depressionFilling: false
  };
}

export function clearHydrologyCache() { TILE_CACHE.clear(); }
