import {
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
  ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_INTERFACE_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA,
  normalizeAtmosphereBiogeochemistry,
  refreshAtmosphereBiogeochemistry
} from './atmosphere-biogeochemistry.mjs?v=0.62.0-r62.1';
import {
  ATMOSPHERE_ADJACENT_LAYER_EXCHANGE_SCHEMA
} from './pressure-dynamics.mjs';

const STANDARD_GRAVITY_MPS2 = 9.80665;
const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));
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

function totals(state) {
  return {
    carbonKgCm2: state.layers.reduce((sum, layer) =>
      sum + layer.carbonDioxideCarbonKgCm2, 0),
    oxygenKgO2m2: state.layers.reduce((sum, layer) =>
      sum + layer.oxygenKgO2m2, 0),
    nitrogenKgNm2: state.layers.reduce((sum, layer) =>
      sum + layer.nitrogenGasKgNm2, 0)
  };
}

function layerSnapshot(layer) {
  return {
    layerIndex: layer.index,
    carbonKgCm2: round(layer.carbonDioxideCarbonKgCm2),
    oxygenKgO2m2: round(layer.oxygenKgO2m2),
    nitrogenKgNm2: round(layer.nitrogenGasKgNm2)
  };
}

function applyContrast(lower, upper, lowerDryAirKgM2, upperDryAirKgM2,
  grossDryAirKgM2, key) {
  const requestedUpward = grossDryAirKgM2 * (
    lower[key] / Math.max(1e-12, lowerDryAirKgM2) -
    upper[key] / Math.max(1e-12, upperDryAirKgM2)
  );
  const appliedUpward = requestedUpward >= 0
    ? Math.min(requestedUpward, lower[key])
    : -Math.min(-requestedUpward, upper[key]);
  lower[key] -= appliedUpward;
  upper[key] += appliedUpward;
  return appliedUpward;
}

export function transportAtmosphereBiogeochemistryVertically(source,
  pressureColumn, adjacentExchangeReceipts, options = {}) {
  if (!Array.isArray(pressureColumn?.layers) || pressureColumn.layers.length !==
      ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT) {
    throw new Error('Vertical atmospheric gas transport requires eight native pressure layers');
  }
  if (!Array.isArray(adjacentExchangeReceipts) ||
      adjacentExchangeReceipts.length !==
        ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT - 1) {
    throw new Error('Vertical atmospheric gas transport requires seven adjacent-interface receipts');
  }
  const state = normalizeAtmosphereBiogeochemistry(source, { pressureColumn });
  const initial = totals(state);
  const initialLayers = state.layers.map(layerSnapshot);
  const routes = [];
  const throughput = { carbonKgCm2: 0, oxygenKgO2m2: 0, nitrogenKgNm2: 0 };
  for (const exchange of [...adjacentExchangeReceipts].sort((a, b) =>
    a.interfaceIndex - b.interfaceIndex)) {
    const index = Number(exchange.interfaceIndex);
    if (exchange.schema !== ATMOSPHERE_ADJACENT_LAYER_EXCHANGE_SCHEMA ||
        !Number.isInteger(index) || index < 0 || index >=
          ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT - 1) {
      throw new Error('Vertical atmospheric gas transport received an invalid native interface');
    }
    const lower = state.layers[index];
    const upper = state.layers[index + 1];
    const lowerDryAirKgM2 = finite(
      pressureColumn.layers[index].pressureThicknessHpa) * 100 /
      STANDARD_GRAVITY_MPS2;
    const upperDryAirKgM2 = finite(
      pressureColumn.layers[index + 1].pressureThicknessHpa) * 100 /
      STANDARD_GRAVITY_MPS2;
    const grossDryAirKgM2 = Math.max(0, finite(
      exchange.grossDryAirExchangeKgM2));
    const carbonUpwardKgCm2 = applyContrast(lower, upper,
      lowerDryAirKgM2, upperDryAirKgM2, grossDryAirKgM2,
      'carbonDioxideCarbonKgCm2');
    const oxygenUpwardKgO2m2 = applyContrast(lower, upper,
      lowerDryAirKgM2, upperDryAirKgM2, grossDryAirKgM2,
      'oxygenKgO2m2');
    const nitrogenUpwardKgNm2 = applyContrast(lower, upper,
      lowerDryAirKgM2, upperDryAirKgM2, grossDryAirKgM2,
      'nitrogenGasKgNm2');
    throughput.carbonKgCm2 += Math.abs(carbonUpwardKgCm2);
    throughput.oxygenKgO2m2 += Math.abs(oxygenUpwardKgO2m2);
    throughput.nitrogenKgNm2 += Math.abs(nitrogenUpwardKgNm2);
    routes.push({
      schema: ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_INTERFACE_SCHEMA,
      interfaceIndex: index,
      parentAdjacentExchangeSchema: exchange.schema,
      lowerLayerIndex: index,
      upperLayerIndex: index + 1,
      grossUpwardDryAirKgM2: round(grossDryAirKgM2, 9),
      grossCompensatingDownwardDryAirKgM2: round(grossDryAirKgM2, 9),
      netUpward: {
        carbonKgCm2: round(carbonUpwardKgCm2),
        oxygenKgO2m2: round(oxygenUpwardKgO2m2),
        nitrogenKgNm2: round(nitrogenUpwardKgNm2)
      },
      conservation: {
        carbonResidualKgCm2: 0,
        oxygenResidualKgO2m2: 0,
        nitrogenResidualKgNm2: 0
      }
    });
  }
  state.cumulative.verticalCarbonThroughputKgCm2 += throughput.carbonKgCm2;
  state.cumulative.verticalOxygenThroughputKgO2m2 += throughput.oxygenKgO2m2;
  state.cumulative.verticalNitrogenThroughputKgNm2 += throughput.nitrogenKgNm2;
  const final = totals(state);
  const conservation = {
    carbonResidualKgCm2: final.carbonKgCm2 - initial.carbonKgCm2,
    oxygenResidualKgO2m2: final.oxygenKgO2m2 - initial.oxygenKgO2m2,
    nitrogenResidualKgNm2: final.nitrogenKgNm2 - initial.nitrogenKgNm2
  };
  const participated = Object.values(throughput).some(value => value > 1e-15);
  state.truth.verticallyTransported = participated;
  refreshAtmosphereBiogeochemistry(state, pressureColumn);
  const receipt = {
    schema: ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA,
    status: participated ? 'transported' : 'composition-uniform-no-net-transfer',
    reason: String(options.reason || 'native-adjacent-interface-gas-mixing'),
    durationDays: round(finite(options.durationDays), 9),
    layerCount: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
    interfaceCount: routes.length,
    initial: Object.fromEntries(Object.entries(initial).map(([key, value]) =>
      [key, round(value)])),
    final: Object.fromEntries(Object.entries(final).map(([key, value]) =>
      [key, round(value)])),
    initialLayers,
    finalLayers: state.layers.map(layerSnapshot),
    routes,
    throughput: Object.fromEntries(Object.entries(throughput).map(
      ([key, value]) => [key, round(value)])),
    conservation: Object.fromEntries(Object.entries(conservation).map(
      ([key, value]) => [key, round(value)])),
    truth: {
      nativePressureLayerComposition: true,
      orderedAdjacentInterfaceCommit: true,
      equalGrossDryAirExchangeBackbone: true,
      carbonOxygenNitrogenConservative: Object.values(conservation)
        .every(value => Math.abs(value) < 1e-9),
      resolvedMolecularDiffusion: false,
      threeDimensionalPlumes: false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastVerticalTransportReceipt = clone(receipt);
  return { state, receipt: clone(receipt) };
}

export function atmosphereBiogeochemistryVerticalDescription() {
  return {
    receiptSchema: ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA,
    interfaceReceiptSchema:
      ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_INTERFACE_SCHEMA,
    layerCount: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
    interfaceCount: ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT - 1,
    transportedReservoirs: ['carbon-dioxide-carbon', 'oxygen', 'nitrogen-gas'],
    backbone: 'native-adjacent-equal-gross-dry-air-exchange',
    orderedCommit: true,
    conservative: true,
    resolvedMolecularDiffusion: false,
    threeDimensionalPlumes: false
  };
}
