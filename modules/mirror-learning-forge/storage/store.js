'use strict';
const fs=require('fs');
const path=require('path');
const C=require('../core/constants');
const {now,clone,ensureDir,atomicWriteJson,readJson,sha256,safeId}=require('../core/utils');
function blankState(){
  const at=now();
  return {schema:C.SCHEMAS.STATE,revision:0,authority_revision:0,created_at:at,updated_at:at,settings:{enabled:false,consent:{state:'OPTED_OUT',decided_at:null,decided_by:null},active_model_id:null},raw_sessions:{},candidates:{},episodes:{},models:{},evaluations:{},seam_verdicts:{},promotion_packets:{},applications:{},growth_cycles:{},track_tasks:{},track_grades:{},track_curricula:{},root_dissents:{}};
}

function normalizeState(input){
  const base=blankState(),out=Object.assign(base,clone(input||{}));
  out.settings=Object.assign(base.settings,clone(input&&input.settings||{}));
  for(const key of ['raw_sessions','candidates','episodes','models','evaluations','seam_verdicts','promotion_packets','applications','growth_cycles','track_tasks','track_grades','track_curricula','root_dissents']){
    if(!out[key]||typeof out[key]!=='object'||Array.isArray(out[key]))out[key]={};
  }
  return out;
}
class ForgeStore{
  constructor(runtimeDir){
    this.runtimeDir=path.resolve(runtimeDir);
    this.stateFile=path.join(this.runtimeDir,'state.json');
    this.journalFile=path.join(this.runtimeDir,'journal.jsonl');
    this.snapshotsDir=path.join(this.runtimeDir,'snapshots');
    ensureDir(this.runtimeDir);ensureDir(this.snapshotsDir);
    if(!fs.existsSync(this.stateFile)) atomicWriteJson(this.stateFile,blankState());
    if(!fs.existsSync(this.journalFile)) fs.writeFileSync(this.journalFile,'','utf8');
    this.state=normalizeState(readJson(this.stateFile,blankState()));
    atomicWriteJson(this.stateFile,this.state);
  }
  read(){return clone(this.state);}
  events(){
    return fs.readFileSync(this.journalFile,'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  }
  appendEvent(type,actor,payload){
    const prior=this.events();
    const previous_hash=prior.length?prior[prior.length-1].hash:null;
    const event={schema:C.SCHEMAS.JOURNAL,event_id:safeId('event'),type,actor:actor||{actor_id:'local-human',actor_kind:'HUMAN'},payload:clone(payload||{}),previous_hash,created_at:now()};
    event.hash=sha256({...event,hash:undefined});
    fs.appendFileSync(this.journalFile,JSON.stringify(event)+'\n','utf8');
    return clone(event);
  }
  mutate(type,actor,mutator,{authority=false}={}){
    const next=clone(this.state);
    const result=mutator(next);
    next.revision=Number(next.revision||0)+1;
    if(authority) next.authority_revision=Number(next.authority_revision||0)+1;
    next.updated_at=now();
    atomicWriteJson(this.stateFile,next);
    this.state=next;
    const event=this.appendEvent(type,actor,{state_revision:next.revision,authority_revision:next.authority_revision,result});
    return {result:clone(result),event,state:this.read()};
  }
  snapshot(label){
    const state=this.read();
    const snap={snapshot_id:safeId('snapshot',label),label,revision:state.revision,authority_revision:state.authority_revision,state,created_at:now()};
    snap.hash=sha256({...snap,hash:undefined});
    atomicWriteJson(path.join(this.snapshotsDir,snap.snapshot_id.replace(/:/g,'_')+'.json'),snap);
    this.appendEvent('SNAPSHOT_CREATED',{actor_id:'forge-system',actor_kind:'SYSTEM'},{snapshot_id:snap.snapshot_id,hash:snap.hash});
    return snap;
  }
  reset(seed){
    const next=normalizeState(Object.assign(blankState(),clone(seed||{})));
    atomicWriteJson(this.stateFile,next);fs.writeFileSync(this.journalFile,'','utf8');this.state=next;return this.read();
  }
  verifyJournal(){
    const events=this.events(); let prev=null;
    for(const e of events){
      if(e.previous_hash!==prev) return {ok:false,event_id:e.event_id,error:'previous hash mismatch'};
      if(sha256({...e,hash:undefined})!==e.hash) return {ok:false,event_id:e.event_id,error:'event hash mismatch'};
      prev=e.hash;
    }
    return {ok:true,count:events.length,head_hash:prev};
  }
}
module.exports={ForgeStore,blankState,normalizeState};
