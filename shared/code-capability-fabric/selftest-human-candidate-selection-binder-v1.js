'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Binder = require('./human-candidate-selection-binder-v1');
const Consent = require('./grounded-consent-scope-v1');
const Repair = require('./workshop-contract-repair-planner-v1');

let cases = 0;
function test(name, fn) {
  try {
    fn();
    cases += 1;
    console.log('PASS ' + name);
  } catch (error) {
    console.error('FAIL ' + name + ': ' + error.message);
    throw error;
  }
}

function digest(value) { return Binder.hash(value); }
function ref(id, schema, value) { return { id, schema, sha256: digest(value) }; }
function clone(value) { return Binder.clone(value); }
function candidateBytes(kind) { return Buffer.from(JSON.stringify({ schema: 'axm.tool-manifest/v1', kind }) + '\n', 'utf8'); }

function candidatePacket() {
  const target = {
    toolId: 'browser-lan-hardware-qa-lab',
    manifestPath: 'tools/browser-lan-hardware-qa-lab/manifest.json',
    contractPath: 'tools/browser-lan-hardware-qa-lab/module.contract.json',
    selftestPath: 'tools/browser-lan-hardware-qa-lab/selftest.js'
  };
  const alternatives = Repair.ALLOWED_KINDS.map((kind) => ({
    id: 'kind-' + kind,
    kind,
    patch: [
      { operation: 'JSON_ADD', pointer: '/schema', value: 'axm.tool-manifest/v1' },
      { operation: 'JSON_ADD', pointer: '/kind', value: kind }
    ],
    candidateRef: {
      path: 'alternatives/kind-' + kind + '/manifest.json',
      sha256: Repair.hashBytes(candidateBytes(kind)),
      byteLength: candidateBytes(kind).length
    },
    manifestValidation: { pass: true, errors: [] },
    contractValidation: { pass: true, errors: [] },
    semanticFitness: 'UNKNOWN',
    ranking: null,
    requiresHumanSelection: true
  }));
  return Repair.sealCandidate({
    schema: Repair.CANDIDATE_SCHEMA,
    version: Repair.VERSION,
    status: 'EXPERIMENTAL',
    id: 'browser-lan-hardware-qa-lab-repair-candidate',
    requestRef: ref('repair-request', Repair.REQUEST_SCHEMA, 'request'),
    observationRef: ref('repair-observation', Repair.OBSERVATION_SCHEMA, 'observation'),
    planRef: ref('repair-plan', Repair.PLAN_SCHEMA, 'plan'),
    target,
    repairClass: Repair.REPAIR_CLASS,
    alternatives,
    comparison: {
      ranking: 'NONE',
      selectedAlternative: null,
      equalAuthority: true,
      permissionDelta: { added: [], removed: [] },
      contractBytesChanged: false
    },
    requiredTests: Repair.requiredTests(target),
    limitations: ['Semantic kind requires an exact human decision.'],
    truth: {
      draftDetached: true,
      alternativesUnranked: true,
      humanSelectionRequired: true,
      candidateExecuted: false,
      testsExecuted: false,
      sourceWritten: false,
      permissionsChanged: false,
      contractBytesChanged: false,
      installed: false,
      integrated: false,
      published: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  });
}

function lifecycle() {
  return { publish: false, install: false, deploy: false, persistentLearning: false, hardwareActuation: false, canon: false };
}

function resources() {
  return { maxInputBytes: 65536, maxOutputBytes: 65536, maxMemoryBytes: 67108864, maxDurationMs: 30000, maxProcesses: 1, maxAttempts: 1, maxCostMinorUnits: 0 };
}

function consentInputs() {
  const policy = Consent.sealPolicy({
    schema: Consent.POLICY_SCHEMA,
    id: 'detached-selection-policy',
    validFrom: '2026-08-23T09:00:00.000Z',
    expiresAt: '2026-08-23T10:00:00.000Z',
    maximumInstanceWindowMs: 600000,
    domainRules: [{
      domain: 'code',
      subjectSchemas: ['axm.workshop-contract-repair-candidate/v1'],
      domainProfileSchemas: ['axm.detached-selection-profile/v1'],
      allowedActions: ['code.inspect', 'code.bind-detached-selection'],
      allowedPermissions: [],
      allowedNetworkDomains: [],
      allowedDataClasses: ['candidate-source'],
      allowedSourceUses: ['inspect-only'],
      allowedLifecycle: lifecycle(),
      resourceCeilings: resources(),
      requiredPredecisionEvidenceSchemas: ['axm.four-root-technical-review/v1'],
      requiredEvidenceSchemas: ['axm.human-candidate-selection-evaluation/v1']
    }],
    rootsGate: Consent.ROOTS_GATE.slice(),
    mandatoryReconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    authority: 'NONE'
  });
  const candidate = candidatePacket();
  const instance = Consent.sealInstance({
    schema: Consent.INSTANCE_SCHEMA,
    id: 'bind-detached-selection-001',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef: { id: candidate.id, schema: candidate.schema, sha256: candidate.candidateDigest },
    domainProfileRef: ref('detached-selection-profile', 'axm.detached-selection-profile/v1', 'profile'),
    predecisionEvidenceRefs: [ref('four-root-review', 'axm.four-root-technical-review/v1', 'roots')],
    inputArtifacts: [{ id: candidate.id, schema: candidate.schema, sha256: candidate.candidateDigest, byteLength: 12000 }],
    actions: ['code.bind-detached-selection', 'code.inspect'],
    permissions: [],
    networkDomains: [],
    dataClasses: ['candidate-source'],
    sourceUses: ['inspect-only'],
    lifecycle: lifecycle(),
    resources: resources(),
    requiredEvidenceSchemas: ['axm.human-candidate-selection-evaluation/v1'],
    reconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(),
    createdAt: '2026-08-23T09:01:00.000Z',
    expiresAt: '2026-08-23T09:09:00.000Z',
    authority: 'NONE'
  });
  return { policy, instance, candidate };
}

function consentEvaluation(inputs, evaluatedAt = '2026-08-23T09:03:00.000Z') {
  return Consent.evaluateGroundedConsent({ policy: inputs.policy, instance: inputs.instance, evaluatedAt });
}

function declaration(candidate, evaluation, consentInstance, kind = 'product') {
  const alternative = candidate.alternatives.find((entry) => entry.kind === kind);
  return Binder.sealDeclaration({
    schema: Binder.DECLARATION_SCHEMA,
    version: Binder.VERSION,
    status: 'DECLARED_NOT_AUTHENTICATED',
    id: 'declared-selection-001',
    seatRef: ref('declared-review-seat-001', 'axm.human-review-seat/v1', 'seat'),
    candidateRef: { id: candidate.id, schema: candidate.schema, sha256: candidate.candidateDigest },
    selection: { id: alternative.id, kind: alternative.kind, candidateRef: clone(alternative.candidateRef) },
    consentEvaluationRef: { schema: evaluation.schema, sha256: evaluation.evaluationDigest },
    consentInstanceRef: Consent.instanceRef(consentInstance),
    scope: Binder.SCOPE,
    issuedAt: '2026-08-23T09:03:30.000Z',
    expiresAt: '2026-08-23T09:08:30.000Z',
    nonce: 'selection-nonce-001',
    rootsGate: Binder.ROOTS.map((root, index) => ({ root, verdict: 'PASS', evidenceRefs: [ref('root-review-' + index, 'axm.four-root-technical-review/v1', root)] })),
    authentication: 'NOT_PROVEN',
    revocation: 'NOT_CHECKED',
    authority: 'NONE'
  });
}

function ledger(consumedNonces = [], observedAt = '2026-08-23T09:04:00.000Z') {
  return Binder.sealLedger({
    schema: Binder.LEDGER_SCHEMA,
    version: Binder.VERSION,
    status: 'HOST_SNAPSHOT_DECLARED',
    id: 'declared-replay-ledger-001',
    observedAt,
    consumedNonces,
    authority: 'NONE'
  });
}

function fixture() {
  const inputs = consentInputs();
  const evaluation = consentEvaluation(inputs);
  return {
    candidate: inputs.candidate,
    consentEvaluation: evaluation,
    consentInstance: inputs.instance,
    declaration: declaration(inputs.candidate, evaluation, inputs.instance),
    selectedCandidateBytes: candidateBytes('product'),
    replayLedger: ledger(),
    evaluatedAt: '2026-08-23T09:04:00.000Z'
  };
}

function resealDeclaration(value, mutate) {
  const core = clone(value);
  delete core.declarationDigest;
  mutate(core);
  return Binder.sealDeclaration(core);
}

function resealLedger(value, mutate) {
  const core = clone(value);
  delete core.ledgerDigest;
  mutate(core);
  return Binder.sealLedger(core);
}

function schemaObjectsClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectsClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectsClosed);
}

function localRefsResolve(file) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  function visit(value, root) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, root));
    if (typeof value.$ref === 'string' && value.$ref.startsWith('#/')) {
      let cursor = root;
      for (const part of value.$ref.slice(2).split('/')) cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
      if (cursor === undefined) return false;
    }
    return Object.values(value).every((item) => visit(item, root));
  }
  return visit(schema, schema);
}

test('schemas and module contract are closed TEST records with zero permissions', () => {
  const files = [
    ['human-candidate-selection-declaration.schema.json', Binder.DECLARATION_SCHEMA],
    ['selection-replay-ledger-snapshot.schema.json', Binder.LEDGER_SCHEMA],
    ['human-candidate-selection-evaluation.schema.json', Binder.EVALUATION_SCHEMA]
  ];
  for (const [file, id] of files) {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    assert.strictEqual(schema.$id, id);
    assert.strictEqual(schema.additionalProperties, false);
    assert(schemaObjectsClosed(schema));
    assert(localRefsResolve(file));
  }
  const contract = require('./module-human-candidate-selection-binder-v1.contract.json');
  assert.strictEqual(contract.status, 'TEST');
  assert.deepStrictEqual(contract.permissions, []);
  assert.deepStrictEqual(contract.boundaries.writes, []);
  assert(contract.boundaries.refuses.includes('declaration-as-authentication-proof'));
});

test('exact declaration produces an inert byte-bound authentication-required evaluation', () => {
  const input = fixture();
  const result = Binder.evaluateSelection(input);
  assert.strictEqual(result.status, 'AUTHENTICATION_REQUIRED');
  assert.strictEqual(result.effect, 'INERT_REVIEW_BINDING');
  assert.strictEqual(result.selectedAlternative.kind, 'product');
  assert.strictEqual(result.selectedAlternative.candidateRef.sha256, input.declaration.selection.candidateRef.sha256);
  assert.strictEqual(result.authority, 'NONE');
  assert.deepStrictEqual(result.holds, []);
  assert(Binder.STAGED_TRUTH_FIELDS.every((field) => result.truth[field]));
  assert(Binder.FALSE_CEILING_FIELDS.every((field) => result.truth[field] === false));
});

test('identical inputs produce byte-identical evaluations', () => {
  assert.deepStrictEqual(Binder.evaluateSelection(fixture()), Binder.evaluateSelection(fixture()));
});

test('normalization and deterministic rebuild verify the evaluation', () => {
  const input = fixture();
  const result = Binder.evaluateSelection(input);
  assert.deepStrictEqual(Binder.normalizeEvaluation(result), result);
  assert.deepStrictEqual(Binder.verifyEvaluation(result, input), { pass: true, errors: [] });
});

test('candidate byte drift fails before declaration binding', () => {
  const input = fixture();
  input.candidate.alternatives[0].candidateRef.sha256 = digest('forged-candidate');
  const result = Binder.evaluateSelection(input);
  assert.strictEqual(result.status, 'CANDIDATE_HOLD');
  assert.strictEqual(result.truth.candidateIntegrityVerified, false);
});

test('candidate ranking or silent selection fails closed', () => {
  const input = fixture();
  input.candidate.comparison.selectedAlternative = 'kind-product';
  const result = Binder.evaluateSelection(input);
  assert.strictEqual(result.status, 'CANDIDATE_HOLD');
});

test('a valid consent hold cannot enter candidate selection', () => {
  const input = fixture();
  const scope = consentInputs();
  input.consentEvaluation = consentEvaluation(scope, '2026-08-23T09:30:00.000Z');
  input.consentInstance = scope.instance;
  input.declaration = declaration(input.candidate, input.consentEvaluation, input.consentInstance);
  const result = Binder.evaluateSelection(input);
  assert.strictEqual(result.status, 'CONSENT_EVALUATION_HOLD');
  assert(result.holds.includes('CONSENT_SCOPE_NOT_READY_FOR_HUMAN_DECISION'));
});

test('forged consent evaluation digest fails closed', () => {
  const input = fixture();
  input.consentEvaluation.evaluationDigest = digest('forged-evaluation');
  assert.strictEqual(Binder.evaluateSelection(input).status, 'CONSENT_EVALUATION_HOLD');
});

test('forged consent instance digest fails closed', () => {
  const input = fixture();
  input.consentInstance.instanceDigest = digest('forged-instance');
  assert.strictEqual(Binder.evaluateSelection(input).status, 'CONSENT_INSTANCE_HOLD');
});

test('consent for another candidate cannot be reused', () => {
  const input = fixture();
  const instanceCore = clone(input.consentInstance);
  delete instanceCore.instanceDigest;
  instanceCore.subjectRef.sha256 = digest('another-candidate');
  input.consentInstance = Consent.sealInstance(instanceCore);
  const scope = consentInputs();
  input.consentEvaluation = Consent.evaluateGroundedConsent({ policy: scope.policy, instance: input.consentInstance, evaluatedAt: '2026-08-23T09:03:00.000Z' });
  input.declaration = declaration(input.candidate, input.consentEvaluation, input.consentInstance);
  assert.strictEqual(Binder.evaluateSelection(input).status, 'CONSENT_BINDING_HOLD');
});

test('forged declaration digest fails closed', () => {
  const input = fixture();
  input.declaration.declarationDigest = digest('forged-declaration');
  assert.strictEqual(Binder.evaluateSelection(input).status, 'DECLARATION_HOLD');
});

test('extra declaration fields fail closed', () => {
  const input = fixture();
  input.declaration.approved = true;
  assert.strictEqual(Binder.evaluateSelection(input).status, 'DECLARATION_HOLD');
});

test('scope expansion cannot be sealed as a detached selection', () => {
  const input = fixture();
  input.declaration.scope = 'EXECUTE_AND_INSTALL';
  delete input.declaration.declarationDigest;
  assert.throws(() => Binder.sealDeclaration(input.declaration), /inert authority/);
});

test('authentication and revocation cannot be self-asserted', () => {
  const input = fixture();
  input.declaration.authentication = 'PROVEN';
  input.declaration.revocation = 'CHECKED';
  delete input.declaration.declarationDigest;
  assert.throws(() => Binder.sealDeclaration(input.declaration), /inert authority/);
});

test('selection declaration cannot acquire authority', () => {
  const input = fixture();
  input.declaration.authority = 'MIKE';
  delete input.declaration.declarationDigest;
  assert.throws(() => Binder.sealDeclaration(input.declaration), /inert authority/);
});

test('candidate reference drift produces a typed binding hold', () => {
  const input = fixture();
  input.declaration = resealDeclaration(input.declaration, (core) => { core.candidateRef.sha256 = digest('different-packet'); });
  assert.strictEqual(Binder.evaluateSelection(input).status, 'BINDING_HOLD');
});

test('selected alternative byte drift produces a typed binding hold', () => {
  const input = fixture();
  input.declaration = resealDeclaration(input.declaration, (core) => { core.selection.candidateRef.sha256 = digest('different-alternative'); });
  assert.strictEqual(Binder.evaluateSelection(input).status, 'BINDING_HOLD');
});

test('actual selected bytes must match the declared digest and length', () => {
  const input = fixture();
  input.selectedCandidateBytes = Buffer.from('{"schema":"axm.tool-manifest/v1","kind":"service"}\n', 'utf8');
  const result = Binder.evaluateSelection(input);
  assert.strictEqual(result.status, 'SELECTED_BYTES_HOLD');
  assert.strictEqual(result.truth.candidateChoiceReferenceBound, true);
  assert.strictEqual(result.truth.selectedCandidateBytesVerified, false);
});

test('selected candidate bytes are verified but never retained in output', () => {
  const input = fixture();
  const result = Binder.evaluateSelection(input);
  assert.strictEqual(result.truth.selectedCandidateBytesVerified, true);
  assert(!JSON.stringify(result).includes(input.selectedCandidateBytes.toString('utf8').trim()));
});

test('selected kind and id ambiguity is rejected during declaration sealing', () => {
  const input = fixture();
  const core = clone(input.declaration);
  delete core.declarationDigest;
  core.selection.id = 'kind-service';
  assert.throws(() => Binder.sealDeclaration(core), /kind and id disagree/);
});

test('consent evaluation reference drift produces a typed binding hold', () => {
  const input = fixture();
  input.declaration = resealDeclaration(input.declaration, (core) => { core.consentEvaluationRef.sha256 = digest('different-consent'); });
  assert.strictEqual(Binder.evaluateSelection(input).status, 'BINDING_HOLD');
});

test('consent instance reference drift produces a typed binding hold', () => {
  const input = fixture();
  input.declaration = resealDeclaration(input.declaration, (core) => { core.consentInstanceRef.sha256 = digest('different-instance'); });
  assert.strictEqual(Binder.evaluateSelection(input).status, 'BINDING_HOLD');
});

test('non-human seat schemas cannot masquerade as review seats', () => {
  const input = fixture();
  const core = clone(input.declaration);
  delete core.declarationDigest;
  core.seatRef.schema = 'axm.machine-agent-seat/v1';
  assert.throws(() => Binder.sealDeclaration(core), /seat schema is unsupported/);
});

test('root evidence uses the exact technical-review schema', () => {
  const input = fixture();
  const core = clone(input.declaration);
  delete core.declarationDigest;
  core.rootsGate[0].evidenceRefs[0].schema = 'axm.root-pass-assertion/v1';
  assert.throws(() => Binder.sealDeclaration(core), /evidence schema is unsupported/);
});

test('expired declarations produce a typed time-window hold', () => {
  const input = fixture();
  input.evaluatedAt = '2026-08-23T09:08:30.000Z';
  input.replayLedger = ledger([], input.evaluatedAt);
  assert.strictEqual(Binder.evaluateSelection(input).status, 'TIME_WINDOW_HOLD');
});

test('stale ledger observation produces a typed time-window hold', () => {
  const input = fixture();
  input.replayLedger = ledger([], '2026-08-23T09:03:59.000Z');
  assert.strictEqual(Binder.evaluateSelection(input).status, 'TIME_WINDOW_HOLD');
});

test('nonce replay produces a typed replay hold', () => {
  const input = fixture();
  input.replayLedger = ledger([input.declaration.nonce]);
  const result = Binder.evaluateSelection(input);
  assert.strictEqual(result.status, 'REPLAY_HOLD');
  assert.strictEqual(result.truth.nonceAbsentFromProvidedLedger, false);
});

test('duplicate replay-ledger nonces fail closed', () => {
  const input = fixture();
  input.replayLedger.consumedNonces = ['used-nonce', 'used-nonce'];
  delete input.replayLedger.ledgerDigest;
  assert.throws(() => Binder.sealLedger(input.replayLedger), /duplicate nonces/);
});

test('forged replay-ledger digest produces a typed ledger hold', () => {
  const input = fixture();
  input.replayLedger.ledgerDigest = digest('forged-ledger');
  assert.strictEqual(Binder.evaluateSelection(input).status, 'LEDGER_HOLD');
});

test('declaration windows longer than one day are rejected', () => {
  const input = fixture();
  const core = clone(input.declaration);
  delete core.declarationDigest;
  core.expiresAt = '2026-08-24T09:03:31.000Z';
  assert.throws(() => Binder.sealDeclaration(core), /exceeds one day/);
});

test('root order and non-PASS root verdicts cannot be clicked through', () => {
  const input = fixture();
  let core = clone(input.declaration);
  delete core.declarationDigest;
  core.rootsGate.reverse();
  assert.throws(() => Binder.sealDeclaration(core), /ordered PASS roots/);
  core = clone(input.declaration);
  delete core.declarationDigest;
  core.rootsGate[0].verdict = 'HOLD';
  assert.throws(() => Binder.sealDeclaration(core), /ordered PASS roots/);
});

test('provided ledger remains declared rather than independently trusted', () => {
  const result = Binder.evaluateSelection(fixture());
  assert.strictEqual(result.truth.replayLedgerIndependentlyTrusted, false);
  assert(result.limitations.includes('PROVIDED_REPLAY_LEDGER_NOT_INDEPENDENTLY_TRUSTED'));
});

test('forged success truth ceilings fail evaluation normalization', () => {
  const input = fixture();
  const result = Binder.evaluateSelection(input);
  result.truth.authenticatedHumanDecisionVerified = true;
  assert.throws(() => Binder.normalizeEvaluation(result), /inert truth ceiling/);
});

test('success status cannot hide a hold or missing staged proof', () => {
  const input = fixture();
  const result = Binder.evaluateSelection(input);
  result.holds.push('hidden-hold');
  result.truth.nonceAbsentFromProvidedLedger = false;
  const core = clone(result);
  delete core.evaluationDigest;
  result.evaluationDigest = Binder.hash(core);
  assert.throws(() => Binder.normalizeEvaluation(result), /not fully byte-bound and hold-free/);
});

test('source exposes no filesystem, network, process, install, or promotion hand', () => {
  const source = fs.readFileSync(path.join(__dirname, 'human-candidate-selection-binder-v1.js'), 'utf8');
  assert(!/require\(['"](?:fs|http|https|child_process|os)['"]\)/.test(source));
  assert(!/\b(?:exec|spawn|writeFile|appendFile|install|promote|canonize)\s*\(/.test(source));
});

console.log('PASS Human candidate selection binder (' + cases + ' cases)');
