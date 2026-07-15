(function(root,factory){var api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.AXMGameForgeCore=api;})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  var VIEWS=[
    {id:'overview',title:'Overview',short:'Overview',group:'Forge',route:'overview',icon:'home',description:'See modular games, the active project and the next useful build or play-test step.'},
    {id:'projects',title:'Game Projects',short:'Projects',group:'Forge',route:'projects',icon:'project',description:'Create and version portable game documents without turning every game into an engine module.'},
    {id:'world',title:'World & Level',short:'World + Level',group:'Build',route:'world',icon:'world',description:'Paint a semantic 2D map or 3D terrain document that a compatible runtime can consume.'},
    {id:'physics',title:'Physics Lab',short:'Physics Lab',group:'Build',route:'physics',icon:'physics',description:'Prototype and inspect shared 2D body, force, collision and diagnostic behavior before a runtime consumes it.'},
    {id:'events',title:'Visual Events',short:'Event Graph',group:'Build',route:'events',icon:'graph',description:'Create triggers, conditions and actions with explicit connections and no hidden execution.'},
    {id:'systems',title:'Gameplay Systems',short:'Systems',group:'Build',route:'systems',icon:'systems',description:'Define dialogue, inventory, crafting, quests and HUD component records.'},
    {id:'npcs',title:'NPC Behaviors',short:'NPC Trees',group:'Build',route:'npcs',icon:'npc',description:'Build visible selector, sequence, condition and action trees for NPC adapters.'},
    {id:'hud',title:'HUD & Interface',short:'HUD / UI',group:'Build',route:'hud',icon:'hud',description:'Use the shared Studio interface system for game HUDs instead of inventing another designer.'},
    {id:'playtest',title:'Lobby & Play-test',short:'Lobby + Play',group:'Test',route:'playtest',icon:'play',description:'Use the real Game Hub seats, controllers, QR joining, modular runtimes and launch flow.'},
    {id:'testing',title:'Testing, Replays & Mods',short:'Tests + Mods',group:'Test',route:'testing',icon:'test',description:'Record evidence, replay references and portable mod proposals without auto-installing them.'}
  ];
  var TERRAIN=['empty','ground','wall','water','spawn','goal','hazard','path'];
  var EVENT_TYPES=['Trigger','Condition','Action','Dialogue','Quest','Spawn','Audio','Timer'];
  var SYSTEM_TYPES=['Dialogue','Inventory Item','Craft Recipe','Quest','HUD Component'];
  var BEHAVIOR_TYPES=['Root','Selector','Sequence','Condition','Action','Wait','Move','Attack','Speak'];
  function byId(id){return VIEWS.find(function(v){return v.id===id;})||VIEWS[0];}
  function groups(){var out=[];VIEWS.forEach(function(v){var g=out.find(function(x){return x.name===v.group;});if(!g){g={name:v.group,views:[]};out.push(g);}g.views.push(v);});return out;}
  function blankProject(id,name,mode){var cells=[];for(var i=0;i<160;i++)cells.push({terrain:'empty',height:0});return{schema:'axm.game-forge-project/v1',id:id,name:name,version:'0.1.0',runtimeMode:mode||'2D',status:'DRAFT',createdAt:new Date().toISOString(),updatedAt:null,world:{width:16,height:10,cells:cells},physics:{schema:'axm.game-physics-config/v1',engine:'axm-physics-2d',engineVersion:'0.2.2',enabled:false,world:null,updatedAt:null},events:{nodes:[],edges:[]},systems:[],behaviors:[],tests:[],mods:[]};}
  return{VERSION:'1.0.0',VIEWS:VIEWS,TERRAIN:TERRAIN,EVENT_TYPES:EVENT_TYPES,SYSTEM_TYPES:SYSTEM_TYPES,BEHAVIOR_TYPES:BEHAVIOR_TYPES,byId:byId,groups:groups,blankProject:blankProject};
});
