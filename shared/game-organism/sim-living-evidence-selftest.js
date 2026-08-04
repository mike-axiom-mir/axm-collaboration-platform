'use strict';

const assert = require('assert');
const GameOrganism = require('./game-organism');
const SimLiving = require('./sim-living-evidence');

const registry = SimLiving.loadRegistry();
const checked = SimLiving.validateRegistry(registry);
assert(checked.pass, checked.errors.join('; '));
assert.strictEqual(checked.moduleCount, 100);
assert.strictEqual(checked.familyCount, 10);
assert.strictEqual(checked.operationCount, 400);
assert.strictEqual(checked.requiredEdges, 366);
assert.strictEqual(checked.optionalHooks, 128);

const organ = SimLiving.createEvidenceOrgan(registry);
assert(GameOrganism.validateOrgan(organ).pass);
assert.strictEqual(organ.category, 'evidence');
assert.strictEqual(organ.verification.automatic_checks.length, 109);
assert(organ.verification.human_judgments.includes('authoritative-world-state-owner-and-migration-approval'));

const example = SimLiving.createSimLivingGameEvidenceExample(registry);
assert.strictEqual(example.receipt.verdict, 'CANDIDATE_READY');
assert.deepStrictEqual(example.receipt.errors, []);
assert(example.receipt.evidence_plan.some((item) => item.includes('sim-living-module:axm.sim.model-descriptor:static-blueprint-and-holds-present')));
assert(example.receipt.evidence_plan.some((item) => item.includes('sim-living-module:axm.sim.bounded-living-systems-orchestrator:static-blueprint-and-holds-present')));
assert(example.receipt.human_judgments.some((item) => item.includes('scientific-safety-and-predictive-nonclaim-clarity')));
assert.strictEqual(example.receipt.truth.executionStarted, false);
assert.strictEqual(example.receipt.truth.canonicalGameChanged, false);
assert.strictEqual(example.receipt.truth.automaticPromotion, false);
assert.strictEqual(example.receipt.truth.humanReleaseRequired, true);

const readiness = SimLiving.readiness(registry);
assert.strictEqual(readiness.candidate_evidence_ready, true);
assert.strictEqual(readiness.static_source_integrity, 'PASS');
assert.strictEqual(readiness.static_blueprint_graph, 'PASS');
assert.strictEqual(readiness.legacy_summary_index_holds, 2);
assert.strictEqual(readiness.executable_source_modules_proven, false);
assert.strictEqual(readiness.behavioral_fixtures_executed, false);
assert.strictEqual(readiness.representative_performance_measured, false);
assert.strictEqual(readiness.authoritative_world_integration_approved, false);
assert.strictEqual(readiness.scientific_or_safety_validity_proven, false);
assert.strictEqual(readiness.human_gameplay_approved, false);
assert.strictEqual(readiness.published, false);
assert.strictEqual(readiness.canon, false);
assert.strictEqual(readiness.release_approved, false);

console.log('Sim Living Run 102 game evidence adapter: PASS - 100 static living-system module blueprints compose into a candidate-only game evidence plan; source runtime, world mutation, scientific validity, performance, publication, and release remain unproven');
