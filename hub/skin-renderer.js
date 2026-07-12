/* ============================================================
   AXM HUB SKIN ASSET RENDERER — v0.1 TEST
   Resolves validated vault:id references to same-origin files declared in
   assets/local/skin-vault/index.json. Data only: no remote URLs, no CSS from
   a skin, and no silent missing image.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMSkinRenderer = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const INDEX_URL = '/assets/local/skin-vault/index.json';
  const STYLE = {
    'brand.mark':           { variable:'--skin-brand-mark', className:'skin-asset-brand-mark' },
    'brand.wordmark':       { variable:'--skin-brand-wordmark', className:'skin-asset-brand-wordmark' },
    'nav.icon.default':     { variable:'--skin-nav-icon', className:'skin-asset-nav-icon' },
    'sidebar.background':   { variable:'--skin-sidebar-bg', className:'skin-asset-sidebar-bg' },
    'viewport.background':  { variable:'--skin-viewport-bg', className:'skin-asset-viewport-bg' },
    'home.hero':            { variable:'--skin-home-hero', className:'skin-asset-home-hero' },
    'card.texture':         { variable:'--skin-card-texture', className:'skin-asset-card-texture' },
    'statusbar.background': { variable:'--skin-statusbar-bg', className:'skin-asset-statusbar-bg' },
    'overlay.backdrop':     { variable:'--skin-overlay-bg', className:'skin-asset-overlay-bg' },
    'viewport.empty':       { variable:'--skin-empty-bg', className:'skin-asset-empty-bg' }
  };

  function entries(index) {
    return index && index.assets && typeof index.assets === 'object' ? index.assets : {};
  }

  function localSource(src) {
    const s = String(src || '');
    return !s.includes('..') && /^\/assets\/local\/skin-vault\/[\w./-]+\.(png|webp|jpe?g|svg)$/i.test(s);
  }

  function resolve(assetRefs, index) {
    const found = [], missing = [], refused = [], vault = entries(index);
    Object.keys(assetRefs || {}).forEach(slot => {
      const rule = STYLE[slot];
      if (!rule) { refused.push({ slot, reason:'undeclared render slot' }); return; }
      const ref = String(assetRefs[slot] || '');
      if (!/^vault:[\w.-]+$/.test(ref)) { refused.push({ slot, ref, reason:'not a vault:id reference' }); return; }
      const id = ref.slice(6), rec = vault[id];
      if (!rec) { missing.push({ slot, ref, id, reason:'not listed in local skin vault' }); return; }
      const src = typeof rec === 'string' ? rec : rec.src;
      if (!localSource(src)) { refused.push({ slot, ref, id, src, reason:'vault source is not an allowed same-origin skin asset' }); return; }
      found.push({ slot, ref, id, src, variable:rule.variable, className:rule.className });
    });
    return { found, missing, refused };
  }

  function clear(rootEl, body) {
    Object.keys(STYLE).forEach(slot => {
      rootEl.style.removeProperty(STYLE[slot].variable);
      body.classList.remove(STYLE[slot].className);
    });
  }

  function preload(ImageCtor, src) {
    return new Promise(resolveLoad => {
      if (!ImageCtor) { resolveLoad(false); return; }
      const img = new ImageCtor();
      img.onload = () => resolveLoad(true);
      img.onerror = () => resolveLoad(false);
      img.src = src;
    });
  }

  async function apply(assetRefs, opts) {
    opts = opts || {};
    const rootEl = opts.root || (typeof document !== 'undefined' ? document.documentElement : null);
    const body = opts.body || (typeof document !== 'undefined' ? document.body : null);
    if (!rootEl || !body) return { applied:[], missing:[], refused:[], error:'no document surface' };
    clear(rootEl, body);
    if (!assetRefs || !Object.keys(assetRefs).length) return { applied:[], missing:[], refused:[] };
    try {
      const fetcher = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);
      if (!fetcher) throw new Error('no fetch implementation');
      const response = await fetcher(opts.indexUrl || INDEX_URL);
      if (!response || !response.ok) throw new Error('skin vault index unavailable');
      const index = await response.json();
      const r = resolve(assetRefs, index), applied = [], missing = r.missing.slice();
      for (const item of r.found) {
        const ok = await preload(opts.Image || (typeof Image !== 'undefined' ? Image : null), item.src);
        if (!ok) { missing.push({ slot:item.slot, ref:item.ref, id:item.id, reason:'listed file did not load' }); continue; }
        rootEl.style.setProperty(item.variable, 'url("' + item.src.replace(/"/g, '') + '")');
        body.classList.add(item.className);
        applied.push(item);
      }
      return { applied, missing, refused:r.refused };
    } catch (e) {
      return { applied:[], missing:[], refused:[], error:e.message || String(e) };
    }
  }

  return { INDEX_URL, STYLE, localSource, resolve, clear, apply };
});
