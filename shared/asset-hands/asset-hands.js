(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var providers = node
    ? [
        require("./hands/vector-form"),
        require("./hands/surface-pattern"),
        require("./hands/raster-texture"),
        require("./hands/raster-compositor"),
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
        require("./hands/portable-visual-fx"),
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
    node
      ? require("./optional-node-module")("./upgrade-program/upgrade-registry", ["fflate"])
      : root.AXMAssetHandUpgradeRegistry,
    node ? require("./substrate-pack/pack-core") : null,
    node ? require("./substrate-pack/live-executor") : null,
    node ? require("./upgrade-program/external-validators") : null,
    node ? require("./substrate-pack/godot-live-executor") : null,
    node ? require("./substrate-pack/blender-live-executor") : null,
    node ? require("./substrate-pack/blender-capability-executor") : null,
    node ? require("./substrate-pack/ffmpeg-capability-executor") : null,
    node ? require("./substrate-pack/embroidery-capability-executor") : null,
    node ? require("./optional-node-module")("./substrate-pack/three-mf-capability-executor", ["fflate"]) : null,
    node ? require("./substrate-pack/brep-step-capability-executor") : null,
  );
  if (node) module.exports = api;
  if (root) root.AXMAssetHands = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (Core, providers, MissingHands, UpgradeRegistry, SubstratePack, LiveExecutor, ExternalValidators, GodotLiveExecutor, BlenderLiveExecutor, BlenderCapabilityExecutor, FfmpegCapabilityExecutor, EmbroideryCapabilityExecutor, ThreeMfCapabilityExecutor, BrepStepCapabilityExecutor) {
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
    function substrateInventory(options) {
      if (!SubstratePack)
        return { schema: "axm.external-substrate-inventory/v1", version: "1.0.0", counts: { MISSING: 1 }, composition_counts: {}, available_substrates: [], items: [], compositions: [], private_location_retained: false, automatic_installation: false, digest: null };
      try { return SubstratePack.inventory(options || {}); }
      catch (error) {
        return { schema: "axm.external-substrate-inventory/v1", version: "1.0.0", counts: { INVENTORY_ERROR: 1 }, composition_counts: {}, available_substrates: [], items: [], compositions: [], reason: SubstratePack.cleanText(error.message || error, 500), private_location_retained: false, automatic_installation: false, digest: null };
      }
    }
    function installedRequest(request, options) {
      var inventory = substrateInventory(options);
      var next = JSON.parse(JSON.stringify(request || {}));
      next.available_substrates = (inventory.available_substrates || []).slice();
      return { request: next, inventory: inventory };
    }
    function diagnoseInstalled(request, options) {
      if (!UpgradeRegistry) return null;
      var current = installedRequest(request, options);
      var result = UpgradeRegistry.diagnose(current.request);
      result.substrate_inventory_digest = current.inventory.digest;
      result.substrate_authority = "server-observed-exact-pack";
      return result;
    }
    function planInstalled(request, options) {
      if (!UpgradeRegistry) return null;
      var current = installedRequest(request, options);
      var result = UpgradeRegistry.plan(current.request);
      result.substrate_inventory_digest = current.inventory.digest;
      result.substrate_authority = "server-observed-exact-pack";
      return result;
    }
    function auditInstalled(options) {
      var inventory = substrateInventory(options);
      var result = UpgradeRegistry ? UpgradeRegistry.audit({ available_substrates: inventory.available_substrates || [] }) : null;
      if (result) { result.substrate_inventory_digest = inventory.digest; result.substrate_authority = "server-observed-exact-pack"; }
      return result;
    }
    function validateExternal(profileName, artifact, options) {
      if (!ExternalValidators || !LiveExecutor) throw new Error("external validator runtime is not loaded in this host");
      var profile = ExternalValidators.PROFILES[String(profileName || "")];
      if (!profile) throw new Error("unknown external validator profile");
      var executor = LiveExecutor.createExecutor(options || {});
      return ExternalValidators.run(profile, executor.resolve(profile), artifact, executor);
    }
    function runGodotProject(bundle, resource, options) {
      if (!GodotLiveExecutor) throw new Error("Godot live executor is not loaded in this host");
      return GodotLiveExecutor.createExecutor(options || {}).run(bundle, resource);
    }
    function runBlenderRender(options) {
      if (!BlenderLiveExecutor) throw new Error("Blender live executor is not loaded in this host");
      return BlenderLiveExecutor.createExecutor(options || {}).run();
    }
    function runBlenderCapabilityMatrix(options) {
      if (!BlenderCapabilityExecutor) throw new Error("Blender capability executor is not loaded in this host");
      return BlenderCapabilityExecutor.createExecutor(options || {}).run();
    }
    function runFfmpegCapabilityMatrix(options) {
      if (!FfmpegCapabilityExecutor) throw new Error("FFmpeg capability executor is not loaded in this host");
      return FfmpegCapabilityExecutor.createExecutor(options || {}).run();
    }
    function runEmbroideryCapabilityMatrix(options) {
      if (!EmbroideryCapabilityExecutor) throw new Error("Embroidery capability executor is not loaded in this host");
      return EmbroideryCapabilityExecutor.createExecutor(options || {}).run();
    }
    function runThreeMfCapabilityMatrix(options) {
      if (!ThreeMfCapabilityExecutor) throw new Error("3MF capability executor is not loaded in this host");
      return ThreeMfCapabilityExecutor.createExecutor(options || {}).run();
    }
    function runBrepStepCapabilityMatrix(options) {
      if (!BrepStepCapabilityExecutor) throw new Error("B-rep/STEP capability executor is not loaded in this host");
      return BrepStepCapabilityExecutor.createExecutor(options || {}).run();
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
      externalSubstrateInventory: substrateInventory,
      diagnoseUpgradeWithInstalledSubstrates: diagnoseInstalled,
      planUpgradeHandsWithInstalledSubstrates: planInstalled,
      auditInstalledUpgradeHands: auditInstalled,
      listExternalValidatorProfiles: ExternalValidators
        ? function () { return JSON.parse(JSON.stringify(ExternalValidators.PROFILES)); }
        : function () { return {}; },
      validateExternalArtifact: validateExternal,
      runGodotLiveProject: runGodotProject,
      runBlenderLiveRender: runBlenderRender,
      runBlenderCapabilityMatrix: runBlenderCapabilityMatrix,
      runFfmpegCapabilityMatrix: runFfmpegCapabilityMatrix,
      runEmbroideryCapabilityMatrix: runEmbroideryCapabilityMatrix,
      runThreeMfCapabilityMatrix: runThreeMfCapabilityMatrix,
      runBrepStepCapabilityMatrix: runBrepStepCapabilityMatrix,
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
      UPGRADE_EXTENSION_SCHEMA:
        UpgradeRegistry && UpgradeRegistry.EXTENSION_SCHEMA,
      UPGRADE_REGISTRY_VERSION: UpgradeRegistry && UpgradeRegistry.VERSION,
      UPGRADE_REQUEST_SCHEMA: UpgradeRegistry && UpgradeRegistry.REQUEST_SCHEMA,
      UPGRADE_RESULT_SCHEMA: UpgradeRegistry && UpgradeRegistry.RESULT_SCHEMA,
      listUpgradeHands: UpgradeRegistry
        ? UpgradeRegistry.list
        : function () {
            return [];
          },
      getUpgradeHand: UpgradeRegistry
        ? UpgradeRegistry.get
        : function () {
            return null;
          },
      diagnoseUpgrade: UpgradeRegistry
        ? UpgradeRegistry.diagnose
        : function (request) {
            return {
              schema: "axm.asset-hand-upgrade-result/v1",
              status: "MISSING_HAND",
              request: request || {},
              selected_hand: null,
              compatible_hands: [],
              rejections: [],
              missing: ["upgrade-program runtime is not loaded in this host"],
              fallback_used: false,
              invocation: null,
            };
          },
      planUpgradeHands: UpgradeRegistry
        ? UpgradeRegistry.plan
        : function (request) {
            return {
              schema: "axm.asset-hand-upgrade-result/v1",
              status: "MISSING_HAND",
              request: request || {},
              selected_hand: null,
              compatible_hands: [],
              route_plan: [],
              rejections: [],
              missing: ["upgrade-program runtime is not loaded in this host"],
              fallback_used: false,
              invocation: null,
            };
          },
      invokeUpgrade: UpgradeRegistry
        ? UpgradeRegistry.invoke
        : function () {
            throw new Error("Asset Hand upgrade runtime is not loaded in this host");
          },
      auditUpgradeHands: UpgradeRegistry
        ? UpgradeRegistry.audit
        : function () {
            return {
              schema: "axm.asset-hand-upgrade-audit/v1",
              version: "1.0.0",
              total: 0,
              counts: { MISSING_SUBSTRATE: 1 },
              available_substrates: [],
              items: [],
              missing: ["upgrade-program runtime is not loaded in this host"],
            };
          },
    };
  },
);
