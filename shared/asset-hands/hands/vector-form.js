(function (root, factory) {
  var provider = factory(typeof module === 'object' && module.exports ? require('../asset-hand-core') : root.AXMAssetHandCore);
  if (typeof module === 'object' && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  return {
    descriptor: {
      schema:Core.HAND_SCHEMA,contract_version:'2.0',id: 'vector-form', title: 'Vector Form Hand', version: '1.1.0', category: 'creation',lifecycle_status:'beta',
      summary: 'Creates scalable icons, symbols, logos, badges and effects as editable local SVG geometry.',
      operation_modes:['create'],canvas_models:['vector-document'],entry_surfaces:['command','vector-editor','export-recipe'],mutability:'generate',
      kinds: ['icon', 'symbol', 'logo', 'badge', 'effect'],
      produces: [Core.RESULT_SCHEMA, 'image/svg+xml'], requires: ['svg'], editable: true, deterministic: true,
      output_types: [{ mime:'image/svg+xml', format:'SVG', schema:'', role:'editable-source', editable:true, deterministic:true, lossy:false, known_losses:[] }],
      canvas_types: [
        { medium:'screen', units:['px'], colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'], behaviours:['static','responsive'], intended_uses:['icon','symbol','logo','badge','effect'] },
        { medium:'ui', units:['px'], colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'], behaviours:['static','responsive'], intended_uses:['icon','symbol','logo','badge','effect'] },
        { medium:'game-world', units:['px','game-world-unit'], colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'], behaviours:['static'], intended_uses:['icon','symbol','logo','badge','effect'] }
      ],
      canvas_limits:{min_width:.01,min_height:.01,max_width:8192,max_height:8192},
      constraints_honoured: ['dimensions','dimensions.unit','colour.space','colour.transparency','colour.contrast','behaviour.static','behaviour.responsive','performance.max-file-bytes'],
      editable_recipe_formats: [Core.RECIPE_SCHEMA,'axm.vector-geometry-recipe/v1'],
      operations: { preview:true, validate:true, edit:false },emits_editable_source:true,supports_edit_operation:false,
      engine: { name: 'AXM vector geometry', version: '1.0.0', execution: 'same-thread-bounded' },
      limits: { maxSvgBytes: 600000, externalResources: false, scripts: false }
    },
    create: function (context) {
      var brief = context.brief, width = brief.canvas.width, height = brief.canvas.height, cx = width / 2, cy = height / 2;
      var scale = Math.min(width, height), colours = context.palette.slice(), random = context.random, variant = context.variant;
      var contrast=Core.accessiblePair(colours[0],colours[2],context.targetCanvas.colour.minimum_contrast_ratio||4.5);colours[0]=contrast.background;colours[2]=contrast.foreground;
      var sides = 4 + ((variant + Math.floor(random() * 4)) % 5), points = [];
      for (var index = 0; index < sides; index += 1) {
        var angle = -Math.PI / 2 + index * Math.PI * 2 / sides;
        var radius = scale * (index % 2 && brief.kind === 'badge' ? 0.31 : 0.39);
        points.push((cx + Math.cos(angle) * radius).toFixed(1) + ',' + (cy + Math.sin(angle) * radius).toFixed(1));
      }
      var stroke = Math.max(2, scale * 0.028), body = brief.transparent?'':'<rect width="100%" height="100%" fill="'+colours[0]+'"/>';
      body += '<defs><linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + colours[1] + '"/><stop offset="1" stop-color="' + colours[3] + '"/></linearGradient></defs>';
      body += '<polygon points="' + points.join(' ') + '" fill="' + colours[0] + '" fill-opacity=".94" stroke="url(#edge)" stroke-width="' + stroke.toFixed(1) + '" stroke-linejoin="round"/>';
      if (brief.kind === 'logo' || brief.kind === 'symbol') {
        body += '<path d="M' + (cx - scale * .18) + ' ' + (cy + scale * .14) + ' L' + cx + ' ' + (cy - scale * .2) + ' L' + (cx + scale * .18) + ' ' + (cy + scale * .14) + ' M' + (cx - scale * .1) + ' ' + cy + ' H' + (cx + scale * .1) + '" fill="none" stroke="' + colours[2] + '" stroke-width="' + (stroke * 1.5).toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"/>';
      } else if (brief.kind === 'effect') {
        body += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (scale * .19).toFixed(1) + '" fill="none" stroke="' + colours[3] + '" stroke-width="' + (stroke * 1.35).toFixed(1) + '" stroke-dasharray="' + (stroke * 2).toFixed(1) + ' ' + (stroke * 1.4).toFixed(1) + '"/>';
      } else {
        body += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (scale * .18).toFixed(1) + '" fill="none" stroke="' + colours[3] + '" stroke-width="' + (stroke * 1.25).toFixed(1) + '"/>';
        body += '<path d="M' + cx + ' ' + (cy - scale * .13) + ' V' + (cy + scale * .13) + ' M' + (cx - scale * .13) + ' ' + cy + ' H' + (cx + scale * .13) + '" stroke="' + colours[2] + '" stroke-width="' + (stroke * 1.45).toFixed(1) + '" stroke-linecap="round"/>';
      }
      var svg = Core.svgDocument(brief, body);
      return {
        artifacts: [{ id: 'vector-source', role: 'editable-source', name: brief.title, filename: Core.slug(brief.title) + '.svg', mime: 'image/svg+xml', format: 'SVG', width: width, height: height, editable: true, text: svg, metadata: { vectorPrimitives: true, scalable: true } }],
        previewArtifactId: 'vector-source',
        recipe: { format:'axm.vector-geometry-recipe/v1', parameters:{ sides:sides, stroke:stroke, palette:colours, targetMedium:context.targetCanvas.medium }, steps:[{ op:'construct-silhouette' },{ op:'apply-readable-inner-mark' },{ op:'validate-target-scale' }] },
        validationChecks: [{ name:'target-canvas-propagated', pass:context.targetCanvas.schema===Core.TARGET_CANVAS_SCHEMA },{name:'essential-mark-contrast',pass:context.targetCanvas.colour.minimum_contrast_ratio==null||contrast.ratio>=context.targetCanvas.colour.minimum_contrast_ratio,details:contrast},{ name:'file-budget-estimate', pass:!context.targetCanvas.performance.max_file_bytes || svg.length<=context.targetCanvas.performance.max_file_bytes }],
        measures: { scalable: true, transparent: brief.transparent, silhouetteComplexity: sides,contrastRatio:contrast.ratio },
        notes: ['Editable SVG source; no external resources or executable content.']
      };
    }
  };
}));
