'use strict';

const crypto = require('node:crypto');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const PackCell = require('../kernel/pure-wasm-heldout-novelty-pack-cell');
const Executor = require('./disposable-pure-wasm-code-executor-organ');
const BehaviorVerifier = require('./pure-wasm-independent-behavior-verifier-organ');
const Profile = require('../kernel/pure-wasm-candidate-profile-cell');

const ORGAN_ID = PackCell.VERIFIER_ID;
const REQUEST_SCHEMA = 'axm.mirror.pure-wasm-heldout-novelty-exam-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.pure-wasm-heldout-novelty-exam-receipt/v1';
const AUTHORITY_KEYS = Object.freeze([
  'candidateGeneration', 'referenceBoundaryCertification', 'noveltyCertification',
  'behaviorCertification', 'evidenceAdmission', 'trainingAdmission',
  'mirrorSourceWrite', 'workshopSourceWrite', 'permissionGrant', 'installation',
  'promotion', 'canon', 'worldAction'
]);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));
const RECEIPT_STATES = Object.freeze([
  'PASS_SYNTHETIC_NOVELTY_DISTINCTION_MECHANICS_ONLY',
  'PASS_DECLARED_HELDOUT_DISTINCTION_PROPOSAL_ONLY',
  'HOLD_NOVELTY_PERMISSION',
  'REFUSED_REQUESTED_AUTHORITY',
  'HOLD_CANDIDATE_TRACE',
  'HOLD_REFERENCE_EXECUTOR_RESULT',
  'HOLD_REFERENCE_BOUNDARY_DRIFT',
  'HOLD_CANDIDATE_EXECUTOR_RESULT',
  'HOLD_TARGET_BEHAVIOR_MISMATCH',
  'HOLD_NO_BOUNDED_NOVELTY_DISTINCTION'
]);

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} fields changed`);
}

function identity(value, label, maximum = 160) {
  if (typeof value !== 'string' || !value || value.length > maximum || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value)) throw new Error(`${label} must be a bounded identity`);
  return value;
}

function text(value, label, maximum = 1600) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} must be bounded non-empty text`);
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validateRequest(value) {
  const request = KeySafeJson.stable(value, { maxBytes: 768 * 1024, maxDepth: 56, maxNodes: 16384 });
  exactKeys(request, ['candidate', 'limits', 'noveltyExamId', 'pack', 'permission', 'requestedAuthority', 'schema', 'specialistId', 'status'], 'held-out novelty exam request');
  if (request.schema !== REQUEST_SCHEMA || request.status !== 'EXPERIMENTAL' || request.specialistId !== 'future-code-mirror') throw new Error('held-out novelty exam request identity changed');
  identity(request.noveltyExamId, 'held-out novelty exam ID');
  request.pack = PackCell.verifyPack(request.pack);

  exactKeys(request.candidate, ['authorId', 'bytesBase64', 'format', 'sha256'], 'novelty proposed candidate');
  if (request.candidate.format !== 'PURE_WASM_I32X2_TO_I32_V1' || !/^[a-f0-9]{64}$/.test(String(request.candidate.sha256 || ''))) throw new Error('novelty proposed candidate identity changed');
  identity(request.candidate.authorId, 'novelty proposed candidate author');
  Executor.decodeCanonicalBase64(request.candidate.bytesBase64);

  exactKeys(request.permission, ['basis', 'grantedById', 'grantedByKind', 'identityCertified', 'scope', 'state'], 'novelty exam permission');
  if (!['ALLOWED', 'NOT_ALLOWED', 'UNKNOWN'].includes(request.permission.state) || request.permission.scope !== 'ONE_EXACT_PURE_WASM_HELDOUT_NOVELTY_EXAM' || !['HUMAN_DECLARED_LOCAL', 'TEST_HARNESS'].includes(request.permission.grantedByKind) || request.permission.identityCertified !== false) throw new Error('novelty exam permission fields changed');
  identity(request.permission.grantedById, 'novelty permission grantor');
  text(request.permission.basis, 'novelty permission basis');

  exactKeys(request.limits, ['candidateBytesPerSubject', 'caseCountPerSubject', 'executorReplaysPerCase', 'referenceSubjects', 'stdoutBytesPerReplay', 'subjects', 'wallTimeMsPerReplay'], 'novelty exam limits');
  if (request.limits.subjects !== 3 || request.limits.referenceSubjects !== 2 || request.limits.caseCountPerSubject !== 3 || request.limits.executorReplaysPerCase !== 2) throw new Error('novelty exam requires two references plus one candidate, three cases each, and two replays per case');
  if (!Number.isInteger(request.limits.candidateBytesPerSubject) || request.limits.candidateBytesPerSubject < 256 || request.limits.candidateBytesPerSubject > Profile.MAX_CANDIDATE_BYTES) throw new Error('novelty candidate byte limit changed');
  if (!Number.isInteger(request.limits.stdoutBytesPerReplay) || request.limits.stdoutBytesPerReplay < 1024 || request.limits.stdoutBytesPerReplay > 16 * 1024) throw new Error('novelty output limit changed');
  if (!Number.isInteger(request.limits.wallTimeMsPerReplay) || request.limits.wallTimeMsPerReplay < 100 || request.limits.wallTimeMsPerReplay > 2000) throw new Error('novelty wall-time limit changed');

  exactKeys(request.requestedAuthority, ['executeBoundReferenceAndCandidateCases', ...AUTHORITY_KEYS], 'novelty requested authority');
  if (typeof request.requestedAuthority.executeBoundReferenceAndCandidateCases !== 'boolean' || AUTHORITY_KEYS.some(key => typeof request.requestedAuthority[key] !== 'boolean')) throw new Error('novelty authority values must be booleans');
  return request;
}

function authorityIsClosed(request) {
  return request.requestedAuthority.executeBoundReferenceAndCandidateCases === true && AUTHORITY_KEYS.every(key => request.requestedAuthority[key] === false);
}

function candidateTraceMatches(request) {
  const bytes = Executor.decodeCanonicalBase64(request.candidate.bytesBase64);
  if (bytes.length > request.limits.candidateBytesPerSubject || sha256(bytes) !== request.candidate.sha256) return false;
  if (request.pack.candidateBinding.candidateDigest !== request.candidate.sha256 || request.pack.candidateBinding.candidateAuthorId !== request.candidate.authorId || request.pack.candidateBinding.candidateFormat !== request.candidate.format) return false;
  const forbiddenSeats = [ORGAN_ID, Executor.ORGAN_ID, request.pack.author.authorId, ...request.pack.priorCapabilityBoundary.references.map(item => item.authorId)];
  return !forbiddenSeats.includes(request.candidate.authorId);
}

function subjectCandidate(request, subject, referenceId = null) {
  if (subject === 'PROPOSED_CANDIDATE') return request.candidate;
  if (subject !== 'PRIOR_REFERENCE') throw new Error('novelty exam subject changed');
  const reference = request.pack.priorCapabilityBoundary.references.find(item => item.referenceId === referenceId);
  if (!reference) throw new Error('novelty reference identity changed');
  return reference;
}

function buildExecutorRequest(request, noveltyCase, subject, referenceId = null) {
  const candidate = subjectCandidate(request, subject, referenceId);
  const executionIdentity = KeySafeJson.digest({ noveltyExamId: request.noveltyExamId, packId: request.pack.packId, caseId: noveltyCase.caseId, subject, referenceId });
  return {
    schema: Executor.REQUEST_SCHEMA,
    status: 'EXPERIMENTAL',
    requestId: `novelty-execution/${executionIdentity.slice(0, 24)}`,
    specialistId: 'future-code-mirror',
    candidate: {
      format: candidate.format,
      bytesBase64: candidate.bytesBase64,
      sha256: candidate.sha256
    },
    input: { left: noveltyCase.input.left, right: noveltyCase.input.right },
    permission: {
      state: request.permission.state,
      scope: 'ONE_EXACT_PURE_WASM_CANDIDATE_EXECUTION',
      grantedByKind: request.permission.grantedByKind,
      grantedById: request.permission.grantedById,
      identityCertified: false,
      basis: request.permission.basis
    },
    limits: {
      candidateBytes: request.limits.candidateBytesPerSubject,
      stdoutBytes: request.limits.stdoutBytesPerReplay,
      wallTimeMs: request.limits.wallTimeMsPerReplay,
      replays: request.limits.executorReplaysPerCase
    },
    requestedAuthority: {
      executeExactCandidate: true,
      ...Object.fromEntries(Executor.AUTHORITY_KEYS.map(key => [key, false]))
    }
  };
}

function forbiddenNoveltyKeys(value) {
  let count = 0;
  function visit(current) {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) return current.forEach(visit);
    for (const [key, child] of Object.entries(current)) {
      if (/expected|answer|oracle|targetResult|referenceResult|sealedResult|packDigest|storyDigest|boundaryDigest/i.test(key)) count += 1;
      visit(child);
    }
  }
  visit(value);
  return count;
}

function expectedFor(noveltyCase, subject, referenceId = null) {
  if (subject === 'PROPOSED_CANDIDATE') return noveltyCase.targetExpected.result;
  const row = noveltyCase.referenceExpected.find(item => item.referenceId === referenceId);
  if (!row) throw new Error('novelty reference expectation missing');
  return row.result;
}

function baseCaseRecord(noveltyCase, subject, referenceId = null) {
  const sealedExpectedResult = expectedFor(noveltyCase, subject, referenceId);
  return {
    subject,
    referenceId,
    caseId: noveltyCase.caseId,
    sourceGroupId: noveltyCase.sourceGroupId,
    family: noveltyCase.family,
    inputDigest: KeySafeJson.digest(noveltyCase.input),
    sealedExpectedDigest: KeySafeJson.digest({ result: sealedExpectedResult }),
    sealedExpectedResult,
    executorRequestId: null,
    executorRequestDigest: null,
    executorReceiptId: null,
    executorReceiptDigest: null,
    executorState: 'NOT_RUN',
    actualResult: null,
    exactExpectedMatch: false,
    referenceComparisons: [],
    answerFieldsInExecutorRequest: 0,
    state: 'NOT_RUN_PREEXECUTION_HOLD'
  };
}

function executeSubject(request, subject, referenceId = null, options = {}) {
  const records = [];
  let stopped = false;
  for (const noveltyCase of request.pack.cases) {
    if (stopped) {
      const skipped = baseCaseRecord(noveltyCase, subject, referenceId);
      skipped.state = 'NOT_RUN_AFTER_EXECUTOR_HOLD';
      records.push(skipped);
      continue;
    }
    const executorRequest = buildExecutorRequest(request, noveltyCase, subject, referenceId);
    const answerFields = forbiddenNoveltyKeys(executorRequest);
    if (answerFields !== 0) throw new Error('novelty answer field leaked into executor request');
    const record = baseCaseRecord(noveltyCase, subject, referenceId);
    record.executorRequestId = executorRequest.requestId;
    record.executorRequestDigest = KeySafeJson.digest(Executor.validateRequest(executorRequest));
    record.answerFieldsInExecutorRequest = answerFields;
    const rawReceipt = Executor.execute(executorRequest, { tempRoot: options.tempRoot });
    let executorReceipt;
    try {
      executorReceipt = BehaviorVerifier.validateExecutorReceipt(rawReceipt, executorRequest);
    } catch (_error) {
      record.executorReceiptId = rawReceipt && rawReceipt.receiptId || null;
      record.executorReceiptDigest = rawReceipt && rawReceipt.receiptDigest || null;
      record.executorState = rawReceipt && rawReceipt.state || 'INVALID_EXECUTOR_RECEIPT';
      record.state = subject === 'PRIOR_REFERENCE' ? 'HOLD_REFERENCE_EXECUTOR_RESULT' : 'HOLD_CANDIDATE_EXECUTOR_RESULT';
      records.push(record);
      stopped = true;
      continue;
    }
    record.executorReceiptId = executorReceipt.receiptId;
    record.executorReceiptDigest = executorReceipt.receiptDigest;
    record.executorState = executorReceipt.state;
    record.actualResult = executorReceipt.result;
    record.exactExpectedMatch = executorReceipt.result === record.sealedExpectedResult;
    if (subject === 'PRIOR_REFERENCE') record.state = record.exactExpectedMatch ? 'PASS_REFERENCE_BOUNDARY' : 'FAIL_REFERENCE_BOUNDARY_DRIFT';
    else record.state = record.exactExpectedMatch ? 'PASS_TARGET_BEHAVIOR' : 'FAIL_TARGET_BEHAVIOR_MISMATCH';
    records.push(record);
  }
  return records;
}

function notRunCandidateRecords(request, state) {
  return request.pack.cases.map(item => {
    const record = baseCaseRecord(item, 'PROPOSED_CANDIDATE');
    record.state = state;
    return record;
  });
}

function emptyReferenceRecords(request) {
  return request.pack.priorCapabilityBoundary.references.flatMap(reference => request.pack.cases.map(item => baseCaseRecord(item, 'PRIOR_REFERENCE', reference.referenceId)));
}

function compareCandidateToReferences(request, referenceCases, candidateCases) {
  return candidateCases.map(candidateCase => {
    const output = KeySafeJson.stable(candidateCase);
    output.referenceComparisons = request.pack.priorCapabilityBoundary.references.map(reference => {
      const prior = referenceCases.find(item => item.referenceId === reference.referenceId && item.caseId === candidateCase.caseId);
      if (!prior || prior.actualResult === null) throw new Error('novelty current reference observation missing');
      return {
        referenceId: reference.referenceId,
        referenceActualResult: prior.actualResult,
        candidateActualResult: candidateCase.actualResult,
        behaviorDiffers: prior.actualResult !== candidateCase.actualResult
      };
    });
    return output;
  });
}

function finding(code, state, statement, detail = {}) {
  return { code, state, statement, detail };
}

function buildReceipt({ request, state, findings, referenceCases, candidateCases }) {
  if (!RECEIPT_STATES.includes(state)) throw new Error('novelty receipt state changed');
  const referenceRuns = referenceCases.filter(item => item.executorRequestId !== null).length;
  const candidateRuns = candidateCases.filter(item => item.executorRequestId !== null).length;
  const referencePasses = referenceCases.filter(item => item.state === 'PASS_REFERENCE_BOUNDARY').length;
  const referenceDrifts = referenceCases.filter(item => item.state === 'FAIL_REFERENCE_BOUNDARY_DRIFT').length;
  const targetPasses = candidateCases.filter(item => item.state === 'PASS_TARGET_BEHAVIOR').length;
  const targetMismatches = candidateCases.filter(item => item.state === 'FAIL_TARGET_BEHAVIOR_MISMATCH').length;
  const contrastCountsByReference = Object.fromEntries(request.pack.priorCapabilityBoundary.references.map(reference => [reference.referenceId, candidateCases.filter(item => item.referenceComparisons.some(row => row.referenceId === reference.referenceId && row.behaviorDiffers)).length]));
  const everyReferenceDistinguished = Object.values(contrastCountsByReference).length === PackCell.REFERENCE_COUNT && Object.values(contrastCountsByReference).every(count => count >= PackCell.MINIMUM_CONTRASTS_PER_REFERENCE);
  const pass = state.startsWith('PASS_');
  const claimClass = state === 'PASS_SYNTHETIC_NOVELTY_DISTINCTION_MECHANICS_ONLY'
    ? 'SYNTHETIC_FINITE_REFERENCE_DISTINCTION_MECHANICS_ONLY'
    : state === 'PASS_DECLARED_HELDOUT_DISTINCTION_PROPOSAL_ONLY'
      ? 'DECLARED_HELDOUT_FINITE_REFERENCE_DISTINCTION_PROPOSAL_ONLY'
      : 'NO_NOVELTY_DISTINCTION_CLAIM';
  const basis = {
    schema: RECEIPT_SCHEMA,
    status: 'TEST',
    state,
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    verification: {
      noveltyExamId: request.noveltyExamId,
      requestDigest: KeySafeJson.digest(request),
      packId: request.pack.packId,
      packDigest: request.pack.packDigest,
      packClass: request.pack.packClass,
      storyId: request.pack.storyTrace.storyId,
      storyDigest: request.pack.storyTrace.storyDigest,
      capabilityHypothesis: request.pack.storyTrace.capabilityHypothesis,
      humanRenderingNonAuthoritative: true,
      candidateDigest: request.candidate.sha256,
      candidateAuthorId: request.candidate.authorId,
      packAuthorId: request.pack.author.authorId,
      priorBoundaryId: request.pack.priorCapabilityBoundary.boundaryId,
      priorBoundaryDigest: request.pack.priorCapabilityBoundary.boundaryDigest
    },
    findings,
    referenceCases,
    candidateCases,
    summary: {
      referenceSubjects: PackCell.REFERENCE_COUNT,
      requiredCasesPerSubject: PackCell.CASE_FAMILIES.length,
      executorReplaysPerRunCase: request.limits.executorReplaysPerCase,
      referenceCasesRun: referenceRuns,
      referencePasses,
      referenceDrifts,
      candidateCasesRun: candidateRuns,
      targetPasses,
      targetMismatches,
      contrastCountsByReference,
      minimumContrastsPerReference: PackCell.MINIMUM_CONTRASTS_PER_REFERENCE,
      everyReferenceDistinguished,
      freshCandidateProcessReplaysObserved: (referenceRuns + candidateRuns) * request.limits.executorReplaysPerCase,
      maximumFreshCandidateProcessReplays: request.limits.subjects * request.limits.caseCountPerSubject * request.limits.executorReplaysPerCase
    },
    noveltyEvidence: {
      machineState: pass ? 'PASS' : state.includes('MISMATCH') || state.includes('NO_BOUNDED') ? 'FAIL' : 'HOLD',
      claimClass,
      finiteReferenceBoundaryReplayed: referencePasses === 6,
      candidateMatchedFrozenTarget: targetPasses === 3,
      distinguishableFromEveryReferenceAtDeclaredMinimum: everyReferenceDistinguished,
      referenceSetCompletenessCertified: false,
      priorCapabilityAdmissionsCertified: false,
      externalBoundaryChronologyCertified: false,
      authorshipIdentityCertified: false,
      independenceCryptographicallyProven: false,
      independenceExternallyVerified: false,
      globalNoveltyProven: false,
      independentCreationProven: false,
      usefulnessProven: false,
      storyCoherenceProven: false,
      eligibleForCodeStoryNoveltyClaim: false,
      evidenceAdmission: false,
      trainingAdmission: false
    },
    separation: {
      candidateSealedBeforePackAuthorship: request.pack.independence.candidateSealedBeforePackAuthorship,
      packFrozenBeforeFirstEvaluation: request.pack.frozenBeforeFirstEvaluation,
      expectedAnswerFieldsInExecutorRequests: referenceCases.concat(candidateCases).reduce((sum, item) => sum + item.answerFieldsInExecutorRequest, 0),
      expectedOutputsSentToAnyCandidateProcess: false,
      referencesExecutedBeforeCandidate: candidateRuns === 0 || referencePasses === 6,
      directCurrentExecutorInvocation: true,
      submittedThirdPartyExecutorReceiptsAccepted: false,
      allDeclaredSeatsDistinct: candidateTraceMatches(request)
    },
    authority: Object.assign({ executeOnlyBoundReferenceAndCandidateCases: authorityIsClosed(request) }, ZERO_AUTHORITY),
    limitations: [
      'The observed distinction is relative only to two exact sealed references and three exact inputs. The finite reference set is explicitly not certified complete.',
      'A matching candidate may have been copied, hard-coded, or exposed to equivalent cases elsewhere. Declared held-out separation is not cryptographic or externally verified independence.',
      'Different bytes do not establish different capability behavior; only current bounded outputs are compared.',
      'Behavioral distinction does not establish usefulness, story coherence, maintainability, broad correctness, regression safety, learning improvement, wisdom, or global originality.',
      'Every passing receipt remains proposal-only and ineligible for real Code Story novelty admission until outside evidence and human gates exist.'
    ],
    boundary: 'Replays two exact finite-boundary references before one exact proposed pure-Wasm candidate, then checks three frozen target outputs and bounded behavioral distinction without sending expected results into any candidate process. It grants no novelty certification, evidence or training admission, source write, installation, promotion, CANON, or world authority.'
  };
  const receiptDigest = KeySafeJson.digest(basis);
  return Object.assign({ receiptId: `pure-wasm-novelty-${receiptDigest.slice(0, 24)}`, receiptDigest }, basis);
}

function verify(value, options = {}) {
  const request = validateRequest(value);
  const emptyReferences = emptyReferenceRecords(request);
  const emptyCandidate = notRunCandidateRecords(request, 'NOT_RUN_PREEXECUTION_HOLD');
  if (request.permission.state !== 'ALLOWED') {
    return buildReceipt({ request, state: 'HOLD_NOVELTY_PERMISSION', findings: [finding('NOVELTY_EXECUTION_NOT_ALLOWED', 'HOLD', 'The exact held-out novelty exam permission is not ALLOWED; no subject ran.')], referenceCases: emptyReferences, candidateCases: emptyCandidate });
  }
  if (!authorityIsClosed(request)) {
    return buildReceipt({ request, state: 'REFUSED_REQUESTED_AUTHORITY', findings: [finding('NOVELTY_VERIFIER_AUTHORITY_GROWTH', 'REFUSE', 'Only the exact reference and candidate cases may execute; every other requested authority must remain false.')], referenceCases: emptyReferences, candidateCases: emptyCandidate });
  }
  if (!candidateTraceMatches(request)) {
    return buildReceipt({ request, state: 'HOLD_CANDIDATE_TRACE', findings: [finding('NOVELTY_CANDIDATE_TRACE_MISMATCH', 'HOLD', 'Candidate bytes, digest, author, pack binding, limits, and verifier separation are not one exact trace.')], referenceCases: emptyReferences, candidateCases: emptyCandidate });
  }

  const referenceCases = [];
  for (const reference of request.pack.priorCapabilityBoundary.references) {
    const records = executeSubject(request, 'PRIOR_REFERENCE', reference.referenceId, options);
    referenceCases.push(...records);
    if (records.some(item => item.state === 'HOLD_REFERENCE_EXECUTOR_RESULT')) {
      const remaining = request.pack.priorCapabilityBoundary.references.slice(referenceCases.length / 3).flatMap(item => request.pack.cases.map(noveltyCase => baseCaseRecord(noveltyCase, 'PRIOR_REFERENCE', item.referenceId)));
      return buildReceipt({ request, state: 'HOLD_REFERENCE_EXECUTOR_RESULT', findings: [finding('REFERENCE_EXECUTOR_DID_NOT_RETURN_PASS', 'HOLD', 'A prior-boundary reference did not complete its exact executor boundary; later references and the proposed candidate did not run.')], referenceCases: referenceCases.concat(remaining), candidateCases: notRunCandidateRecords(request, 'NOT_RUN_REFERENCE_BOUNDARY_UNAVAILABLE') });
    }
  }
  const drifts = referenceCases.filter(item => item.state === 'FAIL_REFERENCE_BOUNDARY_DRIFT');
  if (drifts.length) {
    return buildReceipt({ request, state: 'HOLD_REFERENCE_BOUNDARY_DRIFT', findings: [finding('CURRENT_REFERENCE_DIFFERS_FROM_SEALED_BOUNDARY', 'HOLD', `${drifts.length} current reference observations differ from the sealed prior boundary; the proposed candidate did not run.`, { caseIds: drifts.map(item => `${item.referenceId}:${item.caseId}`) })], referenceCases, candidateCases: notRunCandidateRecords(request, 'NOT_RUN_AFTER_REFERENCE_BOUNDARY_DRIFT') });
  }

  let candidateCases = executeSubject(request, 'PROPOSED_CANDIDATE', null, options);
  if (candidateCases.some(item => item.state === 'HOLD_CANDIDATE_EXECUTOR_RESULT')) {
    return buildReceipt({ request, state: 'HOLD_CANDIDATE_EXECUTOR_RESULT', findings: [finding('PROPOSED_CANDIDATE_EXECUTOR_DID_NOT_RETURN_PASS', 'HOLD', 'The proposed candidate did not complete its exact executor boundary; later candidate cases did not run.')], referenceCases, candidateCases });
  }
  candidateCases = compareCandidateToReferences(request, referenceCases, candidateCases);
  const mismatches = candidateCases.filter(item => item.state === 'FAIL_TARGET_BEHAVIOR_MISMATCH');
  if (mismatches.length) {
    return buildReceipt({ request, state: 'HOLD_TARGET_BEHAVIOR_MISMATCH', findings: [finding('PROPOSED_CANDIDATE_MISSED_HELDOUT_TARGET', 'HOLD', `${mismatches.length} of 3 proposed-candidate results differ from the frozen target behavior.`, { caseIds: mismatches.map(item => item.caseId) })], referenceCases, candidateCases });
  }
  const contrastCounts = request.pack.priorCapabilityBoundary.references.map(reference => candidateCases.filter(item => item.referenceComparisons.some(row => row.referenceId === reference.referenceId && row.behaviorDiffers)).length);
  if (contrastCounts.some(count => count < PackCell.MINIMUM_CONTRASTS_PER_REFERENCE)) {
    return buildReceipt({ request, state: 'HOLD_NO_BOUNDED_NOVELTY_DISTINCTION', findings: [finding('PROPOSED_CANDIDATE_NOT_DISTINCT_FROM_FINITE_REFERENCE_BOUNDARY', 'HOLD', 'The candidate matched its target but did not differ from every prior-boundary reference at the declared minimum.')], referenceCases, candidateCases });
  }
  const state = request.pack.packClass === 'SYNTHETIC_TEST_HARNESS'
    ? 'PASS_SYNTHETIC_NOVELTY_DISTINCTION_MECHANICS_ONLY'
    : 'PASS_DECLARED_HELDOUT_DISTINCTION_PROPOSAL_ONLY';
  return buildReceipt({
    request,
    state,
    findings: [finding(
      state === 'PASS_SYNTHETIC_NOVELTY_DISTINCTION_MECHANICS_ONLY' ? 'SYNTHETIC_FINITE_BOUNDARY_DISTINCTION_PASS' : 'DECLARED_HELDOUT_FINITE_BOUNDARY_DISTINCTION_PASS',
      'INFO',
      state === 'PASS_SYNTHETIC_NOVELTY_DISTINCTION_MECHANICS_ONLY'
        ? 'The two synthetic references reproduced, the candidate matched three frozen targets, and it differed from every reference at least twice; this is TEST_HARNESS mechanics evidence only.'
        : 'The declared held-out finite-boundary comparison passed; authorship, boundary completeness, chronology, and real novelty remain uncertified and proposal-only.'
    )],
    referenceCases,
    candidateCases
  });
}

module.exports = {
  ORGAN_ID,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  AUTHORITY_KEYS,
  ZERO_AUTHORITY,
  RECEIPT_STATES,
  exactKeys,
  validateRequest,
  authorityIsClosed,
  candidateTraceMatches,
  subjectCandidate,
  buildExecutorRequest,
  forbiddenNoveltyKeys,
  expectedFor,
  baseCaseRecord,
  executeSubject,
  compareCandidateToReferences,
  buildReceipt,
  verify
};
