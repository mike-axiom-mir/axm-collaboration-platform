(function(root,factory){
  var api=factory(root||{});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.AXMComputedStyleHand=api;
})(typeof globalThis!=='undefined'?globalThis:(typeof self!=='undefined'?self:this),function(host){
  'use strict';

  var CAPABILITY='ui.render.computed-style/v1';
  var RESULT_SCHEMA='axm.ui-computed-style-measurements/v1';
  var TEXT_TAGS={A:1,B:1,BUTTON:1,CAPTION:1,CODE:1,DD:1,DT:1,EM:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,INPUT:1,LABEL:1,LEGEND:1,LI:1,OPTION:1,P:1,PRE:1,SELECT:1,SMALL:1,SPAN:1,STRONG:1,TD:1,TEXTAREA:1,TH:1};
  var INTERACTIVE_TAGS={BUTTON:1,INPUT:1,SELECT:1,TEXTAREA:1,SUMMARY:1};
  var INTERACTIVE_ROLES={button:1,checkbox:1,combobox:1,link:1,menuitem:1,option:1,radio:1,slider:1,spinbutton:1,switch:1,tab:1,textbox:1};

  function clamp(value,min,max,fallback){value=Number(value);return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;}
  function finite(value,fallback){value=Number(value);return Number.isFinite(value)?value:fallback;}
  function byte(value){return Math.max(0,Math.min(255,Math.round(value)));}
  function alpha(value){return Math.max(0,Math.min(1,Number(value)));}
  function parseChannel(value){value=String(value||'').trim();return value.endsWith('%')?byte(parseFloat(value)*2.55):byte(parseFloat(value));}
  function parseAlpha(value){value=String(value==null?'1':value).trim();return value.endsWith('%')?alpha(parseFloat(value)/100):alpha(parseFloat(value));}
  function parseCssColor(value){
    value=String(value||'').trim().toLowerCase();
    if(!value)return null;
    if(value==='transparent')return{r:0,g:0,b:0,a:0};
    if(value==='black')return{r:0,g:0,b:0,a:1};
    if(value==='white')return{r:255,g:255,b:255,a:1};
    var hex=value.match(/^#([a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i);
    if(hex){var raw=hex[1];if(raw.length===3)raw=raw.split('').map(function(ch){return ch+ch;}).join('');return{r:parseInt(raw.slice(0,2),16),g:parseInt(raw.slice(2,4),16),b:parseInt(raw.slice(4,6),16),a:raw.length===8?parseInt(raw.slice(6,8),16)/255:1};}
    var fn=value.match(/^rgba?\((.*)\)$/i);
    if(!fn)return null;
    var parts=fn[1].replace(/\s*\/\s*/g,',').split(/[\s,]+/).filter(Boolean);
    if(parts.length<3)return null;
    return{r:parseChannel(parts[0]),g:parseChannel(parts[1]),b:parseChannel(parts[2]),a:parseAlpha(parts[3])};
  }
  function composite(over,under){
    over=over||{r:0,g:0,b:0,a:0};under=under||{r:0,g:0,b:0,a:0};
    var outA=over.a+under.a*(1-over.a);if(outA<=0)return{r:0,g:0,b:0,a:0};
    return{r:(over.r*over.a+under.r*under.a*(1-over.a))/outA,g:(over.g*over.a+under.g*under.a*(1-over.a))/outA,b:(over.b*over.a+under.b*under.a*(1-over.a))/outA,a:outA};
  }
  function opaqueHex(colour){if(!colour||colour.a<0.999)return null;return'#'+[colour.r,colour.g,colour.b].map(function(value){return byte(value).toString(16).padStart(2,'0');}).join('');}
  function attr(element,name){return element&&typeof element.getAttribute==='function'?element.getAttribute(name):null;}
  function tag(element){return String(element&&element.tagName||'').toUpperCase();}
  function safeId(value,fallback){value=String(value||'').replace(/\s+/g,'-').replace(/[*?\[\]]/g,'').slice(0,180);return value||fallback;}
  function styleValue(style,name,fallback){var value=style&&style[name];return value==null||value===''?(fallback==null?'':fallback):String(value);}
  function rectOf(element){
    if(!element||typeof element.getBoundingClientRect!=='function')return{width:0,height:0};
    var rect=element.getBoundingClientRect()||{};return{width:Math.max(0,finite(rect.width,0)),height:Math.max(0,finite(rect.height,0))};
  }
  function isVisible(element,style){
    var rect=rectOf(element),opacity=finite(styleValue(style,'opacity','1'),1);
    return styleValue(style,'display','block')!=='none'&&!/^(hidden|collapse)$/.test(styleValue(style,'visibility','visible'))&&opacity>0&&rect.width>0&&rect.height>0;
  }
  function isContrastCandidate(element){return !!(TEXT_TAGS[tag(element)]||attr(element,'data-axm-contrast-role'));}
  function isInteractive(element){
    var elementTag=tag(element),role=String(attr(element,'role')||'').toLowerCase(),rawTabIndex=attr(element,'tabindex'),tabIndex=rawTabIndex==null?-1:finite(rawTabIndex,-1);
    return !!(INTERACTIVE_TAGS[elementTag]||(elementTag==='A'&&attr(element,'href')!=null)||INTERACTIVE_ROLES[role]||tabIndex>=0);
  }
  function contrastRole(element,style){
    var declared=String(attr(element,'data-axm-contrast-role')||'').toLowerCase();
    if(declared==='normal-text'||declared==='large-text'||declared==='ui-component')return declared;
    var size=finite(String(styleValue(style,'fontSize','0')).replace('px',''),0),weight=finite(styleValue(style,'fontWeight','400'),400);
    return size>=24||(size>=18.66&&weight>=700)?'large-text':'normal-text';
  }
  function backgroundFor(element,styleOf){
    var chain=[],cursor=element,guard=0,seams=[];
    while(cursor&&guard++<64){chain.push(cursor);cursor=cursor.parentElement||null;}
    var result={r:0,g:0,b:0,a:0};
    for(var index=chain.length-1;index>=0;index--){
      var style=styleOf(chain[index]),image=styleValue(style,'backgroundImage','none'),opacity=finite(styleValue(style,'opacity','1'),1),colour=parseCssColor(styleValue(style,'backgroundColor','transparent'));
      if(image&&image!=='none')seams.push('COMPLEX_BACKGROUND_UNRESOLVED');
      if(opacity<0.999)seams.push('ANCESTOR_OPACITY_UNRESOLVED');
      if(!colour)seams.push('BACKGROUND_COLOUR_UNRESOLVED');else result=composite(colour,result);
    }
    if(result.a<0.999)seams.push('TRANSPARENT_CANVAS_UNRESOLVED');
    return{colour:seams.length?null:result,seams:Array.from(new Set(seams))};
  }
  function resolveTarget(documentRef,targetId){
    var exact=String(targetId||'').trim();if(!exact||/[*?\[\]]/.test(exact))throw new Error('targetId must be an exact non-wildcard identifier');
    var byId=typeof documentRef.getElementById==='function'?documentRef.getElementById(exact):null;if(byId)return byId;
    var marked=typeof documentRef.querySelectorAll==='function'?documentRef.querySelectorAll('[data-axm-target-id]'):[];
    for(var index=0;index<marked.length;index++)if(String(attr(marked[index],'data-axm-target-id')||'')===exact)return marked[index];
    throw new Error('exact visual target was not found: '+exact);
  }
  function create(options){
    options=options||{};
    var documentRef=options.document||host.document;
    var styleOf=options.getComputedStyle||(typeof host.getComputedStyle==='function'?host.getComputedStyle.bind(host):null);
    var configuredMax=Math.floor(clamp(options.maxElements,1,200,200));
    if(!documentRef||typeof styleOf!=='function')throw new Error('browser document and getComputedStyle are required');

    function readComputedStyles(input){
      input=input||{};
      var targetId=String(input.targetId||'').trim(),maximum=Math.floor(clamp(input.maxElements,1,configuredMax,configuredMax));
      var rootElement=resolveTarget(documentRef,targetId);
      var descendants=typeof rootElement.querySelectorAll==='function'?Array.prototype.slice.call(rootElement.querySelectorAll('*')):[];
      var discovered=[rootElement].concat(descendants),elements=discovered.slice(0,maximum),measurementCount=0,overflow=false,seams=[];
      var measured={contrastPairs:[],interactiveTargets:[],criticalText:[],signals:[]};
      function add(group,row){if(measurementCount>=maximum){overflow=true;return;}measured[group].push(row);measurementCount++;}
      elements.forEach(function(element,index){
        var style=styleOf(element),box=rectOf(element);if(!isVisible(element,style))return;
        var id=safeId(attr(element,'data-axm-measure-id')||element.id,'element-'+(index+1));
        if(isContrastCandidate(element)){
          var background=backgroundFor(element,styleOf),foreground=parseCssColor(styleValue(style,'color',''));
          background.seams.forEach(function(seam){seams.push(seam);});
          var renderedForeground=background.colour&&foreground?composite(foreground,background.colour):null;
          add('contrastPairs',{id:id+'-contrast',foreground:opaqueHex(renderedForeground)||'',background:opaqueHex(background.colour)||'',role:contrastRole(element,style)});
        }
        if(isInteractive(element))add('interactiveTargets',{id:id+'-target',widthPx:Number(box.width.toFixed(3)),heightPx:Number(box.height.toFixed(3))});
        if(attr(element,'data-axm-critical-text')==='true'||/^(alert|status)$/.test(String(attr(element,'role')||'').toLowerCase())){
          add('criticalText',{id:id+'-critical',fontSizePx:Number(finite(String(styleValue(style,'fontSize','0')).replace('px',''),0).toFixed(3))});
        }
        if(attr(element,'data-axm-uses-sound')!=null){
          add('signals',{id:id+'-signal',usesSound:attr(element,'data-axm-uses-sound')==='true',visibleEquivalent:attr(element,'data-axm-visible-equivalent')==='true'});
        }
      });
      var truncated=discovered.length>maximum||overflow;
      if(truncated)seams.push('MEASUREMENT_BUDGET_EXCEEDED');
      measured.coverage={complete:!truncated,inspectedElements:elements.length,discoveredElements:discovered.length,measurementCount:measurementCount,maxElements:maximum};
      return{
        schema:RESULT_SCHEMA,capability:CAPABILITY,version:'1.0.0',targetId:targetId,observedAt:String(input.observedAt||new Date().toISOString()),
        measuredProperties:measured,coverage:measured.coverage,namedSeams:Array.from(new Set(seams)),contentInspected:false,rawPixelsRetained:false,measurementsRetained:false,
        tookNoDirectAction:true,mutatedSurface:false,cleanupComplete:true
      };
    }
    return{capability:CAPABILITY,read:readComputedStyles,readComputedStyles:readComputedStyles,status:function(){return{capability:CAPABILITY,maxElements:configuredMax,contentInspected:false,rawPixelsRetained:false,mutatesSurface:false};}};
  }
  var descriptor={
    id:'browser-computed-style-reader',capability:CAPABILITY,version:'1.0.0',status:'TEST',
    accepts:['exact same-document targetId','bounded maxElements'],produces:[RESULT_SCHEMA],sideEffects:[],permissions:['same-document DOM read initiated by the host'],
    resourceBudget:{maxElements:200,rawRetainedBytesAfterSeal:0},failureRecovery:['return exact target error','mark incomplete coverage UNKNOWN','mark complex backgrounds UNKNOWN'],
    compatibility:'Browser DOM and getComputedStyle; injected into Sensorium Eye 4 through readComputedStyles.',verification:['pure colour and bounded-measurement selftest','live browser fixture','Sensorium runtime proof'],
    automaticApply:false,automaticPublish:false,contentInspected:false,rawPixelsRetained:false
  };
  return{CAPABILITY:CAPABILITY,RESULT_SCHEMA:RESULT_SCHEMA,descriptor:descriptor,parseCssColor:parseCssColor,composite:composite,opaqueHex:opaqueHex,resolveTarget:resolveTarget,create:create};
});
