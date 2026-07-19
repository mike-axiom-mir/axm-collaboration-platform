import { BIOMES, CONDITION_PROFILES, PLANET_DEFAULTS, offsetLatLon, sampleLatLon, sectorKey } from './planet-model.mjs';
import { candidatesFor, chooseSpecies } from './species-catalog.mjs';
import { buildRegionalCommunity } from './community-model.mjs';
import { buildSeasonalWeather } from './seasonal-weather.mjs';
import { applyIntervention as applyDynamicsIntervention, initializeDynamics, stepDynamics } from './ecosystem-dynamics.mjs';

export const LIVING_SCHEMA = 'axm.foundation-planet.living-state/v1';

function mix32(value) {
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function seedFromText(text, seed) {
  let value = seed >>> 0;
  for (let i = 0; i < text.length; i++) value = mix32(value ^ text.charCodeAt(i));
  return value || 1;
}

function randomFactory(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export class LivingSystem {
  constructor(options = {}) {
    const restored = options.state && options.state.schema === LIVING_SCHEMA ? options.state : null;
    this.seed = Number.isFinite(options.seed) ? options.seed : PLANET_DEFAULTS.seed;
    this.profileId = options.profileId || restored?.profileId || 'temperate';
    this.ageDays = Number(restored?.ageDays ?? options.ageDays ?? 0);
    this.sectorSizeKm = Number(restored?.sectorSizeKm ?? options.sectorSizeKm ?? 120);
    this.maxVegetation = Number(options.maxVegetation || 520);
    this.interventions = Array.isArray(restored?.interventions) ? restored.interventions.slice(-5000) : Array.isArray(options.interventions) ? options.interventions.slice(-5000) : [];
    this.regionalStates = restored?.regionalStates && typeof restored.regionalStates === 'object' ? JSON.parse(JSON.stringify(restored.regionalStates)) : {};
  }

  setProfile(profileId) { this.profileId = CONDITION_PROFILES[profileId] ? profileId : 'temperate'; }
  advance(days) { this.ageDays = Math.max(0, this.ageDays + Math.max(0, Number(days) || 0)); }

  buildSector(centerLat, centerLon, options = {}) {
    const key = sectorKey(centerLat, centerLon);
    const random = randomFactory(seedFromText(key, this.seed));
    const profile = CONDITION_PROFILES[this.profileId];
    const candidates = Math.round(this.maxVegetation * Math.max(0.15, profile.lifeAbundance));
    const vegetation = [], fauna = [], soil = [];
    for (let i = 0; i < candidates; i++) {
      const xKm = (random() - 0.5) * this.sectorSizeKm;
      const zKm = (random() - 0.5) * this.sectorSizeKm;
      const where = offsetLatLon(centerLat, centerLon, xKm, zKm);
      const sample = sampleLatLon(where.lat, where.lon, { seed: this.seed, profile });
      const biome = BIOMES[sample.biome];
      if (!sample.land || random() > sample.habitability * 0.82) continue;
      const species = chooseSpecies(sample, 'vegetation', random());
      if (!species) continue;
      const ageYears = 2 + random() * 90;
      const crowdStress = Math.max(0, (vegetation.length / Math.max(1, candidates)) - 0.72);
      vegetation.push({
        id: `${key}:v:${i}`, xKm, zKm, lat: where.lat, lon: where.lon,
        elevationM: sample.elevationM, biome: sample.biome,
        species: species.id, commonName: species.commonName, trophicRole: species.trophicRole,
        ageYears, heightM: (3 + random() * 22) * (0.55 + biome.vegetation * 0.65),
        health: Math.max(0.18, Math.min(1, 0.58 + sample.moisture * 0.5 - crowdStress * 0.7)),
        generated: true
      });
      if (soil.length < 180 && random() < 0.42) {
        const decomposer = chooseSpecies(sample, 'decomposers', random());
        if (decomposer) soil.push({ xKm, zKm, activity: sample.moisture * (0.5 + random() * 0.5), species: decomposer.id, commonName: decomposer.commonName });
      }
    }
    /* A planet sector needs two ecological fidelities at once. The regional
       pass above preserves a broad population field; this focus pass gives
       the active expedition individual organisms without pretending the
       entire 14,400 km² sector is simulated at that fidelity. */
    const focusSizeKm = 3;
    const focusCandidates = Math.round(900 * Math.max(0.15, profile.lifeAbundance));
    for (let i = 0; i < focusCandidates; i++) {
      const xKm = (random() - 0.5) * focusSizeKm;
      const zKm = (random() - 0.5) * focusSizeKm;
      const where = offsetLatLon(centerLat, centerLon, xKm, zKm);
      const sample = sampleLatLon(where.lat, where.lon, { seed: this.seed, profile });
      const biome = BIOMES[sample.biome];
      if (!sample.land || random() > sample.habitability * 0.72) continue;
      const species = chooseSpecies(sample, 'vegetation', random());
      if (!species) continue;
      const ageYears = 1 + random() * 110;
      vegetation.push({
        id: `${key}:focus-v:${i}`, xKm, zKm, lat: where.lat, lon: where.lon,
        elevationM: sample.elevationM, biome: sample.biome,
        species: species.id, commonName: species.commonName, trophicRole: species.trophicRole, ageYears,
        heightM: (2.5 + random() * 24) * (0.5 + biome.vegetation * 0.72),
        health: Math.max(0.18, Math.min(1, 0.55 + sample.moisture * 0.48)),
        generated: true, fidelity: 'focus-individual'
      });
      if (soil.length < 520 && random() < 0.78) {
        const decomposer = chooseSpecies(sample, 'decomposers', random());
        if (decomposer) soil.push({ xKm, zKm, activity: sample.moisture * (0.5 + random() * 0.5), species: decomposer.id, commonName: decomposer.commonName, fidelity: 'focus-individual' });
      }
    }
    const center = sampleLatLon(centerLat, centerLon, { seed: this.seed, profile });
    const centerProductivity = center.ecology?.productivity ?? center.habitability;
    if (!center.land && centerProductivity > 0) {
      const marineFocusCount = Math.round(240 * centerProductivity * Math.max(.15, profile.lifeAbundance));
      for (let i = 0; i < marineFocusCount; i++) {
        const angle = i * 2.399963229728653;
        const radiusKm = Math.sqrt((i + .5) / Math.max(1, marineFocusCount)) * 1.2;
        const xKm = Math.cos(angle) * radiusKm;
        const zKm = Math.sin(angle) * radiusKm;
        const where = offsetLatLon(centerLat, centerLon, xKm, zKm);
        const sample = sampleLatLon(where.lat, where.lon, { seed: this.seed, profile });
        if (sample.land || random() > (sample.ecology?.productivity || 0) * .9) continue;
        const producer = chooseSpecies(sample, 'vegetation', random());
        if (producer) vegetation.push({
          id: `${key}:marine-v:${i}`, xKm, zKm, lat: where.lat, lon: where.lon,
          elevationM: sample.elevationM, biome: sample.biome,
          species: producer.id, commonName: producer.commonName, trophicRole: producer.trophicRole,
          ageYears: random() * Math.max(.02, producer.lifespanYears), heightM: .2 + random() * 2.8,
          health: Math.max(.2, Math.min(1, .45 + (sample.ecology?.productivity || 0) * .65)),
          generated: true, fidelity: 'marine-focus-organism'
        });
        if (soil.length < 320 && random() < .72) {
          const decomposer = chooseSpecies(sample, 'decomposers', random());
          if (decomposer) soil.push({
            xKm, zKm, activity: (sample.ecology?.productivity || 0) * (.5 + random() * .5),
            species: decomposer.id, commonName: decomposer.commonName, fidelity: 'marine-focus-organism'
          });
        }
      }
    }
    const faunaCount = Math.round(centerProductivity * 18);
    const faunaCandidates = candidatesFor(center, 'fauna');
    for (let i = 0; i < faunaCount; i++) {
      if (!faunaCandidates.length) break;
      const species = chooseSpecies(center, 'fauna', random());
      if (!species) continue;
      const groupBase = species.social === 'solitary' ? 1 : species.social === 'pair' ? 2 : species.social === 'pack' || species.social === 'small-group' ? 3 : species.social === 'herd' ? 7 : 5;
      const aquaticAltitudeM = species.locomotion === 'swim' ? Math.max(2, Math.min(9000, Math.max(0, -center.elevationM) * 1.55)) : 0;
      fauna.push({
        id: `${key}:f:${i}`, phase: random() * Math.PI * 2,
        radiusKm: 0.5 + random() * 4.5, altitudeM: species.locomotion === 'fly' ? 35 + random() * 170 : aquaticAltitudeM,
        speed: 0.06 + random() * 0.2, kind: species.locomotion === 'fly' ? 'flock' : species.locomotion === 'swim' ? 'aquatic' : species.behavior === 'graze' || species.behavior === 'browse' ? 'grazer' : 'wildlife',
        species: species.id, commonName: species.commonName, trophicRole: species.trophicRole,
        realms: species.realms,
        behavior: species.behavior, locomotion: species.locomotion, activity: species.activity,
        bodyMassKg: species.bodyMassKg, groupSize: Math.max(1, Math.round(groupBase * (.65 + random() * .8)))
      });
    }
    const observedSpecies = [...new Set([
      ...vegetation.map(item => item.species), ...fauna.map(item => item.species), ...soil.map(item => item.species)
    ].filter(Boolean))];
    const guilds = {};
    [...vegetation, ...fauna].forEach(item => { guilds[item.trophicRole] = (guilds[item.trophicRole] || 0) + 1; });
    const dayOfYear = Number(options.dayOfYear ?? (this.ageDays % 365.25));
    const regional = buildRegionalCommunity(center, { areaKm2: this.sectorSizeKm * this.sectorSizeKm, dayOfYear });
    const weather = buildSeasonalWeather(centerLat, centerLon, center, { dayOfYear, profile, seed: this.seed });
    let dynamics = this.regionalStates[key] || initializeDynamics(key, regional, this.ageDays);
    const missingDays = Math.max(0, this.ageDays - dynamics.lastUpdatedAgeDays);
    if (missingDays > 0) dynamics = stepDynamics(dynamics, weather, missingDays, { regionalCommunity: regional }).state;
    this.regionalStates[key] = dynamics;
    const dynamicsResult = stepDynamics(dynamics, weather, 0, { regionalCommunity: regional });
    return {
      schema: LIVING_SCHEMA, key, center: { lat: centerLat, lon: centerLon }, vegetation, fauna, soil,
      fidelity: { regionalSectorKm: this.sectorSizeKm, focusSectorKm: focusSizeKm, distantPopulations: 'statistical', focusOrganisms: 'individual' },
      community: { observedSpecies, observedSpeciesCount: observedSpecies.length, guilds, regional, dynamics: dynamicsResult.summary },
      environment: weather,
      generatedAtAgeDays: this.ageDays
    };
  }

  updateSector(sector, environment, elapsedDays) {
    if (!sector?.key || !sector.community?.regional) return null;
    const current = this.regionalStates[sector.key] || initializeDynamics(sector.key, sector.community.regional, this.ageDays - elapsedDays);
    const result = stepDynamics(current, environment, elapsedDays, { regionalCommunity: sector.community.regional });
    this.regionalStates[sector.key] = result.state;
    sector.community.dynamics = result.summary;
    sector.environment = environment;
    return result;
  }

  recordIntervention(sectorKeyValue, intervention) {
    const current = this.regionalStates[sectorKeyValue];
    if (!current) throw new Error('sector dynamics must be loaded before intervention');
    const result = applyDynamicsIntervention(current, { ...intervention, atAgeDays: this.ageDays });
    this.regionalStates[sectorKeyValue] = result.state;
    this.interventions.push({ ...result.record, sectorKey: sectorKeyValue });
    this.interventions = this.interventions.slice(-5000);
    return result;
  }

  snapshot() {
    const regionalStates = Object.fromEntries(Object.entries(this.regionalStates)
      .sort((a, b) => Number(b[1]?.lastUpdatedAgeDays || 0) - Number(a[1]?.lastUpdatedAgeDays || 0))
      .slice(0, 100));
    return {
      schema: LIVING_SCHEMA, seed: this.seed, profileId: this.profileId,
      ageDays: this.ageDays, sectorSizeKm: this.sectorSizeKm,
      interventions: this.interventions.slice(0, 5000),
      regionalStates,
      ecology: {
        deterministicWildPopulations: true, localSectorStreaming: true,
        growthClock: true, crowdingPressure: true, conditionResponse: true,
        seasonalWeather: true, regionalBirthsDeaths: true, predationPressure: true,
        migration: true, persistentVisitedSectors: true, governedInterventions: true,
        terrestrialFreshwaterMarineRealms: true, catalogLifeHistory: true,
        scientificModel: false
      }
    };
  }
}
