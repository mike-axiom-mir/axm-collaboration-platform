import { SPECIES_CATALOG_SCHEMA, candidatesFor } from './species-catalog.mjs';

export const COMMUNITY_SCHEMA = 'axm.foundation-planet.regional-community/v1';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const DENSITY_PER_KM2 = Object.freeze({
  'small-herbivore': 9.5, 'large-herbivore': .7, browser: .48, megaherbivore: .035,
  'semi-aquatic-herbivore': .55, 'apex-predator': .035, mesopredator: .18,
  'aquatic-predator': .08, 'aerial-predator': .12, insectivore: 3.2,
  'aquatic-forager': 1.5, scavenger: .11, omnivore: .34,
  'amphibian-insectivore': 11, pollinator: 42, 'pelagic-predator': .12,
  'marine-apex-predator': .004, 'marine-predator': .055,
  'marine-filter-feeder': .008, zooplankton: 1250, 'marine-herbivore': .035
});

function seasonFactor(species, sample, dayOfYear) {
  const latitudeStrength = clamp(sample.latitudeAbs * 1.2);
  const phase = Math.cos((Number(dayOfYear || 0) / 365.25) * Math.PI * 2);
  if (species.behavior === 'migrate') return clamp(.58 + phase * .35 * latitudeStrength, .12, 1);
  if (species.activity === 'diurnal' && sample.temperatureC < -10) return .72;
  return clamp(1 - Math.abs(phase) * latitudeStrength * .08, .78, 1);
}

function resourceLinks(faunaCandidates, plantCandidates) {
  const links = [];
  for (const consumer of faunaCandidates) {
    for (const diet of consumer.species.diet) {
      let resource = null;
      const faunaMatch = faunaCandidates.find(candidate => candidate.species.id !== consumer.species.id &&
        (candidate.species.trophicRole === diet || candidate.species.id.includes(diet)));
      const plantMatch = plantCandidates.find(candidate => candidate.species.id.includes(diet) ||
        (diet === 'grass' && /grass/.test(candidate.species.id)) ||
        (diet === 'leaves' && candidate.species.assetArchetype !== 'ground-cover') ||
        (diet === 'aquatic-plants' && /cattail|water-lily|seagrass|kelp/.test(candidate.species.id)) ||
        (diet === 'algae' && /phytoplankton|kelp|seagrass/.test(candidate.species.id)) ||
        (diet === 'plankton' && /phytoplankton/.test(candidate.species.id)));
      if (faunaMatch) resource = faunaMatch.species.id;
      else if (plantMatch) resource = plantMatch.species.id;
      else resource = `resource.${diet}`;
      links.push({ consumer: consumer.species.id, resource, diet, strength: consumer.score });
    }
  }
  return links;
}

export function buildRegionalCommunity(sample, options = {}) {
  const areaKm2 = Math.max(1, Number(options.areaKm2 || 14_400));
  const dayOfYear = Number(options.dayOfYear || 0);
  const ecosystemProductivity = sample.ecology?.productivity ?? sample.habitability;
  const plants = ecosystemProductivity > 0 ? candidatesFor(sample, 'vegetation') : [];
  const fauna = ecosystemProductivity > 0 ? candidatesFor(sample, 'fauna') : [];
  const decomposers = ecosystemProductivity > 0 ? candidatesFor(sample, 'decomposers') : [];
  const sampleRealms = sample.ecology?.realms || (sample.land ? ['terrestrial'] : ['marine']);
  const matchedRealms = species => species.realms.filter(realm => sampleRealms.includes(realm));
  const habitatTemperature = Number.isFinite(sample.ecology?.waterTemperatureC) ? sample.ecology.waterTemperatureC : sample.temperatureC;
  const netPrimaryProductivity = ecosystemProductivity <= 0 ? 0 : sample.land
    ? clamp(ecosystemProductivity * (.55 + sample.moisture * .65) * clamp((sample.temperatureC + 12) / 38), .02, 1.25)
    : clamp(ecosystemProductivity * (.48 + (sample.ecology?.marineMixing || 0) * .52), .01, 1.1);
  const producerBiomassTons = areaKm2 * netPrimaryProductivity * (sample.land ? 68 : 44);
  const plantScoreTotal = plants.reduce((sum, item) => sum + item.score, 0);

  const plantPopulations = plants.map(candidate => ({
    species: candidate.species.id, layer: 'vegetation', habitatScore: candidate.score,
    realms: matchedRealms(candidate.species), occupiedAreaKm2: areaKm2 * clamp(candidate.score * ecosystemProductivity * .72),
    biomassTons: producerBiomassTons * candidate.score / Math.max(.01, plantScoreTotal),
    seasonalFactor: seasonFactor(candidate.species, sample, dayOfYear)
  }));

  const animalPopulations = fauna.map(candidate => {
    const density = DENSITY_PER_KM2[candidate.species.trophicRole] || .22;
    const seasonal = seasonFactor(candidate.species, sample, dayOfYear);
    const trophicPenalty = /predator|scavenger/.test(candidate.species.trophicRole) ? .76 : 1;
    const abundanceEstimate = Math.max(1, Math.round(areaKm2 * density * candidate.score * ecosystemProductivity * seasonal * trophicPenalty));
    return {
      species: candidate.species.id, layer: 'fauna', trophicRole: candidate.species.trophicRole,
      realms: matchedRealms(candidate.species), habitatScore: candidate.score, seasonalFactor: seasonal, abundanceEstimate,
      biomassTons: abundanceEstimate * Math.max(.001, candidate.species.bodyMassKg || 1) / 1000,
      carryingCapacity: Math.max(1, Math.round(abundanceEstimate * (1.06 + netPrimaryProductivity * .48)))
    };
  });

  const decomposerActivity = decomposers.map(candidate => ({
    species: candidate.species.id, layer: 'decomposers', realms: matchedRealms(candidate.species), habitatScore: candidate.score,
    activityIndex: clamp(candidate.score * sample.moisture * clamp((habitatTemperature + 8) / 34)),
    processedBiomassTonsYear: producerBiomassTons * candidate.score * .018
  }));
  const links = resourceLinks(fauna, plants);
  const herbivoreBiomass = animalPopulations.filter(item => /herbivore|browser|aquatic-forager|filter-feeder|zooplankton/.test(item.trophicRole)).reduce((sum, item) => sum + item.biomassTons, 0);
  const predatorBiomass = animalPopulations.filter(item => /predator/.test(item.trophicRole)).reduce((sum, item) => sum + item.biomassTons, 0);
  const decompositionCapacity = decomposerActivity.reduce((sum, item) => sum + item.activityIndex, 0) / Math.max(1, decomposerActivity.length);
  const herbivorePressure = clamp(herbivoreBiomass / Math.max(1, producerBiomassTons * .025));
  const predatorSupport = clamp(herbivoreBiomass / Math.max(1, predatorBiomass * 18));
  const resilience = clamp(ecosystemProductivity * .45 + decompositionCapacity * .25 + (1 - Math.abs(.42 - herbivorePressure)) * .18 + predatorSupport * .12);
  const activeRealms = [...new Set([...plantPopulations, ...animalPopulations, ...decomposerActivity].flatMap(item => item.realms || []))];
  const keystoneSpecies = [...plants, ...fauna, ...decomposers].filter(candidate => candidate.species.keystoneRole).map(candidate => candidate.species.id);
  return {
    schema: COMMUNITY_SCHEMA, speciesCatalogSchema: SPECIES_CATALOG_SCHEMA,
    areaKm2, dayOfYear, netPrimaryProductivity, producerBiomassTons,
    plantPopulations, animalPopulations, decomposerActivity, foodWebLinks: links,
    summary: {
      plantSpecies: plantPopulations.length, animalSpecies: animalPopulations.length,
      decomposerSpecies: decomposerActivity.length,
      activeRealms, aquaticSpecies: [...plantPopulations, ...animalPopulations, ...decomposerActivity].filter(item => item.realms?.some(realm => /marine|freshwater|coastal/.test(realm))).length,
      keystoneSpecies,
      animalPopulationEstimate: animalPopulations.reduce((sum, item) => sum + item.abundanceEstimate, 0),
      herbivoreBiomassTons: herbivoreBiomass, predatorBiomassTons: predatorBiomass,
      herbivorePressure, predatorSupport, decompositionCapacity, resilience,
      balance: resilience > .66 ? 'resilient' : resilience > .4 ? 'pressured' : 'fragile'
    },
    truth: { statisticalPopulationTier: true, individualAnimalsRepresentSubset: true, scientificModel: false }
  };
}
