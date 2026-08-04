(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMPresentationPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MODES = Object.freeze(['shared', 'module']);
  const PROFILES = Object.freeze(['cockpit', 'studio', 'dashboard', 'lab']);
  const originals = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function validMode(value) { return MODES.indexOf(value) >= 0; }
  function validProfile(value) { return PROFILES.indexOf(value) >= 0; }
  function text(value) { return String(value || '').toLowerCase(); }

  function recommendProfile(module, requested) {
    const declared = module && module.presentation && module.presentation.sharedProfile;
    if (validProfile(requested)) return requested;
    if (validProfile(declared)) return declared;
    const haystack = [module && module.id, module && module.category, module && module.layer]
      .concat(module && module.tags || []).map(text).join(' ');
    if (/command|operator|game|play|agent|mirror|ai-team/.test(haystack)) return 'cockpit';
    if (/studio|create|design|asset|audio|film|visual|skin|toon|chroma/.test(haystack)) return 'studio';
    if (/lab|test|verify|diagnostic|inspect|research|build/.test(haystack)) return 'lab';
    return 'dashboard';
  }

  function normalizeDeclaration(input, module) {
    const value = input && typeof input === 'object' ? input : {};
    return Object.freeze({
      schema: 'axm.presentation-policy/v1',
      defaultMode: validMode(value.defaultMode) ? value.defaultMode : 'shared',
      sharedProfile: recommendProfile(module, value.sharedProfile),
      moduleVisual: value.moduleVisual !== false
    });
  }

  function resolve(options) {
    options = options || {};
    const module = options.module || {};
    const declaration = normalizeDeclaration(module.presentation, module);
    let mode = validMode(options.userMode) ? options.userMode : declaration.defaultMode;
    let source = validMode(options.userMode) ? 'user' : (module.presentation ? 'manifest' : 'shared-default');
    if (mode === 'module' && !declaration.moduleVisual) {
      mode = 'shared';
      source = 'module-visual-unavailable';
    }
    return Object.freeze({
      schema: declaration.schema,
      moduleId: module.id || null,
      mode,
      profile: recommendProfile(module, options.sharedProfile),
      source,
      moduleVisual: declaration.moduleVisual,
      authority: 'presentation-only'
    });
  }

  function ensureLink(doc, id, href) {
    let link = doc.getElementById(id);
    if (!link) {
      link = doc.createElement('link');
      link.id = id; link.rel = 'stylesheet'; link.href = href;
      doc.head.appendChild(link);
    }
    return link;
  }

  function applyToDocument(doc, resolution) {
    if (!doc || !doc.documentElement || !doc.head || !doc.body) {
      return Object.freeze({ applied:false, reason:'document-not-ready', authority:'presentation-only' });
    }
    const body = doc.body;
    if (originals && !originals.has(body)) originals.set(body, {
      spine: body.classList.contains('axm-spine'),
      profile: body.getAttribute('data-axm-profile')
    });
    const original = originals && originals.get(body) || { spine:false, profile:null };
    ensureLink(doc, 'axm-presentation-kernel', '/shared/visual-kernel/axm-kernel.css');
    ensureLink(doc, 'axm-presentation-spine', '/shared/presentation-spine/presentation-spine.css');
    ensureLink(doc, 'axm-presentation-host', '/shared/presentation-spine/presentation-host.css');
    doc.documentElement.dataset.axmPresentationMode = resolution.mode;
    body.dataset.axmPresentationMode = resolution.mode;
    body.dataset.axmPresentationSource = resolution.source;
    if (resolution.moduleId) body.dataset.axmPresentationModule = resolution.moduleId;
    if (resolution.mode === 'shared') {
      body.classList.add('axm-spine');
      body.dataset.axmProfile = resolution.profile;
    } else {
      body.classList.toggle('axm-spine', original.spine);
      if (original.profile == null) body.removeAttribute('data-axm-profile');
      else body.setAttribute('data-axm-profile', original.profile);
    }
    try {
      body.dispatchEvent(new doc.defaultView.CustomEvent('axm:presentation-mode', { detail:resolution }));
    } catch (e) {}
    return Object.freeze({ applied:true, mode:resolution.mode, profile:resolution.profile, authority:'presentation-only' });
  }

  return Object.freeze({
    version:'v1.0.0', modes:MODES, profiles:PROFILES,
    normalizeDeclaration, recommendProfile, resolve, applyToDocument
  });
});
