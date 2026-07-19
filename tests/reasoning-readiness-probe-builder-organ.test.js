'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const RecipeCell = require('../kernel/readiness-probe-recipe-cell');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const ReadinessHands = require('../organs/reasoning-readiness-hand-organ');
const Builder = require('../organs/reasoning-readiness-probe-builder-organ');
const ReviewBridge = require('../organs/reasoning-readiness-probe-review-organ');

function contract(id, emits, accepts) {
  return { schema: 'axm.module-contract/v1', id, version: '1.0.0', provides: [], consumes: [], permissions: [], handoffs: { emits, accepts }, boundaries: { writes: [], refuses: ['automatic-world-action'] } };
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-probe-builder-'));
  const root = path.join(base, 'mirror');
  const workshopRoot = path.join(base, 'workshop');
  fs.mkdirSync(root, { recursive: true });
  const definitions = [
    { id: 'alpha', emits: ['axm.test/x-v1'], accepts: [] },
    { id: 'beta', emits: ['axm.test/y-v1'], accepts: ['axm.test/x-v1'] },
    { id: 'gamma', emits: [], accepts: ['axm.test/y-v1'] },
    { id: 'decoy', emits: [], accepts: ['axm.test/z-v1'] },
    { id: 'omega', emits: ['axm.test/q-v1'], accepts: [] },
    { id: 'psi', emits: [], accepts: ['axm.test/q-v1'] }
  ];
  for (const item of definitions) {
    const directory = path.join(workshopRoot, 'tools', item.id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'module.contract.json'), JSON.stringify(contract(item.id, item.emits, item.accepts), null, 2) + '\n');
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schema: 'axm.tool-manifest/v1', id: item.id, version: '1.0.0', status: 'TEST', entry: 'index.html', uses: [], permissions: [], contract: 'module.contract.json' }, null, 2) + '\n');
  }
  const handoff = HandoffGraph.derive({ root, workshopRoot, stateDir: path.join(root, 'state', 'handoffs') });
  const snapshot = {
    schema: 'axm.technical-glasses/v1', ok: true, compiledAt: '2026-07-18T12:00:00.000Z', freshness: { fingerprint: 'f'.repeat(64) },
    modules: handoff.batch.contracts.map(item => ({
      id: item.moduleId,
      evidence: { manifest: item.manifestRelativePath, contract: item.contractRelativePath, contractDeclared: true, contractPass: true },
      readiness: item.moduleId === 'beta'
        ? [{ id: 'unseen-file-service', state: 'UNKNOWN', detail: 'No live readiness source declared' }, { id: 'unseen-directory-service', state: 'UNKNOWN', detail: 'No readiness probe declared' }, { id: 'unseen-foundation-service', state: 'UNKNOWN', detail: 'No readiness probe declared' }]
        : [{ id: 'base', state: 'READY', detail: 'Fixture ready.' }]
    }))
  };
  const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot, stateDir: path.join(root, 'state', 'readiness') });
  const hands = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness, stateDir: path.join(root, 'state', 'hands') });
  const stateDir = path.join(root, 'state', 'probe-builders');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, handoff, readiness, hands, stateDir };
}

function recipe(hand, kind, target, decision = 'APPROVE_DISPOSABLE_CANDIDATE') {
  return RecipeCell.sealRecipe({
    handRequestId: hand.requestId,
    handRequestDigest: hand.requestDigest,
    decision,
    review: { actorId: 'mike-test-steward', actorKind: 'HUMAN', reviewedAt: '2026-07-18T12:30:00.000Z', reason: 'Test-only reviewed disposable presence recipe.' },
    probe: decision === 'HOLD' ? null : { kind, targetRelativePath: target, presentState: 'AVAILABLE', missingState: 'UNKNOWN', requiredPermission: 'files:read', liveExecutionApproved: false }
  });
}

test('recipe cell binds explicit human review and refuses unsafe or overclaiming recipes', t => {
  const fx = fixture(t);
  const hand = fx.hands.batch.results.find(item => item.requirementId === 'unseen-file-service').handRequest;
  const approved = recipe(hand, 'FILE_EXISTS', 'services/example/ready.json');
  const assessment = RecipeCell.evaluate({ handRequest: hand, recipe: approved });
  assert.equal(assessment.classification, 'APPROVED_DISPOSABLE_CANDIDATE_BUILD');
  assert.ok(Object.values(assessment.authority).every(value => value === false));
  assert.equal(RecipeCell.verify(assessment, hand, approved), true);

  assert.throws(() => RecipeCell.sealRecipe({ handRequestId: hand.requestId, handRequestDigest: hand.requestDigest, decision: 'APPROVE_DISPOSABLE_CANDIDATE', review: { actorId: 'planner', actorKind: 'AI', reviewedAt: '2026-07-18T12:30:00.000Z', reason: 'not human' }, probe: { kind: 'FILE_EXISTS', targetRelativePath: 'x' } }), /human review/);
  assert.throws(() => recipe(hand, 'FILE_EXISTS', '../escape'), /without traversal/);
  assert.throws(() => RecipeCell.sealRecipe({ handRequestId: hand.requestId, handRequestDigest: hand.requestDigest, decision: 'APPROVE_DISPOSABLE_CANDIDATE', review: { actorId: 'mike', actorKind: 'HUMAN', reviewedAt: '2026-07-18T12:30:00.000Z', reason: 'overclaim' }, probe: { kind: 'FILE_EXISTS', targetRelativePath: 'x', presentState: 'READY' } }), /exceeds/);
  assert.throws(() => RecipeCell.sealRecipe({ handRequestId: hand.requestId, handRequestDigest: hand.requestDigest, decision: 'APPROVE_DISPOSABLE_CANDIDATE', review: { actorId: 'mike', actorKind: 'HUMAN', reviewedAt: '2026-07-18T12:30:00.000Z', reason: 'live' }, probe: { kind: 'FILE_EXISTS', targetRelativePath: 'x', liveExecutionApproved: true } }), /exceeds/);
  const tampered = JSON.parse(JSON.stringify(approved));
  tampered.probe.targetRelativePath = 'other';
  assert.throws(() => RecipeCell.evaluate({ handRequest: hand, recipe: tampered }), /digest or content mismatch/);
});

test('builder handles unseen file and directory recipes without new requirement-specific code', t => {
  const fx = fixture(t);
  const byRequirement = new Map(fx.hands.batch.results.map(item => [item.requirementId, item.handRequest]));
  const recipes = [
    recipe(byRequirement.get('unseen-file-service'), 'FILE_EXISTS', 'service-a/ready.flag'),
    recipe(byRequirement.get('unseen-directory-service'), 'DIRECTORY_EXISTS', 'service-b/queue')
  ];
  const built = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, stateDir: fx.stateDir, handDerived: fx.hands, recipes });
  assert.equal(built.batch.summary.reviewedRecipes, 2);
  assert.equal(built.batch.summary.candidatesBuilt, 2);
  assert.equal(built.batch.summary.candidateCodeFilesGenerated, 6);
  assert.equal(built.batch.summary.fixtureSuitesPassed, 2);
  assert.equal(built.batch.summary.probesInstalled, 0);
  assert.equal(built.batch.summary.liveProbesExecuted, 0);
  assert.equal(built.batch.summary.workshopFilesChanged, 0);
  assert.equal(built.batch.summary.trainingReceiptsCreated, 0);
  assert.equal(built.batch.summary.worldActionsExecuted, 0);
  assert.equal(Builder.verifyBatch(built.batch, built.runDir, fx.hands.batch, true), true);
  assert.equal(built.batch.authority.disposableCandidateWrite, true);
  assert.equal(built.batch.authority.sandboxFixtureExecution, true);
  for (const result of built.batch.results) {
    assert.equal(result.fixtureReceipt.state, 'PASS');
    assert.equal(result.fixtureReceipt.observations.presentState, 'AVAILABLE');
    assert.equal(result.fixtureReceipt.observations.missingState, 'UNKNOWN');
    assert.equal(result.candidate.state, 'SANDBOX_FIXTURES_PASS_NEEDS_INDEPENDENT_LIVE_REVIEW_NOT_INSTALLED');
    const probeFile = path.join(built.runDir, result.candidate.directory, 'probe.js');
    const source = fs.readFileSync(probeFile, 'utf8');
    assert.doesNotMatch(source, /https?:|writeFile|mkdir|rmSync|child_process/);
    assert.doesNotMatch(source, /observation\('READY'/);
  }
  const response = Builder.respond(built);
  assert.equal(response.state, 'DISPOSABLE_CANDIDATES_BUILT_AND_FIXTURE_TESTED_NOT_INSTALLED');
  assert.equal(response.summary.candidatesBuilt, 2);
  assert.equal(response.authority.install, false);
  assert.equal(response.authority.liveProbeExecution, false);
});

test('builder handles exact declared module, shared-service, and foundation-plane recipes without requirement-specific code', t => {
  const fx = fixture(t);
  const byRequirement = new Map(fx.hands.batch.results.map(item => [item.requirementId, item.handRequest]));
  const recipes = [
    recipe(byRequirement.get('unseen-file-service'), 'DECLARED_MODULE_AVAILABLE', 'tools/unseen-file-service/manifest.json'),
    recipe(byRequirement.get('unseen-directory-service'), 'DECLARED_SHARED_SERVICE_AVAILABLE', 'shared/unseen-directory-service/service.contract.json'),
    recipe(byRequirement.get('unseen-foundation-service'), 'DECLARED_FOUNDATION_SERVICE_AVAILABLE', 'shared/foundation/service-contract.json')
  ];
  const built = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, stateDir: fx.stateDir, handDerived: fx.hands, recipes });
  assert.equal(built.batch.summary.candidatesBuilt, 3);
  assert.equal(built.batch.summary.fixtureSuitesPassed, 3);
  assert.ok(built.batch.results.every(item => item.fixtureReceipt.cases.malformedDeclaration === 'PASS'));
  assert.ok(built.batch.results.every(item => item.fixtureReceipt.observations.presentState === 'AVAILABLE'));
  assert.ok(built.batch.results.every(item => item.fixtureReceipt.observations.typeMismatchState === 'UNKNOWN'));
  assert.ok(built.batch.results.every(item => item.fixtureReceipt.observations.malformedDeclarationState === 'UNKNOWN'));
  const foundation = built.batch.results.find(item => item.recipe.probe.kind === 'DECLARED_FOUNDATION_SERVICE_AVAILABLE');
  assert.equal(foundation.fixtureReceipt.cases.duplicateDeclaration, 'PASS');
  assert.equal(foundation.fixtureReceipt.observations.duplicateDeclarationState, 'UNKNOWN');
  assert.ok(built.batch.results.every(item => item.probeInstalled === false && item.liveProbeExecuted === false && item.workshopChanged === false));
  assert.equal(Builder.verifyBatch(built.batch, built.runDir, fx.hands.batch, true), true);
});

test('HOLD and empty reviewed inputs generate no candidate bytes', t => {
  const fx = fixture(t);
  const hand = fx.hands.batch.results.find(item => item.requirementId === 'unseen-file-service').handRequest;
  const held = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, stateDir: fx.stateDir, handDerived: fx.hands, recipes: [recipe(hand, 'FILE_EXISTS', 'held/target', 'HOLD')] });
  assert.equal(held.batch.summary.heldRecipes, 1);
  assert.equal(held.batch.summary.candidatesBuilt, 0);
  assert.equal(held.batch.results[0].candidate, null);
  assert.equal(held.batch.results[0].recipe.probe, null);
  assert.equal(Builder.respond(held).state, 'REVIEWED_RECIPES_HELD_NO_CANDIDATES_BUILT');

  const empty = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, stateDir: fx.stateDir, handDerived: fx.hands, recipes: [] });
  assert.equal(empty.batch.summary.reviewedRecipes, 0);
  assert.equal(empty.batch.summary.candidateCodeFilesGenerated, 0);
  assert.equal(Builder.respond(empty).state, 'NO_REVIEWED_RECIPES_SUBMITTED');
});

test('builder refuses wrong hand binding and detects candidate tampering on reuse', t => {
  const fx = fixture(t);
  const hands = fx.hands.batch.results.filter(item => item.handRequest).map(item => item.handRequest);
  const reviewed = recipe(hands[0], 'FILE_EXISTS', 'service/ready.flag');
  const wrong = JSON.parse(JSON.stringify(reviewed));
  wrong.handRequestId = hands[1].requestId;
  assert.throws(() => Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, stateDir: fx.stateDir, handDerived: fx.hands, recipes: [wrong] }), /hand|digest|content/);

  const built = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, stateDir: fx.stateDir, handDerived: fx.hands, recipes: [reviewed] });
  const probeFile = path.join(built.runDir, built.batch.results[0].candidate.directory, 'probe.js');
  fs.appendFileSync(probeFile, '// tampered\n');
  assert.throws(() => Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, stateDir: fx.stateDir, handDerived: fx.hands, recipes: [reviewed] }), /file hash mismatch/);
});

test('human review bridge seals the current hand without manual digests and HOLD needs no fake target', t => {
  const fx = fixture(t);
  const hand = fx.hands.batch.results.find(item => item.requirementId === 'unseen-file-service').handRequest;
  const approved = ReviewBridge.review(fx.hands, {
    schema: ReviewBridge.REQUEST_SCHEMA,
    handRequestId: hand.requestId,
    decision: 'APPROVE_DISPOSABLE_CANDIDATE',
    reason: 'Reviewed fixture target for the isolated transfer test.',
    probe: { kind: 'FILE_EXISTS', targetRelativePath: 'reviewed/ready.flag', presentState: 'AVAILABLE', missingState: 'UNKNOWN', requiredPermission: 'files:read', liveExecutionApproved: false }
  }, { id: 'mike-test-steward', kind: 'HUMAN' }, { at: '2026-07-18T12:45:00.000Z' });
  assert.equal(approved.state, 'REVIEWED_RECIPE_SEALED_NOT_BUILT');
  assert.equal(approved.recipe.handRequestDigest, hand.requestDigest);
  assert.equal(approved.admission.classification, 'APPROVED_DISPOSABLE_CANDIDATE_BUILD');
  assert.ok(Object.values(approved.authority).every(value => value === false));
  assert.equal(ReviewBridge.verify(approved, fx.hands), true);
  const built = Builder.derive({ root: fx.root, workshopRoot: fx.workshopRoot, stateDir: fx.stateDir, handDerived: fx.hands, recipes: [approved.recipe] });
  assert.equal(built.batch.summary.candidatesBuilt, 1);

  const held = ReviewBridge.review(fx.hands, {
    schema: ReviewBridge.REQUEST_SCHEMA,
    handRequestId: hand.requestId,
    decision: 'HOLD',
    reason: 'No evidence yet identifies a semantically valid readiness target.',
    probe: null
  }, { id: 'mike-test-steward', kind: 'HUMAN' }, { at: '2026-07-18T12:46:00.000Z' });
  assert.equal(held.state, 'HOLD_RECORDED_WITH_NO_PROBE');
  assert.equal(held.recipe.probe, null);
  assert.equal(held.admission.classification, 'HELD_RECIPE_NOT_APPROVED');
  assert.throws(() => ReviewBridge.review(fx.hands, { schema: ReviewBridge.REQUEST_SCHEMA, handRequestId: hand.requestId, decision: 'HOLD', reason: 'hold', probe: null }, { id: 'planner', kind: 'AI' }, { at: '2026-07-18T12:46:00.000Z' }), /HUMAN/);
  assert.throws(() => ReviewBridge.review(fx.hands, { schema: ReviewBridge.REQUEST_SCHEMA, handRequestId: hand.requestId, decision: 'HOLD', reason: 'hold', probe: null, hidden: true }, { id: 'mike', kind: 'HUMAN' }, { at: '2026-07-18T12:46:00.000Z' }), /unknown critical/);
  assert.throws(() => ReviewBridge.review(fx.hands, { schema: ReviewBridge.REQUEST_SCHEMA, handRequestId: hand.requestId, decision: 'HOLD', reason: 'hold' }, { id: 'mike', kind: 'HUMAN' }, { at: '2026-07-18T12:46:00.000Z' }), /missing explicit fields/);
});
