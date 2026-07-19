(function(root,factory){
  var core=typeof module==='object'&&module.exports?require('./axm-profile-core'):root.AXMProfileCore;
  var api=factory(core);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AXMProfileProvider=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Core){
  'use strict';
  if(!Core)throw Error('AXM profile core is required');
  var DEFAULT_EMITTERS=[
    {id:'game-hub',receiptTypes:['game-played','kill-recorded','death-recorded']},
    {id:'studio',receiptTypes:['picture-made','asset-created']},
    {id:'audio-studio',receiptTypes:['sfx-created']},
    {id:'project-room',receiptTypes:['project-completed']},
    {id:'game-forge',receiptTypes:['game-developed']},
    {id:'code-task',receiptTypes:['code-characters']}
  ];
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function text(v,max){var s=String(v==null?'':v).trim();return max?s.slice(0,max):s;}
  function emitters(input){return(Array.isArray(input)&&input.length?input:DEFAULT_EMITTERS).map(function(raw){return{id:text(raw&&raw.id,80),receiptTypes:(Array.isArray(raw&&raw.receiptTypes)?raw.receiptTypes:[]).filter(function(type){return!!Core.TYPES[type];})};}).filter(function(item){return item.id&&item.receiptTypes.length;});}
  function create(options){
    options=options||{};
    var read=typeof options.read==='function'?options.read:function(){return Core.create();};
    var write=typeof options.write==='function'?options.write:function(){};
    var namespace=text(options.namespace,120)||'local:axm-profile';
    var declared=emitters(options.emitters);
    function current(){return Core.normalize(read());}
    function persist(profile){var normalized=Core.normalize(profile);write(clone(normalized));return normalized;}
    function apply(method,input){var result=Core[method](current(),input);if(result&&result.profile){result.profile=persist(result.profile);return result;}return persist(result);}
    function reportingHealth(state){
      var profile=Core.normalize(state||current()),events=Array.isArray(profile.events)?profile.events:[];
      var sources=declared.map(function(emitter){
        var matching=events.filter(function(event){return emitter.receiptTypes.indexOf(event.type)>=0;});
        var latest=matching.reduce(function(found,event){return!found||Date.parse(event.createdAt||0)>Date.parse(found.createdAt||0)?event:found;},null);
        return{id:emitter.id,receiptTypes:emitter.receiptTypes.slice(),receipts:matching.length,lastReceiptAt:latest&&latest.createdAt||null,state:profile.enabled?(latest?'REPORTING':'WAITING_FOR_RECEIPT'):'PAUSED'};
      });
      return{schema:'axm.profile-reporting-health/v1',namespace:namespace,enabled:profile.enabled,consent:clone(profile.consent),sources:sources,truth:{continuousSync:false,authorshipInference:false,note:'A waiting source has not submitted a verified receipt; it is not proof that no work occurred.'}};
    }
    function exportPacket(){var profile=current();return{schema:'axm.profile-portable-export/v1',namespace:namespace,exportedAt:new Date().toISOString(),profile:Core.publicView(profile),truth:{localOptIn:profile.enabled,permissionGrant:'NONE',portableDataOnly:true}};}
    return{
      schema:'axm.optional-profile-service/v1',namespace:namespace,current:current,
      optIn:function(input){return apply('optIn',input||{});},
      optOut:function(actor){return apply('optOut',actor);},
      syncMembers:function(input){return apply('syncMembers',input||[]);},
      record:function(input){return apply('record',input||{});},
      submitAssessment:function(input){return apply('submitAssessment',input||{});},
      reviewAssessment:function(input){return apply('reviewAssessment',input||{});},
      reportingHealth:reportingHealth,exportPacket:exportPacket,
      emitters:clone(declared)
    };
  }
  return{SCHEMA:'axm.optional-profile-service/v1',DEFAULT_EMITTERS:clone(DEFAULT_EMITTERS),create:create};
});
