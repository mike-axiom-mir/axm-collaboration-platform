'use strict';

const Counterexamples = require('../organs/reasoning-counterexample-organ');

try {
  const result = Counterexamples.run();
  console.log(`${result.reused ? 'REUSED' : 'CREATED'} ${result.batch.batchId}`);
  console.log(`Real source receipts: ${result.batch.summary.sourceReceiptCount}`);
  console.log(`Synthetic interventions: ${result.batch.summary.interventions}`);
  console.log(`Worked: ${result.batch.summary.worked}`);
  console.log(`Did not work: ${result.batch.summary.didNotWork}`);
  console.log(`Appended: ${result.batch.summary.appended}; reused receipts: ${result.batch.summary.reused}`);
  console.log('All outputs remain private episodic evidence. No semantic truth or runtime promotion occurred.');
} catch (error) {
  console.error(`Reasoning counterexample practice failed: ${error.message}`);
  process.exitCode = 1;
}
