'use strict';

const path = require('path');
const Exam = require('../organs/reasoning-memory-guidance-exam-organ');

try {
  const execution = Exam.run();
  const result = execution.result;
  console.log(`Reasoning memory guidance exam: ${result.state}`);
  console.log(`Frozen cases: ${result.summary.passed}/${result.summary.cases}; failed: ${result.summary.failed}`);
  console.log(`Normative improvements: ${result.summary.normativeImprovements}; held memory opportunities: ${result.summary.heldMemoryOpportunities}`);
  console.log(`Canaries: ${result.summary.canariesPassed}/${result.summary.canaries}`);
  console.log(`Receipts: ${result.summary.receiptInventory} (${result.summary.realLocalReceipts} real / ${result.summary.syntheticReceipts} synthetic / ${result.summary.contractDerivedReceipts} contract-derived)`);
  console.log(`Promotion: ${result.promotion.state}; runtime pointer changed: ${result.promotion.runtimePointerChanged}`);
  console.log(`Result: ${result.resultId}${execution.reused ? ' (reused)' : ''}`);
  console.log(`State: ${path.resolve(execution.runDir)}`);
} catch (error) {
  console.error(`REFUSED: ${error.message}`);
  process.exitCode = 1;
}
