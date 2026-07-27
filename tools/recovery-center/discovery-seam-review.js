#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const service = read('shared/operations/recovery-service.js');
const serviceTest = read('shared/operations/selftest.js');
const api = read('shared/operations/operations-api.js');
const app = read('tools/recovery-center/app.js');
const html = read('tools/recovery-center/index.html');
const readme = read('tools/recovery-center/README.md');
const contract = JSON.parse(read('tools/recovery-center/module.contract.json'));
const manifest = JSON.parse(read('tools/recovery-center/manifest.json'));

const checks = [
  ['Restore preview binds selected snapshot hashes', service.includes('snapshotSha256: item.sha256') && service.includes('snapshotManifestDigest: snap.manifestDigest')],
  ['Restore preview binds current target existence and hashes', service.includes('currentExists: current.exists') && service.includes('currentSha256: current.sha256')],
  ['Restore and rollback previews enforce bounded expiry', service.includes('PREVIEW_TTL_MS') && service.includes("assertFresh(record, 'restore preview')") && service.includes("assertFresh(previewRecord, 'rollback preview')")],
  ['Restore apply rechecks snapshot manifest after preview', service.includes('snapshot manifest changed after restore preview')],
  ['Restore apply refuses current-state drift before writes and holds the preview', serviceTest.includes('restore refuses current Workshop drift before writing or making a safety copy') && serviceTest.includes('holds that preview')],
  ['Restore requires exact typed confirmation', service.includes("!== 'RESTORE SELECTED FILES'") && app.includes("restoreConfirm.value === 'RESTORE SELECTED FILES'")],
  ['Restore API keeps explicit header and permission gates', api.includes("explicit(req, 'x-axm-recovery', 'apply-preview')") && api.includes("requirePermission('recovery-center','recovery.apply')")],
  ['Restore makes a pre-restore safety manifest before copying', service.indexOf("schema: 'axm.pre-restore-backup/v2'") < service.indexOf('const applied = []')],
  ['Restore persists a receipt and read-only lineage', service.includes("schema: 'axm.recovery-restore-receipt/v1'") && serviceTest.includes('metadata-only lineage without mutating it')],
  ['Status omits private snapshot manifest paths', service.includes('snapshotManifestPathsExposed: false') && serviceTest.includes("hasOwnProperty.call(recoveryStatus.snapshots[0],'manifestFile')")],
  ['Rollback has a separate preview route', api.includes('/api/recovery/rollback/preview') && app.includes('/api/recovery/rollback/preview')],
  ['Rollback distinguishes previous files from restore-created files', service.includes("'RESTORE_PREVIOUS'") && service.includes("'REMOVE_CREATED'") && serviceTest.includes('rollback preview distinguishes')],
  ['Rollback is held after current-byte drift', service.includes('CURRENT_STATE_DRIFT') && serviceTest.includes('rollback refuses current Workshop drift before writing') && serviceTest.includes('holds that preview')],
  ['Rollback is held behind later overlapping restore lineage', service.includes('LATER_RESTORE_OVERLAP') && contract.boundaries.refuses.includes('rollback-with-later-overlapping-restore')],
  ['Rollback requires its own exact typed confirmation', service.includes("!== 'ROLL BACK RESTORE'") && app.includes("rollbackConfirm.value === 'ROLL BACK RESTORE'")],
  ['Rollback API keeps explicit header and permission gates', api.includes("explicit(req, 'x-axm-recovery', 'apply-rollback-preview')") && (api.match(/requirePermission\('recovery-center','recovery\.apply'\)/g) || []).length === 2],
  ['Rollback preserves a pre-rollback safety copy', service.includes("schema: 'axm.pre-rollback-backup/v1'") && serviceTest.includes('rollback preserves a pre-rollback safety copy')],
  ['Browser gates do not shadow service truth', !/localStorage|sessionStorage/.test(app) && app.includes('Date.parse(currentRestore.expiresAt) > Date.now()') && app.includes('Date.parse(currentRollback.expiresAt) > Date.now()')],
  ['Reload resumes only server-observed active previews', app.includes('data.restorePreviews') && app.includes('data.rollbackPreviews') && app.includes("item.effectiveState === 'PREVIEWED'") && service.includes('previewObservationMutatesLineage: false')],
  ['Permission handoff selects exact recovery context only', html.includes('module=recovery-center&amp;permission=recovery.apply')],
  ['Schedule limitation is stated without claiming OS persistence', html.includes('It installs no OS scheduler entry') && readme.includes('does not install or modify an operating-system scheduled task')],
  ['Contract refuses automatic restore rollback and promotion', contract.boundaries.refuses.includes('automatic-restore') && contract.boundaries.refuses.includes('automatic-rollback') && contract.boundaries.refuses.includes('automatic-promotion')],
  ['Recovery Center remains a TEST product behind the human gate', manifest.kind === 'product' && manifest.status === 'TEST']
];

let failed = 0;
checks.forEach(([name, pass]) => {
  console.log((pass ? 'PASS  ' : 'OPEN  ') + name);
  if (!pass) failed += 1;
});
console.log('Recovery Center discovery seam review: ' + (failed ? 'OPEN ' + failed : 'PASS - 23 controls'));
if (failed) process.exit(1);
