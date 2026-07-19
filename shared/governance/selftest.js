#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Core = require('./axm-review-constitution-core');
let pass = 0;
function test(name, fn) { try { fn(); pass += 1; console.log('PASS ' + name); } catch (error) { console.error('FAIL ' + name + '\n  ' + error.stack); process.exitCode = 1; } }
const artifact = { artifactId: 'asset-1', digest: 'sha256:abc' };
function shared() { return Core.create({ constitutionId: 'two-perspectives', mode: 'SHARED', governedActions: ['shared-promotion'], seats: [{ seatId: 'seat-a', label: 'Perspective A' }, { seatId: 'seat-b', label: 'Perspective B' }] }); }
function vote(c, seatId, identityId, kind, verdict, target) { return Core.receipt(c, { seatId, reviewer: { identityId, kind, displayName: identityId }, artifact: target || artifact, action: 'shared-promotion', verdict: verdict || 'UP', evidence: { summary: 'Independent judgment with visible evidence.' } }); }
test('solo use is permitted without review seats', () => { const c = Core.create({ mode: 'SOLO' }); const d = Core.evaluate(c, artifact, [], 'shared-promotion'); assert.equal(d.permitted, true); assert.equal(d.status, 'UNREVIEWED_BY_CHOICE'); });
test('identity kind never controls eligibility', () => { const c = shared(); const receipts = [vote(c, 'seat-a', 'river-mind', 'fish'), vote(c, 'seat-b', 'orbital-guest', 'alien')]; assert.equal(Core.evaluate(c, artifact, receipts, 'shared-promotion').permitted, true); });
test('one identity cannot fill two independent seats', () => { const c = shared(); const receipts = [vote(c, 'seat-a', 'same', 'machine'), vote(c, 'seat-b', 'same', 'human')]; const d = Core.evaluate(c, artifact, receipts, 'shared-promotion'); assert.equal(d.permitted, false); assert(d.issues[0].includes('multiple-seats')); });
test('receipt for an old digest cannot approve a changed artifact', () => { const c = shared(); const receipts = [vote(c, 'seat-a', 'one', 'machine'), vote(c, 'seat-b', 'two', 'human')]; assert.equal(Core.evaluate(c, { artifactId: 'asset-1', digest: 'sha256:new' }, receipts, 'shared-promotion').permitted, false); });
test('hold or down keeps the selected shared gate closed', () => { const c = shared(); const receipts = [vote(c, 'seat-a', 'one', 'machine'), vote(c, 'seat-b', 'two', 'human', 'HOLD')]; assert.equal(Core.evaluate(c, artifact, receipts, 'shared-promotion').permitted, false); });
test('ungoverned actions remain available', () => { const c = shared(); assert.equal(Core.evaluate(c, artifact, [], 'private-use').permitted, true); });
if (!process.exitCode) console.log('\n' + pass + ' PASS · 0 FAIL · review-constitution ' + Core.VERSION);
