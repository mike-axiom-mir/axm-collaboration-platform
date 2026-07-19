'use strict';

const fs = require('fs');
const path = require('path');
const Builder = require('../organs/provider-declaration-research-executor-builder-organ');

function run() {
  let recipes = [];
  const supplied = process.env.AXM_REVIEWED_PROVIDER_DECLARATION_RESEARCH_EXECUTOR_RECIPES_FILE;
  if (supplied) {
    const target = path.resolve(supplied);
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    recipes = Array.isArray(parsed) ? parsed : parsed.recipes;
    if (!Array.isArray(recipes)) throw new Error('reviewed provider declaration research executor recipe file must contain an array or a recipes array');
  }
  const result = Builder.derive({ recipes });
  const response = Builder.respond(result);
  console.log(`Provider declaration research executor batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Source research exams: ${result.batch.sourceResearchExamBatch.batchId}`);
  console.log(`State: ${response.state}`);
  console.log(`Reviewed recipes: ${response.summary.reviewedRecipes}; approved: ${response.summary.approvedRecipes}; held: ${response.summary.heldRecipes}`);
  console.log(`Disposable executors: ${response.summary.executorCandidatesBuilt}; files: ${response.summary.candidateFilesGenerated}; fixture cases: ${response.summary.fixtureCasesExecuted}; suites passed: ${response.summary.fixtureSuitesPassed}`);
  console.log(`Architectures selected: ${response.summary.architecturesSelected}; architectures evaluated: ${response.summary.architecturesEvaluated}; providers: ${response.summary.providerCandidatesBuilt}; declarations: ${response.summary.providerDeclarationsWritten}; live experiments: ${response.summary.liveExperimentsExecuted}; Workshop files: ${response.summary.workshopFilesChanged}; training: ${response.summary.trainingReceiptsCreated}`);
  return result;
}

if (require.main === module) {
  try { run(); } catch (error) { console.error(`REFUSED: ${error.message}`); process.exitCode = 1; }
}
module.exports = { run };
