#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/host-assumption-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function writeJson(file, value, bom = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, (bom ? '\uFEFF' : '') + JSON.stringify(value, null, 2) + '\n');
}

function manifest(id, fields = {}) {
  return Object.assign({
    id, name: id, version: 'v0.1', status: 'EXPERIMENTAL',
    entry: 'index.html', uses: [], readiness: [], permissions: [], accepts: [], produces: []
  }, fields);
}

function contract(id, fields = {}) {
  return Object.assign({
    schema: 'axm.module-contract/v1', id, version: 'v0.1',
    provides: [], consumes: [], permissions: [],
    handoffs: { emits: [], accepts: [] },
    boundaries: { writes: [], refuses: ['automatic-apply'] },
    lifecycle: { state_owner: 'none', reload: 'reset', disconnect: 'not-applicable', cleanup: 'not-applicable' }
  }, fields);
}

function module(root, id, manifestFields, contractValue, bom = false) {
  const directory = path.join(root, 'tools', id);
  const value = manifest(id, manifestFields);
  if (contractValue) value.contract = 'module.contract.json';
  writeJson(path.join(directory, 'manifest.json'), value, bom);
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html>');
  if (contractValue) writeJson(path.join(directory, 'module.contract.json'), contractValue);
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

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-host-assumption-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'tools'), { recursive: true });
  module(fixtureRoot, 'alpha', {
    uses: ['host:cpu', 'storage', 'browser-gamepad-api', 'module:beta', 'axm.packet/v1'],
    readiness: ['service:runtime'],
    permissions: ['network.fetch']
  }, contract('alpha', {
    consumes: ['optional-adapter:ffmpeg', 'network:explicit-source', 'environment:AXM_ROOT', 'windows-runtime'],
    permissions: ['filesystem.read'],
    boundaries: { writes: ['/var/lib/axm', 'C:\\AXM\\state', 'browser-local:alpha'], refuses: [] }
  }));
  module(fixtureRoot, 'beta', {
    uses: ['axm.packet/v1']
  }, null, true);
  fs.symlinkSync(path.join(fixtureRoot, 'tools', 'alpha'), path.join(fixtureRoot, 'tools', 'linked-alpha'));

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const assumption = token => first.assumptions.find(item => item.token === token);
  const request = Core.createProbeRequest(first, 'alpha', { now: '2026-07-27T00:10:00Z' });
  const laterRequest = Core.createProbeRequest(first, 'alpha', { now: '2026-07-27T00:20:00Z' });

  check('host-assumption map declares its exact schema', () => assert.equal(first.schema, 'axm.host-assumption-map/v1'));
  check('host resource syntax is classified exactly', () => assert(assumption('host:cpu').kinds.includes('HOST_RESOURCE_DECLARATION')));
  check('generic storage syntax is classified as filesystem declaration', () => assert(assumption('storage').kinds.includes('FILESYSTEM_DECLARATION')));
  check('browser API syntax is separate from filesystem syntax', () => {
    assert(assumption('browser-gamepad-api').kinds.includes('BROWSER_ENVIRONMENT_DECLARATION'));
    assert.equal(assumption('browser-gamepad-api').kinds.includes('FILESYSTEM_DECLARATION'), false);
  });
  check('network declarations remain exact and unprobed', () => {
    assert(assumption('network:explicit-source').kinds.includes('NETWORK_ENVIRONMENT_DECLARATION'));
    assert(assumption('network.fetch').kinds.includes('NETWORK_ENVIRONMENT_DECLARATION'));
    assert.equal(assumption('network:explicit-source').state, 'DECLARED_NOT_PROBED');
  });
  check('runtime and optional adapter syntax is visible', () => {
    assert(assumption('service:runtime').kinds.includes('RUNTIME_OR_TOOL_DECLARATION'));
    assert(assumption('optional-adapter:ffmpeg').kinds.includes('RUNTIME_OR_TOOL_DECLARATION'));
  });
  check('operating-system literal remains syntax rather than compatibility', () => {
    assert(assumption('windows-runtime').kinds.includes('OPERATING_SYSTEM_LITERAL'));
    assert.equal(assumption('windows-runtime').truth.compatibleWithCurrentHost, false);
  });
  check('POSIX absolute path syntax is visible', () => assert(assumption('/var/lib/axm').kinds.includes('ABSOLUTE_PATH_SYNTAX')));
  check('Windows absolute and backslash path syntax are both visible', () => {
    assert(assumption('C:\\AXM\\state').kinds.includes('ABSOLUTE_PATH_SYNTAX'));
    assert(assumption('C:\\AXM\\state').kinds.includes('BACKSLASH_PATH_SYNTAX'));
  });
  check('environment-variable namespace syntax is visible', () => {
    assert(assumption('environment:AXM_ROOT').kinds.includes('ENVIRONMENT_VARIABLE_SYNTAX'));
  });
  check('generic module and protocol tokens are not relabeled as host assumptions', () => {
    assert.equal(assumption('module:beta'), undefined);
    assert.equal(assumption('axm.packet/v1'), undefined);
  });
  check('contract absence remains explicit', () => {
    const beta = first.modules.find(moduleRecord => moduleRecord.id === 'beta');
    assert.equal(beta.contractState, 'NOT_DECLARED');
  });
  check('UTF-8 BOM manifest parses without false failure', () => {
    assert(first.modules.some(moduleRecord => moduleRecord.id === 'beta'));
    assert.equal(first.summary.readIssues, 0);
  });
  check('top-level symlink is skipped and never followed', () => {
    assert.deepEqual(first.source.skippedSymlinks, ['tools/linked-alpha']);
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('scan performs no source writes', () => assert.deepEqual(after, before));
  check('measurement time does not alter source fingerprint', () => {
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
  check('Touch handoff is named but runtime probing remains false', () => {
    assert.equal(first.probeHandoff.compatibleInputForTouchEnvironmentProbe, true);
    assert.equal(first.probeHandoff.actualProbePerformed, false);
  });
  check('bounded probe request declares its exact schema and selected module', () => {
    assert.equal(request.schema, 'axm.environment-probe-request/v1');
    assert.equal(request.selectedModule.id, 'alpha');
    assert.equal(request.summary.checksRun, 0);
  });
  check('probe request contains only the selected module assumptions', () => {
    assert(request.assumptions.some(item => item.token === 'host:cpu'));
    assert(request.assumptions.every(item => first.assumptions
      .find(source => source.token === item.token)
      .occurrences.some(occurrence => occurrence.moduleId === 'alpha')));
  });
  check('probe request deduplicates checks and leaves every check unrun', () => {
    assert.equal(new Set(request.checks.map(item => item.id)).size, request.checks.length);
    assert(request.checks.length > 0);
    assert(request.checks.every(item => item.state === 'REQUEST_NOT_RUN' && item.observation === null && item.decision === null));
  });
  check('probe request captures no value and claims no probe grant or compatibility', () => {
    assert.equal(request.truth.actualProbePerformed, false);
    assert.equal(request.truth.environmentValuesCaptured, false);
    assert.equal(request.truth.compatibilityProven, false);
    assert.equal(request.truth.permissionChanged, false);
  });
  check('probe request fingerprint ignores request time but preserves source scope', () => {
    assert.equal(request.fingerprint, laterRequest.fingerprint);
    assert.notEqual(request.generatedAt, laterRequest.generatedAt);
  });
  check('probe request refuses unknown or assumption-free module selection', () => {
    assert.throws(() => Core.createProbeRequest(first, 'unknown'), /not present/);
    assert.throws(() => Core.createProbeRequest(first, 'beta'), /no classified host assumptions/);
  });
  check('truth refuses probing compatibility grants installation rewrites and CANON', () => {
    for (const field of [
      'actualHostProbed', 'compatibilityProven', 'readinessProven', 'toolAvailabilityProven',
      'pathExistenceProven', 'networkReachabilityProven', 'permissionChanged',
      'dependencyInstalled', 'pathRewritten', 'sourceMutationPerformed',
      'installerStagingPerformed', 'installationPerformed', 'promotionPerformed', 'canonChanged'
    ]) assert.equal(first.truth[field], false);
  });
  check('manifest and contract identity version and permissions align', () => {
    const manifestValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifestValue.id, contractValue.id);
    assert.equal(manifestValue.version, contractValue.version);
    assert.deepEqual(manifestValue.permissions, contractValue.permissions);
  });
  check('contract preserves runtime probe and permission owners', () => {
    const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'actual-host-probing', 'compatibility-proof', 'readiness-proof',
      'probe-request-execution', 'secret-or-environment-value-capture',
      'permission-grant', 'dependency-installation', 'path-rewrite', 'canon-change'
    ]) assert(contractValue.boundaries.refuses.includes(boundary));
  });
  check('browser entry references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of [
      'styles.css', 'current-host-assumption-map.js',
      'current-environment-probe-request.js', 'app.js'
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
    check('live Workshop assumption scan finds declared environment syntax', () => {
      assert(live.summary.modules > 0);
      assert(live.summary.assumptionOccurrences > 0);
      assert(live.summary.uniqueAssumptions > 0);
    });
    check('live Workshop scan remains unprobed observation only', () => {
      assert.equal(live.truth.actualHostProbed, false);
      assert.equal(live.truth.compatibilityProven, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nHost Assumption Observatory selftest: PASS (' + checks + ' checks)\n');
