'use strict';

const Router = require('../organs/foundation-development-frontier-router-organ');

try {
  const result = Router.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    batchId: result.batch.batchId,
    state: result.batch.state,
    sourceSnapshotId: result.batch.source.snapshotId,
    nonPassingDimensions: result.batch.summary.nonPassingDimensions,
    evidenceAcquisitionRequests: result.batch.summary.evidenceAcquisitionRequests,
    regressionInvestigationRequests: result.batch.summary.regressionInvestigationRequests,
    prioritySelections: 0,
    evidenceFabrications: 0,
    repairsSelected: 0,
    implementationsBuilt: 0,
    trainingAdmissions: 0,
    promotions: 0,
    worldActions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION DEVELOPMENT FRONTIER ROUTER REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
