'use strict';
const P=require('./axm-physics-core');

function clone(value){return JSON.parse(JSON.stringify(value));}
function add(world,body){return P.addBody(world,body).world;}
function item(id,status,evidence,measurements,limitations){return{id,status,evidence,measurements:measurements||{},limitations:limitations||[]};}
function round(value){return Math.round(value*1e9)/1e9;}
function kineticEnergy(world){return round(world.bodies.reduce((total,body)=>body.type==='dynamic'&&body.enabled?total+.5*body.mass*(body.velocity.x*body.velocity.x+body.velocity.y*body.velocity.y):total,0));}

function buildStack(options={}){
  const dt=options.dt||1/60,warmStart=options.warmStart===true,count=options.count||10;
  let world=P.createWorld({gravity:{x:0,y:9.81},fixedDelta:dt,solverIterations:options.solverIterations||2,maxSubsteps:1,bounds:false,sleep:{enabled:false},broadphase:{mode:'spatial-hash',cellSize:1},constraints:{warmStart,warmStartFactor:.85}});
  world=add(world,{id:'floor',type:'static',shape:{kind:'box',halfWidth:4,halfHeight:.25},position:{x:0,y:10},friction:.9,restitution:0});
  for(let index=0;index<count;index++)world=add(world,{id:'box-'+String(index).padStart(2,'0'),type:'dynamic',shape:{kind:'box',halfWidth:.45,halfHeight:.45},position:{x:0,y:9.29-index*.91},mass:1,friction:.8,restitution:0,linearDamping:0});
  return world;
}

function runStack(options={}){
  const dt=options.dt||1/60,duration=options.duration||10,sampleDuration=options.sampleDuration||3,count=options.count||10;
  let world=buildStack(options),penetrationSum=0,kineticSum=0,peakPenetration=0,samples=0,warmStartedPeak=0,warmImpulsePeak=0;
  const steps=Math.round(duration/dt),sampleFrom=Math.max(0,steps-Math.round(sampleDuration/dt));
  for(let step=0;step<steps;step++){
    world=P.step(world,dt).world;
    warmStartedPeak=Math.max(warmStartedPeak,world.diagnostics.warmStartedContacts||0);
    warmImpulsePeak=Math.max(warmImpulsePeak,world.diagnostics.warmStartAppliedImpulse||0);
    if(step<sampleFrom)continue;
    penetrationSum+=world.diagnostics.maxPenetration;
    kineticSum+=world.diagnostics.kineticEnergy;
    peakPenetration=Math.max(peakPenetration,world.diagnostics.maxPenetration);
    samples++;
  }
  const top=world.bodies.find(body=>body.id==='box-'+String(count-1).padStart(2,'0'));
  const idealTopY=9.3-(count-1)*.9;
  return{world,metrics:{dt,steps,samples,averagePenetration:round(penetrationSum/Math.max(1,samples)),peakPenetration:round(peakPenetration),averageKineticEnergy:round(kineticSum/Math.max(1,samples)),topY:top.position.y,idealTopY,compression:round(Math.max(0,top.position.y-idealTopY)),warmStartedPeak,warmImpulsePeak,checksum:P.checksum(world)}};
}

function featureContract(){
  let world=buildStack({warmStart:true,count:1});
  world=P.step(world).world;
  const configured=world.constraints&&world.constraints.warmStart===true&&Number.isFinite(world.constraints.warmStartFactor);
  const diagnostics=['warmStartEnabled','warmStartedContacts','warmStartAppliedImpulse','warmStartCorrectionImpulse'].every(key=>Object.hasOwn(world.diagnostics,key));
  return item('warm-start-feature-contract',configured&&diagnostics?'PASS':'FAIL','Warm starting must be explicit, opt-in and observable before behavioral results can be interpreted.',{configured:!!configured,diagnostics,version:P.VERSION,constraints:world.constraints||null,diagnosticFields:world.diagnostics});
}

function defaultCompatibility(){
  let implicit=buildStack({warmStart:false,count:6,solverIterations:4}),explicit=clone(implicit);
  delete implicit.constraints;
  explicit.constraints={warmStart:false,warmStartFactor:.85};
  const mismatches=[];
  for(let step=0;step<360;step++){
    implicit=P.step(implicit).world;explicit=P.step(explicit).world;
    const bodyA=JSON.stringify(implicit.bodies),bodyB=JSON.stringify(explicit.bodies),manifoldA=JSON.stringify(implicit.contactManifolds),manifoldB=JSON.stringify(explicit.contactManifolds);
    if(P.checksum(implicit)!==P.checksum(explicit)||bodyA!==bodyB||manifoldA!==manifoldB){mismatches.push({step:step+1,implicit:P.checksum(implicit),explicit:P.checksum(explicit)});break;}
  }
  return item('default-off-compatibility',mismatches.length===0?'PASS':'FAIL','Missing constraint metadata and explicit warmStart=false must retain identical v0.3 body and manifold behavior.',{steps:360,mismatches,finalChecksum:P.checksum(explicit)});
}

function lowIterationStack(){
  const cold=runStack({warmStart:false,solverIterations:2,count:10}),warm=runStack({warmStart:true,solverIterations:2,count:10});
  const ratios={penetration:warm.metrics.averagePenetration/Math.max(1e-12,cold.metrics.averagePenetration),kinetic:warm.metrics.averageKineticEnergy/Math.max(1e-12,cold.metrics.averageKineticEnergy),compression:warm.metrics.compression/Math.max(1e-12,cold.metrics.compression)};
  const improved=[ratios.penetration,ratios.kinetic,ratios.compression].filter(value=>value<=.95).length;
  const noMaterialRegression=ratios.penetration<=1.05&&ratios.kinetic<=1.05&&ratios.compression<=1.05;
  const exercised=warm.metrics.warmStartedPeak>0&&warm.metrics.warmImpulsePeak>0;
  return item('low-iteration-stack-ab',improved>=1&&noMaterialRegression&&exercised?'PASS':'FAIL','Opt-in warm starting must materially improve at least one declared low-iteration stack metric without worsening the others by more than 5%.',{cold:cold.metrics,warm:warm.metrics,ratios,improvedMetrics:improved,noMaterialRegression,exercised},['One deterministic ten-box workload; no universal stability or performance claim.']);
}

function timestepSensitivity(){
  const rates=[30,60,120],cold=[],warm=[];
  rates.forEach(rate=>{cold.push(runStack({warmStart:false,solverIterations:2,count:6,dt:1/rate,duration:8,sampleDuration:2}).metrics);warm.push(runStack({warmStart:true,solverIterations:2,count:6,dt:1/rate,duration:8,sampleDuration:2}).metrics);});
  function spread(rows,key){const values=rows.map(row=>row[key]);return Math.max(...values)-Math.min(...values);}
  const coldSpread={topY:spread(cold,'topY'),compression:spread(cold,'compression')},warmSpread={topY:spread(warm,'topY'),compression:spread(warm,'compression')};
  const noWorse=warmSpread.topY<=coldSpread.topY*1.05+1e-6&&warmSpread.compression<=coldSpread.compression*1.05+1e-6;
  return item('timestep-sensitivity-ab',noWorse?'PASS':'FAIL','Across 30/60/120 Hz fixed steps, warm starting must not increase final stack-height or compression spread by more than 5%.',{rates,cold,warm,coldSpread,warmSpread,noWorse},['Timestep consistency is measured only on this bounded six-box stack.']);
}

function separatingContactEnergy(){
  function settled(warmStart){let world=buildStack({warmStart,count:1,solverIterations:4});for(let step=0;step<300;step++)world=P.step(world).world;world.gravity={x:0,y:0};world=P.applyImpulse(world,'box-00',{x:0,y:-.01});return world;}
  let cold=settled(false),warm=settled(true);
  const before={cold:kineticEnergy(cold),warm:kineticEnergy(warm)};
  cold=P.step(cold).world;warm=P.step(warm).world;
  const after={cold:cold.diagnostics.kineticEnergy,warm:warm.diagnostics.kineticEnergy,warmContactCount:warm.diagnostics.contactCount,warmStartedContacts:warm.diagnostics.warmStartedContacts||0,applied:warm.diagnostics.warmStartAppliedImpulse||0,correction:warm.diagnostics.warmStartCorrectionImpulse||0};
  const exercised=after.warmContactCount>0&&after.warmStartedContacts>0&&after.applied>0&&after.correction>0;
  const bounded=exercised&&after.warm<=after.cold+1e-6&&after.warm<=before.warm+1e-6;
  return item('separating-contact-energy',bounded?'PASS':'FAIL','A cached resting impulse must be actively removed while the contact remains geometrically present and must not add unexplained kinetic energy.',{before,after,exercised,bounded});
}

function deterministicWarmReplay(){
  const first=runStack({warmStart:true,solverIterations:3,count:8,duration:8}),second=runStack({warmStart:true,solverIterations:3,count:8,duration:8});
  const same=first.metrics.checksum===second.metrics.checksum&&JSON.stringify(first.world.contactManifolds)===JSON.stringify(second.world.contactManifolds)&&JSON.stringify(first.metrics)===JSON.stringify(second.metrics);
  return item('deterministic-warm-replay',same?'PASS':'FAIL','Two opt-in runs with identical inputs in one JavaScript runtime must produce identical body, manifold and diagnostic lineage.',{same,first:first.metrics,second:second.metrics},['Same-runtime deterministic evidence only.']);
}

function run(){const checks=[featureContract(),defaultCompatibility(),lowIterationStack(),timestepSensitivity(),separatingContactEnergy(),deterministicWarmReplay()],fail=checks.filter(check=>check.status==='FAIL').length;return{schema:'axm.physics-warm-start-adversarial/v1',engine:{id:'axm-physics-2d',version:P.VERSION},status:fail?'FAIL':'PASS',checks,summary:{pass:checks.length-fail,fail},truth:{warmStartDefault:false,rotation:false,joints:false,scientificValidation:false,generalPerformanceClaim:false}};}
if(require.main===module){const report=run();report.checks.forEach(check=>console.log(check.status.padEnd(5),check.id,'\u00b7',check.evidence,JSON.stringify(check.measurements)));console.log(JSON.stringify(report.summary));if(report.summary.fail)process.exitCode=1;}
module.exports={run,buildStack,runStack};
