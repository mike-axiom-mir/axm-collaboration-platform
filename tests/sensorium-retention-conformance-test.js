#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Runner = require('../shared/sensorium/automation/conformance-runner');

Runner.run({ writeReport: true }).then(function (report) {
  assert.equal(report.verdict, 'VERIFIED');
  assert.equal(report.schema, 'axm.sensorium-conformance-report/v3');
  assert.equal(report.coverage.skillsDeclared, 13);
  assert.equal(report.coverage.executableRoutesDeclared, 12);
  assert.equal(report.coverage.hostMediatedRoutesDeclared, 1);
  assert.equal(report.coverage.runtimePassProofs, 12);
  assert.equal(report.coverage.contractPassProofs, 1);
  assert.deepEqual(report.coverage.missingExecutors, []);
  assert.deepEqual(report.coverage.missingAdapters, ['interoception-capacity-gauge']);
  assert.ok(report.rows.every(function (row) { return row.rawRetainedBytes === 0 && row.rawRetainedItems === 0 && row.uses[0] === 0 && row.uses[1] === 0; }));
  console.log('Sensorium retention conformance: VERIFIED');
  console.log('  canonical TEST senses: 13/13 PASS at declared proof level');
  console.log('  executable routes: 12/12 present');
  console.log('  host-mediated routes: 1/1 honest');
  console.log('  proof levels: 12 RUNTIME_PASS + 1 CONTRACT_PASS');
  console.log('  missing adapters: interoception-capacity-gauge (honest hold)');
  console.log('  missing executors: 0');
}).catch(function (error) { console.error(error.stack || error.message || error); process.exitCode = 1; });
