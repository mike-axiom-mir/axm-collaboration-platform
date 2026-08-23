'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Fabric = require('./index.js');
const ArchiveStore = require('./archive-store.js');

let incomingSerial = 0;

function refuse(code, message, details) {
  const error = new Error(message);
  error.code = code;
  error.details = details || null;
  throw error;
}
function sha256Bytes(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function isWithin(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}
function realExistingDirectory(value, label) {
  const resolved = path.resolve(String(value || ''));
  if (!value || !fs.existsSync(resolved)) refuse('EXISTING_DIRECTORY_REQUIRED', label + ' must be an explicit existing directory.');
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) refuse('REAL_DIRECTORY_REQUIRED', label + ' must be a real non-symlink directory.');
  return resolved;
}
function realExistingFile(value, label) {
  const resolved = path.resolve(String(value || ''));
  if (!value || !fs.existsSync(resolved)) refuse('EXISTING_FILE_REQUIRED', label + ' must be an existing file.');
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink()) refuse('REAL_FILE_REQUIRED', label + ' must be a real non-symlink file.');
  return resolved;
}
function verifyReceiverLineage(mirrorRoot) {
  const bridge=Fabric.ORGAN_ARCHIVE_BRIDGE;
  const contractFile=realExistingFile(path.join(mirrorRoot,'modules','ai-organ-archive','module.contract.json'),'Mirror Organ Archive contract');
  const contractBytes=fs.readFileSync(contractFile),contract=JSON.parse(contractBytes.toString('utf8'));
  const contractFileSha256=sha256Bytes(contractBytes),contractCanonicalDigest=Fabric.digest(contract);
  if(contractFileSha256!==bridge.contractFileSha256||contractCanonicalDigest!==bridge.contractCanonicalDigest||contract.schema!==bridge.contractSchema||contract.id!==bridge.moduleId||contract.version!==bridge.version||contract.status!==bridge.status)refuse('MIRROR_ARCHIVE_LINEAGE_MISMATCH','Mirror Organ Archive contract does not match the Fabric bridge lineage.',{expectedContractCanonicalDigest:bridge.contractCanonicalDigest,actualContractCanonicalDigest:contractCanonicalDigest});
  const receiverFiles=bridge.receiverFiles.map(function(expected){const file=realExistingFile(path.join(mirrorRoot,expected.path),'Mirror Organ Archive receiver dependency'),actual=sha256Bytes(fs.readFileSync(file));if(actual!==expected.sha256)refuse('MIRROR_ARCHIVE_RECEIVER_DRIFT','Mirror Organ Archive receiver bundle requires bridge revalidation.',{file:expected.path,expectedSha256:expected.sha256,actualSha256:actual});return {path:expected.path,sha256:actual};});
  if(Fabric.digest(receiverFiles)!==bridge.receiverBundleDigest)refuse('MIRROR_ARCHIVE_RECEIVER_DRIFT','Mirror Organ Archive receiver bundle digest does not reproduce.');
  const entryPoint=realExistingFile(path.join(mirrorRoot,bridge.receiverEntryPoint),'Mirror Organ Archive receiver entry point'),entryPointSha256=sha256Bytes(fs.readFileSync(entryPoint));
  if(entryPointSha256!==bridge.receiverEntryPointSha256)refuse('MIRROR_ARCHIVE_RECEIVER_DRIFT','Mirror Organ Archive receiver entry point requires bridge revalidation.',{expectedSha256:bridge.receiverEntryPointSha256,actualSha256:entryPointSha256});
  return {entryPoint:entryPoint,contractCanonicalDigest:contractCanonicalDigest,entryPointSha256:entryPointSha256,receiverBundleDigest:bridge.receiverBundleDigest};
}
function preflight(options) {
  options=options||{};
  const fabricArchiveRoot=realExistingDirectory(options.archiveRoot,'Fabric archive root'),mirrorRoot=realExistingDirectory(options.mirrorRoot,'Mirror root'),mirrorArchiveRoot=realExistingDirectory(options.mirrorArchiveRoot,'Mirror archive root');
  const sourceRoot=realExistingDirectory(path.join(mirrorRoot,'organs'),'Mirror organ source root');
  if(isWithin(sourceRoot,mirrorArchiveRoot)||isWithin(mirrorArchiveRoot,sourceRoot))refuse('MIRROR_SOURCE_ARCHIVE_OVERLAP','Mirror organ source root and Mirror archive root must not overlap.');
  if(isWithin(sourceRoot,fabricArchiveRoot)||isWithin(fabricArchiveRoot,sourceRoot))refuse('FABRIC_MIRROR_SOURCE_OVERLAP','Fabric archive root and Mirror organ source root must not overlap.');
  const receiver=verifyReceiverLineage(mirrorRoot),archive=ArchiveStore.openArchive(fabricArchiveRoot),candidate=archive.getPackage(options.packageDigest),envelope=archive.getStashEnvelope(options.packageDigest),plan=Fabric.buildArchiveConnectionPlan(candidate,envelope.stashProjection),planCheck=Fabric.verifyArchiveConnectionPlan(plan,candidate);
  if(!planCheck.ok)refuse('ARCHIVE_CONNECTION_PLAN_INVALID','Fabric archive connection plan failed verification.',planCheck.errors);
  if(envelope.envelopeDigest!==plan.envelopeDigest)refuse('ARCHIVE_CONNECTION_ENVELOPE_DRIFT','Dormant source envelope differs from the connection plan.');
  const relative=envelope.sourceArtifact.path.replace(/^organs\//,''),targetFile=path.resolve(sourceRoot,relative);
  if(!/^([a-z0-9-]+-organ\.js)$/.test(relative)||!isWithin(sourceRoot,targetFile)||path.dirname(targetFile)!==sourceRoot)refuse('MIRROR_SOURCE_PATH_UNSAFE','Dormant source path is outside the declared flat Mirror organs root.');
  return {archive:archive,candidate:candidate,envelope:envelope,plan:plan,receiver:receiver,sourceRoot:sourceRoot,targetFile:targetFile,mirrorArchiveRoot:mirrorArchiveRoot};
}
function placeExactSource(file, content) {
  const bytes=Buffer.from(content,'utf8');
  if(fs.existsSync(file)){
    const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink())refuse('MIRROR_SOURCE_DESTINATION_UNSAFE','Mirror source destination is not a real file.');
    if(!fs.readFileSync(file).equals(bytes))refuse('MIRROR_SOURCE_DESTINATION_COLLISION','Mirror source destination already contains different bytes.');
    return 'REUSED_EXACT_SOURCE_ARTIFACT';
  }
  const temporary=file+'.incoming-'+process.pid+'-'+(++incomingSerial);let descriptor;
  try{
    descriptor=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(descriptor,bytes);fs.fsyncSync(descriptor);fs.closeSync(descriptor);descriptor=undefined;
    try{fs.linkSync(temporary,file);}catch(error){if(error.code!=='EEXIST')throw error;if(!fs.readFileSync(file).equals(bytes))refuse('MIRROR_SOURCE_DESTINATION_COLLISION','Concurrent source placement produced different bytes.');return 'REUSED_EXACT_SOURCE_ARTIFACT';}
    return 'CREATED_SOURCE_ARTIFACT';
  }finally{if(descriptor!==undefined)fs.closeSync(descriptor);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
function createReceiverAcknowledgement(plan, sourceDisposition, result) {
  const partCard=result&&result.partCard;
  if(!partCard||!partCard.source||!partCard.archive)refuse('MIRROR_ARCHIVE_ACK_INVALID','Mirror archive returned no verifiable part card.');
  if(result.archiveObjectId!==plan.sourceArtifact.targetArchiveObjectId||partCard.source.path!==plan.sourceArtifact.path||partCard.source.sha256!==plan.sourceArtifact.sha256)refuse('MIRROR_ARCHIVE_IDENTITY_MISMATCH','Mirror archive acknowledgement does not bind the planned source identity.');
  if(partCard.archive.archiveObjectId!==result.archiveObjectId||partCard.archive.admissionStatus!=='ARCHIVED_NOT_ADMITTED_TO_RUNTIME'||partCard.archive.startupPolicy!=='DORMANT')refuse('MIRROR_ARCHIVE_STATE_MISMATCH','Mirror archive acknowledgement is not a dormant non-admitted object.');
  const basis={schema:'axm.organ-archive-receiver-acknowledgement/v1',targetModuleId:plan.target.moduleId,targetVersion:plan.target.version,targetContractCanonicalDigest:plan.target.contractCanonicalDigest,sourcePath:partCard.source.path,sourceSha256:partCard.source.sha256,sourceDisposition:'SOURCE_ARTIFACT_PRESENT_VERIFIED',archiveObjectId:result.archiveObjectId,archiveObjectDisposition:'ARCHIVE_OBJECT_PRESENT_VERIFIED',archiveAdmissionStatus:partCard.archive.admissionStatus,startupPolicy:partCard.archive.startupPolicy,objectVerified:true,trustedReceiverAdapterLoaded:true,organLoaded:false,organExecuted:false,runtimeConnected:false,runtimeAdmitted:false};
  return Object.assign({},basis,{acknowledgementDigest:Fabric.digest(basis)});
}
function connect(options) {
  const prepared=preflight(options);
  if(options.acknowledge!==Fabric.ORGAN_ARCHIVE_CONNECTION_ACKNOWLEDGEMENT)refuse('HOST_AUTHORIZATION_REQUIRED','Exact host acknowledgement is required before writing Mirror source or archive state.',{required:Fabric.ORGAN_ARCHIVE_CONNECTION_ACKNOWLEDGEMENT});
  const sourceDisposition=placeExactSource(prepared.targetFile,prepared.envelope.sourceArtifact.content);
  const Receiver=require(prepared.receiver.entryPoint);
  if(!Receiver||typeof Receiver.archiveOrganFile!=='function')refuse('MIRROR_ARCHIVE_API_UNAVAILABLE','Bound Mirror receiver does not expose archiveOrganFile.');
  const result=Receiver.archiveOrganFile(prepared.targetFile,{sourceRoot:prepared.sourceRoot,archiveRoot:prepared.mirrorArchiveRoot}),acknowledgement=createReceiverAcknowledgement(prepared.plan,sourceDisposition,result),receipt=Fabric.buildArchiveConnectionReceipt(prepared.plan,acknowledgement),stored=prepared.archive.addConnection(receipt);
  return {schema:'axm.organ-archive-connection-result/v1',status:'EXPERIMENTAL',outcome:receipt.outcome,packageDigest:receipt.packageDigest,planDigest:receipt.planDigest,receiptDigest:receipt.receiptDigest,receiverAcknowledgementDigest:acknowledgement.acknowledgementDigest,sourcePath:receipt.sourceArtifact.path,sourceSha256:receipt.sourceArtifact.sha256,sourceDisposition:sourceDisposition,archiveObjectId:receipt.receiver.archiveObjectId,archiveObjectDisposition:result.state,eventDisposition:stored.disposition,archiveAdmissionStatus:receipt.receiver.archiveAdmissionStatus,startupPolicy:receipt.receiver.startupPolicy,runtimeConnected:false,organLoaded:false,organExecuted:false,runtimeAdmitted:false,installed:false,registered:false,staged:false,promoted:false,canonChanged:false};
}

module.exports={ACKNOWLEDGEMENT:Fabric.ORGAN_ARCHIVE_CONNECTION_ACKNOWLEDGEMENT,preflight:preflight,connect:connect,isWithin:isWithin,verifyReceiverLineage:verifyReceiverLineage};
