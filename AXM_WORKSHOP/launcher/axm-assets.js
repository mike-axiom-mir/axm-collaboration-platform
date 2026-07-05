/* ============================================================
   AXM ASSET RESOLVER  —  axm-assets.js   (v1.0 · vault-bootstrap step 1)
   ------------------------------------------------------------
   THE LIBRARIAN. Every picture, icon, or style the launcher shows is
   asked for HERE — no UI code ever hardcodes an asset path. Agreed by
   four independent reviews (Grok, Sonnet, Axiom/Mir, DeepSeek):
   cheap to do now, expensive to retrofit later.

   TODAY: one strategy — the local shelves that ship with the workshop
   (/assets/local/<shelf>/...; the launcher skin is the 'launcher' shelf). The launcher wakes up
   whole with zero Vault, zero network, zero anything.

   THE CONTRACT (step 2): the Vault namespace is declared and immutable:
        /assets/packs/launcher/base/
   The LOCATION never changes; the CONTENTS may version freely. It is
   EMPTY today on purpose. When a real Vault exists, its strategy plugs
   in with AXMAssets.use(fn) — one new trick for one librarian, zero
   rewrites anywhere else.

   NOT BUILT (steps 4–5, deferred by decision, not forgotten):
   Vault syncing (will be USER-INITIATED, never automatic at boot) and
   the manifest/optional-flag system. Documented in the decision brief.
   ============================================================ */
(function (global) {
  'use strict';

  var LOCAL = '/assets/local/';          /* root of ALL local shelves (launcher, sound, music, video, lang) */
  var NAMESPACE = '/assets/packs/launcher/base/'; /* immutable contract, empty today */

  /* strategies answer with a path or null (null = ask the next one).
     Today there is exactly one: the local fallback. */
  var strategies = [
    function localFallback(assetId /*, context */) { return LOCAL + assetId; }
  ];

  var api = {
    /* getAssetPath('logo.svg', 'header') -> a URL the UI can use.
       context is advisory (a future Vault strategy may care; today no one does). */
    getAssetPath: function (assetId, context) {
      for (var i = 0; i < strategies.length; i++) {
        var p = strategies[i](assetId, context);
        if (p) return p;
      }
      return LOCAL + assetId;   /* the librarian never returns empty-handed */
    },

    /* use(fn, atFront) — plug in a future strategy (e.g. Vault lookup).
       fn(assetId, context) -> path or null. atFront makes it preferred. */
    use: function (fn, atFront) {
      if (typeof fn !== 'function') throw new Error('strategy must be a function');
      if (atFront) strategies.unshift(fn); else strategies.push(fn);
      return api;
    },

    strategies: function () { return strategies.length; },
    NAMESPACE: NAMESPACE,
    LOCAL: LOCAL,
    VERSION: '1.0'
  };

  global.AXMAssets = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
