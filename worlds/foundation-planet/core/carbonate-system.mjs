export const MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA =
  'axm.foundation-planet.mixed-layer-carbonate-diagnostic/v1';

export const MIXED_LAYER_CARBONATE_CONSTANT_SET = Object.freeze({
  id: 'lueker2000-dickson1990-millero1995-lee2010-total-scale-surface/v1',
  pHScale: 'total-hydrogen-ion',
  pressureDbar: 0,
  temperatureRangeC: Object.freeze([2, 35]),
  salinityRangePsu: Object.freeze([19, 43]),
  carbonicAcid: 'Lueker-et-al-2000-refit-of-Mehrbach-et-al-1973',
  boricAcid: 'Dickson-1990',
  totalBoron: 'Lee-et-al-2010',
  water: 'Millero-1995',
  phosphoricAcid: 'Millero-1995-composite-total-scale',
  references: Object.freeze([
    'https://doi.org/10.1016/S0304-4203(00)00022-0',
    'https://doi.org/10.1016/0198-0149(90)90004-F',
    'https://doi.org/10.1016/0016-7037(94)00354-O',
    'https://doi.org/10.1016/j.gca.2009.12.027',
    'https://www.nodc.noaa.gov/media/pdf/oceanacidification/Dicksonetal2007_guide_all_in_one.pdf'
  ])
});

const CARBON_KG_PER_MOL = 0.0120107;
const PHOSPHORUS_KG_PER_MOL = 0.030973761998;
const CACO3_KG_PER_EQUIVALENT = 0.05004345;
const REFERENCE_WATER_DENSITY_KG_M3 = 1000;
const TOTAL_BORON_MOL_KG_AT_SALINITY_35 = 0.0004326;
const MAX_ITERATIONS = 80;
const PH_MIN = 3;
const PH_MAX = 12;
const ALKALINITY_RESIDUAL_TOLERANCE_MOL_KG = 1e-12;

const finite = value => Number.isFinite(Number(value));
const round = (value, digits = 12) => finite(value)
  ? Number(Number(value).toFixed(digits)) : null;

function constantSet(temperatureC, salinityPsu) {
  const temperatureK = temperatureC + 273.15;
  const salinity = salinityPsu;
  const sqrtSalinity = Math.sqrt(salinity);
  const salinityThreeHalves = salinity * sqrtSalinity;
  const lnTemperature = Math.log(temperatureK);
  const pK1 = 3633.86 / temperatureK - 61.2172 +
    9.67770 * lnTemperature - 0.011555 * salinity +
    0.0001152 * salinity * salinity;
  const pK2 = 471.78 / temperatureK + 25.9290 -
    3.16967 * lnTemperature - 0.01781 * salinity +
    0.0001122 * salinity * salinity;
  const lnKB = (-8966.90 - 2890.53 * sqrtSalinity - 77.942 * salinity +
    1.728 * salinityThreeHalves - 0.0996 * salinity * salinity) /
      temperatureK +
    148.0248 + 137.1942 * sqrtSalinity + 1.62142 * salinity +
    (-24.4344 - 25.085 * sqrtSalinity - 0.2474 * salinity) *
      lnTemperature + 0.053105 * sqrtSalinity * temperatureK;
  const lnKW = 148.96502 - 13847.26 / temperatureK -
    23.6521 * lnTemperature +
    (118.67 / temperatureK - 5.977 + 1.0495 * lnTemperature) *
      sqrtSalinity - 0.01615 * salinity;
  const lnKP1 = -4576.752 / temperatureK + 115.525 -
    18.453 * lnTemperature +
    (-106.736 / temperatureK + 0.69171) * sqrtSalinity +
    (-0.65643 / temperatureK - 0.01844) * salinity;
  const lnKP2 = -8814.715 / temperatureK + 172.0883 -
    27.927 * lnTemperature +
    (-160.340 / temperatureK + 1.3566) * sqrtSalinity +
    (0.37335 / temperatureK - 0.05778) * salinity;
  const lnKP3 = -3070.75 / temperatureK - 18.141 +
    (17.27039 / temperatureK + 2.81197) * sqrtSalinity +
    (-44.99486 / temperatureK - 0.09984) * salinity;
  return {
    temperatureK,
    k1: Math.pow(10, -pK1),
    k2: Math.pow(10, -pK2),
    kB: Math.exp(lnKB),
    kW: Math.exp(lnKW),
    kP1: Math.exp(lnKP1),
    kP2: Math.exp(lnKP2),
    kP3: Math.exp(lnKP3),
    totalBoronMolKg: TOTAL_BORON_MOL_KG_AT_SALINITY_35 * salinity / 35
  };
}

function speciate(hydrogenMolKg, dicMolKg, totalPhosphateMolKg, constants) {
  const hydrogen = hydrogenMolKg;
  const carbonateDenominator = hydrogen * hydrogen +
    constants.k1 * hydrogen + constants.k1 * constants.k2;
  const co2StarMolKg = dicMolKg * hydrogen * hydrogen /
    carbonateDenominator;
  const bicarbonateMolKg = dicMolKg * constants.k1 * hydrogen /
    carbonateDenominator;
  const carbonateMolKg = dicMolKg * constants.k1 * constants.k2 /
    carbonateDenominator;
  const borateMolKg = constants.totalBoronMolKg * constants.kB /
    (constants.kB + hydrogen);
  const hydroxideMolKg = constants.kW / hydrogen;
  const phosphateDenominator = hydrogen * hydrogen * hydrogen +
    constants.kP1 * hydrogen * hydrogen +
    constants.kP1 * constants.kP2 * hydrogen +
    constants.kP1 * constants.kP2 * constants.kP3;
  const phosphoricAcidMolKg = totalPhosphateMolKg *
    hydrogen * hydrogen * hydrogen / phosphateDenominator;
  const dihydrogenPhosphateMolKg = totalPhosphateMolKg *
    constants.kP1 * hydrogen * hydrogen / phosphateDenominator;
  const hydrogenPhosphateMolKg = totalPhosphateMolKg *
    constants.kP1 * constants.kP2 * hydrogen / phosphateDenominator;
  const phosphateMolKg = totalPhosphateMolKg *
    constants.kP1 * constants.kP2 * constants.kP3 /
      phosphateDenominator;
  const carbonateAlkalinityMolKg = bicarbonateMolKg +
    2 * carbonateMolKg;
  const phosphateAlkalinityMolKg = hydrogenPhosphateMolKg +
    2 * phosphateMolKg - phosphoricAcidMolKg;
  const calculatedAlkalinityMolKg = carbonateAlkalinityMolKg +
    borateMolKg + hydroxideMolKg - hydrogen + phosphateAlkalinityMolKg;
  return {
    co2StarMolKg,
    bicarbonateMolKg,
    carbonateMolKg,
    borateMolKg,
    hydroxideMolKg,
    phosphoricAcidMolKg,
    dihydrogenPhosphateMolKg,
    hydrogenPhosphateMolKg,
    phosphateMolKg,
    carbonateAlkalinityMolKg,
    phosphateAlkalinityMolKg,
    calculatedAlkalinityMolKg
  };
}

function diagnosticBase(inputs, status, reason) {
  const depthM = finite(inputs?.mixedLayerDepthM)
    ? Number(inputs.mixedLayerDepthM) : null;
  const temperatureC = finite(inputs?.temperatureC)
    ? Number(inputs.temperatureC) : null;
  const salinityPsu = finite(inputs?.salinityPsu)
    ? Number(inputs.salinityPsu) : null;
  const dicOwner = finite(inputs?.dissolvedInorganicCarbonKgCm2)
    ? Math.max(0, Number(inputs.dissolvedInorganicCarbonKgCm2)) : null;
  const alkalinityOwner = finite(inputs?.alkalinityKgCaCO3Eqm2)
    ? Math.max(0, Number(inputs.alkalinityKgCaCO3Eqm2)) : null;
  const phosphateOwner = finite(inputs?.dissolvedInorganicPhosphorusKgPm2)
    ? Math.max(0, Number(inputs.dissolvedInorganicPhosphorusKgPm2)) : null;
  const constantsWithinPublishedEnvelope = finite(temperatureC) &&
    finite(salinityPsu) &&
    temperatureC >= MIXED_LAYER_CARBONATE_CONSTANT_SET.temperatureRangeC[0] &&
    temperatureC <= MIXED_LAYER_CARBONATE_CONSTANT_SET.temperatureRangeC[1] &&
    salinityPsu >= MIXED_LAYER_CARBONATE_CONSTANT_SET.salinityRangePsu[0] &&
    salinityPsu <= MIXED_LAYER_CARBONATE_CONSTANT_SET.salinityRangePsu[1];
  return {
    schema: MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA,
    status,
    reason,
    constantSet: MIXED_LAYER_CARBONATE_CONSTANT_SET.id,
    sourceOwners: {
      dissolvedInorganicCarbonKgCm2: round(dicOwner),
      alkalinityKgCaCO3Eqm2: round(alkalinityOwner),
      dissolvedInorganicPhosphorusKgPm2: round(phosphateOwner),
      mixedLayerDepthM: round(depthM, 6),
      temperatureC: round(temperatureC, 6),
      salinityPsu: round(salinityPsu, 6)
    },
    waterMassConversion: {
      referenceDensityKgM3: REFERENCE_WATER_DENSITY_KG_M3,
      waterMassKgM2: depthM > 0
        ? round(depthM * REFERENCE_WATER_DENSITY_KG_M3, 6) : null,
      measuredDensityClaimed: false
    },
    solution: null,
    closure: null,
    truth: {
      diagnosticOnly: true,
      mutatesMaterial: false,
      sourceOwnerBinding: true,
      totalHydrogenScale: true,
      surfacePressureOnly: true,
      constantsWithinPublishedEnvelope,
      carbonateMassClosed: false,
      alkalinityResidualClosed: false,
      phosphateAlkalinityIncluded: true,
      silicateAlkalinityIncluded: false,
      fluorideAlkalinityIncluded: false,
      sulfideAlkalinityIncluded: false,
      ammoniaAlkalinityIncluded: false,
      pressureCorrectionsIncluded: false,
      measuredInputsClaimed: false,
      pHFeedbackModeled: false,
      mineralSaturationResolved: false,
      deepOceanPHResolved: false
    }
  };
}

export function solveMixedLayerCarbonateSystem(inputs = {}) {
  const required = [
    inputs.dissolvedInorganicCarbonKgCm2,
    inputs.alkalinityKgCaCO3Eqm2,
    inputs.dissolvedInorganicPhosphorusKgPm2,
    inputs.mixedLayerDepthM,
    inputs.temperatureC,
    inputs.salinityPsu
  ];
  if (!required.every(finite) || Number(inputs.mixedLayerDepthM) <= 0 ||
      Number(inputs.dissolvedInorganicCarbonKgCm2) <= 0 ||
      Number(inputs.alkalinityKgCaCO3Eqm2) <= 0 ||
      Number(inputs.dissolvedInorganicPhosphorusKgPm2) < 0) {
    return diagnosticBase(inputs, 'INSUFFICIENT_MATERIAL_STATE',
      'positive-finite-dic-alkalinity-depth-and-nonnegative-phosphate-required');
  }
  const temperatureC = Number(inputs.temperatureC);
  const salinityPsu = Number(inputs.salinityPsu);
  const [minimumTemperature, maximumTemperature] =
    MIXED_LAYER_CARBONATE_CONSTANT_SET.temperatureRangeC;
  const [minimumSalinity, maximumSalinity] =
    MIXED_LAYER_CARBONATE_CONSTANT_SET.salinityRangePsu;
  if (temperatureC < minimumTemperature || temperatureC > maximumTemperature ||
      salinityPsu < minimumSalinity || salinityPsu > maximumSalinity) {
    return diagnosticBase(inputs, 'OUTSIDE_CONSTANT_VALIDITY',
      'lueker-2000-open-ocean-envelope-is-2-to-35-C-and-salinity-19-to-43');
  }
  const waterMassKgM2 = Number(inputs.mixedLayerDepthM) *
    REFERENCE_WATER_DENSITY_KG_M3;
  const dicMolKg = Number(inputs.dissolvedInorganicCarbonKgCm2) /
    CARBON_KG_PER_MOL / waterMassKgM2;
  const totalAlkalinityMolKg = Number(inputs.alkalinityKgCaCO3Eqm2) /
    CACO3_KG_PER_EQUIVALENT / waterMassKgM2;
  const totalPhosphateMolKg = Number(inputs.dissolvedInorganicPhosphorusKgPm2) /
    PHOSPHORUS_KG_PER_MOL / waterMassKgM2;
  const constants = constantSet(temperatureC, salinityPsu);
  const residualAtPH = pH => speciate(Math.pow(10, -pH), dicMolKg,
    totalPhosphateMolKg, constants).calculatedAlkalinityMolKg -
      totalAlkalinityMolKg;
  let low = PH_MIN;
  let high = PH_MAX;
  let lowResidual = residualAtPH(low);
  let highResidual = residualAtPH(high);
  if (!(lowResidual <= 0 && highResidual >= 0)) {
    const result = diagnosticBase(inputs, 'UNBRACKETED',
      'alkalinity-root-does-not-cross-the-declared-pH-bracket');
    result.closure = {
      pHBracket: [PH_MIN, PH_MAX],
      residualAtLowMolKg: round(lowResidual, 15),
      residualAtHighMolKg: round(highResidual, 15)
    };
    return result;
  }
  let pHTotal = (low + high) / 2;
  let residualMolKg = residualAtPH(pHTotal);
  let iterations = 0;
  for (iterations = 1; iterations <= MAX_ITERATIONS; iterations += 1) {
    pHTotal = (low + high) / 2;
    residualMolKg = residualAtPH(pHTotal);
    if (Math.abs(residualMolKg) <= ALKALINITY_RESIDUAL_TOLERANCE_MOL_KG) break;
    if (residualMolKg > 0) {
      high = pHTotal;
      highResidual = residualMolKg;
    } else {
      low = pHTotal;
      lowResidual = residualMolKg;
    }
  }
  if (Math.abs(residualMolKg) > ALKALINITY_RESIDUAL_TOLERANCE_MOL_KG) {
    const result = diagnosticBase(inputs, 'MAX_ITERATIONS',
      'alkalinity-root-did-not-converge-within-the-bounded-iteration-budget');
    result.closure = {
      iterations: MAX_ITERATIONS,
      pHBracket: [round(low, 12), round(high, 12)],
      alkalinityResidualMolKg: round(residualMolKg, 15)
    };
    return result;
  }
  const species = speciate(Math.pow(10, -pHTotal), dicMolKg,
    totalPhosphateMolKg, constants);
  const reconstructedDicMolKg = species.co2StarMolKg +
    species.bicarbonateMolKg + species.carbonateMolKg;
  const dicResidualMolKg = reconstructedDicMolKg - dicMolKg;
  const phosphateResidualMolKg = species.phosphoricAcidMolKg +
    species.dihydrogenPhosphateMolKg + species.hydrogenPhosphateMolKg +
    species.phosphateMolKg - totalPhosphateMolKg;
  const result = diagnosticBase(inputs, 'SOLVED',
    'bounded-total-scale-surface-pressure-equilibrium');
  result.solution = {
    pHTotal: round(pHTotal, 9),
    dicUmolKg: round(dicMolKg * 1e6, 6),
    totalAlkalinityUmolKg: round(totalAlkalinityMolKg * 1e6, 6),
    totalPhosphateUmolKg: round(totalPhosphateMolKg * 1e6, 6),
    equilibriumConstants: {
      k1MolKg: round(constants.k1, 15),
      k2MolKg: round(constants.k2, 15),
      kBmolKg: round(constants.kB, 15),
      kWmol2Kg2: round(constants.kW, 18),
      kP1molKg: round(constants.kP1, 15),
      kP2molKg: round(constants.kP2, 15),
      kP3molKg: round(constants.kP3, 15),
      totalBoronUmolKg: round(constants.totalBoronMolKg * 1e6, 6)
    },
    speciesUmolKg: {
      co2Star: round(species.co2StarMolKg * 1e6, 6),
      bicarbonate: round(species.bicarbonateMolKg * 1e6, 6),
      carbonate: round(species.carbonateMolKg * 1e6, 6),
      borate: round(species.borateMolKg * 1e6, 6),
      hydroxide: round(species.hydroxideMolKg * 1e6, 6),
      phosphoricAcid: round(species.phosphoricAcidMolKg * 1e6, 6),
      dihydrogenPhosphate: round(species.dihydrogenPhosphateMolKg * 1e6, 6),
      hydrogenPhosphate: round(species.hydrogenPhosphateMolKg * 1e6, 6),
      phosphate: round(species.phosphateMolKg * 1e6, 6)
    },
    alkalinityComponentsUmolKg: {
      carbonate: round(species.carbonateAlkalinityMolKg * 1e6, 6),
      borate: round(species.borateMolKg * 1e6, 6),
      water: round((species.hydroxideMolKg - Math.pow(10, -pHTotal)) * 1e6, 6),
      phosphate: round(species.phosphateAlkalinityMolKg * 1e6, 6)
    }
  };
  result.closure = {
    iterations,
    pHBracket: [round(low, 12), round(high, 12)],
    dicResidualMolKg: round(dicResidualMolKg, 15),
    phosphateResidualMolKg: round(phosphateResidualMolKg, 15),
    alkalinityResidualMolKg: round(residualMolKg, 15),
    alkalinityToleranceMolKg: ALKALINITY_RESIDUAL_TOLERANCE_MOL_KG
  };
  result.truth.constantsWithinPublishedEnvelope = true;
  result.truth.carbonateMassClosed = Math.abs(dicResidualMolKg) <= 1e-15;
  result.truth.phosphateMassClosed = Math.abs(phosphateResidualMolKg) <= 1e-15;
  result.truth.alkalinityResidualClosed =
    Math.abs(residualMolKg) <= ALKALINITY_RESIDUAL_TOLERANCE_MOL_KG;
  return result;
}

export function carbonateSystemDescription() {
  return {
    schema: MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA,
    constantSet: MIXED_LAYER_CARBONATE_CONSTANT_SET,
    inputs: [
      'mixed-layer-dissolved-inorganic-carbon-owner',
      'mixed-layer-total-alkalinity-owner',
      'mixed-layer-dissolved-inorganic-phosphorus-owner',
      'mixed-layer-depth-temperature-and-salinity'
    ],
    outputs: ['total-scale-pH', 'CO2-star', 'bicarbonate', 'carbonate'],
    mutatesMaterial: false,
    maximumIterations: MAX_ITERATIONS,
    waterMassConversion: 'mixed-layer-depth-times-1000-kg-m3-reference-density',
    omitted: [
      'silicate-alkalinity',
      'fluoride-alkalinity',
      'sulfide-alkalinity',
      'ammonia-alkalinity',
      'pressure-corrections',
      'calcium-and-mineral-saturation',
      'pH-feedback-on-biogeochemistry',
      'deep-ocean-pH'
    ],
    measuredInputsClaimed: false,
    scientificEarthModel: false
  };
}
