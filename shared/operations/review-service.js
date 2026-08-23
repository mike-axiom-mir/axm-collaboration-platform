'use strict';

const path = require('path');
const U = require('./operations-utils');
const ReviewOperationLease = require('./review-operation-lease');

const SCHEMA = 'axm.review-inbox/v1';

function create(options) {
  const stateFile = path.join(options.stateRoot, 'review-inbox', 'reviews.json');
  const auditFile = path.join(options.stateRoot, 'review-inbox', 'audit.jsonl');
  const operationLease = ReviewOperationLease.create({
    stateRoot:options.stateRoot,
    timeoutMs:options.reviewOperationLeaseTimeoutMs,
    retryMs:options.reviewOperationLeaseRetryMs
  });
  function withExclusive(callback) { return operationLease.withExclusive(callback); }
  function operationLeaseStatus() { return operationLease.inspect(); }
  function read() { return U.loadJson(stateFile, { schema: SCHEMA, version: 1, items: [] }); }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }
  function normalizeSeats(value) { return value === 'dual' ? 2 : Math.max(1, Math.min(10, Math.round(Number(value) || 1))); }

  function submitCore(input, reservedId) {
    const body = input || {}, digest = String(body.artifactDigest || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('artifactDigest must be a SHA-256 digest');
    const state = read(), sourceRef = String(body.sourceRef || '').slice(0, 300), kind = String(body.kind || 'proposal').slice(0, 80);
    const existing = state.items.find(item => item.kind === kind && item.sourceRef === sourceRef && item.artifactDigest === digest && !['REJECTED','SUPERSEDED','EXPIRED'].includes(item.state));
    if (existing) {
      if (reservedId && existing.id !== reservedId) throw new Error('reserved review projection id conflicts with an existing exact candidate');
      if (existing.state === 'REPAIR') throw new Error('repair needs a changed plan digest before review can reopen');
      return existing;
    }
    for (const item of state.items) {
      if (item.kind === kind && item.sourceRef === sourceRef && item.artifactDigest !== digest && !['REJECTED','SUPERSEDED'].includes(item.state)) {
        item.state = 'SUPERSEDED'; item.supersededAt = U.now(); item.supersededByDigest = digest;
      }
    }
    const item = {
      schema: 'axm.review-item/v1', id: reservedId || U.uid('review'), kind, title: String(body.title || 'Untitled proposal').slice(0, 180),
      sourceRef, artifactDigest: digest, summary: String(body.summary || '').slice(0, 2000), requiredSeats: normalizeSeats(body.requiredSeats),
      action: body.action && typeof body.action === 'object' ? U.clone(body.action) : null, state: 'PENDING', votes: [], discussion: [],
      createdAt: U.now(), updatedAt: U.now(), expiresAt: body.expiresAt && Number.isFinite(Date.parse(body.expiresAt)) ? new Date(body.expiresAt).toISOString() : null
    };
    state.items.unshift(item); write(state); audit({ type: 'submitted', id: item.id, digest, kind, sourceRef });
    return item;
  }
  function submit(input) { return submitCore(input, null); }
  function submitReserved(input, reservedId) {
    const id = String(reservedId || '').trim().toLowerCase();
    if (!/^review-auth-[a-f0-9]{64}$/.test(id)) throw new Error('reserved authenticated review id is invalid');
    const state = read(), collision = state.items.find(item => item.id === id);
    if (collision) {
      const body = input || {}, digest = String(body.artifactDigest || '').toLowerCase();
      const sourceRef = String(body.sourceRef || '').slice(0, 300), kind = String(body.kind || 'proposal').slice(0, 80);
      if (collision.kind !== kind || collision.sourceRef !== sourceRef || collision.artifactDigest !== digest) throw new Error('reserved authenticated review id collision');
    }
    return submitCore(input, id);
  }

  function vote(id, input) {
    const state = read(), item = state.items.find(entry => entry.id === id);
    if (!item) throw new Error('review item not found');
    if (['SUPERSEDED','REJECTED','REPAIR','CANCELLED','EXPIRED'].includes(item.state)) throw new Error('review item is closed');
    const digest = String(input && input.artifactDigest || '').toLowerCase();
    if (digest !== item.artifactDigest) throw new Error('vote digest does not match the reviewed artifact');
    const actor = String(input && input.actor || '').trim().slice(0, 120);
    if (!actor) throw new Error('review actor is required');
    const actorKind = String(input && input.actorKind || 'unknown').trim().toLowerCase().slice(0, 40);
    if (item.kind === 'code-improvement-draft' && actorKind === 'machine') {
      throw new Error('code-draft machine reviews must come from the deterministic technical reviewer');
    }
    if (item.kind === 'code-improvement-draft' && actorKind !== 'machine') {
      const technicalReview = item.votes.find(entry => entry.actorKind === 'machine' && entry.artifactDigest === item.artifactDigest && String(entry.note || '').trim().length >= 20);
      if (!technicalReview) throw new Error('technical code draft needs a reasoned machine review before a human vote');
      if (technicalReview.verdict === 'HOLD') throw new Error('human vote refused: machine HOLD must be repaired or replaced before a human vote is useful');
      if (input && input.informedExplanation !== true) throw new Error('plain-language explanation acknowledgement is required before a human code-draft vote');
    }
    const verdict = String(input && input.verdict || '').toUpperCase();
    if (!['APPROVE','HOLD','REJECT'].includes(verdict)) throw new Error('verdict must be APPROVE, HOLD or REJECT');
    item.votes = item.votes.filter(entry => entry.actor.toLowerCase() !== actor.toLowerCase());
    item.votes.push({ actor, actorKind, verdict, note: String(input.note || '').slice(0, 1000), artifactDigest: digest, informedExplanation: item.kind === 'code-improvement-draft' && actorKind !== 'machine' ? true : undefined, at: U.now() });
    if (verdict === 'REJECT') item.state = 'REJECTED';
    else {
      const approvals = new Set(item.votes.filter(entry => entry.verdict === 'APPROVE').map(entry => entry.actor.toLowerCase()));
      item.state = approvals.size >= item.requiredSeats ? 'APPROVED' : item.votes.some(entry => entry.verdict === 'HOLD') ? 'HOLD' : 'PENDING';
    }
    item.updatedAt = U.now(); write(state); audit({ type: 'vote', id, actor, verdict, state: item.state, digest });
    return item;
  }

  function recordTechnicalReview(id, assessment) {
    const state = read(), item = state.items.find(entry => entry.id === id);
    if (!item) throw new Error('review item not found');
    if (item.kind !== 'code-improvement-draft') throw new Error('deterministic technical reviews are only available for code-improvement drafts');
    if (['SUPERSEDED','REJECTED','REPAIR','CANCELLED','EXPIRED'].includes(item.state)) throw new Error('review item is closed');
    const checked = assessment && typeof assessment === 'object' ? U.clone(assessment) : null;
    if (!checked || checked.schema !== 'axm.code-draft-technical-review/v1') throw new Error('technical review assessment schema is required');
    const digest = String(checked.artifactDigest || '').toLowerCase();
    if (digest !== item.artifactDigest) throw new Error('technical review digest does not match the reviewed artifact');
    const verdict = String(checked.verdict || '').toUpperCase();
    if (!['APPROVE','HOLD'].includes(verdict)) throw new Error('technical review verdict must be APPROVE or HOLD');
    if (!Array.isArray(checked.checks) || !checked.checks.length || checked.checks.some(entry => !entry || !entry.id || !['PASS','HOLD'].includes(entry.status))) {
      throw new Error('technical review requires structured PASS or HOLD checks');
    }
    const note = String(checked.summary || '').trim().slice(0, 1000);
    if (note.length < 20) throw new Error('technical review requires a reasoned normal-language summary');
    const actor = 'AXM Deterministic Technical Steward';
    item.votes = item.votes.filter(entry => String(entry.actor || '').toLowerCase() !== actor.toLowerCase());
    item.votes.push({ actor, actorKind:'machine', verdict, note, artifactDigest:digest, technicalReview:checked, at:U.now() });
    if (verdict === 'APPROVE') {
      const approvals = new Set(item.votes.filter(entry => entry.verdict === 'APPROVE').map(entry => String(entry.actor || '').toLowerCase()));
      item.state = approvals.size >= item.requiredSeats ? 'APPROVED' : 'PENDING';
    } else item.state = 'HOLD';
    item.updatedAt = U.now(); write(state); audit({ type:'deterministic-technical-review', id, actor, verdict, state:item.state, digest, assessmentSchema:checked.schema });
    return item;
  }

  function recordTechnicalRefusal(id, refusal) {
    const state = read(), item = state.items.find(entry => entry.id === id);
    if (!item) throw new Error('review item not found');
    if (item.kind !== 'code-improvement-draft') throw new Error('deterministic technical refusals are only available for code-improvement drafts');
    if (!['PENDING','HOLD'].includes(item.state)) throw new Error('only an open code draft can be retired by technical evidence');
    const checked = refusal && typeof refusal === 'object' ? U.clone(refusal) : null;
    if (!checked || checked.schema !== 'axm.code-draft-technical-refusal/v1') throw new Error('technical refusal schema is required');
    const digest = String(checked.artifactDigest || '').toLowerCase();
    if (digest !== item.artifactDigest) throw new Error('technical refusal digest does not match the reviewed artifact');
    const reasonCode = String(checked.reasonCode || '').toUpperCase();
    if (!['SOURCE_DRIFT','CANDIDATE_DRIFT','EVIDENCE_INVALID'].includes(reasonCode)) throw new Error('technical refusal reason is not deterministic or permanent');
    const summary = String(checked.summary || '').trim().slice(0, 1000);
    if (summary.length < 20) throw new Error('technical refusal requires a normal-language reason');
    if (checked.replacementRequired !== true || checked.automaticApply !== false || checked.applyAuthority !== 'NONE') {
      throw new Error('technical refusal must require replacement and carry no apply authority');
    }
    const actor = 'AXM Deterministic Technical Steward', at = U.now();
    item.technicalRefusal = checked;
    item.state = 'SUPERSEDED';
    item.supersededAt = at;
    item.supersededReason = reasonCode;
    item.discussion = Array.isArray(item.discussion) ? item.discussion : [];
    item.discussion.push({ id:U.uid('discussion'), actor, actorKind:'machine', body:summary, decision:'SUPERSEDED', at });
    item.discussion = item.discussion.slice(-200);
    item.updatedAt = at;
    write(state);
    audit({ type:'deterministic-technical-refusal', id, actor, reasonCode, state:item.state, digest, refusalSchema:checked.schema });
    return item;
  }

  function list(filter) {
    const state = read(); let items = state.items;
    if (filter && filter.state) items = items.filter(item => item.state === String(filter.state).toUpperCase());
    return U.clone(items);
  }
  function discuss(id, input) {
    const state = read(), item = state.items.find(entry => entry.id === id);
    if (!item) throw new Error('review item not found');
    if (item.state === 'SUPERSEDED') throw new Error('superseded review discussion is closed');
    const actor = String(input && input.actor || '').trim().slice(0, 120), body = String(input && input.body || '').trim().slice(0, 2000);
    if (!actor || !body) throw new Error('discussion actor and message are required');
    item.discussion = Array.isArray(item.discussion) ? item.discussion : [];
    const message = { id: U.uid('discussion'), actor, actorKind:String(input.actorKind || 'unknown').slice(0,40), body, at:U.now() };
    item.discussion.push(message); item.discussion = item.discussion.slice(-200); item.updatedAt = U.now(); write(state); audit({ type:'discussion', id, actor, state:item.state }); return item;
  }
  function route(id, input) {
    const state = read(), item = state.items.find(entry => entry.id === id);
    if (!item) throw new Error('review item not found');
    if (!['PENDING','HOLD','REJECTED','REPAIR'].includes(item.state)) throw new Error('only an open, held, rejected, or repair review can enter the decision pool');
    const outcome = String(input && input.outcome || '').toUpperCase(), actor = String(input && input.actor || '').trim().slice(0,120), reason = String(input && input.reason || '').trim().slice(0,2000);
    if (!['REPAIR','CANCELLED'].includes(outcome)) throw new Error('decision-pool outcome must be REPAIR or CANCELLED');
    if (!actor || !reason) throw new Error('decision-pool actor and reason are required');
    item.state = outcome; item.discussion = Array.isArray(item.discussion) ? item.discussion : []; item.discussion.push({ id:U.uid('discussion'), actor, actorKind:String(input.actorKind || 'unknown').slice(0,40), body:reason, decision:outcome, at:U.now() }); item.discussion = item.discussion.slice(-200); item.updatedAt = U.now(); write(state); audit({ type:'decision-pool-route', id, actor, outcome, digest:item.artifactDigest }); return item;
  }
  function get(id) { return list().find(item => item.id === id) || null; }
  function expireBefore(kind, before, actor) {
    const cutoff = Date.parse(before);
    if (!Number.isFinite(cutoff)) throw new Error('review expiry cutoff must be an ISO timestamp');
    const state = read(), expired = [];
    state.items.forEach(item => {
      if (item.kind !== kind || ['SUPERSEDED','REJECTED','REPAIR','CANCELLED','EXPIRED'].includes(item.state)) return;
      const expiry = Date.parse(item.expiresAt || item.createdAt);
      if (!Number.isFinite(expiry) || expiry > cutoff) return;
      item.state = 'EXPIRED'; item.expiredAt = U.now(); item.updatedAt = U.now();
      item.discussion = Array.isArray(item.discussion) ? item.discussion : [];
      item.discussion.push({ id:U.uid('discussion'), actor:String(actor || 'retention-clock').slice(0,120), actorKind:'system', body:'Seven-day candidate review window elapsed. Evidence was retained; nothing was applied.', decision:'EXPIRED', at:U.now() });
      expired.push(item.id);
    });
    if (expired.length) { write(state); expired.forEach(id => audit({ type:'expired', id, kind, cutoff:new Date(cutoff).toISOString() })); }
    return expired;
  }
  function approved(id, digest) { const item = get(id); return !!(item && item.state === 'APPROVED' && item.artifactDigest === String(digest || '').toLowerCase()); }
  function summary() { const items = list(), byState = {}; items.forEach(item => { byState[item.state] = (byState[item.state] || 0) + 1; }); return { total: items.length, byState }; }
  return {
    schema:SCHEMA,
    submit:input => withExclusive(() => submit(input)),
    submitReserved:(input, reservedId) => withExclusive(() => submitReserved(input, reservedId)),
    vote:(id, input) => withExclusive(() => vote(id, input)),
    recordTechnicalReview:(id, assessment) => withExclusive(() => recordTechnicalReview(id, assessment)),
    recordTechnicalRefusal:(id, refusal) => withExclusive(() => recordTechnicalRefusal(id, refusal)),
    discuss:(id, input) => withExclusive(() => discuss(id, input)),
    route:(id, input) => withExclusive(() => route(id, input)),
    expireBefore:(kind, before, actor) => withExclusive(() => expireBefore(kind, before, actor)),
    list, get, approved, summary, withExclusive, operationLeaseStatus,
    stateFile, auditFile, operationLeaseFile:operationLease.leaseFile
  };
}

module.exports = { SCHEMA, create };
