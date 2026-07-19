'use strict';

const Core = require('./axm-direction-core');
const Review = require('./axm-direction-review');
const crypto = require('crypto');

function create(options) {
  if (!options || typeof options.read !== 'function' || typeof options.write !== 'function') throw new Error('Direction read/write adapters required');
  if (typeof options.modules !== 'function') throw new Error('Direction module catalog adapter required');
  if (!options.bodyPulse || typeof options.bodyPulse.goal !== 'function' || typeof options.bodyPulse.status !== 'function') throw new Error('Direction Body Pulse adapter required');
  if (!options.review || typeof options.review.submit !== 'function' || typeof options.review.get !== 'function') throw new Error('Direction exact-digest review adapter required');

  function read() { try { return Core.normalizeState(options.read()); } catch (error) { return Core.createState(); } }
  function write(state) { const normalized = Core.normalizeState(state); options.write(normalized); return normalized; }
  function compile(input) { return Core.compile(input || {}, options.modules(), options.now && options.now()); }

  function commit(input) {
    const plan = compile(input);
    const assessment = Review.judge(plan);
    const artifact = Review.artifact(plan);
    const artifactDigest = crypto.createHash('sha256').update(JSON.stringify(artifact)).digest('hex');
    const reviewItem = options.review.submit({
      kind: 'workshop-direction',
      title: plan.request.title,
      sourceRef: 'workshop-direction:' + plan.request.requestId,
      artifactDigest,
      summary: assessment.label + ' Score ' + assessment.score + '/100. ' + assessment.reasons.join(' '),
      requiredSeats: plan.request.reviewSeats,
      action: { type: 'review-direction-goal', directionId: plan.request.requestId, requestedIndependentSeats: plan.request.reviewSeats, maximumVotes: 10, oneVotePerIdentity: true, automaticApply: false, automaticExecution: false }
    });
    plan.stewardReview = {
      schema: 'axm.workshop-direction.steward-review/v1',
      assessment,
      artifact: { schema: Review.ARTIFACT_SCHEMA, artifactId: plan.request.requestId, digest: artifactDigest },
      reviewItem: { id: reviewItem.id, state: reviewItem.state, requiredSeats: reviewItem.requiredSeats, votes: reviewItem.votes },
      humanSeat: { state: 'AWAITING_EXPLICIT_VOTE' },
      independentSeats: { requested: plan.request.reviewSeats, recorded: 0, state: 'AWAITING_REVIEWERS' },
      automaticVote: false,
      automaticApply: false
    };
    plan.routes.forEach(route => {
      if (!route.bodyGoal) return;
      const goalId = 'direction:' + plan.request.requestId + ':' + route.routeId;
      try {
        const pulseStatus = options.bodyPulse.goal(Object.assign({}, route.bodyGoal, {
          goalId,
          status: 'OPEN',
          createdBy: plan.request.actor.id,
          statusChangedBy: plan.request.actor.id
        }));
        route.queue = { state: 'QUEUED', goalId, bodyMode: pulseStatus.mode, note: pulseStatus.mode === 'STOPPED' ? 'Queued safely; Body Pulse remains stopped.' : 'Queued; Body Pulse decides when a lease is available.' };
      } catch (error) {
        route.queue = { state: 'HELD_QUEUE_ERROR', goalId, bodyMode: null, note: error.message };
      }
    });
    const state = write(Core.storePlan(read(), plan, options.now && options.now()));
    return { ok: true, plan: Core.publicState(state).directions.find(direction => direction.request.requestId === plan.request.requestId), status: publicStatus(state) };
  }

  function publicStatus(state) {
    const result = Core.publicState(state || read());
    result.directions.forEach(direction => {
      const stewardReview = direction.stewardReview;
      if (!stewardReview || !stewardReview.reviewItem) return;
      const item = options.review.get(stewardReview.reviewItem.id);
      if (!item) return;
      stewardReview.reviewItem = { id: item.id, state: item.state, requiredSeats: item.requiredSeats, votes: item.votes };
      const humanVote = item.votes.find(vote => String(vote.actorKind).toLowerCase() === 'human');
      stewardReview.humanSeat = humanVote ? { state: 'VOTED', actor: humanVote.actor, verdict: humanVote.verdict, at: humanVote.at } : { state: 'AWAITING_EXPLICIT_VOTE' };
      stewardReview.independentSeats = { requested: item.requiredSeats, recorded: item.votes.length, state: item.votes.length >= item.requiredSeats ? 'COMPLETE' : 'AWAITING_REVIEWERS' };
    });
    const pulse = options.bodyPulse.status();
    result.bodyPulse = { mode: pulse.mode, pressure: pulse.body.pressure, activeLeases: pulse.leases.length };
    result.counts = {
      open: result.directions.filter(direction => direction.status === 'OPEN').length,
      paused: result.directions.filter(direction => direction.status === 'PAUSED').length,
      archived: result.directions.filter(direction => ['DONE','CANCELLED'].includes(direction.status)).length,
      handRequests: result.directions.reduce((sum, direction) => sum + direction.handRequests.filter(hand => hand.status === 'OPEN').length, 0)
    };
    return result;
  }

  function setStatus(input) {
    input = input || {};
    const directionId = String(input.directionId || '');
    let state = read();
    const existing = state.directions[directionId];
    if (!existing) throw new Error('direction not found');
    existing.routes.forEach(route => {
      if (!route.queue || !route.queue.goalId) return;
      const pulse = options.bodyPulse.status();
      const goal = pulse.goals.find(item => item.goalId === route.queue.goalId);
      if (!goal) return;
      if (['DONE','CANCELLED'].includes(goal.status) && input.status === 'OPEN') return;
      options.bodyPulse.goal(Object.assign({}, goal, { status: input.status, statusChangedBy: input.actorId || 'unknown' }));
    });
    state = write(Core.setDirectionStatus(state, directionId, input.status, input.actorId || 'unknown', options.now && options.now()));
    return publicStatus(state);
  }

  write(read());
  return { VERSION: Core.VERSION, compile, commit, status: () => publicStatus(read()), setStatus };
}

module.exports = { create };
