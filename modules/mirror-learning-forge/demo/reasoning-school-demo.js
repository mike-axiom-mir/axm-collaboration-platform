'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {MirrorLearningForge}=require('../core/forge');
const Reasoning=require('../core/reasoning-school');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'axm-reasoning-school-demo-'));
const forge=new MirrorLearningForge({root:path.resolve(__dirname,'..'),runtimeDir:dir});
const mike={actor_id:'mike',actor_kind:'HUMAN',display_name:'Mike'};
const mirror={actor_id:'mirror-seed-0',actor_kind:'MACHINE',display_name:'Mirror'};
try{
  forge.optIn({actor:mike});
  const task=forge.chooseReasoningClass({actor:mirror,class_id:'reason-decomposition',goal:'Learn to split one confusing failure into small testable questions.'});
  forge.reviewTrackTask({actor:mike,task_id:task.task_id,decision:'APPROVE',reason:'Challenger-only reasoning class.'});
  const sample=Reasoning.sample('reason-decompose-runtime');
  const grade=forge.gradeReasoning({actor:mike,scenario_id:'reason-decompose-runtime',submission:sample});
  const session=forge.captureSession({actor:mike,title:'Reasoning school foundation',source:'local-demo',content:'Strong reasoning separates observation, assumptions, constraints, candidate paths, verification, confidence, repair and memory routing.'});
  forge.reviewSession({actor:mike,session_id:session.session_id,decision:'PERMIT_CANDIDATE',reason:'Bounded reasoning lesson.'});
  const candidate=forge.createCandidate({actor:mike,source_session_ids:[session.session_id],lesson_type:'reasoning_development',claim:'Decompose a problem before selecting a path, preserve uncertainty, and verify the first open seam.',evidence:['local reasoning-school demo'],counterevidence:['Structured fields can be imitated without transfer.'],uncertainty:'One bounded lesson does not prove general reasoning.',disconfirming_test:'Present an unseen cross-domain failure and check whether the same structure transfers.'});
  forge.reviewCandidate({actor:mike,candidate_id:candidate.candidate_id,decision:'APPROVE',reason:'Challenger-only reasoning teaching.'});
  const episode=forge.createReasoningEpisode({actor:mike,candidate_id:candidate.candidate_id,class_id:'reason-decomposition',scenario_id:'reason-decompose-runtime',input:'Decompose a failing local runtime.',expected:JSON.stringify(sample),held_out_variants:[{case_id:'reason-held-phone',input:'A phone cannot connect to a local laptop service.',expected:'Separate network reachability, host binding, port, permission and client-route checks.'},{case_id:'reason-held-art',input:'A valid art packet produces no visible improvement.',expected:'Separate packet validity, pixel change, screenshot evidence and repair.'}],repair_example:'Wrong: guess one root cause. Repair: list dependencies, test the cheapest uncertain link, preserve the failed path.'});
  const profile=forge.reasoningProfile();
  console.log('Mirror chose:',task.title,'·',task.status);
  console.log('Grounded reasoning grade:',grade.verdict,'·',grade.summary.passed+'/'+grade.summary.total);
  console.log('Episode tracks:',episode.training_tracks.join(', '));
  console.log('Profile:',JSON.stringify(profile.summary));
  console.log('Single IQ score:',profile.single_iq_score);
  console.log('Authority from grade:',grade.authority);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
