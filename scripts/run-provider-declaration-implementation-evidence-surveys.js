'use strict';

const Organ = require('../organs/provider-declaration-implementation-evidence-survey-organ');

function run() {
  const result = Organ.derive();
  const response = Organ.respond(result, { schema: Organ.REQUEST_SCHEMA, limit: Organ.MAX_RESULTS });
  const summary = result.batch.summary;
  console.log(`Provider declaration implementation evidence survey batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Source architecture surveys: ${result.batch.sourceArchitectureSurveyBatch.batchId}`);
  console.log(`Inventory: ${summary.inventorySources} JavaScript sources; oversized refused: ${summary.inventoryOversizedSourcesRefused}`);
  console.log(`State: ${response.state}`);
  console.log(`Architecture results: ${summary.architectureSurveyResultsEvaluated}; evidence surveys: ${summary.evidenceSurveysProposed}; no-survey holds: ${summary.noArchitectureSurveyHolds}`);
  for (const survey of response.evidenceSurveys) {
    console.log(`- ${survey.requirementId}: ${survey.selectorSources.length} selector-bearing sources / ${survey.selectorCoverage.filter(item => item.sourceWitnesses > 0).length} demanded selectors witnessed / ${survey.state}`);
  }
  for (const hold of response.holds) console.log(`- ${hold.requirementId}: ${hold.state}`);
  console.log(`Provider inferences rejected: ${summary.providerInferencesRejected}; frequency selections rejected: ${summary.frequencySelectionsRejected}`);
  console.log(`Provider identities inferred: ${summary.providerIdentitiesInferred}; outer requirements bound: ${summary.outerRequirementsBound}; implementations selected: ${summary.implementationsSelected}; sources executed: ${summary.sourcesExecuted}; architectures selected: ${summary.architecturesSelected}; architectures evaluated: ${summary.architecturesEvaluated}; provider candidates: ${summary.providerCandidatesBuilt}; declarations written: ${summary.providerDeclarationsWritten}; Workshop files: ${summary.workshopFilesChanged}; training: ${summary.trainingReceiptsCreated}`);
  return result;
}

if (require.main === module) run();
module.exports = { run };
