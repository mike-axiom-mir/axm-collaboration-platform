'use strict';

const fs = require('fs');
const path = require('path');
const Watch = require('../kernel/outcome-method-prospective-watch-cell');
const ChallengerOrgan = require('./outcome-method-challenger-organ');
const OutcomeOrgan = require('./outcome-learning-organ');
const Planner = require('./outcome-curriculum-planner-organ');
const Foundation = require('../kernel/reasoning-foundation');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.outcome-method-prospective-watch-organ/v1';
const REGISTRATION_BATCH_SCHEMA = 'axm.mirror.outcome-method-prospective-registration-batch/v1';
const OBSERVATION_BATCH_SCHEMA = 'axm.mirror.outcome-method-prospective-observation-batch/v1';
const DEFAULT_REGISTRATION_STATE_DIR = path.join(ROOT, 'state', 'outcome-method-prospective-watch-registrations');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'outcome-method-prospective-watch-runs');
const DEFAULT_CHALLENGER_STATE_DIR = ChallengerOrgan.DEFAULT_STATE_DIR;
const DEFAULT_OUTCOME_STATE_DIR = Planner.DEFAULT_OUTCOME_STATE_DIR;
const MAX_OUTCOME_BATCHES = 256;
const MAX_SOURCE_BYTES = 96 * 1024 * 1024;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Watch.same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function rejectHidden(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/chain.?of.?thought|hidden.?reasoning|private.?reasoning|reasoning.?content/i.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    rejectHidden(value[key], trail.concat(key));
  }
}
function ensureDirectory(directory, label) {
  const target = path.resolve(directory);
  fs.mkdirSync(target, { recursive: true });
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return target;
}
function validateOutcomeBatches(batches) {
  if (!Array.isArray(batches) || batches.length > MAX_OUTCOME_BATCHES) throw new Error('prospective watch Outcome batch inventory exceeds its bound');
  const copies = batches.map(clone).sort((left, right) => left.batchId.localeCompare(right.batchId));
  if (new Set(copies.map(item => item.batchId)).size !== copies.length || new Set(copies.map(item => item.batchDigest)).size !== copies.length) throw new Error('prospective watch Outcome batch inventory contains duplicate identity');
  copies.forEach(OutcomeOrgan.verify);
  return copies;
}
function registrationSourceRefs(source) {
  return {
    challengerBatch: { batchId: source.challengerBatch.batchId, batchDigest: source.challengerBatch.batchDigest },
    knownOutcomeBatches: source.knownOutcomeBatches.map(item => ({ batchId: item.batchId, batchDigest: item.batchDigest })).sort((left, right) => left.batchId.localeCompare(right.batchId))
  };
}
function normalizeRegistration(input) {
  rejectHidden(input);
  exactKeys(input, ['challengerBatch', 'challengerSource', 'knownOutcomeBatches'], 'prospective watch registration input');
  const challengerBatch = clone(input.challengerBatch);
  const challengerSource = clone(input.challengerSource);
  ChallengerOrgan.verify(challengerBatch, challengerSource);
  const knownOutcomeBatches = validateOutcomeBatches(input.knownOutcomeBatches);
  const knownById = new Map(knownOutcomeBatches.map(item => [item.batchId, item]));
  for (const ref of challengerBatch.source.outcomeBatches) {
    const known = knownById.get(ref.batchId);
    if (!known || known.batchDigest !== ref.batchDigest) throw new Error('prospective watch registration omits a Challenger source Outcome batch');
  }
  if (Buffer.byteLength(JSON.stringify({ challengerBatch, challengerSource, knownOutcomeBatches }), 'utf8') > MAX_SOURCE_BYTES) throw new Error('prospective watch registration source bytes exceed its bound');
  return { challengerBatch, challengerSource, knownOutcomeBatches };
}
function sealRegistrationBatch(batch) {
  batch.batchId = `outcome-method-watch-registration-${Watch.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  batch.batchDigest = Watch.digest(Object.assign({}, batch, { batchDigest: null }));
  return Watch.stable(batch);
}
function runRegistration(input, options = {}) {
  const source = normalizeRegistration(input);
  const createdAt = String(options.at == null ? '' : options.at).trim() || source.challengerBatch.createdAt;
  const registrationInventory = Watch.inventoryFrom(source.knownOutcomeBatches);
  Watch.verifyInventory(registrationInventory);
  const requests = new Map(source.challengerSource.curriculumBatch.requests.map(item => [item.requestId, item]));
  const resultsBySignature = new Map(source.challengerBatch.results.map(item => [item.failureSignatureDigest, item]));
  const watches = [];
  const holds = [];
  for (const candidate of source.challengerBatch.candidateSet.candidates.slice().sort((left, right) => left.candidateId.localeCompare(right.candidateId))) {
    const request = requests.get(candidate.origin.curriculumRequestId);
    const result = resultsBySignature.get(candidate.failureSignatureDigest);
    const historicalEvaluation = result && result.historicalEvaluations.find(item => item.candidate.candidateId === candidate.candidateId);
    const controlEvaluation = result && result.controlEvaluations.find(item => item.candidate.candidateId === candidate.candidateId);
    if (!request || !result || !historicalEvaluation || !controlEvaluation) throw new Error('prospective watch Challenger source chain is incomplete');
    const historicalFit = historicalEvaluation.metrics.evaluableFields > 0 && historicalEvaluation.metrics.candidateMismatches === 0 && historicalEvaluation.metrics.candidateMatches === historicalEvaluation.metrics.evaluableFields;
    const controlsSafe = controlEvaluation.metrics.candidateMismatches === 0;
    if (!historicalFit || !controlsSafe) {
      holds.push({
        candidateId: candidate.candidateId,
        candidateDigest: candidate.candidateDigest,
        failureSignatureDigest: candidate.failureSignatureDigest,
        state: historicalFit ? 'HOLD_HISTORICAL_MATCH_CONTROL_REGRESSION' : 'HOLD_HISTORICAL_FAILURE_NOT_REPRODUCED'
      });
      continue;
    }
    watches.push(Watch.sealWatch({
      challengerBatch: source.challengerBatch,
      candidate,
      curriculumRequest: request,
      historicalEvaluation,
      controlEvaluation,
      registrationInventory
    }));
  }
  watches.sort((left, right) => left.watchId.localeCompare(right.watchId));
  holds.sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  return sealRegistrationBatch({
    schema: REGISTRATION_BATCH_SCHEMA,
    batchId: null,
    batchDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_SEALED_CANDIDATE_WATCH_REGISTRATION_AGAINST_BOUNDED_KNOWN_OUTCOME_INVENTORY' },
    source: registrationSourceRefs(source),
    registrationInventory,
    watches,
    holds,
    summary: {
      knownOutcomeBatches: source.knownOutcomeBatches.length,
      knownPredictions: registrationInventory.predictions.length,
      knownObservations: registrationInventory.observations.length,
      knownTargetKeys: registrationInventory.knownTargetKeys.length,
      challengerCandidates: source.challengerBatch.candidateSet.candidates.length,
      watchesRegistered: watches.length,
      candidatesHeld: holds.length,
      postRegistrationOutcomeBatchesReadDuringWatchSeal: 0,
      independentAuthorshipCertifications: 0,
      externalChronologyCertifications: 0,
      trainingAdmissions: 0,
      predictionRewrites: 0,
      repairApplications: 0,
      permissionGrants: 0,
      toolCalls: 0,
      shadowAdmissions: 0,
      runtimeSelections: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state: watches.length ? 'PROSPECTIVE_WATCHES_REGISTERED' : 'NO_ELIGIBLE_PROSPECTIVE_WATCHES',
    authority: Object.assign({ privateProposalTraceWrite: true }, Watch.falseAuthority()),
    boundary: 'This TEST registration organ verifies a complete Challenger source, preserves historical failure and match-control vetoes, and content-seals eligible candidates with a bounded caller-supplied local Outcome inventory before observation. It cannot certify that the supplied inventory is globally complete, read later outcomes during watch sealing, grant held-out or independence status, rewrite predictions, repair, train, grant permission, use tools, admit a shadow or runtime method, promote, change CANON, or act.'
  });
}
function verifyRegistration(batch, input, runDir) {
  exactKeys(batch, ['schema', 'batchId', 'batchDigest', 'createdAt', 'organ', 'source', 'registrationInventory', 'watches', 'holds', 'summary', 'state', 'authority', 'boundary'], 'prospective watch registration batch');
  if (batch.schema !== REGISTRATION_BATCH_SCHEMA || batch.organ.id !== ORGAN_ID || batch.organ.status !== 'TEST' || batch.organ.learnedWeights !== false || batch.organ.claimCeiling !== 'TEST_SEALED_CANDIDATE_WATCH_REGISTRATION_AGAINST_BOUNDED_KNOWN_OUTCOME_INVENTORY') throw new Error('prospective watch registration boundary changed');
  const trueAuthority = new Set(['privateProposalTraceWrite']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('prospective watch registration gained authority');
  Watch.verifyInventory(batch.registrationInventory);
  batch.watches.forEach(Watch.verifyWatch);
  const zeros = ['postRegistrationOutcomeBatchesReadDuringWatchSeal', 'independentAuthorshipCertifications', 'externalChronologyCertifications', 'trainingAdmissions', 'predictionRewrites', 'repairApplications', 'permissionGrants', 'toolCalls', 'shadowAdmissions', 'runtimeSelections', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeros.some(key => batch.summary[key] !== 0)) throw new Error('prospective watch registration claim ceiling changed');
  if (batch.batchDigest !== Watch.digest(Object.assign({}, batch, { batchDigest: null })) || batch.batchId !== `outcome-method-watch-registration-${Watch.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`) throw new Error('prospective watch registration identity changed');
  const source = normalizeRegistration(input);
  if (!Watch.same(batch.source, registrationSourceRefs(source)) || !Watch.same(batch.registrationInventory, Watch.inventoryFrom(source.knownOutcomeBatches))) throw new Error('prospective watch registration source binding changed');
  const reconstructed = runRegistration(source, { at: batch.createdAt });
  if (!Watch.same(reconstructed, batch)) throw new Error('prospective watch registration does not replay from its complete source bundle');
  if (runDir) {
    const diskBatch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    const diskSource = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
    if (!Watch.same(diskBatch, batch) || !Watch.same(normalizeRegistration(diskSource), source)) throw new Error('prospective watch registration stored files changed');
  }
  return true;
}

function normalizeObservation(input) {
  rejectHidden(input);
  exactKeys(input, ['registrationBatch', 'registrationSource', 'outcomeBatches'], 'prospective watch observation input');
  const registrationBatch = clone(input.registrationBatch);
  const registrationSource = clone(input.registrationSource);
  verifyRegistration(registrationBatch, registrationSource);
  const outcomeBatches = validateOutcomeBatches(input.outcomeBatches);
  const currentById = new Map(outcomeBatches.map(item => [item.batchId, item]));
  for (const ref of registrationBatch.registrationInventory.outcomeBatches) {
    const current = currentById.get(ref.batchId);
    if (!current || current.batchDigest !== ref.batchDigest) throw new Error('prospective watch observation inventory omits or changes a registration Outcome batch');
  }
  if (Buffer.byteLength(JSON.stringify({ registrationBatch, registrationSource, outcomeBatches }), 'utf8') > MAX_SOURCE_BYTES) throw new Error('prospective watch observation source bytes exceed its bound');
  return { registrationBatch, registrationSource, outcomeBatches };
}
function observationSourceRefs(source) {
  return {
    registrationBatch: { batchId: source.registrationBatch.batchId, batchDigest: source.registrationBatch.batchDigest },
    outcomeBatches: source.outcomeBatches.map(item => ({ batchId: item.batchId, batchDigest: item.batchDigest })).sort((left, right) => left.batchId.localeCompare(right.batchId))
  };
}

function foundationSession(result, watch, options = {}) {
  Watch.verifyResult(result, watch);
  const positive = result.proposal.state === 'PROPOSE_PRIVATE_SHADOW_METHOD_REVIEW';
  const evidence = [{
    id: watch.watchId,
    kind: 'artifact',
    status: 'observed',
    statement: `Prospective watch ${watch.watchId} binds candidate ${watch.candidate.candidateId} to ${watch.registrationInventory.outcomeBatches.length} known local Outcome batch(es) before this observation call.`,
    source: { kind: 'outcome-method-prospective-watch', id: watch.watchId, at: null }
  }].concat(result.prospectiveEvidence.map(item => ({
    id: item.evidenceId,
    kind: 'test',
    status: 'tested',
    statement: `Local post-registration evidence ${item.evidenceId} compares one absent-at-registration target without certifying external chronology or independent authorship.`,
    source: { kind: 'outcome-method-prospective-evidence', id: item.evidenceId, at: null }
  }))).concat([{
    id: result.resultId,
    kind: 'test',
    status: 'tested',
    statement: `Prospective result ${result.resultId} is content-bound in state ${result.proposal.state}: ${result.metrics.candidateMatches} candidate match(es), ${result.metrics.baselineMatches} baseline match(es), and ${result.metrics.candidateMismatches} candidate mismatch(es).`,
    source: { kind: 'outcome-method-prospective-result', id: result.resultId, at: null }
  }]);
  const evidenceIds = evidence.map(item => item.id);
  const unknowns = [
    { id: `external-chronology-${watch.watchId.slice(-20)}`, question: 'Can an external anchor prove that the attributed outcomes came into existence after this candidate and registration inventory were sealed?', blocking: true },
    { id: `independent-authorship-${watch.watchId.slice(-20)}`, question: 'Were the later prediction targets and observations authored independently of the candidate and its builders?', blocking: true },
    { id: `broader-transfer-${watch.watchId.slice(-20)}`, question: 'Does the candidate preserve broader counterpatterns, seeds, scopes, and longer-horizon behavior beyond this bounded local evidence?', blocking: true },
    { id: `shadow-admission-${watch.watchId.slice(-20)}`, question: 'What separate reviewed governance contract could admit this candidate to a private shadow without granting runtime decision authority?', blocking: true }
  ];
  const actionId = positive ? `propose-private-shadow-review-${result.resultId}` : `preserve-prospective-hold-${result.resultId}`;
  const action = {
    id: actionId,
    kind: positive ? 'proposal' : 'hold',
    label: positive ? 'Propose human review for a separate private shadow-method admission contract' : `Preserve the prospective method hold ${result.proposal.state}`,
    requiredPermissions: [],
    supportingEvidence: evidenceIds,
    preconditionEvidence: evidenceIds,
    expectedEffects: [positive ? 'A steward can inspect the exact candidate and evidence before deciding whether a separate shadow-only admission organ should be built.' : 'No method role changes while the exact gap remains inspectable.'],
    possibleSideEffects: ['Local post-registration evidence may still share authorship, fixture families, or undeclared causal dependencies.'],
    reversible: true,
    recovery: 'Discard the proposal or hold interpretation while preserving the registration, evidence, exclusions, and result.',
    risk: 'low'
  };
  const reasoning = {
    schema: 'axm.mirror.reason/v1',
    requestId: `outcome-prospective-foundation-${result.resultId}`,
    sessionId: `outcome-prospective-${result.resultId}`,
    actor: { id: 'mirror-outcome-method-prospective-watch-organ', kind: 'machine', displayName: 'Mirror Outcome Method Prospective Watch Organ' },
    goal: { id: 'observe-sealed-method-prospectively', statement: 'Compare an already sealed declarative method candidate with later verified local Outcome batches while excluding known evidence and preserving chronology, independence, transfer, and admission as open questions.' },
    evidence,
    unknowns,
    constraints: [{ id: 'prospective-watch-proposal-only', type: 'max-risk', statement: 'The watch may propose review but may not admit a shadow, change predictions or runtime methods, train, repair, grant permission, promote, canonize, or act.', actionIds: [actionId], evidenceIds: [], permission: null, maxRisk: 'low', hard: true }],
    permissions: [],
    actions: [action],
    budget: { maxCandidates: 2, deadlineMs: 1000 },
    decomposition: unknowns.map((item, index) => ({
      id: item.id,
      question: item.question,
      dependsOn: [],
      cheapestCheck: index === 0 ? 'Bind the watch digest to an external timestamp before any externally sourced outcomes are created.' : index === 1 ? 'Use a separately attributed evaluator and provenance receipts outside the candidate-building route.' : index === 2 ? 'Repeat against new counterpatterns and preserved regressions without changing the candidate.' : 'Specify a separate proposal-only private shadow admission contract with an explicit human gate.',
      status: 'OPEN',
      answerEvidenceRefs: []
    })),
    assumptions: [],
    pathProfiles: [{
      pathId: `path-${actionId}`,
      actionId,
      approach: action.label,
      questionIds: unknowns.map(item => item.id),
      requiredEvidence: evidenceIds,
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: positive ? 0.9 : 0.4,
      reversible: true,
      failureConditions: ['Known registration evidence receives prospective credit.', 'Duplicate or conflicting targets inflate metrics.', 'Local append order is relabelled external chronology.', 'A review proposal silently becomes shadow or runtime admission.'],
      strategyTags: ['outcome-method-prospective-watch', positive ? 'request-shadow-review' : 'preserve-hold']
    }],
    verificationReceipts: [{
      id: `verify-${result.resultId}`,
      actionId,
      claim: 'The exact watch and complete supplied Outcome inventory reproduce this prospective result while known evidence, unresolved states, and duplicate targets receive no improvement credit.',
      evidenceRefs: evidenceIds,
      method: 'Re-run the deterministic Prospective Watch verifier from its complete registration and Outcome source bundle.',
      result: 'PASS',
      limitations: ['bounded caller-supplied registration inventory', 'local content order only', 'no certified held-out, independence, external chronology, broad transfer, shadow admission, or runtime admission']
    }],
    outcome: {
      result: 'HOLD',
      statement: positive ? 'Bounded local post-registration evidence supports a proposal to review a separate private shadow route; no method was admitted or changed.' : `The method watch remains held in state ${result.proposal.state}; no method was admitted or changed.`,
      evidenceRefs: evidenceIds,
      transferEvidenceRefs: [],
      regressionEvidenceRefs: [watch.historicalEvidence.historicalFailureFit.evaluationId, watch.historicalEvidence.historicalMatchControl.evaluationId],
      repairEvidenceRefs: [],
      resolvedSeams: [],
      observedAt: options.at || null,
      verified: true,
      repeatedVerifiedOutcomes: result.metrics.fullyEvaluableTargets,
      usePermission: 'unknown',
      permissionBasis: null,
      worldMutations: 0,
      runtimePointerChanged: false,
      unexpectedSeams: []
    }
  };
  return Foundation.run(reasoning, { at: options.at });
}

function sealObservationBatch(batch) {
  batch.batchId = `outcome-method-watch-observation-${Watch.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  batch.batchDigest = Watch.digest(Object.assign({}, batch, { batchDigest: null }));
  return Watch.stable(batch);
}
function runObservation(input, options = {}) {
  const source = normalizeObservation(input);
  const createdAt = String(options.at == null ? '' : options.at).trim() || source.outcomeBatches.map(item => item.createdAt).concat(source.registrationBatch.createdAt).sort().at(-1);
  const results = source.registrationBatch.watches.map(watch => Watch.evaluateWatch(watch, source.outcomeBatches)).sort((left, right) => left.resultId.localeCompare(right.resultId));
  const watchById = new Map(source.registrationBatch.watches.map(item => [item.watchId, item]));
  results.forEach(item => Watch.verifyResult(item, watchById.get(item.watch.watchId)));
  const pairs = results.map(result => ({ result, session: foundationSession(result, watchById.get(result.watch.watchId), { at: createdAt }) }));
  const foundationSessions = pairs.map(item => item.session).sort((left, right) => left.reasoningSessionId.localeCompare(right.reasoningSessionId));
  const reasoningBindings = pairs.map(item => ({ resultId: item.result.resultId, resultDigest: item.result.resultDigest, reasoningSessionId: item.session.reasoningSessionId })).sort((left, right) => left.resultId.localeCompare(right.resultId));
  const knownIds = new Set(source.registrationBatch.registrationInventory.outcomeBatches.map(item => item.batchId));
  const proposals = results.filter(item => item.proposal.state === 'PROPOSE_PRIVATE_SHADOW_METHOD_REVIEW').length;
  return sealObservationBatch({
    schema: OBSERVATION_BATCH_SCHEMA,
    batchId: null,
    batchDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_LOCAL_POST_REGISTRATION_METHOD_EVIDENCE_TO_PRIVATE_SHADOW_REVIEW_PROPOSAL' },
    source: observationSourceRefs(source),
    results,
    reasoningBindings,
    foundationSessions,
    summary: {
      registeredWatches: source.registrationBatch.watches.length,
      suppliedOutcomeBatches: source.outcomeBatches.length,
      postRegistrationBatchIdentities: source.outcomeBatches.filter(item => !knownIds.has(item.batchId)).length,
      acceptedProspectiveEvidence: results.reduce((sum, item) => sum + item.metrics.acceptedEvidence, 0),
      fullyEvaluableTargets: results.reduce((sum, item) => sum + item.metrics.fullyEvaluableTargets, 0),
      candidateMatches: results.reduce((sum, item) => sum + item.metrics.candidateMatches, 0),
      candidateMismatches: results.reduce((sum, item) => sum + item.metrics.candidateMismatches, 0),
      baselineMatches: results.reduce((sum, item) => sum + item.metrics.baselineMatches, 0),
      duplicateSourceChainsExcluded: results.reduce((sum, item) => sum + item.metrics.duplicateSourceChainsExcluded, 0),
      ambiguousTargets: results.reduce((sum, item) => sum + item.metrics.ambiguousTargets, 0),
      privateShadowReviewProposals: proposals,
      holds: results.length - proposals,
      foundationSessions: foundationSessions.length,
      heldOutCertifications: 0,
      independentAuthorshipCertifications: 0,
      externalChronologyCertifications: 0,
      trainingAdmissions: 0,
      predictionRewrites: 0,
      repairApplications: 0,
      permissionGrants: 0,
      toolCalls: 0,
      shadowAdmissions: 0,
      runtimeSelections: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state: proposals ? 'PRIVATE_SHADOW_METHOD_REVIEW_PROPOSED' : results.length ? 'PROSPECTIVE_METHOD_WATCHES_HELD' : 'NO_REGISTERED_PROSPECTIVE_WATCHES',
    authority: Object.assign({ privateProposalTraceWrite: true }, Watch.falseAuthority()),
    boundary: 'This TEST organ automatically compares registered closed candidates with later supplied verified local Outcome batches, excludes registration-known and duplicate evidence, preserves unresolved and conflicting targets, and may propose human review of a separate private shadow contract. It cannot certify held-out status, independence, external chronology, causality, broad generalization, or runtime readiness; admit a shadow or runtime method; rewrite predictions; repair; train; grant permission; use tools; promote; change CANON; or act.'
  });
}
function verifyObservation(batch, input, runDir) {
  exactKeys(batch, ['schema', 'batchId', 'batchDigest', 'createdAt', 'organ', 'source', 'results', 'reasoningBindings', 'foundationSessions', 'summary', 'state', 'authority', 'boundary'], 'prospective watch observation batch');
  if (batch.schema !== OBSERVATION_BATCH_SCHEMA || batch.organ.id !== ORGAN_ID || batch.organ.status !== 'TEST' || batch.organ.learnedWeights !== false || batch.organ.claimCeiling !== 'TEST_LOCAL_POST_REGISTRATION_METHOD_EVIDENCE_TO_PRIVATE_SHADOW_REVIEW_PROPOSAL') throw new Error('prospective watch observation boundary changed');
  const trueAuthority = new Set(['privateProposalTraceWrite']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('prospective watch observation gained authority');
  const source = normalizeObservation(input);
  const watchById = new Map(source.registrationBatch.watches.map(item => [item.watchId, item]));
  batch.results.forEach(item => {
    const watch = watchById.get(item.watch.watchId);
    if (!watch) throw new Error('prospective result references an unknown watch');
    Watch.verifyResult(item, watch);
  });
  if (batch.foundationSessions.some(session => session.authority.proposalOnly !== true || Object.entries(session.authority).some(([key, value]) => key !== 'proposalOnly' && value !== false))) throw new Error('prospective watch Foundation session gained authority');
  const zeros = ['heldOutCertifications', 'independentAuthorshipCertifications', 'externalChronologyCertifications', 'trainingAdmissions', 'predictionRewrites', 'repairApplications', 'permissionGrants', 'toolCalls', 'shadowAdmissions', 'runtimeSelections', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeros.some(key => batch.summary[key] !== 0)) throw new Error('prospective watch observation claim ceiling changed');
  if (!Watch.same(batch.source, observationSourceRefs(source))) throw new Error('prospective watch observation source refs changed');
  if (batch.batchDigest !== Watch.digest(Object.assign({}, batch, { batchDigest: null })) || batch.batchId !== `outcome-method-watch-observation-${Watch.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`) throw new Error('prospective watch observation identity changed');
  const reconstructed = runObservation(source, { at: batch.createdAt });
  if (!Watch.same(reconstructed, batch)) throw new Error('prospective watch observation does not replay from its complete source bundle');
  if (runDir) {
    const diskBatch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    const diskSource = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
    if (!Watch.same(diskBatch, batch) || !Watch.same(normalizeObservation(diskSource), source)) throw new Error('prospective watch observation stored files changed');
  }
  return true;
}

function recordImmutable(batch, source, options, stateDir, verifier, label) {
  verifier(batch, source);
  if (options.write === false) return { batch, written: false, reused: false, runDir: null };
  const root = ensureDirectory(options.stateDir || stateDir, label);
  const finalDir = path.join(root, batch.batchId);
  if (fs.existsSync(finalDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(finalDir, 'batch.json'), 'utf8'));
    const existingSource = JSON.parse(fs.readFileSync(path.join(finalDir, 'source.json'), 'utf8'));
    verifier(existing, existingSource, finalDir);
    if (!Watch.same(existing, batch)) throw new Error(`${label} immutable identity collision`);
    return { batch: existing, written: false, reused: true, runDir: finalDir };
  }
  const stageDir = path.join(root, `.${batch.batchId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), JSON.stringify(batch, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'source.json'), JSON.stringify(source, null, 2) + '\n', { flag: 'wx' });
  verifier(batch, source, stageDir);
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  return { batch, written: !commit.reused, reused: commit.reused, runDir: commit.runDir };
}
function recordRegistration(input, options = {}) {
  const source = normalizeRegistration(input);
  const batch = runRegistration(source, options);
  return recordImmutable(batch, source, options, DEFAULT_REGISTRATION_STATE_DIR, verifyRegistration, 'prospective watch registration state root');
}
function recordObservation(input, options = {}) {
  const source = normalizeObservation(input);
  const batch = runObservation(source, options);
  return recordImmutable(batch, source, options, DEFAULT_STATE_DIR, verifyObservation, 'prospective watch observation state root');
}

function loadLatestChallengerRun(options = {}) {
  const root = path.resolve(options.challengerStateDir || DEFAULT_CHALLENGER_STATE_DIR);
  if (!fs.existsSync(root)) return null;
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('prospective watch Challenger root must be a real directory');
  const runs = fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory() && /^outcome-method-challenger-[a-f0-9]{24}$/.test(item.name)).map(entry => {
    const runDir = path.join(root, entry.name);
    const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    const source = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
    ChallengerOrgan.verify(batch, source, runDir);
    return { challengerBatch: batch, challengerSource: source };
  }).sort((left, right) => left.challengerBatch.createdAt.localeCompare(right.challengerBatch.createdAt) || left.challengerBatch.batchId.localeCompare(right.challengerBatch.batchId));
  return runs.length ? runs.at(-1) : null;
}
function loadLatestRegistration(options = {}) {
  const root = path.resolve(options.registrationStateDir || DEFAULT_REGISTRATION_STATE_DIR);
  if (!fs.existsSync(root)) return null;
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('prospective watch registration root must be a real directory');
  const runs = fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory() && /^outcome-method-watch-registration-[a-f0-9]{24}$/.test(item.name)).map(entry => {
    const runDir = path.join(root, entry.name);
    const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    const source = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
    verifyRegistration(batch, source, runDir);
    return { registrationBatch: batch, registrationSource: source };
  }).sort((left, right) => left.registrationBatch.createdAt.localeCompare(right.registrationBatch.createdAt) || left.registrationBatch.batchId.localeCompare(right.registrationBatch.batchId));
  return runs.length ? runs.at(-1) : null;
}

module.exports = {
  ROOT,
  ORGAN_ID,
  REGISTRATION_BATCH_SCHEMA,
  OBSERVATION_BATCH_SCHEMA,
  DEFAULT_REGISTRATION_STATE_DIR,
  DEFAULT_STATE_DIR,
  DEFAULT_CHALLENGER_STATE_DIR,
  DEFAULT_OUTCOME_STATE_DIR,
  MAX_OUTCOME_BATCHES,
  MAX_SOURCE_BYTES,
  normalizeRegistration,
  runRegistration,
  verifyRegistration,
  normalizeObservation,
  foundationSession,
  runObservation,
  verifyObservation,
  recordRegistration,
  recordObservation,
  loadLatestChallengerRun,
  loadLatestRegistration
};
