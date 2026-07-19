(function (root, factory) {
  var provider = factory(typeof module === 'object' && module.exports ? require('../asset-hand-core') : root.AXMAssetHandCore);
  if (typeof module === 'object' && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  return {
    descriptor: {
      schema:Core.HAND_SCHEMA, contract_version:'2.0', id: 'layered-composition', title: 'Layered Composition Hand', version: '1.1.0', category: 'creation', lifecycle_status:'beta',
      summary: 'Creates broad layered visual compositions plus a reviewed Studio draw packet when no narrower hand fits.',
      operation_modes:['create'], canvas_models:['vector-document'], entry_surfaces:['command','composition-editor','export-recipe'], mutability:'generate', kinds: ['background', 'illustration', 'poster', 'cover', '*'], wildcard_kind_policy:'fallback',
      produces: [Core.RESULT_SCHEMA, 'image/svg+xml', 'axm.drawpacket/v1', 'application/json'], requires: ['svg', 'json'], editable: true, deterministic: true,
      output_types: [{ mime:'image/svg+xml', format:'SVG', schema:'', role:'editable-source', editable:true, deterministic:true, lossy:false, known_losses:[] },{ mime:'application/json', format:'JSON', schema:'axm.drawpacket/v1', role:'studio-drawpacket', editable:true, deterministic:true, lossy:false, known_losses:[] }],
      canvas_types: [
        { medium:'screen', units:['px'], colour_spaces:['srgb'],transparency_modes:['opaque'], behaviours:['static','responsive'], intended_uses:['*'] },
        { medium:'ui', units:['px'], colour_spaces:['srgb'],transparency_modes:['opaque'], behaviours:['static','responsive'], intended_uses:['*'] }
      ],
      constraints_honoured: ['dimensions','dimensions.unit','colour.space','colour.transparency','behaviour.static','behaviour.responsive','performance.max-file-bytes'],
      editable_recipe_formats: [Core.RECIPE_SCHEMA,'axm.layered-composition-recipe/v1','axm.drawpacket/v1'],
      operations: { preview:true, validate:true, edit:false }, emits_editable_source:true, supports_edit_operation:false,
      engine: { name: 'AXM layered composition geometry', version: '1.0.0', execution: 'same-thread-bounded' },
      limits: { maxDrawCommands: 12, automaticApply: false, externalResources: false }
    },
    create: function (context) {
      var brief = context.brief, width = brief.canvas.width, height = brief.canvas.height, colours = context.palette;
      var scale = Math.min(width, height), title = Core.escapeXml(brief.title.slice(0, 32));
      var body = '<defs><linearGradient id="field" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + colours[0] + '"/><stop offset=".55" stop-color="' + colours[1] + '" stop-opacity=".22"/><stop offset="1" stop-color="' + colours[0] + '"/></linearGradient><radialGradient id="focus"><stop stop-color="' + colours[3] + '" stop-opacity=".78"/><stop offset="1" stop-color="' + colours[1] + '" stop-opacity="0"/></radialGradient></defs>';
      body += '<rect width="100%" height="100%" fill="url(#field)"/>';
      body += '<circle cx="' + (width * .72) + '" cy="' + (height * .38) + '" r="' + (scale * .29) + '" fill="url(#focus)"/>';
      body += '<polygon points="' + (width * .58) + ',' + (height * .68) + ' ' + (width * .78) + ',' + (height * .22) + ' ' + (width * .9) + ',' + (height * .73) + '" fill="none" stroke="' + colours[1] + '" stroke-width="' + Math.max(2, scale * .018) + '"/>';
      body += '<rect x="' + (width * .08) + '" y="' + (height * .12) + '" width="' + (width * .36) + '" height="' + (height * .08) + '" rx="' + Math.max(3, scale * .015) + '" fill="' + colours[3] + '"/>';
      body += '<text x="' + (width * .08) + '" y="' + (height * .42) + '" fill="' + colours[2] + '" font-family="Inter,Segoe UI,sans-serif" font-size="' + Math.max(14, scale * .09) + '" font-weight="800">' + title + '</text>';
      body += '<path d="M' + (width * .08) + ' ' + (height * .52) + ' H' + (width * .45) + ' M' + (width * .08) + ' ' + (height * .59) + ' H' + (width * .34) + '" stroke="' + colours[1] + '" stroke-opacity=".55" stroke-width="' + Math.max(2, scale * .014) + '"/>';
      var svg = Core.svgDocument(brief, body);
      var packet = {
        schema: 'axm.drawpacket/v1', name: brief.title + ' - composition hand', owner: 'asset-hands', identityId: 'asset-hand:layered-composition', canvas:{width:width,height:height,unit:'px'},
        source: { schema: Core.BRIEF_SCHEMA, briefId: brief.id, handId: 'layered-composition', automaticApply: false },
        draw: [
          { op: 'rect', x: 0, y: 0, w: width, h: height, fill: true, color: colours[0] },
          { op: 'gradient', x1: width*.067, y1: height*.067, x2: width*.933, y2: height*.933, color: colours[1] },
          { op: 'newlayer', name: 'Composition focus' },
          { op: 'circle', x: width*.717, y: height*.383, r: scale*.225, fill: true, color: colours[1] },
          { op: 'polygon', x: width*.742, y: height*.5, r: scale*.158, sides: 3, fill: false, color: colours[3], width: Math.max(2,scale*.015) },
          { op: 'newlayer', name: 'Composition type' },
          { op: 'rect', x: width*.08, y: height*.12, w: width*.35, h: height*.07, fill: true, color: colours[3] },
          { op: 'text', x: width*.08, y: height*.397, text: brief.title.slice(0, 24), size: Math.max(14,scale*.057), color: colours[2] },
          { op: 'line', x1: width*.08, y1: height*.5, x2: width*.45, y2: height*.5, width: Math.max(2,scale*.012), color: colours[1] }
        ]
      };
      return {
        artifacts: [
          { id: 'composition-source', role: 'editable-source', name: brief.title, filename: Core.slug(brief.title) + '.svg', mime: 'image/svg+xml', format: 'SVG', width: width, height: height, editable: true, text: svg, metadata: { layers: ['field', 'focus', 'type'] } },
          { id: 'studio-drawpacket', role: 'studio-editable-instructions', name: brief.title + ' Studio packet', filename: Core.slug(brief.title) + '.drawpacket.json', mime: 'application/json', format: 'JSON', width: width, height: height, editable: true, text: JSON.stringify(packet, null, 2), metadata: { schema: packet.schema, automaticApply: false } }
        ],
        previewArtifactId: 'composition-source',
        recipe: { format:'axm.layered-composition-recipe/v1', parameters:{ layers:['field','focus','type'], palette:colours, targetMedium:context.targetCanvas.medium }, steps:[{ op:'build-field-layer' },{ op:'build-focus-layer' },{ op:'build-type-layer' },{ op:'emit-reviewed-drawpacket' }] },
        validationChecks: [{ name:'target-canvas-propagated', pass:context.targetCanvas.schema===Core.TARGET_CANVAS_SCHEMA },{ name:'command-budget', pass:packet.draw.length<=12 }],
        measures: { layerCount: 3, drawCommands: packet.draw.length, studioPacket: true },
        notes: ['The Studio packet remains unapplied until a person explicitly sends it to Studio.']
      };
    }
  };
}));
