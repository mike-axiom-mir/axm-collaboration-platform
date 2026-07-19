'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..','..');
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8');}function json(rel){return JSON.parse(read(rel));}
const checks=[
 ['Module is explicitly EXPERIMENTAL',()=>json('tools/governed-evolution-lab/manifest.json').status==='EXPERIMENTAL'],
 ['Automatic inheritance has one browser-local disposable target',()=>json('tools/governed-evolution-lab/module.contract.json').boundaries.automaticWrites.length===1],
 ['Canonical globe rewrite is refused',()=>json('tools/governed-evolution-lab/module.contract.json').boundaries.refuses.includes('canonical-globe-rewrite')],
 ['Mirror originates genomes but does not score or select them',()=>{const organ=read('../AXM_MIRROR_LOCAL/organs/world-genome-organ.js');return organ.includes('This organ does not score, select, apply or canonize')&&!organ.includes('scoreRun(');} ],
 ['The lab, not Mirror roots, owns inheritance state',()=>read('tools/governed-evolution-lab/app.js').includes("STORAGE_KEY='axm.governed-evolution-lab.v1'")],
 ['Exam results carry genome and source lineage',()=>{const html=read('tools/governed-evolution-lab/subject/grafthold-globe-v0.9.html');return html.includes('genome:{...inheritedGenome}')&&html.includes("id:'grafthold-globe-v0.9-pulse'");}],
 ['No remote dependency remains in the experimental globe',()=>!/https?:\/\//.test(read('tools/governed-evolution-lab/subject/grafthold-globe-v0.9.html'))],
 ['Project Room handoff appends and never removes state',()=>{const app=read('tools/governed-evolution-lab/app.js');return app.includes('room.milestones.push')&&!app.includes('localStorage.removeItem');}],
 ['Heartbeat serializes generations and stops with the page',()=>{const app=read('tools/governed-evolution-lab/app.js'),html=read('tools/governed-evolution-lab/index.html');return app.includes("run(1,'heartbeat')")&&app.includes("if(running){heartbeatRecord('busy-skip')")&&html.includes('page closes');}],
 ['Repaired ecology exam is versioned in inheritance receipts',()=>{const app=read('tools/governed-evolution-lab/app.js'),core=read('tools/governed-evolution-lab/evolution-core.js');return app.includes("id:'ecology-epoch-v1'")&&core.includes('examPlan:clone(plan)');}],
 ['Exam reproduction no longer uses unseeded random choices',()=>{const html=read('tools/governed-evolution-lab/subject/grafthold-globe-v0.9.html'),start=html.indexOf('function populationStep()'),end=html.indexOf('/* ---------- campfire',start);return start>0&&end>start&&!html.slice(start,end).includes('Math.random');}],
 ['Real-world route requires consent and human-machine cross-checks',()=>{const log=read('logs/AXM_MILESTONE_2026-07-17_GOVERNED_EVOLUTION_FRONTIER.txt');return log.includes('explicit consent from affected people')&&log.includes('independent human and machine cross-checks');}],
 ['Named scoring seam admits missing fun and player pressure',()=>read('tools/governed-evolution-lab/index.html').includes('player pressure and fun are still unscored seams')],
 ['Creation seam refuses to relabel fixed-genome optimization',()=>{const html=read('tools/governed-evolution-lab/index.html'),doc=read('tools/governed-evolution-lab/README.md'),log=read('logs/AXM_MILESTONE_2026-07-17_GOVERNED_EVOLUTION_FRONTIER.txt');return html.includes('heritable adaptation inside a fixed genotype')&&html.includes('novelty, diversity, changing niches')&&doc.includes('Adaptation is not creation')&&log.includes('FIRST HERITABLE ADAPTATION PROOF');}],
 ['Project Room receives the open-ended creation rung',()=>read('tools/governed-evolution-lab/app.js').includes("id:'card-open-ended-creation-rung'")]
 ,['Creation incubator preserves diversity instead of one scalar winner',()=>{const contract=json('tools/governed-evolution-lab/creation-rung.contract.json');return contract.selection.kind==='quality-diversity-not-single-winner'&&contract.selection.preserveUnknownPotential===true&&contract.refuses.includes('winner-takes-all-archive-erasure');}]
 ,['Creation language extensions require stricter review',()=>{const core=read('tools/governed-evolution-lab/creation-core.js');return core.includes("status:'STRICT_REVIEW_REQUIRED'")&&core.includes('automaticPromotion:false');}]
];
let failed=0;checks.forEach(([name,fn])=>{try{if(!fn())throw Error('condition false');console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' · '+e.message);}});console.log('\n'+(checks.length-failed)+' PASS · '+failed+' FAIL · Governed Evolution seam review');if(failed)process.exitCode=1;
