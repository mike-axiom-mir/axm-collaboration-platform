'use strict';

const assert = require('assert');
const Organ = require('../organs/world-genome-organ');

const request = { parentGenome: Organ.BASELINE, generation: 4, count: 5, lineageSeed: 'test-lineage' };
const first = Organ.originate(request);
const second = Organ.originate(request);

assert.equal(first.ok, true);
assert.equal(first.schema, Organ.SCHEMA);
assert.equal(first.candidates.length, 5);
assert.deepEqual(first, second, 'same lineage, parent and generation must reproduce the same challengers');
assert.deepEqual(Organ.BASELINE, request.parentGenome, 'candidate generation must not mutate the parent object');
assert(first.candidates.every(candidate => Organ.validateGenome(candidate.genome).ok));
assert(first.candidates.every(candidate => candidate.mutations.length >= 1));
assert.equal(new Set(first.candidates.map(candidate => candidate.genomeDigest)).size, 5);
assert.equal(first.organ.selfModification, 'DISPOSABLE_WORLD_GENOME_ONLY');
assert.equal(first.organ.liveWorkshopAuthority, false);

const broken = Organ.originate({ parentGenome: Object.assign({}, Organ.BASELINE, { mature: 17, lifespan: 28, seedFrom: 27 }) });
assert.equal(broken.ok, false);
assert(broken.errors.length > 0);

console.log('world genome organ selftest: PASS (11 assertions)');
