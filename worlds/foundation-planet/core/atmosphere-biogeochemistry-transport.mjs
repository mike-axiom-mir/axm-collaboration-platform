import {
  ATMOSPHERE_BIOGEOCHEMISTRY_HORIZONTAL_LOCAL_RECEIPT_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
  normalizeAtmosphereBiogeochemistry,
  synchronizeAtmosphereCompatibilityMirrors
} from './atmosphere-biogeochemistry.mjs?v=0.62.0-r62.1';

export const ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-transport-receipt/v2';
export const ATMOSPHERE_BIOGEOCHEMISTRY_ROUTE_SCHEMA =
  'axm.foundation-planet.atmosphere-biogeochemistry-route-receipt/v2';

const STANDARD_GRAVITY_MPS2 = 9.80665;
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
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

function gasMasses(state, areaM2) {
  return {
    carbonKgC: state.carbonDioxideCarbonKgCm2 * areaM2,
    oxygenKgO2: state.oxygenKgO2m2 * areaM2,
    nitrogenKgN: state.nitrogenGasKgNm2 * areaM2
  };
}

function layerGasMasses(state, areaM2) {
  return state.layers.map(layer => ({
    carbonKgC: layer.carbonDioxideCarbonKgCm2 * areaM2,
    oxygenKgO2: layer.oxygenKgO2m2 * areaM2,
    nitrogenKgN: layer.nitrogenGasKgNm2 * areaM2
  }));
}

function zeroMasses() {
  return { carbonKgC: 0, oxygenKgO2: 0, nitrogenKgN: 0 };
}

function addMasses(target, source, scale = 1) {
  for (const key of Object.keys(target)) target[key] += source[key] * scale;
  return target;
}

function roundedMasses(source, digits = 6) {
  return Object.fromEntries(Object.entries(source).map(([key, value]) =>
    [key, round(value, digits)]));
}

function zeroLayerMasses() {
  return Array.from({ length: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT },
    () => zeroMasses());
}

export function atmosphereBiogeochemistryDomainTotals(columns, areas) {
  const totals = zeroMasses();
  for (const column of columns) {
    const areaM2 = finite(areas.get(column.id));
    if (!(areaM2 > 0)) throw new Error('Atmospheric gas totals require a positive canonical cell area');
    const state = normalizeAtmosphereBiogeochemistry(
      column.atmosphere?.biogeochemistry,
      {
        landEcology: column.land?.ecology,
        oceanEcology: column.ocean?.ecology,
        pressureColumn: column.atmosphere?.pressureColumn
      }
    );
    addMasses(totals, gasMasses(state, areaM2));
  }
  return {
    atmosphereCarbonDioxideCarbonKg: totals.carbonKgC,
    atmosphereOxygenKg: totals.oxygenKgO2,
    atmosphereNitrogenGasKg: totals.nitrogenKgN
  };
}

export function transportAtmosphereBiogeochemistry(columns,
  dryAirMassRouteReceipts, areas, options = {}) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('Atmospheric gas transport requires loaded columns');
  }
  if (!Array.isArray(dryAirMassRouteReceipts)) {
    throw new Error('Atmospheric gas transport requires native dry-air route receipts');
  }
  const byId = new Map(columns.map(column => [column.id, column]));
  if (byId.size !== columns.length) {
    throw new Error('Atmospheric gas transport received duplicate cells');
  }
  const initialStates = new Map();
  const initialMasses = new Map();
  const initialLayerMasses = new Map();
  const initialDryAirLayerMasses = new Map();
  const deltas = new Map();
  const throughput = new Map();
  const layerThroughput = new Map();
  for (const column of columns) {
    const areaM2 = finite(areas.get(column.id));
    if (!(areaM2 > 0)) throw new Error('Atmospheric gas transport requires positive cell areas');
    const state = normalizeAtmosphereBiogeochemistry(
      column.atmosphere?.biogeochemistry,
      {
        landEcology: column.land?.ecology,
        oceanEcology: column.ocean?.ecology,
        pressureColumn: column.atmosphere?.pressureColumn
      }
    );
    initialStates.set(column.id, state);
    initialMasses.set(column.id, gasMasses(state, areaM2));
    initialLayerMasses.set(column.id, layerGasMasses(state, areaM2));
    const suppliedDryAirLayers = options.initialDryAirMassKgByCellAndLayer?.
      get(column.id);
    initialDryAirLayerMasses.set(column.id,
      Array.from({ length: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT },
        (_, index) => finite(suppliedDryAirLayers?.[index],
          finite(column.atmosphere?.pressureColumn?.layers?.[index]
            ?.pressureThicknessHpa) * 100 / STANDARD_GRAVITY_MPS2 * areaM2)));
    deltas.set(column.id, zeroLayerMasses());
    throughput.set(column.id, { incoming: zeroMasses(), outgoing: zeroMasses() });
    layerThroughput.set(column.id,
      Array.from({ length: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT }, () =>
        ({ incoming: zeroMasses(), outgoing: zeroMasses() })));
  }

  const routes = [];
  const outgoingDryAirByCellAndLayer = new Map(columns.map(column =>
    [column.id, Array(ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT).fill(0)]));
  for (const source of [...dryAirMassRouteReceipts].sort((a, b) =>
    String(a.transferId).localeCompare(String(b.transferId)))) {
    const sender = byId.get(source.senderCellId);
    const receiver = byId.get(source.receiverCellId);
    if (!sender || !receiver) {
      throw new Error('Atmospheric gas route references an unloaded cell');
    }
    const layerIndex = Number(source.layerIndex);
    if (!Number.isInteger(layerIndex) || layerIndex < 0 || layerIndex >=
        ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT) {
      throw new Error('Atmospheric gas route references an invalid native layer');
    }
    const dryAirMassKg = Math.max(0, finite(source.dryAirMassKg));
    const senderDryAirMassKg = initialDryAirLayerMasses.get(sender.id)[layerIndex];
    if (!(senderDryAirMassKg > 0)) {
      throw new Error('Atmospheric gas route has no positive sender dry-air reservoir');
    }
    const fraction = dryAirMassKg / senderDryAirMassKg;
    outgoingDryAirByCellAndLayer.get(sender.id)[layerIndex] += dryAirMassKg;
    const senderGases = initialLayerMasses.get(sender.id)[layerIndex];
    const gases = Object.fromEntries(Object.entries(senderGases).map(
      ([key, value]) => [key, value * fraction]
    ));
    addMasses(deltas.get(sender.id)[layerIndex], gases, -1);
    addMasses(deltas.get(receiver.id)[layerIndex], gases, 1);
    addMasses(throughput.get(sender.id).outgoing, gases);
    addMasses(throughput.get(receiver.id).incoming, gases);
    addMasses(layerThroughput.get(sender.id)[layerIndex].outgoing, gases);
    addMasses(layerThroughput.get(receiver.id)[layerIndex].incoming, gases);
    routes.push({
      schema: ATMOSPHERE_BIOGEOCHEMISTRY_ROUTE_SCHEMA,
      transferId: `atmospheric-gases:${source.transferId}`,
      parentDryAirTransferId: source.transferId,
      edgeId: source.edgeId,
      layerIndex,
      senderCellId: sender.id,
      receiverCellId: receiver.id,
      dryAirMassKg: round(dryAirMassKg, 3),
      senderDryAirFraction: round(fraction, 15),
      gases: roundedMasses(gases, 9),
      simultaneous: true,
      truth: {
        senderNativeLayerComposition: true,
        wholeColumnAverageUsed: false
      }
    });
  }
  for (const [cellId, outgoingByLayer] of outgoingDryAirByCellAndLayer) {
    for (let index = 0; index < outgoingByLayer.length; index++) {
      if (outgoingByLayer[index] >
          initialDryAirLayerMasses.get(cellId)[index] + 1) {
        throw new Error('Atmospheric gas route exceeds its sender native-layer dry-air reservoir');
      }
    }
  }

  const localReceipts = [];
  for (const column of [...columns].sort((a, b) => a.id.localeCompare(b.id))) {
    const areaM2 = areas.get(column.id);
    const initial = initialMasses.get(column.id);
    const initialLayers = initialLayerMasses.get(column.id);
    const layerDeltas = deltas.get(column.id);
    const finalLayers = initialLayers.map((layer, index) =>
      Object.fromEntries(Object.entries(layer).map(([key, value]) =>
        [key, Math.max(0, value + layerDeltas[index][key])])));
    const finalMasses = zeroMasses();
    for (const layer of finalLayers) addMasses(finalMasses, layer);
    const state = normalizeAtmosphereBiogeochemistry(
      initialStates.get(column.id),
      { pressureColumn: column.atmosphere?.pressureColumn }
    );
    state.layers.forEach((layer, index) => {
      layer.carbonDioxideCarbonKgCm2 = finalLayers[index].carbonKgC / areaM2;
      layer.oxygenKgO2m2 = finalLayers[index].oxygenKgO2 / areaM2;
      layer.nitrogenGasKgNm2 = finalLayers[index].nitrogenKgN / areaM2;
    });
    const cellThroughput = throughput.get(column.id);
    const cellLayerThroughput = layerThroughput.get(column.id);
    state.cumulative.horizontalCarbonThroughputKgCm2 +=
      (cellThroughput.incoming.carbonKgC +
        cellThroughput.outgoing.carbonKgC) / areaM2;
    state.cumulative.horizontalOxygenThroughputKgO2m2 +=
      (cellThroughput.incoming.oxygenKgO2 +
        cellThroughput.outgoing.oxygenKgO2) / areaM2;
    state.cumulative.horizontalNitrogenThroughputKgNm2 +=
      (cellThroughput.incoming.nitrogenKgN +
        cellThroughput.outgoing.nitrogenKgN) / areaM2;
    const participated = Object.values(cellThroughput.incoming).some(value => value > 0) ||
      Object.values(cellThroughput.outgoing).some(value => value > 0);
    state.truth.horizontallyTransported = participated;
    const localReceipt = {
      schema: ATMOSPHERE_BIOGEOCHEMISTRY_HORIZONTAL_LOCAL_RECEIPT_SCHEMA,
      status: participated ? 'transported' : 'no-loaded-route',
      cellId: column.id,
      incoming: roundedMasses(cellThroughput.incoming, 9),
      outgoing: roundedMasses(cellThroughput.outgoing, 9),
      final: roundedMasses(finalMasses, 9),
      layers: finalLayers.map((finalLayer, index) => ({
        layerIndex: index,
        initial: roundedMasses(initialLayers[index], 9),
        incoming: roundedMasses(cellLayerThroughput[index].incoming, 9),
        outgoing: roundedMasses(cellLayerThroughput[index].outgoing, 9),
        final: roundedMasses(finalLayer, 9),
        conservation: roundedMasses(Object.fromEntries(
          Object.keys(finalLayer).map(key => [key,
            finalLayer[key] - initialLayers[index][key] -
            cellLayerThroughput[index].incoming[key] +
            cellLayerThroughput[index].outgoing[key]
          ])), 6)
      })),
      conservation: roundedMasses({
        carbonKgC: finalMasses.carbonKgC - initial.carbonKgC -
          cellThroughput.incoming.carbonKgC +
          cellThroughput.outgoing.carbonKgC,
        oxygenKgO2: finalMasses.oxygenKgO2 - initial.oxygenKgO2 -
          cellThroughput.incoming.oxygenKgO2 +
          cellThroughput.outgoing.oxygenKgO2,
        nitrogenKgN: finalMasses.nitrogenKgN - initial.nitrogenKgN -
          cellThroughput.incoming.nitrogenKgN +
          cellThroughput.outgoing.nitrogenKgN
      }, 6),
      truth: {
        simultaneousSourceDestinationCommit: true,
        nativeDryAirRouteBackbone: true,
        nativePressureLayerComposition: true,
        wholeColumnAverageUsed: false,
        globalMixing: false
      }
    };
    state.lastHorizontalTransportReceipt = localReceipt;
    column.atmosphere.biogeochemistry =
      synchronizeAtmosphereCompatibilityMirrors(
        state, column.land?.ecology, column.ocean?.ecology,
        { pressureColumn: column.atmosphere?.pressureColumn }
      );
    localReceipts.push(localReceipt);
  }

  const initialTotals = zeroMasses();
  const finalTotals = zeroMasses();
  const transferTotals = zeroMasses();
  const initialLayerTotals = zeroLayerMasses();
  const finalLayerTotals = zeroLayerMasses();
  const transferLayerTotals = zeroLayerMasses();
  for (const mass of initialMasses.values()) addMasses(initialTotals, mass);
  for (const layers of initialLayerMasses.values()) layers.forEach(
    (mass, index) => addMasses(initialLayerTotals[index], mass));
  for (const column of columns) {
    addMasses(finalTotals, gasMasses(
      column.atmosphere.biogeochemistry, areas.get(column.id)));
    layerGasMasses(column.atmosphere.biogeochemistry,
      areas.get(column.id)).forEach((mass, index) =>
      addMasses(finalLayerTotals[index], mass));
  }
  for (const route of routes) {
    addMasses(transferTotals, route.gases);
    addMasses(transferLayerTotals[route.layerIndex], route.gases);
  }
  const conservation = {
    carbonResidualKgC: finalTotals.carbonKgC - initialTotals.carbonKgC,
    oxygenResidualKgO2: finalTotals.oxygenKgO2 - initialTotals.oxygenKgO2,
    nitrogenResidualKgN: finalTotals.nitrogenKgN - initialTotals.nitrogenKgN
  };
  const receipt = {
    schema: ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA,
    reason: String(options.reason || 'loaded-native-dry-air-gas-transport'),
    durationDays: round(finite(options.durationDays), 9),
    columnCount: columns.length,
    routeCount: routes.length,
    initial: roundedMasses(initialTotals, 6),
    final: roundedMasses(finalTotals, 6),
    routes,
    localReceipts,
    layerSummaries: initialLayerTotals.map((initialLayer, index) => ({
      layerIndex: index,
      routeCount: routes.filter(route => route.layerIndex === index).length,
      initial: roundedMasses(initialLayer, 6),
      final: roundedMasses(finalLayerTotals[index], 6),
      transfers: roundedMasses(transferLayerTotals[index], 6),
      conservation: roundedMasses(Object.fromEntries(
        Object.keys(initialLayer).map(key => [key,
          finalLayerTotals[index][key] - initialLayer[key]
        ])), 6)
    })),
    transfers: roundedMasses(transferTotals, 6),
    conservation: Object.fromEntries(Object.entries(conservation).map(
      ([key, value]) => [key, round(value, 6)]
    )),
    truth: {
      simultaneousSourceDestinationCommit: true,
      cellAreaWeighted: true,
      nativeDryAirRouteBackbone: true,
      nativePressureLayerComposition: true,
      layerCount: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
      wholeColumnAverageUsed: false,
      carbonOxygenNitrogenConservative: Object.values(conservation)
        .every(value => Math.abs(value) < 1),
      sparseLoadedDomain: true,
      explicitUnloadedBoundariesInheritedFromEarthTransport: true,
      globalMixing: false,
      scientificAtmosphericChemistry: false
    }
  };
  receipt.digest = stableDigest(receipt);
  for (const column of columns) {
    column.atmosphere.biogeochemistry.lastHorizontalTransportReceipt
      .domainDigest = receipt.digest;
  }
  return { columns, receipt: clone(receipt) };
}

export function atmosphereBiogeochemistryTransportDescription() {
  return {
    domainReceiptSchema: ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA,
    routeReceiptSchema: ATMOSPHERE_BIOGEOCHEMISTRY_ROUTE_SCHEMA,
    localReceiptSchema:
      ATMOSPHERE_BIOGEOCHEMISTRY_HORIZONTAL_LOCAL_RECEIPT_SCHEMA,
    transportedReservoirs: ['carbon-dioxide-carbon', 'oxygen', 'nitrogen-gas'],
    backbone: 'eight-level-native-dry-air-mass-routes',
    nativePressureLayerComposition: true,
    layerCount: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
    wholeColumnAverageUsed: false,
    simultaneous: true,
    cellAreaWeighted: true,
    sparseLoadedDomain: true,
    globalMixing: false,
    scientificAtmosphericChemistry: false
  };
}
