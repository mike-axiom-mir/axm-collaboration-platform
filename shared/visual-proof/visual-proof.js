(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AXMVisualProof=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var RECEIPT_SCHEMA='axm.visual-proof-receipt/v1';
  var VERSION='1.0.0';
  var CLAIM_KINDS=['appearance','interaction','layout','accessibility','motion','artifact-integrity'];
  var VERDICTS=['PASS','FAIL','UNKNOWN'];
  var BACKENDS=['BROWSER_PRIMARY','WINDOWS_FALLBACK','HOST_SUPPLIED','OFFLINE_RENDER'];
  var VISUAL_KINDS=['appearance','interaction','layout','accessibility','motion'];
  var RAW_KEYS=['dataurl','data_url','base64','rawbytes','raw_bytes','pixels','image','images','imagebytes','image_bytes','frame','frames','rawframes','raw_frames','video','blob'];

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function text(value,maximum){value=String(value==null?'':value).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();return maximum&&value.length>maximum?value.slice(0,maximum):value;}
  function stable(value){if(value==null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return'['+value.map(stable).join(',')+']';return'{'+Object.keys(value).sort().filter(function(key){return value[key]!==undefined;}).map(function(key){return JSON.stringify(key)+':'+stable(value[key]);}).join(',')+'}';}
  async function sha256(value){
    var material=typeof value==='string'?value:stable(value);
    if(typeof require==='function')return require('crypto').createHash('sha256').update(material,'utf8').digest('hex');
    if(typeof crypto!=='undefined'&&crypto.subtle){var bytes=new TextEncoder().encode(material),hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).map(function(v){return v.toString(16).padStart(2,'0');}).join('');}
    throw new Error('SHA-256 runtime unavailable');
  }
  function exact(value,label){value=text(value,500);if(!value)throw new Error(label+' is required');if(/[*?\[\]]/.test(value))throw new Error(label+' must be exact; wildcards are forbidden');return value;}
  function verdict(value,label){value=String(value||'').toUpperCase();if(VERDICTS.indexOf(value)<0)throw new Error(label+' must be PASS, FAIL, or UNKNOWN');return value;}
  function portableRef(value){value=text(value,500);if(!value)throw new Error('proof ref is required');if(/^(?:[a-z]:[\\/]|[\\/]|file:)/i.test(value)||/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value))throw new Error('proof refs must be portable and relative');return value;}
  function timestamp(value,label){value=text(value,80);if(!value||!Number.isFinite(Date.parse(value)))throw new Error(label+' must be an ISO timestamp');return value;}
  function digestRef(raw,label){raw=raw||{};var algorithm=text(raw.algorithm,80),value=text(raw.value,200);if(!algorithm||!value)throw new Error(label+' digest algorithm and value are required');if(!/^[a-z0-9][a-z0-9._+-]*$/i.test(algorithm)||!/^[a-z0-9][a-z0-9._:-]{3,199}$/i.test(value))throw new Error(label+' digest is invalid');return{algorithm:algorithm,value:value};}
  function containsRaw(value,path){
    path=path||'input';if(!value||typeof value!=='object')return null;
    if(Array.isArray(value)){for(var index=0;index<value.length;index++){var nested=containsRaw(value[index],path+'['+index+']');if(nested)return nested;}return null;}
    for(var key of Object.keys(value)){var normalized=key.toLowerCase().replace(/[^a-z0-9_]/g,'');if(RAW_KEYS.indexOf(normalized)>=0)return path+'.'+key;var child=containsRaw(value[key],path+'.'+key);if(child)return child;}
    return null;
  }
  function artifact(raw){
    raw=raw||{};var out={id:exact(raw.id,'artifact id'),mediaType:text(raw.mediaType||raw.mime,120),digest:digestRef(raw.digest,'artifact')};
    if(!out.mediaType)throw new Error('artifact mediaType is required');
    if(raw.width!=null){out.width=Math.max(1,Math.round(Number(raw.width)));if(!Number.isFinite(out.width))throw new Error('artifact width is invalid');}
    if(raw.height!=null){out.height=Math.max(1,Math.round(Number(raw.height)));if(!Number.isFinite(out.height))throw new Error('artifact height is invalid');}
    return out;
  }
  function technicalEvidence(rows){
    if(!Array.isArray(rows)||!rows.length)return[];if(rows.length>12)throw new Error('technical evidence budget exceeded');
    return rows.map(function(row,index){row=row||{};var out={schema:exact(row.schema,'technical evidence schema'),digest:digestRef(row.digest,'technical evidence'),verdict:verdict(row.verdict,'technical evidence verdict')};if(row.ref)out.ref=portableRef(row.ref);out.label=text(row.label||('evidence-'+(index+1)),160);return out;});
  }
  function visualEvidence(raw){
    if(!raw)return null;raw=raw||{};var backend=String(raw.backend||'').toUpperCase();if(BACKENDS.indexOf(backend)<0)throw new Error('visual backend is unsupported');
    var viewport=raw.viewport||{},width=Math.round(Number(viewport.width)),height=Math.round(Number(viewport.height));if(!Number.isFinite(width)||width<1||!Number.isFinite(height)||height<1)throw new Error('visual viewport is required');
    var proofRefs=(Array.isArray(raw.proofRefs)?raw.proofRefs:[]).slice(0,12).map(function(row){if(typeof row==='string')return{ref:portableRef(row)};var out={ref:portableRef(row&&row.ref)};if(row&&row.digest)out.digest=digestRef(row.digest,'proof ref');return out;});
    return{backend:backend,observedAt:timestamp(raw.observedAt,'visual observedAt'),viewport:{width:width,height:height},device:text(raw.device||'unspecified',80),verdict:verdict(raw.verdict,'visual evidence verdict'),typedObservation:text(raw.typedObservation,1000),namedSeams:(Array.isArray(raw.namedSeams)?raw.namedSeams:[]).slice(0,20).map(function(seam){return text(seam,160);}).filter(Boolean),proofRefs:proofRefs,frameCount:Math.max(0,Math.round(Number(raw.frameCount)||0)),rollingBufferDigest:raw.rollingBufferDigest?digestRef(raw.rollingBufferDigest,'rolling buffer'):null,cleanupComplete:raw.cleanupComplete===true,rawVideoArchive:false};
  }
  function aggregate(rows){if(!rows.length)return'UNKNOWN';if(rows.some(function(row){return row.verdict==='FAIL';}))return'FAIL';if(rows.some(function(row){return row.verdict==='UNKNOWN';}))return'UNKNOWN';return'PASS';}
  function finalVerdict(technical,visual,visualRequired,visualPresent){if(technical==='FAIL'||visual==='FAIL')return'FAIL';if(technical!=='PASS'||((visualRequired||visualPresent)&&visual!=='PASS'))return'UNKNOWN';return'PASS';}
  function derive(kind,technical,visual){
    var technicalVerdict=aggregate(technical),visualRequired=VISUAL_KINDS.indexOf(kind)>=0,visualVerdict=visual?visual.verdict:'UNKNOWN',seams=[];
    if(visualRequired&&(!visual||!visual.proofRefs.length))seams.push('MISSING_NATIVE_VISUAL_EVIDENCE');
    if(visual&&visual.proofRefs.some(function(row){return!row.digest;}))seams.push('UNBOUND_VISUAL_PROOF_REF');
    if(visual&&visual.cleanupComplete!==true)seams.push('VISUAL_EVIDENCE_CLEANUP_INCOMPLETE');
    if(kind==='motion'&&visual&&visual.frameCount<3&&!visual.rollingBufferDigest)seams.push('MOTION_CADENCE_UNPROVEN');
    if(visual)seams=seams.concat(visual.namedSeams);
    if(visualVerdict!=='FAIL'&&seams.some(function(seam){return seam==='MISSING_NATIVE_VISUAL_EVIDENCE'||seam==='UNBOUND_VISUAL_PROOF_REF'||seam==='VISUAL_EVIDENCE_CLEANUP_INCOMPLETE'||seam==='MOTION_CADENCE_UNPROVEN';}))visualVerdict='UNKNOWN';
    seams=Array.from(new Set(seams.filter(Boolean)));
    return{technicalVerdict:technicalVerdict,visualVerdict:visualVerdict,verdict:finalVerdict(technicalVerdict,visualVerdict,visualRequired,!!visual),namedSeams:seams,cleanupComplete:!visual||visual.cleanupComplete===true};
  }
  function payloadForId(receipt){var payload=clone(receipt);delete payload.receiptId;return payload;}

  async function seal(input){
    input=input||{};var rawPath=containsRaw(input);if(rawPath)throw new Error('raw visual material is forbidden in proof receipts: '+rawPath);
    if(input.visualApproval===true||input.humanApproval===true||input.canonical===true||input.automaticPromotion===true)throw new Error('proof receipt cannot grant approval, canon, or promotion');
    var kind=String(input.claimKind||'').toLowerCase();if(CLAIM_KINDS.indexOf(kind)<0)throw new Error('claimKind is unsupported');
    var technical=technicalEvidence(input.technicalEvidence),visual=visualEvidence(input.visualEvidence),state=derive(kind,technical,visual),observedAt=timestamp(input.observedAt||(visual&&visual.observedAt),'observedAt'),sealedAt=timestamp(input.sealedAt,'sealedAt');
    if(visual&&input.observedAt&&observedAt!==visual.observedAt)throw new Error('top-level and visual observedAt must match');
    if(Date.parse(sealedAt)<Date.parse(observedAt))throw new Error('sealedAt cannot precede observedAt');
    var receipt={schema:RECEIPT_SCHEMA,version:VERSION,receiptId:null,claimId:exact(input.claimId,'claimId'),claimKind:kind,claim:text(input.claim,1000),targetId:exact(input.targetId,'targetId'),artifact:artifact(input.artifact),technicalEvidence:technical,visualEvidence:visual,technicalVerdict:state.technicalVerdict,visualVerdict:state.visualVerdict,verdict:state.verdict,namedSeams:state.namedSeams,observedAt:observedAt,sealedAt:sealedAt,visualApproval:false,humanApproval:false,canonical:false,automaticPromotion:false,authorityInherited:false,rawRetainedBytesAfterSeal:0,rawRetainedItemsAfterSeal:0,cleanupComplete:state.cleanupComplete};
    if(!receipt.claim)throw new Error('claim is required');
    receipt.receiptId='visual-proof-'+(await sha256(payloadForId(receipt))).slice(0,24);return receipt;
  }
  async function verify(receipt){
    var errors=[],rawPath=containsRaw(receipt);if(!receipt||receipt.schema!==RECEIPT_SCHEMA)errors.push('wrong receipt schema');if(!receipt||receipt.version!==VERSION)errors.push('wrong receipt version');if(rawPath)errors.push('raw visual material present at '+rawPath);
    if(receipt&&(receipt.visualApproval!==false||receipt.humanApproval!==false||receipt.canonical!==false||receipt.automaticPromotion!==false||receipt.authorityInherited!==false))errors.push('authority ceiling widened');
    if(receipt&&(receipt.rawRetainedBytesAfterSeal!==0||receipt.rawRetainedItemsAfterSeal!==0))errors.push('raw retention ceiling violated');
    if(receipt){
      try{
        var kind=String(receipt.claimKind||'').toLowerCase();if(CLAIM_KINDS.indexOf(kind)<0)throw new Error('claimKind is unsupported');
        exact(receipt.claimId,'claimId');exact(receipt.targetId,'targetId');if(!text(receipt.claim,1000))throw new Error('claim is required');artifact(receipt.artifact);
        var technical=technicalEvidence(receipt.technicalEvidence),visual=visualEvidence(receipt.visualEvidence),state=derive(kind,technical,visual),observedAt=timestamp(receipt.observedAt,'observedAt'),sealedAt=timestamp(receipt.sealedAt,'sealedAt');
        if(visual&&observedAt!==visual.observedAt)errors.push('top-level and visual observedAt differ');if(Date.parse(sealedAt)<Date.parse(observedAt))errors.push('sealedAt precedes observedAt');
        if(stable(technical)!==stable(receipt.technicalEvidence))errors.push('technical evidence is not normalized');if(stable(visual)!==stable(receipt.visualEvidence))errors.push('visual evidence is not normalized');
        if(receipt.technicalVerdict!==state.technicalVerdict||receipt.visualVerdict!==state.visualVerdict||receipt.verdict!==state.verdict)errors.push('derived verdict mismatch');
        if(stable(receipt.namedSeams)!==stable(state.namedSeams))errors.push('derived seams mismatch');if(receipt.cleanupComplete!==state.cleanupComplete)errors.push('cleanup state mismatch');
      }catch(error){errors.push('invalid receipt content: '+error.message);}
      var expected='visual-proof-'+(await sha256(payloadForId(receipt))).slice(0,24);if(receipt.receiptId!==expected)errors.push('receipt digest mismatch');
    }
    return{pass:errors.length===0,errors:errors};
  }
  async function evidenceDigest(schema,value){return{schema:exact(schema,'evidence schema'),digest:{algorithm:'sha256',value:await sha256(value)}};}
  return{RECEIPT_SCHEMA:RECEIPT_SCHEMA,VERSION:VERSION,CLAIM_KINDS:CLAIM_KINDS.slice(),VISUAL_KINDS:VISUAL_KINDS.slice(),stableStringify:stable,sha256:sha256,containsRaw:containsRaw,evidenceDigest:evidenceDigest,seal:seal,verify:verify};
});
