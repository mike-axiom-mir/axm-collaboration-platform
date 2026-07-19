'use strict';

const Organ = require('../organs/provider-declaration-architecture-survey-organ');

function run() {
  const result = Organ.derive();
  const response = Organ.respond(result, { schema: Organ.REQUEST_SCHEMA, limit: Organ.MAX_RESULTS });
  const summary = result.batch.summary;
  console.log(`Provider declaration architecture survey batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Source research exams: ${result.batch.sourceResearchExamBatch.batchId}`);
  console.log(`Inventory: ${summary.inventoryDocuments} JSON documents; oversized refused: ${summary.inventoryOversizedDocumentsRefused}`);
  console.log(`State: ${response.state}`);
  console.log(`Research results: ${summary.researchExamResultsEvaluated}; surveys: ${summary.surveysProposed}; no-exam holds: ${summary.noExamHolds}`);
  for (const survey of response.surveys) {
    console.log(`- ${survey.requirementId}: ${survey.relevantPatterns.length} relevant patterns / ${survey.completePatternWitnesses} complete current-relation witnesses / ${survey.hypothesisEvidence.length} hypotheses UNTESTED`);
  }
  for (const hold of response.holds) console.log(`- ${hold.requirementId}: ${hold.state}`);
  console.log(`Frequency selections rejected: ${summary.frequencySelectionsRejected}; cross-document merges rejected: ${summary.crossDocumentMergesRejected}`);
  console.log(`Provider identities inferred: ${summary.providerIdentitiesInferred}; architectures selected: ${summary.architecturesSelected}; architectures evaluated: ${summary.architecturesEvaluated}; provider candidates: ${summary.providerCandidatesBuilt}; declarations written: ${summary.providerDeclarationsWritten}; live experiments: ${summary.liveExperimentsExecuted}; Workshop files: ${summary.workshopFilesChanged}; training: ${summary.trainingReceiptsCreated}`);
  return result;
}

if (require.main === module) run();
module.exports = { run };
