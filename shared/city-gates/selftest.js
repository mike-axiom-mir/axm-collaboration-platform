'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Artifact = require('../artifact-depot/artifact-depot-core');
const Grid = require('../authority-grid/authority-grid-core');
const Gates = require('./city-gates-core');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }

function run() {
  const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, 'gate-registry.json'), 'utf8'));
  check(Gates.committedDefaults(defaults), 'all committed external gates are disabled and non-canonical');
  check(defaults.adapters.every(row => row.transportBundled === false && row.internalAuthority === false), 'no transport or external authority is bundled');
  expect('GATE_DISABLED', () => Gates.outboundPlan(defaults.adapters[0], {}));
  const adapter = { ...defaults.adapters.find(row => row.id === 'github-draft'), enabled: true };
  const request = Grid.effectRequest({ id: 'github-request', principal: 'agent:publisher', action: 'create-draft', resource: 'github:owner/repo', effectClass: 'NETWORK_WRITE', targetDigest: 'a'.repeat(64), scope: { head: 'feature', base: 'main', draft: true }, requestedAt: '2026-08-15T15:00:00.000Z', correlationId: 'corr-gate' });
  const policy = Grid.policy({ id: 'gate-policy', version: 'v1', decisionMakers: ['human:mike'], rules: [{ principal: 'agent:publisher', action: 'create-draft', resource: 'github:owner/repo', effectClass: 'NETWORK_WRITE', decision: 'PERMIT', reason: 'selftest plan only' }] });
  const decision = Grid.decide(request, policy, { decidedBy: 'human:mike', decidedAt: '2026-08-15T15:00:01.000Z', expiresAt: '2026-08-15T15:05:00.000Z' });
  const payload = { head: 'feature', base: 'main', title: 'Candidate', body: 'Review me', draft: true };
  const plan = Gates.outboundPlan(adapter, { request, policy, decision, now: '2026-08-15T15:00:02.000Z', consumedDecisionDigests: new Set(), verifyDecisionMaker: () => true, internalPacketDigest: 'b'.repeat(64), payload });
  check(plan.executesTransport === false && plan.grantsAuthority === false, 'outbound plan is inert and non-authorizing');
  check(plan.receiverConstraints.includes('draft-true'), 'GitHub plan requires final draft readback');
  expect('GATE_PLAN_DRIFT', () => Gates.githubReceiver({ ...plan, payload: { ...plan.payload, title: 'tampered' } }, { ...payload, open: true, merged: false, planDigest: plan.planDigest }));
  const pass = Gates.githubReceiver(plan, { ...payload, open: true, merged: false, planDigest: plan.planDigest });
  check(pass.state === 'PASS' && pass.draft, 'exact open unmerged draft readback passes');
  check(Gates.githubReceiver(plan, { ...payload, draft: false, open: true, merged: false, planDigest: plan.planDigest }).state === 'FAIL', 'draft race/readback false fails');
  check(Gates.githubReceiver(plan, { ...payload, open: true, merged: true, planDigest: plan.planDigest }).state === 'FAIL', 'merged receiver fails');
  const imported = Gates.inbound('mcp', Buffer.from('external data'), 'application/json');
  check(imported.quarantineRequired && !imported.trusted && !imported.installed && !imported.grantsAuthority, 'inbound external data always routes to quarantine');
  const bytes = Buffer.from('offline package');
  const ref = Artifact.artifactRef(bytes);
  const manifest = Artifact.exportManifest([ref]);
  check(Gates.verifyArtifactExport(manifest, new Map([[ref.digest, bytes]])).state === 'PASS', 'public package bytes can be verified locally');
  check(Gates.verifyArtifactExport(manifest, new Map([[ref.digest, Buffer.from('tampered')]])).state === 'FAIL', 'tampered package fails local verification');
  expect('ARTIFACT_EXPORT_DRIFT', () => Gates.verifyArtifactExport({ ...manifest, artifacts: [] }, new Map()));
  check(defaults.privateLocalOperationRequiresGate === false, 'private local operation needs no public gate');
  process.stdout.write(`city-gates selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
