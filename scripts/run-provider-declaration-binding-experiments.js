'use strict';

const Organ = require('../organs/provider-declaration-binding-experiment-planner-organ');

function run() {
  const result = Organ.derive();
  const response = Organ.respond(result, { schema: Organ.REQUEST_SCHEMA, limit: Organ.MAX_RESULTS });
  const summary = result.batch.summary;
  console.log(`Provider declaration binding experiment batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Source implementation evidence: ${result.batch.sourceImplementationEvidenceBatch.batchId}`);
  console.log(`State: ${response.state}`);
  console.log(`Implementation results: ${summary.implementationEvidenceResultsEvaluated}; matrices: ${summary.experimentMatricesProposed}; no-evidence holds: ${summary.noImplementationEvidenceHolds}`);
  for (const matrix of response.matrices) console.log(`- ${matrix.requirementId}: ${matrix.candidateSources.length} candidates × ${matrix.hypothesesRepresented.length} hypotheses = ${matrix.experimentFrames.length} unselected frames / ${matrix.state}`);
  for (const hold of response.holds) console.log(`- ${hold.requirementId}: ${hold.state}`);
  console.log(`Frame selections rejected: ${summary.frameSelectionsRejected}; consumer-permission copies rejected: ${summary.permissionCopiesRejected}`);
  console.log(`Frames selected: ${summary.framesSelected}; provider identities inferred: ${summary.providerIdentitiesInferred}; outer requirements bound: ${summary.outerRequirementsBound}; permissions inferred: ${summary.permissionsInferred}; sources executed: ${summary.sourcesExecuted}; provider candidates built: ${summary.providerCandidatesBuilt}; declarations written: ${summary.providerDeclarationsWritten}; Workshop files: ${summary.workshopFilesChanged}; training: ${summary.trainingReceiptsCreated}`);
  return result;
}

if (require.main === module) run();
module.exports = { run };
