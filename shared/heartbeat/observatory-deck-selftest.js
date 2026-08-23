#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
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
const newlineFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-observatory-newlines-'));
try {
  function writeFixture(name, newline, changed) {
    const fixtureRoot = path.join(newlineFixture, name);
    const moduleRoot = path.join(fixtureRoot, 'tools', 'newline-fixture');
    fs.mkdirSync(moduleRoot, { recursive: true });
    const files = {
      'app.js': "'use strict';\nmodule.exports = " + (changed ? '2' : '1') + ';\n',
      'manifest.json': '{"id":"newline-fixture","status":"TEST"}\n',
      'module.contract.json': '{"id":"newline-fixture"}\n',
      'selftest.js': "'use strict';\nconsole.log('PASS');\n"
    };
    for (const [relative, source] of Object.entries(files)) {
      fs.writeFileSync(path.join(moduleRoot, relative), source.replace(/\n/g, newline));
    }
    return Adapter.executionDigest(fixtureRoot, 'newline-fixture');
  }
  const lfDigest = writeFixture('lf', '\n', false);
  const crlfDigest = writeFixture('crlf', '\r\n', false);
  const loneCrDigest = writeFixture('lone-cr', '\r', false);
  const changedDigest = writeFixture('changed', '\r\n', true);
  assert.equal(Adapter.VERSION, '0.2.0');
  assert.equal(Adapter.DIGEST_CONTRACT, 'sha256-canonical-text-lf-v1');
  assert.equal(lfDigest.digestContract, Adapter.DIGEST_CONTRACT);
  assert.deepEqual(lfDigest.files, crlfDigest.files);
  assert.equal(lfDigest.digest, crlfDigest.digest, 'Git LF and Windows CRLF checkout bytes must share one reviewed text digest');
  assert.notEqual(loneCrDigest.digest, lfDigest.digest, 'a lone carriage return must remain digest-significant');
  assert.notEqual(changedDigest.digest, lfDigest.digest, 'a non-newline execution change must change the reviewed digest');
  checks += 7;
} finally {
  fs.rmSync(newlineFixture, { recursive: true, force: true });
}

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
  assert.equal(candidate.digestContract, Adapter.DIGEST_CONTRACT);
  checks += 6;

  const result = childProcess.spawnSync(process.execPath, candidate.args, {
    cwd: root,
    windowsHide: true,
    shell: false,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 2 * 1024 * 1024
  });
  assert.equal(result.status, 0, review.id + ': ' + (result.stderr || result.stdout));
  assert.match(result.stdout, new RegExp('PASS reviewed observatory execution surface ' + review.id + ' ' + Adapter.DIGEST_CONTRACT));
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
