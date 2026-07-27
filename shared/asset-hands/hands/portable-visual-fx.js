(function (root, factory) {
  var node = typeof module === 'object' && module.exports;
  var provider = factory(
    node ? require('../asset-hand-core') : root.AXMAssetHandCore,
    node ? require('../../visual-fx/fx-blocks') : root.AXMVisualFX
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else { root.AXMAssetHandProviders = root.AXMAssetHandProviders || []; root.AXMAssetHandProviders.push(provider); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Core, FX) {
  'use strict';
  if (!FX || !FX.Blocks) throw new Error('AXM Visual FX is required');

  var RECIPE_SCHEMA = 'axm.visual-fx-recipe/v1';
  var NAMES = Object.keys(FX.Blocks);

  function sourceRecipe(context) {
    if (context.operationMode !== 'edit') return null;
    var source = context.sourceArtifacts.find(function (item) {
      return item.mime === 'application/json' && item.metadata && item.metadata.schema === RECIPE_SCHEMA;
    });
    if (!source) throw new Error('Visual FX edit requires an axm.visual-fx-recipe/v1 source artifact');
    try {
      var value = JSON.parse(source.text);
      if (value.schema !== RECIPE_SCHEMA || NAMES.indexOf(value.effect && value.effect.name) < 0) throw new Error('schema mismatch');
      return { item: source, value: value };
    } catch (error) {
      throw new Error('Visual FX recipe source is invalid: ' + error.message);
    }
  }

  function effectName(context, source) {
    if (source) return source.value.effect.name;
    var signal = [context.brief.title, context.brief.purpose]
      .concat(context.brief.styleTags || context.brief.style_tags || [])
      .join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '');
    var ordered = NAMES.slice().sort(function (a, b) { return b.length - a.length; });
    return ordered.find(function (name) { return signal.indexOf(name.toLowerCase()) >= 0; }) || 'glow';
  }

  function boundedParameters(context, name, source) {
    if (source) return JSON.parse(JSON.stringify(source.value.effect.parameters || {}));
    var palette = context.palette || [];
    if (name === 'linearGradient' || name === 'radialGradient' || name === 'conicGradient' || name === 'gradientBorder') {
      return palette.length > 1 ? { stops: palette.slice(0, 5) } : {};
    }
    if (['glow', 'neon', 'softShadow', 'longShadow', 'spotlight', 'vignette', 'scanlines', 'sheen'].indexOf(name) >= 0 && palette[0]) {
      return { color: palette[0] };
    }
    return {};
  }

  function preview(context, name, block) {
    var width = context.brief.canvas.width;
    var height = context.brief.canvas.height;
    var defs = block.svgDefs || block.svgFilter || '';
    var body = '<defs>' + defs + '</defs><rect width="' + width + '" height="' + height + '" fill="#101521"/>';
    if (block.svgDefs && block.paint) {
      body += '<rect x="24" y="24" width="' + (width - 48) + '" height="' + (height - 48) + '" rx="24" fill="' + block.paint + '"/>';
    } else if (block.svgFilter && name !== 'frostedGlass') {
      body += '<g filter="url(#' + block.id + ')"><rect x="' + Math.round(width * .25) + '" y="' + Math.round(height * .25) + '" width="' + Math.round(width * .5) + '" height="' + Math.round(height * .5) + '" rx="24" fill="#44d7ca"/></g>';
    } else {
      body += '<rect x="24" y="24" width="' + (width - 48) + '" height="' + (height - 48) + '" rx="24" fill="#182338" stroke="#65728a"/>';
    }
    body += '<text x="' + Math.round(width / 2) + '" y="' + Math.round(height / 2) + '" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="' + Math.max(16, Math.round(Math.min(width, height) * .08)) + '">' + name + '</text>';
    if (name === 'conicGradient' || name === 'frostedGlass') {
      body += '<text x="' + Math.round(width / 2) + '" y="' + Math.round(height / 2 + 32) + '" text-anchor="middle" fill="#aab7cc" font-family="system-ui,sans-serif" font-size="14">Live CSS host required for exact appearance</text>';
    }
    return Core.svgDocument(context.brief, body, { label: context.brief.title + ' portable visual effect preview' });
  }

  return {
    descriptor: {
      schema: Core.HAND_SCHEMA,
      contract_version: '2.0',
      id: 'portable-visual-fx',
      title: 'Portable Visual FX Hand',
      version: '0.1.0',
      category: 'effect',
      lifecycle_status: 'test',
      summary: 'Creates or edits deterministic visual-effect recipes with CSS, SVG where truthful, and host-neutral parameter tokens.',
      purpose: 'Keep reusable effects independent from one game, site, editor or renderer while exposing adapter limits.',
      operation_modes: ['create', 'edit'],
      canvas_models: ['dom-component', 'node-tree-design', 'raster-frame', 'viewport-2d', 'host-neutral'],
      entry_surfaces: ['command', 'panel', 'export-recipe'],
      mutability: 'generate',
      kinds: ['effect', 'visual-effect', 'skin', 'theme'],
      accepts: [Core.BRIEF_SCHEMA, RECIPE_SCHEMA],
      produces: [Core.RESULT_SCHEMA, 'application/json', 'text/css', 'image/svg+xml'],
      input_types: [{ mime: 'application/json', schema: RECIPE_SCHEMA, roles: ['source'], required_for: ['edit'], mutable: false, max_bytes: 524288 }],
      output_types: [
        { mime: 'application/json', format: 'JSON', schema: RECIPE_SCHEMA, role: 'editable-effect-recipe', editable: true, deterministic: true, lossy: false, known_losses: [] },
        { mime: 'text/css', format: 'CSS', role: 'portable-css-effect', editable: true, deterministic: true, lossy: false, known_losses: [] },
        { mime: 'image/svg+xml', format: 'SVG', role: 'effect-preview', editable: false, deterministic: true, lossy: true, known_losses: ['preview cannot prove host CSS, shader or backdrop-filter parity'] }
      ],
      canvas_types: [
        { medium: 'ui', units: ['px'], colour_spaces: ['srgb'], transparency_modes: ['opaque', 'allowed'], behaviours: ['static', 'interactive', 'responsive'], intended_uses: ['effect', 'skin', 'theme', 'ui-component'] },
        { medium: 'screen', units: ['px'], colour_spaces: ['srgb'], transparency_modes: ['opaque', 'allowed'], behaviours: ['static', 'interactive', 'responsive'], intended_uses: ['effect', 'skin', 'theme'] },
        { medium: 'game-world', units: ['px', 'game-world-unit'], colour_spaces: ['srgb'], transparency_modes: ['opaque', 'allowed'], behaviours: ['static', 'interactive'], intended_uses: ['effect', 'skin'] }
      ],
      constraints_honoured: ['dimensions', 'dimensions.unit', 'colour.space', 'colour.transparency', 'behaviour.static', 'behaviour.interactive', 'behaviour.responsive', 'performance.max-file-bytes'],
      editable_recipe_formats: [Core.RECIPE_SCHEMA, RECIPE_SCHEMA],
      operations: { preview: true, validate: true, edit: true },
      emits_editable_source: true,
      supports_edit_operation: true,
      requires: [],
      editable: true,
      deterministic: true,
      required_permissions: { local_file_system: 'none', network_domains: [] },
      network_policy: { mode: 'none', domains: [] },
      engine: { name: 'AXM Portable Visual FX', version: FX.VERSION, execution: 'same-thread-bounded' },
      safety_tier: 'safe-local',
      portability: {
        interchange_formats: ['application/json', 'text/css', 'image/svg+xml'],
        known_losses: ['engine and native-host adapters must map tokens to their own shader or theme systems'],
        unsupported_features: ['automatic OS theme installation', 'automatic engine shader compilation', 'SVG equivalent for conic gradients', 'static proof of backdrop blur'],
        fallbacks: []
      },
      validation: { checks: ['known effect id', 'stable content-derived id', 'token envelope', 'CSS envelope', 'target canvas propagation', 'file budget'] },
      rollback: { strategy: 'discard-candidate' },
      observability: { receipts: ['axm.asset-validation-receipt/v1'] },
      evidence: [{ claim: 'Fifteen local deterministic FX generators with portable output forms.', source_url: 'local:shared/visual-fx/fx-blocks.js', specification_version: FX.VERSION }],
      tests: ['visual-fx-selftest', 'asset-hands-selftest'],
      implementation_priority: 'quick-win',
      limits: { automaticApply: false, visualApproval: false, engineAdapterIncluded: false }
    },
    create: function (context) {
      var source = sourceRecipe(context);
      var name = effectName(context, source);
      var parameters = boundedParameters(context, name, source);
      var block = FX.Blocks[name](parameters);
      var slug = Core.slug(context.brief.title);
      var recipe = {
        schema: RECIPE_SCHEMA,
        version: '1.0.0',
        id: slug + '-' + block.id,
        effect: { name: name, kind: block.kind, parameters: block.tokens },
        outputs: { css: true, svg: !!(block.svgFilter || block.svgDefs), tokens: true },
        target_canvas: JSON.parse(JSON.stringify(context.targetCanvas)),
        portability: {
          adapters_required: ['native application themes', 'game-engine shaders', 'operating-system themes'],
          known_limits: [
            'conicGradient has no native SVG equivalent',
            'frostedGlass needs a live backdrop for exact CSS behavior',
            'grain browser SVG proof is separate from ImageMagick raster support'
          ]
        },
        provenance: { origin: 'local-generated', creator: 'Opus for Mike Tobi / AXM', source: 'exports/fx-blocks promoted through governed Workshop intake' },
        authority: { automatic_apply: false, visual_approval: false, canonical: false }
      };
      var recipeText = JSON.stringify(recipe, null, 2);
      var cssText = '.axm-fx-' + slug + ' {\n  ' + block.css + '\n}\n';
      var svgText = preview(context, name, block);
      var totalBytes = recipeText.length + cssText.length + svgText.length;
      return {
        artifacts: [
          { id: 'visual-fx-recipe', role: 'editable-effect-recipe', name: context.brief.title + ' FX recipe', filename: slug + '.visual-fx.json', mime: 'application/json', format: 'JSON', editable: true, text: recipeText, metadata: { schema: RECIPE_SCHEMA, effect: name } },
          { id: 'visual-fx-css', role: 'portable-css-effect', name: context.brief.title + ' CSS effect', filename: slug + '.visual-fx.css', mime: 'text/css', format: 'CSS', editable: true, text: cssText, metadata: { effect: name, adapterRequired: false } },
          { id: 'visual-fx-preview', role: 'effect-preview', name: context.brief.title + ' effect preview', filename: slug + '.visual-fx.svg', mime: 'image/svg+xml', format: 'SVG', editable: false, text: svgText, width: context.brief.canvas.width, height: context.brief.canvas.height, metadata: { effect: name, previewOnly: true, exactCssParity: name !== 'conicGradient' && name !== 'frostedGlass' } }
        ],
        previewArtifactId: 'visual-fx-preview',
        recipe: { format: RECIPE_SCHEMA, parameters: recipe, steps: [{ op: 'select-named-effect' }, { op: 'compile-stable-css-svg-and-tokens' }, { op: 'preserve-adapter-and-proof-limits' }, { op: 'emit-reviewable-candidate' }] },
        validationChecks: [
          { name: 'known-effect', pass: NAMES.indexOf(name) >= 0 },
          { name: 'stable-content-id', pass: FX.Blocks[name](parameters).id === block.id },
          { name: 'token-envelope', pass: !!block.tokens && typeof block.tokens === 'object' },
          { name: 'css-envelope', pass: typeof block.css === 'string' && block.css.length > 0 },
          { name: 'target-canvas-propagated', pass: recipe.target_canvas.schema === Core.TARGET_CANVAS_SCHEMA },
          { name: 'no-automatic-authority', pass: recipe.authority.automatic_apply === false && recipe.authority.visual_approval === false && recipe.authority.canonical === false },
          { name: 'file-budget', pass: context.targetCanvas.performance.max_file_bytes == null || totalBytes <= context.targetCanvas.performance.max_file_bytes }
        ],
        measures: { effect: name, cssBytes: cssText.length, recipeBytes: recipeText.length, previewBytes: svgText.length, totalBytes: totalBytes, svgForm: recipe.outputs.svg },
        notes: ['CSS and tokens are portable contracts; native, engine and OS targets still require explicit adapters.', 'Visual quality remains a human judgment.']
      };
    }
  };
}));
