'use strict';

const fs = require('fs');
const path = require('path');
const TechnicalGlasses = require('../adapters/workshop/technical-glasses-reader');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const ReadinessHands = require('../organs/reasoning-readiness-hand-organ');
const Builder = require('../organs/reasoning-readiness-probe-builder-organ');
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
  let recipes = [];
  if (process.env.AXM_REVIEWED_PROBE_RECIPES_FILE) {
    const recipeFile = path.resolve(process.env.AXM_REVIEWED_PROBE_RECIPES_FILE);
    const parsed = JSON.parse(fs.readFileSync(recipeFile, 'utf8'));
    recipes = Array.isArray(parsed) ? parsed : parsed.recipes;
    if (!Array.isArray(recipes)) throw new Error('reviewed recipe file must contain an array or a recipes array');
  }
  const handoff = HandoffGraph.derive({ root, workshopRoot });
  const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot });
  const hands = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness });
  const result = Builder.derive({ root, workshopRoot, handDerived: hands, recipes });
  const response = Builder.respond(result);
  console.log(`Readiness probe candidate batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
  console.log(`Observation: ${observation}; source hands ${hands.batch.batchId}`);
  console.log(`State: ${response.state}`);
  console.log(`Reviewed recipes: ${response.summary.reviewedRecipes}; approved: ${response.summary.approvedRecipes}; held: ${response.summary.heldRecipes}`);
  console.log(`Candidates: ${response.summary.candidatesBuilt}; generated files: ${response.summary.candidateCodeFilesGenerated}; fixture suites passed: ${response.summary.fixtureSuitesPassed}; failed: ${response.summary.fixtureSuitesFailed}`);
  console.log(`Installs: ${response.summary.probesInstalled}; live probes: ${response.summary.liveProbesExecuted}; Workshop files: ${response.summary.workshopFilesChanged}; training: ${response.summary.trainingReceiptsCreated}; world actions: ${response.summary.worldActionsExecuted}`);
}

run().catch(error => { console.error(`REFUSED: ${error.message}`); process.exitCode = 1; });
