'use strict';
const assert = require('assert');
const Core = require('./project-room-core.js');

const empty = Core.emptyRoom();
assert.equal(empty.format, 'axm.project-room/v1');
assert.equal(empty.version, 2);
['cards','goals','milestones','decisions','documents','messages','events','forms','reviews','activity','versions'].forEach(key => assert.deepEqual(empty[key], []));
assert.equal(empty.project.title, 'Untitled project');

const card = Core.normalizeCard({ title: 'Build a thing', stage: 'testing' });
let result = Core.moveCard(card, 'done');
assert.equal(result.ok, false);
assert.equal(card.stage, 'testing');
card.evidence = ['Selftest passed', 'Reviewed the output'];
result = Core.moveCard(card, 'done');
assert.equal(result.ok, true);
assert.equal(card.stage, 'done');
assert.ok(card.completedAt);

const legacy = Core.normalizeRoom({
  format: Core.FORMAT,
  goals: [{ id: 'g1', title: 'A goal', targetDate: '2026-08-01' }],
  milestones: [{ id: 'm1', title: 'A milestone', goalId: 'g1', targetDate: '2026-07-20' }],
  cards: [
    { id: 'c1', title: 'Unsafe done', stage: 'done', evidence: [] },
    { id: 'c2', title: 'Safe done', stage: 'done', evidence: ['checked'], goalId: 'g1', milestoneId: 'm1' }
  ]
});
assert.equal(legacy.version, 2);
assert.equal(legacy.cards[0].stage, 'testing');
assert.equal(legacy.cards[1].stage, 'done');
assert.deepEqual(legacy.documents, []);

const merged = Core.normalizeRoom({
  format: Core.FORMAT,
  project: { title: 'Merged room', status: 'active', lead: 'Mike + Nova' },
  goals: [{ id: 'g1', title: 'Goal', targetDate: '2026-08-01' }],
  milestones: [{ id: 'm1', title: 'Milestone', goalId: 'g1', targetDate: '2026-07-20' }],
  cards: [{ id: 'c1', title: 'Open task', stage: 'testing', dueDate: '2026-07-18' }],
  decisions: [{ title: 'Use one room', choice: 'Merge the workflows', decidedOn: '2026-07-12' }],
  documents: [{ title: 'Brief', kind: 'wiki', body: 'One shared truth' }],
  messages: [{ title: 'Update', body: 'Work started', authorType: 'shared' }],
  events: [{ title: 'Review', date: '2026-07-22', time: '14:00' }],
  forms: [{ title: 'Approval', prompt: 'Ready?', response: 'Yes', status: 'answered' }],
  reviews: [{ title: 'First review', kind: 'review', body: 'Looks sound', verdict: 'pass', cardId: 'c1' }]
});
assert.equal(merged.project.status, 'active');
assert.equal(merged.documents.length, 1);
assert.equal(merged.messages.length, 1);
assert.equal(merged.forms[0].status, 'answered');
assert.equal(merged.reviews[0].cardId, 'c1');
assert.equal(Core.timeline(merged).length, 5);

Core.appendActivity(merged, 'test', 'Before checkpoint', 'selftest');
const checkpoint = Core.createVersion(merged, 'Known good', 'Before mutation');
assert.equal(merged.versions.length, 1);
assert.equal(checkpoint.snapshot.versions.length, 0);
merged.project.title = 'Mutated title';
merged.documents.push(Core.normalizeDocument({ title: 'Later document', body: 'later' }));
const restored = Core.restoreVersion(merged, checkpoint.id);
assert.equal(restored.ok, true);
assert.equal(restored.room.project.title, 'Merged room');
assert.equal(restored.room.documents.length, 1);
assert.equal(restored.room.versions.length, 1);
assert.ok(restored.room.activity.some(item => item.kind === 'restore'));

const summary = Core.summary(restored.room);
assert.equal(summary.cards, 1);
assert.equal(summary.documents, 1);
assert.equal(summary.versions, 1);
assert.throws(() => Core.normalizeRoom({ format: 'something-else', cards: [] }), /not an AXM Project Room/);

console.log('Project Room selftest: PASS (v1 migration, merged records, timeline, evidence gate, checkpoints, restore)');
