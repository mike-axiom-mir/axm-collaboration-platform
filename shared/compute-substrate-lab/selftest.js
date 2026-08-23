'use strict';

const assert = require('assert');
const Compute = require('./index');
const Research = require('../deterministic-research');

let checks=0;
function ok(value,message){assert.ok(value,message);checks+=1;}
function rejects(fn,pattern,message){assert.throws(fn,pattern);checks+=1;if(message)ok(true,message);}
function fixture(){return{
  schema:Compute.INTAKE_SCHEMA,id:'village-compute',title:'Village compute candidates',objective:'Compare compute substrates and hybrid placement without assuming a winner.',
  sources:[{id:'source-chip',title:'Reclaimed node inventory',kind:'LOCAL_INVENTORY',locator:'inventory/nodes.json',evidenceStatus:'DIGEST_BOUND',contentDigest:'d'.repeat(64)}],
  milestones:[{id:'transistor-1947',year:1947,title:'Transistor milestone',claim:'A later electronic switching milestone for comparison.',sourceIds:['source-chip']}],
  substrates:[
    {id:'reclaimed-node',family:'ELECTRONIC',role:'GENERAL_COMPUTE',title:'Reclaimed compute node',description:'Candidate e-waste compute node.',sourceIds:['source-chip'],constraints:['unknown remaining life'],potentialAdvantages:['low acquisition cost']},
    {id:'relay-control',family:'ELECTROMECHANICAL',role:'CONTROL',title:'Relay control candidate',description:'Bounded control substrate research candidate.',constraints:['switching wear']}
  ],
  architectures:[{id:'village-hybrid',title:'Body and village hybrid',objective:'Keep local safety reflexes while sharing heavier village compute.',layers:['BODY','VILLAGE','WORKSHOP'],substrateIds:['reclaimed-node','relay-control'],failureModes:['village disconnect']}],
  claims:[{id:'claim-cost',statement:'A reclaimed village node reduces acquisition cost for the named workload.',kind:'PERFORMANCE',risk:'HIGH',subjectRefs:['village-hybrid'],passCondition:'Measured total acquisition and energy cost is below the declared baseline for the same workload.',counterevidence:'Cost equals or exceeds the baseline or workload requirements are missed.',primarySurface:'named workload cost telemetry',secondarySurface:'independent bill-of-materials and energy audit'}]
};}

const first=Compute.compile(fixture()),second=Compute.compile(fixture());
ok(first.packageDigest===second.packageDigest,'same compute intake compiles deterministically');
ok(Compute.verify(first).pass,'compiled compute package verifies');
ok(first.defaultField==='COMPUTE'&&first.family==='HARDWARE_COMPUTE_RESEARCH'&&first.domain==='COMPUTATION_AND_PHYSICAL_SYSTEMS','shared family and compute default field are explicit');
ok(first.root.selected.year===1837&&first.root.selected.status==='PROVISIONAL','1837 is the provisional selected root');
ok(first.root.selected.notClaimed.includes('earliest conception of the Analytical Engine'),'1837 root does not erase the conception distinction');
ok(first.milestones.some(item=>item.year===1834&&item.status==='RESEARCH_CANDIDATE'),'1834 is preserved as an earlier candidate');
ok(first.architectures[0].state==='PROPOSED'&&!first.architectures[0].deploymentAuthority,'hybrid architecture is not deployed authority');
ok(!first.boundaries.physicalExecution&&!first.boundaries.automaticRootChange&&!first.boundaries.automaticBenchmark,'compute action boundaries are explicit');
ok(first.substrates.every(item=>item.readiness==='RESEARCH_CANDIDATE'&&!item.physicalExecutionAuthority),'substrates remain research candidates');

const packageTamper=JSON.parse(JSON.stringify(first));packageTamper.root.selected.year=1800;
ok(!Compute.verify(packageTamper).pass,'root tampering fails package verification');
const proposalRequest={candidateMilestoneId:'analytical-engine-conception-1834-candidate',reason:'Test whether conception belongs inside the selected lineage scope.',evidenceRefs:[{surface:'institutional archive',locator:'evidence/archive.json',digest:'e'.repeat(64)},{surface:'independent historical analysis',locator:'evidence/analysis.json',digest:'f'.repeat(64)}]};
const proposal=Compute.planRootChange(first,proposalRequest);
ok(proposal.candidateYear===1834&&!proposal.automatic&&!proposal.canonAuthority,'earlier-root proposal is bounded and non-canonical');
ok(proposal.basePackageDigest===first.packageDigest,'root proposal binds the exact package');
ok(/^[a-f0-9]{64}$/.test(proposal.proposalDigest),'root proposal is digest-bound');
const oneSurface=JSON.parse(JSON.stringify(proposalRequest));oneSurface.evidenceRefs[1].surface=oneSurface.evidenceRefs[0].surface;
rejects(()=>Compute.planRootChange(first,oneSurface),/independent surfaces/,'root proposal needs independent evidence surfaces');
const oneEvidence=JSON.parse(JSON.stringify(proposalRequest));oneEvidence.evidenceRefs.pop();
rejects(()=>Compute.planRootChange(first,oneEvidence),/two independent/,'one evidence reference cannot move the root');
rejects(()=>Compute.planRootChange(first,{...proposalRequest,candidateMilestoneId:'transistor-1947'}),/earlier/,'later milestone cannot replace the selected root');

const baseDecision={schema:Compute.ROOT_DECISION_SCHEMA,proposalDigest:proposal.proposalDigest,outcome:'ACCEPT',scope:'WORKING_ROOT_ONLY',steward:{id:'mike',kind:'HUMAN'},decidedAt:'2026-08-10T00:00:00Z',evidenceVerdict:'PASS',independentReview:true};
const accepted=Compute.applyRootDecision(first,proposal,baseDecision);
ok(Compute.verify(accepted).pass,'accepted working-root package verifies');
ok(accepted.root.selected.year===1834&&accepted.root.selected.status==='REVIEWED_WORKING_ROOT','exact human decision can select the earlier working root');
ok(accepted.root.history.length===1&&accepted.root.history[0].previousRoot.year===1837,'superseded 1837 root remains in append-only history');
ok(accepted.root.history[0].canon===false&&accepted.root.history[0].scope==='WORKING_ROOT_ONLY','root decision cannot claim CANON');
ok(accepted.packageDigest!==first.packageDigest,'root decision creates a new exact package state');

const rejected=Compute.applyRootDecision(first,proposal,{...baseDecision,outcome:'REJECT',evidenceVerdict:'UNKNOWN',independentReview:false});
ok(rejected.root.selected.year===1837&&rejected.root.history[0].outcome==='REJECT','rejected proposal preserves 1837 and the decision event');
rejects(()=>Compute.applyRootDecision(first,proposal,{...baseDecision,steward:{id:'agent',kind:'MACHINE'}}),/human steward/,'machine cannot decide the working root');
rejects(()=>Compute.applyRootDecision(first,proposal,{...baseDecision,independentReview:false}),/independent review/,'accepted root needs independent review');
rejects(()=>Compute.applyRootDecision(first,{...proposal,proposalDigest:'0'.repeat(64)},baseDecision),/proposal digest mismatch/,'proposal tampering is refused');
rejects(()=>Compute.applyRootDecision(accepted,proposal,baseDecision),/stale/,'old root proposal cannot apply to a changed package');

let ledger=Compute.createEvidenceLedger(first);
ledger=Compute.ingestEvidence(ledger,{claimId:'claim-cost',surface:'named workload cost telemetry',verdict:'PASS',observedAt:'2026-08-10T00:02:00Z',observer:{id:'meter-a',kind:'MACHINE'},evidenceRefs:[{path:'measure/pass.json',digest:'1'.repeat(64)}]});
ledger=Compute.ingestEvidence(ledger,{claimId:'claim-cost',surface:'independent bill-of-materials and energy audit',verdict:'FAIL',observedAt:'2026-08-10T00:03:00Z',observer:{id:'audit-b',kind:'HUMAN'},evidenceRefs:[{path:'measure/fail.json',digest:'2'.repeat(64)}]});
ok(ledger.claims[0].verdict==='CONFLICT','compute evidence disagreement remains conflict');
ok(Research.Ledger.verify(ledger).pass,'compute evidence ledger verifies');
const snapshot=Compute.snapshot(first,ledger);
ok(snapshot.selectedRoot.year===1837&&snapshot.selectedRoot.status==='PROVISIONAL','snapshot exposes the selected provisional root');
ok(!snapshot.physicalExecutionAuthority&&!snapshot.deploymentAuthority&&!snapshot.rootChangeAuthority,'snapshot grants no action or root authority');

const historyTamper=JSON.parse(JSON.stringify(accepted));historyTamper.root.history[0].outcome='REJECT';delete historyTamper.packageDigest;historyTamper.packageDigest=Research.Core.digest(historyTamper);
ok(!Compute.verify(historyTamper).pass,'rehashing the outer package cannot hide root-history tampering');

console.log('Compute Substrate Lab core self-test passed '+checks+' checks. Selected formal root: 1837 PROVISIONAL.');
