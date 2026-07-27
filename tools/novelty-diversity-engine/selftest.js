#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Novelty = require('../../shared/operations/novelty-diversity-service');

const PREFIX = 'axm-novelty-selftest-';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
const root = path.join(temp, 'workshop');
const options = { root, stateRoot: path.join(root, 'state'), exportRoot: path.join(root, 'exports') };
let pass = 0;

function check(label, run) {
  run();
  pass += 1;
  console.log('PASS  ' + label);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function cleanup() {
  const resolved = path.resolve(temp), allowedRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowedRoot) || !path.basename(resolved).startsWith(PREFIX)) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}

try {
  fs.mkdirSync(options.stateRoot, { recursive: true });
  fs.mkdirSync(options.exportRoot, { recursive: true });

  const manifest = readJson('manifest.json');
  const contract = readJson('module.contract.json');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const novelty = Novelty.create(options);
  const candidates = [
    { id: 'candidate-a', descriptor: { speed: 0.1, social: 0.9 }, quality: 4, structure: ['sensor'] },
    { id: 'candidate-b', descriptor: { speed: 0.9, social: 0.1 }, quality: 5, structure: ['loop'] },
    { id: 'candidate-c', descriptor: { speed: 0.5, social: 0.5 }, quality: 6, structure: ['memory'] }
  ];

  check('manifest and contract keep experiments non-authoritative', () => {
    assert.equal(manifest.id, 'novelty-diversity-engine');
    assert.equal(contract.id, manifest.id);
    assert.deepStrictEqual(contract.permissions, manifest.permissions);
    assert(contract.boundaries.refuses.includes('automatic-inheritance'));
    assert(contract.boundaries.refuses.includes('world-mutation'));
    assert(contract.boundaries.refuses.includes('non-reproducible-seed'));
  });

  check('distance is symmetric and handles absent dimensions deterministically', () => {
    const forward = Novelty.distance({ speed: 1, social: 0 }, { speed: 0, memory: 1 });
    const reverse = Novelty.distance({ speed: 0, memory: 1 }, { speed: 1, social: 0 });
    assert.equal(forward, reverse);
    assert(Number.isFinite(forward) && forward > 0);
    assert.equal(Novelty.distance({}, {}), 0);
  });

  check('seeded proposal randomness repeats exactly', () => {
    const first = Novelty.seeded('repeatable-seed');
    const second = Novelty.seeded('repeatable-seed');
    assert.deepStrictEqual([first(), first(), first()], [second(), second(), second()]);
  });

  check('invalid candidate sets are refused', () => {
    assert.throws(() => novelty.run({ candidates: [candidates[0]] }, 'selftest'), /at least two candidates/);
    assert.throws(() => novelty.run({ candidates: [{ id: 'empty-a' }, { id: 'empty-b' }] }, 'selftest'), /needs numeric descriptor dimensions/);
  });

  const first = novelty.run({ title: 'Repeatable exploration', seed: 'repeatable', neighbors: 2, bins: 8, candidates }, 'selftest');
  const second = novelty.run({ title: 'Repeatable exploration', seed: 'repeatable', neighbors: 2, bins: 8, candidates }, 'selftest');

  check('behavioral candidates become finite scored niches', () => {
    assert.equal(first.candidateCount, 3);
    assert(first.niches >= 2);
    assert(first.archive.every(item => Number.isFinite(item.novelty)));
    assert.deepStrictEqual(first.dimensions, ['social', 'speed']);
  });

  check('same seed and candidates produce the same structural proposals', () => {
    assert.deepStrictEqual(first.proposals.map(item => item.structure), second.proposals.map(item => item.structure));
    assert.deepStrictEqual(first.proposals.map(item => item.parentId), second.proposals.map(item => item.parentId));
  });

  check('proposals carry no inheritance or world-mutation authority', () => {
    assert.equal(first.automaticInheritance, false);
    assert.equal(first.worldMutationAuthority, false);
    assert(first.proposals.every(item => item.mutation === 'structural' && item.applyAuthority === false));
  });

  check('experiment history persists without changing authority truth', () => {
    const status = novelty.status();
    assert.equal(status.experiments.length, 2);
    assert.equal(status.latest.id, second.id);
    assert.equal(status.automaticInheritance, false);
    assert.equal(status.worldMutationAuthority, false);
  });

  check('browser surface submits an explicitly seeded experiment', () => {
    assert(app.includes("O.post('/api/novelty-diversity/run'"));
    assert(app.includes("'x-axm-novelty':'explicit-experiment'"));
    assert(app.includes('proposals remain unapplied'));
  });

  console.log('Novelty & Diversity Engine selftest: PASS (' + pass + ' controls)');
} finally {
  cleanup();
}
