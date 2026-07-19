(function (root, factory) {
  var provider = factory(typeof module === 'object' && module.exports ? require('../asset-hand-core') : root.AXMAssetHandCore);
  if (typeof module === 'object' && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  return {
    descriptor: {
      schema:Core.HAND_SCHEMA,contract_version:'2.0',id: 'ui-component', title: 'UI Component Hand', version: '1.1.0', category: 'creation',lifecycle_status:'beta',
      summary: 'Creates interface panels, buttons and HUD components with state and nine-slice metadata.',
      operation_modes:['create'],canvas_models:['dom-component','vector-document'],entry_surfaces:['command','component-editor','export-recipe'],mutability:'generate',
      kinds: ['panel', 'ui-component', 'button', 'hud'],
      produces: [Core.RESULT_SCHEMA, 'image/svg+xml', 'application/json'], requires: ['svg', 'json'], editable: true, deterministic: true,
      output_types: [{ mime:'image/svg+xml', format:'SVG', schema:'', role:'editable-source', editable:true, deterministic:true, lossy:false, known_losses:[] },{ mime:'application/json', format:'JSON', schema:'axm.ui-component-spec/v1', role:'runtime-metadata', editable:true, deterministic:true, lossy:false, known_losses:[] }],
      canvas_types: [
        { medium:'ui', units:['px'], colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'], behaviours:['static','interactive','responsive'], intended_uses:['panel','ui-component','button','hud','icon'] },
        { medium:'screen', units:['px'], colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'], behaviours:['static','interactive','responsive'], intended_uses:['panel','ui-component','button','hud'] },
        { medium:'game-world', units:['px'], colour_spaces:['srgb'],transparency_modes:['required','allowed','opaque'], behaviours:['static','interactive','responsive'], intended_uses:['hud','panel','button','ui-component'] }
      ],
      canvas_limits:{min_width:1,min_height:1,max_width:8192,max_height:8192,max_pixels:16777216},
      constraints_honoured: ['dimensions','dimensions.unit','colour.space','colour.transparency','colour.contrast','responsive.direction','responsive.input-modalities','responsive.reduced-motion','responsive.minimum-target-size','accessibility.alternative-text','accessibility.focus-visible','behaviour.static','behaviour.interactive','behaviour.responsive','performance.max-file-bytes'],
      editable_recipe_formats: [Core.RECIPE_SCHEMA,'axm.ui-component-recipe/v1'],
      operations: { preview:true, validate:true, edit:false },emits_editable_source:true,supports_edit_operation:false,
      engine: { name: 'AXM interface component geometry', version: '1.0.0', execution: 'same-thread-bounded' },
      limits: { states: ['default', 'hover', 'active', 'disabled'], externalResources: false }
    },
    create: function (context) {
      var brief = context.brief, width = brief.canvas.width, height = brief.canvas.height, colours = context.palette.slice(),contrast=Core.accessiblePair(colours[0],colours[2],context.targetCanvas.colour.minimum_contrast_ratio||4.5);colours[0]=contrast.background;colours[2]=contrast.foreground;
      var unit = Math.min(width, height), inset = Math.max(4, Math.round(unit * .075)), radius = Math.max(5, Math.round(unit * .08));
      var header = Math.max(12, Math.round(height * .18)), line = Math.max(1, Math.round(unit * .018));
      var body = (brief.transparent?'':'<rect width="100%" height="100%" fill="'+colours[0]+'"/>')+'<defs><linearGradient id="panel" x1="0" y1="0" x2="0" y2="1"><stop stop-color="' + colours[0] + '"/><stop offset="1" stop-color="' + colours[0] + '" stop-opacity=".78"/></linearGradient></defs>';
      body += '<rect x="' + inset + '" y="' + inset + '" width="' + (width - inset * 2) + '" height="' + (height - inset * 2) + '" rx="' + radius + '" fill="url(#panel)" stroke="' + colours[1] + '" stroke-width="' + line + '"/>';
      if (brief.kind === 'button') {
        body += '<rect x="' + (inset * 1.8) + '" y="' + (height * .28) + '" width="' + (width - inset * 3.6) + '" height="' + (height * .44) + '" rx="' + (radius * .7) + '" fill="' + colours[1] + '" fill-opacity=".16" stroke="' + colours[3] + '" stroke-width="' + line + '"/>';
        body += '<path d="M' + (width * .32) + ' ' + (height * .5) + ' H' + (width * .68) + '" stroke="' + colours[2] + '" stroke-width="' + (line * 2) + '" stroke-linecap="round"/>';
      } else {
        body += '<path d="M' + inset + ' ' + (inset + header) + ' H' + (width - inset) + '" stroke="' + colours[1] + '" stroke-opacity=".5" stroke-width="' + line + '"/>';
        body += '<circle cx="' + (inset * 2.2) + '" cy="' + (inset + header * .5) + '" r="' + Math.max(2, line * 1.7) + '" fill="' + colours[3] + '"/>';
        body += '<rect x="' + (inset * 1.8) + '" y="' + (inset + header * 1.45) + '" width="' + (width - inset * 3.6) + '" height="' + Math.max(5, height * .11) + '" rx="' + (radius * .35) + '" fill="' + colours[1] + '" fill-opacity=".17"/>';
        body += '<rect x="' + (inset * 1.8) + '" y="' + (inset + header * 2.35) + '" width="' + ((width - inset * 4.4) * .62) + '" height="' + Math.max(4, height * .07) + '" rx="' + (radius * .25) + '" fill="' + colours[2] + '" fill-opacity=".38"/>';
        body += '<circle cx="' + (width - inset * 2.4) + '" cy="' + (height - inset * 2.4) + '" r="' + Math.max(5, unit * .065) + '" fill="' + colours[3] + '"/>';
      }
      var svg = Core.svgDocument(brief, body,{extraAttributes:'direction="'+context.targetCanvas.responsive.direction+'"'});
      var minimumTarget=context.targetCanvas.responsive.minimum_target_size||44,activeScale=context.targetCanvas.responsive.reduced_motion?1:.98;
      var metadata = {
        schema: 'axm.ui-component-spec/v1', legacy_schema:'axm.ui-asset-metadata/v1',name: brief.title, kind: brief.kind,
        dimensions: { width: width, height: height }, nineSlice: { left: inset * 2, top: inset * 2, right: inset * 2, bottom: inset * 2 },
        states: ['default', 'hover', 'active', 'disabled'], scalable: true,
        stateStyles:{default:{opacity:1,scale:1},hover:{opacity:1,scale:1},active:{opacity:.92,scale:activeScale},disabled:{opacity:.45,scale:1}},
        interaction:{minimumTargetSize:minimumTarget,inputModalities:context.targetCanvas.responsive.input_modalities,direction:context.targetCanvas.responsive.direction,reducedMotion:context.targetCanvas.responsive.reduced_motion,focusRing:{colour:colours[3],width:Math.max(2,line*2)}},
        tokens: { surface: colours[0], accent: colours[1], foreground: colours[2], attention: colours[3], radius: radius,contrastRatio:contrast.ratio }
      };
      var metadataText=JSON.stringify(metadata, null, 2),totalBytes=svg.length+metadataText.length;
      return {
        artifacts: [
          { id: 'ui-source', role: 'editable-source', name: brief.title, filename: Core.slug(brief.title) + '.svg', mime: 'image/svg+xml', format: 'SVG', width: width, height: height, editable: true, text: svg, metadata: { nineSlice: metadata.nineSlice } },
          { id: 'ui-metadata', role: 'runtime-metadata', name: brief.title + ' UI metadata', filename: Core.slug(brief.title) + '.ui.json', mime: 'application/json', format: 'JSON', width: 0, height: 0, editable: true, text:metadataText,metadata:{schema:metadata.schema} }
        ],
        previewArtifactId: 'ui-source',
        recipe: { format:'axm.ui-component-recipe/v1', parameters:{ inset:inset, radius:radius, nineSlice:metadata.nineSlice, states:metadata.states, targetMedium:context.targetCanvas.medium }, steps:[{ op:'build-scalable-frame' },{ op:'create-state-tokens' },{ op:'check-contrast-and-slicing' }] },
        validationChecks: [{ name:'target-canvas-propagated', pass:context.targetCanvas.schema===Core.TARGET_CANVAS_SCHEMA },{ name:'foreground-contrast', pass:context.targetCanvas.colour.minimum_contrast_ratio==null||contrast.ratio>=context.targetCanvas.colour.minimum_contrast_ratio,details:contrast},{name:'minimum-target-size',pass:context.targetCanvas.behaviour.indexOf('interactive')<0||(width>=minimumTarget&&height>=minimumTarget)},{name:'reduced-motion',pass:!context.targetCanvas.responsive.reduced_motion||Object.keys(metadata.stateStyles).every(function(state){return metadata.stateStyles[state].scale===1;})},{name:'alternative-text',pass:!context.targetCanvas.accessibility.alternative_text||svg.indexOf('aria-label=')>=0},{name:'focus-visible',pass:!context.targetCanvas.accessibility.focus_visible||!!metadata.interaction.focusRing},{name:'file-budget',pass:context.targetCanvas.performance.max_file_bytes==null||totalBytes<=context.targetCanvas.performance.max_file_bytes}],
        measures: { scalable: true, nineSliceReady: true, stateCount: metadata.states.length,contrastRatio:contrast.ratio,minimumTargetSize:minimumTarget,totalBytes:totalBytes },
        notes: ['Visual source and runtime-oriented slicing metadata are delivered together.']
      };
    }
  };
}));
