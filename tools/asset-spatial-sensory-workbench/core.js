(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AXMSpatialSensoryCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";
  var SESSION_SCHEMA = "axm.asset-spatial-sensory-session/v1";
  var RESULT_SCHEMA = "axm.asset-hand-result/v1";
  var HANDOFF_SCHEMA = "axm.deterministic-spatial-handoff/v1";
  var PROJECT_SCHEMA = "axm.spatial.project/v1";
  var EDIT_SCHEMA = "axm.spatial-sensory-edit/v1";
  var VIEWER_SCHEMA = "axm.spatial-sensory-viewer-state/v1";
  var REVIEW_SCHEMA = "axm.spatial-sensory-review-receipt/v1";
  var HAND_ID = "parametric-mesh";
  var HAND_VERSION = "1.1.0";
  var PRIMITIVES = ["cube", "sphere", "cylinder", "cone", "plane", "torus"];
  var VERDICTS = ["ACCEPT_FOR_TEST", "NEEDS_CHANGES", "REJECT"];
  var PRESETS = ["front", "side", "top", "home"];
  var REQUIRED_ARTIFACTS = ["mesh-obj", "mesh-glb", "spatial-project", "mesh-preview"];

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
  function canonicalStringify(value) { return JSON.stringify(stable(value)); }
  function digest(value) {
    var input = typeof value === "string" ? value : canonicalStringify(value);
    var hash = 0x811c9dc5;
    for (var index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return "fnv1a32:" + (hash >>> 0).toString(16).padStart(8, "0");
  }
  function requireValue(condition, message) { if (!condition) throw new Error(message); }
  function finite(value, minimum, maximum, label) {
    var number = Number(value);
    requireValue(Number.isFinite(number) && number >= minimum && number <= maximum, label + " must be within " + minimum + ".." + maximum);
    return number;
  }
  function integer(value, minimum, maximum, label) {
    var number = finite(value, minimum, maximum, label);
    requireValue(Number.isInteger(number), label + " must be an integer");
    return number;
  }
  function text(value, maximum, label, allowEmpty) {
    var output = String(value == null ? "" : value).trim();
    requireValue((allowEmpty || output.length > 0) && output.length <= maximum, label + " is invalid");
    return output;
  }
  function vector(value, minimum, maximum, label) {
    requireValue(Array.isArray(value) && value.length === 3, label + " must be a three-number vector");
    return value.map(function (item, index) { return finite(item, minimum, maximum, label + "[" + index + "]"); });
  }
  function hex(value, label) {
    value = String(value || "");
    requireValue(/^#[0-9a-f]{6}$/i.test(value), label + " must be #RRGGBB");
    return value.toLowerCase();
  }
  function findArtifact(result, id) {
    return result.artifacts.find(function (artifact) { return artifact.id === id; });
  }
  function parseProject(result) {
    var artifact = findArtifact(result, "spatial-project");
    requireValue(artifact && artifact.metadata && artifact.metadata.schema === PROJECT_SCHEMA && typeof artifact.text === "string", "Editable spatial project artifact is required");
    var project;
    try { project = JSON.parse(artifact.text); }
    catch (_error) { throw new Error("Editable spatial project is not valid JSON"); }
    requireValue(project.format === PROJECT_SCHEMA && project.version === 1 && project.objects.length === 1 && project.materials.length === 1, "Bounded one-object spatial project is required");
    return project;
  }

  function inspectBundle(result, handoff) {
    requireValue(result && result.schema === RESULT_SCHEMA, "Whole Asset Hand result is required");
    requireValue(result.hand && result.hand.id === HAND_ID && result.hand.version === HAND_VERSION, "parametric-mesh@1.1.0 result is required");
    requireValue(result.status === "READY" && result.technical && result.technical.pass === true, "Only READY/PASS spatial results may bind");
    requireValue(result.validation_receipt && result.validation_receipt.status === "PASS", "Spatial validation receipt must PASS");
    requireValue(Array.isArray(result.artifacts) && result.artifacts.length === 4 && REQUIRED_ARTIFACTS.every(function (id) { return !!findArtifact(result, id); }), "Exact four-artifact spatial result is required");
    requireValue(handoff && handoff.schema === HANDOFF_SCHEMA && handoff.version === "1.0.0" && handoff.status === "PASS", "Deterministic spatial handoff PASS is required");
    requireValue(handoff.hand && handoff.hand.id === HAND_ID && handoff.hand.version === HAND_VERSION && handoff.result_digest === result.digest, "Spatial handoff identity/result mismatch");
    requireValue(handoff.preview && handoff.preview.artifact_id === "mesh-preview" && handoff.preview.static_proof_only === true && handoff.preview.dynamic_spatial_evidence === false, "Static preview boundary mismatch");
    requireValue(handoff.project_profile && handoff.project_profile.one_visible_unlocked_object === true && handoff.project_profile.one_referenced_material === true, "Bounded project profile mismatch");
    requireValue(handoff.coordinate_system && handoff.coordinate_system.handedness === "right-handed" && handoff.coordinate_system.up_axis === "Y" && handoff.coordinate_system.linear_unit === "metre", "Coordinate contract mismatch");
    requireValue(handoff.edit_controls && handoff.edit_controls.source_master === "spatial-project" && handoff.edit_controls.primitive.direct_project_field_authoritative === false, "Edit-master contract mismatch");
    requireValue(handoff.authority && handoff.authority.candidate_only === true && handoff.authority.installed === false && handoff.authority.promoted === false && handoff.authority.canonical === false, "Spatial authority boundary mismatch");
    requireValue(handoff.claims && handoff.claims.dynamic_browser_render_observed === false && handoff.claims.target_renderer_parity === false && handoff.claims.physical_scale_verified === false && handoff.claims.human_aesthetic_approval === false, "Machine handoff must not occupy human evidence seats");
    REQUIRED_ARTIFACTS.forEach(function (id) {
      requireValue(/^[0-9a-f]{64}$/i.test(handoff.artifact_sha256 && handoff.artifact_sha256[id] || ""), id + " full SHA-256 is required");
      requireValue(findArtifact(result, id).digest === handoff.artifact_transport_digests[id], id + " transport digest mismatch");
    });
    var project = parseProject(result);
    requireValue(handoff.project_profile.id === project.id && handoff.project_profile.object_id === project.objects[0].id && handoff.project_profile.material_id === project.materials[0].id, "Project profile ids mismatch");
    requireValue(handoff.glb && handoff.glb.source_id === project.id && handoff.glb.triangle_count === result.measures.triangles && handoff.glb.vertex_count === handoff.glb.index_count, "GLB profile binding mismatch");
    return { result: result, handoff: handoff, project: project };
  }

  function controlsFromBundle(result, project) {
    var object = project.objects[0];
    var material = project.materials[0];
    var dimensions = result.target_canvas.dimensions;
    return normalizeControls({
      primitive: object.type,
      dimensions: { width: dimensions.width, height: dimensions.height, depth: dimensions.depth, unit: dimensions.unit },
      max_polygon_count: result.target_canvas.performance.max_polygon_count,
      position: object.position,
      rotation: object.rotation,
      inflate: object.geometry.inflate,
      twist: object.geometry.twist,
      baseColor: material.baseColor,
      metallic: material.metallic,
      roughness: material.roughness,
      opacity: material.opacity,
      doubleSided: material.doubleSided,
      seed: result.provenance && result.provenance.seed || "spatial-sensory-01"
    });
  }

  function normalizeControls(input) {
    input = clone(input || {});
    requireValue(PRIMITIVES.indexOf(input.primitive) >= 0, "primitive is unsupported");
    requireValue(input.dimensions && ["m", "mm"].indexOf(input.dimensions.unit) >= 0, "dimension unit is invalid");
    var dimensions = {
      width: finite(input.dimensions.width, 0.001, 10000, "width"),
      height: finite(input.dimensions.height, 0.001, 10000, "height"),
      depth: finite(input.dimensions.depth, 0.001, 10000, "depth"),
      unit: input.dimensions.unit
    };
    return {
      primitive: input.primitive,
      dimensions: dimensions,
      max_polygon_count: integer(input.max_polygon_count, 1, 100000, "polygon budget"),
      position: vector(input.position, -10000, 10000, "position"),
      rotation: vector(input.rotation, -36000, 36000, "rotation"),
      inflate: finite(input.inflate, -0.9, 4, "inflate"),
      twist: finite(input.twist, -720, 720, "twist"),
      baseColor: hex(input.baseColor, "base colour"),
      metallic: finite(input.metallic, 0, 1, "metallic"),
      roughness: finite(input.roughness, 0.02, 1, "roughness"),
      opacity: finite(input.opacity, 0, 1, "opacity"),
      doubleSided: input.doubleSided === true,
      seed: text(input.seed, 120, "seed")
    };
  }

  function defaultViewer(handoff) {
    var bounds = handoff && handoff.glb && handoff.glb.bounds;
    var size = bounds && bounds.size ? Math.max.apply(Math, bounds.size) : 2;
    var center = bounds ? bounds.min.map(function (value, index) { return (value + bounds.max[index]) / 2; }) : [0, 0, 0];
    return {
      schema: VIEWER_SCHEMA,
      version: "1.0.0",
      yaw_deg: 35,
      pitch_deg: 24,
      distance: Math.max(0.5, size * 2.8),
      target: center,
      projection: "perspective",
      fov_deg: 48,
      background: "studio-dark",
      light_azimuth_deg: 42,
      light_elevation_deg: 38,
      light_intensity: 1.3,
      ambient_intensity: 0.24,
      view_mode: "shaded",
      normal_policy: "as-delivered",
      show_grid: true,
      show_axes: true,
      show_bounds: true,
      high_contrast_ui: false,
      reduced_motion: false,
      comparison_source: "current"
    };
  }

  function normalizeViewer(input) {
    var viewer = Object.assign(defaultViewer(), clone(input || {}));
    viewer.schema = VIEWER_SCHEMA;
    viewer.version = "1.0.0";
    viewer.yaw_deg = finite(viewer.yaw_deg, -36000, 36000, "yaw");
    viewer.pitch_deg = finite(viewer.pitch_deg, -89, 89, "pitch");
    viewer.distance = finite(viewer.distance, 0.001, 100000, "distance");
    viewer.target = vector(viewer.target, -1000000, 1000000, "target");
    requireValue(["perspective", "orthographic"].indexOf(viewer.projection) >= 0, "projection is invalid");
    viewer.fov_deg = finite(viewer.fov_deg, 15, 120, "field of view");
    requireValue(["studio-dark", "studio-light", "neutral", "black"].indexOf(viewer.background) >= 0, "background is invalid");
    viewer.light_azimuth_deg = finite(viewer.light_azimuth_deg, -36000, 36000, "light azimuth");
    viewer.light_elevation_deg = finite(viewer.light_elevation_deg, -89, 89, "light elevation");
    viewer.light_intensity = finite(viewer.light_intensity, 0, 8, "light intensity");
    viewer.ambient_intensity = finite(viewer.ambient_intensity, 0, 4, "ambient intensity");
    requireValue(["shaded", "wireframe", "normals"].indexOf(viewer.view_mode) >= 0, "view mode is invalid");
    requireValue(["as-delivered", "face-repair-diagnostic"].indexOf(viewer.normal_policy) >= 0, "normal policy is invalid");
    requireValue(["original", "current"].indexOf(viewer.comparison_source) >= 0, "comparison source is invalid");
    ["show_grid", "show_axes", "show_bounds", "high_contrast_ui", "reduced_motion"].forEach(function (key) { viewer[key] = viewer[key] === true; });
    return viewer;
  }
  function viewerStateDigest(viewer) { return digest(normalizeViewer(viewer)); }
  function authority() { return { candidate_only: true, installed: false, promoted: false, canonical: false, publishes: false }; }

  function newJourney(resultDigest) {
    return { result_digest: resultDigest, orbit_count: 0, zoom_count: 0, presets_seen: [], projection_changes: 0, overlay_changes: 0, last_interaction: null };
  }
  function createSession(result, handoff, options) {
    var inspected = inspectBundle(result, handoff);
    var controls = controlsFromBundle(result, inspected.project);
    var viewer = normalizeViewer(options && options.viewer || defaultViewer(handoff));
    return {
      schema: SESSION_SCHEMA,
      version: VERSION,
      id: "spatial-sensory-" + result.digest,
      source_result: result,
      current_result: result,
      source_handoff: handoff,
      current_handoff: handoff,
      source_project: clone(inspected.project),
      current_project: clone(inspected.project),
      current_controls: clone(controls),
      draft_controls: clone(controls),
      pending_edit: null,
      edit_history: [],
      viewer: viewer,
      viewer_state_digest: viewerStateDigest(viewer),
      journey: newJourney(result.digest),
      render_observations: [],
      human_judgment: null,
      stale_review_history: [],
      last_regeneration_failure: null,
      authority: authority()
    };
  }
  function assertSession(session) { requireValue(session && session.schema === SESSION_SCHEMA, "Spatial sensory session is required"); }
  function staleReview(session, reason, details) {
    if (!session.human_judgment) return session;
    session.stale_review_history = session.stale_review_history.concat([{ reason: reason, details: clone(details || {}), stale_at: new Date().toISOString(), previous_judgment: clone(session.human_judgment) }]);
    session.human_judgment = null;
    return session;
  }
  function replaceDraftControls(session, controls) {
    assertSession(session);
    var next = normalizeControls(controls);
    session.draft_controls = next;
    session.pending_edit = {
      schema: EDIT_SCHEMA,
      version: "1.0.0",
      source_result_digest: session.current_result.digest,
      source_project_digest: session.current_handoff.project_digest,
      before_digest: digest(session.current_controls),
      after_digest: digest(next),
      controls: clone(next),
      primitive_control_mode: "brief-semantic-inference",
      authority: authority()
    };
    session.last_regeneration_failure = null;
    return session;
  }
  function cancelPendingEdit(session) {
    assertSession(session);
    session.draft_controls = clone(session.current_controls);
    session.pending_edit = null;
    session.last_regeneration_failure = null;
    return session;
  }
  function bindRegeneratedResult(session, result, handoff) {
    assertSession(session);
    var inspected = inspectBundle(result, handoff);
    var previousDigest = session.current_result.digest;
    staleReview(session, "candidate-regenerated", { previous_result_digest: previousDigest, current_result_digest: result.digest });
    if (session.pending_edit) session.edit_history = session.edit_history.concat([Object.assign(clone(session.pending_edit), { applied_result_digest: result.digest, applied_project_digest: handoff.project_digest })]);
    session.current_result = result;
    session.current_handoff = handoff;
    session.current_project = clone(inspected.project);
    session.current_controls = controlsFromBundle(result, inspected.project);
    session.draft_controls = clone(session.current_controls);
    session.pending_edit = null;
    session.last_regeneration_failure = null;
    session.journey = newJourney(result.digest);
    session.render_observations = [];
    session.viewer = normalizeViewer(Object.assign({}, session.viewer, { target: defaultViewer(handoff).target, distance: defaultViewer(handoff).distance, comparison_source: "current" }));
    session.viewer_state_digest = viewerStateDigest(session.viewer);
    return session;
  }
  function recordRegenerationFailure(session, diagnostic) {
    assertSession(session);
    session.last_regeneration_failure = {
      code: text(diagnostic && diagnostic.code || "REGENERATION_FAILED", 120, "failure code"),
      message: String(diagnostic && diagnostic.message || "Spatial regeneration failed").slice(0, 1000),
      result_status: diagnostic && diagnostic.result_status || null,
      preserved_result_digest: session.current_result.digest,
      preserved_review: !!session.human_judgment,
      attempted_controls_digest: digest(session.draft_controls)
    };
    return session;
  }
  function setViewer(session, patch) {
    assertSession(session);
    var before = session.viewer_state_digest;
    session.viewer = normalizeViewer(Object.assign({}, session.viewer, clone(patch || {})));
    session.viewer_state_digest = viewerStateDigest(session.viewer);
    if (before !== session.viewer_state_digest) staleReview(session, "viewer-state-changed", { previous_viewer_state_digest: before, current_viewer_state_digest: session.viewer_state_digest });
    return session;
  }
  function activeBundle(session) {
    assertSession(session);
    return session.viewer.comparison_source === "original"
      ? { result: session.source_result, handoff: session.source_handoff, project: session.source_project }
      : { result: session.current_result, handoff: session.current_handoff, project: session.current_project };
  }
  function recordInteraction(session, kind, details) {
    assertSession(session);
    requireValue(["orbit", "zoom", "preset", "projection", "overlay"].indexOf(kind) >= 0, "interaction kind is invalid");
    var journey = session.journey;
    requireValue(journey.result_digest === session.current_result.digest, "interaction journey is stale");
    if (kind === "orbit") journey.orbit_count += 1;
    if (kind === "zoom") journey.zoom_count += 1;
    if (kind === "preset") {
      var preset = details && details.preset;
      requireValue(PRESETS.indexOf(preset) >= 0, "view preset is invalid");
      if (journey.presets_seen.indexOf(preset) < 0) journey.presets_seen.push(preset);
    }
    if (kind === "projection") journey.projection_changes += 1;
    if (kind === "overlay") journey.overlay_changes += 1;
    journey.last_interaction = { kind: kind, details: clone(details || {}), at: new Date().toISOString() };
    staleReview(session, "interaction-journey-changed", { kind: kind });
    return session;
  }
  function recordRenderObservation(session, observation) {
    assertSession(session);
    var bundle = activeBundle(session);
    requireValue(observation && observation.webgl2 === true && observation.dynamic_frame_observed === true, "A dynamic WebGL2 observation is required");
    requireValue(observation.result_digest === bundle.result.digest && observation.glb_sha256 === bundle.handoff.artifact_sha256["mesh-glb"], "Render observation candidate mismatch");
    var event = {
      kind: "dynamic-spatial-view",
      result_digest: bundle.result.digest,
      glb_sha256: observation.glb_sha256,
      viewer_state_digest: session.viewer_state_digest,
      comparison_source: session.viewer.comparison_source,
      renderer_id: text(observation.renderer_id || "axm-spatial-webgl2-reviewer", 120, "renderer id"),
      backend: "WebGL2",
      webgl2: true,
      dynamic_frame_observed: true,
      frame_count: Math.max(1, Math.floor(Number(observation.frame_count) || 1)),
      zero_normal_count: Math.max(0, Math.floor(Number(observation.zero_normal_count) || 0)),
      normal_policy: session.viewer.normal_policy,
      observed_at: new Date().toISOString()
    };
    session.render_observations = session.render_observations.concat([event]).slice(-40);
    return session;
  }
  function hasCurrentRender(session) {
    var bundle = activeBundle(session);
    return session.render_observations.some(function (event) {
      return event.webgl2 === true && event.dynamic_frame_observed === true && event.result_digest === bundle.result.digest && event.viewer_state_digest === session.viewer_state_digest && event.comparison_source === session.viewer.comparison_source;
    });
  }
  function acceptanceGate(session) {
    assertSession(session);
    var journey = session.journey;
    var missing = [];
    if (session.viewer.comparison_source !== "current") missing.push("current candidate selected");
    if (!hasCurrentRender(session)) missing.push("dynamic WebGL2 frame for current viewer state");
    if (journey.orbit_count < 1) missing.push("user-driven orbit");
    if (journey.zoom_count < 1) missing.push("user-driven zoom");
    ["front", "side", "top"].forEach(function (preset) { if (journey.presets_seen.indexOf(preset) < 0) missing.push(preset + " view"); });
    return { pass: missing.length === 0, missing: missing };
  }
  function setReview(session, input) {
    assertSession(session);
    input = input || {};
    requireValue(VERDICTS.indexOf(input.decision) >= 0, "review decision is invalid");
    var gate = acceptanceGate(session);
    if (input.decision === "ACCEPT_FOR_TEST") requireValue(gate.pass, "ACCEPT_FOR_TEST requires: " + gate.missing.join(", "));
    var bundle = activeBundle(session);
    var receipt = {
      schema: REVIEW_SCHEMA,
      version: "1.0.0",
      status: "HUMAN_REVIEWED",
      decision: input.decision,
      notes: text(input.notes || "No notes supplied", 2000, "review notes"),
      candidate: {
        result_digest: bundle.result.digest,
        project_digest: bundle.handoff.project_digest,
        glb_sha256: bundle.handoff.artifact_sha256["mesh-glb"],
        obj_sha256: bundle.handoff.artifact_sha256["mesh-obj"]
      },
      viewer_state_digest: session.viewer_state_digest,
      viewer_state_digest_algorithm: "fnv1a32-canonical-json",
      journey_digest: digest(session.journey),
      journey: clone(session.journey),
      renderer: { id: "axm-spatial-webgl2-reviewer", version: VERSION, backend: "WebGL2", normal_policy: session.viewer.normal_policy },
      dynamic_view_gate: gate,
      claims: { target_renderer_parity: false, physical_scale_verified: false, controller_or_xr_verified: false, assistive_technology_verified: false, external_gltf_conformance: false },
      authority: authority(),
      created_at: new Date().toISOString()
    };
    session.human_judgment = receipt;
    return receipt;
  }
  function exportSession(session) {
    assertSession(session);
    return {
      schema: "axm.asset-spatial-sensory-export/v1",
      version: VERSION,
      result: session.current_result,
      handoff: session.current_handoff,
      viewer: session.viewer,
      journey: session.journey,
      review: session.human_judgment,
      stale_review_history: session.stale_review_history,
      authority: authority()
    };
  }

  return {
    VERSION: VERSION,
    SESSION_SCHEMA: SESSION_SCHEMA,
    RESULT_SCHEMA: RESULT_SCHEMA,
    HANDOFF_SCHEMA: HANDOFF_SCHEMA,
    PROJECT_SCHEMA: PROJECT_SCHEMA,
    EDIT_SCHEMA: EDIT_SCHEMA,
    VIEWER_SCHEMA: VIEWER_SCHEMA,
    REVIEW_SCHEMA: REVIEW_SCHEMA,
    HAND_ID: HAND_ID,
    HAND_VERSION: HAND_VERSION,
    PRIMITIVES: PRIMITIVES.slice(),
    VERDICTS: VERDICTS.slice(),
    canonicalStringify: canonicalStringify,
    digest: digest,
    inspectBundle: inspectBundle,
    normalizeControls: normalizeControls,
    controlsFromBundle: controlsFromBundle,
    defaultViewer: defaultViewer,
    normalizeViewer: normalizeViewer,
    viewerStateDigest: viewerStateDigest,
    createSession: createSession,
    replaceDraftControls: replaceDraftControls,
    cancelPendingEdit: cancelPendingEdit,
    bindRegeneratedResult: bindRegeneratedResult,
    recordRegenerationFailure: recordRegenerationFailure,
    setViewer: setViewer,
    activeBundle: activeBundle,
    recordInteraction: recordInteraction,
    recordRenderObservation: recordRenderObservation,
    acceptanceGate: acceptanceGate,
    setReview: setReview,
    exportSession: exportSession
  };
});
