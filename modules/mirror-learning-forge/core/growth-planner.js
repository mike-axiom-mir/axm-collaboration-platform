'use strict';
const {clone,now}=require('./utils');

const DEFAULTS=Object.freeze({
  cycles:12,
  starting_sessions:10,
  session_growth_factor:1.6,
  permission_rate:0.35,
  candidates_per_permitted_session:1.4,
  candidate_approval_rate:0.4,
  episodes_per_approved_candidate:2,
  held_out_cases_per_episode:3,
  challenger_branches_per_candidate:2,
  bytes_per_session:6000,
  bytes_per_episode:3500,
  bytes_per_model:180000,
  caps:{sessions_per_cycle:1000,candidates_per_cycle:250,episodes_per_cycle:128,challengers_per_cycle:8,promotions_per_cycle:1}
});
function finite(n,fallback){n=Number(n);return Number.isFinite(n)?n:fallback;}
function clamp01(n,d){return Math.max(0,Math.min(1,finite(n,d)));}
function doublingTime(g){return g>1?Math.log(2)/Math.log(g):null;}
function project(input={}){
  const d=DEFAULTS,caps={...d.caps,...(input.caps||{})};
  const p={
    cycles:Math.max(1,Math.min(60,Math.floor(finite(input.cycles,d.cycles)))),
    starting_sessions:Math.max(1,finite(input.starting_sessions,d.starting_sessions)),
    session_growth_factor:Math.max(1,finite(input.session_growth_factor,d.session_growth_factor)),
    permission_rate:clamp01(input.permission_rate,d.permission_rate),
    candidates_per_permitted_session:Math.max(0,finite(input.candidates_per_permitted_session,d.candidates_per_permitted_session)),
    candidate_approval_rate:clamp01(input.candidate_approval_rate,d.candidate_approval_rate),
    episodes_per_approved_candidate:Math.max(0,finite(input.episodes_per_approved_candidate,d.episodes_per_approved_candidate)),
    held_out_cases_per_episode:Math.max(1,finite(input.held_out_cases_per_episode,d.held_out_cases_per_episode)),
    challenger_branches_per_candidate:Math.max(1,finite(input.challenger_branches_per_candidate,d.challenger_branches_per_candidate)),
    bytes_per_session:Math.max(0,finite(input.bytes_per_session,d.bytes_per_session)),
    bytes_per_episode:Math.max(0,finite(input.bytes_per_episode,d.bytes_per_episode)),
    bytes_per_model:Math.max(0,finite(input.bytes_per_model,d.bytes_per_model)),
    caps
  };
  const rows=[];let cumulative={sessions:0,candidates:0,episodes:0,held_out:0,challengers:0,promotions:0,bytes:0};
  for(let cycle=1;cycle<=p.cycles;cycle++){
    const uncappedSessions=p.starting_sessions*Math.pow(p.session_growth_factor,cycle-1);
    const sessions=Math.min(uncappedSessions,caps.sessions_per_cycle);
    const permitted=sessions*p.permission_rate;
    const uncappedCandidates=permitted*p.candidates_per_permitted_session;
    const candidates=Math.min(uncappedCandidates,caps.candidates_per_cycle);
    const approved=candidates*p.candidate_approval_rate;
    const uncappedEpisodes=approved*p.episodes_per_approved_candidate;
    const episodes=Math.min(uncappedEpisodes,caps.episodes_per_cycle);
    const heldOut=episodes*p.held_out_cases_per_episode;
    const uncappedChallengers=approved*p.challenger_branches_per_candidate;
    const challengers=Math.min(uncappedChallengers,caps.challengers_per_cycle);
    const promotions=Math.min(challengers,caps.promotions_per_cycle);
    const bytes=sessions*p.bytes_per_session+episodes*p.bytes_per_episode+challengers*p.bytes_per_model;
    cumulative.sessions+=sessions;cumulative.candidates+=candidates;cumulative.episodes+=episodes;cumulative.held_out+=heldOut;cumulative.challengers+=challengers;cumulative.promotions+=promotions;cumulative.bytes+=bytes;
    rows.push({cycle,uncapped:{sessions:uncappedSessions,candidates:uncappedCandidates,episodes:uncappedEpisodes,challengers:uncappedChallengers},bounded:{sessions,permitted,candidates,approved,episodes,held_out:heldOut,challengers,promotions,bytes},caps_hit:{sessions:uncappedSessions>caps.sessions_per_cycle,candidates:uncappedCandidates>caps.candidates_per_cycle,episodes:uncappedEpisodes>caps.episodes_per_cycle,challengers:uncappedChallengers>caps.challengers_per_cycle}});
  }
  const last=rows[rows.length-1];
  const warnings=[];
  if(p.session_growth_factor>=2)warnings.push('Raw experience doubles every cycle; curation must activate before training selection.');
  if(last.uncapped.episodes>caps.episodes_per_cycle*10)warnings.push('Episode demand exceeds the bounded training budget by more than 10×; compaction and sampling are mandatory.');
  if(last.uncapped.challengers>caps.challengers_per_cycle*10)warnings.push('Challenger branching is combinatorial; use a champion/challenger tournament, not all-pairs training.');
  warnings.push('Exponential intake must not imply exponential authority. Promotion remains capped separately from experience growth.');
  return {schema:'axm.mirror.growth-forecast/v1',created_at:now(),parameters:p,doubling_time_cycles:doublingTime(p.session_growth_factor),rows,cumulative:clone(cumulative),warnings};
}
function stage(state){
  const models=Object.values(state.models||{}),promotions=Object.values(state.applications||{}).filter(x=>!x.rolled_back_at).length;
  const heldOut=Object.values(state.episodes||{}).reduce((n,e)=>n+(e.held_out_variants||[]).length,0);
  const vocab=models.reduce((m,x)=>Math.max(m,(x.tokenizer&&x.tokenizer.vocab&&x.tokenizer.vocab.tokens||[]).length),0);
  const rollbackCount=Object.values(state.applications||{}).filter(x=>x.rolled_back_at).length;
  let name='SEED',next='SPROUT',max_vocab=512,max_episodes_per_cycle=32,max_challengers=2;
  if(promotions>=3&&heldOut>=100&&rollbackCount===0){name='SPROUT';next='SAPLING';max_vocab=1024;max_episodes_per_cycle=96;max_challengers=4;}
  if(promotions>=10&&heldOut>=500&&rollbackCount<=1){name='SAPLING';next='YOUNG TREE';max_vocab=2048;max_episodes_per_cycle=256;max_challengers=6;}
  return {schema:'axm.mirror.growth-stage/v1',name,next,observed:{promotions,held_out_cases:heldOut,rollback_count:rollbackCount,max_vocab_seen:vocab},limits:{max_vocab,max_episodes_per_cycle,max_challengers,max_promotions_per_cycle:1},unlock_is_automatic:false};
}
module.exports={DEFAULTS,project,stage};
