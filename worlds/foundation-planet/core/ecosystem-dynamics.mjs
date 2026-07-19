import { speciesById } from './species-catalog.mjs';

export const DYNAMICS_SCHEMA = 'axm.foundation-planet.ecosystem-dynamics/v1';
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const clone = value => JSON.parse(JSON.stringify(value));

function cohortSnapshot(row) {
  if (row?.cohorts && ['juvenile','adult','senescent'].every(key => Number.isFinite(row.cohorts[key]))) return row.cohorts;
  const total = Math.max(0, Number(row?.abundance || 0));
  return { juvenile: total * .24, adult: total * .66, senescent: total * .1 };
}

export function initializeDynamics(sectorKey, regionalCommunity, ageDays = 0) {
  return {
    schema: DYNAMICS_SCHEMA, sectorKey, initializedAtAgeDays: ageDays, lastUpdatedAgeDays: ageDays,
    producerBiomassTons: regionalCommunity.producerBiomassTons,
    animalPopulations: Object.fromEntries(regionalCommunity.animalPopulations.map(item => [item.species, {
      abundance: item.abundanceEstimate, carryingCapacity: item.carryingCapacity,
      cohorts: { juvenile: item.abundanceEstimate * .24, adult: item.abundanceEstimate * .66, senescent: item.abundanceEstimate * .1 },
      births: 0, naturalDeaths: 0, predationDeaths: 0, migrationNet: 0
    }])),
    decomposerActivity: regionalCommunity.summary.decompositionCapacity,
    disturbance: { activeFire: false, burnedFraction: 0, recovery: 1 },
    interventions: [], events: []
  };
}

function populationSummary(state) {
  const rows = Object.values(state.animalPopulations);
  const total = rows.reduce((sum, row) => sum + row.abundance, 0);
  const ageCohorts = rows.reduce((totals, row) => {
    const cohorts = cohortSnapshot(row);
    totals.juvenile += cohorts.juvenile; totals.adult += cohorts.adult; totals.senescent += cohorts.senescent;
    return totals;
  }, { juvenile: 0, adult: 0, senescent: 0 });
  const roundedTotal = Math.max(0, Math.round(total));
  const roundedJuvenile = Math.min(roundedTotal, Math.max(0, Math.round(ageCohorts.juvenile)));
  const roundedAdult = Math.min(roundedTotal - roundedJuvenile, Math.max(0, Math.round(ageCohorts.adult)));
  return {
    animalPopulationEstimate: roundedTotal,
    producerBiomassTons: Math.max(0, state.producerBiomassTons),
    births: Math.round(rows.reduce((sum, row) => sum + row.births, 0)),
    deaths: Math.round(rows.reduce((sum, row) => sum + row.naturalDeaths + row.predationDeaths, 0)),
    migrationNet: Math.round(rows.reduce((sum, row) => sum + row.migrationNet, 0)),
    ageCohorts: { juvenile: roundedJuvenile, adult: roundedAdult, senescent: roundedTotal - roundedJuvenile - roundedAdult },
    activeFire: state.disturbance.activeFire, burnedFraction: state.disturbance.burnedFraction,
    interventionCount: state.interventions.length
  };
}

export function stepDynamics(input, environment, elapsedDays, options = {}) {
  const state = clone(input), days = clamp(Number(elapsedDays || 0), 0, 120);
  if (!days) return { state, summary: populationSummary(state), event: null };
  const regional = options.regionalCommunity || null;
  const habitatCommunity = new Map((regional?.animalPopulations || []).map(item => [item.species, item]));
  habitatCommunity.forEach((item, speciesId) => {
    if (!state.animalPopulations[speciesId]) state.animalPopulations[speciesId] = {
      abundance: 0, carryingCapacity: item.carryingCapacity,
      cohorts: { juvenile: 0, adult: 0, senescent: 0 },
      births: 0, naturalDeaths: 0, predationDeaths: 0, migrationNet: 0
    };
  });
  const populations = Object.entries(state.animalPopulations);
  const herbivoreTotal = populations.filter(([id]) => /herbivore|browser|aquatic-forager|filter-feeder|zooplankton/.test(speciesById(id)?.trophicRole || '')).reduce((sum, [, row]) => sum + row.abundance, 0);
  const predatorTotal = populations.filter(([id]) => /predator/.test(speciesById(id)?.trophicRole || '')).reduce((sum, [, row]) => sum + row.abundance, 0);
  let event = null;

  for (const [speciesId, row] of populations) {
    const species = speciesById(speciesId);
    if (!species) continue;
    const habitatMatch = habitatCommunity.get(speciesId);
    const habitatMismatch = regional && !habitatMatch ? 1 : 0;
    const capacityPrior = habitatMatch?.carryingCapacity ?? (regional ? 1 : row.carryingCapacity);
    const climateStress = clamp(environment.droughtIndex * .5 + environment.snowpackMm / 2400 + Math.max(0, Math.abs(environment.seasonalTemperatureC - (species.temperatureC[0] + species.temperatureC[1]) / 2) - 18) / 35 + habitatMismatch * .55);
    const fireStress = state.disturbance.activeFire ? state.disturbance.burnedFraction * .7 : 0;
    row.carryingCapacity = Math.max(1, capacityPrior * (1 - climateStress * .45) * (1 - fireStress));
    const fecundityFactor = clamp(.65 + Math.log10(Math.max(1, Number(species.offspringPerEvent || 1)) + 1) * .22, .65, 1.8);
    const birthRateDay = (1 / Math.max(18, species.reproductionDays)) * .36 * fecundityFactor * (1 - climateStress);
    const naturalDeathRateDay = 1 / Math.max(365, species.lifespanYears * 365) + climateStress * .00045 + fireStress * .002;
    const densityPressure = clamp(Math.max(0, row.abundance / row.carryingCapacity - 1) * .0018, 0, .012);
    const preyRole = /herbivore|browser|aquatic-forager|filter-feeder|zooplankton|pollinator|amphibian/.test(species.trophicRole);
    const predationRate = preyRole && herbivoreTotal > 0 ? clamp(predatorTotal / herbivoreTotal * .035, 0, .0022) : 0;
    const migrationRate = species.behavior === 'migrate' ? (environment.season === 'winter' ? -.0014 : environment.season === 'spring' ? .001 : 0) : 0;
    const births = row.abundance * birthRateDay * days;
    const naturalDeaths = row.abundance * (naturalDeathRateDay + densityPressure) * days;
    const predationDeaths = row.abundance * predationRate * days;
    let migration = row.abundance * migrationRate * days;
    if (habitatMismatch) migration -= row.abundance * .008 * days;
    else if (habitatMatch && row.abundance < row.carryingCapacity * .12) {
      migration += Math.min(row.carryingCapacity * .0015 * days, row.carryingCapacity * .12 - row.abundance);
    }
    const cohorts = cohortSnapshot(row);
    const maturityDays = Math.max(20, species.maturityYears * 365.25);
    const adultSpanDays = Math.max(180, (species.lifespanYears - species.maturityYears) * 365.25 * .72);
    const maturation = Math.min(cohorts.juvenile, cohorts.juvenile / maturityDays * days);
    const senescence = Math.min(cohorts.adult, cohorts.adult / adultSpanDays * days);
    const lossRate = clamp((naturalDeaths + predationDeaths) / Math.max(1, row.abundance), 0, 1);
    cohorts.juvenile = Math.max(0, cohorts.juvenile + births - maturation - cohorts.juvenile * lossRate * .82);
    cohorts.adult = Math.max(0, cohorts.adult + maturation - senescence + migration - cohorts.adult * lossRate * .82);
    cohorts.senescent = Math.max(0, cohorts.senescent + senescence - cohorts.senescent * lossRate * 2.18);
    row.abundance = Math.max(0, row.abundance + births - naturalDeaths - predationDeaths + migration);
    const cohortTotal = cohorts.juvenile + cohorts.adult + cohorts.senescent;
    const cohortScale = cohortTotal > 0 ? row.abundance / cohortTotal : 0;
    row.cohorts = {
      juvenile: cohorts.juvenile * cohortScale,
      adult: cohorts.adult * cohortScale,
      senescent: cohorts.senescent * cohortScale
    };
    row.births += births; row.naturalDeaths += naturalDeaths; row.predationDeaths += predationDeaths; row.migrationNet += migration;
  }

  const productivity = clamp((environment.seasonalTemperatureC + 8) / 32) * (1 - environment.droughtIndex) * (1 - state.disturbance.burnedFraction * .8);
  const producerTarget = regional?.producerBiomassTons ?? state.producerBiomassTons;
  const habitatBiomassPressure = clamp((producerTarget - state.producerBiomassTons) / Math.max(1, producerTarget, state.producerBiomassTons), -1, 1) * .003;
  state.producerBiomassTons = Math.max(0, state.producerBiomassTons + state.producerBiomassTons * (.00035 * productivity - .00018 * environment.droughtIndex + habitatBiomassPressure) * days);
  state.decomposerActivity = clamp(state.decomposerActivity * .88 + clamp(environment.humidity * clamp((environment.seasonalTemperatureC + 5) / 30)) * .12);

  if (environment.naturalIgnition && !state.disturbance.activeFire) {
    const severity = clamp(environment.fireRisk * (.45 + environment.windSpeedMps / 55), .12, .88);
    state.disturbance.activeFire = true; state.disturbance.burnedFraction = severity * .08; state.disturbance.recovery = 0;
    event = { type: 'natural-wildfire', severity, atAgeDays: state.lastUpdatedAgeDays + days };
    state.events.push(event);
  } else if (state.disturbance.activeFire) {
    const suppression = environment.precipitation.mmHour > 1 ? .12 : .018;
    state.disturbance.burnedFraction = clamp(state.disturbance.burnedFraction + environment.fireRisk * .006 * days);
    if (environment.fireRisk < .35 || environment.precipitation.mmHour > 4) state.disturbance.activeFire = false;
    state.disturbance.recovery = clamp(state.disturbance.recovery + suppression * days);
  } else {
    state.disturbance.recovery = clamp(state.disturbance.recovery + .0015 * days);
    state.disturbance.burnedFraction = Math.max(0, state.disturbance.burnedFraction - .00012 * days);
  }
  state.lastUpdatedAgeDays += days;
  state.events = state.events.slice(-120);
  return { state, summary: populationSummary(state), event };
}

export function applyIntervention(input, intervention) {
  const allowed = ['prescribed-burn','restore-habitat','plant-native','population-protection'];
  if (!allowed.includes(intervention?.type)) throw new Error('unsupported ecosystem intervention');
  const state = clone(input), severity = clamp(Number(intervention.severity || .25), .01, 1);
  const record = {
    id: intervention.id || `intervention-${state.interventions.length + 1}`,
    type: intervention.type, severity, actor: String(intervention.actor || 'unknown'),
    atAgeDays: Number(intervention.atAgeDays ?? state.lastUpdatedAgeDays), governed: true
  };
  if (record.type === 'prescribed-burn') {
    state.disturbance.activeFire = true; state.disturbance.burnedFraction = Math.max(state.disturbance.burnedFraction, severity * .05); state.disturbance.recovery = 0;
  } else if (record.type === 'restore-habitat' || record.type === 'plant-native') {
    state.producerBiomassTons *= 1 + severity * .03;
    state.disturbance.recovery = clamp(state.disturbance.recovery + severity * .2);
  } else if (record.type === 'population-protection') {
    Object.values(state.animalPopulations).forEach(row => { row.carryingCapacity *= 1 + severity * .02; });
  }
  state.interventions.push(record); state.interventions = state.interventions.slice(-200);
  state.events.push({ type: 'governed-intervention', interventionId: record.id, atAgeDays: record.atAgeDays });
  return { state, record, summary: populationSummary(state) };
}

export function dynamicsSummary(state) { return populationSummary(state); }
