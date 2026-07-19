(function (root, factory) {
  var provider = factory(typeof module === 'object' && module.exports ? require('../asset-hand-core') : root.AXMAssetHandCore);
  if (typeof module === 'object' && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  return {
    descriptor:{
      schema:Core.HAND_SCHEMA,contract_version:'2.0',id:'fabric-pattern', title:'Fabric Repeat Hand', version:'1.1.0', category:'creation',lifecycle_status:'beta',
      summary:'Creates production-oriented textile repeats that account for physical repeat size, minimum marks and declared material behaviour.',
      operation_modes:['create'],canvas_models:['vector-document'],entry_surfaces:['command','repeat-editor','export-recipe'],mutability:'generate',kinds:['pattern','texture','tile','background'],
      produces:[Core.RESULT_SCHEMA,'image/svg+xml','application/json'],
      output_types:[{ mime:'image/svg+xml', format:'SVG', schema:'', role:'editable-repeat-cell', editable:true, deterministic:true, lossy:false, known_losses:[] },{ mime:'application/json', format:'JSON', schema:'axm.fabric-production-spec/v1', role:'fabric-production-spec', editable:true, deterministic:true, lossy:false, known_losses:[] }],
      canvas_types:[{ medium:'fabric', units:['mm','m'], colour_spaces:['srgb'],transparency_modes:['opaque'], behaviours:['static','tileable'], material_behaviours:['stretch-on-bias','shrink-after-print'], intended_uses:['clothing-pattern','fabric-pattern','pattern','texture','tile','background'] }],
      constraints_honoured:['dimensions','dimensions.unit','colour.space','colour.transparency','physical.minimum-stroke','physical.repeat','physical.repeat-size','physical.material-behaviour','behaviour.static','behaviour.tileable','performance.max-file-bytes'],
      editable_recipe_formats:[Core.RECIPE_SCHEMA,'axm.fabric-repeat-recipe/v1'], operations:{ preview:true,validate:true,edit:false }, emits_editable_source:true,supports_edit_operation:false,
      requires:['svg','json'], editable:true, deterministic:true,
      engine:{ name:'AXM textile repeat geometry', version:'1.0.0', execution:'same-thread-bounded' },
      limits:{ repeatModes:['x','y','xy'], automaticManufacture:false }
    },
    create:function(context){
      var brief=context.brief,canvas=context.targetCanvas,colours=context.palette,unit=canvas.dimensions.unit;
      var repeat=canvas.physical.repeat,cellW=repeat.width||Math.min(canvas.dimensions.width,unit==='m'?.5:300),cellH=repeat.height||Math.min(canvas.dimensions.height,unit==='m'?.5:300);
      var minStroke=canvas.physical.minimum_stroke==null?(unit==='m'?.001:1):canvas.physical.minimum_stroke;
      var materialSignal=canvas.physical.material_behaviour.join(' ').toLowerCase(),stretchBias=/stretch[^ ]*-?on[^ ]*-?bias|bias[^ ]*stretch/.test(materialSignal),shrink=/shrink/.test(materialSignal),compensation={x:shrink ? 1.04 : (stretchBias ? 0.96 : 1),y:shrink ? 1.04 : (stretchBias ? 1.04 : 1)};
      var radius=Math.max(minStroke*3,Math.min(cellW,cellH)*.11)*Math.min(compensation.x,compensation.y),line=Math.max(minStroke,Math.min(cellW,cellH)*.012),edgeMargin=Math.max(line*3,Math.min(cellW,cellH)*.18),boundaryClearance=Math.min(edgeMargin-Math.abs(compensation.x-1)*cellW/2,edgeMargin-Math.abs(compensation.y-1)*cellH/2)-line,svgWidth=unit==='m'?(cellW*1000)+'mm':cellW+unit,svgHeight=unit==='m'?(cellH*1000)+'mm':cellH+unit;
      var motif='<rect width="'+cellW+'" height="'+cellH+'" fill="'+colours[0]+'"/><path d="M'+edgeMargin+' '+(cellH/2)+' L'+(cellW/2)+' '+edgeMargin+' L'+(cellW-edgeMargin)+' '+(cellH/2)+' L'+(cellW/2)+' '+(cellH-edgeMargin)+' Z" fill="none" stroke="'+colours[1]+'" stroke-width="'+line+'" stroke-opacity=".55"/><circle cx="'+(cellW/2)+'" cy="'+(cellH/2)+'" r="'+radius+'" fill="'+colours[3]+'"/><circle cx="'+(cellW/2)+'" cy="'+(cellH/2)+'" r="'+(radius*.45)+'" fill="'+colours[2]+'"/>';
      var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+cellW+' '+cellH+'" width="'+svgWidth+'" height="'+svgHeight+'" role="img" aria-label="'+Core.escapeXml(brief.title)+' repeat cell"><g transform="translate('+(cellW/2)+' '+(cellH/2)+') scale('+compensation.x+' '+compensation.y+') translate('+(-cellW/2)+' '+(-cellH/2)+')">'+motif+'</g></svg>';
      var seamProof={method:'analytic-boundary-clearance',periodicAxes:repeat.mode==='none'?['x','y']:repeat.mode==='xy'?['x','y']:[repeat.mode],boundaryFill:colours[0],clearance:{value:boundaryClearance,unit:unit},pass:boundaryClearance>=0};
      var spec={ schema:'axm.fabric-production-spec/v1', repeat:{ mode:repeat.mode==='none'?'xy':repeat.mode,width:cellW,height:cellH,unit:unit }, minimumStroke:{ value:minStroke,unit:unit }, materialBehaviour:canvas.physical.material_behaviour, materialCompensation:compensation,seamProof:seamProof, colourSpace:canvas.colour.space, printableColours:canvas.colour.printable_colours, notes:['Test colour and distortion on the actual fabric before manufacture.'] };
      return{
        artifacts:[
          { id:'fabric-repeat-source',role:'editable-repeat-source',name:brief.title,filename:Core.slug(brief.title)+'-fabric-repeat.svg',mime:'image/svg+xml',format:'SVG',width:brief.canvas.width,height:brief.canvas.height,editable:true,text:svg,metadata:{ repeat:spec.repeat,materialBehaviour:spec.materialBehaviour } },
          { id:'fabric-spec',role:'production-metadata',name:brief.title+' fabric specification',filename:Core.slug(brief.title)+'-fabric.json',mime:'application/json',format:'JSON',editable:true,text:JSON.stringify(spec,null,2),metadata:{schema:spec.schema} }
        ],
        previewArtifactId:'fabric-repeat-source',
        recipe:{ format:'axm.fabric-repeat-recipe/v1',parameters:{ repeat:spec.repeat,minimumStroke:minStroke,materialBehaviour:spec.materialBehaviour,palette:colours },steps:[{op:'construct-boundary-safe-motif'},{op:'mirror-edge-continuity'},{op:'apply-material-behaviour-notes'},{op:'validate-repeat-cell'}] },
        validationChecks:[{name:'fabric-canvas',pass:canvas.medium==='fabric'},{name:'repeat-request-honoured',pass:repeat.mode==='none'||spec.repeat.mode===repeat.mode},{name:'minimum-stroke-honoured',pass:line>=Number(canvas.physical.minimum_stroke||0)},{name:'material-behaviour-applied',pass:!canvas.physical.material_behaviour.length||stretchBias||shrink},{name:'analytic-seam-proof',pass:seamProof.pass,details:seamProof},{name:'file-budget',pass:canvas.performance.max_file_bytes==null||svg.length+JSON.stringify(spec).length<=canvas.performance.max_file_bytes}],
        measures:{ seamless:seamProof.pass,seamProof:seamProof,repeatCell:spec.repeat,minimumStroke:spec.minimumStroke,materialBehaviour:spec.materialBehaviour }
      };
    }
  };
}));
