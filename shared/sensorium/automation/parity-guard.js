'use strict';

const fs = require('fs');
const Inventory = require('./inventory-compiler');
const Dual = require('./dual-form-compiler');

function check() {
  const expected = Object.assign({}, Inventory.render(), Dual.render());
  const drift = Object.keys(expected).filter(function (file) { return !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== expected[file]; });
  return { schema: 'axm.sensorium-parity-report/v1', verdict: drift.length ? 'FAIL' : 'PASS', checkedArtifacts: Object.keys(expected).length, drift };
}
if (require.main === module) {
  const report = check(); console.log('Sensorium parity guard: ' + report.verdict + ' - ' + report.checkedArtifacts + ' artifacts');
  report.drift.forEach(function (file) { console.error('DRIFT ' + file); });
  if (report.verdict !== 'PASS') process.exitCode = 1;
}

module.exports = { check };
