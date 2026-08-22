(function(root){
  'use strict';
  const PROFILES=Object.freeze(['cockpit','studio','dashboard','lab']);
  function applyProfile(target,profile){
    const node=target&&target.nodeType===1?target:document.body;
    if(!PROFILES.includes(profile)) throw new Error('Unknown AXM presentation profile: '+profile);
    node.classList.add('axm-spine');
    node.dataset.axmProfile=profile;
    node.dispatchEvent(new CustomEvent('axm:presentation-profile',{detail:{profile},bubbles:false}));
    return profile;
  }
  function inspect(target){
    const node=target&&target.nodeType===1?target:document.body;
    const profile=node.dataset.axmProfile||null;
    return Object.freeze({profile,ready:PROFILES.includes(profile),authority:'presentation-only'});
  }
  root.AXMPresentationSpine=Object.freeze({version:'v0.1.0',profiles:PROFILES,applyProfile,inspect});
})(globalThis);
