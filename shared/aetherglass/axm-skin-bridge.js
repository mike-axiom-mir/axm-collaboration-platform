/* AXM skin -> Aetherglass bridge.
   Mounts only validated, explicitly enabled skin data and keeps teardown owned. */
(function attachAXMSkinAetherglass(root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMSkinAetherglass = api;
})(typeof self !== 'undefined' ? self : globalThis, function createBridge(root) {
  'use strict';

  const controllers = new WeakMap();
  const CORE_KEYS = [
    'theme', 'atmosphere', 'material', 'depth', 'luminosity', 'density', 'shape',
    'transparency', 'contrast', 'quality', 'motion', 'intensity',
    'atmosphereStrength', 'glowStrength', 'pointerLighting', 'reactivePanels',
    'parallax', 'trackScroll'
  ];

  function skinApi(options) {
    return options.skinApi || root.AXMSkin || null;
  }

  function ensureStyles(documentRef, assetBase) {
    if (!documentRef || !documentRef.head) return [];
    const base = String(assetBase || '/shared/aetherglass/src').replace(/\/$/, '');
    const assets = [
      ['axm-aetherglass-core-css', base + '/axm-aetherglass.css'],
      ['axm-aetherglass-forge-css', base + '/axm-luminous-layer-forge.css']
    ];
    return assets.map(function (asset) {
      let link = documentRef.getElementById(asset[0]);
      if (link) return link;
      link = documentRef.createElement('link');
      link.id = asset[0];
      link.rel = 'stylesheet';
      link.href = asset[1];
      link.dataset.axmOwned = 'skin-aetherglass-bridge';
      documentRef.head.appendChild(link);
      return link;
    });
  }

  function runtimeConfig(resolved) {
    const visuals = resolved.visuals || {};
    const config = {};
    CORE_KEYS.forEach(function (key) { config[key] = visuals[key]; });
    const tokens = resolved.tokens || {};
    config.palette = {
      accent1: tokens['--cy'],
      accent2: tokens['--purple'],
      accent3: tokens['--blue'],
      lux: tokens['--gold']
    };
    return config;
  }

  function destroy(rootElement) {
    const controller = rootElement && controllers.get(rootElement);
    if (!controller) return false;
    controller.forge.destroy();
    controller.engine.destroy();
    controllers.delete(rootElement);
    return true;
  }

  function apply(skin, options) {
    options = options || {};
    const api = skinApi(options);
    const rootElement = options.root || root.document && root.document.body;
    if (!api || !rootElement) return { ok:false, reason:'skin API or visual root unavailable' };

    const validation = api.validate(skin);
    if (!validation.ok) return { ok:false, reason:'skin validation failed', errors:validation.errors };
    const resolved = api.resolve(skin);
    const visuals = resolved.visuals || {};
    if (!visuals.enabled) {
      destroy(rootElement);
      return { ok:true, enabled:false, mounted:false };
    }
    if (!root.AXMVisualEngine || !root.AXMLuminousLayerForge) {
      return { ok:false, reason:'Aetherglass runtime unavailable' };
    }

    ensureStyles(rootElement.ownerDocument || root.document, options.assetBase);
    const config = runtimeConfig(resolved);
    let controller = controllers.get(rootElement);
    if (!controller || !controller.engine.mounted || controller.forge.destroyed) {
      const engine = root.AXMVisualEngine.mount(Object.assign({}, config, {
        root: rootElement,
        applyToDocument: options.applyToDocument !== false,
        persist: false,
        duplicate: 'reuse'
      }));
      const forge = root.AXMLuminousLayerForge.mount(engine, {
        preset: visuals.lightPreset,
        reactive: visuals.pointerLighting
      });
      controller = { engine:engine, forge:forge };
      controllers.set(rootElement, controller);
    } else {
      controller.engine.applyConfig(config, { persist:false });
      controller.forge.applyConfig({
        preset: visuals.lightPreset,
        reactive: visuals.pointerLighting
      }, { emit:false });
    }

    return {
      ok: true,
      enabled: true,
      mounted: true,
      version: root.AXMVisualEngine.version,
      config: controller.engine.getConfig(),
      light: controller.forge.getState()
    };
  }

  function get(rootElement) {
    return rootElement ? controllers.get(rootElement) || null : null;
  }

  return { apply, destroy, get, ensureStyles, runtimeConfig };
});

