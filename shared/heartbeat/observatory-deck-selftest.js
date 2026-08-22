#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const path = require('path');
const Adapter = require('./axm-observatory-deck-adapter');

const root = path.resolve(__dirname, '..', '..');
const reviews = Adapter.REVIEWED_MODULES;
const deck = Adapter.checkDeck();

assert.equal(reviews.length, 18, 'the reviewed intake contains exactly eighteen modules');
assert.equal(new Set(reviews.map(item => item.id)).size, reviews.length, 'reviewed module IDs must be unique');
assert.equal(deck.length, reviews.length, 'every reviewed module must have one Heartbeat candidate');
assert.equal(new Set(deck.map(item => item.id)).size, deck.length, 'Heartbeat check IDs must be unique');
assert.throws(() => Adapter.reviewedModule('unknown-observatory'), /not allowlisted/);

let checks = 5;
for (const review of reviews) {
  assert.match(review.digest, /^[a-f0-9]{64}$/);
  const inspection = Adapter.inspect(root, review.id);
  assert.equal(inspection.status, 'READY', review.id + ': ' + inspection.reasons.join(', '));
  assert.equal(inspection.reviewedDigest, inspection.measuredDigest);
  assert(inspection.executionFiles >= 3);
  checks += 4;

  const candidate = deck.find(item => item.id === 'observatory-' + review.id);
  assert(candidate);
  assert.deepEqual(candidate.args, [Adapter.RUNNER, '--module', review.id, '--digest', review.digest]);
  assert.equal(candidate.repairAuthority, 'NONE');
  assert.equal(candidate.evidenceAuthority, 'REVIEWED_EXECUTION_SURFACE_ONLY');
  checks += 5;

  const result = childProcess.spawnSync(process.execPath, candidate.args, {
    cwd: root,
    windowsHide: true,
    shell: false,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 2 * 1024 * 1024
  });
  assert.equal(result.status, 0, review.id + ': ' + (result.stderr || result.stdout));
  assert.match(result.stdout, new RegExp('PASS reviewed observatory execution surface ' + review.id));
  checks += 2;
  process.stdout.write('PASS ' + review.id + ' reviewed and executable\n');
}

const badDigest = childProcess.spawnSync(process.execPath, [Adapter.RUNNER, '--module', reviews[0].id, '--digest', '0'.repeat(64)], {
  cwd: root,
  windowsHide: true,
  shell: false,
  encoding: 'utf8',
  timeout: 10000
});
assert.notEqual(badDigest.status, 0);
assert.match(badDigest.stderr, /Reviewed digest argument mismatch/);
checks += 2;

console.log('\nObservatory Heartbeat deck selftest: PASS (' + checks + ' adapter checks; 18 module contracts executed)');
