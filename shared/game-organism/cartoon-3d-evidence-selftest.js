#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Adapter = require('./cartoon-3d-evidence');
const GameOrganism = require('./game-organism');

const registry = Adapter.loadRegistry();
const checked = Adapter.validateRegistry(registry);
assert.equal(checked.pass, true);
assert.equal(checked.organCount, 100);
assert.equal(checked.familyCount, 11);
assert.equal(registry.local_rerun.tests_passed, 3612);
assert.equal(registry.organs.filter((organ) => organ.local_rerun === 'PASS').length, 100);
assert.equal(registry.organs.filter((organ) => organ.automatic_installation || organ.automatic_promotion || organ.canon).length, 0);

const evidence = Adapter.createEvidenceOrgan(registry);
assert.equal(GameOrganism.validateOrgan(evidence).pass, true);
assert.equal(evidence.category, 'evidence');
assert.equal(evidence.implementation.status, 'EXPERIMENTAL');
assert.equal(evidence.verification.automatic_checks.length, 100);
assert.ok(evidence.verification.human_judgments.includes('visual-quality'));
assert.ok(evidence.verification.human_judgments.includes('gameplay-readability'));
assert.ok(evidence.verification.human_judgments.includes('release-approval'));

const example = Adapter.createToonGameEvidenceExample(registry);
assert.equal(example.receipt.verdict, 'CANDIDATE_READY');
assert.equal(example.receipt.truth.executionStarted, false);
assert.equal(example.receipt.truth.canonicalGameChanged, false);
assert.equal(example.receipt.truth.automaticPromotion, false);
assert.equal(example.receipt.truth.humanReleaseRequired, true);
assert.equal(example.receipt.evidence_plan.filter((item) => item.includes('cartoon-3d:')).length, 100);

const status = Adapter.readiness(registry);
assert.equal(status.status, 'CANDIDATE_READY');
assert.equal(status.candidate_evidence_available, true);
assert.equal(status.live_visual_approved, false);
assert.equal(status.gameplay_approved, false);
assert.equal(status.licensing_approved, false);

const held = JSON.parse(JSON.stringify(registry));
held.organs[0].local_rerun = 'FAIL';
assert.equal(Adapter.validateRegistry(held).pass, false);
assert.throws(() => Adapter.createEvidenceOrgan(held), /not a passing TEST-HOLD candidate/);

console.log('Cartoon 3D game evidence adapter: PASS - 100 locally tested organs compose into a candidate-only game evidence plan; visual, gameplay, licensing, and release approval remain human gates');
