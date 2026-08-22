#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const U = require('./operations-utils');
const Review = require('./review-service');
const Permissions = require('./permission-service');
const Secrets = require('./secrets-service');
const Machine = require('./machine-host');
const Installer = require('./installer-service');
const Workbench = require('./module-workbench-service');
const Recovery = require('./recovery-service');
const Search = require('./search-service');
const Assets = require('./asset-filesystem-service');
const Device = require('./device-handoff-service');
const Diagnostics = require('./diagnostics-service');
const EvidenceRetention = require('../evidence-retention/evidence-retention-service');

let pass = 0;
function check(value, label) { assert(value, label); pass += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); pass += 1; console.log('PASS ' + label); }
function json(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
async function waitForJob(machine, id) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const job = machine.get(id);
    if (job && job.state !== 'RUNNING') return job;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('machine job did not finish: ' + id);
}
function contract(id, version) { return { schema:'axm.module-contract/v1', id, version, provides:['test'], consumes:[], permissions:[], handoffs:{ emits:[], accepts:[] }, boundaries:{ writes:[], refuses:['fake-done'] }, lifecycle:{ state_owner:'browser', reload:'resume', disconnect:'graceful-degrade', cleanup:'explicit' } }; }
function bundle(id, version, body, selftestContent) {
  const manifest = { id, name:'Temporary Test Module', version, status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['storage'], permissions:[] };
  return { schema:'axm.module-bundle/v1', files:[
    { path:'manifest.json', content:JSON.stringify(manifest) },
    { path:'module.contract.json', content:JSON.stringify(contract(id, version)) },
    { path:'index.html', content:'<!doctype html><title>Test</title><main>'+body+'</main>' },
    { path:'selftest.js', content:selftestContent || "console.log('PASS temp')" }
  ] };
}

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-operations-selftest-'));
  try {
    const root = path.join(temp, 'workshop'), stateRoot = path.join(root, 'state'), exportRoot = path.join(root, 'exports'), logRoot = path.join(root, 'logs'), backupRoot = path.join(root, 'backups');
    ['tools','shared','hub','launcher','docs','projects','prompts','assets','worlds','mobile','museum','pocket','skins','state','exports','logs','backups'].forEach(name => fs.mkdirSync(path.join(root, name), { recursive:true }));
    fs.writeFileSync(path.join(root, 'README.md'), 'current workshop source\n');
    fs.writeFileSync(path.join(root, 'docs', 'guide.md'), '# Provenance Needle\nsearchable source evidence\n');

    const review = Review.create({ stateRoot });
    const digest = U.sha256(Buffer.from('artifact-one'));
    const item = review.submit({ kind:'test', title:'Exact review', sourceRef:'test:one', artifactDigest:digest, requiredSeats:2 });
    throws(() => review.vote(item.id, { actor:'Mike', verdict:'APPROVE', artifactDigest:U.sha256(Buffer.from('changed')) }), /digest/, 'review rejects vote for changed artifact');
    review.vote(item.id, { actor:'Mike', actorKind:'human', verdict:'APPROVE', artifactDigest:digest });
    check(review.get(item.id).state === 'PENDING', 'one identity cannot fill two review seats');
    review.vote(item.id, { actor:'Mirror', actorKind:'machine', verdict:'APPROVE', artifactDigest:digest });
    check(review.approved(item.id, digest), 'independent exact-digest seats approve artifact');
    const codeDigest = U.sha256(Buffer.from('technical-code-candidate'));
    const codeDraft = review.submit({ kind:'code-improvement-draft', title:'Technical code draft', sourceRef:'mirror-code-clone:test:bounded-repair', artifactDigest:codeDigest, requiredSeats:2 });
    throws(() => review.vote(codeDraft.id, { actor:'Mike', actorKind:'human', verdict:'APPROVE', artifactDigest:codeDigest, informedExplanation:true }), /machine review/, 'technical code draft refuses an uninformed human-first vote');
    throws(() => review.vote(codeDraft.id, { actor:'Pretend machine', actorKind:'machine', verdict:'APPROVE', artifactDigest:codeDigest, note:'Caller supplied machine identity.' }), /deterministic technical reviewer/, 'code draft refuses a caller-supplied machine identity');
    review.recordTechnicalReview(codeDraft.id, { schema:'axm.code-draft-technical-review/v1', artifactDigest:codeDigest, verdict:'APPROVE', summary:'Exact candidate, bounded verifier and remaining risks were checked deterministically.', checks:[{ id:'fixture-integrity', status:'PASS', evidence:'Selftest fixture digest matched.' }], automaticApply:false });
    throws(() => review.vote(codeDraft.id, { actor:'Mike', actorKind:'human', verdict:'APPROVE', artifactDigest:codeDigest }), /explanation acknowledgement/, 'technical code draft requires plain-language acknowledgement after machine review');
    review.vote(codeDraft.id, { actor:'Mike', actorKind:'human', verdict:'APPROVE', artifactDigest:codeDigest, note:'Plain explanation and machine reason reviewed.', informedExplanation:true });
    check(review.approved(codeDraft.id, codeDigest), 'technical-first informed human review can approve the exact candidate');
    const heldDigest = U.sha256(Buffer.from('held-code-candidate'));
    const heldDraft = review.submit({ kind:'code-improvement-draft', title:'Machine-held draft', sourceRef:'mirror-code-clone:test:held', artifactDigest:heldDigest, requiredSeats:2 });
    review.recordTechnicalReview(heldDraft.id, { schema:'axm.code-draft-technical-review/v1', artifactDigest:heldDigest, verdict:'HOLD', summary:'The bounded contract still fails, so this exact candidate needs repair before any human choice.', checks:[{ id:'bounded-contract', status:'HOLD', evidence:'Fixture contract is incomplete.' }], automaticApply:false });
    throws(() => review.vote(heldDraft.id, { actor:'Mike', actorKind:'human', verdict:'REJECT', artifactDigest:heldDigest, note:'No useful vote while repair is required.', informedExplanation:true }), /machine HOLD must be repaired/, 'machine-held code draft refuses an unnecessary human vote');
    check(review.get(heldDraft.id).votes.length === 1 && review.get(heldDraft.id).state === 'HOLD', 'machine HOLD preserves only the technical seat and repair state');
    const staleDigest = U.sha256(Buffer.from('stale-code-candidate'));
    const staleDraft = review.submit({ kind:'code-improvement-draft', title:'Stale exact draft', sourceRef:'mirror-code-clone:test:stale', artifactDigest:staleDigest, requiredSeats:2 });
    throws(() => review.recordTechnicalRefusal(staleDraft.id, { schema:'axm.code-draft-technical-refusal/v1', artifactDigest:staleDigest, reasonCode:'OPINION', summary:'This is not deterministic evidence and must be refused.', replacementRequired:true, automaticApply:false, applyAuthority:'NONE' }), /not deterministic/, 'technical retirement refuses subjective reasons');
    review.recordTechnicalRefusal(staleDraft.id, { schema:'axm.code-draft-technical-refusal/v1', artifactDigest:staleDigest, reasonCode:'SOURCE_DRIFT', summary:'The live source changed after this exact candidate was sealed, so a fresh candidate is required.', replacementRequired:true, automaticApply:false, applyAuthority:'NONE' });
    const staleRecorded = review.get(staleDraft.id);
    check(staleRecorded.state === 'SUPERSEDED' && staleRecorded.votes.length === 0 && staleRecorded.technicalRefusal.reasonCode === 'SOURCE_DRIFT', 'deterministic stale-copy retirement preserves history without creating a vote');
    throws(() => review.vote(staleDraft.id, { actor:'Mike', actorKind:'human', verdict:'APPROVE', artifactDigest:staleDigest, informedExplanation:true }), /closed/, 'retired exact candidate cannot receive a later vote');
    check(EvidenceRetention.tailForFile(review.auditFile, 20000).includes('deterministic-technical-refusal'), 'technical retirement leaves an append-only audit event');
    const panelDigest = U.sha256(Buffer.from('panel-direction'));
    const panel = review.submit({ kind:'workshop-direction', title:'Ten-seat review', sourceRef:'workshop-direction:test', artifactDigest:panelDigest, requiredSeats:99 });
    check(panel.requiredSeats === 10, 'review panel is bounded to ten independent votes');
    review.vote(panel.id, { actor:'Mike', actorKind:'human', verdict:'REJECT', artifactDigest:panelDigest, note:'Needs a safer plan.' });
    review.discuss(panel.id, { actor:'Mirror', actorKind:'machine', body:'The rejected digest should be repaired, not silently reopened.' });
    review.route(panel.id, { actor:'Mike', actorKind:'human', outcome:'REPAIR', reason:'Return it with explicit bounds.' });
    check(review.get(panel.id).state === 'REPAIR' && review.get(panel.id).discussion.length === 2, 'rejected review keeps discussion and routes to repair');
    throws(() => review.submit({ kind:'workshop-direction', title:'Same digest', sourceRef:'workshop-direction:test', artifactDigest:panelDigest, requiredSeats:2 }), /changed plan digest/, 'repair cannot reopen the same exact digest');
    const repaired = review.submit({ kind:'workshop-direction', title:'Changed repair', sourceRef:'workshop-direction:test', artifactDigest:U.sha256(Buffer.from('changed-panel-direction')), requiredSeats:3 });
    check(repaired.requiredSeats === 3 && review.get(panel.id).state === 'SUPERSEDED', 'changed repair digest opens a fresh review and preserves superseded history');

    const opsManifests = [
      { id:'machine-host', name:'Machine Host', version:'v0.1', status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['storage','machine.execute'], permissions:['machine.execute'] },
      { id:'module-installer', name:'Installer', version:'v0.1', status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['module.install'], permissions:['module.install'] },
      { id:'recovery-center', name:'Recovery', version:'v0.1', status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['recovery.apply'], permissions:['recovery.apply'] },
      { id:'device-handoff', name:'Device Handoff', version:'v0.1', status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['device.listen'], permissions:['device.listen'] }
    ];
    for (const manifest of opsManifests) { const dir=path.join(root,'tools',manifest.id);fs.mkdirSync(dir,{recursive:true});json(path.join(dir,'manifest.json'),manifest);json(path.join(dir,'module.contract.json'),contract(manifest.id,manifest.version));fs.writeFileSync(path.join(dir,'index.html'),'<main>'+manifest.name+'</main>');fs.writeFileSync(path.join(dir,'selftest.js'),"console.log('PASS')"); }
    const permissions = Permissions.create({ root, stateRoot });
    const machinePermissionCatalog = permissions.catalog().find(item => item.moduleId === 'machine-host');
    check(machinePermissionCatalog.permissions.includes('machine.execute') && machinePermissionCatalog.dependencies.includes('storage') && !machinePermissionCatalog.permissions.includes('storage'), 'manifest dependencies stay visibly separate from grantable permissions');
    throws(() => permissions.setGrant({ moduleId:'machine-host', permission:'storage', allowed:true, reason:'dependency is not authority' }), /not declared/, 'dependency-only capability cannot be granted as permission');
    throws(() => permissions.setGrant({ moduleId:'machine-host', permission:'machine.execute', allowed:true }), /reason is required/, 'permission decision requires an attributed reason');
    throws(() => permissions.setGrant({ moduleId:'machine-host', permission:'machine.execute', allowed:true, reason:'bad expiry test', expiresAt:'not-a-time' }), /expiry is invalid/, 'invalid permission expiry is refused');
    permissions.setGrant({ moduleId:'machine-host', permission:'machine.execute', allowed:true, reason:'Run the bounded verifier action.', actor:'Mike' });
    check(permissions.allowed('machine-host','machine.execute'), 'declared permission grant becomes active');
    throws(() => permissions.setGrant({ moduleId:'machine-host', permission:'arbitrary.shell', allowed:true, reason:'negative test' }), /not declared/, 'undeclared permission cannot be granted');
    const permissionBytes = fs.readFileSync(permissions.stateFile), permissionStatus = permissions.status();
    check(permissionStatus.dependenciesArePermissions === false && permissionStatus.defaultDecision === 'DENY' && permissionStatus.summary.allowed === 1, 'permission status exposes deny-by-default effective state');
    check(permissionBytes.equals(fs.readFileSync(permissions.stateFile)), 'permission status observation does not mutate the decision ledger');
    permissions.setGrant({ moduleId:'machine-host', permission:'machine.execute', allowed:false, reason:'Bounded execution window ended.', actor:'Mike' });
    check(!permissions.allowed('machine-host','machine.execute') && permissions.decision('machine-host','machine.execute').state === 'DENIED', 'explicit denial removes effective permission');

    const secrets = Secrets.create({ stateRoot, unlockTtlMs:60000 });
    secrets.initialize('correct horse battery staple', 'Mike');
    throws(() => secrets.upsert({ id:'bad-expiry', value:'never-stored', scopes:['machine-host'], expiresAt:'not-a-time' }), /expiry is invalid/, 'invalid secret expiry is refused before storage');
    throws(() => secrets.upsert({ id:'bad-scope', value:'never-stored', scopes:['not a module'] }), /consumer scope/, 'secret scope must use a bounded consumer id');
    secrets.upsert({ id:'test-key', label:'Test key', value:'super-secret-value', scopes:['machine-host'], actor:'Mike' });
    const secretStatus = secrets.status();
    check(secretStatus.records[0].fingerprint && secretStatus.records[0].state === 'ACTIVE' && !JSON.stringify(secretStatus).includes('super-secret-value'), 'secret status exposes effective metadata but not value');
    check(Secrets.secretState({ revoked:false, expiresAt:'2000-01-01T00:00:00.000Z' }, Date.now()) === 'EXPIRED' && Secrets.secretState({ revoked:true }, Date.now()) === 'REVOKED', 'secret metadata distinguishes expired and revoked states');
    check(secrets.readSecret('test-key','machine-host') === 'super-secret-value', 'matching internal consumer scope reads unlocked secret');
    throws(() => secrets.readSecret('test-key','other-module'), /refused/, 'unscoped secret consumer is refused');
    secrets.lock(); throws(() => secrets.readSecret('test-key','machine-host'), /locked/, 'locked vault clears secret access');

    const machine = Machine.create({ root, stateRoot });
    check(machine.resolveAction('verify',{}).args[0] === path.join(root,'verify.js'), 'machine host resolves fixed verify entrypoint');
    check(machine.resolveAction('module-selftest',{moduleId:'machine-host'}).moduleId === 'machine-host', 'module selftest resolves only inside tools');
    throws(() => machine.resolveAction('shell',{command:'whoami'}), /not allowlisted/, 'arbitrary machine action is refused');

    const installer = Installer.create({ root, stateRoot, backupRoot, reviewService:review, machineHost:machine });
    const first = installer.stage(bundle('test-module','v0.1','first'), 'Mike');
    const pendingGovernance = installer.list().find(item => item.id === first.id).governance;
    check(pendingGovernance.reviewState === 'PENDING' && pendingGovernance.digestMatch && !pendingGovernance.installEligible && pendingGovernance.applyAuthority === false, 'installer exposes pending exact-digest lineage without granting apply authority');
    review.vote(first.reviewId, { actor:'Mike', verdict:'APPROVE', artifactDigest:first.digest });
    const approvedGovernance = installer.list().find(item => item.id === first.id).governance;
    check(approvedGovernance.reviewState === 'APPROVED' && approvedGovernance.exactDigestApproved && approvedGovernance.installEligible && approvedGovernance.remainingGates.length === 4, 'approved digest remains visibly gated by permission confirmation recheck and backup');
    const firstApplied = installer.apply(first.id, { confirmation:'INSTALL REVIEWED MODULE', actor:'Mike' });
    check((await waitForJob(machine, firstApplied.verificationJobId)).state === 'PASS', 'post-install module selftest runs through the allowlisted machine host');
    const firstVerification = installer.list().find(item => item.id === first.id).verification;
    check(firstVerification.currentDigestState === 'MATCH' && firstVerification.receiptAppliesToCurrentModule && firstVerification.candidateDigest === firstVerification.currentModuleDigest, 'post-install receipt is bound to the exact current module digest');
    check(!installer.list().find(item => item.id === first.id).governance.installEligible, 'applied candidate cannot remain install eligible');
    check(fs.readFileSync(path.join(root,'tools','test-module','index.html'),'utf8').includes('first'), 'approved new module installs into exact module folder');
    const freshFailure = installer.stage(bundle('fresh-failure-module','v0.1','fresh failure',"console.error('FAIL intentional fresh install test'); process.exitCode=1;\n"), 'Mike');
    review.vote(freshFailure.reviewId, { actor:'Mike', verdict:'APPROVE', artifactDigest:freshFailure.digest });
    const freshFailureApplied = installer.apply(freshFailure.id, { confirmation:'INSTALL REVIEWED MODULE', actor:'Mike' });
    const freshFailureJob = await waitForJob(machine, freshFailureApplied.verificationJobId), freshFailureView = installer.list().find(item => item.id === freshFailure.id).verification;
    check(freshFailureJob.state === 'FAIL' && freshFailureView.currentDigestState === 'MATCH' && freshFailureView.receiptAppliesToCurrentModule && !freshFailureView.rollbackBackupRetained && !freshFailureView.rollbackAvailable && /no retained previous generation/.test(freshFailureView.truth) && !/can be rolled back/.test(freshFailureView.truth), 'failed first install does not claim a nonexistent rollback generation');
    const returnTop = path.join(temp, 'return-source'), returnModule = path.join(returnTop, 'tools', 'test-module');
    U.copyTree(path.join(root, 'tools', 'test-module'), returnModule);
    fs.writeFileSync(path.join(returnTop, 'BUILD_ON_GUIDE.md'), '# Test build-on return\n');
    const baseFiles = U.walk(returnTop, { maxFiles:320, maxBytes:30*1024*1024 }).files.map(file => ({ path:file.relative, bytes:file.bytes, sha256:U.fileSha256(file.absolute) }));
    const handoffManifest = { schema:'axm.workshop-package/v1', mode:'module', package_kind:'workshop-modular-slice', created_at:U.now(), collaboration:{ schema:'axm.build-on-handoff/v1', export_id:'axm-workshop-module-selftest-12345678', role:'current-local-build-on-source', intended_return_schema:'axm.workshop-package-return/v1' }, selection:{ scopes:['tools/test-module'], paths_preserved:true, dependency_closure:'explicit-selection-only' }, files:baseFiles };
    const unmarkedManifest = JSON.parse(JSON.stringify(handoffManifest)); delete unmarkedManifest.collaboration; json(path.join(returnTop, 'PACKAGE_MANIFEST.json'), unmarkedManifest);
    const ordinaryModuleZip = path.join(temp, 'ordinary-module.zip'); U.zipDirectory(returnTop, ordinaryModuleZip, { maxFiles:320, maxBytes:30*1024*1024 });
    throws(() => installer.stageReturnedZip({ schema:'axm.workshop-package-return/v1', archiveBase64:fs.readFileSync(ordinaryModuleZip).toString('base64') }, 'Mike'), /not marked as a current build-on handoff/, 'ordinary modular archive is not silently treated as a tracked improvement return');
    json(path.join(returnTop, 'PACKAGE_MANIFEST.json'), handoffManifest);
    const returnedManifest = JSON.parse(fs.readFileSync(path.join(returnModule, 'manifest.json'), 'utf8')); returnedManifest.version = 'v0.2'; json(path.join(returnModule, 'manifest.json'), returnedManifest);
    const returnedContract = JSON.parse(fs.readFileSync(path.join(returnModule, 'module.contract.json'), 'utf8')); returnedContract.version = 'v0.2'; json(path.join(returnModule, 'module.contract.json'), returnedContract);
    const improvedHtml = '<!doctype html><title>Test</title><main>second</main>'; fs.writeFileSync(path.join(returnModule, 'index.html'), improvedHtml);
    fs.writeFileSync(path.join(returnModule, 'selftest.js'), "console.error('FAIL intentional return test'); process.exitCode=1;\n");
    fs.writeFileSync(path.join(returnTop, 'outside.txt'), 'not selected'); const unsafeReturnZip = path.join(temp, 'returned-build-on-unsafe.zip'); U.zipDirectory(returnTop, unsafeReturnZip, { maxFiles:320, maxBytes:30*1024*1024 });
    throws(() => installer.stageReturnedZip({ schema:'axm.workshop-package-return/v1', archiveBase64:fs.readFileSync(unsafeReturnZip).toString('base64') }, 'Mike'), /outside its exported scopes/, 'returned ZIP refuses files added outside the exported selection');
    fs.rmSync(path.join(returnTop, 'outside.txt'));
    const returnedZip = path.join(temp, 'returned-build-on.zip'); U.zipDirectory(returnTop, returnedZip, { maxFiles:320, maxBytes:30*1024*1024 });
    const returnInput = { schema:'axm.workshop-package-return/v1', archiveBase64:fs.readFileSync(returnedZip).toString('base64') };
    const second = installer.stageReturnedZip(returnInput, 'Mike');
    check(second.intake.baseBinding === 'EXACT_MATCH' && second.intake.changes.modified.includes('tools/test-module/index.html'), 'returned ZIP stages only after exact exported-base comparison with a visible change ledger');
    review.vote(second.reviewId, { actor:'Mike', verdict:'APPROVE', artifactDigest:second.digest });
    const legacyBackup = path.join(backupRoot, 'module-installer', 'test-module', 'backup-legacy'); fs.mkdirSync(legacyBackup, { recursive:true }); fs.writeFileSync(path.join(legacyBackup, 'old.txt'), 'legacy');
    const updated = installer.apply(second.id, { confirmation:'INSTALL REVIEWED MODULE', actor:'Mike' });
    check(updated.backupId && updated.backupRetentionRemoved === 1 && installer.backups('test-module').length === 1 && fs.readFileSync(path.join(root,'tools','test-module','index.html'),'utf8').includes('second'), 'approved update retains exactly one previous generation before replace');
    const failedVerification = await waitForJob(machine, updated.verificationJobId), failedView = installer.list().find(item => item.id === second.id).verification;
    check(failedVerification.state === 'FAIL' && failedView.state === 'FAIL' && failedView.currentDigestState === 'MATCH' && failedView.receiptAppliesToCurrentModule && failedView.rollbackBackupRetained && failedView.rollbackAvailable && fs.readFileSync(path.join(root,'tools','test-module','index.html'),'utf8') === improvedHtml, 'failed post-install selftest exposes direct rollback only for its exact current digest without silently auto-rolling back');
    throws(() => installer.stageReturnedZip(returnInput, 'Mike'), /STALE_BUILD_ON_BASE/, 'an older build-on ZIP is refused after the live module changes');
    fs.appendFileSync(path.join(root,'tools','test-module','index.html'), '\nmanual drift');
    const driftedVerification = installer.list().find(item => item.id === second.id).verification;
    check(driftedVerification.currentDigestState === 'DRIFT' && !driftedVerification.receiptAppliesToCurrentModule && driftedVerification.rollbackBackupRetained && !driftedVerification.rollbackAvailable && /Historical selftest receipt only/.test(driftedVerification.truth) && /current verification is UNKNOWN/.test(driftedVerification.truth), 'current module drift makes the stored receipt historical and disables direct rollback eligibility');
    throws(() => installer.rollback('test-module', updated.backupId, { confirmation:'ROLL BACK MODULE', actor:'Mike' }), /current module changed/, 'direct rollback refuses live bytes that drifted after install');
    fs.writeFileSync(path.join(root,'tools','test-module','index.html'), improvedHtml);
    installer.rollback('test-module', updated.backupId, { confirmation:'ROLL BACK MODULE', actor:'Mike' });
    check(fs.readFileSync(path.join(root,'tools','test-module','index.html'),'utf8').includes('first'), 'module rollback restores previous installed body');
    const mismatch = installer.stage(bundle('mismatch-module','v0.1','mismatch'), 'Mike'), reviewState = JSON.parse(fs.readFileSync(review.stateFile, 'utf8'));
    reviewState.items.find(item => item.id === mismatch.reviewId).artifactDigest = 'f'.repeat(64); json(review.stateFile, reviewState);
    const candidateBeforeList = fs.readFileSync(installer.indexFile), reviewBeforeList = fs.readFileSync(review.stateFile), mismatchGovernance = installer.list().find(item => item.id === mismatch.id).governance;
    check(!mismatchGovernance.digestMatch && !mismatchGovernance.installEligible && /does not match/.test(mismatchGovernance.holdReason), 'digest divergence is visible and cannot become install eligible');
    check(candidateBeforeList.equals(fs.readFileSync(installer.indexFile)) && reviewBeforeList.equals(fs.readFileSync(review.stateFile)), 'installer governance listing is read only across candidate and review state');

    const workbench = Workbench.create({ root, installerService:installer });
    const loaded = workbench.readModule('test-module');
    check(loaded.manifest.version === 'v0.1' && workbench.validate({ manifest:loaded.manifest, contract:loaded.contract }).pass, 'workbench reads and validates installed manifest-contract pair');

    const packageDir = path.join(exportRoot,'workshop-packages','axm-workshop-full-test-123'), snapshotReadme='snapshot workshop source\n', snapshotCreated='created by snapshot\n'; fs.mkdirSync(packageDir,{recursive:true}); fs.writeFileSync(path.join(packageDir,'README.md'),snapshotReadme); fs.writeFileSync(path.join(packageDir,'created.txt'),snapshotCreated);
    const snapshotHash=U.fileSha256(path.join(packageDir,'README.md')),createdHash=U.fileSha256(path.join(packageDir,'created.txt')); json(path.join(packageDir,'PACKAGE_MANIFEST.json'),{schema:'axm.workshop-package/v1',mode:'full',created_at:U.now(),file_count:2,total_bytes:Buffer.byteLength(snapshotReadme)+Buffer.byteLength(snapshotCreated),files:[{path:'README.md',bytes:Buffer.byteLength(snapshotReadme),sha256:snapshotHash},{path:'created.txt',bytes:Buffer.byteLength(snapshotCreated),sha256:createdHash}]}); json(path.join(exportRoot,'workshop-packages','axm-workshop-full-test-123.RESTORE_TEST.json'),{ok:true});
    const packager={outputDir:path.join(exportRoot,'workshop-packages'),isActive:()=>false,create:()=>Promise.reject(new Error('not used'))};
    const recovery=Recovery.create({root,stateRoot,backupRoot,packager}); const restorePreview=recovery.preview('axm-workshop-full-test-123',['README.md','created.txt'],'Mike');
    check(restorePreview.schema==='axm.restore-preview/v2'&&restorePreview.changes.find(x=>x.path==='README.md').change==='REPLACE'&&restorePreview.changes.find(x=>x.path==='created.txt').change==='CREATE'&&Date.parse(restorePreview.expiresAt)>Date.now(),'recovery preview binds snapshot and current target states with an expiry');
    fs.writeFileSync(path.join(root,'README.md'),'changed after preview\n');
    throws(()=>recovery.apply(restorePreview.id,{confirmation:'RESTORE SELECTED FILES',actor:'Mike'}),/Workshop changed after restore preview/,'restore refuses current Workshop drift before writing or making a safety copy');
    check(fs.readFileSync(path.join(root,'README.md'),'utf8')==='changed after preview\n'&&!fs.existsSync(path.join(root,'created.txt'))&&JSON.parse(fs.readFileSync(recovery.lineageFile,'utf8')).previews.find(x=>x.id===restorePreview.id).state==='HELD','stale restore refusal leaves every selected target untouched and holds that preview');
    fs.writeFileSync(path.join(root,'README.md'),'current workshop source\n');
    const expiringPreview=recovery.preview('axm-workshop-full-test-123',['README.md'],'Mike'),expiredLineage=JSON.parse(fs.readFileSync(recovery.lineageFile,'utf8')); expiredLineage.previews.find(x=>x.id===expiringPreview.id).expiresAt='2000-01-01T00:00:00.000Z'; json(recovery.lineageFile,expiredLineage);
    throws(()=>recovery.apply(expiringPreview.id,{confirmation:'RESTORE SELECTED FILES',actor:'Mike'}),/preview expired/,'expired restore preview cannot be applied');
    const freshRestore=recovery.preview('axm-workshop-full-test-123',['README.md','created.txt'],'Mike');
    throws(()=>recovery.apply(freshRestore.id,{confirmation:'RESTORE FILES',actor:'Mike'}),/exact restore confirmation/,'restore still requires exact typed confirmation');
    const restored=recovery.apply(freshRestore.id,{confirmation:'RESTORE SELECTED FILES',actor:'Mike'});
    check(fs.readFileSync(path.join(root,'README.md'),'utf8')===snapshotReadme&&fs.readFileSync(path.join(root,'created.txt'),'utf8')===snapshotCreated&&fs.existsSync(path.join(root,restored.preRestoreBackup,'README.md')),'restore applies only the fresh selection after preserving current files');
    const lineageBeforeStatus=fs.readFileSync(recovery.lineageFile),recoveryStatus=recovery.status();
    check(recoveryStatus.schema==='axm.recovery-status/v1'&&recoveryStatus.restores.some(x=>x.restoreId===restored.restoreId)&&recoveryStatus.truth.automaticRollback===false&&!Object.prototype.hasOwnProperty.call(recoveryStatus.snapshots[0],'manifestFile')&&lineageBeforeStatus.equals(fs.readFileSync(recovery.lineageFile)),'recovery status exposes persistent metadata-only lineage without mutating it');
    const overlapLineage=JSON.parse(fs.readFileSync(recovery.lineageFile,'utf8')),laterRestore=JSON.parse(JSON.stringify(overlapLineage.restores.find(x=>x.restoreId===restored.restoreId))); laterRestore.restoreId='restore-later-overlap'; laterRestore.appliedAt=new Date(Date.now()+1000).toISOString(); overlapLineage.restores.unshift(laterRestore); json(recovery.lineageFile,overlapLineage);
    const heldOverlap=recovery.previewRollback(restored.restoreId,'Mike');
    check(!heldOverlap.eligible&&heldOverlap.conflicts.some(x=>x.code==='LATER_RESTORE_OVERLAP'),'rollback stays held behind a later active restore that overlaps its file set');
    const clearedOverlap=JSON.parse(fs.readFileSync(recovery.lineageFile,'utf8')); clearedOverlap.restores=clearedOverlap.restores.filter(x=>x.restoreId!=='restore-later-overlap'); json(recovery.lineageFile,clearedOverlap);
    const rollbackPreview=recovery.previewRollback(restored.restoreId,'Mike');
    check(rollbackPreview.eligible&&rollbackPreview.changes.some(x=>x.action==='RESTORE_PREVIOUS')&&rollbackPreview.changes.some(x=>x.action==='REMOVE_CREATED'),'rollback preview distinguishes restored previous files from restore-created files');
    fs.writeFileSync(path.join(root,'README.md'),'changed after rollback preview\n');
    throws(()=>recovery.applyRollback(rollbackPreview.id,{confirmation:'ROLL BACK RESTORE',actor:'Mike'}),/changed after rollback preview/,'rollback refuses current Workshop drift before writing');
    check(fs.readFileSync(path.join(root,'README.md'),'utf8')==='changed after rollback preview\n'&&fs.existsSync(path.join(root,'created.txt'))&&JSON.parse(fs.readFileSync(recovery.lineageFile,'utf8')).rollbackPreviews.find(x=>x.id===rollbackPreview.id).state==='HELD','stale rollback refusal leaves restored targets untouched and holds that preview');
    fs.writeFileSync(path.join(root,'README.md'),snapshotReadme);
    const freshRollback=recovery.previewRollback(restored.restoreId,'Mike');
    throws(()=>recovery.applyRollback(freshRollback.id,{confirmation:'ROLLBACK',actor:'Mike'}),/exact rollback confirmation/,'rollback requires its own exact typed confirmation');
    const rolledBack=recovery.applyRollback(freshRollback.id,{confirmation:'ROLL BACK RESTORE',actor:'Mike'});
    check(fs.readFileSync(path.join(root,'README.md'),'utf8')==='current workshop source\n'&&!fs.existsSync(path.join(root,'created.txt')),'rollback restores replaced bytes and removes only restore-created files from its exact preview');
    check(fs.existsSync(path.join(root,rolledBack.preRollbackBackup,'README.md'))&&fs.existsSync(path.join(root,rolledBack.preRollbackBackup,'created.txt'))&&recovery.status().restores.find(x=>x.restoreId===restored.restoreId).state==='ROLLED_BACK','rollback preserves a pre-rollback safety copy and closes persistent restore lineage');

    const recipeCatalogDir=path.join(root,'tools','code-recipe-foundry','catalog');
    json(path.join(recipeCatalogDir,'code-cheats-1000.code-recipes.json'),{schema:'axm.code-recipe-pack/v1',recipes:[
      {id:'recipe-ready',sourceId:'CC-0001',title:'Safe Widget Lookup',description:'Find a widget without execution.',primaryLanguage:'JavaScript',domain:'test',familyKey:'safe_widget_lookup',difficulty:'Beginner',platform:'Browser',tags:['widget','lookup'],notesSafety:'Read-only example.',snippet:'const widget = widgets.find(item => item.id === id);',reviewState:'SOURCE_REVIEW_REQUIRED',holdReasons:[]},
      {id:'recipe-held',sourceId:'CC-0002',title:'Held Database Role',description:'Consequential database example.',primaryLanguage:'Security-Safe Patterns',domain:'security',familyKey:'held_database_role',difficulty:'Advanced',platform:'Database',tags:['database'],notesSafety:null,snippet:'DROP SECRET NEEDLE',reviewState:'STRUCTURE_HOLD',holdReasons:['SAFETY_NOTE_MISSING']}
    ]});
    json(path.join(recipeCatalogDir,'code-cheats-1000.syntax-audit.json'),{schema:'axm.code-recipe-syntax-audit/v1',results:[{sourceId:'CC-0001',status:'SYNTAX_PASS'},{sourceId:'CC-0002',status:'REVIEW_HOLD'}]});
    const search=Search.create({root,stateRoot}); const searchSummary=search.build(),matches=search.search('Provenance Needle');
    check(searchSummary.entryCount>0&&matches.results.some(x=>x.path==='docs/guide.md'),'search index returns path hash and source snippet');
    const recipeMatch=search.search('Safe Widget Lookup').results.find(x=>x.sourceId==='CC-0001');
    check(searchSummary.structuredProviders.codeRecipes.entryCount===2&&recipeMatch&&recipeMatch.kind==='structured-code-recipe'&&recipeMatch.syntaxStatus==='SYNTAX_PASS'&&recipeMatch.parentSha256,'search indexes individual code recipes with pack and syntax provenance');
    const heldMatch=search.search('Held Database Role').results.find(x=>x.sourceId==='CC-0002');
    check(heldMatch&&heldMatch.reviewState==='STRUCTURE_HOLD'&&!search.search('DROP SECRET NEEDLE').results.some(x=>x.kind==='structured-code-recipe'),'held recipes remain discoverable while their snippet text stays out of the searchable structured projection');
    fs.mkdirSync(path.join(stateRoot,'private'),{recursive:true});fs.writeFileSync(path.join(stateRoot,'private','secret.txt'),'Provenance Needle hidden');search.build();
    check(!search.search('hidden').results.some(x=>x.path.startsWith('state/')),'search excludes private state root');

    fs.writeFileSync(path.join(root,'assets','one.txt'),'duplicate asset');fs.writeFileSync(path.join(root,'assets','two.txt'),'duplicate asset');
    const assets=Assets.create({root,stateRoot,exportRoot}),assetSummary=assets.build(),assetRows=assets.list({q:'one'});
    check(assetSummary.duplicateGroups===1&&assetRows[0].duplicateCount===2,'asset filesystem hashes and groups duplicates');
    const pack=await assets.createPack({name:'test-pack',ids:[assetRows[0].id]});
    const packBytes=fs.readFileSync(path.join(exportRoot,'asset-packs',pack.file));
    check(packBytes.readUInt32LE(0)===0x04034b50&&packBytes.includes(Buffer.from('ASSET_PACK_MANIFEST.json'))&&packBytes.includes(Buffer.from('one.txt'))&&pack.assets===1,'native asset pack ZIP contains the explicit asset and governed manifest');
    check(pack.archiveEngine==='axm-native-zip-store'&&pack.requiredThirdPartyDependencies.length===0&&U.crc32(Buffer.from('123456789'))===0xcbf43926,'asset ZIP engine needs no archive executable or package and records a standard CRC-32');

    const handoff=Device.create({root,stateRoot}); const session=await handoff.createSession({ttlMinutes:2,actor:'Mike'}),parsedUrl=new URL(session.localUrl),payload=Buffer.from('phone-selected-file').toString('base64');
    const response=await fetch('http://127.0.0.1:'+parsedUrl.port+'/upload',{method:'POST',headers:{'content-type':'application/json','x-axm-handoff-token':parsedUrl.searchParams.get('token')},body:JSON.stringify({sessionId:parsedUrl.pathname.split('/').pop(),files:[{name:'phone.txt',type:'text/plain',size:19,data:payload}]})});
    const upload=await response.json(); check(response.ok&&upload.saved.length===1&&fs.existsSync(path.join(root,upload.saved[0].path)),'handoff-only sidecar receives one explicitly selected file');
    check(handoff.status().workshopExposedToLan===false,'device sidecar does not expose Workshop server to LAN'); await handoff.stop();

    const diagnostics=Diagnostics.create({root,stateRoot,exportRoot,logRoot,machineHost:machine,reviewService:review,recoveryService:recovery,searchService:search,assetService:assets,permissionService:permissions,secretsService:secrets,deviceHandoffService:handoff,installerService:installer});
    const diagnostic=diagnostics.snapshot(); check(diagnostic.schema===Diagnostics.SNAPSHOT_SCHEMA&&diagnostic.truth.secretsIncluded===false&&diagnostic.truth.automaticRepair===false&&diagnostic.truth.probesIsolated===true,'diagnostics aggregate isolated operations probes without secrets or auto-repair');
    const failingReview={summary(){throw new Error('review probe failed token=do-not-leak');},auditFile:review.auditFile};
    const partialDiagnostics=Diagnostics.create({root,stateRoot,exportRoot,logRoot,machineHost:machine,reviewService:failingReview,recoveryService:recovery,searchService:search,assetService:assets,permissionService:permissions,secretsService:secrets,deviceHandoffService:handoff,installerService:installer});
    const partial=partialDiagnostics.snapshot(),failedProbe=partial.probes.find(x=>x.id==='review-inbox');
    check(partial.state==='DEGRADED'&&failedProbe.state==='UNAVAILABLE'&&partial.operations.review===null&&!JSON.stringify(partial).includes('do-not-leak'),'one failed probe stays contained and yields a redacted partial snapshot');
    const sourceCatalog=diagnostics.logSources();
    check(sourceCatalog.sources.find(x=>x.id==='qa-lab').state==='NOT_CONFIGURED'&&sourceCatalog.truth.absolutePathsExposed===false,'diagnostic log catalog exposes source availability without private paths');
    throws(()=>diagnostics.logs('qa-lab',80000),/source is unavailable/,'known but unconfigured diagnostic log source is refused cleanly');
    throws(()=>diagnostics.logs('not-a-source',80000),/not allowlisted/,'unknown diagnostic log source is refused by the fixed allowlist');
    const sensitiveLog=path.join(logRoot,'sensitive-audit.jsonl');fs.writeFileSync(sensitiveLog,JSON.stringify({type:'test',token:'token-value',nested:{password:'password-value'},message:'Authorization: Bearer bearer-value-12345'})+'\napi_key=sk-abcdefghijklmnopqrst\n');
    const redactingSecrets=Object.assign({},secrets,{auditFile:sensitiveLog});
    const redactingDiagnostics=Diagnostics.create({root,stateRoot,exportRoot,logRoot,machineHost:machine,reviewService:review,recoveryService:recovery,searchService:search,assetService:assets,permissionService:permissions,secretsService:redactingSecrets,deviceHandoffService:handoff,installerService:installer});
    const logEnvelope=redactingDiagnostics.logs('secret-access',80000);
    check(logEnvelope.schema===Diagnostics.LOG_ENVELOPE_SCHEMA&&/^[a-f0-9]{64}$/.test(logEnvelope.contentSha256)&&logEnvelope.safety.structuredFieldsRedacted>=2&&logEnvelope.safety.secretFreeCertified===false&&!/token-value|password-value|bearer-value|abcdefghijklmnopqrst/.test(logEnvelope.text),'diagnostic log envelope is bounded hashed and truthfully redacted without claiming certification');
    const report=diagnostics.exportReport('Mike'),lineage=diagnostics.exportStatus(); check(fs.existsSync(path.join(root,report.file))&&/^[a-f0-9]{64}$/.test(report.sha256)&&lineage.count===1&&lineage.exports[0].sha256===report.sha256,'diagnostic report exports with persistent SHA-256 lineage');
    const lineageBytes=fs.readFileSync(diagnostics.lineageFile);diagnostics.exportStatus();diagnostics.snapshot();
    check(lineageBytes.equals(fs.readFileSync(diagnostics.lineageFile)),'diagnostic snapshot and export lineage observation remain read only');

    console.log('\nOperations foundation selftest: PASS ('+pass+' checks)');
  } finally {
    const resolved=path.resolve(temp),prefix=path.resolve(os.tmpdir())+path.sep;if(!resolved.startsWith(prefix)||!path.basename(resolved).startsWith('axm-operations-selftest-'))throw new Error('temporary cleanup boundary refused');fs.rmSync(resolved,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
