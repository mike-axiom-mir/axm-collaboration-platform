'use strict';

const Organ = require('../organs/provider-declaration-hand-organ');

function run() {
  const result = Organ.derive();
  const response = Organ.respond(result, { schema: Organ.REQUEST_SCHEMA, limit: Organ.MAX_ASSESSMENTS });
  console.log(`Provider declaration hand batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Source affordances: ${result.batch.sourceAffordanceBatch.batchId}`);
  console.log(`State: ${response.state}`);
  console.log(`Assessments: ${result.batch.summary.affordanceAssessmentsEvaluated}; declaration hands: ${result.batch.summary.providerDeclarationHandsProposed}; present: ${result.batch.summary.declarationsPresentNoGap}; no-demand holds: ${result.batch.summary.noConsumerDemandHolds}; ambiguity holds: ${result.batch.summary.ambiguousProviderHolds}`);
  for (const proposal of response.proposals) console.log(`- ${proposal.requirementId}: ${proposal.consumerDemand.bindings.map(item => item.consumes).join(', ')} / provider, schema, path unresolved / NOT BUILT`);
  for (const hold of response.holds) console.log(`- ${hold.requirementId}: ${hold.classification}`);
  console.log(`Provider inference rejected: ${result.batch.summary.providerInferenceCandidatesRejected}; false AVAILABLE rejected: ${result.batch.summary.falseAvailableCandidatesRejected}`);
  console.log(`Candidate files: ${result.batch.summary.declarationCandidateFilesGenerated}; declarations written: ${result.batch.summary.providerDeclarationsWritten}; live probes: ${result.batch.summary.liveProbesExecuted}; Workshop files: ${result.batch.summary.workshopFilesChanged}; training: ${result.batch.summary.trainingReceiptsCreated}; world actions: ${result.batch.summary.worldActionsExecuted}`);
  return result;
}

if (require.main === module) run();
module.exports = { run };
