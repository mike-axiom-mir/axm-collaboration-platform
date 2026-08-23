#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const Fabric=require('./index.js');

let passed=0;
function check(value,label){assert(value,label);passed+=1;process.stdout.write('PASS '+label+'\n');}
function reseal(request){delete request.requestDigest;request.requestDigest=Fabric.digest(request);return request;}
function hold(plan,code){return plan.holds.some(function(row){return row.code===code;});}

function main(){
  const catalog=Fabric.loadCatalog(),draft=Fabric.exampleComposition(catalog,false),request=Fabric.exampleComposition(catalog,true);
  check(Fabric.validateCompositionRequest(request).ok,'reviewed composition example satisfies the closed request contract');
  check(Fabric.canonicalJson(request)===Fabric.canonicalJson(Fabric.sealCompositionRequest(request,true)),'composition request sealing is idempotent');
  const reordered=Fabric.clone(request);reordered.nodes.reverse();reordered.edges.reverse();reordered.externalInputs.reverse();reordered.expectedOutputs.reverse();
  check(Fabric.canonicalJson(request)===Fabric.canonicalJson(Fabric.sealCompositionRequest(reordered,true)),'semantic array reordering normalizes to one sealed request');
  const authorityPlan=Fabric.planComposition(draft,catalog);
  check(authorityPlan.status==='HELD'&&hold(authorityPlan,'AUTHORITY_HOLD'),'unreviewed composition stops at an explicit authority hold');

  const plan=Fabric.planComposition(request,catalog);
  check(plan.status==='READY'&&plan.nodeCount===2&&plan.order.join(',')==='transform,review','valid mixed-kind DAG resolves one deterministic order');
  check(plan.nodes.some(function(row){return row.capabilityKind==='HAND'&&row.runtimeMode==='EXECUTABLE';})&&plan.nodes.some(function(row){return row.capabilityKind==='SKILL'&&row.runtimeMode==='HOST_MEDIATED';}),'plan preserves HAND and SKILL runtime modes per node');
  check(plan.requiredHostCapabilities.join(',')==='human-or-agent-procedure-runner/v1','plan exposes the exact external host capability requirement');
  check(plan.edges[0].contract==='axm.capability-review-input/v1'&&plan.totalCandidateBytes>0,'plan binds the exact edge contract and bounded candidate bytes');
  check(plan.evidence.notProven.includes('runtime payload semantic compatibility beyond declared contract identity')&&plan.evidence.notProven.includes('node selftest results'),'plan refuses to overclaim semantic compatibility or test execution');
  check(Fabric.verifyCompositionPlan(plan,request,catalog).state==='PASS','composition plan independently rebuilds and verifies');

  const build=Fabric.buildComposition(request,catalog),again=Fabric.buildComposition(request,catalog);
  check(build.status==='COMPLETE'&&build.nodes.length===2,'composition build emits two detached node candidates');
  check(Fabric.canonicalJson(build)===Fabric.canonicalJson(again),'identical composition input rebuilds byte-identically');
  check(Fabric.verifyComposition(build,catalog).state==='PASS','complete composition build verifies against exact rebuild');
  check(build.generatedCodeExecuted===false&&build.nodeTestsExecuted===false&&Object.values(build.authority).every(function(value){return value===false;}),'composition build executes no generated code or node tests and carries no authority');
  check(build.nodes.every(function(row){return Fabric.verifyCandidate(row.candidate).ok;}),'every composed node remains an independently valid detached package');

  const wrongEdge=Fabric.clone(request);wrongEdge.edges[0].contract='axm.wrong.contract/v1';reseal(wrongEdge);const wrongPlan=Fabric.planComposition(wrongEdge,catalog);
  check(wrongPlan.status==='HELD'&&hold(wrongPlan,'EDGE_SOURCE_CONTRACT_MISSING')&&hold(wrongPlan,'EDGE_TARGET_CONTRACT_MISSING'),'edge contract mismatch names both source and target failures');
  const unbound=Fabric.clone(request);unbound.externalInputs=[];reseal(unbound);
  check(hold(Fabric.planComposition(unbound,catalog),'INPUT_UNBOUND'),'missing external root input becomes a typed unbound-input hold');
  const ambiguous=Fabric.clone(request);ambiguous.externalInputs.push({nodeId:'review',contract:'axm.capability-review-input/v1'});ambiguous.externalInputs.sort(function(a,b){return a.nodeId.localeCompare(b.nodeId);});reseal(ambiguous);
  check(hold(Fabric.planComposition(ambiguous,catalog),'INPUT_BINDING_AMBIGUOUS'),'edge plus external binding to one input is refused as ambiguous');
  const missingOutput=Fabric.clone(request);missingOutput.expectedOutputs[0].contract='axm.missing.output/v1';reseal(missingOutput);
  check(hold(Fabric.planComposition(missingOutput,catalog),'EXPECTED_OUTPUT_MISSING'),'undeclared expected output becomes a typed hold');
  const cyclic=Fabric.clone(request);cyclic.edges.push({from:'review',to:'transform',contract:'axm.capability-review-receipt/v1'});cyclic.edges.sort(function(a,b){return [a.from,a.to,a.contract].join('/').localeCompare([b.from,b.to,b.contract].join('/'));});reseal(cyclic);
  check(hold(Fabric.planComposition(cyclic,catalog),'CYCLE_HOLD'),'cyclic graph is refused before any orchestration claim');
  const childUnreviewed=Fabric.clone(request);childUnreviewed.nodes[0].request=Fabric.sealRequest(childUnreviewed.nodes[0].request,false);reseal(childUnreviewed);
  check(hold(Fabric.planComposition(childUnreviewed,catalog),'NODE_BUILD_HOLD'),'unreviewed child request remains held inside a reviewed composition');

  const oversized=Fabric.clone(request),secondReview=Fabric.clone(oversized.nodes.find(function(row){return row.id==='review';}));secondReview.id='review-two';secondReview.request=Fabric.sealRequest(Object.assign({},secondReview.request,{id:'composition-review-two'}),true);oversized.nodes.push(secondReview);oversized.nodes.sort(function(a,b){return a.id.localeCompare(b.id);});oversized.edges.push({from:'transform',to:'review-two',contract:'axm.capability-review-input/v1'});oversized.edges.sort(function(a,b){return [a.from,a.to,a.contract].join('/').localeCompare([b.from,b.to,b.contract].join('/'));});oversized.expectedOutputs.push({nodeId:'review-two',contract:'axm.capability-review-receipt/v1'});oversized.expectedOutputs.sort(function(a,b){return a.nodeId.localeCompare(b.nodeId);});oversized.limits.maxTotalCandidateBytes=65536;reseal(oversized);
  check(hold(Fabric.planComposition(oversized,catalog),'RESOURCE_HOLD'),'aggregate child packages obey the declared composition byte ceiling');
  const unknown=Fabric.clone(request);unknown.surprise=true;reseal(unknown);
  check(!Fabric.validateCompositionRequest(unknown).ok,'unknown composition request fields are refused even after digest reseal');
  const duplicate=Fabric.clone(request);duplicate.edges.push(Fabric.clone(duplicate.edges[0]));reseal(duplicate);
  check(!Fabric.validateCompositionRequest(duplicate).ok,'duplicate graph edges are refused');
  const tampered=Fabric.clone(build);tampered.nodes[0].candidate.files['README.md']+='drift\n';delete tampered.buildDigest;tampered.buildDigest=Fabric.digest(tampered);
  check(Fabric.verifyComposition(tampered,catalog).state==='FAIL','rehashing cannot hide child package byte tampering');
  const authorityDrift=Fabric.clone(build);authorityDrift.authority.promoted=true;delete authorityDrift.buildDigest;authorityDrift.buildDigest=Fabric.digest(authorityDrift);
  check(Fabric.verifyComposition(authorityDrift,catalog).state==='FAIL','rehashing cannot grant composition promotion authority');
  const heldBuild=Fabric.buildComposition(unbound,catalog);
  check(heldBuild.status==='HELD'&&heldBuild.nodes.length===0&&Fabric.verifyComposition(heldBuild,catalog).state==='PASS','held composition emits no partial candidates and remains verifiable');
  process.stdout.write('Capability Composition shared selftest PASS · '+passed+' checks\n');
}

main();
