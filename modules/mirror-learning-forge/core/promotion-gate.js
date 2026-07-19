'use strict';
const C=require('./constants');
const {now,safeId,sha256,clone}=require('./utils');
function create({candidate,challenger,baseline,baselineEvaluation,challengerEvaluation,seamVerdict,actor}){
  const recommendation=seamVerdict.verdict;
  const packet={
    schema:C.SCHEMAS.PROMOTION,
    packet_id:safeId('promotion'),
    candidate_id:candidate.candidate_id,
    challenger_model_id:challenger.model_id,
    challenger_hash:challenger.hash,
    baseline_model_id:baseline&&baseline.model_id||null,
    baseline_hash:baseline&&baseline.hash||null,
    comparison:{baseline:clone(baselineEvaluation.summary),challenger:clone(challengerEvaluation.summary)},
    seam_verdict_id:seamVerdict.verdict_id,
    open_seams:clone(seamVerdict.seams),
    recommendation,
    status:'UNDER_REVIEW',
    requested_by:clone(actor),
    reviewer_decisions:[],
    rollback_ready:true,
    created_at:now()
  };
  packet.hash=sha256({...packet,hash:undefined});
  return packet;
}
function review(packet,{decision,reviewer,reason}){
  if(packet.status!=='UNDER_REVIEW') throw new Error('promotion packet is not under review');
  if(!['APPROVE','REJECT','REQUEST_REPAIR'].includes(decision)) throw new Error('invalid review decision');
  if(decision==='APPROVE' && packet.recommendation!=='PROMOTE') throw new Error('cannot approve while Seam Cell recommendation is '+packet.recommendation);
  packet.reviewer_decisions.push({decision,reviewer:clone(reviewer),reason:String(reason||'').trim(),created_at:now()});
  packet.status=decision==='APPROVE'?'APPROVED':decision==='REJECT'?'REJECTED':'UNDER_REVIEW';
  packet.hash=sha256({...packet,hash:undefined});
  return packet;
}
module.exports={create,review};
