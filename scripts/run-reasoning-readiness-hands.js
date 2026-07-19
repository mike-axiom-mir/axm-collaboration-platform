'use strict';

const path = require('path');
const TechnicalGlasses = require('../adapters/workshop/technical-glasses-reader');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const ReadinessHands = require('../organs/reasoning-readiness-hand-organ');
const WorkshopRoot = require('../config/workshop-root');

async function run() {
  const root = path.resolve(__dirname, '..');
  const workshopRoot = WorkshopRoot.resolve({ configRoot: root });
  let snapshot = null;
  let observation = 'FILE_SNAPSHOT_FALLBACK';
  try {
    const result = await TechnicalGlasses.observe({ baseUrl: process.env.AXM_WORKSHOP_URL || 'http://127.0.0.1:8788' });
    snapshot = result.snapshot;
    observation = 'REFRESHED_READ_ONLY_TECHNICAL_GLASSES';
  } catch (error) {
    observation += ` (${String(error.message || error).slice(0, 180)})`;
  }
  const handoff = HandoffGraph.derive({ root, workshopRoot });
  const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot });
  const result = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness });
  const summary = result.batch.summary;
  console.log(`Readiness hand batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Observation: ${observation}; source readiness ${readiness.batch.batchId}`);
  console.log(`UNKNOWN requirement IDs: ${summary.unknownRequirementIds}; missing-probe hand requests: ${summary.missingProbeHandRequests}; inspection holds: ${summary.unknownInspectionHolds}`);
  console.log(`Impacted manifest-bound routes: ${summary.impactedManifestBoundRoutes}; classifications: ${summary.classificationsMatched}/${summary.unknownRequirementIds}; false READY rejected: ${summary.falseReadyCandidatesRejected}`);
  for (const item of result.batch.results.filter(item => item.handRequest)) console.log(`- ${item.requirementId}: ${item.assessment.counts.impactedRoutes} routes / ${item.assessment.counts.observedModules} modules / ${item.handRequest.requestId}`);
  console.log(`Code files: ${summary.codeFilesGenerated}; installs: ${summary.probesInstalled}; starts or repairs: ${summary.servicesStartedOrRepaired}; training: ${summary.trainingReceiptsCreated}; world actions: ${summary.worldActionsExecuted}`);
}

run().catch(error => { console.error(`REFUSED: ${error.message}`); process.exitCode = 1; });
