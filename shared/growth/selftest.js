'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const G = require('./axm-growth-metrics');
const root = path.resolve(__dirname, '../..');
const current = G.scan(root);

assert.equal(current.scope, 'active-workshop-source');
assert.ok(current.totalFiles > 100);
assert.ok(current.characters > 100000);
assert.ok(current.lines > 1000);
assert.equal(current.measurementVersion, 7);
assert.ok(current.codeLines > 1000);
assert.ok(current.testLines > 100);
assert.ok(current.codeFiles > 10);
assert.ok(current.assetFiles > 0);
assert.ok(current.modules > 10);
assert.ok(current.worlds > 0);
assert.ok(current.tests > 10);
assert.ok(current.hands > 10);
assert.ok(current.schemas > 10);
assert.ok(current.protocols > 0);
assert.ok(current.validators > 0);
assert.ok(current.exactCapabilities > 100);
assert.ok(current.capabilityDeclarations >= current.exactCapabilities);
assert.deepEqual(G.scanCapabilities(root), { exactCapabilities:current.exactCapabilities, capabilityDeclarations:current.capabilityDeclarations });
assert.equal(Object.keys(current.moduleFingerprints).length, current.modules);
assert.equal(Object.keys(current.moduleActivity).length, current.modules);
assert.equal(Object.keys(current.worldFingerprints).length, current.worlds);
assert.equal(Object.keys(current.worldActivity).length, current.worlds);
assert.equal(current.activity.hourly.length, 24);
assert.equal(current.activity.truth.completedWorkClaim, false);
assert.equal(current.activity.truth.linesCurrentInTouchedFilesNotLinesAdded, true);
assert.equal(G.activityKind('tools/example/app.js', '.js'), 'code');
assert.equal(G.activityKind('tools/example/image.png', '.png'), 'assets');
assert.equal(G.activityKind('tools/example/app.test.js', '.js'), 'tests');
assert.equal(G.componentKind('shared/asset-hands/hands/example.js', '.js'), 'hands');
assert.equal(G.componentKind('shared/example/example.schema.json', '.json'), 'schemas');
assert.equal(G.componentKind('shared/example/host-protocol.mjs', '.mjs'), 'protocols');
assert.equal(G.componentKind('shared/example/external-verifier.js', '.js'), 'validators');
assert.equal(G.componentKind('shared/example/external-verifier-selftest.js', '.js'), null);
assert.ok(current.excluded.includes('exports') && current.excluded.includes('node_modules') && current.excluded.includes('state') && current.excluded.includes('local-data'));

const mirrorFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-mirror-growth-'));
function fixtureFile(relative, content) {
  const file = path.join(mirrorFixture, relative);
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, content);
  return file;
}
try {
  fixtureFile('index.js', 'const mirrorBody = true;\n');
  fixtureFile('modules/example/index.js', 'module.exports = {};\n');
  fixtureFile('organs/example-organ.js', 'module.exports = {};\n');
  fixtureFile('tests/example.test.js', 'module.exports = true;\n');
  fixtureFile('contracts/example.json', '{}\n');
  fixtureFile('training/lesson.json', '{}\n');
  fixtureFile('substrates/runtime.bin', Buffer.alloc(4096, 1));
  fixtureFile('.git/objects/blob', Buffer.alloc(1024, 2));
  fixtureFile('state/private-checkpoint.json', '{"private":true}\n');
  fixtureFile('exports/example.glb', Buffer.alloc(512, 3));
  fixtureFile('logs/example.log', 'operational log that must not count as body text\n');
  fixtureFile('lineage/identity-branches/creative-mirror.branch.json', JSON.stringify({ branchId:'axm.machine.creative-mirror/seed-0', displayName:'Creative Mirror', status:'EXPERIMENTAL', privateLogNamespace:'state/creative-circle/branch-logs/creative-mirror', codeForkCreated:false, forkPoint:{ parentIdentity:'axm.machine.mirror/seed-0' } }));
  fixtureFile('state/creative-circle/branch-logs/creative-mirror/receipt.json', '{}\n');
  fixtureFile('state/ai-organ-archive/specialist-mirrors/english-learner-mirror/LINEAGE.json', JSON.stringify({ specialistId:'english-learner-mirror', branchId:'axm.machine.specialist-mirror/english-learner-mirror/seed-0', displayName:'English Learner Mirror', status:'EXPERIMENTAL', parentIdentity:'axm.machine.mirror/seed-0' }));

  const mirror = G.scanMirror(mirrorFixture);
  assert.equal(mirror.available, true);
  assert.equal(mirror.specializationCount, 2);
  assert.deepEqual(mirror.specializations.map(item => item.displayName), ['Creative Mirror', 'English Learner Mirror']);
  assert.ok(mirror.substrateBytes >= 4096);
  assert.ok(mirror.historyBytes >= 1024);
  assert.ok(mirror.stateFiles >= 3);
  assert.equal(mirror.outputFiles, 1);
  assert.equal(mirror.logFiles, 1);
  assert.equal(mirror.modules, 1);
  assert.equal(mirror.organs, 1);
  assert.equal(mirror.tests, 1);
  assert.equal(mirror.contracts, 1);
  assert.equal(mirror.trainingFiles, 1);
  assert.equal(mirror.boundaries.privateStateContentsRead, false);
  assert.equal(mirror.boundaries.privateStateMetadataRead, true);
  assert.equal(JSON.stringify(mirror).includes(mirrorFixture), false);
  assert.equal(mirror.characters < 1000, true);

  const joined = G.attachMirror(current, mirror);
  assert.equal(joined.measurementVersion, 7);
  assert.equal(joined.mirror.specializations[0].displayName, 'Creative Mirror');
  const joinedCapture = G.capture(null, joined, 'Workshop and Mirror baseline', 'selftest');
  assert.equal(joinedCapture.snapshot.mirror.available, true);
  assert.equal('boundaries' in joinedCapture.snapshot.mirror, false);
  assert.equal('parentIdentity' in joinedCapture.snapshot.mirror.specializations[0], false);
  assert.equal(G.mirrorDelta(mirror, joinedCapture.snapshot.mirror).bytes, 0);
  const changedMirror = Object.assign({}, mirror, { bodyBytes:mirror.bodyBytes + 10, bytes:mirror.bytes + 10, specializations:mirror.specializations.map(function (item, index) { return index ? item : Object.assign({}, item, { bytes:item.bytes + 10, fingerprint:'changedfingerprint' }); }) });
  assert.equal(G.mirrorDelta(changedMirror, joinedCapture.snapshot.mirror).bodyBytes, 10);
  assert.deepEqual(G.mirrorSpecializationChanges(changedMirror, joinedCapture.snapshot.mirror).updated, [mirror.specializations[0].id]);
} finally {
  fs.rmSync(mirrorFixture, { recursive:true, force:true });
}

const first = G.capture(null, current, 'Baseline', 'mike');
assert.equal(first.duplicate, false);
assert.equal(first.state.schedule.enabled, true);
assert.equal(first.state.schedule.localTime, '05:00');
assert.equal('extensions' in first.snapshot, false);
assert.equal('largest' in first.snapshot, false);
assert.equal('activity' in first.snapshot, false);
assert.equal(first.snapshot.measurementVersion, 7);
assert.equal(first.snapshot.exactCapabilities, current.exactCapabilities);
assert.equal(first.snapshot.capabilityDeclarations, current.capabilityDeclarations);
assert.equal(Object.keys(first.snapshot.moduleFingerprints).length, current.modules);
assert.equal(Object.keys(first.snapshot.worldFingerprints).length, current.worlds);
assert.deepEqual(G.moduleChanges(current, first.snapshot), { exact:true, mode:'compact-module-fingerprint', added:0, removed:0, updated:0, touched:0, ids:{ added:[], removed:[], updated:[] } });
assert.deepEqual(G.worldChanges(current, first.snapshot), { exact:true, mode:'compact-world-fingerprint', added:0, removed:0, updated:0, touched:0, ids:{ added:[], removed:[], updated:[] } });
assert.equal(G.moduleChanges(current, { capturedAt: current.measuredAt, modules: current.modules, measurementVersion: 3 }).exact, false);

const sampleAt = '2026-07-19T10:00:00.000Z';
const seeded = G.recordVelocity(null, Object.assign({}, current, { measuredAt: sampleAt }), { sampledAt: sampleAt });
assert.equal(seeded.duplicate, false);
assert.equal(seeded.state.velocitySamples.length, 1);
assert.equal('file' in seeded.sample, false);
const later = Object.assign({}, current, { codeLines: current.codeLines + 120, testLines: current.testLines + 30, assetFiles: current.assetFiles + 2, measuredAt: '2026-07-19T10:30:00.000Z' });
const pace = G.velocity(later, seeded.state.velocitySamples, later.measuredAt);
assert.equal(pace.ready, true);
assert.equal(pace.codeLinesDelta, 120);
assert.equal(pace.codeLinesPerHour, 240);
assert.equal(pace.testLinesPerHour, 60);
assert.equal(pace.assetFilesPerHour, 4);
assert.equal(pace.coverage.state, 'CONTINUOUS');
assert.equal(pace.coverage.hasMeasuredChange, true);
const resumed = G.velocity(Object.assign({}, current, { measuredAt:'2026-07-19T12:02:00.000Z' }), [
  G.compactVelocitySample(Object.assign({}, current, { sampledAt:'2026-07-19T10:00:00.000Z' })),
  G.compactVelocitySample(Object.assign({}, current, { sampledAt:'2026-07-19T12:00:00.000Z' }))
], '2026-07-19T12:02:00.000Z');
assert.equal(resumed.coverage.state, 'RESUMED_AFTER_GAP');
assert.equal(resumed.coverage.hasMeasuredChange, false);
assert.equal(resumed.coverage.gapBeforeBaselineMinutes, 120);
const hourly = G.hourlyVelocity(later, seeded.state.velocitySamples, later.measuredAt);
assert.equal(hourly.length, 24);
assert.ok(hourly.some(bucket => bucket.measured && bucket.codeLines === 120));

const sameManual = G.capture(first.state, current, 'Again', 'mike');
assert.equal(sameManual.duplicate, true);
const daily = G.capture(first.state, current, 'Daily', 'local-daily-schedule', { allowDuplicateFingerprint: true, scheduleDate: '2026-07-17', capturedAt: '2026-07-17T20:00:00.000Z' });
assert.equal(daily.state.snapshots.length, 2);
assert.equal(daily.state.schedule.lastCaptureDate, '2026-07-17');
const longJourney = G.state({ snapshots: Array.from({ length: 420 }, function (_, index) { return Object.assign({}, first.snapshot, { id:'growth-history-' + index, fingerprint:'fingerprint-' + index, capturedAt:new Date(Date.UTC(2025, 0, 1 + index)).toISOString() }); }) });
assert.equal(longJourney.snapshots.length, 420);
assert.equal(longJourney.retention.snapshots, G.SNAPSHOT_RETENTION);
assert.equal(longJourney.snapshots[0].id, 'growth-history-0');
const configured = G.configureSchedule(daily.state, { enabled: false, localTime: '21:15', updatedBy: 'mike' });
assert.equal(configured.schedule.enabled, false);
assert.equal(configured.schedule.localTime, '21:15');
assert.equal(G.delta(current, current).characters, 0);

console.log('Workshop Growth selftest: PASS · ' + current.codeLines + ' code lines · aggregate velocity meter');
