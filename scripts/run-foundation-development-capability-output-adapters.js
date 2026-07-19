'use strict';

const Planner = require('../organs/foundation-development-capability-output-adapter-planner-organ');

try {
  const result = Planner.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    batchId: result.batch.batchId,
    state: result.batch.state,
    sourceSurveyBatchId: result.batch.source.surveyBatchId,
    evidenceHandRequests: result.batch.summary.evidenceHandRequests,
    partialOutputWitnesses: result.batch.summary.partialOutputWitnesses,
    outputAdapterRequests: result.batch.summary.outputAdapterRequests,
    adaptersBuilt: 0,
    adaptersSelected: 0,
    sourceExecutions: 0,
    capabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0,
    evidenceAcquisitions: 0,
    evidenceRelabelings: 0,
    promotions: 0,
    worldActions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION CAPABILITY OUTPUT-ADAPTER PLANNER REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
