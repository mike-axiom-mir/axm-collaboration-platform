(function (root, factory) {
  var provider = factory(typeof module === 'object' && module.exports ? require('../asset-hand-core') : root.AXMAssetHandCore);
  if (typeof module === 'object' && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  return {
    descriptor: {
      schema:Core.HAND_SCHEMA,contract_version:'2.0',id:'print-layout', title:'Print Layout Preview Hand', version:'1.1.0', category:'creation',lifecycle_status:'beta',
      summary:'Creates an sRGB bleed-aware layout preview and explicit prepress handoff specification from physical dimensions and minimum-mark constraints.',
      operation_modes:['create'],canvas_models:['page-document','vector-document'],entry_surfaces:['command','layout-editor','export-recipe'],mutability:'generate',
      kinds:['poster','cover','illustration','background','logo'],
      produces:[Core.RESULT_SCHEMA,'image/svg+xml','application/json'],
      output_types:[{ mime:'image/svg+xml', format:'SVG', schema:'', role:'editable-print-preview', editable:true, deterministic:true, lossy:true, known_losses:['sRGB SVG is a layout preview and is not a press-ready colour-separated master'] },{ mime:'application/json', format:'JSON', schema:'axm.print-production-spec/v1', role:'print-production-spec', editable:true, deterministic:true, lossy:false, known_losses:[] }],
      canvas_types:[
        { medium:'print', units:['mm'], colour_spaces:['srgb'],transparency_modes:['opaque'], behaviours:['static'], intended_uses:['poster','cover','illustration','background','logo','print-layout'] },
        { medium:'paper', units:['mm'], colour_spaces:['srgb'],transparency_modes:['opaque'], behaviours:['static'], intended_uses:['poster','cover','illustration','background','logo','paper-cut'] }
      ],
      canvas_limits:{min_width:10,min_height:10,max_width:2000,max_height:2000,max_bleed:50,max_stroke:20},
      constraints_honoured:['dimensions','dimensions.unit','colour.space','colour.transparency','physical.bleed','physical.minimum-stroke','behaviour.static','performance.max-file-bytes'],
      editable_recipe_formats:[Core.RECIPE_SCHEMA,'axm.print-layout-recipe/v1'],
      operations:{ preview:true, validate:true, edit:false },emits_editable_source:true,supports_edit_operation:false,requires:['svg','json'], editable:true, deterministic:true,
      engine:{ name:'AXM physical print geometry', version:'1.0.0', execution:'same-thread-bounded' },
      limits:{ units:['mm'], pdfFinishingRequiredSeparately:true, automaticPrint:false }
    },
    create:function (context) {
      var brief=context.brief, canvas=context.targetCanvas, width=canvas.dimensions.width, height=canvas.dimensions.height;
      var bleed=canvas.physical.bleed==null?3:canvas.physical.bleed, minStroke=Math.max(.05,canvas.physical.minimum_stroke==null?.25:canvas.physical.minimum_stroke);
      var totalW=width+bleed*2,totalH=height+bleed*2, colours=context.palette, safe=Math.max(bleed+4,Math.min(width,height)*.055);
      var title=Core.escapeXml(brief.title.slice(0,42)), body='';
      body+='<rect x="0" y="0" width="'+totalW+'" height="'+totalH+'" fill="'+colours[0]+'"/>';
      body+='<rect x="'+bleed+'" y="'+bleed+'" width="'+width+'" height="'+height+'" fill="none" stroke="'+colours[3]+'" stroke-opacity=".35" stroke-width="'+minStroke+'" stroke-dasharray="2 2"/>';
      body+='<circle cx="'+(totalW*.72)+'" cy="'+(totalH*.36)+'" r="'+(Math.min(width,height)*.24)+'" fill="'+colours[1]+'" fill-opacity=".24"/>';
      body+='<rect x="'+(bleed+safe)+'" y="'+(bleed+safe)+'" width="'+(width*.34)+'" height="'+Math.max(6,height*.045)+'" fill="'+colours[3]+'"/>';
      body+='<text x="'+(bleed+safe)+'" y="'+(bleed+height*.46)+'" font-family="Arial,sans-serif" font-size="'+Math.max(8,Math.min(width,height)*.085)+'" font-weight="700" fill="'+colours[2]+'">'+title+'</text>';
      body+='<path d="M'+(bleed+safe)+' '+(bleed+height*.54)+' H'+(bleed+width*.48)+'" stroke="'+colours[1]+'" stroke-width="'+Math.max(minStroke,minStroke*2)+'"/>';
      var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+totalW+' '+totalH+'" width="'+totalW+'mm" height="'+totalH+'mm" role="img" aria-label="'+Core.escapeXml(brief.title)+'">'+body+'</svg>';
      var spec={ schema:'axm.print-production-spec/v1', trim:{ width:width,height:height,unit:'mm' }, bleed:{ all:bleed,unit:'mm' }, minimumStroke:{ value:minStroke,unit:'mm' }, colour:{ requestedSpace:canvas.colour.space, printableColours:false, previewPalette:colours, separation:'production-system-required-before-press' }, transparency:canvas.colour.transparency, pressReady:false,automaticPrint:false };
      return {
        artifacts:[
          { id:'print-source', role:'editable-source', name:brief.title, filename:Core.slug(brief.title)+'-print.svg', mime:'image/svg+xml', format:'SVG', width:brief.canvas.width, height:brief.canvas.height, editable:true, text:svg, metadata:{ physicalDimensions:spec.trim, bleed:spec.bleed, printable:false,pressReady:false } },
          { id:'print-spec', role:'production-metadata', name:brief.title+' print specification', filename:Core.slug(brief.title)+'-print.json', mime:'application/json', format:'JSON', editable:true, text:JSON.stringify(spec,null,2) }
        ],
        previewArtifactId:'print-source',
        recipe:{ format:'axm.print-layout-recipe/v1', parameters:{ trim:spec.trim, bleed:bleed, minimumStroke:minStroke, colourSpace:canvas.colour.space }, steps:[{ op:'expand-bleed-box' },{ op:'place-safe-area-composition' },{ op:'record-print-colour-intent' },{ op:'validate-minimum-stroke' }] },
        validationChecks:[
          { name:'millimetre-canvas', pass:canvas.dimensions.unit==='mm' },
          { name:'minimum-stroke-honoured', pass:minStroke>=Number(canvas.physical.minimum_stroke||0) },
          { name:'bleed-honoured', pass:bleed>=Number(canvas.physical.bleed||0) },
          { name:'file-budget-estimate', pass:!canvas.performance.max_file_bytes || svg.length+JSON.stringify(spec).length<=canvas.performance.max_file_bytes }
        ],
        measures:{ trim:spec.trim, bleed:spec.bleed, minimumStroke:spec.minimumStroke, colourSpace:canvas.colour.space }
      };
    }
  };
}));
