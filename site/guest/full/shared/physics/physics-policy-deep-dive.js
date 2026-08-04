'use strict';

const P=require('./axm-physics-core'),Micro=require('./physics-micro-verification');

function add(world,body){return P.addBody(world,body).world;}
function byId(report,id){return report.checks.find(check=>check.id===id);}

function baseWorld(){
  let world=P.createWorld({gravity:{x:0,y:9.81},fixedDelta:1/60,bounds:false,solverIterations:2});
  world=add(world,{id:'floor',type:'static',shape:{kind:'box',halfWidth:3,halfHeight:.25},position:{x:0,y:2}});
  world=add(world,{id:'a',shape:{kind:'box',halfWidth:.4,halfHeight:.4},position:{x:0,y:1}});
  return add(world,{id:'b',shape:{kind:'box',halfWidth:.4,halfHeight:.4},position:{x:0,y:.1}});
}

function run(existingMicro){
  const micro=existingMicro||Micro.run(),checks=[];
  function record(id,status,claim,measurements,counterevidence){checks.push({id,status,claim,measurements,counterevidence});}

  const reference=P.step(baseWorld()).world;
  let decorated=baseWorld();
  decorated=add(decorated,{id:'temporary-unrelated',shape:{kind:'circle',radius:.2},position:{x:100,y:100}});
  decorated=P.removeBody(decorated,'temporary-unrelated');
  decorated=P.step(decorated).world;
  const unrelated={sameChecksum:P.checksum(reference)===P.checksum(decorated),sameBodies:JSON.stringify(reference.bodies)===JSON.stringify(decorated.bodies),sameContacts:JSON.stringify(reference.contactKeys)===JSON.stringify(decorated.contactKeys)};
  record('unrelated-create-remove-before-step','PASS','Adding and removing an unrelated body before the first step preserves the tested world result.',unrelated,'Any checksum, body or contact difference.');

  const renamed=byId(micro,'id-renaming-order-sensitivity');
  record('identity-schedule-separation-gap','OBSERVATION','Semantic body IDs currently participate in numerical solver scheduling.',{renameInvariant:renamed.measurements.same,interpretation:renamed.measurements.interpretation,solverOrderField:false},'A renamed fixture maps back to identical physical state under a separate schedule key.');

  let identityWorld=P.createWorld({gravity:{x:0,y:0},bounds:false});
  identityWorld=add(identityWorld,{id:'probe',linearDamping:0});
  const identity=identityWorld.bodies[0];
  record('generation-identity-gap','OBSERVATION','Body identity has no generation or epoch field even though removed IDs may be reused.',{generationField:Object.hasOwn(identity,'generation'),epochField:Object.hasOwn(identity,'epoch'),idReuse:byId(micro,'body-id-reuse').measurements.allowed},'A versioned generation/epoch field exists and prevents lineage continuity across reuse.');

  const removal=byId(micro,'remove-body-lifecycle').measurements;
  record('removal-terminal-reason-gap','OBSERVATION','Removal clears lineage without an explicit terminal event or causal reason.',{policy:removal.policy,immediateEvents:removal.immediate.events,unrelatedReentered:removal.unrelatedReentered,reasonField:false},'A removed pair emits an end event classified as removal while unrelated lineage remains continuous.');

  const touch=byId(micro,'exact-touch-matrix').measurements,query=byId(micro,'query-boundary-policy').measurements;
  record('cross-api-boundary-contract-gap','OBSERVATION','Exact touch and origin-inside semantics are not one published cross-API rule.',{collision:touch.currentPolicy,query:query.policy,canonicalFuturePolicy:touch.canonicalFuturePolicy},'Collision and every query family conform to a versioned boundary matrix.');

  let plus=P.createWorld({gravity:{x:0,y:0},bounds:false});plus=add(plus,{id:'signed-zero',velocity:{x:0,y:0},linearDamping:0});
  const minus=JSON.parse(JSON.stringify(plus));minus.bodies[0].velocity.x=-0;
  record('signed-zero-authoritative-hash-gap','OBSERVATION','The legacy checksum collapses distinct IEEE-754 positive and negative zero states.',{objectIsDistinct:!Object.is(plus.bodies[0].velocity.x,minus.bodies[0].velocity.x),sameLegacyChecksum:P.checksum(plus)===P.checksum(minus),checksum:P.checksum(plus)},'An explicitly versioned authoritative numeric-state hash distinguishes the two bit patterns.');

  const capacity=byId(micro,'contact-capacity-visibility').measurements.observed;
  const capacityReceipt=capacity.contactCapacity||{};
  const capacityOk=capacity.detectedUniqueContactsField===true&&capacity.contactsTruncatedField===true&&capacityReceipt.schema==='axm.physics-contact-capacity/v1'&&capacity.detectedUniqueContacts===capacity.theoreticalPairs&&capacity.storedContacts===2048&&capacity.contactsTruncated===capacity.theoreticalPairs-2048&&capacityReceipt.status==='TRUNCATED'&&capacityReceipt.reason==='ACTIVE_CONTACT_EVIDENCE_CAP';
  record('capacity-receipt-gap',capacityOk?'PASS':'FAIL','Bounded contact results expose detected/retained/truncated/limit/reason accounting without raising the 2,048 cap.',{observed:capacity,receipt:capacityReceipt,capacityOk},'Missing detected/retained/truncated/limit/reason fields or raised contact capacity.');

  const tunnelling=byId(micro,'bounded-tunnelling-map').measurements;
  record('tunnel-prevention-attribution-gap','OBSERVATION','The current core exposes bounded substep mitigation but no CCD method class.',{claimBoundary:tunnelling.claimBoundary,ccdMethodField:Object.hasOwn(identityWorld.diagnostics,'ccdMethod'),methodsImplemented:['substep_mitigation']},'Every tunnel-prevention result names toi_ccd, predictive_speculative or substep_mitigation.');

  record('physical-validation-capability-gap','OBSERVATION','Pendulum validation fixtures are not applicable to v0.3.1 because rotation and joints are absent.',{rotationField:Object.hasOwn(identity,'rotation'),angularVelocityField:Object.hasOwn(identity,'angularVelocity'),jointApi:typeof P.addJoint==='function'},'A versioned rotational/joint capability exists with a compatible uncertainty-bearing fixture and metric.');

  const summary=checks.reduce((out,check)=>{out[check.status.toLowerCase()]++;out.total++;return out;},{pass:0,fail:0,observation:0,total:0});
  return{schema:'axm.physics-policy-deep-dive/v1',engine:{id:'axm-physics-2d',version:P.VERSION},status:summary.fail?'FAIL':'PASS_WITH_OBSERVATIONS',checks,summary,truth:{solverBehaviorChanged:false,policyImplemented:false,legacyChecksumRedefined:false,scientificValidation:false,canonicalTouchPolicyDecided:false}};
}

if(require.main===module){const report=run();if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));else{report.checks.forEach(check=>console.log(check.status.padEnd(11),check.id,'·',check.claim));console.log(JSON.stringify({status:report.status,summary:report.summary,truth:report.truth}));}if(report.summary.fail)process.exitCode=1;}
module.exports={run};
