'use strict';

const assert = require('assert/strict');
const base = require('./code-grammar-glass-base.js');
const interglass = require('./code-grammar-glass-interglass.js');
let n = 0;
const ok = (v, m) => { assert.ok(v, m); n += 1; };
const eq = (a, b, m) => { assert.equal(a, b, m); n += 1; };
const ne = (a, b, m) => { assert.notEqual(a, b, m); n += 1; };
const de = (a, b, m) => { assert.deepEqual(a, b, m); n += 1; };

function star(seed = '6f2d8b4abef8ebf661925d5ce9d1aeea05b584055e8bdc96b9f857fd66d65e0f') {
  const core = {
    schema: 'axm.code.grammar-glass-draft-star.v1',
    version: '1.0.0',
    result: 'DRAFT_STAR_CAPTURED_IMMUTABLE_LIGHTWEIGHT_RECEIPT',
    rootSeed: seed,
    derivedFormationSeed: base.deriveSeed(seed, 'formation', 7),
    conditionDigest: base.hash({ condition: 1 }),
    contributingGrammarIdentities: ['javascript', 'python', 'sql'],
    typedAtomAncestry: [
      { atomId: 'atom:javascript:control-flow', atomSha256: base.hash('js-flow') },
      { atomId: 'atom:python:state', atomSha256: base.hash('py-state') },
      { atomId: 'atom:sql:dependency', atomSha256: base.hash('sql-dep') }
    ],
    connectionClasses: ['ANALOGY', 'BOUNDARY', 'CONTRAST'],
    compositeLineageDigest: base.hash({ composite: 1 }),
    mirrorObservationDigest: null,
    draftRecipeDigest: null,
    persistence: { mode: 'TRANSIENT_LIGHTWEIGHT_RECEIPT', consumesFullSaveSlot: false },
    authority: base.AUTHORITY
  };
  return core;
}

function mirrorFor(starCore) {
  const recipeCore = {
    schema: 'axm.code.inert-structural-draft-recipe.v1',
    result: 'INERT_EDITABLE_DRAFT_RECIPE_READY',
    formationSha256: base.hash({ formation: 1 }),
    executable: false,
    authority: base.AUTHORITY
  };
  const draftRecipe = { ...recipeCore, draftRecipeSha256: base.hash(recipeCore) };
  const core = {
    schema: 'axm.code.reactive-draft-mirror-observation.v1',
    version: '1.0.0',
    result: 'REACTIVE_DRAFT_MIRROR_OBSERVATION_READY',
    formationSha256: recipeCore.formationSha256,
    mirrorLens: 'STRUCTURAL_SEAM',
    draftRecipe,
    cycleMutationPerformed: false,
    authority: base.AUTHORITY
  };
  const mirror = { ...core, mirrorObservationSha256: base.hash(core) };
  const starReady = {
    ...starCore,
    mirrorObservationDigest: mirror.mirrorObservationSha256,
    draftRecipeDigest: draftRecipe.draftRecipeSha256
  };
  return { mirror, starReady };
}

function sealStar(starCore) {
  const core = { ...starCore };
  delete core.starSha256;
  return { ...core, starSha256: base.hash(core) };
}

function why(formationSha256) {
  const core = {
    schema: 'axm.code.grammar-glass-formation-explanation.v1',
    version: '1.0.0',
    result: 'FORMATION_DERIVATION_EXPLAINED_WITHOUT_QUALITY_CLAIM',
    formationSha256,
    whySteps: [
      { code: 'ATOM_SET_SELECTED_FROM_DETERMINISTIC_CYCLE_INTERACTION', detail: 'fixture' },
      { code: 'PRIOR_CONTACT_MEMORY_APPLIED_BEFORE_THIS_TICK', detail: 'fixture memory path' }
    ],
    authority: 'NONE'
  };
  return { ...core, explanationSha256: base.hash(core) };
}

(function run() {
  const policy = interglass.createInterglassPolicy({ timeoutMs: 1200, maxAttempts: 99, persistenceIntent: 'TRANSIENT' });
  eq(policy.result, 'INTERGLASS_POLICY_READY', 'policy ready');
  eq(policy.settings.maxAttempts, 1, 'one attempt hard ceiling');
  eq(policy.settings.networkMode, 'NONE', 'network none');
  eq(policy.settings.automaticRepeat, false, 'no automatic repeat');
  eq(policy.settings.automaticReentry, false, 'no automatic reentry');
  eq(policy.donorPatterns.donorCodeCopiedWholesale, false, 'donor patterns only');

  let s = star();
  const prepared = mirrorFor(s);
  s = sealStar(prepared.starReady);
  const m = prepared.mirror;
  const w = why(m.formationSha256);
  const model = interglass.createInterglassCandidateModel({ star: s, mirrorObservation: m, formationWhy: w, policy });
  eq(model.result, 'DETACHED_STRUCTURED_BROWSER_CANDIDATE_MODEL_READY', 'candidate ready');
  eq(model.runtimeContract.sourceCodeStoredInDurableModel, false, 'no raw source durable');
  eq(model.runtimeContract.runtimePayloadBuiltTransientlyByExecutor, true, 'runtime payload transient');
  eq(model.languageIds.length, 3, 'three grammars');
  eq(model.cells.length, 16, 'bounded deterministic cells');
  ok(model.byteLength <= policy.settings.maxCandidateModelBytes, 'candidate bytes bounded');
  ok(model.expectedResult.resultModelDigest, 'expected result digest');
  eq(model.truth.rngDoesNotProveNovelty, true, 'rng not novelty');

  const modelReplay = interglass.createInterglassCandidateModel({ star: s, mirrorObservation: m, formationWhy: w, policy });
  eq(model.candidateModelDigest, modelReplay.candidateModelDigest, 'candidate exact replay');
  eq(model.expectedResult.resultModelDigest, modelReplay.expectedResult.resultModelDigest, 'result model exact replay');
  de(model.cells, modelReplay.cells, 'cell replay');

  let s2base = star('7f2d8b4abef8ebf661925d5ce9d1aeea05b584055e8bdc96b9f857fd66d65e0f');
  const p2 = mirrorFor(s2base); const s2 = sealStar(p2.starReady);
  const model2 = interglass.createInterglassCandidateModel({ star: s2, mirrorObservation: p2.mirror, formationWhy: why(p2.mirror.formationSha256), policy });
  ne(model.candidateModelDigest, model2.candidateModelDigest, 'seed change changes candidate');

  const rawRefused = interglass.createInterglassCandidateModel({ star: { ...s, rawSource: 'x' }, mirrorObservation: m, formationWhy: w, policy });
  eq(rawRefused.result, 'INTERGLASS_CANDIDATE_REFUSED_RAW_PRIVATE_OR_SOURCE_FIELD', 'raw source refused');
  const cotRefused = interglass.createInterglassCandidateModel({ star: s, mirrorObservation: { ...m, rawChainOfThought: 'x' }, formationWhy: w, policy });
  eq(cotRefused.result, 'INTERGLASS_CANDIDATE_REFUSED_RAW_PRIVATE_OR_SOURCE_FIELD', 'raw cot refused');

  const held = interglass.createInterglassRunRequest({ candidateModel: model, star: s, mirrorObservation: m, policy });
  eq(held.result, 'EXECUTION_HELD_NO_ADAPTER', 'no executor is held');
  eq(held.truth.executionOccurred, false, 'held did not execute');

  const executor = interglass.createBrowserSandboxExecutorProfile({ policy });
  eq(executor.result, 'DISPOSABLE_BROWSER_SANDBOX_EXECUTOR_PROFILE_READY', 'browser executor profile ready');
  de(executor.sandboxTokens, ['allow-scripts'], 'allow scripts only');
  eq(executor.allowSameOrigin, false, 'opaque sandbox origin');
  eq(executor.networkMode, 'NONE', 'executor network none');
  eq(executor.maxAttempts, 1, 'executor single attempt');
  ok(executor.contentSecurityPolicy.includes("default-src 'none'"), 'csp default deny');
  ok(executor.contentSecurityPolicy.includes("connect-src 'none'"), 'csp connect deny');

  const request = interglass.createInterglassRunRequest({ candidateModel: model, star: s, mirrorObservation: m, executorProfile: executor, policy });
  eq(request.result, 'INTERGLASS_EXECUTION_REQUEST_READY_NOT_EXECUTED', 'request ready');
  eq(request.resourceCeilings.maxAttempts, 1, 'request one attempt');
  eq(request.candidateModelDigest, model.candidateModelDigest, 'candidate digest bound');
  eq(request.expectedResultDigest, model.expectedResult.resultModelDigest, 'result digest bound');
  eq(request.transientPayload.sourceBytesIncludedInRequest, false, 'request carries no source bytes');
  eq(request.truth.automaticRepeatAllowed, false, 'no auto repeat');
  eq(request.truth.automaticReentryAllowed, false, 'no auto reentry');
  eq(request.sandboxContractBinding.saveSlotCount, 5, 'existing five saves');
  eq(request.sandboxContractBinding.maxBytesPerSaveSlot, 100000000, 'existing save bytes');
  eq(request.sandboxContractBinding.sixthSilentSaveAllowed, false, 'sixth save forbidden');
  eq(request.sandboxContractBinding.existingSandboxSurfaces.executionRequestAvailable, true, 'existing sandbox execution request seam');
  eq(request.sandboxContractBinding.existingSandboxSurfaces.executorReceiptSealerAvailable, true, 'existing sandbox receipt seam');
  eq(request.sandboxContractBinding.existingSandboxSurfaces.iterationPersistenceGateAvailable, true, 'existing sandbox persistence gate');
  eq(request.sandboxContractBinding.existingSandboxSurfaces.draftEvidenceCandidateAvailable, true, 'existing sandbox evidence return seam');

  const runtimeReceipt = {
    schema: 'axm.code.interglass-browser-runtime-receipt.v1',
    version: '1.0.0',
    requestSha256: request.requestSha256,
    candidateModelDigest: request.candidateModelDigest,
    executorProfileDigest: request.executorProfileDigest,
    runtimePayloadDigest: base.hash('fixture-runtime-payload'),
    resultModelDigest: request.expectedResultDigest,
    resultSummary: model.expectedResult,
    state: 'PASS_OBSERVED',
    attempt: 1,
    sandboxTokens: ['allow-scripts'],
    cspDigest: executor.cspDigest,
    opaqueOriginObserved: true,
    networkAttemptBlocked: true,
    sourceWorkspaceWriteObserved: false,
    childProcessObserved: false,
    transientPayloadReleased: true
  };
  const observation = interglass.sealBrowserExecutionReceipt({ request, runtimeReceipt });
  eq(observation.result, 'INTERGLASS_EXECUTION_OBSERVATION_SEALED_PASS', 'pass sealed');
  eq(observation.executionOccurred, true, 'execution observed');
  eq(observation.truth.runtimeQualityProven, false, 'runtime quality not proven');
  eq(observation.truth.correctnessProven, false, 'correctness not proven');
  eq(observation.truth.promotionGranted, false, 'no promotion');
  eq(observation.returnPath.automaticTwisterReentry, false, 'no reentry');
  eq(observation.returnPath.automaticSecondExecution, false, 'no second run');
  eq(observation.persistence.fullSaveSlotConsumed, false, 'transient run no save slot');

  const bad = interglass.sealBrowserExecutionReceipt({ request, runtimeReceipt: { ...runtimeReceipt, opaqueOriginObserved: false } });
  eq(bad.result, 'CONTAINMENT_OR_RESULT_EVIDENCE_HOLD', 'bad containment held');
  ok(bad.problems.includes('OPAQUE_ORIGIN_NOT_OBSERVED'), 'opaque problem visible');

  for (const state of ['FAIL_OBSERVED', 'CRASH_OBSERVED', 'TIMEOUT_OBSERVED']) {
    const receipt = { ...runtimeReceipt, state, resultModelDigest: base.hash({ state }) };
    const sealed = interglass.sealBrowserExecutionReceipt({ request, runtimeReceipt: receipt });
    ok(sealed.result.includes(state.split('_')[0]), `${state} retained`);
    eq(sealed.truth.runtimeQualityProven, false, `${state} no quality proof`);
  }

  const returned = interglass.createExecutionReturnPacket({ star: s, observation });
  eq(returned.result, 'INTERGLASS_EXECUTION_EVIDENCE_RETURN_READY_NO_REENTRY', 'return packet');
  eq(returned.automaticReentry, false, 'return no reentry');
  eq(returned.automaticRepeatExecution, false, 'return no repeat');
  eq(returned.automaticLearningAdmission, false, 'return no learning');

  const state = interglass.visualState({ candidateModel: model, runRequest: request });
  eq(state.state, 'EXECUTION_READY', 'visual state ready');
  ok(state.eventTypes.includes('EXECUTION_OBSERVED_TIMEOUT'), 'timeout event class available');
  const stateDone = interglass.visualState({ candidateModel: model, runRequest: request, observation, returnPacket: returned });
  eq(stateDone.state, 'RESULT_SEALED', 'visual state sealed');

  const visualCore = {
    schema: 'axm.code.grammar-glass-visual-snapshot.v1',
    version: '1.2.0',
    result: 'DRAFTSKY_VISUAL_SNAPSHOT_READY_WITH_CONTACT_MEMORY',
    profileCount: 102,
    atomCount: 1122,
    cycle: { atoms: [], edges: [] },
    draftSky: [],
    truth: { animationUsesRecordedStateButCreatesNoEvidence: true }
  };
  const visual = { ...visualCore, visualSnapshotSha256: base.hash(visualCore) };
  const augmented = interglass.augmentVisualSnapshot({ visualSnapshot: visual, interglass: state });
  eq(augmented.version, '1.3.0', 'visual version 1.3');
  eq(augmented.doubleGlass.innerGlass, 'DISPOSABLE_BROWSER_SANDBOX', 'inner glass exposed');
  eq(augmented.truth.automaticReentryDisabled, true, 'visual truth reentry disabled');

  const snap = interglass.snapshot();
  eq(snap.status, 'TEST', 'snapshot test');
  eq(snap.truth.metadataModuleDoesNotExecuteCandidate, true, 'module does not fake execution');
  eq(snap.truth.browserSandboxIsRealBrowserEnforcementButNotOsSandbox, true, 'browser truth');
  ok(interglass.INTERGLASS_EVENT_TYPES.includes('EXECUTION_PAYLOAD_RELEASED'), 'release event class');
  ok(Object.values(base.AUTHORITY).every(value => value === false), 'base authority still none');

  process.stdout.write(JSON.stringify({
    result: 'GRAMMAR_GLASS_INTERGLASS_PHASE_2_SELFTEST_PASS',
    assertions: n,
    candidateModelDigest: model.candidateModelDigest,
    expectedResultDigest: model.expectedResult.resultModelDigest,
    requestSha256: request.requestSha256,
    executorProfileDigest: executor.executorProfileDigest,
    sandboxBindingSha256: request.sandboxContractBinding.bindingSha256,
    observationSha256: observation.observationSha256,
    returnPacketSha256: returned.returnPacketSha256,
    saveSlotCount: request.sandboxContractBinding.saveSlotCount,
    maxBytesPerSaveSlot: request.sandboxContractBinding.maxBytesPerSaveSlot,
    authority: 'NONE'
  }, null, 2) + '\n');
})();
