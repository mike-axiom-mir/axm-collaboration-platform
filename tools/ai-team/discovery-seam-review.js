#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),Discovery=require('../discovery-engine/discovery-core.js'),Packs=require('../discovery-engine/review-packs.js');
const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8');
const shell=read('ai-team.js'),html=read('index.html'),core=read('ai-team-core.js'),hub=read('../../hub/hub-shell.js'),presence=read('../../hub/ai-presence.js'),router=read('../../shared/specialists/specialist-router.js');
const manifest=id=>JSON.parse(read('../'+id+'/manifest.json'));
const children=['agent-command-center','agent-tool-forge','ai-task-talk','model-lab','reasoning-shell','prompt-vault','duo-test'];
const services=['chatgpt-connector','claude-connector','shell-guardian'];
const checks=[
  ['One visible parent declares all seven compatibility views',children.every(id=>manifest(id).integratedInto==='ai-team')],
  ['Connectors and Guardian declare background service roles',services.every(id=>manifest(id).integratedInto==='ai-team'&&/service/.test(manifest(id).serviceRole))],
  ['Twelve beginner-facing views cover control, work, build, evaluation, exploration and learning',/id:'overview'/.test(core)&&/id:'services'/.test(core)&&/id:'forge'/.test(core)&&/id:'specialists'/.test(core)&&/id:'explore'/.test(core)&&/id:'data'/.test(core)],
  ['Specialist views load lazily instead of booting every model tool',html.includes('data-src="../ai-task-talk')&&shell.includes('function ensureFrame')],
  ['Old child Hub messages save through the AI Team parent',shell.includes("msg.type==='hub:ready'")&&shell.includes("msg.type==='hub:save'")],
  ['Questions and proposals require separate open and acknowledge actions',html.includes('Manual decisions only')&&shell.includes('data-open-notice')&&shell.includes('data-ack-notice')],
  ['Hub-raised notices reach Task & Talk even when Overview was last open',shell.includes("localStorage.getItem('axm.collaboration.notice.open')")&&shell.includes("state.view='collaborate'")&&presence.includes("var moduleId='ai-team'")],
  ['Local pause controls only local agents and does not hide connectors',shell.includes("BRIDGE+'/agents/pause'")&&shell.includes('Connectors remain visible while local inference is held')],
  ['Guardian is visible as armed/tripped/offline and reset stays in its confirmed dashboard',shell.includes("service('guardian'")&&html.includes('id="guardianFrame"')&&!shell.includes('/api/shell-guardian/reset')],
  ['Offline services remain visible instead of disappearing',shell.includes("Core.SERVICES.map")&&shell.includes("state:'offline'")],
  ['Refresh polling rejects overlapping runs',shell.includes('if(refreshing)return')&&shell.includes('finally{refreshing=false')],
  ['Existing enabled children automatically promote the new AI Team parent',hub.includes('function promoteIntegratedParents')&&hub.includes('Core.promoteIntegratedParents(this.registry, en)')],
  ['Prompt Workshop hands a versioned bounded prompt to Model Evaluation',read('../prompt-vault/index.html').includes("schema:'axm.ai-team-prompt/v1'")&&shell.includes('routePromptComparison')&&read('../model-lab/index.html').includes("type!=='axm-model-compare-prompt'")],
  ['Dataset examples and training-run evidence persist with separate human review',shell.includes("DATA_STORE='axm.ai-team.data-runs.v1'")&&shell.includes('reviewedAt')&&shell.includes('acceptedAt')&&html.includes('This view records datasets and training experiments. It does not execute training')],
  ['Exploration is explicit opt-in and bounded by question boundary and time',html.includes('Opt-in creative autonomy')&&html.includes('exploreQuestion')&&html.includes('exploreBoundary')&&html.includes('exploreBudget')],
  ['Exploration outputs remain drafts and wisdom candidates until discussion',shell.includes('Evidenced draft artifact saved')&&shell.includes('Wisdom saved as candidate')&&html.includes('does not install software')],
  ['Evidenced proposals raise a visible collaboration notice instead of installing themselves',shell.includes("exploreCall('/submit'")&&shell.includes('loadNotices()')&&html.includes('Raise proposal')],
  ['Specialist masks reuse Discovery contracts with finite attributed checkout and no permission grant',html.includes('Borrow a specialist. Keep your identity.')&&shell.includes("specialistCall('/checkout'")&&shell.includes('no permissions granted')&&read('../../shared/specialists/axm-specialist-library.js').includes("permissionGrant:'NONE'")]
  ,['Specialist Router recommends without checkout skill activation or agent start',router.includes('recommendationOnly:true')&&router.includes('automaticCheckout:false')&&router.includes('automaticSkillActivation:false')&&router.includes('automaticAgentStart:false')&&shell.includes('Checkout form prepared · still not assigned')]
];
let state=Discovery.createSession({id:'ai-team-seam-review',title:'AXM AI Team seam review',subject:'AI Team consolidation and connector/service boundaries',question:'Which boundary could hide a model, lose a notice, imply approval or weaken the Guardian?',evidenceProfile:'SOFTWARE',discoveryMode:'MANUAL'},{id:'ai-team-seam-review',now:'2026-07-12T00:00:00.000Z',actorId:'ai-team-verifier',actorKind:'HUMAN'}),serial=0,open=[];
function record(stage,text,label){serial++;const r=Discovery.recordDiscovery(state,stage,{text,claimLabel:label||'OBSERVED',source:'tools/ai-team/discovery-seam-review.js static integration check'},{now:new Date(Date.parse('2026-07-12T00:00:00.000Z')+serial*1000).toISOString(),actorId:'ai-team-verifier',actorKind:'HUMAN',recordId:'ai-team-seam-'+serial});if(!r.ok)throw Error((r.errors[0]&&r.errors[0].message)||'transition failed');state=r.state;}
checks.forEach(([name,pass])=>{console.log((pass?'PASS  ':'OPEN  ')+name);if(pass)record('realityChecks',name+' — verified in source.');else{open.push(name);record('seams',name+' — OPEN.');}});
[
  'Actual model training remains an external explicit process; AI Team records its run and evidence but does not fake execution.',
  'Prompt comparisons preserve raw outputs and human review; they do not infer a universal winner from one prompt.'
].forEach(text=>record('blindSpots',text,'HYPOTHESIS'));
const pack=Packs.getPack('general-lab',state.subject.statement,state.subject.evidenceProfile);if(!Packs.validatePack(pack).ok)throw Error('invalid Discovery pack');const valid=Discovery.validate(state);if(!valid.ok)throw Error('invalid Discovery state');
console.log('DISCOVERY COUNTS seams='+state.discovery.seams.length+' verified='+state.discovery.realityChecks.length+' future='+state.discovery.blindSpots.length);
console.log('AI TEAM DISCOVERY SEAM PASS — '+open.length+' OPEN');if(open.length)process.exit(1);
