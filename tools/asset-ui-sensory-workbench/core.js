(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AXMUISensoryCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";
  var SESSION_SCHEMA = "axm.asset-ui-sensory-session/v1";
  var RESULT_SCHEMA = "axm.asset-hand-result/v1";
  var HANDOFF_SCHEMA = "axm.deterministic-ui-handoff/v1";
  var RECIPE_SCHEMA = "axm.ui-component-recipe/v1";
  var SPEC_SCHEMA = "axm.ui-component-spec/v1";
  var VIEWER_SCHEMA = "axm.ui-sensory-viewer-state/v1";
  var REVIEW_SCHEMA = "axm.ui-sensory-review-receipt/v1";
  var PATCH_SCHEMA = "axm.ui-machine-patch/v1";
  var HAND_ID = "ui-component";
  var HAND_VERSION = "1.2.0";
  var STATES = ["default", "hover", "active", "disabled"];
  var DECISIONS = ["hold", "accept-candidate", "reject-candidate"];
  var MODES = ["raw", "nine-slice"];
  var BACKGROUNDS = ["dark", "light", "checker", "game"];
  var SAFE_AREAS = ["none", "mobile", "tv"];
  var INPUT_JOURNEYS = ["none", "pointer", "keyboard", "simulated-gamepad"];

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      var output = {};
      Object.keys(value).sort().forEach(function (key) { output[key] = stable(value[key]); });
      return output;
    }
    return value;
  }
  function canonical(value) { return JSON.stringify(stable(value)); }
  function digest(value) {
    var textValue = typeof value === "string" ? value : canonical(value);
    var hash = 0x811c9dc5;
    for (var index = 0; index < textValue.length; index += 1) {
      hash ^= textValue.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return "fnv1a32:" + (hash >>> 0).toString(16).padStart(8, "0");
  }
  function requireValue(condition, message) { if (!condition) throw new Error(message); }
  function number(value, minimum, maximum, label) {
    var output = Number(value);
    requireValue(Number.isFinite(output) && output >= minimum && output <= maximum, label + " must be within " + minimum + ".." + maximum);
    return output;
  }
  function text(value, maximum, label) {
    var output = String(value == null ? "" : value).trim();
    requireValue(output.length > 0 && output.length <= maximum, label + " must contain 1.." + maximum + " characters");
    return output;
  }
  function exactKeys(value, keys, label) {
    requireValue(value && typeof value === "object" && !Array.isArray(value), label + " object is required");
    requireValue(canonical(Object.keys(value).sort()) === canonical(keys.slice().sort()), label + " fields do not match the v1 allowlist");
  }
  function colour(value, label) {
    requireValue(/^#[0-9a-f]{6}$/i.test(String(value || "")), label + " must be #RRGGBB");
    return String(value).toUpperCase();
  }

  function validateRecipe(input) {
    var recipe = clone(input);
    exactKeys(recipe, ["schema", "version", "id", "title", "kind", "seed", "authority", "target", "palette", "geometry", "states", "provenance"], "recipe");
    requireValue(recipe.schema === RECIPE_SCHEMA && recipe.version === "1.0.0", "UI recipe schema/version mismatch");
    requireValue(recipe.authority === "candidate-only", "UI recipe authority is immutable");
    recipe.id = text(recipe.id, 100, "recipe id");
    recipe.title = text(recipe.title, 120, "recipe title");
    requireValue(["panel", "button", "hud", "ui-component"].indexOf(recipe.kind) >= 0, "UI component kind is unsupported");
    recipe.seed = text(recipe.seed, 180, "recipe seed");
    exactKeys(recipe.target, ["medium", "dimensions", "transparency", "minimum_contrast_ratio", "direction", "input_modalities", "reduced_motion", "minimum_target_size", "alternative_text", "focus_visible", "focus_ring"], "recipe target");
    requireValue(["ui", "screen", "game-world"].indexOf(recipe.target.medium) >= 0, "target medium is unsupported");
    exactKeys(recipe.target.dimensions, ["width", "height", "unit"], "target dimensions");
    recipe.target.dimensions.width = number(recipe.target.dimensions.width, 1, 8192, "width");
    recipe.target.dimensions.height = number(recipe.target.dimensions.height, 1, 8192, "height");
    requireValue(recipe.target.dimensions.unit === "px", "target dimensions must use px");
    requireValue(["required", "allowed", "opaque"].indexOf(recipe.target.transparency) >= 0, "transparency is unsupported");
    recipe.target.minimum_contrast_ratio = number(recipe.target.minimum_contrast_ratio, 1, 21, "minimum contrast");
    requireValue(["ltr", "rtl", "auto"].indexOf(recipe.target.direction) >= 0, "direction is unsupported");
    requireValue(Array.isArray(recipe.target.input_modalities) && new Set(recipe.target.input_modalities).size === recipe.target.input_modalities.length, "input modalities must be a unique array");
    recipe.target.input_modalities.forEach(function (item) { requireValue(["pointer", "keyboard", "touch", "gamepad"].indexOf(item) >= 0, "input modality is unsupported"); });
    recipe.target.reduced_motion = recipe.target.reduced_motion === true;
    recipe.target.minimum_target_size = number(recipe.target.minimum_target_size, 1, 1000, "minimum target size");
    recipe.target.alternative_text = recipe.target.alternative_text === true;
    recipe.target.focus_visible = recipe.target.focus_visible === true;
    exactKeys(recipe.target.focus_ring, ["colour", "width"], "focus ring");
    recipe.target.focus_ring.colour = colour(recipe.target.focus_ring.colour, "focus ring colour");
    recipe.target.focus_ring.width = number(recipe.target.focus_ring.width, 1, 16, "focus ring width");
    exactKeys(recipe.palette, ["surface", "accent", "foreground", "attention"], "palette");
    Object.keys(recipe.palette).forEach(function (key) { recipe.palette[key] = colour(recipe.palette[key], key); });
    exactKeys(recipe.geometry, ["inset", "radius", "nine_slice"], "geometry");
    recipe.geometry.inset = number(recipe.geometry.inset, 0, 8192, "inset");
    recipe.geometry.radius = number(recipe.geometry.radius, 0, Math.min(recipe.target.dimensions.width, recipe.target.dimensions.height) / 2, "radius");
    exactKeys(recipe.geometry.nine_slice, ["left", "top", "right", "bottom"], "nine slice");
    Object.keys(recipe.geometry.nine_slice).forEach(function (key) { recipe.geometry.nine_slice[key] = number(recipe.geometry.nine_slice[key], 0, 8192, "nine-slice " + key); });
    requireValue(recipe.geometry.inset * 2 < recipe.target.dimensions.width && recipe.geometry.inset * 2 < recipe.target.dimensions.height, "inset must leave positive inner geometry");
    requireValue(recipe.geometry.nine_slice.left + recipe.geometry.nine_slice.right < recipe.target.dimensions.width, "horizontal nine-slice centre must remain positive");
    requireValue(recipe.geometry.nine_slice.top + recipe.geometry.nine_slice.bottom < recipe.target.dimensions.height, "vertical nine-slice centre must remain positive");
    exactKeys(recipe.states, STATES, "states");
    STATES.forEach(function (state) {
      exactKeys(recipe.states[state], ["opacity", "scale"], state + " state");
      recipe.states[state].opacity = number(recipe.states[state].opacity, 0, 1, state + " opacity");
      recipe.states[state].scale = number(recipe.states[state].scale, 0.85, 1.15, state + " scale");
      if (recipe.target.reduced_motion) requireValue(recipe.states[state].scale === 1, "reduced motion requires every state scale to equal 1");
    });
    requireValue(recipe.provenance === null || (recipe.provenance && recipe.provenance.operation === "edit" && recipe.provenance.source_artifact_id === "ui-recipe" && typeof recipe.provenance.source_recipe_digest === "string"), "recipe provenance is invalid");
    return recipe;
  }

  function artifact(result, id) {
    return result.artifacts.find(function (item) { return item.id === id; });
  }
  function parseArtifact(result, id, label) {
    var item = artifact(result, id);
    requireValue(item && typeof item.text === "string", label + " artifact is required");
    try { return JSON.parse(item.text); }
    catch (_error) { throw new Error(label + " is not valid JSON"); }
  }
  function inspectBundle(result, handoff) {
    requireValue(result && result.schema === RESULT_SCHEMA && Array.isArray(result.artifacts), "Whole UI Asset Hand result is required");
    requireValue(result.hand && result.hand.id === HAND_ID && result.hand.version === HAND_VERSION, "ui-component@1.2.0 result is required");
    requireValue(result.status === "READY" && result.technical && result.technical.pass === true, "Only READY/PASS UI results may bind");
    requireValue(result.validation_receipt && result.validation_receipt.status === "PASS", "UI validation receipt must PASS");
    requireValue(handoff && handoff.schema === HANDOFF_SCHEMA && handoff.version === "1.0.0" && handoff.status === "PASS", "Deterministic UI handoff PASS is required");
    requireValue(handoff.hand && handoff.hand.id === HAND_ID && handoff.hand.version === HAND_VERSION && handoff.result_digest === result.digest, "UI handoff identity/digest mismatch");
    requireValue(handoff.authority && handoff.authority.candidate_only === true && handoff.authority.installed === false && handoff.authority.promoted === false && handoff.authority.canonical === false, "UI authority boundary mismatch");
    requireValue(result.artifacts.length === 3 && ["ui-source", "ui-metadata", "ui-recipe"].every(function (id) { return !!artifact(result, id); }), "Exact three-artifact UI transaction is required");
    var recipe = validateRecipe(parseArtifact(result, "ui-recipe", "UI recipe"));
    var metadata = parseArtifact(result, "ui-metadata", "UI metadata");
    requireValue(metadata.schema === SPEC_SCHEMA, "UI metadata schema mismatch");
    requireValue(handoff.recipe_digest && /^[0-9a-f]{64}$/i.test(handoff.recipe_digest), "Full UI recipe SHA-256 is required");
    ["ui-source", "ui-metadata", "ui-recipe"].forEach(function (id) {
      requireValue(/^[0-9a-f]{64}$/i.test(handoff.artifact_sha256 && handoff.artifact_sha256[id] || ""), id + " full SHA-256 is invalid");
      requireValue(artifact(result, id).digest === handoff.artifact_transport_digests[id], id + " transport digest mismatch");
    });
    requireValue(handoff.preview && handoff.preview.static_visual_only === true && handoff.preview.interactive_state_proof === false && handoff.preview.nine_slice_runtime_proof === false, "Static preview truth boundary is required");
    requireValue(handoff.claims && handoff.claims.interactive_browser_journey_observed === false && handoff.claims.human_aesthetic_approval === false && handoff.claims.target_runtime_parity === false, "Machine handoff must not occupy human evidence seats");
    return { result: result, handoff: handoff, recipe: recipe, metadata: metadata, svg: artifact(result, "ui-source").text };
  }

  function defaultViewer(recipe) {
    recipe = recipe || { target: { dimensions: { width: 480, height: 240 }, reduced_motion: false } };
    return {
      schema: VIEWER_SCHEMA,
      render_mode: "raw",
      component_state: "default",
      stretch_width: recipe.target.dimensions.width,
      stretch_height: recipe.target.dimensions.height,
      zoom_percent: 100,
      background: "dark",
      contrast_mode: "normal",
      safe_area: "none",
      focus_visible: false,
      input_journey: "none",
      reduced_motion_preference: recipe.target.reduced_motion === true,
      comparison_source: "current"
    };
  }
  function normalizeViewer(input, recipe) {
    var viewer = Object.assign(defaultViewer(recipe), clone(input || {}));
    viewer.schema = VIEWER_SCHEMA;
    requireValue(MODES.indexOf(viewer.render_mode) >= 0, "render mode is invalid");
    requireValue(STATES.indexOf(viewer.component_state) >= 0, "component state is invalid");
    viewer.stretch_width = number(viewer.stretch_width, 1, 8192, "stretch width");
    viewer.stretch_height = number(viewer.stretch_height, 1, 8192, "stretch height");
    viewer.zoom_percent = number(viewer.zoom_percent, 25, 400, "zoom percent");
    requireValue(BACKGROUNDS.indexOf(viewer.background) >= 0, "background is invalid");
    requireValue(["normal", "high"].indexOf(viewer.contrast_mode) >= 0, "contrast mode is invalid");
    requireValue(SAFE_AREAS.indexOf(viewer.safe_area) >= 0, "safe-area mode is invalid");
    viewer.focus_visible = viewer.focus_visible === true;
    requireValue(INPUT_JOURNEYS.indexOf(viewer.input_journey) >= 0, "input journey is invalid");
    viewer.reduced_motion_preference = viewer.reduced_motion_preference === true;
    requireValue(["original", "current"].indexOf(viewer.comparison_source) >= 0, "comparison source is invalid");
    return viewer;
  }
  function viewerStateDigest(viewer, resultDigest, recipe) {
    return digest({ result_digest: resultDigest, viewer: normalizeViewer(viewer, recipe) });
  }
  function authority() { return { candidate_only: true, installed: false, promoted: false, canonical: false, publishes: false }; }
  function staleReview(session, reason, details) {
    if (!session.human_judgment) return;
    session.stale_review_history.push({ reason: reason, details: clone(details || {}), stale_at: new Date().toISOString(), previous_judgment: clone(session.human_judgment) });
    session.human_judgment = null;
  }
  function createSession(result, handoff, options) {
    var bundle = inspectBundle(result, handoff);
    var viewer = normalizeViewer(options && options.viewer, bundle.recipe);
    return {
      schema: SESSION_SCHEMA,
      version: VERSION,
      id: "ui-sensory-" + result.digest,
      source_result: result,
      current_result: result,
      source_handoff: handoff,
      current_handoff: handoff,
      source_recipe: clone(bundle.recipe),
      current_recipe: clone(bundle.recipe),
      draft_recipe: clone(bundle.recipe),
      source_metadata: clone(bundle.metadata),
      current_metadata: clone(bundle.metadata),
      current_svg: bundle.svg,
      source_result_digest: result.digest,
      current_result_digest: result.digest,
      source_recipe_digest: handoff.recipe_digest,
      current_recipe_digest: handoff.recipe_digest,
      viewer: viewer,
      viewer_state_digest: viewerStateDigest(viewer, result.digest, bundle.recipe),
      comparison_history: [],
      pending_edit: null,
      applied_edits: [],
      last_regeneration_failure: null,
      journey_events: [],
      human_judgment: null,
      stale_review_history: [],
      diagnostics: [],
      authority: authority()
    };
  }
  function assertSession(session) { requireValue(session && session.schema === SESSION_SCHEMA, "UI sensory session is required"); }
  function replaceDraftRecipe(session, input) {
    assertSession(session);
    var recipe = validateRecipe(input);
    session.draft_recipe = recipe;
    session.pending_edit = { before_digest: digest(session.current_recipe), after_digest: digest(recipe), recipe: clone(recipe) };
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
    var next = inspectBundle(result, handoff);
    var previous = { result: session.current_result, handoff: session.current_handoff, recipe: session.current_recipe, metadata: session.current_metadata };
    staleReview(session, "candidate-regenerated", { previous_result_digest: session.current_result_digest, next_result_digest: result.digest });
    session.comparison_history.push({ result_digest: session.current_result_digest, recipe_digest: session.current_recipe_digest, result: previous.result, handoff: previous.handoff, recipe: clone(previous.recipe), metadata: clone(previous.metadata) });
    if (session.comparison_history.length > 8) session.comparison_history.shift();
    if (session.pending_edit) session.applied_edits.push(clone(session.pending_edit));
    session.current_result = result;
    session.current_handoff = handoff;
    session.current_result_digest = result.digest;
    session.current_recipe_digest = handoff.recipe_digest;
    session.current_recipe = clone(next.recipe);
    session.draft_recipe = clone(next.recipe);
    session.current_metadata = clone(next.metadata);
    session.current_svg = next.svg;
    session.pending_edit = null;
    session.last_regeneration_failure = null;
    session.journey_events = [];
    session.viewer = normalizeViewer(Object.assign({}, session.viewer, { stretch_width: next.recipe.target.dimensions.width, stretch_height: next.recipe.target.dimensions.height }), next.recipe);
    session.viewer_state_digest = viewerStateDigest(session.viewer, result.digest, next.recipe);
    return session;
  }
  function recordRegenerationFailure(session, diagnostic) {
    assertSession(session);
    var event = {
      code: String(diagnostic && diagnostic.code || "REGENERATION_FAILED").slice(0, 120),
      message: String(diagnostic && diagnostic.message || "UI regeneration failed").slice(0, 1000),
      result_status: diagnostic && diagnostic.result_status || null,
      preserved_result_digest: session.current_result_digest,
      attempted_recipe_digest: digest(session.draft_recipe),
      at: new Date().toISOString()
    };
    session.last_regeneration_failure = event;
    session.diagnostics.push(event);
    return session;
  }
  function setViewer(session, patch) {
    assertSession(session);
    var before = session.viewer_state_digest;
    session.viewer = normalizeViewer(Object.assign({}, session.viewer, clone(patch || {})), session.current_recipe);
    session.viewer_state_digest = viewerStateDigest(session.viewer, session.current_result_digest, session.current_recipe);
    if (before !== session.viewer_state_digest) staleReview(session, "viewer-state-changed", { previous_viewer_state_digest: before, current_viewer_state_digest: session.viewer_state_digest });
    return session;
  }
  function activeBundle(session) {
    assertSession(session);
    if (session.viewer.comparison_source === "original") return { result: session.source_result, handoff: session.source_handoff, recipe: session.source_recipe, metadata: session.source_metadata, svg: artifact(session.source_result, "ui-source").text };
    return { result: session.current_result, handoff: session.current_handoff, recipe: session.current_recipe, metadata: session.current_metadata, svg: session.current_svg };
  }
  function recordJourneyEvent(session, kind, details) {
    assertSession(session);
    requireValue(["render", "state", "mode", "zoom", "background", "safe-area", "pointer", "keyboard", "simulated-gamepad", "reduced-motion"].indexOf(kind) >= 0, "journey event kind is invalid");
    var event = {
      kind: kind,
      result_digest: session.current_result_digest,
      recipe_digest: session.current_recipe_digest,
      viewer_state_digest: session.viewer_state_digest,
      viewer: clone(session.viewer),
      details: clone(details || {}),
      observed_at: new Date().toISOString(),
      browser_observation: true,
      human_approval: false
    };
    session.journey_events.push(event);
    return event;
  }
  function journeyReadiness(session) {
    assertSession(session);
    var events = session.journey_events.filter(function (event) { return event.result_digest === session.current_result_digest; });
    var states = new Set(events.filter(function (event) { return event.kind === "state"; }).map(function (event) { return event.viewer.component_state; }));
    var raw = events.some(function (event) { return (event.kind === "mode" || event.kind === "render") && event.viewer.render_mode === "raw"; });
    var nineOriginal = events.some(function (event) { return (event.kind === "mode" || event.kind === "render") && event.viewer.render_mode === "nine-slice" && event.viewer.stretch_width === session.current_recipe.target.dimensions.width && event.viewer.stretch_height === session.current_recipe.target.dimensions.height; });
    var nineStretched = events.some(function (event) { return (event.kind === "mode" || event.kind === "render") && event.viewer.render_mode === "nine-slice" && (event.viewer.stretch_width / event.viewer.stretch_height !== session.current_recipe.target.dimensions.width / session.current_recipe.target.dimensions.height); });
    var zoom100 = events.some(function (event) { return event.kind === "zoom" && event.viewer.zoom_percent === 100; });
    var zoom200 = events.some(function (event) { return event.kind === "zoom" && event.viewer.zoom_percent === 200; });
    var dark = events.some(function (event) { return event.kind === "background" && event.viewer.background === "dark"; });
    var light = events.some(function (event) { return event.kind === "background" && event.viewer.background === "light"; });
    var pointer = events.some(function (event) { return event.kind === "pointer"; });
    var keyboard = events.some(function (event) { return event.kind === "keyboard" && event.viewer.focus_visible === true; });
    var safeArea = events.some(function (event) { return event.kind === "safe-area" && event.viewer.safe_area !== "none"; });
    var reduced = events.some(function (event) { return event.kind === "reduced-motion"; });
    var checks = {
      all_states: STATES.every(function (state) { return states.has(state); }),
      raw_original: raw,
      nine_slice_original: nineOriginal,
      nine_slice_stretched: nineStretched,
      zoom_100: zoom100,
      zoom_200: zoom200,
      dark_background: dark,
      light_background: light,
      pointer_journey: pointer,
      keyboard_focus_journey: keyboard,
      safe_area_overlay: safeArea,
      reduced_motion_observed: reduced
    };
    return { pass: Object.keys(checks).every(function (key) { return checks[key]; }), checks: checks, event_count: events.length, simulated_gamepad_only: events.some(function (event) { return event.kind === "simulated-gamepad"; }) };
  }
  function recordHumanJudgment(session, input) {
    assertSession(session);
    var decision = input && input.decision;
    requireValue(DECISIONS.indexOf(decision) >= 0, "human decision is invalid");
    var readiness = journeyReadiness(session);
    if (decision === "accept-candidate") requireValue(readiness.pass, "accept-candidate requires the complete current browser journey");
    session.human_judgment = {
      reviewer: text(input && input.reviewer, 160, "reviewer"),
      decision: decision,
      notes: String(input && input.notes || "").slice(0, 3000),
      result_digest: session.current_result_digest,
      recipe_digest: session.current_recipe_digest,
      viewer_state_digest: session.viewer_state_digest,
      readiness: readiness,
      authority: "human-report-only"
    };
    return session;
  }
  function createReceipt(session) {
    assertSession(session);
    requireValue(session.human_judgment, "explicit human judgment is required");
    var readiness = journeyReadiness(session);
    var receipt = {
      schema: REVIEW_SCHEMA,
      version: VERSION,
      id: session.id + "-review-" + String(session.stale_review_history.length + 1),
      candidate: {
        result_digest: session.current_result_digest,
        recipe_digest: session.current_recipe_digest,
        artifact_sha256: clone(session.current_handoff.artifact_sha256),
        artifact_transport_digests: clone(session.current_handoff.artifact_transport_digests)
      },
      viewer: clone(session.viewer),
      viewer_state_digest: session.viewer_state_digest,
      journey: { readiness: readiness, events: clone(session.journey_events) },
      human_judgment: clone(session.human_judgment),
      claims: {
        browser_wrapper_observed: session.journey_events.length > 0,
        all_states_observed: readiness.checks.all_states,
        nine_slice_browser_observed: readiness.checks.nine_slice_original && readiness.checks.nine_slice_stretched,
        pointer_observed: readiness.checks.pointer_journey,
        keyboard_focus_observed: readiness.checks.keyboard_focus_journey,
        simulated_gamepad_observed: readiness.simulated_gamepad_only,
        physical_touch_or_gamepad_verified: false,
        assistive_technology_verified: false,
        target_runtime_parity: false,
        representative_device_performance_verified: false,
        localization_verified: false,
        external_conformance_verified: false
      },
      authority: clone(session.authority),
      truth: "Candidate-only human report bound to exact UI artifact bytes and viewer state. Browser state and nine-slice observation do not prove physical input, assistive technology, target-runtime parity, performance, localization, installation, promotion or canon."
    };
    receipt.digest = digest(receipt);
    return receipt;
  }
  function sourceArtifact(session) {
    assertSession(session);
    var recipe = validateRecipe(session.draft_recipe);
    return {
      schema: "axm.asset-source-artifact/v1",
      id: "ui-recipe",
      role: "editable-ui-recipe",
      name: "Editable UI component recipe",
      mime: "application/json",
      format: "JSON",
      content_schema: RECIPE_SCHEMA,
      editable: true,
      text: canonical(recipe),
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
      source_result_digest: session.source_result_digest,
      current_result_digest: session.current_result_digest,
      current_recipe_digest: session.current_recipe_digest,
      draft_recipe_digest: digest(session.draft_recipe),
      source_artifact: sourceArtifact(session),
      viewer_state_digest: session.viewer_state_digest,
      viewer_state_is_source_neutral: true,
      authority: clone(session.authority)
    };
    patch.digest = digest(patch);
    return patch;
  }

  return {
    VERSION: VERSION,
    SESSION_SCHEMA: SESSION_SCHEMA,
    HANDOFF_SCHEMA: HANDOFF_SCHEMA,
    RECIPE_SCHEMA: RECIPE_SCHEMA,
    VIEWER_SCHEMA: VIEWER_SCHEMA,
    REVIEW_SCHEMA: REVIEW_SCHEMA,
    PATCH_SCHEMA: PATCH_SCHEMA,
    HAND_ID: HAND_ID,
    HAND_VERSION: HAND_VERSION,
    STATES: STATES.slice(),
    canonical: canonical,
    digest: digest,
    validateRecipe: validateRecipe,
    inspectBundle: inspectBundle,
    defaultViewer: defaultViewer,
    normalizeViewer: normalizeViewer,
    viewerStateDigest: viewerStateDigest,
    createSession: createSession,
    replaceDraftRecipe: replaceDraftRecipe,
    cancelPendingEdit: cancelPendingEdit,
    bindRegeneratedResult: bindRegeneratedResult,
    recordRegenerationFailure: recordRegenerationFailure,
    setViewer: setViewer,
    activeBundle: activeBundle,
    recordJourneyEvent: recordJourneyEvent,
    journeyReadiness: journeyReadiness,
    recordHumanJudgment: recordHumanJudgment,
    createReceipt: createReceipt,
    sourceArtifact: sourceArtifact,
    machinePatch: machinePatch
  };
});
