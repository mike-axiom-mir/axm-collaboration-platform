(function (root, factory) {
  var provider = factory(typeof module === 'object' && module.exports ? require('../asset-hand-core') : root.AXMAssetHandCore);
  if (typeof module === 'object' && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  return {
    descriptor:{
      schema:Core.HAND_SCHEMA,contract_version:'2.0',id:'physical-mark',title:'Physical Mark Hand',version:'1.1.0',category:'creation',lifecycle_status:'beta',
      summary:'Creates engraving and cutting geometry from material dimensions, tool width, safe stroke and depth constraints.',
      operation_modes:['create'],canvas_models:['cad-parametric','vector-document'],entry_surfaces:['command','tooling-editor','export-recipe'],mutability:'generate',kinds:['logo','symbol','badge','pattern','illustration'],
      produces:[Core.RESULT_SCHEMA,'image/svg+xml','application/dxf','application/json'],
      output_types:[{mime:'image/svg+xml',format:'SVG',schema:'',role:'editable-vector-preview',editable:true,deterministic:true,lossy:false,known_losses:[]},{mime:'application/dxf',format:'DXF',schema:'',role:'machine-vector-source',editable:true,deterministic:true,lossy:false,known_losses:[]},{mime:'application/json',format:'JSON',schema:'axm.physical-tooling-spec/v1',role:'tooling-spec',editable:true,deterministic:true,lossy:false,known_losses:[]}],
      canvas_types:[
        {medium:'wood',units:['mm','m'],colour_spaces:['grayscale'],transparency_modes:['opaque'],behaviours:['static'],material_behaviours:['grain-direction-horizontal','grain-direction-vertical'],intended_uses:['engraving','cutting','logo','symbol','badge','pattern','illustration']},
        {medium:'metal',units:['mm','m'],colour_spaces:['grayscale'],transparency_modes:['opaque'],behaviours:['static'],material_behaviours:[],intended_uses:['engraving','cutting','logo','symbol','badge','pattern','illustration']},
        {medium:'physical-object',units:['mm','m'],colour_spaces:['grayscale'],transparency_modes:['opaque'],behaviours:['static'],material_behaviours:['grain-direction-horizontal','grain-direction-vertical'],intended_uses:['engraving','cutting','logo','symbol','badge','pattern','illustration']}
      ],
      constraints_honoured:['dimensions','dimensions.unit','colour.space','colour.transparency','physical.minimum-stroke','physical.cutting-tool-width','physical.depth','physical.material-behaviour','physical.tolerance','physical.material-thickness','physical.kerf-side','behaviour.static','performance.max-file-bytes'],
      editable_recipe_formats:[Core.RECIPE_SCHEMA,'axm.physical-toolpath-recipe/v1'],operations:{preview:true,validate:true,edit:false},emits_editable_source:true,supports_edit_operation:false,
      requires:['svg','json'],editable:true,deterministic:true,
      engine:{name:'AXM bounded toolpath geometry',version:'1.0.0',execution:'same-thread-bounded'},
      limits:{toolpathSimulation:false,automaticManufacture:false,operatorMaterialTestRequired:true}
    },
    create:function(context){
      var brief=context.brief,canvas=context.targetCanvas,width=canvas.dimensions.width,height=canvas.dimensions.height,unit=canvas.dimensions.unit;
      var tool=canvas.physical.cutting_tool_width==null?(unit==='m'?.001:1):canvas.physical.cutting_tool_width;
      var stroke=Math.max(tool,canvas.physical.minimum_stroke||0,unit==='m'?.0005:.5),depth=canvas.physical.depth==null?0:canvas.physical.depth,tolerance=canvas.physical.tolerance||0,thickness=canvas.physical.material_thickness,kerfSide=canvas.physical.kerf_side,kerfOffset=kerfSide==='inside'?tool/2:kerfSide==='outside'?-tool/2:0;
      var materialSignal=canvas.physical.material_behaviour.join(' ').toLowerCase(),grainHorizontal=/grain[^ ]*-?horizontal/.test(materialSignal),grainVertical=/grain[^ ]*-?vertical/.test(materialSignal);
      var baseMargin=Math.max(stroke*4,Math.min(width,height)*.08)+tolerance,margin=Math.max(stroke,Math.min(Math.min(width,height)*.45,baseMargin+kerfOffset)),cx=width/2,cy=height/2,rawRadius=Math.max(stroke*3,Math.min(width,height)*.28)*((grainHorizontal||grainVertical) ? 0.92 : 1)-kerfOffset,r=Math.max(stroke*2,rawRadius),svgWidth=unit==='m'?(width*1000)+'mm':width+unit,svgHeight=unit==='m'?(height*1000)+'mm':height+unit;
      var path='M'+margin+' '+cy+' L'+cx+' '+margin+' L'+(width-margin)+' '+cy+' L'+cx+' '+(height-margin)+' Z';
      var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" width="'+svgWidth+'" height="'+svgHeight+'" role="img" aria-label="'+Core.escapeXml(brief.title)+' tooling preview"><rect width="100%" height="100%" fill="#f4f1e8"/><path d="'+path+'" fill="none" stroke="#111111" stroke-width="'+stroke+'" stroke-linejoin="round"/><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#111111" stroke-width="'+stroke+'"/></svg>';
      var dxf=['0','SECTION','2','HEADER','9','$INSUNITS','70',unit==='mm'?'4':'6','0','ENDSEC','0','SECTION','2','ENTITIES','0','LWPOLYLINE','8','CUT','90','4','70','1','10',margin,'20',cy,'10',cx,'20',margin,'10',width-margin,'20',cy,'10',cx,'20',height-margin,'0','CIRCLE','8','ENGRAVE','10',cx,'20',cy,'40',r,'0','ENDSEC','0','EOF'].join('\n');
      var spec={schema:'axm.physical-tooling-spec/v1',medium:canvas.medium,dimensions:canvas.dimensions,minimumStroke:{value:stroke,unit:unit},cuttingToolWidth:{value:tool,unit:unit},depth:{value:depth,unit:canvas.physical.unit},tolerance:{value:tolerance,unit:unit},materialThickness:thickness==null?null:{value:thickness,unit:unit},kerf:{side:kerfSide,offset:{value:kerfOffset,unit:unit}},materialBehaviour:canvas.physical.material_behaviour,materialCompensation:{grainHorizontal:grainHorizontal,grainVertical:grainVertical,radialScale:(grainHorizontal||grainVertical) ? 0.92 : 1},operations:['CUT','ENGRAVE'],simulation:'NOT_RUN',automaticManufacture:false};
      return{
        artifacts:[
          {id:'physical-preview',role:'editable-preview',name:brief.title,filename:Core.slug(brief.title)+'-toolpath.svg',mime:'image/svg+xml',format:'SVG',width:brief.canvas.width,height:brief.canvas.height,editable:true,text:svg,metadata:{medium:canvas.medium,toolWidth:tool,depth:depth}},
          {id:'physical-dxf',role:'machine-vector-source',name:brief.title+' DXF',filename:Core.slug(brief.title)+'.dxf',mime:'application/dxf',format:'DXF',editable:true,text:dxf,metadata:{units:unit,layers:['CUT','ENGRAVE']}},
          {id:'physical-spec',role:'tooling-metadata',name:brief.title+' tooling specification',filename:Core.slug(brief.title)+'-tooling.json',mime:'application/json',format:'JSON',editable:true,text:JSON.stringify(spec,null,2),metadata:{schema:spec.schema}}
        ],
        previewArtifactId:'physical-preview',
        recipe:{format:'axm.physical-toolpath-recipe/v1',parameters:{medium:canvas.medium,toolWidth:tool,minimumStroke:stroke,depth:depth,tolerance:tolerance,materialThickness:thickness,kerfSide:kerfSide,kerfOffset:kerfOffset,materialBehaviour:spec.materialBehaviour},steps:[{op:'derive-tolerance-and-kerf-offset'},{op:'offset-design-from-material-edge'},{op:'construct-tool-centre-lines'},{op:'separate-cut-and-engrave-layers'},{op:'require-operator-material-test'}]},
        validationChecks:[{name:'physical-medium',pass:['wood','metal','physical-object'].indexOf(canvas.medium)>=0},{name:'dxf-units-declared',pass:dxf.indexOf('$INSUNITS')>=0},{name:'tool-width-honoured',pass:stroke>=tool},{name:'minimum-stroke-honoured',pass:stroke>=Number(canvas.physical.minimum_stroke||0)},{name:'tolerance-honoured',pass:baseMargin>=tolerance},{name:'material-thickness-honoured',pass:thickness==null||depth<=thickness},{name:'kerf-side-honoured',pass:spec.kerf.side===canvas.physical.kerf_side},{name:'material-behaviour-applied',pass:!canvas.physical.material_behaviour.length||spec.materialCompensation.grainHorizontal||spec.materialCompensation.grainVertical},{name:'toolpath-simulation-disclosed',pass:spec.simulation==='NOT_RUN'}],
        measures:{minimumStroke:spec.minimumStroke,cuttingToolWidth:spec.cuttingToolWidth,depth:spec.depth,tolerance:spec.tolerance,materialThickness:spec.materialThickness,kerf:spec.kerf,toolpathSimulation:false}
      };
    }
  };
}));
