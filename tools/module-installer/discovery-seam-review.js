#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const api = read('shared/operations/operations-api.js');
const service = read('shared/operations/installer-service.js');
const serviceTest = read('shared/operations/selftest.js');
const app = read('tools/module-installer/app.js');
const html = read('tools/module-installer/index.html');
const contract = JSON.parse(read('tools/module-installer/module.contract.json'));
const manifest = JSON.parse(read('tools/module-installer/manifest.json'));

const checks = [
  ['Candidate listing joins Review Inbox state read only', service.includes('reviewsById') && service.includes('governance: governance(')],
  ['Governance view denies apply authority', service.includes('applyAuthority: false')],
  ['Pending review cannot look install eligible', serviceTest.includes("reviewState === 'PENDING'") && serviceTest.includes('!pendingGovernance.installEligible')],
  ['Approved review still lists four independent gates', serviceTest.includes('approvedGovernance.remainingGates.length === 4')],
  ['Digest divergence remains visible and held', serviceTest.includes('!mismatchGovernance.digestMatch') && serviceTest.includes('!mismatchGovernance.installEligible')],
  ['Reading lineage does not mutate either ledger', serviceTest.includes('installer governance listing is read only across candidate and review state')],
  ['GET route only returns candidates and backups', api.includes("url === '/api/installer' && req.method === 'GET'") && api.includes('candidates: installer.list()')],
  ['Apply route retains explicit header and permission gate', api.includes("explicit(req, 'x-axm-installer', 'apply-approved-digest')") && api.includes("requirePermission('module-installer','module.install')")],
  ['Returned ZIP route retains explicit candidate-only staging', api.includes("url === '/api/installer/stage-return'") && api.includes("explicit(req, 'x-axm-installer', 'explicit-return-stage')")],
  ['Return intake refuses stale bases and out-of-scope files', serviceTest.includes('STALE_BUILD_ON_BASE') && serviceTest.includes('outside the exported selection')],
  ['Service rechecks exact approval and typed confirmation', service.includes('exact candidate digest is not approved in Review Inbox') && service.includes("!== 'INSTALL REVIEWED MODULE'")],
  ['Service rechecks staged bytes before tool write', service.includes("decoded.digest !== record.digest") && service.includes('staged candidate no longer matches its approved digest')],
  ['Existing module is backed up before replace', service.indexOf('U.copyTree(target, backup)') < service.indexOf("replaceFromFolder(source, record.moduleId, 'module install')")],
  ['Only one previous generation is retained', service.includes('retainOnlyBackup(record.moduleId, backupId)') && serviceTest.includes('retains exactly one previous generation')],
  ['Post-install failure exposes explicit rollback without auto-rollback', service.includes("machine.run('module-selftest'") && serviceTest.includes('without silently auto-rolling back') && app.includes('data-prepare-rollback')],
  ['UI mirrors both review eligibility and exact typed confirmation', app.includes('governance.installEligible') && app.includes("confirmInstall.value === 'INSTALL REVIEWED MODULE'")],
  ['Authority boundary is visible in plain language', html.includes('Evidence only') && html.includes('Never automatic') && html.includes('Digest rechecked before write')],
  ['Permission handoff selects the exact declared install permission', html.includes('module=module-installer&amp;permission=module.install')],
  ['Browser storage cannot shadow service truth', !/localStorage|sessionStorage/.test(app)],
  ['Contract refuses authority collapse and automation', contract.boundaries.refuses.includes('review-approval-as-install-authority') && contract.boundaries.refuses.includes('automatic-install') && contract.boundaries.refuses.includes('automatic-promotion')],
  ['Installer remains a TEST product behind the human gate', manifest.kind === 'product' && manifest.status === 'TEST']
];

let failed = 0;
checks.forEach(([name, pass]) => {
  console.log((pass ? 'PASS  ' : 'OPEN  ') + name);
  if (!pass) failed += 1;
});
console.log('Module Installer discovery seam review: ' + (failed ? 'OPEN ' + failed : 'PASS - ' + checks.length + ' controls'));
if (failed) process.exit(1);
