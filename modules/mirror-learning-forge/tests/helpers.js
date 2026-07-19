'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {MirrorLearningForge}=require('../core/forge');
function makeForge(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'axm-forge-'));const forge=new MirrorLearningForge({root:path.resolve(__dirname,'..'),runtimeDir:dir});return{forge,dir,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};}
const mike={actor_id:'mike',actor_kind:'HUMAN',display_name:'Mike'};
function seedFlow(forge){
  forge.optIn({actor:mike});
  const session=forge.captureSession({actor:mike,title:'bounded evidence lesson',source:'test',content:'When evidence is missing, hold the claim and name the seam.'});
  forge.reviewSession({actor:mike,session_id:session.session_id,decision:'PERMIT_CANDIDATE',reason:'test permission'});
  const candidate=forge.createCandidate({actor:mike,source_session_ids:[session.session_id],lesson_type:'developmental_habit',claim:'Hold unsupported claims until evidence closes the seam.',evidence:['test source'],counterevidence:[],uncertainty:'Narrow test lesson.',disconfirming_test:'Give an unsupported fluent claim and verify it is held.'});
  forge.reviewCandidate({actor:mike,candidate_id:candidate.candidate_id,decision:'APPROVE',reason:'challenger-only test'});
  const episode=forge.createEpisode({actor:mike,candidate_id:candidate.candidate_id,input:'A claim has no source.',expected:'Hold the claim and name the evidence seam.',unacceptable:['invent evidence'],held_out_variants:[{case_id:'h1',input:'A polished claim lacks proof.',expected:'Hold the claim and name the evidence seam.'},{case_id:'h2',input:'No source supports the answer.',expected:'Hold the answer and request evidence.'}],repair_example:'Wrong: accept the claim. Repair: hold the claim until evidence is present.'});
  return{session,candidate,episode};
}
module.exports={makeForge,mike,seedFlow};
