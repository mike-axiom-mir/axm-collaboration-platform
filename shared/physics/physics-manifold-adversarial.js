'use strict';
const P=require('./axm-physics-core');

function clone(value){return JSON.parse(JSON.stringify(value));}
function add(world,body){return P.addBody(world,body).world;}
function item(id,status,evidence,measurements,limitations){return{id,status,evidence,measurements:measurements||{},limitations:limitations||[]};}

function restingLineage(){
  let world=P.createWorld({gravity:{x:0,y:9.81},fixedDelta:1/60,solverIterations:12,maxSubsteps:8,bounds:false,broadphase:{mode:'spatial-hash',cellSize:.5}});
  world=add(world,{id:'floor',type:'static',shape:{kind:'box',halfWidth:3,halfHeight:.2},position:{x:0,y:4},friction:.9});
  world=add(world,{id:'box',type:'dynamic',shape:{kind:'box',halfWidth:.4,halfHeight:.4},position:{x:0,y:1},friction:.8,restitution:0});
  let maxAge=0,maxNormalImpulse=0,totalMonotonic=true,previous=null,stableKey=true,manifoldSchema=true;
  for(let step=0;step<360;step++){
    world=P.step(world).world;
    const manifold=world.contactManifolds[0];
    if(!manifold)continue;
    stableKey&&=manifold.key==='box|floor';
    manifoldSchema&&=manifold.schema==='axm.physics-contact-manifold/v1';
    maxAge=Math.max(maxAge,manifold.ageSteps);
    maxNormalImpulse=Math.max(maxNormalImpulse,manifold.normalImpulse);
    if(previous&&manifold.ageSteps===previous.ageSteps+1)totalMonotonic&&=manifold.totalNormalImpulse+1e-9>=previous.totalNormalImpulse;
    previous=clone(manifold);
  }
  const slept=world.bodies.find(body=>body.id==='box').sleeping;
  world=P.applyImpulse(world,'box',{x:0,y:-4});
  let sawExit=false,removed=false;
  for(let step=0;step<60;step++){
    world=P.step(world).world;
    sawExit||=world.contactEvents.some(event=>event.type==='EXIT'&&event.key==='box|floor'&&!event.sensor);
    if(sawExit&&world.contactManifolds.length===0){removed=true;break;}
  }
  return item('resting-contact-lineage',stableKey&&manifoldSchema&&maxAge>=30&&maxNormalImpulse>0&&totalMonotonic&&slept&&sawExit&&removed?'PASS':'FAIL','A stable resting contact must keep one bounded identity, accumulate finite solver impulses, and leave no active manifold after EXIT.',{stableKey,manifoldSchema,maxAge,maxNormalImpulse,totalMonotonic,slept,sawExit,removed,finalManifolds:world.contactManifolds.length},['This fixture exercises the default-off translation-only solver; recorded impulses are not scientific force measurements.']);
}

function sensorLineage(){
  let world=P.createWorld({gravity:{x:0,y:0},fixedDelta:.05,solverIterations:6,maxSubsteps:4,bounds:false,sleep:{enabled:false},broadphase:{mode:'spatial-hash',cellSize:.5}});
  world=add(world,{id:'sensor',type:'static',sensor:true,shape:{kind:'box',halfWidth:.4,halfHeight:.8},position:{x:0,y:0}});
  world=add(world,{id:'probe',type:'dynamic',shape:{kind:'circle',radius:.15},position:{x:-2,y:0},velocity:{x:1,y:0},linearDamping:0,gravityScale:0});
  const lifecycle={ENTER:false,STAY:false,EXIT:false};
  let maxAge=0,allSensorTruth=true,allImpulsesZero=true;
  for(let step=0;step<100;step++){
    world=P.step(world).world;
    world.contactEvents.filter(event=>event.key==='probe|sensor').forEach(event=>{lifecycle[event.type]=true;allSensorTruth&&=event.sensor===true;});
    world.contactManifolds.forEach(manifold=>{if(manifold.key!=='probe|sensor')return;maxAge=Math.max(maxAge,manifold.ageSteps);allSensorTruth&&=manifold.sensor===true;allImpulsesZero&&=manifold.normalImpulse===0&&manifold.tangentImpulse===0&&manifold.totalNormalImpulse===0&&manifold.totalTangentImpulse===0;});
  }
  return item('sensor-contact-lineage',Object.values(lifecycle).every(Boolean)&&allSensorTruth&&allImpulsesZero&&maxAge>1&&world.contactManifolds.length===0?'PASS':'FAIL','Sensor identity must survive ENTER/STAY/EXIT without acquiring physical impulses or lingering as an active manifold.',{lifecycle,allSensorTruth,allImpulsesZero,maxAge,finalManifolds:world.contactManifolds.length});
}

function broadphaseManifoldEquivalence(){
  let base=P.createWorld({gravity:{x:0,y:9.81},fixedDelta:1/120,solverIterations:10,maxSubsteps:8,bounds:false,sleep:{enabled:false},broadphase:{mode:'all-pairs',cellSize:.5}});
  base=add(base,{id:'floor',type:'static',shape:{kind:'box',halfWidth:5,halfHeight:.2},position:{x:0,y:5},friction:.9});
  for(let index=0;index<12;index++)base=add(base,{id:'body-'+String(index).padStart(2,'0'),shape:{kind:index%2?'circle':'box',radius:.2,halfWidth:.2,halfHeight:.2},position:{x:-3.3+index*.6,y:1-(index%3)*.3},velocity:{x:(index%2?1:-1)*.15,y:0},friction:.7,restitution:0,linearDamping:0});
  let reference=clone(base),candidate=clone(base);candidate.broadphase={mode:'spatial-hash',cellSize:.5};
  const mismatches=[];
  for(let step=0;step<360;step++){
    reference=P.step(reference).world;candidate=P.step(candidate).world;
    const a=JSON.stringify(reference.contactManifolds),b=JSON.stringify(candidate.contactManifolds);
    if(a!==b){mismatches.push({step:step+1,reference:a.slice(0,500),candidate:b.slice(0,500)});break;}
  }
  return item('broadphase-manifold-equivalence',mismatches.length===0?'PASS':'FAIL','All-pairs and spatial-hash execution must produce identical persistent manifold lineage for the same bounded scene.',{steps:360,mismatches:mismatches.slice(0,3),finalManifolds:candidate.contactManifolds.length,finalChecksum:P.checksum(candidate)},['Same-runtime deterministic equivalence, not cross-engine or cross-platform bitwise proof.']);
}

function boundedManifoldSet(){
  let world=P.createWorld({gravity:{x:0,y:0},fixedDelta:1/120,solverIterations:1,maxSubsteps:1,bounds:false,sleep:{enabled:false},broadphase:{mode:'spatial-hash',cellSize:4}});
  for(let index=0;index<66;index++)world=add(world,{id:'sensor-'+String(index).padStart(2,'0'),type:'dynamic',sensor:true,shape:{kind:'circle',radius:.5},position:{x:(index%11)*.01,y:Math.floor(index/11)*.01},gravityScale:0});
  world=P.step(world).world;
  const theoreticalPairs=66*65/2;
  const schemas=world.contactManifolds.every(manifold=>manifold.schema==='axm.physics-contact-manifold/v1');
  return item('bounded-manifold-set',theoreticalPairs>2048&&world.contacts.length===2048&&world.contactManifolds.length===2048&&world.diagnostics.contactManifoldCount===2048&&schemas?'PASS':'FAIL','Pathological overlap must not grow the active contact/manifold evidence set beyond the declared 2,048-record bound.',{bodies:66,theoreticalPairs,contacts:world.contacts.length,manifolds:world.contactManifolds.length,diagnosticCount:world.diagnostics.contactManifoldCount,schemas});
}

function run(){const checks=[restingLineage(),sensorLineage(),broadphaseManifoldEquivalence(),boundedManifoldSet()],fail=checks.filter(check=>check.status==='FAIL').length;return{schema:'axm.physics-manifold-adversarial/v1',engine:{id:'axm-physics-2d',version:P.VERSION},status:fail?'FAIL':'PASS',checks,summary:{pass:checks.length-fail,fail},truth:{persistentRepresentation:true,warmStarting:'opt-in-not-exercised-by-this-harness',rotation:false,scientificValidation:false}};}
if(require.main===module){const report=run();report.checks.forEach(check=>console.log(check.status.padEnd(5),check.id,'\u00b7',check.evidence,JSON.stringify(check.measurements)));console.log(JSON.stringify(report.summary));if(report.summary.fail)process.exitCode=1;}
module.exports={run};
