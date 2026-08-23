#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const Fabric=require('../../shared/capability-fabric/index.js');
const Admission=require('../../shared/capability-fabric/admission-core.js');
const Host=require('./admission-host.js');

function usage(){return [
  'Capability Fabric deterministic recipe admission gate',
  '',
  'Inspect one Foundry packet directory without executing source:',
  '  node admission-cli.js inspect --packet-root <dir> [--repo <root> --out <verification.json>]',
  'Execute its exact builder selftest from a sanitized trusted host:',
  '  node admission-cli.js test --packet-root <dir> --confirmation "'+Admission.TEST_CONFIRMATION+'" --repo <root> --out <test-receipt.json>',
  'Build an admission plan:',
  '  node admission-cli.js plan --packet-root <dir> --test-receipt <json> [--review-receipt <json>] [--decision <json>] [--repo <root> --out <plan.json>]',
  'Seal source-review evidence after actual review:',
  '  node admission-cli.js review --packet-root <dir> --test-receipt <json> --evidence <json> --reviewer <name> --confirmation "'+Admission.REVIEW_CONFIRMATION+'" --repo <root> --out <review-receipt.json>',
  'Seal Mike\'s exact reviewed-merge decision:',
  '  node admission-cli.js decision --plan <json> --review-receipt <json> --reviewer "Mike Tobi" --confirmation "'+Admission.DECISION_CONFIRMATION+'" --repo <root> --out <decision.json>',
  'Verify a plan:',
  '  node admission-cli.js verify-plan --packet <plan.json> [--repo <root> --out <verification.json>]',
  '',
  'The gate emits evidence and an exact prospective registry/catalog diff. It never edits source, activates a recipe, installs, registers, stages, promotes, changes Foundation, or changes CANON.'
].join('\n');}
function parseArgs(argv){if(!argv.length||argv.includes('--help')||argv.includes('-h'))return {help:true};const values={action:argv[0]};for(let index=1;index<argv.length;index+=2){const flag=argv[index],value=argv[index+1];if(!/^--[a-z-]+$/.test(flag)||value===undefined||value.startsWith('--'))throw new Error('flags require one explicit value');const key=flag.slice(2).replace(/-([a-z])/g,function(_,letter){return letter.toUpperCase();});if(Object.prototype.hasOwnProperty.call(values,key))throw new Error('duplicate flag: '+flag);values[key]=value;}return values;}
function readJson(file,label){if(!file)throw new Error(label+' is required');const absolute=path.resolve(file),stat=fs.statSync(absolute);if(!stat.isFile()||stat.size>20*1024*1024)throw new Error(label+' must be one JSON file no larger than 20 MiB');return JSON.parse(fs.readFileSync(absolute,'utf8').replace(/^\uFEFF/,''));}
function inside(root,target){const relative=path.relative(path.resolve(root),path.resolve(target));return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));}
function emit(value,options){const serialized=JSON.stringify(value,null,2)+'\n';if(!options.out){process.stdout.write(serialized);return;}if(!options.repo)throw new Error('--repo is required when --out is used');const repositoryRoot=fs.realpathSync(path.resolve(options.repo)),output=path.resolve(options.out);if(fs.existsSync(output))throw new Error('output already exists; overwrite is refused');const parent=path.dirname(output);if(!fs.existsSync(parent)||!fs.statSync(parent).isDirectory())throw new Error('output parent must already exist');const realOutput=path.join(fs.realpathSync(parent),path.basename(output));if(inside(repositoryRoot,realOutput))throw new Error('output must remain outside the repository');const temporary=path.join(path.dirname(realOutput),'.'+path.basename(realOutput)+'.axm-tmp-'+process.pid);try{fs.writeFileSync(temporary,serialized,{encoding:'utf8',flag:'wx'});fs.renameSync(temporary,realOutput);}catch(error){try{fs.rmSync(temporary,{force:true});}catch(_){}throw error;}}
function planInput(options){const inspected=Host.inspectPacketRoot(options.packetRoot);return {proposal:inspected.proposal,packet:inspected.packet,catalog:Fabric.loadCatalog(),foundryVerification:inspected.verification,testReceipt:readJson(options.testReceipt,'--test-receipt'),reviewReceipt:options.reviewReceipt?readJson(options.reviewReceipt,'--review-receipt'):null,decision:options.decision?readJson(options.decision,'--decision'):null};}
function main(argv){const options=parseArgs(argv);if(options.help){process.stdout.write(usage()+'\n');return 0;}if(!['inspect','test','plan','review','decision','verify-plan'].includes(options.action))throw new Error('unsupported admission action');let result;
  if(options.action==='inspect'){if(!options.packetRoot)throw new Error('--packet-root is required');result=Host.inspectPacketRoot(options.packetRoot).verification;}
  else if(options.action==='test'){if(!options.packetRoot||!options.out)throw new Error('test requires --packet-root and --out');result=Host.runExactTest({packetRoot:options.packetRoot,confirmation:options.confirmation});}
  else if(options.action==='plan'){result=Admission.buildPlan(planInput(options));}
  else if(options.action==='review'){
    if(!options.out)throw new Error('review requires --out');const input=planInput(options),pre=Admission.buildPlan(input),evidence=readJson(options.evidence,'--evidence');if(pre.state!=='AWAITING_SOURCE_REVIEW')throw new Error('technical plan is not awaiting source review');
    result=Admission.buildReviewReceipt({proposalDigest:pre.proposalRef.proposalDigest,builderId:pre.proposalRef.builderId,builderDigest:pre.proposalRef.builderDigest,packetDigest:pre.proposalRef.packetDigest,testReceiptDigest:input.testReceipt.receiptDigest,reviewer:options.reviewer,confirmation:options.confirmation,cases:evidence.cases});
  }else if(options.action==='decision'){
    if(!options.out)throw new Error('decision requires --out');const plan=readJson(options.plan,'--plan'),review=readJson(options.reviewReceipt,'--review-receipt');if(plan.state!=='AWAITING_MIKE_DECISION'||Admission.verifyPlan(plan).state!=='PASS')throw new Error('verified AWAITING_MIKE_DECISION plan is required');
    result=Admission.buildDecision({admissionDigest:plan.admissionDigest,proposalDigest:plan.proposalRef.proposalDigest,builderDigest:plan.proposalRef.builderDigest,baseCatalogDigest:plan.baseCatalogDigest,reviewReceiptDigest:review.receiptDigest,reviewer:options.reviewer,confirmation:options.confirmation});
  }else result=Admission.verifyPlan(readJson(options.packet,'--packet'));
  emit(result,options);return ['FAIL','HELD'].includes(result.state)?2:0;
}
if(require.main===module){try{process.exitCode=main(process.argv.slice(2));}catch(error){process.stderr.write('REFUSED: '+Host.publicError(error)+'\n');process.exitCode=1;}}
module.exports={usage:usage,parseArgs:parseArgs,readJson:readJson,inside:inside,emit:emit,planInput:planInput,main:main};
