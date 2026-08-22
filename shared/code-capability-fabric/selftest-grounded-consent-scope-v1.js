'use strict';

const fs = require('fs');
const path = require('path');
const Consent = require('./grounded-consent-scope-v1');

let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) throw new Error('FAIL: ' + message);
}

function rejects(fn, pattern, message) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  check(error && pattern.test(error.message), message + (error ? ' [' + error.message + ']' : ' [no error]'));
}

function clone(value) {
  return Consent.clone(value);
}

function digest(character) {
  return 'sha256:' + character.repeat(64);
}

function ref(id, schema, character) {
  return { id, schema, sha256: digest(character) };
}

function lifecycle(overrides = {}) {
  return {
    publish: false,
    install: false,
    deploy: false,
    persistentLearning: false,
    hardwareActuation: false,
    canon: false,
    ...overrides
  };
}

function resources(overrides = {}) {
  return {
    maxInputBytes: 4096,
    maxOutputBytes: 2048,
    maxMemoryBytes: 134217728,
    maxDurationMs: 30000,
    maxProcesses: 2,
    maxAttempts: 3,
    maxCostMinorUnits: 200,
    ...overrides
  };
}

function codeRule(overrides = {}) {
  return {
    domain: 'code',
    subjectSchemas: ['axm.code-capability-request/v2'],
    domainProfileSchemas: ['axm.code-attempt-safety-profile/v1'],
    allowedActions: ['code.inspect', 'code.propose-change', 'code.test-candidate'],
    allowedPermissions: ['workspace.candidate-write'],
    allowedNetworkDomains: [],
    allowedDataClasses: ['private-user-source', 'public-source'],
    allowedSourceUses: ['derive-concepts', 'inspect-only'],
    allowedLifecycle: lifecycle(),
    resourceCeilings: resources(),
    requiredPredecisionEvidenceSchemas: [
      'axm.code-policy-bound-assurance-review/v1'
    ],
    requiredEvidenceSchemas: [
      'axm.code-diff-evidence/v1',
      'axm.code-test-evidence/v1'
    ],
    ...overrides
  };
}

function hardwareRule(overrides = {}) {
  return {
    domain: 'hardware',
    subjectSchemas: ['axm.hardware-change-request/v1'],
    domainProfileSchemas: ['axm.hardware-safety-profile/v1'],
    allowedActions: ['hardware.actuate', 'hardware.simulate'],
    allowedPermissions: [],
    allowedNetworkDomains: [],
    allowedDataClasses: ['sensor-data'],
    allowedSourceUses: ['inspect-only'],
    allowedLifecycle: lifecycle({ hardwareActuation: true }),
    resourceCeilings: resources(),
    requiredPredecisionEvidenceSchemas: ['axm.hardware-four-root-review/v1'],
    requiredEvidenceSchemas: ['axm.hardware-telemetry-evidence/v1'],
    ...overrides
  };
}

function policyCore(overrides = {}) {
  return {
    schema: Consent.POLICY_SCHEMA,
    id: 'mike-grounded-consent-settings',
    validFrom: '2026-08-22T09:00:00.000Z',
    expiresAt: '2026-08-22T10:00:00.000Z',
    maximumInstanceWindowMs: 600000,
    domainRules: [codeRule()],
    rootsGate: Consent.ROOTS_GATE.slice(),
    mandatoryReconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(),
    authority: 'NONE',
    ...overrides
  };
}

function instanceCore(policy, overrides = {}) {
  return {
    schema: Consent.INSTANCE_SCHEMA,
    id: 'improve-code-candidate-001',
    policyRef: Consent.policyRef(policy),
    domain: 'code',
    subjectRef: ref('inspect-request', 'axm.code-capability-request/v2', 'a'),
    domainProfileRef: ref('code-safety-profile', 'axm.code-attempt-safety-profile/v1', 'b'),
    predecisionEvidenceRefs: [
      ref('four-root-policy-review', 'axm.code-policy-bound-assurance-review/v1', 'e')
    ],
    inputArtifacts: [
      { id: 'source-a', schema: 'axm.code-source-artifact/v1', sha256: digest('c'), byteLength: 1024 },
      { id: 'source-b', schema: 'axm.code-source-artifact/v1', sha256: digest('d'), byteLength: 512 }
    ],
    actions: ['code.inspect', 'code.propose-change'],
    permissions: ['workspace.candidate-write'],
    networkDomains: [],
    dataClasses: ['private-user-source'],
    sourceUses: ['derive-concepts', 'inspect-only'],
    lifecycle: lifecycle(),
    resources: resources({
      maxInputBytes: 2048,
      maxOutputBytes: 1024,
      maxMemoryBytes: 67108864,
      maxDurationMs: 20000,
      maxProcesses: 1,
      maxAttempts: 2,
      maxCostMinorUnits: 100
    }),
    requiredEvidenceSchemas: [
      'axm.code-diff-evidence/v1',
      'axm.code-test-evidence/v1'
    ],
    reconsentTriggers: policy.mandatoryReconsentTriggers.slice(),
    stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(),
    createdAt: '2026-08-22T09:05:00.000Z',
    expiresAt: '2026-08-22T09:10:00.000Z',
    authority: 'NONE',
    ...overrides
  };
}

function resealPolicy(policy, mutate) {
  const core = clone(policy);
  delete core.policyDigest;
  mutate(core);
  return Consent.sealPolicy(core);
}

function resealInstance(instance, mutate) {
  const core = clone(instance);
  delete core.instanceDigest;
  mutate(core);
  return Consent.sealInstance(core);
}

function evaluation(policy, instance, evaluatedAt = '2026-08-22T09:06:00.000Z') {
  return Consent.evaluateGroundedConsent({ policy, instance, evaluatedAt });
}

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function localSchemaRefsResolve(file) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  function visit(value, current) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, current));
    if (typeof value.$ref === 'string') {
      const [targetFile, fragment] = value.$ref.split('#');
      const target = targetFile ? JSON.parse(fs.readFileSync(path.join(__dirname, targetFile), 'utf8')) : current;
      if (fragment) {
        const parts = fragment.replace(/^\//, '').split('/').filter(Boolean);
        let cursor = target;
        for (const part of parts) cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
        if (cursor === undefined) return false;
      }
    }
    return Object.values(value).every((item) => visit(item, current));
  }
  return visit(schema, schema);
}

const schemaFiles = [
  ['grounded-consent-policy.schema.json', Consent.POLICY_SCHEMA],
  ['grounded-consent-instance.schema.json', Consent.INSTANCE_SCHEMA],
  ['grounded-consent-evaluation.schema.json', Consent.EVALUATION_SCHEMA]
];
for (const [file, id] of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  check(schema.$id === id && schema.additionalProperties === false,
    file + ' binds exact identity and closes top-level fields');
  check(schemaObjectNodesAreClosed(schema) && localSchemaRefsResolve(file),
    file + ' closes object nodes and resolves local references');
}

const contract = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'module-grounded-consent-scope-v1.contract.json'),
  'utf8'
));
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0,
  'grounded consent contract remains permissionless, write-free TEST');
check(JSON.stringify(contract.rootsGate) === JSON.stringify(Consent.ROOTS_GATE),
  'the four roots remain the ordered technical acceptance gate');
check(contract.boundaries.refuses.includes('scope-fit-as-human-consent-proof') &&
  contract.boundaries.refuses.includes('consent-as-domain-safety-proof') &&
  contract.boundaries.refuses.includes('consent-as-host-authorization') &&
  contract.boundaries.refuses.includes('automatic-hardware-actuation'),
  'consent, domain safety, host authority, and hardware actuation stay separate');

const source = fs.readFileSync(path.join(__dirname, 'grounded-consent-scope-v1.js'), 'utf8');
check(!/require\(['"](?:fs|child_process|worker_threads|net|http|https|dgram|tls|cluster)['"]\)/.test(source) &&
  !/process\./.test(source),
  'implementation imports no filesystem, process, worker, or network capability');

const policy = Consent.sealPolicy(policyCore());
const instance = Consent.sealInstance(instanceCore(policy));
const result = evaluation(policy, instance);
check(result.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED' && result.authority === 'NONE',
  'valid scope fit stops at an authenticated exact human decision');
check(result.nextGate ===
  'VERIFY_PREDECISION_EVIDENCE_THEN_AUTHENTICATE_EXACT_HUMAN_DECISION_AND_CHECK_LIVE_REVOCATION_DOMAIN_SAFETY_AND_HOST_AUTHORIZATION',
  'terminal scope fit names every remaining consequential gate');
check(Consent.normalizePolicy(policy).policyDigest === policy.policyDigest &&
  Consent.normalizeInstance(instance).instanceDigest === instance.instanceDigest,
  'policy and instance pass strict standalone normalization');
check(Consent.normalizeEvaluation(result).evaluationDigest === result.evaluationDigest,
  'evaluation passes strict standalone normalization');
check(Consent.verifyEvaluation(result, { policy, instance, evaluatedAt: result.evaluatedAt }).pass,
  'evaluation verifies against deterministic rebuild');
check(result.truth.policyIntegrityVerified && result.truth.instanceIntegrityVerified &&
  result.truth.policyDigestBound && result.truth.domainRuleSelected &&
  result.truth.subjectSchemaAllowed && result.truth.domainProfileSchemaAllowed &&
  result.truth.predecisionEvidenceReferencesBound &&
  result.truth.actionsWithinPolicy && result.truth.authorityWithinPolicy &&
  result.truth.dataUseWithinPolicy && result.truth.lifecycleWithinPolicy &&
  result.truth.resourcesWithinPolicy && result.truth.inputBudgetWithinPolicy &&
  result.truth.evidenceRequirementsPreserved && result.truth.reconsentTriggersBound &&
  result.truth.declaredTimeWindowValid,
  'evaluation truth records every structural and subset check actually completed');
check(!result.truth.authenticatedHumanDecisionVerified &&
  !result.truth.naturalPersonIdentityProven && !result.truth.informedUnderstandingProven &&
  !result.truth.trustedClockObserved && !result.truth.liveRevocationChecked &&
  !result.truth.domainSafetyVerified && !result.truth.hostAuthorizationGranted,
  'scope fit does not become identity, understanding, time, revocation, safety, or authority proof');
check(!result.truth.attemptExecuted && !result.truth.outputProduced &&
  !result.truth.persistentLearningAdmitted && !result.truth.hardwareActuated &&
  !result.truth.installed && !result.truth.published && !result.truth.promoted &&
  !result.truth.canonChanged,
  'scope evaluation truth ceiling refuses runtime and lifecycle claims');

const crossDomainPolicy = Consent.sealPolicy(policyCore({
  id: 'cross-domain-grounded-consent-settings',
  domainRules: [hardwareRule(), codeRule()]
}));
const hardwareInstance = Consent.sealInstance(instanceCore(crossDomainPolicy, {
  id: 'bounded-hardware-attempt-001',
  domain: 'hardware',
  subjectRef: ref('hardware-request', 'axm.hardware-change-request/v1', '1'),
  domainProfileRef: ref('hardware-safety-profile', 'axm.hardware-safety-profile/v1', '2'),
  predecisionEvidenceRefs: [
    ref('hardware-four-root-review', 'axm.hardware-four-root-review/v1', '3')
  ],
  inputArtifacts: [],
  actions: ['hardware.actuate'],
  permissions: [],
  networkDomains: [],
  dataClasses: ['sensor-data'],
  sourceUses: ['inspect-only'],
  lifecycle: lifecycle({ hardwareActuation: true }),
  requiredEvidenceSchemas: ['axm.hardware-telemetry-evidence/v1']
}));
const hardwareResult = evaluation(crossDomainPolicy, hardwareInstance);
check(hardwareResult.status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED' &&
  !hardwareResult.truth.domainSafetyVerified && !hardwareResult.truth.hostAuthorizationGranted &&
  !hardwareResult.truth.hardwareActuated,
  'the grammar can bound a future hardware request without claiming safety, authority, or actuation');

const reorderedPolicy = Consent.sealPolicy(policyCore({
  mandatoryReconsentTriggers: clone(policy.mandatoryReconsentTriggers).reverse(),
  domainRules: [{
    ...codeRule(),
    allowedActions: clone(codeRule().allowedActions).reverse(),
    requiredPredecisionEvidenceSchemas: clone(codeRule().requiredPredecisionEvidenceSchemas).reverse(),
    requiredEvidenceSchemas: clone(codeRule().requiredEvidenceSchemas).reverse()
  }]
}));
const reorderedInstance = Consent.sealInstance({
  ...instanceCore(reorderedPolicy),
  actions: clone(instance.actions).reverse(),
  sourceUses: clone(instance.sourceUses).reverse(),
  predecisionEvidenceRefs: clone(instance.predecisionEvidenceRefs).reverse(),
  inputArtifacts: clone(instance.inputArtifacts).reverse(),
  requiredEvidenceSchemas: clone(instance.requiredEvidenceSchemas).reverse(),
  reconsentTriggers: clone(reorderedPolicy.mandatoryReconsentTriggers).reverse(),
  stopConditions: clone(instance.stopConditions).reverse()
});
check(reorderedPolicy.policyDigest === policy.policyDigest,
  'policy set ordering cannot alter canonical policy bytes');
check(reorderedInstance.instanceDigest === instance.instanceDigest,
  'instance set ordering cannot alter canonical instance bytes');
check(evaluation(reorderedPolicy, reorderedInstance).evaluationDigest === result.evaluationDigest,
  'equivalent reordered inputs produce the same deterministic evaluation');

const policyDigestDrift = clone(policy);
policyDigestDrift.maximumInstanceWindowMs += 1;
check(evaluation(policyDigestDrift, instance).status === 'POLICY_HOLD',
  'policy digest drift is rejected before scope evaluation');

const instanceDigestDrift = clone(instance);
instanceDigestDrift.actions.push('code.test-candidate');
check(evaluation(policy, instanceDigestDrift).status === 'INSTANCE_HOLD',
  'instance digest drift is rejected before subset evaluation');

const wrongPolicy = resealInstance(instance, (core) => { core.policyRef.sha256 = digest('f'); });
check(evaluation(policy, wrongPolicy).status === 'POLICY_BINDING_HOLD',
  'an instance cannot substitute a different standing policy digest');

const unknownDomain = resealInstance(instance, (core) => { core.domain = 'hardware'; });
check(evaluation(policy, unknownDomain).status === 'DOMAIN_HOLD',
  'an unconfigured domain requires a new policy decision');

const wrongSubjectSchema = resealInstance(instance, (core) => {
  core.subjectRef.schema = 'axm.game-build-request/v1';
});
check(evaluation(policy, wrongSubjectSchema).status === 'SUBJECT_SCHEMA_HOLD',
  'subject schema drift cannot borrow consent from another domain');

const wrongProfileSchema = resealInstance(instance, (core) => {
  core.domainProfileRef.schema = 'axm.hardware-safety-profile/v1';
});
check(evaluation(policy, wrongProfileSchema).status === 'DOMAIN_PROFILE_HOLD',
  'domain safety profile schema drift requires re-consent');

const wrongPredecisionSchema = resealInstance(instance, (core) => {
  core.predecisionEvidenceRefs[0].schema = 'axm.unreviewed-material/v1';
});
check(evaluation(policy, wrongPredecisionSchema).status === 'PREDECISION_EVIDENCE_HOLD',
  'a consent proposal cannot substitute an unrequested pre-decision evidence schema');

const duplicatePredecisionSchema = resealInstance(instance, (core) => {
  core.predecisionEvidenceRefs.push(ref(
    'second-four-root-review',
    'axm.code-policy-bound-assurance-review/v1',
    'f'
  ));
});
check(evaluation(policy, duplicatePredecisionSchema).status === 'PREDECISION_EVIDENCE_HOLD',
  'ambiguous duplicate pre-decision evidence schemas are held');

const expandedAction = resealInstance(instance, (core) => { core.actions.push('code.deploy'); });
check(evaluation(policy, expandedAction).status === 'ACTION_SCOPE_HOLD',
  'unlisted action expansion is held');

const expandedPermission = resealInstance(instance, (core) => { core.permissions.push('workspace.source-write'); });
check(evaluation(policy, expandedPermission).status === 'AUTHORITY_SCOPE_HOLD',
  'permission expansion is held');

const expandedNetwork = resealInstance(instance, (core) => { core.networkDomains.push('example.com'); });
check(evaluation(policy, expandedNetwork).status === 'AUTHORITY_SCOPE_HOLD',
  'network-domain expansion is held');

const expandedData = resealInstance(instance, (core) => { core.dataClasses.push('biometric-source'); });
check(evaluation(policy, expandedData).status === 'DATA_SCOPE_HOLD',
  'unlisted data class is held');

const expandedSourceUse = resealInstance(instance, (core) => { core.sourceUses.push('train-persistently'); });
check(evaluation(policy, expandedSourceUse).status === 'DATA_SCOPE_HOLD',
  'unlisted source use is held');

for (const field of Consent.LIFECYCLE_FIELDS) {
  const expanded = resealInstance(instance, (core) => { core.lifecycle[field] = true; });
  check(evaluation(policy, expanded).status === 'LIFECYCLE_SCOPE_HOLD',
    field + ' cannot be smuggled through a false lifecycle ceiling');
}

for (const field of Consent.RESOURCE_FIELDS) {
  const expanded = resealInstance(instance, (core) => {
    core.resources[field] = policy.domainRules[0].resourceCeilings[field] + 1;
  });
  check(evaluation(policy, expanded).status === 'RESOURCE_SCOPE_HOLD',
    field + ' cannot exceed the standing policy ceiling');
}

const oversizedInputs = resealInstance(instance, (core) => {
  core.inputArtifacts[0].byteLength = 1800;
  core.inputArtifacts[1].byteLength = 512;
});
check(evaluation(policy, oversizedInputs).status === 'INPUT_BUDGET_HOLD',
  'artifact byte-length total cannot exceed the per-attempt input budget');

const missingEvidence = resealInstance(instance, (core) => { core.requiredEvidenceSchemas.pop(); });
check(evaluation(policy, missingEvidence).status === 'EVIDENCE_SCOPE_HOLD',
  'an instance cannot reduce standing evidence requirements');

const changedTriggers = resealInstance(instance, (core) => { core.reconsentTriggers.pop(); });
check(evaluation(policy, changedTriggers).status === 'RECONSENT_BINDING_HOLD',
  'an instance cannot remove a standing re-consent trigger');

const timeCases = [
  ['2026-08-22T09:04:59.999Z', 'evaluation before instance creation'],
  ['2026-08-22T09:10:00.000Z', 'evaluation at instance expiry'],
  ['not-a-time', 'malformed declared evaluation time']
];
for (const [evaluatedAt, label] of timeCases) {
  check(evaluation(policy, instance, evaluatedAt).status === 'TIME_WINDOW_HOLD', label + ' is held');
}

const predatesPolicy = Consent.sealInstance(instanceCore(policy, {
  createdAt: '2026-08-22T08:59:59.000Z',
  expiresAt: '2026-08-22T09:05:00.000Z'
}));
check(evaluation(policy, predatesPolicy, '2026-08-22T09:01:00.000Z').status === 'TIME_WINDOW_HOLD',
  'an instance cannot predate the standing policy');

const exceedsWindow = Consent.sealInstance(instanceCore(policy, {
  expiresAt: '2026-08-22T09:20:00.001Z'
}));
check(evaluation(policy, exceedsWindow).status === 'TIME_WINDOW_HOLD',
  'an instance cannot exceed the maximum consent window');

const outlivesPolicy = Consent.sealInstance(instanceCore(policy, {
  createdAt: '2026-08-22T09:55:00.000Z',
  expiresAt: '2026-08-22T10:00:00.001Z'
}));
check(evaluation(policy, outlivesPolicy, '2026-08-22T09:56:00.000Z').status === 'TIME_WINDOW_HOLD',
  'an instance cannot outlive the standing policy');

rejects(() => Consent.sealPolicy(policyCore({
  rootsGate: ['agency-non-domination', 'truth', 'continuity', 'wisdom-over-speed']
})), /exact order/, 'root precedence cannot be reordered');

rejects(() => Consent.sealPolicy(policyCore({
  mandatoryReconsentTriggers: Consent.MANDATORY_RECONSENT_TRIGGERS.slice(1)
})), /items|re-consent triggers/, 'mandatory re-consent triggers cannot be omitted');

rejects(() => Consent.sealInstance(instanceCore(policy, {
  stopConditions: Consent.MANDATORY_STOP_CONDITIONS.slice(1)
})), /items|stop conditions/, 'mandatory stop conditions cannot be omitted');

rejects(() => Consent.sealPolicy(policyCore({
  domainRules: [codeRule(), codeRule()]
})), /duplicates/, 'ambiguous duplicate domain rules are rejected');

rejects(() => Consent.sealInstance(instanceCore(policy, {
  actions: ['code.inspect', 'code.inspect']
})), /duplicates/, 'duplicate actions are rejected');

rejects(() => Consent.sealPolicy(policyCore({ authority: 'EXECUTE' })), /authority/,
  'standing settings cannot grant execution authority');
rejects(() => Consent.sealInstance(instanceCore(policy, { authority: 'EXECUTE' })), /authority/,
  'an exact instance cannot grant execution authority');

const subjectDrift = resealInstance(instance, (core) => { core.subjectRef.sha256 = digest('e'); });
check(Consent.instanceRef(subjectDrift).sha256 !== Consent.instanceRef(instance).sha256,
  'subject digest drift changes the exact consent instance reference');
const profileDrift = resealInstance(instance, (core) => { core.domainProfileRef.sha256 = digest('e'); });
check(Consent.instanceRef(profileDrift).sha256 !== Consent.instanceRef(instance).sha256,
  'domain profile digest drift changes the exact consent instance reference');
const inputDrift = resealInstance(instance, (core) => { core.inputArtifacts[0].sha256 = digest('e'); });
check(Consent.instanceRef(inputDrift).sha256 !== Consent.instanceRef(instance).sha256,
  'input digest drift changes the exact consent instance reference');

const extraEvidence = resealInstance(instance, (core) => {
  core.requiredEvidenceSchemas.push('axm.code-security-review-evidence/v1');
});
check(evaluation(policy, extraEvidence).status === 'AUTHENTICATED_HUMAN_DECISION_REQUIRED',
  'an instance may require stronger evidence without widening authority');

const forgedAuthority = clone(result);
forgedAuthority.authority = 'EXECUTE';
delete forgedAuthority.evaluationDigest;
forgedAuthority.evaluationDigest = Consent.sha256(forgedAuthority);
rejects(() => Consent.normalizeEvaluation(forgedAuthority), /authority/,
  'a recomputed digest cannot turn evaluation into execution authority');

const forgedConsent = clone(result);
forgedConsent.truth.authenticatedHumanDecisionVerified = true;
delete forgedConsent.evaluationDigest;
forgedConsent.evaluationDigest = Consent.sha256(forgedConsent);
rejects(() => Consent.normalizeEvaluation(forgedConsent), /truth ceiling/,
  'a recomputed digest cannot manufacture authenticated human consent');

const forgedSafety = clone(result);
forgedSafety.truth.domainSafetyVerified = true;
delete forgedSafety.evaluationDigest;
forgedSafety.evaluationDigest = Consent.sha256(forgedSafety);
rejects(() => Consent.normalizeEvaluation(forgedSafety), /truth ceiling/,
  'a recomputed digest cannot manufacture domain safety proof');

const forgedStage = clone(result);
forgedStage.status = 'RESOURCE_SCOPE_HOLD';
forgedStage.holds = ['FORGED_RESOURCE_HOLD'];
forgedStage.nextGate = 'REPAIR_CONSENT_SCOPE_THEN_REEVALUATE';
delete forgedStage.evaluationDigest;
forgedStage.evaluationDigest = Consent.sha256(forgedStage);
rejects(() => Consent.normalizeEvaluation(forgedStage), /status conflicts with truth/,
  'a recomputed digest cannot contradict the typed hold stage');

const extraInput = { policy, instance, evaluatedAt: result.evaluatedAt, execute: true };
rejects(() => Consent.evaluateGroundedConsent(extraInput), /unsupported fields/,
  'top-level execution requests are rejected as malformed input');

console.log('Grounded Consent Scope selftest: ' + checks + ' checks passed');
