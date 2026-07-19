'use strict';
const {sha256,clone}=require('./utils');
function scoreEpisode(e,candidate){
  let score=0;
  score+=Math.min(4,(e.evidence_refs||[]).length)*2;
  score+=Math.min(4,(e.held_out_variants||[]).length)*3;
  if(e.repair_example)score+=4;
  if(e.uncertainty_expectation)score+=2;
  if(candidate&&candidate.counterevidence&&candidate.counterevidence.length)score+=3;
  if(candidate&&candidate.disconfirming_test)score+=4;
  if((e.training_tracks||[]).includes('structured_json'))score+=2;
  if((e.training_tracks||[]).includes('coding_foundations'))score+=2;
  return score;
}
function select({episodes,candidates,maxEpisodes=32}){
  const seen=new Set(),rows=[];
  for(const e of episodes||[]){
    const canonical=JSON.stringify({input:e.input,expected:e.expected,repair:e.repair_example||'',tracks:e.training_tracks||[]});
    const hash=sha256(canonical);if(seen.has(hash))continue;seen.add(hash);
    const c=candidates&&candidates[e.candidate_id];
    rows.push({episode:e,candidate:c,hash,score:scoreEpisode(e,c),lesson_type:c&&c.lesson_type||'unknown',tracks:e.training_tracks||['natural_language']});
  }
  rows.sort((a,b)=>b.score-a.score||a.hash.localeCompare(b.hash));
  const selected=[],perType={},perTrack={};
  const typeLimit=Math.max(2,Math.ceil(maxEpisodes/3));
  const trackLimit=Math.max(2,Math.ceil(maxEpisodes/2));
  for(const row of rows){
    if(selected.length>=maxEpisodes)break;
    const type=row.lesson_type;
    if((perType[type]||0)>=typeLimit)continue;
    const wouldOverflow=row.tracks.some(track=>(perTrack[track]||0)>=trackLimit);
    if(wouldOverflow&&selected.length<Math.min(maxEpisodes,rows.length-1))continue;
    selected.push(row);perType[type]=(perType[type]||0)+1;
    for(const track of row.tracks)perTrack[track]=(perTrack[track]||0)+1;
  }
  return {selected:selected.map(x=>clone(x.episode)),selection_receipt:{input_count:(episodes||[]).length,deduplicated_count:rows.length,selected_count:selected.length,max_episodes:maxEpisodes,lesson_type_counts:perType,training_track_counts:perTrack,selected_hashes:selected.map(x=>x.hash),quality_scores:Object.fromEntries(selected.map(x=>[x.episode.episode_id,x.score]))}};
}
module.exports={scoreEpisode,select};
