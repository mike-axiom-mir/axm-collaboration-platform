'use strict';
const Core = require('./evidence-core.js');
const Machine = require('./machine.js');
let fails = 0;
function ok(name, pass) { console.log((pass ? 'PASS  ' : 'FAIL  ') + name); if (!pass) fails++; }

const sample = {
  title: 'Factory proof', goal: 'Build one honest module',
  actor: { id: 'chatgpt-workmode', type: 'ai' }, source_checkpoint: 'v1.9.1 private test copy',
  observations: [{ claim: 'Forge UI is display-only', source_kind: 'source-read', source: 'tools/agent-tool-forge/index.html' }],
  actions: [{ action: 'module.build', target: 'tools/evidence-desk', result: 'created', evidence: 'file tree' }],
  checks: [{ name: 'core selftest', status: 'PASS', evidence: 'node selftest.js' }],
  changes: [{ path: 'tools/evidence-desk', kind: 'added', summary: 'new TEST module' }],
  limitations: ['browser not tested in this unit test'], next_actions: ['run Workshop verifier']
};
const receipt = Core.build(sample, { now: '2026-07-11T00:00:00.000Z' });
ok('receipt format', receipt.format === 'axm-evidence-receipt');
ok('execution and verification counted separately', receipt.counts.actions_executed === 1 && receipt.counts.checks_passed === 1);
ok('verified scope status is explicit', receipt.status === 'VERIFIED_WITH_RECORDED_SCOPE');
ok('report carries no-fake-done boundary', Core.report(receipt).includes('Receipt generation records supplied evidence'));
ok('fingerprint stable across timestamps', receipt.fingerprint.value === Core.build(sample, { now: '2027-01-01T00:00:00.000Z' }).fingerprint.value);

const weak = Core.build({ title: 'Weak', goal: 'Expose gaps', observations: ['a claim'], actions: [{ action: 'x' }] });
ok('unsourced observation remains visible', weak.observations.length === 1 && weak.warnings.some(x => x.includes('unsourced')));
ok('action without checks is not verified', weak.status === 'EXECUTED_NOT_FULLY_VERIFIED' && weak.truth.fully_verified === false);
const failed = Core.build({ title: 'Fail', goal: 'Keep failure', checks: [{ name: 'probe', status: 'FAIL' }], limitations: ['none'] });
ok('failed check stays failed', failed.status === 'CHECKS_FAILED');

(async () => {
  const noGate = await Machine.call({}, 'build', sample);
  ok('machine adapter refuses missing host gate', noGate.ok === false && noGate.error.code === 'HOST_GATE_REQUIRED');
  const deny = await Machine.call({ authorize: async () => ({ allow: false, reason: 'consent off' }) }, 'build', sample);
  ok('machine adapter preserves gate refusal', deny.ok === false && deny.error.code === 'GATE_DENIED');
  const allow = await Machine.call({ authorize: async () => ({ allow: true }) }, 'build', sample);
  ok('machine build uses shared core', allow.ok === true && allow.result.receipt.fingerprint.value === receipt.fingerprint.value);
  ok('machine build has no writes', Array.isArray(allow.writes) && allow.writes.length === 0);
  const unknown = await Machine.call({ authorize: async () => ({ allow: true }) }, 'delete', sample);
  ok('unknown action refused', unknown.ok === false && unknown.error.code === 'UNKNOWN_ACTION');
  console.log('\nAXM EVIDENCE DESK SELFTEST — ' + fails + ' FAIL');
  process.exitCode = fails ? 1 : 0;
})();
