(function(){
  'use strict';
  var profile=null,$=function(id){return document.getElementById(id);};
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(value){return Number(value||0).toLocaleString();}
  function call(url,options){return fetch(url,Object.assign({cache:'no-store'},options||{})).then(function(r){return r.json().catch(function(){return{};}).then(function(body){if(!r.ok)throw Error(body.error||('profile HTTP '+r.status));return body;});});}
  function liveMembers(){
    var list=window.AXMAIPresence&&AXMAIPresence.members?AXMAIPresence.members():[];
    var out=list.filter(function(m){return m&&m.id&&m.name;}).map(function(m){return{id:m.id,name:m.name,kind:['human','ai','machine'].indexOf(m.kind)>=0?m.kind:'ai'};});
    if(!out.some(function(m){return m.kind==='human';}))out.unshift({id:'local-human',name:'Mike',kind:'human'});
    return out.filter(function(m,i,a){return a.findIndex(function(x){return x.id===m.id;})===i;});
  }
  function statCard(value,label){return'<div class="profile-stat"><b>'+fmt(value)+'</b><span>'+label+'</span></div>';}
  function memberCard(m){return'<article class="profile-member"><div class="profile-member-head"><b>'+esc(m.name)+'</b><small>'+esc(m.kind.toUpperCase())+'</small></div><div class="profile-mini"><span><b>'+fmt(m.stats.gamesPlayed)+'</b> games</span><span><b>'+fmt(m.stats.picturesMade)+'</b> pictures</span><span><b>'+fmt(m.stats.projectsCompleted)+'</b> projects</span><span><b>'+fmt(m.stats.codeCharacters)+'</b> code chars</span></div></article>';}
  function render(){
    if(!profile)return;
    $('profileState').textContent=profile.enabled?'OPTED IN':'OFF BY DEFAULT';$('profileState').classList.toggle('on',profile.enabled);
    $('profileOff').hidden=profile.enabled;$('profileOn').hidden=!profile.enabled;
    var button=$('profileToggle');button.classList.toggle('on',profile.enabled);button.innerHTML=profile.enabled?'<span>Profile</span> · '+fmt(profile.stats.gamesPlayed+profile.stats.picturesMade+profile.stats.projectsCompleted)+' moments':'<span>Profile</span> off';
    if(!profile.enabled)return;
    $('profileName').textContent=profile.displayName;
    $('profileTotals').innerHTML=statCard(profile.stats.gamesPlayed,'games played')+statCard(profile.stats.picturesMade,'pictures made')+statCard(profile.stats.projectsCompleted,'projects completed')+statCard(profile.stats.codeCharacters,'code characters');
    $('profileMembers').innerHTML=profile.members.map(memberCard).join('')||'<p class="profile-note">No collaborators have joined yet.</p>';
    $('profileCodeActor').innerHTML=profile.members.map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>';}).join('');
  }
  function refresh(){return call('/api/profile').then(function(r){profile=r.profile;render();return profile;}).catch(function(e){message(e.message,true);});}
  function message(text,bad){var node=$('profileMessage');node.textContent=text||'';node.style.color=bad?'#ff8292':'';}
  function open(){document.querySelectorAll('.overlay.show').forEach(function(n){n.classList.remove('show');});$('profileScreen').classList.add('show');refresh();}
  function close(){$('profileScreen').classList.remove('show');}
  $('profileToggle').addEventListener('click',open);$('profileClose').addEventListener('click',close);$('profileScreen').addEventListener('click',function(e){if(e.target===$('profileScreen'))close();});
  $('profileEnable').addEventListener('click',function(){
    var name=$('profileDisplayName').value.trim()||'AXM Team';
    call('/api/profile/opt-in',{method:'POST',headers:{'content-type':'application/json','x-axm-profile':'local-opt-in'},body:JSON.stringify({displayName:name,decidedBy:'local-human',members:liveMembers()})}).then(function(r){profile=r.profile;render();message('Profile enabled locally. New activity can now be counted.');}).catch(function(e){message(e.message,true);});
  });
  $('profileSync').addEventListener('click',function(){call('/api/profile/members',{method:'POST',headers:{'content-type':'application/json','x-axm-profile':'sync-local-members'},body:JSON.stringify({members:liveMembers()})}).then(function(r){profile=r.profile;render();message('Current collaborators added. Existing member history stayed intact.');}).catch(function(e){message(e.message,true);});});
  $('profileStop').addEventListener('click',function(){call('/api/profile/opt-out',{method:'POST',headers:{'content-type':'application/json','x-axm-profile':'local-opt-out'},body:JSON.stringify({decidedBy:'local-human'})}).then(function(r){profile=r.profile;render();message('Tracking stopped. Your local history is preserved.');}).catch(function(e){message(e.message,true);});});
  $('profileDelete').addEventListener('click',function(){if(!confirm('Delete the complete local shared profile and its activity history?'))return;if(!confirm('This cannot be undone. Delete it now?'))return;call('/api/profile',{method:'DELETE',headers:{'x-axm-profile':'delete-local-profile'}}).then(function(r){profile=r.profile;render();message('Local profile deleted.');}).catch(function(e){message(e.message,true);});});
  $('profileExport').addEventListener('click',function(){var blob=new Blob([JSON.stringify(profile,null,2)+'\n'],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='axm-shared-profile.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);});
  $('profileCodeReceipt').addEventListener('submit',function(e){e.preventDefault();var actor=$('profileCodeActor').value,count=Number($('profileCodeCount').value),evidence=$('profileCodeEvidence').value.trim();window.AXMProfile.record({type:'code-characters',count:count,dedupeKey:'code:'+actor+':'+Date.now(),participants:[actor],actorId:actor,evidence:evidence,source:'AXM reviewed code receipt'}).then(function(){e.target.reset();message('Verified code contribution counted.');return refresh();}).catch(function(err){message(err.message,true);});});
  refresh();setInterval(function(){if($('profileScreen').classList.contains('show'))refresh();},15000);
})();
