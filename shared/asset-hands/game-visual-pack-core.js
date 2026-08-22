(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMGameVisualPackCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var SCHEMAS = {
    game: "axm.game-visual-contract/v1",
    pack: "axm.game-visual-pack/v1",
    hardware: "axm.hardware-capability-profile/v1",
    inventory: "axm.game-visual-pack-inventory/v1",
    request: "axm.game-visual-selection-request/v1",
    result: "axm.game-visual-selection-result/v1",
    proof: "axm.game-visual-choice-proof/v1"
  };

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function stable(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    return "{" + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ":" + stable(value[key]);
    }).join(",") + "}";
  }

  function digest(value) {
    var text = typeof value === "string" ? value : stable(value);
    var first = 0x811c9dc5;
    var second = 0x9e3779b9;
    for (var index = 0; index < text.length; index += 1) {
      var code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 0x01000193) >>> 0;
      second ^= code + ((index + 1) * 97);
      second = Math.imul(second, 0x85ebca6b) >>> 0;
    }
    return first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0");
  }

  function candidateAuthority() {
    return {
      candidate_only: true,
      installed: false,
      promoted: false,
      canonical: false,
      human_review_required: true
    };
  }

  function resultAuthority(recommendationOnly) {
    return {
      recommendation_only: Boolean(recommendationOnly),
      player_choice_required: true,
      silent_fallback_forbidden: true,
      simulation_mutation_forbidden: true,
      save_mutation_forbidden: true
    };
  }

  function createPilotGameContract() {
    var simulationTruth = {
      schema: "axm.causal-asset-simulation/v1",
      invariants: ["time-alone-causes-no-condition-change", "events-own-state-transitions", "deterministic-replay"]
    };
    var gameplayTruth = {
      schema: "axm.gameplay-proxy-contract/v1",
      invariants: ["collision-independent-of-visual-pack", "navigation-independent-of-visual-pack", "rules-independent-of-visual-pack"]
    };
    var saveTruth = {
      schema: "axm.theme-park-save/v1",
      fields: ["park", "economy", "guests", "staff", "objects", "history"],
      excluded_fields: ["active_visual_pack", "visual_quality", "hardware_profile"]
    };
    return {
      schema: SCHEMAS.game,
      version: VERSION,
      status: "EXPERIMENTAL",
      id: "axm.game.theme-park-foundation",
      title: "AXM Theme Park Foundation",
      simulation_contract: { schema: simulationTruth.schema, digest: digest(simulationTruth) },
      gameplay_proxy_contract: { schema: gameplayTruth.schema, digest: digest(gameplayTruth) },
      save_contract: { schema: saveTruth.schema, digest: digest(saveTruth) },
      required_visual_slots: ["terrain", "paths", "attractions", "buildings", "guests", "staff", "signage", "effects", "interface"],
      baseline_policy: {
        pack_id: "axm.visual-pack.theme-park.pixel-8",
        must_be_bundled: true,
        must_be_installed: true,
        minimum_hardware_profile_id: "axm.hardware.museum-pc",
        silent_fallback_forbidden: true
      },
      invariants: [
        "visual-pack-selection-never-mutates-simulation",
        "visual-pack-selection-never-mutates-save-truth",
        "gameplay-proxies-remain-stable-across-packs",
        "recommendation-never-activates-without-player-choice",
        "unavailable-or-incompatible-packs-never-silently-fallback"
      ],
      provenance: { source: "AXM choice-first pilot", created: "2026-08-12", originality_review: "required" },
      authority: candidateAuthority()
    };
  }

  function bindSlots(game, profileId, notes) {
    var bindings = {};
    game.required_visual_slots.forEach(function (slot) {
      bindings[slot] = { representation_profile_id: profileId, notes: notes };
    });
    return bindings;
  }

  function sealPack(pack) {
    var out = clone(pack);
    delete out.content_digest;
    out.content_digest = digest(out);
    return out;
  }

  function createPilotPacks(gameContract) {
    var game = clone(gameContract || createPilotGameContract());
    var gameDigest = digest(game);
    function pack(spec) {
      return sealPack({
        schema: SCHEMAS.pack,
        version: VERSION,
        status: "EXPERIMENTAL",
        id: spec.id,
        title: spec.title,
        game_contract_id: game.id,
        game_contract_digest: gameDigest,
        art_direction: spec.art_direction,
        semantic_bindings: bindSlots(game, spec.profile, spec.notes),
        representation_profiles: [spec.profile],
        performance_profiles: spec.performance_profiles,
        requirements: spec.requirements,
        package: { bytes: spec.bytes, format: "axm-game-visual-pack-directory/v1" },
        recommendation_rank: spec.rank,
        provenance: { source: "AXM deterministic pilot", created: "2026-08-12", originality_review: "required" },
        authority: candidateAuthority()
      });
    }
    return [
      pack({
        id: "axm.visual-pack.theme-park.pixel-8",
        title: "Park Foundation / Pixel 8",
        profile: "pixel-8bit",
        notes: "Compact management-view baseline with stable semantic anchors.",
        art_direction: { medium: "pixel-raster", projection: "management-isometric", detail_language: "compact-8-bit", intent: "Readable baseline for old and constrained machines." },
        performance_profiles: ["legacy", "balanced", "reduced-motion"],
        requirements: { memory_mb: 512, video_memory_mb: 64, max_texture_dimension: 1024, runtime_features: ["canvas-2d", "rgba8"] },
        bytes: 8388608,
        rank: 10
      }),
      pack({
        id: "axm.visual-pack.theme-park.festival-16",
        title: "Festival Park / Pixel 16",
        profile: "pixel-16bit",
        notes: "A complete richer pixel-art layer over the same semantic game slots.",
        art_direction: { medium: "pixel-raster", projection: "management-isometric", detail_language: "layered-16-bit", intent: "More colour, animation, and environmental detail without changing game truth." },
        performance_profiles: ["balanced", "showcase", "reduced-motion"],
        requirements: { memory_mb: 2048, video_memory_mb: 512, max_texture_dimension: 4096, runtime_features: ["canvas-2d", "rgba8", "apng"] },
        bytes: 100663296,
        rank: 20
      }),
      pack({
        id: "axm.visual-pack.theme-park.walkable-3d",
        title: "Walkable Park / Realtime 3D",
        profile: "realtime-3d",
        notes: "Advertised future layer; no representation package is installed.",
        art_direction: { medium: "realtime-3d", projection: "player-and-management", detail_language: "walkable-stylized", intent: "Future adventurous walkable park representation using the same world anchors." },
        performance_profiles: ["balanced", "showcase", "reduced-motion"],
        requirements: { memory_mb: 8192, video_memory_mb: 4096, max_texture_dimension: 8192, runtime_features: ["webgl2", "pbr", "realtime-lighting"] },
        bytes: 4294967296,
        rank: 30
      }),
      pack({
        id: "axm.visual-pack.theme-park.cinematic",
        title: "Living Park / Cinematic",
        profile: "cinematic",
        notes: "Advertised future capability; intentionally unavailable until honestly implemented.",
        art_direction: { medium: "cinematic-realtime", projection: "directable-camera", detail_language: "high-fidelity-cinematic", intent: "Future high-end layer without replacing simulation or saves." },
        performance_profiles: ["showcase"],
        requirements: { memory_mb: 16384, video_memory_mb: 8192, max_texture_dimension: 8192, runtime_features: ["webgpu", "pbr", "realtime-lighting", "volumetrics"] },
        bytes: 12884901888,
        rank: 40
      })
    ];
  }

  function createHardwareProfiles() {
    function profile(id, label, memory, videoMemory, texture, features, storage) {
      return {
        schema: SCHEMAS.hardware,
        version: VERSION,
        status: "EXPERIMENTAL",
        id: id,
        label: label,
        source: "declared-fixture",
        capabilities: {
          memory_mb: memory,
          video_memory_mb: videoMemory,
          max_texture_dimension: texture,
          runtime_features: features,
          storage_free_bytes: storage
        },
        confidence: "fixture",
        provenance: { source: "deterministic compatibility test fixture", auto_detected: false, created: "2026-08-12" },
        authority: candidateAuthority()
      };
    }
    return [
      profile("axm.hardware.museum-pc", "Museum PC (declared fixture)", 1024, 128, 2048, ["canvas-2d", "rgba8"], 536870912),
      profile("axm.hardware.family-laptop", "Family laptop (declared fixture)", 8192, 2048, 8192, ["canvas-2d", "rgba8", "apng", "webgl2"], 10737418240),
      profile("axm.hardware.creator-desktop", "Creator desktop (declared fixture)", 32768, 16384, 16384, ["canvas-2d", "rgba8", "apng", "webgl2", "webgpu", "pbr", "realtime-lighting", "volumetrics"], 107374182400)
    ];
  }

  function createInventory(gameContract, packs) {
    var game = clone(gameContract || createPilotGameContract());
    var list = clone(packs || createPilotPacks(game));
    return {
      schema: SCHEMAS.inventory,
      version: VERSION,
      status: "EXPERIMENTAL",
      game_contract_id: game.id,
      baseline_pack_id: game.baseline_policy.pack_id,
      entries: list.map(function (pack) {
        var current = pack.id === "axm.visual-pack.theme-park.pixel-8" || pack.id === "axm.visual-pack.theme-park.festival-16";
        return {
          pack_id: pack.id,
          pack_digest: pack.content_digest,
          state: current ? "INSTALLED" : "UNAVAILABLE",
          bundled: pack.id === game.baseline_policy.pack_id,
          package_bytes: pack.package.bytes
        };
      }),
      provenance: { source: "AXM deterministic pilot inventory", created: "2026-08-12" },
      authority: candidateAuthority()
    };
  }

  function createPilotSave() {
    return {
      schema: "axm.theme-park-save/v1",
      version: "0.1.0",
      park: { id: "park-one", name: "First Light Park", open: true },
      economy: { money: 24000, currency: "credits" },
      guests: [{ id: "guest-1", location: [12, 8], intent: "ride-ferris-wheel" }],
      staff: [{ id: "staff-1", location: [9, 4], role: "mechanic" }],
      objects: ["axm.park.ferris-wheel", "axm.park.carousel-horse", "axm.park.ticket-gate"],
      history: [{ sequence: 1, event: "park_opened" }]
    };
  }

  function inventoryEntry(inventory, packId) {
    return (inventory.entries || []).find(function (entry) { return entry.pack_id === packId; }) || null;
  }

  function resourceChecks(pack, hardware) {
    var needed = pack.requirements;
    var actual = hardware.capabilities;
    var missingFeatures = needed.runtime_features.filter(function (feature) { return actual.runtime_features.indexOf(feature) === -1; });
    return [
      { id: "memory", pass: actual.memory_mb >= needed.memory_mb, detail: { required_mb: needed.memory_mb, available_mb: actual.memory_mb } },
      { id: "video-memory", pass: actual.video_memory_mb >= needed.video_memory_mb, detail: { required_mb: needed.video_memory_mb, available_mb: actual.video_memory_mb } },
      { id: "texture-dimension", pass: actual.max_texture_dimension >= needed.max_texture_dimension, detail: { required: needed.max_texture_dimension, available: actual.max_texture_dimension } },
      { id: "runtime-features", pass: missingFeatures.length === 0, detail: { missing: missingFeatures } }
    ];
  }

  function checkCompatibility(game, pack, hardware, inventory) {
    if (!pack) return { compatible: false, status: "MISSING_VISUAL_PACK", checks: [{ id: "pack-catalog-entry", pass: false, detail: "No pack contract was supplied." }] };
    var packPayload = clone(pack);
    delete packPayload.content_digest;
    var contentCheck = { id: "pack-content-integrity", pass: digest(packPayload) === pack.content_digest, detail: { expected: digest(packPayload), actual: pack.content_digest } };
    if (!contentCheck.pass) return { compatible: false, status: "PACK_CONTRACT_MISMATCH", checks: [contentCheck] };
    var gameDigest = digest(game);
    var contractChecks = [
      contentCheck,
      { id: "game-contract-id", pass: pack.game_contract_id === game.id, detail: { expected: game.id, actual: pack.game_contract_id } },
      { id: "game-contract-digest", pass: pack.game_contract_digest === gameDigest, detail: { expected: gameDigest, actual: pack.game_contract_digest } }
    ];
    if (contractChecks.some(function (check) { return !check.pass; })) return { compatible: false, status: "PACK_CONTRACT_MISMATCH", checks: contractChecks };

    var packShapeValid = pack.semantic_bindings && typeof pack.semantic_bindings === "object" && Array.isArray(pack.representation_profiles) && pack.requirements && typeof pack.requirements === "object" && pack.package && typeof pack.package === "object";
    var shapeCheck = { id: "pack-contract-shape", pass: Boolean(packShapeValid), detail: packShapeValid ? "required pack sections present" : "semantic_bindings, representation_profiles, requirements, and package are required" };
    if (!shapeCheck.pass) return { compatible: false, status: "PACK_CONTRACT_MISMATCH", checks: contractChecks.concat([shapeCheck]) };
    var missingSlots = game.required_visual_slots.filter(function (slot) { return !pack.semantic_bindings[slot]; });
    var profileBindingsValid = Object.keys(pack.semantic_bindings).every(function (slot) {
      return pack.representation_profiles.indexOf(pack.semantic_bindings[slot].representation_profile_id) !== -1;
    });
    var semanticChecks = [
      shapeCheck,
      { id: "semantic-slot-coverage", pass: missingSlots.length === 0, detail: { missing: missingSlots } },
      { id: "representation-profile-bindings", pass: profileBindingsValid, detail: { declared_profiles: clone(pack.representation_profiles) } }
    ];
    if (semanticChecks.some(function (check) { return !check.pass; })) return { compatible: false, status: "PACK_CONTRACT_MISMATCH", checks: contractChecks.concat(semanticChecks) };

    var entry = inventoryEntry(inventory, pack.id);
    var inventoryChecks = [
      { id: "inventory-entry", pass: Boolean(entry), detail: entry ? entry.state : "missing" },
      { id: "installed", pass: Boolean(entry && entry.state === "INSTALLED"), detail: entry ? entry.state : "missing" },
      { id: "package-digest", pass: Boolean(entry && entry.pack_digest === pack.content_digest), detail: entry ? { expected: pack.content_digest, actual: entry.pack_digest } : "missing" }
    ];
    if (inventoryChecks.some(function (check) { return !check.pass; })) return { compatible: false, status: "MISSING_VISUAL_PACK", checks: contractChecks.concat(semanticChecks, inventoryChecks) };

    var runtimeChecks = resourceChecks(pack, hardware);
    if (runtimeChecks.some(function (check) { return !check.pass; })) return { compatible: false, status: "INCOMPATIBLE_VISUAL_PACK", checks: contractChecks.concat(semanticChecks, inventoryChecks, runtimeChecks) };
    return { compatible: true, status: "COMPATIBLE", checks: contractChecks.concat(semanticChecks, inventoryChecks, runtimeChecks) };
  }

  function recommendPack(game, packs, hardware, inventory) {
    return packs.map(function (pack) {
      return { pack: pack, compatibility: checkCompatibility(game, pack, hardware, inventory) };
    }).filter(function (candidate) {
      return candidate.compatibility.compatible;
    }).sort(function (left, right) {
      return (right.pack.recommendation_rank || 0) - (left.pack.recommendation_rank || 0) || left.pack.id.localeCompare(right.pack.id);
    })[0] || null;
  }

  function gameTruthDigest(game) {
    return digest({
      simulation_contract: game.simulation_contract,
      gameplay_proxy_contract: game.gameplay_proxy_contract,
      save_contract: game.save_contract,
      required_visual_slots: game.required_visual_slots
    });
  }

  function createSelectionRequest(options) {
    var opts = options || {};
    var game = clone(opts.game_contract || createPilotGameContract());
    var packs = clone(opts.packs || createPilotPacks(game));
    var profiles = createHardwareProfiles();
    var hardware = clone(opts.hardware_profile || profiles[1]);
    var minimumHardware = clone(opts.minimum_hardware_profile || profiles.find(function (profile) { return profile.id === game.baseline_policy.minimum_hardware_profile_id; }) || profiles[0]);
    var request = {
      schema: SCHEMAS.request,
      version: VERSION,
      id: opts.id || "game-visual-selection-request",
      mode: opts.mode || "recommend",
      game_contract: game,
      hardware_profile: hardware,
      minimum_hardware_profile: minimumHardware,
      inventory: clone(opts.inventory || createInventory(game, packs)),
      packs: packs,
      save_state: clone(opts.save_state || createPilotSave()),
      current_pack_id: Object.prototype.hasOwnProperty.call(opts, "current_pack_id") ? opts.current_pack_id : game.baseline_policy.pack_id,
      authority: "player-choice-required"
    };
    if (opts.requested_pack_id) request.requested_pack_id = opts.requested_pack_id;
    if (opts.accept_recommendation === true) request.accept_recommendation = true;
    return request;
  }

  function buildResult(request, status, recommendation, selection, checks, message) {
    var saveBefore = digest(request.save_state);
    return {
      schema: SCHEMAS.result,
      version: VERSION,
      status: status,
      request_id: request.id,
      game_contract_id: request.game_contract.id,
      hardware_profile_id: request.hardware_profile.id,
      recommendation: recommendation,
      selection: selection,
      checks: checks || [],
      fallback_used: false,
      active_pack_changed: Boolean(selection && request.current_pack_id !== selection.pack_id),
      save_digest_before: saveBefore,
      save_digest_after: digest(request.save_state),
      game_truth_digest: gameTruthDigest(request.game_contract),
      message: message,
      authority: resultAuthority(status !== "SELECTED")
    };
  }

  function resolveSelection(input) {
    var request = clone(input);
    var game = request && request.game_contract;
    var packs = request && request.packs;
    var hardware = request && request.hardware_profile;
    var inventory = request && request.inventory;
    var validRequestShape = request && request.schema === SCHEMAS.request && game && Array.isArray(game.required_visual_slots) && Array.isArray(packs) && hardware && hardware.capabilities && inventory && Array.isArray(inventory.entries) && request.save_state;
    if (!validRequestShape) {
      var safeRequest = request || { id: "invalid", game_contract: { id: "unknown", simulation_contract: {}, gameplay_proxy_contract: {}, save_contract: {}, required_visual_slots: [] }, hardware_profile: { id: "unknown" }, save_state: {} };
      return buildResult(safeRequest, "INVALID_SELECTION_REQUEST", null, null, [{ id: "request-shape", pass: false, detail: "Required selection request fields are absent." }], "The visual selection request is incomplete; nothing was changed.");
    }

    var recommended = recommendPack(game, packs, hardware, inventory);
    var recommendation = recommended ? {
      pack_id: recommended.pack.id,
      pack_digest: recommended.pack.content_digest,
      title: recommended.pack.title,
      reason: "Highest-ranked installed pack compatible with this declared hardware profile.",
      activated: false
    } : null;

    if (request.mode === "recommend") {
      return buildResult(request, "READY_FOR_CHOICE", recommendation, null, recommended ? recommended.compatibility.checks : [], recommendation ? "A compatible pack is recommended, but the player must choose it." : "No installed pack is compatible with this declared hardware profile.");
    }
    if (request.mode !== "select") {
      return buildResult(request, "INVALID_SELECTION_REQUEST", recommendation, null, [{ id: "mode", pass: false, detail: request.mode }], "Unknown selection mode; nothing was changed.");
    }

    var requestedId = request.requested_pack_id;
    var acceptedRecommendation = request.accept_recommendation === true;
    if (!requestedId && acceptedRecommendation && recommendation) requestedId = recommendation.pack_id;
    if (!requestedId) {
      return buildResult(request, "INVALID_SELECTION_REQUEST", recommendation, null, [{ id: "player-choice", pass: false, detail: "requested_pack_id or accept_recommendation is required" }], "A recommendation is not permission. Choose a pack explicitly.");
    }
    var pack = packs.find(function (candidate) { return candidate.id === requestedId; });
    var compatibility = checkCompatibility(game, pack, hardware, inventory);
    if (!compatibility.compatible) {
      return buildResult(request, compatibility.status, recommendation, null, compatibility.checks, "The requested visual pack was not activated. No fallback was applied.");
    }
    var selection = {
      pack_id: pack.id,
      pack_digest: pack.content_digest,
      title: pack.title,
      representation_profiles: clone(pack.representation_profiles),
      performance_profile: pack.performance_profiles[0],
      activated_by: acceptedRecommendation && recommendation && recommendation.pack_id === pack.id ? "accepted-recommendation" : "explicit-player-choice"
    };
    return buildResult(request, "SELECTED", recommendation, selection, compatibility.checks, "The requested visual pack is ready to activate as presentation only; save and simulation truth are unchanged.");
  }

  function verifyBaseline(game, packs, inventory, minimumHardware) {
    var baselineId = game.baseline_policy.pack_id;
    var baseline = packs.find(function (pack) { return pack.id === baselineId; });
    var entry = inventoryEntry(inventory, baselineId);
    var compatibility = minimumHardware ? checkCompatibility(game, baseline, minimumHardware, inventory) : { compatible: false, status: "MISSING_MINIMUM_HARDWARE_PROFILE", checks: [{ id: "minimum-hardware-contract", pass: false, detail: "minimum hardware profile was not supplied" }] };
    var checks = [
      { id: "baseline-pack-contract", pass: Boolean(baseline), detail: baselineId },
      { id: "baseline-inventory-entry", pass: Boolean(entry), detail: entry ? entry.state : "missing" },
      { id: "baseline-bundled", pass: Boolean(entry && entry.bundled), detail: entry ? entry.bundled : false },
      { id: "baseline-installed", pass: Boolean(entry && entry.state === "INSTALLED"), detail: entry ? entry.state : "missing" },
      { id: "baseline-digest-bound", pass: Boolean(entry && baseline && entry.pack_digest === baseline.content_digest), detail: entry && baseline ? { expected: baseline.content_digest, actual: entry.pack_digest } : "missing" },
      { id: "minimum-hardware-profile", pass: Boolean(minimumHardware && minimumHardware.id === game.baseline_policy.minimum_hardware_profile_id), detail: minimumHardware ? minimumHardware.id : "missing" },
      { id: "minimum-hardware-compatible", pass: compatibility.compatible, detail: compatibility.status },
      { id: "silent-fallback-forbidden", pass: game.baseline_policy.silent_fallback_forbidden === true, detail: true }
    ];
    return {
      schema: "axm.game-visual-baseline-receipt/v1",
      version: VERSION,
      status: checks.every(function (check) { return check.pass; }) ? "PASS" : "FAIL",
      game_contract_id: game.id,
      baseline_pack_id: baselineId,
      minimum_hardware_profile_id: minimumHardware ? minimumHardware.id : game.baseline_policy.minimum_hardware_profile_id,
      checks: checks.concat(compatibility.checks),
      authority: candidateAuthority()
    };
  }

  function buildPilotScenarioProof() {
    var game = createPilotGameContract();
    var packs = createPilotPacks(game);
    var hardware = createHardwareProfiles();
    var inventory = createInventory(game, packs);
    var save = createPilotSave();
    var scenarios = [];

    function run(id, profile, mode, requestedPackId, acceptRecommendation, currentPackId, customPacks) {
      var request = createSelectionRequest({
        id: id,
        mode: mode,
        game_contract: game,
        packs: customPacks || packs,
        hardware_profile: profile,
        inventory: inventory,
        save_state: save,
        current_pack_id: currentPackId == null ? game.baseline_policy.pack_id : currentPackId
      });
      if (requestedPackId) request.requested_pack_id = requestedPackId;
      if (acceptRecommendation) request.accept_recommendation = true;
      var first = resolveSelection(request);
      var replay = resolveSelection(request);
      scenarios.push({
        id: id,
        request_digest: digest(request),
        result: first,
        deterministic_replay: stable(first) === stable(replay),
        save_unchanged: first.save_digest_before === first.save_digest_after,
        no_fallback: first.fallback_used === false
      });
      return first;
    }

    run("museum-recommendation-only", hardware[0], "recommend");
    run("museum-refuses-16bit", hardware[0], "select", "axm.visual-pack.theme-park.festival-16");
    run("family-recommends-16bit-without-activation", hardware[1], "recommend");
    run("family-player-overrides-to-baseline", hardware[1], "select", "axm.visual-pack.theme-park.pixel-8");
    run("creator-accepts-recommendation", hardware[2], "select", null, true);
    run("cinematic-is-honestly-missing", hardware[2], "select", "axm.visual-pack.theme-park.cinematic");
    var mismatched = clone(packs);
    mismatched[1].game_contract_digest = "0000000000000000";
    mismatched[1] = sealPack(mismatched[1]);
    var mismatchInventory = clone(inventory);
    var mismatchEntry = inventoryEntry(mismatchInventory, mismatched[1].id);
    mismatchEntry.pack_digest = mismatched[1].content_digest;
    var mismatchRequest = createSelectionRequest({ id: "contract-mismatch-refused", mode: "select", game_contract: game, packs: mismatched, hardware_profile: hardware[2], inventory: mismatchInventory, save_state: save });
    mismatchRequest.requested_pack_id = mismatched[1].id;
    var mismatchResult = resolveSelection(mismatchRequest);
    scenarios.push({ id: "contract-mismatch-refused", request_digest: digest(mismatchRequest), result: mismatchResult, deterministic_replay: stable(mismatchResult) === stable(resolveSelection(mismatchRequest)), save_unchanged: mismatchResult.save_digest_before === mismatchResult.save_digest_after, no_fallback: mismatchResult.fallback_used === false });

    var baseline = verifyBaseline(game, packs, inventory, hardware[0]);
    var assertions = {
      baseline_continuity: baseline.status === "PASS",
      deterministic_replay: scenarios.every(function (scenario) { return scenario.deterministic_replay; }),
      save_independence: scenarios.every(function (scenario) { return scenario.save_unchanged; }),
      no_silent_fallback: scenarios.every(function (scenario) { return scenario.no_fallback; }),
      recommendation_requires_choice: scenarios[0].result.status === "READY_FOR_CHOICE" && scenarios[0].result.selection === null,
      incompatible_refused: scenarios[1].result.status === "INCOMPATIBLE_VISUAL_PACK" && scenarios[1].result.selection === null,
      capable_machine_can_choose_baseline: scenarios[3].result.status === "SELECTED" && scenarios[3].result.selection.pack_id === game.baseline_policy.pack_id,
      missing_future_refused: scenarios[5].result.status === "MISSING_VISUAL_PACK" && scenarios[5].result.selection === null,
      contract_mismatch_refused: mismatchResult.status === "PACK_CONTRACT_MISMATCH" && mismatchResult.selection === null
    };
    return {
      schema: SCHEMAS.proof,
      version: VERSION,
      status: Object.keys(assertions).every(function (key) { return assertions[key]; }) ? "PASS" : "FAIL",
      game_contract: game,
      packs: packs,
      hardware_profiles: hardware,
      inventory: inventory,
      baseline_receipt: baseline,
      scenarios: scenarios,
      assertions: assertions,
      limitations: [
        "Hardware profiles are deterministic declarations, not automatic device detection.",
        "Only pixel-8bit and pixel-16bit packs are installed in this pilot.",
        "Human originality, readability, and fun review remains required."
      ],
      authority: candidateAuthority()
    };
  }

  return {
    VERSION: VERSION,
    SCHEMAS: SCHEMAS,
    stable: stable,
    digest: digest,
    candidateAuthority: candidateAuthority,
    sealPack: sealPack,
    createPilotGameContract: createPilotGameContract,
    createPilotPacks: createPilotPacks,
    createHardwareProfiles: createHardwareProfiles,
    createInventory: createInventory,
    createPilotSave: createPilotSave,
    createSelectionRequest: createSelectionRequest,
    checkCompatibility: checkCompatibility,
    recommendPack: recommendPack,
    resolveSelection: resolveSelection,
    verifyBaseline: verifyBaseline,
    buildPilotScenarioProof: buildPilotScenarioProof
  };
});
