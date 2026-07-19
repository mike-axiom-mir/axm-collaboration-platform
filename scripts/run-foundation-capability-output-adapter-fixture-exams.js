'use strict';

const Exam = require('../organs/foundation-capability-output-adapter-fixture-exam-organ');

try {
  const result = Exam.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    batchId: result.batch.batchId,
    state: result.batch.state,
    sourceAdapterRequestBatchId: result.batch.source.adapterRequestBatchId,
    adapterRequestsExamined: result.batch.summary.adapterRequestsExamined,
    reusableAdapterImplementationsExamined: result.batch.summary.reusableAdapterImplementationsExamined,
    independentFixtureCasesAuthored: result.batch.summary.independentFixtureCasesAuthored,
    syntheticAdapterExecutions: result.batch.summary.syntheticAdapterExecutions,
    passedFixtureCases: result.batch.summary.passedFixtureCases,
    failedFixtureCases: result.batch.summary.failedFixtureCases,
    realNativeArtifactsAdapted: 0,
    nativeSourcesExecuted: 0,
    adapterImplementationsSelected: 0,
    capabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0,
    evidenceAdmissions: 0,
    evidenceRelabelings: 0,
    promotions: 0,
    worldActions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION CAPABILITY OUTPUT-ADAPTER FIXTURE EXAM REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
