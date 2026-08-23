'use strict';

const fs = require('fs');
const path = require('path');
const core = require('./index.js');

function assertExistingDirectory(root) {
  const resolved = path.resolve(String(root || ''));
  if (!root || !fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error('Archive root must be an explicit existing directory: ' + resolved);
  }
  return resolved;
}
function hexDigest(digest) {
  if (!/^sha256:[a-f0-9]{64}$/.test(String(digest || ''))) throw new Error('Invalid SHA-256 digest.');
  return digest.slice(7);
}
function ensureLayout(root) {
  ['objects', 'stash', 'failures', 'events', 'views'].forEach(function (name) {
    fs.mkdirSync(path.join(root, name), { recursive: true });
  });
}
function canonicalLine(value) { return core.canonicalJson(value) + '\n'; }
function omit(value, key) { const copy = JSON.parse(JSON.stringify(value)); delete copy[key]; return copy; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function sameBytes(file, content) { return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content; }
let incomingSerial = 0;
function writeContentAddressed(file, content) {
  if (fs.existsSync(file)) {
    if (!sameBytes(file, content)) throw new Error('DIGEST_COLLISION: existing bytes differ at ' + file);
    return 'DEDUPLICATED';
  }
  const temporary = file + '.incoming-' + process.pid + '-' + (++incomingSerial);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, content, { encoding:'utf8' });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor); descriptor = undefined;
    try { fs.linkSync(temporary, file); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!sameBytes(file, content)) throw new Error('DIGEST_COLLISION: existing bytes differ at ' + file);
      return 'DEDUPLICATED';
    }
    return 'CREATED';
  } catch (error) {
    if (error.code === 'EEXIST' && sameBytes(file, content)) return 'DEDUPLICATED';
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function atomicView(file, content) {
  const temporary = file + '.next-' + process.pid;
  fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'w' });
  fs.renameSync(temporary, file);
}
function listJson(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(function (name) { return name.endsWith('.json'); }).sort().map(function (name) { return readJson(path.join(directory, name)); });
}
function nextSequence(root) {
  const names = fs.readdirSync(path.join(root, 'events')).filter(function (name) { return /^\d{10}-[a-f0-9]{16}\.json$/.test(name); }).sort();
  return names.length ? Number(names[names.length - 1].slice(0, 10)) + 1 : 1;
}
function appendEvent(root, eventType, objectDigest, payload) {
  let sequence = nextSequence(root);
  for (let attempt = 0; attempt < 32; attempt += 1, sequence += 1) {
    const event = { schema:'axm.organ-archive-event/v1', sequence:sequence, eventType:eventType, objectDigest:objectDigest, payload:payload || {}, eventDigest:'' };
    event.eventDigest = core.digest(omit(event, 'eventDigest'));
    const filename = String(sequence).padStart(10, '0') + '-' + hexDigest(event.eventDigest).slice(0, 16) + '.json';
    try {
      const disposition=writeContentAddressed(path.join(root, 'events', filename), canonicalLine(event));
      if(disposition==='CREATED')return event;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('Could not allocate durable event sequence.');
}
function summarizeObject(row, derivedStatus, stash, selected) {
  const candidate = row.package;
  return {
    objectDigest: row.objectDigest,
    status: derivedStatus || row.status,
    id: candidate.package.id,
    strategy: candidate.definition.strategy,
    score: candidate.evaluation.metrics.score,
    definitionDigest: candidate.definition.definitionDigest,
    packDigest: candidate.definition.lineage.pack.digest,
    runtimeVersion: candidate.definition.lineage.runtime.version,
    metricProfileId: candidate.definition.lineage.metricProfileId,
    metricProfileDigest: candidate.definition.lineage.metricProfileDigest,
    stashDigest: stash.stashDigest,
    archiveDisposition: stash.archiveState.disposition,
    retentionPolicy: stash.archiveState.retentionPolicy,
    admissionStatus: stash.archiveState.admissionStatus,
    startupPolicy: stash.archiveState.startupPolicy,
    implementationStatus: selected ? 'SELECTED_FOR_IMPLEMENTATION_REVIEW' : stash.archiveState.implementationStatus,
    selected: Boolean(selected),
    primaryPurposeCategory: stash.purposeClassification.primaryPurposeCategory,
    useFields: stash.purposeClassification.useFields,
    functionalRoles: stash.purposeClassification.functionalRoles,
    classificationState: stash.purposeClassification.state,
    archiveConnections: []
  };
}
function rebuildIndex(root) {
  root = assertExistingDirectory(root); ensureLayout(root);
  const fullEvents = listJson(path.join(root, 'events'));
  const statusByDigest = {},selectedByDigest={},connectionsByDigest={};
  fullEvents.forEach(function (event) {
    if (event.eventType === 'REVALIDATION_REQUIRED') statusByDigest[event.objectDigest] = 'REVALIDATION_REQUIRED';
    if (event.eventType === 'REVALIDATED') statusByDigest[event.objectDigest] = 'CURRENT';
    if (event.eventType === 'SELECTED') selectedByDigest[event.objectDigest] = true;
    if (event.eventType === 'ARCHIVE_CONNECTED' && event.payload && event.payload.connectionReceipt) {
      const receipt=event.payload.connectionReceipt;
      if(!connectionsByDigest[event.objectDigest])connectionsByDigest[event.objectDigest]=[];
      if(!connectionsByDigest[event.objectDigest].some(function(row){return row.receiptDigest===receipt.receiptDigest;}))connectionsByDigest[event.objectDigest].push({targetModuleId:receipt.receiver.targetModuleId,targetVersion:receipt.receiver.targetVersion,receiptDigest:receipt.receiptDigest,archiveObjectId:receipt.receiver.archiveObjectId,sourcePath:receipt.sourceArtifact.path,state:receipt.outcome,runtimeConnected:false});
    }
  });
  const stashByPackage={};listJson(path.join(root,'stash')).forEach(function(row){stashByPackage[row.packageDigest]=row;});
  const objects = listJson(path.join(root, 'objects')).map(function (row) { const stash=stashByPackage[row.objectDigest]||core.projectArchiveStash(row.package),summary=summarizeObject(row, statusByDigest[row.objectDigest],stash,selectedByDigest[row.objectDigest]);summary.archiveConnections=(connectionsByDigest[row.objectDigest]||[]).slice().sort(function(a,b){return a.receiptDigest.localeCompare(b.receiptDigest);});return summary; }).sort(function (a,b) { return a.objectDigest.localeCompare(b.objectDigest); });
  const failures = listJson(path.join(root, 'failures')).map(function (row) { return { failureDigest:row.failureDigest, intentDigest:row.intentDigest, strategy:row.strategy, failedGates:row.failedGates.map(function (gate) { return gate.id; }) }; });
  const events = fullEvents.map(function (row) { return { sequence:row.sequence, eventType:row.eventType, objectDigest:row.objectDigest, eventDigest:row.eventDigest }; });
  const index = { schema:'axm.organ-archive-index/v1', derived:true, objects:objects, failures:failures, events:events, indexDigest:'' };
  index.indexDigest = core.digest(omit(index, 'indexDigest'));
  atomicView(path.join(root, 'views', 'index.json'), JSON.stringify(index, null, 2) + '\n');
  return index;
}
function openArchive(root) {
  root = assertExistingDirectory(root); ensureLayout(root);
  return {
    root: root,
    putPackage: function (candidate) {
      const verification = core.verifyPackage(candidate);
      if (!verification.ok) throw new Error('PACKAGE_INVALID: ' + JSON.stringify(verification.errors));
      if (!candidate.evaluation || candidate.evaluation.status !== 'VALID') throw new Error('Only valid candidates may be archived.');
      const object = { schema:'axm.organ-archive-object/v1', objectDigest:candidate.package.packageDigest, objectKind:'candidate-package', status:'CURRENT', package:candidate };
      const stash=core.projectArchiveStash(candidate);
      const target = path.join(root, 'objects', hexDigest(object.objectDigest) + '.json');
      const disposition = writeContentAddressed(target, canonicalLine(object));
      const stashDisposition=writeContentAddressed(path.join(root,'stash',hexDigest(stash.stashDigest)+'.json'),canonicalLine(stash));
      if (disposition === 'CREATED') appendEvent(root, 'ARCHIVED', object.objectDigest, { packageDigest:object.objectDigest, status:'EXPERIMENTAL', stashDigest:stash.stashDigest, disposition:stash.archiveState.disposition, retentionPolicy:stash.archiveState.retentionPolicy, admissionStatus:stash.archiveState.admissionStatus, startupPolicy:stash.archiveState.startupPolicy });
      rebuildIndex(root);
      return { disposition:disposition, stashDisposition:stashDisposition, objectDigest:object.objectDigest, stashDigest:stash.stashDigest, admissionStatus:stash.archiveState.admissionStatus, startupPolicy:stash.archiveState.startupPolicy };
    },
    putFailure: function (failure) {
      if (!failure || failure.schema !== 'axm.organ-generation-failure/v1' || failure.failureDigest !== core.digest(omit(failure, 'failureDigest'))) throw new Error('Invalid compact failure receipt.');
      const disposition = writeContentAddressed(path.join(root, 'failures', hexDigest(failure.failureDigest) + '.json'), canonicalLine(failure));
      rebuildIndex(root); return {disposition:disposition,failureDigest:failure.failureDigest};
    },
    addSelection: function (receipt) {
      if (!receipt || receipt.schema !== 'axm.organ-selection-receipt/v1' || receipt.selectionDigest!==core.digest(omit(receipt,'selectionDigest')) || receipt.applied || receipt.installed || receipt.registered || receipt.staged || receipt.promoted || receipt.canonChanged || receipt.permissionsChanged) throw new Error('Selection receipt is invalid or exceeds authority ceiling.');
      const objectFile = path.join(root, 'objects', hexDigest(receipt.packageDigest) + '.json');
      if (!fs.existsSync(objectFile)) throw new Error('Selected package is not in this archive.');
      const event = appendEvent(root, 'SELECTED', receipt.packageDigest, { selectionReceipt:receipt });
      rebuildIndex(root); return event;
    },
    addConnection: function (receipt) {
      const objectFile=path.join(root,'objects',hexDigest(receipt.packageDigest)+'.json');
      if(!fs.existsSync(objectFile))throw new Error('Connected package is not in this archive.');
      const object=readJson(objectFile),verification=core.verifyArchiveConnectionReceipt(receipt,object.package);
      if(!verification.ok)throw new Error('Archive connection receipt is invalid or exceeds authority ceiling.');
      const plan=core.buildArchiveConnectionPlan(object.package);
      if(receipt.planDigest!==plan.planDigest||receipt.sourceArtifact.path!==plan.sourceArtifact.path||receipt.sourceArtifact.sha256!==plan.sourceArtifact.sha256)throw new Error('Archive connection receipt does not bind the current package handoff plan.');
      const existing=listJson(path.join(root,'events')).find(function(event){return event.eventType==='ARCHIVE_CONNECTED'&&event.objectDigest===receipt.packageDigest&&event.payload&&event.payload.connectionReceipt&&event.payload.connectionReceipt.receiptDigest===receipt.receiptDigest;});
      if(existing){rebuildIndex(root);return {disposition:'DEDUPLICATED',event:existing};}
      const event=appendEvent(root,'ARCHIVE_CONNECTED',receipt.packageDigest,{connectionReceipt:receipt});
      rebuildIndex(root);return {disposition:'CREATED',event:event};
    },
    addEvent: function (eventType, objectDigest, payload) {
      if (['SUPERSEDED','DELETED'].indexOf(eventType) < 0) throw new Error('Generic event action is limited to SUPERSEDED or DELETED.');
      const event=appendEvent(root,eventType,objectDigest,payload); rebuildIndex(root); return event;
    },
    list: function () { return rebuildIndex(root); },
    verify: function () {
      const errors=[];
      listJson(path.join(root,'objects')).forEach(function(object){
        if(object.objectDigest!==object.package.package.packageDigest)errors.push({code:'ARCHIVE_OBJECT_DIGEST_MISMATCH',objectDigest:object.objectDigest});
        const check=core.verifyPackage(object.package);if(!check.ok)errors.push({code:'ARCHIVE_PACKAGE_INVALID',objectDigest:object.objectDigest,details:check.errors});
      });
      const objectByDigest={};listJson(path.join(root,'objects')).forEach(function(object){objectByDigest[object.objectDigest]=object.package;});
      listJson(path.join(root,'stash')).forEach(function(stash){const candidate=objectByDigest[stash.packageDigest],check=core.verifyArchiveStashProjection(stash,candidate);if(!candidate)errors.push({code:'STASH_PACKAGE_ABSENT',stashDigest:stash.stashDigest});else if(!check.ok)errors.push({code:'STASH_PROJECTION_INVALID',stashDigest:stash.stashDigest,details:check.errors});});
      listJson(path.join(root,'failures')).forEach(function(failure){const expected=core.digest(omit(failure,'failureDigest'));if(expected!==failure.failureDigest)errors.push({code:'ARCHIVE_FAILURE_DIGEST_MISMATCH',failureDigest:failure.failureDigest});});
      listJson(path.join(root,'events')).forEach(function(event){const expected=core.digest(omit(event,'eventDigest'));if(expected!==event.eventDigest)errors.push({code:'ARCHIVE_EVENT_DIGEST_MISMATCH',eventDigest:event.eventDigest});if(event.eventType==='ARCHIVE_CONNECTED'){const receipt=event.payload&&event.payload.connectionReceipt,candidate=objectByDigest[event.objectDigest],check=core.verifyArchiveConnectionReceipt(receipt,candidate);if(!check.ok||!candidate||receipt.packageDigest!==event.objectDigest)errors.push({code:'ARCHIVE_CONNECTION_RECEIPT_INVALID',eventDigest:event.eventDigest,details:check.errors});}});
      const index=rebuildIndex(root);return {schema:'axm.organ-archive-verification/v1',ok:errors.length===0,errors:errors,objectCount:index.objects.length,failureCount:index.failures.length,eventCount:index.events.length,indexDigest:index.indexDigest};
    },
    revalidate: function () {
      const packs=core.loadPacks(),results=[],currentIndex=rebuildIndex(root);
      listJson(path.join(root,'objects')).forEach(function(object){
        const definition=object.package.definition,pack=packs.find(function(row){return row.id===definition.lineage.pack.id;});
        const stash=listJson(path.join(root,'stash')).find(function(row){return row.packageDigest===object.objectDigest;});
        const bridgeCurrent=!stash||stash.targetCompatibility.contractCanonicalDigest===core.ORGAN_ARCHIVE_BRIDGE.contractCanonicalDigest&&stash.targetCompatibility.version===core.ORGAN_ARCHIVE_BRIDGE.version;
        const current=Boolean(pack)&&pack.packDigest===definition.lineage.pack.digest&&definition.lineage.runtime.version===core.RUNTIME_VERSION&&definition.lineage.runtime.digest===core.RUNTIME_DIGEST&&definition.lineage.metricProfileId===core.METRIC_PROFILE.id&&definition.lineage.metricProfileDigest===core.METRIC_PROFILE.digest&&bridgeCurrent;
        const desiredStatus=current?'CURRENT':'REVALIDATION_REQUIRED';
        const existing=currentIndex.objects.find(function(row){return row.objectDigest===object.objectDigest;});
        if(!existing||existing.status!==desiredStatus)appendEvent(root,desiredStatus==='CURRENT'?'REVALIDATED':'REVALIDATION_REQUIRED',object.objectDigest,{packCurrent:Boolean(pack&&pack.packDigest===definition.lineage.pack.digest),runtimeCurrent:definition.lineage.runtime.version===core.RUNTIME_VERSION&&definition.lineage.runtime.digest===core.RUNTIME_DIGEST,metricCurrent:definition.lineage.metricProfileId===core.METRIC_PROFILE.id&&definition.lineage.metricProfileDigest===core.METRIC_PROFILE.digest,archiveBridgeCurrent:bridgeCurrent});
        results.push({objectDigest:object.objectDigest,status:desiredStatus});
      });
      rebuildIndex(root);return {schema:'axm.organ-revalidation/v1',results:results};
    },
    exportPack: function (packFile) {
      const resolved=path.resolve(String(packFile||''));
      if(!packFile||!fs.existsSync(path.dirname(resolved))||fs.existsSync(resolved))throw new Error('Export pack path must be a new file in an existing directory.');
      const portable={schema:'axm.organ-archive-pack/v1',objects:listJson(path.join(root,'objects')),stash:listJson(path.join(root,'stash')),failures:listJson(path.join(root,'failures')),events:listJson(path.join(root,'events')),packDigest:''};
      portable.packDigest=core.digest(omit(portable,'packDigest'));
      writeContentAddressed(resolved,JSON.stringify(portable,null,2)+'\n');return {pack:resolved,packDigest:portable.packDigest,objects:portable.objects.length};
    },
    importPack: function (packFile) {
      const resolved=path.resolve(String(packFile||''));if(!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())throw new Error('Import pack must be an existing file.');
      const portable=readJson(resolved),expected=core.digest(omit(portable,'packDigest'));
      if(portable.schema!=='axm.organ-archive-pack/v1'||expected!==portable.packDigest)throw new Error('Portable archive pack digest is invalid.');
      const results=[],portableStash=Array.isArray(portable.stash)?portable.stash:[];
      portable.objects.forEach(function(object){const check=core.verifyPackage(object.package);if(!check.ok||object.objectDigest!==object.package.package.packageDigest)throw new Error('Portable object failed package verification.');const disposition=writeContentAddressed(path.join(root,'objects',hexDigest(object.objectDigest)+'.json'),canonicalLine(object));const stash=portableStash.find(function(row){return row.packageDigest===object.objectDigest;})||core.projectArchiveStash(object.package),stashCheck=core.verifyArchiveStashProjection(stash,object.package);if(!stashCheck.ok)throw new Error('Portable dormant stash projection is invalid.');const stashDisposition=writeContentAddressed(path.join(root,'stash',hexDigest(stash.stashDigest)+'.json'),canonicalLine(stash));results.push({objectDigest:object.objectDigest,disposition:disposition,stashDigest:stash.stashDigest,stashDisposition:stashDisposition});});
      portable.failures.forEach(function(failure){const failureExpected=core.digest(omit(failure,'failureDigest'));if(failureExpected!==failure.failureDigest)throw new Error('Portable failure receipt digest is invalid.');writeContentAddressed(path.join(root,'failures',hexDigest(failure.failureDigest)+'.json'),canonicalLine(failure));});
      portable.events.forEach(function(event){const eventExpected=core.digest(omit(event,'eventDigest'));if(eventExpected!==event.eventDigest)throw new Error('Portable archive event digest is invalid.');if(event.eventType==='ARCHIVE_CONNECTED'){const receipt=event.payload&&event.payload.connectionReceipt,portableObject=portable.objects.find(function(object){return object.objectDigest===event.objectDigest;}),storedObjectFile=path.join(root,'objects',hexDigest(event.objectDigest)+'.json'),candidate=portableObject&&portableObject.package||fs.existsSync(storedObjectFile)&&readJson(storedObjectFile).package,check=core.verifyArchiveConnectionReceipt(receipt,candidate);if(!check.ok||receipt.packageDigest!==event.objectDigest||!candidate)throw new Error('Portable archive connection receipt is invalid.');}const filename=String(event.sequence).padStart(10,'0')+'-'+hexDigest(event.eventDigest).slice(0,16)+'.json';writeContentAddressed(path.join(root,'events',filename),canonicalLine(event));});
      rebuildIndex(root);return {schema:'axm.organ-archive-import/v1',packDigest:portable.packDigest,results:results,registered:false,installed:false};
    },
    exportStashEnvelope: function (packageDigest, packFile) {
      const objectFile=path.join(root,'objects',hexDigest(packageDigest)+'.json');
      if(!fs.existsSync(objectFile))throw new Error('Dormant stash export package is not in this archive.');
      const object=readJson(objectFile),stash=listJson(path.join(root,'stash')).find(function(row){return row.packageDigest===packageDigest;})||core.projectArchiveStash(object.package),envelope=core.buildArchiveStashEnvelope(object.package,stash);
      const resolved=path.resolve(String(packFile||''));if(!packFile||!fs.existsSync(path.dirname(resolved))||fs.existsSync(resolved))throw new Error('Dormant stash envelope path must be a new file in an existing directory.');
      writeContentAddressed(resolved,JSON.stringify(envelope,null,2)+'\n');
      return {schema:'axm.organ-archive-stash-export/v1',pack:resolved,packageDigest:packageDigest,stashDigest:stash.stashDigest,envelopeDigest:envelope.envelopeDigest,admissionStatus:stash.archiveState.admissionStatus,installed:false,registered:false,executed:false};
    },
    getPackage: function (packageDigest) {
      const objectFile=path.join(root,'objects',hexDigest(packageDigest)+'.json');
      if(!fs.existsSync(objectFile))throw new Error('Package is not in this archive.');
      const object=readJson(objectFile),verification=core.verifyPackage(object.package);
      if(!verification.ok||object.objectDigest!==packageDigest)throw new Error('Archived package failed verification.');
      return object.package;
    },
    getStashEnvelope: function (packageDigest) {
      const objectFile=path.join(root,'objects',hexDigest(packageDigest)+'.json');
      if(!fs.existsSync(objectFile))throw new Error('Dormant stash package is not in this archive.');
      const object=readJson(objectFile),stash=listJson(path.join(root,'stash')).find(function(row){return row.packageDigest===packageDigest;})||core.projectArchiveStash(object.package);
      return core.buildArchiveStashEnvelope(object.package,stash);
    }
  };
}

module.exports = { openArchive:openArchive, rebuildIndex:rebuildIndex, assertExistingDirectory:assertExistingDirectory };
