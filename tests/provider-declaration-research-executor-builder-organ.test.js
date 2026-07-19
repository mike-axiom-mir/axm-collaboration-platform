'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const ReadinessHands = require('../organs/reasoning-readiness-hand-organ');
const Affordances = require('../organs/reasoning-readiness-probe-affordance-organ');
const ProviderHands = require('../organs/provider-declaration-hand-organ');
const ResearchExams = require('../organs/provider-declaration-research-exam-organ');
const RecipeCell = require('../kernel/provider-declaration-research-executor-recipe-cell');
const Review = require('../organs/provider-declaration-research-executor-review-organ');
const Builder = require('../organs/provider-declaration-research-executor-builder-organ');

function contract(id, emits, accepts, consumes = []) {
  return { schema: 'axm.module-contract/v1', id, version: '1.0.0', provides: [], consumes, permissions: [], handoffs: { emits, accepts }, boundaries: { writes: [], refuses: ['automatic-world-action'] } };
}

function writeModule(workshopRoot, definition) {
  const directory = path.join(workshopRoot, 'tools', definition.id);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html>fixture\n');
  fs.writeFileSync(path.join(directory, 'module.contract.json'), JSON.stringify(contract(definition.id, definition.emits || [], definition.accepts || [], definition.consumes || []), null, 2) + '\n');
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schema: 'axm.tool-manifest/v1', id: definition.id, version: '1.0.0', status: 'TEST', entry: 'index.html', uses: [], permissions: [], contract: 'module.contract.json' }, null, 2) + '\n');
}

function writeService(workshopRoot, directory, id) {
  const target = path.join(workshopRoot, 'shared', directory, 'service.contract.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ schema: 'axm.shared-service-contract/v1', id, version: '1.0.0', status: 'TEST', provides: [], accepts: [], produces: [], boundaries: { automaticWrites: [], refuses: [] } }, null, 2) + '\n');
}

function snapshotFiles(root) {
  const result = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else result.push({ path: path.relative(root, target).replace(/\\/g, '/'), bytes: fs.readFileSync(target).toString('base64') });
    }
  }
  visit(root);
  return result;
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-provider-declaration-research-executor-'));
  const root = path.join(base, 'mirror');
  const workshopRoot = path.join(base, 'workshop');
  fs.mkdirSync(root, { recursive: true });
  writeModule(workshopRoot, { id: 'alpha', emits: ['axm.test/x-v1'] });
  writeModule(workshopRoot, { id: 'beta', emits: ['axm.test/y-v1'], accepts: ['axm.test/x-v1'], consumes: ['service:consumer-gap/provider-v1', 'service:bare-consumer-gap'] });
  writeModule(workshopRoot, { id: 'gamma', accepts: ['axm.test/y-v1'] });
  writeService(workshopRoot, 'exact-service', 'exact-service');
  writeService(workshopRoot, 'ambiguous-a', 'ambiguous-service');
  writeService(workshopRoot, 'ambiguous-b', 'ambiguous-service');
  const handoff = HandoffGraph.derive({ root, workshopRoot, stateDir: path.join(root, 'state', 'handoffs') });
  const requirements = ['consumer-gap', 'bare-consumer-gap', 'no-demand', 'exact-service', 'ambiguous-service'].map(id => ({ id, state: 'UNKNOWN', detail: 'No live readiness source declared' }));
  const snapshot = {
    schema: 'axm.technical-glasses/v1', ok: true, compiledAt: '2026-07-18T16:00:00.000Z', freshness: { fingerprint: 'f'.repeat(64) },
    modules: handoff.batch.contracts.map(item => ({
      id: item.moduleId,
      evidence: { manifest: item.manifestRelativePath, contract: item.contractRelativePath, contractDeclared: true, contractPass: true },
      readiness: item.moduleId === 'beta' ? requirements : [{ id: 'base', state: 'READY', detail: 'Fixture ready.' }]
    }))
  };
  const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot, stateDir: path.join(root, 'state', 'readiness') });
  const hands = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness, stateDir: path.join(root, 'state', 'hands') });
  const affordances = Affordances.derive({ root, workshopRoot, handDerived: hands, stateDir: path.join(root, 'state', 'affordances') });
  const providerHands = ProviderHands.derive({ root, workshopRoot, affordanceDerived: affordances, stateDir: path.join(root, 'state', 'provider-hands') });
  const research = ResearchExams.derive({ root, workshopRoot, providerDerived: providerHands, stateDir: path.join(root, 'state', 'research-exams') });
  const builderStateDir = path.join(root, 'state', 'research-executor-builder');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, research, builderStateDir };
}

function examFor(fx, requirementId) {
  return fx.research.batch.results.find(item => item.gapAssessment.requirementId === requirementId).researchExamRequest;
}

function reviewRequest(exam, decision, reason) {
  return {
    schema: Review.REQUEST_SCHEMA,
    examRequestId: exam.examRequestId,
    decision,
    reason,
    executor: decision === 'APPROVE_DISPOSABLE_EXECUTOR' ? RecipeCell.fixedExecutor() : null
  };
}

test('attributed review bridge seals only the fixed exam-bound disposable executor or an explicit HOLD', t => {
  const fx = fixture(t);
  const exam = examFor(fx, 'consumer-gap');
  const approved = Review.review(fx.research, reviewRequest(exam, 'APPROVE_DISPOSABLE_EXECUTOR', 'Synthetic test steward approves only the fixed ignored-state executor.'), { id: 'mike-test-steward', kind: 'HUMAN' }, { at: '2026-07-18T17:00:00.000Z' });
  assert.equal(approved.state, 'REVIEWED_EXECUTOR_RECIPE_SEALED_NOT_BUILT');
  assert.equal(approved.recipe.examRequestDigest, exam.examRequestDigest);
  assert.deepEqual(approved.recipe.executor, RecipeCell.fixedExecutor());
  assert.equal(approved.admission.classification, 'APPROVED_DISPOSABLE_EXECUTOR_BUILD');
  assert.ok(Object.values(approved.authority).every(value => value === false));
  assert.equal(Review.verify(approved, fx.research), true);

  const held = Review.review(fx.research, reviewRequest(exam, 'HOLD', 'No executor should be built in this review path.'), { id: 'mike-test-steward', kind: 'HUMAN' }, { at: '2026-07-18T17:01:00.000Z' });
  assert.equal(held.state, 'HOLD_RECORDED_WITH_NO_EXECUTOR');
  assert.equal(held.recipe.executor, null);
  assert.equal(held.admission.classification, 'HELD_EXECUTOR_NOT_APPROVED');

  assert.throws(() => Review.review(fx.research, reviewRequest(exam, 'HOLD', 'Automaton may not review.'), { id: 'mirror', kind: 'AI' }), /HUMAN/);
  assert.throws(() => Review.review(fx.research, Object.assign(reviewRequest(exam, 'HOLD', 'Unknown fields are refused.'), { install: true }), { id: 'mike-test-steward', kind: 'HUMAN' }), /unknown critical/);
  const missing = reviewRequest(exam, 'HOLD', 'Missing executor is refused.');
  delete missing.executor;
  assert.throws(() => Review.review(fx.research, missing, { id: 'mike-test-steward', kind: 'HUMAN' }), /missing explicit fields/);
  const openEnded = reviewRequest(exam, 'APPROVE_DISPOSABLE_EXECUTOR', 'Open-ended specs are refused.');
  openEnded.executor.kind = 'ARBITRARY_CODE_EXECUTOR';
  assert.throws(() => Review.review(fx.research, openEnded, { id: 'mike-test-steward', kind: 'HUMAN' }), /fixed disposable/);
});

test('approved recipe builds one ignored-state executor and passes all ten independent relation cases without evaluating architecture', t => {
  const fx = fixture(t);
  const beforeWorkshop = snapshotFiles(fx.workshopRoot);
  const exam = examFor(fx, 'consumer-gap');
  const reviewed = Review.review(fx.research, reviewRequest(exam, 'APPROVE_DISPOSABLE_EXECUTOR', 'Synthetic test approval for the fixed executor only.'), { id: 'mike-test-steward', kind: 'HUMAN' }, { at: '2026-07-18T17:10:00.000Z' });
  const derived = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, recipes: [reviewed.recipe], stateDir: fx.builderStateDir });
  assert.equal(derived.batch.summary.reviewedRecipes, 1);
  assert.equal(derived.batch.summary.approvedRecipes, 1);
  assert.equal(derived.batch.summary.executorCandidatesBuilt, 1);
  assert.equal(derived.batch.summary.candidateFilesGenerated, 5);
  assert.equal(derived.batch.summary.fixtureCasesExecuted, 10);
  assert.equal(derived.batch.summary.fixtureCasesNotApplicable, 0);
  assert.equal(derived.batch.summary.fixtureSuitesPassed, 1);
  assert.equal(derived.batch.summary.falseArchitectureProofCandidatesRejected, 1);
  assert.equal(derived.batch.summary.reviewBypassCandidatesRejected, 1);
  assert.equal(derived.batch.summary.architecturesSelected, 0);
  assert.equal(derived.batch.summary.architecturesEvaluated, 0);
  assert.equal(derived.batch.summary.providerCandidatesBuilt, 0);
  assert.equal(derived.batch.summary.providerDeclarationsWritten, 0);
  assert.equal(derived.batch.summary.liveExperimentsExecuted, 0);
  const result = derived.batch.results[0];
  assert.equal(result.candidate.state, 'DISPOSABLE_RESEARCH_EXECUTOR_FIXTURES_PASS_NO_ARCHITECTURE_EVALUATED_NOT_INSTALLED');
  assert.equal(result.fixtureReceipt.state, 'PASS');
  assert.equal(result.fixtureReceipt.architectureEvaluated, false);
  assert.equal(result.fixtureReceipt.caseResults.length, 10);
  assert.ok(result.fixtureReceipt.caseResults.every(item => item.passed));
  assert.equal(Builder.verifyBatch(derived.batch, derived.runDir, fx.research.batch, true), true);
  const response = Builder.respond(derived);
  assert.equal(response.state, 'DISPOSABLE_RESEARCH_EXECUTORS_FIXTURE_TESTED_NO_ARCHITECTURE_EVALUATED_NOT_INSTALLED');
  assert.equal(response.candidates.length, 1);
  assert.equal(response.candidates[0].architectureEvaluated, false);
  assert.deepEqual(snapshotFiles(fx.workshopRoot), beforeWorkshop);

  const executorFile = path.join(derived.runDir, result.candidate.directory, 'executor.js');
  const executor = require(executorFile);
  const complete = Builder.baseProjection(exam);
  const observation = executor.evaluate(complete);
  assert.equal(observation.state, 'STRUCTURALLY_DECLARED_AVAILABLE_AT_MOST');
  assert.equal(observation.architectureFitEstablished, false);
  assert.equal(observation.readinessEstablished, false);

  fs.appendFileSync(executorFile, ' ');
  assert.throws(() => Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, recipes: [reviewed.recipe], stateDir: fx.builderStateDir }), /candidate receipt mismatch|file hash mismatch/);
});

test('HOLD and empty paths create no candidate bytes, while selector-free exams preserve NOT_APPLICABLE', t => {
  const fx = fixture(t);
  const selectorExam = examFor(fx, 'consumer-gap');
  const held = Review.review(fx.research, reviewRequest(selectorExam, 'HOLD', 'Synthetic hold verifies the no-build path.'), { id: 'mike-test-steward', kind: 'HUMAN' }, { at: '2026-07-18T17:20:00.000Z' });
  const heldDerived = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, recipes: [held.recipe], stateDir: fx.builderStateDir });
  assert.equal(heldDerived.batch.summary.heldRecipes, 1);
  assert.equal(heldDerived.batch.summary.executorCandidatesBuilt, 0);
  assert.equal(heldDerived.batch.summary.candidateFilesGenerated, 0);
  assert.equal(heldDerived.batch.results[0].candidate, null);
  assert.equal(heldDerived.batch.results[0].fixtureReceipt, null);
  assert.equal(Builder.respond(heldDerived).state, 'REVIEWED_EXECUTOR_RECIPES_HELD_NO_CANDIDATES_BUILT');

  const empty = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, recipes: [], stateDir: fx.builderStateDir });
  assert.equal(empty.batch.results.length, 0);
  assert.equal(empty.batch.summary.executorCandidatesBuilt, 0);
  assert.equal(empty.batch.summary.candidateFilesGenerated, 0);
  assert.equal(Builder.respond(empty).state, 'NO_REVIEWED_EXECUTOR_RECIPES_SUBMITTED');

  const bareExam = examFor(fx, 'bare-consumer-gap');
  const bareReview = Review.review(fx.research, reviewRequest(bareExam, 'APPROVE_DISPOSABLE_EXECUTOR', 'Synthetic selector-free fixture coverage only.'), { id: 'mike-test-steward', kind: 'HUMAN' }, { at: '2026-07-18T17:21:00.000Z' });
  const bare = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, recipes: [bareReview.recipe], stateDir: fx.builderStateDir });
  const selectorCase = bare.batch.results[0].fixtureReceipt.caseResults.find(item => item.caseId === 'DEMANDED_SELECTOR_COVERAGE_MISSING');
  assert.equal(selectorCase.applicable, false);
  assert.equal(selectorCase.observedState, 'NOT_APPLICABLE');
  assert.equal(selectorCase.passed, true);
  assert.equal(bare.batch.summary.fixtureCasesExecuted, 9);
  assert.equal(bare.batch.summary.fixtureCasesNotApplicable, 1);

  const tampered = JSON.parse(JSON.stringify(bareReview.recipe));
  tampered.review.reason = 'tampered without resealing';
  assert.throws(() => Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, recipes: [tampered], stateDir: fx.builderStateDir }), /digest or content mismatch/);
});
