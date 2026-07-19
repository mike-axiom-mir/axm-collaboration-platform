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

let pass = 0;
function check(value, label) { assert(value, label); pass += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); pass += 1; console.log('PASS ' + label); }
function json(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function contract(id, version) { return { schema:'axm.module-contract/v1', id, version, provides:['test'], consumes:[], permissions:[], handoffs:{ emits:[], accepts:[] }, boundaries:{ writes:[], refuses:['fake-done'] }, lifecycle:{ state_owner:'browser', reload:'resume', disconnect:'graceful-degrade', cleanup:'explicit' } }; }
function bundle(id, version, body) {
  const manifest = { id, name:'Temporary Test Module', version, status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['storage'], permissions:[] };
  return { schema:'axm.module-bundle/v1', files:[
    { path:'manifest.json', content:JSON.stringify(manifest) },
    { path:'module.contract.json', content:JSON.stringify(contract(id, version)) },
    { path:'index.html', content:'<!doctype html><title>Test</title><main>'+body+'</main>' },
    { path:'selftest.js', content:"console.log('PASS temp')" }
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
      { id:'machine-host', name:'Machine Host', version:'v0.1', status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['machine.execute'], permissions:['machine.execute'] },
      { id:'module-installer', name:'Installer', version:'v0.1', status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['module.install'], permissions:['module.install'] },
      { id:'recovery-center', name:'Recovery', version:'v0.1', status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['recovery.apply'], permissions:['recovery.apply'] },
      { id:'device-handoff', name:'Device Handoff', version:'v0.1', status:'TEST', entry:'index.html', contract:'module.contract.json', uses:['device.listen'], permissions:['device.listen'] }
    ];
    for (const manifest of opsManifests) { const dir=path.join(root,'tools',manifest.id);fs.mkdirSync(dir,{recursive:true});json(path.join(dir,'manifest.json'),manifest);json(path.join(dir,'module.contract.json'),contract(manifest.id,manifest.version));fs.writeFileSync(path.join(dir,'index.html'),'<main>'+manifest.name+'</main>');fs.writeFileSync(path.join(dir,'selftest.js'),"console.log('PASS')"); }
    const permissions = Permissions.create({ root, stateRoot });
    permissions.setGrant({ moduleId:'machine-host', permission:'machine.execute', allowed:true, actor:'Mike' });
    check(permissions.allowed('machine-host','machine.execute'), 'declared permission grant becomes active');
    throws(() => permissions.setGrant({ moduleId:'machine-host', permission:'arbitrary.shell', allowed:true }), /not declared/, 'undeclared permission cannot be granted');

    const secrets = Secrets.create({ stateRoot, unlockTtlMs:60000 });
    secrets.initialize('correct horse battery staple', 'Mike');
    secrets.upsert({ id:'test-key', label:'Test key', value:'super-secret-value', scopes:['machine-host'], actor:'Mike' });
    const secretStatus = secrets.status();
    check(secretStatus.records[0].fingerprint && !JSON.stringify(secretStatus).includes('super-secret-value'), 'secret status exposes metadata but not value');
    check(secrets.readSecret('test-key','machine-host') === 'super-secret-value', 'matching internal consumer scope reads unlocked secret');
    throws(() => secrets.readSecret('test-key','other-module'), /refused/, 'unscoped secret consumer is refused');
    secrets.lock(); throws(() => secrets.readSecret('test-key','machine-host'), /locked/, 'locked vault clears secret access');

    const machine = Machine.create({ root, stateRoot });
    check(machine.resolveAction('verify',{}).args[0] === path.join(root,'verify.js'), 'machine host resolves fixed verify entrypoint');
    check(machine.resolveAction('module-selftest',{moduleId:'machine-host'}).moduleId === 'machine-host', 'module selftest resolves only inside tools');
    throws(() => machine.resolveAction('shell',{command:'whoami'}), /not allowlisted/, 'arbitrary machine action is refused');

    const installer = Installer.create({ root, stateRoot, backupRoot, reviewService:review });
    const first = installer.stage(bundle('test-module','v0.1','first'), 'Mike');
    review.vote(first.reviewId, { actor:'Mike', verdict:'APPROVE', artifactDigest:first.digest });
    installer.apply(first.id, { confirmation:'INSTALL REVIEWED MODULE', actor:'Mike' });
    check(fs.readFileSync(path.join(root,'tools','test-module','index.html'),'utf8').includes('first'), 'approved new module installs into exact module folder');
    const second = installer.stage(bundle('test-module','v0.2','second'), 'Mike');
    review.vote(second.reviewId, { actor:'Mike', verdict:'APPROVE', artifactDigest:second.digest });
    const updated = installer.apply(second.id, { confirmation:'INSTALL REVIEWED MODULE', actor:'Mike' });
    check(updated.backupId && fs.readFileSync(path.join(root,'tools','test-module','index.html'),'utf8').includes('second'), 'approved update creates backup before replace');
    installer.rollback('test-module', updated.backupId, { confirmation:'ROLL BACK MODULE', actor:'Mike' });
    check(fs.readFileSync(path.join(root,'tools','test-module','index.html'),'utf8').includes('first'), 'module rollback restores previous installed body');

    const workbench = Workbench.create({ root, installerService:installer });
    const loaded = workbench.readModule('test-module');
    check(loaded.manifest.version === 'v0.1' && workbench.validate({ manifest:loaded.manifest, contract:loaded.contract }).pass, 'workbench reads and validates installed manifest-contract pair');

    const packageDir = path.join(exportRoot,'workshop-packages','axm-workshop-full-test-123'); fs.mkdirSync(packageDir,{recursive:true}); fs.writeFileSync(path.join(packageDir,'README.md'),'snapshot workshop source\n');
    const snapshotHash=U.fileSha256(path.join(packageDir,'README.md')); json(path.join(packageDir,'PACKAGE_MANIFEST.json'),{schema:'axm.workshop-package/v1',mode:'full',created_at:U.now(),file_count:1,total_bytes:25,files:[{path:'README.md',bytes:25,sha256:snapshotHash}]}); json(path.join(exportRoot,'workshop-packages','axm-workshop-full-test-123.RESTORE_TEST.json'),{ok:true});
    const packager={outputDir:path.join(exportRoot,'workshop-packages'),isActive:()=>false,create:()=>Promise.reject(new Error('not used'))};
    const recovery=Recovery.create({root,stateRoot,backupRoot,packager}); const restorePreview=recovery.preview('axm-workshop-full-test-123',['README.md'],'Mike');
    check(restorePreview.changes[0].change==='REPLACE','recovery preview compares current and snapshot digests');
    const restored=recovery.apply(restorePreview.id,{confirmation:'RESTORE SELECTED FILES',actor:'Mike'});
    check(fs.readFileSync(path.join(root,'README.md'),'utf8').includes('snapshot')&&fs.existsSync(path.join(root,restored.preRestoreBackup,'README.md')),'restore applies selection after preserving current file');

    const search=Search.create({root,stateRoot}); const searchSummary=search.build(),matches=search.search('Provenance Needle');
    check(searchSummary.entryCount>0&&matches.results.some(x=>x.path==='docs/guide.md'),'search index returns path hash and source snippet');
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
    const diagnostic=diagnostics.snapshot(); check(diagnostic.truth.secretsIncluded===false&&diagnostic.truth.automaticRepair===false,'diagnostics aggregate operations without secrets or auto-repair');
    const report=diagnostics.exportReport('Mike'); check(fs.existsSync(path.join(root,report.file))&&/^[a-f0-9]{64}$/.test(report.sha256),'diagnostic report exports with SHA-256 evidence');

    console.log('\nOperations foundation selftest: PASS ('+pass+' checks)');
  } finally {
    const resolved=path.resolve(temp),prefix=path.resolve(os.tmpdir())+path.sep;if(!resolved.startsWith(prefix)||!path.basename(resolved).startsWith('axm-operations-selftest-'))throw new Error('temporary cleanup boundary refused');fs.rmSync(resolved,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
