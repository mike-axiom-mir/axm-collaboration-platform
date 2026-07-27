(function(){
  'use strict';
  var O=AXMOps;
  var notice=document.getElementById('notice');
  var inventory=null,current=null;
  var query=new URLSearchParams(location.search);
  var requestedModule=query.get('module')||'';
  var warningRef=query.get('warning')||'';

  function parse(){
    return{
      manifest:JSON.parse(document.getElementById('manifest').value),
      contract:JSON.parse(document.getElementById('contract').value)
    };
  }

  function inventoryLoad(){
    O.get('/api/module-workbench').then(function(data){
      inventory=data;
      document.getElementById('facts').innerHTML='<span>'+data.modules.length+' modules</span><span>'+data.gapCount+' lifecycle gaps</span><span>checked '+O.date(data.checkedAt)+'</span>';
      document.getElementById('module').innerHTML=data.modules.map(function(x){
        return '<option value="'+O.esc(x.id)+'">'+O.esc(x.id)+' \u00b7 '+x.gaps.length+' gap(s)</option>';
      }).join('');
      if(requestedModule&&data.modules.some(function(x){return x.id===requestedModule;})){
        document.getElementById('module').value=requestedModule;
      }
      load();
    }).catch(function(error){O.notice(notice,error.message,'bad');});
  }

  function load(){
    var id=document.getElementById('module').value;
    if(!id)return;
    O.get('/api/module-workbench?id='+encodeURIComponent(id)).then(function(data){
      current=data;
      document.getElementById('manifest').value=O.pretty(data.manifest);
      document.getElementById('contract').value=data.contract?O.pretty(data.contract):O.pretty({
        schema:'axm.module-contract/v1',id:data.manifest.id,version:data.manifest.version,
        provides:[],consumes:[],permissions:[],handoffs:{emits:[],accepts:[]},
        boundaries:{writes:[],refuses:[]},
        lifecycle:{state_owner:'browser',reload:'resume',disconnect:'graceful-degrade',cleanup:'explicit'}
      });
      document.getElementById('gap').textContent=data.row.gaps.length?data.row.gaps.join(' \u00b7 '):'lifecycle declared';
      document.getElementById('gap').className='badge '+(data.row.gaps.length?'warn':'ok');
      document.getElementById('result').textContent='Loaded '+data.row.id+' from installed source.'+(warningRef?' RepairBuddy warning '+warningRef+' is context only; nothing was staged.':'');
    }).catch(function(error){O.notice(notice,error.message,'bad');});
  }

  document.getElementById('load').onclick=load;
  document.getElementById('module').onchange=load;
  document.getElementById('validate').onclick=function(){
    try{
      O.post('/api/module-workbench/validate',parse()).then(function(result){
        document.getElementById('result').textContent=O.pretty(result);
        O.notice(notice,result.pass?'Manifest and contract pass validation.':'Validation found gaps. ',result.pass?'ok':'warn');
      }).catch(function(error){O.notice(notice,error.message,'bad');});
    }catch(error){O.notice(notice,'JSON parse error: '+error.message,'bad');}
  };
  document.getElementById('stage').onclick=function(){
    if(!current)return;
    try{
      var pair=parse();
      O.post('/api/module-workbench/stage',{
        moduleId:current.row.id,manifest:pair.manifest,contract:pair.contract,
        requiredSeats:document.getElementById('seats').value
      },{'x-axm-module-workbench':'explicit-stage-review'}).then(function(result){
        document.getElementById('result').textContent=O.pretty(result);
        O.notice(notice,'Governed update staged as '+result.id+' for review '+result.reviewId+'.','ok');
      }).catch(function(error){O.notice(notice,error.message,'bad');});
    }catch(error){O.notice(notice,'JSON parse error: '+error.message,'bad');}
  };
  inventoryLoad();
})();
