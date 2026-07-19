'use strict';

const Organ = require('../organs/foundation-native-evidence-eligibility-organ');

try {
  const result = Organ.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    state: result.batch.state,
    batchId: result.batch.batchId,
    artifactsExamined: result.batch.summary.artifactsExamined,
    nativeReceiptsVerified: result.batch.summary.nativeReceiptsVerified,
    realLocalArtifacts: result.batch.summary.realLocalArtifacts,
    negativeArtifacts: result.batch.summary.negativeArtifacts,
    eligibleEvidenceCandidates: result.batch.summary.eligibleEvidenceCandidates,
    evidenceAdmissions: result.batch.summary.evidenceAdmissions,
    eventInductions: result.batch.summary.eventInductions,
    reused: result.reused
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION NATIVE EVIDENCE ELIGIBILITY REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
