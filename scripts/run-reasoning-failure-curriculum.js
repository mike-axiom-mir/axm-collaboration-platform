'use strict';

const path = require('path');
const Curriculum = require('../organs/reasoning-failure-curriculum-organ');

try {
  const result = Curriculum.run();
  const summary = result.batch.summary;
  console.log(`Reasoning failure curriculum: ${result.batch.state}`);
  console.log(`Verified receipts: ${summary.verifiedReceipts}`);
  console.log(`Real local outcomes: ${summary.realLocalPositiveReceipts} positive / ${summary.realLocalNegativeReceipts} negative`);
  console.log(`Failure signatures: ${summary.distinctFailureSignatures}; recurrent proposals: ${summary.curriculumRequestsProposed}; recurrence holds: ${summary.insufficientRecurrenceHolds}`);
  console.log(`Synthetic negative proof exclusions: ${summary.syntheticNegativeReceiptsExcluded}; contract-derived exclusions: ${summary.contractDerivedNegativeReceiptsExcluded}`);
  console.log('Training admissions: 0; code builds: 0; repairs selected: 0; organs installed: 0; promotions: 0; world actions: 0');
  console.log(`Batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`State: ${path.resolve(result.runDir)}`);
} catch (error) {
  console.error(`REFUSED: ${error.message}`);
  process.exitCode = 1;
}
