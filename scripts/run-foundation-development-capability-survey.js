'use strict';

const Survey = require('../organs/foundation-development-capability-survey-organ');

try {
  const result = Survey.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    batchId: result.batch.batchId,
    state: result.batch.state,
    sourceHandBatchId: result.batch.source.handBatchId,
    declarationsInventoried: result.batch.summary.declarationsInventoried,
    verifiedDeclarations: result.batch.summary.verifiedDeclarations,
    refusedDeclarations: result.batch.summary.refusedDeclarations,
    declaredCompatibilityWitnesses: result.batch.summary.declaredCompatibilityWitnesses,
    declaredExactCompatibilityWitnesses: result.batch.summary.declaredExactCompatibilityWitnesses,
    declaredPartialCompatibilityWitnesses: result.batch.summary.declaredPartialCompatibilityWitnesses,
    handsWithWitnesses: result.batch.summary.handsWithWitnesses,
    handsWithPartialOnlyWitnesses: result.batch.summary.handsWithPartialOnlyWitnesses,
    existingCapabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0,
    implementationsBuilt: 0,
    trainingAdmissions: 0,
    promotions: 0,
    worldActions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION CAPABILITY SURVEY REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
