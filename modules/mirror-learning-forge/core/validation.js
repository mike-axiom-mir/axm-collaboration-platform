'use strict';
const C=require('./constants');
const Tracks=require('./training-tracks');
const {text}=require('./utils');
function requireFields(obj,fields,label){
  if(!obj || typeof obj!=='object') throw new Error((label||'record')+' must be an object');
  for(const f of fields) if(obj[f]===undefined || obj[f]===null || obj[f]==='') throw new Error((label||'record')+' missing '+f);
  return obj;
}
function validateRawSession(x){
  requireFields(x,['schema','session_id','actor','content','permission','created_at'],'raw session');
  if(x.schema!==C.SCHEMAS.RAW_SESSION) throw new Error('raw session schema mismatch');
  if(!['NOT_REVIEWED','PERMITTED_CANDIDATE','EXCLUDED'].includes(x.permission.state)) throw new Error('invalid session permission state');
  return x;
}
function validateCandidate(x){
  requireFields(x,['schema','candidate_id','source_session_ids','lesson_type','claim','evidence','counterevidence','disconfirming_test','permission','status','created_at'],'candidate lesson');
  if(x.schema!==C.SCHEMAS.CANDIDATE) throw new Error('candidate schema mismatch');
  if(!C.LESSON_TYPES.includes(x.lesson_type)) throw new Error('invalid lesson type');
  if(!Array.isArray(x.source_session_ids)||!x.source_session_ids.length) throw new Error('candidate requires source session');
  if(!Array.isArray(x.evidence)||!x.evidence.length) throw new Error('candidate requires evidence');
  if(!C.CANDIDATE_STATES.includes(x.status)) throw new Error('invalid candidate status');
  return x;
}
function validateEpisode(x){
  requireFields(x,['schema','episode_id','candidate_id','input','expected','unacceptable','held_out_variants','evidence_refs','permission','created_at'],'training episode');
  if(x.schema!==C.SCHEMAS.EPISODE) throw new Error('episode schema mismatch');
  if(!Array.isArray(x.held_out_variants)||!x.held_out_variants.length) throw new Error('episode requires held-out variants');
  x.training_tracks=Tracks.validate(x.training_tracks||['natural_language']);
  if(x.training_tracks.includes('coding_foundations')&&!x.track_metadata?.coding) throw new Error('coding episode requires track_metadata.coding');
  if(x.training_tracks.includes('structured_json')&&!x.track_metadata?.structured) throw new Error('structured JSON episode requires track_metadata.structured');
  if(x.training_tracks.includes('creative_studio')&&!x.track_metadata?.creative_studio) throw new Error('creative Studio episode requires track_metadata.creative_studio');
  if(x.training_tracks.includes('rooted_intelligence')&&!x.track_metadata?.rooted_intelligence) throw new Error('rooted intelligence episode requires track_metadata.rooted_intelligence');
  if(x.training_tracks.includes('reasoning_development')&&!x.track_metadata?.reasoning_development) throw new Error('reasoning development episode requires track_metadata.reasoning_development');
  if(x.training_tracks.includes('adaptive_communication')&&!x.track_metadata?.adaptive_communication) throw new Error('adaptive communication episode requires track_metadata.adaptive_communication');
  return x;
}
function assertNoExecutablePayload(value,path='root'){
  if(value===null||value===undefined) return;
  if(typeof value==='string'){
    const s=value.toLowerCase();
    const danger=['powershell -enc','rm -rf','format c:','curl http','wget http','child_process','eval(','exec(','<script'];
    if(danger.some(x=>s.includes(x))) throw new Error('executable-looking content blocked at '+path);
  } else if(Array.isArray(value)) value.forEach((v,i)=>assertNoExecutablePayload(v,path+'['+i+']'));
  else if(typeof value==='object') Object.entries(value).forEach(([k,v])=>assertNoExecutablePayload(v,path+'.'+text(k,80)));
}
function validateTrackTask(x){
  requireFields(x,['schema','task_id','track_id','prompt','expected','held_out','created_at'],'training track task');
  if(x.schema!==C.SCHEMAS.TRACK_TASK)throw new Error('track task schema mismatch');
  Tracks.validate([x.track_id]);
  if(!Array.isArray(x.held_out)||!x.held_out.length)throw new Error('track task requires held-out cases');
  return x;
}
module.exports={validateRawSession,validateCandidate,validateEpisode,validateTrackTask,assertNoExecutablePayload,requireFields};
