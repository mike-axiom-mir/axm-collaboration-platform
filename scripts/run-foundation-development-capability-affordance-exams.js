'use strict';

const Planner = require('../organs/foundation-development-capability-affordance-exam-planner-organ');

try {
  const result = Planner.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    batchId: result.batch.batchId,
    state: result.batch.state,
    sourceSurveyBatchId: result.batch.source.surveyBatchId,
    evidenceHandRequests: result.batch.summary.evidenceHandRequests,
    declaredCompatibilityWitnesses: result.batch.summary.declaredCompatibilityWitnesses,
    declaredPartialCompatibilityWitnesses: result.batch.summary.declaredPartialCompatibilityWitnesses,
    independentAffordanceExamRequests: result.batch.summary.independentAffordanceExamRequests,
    handsHeldWithoutWitness: result.batch.summary.handsHeldWithoutWitness,
    handsHeldForOutputAdapter: result.batch.summary.handsHeldForOutputAdapter,
    fixturesAuthored: 0,
    sourceExecutions: 0,
    examResults: 0,
    capabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0,
    implementationsBuilt: 0,
    promotions: 0,
    worldActions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION CAPABILITY AFFORDANCE EXAM PLANNER REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
