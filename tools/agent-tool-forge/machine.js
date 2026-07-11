'use strict';
/* Draft-only machine door. The host supplies the same authorization decision
   used for a human action. No install, overwrite, delete, execute or promote. */
const Core=require('./forge-core.js');
const ACTIONS=['parts.list','templates.list','draft.create','draft.inspect','draft.update','draft.validate','draft.render','draft.package'];
async function run(request,host){
  request=request||{};host=host||{};
  if(typeof host.authorize!=='function')return{ok:false,refused:true,reason:'host authorize function required'};
  const action=String(request.action||'');
  if(ACTIONS.indexOf(action)<0)return{ok:false,refused:true,reason:'unsupported or forbidden action'};
  const verdict=await host.authorize({action:'agent-tool-forge.'+action,effect:'draft-only',actor:request.actor||{id:'machine',type:'ai'}});
  if(!verdict||!verdict.allow)return{ok:false,refused:true,reason:(verdict&&verdict.reason)||'gate denied'};
  const p=request.input||{};
  if(action==='parts.list')return{ok:true,capabilities:Core.CAPABILITIES};
  if(action==='templates.list')return{ok:true,templates:Object.keys(Core.TYPES).map(id=>({id,label:Core.TYPES[id].label}))};
  if(action==='draft.create')return{ok:true,draft:Core.newDraft(p)};
  if(action==='draft.inspect')return{ok:true,draft:Core.normalize(p.draft)};
  if(action==='draft.update')return{ok:true,draft:Core.updateDraft(p.draft,p.patch)};
  if(action==='draft.validate')return Object.assign({ok:true},Core.validateDraft(p.draft));
  if(action==='draft.render')return Core.renderFiles(p.draft,p.assets||{});
  if(action==='draft.package')return Core.buildPackage(p.draft,p.assets||{});
}
module.exports={run,ACTIONS};
