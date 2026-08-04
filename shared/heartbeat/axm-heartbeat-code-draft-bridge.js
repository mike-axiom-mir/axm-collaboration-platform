'use strict';

const path = require('path');
const Clone = require('../../tools/mirror-code-clone/mirror-code-clone-kernel');

const STATE_SCHEMA = 'axm.heartbeat-code-draft.state/v1';
const MODULE_ID = 'mirror-code-clone-drafter';
const REVIEW_KIND = 'code-improvement-draft';
const MAX_DRAFTS_PER_WINDOW = 1;
const WINDOW_MS = 3600000;
const WINDOW_JITTER_TOLERANCE_MS = 1000;
const QUEUE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const RUN_LIMIT = 192;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso(now) { return new Date(now == null ? Date.now() : now).toISOString(); }
function safe(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'draft'; }
function pressureSample(body, phase, itemId) {
  if (!body || !body.sampledAt) return null;
  return {
    sampledAt: body.sampledAt,
    phase: String(phase || 'lease-request'),
    itemId: itemId || null,
    cpuUsedRatio: Number.isFinite(body.cpuUsedRatio) ? body.cpuUsedRatio : null,
    memoryUsedRatio: Number.isFinite(body.memoryUsedRatio) ? body.memoryUsedRatio : null,
    gpuUsedRatio: Number.isFinite(body.gpuUsedRatio) ? body.gpuUsedRatio : null,
    thermalC: Number.isFinite(body.thermalC) ? body.thermalC : null,
    pressure: String(body.pressure || 'UNKNOWN')
  };
}
function createState() {
  return { schema: STATE_SCHEMA, version: '0.1.0', lastWindowAt: null, running: false, activeBeatId: null, lastReason: 'awaiting-scheduled-heartbeat', seen: {}, runs: [] };
}
function normalize(raw) {
  const state = raw && raw.schema === STATE_SCHEMA ? clone(raw) : createState();
  state.version = '0.1.0';
  state.running = state.running === true;
  state.seen = state.seen && typeof state.seen === 'object' && !Array.isArray(state.seen) ? state.seen : {};
  state.runs = Array.isArray(state.runs) ? state.runs.slice(-RUN_LIMIT) : [];
  return state;
}
function summarizeRuns(runs, queue) {
  const retainedRuns = Array.isArray(runs) ? runs : [];
  const drafts = retainedRuns.reduce((all, run) => all.concat(Array.isArray(run.drafts) ? run.drafts : []), []);
  const pressureSamples = retainedRuns.reduce((all, run) => all.concat(Array.isArray(run.pressureSamples) ? run.pressureSamples : []), []);
  const durations = retainedRuns.map(run => Date.parse(run.completedAt) - Date.parse(run.startedAt)).filter(value => Number.isFinite(value) && value >= 0);
  const cpu = pressureSamples.map(sample => sample.cpuUsedRatio).filter(Number.isFinite);
  const memory = pressureSamples.map(sample => sample.memoryUsedRatio).filter(Number.isFinite);
  const gpu = pressureSamples.map(sample => sample.gpuUsedRatio).filter(Number.isFinite);
  const latest = retainedRuns.length ? retainedRuns[retainedRuns.length - 1] : null;
  return {
    durationKind: 'WALL_CLOCK_PROCESS_WINDOW',
    retainedWindowCount: retainedRuns.length,
    passWindowCount: retainedRuns.filter(run => run.status === 'PASS').length,
    emptyWindowCount: retainedRuns.filter(run => run.status === 'EMPTY').length,
    attentionWindowCount: retainedRuns.filter(run => run.status === 'ATTENTION').length,
    candidateExecutionCount: drafts.length,
    draftedCandidateCount: drafts.filter(draft => draft.status === 'DRAFTED').length,
    heldCandidateCount: drafts.filter(draft => draft.status === 'HELD').length,
    failedCandidateCount: drafts.filter(draft => draft.status === 'FAILED').length,
    uniqueModuleCount: new Set(drafts.map(draft => draft.moduleId).filter(Boolean)).size,
    pendingReviewCount: Array.isArray(queue) ? queue.filter(item => item.state === 'PENDING').length : 0,
    pressureSampleCount: pressureSamples.length,
    peakCpuUsedRatio: cpu.length ? Math.max.apply(null, cpu) : null,
    averageCpuUsedRatio: cpu.length ? cpu.reduce((total, value) => total + value, 0) / cpu.length : null,
    peakMemoryUsedRatio: memory.length ? Math.max.apply(null, memory) : null,
    peakGpuUsedRatio: gpu.length ? Math.max.apply(null, gpu) : null,
    lastDurationMs: durations.length ? durations[durations.length - 1] : null,
    averageDurationMs: durations.length ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length) : null,
    maxDurationMs: durations.length ? Math.max.apply(null, durations) : null,
    latestBeatSequence: latest ? latest.beatSequence : null,
    latestDraftCount: latest && Array.isArray(latest.drafts) ? latest.drafts.length : 0,
    lastCompletedAt: latest ? latest.completedAt : null
  };
}

function reviewExplanation(plan, receipt) {
  const evidence = receipt && receipt.evidence || {};
  const verifier = evidence.verifier || {};
  const moduleId = String(plan && plan.moduleId || evidence.moduleId || 'this tool');
  const repairClass = String(plan && plan.repairClass || evidence.repairClass || 'unknown-repair');
  const sourceUnchanged = !!(receipt && receipt.source && receipt.source.unchanged === true);
  const limitedProof = verifier.pass === true
    ? 'The candidate copy passed the limited verifier for this one change. The real Workshop source stayed unchanged.'
    : 'The limited verifier evidence is incomplete. Do not approve this draft until a technical steward checks it.';
  if (repairClass === Clone.COMPLETENESS_REPAIR_CLASS) {
    return {
      schema: 'axm.code-draft-plain-explanation/v1',
      repairClass,
      change: 'Add an empty permissions list to ' + moduleId + "'s manifest. No executable code is changed.",
      benefit: 'This replaces a missing field with an explicit claim that the tool requests no special permissions.',
      risk: 'The format fix is small, but an empty list would be misleading if the tool actually needs a permission. This check does not prove the whole tool is ready.',
      proof: limitedProof,
      recommendation: 'TECHNICAL CHECK REQUIRED FIRST. A machine steward must verify that this tool truly needs no permissions before Mike is asked to keep or reject the fix.',
      verifierScope: String(verifier.scope || 'manifest-permissions-field-only'),
      sourceUnchanged,
      wholeModuleReady: false,
      automaticApply: false
    };
  }
  if (repairClass === Clone.REPAIR_CLASS) {
    const permissions = Array.isArray(evidence.addedPermissions) ? evidence.addedPermissions.map(String) : [];
    return {
      schema: 'axm.code-draft-plain-explanation/v1',
      repairClass,
      change: 'Declare ' + (permissions.length ? permissions.join(', ') : 'the contract permissions') + ' in ' + moduleId + "'s manifest. No executable code is changed.",
      benefit: 'The manifest would stop hiding permissions that the tool contract already says it uses.',
      risk: 'Permission declarations affect trust and must match the real code. A formatting check alone cannot make that judgment for Mike.',
      proof: limitedProof,
      recommendation: 'TECHNICAL CHECK REQUIRED FIRST. A machine steward must compare the contract, manifest and real behavior before Mike is asked to decide.',
      verifierScope: String(verifier.scope || 'module-contract-verifier'),
      sourceUnchanged,
      wholeModuleReady: false,
      automaticApply: false
    };
  }
  return {
    schema: 'axm.code-draft-plain-explanation/v1',
    repairClass,
    change: 'The draft proposes a technical change that AXM cannot yet explain safely in normal language.',
    benefit: 'Unknown until a technical steward inspects the exact candidate.',
    risk: 'Unknown. An unexplained technical draft must not receive an informed human approval.',
    proof: sourceUnchanged ? 'The Workshop source stayed unchanged, but that alone does not prove the proposal is correct.' : 'Proof is incomplete.',
    recommendation: 'DO NOT VOTE. Ask a technical steward to inspect and explain this exact candidate first.',
    verifierScope: String(verifier.scope || 'unknown'),
    sourceUnchanged,
    wholeModuleReady: false,
    automaticApply: false
  };
}

function create(options) {
  if (!options || !options.root || !options.bodyPulse || !options.reviewService || typeof options.read !== 'function' || typeof options.write !== 'function') {
    throw new Error('Heartbeat code-draft bridge adapters required');
  }
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const discover = typeof options.discover === 'function' ? options.discover : Clone.discoverWorkshopDraftPlans;
  const stage = typeof options.stage === 'function' ? options.stage : Clone.stageWorkshopDraft;
  const candidateBaseRoot = path.resolve(options.candidateBaseRoot || path.join(options.root, 'exports', 'mirror-code-clone', 'candidates'));
  let runningPromise = null;

  function read() { try { return normalize(options.read()); } catch (error) { return createState(); } }
  function write(state) { const value = normalize(state); options.write(value); return value; }
  function ensureModule() {
    const status = options.bodyPulse.status();
    if (!status.modules.some(module => module.moduleId === MODULE_ID)) {
      return options.bodyPulse.register({
        moduleId: MODULE_ID,
        name: 'Code Draft Queue',
        goalQueueId: 'mirror-code-clone-draft-goals',
        enabled: false,
        allowMaintenance: false,
        priority: 84,
        activeCadenceMs: 10000,
        idleCadenceMs: 3600000,
        cost: { cpu: 1, memory: 1, gpu: 0 },
        authority: 'candidate-drafts-and-review-submission-only',
        promotionGate: 'dual-exact-digest-review'
      });
    }
    return status;
  }
  function activeReviews() {
    return options.reviewService.list().filter(item => item.kind === REVIEW_KIND && !['SUPERSEDED', 'REJECTED', 'REPAIR', 'CANCELLED', 'EXPIRED'].includes(item.state));
  }
  function expireQueue(stamp) {
    return options.reviewService.expireBefore(REVIEW_KIND, nowIso(stamp), 'heartbeat-seven-day-retention');
  }
  function recoverInterruptedRun() {
    const state = read();
    if (!state.running) return write(state);
    const recoveredAt = nowIso(now());
    state.runs.push({
      beatId: state.activeBeatId || 'unknown-beat',
      beatSequence: null,
      startedAt: state.lastWindowAt,
      completedAt: recoveredAt,
      status: 'INTERRUPTED',
      reason: 'server-restarted-before-draft-window-completed',
      drafts: []
    });
    state.runs = state.runs.slice(-RUN_LIMIT);
    state.running = false;
    state.activeBeatId = null;
    state.lastReason = 'interrupted-by-server-restart';
    return write(state);
  }
  async function perform(beat) {
    let state = read();
    const stamp = now();
    if (!beat || beat.kind !== 'SCHEDULED') return { started: false, reason: 'manual-beats-do-not-create-code-drafts' };
    if (state.lastWindowAt && stamp - Date.parse(state.lastWindowAt) < WINDOW_MS - WINDOW_JITTER_TOLERANCE_MS) return { started: false, reason: 'one-draft-per-hour-cap' };
    const expiredReviewIds = expireQueue(stamp);
    const pulseStatus = ensureModule();
    const pulseModule = pulseStatus.modules.find(module => module.moduleId === MODULE_ID) || null;
    if (!pulseModule || !pulseModule.enabled) return { started: false, reason: 'code-draft-pulse-module-disabled' };
    if (pulseStatus.mode !== 'ACTIVE' && pulseStatus.mode !== 'CONSERVE') {
      state.lastWindowAt = nowIso(stamp);
      state.lastReason = 'body-pulse-' + String(pulseStatus.mode || 'unknown').toLowerCase();
      state.runs.push({ beatId: beat.beatId, beatSequence: beat.sequence, startedAt: nowIso(stamp), completedAt: nowIso(stamp), status: 'HELD', reason: state.lastReason, expiredReviewIds, drafts: [] });
      write(state);
      return { started: false, reason: state.lastReason };
    }
    const plans = discover(options.root, { excludeFingerprints: Object.keys(state.seen) }).slice(0, MAX_DRAFTS_PER_WINDOW);
    if (!plans.length) {
      const empty = { beatId: beat.beatId, beatSequence: beat.sequence, startedAt: nowIso(stamp), completedAt: nowIso(stamp), status: 'EMPTY', reason: 'no-new-allowlisted-improvements', expiredReviewIds, drafts: [] };
      state.lastWindowAt = nowIso(stamp); state.lastReason = empty.reason; state.runs.push(empty); write(state); return clone(empty);
    }
    const goalId = 'heartbeat-code-drafts-' + beat.sequence;
    options.bodyPulse.goal({ goalId, moduleId: MODULE_ID, title: 'Code Clone draft window #' + beat.sequence, priority: 84, maxPulses: MAX_DRAFTS_PER_WINDOW, createdBy: 'mike-authorized-heartbeat-code-drafts', requiresReview: true });
    const run = { beatId: beat.beatId, beatSequence: beat.sequence, goalId, startedAt: nowIso(stamp), completedAt: null, status: 'RUNNING', reason: 'candidate-drafts-only', expiredReviewIds, drafts: [], pressureSamples: [] };
    state.running = true; state.activeBeatId = beat.beatId; state.lastWindowAt = nowIso(stamp); state.lastReason = 'code-drafts-running'; write(state);
    for (let index = 0; index < plans.length; index += 1) {
      const plan = plans[index];
      const decision = options.bodyPulse.request({ moduleId: MODULE_ID, force: true, leaseMs: 120000 });
      const sample = pressureSample(decision.body, 'lease-request', plan.moduleId);
      if (sample) run.pressureSamples.push(sample);
      if (!decision.granted) { run.drafts.push({ moduleId: plan.moduleId, fingerprint: plan.fingerprint, status: 'HELD', reason: decision.reason }); break; }
      try {
        const candidateRoot = path.join(candidateBaseRoot, safe(beat.beatId) + '-' + String(index + 1).padStart(2, '0') + '-' + safe(plan.moduleId) + '-' + plan.fingerprint.slice(0, 8));
        const drafted = stage(options.root, candidateRoot, plan);
        if (!drafted.receipt.changed || drafted.receipt.status !== 'IMPROVED_CANDIDATE') throw new Error('candidate did not pass its bounded improvement verifier');
        const review = options.reviewService.submit({
          kind: REVIEW_KIND,
          title: 'Code draft · ' + plan.moduleId,
          sourceRef: 'mirror-code-clone:' + plan.moduleId + ':' + plan.repairClass,
          artifactDigest: drafted.receipt.artifactDigest,
          summary: 'Heartbeat drafted ' + plan.repairClass + ' for ' + plan.moduleId + '. Candidate only; source unchanged; exact-digest review required.',
          requiredSeats: 2,
          expiresAt: nowIso(stamp + QUEUE_RETENTION_MS),
          action: { type: 'review-code-draft', moduleId: plan.moduleId, candidateRoot: drafted.candidateRoot, receiptPath: drafted.receiptPath, reviewExplanation: reviewExplanation(plan, drafted.receipt), automaticApply: false }
        });
        const item = { moduleId: plan.moduleId, repairClass: plan.repairClass, fingerprint: plan.fingerprint, status: 'DRAFTED', artifactDigest: drafted.receipt.artifactDigest, candidateRoot: drafted.candidateRoot, receiptPath: drafted.receiptPath, reviewId: review.id, reviewState: review.state, expiresAt: review.expiresAt };
        run.drafts.push(item);
        state = read(); state.seen[plan.fingerprint] = { moduleId: plan.moduleId, repairClass: plan.repairClass, draftedAt: nowIso(stamp), artifactDigest: drafted.receipt.artifactDigest, reviewId: review.id }; write(state);
        options.bodyPulse.complete({ leaseId: decision.lease.leaseId, outcome: 'COMPLETED', summary: 'Candidate draft queued for ' + plan.moduleId, effect: 'candidate-draft-and-review-item-only' });
      } catch (error) {
        run.drafts.push({ moduleId: plan.moduleId, repairClass: plan.repairClass, fingerprint: plan.fingerprint, status: 'FAILED', reason: error.message });
        options.bodyPulse.complete({ leaseId: decision.lease.leaseId, outcome: 'FAILED', summary: 'Code draft failed for ' + plan.moduleId, effect: 'no-source-change' });
      }
    }
    const finalSample = pressureSample(options.bodyPulse.status().body, 'window-complete', null);
    if (finalSample) run.pressureSamples.push(finalSample);
    options.bodyPulse.goal({ goalId, moduleId: MODULE_ID, title: 'Code Clone draft window #' + beat.sequence, status: 'DONE', statusChangedBy: 'heartbeat-code-draft-bridge' });
    run.completedAt = nowIso(now());
    run.status = run.drafts.length === plans.length && run.drafts.every(item => item.status === 'DRAFTED') ? 'PASS' : run.drafts.some(item => item.status === 'FAILED') ? 'ATTENTION' : 'HELD';
    state = read(); state.running = false; state.activeBeatId = null; state.lastReason = run.status.toLowerCase(); state.runs.push(run); state.runs = state.runs.slice(-RUN_LIMIT); write(state);
    return clone(run);
  }
  function onBeat(beat) {
    if (runningPromise) return runningPromise;
    runningPromise = perform(beat).finally(() => { runningPromise = null; });
    return runningPromise;
  }
  function status() {
    const state = read();
    const pulseStatus = options.bodyPulse.status();
    const pulseModule = pulseStatus.modules.find(module => module.moduleId === MODULE_ID) || null;
    const queue = activeReviews();
    let nextDrafts = [];
    try { nextDrafts = discover(options.root, { excludeFingerprints: Object.keys(state.seen) }).slice(0, MAX_DRAFTS_PER_WINDOW).map(plan => ({ moduleId: plan.moduleId, repairClass: plan.repairClass, fingerprint: plan.fingerprint })); } catch (error) {}
    return {
      schema: 'axm.heartbeat-code-draft.status/v1', moduleId: MODULE_ID, enabled: !!(pulseModule && pulseModule.enabled), state: state.running ? 'RUNNING' : pulseModule && pulseModule.enabled ? 'IDLE' : 'DORMANT', lastReason: state.lastReason, lastWindowAt: state.lastWindowAt,
      maxDraftsPerHour: MAX_DRAFTS_PER_WINDOW, queueRetentionDays: 7, sourceWriteAuthority: 'NONE', applyAuthority: 'NONE', promotionAuthority: 'NONE',
      pulseMode: pulseStatus.mode, armed: !!(pulseModule && pulseModule.enabled) && (pulseStatus.mode === 'ACTIVE' || pulseStatus.mode === 'CONSERVE'), nextDrafts: pulseModule && pulseModule.enabled ? nextDrafts : [], queue: clone(queue), evidenceSummary: summarizeRuns(state.runs, queue), recentRuns: clone(state.runs.slice(-12))
    };
  }
  ensureModule(); recoverInterruptedRun();
  return { onBeat, status, MODULE_ID, MAX_DRAFTS_PER_WINDOW, QUEUE_RETENTION_MS };
}

module.exports = { create, STATE_SCHEMA, MODULE_ID, REVIEW_KIND, MAX_DRAFTS_PER_WINDOW, WINDOW_MS, WINDOW_JITTER_TOLERANCE_MS, QUEUE_RETENTION_MS, summarizeRuns, reviewExplanation };
