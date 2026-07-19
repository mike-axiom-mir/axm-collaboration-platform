'use strict';
const P=require('./axm-physics-core');

function clone(value){return JSON.parse(JSON.stringify(value));}
function add(world,body){return P.addBody(world,body).world;}
function item(id,status,evidence,measurements,limitations){return{id,status,evidence,measurements:measurements||{},limitations:limitations||[]};}
function eventSignature(events){return(events||[]).map(event=>[event.type,event.key,event.sensor?'sensor':'solid'].join(':')).sort().join(',');}

function pairedRun(id,base,steps,inspect){
  let reference=clone(base),candidate=clone(base);
  reference.broadphase={mode:'all-pairs',cellSize:base.broadphase.cellSize};
  candidate.broadphase={mode:'spatial-hash',cellSize:base.broadphase.cellSize};
  const mismatches=[];
  let allPairsPeak=0,spatialHashPeak=0,overflowPeak=0,cellEntryPeak=0,occupiedCellPeak=0;
  const observations={sawSensorEnter:false,sawSensorStay:false,sawSensorExit:false};
  for(let index=0;index<steps;index++){
    reference=P.step(reference).world;
    candidate=P.step(candidate).world;
    allPairsPeak=Math.max(allPairsPeak,reference.diagnostics.broadphasePairs||0);
    spatialHashPeak=Math.max(spatialHashPeak,candidate.diagnostics.broadphasePairs||0);
    overflowPeak=Math.max(overflowPeak,candidate.diagnostics.broadphaseOverflowBodies||0);
    cellEntryPeak=Math.max(cellEntryPeak,candidate.diagnostics.broadphaseCellEntries||0);
    occupiedCellPeak=Math.max(occupiedCellPeak,candidate.diagnostics.broadphaseOccupiedCells||0);
    observations.sawSensorEnter||=candidate.contactEvents.some(event=>event.type==='ENTER'&&event.sensor);
    observations.sawSensorStay||=candidate.contactEvents.some(event=>event.type==='STAY'&&event.sensor);
    observations.sawSensorExit||=candidate.contactEvents.some(event=>event.type==='EXIT'&&event.sensor);
    const referenceContacts=(reference.contactKeys||[]).join(',');
    const candidateContacts=(candidate.contactKeys||[]).join(',');
    const referenceEvents=eventSignature(reference.contactEvents);
    const candidateEvents=eventSignature(candidate.contactEvents);
    if(referenceContacts!==candidateContacts||referenceEvents!==candidateEvents||P.checksum(reference)!==P.checksum(candidate)){
      mismatches.push({step:index+1,referenceContacts,candidateContacts,referenceEvents,candidateEvents,referenceChecksum:P.checksum(reference),candidateChecksum:P.checksum(candidate)});
      break;
    }
  }
  const measurements={steps,allPairsPeak,spatialHashPeak,pairReductionAtPeak:allPairsPeak?1-spatialHashPeak/allPairsPeak:0,overflowPeak,cellEntryPeak,occupiedCellPeak,mismatches:mismatches.slice(0,5),observations,finalChecksum:P.checksum(candidate),finalContacts:(candidate.contactKeys||[]).slice()};
  const extra=inspect?inspect({reference,candidate,measurements,observations}):{ok:true};
  if(extra&&extra.measurements)Object.assign(measurements,extra.measurements);
  return item(id,mismatches.length===0&&(!extra||extra.ok!==false)?'PASS':'FAIL','Spatial-hash behavior must remain step/checksum/contact/lifecycle equivalent to the all-pairs reference.',measurements,(extra&&extra.limitations)||['Bounded deterministic corpus; not a universal performance or scientific-validity claim.']);
}

function giantStaticRegion(){
  let world=P.createWorld({gravity:{x:0,y:9.81},fixedDelta:1/60,solverIterations:10,maxSubsteps:8,bounds:false,sleep:{enabled:false},broadphase:{mode:'all-pairs',cellSize:.25}});
  world=add(world,{id:'continent-floor',type:'static',shape:{kind:'box',halfWidth:5000,halfHeight:.25},position:{x:0,y:5},friction:.9,restitution:0});
  for(let index=0;index<48;index++)world=add(world,{id:'grain-'+String(index).padStart(2,'0'),shape:{kind:index%3===0?'box':'circle',halfWidth:.12,halfHeight:.12,radius:.12},position:{x:-58.75+index*2.5,y:3.8-(index%4)*.08},velocity:{x:(index%2?1:-1)*.05,y:0},mass:.5+(index%5)*.1,friction:.7,restitution:0,linearDamping:0});
  return pairedRun('giant-static-region',world,120,({measurements})=>({
    ok:measurements.spatialHashPeak<measurements.allPairsPeak*.25&&measurements.overflowPeak>=1,
    measurements:{pruningGate:'spatial peak must remain below 25% of all-pairs while at least one oversized body is reported'},
    limitations:['The oversized static must still be compared with every dynamic body; the gate rejects only unrelated dynamic/dynamic all-pairs work.']
  }));
}

function filteredSensorLifecycle(){
  let world=P.createWorld({gravity:{x:0,y:0},fixedDelta:.05,solverIterations:6,maxSubsteps:4,bounds:false,sleep:{enabled:false},broadphase:{mode:'all-pairs',cellSize:.5}});
  world=add(world,{id:'sensor-gate',type:'static',sensor:true,shape:{kind:'box',halfWidth:.35,halfHeight:1},position:{x:0,y:0},collision:{category:2,mask:1}});
  world=add(world,{id:'probe',type:'dynamic',shape:{kind:'circle',radius:.15},position:{x:-2,y:0},velocity:{x:1,y:0},linearDamping:0,gravityScale:0,collision:{category:1,mask:2}});
  world=add(world,{id:'filtered-sensor',type:'static',sensor:true,shape:{kind:'box',halfWidth:.35,halfHeight:1},position:{x:0,y:0},collision:{category:4,mask:8}});
  world=add(world,{id:'negative-a',type:'dynamic',shape:{kind:'circle',radius:.2},position:{x:4,y:0},gravityScale:0,collision:{group:-7}});
  world=add(world,{id:'negative-b',type:'dynamic',shape:{kind:'circle',radius:.2},position:{x:4.1,y:0},gravityScale:0,collision:{group:-7}});
  for(let index=0;index<32;index++)world=add(world,{id:'remote-'+String(index).padStart(2,'0'),type:'static',sensor:true,shape:{kind:'circle',radius:.08},position:{x:20+index*1.25,y:index%2},collision:{category:16,mask:16}});
  return pairedRun('filtered-sensor-lifecycle',world,100,({candidate,observations})=>{
    const keys=(candidate.contactKeys||[]).join(',');
    return{ok:observations.sawSensorEnter&&observations.sawSensorStay&&observations.sawSensorExit&&!keys.includes('filtered-sensor')&&!keys.includes('negative-a|negative-b'),measurements:{lifecycle:observations,filteredContactsAbsent:!keys.includes('filtered-sensor')&&!keys.includes('negative-a|negative-b')}};
  });
}

function densePathology(){
  let world=P.createWorld({gravity:{x:0,y:0},fixedDelta:1/120,solverIterations:4,maxSubsteps:1,bounds:false,sleep:{enabled:false},broadphase:{mode:'all-pairs',cellSize:4}});
  for(let index=0;index<36;index++)world=add(world,{id:'dense-'+String(index).padStart(2,'0'),type:index===0?'dynamic':'static',sensor:true,shape:{kind:'circle',radius:.2},position:{x:(index%6)*.03,y:Math.floor(index/6)*.03},gravityScale:0,collision:{category:1,mask:1}});
  return pairedRun('dense-pathology',world,4,({measurements})=>({ok:measurements.spatialHashPeak===measurements.allPairsPeak,measurements:{honestDegeneration:measurements.spatialHashPeak===measurements.allPairsPeak},limitations:['A single dense cell legitimately degenerates to all-pairs; the core must report this rather than claim universal pruning.']}));
}

function run(){
  const checks=[giantStaticRegion(),filteredSensorLifecycle(),densePathology()];
  const fail=checks.filter(check=>check.status==='FAIL').length;
  return{schema:'axm.physics-broadphase-adversarial/v1',engine:{id:'axm-physics-2d',version:P.VERSION},status:fail?'FAIL':'PASS',checks,summary:{pass:checks.length-fail,fail},truth:{allPairsIsReference:true,defaultPromotionRequiresAllChecks:true,scientificValidation:false,performanceGeneralization:false}};
}

if(require.main===module){const report=run();report.checks.forEach(check=>console.log(check.status.padEnd(5),check.id,'\u00b7',check.evidence,JSON.stringify(check.measurements)));console.log(JSON.stringify(report.summary));if(report.summary.fail)process.exitCode=1;}
module.exports={run};
