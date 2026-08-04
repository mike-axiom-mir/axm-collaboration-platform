'use strict';

const STATE_SCHEMA = 'axm.heartbeat-mirror-learning.state/v1';
const STATUS_SCHEMA = 'axm.heartbeat-mirror-learning.status/v1';
const MODULE_ID = 'mirror-learning-forge';
const REVIEW_KIND = 'code-improvement-draft';
const WINDOW_MS = 60 * 60 * 1000;
const WINDOW_JITTER_TOLERANCE_MS = 1000;
const MAX_LESSONS_PER_WINDOW = 1;
const RUN_LIMIT = 192;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso(value) { return new Date(value == null ? Date.now() : value).toISOString(); }
function createState() {
  return {
    schema: STATE_SCHEMA,
    version: '0.1.0',
    config: {
      enabled: false,
      cadenceMs: WINDOW_MS,
      maxLessonsPerWindow: MAX_LESSONS_PER_WINDOW,
      updatedAt: null,
      updatedBy: null
    },
    running: false,
    activeBeatId: null,
    lastWindowAt: null,
    lastReason: 'prepared-off-by-default',
    lastActionFeedState: 'UNKNOWN',
    seenReviews: {},
    runs: []
  };
}

function normalize(raw) {
  const state = raw && raw.schema === STATE_SCHEMA ? clone(raw) : createState();
  state.version = '0.1.0';
  state.config = Object.assign({}, createState().config, state.config || {});
  state.config.enabled = state.config.enabled === true;
  state.config.cadenceMs = WINDOW_MS;
  state.config.maxLessonsPerWindow = MAX_LESSONS_PER_WINDOW;
  state.running = state.running === true;
  state.seenReviews = state.seenReviews && typeof state.seenReviews === 'object' && !Array.isArray(state.seenReviews) ? state.seenReviews : {};
  state.runs = Array.isArray(state.runs) ? state.runs.slice(-RUN_LIMIT) : [];
  return state;
}

function approvals(review) {
  return (Array.isArray(review && review.votes) ? review.votes : []).filter(vote =>
    vote && vote.verdict === 'APPROVE' && vote.artifactDigest === review.artifactDigest && String(vote.actor || '').trim()
  ).filter((vote, index, all) => all.findIndex(item => String(item.actor).toLowerCase() === String(vote.actor).toLowerCase()) === index);
}

function eligibleReview(review) {
  return !!(
    review &&
    review.kind === REVIEW_KIND &&
    review.state === 'APPROVED' &&
    review.requiredSeats >= 2 &&
    /^[a-f0-9]{64}$/.test(String(review.artifactDigest || '')) &&
    review.action &&
    review.action.type === 'review-code-draft' &&
    review.action.automaticApply === false &&
    approvals(review).length >= review.requiredSeats
  );
}

function lessonAction(review, stamp) {
  const voters = approvals(review).map(vote => String(vote.actor)).sort();
  const moduleId = String(review.action.moduleId || 'unknown-module').slice(0, 100);
  return {
    schema: 'axm.action/v1',
    id: 'heartbeat-clone-lesson/' + review.id + '/' + review.artifactDigest,
    name: 'Reviewed Code Clone lesson for ' + moduleId,
    tool: 'mirror-code-clone',
    operation: 'dual-reviewed-candidate-lesson',
    requestedPermission: 'private-mirror-lesson-intake-only',
    state: 'COMPLETE',
    actor: { id: 'mirror-code-clone', kind: 'machine', name: 'Mirror Code Clone' },
    approval: {
      decision: 'APPROVED',
      reason: 'Review Inbox recorded ' + voters.length + ' independent approvals for the exact candidate digest. No patch was applied.',
      actor: { id: 'review-inbox-dual-gate', kind: 'system', name: 'Review Inbox dual gate' }
    },
    receipt: {
      ok: true,
      evidence: [
        { id: review.id, kind: 'dual-review', status: review.state, sha256: review.artifactDigest },
        { id: moduleId, kind: 'code-clone-module', status: 'CANDIDATE_ONLY', statement: 'Source unchanged; candidate was reviewed without apply authority.' },
        { id: 'review-seats', kind: 'independent-approval-count', status: String(voters.length), statement: voters.join(', ') }
      ],
      output: null,
      error: '',
      actor: { id: 'heartbeat-mirror-learning-bridge', kind: 'system', name: 'Heartbeat Mirror lesson bridge' },
      at: nowIso(stamp)
    }
  };
}

function create(options) {
  if (!options || !options.bodyPulse || !options.reviewService || typeof options.read !== 'function' || typeof options.write !== 'function' || typeof options.actionFeedStatus !== 'function' || typeof options.ingestLesson !== 'function') {
    throw new Error('Heartbeat Mirror learning bridge adapters required');
  }
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  let runningPromise = null;

  function read() { try { return normalize(options.read()); } catch (_) { return createState(); } }
  function write(state) { const value = normalize(state); options.write(value); return value; }
  function appendRun(state, run) { state.runs.push(run); state.runs = state.runs.slice(-RUN_LIMIT); return state; }
  function eligible(state) {
    return options.reviewService.list().filter(eligibleReview).filter(review => state.seenReviews[review.id] !== review.artifactDigest).sort((a, b) => Date.parse(a.updatedAt || a.createdAt) - Date.parse(b.updatedAt || b.createdAt));
  }
  function held(state, beat, stamp, reason, extra) {
    const run = Object.assign({
      beatId: beat.beatId,
      beatSequence: beat.sequence,
      startedAt: nowIso(stamp),
      completedAt: nowIso(stamp),
      status: 'HELD',
      reason,
      lesson: null
    }, extra || {});
    state.lastWindowAt = nowIso(stamp);
    state.lastReason = reason;
    appendRun(state, run);
    write(state);
    return clone(run);
  }
  function recoverInterruptedRun() {
    const state = read();
    if (!state.running) return write(state);
    appendRun(state, {
      beatId: state.activeBeatId || 'unknown-beat',
      beatSequence: null,
      startedAt: state.lastWindowAt,
      completedAt: nowIso(now()),
      status: 'INTERRUPTED',
      reason: 'server-restarted-before-lesson-intake-completed',
      lesson: null
    });
    state.running = false;
    state.activeBeatId = null;
    state.lastReason = 'interrupted-by-server-restart';
    return write(state);
  }
  function configure(input) {
    if (!input || typeof input.enabled !== 'boolean') throw new Error('Mirror learning lane enabled must be true or false');
    const actorId = String(input.actorId || '').trim().slice(0, 120);
    if (!actorId) throw new Error('Mirror learning lane configuration requires an attributed actor');
    const state = read();
    state.config.enabled = input.enabled;
    state.config.updatedAt = nowIso(now());
    state.config.updatedBy = actorId;
    state.lastReason = input.enabled ? 'enabled-awaiting-independent-gates' : 'prepared-off-by-explicit-choice';
    return status(write(state));
  }
  async function perform(beat) {
    let state = read();
    const stamp = now();
    if (!beat || beat.kind !== 'SCHEDULED') return { started: false, reason: 'manual-beats-do-not-admit-mirror-lessons' };
    if (!state.config.enabled) return { started: false, reason: 'mirror-learning-lane-disabled' };
    if (state.lastWindowAt && stamp - Date.parse(state.lastWindowAt) < WINDOW_MS - WINDOW_JITTER_TOLERANCE_MS) return { started: false, reason: 'one-mirror-lesson-per-hour-cap' };
    const pulseStatus = options.bodyPulse.status();
    const module = pulseStatus.modules.find(item => item.moduleId === MODULE_ID) || null;
    if (!module) return held(state, beat, stamp, 'mirror-learning-pulse-module-missing');
    if (!module.enabled) return held(state, beat, stamp, 'mirror-learning-pulse-module-disabled');
    if (!['ACTIVE', 'CONSERVE'].includes(pulseStatus.mode)) return held(state, beat, stamp, 'body-pulse-' + String(pulseStatus.mode || 'unknown').toLowerCase());
    let feed;
    try { feed = await options.actionFeedStatus(); }
    catch (error) { return held(state, beat, stamp, 'mirror-action-feed-unavailable', { diagnostic: String(error.message || error).slice(0, 300) }); }
    state.lastActionFeedState = String(feed && feed.state || 'UNKNOWN').slice(0, 80);
    if (!feed || feed.enabled !== true || feed.state !== 'OPTED_IN') return held(state, beat, stamp, 'mirror-action-feed-opted-out');
    const reviews = eligible(state).slice(0, MAX_LESSONS_PER_WINDOW);
    if (!reviews.length) {
      const run = { beatId: beat.beatId, beatSequence: beat.sequence, startedAt: nowIso(stamp), completedAt: nowIso(stamp), status: 'EMPTY', reason: 'no-new-dual-reviewed-code-clone-lesson', lesson: null };
      state.lastWindowAt = nowIso(stamp); state.lastReason = run.reason; appendRun(state, run); write(state); return clone(run);
    }
    const review = reviews[0];
    const decision = options.bodyPulse.request({ moduleId: MODULE_ID, force: true, leaseMs: 30000 });
    if (!decision.granted) return held(state, beat, stamp, decision.reason);
    const run = {
      beatId: beat.beatId,
      beatSequence: beat.sequence,
      startedAt: nowIso(stamp),
      completedAt: null,
      status: 'RUNNING',
      reason: 'private-corpus-intake-only',
      lesson: { reviewId: review.id, moduleId: review.action.moduleId, artifactDigest: review.artifactDigest, state: 'SUBMITTING' }
    };
    state.running = true; state.activeBeatId = beat.beatId; state.lastWindowAt = nowIso(stamp); state.lastReason = 'mirror-lesson-intake-running'; write(state);
    try {
      const result = await options.ingestLesson(lessonAction(review, stamp));
      if (!result || result.accepted !== true) throw new Error('Mirror action feed did not accept the reviewed lesson: ' + String(result && result.state || 'unknown'));
      options.bodyPulse.complete({ leaseId: decision.lease.leaseId, outcome: 'COMPLETED', summary: 'One dual-reviewed Code Clone outcome entered the private Mirror lesson corpus.', effect: 'private-mirror-lesson-corpus-only' });
      state = read();
      state.seenReviews[review.id] = review.artifactDigest;
      run.status = 'PASS'; run.reason = 'private-mirror-lesson-admitted'; run.completedAt = nowIso(now());
      run.lesson.state = result.state; run.lesson.episodeId = result.episodeId || null; run.lesson.lessonDigest = result.digest || null;
    } catch (error) {
      try { options.bodyPulse.complete({ leaseId: decision.lease.leaseId, outcome: 'FAILED', summary: 'Mirror lesson intake failed: ' + String(error.message || error).slice(0, 300), effect: 'no-learning-state-claimed' }); } catch (_) {}
      state = read();
      run.status = 'FAILED'; run.reason = 'mirror-lesson-intake-failed'; run.completedAt = nowIso(now()); run.lesson.state = 'FAILED'; run.diagnostic = String(error.message || error).slice(0, 300);
    }
    state.running = false; state.activeBeatId = null; state.lastReason = run.reason; appendRun(state, run); write(state);
    return clone(run);
  }
  function onBeat(beat) {
    if (runningPromise) return runningPromise;
    runningPromise = perform(beat).finally(() => { runningPromise = null; });
    return runningPromise;
  }
  function status(stateInput) {
    const state = stateInput ? normalize(stateInput) : read();
    const pulseStatus = options.bodyPulse.status();
    const module = pulseStatus.modules.find(item => item.moduleId === MODULE_ID) || null;
    const waiting = eligible(state);
    return {
      schema: STATUS_SCHEMA,
      prepared: true,
      enabled: state.config.enabled,
      state: state.running ? 'RUNNING' : state.config.enabled ? 'GATED' : 'DORMANT',
      cadenceMs: WINDOW_MS,
      maxLessonsPerHour: MAX_LESSONS_PER_WINDOW,
      lastWindowAt: state.lastWindowAt,
      lastReason: state.lastReason,
      lastActionFeedState: state.lastActionFeedState,
      pulseModule: { moduleId: MODULE_ID, present: !!module, enabled: !!(module && module.enabled), mode: pulseStatus.mode },
      waitingLessons: waiting.slice(0, 12).map(review => ({ reviewId: review.id, moduleId: review.action.moduleId, artifactDigest: review.artifactDigest, approvals: approvals(review).length })),
      recentRuns: clone(state.runs.slice(-12)),
      learningStage: 'PRIVATE_LESSON_CORPUS_INTAKE_ONLY',
      originalMirrorWriteAuthority: 'NONE',
      codeCloneWriteAuthority: 'NONE',
      sourceWriteAuthority: 'NONE',
      applyAuthority: 'NONE',
      trainingAuthority: 'NONE',
      promotionAuthority: 'NONE',
      canonAuthority: 'NONE',
      packageDefault: 'OFF'
    };
  }

  recoverInterruptedRun();
  return { onBeat, status, configure, MODULE_ID, REVIEW_KIND, WINDOW_MS, MAX_LESSONS_PER_WINDOW };
}

module.exports = { create, createState, normalize, eligibleReview, lessonAction, STATE_SCHEMA, STATUS_SCHEMA, MODULE_ID, REVIEW_KIND, WINDOW_MS, WINDOW_JITTER_TOLERANCE_MS, MAX_LESSONS_PER_WINDOW };
