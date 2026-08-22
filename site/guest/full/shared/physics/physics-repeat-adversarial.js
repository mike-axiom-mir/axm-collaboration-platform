'use strict';
const P=require('./axm-physics-core');
function add(w,b){return P.addBody(w,b).world;}
function item(id,status,evidence,measurements,limitations){return{id,status,evidence,measurements:measurements||{},limitations:limitations||[]};}
function movingSupport(){
  let w=P.createWorld({gravity:{x:0,y:9.81},fixedDelta:1/60,solverIterations:12,maxSubsteps:8,bounds:false});
  w=add(w,{id:'support',type:'kinematic',shape:{kind:'box',halfWidth:2,halfHeight:.2},position:{x:0,y:3},velocity:{x:0,y:0},friction:1});
  w=add(w,{id:'rider',type:'dynamic',shape:{kind:'box',halfWidth:.35,halfHeight:.35},position:{x:0,y:2.4},friction:1,restitution:0});
  w=P.simulate(w,360).world;const slept=w.bodies.find(b=>b.id==='rider').sleeping;
  w=typeof P.setVelocity==='function'?P.setVelocity(w,'support',{x:.3,y:0}):(w.bodies.find(b=>b.id==='support').velocity.x=.3,w);
  let firstWake=null;for(let i=0;i<30;i++){w=P.step(w).world;if(!w.bodies.find(b=>b.id==='rider').sleeping&&firstWake==null)firstWake=i+1;}
  const rider=w.bodies.find(b=>b.id==='rider'),support=w.bodies.find(b=>b.id==='support'),relativeX=rider.position.x-support.position.x;
  return item('moving-kinematic-support',slept&&firstWake!==null&&Math.abs(relativeX)<.7?'PASS':'FAIL','A sleeping dynamic rider must wake when its supporting kinematic platform begins a slow deliberate motion.',{sleptBeforeMotion:slept,firstWakeStep:firstWake,riderX:rider.position.x,supportX:support.position.x,relativeX},['This is a translational support fixture; rotation is outside the current engine.']);
}
function wakePropagation(){
  let w=P.createWorld({gravity:{x:0,y:9.81},fixedDelta:1/60,solverIterations:12,maxSubsteps:8,bounds:false});
  w=add(w,{id:'floor',type:'static',shape:{kind:'box',halfWidth:3,halfHeight:.2},position:{x:0,y:5},friction:1});
  for(let i=0;i<5;i++)w=add(w,{id:'box-'+i,type:'dynamic',shape:{kind:'box',halfWidth:.4,halfHeight:.4},position:{x:0,y:4.35-i*.81},friction:.8,restitution:0});
  w=P.simulate(w,600).world;const sleepingBefore=w.bodies.filter(b=>b.type==='dynamic'&&b.sleeping).length;
  w=P.applyImpulse(w,'box-4',{x:2.5,y:1.5});
  let maximumAwake=0;for(let i=0;i<90;i++){w=P.step(w).world;maximumAwake=Math.max(maximumAwake,w.bodies.filter(b=>b.type==='dynamic'&&!b.sleeping).length);}
  return item('wake-propagation-stack',sleepingBefore===5&&maximumAwake>=2?'PASS':'FAIL','An explicit impact on a sleeping stack must propagate wake state beyond only the directly addressed body.',{sleepingBefore,maximumAwake,finalSleeping:w.bodies.filter(b=>b.type==='dynamic'&&b.sleeping).length,checksum:w.diagnostics.checksum},['The gate requires propagation, not a particular final motion.']);
}
function randomSymmetry(){
  let seed=0x41584d32;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  let worstMomentum=0,worstMirror=0,finite=true,samples=[];
  for(let sample=0;sample<32;sample++){
    const speed=.5+random()*5,y=(random()-.5)*2,radius=.12+random()*.25,mass=.5+random()*3;
    let w=P.createWorld({gravity:{x:0,y:0},fixedDelta:1/240,solverIterations:12,maxSubsteps:12,bounds:false,sleep:{enabled:false}});
    w=add(w,{id:'a',shape:{kind:'circle',radius},position:{x:-1.5,y},velocity:{x:speed,y:0},mass,restitution:1,friction:0,linearDamping:0});
    w=add(w,{id:'b',shape:{kind:'circle',radius},position:{x:1.5,y},velocity:{x:-speed,y:0},mass,restitution:1,friction:0,linearDamping:0});
    w=P.simulate(w,360).world;const a=w.bodies.find(b=>b.id==='a'),b=w.bodies.find(b=>b.id==='b'),momentum=Math.hypot(w.diagnostics.momentum.x,w.diagnostics.momentum.y),mirror=Math.abs(a.position.x+b.position.x)+Math.abs(a.velocity.x+b.velocity.x);
    finite&&=[a.position.x,a.position.y,a.velocity.x,a.velocity.y,b.position.x,b.position.y,b.velocity.x,b.velocity.y].every(Number.isFinite);worstMomentum=Math.max(worstMomentum,momentum);worstMirror=Math.max(worstMirror,mirror);samples.push({sample,speed,radius,mass,momentum,mirror});
  }
  return item('seeded-random-symmetry',finite&&worstMomentum<1e-6&&worstMirror<1e-5?'PASS':'FAIL','Thirty-two seeded mirrored elastic collisions must remain finite and preserve mirrored momentum.',{seed:'0x41584d32',samples:32,worstMomentum,worstMirror,finite},['Seeded bounded invariant corpus, not scientific validation.']);
}
function broadphaseEquivalence(){
  const available=typeof P.compareBroadphases==='function';
  if(!available)return item('broadphase-equivalence','FAIL','No candidate broadphase can be promoted without an executable contact-set equivalence gate.',{available:false},['The current engine exposes only its all-pairs detector.']);
  const report=P.compareBroadphases({seed:0x41584d35,scenes:24,bodies:64,steps:12,cellSize:1});
  return item('broadphase-equivalence',report.ok?'PASS':'FAIL','Seeded spatial-hash candidate contact sets must exactly match the all-pairs reference.',report,['Broadphase equivalence does not prove solver or scientific correctness.']);
}
function run(){const checks=[movingSupport(),wakePropagation(),randomSymmetry(),broadphaseEquivalence()],fail=checks.filter(x=>x.status==='FAIL').length;return{schema:'axm.physics-repeat-adversarial/v1',engine:{id:'axm-physics-2d',version:P.VERSION},status:fail?'FAIL':'PASS',checks,summary:{pass:checks.length-fail,fail},truth:{scientificValidation:false,broadphasePromotionRequiresEquivalence:true,scope:'bounded cycles five and six evidence gate'}};}
if(require.main===module){const r=run();r.checks.forEach(x=>console.log(x.status.padEnd(5),x.id,'\u00b7',x.evidence,JSON.stringify(x.measurements)));console.log(JSON.stringify(r.summary));if(r.summary.fail)process.exitCode=1;}
module.exports={run};
