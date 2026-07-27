/* AXM UI-FX v0.1 -- optional helpers for script-backed TEST effects. */
(function(root){
  'use strict';
  var doc=root.document;
  var reduce=!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function mix(hex,to,t){
    if(!/^#[0-9a-f]{6}$/i.test(String(hex||''))) return hex;
    var a=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
    return '#'+a.map(function(v,i){return Math.round(v+(to[i]-v)*t).toString(16).padStart(2,'0');}).join('');
  }
  function theme(opts){
    opts=opts||{}; var style=doc.documentElement.style; var a=opts.accent;
    if(a){
      style.setProperty('--fx-accent',a); style.setProperty('--fx-glow',a);
      style.setProperty('--fx-hi',mix(a,[255,255,255],.28+(opts.depth==null?5:opts.depth)*.03));
      style.setProperty('--fx-lo',mix(a,[0,0,0],.1+(opts.depth==null?5:opts.depth)*.045));
    }
    if(opts.accent2!=null) style.setProperty('--fx-accent2',opts.accent2);
    if(opts.gsize!=null) style.setProperty('--fx-gsize',opts.gsize);
    if(opts.depth!=null) style.setProperty('--fx-depth',opts.depth);
  }
  function initTilt(scope){
    (scope||doc).querySelectorAll('.fx-tilt').forEach(function(el){
      if(el.dataset.fxTiltBound==='true') return;
      el.dataset.fxTiltBound='true';
      if(reduce) return;
      el.addEventListener('pointermove',function(event){
        var box=el.getBoundingClientRect();
        var x=(event.clientX-box.left)/box.width-.5; var y=(event.clientY-box.top)/box.height-.5;
        el.style.transform='perspective(400px) rotateY('+(x*10).toFixed(2)+'deg) rotateX('+(-y*10).toFixed(2)+'deg)';
      });
      el.addEventListener('pointerleave',function(){el.style.transform='';});
    });
  }
  function initFlicker(scope){
    (scope||doc).querySelectorAll('.fx-flicker').forEach(function(el){
      if(el.dataset.fxFlickerBound==='true') return;
      el.dataset.fxFlickerBound='true';
      el.addEventListener('click',function(){
        if(reduce) return;
        el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
        root.setTimeout(function(){el.classList.remove('is-on');},460);
      });
    });
  }
  function init(scope){initTilt(scope);initFlicker(scope);}
  if(doc.readyState==='loading') doc.addEventListener('DOMContentLoaded',function(){init();}); else init();
  root.AXMFX={theme:theme,init:init,initTilt:initTilt,initFlicker:initFlicker};
})(window);

