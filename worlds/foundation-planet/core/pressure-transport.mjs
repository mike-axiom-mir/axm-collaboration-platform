import { PLANET_DEFAULTS } from './planet-model.mjs';
import {
  ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
  PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K,
  PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG,
  normalizePressureColumn,
  pressureColumnTotals,
  projectNativePressureColumnToLegacy,
  validatePressureColumn
} from './pressure-column.mjs';

export const ATMOSPHERE_PRESSURE_HORIZONTAL_TRANSPORT_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-horizontal-transport-receipt/v2';
export const ATMOSPHERE_PRESSURE_LAYER_MASS_ROUTE_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-layer-horizontal-mass-route-receipt/v1';
export const ATMOSPHERE_PRESSURE_LAYER_TRACER_ROUTE_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-layer-horizontal-tracer-route-receipt/v2';
export const ATMOSPHERE_PRESSURE_LAYER_IMPULSE_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-layer-horizontal-impulse-receipt/v1';
export const ATMOSPHERE_PRESSURE_LAYER_CORIOLIS_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-layer-horizontal-coriolis-receipt/v1';
export const ATMOSPHERE_PRESSURE_LAYER_GEOPOTENTIAL_ROUTE_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-layer-horizontal-geopotential-route-receipt/v1';
export const ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA =
  'axm.foundation-planet.atmosphere-pressure-column-horizontal-local-receipt/v2';

const STANDARD_GRAVITY_MPS2 = 9.80665;
const LATENT_HEAT_VAPORIZATION_J_KG = 2.45e6;
const ABSOLUTE_ZERO_OFFSET_K = 273.15;
const DAY_SECONDS = 86_400;
const MIN_SURFACE_PRESSURE_HPA = 850;
const MAX_SURFACE_PRESSURE_HPA = 1085;
const MIN_LAYER_PRESSURE_HPA = .05;
const MAX_LAYER_PRESSURE_HPA = 420;
const MAX_WIND_SPEED_MPS = 90;
const MIN_BOUNDARY_VAPOR_MM = .2;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 9) => Number(Number(value).toFixed(digits));
const clone = value => JSON.parse(JSON.stringify(value));

function stableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

const layerKey = (cellId, layerIndex) => `${cellId}:${layerIndex}`;

function transferProposal(kind, aId, bId, signedAmount, metadata = {}) {
  if (Math.abs(signedAmount) < 1e-12) return null;
  return signedAmount > 0
    ? { kind, donorId: aId, receiverId: bId, amount: signedAmount, ...metadata }
    : { kind, donorId: bId, receiverId: aId, amount: -signedAmount, ...metadata };
}

function windProjection(layer, axis, directionSign) {
  return (axis === 'east-west'
    ? finite(layer.eastwardWindMps)
    : finite(layer.northwardWindMps)) * directionSign;
}

function snapshotLayers(columns, areas) {
  const snapshots = new Map();
  for (const column of columns) {
    if (!validatePressureColumn(column?.atmosphere?.pressureColumn)) {
      throw new Error(`Native horizontal transport requires a valid pressure column: ${column?.id || 'unknown'}`);
    }
    const areaM2 = areas.get(column.id);
    if (!(areaM2 > 0)) throw new Error(`Native horizontal transport requires cell area: ${column.id}`);
    const boundaryPressureHpa = column.atmosphere.pressureColumn.layers.slice(0, 2)
      .reduce((sum, layer) => sum + layer.pressureThicknessHpa, 0);
    for (let index = 0; index < ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT; index++) {
      const layer = column.atmosphere.pressureColumn.layers[index];
      const massKg = layer.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2 * areaM2;
      const vaporKg = finite(layer.vaporWaterMm) * areaM2;
      const cloudKg = finite(layer.cloudWaterMm) * areaM2;
      const cloudIceKg = finite(layer.cloudIceMm) * areaM2;
      snapshots.set(layerKey(column.id, index), {
        cellId: column.id,
        layerId: layer.id,
        layerIndex: index,
        bandId: layer.bandId,
        areaM2,
        pressureThicknessHpa: layer.pressureThicknessHpa,
        boundaryPressureHpa,
        massKg,
        vaporKg,
        cloudKg,
        cloudIceKg,
        absoluteSensibleHeatJ: (finite(layer.airTemperatureC) + ABSOLUTE_ZERO_OFFSET_K) *
          massKg * PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K,
        airTemperatureC: finite(layer.airTemperatureC),
        eastwardWindMps: finite(layer.eastwardWindMps),
        northwardWindMps: finite(layer.northwardWindMps),
        centerHeightM: finite(layer.centerHeightM)
      });
    }
  }
  return snapshots;
}

function scaleMap(transfers, keyOf) {
  const totals = new Map();
  for (const transfer of transfers) {
    const key = keyOf(transfer);
    totals.set(key, (totals.get(key) || 0) + transfer.amount);
  }
  return totals;
}

function constrainMassTransfers(transfers, snapshots, columnsById, areas) {
  const outgoingLayer = scaleMap(transfers, transfer =>
    layerKey(transfer.donorId, transfer.layerIndex));
  const incomingLayer = scaleMap(transfers, transfer =>
    layerKey(transfer.receiverId, transfer.layerIndex));
  const outgoingColumn = scaleMap(transfers, transfer => transfer.donorId);
  const incomingColumn = scaleMap(transfers, transfer => transfer.receiverId);
  const donorLayerScale = new Map();
  const receiverLayerScale = new Map();
  const donorColumnScale = new Map();
  const receiverColumnScale = new Map();
  for (const [key, amount] of outgoingLayer) {
    const state = snapshots.get(key);
    const minimumMassKg = MIN_LAYER_PRESSURE_HPA * 100 / STANDARD_GRAVITY_MPS2 *
      state.areaM2;
    donorLayerScale.set(key, Math.min(1,
      Math.max(0, state.massKg - minimumMassKg) / Math.max(1e-12, amount)));
  }
  for (const [key, amount] of incomingLayer) {
    const state = snapshots.get(key);
    const maximumMassKg = MAX_LAYER_PRESSURE_HPA * 100 / STANDARD_GRAVITY_MPS2 *
      state.areaM2;
    receiverLayerScale.set(key, Math.min(1,
      Math.max(0, maximumMassKg - state.massKg) / Math.max(1e-12, amount)));
  }
  for (const [cellId, amount] of outgoingColumn) {
    const areaM2 = areas.get(cellId);
    const totalMassKg = columnsById.get(cellId).atmosphere.pressureColumn.layers
      .reduce((sum, _layer, index) => sum + snapshots.get(layerKey(cellId, index)).massKg, 0);
    const minimumMassKg = MIN_SURFACE_PRESSURE_HPA * 100 / STANDARD_GRAVITY_MPS2 * areaM2;
    donorColumnScale.set(cellId, Math.min(1,
      Math.max(0, totalMassKg - minimumMassKg) / Math.max(1e-12, amount)));
  }
  for (const [cellId, amount] of incomingColumn) {
    const areaM2 = areas.get(cellId);
    const totalMassKg = columnsById.get(cellId).atmosphere.pressureColumn.layers
      .reduce((sum, _layer, index) => sum + snapshots.get(layerKey(cellId, index)).massKg, 0);
    const maximumMassKg = MAX_SURFACE_PRESSURE_HPA * 100 / STANDARD_GRAVITY_MPS2 * areaM2;
    receiverColumnScale.set(cellId, Math.min(1,
      Math.max(0, maximumMassKg - totalMassKg) / Math.max(1e-12, amount)));
  }
  return transfers.map(transfer => ({
    ...transfer,
    amount: transfer.amount * Math.min(
      donorLayerScale.get(layerKey(transfer.donorId, transfer.layerIndex)) ?? 1,
      receiverLayerScale.get(layerKey(transfer.receiverId, transfer.layerIndex)) ?? 1,
      donorColumnScale.get(transfer.donorId) ?? 1,
      receiverColumnScale.get(transfer.receiverId) ?? 1
    )
  })).filter(transfer => transfer.amount > 1e-9);
}

function constrainReservoirTransfers(transfers, snapshots, field, minimum = () => 0) {
  const outgoing = scaleMap(transfers, transfer =>
    layerKey(transfer.donorId, transfer.layerIndex));
  const scales = new Map();
  for (const [key, amount] of outgoing) {
    const state = snapshots.get(key);
    scales.set(key, Math.min(1,
      Math.max(0, finite(state[field]) - Math.max(0, minimum(state))) /
        Math.max(1e-12, amount)));
  }
  return transfers.map(transfer => ({
    ...transfer,
    amount: transfer.amount * (scales.get(
      layerKey(transfer.donorId, transfer.layerIndex)
    ) ?? 1)
  })).filter(transfer => transfer.amount > 1e-9);
}

function proposalSet(columnsById, activeEdges, areas, snapshots, durationDays) {
  const mass = [];
  const vaporMixing = [];
  const cloudMixing = [];
  const cloudIceMixing = [];
  const heatMixing = [];
  const impulses = [];
  for (const edge of activeEdges) {
    const a = columnsById.get(edge.aId);
    const b = columnsById.get(edge.bId);
    const areaA = areas.get(a.id);
    const areaB = areas.get(b.id);
    const sharedAreaM2 = Math.min(areaA, areaB);
    for (let index = 0; index < ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT; index++) {
      const layerA = a.atmosphere.pressureColumn.layers[index];
      const layerB = b.atmosphere.pressureColumn.layers[index];
      const stateA = snapshots.get(layerKey(a.id, index));
      const stateB = snapshots.get(layerKey(b.id, index));
      const projectedWindMps = (
        windProjection(layerA, edge.axis, edge.aToBSign) +
        windProjection(layerB, edge.axis, edge.aToBSign)
      ) * .5;
      const signedCourant = clamp(
        projectedWindMps * durationDays * DAY_SECONDS /
          Math.max(1, edge.centerDistanceM) * .06,
        -.08,
        .08
      );
      const pressureDifferenceHpa = layerA.pressureThicknessHpa -
        layerB.pressureThicknessHpa;
      const pressureMassKg = pressureDifferenceHpa * 100 / STANDARD_GRAVITY_MPS2 *
        sharedAreaM2 * (.015 + index * .0015) * durationDays;
      const advectiveMassKg = signedCourant * Math.min(stateA.massKg, stateB.massKg);
      const route = transferProposal(
        'native-pressure-layer-dry-air',
        a.id,
        b.id,
        pressureMassKg + advectiveMassKg,
        {
          edgeId: edge.id,
          layerId: layerA.id,
          layerIndex: index,
          axis: edge.axis,
          pressureDifferenceHpa,
          projectedWindMps,
          signedCourant
        }
      );
      if (route) {
        route.transferId = `${edge.id}:${layerA.id}:${route.donorId}>${route.receiverId}`;
        mass.push(route);
      }

      const mixingFraction = clamp(
        .006 * durationDays + Math.abs(signedCourant) * .12,
        0,
        .06
      );
      const grossMixingMassKg = Math.min(stateA.massKg, stateB.massKg) * mixingFraction;
      const metadata = {
        edgeId: edge.id,
        layerId: layerA.id,
        layerIndex: index,
        transportMode: 'equal-gross-native-layer-mixing',
        grossMixingMassKg
      };
      const vapor = transferProposal(
        'native-pressure-layer-vapor-mixing',
        a.id,
        b.id,
        grossMixingMassKg * (stateA.vaporKg / Math.max(1, stateA.massKg) -
          stateB.vaporKg / Math.max(1, stateB.massKg)),
        metadata
      );
      const cloud = transferProposal(
        'native-pressure-layer-cloud-mixing',
        a.id,
        b.id,
        grossMixingMassKg * (stateA.cloudKg / Math.max(1, stateA.massKg) -
          stateB.cloudKg / Math.max(1, stateB.massKg)),
        metadata
      );
      const cloudIce = transferProposal(
        'native-pressure-layer-cloud-ice-mixing',
        a.id,
        b.id,
        grossMixingMassKg * (stateA.cloudIceKg / Math.max(1, stateA.massKg) -
          stateB.cloudIceKg / Math.max(1, stateB.massKg)),
        metadata
      );
      const heat = transferProposal(
        'native-pressure-layer-sensible-heat-mixing',
        a.id,
        b.id,
        grossMixingMassKg * PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K *
          (stateA.airTemperatureC - stateB.airTemperatureC),
        metadata
      );
      if (vapor) vaporMixing.push(vapor);
      if (cloud) cloudMixing.push(cloud);
      if (cloudIce) cloudIceMixing.push(cloudIce);
      if (heat) heatMixing.push(heat);

      const pressureDrivenDeltaMps = clamp(
        pressureDifferenceHpa * (.018 + index * .0015) * durationDays,
        -8,
        8
      ) * edge.aToBSign;
      impulses.push({
        edgeId: edge.id,
        layerId: layerA.id,
        layerIndex: index,
        axis: edge.axis,
        pressureDifferenceHpa,
        aId: a.id,
        bId: b.id,
        aEastwardImpulseKgMps: edge.axis === 'east-west'
          ? stateA.massKg * pressureDrivenDeltaMps * .5 : 0,
        aNorthwardImpulseKgMps: edge.axis === 'north-south'
          ? stateA.massKg * pressureDrivenDeltaMps * .5 : 0,
        bEastwardImpulseKgMps: edge.axis === 'east-west'
          ? stateB.massKg * pressureDrivenDeltaMps * .5 : 0,
        bNorthwardImpulseKgMps: edge.axis === 'north-south'
          ? stateB.massKg * pressureDrivenDeltaMps * .5 : 0
      });
    }
  }
  return { mass, vaporMixing, cloudMixing, cloudIceMixing, heatMixing, impulses };
}

function advectedTracerTransfers(massTransfers, snapshots) {
  const vapor = [];
  const cloud = [];
  const cloudIce = [];
  const heat = [];
  for (const transfer of massTransfers) {
    const donor = snapshots.get(layerKey(transfer.donorId, transfer.layerIndex));
    const parcelFraction = clamp(transfer.amount / Math.max(1, donor.massKg), 0, 1);
    const metadata = {
      edgeId: transfer.edgeId,
      layerId: transfer.layerId,
      layerIndex: transfer.layerIndex,
      transportMode: 'native-dry-air-advection',
      sourceMassTransferId: transfer.transferId
    };
    vapor.push({
      kind: 'native-pressure-layer-vapor-advection',
      donorId: transfer.donorId,
      receiverId: transfer.receiverId,
      amount: donor.vaporKg * parcelFraction,
      ...metadata
    });
    cloud.push({
      kind: 'native-pressure-layer-cloud-advection',
      donorId: transfer.donorId,
      receiverId: transfer.receiverId,
      amount: donor.cloudKg * parcelFraction,
      ...metadata
    });
    cloudIce.push({
      kind: 'native-pressure-layer-cloud-ice-advection',
      donorId: transfer.donorId,
      receiverId: transfer.receiverId,
      amount: donor.cloudIceKg * parcelFraction,
      ...metadata
    });
    heat.push({
      kind: 'native-pressure-layer-sensible-enthalpy-advection',
      donorId: transfer.donorId,
      receiverId: transfer.receiverId,
      amount: donor.absoluteSensibleHeatJ * parcelFraction,
      ...metadata
    });
  }
  return { vapor, cloud, cloudIce, heat };
}

function applyMomentumDynamics(
  columns,
  columnsById,
  areas,
  snapshots,
  massTransfers,
  impulses,
  durationDays
) {
  const states = new Map();
  for (const column of columns) {
    for (let index = 0; index < ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT; index++) {
      const snapshot = snapshots.get(layerKey(column.id, index));
      states.set(layerKey(column.id, index), {
        ...snapshot,
        eastwardMomentumKgMps: snapshot.massKg * snapshot.eastwardWindMps,
        northwardMomentumKgMps: snapshot.massKg * snapshot.northwardWindMps,
        pressureEastwardImpulseKgMps: 0,
        pressureNorthwardImpulseKgMps: 0
      });
    }
  }
  const kineticByLevel = () => Array.from({ length: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT },
    (_unused, index) => [...states.values()].filter(state => state.layerIndex === index)
      .reduce((sum, state) => sum +
        (state.eastwardMomentumKgMps ** 2 + state.northwardMomentumKgMps ** 2) /
          Math.max(1, 2 * state.massKg), 0));
  const initialKineticByLevelJ = kineticByLevel();
  const massReceipts = [];
  const geopotentialRouteWorkByLevelJ = Array.from(
    { length: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT }, () => 0);
  for (const transfer of massTransfers) {
    const donor = states.get(layerKey(transfer.donorId, transfer.layerIndex));
    const receiver = states.get(layerKey(transfer.receiverId, transfer.layerIndex));
    const carriedEastwardMomentumKgMps = transfer.amount * donor.eastwardWindMps;
    const carriedNorthwardMomentumKgMps = transfer.amount * donor.northwardWindMps;
    const carriedGeopotentialEnergyJ = transfer.amount * STANDARD_GRAVITY_MPS2 *
      donor.centerHeightM;
    const adjustmentWorkJ = transfer.amount * STANDARD_GRAVITY_MPS2 *
      (receiver.centerHeightM - donor.centerHeightM);
    donor.massKg -= transfer.amount;
    receiver.massKg += transfer.amount;
    donor.eastwardMomentumKgMps -= carriedEastwardMomentumKgMps;
    receiver.eastwardMomentumKgMps += carriedEastwardMomentumKgMps;
    donor.northwardMomentumKgMps -= carriedNorthwardMomentumKgMps;
    receiver.northwardMomentumKgMps += carriedNorthwardMomentumKgMps;
    geopotentialRouteWorkByLevelJ[transfer.layerIndex] += adjustmentWorkJ;
    massReceipts.push({
      schema: ATMOSPHERE_PRESSURE_LAYER_MASS_ROUTE_SCHEMA,
      transferId: transfer.transferId,
      edgeId: transfer.edgeId,
      layerId: transfer.layerId,
      layerIndex: transfer.layerIndex,
      senderCellId: transfer.donorId,
      receiverCellId: transfer.receiverId,
      dryAirMassKg: round(transfer.amount, 3),
      senderDebitKg: round(transfer.amount, 3),
      receiverCreditKg: round(transfer.amount, 3),
      residualKg: 0,
      projectedWindMps: round(transfer.projectedWindMps, 9),
      signedCourant: round(transfer.signedCourant, 12),
      pressureDifferenceHpa: round(transfer.pressureDifferenceHpa, 12),
      carriedEastwardMomentumKgMps: round(carriedEastwardMomentumKgMps, 3),
      carriedNorthwardMomentumKgMps: round(carriedNorthwardMomentumKgMps, 3),
      geopotential: {
        schema: ATMOSPHERE_PRESSURE_LAYER_GEOPOTENTIAL_ROUTE_SCHEMA,
        senderHeightM: round(donor.centerHeightM, 6),
        receiverHeightM: round(receiver.centerHeightM, 6),
        carriedEnergyJ: round(carriedGeopotentialEnergyJ, 3),
        adjustmentWorkJ: round(adjustmentWorkJ, 3)
      }
    });
  }
  const afterMassKineticByLevelJ = kineticByLevel();
  for (const impulse of impulses) {
    const a = states.get(layerKey(impulse.aId, impulse.layerIndex));
    const b = states.get(layerKey(impulse.bId, impulse.layerIndex));
    a.pressureEastwardImpulseKgMps += impulse.aEastwardImpulseKgMps;
    a.pressureNorthwardImpulseKgMps += impulse.aNorthwardImpulseKgMps;
    b.pressureEastwardImpulseKgMps += impulse.bEastwardImpulseKgMps;
    b.pressureNorthwardImpulseKgMps += impulse.bNorthwardImpulseKgMps;
  }
  const fitsWindLimit = scale => [...states.values()].every(state => Math.hypot(
    (state.eastwardMomentumKgMps + state.pressureEastwardImpulseKgMps * scale) /
      Math.max(1, state.massKg),
    (state.northwardMomentumKgMps + state.pressureNorthwardImpulseKgMps * scale) /
      Math.max(1, state.massKg)
  ) <= MAX_WIND_SPEED_MPS + 1e-9);
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
  for (const state of states.values()) {
    state.eastwardMomentumKgMps += state.pressureEastwardImpulseKgMps * impulseScale;
    state.northwardMomentumKgMps += state.pressureNorthwardImpulseKgMps * impulseScale;
  }
  const afterPressureKineticByLevelJ = kineticByLevel();
  const rotationRateRadPerSecond = Math.PI * 2 / PLANET_DEFAULTS.dayLengthSeconds;
  const coriolisReceipts = [];
  for (const column of columns) {
    const latitudeRad = finite(column.coordinate?.latitudeDeg) * Math.PI / 180;
    const coriolisParameterPerSecond = 2 * rotationRateRadPerSecond * Math.sin(latitudeRad);
    const rotationRadians = coriolisParameterPerSecond * durationDays *
      PLANET_DEFAULTS.dayLengthSeconds;
    const cosine = Math.cos(rotationRadians);
    const sine = Math.sin(rotationRadians);
    for (let index = 0; index < ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT; index++) {
      const state = states.get(layerKey(column.id, index));
      const beforeEastwardMomentumKgMps = state.eastwardMomentumKgMps;
      const beforeNorthwardMomentumKgMps = state.northwardMomentumKgMps;
      const beforeKineticEnergyJ = (beforeEastwardMomentumKgMps ** 2 +
        beforeNorthwardMomentumKgMps ** 2) / Math.max(1, 2 * state.massKg);
      state.eastwardMomentumKgMps = beforeEastwardMomentumKgMps * cosine +
        beforeNorthwardMomentumKgMps * sine;
      state.northwardMomentumKgMps = -beforeEastwardMomentumKgMps * sine +
        beforeNorthwardMomentumKgMps * cosine;
      const afterKineticEnergyJ = (state.eastwardMomentumKgMps ** 2 +
        state.northwardMomentumKgMps ** 2) / Math.max(1, 2 * state.massKg);
      coriolisReceipts.push({
        schema: ATMOSPHERE_PRESSURE_LAYER_CORIOLIS_SCHEMA,
        layerId: state.layerId,
        layerIndex: index,
        cellId: column.id,
        latitudeDeg: round(column.coordinate.latitudeDeg, 9),
        coriolisParameterPerSecond: round(coriolisParameterPerSecond, 15),
        rotationRadians: round(rotationRadians, 12),
        eastwardImpulseKgMps: round(
          state.eastwardMomentumKgMps - beforeEastwardMomentumKgMps, 3),
        northwardImpulseKgMps: round(
          state.northwardMomentumKgMps - beforeNorthwardMomentumKgMps, 3),
        kineticEnergyChangeJ: round(afterKineticEnergyJ - beforeKineticEnergyJ, 3)
      });
    }
  }
  const afterCoriolisKineticByLevelJ = kineticByLevel();
  const rawMixingDissipationByLevelJ = initialKineticByLevelJ.map(
    (value, index) => value - afterMassKineticByLevelJ[index]
  );
  if (rawMixingDissipationByLevelJ.some(value => value < -1e-3)) {
    throw new Error('Native pressure transport would create unreceipted kinetic energy during parcel mixing');
  }
  for (const column of columns) {
    const areaM2 = areas.get(column.id);
    for (let index = 0; index < ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT; index++) {
      const state = states.get(layerKey(column.id, index));
      const layer = column.atmosphere.pressureColumn.layers[index];
      layer.pressureThicknessHpa = state.massKg * STANDARD_GRAVITY_MPS2 /
        areaM2 / 100;
      layer.eastwardWindMps = state.eastwardMomentumKgMps / state.massKg;
      layer.northwardWindMps = state.northwardMomentumKgMps / state.massKg;
    }
  }
  const impulseReceipts = impulses.map(impulse => ({
    schema: ATMOSPHERE_PRESSURE_LAYER_IMPULSE_SCHEMA,
    edgeId: impulse.edgeId,
    layerId: impulse.layerId,
    layerIndex: impulse.layerIndex,
    axis: impulse.axis,
    pressureDifferenceHpa: round(impulse.pressureDifferenceHpa, 12),
    aCellId: impulse.aId,
    bCellId: impulse.bId,
    aEastwardImpulseKgMps: round(impulse.aEastwardImpulseKgMps * impulseScale, 3),
    aNorthwardImpulseKgMps: round(impulse.aNorthwardImpulseKgMps * impulseScale, 3),
    bEastwardImpulseKgMps: round(impulse.bEastwardImpulseKgMps * impulseScale, 3),
    bNorthwardImpulseKgMps: round(impulse.bNorthwardImpulseKgMps * impulseScale, 3),
    limiterScale: round(impulseScale, 12)
  }));
  return {
    states,
    massReceipts,
    impulseReceipts,
    coriolisReceipts,
    impulseScale,
    initialKineticByLevelJ,
    afterMassKineticByLevelJ,
    afterPressureKineticByLevelJ,
    afterCoriolisKineticByLevelJ,
    mixingDissipationByLevelJ: rawMixingDissipationByLevelJ.map(value =>
      Math.max(0, value)),
    pressureWorkByLevelJ: afterPressureKineticByLevelJ.map((value, index) =>
      value - afterMassKineticByLevelJ[index]),
    coriolisWorkByLevelJ: afterCoriolisKineticByLevelJ.map((value, index) =>
      value - afterPressureKineticByLevelJ[index]),
    geopotentialRouteWorkByLevelJ
  };
}

function applyDeltas(transfers, snapshots, field, columnsById, areas) {
  const deltas = new Map();
  for (const transfer of transfers) {
    const donorKey = layerKey(transfer.donorId, transfer.layerIndex);
    const receiverKey = layerKey(transfer.receiverId, transfer.layerIndex);
    deltas.set(donorKey, (deltas.get(donorKey) || 0) - transfer.amount);
    deltas.set(receiverKey, (deltas.get(receiverKey) || 0) + transfer.amount);
  }
  for (const [key, snapshot] of snapshots) {
    const layer = columnsById.get(snapshot.cellId).atmosphere.pressureColumn
      .layers[snapshot.layerIndex];
    const value = Math.max(0, finite(snapshot[field]) + (deltas.get(key) || 0));
    if (field === 'vaporKg') layer.vaporWaterMm = value / areas.get(snapshot.cellId);
    else if (field === 'cloudKg') layer.cloudWaterMm = value / areas.get(snapshot.cellId);
    else if (field === 'cloudIceKg') layer.cloudIceMm = value / areas.get(snapshot.cellId);
  }
  return deltas;
}

function tracerReceipts(transfers, quantity, unit) {
  return transfers.map(transfer => ({
    schema: ATMOSPHERE_PRESSURE_LAYER_TRACER_ROUTE_SCHEMA,
    edgeId: transfer.edgeId,
    layerId: transfer.layerId,
    layerIndex: transfer.layerIndex,
    senderCellId: transfer.donorId,
    receiverCellId: transfer.receiverId,
    quantity,
    unit,
    amount: round(transfer.amount, 3),
    senderDebit: round(transfer.amount, 3),
    receiverCredit: round(transfer.amount, 3),
    residual: 0,
    transportMode: transfer.transportMode,
    sourceMassTransferId: transfer.sourceMassTransferId || null,
    grossMixingMassKg: round(finite(transfer.grossMixingMassKg), 3)
  }));
}

function domainTotals(columns, areas) {
  const totals = {
    dryAirMassKg: 0,
    vaporWaterKg: 0,
    cloudWaterKg: 0,
    cloudIceKg: 0,
    moistEnthalpyJ: 0,
    eastwardMomentumKgMps: 0,
    northwardMomentumKgMps: 0,
    horizontalKineticEnergyJ: 0,
    geopotentialEnergyJ: 0,
    resolvedEnergyJ: 0
  };
  for (const column of columns) {
    const areaM2 = areas.get(column.id);
    const local = pressureColumnTotals(column.atmosphere.pressureColumn);
    totals.dryAirMassKg += local.dryAirMassKgM2 * areaM2;
    totals.vaporWaterKg += local.vaporWaterMm * areaM2;
    totals.cloudWaterKg += local.cloudWaterMm * areaM2;
    totals.cloudIceKg += local.cloudIceMm * areaM2;
    totals.moistEnthalpyJ += local.moistEnthalpyJm2 * areaM2;
    totals.eastwardMomentumKgMps += local.eastwardMomentumKgMpsM2 * areaM2;
    totals.northwardMomentumKgMps += local.northwardMomentumKgMpsM2 * areaM2;
    totals.horizontalKineticEnergyJ += local.horizontalKineticEnergyJm2 * areaM2;
    totals.geopotentialEnergyJ += local.geopotentialEnergyJm2 * areaM2;
    totals.resolvedEnergyJ += local.resolvedEnergyJm2 * areaM2;
  }
  return totals;
}

function levelTotals(columns, areas, index) {
  const totals = {
    dryAirMassKg: 0,
    vaporWaterKg: 0,
    cloudWaterKg: 0,
    cloudIceKg: 0,
    moistEnthalpyJ: 0,
    eastwardMomentumKgMps: 0,
    northwardMomentumKgMps: 0,
    horizontalKineticEnergyJ: 0,
    geopotentialEnergyJ: 0,
    resolvedEnergyJ: 0
  };
  for (const column of columns) {
    const areaM2 = areas.get(column.id);
    const layer = column.atmosphere.pressureColumn.layers[index];
    const massKg = layer.pressureThicknessHpa * 100 / STANDARD_GRAVITY_MPS2 * areaM2;
    const moistEnthalpyJ = layer.airTemperatureC * massKg *
      PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K +
      layer.vaporWaterMm * areaM2 * LATENT_HEAT_VAPORIZATION_J_KG;
    const phaseEnthalpyJ = -layer.cloudIceMm * areaM2 *
      PRESSURE_COLUMN_LATENT_HEAT_FUSION_J_KG;
    const kineticJ = .5 * massKg *
      (layer.eastwardWindMps ** 2 + layer.northwardWindMps ** 2);
    const geopotentialJ = massKg * STANDARD_GRAVITY_MPS2 * layer.centerHeightM;
    totals.dryAirMassKg += massKg;
    totals.vaporWaterKg += layer.vaporWaterMm * areaM2;
    totals.cloudWaterKg += layer.cloudWaterMm * areaM2;
    totals.cloudIceKg += layer.cloudIceMm * areaM2;
    totals.moistEnthalpyJ += moistEnthalpyJ + phaseEnthalpyJ;
    totals.eastwardMomentumKgMps += massKg * layer.eastwardWindMps;
    totals.northwardMomentumKgMps += massKg * layer.northwardWindMps;
    totals.horizontalKineticEnergyJ += kineticJ;
    totals.geopotentialEnergyJ += geopotentialJ;
    totals.resolvedEnergyJ += moistEnthalpyJ + phaseEnthalpyJ + kineticJ + geopotentialJ;
  }
  return totals;
}

function roundedTotals(totals) {
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value, 3)]));
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function transferTotal(transfers, predicate = () => true) {
  return transfers.filter(predicate).reduce((total, transfer) => total + transfer.amount, 0);
}

function forcingTotals(receipts) {
  return receipts.reduce((totals, receipt) => {
    totals.eastwardKgMps += finite(receipt.aEastwardImpulseKgMps) +
      finite(receipt.bEastwardImpulseKgMps);
    totals.northwardKgMps += finite(receipt.aNorthwardImpulseKgMps) +
      finite(receipt.bNorthwardImpulseKgMps);
    return totals;
  }, { eastwardKgMps: 0, northwardKgMps: 0 });
}

function coriolisTotals(receipts) {
  return receipts.reduce((totals, receipt) => {
    totals.eastwardKgMps += finite(receipt.eastwardImpulseKgMps);
    totals.northwardKgMps += finite(receipt.northwardImpulseKgMps);
    return totals;
  }, { eastwardKgMps: 0, northwardKgMps: 0 });
}

function carriedTotalsByMassId(transfers) {
  const totals = new Map();
  for (const transfer of transfers) {
    if (!transfer.sourceMassTransferId) continue;
    totals.set(transfer.sourceMassTransferId,
      (totals.get(transfer.sourceMassTransferId) || 0) + transfer.amount);
  }
  return totals;
}

export function transportNativePressureColumns(
  columns,
  activeEdges,
  areas,
  durationDays,
  options = {}
) {
  if (!Array.isArray(columns) || !columns.length) {
    throw new Error('Native pressure transport requires loaded columns');
  }
  const duration = finite(durationDays);
  if (!(duration > 0) || duration > 1.000001) {
    throw new Error('Native pressure transport step must be greater than zero and no longer than one day');
  }
  const columnsById = new Map(columns.map(column => [column.id, column]));
  const snapshots = snapshotLayers(columns, areas);
  const initial = domainTotals(columns, areas);
  const initialByLevel = Array.from(
    { length: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT },
    (_unused, index) => levelTotals(columns, areas, index)
  );
  const proposals = proposalSet(columnsById, activeEdges, areas, snapshots, duration);
  const massTransfers = constrainMassTransfers(
    proposals.mass,
    snapshots,
    columnsById,
    areas
  );
  const advected = advectedTracerTransfers(massTransfers, snapshots);
  const boundaryVaporMinimumKg = state => state.layerIndex < 2
    ? MIN_BOUNDARY_VAPOR_MM * state.pressureThicknessHpa /
      Math.max(1e-12, state.boundaryPressureHpa) * state.areaM2
    : 0;
  const vaporTransfers = constrainReservoirTransfers(
    [...proposals.vaporMixing, ...advected.vapor],
    snapshots,
    'vaporKg',
    boundaryVaporMinimumKg
  );
  const cloudTransfers = constrainReservoirTransfers(
    [...proposals.cloudMixing, ...advected.cloud],
    snapshots,
    'cloudKg'
  );
  const cloudIceTransfers = constrainReservoirTransfers(
    [...proposals.cloudIceMixing, ...advected.cloudIce],
    snapshots,
    'cloudIceKg'
  );
  const heatTransfers = constrainReservoirTransfers(
    [...proposals.heatMixing, ...advected.heat],
    snapshots,
    'absoluteSensibleHeatJ',
    state => state.absoluteSensibleHeatJ * .45
  );
  const momentum = applyMomentumDynamics(
    columns,
    columnsById,
    areas,
    snapshots,
    massTransfers,
    proposals.impulses,
    duration
  );
  applyDeltas(vaporTransfers, snapshots, 'vaporKg', columnsById, areas);
  applyDeltas(cloudTransfers, snapshots, 'cloudKg', columnsById, areas);
  applyDeltas(cloudIceTransfers, snapshots, 'cloudIceKg', columnsById, areas);
  const heatDeltas = new Map();
  for (const transfer of heatTransfers) {
    const donorKey = layerKey(transfer.donorId, transfer.layerIndex);
    const receiverKey = layerKey(transfer.receiverId, transfer.layerIndex);
    heatDeltas.set(donorKey, (heatDeltas.get(donorKey) || 0) - transfer.amount);
    heatDeltas.set(receiverKey, (heatDeltas.get(receiverKey) || 0) + transfer.amount);
  }
  for (let index = 0; index < ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT; index++) {
    const states = [...momentum.states.values()].filter(state => state.layerIndex === index);
    const totalMassKg = states.reduce((total, state) => total + state.massKg, 0);
    for (const state of states) {
      const key = layerKey(state.cellId, index);
      const layer = columnsById.get(state.cellId).atmosphere.pressureColumn.layers[index];
      const thermalizedJ = momentum.mixingDissipationByLevelJ[index] *
        state.massKg / Math.max(1, totalMassKg);
      const absoluteHeatJ = snapshots.get(key).absoluteSensibleHeatJ +
        (heatDeltas.get(key) || 0) + thermalizedJ;
      layer.airTemperatureC = absoluteHeatJ /
        Math.max(1, state.massKg * PRESSURE_COLUMN_DRY_AIR_HEAT_CAPACITY_J_KG_K) -
        ABSOLUTE_ZERO_OFFSET_K;
    }
  }

  const projectionReceipts = [];
  for (const column of columns) {
    const pressureColumn = normalizePressureColumn(
      column.atmosphere.pressureColumn,
      column?.surface?.elevationM
    );
    pressureColumn.revision = Math.max(0, Math.round(finite(pressureColumn.revision))) + 1;
    pressureColumn.lastNativeHorizontalTransportReason = String(
      options.reason || 'loaded-native-pressure-horizontal-transport'
    );
    column.atmosphere.pressureColumn = normalizePressureColumn(
      pressureColumn,
      column?.surface?.elevationM
    );
    projectionReceipts.push(projectNativePressureColumnToLegacy(column, {
      reason: options.reason || 'loaded-native-pressure-horizontal-transport'
    }));
  }
  const final = domainTotals(columns, areas);
  const finalByLevel = Array.from(
    { length: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT },
    (_unused, index) => levelTotals(columns, areas, index)
  );
  const impulseForcing = forcingTotals(momentum.impulseReceipts);
  const rotationForcing = coriolisTotals(momentum.coriolisReceipts);
  const totalMixingDissipationJ = sum(momentum.mixingDissipationByLevelJ);
  const totalPressureWorkJ = sum(momentum.pressureWorkByLevelJ);
  const totalCoriolisWorkJ = sum(momentum.coriolisWorkByLevelJ);
  const totalGeopotentialRouteWorkJ = sum(momentum.geopotentialRouteWorkByLevelJ);
  const hydrostaticGeometryAdjustmentByLevelJ = finalByLevel.map((level, index) =>
    level.geopotentialEnergyJ - initialByLevel[index].geopotentialEnergyJ -
      momentum.geopotentialRouteWorkByLevelJ[index]);
  const totalHydrostaticGeometryAdjustmentJ = sum(hydrostaticGeometryAdjustmentByLevelJ);
  const residuals = {
    dryAirMassKg: final.dryAirMassKg - initial.dryAirMassKg,
    vaporWaterKg: final.vaporWaterKg - initial.vaporWaterKg,
    cloudWaterKg: final.cloudWaterKg - initial.cloudWaterKg,
    cloudIceKg: final.cloudIceKg - initial.cloudIceKg,
    waterKg: final.vaporWaterKg + final.cloudWaterKg + final.cloudIceKg -
      initial.vaporWaterKg - initial.cloudWaterKg - initial.cloudIceKg,
    moistEnthalpyJ: final.moistEnthalpyJ - initial.moistEnthalpyJ -
      totalMixingDissipationJ,
    eastwardMomentumKgMps: final.eastwardMomentumKgMps -
      initial.eastwardMomentumKgMps - impulseForcing.eastwardKgMps -
      rotationForcing.eastwardKgMps,
    northwardMomentumKgMps: final.northwardMomentumKgMps -
      initial.northwardMomentumKgMps - impulseForcing.northwardKgMps -
      rotationForcing.northwardKgMps,
    horizontalKineticEnergyJ: final.horizontalKineticEnergyJ +
      totalMixingDissipationJ - initial.horizontalKineticEnergyJ -
      totalPressureWorkJ - totalCoriolisWorkJ,
    geopotentialEnergyJ: final.geopotentialEnergyJ - initial.geopotentialEnergyJ -
      totalGeopotentialRouteWorkJ - totalHydrostaticGeometryAdjustmentJ,
    resolvedEnergyJ: final.resolvedEnergyJ - initial.resolvedEnergyJ -
      totalPressureWorkJ - totalCoriolisWorkJ - totalGeopotentialRouteWorkJ -
      totalHydrostaticGeometryAdjustmentJ
  };
  const levelSummaries = initialByLevel.map((before, index) => {
    const after = finalByLevel[index];
    const pressureReceipts = momentum.impulseReceipts.filter(receipt =>
      receipt.layerIndex === index);
    const rotationReceipts = momentum.coriolisReceipts.filter(receipt =>
      receipt.layerIndex === index);
    const pressureForcing = forcingTotals(pressureReceipts);
    const rotation = coriolisTotals(rotationReceipts);
    return {
      layerId: `pressure-layer-${String(index).padStart(2, '0')}`,
      layerIndex: index,
      initial: roundedTotals(before),
      final: roundedTotals(after),
      routeCount: massTransfers.filter(transfer => transfer.layerIndex === index).length,
      tracerRouteCount: [...vaporTransfers, ...cloudTransfers, ...cloudIceTransfers,
        ...heatTransfers]
        .filter(transfer => transfer.layerIndex === index).length,
      momentumMixingDissipationJ: round(momentum.mixingDissipationByLevelJ[index], 3),
      pressureWorkJ: round(momentum.pressureWorkByLevelJ[index], 3),
      coriolisWorkJ: round(momentum.coriolisWorkByLevelJ[index], 3),
      geopotentialRouteWorkJ: round(momentum.geopotentialRouteWorkByLevelJ[index], 3),
      hydrostaticGeometryAdjustmentJ: round(
        hydrostaticGeometryAdjustmentByLevelJ[index], 3),
      residuals: {
        dryAirMassKg: round(after.dryAirMassKg - before.dryAirMassKg, 3),
        waterKg: round(after.vaporWaterKg + after.cloudWaterKg + after.cloudIceKg -
          before.vaporWaterKg - before.cloudWaterKg - before.cloudIceKg, 3),
        moistEnthalpyJ: round(after.moistEnthalpyJ - before.moistEnthalpyJ -
          momentum.mixingDissipationByLevelJ[index], 3),
        eastwardMomentumKgMps: round(after.eastwardMomentumKgMps -
          before.eastwardMomentumKgMps - pressureForcing.eastwardKgMps -
          rotation.eastwardKgMps, 3),
        northwardMomentumKgMps: round(after.northwardMomentumKgMps -
          before.northwardMomentumKgMps - pressureForcing.northwardKgMps -
          rotation.northwardKgMps, 3),
        horizontalKineticEnergyJ: round(after.horizontalKineticEnergyJ +
          momentum.mixingDissipationByLevelJ[index] -
          before.horizontalKineticEnergyJ - momentum.pressureWorkByLevelJ[index] -
          momentum.coriolisWorkByLevelJ[index], 3),
        resolvedEnergyJ: round(after.resolvedEnergyJ - before.resolvedEnergyJ -
          momentum.pressureWorkByLevelJ[index] - momentum.coriolisWorkByLevelJ[index] -
          momentum.geopotentialRouteWorkByLevelJ[index] -
          hydrostaticGeometryAdjustmentByLevelJ[index], 3)
      }
    };
  });
  const vaporByMassId = carriedTotalsByMassId(vaporTransfers);
  const cloudByMassId = carriedTotalsByMassId(cloudTransfers);
  const cloudIceByMassId = carriedTotalsByMassId(cloudIceTransfers);
  const heatByMassId = carriedTotalsByMassId(heatTransfers);
  const enrichedMassReceipts = momentum.massReceipts.map(receipt => ({
    ...receipt,
    carriedVaporWaterKg: round(vaporByMassId.get(receipt.transferId) || 0, 3),
    carriedCloudWaterKg: round(cloudByMassId.get(receipt.transferId) || 0, 3),
    carriedCloudIceKg: round(cloudIceByMassId.get(receipt.transferId) || 0, 3),
    carriedSensibleEnthalpyJ: round(heatByMassId.get(receipt.transferId) || 0, 3)
  }));
  const receipt = {
    schema: ATMOSPHERE_PRESSURE_HORIZONTAL_TRANSPORT_SCHEMA,
    reason: String(options.reason || 'loaded-native-pressure-horizontal-transport'),
    durationDays: round(duration, 9),
    columnCount: columns.length,
    activeEdgeCount: activeEdges.length,
    layerCount: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
    initial: roundedTotals(initial),
    final: roundedTotals(final),
    massRouteReceipts: enrichedMassReceipts,
    tracerRouteReceipts: [
      ...tracerReceipts(vaporTransfers, 'water-vapor', 'kg'),
      ...tracerReceipts(cloudTransfers, 'cloud-liquid-water', 'kg'),
      ...tracerReceipts(cloudIceTransfers, 'cloud-ice-water', 'kg'),
      ...tracerReceipts(heatTransfers, 'absolute-sensible-enthalpy', 'J')
    ],
    impulseReceipts: momentum.impulseReceipts,
    coriolisReceipts: momentum.coriolisReceipts,
    projectionReceiptDigests: projectionReceipts.map(entry => entry.digest),
    levelSummaries,
    transfers: {
      dryAirKg: round(transferTotal(massTransfers), 3),
      boundaryDryAirKg: round(transferTotal(massTransfers,
        transfer => transfer.layerIndex < 2), 3),
      freeDryAirKg: round(transferTotal(massTransfers,
        transfer => transfer.layerIndex >= 2), 3),
      vaporWaterKg: round(transferTotal(vaporTransfers), 3),
      boundaryVaporWaterKg: round(transferTotal(vaporTransfers,
        transfer => transfer.layerIndex < 2), 3),
      freeVaporWaterKg: round(transferTotal(vaporTransfers,
        transfer => transfer.layerIndex >= 2), 3),
      cloudWaterKg: round(transferTotal(cloudTransfers), 3),
      boundaryCloudWaterKg: round(transferTotal(cloudTransfers,
        transfer => transfer.layerIndex < 2), 3),
      freeCloudWaterKg: round(transferTotal(cloudTransfers,
        transfer => transfer.layerIndex >= 2), 3),
      cloudIceKg: round(transferTotal(cloudIceTransfers), 3),
      boundaryCloudIceKg: round(transferTotal(cloudIceTransfers,
        transfer => transfer.layerIndex < 2), 3),
      freeCloudIceKg: round(transferTotal(cloudIceTransfers,
        transfer => transfer.layerIndex >= 2), 3),
      sensibleHeatJ: round(transferTotal(heatTransfers), 3),
      boundarySensibleHeatJ: round(transferTotal(heatTransfers,
        transfer => transfer.layerIndex < 2), 3),
      freeSensibleHeatJ: round(transferTotal(heatTransfers,
        transfer => transfer.layerIndex >= 2), 3),
      pressureForcingEastwardKgMps: round(impulseForcing.eastwardKgMps, 3),
      pressureForcingNorthwardKgMps: round(impulseForcing.northwardKgMps, 3),
      coriolisForcingEastwardKgMps: round(rotationForcing.eastwardKgMps, 3),
      coriolisForcingNorthwardKgMps: round(rotationForcing.northwardKgMps, 3),
      pressureImpulseLimiterScale: round(momentum.impulseScale, 12),
      momentumMixingDissipationJ: round(totalMixingDissipationJ, 3),
      pressureWorkJ: round(totalPressureWorkJ, 3),
      coriolisWorkJ: round(totalCoriolisWorkJ, 3),
      geopotentialRouteWorkJ: round(totalGeopotentialRouteWorkJ, 3),
      hydrostaticGeometryAdjustmentJ: round(totalHydrostaticGeometryAdjustmentJ, 3)
    },
    residuals: Object.fromEntries(Object.entries(residuals).map(([key, value]) =>
      [key, round(value, 3)])),
    truth: {
      nativePressureLevelHorizontalTransport: true,
      allEightNativeLevelsParticipate: levelSummaries.length === 8,
      simultaneousSourceDestinationCommit: true,
      senderReceiverDryAirReceipted: true,
      dryAirCarriesNativeLayerTracersHeatAndMomentum: true,
      nativeCloudIceTransport: true,
      nativeLayerPressureGradientForcingReceipted: true,
      nativeLayerCoriolisReceipted: true,
      nativeLayerGeopotentialRoutingReceipted: true,
      hydrostaticGeometryAdjustmentNamed: true,
      nativeWaterClosed: Math.abs(residuals.waterKg) < 1,
      nativeMoistEnthalpyClosed: Math.abs(residuals.moistEnthalpyJ) < 1e5,
      nativeTangentMomentumClosed:
        Math.abs(residuals.eastwardMomentumKgMps) < 1e3 &&
        Math.abs(residuals.northwardMomentumKgMps) < 1e3,
      nativeKineticEnergyClosed: Math.abs(residuals.horizontalKineticEnergyJ) < 1e5,
      nativeResolvedEnergyClosed: Math.abs(residuals.resolvedEnergyJ) < 1e5,
      nativeBuoyancyPlumes: false,
      pressureLevelDynamicsResolved: false,
      globalCirculationModel: false,
      globalAngularMomentumModel: false,
      scientificForecast: false
    }
  };
  receipt.digest = stableDigest(receipt);
  for (const column of columns) {
    const localMassRoutes = enrichedMassReceipts.filter(entry =>
      entry.senderCellId === column.id || entry.receiverCellId === column.id);
    const localTracerRoutes = receipt.tracerRouteReceipts.filter(entry =>
      entry.senderCellId === column.id || entry.receiverCellId === column.id);
    const localReceipt = {
      schema: ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA,
      transportSchema: receipt.schema,
      transportDigest: receipt.digest,
      cellId: column.id,
      durationDays: receipt.durationDays,
      layerCount: receipt.layerCount,
      activeEdgeCount: activeEdges.filter(edge =>
        edge.aId === column.id || edge.bId === column.id).length,
      massRouteCount: localMassRoutes.length,
      tracerRouteCount: localTracerRoutes.length,
      outgoingDryAirKg: round(localMassRoutes.filter(entry =>
        entry.senderCellId === column.id).reduce((total, entry) =>
        total + entry.dryAirMassKg, 0), 3),
      incomingDryAirKg: round(localMassRoutes.filter(entry =>
        entry.receiverCellId === column.id).reduce((total, entry) =>
        total + entry.dryAirMassKg, 0), 3),
      truth: {
        nativePressureLevelHorizontalTransport: true,
        simultaneousDomainReceipt: true,
        compatibilityBandsAreProjection: true,
        nativeBuoyancyPlumes: false,
        pressureLevelDynamicsResolved: false
      }
    };
    column.atmosphere.lastPressureColumnHorizontalTransportReceipt = localReceipt;
    column.truth.nativePressureLevelHorizontalTransport = true;
    column.truth.nativePressureLevelHorizontalWaterClosed =
      receipt.truth.nativeWaterClosed;
    column.truth.nativePressureLevelHorizontalMoistEnthalpyClosed =
      receipt.truth.nativeMoistEnthalpyClosed;
    column.truth.nativePressureLevelHorizontalMomentumClosed =
      receipt.truth.nativeTangentMomentumClosed;
    column.truth.nativePressureLevelHorizontalResolvedEnergyClosed =
      receipt.truth.nativeResolvedEnergyClosed;
    column.truth.pressureLevelDynamicsResolved = false;
  }
  return { columns, receipt };
}

export function pressureHorizontalTransportDescription() {
  return {
    schema: ATMOSPHERE_PRESSURE_HORIZONTAL_TRANSPORT_SCHEMA,
    massRouteSchema: ATMOSPHERE_PRESSURE_LAYER_MASS_ROUTE_SCHEMA,
    tracerRouteSchema: ATMOSPHERE_PRESSURE_LAYER_TRACER_ROUTE_SCHEMA,
    impulseSchema: ATMOSPHERE_PRESSURE_LAYER_IMPULSE_SCHEMA,
    coriolisSchema: ATMOSPHERE_PRESSURE_LAYER_CORIOLIS_SCHEMA,
    geopotentialRouteSchema: ATMOSPHERE_PRESSURE_LAYER_GEOPOTENTIAL_ROUTE_SCHEMA,
    localReceiptSchema: ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA,
    layerCount: ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
    simultaneousSourceDestinationCommit: true,
    dryAirCarriesNativeTracersHeatAndMomentum: true,
    nativeCloudIceTransport: true,
    nativeLayerPressureGradientForcing: true,
    nativeLayerCoriolisDeflection: true,
    nativeLayerGeopotentialRouting: true,
    momentumMixingDissipationThermalized: true,
    compatibilityBandsAreProjection: true,
    nativePressureLevelHorizontalTransport: true,
    nativeBuoyancyPlumes: false,
    pressureLevelDynamicsResolved: false,
    globalCirculationModel: false,
    scientificForecast: false
  };
}
