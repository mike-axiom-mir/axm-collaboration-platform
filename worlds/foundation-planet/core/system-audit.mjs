import {
  EARTH_SYSTEM_COLUMN_SCHEMA
} from './earth-system.mjs?v=0.63.0-r63.1';
import {
  ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
  ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA,
  ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA,
  ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA,
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG,
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA
} from './atmosphere-biogeochemistry.mjs?v=0.62.0-r62.1';
import {
  ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
  ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA
} from './pressure-column.mjs';
import {
  ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
  ATMOSPHERE_PRESSURE_LAYER_PHASE_SCHEMA
} from './pressure-dynamics.mjs';
import {
  ATMOSPHERE_PHASE_THERMAL_ENVELOPE_SCHEMA,
  MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
  MAX_NATIVE_LAYER_AIR_TEMPERATURE_C
} from './phase-thermal-envelope.mjs';
import {
  ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA
} from './atmosphere-boundary-energy.mjs';
import {
  EARTH_LAND_ECOLOGY_SCHEMA,
  LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA,
  LAND_ECOLOGY_MASS_CLOSURE_POLICY_SCHEMA,
  LAND_ECOLOGY_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
  LAND_ECOLOGY_MASS_CLOSURE_ULP_FACTOR,
  landEcologyMassClosureToleranceKg
} from './land-ecology.mjs';
import {
  SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA,
  RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA,
  SOIL_RUNOFF_MOBILIZATION_SCHEMA,
  RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA
} from './soil-biogeochemistry.mjs';
import {
  SURFACE_SEDIMENT_STATE_SCHEMA,
  RUNOFF_SEDIMENT_QUEUE_SCHEMA,
  SURFACE_EROSION_RECEIPT_SCHEMA,
  RUNOFF_SEDIMENT_TRANSFER_SCHEMA,
  RIVER_SEDIMENT_INPUT_SCHEMA,
  RIVER_SEDIMENT_ROUTE_SCHEMA,
  COASTAL_SEDIMENT_STATE_SCHEMA,
  COASTAL_SEDIMENT_INPUT_SCHEMA,
  GEOMORPHIC_SEDIMENT_TRANSFER_MASS_CLOSURE_POLICY_SCHEMA,
  GEOMORPHIC_SEDIMENT_TRANSFER_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
  GEOMORPHIC_SEDIMENT_TRANSFER_MASS_CLOSURE_ULP_FACTOR
} from './geomorphic-sediment.mjs?v=0.63.0-r63.1';
import { EARTH_OCEAN_ECOLOGY_SCHEMA } from './ocean-ecology.mjs';
import {
  MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA
} from './carbonate-system.mjs';
import {
  AIR_SEA_CARBON_EXCHANGE_METHOD,
  AIR_SEA_CARBON_EXCHANGE_PROPOSAL_SCHEMA,
  weiss1974Co2FugacityFactor,
  weiss1974Co2Solubility,
  weissPrice1980SeawaterVaporPressureAtm
} from './air-sea-carbon-exchange.mjs';
import {
  DEEP_OCEAN_STATE_SCHEMA,
  DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA
} from './deep-ocean.mjs';
import {
  EARTH_TRANSPORT_STEP_SCHEMA,
  PREVIOUS_EARTH_TRANSPORT_STEP_SCHEMA,
  LEGACY_EARTH_TRANSPORT_STEP_SCHEMA
} from './earth-transport.mjs?v=0.63.0-r63.1';
import {
  ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA
} from './atmosphere-biogeochemistry-transport.mjs?v=0.62.0-r62.1';
import {
  BASIN_AGGREGATE_MASS_CLOSURE_SCHEMA,
  BASIN_AGGREGATE_MASS_CLOSURE_POLICY_SCHEMA,
  BASIN_AGGREGATE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
  BASIN_AGGREGATE_MASS_CLOSURE_ULP_FACTOR,
  BASIN_ROUTING_STEP_SCHEMA,
  PREVIOUS_BASIN_ROUTING_STEP_SCHEMA,
  RIVER_REACH_TRANSFER_SCHEMA,
  OCEAN_MOUTH_RECEIPT_SCHEMA
} from './basin-routing.mjs?v=0.66.0-r66.2';
import {
  RIVER_CHEMISTRY_INPUT_SCHEMA
} from './river-chemistry.mjs';
import {
  FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
  FLOODPLAIN_EXCHANGE_MASS_CLOSURE_SCHEMA,
  FLOODPLAIN_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
  FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG,
  FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
  FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
  FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
  FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
  FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
  FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
  FLOODPLAIN_REACTION_MASS_CLOSURE_ABSOLUTE_FLOORS_KG,
  FLOODPLAIN_REACTION_MASS_CLOSURE_ULP_FACTOR,
  floodplainReactionMassClosureToleranceKg,
  FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
  FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA,
  FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ABSOLUTE_FLOORS_KG,
  FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ULP_FACTOR,
  floodplainDetritalReturnMassClosureToleranceKg,
  FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
  FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA
} from './floodplain.mjs?v=0.65.0-r65.1';
import {
  FLOODPLAIN_THERMAL_RECEIPT_SCHEMA,
  FLOODPLAIN_THERMAL_ENERGY_CLOSURE_SCHEMA,
  FLOODPLAIN_THERMAL_ENERGY_CLOSURE_POLICY_SCHEMA,
  FLOODPLAIN_THERMAL_ENERGY_ABSOLUTE_FLOOR_J,
  FLOODPLAIN_THERMAL_ENERGY_ULP_FACTOR,
  WATER_SPECIFIC_HEAT_J_KG_K
} from './floodplain-thermal.mjs?v=0.66.0-r66.2';
import {
  FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
  FLOODPLAIN_HABITAT_TYPES
} from './floodplain-habitat.mjs?v=0.61.0-r61.1';
import {
  FLOOD_EVENT_ARCHIVE_LIMIT,
  FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA
} from './flood-event-history.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_SUCCESSION_GUILDS,
  FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER,
  FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA
} from './floodplain-succession.mjs';
import {
  FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
  FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_POLICY_SCHEMA,
  FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
  FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_ULP_FACTOR,
  floodplainPlantMatterMassClosureToleranceKg,
  FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA
} from './floodplain-plant-matter.mjs?v=0.60.0-r60.1';
import {
  FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA,
  FLOODPLAIN_PLANT_RESOURCE_MASS_CLOSURE_POLICY_SCHEMA,
  FLOODPLAIN_PLANT_RESOURCE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
  FLOODPLAIN_PLANT_RESOURCE_MASS_CLOSURE_ULP_FACTOR,
  floodplainPlantResourceMassClosureToleranceKg,
  FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA
} from './floodplain-plant-resources.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA
} from './floodplain-decomposition.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA
} from './floodplain-respiration.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA
} from './floodplain-denitrification.mjs?v=0.62.0-r62.1';
import {
  FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA
} from './floodplain-nitrification.mjs?v=0.61.0-r61.1';
import {
  FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA
} from './floodplain-gas-exchange.mjs?v=0.62.0-r62.1';
import {
  EARTH_SURFACE_RADIATION_SCHEMA,
  PREVIOUS_EARTH_SURFACE_RADIATION_SCHEMA
} from './surface-radiation.mjs?v=0.62.0-r62.1';
import {
  ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA
} from './atmosphere-co2-radiation.mjs?v=0.62.0-r62.1';

export const FOUNDATION_SYSTEM_AUDIT_SCHEMA =
  'axm.foundation-planet.system-audit/v16';

const finite = value => Number.isFinite(Number(value));
const close = (value, tolerance) => finite(value) &&
  Math.abs(Number(value)) <= tolerance;
const same = (a, b, tolerance = 1e-12) => finite(a) && finite(b) &&
  Math.abs(Number(a) - Number(b)) <= tolerance;

function auditStableDigest(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function receiptDigestValid(receipt) {
  if (!receipt || typeof receipt.digest !== 'string') return false;
  const unsigned = JSON.parse(JSON.stringify(receipt));
  delete unsigned.digest;
  return auditStableDigest(unsigned) === receipt.digest;
}

function check(id, status, claim, evidence, options = {}) {
  return {
    id,
    status,
    required: options.required !== false,
    claim,
    evidence
  };
}

const SEDIMENT_GRAIN_IDS = Object.freeze(['clay', 'silt', 'sand', 'gravel']);
const roundAudit = (value, digits = 12) => Number(Number(value).toFixed(digits));
const sedimentGrainMap = source => Object.fromEntries(SEDIMENT_GRAIN_IDS.map(
  grain => [grain, Number(source?.[grain])]));
const sedimentMapFinite = source => SEDIMENT_GRAIN_IDS.every(grain =>
  finite(source?.[grain]));

function sedimentAuditToleranceKg(operandsKg = []) {
  const magnitudeKg = operandsKg.reduce((maximum, operand) => Math.max(
    maximum, Math.abs(Number(operand))), 0);
  return roundAudit(Math.max(
    GEOMORPHIC_SEDIMENT_TRANSFER_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
    magnitudeKg * Number.EPSILON *
      GEOMORPHIC_SEDIMENT_TRANSFER_MASS_CLOSURE_ULP_FACTOR
  ), 12);
}

function auditSedimentTransferReceipt(receipt) {
  const expectedIdentities = {};
  const expectedOperands = {};
  const operands = receipt?.operands || {};
  const addIdentity = (name, calculate, operandValues) => {
    expectedIdentities[name] = Object.fromEntries(SEDIMENT_GRAIN_IDS.map(
      grain => [grain, roundAudit(calculate(grain), 9)]));
    expectedOperands[name] = Object.fromEntries(SEDIMENT_GRAIN_IDS.map(
      grain => [grain, operandValues(grain)]));
  };
  let expectedSchema = null;
  let primaryIdentity = null;
  let operandsValid = false;

  if (receipt?.schema === RUNOFF_SEDIMENT_TRANSFER_SCHEMA) {
    expectedSchema = RUNOFF_SEDIMENT_TRANSFER_SCHEMA;
    const area = Number(operands.areaM2);
    operandsValid = finite(area) && area >= 1 &&
      sedimentMapFinite(operands.beforeSuspendedKgM2) &&
      sedimentMapFinite(operands.transferredKg) &&
      sedimentMapFinite(operands.afterSuspendedKgM2) &&
      ['sender-debit', 'receiver-credit'].includes(receipt.role);
    if (receipt.role === 'sender-debit') {
      primaryIdentity = 'senderDebitResidualKg';
      addIdentity(primaryIdentity, grain =>
        (Number(operands.beforeSuspendedKgM2?.[grain]) -
          Number(operands.afterSuspendedKgM2?.[grain])) * area -
          Number(operands.transferredKg?.[grain]), grain => [
        Number(operands.beforeSuspendedKgM2?.[grain]) * area,
        Number(operands.transferredKg?.[grain]),
        Number(operands.afterSuspendedKgM2?.[grain]) * area
      ]);
    } else if (receipt.role === 'receiver-credit') {
      primaryIdentity = 'receiverCreditResidualKg';
      addIdentity(primaryIdentity, grain =>
        (Number(operands.afterSuspendedKgM2?.[grain]) -
          Number(operands.beforeSuspendedKgM2?.[grain])) * area -
          Number(operands.transferredKg?.[grain]), grain => [
        Number(operands.beforeSuspendedKgM2?.[grain]) * area,
        Number(operands.transferredKg?.[grain]),
        Number(operands.afterSuspendedKgM2?.[grain]) * area
      ]);
    }
  } else if (receipt?.schema === RIVER_SEDIMENT_INPUT_SCHEMA) {
    expectedSchema = RIVER_SEDIMENT_INPUT_SCHEMA;
    primaryIdentity = 'receiverCreditResidualKg';
    operandsValid = sedimentMapFinite(operands.beforeSuspendedKg) &&
      sedimentMapFinite(operands.transferredKg) &&
      sedimentMapFinite(operands.afterSuspendedKg);
    addIdentity(primaryIdentity, grain =>
      Number(operands.afterSuspendedKg?.[grain]) -
        Number(operands.beforeSuspendedKg?.[grain]) -
        Number(operands.transferredKg?.[grain]), grain => [
      Number(operands.beforeSuspendedKg?.[grain]),
      Number(operands.transferredKg?.[grain]),
      Number(operands.afterSuspendedKg?.[grain])
    ]);
  } else if (receipt?.schema === RIVER_SEDIMENT_ROUTE_SCHEMA) {
    expectedSchema = RIVER_SEDIMENT_ROUTE_SCHEMA;
    primaryIdentity = 'senderDebitResidualKg';
    operandsValid = [
      'beforeSuspendedKg', 'requestedKg', 'depositedToBedKg', 'exportedKg',
      'afterSuspendedKg', 'beforeBedDepositKg', 'afterBedDepositKg'
    ].every(key => sedimentMapFinite(operands[key]));
    addIdentity(primaryIdentity, grain =>
      Number(operands.beforeSuspendedKg?.[grain]) -
        Number(operands.afterSuspendedKg?.[grain]) -
        Number(operands.depositedToBedKg?.[grain]) -
        Number(operands.exportedKg?.[grain]), grain => [
      Number(operands.beforeSuspendedKg?.[grain]),
      Number(operands.depositedToBedKg?.[grain]),
      Number(operands.exportedKg?.[grain]),
      Number(operands.afterSuspendedKg?.[grain])
    ]);
    addIdentity('bedCreditResidualKg', grain =>
      Number(operands.afterBedDepositKg?.[grain]) -
        Number(operands.beforeBedDepositKg?.[grain]) -
        Number(operands.depositedToBedKg?.[grain]), grain => [
      Number(operands.beforeBedDepositKg?.[grain]),
      Number(operands.depositedToBedKg?.[grain]),
      Number(operands.afterBedDepositKg?.[grain])
    ]);
    addIdentity('routePartitionResidualKg', grain =>
      Number(operands.requestedKg?.[grain]) -
        Number(operands.depositedToBedKg?.[grain]) -
        Number(operands.exportedKg?.[grain]), grain => [
      Number(operands.requestedKg?.[grain]),
      Number(operands.depositedToBedKg?.[grain]),
      Number(operands.exportedKg?.[grain])
    ]);
  } else if (receipt?.schema === COASTAL_SEDIMENT_INPUT_SCHEMA) {
    expectedSchema = COASTAL_SEDIMENT_INPUT_SCHEMA;
    primaryIdentity = 'receiverCreditResidualKg';
    const area = Number(operands.areaM2);
    operandsValid = finite(area) && area >= 1 && [
      'beforeSuspendedKgM2', 'beforeDepositedKgM2', 'transferredKg',
      'afterSuspendedKgM2', 'afterDepositedKgM2'
    ].every(key => sedimentMapFinite(operands[key]));
    addIdentity(primaryIdentity, grain =>
      (Number(operands.afterSuspendedKgM2?.[grain]) -
        Number(operands.beforeSuspendedKgM2?.[grain]) +
        Number(operands.afterDepositedKgM2?.[grain]) -
        Number(operands.beforeDepositedKgM2?.[grain])) * area -
        Number(operands.transferredKg?.[grain]), grain => [
      Number(operands.beforeSuspendedKgM2?.[grain]) * area,
      Number(operands.beforeDepositedKgM2?.[grain]) * area,
      Number(operands.transferredKg?.[grain]),
      Number(operands.afterSuspendedKgM2?.[grain]) * area,
      Number(operands.afterDepositedKgM2?.[grain]) * area
    ]);
    addIdentity('inputPartitionResidualKg', grain =>
      Number(operands.transferredKg?.[grain]) -
        Number(receipt.suspendedKg?.[grain]) -
        Number(receipt.depositedKg?.[grain]), grain => [
      Number(operands.transferredKg?.[grain]),
      Number(receipt.suspendedKg?.[grain]),
      Number(receipt.depositedKg?.[grain])
    ]);
    operandsValid = operandsValid && sedimentMapFinite(receipt.suspendedKg) &&
      sedimentMapFinite(receipt.depositedKg);
  }

  if (!expectedSchema || !primaryIdentity) {
    return { valid: false, expectedSchema, reason: 'unsupported receipt schema' };
  }
  const expectedToleranceKg = Object.fromEntries(Object.entries(
    expectedOperands).map(([identity, grainOperands]) => [identity,
      Object.fromEntries(SEDIMENT_GRAIN_IDS.map(grain => [grain,
        sedimentAuditToleranceKg(grainOperands[grain])]))]));
  const identityNames = Object.keys(expectedIdentities).sort();
  const declaredIdentityNames = Object.keys(
    receipt.closure?.identities || {}).sort();
  const identitiesValid = identityNames.join('|') ===
      declaredIdentityNames.join('|') && identityNames.every(identity =>
        SEDIMENT_GRAIN_IDS.every(grain => same(
          receipt.closure?.identities?.[identity]?.[grain],
          expectedIdentities[identity][grain], 1e-12)));
  const tolerancesValid = identityNames.every(identity =>
    SEDIMENT_GRAIN_IDS.every(grain => same(
      receipt.closure?.numericToleranceKg?.[identity]?.[grain],
      expectedToleranceKg[identity][grain], 1e-12)));
  const expectedMaximumResidualKg = Math.max(0, ...identityNames.flatMap(
    identity => SEDIMENT_GRAIN_IDS.map(grain => Math.abs(
      expectedIdentities[identity][grain]))));
  const expectedMaximumToleranceKg = Math.max(0, ...identityNames.flatMap(
    identity => SEDIMENT_GRAIN_IDS.map(grain =>
      expectedToleranceKg[identity][grain])));
  const expectedMaximumToleranceUtilization = Math.max(0,
    ...identityNames.flatMap(identity => SEDIMENT_GRAIN_IDS.map(grain =>
      Math.abs(expectedIdentities[identity][grain]) /
        expectedToleranceKg[identity][grain])));
  const expectedClosed = identityNames.every(identity =>
    SEDIMENT_GRAIN_IDS.every(grain =>
      Math.abs(expectedIdentities[identity][grain]) <=
        expectedToleranceKg[identity][grain]));
  const aliasesValid = SEDIMENT_GRAIN_IDS.every(grain => same(
    receipt.residualKg?.[grain], expectedIdentities[primaryIdentity][grain],
    1e-12)) && (receipt.schema !== RIVER_SEDIMENT_ROUTE_SCHEMA ||
      SEDIMENT_GRAIN_IDS.every(grain =>
        same(receipt.bedResidualKg?.[grain],
          expectedIdentities.bedCreditResidualKg[grain], 1e-12) &&
        same(receipt.routePartitionResidualKg?.[grain],
          expectedIdentities.routePartitionResidualKg[grain], 1e-12))) &&
    (receipt.schema !== COASTAL_SEDIMENT_INPUT_SCHEMA ||
      SEDIMENT_GRAIN_IDS.every(grain => same(
        receipt.inputPartitionResidualKg?.[grain],
        expectedIdentities.inputPartitionResidualKg[grain], 1e-12)));
  const policyValid = receipt.closure?.policy?.schema ===
      GEOMORPHIC_SEDIMENT_TRANSFER_MASS_CLOSURE_POLICY_SCHEMA &&
    receipt.closure?.policy?.absoluteFloorKg ===
      GEOMORPHIC_SEDIMENT_TRANSFER_MASS_CLOSURE_ABSOLUTE_FLOOR_KG &&
    receipt.closure?.policy?.ulpFactor ===
      GEOMORPHIC_SEDIMENT_TRANSFER_MASS_CLOSURE_ULP_FACTOR &&
    receipt.closure?.policy?.perGrainOperands === true;
  const maximaValid = same(receipt.closure?.maximumResidualKg,
      roundAudit(expectedMaximumResidualKg, 12), 1e-12) &&
    same(receipt.closure?.maximumToleranceKg,
      roundAudit(expectedMaximumToleranceKg, 12), 1e-12) &&
    same(receipt.closure?.maximumToleranceUtilization,
      roundAudit(expectedMaximumToleranceUtilization, 12), 1e-12);
  const truthValid = receipt.closure?.conservationClosed === expectedClosed &&
    receipt.truth?.conservationClosed === expectedClosed &&
    receipt.truth?.scaleAwareFloatingPointClosure === true &&
    receipt.truth?.perGrainNumericBounds === true &&
    receipt.truth?.measuredResidualsPreserved === true &&
    receipt.truth?.fixedAbsoluteToleranceOnly === false;
  return {
    valid: operandsValid && identitiesValid && tolerancesValid && aliasesValid &&
      policyValid && maximaValid && truthValid && expectedClosed,
    expectedSchema,
    expectedIdentities,
    expectedToleranceKg,
    expectedMaximumResidualKg: roundAudit(expectedMaximumResidualKg, 12),
    expectedMaximumToleranceKg: roundAudit(expectedMaximumToleranceKg, 12),
    expectedMaximumToleranceUtilization:
      roundAudit(expectedMaximumToleranceUtilization, 12),
    criteria: { operandsValid, identitiesValid, tolerancesValid, aliasesValid,
      policyValid, maximaValid, truthValid, expectedClosed }
  };
}

function residualCheck(id, receipt, schema, tolerance, claim) {
  if (!receipt) {
    return check(id, 'NOT_APPLICABLE', claim,
      { reason: 'no committed receipt is available yet' }, { required: false });
  }
  const residuals = receipt.conservation || {};
  const entries = Object.entries(residuals);
  const valid = receipt.schema === schema && entries.length > 0 &&
    entries.every(([, value]) => close(value, tolerance));
  return check(id, valid ? 'PASS' : 'FAIL', claim, {
    expectedSchema: schema,
    actualSchema: receipt.schema || null,
    tolerance,
    residuals
  });
}

function ecologyMirrorCheck(column) {
  const atmosphere = column?.atmosphere?.biogeochemistry;
  if (column?.kind === 'land') {
    const ecology = column?.land?.ecology;
    const valid = ecology?.schema === EARTH_LAND_ECOLOGY_SCHEMA &&
      same(ecology?.carbon?.atmosphericExchangeableKgCm2,
        atmosphere?.carbonDioxideCarbonKgCm2) &&
      same(ecology?.carbon?.co2PpmProxy, atmosphere?.co2Ppm, 1e-6);
    return check('ecology-gas-compatibility-mirror', valid ? 'PASS' : 'FAIL',
      'Land atmospheric carbon fields are exact compatibility mirrors.', {
        ecologySchema: ecology?.schema || null,
        atmosphereCarbonKgCm2: atmosphere?.carbonDioxideCarbonKgCm2 ?? null,
        ecologyCarbonKgCm2:
          ecology?.carbon?.atmosphericExchangeableKgCm2 ?? null
      });
  }
  if (column?.kind === 'ocean') {
    const ecology = column?.ocean?.ecology;
    const valid = ecology?.schema === EARTH_OCEAN_ECOLOGY_SCHEMA &&
      same(ecology?.carbon?.atmosphericExchangeableKgCm2,
        atmosphere?.carbonDioxideCarbonKgCm2) &&
      same(ecology?.carbon?.co2PpmProxy, atmosphere?.co2Ppm, 1e-6) &&
      same(ecology?.oxygen?.atmosphericExchangeableKgO2m2,
        atmosphere?.oxygenKgO2m2);
    return check('ecology-gas-compatibility-mirror', valid ? 'PASS' : 'FAIL',
      'Ocean atmospheric carbon and oxygen fields are exact compatibility mirrors.', {
        ecologySchema: ecology?.schema || null,
        atmosphereCarbonKgCm2: atmosphere?.carbonDioxideCarbonKgCm2 ?? null,
        ecologyCarbonKgCm2:
          ecology?.carbon?.atmosphericExchangeableKgCm2 ?? null,
        atmosphereOxygenKgO2m2: atmosphere?.oxygenKgO2m2 ?? null,
        ecologyOxygenKgO2m2:
          ecology?.oxygen?.atmosphericExchangeableKgO2m2 ?? null
      });
  }
  return check('ecology-gas-compatibility-mirror', 'FAIL',
    'Column kind has a recognized ecology compatibility route.', {
      kind: column?.kind || null
    });
}

function localBudgetCheck(column) {
  const residuals = {
    waterResidualMm: column?.budget?.water?.residualMm,
    surfaceEnergyResidualJm2: column?.budget?.energy?.residualJm2,
    atmosphereEnergyResidualJm2:
      column?.budget?.atmosphereEnergy?.residualJm2
  };
  const valid = close(residuals.waterResidualMm, 1e-6) &&
    close(residuals.surfaceEnergyResidualJm2, 1) &&
    close(residuals.atmosphereEnergyResidualJm2, 1);
  return check('local-water-and-energy-ledgers', valid ? 'PASS' : 'FAIL',
    'The current local water, surface-energy and moist-enthalpy ledgers close.', {
      tolerances: { waterMm: 1e-6, energyJm2: 1 }, residuals
    });
}

function atmosphereBoundaryEnergyCheck(column) {
  const receipt = column?.atmosphere?.lastBoundaryEnergyReceipt;
  const budget = column?.budget?.atmosphereEnergy;
  if (!receipt) {
    const migrationCheckpoint = budget?.migrationCheckpoint === true;
    const unstepped = Number(column?.stepCount || 0) === 0;
    return check('atmosphere-boundary-forcing-energy-ledger',
      migrationCheckpoint || unstepped ? 'NOT_APPLICABLE' : 'FAIL',
      'Requested compatibility forcing, applied native forcing and envelope reconciliation remain distinct and ledgered.',
      {
        reason: migrationCheckpoint
          ? 'migration checkpoint intentionally discards unsupported historical receipt evidence'
          : unstepped ? 'the column has not advanced yet' :
            'a stepped current column is missing its boundary energy receipt'
      }, { required: !(migrationCheckpoint || unstepped) });
  }
  const embedded = budget?.boundaryEnergyReceipt;
  const valid = receipt.schema === ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA &&
    embedded?.schema === ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA &&
    same(receipt.appliedBoundaryMoistEnthalpyJm2,
      receipt.requestedBoundaryMoistEnthalpyJm2 +
        receipt.nativeEnvelopeReconciliationJm2, 1e-3) &&
    same(receipt.appliedBoundaryMoistEnthalpyJm2,
      receipt.nativeFinalMoistEnthalpyJm2 -
        receipt.nativeInitialMoistEnthalpyJm2, 1e-3) &&
    same(receipt.nativeEnvelopeReconciliationJm2,
      receipt.finalCompatibilityProjectionAdjustmentJm2 -
        receipt.initialCompatibilityProjectionAdjustmentJm2, 1e-3) &&
    close(receipt.ledgerResidualJm2, 1) &&
    same(budget.initialMoistEnthalpyJm2,
      receipt.nativeInitialMoistEnthalpyJm2, 1e-3) &&
    same(budget.requestedBoundaryMoistEnthalpyJm2,
      receipt.requestedBoundaryMoistEnthalpyJm2, 1e-3) &&
    same(budget.boundaryMoistEnthalpyJm2,
      receipt.appliedBoundaryMoistEnthalpyJm2, 1e-3) &&
    same(budget.boundaryNativeEnvelopeReconciliationJm2,
      receipt.nativeEnvelopeReconciliationJm2, 1e-3) &&
    same(embedded.appliedBoundaryMoistEnthalpyJm2,
      receipt.appliedBoundaryMoistEnthalpyJm2, 1e-3) &&
    Number.isInteger(receipt.nativeEnvelope?.limitedLayerCount) &&
    receipt.nativeEnvelope.limitedLayerCount >= 0 &&
    Array.isArray(receipt.nativeEnvelope?.limitedLayerIds) &&
    receipt.nativeEnvelope.limitedLayerIds.length ===
      receipt.nativeEnvelope.limitedLayerCount &&
    receipt.truth?.requestedAndAppliedBoundaryForcingDistinguished === true &&
    receipt.truth?.nativeEnvelopeReconciliationReceipted === true &&
    receipt.truth?.ledgerClosed === true &&
    receipt.truth?.nativeLayersWithinDeclaredEnvelope === true;
  return check('atmosphere-boundary-forcing-energy-ledger',
    valid ? 'PASS' : 'FAIL',
    'Requested compatibility forcing, applied native forcing and envelope reconciliation remain distinct and ledgered.', {
      schema: receipt.schema || null,
      requestedBoundaryMoistEnthalpyJm2:
        receipt.requestedBoundaryMoistEnthalpyJm2 ?? null,
      appliedBoundaryMoistEnthalpyJm2:
        receipt.appliedBoundaryMoistEnthalpyJm2 ?? null,
      nativeEnvelopeReconciliationJm2:
        receipt.nativeEnvelopeReconciliationJm2 ?? null,
      boundarySyncMoistEnthalpyResidualJm2:
        receipt.boundarySyncMoistEnthalpyResidualJm2 ?? null,
      nativeEnvelopeLimitedLayerCount:
        receipt.nativeEnvelope?.limitedLayerCount ?? null,
      ledgerResidualJm2: receipt.ledgerResidualJm2 ?? null
    });
}

function co2RadiationCheck(column) {
  const receipt = column?.surface?.lastRadiationReceipt;
  if (!receipt) {
    return check('atmosphere-co2-radiative-coupling', 'NOT_APPLICABLE',
      'A current surface-radiation receipt proves native-layer CO2 feedback when observed.',
      { reason: 'no committed surface-radiation receipt is available yet' },
      { required: false });
  }
  if (receipt.schema === PREVIOUS_EARTH_SURFACE_RADIATION_SCHEMA) {
    return check('atmosphere-co2-radiative-coupling', 'NOT_APPLICABLE',
      'A current surface-radiation receipt proves native-layer CO2 feedback when observed.', {
        reason: 'legacy v1 radiation predates atmosphere-owned CO2 coupling',
        expectedSchema: EARTH_SURFACE_RADIATION_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const coupling = receipt.atmosphereCo2RadiativeCoupling;
  const layers = Array.isArray(coupling?.layers) ? coupling.layers : [];
  const valid = receipt.schema === EARTH_SURFACE_RADIATION_SCHEMA &&
    coupling?.schema === ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA &&
    coupling.layerCount === ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT &&
    layers.length === ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT &&
    layers.every((layer, index) => layer.layerIndex === index &&
      finite(layer.pressureThicknessHpa) && layer.pressureThicknessHpa > 0 &&
      finite(layer.rawCo2Ppm) && layer.rawCo2Ppm >= 0 &&
      finite(layer.airTemperatureC) &&
      finite(layer.currentOpticalDepth) &&
      finite(layer.referenceOpticalDepth) &&
      finite(layer.currentSurfaceContributionWm2) &&
      finite(layer.referenceSurfaceContributionWm2)) &&
    same(receipt.co2LongwaveAdjustmentWm2,
      coupling.appliedSurfaceAdjustmentWm2, 1e-6) &&
    same(receipt.downwardLongwaveWm2,
      Number(receipt.baselineDownwardLongwaveWm2) +
        Number(coupling.appliedSurfaceAdjustmentWm2), 2e-6) &&
    receipt.truth?.nativeLayerCo2RadiativeCoupling === true &&
    receipt.truth?.co2SurfaceLongwaveFeedbackApplied === true &&
    receipt.truth?.broadbandGreyGasCo2Parameterization === true &&
    receipt.truth?.spectralRadiativeTransfer === false &&
    coupling.truth?.authoritativeAtmosphereGasState === true &&
    coupling.truth?.nativePressureLayerComposition === true &&
    coupling.truth?.nativePressureTemperaturePaths === true &&
    coupling.truth?.broadbandGreyGasParameterization === true &&
    coupling.truth?.spectralRadiativeTransfer === false &&
    coupling.truth?.lineByLineAbsorption === false &&
    (!coupling.truth?.referenceStateDetected ||
      close(coupling.appliedSurfaceAdjustmentWm2, 1e-6));
  return check('atmosphere-co2-radiative-coupling', valid ? 'PASS' : 'FAIL',
    'Eight native CO2 layers contribute a bounded grey-gas longwave adjustment to the surface-energy receipt.', {
      expectedRadiationSchema: EARTH_SURFACE_RADIATION_SCHEMA,
      actualRadiationSchema: receipt.schema || null,
      expectedCouplingSchema: ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA,
      actualCouplingSchema: coupling?.schema || null,
      layerCount: layers.length,
      pressureWeightedCo2Ppm: coupling?.pressureWeightedCo2Ppm ?? null,
      appliedSurfaceAdjustmentWm2:
        coupling?.appliedSurfaceAdjustmentWm2 ?? null,
      spectralRadiativeTransfer:
        coupling?.truth?.spectralRadiativeTransfer ?? null
    });
}

function pressureColumnCheck(column) {
  const pressure = column?.atmosphere?.pressureColumn;
  const layers = Array.isArray(pressure?.layers) ? pressure.layers : [];
  const interfaces = Array.isArray(pressure?.verticalInterfaces)
    ? pressure.verticalInterfaces : [];
  const valid = pressure?.schema === ATMOSPHERE_PRESSURE_COLUMN_SCHEMA &&
    layers.length === ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT &&
    interfaces.length === ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT - 1 &&
    interfaces.every(item =>
      item?.schema === ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA);
  return check('native-pressure-column-lineage', valid ? 'PASS' : 'FAIL',
    'The column owns eight native pressure layers and seven typed interfaces.', {
      expectedSchema: ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
      actualSchema: pressure?.schema || null,
      layerCount: layers.length,
      interfaceCount: interfaces.length
    });
}

function nativePhaseThermalEnvelopeCheck(column) {
  const pressure = column?.atmosphere?.pressureColumn;
  const pressureLayers = Array.isArray(pressure?.layers)
    ? pressure.layers : [];
  const receipt = column?.atmosphere?.lastPressureColumnDynamicsReceipt;
  if (!receipt) {
    const currentTemperaturesValid = pressureLayers.length ===
        ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT &&
      pressureLayers.every(layer => finite(layer?.airTemperatureC) &&
        Number(layer.airTemperatureC) >=
          MIN_NATIVE_LAYER_AIR_TEMPERATURE_C - 1e-9 &&
        Number(layer.airTemperatureC) <=
          MAX_NATIVE_LAYER_AIR_TEMPERATURE_C + 1e-9);
    return check('native-phase-thermal-envelope',
      currentTemperaturesValid ? 'NOT_APPLICABLE' : 'FAIL',
      'Native phase changes move only the mass whose latent heat fits the declared layer-temperature envelope.', {
        reason: currentTemperaturesValid
          ? 'the temperature state is valid but no committed native phase receipt is available yet'
          : 'the current native temperature state is outside its declared envelope',
        minimumAirTemperatureC: MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
        maximumAirTemperatureC: MAX_NATIVE_LAYER_AIR_TEMPERATURE_C,
        currentTemperaturesC: pressureLayers.map(layer =>
          layer?.airTemperatureC ?? null)
      }, { required: !currentTemperaturesValid });
  }
  const layerReceipts = Array.isArray(receipt.layerPhaseReceipts)
    ? receipt.layerPhaseReceipts : [];
  const currentTemperaturesValid = pressureLayers.length ===
      ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT &&
    pressureLayers.every(layer => finite(layer?.airTemperatureC) &&
      Number(layer.airTemperatureC) >=
        MIN_NATIVE_LAYER_AIR_TEMPERATURE_C - 1e-9 &&
      Number(layer.airTemperatureC) <=
        MAX_NATIVE_LAYER_AIR_TEMPERATURE_C + 1e-9);
  const receiptValid = receipt.schema ===
      ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA &&
    receipt.phaseThermalEnvelopeSchema ===
      ATMOSPHERE_PHASE_THERMAL_ENVELOPE_SCHEMA &&
    layerReceipts.length === ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT &&
    layerReceipts.every((entry, index) =>
      entry?.schema === ATMOSPHERE_PRESSURE_LAYER_PHASE_SCHEMA &&
      entry.layerIndex === index &&
      entry.thermalEnvelopeSchema ===
        ATMOSPHERE_PHASE_THERMAL_ENVELOPE_SCHEMA &&
      Number.isInteger(entry.thermalEnvelopeLimitCount) &&
      entry.thermalEnvelopeLimitCount >= 0 &&
      finite(entry.maximumThermallyRejectedRequestMm) &&
      Number(entry.maximumThermallyRejectedRequestMm) >= 0 &&
      finite(entry.finalAirTemperatureC) &&
      Number(entry.finalAirTemperatureC) >=
        MIN_NATIVE_LAYER_AIR_TEMPERATURE_C - 1e-9 &&
      Number(entry.finalAirTemperatureC) <=
        MAX_NATIVE_LAYER_AIR_TEMPERATURE_C + 1e-9 &&
      close(entry.waterResidualMm, 1e-8) &&
      close(entry.moistEnthalpyResidualJm2, 1) &&
      entry.truth?.phaseChangesBoundedByThermalHeadroom === true &&
      entry.truth?.airTemperatureWithinDeclaredEnvelope === true &&
      entry.truth?.postMaterialTemperatureClipRequired === false) &&
    close(receipt.residuals?.phaseWaterMm, 1e-8) &&
    close(receipt.residuals?.phaseMoistEnthalpyJm2, 1) &&
    close(receipt.residuals?.moistEnthalpyJm2, 1) &&
    close(receipt.residuals?.resolvedEnergyJm2, 1) &&
    receipt.truth?.nativePhaseChangesBoundedByThermalHeadroom === true &&
    receipt.truth?.nativeLayerTemperaturesWithinDeclaredEnvelope === true &&
    receipt.truth?.postMaterialTemperatureClipRequired === false;
  return check('native-phase-thermal-envelope',
    currentTemperaturesValid && receiptValid ? 'PASS' : 'FAIL',
    'Native phase changes move only the mass whose latent heat fits the declared layer-temperature envelope.', {
      expectedDynamicsSchema: ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
      actualDynamicsSchema: receipt.schema || null,
      expectedLayerPhaseSchema: ATMOSPHERE_PRESSURE_LAYER_PHASE_SCHEMA,
      phaseThermalEnvelopeSchema:
        receipt.phaseThermalEnvelopeSchema || null,
      minimumAirTemperatureC: MIN_NATIVE_LAYER_AIR_TEMPERATURE_C,
      maximumAirTemperatureC: MAX_NATIVE_LAYER_AIR_TEMPERATURE_C,
      currentTemperaturesValid,
      layerReceiptCount: layerReceipts.length,
      thermalEnvelopeLimitCount: receipt.thermalEnvelopeLimitCount ?? null,
      thermallyLimitedLayerCount: receipt.thermallyLimitedLayerCount ?? null,
      maximumThermallyRejectedRequestMm:
        receipt.maximumThermallyRejectedRequestMm ?? null,
      residuals: receipt.residuals || null
    });
}

function deepOceanCheck(column) {
  if (column?.kind !== 'ocean') {
    return check('deep-ocean-lineage', 'NOT_APPLICABLE',
      'Only ocean columns require a deep-ocean organ.',
      { kind: column?.kind || null }, { required: false });
  }
  const deep = column?.ocean?.ecology?.deepOcean;
  return check('deep-ocean-lineage',
    deep?.schema === DEEP_OCEAN_STATE_SCHEMA ? 'PASS' : 'FAIL',
    'Ocean columns retain the typed persistent deep-ocean reservoir.', {
      expectedSchema: DEEP_OCEAN_STATE_SCHEMA,
      actualSchema: deep?.schema || null
    });
}

function deepOceanAlkalinityCheck(column) {
  if (column?.kind !== 'ocean') {
    return check('mixed-deep-ocean-alkalinity-ledger', 'NOT_APPLICABLE',
      'Only ocean columns require a mixed-to-deep alkalinity ledger.',
      { kind: column?.kind || null }, { required: false });
  }
  const ecology = column?.ocean?.ecology;
  const deep = ecology?.deepOcean;
  const receipt = deep?.lastExchangeReceipt;
  const ownerValid = ecology?.schema === EARTH_OCEAN_ECOLOGY_SCHEMA &&
    deep?.schema === DEEP_OCEAN_STATE_SCHEMA &&
    finite(ecology?.alkalinity?.dissolvedKgCaCO3Eqm2) &&
    Number(ecology.alkalinity.dissolvedKgCaCO3Eqm2) >= 0 &&
    finite(deep?.alkalinity?.dissolvedKgCaCO3Eqm2) &&
    Number(deep.alkalinity.dissolvedKgCaCO3Eqm2) >= 0;
  if (!receipt) {
    return check('mixed-deep-ocean-alkalinity-ledger',
      ownerValid ? 'NOT_APPLICABLE' : 'FAIL',
      'Typed mixed-layer and deep-ocean alkalinity owners exchange only through a conservative signed receipt.', {
        ownerValid,
        reason: ownerValid
          ? 'owners are present but no committed vertical exchange receipt is available yet'
          : 'a typed finite alkalinity owner is missing',
        mixedLayerAlkalinityKgCaCO3Eqm2:
          ecology?.alkalinity?.dissolvedKgCaCO3Eqm2 ?? null,
        deepOceanAlkalinityKgCaCO3Eqm2:
          deep?.alkalinity?.dissolvedKgCaCO3Eqm2 ?? null,
        migrationCheckpoint: deep?.migrationCheckpoint ?? null
      }, { required: !ownerValid });
  }
  const nestedReceipt = ecology?.lastFluxReceipt?.deepOcean;
  const valid = ownerValid &&
    receipt.schema === DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA &&
    nestedReceipt?.schema === DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA &&
    finite(receipt.dissolvedExchange
      ?.alkalinitySurfaceToDeepKgCaCO3Eqm2) &&
    close(receipt.conservation?.alkalinityResidualKgCaCO3Eqm2, 1e-9) &&
    receipt.truth?.persistentDeepAlkalinityReservoir === true &&
    receipt.truth?.conservativeVerticalAlkalinityExchange === true &&
    receipt.truth?.alkalinityIsAcidNeutralizingCapacityEquivalent === true &&
    receipt.truth?.measuredAlkalinityClaimed === false &&
    receipt.truth?.carbonateSpeciationResolved === false &&
    receipt.truth?.pHResolved === false &&
    ecology.lastFluxReceipt?.truth?.mixedToDeepAlkalinityClosed === true;
  return check('mixed-deep-ocean-alkalinity-ledger',
    valid ? 'PASS' : 'FAIL',
    'Typed mixed-layer and deep-ocean alkalinity owners exchange only through a conservative signed receipt.', {
      expectedStateSchema: DEEP_OCEAN_STATE_SCHEMA,
      actualStateSchema: deep?.schema || null,
      expectedReceiptSchema: DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA,
      actualReceiptSchema: receipt?.schema || null,
      ownerValid,
      mixedLayerAlkalinityKgCaCO3Eqm2:
        ecology?.alkalinity?.dissolvedKgCaCO3Eqm2 ?? null,
      deepOceanAlkalinityKgCaCO3Eqm2:
        deep?.alkalinity?.dissolvedKgCaCO3Eqm2 ?? null,
      signedSurfaceToDeepKgCaCO3Eqm2: receipt.dissolvedExchange
        ?.alkalinitySurfaceToDeepKgCaCO3Eqm2 ?? null,
      residualKgCaCO3Eqm2: receipt.conservation
        ?.alkalinityResidualKgCaCO3Eqm2 ?? null,
      boundaries: {
        measuredAlkalinityClaimed: false,
        carbonateSpeciationResolved: false,
        pHResolved: false,
        threeDimensionalOceanCirculation: false
      }
    });
}

function mixedLayerCarbonateCheck(column) {
  if (column?.kind !== 'ocean') {
    return check('mixed-layer-carbonate-diagnostic', 'NOT_APPLICABLE',
      'Only ocean columns expose the bounded mixed-layer carbonate diagnostic.',
      { kind: column?.kind || null }, { required: false });
  }
  const ecology = column?.ocean?.ecology;
  const diagnostic = ecology?.carbonateSystem;
  const source = diagnostic?.sourceOwners;
  const sourceBound = same(source?.dissolvedInorganicCarbonKgCm2,
    ecology?.carbon?.dissolvedInorganicKgCm2, 1e-9) &&
    same(source?.alkalinityKgCaCO3Eqm2,
      ecology?.alkalinity?.dissolvedKgCaCO3Eqm2, 1e-9) &&
    same(source?.dissolvedInorganicPhosphorusKgPm2,
      ecology?.phosphorus?.dissolvedInorganicKgPm2, 1e-9) &&
    same(source?.mixedLayerDepthM, ecology?.traits?.mixedLayerDepthM, 1e-6) &&
    same(source?.temperatureC, ecology?.physiology?.temperatureC, 1e-6) &&
    same(source?.salinityPsu, ecology?.physiology?.salinityPsu, 1e-6);
  const boundaryTruthValid = diagnostic?.truth?.diagnosticOnly === true &&
    diagnostic?.truth?.mutatesMaterial === false &&
    diagnostic?.truth?.sourceOwnerBinding === true &&
    diagnostic?.truth?.totalHydrogenScale === true &&
    diagnostic?.truth?.surfacePressureOnly === true &&
    diagnostic?.truth?.phosphateAlkalinityIncluded === true &&
    diagnostic?.truth?.silicateAlkalinityIncluded === false &&
    diagnostic?.truth?.fluorideAlkalinityIncluded === false &&
    diagnostic?.truth?.pressureCorrectionsIncluded === false &&
    diagnostic?.truth?.measuredInputsClaimed === false &&
    diagnostic?.truth?.pHFeedbackModeled === false &&
    diagnostic?.truth?.deepOceanPHResolved === false &&
    diagnostic?.waterMassConversion?.referenceDensityKgM3 === 1000 &&
    diagnostic?.waterMassConversion?.measuredDensityClaimed === false;
  const solved = diagnostic?.status === 'SOLVED';
  const solvedValid = solved && finite(diagnostic?.solution?.pHTotal) &&
    Number(diagnostic.solution.pHTotal) >= 3 &&
    Number(diagnostic.solution.pHTotal) <= 12 &&
    diagnostic?.truth?.constantsWithinPublishedEnvelope === true &&
    diagnostic?.truth?.carbonateMassClosed === true &&
    diagnostic?.truth?.phosphateMassClosed === true &&
    diagnostic?.truth?.alkalinityResidualClosed === true &&
    close(diagnostic?.closure?.dicResidualMolKg, 1e-12) &&
    close(diagnostic?.closure?.phosphateResidualMolKg, 1e-12) &&
    close(diagnostic?.closure?.alkalinityResidualMolKg, 1e-12);
  const typedNonSolution = diagnostic?.solution === null && (
    (diagnostic?.status === 'OUTSIDE_CONSTANT_VALIDITY' &&
      diagnostic?.truth?.constantsWithinPublishedEnvelope === false) ||
    diagnostic?.status === 'INSUFFICIENT_MATERIAL_STATE');
  const valid = ecology?.schema === EARTH_OCEAN_ECOLOGY_SCHEMA &&
    diagnostic?.schema === MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA &&
    sourceBound && boundaryTruthValid && (solvedValid || typedNonSolution);
  return check('mixed-layer-carbonate-diagnostic', valid ? 'PASS' : 'FAIL',
    'The mixed-layer DIC, alkalinity and phosphate owners feed a bounded, mass-preserving total-scale carbonate observer or an explicit typed refusal.', {
      expectedSchema: MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA,
      actualSchema: diagnostic?.schema || null,
      status: diagnostic?.status || null,
      reason: diagnostic?.reason || null,
      sourceBound,
      pHTotal: diagnostic?.solution?.pHTotal ?? null,
      dicResidualMolKg: diagnostic?.closure?.dicResidualMolKg ?? null,
      phosphateResidualMolKg:
        diagnostic?.closure?.phosphateResidualMolKg ?? null,
      alkalinityResidualMolKg:
        diagnostic?.closure?.alkalinityResidualMolKg ?? null,
      boundaries: {
        diagnosticOnly: diagnostic?.truth?.diagnosticOnly ?? null,
        surfacePressureOnly: diagnostic?.truth?.surfacePressureOnly ?? null,
        silicateAlkalinityIncluded:
          diagnostic?.truth?.silicateAlkalinityIncluded ?? null,
        fluorideAlkalinityIncluded:
          diagnostic?.truth?.fluorideAlkalinityIncluded ?? null,
        pHFeedbackModeled: diagnostic?.truth?.pHFeedbackModeled ?? null,
        deepOceanPHResolved: diagnostic?.truth?.deepOceanPHResolved ?? null,
        referenceDensityKgM3:
          diagnostic?.waterMassConversion?.referenceDensityKgM3 ?? null
      }
    });
}

function airSeaCarbonExchangeCheck(column) {
  if (column?.kind !== 'ocean') {
    return check('carbonate-informed-air-sea-carbon-exchange',
      'NOT_APPLICABLE',
      'Only ocean columns require carbonate-informed air-sea carbon exchange.',
      { kind: column?.kind || null }, { required: false });
  }
  const ecology = column?.ocean?.ecology;
  const receipt = ecology?.lastFluxReceipt;
  const exchange = receipt?.carbon?.airSeaCarbonExchange;
  if (!exchange) {
    const ownerReady = ecology?.schema === EARTH_OCEAN_ECOLOGY_SCHEMA;
    return check('carbonate-informed-air-sea-carbon-exchange',
      ownerReady ? 'NOT_APPLICABLE' : 'FAIL',
      'A committed ocean step binds carbonate CO2-star to a paired atmosphere-DIC owner move or a typed zero-flux refusal.', {
        ownerReady,
        reason: ownerReady
          ? 'typed ocean owners are present but no current R54 flux receipt is committed yet'
          : 'the current ocean ecology owner is absent',
        actualOceanSchema: ecology?.schema || null
      }, { required: !ownerReady });
  }
  const source = exchange.sourceOwners;
  const diagnostic = exchange.sourceDiagnostic;
  const equilibrium = exchange.equilibrium;
  const transfer = exchange.transfer;
  const application = exchange.application;
  const signed = Number(exchange.signedCarbonToOceanKgCm2);
  const applied = Number(application?.appliedSignedCarbonToOceanKgCm2);
  const receiptFlux = Number(receipt?.carbon?.airSeaCo2FluxToOceanKgCm2);
  const sourceBound = same(diagnostic?.sourceOwners
    ?.dissolvedInorganicCarbonKgCm2,
  source?.dissolvedInorganicCarbonKgCm2, 1e-9) &&
    same(diagnostic?.sourceOwners?.alkalinityKgCaCO3Eqm2,
      source?.alkalinityKgCaCO3Eqm2, 1e-9) &&
    same(diagnostic?.sourceOwners?.dissolvedInorganicPhosphorusKgPm2,
      source?.dissolvedInorganicPhosphorusKgPm2, 1e-9) &&
    same(diagnostic?.sourceOwners?.mixedLayerDepthM,
      source?.mixedLayerDepthM, 1e-6) &&
    same(diagnostic?.sourceOwners?.temperatureC,
      source?.temperatureC, 1e-6) &&
    same(diagnostic?.sourceOwners?.salinityPsu,
      source?.salinityPsu, 1e-6);
  const schemaValid = ecology?.schema === EARTH_OCEAN_ECOLOGY_SCHEMA &&
    exchange.schema === AIR_SEA_CARBON_EXCHANGE_PROPOSAL_SCHEMA &&
    exchange.method === AIR_SEA_CARBON_EXCHANGE_METHOD.id;
  const applicationValid = finite(signed) && finite(applied) &&
    finite(receiptFlux) && same(applied, signed, 1e-9) &&
    same(receiptFlux, applied, 1e-9) &&
    application?.pairedOwnerMove === true &&
    application?.proposalMatched === true &&
    application?.combinedAtmosphereAndOceanCarbonClosed === true &&
    receipt?.truth?.airSeaCarbonOwnerMoveMatchedProposal === true &&
    receipt?.truth?.carbonClosed === true &&
    close(receipt?.carbon?.residualKgCm2, 1e-9);
  const boundaryTruthValid = exchange?.truth?.proposalOnly === true &&
    exchange?.truth?.mutatesMaterial === false &&
    exchange?.truth?.atmosphericCo2IsMeasured === false &&
    exchange?.truth?.oceanPco2IsMeasured === false &&
    exchange?.truth?.oceanSkinTemperatureMeasured === false &&
    exchange?.truth?.scientificGasTransferVelocity === false &&
    exchange?.truth?.boundedBulkRelaxation === true &&
    receipt?.truth?.scientificAirSeaGasTransferVelocity === false &&
    receipt?.truth?.measuredAirSeaPco2 === false &&
    receipt?.truth?.measuredOceanSkinTemperature === false;
  const solved = String(exchange.status || '').startsWith('SOLVED_');
  let methodValuesValid = false;
  let directionValid = false;
  let senderBounded = false;
  if (solved) {
    const solubility = weiss1974Co2Solubility(
      source?.temperatureC, source?.salinityPsu);
    const vaporPressure = weissPrice1980SeawaterVaporPressureAtm(
      source?.temperatureC, source?.salinityPsu);
    const fugacity = weiss1974Co2FugacityFactor(
      source?.temperatureC, source?.surfacePressureHpa);
    const totalPressureAtm = Number(source?.surfacePressureHpa) / 1013.25;
    const dryAirPressureAtm = totalPressureAtm - Number(vaporPressure);
    const co2MoleFraction = Number(source?.atmosphericCo2PpmProxy) / 1e6;
    const pco2Atm = co2MoleFraction * dryAirPressureAtm;
    const fco2Atm = pco2Atm * Number(fugacity?.fugacityFactor);
    const expectedEquilibriumCo2Star = Number(solubility?.k0MolKgAtm) *
      fco2Atm * 1e6;
    const expectedDisequilibrium = expectedEquilibriumCo2Star -
      Number(diagnostic?.actualCo2StarMicromolKg);
    const waterMassKgM2 = Number(source?.mixedLayerDepthM) *
      AIR_SEA_CARBON_EXCHANGE_METHOD.referenceWaterDensityKgM3;
    const rawSigned = expectedDisequilibrium / 1e6 * waterMassKgM2 *
      AIR_SEA_CARBON_EXCHANGE_METHOD.carbonKgPerMol *
      Number(source?.relaxationFraction);
    const expectedSigned = rawSigned >= 0
      ? Math.min(rawSigned, Number(source?.atmosphericCarbonKgCm2))
      : Math.max(rawSigned,
        -Number(source?.dissolvedInorganicCarbonKgCm2));
    const expectedDirection = expectedSigned > 1e-15
      ? 'atmosphere-to-ocean' : expectedSigned < -1e-15
        ? 'ocean-to-atmosphere' : 'equilibrium';
    const expectedStatus = expectedDirection === 'atmosphere-to-ocean'
      ? 'SOLVED_UPTAKE' : expectedDirection === 'ocean-to-atmosphere'
        ? 'SOLVED_OUTGASSING' : 'SOLVED_EQUILIBRIUM';
    methodValuesValid = Boolean(solubility && fugacity &&
      finite(vaporPressure)) &&
      same(equilibrium?.weiss1974LnK0, solubility?.lnK0, 1e-12) &&
      same(equilibrium?.weiss1974K0MolKgAtm,
        solubility?.k0MolKgAtm, 1e-15) &&
      same(equilibrium?.seawaterVaporPressureAtm,
        vaporPressure, 1e-15) &&
      same(equilibrium?.dryAirPressureAtm, dryAirPressureAtm, 1e-12) &&
      same(equilibrium?.atmosphericPco2Atm, pco2Atm, 1e-12) &&
      same(equilibrium?.co2FugacityFactor,
        fugacity?.fugacityFactor, 1e-15) &&
      same(equilibrium?.atmosphericFco2Atm, fco2Atm, 1e-12) &&
      same(equilibrium?.equilibriumCo2StarMicromolKg,
        expectedEquilibriumCo2Star, 1e-8) &&
      same(equilibrium?.co2StarDisequilibriumMicromolKg,
        expectedDisequilibrium, 1e-8) &&
      same(transfer?.mixedLayerWaterMassKgM2, waterMassKgM2, 1e-6) &&
      same(transfer?.unboundedSignedCarbonToOceanKgCm2,
        rawSigned, 1e-12) && same(signed, expectedSigned, 1e-12);
    directionValid = transfer?.direction === expectedDirection &&
      exchange.status === expectedStatus &&
      receipt?.truth?.carbonateInformedAirSeaCo2Exchange === true &&
      receipt?.truth?.airSeaCarbonExchangeTypedRefusal === false;
    senderBounded = signed >= -Number(source?.dissolvedInorganicCarbonKgCm2) -
      1e-12 && signed <= Number(source?.atmosphericCarbonKgCm2) + 1e-12 &&
      exchange?.truth?.senderBounded === true &&
      receipt?.truth?.airSeaCarbonExchangeSourceBound === true;
  }
  const solvedValid = solved && sourceBound &&
    diagnostic?.schema === MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA &&
    diagnostic?.status === 'SOLVED' &&
    diagnostic?.truth?.constantsWithinPublishedEnvelope === true &&
    diagnostic?.truth?.carbonateMassClosed === true &&
    diagnostic?.truth?.phosphateMassClosed === true &&
    diagnostic?.truth?.alkalinityResidualClosed === true &&
    exchange?.truth?.sourceDiagnosticSolved === true &&
    exchange?.truth?.sourceOwnerBinding === true &&
    exchange?.truth?.wetAirPartialPressureIncluded === true &&
    exchange?.truth?.fugacityNonidealityIncluded === true &&
    receipt?.truth?.airSeaCo2FugacityCorrection === true &&
    methodValuesValid && directionValid && senderBounded;
  const typedStatuses = new Set([
    'CARBONATE_DIAGNOSTIC_UNAVAILABLE',
    'CARBONATE_SOURCE_MISMATCH',
    'OUTSIDE_METHOD_VALIDITY',
    'METHOD_UNRESOLVED',
    'INVALID_INPUT'
  ]);
  const typedRefusalValid = !solved && typedStatuses.has(exchange.status) &&
    same(signed, 0) && same(applied, 0) && same(receiptFlux, 0) &&
    receipt?.truth?.carbonateInformedAirSeaCo2Exchange === false &&
    receipt?.truth?.airSeaCarbonExchangeTypedRefusal === true;
  const valid = schemaValid && applicationValid && boundaryTruthValid &&
    (solvedValid || typedRefusalValid);
  return check('carbonate-informed-air-sea-carbon-exchange',
    valid ? 'PASS' : 'FAIL',
    'A committed ocean step binds carbonate CO2-star and wet-air CO2 fugacity to a bounded paired atmosphere-DIC owner move or a typed zero-flux refusal.', {
      expectedSchema: AIR_SEA_CARBON_EXCHANGE_PROPOSAL_SCHEMA,
      actualSchema: exchange.schema || null,
      expectedMethod: AIR_SEA_CARBON_EXCHANGE_METHOD.id,
      actualMethod: exchange.method || null,
      status: exchange.status || null,
      sourceBound,
      actualCo2StarMicromolKg:
        equilibrium?.actualCo2StarMicromolKg ?? null,
      equilibriumCo2StarMicromolKg:
        equilibrium?.equilibriumCo2StarMicromolKg ?? null,
      atmosphericPco2Atm: equilibrium?.atmosphericPco2Atm ?? null,
      atmosphericFco2Atm: equilibrium?.atmosphericFco2Atm ?? null,
      fugacityFactor: equilibrium?.co2FugacityFactor ?? null,
      direction: transfer?.direction ?? null,
      proposedSignedCarbonToOceanKgCm2: finite(signed) ? signed : null,
      appliedSignedCarbonToOceanKgCm2: finite(applied) ? applied : null,
      criteria: {
        schemaValid,
        sourceBound,
        applicationValid,
        boundaryTruthValid,
        methodValuesValid,
        directionValid,
        senderBounded,
        solvedValid,
        typedRefusalValid
      },
      boundaries: {
        atmosphericCo2Measured: false,
        oceanPco2Measured: false,
        oceanSkinTemperatureMeasured: false,
        scientificGasTransferVelocity: false,
        speciesResolvedPHResponse: false
      }
    });
}

function soilRunoffBiogeochemistryCheck(column) {
  if (column?.kind !== 'land') {
    return check('soil-runoff-biogeochemistry-lineage', 'NOT_APPLICABLE',
      'Only land columns require finite soil-water and runoff chemistry.',
      { kind: column?.kind || null }, { required: false });
  }
  const soil = column?.land?.soilBiogeochemistry;
  const queue = column?.routing?.runoffBiogeochemistryQueue;
  const mobilization = soil?.lastMobilizationReceipt;
  const valid = soil?.schema === SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA &&
    queue?.schema === RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA &&
    finite(soil?.pools?.alkalinityKgCaCO3Eqm2) &&
    finite(queue?.pools?.alkalinityKgCaCO3Eqm2) &&
    soil?.truth?.alkalinityIsAcidNeutralizingCapacityEquivalent === true &&
    soil?.truth?.measuredAlkalinityClaimed === false &&
    soil?.truth?.carbonateSpeciationResolved === false &&
    soil?.truth?.pHResolved === false &&
    (!mobilization ||
      (mobilization.schema === SOIL_RUNOFF_MOBILIZATION_SCHEMA &&
       Object.values(mobilization.conservation || {})
         .every(value => close(value, 1e-9)))) &&
    (!queue?.lastTransferReceipt ||
      queue.lastTransferReceipt.schema ===
        RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA);
  return check('soil-runoff-biogeochemistry-lineage',
    valid ? 'PASS' : 'FAIL',
    'Land retains finite soil-water C/N/P/O2/alkalinity and a typed persistent runoff queue.', {
      expectedSoilSchema: SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA,
      actualSoilSchema: soil?.schema || null,
      expectedQueueSchema: RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA,
      actualQueueSchema: queue?.schema || null,
      mobilizationSchema: mobilization?.schema || null,
      migrationCheckpoint: soil?.migrationCheckpoint ?? null,
      alkalinityMigrationCheckpoint:
        soil?.alkalinityMigrationCheckpoint ?? null,
      soilAlkalinityKgCaCO3Eqm2:
        soil?.pools?.alkalinityKgCaCO3Eqm2 ?? null,
      queueAlkalinityKgCaCO3Eqm2:
        queue?.pools?.alkalinityKgCaCO3Eqm2 ?? null
    });
}

function geomorphicSedimentCheck(column) {
  if (column?.kind === 'ocean') {
    const coastal = column?.ocean?.coastalSediment;
    const lastInputAudit = coastal?.lastInputReceipt
      ? auditSedimentTransferReceipt(coastal.lastInputReceipt) : null;
    const valid = coastal?.schema === COASTAL_SEDIMENT_STATE_SCHEMA &&
      (!coastal.lastInputReceipt ||
        coastal.lastInputReceipt.schema === COASTAL_SEDIMENT_INPUT_SCHEMA &&
        lastInputAudit?.valid === true);
    return check('geomorphic-sediment-lineage', valid ? 'PASS' : 'FAIL',
      'Ocean columns retain typed suspended and deposited coastal mineral sediment.', {
        expectedCoastalSchema: COASTAL_SEDIMENT_STATE_SCHEMA,
        actualCoastalSchema: coastal?.schema || null,
        lastInputSchema: coastal?.lastInputReceipt?.schema || null,
        lastInputAudit
      });
  }
  const surface = column?.land?.surfaceSediment;
  const queue = column?.routing?.runoffSedimentQueue;
  const erosion = surface?.lastErosionReceipt;
  const queueTransferAudit = queue?.lastTransferReceipt
    ? auditSedimentTransferReceipt(queue.lastTransferReceipt) : null;
  const valid = surface?.schema === SURFACE_SEDIMENT_STATE_SCHEMA &&
    queue?.schema === RUNOFF_SEDIMENT_QUEUE_SCHEMA &&
    (!erosion || erosion.schema === SURFACE_EROSION_RECEIPT_SCHEMA &&
      erosion.truth?.conservationClosed === true) &&
    (!queue?.lastTransferReceipt ||
      queue.lastTransferReceipt.schema === RUNOFF_SEDIMENT_TRANSFER_SCHEMA &&
      queueTransferAudit?.valid === true) &&
    surface.truth?.finiteMineralOwnership === true;
  return check('geomorphic-sediment-lineage', valid ? 'PASS' : 'FAIL',
    'Land columns retain finite grain-resolved surface sediment and a typed runoff queue.', {
      expectedSurfaceSchema: SURFACE_SEDIMENT_STATE_SCHEMA,
      actualSurfaceSchema: surface?.schema || null,
      expectedQueueSchema: RUNOFF_SEDIMENT_QUEUE_SCHEMA,
      actualQueueSchema: queue?.schema || null,
      erosionSchema: erosion?.schema || null,
      migrationCheckpoint: surface?.migrationCheckpoint ?? null,
      queueTransferSchema: queue?.lastTransferReceipt?.schema || null,
      queueTransferAudit
    });
}

function transportCheck(receipt) {
  if (!receipt) {
    return check('loaded-transport-receipt', 'NOT_APPLICABLE',
      'A loaded-domain transport receipt is structurally honest when observed.',
      { reason: 'no loaded transport receipt supplied' }, { required: false });
  }
  if ([PREVIOUS_EARTH_TRANSPORT_STEP_SCHEMA,
    LEGACY_EARTH_TRANSPORT_STEP_SCHEMA].includes(receipt.schema)) {
    return check('loaded-transport-receipt', 'NOT_APPLICABLE',
      'A loaded-domain transport receipt is structurally honest when observed.', {
        reason: receipt.schema === PREVIOUS_EARTH_TRANSPORT_STEP_SCHEMA
          ? 'legacy transport receipt predates native-layer gas composition evidence'
          : 'legacy transport receipt predates the atmospheric gas route seam',
        expectedSchema: EARTH_TRANSPORT_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const valid = receipt.schema === EARTH_TRANSPORT_STEP_SCHEMA &&
    receipt.truth?.conservativeNeighborExchange === true &&
    receipt.truth?.explicitUnloadedBoundaries === true &&
    receipt.truth?.loadedAtmosphericBiogeochemistryTransport === true &&
    receipt.truth?.persistentRunoffBiogeochemistryQueue === true &&
    receipt.truth?.runoffBiogeochemistrySenderDebited === true &&
    receipt.truth?.landAndOceanRunoffReceiversCredited === true &&
    receipt.truth?.persistentRunoffSedimentQueue === true &&
    receipt.truth?.runoffSedimentSenderDebited === true &&
    receipt.truth?.landAndCoastalSedimentReceiversCredited === true &&
    receipt.truth?.runoffSedimentScaleAwareNumericClosure === true &&
    receipt.truth?.runoffSedimentPerGrainNumericBounds === true &&
    receipt.truth?.runoffSedimentMeasuredResidualsPreserved === true &&
    receipt.truth?.parameterizedLandRunoffChemistryBoundary === false &&
    (receipt.runoffReceipts || []).filter(entry => entry.status === 'routed')
      .every(entry =>
        entry.runoffBiogeochemistryTransfer?.senderDebit?.schema ===
          RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA &&
        entry.runoffBiogeochemistryTransfer?.receiverCredit?.schema &&
        entry.transferId === entry.runoffBiogeochemistryTransfer
          .senderDebit.transferId &&
        entry.transferId === entry.runoffBiogeochemistryTransfer
          .receiverCredit.transferId &&
        Object.values(entry.runoffBiogeochemistryTransfer.senderDebit
          .conservation || {}).every(value => close(value, 1e-6)) &&
        Object.values(entry.runoffBiogeochemistryTransfer.receiverCredit
          .conservation || {}).every(value => close(value, 1e-6))) &&
    (receipt.runoffReceipts || []).filter(entry => entry.status === 'routed')
      .every(entry =>
        entry.runoffSedimentTransfer?.senderDebit?.schema ===
          RUNOFF_SEDIMENT_TRANSFER_SCHEMA &&
        entry.runoffSedimentTransfer?.receiverCredit?.schema &&
        entry.transferId === entry.runoffSedimentTransfer
          .senderDebit.transferId &&
        entry.transferId === entry.runoffSedimentTransfer
          .receiverCredit.transferId &&
        auditSedimentTransferReceipt(entry.runoffSedimentTransfer
          .senderDebit).valid === true &&
        auditSedimentTransferReceipt(entry.runoffSedimentTransfer
          .receiverCredit).valid === true) &&
    ['Carbon', 'Nitrogen', 'Phosphorus', 'Oxygen'].every(element =>
      close(receipt.conservation?.[
        `runoffBiogeochemistry${element}ResidualKg`], 1) &&
      close(receipt.conservation?.[
        `runoffReceivingOcean${element}ResidualKg`], 1)) &&
    ['Clay', 'Silt', 'Sand', 'Gravel'].every(grain =>
      close(receipt.conservation?.[
        `runoffSediment${grain}ResidualKg`], 1) &&
      close(receipt.conservation?.[
        `coastalSediment${grain}ResidualKg`], 1)) &&
    receipt.atmosphereBiogeochemistryTransportReceipt?.schema ===
      ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA &&
    receipt.atmosphereBiogeochemistryTransportReceipt?.truth
      ?.nativePressureLayerComposition === true &&
    receipt.atmosphereBiogeochemistryTransportReceipt?.truth
      ?.wholeColumnAverageUsed === false &&
    receipt.atmosphereBiogeochemistryTransportReceipt?.layerSummaries?.length ===
      ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT &&
    receipt.atmosphereBiogeochemistryTransportReceipt.layerSummaries
      .every(layer => Object.values(layer.conservation || {})
        .every(value => close(value, 1))) &&
    Object.values(receipt.atmosphereBiogeochemistryTransportReceipt
      .conservation || {}).every(value => close(value, 1)) &&
    receipt.truth?.globalCirculationModel === false &&
    Object.values(receipt.conservation || {}).every(finite);
  return check('loaded-transport-receipt', valid ? 'PASS' : 'FAIL',
    'Loaded transport is typed, conservative, boundary-explicit and not mislabeled global.', {
      expectedSchema: EARTH_TRANSPORT_STEP_SCHEMA,
      actualSchema: receipt.schema || null,
      finiteResidualCount: Object.values(receipt.conservation || {})
        .filter(finite).length,
      declaredResidualCount: Object.keys(receipt.conservation || {}).length,
      atmosphericGasTransportSchema:
        receipt.atmosphereBiogeochemistryTransportReceipt?.schema || null
    });
}

const BASIN_AGGREGATE_IDENTITY_IDS = Object.freeze([
  'waterResidualKg',
  'coupledCarbonResidualKgC',
  'coupledNitrogenResidualKgN',
  'coupledPhosphorusResidualKgP',
  'coupledOxygenResidualKgO2',
  'coupledAlkalinityResidualKgCaCO3Eq',
  'loadedLandFloodplainPlantCarbonResidualKgC',
  'loadedLandFloodplainPlantNitrogenResidualKgN',
  'coupledClayResidualKg',
  'coupledSiltResidualKg',
  'coupledSandResidualKg',
  'coupledGravelResidualKg'
]);

function auditBasinAggregateMassClosure(receipt) {
  const closure = receipt?.aggregateMassClosure || {};
  const identities = closure.identities || {};
  const identityKeys = Object.keys(identities).sort();
  const expectedKeys = [...BASIN_AGGREGATE_IDENTITY_IDS].sort();
  const identitySetValid = identityKeys.length === expectedKeys.length &&
    identityKeys.every((key, index) => key === expectedKeys[index]);
  const diagnostics = {};
  let identitiesValid = identitySetValid;

  for (const identity of BASIN_AGGREGATE_IDENTITY_IDS) {
    const entry = identities[identity] || {};
    const signedOperandsKg = entry.signedOperandsKg;
    const operandsValid = Array.isArray(signedOperandsKg) &&
      signedOperandsKg.length > 0 && signedOperandsKg.every(finite);
    const recomputedResidualKg = operandsValid ? signedOperandsKg.reduce(
      (sum, operand) => sum + Number(operand), 0) : NaN;
    const absoluteOperandSumKg = operandsValid ? signedOperandsKg.reduce(
      (sum, operand) => sum + Math.abs(Number(operand)), 0) : NaN;
    const expectedToleranceKg = operandsValid ? roundAudit(Math.max(
      BASIN_AGGREGATE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG,
      absoluteOperandSumKg * Number.EPSILON *
        BASIN_AGGREGATE_MASS_CLOSURE_ULP_FACTOR
    ), 12) : NaN;
    const expectedUtilization = operandsValid ? roundAudit(
      Math.abs(recomputedResidualKg) / expectedToleranceKg, 12) : NaN;
    const expectedClosed = operandsValid &&
      Math.abs(recomputedResidualKg) <= expectedToleranceKg;
    const residualMatches = same(entry.residualKg,
      recomputedResidualKg, 1e-9);
    const toleranceMatches = same(entry.numericToleranceKg,
      expectedToleranceKg, 1e-9);
    const utilizationMatches = same(entry.toleranceUtilization,
      expectedUtilization, 1e-9);
    const conservationMatches = same(receipt?.conservation?.[identity],
      recomputedResidualKg, identity === 'waterResidualKg' ? 5.01e-4 :
        5.01e-7);
    const valid = operandsValid && residualMatches && toleranceMatches &&
      utilizationMatches && conservationMatches &&
      entry.closed === expectedClosed;
    diagnostics[identity] = {
      valid,
      operandCount: Array.isArray(signedOperandsKg) ?
        signedOperandsKg.length : null,
      recomputedResidualKg: finite(recomputedResidualKg) ?
        recomputedResidualKg : null,
      expectedToleranceKg: finite(expectedToleranceKg) ?
        expectedToleranceKg : null,
      expectedClosed,
      residualMatches,
      toleranceMatches,
      utilizationMatches,
      conservationMatches
    };
    identitiesValid = identitiesValid && valid;
  }

  const validDiagnostics = Object.values(diagnostics);
  const maximumResidualKg = Math.max(0, ...validDiagnostics.map(entry =>
    Math.abs(Number(entry.recomputedResidualKg) || 0)));
  const maximumToleranceKg = Math.max(0, ...validDiagnostics.map(entry =>
    Number(entry.expectedToleranceKg) || 0));
  const maximumToleranceUtilization = Math.max(0,
    ...BASIN_AGGREGATE_IDENTITY_IDS.map(identity =>
      Number(identities[identity]?.toleranceUtilization) || 0));
  const policyValid =
    closure.policy?.schema ===
      BASIN_AGGREGATE_MASS_CLOSURE_POLICY_SCHEMA &&
    closure.policy?.absoluteFloorKg ===
      BASIN_AGGREGATE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG &&
    closure.policy?.ulpFactor ===
      BASIN_AGGREGATE_MASS_CLOSURE_ULP_FACTOR &&
    closure.policy?.scaleBasis ===
      'sum-of-absolute-unrounded-signed-operands-kg';
  const summaryValid = closure.identityCount === expectedKeys.length &&
    same(closure.maximumResidualKg, maximumResidualKg, 1e-9) &&
    same(closure.maximumToleranceKg, maximumToleranceKg, 1e-9) &&
    same(closure.maximumToleranceUtilization,
      maximumToleranceUtilization, 1e-9) &&
    closure.conservationClosed === validDiagnostics.every(entry =>
      entry.expectedClosed === true) &&
    closure.measuredResidualsPreserved === true;
  return {
    valid: closure.schema === BASIN_AGGREGATE_MASS_CLOSURE_SCHEMA &&
      policyValid && identitiesValid && summaryValid,
    policyValid,
    identitySetValid,
    identitiesValid,
    summaryValid,
    diagnostics
  };
}

function basinCheck(receipt) {
  if (!receipt) {
    return check('basin-routing-receipt', 'NOT_APPLICABLE',
      'A basin receipt closes water and coupled material when observed.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('basin-routing-receipt', 'NOT_APPLICABLE',
      'A basin receipt closes water and coupled material when observed.', {
        reason: 'legacy basin receipt predates persistent land-runoff chemistry sender debits',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const conservation = receipt.conservation || {};
  const coupled = Object.entries(conservation)
    .filter(([key]) => key === 'waterResidualKg' ||
      key.startsWith('coupled') ||
      key.startsWith('loadedLandFloodplainPlant'));
  const schemaCurrent = receipt.schema === BASIN_ROUTING_STEP_SCHEMA;
  const aggregateMassClosureAudit =
    auditBasinAggregateMassClosure(receipt);
  const truthBoundaryValid =
    receipt.truth?.coupledBasinAggregateScaleAwareNumericClosure === true &&
    receipt.truth?.coupledBasinAggregatePerIdentityNumericBounds === true &&
    receipt.truth?.coupledBasinAggregateMeasuredResidualsPreserved === true &&
    receipt.truth?.coupledBasinAggregateFixedAbsoluteToleranceOnly === false &&
    receipt.truth?.explicitEstuaryAtmosphericGasReceiver === true &&
    receipt.truth?.parameterizedLandRunoffChemistryBoundary === false &&
    receipt.truth?.persistentLandRunoffBiogeochemistryQueue === true &&
    receipt.truth?.landRunoffBiogeochemistrySenderDebited === true &&
    receipt.truth?.persistentLandRunoffSedimentQueue === true &&
    receipt.truth?.landRunoffSedimentSenderDebited === true &&
    receipt.truth?.persistentRiverSuspendedAndBedSediment === true &&
    receipt.truth?.persistentFloodplainWaterChemistryAndSediment === true &&
    receipt.truth?.persistentRiverAndFloodplainNitrateAmmoniumPools ===
      true &&
    receipt.truth?.exactNitrateAmmoniumReachTransport === true &&
    receipt.truth?.nitrateAmmoniumConservationClosed === true &&
    receipt.truth?.parameterizedRunoffDinSpeciation === true &&
    receipt.truth?.floodplainExchangeConservationClosed === true &&
    receipt.truth?.floodplainExchangeScaleAwareNumericClosure === true &&
    receipt.truth?.floodplainExchangePerIdentityNumericBounds === true &&
    receipt.truth?.floodplainExchangeMeasuredResidualsPreserved === true &&
    receipt.truth?.floodplainExchangeFixedAbsoluteToleranceOnly === false &&
    receipt.truth?.persistentFloodplainHabitatMemory === true &&
    receipt.truth?.floodplainHabitatPotentialOnly === true &&
    receipt.truth?.floodplainHabitatMaterialObserverReadOnly === true &&
    receipt.truth?.floodplainHabitatFractionsNormalized === true &&
    receipt.truth?.persistentBoundedFloodEventHistory === true &&
    receipt.truth?.floodEventHistoryMaterialObserverReadOnly === true &&
    receipt.truth?.floodEventHistoryExchangeEvidenceBound === true &&
    receipt.truth?.floodEventHistoryArchiveBounded === true &&
    receipt.truth?.persistentFloodplainSuccession === true &&
    receipt.truth?.floodplainSuccessionEvidenceBound === true &&
    receipt.truth?.floodplainSuccessionLedgersClosed === true &&
    receipt.truth?.floodplainSuccessionCompetitionBounded === true &&
    receipt.truth?.floodplainSuccessionMaterialAuthority === false &&
    receipt.truth?.persistentFloodplainPlantMatter === true &&
    receipt.truth?.floodplainPlantMatterEvidenceBound === true &&
    receipt.truth?.floodplainPlantMatterLedgersClosed === true &&
    receipt.truth?.landEcologySubgridSenderDebited === true &&
    receipt.truth?.exactLandEcologyFloodplainPlantTransferIds === true &&
    receipt.truth?.loadedLandFloodplainPlantCarbonNitrogenClosed === true &&
    receipt.truth?.floodplainPlantMatterPhosphorusAuthority === false &&
    receipt.truth?.floodplainPlantMatterDoubleCountedWithLandEcology === false &&
    receipt.truth?.persistentFloodplainPlantResources === true &&
    receipt.truth?.floodplainPlantResourcesEvidenceBound === true &&
    receipt.truth?.floodplainPlantResourcesLedgersClosed === true &&
    receipt.truth?.floodplainPlantResourceScaleAwareNumericClosure ===
      true &&
    receipt.truth?.floodplainPlantResourceMeasuredResidualsPreserved ===
      true &&
    receipt.truth?.floodplainPlantResourceSendersAndReceiversClosed === true &&
    receipt.truth?.exactFloodplainPlantResourceTransferIds === true &&
    receipt.truth?.jointCarbonNitrogenPhosphorusWaterLimitedPlantGrowth === true &&
    receipt.truth?.floodplainPlantResourcesWaterPhosphorusClosed === true &&
    receipt.truth?.floodplainPlantResourceIndependentCreation === false &&
    receipt.truth?.persistentFloodplainDecomposition === true &&
    receipt.truth?.floodplainDecompositionEvidenceBound === true &&
    receipt.truth?.floodplainDecompositionSendersAndReceiverClosed === true &&
    receipt.truth?.exactFloodplainDecompositionTransferIds === true &&
    receipt.truth?.floodplainDecompositionLedgersClosed === true &&
    receipt.truth?.onlyResourceBackedFloodplainDetritusDecomposes === true &&
    receipt.truth?.floodplainDecompositionIndependentCreation === false &&
    receipt.truth?.floodplainDecompositionAtmosphericRespirationModeled ===
      false &&
    receipt.truth?.floodplainDecompositionOxygenConsumptionModeled === false &&
    receipt.truth?.persistentFloodplainAerobicRespiration === true &&
    receipt.truth?.floodplainRespirationEvidenceBound === true &&
    receipt.truth?.floodplainRespirationChemistryReceiptsClosed === true &&
    receipt.truth?.floodplainRespirationCarbonAndOxygenLedgersClosed ===
      true &&
    receipt.truth?.floodplainRespirationOxygenLimited === true &&
    receipt.truth?.floodplainRespirationIndependentCreation === false &&
    receipt.truth?.floodplainRespirationAtmosphericGasExchangeModeled ===
      false &&
    receipt.truth?.floodplainRespirationAnaerobicPathwayModeled === false &&
    receipt.truth?.persistentFloodplainDenitrification === true &&
    receipt.truth?.floodplainDenitrificationOwnerReceiptsTyped === true &&
    receipt.truth?.floodplainDenitrificationEvidenceBound === true &&
    receipt.truth?.exactFloodplainDenitrificationTransferIds === true &&
    receipt.truth
      ?.floodplainDenitrificationCarbonNitrogenAndAlkalinityLedgersClosed ===
      true &&
    receipt.truth?.floodplainDenitrificationOxygenGated === true &&
    receipt.truth?.floodplainDenitrificationNitrogenLimited === true &&
    receipt.truth
      ?.floodplainDenitrificationSurfaceTemperatureProxyResponsive ===
      false &&
    receipt.truth
      ?.floodplainDenitrificationQ10TemperatureResponseParameterized ===
      true &&
    receipt.truth
      ?.floodplainDenitrificationPersistentWaterTemperatureState ===
      true &&
    receipt.truth?.floodplainDenitrificationArrheniusKineticsResolved ===
      false &&
    receipt.truth
      ?.floodplainDenitrificationReactiveNitrateEquivalentParameterized ===
      false &&
    receipt.truth?.floodplainDenitrificationNitrateSpeciationResolved ===
      true &&
    receipt.truth?.floodplainDenitrificationNitrateOnly === true &&
    receipt.truth?.floodplainDenitrificationAmmoniumConsumption === false &&
    receipt.truth?.floodplainDenitrificationIndependentCreation === false &&
    receipt.truth?.persistentFloodplainNitrification === true &&
    receipt.truth?.floodplainNitrificationOwnerReceiptsTyped === true &&
    receipt.truth?.floodplainNitrificationEvidenceBound === true &&
    receipt.truth?.exactFloodplainNitrificationTransferIds === true &&
    receipt.truth?.floodplainNitrificationScaleAwareNumericClosure ===
      true &&
    receipt.truth?.floodplainNitrificationPerIdentityNumericBounds ===
      true &&
    receipt.truth?.floodplainNitrificationMeasuredResidualsPreserved ===
      true &&
    receipt.truth
      ?.floodplainNitrificationNitrogenOxygenAndAlkalinityLedgersClosed ===
      true &&
    receipt.truth?.floodplainNitrificationReactionModeled === true &&
    receipt.truth?.floodplainNitrificationAmmoniumToNitrate === true &&
    receipt.truth?.floodplainNitrificationDissolvedOxygenConsumed === true &&
    receipt.truth
      ?.floodplainNitrificationSurfaceTemperatureProxyResponsive === false &&
    receipt.truth
      ?.floodplainNitrificationQ10TemperatureResponseParameterized === true &&
    receipt.truth
      ?.floodplainNitrificationPersistentWaterTemperatureState === true &&
    receipt.truth?.floodplainNitrificationNitriteIntermediateResolved ===
      false &&
    receipt.truth?.floodplainNitrificationAlkalinityDemandDiagnostic ===
      false &&
    receipt.truth
      ?.floodplainNitrificationAlkalinityMaterialOwnerDebited === true &&
    receipt.truth?.persistentEndToEndAlkalinityLedger === true &&
    receipt.truth?.alkalinityIsAcidNeutralizingCapacityEquivalent ===
      true &&
    receipt.truth?.alkalinityCarbonateSpeciationResolved === false &&
    receipt.truth?.alkalinityPHResolved === false &&
    receipt.truth?.floodplainNitrificationPHFeedbackModeled === false &&
    receipt.truth?.floodplainNitrificationIndependentCreation === false &&
    receipt.truth?.persistentFloodplainAtmosphereGasExchange === true &&
    receipt.truth?.floodplainGasExchangeOwnerReceiptsTyped === true &&
    receipt.truth?.floodplainGasExchangeEvidenceBound === true &&
    receipt.truth?.exactFloodplainAtmosphereGasExchangeIds === true &&
    receipt.truth?.floodplainAtmosphereGasExchangeLedgersClosed === true &&
    receipt.truth?.floodplainGasExchangeUsesNativeAtmosphereSurfaceLayer ===
      true &&
    receipt.truth?.floodplainGasExchangeIndependentCreation === false &&
    receipt.truth
      ?.floodplainGasExchangeBidirectionalCarbonGradientParameterized ===
      true &&
    receipt.truth?.floodplainGasExchangeBidirectionalHenryLawSolved ===
      false &&
    receipt.truth?.grainSelectiveRiverAndMouthDeposition === true &&
    receipt.truth?.sedimentMassConservationClosed === true &&
    receipt.truth?.sedimentScaleAwareNumericClosure === true &&
    receipt.truth?.sedimentPerGrainNumericBounds === true &&
    receipt.truth?.sedimentMeasuredResidualsPreserved === true &&
    receipt.truth?.exactLandRunoffRiverTransferIds === true &&
    receipt.truth?.globalBasinNetwork === false;
  const inletLineageValid = (receipt.inletReceipts || []).every(entry =>
      entry.transferId === entry.runoffBiogeochemistrySenderDebit?.transferId &&
      entry.transferId === entry.riverChemistryInput?.transferId &&
      entry.riverChemistryInput?.schema === RIVER_CHEMISTRY_INPUT_SCHEMA &&
      entry.riverChemistryInput?.truth
        ?.nitrateAndAmmoniumReceiverPoolsCredited === true &&
      entry.riverChemistryInput?.truth
        ?.measuredInputSpeciationClaimed === false &&
      entry.runoffSedimentSenderDebit?.schema ===
        RUNOFF_SEDIMENT_TRANSFER_SCHEMA &&
      entry.riverSedimentInput?.schema === RIVER_SEDIMENT_INPUT_SCHEMA &&
      entry.transferId === entry.runoffSedimentSenderDebit?.transferId &&
      entry.transferId === entry.riverSedimentInput?.transferId &&
      auditSedimentTransferReceipt(entry.runoffSedimentSenderDebit).valid ===
        true &&
      auditSedimentTransferReceipt(entry.riverSedimentInput).valid === true);
  const routeSedimentLineageValid = (receipt.routeReceipts || []).every(entry =>
    entry.schema === RIVER_REACH_TRANSFER_SCHEMA
      ? auditSedimentTransferReceipt(entry.sedimentTransfer
          ?.senderDebitAndDeposition).valid === true &&
        auditSedimentTransferReceipt(entry.sedimentTransfer
          ?.receiverCredit).valid === true
      : entry.schema === OCEAN_MOUTH_RECEIPT_SCHEMA &&
        auditSedimentTransferReceipt(entry
          .riverSedimentSenderDebitAndDeposition).valid === true &&
        auditSedimentTransferReceipt(entry
          .coastalSedimentReceiverCredit).valid === true);
  const coupledShapeValid = coupled.length === 12;
  const coupledResidualsClosed =
    aggregateMassClosureAudit.valid === true &&
    receipt.aggregateMassClosure?.conservationClosed === true;
  const valid = schemaCurrent && truthBoundaryValid && inletLineageValid &&
    routeSedimentLineageValid && coupledShapeValid && coupledResidualsClosed;
  return check('basin-routing-receipt', valid ? 'PASS' : 'FAIL',
    'Loaded basin routing closes water, reaction-ledgered alkalinity, aquatic plus plant P, land-floodplain plant C/N and four mineral grain classes.', {
      expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualSchema: receipt.schema || null,
      aggregateMassClosureSchema:
        receipt.aggregateMassClosure?.schema || null,
      aggregateMassClosurePolicy:
        receipt.aggregateMassClosure?.policy || null,
      maximumResidualKg:
        receipt.aggregateMassClosure?.maximumResidualKg ?? null,
      maximumToleranceKg:
        receipt.aggregateMassClosure?.maximumToleranceKg ?? null,
      maximumToleranceUtilization:
        receipt.aggregateMassClosure?.maximumToleranceUtilization ?? null,
      residuals: Object.fromEntries(coupled),
      independentAggregateMassClosureAudit: aggregateMassClosureAudit,
      criteria: {
        schemaCurrent,
        truthBoundaryValid,
        inletLineageValid,
        routeSedimentLineageValid,
        coupledShapeValid,
        coupledResidualsClosed,
        inletReceiptCount: (receipt.inletReceipts || []).length,
        coupledResidualCount: coupled.length,
        sedimentMassConservationClosed:
          receipt.truth?.sedimentMassConservationClosed ?? null,
        exactLandRunoffRiverTransferIds:
          receipt.truth?.exactLandRunoffRiverTransferIds ?? null,
        exactLandRunoffRiverSedimentTransferIds:
          receipt.truth?.exactLandRunoffRiverSedimentTransferIds ?? null
      },
      receiptDigest: receipt.digest || null
    });
}

function alkalinityLedgerCheck(receipt) {
  const claim = 'Alkalinity is a persistent kg-CaCO3-equivalent capacity ledger from soil runoff through river/floodplain, estuary and ocean mixed-layer owners, with explicit nitrification sinks and denitrification sources.';
  if (!receipt) {
    return check('end-to-end-alkalinity-ledger', 'NOT_APPLICABLE', claim,
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('end-to-end-alkalinity-ledger', 'NOT_APPLICABLE', claim, {
      reason: 'legacy basin receipt predates persistent alkalinity ownership',
      expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualSchema: receipt.schema
    }, { required: false });
  }
  const conservationKeys = [
    'runoffAlkalinityResidualKgCaCO3Eq',
    'riverAlkalinityResidualKgCaCO3Eq',
    'estuaryAlkalinityResidualKgCaCO3Eq',
    'alkalinityResidualKgCaCO3Eq',
    'coupledAlkalinityResidualKgCaCO3Eq',
    'floodplainDenitrificationAlkalinityOwnerResidualKgCaCO3Eq',
    'floodplainDenitrificationAlkalinityStoichiometryResidualKgCaCO3Eq',
    'floodplainNitrificationAlkalinityOwnerResidualKgCaCO3Eq',
    'floodplainNitrificationAlkalinityStoichiometryResidualKgCaCO3Eq'
  ];
  const conservation = Object.fromEntries(conservationKeys.map(key =>
    [key, receipt.conservation?.[key]]));
  const conservationValid = Object.values(conservation).every(value =>
    close(value, 1));
  const inletsValid = (receipt.inletReceipts || []).every(entry =>
    finite(entry.runoffBiogeochemistrySenderDebit?.debitedPoolsKg
      ?.alkalinityKgCaCO3Eq) &&
    finite(entry.riverChemistryInput?.pools?.alkalinityKgCaCO3Eq) &&
    entry.riverChemistryInput?.truth?.alkalinitySenderDebited === true &&
    entry.riverChemistryInput?.truth?.alkalinityReceiverPoolCredited ===
      true);
  const routesValid = (receipt.routeReceipts || []).every(entry => {
    const pools = entry.chemistryTransfer?.pools ||
      entry.riverChemistrySenderDebit?.pools;
    if (!pools) return true;
    if (!finite(pools.alkalinityKgCaCO3Eq)) return false;
    if (!entry.oceanEcologyBoundaryInput) return true;
    return close(entry.oceanEcologyBoundaryInput.conservation
      ?.alkalinityResidualKgCaCO3Eq, 1e-7) &&
      entry.oceanEcologyBoundaryInput.truth
        ?.alkalinitySenderDebited === true &&
      entry.oceanEcologyBoundaryInput.truth
        ?.alkalinityReceiverPoolCredited === true;
  });
  const truthValid =
    receipt.truth?.persistentEndToEndAlkalinityLedger === true &&
    receipt.truth?.alkalinityIsAcidNeutralizingCapacityEquivalent ===
      true &&
    receipt.truth?.floodplainNitrificationAlkalinityMaterialOwnerDebited ===
      true &&
    receipt.truth
      ?.floodplainDenitrificationCarbonNitrogenAndAlkalinityLedgersClosed ===
      true &&
    receipt.truth?.alkalinityCarbonateSpeciationResolved === false &&
    receipt.truth?.alkalinityPHResolved === false;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    conservationValid && inletsValid && routesValid && truthValid;
  return check('end-to-end-alkalinity-ledger', valid ? 'PASS' : 'FAIL',
    claim, {
      expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualSchema: receipt.schema || null,
      unit: 'kg-CaCO3-equivalent',
      conservation,
      criteria: { conservationValid, inletsValid, routesValid, truthValid },
      boundaries: {
        measuredAlkalinityClaimed: false,
        carbonateSpeciationResolved: false,
        pHResolved: false,
        deepOceanAlkalinityExchangeCoveredByThisBasinReceipt: false,
        deepOceanAlkalinityExchangeAuditedSeparately: true
      },
      receiptDigest: receipt.digest || null
    });
}

function floodplainPlantMatterCheck(receipt) {
  if (!receipt) {
    return check('floodplain-plant-matter-receipts', 'NOT_APPLICABLE',
      'Floodplain plant C/N is persistent, succession-bound and exactly partitioned from loaded land ecology when observed.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-plant-matter-receipts', 'NOT_APPLICABLE',
      'Floodplain plant C/N is persistent, succession-bound and exactly partitioned from loaded land ecology when observed.', {
        reason: 'legacy basin receipt predates floodplain plant matter ownership',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const entries = receipt.floodplainPlantMatterReceipts;
  const senders = receipt.landEcologySubgridDebitReceipts;
  const successions = new Map((receipt.floodplainSuccessionReceipts || [])
    .map(entry => [entry.reachId, entry.digest]));
  const senderByCell = new Map((senders || []).map(entry =>
    [entry.donorCellId, entry]));
  const receiptShapeValid = Array.isArray(entries) && Array.isArray(senders);
  const senderNumericClosureValid = entry => {
    const carbonIdentityKgC = Number(entry?.before?.carbonKgC) -
      Number(entry?.debited?.carbonKgC) - Number(entry?.after?.carbonKgC);
    const nitrogenIdentityKgN = Number(entry?.before?.nitrogenKgN) -
      Number(entry?.debited?.nitrogenKgN) -
      Number(entry?.after?.nitrogenKgN);
    const expectedCarbonToleranceKgC =
      landEcologyMassClosureToleranceKg(entry?.before?.carbonKgC,
        entry?.debited?.carbonKgC, entry?.after?.carbonKgC);
    const expectedNitrogenToleranceKgN =
      landEcologyMassClosureToleranceKg(entry?.before?.nitrogenKgN,
        entry?.debited?.nitrogenKgN, entry?.after?.nitrogenKgN);
    return entry?.closure?.policy?.schema ===
        LAND_ECOLOGY_MASS_CLOSURE_POLICY_SCHEMA &&
      entry.closure.policy.absoluteFloorKg ===
        LAND_ECOLOGY_MASS_CLOSURE_ABSOLUTE_FLOOR_KG &&
      entry.closure.policy.ulpFactor ===
        LAND_ECOLOGY_MASS_CLOSURE_ULP_FACTOR &&
      entry.closure.policy.recordedOperandScale === true &&
      entry.closure.policy.arbitraryToleranceAuthority === false &&
      same(entry.closure?.numericToleranceKg?.carbonKgC,
        expectedCarbonToleranceKgC, 1e-12) &&
      same(entry.closure?.numericToleranceKg?.nitrogenKgN,
        expectedNitrogenToleranceKgN, 1e-12) &&
      same(entry.closure?.carbonResidualKgC, carbonIdentityKgC, 1e-9) &&
      same(entry.closure?.nitrogenResidualKgN, nitrogenIdentityKgN, 1e-9) &&
      close(entry.closure?.carbonResidualKgC,
        expectedCarbonToleranceKgC) &&
      close(entry.closure?.nitrogenResidualKgN,
        expectedNitrogenToleranceKgN) &&
      entry.truth?.scaleAwareFloatingPointClosure === true &&
      entry.truth?.measuredResidualsPreserved === true &&
      entry.truth?.fixedAbsoluteToleranceOnly === false;
  };
  const senderReceiptsValid = receiptShapeValid && senders.every(entry =>
    entry?.schema === LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA &&
    typeof entry.donorCellId === 'string' && entry.donorCellId.length > 0 &&
    Array.isArray(entry.allocations) &&
    new Set(entry.allocations.map(allocation => allocation.transferId)).size ===
      entry.allocations.length &&
    senderNumericClosureValid(entry) &&
    entry.truth?.persistentLandEcologySenderDebited === true &&
    entry.truth?.subgridPartitionCreatesMaterial === false &&
    entry.truth?.boundedDailyDebit === true &&
    entry.truth?.carbonAndNitrogenClosed === true &&
    entry.truth?.phosphorusTransferred === false);
  const senderNumericFailures = receiptShapeValid ? senders
    .filter(entry => !senderNumericClosureValid(entry)).slice(0, 8)
    .map(entry => ({
      donorCellId: entry?.donorCellId || null,
      residualKg: {
        carbonKgC: entry?.closure?.carbonResidualKgC ?? null,
        nitrogenKgN: entry?.closure?.nitrogenResidualKgN ?? null
      },
      declaredToleranceKg: entry?.closure?.numericToleranceKg || null,
      expectedToleranceKg: {
        carbonKgC: landEcologyMassClosureToleranceKg(
          entry?.before?.carbonKgC, entry?.debited?.carbonKgC,
          entry?.after?.carbonKgC),
        nitrogenKgN: landEcologyMassClosureToleranceKg(
          entry?.before?.nitrogenKgN, entry?.debited?.nitrogenKgN,
          entry?.after?.nitrogenKgN)
      }
    })) : [];
  const guildMatterOperands = source => ({
    carbonKgC: Number(source?.live?.carbonKgC || 0) +
      Number(source?.standingDead?.carbonKgC || 0) +
      Number(source?.litter?.carbonKgC || 0),
    nitrogenKgN: Number(source?.live?.nitrogenKgN || 0) +
      Number(source?.standingDead?.nitrogenKgN || 0) +
      Number(source?.litter?.nitrogenKgN || 0)
  });
  const flowNumericClosure = flow => {
    const before = guildMatterOperands(flow?.before);
    const after = guildMatterOperands(flow?.after);
    const credit = {
      carbonKgC: Number(flow?.landEcologyCredit?.carbonKgC || 0),
      nitrogenKgN: Number(flow?.landEcologyCredit?.nitrogenKgN || 0)
    };
    const identity = {
      carbonKgC: after.carbonKgC - before.carbonKgC -
        credit.carbonKgC,
      nitrogenKgN: after.nitrogenKgN - before.nitrogenKgN -
        credit.nitrogenKgN
    };
    const expectedToleranceKg = {
      carbonKgC: floodplainPlantMatterMassClosureToleranceKg(
        before.carbonKgC, credit.carbonKgC, after.carbonKgC),
      nitrogenKgN: floodplainPlantMatterMassClosureToleranceKg(
        before.nitrogenKgN, credit.nitrogenKgN, after.nitrogenKgN)
    };
    const valid =
      same(flow?.closure?.carbonResidualKgC,
        identity.carbonKgC, 1e-9) &&
      same(flow?.closure?.nitrogenResidualKgN,
        identity.nitrogenKgN, 1e-9) &&
      same(flow?.closure?.numericToleranceKg?.carbonKgC,
        expectedToleranceKg.carbonKgC, 1e-12) &&
      same(flow?.closure?.numericToleranceKg?.nitrogenKgN,
        expectedToleranceKg.nitrogenKgN, 1e-12) &&
      close(flow?.closure?.carbonResidualKgC,
        expectedToleranceKg.carbonKgC) &&
      close(flow?.closure?.nitrogenResidualKgN,
        expectedToleranceKg.nitrogenKgN);
    return {
      valid,
      identity,
      expectedToleranceKg,
      declaredToleranceKg: flow?.closure?.numericToleranceKg || null
    };
  };
  const receiptNumericClosure = entry => {
    const flows = Array.isArray(entry?.guildFlows)
      ? entry.guildFlows : [];
    const flowChecks = flows.map(flow => flowNumericClosure(flow));
    const credited = flows.reduce((total, flow) => ({
      carbonKgC: total.carbonKgC +
        Number(flow?.landEcologyCredit?.carbonKgC || 0),
      nitrogenKgN: total.nitrogenKgN +
        Number(flow?.landEcologyCredit?.nitrogenKgN || 0)
    }), { carbonKgC: 0, nitrogenKgN: 0 });
    const identity = {
      carbonKgC: Number(entry?.after?.total?.carbonKgC || 0) -
        Number(entry?.before?.total?.carbonKgC || 0) -
        credited.carbonKgC,
      nitrogenKgN: Number(entry?.after?.total?.nitrogenKgN || 0) -
        Number(entry?.before?.total?.nitrogenKgN || 0) -
        credited.nitrogenKgN
    };
    const expectedToleranceKg = {
      carbonKgC: floodplainPlantMatterMassClosureToleranceKg(
        entry?.before?.total?.carbonKgC, credited.carbonKgC,
        entry?.after?.total?.carbonKgC),
      nitrogenKgN: floodplainPlantMatterMassClosureToleranceKg(
        entry?.before?.total?.nitrogenKgN, credited.nitrogenKgN,
        entry?.after?.total?.nitrogenKgN)
    };
    const residualTolerancePairs = [
      ...flowChecks.flatMap((item, index) => [
        [Math.abs(Number(flows[index]?.closure?.carbonResidualKgC)),
          item.expectedToleranceKg.carbonKgC],
        [Math.abs(Number(flows[index]?.closure?.nitrogenResidualKgN)),
          item.expectedToleranceKg.nitrogenKgN]
      ]),
      [Math.abs(Number(entry?.closure?.carbonResidualKgC)),
        expectedToleranceKg.carbonKgC],
      [Math.abs(Number(entry?.closure?.nitrogenResidualKgN)),
        expectedToleranceKg.nitrogenKgN]
    ];
    const expectedMaximumResidualKg = Math.max(0,
      ...residualTolerancePairs.map(([residual]) => residual));
    const expectedMaximumToleranceUtilization = Math.max(0,
      ...residualTolerancePairs.map(([residual, tolerance]) =>
        tolerance > 0 ? residual / tolerance : Infinity));
    const valid =
      entry?.closure?.policy?.schema ===
        FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_POLICY_SCHEMA &&
      entry.closure.policy.absoluteFloorKg ===
        FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_ABSOLUTE_FLOOR_KG &&
      entry.closure.policy.ulpFactor ===
        FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_ULP_FACTOR &&
      entry.closure.policy.recordedOperandScale === true &&
      entry.closure.policy.perMaterialChannel === true &&
      entry.closure.policy.arbitraryToleranceAuthority === false &&
      flowChecks.every(item => item.valid) &&
      same(entry?.closure?.carbonResidualKgC,
        identity.carbonKgC, 1e-9) &&
      same(entry?.closure?.nitrogenResidualKgN,
        identity.nitrogenKgN, 1e-9) &&
      same(entry?.closure?.numericToleranceKg?.carbonKgC,
        expectedToleranceKg.carbonKgC, 1e-12) &&
      same(entry?.closure?.numericToleranceKg?.nitrogenKgN,
        expectedToleranceKg.nitrogenKgN, 1e-12) &&
      close(entry?.closure?.carbonResidualKgC,
        expectedToleranceKg.carbonKgC) &&
      close(entry?.closure?.nitrogenResidualKgN,
        expectedToleranceKg.nitrogenKgN) &&
      same(entry?.closure?.maximumElementResidualKg,
        expectedMaximumResidualKg, 1e-9) &&
      same(entry?.closure?.maximumToleranceUtilization,
        expectedMaximumToleranceUtilization, 1e-9) &&
      entry?.truth?.scaleAwareFloatingPointClosure === true &&
      entry?.truth?.perMaterialChannelNumericBounds === true &&
      entry?.truth?.measuredResidualsPreserved === true &&
      entry?.truth?.fixedAbsoluteToleranceOnly === false;
    return {
      valid,
      flowChecks,
      identity,
      expectedToleranceKg,
      declaredToleranceKg: entry?.closure?.numericToleranceKg || null
    };
  };
  const entrySchemasValid = receiptShapeValid && entries.every(entry =>
    entry?.schema === FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    entry.truth?.persistentFloodplainPlantCarbonAndNitrogen === true &&
    entry.truth?.pairedLandEcologySubgridPartitionRequired === true &&
    entry.truth?.independentBoundaryCreation === false &&
    entry.truth?.plantPhosphorusOwnership === false &&
    entry.truth?.plantWaterOwnership === false &&
    entry.truth?.decompositionAndRespirationCoupling === false &&
    entry.truth?.resolvedPlantIndividuals === false &&
    entry.truth?.scientificBiomassModel === false);
  const successionLineageValid = receiptShapeValid && entries.every(entry =>
    successions.get(entry.reachId) ===
      entry.floodplainSuccessionReceiptDigest &&
    entry.truth?.successionEvidenceBound === true);
  const entryNumericClosures = receiptShapeValid ? entries.map(entry =>
    ({ entry, numeric: receiptNumericClosure(entry) })) : [];
  const ledgersValid = receiptShapeValid &&
    entryNumericClosures.every(({ entry, numeric }) =>
      Array.isArray(entry.guildFlows) &&
      entry.guildFlows.length === FLOODPLAIN_SUCCESSION_GUILDS.length &&
      new Set(entry.guildFlows.map(flow => flow.guildId)).size ===
        FLOODPLAIN_SUCCESSION_GUILDS.length &&
      entry.guildFlows.every(flow =>
        FLOODPLAIN_SUCCESSION_GUILDS.includes(flow.guildId)) &&
      numeric.valid &&
      entry.truth?.carbonAndNitrogenClosed === true);
  const plantMatterNumericFailures = entryNumericClosures
    .filter(({ numeric }) => !numeric.valid).slice(0, 8)
    .map(({ entry, numeric }) => ({
      reachId: entry?.reachId || null,
      residualKg: {
        carbonKgC: entry?.closure?.carbonResidualKgC ?? null,
        nitrogenKgN: entry?.closure?.nitrogenResidualKgN ?? null
      },
      declaredToleranceKg: numeric.declaredToleranceKg,
      expectedToleranceKg: numeric.expectedToleranceKg,
      invalidGuilds: numeric.flowChecks
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.valid)
        .map(({ index }) => entry.guildFlows?.[index]?.guildId || null)
    }));
  const plantMatterPairingValid = entry => {
    const transferIds = Array.isArray(entry.transferIds)
      ? entry.transferIds : [];
    if (!transferIds.length) {
      const sender = senderByCell.get(entry.donorCellId);
      const senderAllocations = (sender?.allocations || []).filter(
        allocation => allocation.reachId === entry.reachId);
      const lineageValid = entry.landEcologySenderReceiptDigest == null ||
        sender?.digest === entry.landEcologySenderReceiptDigest;
      return lineageValid && senderAllocations.length === 0 &&
        same(entry.transfers?.landEcologyCredits?.carbonKgC, 0) &&
        same(entry.transfers?.landEcologyCredits?.nitrogenKgN, 0);
    }
    const sender = senderByCell.get(entry.donorCellId);
    const allocations = (sender?.allocations || []).filter(allocation =>
      allocation.reachId === entry.reachId);
    const senderIds = new Set(allocations.map(allocation =>
      allocation.transferId));
    const creditedCarbon = allocations.reduce((sum, allocation) =>
      sum + Number(allocation.carbonKgC || 0), 0);
    const creditedNitrogen = allocations.reduce((sum, allocation) =>
      sum + Number(allocation.nitrogenKgN || 0), 0);
    return sender?.digest === entry.landEcologySenderReceiptDigest &&
      senderIds.size === transferIds.length &&
      transferIds.every(id => senderIds.has(id)) &&
      same(creditedCarbon,
        entry.transfers?.landEcologyCredits?.carbonKgC, 1e-6) &&
      same(creditedNitrogen,
        entry.transfers?.landEcologyCredits?.nitrogenKgN, 1e-6) &&
      entry.truth?.landEcologySenderDebited === true &&
      entry.truth?.pairedTransferIds === true;
  };
  const pairedTransfersValid = receiptShapeValid &&
    entries.every(plantMatterPairingValid);
  const pairedTransferFailures = receiptShapeValid ? entries
    .filter(entry => !plantMatterPairingValid(entry)).slice(0, 8)
    .map(entry => {
      const sender = senderByCell.get(entry.donorCellId);
      const allocations = (sender?.allocations || []).filter(allocation =>
        allocation.reachId === entry.reachId);
      return {
        reachId: entry.reachId,
        donorCellId: entry.donorCellId,
        status: entry.status,
        transferIds: entry.transferIds,
        senderDigestExpected: entry.landEcologySenderReceiptDigest,
        senderDigestActual: sender?.digest || null,
        senderAllocationIds: allocations.map(allocation =>
          allocation.transferId),
        credited: entry.transfers?.landEcologyCredits || null,
        allocated: {
          carbonKgC: allocations.reduce((sum, allocation) =>
            sum + Number(allocation.carbonKgC || 0), 0),
          nitrogenKgN: allocations.reduce((sum, allocation) =>
            sum + Number(allocation.nitrogenKgN || 0), 0)
        },
        truth: {
          landEcologySenderDebited:
            entry.truth?.landEcologySenderDebited ?? null,
          pairedTransferIds: entry.truth?.pairedTransferIds ?? null
        }
      };
    }) : [];
  const transitionsValid = receiptShapeValid && entries.every(entry => {
    if (entry.status ===
      'initialized-after-migration-no-invented-material') {
      return entry.truth?.migrationInventedMaterial === false &&
        same(entry.after?.total?.carbonKgC, 0) &&
        same(entry.after?.total?.nitrogenKgN, 0) &&
        Number(entry.after?.legacyUnmaterializedCoverFraction || 0) >= 0;
    }
    if (entry.status === 'life-disabled-dormant') {
      return entry.truth?.materialPoolsFrozen === true &&
        same(entry.before?.total?.carbonKgC,
          entry.after?.total?.carbonKgC, 1e-9) &&
        same(entry.before?.total?.nitrogenKgN,
          entry.after?.total?.nitrogenKgN, 1e-9);
    }
    return ['land-biomass-partition-credited',
      'mortality-transferred-to-detritus', 'plant-matter-maintained']
      .includes(entry.status) &&
      entry.truth?.migrationInventedMaterial === false;
  });
  const conservationValid =
    close(receipt.conservation
      ?.loadedLandFloodplainPlantCarbonResidualKgC, 1) &&
    close(receipt.conservation
      ?.loadedLandFloodplainPlantNitrogenResidualKgN, 1);
  const basinTruthValid =
    receipt.truth?.persistentFloodplainPlantMatter === true &&
    receipt.truth?.floodplainPlantMatterEvidenceBound === true &&
    receipt.truth?.floodplainPlantMatterLedgersClosed === true &&
    receipt.truth?.floodplainPlantMatterScaleAwareNumericClosure === true &&
    receipt.truth?.floodplainPlantMatterMeasuredResidualsPreserved === true &&
    receipt.truth?.landEcologySubgridSenderDebited === true &&
    receipt.truth?.exactLandEcologyFloodplainPlantTransferIds === true &&
    receipt.truth?.loadedLandFloodplainPlantCarbonNitrogenClosed === true &&
    receipt.truth?.floodplainPlantMatterPhosphorusAuthority === false &&
    receipt.truth?.floodplainPlantMatterDoubleCountedWithLandEcology === false;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && senderReceiptsValid && entrySchemasValid &&
    successionLineageValid && ledgersValid && pairedTransfersValid &&
    transitionsValid && conservationValid && basinTruthValid;
  return check('floodplain-plant-matter-receipts',
    valid ? 'PASS' : 'FAIL',
    'Floodplain plant live, standing-dead and litter C/N pools persist under exact paired land-cell debits without invented P or double counting.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedPlantMatterSchema:
        FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
      expectedSenderSchema: LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA,
      plantMatterReceiptCount: Array.isArray(entries) ? entries.length : null,
      senderReceiptCount: Array.isArray(senders) ? senders.length : null,
      criteria: {
        receiptShapeValid,
        senderReceiptsValid,
        senderNumericFailures,
        entrySchemasValid,
        successionLineageValid,
        ledgersValid,
        plantMatterNumericFailures,
        pairedTransfersValid,
        pairedTransferFailures,
        transitionsValid,
        conservationValid,
        basinTruthValid
      },
      conservation: {
        loadedLandFloodplainPlantCarbonResidualKgC:
          receipt.conservation
            ?.loadedLandFloodplainPlantCarbonResidualKgC ?? null,
        loadedLandFloodplainPlantNitrogenResidualKgN:
          receipt.conservation
            ?.loadedLandFloodplainPlantNitrogenResidualKgN ?? null
      },
      receiptDigest: receipt.digest || null
    });
}

function floodplainPlantResourcesCheck(receipt) {
  if (!receipt) {
    return check('floodplain-plant-resources-receipts', 'NOT_APPLICABLE',
      'Floodplain plant P/water is persistent, matter-bound and paired with local floodplain debits and mortality-water returns when observed.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-plant-resources-receipts', 'NOT_APPLICABLE',
      'Floodplain plant P/water is persistent, matter-bound and paired with local floodplain debits and mortality-water returns when observed.', {
        reason: 'legacy basin receipt predates plant P/water ownership',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const entries = receipt.floodplainPlantResourcesReceipts;
  const debits = receipt.floodplainPlantResourceDebitReceipts;
  const returns = receipt.floodplainPlantWaterReturnReceipts;
  const matterByReach = new Map((receipt.floodplainPlantMatterReceipts || [])
    .map(entry => [entry.reachId, entry]));
  const debitByReach = new Map((debits || []).map(entry =>
    [entry.reachId, entry]));
  const returnByReach = new Map((returns || []).map(entry =>
    [entry.reachId, entry]));
  const receiptShapeValid = Array.isArray(entries) &&
    Array.isArray(debits) && Array.isArray(returns) &&
    entries.length === debits.length && entries.length === returns.length;
  const guildOperands = source => ({
    supportedCarbonKgC:
      Number(source?.live?.supportedCarbonKgC || 0) +
      Number(source?.standingDead?.supportedCarbonKgC || 0) +
      Number(source?.litter?.supportedCarbonKgC || 0),
    phosphorusKgP: Number(source?.live?.phosphorusKgP || 0) +
      Number(source?.standingDead?.phosphorusKgP || 0) +
      Number(source?.litter?.phosphorusKgP || 0),
    liveWaterKg: Number(source?.live?.waterKg || 0)
  });
  const flowNumericClosure = flow => {
    const beforeOperands = guildOperands(flow?.before);
    const afterOperands = guildOperands(flow?.after);
    const carbonIdentityKgC = afterOperands.supportedCarbonKgC -
      beforeOperands.supportedCarbonKgC -
      Number(flow?.supportedCarbonCreditKgC || 0);
    const phosphorusIdentityKgP = afterOperands.phosphorusKgP -
      beforeOperands.phosphorusKgP -
      Number(flow?.uptake?.phosphorusKgP || 0);
    const waterIdentityKg = afterOperands.liveWaterKg -
      beforeOperands.liveWaterKg - Number(flow?.uptake?.waterKg || 0) +
      Number(flow?.waterReturnedToFloodplainKg || 0);
    const expectedToleranceKg = {
      supportedCarbonKgC: floodplainPlantResourceMassClosureToleranceKg(
        beforeOperands.supportedCarbonKgC,
        flow?.supportedCarbonCreditKgC,
        afterOperands.supportedCarbonKgC),
      phosphorusKgP: floodplainPlantResourceMassClosureToleranceKg(
        beforeOperands.phosphorusKgP, flow?.uptake?.phosphorusKgP,
        afterOperands.phosphorusKgP),
      liveWaterKg: floodplainPlantResourceMassClosureToleranceKg(
        beforeOperands.liveWaterKg, flow?.uptake?.waterKg,
        flow?.waterReturnedToFloodplainKg,
        afterOperands.liveWaterKg)
    };
    const valid =
      same(flow?.closure?.supportedCarbonResidualKgC,
        carbonIdentityKgC, 1e-9) &&
      same(flow?.closure?.phosphorusResidualKgP,
        phosphorusIdentityKgP, 1e-9) &&
      same(flow?.closure?.liveWaterResidualKg, waterIdentityKg, 1e-9) &&
      same(flow?.closure?.numericToleranceKg?.supportedCarbonKgC,
        expectedToleranceKg.supportedCarbonKgC, 1e-12) &&
      same(flow?.closure?.numericToleranceKg?.phosphorusKgP,
        expectedToleranceKg.phosphorusKgP, 1e-12) &&
      same(flow?.closure?.numericToleranceKg?.liveWaterKg,
        expectedToleranceKg.liveWaterKg, 1e-12) &&
      close(flow?.closure?.supportedCarbonResidualKgC,
        expectedToleranceKg.supportedCarbonKgC) &&
      close(flow?.closure?.phosphorusResidualKgP,
        expectedToleranceKg.phosphorusKgP) &&
      close(flow?.closure?.liveWaterResidualKg,
        expectedToleranceKg.liveWaterKg);
    return { valid, residualKg: {
      supportedCarbonKgC:
        flow?.closure?.supportedCarbonResidualKgC ?? null,
      phosphorusKgP: flow?.closure?.phosphorusResidualKgP ?? null,
      liveWaterKg: flow?.closure?.liveWaterResidualKg ?? null
    }, declaredToleranceKg: flow?.closure?.numericToleranceKg || null,
    expectedToleranceKg };
  };
  const receiptNumericClosure = entry => {
    const flows = Array.isArray(entry?.guildFlows)
      ? entry.guildFlows : [];
    const flowChecks = flows.map(flow => flowNumericClosure(flow));
    const carbonIdentityKgC = Number(
      entry?.after?.total?.supportedCarbonKgC || 0) - Number(
      entry?.before?.total?.supportedCarbonKgC || 0) -
      flows.reduce((sum, flow) => sum + Number(
        flow?.supportedCarbonCreditKgC || 0), 0);
    const phosphorusIdentityKgP = Number(
      entry?.after?.total?.phosphorusKgP || 0) - Number(
      entry?.before?.total?.phosphorusKgP || 0) - Number(
      entry?.transfers?.floodplainUptake?.phosphorusKgP || 0);
    const waterIdentityKg = Number(
      entry?.after?.total?.liveWaterKg || 0) - Number(
      entry?.before?.total?.liveWaterKg || 0) - Number(
      entry?.transfers?.floodplainUptake?.waterKg || 0) + Number(
      entry?.transfers?.mortalityWaterReturnedKg || 0);
    const expectedToleranceKg = {
      supportedCarbonKgC: floodplainPlantResourceMassClosureToleranceKg(
        entry?.before?.total?.supportedCarbonKgC,
        flows.reduce((sum, flow) => sum + Number(
          flow?.supportedCarbonCreditKgC || 0), 0),
        entry?.after?.total?.supportedCarbonKgC),
      phosphorusKgP: floodplainPlantResourceMassClosureToleranceKg(
        entry?.before?.total?.phosphorusKgP,
        entry?.transfers?.floodplainUptake?.phosphorusKgP,
        entry?.after?.total?.phosphorusKgP),
      liveWaterKg: floodplainPlantResourceMassClosureToleranceKg(
        entry?.before?.total?.liveWaterKg,
        entry?.transfers?.floodplainUptake?.waterKg,
        entry?.transfers?.mortalityWaterReturnedKg,
        entry?.after?.total?.liveWaterKg)
    };
    const residualTolerancePairs = [
      ...flowChecks.flatMap(item => [
        [Math.abs(Number(item.residualKg.supportedCarbonKgC)),
          item.expectedToleranceKg.supportedCarbonKgC],
        [Math.abs(Number(item.residualKg.phosphorusKgP)),
          item.expectedToleranceKg.phosphorusKgP],
        [Math.abs(Number(item.residualKg.liveWaterKg)),
          item.expectedToleranceKg.liveWaterKg]
      ]),
      [Math.abs(Number(entry?.closure?.supportedCarbonResidualKgC)),
        expectedToleranceKg.supportedCarbonKgC],
      [Math.abs(Number(entry?.closure?.phosphorusResidualKgP)),
        expectedToleranceKg.phosphorusKgP],
      [Math.abs(Number(entry?.closure?.liveWaterResidualKg)),
        expectedToleranceKg.liveWaterKg]
    ];
    const expectedMaximumResidualKg = Math.max(0,
      ...residualTolerancePairs.map(([residual]) => residual));
    const expectedMaximumToleranceUtilization = Math.max(0,
      ...residualTolerancePairs.map(([residual, tolerance]) =>
        tolerance > 0 ? residual / tolerance : Infinity));
    const valid =
      entry?.closure?.policy?.schema ===
        FLOODPLAIN_PLANT_RESOURCE_MASS_CLOSURE_POLICY_SCHEMA &&
      entry.closure.policy.absoluteFloorKg ===
        FLOODPLAIN_PLANT_RESOURCE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG &&
      entry.closure.policy.ulpFactor ===
        FLOODPLAIN_PLANT_RESOURCE_MASS_CLOSURE_ULP_FACTOR &&
      entry.closure.policy.recordedOperandScale === true &&
      entry.closure.policy.perMaterialChannel === true &&
      entry.closure.policy.arbitraryToleranceAuthority === false &&
      flowChecks.every(item => item.valid) &&
      same(entry?.closure?.supportedCarbonResidualKgC,
        carbonIdentityKgC, 1e-9) &&
      same(entry?.closure?.phosphorusResidualKgP,
        phosphorusIdentityKgP, 1e-9) &&
      same(entry?.closure?.liveWaterResidualKg, waterIdentityKg, 1e-9) &&
      same(entry?.closure?.numericToleranceKg?.supportedCarbonKgC,
        expectedToleranceKg.supportedCarbonKgC, 1e-12) &&
      same(entry?.closure?.numericToleranceKg?.phosphorusKgP,
        expectedToleranceKg.phosphorusKgP, 1e-12) &&
      same(entry?.closure?.numericToleranceKg?.liveWaterKg,
        expectedToleranceKg.liveWaterKg, 1e-12) &&
      close(entry?.closure?.supportedCarbonResidualKgC,
        expectedToleranceKg.supportedCarbonKgC) &&
      close(entry?.closure?.phosphorusResidualKgP,
        expectedToleranceKg.phosphorusKgP) &&
      close(entry?.closure?.liveWaterResidualKg,
        expectedToleranceKg.liveWaterKg) &&
      same(entry?.closure?.maximumResidualKg,
        expectedMaximumResidualKg, 1e-9) &&
      same(entry?.closure?.maximumToleranceUtilization,
        expectedMaximumToleranceUtilization, 1e-9) &&
      entry?.truth?.scaleAwareFloatingPointClosure === true &&
      entry?.truth?.perMaterialChannelNumericBounds === true &&
      entry?.truth?.measuredResidualsPreserved === true &&
      entry?.truth?.fixedAbsoluteToleranceOnly === false;
    return { valid, flowChecks, residualKg: {
      supportedCarbonKgC:
        entry?.closure?.supportedCarbonResidualKgC ?? null,
      phosphorusKgP: entry?.closure?.phosphorusResidualKgP ?? null,
      liveWaterKg: entry?.closure?.liveWaterResidualKg ?? null
    }, declaredToleranceKg: entry?.closure?.numericToleranceKg || null,
    expectedToleranceKg };
  };
  const senderReceiptsValid = receiptShapeValid && debits.every(entry =>
    entry?.schema === FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    Array.isArray(entry.allocations) &&
    new Set(entry.allocations.map(allocation => allocation.transferId)).size ===
      entry.allocations.length &&
    close(entry.closure?.waterResidualKg, 1e-6) &&
    close(entry.closure?.phosphorusResidualKgP, 1e-9) &&
    entry.truth?.persistentFloodplainSenderDebited === true &&
    entry.truth?.finiteWaterAndPhosphorusDonors === true &&
    entry.truth?.boundedDailyUptake === true &&
    entry.truth?.waterAndPhosphorusClosed === true &&
    entry.truth?.plantUptakeCreatesResources === false);
  const receiverReceiptsValid = receiptShapeValid && returns.every(entry =>
    entry?.schema === FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    Array.isArray(entry.transfers) &&
    new Set(entry.transfers.map(transfer => transfer.transferId)).size ===
      entry.transfers.length &&
    close(entry.closure?.waterResidualKg, 1e-6) &&
    entry.truth?.persistentFloodplainReceiverCredited === true &&
    entry.truth?.mortalityWaterCreatesWater === false &&
    entry.truth?.localReceiverOnly === true &&
    entry.truth?.atmospherePartitionResolved === false &&
    entry.truth?.waterClosed === true);
  const entrySchemasValid = receiptShapeValid && entries.every(entry =>
    entry?.schema === FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    entry.truth?.persistentPlantPhosphorusAndTissueWater === true &&
    entry.truth?.pairedFloodplainResourceExchangeRequired === true &&
    entry.truth?.resourceBackedCarbonReferenceOwnsCarbon === false &&
    entry.truth?.independentBoundaryCreation === false &&
    entry.truth?.mortalityWaterReturnsToLocalFloodplainReservoir === true &&
    entry.truth?.phosphorusRetainedThroughStandingDeadAndLitter === true &&
    entry.truth?.decompositionAndSoilNutrientReturn === false &&
    entry.truth?.transpirationAndAtmosphereCoupling === false &&
    entry.truth?.scientificPlantResourceModel === false);
  const lineageValid = receiptShapeValid && entries.every(entry => {
    const matter = matterByReach.get(entry.reachId);
    const debit = debitByReach.get(entry.reachId);
    const returned = returnByReach.get(entry.reachId);
    return matter?.digest === entry.plantMatterReceiptDigest &&
      debit?.digest === entry.floodplainResourceDebitReceiptDigest &&
      returned?.digest === entry.floodplainWaterReturnReceiptDigest &&
      entry.truth?.plantMatterEvidenceBound === true;
  });
  const numericChecks = receiptShapeValid
    ? entries.map(entry => ({ entry, ...receiptNumericClosure(entry) })) : [];
  const resourceNumericFailures = numericChecks.filter(item => !item.valid)
    .slice(0, 8).map(item => ({
      reachId: item.entry?.reachId || null,
      residualKg: item.residualKg,
      declaredToleranceKg: item.declaredToleranceKg,
      expectedToleranceKg: item.expectedToleranceKg,
      failedGuilds: item.flowChecks.map((flow, index) => ({
        guildId: item.entry?.guildFlows?.[index]?.guildId || null,
        ...flow
      })).filter(flow => !flow.valid).slice(0, 5)
    }));
  const ledgersValid = receiptShapeValid && entries.every((entry, index) =>
    Array.isArray(entry.guildFlows) &&
    entry.guildFlows.length === FLOODPLAIN_SUCCESSION_GUILDS.length &&
    new Set(entry.guildFlows.map(flow => flow.guildId)).size ===
      FLOODPLAIN_SUCCESSION_GUILDS.length &&
    entry.guildFlows.every(flow =>
      FLOODPLAIN_SUCCESSION_GUILDS.includes(flow.guildId)) &&
    numericChecks[index]?.valid === true &&
    entry.truth?.resourceLedgersClosed === true);
  const pairingValid = receiptShapeValid && entries.every(entry => {
    const debit = debitByReach.get(entry.reachId);
    const returned = returnByReach.get(entry.reachId);
    const debitIds = new Set((debit?.allocations || []).map(allocation =>
      allocation.transferId));
    const returnIds = new Set((returned?.transfers || []).map(transfer =>
      transfer.transferId));
    const creditedP = (debit?.allocations || []).reduce((sum, allocation) =>
      sum + Number(allocation.phosphorusKgP || 0), 0);
    const creditedWater = (debit?.allocations || []).reduce(
      (sum, allocation) => sum + Number(allocation.waterKg || 0), 0);
    const returnedWater = (returned?.transfers || []).reduce(
      (sum, transfer) => sum + Number(transfer.waterKg || 0), 0);
    return debitIds.size === entry.uptakeTransferIds.length &&
      entry.uptakeTransferIds.every(id => debitIds.has(id)) &&
      returnIds.size === entry.waterReturnTransferIds.length &&
      entry.waterReturnTransferIds.every(id => returnIds.has(id)) &&
      same(creditedP,
        entry.transfers?.floodplainUptake?.phosphorusKgP, 1e-8) &&
      same(creditedWater,
        entry.transfers?.floodplainUptake?.waterKg, 1e-6) &&
      same(returnedWater,
        entry.transfers?.mortalityWaterReturnedKg, 1e-6) &&
      entry.truth?.floodplainUptakeDebited === true &&
      entry.truth?.mortalityWaterReceiverCredited === true &&
      entry.truth?.exactPairedTransferIds === true;
  });
  const referencesBounded = receiptShapeValid && entries.every(entry => {
    const matter = matterByReach.get(entry.reachId);
    return entry.guildFlows.every(flow => {
      const matterGuild = matter?.after?.guilds?.[flow.guildId];
      return Number(flow.after?.live?.supportedCarbonKgC || 0) <=
          Number(matterGuild?.live?.carbonKgC || 0) + 1e-6 &&
        Number(flow.after?.standingDead?.supportedCarbonKgC || 0) <=
          Number(matterGuild?.standingDead?.carbonKgC || 0) + 1e-6 &&
        Number(flow.after?.litter?.supportedCarbonKgC || 0) <=
          Number(matterGuild?.litter?.carbonKgC || 0) + 1e-6;
    });
  });
  const transitionsValid = receiptShapeValid && entries.every(entry => {
    if (entry.status ===
      'initialized-after-v11-migration-no-invented-resources') {
      return entry.truth?.migrationInventedResources === false &&
        same(entry.after?.total?.phosphorusKgP, 0) &&
        same(entry.after?.total?.liveWaterKg, 0) &&
        Number(entry.after?.migrationLegacyUnsupportedCarbonKgC || 0) >= 0;
    }
    if (entry.status === 'life-disabled-dormant') {
      return entry.truth?.resourcePoolsFrozen === true &&
        same(entry.before?.total?.phosphorusKgP,
          entry.after?.total?.phosphorusKgP, 1e-9) &&
        same(entry.before?.total?.liveWaterKg,
          entry.after?.total?.liveWaterKg, 1e-9);
    }
    return ['floodplain-phosphorus-water-uptake-credited',
      'mortality-water-returned', 'plant-resources-maintained']
      .includes(entry.status) &&
      entry.truth?.migrationInventedResources === false;
  });
  const conservationValid = close(receipt.conservation
    ?.plantResourceWaterResidualKg, 1) &&
    close(receipt.conservation
      ?.plantResourcePhosphorusResidualKgP, 1);
  const basinTruthValid =
    receipt.truth?.persistentFloodplainPlantResources === true &&
    receipt.truth?.floodplainPlantResourcesEvidenceBound === true &&
    receipt.truth?.floodplainPlantResourcesLedgersClosed === true &&
    receipt.truth?.floodplainPlantResourceSendersAndReceiversClosed === true &&
    receipt.truth?.exactFloodplainPlantResourceTransferIds === true &&
    receipt.truth?.jointCarbonNitrogenPhosphorusWaterLimitedPlantGrowth === true &&
    receipt.truth?.floodplainPlantResourcesWaterPhosphorusClosed === true &&
    receipt.truth?.floodplainPlantResourceIndependentCreation === false;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && senderReceiptsValid && receiverReceiptsValid &&
    entrySchemasValid && lineageValid && ledgersValid && pairingValid &&
    referencesBounded && transitionsValid && conservationValid &&
    basinTruthValid;
  return check('floodplain-plant-resources-receipts',
    valid ? 'PASS' : 'FAIL',
    'Floodplain plant P and live tissue water persist under exact local uptake debits, mortality-water returns and whole-basin conservation.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedPlantResourcesSchema:
        FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA,
      expectedDebitSchema: FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
      expectedWaterReturnSchema: FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA,
      plantResourcesReceiptCount: Array.isArray(entries)
        ? entries.length : null,
      criteria: { receiptShapeValid, senderReceiptsValid,
        receiverReceiptsValid, entrySchemasValid, lineageValid,
        ledgersValid, resourceNumericFailures, pairingValid,
        referencesBounded, transitionsValid,
        conservationValid, basinTruthValid },
      conservation: {
        plantResourceWaterResidualKg: receipt.conservation
          ?.plantResourceWaterResidualKg ?? null,
        plantResourcePhosphorusResidualKgP: receipt.conservation
          ?.plantResourcePhosphorusResidualKgP ?? null
      },
      receiptDigest: receipt.digest || null
    });
}

function floodplainDecompositionCheck(receipt) {
  if (!receipt) {
    return check('floodplain-decomposition-receipts', 'NOT_APPLICABLE',
      'Resource-backed plant detritus returns C/N/P to local floodplain chemistry through exact sender and receiver receipts when observed.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-decomposition-receipts', 'NOT_APPLICABLE',
      'Resource-backed plant detritus returns C/N/P to local floodplain chemistry through exact sender and receiver receipts when observed.', {
        reason: 'legacy basin receipt predates the decomposition organ',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const entries = receipt.floodplainDecompositionReceipts;
  const matterDebits = receipt.floodplainPlantDetritusMatterDebitReceipts;
  const resourceDebits =
    receipt.floodplainPlantDetritusResourceDebitReceipts;
  const credits = receipt.floodplainDetritalReturnCreditReceipts;
  const receiptShapeValid = Array.isArray(entries) &&
    Array.isArray(matterDebits) && Array.isArray(resourceDebits) &&
    Array.isArray(credits) && entries.length === matterDebits.length &&
    entries.length === resourceDebits.length &&
    entries.length === credits.length;
  const matterByReach = new Map((matterDebits || []).map(entry =>
    [entry.reachId, entry]));
  const resourceByReach = new Map((resourceDebits || []).map(entry =>
    [entry.reachId, entry]));
  const creditByReach = new Map((credits || []).map(entry =>
    [entry.reachId, entry]));
  const matterSendersValid = receiptShapeValid && matterDebits.every(entry =>
    entry?.schema === FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    Array.isArray(entry.allocations) &&
    new Set(entry.allocations.map(allocation => allocation.transferId)).size ===
      entry.allocations.length && entry.allocations.every(allocation =>
      FLOODPLAIN_SUCCESSION_GUILDS.includes(allocation.guildId) &&
      ['standingDead', 'litter'].includes(allocation.pool) &&
      close(allocation.closure?.carbonResidualKgC, 1e-7) &&
      close(allocation.closure?.nitrogenResidualKgN, 1e-7)) &&
    close(entry.closure?.carbonResidualKgC, 1e-7) &&
    close(entry.closure?.nitrogenResidualKgN, 1e-7) &&
    entry.truth?.persistentPlantMatterSenderDebited === true &&
    entry.truth?.standingDeadAndLitterOnly === true &&
    entry.truth?.carbonAndNitrogenClosed === true &&
    entry.truth?.decompositionCreatesMatter === false);
  const resourceSendersValid = receiptShapeValid &&
    resourceDebits.every(entry =>
      entry?.schema ===
        FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA &&
      typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
      Array.isArray(entry.allocations) &&
      new Set(entry.allocations.map(allocation => allocation.transferId))
        .size === entry.allocations.length &&
      entry.allocations.every(allocation =>
        FLOODPLAIN_SUCCESSION_GUILDS.includes(allocation.guildId) &&
        ['standingDead', 'litter'].includes(allocation.pool) &&
        close(allocation.closure?.supportedCarbonResidualKgC, 1e-7) &&
        close(allocation.closure?.phosphorusResidualKgP, 1e-9)) &&
      close(entry.closure?.supportedCarbonResidualKgC, 1e-7) &&
      close(entry.closure?.phosphorusResidualKgP, 1e-9) &&
      entry.truth?.persistentPlantResourceSenderDebited === true &&
      entry.truth?.supportedCarbonIsNonOwningReference === true &&
      entry.truth?.phosphorusClosed === true &&
      entry.truth?.decompositionCreatesResources === false);
  const receiverNumericClosure = entry => {
    const identity = {
      carbonKgC: Number(entry?.after?.carbonKgC || 0) -
        Number(entry?.before?.carbonKgC || 0) -
        Number(entry?.credited?.carbonKgC || 0),
      nitrogenKgN: Number(entry?.after?.nitrogenKgN || 0) -
        Number(entry?.before?.nitrogenKgN || 0) -
        Number(entry?.credited?.nitrogenKgN || 0),
      ammoniumNitrogenKgN: Number(
        entry?.afterNitrogenSpecies?.ammoniumNitrogenKgN || 0) - Number(
        entry?.beforeNitrogenSpecies?.ammoniumNitrogenKgN || 0) - Number(
        entry?.credited?.nitrogenKgN || 0),
      nitrateNitrogenKgN: Number(
        entry?.afterNitrogenSpecies?.nitrateNitrogenKgN || 0) - Number(
        entry?.beforeNitrogenSpecies?.nitrateNitrogenKgN || 0),
      phosphorusKgP: Number(entry?.after?.phosphorusKgP || 0) -
        Number(entry?.before?.phosphorusKgP || 0) -
        Number(entry?.credited?.phosphorusKgP || 0)
    };
    const expectedToleranceKg = {
      carbonKgC: floodplainDetritalReturnMassClosureToleranceKg(
        'carbonKgC', entry?.before?.carbonKgC,
        entry?.credited?.carbonKgC, entry?.after?.carbonKgC),
      nitrogenKgN: floodplainDetritalReturnMassClosureToleranceKg(
        'nitrogenKgN', entry?.before?.nitrogenKgN,
        entry?.credited?.nitrogenKgN, entry?.after?.nitrogenKgN),
      ammoniumNitrogenKgN:
        floodplainDetritalReturnMassClosureToleranceKg(
          'ammoniumNitrogenKgN',
          entry?.beforeNitrogenSpecies?.ammoniumNitrogenKgN,
          entry?.credited?.nitrogenKgN,
          entry?.afterNitrogenSpecies?.ammoniumNitrogenKgN),
      nitrateNitrogenKgN:
        floodplainDetritalReturnMassClosureToleranceKg(
          'nitrateNitrogenKgN',
          entry?.beforeNitrogenSpecies?.nitrateNitrogenKgN,
          entry?.afterNitrogenSpecies?.nitrateNitrogenKgN),
      phosphorusKgP: floodplainDetritalReturnMassClosureToleranceKg(
        'phosphorusKgP', entry?.before?.phosphorusKgP,
        entry?.credited?.phosphorusKgP, entry?.after?.phosphorusKgP)
    };
    const declaredResidualKg = {
      carbonKgC: entry?.closure?.carbonResidualKgC,
      nitrogenKgN: entry?.closure?.nitrogenResidualKgN,
      ammoniumNitrogenKgN:
        entry?.closure?.ammoniumNitrogenResidualKgN,
      nitrateNitrogenKgN: entry?.closure?.nitrateNitrogenResidualKgN,
      phosphorusKgP: entry?.closure?.phosphorusResidualKgP
    };
    const residualTolerancePairs = Object.keys(expectedToleranceKg).map(
      channel => [Math.abs(Number(declaredResidualKg[channel])),
        expectedToleranceKg[channel]]);
    const expectedMaximumResidualKg = Math.max(0,
      ...residualTolerancePairs.map(([residual]) => residual));
    const expectedMaximumToleranceUtilization = Math.max(0,
      ...residualTolerancePairs.map(([residual, tolerance]) =>
        residual / tolerance));
    const policyFloorsValid = Object.entries(
      FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ABSOLUTE_FLOORS_KG)
      .every(([channel, floorKg]) => same(
        entry?.closure?.policy?.absoluteFloorsKg?.[channel], floorKg));
    const residualsMatchIdentities = [
      ['carbonKgC', 'carbonResidualKgC'],
      ['nitrogenKgN', 'nitrogenResidualKgN'],
      ['ammoniumNitrogenKgN', 'ammoniumNitrogenResidualKgN'],
      ['nitrateNitrogenKgN', 'nitrateNitrogenResidualKgN'],
      ['phosphorusKgP', 'phosphorusResidualKgP']
    ].every(([channel, receiptKey]) => same(
      entry?.closure?.[receiptKey], identity[channel], 1e-12));
    const tolerancesExact = Object.entries(expectedToleranceKg).every(
      ([channel, toleranceKg]) => same(
        entry?.closure?.numericToleranceKg?.[channel], toleranceKg, 1e-12));
    const valid = entry?.closure?.policy?.schema ===
        FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA &&
      policyFloorsValid && entry.closure.policy.ulpFactor ===
        FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ULP_FACTOR &&
      entry.closure.policy.recordedOperandScale === true &&
      entry.closure.policy.perMaterialChannel === true &&
      entry.closure.policy.arbitraryToleranceAuthority === false &&
      residualsMatchIdentities && tolerancesExact &&
      residualTolerancePairs.every(([residual, tolerance]) =>
        residual <= tolerance) &&
      same(entry?.closure?.maximumResidualKg,
        expectedMaximumResidualKg, 1e-9) &&
      same(entry?.closure?.maximumToleranceUtilization,
        expectedMaximumToleranceUtilization, 1e-9) &&
      entry?.truth?.scaleAwareFloatingPointClosure === true &&
      entry?.truth?.perMaterialChannelNumericBounds === true &&
      entry?.truth?.measuredResidualsPreserved === true &&
      entry?.truth?.fixedAbsoluteToleranceOnly === false;
    return { valid, identity, declaredResidualKg,
      declaredToleranceKg: entry?.closure?.numericToleranceKg || null,
      expectedToleranceKg };
  };
  const receiverNumericClosures = receiptShapeValid ? credits.map(entry =>
    ({ entry, numeric: receiverNumericClosure(entry) })) : [];
  const receiversValid = receiptShapeValid &&
    receiverNumericClosures.every(({ entry, numeric }) =>
    entry?.schema === FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    Array.isArray(entry.allocations) &&
    new Set(entry.allocations.map(allocation => allocation.transferId)).size ===
      entry.allocations.length && entry.allocations.every(allocation =>
      FLOODPLAIN_SUCCESSION_GUILDS.includes(allocation.guildId) &&
      ['standingDead', 'litter'].includes(allocation.pool)) &&
    numeric.valid &&
    entry.truth?.persistentFloodplainChemistryReceiverCredited === true &&
    entry.truth?.detritalNitrogenCreditedToAmmoniumPool === true &&
    entry.truth?.nitratePoolUnchanged === true &&
    entry.truth?.carbonNitrogenPhosphorusClosed === true &&
    entry.truth?.localReceiverOnly === true &&
    entry.truth?.soilReceiverModeled === false &&
    entry.truth?.atmosphereRespirationModeled === false &&
    entry.truth?.oxygenConsumptionModeled === false);
  const receiverNumericFailures = receiverNumericClosures
    .filter(({ numeric }) => !numeric.valid).slice(0, 8)
    .map(({ entry, numeric }) => ({
      reachId: entry?.reachId || null,
      identityKg: numeric.identity,
      declaredResidualKg: numeric.declaredResidualKg,
      declaredToleranceKg: numeric.declaredToleranceKg,
      expectedToleranceKg: numeric.expectedToleranceKg
    }));
  const entrySchemasValid = receiptShapeValid && entries.every(entry =>
    entry?.schema === FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    entry.truth?.persistentDecompositionProcessMemory === true &&
    entry.truth?.materialOwnership === false &&
    entry.truth?.onlyResourceBackedDetritusEligible === true &&
    entry.truth?.independentMaterialCreation === false &&
    entry.truth?.atmosphericRespirationModeled === false &&
    entry.truth?.oxygenConsumptionModeled === false &&
    entry.truth?.soilReceiverModeled === false &&
    entry.truth?.microbialPopulationsResolved === false &&
    entry.truth?.scientificCalibrationClaimed === false);
  const lineageValid = receiptShapeValid && entries.every(entry =>
    matterByReach.get(entry.reachId)?.digest ===
      entry.matterDebitReceiptDigest &&
    resourceByReach.get(entry.reachId)?.digest ===
      entry.resourceDebitReceiptDigest &&
    creditByReach.get(entry.reachId)?.digest ===
      entry.floodplainCreditReceiptDigest);
  const pairingValid = receiptShapeValid && entries.every(entry => {
    const matter = matterByReach.get(entry.reachId);
    const resources = resourceByReach.get(entry.reachId);
    const receiver = creditByReach.get(entry.reachId);
    const matterMap = new Map((matter?.allocations || []).map(allocation =>
      [allocation.transferId, allocation]));
    const resourceMap = new Map((resources?.allocations || []).map(
      allocation => [allocation.transferId, allocation]));
    const receiverMap = new Map((receiver?.allocations || []).map(
      allocation => [allocation.transferId, allocation]));
    return matterMap.size === entry.transferIds.length &&
      resourceMap.size === entry.transferIds.length &&
      receiverMap.size === entry.transferIds.length &&
      entry.transferIds.every(id => {
        const matterAllocation = matterMap.get(id);
        const resourceAllocation = resourceMap.get(id);
        const receiverAllocation = receiverMap.get(id);
        return matterAllocation && resourceAllocation && receiverAllocation &&
          matterAllocation.guildId === resourceAllocation.guildId &&
          matterAllocation.guildId === receiverAllocation.guildId &&
          matterAllocation.pool === resourceAllocation.pool &&
          matterAllocation.pool === receiverAllocation.pool &&
          same(matterAllocation.carbonKgC,
            resourceAllocation.supportedCarbonKgC, 1e-7) &&
          same(matterAllocation.carbonKgC,
            receiverAllocation.carbonKgC, 1e-7) &&
          same(matterAllocation.nitrogenKgN,
            receiverAllocation.nitrogenKgN, 1e-7) &&
          same(resourceAllocation.phosphorusKgP,
            receiverAllocation.phosphorusKgP, 1e-9);
      }) && entry.truth?.exactSenderReceiverTransferIds === true;
  });
  const transitionsValid = receiptShapeValid && entries.every(entry => {
    if (entry.status ===
      'initialized-after-v12-migration-no-invented-history') {
      return entry.transferIds.length === 0 &&
        same(entry.transfers?.carbonKgC, 0) &&
        same(entry.transfers?.nitrogenKgN, 0) &&
        same(entry.transfers?.phosphorusKgP, 0) &&
        entry.truth?.migrationInventedHistory === false;
    }
    if (entry.status === 'life-disabled-dormant') {
      return entry.transferIds.length === 0 &&
        entry.truth?.decompositionPoolsFrozen === true;
    }
    return ['detritus-returned-to-local-floodplain-chemistry',
      'decomposition-maintained-no-eligible-detritus']
      .includes(entry.status) &&
      entry.truth?.carbonNitrogenPhosphorusClosed === true;
  });
  const ledgersValid = receiptShapeValid && entries.every(entry =>
    close(entry.closure?.maximumTransferResidualKg, 1e-7) &&
    close(entry.closure?.carbonResidualKgC, 1e-7) &&
    close(entry.closure?.nitrogenResidualKgN, 1e-7) &&
    close(entry.closure?.phosphorusResidualKgP, 1e-9) &&
    entry.truth?.carbonNitrogenPhosphorusClosed === true);
  const conservationValid = [
    receipt.conservation?.detritalReturnCarbonResidualKgC,
    receipt.conservation?.detritalReturnNitrogenResidualKgN,
    receipt.conservation?.detritalReturnPhosphorusResidualKgP,
    receipt.conservation?.detritalSupportedCarbonReferenceResidualKgC
  ].every(value => close(value, 1));
  const basinTruthValid =
    receipt.truth?.persistentFloodplainDecomposition === true &&
    receipt.truth?.floodplainDecompositionEvidenceBound === true &&
    receipt.truth?.floodplainDecompositionSendersAndReceiverClosed === true &&
    receipt.truth?.floodplainDetritalReturnScaleAwareNumericClosure === true &&
    receipt.truth?.floodplainDetritalReturnPerMaterialChannelNumericBounds ===
      true &&
    receipt.truth?.floodplainDetritalReturnMeasuredResidualsPreserved ===
      true &&
    receipt.truth?.exactFloodplainDecompositionTransferIds === true &&
    receipt.truth?.floodplainDecompositionLedgersClosed === true &&
    receipt.truth?.onlyResourceBackedFloodplainDetritusDecomposes === true &&
    receipt.truth?.floodplainDecompositionIndependentCreation === false &&
    receipt.truth?.floodplainDecompositionAtmosphericRespirationModeled ===
      false &&
    receipt.truth?.floodplainDecompositionOxygenConsumptionModeled === false;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && matterSendersValid && resourceSendersValid &&
    receiversValid && entrySchemasValid && lineageValid && pairingValid &&
    transitionsValid && ledgersValid && conservationValid && basinTruthValid;
  return check('floodplain-decomposition-receipts',
    valid ? 'PASS' : 'FAIL',
    'Resource-backed standing-dead and litter C/N/P are debited and credited to local floodplain chemistry under exact IDs and bounded aggregate activity.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedDecompositionSchema: FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA,
      expectedMatterDebitSchema:
        FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA,
      expectedResourceDebitSchema:
        FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA,
      expectedReceiverSchema: FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
      expectedReceiverMassClosurePolicySchema:
        FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA,
      decompositionReceiptCount: Array.isArray(entries)
        ? entries.length : null,
      criteria: { receiptShapeValid, matterSendersValid,
        resourceSendersValid, receiversValid, receiverNumericFailures,
        entrySchemasValid,
        lineageValid, pairingValid, transitionsValid, ledgersValid,
        conservationValid, basinTruthValid },
      conservation: {
        carbonResidualKgC: receipt.conservation
          ?.detritalReturnCarbonResidualKgC ?? null,
        nitrogenResidualKgN: receipt.conservation
          ?.detritalReturnNitrogenResidualKgN ?? null,
        phosphorusResidualKgP: receipt.conservation
          ?.detritalReturnPhosphorusResidualKgP ?? null,
        supportedCarbonReferenceResidualKgC: receipt.conservation
          ?.detritalSupportedCarbonReferenceResidualKgC ?? null
      },
      receiptDigest: receipt.digest || null
    });
}

const numericRound = (value, digits = 12) =>
  Number(Number(value).toFixed(digits));

function atmosphereFloodplainGasNumericClosure(entry) {
  const operands = entry?.conservation?.operandsKg || {};
  const carbon = operands.carbon || {};
  const oxygen = operands.oxygen || {};
  const identities = {
    carbonResidualKgC: numericRound(Number(carbon.afterKgC) -
      Number(carbon.beforeKgC) - Number(carbon.creditKgC) +
      Number(carbon.debitKgC)),
    oxygenResidualKgO2: numericRound(Number(oxygen.beforeKgO2) -
      Number(oxygen.afterKgO2) - Number(oxygen.debitKgO2))
  };
  const toleranceInputs = {
    carbonResidualKgC: ['carbonKgC', carbon.beforeKgC,
      carbon.creditKgC, carbon.debitKgC, carbon.afterKgC],
    oxygenResidualKgO2: ['oxygenKgO2', oxygen.beforeKgO2,
      oxygen.debitKgO2, oxygen.afterKgO2]
  };
  const expectedToleranceKg = Object.fromEntries(Object.entries(
    toleranceInputs).map(([key, [channel, ...values]]) => {
      const magnitudeKg = Math.max(1, ...values.map(value =>
        Math.abs(Number(value))));
      return [key, numericRound(Math.max(
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG[
          channel],
        magnitudeKg * Number.EPSILON *
          ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ULP_FACTOR))];
    }));
  const declaredResidualKg = Object.fromEntries(Object.keys(identities)
    .map(key => [key, entry?.conservation?.[key]]));
  const declaredToleranceKg = entry?.conservation?.numericToleranceKg || {};
  const residualTolerancePairs = Object.keys(identities).map(key => [
    Math.abs(Number(identities[key])), expectedToleranceKg[key]
  ]);
  const expectedMaximumResidualKg = Math.max(0,
    ...residualTolerancePairs.map(([residual]) => residual));
  const expectedMaximumToleranceUtilization = Math.max(0,
    ...residualTolerancePairs.map(([residual, tolerance]) =>
      tolerance > 0 ? residual / tolerance : Infinity));
  const policyFloors = entry?.conservation?.policy?.absoluteFloorsKg || {};
  const expectedFloorEntries = Object.entries(
    ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG);
  const policyFloorsValid = Object.keys(policyFloors).length ===
      expectedFloorEntries.length && expectedFloorEntries.every(
      ([channel, floor]) => same(policyFloors[channel], floor, 1e-18));
  const operandsFinite = [carbon.beforeKgC, carbon.creditKgC,
    carbon.debitKgC, carbon.afterKgC, oxygen.beforeKgO2,
    oxygen.debitKgO2, oxygen.afterKgO2].every(finite);
  const residualsMatch = Object.keys(identities).every(key =>
    same(declaredResidualKg[key], identities[key], 1e-12));
  const tolerancesExact = Object.keys(expectedToleranceKg).length ===
      Object.keys(declaredToleranceKg).length &&
    Object.keys(expectedToleranceKg).every(key =>
      same(declaredToleranceKg[key], expectedToleranceKg[key], 1e-12));
  const valid = operandsFinite &&
    entry?.conservation?.policy?.schema ===
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA &&
    policyFloorsValid && entry.conservation.policy.ulpFactor ===
      ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ULP_FACTOR &&
    entry.conservation.policy.recordedOperandScale === true &&
    entry.conservation.policy.perIdentity === true &&
    entry.conservation.policy.arbitraryToleranceAuthority === false &&
    residualsMatch && tolerancesExact &&
    residualTolerancePairs.every(([residual, tolerance]) =>
      finite(residual) && residual <= tolerance) &&
    same(entry?.conservation?.maximumResidualKg,
      expectedMaximumResidualKg, 1e-9) &&
    same(entry?.conservation?.maximumToleranceUtilization,
      expectedMaximumToleranceUtilization, 1e-9) &&
    entry?.truth?.carbonAndOxygenClosed === true &&
    entry?.truth?.scaleAwareFloatingPointClosure === true &&
    entry?.truth?.perIdentityNumericBounds === true &&
    entry?.truth?.measuredResidualsPreserved === true &&
    entry?.truth?.fixedAbsoluteToleranceOnly === false;
  return { valid, identities, declaredResidualKg,
    declaredToleranceKg, expectedToleranceKg };
}

function floodplainReactionNumericClosure(entry, kind) {
  const before = entry?.before || {};
  const after = entry?.after || {};
  const reaction = entry?.reaction || {};
  const exchange = entry?.exchange || {};
  let identities = {};
  let toleranceInputs = {};
  if (kind === 'aerobic') {
    const oxygenRatio = 32 / 12;
    identities = {
      dissolvedOrganicCarbonDebitResidualKgC: numericRound(
        Number(before.dissolvedOrganicCarbonKgC) -
        Number(after.dissolvedOrganicCarbonKgC) -
        Number(reaction.dissolvedOrganicCarbonConsumedKgC)),
      dissolvedInorganicCarbonCreditResidualKgC: numericRound(
        Number(after.dissolvedInorganicCarbonKgC) -
        Number(before.dissolvedInorganicCarbonKgC) -
        Number(reaction.dissolvedInorganicCarbonProducedKgC)),
      carbonResidualKgC: numericRound(
        Number(after.dissolvedOrganicCarbonKgC) +
        Number(after.dissolvedInorganicCarbonKgC) -
        Number(before.dissolvedOrganicCarbonKgC) -
        Number(before.dissolvedInorganicCarbonKgC)),
      dissolvedOxygenDebitResidualKgO2: numericRound(
        Number(before.dissolvedOxygenKgO2) -
        Number(after.dissolvedOxygenKgO2) -
        Number(reaction.dissolvedOxygenConsumedKgO2)),
      stoichiometricOxygenResidualKgO2: numericRound(
        Number(reaction.dissolvedOxygenConsumedKgO2) -
        Number(reaction.dissolvedOrganicCarbonConsumedKgC) * oxygenRatio)
    };
    toleranceInputs = {
      dissolvedOrganicCarbonDebitResidualKgC: ['carbonKgC',
        before.dissolvedOrganicCarbonKgC,
        after.dissolvedOrganicCarbonKgC,
        reaction.dissolvedOrganicCarbonConsumedKgC],
      dissolvedInorganicCarbonCreditResidualKgC: ['carbonKgC',
        after.dissolvedInorganicCarbonKgC,
        before.dissolvedInorganicCarbonKgC,
        reaction.dissolvedInorganicCarbonProducedKgC],
      carbonResidualKgC: ['carbonKgC',
        after.dissolvedOrganicCarbonKgC,
        after.dissolvedInorganicCarbonKgC,
        before.dissolvedOrganicCarbonKgC,
        before.dissolvedInorganicCarbonKgC],
      dissolvedOxygenDebitResidualKgO2: ['oxygenKgO2',
        before.dissolvedOxygenKgO2, after.dissolvedOxygenKgO2,
        reaction.dissolvedOxygenConsumedKgO2],
      stoichiometricOxygenResidualKgO2: ['oxygenKgO2',
        reaction.dissolvedOxygenConsumedKgO2,
        reaction.dissolvedOrganicCarbonConsumedKgC,
        Number(reaction.dissolvedOrganicCarbonConsumedKgC) * oxygenRatio]
    };
  } else if (kind === 'denitrification') {
    const nitrogenRatio = 14 / 15;
    const alkalinityRatio = 3.57;
    identities = {
      dissolvedOrganicCarbonDebitResidualKgC: numericRound(
        Number(before.dissolvedOrganicCarbonKgC) -
        Number(after.dissolvedOrganicCarbonKgC) -
        Number(reaction.dissolvedOrganicCarbonConsumedKgC)),
      dissolvedInorganicCarbonCreditResidualKgC: numericRound(
        Number(after.dissolvedInorganicCarbonKgC) -
        Number(before.dissolvedInorganicCarbonKgC) -
        Number(reaction.dissolvedInorganicCarbonProducedKgC)),
      carbonResidualKgC: numericRound(
        Number(after.dissolvedOrganicCarbonKgC) +
        Number(after.dissolvedInorganicCarbonKgC) -
        Number(before.dissolvedOrganicCarbonKgC) -
        Number(before.dissolvedInorganicCarbonKgC)),
      dissolvedNitrateNitrogenDebitResidualKgN: numericRound(
        Number(before.dissolvedNitrateNitrogenKgN) -
        Number(after.dissolvedNitrateNitrogenKgN) -
        Number(reaction.dissolvedNitrateNitrogenConsumedKgN)),
      dissolvedAmmoniumNitrogenResidualKgN: numericRound(
        Number(after.dissolvedAmmoniumNitrogenKgN) -
        Number(before.dissolvedAmmoniumNitrogenKgN)),
      dissolvedInorganicNitrogenDebitResidualKgN: numericRound(
        Number(before.dissolvedInorganicNitrogenKgN) -
        Number(after.dissolvedInorganicNitrogenKgN) -
        Number(reaction.dissolvedNitrateNitrogenConsumedKgN)),
      nitrogenGasBoundaryResidualKgN: numericRound(
        Number(reaction.dissolvedNitrateNitrogenConsumedKgN) -
        Number(reaction.nitrogenGasProducedKgN)),
      nitrogenResidualKgN: numericRound(
        Number(before.dissolvedInorganicNitrogenKgN) -
        Number(after.dissolvedInorganicNitrogenKgN) -
        Number(reaction.nitrogenGasProducedKgN)),
      stoichiometricNitrogenResidualKgN: numericRound(
        Number(reaction.dissolvedNitrateNitrogenConsumedKgN) -
        Number(reaction.dissolvedOrganicCarbonConsumedKgC) * nitrogenRatio),
      alkalinityCreditResidualKgCaCO3Eq: numericRound(
        Number(after.alkalinityKgCaCO3Eq) -
        Number(before.alkalinityKgCaCO3Eq) -
        Number(reaction.alkalinityGeneratedKgCaCO3Eq)),
      stoichiometricAlkalinityResidualKgCaCO3Eq: numericRound(
        Number(reaction.alkalinityGeneratedKgCaCO3Eq) -
        Number(reaction.dissolvedNitrateNitrogenConsumedKgN) *
          alkalinityRatio)
    };
    toleranceInputs = {
      dissolvedOrganicCarbonDebitResidualKgC: ['carbonKgC',
        before.dissolvedOrganicCarbonKgC,
        after.dissolvedOrganicCarbonKgC,
        reaction.dissolvedOrganicCarbonConsumedKgC],
      dissolvedInorganicCarbonCreditResidualKgC: ['carbonKgC',
        after.dissolvedInorganicCarbonKgC,
        before.dissolvedInorganicCarbonKgC,
        reaction.dissolvedInorganicCarbonProducedKgC],
      carbonResidualKgC: ['carbonKgC',
        after.dissolvedOrganicCarbonKgC,
        after.dissolvedInorganicCarbonKgC,
        before.dissolvedOrganicCarbonKgC,
        before.dissolvedInorganicCarbonKgC],
      dissolvedNitrateNitrogenDebitResidualKgN: ['nitrogenKgN',
        before.dissolvedNitrateNitrogenKgN,
        after.dissolvedNitrateNitrogenKgN,
        reaction.dissolvedNitrateNitrogenConsumedKgN],
      dissolvedAmmoniumNitrogenResidualKgN: ['ammoniumNitrogenKgN',
        after.dissolvedAmmoniumNitrogenKgN,
        before.dissolvedAmmoniumNitrogenKgN],
      dissolvedInorganicNitrogenDebitResidualKgN: ['nitrogenKgN',
        before.dissolvedInorganicNitrogenKgN,
        after.dissolvedInorganicNitrogenKgN,
        reaction.dissolvedNitrateNitrogenConsumedKgN],
      nitrogenGasBoundaryResidualKgN: ['nitrogenKgN',
        reaction.dissolvedNitrateNitrogenConsumedKgN,
        reaction.nitrogenGasProducedKgN],
      nitrogenResidualKgN: ['nitrogenKgN',
        before.dissolvedInorganicNitrogenKgN,
        after.dissolvedInorganicNitrogenKgN,
        reaction.nitrogenGasProducedKgN],
      stoichiometricNitrogenResidualKgN: ['nitrogenKgN',
        reaction.dissolvedNitrateNitrogenConsumedKgN,
        reaction.dissolvedOrganicCarbonConsumedKgC,
        Number(reaction.dissolvedOrganicCarbonConsumedKgC) * nitrogenRatio],
      alkalinityCreditResidualKgCaCO3Eq: ['alkalinityKgCaCO3Eq',
        after.alkalinityKgCaCO3Eq, before.alkalinityKgCaCO3Eq,
        reaction.alkalinityGeneratedKgCaCO3Eq],
      stoichiometricAlkalinityResidualKgCaCO3Eq:
        ['alkalinityKgCaCO3Eq',
          reaction.alkalinityGeneratedKgCaCO3Eq,
          reaction.dissolvedNitrateNitrogenConsumedKgN,
          Number(reaction.dissolvedNitrateNitrogenConsumedKgN) *
            alkalinityRatio]
    };
  } else if (kind === 'nitrification') {
    const oxygenRatio = 4.57;
    const alkalinityRatio = 7.14;
    identities = {
      dissolvedAmmoniumNitrogenDebitResidualKgN: numericRound(
        Number(before.dissolvedAmmoniumNitrogenKgN) -
        Number(after.dissolvedAmmoniumNitrogenKgN) -
        Number(reaction.dissolvedAmmoniumNitrogenConsumedKgN)),
      dissolvedNitrateNitrogenCreditResidualKgN: numericRound(
        Number(after.dissolvedNitrateNitrogenKgN) -
        Number(before.dissolvedNitrateNitrogenKgN) -
        Number(reaction.dissolvedNitrateNitrogenProducedKgN)),
      dissolvedInorganicNitrogenResidualKgN: numericRound(
        Number(after.dissolvedInorganicNitrogenKgN) -
        Number(before.dissolvedInorganicNitrogenKgN)),
      dissolvedOxygenDebitResidualKgO2: numericRound(
        Number(before.dissolvedOxygenKgO2) -
        Number(after.dissolvedOxygenKgO2) -
        Number(reaction.dissolvedOxygenConsumedKgO2)),
      stoichiometricOxygenResidualKgO2: numericRound(
        Number(reaction.dissolvedOxygenConsumedKgO2) -
        Number(reaction.dissolvedAmmoniumNitrogenConsumedKgN) *
          oxygenRatio),
      alkalinityDebitResidualKgCaCO3Eq: numericRound(
        Number(before.alkalinityKgCaCO3Eq) -
        Number(after.alkalinityKgCaCO3Eq) -
        Number(reaction.alkalinityDemandKgCaCO3)),
      stoichiometricAlkalinityResidualKgCaCO3Eq: numericRound(
        Number(reaction.alkalinityDemandKgCaCO3) -
        Number(reaction.dissolvedAmmoniumNitrogenConsumedKgN) *
          alkalinityRatio)
    };
    toleranceInputs = {
      dissolvedAmmoniumNitrogenDebitResidualKgN: ['nitrogenKgN',
        before.dissolvedAmmoniumNitrogenKgN,
        after.dissolvedAmmoniumNitrogenKgN,
        reaction.dissolvedAmmoniumNitrogenConsumedKgN],
      dissolvedNitrateNitrogenCreditResidualKgN: ['nitrogenKgN',
        after.dissolvedNitrateNitrogenKgN,
        before.dissolvedNitrateNitrogenKgN,
        reaction.dissolvedNitrateNitrogenProducedKgN],
      dissolvedInorganicNitrogenResidualKgN: ['nitrogenKgN',
        after.dissolvedInorganicNitrogenKgN,
        before.dissolvedInorganicNitrogenKgN],
      dissolvedOxygenDebitResidualKgO2: ['oxygenKgO2',
        before.dissolvedOxygenKgO2, after.dissolvedOxygenKgO2,
        reaction.dissolvedOxygenConsumedKgO2],
      stoichiometricOxygenResidualKgO2: ['oxygenKgO2',
        reaction.dissolvedOxygenConsumedKgO2,
        reaction.dissolvedAmmoniumNitrogenConsumedKgN,
        Number(reaction.dissolvedAmmoniumNitrogenConsumedKgN) *
          oxygenRatio],
      alkalinityDebitResidualKgCaCO3Eq: ['alkalinityKgCaCO3Eq',
        before.alkalinityKgCaCO3Eq, after.alkalinityKgCaCO3Eq,
        reaction.alkalinityDemandKgCaCO3],
      stoichiometricAlkalinityResidualKgCaCO3Eq:
        ['alkalinityKgCaCO3Eq', reaction.alkalinityDemandKgCaCO3,
          reaction.dissolvedAmmoniumNitrogenConsumedKgN,
          Number(reaction.dissolvedAmmoniumNitrogenConsumedKgN) *
            alkalinityRatio]
    };
  } else if (kind === 'gas-exchange') {
    identities = {
      carbonTransferResidualKgC: numericRound(
        Number(after.dissolvedInorganicCarbonKgC) -
        Number(before.dissolvedInorganicCarbonKgC) +
        Number(exchange.carbonToAtmosphereKgC) -
        Number(exchange.carbonToFloodplainKgC)),
      oxygenTransferResidualKgO2: numericRound(
        Number(after.dissolvedOxygenKgO2) -
        Number(before.dissolvedOxygenKgO2) -
        Number(exchange.oxygenToFloodplainKgO2))
    };
    toleranceInputs = {
      carbonTransferResidualKgC: ['carbonKgC',
        after.dissolvedInorganicCarbonKgC,
        before.dissolvedInorganicCarbonKgC,
        exchange.carbonToAtmosphereKgC,
        exchange.carbonToFloodplainKgC],
      oxygenTransferResidualKgO2: ['oxygenKgO2',
        after.dissolvedOxygenKgO2, before.dissolvedOxygenKgO2,
        exchange.oxygenToFloodplainKgO2]
    };
  }
  const expectedToleranceKg = Object.fromEntries(
    Object.entries(toleranceInputs).map(([key, [channel, ...values]]) =>
      [key, floodplainReactionMassClosureToleranceKg(channel, ...values)]));
  const declaredResidualKg = Object.fromEntries(Object.keys(identities)
    .map(key => [key, entry?.closure?.[key]]));
  const declaredToleranceKg = entry?.closure?.numericToleranceKg || {};
  const residualTolerancePairs = Object.keys(identities).map(key => [
    Math.abs(Number(identities[key])), expectedToleranceKg[key]
  ]);
  const expectedMaximumResidualKg = Math.max(0,
    ...residualTolerancePairs.map(([residual]) => residual));
  const expectedMaximumToleranceUtilization = Math.max(0,
    ...residualTolerancePairs.map(([residual, tolerance]) =>
      tolerance > 0 ? residual / tolerance : Infinity));
  const policyFloors = entry?.closure?.policy?.absoluteFloorsKg || {};
  const expectedFloorEntries = Object.entries(
    FLOODPLAIN_REACTION_MASS_CLOSURE_ABSOLUTE_FLOORS_KG);
  const policyFloorsValid = Object.keys(policyFloors).length ===
      expectedFloorEntries.length && expectedFloorEntries.every(
      ([channel, floor]) => same(policyFloors[channel], floor, 1e-18));
  const residualsMatch = Object.keys(identities).every(key =>
    same(declaredResidualKg[key], identities[key], 1e-12));
  const tolerancesExact = Object.keys(expectedToleranceKg).length ===
      Object.keys(declaredToleranceKg).length &&
    Object.keys(expectedToleranceKg).every(key =>
      same(declaredToleranceKg[key], expectedToleranceKg[key], 1e-12));
  const valid = Object.keys(identities).length > 0 &&
    entry?.closure?.policy?.schema ===
      FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA &&
    policyFloorsValid && entry.closure.policy.ulpFactor ===
      FLOODPLAIN_REACTION_MASS_CLOSURE_ULP_FACTOR &&
    entry.closure.policy.recordedOperandScale === true &&
    entry.closure.policy.perIdentity === true &&
    entry.closure.policy.arbitraryToleranceAuthority === false &&
    residualsMatch && tolerancesExact &&
    residualTolerancePairs.every(([residual, tolerance]) =>
      finite(residual) && residual <= tolerance) &&
    same(entry?.closure?.maximumResidualKg,
      expectedMaximumResidualKg, 1e-9) &&
    same(entry?.closure?.maximumToleranceUtilization,
      expectedMaximumToleranceUtilization, 1e-9) &&
    entry?.truth?.scaleAwareFloatingPointClosure === true &&
    entry?.truth?.perIdentityNumericBounds === true &&
    entry?.truth?.measuredResidualsPreserved === true &&
    entry?.truth?.fixedAbsoluteToleranceOnly === false;
  return { valid, identities, declaredResidualKg,
    declaredToleranceKg, expectedToleranceKg };
}

function floodplainRespirationCheck(receipt) {
  if (!receipt) {
    return check('floodplain-respiration-receipts', 'NOT_APPLICABLE',
      'Floodplain DOC is converted to DIC only through an oxygen-limited local aerobic reaction with explicit carbon and oxygen closure.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-respiration-receipts', 'NOT_APPLICABLE',
      'Floodplain DOC is converted to DIC only through an oxygen-limited local aerobic reaction with explicit carbon and oxygen closure.', {
        reason: 'legacy basin receipt predates the floodplain respiration organ',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const entries = receipt.floodplainRespirationReceipts;
  const reactions = receipt.floodplainAerobicMineralizationReceipts;
  const receiptShapeValid = Array.isArray(entries) &&
    Array.isArray(reactions) && entries.length === reactions.length;
  const reactionByReach = new Map((reactions || []).map(entry =>
    [entry.reachId, entry]));
  const reactionNumericClosures = receiptShapeValid ? reactions.map(entry =>
    ({ entry, numeric: floodplainReactionNumericClosure(entry,
      'aerobic') })) : [];
  const reactionReceiptsValid = receiptShapeValid &&
    reactionNumericClosures.every(({ entry, numeric }) =>
    entry?.schema === FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    numeric.valid &&
    entry.truth?.persistentFloodplainChemistryMutated === true &&
    entry.truth?.localFloodplainChemistryOnly === true &&
    entry.truth?.dissolvedOrganicCarbonSenderDebited === true &&
    entry.truth?.dissolvedInorganicCarbonReceiverCredited === true &&
    entry.truth?.dissolvedOxygenSenderDebited === true &&
    entry.truth?.localDocToDicCarbonClosed === true &&
    entry.truth?.dissolvedOxygenConsumptionClosed === true &&
    entry.truth?.atmosphericGasExchangeModeled === false &&
    entry.truth?.anaerobicPathwayModeled === false);
  const reactionNumericFailures = reactionNumericClosures
    .filter(({ numeric }) => !numeric.valid).slice(0, 8)
    .map(({ entry, numeric }) => ({
      reachId: entry?.reachId || null,
      identityKg: numeric.identities,
      declaredResidualKg: numeric.declaredResidualKg,
      declaredToleranceKg: numeric.declaredToleranceKg,
      expectedToleranceKg: numeric.expectedToleranceKg
    }));
  const entrySchemasValid = receiptShapeValid && entries.every(entry =>
    entry?.schema === FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    entry.truth?.persistentAerobicRespirationProcessMemory === true &&
    entry.truth?.chemistryOwnership === false &&
    entry.truth?.localFloodplainDocSenderRequired === true &&
    entry.truth?.localFloodplainDicReceiverRequired === true &&
    entry.truth?.localFloodplainOxygenSenderRequired === true &&
    entry.truth?.oxygenLimited === true &&
    entry.truth?.atmosphericGasExchangeModeled === false &&
    entry.truth?.anaerobicPathwayModeled === false &&
    entry.truth?.microbialPopulationsResolved === false &&
    entry.truth?.scientificCalibrationClaimed === false);
  const lineageValid = receiptShapeValid && entries.every(entry =>
    reactionByReach.get(entry.reachId)?.digest ===
      entry.mineralizationReceiptDigest);
  const quantitiesPaired = receiptShapeValid && entries.every(entry => {
    const reaction = reactionByReach.get(entry.reachId)?.reaction || {};
    return same(entry.reaction?.dissolvedOrganicCarbonConsumedKgC,
      reaction.dissolvedOrganicCarbonConsumedKgC, 1e-7) &&
      same(entry.reaction?.dissolvedInorganicCarbonProducedKgC,
        reaction.dissolvedInorganicCarbonProducedKgC, 1e-7) &&
      same(entry.reaction?.dissolvedOxygenConsumedKgO2,
        reaction.dissolvedOxygenConsumedKgO2, 1e-7);
  });
  const transitionsValid = receiptShapeValid && entries.every(entry => {
    const magnitude = Number(entry.reaction
      ?.dissolvedOrganicCarbonConsumedKgC || 0) +
      Number(entry.reaction?.dissolvedInorganicCarbonProducedKgC || 0) +
      Number(entry.reaction?.dissolvedOxygenConsumedKgO2 || 0);
    if (entry.status ===
      'initialized-after-v13-migration-no-invented-history') {
      return Math.abs(magnitude) < 1e-12 &&
        entry.truth?.migrationInventedHistory === false;
    }
    if (entry.status === 'life-disabled-dormant') {
      return Math.abs(magnitude) < 1e-12 &&
        entry.truth?.respirationPoolsFrozen === true;
    }
    return ['oxygen-limited-aerobic-doc-mineralization',
      'aerobic-doc-mineralization',
      'oxygen-limited-no-aerobic-capacity',
      'respiration-maintained-no-reactive-doc'].includes(entry.status) &&
      entry.truth?.localDocToDicCarbonClosed === true &&
      entry.truth?.dissolvedOxygenConsumptionClosed === true;
  });
  const conservationValid = [
    receipt.conservation?.floodplainDocToDicCarbonResidualKgC,
    receipt.conservation?.floodplainOxygenConsumptionResidualKgO2,
    receipt.conservation?.floodplainOxygenStoichiometryResidualKgO2
  ].every(value => close(value, 1));
  const basinTruthValid =
    receipt.truth?.persistentFloodplainAerobicRespiration === true &&
    receipt.truth?.floodplainRespirationEvidenceBound === true &&
    receipt.truth?.floodplainRespirationChemistryReceiptsClosed === true &&
    receipt.truth?.floodplainRespirationScaleAwareNumericClosure === true &&
    receipt.truth?.floodplainRespirationPerIdentityNumericBounds === true &&
    receipt.truth?.floodplainRespirationMeasuredResidualsPreserved === true &&
    receipt.truth?.floodplainRespirationCarbonAndOxygenLedgersClosed === true &&
    receipt.truth?.floodplainRespirationOxygenLimited === true &&
    receipt.truth?.floodplainRespirationIndependentCreation === false &&
    receipt.truth?.floodplainRespirationAtmosphericGasExchangeModeled ===
      false &&
    receipt.truth?.floodplainRespirationAnaerobicPathwayModeled === false;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && reactionReceiptsValid && entrySchemasValid &&
    lineageValid && quantitiesPaired && transitionsValid &&
    conservationValid && basinTruthValid;
  return check('floodplain-respiration-receipts',
    valid ? 'PASS' : 'FAIL',
    'Floodplain-owned DOC becomes floodplain-owned DIC only while local dissolved oxygen can satisfy the explicit aerobic reaction.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedRespirationSchema: FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA,
      expectedReactionSchema:
        FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
      respirationReceiptCount: Array.isArray(entries) ? entries.length : null,
      expectedReactionMassClosurePolicySchema:
        FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
      criteria: { receiptShapeValid, reactionReceiptsValid,
        reactionNumericFailures,
        entrySchemasValid, lineageValid, quantitiesPaired,
        transitionsValid, conservationValid, basinTruthValid },
      conservation: {
        carbonResidualKgC: receipt.conservation
          ?.floodplainDocToDicCarbonResidualKgC ?? null,
        oxygenConsumptionResidualKgO2: receipt.conservation
          ?.floodplainOxygenConsumptionResidualKgO2 ?? null,
        oxygenStoichiometryResidualKgO2: receipt.conservation
          ?.floodplainOxygenStoichiometryResidualKgO2 ?? null
      },
      receiptDigest: receipt.digest || null
    });
}

function floodplainDenitrificationCheck(receipt) {
  const claim = 'Floodplain DOC and owned nitrate-N become local DIC, alkalinity and native surface-layer atmospheric N2 only through paired, oxygen-gated, surface-temperature-responsive owner receipts; ammonium remains untouched.';
  if (!receipt) {
    return check('floodplain-denitrification-receipts', 'NOT_APPLICABLE',
      claim, { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-denitrification-receipts', 'NOT_APPLICABLE',
      claim, {
        reason: 'legacy basin receipt predates persistent floodplain denitrification',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const processes = receipt.floodplainDenitrificationProcessReceipts;
  const floodplainOwners =
    receipt.floodplainDenitrificationReactionReceipts;
  const atmosphereOwners =
    receipt.atmosphereFloodplainDenitrificationReceipts;
  const receiptShapeValid = Array.isArray(processes) &&
    Array.isArray(floodplainOwners) && Array.isArray(atmosphereOwners) &&
    floodplainOwners.length === atmosphereOwners.length;
  const reactionByTransfer = new Map((floodplainOwners || []).map(entry =>
    [entry.transferId, entry]));
  const atmosphereByTransfer = new Map((atmosphereOwners || []).map(entry =>
    [entry.transferId, entry]));
  const floodplainOwnerNumericClosures = receiptShapeValid ?
    floodplainOwners.map(entry => ({ entry,
      numeric: floodplainReactionNumericClosure(entry,
        'denitrification') })) : [];
  const floodplainOwnerReceiptsValid = receiptShapeValid &&
    floodplainOwnerNumericClosures.every(({ entry, numeric }) =>
      entry?.schema ===
        FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA &&
      typeof entry.transferId === 'string' && entry.transferId.length > 0 &&
      typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
      numeric.valid &&
      entry.truth?.persistentFloodplainChemistryMutated === true &&
      entry.truth?.localDocToDicCarbonClosed === true &&
      entry.truth?.nitrogenGasBoundaryClosed === true &&
      entry.truth?.dissolvedNitrateNitrogenSenderDebited === true &&
      entry.truth?.alkalinityReceiverCredited === true &&
      entry.truth?.denitrificationAlkalinityClosed === true &&
      entry.truth?.dissolvedAmmoniumNitrogenUntouched === true &&
      entry.truth?.dissolvedInorganicNitrogenTreatedAsFullyNitrate ===
        false &&
      entry.truth?.nitrateSpeciationResolved === true &&
      entry.truth?.nitrateAndAmmoniumMaterialPools === true &&
      entry.truth?.nitritePoolResolved === false &&
      entry.truth?.independentCarbonCreation === false &&
      entry.truth?.independentNitrogenCreation === false);
  const floodplainOwnerNumericFailures = floodplainOwnerNumericClosures
    .filter(({ numeric }) => !numeric.valid).slice(0, 8)
    .map(({ entry, numeric }) => ({
      transferId: entry?.transferId || null,
      reachId: entry?.reachId || null,
      identityKg: numeric.identities,
      declaredResidualKg: numeric.declaredResidualKg,
      declaredToleranceKg: numeric.declaredToleranceKg,
      expectedToleranceKg: numeric.expectedToleranceKg
    }));
  const atmosphereOwnerReceiptsValid = receiptShapeValid &&
    atmosphereOwners.every(entry =>
      entry?.schema === ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA &&
      entry.sourceKind === 'floodplain-denitrification' &&
      typeof entry.transferId === 'string' && entry.transferId.length > 0 &&
      typeof entry.sourceReachId === 'string' &&
        entry.sourceReachId.length > 0 &&
      typeof entry.sourceReceiptDigest === 'string' &&
        entry.sourceReceiptDigest.length > 0 &&
      same(entry.inputs?.carbonKgC, 0) &&
      same(entry.inputs?.oxygenKgO2, 0) &&
      Number(entry.inputs?.nitrogenKgN) >= 0 &&
      entry.receiverCredits?.nativeLayerIndex === 0 &&
      close(entry.conservation?.carbonResidualKgC, 1e-7) &&
      close(entry.conservation?.oxygenResidualKgO2, 1e-7) &&
      close(entry.conservation?.nitrogenResidualKgN, 1e-7) &&
      entry.truth?.persistentAtmosphericReceiver === true &&
      entry.truth?.nativePressureLayerComposition === true &&
      entry.truth?.surfaceLayerCoupled === true &&
      entry.truth?.exactTransferIdentity === true);
  const processReceiptsValid = receiptShapeValid && processes.every(entry =>
    entry?.schema === FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA &&
    typeof entry.transferId === 'string' && entry.transferId.length > 0 &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    entry.truth?.persistentDenitrificationProcessMemory === true &&
    entry.truth?.floodplainChemistryOwnership === false &&
    entry.truth?.atmosphereNitrogenOwnership === false &&
    entry.truth?.pairedOwnerReceiptsRequiredWhenAtmosphereLoaded === true &&
    entry.truth?.oxygenGated === true &&
    entry.truth?.nitrogenLimited === true &&
    entry.truth?.alkalinityGenerationClosureRequired === true &&
    entry.truth?.surfaceTemperatureProxyResponsive === false &&
    entry.truth?.q10TemperatureResponseParameterized === true &&
    entry.truth?.persistentFloodplainWaterTemperatureState === true &&
    entry.truth?.floodplainThermalReceiptBindingRequired === true &&
    entry.truth?.resolvedFloodplainFreezeThawState === false &&
    entry.truth?.arrheniusKineticsResolved === false &&
    entry.truth?.reactiveNitrateEquivalentFractionParameterized === false &&
    entry.truth?.dissolvedInorganicNitrogenTreatedAsFullyNitrate === false &&
    entry.truth?.nitrateSpeciationResolved === true &&
    entry.truth?.nitrateAndAmmoniumMaterialPools === true &&
    entry.truth?.nitrateOnlyDenitrification === true &&
    entry.truth?.ammoniumConsumedByDenitrification === false &&
    entry.truth?.nitritePoolResolved === false &&
    entry.truth?.nitrificationReactionModeled === false &&
    entry.truth?.microbialPopulationsResolved === false &&
    entry.truth?.mechanisticRedoxModel === false &&
    entry.truth
      ?.surfaceTemperatureForcingUsedAsWaterTemperatureProxy === false &&
    entry.truth?.persistentFloodplainThermalStateUsed === true &&
    typeof entry.activity?.floodplainThermalReceiptDigest === 'string' &&
    finite(entry.activity?.waterTemperatureC) &&
    finite(entry.activity?.referenceTemperatureC) &&
    Number(entry.activity?.temperatureQ10) >= .5 &&
    Number(entry.activity?.temperatureQ10) <= 4 &&
    Number(entry.activity?.temperatureResponseFactor) >= .05 &&
    Number(entry.activity?.temperatureResponseFactor) <= 4 &&
    typeof entry.activity?.temperatureConstrained === 'boolean' &&
    finite(entry.activity?.availableDissolvedNitrateNitrogenKgN) &&
    finite(entry.activity?.availableDissolvedAmmoniumNitrogenKgN) &&
    entry.truth?.scientificCalibrationClaimed === false);
  const lineageValid = receiptShapeValid && processes.every(entry => {
    if (entry.atmosphereCellId == null) {
      return entry.reactionReceiptDigest == null &&
        entry.atmosphereReceiptDigest == null &&
        !reactionByTransfer.has(entry.transferId) &&
        !atmosphereByTransfer.has(entry.transferId);
    }
    const floodplainOwner = reactionByTransfer.get(entry.transferId);
    const atmosphereOwner = atmosphereByTransfer.get(entry.transferId);
    return floodplainOwner?.digest === entry.reactionReceiptDigest &&
      atmosphereOwner?.digest === entry.atmosphereReceiptDigest &&
      floodplainOwner?.reachId === entry.reachId &&
      atmosphereOwner?.sourceReachId === entry.reachId &&
      atmosphereOwner?.sourceReceiptDigest === floodplainOwner?.digest;
  });
  const quantitiesPaired = receiptShapeValid && processes.every(entry => {
    if (entry.atmosphereCellId == null) return true;
    const floodplainOwner = reactionByTransfer.get(entry.transferId);
    const atmosphereOwner = atmosphereByTransfer.get(entry.transferId);
    return ['dissolvedOrganicCarbonConsumedKgC',
      'dissolvedInorganicCarbonProducedKgC',
      'dissolvedNitrateNitrogenConsumedKgN',
      'nitrogenGasProducedKgN',
      'alkalinityGeneratedKgCaCO3Eq'].every(key =>
      same(entry.reaction?.[key], floodplainOwner?.reaction?.[key], 1e-7)) &&
      same(entry.reaction?.nitrogenGasProducedKgN,
        atmosphereOwner?.inputs?.nitrogenKgN, 1e-7);
  });
  const transitionsValid = receiptShapeValid && processes.every(entry => {
    const magnitude = Object.values(entry.reaction || {}).reduce(
      (sum, value) => sum + Number(value || 0), 0);
    if (entry.status ===
      'initialized-after-v18-migration-no-invented-history') {
      return Math.abs(magnitude) < 1e-12 &&
        entry.truth?.migrationInventedHistory === false;
    }
    if (entry.status === 'atmosphere-unloaded-no-denitrification') {
      return Math.abs(magnitude) < 1e-12 && entry.atmosphereCellId == null;
    }
    if (entry.status === 'life-disabled-dormant') {
      return Math.abs(magnitude) < 1e-12 &&
        entry.truth?.denitrificationPoolsFrozen === true;
    }
    return ['nitrogen-limited-anoxic-denitrification',
      'temperature-constrained-anoxic-denitrification',
      'anoxic-doc-denitrification', 'oxic-no-denitrification',
      'denitrification-maintained-no-reactive-doc-or-nitrate']
      .includes(entry.status) &&
      entry.truth?.pairedOwnerReceiptsPresent === true &&
      entry.truth?.exactTransferIdentity === true &&
      entry.truth?.ownerLedgersClosed === true;
  });
  const conservationValid = [
    receipt.conservation?.floodplainDenitrificationCarbonResidualKgC,
    receipt.conservation
      ?.floodplainDenitrificationNitrogenReactionResidualKgN,
    receipt.conservation
      ?.floodplainAtmosphereDenitrificationTransferResidualKgN,
    receipt.conservation?.floodplainDenitrificationOwnerResidualKgN,
    receipt.conservation?.atmosphereDenitrificationOwnerResidualKgN,
    receipt.conservation
      ?.floodplainDenitrificationAlkalinityOwnerResidualKgCaCO3Eq,
    receipt.conservation
      ?.floodplainDenitrificationAlkalinityStoichiometryResidualKgCaCO3Eq
  ].every(value => close(value, 1));
  const basinTruthValid =
    receipt.truth?.persistentFloodplainDenitrification === true &&
    receipt.truth?.floodplainDenitrificationOwnerReceiptsTyped === true &&
    receipt.truth?.floodplainDenitrificationEvidenceBound === true &&
    receipt.truth?.exactFloodplainDenitrificationTransferIds === true &&
    receipt.truth?.floodplainDenitrificationScaleAwareNumericClosure ===
      true &&
    receipt.truth?.floodplainDenitrificationPerIdentityNumericBounds ===
      true &&
    receipt.truth?.floodplainDenitrificationMeasuredResidualsPreserved ===
      true &&
    receipt.truth
      ?.floodplainDenitrificationCarbonNitrogenAndAlkalinityLedgersClosed ===
      true &&
    receipt.truth?.floodplainDenitrificationOxygenGated === true &&
    receipt.truth?.floodplainDenitrificationNitrogenLimited === true &&
    receipt.truth
      ?.floodplainDenitrificationSurfaceTemperatureProxyResponsive ===
      false &&
    receipt.truth
      ?.floodplainDenitrificationQ10TemperatureResponseParameterized ===
      true &&
    receipt.truth
      ?.floodplainDenitrificationPersistentWaterTemperatureState ===
      true &&
    receipt.truth?.floodplainDenitrificationArrheniusKineticsResolved ===
      false &&
    receipt.truth
      ?.floodplainDenitrificationReactiveNitrateEquivalentParameterized ===
      false &&
    receipt.truth?.floodplainDenitrificationNitrateSpeciationResolved ===
      true &&
    receipt.truth?.persistentRiverAndFloodplainNitrateAmmoniumPools ===
      true &&
    receipt.truth?.exactNitrateAmmoniumWaterFractionTransport === true &&
    receipt.truth?.parameterizedRunoffDinSpeciation === true &&
    receipt.truth?.measuredRunoffDinSpeciation === false &&
    receipt.truth?.floodplainDenitrificationNitrateOnly === true &&
    receipt.truth?.floodplainDenitrificationAmmoniumConsumption === false &&
    receipt.truth?.floodplainDenitrificationIndependentCreation === false;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && floodplainOwnerReceiptsValid &&
    atmosphereOwnerReceiptsValid && processReceiptsValid && lineageValid &&
    quantitiesPaired && transitionsValid && conservationValid &&
    basinTruthValid;
  return check('floodplain-denitrification-receipts',
    valid ? 'PASS' : 'FAIL', claim, {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedProcessSchema: FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA,
      expectedFloodplainOwnerSchema:
        FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
      expectedAtmosphereOwnerSchema:
        ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA,
      expectedReactionMassClosurePolicySchema:
        FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
      processReceiptCount: Array.isArray(processes)
        ? processes.length : null,
      pairedOwnerReceiptCount: Array.isArray(floodplainOwners)
        ? floodplainOwners.length : null,
      criteria: { receiptShapeValid, floodplainOwnerReceiptsValid,
        floodplainOwnerNumericFailures,
        atmosphereOwnerReceiptsValid, processReceiptsValid, lineageValid,
        quantitiesPaired, transitionsValid, conservationValid,
        basinTruthValid },
      conservation: {
        carbonResidualKgC: receipt.conservation
          ?.floodplainDenitrificationCarbonResidualKgC ?? null,
        nitrogenReactionResidualKgN: receipt.conservation
          ?.floodplainDenitrificationNitrogenReactionResidualKgN ?? null,
        atmosphereTransferResidualKgN: receipt.conservation
          ?.floodplainAtmosphereDenitrificationTransferResidualKgN ?? null,
        floodplainOwnerResidualKgN: receipt.conservation
          ?.floodplainDenitrificationOwnerResidualKgN ?? null,
        atmosphereOwnerResidualKgN: receipt.conservation
          ?.atmosphereDenitrificationOwnerResidualKgN ?? null,
        alkalinityOwnerResidualKgCaCO3Eq: receipt.conservation
          ?.floodplainDenitrificationAlkalinityOwnerResidualKgCaCO3Eq ??
          null,
        alkalinityStoichiometryResidualKgCaCO3Eq: receipt.conservation
          ?.floodplainDenitrificationAlkalinityStoichiometryResidualKgCaCO3Eq ??
          null
      },
      receiptDigest: receipt.digest || null
    });
}

function floodplainNitrificationCheck(receipt) {
  const claim = 'Floodplain ammonium-N becomes nitrate-N only through an oxygen- and alkalinity-stoichiometric local owner receipt; total DIN closes and the persistent alkalinity owner is debited.';
  if (!receipt) {
    return check('floodplain-nitrification-receipts', 'NOT_APPLICABLE',
      claim, { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-nitrification-receipts', 'NOT_APPLICABLE',
      claim, {
        reason: 'legacy basin receipt predates floodplain nitrification',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const processes = receipt.floodplainNitrificationProcessReceipts;
  const owners = receipt.floodplainNitrificationReactionReceipts;
  const receiptShapeValid = Array.isArray(processes) &&
    Array.isArray(owners) && processes.length === owners.length;
  const ownerByTransfer = new Map((owners || []).map(entry =>
    [entry.transferId, entry]));
  const ownerNumericClosures = receiptShapeValid ? owners.map(entry =>
    ({ entry, numeric: floodplainReactionNumericClosure(entry,
      'nitrification') })) : [];
  const ownerReceiptsValid = receiptShapeValid &&
    ownerNumericClosures.every(({ entry, numeric }) =>
    entry?.schema === FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA &&
    typeof entry.transferId === 'string' && entry.transferId.length > 0 &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    numeric.valid &&
    entry.truth?.persistentFloodplainChemistryMutated === true &&
    entry.truth?.localFloodplainChemistryOnly === true &&
    entry.truth?.dissolvedAmmoniumNitrogenSenderDebited === true &&
    entry.truth?.dissolvedNitrateNitrogenReceiverCredited === true &&
    entry.truth?.dissolvedOxygenSenderDebited === true &&
    entry.truth?.alkalinitySenderDebited === true &&
    entry.truth?.ammoniumToNitrateNitrogenClosed === true &&
    entry.truth?.dissolvedOxygenConsumptionClosed === true &&
    entry.truth?.alkalinityConsumptionClosed === true &&
    entry.truth?.alkalinityDemandDiagnosticOnly === false &&
    entry.truth?.alkalinityMaterialOwnerDebited === true &&
    entry.truth?.pHFeedbackModeled === false &&
    entry.truth?.nitriteIntermediateResolved === false &&
    entry.truth?.independentNitrogenCreation === false &&
    entry.truth?.independentOxygenCreation === false);
  const ownerNumericFailures = ownerNumericClosures
    .filter(({ numeric }) => !numeric.valid).slice(0, 8)
    .map(({ entry, numeric }) => ({
      transferId: entry?.transferId || null,
      reachId: entry?.reachId || null,
      identityKg: numeric.identities,
      declaredResidualKg: numeric.declaredResidualKg,
      declaredToleranceKg: numeric.declaredToleranceKg,
      expectedToleranceKg: numeric.expectedToleranceKg
    }));
  const processReceiptsValid = receiptShapeValid && processes.every(entry =>
    entry?.schema === FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA &&
    typeof entry.transferId === 'string' && entry.transferId.length > 0 &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    entry.truth?.persistentNitrificationProcessMemory === true &&
    entry.truth?.floodplainChemistryOwnership === false &&
    entry.truth?.localAmmoniumSenderRequired === true &&
    entry.truth?.localNitrateReceiverRequired === true &&
    entry.truth?.localDissolvedOxygenSenderRequired === true &&
    entry.truth?.localAlkalinitySenderRequired === true &&
    entry.truth?.aerobicProcess === true &&
    entry.truth?.minimumDissolvedOxygenReserveRequired === true &&
    entry.truth?.surfaceTemperatureProxyResponsive === false &&
    entry.truth?.q10TemperatureResponseParameterized === true &&
    entry.truth?.persistentFloodplainWaterTemperatureState === true &&
    entry.truth?.floodplainThermalReceiptBindingRequired === true &&
    entry.truth?.ammoniumToNitrateOneStepApproximation === true &&
    entry.truth?.nitriteIntermediateResolved === false &&
    entry.truth?.alkalinityDemandDiagnostic === false &&
    entry.truth?.alkalinityMaterialOwnerDebited === true &&
    entry.truth?.alkalinityLimitedReaction === true &&
    entry.truth?.alkalinityIsAcidNeutralizingCapacityEquivalent === true &&
    entry.truth?.carbonateSpeciationResolved === false &&
    entry.truth?.pHFeedbackModeled === false &&
    entry.truth?.microbialPopulationsResolved === false &&
    entry.truth?.mechanisticNitrifierModel === false &&
    finite(entry.activity?.dissolvedOxygenMgL) &&
    Number(entry.activity?.oxygenResponseFactor) >= 0 &&
    Number(entry.activity?.oxygenResponseFactor) <= 1 &&
    finite(entry.activity?.waterTemperatureC) &&
    Number(entry.activity?.temperatureQ10) >= .5 &&
    Number(entry.activity?.temperatureQ10) <= 4 &&
    Number(entry.activity?.temperatureResponseFactor) >= .05 &&
    Number(entry.activity?.temperatureResponseFactor) <= 4 &&
    finite(entry.activity
      ?.availableDissolvedAmmoniumNitrogenKgN) &&
    finite(entry.activity?.availableDissolvedOxygenKgO2) &&
    finite(entry.activity?.minimumOxygenReserveKgO2) &&
    Number(entry.activity?.minimumOxygenReserveKgO2) >= 0 &&
    finite(entry.activity?.reactiveDissolvedOxygenKgO2) &&
    Number(entry.activity?.reactiveDissolvedOxygenKgO2) >= 0 &&
    Number(entry.activity?.minimumOxygenReserveKgO2) +
      Number(entry.activity?.reactiveDissolvedOxygenKgO2) <=
      Number(entry.activity?.availableDissolvedOxygenKgO2) + 1e-7 &&
    Number(entry.reaction?.dissolvedOxygenConsumedKgO2) <=
      Number(entry.activity?.reactiveDissolvedOxygenKgO2) + 1e-7 &&
    finite(entry.activity?.availableAlkalinityKgCaCO3Eq) &&
    finite(entry.activity?.alkalinityCapacityKgN) &&
    Number(entry.reaction?.alkalinityDemandKgCaCO3) <=
      Number(entry.activity?.availableAlkalinityKgCaCO3Eq) + 1e-7 &&
    entry.truth?.scientificCalibrationClaimed === false);
  const lineageValid = receiptShapeValid && processes.every(entry => {
    const owner = ownerByTransfer.get(entry.transferId);
    return owner?.digest === entry.reactionReceiptDigest &&
      owner?.reachId === entry.reachId;
  });
  const quantitiesPaired = receiptShapeValid && processes.every(entry => {
    const owner = ownerByTransfer.get(entry.transferId);
    return ['dissolvedAmmoniumNitrogenConsumedKgN',
      'dissolvedNitrateNitrogenProducedKgN',
      'dissolvedOxygenConsumedKgO2',
      'alkalinityDemandKgCaCO3'].every(key =>
      same(entry.reaction?.[key], owner?.reaction?.[key], 1e-7));
  });
  const transitionsValid = receiptShapeValid && processes.every(entry => {
    const magnitude = Object.values(entry.reaction || {}).reduce(
      (sum, value) => sum + Number(value || 0), 0);
    if (entry.status ===
      'initialized-after-schema-migration-no-invented-history') {
      return Math.abs(magnitude) < 1e-12 &&
        entry.truth?.migrationInventedHistory === false;
    }
    if (entry.status === 'life-disabled-dormant') {
      return Math.abs(magnitude) < 1e-12 &&
        entry.truth?.nitrificationPoolsFrozen === true;
    }
    return ['alkalinity-limited-ammonium-nitrification',
      'oxygen-limited-ammonium-nitrification',
      'temperature-constrained-ammonium-nitrification',
      'aerobic-ammonium-nitrification',
      'oxygen-constrained-no-nitrification',
      'nitrification-maintained-no-ammonium'].includes(entry.status) &&
      entry.truth?.localFloodplainChemistryReaction === true &&
      entry.truth?.ammoniumToNitrateNitrogenClosed === true &&
      entry.truth?.dissolvedOxygenConsumptionClosed === true &&
      entry.truth?.alkalinityConsumptionClosed === true;
  });
  const conservationValid = [
    receipt.conservation?.floodplainNitrificationNitrogenResidualKgN,
    receipt.conservation?.floodplainNitrificationOxygenResidualKgO2,
    receipt.conservation
      ?.floodplainNitrificationOxygenStoichiometryResidualKgO2,
    receipt.conservation
      ?.floodplainNitrificationAlkalinityOwnerResidualKgCaCO3Eq,
    receipt.conservation
      ?.floodplainNitrificationAlkalinityStoichiometryResidualKgCaCO3Eq
  ].every(value => close(value, 1));
  const basinTruthValid =
    receipt.truth?.persistentFloodplainNitrification === true &&
    receipt.truth?.floodplainNitrificationOwnerReceiptsTyped === true &&
    receipt.truth?.floodplainNitrificationEvidenceBound === true &&
    receipt.truth?.exactFloodplainNitrificationTransferIds === true &&
    receipt.truth
      ?.floodplainNitrificationNitrogenOxygenAndAlkalinityLedgersClosed ===
      true &&
    receipt.truth?.floodplainNitrificationReactionModeled === true &&
    receipt.truth?.floodplainNitrificationAmmoniumToNitrate === true &&
    receipt.truth?.floodplainNitrificationDissolvedOxygenConsumed === true &&
    receipt.truth
      ?.floodplainNitrificationMinimumOxygenReserveHonored === true &&
    receipt.truth
      ?.floodplainNitrificationAlkalinityCapacityHonored === true &&
    receipt.truth
      ?.floodplainNitrificationSurfaceTemperatureProxyResponsive === false &&
    receipt.truth
      ?.floodplainNitrificationQ10TemperatureResponseParameterized === true &&
    receipt.truth
      ?.floodplainNitrificationPersistentWaterTemperatureState === true &&
    receipt.truth?.floodplainNitrificationNitriteIntermediateResolved ===
      false &&
    receipt.truth?.floodplainNitrificationAlkalinityDemandDiagnostic ===
      false &&
    receipt.truth
      ?.floodplainNitrificationAlkalinityMaterialOwnerDebited === true &&
    receipt.truth?.persistentEndToEndAlkalinityLedger === true &&
    receipt.truth?.floodplainNitrificationPHFeedbackModeled === false &&
    receipt.truth?.floodplainNitrificationIndependentCreation === false;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && ownerReceiptsValid && processReceiptsValid &&
    lineageValid && quantitiesPaired && transitionsValid &&
    conservationValid && basinTruthValid;
  return check('floodplain-nitrification-receipts',
    valid ? 'PASS' : 'FAIL', claim, {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedProcessSchema: FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA,
      expectedOwnerSchema:
        FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
      expectedReactionMassClosurePolicySchema:
        FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
      processReceiptCount: Array.isArray(processes)
        ? processes.length : null,
      ownerReceiptCount: Array.isArray(owners) ? owners.length : null,
      criteria: { receiptShapeValid, ownerReceiptsValid,
        ownerNumericFailures,
        processReceiptsValid, lineageValid, quantitiesPaired,
        transitionsValid, conservationValid, basinTruthValid },
      conservation: {
        nitrogenResidualKgN: receipt.conservation
          ?.floodplainNitrificationNitrogenResidualKgN ?? null,
        oxygenResidualKgO2: receipt.conservation
          ?.floodplainNitrificationOxygenResidualKgO2 ?? null,
        oxygenStoichiometryResidualKgO2: receipt.conservation
          ?.floodplainNitrificationOxygenStoichiometryResidualKgO2 ?? null,
        alkalinityOwnerResidualKgCaCO3Eq: receipt.conservation
          ?.floodplainNitrificationAlkalinityOwnerResidualKgCaCO3Eq ?? null,
        alkalinityStoichiometryResidualKgCaCO3Eq: receipt.conservation
          ?.floodplainNitrificationAlkalinityStoichiometryResidualKgCaCO3Eq ??
          null
      },
      receiptDigest: receipt.digest || null
    });
}

function floodplainGasExchangeCheck(receipt) {
  if (!receipt) {
    return check('floodplain-atmosphere-gas-exchange-receipts',
      'NOT_APPLICABLE',
      'Loaded floodplains exchange bounded carbon and oxygen only through paired floodplain and native-surface-atmosphere owner receipts.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-atmosphere-gas-exchange-receipts',
      'NOT_APPLICABLE',
      'Loaded floodplains exchange bounded carbon and oxygen only through paired floodplain and native-surface-atmosphere owner receipts.', {
        reason: 'legacy basin receipt predates bidirectional floodplain-atmosphere carbon-gradient evidence',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const processes = receipt.floodplainGasExchangeProcessReceipts;
  const floodplainOwners = receipt.floodplainGasExchangeReceipts;
  const atmosphereOwners =
    receipt.atmosphereFloodplainGasExchangeReceipts;
  const receiptShapeValid = Array.isArray(processes) &&
    Array.isArray(floodplainOwners) && Array.isArray(atmosphereOwners) &&
    floodplainOwners.length === atmosphereOwners.length;
  const floodplainByExchange = new Map((floodplainOwners || []).map(entry =>
    [entry.exchangeId, entry]));
  const atmosphereByExchange = new Map((atmosphereOwners || []).map(entry =>
    [entry.exchangeId, entry]));
  const floodplainOwnerNumericClosures = receiptShapeValid ?
    floodplainOwners.map(entry => ({ entry,
      numeric: floodplainReactionNumericClosure(entry,
        'gas-exchange') })) : [];
  const atmosphereOwnerNumericClosures = receiptShapeValid ?
    atmosphereOwners.map(entry => ({ entry,
      numeric: atmosphereFloodplainGasNumericClosure(entry) })) : [];
  const ownerReceiptsValid = receiptShapeValid &&
    floodplainOwnerNumericClosures.every(({ entry, numeric }) =>
      entry?.schema === FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA &&
      typeof entry.exchangeId === 'string' && entry.exchangeId.length > 0 &&
      typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
      typeof entry.atmosphereCellId === 'string' &&
      entry.atmosphereCellId.length > 0 &&
      numeric.valid &&
      entry.truth?.dissolvedInorganicCarbonSenderDebitedWhenEvasion ===
        true &&
      entry.truth?.dissolvedInorganicCarbonReceiverCreditedWhenInvasion ===
        true &&
      entry.truth?.dissolvedOxygenReceiverCredited === true &&
      entry.truth?.carbonDirectionExclusive === true &&
      entry.truth?.atmosphericReservoirMutatedHere === false) &&
    atmosphereOwnerNumericClosures.every(({ entry, numeric }) =>
      entry?.schema ===
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA &&
      typeof entry.exchangeId === 'string' && entry.exchangeId.length > 0 &&
      entry.atmosphereCarbonCredit?.nativeLayerIndex === 0 &&
      entry.atmosphereCarbonDebit?.nativeLayerIndex === 0 &&
      entry.atmosphereOxygenDebit?.nativeLayerIndex === 0 &&
      numeric.valid &&
      entry.truth?.authoritativeLocalGasReservoirMutated === true &&
      entry.truth?.surfaceLayerOnly === true &&
      entry.truth?.carbonReceiverCreditedWhenEvasion === true &&
      entry.truth?.carbonSenderDebitedWhenInvasion === true &&
      entry.truth?.oxygenSenderDebited === true &&
      entry.truth?.carbonDirectionExclusive === true &&
      entry.truth?.globallyMixed === false);
  const floodplainOwnerNumericFailures = floodplainOwnerNumericClosures
    .filter(({ numeric }) => !numeric.valid).slice(0, 8)
    .map(({ entry, numeric }) => ({
      exchangeId: entry?.exchangeId || null,
      reachId: entry?.reachId || null,
      identityKg: numeric.identities,
      declaredResidualKg: numeric.declaredResidualKg,
      declaredToleranceKg: numeric.declaredToleranceKg,
      expectedToleranceKg: numeric.expectedToleranceKg
    }));
  const atmosphereOwnerNumericFailures = atmosphereOwnerNumericClosures
    .filter(({ numeric }) => !numeric.valid).slice(0, 8)
    .map(({ entry, numeric }) => ({
      exchangeId: entry?.exchangeId || null,
      reachId: entry?.reachId || null,
      identityKg: numeric.identities,
      declaredResidualKg: numeric.declaredResidualKg,
      declaredToleranceKg: numeric.declaredToleranceKg,
      expectedToleranceKg: numeric.expectedToleranceKg
    }));
  const processReceiptsValid = receiptShapeValid && processes.every(entry =>
    entry?.schema ===
      FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA &&
    typeof entry.exchangeId === 'string' && entry.exchangeId.length > 0 &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    entry.truth?.persistentGasExchangeProcessMemory === true &&
    entry.truth?.floodplainChemistryOwnership === false &&
    entry.truth?.atmosphereGasOwnership === false &&
    entry.truth?.carbonDioxideEvasionParameterized === true &&
    entry.truth?.carbonDioxideInvasionParameterized === true &&
    entry.truth?.bidirectionalCarbonDioxideGradientExchange === true &&
    entry.truth?.oxygenReaerationParameterized === true &&
    entry.truth?.nativeAtmosphereSurfaceLayerRequired === true &&
    entry.truth?.surfaceTemperatureProxyResponsive === false &&
    entry.truth?.persistentFloodplainWaterTemperatureState === true &&
    entry.truth?.floodplainThermalReceiptBindingRequired === true &&
    typeof entry.activity?.floodplainThermalReceiptDigest === 'string' &&
    entry.truth?.bidirectionalHenryLawSolved === false &&
    entry.truth?.resolvedAirWaterTurbulence === false &&
    entry.truth?.globallyMixedAtmosphere === false &&
    entry.truth?.scientificCalibrationClaimed === false);
  const lineageValid = receiptShapeValid && processes.every(entry => {
    if (entry.atmosphereCellId == null) {
      return entry.floodplainReceiptDigest == null &&
        entry.atmosphereReceiptDigest == null &&
        same(entry.exchange?.carbonToAtmosphereKgC, 0) &&
        same(entry.exchange?.carbonToFloodplainKgC, 0) &&
        same(entry.exchange?.oxygenToFloodplainKgO2, 0);
    }
    const floodplainOwner = floodplainByExchange.get(entry.exchangeId);
    const atmosphereOwner = atmosphereByExchange.get(entry.exchangeId);
    return floodplainOwner?.digest === entry.floodplainReceiptDigest &&
      atmosphereOwner?.digest === entry.atmosphereReceiptDigest &&
      floodplainOwner?.reachId === entry.reachId &&
      atmosphereOwner?.reachId === entry.reachId &&
      floodplainOwner?.atmosphereCellId === entry.atmosphereCellId &&
      atmosphereOwner?.atmosphereCellId === entry.atmosphereCellId;
  });
  const quantitiesPaired = receiptShapeValid && processes.every(entry => {
    if (entry.atmosphereCellId == null) return true;
    const floodplainOwner = floodplainByExchange.get(entry.exchangeId);
    const atmosphereOwner = atmosphereByExchange.get(entry.exchangeId);
    return ['carbonToAtmosphereKgC', 'carbonToFloodplainKgC',
      'oxygenToFloodplainKgO2'].every(key =>
      same(entry.exchange?.[key], floodplainOwner?.exchange?.[key], 1e-7) &&
      same(entry.exchange?.[key], atmosphereOwner?.exchange?.[key], 1e-7));
  });
  const transitionsValid = receiptShapeValid && processes.every(entry => {
    const magnitude = Number(entry.exchange?.carbonToAtmosphereKgC || 0) +
      Number(entry.exchange?.carbonToFloodplainKgC || 0) +
      Number(entry.exchange?.oxygenToFloodplainKgO2 || 0);
    if (entry.status ===
      'initialized-after-v15-migration-no-invented-history') {
      return Math.abs(magnitude) < 1e-12 &&
        entry.truth?.migrationInventedHistory === false;
    }
    if (entry.status === 'atmosphere-unloaded-no-exchange') {
      return Math.abs(magnitude) < 1e-12 && entry.atmosphereCellId == null;
    }
    return ['bounded-co2-evasion-and-oxygen-reaeration',
      'bounded-co2-invasion-and-oxygen-reaeration',
      'exchange-maintained-no-gradient'].includes(entry.status) &&
      entry.truth?.pairedOwnerReceiptsPresent === true &&
      entry.truth?.exactExchangeIdentity === true &&
      entry.truth?.ownerLedgersClosed === true;
  });
  const conservationValid = [
    receipt.conservation
      ?.floodplainAtmosphereCarbonTransferResidualKgC,
    receipt.conservation
      ?.floodplainAtmosphereOxygenTransferResidualKgO2,
    receipt.conservation
      ?.atmosphereFloodplainCarbonReservoirResidualKgC,
    receipt.conservation
      ?.atmosphereFloodplainOxygenReservoirResidualKgO2
  ].every(value => close(value, 1));
  const basinTruthValid =
    receipt.truth?.persistentFloodplainAtmosphereGasExchange === true &&
    receipt.truth?.floodplainGasExchangeOwnerReceiptsTyped === true &&
    receipt.truth?.floodplainGasExchangeEvidenceBound === true &&
    receipt.truth?.exactFloodplainAtmosphereGasExchangeIds === true &&
    receipt.truth?.floodplainGasExchangeScaleAwareNumericClosure === true &&
    receipt.truth?.floodplainGasExchangePerIdentityNumericBounds === true &&
    receipt.truth?.floodplainGasExchangeMeasuredResidualsPreserved === true &&
    receipt.truth
      ?.atmosphereFloodplainGasExchangeScaleAwareNumericClosure === true &&
    receipt.truth
      ?.atmosphereFloodplainGasExchangePerIdentityNumericBounds === true &&
    receipt.truth
      ?.atmosphereFloodplainGasExchangeMeasuredResidualsPreserved === true &&
    receipt.truth?.floodplainAtmosphereGasExchangeLedgersClosed === true &&
    receipt.truth?.floodplainGasExchangeUsesNativeAtmosphereSurfaceLayer ===
      true &&
    receipt.truth?.floodplainGasExchangePhysicalWithLifeOff === true &&
    receipt.truth?.floodplainGasExchangeIndependentCreation === false &&
    receipt.truth
      ?.floodplainGasExchangeBidirectionalCarbonGradientParameterized ===
      true &&
    receipt.truth?.floodplainGasExchangeBidirectionalHenryLawSolved === false;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && ownerReceiptsValid && processReceiptsValid &&
    lineageValid && quantitiesPaired && transitionsValid &&
    conservationValid && basinTruthValid;
  return check('floodplain-atmosphere-gas-exchange-receipts',
    valid ? 'PASS' : 'FAIL',
    'Floodplain DIC and native surface-layer atmospheric CO2 carbon exchange in either gradient direction, while oxygen reaeration crosses the same owners only through an exact paired exchange ID with closed ledgers.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedProcessSchema:
        FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
      expectedFloodplainOwnerSchema:
        FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
      expectedReactionMassClosurePolicySchema:
        FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
      expectedAtmosphereOwnerSchema:
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
      expectedAtmosphereOwnerMassClosurePolicySchema:
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
      atmosphereOwnerMassClosureAbsoluteFloorsKg: {
        ...ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
      },
      atmosphereOwnerMassClosureUlpFactor:
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
      processReceiptCount: Array.isArray(processes)
        ? processes.length : null,
      pairedOwnerReceiptCount: Array.isArray(floodplainOwners)
        ? floodplainOwners.length : null,
      criteria: { receiptShapeValid, ownerReceiptsValid,
        floodplainOwnerNumericFailures, atmosphereOwnerNumericFailures,
        processReceiptsValid, lineageValid, quantitiesPaired,
        transitionsValid, conservationValid, basinTruthValid },
      conservation: {
        carbonTransferResidualKgC: receipt.conservation
          ?.floodplainAtmosphereCarbonTransferResidualKgC ?? null,
        oxygenTransferResidualKgO2: receipt.conservation
          ?.floodplainAtmosphereOxygenTransferResidualKgO2 ?? null,
        atmosphereCarbonResidualKgC: receipt.conservation
          ?.atmosphereFloodplainCarbonReservoirResidualKgC ?? null,
        atmosphereOxygenResidualKgO2: receipt.conservation
          ?.atmosphereFloodplainOxygenReservoirResidualKgO2 ?? null
      },
      receiptDigest: receipt.digest || null
    });
}

const FLOODPLAIN_EXCHANGE_IDENTITY_IDS = Object.freeze([
  'waterResidualKg',
  'carbonResidualKgC',
  'nitrogenResidualKgN',
  'nitrateNitrogenResidualKgN',
  'ammoniumNitrogenResidualKgN',
  'phosphorusResidualKgP',
  'oxygenResidualKgO2',
  'alkalinityResidualKgCaCO3Eq',
  'clayResidualKg',
  'siltResidualKg',
  'sandResidualKg',
  'gravelResidualKg'
]);

function auditFloodplainExchangeMassClosure(receipt) {
  const closure = receipt?.massClosure || {};
  const identities = closure.identities || {};
  const actualIds = Object.keys(identities).sort();
  const expectedIds = [...FLOODPLAIN_EXCHANGE_IDENTITY_IDS].sort();
  const identitySetValid = actualIds.length === expectedIds.length &&
    actualIds.every((identity, index) => identity === expectedIds[index]);
  const declaredFloors = closure.policy?.absoluteFloorsKg || {};
  const declaredFloorIds = Object.keys(declaredFloors).sort();
  const policyFloorsValid = declaredFloorIds.length === expectedIds.length &&
    declaredFloorIds.every((identity, index) =>
      identity === expectedIds[index] && same(declaredFloors[identity],
        FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG[identity], 0));
  const policyValid =
    closure.schema === FLOODPLAIN_EXCHANGE_MASS_CLOSURE_SCHEMA &&
    closure.policy?.schema ===
      FLOODPLAIN_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA &&
    policyFloorsValid &&
    closure.policy?.ulpFactor ===
      FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR &&
    closure.policy?.scaleBasis ===
      'sum-of-absolute-unrounded-signed-operands-kg';
  const identityAudits = Object.fromEntries(
    FLOODPLAIN_EXCHANGE_IDENTITY_IDS.map(identity => {
      const entry = identities[identity] || {};
      const signedOperandsKg = entry.signedOperandsKg;
      const expectedOperandCount = identity.endsWith('ResidualKg') &&
        ['clayResidualKg', 'siltResidualKg', 'sandResidualKg',
          'gravelResidualKg'].includes(identity) ? 8 : 4;
      const operandsValid = Array.isArray(signedOperandsKg) &&
        signedOperandsKg.length === expectedOperandCount &&
        signedOperandsKg.every(finite);
      const recomputedResidualKg = operandsValid
        ? signedOperandsKg.reduce((sum, operand) => sum + Number(operand), 0)
        : NaN;
      const absoluteOperandSumKg = operandsValid
        ? signedOperandsKg.reduce((sum, operand) =>
          sum + Math.abs(Number(operand)), 0) : NaN;
      const expectedToleranceKg = operandsValid ? roundAudit(Math.max(
        FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG[identity],
        absoluteOperandSumKg * Number.EPSILON *
          FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR), 12) : NaN;
      const expectedUtilization = operandsValid ? roundAudit(
        Math.abs(recomputedResidualKg) / expectedToleranceKg, 12) : NaN;
      const expectedClosed = operandsValid &&
        Math.abs(recomputedResidualKg) <= expectedToleranceKg;
      let compatibilityResidual = null;
      let compatibilityTolerance = 5.01e-10;
      if (identity === 'waterResidualKg') {
        compatibilityResidual = receipt?.water?.residualKg;
        compatibilityTolerance = 5.01e-4;
      } else if (['clayResidualKg', 'siltResidualKg', 'sandResidualKg',
        'gravelResidualKg'].includes(identity)) {
        compatibilityResidual = receipt?.sediment?.residualKg?.[
          identity.replace('ResidualKg', '')];
      } else {
        compatibilityResidual = receipt?.chemistry?.residuals?.[identity];
      }
      const residualMatches = operandsValid &&
        Number(entry.residualKg) === recomputedResidualKg;
      const toleranceMatches = operandsValid &&
        Number(entry.numericToleranceKg) === expectedToleranceKg;
      const utilizationMatches = operandsValid &&
        Number(entry.toleranceUtilization) === expectedUtilization;
      const compatibilityMatches = same(compatibilityResidual,
        recomputedResidualKg, compatibilityTolerance);
      const valid = operandsValid && residualMatches && toleranceMatches &&
        utilizationMatches && compatibilityMatches &&
        entry.closed === expectedClosed;
      return [identity, {
        valid,
        operandsValid,
        residualMatches,
        toleranceMatches,
        utilizationMatches,
        compatibilityMatches,
        recomputedResidualKg: finite(recomputedResidualKg)
          ? recomputedResidualKg : null,
        expectedToleranceKg: finite(expectedToleranceKg)
          ? expectedToleranceKg : null,
        expectedClosed
      }];
    }));
  const entries = Object.values(identityAudits);
  const expectedMaximumResidualKg = Math.max(0, ...entries.map(entry =>
    Math.abs(Number(entry.recomputedResidualKg || 0))));
  const expectedMaximumToleranceKg = Math.max(0, ...entries.map(entry =>
    Number(entry.expectedToleranceKg || 0)));
  const expectedMaximumToleranceUtilization = Math.max(0,
    ...FLOODPLAIN_EXCHANGE_IDENTITY_IDS.map(identity => {
      const residual = Math.abs(Number(
        identityAudits[identity].recomputedResidualKg || 0));
      const tolerance = Number(
        identityAudits[identity].expectedToleranceKg || 0);
      return tolerance > 0 ? roundAudit(residual / tolerance, 12) : Infinity;
    }));
  const aggregateValid = closure.identityCount === expectedIds.length &&
    Number(closure.maximumResidualKg) === expectedMaximumResidualKg &&
    Number(closure.maximumToleranceKg) === expectedMaximumToleranceKg &&
    Number(closure.maximumToleranceUtilization) ===
      expectedMaximumToleranceUtilization &&
    closure.conservationClosed === entries.every(entry =>
      entry.expectedClosed) &&
    closure.measuredResidualsPreserved === true;
  const identityFailures = Object.entries(identityAudits)
    .filter(([, entry]) => !entry.valid).map(([identity]) => identity);
  return {
    valid: policyValid && identitySetValid && aggregateValid &&
      identityFailures.length === 0,
    policyValid,
    identitySetValid,
    aggregateValid,
    identityFailures,
    identityAudits
  };
}

function floodplainCheck(receipt) {
  if (!receipt) {
    return check('floodplain-exchange-receipts', 'NOT_APPLICABLE',
      'Floodplain exchanges conserve water, chemistry and mineral grains when observed.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-exchange-receipts', 'NOT_APPLICABLE',
      'Floodplain exchanges conserve water, chemistry and mineral grains when observed.', {
        reason: 'legacy basin receipt predates the current habitat-bound routing step and is not relabelled',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const entries = receipt.floodplainReceipts;
  const receiptShapeValid = Array.isArray(entries);
  const massClosureAudits = receiptShapeValid
    ? entries.map(auditFloodplainExchangeMassClosure) : [];
  const massClosuresValid = receiptShapeValid &&
    massClosureAudits.every(entry => entry.valid);
  const entrySchemasValid = receiptShapeValid && entries.every(entry =>
    entry?.schema === FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' &&
    entry.truth?.resolvedInundationHydraulics === false &&
    entry.truth?.senderDebitsAndReceiverCreditsPaired === true &&
    entry.truth?.nitrateAndAmmoniumMaterialPools === true &&
    entry.truth?.exactNitrateAmmoniumWaterFractionTransport === true &&
    entry.truth?.nitrateAndAmmoniumSenderReceiverTransfersPaired === true &&
    entry.truth?.nitrateAndAmmoniumConservationClosed === true &&
    entry.truth?.scaleAwareNumericClosure === true &&
    entry.truth?.perIdentityNumericBounds === true &&
    entry.truth?.measuredResidualsPreserved === true &&
    entry.truth?.fixedAbsoluteToleranceOnly === false);
  const entryResidualsClosed = receiptShapeValid && entries.every(entry =>
    entry.massClosure?.conservationClosed === true &&
    entry.truth?.conservationClosed === true);
  const basinTruthValid =
    receipt.truth?.persistentFloodplainWaterChemistryAndSediment === true &&
    receipt.truth?.persistentRiverAndFloodplainNitrateAmmoniumPools ===
      true &&
    receipt.truth?.exactNitrateAmmoniumWaterFractionTransport === true &&
    receipt.truth?.geometryDerivedBankfullExchange === true &&
    receipt.truth?.finiteFloodplainReturnFlow === true &&
    receipt.truth?.grainSelectiveFloodplainDeposition === true &&
    receipt.truth?.floodplainExchangeScaleAwareNumericClosure === true &&
    receipt.truth?.floodplainExchangePerIdentityNumericBounds === true &&
    receipt.truth?.floodplainExchangeMeasuredResidualsPreserved === true &&
    receipt.truth?.floodplainExchangeFixedAbsoluteToleranceOnly === false &&
    receipt.truth?.resolvedFloodplainInundationHydraulics === false &&
    receipt.truth?.unresolvedReachFloodplainRetained === true;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && entrySchemasValid && entryResidualsClosed &&
    massClosuresValid && basinTruthValid;
  return check('floodplain-exchange-receipts', valid ? 'PASS' : 'FAIL',
    'Floodplain exchanges conserve water, chemistry and mineral grains while denying resolved inundation authority.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedExchangeSchema: FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
      expectedMassClosureSchema:
        FLOODPLAIN_EXCHANGE_MASS_CLOSURE_SCHEMA,
      expectedMassClosurePolicySchema:
        FLOODPLAIN_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA,
      massClosureAbsoluteFloorsKg: {
        ...FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
      },
      massClosureUlpFactor:
        FLOODPLAIN_EXCHANGE_MASS_CLOSURE_ULP_FACTOR,
      exchangeReceiptCount: Array.isArray(entries) ? entries.length : null,
      criteria: {
        receiptShapeValid,
        entrySchemasValid,
        entryResidualsClosed,
        massClosuresValid,
        basinTruthValid
      },
      massClosureFailures: massClosureAudits.map((entry, index) => ({
        index,
        identityFailures: entry.identityFailures,
        policyValid: entry.policyValid,
        aggregateValid: entry.aggregateValid
      })).filter(entry => entry.identityFailures.length > 0 ||
        !entry.policyValid || !entry.aggregateValid),
      receiptDigest: receipt.digest || null
    });
}

function auditFloodplainThermalReceipt(entry) {
  const closure = entry?.energyClosure || {};
  const digestValid = receiptDigestValid(entry);
  const policyValid = closure.schema ===
      FLOODPLAIN_THERMAL_ENERGY_CLOSURE_SCHEMA &&
    closure.policy?.schema ===
      FLOODPLAIN_THERMAL_ENERGY_CLOSURE_POLICY_SCHEMA &&
    Number(closure.policy?.absoluteFloorJ) ===
      FLOODPLAIN_THERMAL_ENERGY_ABSOLUTE_FLOOR_J &&
    closure.policy?.ulpFactor ===
      FLOODPLAIN_THERMAL_ENERGY_ULP_FACTOR &&
    closure.policy?.scaleBasis ===
      'sum-of-absolute-unrounded-signed-operands-joules';
  const temperatures = entry?.temperatures || {};
  const water = entry?.water || {};
  const energy = entry?.energy || {};
  const sharedTruthValid = entry?.schema ===
      FLOODPLAIN_THERMAL_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' &&
    entry.truth?.persistentFloodplainWaterTemperatureState === true &&
    entry.truth?.persistentFloodplainSensibleHeatOwner === true &&
    entry.truth?.netWaterOwnerChangeThermallyReconciled === true &&
    entry.truth?.channelWaterTemperatureResolved === false &&
    entry.truth?.externalThermalBoundaryOwnerDebited === false &&
    entry.truth?.resolvedFreezeThawState === false &&
    entry.truth?.latentHeatModeled === false &&
    entry.truth?.scientificCalibrationClaimed === false;
  if (closure.applicable === false) {
    const finalWaterKg = Number(water.finalTrackedKg);
    const finalTemperatureC = Number(
      temperatures.finalWaterTemperatureC);
    const expectedInitializationHeatJ = finalWaterKg *
      WATER_SPECIFIC_HEAT_J_KG_K * finalTemperatureC;
    const migrationValid =
      entry.status === 'initialized-after-migration-no-historical-heat' &&
      entry.truth?.migrationInventedHistoricalHeat === false &&
      entry.truth?.energyClosureApplicable === false &&
      closure.reason === 'pre-r66-floodplain-heat-history-unobserved' &&
      closure.sensibleHeat === null &&
      closure.identityCount === 0 &&
      closure.maximumResidualJ === null &&
      closure.maximumToleranceJ === null &&
      closure.maximumToleranceUtilization === null &&
      closure.conservationClosed === null &&
      closure.measuredResidualPreserved === false &&
      finite(finalWaterKg) && finalWaterKg >= 0 &&
      finite(finalTemperatureC) && finalTemperatureC >= -2 &&
      finalTemperatureC <= 45 &&
      Number(energy.finalSensibleHeatJ) ===
        expectedInitializationHeatJ &&
      Number(closure.initializationHeatJ) ===
        expectedInitializationHeatJ &&
      water.initialTrackedKg === null &&
      water.netOwnerChangeKg === null &&
      water.modeledInflowKg === null &&
      water.modeledOutflowKg === null &&
      temperatures.initialWaterTemperatureC === null &&
      energy.initialSensibleHeatJ === null &&
      energy.inflowHeatJ === null && energy.outflowHeatJ === null &&
      energy.externalBoundaryHeatJ === null;
    return {
      valid: policyValid && sharedTruthValid && digestValid &&
        migrationValid,
      applicable: false,
      policyValid,
      digestValid,
      sharedTruthValid,
      migrationValid,
      recomputedResidualJ: null,
      expectedToleranceJ: null,
      expectedUtilization: null,
      namedFailure: !digestValid ? 'receipt-digest' :
        migrationValid ? null : 'migration-shape'
    };
  }

  const initialWaterKg = Number(water.initialTrackedKg);
  const finalWaterKg = Number(water.finalTrackedKg);
  const netOwnerChangeKg = Number(water.netOwnerChangeKg);
  const modeledInflowKg = Number(water.modeledInflowKg);
  const modeledOutflowKg = Number(water.modeledOutflowKg);
  const initialTemperatureC = Number(
    temperatures.initialWaterTemperatureC);
  const incomingTemperatureC = Number(
    temperatures.incomingWaterTemperatureC);
  const surfaceBoundaryTemperatureC = Number(
    temperatures.surfaceBoundaryTemperatureC);
  const mixedTemperatureC = Number(
    temperatures.mixedWaterTemperatureC);
  const finalTemperatureC = Number(
    temperatures.finalWaterTemperatureC);
  const relaxationFraction = Number(
    entry.controls?.relaxationFraction);
  const numericInputsValid = [initialWaterKg, finalWaterKg,
    netOwnerChangeKg, modeledInflowKg, modeledOutflowKg,
    initialTemperatureC, incomingTemperatureC,
    surfaceBoundaryTemperatureC, mixedTemperatureC,
    finalTemperatureC, relaxationFraction].every(finite) &&
    initialWaterKg >= 0 && finalWaterKg >= 0 &&
    modeledInflowKg >= 0 && modeledOutflowKg >= 0 &&
    relaxationFraction >= 0 && relaxationFraction <= 1 &&
    entry.controls?.specificHeatJkgK === WATER_SPECIFIC_HEAT_J_KG_K &&
    [initialTemperatureC, incomingTemperatureC,
      surfaceBoundaryTemperatureC, mixedTemperatureC,
      finalTemperatureC].every(value => value >= -2 && value <= 45);
  const expectedNetOwnerChangeKg = finalWaterKg - initialWaterKg;
  const expectedInflowKg = Math.max(0, expectedNetOwnerChangeKg);
  const expectedOutflowKg = Math.max(0, -expectedNetOwnerChangeKg);
  const waterValid = numericInputsValid &&
    netOwnerChangeKg === expectedNetOwnerChangeKg &&
    modeledInflowKg === expectedInflowKg &&
    modeledOutflowKg === expectedOutflowKg &&
    Math.abs(initialWaterKg + modeledInflowKg - modeledOutflowKg -
      finalWaterKg) <= 1e-6 &&
    entry.truth?.waterOwnerChangeClosed === true;
  const expectedInitialHeatJ = initialWaterKg *
    WATER_SPECIFIC_HEAT_J_KG_K * initialTemperatureC;
  const expectedInflowHeatJ = modeledInflowKg *
    WATER_SPECIFIC_HEAT_J_KG_K * incomingTemperatureC;
  const expectedOutflowHeatJ = initialWaterKg > 1e-12
    ? expectedInitialHeatJ * modeledOutflowKg / initialWaterKg : 0;
  const expectedPreBoundaryHeatJ = expectedInitialHeatJ +
    expectedInflowHeatJ - expectedOutflowHeatJ;
  const expectedMixedTemperatureC = finalWaterKg > 1e-12
    ? Math.max(-2, Math.min(45, expectedPreBoundaryHeatJ /
      (finalWaterKg * WATER_SPECIFIC_HEAT_J_KG_K)))
    : surfaceBoundaryTemperatureC;
  const expectedBoundaryHeatJ = finalWaterKg *
    WATER_SPECIFIC_HEAT_J_KG_K *
    (surfaceBoundaryTemperatureC - expectedMixedTemperatureC) *
    relaxationFraction;
  const expectedFinalTemperatureC = finalWaterKg > 1e-12
    ? Math.max(-2, Math.min(45, (expectedPreBoundaryHeatJ +
      expectedBoundaryHeatJ) /
      (finalWaterKg * WATER_SPECIFIC_HEAT_J_KG_K)))
    : surfaceBoundaryTemperatureC;
  const expectedFinalHeatJ = finalWaterKg *
    WATER_SPECIFIC_HEAT_J_KG_K * expectedFinalTemperatureC;
  const energyTermToleranceJ = Math.max(
    FLOODPLAIN_THERMAL_ENERGY_ABSOLUTE_FLOOR_J,
    [expectedInitialHeatJ, expectedInflowHeatJ, expectedOutflowHeatJ,
      expectedBoundaryHeatJ, expectedFinalHeatJ].reduce((sum, value) =>
      sum + Math.abs(value), 0) * Number.EPSILON *
        FLOODPLAIN_THERMAL_ENERGY_ULP_FACTOR);
  const energyTermDiagnostics = {
    toleranceJ: energyTermToleranceJ,
    initialSensibleHeatJ: {
      actual: Number(energy.initialSensibleHeatJ),
      expected: expectedInitialHeatJ,
      difference: Number(energy.initialSensibleHeatJ) -
        expectedInitialHeatJ
    },
    inflowHeatJ: {
      actual: Number(energy.inflowHeatJ),
      expected: expectedInflowHeatJ,
      difference: Number(energy.inflowHeatJ) - expectedInflowHeatJ
    },
    outflowHeatJ: {
      actual: Number(energy.outflowHeatJ),
      expected: expectedOutflowHeatJ,
      difference: Number(energy.outflowHeatJ) - expectedOutflowHeatJ
    },
    externalBoundaryHeatJ: {
      actual: Number(energy.externalBoundaryHeatJ),
      expected: expectedBoundaryHeatJ,
      difference: Number(energy.externalBoundaryHeatJ) -
        expectedBoundaryHeatJ
    },
    finalSensibleHeatJ: {
      actual: Number(energy.finalSensibleHeatJ),
      expected: expectedFinalHeatJ,
      difference: Number(energy.finalSensibleHeatJ) - expectedFinalHeatJ
    },
    mixedTemperatureDifferenceC:
      mixedTemperatureC - expectedMixedTemperatureC,
    finalTemperatureDifferenceC:
      finalTemperatureC - expectedFinalTemperatureC
  };
  const energyTermsValid = waterValid &&
    same(energy.initialSensibleHeatJ, expectedInitialHeatJ,
      energyTermToleranceJ) &&
    same(energy.inflowHeatJ, expectedInflowHeatJ,
      energyTermToleranceJ) &&
    same(energy.outflowHeatJ, expectedOutflowHeatJ,
      energyTermToleranceJ) &&
    same(energy.externalBoundaryHeatJ, expectedBoundaryHeatJ,
      energyTermToleranceJ) &&
    same(energy.finalSensibleHeatJ, expectedFinalHeatJ,
      energyTermToleranceJ) &&
    same(mixedTemperatureC, expectedMixedTemperatureC, 1e-12) &&
    same(finalTemperatureC, expectedFinalTemperatureC, 1e-12);
  const expectedSignedOperandsJ = [
    expectedFinalHeatJ,
    -expectedInitialHeatJ,
    -expectedInflowHeatJ,
    expectedOutflowHeatJ,
    -expectedBoundaryHeatJ
  ];
  const signedOperandsJ = closure.sensibleHeat?.signedOperandsJ;
  const operandsValid = Array.isArray(signedOperandsJ) &&
    signedOperandsJ.length === expectedSignedOperandsJ.length &&
    signedOperandsJ.every((operand, index) =>
      same(operand, expectedSignedOperandsJ[index], energyTermToleranceJ));
  const recomputedResidualJ = operandsValid
    ? signedOperandsJ.reduce((sum, operand) => sum + Number(operand), 0)
    : NaN;
  const absoluteOperandSumJ = operandsValid
    ? signedOperandsJ.reduce((sum, operand) =>
      sum + Math.abs(Number(operand)), 0) : NaN;
  const expectedToleranceJ = operandsValid ? roundAudit(Math.max(
    FLOODPLAIN_THERMAL_ENERGY_ABSOLUTE_FLOOR_J,
    absoluteOperandSumJ * Number.EPSILON *
      FLOODPLAIN_THERMAL_ENERGY_ULP_FACTOR), 12) : NaN;
  const expectedUtilization = operandsValid ? roundAudit(
    Math.abs(recomputedResidualJ) / expectedToleranceJ, 12) : NaN;
  const expectedClosed = operandsValid &&
    Math.abs(recomputedResidualJ) <= expectedToleranceJ;
  const closureValid = operandsValid &&
    Number(closure.sensibleHeat?.residualJ) === recomputedResidualJ &&
    Number(closure.sensibleHeat?.numericToleranceJ) ===
      expectedToleranceJ &&
    Number(closure.sensibleHeat?.toleranceUtilization) ===
      expectedUtilization &&
    closure.sensibleHeat?.closed === expectedClosed &&
    closure.identityCount === 1 &&
    Number(closure.maximumResidualJ) === Math.abs(recomputedResidualJ) &&
    Number(closure.maximumToleranceJ) === expectedToleranceJ &&
    Number(closure.maximumToleranceUtilization) === expectedUtilization &&
    closure.conservationClosed === expectedClosed &&
    closure.measuredResidualPreserved === true &&
    entry.truth?.energyClosureApplicable === true &&
    entry.truth?.energyClosureClosed === expectedClosed &&
    entry.truth?.scaleAwareNumericEnergyClosure === true &&
    entry.truth?.measuredEnergyResidualPreserved === true &&
    entry.truth?.fixedAbsoluteEnergyToleranceOnly === false;
  const valid = policyValid && sharedTruthValid && digestValid &&
    numericInputsValid &&
    waterValid && energyTermsValid && closureValid;
  return {
    valid,
    applicable: true,
    policyValid,
    digestValid,
    sharedTruthValid,
    numericInputsValid,
    waterValid,
    energyTermsValid,
    energyTermDiagnostics,
    closureValid,
    recomputedResidualJ: finite(recomputedResidualJ)
      ? recomputedResidualJ : null,
    expectedToleranceJ: finite(expectedToleranceJ)
      ? expectedToleranceJ : null,
    expectedUtilization: finite(expectedUtilization)
      ? expectedUtilization : null,
    namedFailure: valid ? null : !digestValid ? 'receipt-digest'
      : !waterValid ? 'water-owner-change'
      : !energyTermsValid ? 'energy-terms' : !closureValid
        ? 'energy-closure' : 'receipt-shape'
  };
}

function floodplainThermalCheck(receipt) {
  const claim = 'Every loaded reach persists one shared floodplain water temperature and independently closes its net-advected plus explicit external-boundary sensible-heat ledger.';
  if (!receipt) {
    return check('floodplain-thermal-receipts', 'NOT_APPLICABLE', claim,
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-thermal-receipts', 'NOT_APPLICABLE', claim, {
      reason: 'legacy basin receipt predates persistent floodplain thermal ownership',
      expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualSchema: receipt.schema
    }, { required: false });
  }
  const entries = receipt.floodplainThermalReceipts;
  const receiptShapeValid = Array.isArray(entries) &&
    Array.isArray(receipt.floodplainReceipts) &&
    entries.length === receipt.floodplainReceipts.length;
  const audits = receiptShapeValid
    ? entries.map(auditFloodplainThermalReceipt) : [];
  const uniqueReachIds = receiptShapeValid
    ? new Set(entries.map(entry => entry.reachId)) : new Set();
  const uniqueReachBindingValid = receiptShapeValid &&
    uniqueReachIds.size === entries.length &&
    receipt.floodplainReceipts.every(entry =>
      uniqueReachIds.has(entry.reachId));
  const thermalByReach = new Map((entries || []).map(entry =>
    [entry.reachId, entry]));
  const consumers = [
    ...(receipt.floodplainDenitrificationProcessReceipts || []),
    ...(receipt.floodplainNitrificationProcessReceipts || []),
    ...(receipt.floodplainGasExchangeProcessReceipts || [])
  ];
  const reactionBindingValid = receiptShapeValid &&
    consumers.every(entry => {
      const thermal = thermalByReach.get(entry.reachId);
      return thermal &&
        entry.activity?.floodplainThermalReceiptDigest ===
          thermal.digest &&
        same(entry.activity?.waterTemperatureC,
          thermal.temperatures?.finalWaterTemperatureC, 1e-6);
    });
  const basinTruthValid =
    receipt.truth?.persistentFloodplainWaterTemperatureState === true &&
    receipt.truth?.persistentFloodplainSensibleHeatOwner === true &&
    receipt.truth?.floodplainThermalEnergyClosure === true &&
    receipt.truth?.floodplainThermalScaleAwareNumericClosure === true &&
    receipt.truth?.floodplainThermalMeasuredResidualsPreserved === true &&
    receipt.truth?.floodplainThermalFixedAbsoluteToleranceOnly === false &&
    receipt.truth?.floodplainThermalReactionTemperatureEvidenceBound ===
      true &&
    receipt.truth?.floodplainThermalChannelWaterTemperatureResolved ===
      false &&
    receipt.truth?.floodplainThermalExternalBoundaryOwnerDebited ===
      false &&
    receipt.truth?.resolvedFloodplainFreezeThawState === false &&
    receipt.truth?.unresolvedReachFloodplainThermalRetained === true;
  const auditFailures = audits.map((audit, index) => ({ index, ...audit }))
    .filter(audit => !audit.valid);
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && uniqueReachBindingValid && reactionBindingValid &&
    basinTruthValid && auditFailures.length === 0;
  return check('floodplain-thermal-receipts', valid ? 'PASS' : 'FAIL',
    claim, {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedReceiptSchema: FLOODPLAIN_THERMAL_RECEIPT_SCHEMA,
      expectedEnergyClosureSchema:
        FLOODPLAIN_THERMAL_ENERGY_CLOSURE_SCHEMA,
      expectedPolicySchema:
        FLOODPLAIN_THERMAL_ENERGY_CLOSURE_POLICY_SCHEMA,
      receiptCount: Array.isArray(entries) ? entries.length : null,
      applicableClosureCount: audits.filter(entry => entry.applicable)
        .length,
      migrationCheckpointCount: audits.filter(entry =>
        entry.applicable === false).length,
      maximumRecomputedResidualJ: Math.max(0, ...audits.map(entry =>
        Math.abs(Number(entry.recomputedResidualJ || 0)))),
      maximumExpectedToleranceJ: Math.max(0, ...audits.map(entry =>
        Number(entry.expectedToleranceJ || 0))),
      maximumExpectedToleranceUtilization: Math.max(0, ...audits.map(
        entry => Number(entry.expectedUtilization || 0))),
      criteria: {
        receiptShapeValid,
        uniqueReachBindingValid,
        reactionBindingValid,
        basinTruthValid
      },
      auditFailures: auditFailures.slice(0, 12).map(entry => ({
        index: entry.index,
        namedFailure: entry.namedFailure,
        policyValid: entry.policyValid,
        digestValid: entry.digestValid,
        waterValid: entry.waterValid ?? null,
        energyTermsValid: entry.energyTermsValid ?? null,
        energyTermDiagnostics: entry.energyTermDiagnostics ?? null,
        closureValid: entry.closureValid ?? null,
        migrationValid: entry.migrationValid ?? null
      })),
      receiptDigest: receipt.digest || null
    });
}

function floodplainHabitatCheck(receipt) {
  if (!receipt) {
    return check('floodplain-habitat-receipts', 'NOT_APPLICABLE',
      'Floodplain habitat memory is read-only, normalized and migration-honest when observed.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-habitat-receipts', 'NOT_APPLICABLE',
      'Floodplain habitat memory is read-only, normalized and migration-honest when observed.', {
        reason: 'legacy basin receipt predates persistent floodplain habitat memory',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const entries = receipt.floodplainHabitatReceipts;
  const receiptShapeValid = Array.isArray(entries);
  const entrySchemasValid = receiptShapeValid && entries.every(entry =>
    entry?.schema === FLOODPLAIN_HABITAT_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' &&
    entry.truth?.potentialHabitatOnly === true &&
    entry.truth?.ecologicalPopulationState === false &&
    entry.truth?.plantBiomassState === false &&
    entry.truth?.resolvedInundationHydraulics === false);
  const materialObserverValid = receiptShapeValid && entries.every(entry =>
    entry.truth?.readOnlyFloodplainMaterialObserver === true &&
    entry.truth?.floodplainMaterialMutated === false &&
    entry.material?.beforeDigest === entry.material?.afterDigest);
  const fractionsValid = receiptShapeValid && entries.every(entry => {
    const fractions = entry.habitat?.fractionsAfter;
    return fractions && FLOODPLAIN_HABITAT_TYPES.every(id =>
      finite(fractions[id]) && Number(fractions[id]) >= 0 &&
      Number(fractions[id]) <= 1) &&
      close(entry.habitat?.fractionSumResidual, 1e-9) &&
      entry.truth?.fractionsNormalized === true;
  });
  const habitatMemoryEntryValid = entry =>
    entry.status === 'initialized-after-migration-no-history'
      ? entry.truth?.migrationInventedHistory === false &&
        same(entry.memory?.observedDaysBefore, 0) &&
        same(entry.memory?.observedDaysAfter, 0) &&
        same(entry.memory?.floodPulseCountAfter, 0)
      : same(entry.memory?.observedDaysAfter,
        Number(entry.memory?.observedDaysBefore) +
          Number(entry.durationDays), 2e-8) &&
        Number(entry.memory?.floodPulseCountAfter) >=
          Number(entry.memory?.floodPulseCountBefore);
  const memoryValid = receiptShapeValid &&
    entries.every(habitatMemoryEntryValid);
  const memoryFailureExamples = receiptShapeValid ? entries
    .filter(entry => !habitatMemoryEntryValid(entry)).slice(0, 8)
    .map(entry => ({
      reachId: entry.reachId,
      status: entry.status,
      durationDays: entry.durationDays,
      memory: entry.memory,
      truth: {
        migrationInventedHistory:
          entry.truth?.migrationInventedHistory ?? null
      }
    })) : [];
  const basinTruthValid =
    receipt.truth?.persistentFloodplainHabitatMemory === true &&
    receipt.truth?.floodplainHabitatPotentialOnly === true &&
    receipt.truth?.floodplainHabitatMaterialObserverReadOnly === true &&
    receipt.truth?.floodplainHabitatFractionsNormalized === true;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && entrySchemasValid && materialObserverValid &&
    fractionsValid && memoryValid && basinTruthValid;
  return check('floodplain-habitat-receipts', valid ? 'PASS' : 'FAIL',
    'Floodplain habitat receipts preserve read-only material ownership, normalized potential habitat and honest flood-pulse memory.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedHabitatSchema: FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
      habitatReceiptCount: Array.isArray(entries) ? entries.length : null,
      criteria: {
        receiptShapeValid,
        entrySchemasValid,
        materialObserverValid,
        fractionsValid,
        memoryValid,
        memoryFailureExamples,
        basinTruthValid
      },
      receiptDigest: receipt.digest || null
    });
}

function floodEventHistoryCheck(receipt) {
  if (!receipt) {
    return check('flood-event-history-receipts', 'NOT_APPLICABLE',
      'Flood-event history is exchange-bound, lifecycle-valid, bounded and read-only when observed.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('flood-event-history-receipts', 'NOT_APPLICABLE',
      'Flood-event history is exchange-bound, lifecycle-valid, bounded and read-only when observed.', {
        reason: 'legacy basin receipt predates bounded flood-event history',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const entries = receipt.floodEventReceipts;
  const receiptShapeValid = Array.isArray(entries);
  const entrySchemasValid = receiptShapeValid && entries.every(entry =>
    entry?.schema === FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    typeof entry.floodplainExchangeDigest === 'string' &&
    entry.truth?.persistentBoundedFloodEventChronicle === true &&
    entry.truth?.resolvedInundationHydraulics === false &&
    entry.truth?.scientificFloodFrequencyModel === false);
  const materialObserverValid = receiptShapeValid && entries.every(entry =>
    entry.truth?.readOnlyFloodplainMaterialObserver === true &&
    entry.truth?.floodplainMaterialMutated === false &&
    entry.observation?.materialBeforeDigest ===
      entry.observation?.materialAfterDigest);
  const archiveValid = receiptShapeValid && entries.every(entry =>
    entry.history?.archiveLimit === FLOOD_EVENT_ARCHIVE_LIMIT &&
    Number(entry.history?.archiveCountAfter) >= 0 &&
    Number(entry.history?.archiveCountAfter) <=
      FLOOD_EVENT_ARCHIVE_LIMIT &&
    entry.truth?.archiveBounded === true &&
    entry.truth?.historicalEventsInvented === false);
  const floodEventLifecycleEntryValid = entry => {
    if (entry.status === 'initialized-after-migration-no-history') {
      return same(entry.history?.observedDaysBefore, 0) &&
        same(entry.history?.observedDaysAfter, 0) &&
        same(entry.history?.completedEventCountAfter, 0) &&
        entry.event?.before == null && entry.event?.after == null &&
        entry.event?.completed == null;
    }
    const observationAdvanced = same(entry.history?.observedDaysAfter,
      Number(entry.history?.observedDaysBefore) +
        Number(entry.durationDays), 2e-8);
    if (!observationAdvanced) return false;
    if (entry.status === 'flood-event-started') {
      return entry.event?.before == null &&
        typeof entry.event?.after?.eventId === 'string' &&
        same(entry.event.after.durationDays, entry.durationDays, 1e-8);
    }
    if (entry.status === 'flood-event-continued') {
      return entry.event?.before?.eventId === entry.event?.after?.eventId &&
        same(entry.event.after.durationDays,
          Number(entry.event.before.durationDays) +
            Number(entry.durationDays), 1e-8);
    }
    if (entry.status === 'flood-event-completed') {
      return entry.event?.before?.eventId ===
          entry.event?.completed?.eventId &&
        entry.event?.after == null &&
        Number(entry.history?.completedEventCountAfter) ===
          Number(entry.history?.completedEventCountBefore) + 1;
    }
    return [
      'dry-between-events',
      'migration-wet-boundary-awaiting-dry',
      'migration-dry-boundary-established'
    ].includes(entry.status) && entry.truth?.lifecycleTransitionValid === true;
  };
  const lifecycleValid = receiptShapeValid &&
    entries.every(floodEventLifecycleEntryValid);
  const lifecycleFailureExamples = receiptShapeValid ? entries
    .filter(entry => !floodEventLifecycleEntryValid(entry)).slice(0, 8)
    .map(entry => ({
      reachId: entry.reachId,
      status: entry.status,
      durationDays: entry.durationDays,
      history: entry.history,
      event: entry.event,
      truth: {
        lifecycleTransitionValid:
          entry.truth?.lifecycleTransitionValid ?? null
      }
    })) : [];
  const basinTruthValid =
    receipt.truth?.persistentBoundedFloodEventHistory === true &&
    receipt.truth?.floodEventHistoryMaterialObserverReadOnly === true &&
    receipt.truth?.floodEventHistoryExchangeEvidenceBound === true &&
    receipt.truth?.floodEventHistoryArchiveBounded === true;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && entrySchemasValid && materialObserverValid &&
    archiveValid && lifecycleValid && basinTruthValid;
  return check('flood-event-history-receipts', valid ? 'PASS' : 'FAIL',
    'Flood-event receipts bind exact exchange evidence to a bounded start/continue/end chronicle without mutating matter.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedEventReceiptSchema:
        FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA,
      eventReceiptCount: Array.isArray(entries) ? entries.length : null,
      criteria: {
        receiptShapeValid,
        entrySchemasValid,
        materialObserverValid,
        archiveValid,
        lifecycleValid,
        lifecycleFailureExamples,
        basinTruthValid
      },
      receiptDigest: receipt.digest || null
    });
}

function floodplainSuccessionCheck(receipt) {
  if (!receipt) {
    return check('floodplain-succession-receipts', 'NOT_APPLICABLE',
      'Floodplain succession is lineage-bound, finite, competition-bounded and migration-honest when observed.',
      { reason: 'no basin receipt supplied' }, { required: false });
  }
  if (receipt.schema === PREVIOUS_BASIN_ROUTING_STEP_SCHEMA) {
    return check('floodplain-succession-receipts', 'NOT_APPLICABLE',
      'Floodplain succession is lineage-bound, finite, competition-bounded and migration-honest when observed.', {
        reason: 'legacy basin receipt predates persistent floodplain succession',
        expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
        actualSchema: receipt.schema
      }, { required: false });
  }
  const entries = receipt.floodplainSuccessionReceipts;
  const habitats = new Map((receipt.floodplainHabitatReceipts || [])
    .map(entry => [entry.reachId, entry.digest]));
  const events = new Map((receipt.floodEventReceipts || [])
    .map(entry => [entry.reachId, entry.digest]));
  const receiptShapeValid = Array.isArray(entries);
  const entrySchemasValid = receiptShapeValid && entries.every(entry =>
    entry?.schema === FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    entry.truth?.persistentFunctionalGuildSuccession === true &&
    entry.truth?.ecologicalCommunityState === true &&
    entry.truth?.materialAuthority === false &&
    entry.truth?.plantBiomassMaterialOwnership === false &&
    entry.truth?.speciesOccupancyState === false &&
    entry.truth?.resolvedPlantIndividuals === false &&
    entry.truth?.scientificSuccessionModel === false);
  const lineageValid = receiptShapeValid && entries.every(entry =>
    typeof entry.floodplainHabitatReceiptDigest === 'string' &&
    typeof entry.floodEventTransitionReceiptDigest === 'string' &&
    habitats.get(entry.reachId) ===
      entry.floodplainHabitatReceiptDigest &&
    events.get(entry.reachId) ===
      entry.floodEventTransitionReceiptDigest &&
    entry.truth?.habitatReceiptEvidenceBound === true &&
    entry.truth?.floodEventReceiptEvidenceBound === true);
  const ledgersValid = receiptShapeValid && entries.every(entry =>
    Array.isArray(entry.guildFlows) &&
    entry.guildFlows.length === FLOODPLAIN_SUCCESSION_GUILDS.length &&
    new Set(entry.guildFlows.map(flow => flow.guildId)).size ===
      FLOODPLAIN_SUCCESSION_GUILDS.length &&
    entry.guildFlows.every(flow =>
      FLOODPLAIN_SUCCESSION_GUILDS.includes(flow.guildId) &&
      close(flow.seed?.residualSeedsM2, 1e-8) &&
      close(flow.cover?.juvenileResidual, 1e-10) &&
      close(flow.cover?.matureResidual, 1e-10) &&
      Object.values(flow.seed || {}).every(finite) &&
      Object.values(flow.cover || {}).every(finite)) &&
    close(entry.closure?.maximumSeedResidualSeedsM2, 1e-8) &&
    close(entry.closure?.maximumCoverResidual, 1e-10) &&
    entry.truth?.ledgersClosed === true);
  const capacityValid = receiptShapeValid && entries.every(entry =>
    finite(entry.community?.after?.totalCoverFraction) &&
    Number(entry.community.after.totalCoverFraction) >= 0 &&
    Number(entry.community.after.totalCoverFraction) <=
      FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER + 1e-10 &&
    entry.controls?.maximumTotalCoverFraction ===
      FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER &&
    entry.controls?.externalSeedRainBoundary === true &&
    entry.truth?.competitionCapacityHonored === true);
  const transitionValid = receiptShapeValid && entries.every(entry => {
    if (entry.status === 'initialized-after-migration-no-history') {
      return entry.truth?.migrationInventedLivingHistory === false &&
        same(entry.community?.before?.totalCoverFraction, 0) &&
        same(entry.community?.after?.totalCoverFraction, 0) &&
        same(entry.community?.after?.totalSeedBankSeedsM2, 0);
    }
    if (entry.status === 'life-disabled-dormant') {
      return entry.truth?.demographicStateFrozen === true &&
        same(entry.community?.before?.totalCoverFraction,
          entry.community?.after?.totalCoverFraction) &&
        same(entry.community?.before?.totalSeedBankSeedsM2,
          entry.community?.after?.totalSeedBankSeedsM2);
    }
    return ['community-establishing', 'community-succession',
      'flood-disturbance-observed', 'post-flood-recovery']
      .includes(entry.status) &&
      entry.truth?.demographicStateFrozen === false;
  });
  const basinTruthValid =
    receipt.truth?.persistentFloodplainSuccession === true &&
    receipt.truth?.floodplainSuccessionEvidenceBound === true &&
    receipt.truth?.floodplainSuccessionLedgersClosed === true &&
    receipt.truth?.floodplainSuccessionCompetitionBounded === true &&
    receipt.truth?.floodplainSuccessionMaterialAuthority === false;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && entrySchemasValid && lineageValid &&
    ledgersValid && capacityValid && transitionValid && basinTruthValid;
  return check('floodplain-succession-receipts', valid ? 'PASS' : 'FAIL',
    'Floodplain succession receipts bind exact habitat and flood-event evidence to finite seed and cover ledgers without claiming material or species authority.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedSuccessionSchema: FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA,
      successionReceiptCount: Array.isArray(entries) ? entries.length : null,
      criteria: {
        receiptShapeValid,
        entrySchemasValid,
        lineageValid,
        ledgersValid,
        capacityValid,
        transitionValid,
        basinTruthValid
      },
      receiptDigest: receipt.digest || null
    });
}

export function auditFoundationSystem(options = {}) {
  const column = options.column;
  const gas = column?.atmosphere?.biogeochemistry;
  const gasReceipt = column?.budget?.atmosphereBiogeochemistry;
  const gasVerticalReceipt = column?.budget
    ?.atmosphereBiogeochemistryVertical;
  const columnSchemaValid = column?.schema === EARTH_SYSTEM_COLUMN_SCHEMA;
  const gasLayers = Array.isArray(gas?.layers) ? gas.layers : [];
  const gasLayerTotals = {
    carbon: gasLayers.reduce((sum, layer) => sum +
      Number(layer?.carbonDioxideCarbonKgCm2 || 0), 0),
    oxygen: gasLayers.reduce((sum, layer) => sum +
      Number(layer?.oxygenKgO2m2 || 0), 0),
    nitrogen: gasLayers.reduce((sum, layer) => sum +
      Number(layer?.nitrogenGasKgNm2 || 0), 0)
  };
  const gasStateValid = gas?.schema === ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA &&
    gas?.truth?.authoritativeLocalGasReservoir === true &&
    gas?.truth?.nativePressureLayerComposition === true &&
    gas?.truth?.verticalTransportEnabled === true &&
    gas?.truth?.horizontalTransportEnabled === true &&
    typeof gas?.truth?.horizontallyTransported === 'boolean' &&
    typeof gas?.truth?.verticallyTransported === 'boolean' &&
    gasLayers.length === ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT &&
    gasLayers.every((layer, index) =>
      layer?.schema === ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA &&
      layer.index === index &&
      finite(layer.carbonDioxideCarbonKgCm2) &&
      finite(layer.oxygenKgO2m2) && finite(layer.nitrogenGasKgNm2) &&
      layer.carbonDioxideCarbonKgCm2 >= 0 && layer.oxygenKgO2m2 >= 0 &&
      layer.nitrogenGasKgNm2 >= 0) &&
    same(gasLayerTotals.carbon, gas?.carbonDioxideCarbonKgCm2) &&
    same(gasLayerTotals.oxygen, gas?.oxygenKgO2m2) &&
    same(gasLayerTotals.nitrogen, gas?.nitrogenGasKgNm2) &&
    gas?.truth?.globallyMixed === false;
  const checks = [
    check('earth-system-column-lineage', columnSchemaValid ? 'PASS' : 'FAIL',
      'The audited state is a current Foundation Planet Earth-system column.', {
        expectedSchema: EARTH_SYSTEM_COLUMN_SCHEMA,
        actualSchema: column?.schema || null,
        id: column?.id || null,
        kind: column?.kind || null
      }),
    pressureColumnCheck(column),
    nativePhaseThermalEnvelopeCheck(column),
    localBudgetCheck(column),
    atmosphereBoundaryEnergyCheck(column),
    co2RadiationCheck(column),
    check('local-atmosphere-gas-owner', gasStateValid ? 'PASS' : 'FAIL',
      'Atmosphere owns eight native C/O2/N2 levels and distinguishes loaded transport from global mixing.', {
        expectedSchema: ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
        actualSchema: gas?.schema || null,
        layerCount: gasLayers.length,
        verticalTransport: gas?.truth?.verticallyTransported ?? null,
        horizontalTransport: gas?.truth?.horizontallyTransported ?? null,
        globalMixing: gas?.truth?.globallyMixed ?? null
      }),
    residualCheck('atmosphere-vertical-gas-ledger', gasVerticalReceipt,
      ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA, 1e-9,
      'The seven native adjacent interfaces conserve layer-resolved C/O2/N.'),
    residualCheck('atmosphere-biosphere-gas-ledger', gasReceipt,
      ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA, 1e-9,
      'The committed local atmosphere-biosphere gas receipt closes C/O2/N.'),
    ecologyMirrorCheck(column),
    soilRunoffBiogeochemistryCheck(column),
    geomorphicSedimentCheck(column),
    deepOceanCheck(column),
    deepOceanAlkalinityCheck(column),
    mixedLayerCarbonateCheck(column),
    airSeaCarbonExchangeCheck(column),
    transportCheck(options.earthTransportReceipt),
    basinCheck(options.basinRoutingReceipt),
    alkalinityLedgerCheck(options.basinRoutingReceipt),
    floodplainCheck(options.basinRoutingReceipt),
    floodplainThermalCheck(options.basinRoutingReceipt),
    floodplainHabitatCheck(options.basinRoutingReceipt),
    floodEventHistoryCheck(options.basinRoutingReceipt),
    floodplainSuccessionCheck(options.basinRoutingReceipt),
    floodplainPlantMatterCheck(options.basinRoutingReceipt),
    floodplainPlantResourcesCheck(options.basinRoutingReceipt),
    floodplainDecompositionCheck(options.basinRoutingReceipt),
    floodplainRespirationCheck(options.basinRoutingReceipt),
    floodplainDenitrificationCheck(options.basinRoutingReceipt),
    floodplainNitrificationCheck(options.basinRoutingReceipt),
    floodplainGasExchangeCheck(options.basinRoutingReceipt)
  ];
  const counts = {
    pass: checks.filter(item => item.status === 'PASS').length,
    fail: checks.filter(item => item.status === 'FAIL').length,
    notApplicable: checks.filter(item => item.status === 'NOT_APPLICABLE').length
  };
  const requiredFailures = checks.filter(item =>
    item.required && item.status === 'FAIL').length;
  const verdict = requiredFailures > 0 ? 'FAIL' :
    counts.notApplicable > 0 ? 'PASS_WITH_UNOBSERVED_OPTIONAL_SEAMS' : 'PASS';
  return {
    schema: FOUNDATION_SYSTEM_AUDIT_SCHEMA,
    verdict,
    columnId: column?.id || null,
    profileId: column?.profileId || null,
    day: finite(column?.lastDay) ? Number(column.lastDay) : null,
    stepCount: finite(column?.stepCount) ? Number(column.stepCount) : null,
    counts,
    checks,
    declaredGaps: {
      scientificEarthModel: false,
      globalCirculation: false,
      loadedAtmosphericBiogeochemistryTransport: true,
      nativePressureLayerAtmosphericBiogeochemistry: true,
      nativeAdjacentInterfaceAtmosphericGasMixing: true,
      nativeLayerCo2RadiativeCoupling: true,
      nativePhaseThermalEnvelopeBounded: true,
      nativeBoundaryForcingEnvelopeReconciliationReceipted: true,
      postMaterialTemperatureClipping: false,
      resolvedCloudMicrophysics: false,
      upperAtmosphereRadiativeChemistry: false,
      scientificallyCalibratedConvection: false,
      broadbandGreyGasCo2Parameterization: true,
      spectralAtmosphericRadiativeTransfer: false,
      globallyMixedAtmosphericGases: false,
      resolvedAtmosphericChemistry: false,
      threeDimensionalOceanCirculation: false,
      persistentSoilWaterBiogeochemistry: true,
      persistentRunoffBiogeochemistryQueue: true,
      finiteSurfaceSediment: true,
      persistentRunoffSedimentQueue: true,
      persistentRiverAndCoastalSediment: true,
      persistentFloodplainWaterChemistryAndSediment: true,
      persistentFloodplainWaterTemperatureState: true,
      persistentFloodplainSensibleHeatOwner: true,
      floodplainThermalEnergyClosure: true,
      floodplainThermalScaleAwareNumericClosure: true,
      floodplainThermalMeasuredResidualsPreserved: true,
      floodplainThermalFixedAbsoluteToleranceOnly: false,
      floodplainReactionTemperatureSourceShared: true,
      floodplainChannelWaterTemperatureResolved: false,
      floodplainExternalThermalBoundaryOwnerDebited: false,
      persistentFloodplainHabitatMemory: true,
      floodplainHabitatPotentialOnly: true,
      floodplainHabitatMaterialObserverReadOnly: true,
      persistentBoundedFloodEventHistory: true,
      floodEventHistoryMaterialObserverReadOnly: true,
      persistentFloodplainSuccession: true,
      floodplainSuccessionFunctionalGuildDemography: true,
      floodplainSuccessionMaterialAuthority: false,
      floodplainSuccessionPlantBiomassMaterialOwnership: false,
      persistentFloodplainPlantCarbonAndNitrogen: true,
      pairedLandEcologySubgridBiomassPartition: true,
      floodplainPlantStandingDeadAndLitterPools: true,
      floodplainPlantPhosphorusOwnership: true,
      floodplainPlantWaterOwnership: true,
      persistentFloodplainPlantPhosphorusAndTissueWater: true,
      pairedFloodplainPlantResourceUptakeAndWaterReturn: true,
      floodplainPlantStandingDeadAndLitterPhosphorus: true,
      floodplainPlantGrowthJointlyCarbonNitrogenPhosphorusWaterLimited: true,
      persistentFloodplainDetritalDecomposition: true,
      pairedPlantDetritusFloodplainChemistryReturn: true,
      onlyResourceBackedFloodplainDetritusDecomposes: true,
      floodplainPlantDecompositionAndRespirationCoupling: true,
      floodplainDecompositionRespirationCoupledViaOwnedDocPool: true,
      floodplainDecompositionAtmosphericRespiration: false,
      floodplainDecompositionOxygenConsumption: false,
      floodplainDecompositionSoilReceiver: false,
      persistentFloodplainAerobicRespiration: true,
      floodplainRespirationLocalDocToDicCarbonClosure: true,
      floodplainRespirationDissolvedOxygenConsumptionClosure: true,
      floodplainRespirationOxygenLimited: true,
      floodplainRespirationLifeOffFreeze: true,
      floodplainRespirationAtmosphericGasExchange: false,
      floodplainRespirationAnaerobicPathway: false,
      floodplainRespirationMicrobialPopulationState: false,
      scientificFloodplainRespirationModel: false,
      persistentFloodplainDenitrification: true,
      pairedFloodplainAtmosphereDenitrificationOwnerReceipts: true,
      floodplainDenitrificationOxygenGated: true,
      floodplainDenitrificationNitrogenLimited: true,
      floodplainDenitrificationSurfaceTemperatureProxyResponsive: false,
      floodplainDenitrificationQ10TemperatureResponseParameterized: true,
      resolvedFloodplainFreezeThawState: false,
      floodplainDenitrificationArrheniusKineticsResolved: false,
      floodplainDenitrificationReactiveNitrateEquivalentParameterized: false,
      floodplainDenitrificationNitrateSpeciationResolved: true,
      persistentRiverAndFloodplainNitrateAmmoniumPools: true,
      exactNitrateAmmoniumWaterFractionTransport: true,
      parameterizedRunoffDinSpeciation: true,
      measuredRunoffDinSpeciation: false,
      floodplainDenitrificationNitrateOnly: true,
      floodplainDenitrificationAmmoniumConsumption: false,
      nitritePoolResolved: false,
      persistentFloodplainNitrification: true,
      floodplainNitrificationReactionModeled: true,
      floodplainNitrificationAmmoniumToNitrate: true,
      floodplainNitrificationDissolvedOxygenConsumed: true,
      floodplainNitrificationSurfaceTemperatureProxyResponsive: false,
      floodplainNitrificationQ10TemperatureResponseParameterized: true,
      floodplainNitrificationNitriteIntermediateResolved: false,
      floodplainNitrificationAlkalinityDemandDiagnostic: false,
      floodplainNitrificationAlkalinityMaterialOwnerDebited: true,
      persistentEndToEndAlkalinityLedger: true,
      alkalinityIsAcidNeutralizingCapacityEquivalent: true,
      alkalinityMeasured: false,
      alkalinityCarbonateSpeciationResolved: false,
      alkalinityPHResolved: false,
      mixedLayerCarbonateDiagnostic: true,
      mixedLayerCarbonateSpeciationResolvedWithinEnvelope: true,
      mixedLayerPHTotalResolvedWithinEnvelope: true,
      mixedLayerCarbonateDiagnosticMutatesMaterial: false,
      mixedLayerCarbonateSurfacePressureOnly: true,
      mixedLayerCarbonateSilicateAlkalinityIncluded: false,
      mixedLayerCarbonatePressureCorrectionsIncluded: false,
      carbonateInformedAirSeaCo2Exchange: true,
      airSeaCo2FugacityCorrection: true,
      scientificAirSeaGasTransferVelocity: false,
      measuredAirSeaPco2: false,
      measuredOceanSkinTemperature: false,
      speciesResolvedMarinePHResponse: false,
      deepOceanPHResolved: false,
      carbonatePHFeedbackModeled: false,
      deepOceanAlkalinityExchange: true,
      floodplainNitrificationPHFeedbackModeled: false,
      floodplainNitrificationMicrobialPopulationState: false,
      scientificFloodplainNitrificationModel: false,
      floodplainDenitrificationMicrobialPopulationState: false,
      mechanisticFloodplainRedoxModel: false,
      scientificFloodplainDenitrificationModel: false,
      persistentFloodplainAtmosphereGasExchange: true,
      pairedFloodplainAtmosphereGasOwnerReceipts: true,
      floodplainCarbonDioxideEvasion: true,
      floodplainCarbonDioxideInvasion: true,
      bidirectionalFloodplainCarbonGradientParameterized: true,
      floodplainOxygenReaeration: true,
      nativeAtmosphereSurfaceLayerFloodplainExchange: true,
      physicalFloodplainGasExchangeWithLifeOff: true,
      bidirectionalFloodplainHenryLawExchange: false,
      resolvedFloodplainAirWaterTurbulence: false,
      scientificFloodplainGasExchangeModel: false,
      floodplainPlantTranspirationAndAtmosphereCoupling: false,
      floodplainSuccessionSpeciesOccupancyState: false,
      resolvedFloodplainPlantIndividuals: false,
      scientificFloodplainSuccessionModel: false,
      resolvedFloodplainInundationHydraulics: false,
      resolvedChannelMorphodynamics: false,
      parameterizedLandRunoffChemistryBoundary: false,
      globalBasinNetwork: false
    }
  };
}

export function foundationSystemAuditDescription() {
  return {
    schema: FOUNDATION_SYSTEM_AUDIT_SCHEMA,
    purpose: 'read-only runtime integrity and handoff evidence',
    checks: [
      'schema-lineage', 'pressure-column-shape',
      'native-phase-thermal-envelope', 'local-water-and-energy-ledgers',
      'atmosphere-boundary-forcing-energy-ledger',
      'atmosphere-co2-radiative-coupling',
      'local-atmosphere-gas-ownership', 'atmosphere-vertical-gas-ledger',
      'atmosphere-biosphere-gas-ledger',
      'ecology-gas-mirrors', 'soil-runoff-biogeochemistry-lineage',
      'geomorphic-sediment-lineage',
      'deep-ocean-lineage', 'mixed-deep-ocean-alkalinity-ledger',
      'mixed-layer-carbonate-diagnostic',
      'carbonate-informed-air-sea-carbon-exchange',
      'loaded-transport-receipt',
      'basin-routing-receipt', 'end-to-end-alkalinity-ledger',
      'floodplain-exchange-receipts',
      'floodplain-thermal-receipts',
      'floodplain-habitat-receipts', 'flood-event-history-receipts',
      'floodplain-succession-receipts',
      'floodplain-plant-matter-receipts',
      'floodplain-plant-resources-receipts',
      'floodplain-decomposition-receipts',
      'floodplain-respiration-receipts',
      'floodplain-denitrification-receipts',
      'floodplain-nitrification-receipts',
      'floodplain-atmosphere-gas-exchange-receipts'
    ],
    mutatesWorld: false,
    provesScientificAuthority: false
  };
}
