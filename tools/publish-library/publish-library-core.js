(function(root,factory){
  var api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.AXMPublishCore=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  var VIEWS=[
    {id:'overview',title:'Overview',short:'Overview',group:'Pipeline',route:'native',icon:'home',description:'See the library, incoming artifacts, releases and the safest next action.'},
    {id:'library',title:'Asset Library',short:'Library',group:'Assets',route:'library',icon:'library',description:'Search, classify and preserve reusable assets with source and project context.'},
    {id:'packs',title:'Packs & Templates',short:'Packs',group:'Assets',route:'packs',icon:'pack',description:'Prepare reusable asset-pack and template manifests without installing them automatically.'},
    {id:'release',title:'Export & Release',short:'Export + Release',group:'Publish',route:'release',icon:'release',description:'Receive versioned artifacts, review provenance and build an honest release manifest.'},
    {id:'packages',title:'Backups & Packages',short:'Packages',group:'Publish',route:'packages',icon:'package',description:'Create verified private backups or scanned public-safe Workshop packages.'},
    {id:'distribution',title:'Launcher & Distribution',short:'Distribution',group:'Publish',route:'distribution',icon:'distribution',description:'Prepare governed launcher cards and distribution metadata without claiming installation.'}
  ];
  var FORMATS=['PNG','JPEG','WebP','PDF','SVG','Audio','Video','3D','Web','Executable','Package','Source','Other'];
  var STATES=['INBOX','REVIEWED','READY','EXPORTED','RELEASED','BLOCKED'];
  function byId(id){return VIEWS.find(function(v){return v.id===id;})||VIEWS[0];}
  function groups(){var out=[];VIEWS.forEach(function(v){var g=out.find(function(x){return x.name===v.group;});if(!g){g={name:v.group,views:[]};out.push(g);}g.views.push(v);});return out;}
  function normalize(input){input=input&&typeof input==='object'?input:{};return{schema:'axm.publish-library.workspace/v1',view:byId(input.view).id,updatedAt:input.updatedAt||null};}
  return{VERSION:'1.1.0',VIEWS:VIEWS,FORMATS:FORMATS,STATES:STATES,byId:byId,groups:groups,normalize:normalize};
});
