'use strict';

const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const cp=require('child_process');
const Compute=require('../../shared/compute-substrate-lab');
const manifest=require('./manifest.json');
const contract=require('./module.contract.json');

let checks=0;function ok(value,message){assert.ok(value,message);checks+=1;}
function run(args){return cp.spawnSync(process.execPath,[path.join(__dirname,'cli.js'),...args],{encoding:'utf8'});}
function intake(){return{schema:Compute.INTAKE_SCHEMA,title:'CLI compute fixture',objective:'Prove bounded compute research flow.',sources:[],milestones:[],substrates:[{id:'mechanical-a',family:'MECHANICAL',role:'CONTROL',title:'Mechanical candidate',description:'Research record only.'}],architectures:[{id:'hybrid-a',title:'Hybrid fixture',objective:'Test body and village record structure.',layers:['BODY','VILLAGE'],substrateIds:['mechanical-a']}],claims:[{id:'claim-a',statement:'The package retains the candidate.',kind:'STATIC_STRUCTURE',risk:'LOW',subjectRefs:['mechanical-a'],passCondition:'Direct package inspection finds it.',counterevidence:'The candidate is absent.',primarySurface:'direct package inspection'}]};}

ok(manifest.id===contract.id&&manifest.version===contract.version,'manifest and contract identity agree');
ok(manifest.status==='EXPERIMENTAL'&&contract.status==='EXPERIMENTAL','tool remains experimental');
ok(JSON.stringify(manifest.permissions)===JSON.stringify(contract.permissions),'permissions agree exactly');
ok(contract.boundaries.refuses.includes('automatic-root-change')&&contract.boundaries.refuses.includes('physical-hardware-execution'),'root and physical action boundaries are explicit');
ok(manifest.accepts.includes(Compute.INTAKE_SCHEMA)&&manifest.produces.includes(Compute.PACKAGE_SCHEMA),'manifest declares compute intake and package contracts');

const root=fs.mkdtempSync(path.join(os.tmpdir(),'axm-compute-cli-'));
try{
  const intakePath=path.join(root,'intake.json'),packagePath=path.join(root,'package.json'),ledgerPath=path.join(root,'ledger.json'),requestPath=path.join(root,'request.json'),proposalPath=path.join(root,'proposal.json'),decisionPath=path.join(root,'decision.json'),nextPath=path.join(root,'next.json');
  fs.writeFileSync(intakePath,JSON.stringify(intake()));
  let result=run(['compile',intakePath,'--out',packagePath]);
  ok(result.status===0&&fs.existsSync(packagePath),'CLI compiles to explicit external output');
  const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));
  ok(Compute.verify(pkg).pass&&pkg.root.selected.year===1837,'CLI package verifies with 1837 selected');
  result=run(['compile',intakePath,'--out',packagePath]);ok(result.status!==0&&/already exists/.test(result.stderr)&&JSON.parse(fs.readFileSync(packagePath,'utf8')).packageDigest===pkg.packageDigest,'CLI refuses to overwrite an existing derived artifact');
  result=run(['verify',packagePath]);ok(result.status===0&&JSON.parse(result.stdout).pass,'CLI verify reports PASS');
  result=run(['create-ledger',packagePath,'--out',ledgerPath]);ok(result.status===0&&fs.existsSync(ledgerPath),'CLI creates compute evidence ledger');
  const request={candidateMilestoneId:'analytical-engine-conception-1834-candidate',reason:'CLI exact proposal fixture.',evidenceRefs:[{surface:'archive',locator:'archive.bin',digest:'a'.repeat(64)},{surface:'independent review',locator:'review.bin',digest:'b'.repeat(64)}]};
  fs.writeFileSync(requestPath,JSON.stringify(request));
  result=run(['plan-root-change',packagePath,requestPath,'--out',proposalPath]);
  const proposal=JSON.parse(fs.readFileSync(proposalPath,'utf8'));
  ok(result.status===0&&proposal.candidateYear===1834&&!proposal.automatic,'CLI plans a bounded earlier-root proposal');
  const decision={schema:Compute.ROOT_DECISION_SCHEMA,proposalDigest:proposal.proposalDigest,outcome:'ACCEPT',scope:'WORKING_ROOT_ONLY',steward:{id:'fixture-human',kind:'HUMAN'},decidedAt:'2026-08-10T00:00:00Z',evidenceVerdict:'PASS',independentReview:true};
  fs.writeFileSync(decisionPath,JSON.stringify(decision));
  result=run(['apply-root-decision',packagePath,proposalPath,decisionPath,'--out',nextPath]);
  const next=JSON.parse(fs.readFileSync(nextPath,'utf8'));
  ok(result.status===0&&next.root.selected.year===1834&&Compute.verify(next).pass,'CLI applies the exact human working-root decision');
  ok(next.root.history[0].previousRoot.year===1837&&!next.root.history[0].canon,'CLI preserves 1837 history and no CANON authority');
  const machineDecision={...decision,steward:{id:'fixture-machine',kind:'MACHINE'}};fs.writeFileSync(decisionPath,JSON.stringify(machineDecision));
  result=run(['apply-root-decision',packagePath,proposalPath,decisionPath]);ok(result.status!==0&&/human steward/.test(result.stderr),'CLI refuses a machine root decision');
  const forbidden=path.join(__dirname,'forbidden-output.json');result=run(['compile',intakePath,'--out',forbidden]);
  ok(result.status!==0&&!fs.existsSync(forbidden)&&/outside the Workshop/.test(result.stderr),'CLI refuses source-tree output');
  result=run(['help']);ok(result.status===0&&result.stdout.includes('plan-root-change'),'CLI help exposes governed root commands');
}finally{fs.rmSync(root,{recursive:true,force:true});}

console.log('Compute Substrate Lab CLI self-test passed '+checks+' checks.');
