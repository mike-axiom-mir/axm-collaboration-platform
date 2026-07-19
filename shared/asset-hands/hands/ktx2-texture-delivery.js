(function (root, factory) {
  var node = typeof module === 'object' && module.exports;
  var provider = factory(
    node ? require('../asset-hand-core') : root.AXMAssetHandCore,
    node ? require('../ktx2-codec') : root.AXMKTX2Codec,
    node ? require('../raster-codec') : root.AXMRasterCodec
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core, KTX2, Raster) {
  'use strict';
  if (!Core || !KTX2 || !Raster) throw new Error('AXM core, KTX2 and raster codecs are required');

  var RECIPE_SCHEMA = 'axm.ktx2-texture-recipe/v1';
  var REPORT_SCHEMA = 'axm.ktx2-validation-report/v1';

  function rgb(hex) {
    var value = parseInt(String(hex || '#000000').replace('#', ''), 16);
    return [(value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  }
  function generatedPixels(context, width, height) {
    var canvas=context.targetCanvas, colours=context.palette.map(rgb), rgba=new Uint8Array(width*height*4), repeat=canvas.physical.repeat, tileable=canvas.behaviour.indexOf('tileable')>=0||repeat.mode!=='none';
    var periodX=repeat.width==null?width:Math.max(1,Math.min(width,Math.round(repeat.width))), periodY=repeat.height==null?height:Math.max(1,Math.min(height,Math.round(repeat.height)));
    var frequency=2+(context.variant%4), transparent=canvas.colour.transparency==='required';
    for (var y=0; y<height; y+=1) for (var x=0; x<width; x+=1) {
      var u=(x%periodX)/periodX, v=(y%periodY)/periodY;
      var wave=Math.sin(Math.PI*2*frequency*u)+Math.cos(Math.PI*2*(frequency+1)*v), weave=Math.sin(Math.PI*2*(u+v)*2);
      var choice=wave>.9?1:weave>.5?3:wave<-.9?2:0, colour=colours[choice%colours.length], offset=(y*width+x)*4;
      rgba[offset]=colour[0];rgba[offset+1]=colour[1];rgba[offset+2]=colour[2];rgba[offset+3]=transparent&&wave<-.55?0:255;
    }
    return {rgba:rgba,periodX:periodX,periodY:periodY,frequency:frequency,tileable:tileable,repeatExact:(repeat.width==null||Math.round(repeat.width)===repeat.width)&&(repeat.height==null||Math.round(repeat.height)===repeat.height)};
  }
  function resampleNearest(source, sourceWidth, sourceHeight, width, height) {
    if (sourceWidth===width&&sourceHeight===height) return source;
    var output=new Uint8Array(width*height*4);
    for (var y=0; y<height; y+=1) for (var x=0; x<width; x+=1) {
      var sx=Math.min(sourceWidth-1,Math.floor(x*sourceWidth/width)), sy=Math.min(sourceHeight-1,Math.floor(y*sourceHeight/height));
      output.set(source.subarray((sy*sourceWidth+sx)*4,(sy*sourceWidth+sx)*4+4),(y*width+x)*4);
    }
    return output;
  }
  function previewFromRgba(rgba, width, height, colourSpace) {
    var scale=Math.min(1,256/Math.max(width,height)), previewWidth=Math.max(1,Math.round(width*scale)), previewHeight=Math.max(1,Math.round(height*scale));
    var previewPixels=resampleNearest(rgba,width,height,previewWidth,previewHeight);
    return Raster.encodeRgba(previewWidth,previewHeight,previewPixels,{colourSpace:colourSpace==='srgb'?'srgb':null});
  }
  function diagnosticPreview() {
    var width=16,height=16,rgba=new Uint8Array(width*height*4);
    for(var y=0;y<height;y+=1)for(var x=0;x<width;x+=1){var offset=(y*width+x)*4,on=((x>>2)+(y>>2))%2===0;rgba[offset]=on?255:35;rgba[offset+1]=0;rgba[offset+2]=on?180:35;rgba[offset+3]=255;}
    return Raster.encodeRgba(width,height,rgba,{colourSpace:'srgb'});
  }
  function textureMemory(width,height,levels,alpha) {
    var compressed=0,rgbaFallback=0,levelReceipts=[];
    for(var level=0;level<levels;level+=1){var w=Math.max(1,width>>level),h=Math.max(1,height>>level),gpu=Math.ceil(w/4)*Math.ceil(h/4)*(alpha?16:8),rgba=w*h*4;compressed+=gpu;rgbaFallback+=rgba;levelReceipts.push({level:level,width:w,height:h,gpu_bytes:gpu,rgba_fallback_bytes:rgba});}
    return {gpu_target:alpha?'ETC2_RGBA':'ETC1_RGB',compressed_bytes:compressed,rgba_fallback_bytes:rgbaFallback,levels:levelReceipts};
  }
  function fitMipBudget(width,height,requested,alpha,budget) {
    var plan=KTX2.mipPlan(width,height,requested), levels=plan.levels;
    while(levels>1&&budget!=null&&textureMemory(width,height,levels,alpha).compressed_bytes>budget)levels-=1;
    return {levels:levels,requested:plan.levels,full:plan.fullLevels,memory:textureMemory(width,height,levels,alpha)};
  }
  function qualityCandidates(minimumScore) {
    var minimum=Math.max(1,Math.ceil(Number(minimumScore||0)*255)), values=[220,176,128,80,40].filter(function(value){return value>=minimum;});
    if (!values.length || values[values.length-1]!==minimum) values.push(minimum);
    return values.filter(function(value,index,list){return list.indexOf(value)===index;});
  }
  async function encodeWithBudget(source, width, height, options) {
    var candidates=qualityCandidates(options.minimumQualityScore), chosen=null, smallest=null;
    for(var index=0;index<candidates.length;index+=1){
      chosen=source.kind==='png'
        ? await KTX2.encodePng(source.bytes,{colourSpace:options.colourSpace,transparency:options.transparency,tileable:options.tileable,maxMipLevels:options.maxMipLevels,quality:candidates[index],effort:3})
        : await KTX2.encodeRgba(width,height,source.bytes,{colourSpace:options.colourSpace,transparency:options.transparency,tileable:options.tileable,maxMipLevels:options.maxMipLevels,quality:candidates[index],effort:3});
      if(!smallest||chosen.byteLength<smallest.byteLength)smallest=chosen;
      if(options.maxFileBytes==null||chosen.byteLength<=options.maxFileBytes)return chosen;
    }
    return smallest||chosen;
  }
  function sourceFor(context) {
    var source=context.sourceArtifacts[0];
    if(!source)throw new Error(context.operationMode+' requires a source artifact');
    return source;
  }

  var descriptor = {
    schema:Core.HAND_SCHEMA,contract_version:'2.0',id:'ktx2-texture-delivery',title:'KTX2 / Basis Texture Delivery Hand',version:'1.0.0',category:'texture-delivery',lifecycle_status:'beta',
    summary:'Creates and finishes genuine ETC1S/BasisLZ KTX2 textures against the declared game or material canvas, with mip, GPU-memory, decoder and provenance receipts.',
    purpose:'Deliver compact GPU-transcodable textures without treating KTX2 as an SVG or relabelled raster file.',
    operation_modes:['create','edit','finish','validate'],canvas_models:['raster-frame','procedural-graph','viewport-3d'],entry_surfaces:['command','texture-editor','export-recipe'],mutability:'transform',
    kinds:['texture','tile','background','sprite','effect','decal','material'],
    accepts:[Core.BRIEF_SCHEMA,'image/png','image/ktx2',RECIPE_SCHEMA],
    produces:[Core.RESULT_SCHEMA,'image/ktx2','image/png','application/json',RECIPE_SCHEMA,REPORT_SCHEMA],
    input_types:[
      {mime:'image/png',format:'PNG',schema:'',roles:['source'],required_for:['finish'],mutable:false,max_bytes:4000000},
      {mime:'image/ktx2',format:'KTX2',schema:'',roles:['source'],required_for:['edit','validate'],mutable:false,max_bytes:4000000}
    ],
    output_types:[
      {mime:'image/ktx2',format:'KTX2',schema:'',role:'gpu-texture-delivery',editable:false,deterministic:true,lossy:true,known_losses:['ETC1S is lossy and is transcoded by the target GPU runtime']},
      {mime:'image/png',format:'PNG',schema:'',role:'decoded-texture-preview',editable:false,deterministic:true,lossy:false,known_losses:[]},
      {mime:'application/json',format:'JSON',schema:RECIPE_SCHEMA,role:'editable-texture-recipe',editable:true,deterministic:true,lossy:false,known_losses:[]},
      {mime:'application/json',format:'JSON',schema:REPORT_SCHEMA,role:'texture-validation-report',editable:false,deterministic:true,lossy:false,known_losses:[]}
    ],
    canvas_types:[
      {medium:'game-world',units:['px'],colour_spaces:['srgb','linear-srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static','tileable'],intended_uses:['texture','ground-tile','tile','background','sprite','effect','decal','material']},
      {medium:'3d-surface',units:['px'],colour_spaces:['srgb','linear-srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static','tileable'],intended_uses:['texture','tile','decal','material']}
    ],
    canvas_limits:{min_width:4,min_height:4,max_width:1024,max_height:1024,max_pixels:1048576},
    constraints_honoured:['dimensions','dimensions.unit','colour.space','colour.transparency','physical.repeat','physical.repeat-size','behaviour.static','behaviour.tileable','performance.max-file-bytes','performance.max-texture-memory-bytes','performance.max-mip-levels'],
    editable_recipe_formats:[Core.RECIPE_SCHEMA,RECIPE_SCHEMA],operations:{preview:true,validate:true,edit:true},emits_editable_source:true,supports_edit_operation:true,
    requires:[],editable:true,deterministic:true,required_permissions:{local_file_system:'none',clipboard:false,network_domains:[],device_access:[],plugin_data:false},network_policy:{mode:'none',domains:[],rationale:'The pinned encoder and validator run locally.'},
    host_compatibility:{hosts:['asset-fabric','studio','mirror','spatial','standalone'],minimum_versions:{},dependencies:[{name:'Basis Universal',version:KTX2.BASIS_VERSION,commit:KTX2.BASIS_COMMIT,bundled:true}]},
    engine:{name:'Basis Universal ETC1S KTX2 + AXM dual validator',version:KTX2.BASIS_VERSION,execution:'local-webassembly-single-thread-bounded'},
    safety_tier:'safe-local',authority:'candidate-only',implementation_status:'executable',
    portability:{interchange_formats:['image/ktx2',RECIPE_SCHEMA],known_losses:['ETC1S compression is lossy','GPU target format is selected at runtime'],unsupported_features:['UASTC encoding','HDR textures','cubemaps','texture arrays','3D volume textures','KTX2 video','arbitrary ICC profiles','UV unwrapping or material baking'],fallbacks:[]},
    validation:{checks:['independent KTX2 header/index/range validation','Basis Universal decoder acceptance','RGBA32 level-0 transcode','ETC1S and BasisLZ identity','mip and GPU-memory budgets','colour transfer and alpha intent']},
    evidence:[
      {claim:'Official Basis Universal supports KTX2 ETC1S encoding and transcoding.',source_url:'https://github.com/BinomialLLC/basis_universal',specification_version:'v2_10_final_snapshot',retrieved_at:'2026-07-19'},
      {claim:'KTX2 container structure follows the Khronos KTX 2.0 specification.',source_url:'https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html',specification_version:'KTX 2.0',retrieved_at:'2026-07-19'}
    ],
    tests:['real BasisLZ container','decoder transcode','tamper rejection','mip budget','GPU-memory budget','colour transfer','determinism','non-SVG identity'],
    limits:{encoding:'ETC1S BasisLZ only',dimensions:'4..1024 px',threads:1,network:false}
  };

  async function createAsync(context) {
    var canvas=context.targetCanvas,width=Math.round(canvas.dimensions.width),height=Math.round(canvas.dimensions.height),mode=context.operationMode;
    var tileable=canvas.behaviour.indexOf('tileable')>=0||canvas.physical.repeat.mode!=='none', alphaRequested=canvas.colour.transparency==='required';
    var mipFit=fitMipBudget(width,height,canvas.performance.max_mip_levels,alphaRequested,canvas.performance.max_texture_memory_bytes), sourceKind='procedural-rgba', sourceReceipt={}, periodicProof=true, encoded, validation, preview;

    if(mode==='validate'){
      var validationSource=sourceFor(context), validationBytes=KTX2.bytesFromDataUrl(validationSource.dataUrl,'image/ktx2');
      validation=await KTX2.validate(validationBytes,{includePixels:true});
      encoded={bytes:validationBytes,dataUrl:validationSource.dataUrl,byteLength:validationBytes.length,width:validation.structural.width||width,height:validation.structural.height||height,quality:null,effort:null,mipPlan:{levels:validation.structural.levelCount||0},validation:validation};
      sourceKind='existing-ktx2';sourceReceipt={id:validationSource.id,digest:validationSource.digest};
      preview=validation.pass?previewFromRgba(validation.module.rgba,validation.module.width,validation.module.height,canvas.colour.space):diagnosticPreview();
    }else{
      var source, generated=null;
      if(mode==='create'){
        generated=generatedPixels(context,width,height);source={kind:'rgba',bytes:generated.rgba};sourceReceipt={kind:'procedural-periodic-field',seed:context.seed,period_x:generated.periodX,period_y:generated.periodY,frequency:generated.frequency};periodicProof=generated.repeatExact;
      }else if(mode==='finish'){
        var pngSource=sourceFor(context),pngBytes=KTX2.bytesFromDataUrl(pngSource.dataUrl,'image/png'),pngDimensions=KTX2.dimensionsFromPng(pngBytes),pngInspection=Raster.inspectPng(pngBytes);
        if(pngDimensions.width!==width||pngDimensions.height!==height)throw new Error('PNG finish source dimensions must equal the target canvas; post-generation resizing is refused');
        if(canvas.colour.space==='linear-srgb'&&pngInspection.hasSrgb)throw new Error('linear-sRGB finish requires a colour-managed linear source; an sRGB PNG cannot be relabelled');
        source={kind:'png',bytes:pngBytes};sourceKind='png-source';sourceReceipt={id:pngSource.id,digest:pngSource.digest,png:pngInspection};periodicProof=!tileable||pngSource.metadata&&pngSource.metadata.tileable===true;
      }else{
        var editSource=sourceFor(context),editBytes=KTX2.bytesFromDataUrl(editSource.dataUrl,'image/ktx2'),editValidation=await KTX2.validate(editBytes,{includePixels:true});
        if(!editValidation.pass)throw new Error('KTX2 edit source failed validation: '+editValidation.errors.join(', '));
        if((canvas.colour.space==='srgb')!==editValidation.module.isSrgb)throw new Error('KTX2 edit cannot relabel the source transfer function; request a colour-management hand');
        source={kind:'rgba',bytes:resampleNearest(editValidation.module.rgba,editValidation.module.width,editValidation.module.height,width,height)};sourceKind='decoded-ktx2-source';sourceReceipt={id:editSource.id,digest:editSource.digest,source_width:editValidation.module.width,source_height:editValidation.module.height,resampled:editValidation.module.width!==width||editValidation.module.height!==height};periodicProof=!tileable||editSource.metadata&&editSource.metadata.tileable===true;
      }
      encoded=await encodeWithBudget(source,width,height,{colourSpace:canvas.colour.space,transparency:canvas.colour.transparency,tileable:tileable,maxMipLevels:mipFit.levels,maxFileBytes:canvas.performance.max_file_bytes,minimumQualityScore:context.qualityRequirements.minimum_quality_score});
      validation=await KTX2.validate(encoded.bytes,{includePixels:true});
      preview=previewFromRgba(validation.module.rgba,validation.module.width,validation.module.height,canvas.colour.space);
    }

    var actualWidth=validation.structural.width||encoded.width,actualHeight=validation.structural.height||encoded.height,actualLevels=validation.structural.levelCount||0,hasAlpha=!!(validation.module&&validation.module.hasAlpha),memory=textureMemory(actualWidth,actualHeight,Math.max(1,actualLevels),hasAlpha);
    var checks=[
      {name:'target-canvas-propagated',pass:canvas.schema===Core.TARGET_CANVAS_SCHEMA},
      {name:'ktx2-structural-validator',pass:validation.structural.pass,details:{errors:validation.structural.errors,warnings:validation.structural.warnings}},
      {name:'basis-decoder-and-rgba-transcode',pass:validation.module.pass,details:{errors:validation.module.errors||[],decoded_bytes:validation.module.decodedByteLength||0}},
      {name:'basislz-supercompression',pass:validation.structural.supercompressionScheme===1},
      {name:'etc1s-payload',pass:validation.module.isEtc1s===true&&validation.module.isUastc===false},
      {name:'target-dimensions',pass:actualWidth===width&&actualHeight===height,details:{actual:[actualWidth,actualHeight],target:[width,height]}},
      {name:'colour-transfer',pass:validation.module.pass&&validation.module.isSrgb===(canvas.colour.space==='srgb'),details:{requested:canvas.colour.space,is_srgb:validation.module.isSrgb}},
      {name:'transparency-intent',pass:canvas.colour.transparency==='allowed'||(canvas.colour.transparency==='required'?hasAlpha:!hasAlpha),details:{requested:canvas.colour.transparency,has_alpha:hasAlpha}},
      {name:'mip-level-budget',pass:canvas.performance.max_mip_levels==null||actualLevels<=canvas.performance.max_mip_levels,details:{actual:actualLevels,maximum:canvas.performance.max_mip_levels}},
      {name:'gpu-memory-budget',pass:canvas.performance.max_texture_memory_bytes==null||memory.compressed_bytes<=canvas.performance.max_texture_memory_bytes,details:{actual:memory.compressed_bytes,maximum:canvas.performance.max_texture_memory_bytes,gpu_target:memory.gpu_target}},
      {name:'primary-file-budget',pass:canvas.performance.max_file_bytes==null||encoded.byteLength<=canvas.performance.max_file_bytes,details:{actual:encoded.byteLength,maximum:canvas.performance.max_file_bytes}},
      {name:'tileability-proven',pass:!tileable||periodicProof,details:{source:sourceKind,proof:periodicProof?'procedural or source-declared':'not proven'}}
    ];
    var pass=checks.every(function(check){return check.pass;});
    var recipe={schema:RECIPE_SCHEMA,version:'1.0.0',id:'ktx2-recipe-'+Core.hash([context.seed,sourceReceipt,canvas]),target_canvas:canvas,source:{kind:sourceKind,receipt:sourceReceipt},encoder:{name:'Basis Universal',version:KTX2.BASIS_VERSION,commit:KTX2.BASIS_COMMIT,mode:'ETC1S',supercompression:'BasisLZ',quality:encoded.quality,effort:encoded.effort,single_threaded:true},texture:{width:actualWidth,height:actualHeight,colour_space:canvas.colour.space,has_alpha:hasAlpha,tileable:tileable,mip_levels:actualLevels},budgets:{file_bytes:{actual:encoded.byteLength,maximum:canvas.performance.max_file_bytes},texture_memory:{actual:memory.compressed_bytes,maximum:canvas.performance.max_texture_memory_bytes,gpu_target:memory.gpu_target},mip_levels:{actual:actualLevels,maximum:canvas.performance.max_mip_levels}},provenance:{hand:descriptor.id,hand_version:descriptor.version,seed:context.seed,source_artifact_digests:context.sourceArtifacts.map(function(item){return{id:item.id,digest:item.digest};})}};
    var report={schema:REPORT_SCHEMA,version:'1.0.0',status:pass?'PASS':'HOLD',container:{mime:'image/ktx2',format:'KTX2',bytes:encoded.byteLength,identifier:validation.structural.identifier,supercompression:validation.structural.supercompressionName,width:actualWidth,height:actualHeight,levels:actualLevels},decoder:{engine:'Basis Universal',version:KTX2.BASIS_VERSION,accepted:validation.module.pass,etc1s:validation.module.isEtc1s===true,uastc:validation.module.isUastc===true,rgba_transcode_bytes:validation.module.decodedByteLength||0},constraints:{target_canvas_digest:Core.hash(canvas),colour_space:canvas.colour.space,transparency:canvas.colour.transparency,tileable:tileable,memory:memory},checks:checks};
    return {
      artifacts:[
        {id:'ktx2-texture',role:'gpu-texture-delivery',name:context.brief.title+' KTX2',filename:Core.slug(context.brief.title)+'.ktx2',mime:'image/ktx2',format:'KTX2',width:actualWidth,height:actualHeight,editable:false,dataUrl:encoded.dataUrl,metadata:{containerSchema:'KTX.2.0',byteLength:encoded.byteLength,supercompression:'BasisLZ',encoding:'ETC1S',mipLevels:actualLevels,colourSpace:canvas.colour.space,hasAlpha:hasAlpha,tileable:tileable}},
        {id:'ktx2-preview',role:'decoded-texture-preview',name:context.brief.title+' decoded preview',filename:Core.slug(context.brief.title)+'-preview.png',mime:'image/png',format:'PNG',width:preview.width,height:preview.height,editable:false,dataUrl:preview.dataUrl,metadata:{decodedFrom:'ktx2-texture',diagnostic:!validation.pass}},
        {id:'ktx2-recipe',role:'editable-texture-recipe',name:context.brief.title+' KTX2 recipe',filename:Core.slug(context.brief.title)+'-ktx2-recipe.json',mime:'application/json',format:'JSON',editable:true,text:JSON.stringify(recipe,null,2),metadata:{schema:RECIPE_SCHEMA}},
        {id:'ktx2-validation',role:'texture-validation-report',name:context.brief.title+' KTX2 validation',filename:Core.slug(context.brief.title)+'-ktx2-validation.json',mime:'application/json',format:'JSON',editable:false,text:JSON.stringify(report,null,2),metadata:{schema:REPORT_SCHEMA}}
      ],
      previewArtifactId:'ktx2-preview',recipe:{format:RECIPE_SCHEMA,parameters:{recipe_id:recipe.id,encoder:recipe.encoder,texture:recipe.texture,budgets:recipe.budgets},steps:[{op:'bind-target-canvas-before-generation'},{op:'prepare-or-validate-native-pixel-source'},{op:'fit-mip-chain-to-gpu-memory-budget'},{op:'encode-etc1s-basislz-ktx2'},{op:'independently-validate-container-index-and-ranges'},{op:'decode-and-transcode-level-zero-for-preview'}]},
      validationChecks:checks,qualityScore:encoded.quality==null?1:encoded.quality/255,
      measures:{ktx2Bytes:encoded.byteLength,width:actualWidth,height:actualHeight,mipLevels:actualLevels,gpuTarget:memory.gpu_target,gpuBytes:memory.compressed_bytes,rgbaFallbackBytes:memory.rgba_fallback_bytes,quality:encoded.quality},
      notes:['KTX2 is the native primary artifact; the PNG is a decoder-derived preview, not the source of truth.','Only ETC1S/BasisLZ 2D textures are claimed. UASTC, HDR, arrays, cubemaps and UV baking remain explicit gaps.']
    };
  }

  return {descriptor:descriptor,createAsync:createAsync};
}));
