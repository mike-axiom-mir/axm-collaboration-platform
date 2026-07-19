'use strict';
const C=require('./constants');
const {now,safeId,sha256}=require('./utils');

function seam(type,severity,statement,test,evidence=[]){
  return {seam_id:safeId('seam'),type,severity,statement,cheapest_disconfirming_test:test,evidence_refs:evidence,status:'OPEN'};
}
function inspect({candidate,episodes,baselineEvaluation,challengerEvaluation,comparison,trackComparisons,trainingTexts,heldOutTexts,protectedResults}){
  const seams=[];
  const trainSet=new Set((trainingTexts||[]).map(x=>String(x).trim().toLowerCase()));
  const leaks=(heldOutTexts||[]).filter(x=>trainSet.has(String(x).trim().toLowerCase()));
  if(leaks.length) seams.push(seam('lineage','critical','Held-out material appears in training data.','Rebuild the split from source hashes and rerun.',[]));
  if(!candidate || candidate.status!=='APPROVED') seams.push(seam('permission','critical','Training candidate is not approved.','Require a human review receipt before training.',[]));
  if(!episodes || !episodes.length) seams.push(seam('evidence','high','No reviewed training episodes exist.','Create one bounded episode with evidence and an unseen variant.',[]));
  if(!heldOutTexts || heldOutTexts.length<2) seams.push(seam('calibration','medium','Held-out set is too small to support promotion.','Add at least two independent unseen variants.',[]));
  const b=baselineEvaluation&&baselineEvaluation.summary||{};
  const c=challengerEvaluation&&challengerEvaluation.summary||{};
  if(c.semantic_overlap <= b.semantic_overlap && c.next_token_accuracy <= b.next_token_accuracy){
    seams.push(seam('evidence','high','Challenger did not beat the current baseline on the intended lesson.','Add a new unseen test and compare both checkpoints.',[]));
  }
  if(Number.isFinite(c.perplexity) && Number.isFinite(b.perplexity) && c.perplexity > b.perplexity * 1.15){
    seams.push(seam('calibration','high','Challenger improved some local signals but its held-out perplexity worsened materially.','Repair the curriculum or model settings and rerun the same untouched held-out suite.',[]));
  }
  if(c.unknown_rate > b.unknown_rate + 0.15) seams.push(seam('recovery','medium','Challenger increased unknown-token rate materially.','Expand only the reviewed vocabulary inputs and rerun.',[]));
  if(comparison && comparison.case_win_rate < 0.6) seams.push(seam('evidence','high','Challenger failed to win enough independent held-out cases.','Add diverse unseen cases; require at least a 60% case win rate.',[]));
  if(comparison && comparison.composite_score <= 0) seams.push(seam('calibration','high','Multi-metric growth score is not positive.','Repair curriculum balance; improvement must survive accuracy, overlap, unknown-rate and perplexity together.',[]));
  if(comparison && Object.values(comparison.regressions||{}).some(Boolean)) seams.push(seam('recovery','high','At least one protected evaluation dimension regressed beyond tolerance.','Repair the regression before any promotion review.',[]));
  for(const [track,row] of Object.entries(trackComparisons||{})){
    if(!row.case_count)seams.push(seam('evidence','high','Training track '+track+' has no held-out evidence.','Add an unseen case for this track and rerun.',[]));
    if(row.comparison&&Object.values(row.comparison.regressions||{}).some(Boolean))seams.push(seam('recovery','high','Training track '+track+' regressed beyond tolerance.','Repair this track without hiding the global score.',[]));
    if((track==='structured_json'||track==='coding_foundations')&&row.case_count<2)seams.push(seam('calibration','medium','Machine literacy track '+track+' has fewer than two held-out cases.','Add syntax, semantic and repair variants before promotion.',[]));
  }
  const protectedFailures=(protectedResults||[]).filter(x=>!x.pass);
  if(protectedFailures.length) seams.push(seam('boundary','critical','One or more protected boundary probes regressed.','Repair the challenger; do not promote until every protected probe passes.',protectedFailures.map(x=>x.probe_id)));
  if(candidate && !candidate.disconfirming_test) seams.push(seam('contradiction','high','Candidate has no disconfirming test.','Write the cheapest test that could prove the lesson wrong.',[]));
  const critical=seams.filter(x=>x.severity==='critical').length;
  const high=seams.filter(x=>x.severity==='high').length;
  const verdict=critical?'REJECT':high?'REPAIR':seams.length?'HOLD':'PROMOTE';
  const record={schema:C.SCHEMAS.SEAM_VERDICT,verdict_id:safeId('seam-verdict'),verdict,seams,summary:{open:seams.length,critical,high},created_at:now()};
  record.hash=sha256({...record,hash:undefined});
  return record;
}
module.exports={inspect};
