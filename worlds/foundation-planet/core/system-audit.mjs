import {
  EARTH_SYSTEM_COLUMN_SCHEMA
} from './earth-system.mjs';
import {
  ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA,
  ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_COUNT,
  ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA,
  ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA,
  ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA,
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_ABSOLUTE_TOLERANCE_KG,
  ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA
} from './atmosphere-biogeochemistry.mjs';
import {
  ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
  ATMOSPHERE_PRESSURE_COLUMN_LAYER_COUNT,
  ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA
} from './pressure-column.mjs';
import {
  EARTH_LAND_ECOLOGY_SCHEMA,
  LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA
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
  COASTAL_SEDIMENT_STATE_SCHEMA,
  COASTAL_SEDIMENT_INPUT_SCHEMA
} from './geomorphic-sediment.mjs';
import { EARTH_OCEAN_ECOLOGY_SCHEMA } from './ocean-ecology.mjs';
import { DEEP_OCEAN_STATE_SCHEMA } from './deep-ocean.mjs';
import {
  EARTH_TRANSPORT_STEP_SCHEMA,
  PREVIOUS_EARTH_TRANSPORT_STEP_SCHEMA,
  LEGACY_EARTH_TRANSPORT_STEP_SCHEMA
} from './earth-transport.mjs';
import {
  ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA
} from './atmosphere-biogeochemistry-transport.mjs';
import {
  BASIN_ROUTING_STEP_SCHEMA,
  PREVIOUS_BASIN_ROUTING_STEP_SCHEMA
} from './basin-routing.mjs';
import {
  RIVER_CHEMISTRY_INPUT_SCHEMA
} from './river-chemistry.mjs';
import {
  FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
  FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
  FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
  FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
  FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
  FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
  FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
  FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA
} from './floodplain.mjs';
import {
  FLOODPLAIN_HABITAT_RECEIPT_SCHEMA,
  FLOODPLAIN_HABITAT_TYPES
} from './floodplain-habitat.mjs';
import {
  FLOOD_EVENT_ARCHIVE_LIMIT,
  FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA
} from './flood-event-history.mjs';
import {
  FLOODPLAIN_SUCCESSION_GUILDS,
  FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER,
  FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA
} from './floodplain-succession.mjs';
import {
  FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
  FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA
} from './floodplain-plant-matter.mjs';
import {
  FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA,
  FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA
} from './floodplain-plant-resources.mjs';
import {
  FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA
} from './floodplain-decomposition.mjs';
import {
  FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA
} from './floodplain-respiration.mjs';
import {
  FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA
} from './floodplain-denitrification.mjs';
import {
  FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA
} from './floodplain-nitrification.mjs';
import {
  FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA
} from './floodplain-gas-exchange.mjs';
import {
  EARTH_SURFACE_RADIATION_SCHEMA,
  PREVIOUS_EARTH_SURFACE_RADIATION_SCHEMA
} from './surface-radiation.mjs';
import {
  ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA
} from './atmosphere-co2-radiation.mjs';

export const FOUNDATION_SYSTEM_AUDIT_SCHEMA =
  'axm.foundation-planet.system-audit/v1';

const finite = value => Number.isFinite(Number(value));
const close = (value, tolerance) => finite(value) &&
  Math.abs(Number(value)) <= tolerance;
const same = (a, b, tolerance = 1e-12) => finite(a) && finite(b) &&
  Math.abs(Number(a) - Number(b)) <= tolerance;

function check(id, status, claim, evidence, options = {}) {
  return {
    id,
    status,
    required: options.required !== false,
    claim,
    evidence
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
    const valid = coastal?.schema === COASTAL_SEDIMENT_STATE_SCHEMA &&
      (!coastal.lastInputReceipt ||
        coastal.lastInputReceipt.schema === COASTAL_SEDIMENT_INPUT_SCHEMA &&
        coastal.lastInputReceipt.truth?.conservationClosed === true);
    return check('geomorphic-sediment-lineage', valid ? 'PASS' : 'FAIL',
      'Ocean columns retain typed suspended and deposited coastal mineral sediment.', {
        expectedCoastalSchema: COASTAL_SEDIMENT_STATE_SCHEMA,
        actualCoastalSchema: coastal?.schema || null,
        lastInputSchema: coastal?.lastInputReceipt?.schema || null
      });
  }
  const surface = column?.land?.surfaceSediment;
  const queue = column?.routing?.runoffSedimentQueue;
  const erosion = surface?.lastErosionReceipt;
  const valid = surface?.schema === SURFACE_SEDIMENT_STATE_SCHEMA &&
    queue?.schema === RUNOFF_SEDIMENT_QUEUE_SCHEMA &&
    (!erosion || erosion.schema === SURFACE_EROSION_RECEIPT_SCHEMA &&
      erosion.truth?.conservationClosed === true) &&
    surface.truth?.finiteMineralOwnership === true;
  return check('geomorphic-sediment-lineage', valid ? 'PASS' : 'FAIL',
    'Land columns retain finite grain-resolved surface sediment and a typed runoff queue.', {
      expectedSurfaceSchema: SURFACE_SEDIMENT_STATE_SCHEMA,
      actualSurfaceSchema: surface?.schema || null,
      expectedQueueSchema: RUNOFF_SEDIMENT_QUEUE_SCHEMA,
      actualQueueSchema: queue?.schema || null,
      erosionSchema: erosion?.schema || null,
      migrationCheckpoint: surface?.migrationCheckpoint ?? null
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
        entry.runoffSedimentTransfer.senderDebit.truth
          ?.conservationClosed === true &&
        entry.runoffSedimentTransfer.receiverCredit.truth
          ?.conservationClosed === true) &&
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
  const truthBoundaryValid =
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
      true &&
    receipt.truth
      ?.floodplainDenitrificationQ10TemperatureResponseParameterized ===
      true &&
    receipt.truth
      ?.floodplainDenitrificationPersistentWaterTemperatureState ===
      false &&
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
    receipt.truth
      ?.floodplainNitrificationNitrogenOxygenAndAlkalinityLedgersClosed ===
      true &&
    receipt.truth?.floodplainNitrificationReactionModeled === true &&
    receipt.truth?.floodplainNitrificationAmmoniumToNitrate === true &&
    receipt.truth?.floodplainNitrificationDissolvedOxygenConsumed === true &&
    receipt.truth
      ?.floodplainNitrificationSurfaceTemperatureProxyResponsive === true &&
    receipt.truth
      ?.floodplainNitrificationQ10TemperatureResponseParameterized === true &&
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
      entry.transferId === entry.riverSedimentInput?.transferId);
  const coupledShapeValid = coupled.length === 12;
  const coupledResidualsClosed = coupled.every(([, value]) =>
    close(value, 1));
  const valid = schemaCurrent && truthBoundaryValid && inletLineageValid &&
    coupledShapeValid && coupledResidualsClosed;
  return check('basin-routing-receipt', valid ? 'PASS' : 'FAIL',
    'Loaded basin routing closes water, reaction-ledgered alkalinity, aquatic plus plant P, land-floodplain plant C/N and four mineral grain classes.', {
      expectedSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualSchema: receipt.schema || null,
      toleranceKg: 1,
      residuals: Object.fromEntries(coupled),
      criteria: {
        schemaCurrent,
        truthBoundaryValid,
        inletLineageValid,
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
        deepOceanAlkalinityExchange: false
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
  const senderReceiptsValid = receiptShapeValid && senders.every(entry =>
    entry?.schema === LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA &&
    typeof entry.donorCellId === 'string' && entry.donorCellId.length > 0 &&
    Array.isArray(entry.allocations) &&
    new Set(entry.allocations.map(allocation => allocation.transferId)).size ===
      entry.allocations.length &&
    close(entry.closure?.carbonResidualKgC, 1e-6) &&
    close(entry.closure?.nitrogenResidualKgN, 1e-6) &&
    entry.truth?.persistentLandEcologySenderDebited === true &&
    entry.truth?.subgridPartitionCreatesMaterial === false &&
    entry.truth?.boundedDailyDebit === true &&
    entry.truth?.carbonAndNitrogenClosed === true &&
    entry.truth?.phosphorusTransferred === false);
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
  const ledgersValid = receiptShapeValid && entries.every(entry =>
    Array.isArray(entry.guildFlows) &&
    entry.guildFlows.length === FLOODPLAIN_SUCCESSION_GUILDS.length &&
    new Set(entry.guildFlows.map(flow => flow.guildId)).size ===
      FLOODPLAIN_SUCCESSION_GUILDS.length &&
    entry.guildFlows.every(flow =>
      FLOODPLAIN_SUCCESSION_GUILDS.includes(flow.guildId) &&
      close(flow.closure?.carbonResidualKgC, 1e-7) &&
      close(flow.closure?.nitrogenResidualKgN, 1e-7)) &&
    close(entry.closure?.maximumElementResidualKg, 1e-7) &&
    close(entry.closure?.carbonResidualKgC, 1e-7) &&
    close(entry.closure?.nitrogenResidualKgN, 1e-7) &&
    entry.truth?.carbonAndNitrogenClosed === true);
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
        entrySchemasValid,
        successionLineageValid,
        ledgersValid,
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
  const ledgersValid = receiptShapeValid && entries.every(entry =>
    Array.isArray(entry.guildFlows) &&
    entry.guildFlows.length === FLOODPLAIN_SUCCESSION_GUILDS.length &&
    new Set(entry.guildFlows.map(flow => flow.guildId)).size ===
      FLOODPLAIN_SUCCESSION_GUILDS.length &&
    entry.guildFlows.every(flow =>
      FLOODPLAIN_SUCCESSION_GUILDS.includes(flow.guildId) &&
      close(flow.closure?.supportedCarbonResidualKgC, 1e-7) &&
      close(flow.closure?.phosphorusResidualKgP, 1e-7) &&
      close(flow.closure?.liveWaterResidualKg, 1e-7)) &&
    close(entry.closure?.maximumResidualKg, 1e-7) &&
    close(entry.closure?.supportedCarbonResidualKgC, 1e-7) &&
    close(entry.closure?.phosphorusResidualKgP, 1e-7) &&
    close(entry.closure?.liveWaterResidualKg, 1e-7) &&
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
        ledgersValid, pairingValid, referencesBounded, transitionsValid,
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
  const receiversValid = receiptShapeValid && credits.every(entry =>
    entry?.schema === FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    Array.isArray(entry.allocations) &&
    new Set(entry.allocations.map(allocation => allocation.transferId)).size ===
      entry.allocations.length && entry.allocations.every(allocation =>
      FLOODPLAIN_SUCCESSION_GUILDS.includes(allocation.guildId) &&
      ['standingDead', 'litter'].includes(allocation.pool)) &&
    close(entry.closure?.carbonResidualKgC, 1e-7) &&
    close(entry.closure?.nitrogenResidualKgN, 1e-7) &&
    close(entry.closure?.ammoniumNitrogenResidualKgN, 1e-7) &&
    close(entry.closure?.phosphorusResidualKgP, 1e-9) &&
    entry.truth?.persistentFloodplainChemistryReceiverCredited === true &&
    entry.truth?.detritalNitrogenCreditedToAmmoniumPool === true &&
    entry.truth?.nitratePoolUnchanged === true &&
    entry.truth?.carbonNitrogenPhosphorusClosed === true &&
    entry.truth?.localReceiverOnly === true &&
    entry.truth?.soilReceiverModeled === false &&
    entry.truth?.atmosphereRespirationModeled === false &&
    entry.truth?.oxygenConsumptionModeled === false);
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
      decompositionReceiptCount: Array.isArray(entries)
        ? entries.length : null,
      criteria: { receiptShapeValid, matterSendersValid,
        resourceSendersValid, receiversValid, entrySchemasValid,
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
  const reactionReceiptsValid = receiptShapeValid && reactions.every(entry =>
    entry?.schema === FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    close(entry.closure?.dissolvedOrganicCarbonDebitResidualKgC, 1e-7) &&
    close(entry.closure?.dissolvedInorganicCarbonCreditResidualKgC, 1e-7) &&
    close(entry.closure?.carbonResidualKgC, 1e-7) &&
    close(entry.closure?.dissolvedOxygenDebitResidualKgO2, 1e-7) &&
    close(entry.closure?.stoichiometricOxygenResidualKgO2, 1e-7) &&
    entry.truth?.persistentFloodplainChemistryMutated === true &&
    entry.truth?.localFloodplainChemistryOnly === true &&
    entry.truth?.dissolvedOrganicCarbonSenderDebited === true &&
    entry.truth?.dissolvedInorganicCarbonReceiverCredited === true &&
    entry.truth?.dissolvedOxygenSenderDebited === true &&
    entry.truth?.localDocToDicCarbonClosed === true &&
    entry.truth?.dissolvedOxygenConsumptionClosed === true &&
    entry.truth?.atmosphericGasExchangeModeled === false &&
    entry.truth?.anaerobicPathwayModeled === false);
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
      criteria: { receiptShapeValid, reactionReceiptsValid,
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
  const floodplainOwnerReceiptsValid = receiptShapeValid &&
    floodplainOwners.every(entry =>
      entry?.schema ===
        FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA &&
      typeof entry.transferId === 'string' && entry.transferId.length > 0 &&
      typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
      close(entry.closure?.dissolvedOrganicCarbonDebitResidualKgC, 1e-7) &&
      close(entry.closure?.dissolvedInorganicCarbonCreditResidualKgC,
        1e-7) &&
      close(entry.closure?.carbonResidualKgC, 1e-7) &&
      close(entry.closure?.dissolvedNitrateNitrogenDebitResidualKgN,
        1e-7) &&
      close(entry.closure?.dissolvedAmmoniumNitrogenResidualKgN,
        1e-7) &&
      close(entry.closure?.dissolvedInorganicNitrogenDebitResidualKgN,
        1e-7) &&
      close(entry.closure?.nitrogenGasBoundaryResidualKgN, 1e-7) &&
      close(entry.closure?.nitrogenResidualKgN, 1e-7) &&
      close(entry.closure?.stoichiometricNitrogenResidualKgN, 1e-7) &&
      close(entry.closure?.alkalinityCreditResidualKgCaCO3Eq, 1e-7) &&
      close(entry.closure
        ?.stoichiometricAlkalinityResidualKgCaCO3Eq, 1e-7) &&
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
    entry.truth?.surfaceTemperatureProxyResponsive === true &&
    entry.truth?.q10TemperatureResponseParameterized === true &&
    entry.truth?.persistentFloodplainWaterTemperatureState === false &&
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
      ?.surfaceTemperatureForcingUsedAsWaterTemperatureProxy === true &&
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
    receipt.truth
      ?.floodplainDenitrificationCarbonNitrogenAndAlkalinityLedgersClosed ===
      true &&
    receipt.truth?.floodplainDenitrificationOxygenGated === true &&
    receipt.truth?.floodplainDenitrificationNitrogenLimited === true &&
    receipt.truth
      ?.floodplainDenitrificationSurfaceTemperatureProxyResponsive ===
      true &&
    receipt.truth
      ?.floodplainDenitrificationQ10TemperatureResponseParameterized ===
      true &&
    receipt.truth
      ?.floodplainDenitrificationPersistentWaterTemperatureState ===
      false &&
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
      processReceiptCount: Array.isArray(processes)
        ? processes.length : null,
      pairedOwnerReceiptCount: Array.isArray(floodplainOwners)
        ? floodplainOwners.length : null,
      criteria: { receiptShapeValid, floodplainOwnerReceiptsValid,
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
  const ownerReceiptsValid = receiptShapeValid && owners.every(entry =>
    entry?.schema === FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA &&
    typeof entry.transferId === 'string' && entry.transferId.length > 0 &&
    typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
    close(entry.closure
      ?.dissolvedAmmoniumNitrogenDebitResidualKgN, 1e-7) &&
    close(entry.closure
      ?.dissolvedNitrateNitrogenCreditResidualKgN, 1e-7) &&
    close(entry.closure?.dissolvedInorganicNitrogenResidualKgN, 1e-7) &&
    close(entry.closure?.dissolvedOxygenDebitResidualKgO2, 1e-7) &&
    close(entry.closure?.stoichiometricOxygenResidualKgO2, 1e-7) &&
    close(entry.closure?.alkalinityDebitResidualKgCaCO3Eq, 1e-7) &&
    close(entry.closure
      ?.stoichiometricAlkalinityResidualKgCaCO3Eq, 1e-7) &&
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
    entry.truth?.surfaceTemperatureProxyResponsive === true &&
    entry.truth?.q10TemperatureResponseParameterized === true &&
    entry.truth?.persistentFloodplainWaterTemperatureState === false &&
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
      ?.floodplainNitrificationSurfaceTemperatureProxyResponsive === true &&
    receipt.truth
      ?.floodplainNitrificationQ10TemperatureResponseParameterized === true &&
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
      processReceiptCount: Array.isArray(processes)
        ? processes.length : null,
      ownerReceiptCount: Array.isArray(owners) ? owners.length : null,
      criteria: { receiptShapeValid, ownerReceiptsValid,
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
  const ownerReceiptsValid = receiptShapeValid &&
    floodplainOwners.every(entry =>
      entry?.schema === FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA &&
      typeof entry.exchangeId === 'string' && entry.exchangeId.length > 0 &&
      typeof entry.reachId === 'string' && entry.reachId.length > 0 &&
      typeof entry.atmosphereCellId === 'string' &&
      entry.atmosphereCellId.length > 0 &&
      close(entry.closure?.carbonTransferResidualKgC, 1e-7) &&
      close(entry.closure?.oxygenTransferResidualKgO2, 1e-7) &&
      entry.truth?.dissolvedInorganicCarbonSenderDebitedWhenEvasion ===
        true &&
      entry.truth?.dissolvedInorganicCarbonReceiverCreditedWhenInvasion ===
        true &&
      entry.truth?.dissolvedOxygenReceiverCredited === true &&
      entry.truth?.carbonDirectionExclusive === true &&
      entry.truth?.atmosphericReservoirMutatedHere === false) &&
    atmosphereOwners.every(entry =>
      entry?.schema ===
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA &&
      typeof entry.exchangeId === 'string' && entry.exchangeId.length > 0 &&
      entry.atmosphereCarbonCredit?.nativeLayerIndex === 0 &&
      entry.atmosphereCarbonDebit?.nativeLayerIndex === 0 &&
      entry.atmosphereOxygenDebit?.nativeLayerIndex === 0 &&
      close(entry.conservation?.carbonResidualKgC,
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_ABSOLUTE_TOLERANCE_KG) &&
      close(entry.conservation?.oxygenResidualKgO2,
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_ABSOLUTE_TOLERANCE_KG) &&
      entry.truth?.carbonAndOxygenClosed === true &&
      entry.truth?.floatingPointAbsoluteToleranceKg ===
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_ABSOLUTE_TOLERANCE_KG &&
      entry.truth?.authoritativeLocalGasReservoirMutated === true &&
      entry.truth?.surfaceLayerOnly === true &&
      entry.truth?.carbonReceiverCreditedWhenEvasion === true &&
      entry.truth?.carbonSenderDebitedWhenInvasion === true &&
      entry.truth?.oxygenSenderDebited === true &&
      entry.truth?.carbonDirectionExclusive === true &&
      entry.truth?.globallyMixed === false);
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
      expectedAtmosphereOwnerSchema:
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
      atmosphereOwnerFloatingPointAbsoluteToleranceKg:
        ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_ABSOLUTE_TOLERANCE_KG,
      processReceiptCount: Array.isArray(processes)
        ? processes.length : null,
      pairedOwnerReceiptCount: Array.isArray(floodplainOwners)
        ? floodplainOwners.length : null,
      criteria: { receiptShapeValid, ownerReceiptsValid,
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
  const entrySchemasValid = receiptShapeValid && entries.every(entry =>
    entry?.schema === FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA &&
    typeof entry.reachId === 'string' &&
    entry.truth?.resolvedInundationHydraulics === false &&
    entry.truth?.senderDebitsAndReceiverCreditsPaired === true &&
    entry.truth?.nitrateAndAmmoniumMaterialPools === true &&
    entry.truth?.exactNitrateAmmoniumWaterFractionTransport === true &&
    entry.truth?.nitrateAndAmmoniumSenderReceiverTransfersPaired === true &&
    entry.truth?.nitrateAndAmmoniumConservationClosed === true);
  const entryResidualsClosed = receiptShapeValid && entries.every(entry =>
    close(entry.water?.residualKg, 1) &&
    Object.values(entry.chemistry?.residuals || {}).every(value =>
      close(value, 1e-6)) &&
    Object.values(entry.sediment?.residualKg || {}).every(value =>
      close(value, 1e-6)) &&
    entry.truth?.conservationClosed === true);
  const basinTruthValid =
    receipt.truth?.persistentFloodplainWaterChemistryAndSediment === true &&
    receipt.truth?.persistentRiverAndFloodplainNitrateAmmoniumPools ===
      true &&
    receipt.truth?.exactNitrateAmmoniumWaterFractionTransport === true &&
    receipt.truth?.geometryDerivedBankfullExchange === true &&
    receipt.truth?.finiteFloodplainReturnFlow === true &&
    receipt.truth?.grainSelectiveFloodplainDeposition === true &&
    receipt.truth?.resolvedFloodplainInundationHydraulics === false &&
    receipt.truth?.unresolvedReachFloodplainRetained === true;
  const valid = receipt.schema === BASIN_ROUTING_STEP_SCHEMA &&
    receiptShapeValid && entrySchemasValid && entryResidualsClosed &&
    basinTruthValid;
  return check('floodplain-exchange-receipts', valid ? 'PASS' : 'FAIL',
    'Floodplain exchanges conserve water, chemistry and mineral grains while denying resolved inundation authority.', {
      expectedBasinSchema: BASIN_ROUTING_STEP_SCHEMA,
      actualBasinSchema: receipt.schema || null,
      expectedExchangeSchema: FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA,
      exchangeReceiptCount: Array.isArray(entries) ? entries.length : null,
      criteria: {
        receiptShapeValid,
        entrySchemasValid,
        entryResidualsClosed,
        basinTruthValid
      },
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
    localBudgetCheck(column),
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
    transportCheck(options.earthTransportReceipt),
    basinCheck(options.basinRoutingReceipt),
    alkalinityLedgerCheck(options.basinRoutingReceipt),
    floodplainCheck(options.basinRoutingReceipt),
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
      floodplainDenitrificationSurfaceTemperatureProxyResponsive: true,
      floodplainDenitrificationQ10TemperatureResponseParameterized: true,
      persistentFloodplainWaterTemperatureState: false,
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
      floodplainNitrificationSurfaceTemperatureProxyResponsive: true,
      floodplainNitrificationQ10TemperatureResponseParameterized: true,
      floodplainNitrificationNitriteIntermediateResolved: false,
      floodplainNitrificationAlkalinityDemandDiagnostic: false,
      floodplainNitrificationAlkalinityMaterialOwnerDebited: true,
      persistentEndToEndAlkalinityLedger: true,
      alkalinityIsAcidNeutralizingCapacityEquivalent: true,
      alkalinityMeasured: false,
      alkalinityCarbonateSpeciationResolved: false,
      alkalinityPHResolved: false,
      deepOceanAlkalinityExchange: false,
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
      'schema-lineage', 'pressure-column-shape', 'local-water-and-energy-ledgers',
      'atmosphere-co2-radiative-coupling',
      'local-atmosphere-gas-ownership', 'atmosphere-vertical-gas-ledger',
      'atmosphere-biosphere-gas-ledger',
      'ecology-gas-mirrors', 'soil-runoff-biogeochemistry-lineage',
      'geomorphic-sediment-lineage',
      'deep-ocean-lineage', 'loaded-transport-receipt',
      'basin-routing-receipt', 'end-to-end-alkalinity-ledger',
      'floodplain-exchange-receipts',
      'floodplain-habitat-receipts', 'flood-event-history-receipts',
      'floodplain-succession-receipts',
      'floodplain-plant-matter-receipts',
      'floodplain-plant-resources-receipts',
      'floodplain-decomposition-receipts',
      'floodplain-respiration-receipts',
      'floodplain-denitrification-receipts',
      'floodplain-atmosphere-gas-exchange-receipts'
    ],
    mutatesWorld: false,
    provesScientificAuthority: false
  };
}
