'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Fabric = require('../shared/deterministic-organ-fabric/index.js');
const ArchiveStore = require('../shared/deterministic-organ-fabric/archive-store.js');
const Connector = require('../shared/deterministic-organ-fabric/mirror-archive-connector.js');

function mirrorSourceRoot() {
  const explicit=process.env.AXM_MIRROR_ORGAN_ARCHIVE_TEST_ROOT;
  if(explicit)return path.resolve(explicit);
  return path.resolve(__dirname,'..','..','mirror-organ-world-garden-v1');
}
function fixtureMirror(source,root) {
  const moduleSource=path.join(source,'modules','ai-organ-archive'),moduleTarget=path.join(root,'modules','ai-organ-archive');
  fs.mkdirSync(path.dirname(moduleTarget),{recursive:true});fs.cpSync(moduleSource,moduleTarget,{recursive:true});
  fs.mkdirSync(path.join(root,'kernel'),{recursive:true});fs.copyFileSync(path.join(source,'kernel','immutable-batch-store.js'),path.join(root,'kernel','immutable-batch-store.js'));
  fs.mkdirSync(path.join(root,'organs'));fs.mkdirSync(path.join(root,'state','ai-organ-archive'),{recursive:true});
}
function candidate() { const pack=Fabric.loadPacks()[0],intent=Fabric.sealIntent(pack.exampleIntent,pack);return Fabric.generateCandidates(intent,pack).candidates[0]; }

const source=mirrorSourceRoot();
if(!fs.existsSync(path.join(source,'modules','ai-organ-archive','module.contract.json'))){
  console.log('Deterministic Organ Fabric ↔ Mirror connection test SKIP · set AXM_MIRROR_ORGAN_ARCHIVE_TEST_ROOT to an updated Mirror checkout');
}else{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'organ-fabric-mirror-')),fabricRoot=path.join(root,'fabric-archive'),mirrorRoot=path.join(root,'mirror'),mirrorArchiveRoot=path.join(mirrorRoot,'state','ai-organ-archive');
  fs.mkdirSync(fabricRoot);fixtureMirror(source,mirrorRoot);
  try{
    const archived=candidate(),archive=ArchiveStore.openArchive(fabricRoot);archive.putPackage(archived);
    const plan=Fabric.buildArchiveConnectionPlan(archived),sourceFile=path.join(mirrorRoot,plan.sourceArtifact.path);
    assert.equal(Fabric.verifyArchiveConnectionPlan(plan,archived).ok,true);
    assert.throws(function(){Connector.connect({archiveRoot:fabricRoot,packageDigest:archived.package.packageDigest,mirrorRoot:mirrorRoot,mirrorArchiveRoot:mirrorArchiveRoot,acknowledge:'not-authorized'});},function(error){return error.code==='HOST_AUTHORIZATION_REQUIRED';});
    assert.equal(fs.existsSync(sourceFile),false,'refused authorization must write no source');
    const first=Connector.connect({archiveRoot:fabricRoot,packageDigest:archived.package.packageDigest,mirrorRoot:mirrorRoot,mirrorArchiveRoot:mirrorArchiveRoot,acknowledge:Connector.ACKNOWLEDGEMENT});
    assert.equal(first.outcome,'DORMANT_ARCHIVE_CONNECTION_ACKNOWLEDGED');assert.equal(first.sourceDisposition,'CREATED_SOURCE_ARTIFACT');assert.equal(first.archiveObjectDisposition,'CREATED_ARCHIVE_OBJECT');assert.equal(first.eventDisposition,'CREATED');
    assert.equal(first.archiveObjectId,plan.sourceArtifact.targetArchiveObjectId);assert.equal(first.archiveAdmissionStatus,'ARCHIVED_NOT_ADMITTED_TO_RUNTIME');assert.equal(first.startupPolicy,'DORMANT');
    assert.equal(first.organLoaded,false);assert.equal(first.organExecuted,false);assert.equal(first.runtimeConnected,false);assert.equal(first.runtimeAdmitted,false);assert.equal(first.installed,false);assert.equal(first.registered,false);assert.equal(first.promoted,false);assert.equal(first.canonChanged,false);
    assert.equal(require.cache[sourceFile],undefined,'generated organ source must never enter the Node module cache');
    assert.equal(fs.readFileSync(sourceFile,'utf8'),archived.files['organ.js']);
    assert.equal(fs.readFileSync(path.join(mirrorArchiveRoot,'objects',first.archiveObjectId,'source.js'),'utf8'),archived.files['organ.js']);
    const second=Connector.connect({archiveRoot:fabricRoot,packageDigest:archived.package.packageDigest,mirrorRoot:mirrorRoot,mirrorArchiveRoot:mirrorArchiveRoot,acknowledge:Connector.ACKNOWLEDGEMENT});
    assert.equal(second.sourceDisposition,'REUSED_EXACT_SOURCE_ARTIFACT');assert.equal(second.archiveObjectDisposition,'REUSED_EXISTING_ARCHIVE_OBJECT');assert.equal(second.eventDisposition,'DEDUPLICATED');assert.equal(second.receiptDigest,first.receiptDigest);
    const index=archive.list();assert.equal(index.objects[0].archiveConnections.length,1);assert.equal(index.objects[0].archiveConnections[0].runtimeConnected,false);assert.equal(archive.verify().ok,true);
    const portableFile=path.join(root,'connected-pack.json'),forgedFile=path.join(root,'forged-connected-pack.json'),importRoot=path.join(root,'import-archive');archive.exportPack(portableFile);const forged=JSON.parse(fs.readFileSync(portableFile,'utf8')),forgedReceipt=forged.events.find(function(event){return event.eventType==='ARCHIVE_CONNECTED';}).payload.connectionReceipt,forgedEvent=forged.events.find(function(event){return event.eventType==='ARCHIVE_CONNECTED';});forgedReceipt.planDigest='sha256:'+'0'.repeat(64);forgedReceipt.receiptDigest=Fabric.digest(Object.fromEntries(Object.entries(forgedReceipt).filter(function(entry){return entry[0]!=='receiptDigest';})));forgedEvent.eventDigest=Fabric.digest(Object.fromEntries(Object.entries(forgedEvent).filter(function(entry){return entry[0]!=='eventDigest';})));forged.packDigest=Fabric.digest(Object.fromEntries(Object.entries(forged).filter(function(entry){return entry[0]!=='packDigest';})));fs.writeFileSync(forgedFile,JSON.stringify(forged));fs.mkdirSync(importRoot);assert.throws(function(){ArchiveStore.openArchive(importRoot).importPack(forgedFile);},/connection receipt is invalid/i);
    const cli=path.join(__dirname,'..','tools','deterministic-organ-fabric','cli.js'),cliPlan=childProcess.spawnSync(process.execPath,[cli,'archive','connection-plan','--archive-root',fabricRoot,'--package-digest',archived.package.packageDigest],{encoding:'utf8'}),cliConnect=childProcess.spawnSync(process.execPath,[cli,'archive','connect-mirror','--archive-root',fabricRoot,'--package-digest',archived.package.packageDigest,'--mirror-root',mirrorRoot,'--mirror-archive-root',mirrorArchiveRoot,'--acknowledge',Connector.ACKNOWLEDGEMENT],{encoding:'utf8'});
    assert.equal(cliPlan.status,0);assert.equal(JSON.parse(cliPlan.stdout).planDigest,plan.planDigest);assert.equal(cliConnect.status,0);assert.equal(JSON.parse(cliConnect.stdout).eventDisposition,'DEDUPLICATED');
    if(process.env.AXM_ORGAN_CONNECTION_BROWSER_PACK_DIR){const outputRoot=path.resolve(process.env.AXM_ORGAN_CONNECTION_BROWSER_PACK_DIR);if(!fs.existsSync(outputRoot)||!fs.statSync(outputRoot).isDirectory())throw new Error('AXM_ORGAN_CONNECTION_BROWSER_PACK_DIR must be an existing directory.');const packFile=path.join(outputRoot,'organ-archive-connected-'+first.receiptDigest.slice(7,19)+'.json');archive.exportPack(packFile);console.log('BROWSER_PACK '+packFile);}
    fs.appendFileSync(path.join(mirrorRoot,Fabric.ORGAN_ARCHIVE_BRIDGE.receiverEntryPoint),'\n// deliberate receiver drift\n');
    assert.throws(function(){Connector.preflight({archiveRoot:fabricRoot,packageDigest:archived.package.packageDigest,mirrorRoot:mirrorRoot,mirrorArchiveRoot:mirrorArchiveRoot});},function(error){return error.code==='MIRROR_ARCHIVE_RECEIVER_DRIFT';});
    console.log('Deterministic Organ Fabric ↔ Mirror connection test PASS · explicit authority, exact bytes, dormant receiver acknowledgement, idempotence, drift refusal, no organ load');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
