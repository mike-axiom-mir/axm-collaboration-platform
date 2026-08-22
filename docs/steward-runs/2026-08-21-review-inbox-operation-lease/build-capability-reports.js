#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const requirements = [
  ['baseline-lost-update-reproduction', true, 'review.operation-lease.baseline-lost-update-reproduced'],
  ['single-host-review-mutation-serialization', true, 'review.operation-lease.cooperating-single-host-review-mutation-serialization'],
  ['all-review-mutation-paths-share-lease', true, 'review.operation-lease.all-review-mutation-paths-share-one-lease'],
  ['active-contention-fails-closed', true, 'review.operation-lease.active-contention-typed-busy-without-mutation'],
  ['crash-or-invalid-evidence-stays-held', true, 'review.operation-lease.crash-invalid-or-altered-evidence-held-without-theft'],
  ['authority-operation-scope', true, 'review.operation-lease.authority-envelope-intent-and-projection-share-one-lease'],
  ['read-only-status-no-browser-unlock', true, 'review.operation-lease.read-only-status-and-no-browser-unlock'],
  ['bounded-runtime-and-schema-contracts', true, 'review.operation-lease.bounded-runtime-and-closed-schema-contracts'],
  ['concurrency-and-crash-verification', true, 'review.operation-lease.eight-process-concurrency-and-crash-verification'],
  ['clean-slice-inherited-continuity', true, 'review.operation-lease.clean-product-slice-inherited-review-continuity'],
  ['zero-consequential-authority', true, 'review.operation-lease.zero-execution-adoption-promotion-merge-foundation-or-canon-authority'],
  ['specialist-package-lane-excluded', true, 'review.operation-lease.specialist-package-lane-not-inspected'],
  ['cross-file-acid', false, 'review.operation-lease.cross-file-acid'],
  ['multi-host-network-filesystem', false, 'review.operation-lease.multi-host-or-network-filesystem-safety'],
  ['external-writer-exclusion', false, 'review.operation-lease.noncooperating-external-writer-exclusion'],
  ['safe-stale-owner-recovery', false, 'review.operation-lease.automatic-safe-stale-owner-recovery'],
  ['rollback-resistant-storage', false, 'review.operation-lease.protected-monotonic-storage-and-rollback-prevention'],
  ['identity-human-trusted-time', false, 'review.operation-lease.real-world-identity-human-participation-and-trusted-time'],
  ['live-host-policy-and-signed-review', false, 'review.operation-lease.actual-live-host-policy-and-signed-review'],
  ['human-benefit-learning-accessibility', false, 'review.operation-lease.assistive-technology-human-benefit-or-learning-proof']
].map(([id, required, capability]) => ({ id, required, capabilities:[capability] }));

const inheritedReady = new Set([
  'review.operation-lease.baseline-lost-update-reproduced',
  'review.operation-lease.zero-execution-adoption-promotion-merge-foundation-or-canon-authority',
  'review.operation-lease.specialist-package-lane-not-inspected'
]);
const implementedReady = new Set(requirements.filter(item => item.required).flatMap(item => item.capabilities));
const constraints = {
  'review.operation-lease.baseline-lost-update-reproduced':['deterministic barrier reproduction executes exact v4.2 ReviewService source with loader substitution only; production frequency remains unproven'],
  'review.operation-lease.cooperating-single-host-review-mutation-serialization':['fixed local filesystem lock; cooperating callers on one host only'],
  'review.operation-lease.all-review-mutation-paths-share-one-lease':['ordinary and signed Review Inbox service paths only'],
  'review.operation-lease.active-contention-typed-busy-without-mutation':['bounded wait using a monotonic process clock; no fairness guarantee'],
  'review.operation-lease.crash-invalid-or-altered-evidence-held-without-theft':['no process-liveness inference and no automatic stale-owner theft'],
  'review.operation-lease.authority-envelope-intent-and-projection-share-one-lease':['single-host serialization is not cross-file atomicity'],
  'review.operation-lease.read-only-status-and-no-browser-unlock':['GET observation and UI evidence; operator repair remains outside this browser surface'],
  'review.operation-lease.bounded-runtime-and-closed-schema-contracts':['runtime exact-key tests plus JSON schemas; no independent metaschema-validator claim'],
  'review.operation-lease.eight-process-concurrency-and-crash-verification':['eight synchronized child processes plus bounded active-holder and crash-residue fixtures'],
  'review.operation-lease.clean-product-slice-inherited-review-continuity':['nine selected review commands in a 583-file archive slice; not a full-repository archive replay'],
  'review.operation-lease.zero-execution-adoption-promotion-merge-foundation-or-canon-authority':['Mike Tobi / AXM remains merge and CANON gate'],
  'review.operation-lease.specialist-package-lane-not-inspected':['incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP packages excluded by scope']
};

function inventory(stage) {
  const ready = stage === 'before' ? inheritedReady : implementedReady;
  return {
    schema:'capability-inventory/v1', stage, status:'TEST',
    capabilities:requirements.map(item => {
      const id = item.capabilities[0], available = ready.has(id);
      return { id, state:available ? 'READY' : 'MISSING', available, constraints:available ? (constraints[id] || []) : [] };
    })
  };
}

function gapReport(stage, inv) {
  const states = new Map(inv.capabilities.map(item => [item.id, item]));
  const rows = requirements.map(item => {
    const ready = item.capabilities.filter(id => states.get(id).available);
    const missing = item.capabilities.filter(id => !states.get(id).available);
    return {
      id:item.id, required:item.required,
      status:missing.length === 0 ? 'READY' : item.required ? 'MISSING' : 'OPTIONAL_GAP',
      available:ready, degraded:[], unknown:[], missing,
      declaredConstraints:Object.fromEntries(ready.map(id => [id, states.get(id).constraints]))
    };
  });
  const missingCapabilities = rows.flatMap(item => item.missing).sort();
  return {
    schema:'capability-gap-report/v1', stage,
    overall:rows.some(item => item.required && item.status !== 'READY') ? 'MISSING' : missingCapabilities.length ? 'DEGRADED' : 'READY',
    requirements:rows, missingCapabilities,
    proposedHands:[],
    proposedHandsBoundary:'No hand was built or proposed in this bounded milestone; optional gaps require separate contracts and authority.'
  };
}

function write(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

write('CAPABILITY_REQUIREMENTS.json', { schema:'capability-requirements/v1', status:'TEST', requirements });
const before = inventory('before'), after = inventory('after');
write('CAPABILITY_INVENTORY_BEFORE.json', before);
write('CAPABILITY_INVENTORY_AFTER.json', after);
write('CAPABILITY_GAP_BEFORE.json', gapReport('before', before));
write('CAPABILITY_GAP_AFTER.json', gapReport('after', after));
console.log('PASS capability reports ' + requirements.length + ' requirements');
