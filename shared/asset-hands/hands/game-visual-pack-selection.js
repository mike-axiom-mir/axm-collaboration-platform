(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node ? require("../game-visual-pack-core") : root.AXMGameVisualPackCore
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, GameVisual) {
  "use strict";
  if (!Core || !GameVisual) throw new Error("game visual pack hand dependencies are required");
  var VERSION = "1.0.0";

  function jsonArtifact(id, role, name, filename, value, editable) {
    return {
      id: id,
      role: role,
      name: name,
      filename: filename,
      mime: "application/json",
      format: "JSON",
      width: 0,
      height: 0,
      editable: Boolean(editable),
      text: JSON.stringify(value, null, 2),
      metadata: { schema: value.schema || null, candidateOnly: true, canonical: false }
    };
  }

  var descriptor = {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "game-visual-pack-selection",
    title: "Game Visual Pack Selection Hand",
    version: VERSION,
    category: "visual-simulation",
    lifecycle_status: "experimental",
    summary: "Checks complete game visual packs against declared hardware and inventory while preserving player authority, saves, simulation truth, and an old-machine baseline.",
    purpose: "Let a game acquire entirely new presentation layers later without making visual upgrades mandatory progression or invalidating old machines.",
    operation_modes: ["create", "inspect", "workflow"],
    canvas_models: ["host-neutral"],
    entry_surfaces: ["command", "asset-fabric", "export-recipe"],
    mutability: "inspect",
    kinds: ["inspection", "visual-pack", "game-visual-pack"],
    accepts: [Core.BRIEF_SCHEMA, Core.SOURCE_ARTIFACT_SCHEMA, GameVisual.SCHEMAS.request],
    produces: [Core.RESULT_SCHEMA, GameVisual.SCHEMAS.game, GameVisual.SCHEMAS.pack, GameVisual.SCHEMAS.hardware, GameVisual.SCHEMAS.inventory, GameVisual.SCHEMAS.result, "axm.game-visual-pack-catalog/v1", "axm.game-visual-baseline-receipt/v1"],
    input_types: [{ mime: "application/json", format: "JSON", schema: GameVisual.SCHEMAS.request, roles: [], required_for: ["create", "inspect", "workflow"], mutable: false, max_bytes: 4000000 }],
    output_types: [
      { mime: "application/json", format: "JSON", schema: GameVisual.SCHEMAS.result, role: "visual-pack-selection-result", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: GameVisual.SCHEMAS.game, role: "game-visual-boundary", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: GameVisual.SCHEMAS.inventory, role: "visual-pack-inventory", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: GameVisual.SCHEMAS.hardware, role: "declared-hardware-profile", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: "axm.game-visual-pack-catalog/v1", role: "visual-pack-catalog", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: "axm.game-visual-baseline-receipt/v1", role: "baseline-continuity-receipt", editable: false, deterministic: true, lossy: false, known_losses: [] }
    ],
    canvas_types: [{ medium: "screen", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["allowed"], behaviours: ["static"], intended_uses: ["inspection", "visual-pack", "game-visual-pack"] }],
    canvas_limits: { min_width: 16, min_height: 16, max_width: 8192, max_height: 8192, max_pixels: 67108864, texture_bytes_per_pixel: 0, min_animation_frames: 1, max_animation_frames: 1 },
    constraints_honoured: ["dimensions", "dimensions.unit", "colour.space", "colour.transparency", "behaviour.static", "source-artifact.schema", "hardware.capabilities", "inventory.digest", "player-choice-authority", "save-independence"],
    editable_recipe_formats: [GameVisual.SCHEMAS.request],
    operations: { preview: false, validate: true, edit: false },
    emits_editable_source: true,
    supports_edit_operation: false,
    required_permissions: { local_file_system: "none", clipboard: false, network_domains: [], device_access: [], plugin_data: false },
    network_policy: { mode: "none", domains: [], rationale: "Selection is a pure deterministic compatibility calculation over caller-supplied contracts." },
    host_compatibility: { hosts: ["asset-fabric", "studio", "mirror", "standalone"], dependencies: [{ name: "AXM Game Visual Pack Core", version: GameVisual.VERSION, bundled: true }] },
    engine: { name: "AXM game visual pack resolver", version: VERSION, execution: "local-pure-bounded" },
    editable: true,
    deterministic: true,
    authority: "candidate-only",
    implementation_status: "executable",
    safety_tier: "safe-local",
    portability: { interchange_formats: [GameVisual.SCHEMAS.game, GameVisual.SCHEMAS.pack, GameVisual.SCHEMAS.hardware, GameVisual.SCHEMAS.inventory, GameVisual.SCHEMAS.result], known_losses: ["Declared fixtures describe test capability; they do not prove or auto-detect the current host hardware."], unsupported_features: ["automatic hardware detection", "pack installation", "game runtime mutation", "automatic quality approval", "automatic promotion"], fallbacks: [] },
    validation: { checks: ["deterministic replay", "exact package digest", "complete semantic coverage", "declared hardware compatibility", "bundled baseline continuity", "save digest unchanged", "no silent fallback", "player choice required"] },
    rollback: { strategy: "discard-selection-receipt; resolver never mutates the runtime or source save" },
    evidence: [{ claim: "A whole-game visual pack can be recommended or explicitly selected without mutating game truth or silently substituting another pack.", source_url: "local:shared/asset-hands/game-visual-pack-core.js", specification_version: VERSION, retrieved_at: "2026-08-12" }],
    tests: ["game-visual-pack-selftest", "asset-hands-selftest", "schema-contract-selftest", "choice-first-visual-lab-selftest"],
    limits: { automaticHardwareDetection: false, installation: false, automaticActivation: false, automaticApproval: false, automaticPromotion: false, fallback: false }
  };

  async function createAsync(context) {
    var sources = context.sourceArtifacts.filter(function (item) { return item.content_schema === GameVisual.SCHEMAS.request; });
    if (sources.length !== 1) throw new Error("game visual pack hand requires exactly one axm.game-visual-selection-request/v1 source");
    var request;
    try { request = JSON.parse(sources[0].text); } catch (error) { throw new Error("game visual selection request is not valid JSON"); }
    if (request.schema !== GameVisual.SCHEMAS.request) throw new Error("game visual selection request schema mismatch");

    var result = GameVisual.resolveSelection(request);
    var replay = GameVisual.resolveSelection(request);
    var minimumHardware = request.minimum_hardware_profile;
    var baseline = GameVisual.verifyBaseline(request.game_contract, request.packs, request.inventory, minimumHardware);
    var catalog = {
      schema: "axm.game-visual-pack-catalog/v1",
      version: VERSION,
      status: "EXPERIMENTAL",
      game_contract_id: request.game_contract.id,
      packs: request.packs,
      authority: GameVisual.candidateAuthority()
    };
    var artifacts = [
      jsonArtifact("visual-pack-selection-result", "visual-pack-selection-result", context.brief.title + " selection result", Core.slug(context.brief.title) + "-selection-result.json", result, false),
      jsonArtifact("game-visual-contract", "game-visual-boundary", context.brief.title + " game visual boundary", Core.slug(context.brief.title) + "-game-contract.json", request.game_contract, true),
      jsonArtifact("visual-pack-inventory", "visual-pack-inventory", context.brief.title + " pack inventory", Core.slug(context.brief.title) + "-inventory.json", request.inventory, true),
      jsonArtifact("hardware-profile", "declared-hardware-profile", context.brief.title + " declared hardware", Core.slug(context.brief.title) + "-hardware.json", request.hardware_profile, true),
      jsonArtifact("visual-pack-catalog", "visual-pack-catalog", context.brief.title + " pack catalog", Core.slug(context.brief.title) + "-catalog.json", catalog, true),
      jsonArtifact("baseline-continuity", "baseline-continuity-receipt", context.brief.title + " baseline continuity", Core.slug(context.brief.title) + "-baseline.json", baseline, false)
    ];
    var recommendationNotActivation = result.status !== "READY_FOR_CHOICE" || (result.recommendation && result.recommendation.activated === false && result.selection === null);
    return {
      artifacts: artifacts,
      previewArtifactId: "visual-pack-selection-result",
      recipe: { format: GameVisual.SCHEMAS.request, parameters: request, steps: [{ op: "verify-game-contract-and-pack-digests" }, { op: "verify-semantic-slot-coverage" }, { op: "compare-declared-hardware-requirements" }, { op: "recommend-without-activating" }, { op: "honour-explicit-player-choice-or-emit-typed-refusal" }, { op: "prove-save-and-game-truth-unchanged" }] },
      validationChecks: [
        { name: "deterministic-replay", pass: GameVisual.stable(result) === GameVisual.stable(replay) },
        { name: "baseline-continuity", pass: baseline.status === "PASS" },
        { name: "save-unchanged", pass: result.save_digest_before === result.save_digest_after },
        { name: "no-silent-fallback", pass: result.fallback_used === false },
        { name: "recommendation-is-not-activation", pass: recommendationNotActivation },
        { name: "player-authority", pass: result.authority.player_choice_required === true },
        { name: "candidate-only", pass: request.game_contract.authority.canonical === false && request.inventory.authority.promoted === false }
      ],
      measures: { routeStatus: result.status, hardwareProfileId: request.hardware_profile.id, recommendedPackId: result.recommendation ? result.recommendation.pack_id : null, selectedPackId: result.selection ? result.selection.pack_id : null, installedPacks: request.inventory.entries.filter(function (entry) { return entry.state === "INSTALLED"; }).length, fallbackUsed: false, saveChanged: false },
      notes: ["Recommendation is advisory and cannot activate a pack.", "Typed missing, incompatible, and contract-mismatch results preserve the current pack; no fallback is applied.", "The resolver emits candidate receipts only and cannot install, promote, canonize, or mutate a game."]
    };
  }

  return { descriptor: descriptor, createAsync: createAsync };
});
