(function(root,factory){
  var api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.AXMAITeamCore=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  var VIEWS=[
    {id:'overview',title:'Overview',short:'Overview',group:'Control',route:'native',icon:'home',description:'See the team, open questions, approvals and the safest next action.'},
    {id:'technical',title:'Technical Glasses',short:'Technical truth',group:'Control',route:'technical',icon:'glasses',description:'Compile current source, contracts, readiness and open seams into one evidence-linked view for any human or AI instance.'},
    {id:'collaborate',title:'Collaboration & Tasks',short:'Talk + Tasks',group:'Work',route:'task',icon:'chat',description:'Talk with local identities, queue supervised work and manage bounded handoffs.'},
    {id:'duo',title:'Nova + Gemini',short:'Local Duo',group:'Work',route:'duo',icon:'duo',description:'Run an attributed Nova and Gemini Local collaboration while identity memory stays separate.'},
    {id:'agents',title:'Agents & Identities',short:'Agents',group:'Build',route:'agents',icon:'agent',description:'Shape roles, behavior, identity, memory boundaries, skills and tool relationships.'},
    {id:'specialists',title:'Specialist Library',short:'Specialists',group:'Build',route:'specialists',icon:'specialist',description:'Let any identity borrow a bounded professional method without changing identity, permissions or durable wisdom.'},
    {id:'forge',title:'Agent Tool Forge',short:'Tools + Skills',group:'Build',route:'forge',icon:'tool',description:'Draft bounded tool and skill packages for agents without installing or promoting them automatically.'},
    {id:'prompts',title:'Prompt Workshop',short:'Prompts',group:'Build',route:'prompts',icon:'prompt',description:'Store, version, compare and hand off reusable prompts without claiming quality before testing.'},
    {id:'models',title:'Model Evaluation',short:'Models',group:'Evaluate',route:'models',icon:'model',description:'Compare model routes and inference behavior with preserved outputs and human review.'},
    {id:'reasoning',title:'Reasoning Lab',short:'Reasoning',group:'Evaluate',route:'reasoning',icon:'reason',description:'Use the experimental reasoning shell as a proposal loop with visible checkpoints.'},
    {id:'learning',title:'AI Learning Forge',short:'Learning Forge',group:'Learn',route:'learning',icon:'data',description:'Open the optional machine-native school. Mirror is the first seat; future connected models enter as separate attributed learners.'},
    {id:'explore',title:'Exploration Garden',short:'Explore',group:'Learn',route:'explore',icon:'explore',description:'Let identities pursue bounded creative learning, preserve drafts and raise only evidenced proposals for discussion.'},
    {id:'data',title:'Datasets & Training Runs',short:'Data + Runs',group:'Learn',route:'data',icon:'data',description:'Label local examples and track training experiments, evidence and human approval without pretending this screen trains a model.'},
    {id:'services',title:'Connections & Safety',short:'Services',group:'Control',route:'services',icon:'service',description:'Inspect connectors, local models and Shell Guardian without treating services as destinations.'}
  ];
  var SERVICES=[
    {id:'bridge',name:'AXM Bridge',kind:'runtime'},
    {id:'nova',name:'Nova',kind:'local model'},
    {id:'gemini-local',name:'Gemini Local',kind:'local model'},
    {id:'claude',name:'Claude',kind:'connector'},
    {id:'codex',name:'Codex',kind:'connector'},
    {id:'chatgpt',name:'ChatGPT',kind:'connector'},
    {id:'grok',name:'Grok',kind:'connector'},
    {id:'mirror',name:'Mirror',kind:'machine-native research body'},
    {id:'guardian',name:'Shell Guardian',kind:'armed service'}
  ];
  function byId(id){return VIEWS.find(function(v){return v.id===id;})||VIEWS[0];}
  function normalize(input){input=input&&typeof input==='object'?input:{};return{schema:'axm.ai-team.workspace/v1',view:byId(input.view).id,updatedAt:input.updatedAt||null};}
  function groups(){var out=[];VIEWS.forEach(function(v){var g=out.find(function(x){return x.name===v.group;});if(!g){g={name:v.group,views:[]};out.push(g);}g.views.push(v);});return out;}
  return{VERSION:'1.4.0',VIEWS:VIEWS,SERVICES:SERVICES,byId:byId,normalize:normalize,groups:groups};
});
