(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var providers = node
    ? [
        require("./hands/vector-form"),
        require("./hands/surface-pattern"),
        require("./hands/raster-texture"),
        require("./hands/ui-component"),
        require("./hands/pixel-sprite"),
        require("./hands/composition"),
        require("./hands/print-layout"),
        require("./hands/fabric-pattern"),
        require("./hands/physical-mark"),
        require("./hands/cut-layout"),
        require("./hands/production-print"),
        require("./hands/animated-raster"),
        require("./hands/material-shader"),
        require("./hands/theme-token"),
        require("./hands/layout-responsive"),
        require("./hands/inspect-codegen"),
        require("./hands/parametric-mesh"),
        require("./hands/timeline-sequence"),
        require("./hands/ktx2-texture-delivery"),
        require("./hands/wide-colour-raster"),
        require("./hands/pdfx-press-production"),
        require("./hands/uv-material-baker"),
        require("./hands/cnc-toolpath-simulation"),
        require("./hands/animated-web-delivery"),
        require("./hands/final-video-encoder"),
        require("./hands/accessible-document"),
        require("./hands/font-shaping-localization"),
        require("./hands/rigged-animated-3d"),
        require("./hands/renderer-material-parity"),
        require("./hands/openusd-scene-composition"),
        require("./hands/procedural-geometry-graph"),
        require("./hands/spatial-collision-navigation"),
        require("./hands/audio-notation-device"),
        require("./hands/native-dcc-bridge"),
      ]
    : root.AXMAssetHandProviders || [];
  var api = factory(
    node ? require("./asset-hand-core") : root.AXMAssetHandCore,
    providers,
    node ? require("./missing-hands-catalog") : root.AXMMissingAssetHands,
  );
  if (node) module.exports = api;
  if (root) root.AXMAssetHands = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (Core, providers, MissingHands) {
    "use strict";
    if (!Core) throw new Error("AXM Asset Hand Core is required");
    var registry = Core.createRegistry(providers || []);
    function enrichDiagnosis(diagnosis) {
      var copy = JSON.parse(JSON.stringify(diagnosis));
      copy.planned_hands =
        copy.status === "READY" || !MissingHands
          ? []
          : MissingHands.suggest(copy, 5).map(function (candidate) {
              return {
                id: candidate.hand.id,
                title: candidate.hand.title,
                priority: candidate.hand.priority,
                score: candidate.score,
                reason: candidate.reason,
                why_missing: candidate.hand.why_missing,
                unblock_conditions: candidate.hand.unblock_conditions.slice(),
              };
            });
      return copy;
    }
    function diagnose(brief, host) {
      return enrichDiagnosis(registry.diagnose(brief, host));
    }
    function createFamily(brief, options) {
      var family = registry.createFamily(brief, options);
      family.diagnosis = enrichDiagnosis(family.diagnosis);
      (family.issues || []).forEach(function (issue) {
        if (issue.gap_report)
          issue.gap_report = JSON.parse(JSON.stringify(family.diagnosis));
      });
      return family;
    }
    async function createFamilyAsync(brief, options) {
      var family = await registry.createFamilyAsync(brief, options);
      family.diagnosis = enrichDiagnosis(family.diagnosis);
      (family.issues || []).forEach(function (issue) {
        if (issue.gap_report)
          issue.gap_report = JSON.parse(JSON.stringify(family.diagnosis));
      });
      return family;
    }
    return {
      VERSION: Core.VERSION,
      BRIEF_SCHEMA: Core.BRIEF_SCHEMA,
      LEGACY_HAND_SCHEMA: Core.LEGACY_HAND_SCHEMA,
      HAND_SCHEMA: Core.HAND_SCHEMA,
      RESULT_SCHEMA: Core.RESULT_SCHEMA,
      ARTIFACT_SCHEMA: Core.ARTIFACT_SCHEMA,
      SOURCE_ARTIFACT_SCHEMA: Core.SOURCE_ARTIFACT_SCHEMA,
      FAMILY_SCHEMA: Core.FAMILY_SCHEMA,
      TARGET_CANVAS_SCHEMA: Core.TARGET_CANVAS_SCHEMA,
      RECIPE_SCHEMA: Core.RECIPE_SCHEMA,
      VALIDATION_SCHEMA: Core.VALIDATION_SCHEMA,
      GAP_SCHEMA: Core.GAP_SCHEMA,
      TARGET_CANVAS_MEDIUMS: Core.TARGET_CANVAS_MEDIUMS.slice(),
      OPERATION_MODES: Core.OPERATION_MODES.slice(),
      CANVAS_MODELS: Core.CANVAS_MODELS.slice(),
      KINDS: Core.KINDS.slice(),
      normalizeTargetCanvas: Core.normalizeTargetCanvas,
      normalizeBrief: Core.normalizeBrief,
      normalizeSourceArtifact: Core.normalizeSourceArtifact,
      validateDescriptor: Core.validateDescriptor,
      validateResult: Core.validateResult,
      register: registry.register,
      list: registry.list,
      routes: registry.routes,
      diagnose: diagnose,
      create: registry.create,
      createAsync: registry.createAsync,
      createFamily: createFamily,
      createFamilyAsync: createFamilyAsync,
      verifyDeterminism: registry.verifyDeterminism,
      verifyDeterminismAsync: registry.verifyDeterminismAsync,
      MISSING_HAND_CATALOG_SCHEMA: MissingHands && MissingHands.SCHEMA,
      listMissingHands: MissingHands
        ? MissingHands.list
        : function () {
            return [];
          },
      getMissingHand: MissingHands
        ? MissingHands.get
        : function () {
            return null;
          },
      suggestMissingHands: MissingHands
        ? MissingHands.suggest
        : function () {
            return [];
          },
    };
  },
);
