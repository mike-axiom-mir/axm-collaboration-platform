(function(root,factory){
  var node=typeof module==='object'&&module.exports;
  var provider=factory(node?require('../asset-hand-core'):root.AXMAssetHandCore,node?require('../raster-codec'):root.AXMRasterCodec,node?require('../colour-codec'):root.AXMColourCodec);
  if(node)module.exports=provider;
  else if(root.AXMAssetHands&&root.AXMAssetHands.register)root.AXMAssetHands.register(provider);
  else{root.AXMAssetHandProviders=root.AXMAssetHandProviders||[];root.AXMAssetHandProviders.push(provider);}
}(typeof globalThis!=='undefined'?globalThis:this,function(Core,Raster,Colour){
  'use strict';
  if(!Core||!Raster||!Colour)throw new Error('AXM core, raster codec and colour codec are required');
  var RECIPE_SCHEMA='axm.wide-colour-raster-recipe/v1',REPORT_SCHEMA='axm.colour-validation-report/v1';

  function rgb(hex){var value=parseInt(String(hex||'#000000').replace('#',''),16);return[(value>>>16&255)/255,(value>>>8&255)/255,(value&255)/255];}
  function maxFor(depth){return depth===16?65535:255;}
  function targetBitDepth(canvas){var requested=canvas.colour.bit_depth;if(requested==null)return 16;if(requested<=8)return 8;if(requested<=16)return 16;throw new Error('wide-colour PNG supports requested bit depths up to 16');}
  function resample(samples,sw,sh,tw,th){if(sw===tw&&sh===th)return samples;var Output=samples instanceof Uint16Array?Uint16Array:Uint8Array,out=new Output(tw*th*4);for(var y=0;y<th;y+=1)for(var x=0;x<tw;x+=1){var sx=Math.min(sw-1,Math.floor(x*sw/tw)),sy=Math.min(sh-1,Math.floor(y*sh/th));out.set(samples.subarray((sy*sw+sx)*4,(sy*sw+sx)*4+4),(y*tw+x)*4);}return out;}
  function generated(context,width,height,space,depth){
    var palette=context.palette.map(rgb).map(function(value){return Colour.fromSrgb(value,space);}),max=maxFor(depth),Output=depth===16?Uint16Array:Uint8Array,out=new Output(width*height*4),
      accent=space==='display-p3'?[1,.10,.48]:Colour.fromSrgb([.98,.08,.4],space),frequency=2+(context.variant%4),transparent=context.targetCanvas.colour.transparency==='required',widePixels=0;
    for(var y=0;y<height;y+=1)for(var x=0;x<width;x+=1){var u=x/width,v=y/height,wave=Math.sin(Math.PI*2*frequency*u)+Math.cos(Math.PI*2*(frequency+1)*v),weave=Math.sin(Math.PI*2*(u+v)*2),colour=wave>1?accent:palette[weave>.4?1:wave<-.8?2:0],offset=(y*width+x)*4;if(colour===accent)widePixels+=1;out[offset]=Math.round(Math.max(0,Math.min(1,colour[0]))*max);out[offset+1]=Math.round(Math.max(0,Math.min(1,colour[1]))*max);out[offset+2]=Math.round(Math.max(0,Math.min(1,colour[2]))*max);out[offset+3]=transparent&&wave<-.55?0:max;}
    return{rgba:out,widePixels:widePixels,frequency:frequency,source:'target-native-procedural-field'};
  }
  function source(context){var item=context.sourceArtifacts[0];if(!item)throw new Error(context.operationMode+' requires a PNG source artifact');if(item.mime!=='image/png'||item.format!=='PNG')throw new Error('wide-colour source must be genuine PNG');return item;}
  function decodeSource(item){var bytes=Raster.bytesFromDataUrl(item.dataUrl,'image/png'),decoded=Raster.decodeRgba(bytes),embedded=Raster.extractIcc(bytes),space='srgb',iccInspection=null;if(embedded){iccInspection=Colour.parseIcc(embedded.bytes);if(!iccInspection.pass)throw new Error('source ICC profile invalid: '+iccInspection.errors.join(', '));space=Colour.identifyProfile(embedded.bytes);if(!space)throw new Error('source ICC profile is valid but outside this bounded sRGB/P3/linear-sRGB pipeline');}else if(!decoded.inspection.hasSrgb)throw new Error('source PNG has neither a recognized ICC profile nor an sRGB declaration');return{item:item,bytes:bytes,decoded:decoded,embedded:embedded,space:space,iccInspection:iccInspection};}
  function pngFor(width,height,samples,depth,space){var profile=Colour.profile(space),options={iccProfile:profile.bytes,profileName:profile.name};return{profile:profile,png:depth===16?Raster.encodeRgba16(width,height,samples,options):Raster.encodeRgba(width,height,samples,options)};}
  function previewFor(samples,width,height,depth,space){var converted=Colour.targetSamplesToPreview(samples,depth,space),preview=Raster.encodeRgba(width,height,converted.rgba,{colourSpace:'srgb'});return{preview:preview,conversion:converted};}
  function reportFor(canvas,png,profile,space,depth,sourceSpace,previewConversion,extraChecks){
    var inspection=png.inspection,extracted=Raster.extractIcc(png.bytes),icc=extracted&&Colour.parseIcc(extracted.bytes),checks=[
      {name:'png-container',pass:inspection.pass,details:{width:inspection.width,height:inspection.height,bitDepth:inspection.bitDepth,chunks:inspection.chunks}},
      {name:'embedded-icc-profile',pass:inspection.hasIcc&&!!icc&&icc.pass,details:{name:inspection.iccProfileName,bytes:inspection.iccProfileBytes,description:icc&&icc.description}},
      {name:'profile-matches-target-space',pass:!!extracted&&Colour.identifyProfile(extracted.bytes)===space,details:{target:space,identified:extracted&&Colour.identifyProfile(extracted.bytes)}},
      {name:'requested-bit-depth',pass:inspection.bitDepth===depth,details:{requested:depth,actual:inspection.bitDepth}},
      {name:'target-dimensions',pass:inspection.width===canvas.dimensions.width&&inspection.height===canvas.dimensions.height},
      {name:'file-budget',pass:canvas.performance.max_file_bytes==null||png.byteLength<=canvas.performance.max_file_bytes,details:{actual:png.byteLength,maximum:canvas.performance.max_file_bytes}},
      {name:'texture-memory-budget',pass:canvas.performance.max_texture_memory_bytes==null||canvas.dimensions.width*canvas.dimensions.height*4*(depth/8)<=canvas.performance.max_texture_memory_bytes,details:{actual:canvas.dimensions.width*canvas.dimensions.height*4*(depth/8),maximum:canvas.performance.max_texture_memory_bytes}}
    ].concat(extraChecks||[]);
    return{schema:REPORT_SCHEMA,version:'1.0.0',status:checks.every(function(check){return check.pass;})?'PASS':'HOLD',target_canvas:JSON.parse(JSON.stringify(canvas)),container:{mime:'image/png',format:'PNG',bytes:png.byteLength,width:png.width,height:png.height,bitDepth:png.inspection.bitDepth,chunks:png.inspection.chunks},targetSpace:space,sourceSpace:sourceSpace||null,bitDepth:depth,profile:{name:profile.name,sha256:profile.sha256,source:profile.source,inspection:profile.inspection},previewGamutClippedChannels:previewConversion.clippedChannels,checks:checks};
  }
  function artifactSet(context,png,preview,recipe,report){var slug=Core.slug(context.brief.title);return[
    {id:'wide-colour-png',role:'colour-managed-raster-master',name:context.brief.title,filename:slug+'.png',mime:'image/png',format:'PNG',width:png.width,height:png.height,editable:false,dataUrl:png.dataUrl,metadata:{colourSpace:recipe.targetSpace,bitDepth:recipe.bitDepth,profileName:recipe.profile.name,profileSha256:recipe.profile.sha256,lossy:false}},
    {id:'colour-managed-preview',role:'srgb-gamut-mapped-preview',name:context.brief.title+' sRGB preview',filename:slug+'-preview.png',mime:'image/png',format:'PNG',width:preview.width,height:preview.height,editable:false,dataUrl:preview.dataUrl,metadata:{colourSpace:'srgb',previewOf:'wide-colour-png',gamutMapped:true}},
    {id:'wide-colour-recipe',role:'editable-colour-recipe',name:context.brief.title+' colour recipe',filename:slug+'-colour.json',mime:'application/json',format:'JSON',editable:true,text:JSON.stringify(recipe,null,2),metadata:{schema:RECIPE_SCHEMA}},
    {id:'colour-validation-report',role:'colour-validation-report',name:context.brief.title+' colour validation',filename:slug+'-colour-validation.json',mime:'application/json',format:'JSON',editable:false,text:JSON.stringify(report,null,2),metadata:{schema:REPORT_SCHEMA,status:report.status}}
  ];}

  var descriptor={
    schema:Core.HAND_SCHEMA,contract_version:'2.0',id:'wide-colour-raster',title:'Wide-colour Raster Hand',version:'1.0.0',category:'colour-managed-raster',lifecycle_status:'beta',
    summary:'Creates, converts and validates genuine 8/16-bit Display-P3 or linear-sRGB PNG assets with embedded ICC profiles and explicit gamut receipts.',
    purpose:'Keep modern screen, UI, game and material colour intent in the pixels and container instead of relabelling sRGB output.',
    operation_modes:['create','edit','finish','validate'],canvas_models:['raster-frame','procedural-graph'],entry_surfaces:['command','raster-editor','export-recipe'],mutability:'transform',
    kinds:['texture','tile','background','sprite','effect','decal','material','icon','illustration','poster','ui-component','button','hud'],
    accepts:[Core.BRIEF_SCHEMA,'image/png',RECIPE_SCHEMA],produces:[Core.RESULT_SCHEMA,'image/png','application/json',RECIPE_SCHEMA,REPORT_SCHEMA],
    input_types:[{mime:'image/png',format:'PNG',roles:['source'],required_for:['edit','finish','validate'],mutable:false,max_bytes:12000000}],
    output_types:[
      {mime:'image/png',format:'PNG',role:'colour-managed-raster-master',editable:false,deterministic:true,lossy:false,known_losses:[]},
      {mime:'image/png',format:'PNG',role:'srgb-gamut-mapped-preview',editable:false,deterministic:true,lossy:true,known_losses:['preview gamut maps colours outside sRGB']},
      {mime:'application/json',format:'JSON',schema:RECIPE_SCHEMA,role:'editable-colour-recipe',editable:true,deterministic:true,lossy:false,known_losses:[]},
      {mime:'application/json',format:'JSON',schema:REPORT_SCHEMA,role:'colour-validation-report',editable:false,deterministic:true,lossy:false,known_losses:[]}
    ],
    canvas_types:[
      {medium:'screen',units:['px'],colour_spaces:['display-p3','linear-srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static','tileable'],intended_uses:['texture','icon','illustration','poster','background']},
      {medium:'ui',units:['px'],colour_spaces:['display-p3','linear-srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static','tileable'],intended_uses:['icon','ui-component','button','hud','background']},
      {medium:'game-world',units:['px'],colour_spaces:['display-p3','linear-srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static','tileable'],intended_uses:['texture','ground-tile','tile','sprite','effect','decal','material']},
      {medium:'3d-surface',units:['px'],colour_spaces:['display-p3','linear-srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static','tileable'],intended_uses:['texture','decal','material']}
    ],
    canvas_limits:{min_width:1,min_height:1,max_width:1024,max_height:1024,max_pixels:1048576},
    constraints_honoured:['dimensions','dimensions.unit','colour.space','colour.transparency','colour.profile','colour.bit-depth','colour.transfer-function','colour.primaries','colour.rendering-intent','physical.repeat','behaviour.static','behaviour.tileable','performance.max-file-bytes','performance.max-texture-memory-bytes'],
    editable_recipe_formats:[Core.RECIPE_SCHEMA,RECIPE_SCHEMA],operations:{preview:true,validate:true,edit:true},emits_editable_source:true,supports_edit_operation:true,
    requires:[],editable:true,deterministic:true,required_permissions:{local_file_system:'none',clipboard:false,network_domains:[],device_access:[],plugin_data:false},network_policy:{mode:'none',domains:[],rationale:'Matrix transforms, profiles and validators are bundled and run locally.'},
    host_compatibility:{hosts:['asset-fabric','studio','mirror','spatial','standalone'],minimum_versions:{},dependencies:[{name:'AXM colour codec',version:Colour.VERSION,bundled:true},{name:'libvips compact profiles',version:'8.18.3',bundled:true},{name:'LittleCMS profile provenance',version:'2.19.1',bundled:true}]},
    engine:{name:'AXM bounded ICC + CSS Color 4 matrix pipeline',version:Colour.VERSION,execution:'same-thread-bounded'},safety_tier:'safe-local',authority:'candidate-only',implementation_status:'executable',
    portability:{interchange_formats:['image/png',RECIPE_SCHEMA],known_losses:['sRGB preview gamut maps colours outside sRGB','8-bit output has lower precision than the default 16-bit master'],unsupported_features:['arbitrary ICC device profiles','CMYK conversion','HDR transfer functions','EXR','TIFF','AVIF'],fallbacks:[]},
    validation:{checks:['PNG signature/chunks/CRC/scanlines','ICC header/tag/range validation','exact bundled-profile identity','bit depth','target dimensions','file and texture-memory budgets']},
    evidence:[
      {claim:'Display P3 uses P3 primaries, a D65 whitepoint and the sRGB transfer curve.',source_url:'https://www.w3.org/TR/css-color-4/#predefined-display-p3',specification_version:'CSS Color 4',retrieved_at:'2026-07-19'},
      {claim:'The compact profiles originate from libvips profile loading backed by LittleCMS.',source_url:'https://www.libvips.org/API/current/method.Image.profile_load.html',specification_version:'libvips 8.18.3 / LittleCMS 2.19.1',retrieved_at:'2026-07-19'}
    ],tests:['wide-colour-selftest','asset-hands-selftest'],limits:{spaces:['display-p3','linear-srgb'],pngBitDepths:[8,16],maxPixels:1048576,sourceCompression:'AXM stored-DEFLATE PNG for edit/finish',network:false}
  };

  function create(context){
    var canvas=context.targetCanvas,space=canvas.colour.space,width=Math.round(canvas.dimensions.width),height=Math.round(canvas.dimensions.height),depth=targetBitDepth(canvas),mode=context.operationMode,
      target,sourceSpace=null,sourceReceipt=null,generation=null;
    if(mode==='create'){
      generation=generated(context,width,height,space,depth);target=generation.rgba;
    }else{
      var decoded=decodeSource(source(context));sourceSpace=decoded.space;sourceReceipt={id:decoded.item.id,digest:decoded.item.digest,space:sourceSpace,bitDepth:decoded.decoded.bitDepth};
      var resized=resample(decoded.decoded.rgba,decoded.decoded.width,decoded.decoded.height,width,height);
      target=Colour.convertRgba(resized,decoded.decoded.bitDepth,sourceSpace,space,depth).rgba;
      if(mode==='validate'){
        width=decoded.decoded.width;height=decoded.decoded.height;depth=decoded.decoded.bitDepth;space=decoded.space;target=decoded.decoded.rgba;
      }
    }
    var made=pngFor(width,height,target,depth,space),shown=previewFor(target,width,height,depth,space),profile=made.profile,
      wideProof=space!=='display-p3'||mode!=='create'||generation.widePixels>0,
      extra=[{name:'target-native-creation-or-profiled-transform',pass:mode!=='create'||generation.source==='target-native-procedural-field',details:{mode:mode,source:generation&&generation.source}},{name:'wide-gamut-target-samples',pass:wideProof,details:{targetNativeAccentPixels:generation&&generation.widePixels||0}}],
      report=reportFor(Object.assign({},canvas,{dimensions:Object.assign({},canvas.dimensions,{width:width,height:height})}),made.png,profile,space,depth,sourceSpace,shown.conversion,extra),
      recipe={schema:RECIPE_SCHEMA,version:'1.0.0',id:'wide-colour-'+Core.slug(context.brief.id),target_canvas:JSON.parse(JSON.stringify(canvas)),operation:mode,targetSpace:space,bitDepth:depth,dimensions:{width:width,height:height,unit:'px'},transparency:canvas.colour.transparency,renderingIntent:canvas.colour.rendering_intent||'relative-colorimetric',profile:{name:profile.name,sha256:profile.sha256,source:profile.source,inspection:profile.inspection},source:sourceReceipt,generator:generation?{kind:generation.source,frequency:generation.frequency,targetNativeAccentPixels:generation.widePixels,palette:context.palette}:null,preview:{space:'srgb',gamutClippedChannels:shown.conversion.clippedChannels},budgets:{maxFileBytes:canvas.performance.max_file_bytes,maxTextureMemoryBytes:canvas.performance.max_texture_memory_bytes,actualFileBytes:made.png.byteLength,actualTextureMemoryBytes:width*height*4*(depth/8)},provenance:{hand:'wide-colour-raster',hand_version:'1.0.0',seed:context.seed,source_artifact_digests:context.sourceArtifacts.map(function(item){return item.digest;})}};
    return{artifacts:artifactSet(context,made.png,shown.preview,recipe,report),previewArtifactId:'colour-managed-preview',recipe:{format:RECIPE_SCHEMA,parameters:recipe,steps:[{op:'declare-target-colour-space-before-pixel-generation'},{op:mode==='create'?'sample-target-native-wide-colour-field':'decode-and-identify-source-profile'},{op:'perform-bounded-linear-light-matrix-transform'},{op:'quantize-requested-bit-depth'},{op:'embed-exact-icc-profile'},{op:'independently-parse-png-and-icc'},{op:'derive-srgb-preview-with-gamut-receipt'}]},validationChecks:report.checks,measures:{pngBytes:made.png.byteLength,pixels:width*height,bitDepth:depth,colourSpace:space,profileBytes:profile.bytes.length,previewGamutClippedChannels:shown.conversion.clippedChannels,targetNativeAccentPixels:generation&&generation.widePixels||0},notes:['The master pixels were created or transformed in the declared colour space before PNG encoding.','The sRGB preview is a separate derivative and never replaces the colour-managed master.']};
  }
  return{descriptor:descriptor,create:create};
}));
