import { PLANET_DEFAULTS } from './planet-model.mjs';
import {
  EARTH_SYSTEM_COLUMN_SCHEMA,
  atmosphereLayerHeatCapacitiesJm2K,
  atmosphereMoistEnthalpyJm2,
  atmosphereSensibleHeatJm2,
  atmosphereWaterStorageMm,
  boundaryLayerVaporCapacityMm,
  earthCellIdentity
} from './earth-system.mjs';

export const EARTH_TRANSPORT_GRAPH_SCHEMA = 'axm.foundation-planet.earth-transport-graph/v1';
export const EARTH_TRANSPORT_STEP_SCHEMA = 'axm.foundation-planet.earth-transport-step/v2';
export const EARTH_BOUNDARY_RECEIPT_SCHEMA = 'axm.foundation-planet.earth-boundary-receipt/v1';
export const EARTH_RUNOFF_ROUTE_SCHEMA = 'axm.foundation-planet.runoff-route-receipt/v1';
export const EARTH_ATMOSPHERE_MASS_ROUTE_SCHEMA = 'axm.foundation-planet.atmosphere-mass-route-receipt/v1';
export const EARTH_ATMOSPHERE_IMPULSE_SCHEMA = 'axm.foundation-planet.atmosphere-pressure-impulse-receipt/v1';
export const EARTH_ATMOSPHERE_CORIOLIS_SCHEMA = 'axm.foundation-planet.atmosphere-coriolis-receipt/v1';

const WATER_HEAT_CAPACITY_J_M3_K = 4.186e6;
const MAX_CLOUD_WATER_MM = 12;
const STANDARD_GRAVITY_MPS2 = 9.80665;
const MIN_SURFACE_PRESSURE_HPA = 850;
const MAX_SURFACE_PRESSURE_HPA = 1085;
const MAX_WIND_SPEED_MPS = 90;
const CLOCK_TOLERANCE_DAYS = 1e-6;
const DIRECTIONS = Object.freeze([
  Object.freeze({ id: 'north', latitude: 1, longitude: 0 }),
  Object.freeze({ id: 'east', latitude: 0, longitude: 1 }),
  Object.freeze({ id: 'south', latitude: -1, longitude: 0 }),
  Object.freeze({ id: 'west', latitude: 0, longitude: -1 })
]);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = value => JSON.parse(JSON.stringify(value));
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));

function stableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function cellTopology(column) {
  const identity = earthCellIdentity(column.coordinate.latitudeDeg, column.coordinate.longitudeDeg, {
    resolutionDeg: column.resolutionDeg
  });
  const latitudeCells = Math.round(180 / identity.resolutionDeg);
  const longitudeCells = Math.round(360 / identity.resolutionDeg);
  return { ...identity, latitudeCells, longitudeCells };
}

function cellId(resolutionDeg, latitudeIndex, longitudeIndex) {
  return `earth-cell:v1:${resolutionDeg}:${latitudeIndex}:${longitudeIndex}`;
}

function neighborFor(topology, direction) {
  const latitudeIndex = topology.latitudeIndex + direction.latitude;
  if (latitudeIndex < 0 || latitudeIndex >= topology.latitudeCells) return null;
  const longitudeIndex = (topology.longitudeIndex + direction.longitude + topology.longitudeCells) % topology.longitudeCells;
  return {
    id: cellId(topology.resolutionDeg, latitudeIndex, longitudeIndex),
    latitudeIndex,
    longitudeIndex
  };
}

export function earthCellAreaM2(columnOrIdentity, options = {}) {
  const topology = columnOrIdentity?.coordinate ? cellTopology(columnOrIdentity) : columnOrIdentity;
  if (!topology || !Number.isFinite(topology.latitudeIndex) || !Number.isFinite(topology.resolutionDeg)) {
    throw new Error('Earth-cell area requires a canonical column or identity');
  }
  const radiusM = finite(options.radiusM, PLANET_DEFAULTS.radiusM);
  const southDeg = clamp(-90 + topology.latitudeIndex * topology.resolutionDeg, -90, 90);
  const northDeg = clamp(southDeg + topology.resolutionDeg, -90, 90);
  const longitudeRadians = topology.resolutionDeg * Math.PI / 180;
  return radiusM * radiusM * longitudeRadians *
    (Math.sin(northDeg * Math.PI / 180) - Math.sin(southDeg * Math.PI / 180));
}

export function earthCellNeighbors(column) {
  if (!column || column.schema !== EARTH_SYSTEM_COLUMN_SCHEMA) throw new Error('Neighbor lookup requires an Earth-system column');
  const topology = cellTopology(column);
  return DIRECTIONS.map(direction => ({
    direction: direction.id,
    neighbor: neighborFor(topology, direction)
  }));
}

function edgeGeometry(a, b) {
  const topologyA = cellTopology(a);
  const topologyB = cellTopology(b);
  const east = topologyA.latitudeIndex === topologyB.latitudeIndex;
  const meanLatitudeRad = (a.coordinate.latitudeDeg + b.coordinate.latitudeDeg) * .5 * Math.PI / 180;
  const northSouthM = PLANET_DEFAULTS.radiusM * topologyA.resolutionDeg * Math.PI / 180;
  const eastWestM = Math.max(1, northSouthM * Math.cos(meanLatitudeRad));
  return {
    axis: east ? 'east-west' : 'north-south',
    aToBSign: east
      ? ((topologyB.longitudeIndex - topologyA.longitudeIndex + topologyA.longitudeCells) % topologyA.longitudeCells === 1 ? 1 : -1)
      : (topologyB.latitudeIndex > topologyA.latitudeIndex ? 1 : -1),
    centerDistanceM: east ? eastWestM : northSouthM,
    boundaryLengthM: east ? northSouthM : eastWestM
  };
}

function heatCapacityJm2K(column) {
  if (column.kind === 'ocean') return WATER_HEAT_CAPACITY_J_M3_K * column.ocean.mixedLayerDepthM;
  return 2.35e6 + finite(column.substrate?.soilDepthM) * 1.15e6;
}

function windProjectionMps(column, axis, directionSign) {
  const atmosphere = column.atmosphere || {};
  const speed = clamp(finite(atmosphere.windSpeedMps), 0, MAX_WIND_SPEED_MPS);
  const radians = finite(atmosphere.windDirectionDeg) * Math.PI / 180;
  const fallback = axis === 'east-west' ? Math.sin(radians) * speed : Math.cos(radians) * speed;
  const component = axis === 'east-west'
    ? finite(atmosphere.eastwardWindMps, fallback)
    : finite(atmosphere.northwardWindMps, fallback);
  return component * directionSign;
}

function atmosphereMassKg(column, areaM2) {
  return finite(column.atmosphere?.surfacePressureHpa, 1013.25) * 100 / STANDARD_GRAVITY_MPS2 * areaM2;
}

function atmosphereWind(column) {
  const speed = clamp(finite(column.atmosphere?.windSpeedMps), 0, MAX_WIND_SPEED_MPS);
  const radians = finite(column.atmosphere?.windDirectionDeg) * Math.PI / 180;
  return {
    eastwardMps: finite(column.atmosphere?.eastwardWindMps, Math.sin(radians) * speed),
    northwardMps: finite(column.atmosphere?.northwardWindMps, Math.cos(radians) * speed)
  };
}

function syncAtmosphereWind(column, eastwardMps, northwardMps) {
  const speed = Math.hypot(eastwardMps, northwardMps);
  column.atmosphere.eastwardWindMps = eastwardMps;
  column.atmosphere.northwardWindMps = northwardMps;
  column.atmosphere.windSpeedMps = speed;
  if (speed > 1e-12) column.atmosphere.windDirectionDeg = ((Math.atan2(eastwardMps, northwardMps) * 180 / Math.PI) + 360) % 360;
}

function transferProposal(kind, a, b, signedAmount, metadata = {}) {
  if (Math.abs(signedAmount) < 1e-12) return null;
  return signedAmount > 0
    ? { kind, donorId: a.id, receiverId: b.id, amount: signedAmount, ...metadata }
    : { kind, donorId: b.id, receiverId: a.id, amount: -signedAmount, ...metadata };
}

function constrainedTransfers(proposals, columnsById, bounds) {
  const outgoing = new Map();
  const incoming = new Map();
  for (const proposal of proposals) {
    outgoing.set(proposal.donorId, (outgoing.get(proposal.donorId) || 0) + proposal.amount);
    incoming.set(proposal.receiverId, (incoming.get(proposal.receiverId) || 0) + proposal.amount);
  }
  const donorScale = new Map();
  const receiverScale = new Map();
  for (const [id, amount] of outgoing) {
    const available = Math.max(0, bounds.maximum(columnsById.get(id)) - bounds.minimum(columnsById.get(id)));
    donorScale.set(id, amount > 0 ? Math.min(1, available / amount) : 1);
  }
  for (const [id, amount] of incoming) {
    const capacity = Math.max(0, bounds.capacity(columnsById.get(id)) - bounds.maximum(columnsById.get(id)));
    receiverScale.set(id, amount > 0 ? Math.min(1, capacity / amount) : 1);
  }
  return proposals.map(proposal => ({
    ...proposal,
    amount: proposal.amount * Math.min(
      donorScale.get(proposal.donorId) ?? 1,
      receiverScale.get(proposal.receiverId) ?? 1
    )
  })).filter(proposal => proposal.amount > 1e-12);
}

function sum(columns, selector) {
  let total = 0;
  for (const column of columns) total += selector(column);
  return total;
}

function applyPairTransfers(columnsById, transfers, getter, setter) {
  const deltas = new Map();
  for (const transfer of transfers) {
    deltas.set(transfer.donorId, (deltas.get(transfer.donorId) || 0) - transfer.amount);
    deltas.set(transfer.receiverId, (deltas.get(transfer.receiverId) || 0) + transfer.amount);
  }
  for (const [id, delta] of deltas) {
    const column = columnsById.get(id);
    setter(column, getter(column) + delta);
  }
}

function applyAtmosphereMassAndMomentum(sorted, columnsById, areas, massTransfers, pressureImpulses, durationDays) {
  const states = new Map(sorted.map(column => {
    const massKg = atmosphereMassKg(column, areas.get(column.id));
    const wind = atmosphereWind(column);
    return [column.id, {
      massKg,
      eastwardMomentumKgMps: massKg * wind.eastwardMps,
      northwardMomentumKgMps: massKg * wind.northwardMps,
      pressureEastwardImpulseKgMps: 0,
      pressureNorthwardImpulseKgMps: 0
    }];
  }));
  const totalKineticEnergyJ = () => [...states.values()].reduce((total, state) => total +
    (state.eastwardMomentumKgMps ** 2 + state.northwardMomentumKgMps ** 2) /
      Math.max(1, 2 * state.massKg), 0);
  const initialKineticEnergyJ = totalKineticEnergyJ();
  const massReceipts = [];
  for (const transfer of massTransfers) {
    const donor = states.get(transfer.donorId);
    const receiver = states.get(transfer.receiverId);
    const donorWind = atmosphereWind(columnsById.get(transfer.donorId));
    donor.massKg -= transfer.amount;
    receiver.massKg += transfer.amount;
    donor.eastwardMomentumKgMps -= transfer.amount * donorWind.eastwardMps;
    receiver.eastwardMomentumKgMps += transfer.amount * donorWind.eastwardMps;
    donor.northwardMomentumKgMps -= transfer.amount * donorWind.northwardMps;
    receiver.northwardMomentumKgMps += transfer.amount * donorWind.northwardMps;
    massReceipts.push({
      schema: EARTH_ATMOSPHERE_MASS_ROUTE_SCHEMA,
      edgeId: transfer.edgeId,
      senderCellId: transfer.donorId,
      receiverCellId: transfer.receiverId,
      dryAirMassKg: round(transfer.amount, 3),
      carriedEastwardMomentumKgMps: round(transfer.amount * donorWind.eastwardMps, 3),
      carriedNorthwardMomentumKgMps: round(transfer.amount * donorWind.northwardMps, 3)
    });
  }
  const afterMassKineticEnergyJ = totalKineticEnergyJ();
  for (const impulse of pressureImpulses) {
    const a = states.get(impulse.aId);
    const b = states.get(impulse.bId);
    a.pressureEastwardImpulseKgMps += impulse.aEastwardImpulseKgMps;
    a.pressureNorthwardImpulseKgMps += impulse.aNorthwardImpulseKgMps;
    b.pressureEastwardImpulseKgMps += impulse.bEastwardImpulseKgMps;
    b.pressureNorthwardImpulseKgMps += impulse.bNorthwardImpulseKgMps;
  }

  const fitsWindLimit = scale => [...states.values()].every(state => {
    const eastward = (state.eastwardMomentumKgMps + state.pressureEastwardImpulseKgMps * scale) / state.massKg;
    const northward = (state.northwardMomentumKgMps + state.pressureNorthwardImpulseKgMps * scale) / state.massKg;
    return Math.hypot(eastward, northward) <= MAX_WIND_SPEED_MPS + 1e-9;
  });
  let impulseScale = 1;
  if (!fitsWindLimit(1)) {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 48; iteration++) {
      const middle = (low + high) * .5;
      if (fitsWindLimit(middle)) low = middle;
      else high = middle;
    }
    impulseScale = low;
  }

  for (const column of sorted) {
    const state = states.get(column.id);
    state.eastwardMomentumKgMps += state.pressureEastwardImpulseKgMps * impulseScale;
    state.northwardMomentumKgMps += state.pressureNorthwardImpulseKgMps * impulseScale;
  }
  const afterPressureKineticEnergyJ = totalKineticEnergyJ();
  const rotationRateRadPerSecond = Math.PI * 2 / PLANET_DEFAULTS.dayLengthSeconds;
  const coriolisReceipts = [];
  for (const column of sorted) {
    const state = states.get(column.id);
    const beforeEastwardMomentumKgMps = state.eastwardMomentumKgMps;
    const beforeNorthwardMomentumKgMps = state.northwardMomentumKgMps;
    const latitudeRad = finite(column.coordinate?.latitudeDeg) * Math.PI / 180;
    const coriolisParameterPerSecond = 2 * rotationRateRadPerSecond * Math.sin(latitudeRad);
    const rotationRadians = coriolisParameterPerSecond * durationDays * PLANET_DEFAULTS.dayLengthSeconds;
    const cosine = Math.cos(rotationRadians);
    const sine = Math.sin(rotationRadians);
    state.eastwardMomentumKgMps = beforeEastwardMomentumKgMps * cosine + beforeNorthwardMomentumKgMps * sine;
    state.northwardMomentumKgMps = -beforeEastwardMomentumKgMps * sine + beforeNorthwardMomentumKgMps * cosine;
    const beforeKineticEnergyJ = (beforeEastwardMomentumKgMps ** 2 + beforeNorthwardMomentumKgMps ** 2) /
      Math.max(1, 2 * state.massKg);
    const afterKineticEnergyJ = (state.eastwardMomentumKgMps ** 2 + state.northwardMomentumKgMps ** 2) /
      Math.max(1, 2 * state.massKg);
    coriolisReceipts.push({
      schema: EARTH_ATMOSPHERE_CORIOLIS_SCHEMA,
      cellId: column.id,
      latitudeDeg: round(column.coordinate.latitudeDeg, 9),
      coriolisParameterPerSecond: round(coriolisParameterPerSecond, 15),
      rotationRadians: round(rotationRadians, 12),
      eastwardImpulseKgMps: round(state.eastwardMomentumKgMps - beforeEastwardMomentumKgMps, 3),
      northwardImpulseKgMps: round(state.northwardMomentumKgMps - beforeNorthwardMomentumKgMps, 3),
      kineticEnergyChangeJ: round(afterKineticEnergyJ - beforeKineticEnergyJ, 3)
    });
  }
  const afterCoriolisKineticEnergyJ = totalKineticEnergyJ();
  for (const column of sorted) {
    const state = states.get(column.id);
    column.atmosphere.surfacePressureHpa = state.massKg * STANDARD_GRAVITY_MPS2 / areas.get(column.id) / 100;
    syncAtmosphereWind(column,
      state.eastwardMomentumKgMps / state.massKg,
      state.northwardMomentumKgMps / state.massKg
    );
  }
  const impulseReceipts = pressureImpulses.map(impulse => ({
    schema: EARTH_ATMOSPHERE_IMPULSE_SCHEMA,
    edgeId: impulse.edgeId,
    axis: impulse.axis,
    pressureDifferenceHpa: round(impulse.pressureDifferenceHpa, 9),
    aCellId: impulse.aId,
    bCellId: impulse.bId,
    aEastwardImpulseKgMps: round(impulse.aEastwardImpulseKgMps * impulseScale, 3),
    aNorthwardImpulseKgMps: round(impulse.aNorthwardImpulseKgMps * impulseScale, 3),
    bEastwardImpulseKgMps: round(impulse.bEastwardImpulseKgMps * impulseScale, 3),
    bNorthwardImpulseKgMps: round(impulse.bNorthwardImpulseKgMps * impulseScale, 3),
    limiterScale: round(impulseScale, 12)
  }));
  return {
    massReceipts,
    impulseReceipts,
    coriolisReceipts,
    impulseScale,
    initialKineticEnergyJ,
    afterMassKineticEnergyJ,
    afterPressureKineticEnergyJ,
    afterCoriolisKineticEnergyJ,
    momentumMixingDissipationJ: initialKineticEnergyJ - afterMassKineticEnergyJ,
    pressureWorkJ: afterPressureKineticEnergyJ - afterMassKineticEnergyJ,
    coriolisWorkJ: afterCoriolisKineticEnergyJ - afterPressureKineticEnergyJ
  };
}

function createGraph(columns) {
  const sorted = [...columns].sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(sorted.map(column => [column.id, column]));
  const edges = [];
  const boundaries = [];
  for (const column of sorted) {
    const topology = cellTopology(column);
    for (const direction of DIRECTIONS) {
      const neighbor = neighborFor(topology, direction);
      if (!neighbor) {
        boundaries.push({
          schema: EARTH_BOUNDARY_RECEIPT_SCHEMA,
          cellId: column.id,
          direction: direction.id,
          neighborCellId: null,
          status: 'closed',
          reason: 'planetary-pole'
        });
        continue;
      }
      const other = byId.get(neighbor.id);
      if (!other) {
        boundaries.push({
          schema: EARTH_BOUNDARY_RECEIPT_SCHEMA,
          cellId: column.id,
          direction: direction.id,
          neighborCellId: neighbor.id,
          status: 'unresolved',
          reason: 'neighbor-not-loaded'
        });
        continue;
      }
      if (column.id.localeCompare(other.id) >= 0) continue;
      const geometry = edgeGeometry(column, other);
      edges.push({
        id: `earth-edge:v1:${column.id}|${other.id}`,
        aId: column.id,
        bId: other.id,
        ...geometry,
        timeAligned: Math.abs(column.lastDay - other.lastDay) <= CLOCK_TOLERANCE_DAYS
      });
    }
  }
  edges.sort((a, b) => a.id.localeCompare(b.id));
  boundaries.sort((a, b) => `${a.cellId}:${a.direction}`.localeCompare(`${b.cellId}:${b.direction}`));
  return { sorted, byId, edges, boundaries };
}

function transferTotals(transfers) {
  return round(transfers.reduce((total, transfer) => total + transfer.amount, 0), 3);
}

function routeRunoff(sorted, byId, activeEdges, areas, duration) {
  const adjacency = new Map(sorted.map(column => [column.id, []]));
  for (const edge of activeEdges) {
    adjacency.get(edge.aId).push(byId.get(edge.bId));
    adjacency.get(edge.bId).push(byId.get(edge.aId));
  }
  const proposals = [];
  const receipts = [];
  for (const source of sorted) {
    if (source.kind !== 'land' || finite(source.routing?.runoffQueueMm) <= 0) continue;
    const lowerNeighbors = adjacency.get(source.id)
      .filter(candidate => finite(candidate.surface?.elevationM) < finite(source.surface?.elevationM) - .01)
      .sort((a, b) => finite(a.surface?.elevationM) - finite(b.surface?.elevationM) || a.id.localeCompare(b.id));
    const downstream = lowerNeighbors[0];
    if (!downstream) {
      receipts.push({
        schema: EARTH_RUNOFF_ROUTE_SCHEMA,
        sourceCellId: source.id,
        destinationCellId: null,
        status: 'retained',
        reason: adjacency.get(source.id).length ? 'no-lower-time-aligned-neighbor' : 'no-time-aligned-neighbor',
        retainedRunoffKg: round(source.routing.runoffQueueMm * areas.get(source.id), 3)
      });
      continue;
    }
    const travelTimeDays = downstream.kind === 'ocean' ? .35 : .72;
    const routedFraction = 1 - Math.exp(-duration / travelTimeDays);
    const amount = source.routing.runoffQueueMm * areas.get(source.id) * routedFraction;
    if (amount <= 1e-12) continue;
    proposals.push({
      kind: 'runoff-routing',
      donorId: source.id,
      receiverId: downstream.id,
      amount,
      destinationKind: downstream.kind
    });
    receipts.push({
      schema: EARTH_RUNOFF_ROUTE_SCHEMA,
      sourceCellId: source.id,
      destinationCellId: downstream.id,
      destinationKind: downstream.kind,
      status: 'routed',
      reason: 'steepest-lower-loaded-cardinal-neighbor',
      sourceElevationM: round(source.surface.elevationM, 6),
      destinationElevationM: round(downstream.surface.elevationM, 6),
      routedRunoffKg: round(amount, 3)
    });
  }
  const queueDeltas = new Map();
  const oceanDeltas = new Map();
  for (const proposal of proposals) {
    queueDeltas.set(proposal.donorId, (queueDeltas.get(proposal.donorId) || 0) - proposal.amount);
    if (proposal.destinationKind === 'land') {
      queueDeltas.set(proposal.receiverId, (queueDeltas.get(proposal.receiverId) || 0) + proposal.amount);
    } else {
      oceanDeltas.set(proposal.receiverId, (oceanDeltas.get(proposal.receiverId) || 0) + proposal.amount);
    }
  }
  for (const [id, deltaKg] of queueDeltas) {
    const column = byId.get(id);
    column.routing.runoffQueueMm += deltaKg / areas.get(id);
  }
  for (const proposal of proposals) {
    const source = byId.get(proposal.donorId);
    source.routing.cumulativeRoutedRunoffMm += proposal.amount / areas.get(source.id);
    source.routing.lastDownstreamCellId = proposal.receiverId;
  }
  for (const [id, deltaKg] of oceanDeltas) {
    const column = byId.get(id);
    const referenceWaterMm = column.ocean.mixedLayerDepthM * 1000;
    const referenceSalinityPsu = column.ocean.salinityPsu *
      (referenceWaterMm + column.ocean.freshwaterAnomalyMm) / referenceWaterMm;
    column.ocean.freshwaterAnomalyMm += deltaKg / areas.get(id);
    column.ocean.salinityPsu = clamp(referenceSalinityPsu * referenceWaterMm /
      Math.max(1, referenceWaterMm + column.ocean.freshwaterAnomalyMm), 2, 43);
  }
  receipts.sort((a, b) => a.sourceCellId.localeCompare(b.sourceCellId));
  return {
    proposals,
    receipts,
    routedKg: proposals.reduce((total, proposal) => total + proposal.amount, 0),
    deliveredToOceanKg: proposals.filter(proposal => proposal.destinationKind === 'ocean')
      .reduce((total, proposal) => total + proposal.amount, 0)
  };
}

export function transportEarthSystemColumns(sourceColumns, dtDays, options = {}) {
  if (!Array.isArray(sourceColumns) || sourceColumns.length === 0) throw new Error('Earth transport requires at least one column');
  const duration = finite(dtDays);
  if (!(duration > 0) || duration > 1.000001) throw new Error('Earth transport step must be greater than zero and no longer than one day');
  const columns = sourceColumns.map(column => {
    if (!column || column.schema !== EARTH_SYSTEM_COLUMN_SCHEMA) throw new Error('Earth transport received an invalid column');
    if (column.atmosphere?.freeTroposphere && Math.abs(
      finite(column.atmosphere.boundaryLayerPressureHpa) +
      finite(column.atmosphere.freeTroposphere.pressureThicknessHpa) -
      finite(column.atmosphere.surfacePressureHpa)
    ) > 1e-7) throw new Error('Earth transport received an invalid vertical pressure partition');
    return clone(column);
  });
  const profileIds = new Set(columns.map(column => column.profileId));
  const resolutions = new Set(columns.map(column => column.resolutionDeg));
  if (profileIds.size !== 1) throw new Error('Earth transport cannot mix condition profiles');
  if (resolutions.size !== 1) throw new Error('Earth transport cannot mix cell resolutions');
  if (new Set(columns.map(column => column.id)).size !== columns.length) throw new Error('Earth transport received duplicate cells');

  const profileId = columns[0].profileId;
  const { sorted, byId, edges, boundaries } = createGraph(columns);
  const areas = new Map(sorted.map(column => [column.id, earthCellAreaM2(column)]));
  const activeEdges = edges.filter(edge => edge.timeAligned);
  const skippedEdges = edges.filter(edge => !edge.timeAligned).map(edge => ({
    edgeId: edge.id,
    reason: 'column-time-mismatch',
    aDay: byId.get(edge.aId).lastDay,
    bDay: byId.get(edge.bId).lastDay
  }));

  const atmosphereWater = [];
  const atmosphereCloudWater = [];
  const atmosphereHeat = [];
  const atmosphereDryAir = [];
  const pressureImpulses = [];
  const groundwater = [];
  const oceanFreshwater = [];
  const oceanHeat = [];
  for (const edge of activeEdges) {
    const a = byId.get(edge.aId);
    const b = byId.get(edge.bId);
    const areaA = areas.get(a.id);
    const areaB = areas.get(b.id);
    const sharedArea = Math.min(areaA, areaB);
    const directionSign = a.id === edge.aId ? 1 : -1;
    const wind = (windProjectionMps(a, edge.axis, directionSign) + windProjectionMps(b, edge.axis, directionSign)) * .5;
    const windFraction = clamp(Math.abs(wind) * duration * 86_400 / Math.max(1, edge.centerDistanceM) * .18, 0, .12);

    const pressureDifferenceHpa = finite(a.atmosphere.surfacePressureHpa, 1013.25) -
      finite(b.atmosphere.surfacePressureHpa, 1013.25);
    atmosphereDryAir.push(transferProposal('atmosphere-dry-air', a, b,
      pressureDifferenceHpa * 100 / STANDARD_GRAVITY_MPS2 * sharedArea * .045 * duration,
      { edgeId: edge.id }
    ));
    const pressureDrivenDeltaMps = clamp(pressureDifferenceHpa * .035 * duration, -6, 6) * edge.aToBSign;
    const aPressureImpulseKgMps = atmosphereMassKg(a, areaA) * pressureDrivenDeltaMps * .5;
    const bPressureImpulseKgMps = atmosphereMassKg(b, areaB) * pressureDrivenDeltaMps * .5;
    pressureImpulses.push({
      edgeId: edge.id,
      aId: a.id,
      bId: b.id,
      axis: edge.axis,
      pressureDifferenceHpa,
      aEastwardImpulseKgMps: edge.axis === 'east-west' ? aPressureImpulseKgMps : 0,
      aNorthwardImpulseKgMps: edge.axis === 'north-south' ? aPressureImpulseKgMps : 0,
      bEastwardImpulseKgMps: edge.axis === 'east-west' ? bPressureImpulseKgMps : 0,
      bNorthwardImpulseKgMps: edge.axis === 'north-south' ? bPressureImpulseKgMps : 0
    });

    const moistureDifferenceMm = finite(a.atmosphere.precipitableWaterMm) - finite(b.atmosphere.precipitableWaterMm);
    const moistureFraction = .022 * duration + windFraction * .28;
    atmosphereWater.push(transferProposal('atmosphere-water', a, b,
      moistureDifferenceMm * sharedArea * moistureFraction,
      { edgeId: edge.id }
    ));
    const cloudWaterDifferenceMm = finite(a.atmosphere.cloudWaterMm) - finite(b.atmosphere.cloudWaterMm);
    atmosphereCloudWater.push(transferProposal('atmosphere-cloud-water', a, b,
      cloudWaterDifferenceMm * sharedArea * clamp(.016 * duration + windFraction * .34, 0, .09),
      { edgeId: edge.id }
    ));

    const atmosphereCapacity = Math.min(
      atmosphereLayerHeatCapacitiesJm2K(a).boundaryLayerJm2K * areaA,
      atmosphereLayerHeatCapacitiesJm2K(b).boundaryLayerJm2K * areaB
    );
    const atmosphereFraction = clamp(.018 * duration + windFraction * .32, 0, .08);
    atmosphereHeat.push(transferProposal('atmosphere-heat', a, b,
      (finite(a.atmosphere.airTemperatureC) - finite(b.atmosphere.airTemperatureC)) * atmosphereCapacity * atmosphereFraction,
      { edgeId: edge.id }
    ));

    if (a.kind === 'land' && b.kind === 'land') {
      const headA = finite(a.surface.elevationM) - finite(a.land.waterTableDepthM);
      const headB = finite(b.surface.elevationM) - finite(b.land.waterTableDepthM);
      const hydraulicConductivityMDay = Math.sqrt(
        Math.max(.001, finite(a.substrate.conductivityMmDay) / 1000) *
        Math.max(.001, finite(b.substrate.conductivityMmDay) / 1000)
      );
      const saturatedDepthM = Math.min(a.substrate.aquiferDepthM, b.substrate.aquiferDepthM) * .55;
      const flowM3 = hydraulicConductivityMDay * Math.abs(headA - headB) / Math.max(1, edge.centerDistanceM) *
        edge.boundaryLengthM * saturatedDepthM * duration * 6;
      groundwater.push(transferProposal('groundwater', a, b, (headA >= headB ? 1 : -1) * flowM3 * 1000, {
        edgeId: edge.id,
        hydraulicHeadDifferenceM: round(Math.abs(headA - headB), 6)
      }));
    }

    if (a.kind === 'ocean' && b.kind === 'ocean') {
      const freshwaterDifferenceMm = finite(a.ocean.freshwaterAnomalyMm) - finite(b.ocean.freshwaterAnomalyMm);
      oceanFreshwater.push(transferProposal('ocean-freshwater', a, b,
        freshwaterDifferenceMm * sharedArea * .014 * duration,
        { edgeId: edge.id }
      ));
      const capacityA = heatCapacityJm2K(a) * areaA;
      const capacityB = heatCapacityJm2K(b) * areaB;
      oceanHeat.push(transferProposal('ocean-heat', a, b,
        (a.ocean.mixedLayerTemperatureC - b.ocean.mixedLayerTemperatureC) *
          Math.min(capacityA, capacityB) * .009 * duration,
        { edgeId: edge.id }
      ));
    }
  }

  const clean = proposals => proposals.filter(Boolean);
  const boundedAtmosphereWater = constrainedTransfers(clean(atmosphereWater), byId, {
    minimum: column => .2 * areas.get(column.id),
    maximum: column => finite(column.atmosphere.precipitableWaterMm) * areas.get(column.id),
    capacity: column => 75 * areas.get(column.id)
  });
  const boundedAtmosphereCloudWater = constrainedTransfers(clean(atmosphereCloudWater), byId, {
    minimum: () => 0,
    maximum: column => finite(column.atmosphere.cloudWaterMm) * areas.get(column.id),
    capacity: column => MAX_CLOUD_WATER_MM * areas.get(column.id)
  });
  const boundedAtmosphereDryAir = constrainedTransfers(clean(atmosphereDryAir), byId, {
    minimum: column => MIN_SURFACE_PRESSURE_HPA * 100 / STANDARD_GRAVITY_MPS2 * areas.get(column.id),
    maximum: column => atmosphereMassKg(column, areas.get(column.id)),
    capacity: column => MAX_SURFACE_PRESSURE_HPA * 100 / STANDARD_GRAVITY_MPS2 * areas.get(column.id)
  });
  const boundedGroundwater = constrainedTransfers(clean(groundwater), byId, {
    minimum: () => 0,
    maximum: column => finite(column.land.groundwaterStorageMm) * areas.get(column.id),
    capacity: column => finite(column.substrate.aquiferCapacityMm) * areas.get(column.id)
  });
  const cleanAtmosphereHeat = clean(atmosphereHeat);
  const cleanOceanFreshwater = clean(oceanFreshwater);
  const cleanOceanHeat = clean(oceanHeat);

  const initial = {
    atmosphereDryAirKg: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id))),
    atmosphereWaterKg: sum(sorted, column => atmosphereWaterStorageMm(column) * areas.get(column.id)),
    atmosphereVaporWaterKg: sum(sorted, column => finite(column.atmosphere.precipitableWaterMm) * areas.get(column.id)),
    atmosphereCloudWaterKg: sum(sorted, column => finite(column.atmosphere.cloudWaterMm) * areas.get(column.id)),
    groundwaterKg: sum(sorted.filter(column => column.land), column => column.land.groundwaterStorageMm * areas.get(column.id)),
    oceanFreshwaterKg: sum(sorted.filter(column => column.ocean), column => column.ocean.freshwaterAnomalyMm * areas.get(column.id)),
    runoffQueueKg: sum(sorted, column => finite(column.routing?.runoffQueueMm) * areas.get(column.id)),
    atmosphereHeatJ: sum(sorted, column => atmosphereSensibleHeatJm2(column) * areas.get(column.id)),
    atmosphereMoistEnthalpyJ: sum(sorted, column => atmosphereMoistEnthalpyJm2(column) * areas.get(column.id)),
    atmosphereEastwardMomentumKgMps: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id)) * atmosphereWind(column).eastwardMps),
    atmosphereNorthwardMomentumKgMps: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id)) * atmosphereWind(column).northwardMps),
    atmosphereKineticEnergyJ: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id)) *
      (atmosphereWind(column).eastwardMps ** 2 + atmosphereWind(column).northwardMps ** 2) * .5),
    oceanHeatJ: sum(sorted.filter(column => column.ocean), column => column.ocean.mixedLayerTemperatureC * heatCapacityJm2K(column) * areas.get(column.id))
  };

  const atmosphereDynamics = applyAtmosphereMassAndMomentum(
    sorted, byId, areas, boundedAtmosphereDryAir, pressureImpulses, duration
  );
  for (const column of sorted) {
    if (!column.atmosphere.freeTroposphere) continue;
    column.atmosphere.boundaryLayerPressureHpa = column.atmosphere.surfacePressureHpa * .25;
    column.atmosphere.freeTroposphere.pressureThicknessHpa =
      column.atmosphere.surfacePressureHpa - column.atmosphere.boundaryLayerPressureHpa;
  }
  applyPairTransfers(byId, boundedAtmosphereWater,
    column => column.atmosphere.precipitableWaterMm * areas.get(column.id),
    (column, massKg) => {
      column.atmosphere.precipitableWaterMm = massKg / areas.get(column.id);
      column.atmosphere.relativeHumidity = clamp(
        column.atmosphere.precipitableWaterMm /
          Math.max(.01, boundaryLayerVaporCapacityMm(column.atmosphere.airTemperatureC)),
        .01, 1
      );
    }
  );
  applyPairTransfers(byId, boundedAtmosphereCloudWater,
    column => finite(column.atmosphere.cloudWaterMm) * areas.get(column.id),
    (column, massKg) => {
      column.atmosphere.cloudWaterMm = massKg / areas.get(column.id);
    }
  );
  applyPairTransfers(byId, cleanAtmosphereHeat,
    column => column.atmosphere.airTemperatureC *
      atmosphereLayerHeatCapacitiesJm2K(column).boundaryLayerJm2K * areas.get(column.id),
    (column, heatJ) => {
      column.atmosphere.airTemperatureC = heatJ /
        (atmosphereLayerHeatCapacitiesJm2K(column).boundaryLayerJm2K * areas.get(column.id));
    }
  );
  applyPairTransfers(byId, boundedGroundwater,
    column => column.land.groundwaterStorageMm * areas.get(column.id),
    (column, massKg) => {
      column.land.groundwaterStorageMm = massKg / areas.get(column.id);
      column.land.waterTableDepthM = column.substrate.aquiferDepthM *
        (1 - clamp(column.land.groundwaterStorageMm / Math.max(1, column.substrate.aquiferCapacityMm)));
    }
  );
  applyPairTransfers(byId, cleanOceanFreshwater,
    column => column.ocean.freshwaterAnomalyMm * areas.get(column.id),
    (column, massKg) => {
      const previousReferenceMm = column.ocean.mixedLayerDepthM * 1000;
      const referenceSalinityPsu = column.ocean.salinityPsu *
        (previousReferenceMm + column.ocean.freshwaterAnomalyMm) / previousReferenceMm;
      column.ocean.freshwaterAnomalyMm = massKg / areas.get(column.id);
      column.ocean.salinityPsu = clamp(referenceSalinityPsu * previousReferenceMm /
        Math.max(1, previousReferenceMm + column.ocean.freshwaterAnomalyMm), 2, 43);
    }
  );
  applyPairTransfers(byId, cleanOceanHeat,
    column => column.ocean.mixedLayerTemperatureC * heatCapacityJm2K(column) * areas.get(column.id),
    (column, heatJ) => {
      column.ocean.mixedLayerTemperatureC = heatJ / (heatCapacityJm2K(column) * areas.get(column.id));
      column.ocean.heatContentJm2 = column.ocean.mixedLayerTemperatureC * heatCapacityJm2K(column);
      column.surface.temperatureC = column.ocean.mixedLayerTemperatureC;
    }
  );
  const runoffRouting = routeRunoff(sorted, byId, activeEdges, areas, duration);

  for (const column of sorted) {
    column.transport = {
      schema: EARTH_TRANSPORT_STEP_SCHEMA,
      lastDay: round(Math.max(...sorted.filter(candidate => Math.abs(candidate.lastDay - column.lastDay) <= CLOCK_TOLERANCE_DAYS).map(candidate => candidate.lastDay))),
      profileId,
      activeEdgeCount: activeEdges.filter(edge => edge.aId === column.id || edge.bId === column.id).length
    };
    column.truth.neighborTransportReady = true;
    column.truth.conservativeNeighborAtmosphereMomentumReady = true;
    column.truth.pressureGradientMomentumForcingReceipted = true;
    column.atmosphere.surfacePressureHpa = round(column.atmosphere.surfacePressureHpa, 12);
    if (column.atmosphere.freeTroposphere) {
      column.atmosphere.boundaryLayerPressureHpa = round(
        column.atmosphere.surfacePressureHpa * .25,
        12
      );
      column.atmosphere.freeTroposphere.pressureThicknessHpa = round(
        column.atmosphere.surfacePressureHpa - column.atmosphere.boundaryLayerPressureHpa,
        12
      );
    }
    column.atmosphere.precipitableWaterMm = round(column.atmosphere.precipitableWaterMm, 12);
    column.atmosphere.cloudWaterMm = round(finite(column.atmosphere.cloudWaterMm), 12);
    column.atmosphere.airTemperatureC = round(column.atmosphere.airTemperatureC, 12);
    column.atmosphere.relativeHumidity = round(clamp(
      column.atmosphere.precipitableWaterMm /
        Math.max(.01, boundaryLayerVaporCapacityMm(column.atmosphere.airTemperatureC)),
      .01,
      1
    ), 12);
    column.atmosphere.eastwardWindMps = round(column.atmosphere.eastwardWindMps, 12);
    column.atmosphere.northwardWindMps = round(column.atmosphere.northwardWindMps, 12);
    column.atmosphere.windSpeedMps = round(column.atmosphere.windSpeedMps, 12);
    column.atmosphere.windDirectionDeg = round(column.atmosphere.windDirectionDeg, 12);
    if (column.land) {
      column.land.groundwaterStorageMm = round(column.land.groundwaterStorageMm, 12);
      column.land.waterTableDepthM = round(column.land.waterTableDepthM, 12);
    }
    column.routing.runoffQueueMm = round(column.routing.runoffQueueMm, 12);
    column.routing.cumulativeGeneratedRunoffMm = round(column.routing.cumulativeGeneratedRunoffMm, 12);
    column.routing.cumulativeRoutedRunoffMm = round(column.routing.cumulativeRoutedRunoffMm, 12);
    column.routing.cumulativeChannelizedRunoffMm = round(finite(column.routing.cumulativeChannelizedRunoffMm), 12);
    column.truth.runoffCanEnterCanonicalRiverReach = true;
    if (column.ocean) {
      column.ocean.freshwaterAnomalyMm = round(column.ocean.freshwaterAnomalyMm, 12);
      column.ocean.salinityPsu = round(column.ocean.salinityPsu, 12);
      column.ocean.mixedLayerTemperatureC = round(column.ocean.mixedLayerTemperatureC, 12);
      column.ocean.heatContentJm2 = round(column.ocean.heatContentJm2, 3);
      column.surface.temperatureC = round(column.surface.temperatureC, 12);
    }
  }

  const final = {
    atmosphereDryAirKg: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id))),
    atmosphereWaterKg: sum(sorted, column => atmosphereWaterStorageMm(column) * areas.get(column.id)),
    atmosphereVaporWaterKg: sum(sorted, column => finite(column.atmosphere.precipitableWaterMm) * areas.get(column.id)),
    atmosphereCloudWaterKg: sum(sorted, column => finite(column.atmosphere.cloudWaterMm) * areas.get(column.id)),
    groundwaterKg: sum(sorted.filter(column => column.land), column => column.land.groundwaterStorageMm * areas.get(column.id)),
    oceanFreshwaterKg: sum(sorted.filter(column => column.ocean), column => column.ocean.freshwaterAnomalyMm * areas.get(column.id)),
    runoffQueueKg: sum(sorted, column => finite(column.routing?.runoffQueueMm) * areas.get(column.id)),
    atmosphereHeatJ: sum(sorted, column => atmosphereSensibleHeatJm2(column) * areas.get(column.id)),
    atmosphereMoistEnthalpyJ: sum(sorted, column => atmosphereMoistEnthalpyJm2(column) * areas.get(column.id)),
    atmosphereEastwardMomentumKgMps: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id)) * atmosphereWind(column).eastwardMps),
    atmosphereNorthwardMomentumKgMps: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id)) * atmosphereWind(column).northwardMps),
    atmosphereKineticEnergyJ: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id)) *
      (atmosphereWind(column).eastwardMps ** 2 + atmosphereWind(column).northwardMps ** 2) * .5),
    oceanHeatJ: sum(sorted.filter(column => column.ocean), column => column.ocean.mixedLayerTemperatureC * heatCapacityJm2K(column) * areas.get(column.id))
  };
  const residual = Object.fromEntries(Object.keys(initial).map(key => [key.replace(/(KgMps|Kg|J)$/, 'Residual$1'), final[key] - initial[key]]));
  const pressureForcing = {
    eastwardKgMps: pressureImpulses.reduce((total, impulse) => total +
      impulse.aEastwardImpulseKgMps + impulse.bEastwardImpulseKgMps, 0) * atmosphereDynamics.impulseScale,
    northwardKgMps: pressureImpulses.reduce((total, impulse) => total +
      impulse.aNorthwardImpulseKgMps + impulse.bNorthwardImpulseKgMps, 0) * atmosphereDynamics.impulseScale
  };
  const coriolisForcing = {
    eastwardKgMps: atmosphereDynamics.coriolisReceipts.reduce((total, receipt) => total + receipt.eastwardImpulseKgMps, 0),
    northwardKgMps: atmosphereDynamics.coriolisReceipts.reduce((total, receipt) => total + receipt.northwardImpulseKgMps, 0)
  };
  residual.atmosphereEastwardMomentumResidualKgMps -= pressureForcing.eastwardKgMps + coriolisForcing.eastwardKgMps;
  residual.atmosphereNorthwardMomentumResidualKgMps -= pressureForcing.northwardKgMps + coriolisForcing.northwardKgMps;
  residual.atmosphereKineticEnergyResidualJ += atmosphereDynamics.momentumMixingDissipationJ -
    atmosphereDynamics.pressureWorkJ - atmosphereDynamics.coriolisWorkJ;
  residual.oceanFreshwaterResidualKg -= runoffRouting.deliveredToOceanKg;
  residual.runoffQueueResidualKg += runoffRouting.deliveredToOceanKg;
  const receipt = {
    schema: EARTH_TRANSPORT_STEP_SCHEMA,
    graphSchema: EARTH_TRANSPORT_GRAPH_SCHEMA,
    profileId,
    durationDays: round(duration),
    columnCount: sorted.length,
    activeEdgeCount: activeEdges.length,
    skippedEdges,
    boundaryReceipts: boundaries,
    atmosphereMassReceipts: atmosphereDynamics.massReceipts,
    atmosphereImpulseReceipts: atmosphereDynamics.impulseReceipts,
    atmosphereCoriolisReceipts: atmosphereDynamics.coriolisReceipts,
    runoffReceipts: runoffRouting.receipts,
    transfers: {
      atmosphereDryAirKg: transferTotals(boundedAtmosphereDryAir),
      atmosphereWaterKg: transferTotals(boundedAtmosphereWater) + transferTotals(boundedAtmosphereCloudWater),
      atmosphereVaporWaterKg: transferTotals(boundedAtmosphereWater),
      atmosphereCloudWaterKg: transferTotals(boundedAtmosphereCloudWater),
      atmosphereHeatJ: transferTotals(cleanAtmosphereHeat),
      pressureForcingEastwardKgMps: round(pressureForcing.eastwardKgMps, 3),
      pressureForcingNorthwardKgMps: round(pressureForcing.northwardKgMps, 3),
      coriolisForcingEastwardKgMps: round(coriolisForcing.eastwardKgMps, 3),
      coriolisForcingNorthwardKgMps: round(coriolisForcing.northwardKgMps, 3),
      pressureImpulseLimiterScale: round(atmosphereDynamics.impulseScale, 12),
      momentumMixingDissipationJ: round(atmosphereDynamics.momentumMixingDissipationJ, 3),
      pressureWorkJ: round(atmosphereDynamics.pressureWorkJ, 3),
      coriolisWorkJ: round(atmosphereDynamics.coriolisWorkJ, 3),
      groundwaterKg: transferTotals(boundedGroundwater),
      oceanFreshwaterKg: transferTotals(cleanOceanFreshwater),
      oceanHeatJ: transferTotals(cleanOceanHeat),
      runoffRoutedKg: round(runoffRouting.routedKg, 3),
      runoffDeliveredToOceanKg: round(runoffRouting.deliveredToOceanKg, 3)
    },
    conservation: Object.fromEntries(Object.entries(residual).map(([key, value]) => [key, round(value, 3)])),
    truth: {
      simultaneousEdgeApplication: true,
      cellAreaWeighted: true,
      orderInvariant: true,
      conservativeNeighborExchange: true,
      explicitUnloadedBoundaries: true,
      atmosphereCoupledToLocalPrecipitationBudget: true,
      cloudLiquidWaterTransportConservative: true,
      moistEnthalpyTransportConservative: true,
      surfacePressureRepresentsDryAirColumnMass: true,
      dryAirMassExchangeConservative: true,
      transportedMomentumConservative: true,
      pressureGradientMomentumForcingReceipted: true,
      loadedDomainTangentMomentumLedger: true,
      coriolisDeflectionReceipted: true,
      coriolisKineticEnergyNeutral: true,
      atmosphericKineticEnergyLedger: true,
      boundaryLayerHorizontalTransport: true,
      upperAirHorizontalTransport: false,
      runoffQueueRoutedByTopography: true,
      runoffNeverDroppedAtSparseBoundary: true,
      globalCirculationModel: false,
      globalAngularMomentumModel: false,
      scientificForecast: false
    }
  };
  receipt.digest = stableDigest(receipt);
  return { columns: sorted.map(clone), receipt };
}

export function earthTransportDescription() {
  return {
    graphSchema: EARTH_TRANSPORT_GRAPH_SCHEMA,
    stepSchema: EARTH_TRANSPORT_STEP_SCHEMA,
    boundaryReceiptSchema: EARTH_BOUNDARY_RECEIPT_SCHEMA,
    runoffRouteReceiptSchema: EARTH_RUNOFF_ROUTE_SCHEMA,
    atmosphereMassRouteReceiptSchema: EARTH_ATMOSPHERE_MASS_ROUTE_SCHEMA,
    atmospherePressureImpulseReceiptSchema: EARTH_ATMOSPHERE_IMPULSE_SCHEMA,
    atmosphereCoriolisReceiptSchema: EARTH_ATMOSPHERE_CORIOLIS_SCHEMA,
    topology: 'cardinal neighbors on canonical spherical surface cells with dateline wrapping',
    processes: ['surface-pressure-dry-air-mass-exchange', 'dry-air-carried-column-mean-momentum-transport', 'receipted-loaded-pressure-gradient-forcing', 'rotation-aware-coriolis-deflection', 'atmospheric-kinetic-energy-ledger', 'boundary-layer-water-vapor-mixing', 'boundary-layer-cloud-liquid-water-mixing', 'boundary-layer-sensible-heat-mixing', 'two-layer-atmospheric-moist-enthalpy-ledger', 'hydraulic-head-groundwater-flow', 'ocean-freshwater-mixing', 'ocean-mixed-layer-heat-mixing', 'topographic-runoff-routing'],
    simultaneous: true,
    cellAreaWeighted: true,
    explicitSparseBoundaries: true,
    tangentMomentumConservativeAfterDeclaredPressureAndCoriolisForcing: true,
    coriolisUsesPlanetRotationAndLatitude: true,
    coriolisChangesDirectionWithoutDoingWork: true,
    cloudLiquidWaterTransportConservative: true,
    moistEnthalpyTransportConservative: true,
    boundaryLayerHorizontalTransport: true,
    upperAirHorizontalTransport: false,
    maximumStepDays: 1,
    globalCirculationModel: false,
    globalAngularMomentumModel: false,
    scientificForecast: false
  };
}
