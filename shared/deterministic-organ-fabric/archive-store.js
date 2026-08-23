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
  ['objects', 'failures', 'events', 'views'].forEach(function (name) {
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
function summarizeObject(row, derivedStatus) {
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
    metricProfileDigest: candidate.definition.lineage.metricProfileDigest
  };
}
function rebuildIndex(root) {
  root = assertExistingDirectory(root); ensureLayout(root);
  const fullEvents = listJson(path.join(root, 'events'));
  const statusByDigest = {};
  fullEvents.forEach(function (event) {
    if (event.eventType === 'REVALIDATION_REQUIRED') statusByDigest[event.objectDigest] = 'REVALIDATION_REQUIRED';
    if (event.eventType === 'REVALIDATED') statusByDigest[event.objectDigest] = 'CURRENT';
  });
  const objects = listJson(path.join(root, 'objects')).map(function (row) { return summarizeObject(row, statusByDigest[row.objectDigest]); }).sort(function (a,b) { return a.objectDigest.localeCompare(b.objectDigest); });
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
      const target = path.join(root, 'objects', hexDigest(object.objectDigest) + '.json');
      const disposition = writeContentAddressed(target, canonicalLine(object));
      if (disposition === 'CREATED') appendEvent(root, 'ARCHIVED', object.objectDigest, { packageDigest:object.objectDigest, status:'EXPERIMENTAL' });
      rebuildIndex(root);
      return { disposition:disposition, objectDigest:object.objectDigest };
    },
    putFailure: function (failure) {
      if (!failure || failure.schema !== 'axm.organ-generation-failure/v1' || failure.failureDigest !== core.digest(omit(failure, 'failureDigest'))) throw new Error('Invalid compact failure receipt.');
      const disposition = writeContentAddressed(path.join(root, 'failures', hexDigest(failure.failureDigest) + '.json'), canonicalLine(failure));
      rebuildIndex(root); return {disposition:disposition,failureDigest:failure.failureDigest};
    },
    addSelection: function (receipt) {
      if (!receipt || receipt.schema !== 'axm.organ-selection-receipt/v1' || receipt.installed || receipt.registered || receipt.staged || receipt.promoted || receipt.canonChanged) throw new Error('Selection receipt exceeds authority ceiling.');
      const objectFile = path.join(root, 'objects', hexDigest(receipt.packageDigest) + '.json');
      if (!fs.existsSync(objectFile)) throw new Error('Selected package is not in this archive.');
      const event = appendEvent(root, 'SELECTED', receipt.packageDigest, { selectionReceipt:receipt });
      rebuildIndex(root); return event;
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
      listJson(path.join(root,'failures')).forEach(function(failure){const expected=core.digest(omit(failure,'failureDigest'));if(expected!==failure.failureDigest)errors.push({code:'ARCHIVE_FAILURE_DIGEST_MISMATCH',failureDigest:failure.failureDigest});});
      listJson(path.join(root,'events')).forEach(function(event){const expected=core.digest(omit(event,'eventDigest'));if(expected!==event.eventDigest)errors.push({code:'ARCHIVE_EVENT_DIGEST_MISMATCH',eventDigest:event.eventDigest});});
      const index=rebuildIndex(root);return {schema:'axm.organ-archive-verification/v1',ok:errors.length===0,errors:errors,objectCount:index.objects.length,failureCount:index.failures.length,eventCount:index.events.length,indexDigest:index.indexDigest};
    },
    revalidate: function () {
      const packs=core.loadPacks(),results=[],currentIndex=rebuildIndex(root);
      listJson(path.join(root,'objects')).forEach(function(object){
        const definition=object.package.definition,pack=packs.find(function(row){return row.id===definition.lineage.pack.id;});
        const current=Boolean(pack)&&pack.packDigest===definition.lineage.pack.digest&&definition.lineage.runtime.version===core.RUNTIME_VERSION&&definition.lineage.runtime.digest===core.RUNTIME_DIGEST&&definition.lineage.metricProfileId===core.METRIC_PROFILE.id&&definition.lineage.metricProfileDigest===core.METRIC_PROFILE.digest;
        const desiredStatus=current?'CURRENT':'REVALIDATION_REQUIRED';
        const existing=currentIndex.objects.find(function(row){return row.objectDigest===object.objectDigest;});
        if(!existing||existing.status!==desiredStatus)appendEvent(root,desiredStatus==='CURRENT'?'REVALIDATED':'REVALIDATION_REQUIRED',object.objectDigest,{packCurrent:Boolean(pack&&pack.packDigest===definition.lineage.pack.digest),runtimeCurrent:definition.lineage.runtime.version===core.RUNTIME_VERSION&&definition.lineage.runtime.digest===core.RUNTIME_DIGEST,metricCurrent:definition.lineage.metricProfileId===core.METRIC_PROFILE.id&&definition.lineage.metricProfileDigest===core.METRIC_PROFILE.digest});
        results.push({objectDigest:object.objectDigest,status:desiredStatus});
      });
      rebuildIndex(root);return {schema:'axm.organ-revalidation/v1',results:results};
    },
    exportPack: function (packFile) {
      const resolved=path.resolve(String(packFile||''));
      if(!packFile||!fs.existsSync(path.dirname(resolved))||fs.existsSync(resolved))throw new Error('Export pack path must be a new file in an existing directory.');
      const portable={schema:'axm.organ-archive-pack/v1',objects:listJson(path.join(root,'objects')),failures:listJson(path.join(root,'failures')),events:listJson(path.join(root,'events')),packDigest:''};
      portable.packDigest=core.digest(omit(portable,'packDigest'));
      writeContentAddressed(resolved,JSON.stringify(portable,null,2)+'\n');return {pack:resolved,packDigest:portable.packDigest,objects:portable.objects.length};
    },
    importPack: function (packFile) {
      const resolved=path.resolve(String(packFile||''));if(!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())throw new Error('Import pack must be an existing file.');
      const portable=readJson(resolved),expected=core.digest(omit(portable,'packDigest'));
      if(portable.schema!=='axm.organ-archive-pack/v1'||expected!==portable.packDigest)throw new Error('Portable archive pack digest is invalid.');
      const results=[];
      portable.objects.forEach(function(object){const check=core.verifyPackage(object.package);if(!check.ok||object.objectDigest!==object.package.package.packageDigest)throw new Error('Portable object failed package verification.');const disposition=writeContentAddressed(path.join(root,'objects',hexDigest(object.objectDigest)+'.json'),canonicalLine(object));results.push({objectDigest:object.objectDigest,disposition:disposition});});
      portable.failures.forEach(function(failure){const failureExpected=core.digest(omit(failure,'failureDigest'));if(failureExpected!==failure.failureDigest)throw new Error('Portable failure receipt digest is invalid.');writeContentAddressed(path.join(root,'failures',hexDigest(failure.failureDigest)+'.json'),canonicalLine(failure));});
      portable.events.forEach(function(event){const eventExpected=core.digest(omit(event,'eventDigest'));if(eventExpected!==event.eventDigest)throw new Error('Portable archive event digest is invalid.');const filename=String(event.sequence).padStart(10,'0')+'-'+hexDigest(event.eventDigest).slice(0,16)+'.json';writeContentAddressed(path.join(root,'events',filename),canonicalLine(event));});
      rebuildIndex(root);return {schema:'axm.organ-archive-import/v1',packDigest:portable.packDigest,results:results,registered:false,installed:false};
    }
  };
}

module.exports = { openArchive:openArchive, rebuildIndex:rebuildIndex, assertExistingDirectory:assertExistingDirectory };
