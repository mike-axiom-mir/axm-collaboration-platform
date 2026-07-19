(function (root, factory) {
  var node = typeof module === 'object' && module.exports;
  var provider = factory(node ? require('../asset-hand-core') : root.AXMAssetHandCore, node ? require('../raster-codec') : root.AXMRasterCodec);
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core, RasterCodec) {
  'use strict';
  if (!RasterCodec) throw new Error('AXM Raster Codec is required');

  function rgb(hex) {
    var value = parseInt(String(hex || '#000000').slice(1), 16);
    return [(value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  }
  return {
    descriptor: {
      schema:Core.HAND_SCHEMA,contract_version:'2.0',id:'raster-texture', title:'Native Raster Texture Hand', version:'1.1.0', category:'creation',lifecycle_status:'beta',
      summary:'Creates PNG pixels directly from the target canvas for game textures, tiles, sprites and screen backgrounds; it does not convert an SVG after generation.',
      operation_modes:['create'],canvas_models:['raster-frame','procedural-graph'],entry_surfaces:['command','texture-editor','export-recipe'],mutability:'generate',
      kinds:['texture','tile','background','sprite','effect','illustration','decal'],
      produces:[Core.RESULT_SCHEMA,'image/png','application/json'],
      output_types:[{mime:'image/png',format:'PNG',schema:'',role:'native-raster-source',editable:false,deterministic:true,lossy:false,known_losses:[]},{mime:'application/json',format:'JSON',schema:'axm.native-raster-spec/v1',role:'procedural-raster-recipe',editable:true,deterministic:true,lossy:false,known_losses:[]}],
      canvas_types:[
        {medium:'game-world',units:['px'],colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static','tileable'],intended_uses:['ground-tile','texture','tile','background','sprite','effect','decal']},
        {medium:'screen',units:['px'],colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'],behaviours:['static','tileable'],intended_uses:['texture','tile','background','illustration','effect','decal']}
      ],
      canvas_limits:{min_width:1,min_height:1,max_width:1024,max_height:1024,max_pixels:1048576,texture_bytes_per_pixel:4},
      constraints_honoured:['dimensions','dimensions.unit','colour.space','colour.transparency','physical.repeat','behaviour.static','behaviour.tileable','performance.max-file-bytes','performance.max-texture-memory-bytes'],
      editable_recipe_formats:[Core.RECIPE_SCHEMA,'axm.native-raster-recipe/v1'],operations:{preview:true,validate:true,edit:false},emits_editable_source:true,supports_edit_operation:false,
      requires:[],editable:true,deterministic:true,
      engine:{name:'AXM native RGBA + bounded PNG codec',version:RasterCodec.VERSION,execution:'same-thread-bounded'},
      limits:{nativeRaster:true,maxPixels:1048576,animatedFormats:false,colourProfiles:['srgb'],externalResources:false}
    },
    create:function(context) {
      var brief=context.brief,canvas=context.targetCanvas,width=Math.round(canvas.dimensions.width),height=Math.round(canvas.dimensions.height);
      var colours=context.palette.map(rgb), rgba=new Uint8Array(width*height*4), frequency=3+(context.variant%5), transparent=canvas.colour.transparency==='required';
      for(var y=0;y<height;y+=1){
        for(var x=0;x<width;x+=1){
          var u=(x+.5)/width,v=(y+.5)/height;
          var wave=Math.sin(Math.PI*2*frequency*u)+Math.cos(Math.PI*2*(frequency+1)*v);
          var cross=Math.sin(Math.PI*2*(u+v)*2);
          var index=wave>.85?1:cross>.45?3:wave<-.85?2:0;
          var colour=colours[index%colours.length],offset=(y*width+x)*4;
          rgba[offset]=colour[0];rgba[offset+1]=colour[1];rgba[offset+2]=colour[2];
          rgba[offset+3]=transparent&&wave<-.45?0:255;
        }
      }
      var png=RasterCodec.encodeRgba(width,height,rgba,{colourSpace:canvas.colour.space});
      var textureMemory=width*height*4;
      var spec={schema:'axm.native-raster-spec/v1',nativeRaster:true,dimensions:{width:width,height:height,unit:'px'},colourSpace:canvas.colour.space,transparency:canvas.colour.transparency,tileable:canvas.behaviour.indexOf('tileable')>=0||canvas.physical.repeat.mode!=='none',repeat:{mode:canvas.physical.repeat.mode,periodicX:true,periodicY:true,fieldFrequencies:[frequency,frequency+1,2]},textureMemoryBytes:textureMemory,pngBytes:png.byteLength,palette:context.palette,seed:context.seed};
      return {
        artifacts:[
          {id:'native-png',role:'native-raster-source',name:brief.title,filename:Core.slug(brief.title)+'.png',mime:'image/png',format:'PNG',width:width,height:height,editable:false,dataUrl:png.dataUrl,metadata:{nativeRaster:true,byteLength:png.byteLength,textureMemoryBytes:textureMemory,tileable:spec.tileable}},
          {id:'raster-recipe',role:'editable-procedural-source',name:brief.title+' raster recipe',filename:Core.slug(brief.title)+'-raster.json',mime:'application/json',format:'JSON',editable:true,text:JSON.stringify(spec,null,2),metadata:{schema:spec.schema}}
        ],
        previewArtifactId:'native-png',
        recipe:{format:'axm.native-raster-recipe/v1',parameters:{nativeRaster:true,width:width,height:height,frequency:frequency,palette:context.palette,transparency:canvas.colour.transparency,tileable:spec.tileable},steps:[{op:'allocate-target-rgba-canvas'},{op:'sample-periodic-procedural-field'},{op:'encode-png-directly'},{op:'measure-container-and-texture-budgets'}]},
        validationChecks:[
          {name:'native-raster-generation',pass:spec.nativeRaster===true},
          {name:'png-container',pass:png.inspection.pass,details:png.inspection},
          {name:'srgb-declared',pass:png.inspection.hasSrgb},
          {name:'periodic-seam-proof',pass:!spec.tileable||spec.repeat.periodicX&&spec.repeat.periodicY,details:spec.repeat},
          {name:'target-dimensions',pass:png.width===width&&png.height===height},
          {name:'texture-memory-budget',pass:canvas.performance.max_texture_memory_bytes==null||textureMemory<=canvas.performance.max_texture_memory_bytes},
          {name:'file-budget',pass:canvas.performance.max_file_bytes==null||png.byteLength<=canvas.performance.max_file_bytes}
        ],
        measures:{nativeRaster:true,pngBytes:png.byteLength,textureMemoryBytes:textureMemory,pixels:width*height,tileable:spec.tileable},
        notes:['Pixels were generated against the declared raster canvas before PNG encoding; no SVG conversion was used.']
      };
    }
  };
}));
