#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildLiveRun } = require('./build-live-run');
const Lab = require('../../../shared/baseline-simulation-lab/baseline-simulation-lab');
const Capsule = require('../../../shared/portable-baseline-capsule/portable-baseline-capsule');
const Loop = require('../../../shared/verified-capability-loop/verified-capability-loop');
const Evidence = require('../../../tools/evidence-desk/evidence-core');

const root = path.resolve(__dirname, '../../..');
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function fileDigest(relative) { return Lab.sha256(fs.readFileSync(path.join(root, relative))); }

(async function main() {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'docs/steward-runs/2026-08-19-portable-baseline-capsule/CURRENT_SOFTWARE_BASELINE_CAPSULE.json'), 'utf8'));
  const observation = readJson('LIVE_COMPARISON_OBSERVATION.json');
  const evidence = readJson('NO_NEW_EVIDENCE_RECEIPT.json');
  const existingCycle = readJson('EXISTING_CAPABILITY_CYCLE.json');
  const zeroUsage = readJson('ZERO_USAGE_DECLARATION.json');

  check(Capsule.verify(baseline).pass, 'stored scoped software baseline capsule verifies');
  check(Capsule.verifyComparison(observation.comparison, baseline, baseline).pass, 'stored live comparison rebuilds from the exact same capsule');
  check(observation.comparison.state === 'NO_NEW_INFORMATION' && observation.comparison.automaticAction === false, 'stored comparison says no new information and authorizes no action');
  check((await Evidence.verify(evidence)).ok && evidence.observations[0].effective_verdict === 'PASS', 'Evidence Desk receipt is sealed and its deterministic claim is complete');
  check(Loop.verify(existingCycle).pass && existingCycle.state === 'REUSE_EXISTING', 'existing-capability cycle verifies and remains reuse-only');
  check(zeroUsage.usage.executionPerformed === false && Object.values(zeroUsage.usage).filter(value => typeof value === 'number').every(value => value === 0), 'generation-stage usage is explicitly zero');

  const run = await buildLiveRun();
  check(run.state === 'NO_NEW_INFORMATION' && run.holds.length === 0, 'live run stops cleanly at NO_NEW_INFORMATION');
  check((await Lab.verify(run)).pass, 'live run receipt verifies by exact rebuild');
  check(run.cycleReceipt.state === 'REUSE_EXISTING' && run.cycleReceipt.improvementClaim === 'NOT_ESTABLISHED', 'run emits one reuse-only capability cycle without an improvement claim');
  check(run.newInformationRefs.length === 0 && run.signals.length === 0, 'run declares no new evidence, counterexample, requirement, failure, or staged signal');
  check(run.budget.usage.executionPerformed === false && run.budget.assessment.state === 'WITHIN_LIMITS', 'run spends no generation budget');
  check(run.closureAssessment.state === 'CURRENT' && run.outputClosures.every(item => item.state === 'CURRENT' && !item.summarySubstituted), 'every later dependency closure is current and no summary substitutes for output');
  check(run.truth.modelInvokedByLab === false && run.truth.sourceExecutedByLab === false, 'live validator invoked no model and executed no submitted source');
  check(run.truth.automaticNextGeneration === false && run.truth.automaticCanon === false && run.truth.foundationMutation === false, 'run grants no recursive, CANON, or Foundation authority');
  check(run.seats.every(seat => seat.proofAuthority === 'NONE') && run.analysis.modelSeatCount === 0, 'seat provenance is not proof and no model participated in the live stop check');
  check(!/[A-Za-z]:\\\\/.test(JSON.stringify(run)), 'persistent live run contains no machine path');
  check(run.evidence.proofRefs[0].evidenceRef.sha256 === fileDigest('docs/steward-runs/2026-08-19-baseline-simulation-lab/LIVE_COMPARISON_OBSERVATION.json'), 'proof reference matches the stored comparison-observation bytes');
  check(run.adapters[0].outputSchemaRef.sha256 === fileDigest('shared/baseline-simulation-lab/baseline-simulation-lab-run.schema.json'), 'adapter output contract matches the current run schema bytes');

  console.log('\nBaseline Simulation Lab live audit: PASS (' + checks + ' checks)');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
