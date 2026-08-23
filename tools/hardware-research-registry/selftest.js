'use strict';

const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const Hardware=require('../../shared/hardware-research-registry');
const manifest=require('./manifest.json');
const contract=require('./module.contract.json');

let checks=0;
function ok(value,message){assert.ok(value,message);checks+=1;}
function run(args){return cp.spawnSync(process.execPath,[path.join(__dirname,'cli.js'),...args],{encoding:'utf8'});}
function intake(){return{schema:Hardware.INTAKE_SCHEMA,title:'CLI hardware fixture',objective:'Prove explicit external package flow.',sources:[{id:'s',title:'Fixture',kind:'TEST',locator:'fixture.json',evidenceStatus:'DIGEST_BOUND',contentDigest:'a'.repeat(64)}],candidates:[{id:'c',class:'SENSOR',title:'Fixture sensor',description:'Inert test record.',sourceIds:['s'],safety:{risk:'LOW'}}],builds:[{id:'b',title:'Fixture mount',purpose:'Test records only.',candidateIds:['c']}],claims:[{id:'q',statement:'Fixture record exists.',kind:'EXISTENCE',risk:'LOW',subjectRefs:['b'],passCondition:'Direct package inspection finds the record.',counterevidence:'The record is absent.',primarySurface:'direct package inspection'}]};}

ok(manifest.id===contract.id&&manifest.version===contract.version,'manifest and contract identity agree');
ok(manifest.status==='EXPERIMENTAL'&&contract.status==='EXPERIMENTAL','tool remains experimental');
ok(JSON.stringify(manifest.permissions)===JSON.stringify(contract.permissions),'permissions agree exactly');
ok(contract.boundaries.refuses.includes('physical-hardware-execution')&&contract.boundaries.refuses.includes('source-tree-write'),'physical execution and source writes are refused');
ok(manifest.accepts.includes(Hardware.INTAKE_SCHEMA)&&manifest.produces.includes(Hardware.PACKAGE_SCHEMA),'manifest declares hardware intake and package contracts');

const root=fs.mkdtempSync(path.join(os.tmpdir(),'axm-hardware-cli-'));
try{
  const intakePath=path.join(root,'intake.json'),packagePath=path.join(root,'package.json'),ledgerPath=path.join(root,'ledger.json'),snapshotPath=path.join(root,'snapshot.json');
  fs.writeFileSync(intakePath,JSON.stringify(intake()));
  let result=run(['compile',intakePath,'--out',packagePath]);
  ok(result.status===0&&fs.existsSync(packagePath),'CLI compiles to an explicit external output');
  const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));
  ok(Hardware.verify(pkg).pass&&pkg.builds[0].state==='DESIGN_ONLY','CLI package verifies and remains inert');
  result=run(['compile',intakePath,'--out',packagePath]);
  ok(result.status!==0&&/already exists/.test(result.stderr)&&JSON.parse(fs.readFileSync(packagePath,'utf8')).packageDigest===pkg.packageDigest,'CLI refuses to overwrite an existing derived artifact');
  result=run(['verify',packagePath]);
  ok(result.status===0&&JSON.parse(result.stdout).pass,'CLI verify reports PASS');
  result=run(['create-ledger',packagePath,'--out',ledgerPath]);
  ok(result.status===0&&JSON.parse(fs.readFileSync(ledgerPath,'utf8')).claims[0].verdict==='UNTESTED','CLI creates an untested evidence ledger');
  result=run(['snapshot',packagePath,ledgerPath,'--out',snapshotPath]);
  const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
  ok(result.status===0&&!snapshot.physicalExecutionAuthority&&!snapshot.safetyApprovalAuthority,'CLI snapshot grants no hardware authority');
  result=run(['compile',intakePath]);
  ok(result.status===0&&JSON.parse(result.stdout).packageDigest===pkg.packageDigest,'stdout compilation matches file compilation');
  const forbidden=path.join(__dirname,'forbidden-output.json');
  result=run(['compile',intakePath,'--out',forbidden]);
  ok(result.status!==0&&!fs.existsSync(forbidden)&&/outside the Workshop/.test(result.stderr),'CLI refuses a source-tree output');
  result=run(['compile',intakePath,'--out',path.join(root,'missing','package.json')]);
  ok(result.status!==0,'CLI refuses a missing output parent instead of creating an implicit tree');
  result=run(['help']);
  ok(result.status===0&&result.stdout.includes('DESIGN')===false&&result.stdout.includes('compile INTAKE.json'),'CLI help is available');
}finally{fs.rmSync(root,{recursive:true,force:true});}

console.log('Hardware Research Registry CLI self-test passed '+checks+' checks.');
