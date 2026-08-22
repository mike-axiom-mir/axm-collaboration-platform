(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AXMMaterialSensoryCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";
  var SESSION_SCHEMA = "axm.asset-material-sensory-session/v1";
  var RESULT_SCHEMA = "axm.asset-hand-result/v1";
  var HANDOFF_SCHEMA = "axm.deterministic-material-handoff/v1";
  var RECIPE_SCHEMA = "axm.pbr-material-recipe/v1";
  var REVIEW_SCHEMA = "axm.material-sensory-review-receipt/v1";
  var PATCH_SCHEMA = "axm.material-machine-patch/v1";
  var HAND_ID = "pbr-material-bake";
  var HAND_VERSION = "1.1.0";
  var FAMILIES = ["brick", "asphalt", "painted-metal", "glass", "skin", "vehicle-paint"];
  var VERDICTS = ["ACCEPT_FOR_TEST", "REVISE", "REJECT"];
  var OBSERVATION_VALUES = ["GOOD", "REVISE", "UNKNOWN", "NOT_APPLICABLE"];
  var PNG_IDS = [
    "pbr-albedo-map",
    "pbr-normal-map",
    "pbr-orm-map",
    "pbr-emissive-map",
    "pbr-height-map",
    "pbr-material-preview"
  ];
  var RECIPE_KEYS = ["authority", "family", "id", "normal_strength", "schema", "seed", "size", "version"];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      var output = {};
      Object.keys(value).sort().forEach(function (key) { output[key] = stable(value[key]); });
      return output;
    }
    return value;
  }

  function canonicalStringify(value) {
    return JSON.stringify(stable(value));
  }

  function digest(value) {
    var text = typeof value === "string" ? value : canonicalStringify(value);
    var hash = 0x811c9dc5;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return "fnv1a32:" + (hash >>> 0).toString(16).padStart(8, "0");
  }

  function requireValue(condition, message) {
    if (!condition) throw new Error(message);
  }

  function finite(value, minimum, maximum, label) {
    var number = Number(value);
    requireValue(Number.isFinite(number), label + " must be numeric");
    requireValue(number >= minimum && number <= maximum, label + " must be within " + minimum + ".." + maximum);
    return number;
  }

  function integer(value, minimum, maximum, label) {
    var number = finite(value, minimum, maximum, label);
    requireValue(Number.isInteger(number), label + " must be an integer");
    return number;
  }

  function text(value, maximum, label) {
    var output = String(value == null ? "" : value).trim();
    requireValue(output.length > 0 && output.length <= maximum, label + " must contain 1.." + maximum + " characters");
    return output;
  }

  function parseRecipe(result) {
    requireValue(result && Array.isArray(result.artifacts), "Asset Hand artifacts are required");
    var artifact = result.artifacts.find(function (item) { return item.id === "editable-pbr-material-recipe"; });
    requireValue(artifact && typeof artifact.text === "string", "Editable PBR recipe artifact is required");
    var recipe;
    try { recipe = JSON.parse(artifact.text); }
    catch (_error) { throw new Error("Editable PBR recipe is not valid JSON"); }
    return validateRecipe(recipe);
  }

  function validateRecipe(input) {
    requireValue(input && typeof input === "object" && !Array.isArray(input), "PBR recipe object is required");
    requireValue(canonicalStringify(Object.keys(input).sort()) === canonicalStringify(RECIPE_KEYS), "PBR recipe fields do not match the v1 allowlist");
    var recipe = clone(input);
    requireValue(recipe.schema === RECIPE_SCHEMA, "PBR recipe schema mismatch");
    requireValue(recipe.version === "1.0.0", "PBR recipe version mismatch");
    requireValue(recipe.authority === "candidate-only", "PBR recipe authority is immutable");
    recipe.id = text(recipe.id, 120, "recipe id");
    requireValue(FAMILIES.indexOf(recipe.family) >= 0, "PBR material family is unsupported");
    recipe.seed = text(recipe.seed, 120, "seed");
    recipe.size = integer(recipe.size, 32, 512, "size");
    recipe.normal_strength = finite(recipe.normal_strength, 0.25, 8, "normal strength");
    return recipe;
  }

  function inspectBundle(result, handoff) {
    requireValue(result && result.schema === RESULT_SCHEMA, "Whole Asset Hand result is required");
    requireValue(result.hand && result.hand.id === HAND_ID && result.hand.version === HAND_VERSION, "pbr-material-bake@1.1.0 result is required");
    requireValue(result.status === "READY" && result.technical && result.technical.pass === true, "Only READY/PASS material results may bind");
    requireValue(result.validation_receipt && result.validation_receipt.status === "PASS", "Material validation receipt must PASS");
    requireValue(handoff && handoff.schema === HANDOFF_SCHEMA && handoff.status === "PASS", "Deterministic material handoff PASS is required");
    requireValue(handoff.hand && handoff.hand.id === HAND_ID && handoff.hand.version === HAND_VERSION, "Material handoff identity mismatch");
    requireValue(handoff.result_digest === result.digest, "Material handoff result digest mismatch");
    requireValue(handoff.authority && handoff.authority.candidate_only === true && handoff.authority.installed === false && handoff.authority.promoted === false && handoff.authority.canonical === false, "Material authority boundary mismatch");
    requireValue(Array.isArray(handoff.pngs) && handoff.pngs.length === 6, "Six gated PNG records are required");
    requireValue(PNG_IDS.every(function (id) { return handoff.pngs.some(function (png) { return png.id === id; }); }), "Material PNG inventory mismatch");
    requireValue(handoff.claims && handoff.claims.dynamic_browser_render_observed === false && handoff.claims.target_renderer_parity === false && handoff.claims.physical_surface_verified === false && handoff.claims.human_aesthetic_approval === false, "Machine handoff must not occupy sensory claims");
    var recipe = parseRecipe(result);
    requireValue(handoff.recipe_digest && /^[0-9a-f]{64}$/i.test(handoff.recipe_digest), "Full recipe SHA-256 is required");
    requireValue(Object.keys(handoff.png_sha256 || {}).length === 6, "Full PNG SHA-256 map is required");
    PNG_IDS.forEach(function (id) {
      requireValue(/^[0-9a-f]{64}$/i.test(handoff.png_sha256[id] || ""), id + " SHA-256 is invalid");
      var artifact = result.artifacts.find(function (item) { return item.id === id; });
      requireValue(artifact && artifact.digest === handoff.artifact_transport_digests[id], id + " transport digest mismatch");
    });
    requireValue(result.target_canvas && result.target_canvas.dimensions && result.target_canvas.dimensions.width === recipe.size && result.target_canvas.dimensions.height === recipe.size, "Recipe and target canvas size must agree");
    return { recipe: recipe, result: result, handoff: handoff };
  }

  function defaultViewer() {
    return {
      geometry: "sphere",
      comparison_source: "current",
      view_mode: "lookdev",
      orbit_deg: 28,
      pitch_deg: 18,
      zoom: 2.8,
      uv_tiling: 2,
      light_azimuth_deg: 42,
      light_elevation_deg: 38,
      light_intensity: 1.35,
      ambient_intensity: 0.22,
      fill_intensity: 0.18,
      exposure: 1,
      background: "studio-dark",
      albedo_enabled: true,
      normal_enabled: true,
      orm_enabled: true,
      emissive_enabled: true,
      high_contrast_ui: false,
      reduced_motion: false
    };
  }

  function normalizeViewer(input) {
    var viewer = Object.assign(defaultViewer(), clone(input || {}));
    requireValue(["sphere", "plane"].indexOf(viewer.geometry) >= 0, "viewer geometry is invalid");
    requireValue(["original", "current"].indexOf(viewer.comparison_source) >= 0, "comparison source is invalid");
    requireValue(["lookdev", "albedo", "normal", "ao", "roughness", "metalness", "emissive", "height"].indexOf(viewer.view_mode) >= 0, "view mode is invalid");
    viewer.orbit_deg = finite(viewer.orbit_deg, -3600, 3600, "orbit");
    viewer.pitch_deg = finite(viewer.pitch_deg, -80, 80, "pitch");
    viewer.zoom = finite(viewer.zoom, 1.4, 8, "zoom");
    viewer.uv_tiling = finite(viewer.uv_tiling, 0.25, 16, "UV tiling");
    viewer.light_azimuth_deg = finite(viewer.light_azimuth_deg, -3600, 3600, "light azimuth");
    viewer.light_elevation_deg = finite(viewer.light_elevation_deg, -10, 90, "light elevation");
    viewer.light_intensity = finite(viewer.light_intensity, 0, 4, "light intensity");
    viewer.ambient_intensity = finite(viewer.ambient_intensity, 0, 2, "ambient intensity");
    viewer.fill_intensity = finite(viewer.fill_intensity, 0, 2, "fill intensity");
    viewer.exposure = finite(viewer.exposure, 0.25, 4, "exposure");
    requireValue(["studio-dark", "studio-light", "neutral-gray", "black"].indexOf(viewer.background) >= 0, "background is invalid");
    ["albedo_enabled", "normal_enabled", "orm_enabled", "emissive_enabled", "high_contrast_ui", "reduced_motion"].forEach(function (key) { viewer[key] = viewer[key] === true; });
    return viewer;
  }

  function viewerStateDigest(viewer) {
    return digest(normalizeViewer(viewer));
  }

  function sessionAuthority() {
    return { candidate_only: true, installed: false, promoted: false, canonical: false, publishes: false };
  }

  function createSession(result, handoff, options) {
    var inspected = inspectBundle(result, handoff);
    var viewer = normalizeViewer(options && options.viewer);
    return {
      schema: SESSION_SCHEMA,
      version: VERSION,
      id: "material-sensory-" + String(result.digest),
      source_result: result,
      current_result: result,
      source_handoff: handoff,
      current_handoff: handoff,
      source_recipe: clone(inspected.recipe),
      current_recipe: clone(inspected.recipe),
      draft_recipe: clone(inspected.recipe),
      source_result_digest: result.digest,
      current_result_digest: result.digest,
      source_recipe_digest: handoff.recipe_digest,
      current_recipe_digest: handoff.recipe_digest,
      viewer: viewer,
      viewer_state_digest: viewerStateDigest(viewer),
      edits: [],
      pending_edit: null,
      last_regeneration_failure: null,
      render_observations: [],
      human_judgment: null,
      stale_review_history: [],
      authority: sessionAuthority()
    };
  }

  function assertSession(session) {
    requireValue(session && session.schema === SESSION_SCHEMA, "Material sensory session is required");
  }

  function staleReview(session, reason, details) {
    if (!session.human_judgment) return session;
    session.stale_review_history = session.stale_review_history.concat([{
      reason: reason,
      details: clone(details || {}),
      stale_at: new Date().toISOString(),
      previous_judgment: clone(session.human_judgment)
    }]);
    session.human_judgment = null;
    return session;
  }

  function applyRecipeEdit(session, field, value) {
    assertSession(session);
    requireValue(["id", "family", "seed", "size", "normal_strength"].indexOf(field) >= 0, "Recipe field is not editable");
    var recipe = clone(session.draft_recipe);
    if (field === "size") value = integer(value, 32, 512, "size");
    else if (field === "normal_strength") value = finite(value, 0.25, 8, "normal strength");
    else if (field === "family") requireValue(FAMILIES.indexOf(value) >= 0, "PBR material family is unsupported");
    else value = text(value, 120, field);
    var before = recipe[field];
    recipe[field] = value;
    recipe = validateRecipe(recipe);
    session.draft_recipe = recipe;
    var changes = session.pending_edit && Array.isArray(session.pending_edit.changes) ? clone(session.pending_edit.changes) : [];
    var existing = changes.find(function (change) { return change.field === field; });
    if (existing) existing.after = value;
    else changes.push({ field: field, before: before, after: value });
    session.pending_edit = { changes: changes, draft_digest: digest(recipe) };
    session.last_regeneration_failure = null;
    return session;
  }

  function replaceDraftRecipe(session, input) {
    assertSession(session);
    session.draft_recipe = validateRecipe(input);
    session.pending_edit = { changes: [{ field: "recipe", before: digest(session.current_recipe), after: digest(session.draft_recipe) }], draft_digest: digest(session.draft_recipe) };
    session.last_regeneration_failure = null;
    return session;
  }

  function cancelPendingEdit(session) {
    assertSession(session);
    session.draft_recipe = clone(session.current_recipe);
    session.pending_edit = null;
    session.last_regeneration_failure = null;
    return session;
  }

  function bindRegeneratedResult(session, result, handoff) {
    assertSession(session);
    var inspected = inspectBundle(result, handoff);
    var previous = { result_digest: session.current_result_digest, recipe_digest: session.current_recipe_digest };
    staleReview(session, "candidate-regenerated", { previous: previous, next: { result_digest: result.digest, recipe_digest: handoff.recipe_digest } });
    if (session.pending_edit) {
      session.edits = session.edits.concat((session.pending_edit.changes || []).map(function (change) {
        return Object.assign({}, clone(change), {
          applied_result_digest: result.digest,
          applied_recipe_digest: handoff.recipe_digest
        });
      }));
    }
    session.current_result = result;
    session.current_handoff = handoff;
    session.current_result_digest = result.digest;
    session.current_recipe_digest = handoff.recipe_digest;
    session.current_recipe = clone(inspected.recipe);
    session.draft_recipe = clone(inspected.recipe);
    session.pending_edit = null;
    session.last_regeneration_failure = null;
    session.render_observations = [];
    return session;
  }

  function recordRegenerationFailure(session, diagnostic) {
    assertSession(session);
    session.last_regeneration_failure = {
      code: text(diagnostic && diagnostic.code || "REGENERATION_FAILED", 120, "failure code"),
      message: String(diagnostic && diagnostic.message || "Material regeneration failed").slice(0, 1000),
      result_status: diagnostic && diagnostic.result_status || null,
      preserved_result_digest: session.current_result_digest,
      preserved_review: !!session.human_judgment,
      attempted_recipe_digest: digest(session.draft_recipe)
    };
    return session;
  }

  function setViewer(session, patch) {
    assertSession(session);
    var before = session.viewer_state_digest;
    var viewer = normalizeViewer(Object.assign({}, session.viewer, clone(patch || {})));
    var after = viewerStateDigest(viewer);
    session.viewer = viewer;
    session.viewer_state_digest = after;
    if (before !== after) staleReview(session, "viewer-state-changed", { previous_viewer_state_digest: before, current_viewer_state_digest: after });
    return session;
  }

  function activeBundle(session) {
    assertSession(session);
    return session.viewer.comparison_source === "original"
      ? { result: session.source_result, handoff: session.source_handoff, recipe: session.source_recipe }
      : { result: session.current_result, handoff: session.current_handoff, recipe: session.current_recipe };
  }

  function recordRenderObservation(session, observation) {
    assertSession(session);
    requireValue(observation && observation.webgl2 === true && observation.dynamic_frame_observed === true, "A dynamic WebGL2 frame observation is required");
    requireValue(observation.result_digest === activeBundle(session).result.digest, "Render observation result digest mismatch");
    requireValue(observation.viewer_state_digest === session.viewer_state_digest, "Render observation viewer state mismatch");
    var event = {
      kind: "dynamic-material-view",
      result_digest: observation.result_digest,
      recipe_digest: activeBundle(session).handoff.recipe_digest,
      viewer_state_digest: session.viewer_state_digest,
      comparison_source: session.viewer.comparison_source,
      geometry: session.viewer.geometry,
      view_mode: session.viewer.view_mode,
      webgl2: true,
      dynamic_frame_observed: true,
      frame_count: Math.max(1, Math.floor(Number(observation.frame_count) || 1)),
      interaction_count: Math.max(0, Math.floor(Number(observation.interaction_count) || 0)),
      renderer_id: text(observation.renderer_id || "axm-material-lookdev-webgl2", 120, "renderer id")
    };
    var key = [event.result_digest, event.viewer_state_digest, event.comparison_source].join(":");
    if (!session.render_observations.some(function (item) { return [item.result_digest, item.viewer_state_digest, item.comparison_source].join(":") === key; })) {
      session.render_observations = session.render_observations.concat([event]);
    }
    return session;
  }

  function hasDynamicObservation(session) {
    assertSession(session);
    var bundle = activeBundle(session);
    return session.render_observations.some(function (item) {
      return item.webgl2 === true && item.dynamic_frame_observed === true && item.result_digest === bundle.result.digest && item.viewer_state_digest === session.viewer_state_digest && item.comparison_source === session.viewer.comparison_source;
    });
  }

  function normalizeObservations(input) {
    var keys = ["tiling_seams", "colour", "normal_response", "roughness_metalness", "emission", "height_coherence", "readability_intended_use"];
    var output = {};
    keys.forEach(function (key) {
      var value = input && input[key] || "UNKNOWN";
      requireValue(OBSERVATION_VALUES.indexOf(value) >= 0, key + " observation is invalid");
      output[key] = value;
    });
    return output;
  }

  function recordHumanJudgment(session, input) {
    assertSession(session);
    var verdict = input && input.verdict;
    requireValue(VERDICTS.indexOf(verdict) >= 0, "Human verdict is invalid");
    var observed = hasDynamicObservation(session);
    var explicitDynamic = input && input.dynamic_view_observed === true;
    if (verdict === "ACCEPT_FOR_TEST") requireValue(observed && explicitDynamic, "ACCEPT_FOR_TEST requires an explicit current dynamic WebGL2 observation");
    var bundle = activeBundle(session);
    session.human_judgment = {
      reviewer: text(input && input.reviewer, 160, "reviewer"),
      verdict: verdict,
      dynamic_view_observed: explicitDynamic && observed,
      observations: normalizeObservations(input && input.observations),
      notes: String(input && input.notes || "").slice(0, 3000),
      result_digest: bundle.result.digest,
      recipe_digest: bundle.handoff.recipe_digest,
      png_sha256: clone(bundle.handoff.png_sha256),
      sampling_contract_digest: bundle.handoff.sampling_contract_digest,
      viewer_state_digest: session.viewer_state_digest,
      comparison_source: session.viewer.comparison_source,
      authority: "human-report-only"
    };
    return session;
  }

  function createReceipt(session) {
    assertSession(session);
    requireValue(session.human_judgment, "Human judgment is required");
    var bundle = activeBundle(session);
    var observations = session.render_observations.filter(function (item) {
      return item.result_digest === bundle.result.digest && item.viewer_state_digest === session.viewer_state_digest && item.comparison_source === session.viewer.comparison_source;
    });
    var receipt = {
      schema: REVIEW_SCHEMA,
      version: VERSION,
      id: session.id + "-review",
      session_id: session.id,
      modality: "visual-material",
      source: { result_digest: session.source_result_digest, recipe_digest: session.source_recipe_digest },
      candidate: {
        result_digest: bundle.result.digest,
        recipe_digest: bundle.handoff.recipe_digest,
        recipe_artifact_digest: bundle.handoff.recipe_artifact_digest,
        receipt_artifact_digest: bundle.handoff.receipt_artifact_digest,
        artifact_transport_digests: clone(bundle.handoff.artifact_transport_digests),
        png_sha256: clone(bundle.handoff.png_sha256),
        sampling_contract_digest: bundle.handoff.sampling_contract_digest
      },
      viewer: clone(session.viewer),
      viewer_state_digest: session.viewer_state_digest,
      render_observation: {
        dynamic_webgl2_observed: observations.length > 0,
        event_count: observations.length,
        events: clone(observations),
        target_renderer_parity_verified: false,
        physical_surface_verified: false,
        representative_gpu_verified: false
      },
      human_judgment: clone(session.human_judgment),
      runtime: {
        id: "asset-material-sensory-workbench",
        version: VERSION,
        renderer: "tool-local-webgl2-lookdev",
        shading_scope: "bounded-direct-light-reference",
        ibl: false,
        glb_binding: false,
        height_displacement: false
      },
      authority: clone(session.authority),
      truth: "This receipt binds a human material report to exact deterministic PNG bytes, sampling metadata, a local viewer state and observed WebGL2 frames. It does not prove target-engine parity, physical surface behavior, representative-device performance, accessibility conformance, installation, promotion or canon."
    };
    receipt.digest = digest(receipt);
    return receipt;
  }

  function sourceArtifact(session) {
    assertSession(session);
    var recipe = validateRecipe(session.draft_recipe);
    return {
      schema: "axm.asset-source-artifact/v1",
      id: "pbr-material-recipe-source",
      role: "editable-pbr-material-recipe",
      name: "Editable PBR material recipe",
      mime: "application/json",
      format: "JSON",
      content_schema: RECIPE_SCHEMA,
      editable: true,
      text: canonicalStringify(recipe),
      dataUrl: "",
      digest: digest(recipe),
      metadata: { schema: RECIPE_SCHEMA, session_digest_only: true }
    };
  }

  function machinePatch(session) {
    assertSession(session);
    var patch = {
      schema: PATCH_SCHEMA,
      version: VERSION,
      session_id: session.id,
      source_result_digest: session.source_result_digest,
      current_result_digest: session.current_result_digest,
      source_recipe_digest: session.source_recipe_digest,
      current_recipe_digest: session.current_recipe_digest,
      draft_recipe_digest: digest(session.draft_recipe),
      source_artifact: sourceArtifact(session),
      target_canvas_patch: { dimensions: { width: session.draft_recipe.size, height: session.draft_recipe.size, unit: "px" } },
      edits: clone(session.edits),
      pending_edit: clone(session.pending_edit),
      viewer_state_digest: session.viewer_state_digest,
      viewer_state_is_source_neutral: true,
      stale_review_history: clone(session.stale_review_history),
      authority: clone(session.authority),
      truth: "Candidate-only material edit packet. Viewer state is source-neutral and applying this packet cannot install, bind, promote, approve or canonize a material."
    };
    patch.digest = digest(patch);
    return patch;
  }

  function resetViewer(session) {
    assertSession(session);
    return setViewer(session, defaultViewer());
  }

  return {
    VERSION: VERSION,
    SESSION_SCHEMA: SESSION_SCHEMA,
    RESULT_SCHEMA: RESULT_SCHEMA,
    HANDOFF_SCHEMA: HANDOFF_SCHEMA,
    RECIPE_SCHEMA: RECIPE_SCHEMA,
    REVIEW_SCHEMA: REVIEW_SCHEMA,
    PATCH_SCHEMA: PATCH_SCHEMA,
    HAND_ID: HAND_ID,
    HAND_VERSION: HAND_VERSION,
    FAMILIES: FAMILIES.slice(),
    PNG_IDS: PNG_IDS.slice(),
    canonicalStringify: canonicalStringify,
    digest: digest,
    validateRecipe: validateRecipe,
    inspectBundle: inspectBundle,
    defaultViewer: defaultViewer,
    normalizeViewer: normalizeViewer,
    viewerStateDigest: viewerStateDigest,
    createSession: createSession,
    applyRecipeEdit: applyRecipeEdit,
    replaceDraftRecipe: replaceDraftRecipe,
    cancelPendingEdit: cancelPendingEdit,
    bindRegeneratedResult: bindRegeneratedResult,
    recordRegenerationFailure: recordRegenerationFailure,
    setViewer: setViewer,
    activeBundle: activeBundle,
    recordRenderObservation: recordRenderObservation,
    hasDynamicObservation: hasDynamicObservation,
    recordHumanJudgment: recordHumanJudgment,
    createReceipt: createReceipt,
    sourceArtifact: sourceArtifact,
    machinePatch: machinePatch,
    resetViewer: resetViewer
  };
});
