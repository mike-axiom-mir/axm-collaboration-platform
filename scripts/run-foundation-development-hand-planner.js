'use strict';

const Planner = require('../organs/foundation-development-hand-planner-organ');

try {
  const result = Planner.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    batchId: result.batch.batchId,
    state: result.batch.state,
    sourceFrontierBatchId: result.batch.source.frontierBatchId,
    evidenceHandRequests: result.batch.summary.evidenceHandRequests,
    machineReadableNeedHolds: result.batch.summary.machineReadableNeedHolds,
    externalEvidenceIntakeHands: result.batch.summary.externalEvidenceIntakeHands,
    passiveObservationHands: result.batch.summary.passiveObservationHands,
    independentRegressionExamHands: result.batch.summary.independentRegressionExamHands,
    prioritiesSelected: 0,
    capabilitiesClaimed: 0,
    organsRequired: 0,
    implementationsBuilt: 0,
    trainingAdmissions: 0,
    promotions: 0,
    worldActions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION DEVELOPMENT HAND PLANNER REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
