#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/verification-entry-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function write(file, value = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function addModule(root, id, packageValue) {
  const directory = path.join(root, 'tools', id);
  writeJson(path.join(directory, 'manifest.json'), {
    id, name: id, version: 'v0.1', status: 'EXPERIMENTAL', entry: 'index.html'
  });
  write(path.join(directory, 'index.html'), '<!doctype html>');
  if (packageValue) writeJson(path.join(directory, 'package.json'), packageValue);
  return directory;
}

function treeReceipt(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isSymbolicLink()) rows.push('SYMLINK:' + relative);
      else if (entry.isDirectory()) visit(absolute);
      else rows.push(relative + ':' + fs.statSync(absolute).size);
    }
  }
  visit(root);
  return rows;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-verification-entry-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'tools'), { recursive: true });
  const alpha = addModule(fixtureRoot, 'alpha');
  write(path.join(alpha, 'selftest.js'), 'throw new Error("must not execute");\n');
  write(path.join(alpha, 'src', 'widget.test.js'), 'throw new Error("must not execute");\n');
  write(path.join(alpha, 'src', 'test-helpers.js'), 'module.exports = {};\n');
  write(path.join(alpha, 'coverage', 'ignored.test.js'), 'ignored');
  write(path.join(alpha, 'state', 'ignored-selftest.js'), 'ignored');
  const linkedTestTarget = path.join(fixtureRoot, 'linked-test-target');
  fs.mkdirSync(linkedTestTarget, { recursive: true });
  write(path.join(linkedTestTarget, 'linked-selftest.js'), 'throw new Error("must not execute");\n');
  fs.symlinkSync(linkedTestTarget, path.join(alpha, 'linked-tests'), process.platform === 'win32' ? 'junction' : 'dir');
  const beta = addModule(fixtureRoot, 'beta', {
    scripts: { test: 'node must-not-run.js', verify: 'node also-must-not-run.js', build: 'node build.js' }
  });
  write(path.join(beta, 'discovery-seam-review.js'), 'throw new Error("must not execute");\n');
  addModule(fixtureRoot, 'gamma');
  addModule(fixtureRoot, '_template');
  fs.symlinkSync(alpha, path.join(fixtureRoot, 'tools', 'linked-alpha'), process.platform === 'win32' ? 'junction' : 'dir');

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const alphaMap = first.modules.find(module => module.id === 'alpha');
  const betaMap = first.modules.find(module => module.id === 'beta');
  const request = Core.createRunRequest(first, 'alpha', 'selftest.js', { now: '2026-07-27T00:10:00Z' });
  const laterRequest = Core.createRunRequest(first, 'alpha', 'selftest.js', { now: '2026-07-27T00:20:00Z' });

  check('verification entry map declares its exact schema', () => assert.equal(first.schema, 'axm.verification-entry-map/v1'));
  check('underscore template and top-level symlink are excluded', () => {
    assert.deepEqual(first.modules.map(module => module.id), ['alpha', 'beta', 'gamma']);
    assert(first.source.skippedSymlinks.includes('tools/linked-alpha'));
  });
  check('conventional root selftest is labeled exactly', () => {
    assert(alphaMap.conventionalSelftest);
    assert.equal(alphaMap.entries.find(entry => entry.path === 'selftest.js').role, 'CONVENTIONAL_PRIMARY_SELFTEST');
  });
  check('nested test-shaped filename remains name match only', () => {
    const entry = alphaMap.entries.find(item => item.path === 'src/widget.test.js');
    assert.equal(entry.role, 'NESTED_NAME_MATCH');
    assert.equal(entry.state, 'NAME_MATCH_ONLY');
    assert.equal(entry.executableProven, false);
  });
  check('test helper name is inventoried without semantic interpretation', () => {
    assert(alphaMap.entries.some(entry => entry.path === 'src/test-helpers.js'));
  });
  check('excluded output and state directories are not scanned', () => {
    assert.equal(alphaMap.entries.some(entry => entry.path.includes('ignored')), false);
  });
  check('nested symlink directory is skipped and never followed', () => {
    assert(first.source.skippedSymlinks.includes('tools/alpha/linked-tests'));
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('discovery seam review keeps its distinct role', () => {
    assert.equal(betaMap.entries[0].role, 'DISCOVERY_SEAM_REVIEW');
    assert(betaMap.discoverySeamReview);
  });
  check('matching package scripts remain declared and unrun', () => {
    assert.deepEqual(betaMap.packageScripts.map(script => script.name), ['test', 'verify']);
    assert(betaMap.packageScripts.every(script => script.state === 'DECLARED_NOT_RUN'));
  });
  check('unrelated package script is outside the map', () => {
    assert.equal(betaMap.packageScripts.some(script => script.name === 'build'), false);
  });
  check('module without a name match remains visible', () => {
    const gamma = first.modules.find(module => module.id === 'gamma');
    assert.equal(gamma.entries.length, 0);
    assert.equal(gamma.packageScripts.length, 0);
  });
  check('scan performs no source writes or test execution', () => assert.deepEqual(after, before));
  check('measurement time does not alter inventory fingerprint', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('output leaks no absolute fixture root', () => assert.equal(JSON.stringify(first).includes(fixtureRoot), false));
  check('freshness is live inside TTL and stale after TTL', () => {
    const timed = Object.assign({}, first, { freshnessTtlMs: 1000 });
    assert.equal(Core.freshness(timed, { now: '2026-07-27T00:00:00.500Z' }).status, 'LIVE');
    assert.equal(Core.freshness(timed, { now: '2026-07-27T00:00:02Z' }).status, 'STALE');
  });
  check('unknown timing remains explicitly untimed', () => assert.equal(Core.freshness({}).status, 'UNTIMED'));
  check('bounded run request declares one exact mapped entry', () => {
    assert.equal(request.schema, 'axm.verification-run-request/v1');
    assert.equal(request.selectedModule.id, 'alpha');
    assert.equal(request.selectedEntry.path, 'selftest.js');
    assert.equal(request.summary.entriesSelected, 1);
  });
  check('bounded run request carries no command arguments environment or fixture', () => {
    assert.equal(request.executionEnvelope.commandIncluded, false);
    assert.equal(request.executionEnvelope.argumentsIncluded, false);
    assert.equal(request.executionEnvelope.environmentValuesIncluded, false);
    assert.equal(request.executionEnvelope.fixtureInputIncluded, false);
  });
  check('bounded run request deduplicates checks and leaves every check unrun', () => {
    assert.equal(new Set(request.checks.map(item => item.id)).size, request.checks.length);
    assert(request.checks.every(item => item.state === 'REQUEST_NOT_RUN' && item.observation === null && item.decision === null));
    assert.equal(request.summary.checksRun, 0);
  });
  check('bounded run request fingerprint ignores request time', () => {
    assert.equal(request.fingerprint, laterRequest.fingerprint);
    assert.notEqual(request.generatedAt, laterRequest.generatedAt);
  });
  check('bounded run request refuses unknown module or unmapped entry', () => {
    assert.throws(() => Core.createRunRequest(first, 'unknown', 'selftest.js'), /not present/);
    assert.throws(() => Core.createRunRequest(first, 'alpha', 'missing.test.js'), /not mapped/);
    assert.throws(() => Core.createRunRequest(first, 'beta', 'test'), /not mapped/);
  });
  check('bounded run request makes no execution passing readiness or side-effect claim', () => {
    assert.equal(request.truth.executionPerformed, false);
    assert.equal(request.truth.passingProven, false);
    assert.equal(request.truth.readinessProven, false);
    assert.equal(request.truth.sideEffectsProvenAbsent, false);
  });
  check('truth refuses execution passing coverage readiness and CANON', () => {
    for (const field of [
      'testsExecuted', 'commandsExecuted', 'entrypointExecutableProven', 'testPassingProven',
      'coverageProven', 'readinessProven', 'qualityProven', 'machineHostChanged',
      'sourceMutationPerformed', 'installerStagingPerformed', 'installationPerformed',
      'promotionPerformed', 'canonChanged'
    ]) assert.equal(first.truth[field], false);
  });
  check('manifest and contract identity version and permissions align', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.deepEqual(manifest.permissions, contract.permissions);
  });
  check('contract preserves execution receipt readiness and promotion owners', () => {
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'test-execution', 'verification-request-execution',
      'command-argument-or-environment-synthesis', 'fixture-input-invention',
      'declared-command-execution', 'test-passing-proof',
      'coverage-proof', 'readiness-proof', 'machine-host-change', 'canon-change'
    ]) assert(contract.boundaries.refuses.includes(boundary));
  });
  check('browser entry references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of [
      'styles.css', 'current-verification-entry-map.js',
      'current-verification-run-request.js', 'app.js'
    ]) assert(html.includes(name));
    assert.equal(/https?:\/\//.test(html), false);
  });
  check('bundle builder is self-contained and excludes its output', () => {
    const source = fs.readFileSync(path.join(__dirname, 'build-bundle.js'), 'utf8');
    assert(source.includes('absolute === output'));
    assert(source.includes("'axm.module-bundle/v1'"));
  });

  const workshopRoot = argValue('--workshop-root');
  if (workshopRoot) {
    const live = Core.scanWorkshop(workshopRoot);
    check('live Workshop verification inventory finds modules and name matches', () => {
      assert(live.summary.modules > 0);
      assert(live.summary.nameMatchedFiles > 0);
    });
    check('live Workshop scan remains non-executing observation only', () => {
      assert.equal(live.truth.testsExecuted, false);
      assert.equal(live.truth.testPassingProven, false);
      assert.equal(live.truth.canonChanged, false);
    });
    check('live Workshop technical-glasses selftest can be selected without running it', () => {
      const liveRequest = Core.createRunRequest(live, 'technical-glasses', 'selftest.js');
      assert.equal(liveRequest.selectedModule.id, 'technical-glasses');
      assert.equal(liveRequest.summary.checksRun, 0);
      assert.equal(liveRequest.truth.executionPerformed, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nVerification Entry Observatory selftest: PASS (' + checks + ' checks)\n');
