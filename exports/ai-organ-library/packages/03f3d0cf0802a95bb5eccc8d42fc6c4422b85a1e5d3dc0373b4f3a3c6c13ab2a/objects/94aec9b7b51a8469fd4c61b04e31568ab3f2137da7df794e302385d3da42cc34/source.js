'use strict';

const KeySafeJson = require('../kernel/key-safe-json-transport-cell');

const ORGAN_ID = 'axm.mirror.organ/outward-clone-finite-lease-verifier-v1';
const LEASE_SCHEMA = 'axm.mirror.outward-clone-execution-lease/v1';
const ASSESSMENT_SCHEMA = 'axm.mirror.outward-clone-execution-lease-assessment/v1';
const EXECUTABLE_ROUTE_STATE = 'ROUTE_PROPOSAL_ONLY_READY_FOR_SPECIALIST_HANDLER_REVIEW';
const MAX_LEASE_WINDOW_MS = 15 * 60 * 1000;
const MAX_RUNTIME_DURATION_MS = 10 * 60 * 1000;
const MAX_PROCESSES = 16;
const MAX_LOOPBACK_PORTS = 8;
const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;

const FORBIDDEN_REASONING_KEYS = new Set([
  'chainofthought',
  'hiddenreasoning',
  'privatereasoning',
  'scratchpad'
]);
const TRANSPORT_OPTIONS = Object.freeze({
  maxBytes: 1024 * 1024,
  maxDepth: 64,
  maxNodes: 25000,
  rejectKey: key => FORBIDDEN_REASONING_KEYS.has(String(key).replace(/[^A-Za-z0-9]/g, '').toLowerCase()),
  rejectedKeyMessage: 'private hidden reasoning fields are outside the lease verifier contract'
});

const AUTHORITY_KEYS = Object.freeze([
  'executeDisposableRuntime',
  'targetRead',
  'ephemeralTargetMutation',
  'loopbackNetwork',
  'targetSourceWrite',
  'targetPersistentWrite',
  'parentMirrorReadPrivate',
  'parentMirrorWrite',
  'externalNetwork',
  'permissionGrant',
  'installation',
  'promotion',
  'canon',
  'worldAction'
]);
const FORBIDDEN_AUTHORITY_KEYS = Object.freeze([
  'targetSourceWrite',
  'targetPersistentWrite',
  'parentMirrorReadPrivate',
  'parentMirrorWrite',
  'externalNetwork',
  'permissionGrant',
  'installation',
  'promotion',
  'canon',
  'worldAction'
]);
const ASSESSMENT_STATES = Object.freeze([
  'HOLD_EXTERNAL_GATES',
  'HOLD_NOT_YET_ACTIVE',
  'HOLD_EXPIRED',
  'HOLD_ROUTE_NOT_EXECUTABLE',
  'REFUSED_ROUTE_BINDING_MISMATCH'
]);
const ZERO_COUNTS = Object.freeze({
  leasesConsumed: 0,
  processesStarted: 0,
  targetReads: 0,
  targetWrites: 0,
  parentMirrorReads: 0,
  parentMirrorWrites: 0,
  networkCalls: 0,
  permissionGrants: 0,
  installations: 0,
  promotions: 0,
  canonChanges: 0,
  worldActions: 0
});
const ZERO_AUTHORITY = Object.freeze({
  authenticateHuman: false,
  consumeLease: false,
  launchRuntime: false,
  controlTarget: false,
  readTarget: false,
  writeTarget: false,
  readParentMirrorPrivate: false,
  writeParentMirror: false,
  useNetwork: false,
  grantPermission: false,
  install: false,
  promote: false,
  changeCanon: false,
  actInWorld: false
});

function stable(value) {
  return KeySafeJson.stable(value, TRANSPORT_OPTIONS);
}

function digest(value) {
  return KeySafeJson.digest(value, TRANSPORT_OPTIONS);
}

function same(left, right) {
  return KeySafeJson.same(left, right, TRANSPORT_OPTIONS);
}

function without(value, ...keys) {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) {
    throw new Error(`${label} fields changed`);
  }
}

function boundedText(value, label, maximum, minimum = 1) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum || /[\u0000-\u001f]/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value.trim();
}

function identifier(value, label, maximum = 180) {
  const normalized = boundedText(value, label, maximum, 2);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(normalized) || normalized.includes('..')) throw new Error(`${label} is invalid`);
  return normalized;
}

function enumValue(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} is invalid`);
  return value;
}

function sha(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} requires sha256`);
  return value;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${label} is outside its bound`);
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} is invalid`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) throw new Error(`${label} must be canonical UTC ISO-8601`);
  return { value, milliseconds };
}

function normalizeBeneficiary(value, label = 'beneficiary') {
  exactKeys(value, ['kind', 'id', 'digest'], label);
  return {
    kind: enumValue(value.kind, ['HUMAN', 'EXTERNAL_MACHINE'], `${label}.kind`),
    id: identifier(value.id, `${label}.id`),
    digest: sha(value.digest, `${label}.digest`)
  };
}

function normalizeTarget(value, label = 'target') {
  exactKeys(value, ['kind', 'id', 'digest'], label);
  const kind = boundedText(value.kind, `${label}.kind`, 100, 2);
  if (!/^[A-Z][A-Z0-9_]*$/.test(kind)) throw new Error(`${label}.kind is invalid`);
  return { kind, id: identifier(value.id, `${label}.id`), digest: sha(value.digest, `${label}.digest`) };
}

function normalizeSource(value) {
  exactKeys(value, ['routeAssessmentId', 'routeAssessmentDigest', 'requestId', 'requestDigest', 'cloneId', 'serviceKind', 'beneficiary', 'target'], 'lease source');
  const routeAssessmentId = identifier(value.routeAssessmentId, 'source.routeAssessmentId');
  const requestId = identifier(value.requestId, 'source.requestId');
  if (!/^outward-clone-service-assessment-[a-f0-9]{24}$/.test(routeAssessmentId)) throw new Error('source.routeAssessmentId is invalid');
  if (!/^outward-clone-service-request-[a-f0-9]{24}$/.test(requestId)) throw new Error('source.requestId is invalid');
  const serviceKind = boundedText(value.serviceKind, 'source.serviceKind', 120, 2);
  if (!/^[A-Z][A-Z0-9_]*$/.test(serviceKind)) throw new Error('source.serviceKind is invalid');
  return {
    routeAssessmentId,
    routeAssessmentDigest: sha(value.routeAssessmentDigest, 'source.routeAssessmentDigest'),
    requestId,
    requestDigest: sha(value.requestDigest, 'source.requestDigest'),
    cloneId: identifier(value.cloneId, 'source.cloneId'),
    serviceKind,
    beneficiary: normalizeBeneficiary(value.beneficiary, 'source.beneficiary'),
    target: normalizeTarget(value.target, 'source.target')
  };
}

function normalizeValidity(value) {
  exactKeys(value, ['issuedAt', 'notBefore', 'expiresAt', 'maxUses'], 'lease validity');
  const issuedAt = timestamp(value.issuedAt, 'validity.issuedAt');
  const notBefore = timestamp(value.notBefore, 'validity.notBefore');
  const expiresAt = timestamp(value.expiresAt, 'validity.expiresAt');
  if (issuedAt.milliseconds > notBefore.milliseconds || notBefore.milliseconds >= expiresAt.milliseconds) throw new Error('lease validity order is invalid');
  if (expiresAt.milliseconds - issuedAt.milliseconds > MAX_LEASE_WINDOW_MS) throw new Error('lease validity window exceeds fifteen minutes');
  if (value.maxUses !== 1) throw new Error('lease maxUses must remain one');
  return { issuedAt: issuedAt.value, notBefore: notBefore.value, expiresAt: expiresAt.value, maxUses: 1 };
}

function normalizeBudget(value) {
  exactKeys(value, ['maxDurationMs', 'maxProcesses', 'maxLoopbackPorts', 'maxStdoutBytes', 'maxStderrBytes'], 'lease budget');
  return {
    maxDurationMs: integer(value.maxDurationMs, 'budget.maxDurationMs', 1, MAX_RUNTIME_DURATION_MS),
    maxProcesses: integer(value.maxProcesses, 'budget.maxProcesses', 1, MAX_PROCESSES),
    maxLoopbackPorts: integer(value.maxLoopbackPorts, 'budget.maxLoopbackPorts', 0, MAX_LOOPBACK_PORTS),
    maxStdoutBytes: integer(value.maxStdoutBytes, 'budget.maxStdoutBytes', 0, MAX_CAPTURE_BYTES),
    maxStderrBytes: integer(value.maxStderrBytes, 'budget.maxStderrBytes', 0, MAX_CAPTURE_BYTES)
  };
}

function normalizePorts(value) {
  if (!Array.isArray(value) || value.length > MAX_LOOPBACK_PORTS) throw new Error('loopbackPorts is outside its bound');
  const ports = value.map((port, index) => integer(port, `loopbackPorts[${index}]`, 1, 65535));
  if (new Set(ports).size !== ports.length) throw new Error('loopbackPorts contains a duplicate');
  return ports.slice().sort((left, right) => left - right);
}

function normalizeAuthority(value, ports) {
  exactKeys(value, AUTHORITY_KEYS, 'requested authority');
  for (const key of AUTHORITY_KEYS) if (typeof value[key] !== 'boolean') throw new Error(`requestedAuthority.${key} must be boolean`);
  if (value.executeDisposableRuntime !== true) throw new Error('executeDisposableRuntime must be explicitly requested');
  for (const key of FORBIDDEN_AUTHORITY_KEYS) if (value[key] !== false) throw new Error(`requestedAuthority.${key} exceeds the lease ceiling`);
  if (value.loopbackNetwork !== (ports.length > 0)) throw new Error('loopbackNetwork must match the exact declared loopback port set');
  return Object.fromEntries(AUTHORITY_KEYS.map(key => [key, value[key]]));
}

function normalizeUnverifiedProviderGate(value, label) {
  exactKeys(value, ['required', 'providerId', 'evidenceDigest', 'verificationState'], label);
  if (value.required !== true || value.providerId !== null || value.evidenceDigest !== null || value.verificationState !== 'NOT_VERIFIED') {
    throw new Error(`${label} must remain an explicit unverified external gate`);
  }
  return { required: true, providerId: null, evidenceDigest: null, verificationState: 'NOT_VERIFIED' };
}

function normalizeExternalGates(value) {
  exactKeys(value, ['humanApproval', 'networkIsolation', 'singleUseConsumption'], 'external gates');
  exactKeys(value.humanApproval, ['declaredApproverKind', 'declaredApproverId', 'evidenceId', 'evidenceDigest', 'authenticationState'], 'externalGates.humanApproval');
  if (value.humanApproval.declaredApproverKind !== 'HUMAN' || value.humanApproval.authenticationState !== 'UNVERIFIED_EXTERNAL_IDENTITY') {
    throw new Error('human approval must remain declared but externally unauthenticated');
  }
  return {
    humanApproval: {
      declaredApproverKind: 'HUMAN',
      declaredApproverId: identifier(value.humanApproval.declaredApproverId, 'externalGates.humanApproval.declaredApproverId'),
      evidenceId: identifier(value.humanApproval.evidenceId, 'externalGates.humanApproval.evidenceId'),
      evidenceDigest: sha(value.humanApproval.evidenceDigest, 'externalGates.humanApproval.evidenceDigest'),
      authenticationState: 'UNVERIFIED_EXTERNAL_IDENTITY'
    },
    networkIsolation: normalizeUnverifiedProviderGate(value.networkIsolation, 'externalGates.networkIsolation'),
    singleUseConsumption: normalizeUnverifiedProviderGate(value.singleUseConsumption, 'externalGates.singleUseConsumption')
  };
}

function normalizeLease(input, requireSeal) {
  const value = stable(input);
  exactKeys(value, ['schema', 'leaseId', 'leaseDigest', 'status', 'source', 'validity', 'budget', 'loopbackPorts', 'requestedAuthority', 'externalGates', 'humanRendering', 'boundary'], 'outward clone execution lease');
  if (value.schema !== LEASE_SCHEMA || value.status !== 'TEST') throw new Error('outward clone execution lease identity changed');
  const source = normalizeSource(value.source);
  const validity = normalizeValidity(value.validity);
  const budget = normalizeBudget(value.budget);
  const loopbackPorts = normalizePorts(value.loopbackPorts);
  if (budget.maxLoopbackPorts !== loopbackPorts.length) throw new Error('budget.maxLoopbackPorts must equal the exact declared loopback port count');
  const normalized = stable({
    schema: LEASE_SCHEMA,
    leaseId: value.leaseId,
    leaseDigest: value.leaseDigest,
    status: 'TEST',
    source,
    validity,
    budget,
    loopbackPorts,
    requestedAuthority: normalizeAuthority(value.requestedAuthority, loopbackPorts),
    externalGates: normalizeExternalGates(value.externalGates),
    humanRendering: boundedText(value.humanRendering, 'humanRendering', 2000),
    boundary: boundedText(value.boundary, 'boundary', 2400)
  });
  if (requireSeal) {
    if (!/^outward-clone-execution-lease-[a-f0-9]{24}$/.test(normalized.leaseId || '')) throw new Error('leaseId is invalid');
    sha(normalized.leaseDigest, 'leaseDigest');
    const expectedId = `outward-clone-execution-lease-${digest(without(normalized, 'leaseId', 'leaseDigest')).slice(0, 24)}`;
    const expectedDigest = digest(Object.assign({}, normalized, { leaseDigest: null }));
    if (normalized.leaseId !== expectedId || normalized.leaseDigest !== expectedDigest || !same(value, normalized)) throw new Error('outward clone execution lease content address changed');
  } else if (normalized.leaseId !== null || normalized.leaseDigest !== null) {
    throw new Error('unsealed lease identifiers must be null');
  }
  return normalized;
}

function sealLease(draft) {
  const normalized = normalizeLease(draft, false);
  normalized.leaseId = `outward-clone-execution-lease-${digest(without(normalized, 'leaseId', 'leaseDigest')).slice(0, 24)}`;
  normalized.leaseDigest = digest(Object.assign({}, normalized, { leaseDigest: null }));
  return stable(normalized);
}

function verifyLease(value) {
  return normalizeLease(value, true);
}

function normalizeExpectedRoute(input) {
  const value = stable(input);
  exactKeys(value, ['assessmentId', 'assessmentDigest', 'state', 'requestId', 'requestDigest', 'cloneId', 'serviceKind', 'beneficiary', 'target', 'budget'], 'expected route');
  const serviceKind = boundedText(value.serviceKind, 'expectedRoute.serviceKind', 120, 2);
  if (!/^[A-Z][A-Z0-9_]*$/.test(serviceKind)) throw new Error('expectedRoute.serviceKind is invalid');
  exactKeys(value.budget, ['maxDurationMs'], 'expected route budget');
  return stable({
    assessmentId: identifier(value.assessmentId, 'expectedRoute.assessmentId'),
    assessmentDigest: sha(value.assessmentDigest, 'expectedRoute.assessmentDigest'),
    state: boundedText(value.state, 'expectedRoute.state', 160, 2),
    requestId: identifier(value.requestId, 'expectedRoute.requestId'),
    requestDigest: sha(value.requestDigest, 'expectedRoute.requestDigest'),
    cloneId: identifier(value.cloneId, 'expectedRoute.cloneId'),
    serviceKind,
    beneficiary: normalizeBeneficiary(value.beneficiary, 'expectedRoute.beneficiary'),
    target: normalizeTarget(value.target, 'expectedRoute.target'),
    budget: { maxDurationMs: integer(value.budget.maxDurationMs, 'expectedRoute.budget.maxDurationMs', 1, MAX_RUNTIME_DURATION_MS) }
  });
}

function routeMatches(lease, route) {
  return lease.source.routeAssessmentId === route.assessmentId &&
    lease.source.routeAssessmentDigest === route.assessmentDigest &&
    lease.source.requestId === route.requestId &&
    lease.source.requestDigest === route.requestDigest &&
    lease.source.cloneId === route.cloneId &&
    lease.source.serviceKind === route.serviceKind &&
    same(lease.source.beneficiary, route.beneficiary) &&
    same(lease.source.target, route.target) &&
    lease.budget.maxDurationMs <= route.budget.maxDurationMs;
}

function finding(code, severity, statement) {
  return { code, severity, statement };
}

function humanSummary(state) {
  if (state === 'REFUSED_ROUTE_BINDING_MISMATCH') return 'The lease points at different route, request, beneficiary, target, or budget bytes and is refused.';
  if (state === 'HOLD_ROUTE_NOT_EXECUTABLE') return 'The exact route is not an executable specialist proposal, so the lease remains held.';
  if (state === 'HOLD_NOT_YET_ACTIVE') return 'The lease is structurally finite but its declared start time has not arrived.';
  if (state === 'HOLD_EXPIRED') return 'The lease is structurally finite but its declared time window has ended.';
  return 'The lease structure is finite and exact, but it cannot be used until human identity, one-use consumption, and network isolation are verified outside this organ.';
}

function assessLease(leaseInput, routeInput, observedAtInput) {
  const lease = verifyLease(leaseInput);
  const route = normalizeExpectedRoute(routeInput);
  const observedAt = timestamp(observedAtInput, 'observedAt');
  const notBefore = Date.parse(lease.validity.notBefore);
  const expiresAt = Date.parse(lease.validity.expiresAt);
  const exactRouteBound = routeMatches(lease, route);
  let state;
  const findings = [finding('FINITE_LEASE_STRUCTURE_VERIFIED', 'INFO', 'The lease has a canonical finite time window, one declared use, closed budgets, an exact loopback-port set, and a bounded authority request.')];

  if (!exactRouteBound) {
    state = 'REFUSED_ROUTE_BINDING_MISMATCH';
    findings.push(finding('EXACT_ROUTE_BINDING_MISMATCH', 'REFUSE', 'The lease does not match the expected route assessment, request, clone, service, beneficiary, target, or maximum duration.'));
  } else if (route.state !== EXECUTABLE_ROUTE_STATE) {
    state = 'HOLD_ROUTE_NOT_EXECUTABLE';
    findings.push(finding('ROUTE_STATE_NOT_EXECUTABLE', 'HOLD', 'Only an exact proposal route ready for specialist-handler review may reach later lease gates.'));
  } else if (observedAt.milliseconds < notBefore) {
    state = 'HOLD_NOT_YET_ACTIVE';
    findings.push(finding('LEASE_NOT_YET_ACTIVE', 'HOLD', 'The explicit observation time is earlier than the lease notBefore boundary.'));
  } else if (observedAt.milliseconds >= expiresAt) {
    state = 'HOLD_EXPIRED';
    findings.push(finding('LEASE_EXPIRED', 'HOLD', 'The explicit observation time is at or after the lease expiresAt boundary.'));
  } else {
    state = 'HOLD_EXTERNAL_GATES';
    findings.push(finding('HUMAN_APPROVAL_IDENTITY_UNVERIFIED', 'HOLD', 'The lease carries an attributed approval declaration, but this organ cannot authenticate the human or approval evidence.'));
    findings.push(finding('SINGLE_USE_CONSUMPTION_UNVERIFIED', 'HOLD', 'The lease declares maxUses one, but no append-only external consumption provider can prevent replay.'));
    findings.push(finding('NETWORK_ISOLATION_UNVERIFIED', 'HOLD', 'External network denial is requested, but no enforceable isolation provider or evidence is connected.'));
  }

  if (!ASSESSMENT_STATES.includes(state)) throw new Error('lease assessment escaped its closed state set');
  const assessment = {
    schema: ASSESSMENT_SCHEMA,
    assessmentId: null,
    assessmentDigest: null,
    status: 'TEST',
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    source: {
      leaseId: lease.leaseId,
      leaseDigest: lease.leaseDigest,
      routeAssessmentId: lease.source.routeAssessmentId,
      routeAssessmentDigest: lease.source.routeAssessmentDigest,
      requestId: lease.source.requestId,
      requestDigest: lease.source.requestDigest
    },
    observedAt: observedAt.value,
    state,
    structure: {
      finiteWindow: true,
      singleUseDeclared: true,
      exactRouteBound,
      authorityCeilingHeld: true,
      loopbackPortsExact: true,
      externalHumanApprovalAuthenticated: false,
      externalNetworkIsolationVerified: false,
      singleUseConsumptionVerified: false
    },
    findings,
    views: {
      human: { suppliedRendering: lease.humanRendering, summary: humanSummary(state), nonAuthoritative: true },
      machine: {
        cloneId: lease.source.cloneId,
        serviceKind: lease.source.serviceKind,
        beneficiaryKind: lease.source.beneficiary.kind,
        targetKind: lease.source.target.kind,
        notBefore: lease.validity.notBefore,
        expiresAt: lease.validity.expiresAt,
        maxUses: 1,
        maxDurationMs: lease.budget.maxDurationMs,
        maxProcesses: lease.budget.maxProcesses,
        loopbackPorts: lease.loopbackPorts.slice()
      }
    },
    counts: ZERO_COUNTS,
    authority: ZERO_AUTHORITY,
    nextGate: 'INDEPENDENTLY_VERIFY_THE_ROUTE_AND_REFERENCED_BYTES_THEN_AUTHENTICATE_HUMAN_APPROVAL_CONSUME_THE_LEASE_ONCE_ENFORCE_NETWORK_ISOLATION_AND_EXAMINE_A_DISPOSABLE_LAUNCHER',
    limitations: [
      'This organ proves only finite structure, exact caller-supplied route binding, and authority-ceiling refusal.',
      'It does not independently authenticate the route source, beneficiary, approver, approval evidence, target bytes, or isolation provider.',
      'It does not consume the lease, prevent replay, launch a process, open a port, control a target, capture visuals, verify cleanup, or decide release.',
      'A structural hold is not permission, runtime readiness, service success, specialist competence, promotion, CANON, or world authority.'
    ],
    boundary: 'Pure TEST verifier only. All human authentication, single-use state, network enforcement, process execution, target access, cleanup, return admission, release, permissions, promotion, CANON, and world action remain outside.'
  };
  assessment.assessmentId = `outward-clone-execution-lease-assessment-${digest(without(assessment, 'assessmentId', 'assessmentDigest')).slice(0, 24)}`;
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return stable(assessment);
}

function verifyAssessment(value, lease, route, observedAt) {
  const assessment = stable(value);
  exactKeys(assessment, ['schema', 'assessmentId', 'assessmentDigest', 'status', 'organ', 'source', 'observedAt', 'state', 'structure', 'findings', 'views', 'counts', 'authority', 'nextGate', 'limitations', 'boundary'], 'lease assessment');
  if (assessment.schema !== ASSESSMENT_SCHEMA || assessment.status !== 'TEST' || !ASSESSMENT_STATES.includes(assessment.state)) throw new Error('lease assessment identity changed');
  if (!assessment.organ || assessment.organ.id !== ORGAN_ID || assessment.organ.body !== 'DETERMINISTIC_KERNEL' || assessment.organ.learnedWeights !== false) throw new Error('lease assessment organ identity changed');
  if (!same(assessment.counts, ZERO_COUNTS) || !same(assessment.authority, ZERO_AUTHORITY)) throw new Error('lease assessment action or authority boundary changed');
  const expected = assessLease(lease, route, observedAt);
  if (!same(assessment, expected)) throw new Error('lease assessment no longer matches its exact source trace');
  return assessment;
}

module.exports = {
  ORGAN_ID,
  LEASE_SCHEMA,
  ASSESSMENT_SCHEMA,
  EXECUTABLE_ROUTE_STATE,
  MAX_LEASE_WINDOW_MS,
  MAX_RUNTIME_DURATION_MS,
  MAX_PROCESSES,
  MAX_LOOPBACK_PORTS,
  MAX_CAPTURE_BYTES,
  AUTHORITY_KEYS,
  FORBIDDEN_AUTHORITY_KEYS,
  ASSESSMENT_STATES,
  ZERO_COUNTS,
  ZERO_AUTHORITY,
  stable,
  digest,
  sealLease,
  verifyLease,
  assessLease,
  verifyAssessment
};
