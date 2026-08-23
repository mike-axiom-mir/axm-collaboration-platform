(function(root,factory){const api=factory(root.AXMDeterministicOrganFabric,root);if(typeof window!=='undefined')root.AXMOrganBrowserArchive=api;})(typeof self!=='undefined'?self:this,function(Fabric,globalScope){
  'use strict';
  const DB_NAME='axm-deterministic-organ-archive-v1',DB_VERSION=1;
  function omit(value,key){const copy=JSON.parse(JSON.stringify(value));delete copy[key];return copy;}
  function requestResult(request){return new Promise(function(resolve,reject){request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(request.error);};});}
  function transactionDone(transaction){return new Promise(function(resolve,reject){transaction.oncomplete=resolve;transaction.onerror=function(){reject(transaction.error);};transaction.onabort=function(){reject(transaction.error||new Error('Archive transaction aborted.'));};});}
  function BrowserArchive(){this.db=null;this.mode='INITIALIZING';this.memory={objects:new Map(),failures:new Map(),events:[]};this.reason=null;}
  BrowserArchive.prototype.init=async function(){
    if(!globalScope.indexedDB){this.mode='MEMORY_EXPORT_ONLY';this.reason='IndexedDB is unavailable.';return this;}
    try{
      const request=globalScope.indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=function(){const db=request.result;if(!db.objectStoreNames.contains('objects'))db.createObjectStore('objects',{keyPath:'objectDigest'});if(!db.objectStoreNames.contains('failures'))db.createObjectStore('failures',{keyPath:'failureDigest'});if(!db.objectStoreNames.contains('events'))db.createObjectStore('events',{keyPath:'eventDigest'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});};
      this.db=await requestResult(request);this.mode='INDEXEDDB_DURABLE';return this;
    }catch(error){this.mode='MEMORY_EXPORT_ONLY';this.reason=String(error&&error.message||error);return this;}
  };
  BrowserArchive.prototype.event=function(type,objectDigest,payload,sequence){const row={schema:'axm.organ-archive-event/v1',sequence:sequence,eventType:type,objectDigest:objectDigest,payload:payload||{},eventDigest:''};row.eventDigest=Fabric.digest(omit(row,'eventDigest'));return row;};
  BrowserArchive.prototype.putCandidate=async function(candidate){
    const verification=Fabric.verifyPackage(candidate);if(!verification.ok)throw new Error('Candidate package failed verification.');
    const object={schema:'axm.organ-archive-object/v1',objectDigest:candidate.package.packageDigest,objectKind:'candidate-package',status:'CURRENT',package:candidate};
    if(this.mode!=='INDEXEDDB_DURABLE'){const disposition=this.memory.objects.has(object.objectDigest)?'DEDUPLICATED':'MEMORY_ONLY';this.memory.objects.set(object.objectDigest,object);if(disposition==='MEMORY_ONLY')this.memory.events.push(this.event('ARCHIVED',object.objectDigest,{persistence:'MEMORY_EXPORT_ONLY'},this.memory.events.length+1));return {disposition:disposition,objectDigest:object.objectDigest,persistence:this.mode};}
    const tx=this.db.transaction(['objects','events','meta'],'readwrite'),objects=tx.objectStore('objects'),events=tx.objectStore('events'),meta=tx.objectStore('meta');
    const existing=await requestResult(objects.get(object.objectDigest));let disposition='DEDUPLICATED';
    if(existing){if(Fabric.canonicalJson(existing)!==Fabric.canonicalJson(object)){tx.abort();throw new Error('DIGEST_COLLISION');}}
    else{const sequenceRow=await requestResult(meta.get('nextSequence')),sequence=sequenceRow?sequenceRow.value:1,event=this.event('ARCHIVED',object.objectDigest,{status:'EXPERIMENTAL'},sequence);objects.add(object);events.add(event);meta.put({key:'nextSequence',value:sequence+1});disposition='CREATED';}
    await transactionDone(tx);return {disposition:disposition,objectDigest:object.objectDigest,persistence:this.mode};
  };
  BrowserArchive.prototype.addSelection=async function(receipt){
    if(receipt.installed||receipt.registered||receipt.staged||receipt.promoted||receipt.canonChanged)throw new Error('Selection exceeds authority ceiling.');
    if(this.mode!=='INDEXEDDB_DURABLE'){const event=this.event('SELECTED',receipt.packageDigest,{selectionReceipt:receipt},this.memory.events.length+1);this.memory.events.push(event);return event;}
    const tx=this.db.transaction(['objects','events','meta'],'readwrite'),objects=tx.objectStore('objects'),events=tx.objectStore('events'),meta=tx.objectStore('meta');
    const object=await requestResult(objects.get(receipt.packageDigest));if(!object){tx.abort();throw new Error('Selected object is absent from archive.');}
    const sequenceRow=await requestResult(meta.get('nextSequence')),sequence=sequenceRow?sequenceRow.value:1,event=this.event('SELECTED',receipt.packageDigest,{selectionReceipt:receipt},sequence);events.add(event);meta.put({key:'nextSequence',value:sequence+1});await transactionDone(tx);return event;
  };
  BrowserArchive.prototype.readAll=async function(storeName){if(this.mode!=='INDEXEDDB_DURABLE'){if(storeName==='objects')return Array.from(this.memory.objects.values());if(storeName==='failures')return Array.from(this.memory.failures.values());return this.memory.events.slice();}const tx=this.db.transaction([storeName],'readonly'),rows=await requestResult(tx.objectStore(storeName).getAll());await transactionDone(tx);return rows;};
  BrowserArchive.prototype.list=async function(){const objects=await this.readAll('objects'),events=await this.readAll('events'),index={schema:'axm.organ-archive-index/v1',derived:true,persistence:this.mode,reason:this.reason,objects:objects.map(function(row){return {objectDigest:row.objectDigest,status:row.status,id:row.package.package.id,strategy:row.package.definition.strategy,score:row.package.evaluation.metrics.score};}).sort(function(a,b){return a.objectDigest.localeCompare(b.objectDigest);}),failures:[],events:events.slice().sort(function(a,b){return a.sequence-b.sequence;}).map(function(row){return {sequence:row.sequence,eventType:row.eventType,objectDigest:row.objectDigest,eventDigest:row.eventDigest};}),indexDigest:''};index.indexDigest=Fabric.digest(omit(index,'indexDigest'));return index;};
  BrowserArchive.prototype.verify=async function(){const objects=await this.readAll('objects'),events=await this.readAll('events'),errors=[];objects.forEach(function(row){const check=Fabric.verifyPackage(row.package);if(!check.ok||row.objectDigest!==row.package.package.packageDigest)errors.push({code:'ARCHIVE_OBJECT_INVALID',objectDigest:row.objectDigest,details:check.errors});});events.forEach(function(row){if(row.eventDigest!==Fabric.digest(omit(row,'eventDigest')))errors.push({code:'ARCHIVE_EVENT_INVALID',eventDigest:row.eventDigest});});return {schema:'axm.organ-archive-verification/v1',ok:errors.length===0,errors:errors,objects:objects.length,events:events.length,persistence:this.mode};};
  BrowserArchive.prototype.exportPack=async function(){const portable={schema:'axm.organ-archive-pack/v1',objects:await this.readAll('objects'),failures:await this.readAll('failures'),events:await this.readAll('events'),packDigest:''};portable.objects.sort(function(a,b){return a.objectDigest.localeCompare(b.objectDigest);});portable.failures.sort(function(a,b){return a.failureDigest.localeCompare(b.failureDigest);});portable.events.sort(function(a,b){return a.sequence-b.sequence;});portable.packDigest=Fabric.digest(omit(portable,'packDigest'));return portable;};
  BrowserArchive.prototype.importPack=async function(portable){
    if(!portable||portable.schema!=='axm.organ-archive-pack/v1'||portable.packDigest!==Fabric.digest(omit(portable,'packDigest')))throw new Error('Archive pack verification failed.');
    for(const object of portable.objects){const check=Fabric.verifyPackage(object.package);if(!check.ok||object.objectDigest!==object.package.package.packageDigest)throw new Error('Imported object failed package verification.');}
    for(const event of portable.events){if(event.eventDigest!==Fabric.digest(omit(event,'eventDigest')))throw new Error('Imported event digest failed verification.');}
    if(this.mode!=='INDEXEDDB_DURABLE'){portable.objects.forEach((row)=>this.memory.objects.set(row.objectDigest,row));portable.failures.forEach((row)=>this.memory.failures.set(row.failureDigest,row));portable.events.forEach((row)=>{if(!this.memory.events.some((x)=>x.eventDigest===row.eventDigest))this.memory.events.push(row);});return {status:'MEMORY_EXPORT_ONLY',objects:portable.objects.length,installed:false,registered:false};}
    const tx=this.db.transaction(['objects','failures','events','meta'],'readwrite'),objects=tx.objectStore('objects'),failures=tx.objectStore('failures'),events=tx.objectStore('events'),meta=tx.objectStore('meta');let maxSequence=0;
    for(const row of portable.objects){const existing=await requestResult(objects.get(row.objectDigest));if(existing&&Fabric.canonicalJson(existing)!==Fabric.canonicalJson(row)){tx.abort();throw new Error('DIGEST_COLLISION');}if(!existing)objects.add(row);}
    for(const row of portable.failures){const existing=await requestResult(failures.get(row.failureDigest));if(existing&&Fabric.canonicalJson(existing)!==Fabric.canonicalJson(row)){tx.abort();throw new Error('DIGEST_COLLISION');}if(!existing)failures.add(row);}
    for(const row of portable.events){const existing=await requestResult(events.get(row.eventDigest));if(existing&&Fabric.canonicalJson(existing)!==Fabric.canonicalJson(row)){tx.abort();throw new Error('DIGEST_COLLISION');}if(!existing)events.add(row);maxSequence=Math.max(maxSequence,row.sequence);}
    const sequenceRow=await requestResult(meta.get('nextSequence'));meta.put({key:'nextSequence',value:Math.max(maxSequence+1,sequenceRow?sequenceRow.value:1)});await transactionDone(tx);return {status:'IMPORTED',objects:portable.objects.length,installed:false,registered:false};
  };
  return {BrowserArchive:BrowserArchive,DB_NAME:DB_NAME};
});
