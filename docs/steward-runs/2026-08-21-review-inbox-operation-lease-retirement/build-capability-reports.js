#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const COMPARATOR = path.join(
  String(process.env.USERPROFILE || ''),
  '.codex', 'skills', 'detect-capability-gaps', 'scripts', 'compare_capabilities.py'
);

const requirements = [
  ['baseline-crash-residue-reproduction', true, 'review.lease-retirement.baseline-crash-residue-reproduced'],
  ['existing-lease-serialization-preserved', true, 'review.lease-retirement.existing-single-host-serialization-preserved'],
  ['read-only-exact-owner-plan', true, 'review.lease-retirement.read-only-exact-owner-digest-plan'],
  ['closed-explicit-request', true, 'review.lease-retirement.closed-explicit-operator-request'],
  ['assertion-and-confirmation-challenge', true, 'review.lease-retirement.assertion-digest-and-confirmation-bound'],
  ['current-process-owner-refusal', true, 'review.lease-retirement.current-process-owner-refused'],
  ['intent-before-retirement', true, 'review.lease-retirement.intent-written-before-owner-move'],
  ['exact-owner-recheck', true, 'review.lease-retirement.exact-owner-digest-rechecked-before-move'],
  ['raw-owner-evidence-quarantine', true, 'review.lease-retirement.raw-owner-bytes-quarantined-with-digest-verification'],
  ['typed-result', true, 'review.lease-retirement.typed-result-written-after-evidence-verification'],
  ['restart-continuity', true, 'review.lease-retirement.new-service-mutation-after-explicit-retirement'],
  ['evidence-collision-preservation', true, 'review.lease-retirement.preexisting-evidence-never-unlinked-on-exclusive-create-failure'],
  ['bounded-transient-windows-contention', true, 'review.lease-retirement.transient-eperm-retried-within-bounded-contention'],
  ['unreadable-evidence-fails-held', true, 'review.lease-retirement.persistent-unreadable-evidence-typed-held-without-mutation'],
  ['local-explicit-cli', true, 'review.lease-retirement.explicit-local-cli-with-exact-state-root'],
  ['no-api-or-browser-route', true, 'review.lease-retirement.no-api-or-browser-retirement-route'],
  ['clean-product-slice-replay', true, 'review.lease-retirement.clean-product-slice-replay'],
  ['zero-consequential-authority', true, 'review.lease-retirement.zero-execution-adoption-promotion-merge-foundation-or-canon-authority'],
  ['specialist-package-lane-excluded', true, 'review.lease-retirement.specialist-package-lane-not-inspected'],
  ['safe-automatic-stale-recovery', false, 'review.lease-retirement.safe-automatic-stale-owner-recovery'],
  ['holder-termination-proof', false, 'review.lease-retirement.holder-termination-or-abandonment-proof'],
  ['retirement-safety-proof', false, 'review.lease-retirement.retirement-safety-proof'],
  ['cross-file-acid', false, 'review.lease-retirement.cross-file-acid'],
  ['multi-host-network-filesystem', false, 'review.lease-retirement.multi-host-or-network-filesystem-safety'],
  ['external-writer-exclusion', false, 'review.lease-retirement.noncooperating-external-writer-exclusion'],
  ['protected-rollback-resistant-evidence', false, 'review.lease-retirement.protected-monotonic-storage-and-rollback-prevention'],
  ['identity-human-trusted-time', false, 'review.lease-retirement.real-world-identity-human-participation-and-trusted-time'],
  ['live-host-policy-and-signed-review', false, 'review.lease-retirement.actual-live-host-policy-and-signed-review'],
  ['human-benefit-learning-accessibility', false, 'review.lease-retirement.assistive-technology-human-benefit-or-learning-proof']
].map(([id, required, capability]) => ({ id, required, capabilities: [capability] }));

const inheritedReady = new Set([
  'review.lease-retirement.baseline-crash-residue-reproduced',
  'review.lease-retirement.existing-single-host-serialization-preserved',
  'review.lease-retirement.zero-execution-adoption-promotion-merge-foundation-or-canon-authority',
  'review.lease-retirement.specialist-package-lane-not-inspected'
]);
const implementedReady = new Set(requirements.filter(item => item.required).flatMap(item => item.capabilities));
const constraints = {
  'review.lease-retirement.baseline-crash-residue-reproduced': ['exact v4.3 lease Git blob executed from a temporary module copy; production crash frequency remains unproven'],
  'review.lease-retirement.existing-single-host-serialization-preserved': ['fixed local filesystem lease among cooperating ReviewService callers on one host only'],
  'review.lease-retirement.read-only-exact-owner-digest-plan': ['plan observes current raw lock bytes and emits a SHA-256 challenge; it does not establish whether the holder is alive'],
  'review.lease-retirement.closed-explicit-operator-request': ['runtime exact-key validation and JSON Schema declaration; no independent metaschema-validator claim'],
  'review.lease-retirement.assertion-digest-and-confirmation-bound': ['operator assertion is accepted as an assertion, not authenticated fact'],
  'review.lease-retirement.current-process-owner-refused': ['refuses actual process.pid or an owner held by the same lease instance; no general process-liveness probe'],
  'review.lease-retirement.intent-written-before-owner-move': ['exclusive local evidence file; not an ACID transaction with lock rename and result'],
  'review.lease-retirement.exact-owner-digest-rechecked-before-move': ['same-host path and bytes only; a malicious or noncooperating writer remains outside the contract'],
  'review.lease-retirement.raw-owner-bytes-quarantined-with-digest-verification': ['local evidence directory is not protected or rollback resistant'],
  'review.lease-retirement.typed-result-written-after-evidence-verification': ['result records local mechanism evidence, not safety or holder-death proof'],
  'review.lease-retirement.new-service-mutation-after-explicit-retirement': ['synthetic restart fixture after an asserted crash; no live production recovery claim'],
  'review.lease-retirement.preexisting-evidence-never-unlinked-on-exclusive-create-failure': ['deterministic UUID-collision regression fixture'],
  'review.lease-retirement.transient-eperm-retried-within-bounded-contention': ['deterministic injected EPERM sequence on Windows semantics; no fairness guarantee'],
  'review.lease-retirement.persistent-unreadable-evidence-typed-held-without-mutation': ['persistent EPERM is conservatively classified as unreadable held evidence'],
  'review.lease-retirement.explicit-local-cli-with-exact-state-root': ['local command line only; exact state root is required and filesystem roots are refused'],
  'review.lease-retirement.no-api-or-browser-retirement-route': ['static source and route assertions; no new rendered surface exists'],
  'review.lease-retirement.clean-product-slice-replay': ['ten selected commands over 590 tracked files; not a full-repository clean archive replay'],
  'review.lease-retirement.zero-execution-adoption-promotion-merge-foundation-or-canon-authority': ['Mike Tobi / AXM remains merge and CANON gate'],
  'review.lease-retirement.specialist-package-lane-not-inspected': ['incoming AXM_MIRROR_SHADOW_SPECIALIST packages excluded by task scope']
};

function inventory(stage) {
  const ready = stage === 'before' ? inheritedReady : implementedReady;
  return {
    schema: 'capability-inventory/v1',
    stage,
    status: 'TEST',
    capabilities: requirements.map(item => {
      const id = item.capabilities[0];
      const available = ready.has(id);
      return {
        id,
        status: available ? 'available' : 'unavailable',
        constraints: available ? (constraints[id] || []) : []
      };
    })
  };
}

function write(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function compare(stage) {
  const output = path.join(__dirname, 'CAPABILITY_GAP_' + stage.toUpperCase() + '.json');
  if (fs.existsSync(output)) fs.unlinkSync(output);
  const result = childProcess.spawnSync('python', [
    COMPARATOR,
    '--requirements', path.join(__dirname, 'CAPABILITY_REQUIREMENTS.json'),
    '--capabilities', path.join(__dirname, 'CAPABILITY_INVENTORY_' + stage.toUpperCase() + '.json'),
    '--output', output
  ], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'capability comparator failed'));
}

write('CAPABILITY_REQUIREMENTS.json', { schema: 'capability-requirements/v1', status: 'TEST', requirements });
write('CAPABILITY_INVENTORY_BEFORE.json', inventory('before'));
write('CAPABILITY_INVENTORY_AFTER.json', inventory('after'));
compare('before');
compare('after');
console.log('PASS capability reports ' + requirements.length + ' requirements via bundled comparator');
