'use strict';

const fs = require('fs');
const path = require('path');
const Lifecycle = require('../kernel/outcome-method-private-shadow-lifecycle-cell');
const Shadow = require('../kernel/outcome-method-private-shadow-cell');
const WatchOrgan = require('./outcome-method-prospective-watch-organ');
const Outcome = require('../kernel/outcome-learning-cell');
const OutcomeOrgan = require('./outcome-learning-organ');
const Planner = require('./outcome-curriculum-planner-organ');
const Foundation = require('../kernel/reasoning-foundation');
const ImmutableStore = require('../kernel/immutable-batch-store');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.outcome-method-private-shadow-steward-organ/v1';
const CYCLE_SCHEMA = 'axm.mirror.outcome-method-private-shadow-steward-cycle/v1';
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'outcome-method-private-shadow-steward-cycles');
const DEFAULT_WATCH_STATE_DIR = WatchOrgan.DEFAULT_STATE_DIR;
const DEFAULT_OUTCOME_STATE_DIR = Planner.DEFAULT_OUTCOME_STATE_DIR;
const MAX_WATCH_RUNS = 128;
const MAX_OUTCOME_BATCHES = 256;
const MAX_PRIOR_CYCLES = 256;
const MAX_PREDICTION_EVIDENCE = 2048;
const MAX_SOURCE_BYTES = 128 * 1024 * 1024;
const MAX_VERIFIED_SOURCE_CACHE_ENTRIES = 32;
const MAX_VERIFIED_SOURCE_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_VERIFIED_COMPONENT_CACHE_ENTRIES = 4096;
const verifiedSourceCache = new Map();
const verifiedWatchRunCache = new Set();
const verifiedOutcomeBatchCache = new Set();
const verifiedPredictionEvidenceCache = new Set();
let verifiedSourceCacheBytes = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Lifecycle.same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} shape changed`);
}
function transportSource(value) {
  return KeySafeJson.canonicalize(value, {
    maxBytes: MAX_SOURCE_BYTES,
    maxDepth: KeySafeJson.DEFAULT_MAX_DEPTH + 8,
    maxNodes: Math.floor(MAX_SOURCE_BYTES / 2) + 1,
    rejectKey(key, trail) {
      if (/chain.?of.?thought|hidden.?reasoning|private.?reasoning|scratchpad|internal.?monologue/i.test(key)) throw new Error(`private shadow steward refuses hidden reasoning field at ${trail.join('.')}`);
      return false;
    }
  });
}
function cachedVerifiedSource(digest) {
  const entry = verifiedSourceCache.get(digest);
  if (!entry) return null;
  verifiedSourceCache.delete(digest);
  verifiedSourceCache.set(digest, entry);
  return JSON.parse(entry.encoded);
}
function cacheVerifiedSource(digest, source) {
  const encoded = JSON.stringify(source);
  const bytes = Buffer.byteLength(encoded);
  if (bytes > MAX_VERIFIED_SOURCE_CACHE_BYTES) return;
  const prior = verifiedSourceCache.get(digest);
  if (prior) {
    verifiedSourceCacheBytes -= prior.bytes;
    verifiedSourceCache.delete(digest);
  }
  while (verifiedSourceCache.size && (verifiedSourceCache.size >= MAX_VERIFIED_SOURCE_CACHE_ENTRIES || verifiedSourceCacheBytes + bytes > MAX_VERIFIED_SOURCE_CACHE_BYTES)) {
    const oldestKey = verifiedSourceCache.keys().next().value;
    const oldest = verifiedSourceCache.get(oldestKey);
    verifiedSourceCache.delete(oldestKey);
    verifiedSourceCacheBytes -= oldest.bytes;
  }
  verifiedSourceCache.set(digest, { encoded, bytes });
  verifiedSourceCacheBytes += bytes;
}
function verifyExactComponent(cache, value, verifier) {
  const digest = KeySafeJson.digest(value);
  if (cache.has(digest)) return;
  verifier();
  if (cache.has(digest)) cache.delete(digest);
  while (cache.size >= MAX_VERIFIED_COMPONENT_CACHE_ENTRIES) cache.delete(cache.values().next().value);
  cache.add(digest);
}
function sourceBytes(value, label) {
  const bytes = Buffer.byteLength(JSON.stringify(value));
  if (bytes > MAX_SOURCE_BYTES) throw new Error(`${label} source exceeds byte limit`);
  return bytes;
}
function ensureDirectory(directory, label) {
  const resolved = path.resolve(directory);
  fs.mkdirSync(resolved, { recursive: true });
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return resolved;
}
function lifecycleAuthority() {
  return {
    privateEvaluationTraceWrite: true,
    privateLifecycleRouting: true,
    livePredictionReplacement: false,
    operativeShadowAdmission: false,
    methodSelection: false,
    trainingAdmission: false,
    permissionGrant: false,
    toolUse: false,
    runtimeSelection: false,
    runtimeAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    worldAction: false
  };
}
function foundationAuthoritySafe(session) {
  return session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}
function validateTrigger(trigger) {
  if (trigger === null) return null;
  exactKeys(trigger, ['id', 'digest', 'at', 'kind'], 'private shadow steward trigger');
  if (!String(trigger.id).trim() || !/^[a-f0-9]{64}$/.test(trigger.digest) || !String(trigger.at).trim() || !String(trigger.kind).trim()) throw new Error('private shadow steward trigger is incomplete');
  return clone(trigger);
}
function validateWatchRuns(rows) {
  if (!Array.isArray(rows) || rows.length > MAX_WATCH_RUNS) throw new Error('private shadow steward Watch inventory exceeds its bound');
  const byId = new Map();
  for (const row of rows) {
    exactKeys(row, ['batch', 'source'], 'private shadow steward Watch run');
    verifyExactComponent(verifiedWatchRunCache, row, () => WatchOrgan.verifyObservation(row.batch, row.source));
    const current = { batch: clone(row.batch), source: clone(row.source) };
    const existing = byId.get(current.batch.batchId);
    if (existing && !Lifecycle.same(existing, current)) throw new Error('private shadow steward Watch identity collision');
    byId.set(current.batch.batchId, current);
  }
  return Array.from(byId.values()).sort((left, right) => left.batch.batchId.localeCompare(right.batch.batchId));
}
function validateOutcomeBatches(batches) {
  if (!Array.isArray(batches) || batches.length > MAX_OUTCOME_BATCHES) throw new Error('private shadow steward Outcome inventory exceeds its bound');
  const byId = new Map();
  for (const batch of batches) {
    verifyExactComponent(verifiedOutcomeBatchCache, batch, () => OutcomeOrgan.verify(batch));
    const current = clone(batch);
    const existing = byId.get(current.batchId);
    if (existing && !Lifecycle.same(existing, current)) throw new Error('private shadow steward Outcome identity collision');
    byId.set(current.batchId, current);
  }
  return Array.from(byId.values()).sort((left, right) => left.batchId.localeCompare(right.batchId));
}
function validatePredictionEvidence(items) {
  if (!Array.isArray(items) || items.length > MAX_PREDICTION_EVIDENCE) throw new Error('private shadow steward prior prediction evidence exceeds its bound');
  const byId = new Map();
  for (const item of items) {
    verifyExactComponent(verifiedPredictionEvidenceCache, item, () => Lifecycle.verifyPredictionEvidence(item));
    const current = clone(item);
    const existing = byId.get(current.evidenceId);
    if (existing && !Lifecycle.same(existing, current)) throw new Error('private shadow steward prediction evidence identity collision');
    byId.set(current.evidenceId, current);
  }
  return Array.from(byId.values()).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
}
function validateDiscovery(discovery) {
  exactKeys(discovery, ['watchRuns', 'outcomeBatches', 'priorPredictionEvidence', 'ignoredStagingEntries'], 'private shadow steward discovery summary');
  for (const value of Object.values(discovery)) if (!Number.isSafeInteger(value) || value < 0) throw new Error('private shadow steward discovery summary is invalid');
  return clone(discovery);
}
function normalizeSource(input) {
  const transported = transportSource(input);
  const inertInput = transported.canonical;
  exactKeys(inertInput, ['trigger', 'watchRuns', 'outcomeBatches', 'priorPredictionEvidence', 'discovery'], 'private shadow steward source');
  const cached = cachedVerifiedSource(transported.digest);
  if (cached) return cached;
  const source = {
    trigger: validateTrigger(inertInput.trigger),
    watchRuns: validateWatchRuns(inertInput.watchRuns),
    outcomeBatches: validateOutcomeBatches(inertInput.outcomeBatches),
    priorPredictionEvidence: validatePredictionEvidence(inertInput.priorPredictionEvidence),
    discovery: validateDiscovery(inertInput.discovery)
  };
  if (source.discovery.watchRuns !== source.watchRuns.length || source.discovery.outcomeBatches !== source.outcomeBatches.length || source.discovery.priorPredictionEvidence !== source.priorPredictionEvidence.length) throw new Error('private shadow steward discovery counts do not match source');
  sourceBytes(source, 'private shadow steward');
  cacheVerifiedSource(transported.digest, source);
  return source;
}
function sourceRefs(source) {
  return {
    trigger: clone(source.trigger),
    watchRuns: source.watchRuns.map(item => ({ batchId: item.batch.batchId, batchDigest: item.batch.batchDigest })),
    outcomeBatches: source.outcomeBatches.map(item => ({ batchId: item.batchId, batchDigest: item.batchDigest })),
    priorPredictionEvidence: source.priorPredictionEvidence.map(item => ({ evidenceId: item.evidenceId, evidenceDigest: item.evidenceDigest })),
    discovery: clone(source.discovery),
    sourceDigest: Lifecycle.digest(source)
  };
}
function uniqueByIdentity(items, idKey, digestKey, label) {
  const map = new Map();
  let duplicates = 0;
  for (const item of items) {
    const key = item[idKey];
    const existing = map.get(key);
    if (existing) {
      if (existing[digestKey] !== item[digestKey] || !Lifecycle.same(existing, item)) throw new Error(`${label} identity collision`);
      duplicates += 1;
      continue;
    }
    map.set(key, clone(item));
  }
  return { items: Array.from(map.values()).sort((left, right) => left[idKey].localeCompare(right[idKey])), duplicates };
}
function currentObservations(batches) {
  return uniqueByIdentity(batches.flatMap(item => item.observations), 'observationId', 'observationDigest', 'private shadow steward observation');
}
function currentPredictions(batches) {
  return uniqueByIdentity(batches.flatMap(item => item.predictions), 'predictionId', 'predictionDigest', 'private shadow steward prediction');
}
function makeHold(phase, state, fields = {}) {
  return {
    phase,
    state,
    enrollmentId: fields.enrollmentId || null,
    evidenceId: fields.evidenceId || null,
    targetKey: fields.targetKey || null,
    predictionId: fields.predictionId || null,
    observationIds: (fields.observationIds || []).slice().sort()
  };
}
function holdSort(left, right) {
  return left.phase.localeCompare(right.phase) || left.state.localeCompare(right.state) || String(left.enrollmentId).localeCompare(String(right.enrollmentId)) || String(left.targetKey).localeCompare(String(right.targetKey)) || String(left.predictionId).localeCompare(String(right.predictionId));
}
function watchSourceComplete(run, outcomeById) {
  return run.source.outcomeBatches.every(ref => {
    const current = outcomeById.get(ref.batchId);
    return current && current.batchDigest === ref.batchDigest;
  });
}
function deriveEnrollments(source, outcomeById, holds) {
  const byId = new Map();
  let positiveWatchResults = 0;
  for (const run of source.watchRuns) {
    const watches = new Map(run.source.registrationBatch.watches.map(item => [item.watchId, item]));
    const complete = watchSourceComplete(run, outcomeById);
    for (const result of run.batch.results.slice().sort((left, right) => left.resultId.localeCompare(right.resultId))) {
      const watch = watches.get(result.watch.watchId);
      if (!watch) throw new Error('private shadow steward Watch result references an unknown watch');
      if (result.proposal.state !== 'PROPOSE_PRIVATE_SHADOW_METHOD_REVIEW') {
        holds.push(makeHold('enrollment', 'HOLD_WATCH_RESULT_NOT_POSITIVE', { targetKey: result.resultId }));
        continue;
      }
      positiveWatchResults += 1;
      if (!complete) {
        holds.push(makeHold('enrollment', 'HOLD_WATCH_SOURCE_OUTCOME_NOT_IN_CURRENT_INVENTORY', { enrollmentId: null, targetKey: result.resultId }));
        continue;
      }
      const enrollment = Shadow.enroll({ watch, result, watchObservationBatchId: run.batch.batchId, watchObservationBatchDigest: run.batch.batchDigest });
      const existing = byId.get(enrollment.enrollmentId);
      if (existing && !Lifecycle.same(existing, enrollment)) throw new Error('private shadow steward enrollment identity collision');
      byId.set(enrollment.enrollmentId, enrollment);
    }
  }
  return { enrollments: Array.from(byId.values()).sort((left, right) => left.enrollmentId.localeCompare(right.enrollmentId)), positiveWatchResults };
}
function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
function foundationSession(input) {
  const evidence = input.evidence.map(item => ({ id: item.id, kind: item.kind || 'artifact', status: item.status || 'observed', statement: item.statement, source: { kind: 'outcome-method-private-shadow-steward', id: item.id, at: null } }));
  const evidenceIds = evidence.map(item => item.id);
  const unknowns = [
    { id: `external-chronology-${input.subjectId.slice(-16)}`, question: 'Can an external anchor prove that each challenger prediction preceded its target observation?', blocking: true },
    { id: `independent-authorship-${input.subjectId.slice(-16)}`, question: 'Are target observations and evaluators independent from the candidate-building route?', blocking: true },
    { id: `broad-transfer-${input.subjectId.slice(-16)}`, question: 'Does the unchanged method survive real multi-scope, multi-seed, long-horizon counterpatterns?', blocking: true },
    { id: `live-trial-gate-${input.subjectId.slice(-16)}`, question: 'What separately reviewed reversible contract would be required before any live trial?', blocking: true }
  ];
  const actionId = `lifecycle-proposal-${input.subjectId}`;
  return Foundation.run({
    schema: 'axm.mirror.reason/v1',
    requestId: `private-shadow-steward-foundation-${input.subjectId}`,
    sessionId: `private-shadow-steward-${input.subjectId}`,
    actor: { id: 'mirror-outcome-method-private-shadow-steward-organ', kind: 'machine', displayName: 'Mirror Outcome Method Private Shadow Steward Organ' },
    goal: { id: 'private-shadow-lifecycle-stewardship', statement: 'Resume every verified private shadow opportunity without hindsight, evidence selection, duplicate target credit, or operative method authority.' },
    evidence,
    unknowns,
    constraints: [{ id: 'private-shadow-lifecycle-evaluation-only', type: 'max-risk', statement: 'Automatic routing is limited to ignored private evidence records and may not select a method, train, grant permission, enter runtime, promote, change CANON, or act.', actionIds: [actionId], evidenceIds: [], permission: null, maxRisk: 'low', hard: true }],
    permissions: [],
    actions: [{
      id: actionId,
      kind: input.positive ? 'proposal' : 'hold',
      label: input.positive ? 'Propose human review of resumed private shadow stability evidence' : 'Preserve the current private shadow lifecycle hold',
      requiredPermissions: [],
      supportingEvidence: evidenceIds,
      preconditionEvidence: evidenceIds,
      expectedEffects: ['Private lifecycle evidence remains inspectable and resumable without changing the baseline or runtime.'],
      possibleSideEffects: ['Repeated local sources may share authorship or fixture dependence and must not be counted as independent evidence.'],
      reversible: true,
      recovery: 'Ignore the proposal interpretation while preserving every source, prediction seal, evaluation, conflict, and hold.',
      risk: 'low'
    }],
    budget: { maxCandidates: 2, deadlineMs: 1000 },
    decomposition: [
      { id: unknowns[0].id, question: unknowns[0].question, dependsOn: [], cheapestCheck: 'Publish the prediction digest to a separately controlled append-only anchor before observation creation.', status: 'OPEN', answerEvidenceRefs: [] },
      { id: unknowns[1].id, question: unknowns[1].question, dependsOn: [], cheapestCheck: 'Use separately attributed target, observation, and evaluation producers.', status: 'OPEN', answerEvidenceRefs: [] },
      { id: unknowns[2].id, question: unknowns[2].question, dependsOn: [], cheapestCheck: 'Repeat the unchanged candidate across new scopes, sources, counterpatterns, and time horizons.', status: 'OPEN', answerEvidenceRefs: [] },
      { id: unknowns[3].id, question: unknowns[3].question, dependsOn: [], cheapestCheck: 'Design and separately review an isolated reversible live-trial contract; this organ cannot approve it.', status: 'OPEN', answerEvidenceRefs: [] }
    ],
    assumptions: [],
    pathProfiles: [{
      pathId: `path-${actionId}`,
      actionId,
      approach: 'Continue private lifecycle evaluation only',
      questionIds: unknowns.map(item => item.id),
      requiredEvidence: evidenceIds,
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: input.positive ? 0.9 : 0.5,
      reversible: true,
      failureConditions: ['A target was sealed after its observation existed.', 'A competing target chain was selected instead of held.', 'A lifecycle result changed live method behavior.'],
      strategyTags: ['outcome-method-private-shadow', 'automatic-lifecycle', input.positive ? 'review-evidence' : 'preserve-hold']
    }],
    verificationReceipts: [{ id: `verify-lifecycle-${input.subjectId}`, actionId, claim: 'Every lifecycle record reconstructs from all discovered Watch runs, the bounded Outcome inventory, and the complete prior prediction-evidence registry.', evidenceRefs: evidenceIds, method: 'Replay the deterministic lifecycle cell and organ from the stored complete source bundle.', result: 'PASS', limitations: ['local append order only', 'no external chronology', 'no independent authorship certificate', 'no live method or runtime authority'] }],
    outcome: { result: 'HOLD', statement: input.positive ? 'Resumed private evidence supports human stability review only; no operative state changed.' : 'The lifecycle remains held or pending; no operative state changed.', evidenceRefs: evidenceIds, transferEvidenceRefs: [], regressionEvidenceRefs: [], repairEvidenceRefs: [], resolvedSeams: [], observedAt: input.at, verified: true, repeatedVerifiedOutcomes: input.evaluatedTargets, usePermission: 'unknown', permissionBasis: null, worldMutations: 0, runtimePointerChanged: false, unexpectedSeams: [] }
  }, { at: input.at });
}
function cycleIdentity(body) {
  body.cycleId = `outcome-method-private-shadow-steward-${Lifecycle.digest(Object.assign({}, body, { cycleId: null, cycleDigest: null })).slice(0, 24)}`;
  body.cycleDigest = Lifecycle.digest(Object.assign({}, body, { cycleDigest: null }));
  return Lifecycle.stable(body);
}

function runFromSource(source, options = {}) {
  const outcomeById = new Map(source.outcomeBatches.map(item => [item.batchId, item]));
  const observationInventory = currentObservations(source.outcomeBatches);
  const predictionInventory = currentPredictions(source.outcomeBatches);
  const observations = observationInventory.items;
  const predictions = predictionInventory.items;
  const observationsByTarget = groupBy(observations, item => item.targetKey);
  const predictionsByTarget = groupBy(predictions, item => item.targetKey);
  const holds = [];
  const derived = deriveEnrollments(source, outcomeById, holds);
  const enrollments = derived.enrollments;
  const enrollmentById = new Map(enrollments.map(item => [item.enrollmentId, item]));
  const priorById = new Map();
  for (const evidence of source.priorPredictionEvidence) {
    if (!enrollmentById.has(evidence.enrollment.enrollmentId) || !Lifecycle.same(enrollmentById.get(evidence.enrollment.enrollmentId), evidence.enrollment)) {
      holds.push(makeHold('continuity', 'HOLD_PRIOR_PREDICTION_ENROLLMENT_ABSENT_OR_CHANGED', { enrollmentId: evidence.enrollment.enrollmentId, evidenceId: evidence.evidenceId, targetKey: evidence.shadowPrediction.baselinePrediction.targetKey, predictionId: evidence.shadowPrediction.baselinePrediction.predictionId }));
      continue;
    }
    priorById.set(evidence.evidenceId, evidence);
  }
  const priorEvidence = Array.from(priorById.values()).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const priorByTarget = groupBy(priorEvidence, Lifecycle.targetEvidenceKey);
  const newEvidence = [];
  const reusedEvidence = [];
  const conflictedTargetKeys = new Set();
  for (const enrollment of enrollments) {
    const applicable = predictions.filter(prediction => Lifecycle.same(prediction.method, enrollment.scope.baselineMethod) && prediction.scope.fieldSchemaId === enrollment.scope.fieldSchemaId && prediction.scope.fieldSchemaDigest === enrollment.scope.fieldSchemaDigest);
    const applicableByTarget = groupBy(applicable, item => item.targetKey);
    const targetKeys = new Set(Array.from(applicableByTarget.keys()).concat(Array.from(priorByTarget.keys()).filter(key => key.startsWith(`${enrollment.enrollmentId}:`)).map(key => key.slice(enrollment.enrollmentId.length + 1))));
    for (const targetKey of Array.from(targetKeys).sort()) {
      const lifecycleTargetKey = `${enrollment.enrollmentId}:${targetKey}`;
      const prior = (priorByTarget.get(lifecycleTargetKey) || []).slice().sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
      const baselines = (applicableByTarget.get(targetKey) || []).slice().sort((left, right) => left.predictionId.localeCompare(right.predictionId));
      if (prior.length > 1) {
        conflictedTargetKeys.add(lifecycleTargetKey);
        prior.forEach(item => holds.push(makeHold('continuity', 'HOLD_MULTIPLE_PRIOR_SHADOW_CHAINS_FOR_TARGET', { enrollmentId: enrollment.enrollmentId, evidenceId: item.evidenceId, targetKey, predictionId: item.shadowPrediction.baselinePrediction.predictionId })));
        continue;
      }
      if (baselines.length > 1) {
        conflictedTargetKeys.add(lifecycleTargetKey);
        baselines.forEach(item => holds.push(makeHold('prediction', 'HOLD_CONFLICTING_BASELINE_PREDICTIONS_FOR_TARGET', { enrollmentId: enrollment.enrollmentId, targetKey, predictionId: item.predictionId })));
        continue;
      }
      if (prior.length === 1) {
        const evidence = prior[0];
        if (baselines.length !== 1 || baselines[0].predictionId !== evidence.shadowPrediction.baselinePrediction.predictionId || baselines[0].predictionDigest !== evidence.shadowPrediction.baselinePrediction.predictionDigest) {
          conflictedTargetKeys.add(lifecycleTargetKey);
          holds.push(makeHold('continuity', baselines.length ? 'HOLD_BASELINE_CHAIN_CHANGED_AFTER_SHADOW_SEAL' : 'HOLD_BASELINE_SOURCE_MISSING_AFTER_SHADOW_SEAL', { enrollmentId: enrollment.enrollmentId, evidenceId: evidence.evidenceId, targetKey, predictionId: evidence.shadowPrediction.baselinePrediction.predictionId }));
          continue;
        }
        reusedEvidence.push(evidence);
        continue;
      }
      if (baselines.length !== 1) continue;
      const baseline = baselines[0];
      const targetObservations = observationsByTarget.get(targetKey) || [];
      if (targetObservations.length) {
        holds.push(makeHold('prediction', 'HOLD_TARGET_OBSERVATION_PRESENT_BEFORE_FIRST_LIFECYCLE_SEAL', { enrollmentId: enrollment.enrollmentId, targetKey, predictionId: baseline.predictionId, observationIds: targetObservations.map(item => item.observationId) }));
        continue;
      }
      if (!enrollment.scope.requiredFieldIds.every(fieldId => baseline.fields.some(item => item.fieldId === fieldId))) {
        holds.push(makeHold('prediction', 'HOLD_REQUIRED_CANDIDATE_FIELD_ABSENT', { enrollmentId: enrollment.enrollmentId, targetKey, predictionId: baseline.predictionId }));
        continue;
      }
      if (baseline.permission.status !== 'ALLOWED' || !baseline.assessment.evaluationEligible) {
        holds.push(makeHold('prediction', 'HOLD_BASELINE_PREDICTION_NOT_EVALUATION_ELIGIBLE', { enrollmentId: enrollment.enrollmentId, targetKey, predictionId: baseline.predictionId }));
        continue;
      }
      try { Outcome.verifyPrediction(baseline, observations); } catch (_) {
        holds.push(makeHold('prediction', 'HOLD_BASELINE_PRESEAL_INVENTORY_INCOMPLETE', { enrollmentId: enrollment.enrollmentId, targetKey, predictionId: baseline.predictionId }));
        continue;
      }
      const shadowPrediction = Shadow.sealShadowPrediction({ enrollment, baselinePrediction: baseline, observationsBeforeSeal: observations });
      newEvidence.push(Lifecycle.sealPredictionEvidence({ enrollment, shadowPrediction, observationsBeforeSeal: observations }));
    }
  }
  const registryById = new Map();
  for (const evidence of priorEvidence.concat(newEvidence)) {
    const existing = registryById.get(evidence.evidenceId);
    if (existing && !Lifecycle.same(existing, evidence)) throw new Error('private shadow steward registry identity collision');
    registryById.set(evidence.evidenceId, evidence);
  }
  const predictionEvidence = Array.from(registryById.values()).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  if (predictionEvidence.length > MAX_PREDICTION_EVIDENCE) throw new Error('private shadow steward accumulated prediction evidence exceeds its bound');
  const registryByTarget = groupBy(predictionEvidence, Lifecycle.targetEvidenceKey);
  const evaluations = [];
  const pendingByEnrollment = new Map();
  const conflictByEnrollment = new Map();
  function addTarget(map, enrollmentId, targetKey) {
    if (!map.has(enrollmentId)) map.set(enrollmentId, new Set());
    map.get(enrollmentId).add(targetKey);
  }
  for (const [key, evidenceRows] of Array.from(registryByTarget.entries()).sort((left, right) => left[0].localeCompare(right[0]))) {
    const enrollmentId = evidenceRows[0].enrollment.enrollmentId;
    const targetKey = evidenceRows[0].shadowPrediction.baselinePrediction.targetKey;
    if (evidenceRows.length !== 1 || conflictedTargetKeys.has(key)) {
      addTarget(conflictByEnrollment, enrollmentId, targetKey);
      evidenceRows.forEach(item => holds.push(makeHold('evaluation', 'HOLD_CONFLICTING_SHADOW_OR_BASELINE_CHAINS_FOR_TARGET', { enrollmentId, evidenceId: item.evidenceId, targetKey, predictionId: item.shadowPrediction.baselinePrediction.predictionId })));
      continue;
    }
    const evidence = evidenceRows[0];
    const targetObservations = (observationsByTarget.get(targetKey) || []).slice().sort((left, right) => left.observationId.localeCompare(right.observationId));
    if (!targetObservations.length) {
      addTarget(pendingByEnrollment, enrollmentId, targetKey);
      holds.push(makeHold('evaluation', 'HOLD_NO_LATER_TARGET_OBSERVATION', { enrollmentId, evidenceId: evidence.evidenceId, targetKey, predictionId: evidence.shadowPrediction.baselinePrediction.predictionId }));
      continue;
    }
    if (targetObservations.length > 1) {
      addTarget(conflictByEnrollment, enrollmentId, targetKey);
      holds.push(makeHold('evaluation', 'HOLD_CONFLICTING_LATER_TARGET_OBSERVATIONS', { enrollmentId, evidenceId: evidence.evidenceId, targetKey, predictionId: evidence.shadowPrediction.baselinePrediction.predictionId, observationIds: targetObservations.map(item => item.observationId) }));
      continue;
    }
    const evaluation = Shadow.evaluateShadow({ enrollment: evidence.enrollment, shadowPrediction: evidence.shadowPrediction, observationsBeforeSeal: evidence.observationsBeforeSeal, observation: targetObservations[0] });
    Shadow.verifyShadowEvaluation(evaluation, { enrollment: evidence.enrollment, shadowPrediction: evidence.shadowPrediction, observationsBeforeSeal: evidence.observationsBeforeSeal, observation: targetObservations[0] });
    evaluations.push(evaluation);
  }
  evaluations.sort((left, right) => left.evaluationId.localeCompare(right.evaluationId));
  const results = enrollments.map(enrollment => Shadow.buildStabilityResult(
    enrollment,
    evaluations.filter(item => item.enrollment.enrollmentId === enrollment.enrollmentId),
    Array.from(pendingByEnrollment.get(enrollment.enrollmentId) || []).sort(),
    Array.from(conflictByEnrollment.get(enrollment.enrollmentId) || []).sort()
  )).sort((left, right) => left.resultId.localeCompare(right.resultId));
  holds.sort(holdSort);
  const createdAtCandidates = source.watchRuns.map(item => item.batch.createdAt).concat(source.outcomeBatches.map(item => item.createdAt));
  const createdAt = String(options.at == null ? '' : options.at).trim() || (source.trigger && source.trigger.at) || createdAtCandidates.sort().at(-1) || '1970-01-01T00:00:00.000Z';
  const positiveResults = results.filter(item => item.proposal.state === 'PROPOSE_PRIVATE_SHADOW_STABILITY_REVIEW');
  const foundationSubject = positiveResults[0] ? positiveResults[0].resultId : `lifecycle-${sourceRefs(source).sourceDigest.slice(0, 24)}`;
  const foundationSessions = [foundationSession({
    subjectId: foundationSubject,
    at: createdAt,
    positive: positiveResults.length > 0,
    evaluatedTargets: evaluations.length,
    evidence: [{ id: sourceRefs(source).sourceDigest, statement: `Complete discovered lifecycle source ${sourceRefs(source).sourceDigest} contains ${source.watchRuns.length} Watch run(s), ${source.outcomeBatches.length} Outcome batch(es), and ${source.priorPredictionEvidence.length} prior prediction-evidence record(s).` }].concat(predictionEvidence.map(item => ({ id: item.evidenceId, statement: `Prediction evidence ${item.evidenceId} preserves target ${item.shadowPrediction.baselinePrediction.targetKey} before its supplied observation.` }))).concat(results.map(item => ({ id: item.resultId, kind: 'test', status: 'tested', statement: `Stability result ${item.resultId} remains ${item.proposal.state}.` })))
  })];
  let state = 'NO_POSITIVE_WATCH_ENROLLMENT';
  if (enrollments.length && !predictionEvidence.length) state = 'NO_ELIGIBLE_PRE_OBSERVATION_PREDICTION';
  if (predictionEvidence.length) state = 'PRIVATE_SHADOW_PREDICTIONS_PENDING';
  if (evaluations.length || Array.from(conflictByEnrollment.values()).some(set => set.size)) state = 'PRIVATE_SHADOW_EVIDENCE_HELD';
  if (positiveResults.length) state = 'PRIVATE_SHADOW_STABILITY_REVIEW_PROPOSED';
  return cycleIdentity({
    schema: CYCLE_SCHEMA,
    cycleId: null,
    cycleDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_AUTOMATIC_DISCOVERY_RESUMABLE_PRIVATE_SHADOW_LIFECYCLE_TO_HUMAN_STABILITY_REVIEW_ONLY' },
    source: sourceRefs(source),
    enrollments,
    predictionEvidence,
    newPredictionEvidenceRefs: newEvidence.map(item => ({ evidenceId: item.evidenceId, evidenceDigest: item.evidenceDigest })),
    reusedPredictionEvidenceRefs: reusedEvidence.map(item => ({ evidenceId: item.evidenceId, evidenceDigest: item.evidenceDigest })).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    evaluations,
    holds,
    results,
    foundationSessions,
    summary: {
      watchRunsDiscovered: source.watchRuns.length,
      positiveWatchResults: derived.positiveWatchResults,
      evaluationOnlyEnrollments: enrollments.length,
      outcomeBatchesDiscovered: source.outcomeBatches.length,
      uniquePredictionsDiscovered: predictions.length,
      duplicatePredictionCopiesExcluded: predictionInventory.duplicates,
      uniqueObservationsDiscovered: observations.length,
      duplicateObservationCopiesExcluded: observationInventory.duplicates,
      priorPredictionEvidence: source.priorPredictionEvidence.length,
      predictionEvidenceRegistry: predictionEvidence.length,
      newPredictionEvidence: newEvidence.length,
      reusedPredictionEvidence: reusedEvidence.length,
      evaluatedTargets: evaluations.length,
      pendingTargets: Array.from(pendingByEnrollment.values()).reduce((sum, set) => sum + set.size, 0),
      conflictingTargets: Array.from(conflictByEnrollment.values()).reduce((sum, set) => sum + set.size, 0),
      stabilityReviewProposals: positiveResults.length,
      holds: holds.length,
      foundationSessions: foundationSessions.length,
      targetObservationsReadBeforeFirstSeal: 0,
      evidenceSelections: 0,
      livePredictionReplacements: 0,
      operativeShadowAdmissions: 0,
      methodSelections: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      toolCalls: 0,
      runtimeSelections: 0,
      runtimeAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state,
    authority: lifecycleAuthority(),
    boundary: 'This TEST steward automatically discovers every bounded verified local Watch and Outcome run, preserves a cross-cycle registry of exact pre-observation private challenger predictions, resumes them when observations later appear, and may propose human stability review only. It does not certify external chronology or independence, select evidence or a method, replace live predictions, admit an operative shadow, train, grant permission, use tools, enter runtime, promote, change CANON, or act.'
  });
}
function run(input, options = {}) { return runFromSource(normalizeSource(input), options); }
function verify(cycle, input, runDir) {
  exactKeys(cycle, ['schema', 'cycleId', 'cycleDigest', 'createdAt', 'organ', 'source', 'enrollments', 'predictionEvidence', 'newPredictionEvidenceRefs', 'reusedPredictionEvidenceRefs', 'evaluations', 'holds', 'results', 'foundationSessions', 'summary', 'state', 'authority', 'boundary'], 'private shadow steward cycle');
  if (cycle.schema !== CYCLE_SCHEMA || cycle.organ.id !== ORGAN_ID || cycle.organ.status !== 'TEST' || cycle.organ.learnedWeights !== false || cycle.organ.claimCeiling !== 'TEST_AUTOMATIC_DISCOVERY_RESUMABLE_PRIVATE_SHADOW_LIFECYCLE_TO_HUMAN_STABILITY_REVIEW_ONLY') throw new Error('private shadow steward cycle boundary changed');
  const source = normalizeSource(input);
  const sourceObservations = source.outcomeBatches.flatMap(batch => batch.observations);
  cycle.enrollments.forEach(Shadow.verifyEnrollment);
  cycle.predictionEvidence.forEach(Lifecycle.verifyPredictionEvidence);
  const evidenceById = new Map(cycle.predictionEvidence.map(item => [item.evidenceId, item]));
  const enrollmentById = new Map(cycle.enrollments.map(item => [item.enrollmentId, item]));
  cycle.evaluations.forEach(item => {
    const evidence = Array.from(evidenceById.values()).find(row => row.shadowPrediction.shadowPredictionId === item.prediction.shadowPredictionId);
    if (!evidence) throw new Error('private shadow steward evaluation lacks prediction evidence');
    const observation = sourceObservations.find(row => row.observationId === item.observation.observationId);
    if (!observation) throw new Error('private shadow steward evaluation lacks observation source');
    Shadow.verifyShadowEvaluation(item, { enrollment: evidence.enrollment, shadowPrediction: evidence.shadowPrediction, observationsBeforeSeal: evidence.observationsBeforeSeal, observation });
  });
  cycle.results.forEach(item => {
    const enrollment = enrollmentById.get(item.enrollment.enrollmentId);
    if (!enrollment) throw new Error('private shadow steward result lacks enrollment');
    Shadow.verifyStabilityResult(item, enrollment, cycle.evaluations.filter(row => row.enrollment.enrollmentId === enrollment.enrollmentId));
  });
  if (!cycle.foundationSessions.every(foundationAuthoritySafe)) throw new Error('private shadow steward Foundation session gained authority');
  if (!Lifecycle.same(cycle.authority, lifecycleAuthority())) throw new Error('private shadow steward cycle gained authority');
  const zeros = ['targetObservationsReadBeforeFirstSeal', 'evidenceSelections', 'livePredictionReplacements', 'operativeShadowAdmissions', 'methodSelections', 'trainingAdmissions', 'permissionGrants', 'toolCalls', 'runtimeSelections', 'runtimeAdmissions', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeros.some(key => cycle.summary[key] !== 0)) throw new Error('private shadow steward cycle claim ceiling changed');
  if (!Lifecycle.same(cycle.source, sourceRefs(source))) throw new Error('private shadow steward source refs changed');
  const reconstructed = runFromSource(source, { at: cycle.createdAt });
  if (!Lifecycle.same(reconstructed, cycle)) throw new Error('private shadow steward cycle does not replay from complete source');
  const expectedDigest = Lifecycle.digest(Object.assign({}, cycle, { cycleDigest: null }));
  const expectedId = `outcome-method-private-shadow-steward-${Lifecycle.digest(Object.assign({}, cycle, { cycleId: null, cycleDigest: null })).slice(0, 24)}`;
  if (cycle.cycleDigest !== expectedDigest || cycle.cycleId !== expectedId) throw new Error('private shadow steward cycle identity changed');
  if (runDir) {
    const diskCycle = JSON.parse(fs.readFileSync(path.join(runDir, 'cycle.json'), 'utf8'));
    const diskSource = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
    if (!Lifecycle.same(diskCycle, cycle) || !Lifecycle.same(diskSource, source)) throw new Error('private shadow steward stored files changed');
  }
  return true;
}
function record(input, options = {}) {
  const source = normalizeSource(input);
  const cycle = runFromSource(source, options);
  verify(cycle, source);
  if (options.write === false) return { cycle, written: false, reused: false, runDir: null };
  const root = ensureDirectory(options.stateDir || DEFAULT_STATE_DIR, 'private shadow steward state root');
  const finalDir = path.join(root, cycle.cycleId);
  if (fs.existsSync(finalDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(finalDir, 'cycle.json'), 'utf8'));
    const existingSource = JSON.parse(fs.readFileSync(path.join(finalDir, 'source.json'), 'utf8'));
    verify(existing, existingSource, finalDir);
    if (!Lifecycle.same(existing, cycle)) throw new Error('private shadow steward immutable identity collision');
    return { cycle: existing, written: false, reused: true, runDir: finalDir };
  }
  const stageDir = path.join(root, `.${cycle.cycleId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'cycle.json'), JSON.stringify(cycle, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'source.json'), JSON.stringify(source, null, 2) + '\n', { flag: 'wx' });
  verify(cycle, source, stageDir);
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  return { cycle, written: !commit.reused, reused: commit.reused, runDir: commit.runDir };
}
function inspectDedicatedRoot(rootPath, regex, label, maximum) {
  const root = path.resolve(rootPath);
  if (!fs.existsSync(root)) return { root, entries: [], ignoredStagingEntries: 0 };
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  const entries = [];
  let ignoredStagingEntries = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith('.')) { ignoredStagingEntries += 1; continue; }
    if (!entry.isDirectory() || !regex.test(entry.name)) throw new Error(`${label} contains an unexpected non-staging entry: ${entry.name}`);
    const runDir = path.join(root, entry.name);
    const runStat = fs.lstatSync(runDir);
    if (!runStat.isDirectory() || runStat.isSymbolicLink()) throw new Error(`${label} entry is not a real directory: ${entry.name}`);
    entries.push({ name: entry.name, runDir });
  }
  if (entries.length > maximum) throw new Error(`${label} exceeds its run-count bound`);
  return { root, entries, ignoredStagingEntries };
}
function loadWatchRuns(options = {}) {
  const inspected = inspectDedicatedRoot(options.watchStateDir || DEFAULT_WATCH_STATE_DIR, /^outcome-method-watch-observation-[a-f0-9]{24}$/, 'private shadow steward Watch state root', MAX_WATCH_RUNS);
  const rows = inspected.entries.map(entry => {
    const batch = JSON.parse(fs.readFileSync(path.join(entry.runDir, 'batch.json'), 'utf8'));
    const source = JSON.parse(fs.readFileSync(path.join(entry.runDir, 'source.json'), 'utf8'));
    verifyExactComponent(verifiedWatchRunCache, { batch, source }, () => WatchOrgan.verifyObservation(batch, source, entry.runDir));
    if (batch.batchId !== entry.name) throw new Error('private shadow steward Watch directory identity changed');
    return { batch, source };
  });
  return { rows: validateWatchRuns(rows), ignoredStagingEntries: inspected.ignoredStagingEntries };
}
function loadOutcomeBatches(options = {}) {
  const outcomeStateDir = options.outcomeStateDir || DEFAULT_OUTCOME_STATE_DIR;
  const inspected = inspectDedicatedRoot(outcomeStateDir, /^outcome-learning-[a-f0-9]{24}$/, 'private shadow steward Outcome state root', MAX_OUTCOME_BATCHES);
  const batches = Planner.loadOutcomeBatches({ outcomeStateDir });
  return { batches: validateOutcomeBatches(batches), ignoredStagingEntries: inspected.ignoredStagingEntries };
}
function loadPriorCycles(options = {}) {
  const inspected = inspectDedicatedRoot(options.stateDir || DEFAULT_STATE_DIR, /^outcome-method-private-shadow-steward-[a-f0-9]{24}$/, 'private shadow steward cycle state root', MAX_PRIOR_CYCLES);
  const rows = inspected.entries.map(entry => {
    const cycle = JSON.parse(fs.readFileSync(path.join(entry.runDir, 'cycle.json'), 'utf8'));
    const source = JSON.parse(fs.readFileSync(path.join(entry.runDir, 'source.json'), 'utf8'));
    verify(cycle, source, entry.runDir);
    if (cycle.cycleId !== entry.name) throw new Error('private shadow steward cycle directory identity changed');
    return cycle;
  });
  return { rows: rows.sort((left, right) => left.cycleId.localeCompare(right.cycleId)), ignoredStagingEntries: inspected.ignoredStagingEntries };
}
function loadCurrentSources(options = {}) {
  const watch = loadWatchRuns(options);
  const outcome = loadOutcomeBatches(options);
  const prior = loadPriorCycles(options);
  const priorPredictionEvidence = validatePredictionEvidence(prior.rows.flatMap(item => item.predictionEvidence));
  return normalizeSource({
    trigger: options.trigger || null,
    watchRuns: watch.rows,
    outcomeBatches: outcome.batches,
    priorPredictionEvidence,
    discovery: {
      watchRuns: watch.rows.length,
      outcomeBatches: outcome.batches.length,
      priorPredictionEvidence: priorPredictionEvidence.length,
      ignoredStagingEntries: watch.ignoredStagingEntries + outcome.ignoredStagingEntries + prior.ignoredStagingEntries
    }
  });
}
function runCurrent(options = {}) {
  const source = loadCurrentSources(options);
  return record(source, { at: options.at, write: options.write !== false, stateDir: options.stateDir || DEFAULT_STATE_DIR });
}
module.exports = {
  ROOT,
  ORGAN_ID,
  CYCLE_SCHEMA,
  DEFAULT_STATE_DIR,
  DEFAULT_WATCH_STATE_DIR,
  DEFAULT_OUTCOME_STATE_DIR,
  MAX_WATCH_RUNS,
  MAX_OUTCOME_BATCHES,
  MAX_PRIOR_CYCLES,
  MAX_PREDICTION_EVIDENCE,
  MAX_SOURCE_BYTES,
  lifecycleAuthority,
  normalizeSource,
  sourceRefs,
  run,
  verify,
  record,
  inspectDedicatedRoot,
  loadWatchRuns,
  loadOutcomeBatches,
  loadPriorCycles,
  loadCurrentSources,
  runCurrent
};
