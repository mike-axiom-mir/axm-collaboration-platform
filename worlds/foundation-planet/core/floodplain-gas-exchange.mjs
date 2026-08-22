import {
  ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
  normalizeAtmosphereBiogeochemistry
} from './atmosphere-biogeochemistry.mjs?v=0.62.0-r62.1';
import {
  FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
  floodplainReactionMassClosureToleranceKg,
  normalizeFloodplainState
} from './floodplain.mjs?v=0.62.0-r62.1';

export const FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-gas-exchange-state/v3';
export const PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-gas-exchange-state/v2';
export const LEGACY_FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA =
  'axm.foundation-planet.floodplain-gas-exchange-state/v1';
export const FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-gas-exchange-process-receipt/v3';
export const PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA =
  'axm.foundation-planet.floodplain-gas-exchange-process-receipt/v2';
export const REFERENCE_CO2_SOLUBILITY_CARBON_MG_L = .167;
export const REFERENCE_CO2_PPM = 420;

const finite = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Number(value) : fallback;
const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const round = (value, digits = 12) => Number(Number(value).toFixed(digits));
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function stableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function fluxes(source = {}) {
  return {
    carbonToAtmosphereKgC: Math.max(0,
      finite(source.carbonToAtmosphereKgC)),
    carbonToFloodplainKgC: Math.max(0,
      finite(source.carbonToFloodplainKgC)),
    oxygenToFloodplainKgO2: Math.max(0,
      finite(source.oxygenToFloodplainKgO2))
  };
}

function roundedFluxes(source = {}) {
  return Object.fromEntries(Object.entries(fluxes(source)).map(
    ([key, value]) => [key, round(value, 9)]));
}

function oxygenSaturationMgL(temperatureC) {
  const temperature = clamp(finite(temperatureC, 15), -2, 40);
  return clamp(14.621 - .41022 * temperature +
    .007991 * temperature ** 2 - .000077774 * temperature ** 3,
  5, 16);
}

function truth() {
  return {
    persistentGasExchangeProcessMemory: true,
    floodplainChemistryOwnership: false,
    atmosphereGasOwnership: false,
    pairedOwnerReceiptsRequiredWhenAtmosphereLoaded: true,
    carbonDioxideEvasionParameterized: true,
    carbonDioxideInvasionParameterized: true,
    bidirectionalCarbonDioxideGradientExchange: true,
    oxygenReaerationParameterized: true,
    physicalExchangeContinuesWithLifeOff: true,
    nativeAtmosphereSurfaceLayerRequired: true,
    surfaceTemperatureProxyResponsive: false,
    persistentFloodplainWaterTemperatureState: true,
    floodplainThermalReceiptBindingRequired: true,
    bidirectionalHenryLawSolved: false,
    resolvedAirWaterTurbulence: false,
    globallyMixedAtmosphere: false,
    scientificCalibrationClaimed: false
  };
}

export function emptyFloodplainGasExchangeState(options = {}) {
  return {
    schema: FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
    migrationCheckpoint: options.migrationCheckpoint === true,
    observedExchangeDays: 0,
    inactiveDays: 0,
    atmosphereUnavailableDays: 0,
    cumulativeExchange: fluxes(),
    lastActivity: {
      atmosphereAvailable: false,
      surfaceContactFactor: 0,
      equilibrationFraction: 0,
      waterTemperatureC: 0,
      floodplainThermalReceiptDigest: null,
      oxygenSaturationMgL: 0,
      oxygenSaturationTargetKgO2: 0,
      oxygenDeficitKgO2: 0,
      exchangeableDicKgC: 0,
      surfaceAtmosphereCo2Ppm: 0,
      co2SolubilityCarbonMgL: 0,
      aqueousCo2EquilibriumTargetKgC: 0,
      signedCarbonGradientKgC: 0,
      surfaceAtmosphereCarbonAvailableKgC: 0,
      surfaceAtmosphereOxygenAvailableKgO2: 0
    },
    lastFloodplainReceiptDigest: null,
    lastAtmosphereReceiptDigest: null,
    lastTransitionReceipt: null,
    truth: truth()
  };
}

export function normalizeFloodplainGasExchangeState(source, options = {}) {
  const state = emptyFloodplainGasExchangeState(options);
  if (![FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
    PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
    LEGACY_FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA].includes(source?.schema)) {
    return state;
  }
  state.migrationCheckpoint = source.schema !==
    FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA ||
    source.migrationCheckpoint === true;
  state.observedExchangeDays = Math.max(0,
    finite(source.observedExchangeDays));
  state.inactiveDays = Math.max(0, finite(source.inactiveDays));
  state.atmosphereUnavailableDays = Math.max(0,
    finite(source.atmosphereUnavailableDays));
  state.cumulativeExchange = fluxes(source.cumulativeExchange);
  state.lastActivity = {
    atmosphereAvailable: source.lastActivity?.atmosphereAvailable === true,
    surfaceContactFactor: clamp(finite(
      source.lastActivity?.surfaceContactFactor)),
    equilibrationFraction: clamp(finite(
      source.lastActivity?.equilibrationFraction)),
    waterTemperatureC: clamp(finite(
      source.lastActivity?.waterTemperatureC), -80, 80),
    floodplainThermalReceiptDigest:
      typeof source.lastActivity?.floodplainThermalReceiptDigest ===
        'string'
        ? source.lastActivity.floodplainThermalReceiptDigest : null,
    oxygenSaturationMgL: Math.max(0, finite(
      source.lastActivity?.oxygenSaturationMgL)),
    oxygenSaturationTargetKgO2: Math.max(0, finite(
      source.lastActivity?.oxygenSaturationTargetKgO2)),
    oxygenDeficitKgO2: Math.max(0, finite(
      source.lastActivity?.oxygenDeficitKgO2)),
    exchangeableDicKgC: Math.max(0, finite(
      source.lastActivity?.exchangeableDicKgC)),
    surfaceAtmosphereCo2Ppm: Math.max(0, finite(
      source.lastActivity?.surfaceAtmosphereCo2Ppm)),
    co2SolubilityCarbonMgL: Math.max(0, finite(
      source.lastActivity?.co2SolubilityCarbonMgL)),
    aqueousCo2EquilibriumTargetKgC: Math.max(0, finite(
      source.lastActivity?.aqueousCo2EquilibriumTargetKgC)),
    signedCarbonGradientKgC: finite(
      source.lastActivity?.signedCarbonGradientKgC),
    surfaceAtmosphereCarbonAvailableKgC: Math.max(0, finite(
      source.lastActivity?.surfaceAtmosphereCarbonAvailableKgC)),
    surfaceAtmosphereOxygenAvailableKgO2: Math.max(0, finite(
      source.lastActivity?.surfaceAtmosphereOxygenAvailableKgO2))
  };
  state.lastFloodplainReceiptDigest =
    typeof source.lastFloodplainReceiptDigest === 'string'
      ? source.lastFloodplainReceiptDigest : null;
  state.lastAtmosphereReceiptDigest =
    typeof source.lastAtmosphereReceiptDigest === 'string'
      ? source.lastAtmosphereReceiptDigest : null;
  state.lastTransitionReceipt = source.lastTransitionReceipt?.schema ===
    FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA
    ? clone(source.lastTransitionReceipt) : null;
  return state;
}

export function floodplainGasExchangeSummary(source) {
  const state = normalizeFloodplainGasExchangeState(source);
  return {
    observedExchangeDays: round(state.observedExchangeDays, 8),
    inactiveDays: round(state.inactiveDays, 8),
    atmosphereUnavailableDays: round(state.atmosphereUnavailableDays, 8),
    cumulativeExchange: roundedFluxes(state.cumulativeExchange),
    lastActivity: Object.fromEntries(Object.entries(state.lastActivity).map(
      ([key, value]) => [key, typeof value === 'number'
        ? round(value, 9) : value])),
    truth: truth()
  };
}

export function floodplainGasExchangePlan(source, floodplainSource,
  atmosphereSource, context = {}) {
  const state = normalizeFloodplainGasExchangeState(source);
  const floodplain = normalizeFloodplainState(floodplainSource);
  const durationDays = finite(context.durationDays, 1);
  if (!(durationDays > 0) || durationDays > 1.000001) {
    throw new Error('Floodplain gas-exchange step must be greater than zero and no longer than one day');
  }
  const atmosphereAvailable = context.atmosphereAvailable !== false &&
    atmosphereSource?.schema === ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA;
  const atmosphere = atmosphereAvailable
    ? normalizeAtmosphereBiogeochemistry(atmosphereSource, {
      pressureColumn: context.pressureColumn
    }) : null;
  const receivingAreaM2 = Math.max(1, finite(context.receivingAreaM2, 1));
  const waterTemperatureC = clamp(finite(context.waterTemperatureC, 15),
    -2, 40);
  const floodplainThermalReceiptDigest =
    typeof context.floodplainThermalReceiptDigest === 'string'
      ? context.floodplainThermalReceiptDigest : null;
  const saturationMgL = oxygenSaturationMgL(waterTemperatureC);
  const oxygenSaturationTargetKgO2 = floodplain.waterKg *
    saturationMgL * 1e-6;
  const oxygenDeficitKgO2 = Math.max(0,
    oxygenSaturationTargetKgO2 -
    floodplain.chemistry.dissolvedOxygenKgO2);
  const exchangeableDicFraction = clamp(finite(
    context.exchangeableDicFraction, .025), 0, .25);
  const exchangeableDicKgC =
    floodplain.chemistry.dissolvedInorganicCarbonKgC *
    exchangeableDicFraction;
  const surfaceAtmosphereCo2Ppm = atmosphereAvailable
    ? Math.max(0, finite(atmosphere.layers[0].co2PpmProxy,
      atmosphere.co2Ppm)) : 0;
  const temperatureSolubilityFactor = Math.exp(-.025 *
    (waterTemperatureC - 25));
  const co2SolubilityCarbonMgL = clamp(
    REFERENCE_CO2_SOLUBILITY_CARBON_MG_L *
      (surfaceAtmosphereCo2Ppm / REFERENCE_CO2_PPM) *
      temperatureSolubilityFactor, 0, 10);
  const aqueousCo2EquilibriumTargetKgC = floodplain.waterKg *
    co2SolubilityCarbonMgL * 1e-6;
  const signedCarbonGradientKgC = exchangeableDicKgC -
    aqueousCo2EquilibriumTargetKgC;
  const surfaceContactFactor = floodplain.waterKg > 1e-9
    ? clamp(.1 + .9 * Math.sqrt(clamp(floodplain.inundatedFraction))) : 0;
  const maximumDailyEquilibrationFraction = clamp(finite(
    context.maximumDailyEquilibrationFraction, .35), 0, 1);
  const equilibrationFraction = state.migrationCheckpoint ||
    !atmosphereAvailable || context.gasExchangeEnabled === false
    ? 0 : 1 - Math.exp(-maximumDailyEquilibrationFraction *
      durationDays * surfaceContactFactor);
  const surfaceAtmosphereOxygenAvailableKgO2 = atmosphereAvailable
    ? atmosphere.layers[0].oxygenKgO2m2 * receivingAreaM2 : 0;
  const surfaceAtmosphereCarbonAvailableKgC = atmosphereAvailable
    ? atmosphere.layers[0].carbonDioxideCarbonKgCm2 * receivingAreaM2 : 0;
  const carbonToAtmosphereKgC = Math.min(
    floodplain.chemistry.dissolvedInorganicCarbonKgC,
    Math.max(0, signedCarbonGradientKgC) * equilibrationFraction);
  const carbonToFloodplainKgC = Math.min(
    surfaceAtmosphereCarbonAvailableKgC,
    Math.max(0, -signedCarbonGradientKgC) * equilibrationFraction);
  const oxygenToFloodplainKgO2 = Math.min(
    oxygenDeficitKgO2 * equilibrationFraction,
    surfaceAtmosphereOxygenAvailableKgO2);
  return {
    durationDays: round(durationDays, 8),
    migrationCheckpoint: state.migrationCheckpoint,
    activity: {
      atmosphereAvailable,
      surfaceContactFactor: round(surfaceContactFactor, 9),
      equilibrationFraction: round(equilibrationFraction, 9),
      waterTemperatureC: round(waterTemperatureC, 6),
      floodplainThermalReceiptDigest,
      oxygenSaturationMgL: round(saturationMgL, 9),
      oxygenSaturationTargetKgO2: round(
        oxygenSaturationTargetKgO2, 9),
      oxygenDeficitKgO2: round(oxygenDeficitKgO2, 9),
      exchangeableDicKgC: round(exchangeableDicKgC, 9),
      surfaceAtmosphereCo2Ppm: round(surfaceAtmosphereCo2Ppm, 9),
      co2SolubilityCarbonMgL: round(co2SolubilityCarbonMgL, 12),
      aqueousCo2EquilibriumTargetKgC: round(
        aqueousCo2EquilibriumTargetKgC, 9),
      signedCarbonGradientKgC: round(signedCarbonGradientKgC, 9),
      surfaceAtmosphereCarbonAvailableKgC: round(
        surfaceAtmosphereCarbonAvailableKgC, 9),
      surfaceAtmosphereOxygenAvailableKgO2: round(
        surfaceAtmosphereOxygenAvailableKgO2, 9)
    },
    exchange: roundedFluxes({
      carbonToAtmosphereKgC,
      carbonToFloodplainKgC,
      oxygenToFloodplainKgO2
    }),
    truth: {
      ...truth(),
      atmosphereLoaded: atmosphereAvailable,
      migrationHasZeroExchange: state.migrationCheckpoint
        ? carbonToAtmosphereKgC + carbonToFloodplainKgC +
          oxygenToFloodplainKgO2 <= 1e-12 : true,
      floodplainDicBoundsCarbonEvasion:
        carbonToAtmosphereKgC <=
          floodplain.chemistry.dissolvedInorganicCarbonKgC + 1e-12,
      atmosphereSurfaceCarbonBoundsCarbonInvasion:
        carbonToFloodplainKgC <=
          surfaceAtmosphereCarbonAvailableKgC + 1e-12,
      carbonExchangeDirectionExclusive:
        carbonToAtmosphereKgC <= 1e-12 ||
          carbonToFloodplainKgC <= 1e-12,
      atmosphereSurfaceOxygenBoundsReaeration:
        oxygenToFloodplainKgO2 <=
          surfaceAtmosphereOxygenAvailableKgO2 + 1e-12
    }
  };
}

export function advanceFloodplainGasExchange(source, plan,
  floodplainReceiptSource, atmosphereReceiptSource, context = {}) {
  const state = normalizeFloodplainGasExchangeState(source);
  const reachId = String(context.reachId || '');
  const atmosphereCellId = String(context.atmosphereCellId || '');
  const exchangeId = String(context.exchangeId || '');
  if (!reachId || !exchangeId) {
    throw new Error('Floodplain gas-exchange transition requires reach and exchange IDs');
  }
  const atmosphereAvailable = plan?.activity?.atmosphereAvailable === true;
  const planned = fluxes(plan?.exchange);
  const floodplainReceipt = floodplainReceiptSource?.schema ===
    FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA
    ? floodplainReceiptSource : null;
  const atmosphereReceipt = atmosphereReceiptSource?.schema ===
    ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA
    ? atmosphereReceiptSource : null;
  if (atmosphereAvailable && (!floodplainReceipt || !atmosphereReceipt)) {
    throw new TypeError('Loaded floodplain gas exchange requires both owner receipts');
  }
  if (!atmosphereAvailable && (floodplainReceipt || atmosphereReceipt ||
    planned.carbonToAtmosphereKgC + planned.carbonToFloodplainKgC +
      planned.oxygenToFloodplainKgO2 > 1e-12)) {
    throw new Error('Unloaded atmosphere cannot emit floodplain gas transfers or owner receipts');
  }
  if (atmosphereAvailable) {
    const ownerFluxes = fluxes(floodplainReceipt.exchange);
    const atmosphereFluxes = fluxes(atmosphereReceipt.exchange);
    const reactionChannels = {
      carbonToAtmosphereKgC: 'carbonKgC',
      carbonToFloodplainKgC: 'carbonKgC',
      oxygenToFloodplainKgO2: 'oxygenKgO2'
    };
    const quantitiesMatch = Object.keys(planned).every(key =>
      Math.abs(planned[key] - ownerFluxes[key]) <=
        floodplainReactionMassClosureToleranceKg(reactionChannels[key],
          planned[key], ownerFluxes[key]) &&
      Math.abs(planned[key] - atmosphereFluxes[key]) <=
        floodplainReactionMassClosureToleranceKg(reactionChannels[key],
          planned[key], atmosphereFluxes[key]));
    if (!quantitiesMatch || floodplainReceipt.exchangeId !== exchangeId ||
      atmosphereReceipt.exchangeId !== exchangeId ||
      floodplainReceipt.reachId !== reachId ||
      atmosphereReceipt.reachId !== reachId ||
      atmosphereReceipt.atmosphereCellId !== atmosphereCellId) {
      throw new Error('Floodplain gas-exchange owner receipts do not match the plan lineage');
    }
  }
  const durationDays = finite(context.durationDays, 1);
  const before = floodplainGasExchangeSummary(state);
  let status;
  if (state.migrationCheckpoint) {
    if (planned.carbonToAtmosphereKgC +
      planned.carbonToFloodplainKgC +
      planned.oxygenToFloodplainKgO2 > 1e-12) {
      throw new Error('Floodplain gas-exchange migration cannot move material');
    }
    state.migrationCheckpoint = false;
    status = 'initialized-after-v15-migration-no-invented-history';
  } else if (!atmosphereAvailable) {
    state.atmosphereUnavailableDays += durationDays;
    status = 'atmosphere-unloaded-no-exchange';
  } else {
    state.observedExchangeDays += durationDays;
    if (planned.carbonToAtmosphereKgC +
      planned.carbonToFloodplainKgC +
      planned.oxygenToFloodplainKgO2 <= 1e-12) {
      state.inactiveDays += durationDays;
      status = 'exchange-maintained-no-gradient';
    } else {
      status = planned.carbonToFloodplainKgC > 1e-12
        ? 'bounded-co2-invasion-and-oxygen-reaeration'
        : 'bounded-co2-evasion-and-oxygen-reaeration';
    }
    state.cumulativeExchange = fluxes({
      carbonToAtmosphereKgC:
        state.cumulativeExchange.carbonToAtmosphereKgC +
        planned.carbonToAtmosphereKgC,
      carbonToFloodplainKgC:
        state.cumulativeExchange.carbonToFloodplainKgC +
        planned.carbonToFloodplainKgC,
      oxygenToFloodplainKgO2:
        state.cumulativeExchange.oxygenToFloodplainKgO2 +
        planned.oxygenToFloodplainKgO2
    });
  }
  state.lastActivity = clone(plan?.activity || state.lastActivity);
  state.lastFloodplainReceiptDigest = floodplainReceipt?.digest || null;
  state.lastAtmosphereReceiptDigest = atmosphereReceipt?.digest || null;
  const after = floodplainGasExchangeSummary(state);
  const receipt = {
    schema: FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
    transitionId: String(context.transitionId ||
      `floodplain-gas-exchange:${stableDigest({
        reachId, atmosphereCellId, exchangeId,
        startDay: round(context.startDay, 8)
      }).slice(9)}`),
    exchangeId,
    reachId,
    atmosphereCellId: atmosphereAvailable ? atmosphereCellId : null,
    status,
    startDay: round(context.startDay, 8),
    durationDays: round(durationDays, 8),
    exchange: roundedFluxes(planned),
    floodplainReceiptDigest: floodplainReceipt?.digest || null,
    atmosphereReceiptDigest: atmosphereReceipt?.digest || null,
    activity: clone(plan?.activity || {}),
    before,
    after,
    closure: {
      carbonTransferResidualKgC: round(finite(
        floodplainReceipt?.closure?.carbonTransferResidualKgC), 12),
      oxygenTransferResidualKgO2: round(finite(
        floodplainReceipt?.closure?.oxygenTransferResidualKgO2), 12),
      atmosphereCarbonResidualKgC: round(finite(
        atmosphereReceipt?.conservation?.carbonResidualKgC), 12),
      atmosphereOxygenResidualKgO2: round(finite(
        atmosphereReceipt?.conservation?.oxygenResidualKgO2), 12)
    },
    truth: {
      ...truth(),
      pairedOwnerReceiptsPresent: atmosphereAvailable
        ? Boolean(floodplainReceipt && atmosphereReceipt) : true,
      exactExchangeIdentity: atmosphereAvailable
        ? floodplainReceipt.exchangeId === atmosphereReceipt.exchangeId : true,
      ownerLedgersClosed: atmosphereAvailable
        ? floodplainReceipt.truth?.scaleAwareFloatingPointClosure === true &&
          atmosphereReceipt.truth?.scaleAwareFloatingPointClosure === true
        : true,
      migrationInventedHistory: false
    }
  };
  receipt.digest = stableDigest(receipt);
  state.lastTransitionReceipt = clone(receipt);
  return {
    state: normalizeFloodplainGasExchangeState(state),
    receipt: clone(receipt)
  };
}

export function floodplainGasExchangeDescription() {
  return {
    stateSchema: FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
    previousStateSchema: PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
    transitionReceiptSchema:
      FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
    previousTransitionReceiptSchema:
      PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
    floodplainOwnerReceiptSchema: FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    atmosphereOwnerReceiptSchema:
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    processes: [
      'bounded-exchangeable-dic-evasion',
      'bounded-atmosphere-to-floodplain-co2-invasion',
      'temperature-aware-two-way-carbon-gradient',
      'bounded-oxygen-deficit-reaeration',
      'paired-floodplain-atmosphere-owner-receipts',
      'native-surface-atmosphere-layer-exchange',
      'v15-zero-transfer-migration',
      'Life-off-physical-exchange-continuity'
    ],
    maximumStepDays: 1,
    truth: truth()
  };
}
