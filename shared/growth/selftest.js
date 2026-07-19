'use strict';

const assert = require('assert');
const path = require('path');
const G = require('./axm-growth-metrics');
const root = path.resolve(__dirname, '../..');
const current = G.scan(root);

assert.equal(current.scope, 'active-workshop-source');
assert.ok(current.totalFiles > 100);
assert.ok(current.characters > 100000);
assert.ok(current.lines > 1000);
assert.equal(current.measurementVersion, 3);
assert.ok(current.codeLines > 1000);
assert.ok(current.testLines > 100);
assert.ok(current.codeFiles > 10);
assert.ok(current.assetFiles > 0);
assert.ok(current.modules > 10);
assert.ok(current.tests > 10);
assert.equal(current.activity.hourly.length, 24);
assert.equal(current.activity.truth.completedWorkClaim, false);
assert.equal(current.activity.truth.linesCurrentInTouchedFilesNotLinesAdded, true);
assert.equal(G.activityKind('tools/example/app.js', '.js'), 'code');
assert.equal(G.activityKind('tools/example/image.png', '.png'), 'assets');
assert.equal(G.activityKind('tools/example/app.test.js', '.js'), 'tests');
assert.ok(current.excluded.includes('exports') && current.excluded.includes('node_modules') && current.excluded.includes('state') && current.excluded.includes('local-data'));

const first = G.capture(null, current, 'Baseline', 'mike');
assert.equal(first.duplicate, false);
assert.equal(first.state.schedule.enabled, true);
assert.equal(first.state.schedule.localTime, '05:00');
assert.equal('extensions' in first.snapshot, false);
assert.equal('largest' in first.snapshot, false);
assert.equal('activity' in first.snapshot, false);
assert.equal(first.snapshot.measurementVersion, 3);

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
const hourly = G.hourlyVelocity(later, seeded.state.velocitySamples, later.measuredAt);
assert.equal(hourly.length, 24);
assert.ok(hourly.some(bucket => bucket.measured && bucket.codeLines === 120));

const sameManual = G.capture(first.state, current, 'Again', 'mike');
assert.equal(sameManual.duplicate, true);
const daily = G.capture(first.state, current, 'Daily', 'local-daily-schedule', { allowDuplicateFingerprint: true, scheduleDate: '2026-07-17', capturedAt: '2026-07-17T20:00:00.000Z' });
assert.equal(daily.state.snapshots.length, 2);
assert.equal(daily.state.schedule.lastCaptureDate, '2026-07-17');
const configured = G.configureSchedule(daily.state, { enabled: false, localTime: '21:15', updatedBy: 'mike' });
assert.equal(configured.schedule.enabled, false);
assert.equal(configured.schedule.localTime, '21:15');
assert.equal(G.delta(current, current).characters, 0);

console.log('Workshop Growth selftest: PASS · ' + current.codeLines + ' code lines · aggregate velocity meter');
