(function (root, factory) {
  var node = typeof module === 'object' && module.exports;
  var provider = factory(node ? require('../asset-hand-core') : root.AXMAssetHandCore, node ? require('../../visual-kernel/visual-kernel') : root.AXMVisualKernel);
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core, Kernel) {
  'use strict';
  if (!Kernel) throw new Error('AXM Visual Kernel is required');
  function parseSource(context) {
    if (context.operationMode !== 'edit') return null;
    var source=context.sourceArtifacts[0];
    if (!source) throw new Error('Theme edit requires a token source artifact');
    try { return JSON.parse(source.text); } catch (error) { throw new Error('Theme token source must be valid JSON'); }
  }
  function requestedProfile(context, source) {
    if (source && Kernel.PROFILE_NAMES.indexOf(source.profile) >= 0) return source.profile;
    var signal=[context.brief.title,context.brief.purpose].concat(context.brief.styleTags||[]).join(' ').toLowerCase();
    if (/high[- ]contrast|maximum contrast/.test(signal) || Number(context.targetCanvas.colour.minimum_contrast_ratio)>=7) return 'high-contrast';
    if (/light|day|paper|bright/.test(signal)) return 'light';
    return 'dark';
  }
  function previewSvg(brief, tokens) {
    var width=brief.canvas.width,height=brief.canvas.height,c=tokens.colours,pad=Math.max(8,Math.round(Math.min(width,height)*.06)),row=(height-pad*2)/4;
    var body='<rect width="'+width+'" height="'+height+'" fill="'+c.canvas+'"/><rect x="'+pad+'" y="'+pad+'" width="'+(width-pad*2)+'" height="'+(height-pad*2)+'" rx="'+Math.max(6,pad*.5)+'" fill="'+c.surface+'" stroke="'+c['edge-strong']+'"/>';
    body+='<rect x="'+(pad*1.7)+'" y="'+(pad*1.7)+'" width="'+(width-pad*3.4)+'" height="'+Math.max(10,row*.72)+'" rx="'+Math.max(4,pad*.3)+'" fill="'+c['surface-raised']+'"/><circle cx="'+(pad*2.5)+'" cy="'+(pad*1.7+row*.36)+'" r="'+Math.max(3,row*.15)+'" fill="'+c.brand+'"/><path d="M'+(pad*3.3)+' '+(pad*1.7+row*.26)+' H'+(width-pad*2.3)+' M'+(pad*3.3)+' '+(pad*1.7+row*.48)+' H'+(width-pad*4.3)+'" stroke="'+c.text+'" stroke-width="'+Math.max(2,row*.08)+'" stroke-linecap="round"/>';
    [c.action,c.success,c.warning,c.danger,c.info].forEach(function(colour,index){var sw=(width-pad*3.4)/5;body+='<rect x="'+(pad*1.7+index*sw)+'" y="'+(height-pad*2.35)+'" width="'+Math.max(4,sw-pad*.25)+'" height="'+Math.max(6,row*.55)+'" rx="'+Math.max(3,pad*.22)+'" fill="'+colour+'"/>';});
    return Core.svgDocument(brief,body,{label:brief.title+' '+tokens.profile+' theme token preview'});
  }
  return {
    descriptor:{
      schema:Core.HAND_SCHEMA,contract_version:'2.0',id:'theme-token',title:'Theme Token Hand',version:'1.1.0',category:'theme',lifecycle_status:'beta',
      summary:'Creates or edits semantic Visual Kernel token bundles with deterministic CSS and contrast validation.',purpose:'Manage host-neutral semantic visual tokens without applying them automatically.',
      operation_modes:['create','edit'],canvas_models:['dom-component','node-tree-design'],entry_surfaces:['command','panel','export-recipe'],mutability:'transform',
      kinds:['theme','design-tokens'],
      accepts:[Core.BRIEF_SCHEMA,'axm.visual-kernel.tokens/v1'],produces:[Core.RESULT_SCHEMA,'application/json','text/css','image/svg+xml'],
      input_types:[{mime:'application/json',schema:'axm.visual-kernel.tokens/v1',roles:['source'],required_for:['edit'],mutable:false,max_bytes:524288}],
      output_types:[
        {mime:'application/json',format:'JSON',schema:'axm.visual-kernel.tokens/v1',role:'editable-token-source',editable:true,deterministic:true,lossy:false,known_losses:[]},
        {mime:'text/css',format:'CSS',role:'css-variable-map',editable:true,deterministic:true,lossy:false,known_losses:[]},
        {mime:'image/svg+xml',format:'SVG',role:'token-preview',editable:false,deterministic:true,lossy:true,known_losses:['preview does not encode component behaviour']}
      ],
      canvas_types:[
        {medium:'ui',units:['px'],colour_spaces:['srgb'],transparency_modes:['opaque'],behaviours:['static','interactive','responsive'],intended_uses:['theme','design-tokens','skin','ui-component']},
        {medium:'screen',units:['px'],colour_spaces:['srgb'],transparency_modes:['opaque'],behaviours:['static','interactive','responsive'],intended_uses:['theme','design-tokens','skin']}
      ],
      constraints_honoured:['dimensions','dimensions.unit','colour.space','colour.transparency','colour.contrast','behaviour.static','behaviour.interactive','behaviour.responsive','performance.max-file-bytes'],
      editable_recipe_formats:[Core.RECIPE_SCHEMA,'axm.theme-token-recipe/v1'],operations:{preview:true,validate:true,edit:true},emits_editable_source:true,supports_edit_operation:true,requires:[],editable:true,deterministic:true,
      required_permissions:{local_file_system:'none',network_domains:[]},network_policy:{mode:'none',domains:[]},
      engine:{name:'AXM Visual Kernel',version:Kernel.VERSION,execution:'same-thread-bounded'},safety_tier:'safe-local',
      portability:{interchange_formats:['application/json','text/css'],known_losses:[],unsupported_features:['automatic Godot theme serialization','automatic Unity TSS serialization'],fallbacks:[]},
      validation:{checks:['required semantic roles','text contrast','secondary text contrast','focus contrast','file budget']},rollback:{strategy:'discard-candidate'},
      evidence:[{claim:'Executable semantic token registry with three validated profiles.',source_url:'local:shared/visual-kernel/visual-kernel.js',specification_version:Kernel.VERSION}],
      tests:['visual-kernel-selftest','asset-hands-selftest'],implementation_priority:'quick-win',limits:{automaticApply:false,remoteFonts:false,rawScripts:false}
    },
    create:function(context){
      var source=parseSource(context),profile=requestedProfile(context,source),overrides=source&&source.colours?source.colours:{};
      if (context.brief.palette.length) { overrides=Object.assign({},overrides,{brand:context.brief.palette[0],action:context.brief.palette[1]||context.brief.palette[0]}); }
      var bundle=Kernel.bundle({id:Core.slug(context.brief.title),profile:profile,colours:overrides},context.targetCanvas.colour.minimum_contrast_ratio||4.5);
      var tokenDocument=Object.assign({},bundle.tokens,{target_canvas:context.targetCanvas,intended_use:context.brief.intended_use,validation_digest:bundle.validation.digest});
      var tokenText=JSON.stringify(tokenDocument,null,2),css=Kernel.cssText(bundle.tokens),svg=previewSvg(context.brief,bundle.tokens),totalBytes=tokenText.length+css.length+svg.length;
      return {
        artifacts:[
          {id:'theme-tokens',role:'editable-token-source',name:context.brief.title+' tokens',filename:Core.slug(context.brief.title)+'.tokens.json',mime:'application/json',format:'JSON',editable:true,text:tokenText,metadata:{schema:Kernel.SCHEMA,profile:profile}},
          {id:'theme-css',role:'css-variable-map',name:context.brief.title+' CSS variables',filename:Core.slug(context.brief.title)+'.tokens.css',mime:'text/css',format:'CSS',editable:true,text:css,metadata:{sourceSchema:Kernel.SCHEMA}},
          {id:'theme-preview',role:'token-preview',name:context.brief.title+' preview',filename:Core.slug(context.brief.title)+'-tokens.svg',mime:'image/svg+xml',format:'SVG',editable:false,text:svg,width:context.brief.canvas.width,height:context.brief.canvas.height,metadata:{profile:profile}}
        ],
        previewArtifactId:'theme-preview',
        recipe:{format:'axm.theme-token-recipe/v1',parameters:{profile:profile,overrideRoles:bundle.tokens.provenance.override_roles,operation:context.operationMode,minimumContrast:bundle.validation.minimum_contrast},steps:[{op:'select-semantic-profile'},{op:'apply-bounded-role-overrides'},{op:'validate-contrast-and-required-roles'},{op:'emit-json-css-and-preview'}]},
        validationChecks:bundle.validation.checks.concat([{name:'kernel-validation',pass:bundle.validation.status==='PASS'},{name:'target-canvas-propagated',pass:context.targetCanvas.schema===Core.TARGET_CANVAS_SCHEMA},{name:'file-budget',pass:context.targetCanvas.performance.max_file_bytes==null||totalBytes<=context.targetCanvas.performance.max_file_bytes}]),
        measures:{profile:profile,semanticRoles:Object.keys(bundle.tokens.colours).length,cssVariables:Object.keys(bundle.variables).length,totalBytes:totalBytes},
        notes:['The hand creates candidate tokens only; no host theme is applied automatically.']
      };
    }
  };
}));
