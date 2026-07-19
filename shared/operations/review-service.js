'use strict';

const path = require('path');
const U = require('./operations-utils');

const SCHEMA = 'axm.review-inbox/v1';

function create(options) {
  const stateFile = path.join(options.stateRoot, 'review-inbox', 'reviews.json');
  const auditFile = path.join(options.stateRoot, 'review-inbox', 'audit.jsonl');
  function read() { return U.loadJson(stateFile, { schema: SCHEMA, version: 1, items: [] }); }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }
  function normalizeSeats(value) { return value === 'dual' ? 2 : Math.max(1, Math.min(10, Math.round(Number(value) || 1))); }

  function submit(input) {
    const body = input || {}, digest = String(body.artifactDigest || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('artifactDigest must be a SHA-256 digest');
    const state = read(), sourceRef = String(body.sourceRef || '').slice(0, 300), kind = String(body.kind || 'proposal').slice(0, 80);
    const existing = state.items.find(item => item.kind === kind && item.sourceRef === sourceRef && item.artifactDigest === digest && !['REJECTED','SUPERSEDED'].includes(item.state));
    if (existing) {
      if (existing.state === 'REPAIR') throw new Error('repair needs a changed plan digest before review can reopen');
      return existing;
    }
    for (const item of state.items) {
      if (item.kind === kind && item.sourceRef === sourceRef && item.artifactDigest !== digest && !['REJECTED','SUPERSEDED'].includes(item.state)) {
        item.state = 'SUPERSEDED'; item.supersededAt = U.now(); item.supersededByDigest = digest;
      }
    }
    const item = {
      schema: 'axm.review-item/v1', id: U.uid('review'), kind, title: String(body.title || 'Untitled proposal').slice(0, 180),
      sourceRef, artifactDigest: digest, summary: String(body.summary || '').slice(0, 2000), requiredSeats: normalizeSeats(body.requiredSeats),
      action: body.action && typeof body.action === 'object' ? U.clone(body.action) : null, state: 'PENDING', votes: [], discussion: [],
      createdAt: U.now(), updatedAt: U.now()
    };
    state.items.unshift(item); write(state); audit({ type: 'submitted', id: item.id, digest, kind, sourceRef });
    return item;
  }

  function vote(id, input) {
    const state = read(), item = state.items.find(entry => entry.id === id);
    if (!item) throw new Error('review item not found');
    if (['SUPERSEDED','REJECTED','REPAIR','CANCELLED'].includes(item.state)) throw new Error('review item is closed');
    const digest = String(input && input.artifactDigest || '').toLowerCase();
    if (digest !== item.artifactDigest) throw new Error('vote digest does not match the reviewed artifact');
    const actor = String(input && input.actor || '').trim().slice(0, 120);
    if (!actor) throw new Error('review actor is required');
    const verdict = String(input && input.verdict || '').toUpperCase();
    if (!['APPROVE','HOLD','REJECT'].includes(verdict)) throw new Error('verdict must be APPROVE, HOLD or REJECT');
    item.votes = item.votes.filter(entry => entry.actor.toLowerCase() !== actor.toLowerCase());
    item.votes.push({ actor, actorKind: String(input.actorKind || 'unknown').slice(0, 40), verdict, note: String(input.note || '').slice(0, 1000), artifactDigest: digest, at: U.now() });
    if (verdict === 'REJECT') item.state = 'REJECTED';
    else {
      const approvals = new Set(item.votes.filter(entry => entry.verdict === 'APPROVE').map(entry => entry.actor.toLowerCase()));
      item.state = approvals.size >= item.requiredSeats ? 'APPROVED' : item.votes.some(entry => entry.verdict === 'HOLD') ? 'HOLD' : 'PENDING';
    }
    item.updatedAt = U.now(); write(state); audit({ type: 'vote', id, actor, verdict, state: item.state, digest });
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
  function approved(id, digest) { const item = get(id); return !!(item && item.state === 'APPROVED' && item.artifactDigest === String(digest || '').toLowerCase()); }
  function summary() { const items = list(), byState = {}; items.forEach(item => { byState[item.state] = (byState[item.state] || 0) + 1; }); return { total: items.length, byState }; }
  return { schema: SCHEMA, submit, vote, discuss, route, list, get, approved, summary, stateFile, auditFile };
}

module.exports = { SCHEMA, create };
