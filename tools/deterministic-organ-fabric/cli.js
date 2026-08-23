#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const fabric = require('../../shared/deterministic-organ-fabric/index.js');
const selectedRouteOrgan = require('../../shared/deterministic-organ-fabric/selected-verification-route-organ.js');
const archiveApi = require('../../shared/deterministic-organ-fabric/archive-store.js');
const mirrorConnector = require('../../shared/deterministic-organ-fabric/mirror-archive-connector.js');
const zipStore = require('../agent-tool-forge/zip-store.js');

function fail(code, message, details) {
  const error = new Error(message); error.receipt = { schema:'axm.organ-cli-error/v1', ok:false, code:code, message:message, details:details || null }; throw error;
}
function parseArgs(argv) {
  const result={_:[]};
  for(let i=0;i<argv.length;i+=1){const value=argv[i];if(value.startsWith('--')){const name=value.slice(2);if(i+1>=argv.length||argv[i+1].startsWith('--'))fail('CLI_ARGUMENT_MISSING','Missing value for --'+name);result[name]=argv[++i];}else result._.push(value);}
  return result;
}
function existingFile(value,label){const resolved=path.resolve(String(value||''));if(!value||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())fail('EXISTING_FILE_REQUIRED',label+' must be an existing file.',{path:resolved});return resolved;}
function existingDirectory(value,label){const resolved=path.resolve(String(value||''));if(!value||!fs.existsSync(resolved)||!fs.statSync(resolved).isDirectory())fail('EXISTING_DIRECTORY_REQUIRED',label+' must be an existing directory.',{path:resolved});return resolved;}
function isWithin(parent,child){const relative=path.relative(parent,child);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
function safeFilePath(parent,relative){if(typeof relative!=='string'||!relative||relative.includes('\0')||path.isAbsolute(relative)||relative.replace(/\\/g,'/').split('/').some(function(part){return !part||part==='.'||part==='..';}))fail('PACKAGE_PATH_UNSAFE','Package path is unsafe.',{path:relative});const target=path.resolve(parent,relative);if(!isWithin(path.resolve(parent),target))fail('PACKAGE_PATH_TRAVERSAL','Package path escapes candidate directory.',{path:relative});return target;}
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){fail('JSON_INVALID','Could not parse JSON.',{path:file,error:error.message});}}
function packForIntent(intent){const pack=fabric.findPack(intent&&intent.fieldPackRef&&intent.fieldPackRef.id);if(!pack)fail('FIELD_PACK_UNKNOWN','Intent names an unavailable field pack.',{fieldPackRef:intent&&intent.fieldPackRef});return pack;}
function writeNew(file,content){fs.writeFileSync(file,content,{encoding:typeof content==='string'?'utf8':undefined,flag:'wx'});}
function publicRun(run){return {schema:run.schema,factoryVersion:run.factoryVersion,status:run.status,intentDigest:run.intentDigest,packDigest:run.packDigest,metricProfileId:run.metricProfileId,candidates:run.candidates,failures:run.failures,runDigest:run.runDigest};}
function materialize(run,outputParent){
  const name='organ-run-'+run.candidates[0].definition.id.replace(/-(lean|balanced|guarded)$/,'')+'-'+run.runDigest.slice(7,19),target=path.join(outputParent,name);
  if(fs.existsSync(target))fail('OUTPUT_OVERWRITE_REFUSED','Generated run directory already exists.',{path:target});
  fs.mkdirSync(target,{recursive:false});
  const candidatesRoot=path.join(target,'candidates');fs.mkdirSync(candidatesRoot);
  run.candidates.forEach(function(candidate){
    const folder=path.join(candidatesRoot,candidate.definition.strategy);fs.mkdirSync(folder);
    Object.keys(candidate.files).sort().forEach(function(relative){writeNew(safeFilePath(folder,relative),candidate.files[relative]);});
    const zipBytes=zipStore.build(candidate.files,candidate.package.id);writeNew(path.join(candidatesRoot,candidate.definition.strategy+'.zip'),Buffer.from(zipBytes));
  });
  const comparison=fabric.compareCandidates(run);
  writeNew(path.join(target,'generation-run.json'),JSON.stringify(publicRun(run),null,2)+'\n');
  writeNew(path.join(target,'comparison.json'),JSON.stringify(comparison,null,2)+'\n');
  if(run.failures.length)writeNew(path.join(target,'failure-receipts.json'),JSON.stringify(run.failures,null,2)+'\n');
  return {directory:target,comparison:comparison};
}
function commandValidate(args){const intentFile=existingFile(args.intent,'Intent'),intent=readJson(intentFile),pack=packForIntent(intent),packCheck=fabric.validatePack(pack),intentCheck=fabric.validateIntent(intent,pack);const receipt={schema:'axm.organ-intent-validation/v1',ok:packCheck.ok&&intentCheck.ok,intentDigest:intent.intentDigest||null,packDigest:pack.packDigest,errors:packCheck.errors.concat(intentCheck.errors)};console.log(JSON.stringify(receipt,null,2));if(!receipt.ok)process.exitCode=2;}
function commandGenerate(args){
  const intentFile=existingFile(args.intent,'Intent'),outputParent=existingDirectory(args['output-parent'],'Output parent'),archiveRoot=existingDirectory(args['archive-root'],'Archive root');
  if(isWithin(archiveRoot,intentFile))fail('SOURCE_ARCHIVE_OVERLAP','Intent source cannot be inside the archive root.');
  if(isWithin(outputParent,archiveRoot)||isWithin(archiveRoot,outputParent))fail('OUTPUT_ARCHIVE_OVERLAP','Output parent and archive root must be separate non-overlapping directories.');
  const intent=readJson(intentFile),pack=packForIntent(intent),run=fabric.generateCandidates(intent,pack);
  if(run.status==='REFUSED'&&!run.candidates.length)fail('GENERATION_REFUSED','All generation paths were refused.',run.errors||run.failures);
  const materialized=materialize(run,outputParent),archive=archiveApi.openArchive(archiveRoot),archiveResults=[];
  run.candidates.forEach(function(candidate){archiveResults.push(archive.putPackage(candidate));});run.failures.forEach(function(failure){archiveResults.push(archive.putFailure(failure));});
  console.log(JSON.stringify({schema:'axm.organ-cli-generation/v1',ok:true,status:run.status,runDigest:run.runDigest,outputDirectory:materialized.directory,candidates:run.candidates.map(function(c){return {id:c.package.id,strategy:c.definition.strategy,packageDigest:c.package.packageDigest,score:c.evaluation.metrics.score};}),failures:run.failures.map(function(f){return f.failureDigest;}),archive:archiveResults,comparisonDigest:materialized.comparison.comparisonDigest,installed:false,registered:false,staged:false,promoted:false,canonChanged:false},null,2));
}
function commandCompare(args){const root=existingDirectory(args.run,'Generated run'),file=path.join(root,'generation-run.json');if(!fs.existsSync(file))fail('RUN_RECEIPT_MISSING','Run directory has no generation-run.json.');const run=readJson(file),comparison=fabric.compareCandidates(run);console.log(JSON.stringify(comparison,null,2));}
function commandPlanSelected(args){const brief=readJson(existingFile(args.brief,'Change brief'));try{console.log(JSON.stringify(selectedRouteOrgan.plan(brief),null,2));}catch(error){fail(error.code||'SELECTED_VERIFICATION_ROUTE_REFUSED',error.message,error.details);}}
function commandArchive(args){
  const action=args._[1],root=existingDirectory(args['archive-root'],'Archive root'),archive=archiveApi.openArchive(root);
  if(action==='list')console.log(JSON.stringify(archive.list(),null,2));
  else if(action==='verify')console.log(JSON.stringify(archive.verify(),null,2));
  else if(action==='revalidate')console.log(JSON.stringify(archive.revalidate(),null,2));
  else if(action==='export'){if(!args.pack)fail('PACK_PATH_REQUIRED','archive export requires --pack.');console.log(JSON.stringify(archive.exportPack(args.pack),null,2));}
  else if(action==='import'){const packFile=existingFile(args.pack,'Archive pack');console.log(JSON.stringify(archive.importPack(packFile),null,2));}
  else if(action==='stash-export'){if(!args['package-digest'])fail('PACKAGE_DIGEST_REQUIRED','archive stash-export requires --package-digest.');if(!args.pack)fail('PACK_PATH_REQUIRED','archive stash-export requires --pack.');console.log(JSON.stringify(archive.exportStashEnvelope(args['package-digest'],args.pack),null,2));}
  else if(action==='connection-plan'){if(!args['package-digest'])fail('PACKAGE_DIGEST_REQUIRED','archive connection-plan requires --package-digest.');console.log(JSON.stringify(fabric.buildArchiveConnectionPlan(archive.getPackage(args['package-digest'])),null,2));}
  else if(action==='supersede'){
    if(!args['prior-package-digest'])fail('PRIOR_PACKAGE_DIGEST_REQUIRED','archive supersede requires --prior-package-digest.');
    const replacementSelection=readJson(existingFile(args['replacement-selection'],'Replacement selection receipt')),receipt=fabric.supersedeCandidateSelection(args['prior-package-digest'],replacementSelection,args['selected-by']||replacementSelection.selectedBy);
    console.log(JSON.stringify({schema:'axm.organ-cli-supersession/v1',ok:true,receipt:receipt,result:archive.addSupersession(receipt),installed:false,registered:false,staged:false,promoted:false,canonChanged:false},null,2));
  }
  else if(action==='connect-mirror'){
    if(!args['package-digest'])fail('PACKAGE_DIGEST_REQUIRED','archive connect-mirror requires --package-digest.');
    const mirrorRoot=existingDirectory(args['mirror-root'],'Mirror root'),mirrorArchiveRoot=existingDirectory(args['mirror-archive-root'],'Mirror archive root');
    try{console.log(JSON.stringify(mirrorConnector.connect({archiveRoot:root,packageDigest:args['package-digest'],mirrorRoot:mirrorRoot,mirrorArchiveRoot:mirrorArchiveRoot,acknowledge:args.acknowledge}),null,2));}
    catch(error){fail(error.code||'MIRROR_ARCHIVE_CONNECTION_REFUSED',error.message,error.details);}
  }
  else fail('ARCHIVE_ACTION_UNKNOWN','Expected archive list, verify, revalidate, export, import, stash-export, connection-plan, supersede, or connect-mirror.');
}
function usage(){return 'Deterministic Organ Fabric v1\n\nvalidate --intent <file>\ngenerate --intent <file> --output-parent <existing-dir> --archive-root <existing-dir>\ncompare --run <generated-run-dir>\nplan-selected --brief <file>\narchive list|verify|revalidate --archive-root <dir>\narchive export|import --archive-root <dir> --pack <file>\narchive stash-export --archive-root <dir> --package-digest <sha256:...> --pack <new-file>\narchive connection-plan --archive-root <dir> --package-digest <sha256:...>\narchive supersede --archive-root <dir> --prior-package-digest <sha256:...> --replacement-selection <file> [--selected-by <label>]\narchive connect-mirror --archive-root <dir> --package-digest <sha256:...> --mirror-root <dir> --mirror-archive-root <dir> --acknowledge '+fabric.ORGAN_ARCHIVE_CONNECTION_ACKNOWLEDGEMENT+'\n';}
function main(argv){const args=parseArgs(argv),command=args._[0];if(!command||command==='help'||command==='--help'){console.log(usage());return;}if(command==='validate')return commandValidate(args);if(command==='generate')return commandGenerate(args);if(command==='compare')return commandCompare(args);if(command==='plan-selected')return commandPlanSelected(args);if(command==='archive')return commandArchive(args);fail('COMMAND_UNKNOWN','Unknown command: '+command);}

if(require.main===module){try{main(process.argv.slice(2));}catch(error){console.error(JSON.stringify(error.receipt||{schema:'axm.organ-cli-error/v1',ok:false,code:'UNEXPECTED_ERROR',message:error.message},null,2));process.exitCode=1;}}
module.exports={main:main,parseArgs:parseArgs,materialize:materialize,safeFilePath:safeFilePath,isWithin:isWithin};
