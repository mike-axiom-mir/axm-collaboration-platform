#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Service = require('../../shared/verification-proof/verification-proof-service');

const root = path.join(__dirname, '..', '..');
const service = Service.create({ root });
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

assert.equal(manifest.id, contract.id);
assert.equal(manifest.version, contract.version);
assert.deepEqual(manifest.permissions, contract.permissions);
const curatedIntakeRoot = path.join(root, 'intakes', 'verification-proof-99-v0.1');

function testCommittedPublicProofSurfaces() {
  const publicProofCatalog = service.publicProofBatch1Catalog();
  assert.equal(publicProofCatalog.seed_count, 10);
  assert.equal(publicProofCatalog.status, 'IMPLEMENTED_LOCAL_CONTRACT_SLICE');
  assert.equal(publicProofCatalog.truth.runtime_proof, false);
  const publicProofSuite = service.selftestPublicProofBatch1();
  assert.equal(publicProofSuite.ok, true);
  assert.equal(publicProofSuite.fixture_count, 40);
  assert.equal(publicProofSuite.pass_count, 40);
  assert.equal(publicProofSuite.fail_count, 0);
  assert.equal(publicProofSuite.network_used, false);
  assert.equal(publicProofSuite.canon, false);

  const publicProofIntakeCatalog = service.publicProofIntakeCatalog();
  assert.equal(publicProofIntakeCatalog.counts.seeds, 100);
  assert.equal(publicProofIntakeCatalog.counts.eligible, 52);
  assert.equal(publicProofIntakeCatalog.counts.held, 48);
  const publicProofIntakeSuite = service.selftestPublicProofIntake();
  assert.equal(publicProofIntakeSuite.ok, true);
  assert.equal(publicProofIntakeSuite.contract_checks, 100);
  assert.equal(publicProofIntakeSuite.eligible_fixture_checks, 154);
  assert.equal(publicProofIntakeSuite.hold_refusal_checks, 48);
  assert.equal(publicProofIntakeSuite.pass_count, 302);
  assert.equal(publicProofIntakeSuite.fail_count, 0);
  const heldSeed = publicProofIntakeCatalog.held[0];
  const heldResult = service.validatePublicProofIntake(heldSeed.id, {});
  assert.equal(heldResult.decision, 'HELD_RESEARCH_OR_DEPENDENCY');
  assert.equal(heldResult.blocked, true);

  const publicProofFixtureRoot = path.join(root, 'shared', 'verification-proof', 'public-proof-batch1', 'fixtures');
  const publicProofFixture = name => JSON.parse(fs.readFileSync(path.join(publicProofFixtureRoot, 'demo-descriptor', name), 'utf8'));
  const missingInput = publicProofFixture('valid.json');
  delete missingInput.inputs.proof_ref;
  assert.equal(service.validatePublicProofBatch1('axm.proof.demo-descriptor', missingInput).decision, 'BLOCK');
  const authorityEscalation = publicProofFixture('valid.json');
  authorityEscalation.authority.live_activation_allowed = true;
  assert.equal(service.validatePublicProofBatch1('axm.proof.demo-descriptor', authorityEscalation).decision, 'BLOCK');
  const privacyCanary = publicProofFixture('valid.json');
  privacyCanary.privacy_canaries.push({ kind: 'synthetic_secret', value: 'AXM_SYNTHETIC_SECRET_CANARY_SELFTEST', synthetic: true });
  assert.equal(service.validatePublicProofBatch1('axm.proof.demo-descriptor', privacyCanary).decision, 'QUARANTINE');
  const brokenRollback = publicProofFixture('rollback.json');
  brokenRollback.synthetic_transition.after_rollback.digest = 'sha256:not-restored';
  assert.equal(service.validatePublicProofBatch1('axm.proof.demo-descriptor', brokenRollback).decision, 'BLOCK');
  assert(server.includes('/api/verification-proof/catalog'));
  assert(server.includes('/api/verification-proof/run'));
}

testCommittedPublicProofSurfaces();

if (!fs.existsSync(path.join(curatedIntakeRoot, 'modules'))) {
  assert.throws(() => service.catalog(), /curated verification intake is missing/);
  console.log('verification proof lab selftest: PASS WITH TEST_HOLD (local-only 99-organ intake absent; 40 committed Batch 1 fixtures and 302 committed intake checks passed)');
  process.exit(0);
}

const catalog = service.catalog();
assert.equal(catalog.moduleCount, 99);
assert.equal(catalog.apiExecutableCount, 91);
assert.equal(catalog.guardedCount, 8);
assert.equal(catalog.sourceHeldCount, 1);
assert.equal(catalog.canon, false);
assert.equal(catalog.authority, 'NONE');

function pycCount() {
  const start = curatedIntakeRoot;
  const scan = directory => fs.readdirSync(directory, { withFileTypes: true }).reduce((count, entry) => {
    const full = path.join(directory, entry.name);
    return count + (entry.isDirectory() ? scan(full) : entry.name.endsWith('.pyc') ? 1 : 0);
  }, 0);
  return scan(start);
}

(async () => {
  const before = pycCount();
  const verdict = await service.run({
    moduleId: 'axm.verify.verdict-state-normalizer',
    envelope: { construct: { args: [], kwargs: {} }, call: { args: ['PASS', 'lab-selftest'], kwargs: {} } }
  });
  assert.equal(verdict.result.canonical_state, 'PASS');
  assert.equal(verdict.authority, 'NONE');
  assert.equal(verdict.canon, false);

  const routed = await service.run({
    moduleId: 'axm.verify.claim-proof-surface-router',
    envelope: {
      construct: { args: [{ 'contract-test': { verifier_id: 'axm.contract', evidence_kind: 'machine', native_authority: true } }], kwargs: {} },
      call: { args: [{ claim_id: 'c1', claim_type: 'contract', required_proof_surfaces: ['contract-test'] }], kwargs: {} }
    }
  });
  assert.equal(routed.result.route_state, 'ROUTED');

  const sufficient = await service.run({
    moduleId: 'axm.verify.evidence-sufficiency-policy',
    envelope: {
      construct: { args: ['p1', 1, ['code'], 1], kwargs: {} },
      call: { args: ['c1', [{ receipt_id: 'r1', claim_id: 'c1', verdict_state: 'PASS', freshness_state: 'FRESH', relevance_state: 'RELEVANT', native_fit_state: 'FIT', proof_surface: 'code', verifier_id: 'v1', independence_state: 'INDEPENDENT' }]], kwargs: {} }
    }
  });
  assert.equal(sufficient.result.sufficiency_state, 'SUFFICIENT');

  const fresh = await service.run({
    moduleId: 'axm.verify.proof-freshness-expiry-policy',
    envelope: {
      construct: { args: ['p1', ['artifact'], 300], kwargs: {} },
      call: { args: [{ proof_id: 'proof1', issued_at: '2026-07-27T20:00:00Z', context: { artifact: 'sha256:abc' } }, { artifact: 'sha256:abc' }, '2026-07-27T20:01:00Z'], kwargs: {} }
    }
  });
  assert.equal(fresh.result.freshness_state, 'FRESH');

  const gaps = await service.run({
    moduleId: 'axm.verify.test-gap-blindspot-detector',
    envelope: {
      construct: { args: [], kwargs: {} },
      call: { args: [[{ requirement_id: 'r1', required_evidence: ['positive'], risk_boundaries: [], needs_native_evidence: false }], []], kwargs: {} }
    }
  });
  assert.equal(gaps.result.verdict_state, 'FAIL');
  assert.equal(gaps.result.requirement_gaps[0].untested, true);

  const packet = await service.run({
    moduleId: 'axm.verify.release-gate-decision-packet',
    envelope: {
      construct: { args: [], kwargs: {} },
      call: { args: [{ artifact: { artifact_id: 'a1', digest: 'sha256:abc' }, required_receipt_ids: ['r1'], receipts: [{ receipt_id: 'r1', verdict_state: 'PASS', fresh: true }], unresolved_conflicts: [], failed_checks: [], limitations: ['device scope'], required_approval_roles: ['steward'], approvals: [{ role: 'steward', decision: 'APPROVE' }], rollback_plan: { plan_id: 'rb1', verified: true } }], kwargs: {} }
    }
  });
  assert.equal(packet.result.packet_state, 'READY_FOR_MERGE_GATE_REVIEW');
  assert.equal(packet.result.merge_gate_decision, 'NOT_MADE');
  assert.equal(pycCount(), before);

  await assert.rejects(
    service.run({ moduleId: 'axm.verify.typed-claim-registry', envelope: {} }),
    /CALLER_PATH_WRITE_REQUIRES_SEPARATE_AUTHORITY/
  );
  console.log('verification proof lab selftest: PASS (91 callable organs, 8 guarded, 6 featured live executions, 100 Public Proof contracts / 52 eligible / 48 held / 302 intake checks)');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
