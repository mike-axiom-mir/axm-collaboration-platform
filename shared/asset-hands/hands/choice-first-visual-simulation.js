(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node ? require("../choice-first-core") : root.AXMChoiceFirstCore,
    node ? require("../choice-first-pilot-core") : root.AXMChoiceFirstPilotCore,
    node ? require("../pixel-animation-core") : root.AXMPixelAnimationCore,
    node ? require("../raster-codec") : root.AXMRasterCodec,
  );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, Choice, Pilot, PixelAnimation, RasterCodec) {
  "use strict";
  if (!Core || !Choice || !Pilot || !PixelAnimation || !RasterCodec) throw new Error("choice-first hand dependencies are required");
  var VERSION = "1.0.0";

  function jsonArtifact(id, role, name, filename, value, editable) {
    return { id: id, role: role, name: name, filename: filename, mime: "application/json", format: "JSON", width: 0, height: 0, editable: !!editable, text: JSON.stringify(value, null, 2), metadata: { schema: value.schema || null, candidateOnly: true, canonical: false } };
  }

  function binaryArtifact(id, role, name, filename, mime, format, encoded, metadata) {
    return { id: id, role: role, name: name, filename: filename, mime: mime, format: format, width: metadata.width, height: metadata.height, editable: false, dataUrl: encoded.dataUrl, metadata: Object.assign({ candidateOnly: true, canonical: false, pixelFormat: "RGBA8", colourSpace: "sRGB" }, metadata) };
  }

  function defaultEvents(identityId) {
    var prefix = identityId.replace(/[^a-z0-9]+/g, "-");
    if (identityId === "axm.park.ticket-gate") return [
      { id: prefix + "-idle-proof", type: "time_elapsed", duration_ms: 31557600000 },
      { id: prefix + "-open", type: "open" },
      { id: prefix + "-cycles", type: "use_cycle", cycles: 12, load_factor: 1 },
    ];
    if (identityId === "axm.home.starter-sofa") return [
      { id: prefix + "-idle-proof", type: "time_elapsed", duration_ms: 31557600000 },
      { id: prefix + "-use", type: "use_cycle", cycles: 8, load_factor: 1.2 },
    ];
    return [
      { id: prefix + "-idle-proof", type: "time_elapsed", duration_ms: 31557600000 },
      { id: prefix + "-start", type: "start" },
      { id: prefix + "-run", type: "run" },
      { id: prefix + "-cycles", type: "use_cycle", cycles: 10, load_factor: 0.8 },
    ];
  }

  function rawRecipe(request, profile, sheet, frames) {
    var ids = frames.map(function (_, index) { return "motion-frame-" + index; });
    return {
      schema: PixelAnimation.RECIPE_SCHEMA,
      id: request.identity_id.split(".").pop() + "-" + profile.id,
      identity_id: request.identity_id,
      representation_profile_id: profile.id,
      source_artifact_id: "source-sheet",
      profile: profile.id === "pixel-8bit" || profile.id === "pixel-16bit" ? profile.id : "pixel-custom",
      sheet: { cell_width: sheet.cell_width, cell_height: sheet.cell_height },
      frames: ids.map(function (id, index) { return { id: id, cell_index: index, animation: request.identity_id.indexOf("sofa") >= 0 ? "inhabited-idle" : "operating", direction: "management-view", index: index, duration_ms: Math.round(1000 * profile.axes.motion.frame_rate.denominator / profile.axes.motion.frame_rate.numerator), pivot: { x: 0.5, y: 1, unit: "normalized" }, tags: ["identity-bound", profile.id] }; }),
      clips: [{ id: "default-motion", runtime_name: "DefaultMotion|management-view", animation: request.identity_id.indexOf("sofa") >= 0 ? "inhabited-idle" : "operating", direction: "management-view", frame_ids: ids, playback: { mode: "loop", order: "forward", repeat_count: 0 }, tags: ["causal-state-bound"] }],
      palette: { enforcement: "exact", max_colours: profile.axes.palette.max_colours, colours: Pilot.PALETTES[profile.id] || Pilot.PALETTES["pixel-16bit"], include_transparent: false },
      preview: { emit_integer_preview: true, integer_scale: profile.id === "pixel-8bit" ? 4 : 2, background: "#182033FF" },
      video: { emit_sequence: true, cycles: 2 },
      validation: { reject_duplicate_frames: false, max_clip_duration_ms: 10000 },
      provenance: { author_type: "program", actor_id: "axm-choice-first-pilot", parent_package_id: null, parent_recipe_id: request.id, contributors: [{ id: "choice-first-pilot-core", type: "program", role: "deterministic-original-pixel-renderer", tool: "AXMChoiceFirstPilotCore", version: Pilot.VERSION }] },
      authority: "candidate-only",
    };
  }

  var descriptor = {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "choice-first-visual-simulation",
    title: "Choice-First Visual & Simulation Hand",
    version: "1.0.0",
    category: "visual-simulation",
    lifecycle_status: "experimental",
    summary: "Resolves exact visual profiles and binds deterministic pixel representations to persistent identities and causal state without fallback.",
    purpose: "Let human, AI and deterministic-program callers change visual direction without making the representation own simulation truth.",
    operation_modes: ["create", "workflow"],
    canvas_models: ["raster-frame", "host-neutral"],
    entry_surfaces: ["command", "asset-fabric", "export-recipe"],
    mutability: "generate",
    kinds: ["sprite", "character", "prop", "animation", "sequence", "inspection"],
    accepts: [Core.BRIEF_SCHEMA, Core.SOURCE_ARTIFACT_SCHEMA, Choice.SCHEMAS.request],
    produces: [Core.RESULT_SCHEMA, "image/png", "image/apng", Choice.SCHEMAS.identity, Choice.SCHEMAS.profile, Choice.SCHEMAS.representationSet, Choice.SCHEMAS.simulation, Choice.SCHEMAS.upgradeableObject, Choice.SCHEMAS.missing, PixelAnimation.RECIPE_SCHEMA, "axm.object-upgrade-sequence/v1"],
    input_types: [{ mime: "application/json", format: "JSON", schema: Choice.SCHEMAS.request, roles: [], required_for: ["create", "workflow"], mutable: false, max_bytes: 200000 }],
    output_types: [
      { mime: "image/png", format: "PNG", schema: "", role: "identity-bound-source-sheet", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "image/apng", format: "APNG", schema: "", role: "identity-bound-animation-preview", editable: false, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Choice.SCHEMAS.identity, role: "persistent-asset-identity", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Choice.SCHEMAS.profile, role: "resolved-visual-profile", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Choice.SCHEMAS.simulation, role: "causal-simulation-state", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Choice.SCHEMAS.representationSet, role: "asset-representation-set", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: Choice.SCHEMAS.upgradeableObject, role: "upgradeable-object-state", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: PixelAnimation.RECIPE_SCHEMA, role: "editable-pixel-animation-recipe", editable: true, deterministic: true, lossy: false, known_losses: [] },
      { mime: "application/json", format: "JSON", schema: "axm.object-upgrade-sequence/v1", role: "object-upgrade-receipts", editable: false, deterministic: true, lossy: false, known_losses: [] },
    ],
    canvas_types: [{ medium: "game-world", units: ["px"], colour_spaces: ["srgb"], transparency_modes: ["required", "allowed"], behaviours: ["animated"], intended_uses: ["sprite", "character", "prop", "animation", "sequence", "inspection"] }],
    canvas_limits: { min_width: 48, min_height: 48, max_width: 96, max_height: 96, max_pixels: 9216, texture_bytes_per_pixel: 4, min_animation_frames: 2, max_animation_frames: 12 },
    constraints_honoured: ["dimensions", "dimensions.unit", "colour.space", "colour.transparency", "behaviour.animated", "performance.max-animation-frames"],
    editable_recipe_formats: [Choice.SCHEMAS.request, PixelAnimation.RECIPE_SCHEMA],
    operations: { preview: true, validate: true, edit: false },
    emits_editable_source: true,
    supports_edit_operation: false,
    required_permissions: { local_file_system: "none", clipboard: false, network_domains: [], device_access: [], plugin_data: false },
    network_policy: { mode: "none", domains: [], rationale: "Profile resolution, simulation, raster drawing and PNG/APNG encoding are deterministic and local." },
    host_compatibility: { hosts: ["asset-fabric", "studio", "mirror", "standalone"], dependencies: [{ name: "AXM Choice First Core", version: Choice.VERSION, bundled: true }, { name: "AXM Choice First Pilot Core", version: Pilot.VERSION, bundled: true }] },
    engine: { name: "AXM choice-first deterministic pilot", version: VERSION, execution: "local-async-bounded" },
    editable: true,
    deterministic: true,
    authority: "candidate-only",
    implementation_status: "executable",
    safety_tier: "safe-local",
    portability: { interchange_formats: ["image/png", "image/apng", Choice.SCHEMAS.identity, Choice.SCHEMAS.profile, Choice.SCHEMAS.representationSet, Choice.SCHEMAS.simulation, Choice.SCHEMAS.upgradeableObject], known_losses: ["8-bit and 16-bit are art-direction presets over RGBA8 sRGB, not console emulation."], unsupported_features: ["realtime 3D", "cinematic render", "automatic taste approval"], fallbacks: [] },
    validation: { checks: ["exact profile with no fallback", "persistent identity binding", "no time-only decay", "palette boundary", "PNG/APNG structure", "candidate-only authority"] },
    rollback: { strategy: "discard-candidate-artifacts-and-retain-request" },
    evidence: [{ claim: "One causal identity and state can drive both installed pixel profiles without silent substitution.", source_url: "local:shared/asset-hands/choice-first-core.js", specification_version: VERSION, retrieved_at: "2026-08-12" }],
    tests: ["choice-first-selftest", "asset-hands-selftest", "schema-contract-selftest", "html-script-syntax-test"],
    limits: { installedProfiles: ["pixel-8bit", "pixel-16bit", "pixel-custom"], automaticApproval: false, automaticPromotion: false, fallback: false },
  };

  async function createAsync(context) {
    var requests = context.sourceArtifacts.filter(function (item) { return item.content_schema === Choice.SCHEMAS.request; });
    if (requests.length !== 1) throw new Error("choice-first hand requires exactly one axm.choice-first-request/v1 source");
    var request;
    try { request = JSON.parse(requests[0].text); } catch (error) { throw new Error("choice-first request is not valid JSON"); }
    if (request.schema !== Choice.SCHEMAS.request) throw new Error("choice-first request schema mismatch");
    var resolved = Choice.resolveProfile(request.profile);
    if (resolved.status !== "READY") {
      return {
        artifacts: [jsonArtifact("missing-representation", "typed-representation-gap", "Missing representation", "missing-representation.json", resolved, false)],
        previewArtifactId: "missing-representation",
        recipe: { format: Choice.SCHEMAS.request, parameters: request, steps: [{ op: "resolve-exact-profile" }, { op: "emit-typed-gap-without-fallback" }] },
        validationChecks: [{ name: "typed-gap", pass: resolved.schema === Choice.SCHEMAS.missing }, { name: "no-fallback", pass: resolved.fallback_used === false && resolved.nearest_substitute_used === false }],
        measures: { routeStatus: resolved.status, fallbackUsed: false, artifacts: 1 },
        notes: ["The requested representation was not substituted. Implement the named missing contracts to continue."],
      };
    }
    var profile = resolved.profile;
    var identity = Choice.getIdentity(request.identity_id);
    var simulation = Choice.createSimulation(request.identity_id, request.id + ".simulation");
    var replay = Choice.replaySimulation(simulation, request.events && request.events.length ? request.events : defaultEvents(request.identity_id));
    simulation = replay.simulation;
    var sofa = null, sofaReceipts = [], resources = request.resources || { money: 1000, labour_hours: 40, materials: { fasteners: 30, hardwood: 20, textile: 30, filling: 20, springs: 20, sealant: 5, mechanism: 4, cleaner: 10 } };
    if (request.identity_id === "axm.home.starter-sofa") {
      sofa = Choice.createStarterSofa(request.id + ".sofa");
      (request.sofa_upgrades || []).forEach(function (upgradeId) {
        var result = Choice.applySofaUpgrade(sofa, upgradeId, resources);
        sofa = result.object; resources = result.resources; sofaReceipts.push(result.receipt || { status: result.status, upgrade_id: upgradeId, shortages: result.shortages || [] });
      });
    }
    var frames = Pilot.renderFrames(request.identity_id, profile.id, { profile: profile, simulation: simulation, sofa: sofa });
    var sheet = Pilot.renderSheet(frames);
    var encodedSheet = RasterCodec.encodeRgba(sheet.width, sheet.height, sheet.rgba, { colourSpace: "srgb" });
    var frameDuration = profile.axes.motion.frame_rate.denominator;
    var frameRate = profile.axes.motion.frame_rate.numerator;
    var encodedPreview = RasterCodec.encodeApng(frames[0].width, frames[0].height, frames.map(function (frame) { return { rgba: frame.rgba, delay_num: frameDuration, delay_den: frameRate }; }), { plays: 0, colourSpace: "srgb" });
    var recipe = PixelAnimation.normalizeRecipe(rawRecipe(request, profile, sheet, frames), { width: sheet.width, height: sheet.height });
    var representation = Choice.buildRepresentationSet(identity.id, [{ profile_id: profile.id, recipe_id: recipe.id, artifacts: [{ id: "source-sheet", mime: "image/png" }, { id: "animation-preview", mime: "image/apng" }, { id: "pixel-animation-recipe", mime: "application/json" }] }]);
    var artifacts = [
      binaryArtifact("source-sheet", "identity-bound-source-sheet", context.brief.title + " source sheet", Core.slug(context.brief.title) + "-sheet.png", "image/png", "PNG", encodedSheet, { width: sheet.width, height: sheet.height, identityId: identity.id, representationProfileId: profile.id }),
      binaryArtifact("animation-preview", "identity-bound-animation-preview", context.brief.title + " animation", Core.slug(context.brief.title) + "-preview.apng", "image/apng", "APNG", encodedPreview, { width: frames[0].width, height: frames[0].height, frames: frames.length, identityId: identity.id, representationProfileId: profile.id }),
      jsonArtifact("asset-identity", "persistent-asset-identity", context.brief.title + " identity", Core.slug(context.brief.title) + "-identity.json", identity, true),
      jsonArtifact("visual-profile", "resolved-visual-profile", context.brief.title + " profile", Core.slug(context.brief.title) + "-profile.json", profile, true),
      jsonArtifact("causal-simulation", "causal-simulation-state", context.brief.title + " simulation", Core.slug(context.brief.title) + "-simulation.json", simulation, true),
      jsonArtifact("pixel-animation-recipe", "editable-pixel-animation-recipe", context.brief.title + " animation recipe", Core.slug(context.brief.title) + "-animation-recipe.json", recipe, true),
      jsonArtifact("representation-set", "asset-representation-set", context.brief.title + " representation set", Core.slug(context.brief.title) + "-representations.json", representation, true),
    ];
    if (sofa) {
      artifacts.push(jsonArtifact("upgradeable-sofa", "upgradeable-object-state", context.brief.title + " upgradeable sofa", Core.slug(context.brief.title) + "-sofa.json", sofa, true));
      artifacts.push(jsonArtifact("sofa-upgrade-receipts", "object-upgrade-receipts", context.brief.title + " sofa upgrade receipts", Core.slug(context.brief.title) + "-sofa-upgrades.json", { schema: "axm.object-upgrade-sequence/v1", status: "EXPERIMENTAL", object_id: sofa.id, receipts: sofaReceipts, remaining_resources: resources, authority: Choice.authority() }, false));
    }
    var maxColours = Math.max.apply(null, frames.map(function (frame) { return Pilot.countColours(frame, false); }));
    var idleProof = simulation.history.find(function (entry) { return entry.event.type === "time_elapsed"; });
    return {
      artifacts: artifacts,
      previewArtifactId: "animation-preview",
      recipe: { format: Choice.SCHEMAS.request, parameters: request, steps: [{ op: "resolve-exact-profile" }, { op: "replay-causal-events" }, { op: "apply-resource-bound-object-upgrades" }, { op: "render-identity-bound-pixel-frames" }, { op: "encode-png-and-apng" }, { op: "emit-representation-set" }] },
      validationChecks: [
        { name: "exact-profile-no-fallback", pass: resolved.fallback_used === false && profile.id === request.profile.preset_id },
        { name: "identity-bound", pass: recipe.identity_id === identity.id && representation.identity_id === identity.id },
        { name: "representation-profile-bound", pass: recipe.representation_profile_id === profile.id },
        { name: "idle-time-no-decay", pass: !!idleProof && idleProof.receipt.time_only_no_decay === true && idleProof.receipt.condition_delta === 0 && idleProof.receipt.cleanliness_delta === 0 },
        { name: "palette-limit", pass: maxColours <= profile.axes.palette.max_colours, details: { actual: maxColours, maximum: profile.axes.palette.max_colours } },
        { name: "png-structure", pass: encodedSheet.inspection.pass },
        { name: "apng-structure", pass: encodedPreview.inspection.pass },
        { name: "candidate-only", pass: identity.authority.canonical === false && representation.authority.promoted === false },
      ],
      measures: { identityId: identity.id, representationProfileId: profile.id, width: frames[0].width, height: frames[0].height, frames: frames.length, paletteColours: maxColours, simulationEvents: simulation.history.length, sofaUpgrades: sofaReceipts.length, fallbackUsed: false },
      notes: ["Visual fidelity is a caller-owned representation choice; the identity, footprint, sockets and causal state remain shared.", "Elapsed time without a causal exposure or use event cannot reduce condition.", "All outputs remain EXPERIMENTAL candidates and require Mike review."],
    };
  }

  return { descriptor: descriptor, createAsync: createAsync };
});
