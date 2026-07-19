'use strict';

const path = require('path');
const TechnicalGlasses = require('../adapters/workshop/technical-glasses-reader');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const ReadinessHands = require('../organs/reasoning-readiness-hand-organ');
const Affordances = require('../organs/reasoning-readiness-probe-affordance-organ');
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
  const hands = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness });
  const result = Affordances.derive({ root, workshopRoot, handDerived: hands });
  const response = Affordances.respond(result, { schema: Affordances.REQUEST_SCHEMA, limit: Affordances.MAX_HANDS });
  console.log(`Readiness probe affordance batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Observation: ${observation}; source hands ${hands.batch.batchId}`);
  console.log(`State: ${response.state}`);
  console.log(`Hands: ${result.batch.summary.handRequestsAssessed}; review packets: ${result.batch.summary.reviewPacketsProposed}; holds: ${result.batch.summary.noProviderHolds + result.batch.summary.ambiguousProviderHolds}`);
  for (const packet of response.reviewPackets) console.log(`- ${packet.recommendation.requirementId}: ${packet.recommendation.suggestedProbe.kind} ${packet.recommendation.suggestedProbe.targetRelativePath} / HUMAN review required / AVAILABLE ceiling`);
  for (const hold of response.holds) console.log(`- ${hold.requirementId}: ${hold.classification} / provider declarations ${hold.providerEvidence.length} / consumer bindings ${hold.consumerBindings.length}`);
  console.log(`Human reviews: ${result.batch.summary.humanReviewsCreated}; sealed recipes: ${result.batch.summary.recipesSealed}; candidates: ${result.batch.summary.candidatesBuilt}; live probes: ${result.batch.summary.liveProbesExecuted}; Workshop files: ${result.batch.summary.workshopFilesChanged}`);
}

run().catch(error => { console.error(`REFUSED: ${error.message}`); process.exitCode = 1; });
