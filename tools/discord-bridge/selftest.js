'use strict';

const assert = require('assert');
const Core = require('./discord-bridge-core');

const defaults = Core.defaults();
assert.equal(defaults.enabled, false);
assert.equal(defaults.paused, true);
assert.equal(defaults.ordinaryMessageReading, false);
assert.equal(defaults.commandsEnabled, false);

assert.throws(() => Core.updateSettings(defaults, { enabled: true }, { id: 'bot', kind: 'machine' }), /human actor/);
const enabled = Core.updateSettings(defaults, { enabled: true, ordinaryMessageReading: true, applicationId: '123456789012345678' }, { id: 'mike', kind: 'human', name: 'Mike' });
assert.equal(enabled.enabled, true);
assert.equal(enabled.ordinaryMessageReading, false);
assert(Core.installUrl(enabled.applicationId).includes('permissions=3072'));

const raw = {
  schema: 'axm.action/v1', id: 'action-1', name: 'Secret test', tool: 'forge', operation: 'build',
  inputs: { secret: 'DO_NOT_LEAK_INPUT' }, proposal: 'DO_NOT_LEAK_PROPOSAL', requestedPermission: 'files',
  actor: { id: 'codex', kind: 'machine', name: 'Codex' }, state: 'COMPLETE',
  approval: { decision: 'APPROVED', actor: { id: 'mike', kind: 'human', name: 'Mike' }, reason: 'reviewed', at: '2026-07-18T00:00:00Z' },
  receipt: { ok: true, evidence: ['tests pass'], output: { token: 'DO_NOT_LEAK_OUTPUT' }, actor: { id: 'codex', kind: 'machine', name: 'Codex' }, at: '2026-07-18T00:01:00Z' }
};
const safe = Core.sanitizeAction(raw), rendered = Core.renderReceipt(safe);
assert(!JSON.stringify(safe).includes('DO_NOT_LEAK'));
assert(!rendered.includes('DO_NOT_LEAK'));
assert(rendered.includes('not independent proof'));
assert(rendered.includes('COMPLETE'));

const proposal = Core.proposalFromInteraction({ id: '123456789012345678', guild_id: '123456789012345679', channel_id: '123456789012345680', member: { user: { id: '123456789012345681', username: 'Tester' } } }, 'Please discuss a beginner guide');
assert.equal(proposal.trainingEligible, false);
assert.equal(proposal.executionAuthorized, false);
assert.equal(proposal.state, 'PROPOSED');

console.log('discord-bridge selftest: 18 assertions pass');
