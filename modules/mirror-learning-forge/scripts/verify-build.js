'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {sha256}=require('../core/utils');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'BUILD_MANIFEST.json'),'utf8'));
let checked=0;
for(const entry of manifest.files){
  const file=path.join(root,entry.path);
  assert.ok(fs.existsSync(file),'missing '+entry.path);
  assert.strictEqual(fs.statSync(file).size,entry.bytes,'size '+entry.path);
  assert.strictEqual(sha256(fs.readFileSync(file)),entry.sha256,'hash '+entry.path);
  checked++;
}
const integration=JSON.parse(fs.readFileSync(path.join(root,'AXM_INTEGRATION.json'),'utf8'));
const expected={
  automatic_training:false,automatic_promotion:false,live_mirror_apply:false,
  code_execution_authority:false,coding_static_first:true,json_structured_literacy:true,
  creative_studio_classes:true,studio_access_authority:false,studio_visual_receipt_required:true,
  rooted_intelligence_teaching:true,root_canon_edit_authority:false,root_phrase_overlap_primary:false,dissent_preserved:true,
  reasoning_school:true,single_iq_score:false,human_equivalence_claim:false,reasoning_profile_is_benchmark:false,hidden_chain_of_thought_required:false,reasoning_authority_from_grade:false,
  adaptive_communication_school:true,adaptation_is_not_submission:true,semantic_preservation_required:true,audience_model_is_tentative:true,agreement_is_not_success:true,adaptivity_authority_from_grade:false
};
assert.strictEqual(integration.runtime.host,'127.0.0.1');
for(const [key,value] of Object.entries(expected)) assert.strictEqual(integration.authority[key],value,key);
console.log('Build verification PASS:',checked,'files; local/default-deny boundaries intact.');
