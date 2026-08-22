(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMPresentationRecipe = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA = 'axm.presentation-recipe/v1';
  const PROFILES = Object.freeze(['auto', 'cockpit', 'studio', 'dashboard', 'lab']);
  const LAYERS = Object.freeze({
    surface: Object.freeze(['glass', 'solid', 'minimal']),
    depth: Object.freeze(['flat', 'raised', 'dimensional']),
    motion: Object.freeze(['still', 'responsive', 'ambient']),
    density: Object.freeze(['compact', 'balanced', 'comfortable']),
    signal: Object.freeze(['quiet', 'clear', 'luminous'])
  });
  const DEFAULT = Object.freeze({
    schema: SCHEMA,
    id: 'shared-workshop',
    name: 'Shared Workshop',
    author: 'Mike + AXM',
    profile: 'auto',
    layers: Object.freeze({ surface:'glass', depth:'raised', motion:'responsive', density:'balanced', signal:'clear' })
  });
  const originals = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  const ATTRS = Object.freeze({
    surface:'data-axm-surface', depth:'data-axm-depth', motion:'data-axm-motion',
    density:'data-axm-density', signal:'data-axm-signal'
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function cleanText(value, fallback, max) {
    const result = String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, '').trim();
    return (result || fallback).slice(0, max || 80);
  }
  function allowed(layer, value) { return LAYERS[layer] && LAYERS[layer].indexOf(value) >= 0; }

  function normalize(input) {
    const source = input && typeof input === 'object' ? input : {};
    const layerSource = source.layers && typeof source.layers === 'object' ? source.layers : {};
    const layers = {};
    Object.keys(LAYERS).forEach(key => {
      layers[key] = allowed(key, layerSource[key]) ? layerSource[key] : DEFAULT.layers[key];
    });
    return Object.freeze({
      schema: SCHEMA,
      id: cleanText(source.id, DEFAULT.id, 64),
      name: cleanText(source.name, DEFAULT.name, 80),
      author: cleanText(source.author, DEFAULT.author, 80),
      profile: PROFILES.indexOf(source.profile) >= 0 ? source.profile : DEFAULT.profile,
      layers: Object.freeze(layers),
      authority: 'presentation-only'
    });
  }

  function validate(input) {
    const errors = [];
    if (!input || typeof input !== 'object') return Object.freeze({ ok:false, errors:['recipe is not an object'] });
    const topKeys = ['schema','id','name','author','profile','layers','authority'];
    Object.keys(input).forEach(key => {
      if (topKeys.indexOf(key) < 0) errors.push('unknown recipe field: ' + key);
    });
    if (input.schema !== SCHEMA) errors.push('wrong or missing schema (expected ' + SCHEMA + ')');
    ['css','style','script','js','html','selectors','permissions','behavior','runtime'].forEach(key => {
      if (key in input) errors.push('presentation recipes are data, not authority - remove "' + key + '"');
    });
    if (PROFILES.indexOf(input.profile) < 0) errors.push('unknown profile: ' + input.profile);
    if (input.authority != null && input.authority !== 'presentation-only') errors.push('authority must remain presentation-only');
    if (!input.layers || typeof input.layers !== 'object') errors.push('layers object is required');
    else {
      Object.keys(input.layers).forEach(key => {
        if (!LAYERS[key]) errors.push('unknown layer: ' + key);
        else if (!allowed(key, input.layers[key])) errors.push('unknown ' + key + ' value: ' + input.layers[key]);
      });
      Object.keys(LAYERS).forEach(key => {
        if (!(key in input.layers)) errors.push('missing layer: ' + key);
      });
    }
    return Object.freeze({ ok:errors.length === 0, errors:Object.freeze(errors) });
  }

  function stable(recipe) {
    const value = normalize(recipe);
    return JSON.stringify([value.profile, Object.keys(LAYERS).sort().map(key => [key, value.layers[key]])]);
  }
  function fingerprint(recipe) {
    const source = stable(recipe);
    let a = 2166136261, b = 5381;
    for (let i = 0; i < source.length; i++) {
      a = Math.imul(a ^ source.charCodeAt(i), 16777619) >>> 0;
      b = ((b << 5) + b + source.charCodeAt(source.length - 1 - i)) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }

  function capture(body) {
    if (!originals || originals.has(body)) return;
    const attrs = {};
    Object.keys(ATTRS).forEach(key => { attrs[key] = body.getAttribute(ATTRS[key]); });
    originals.set(body, attrs);
  }
  function clearFromDocument(doc) {
    if (!doc || !doc.body) return Object.freeze({ applied:false, reason:'document-not-ready', authority:'presentation-only' });
    const body = doc.body, saved = originals && originals.get(body);
    Object.keys(ATTRS).forEach(key => {
      const original = saved && saved[key];
      if (original == null) body.removeAttribute(ATTRS[key]);
      else body.setAttribute(ATTRS[key], original);
    });
    return Object.freeze({ applied:true, cleared:true, authority:'presentation-only' });
  }
  function applyToDocument(doc, input, options) {
    if (!doc || !doc.body) return Object.freeze({ applied:false, reason:'document-not-ready', authority:'presentation-only' });
    const recipe = normalize(input), checked = validate(recipe);
    if (!checked.ok) return Object.freeze({ applied:false, reason:'recipe-invalid', errors:checked.errors, authority:'presentation-only' });
    if (options && options.mode && options.mode !== 'shared') return clearFromDocument(doc);
    const body = doc.body;
    capture(body);
    Object.keys(ATTRS).forEach(key => body.setAttribute(ATTRS[key], recipe.layers[key]));
    try {
      body.dispatchEvent(new doc.defaultView.CustomEvent('axm:presentation-recipe', {
        detail:{ recipe, fingerprint:fingerprint(recipe), authority:'presentation-only' }
      }));
    } catch (e) {}
    return Object.freeze({ applied:true, recipe, fingerprint:fingerprint(recipe), authority:'presentation-only' });
  }

  function newRecipe(name, author) {
    const recipe = clone(DEFAULT);
    recipe.id = 'recipe-' + fingerprint({ profile:'auto', layers:recipe.layers }).slice(0, 8);
    recipe.name = cleanText(name, 'Untitled recipe', 80);
    recipe.author = cleanText(author, 'me', 80);
    return recipe;
  }

  return Object.freeze({
    version:'v1.0.0', SCHEMA, PROFILES, LAYERS, DEFAULT, ATTRS,
    normalize, validate, fingerprint, applyToDocument, clearFromDocument, newRecipe
  });
});
