(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMScreenContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA = 'axm.screen-contract/v1';
  const LAYERS = Object.freeze(['surface', 'depth', 'motion', 'density', 'signal']);
  const PRESETS = Object.freeze({
    fixed: Object.freeze([]),
    instrument: Object.freeze(['density', 'signal']),
    balanced: Object.freeze(['surface', 'density', 'signal']),
    operational: Object.freeze(['surface', 'depth', 'density', 'signal']),
    creative: LAYERS,
    expressive: LAYERS
  });

  function text(value) { return String(value || '').toLowerCase(); }
  function uniqueLayers(values) {
    const source = Array.isArray(values) ? values : [];
    return Object.freeze(LAYERS.filter(layer => source.indexOf(layer) >= 0));
  }
  function recommendPreset(module) {
    const declared = module && module.presentation && module.presentation.screenPreset;
    if (declared && PRESETS[declared]) return declared;
    const identity = text(module && module.id);
    if (/verifier|validator|audit|diagnostic/.test(identity)) return 'instrument';
    const haystack = [module && module.id, module && module.category, module && module.layer]
      .concat(module && module.tags || []).map(text).join(' ');
    if (/game|play|world|planet|toon|animation|film|story/.test(haystack)) return 'expressive';
    if (/studio|create|design|asset|audio|visual|skin|chroma|forge/.test(haystack)) return 'creative';
    if (/command|operator|dashboard|agent|mirror|ai-team/.test(haystack)) return 'operational';
    if (/verif|test|audit|diagnostic|governance|permission|infrastructure|service/.test(haystack)) return 'instrument';
    return 'balanced';
  }
  function resolve(module) {
    module = module || {};
    const declaration = module.presentation && typeof module.presentation === 'object' ? module.presentation : {};
    const preset = recommendPreset(module);
    const editableLayers = Array.isArray(declaration.editableLayers)
      ? uniqueLayers(declaration.editableLayers)
      : PRESETS[preset];
    const modeEditable = declaration.modeEditable !== false;
    return Object.freeze({
      schema: SCHEMA,
      moduleId: module.id || null,
      preset,
      body: Object.freeze({ source:'module-manifest', editable:false, authority:'runtime-substrate' }),
      behavior: Object.freeze({ source:'module-contract', editable:false, authority:'module-runtime' }),
      presentation: Object.freeze({ source:'presentation-policy', editable:editableLayers.length > 0 || modeEditable, modeEditable, editableLayers, authority:'presentation-only' }),
      screen: Object.freeze({ source:'hub-frame', editable:editableLayers.length > 0, authority:'view-only' }),
      resourcePolicy: Object.freeze({
        separation:'capability-first',
        hostChoosesBudget:true,
        presentationFallbacks:Object.freeze(['reduce-motion', 'reduce-depth', 'reduce-effects', 'lower-asset-resolution']),
        capabilityExceptionsRequireEvidence:true
      }),
      boundaries: Object.freeze(['no-behavior-edit', 'no-permission-edit', 'no-runtime-authority', 'no-hardware-claim', 'no-silent-capability-downgrade'])
    });
  }
  function allows(contract, layer) {
    return !!(contract && contract.presentation && contract.presentation.editableLayers.indexOf(layer) >= 0);
  }
  function limitRecipe(recipeApi, input, contract) {
    if (!recipeApi || !contract) return input;
    const normalized = recipeApi.normalize(input);
    const layers = {};
    LAYERS.forEach(layer => {
      layers[layer] = allows(contract, layer) ? normalized.layers[layer] : recipeApi.DEFAULT.layers[layer];
    });
    return recipeApi.normalize(Object.assign({}, normalized, { layers }));
  }

  return Object.freeze({ version:'v1.0.0', SCHEMA, LAYERS, PRESETS, recommendPreset, resolve, allows, limitRecipe });
});
