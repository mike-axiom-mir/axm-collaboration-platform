(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AXMFoundationServices=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var DEFINITIONS=[
    {id:'wisdom',name:'Wisdom layer',group:'continuity',dashboard:'ai-team',description:'Selected learning and durable wisdom across sessions.'},
    {id:'identity',name:'Identity core',group:'continuity',dashboard:'ai-team',description:'Named identities, boundaries, memory ownership and continuity.'},
    {id:'gate',name:'Gate & permissions',group:'governance',control:'permissions',description:'Permission decisions and human review gates.'},
    {id:'storage',name:'Local-first storage',group:'continuity',description:'Workshop state remains local and recoverable.'},
    {id:'connectors',name:'Multi-AI connectors',group:'collaboration',dashboard:'ai-team',control:'agents',description:'Cloud and local model routes, presence and agent pause state.'},
    {id:'guardian',name:'Shell Guardian',group:'governance',dashboard:'ai-team',control:'guardian',description:'Circuit breaker, alarm history and explicit human reset.'},
    {id:'mirror',name:'Mirror Core',group:'governance',control:'mirror',description:'Proposal-first bridge for reviewed, versioned changes between separately owned systems.'},
    {id:'plugins',name:'Plugin registry',group:'runtime',control:'dashboards',description:'Installed module discovery and compatibility routes.'},
    {id:'backup',name:'Backup & recovery',group:'continuity',dashboard:'publish-library',description:'Private backups and public-safe workshop packages.'},
    {id:'runtime',name:'Hosting & deployment runtime',group:'runtime',description:'The local Hub server and deployment adapters.'}
  ];
  var STATES=['CHECKING','READY','AVAILABLE','PAUSED','DEGRADED','OFFLINE','TRIPPED','ERROR'];
  var HEALTHY={READY:true,AVAILABLE:true,PAUSED:true};

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function definition(id){return DEFINITIONS.filter(function(x){return x.id===id;})[0]||null;}
  function create(){
    var services={};
    DEFINITIONS.forEach(function(d){
      services[d.id]={id:d.id,state:'CHECKING',detail:'Waiting for first probe',lastCheckedAt:null,dashboardVisible:null,meta:{},control:null};
    });
    return {schema:'axm.foundation-service-plane/v1',updatedAt:null,services:services};
  }
  function safeState(value){value=String(value||'').toUpperCase();return STATES.indexOf(value)>=0?value:'ERROR';}
  function reduce(input,event){
    var next=clone(input||create()),e=event||{},service=next.services[e.id];
    if(!service)return next;
    if(e.type==='PROBE'){
      service.state=safeState(e.state);
      service.detail=String(e.detail||'No detail reported').slice(0,500);
      service.lastCheckedAt=e.at||new Date().toISOString();
      service.meta=e.meta&&typeof e.meta==='object'?clone(e.meta):{};
      service.control=null;
      next.updatedAt=service.lastCheckedAt;
    }else if(e.type==='DASHBOARD_VISIBILITY'){
      // A dashboard is a view, never a lifecycle switch.
      service.dashboardVisible=!!e.visible;
    }else if(e.type==='CONTROL_REQUESTED'){
      service.control={state:'REQUESTED',action:String(e.action||''),at:e.at||new Date().toISOString()};
    }else if(e.type==='CONTROL_RESULT'){
      service.control={state:e.ok?'SUCCEEDED':'FAILED',action:String(e.action||''),detail:String(e.detail||''),at:e.at||new Date().toISOString()};
    }
    return next;
  }
  function summary(state){
    var values=DEFINITIONS.map(function(d){return state.services[d.id];});
    var healthy=values.filter(function(s){return !!HEALTHY[s.state];}).length;
    var attention=values.filter(function(s){return ['DEGRADED','OFFLINE','TRIPPED','ERROR'].indexOf(s.state)>=0;}).length;
    var checking=values.filter(function(s){return s.state==='CHECKING';}).length;
    return {total:DEFINITIONS.length,healthy:healthy,attention:attention,checking:checking,allHealthy:healthy===DEFINITIONS.length};
  }
  function tone(state){
    if(state==='READY'||state==='AVAILABLE')return 'ready';
    if(state==='PAUSED'||state==='DEGRADED'||state==='CHECKING')return 'warn';
    return 'bad';
  }
  return {schema:'axm.foundation-service-plane/v1',definitions:clone(DEFINITIONS),states:STATES.slice(),create:create,reduce:reduce,summary:summary,tone:tone,definition:definition};
});
