#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const comparator = path.join(String(process.env.USERPROFILE || ''), '.codex', 'skills', 'detect-capability-gaps', 'scripts', 'compare_capabilities.py');
const requirements = [
  ['baseline-two-interruption-windows', true, 'review.retirement-recovery.exact-v44-two-window-reproduction'],
  ['existing-explicit-retirement-preserved', true, 'review.retirement-recovery.v44-explicit-retirement-continuity'],
  ['bounded-directory-observation', true, 'review.retirement-recovery.two-hundred-record-plus-truncation-probe'],
  ['bounded-evidence-file-read', true, 'review.retirement-recovery.sixty-four-kibibyte-per-file-bound'],
  ['closed-typed-recovery-status', true, 'review.retirement-recovery.closed-typed-status-and-records'],
  ['intent-only-exact-resume', true, 'review.retirement-recovery.intent-only-current-owner-digest-resume'],
  ['quarantined-evidence-finalization', true, 'review.retirement-recovery.quarantined-owner-evidence-result-finalization'],
  ['closed-exact-recovery-request', true, 'review.retirement-recovery.action-id-digest-assertion-confirmation-reason-request'],
  ['current-process-refusal', true, 'review.retirement-recovery.current-process-owner-held'],
  ['changed-evidence-refusal', true, 'review.retirement-recovery.changed-current-owner-evidence-held'],
  ['ambiguous-intent-refusal', true, 'review.retirement-recovery.ambiguous-pending-intents-held'],
  ['invalid-resource-evidence-refusal', true, 'review.retirement-recovery.invalid-oversized-nonfile-or-unrecognized-evidence-held'],
  ['quarantined-digest-mismatch-refusal', true, 'review.retirement-recovery.quarantined-owner-digest-mismatch-held'],
  ['semantic-json-validation', true, 'review.retirement-recovery.valid-json-property-order-independence'],
  ['idempotent-complete-observation', true, 'review.retirement-recovery.repeated-exact-recovery-is-idempotent'],
  ['restart-continuity', true, 'review.retirement-recovery.fresh-review-service-mutation-after-resume'],
  ['host-local-cli', true, 'review.retirement-recovery.explicit-local-status-and-recover-cli'],
  ['no-automatic-api-or-browser-route', true, 'review.retirement-recovery.no-automatic-api-or-browser-route'],
  ['schema-contract-index-continuity', true, 'review.retirement-recovery.v09-schema-contract-and-index-continuity'],
  ['clean-product-slice-replay', true, 'review.retirement-recovery.clean-product-slice-replay'],
  ['zero-consequential-authority', true, 'review.retirement-recovery.zero-execution-adoption-promotion-merge-foundation-or-canon-authority'],
  ['specialist-package-lane-excluded', true, 'review.retirement-recovery.specialist-package-lane-not-inspected'],
  ['production-interruption-frequency', false, 'review.retirement-recovery.production-interruption-frequency-proof'],
  ['safe-automatic-stale-recovery', false, 'review.retirement-recovery.safe-automatic-stale-owner-recovery'],
  ['holder-termination-proof', false, 'review.retirement-recovery.holder-termination-or-abandonment-proof'],
  ['recovery-safety-proof', false, 'review.retirement-recovery.recovery-safety-proof'],
  ['cross-file-acid', false, 'review.retirement-recovery.cross-file-acid'],
  ['multi-host-network-filesystem', false, 'review.retirement-recovery.multi-host-or-network-filesystem-safety'],
  ['external-writer-exclusion', false, 'review.retirement-recovery.noncooperating-external-writer-exclusion'],
  ['protected-rollback-resistant-evidence', false, 'review.retirement-recovery.protected-monotonic-storage-and-rollback-prevention'],
  ['identity-human-trusted-time-live-policy', false, 'review.retirement-recovery.real-identity-human-participation-trusted-time-and-live-policy'],
  ['human-benefit-learning-accessibility', false, 'review.retirement-recovery.assistive-technology-human-benefit-or-learning-proof']
].map(([id, required, capability]) => ({ id, required, capabilities:[capability] }));

const inheritedReady = new Set([
  'review.retirement-recovery.exact-v44-two-window-reproduction',
  'review.retirement-recovery.v44-explicit-retirement-continuity',
  'review.retirement-recovery.zero-execution-adoption-promotion-merge-foundation-or-canon-authority',
  'review.retirement-recovery.specialist-package-lane-not-inspected'
]);
const implementedReady = new Set(requirements.filter(item => item.required).flatMap(item => item.capabilities));
const constraints = {
  'review.retirement-recovery.exact-v44-two-window-reproduction':['exact baseline Git blob with deterministic fs interruption injection; production frequency remains unproven'],
  'review.retirement-recovery.v44-explicit-retirement-continuity':['v0.8 exact retirement suites remain passing; the operator assertion is still not authenticated fact'],
  'review.retirement-recovery.two-hundred-record-plus-truncation-probe':['reads at most 201 directory entries to emit at most 200 records and prove truncation'],
  'review.retirement-recovery.sixty-four-kibibyte-per-file-bound':['local intent owner-evidence and result files only'],
  'review.retirement-recovery.closed-typed-status-and-records':['runtime exact-key assertions plus JSON Schema declarations; no independent metaschema-validator claim'],
  'review.retirement-recovery.intent-only-current-owner-digest-resume':['requires unchanged exact lock bytes and a second operator assertion; false assertion risk remains'],
  'review.retirement-recovery.quarantined-owner-evidence-result-finalization':['writes a missing ordinary retirement result only after exact intent and evidence digest checks'],
  'review.retirement-recovery.action-id-digest-assertion-confirmation-reason-request':['closed local request; no authenticated operator identity'],
  'review.retirement-recovery.current-process-owner-held':['actual process.pid or same-instance owner only; no general liveness inference'],
  'review.retirement-recovery.changed-current-owner-evidence-held':['single-host local path evidence; noncooperating writer races remain outside the contract'],
  'review.retirement-recovery.ambiguous-pending-intents-held':['same-owner competing intent-only records are not selected automatically'],
  'review.retirement-recovery.invalid-oversized-nonfile-or-unrecognized-evidence-held':['bounded local file inspection rejects symlink/non-file evidence without traversal'],
  'review.retirement-recovery.quarantined-owner-digest-mismatch-held':['digest mismatch blocks result finalization'],
  'review.retirement-recovery.valid-json-property-order-independence':['semantic exact scalar truth validation, not raw JSON property order'],
  'review.retirement-recovery.repeated-exact-recovery-is-idempotent':['complete evidence returns ALREADY_COMPLETE and writes no extra file'],
  'review.retirement-recovery.fresh-review-service-mutation-after-resume':['synthetic new service instance; no live production recovery claim'],
  'review.retirement-recovery.explicit-local-status-and-recover-cli':['exact non-root state path required; local CLI only'],
  'review.retirement-recovery.no-automatic-api-or-browser-route':['static API/browser counterchecks and contract refusals; no new rendered surface'],
  'review.retirement-recovery.v09-schema-contract-and-index-continuity':['Review Inbox remains TEST and structurally current; promotion remains BLOCKED on stale aggregate receipt'],
  'review.retirement-recovery.clean-product-slice-replay':['eleven selected commands over 594 tracked files; not a full-repository clean archive replay'],
  'review.retirement-recovery.zero-execution-adoption-promotion-merge-foundation-or-canon-authority':['Mike Tobi / AXM remains merge and CANON gate'],
  'review.retirement-recovery.specialist-package-lane-not-inspected':['incoming AXM_MIRROR_SHADOW_SPECIALIST packages excluded by task scope']
};

function inventory(stage) {
  const ready = stage === 'before' ? inheritedReady : implementedReady;
  return {
    schema:'capability-inventory/v1', stage, status:'TEST',
    capabilities:requirements.map(item => {
      const id = item.capabilities[0], available = ready.has(id);
      return { id, status:available ? 'available' : 'unavailable', constraints:available ? (constraints[id] || []) : [] };
    })
  };
}
function write(name, value) { fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function compare(stage) {
  const output = path.join(__dirname, 'CAPABILITY_GAP_' + stage.toUpperCase() + '.json');
  if (fs.existsSync(output)) fs.unlinkSync(output);
  const result = childProcess.spawnSync('python', [
    comparator,
    '--requirements', path.join(__dirname, 'CAPABILITY_REQUIREMENTS.json'),
    '--capabilities', path.join(__dirname, 'CAPABILITY_INVENTORY_' + stage.toUpperCase() + '.json'),
    '--output', output
  ], { encoding:'utf8', windowsHide:true, timeout:30000 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'capability comparator failed'));
}

write('CAPABILITY_REQUIREMENTS.json', { schema:'capability-requirements/v1', status:'TEST', requirements });
write('CAPABILITY_INVENTORY_BEFORE.json', inventory('before'));
write('CAPABILITY_INVENTORY_AFTER.json', inventory('after'));
compare('before');
compare('after');
console.log('PASS capability reports ' + requirements.length + ' requirements via bundled comparator');
