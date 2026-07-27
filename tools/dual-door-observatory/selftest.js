#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/dual-door-core');

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

function addModule(root, id, fields = {}) {
  const directory = path.join(root, 'tools', id);
  const manifest = Object.assign({
    id, name: id, version: 'v0.1', status: 'EXPERIMENTAL', entry: 'index.html'
  }, fields);
  writeJson(path.join(directory, 'manifest.json'), manifest);
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

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-dual-door-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'tools'), { recursive: true });
  const alpha = addModule(fixtureRoot, 'alpha', {
    machine: {
      entry: 'machine.js',
      status: 'TEST',
      apiVersion: 'v1',
      effect: 'mixed',
      actions: ['parts.list', 'draft.create'],
      forbidden: ['install', 'promote']
    }
  });
  write(path.join(alpha, 'index.html'), '<!doctype html>');
  write(path.join(alpha, 'machine.js'), 'throw new Error("must not load");\n');

  const beta = addModule(fixtureRoot, 'beta', {
    entry: 'studio.html',
    machine: {
      entry: 'control.cjs',
      status: 'TEST',
      apiVersion: 'v1',
      actions: {
        validate: { description: 'Validate', effect: 'read', inputSchema: { type: 'object' } },
        build: { description: 'Build', effect: 'write' }
      }
    }
  });
  write(path.join(beta, 'studio.html'), '<!doctype html>');
  write(path.join(beta, 'control.cjs'), 'throw new Error("must not load");\n');

  const gamma = addModule(fixtureRoot, 'gamma');
  write(path.join(gamma, 'index.html'), '<!doctype html>');
  addModule(fixtureRoot, 'delta', {
    entry: '../outside.html',
    machine: { entry: 'missing.js', actions: 'not-an-action-map' }
  });
  const epsilon = addModule(fixtureRoot, 'epsilon', { entry: 'linked.html' });
  write(path.join(epsilon, 'real.html'), '<!doctype html>');
  fs.symlinkSync(path.join(epsilon, 'real.html'), path.join(epsilon, 'linked.html'));
  const template = addModule(fixtureRoot, '_template');
  write(path.join(template, 'index.html'), '<!doctype html>');
  fs.symlinkSync(alpha, path.join(fixtureRoot, 'tools', 'linked-alpha'));

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const module = id => first.modules.find(item => item.id === id);
  const humanRequest = Core.createDoorReviewRequest(first, 'gamma', 'human', {
    now: '2026-07-27T00:10:00Z'
  });
  const machineRequest = Core.createDoorReviewRequest(first, 'beta', 'machine', {
    actionId: 'validate',
    now: '2026-07-27T00:10:00Z'
  });
  const laterMachineRequest = Core.createDoorReviewRequest(second, 'beta', 'MACHINE', {
    actionId: 'validate',
    now: '2026-07-27T01:10:00Z'
  });

  check('dual door map declares its exact schema', () => assert.equal(first.schema, 'axm.dual-door-map/v1'));
  check('underscore template and top-level module symlink are excluded', () => {
    assert.deepEqual(first.modules.map(item => item.id), ['alpha', 'beta', 'delta', 'epsilon', 'gamma']);
    assert.deepEqual(first.source.skippedSymlinks, ['tools/linked-alpha']);
  });
  check('present human entry is observed without rendering', () => {
    assert.equal(module('alpha').human.state, 'PRESENT');
    assert.equal(module('alpha').human.loadedOrRendered, false);
  });
  check('present machine entry is observed without loading or execution', () => {
    assert.equal(module('alpha').machine.entry.state, 'PRESENT');
    assert.equal(module('alpha').machine.codeLoaded, false);
    assert.equal(module('alpha').machine.actionsExecuted, false);
  });
  check('string-array action declarations retain exact identifiers', () => {
    assert.equal(module('alpha').machine.actionShape, 'STRING_ARRAY');
    assert.deepEqual(module('alpha').machine.actions.map(action => action.id), ['draft.create', 'parts.list']);
  });
  check('object-map action declarations retain shape details', () => {
    const betaMap = module('beta');
    assert.equal(betaMap.machine.actionShape, 'OBJECT_MAP');
    const validate = betaMap.machine.actions.find(action => action.id === 'validate');
    assert(validate.descriptionDeclared);
    assert(validate.effectDeclared);
    assert(validate.inputSchemaDeclared);
  });
  check('optional machine-door absence is not classified as a defect', () => {
    assert.equal(module('gamma').machine.entry.state, 'NOT_DECLARED_OPTIONAL');
    assert.equal(module('gamma').machine.optionalAbsence, true);
  });
  check('unsafe human path remains explicit and unread', () => {
    assert.equal(module('delta').human.state, 'UNSAFE_PATH');
    assert.equal(module('delta').human.loadedOrRendered, false);
  });
  check('missing machine entry and unsupported action shape stay separate', () => {
    assert.equal(module('delta').machine.entry.state, 'MISSING');
    assert.equal(module('delta').machine.actionShape, 'UNSUPPORTED_SHAPE');
  });
  check('human entry symlink is refused rather than followed', () => {
    assert.equal(module('epsilon').human.state, 'SYMLINK_REFUSED');
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('machine metadata and forbidden identifiers remain declaration facts', () => {
    assert.equal(module('alpha').machine.status, 'TEST');
    assert.equal(module('alpha').machine.apiVersion, 'v1');
    assert.deepEqual(module('alpha').machine.forbidden, ['install', 'promote']);
  });
  check('scan performs no source writes or entry execution', () => assert.deepEqual(after, before));
  check('measurement time does not alter source fingerprint', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('human request selects one exact present human door', () => {
    assert.equal(humanRequest.schema, 'axm.door-review-request/v1');
    assert.equal(humanRequest.selectedModule.id, 'gamma');
    assert.equal(humanRequest.selectedDoor.kind, 'HUMAN');
    assert.equal(humanRequest.selectedDoor.path, 'index.html');
    assert.equal(humanRequest.selectedAction, null);
  });
  check('machine request selects one exact present door and declared action', () => {
    assert.equal(machineRequest.selectedModule.id, 'beta');
    assert.equal(machineRequest.selectedDoor.kind, 'MACHINE');
    assert.equal(machineRequest.selectedDoor.path, 'control.cjs');
    assert.equal(machineRequest.selectedDoor.actionShape, 'OBJECT_MAP');
    assert.equal(machineRequest.selectedAction.id, 'validate');
    assert.equal(machineRequest.selectedAction.inputSchemaDeclared, true);
  });
  check('door requests contain four distinct unrun checks', () => {
    for (const request of [humanRequest, machineRequest]) {
      assert.equal(request.checks.length, 4);
      assert.equal(new Set(request.checks.map(item => item.id)).size, 4);
      assert(request.checks.every(item => item.state === 'REQUEST_NOT_RUN'));
      assert.equal(request.summary.checksRun, 0);
    }
  });
  check('door requests contain no command input arguments environment or fixture', () => {
    for (const request of [humanRequest, machineRequest]) {
      assert.equal(request.executionEnvelope.commandIncluded, false);
      assert.equal(request.executionEnvelope.argumentsIncluded, false);
      assert.equal(request.executionEnvelope.environmentValuesIncluded, false);
      assert.equal(request.executionEnvelope.fixtureInputIncluded, false);
      assert.equal(request.executionEnvelope.networkAccessRequested, false);
      assert.equal(request.executionEnvelope.sourceWriteAccessRequested, false);
    }
  });
  check('measurement and generation time do not alter review fingerprint', () => {
    assert.equal(machineRequest.fingerprint, laterMachineRequest.fingerprint);
    assert.notEqual(machineRequest.generatedAt, laterMachineRequest.generatedAt);
  });
  check('review request refuses invalid door kind', () => {
    assert.throws(() => Core.createDoorReviewRequest(first, 'gamma', 'side'), /HUMAN or MACHINE/);
  });
  check('review request refuses optional machine-door absence', () => {
    assert.throws(
      () => Core.createDoorReviewRequest(first, 'gamma', 'machine', { actionId: 'validate' }),
      /not PRESENT/
    );
  });
  check('review request refuses machine selection without exact declared action', () => {
    assert.throws(() => Core.createDoorReviewRequest(first, 'beta', 'machine'), /requires one exact/);
    assert.throws(
      () => Core.createDoorReviewRequest(first, 'beta', 'machine', { actionId: 'unknown' }),
      /not declared/
    );
  });
  check('review request refuses machine action on human door', () => {
    assert.throws(
      () => Core.createDoorReviewRequest(first, 'gamma', 'human', { actionId: 'validate' }),
      /cannot select/
    );
  });
  check('request truth refuses opening rendering execution grants readiness and CANON', () => {
    for (const request of [humanRequest, machineRequest]) {
      assert.equal(request.truth.requestOnly, true);
      for (const field of [
        'entryCodeLoaded', 'humanDoorRendered', 'machineActionExecuted', 'routeProven',
        'actionSemanticsProven', 'visualQualityProven', 'passingProven', 'readinessProven',
        'permissionGranted', 'sideEffectsProvenAbsent', 'sourceMutationPerformed',
        'installerStagingPerformed', 'installationPerformed', 'promotionPerformed', 'canonChanged'
      ]) assert.equal(request.truth[field], false);
    }
  });
  check('output leaks no absolute fixture root', () => assert.equal(JSON.stringify(first).includes(fixtureRoot), false));
  check('freshness is live inside TTL and stale after TTL', () => {
    const timed = Object.assign({}, first, { freshnessTtlMs: 1000 });
    assert.equal(Core.freshness(timed, { now: '2026-07-27T00:00:00.500Z' }).status, 'LIVE');
    assert.equal(Core.freshness(timed, { now: '2026-07-27T00:00:02Z' }).status, 'STALE');
  });
  check('unknown timing remains explicitly untimed', () => assert.equal(Core.freshness({}).status, 'UNTIMED'));
  check('truth refuses loading execution parity readiness grants and CANON', () => {
    for (const field of [
      'entryCodeLoaded', 'humanDoorRendered', 'machineActionExecuted', 'routeProven',
      'actionSemanticsProven', 'actionParityRequired', 'readinessProven', 'permissionGranted',
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
  check('contract preserves route execution semantics readiness and promotion owners', () => {
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'entry-code-loading', 'human-entry-rendering', 'machine-action-execution',
      'route-proof', 'action-semantics-proof', 'mandatory-machine-door-inference',
      'door-review-request-execution', 'test-input-invention',
      'command-argument-or-environment-synthesis', 'readiness-proof',
      'permission-grant', 'canon-change'
    ]) assert(contract.boundaries.refuses.includes(boundary));
  });
  check('browser entry references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of [
      'styles.css', 'current-dual-door-map.js', 'current-door-review-request.js', 'app.js'
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
    const liveRequest = Core.createDoorReviewRequest(live, 'evidence-desk', 'machine', {
      actionId: 'validate'
    });
    check('live Workshop dual-door scan finds present human and machine entries', () => {
      assert(live.summary.modules > 0);
      assert(live.summary.humanDoorsPresent > 0);
      assert(live.summary.machineDoorsPresent > 0);
    });
    check('live Workshop scan keeps optional machine absence non-executing', () => {
      assert(live.summary.machineDoorsOptionalNotDeclared > 0);
      assert.equal(live.truth.machineActionExecuted, false);
      assert.equal(live.truth.canonChanged, false);
    });
    check('live Workshop request selects only Evidence Desk validate and remains unrun', () => {
      assert.equal(liveRequest.selectedModule.id, 'evidence-desk');
      assert.equal(liveRequest.selectedDoor.kind, 'MACHINE');
      assert.equal(liveRequest.selectedAction.id, 'validate');
      assert.equal(liveRequest.summary.actionsSelected, 1);
      assert.equal(liveRequest.summary.checksRun, 0);
      assert.equal(liveRequest.truth.machineActionExecuted, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nDual Door Observatory selftest: PASS (' + checks + ' checks)\n');
