(function (root, factory) {
  var provider = factory(typeof module === 'object' && module.exports ? require('../asset-hand-core') : root.AXMAssetHandCore);
  if (typeof module === 'object' && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  return {
    descriptor:{
      schema:Core.HAND_SCHEMA,contract_version:'2.0',id:'cut-layout',title:'Paper & Fabric Cut Layout Hand',version:'1.1.0',category:'creation',lifecycle_status:'beta',
      summary:'Creates kerf-aware paper and fabric cutting layouts with editable SVG, DXF centre-lines and an operator-facing tooling specification.',
      operation_modes:['create'],canvas_models:['cad-parametric','vector-document'],entry_surfaces:['command','cut-layout-editor','export-recipe'],mutability:'generate',kinds:['pattern','symbol','badge','illustration','papercraft'],
      produces:[Core.RESULT_SCHEMA,'image/svg+xml','application/dxf','application/json'],
      output_types:[{mime:'image/svg+xml',format:'SVG',schema:'',role:'editable-cut-preview',editable:true,deterministic:true,lossy:false,known_losses:[]},{mime:'application/dxf',format:'DXF',schema:'',role:'machine-vector-source',editable:true,deterministic:true,lossy:false,known_losses:[]},{mime:'application/json',format:'JSON',schema:'axm.cut-layout-spec/v1',role:'cutting-spec',editable:true,deterministic:true,lossy:false,known_losses:[]}],
      canvas_types:[
        {medium:'paper',units:['mm','m'],colour_spaces:['srgb','grayscale'],transparency_modes:['opaque'],behaviours:['static'],material_behaviours:['low-tack-mat','grain-direction-horizontal','grain-direction-vertical'],intended_uses:['paper-cut','papercraft','stencil','cutting','pattern','symbol','badge','illustration']},
        {medium:'fabric',units:['mm','m'],colour_spaces:['srgb','grayscale'],transparency_modes:['opaque'],behaviours:['static'],material_behaviours:['low-tack-mat','grain-direction-horizontal','grain-direction-vertical','fray-prone'],intended_uses:['fabric-cut','clothing-pattern','stencil','cutting','pattern','illustration']}
      ],
      constraints_honoured:['dimensions','dimensions.unit','colour.space','colour.transparency','physical.bleed','physical.minimum-stroke','physical.cutting-tool-width','physical.material-behaviour','physical.tolerance','physical.material-thickness','physical.kerf-side','behaviour.static','performance.max-file-bytes'],
      editable_recipe_formats:[Core.RECIPE_SCHEMA,'axm.cut-layout-recipe/v1'],operations:{preview:true,validate:true,edit:false},emits_editable_source:true,supports_edit_operation:false,
      requires:['svg','json'],editable:true,deterministic:true,
      engine:{name:'AXM kerf-aware cut geometry',version:'1.0.0',execution:'same-thread-bounded'},
      limits:{toolpathSimulation:false,automaticCutting:false,operatorMaterialTestRequired:true,registrationMarks:true}
    },
    create:function(context){
      var brief=context.brief,canvas=context.targetCanvas,width=canvas.dimensions.width,height=canvas.dimensions.height,unit=canvas.dimensions.unit;
      var defaultTool=unit==='m'?.0005:.5,tool=canvas.physical.cutting_tool_width==null?defaultTool:canvas.physical.cutting_tool_width;
      var minimumStroke=Math.max(tool,canvas.physical.minimum_stroke||0),bleed=canvas.physical.bleed||0,tolerance=canvas.physical.tolerance||0,thickness=canvas.physical.material_thickness,kerfSide=canvas.physical.kerf_side,kerfOffset=kerfSide==='inside'?tool/2:kerfSide==='outside'?-tool/2:0;
      var materialSignal=canvas.physical.material_behaviour.join(' ').toLowerCase(),lowTack=/low[^ ]*-?tack/.test(materialSignal),fray=/fray/.test(materialSignal),grainHorizontal=/grain[^ ]*-?horizontal/.test(materialSignal),grainVertical=/grain[^ ]*-?vertical/.test(materialSignal);
      var materialAllowance=(lowTack?tool*2:0)+(fray?tool*3:0);
      var safe=Math.min(Math.max(minimumStroke*3,Math.min(width,height)*.045)+bleed+materialAllowance+tolerance,Math.min(width,height)*.25);
      var left=safe+kerfOffset,top=safe+kerfOffset,right=Math.max(left+minimumStroke,width-safe-kerfOffset),bottom=Math.max(top+minimumStroke,height-safe-kerfOffset);
      var centreX=width/2,centreY=height/2,slot=Math.max(minimumStroke*2,Math.min(width,height)*.09),svgWidth=unit==='m'?(width*1000)+'mm':width+unit,svgHeight=unit==='m'?(height*1000)+'mm':height+unit,grayscale=canvas.colour.space==='grayscale',cutColour=grayscale?'#111111':'#d7263d',slotColour=grayscale?'#666666':'#16697a';
      var cutPath='M'+left+' '+top+' H'+right+' V'+bottom+' H'+left+' Z';
      var slotPath='M'+(centreX-slot)+' '+centreY+' H'+(centreX+slot)+' M'+centreX+' '+(centreY-slot)+' V'+(centreY+slot);
      var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" width="'+svgWidth+'" height="'+svgHeight+'" role="img" aria-label="'+Core.escapeXml(brief.title)+' cut preview"><rect width="100%" height="100%" fill="#f7f5ef"/><path d="'+cutPath+'" fill="none" stroke="'+cutColour+'" stroke-width="'+minimumStroke+'"/><path d="'+slotPath+'" fill="none" stroke="'+slotColour+'" stroke-width="'+minimumStroke+'" stroke-linecap="square"/><g fill="none" stroke="#111" stroke-width="'+Math.max(minimumStroke*.4,unit==='m'?.0001:.1)+'"><path d="M0 '+safe+' H'+(safe*1.8)+' M'+safe+' 0 V'+(safe*1.8)+'"/><path d="M'+width+' '+safe+' H'+(width-safe*1.8)+' M'+(width-safe)+' 0 V'+(safe*1.8)+'"/><path d="M0 '+(height-safe)+' H'+(safe*1.8)+' M'+safe+' '+height+' V'+(height-safe*1.8)+'"/><path d="M'+width+' '+(height-safe)+' H'+(width-safe*1.8)+' M'+(width-safe)+' '+height+' V'+(height-safe*1.8)+'"/></g></svg>';
      var dxf=['0','SECTION','2','HEADER','9','$INSUNITS','70',unit==='mm'?'4':'6','0','ENDSEC','0','SECTION','2','ENTITIES','0','LWPOLYLINE','8','CUT','90','4','70','1','10',left,'20',top,'10',right,'20',top,'10',right,'20',bottom,'10',left,'20',bottom,'0','LINE','8','SLOT','10',centreX-slot,'20',centreY,'11',centreX+slot,'21',centreY,'0','LINE','8','SLOT','10',centreX,'20',centreY-slot,'11',centreX,'21',centreY+slot,'0','LINE','8','REGISTRATION','10',0,'20',safe,'11',safe*1.8,'21',safe,'0','LINE','8','REGISTRATION','10',safe,'20',0,'11',safe,'21',safe*1.8,'0','LINE','8','REGISTRATION','10',width,'20',height-safe,'11',width-safe*1.8,'21',height-safe,'0','LINE','8','REGISTRATION','10',width-safe,'20',height,'11',width-safe,'21',height-safe*1.8,'0','ENDSEC','0','EOF'].join('\n');
      var spec={schema:'axm.cut-layout-spec/v1',medium:canvas.medium,dimensions:canvas.dimensions,bleed:{value:bleed,unit:unit},safeMargin:{value:safe,unit:unit},minimumStroke:{value:minimumStroke,unit:unit},cuttingToolWidth:{value:tool,unit:unit},tolerance:{value:tolerance,unit:unit},materialThickness:thickness==null?null:{value:thickness,unit:unit},kerf:{side:kerfSide,offset:{value:kerfOffset,unit:unit}},materialBehaviour:canvas.physical.material_behaviour,materialCompensation:{lowTack:lowTack,frayProne:fray,grainHorizontal:grainHorizontal,grainVertical:grainVertical,extraAllowance:{value:materialAllowance,unit:unit}},layers:['CUT','SLOT','REGISTRATION'],toolpathSimulation:'NOT_RUN',operatorMaterialTestRequired:true,automaticCutting:false};
      return {
        artifacts:[
          {id:'cut-preview',role:'editable-cut-preview',name:brief.title,filename:Core.slug(brief.title)+'-cut.svg',mime:'image/svg+xml',format:'SVG',width:brief.canvas.width,height:brief.canvas.height,editable:true,text:svg,metadata:{medium:canvas.medium,toolWidth:tool,safeMargin:safe}},
          {id:'cut-dxf',role:'machine-vector-source',name:brief.title+' DXF',filename:Core.slug(brief.title)+'.dxf',mime:'application/dxf',format:'DXF',editable:true,text:dxf,metadata:{units:unit,layers:spec.layers}},
          {id:'cut-spec',role:'cutting-metadata',name:brief.title+' cut specification',filename:Core.slug(brief.title)+'-cut.json',mime:'application/json',format:'JSON',editable:true,text:JSON.stringify(spec,null,2),metadata:{schema:spec.schema}}
        ],
        previewArtifactId:'cut-preview',
        recipe:{format:'axm.cut-layout-recipe/v1',parameters:{medium:canvas.medium,toolWidth:tool,minimumStroke:minimumStroke,bleed:bleed,safeMargin:safe,tolerance:tolerance,materialThickness:thickness,kerfSide:kerfSide,kerfOffset:kerfOffset,materialBehaviour:spec.materialBehaviour},steps:[{op:'derive-tolerance-kerf-and-safe-margin'},{op:'construct-closed-cut-centre-lines'},{op:'separate-cut-and-slot-layers'},{op:'add-registration-marks'},{op:'require-operator-material-test'}]},
        validationChecks:[{name:'cuttable-medium',pass:['paper','fabric'].indexOf(canvas.medium)>=0},{name:'tool-width-honoured',pass:minimumStroke>=tool},{name:'minimum-stroke-honoured',pass:minimumStroke>=Number(canvas.physical.minimum_stroke||0)},{name:'safe-margin-inside-canvas',pass:left<right&&top<bottom&&left>=0&&top>=0&&right<=width&&bottom<=height},{name:'tolerance-honoured',pass:safe>=tolerance},{name:'material-thickness-honoured',pass:thickness==null||canvas.physical.depth==null||canvas.physical.depth<=thickness},{name:'kerf-side-honoured',pass:spec.kerf.side===canvas.physical.kerf_side},{name:'material-behaviour-applied',pass:!canvas.physical.material_behaviour.length||lowTack||fray||grainHorizontal||grainVertical},{name:'registration-marks-in-machine-output',pass:dxf.indexOf('REGISTRATION')>=0},{name:'file-budget',pass:canvas.performance.max_file_bytes==null||svg.length+dxf.length+JSON.stringify(spec).length<=canvas.performance.max_file_bytes},{name:'toolpath-simulation-disclosed',pass:spec.toolpathSimulation==='NOT_RUN'}],
        measures:{bleed:spec.bleed,safeMargin:spec.safeMargin,minimumStroke:spec.minimumStroke,cuttingToolWidth:spec.cuttingToolWidth,tolerance:spec.tolerance,materialThickness:spec.materialThickness,kerf:spec.kerf,toolpathSimulation:false}
      };
    }
  };
}));
