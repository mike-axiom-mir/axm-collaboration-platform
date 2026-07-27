(function(){
  'use strict';
  const purposes={
    cockpit:'Dense operator control, live state, routes and telemetry.',
    studio:'Creative workspaces where the canvas stays visually authoritative.',
    dashboard:'Readable overview, discovery, growth and navigation.',
    lab:'Evidence, comparison and bounded experiments.'
  };
  const state={report:null,query:'',profile:''};
  const buttons=[...document.querySelectorAll('[data-profile]')];
  const cards=[...document.querySelectorAll('[data-card-profile]')];
  const active=document.getElementById('activeProfile');
  const purpose=document.getElementById('profilePurpose');
  function choose(profile){
    globalThis.AXMPresentationSpine.applyProfile(document.body,profile);
    active.textContent=profile.toUpperCase();purpose.textContent=purposes[profile];
    buttons.forEach(button=>button.classList.toggle('active',button.dataset.profile===profile));
    cards.forEach(card=>card.classList.toggle('selected',card.dataset.cardProfile===profile));
  }
  buttons.forEach(button=>button.addEventListener('click',()=>choose(button.dataset.profile)));
  cards.forEach(card=>card.addEventListener('click',()=>choose(card.dataset.cardProfile)));

  const recipeApi=globalThis.AXMPresentationRecipe;
  const recipeForm=document.getElementById('recipeForm');
  const recipePreview=document.getElementById('recipePreview');
  const recipeStatus=document.getElementById('recipeStatus');
  function formRecipe(){
    const data=new FormData(recipeForm),layers={};
    ['surface','depth','motion','density','signal'].forEach(key=>{layers[key]=data.get(key);});
    return recipeApi.normalize({schema:recipeApi.SCHEMA,id:'shared-workshop',name:'Shared Workshop',author:'Mike + AXM',profile:data.get('profile'),layers});
  }
  function setForm(recipe){
    const value=recipeApi.normalize(recipe);
    recipeForm.elements.profile.value=value.profile;
    Object.keys(value.layers).forEach(key=>{recipeForm.elements[key].value=value.layers[key];});
    renderRecipe();
  }
  function renderRecipe(){
    const recipe=formRecipe();
    Object.keys(recipe.layers).forEach(key=>{recipePreview.dataset[key]=recipe.layers[key];});
    document.getElementById('previewSurface').textContent=recipe.layers.surface.toUpperCase();
    document.getElementById('previewDepth').textContent=recipe.layers.depth.toUpperCase();
    document.getElementById('previewSignal').textContent=recipe.layers.signal.toUpperCase();
    document.getElementById('recipeFingerprint').textContent='axm.presentation-recipe/v1 / '+recipeApi.fingerprint(recipe);
    if(recipe.profile!=='auto') choose(recipe.profile);
    recipeStatus.textContent='Preview only. Nothing changes until you apply.';
    return recipe;
  }
  function savedRecipe(){
    let layers=null;
    try{layers=JSON.parse(localStorage.getItem('axm.hub.presentation.layers')||'null');}catch(e){}
    return recipeApi.normalize({schema:recipeApi.SCHEMA,id:'shared-workshop',name:'Shared Workshop',author:'Mike + AXM',profile:localStorage.getItem('axm.hub.presentation.profile')||'auto',layers:layers||recipeApi.DEFAULT.layers});
  }
  function downloadRecipe(recipe){
    const blob=new Blob([JSON.stringify(recipe,null,2)+'\n'],{type:'application/json'}),href=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=href;link.download='axm-presentation-recipe-'+recipeApi.fingerprint(recipe)+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),0);
  }
  recipeForm.addEventListener('change',renderRecipe);
  document.getElementById('applyRecipe').addEventListener('click',()=>{
    const recipe=renderRecipe(),checked=recipeApi.validate(recipe);
    if(!checked.ok){recipeStatus.textContent='REFUSED: '+checked.errors[0];return;}
    localStorage.setItem('axm.hub.presentation.profile',recipe.profile);
    localStorage.setItem('axm.hub.presentation.layers',JSON.stringify(recipe.layers));
    if(parent!==window) parent.postMessage({type:'hub:presentation:recipe',recipe},location.origin);
    recipeStatus.textContent='APPLIED / '+recipeApi.fingerprint(recipe)+' / presentation only';
  });
  document.getElementById('exportRecipe').addEventListener('click',()=>{const recipe=renderRecipe();downloadRecipe(recipe);recipeStatus.textContent='EXPORTED / '+recipeApi.fingerprint(recipe);});
  document.getElementById('importRecipe').addEventListener('click',()=>document.getElementById('recipeFile').click());
  document.getElementById('recipeFile').addEventListener('change',event=>{
    const file=event.target.files&&event.target.files[0];if(!file)return;
    file.text().then(text=>{
      let parsed;try{parsed=JSON.parse(text);}catch(e){throw new Error('not valid JSON');}
      const checked=recipeApi.validate(parsed);if(!checked.ok)throw new Error(checked.errors[0]);
      setForm(parsed);recipeStatus.textContent='IMPORTED FOR PREVIEW / click Apply to use it';
    }).catch(error=>{recipeStatus.textContent='REFUSED: '+error.message;}).finally(()=>{event.target.value='';});
  });
  document.getElementById('resetRecipe').addEventListener('click',()=>{setForm(recipeApi.DEFAULT);recipeStatus.textContent='RESET FOR PREVIEW / click Apply to use it';});
  setForm(savedRecipe());
  recipeStatus.textContent='Loaded current Shared recipe. New changes remain preview-only until Apply.';

  function renderReport(){
    if(!state.report) return;
    const report=state.report,totals=report.totals;
    const values=[totals.surfaces,totals.onSpine,totals.missingSpine,totals.externalRuntimeReferences];
    document.querySelectorAll('#metrics b').forEach((node,index)=>{node.textContent=values[index];});
    document.getElementById('reportStatus').textContent=`${totals.onSpine} ON SPINE · ${totals.missingSpine} QUEUED`;
    const query=state.query.toLowerCase();
    const matches=report.surfaces.filter(item=>(!query||item.path.toLowerCase().includes(query))&&(!state.profile||item.recommendedProfile===state.profile)).slice(0,80);
    document.getElementById('surfaceList').innerHTML=matches.length?matches.map(item=>`<div class="surface-row"><code title="${item.path}">${item.path}</code><b>${item.recommendedProfile}</b><b class="${item.seams.presentationSpine&&item.seams.profileDeclared?'ready':''}">${item.seams.presentationSpine&&item.seams.profileDeclared?'ON SPINE':'MIGRATE'}</b><small>${item.recommendations.join(' · ')||'shared seam present'}</small></div>`).join(''):'<p>No matching surfaces.</p>';
  }
  document.getElementById('filter').addEventListener('input',event=>{state.query=event.target.value;renderReport();});
  document.getElementById('profileFilter').addEventListener('change',event=>{state.profile=event.target.value;renderReport();});
  fetch('migration-report.json',{cache:'no-store'}).then(response=>{if(!response.ok) throw new Error('report unavailable');return response.json();}).then(report=>{state.report=report;renderReport();}).catch(()=>{document.getElementById('reportStatus').textContent='REPORT NOT GENERATED';document.getElementById('surfaceList').innerHTML='<p>Run the deterministic scanner command shown below. No host files were changed.</p>';});
})();
