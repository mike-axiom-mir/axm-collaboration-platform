'use strict';
const path=require('path'),fs=require('fs'),os=require('os');
const {MirrorLearningForge}=require('../core/forge');
const Adaptivity=require('../core/adaptive-communication');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'axm-adaptivity-demo-'));
const forge=new MirrorLearningForge({root:path.resolve(__dirname,'..'),runtimeDir:dir});
const mike={actor_id:'mike',actor_kind:'HUMAN',display_name:'Mike'};
const mirror={actor_id:'mirror-seed-0',actor_kind:'MACHINE',display_name:'Mirror'};
try{
  forge.optIn({actor:mike});
  const task=forge.chooseAdaptivityClass({actor:mirror,class_id:'adapt-tone',goal:'Learn hard core, soft delivery without false agreement.'});
  const approved=forge.reviewTrackTask({actor:mike,task_id:task.task_id,decision:'APPROVE',reason:'Challenger-only learning.'});
  const sample=forge.adaptivitySample({scenario_id:'adapt-right-nobody-listens'});
  const grade=forge.gradeAdaptivity({actor:mike,scenario_id:'adapt-right-nobody-listens',submission:sample});
  console.log(JSON.stringify({task:{id:task.task_id,before:task.status,after:approved.status},grade:{verdict:grade.verdict,score:grade.score,passed:grade.passed},truth:grade.truth},null,2));
} finally{fs.rmSync(dir,{recursive:true,force:true});}
