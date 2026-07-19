#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Service = require('./axm-direction-service');
let stored = null;
let pulseGoals = [];
let reviewItems = [];
const modules = [
  { id:'asset-fabric', name:'Asset Fabric', folder:'asset-fabric', entry:'index.html' },
  { id:'game-forge', name:'Game Forge', folder:'game-forge', entry:'index.html' },
  { id:'agent-tool-forge', name:'Agent Tool Forge', folder:'agent-tool-forge', entry:'index.html' }
];
const bodyPulse = {
  goal(input) { const previous = pulseGoals.find(item => item.goalId === input.goalId); const goal = Object.assign({}, previous || {}, input); pulseGoals = pulseGoals.filter(item => item.goalId !== input.goalId).concat(goal); return this.status(); },
  status() { return { mode:'STOPPED', body:{pressure:'GREEN'}, leases:[], goals:pulseGoals }; }
};
const review = {
  submit(input) { const existing = reviewItems.find(item => item.sourceRef === input.sourceRef && item.artifactDigest === input.artifactDigest); if (existing) return existing; const item = Object.assign({ id:'review-' + (reviewItems.length + 1), state:'PENDING', votes:[] }, input, { requiredSeats:2 }); reviewItems.push(item); return item; },
  get(id) { return reviewItems.find(item => item.id === id) || null; }
};
const service = Service.create({ read:() => stored, write:value => { stored = value; }, modules:() => modules, bodyPulse, review, now:() => 1000 });
const preview = service.compile({ title:'Build co-op game icons', description:'Create icon assets and a multiplayer game', actorId:'mirror' });
assert.equal(preview.verdict, 'PARTIAL_HANDS_REQUIRED');
assert.equal(pulseGoals.length, 0, 'compile must be read-only');
const committed = service.commit(preview.request);
assert.equal(pulseGoals.length, 1, 'only the real automatic hand is queued');
assert.equal(reviewItems.length, 1, 'every committed direction enters exact-digest review');
assert.equal(committed.plan.stewardReview.assessment.suggestedVerdict, 'HOLD');
assert.equal(committed.plan.stewardReview.automaticVote, false);
assert(/^[a-f0-9]{64}$/.test(committed.plan.stewardReview.artifact.digest));
assert.equal(committed.plan.routes.find(route => route.moduleId === 'asset-fabric').queue.bodyMode, 'STOPPED');
assert(committed.plan.handRequests.some(hand => hand.targetModuleId === 'game-forge'));
assert.equal(service.status().counts.handRequests, 1);
service.setStatus({ directionId:preview.request.requestId, status:'PAUSED', actorId:'mike' });
assert.equal(pulseGoals[0].status, 'PAUSED');
assert.equal(service.status().directions[0].status, 'PAUSED');
console.log('PASS direction service · deterministic preview · bounded queue · lifecycle propagation');
