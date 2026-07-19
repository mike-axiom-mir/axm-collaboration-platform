'use strict';

const State = require('../kernel/state-language');

const SCHEMA = 'axm.mirror.world-genome-candidate-set/v1';
const ORGAN_ID = 'axm.mirror.organ.world-genome/seed-0';
const GENOME_SCHEMA = 'axm.grafthold.world-genome/v1';

const GENES = Object.freeze({
  mature: Object.freeze({ min: 3, max: 18, step: 1 }),
  lifespan: Object.freeze({ min: 28, max: 140, step: 4 }),
  seedFrom: Object.freeze({ min: 8, max: 90, step: 2 }),
  offspring: Object.freeze({ min: 1, max: 2.8, step: 0.1 }),
  crowdRadius: Object.freeze({ min: 1.2, max: 6.5, step: 0.25 }),
  crowdPenalty: Object.freeze({ min: 0.04, max: 0.7, step: 0.035 }),
  shadePenalty: Object.freeze({ min: 0.04, max: 0.8, step: 0.04 }),
  minCondition: Object.freeze({ min: 0.01, max: 0.65, step: 0.03 }),
  treeMinDist: Object.freeze({ min: 0.7, max: 5.5, step: 0.2 }),
  startTrees: Object.freeze({ min: 3, max: 48, step: 2 })
});

const BASELINE = Object.freeze({
  schema: GENOME_SCHEMA,
  mature: 8,
  lifespan: 60,
  seedFrom: 32,
  offspring: 1.2,
  crowdRadius: 3.2,
  crowdPenalty: 0.28,
  shadePenalty: 0.35,
  minCondition: 0.15,
  treeMinDist: 2.2,
  startTrees: 14
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function round(value, digits = 6) { const scale = Math.pow(10, digits); return Math.round(Number(value) * scale) / scale; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value))); }

function normalizeGenome(input) {
  const source = input && typeof input === 'object' ? input : {};
  const genome = { schema: GENOME_SCHEMA };
  Object.keys(GENES).forEach(key => {
    const rule = GENES[key];
    const fallback = BASELINE[key];
    const raw = Number.isFinite(Number(source[key])) ? Number(source[key]) : fallback;
    genome[key] = round(clamp(raw, rule.min, rule.max));
  });
  genome.mature = Math.round(genome.mature);
  genome.lifespan = Math.round(genome.lifespan);
  genome.seedFrom = Math.round(genome.seedFrom);
  genome.startTrees = Math.round(genome.startTrees);
  return genome;
}

function validateGenome(input) {
  const genome = normalizeGenome(input);
  const errors = [];
  if (genome.lifespan <= genome.mature + 8) errors.push('lifespan must leave an adult interval after maturity');
  if (genome.seedFrom < genome.mature) errors.push('seedFrom cannot precede maturity');
  if (genome.seedFrom >= genome.lifespan - 3) errors.push('seedFrom must leave time for reproduction before lifespan ends');
  if (genome.treeMinDist >= genome.crowdRadius * 1.7) errors.push('treeMinDist leaves no meaningful crowd-neighbour interval');
  return { ok: errors.length === 0, genome, errors };
}

function seedNumber(value) { return parseInt(State.digest(value, 8), 16) >>> 0; }
function random(seed) {
  let value = seed >>> 0;
  return function next() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function diff(parent, child) {
  return Object.keys(GENES).filter(key => parent[key] !== child[key]).map(key => ({ gene: key, before: parent[key], after: child[key], delta: round(child[key] - parent[key]) }));
}

function repairStructuralRelations(genome) {
  genome.lifespan = Math.max(genome.lifespan, genome.mature + 12);
  genome.seedFrom = clamp(genome.seedFrom, genome.mature, genome.lifespan - 4);
  genome.treeMinDist = Math.min(genome.treeMinDist, round(genome.crowdRadius * 1.6));
  return normalizeGenome(genome);
}

function mutate(parent, rng, mutationCount) {
  const keys = Object.keys(GENES);
  const child = clone(parent);
  const used = new Set();
  const target = Math.max(1, Math.min(keys.length, mutationCount));
  while (used.size < target) {
    const key = keys[Math.floor(rng() * keys.length)];
    if (used.has(key)) continue;
    used.add(key);
    const rule = GENES[key];
    const scale = 1 + Math.floor(rng() * 3);
    const direction = rng() < 0.5 ? -1 : 1;
    child[key] = round(clamp(child[key] + direction * rule.step * scale, rule.min, rule.max));
  }
  return repairStructuralRelations(child);
}

function originate(input = {}) {
  const checked = validateGenome(input.parentGenome || BASELINE);
  if (!checked.ok) return { ok: false, schema: SCHEMA, errors: checked.errors, parentGenome: checked.genome };
  const parent = checked.genome;
  const generation = Math.max(0, Math.floor(Number(input.generation) || 0));
  const count = Math.max(2, Math.min(8, Math.floor(Number(input.count) || 4)));
  const lineageSeed = String(input.lineageSeed || 'mirror-world-seed-0').slice(0, 160);
  const rng = random(seedNumber({ lineageSeed, generation, parent }));
  const candidates = [];
  const seen = new Set([State.digest(parent, 24)]);
  let guard = 0;
  while (candidates.length < count && guard++ < 200) {
    const mutationCount = 1 + Math.floor(rng() * Math.min(3, 1 + Math.floor(generation / 3)));
    const genome = mutate(parent, rng, mutationCount);
    const validation = validateGenome(genome);
    const digest = State.digest(validation.genome, 24);
    if (!validation.ok || seen.has(digest)) continue;
    seen.add(digest);
    candidates.push({ id: `world-challenger-g${generation + 1}-${digest.slice(0, 10)}`, parentDigest: State.digest(parent, 24), genomeDigest: digest, genome: validation.genome, mutations: diff(parent, validation.genome), status: 'PRIVATE_CHALLENGER' });
  }
  return {
    ok: candidates.length === count,
    schema: SCHEMA,
    status: 'EXPERIMENTAL',
    organ: { id: ORGAN_ID, kind: 'deterministic-inheritable-world-genome-organ', learnedWeights: false, toolAuthority: false, selfModification: 'DISPOSABLE_WORLD_GENOME_ONLY', liveWorkshopAuthority: false },
    lineageSeed,
    generation,
    parentGenome: parent,
    parentDigest: State.digest(parent, 24),
    candidates,
    structuralBoundary: { purpose: 'Keep genomes executable enough to be examined; it does not prescribe which viable ecology should win.', geneRanges: clone(GENES) },
    limitations: [
      'Candidate origination is seeded rule-based mutation, not open-ended imagination.',
      'This organ does not score, select, apply or canonize a candidate.',
      'Only the disposable experimental world genome may inherit a selected challenger.',
      'Source-code mutation, Mirror root mutation and Workshop mutation are outside this organ.'
    ]
  };
}

module.exports = { SCHEMA, ORGAN_ID, GENOME_SCHEMA, GENES, BASELINE, normalizeGenome, validateGenome, diff, originate };
