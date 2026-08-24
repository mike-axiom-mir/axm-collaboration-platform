'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Planner = require('./code-creation-session-planner.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function digest(character) { return `sha256:${character.repeat(64)}`; }
function input() {
  return {
    projectId: 'browser-game-demo',
    goal: 'build a browser game',
    primaryLanguageId: 'javascript',
    primaryRole: 'game-runtime',
    activeLanguageIds: ['html', 'css', 'javascript'],
    preferredLanguageIds: ['html', 'css', 'javascript'],
    roleBindings: {
      'document-shell': 'html',
      'style-layout': 'css',
      'game-runtime': 'javascript'
    },
    intent: 'build',
    observation: {
      goals: ['browser game'],
      capabilities: ['deterministic state'],
      gaps: ['runtime evidence'],
      constraints: ['offline'],
      risks: ['runtime regression'],
      requirements: ['game loop', 'state'],
      signals: ['game loop', 'state', 'verification'],
      factCodes: ['BUILD_REQUEST'],
      requestedPerspectives: ['runtime-behavior'],
      roleIds: ['gameplay-programmer'],
      domainOverlays: ['games']
    },
    direction: {
      actorClass: 'HUMAN',
      directionalPrompt: 'Keep alternatives separate and return them for review.',
      constraints: ['no automatic winner']
    },
    production: {
      draftCount: 4,
      variantAxes: [
        { axis: 'control-strategy', instruction: 'Explore a fixed-step control structure.', tags: ['runtime'] },
        { axis: 'state-shape', instruction: 'Explore an explicit state-machine structure.', tags: ['state'] }
      ],
      budgetCeilings: {
        maxTotalDraftRevisions: 8,
        maxRevisionsPerDraft: 4,
        maxArtifactBuilds: 4,
        maxAdmissionChecks: 4,
        maxQuickTests: 2,
        maxHeavyVerifierRuns: 1
      }
    }
  };
}
function roots(statuses = ['PASS', 'PASS', 'PASS', 'PASS']) {
  return Planner.ROOTS.map((root, index) => ({
    root,
    status: statuses[index],
    evidenceDigest: digest(String(index + 1)),
    reasonCodes: ['reviewed']
  }));
}

const request = Planner.createRequest(input());
const gate = Planner.evaluateRootGate({ request, roots: roots() });
const plan = Planner.plan({ request, rootGate: gate });
const repeat = Planner.plan({ request, rootGate: gate });

test('request schema and version are exact', () => assert.strictEqual(request.schema, Planner.REQUEST_SCHEMA) && assert.strictEqual(request.version, Planner.VERSION));
test('request is byte deterministic', () => assert.strictEqual(Planner.canon(request), Planner.canon(Planner.createRequest(input()))));
test('request digest is stable', () => assert.strictEqual(request.requestSha256, Planner.createRequest(input()).requestSha256));
test('four-root gate binds the exact request', () => assert.strictEqual(gate.requestSha256, request.requestSha256));
test('four-root gate preserves exact root order', () => assert.deepStrictEqual(gate.roots.map(row => row.root), Planner.ROOTS));
test('four-root technical gate passes only four PASS decisions', () => assert.strictEqual(gate.result, 'ROOT_GATE_PASS'));
test('root evidence bindings are not called independent proof', () => assert.strictEqual(gate.truth.suppliedEvidenceDigestsAreBindingsNotIndependentProof, true));
test('Mike final merge gate remains explicit', () => assert.strictEqual(gate.truth.mikeFinalMergeGatePreserved, true));
test('complete composition produces a non-executing plan', () => assert.strictEqual(plan.result, 'CREATION_SESSION_PLAN_READY_NO_EXECUTION'));
test('complete plan is byte deterministic', () => assert.strictEqual(Planner.canon(plan), Planner.canon(repeat)));
test('complete plan verifies by exact independent rebuild', () => assert.strictEqual(Planner.verifyPlan(plan, request, gate).result, 'PLAN_VERIFIED_EXACT'));
test('caller explicitly selects the primary language', () => assert.strictEqual(plan.selectedLanguage.selectionMode, 'CALLER_EXPLICIT') && assert.strictEqual(plan.selectedLanguage.languageId, 'javascript'));
test('selected language is bound to one exact organ', () => assert.strictEqual(plan.selectedLanguage.organId, 'code.organ.javascript.v1') && assert(/^[0-9a-f]{64}$/.test(plan.selectedLanguage.organSha256)));
test('organ planner carries grammar-native profile identity', () => assert.strictEqual(plan.analysis.organPlan.organId, 'code.organ.javascript.v1') && assert.strictEqual(plan.analysis.organPlan.grammarProfileDigest, plan.analysis.grammarPlan.profileDigest));
test('all 102 specialist eyes review the bounded observation', () => assert.strictEqual(plan.analysis.discoveryReport.summary.eyeCount, 102));
test('only the explicit language cheatcode bank is evaluated', () => assert.strictEqual(plan.analysis.cheatcodeEvaluation.languageId, 'javascript') && assert.strictEqual(plan.analysis.cheatcodeEvaluation.result, 'CHEATCODE_EVALUATION_READY_NO_ACTION'));
test('discipline and grammar views intersect without authority', () => assert.strictEqual(plan.analysis.disciplinePlan.schema, 'axm.code.discipline-grammar-intersection.v1') && assert.strictEqual(plan.analysis.disciplinePlan.authority.workspaceMutation, false));
test('template direction remains a selection capsule', () => assert.strictEqual(plan.analysis.disciplinePlan.templateSelection.schema, 'axm.code.template-selection.v1'));
test('prebuild twin resolves exact caller role bindings', () => assert.strictEqual(plan.analysis.prebuildPlan.simulation.sourceGenerationReady, true) && assert.strictEqual(plan.analysis.prebuildPlan.simulation.requiredUnboundRoles.length, 0));
test('machine keyboard emits a layout but no source', () => assert.strictEqual(plan.analysis.keyboardLayout.result, 'MACHINE_KEYBOARD_READY') && assert.strictEqual(JSON.stringify(plan.analysis.keyboardLayout).includes('sourceCode'), false));
test('admission policy is planned before a candidate exists', () => assert.strictEqual(plan.analysis.admissionPolicy.result, 'ADMISSION_POLICY_READY'));
test('production batch contains four separate editable slots', () => assert.strictEqual(plan.production.batch.draftCount, 4) && assert.strictEqual(plan.production.draftSet.drafts.length, 4));
test('production variants remain caller declared', () => assert.strictEqual(plan.production.batch.variantMode, 'CALLER_DECLARED_DIRECTED_VARIANTS'));
test('initial production budget is within caller ceilings', () => assert.strictEqual(plan.production.budgetStatus.result, 'PRODUCTION_WORK_WITHIN_BUDGET'));
test('build window begins from planning evidence only', () => assert.strictEqual(plan.production.windowState.truth.runtimeCorrectnessClaimed, false) && assert.strictEqual(plan.production.windowState.truth.toolExecuted, false));
test('production context binds direction, batch, and budget digests', () => assert.strictEqual(plan.production.contextCard.directionSha256, plan.direction.directionSha256) && assert.strictEqual(plan.production.contextCard.production.batchSha256, plan.production.batch.batchSha256) && assert.strictEqual(plan.production.contextCard.production.budget.budgetSha256, plan.production.budget.budgetSha256));
test('renderer remains a typed deferred seam', () => assert.strictEqual(plan.deferredSeams.renderer, 'RENDERER_ADAPTER_AND_EXACT_EDIT_PROGRAM_REQUIRED'));
test('sandbox remains a separately authorized deferred seam', () => assert.strictEqual(plan.deferredSeams.sandbox, 'EXACT_ARTIFACT_AND_SEPARATELY_AUTHORIZED_ENFORCED_EXECUTOR_REQUIRED'));
test('no source was generated', () => assert.strictEqual(plan.truth.sourceGenerated, false) && assert.strictEqual(JSON.stringify(plan).includes('"sourceCode"'), false));
test('no candidate was executed', () => assert.strictEqual(plan.truth.candidateExecuted, false));
test('no provider or network was used', () => assert.strictEqual(plan.truth.providerCalled, false) && assert.strictEqual(plan.truth.networkUsed, false));
test('no workspace mutation occurred', () => assert.strictEqual(plan.truth.workspaceMutated, false));
test('no integration, promotion, or CANON authority exists', () => assert.strictEqual(plan.truth.merged, false) && assert.strictEqual(plan.truth.promoted, false) && assert.strictEqual(plan.truth.canonChanged, false));

test('root HOLD stops before composition', () => {
  const heldGate = Planner.evaluateRootGate({ request, roots: roots(['PASS', 'HOLD', 'PASS', 'PASS']) });
  const heldPlan = Planner.plan({ request, rootGate: heldGate });
  assert.strictEqual(heldPlan.result, 'ROOT_GATE_BLOCKED_CREATION');
  assert.strictEqual(heldPlan.analysis, undefined);
});
test('root FAIL stops before composition', () => {
  const failedGate = Planner.evaluateRootGate({ request, roots: roots(['FAIL', 'PASS', 'PASS', 'PASS']) });
  assert.strictEqual(Planner.plan({ request, rootGate: failedGate }).result, 'ROOT_GATE_BLOCKED_CREATION');
});
test('root order drift is refused', () => {
  const drifted = roots();
  [drifted[0], drifted[1]] = [drifted[1], drifted[0]];
  assert.throws(() => Planner.evaluateRootGate({ request, roots: drifted }), /ROOT_GATE_ORDER_OR_ID_INVALID/);
});
test('root evidence digest forgery shape is refused', () => {
  const forged = roots();
  forged[0].evidenceDigest = 'sha256:not-a-digest';
  assert.throws(() => Planner.evaluateRootGate({ request, roots: forged }), /ROOT_GATE_EVIDENCE_DIGEST_INVALID/);
});
test('stale request digest is refused by root gate', () => {
  const stale = clone(request);
  stale.goal = 'changed bytes';
  assert.throws(() => Planner.evaluateRootGate({ request: stale, roots: roots() }), /ROOT_GATE_REQUEST_INVALID_OR_STALE/);
});
test('forged root gate digest is held', () => {
  const forged = clone(gate);
  forged.roots[0].status = 'HOLD';
  assert.strictEqual(Planner.plan({ request, rootGate: forged }).result, 'ROOT_GATE_INVALID_OR_STALE');
});
test('request unknown fields are refused', () => assert.throws(() => Planner.createRequest({ ...input(), surpriseAuthority: true }), /REQUEST_UNKNOWN_FIELDS/));
test('observation unknown fields are refused', () => {
  const value = input();
  value.observation.rawSource = ['private'];
  assert.throws(() => Planner.createRequest(value), /OBSERVATION_UNKNOWN_FIELDS/);
});
test('implicit primary-language selection is refused', () => {
  const value = input();
  delete value.primaryLanguageId;
  assert.throws(() => Planner.createRequest(value), /PRIMARY_LANGUAGE_ID_INVALID/);
});
test('unknown explicit language is held without fallback', () => {
  const value = input();
  value.primaryLanguageId = 'not-a-language';
  value.primaryRole = null;
  const unknownRequest = Planner.createRequest(value);
  const unknownGate = Planner.evaluateRootGate({ request: unknownRequest, roots: roots() });
  assert.strictEqual(Planner.plan({ request: unknownRequest, rootGate: unknownGate }).result, 'EXPLICIT_PRIMARY_LANGUAGE_UNKNOWN');
});
test('primary role must bind the explicit primary language', () => {
  const value = input();
  value.roleBindings['game-runtime'] = 'python';
  const mismatchRequest = Planner.createRequest(value);
  const mismatchGate = Planner.evaluateRootGate({ request: mismatchRequest, roots: roots() });
  assert.strictEqual(Planner.plan({ request: mismatchRequest, rootGate: mismatchGate }).result, 'PRIMARY_ROLE_LANGUAGE_BINDING_REQUIRED');
});
test('missing required prebuild binding is held before production', () => {
  const value = input();
  delete value.roleBindings['document-shell'];
  const incompleteRequest = Planner.createRequest(value);
  const incompleteGate = Planner.evaluateRootGate({ request: incompleteRequest, roots: roots() });
  const incompletePlan = Planner.plan({ request: incompleteRequest, rootGate: incompleteGate });
  assert.strictEqual(incompletePlan.result, 'PREBUILD_BINDINGS_OR_ROUTES_HELD');
  assert.strictEqual(incompletePlan.batch, undefined);
});
test('invalid role family binding is held before production', () => {
  const value = input();
  value.roleBindings['document-shell'] = 'dax';
  const invalidRequest = Planner.createRequest(value);
  const invalidGate = Planner.evaluateRootGate({ request: invalidRequest, roots: roots() });
  assert.strictEqual(Planner.plan({ request: invalidRequest, rootGate: invalidGate }).result, 'PREBUILD_BINDINGS_OR_ROUTES_HELD');
});
test('budget below initial draft state is held', () => {
  const value = input();
  value.production.budgetCeilings.maxTotalDraftRevisions = 0;
  const budgetRequest = Planner.createRequest(value);
  const budgetGate = Planner.evaluateRootGate({ request: budgetRequest, roots: roots() });
  assert.strictEqual(Planner.plan({ request: budgetRequest, rootGate: budgetGate }).result, 'INITIAL_PRODUCTION_BUDGET_HELD');
});
test('plan byte tampering fails independent verification', () => {
  const tampered = clone(plan);
  tampered.truth.sourceGenerated = true;
  assert.strictEqual(Planner.verifyPlan(tampered, request, gate).result, 'PLAN_VERIFICATION_FAILED');
});

const snapshot = Planner.snapshot();
test('planner snapshot binds 102 organ and grammar registries', () => assert(/^[0-9a-f]{64}$/.test(snapshot.organRegistrySha256)) && assert(/^[0-9a-f]{64}$/.test(snapshot.grammarRegistrySha256)));
test('planner snapshot binds cheatcode, prebuild, production, budget, and build-window fabrics', () => ['cheatcodeFabricSha256', 'prebuildTwinSha256', 'productionDraftSha256', 'productionBudgetSha256', 'buildWindowSha256'].every(key => assert(/^[0-9a-f]{64}$/.test(snapshot[key]))));

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'code-creation-session-planner.contract.json'), 'utf8'));
test('module contract remains TEST', () => assert.strictEqual(contract.status, 'TEST'));
test('module contract grants no permissions or writes', () => assert.deepStrictEqual(contract.permissions, []) && assert.deepStrictEqual(contract.writes, []));
test('module contract refuses execution and promotion', () => assert(contract.refuses.includes('candidate execution')) && assert(contract.refuses.includes('automatic integration, merge, promotion or CANON')));
test('module contract preserves Mike as merge gate', () => assert.strictEqual(contract.mergeGate, 'Mike Tobi'));

const source = fs.readFileSync(path.join(__dirname, 'code-creation-session-planner.js'), 'utf8');
test('planner imports no process or network module', () => assert(!/require\(['"](?:child_process|http|https|net|tls|dgram|worker_threads)['"]\)/.test(source)));
test('planner contains no process spawn or fetch call', () => assert(!/\b(?:spawn|spawnSync|exec|execFile|fetch)\s*\(/.test(source)));
test('planner contains no filesystem import', () => assert(!/require\(['"]fs['"]\)/.test(source)));

console.log(`Code creation session planner selftest: ${passed} PASS`);
