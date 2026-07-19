'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeForge,mike}=require('./helpers');
test('approved promotion changes only active pointer and can roll back',t=>{
  const x=makeForge();t.after(x.cleanup);x.forge.optIn({actor:mike});
  const baseline=x.forge.createBaseline({actor:mike,model_id:'baseline',texts:['mirror baseline'],make_active:true});
  const challenger=x.forge.createBaseline({actor:mike,model_id:'challenger',texts:['mirror challenger repair'],make_active:false});
  const packet={schema:'axm.mirror.promotion-packet/v1',packet_id:'promotion:test',candidate_id:'candidate:test',challenger_model_id:challenger.model_id,challenger_hash:challenger.hash,baseline_model_id:baseline.model_id,baseline_hash:baseline.hash,comparison:{},seam_verdict_id:'seam-verdict:test',open_seams:[],recommendation:'PROMOTE',status:'APPROVED',requested_by:mike,reviewer_decisions:[{decision:'APPROVE',reviewer:mike}],rollback_ready:true,created_at:new Date().toISOString()};
  x.forge.store.mutate('TEST_PACKET_INSERTED',mike,s=>{s.promotion_packets[packet.packet_id]=packet;return packet;});
  const receipt=x.forge.applyPromotion({actor:mike,packet_id:packet.packet_id});
  assert.equal(x.forge.status().active_model_id,challenger.model_id);
  const rolled=x.forge.rollback({actor:mike,application_id:receipt.application_id});
  assert.equal(rolled.previous_model_id,baseline.model_id);
  assert.equal(x.forge.status().active_model_id,baseline.model_id);
});
