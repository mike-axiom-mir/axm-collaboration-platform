(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMVisualKernel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.2.0';
  var SCHEMA = 'axm.visual-kernel.tokens/v1';
  var PROFILE_NAMES = ['dark', 'light', 'high-contrast'];
  var REQUIRED_COLOURS = ['canvas', 'surface', 'surface-raised', 'surface-strong', 'text', 'text-secondary', 'text-quiet', 'brand', 'action', 'focus', 'info', 'success', 'warning', 'danger', 'edge-subtle', 'edge-strong'];
  var SHARED = {
    fonts: { sans:'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', mono:'ui-monospace,"Cascadia Mono","SFMono-Regular",Consolas,monospace' },
    type: { meta:'.75rem', 'body-sm':'.875rem', body:'1rem', subtitle:'1.25rem', title:'1.75rem', display:'2.5rem' },
    space: { 1:'.25rem', 2:'.5rem', 3:'.75rem', 4:'1rem', 6:'1.5rem', 8:'2rem', 12:'3rem', 16:'4rem' },
    radius: { sm:'.5rem', md:'.75rem', lg:'1.125rem', xl:'1.5rem', pill:'999px' },
    shadow: { 1:'0 1px 2px rgb(0 0 0/.28)', 2:'0 12px 32px rgb(0 0 0/.28)', 3:'0 28px 72px rgb(0 0 0/.44)' },
    motion: { quick:'140ms', standard:'220ms', emphasis:'360ms', 'ease-standard':'cubic-bezier(.2,.8,.2,1)', 'ease-emphasis':'cubic-bezier(.16,1,.3,1)' },
    target: { min:'2.75rem' }
  };
  var PROFILES = {
    dark: {
      color_scheme:'dark',
      colours:{ canvas:'#050810', surface:'#080d18', 'surface-raised':'#0d1524', 'surface-strong':'#121d2f', text:'#f2f6fb', 'text-secondary':'#b5c2d2', 'text-quiet':'#72839a', brand:'#58d2df', action:'#718cff', focus:'#a7efff', info:'#55bfea', success:'#61d69e', warning:'#efbd65', danger:'#f17d7b', 'edge-subtle':'#303b4b', 'edge-strong':'#586ea6' }
    },
    light: {
      color_scheme:'light',
      colours:{ canvas:'#f4f7fb', surface:'#ffffff', 'surface-raised':'#f8fafc', 'surface-strong':'#e9eef5', text:'#172231', 'text-secondary':'#48586b', 'text-quiet':'#68788b', brand:'#086d7a', action:'#3659c9', focus:'#0b6674', info:'#176f99', success:'#18794e', warning:'#805500', danger:'#b4232c', 'edge-subtle':'#d6dee8', 'edge-strong':'#8094bd' }
    },
    'high-contrast': {
      color_scheme:'dark',
      colours:{ canvas:'#000000', surface:'#000000', 'surface-raised':'#090909', 'surface-strong':'#111111', text:'#ffffff', 'text-secondary':'#ffffff', 'text-quiet':'#d9d9d9', brand:'#6effff', action:'#91a8ff', focus:'#ffff00', info:'#72d7ff', success:'#6effa8', warning:'#ffdd66', danger:'#ff8b8b', 'edge-subtle':'#a0a0a0', 'edge-strong':'#ffffff' }
    }
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function hash(value) { var source=typeof value==='string'?value:JSON.stringify(value),out=2166136261;for(var i=0;i<source.length;i+=1){out^=source.charCodeAt(i);out=Math.imul(out,16777619);}return(out>>>0).toString(16).padStart(8,'0'); }
  function clean(value, max) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200); }
  function colour(value, fallback) { var candidate=String(value||'').trim().toLowerCase();return /^#[0-9a-f]{6}$/.test(candidate)?candidate:fallback; }
  function rgb(hex) { var n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]; }
  function luminance(hex) { return rgb(hex).map(function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce(function(sum,v,index){return sum+v*[.2126,.7152,.0722][index];},0); }
  function contrastRatio(left, right) { var a=luminance(left),b=luminance(right);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05); }
  function normalize(input) {
    input=input||{};
    var name=PROFILE_NAMES.indexOf(input.profile)>=0?input.profile:'dark',base=PROFILES[name],overrides=input.colours||input.colors||{},colours={};
    REQUIRED_COLOURS.forEach(function(role){colours[role]=colour(overrides[role],base.colours[role]);});
    return { schema:SCHEMA, version:VERSION, id:clean(input.id,100)||'axm-kernel-'+name, profile:name, color_scheme:base.color_scheme, colours:colours, shared:clone(SHARED), provenance:{source:'AXM Visual Kernel',source_version:VERSION,base_profile:name,override_roles:Object.keys(overrides).filter(function(role){return REQUIRED_COLOURS.indexOf(role)>=0;}).sort()} };
  }
  function validate(input, minimumContrast) {
    var tokens=normalize(input),minimum=Number(minimumContrast);if(!Number.isFinite(minimum))minimum=4.5;
    var checks=[];
    REQUIRED_COLOURS.forEach(function(role){checks.push({name:'role:'+role,pass:/^#[0-9a-f]{6}$/.test(tokens.colours[role])});});
    checks.push({name:'text-on-canvas',pass:contrastRatio(tokens.colours.text,tokens.colours.canvas)>=minimum,value:contrastRatio(tokens.colours.text,tokens.colours.canvas)});
    checks.push({name:'text-on-surface',pass:contrastRatio(tokens.colours.text,tokens.colours.surface)>=minimum,value:contrastRatio(tokens.colours.text,tokens.colours.surface)});
    checks.push({name:'secondary-on-canvas',pass:contrastRatio(tokens.colours['text-secondary'],tokens.colours.canvas)>=3,value:contrastRatio(tokens.colours['text-secondary'],tokens.colours.canvas)});
    checks.push({name:'focus-on-canvas',pass:contrastRatio(tokens.colours.focus,tokens.colours.canvas)>=3,value:contrastRatio(tokens.colours.focus,tokens.colours.canvas)});
    return { schema:'axm.visual-kernel.validation/v1', status:checks.every(function(check){return check.pass;})?'PASS':'HOLD', profile:tokens.profile, minimum_contrast:minimum, checks:checks, digest:hash([tokens,checks]) };
  }
  function cssVariables(input) {
    var tokens=normalize(input),out={'--axm-color-scheme':tokens.color_scheme};
    Object.keys(tokens.colours).forEach(function(key){out['--axm-'+key]=tokens.colours[key];});
    Object.keys(tokens.shared.fonts).forEach(function(key){out['--axm-font-'+key]=tokens.shared.fonts[key];});
    Object.keys(tokens.shared.type).forEach(function(key){out['--axm-text-'+key]=tokens.shared.type[key];});
    Object.keys(tokens.shared.space).forEach(function(key){out['--axm-space-'+key]=tokens.shared.space[key];});
    Object.keys(tokens.shared.radius).forEach(function(key){out['--axm-radius-'+key]=tokens.shared.radius[key];});
    Object.keys(tokens.shared.shadow).forEach(function(key){out['--axm-shadow-'+key]=tokens.shared.shadow[key];});
    Object.keys(tokens.shared.motion).forEach(function(key){out['--axm-motion-'+key]=tokens.shared.motion[key];});
    out['--axm-target-min']=tokens.shared.target.min;
    return out;
  }
  function cssText(input, selector) {
    var tokens=normalize(input),variables=cssVariables(tokens),target=clean(selector,120)||':root';
    return '/* '+SCHEMA+' · '+tokens.profile+' · '+hash(tokens)+' */\n'+target+' {\n'+Object.keys(variables).sort().map(function(key){return'  '+key+': '+variables[key]+';';}).join('\n')+'\n}\n';
  }
  function bundle(input, minimumContrast) { var tokens=normalize(input);return{tokens:tokens,variables:cssVariables(tokens),css:cssText(tokens),validation:validate(tokens,minimumContrast),digest:hash(tokens)}; }

  return { VERSION:VERSION, SCHEMA:SCHEMA, PROFILE_NAMES:PROFILE_NAMES.slice(), REQUIRED_COLOURS:REQUIRED_COLOURS.slice(), SHARED:clone(SHARED), PROFILES:clone(PROFILES), normalize:normalize, validate:validate, contrastRatio:contrastRatio, cssVariables:cssVariables, cssText:cssText, bundle:bundle, hash:hash };
}));
