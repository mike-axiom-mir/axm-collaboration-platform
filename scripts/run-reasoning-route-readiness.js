'use strict';

const path = require('path');
const TechnicalGlasses = require('../adapters/workshop/technical-glasses-reader');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
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
  const result = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot });
  const summary = result.batch.summary;
  console.log(`Route readiness batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Observation: ${observation}; compiled ${result.observation.compiledAt || 'missing'}; fingerprint ${result.observation.fingerprint.slice(0, 16)}`);
  console.log(`Projected graph: ${summary.graphRoutes} routes; ${summary.graphModules} modules; ${summary.readinessRequirements} typed requirements`);
  console.log(`Readiness: ${summary.readyRoutes} READY; ${summary.availableRoutes} AVAILABLE; ${summary.needsActionRoutes} NEEDS_ACTION; ${summary.blockedRoutes} BLOCKED`);
  console.log(`Reasoning classifications: ${summary.classificationsMatched}/${summary.graphRoutes} matched; ${summary.classificationMismatches} mismatches`);
  console.log(`Training receipts: ${summary.trainingReceiptsCreated}; world actions: ${summary.worldActionsExecuted}; Frontier: ${result.batch.frontier.state}`);
}

run().catch(error => {
  console.error(`REFUSED: ${error.message}`);
  process.exitCode = 1;
});
