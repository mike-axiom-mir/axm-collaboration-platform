(function(){
  'use strict';
  var buttons=[].slice.call(document.querySelectorAll('[data-panel]'));
  var panels=[].slice.call(document.querySelectorAll('.panel'));
  function show(id){
    buttons.forEach(function(button){var active=button.getAttribute('data-panel')===id;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
    panels.forEach(function(panel){var active=panel.id===id;panel.hidden=!active;panel.classList.toggle('active',active);if(active)panel.focus();});
    document.getElementById('status').textContent='Viewing '+id.replace(/-/g,' ')+' · no state was written.';
  }
  buttons.forEach(function(button){button.addEventListener('click',function(){show(button.getAttribute('data-panel'));});});
  if(window.AXMHub){
    AXMHub.onInit(function(){AXMHub.log('Shadow Clone Learning Steward v0.3 ready · provider inert · no automatic learning, scoring, or inheritance');});
    AXMHub.ready({id:'shadow-clone-learning-steward',name:'Shadow Clone Learning Steward',version:'v0.3',hubApiVersion:'1.0',permissions:[],savesState:false,handlesShutdown:false});
  }
}());
