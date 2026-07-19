'use strict';

const Stewardship = require('../organs/cognitive-resource-calibration-stewardship-organ');

try {
  const calibrationKey = process.argv[2];
  if (!calibrationKey) throw new Error('usage: node scripts/evaluate-cognitive-resource-calibration.js <calibration-key>');
  const result = Stewardship.report(calibrationKey);
  process.stdout.write(JSON.stringify({
    ok: true,
    reportId: result.report.reportId,
    state: result.report.state,
    source: result.report.source,
    targetCoverageBasisPoints: result.report.targetCoverageBasisPoints,
    coverage: result.report.coverage,
    chronology: result.report.chronology,
    calibrationClaim: null,
    accuracyClaim: null,
    selections: 0,
    promotions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`COGNITIVE-RESOURCE CALIBRATION REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
