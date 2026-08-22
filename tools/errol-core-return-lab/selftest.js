#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('./core');
const Examples = require('./examples');

let assertions = 0;
function check(value, message) { assert.ok(value, message); assertions += 1; }
function equal(actual, expected, message) { assert.deepStrictEqual(actual, expected, message); assertions += 1; }
async function rejects(fn, pattern, message) {
  await assert.rejects(fn, pattern, message);
  assertions += 1;
}

async function main() {
  const manifest = require('./manifest.json');
  const contract = require('./module.contract.json');
  const receipt = require('./INTAKE_RECEIPT.json');
  const capabilityReport = require('./capability-gap-report.json');
  equal(manifest.status, 'EXPERIMENTAL', 'manifest status');
  equal(manifest.installed, false, 'module stays uninstalled');
  equal(manifest.promoted, false, 'module stays unpromoted');
  equal(manifest.permissions, [], 'module has no permissions');
  equal(contract.id, manifest.id, 'contract and manifest ids agree');
  equal(contract.boundaries.writes, [], 'contract has no writes');
  check(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses CANON');
  equal(receipt.source.archive_code_executed, false, 'archive was not executed');
  equal(receipt.authority.automatic_merge, false, 'receipt grants no merge');
  equal(capabilityReport.overall, 'DEGRADED', 'optional capability gaps remain visible');
  equal(capabilityReport.requirements.find(item => item.id === 'private-local-experimental-intake').status, 'READY', 'private local route is ready');
  equal(capabilityReport.requirements.find(item => item.id === 'generalized-deep-archive-verification').status, 'OPTIONAL_GAP', 'general deep archive verifier remains optional gap');
  equal(capabilityReport.requirements.find(item => item.id === 'commercial-or-public-release').status, 'OPTIONAL_GAP', 'commercial rights remain optional authority gap');
  check(capabilityReport.missingCapabilities.includes('archive.content-ledger.verify.general'), 'deep archive gap is named');
  check(capabilityReport.missingCapabilities.includes('authority.errol.commercial-rights.confirmed'), 'commercial authority gap is named');

  const canonicalA = Core.canonicalJson({ b: 2, a: [3, { z: true, y: false }] });
  const canonicalB = Core.canonicalJson({ a: [3, { y: false, z: true }], b: 2 });
  equal(canonicalA, canonicalB, 'canonical JSON sorts object keys');
  equal(await Core.stableDigest({ a: 1 }), await Core.stableDigest({ a: 1 }), 'stable digest repeats');

  const observation = await Core.createObservation({
    source_ref: 'source:local-test', summary: 'Bounded test observation', payload: { seen: true },
    evidence_refs: ['evidence:test'], uncertainty: 0.2, captured_at: '2026-08-15T08:00:00Z'
  });
  equal(observation.raw_payload_stored, false, 'observation never stores raw payload');
  equal(observation.raw_payload, null, 'raw payload is absent');
  equal(observation.automatic_learning, false, 'observation cannot auto-learn');
  check(/^obs:[a-f0-9]{24}$/.test(observation.observation_id), 'observation has a content id');

  const observedClaim = await Core.createClaim({
    claim_type: 'observation', statement: 'The bounded test input contained seen=true.',
    source_refs: [observation.observation_id], creator_ref: 'tester:local', confidence: 1,
    created_at: '2026-08-15T08:01:00Z'
  });
  const observedAssessment = await Core.assessClaim(observedClaim, { assessed_at: '2026-08-15T08:01:01Z' });
  equal(observedAssessment.valid, true, 'source-bound observation claim passes');

  const weakInference = await Core.createClaim({
    claim_type: 'inference', statement: 'A derived conclusion without lineage.', creator_ref: 'tester:local',
    created_at: '2026-08-15T08:02:00Z'
  });
  const weakAssessment = await Core.assessClaim(weakInference, { assessed_at: '2026-08-15T08:02:01Z' });
  equal(weakAssessment.valid, false, 'unlineaged inference is held');
  check(weakAssessment.violations.includes('inference_derivation_missing'), 'missing parent is reported');
  check(weakAssessment.violations.includes('inference_model_lineage_missing'), 'missing model is reported');

  const hypothesisClaim = await Core.createClaim({
    claim_type: 'hypothesis', statement: 'The observed pattern may recur.',
    derived_from_claim_ids: [observedClaim.claim_id], model_ref: 'model:test', model_version: 1,
    creator_ref: 'tester:local', counterevidence_search_performed: false,
    created_at: '2026-08-15T08:03:00Z'
  });
  const hypothesisAssessment = await Core.assessClaim(hypothesisClaim, {
    known_claims: [observedClaim], assessed_at: '2026-08-15T08:03:01Z'
  });
  equal(hypothesisAssessment.valid, false, 'hypothesis without counterevidence search is held');
  check(hypothesisAssessment.violations.includes('hypothesis_counterevidence_search_missing'), 'counterevidence gap is explicit');

  const modelBefore = JSON.stringify(Examples.MODEL);
  const frame = await Core.createAttentionFrame(Examples.FRAME);
  equal(frame.reversible, true, 'attention is reversible');
  equal(frame.mutates_model, false, 'attention cannot mutate the model');
  const projection = await Core.projectModel({ model: Examples.MODEL, attention_frame: frame, created_at: Examples.FRAME.created_at });
  equal(JSON.stringify(Examples.MODEL), modelBefore, 'projection leaves source model unchanged');
  equal(projection.focus_complete, false, 'missing focus key keeps projection incomplete');
  equal(projection.missing_focus_keys, ['missing_live_permission'], 'missing key is reported');
  equal(projection.model_mutated, false, 'projection reports no mutation');
  check(!Object.prototype.hasOwnProperty.call(projection.content, 'private_notes'), 'unfocused private state is excluded');
  check(projection.epistemic_notice.includes('not landscape'), 'projection carries truth notice');
  const tamperedFrame = Object.assign({}, frame, { focus_keys: ['private_notes'] });
  await rejects(
    () => Core.projectModel({ model: Examples.MODEL, attention_frame: tamperedFrame, created_at: Examples.FRAME.created_at }),
    /does not match frame_id/, 'tampered frame is rejected'
  );
  await rejects(
    () => Core.projectModel({ model: Examples.MODEL, attention_frame: frame, created_at: '2026-08-15T11:00:00Z' }),
    /expired/, 'expired frame is rejected'
  );
  const strictFrame = await Core.createAttentionFrame(Object.assign({}, Examples.FRAME, {
    label: 'strict missing-key test', missing_key_policy: 'error'
  }));
  await rejects(
    () => Core.projectModel({ model: Examples.MODEL, attention_frame: strictFrame, created_at: Examples.FRAME.created_at }),
    /missing focus keys/, 'strict missing-key policy rejects projection'
  );

  const passing = await Core.evaluateTriad(Examples.TRIAD);
  equal(passing.passes_minimum_gate, true, 'complete synthetic triad passes minimum evidence gate');
  equal(passing.status, 'hypothesis', 'passing result remains hypothesis');
  equal(passing.auto_canon_allowed, false, 'passing result cannot canonize');
  equal(passing.promotion_eligible, false, 'passing result cannot promote');
  equal(passing.permanent_merge_allowed, false, 'passing result cannot permanently merge');
  equal(passing.execution_allowed, false, 'passing result cannot execute');
  equal(passing.requires_merge_gate, true, 'passing result requires merge gate');
  check(passing.synergy_gain > 0.05, 'passing example beats every pair');
  check(passing.compression_gain > 0.05, 'passing example has measured compression');
  check(/^triad_candidate:[a-f0-9]{24}$/.test(passing.candidate_id), 'candidate has stable content id');
  check(passing.epistemic_notice.includes('externally supplied hypothesis'), 'hypothesis carries truth notice');

  const renamedInput = JSON.parse(JSON.stringify(Examples.TRIAD));
  renamedInput.measurement.proposed_center_label = 'A renamed possible center';
  const renamed = await Core.evaluateTriad(renamedInput);
  equal(renamed.structure_id, passing.structure_id, 'renaming center preserves structure id');
  equal(renamed.candidate_id, passing.candidate_id, 'renaming center preserves task candidate id');
  check(renamed.evaluation_id !== passing.evaluation_id, 'renaming center changes exact evaluation id');

  const pairSufficientInput = JSON.parse(JSON.stringify(Examples.TRIAD));
  pairSufficientInput.measurement.joint_score = 0.58;
  pairSufficientInput.measurement.replicate_scores = [0.57, 0.58, 0.59, 0.58];
  const pairSufficient = await Core.evaluateTriad(pairSufficientInput);
  equal(pairSufficient.passes_minimum_gate, false, 'pair-sufficient case is held');
  check(pairSufficient.gate_reasons.includes('synergy_below_threshold'), 'pair sufficiency is named');

  const missingPairInput = JSON.parse(JSON.stringify(Examples.TRIAD));
  missingPairInput.measurement.pair_scores.pop();
  const missingPair = await Core.evaluateTriad(missingPairInput);
  equal(missingPair.passes_minimum_gate, false, 'missing pair baseline is held');
  check(missingPair.gate_reasons.some(value => value.startsWith('pair_measurements_missing:')), 'missing pair is named');

  const noCounterInput = JSON.parse(JSON.stringify(Examples.TRIAD));
  noCounterInput.measurement.counterevidence_search_performed = false;
  noCounterInput.measurement.counterevidence_search_summary = '';
  const noCounter = await Core.evaluateTriad(noCounterInput);
  check(noCounter.gate_reasons.includes('counterevidence_search_missing'), 'missing counterevidence search is held');

  const otherTaskInput = JSON.parse(JSON.stringify(Examples.TRIAD));
  otherTaskInput.measurement.task_ref = 'task:different-held-out-domain';
  const otherTask = await Core.evaluateTriad(otherTaskInput);
  equal(otherTask.structure_id, passing.structure_id, 'different task preserves structure id');
  check(otherTask.candidate_id !== passing.candidate_id, 'different task gets a different candidate id');

  const unnamedCenterInput = JSON.parse(JSON.stringify(Examples.TRIAD));
  unnamedCenterInput.measurement.proposed_center_label = '';
  await rejects(() => Core.evaluateTriad(unnamedCenterInput), /proposed_center_label/, 'evaluator refuses to invent a center');
  await rejects(() => Core.evaluateTriad({ entities: Examples.TRIAD.entities.slice(0, 2) }), /exactly three/, 'evaluator requires exactly three members');

  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const style = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  for (const id of ['modelInput', 'frameInput', 'projectModel', 'triadInput', 'evaluateTriad']) {
    check(html.includes(`id="${id}"`), `UI contains ${id}`);
  }
  check(html.includes('installed: false'), 'UI exposes uninstalled state');
  check(html.includes('promoted: false'), 'UI exposes unpromoted state');
  check(html.includes('aria-live="polite"'), 'UI provides live output regions');
  assert.doesNotThrow(() => new Function(app)); assertions += 1;
  check(style.includes('@media (max-width: 760px)'), 'UI has a mobile layout');
  check(style.includes('prefers-reduced-motion'), 'UI respects reduced motion');

  console.log(`Errol Core Return Lab selftest: PASS (${assertions} assertions)`);
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
