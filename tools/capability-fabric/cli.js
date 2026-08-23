#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Fabric = require('../../shared/capability-fabric/index.js');
const Nursery = require('../detached-candidate-nursery/core/nursery-core.js');

function fail(code,message,details){const error=new Error(message);error.receipt={schema:'axm.capability-cli-error/v1',ok:false,code:code,message:message,details:details||null};throw error;}
function parseArgs(argv){const out={_:[]};for(let i=0;i<argv.length;i+=1){const value=argv[i];if(value.startsWith('--')){const key=value.slice(2);if(i+1>=argv.length||argv[i+1].startsWith('--'))fail('CLI_ARGUMENT_MISSING','Missing value for --'+key);out[key]=argv[++i];}else out._.push(value);}return out;}
function existingFile(value,label){const resolved=path.resolve(String(value||''));if(!value||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())fail('EXISTING_FILE_REQUIRED',label+' must be an existing file.',{path:resolved});if(fs.lstatSync(resolved).isSymbolicLink())fail('SYMLINK_REFUSED',label+' cannot be a symbolic link.',{path:resolved});return resolved;}
function existingDirectory(value,label){const resolved=path.resolve(String(value||''));if(!value||!fs.existsSync(resolved)||!fs.statSync(resolved).isDirectory())fail('EXISTING_DIRECTORY_REQUIRED',label+' must be an existing directory.',{path:resolved});if(fs.lstatSync(resolved).isSymbolicLink())fail('SYMLINK_REFUSED',label+' cannot be a symbolic link.',{path:resolved});return resolved;}
function isWithin(parent,child){const relative=path.relative(parent,child);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
function safeFilePath(parent,relative){if(typeof relative!=='string'||!relative||relative.includes('\0')||path.isAbsolute(relative)||relative.replace(/\\/g,'/').split('/').some(function(part){return !part||part==='.'||part==='..';}))fail('PACKAGE_PATH_UNSAFE','Package path is unsafe.',{path:relative});const target=path.resolve(parent,relative);if(!isWithin(path.resolve(parent),target))fail('PACKAGE_PATH_TRAVERSAL','Package path escapes candidate directory.',{path:relative});return target;}
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){fail('JSON_INVALID','Could not parse JSON.',{path:file,error:error.message});}}
function writeNew(file,content){fs.writeFileSync(file,content,{encoding:'utf8',flag:'wx'});}
function rollbackFreshTarget(outputParent,target){
  const parent=path.resolve(outputParent),resolved=path.resolve(target);
  if(resolved===parent||!isWithin(parent,resolved))throw new Error('Rollback boundary refused.');
  if(!fs.existsSync(resolved))return;
  if(fs.lstatSync(resolved).isSymbolicLink())fs.unlinkSync(resolved);
  else fs.rmSync(resolved,{recursive:true,force:true});
}
function materialize(candidate,outputParent){
  const check=Fabric.verifyCandidate(candidate);if(!check.ok)fail('PACKAGE_INVALID','Candidate failed verification before materialization.',check.errors);
  const parent=fs.realpathSync(existingDirectory(outputParent,'Output parent')),name=candidate.package.id+'-'+candidate.package.packageDigest.slice(7,19),target=path.resolve(parent,name);let created=false;
  if(!isWithin(parent,target)||target===parent)fail('OUTPUT_BOUNDARY_REFUSED','Candidate destination escaped the explicit parent.',{path:target});
  if(fs.existsSync(target))fail('OUTPUT_OVERWRITE_REFUSED','Candidate destination already exists.',{path:target});
  try{
    fs.mkdirSync(target,{recursive:false});created=true;
    Object.keys(candidate.files).sort().forEach(function(relative){const file=safeFilePath(target,relative),fileParent=path.dirname(file);if(fileParent!==target&&!fs.existsSync(fileParent))fs.mkdirSync(fileParent,{recursive:true});if(fileParent!==target&&fs.lstatSync(fileParent).isSymbolicLink())fail('SYMLINK_REFUSED','Candidate subdirectory cannot be a symbolic link.',{path:fileParent});writeNew(file,candidate.files[relative]);});
    const readback={package:Fabric.clone(candidate.package),files:{}};Object.keys(candidate.files).sort().forEach(function(relative){readback.files[relative]=fs.readFileSync(safeFilePath(target,relative),'utf8');});
    const readbackCheck=Fabric.verifyCandidate(readback);if(!readbackCheck.ok)fail('READBACK_VERIFICATION_FAILED','Materialized bytes failed package verification.',readbackCheck.errors);
    const nursery=Nursery.scanSupply(parent),record=nursery.candidates.find(function(row){return row.folder===name;});
    if(!record||record.status!=='READY_FOR_LATER_INTAKE')fail('NURSERY_HOLD','Materialized candidate did not reach structural later-intake readiness.',record||null);
    return {directory:target,readback:readbackCheck,nursery:{status:record.status,structuralInspectionOnly:record.structuralInspectionOnly,codeExecuted:record.truth.codeExecuted}};
  }catch(error){
    if(created){try{rollbackFreshTarget(parent,target);}catch(cleanupError){fail('MATERIALIZATION_CLEANUP_FAILED','Candidate materialization failed and its fresh destination could not be removed.',{cause:error.receipt||error.message,cleanup:cleanupError.message});}}
    throw error;
  }
}
function requestFrom(args){return readJson(existingFile(args.request,'Request'));}
function main(argv){
  const args=parseArgs(argv),command=args._[0],catalog=Fabric.loadCatalog();
  if(!command||command==='help'||command==='--help'){console.log('Capability Fabric v1\n\ncatalog\nvalidate --request <file>\nplan --request <file>\nbuild --request <file> --output-parent <existing-dir>\n');return;}
  if(command==='catalog'){console.log(JSON.stringify({schema:catalog.schema,status:catalog.status,activationPolicy:catalog.activationPolicy,catalogDigest:catalog.catalogDigest,recipes:catalog.recipes.map(function(row){return {id:row.id,family:row.family,capabilityKind:row.capabilityKind,version:row.version,recipeDigest:row.recipeDigest};})},null,2));return;}
  const request=requestFrom(args);
  if(command==='validate'){const result=Fabric.validateRequest(request);console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=2;return;}
  if(command==='plan'){const result=Fabric.planBuild(request,catalog);console.log(JSON.stringify(result,null,2));if(result.status!=='READY')process.exitCode=2;return;}
  if(command==='build'){
    const outputParent=existingDirectory(args['output-parent'],'Output parent'),requestFile=existingFile(args.request,'Request');if(isWithin(outputParent,requestFile))fail('SOURCE_OUTPUT_OVERLAP','Request source cannot be inside the output parent.');
    const run=Fabric.build(request,catalog);if(run.status!=='COMPLETE')fail('BUILD_HELD','Capability build did not complete.',run.plan&&run.plan.holds||run.holds);
    const result=materialize(run.candidates[0],outputParent);console.log(JSON.stringify({schema:'axm.capability-cli-build/v1',ok:true,status:run.status,runDigest:run.runDigest,packageDigest:run.candidates[0].package.packageDigest,outputDirectory:result.directory,nursery:result.nursery,generatedCodeExecuted:false,testsEmitted:true,authority:Fabric.clone(Fabric.AUTHORITY)},null,2));return;
  }
  fail('COMMAND_UNKNOWN','Unknown command: '+command);
}

if(require.main===module){try{main(process.argv.slice(2));}catch(error){console.error(JSON.stringify(error.receipt||{schema:'axm.capability-cli-error/v1',ok:false,code:'UNEXPECTED_ERROR',message:error.message},null,2));process.exitCode=1;}}
module.exports={main:main,parseArgs:parseArgs,materialize:materialize,safeFilePath:safeFilePath,isWithin:isWithin,rollbackFreshTarget:rollbackFreshTarget};
