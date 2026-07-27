(function(){
  'use strict';
  var groups={Surface:['fx-surface','fx-glass','fx-bevel','fx-gradient-border'],Glow:['fx-glow','fx-glow-inset','fx-neon','fx-duotone'],Depth:['fx-tile','fx-extrude','fx-scanlines'],Motion:['fx-lift','fx-sheen','fx-breathe','fx-tilt','fx-flicker'],HUD:['fx-corners','fx-active'],Status:['fx-ok','fx-info','fx-warn','fx-danger','fx-badge']};
  var selected=new Set(['fx-glass','fx-bevel','fx-glow','fx-lift','fx-corners']);
  var preview=document.getElementById('preview'),recipe=document.getElementById('recipe');
  var accent=document.getElementById('accent'),accent2=document.getElementById('accent2'),glow=document.getElementById('glow'),depth=document.getElementById('depth');
  function renderChoices(){
    var host=document.getElementById('categories');host.textContent='';
    Object.keys(groups).forEach(function(group){
      var section=document.createElement('section');section.className='category';section.innerHTML='<h3>'+group.toUpperCase()+'</h3><div class="choice-grid"></div>';
      groups[group].forEach(function(name){var button=document.createElement('button');button.type='button';button.className='choice';button.textContent=name.replace('fx-','');button.dataset.fx=name;button.setAttribute('aria-pressed',selected.has(name));button.onclick=function(){selected.has(name)?selected.delete(name):selected.add(name);render();};section.lastChild.appendChild(button);});
      host.appendChild(section);
    });
  }
  function code(){var classes=Array.from(selected).join(' ');return '<div class="'+classes+'">...</div>\n\n:root {\n  --fx-accent: '+accent.value+';\n  --fx-accent2: '+accent2.value+';\n  --fx-gsize: '+glow.value+';\n  --fx-depth: '+depth.value+';\n}';}
  function render(){
    preview.className='preview-card '+Array.from(selected).join(' ');preview.dataset.shape=document.getElementById('shape').value;
    preview.dataset.badge=selected.has('fx-badge')?'3':'';selected.has('fx-active')?preview.classList.add('on'):preview.classList.remove('on');
    document.querySelectorAll('.choice').forEach(function(button){button.setAttribute('aria-pressed',selected.has(button.dataset.fx));});
    AXMFX.theme({accent:accent.value,accent2:accent2.value,gsize:Number(glow.value),depth:Number(depth.value)});AXMFX.init(preview);
    document.getElementById('glowOut').textContent=glow.value;document.getElementById('depthOut').textContent=depth.value;recipe.textContent=code();
  }
  [accent,accent2,glow,depth,document.getElementById('shape')].forEach(function(control){control.addEventListener('input',render);control.addEventListener('change',render);});
  document.getElementById('copy').onclick=async function(){var notice=document.getElementById('notice');try{await navigator.clipboard.writeText(code());notice.textContent='Recipe copied. No host was changed.';}catch(error){notice.textContent='Clipboard unavailable. Select and copy the visible recipe manually.';}};
  renderChoices();render();
})();

