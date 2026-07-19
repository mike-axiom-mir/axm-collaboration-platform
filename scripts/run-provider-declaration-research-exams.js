'use strict';

const Organ = require('../organs/provider-declaration-research-exam-organ');

function run() {
  const result = Organ.derive();
  const response = Organ.respond(result, { schema: Organ.REQUEST_SCHEMA, limit: Organ.MAX_RESULTS });
  console.log(`Provider declaration research exam batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Source declaration hands: ${result.batch.sourceProviderDeclarationHandBatch.batchId}`);
  console.log(`State: ${response.state}`);
  console.log(`Hand results: ${result.batch.summary.providerDeclarationHandResultsEvaluated}; research exams: ${result.batch.summary.researchExamRequestsProposed}; present no-exam: ${result.batch.summary.declarationsPresentNoExam}; no-demand holds: ${result.batch.summary.noConsumerDemandResearchHolds}; ambiguity holds: ${result.batch.summary.ambiguousProviderResearchHolds}`);
  for (const proposal of response.examRequests) console.log(`- ${proposal.examRequest.sourceHand.requirementId}: 4 untested architectures / 10 independent case families / executor NOT BUILT`);
  for (const hold of response.holds) console.log(`- ${hold.requirementId}: ${hold.classification}`);
  console.log(`Provider builds rejected: ${result.batch.summary.providerBuildCandidatesRejected}; false resolutions rejected: ${result.batch.summary.falseResolutionCandidatesRejected}`);
  console.log(`Architectures selected: ${result.batch.summary.architecturesSelected}; executors: ${result.batch.summary.examExecutorsBuilt}; fixtures: ${result.batch.summary.fixtureFilesGenerated}; provider candidates: ${result.batch.summary.providerCandidatesBuilt}; declarations written: ${result.batch.summary.providerDeclarationsWritten}; live experiments: ${result.batch.summary.liveExperimentsExecuted}; Workshop files: ${result.batch.summary.workshopFilesChanged}; training: ${result.batch.summary.trainingReceiptsCreated}`);
  return result;
}

if (require.main === module) run();
module.exports = { run };
