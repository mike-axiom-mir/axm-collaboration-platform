(function (root, factory) {
  var provider = factory(typeof module === 'object' && module.exports ? require('../asset-hand-core') : root.AXMAssetHandCore);
  if (typeof module === 'object' && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  return {
    descriptor: {
      schema:Core.HAND_SCHEMA,contract_version:'2.0',id: 'surface-pattern', title: 'Surface & Pattern Hand', version: '1.1.0', category: 'creation',lifecycle_status:'beta',
      summary: 'Creates seamless tiles, textures, patterns and lightweight procedural backgrounds.',
      operation_modes:['create'],canvas_models:['vector-document'],entry_surfaces:['command','repeat-editor','export-recipe'],mutability:'generate',
      kinds: ['tile', 'texture', 'pattern', 'background'],
      produces: [Core.RESULT_SCHEMA, 'image/svg+xml'], requires: ['svg'], editable: true, deterministic: true,
      output_types: [{ mime:'image/svg+xml', format:'SVG', schema:'', role:'editable-repeat-source', editable:true, deterministic:true, lossy:false, known_losses:[] }],
      canvas_types: [
        { medium:'game-world', units:['px','game-world-unit'], colour_spaces:['srgb'],transparency_modes:['opaque'], behaviours:['static','tileable'], intended_uses:['ground-tile','tile','texture','background','pattern'] },
        { medium:'screen', units:['px'], colour_spaces:['srgb'],transparency_modes:['opaque'], behaviours:['static','tileable'], intended_uses:['tile','texture','background','pattern'] }
      ],
      canvas_limits:{min_width:.01,min_height:.01,max_width:8192,max_height:8192},
      constraints_honoured: ['dimensions','dimensions.unit','colour.space','colour.transparency','physical.repeat','physical.repeat-size','behaviour.static','behaviour.tileable','performance.max-file-bytes'],
      editable_recipe_formats: [Core.RECIPE_SCHEMA,'axm.repeat-surface-recipe/v1'],
      operations: { preview:true, validate:true, edit:false },emits_editable_source:true,supports_edit_operation:false,
      engine: { name: 'AXM repeat-surface geometry', version: '1.0.0', execution: 'same-thread-bounded' },
      limits: { maxPatternCell: 256, externalResources: false, scripts: false }
    },
    create: function (context) {
      var brief = context.brief, width = brief.canvas.width, height = brief.canvas.height, colours = context.palette,canvas=context.targetCanvas,repeat=canvas.physical.repeat;
      var random = context.random,derived=Math.max(12, Math.min(256, Math.round(Math.min(width, height) / (4 + context.variant % 5)))),cellW=repeat.width||((canvas.dimensions.unit==='px')?derived:canvas.dimensions.width),cellH=repeat.height||((canvas.dimensions.unit==='px')?derived:canvas.dimensions.height),cell=Math.min(cellW,cellH);
      var stroke = Math.max(cell*.01, cell * .055), dot = Math.max(cell*.015, cell * (.08 + random() * .08)),edge=Math.max(stroke*2,cell*.16),seamProof={method:'analytic-boundary-clearance',boundaryFill:colours[0],clearance:edge-stroke,pass:edge>=stroke};
      var cellBody = '<rect width="' + cellW + '" height="' + cellH + '" fill="' + colours[0] + '"/>';
      if (context.variant % 3 === 0) {
        cellBody += '<path d="M' + edge + ' ' + (cellH/2) + ' L' + (cellW/2) + ' ' + edge + ' L' + (cellW-edge) + ' ' + (cellH/2) + ' L' + (cellW/2) + ' ' + (cellH-edge) + ' Z" fill="none" stroke="' + colours[1] + '" stroke-opacity=".42" stroke-width="' + stroke + '"/>';
      } else if (context.variant % 3 === 1) {
        cellBody += '<path d="M' + edge + ' ' + (cellH/2) + ' Q' + (cellW/3) + ' ' + edge + ' ' + (cellW/2) + ' ' + (cellH/2) + ' T' + (cellW-edge) + ' ' + (cellH/2) + ' M' + (cellW/2) + ' ' + edge + ' Q' + (cellW-edge) + ' ' + (cellH/3) + ' ' + (cellW/2) + ' ' + (cellH-edge) + '" fill="none" stroke="' + colours[1] + '" stroke-opacity=".5" stroke-width="' + stroke + '"/>';
      } else {
        cellBody += '<path d="M' + edge + ' ' + edge + ' H' + (cellW-edge) + ' V' + (cellH-edge) + ' H' + edge + ' Z M' + edge + ' ' + edge + ' L' + (cellW-edge) + ' ' + (cellH-edge) + ' M' + (cellW-edge) + ' ' + edge + ' L' + edge + ' ' + (cellH-edge) + '" fill="none" stroke="' + colours[1] + '" stroke-opacity=".32" stroke-width="' + stroke + '"/>';
      }
      cellBody += '<circle cx="' + (cellW / 2) + '" cy="' + (cellH / 2) + '" r="' + dot + '" fill="' + colours[3] + '" fill-opacity=".72"/>';
      var body = '<defs><pattern id="surface" width="' + cellW + '" height="' + cellH + '" patternUnits="userSpaceOnUse">' + cellBody + '</pattern></defs><rect width="100%" height="100%" fill="url(#surface)"/>';
      var svg = Core.svgDocument(brief, body);
      var tileBrief = Core.clone(brief); tileBrief.canvas.width = cellW; tileBrief.canvas.height = cellH;
      var tileSvg = Core.svgDocument(tileBrief, cellBody);
      return {
        artifacts: [
          { id: 'surface-preview', role: 'editable-source', name: brief.title, filename: Core.slug(brief.title) + '.svg', mime: 'image/svg+xml', format: 'SVG', width: width, height: height, editable: true, text: svg, metadata: { seamless: seamProof.pass,seamProof:seamProof, cellWidth: cellW, cellHeight: cellH,unit:canvas.dimensions.unit } },
          { id: 'repeat-cell', role: 'repeat-source', name: brief.title + ' repeat cell', filename: Core.slug(brief.title) + '-tile.svg', mime: 'image/svg+xml', format: 'SVG', width: cellW, height: cellH, editable: true, text: tileSvg, metadata: { seamless: seamProof.pass,seamProof:seamProof, repeat:repeat.mode==='none'?'xy':repeat.mode,unit:canvas.dimensions.unit } }
        ],
        previewArtifactId: 'surface-preview',
        recipe: { format:'axm.repeat-surface-recipe/v1', parameters:{ cellWidth:cellW, cellHeight:cellH,unit:canvas.dimensions.unit, repeatMode:repeat.mode==='none'?'xy':repeat.mode, palette:colours, targetMedium:canvas.medium }, steps:[{ op:'construct-repeat-cell' },{ op:'verify-opposite-edges' },{ op:'fill-target-preview' }] },
        validationChecks: [
          { name:'target-canvas-propagated', pass:context.targetCanvas.schema===Core.TARGET_CANVAS_SCHEMA },
          { name:'tileable-request-honoured', pass:context.targetCanvas.behaviour.indexOf('tileable')<0 || brief.seamless===true },
          { name:'analytic-seam-proof',pass:seamProof.pass,details:seamProof },
          { name:'file-budget-estimate', pass:!context.targetCanvas.performance.max_file_bytes || svg.length+tileSvg.length<=context.targetCanvas.performance.max_file_bytes }
        ],
        measures: { seamless: seamProof.pass,seamProof:seamProof, repeatCell: { width: cellW, height: cellH,unit:canvas.dimensions.unit }, transparent: false },
        notes: ['The repeat cell is preserved separately for downstream texture and tiling systems.']
      };
    }
  };
}));
