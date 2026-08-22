import { PLANET_DEFAULTS } from './planet-model.mjs';
import {
  EARTH_SYSTEM_COLUMN_SCHEMA,
  atmosphereGeopotentialEnergyJm2,
  atmosphereLayerDryAirMassesKgM2,
  atmosphereLayerGeopotentialHeightsM,
  atmosphereLayerHeatCapacitiesJm2K,
  atmosphereLayerMoistEnthalpiesJm2,
  atmosphereMoistEnthalpyJm2,
  atmosphereSensibleHeatJm2,
  atmosphereWaterStorageMm,
  boundaryLayerVaporCapacityMm,
  earthCellIdentity,
  freeTroposphereVaporCapacityMm
} from './earth-system.mjs';
import {
  validatePressureColumn
} from './pressure-column.mjs';
import {
  EARTH_OCEAN_ECOLOGY_SCHEMA,
  applyLandRunoffBiogeochemistryInput,
  OCEAN_ECOLOGY_TRANSPORT_POOLS,
  oceanEcologyElementTotals,
  oceanEcologyTransportValue,
  setOceanEcologyTransportValue
} from './ocean-ecology.mjs';
import {
  RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA,
  debitRunoffBiogeochemistryQueue,
  creditRunoffBiogeochemistryQueue,
  runoffBiogeochemistryAbsoluteElements,
  runoffBiogeochemistryAbsolutePools
} from './soil-biogeochemistry.mjs';
import {
  RUNOFF_SEDIMENT_QUEUE_SCHEMA,
  COASTAL_SEDIMENT_STATE_SCHEMA,
  debitRunoffSedimentQueue,
  creditRunoffSedimentQueue,
  runoffSedimentAbsoluteGrains,
  creditCoastalSediment,
  normalizeCoastalSediment,
  sedimentGrainTotal,
  geomorphicSedimentDescription
} from './geomorphic-sediment.mjs';
import {
  ATMOSPHERE_PRESSURE_HORIZONTAL_TRANSPORT_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_MASS_ROUTE_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_TRACER_ROUTE_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_IMPULSE_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_CORIOLIS_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_GEOPOTENTIAL_ROUTE_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA,
  pressureHorizontalTransportDescription,
  transportNativePressureColumns
} from './pressure-transport.mjs';
import {
  ATMOSPHERE_BIOGEOCHEMISTRY_ROUTE_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA,
  atmosphereBiogeochemistryDomainTotals,
  atmosphereBiogeochemistryTransportDescription,
  transportAtmosphereBiogeochemistry
} from './atmosphere-biogeochemistry-transport.mjs';

export {
  ATMOSPHERE_PRESSURE_HORIZONTAL_TRANSPORT_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_MASS_ROUTE_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_TRACER_ROUTE_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_IMPULSE_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_CORIOLIS_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_GEOPOTENTIAL_ROUTE_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_ROUTE_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA
};

export const EARTH_TRANSPORT_GRAPH_SCHEMA = 'axm.foundation-planet.earth-transport-graph/v1';
export const EARTH_TRANSPORT_STEP_SCHEMA = 'axm.foundation-planet.earth-transport-step/v11';
export const PREVIOUS_EARTH_TRANSPORT_STEP_SCHEMA =
  'axm.foundation-planet.earth-transport-step/v10';
export const LEGACY_EARTH_TRANSPORT_STEP_SCHEMA =
  'axm.foundation-planet.earth-transport-step/v9';
export const OLDEST_EARTH_TRANSPORT_STEP_SCHEMA =
  'axm.foundation-planet.earth-transport-step/v8';
export const OCEAN_ECOLOGY_TRANSPORT_RECEIPT_SCHEMA =
  'axm.foundation-planet.ocean-ecology-transport-receipt/v1';
export const EARTH_BOUNDARY_RECEIPT_SCHEMA = 'axm.foundation-planet.earth-boundary-receipt/v1';
export const EARTH_RUNOFF_ROUTE_SCHEMA = 'axm.foundation-planet.runoff-route-receipt/v1';
export const EARTH_ATMOSPHERE_MASS_ROUTE_SCHEMA = 'axm.foundation-planet.atmosphere-mass-route-receipt/v1';
export const EARTH_ATMOSPHERE_IMPULSE_SCHEMA = 'axm.foundation-planet.atmosphere-pressure-impulse-receipt/v1';
export const EARTH_ATMOSPHERE_CORIOLIS_SCHEMA = 'axm.foundation-planet.atmosphere-coriolis-receipt/v1';
export const EARTH_ATMOSPHERE_LAYER_MASS_ROUTE_SCHEMA =
  'axm.foundation-planet.atmosphere-layer-mass-route-receipt/v1';
export const EARTH_ATMOSPHERE_LAYER_IMPULSE_SCHEMA =
  'axm.foundation-planet.atmosphere-layer-pressure-impulse-receipt/v1';
export const EARTH_ATMOSPHERE_LAYER_CORIOLIS_SCHEMA =
  'axm.foundation-planet.atmosphere-layer-coriolis-receipt/v1';
export const EARTH_ATMOSPHERE_GEOPOTENTIAL_ROUTE_SCHEMA =
  'axm.foundation-planet.atmosphere-geopotential-route-receipt/v1';

const WATER_HEAT_CAPACITY_J_M3_K = 4.186e6;
const MAX_CLOUD_WATER_MM = 12;
const MAX_FREE_TROPOSPHERE_WATER_MM = 20;
const MAX_FREE_TROPOSPHERE_CLOUD_WATER_MM = 8;
const STANDARD_GRAVITY_MPS2 = 9.80665;
const ABSOLUTE_ZERO_OFFSET_K = 273.15;
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

function atmosphereLayer(column, layerId = 'boundary-layer') {
  return layerId === 'free-troposphere'
    ? column.atmosphere?.freeTroposphere || {}
    : column.atmosphere || {};
}

function layerPressureHpa(column, layerId = 'boundary-layer') {
  return layerId === 'free-troposphere'
    ? finite(column.atmosphere?.freeTroposphere?.pressureThicknessHpa)
    : finite(column.atmosphere?.boundaryLayerPressureHpa);
}

function atmosphereLayerMassKg(column, areaM2, layerId = 'boundary-layer') {
  return layerPressureHpa(column, layerId) * 100 / STANDARD_GRAVITY_MPS2 * areaM2;
}

function windProjectionMps(column, axis, directionSign, layerId = 'boundary-layer') {
  const atmosphere = atmosphereLayer(column, layerId);
  const speed = clamp(finite(atmosphere.windSpeedMps), 0, MAX_WIND_SPEED_MPS);
  const radians = finite(atmosphere.windDirectionDeg) * Math.PI / 180;
  const fallback = axis === 'east-west' ? Math.sin(radians) * speed : Math.cos(radians) * speed;
  const component = axis === 'east-west'
    ? finite(atmosphere.eastwardWindMps, fallback)
    : finite(atmosphere.northwardWindMps, fallback);
  return component * directionSign;
}

function atmosphereMassKg(column, areaM2) {
  return (layerPressureHpa(column, 'boundary-layer') +
    layerPressureHpa(column, 'free-troposphere')) * 100 /
    STANDARD_GRAVITY_MPS2 * areaM2;
}

function atmosphereWind(column, layerId = 'boundary-layer') {
  const atmosphere = atmosphereLayer(column, layerId);
  const speed = clamp(finite(atmosphere.windSpeedMps), 0, MAX_WIND_SPEED_MPS);
  const radians = finite(atmosphere.windDirectionDeg) * Math.PI / 180;
  return {
    eastwardMps: finite(atmosphere.eastwardWindMps, Math.sin(radians) * speed),
    northwardMps: finite(atmosphere.northwardWindMps, Math.cos(radians) * speed)
  };
}

function syncAtmosphereWind(column, layerId, eastwardMps, northwardMps) {
  const atmosphere = atmosphereLayer(column, layerId);
  const speed = Math.hypot(eastwardMps, northwardMps);
  atmosphere.eastwardWindMps = eastwardMps;
  atmosphere.northwardWindMps = northwardMps;
  atmosphere.windSpeedMps = speed;
  if (speed > 1e-12) atmosphere.windDirectionDeg =
    ((Math.atan2(eastwardMps, northwardMps) * 180 / Math.PI) + 360) % 360;
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

function oceanEcologyDomainTotals(columns, areas) {
  const totals = {
    oceanEcologyCarbonKg: 0,
    oceanEcologyNitrogenKg: 0,
    oceanEcologyPhosphorusKg: 0,
    oceanEcologyOxygenKg: 0,
    oceanEcologyAlkalinityKg: 0
  };
  for (const column of columns) {
    if (column.kind !== 'ocean' || !column.ocean?.ecology) continue;
    const area = areas.get(column.id);
    const elements = oceanEcologyElementTotals(column.ocean.ecology);
    totals.oceanEcologyCarbonKg += elements.carbonKgCm2 * area;
    totals.oceanEcologyNitrogenKg += elements.nitrogenKgNm2 * area;
    totals.oceanEcologyPhosphorusKg += elements.phosphorusKgPm2 * area;
    totals.oceanEcologyOxygenKg += elements.oxygenKgO2m2 * area;
    totals.oceanEcologyAlkalinityKg +=
      elements.alkalinityKgCaCO3Eqm2 * area;
  }
  return totals;
}

function runoffBiogeochemistryDomainTotals(columns, areas) {
  const totals = {
    runoffBiogeochemistryCarbonKg: 0,
    runoffBiogeochemistryNitrogenKg: 0,
    runoffBiogeochemistryPhosphorusKg: 0,
    runoffBiogeochemistryOxygenKg: 0,
    runoffBiogeochemistryAlkalinityKg: 0
  };
  for (const column of columns) {
    if (column.kind !== 'land') continue;
    const pools = runoffBiogeochemistryAbsolutePools(
      column.routing?.runoffBiogeochemistryQueue,
      areas.get(column.id)
    );
    const elements = runoffBiogeochemistryAbsoluteElements(pools);
    totals.runoffBiogeochemistryCarbonKg += elements.carbon;
    totals.runoffBiogeochemistryNitrogenKg += elements.nitrogen;
    totals.runoffBiogeochemistryPhosphorusKg += elements.phosphorus;
    totals.runoffBiogeochemistryOxygenKg += elements.oxygen;
    totals.runoffBiogeochemistryAlkalinityKg += elements.alkalinity;
  }
  return totals;
}

function runoffSedimentDomainTotals(columns, areas) {
  const totals = {
    runoffSedimentClayKg: 0,
    runoffSedimentSiltKg: 0,
    runoffSedimentSandKg: 0,
    runoffSedimentGravelKg: 0
  };
  for (const column of columns) {
    if (column.kind !== 'land') continue;
    const grains = runoffSedimentAbsoluteGrains(
      column.routing?.runoffSedimentQueue,
      areas.get(column.id)
    );
    totals.runoffSedimentClayKg += grains.clay;
    totals.runoffSedimentSiltKg += grains.silt;
    totals.runoffSedimentSandKg += grains.sand;
    totals.runoffSedimentGravelKg += grains.gravel;
  }
  return totals;
}

function coastalSedimentDomainTotals(columns, areas) {
  const totals = {
    coastalSedimentClayKg: 0,
    coastalSedimentSiltKg: 0,
    coastalSedimentSandKg: 0,
    coastalSedimentGravelKg: 0
  };
  for (const column of columns) {
    if (column.kind !== 'ocean') continue;
    const area = areas.get(column.id);
    const state = normalizeCoastalSediment(column.ocean?.coastalSediment);
    totals.coastalSedimentClayKg += (state.suspendedKgM2.clay +
      state.depositedKgM2.clay) * area;
    totals.coastalSedimentSiltKg += (state.suspendedKgM2.silt +
      state.depositedKgM2.silt) * area;
    totals.coastalSedimentSandKg += (state.suspendedKgM2.sand +
      state.depositedKgM2.sand) * area;
    totals.coastalSedimentGravelKg += (state.suspendedKgM2.gravel +
      state.depositedKgM2.gravel) * area;
  }
  return totals;
}

function runoffReceivingOceanDomainTotals(columns, areas) {
  const totals = {
    runoffReceivingOceanCarbonKg: 0,
    runoffReceivingOceanNitrogenKg: 0,
    runoffReceivingOceanPhosphorusKg: 0,
    runoffReceivingOceanOxygenKg: 0,
    runoffReceivingOceanAlkalinityKg: 0
  };
  for (const column of columns) {
    if (column.kind !== 'ocean' || !column.ocean?.ecology) continue;
    const area = areas.get(column.id);
    const ecology = column.ocean.ecology;
    totals.runoffReceivingOceanCarbonKg += (
      finite(ecology.carbon?.dissolvedInorganicKgCm2) +
      finite(ecology.carbon?.dissolvedOrganicKgCm2)) * area;
    totals.runoffReceivingOceanNitrogenKg +=
      finite(ecology.nitrogen?.dissolvedInorganicKgNm2) * area;
    totals.runoffReceivingOceanPhosphorusKg +=
      finite(ecology.phosphorus?.dissolvedInorganicKgPm2) * area;
    totals.runoffReceivingOceanOxygenKg +=
      finite(ecology.oxygen?.dissolvedKgO2m2) * area;
    totals.runoffReceivingOceanAlkalinityKg +=
      finite(ecology.alkalinity?.dissolvedKgCaCO3Eqm2) * area;
  }
  return totals;
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

function applyAtmosphereLayerMassAndMomentum(
  sorted,
  columnsById,
  areas,
  massTransfers,
  pressureImpulses,
  durationDays,
  layerId
) {
  const states = new Map(sorted.map(column => {
    const massKg = atmosphereLayerMassKg(column, areas.get(column.id), layerId);
    const wind = atmosphereWind(column, layerId);
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
  let geopotentialAdjustmentWorkJ = 0;
  for (const transfer of massTransfers) {
    const donor = states.get(transfer.donorId);
    const receiver = states.get(transfer.receiverId);
    const donorColumn = columnsById.get(transfer.donorId);
    const receiverColumn = columnsById.get(transfer.receiverId);
    const donorWind = atmosphereWind(donorColumn, layerId);
    const donorHeights = atmosphereLayerGeopotentialHeightsM(donorColumn);
    const receiverHeights = atmosphereLayerGeopotentialHeightsM(receiverColumn);
    const senderGeopotentialHeightM = layerId === 'free-troposphere'
      ? donorHeights.freeTroposphereM : donorHeights.boundaryLayerM;
    const receiverGeopotentialHeightM = layerId === 'free-troposphere'
      ? receiverHeights.freeTroposphereM : receiverHeights.boundaryLayerM;
    const carriedGeopotentialEnergyJ = transfer.amount * STANDARD_GRAVITY_MPS2 *
      senderGeopotentialHeightM;
    const adjustmentWorkJ = transfer.amount * STANDARD_GRAVITY_MPS2 *
      (receiverGeopotentialHeightM - senderGeopotentialHeightM);
    geopotentialAdjustmentWorkJ += adjustmentWorkJ;
    donor.massKg -= transfer.amount;
    receiver.massKg += transfer.amount;
    donor.eastwardMomentumKgMps -= transfer.amount * donorWind.eastwardMps;
    receiver.eastwardMomentumKgMps += transfer.amount * donorWind.eastwardMps;
    donor.northwardMomentumKgMps -= transfer.amount * donorWind.northwardMps;
    receiver.northwardMomentumKgMps += transfer.amount * donorWind.northwardMps;
    massReceipts.push({
      schema: EARTH_ATMOSPHERE_LAYER_MASS_ROUTE_SCHEMA,
      transferId: transfer.transferId,
      edgeId: transfer.edgeId,
      layerId,
      senderCellId: transfer.donorId,
      receiverCellId: transfer.receiverId,
      dryAirMassKg: round(transfer.amount, 3),
      carriedEastwardMomentumKgMps: round(transfer.amount * donorWind.eastwardMps, 3),
      carriedNorthwardMomentumKgMps: round(transfer.amount * donorWind.northwardMps, 3),
      geopotential: {
        schema: EARTH_ATMOSPHERE_GEOPOTENTIAL_ROUTE_SCHEMA,
        senderHeightM: round(senderGeopotentialHeightM, 6),
        receiverHeightM: round(receiverGeopotentialHeightM, 6),
        carriedEnergyJ: round(carriedGeopotentialEnergyJ, 3),
        adjustmentWorkJ: round(adjustmentWorkJ, 3)
      }
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
      schema: EARTH_ATMOSPHERE_LAYER_CORIOLIS_SCHEMA,
      layerId,
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
    const pressureThicknessHpa = state.massKg * STANDARD_GRAVITY_MPS2 /
      areas.get(column.id) / 100;
    if (layerId === 'free-troposphere') {
      column.atmosphere.freeTroposphere.pressureThicknessHpa = pressureThicknessHpa;
    } else {
      column.atmosphere.boundaryLayerPressureHpa = pressureThicknessHpa;
    }
    syncAtmosphereWind(column, layerId,
      state.eastwardMomentumKgMps / state.massKg,
      state.northwardMomentumKgMps / state.massKg
    );
  }
  const impulseReceipts = pressureImpulses.map(impulse => ({
    schema: EARTH_ATMOSPHERE_LAYER_IMPULSE_SCHEMA,
    layerId,
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
    coriolisWorkJ: afterCoriolisKineticEnergyJ - afterPressureKineticEnergyJ,
    geopotentialAdjustmentWorkJ
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

function splitDryAirTransfersByLayer(transfers, columnsById, areas) {
  const result = { boundary: [], free: [] };
  for (const transfer of transfers) {
    const donor = columnsById.get(transfer.donorId);
    const areaM2 = areas.get(transfer.donorId);
    const boundaryMassKg = atmosphereLayerMassKg(donor, areaM2, 'boundary-layer');
    const freeMassKg = atmosphereLayerMassKg(donor, areaM2, 'free-troposphere');
    const totalMassKg = Math.max(1, boundaryMassKg + freeMassKg);
    const boundaryAmountKg = transfer.amount * boundaryMassKg / totalMassKg;
    const freeAmountKg = transfer.amount - boundaryAmountKg;
    result.boundary.push({
      ...transfer,
      kind: 'boundary-layer-dry-air',
      layerId: 'boundary-layer',
      transferId: `${transfer.edgeId}:boundary:${transfer.donorId}>${transfer.receiverId}`,
      amount: boundaryAmountKg
    });
    result.free.push({
      ...transfer,
      kind: 'free-troposphere-dry-air',
      layerId: 'free-troposphere',
      transferId: `${transfer.edgeId}:free:${transfer.donorId}>${transfer.receiverId}`,
      amount: freeAmountKg
    });
  }
  return result;
}

function advectiveTracerTransfers(layerTransfers, columnsById, areas, layerId) {
  const vapor = [];
  const cloud = [];
  const heat = [];
  for (const transfer of layerTransfers) {
    const donor = columnsById.get(transfer.donorId);
    const donorAreaM2 = areas.get(transfer.donorId);
    const donorLayerMassKg = atmosphereLayerMassKg(donor, donorAreaM2, layerId);
    const parcelFraction = clamp(transfer.amount / Math.max(1, donorLayerMassKg), 0, 1);
    const layer = atmosphereLayer(donor, layerId);
    const capacities = atmosphereLayerHeatCapacitiesJm2K(donor);
    const heatCapacityJm2K = layerId === 'free-troposphere'
      ? capacities.freeTroposphereJm2K : capacities.boundaryLayerJm2K;
    const metadata = {
      edgeId: transfer.edgeId,
      layerId,
      transportMode: 'dry-air-advection',
      sourceMassTransferId: transfer.transferId
    };
    vapor.push({
      kind: `${layerId}-vapor-advection`,
      donorId: transfer.donorId,
      receiverId: transfer.receiverId,
      amount: finite(layer.precipitableWaterMm) * donorAreaM2 * parcelFraction,
      ...metadata
    });
    cloud.push({
      kind: `${layerId}-cloud-advection`,
      donorId: transfer.donorId,
      receiverId: transfer.receiverId,
      amount: finite(layer.cloudWaterMm) * donorAreaM2 * parcelFraction,
      ...metadata
    });
    heat.push({
      kind: `${layerId}-sensible-enthalpy-advection`,
      donorId: transfer.donorId,
      receiverId: transfer.receiverId,
      amount: (finite(layer.airTemperatureC) + ABSOLUTE_ZERO_OFFSET_K) *
        heatCapacityJm2K * donorAreaM2 * parcelFraction,
      ...metadata
    });
  }
  return { vapor, cloud, heat };
}

function carriedTransferTotalsByMassId(transfers) {
  const totals = new Map();
  for (const transfer of transfers) {
    if (!transfer.sourceMassTransferId) continue;
    totals.set(transfer.sourceMassTransferId,
      (totals.get(transfer.sourceMassTransferId) || 0) + transfer.amount);
  }
  return totals;
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
    const transferId = `runoff:${stableDigest({
      donorId: source.id,
      receiverId: downstream.id,
      day: round(source.lastDay, 8),
      duration: round(duration, 8),
      amountKg: round(amount, 6)
    }).slice('fnv1a32:'.length)}`;
    proposals.push({
      kind: 'runoff-routing',
      transferId,
      donorId: source.id,
      receiverId: downstream.id,
      amount,
      routedFraction,
      destinationKind: downstream.kind
    });
    receipts.push({
      schema: EARTH_RUNOFF_ROUTE_SCHEMA,
      transferId,
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
  const chemistryReceiptByTransferId = new Map();
  const chemistryElements = {
    carbon: 0, nitrogen: 0, phosphorus: 0, oxygen: 0, alkalinity: 0
  };
  for (const proposal of proposals) {
    const source = byId.get(proposal.donorId);
    const debit = debitRunoffBiogeochemistryQueue(
      source.routing.runoffBiogeochemistryQueue,
      proposal.routedFraction,
      areas.get(source.id),
      {
        transferId: proposal.transferId,
        sourceCellId: source.id,
        destinationId: proposal.receiverId,
        destinationKind: proposal.destinationKind
      }
    );
    source.routing.runoffBiogeochemistryQueue = debit.queue;
    proposal.biogeochemistryPoolsKg = debit.poolsKg;
    const elements = runoffBiogeochemistryAbsoluteElements(debit.poolsKg);
    for (const element of Object.keys(chemistryElements)) {
      chemistryElements[element] += elements[element];
    }
    chemistryReceiptByTransferId.set(proposal.transferId, {
      senderDebit: debit.receipt,
      receiverCredit: null
    });
  }
  for (const proposal of proposals) {
    const receiver = byId.get(proposal.receiverId);
    let receiverCredit;
    if (proposal.destinationKind === 'land') {
      const credit = creditRunoffBiogeochemistryQueue(
        receiver.routing.runoffBiogeochemistryQueue,
        proposal.biogeochemistryPoolsKg,
        areas.get(receiver.id),
        {
          transferId: proposal.transferId,
          sourceCellId: proposal.donorId,
          destinationId: receiver.id,
          waterFraction: proposal.routedFraction
        }
      );
      receiver.routing.runoffBiogeochemistryQueue = credit.queue;
      receiverCredit = credit.receipt;
    } else {
      const credit = applyLandRunoffBiogeochemistryInput(
        receiver.ocean.ecology,
        proposal.amount,
        areas.get(receiver.id),
        {
          ocean: receiver.ocean,
          explicitInputsKg: proposal.biogeochemistryPoolsKg,
          transferId: proposal.transferId
        }
      );
      receiver.ocean.ecology = credit.state;
      receiverCredit = credit.receipt;
    }
    chemistryReceiptByTransferId.get(proposal.transferId).receiverCredit =
      receiverCredit;
  }
  for (const receipt of receipts) {
    if (!receipt.transferId) continue;
    receipt.runoffBiogeochemistryTransfer =
      chemistryReceiptByTransferId.get(receipt.transferId);
  }
  const sedimentReceiptByTransferId = new Map();
  const sedimentGrainsKg = { clay: 0, silt: 0, sand: 0, gravel: 0 };
  const oceanSedimentGrainsKg = { clay: 0, silt: 0, sand: 0, gravel: 0 };
  for (const proposal of proposals) {
    const source = byId.get(proposal.donorId);
    const debit = debitRunoffSedimentQueue(
      source.routing.runoffSedimentQueue,
      proposal.routedFraction,
      areas.get(source.id),
      {
        transferId: proposal.transferId,
        sourceCellId: source.id,
        destinationId: proposal.receiverId,
        destinationKind: proposal.destinationKind
      }
    );
    source.routing.runoffSedimentQueue = debit.queue;
    proposal.sedimentGrainsKg = debit.grainsKg;
    for (const grain of Object.keys(sedimentGrainsKg)) {
      sedimentGrainsKg[grain] += debit.grainsKg[grain];
      if (proposal.destinationKind === 'ocean') {
        oceanSedimentGrainsKg[grain] += debit.grainsKg[grain];
      }
    }
    sedimentReceiptByTransferId.set(proposal.transferId, {
      senderDebit: debit.receipt,
      receiverCredit: null
    });
  }
  for (const proposal of proposals) {
    const receiver = byId.get(proposal.receiverId);
    let receiverCredit;
    if (proposal.destinationKind === 'land') {
      const credit = creditRunoffSedimentQueue(
        receiver.routing.runoffSedimentQueue,
        proposal.sedimentGrainsKg,
        areas.get(receiver.id),
        {
          transferId: proposal.transferId,
          sourceCellId: proposal.donorId,
          destinationId: receiver.id,
          waterFraction: proposal.routedFraction
        }
      );
      receiver.routing.runoffSedimentQueue = credit.queue;
      receiverCredit = credit.receipt;
    } else {
      const credit = creditCoastalSediment(
        receiver.ocean.coastalSediment,
        proposal.sedimentGrainsKg,
        areas.get(receiver.id),
        {
          transferId: proposal.transferId,
          sourceId: proposal.donorId,
          destinationCellId: receiver.id
        }
      );
      receiver.ocean.coastalSediment = credit.state;
      receiverCredit = credit.receipt;
    }
    sedimentReceiptByTransferId.get(proposal.transferId).receiverCredit =
      receiverCredit;
  }
  for (const receipt of receipts) {
    if (!receipt.transferId) continue;
    receipt.runoffSedimentTransfer =
      sedimentReceiptByTransferId.get(receipt.transferId);
  }
  receipts.sort((a, b) => a.sourceCellId.localeCompare(b.sourceCellId));
  return {
    proposals,
    receipts,
    routedKg: proposals.reduce((total, proposal) => total + proposal.amount, 0),
    deliveredToOceanKg: proposals.filter(proposal => proposal.destinationKind === 'ocean')
      .reduce((total, proposal) => total + proposal.amount, 0),
    biogeochemistryElementsKg: chemistryElements,
    sedimentGrainsKg,
    oceanSedimentGrainsKg,
    sedimentKg: sedimentGrainTotal(sedimentGrainsKg),
    oceanSedimentKg: sedimentGrainTotal(oceanSedimentGrainsKg),
    oceanBiogeochemistryElementsKg: proposals
      .filter(proposal => proposal.destinationKind === 'ocean')
      .reduce((totals, proposal) => {
        const elements = runoffBiogeochemistryAbsoluteElements(
          proposal.biogeochemistryPoolsKg);
        for (const element of Object.keys(totals)) {
          totals[element] += elements[element];
        }
        return totals;
      }, {
        carbon: 0, nitrogen: 0, phosphorus: 0, oxygen: 0, alkalinity: 0
      })
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

  const groundwater = [];
  const oceanFreshwater = [];
  const oceanHeat = [];
  const oceanEcology = [];
  for (const edge of activeEdges) {
    const a = byId.get(edge.aId);
    const b = byId.get(edge.bId);
    const areaA = areas.get(a.id);
    const areaB = areas.get(b.id);
    const sharedArea = Math.min(areaA, areaB);
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
      if (a.ocean.ecology && b.ocean.ecology) {
        for (const pool of OCEAN_ECOLOGY_TRANSPORT_POOLS) {
          const differenceKgM2 = oceanEcologyTransportValue(a.ocean.ecology,
            pool.id) - oceanEcologyTransportValue(b.ocean.ecology, pool.id);
          oceanEcology.push(transferProposal('ocean-ecology-tracer', a, b,
            differenceKgM2 * sharedArea * .006 * duration,
            { edgeId: edge.id, poolId: pool.id, element: pool.element }
          ));
        }
      }
    }
  }

  const clean = proposals => proposals.filter(Boolean);
  const boundedGroundwater = constrainedTransfers(clean(groundwater), byId, {
    minimum: () => 0,
    maximum: column => finite(column.land.groundwaterStorageMm) * areas.get(column.id),
    capacity: column => finite(column.substrate.aquiferCapacityMm) * areas.get(column.id)
  });
  const cleanOceanFreshwater = clean(oceanFreshwater);
  const cleanOceanHeat = clean(oceanHeat);
  const boundedOceanEcology = [];
  for (const pool of OCEAN_ECOLOGY_TRANSPORT_POOLS) {
    const proposals = clean(oceanEcology).filter(entry =>
      entry.poolId === pool.id);
    boundedOceanEcology.push(...constrainedTransfers(proposals, byId, {
      minimum: () => 0,
      maximum: column => oceanEcologyTransportValue(column.ocean.ecology,
        pool.id) * areas.get(column.id),
      capacity: () => Number.MAX_VALUE
    }));
  }

  const layerSensibleHeatJ = (column, layerId) => {
    const capacities = atmosphereLayerHeatCapacitiesJm2K(column);
    const capacityJm2K = layerId === 'free-troposphere'
      ? capacities.freeTroposphereJm2K : capacities.boundaryLayerJm2K;
    return finite(atmosphereLayer(column, layerId).airTemperatureC) * capacityJm2K *
      areas.get(column.id);
  };
  const layerMoistEnthalpyJ = (column, layerId) => {
    const layers = atmosphereLayerMoistEnthalpiesJm2(column);
    return (layerId === 'free-troposphere'
      ? layers.freeTroposphereJm2 : layers.boundaryLayerJm2) * areas.get(column.id);
  };
  const layerEastwardMomentum = (column, layerId) =>
    atmosphereLayerMassKg(column, areas.get(column.id), layerId) *
      atmosphereWind(column, layerId).eastwardMps;
  const layerNorthwardMomentum = (column, layerId) =>
    atmosphereLayerMassKg(column, areas.get(column.id), layerId) *
      atmosphereWind(column, layerId).northwardMps;
  const layerKineticEnergy = (column, layerId) => {
    const wind = atmosphereWind(column, layerId);
    return atmosphereLayerMassKg(column, areas.get(column.id), layerId) *
      (wind.eastwardMps ** 2 + wind.northwardMps ** 2) * .5;
  };

  const initialDryAirMassKgByCellAndLayer = new Map(sorted.map(column => [
    column.id,
    column.atmosphere.pressureColumn.layers.map(layer =>
      finite(layer.pressureThicknessHpa) * 100 / 9.80665 *
      areas.get(column.id))
  ]));
  const initial = {
    ...atmosphereBiogeochemistryDomainTotals(sorted, areas),
    ...oceanEcologyDomainTotals(sorted, areas),
    ...runoffBiogeochemistryDomainTotals(sorted, areas),
    ...runoffSedimentDomainTotals(sorted, areas),
    ...coastalSedimentDomainTotals(sorted, areas),
    ...runoffReceivingOceanDomainTotals(sorted, areas),
    atmosphereDryAirKg: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id))),
    atmosphereBoundaryDryAirKg: sum(sorted, column =>
      atmosphereLayerMassKg(column, areas.get(column.id), 'boundary-layer')),
    atmosphereFreeDryAirKg: sum(sorted, column =>
      atmosphereLayerMassKg(column, areas.get(column.id), 'free-troposphere')),
    atmosphereWaterKg: sum(sorted, column => atmosphereWaterStorageMm(column) * areas.get(column.id)),
    atmosphereVaporWaterKg: sum(sorted, column => (finite(column.atmosphere.precipitableWaterMm) +
      finite(column.atmosphere.freeTroposphere.precipitableWaterMm)) * areas.get(column.id)),
    atmosphereBoundaryVaporWaterKg: sum(sorted, column =>
      finite(column.atmosphere.precipitableWaterMm) * areas.get(column.id)),
    atmosphereFreeVaporWaterKg: sum(sorted, column =>
      finite(column.atmosphere.freeTroposphere.precipitableWaterMm) * areas.get(column.id)),
    atmosphereCloudWaterKg: sum(sorted, column => (finite(column.atmosphere.cloudWaterMm) +
      finite(column.atmosphere.freeTroposphere.cloudWaterMm)) * areas.get(column.id)),
    atmosphereBoundaryCloudWaterKg: sum(sorted, column =>
      finite(column.atmosphere.cloudWaterMm) * areas.get(column.id)),
    atmosphereFreeCloudWaterKg: sum(sorted, column =>
      finite(column.atmosphere.freeTroposphere.cloudWaterMm) * areas.get(column.id)),
    atmosphereCloudIceKg: sum(sorted, column => (finite(column.atmosphere.cloudIceMm) +
      finite(column.atmosphere.freeTroposphere.cloudIceMm)) * areas.get(column.id)),
    atmosphereBoundaryCloudIceKg: sum(sorted, column =>
      finite(column.atmosphere.cloudIceMm) * areas.get(column.id)),
    atmosphereFreeCloudIceKg: sum(sorted, column =>
      finite(column.atmosphere.freeTroposphere.cloudIceMm) * areas.get(column.id)),
    groundwaterKg: sum(sorted.filter(column => column.land), column => column.land.groundwaterStorageMm * areas.get(column.id)),
    oceanFreshwaterKg: sum(sorted.filter(column => column.ocean), column => column.ocean.freshwaterAnomalyMm * areas.get(column.id)),
    runoffQueueKg: sum(sorted, column => finite(column.routing?.runoffQueueMm) * areas.get(column.id)),
    atmosphereHeatJ: sum(sorted, column => atmosphereSensibleHeatJm2(column) * areas.get(column.id)),
    atmosphereBoundaryHeatJ: sum(sorted, column => layerSensibleHeatJ(column, 'boundary-layer')),
    atmosphereFreeHeatJ: sum(sorted, column => layerSensibleHeatJ(column, 'free-troposphere')),
    atmosphereMoistEnthalpyJ: sum(sorted, column => atmosphereMoistEnthalpyJm2(column) * areas.get(column.id)),
    atmosphereBoundaryMoistEnthalpyJ: sum(sorted, column =>
      layerMoistEnthalpyJ(column, 'boundary-layer')),
    atmosphereFreeMoistEnthalpyJ: sum(sorted, column =>
      layerMoistEnthalpyJ(column, 'free-troposphere')),
    atmosphereEastwardMomentumKgMps: sum(sorted, column =>
      layerEastwardMomentum(column, 'boundary-layer') +
      layerEastwardMomentum(column, 'free-troposphere')),
    atmosphereBoundaryEastwardMomentumKgMps: sum(sorted, column =>
      layerEastwardMomentum(column, 'boundary-layer')),
    atmosphereFreeEastwardMomentumKgMps: sum(sorted, column =>
      layerEastwardMomentum(column, 'free-troposphere')),
    atmosphereNorthwardMomentumKgMps: sum(sorted, column =>
      layerNorthwardMomentum(column, 'boundary-layer') +
      layerNorthwardMomentum(column, 'free-troposphere')),
    atmosphereBoundaryNorthwardMomentumKgMps: sum(sorted, column =>
      layerNorthwardMomentum(column, 'boundary-layer')),
    atmosphereFreeNorthwardMomentumKgMps: sum(sorted, column =>
      layerNorthwardMomentum(column, 'free-troposphere')),
    atmosphereKineticEnergyJ: sum(sorted, column =>
      layerKineticEnergy(column, 'boundary-layer') +
      layerKineticEnergy(column, 'free-troposphere')),
    atmosphereBoundaryKineticEnergyJ: sum(sorted, column =>
      layerKineticEnergy(column, 'boundary-layer')),
    atmosphereFreeKineticEnergyJ: sum(sorted, column =>
      layerKineticEnergy(column, 'free-troposphere')),
    atmosphereGeopotentialEnergyJ: sum(sorted, column =>
      atmosphereGeopotentialEnergyJm2(column) * areas.get(column.id)),
    oceanHeatJ: sum(sorted.filter(column => column.ocean), column => column.ocean.mixedLayerTemperatureC * heatCapacityJm2K(column) * areas.get(column.id))
  };
  const nativeAtmosphereTransport = transportNativePressureColumns(
    sorted,
    activeEdges,
    areas,
    duration,
    { reason: 'loaded-native-pressure-horizontal-transport' }
  );
  const atmosphereBiogeochemistryTransport =
    transportAtmosphereBiogeochemistry(
      sorted,
      nativeAtmosphereTransport.receipt.massRouteReceipts,
      areas,
      {
        durationDays: duration,
        initialDryAirMassKgByCellAndLayer,
        reason: 'loaded-native-dry-air-gas-transport'
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
  for (const pool of OCEAN_ECOLOGY_TRANSPORT_POOLS) {
    const transfers = boundedOceanEcology.filter(entry =>
      entry.poolId === pool.id);
    applyPairTransfers(byId, transfers,
      column => oceanEcologyTransportValue(column.ocean.ecology, pool.id) *
        areas.get(column.id),
      (column, massKg) => {
        setOceanEcologyTransportValue(column.ocean.ecology, pool.id,
          massKg / areas.get(column.id));
      }
    );
  }
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
    if (column.atmosphere.freeTroposphere) {
      column.atmosphere.boundaryLayerPressureHpa = round(
        column.atmosphere.boundaryLayerPressureHpa,
        12
      );
      column.atmosphere.freeTroposphere.pressureThicknessHpa = round(
        column.atmosphere.freeTroposphere.pressureThicknessHpa,
        12
      );
      column.atmosphere.surfacePressureHpa = round(
        column.atmosphere.boundaryLayerPressureHpa +
          column.atmosphere.freeTroposphere.pressureThicknessHpa,
        12
      );
    }
    column.atmosphere.precipitableWaterMm = round(column.atmosphere.precipitableWaterMm, 12);
    column.atmosphere.cloudWaterMm = round(finite(column.atmosphere.cloudWaterMm), 12);
    column.atmosphere.cloudIceMm = round(finite(column.atmosphere.cloudIceMm), 12);
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
    column.atmosphere.freeTroposphere.precipitableWaterMm = round(
      column.atmosphere.freeTroposphere.precipitableWaterMm,
      12
    );
    column.atmosphere.freeTroposphere.cloudWaterMm = round(
      finite(column.atmosphere.freeTroposphere.cloudWaterMm),
      12
    );
    column.atmosphere.freeTroposphere.cloudIceMm = round(
      finite(column.atmosphere.freeTroposphere.cloudIceMm),
      12
    );
    column.atmosphere.freeTroposphere.airTemperatureC = round(
      column.atmosphere.freeTroposphere.airTemperatureC,
      12
    );
    column.atmosphere.freeTroposphere.relativeHumidity = round(clamp(
      column.atmosphere.freeTroposphere.precipitableWaterMm /
        Math.max(.01, freeTroposphereVaporCapacityMm(
          column.atmosphere.freeTroposphere.airTemperatureC
        )),
      .01,
      1
    ), 12);
    column.atmosphere.freeTroposphere.eastwardWindMps = round(
      column.atmosphere.freeTroposphere.eastwardWindMps,
      12
    );
    column.atmosphere.freeTroposphere.northwardWindMps = round(
      column.atmosphere.freeTroposphere.northwardWindMps,
      12
    );
    column.atmosphere.freeTroposphere.windSpeedMps = round(
      column.atmosphere.freeTroposphere.windSpeedMps,
      12
    );
    column.atmosphere.freeTroposphere.windDirectionDeg = round(
      column.atmosphere.freeTroposphere.windDirectionDeg,
      12
    );
    column.atmosphere.relativeHumidity = round(clamp(
      column.atmosphere.precipitableWaterMm /
        Math.max(.01, boundaryLayerVaporCapacityMm(column.atmosphere.airTemperatureC)),
      .01,
      1
    ), 12);
    column.atmosphere.freeTroposphere.relativeHumidity = round(clamp(
      column.atmosphere.freeTroposphere.precipitableWaterMm /
        Math.max(.01, freeTroposphereVaporCapacityMm(
          column.atmosphere.freeTroposphere.airTemperatureC
        )),
      .01,
      1
    ), 12);
    column.truth.pressureCoordinateColumnPersisted =
      validatePressureColumn(column.atmosphere.pressureColumn);
    column.truth.pressureColumnConservativeProjection =
      column.atmosphere.lastPressureColumnSyncReceipt?.truth?.dryAirMassClosed === true &&
      column.atmosphere.lastPressureColumnSyncReceipt?.truth?.waterClosed === true &&
      column.atmosphere.lastPressureColumnSyncReceipt?.truth?.momentumClosed === true &&
      column.atmosphere.lastPressureColumnSyncReceipt?.truth?.moistEnthalpyClosed === true;
    column.truth.pressureColumnHydrostaticInterfaces =
      column.atmosphere.lastPressureColumnSyncReceipt?.truth?.hydrostaticInterfacesMonotonic === true;
    column.truth.nativePressureLevelHorizontalTransport = true;
    column.truth.loadedAtmosphericBiogeochemistryTransport =
      column.atmosphere.biogeochemistry?.truth?.horizontallyTransported === true;
    column.truth.pressureLevelDynamicsResolved =
      column.atmosphere.lastPressureColumnDynamicsReceipt?.truth?.
        pressureLevelDynamicsResolved === true &&
      column.truth.nativePressureLevelHorizontalTransport === true;
    column.truth.freeTroposphereHorizontalTransport = true;
    column.truth.independentLayerAtmosphericMomentum = true;
    column.truth.terrainFollowingGeopotentialAdjustmentReceipted = true;
    if (column.land) {
      column.land.groundwaterStorageMm = round(column.land.groundwaterStorageMm, 12);
      column.land.waterTableDepthM = round(column.land.waterTableDepthM, 12);
    }
    column.routing.runoffQueueMm = round(column.routing.runoffQueueMm, 12);
    column.routing.cumulativeGeneratedRunoffMm = round(column.routing.cumulativeGeneratedRunoffMm, 12);
    column.routing.cumulativeRoutedRunoffMm = round(column.routing.cumulativeRoutedRunoffMm, 12);
    column.routing.cumulativeChannelizedRunoffMm = round(finite(column.routing.cumulativeChannelizedRunoffMm), 12);
    column.truth.runoffCanEnterCanonicalRiverReach = true;
    column.truth.persistentRunoffBiogeochemistryQueue =
      column.kind !== 'land' ||
      column.routing.runoffBiogeochemistryQueue?.schema ===
        RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA;
    column.truth.runoffBiogeochemistryMovesWithWater = true;
    column.truth.persistentRunoffSedimentQueue =
      column.kind !== 'land' ||
      column.routing.runoffSedimentQueue?.schema ===
        RUNOFF_SEDIMENT_QUEUE_SCHEMA;
    column.truth.runoffSedimentMovesWithWater = true;
    column.truth.persistentCoastalSediment = column.kind !== 'ocean' ||
      column.ocean?.coastalSediment?.schema ===
        COASTAL_SEDIMENT_STATE_SCHEMA;
    column.truth.parameterizedLandRunoffChemistryBoundary = false;
    if (column.ocean) {
      column.ocean.freshwaterAnomalyMm = round(column.ocean.freshwaterAnomalyMm, 12);
      column.ocean.salinityPsu = round(column.ocean.salinityPsu, 12);
      column.ocean.mixedLayerTemperatureC = round(column.ocean.mixedLayerTemperatureC, 12);
      column.ocean.heatContentJm2 = round(column.ocean.heatContentJm2, 3);
      column.surface.temperatureC = round(column.surface.temperatureC, 12);
      column.truth.loadedOceanBiogeochemicalTransport =
        column.ocean.ecology?.schema ===
          EARTH_OCEAN_ECOLOGY_SCHEMA;
    }
  }

  const final = {
    ...atmosphereBiogeochemistryDomainTotals(sorted, areas),
    ...oceanEcologyDomainTotals(sorted, areas),
    ...runoffBiogeochemistryDomainTotals(sorted, areas),
    ...runoffSedimentDomainTotals(sorted, areas),
    ...coastalSedimentDomainTotals(sorted, areas),
    ...runoffReceivingOceanDomainTotals(sorted, areas),
    atmosphereDryAirKg: sum(sorted, column => atmosphereMassKg(column, areas.get(column.id))),
    atmosphereBoundaryDryAirKg: sum(sorted, column =>
      atmosphereLayerMassKg(column, areas.get(column.id), 'boundary-layer')),
    atmosphereFreeDryAirKg: sum(sorted, column =>
      atmosphereLayerMassKg(column, areas.get(column.id), 'free-troposphere')),
    atmosphereWaterKg: sum(sorted, column => atmosphereWaterStorageMm(column) * areas.get(column.id)),
    atmosphereVaporWaterKg: sum(sorted, column => (finite(column.atmosphere.precipitableWaterMm) +
      finite(column.atmosphere.freeTroposphere.precipitableWaterMm)) * areas.get(column.id)),
    atmosphereBoundaryVaporWaterKg: sum(sorted, column =>
      finite(column.atmosphere.precipitableWaterMm) * areas.get(column.id)),
    atmosphereFreeVaporWaterKg: sum(sorted, column =>
      finite(column.atmosphere.freeTroposphere.precipitableWaterMm) * areas.get(column.id)),
    atmosphereCloudWaterKg: sum(sorted, column => (finite(column.atmosphere.cloudWaterMm) +
      finite(column.atmosphere.freeTroposphere.cloudWaterMm)) * areas.get(column.id)),
    atmosphereBoundaryCloudWaterKg: sum(sorted, column =>
      finite(column.atmosphere.cloudWaterMm) * areas.get(column.id)),
    atmosphereFreeCloudWaterKg: sum(sorted, column =>
      finite(column.atmosphere.freeTroposphere.cloudWaterMm) * areas.get(column.id)),
    atmosphereCloudIceKg: sum(sorted, column => (finite(column.atmosphere.cloudIceMm) +
      finite(column.atmosphere.freeTroposphere.cloudIceMm)) * areas.get(column.id)),
    atmosphereBoundaryCloudIceKg: sum(sorted, column =>
      finite(column.atmosphere.cloudIceMm) * areas.get(column.id)),
    atmosphereFreeCloudIceKg: sum(sorted, column =>
      finite(column.atmosphere.freeTroposphere.cloudIceMm) * areas.get(column.id)),
    groundwaterKg: sum(sorted.filter(column => column.land), column => column.land.groundwaterStorageMm * areas.get(column.id)),
    oceanFreshwaterKg: sum(sorted.filter(column => column.ocean), column => column.ocean.freshwaterAnomalyMm * areas.get(column.id)),
    runoffQueueKg: sum(sorted, column => finite(column.routing?.runoffQueueMm) * areas.get(column.id)),
    atmosphereHeatJ: sum(sorted, column => atmosphereSensibleHeatJm2(column) * areas.get(column.id)),
    atmosphereBoundaryHeatJ: sum(sorted, column => layerSensibleHeatJ(column, 'boundary-layer')),
    atmosphereFreeHeatJ: sum(sorted, column => layerSensibleHeatJ(column, 'free-troposphere')),
    atmosphereMoistEnthalpyJ: sum(sorted, column => atmosphereMoistEnthalpyJm2(column) * areas.get(column.id)),
    atmosphereBoundaryMoistEnthalpyJ: sum(sorted, column =>
      layerMoistEnthalpyJ(column, 'boundary-layer')),
    atmosphereFreeMoistEnthalpyJ: sum(sorted, column =>
      layerMoistEnthalpyJ(column, 'free-troposphere')),
    atmosphereEastwardMomentumKgMps: sum(sorted, column =>
      layerEastwardMomentum(column, 'boundary-layer') +
      layerEastwardMomentum(column, 'free-troposphere')),
    atmosphereBoundaryEastwardMomentumKgMps: sum(sorted, column =>
      layerEastwardMomentum(column, 'boundary-layer')),
    atmosphereFreeEastwardMomentumKgMps: sum(sorted, column =>
      layerEastwardMomentum(column, 'free-troposphere')),
    atmosphereNorthwardMomentumKgMps: sum(sorted, column =>
      layerNorthwardMomentum(column, 'boundary-layer') +
      layerNorthwardMomentum(column, 'free-troposphere')),
    atmosphereBoundaryNorthwardMomentumKgMps: sum(sorted, column =>
      layerNorthwardMomentum(column, 'boundary-layer')),
    atmosphereFreeNorthwardMomentumKgMps: sum(sorted, column =>
      layerNorthwardMomentum(column, 'free-troposphere')),
    atmosphereKineticEnergyJ: sum(sorted, column =>
      layerKineticEnergy(column, 'boundary-layer') +
      layerKineticEnergy(column, 'free-troposphere')),
    atmosphereBoundaryKineticEnergyJ: sum(sorted, column =>
      layerKineticEnergy(column, 'boundary-layer')),
    atmosphereFreeKineticEnergyJ: sum(sorted, column =>
      layerKineticEnergy(column, 'free-troposphere')),
    atmosphereGeopotentialEnergyJ: sum(sorted, column =>
      atmosphereGeopotentialEnergyJm2(column) * areas.get(column.id)),
    oceanHeatJ: sum(sorted.filter(column => column.ocean), column => column.ocean.mixedLayerTemperatureC * heatCapacityJm2K(column) * areas.get(column.id))
  };
  const residual = Object.fromEntries(Object.keys(initial).map(key => [key.replace(/(KgMps|Kg|J)$/, 'Residual$1'), final[key] - initial[key]]));
  const nativeTransportReceipt = nativeAtmosphereTransport.receipt;
  const pressureForcing = {
    eastwardKgMps: nativeTransportReceipt.transfers.pressureForcingEastwardKgMps,
    northwardKgMps: nativeTransportReceipt.transfers.pressureForcingNorthwardKgMps
  };
  const coriolisForcing = {
    eastwardKgMps: nativeTransportReceipt.transfers.coriolisForcingEastwardKgMps,
    northwardKgMps: nativeTransportReceipt.transfers.coriolisForcingNorthwardKgMps
  };
  const bandForcing = (receipts, start, end, coriolis = false) => receipts
    .filter(entry => entry.layerIndex >= start && entry.layerIndex < end)
    .reduce((totals, entry) => {
      totals.eastwardKgMps += coriolis
        ? finite(entry.eastwardImpulseKgMps)
        : finite(entry.aEastwardImpulseKgMps) + finite(entry.bEastwardImpulseKgMps);
      totals.northwardKgMps += coriolis
        ? finite(entry.northwardImpulseKgMps)
        : finite(entry.aNorthwardImpulseKgMps) + finite(entry.bNorthwardImpulseKgMps);
      return totals;
    }, { eastwardKgMps: 0, northwardKgMps: 0 });
  const boundaryPressureForcing = bandForcing(nativeTransportReceipt.impulseReceipts, 0, 2);
  const freePressureForcing = bandForcing(nativeTransportReceipt.impulseReceipts, 2, 8);
  const boundaryCoriolisForcing = bandForcing(nativeTransportReceipt.coriolisReceipts, 0, 2, true);
  const freeCoriolisForcing = bandForcing(nativeTransportReceipt.coriolisReceipts, 2, 8, true);
  residual.atmosphereEastwardMomentumResidualKgMps -= pressureForcing.eastwardKgMps + coriolisForcing.eastwardKgMps;
  residual.atmosphereNorthwardMomentumResidualKgMps -= pressureForcing.northwardKgMps + coriolisForcing.northwardKgMps;
  residual.atmosphereBoundaryEastwardMomentumResidualKgMps -=
    boundaryPressureForcing.eastwardKgMps + boundaryCoriolisForcing.eastwardKgMps;
  residual.atmosphereFreeEastwardMomentumResidualKgMps -=
    freePressureForcing.eastwardKgMps + freeCoriolisForcing.eastwardKgMps;
  residual.atmosphereBoundaryNorthwardMomentumResidualKgMps -=
    boundaryPressureForcing.northwardKgMps + boundaryCoriolisForcing.northwardKgMps;
  residual.atmosphereFreeNorthwardMomentumResidualKgMps -=
    freePressureForcing.northwardKgMps + freeCoriolisForcing.northwardKgMps;
  const totalMomentumMixingDissipationJ =
    nativeTransportReceipt.transfers.momentumMixingDissipationJ;
  const totalPressureWorkJ = nativeTransportReceipt.transfers.pressureWorkJ;
  const totalCoriolisWorkJ = nativeTransportReceipt.transfers.coriolisWorkJ;
  const boundaryLevels = nativeTransportReceipt.levelSummaries.slice(0, 2);
  const freeLevels = nativeTransportReceipt.levelSummaries.slice(2);
  const sumLevelField = (levels, field) => levels.reduce((total, entry) =>
    total + finite(entry[field]), 0);
  const boundaryMomentumMixingDissipationJ = sumLevelField(
    boundaryLevels,
    'momentumMixingDissipationJ'
  );
  const freeMomentumMixingDissipationJ = sumLevelField(
    freeLevels,
    'momentumMixingDissipationJ'
  );
  const boundaryPressureWorkJ = sumLevelField(boundaryLevels, 'pressureWorkJ');
  const freePressureWorkJ = sumLevelField(freeLevels, 'pressureWorkJ');
  const boundaryCoriolisWorkJ = sumLevelField(boundaryLevels, 'coriolisWorkJ');
  const freeCoriolisWorkJ = sumLevelField(freeLevels, 'coriolisWorkJ');
  residual.atmosphereHeatResidualJ -= totalMomentumMixingDissipationJ;
  residual.atmosphereBoundaryHeatResidualJ -= boundaryMomentumMixingDissipationJ;
  residual.atmosphereFreeHeatResidualJ -= freeMomentumMixingDissipationJ;
  residual.atmosphereMoistEnthalpyResidualJ -= totalMomentumMixingDissipationJ;
  residual.atmosphereBoundaryMoistEnthalpyResidualJ -=
    boundaryMomentumMixingDissipationJ;
  residual.atmosphereFreeMoistEnthalpyResidualJ -= freeMomentumMixingDissipationJ;
  residual.atmosphereKineticEnergyResidualJ += totalMomentumMixingDissipationJ -
    totalPressureWorkJ - totalCoriolisWorkJ;
  residual.atmosphereBoundaryKineticEnergyResidualJ +=
    boundaryMomentumMixingDissipationJ - boundaryPressureWorkJ -
    boundaryCoriolisWorkJ;
  residual.atmosphereFreeKineticEnergyResidualJ +=
    freeMomentumMixingDissipationJ - freePressureWorkJ - freeCoriolisWorkJ;
  const nativeBoundaryInitialKineticEnergyJ = sumLevelField(
    boundaryLevels.map(level => level.initial),
    'horizontalKineticEnergyJ'
  );
  const nativeBoundaryFinalKineticEnergyJ = sumLevelField(
    boundaryLevels.map(level => level.final),
    'horizontalKineticEnergyJ'
  );
  const nativeFreeInitialKineticEnergyJ = sumLevelField(
    freeLevels.map(level => level.initial),
    'horizontalKineticEnergyJ'
  );
  const nativeFreeFinalKineticEnergyJ = sumLevelField(
    freeLevels.map(level => level.final),
    'horizontalKineticEnergyJ'
  );
  const boundaryCompatibilityProjectionKineticVarianceAdjustmentJ =
    (nativeBoundaryFinalKineticEnergyJ - final.atmosphereBoundaryKineticEnergyJ) -
    (nativeBoundaryInitialKineticEnergyJ - initial.atmosphereBoundaryKineticEnergyJ);
  const freeCompatibilityProjectionKineticVarianceAdjustmentJ =
    (nativeFreeFinalKineticEnergyJ - final.atmosphereFreeKineticEnergyJ) -
    (nativeFreeInitialKineticEnergyJ - initial.atmosphereFreeKineticEnergyJ);
  const compatibilityProjectionKineticVarianceAdjustmentJ =
    boundaryCompatibilityProjectionKineticVarianceAdjustmentJ +
    freeCompatibilityProjectionKineticVarianceAdjustmentJ;
  residual.atmosphereKineticEnergyResidualJ +=
    compatibilityProjectionKineticVarianceAdjustmentJ;
  residual.atmosphereBoundaryKineticEnergyResidualJ +=
    boundaryCompatibilityProjectionKineticVarianceAdjustmentJ;
  residual.atmosphereFreeKineticEnergyResidualJ +=
    freeCompatibilityProjectionKineticVarianceAdjustmentJ;
  const geopotentialAdjustmentWorkJ =
    nativeTransportReceipt.transfers.geopotentialRouteWorkJ +
    nativeTransportReceipt.transfers.hydrostaticGeometryAdjustmentJ;
  residual.atmosphereGeopotentialEnergyResidualJ -= geopotentialAdjustmentWorkJ;
  const compatibilityProjectionGeopotentialVarianceAdjustmentJ =
    (finite(nativeTransportReceipt.final.geopotentialEnergyJ) -
      final.atmosphereGeopotentialEnergyJ) -
    (finite(nativeTransportReceipt.initial.geopotentialEnergyJ) -
      initial.atmosphereGeopotentialEnergyJ);
  residual.atmosphereGeopotentialEnergyResidualJ +=
    compatibilityProjectionGeopotentialVarianceAdjustmentJ;
  residual.oceanFreshwaterResidualKg -= runoffRouting.deliveredToOceanKg;
  residual.runoffQueueResidualKg += runoffRouting.deliveredToOceanKg;
  for (const [element, suffix] of Object.entries({
    carbon: 'Carbon',
    nitrogen: 'Nitrogen',
    phosphorus: 'Phosphorus',
    oxygen: 'Oxygen',
    alkalinity: 'Alkalinity'
  })) {
    const delivered = runoffRouting.oceanBiogeochemistryElementsKg[element];
    residual[`runoffBiogeochemistry${suffix}ResidualKg`] += delivered;
    residual[`oceanEcology${suffix}ResidualKg`] -= delivered;
    residual[`runoffReceivingOcean${suffix}ResidualKg`] -= delivered;
  }
  for (const [grain, suffix] of Object.entries({
    clay: 'Clay', silt: 'Silt', sand: 'Sand', gravel: 'Gravel'
  })) {
    const delivered = runoffRouting.oceanSedimentGrainsKg[grain];
    residual[`runoffSediment${suffix}ResidualKg`] += delivered;
    residual[`coastalSediment${suffix}ResidualKg`] -= delivered;
  }
  const atmosphereMassReceipts = nativeTransportReceipt.massRouteReceipts;
  const oceanEcologyReceipts = boundedOceanEcology
    .map(transfer => ({
      schema: OCEAN_ECOLOGY_TRANSPORT_RECEIPT_SCHEMA,
      edgeId: transfer.edgeId,
      poolId: transfer.poolId,
      element: transfer.element,
      donorCellId: transfer.donorId,
      receiverCellId: transfer.receiverId,
      amountKg: round(transfer.amount, 9),
      simultaneous: true
    }))
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId) ||
      a.poolId.localeCompare(b.poolId) ||
      a.donorCellId.localeCompare(b.donorCellId));
  const oceanEcologyTransferTotals = Object.fromEntries(
    ['carbon', 'nitrogen', 'phosphorus', 'oxygen', 'alkalinity']
      .map(element => [element,
      round(oceanEcologyReceipts
        .filter(entry => entry.element === element)
        .reduce((total, entry) => total + entry.amountKg, 0), 6)]));
  const receipt = {
    schema: EARTH_TRANSPORT_STEP_SCHEMA,
    graphSchema: EARTH_TRANSPORT_GRAPH_SCHEMA,
    profileId,
    durationDays: round(duration),
    columnCount: sorted.length,
    activeEdgeCount: activeEdges.length,
    skippedEdges,
    boundaryReceipts: boundaries,
    nativePressureTransportReceipt: nativeTransportReceipt,
    atmosphereMassReceipts,
    atmosphereTracerReceipts: nativeTransportReceipt.tracerRouteReceipts,
    atmosphereImpulseReceipts: nativeTransportReceipt.impulseReceipts,
    atmosphereCoriolisReceipts: nativeTransportReceipt.coriolisReceipts,
    atmosphereBiogeochemistryTransportReceipt:
      atmosphereBiogeochemistryTransport.receipt,
    atmosphereBiogeochemistryRouteReceipts:
      atmosphereBiogeochemistryTransport.receipt.routes,
    oceanEcologyReceipts,
    runoffReceipts: runoffRouting.receipts,
    transfers: {
      atmosphereDryAirKg: nativeTransportReceipt.transfers.dryAirKg,
      atmosphereBoundaryDryAirKg: nativeTransportReceipt.transfers.boundaryDryAirKg,
      atmosphereFreeDryAirKg: nativeTransportReceipt.transfers.freeDryAirKg,
      atmosphereWaterKg: nativeTransportReceipt.transfers.vaporWaterKg +
        nativeTransportReceipt.transfers.cloudWaterKg +
        nativeTransportReceipt.transfers.cloudIceKg,
      atmosphereVaporWaterKg: nativeTransportReceipt.transfers.vaporWaterKg,
      atmosphereBoundaryVaporWaterKg:
        nativeTransportReceipt.transfers.boundaryVaporWaterKg,
      atmosphereFreeVaporWaterKg: nativeTransportReceipt.transfers.freeVaporWaterKg,
      atmosphereCloudWaterKg: nativeTransportReceipt.transfers.cloudWaterKg,
      atmosphereBoundaryCloudWaterKg:
        nativeTransportReceipt.transfers.boundaryCloudWaterKg,
      atmosphereFreeCloudWaterKg: nativeTransportReceipt.transfers.freeCloudWaterKg,
      atmosphereCloudIceKg: nativeTransportReceipt.transfers.cloudIceKg,
      atmosphereBoundaryCloudIceKg:
        nativeTransportReceipt.transfers.boundaryCloudIceKg,
      atmosphereFreeCloudIceKg: nativeTransportReceipt.transfers.freeCloudIceKg,
      atmosphereBiogeochemistryCarbonKgC:
        atmosphereBiogeochemistryTransport.receipt.transfers.carbonKgC,
      atmosphereBiogeochemistryOxygenKgO2:
        atmosphereBiogeochemistryTransport.receipt.transfers.oxygenKgO2,
      atmosphereBiogeochemistryNitrogenKgN:
        atmosphereBiogeochemistryTransport.receipt.transfers.nitrogenKgN,
      atmosphereHeatJ: nativeTransportReceipt.transfers.sensibleHeatJ,
      atmosphereBoundaryHeatJ: nativeTransportReceipt.transfers.boundarySensibleHeatJ,
      atmosphereFreeHeatJ: nativeTransportReceipt.transfers.freeSensibleHeatJ,
      pressureForcingEastwardKgMps: round(pressureForcing.eastwardKgMps, 3),
      pressureForcingNorthwardKgMps: round(pressureForcing.northwardKgMps, 3),
      coriolisForcingEastwardKgMps: round(coriolisForcing.eastwardKgMps, 3),
      coriolisForcingNorthwardKgMps: round(coriolisForcing.northwardKgMps, 3),
      boundaryPressureImpulseLimiterScale:
        nativeTransportReceipt.transfers.pressureImpulseLimiterScale,
      freePressureImpulseLimiterScale:
        nativeTransportReceipt.transfers.pressureImpulseLimiterScale,
      pressureImpulseLimiterScale:
        nativeTransportReceipt.transfers.pressureImpulseLimiterScale,
      momentumMixingDissipationJ: round(totalMomentumMixingDissipationJ, 3),
      boundaryMomentumMixingDissipationJ: round(boundaryMomentumMixingDissipationJ, 3),
      freeMomentumMixingDissipationJ: round(freeMomentumMixingDissipationJ, 3),
      pressureWorkJ: round(totalPressureWorkJ, 3),
      boundaryPressureWorkJ: round(boundaryPressureWorkJ, 3),
      freePressureWorkJ: round(freePressureWorkJ, 3),
      coriolisWorkJ: round(totalCoriolisWorkJ, 3),
      boundaryCoriolisWorkJ: round(boundaryCoriolisWorkJ, 3),
      freeCoriolisWorkJ: round(freeCoriolisWorkJ, 3),
      compatibilityProjectionKineticVarianceAdjustmentJ: round(
        compatibilityProjectionKineticVarianceAdjustmentJ,
        3
      ),
      boundaryCompatibilityProjectionKineticVarianceAdjustmentJ: round(
        boundaryCompatibilityProjectionKineticVarianceAdjustmentJ,
        3
      ),
      freeCompatibilityProjectionKineticVarianceAdjustmentJ: round(
        freeCompatibilityProjectionKineticVarianceAdjustmentJ,
        3
      ),
      compatibilityProjectionGeopotentialVarianceAdjustmentJ: round(
        compatibilityProjectionGeopotentialVarianceAdjustmentJ,
        3
      ),
      geopotentialAdjustmentWorkJ: round(geopotentialAdjustmentWorkJ, 3),
      geopotentialRouteWorkJ:
        nativeTransportReceipt.transfers.geopotentialRouteWorkJ,
      hydrostaticGeometryAdjustmentJ:
        nativeTransportReceipt.transfers.hydrostaticGeometryAdjustmentJ,
      groundwaterKg: transferTotals(boundedGroundwater),
      oceanFreshwaterKg: transferTotals(cleanOceanFreshwater),
      oceanHeatJ: transferTotals(cleanOceanHeat),
      oceanEcologyCarbonKg: oceanEcologyTransferTotals.carbon,
      oceanEcologyNitrogenKg: oceanEcologyTransferTotals.nitrogen,
      oceanEcologyPhosphorusKg: oceanEcologyTransferTotals.phosphorus,
      oceanEcologyOxygenKg: oceanEcologyTransferTotals.oxygen,
      oceanEcologyAlkalinityKg: oceanEcologyTransferTotals.alkalinity,
      runoffRoutedKg: round(runoffRouting.routedKg, 3),
      runoffDeliveredToOceanKg: round(runoffRouting.deliveredToOceanKg, 3),
      runoffBiogeochemistryCarbonKg: round(
        runoffRouting.biogeochemistryElementsKg.carbon, 9),
      runoffBiogeochemistryNitrogenKg: round(
        runoffRouting.biogeochemistryElementsKg.nitrogen, 9),
      runoffBiogeochemistryPhosphorusKg: round(
        runoffRouting.biogeochemistryElementsKg.phosphorus, 9),
      runoffBiogeochemistryOxygenKg: round(
        runoffRouting.biogeochemistryElementsKg.oxygen, 9),
      runoffBiogeochemistryAlkalinityKg: round(
        runoffRouting.biogeochemistryElementsKg.alkalinity, 9),
      runoffSedimentKg: round(runoffRouting.sedimentKg, 9),
      runoffSedimentClayKg: round(
        runoffRouting.sedimentGrainsKg.clay, 9),
      runoffSedimentSiltKg: round(
        runoffRouting.sedimentGrainsKg.silt, 9),
      runoffSedimentSandKg: round(
        runoffRouting.sedimentGrainsKg.sand, 9),
      runoffSedimentGravelKg: round(
        runoffRouting.sedimentGrainsKg.gravel, 9),
      runoffSedimentDeliveredToOceanKg: round(
        runoffRouting.oceanSedimentKg, 9)
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
      cloudIceWaterTransportConservative: true,
      mixedPhaseWaterTransportConservative: true,
      moistEnthalpyTransportConservative: true,
      surfacePressureRepresentsDryAirColumnMass: true,
      dryAirMassExchangeConservative: true,
      transportedMomentumConservative: true,
      pressureGradientMomentumForcingReceipted: true,
      loadedDomainTangentMomentumLedger: true,
      coriolisDeflectionReceipted: true,
      coriolisKineticEnergyNeutral: true,
      atmosphericKineticEnergyLedger: true,
      nativePressureLevelHorizontalTransport: true,
      allEightNativePressureLevelsTransported: true,
      nativeLayerSenderReceiverReceipts: true,
      nativeLayerPressureGradientForcingReceipted: true,
      nativeLayerCoriolisReceipted: true,
      nativeLayerResolvedEnergyLedger: true,
      compatibilityBandsAreProjection: true,
      compatibilityBandKineticVarianceReceipted: true,
      compatibilityBandGeopotentialVarianceReceipted: true,
      boundaryLayerHorizontalTransport: true,
      upperAirHorizontalTransport: true,
      independentLayerMomentumTransport: true,
      dryAirCarriesLayerTracersAndSensibleEnthalpy: true,
      loadedAtmosphericBiogeochemistryTransport: true,
      nativePressureLayerAtmosphericBiogeochemistryTransport: true,
      wholeColumnAverageAtmosphericGasTransport: false,
      atmosphericBiogeochemistryConservative:
        atmosphereBiogeochemistryTransport.receipt.truth
          .carbonOxygenNitrogenConservative,
      globalAtmosphericBiogeochemistryMixing: false,
      variableHydrostaticLayerPressurePartition: true,
      terrainFollowingGeopotentialAdjustmentReceipted: true,
      loadedOceanBiogeochemicalTracerMixing: true,
      oceanBiogeochemicalElementLedgers: true,
      oceanAlkalinityTransportConservative: Math.abs(
        residual.oceanEcologyAlkalinityResidualKg) < 1,
      buoyancyConversionResolved: false,
      runoffQueueRoutedByTopography: true,
      persistentRunoffBiogeochemistryQueue: true,
      runoffBiogeochemistryMovesWithSameWaterFraction: true,
      runoffBiogeochemistrySenderDebited: true,
      landAndOceanRunoffReceiversCredited: true,
      persistentRunoffSedimentQueue: true,
      runoffSedimentMovesWithSameWaterFraction: true,
      runoffSedimentSenderDebited: true,
      landAndCoastalSedimentReceiversCredited: true,
      runoffSedimentConservative: Object.entries(residual)
        .filter(([key]) => /^(runoff|coastal)Sediment.*ResidualKg$/.test(key))
        .every(([, value]) => Math.abs(value) < 1),
      parameterizedLandRunoffChemistryBoundary: false,
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
    oceanEcologyTransportReceiptSchema: OCEAN_ECOLOGY_TRANSPORT_RECEIPT_SCHEMA,
    atmosphereBiogeochemistryTransport:
      atmosphereBiogeochemistryTransportDescription(),
    geomorphicSediment: geomorphicSedimentDescription(),
    nativePressureTransport: pressureHorizontalTransportDescription(),
    atmospherePressureTransportReceiptSchema:
      ATMOSPHERE_PRESSURE_HORIZONTAL_TRANSPORT_SCHEMA,
    atmosphereMassRouteReceiptSchema: ATMOSPHERE_PRESSURE_LAYER_MASS_ROUTE_SCHEMA,
    atmosphereTracerRouteReceiptSchema: ATMOSPHERE_PRESSURE_LAYER_TRACER_ROUTE_SCHEMA,
    atmospherePressureImpulseReceiptSchema: ATMOSPHERE_PRESSURE_LAYER_IMPULSE_SCHEMA,
    atmosphereCoriolisReceiptSchema: ATMOSPHERE_PRESSURE_LAYER_CORIOLIS_SCHEMA,
    atmosphereGeopotentialRouteReceiptSchema:
      ATMOSPHERE_PRESSURE_LAYER_GEOPOTENTIAL_ROUTE_SCHEMA,
    atmosphereColumnLocalReceiptSchema:
      ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA,
    legacyAtmosphereMassRouteReceiptSchema: EARTH_ATMOSPHERE_MASS_ROUTE_SCHEMA,
    legacyAtmospherePressureImpulseReceiptSchema: EARTH_ATMOSPHERE_IMPULSE_SCHEMA,
    legacyAtmosphereCoriolisReceiptSchema: EARTH_ATMOSPHERE_CORIOLIS_SCHEMA,
    topology: 'cardinal neighbors on canonical spherical surface cells with dateline wrapping',
    processes: ['eight-native-pressure-level-dry-air-advection', 'native-dry-air-carried-momentum-vapor-cloud-and-sensible-enthalpy', 'level-specific-loaded-atmosphere-carbon-oxygen-and-nitrogen-gas-advection', 'eight-level-pressure-gradient-forcing', 'eight-level-rotation-aware-coriolis-deflection', 'eight-level-atmospheric-kinetic-and-resolved-energy-ledgers', 'native-level-vapor-cloud-and-sensible-heat-mixing', 'native-level-terrain-and-hydrostatic-geopotential-adjustment-work', 'native-level-moist-enthalpy-ledger', 'hydraulic-head-groundwater-flow', 'ocean-freshwater-mixing', 'ocean-mixed-layer-heat-mixing', 'ocean-carbon-nitrogen-phosphorus-oxygen-alkalinity-and-plankton-mixing', 'topographic-runoff-routing', 'same-fraction-runoff-carbon-nitrogen-phosphorus-oxygen-and-alkalinity-routing', 'same-fraction-runoff-clay-silt-sand-and-gravel-routing', 'direct-land-runoff-to-ocean-biogeochemistry-credit', 'direct-land-runoff-to-coastal-sediment-credit'],
    simultaneous: true,
    cellAreaWeighted: true,
    explicitSparseBoundaries: true,
    tangentMomentumConservativeAfterDeclaredPressureAndCoriolisForcing: true,
    coriolisUsesPlanetRotationAndLatitude: true,
    coriolisChangesDirectionWithoutDoingWork: true,
    cloudLiquidWaterTransportConservative: true,
    moistEnthalpyTransportConservative: true,
    nativePressureLevelHorizontalTransport: true,
    allEightNativePressureLevelsTransported: true,
    compatibilityBandsAreProjection: true,
    boundaryLayerHorizontalTransport: true,
    upperAirHorizontalTransport: true,
    loadedAtmosphericBiogeochemistryTransport: true,
    globallyMixedAtmosphericBiogeochemistry: false,
    independentLayerMomentumTransport: true,
    variableHydrostaticLayerPressurePartition: true,
    terrainFollowingGeopotentialAdjustmentReceipted: true,
    loadedOceanBiogeochemicalTracerMixing: true,
    oceanBiogeochemicalElementLedgers: true,
    persistentRunoffBiogeochemistryQueue: true,
    parameterizedLandRunoffChemistryBoundary: false,
    buoyancyConversionResolved: false,
    maximumStepDays: 1,
    globalCirculationModel: false,
    globalAngularMomentumModel: false,
    scientificForecast: false
  };
}
