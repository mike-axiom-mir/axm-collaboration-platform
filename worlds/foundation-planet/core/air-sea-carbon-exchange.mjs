import { MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA } from './carbonate-system.mjs';

export const AIR_SEA_CARBON_EXCHANGE_PROPOSAL_SCHEMA =
  'axm.foundation-planet.air-sea-carbon-exchange-proposal/v1';

export const AIR_SEA_CARBON_EXCHANGE_METHOD = Object.freeze({
  id: 'weiss-1974-k0-vapor-pressure-virial-bulk-relaxation/v1',
  solubility: 'Weiss-1974',
  seawaterVaporPressure: 'Weiss-and-Price-1980',
  co2Fugacity: 'Weiss-1974-virial-B-and-cross-virial-delta',
  pressureRangeHpa: Object.freeze([800, 1150]),
  referenceWaterDensityKgM3: 1000,
  carbonKgPerMol: 0.0120107,
  references: Object.freeze([
    'https://doi.org/10.1016/0304-4203(74)90015-2',
    'https://www.ncei.noaa.gov/access/ocean-carbon-acidification-data-system/oceans/Handbook_2007/Guide_all_in_one.pdf',
    'https://www.ncei.noaa.gov/access/ocean-carbon-acidification-data-system/oceans/ndp_047/datacalc047.html'
  ])
});

const STANDARD_ATMOSPHERE_HPA = 1013.25;
const GAS_CONSTANT_CM3_ATM_MOL_K = 82.05736608096;
const MICROMOL_PER_MOL = 1e6;
const EPSILON = 1e-15;

const finite = value => Number.isFinite(Number(value));
const round = (value, digits = 12) => finite(value)
  ? Number(Number(value).toFixed(digits)) : null;
const materiallyEqual = (left, right, tolerance = 1e-9) =>
  finite(left) && finite(right) && Math.abs(Number(left) - Number(right)) <=
    tolerance * Math.max(1, Math.abs(Number(left)), Math.abs(Number(right)));

export function weiss1974Co2Solubility(temperatureC, salinityPsu) {
  if (!finite(temperatureC) || !finite(salinityPsu) ||
      Number(temperatureC) <= -273.15 || Number(salinityPsu) < 0) return null;
  const temperatureK = Number(temperatureC) + 273.15;
  const temperatureRatio = temperatureK / 100;
  const salinity = Number(salinityPsu);
  const lnK0 = -60.2409 + 93.4517 / temperatureRatio +
    23.3585 * Math.log(temperatureRatio) + salinity *
      (0.023517 - 0.023656 * temperatureRatio +
        0.0047036 * temperatureRatio * temperatureRatio);
  return {
    temperatureK: round(temperatureK, 9),
    salinityPsu: round(salinity, 9),
    lnK0: round(lnK0, 12),
    k0MolKgAtm: round(Math.exp(lnK0), 15)
  };
}

export function weissPrice1980SeawaterVaporPressureAtm(
  temperatureC,
  salinityPsu
) {
  if (!finite(temperatureC) || !finite(salinityPsu) ||
      Number(temperatureC) <= -273.15 || Number(salinityPsu) < 0) return null;
  const temperatureK = Number(temperatureC) + 273.15;
  const temperatureRatio = temperatureK / 100;
  const lnVaporPressureAtm = 24.4543 - 67.4509 / temperatureRatio -
    4.8489 * Math.log(temperatureRatio) - 0.000544 * Number(salinityPsu);
  return round(Math.exp(lnVaporPressureAtm), 15);
}

export function weiss1974Co2FugacityFactor(temperatureC, pressureHpa) {
  if (!finite(temperatureC) || !finite(pressureHpa) ||
      Number(temperatureC) <= -273.15 || Number(pressureHpa) <= 0) return null;
  const temperatureK = Number(temperatureC) + 273.15;
  const pressureAtm = Number(pressureHpa) / STANDARD_ATMOSPHERE_HPA;
  const virialBCm3Mol = -1636.75 + 12.0408 * temperatureK -
    3.27957e-2 * temperatureK * temperatureK +
    3.16528e-5 * temperatureK * temperatureK * temperatureK;
  const crossVirialDeltaCm3Mol = 57.7 - 0.118 * temperatureK;
  const exponent = (virialBCm3Mol + 2 * crossVirialDeltaCm3Mol) *
    pressureAtm / (GAS_CONSTANT_CM3_ATM_MOL_K * temperatureK);
  return {
    virialBCm3Mol: round(virialBCm3Mol, 9),
    crossVirialDeltaCm3Mol: round(crossVirialDeltaCm3Mol, 9),
    exponent: round(exponent, 15),
    fugacityFactor: round(Math.exp(exponent), 15)
  };
}

function proposalBase(inputs, status, reason) {
  const atmosphericCarbon = finite(inputs?.atmosphericCarbonKgCm2)
    ? Math.max(0, Number(inputs.atmosphericCarbonKgCm2)) : null;
  const dissolvedInorganicCarbon =
    finite(inputs?.dissolvedInorganicCarbonKgCm2)
      ? Math.max(0, Number(inputs.dissolvedInorganicCarbonKgCm2)) : null;
  const pressureHpa = finite(inputs?.surfacePressureHpa)
    ? Number(inputs.surfacePressureHpa) : null;
  const [minimumPressure, maximumPressure] =
    AIR_SEA_CARBON_EXCHANGE_METHOD.pressureRangeHpa;
  return {
    schema: AIR_SEA_CARBON_EXCHANGE_PROPOSAL_SCHEMA,
    status,
    reason,
    method: AIR_SEA_CARBON_EXCHANGE_METHOD.id,
    sourceDiagnostic: {
      schema: inputs?.carbonateSystem?.schema ?? null,
      status: inputs?.carbonateSystem?.status ?? null,
      constantSet: inputs?.carbonateSystem?.constantSet ?? null,
      actualCo2StarMicromolKg: finite(inputs?.carbonateSystem?.solution
        ?.speciesUmolKg?.co2Star)
        ? round(Number(inputs.carbonateSystem.solution.speciesUmolKg.co2Star), 9)
        : null,
      truth: {
        constantsWithinPublishedEnvelope: inputs?.carbonateSystem?.truth
          ?.constantsWithinPublishedEnvelope === true,
        carbonateMassClosed: inputs?.carbonateSystem?.truth
          ?.carbonateMassClosed === true,
        phosphateMassClosed: inputs?.carbonateSystem?.truth
          ?.phosphateMassClosed === true,
        alkalinityResidualClosed: inputs?.carbonateSystem?.truth
          ?.alkalinityResidualClosed === true
      },
      sourceOwners: {
        dissolvedInorganicCarbonKgCm2: round(inputs?.carbonateSystem
          ?.sourceOwners?.dissolvedInorganicCarbonKgCm2),
        alkalinityKgCaCO3Eqm2: round(inputs?.carbonateSystem
          ?.sourceOwners?.alkalinityKgCaCO3Eqm2),
        dissolvedInorganicPhosphorusKgPm2: round(inputs?.carbonateSystem
          ?.sourceOwners?.dissolvedInorganicPhosphorusKgPm2),
        mixedLayerDepthM: round(inputs?.carbonateSystem
          ?.sourceOwners?.mixedLayerDepthM, 9),
        temperatureC: round(inputs?.carbonateSystem
          ?.sourceOwners?.temperatureC, 9),
        salinityPsu: round(inputs?.carbonateSystem
          ?.sourceOwners?.salinityPsu, 9)
      }
    },
    sourceOwners: {
      atmosphericCo2PpmProxy: finite(inputs?.atmosphericCo2PpmProxy)
        ? round(Number(inputs.atmosphericCo2PpmProxy), 15) : null,
      atmosphericCarbonKgCm2: round(atmosphericCarbon, 15),
      dissolvedInorganicCarbonKgCm2: round(dissolvedInorganicCarbon, 15),
      alkalinityKgCaCO3Eqm2: finite(inputs?.alkalinityKgCaCO3Eqm2)
        ? round(Math.max(0, Number(inputs.alkalinityKgCaCO3Eqm2)), 15)
        : null,
      dissolvedInorganicPhosphorusKgPm2:
        finite(inputs?.dissolvedInorganicPhosphorusKgPm2)
          ? round(Math.max(0,
            Number(inputs.dissolvedInorganicPhosphorusKgPm2)), 15) : null,
      mixedLayerDepthM: finite(inputs?.mixedLayerDepthM)
        ? round(Number(inputs.mixedLayerDepthM), 15) : null,
      temperatureC: finite(inputs?.temperatureC)
        ? round(Number(inputs.temperatureC), 15) : null,
      salinityPsu: finite(inputs?.salinityPsu)
        ? round(Number(inputs.salinityPsu), 15) : null,
      surfacePressureHpa: round(pressureHpa, 15),
      relaxationFraction: finite(inputs?.relaxationFraction)
        ? round(Number(inputs.relaxationFraction), 15) : null
    },
    equilibrium: null,
    transfer: {
      direction: 'none',
      mixedLayerWaterMassKgM2: null,
      unboundedSignedCarbonToOceanKgCm2: 0,
      signedCarbonToOceanKgCm2: 0,
      boundedBySourceMaterial: false
    },
    signedCarbonToOceanKgCm2: 0,
    truth: {
      proposalOnly: true,
      mutatesMaterial: false,
      sourceDiagnosticRequired: true,
      sourceDiagnosticSolved: false,
      sourceOwnerBinding: false,
      atmosphericCo2IsMeasured: false,
      oceanPco2IsMeasured: false,
      oceanSkinTemperatureMeasured: false,
      wetAirPartialPressureIncluded: false,
      fugacityNonidealityIncluded: false,
      airMixtureNonCo2MoleFractionApproximatedAsOne: true,
      pressureWithinDeclaredEnvelope: finite(pressureHpa) &&
        pressureHpa >= minimumPressure && pressureHpa <= maximumPressure,
      scientificGasTransferVelocity: false,
      boundedBulkRelaxation: true,
      senderBounded: false,
      carbonClosureClaimedByProposal: false
    }
  };
}

export function proposeAirSeaCarbonExchange(inputs = {}) {
  const required = [
    inputs.atmosphericCo2PpmProxy,
    inputs.atmosphericCarbonKgCm2,
    inputs.dissolvedInorganicCarbonKgCm2,
    inputs.alkalinityKgCaCO3Eqm2,
    inputs.dissolvedInorganicPhosphorusKgPm2,
    inputs.mixedLayerDepthM,
    inputs.temperatureC,
    inputs.salinityPsu,
    inputs.surfacePressureHpa,
    inputs.relaxationFraction
  ];
  if (!required.every(finite) || Number(inputs.atmosphericCo2PpmProxy) < 0 ||
      Number(inputs.atmosphericCarbonKgCm2) < 0 ||
      Number(inputs.dissolvedInorganicCarbonKgCm2) < 0 ||
      Number(inputs.alkalinityKgCaCO3Eqm2) < 0 ||
      Number(inputs.dissolvedInorganicPhosphorusKgPm2) < 0 ||
      Number(inputs.mixedLayerDepthM) <= 0 || Number(inputs.salinityPsu) < 0 ||
      Number(inputs.surfacePressureHpa) <= 0 ||
      Number(inputs.relaxationFraction) < 0 ||
      Number(inputs.relaxationFraction) > 1) {
    return proposalBase(inputs, 'INVALID_INPUT',
      'finite-nonnegative-material-ppm-salinity-and-unit-interval-relaxation-required');
  }
  const [minimumPressure, maximumPressure] =
    AIR_SEA_CARBON_EXCHANGE_METHOD.pressureRangeHpa;
  const surfacePressureHpa = Number(inputs.surfacePressureHpa);
  if (surfacePressureHpa < minimumPressure ||
      surfacePressureHpa > maximumPressure) {
    return proposalBase(inputs, 'OUTSIDE_METHOD_VALIDITY',
      'surface-pressure-must-remain-within-800-to-1150-hPa');
  }
  const carbonateSystem = inputs.carbonateSystem;
  const actualCo2StarMicromolKg =
    carbonateSystem?.solution?.speciesUmolKg?.co2Star;
  if (carbonateSystem?.schema !== MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA ||
      carbonateSystem?.status !== 'SOLVED' ||
      !finite(actualCo2StarMicromolKg) ||
      Number(actualCo2StarMicromolKg) < 0 ||
      carbonateSystem?.truth?.constantsWithinPublishedEnvelope !== true ||
      carbonateSystem?.truth?.carbonateMassClosed !== true ||
      carbonateSystem?.truth?.phosphateMassClosed !== true ||
      carbonateSystem?.truth?.alkalinityResidualClosed !== true) {
    return proposalBase(inputs, 'CARBONATE_DIAGNOSTIC_UNAVAILABLE',
      'a-solved-r53-mixed-layer-carbonate-diagnostic-is-required');
  }
  const diagnosticOwners = carbonateSystem.sourceOwners;
  const sourceOwnersMatch = materiallyEqual(
    diagnosticOwners?.dissolvedInorganicCarbonKgCm2,
    inputs.dissolvedInorganicCarbonKgCm2) && materiallyEqual(
    diagnosticOwners?.alkalinityKgCaCO3Eqm2,
    inputs.alkalinityKgCaCO3Eqm2) && materiallyEqual(
    diagnosticOwners?.dissolvedInorganicPhosphorusKgPm2,
    inputs.dissolvedInorganicPhosphorusKgPm2) && materiallyEqual(
    diagnosticOwners?.mixedLayerDepthM, inputs.mixedLayerDepthM, 1e-6) &&
    materiallyEqual(diagnosticOwners?.temperatureC,
      inputs.temperatureC, 1e-6) && materiallyEqual(
    diagnosticOwners?.salinityPsu, inputs.salinityPsu, 1e-6);
  if (!sourceOwnersMatch) {
    return proposalBase(inputs, 'CARBONATE_SOURCE_MISMATCH',
      'carbonate-diagnostic-source-owners-must-match-current-material-and-physical-inputs');
  }
  const temperatureC = Number(inputs.temperatureC);
  const salinityPsu = Number(inputs.salinityPsu);
  const solubility = weiss1974Co2Solubility(temperatureC, salinityPsu);
  const vaporPressureAtm = weissPrice1980SeawaterVaporPressureAtm(
    temperatureC, salinityPsu);
  const fugacity = weiss1974Co2FugacityFactor(
    temperatureC, surfacePressureHpa);
  if (!solubility || !finite(vaporPressureAtm) || !fugacity) {
    return proposalBase(inputs, 'METHOD_UNRESOLVED',
      'solubility-vapor-pressure-or-fugacity-evaluation-failed');
  }
  const totalPressureAtm = surfacePressureHpa / STANDARD_ATMOSPHERE_HPA;
  const dryAirPressureAtm = Math.max(0, totalPressureAtm - vaporPressureAtm);
  const atmosphericCo2MoleFraction =
    Number(inputs.atmosphericCo2PpmProxy) / MICROMOL_PER_MOL;
  const atmosphericPco2Atm = atmosphericCo2MoleFraction * dryAirPressureAtm;
  const atmosphericFco2Atm = atmosphericPco2Atm * fugacity.fugacityFactor;
  const equilibriumCo2StarMicromolKg = solubility.k0MolKgAtm *
    atmosphericFco2Atm * MICROMOL_PER_MOL;
  const co2StarDisequilibriumMicromolKg =
    equilibriumCo2StarMicromolKg - Number(actualCo2StarMicromolKg);
  const waterMassKgM2 = Number(inputs.mixedLayerDepthM) *
    AIR_SEA_CARBON_EXCHANGE_METHOD.referenceWaterDensityKgM3;
  const unboundedSignedCarbonToOceanKgCm2 =
    co2StarDisequilibriumMicromolKg / MICROMOL_PER_MOL * waterMassKgM2 *
      AIR_SEA_CARBON_EXCHANGE_METHOD.carbonKgPerMol *
      Number(inputs.relaxationFraction);
  const atmosphericCarbon = Number(inputs.atmosphericCarbonKgCm2);
  const dissolvedInorganicCarbon =
    Number(inputs.dissolvedInorganicCarbonKgCm2);
  const signedCarbonToOceanKgCm2 = unboundedSignedCarbonToOceanKgCm2 >= 0
    ? Math.min(unboundedSignedCarbonToOceanKgCm2, atmosphericCarbon)
    : Math.max(unboundedSignedCarbonToOceanKgCm2,
      -dissolvedInorganicCarbon);
  const direction = signedCarbonToOceanKgCm2 > EPSILON
    ? 'atmosphere-to-ocean'
    : signedCarbonToOceanKgCm2 < -EPSILON
      ? 'ocean-to-atmosphere' : 'equilibrium';
  const status = direction === 'atmosphere-to-ocean'
    ? 'SOLVED_UPTAKE'
    : direction === 'ocean-to-atmosphere'
      ? 'SOLVED_OUTGASSING' : 'SOLVED_EQUILIBRIUM';
  const result = proposalBase(inputs, status,
    'carbonate-co2-star-versus-wet-air-fugacity-equilibrium');
  result.equilibrium = {
    temperatureK: solubility.temperatureK,
    totalPressureAtm: round(totalPressureAtm, 15),
    seawaterVaporPressureAtm: round(vaporPressureAtm, 15),
    dryAirPressureAtm: round(dryAirPressureAtm, 15),
    atmosphericCo2MoleFraction: round(atmosphericCo2MoleFraction, 15),
    atmosphericPco2Atm: round(atmosphericPco2Atm, 15),
    co2FugacityFactor: fugacity.fugacityFactor,
    atmosphericFco2Atm: round(atmosphericFco2Atm, 15),
    weiss1974LnK0: solubility.lnK0,
    weiss1974K0MolKgAtm: solubility.k0MolKgAtm,
    actualCo2StarMicromolKg: round(Number(actualCo2StarMicromolKg), 9),
    equilibriumCo2StarMicromolKg:
      round(equilibriumCo2StarMicromolKg, 9),
    co2StarDisequilibriumMicromolKg:
      round(co2StarDisequilibriumMicromolKg, 9),
    virialBCm3Mol: fugacity.virialBCm3Mol,
    crossVirialDeltaCm3Mol: fugacity.crossVirialDeltaCm3Mol
  };
  result.transfer = {
    direction,
    mixedLayerWaterMassKgM2: round(waterMassKgM2, 6),
    relaxationFraction: round(Number(inputs.relaxationFraction), 15),
    unboundedSignedCarbonToOceanKgCm2:
      round(unboundedSignedCarbonToOceanKgCm2, 15),
    signedCarbonToOceanKgCm2: round(signedCarbonToOceanKgCm2, 15),
    boundedBySourceMaterial:
      Math.abs(signedCarbonToOceanKgCm2 -
        unboundedSignedCarbonToOceanKgCm2) > EPSILON
  };
  result.signedCarbonToOceanKgCm2 =
    result.transfer.signedCarbonToOceanKgCm2;
  result.truth.sourceDiagnosticSolved = true;
  result.truth.sourceOwnerBinding = true;
  result.truth.wetAirPartialPressureIncluded = true;
  result.truth.fugacityNonidealityIncluded = true;
  result.truth.senderBounded = true;
  result.truth.carbonClosureClaimedByProposal = false;
  return result;
}

export function airSeaCarbonExchangeDescription() {
  return {
    schema: AIR_SEA_CARBON_EXCHANGE_PROPOSAL_SCHEMA,
    method: AIR_SEA_CARBON_EXCHANGE_METHOD,
    sourceDiagnostic: MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA,
    signedConvention: 'positive-is-atmosphere-to-ocean-DIC',
    ownerMutation: false,
    requiredInputs: [
      'solved-mixed-layer-carbonate-diagnostic',
      'atmospheric-dry-co2-ppm-proxy',
      'atmosphere-owned-carbon',
      'mixed-layer-DIC-owner',
      'mixed-layer-alkalinity-and-phosphorus-owners',
      'mixed-layer-depth-temperature-salinity',
      'surface-pressure',
      'bounded-bulk-relaxation-fraction'
    ],
    omitted: [
      'measured-atmospheric-or-ocean-pCO2',
      'measured-ocean-skin-temperature',
      'calibrated-gas-transfer-piston-velocity',
      'cool-skin-and-warm-layer-corrections',
      'species-resolved-pH-response'
    ],
    scientificEarthModel: false
  };
}
