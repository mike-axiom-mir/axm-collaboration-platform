'use strict';

const Observatory = require('../organs/foundation-development-observatory-organ');

try {
  const result = Observatory.run();
  const observed = result.snapshot.dimensions.filter(item => item.state === 'OBSERVED_PASS').length;
  const holds = result.snapshot.dimensions.filter(item => item.state.startsWith('HOLD_')).length;
  const regressions = result.snapshot.dimensions.filter(item => item.state === 'REGRESSION_REQUIRES_REVIEW').length + result.snapshot.comparison.regressions.length;
  process.stdout.write(JSON.stringify({
    ok: true,
    snapshotId: result.snapshot.snapshotId,
    snapshotDigest: result.snapshot.snapshotDigest,
    state: result.snapshot.state,
    dimensionsObserved: observed,
    openEvidenceGates: holds,
    regressions,
    singleIntelligenceScore: false,
    trainingAdmissions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION OBSERVATORY REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
