'use strict';

const path = require('path');
const Exam = require('../organs/workshop-transfer-regression-exam-organ');

function run() {
  const result = Exam.run();
  if (!result.exam) {
    console.log(`Workshop transfer regression revalidation: ${result.state}${result.reason ? ` (${result.reason})` : ''}`);
    return result;
  }
  const summary = result.exam.result.summary;
  console.log(`Workshop transfer regression revalidation: ${result.exam.state}`);
  console.log(`- cause: ${result.exam.result.causeClassification}`);
  console.log(`- contracts: ${summary.eligibleContracts - summary.contractBehaviorMismatches}/${summary.eligibleContracts} preserved`);
  console.log(`- routes: ${summary.exactRoutes - summary.routeBehaviorMismatches}/${summary.exactRoutes} preserved`);
  console.log(`- authority seams: ${summary.authoritySeams}; Workshop source executions: ${summary.workshopJavascriptExecuted}; repairs selected: ${summary.repairsSelected}`);
  console.log(`- evidence: ${path.resolve(result.runDir, 'exam.json')}`);
  return result;
}

if (require.main === module) {
  try { run(); } catch (error) { console.error(`REFUSED: ${error.message}`); process.exitCode = 1; }
}

module.exports = { run };
