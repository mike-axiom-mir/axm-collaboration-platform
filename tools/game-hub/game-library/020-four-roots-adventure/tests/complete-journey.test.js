'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Replay = require('../runtime/deterministic-journey');

const content = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'content', 'adventure-content.v0.2.json'), 'utf8'));
const built = Replay.build(content, Replay.EXPECTED_CONTENT.sha256);
const { record, finalState: state, finalView: view } = built;

assert.deepStrictEqual(Replay.verify(record, content, Replay.EXPECTED_CONTENT.sha256).pass, true);
assert.strictEqual(record.summary.actions, 228);
assert.strictEqual(record.summary.moves, 202);
assert.strictEqual(record.summary.interactionAttempts, 26);
assert.strictEqual(record.summary.recordedInteractions, 25);
assert.deepStrictEqual(record.summary.zonesVisited, ['crossroads', 'truth-hollow', 'agency-garden', 'continuity-archive', 'wisdom-grove']);
assert.deepStrictEqual(record.summary.roots, ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);
assert.strictEqual(record.summary.inventory, 10);
assert.strictEqual(record.summary.completedQuests, 6);
assert.strictEqual(record.summary.ending, 'A Door Into Review');
assert.strictEqual(record.summary.completed, true);
assert.strictEqual(record.checkpoints.length, 40);
assert.strictEqual(new Set(record.checkpoints.map((entry) => entry.stateDigest)).size, 38);

const blockedAgencyAction = record.actions.find((entry) => entry.targetActorId === 'agency-path' && entry.input.action === 'interact');
assert(blockedAgencyAction, 'blocked Agency countercheck is missing');
const blockedAgencyState = built.states.find((entry) => entry.actionIndex === blockedAgencyAction.index).state;
assert.strictEqual(blockedAgencyState.zoneId, 'crossroads');
assert.match(blockedAgencyState.message, /refuses to skip Truth/);

assert.strictEqual(state.flags.includes('journey-complete'), true);
assert.strictEqual(view.ending.title, 'A Door Into Review');
assert.strictEqual(view.progress.quests.every((quest) => quest.complete), true);
assert.strictEqual(view.progress.inventory.length, 10);
assert.strictEqual(view.progress.roots.every((root) => root.acquired), true);
assert.strictEqual(view.authority.generatedCodeCanCanonize, false);
assert.strictEqual(view.authority.finalMergeGate, 'MIKE_TOBI');

console.log('PASS Four Roots Adventure complete deterministic journey (202 moves, 26 attempts, 25 recorded interactions, 6 quests)');
