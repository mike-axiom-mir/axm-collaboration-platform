(function () {
  "use strict";
  var Core = window.AXMSpatialSensoryCore;
  var Render = window.AXMSpatialRenderer;
  var session = null;
  var renderer = null;
  var loadedGlbSha = null;
  var hostHealth = null;
  var drag = null;

  function byId(id) { return document.getElementById(id); }
  function announce(message) { byId("announcer").textContent = message; }
  function setStatus(label, kind) {
    var element = byId("status");
    element.textContent = label;
    element.className = "chip " + (kind || "");
  }
  function number(id) { return Number(byId(id).value); }
  function activeArtifact(id) {
    var bundle = Core.activeBundle(session);
    return bundle.result.artifacts.find(function (artifact) { return artifact.id === id; });
  }
  var editControlIds = ["primitive","unit","width","height","depth","polygons","posX","posY","posZ","rotX","rotY","rotZ","inflate","twist","baseColor","metallic","roughness","opacity","doubleSided","seed"];
  function setEditEnabled(enabled) {
    editControlIds.forEach(function (id) { byId(id).disabled = !enabled; });
    byId("newCandidate").disabled = !enabled;
    byId("regenerate").disabled = !enabled || !session;
    byId("resetDraft").disabled = !enabled || !session;
  }
  function setReviewEnabled(enabled) {
    byId("recordReview").disabled = !enabled;
    byId("decision").disabled = !enabled;
    byId("reviewNotes").disabled = !enabled;
  }
  function readControls() {
    return Core.normalizeControls({
      primitive: byId("primitive").value,
      dimensions: { width: number("width"), height: number("height"), depth: number("depth"), unit: byId("unit").value },
      max_polygon_count: number("polygons"),
      position: [number("posX"), number("posY"), number("posZ")],
      rotation: [number("rotX"), number("rotY"), number("rotZ")],
      inflate: number("inflate"),
      twist: number("twist"),
      baseColor: byId("baseColor").value,
      metallic: number("metallic"),
      roughness: number("roughness"),
      opacity: number("opacity"),
      doubleSided: byId("doubleSided").checked,
      seed: byId("seed").value
    });
  }
  function writeControls(controls) {
    byId("primitive").value = controls.primitive;
    byId("unit").value = controls.dimensions.unit;
    byId("width").value = controls.dimensions.width;
    byId("height").value = controls.dimensions.height;
    byId("depth").value = controls.dimensions.depth;
    byId("polygons").value = controls.max_polygon_count;
    ["posX", "posY", "posZ"].forEach(function (id, index) { byId(id).value = controls.position[index]; });
    ["rotX", "rotY", "rotZ"].forEach(function (id, index) { byId(id).value = controls.rotation[index]; });
    byId("inflate").value = controls.inflate;
    byId("twist").value = controls.twist;
    byId("baseColor").value = controls.baseColor;
    byId("metallic").value = controls.metallic;
    byId("roughness").value = controls.roughness;
    byId("opacity").value = controls.opacity;
    byId("doubleSided").checked = controls.doubleSided;
    byId("seed").value = controls.seed;
    updateOutputs();
  }
  function updateOutputs() {
    ["metallic", "roughness", "opacity"].forEach(function (id) {
      var output = document.querySelector("output[data-for='" + id + "']");
      if (output) output.textContent = Number(byId(id).value).toFixed(2);
    });
  }
  function syncViewerControls() {
    if (!session) return;
    var viewer = session.viewer;
    byId("viewMode").value = viewer.view_mode;
    byId("projection").value = viewer.projection;
    byId("background").value = viewer.background;
    byId("normalPolicy").value = viewer.normal_policy;
    byId("lightAzimuth").value = viewer.light_azimuth_deg;
    byId("lightElevation").value = viewer.light_elevation_deg;
    byId("lightIntensity").value = viewer.light_intensity;
    byId("ambientIntensity").value = viewer.ambient_intensity;
    byId("showGrid").checked = viewer.show_grid;
    byId("showAxes").checked = viewer.show_axes;
    byId("showBounds").checked = viewer.show_bounds;
    byId("highContrast").checked = viewer.high_contrast_ui;
    byId("reducedMotion").checked = viewer.reduced_motion;
    document.body.classList.toggle("high-contrast", viewer.high_contrast_ui);
    document.querySelectorAll("[data-compare]").forEach(function (button) { button.classList.toggle("active", button.dataset.compare === viewer.comparison_source); });
  }
  function draftChanged() {
    if (!session) return;
    try {
      Core.replaceDraftControls(session, readControls());
      byId("diagnostic").textContent = "Draft ready · every successful edit will replace OBJ, GLB, project, and static SVG.";
      byId("diagnostic").className = "diagnostic";
    } catch (error) {
      byId("diagnostic").textContent = "Draft invalid: " + error.message;
      byId("diagnostic").className = "diagnostic error";
    }
    updateOutputs();
  }
  function formatVector(values) { return values.map(function (value) { return Number(value).toFixed(2); }).join(" × "); }
  function updateUi() {
    syncViewerControls();
    if (!session) return;
    var bundle = Core.activeBundle(session);
    var handoff = bundle.handoff;
    var gate = Core.acceptanceGate(session);
    var snapshot = renderer && renderer.geometry ? renderer.snapshot() : null;
    document.body.dataset.resultDigest = bundle.result.digest;
    document.body.dataset.projectDigest = handoff.project_digest;
    document.body.dataset.glbSha256 = handoff.artifact_sha256["mesh-glb"];
    document.body.dataset.artifactDigests = JSON.stringify(Object.fromEntries(bundle.result.artifacts.map(function (artifact) { return [artifact.id, artifact.digest]; })));
    document.body.dataset.journey = JSON.stringify(session.journey);
    document.body.dataset.acceptanceGate = gate.pass ? "PASS" : "HOLD";
    byId("renderBadge").textContent = snapshot && snapshot.webgl2 ? "WEBGL2 · " + snapshot.frame_count + " FRAME" + (snapshot.frame_count === 1 ? "" : "S") : "NO LIVE FRAME";
    byId("candidateBadge").textContent = session.viewer.comparison_source.toUpperCase() + " · " + bundle.result.digest;
    byId("normalBadge").textContent = handoff.glb.zero_normal_count + " ZERO NORMAL" + (handoff.glb.zero_normal_count === 1 ? "" : "S") + (session.viewer.normal_policy === "face-repair-diagnostic" ? " · REPAIR VIEW" : " · AS DELIVERED");
    var metrics = [
      [handoff.project_profile.primitive, "primitive"],
      [handoff.glb.triangle_count, "triangles"],
      [formatVector(handoff.glb.bounds.size) + " m", "delivery bounds"],
      [handoff.artifact_sha256["mesh-glb"].slice(0, 14) + "…", "GLB SHA-256"],
      [handoff.project_digest.slice(0, 14) + "…", "project SHA-256"]
    ];
    byId("candidateMetrics").innerHTML = metrics.map(function (item) { return "<div class='metric'><b>" + item[0] + "</b><span>" + item[1] + "</span></div>"; }).join("");
    byId("gateStatus").className = "gate " + (gate.pass ? "pass" : "fail");
    byId("gateStatus").textContent = gate.pass ? "Dynamic gate met · a human may record ACCEPT_FOR_TEST." : "Still required: " + gate.missing.join(" · ");
    var journey = session.journey;
    var items = [
      [journey.orbit_count > 0, "Orbit observed (" + journey.orbit_count + ")"],
      [journey.zoom_count > 0, "Zoom observed (" + journey.zoom_count + ")"],
      [journey.presets_seen.indexOf("front") >= 0, "Front view observed"],
      [journey.presets_seen.indexOf("side") >= 0, "Side view observed"],
      [journey.presets_seen.indexOf("top") >= 0, "Top view observed"],
      [gate.missing.indexOf("dynamic WebGL2 frame for current viewer state") < 0, "Current viewer state rendered"]
    ];
    byId("journeyList").innerHTML = items.map(function (item) { return "<li class='" + (item[0] ? "done" : "") + "'>" + (item[0] ? "✓ " : "○ ") + item[1] + "</li>"; }).join("");
    byId("evidenceJson").textContent = session.human_judgment ? JSON.stringify(session.human_judgment, null, 2) : "No receipt recorded. Technical PASS is not human approval.";
    byId("downloadReceipt").disabled = !session.human_judgment;
  }
  function renderActive() {
    if (!session || !renderer) { updateUi(); return; }
    try {
      var bundle = Core.activeBundle(session);
      var glbSha = bundle.handoff.artifact_sha256["mesh-glb"];
      if (loadedGlbSha !== glbSha) {
        renderer.load(activeArtifact("mesh-glb").dataUrl);
        loadedGlbSha = glbSha;
      }
      renderer.setViewer(session.viewer);
      var snapshot = renderer.render();
      Core.recordRenderObservation(session, Object.assign({}, snapshot, { result_digest: bundle.result.digest, glb_sha256: glbSha }));
      setStatus("READY · LIVE GLB", "");
    } catch (error) {
      setStatus("DEGRADED · " + error.message, "error");
      byId("diagnostic").textContent = "Renderer refused candidate: " + error.message;
    }
    updateUi();
  }
  function setViewerAndRender(patch, interactionKind, details) {
    if (!session) return;
    Core.setViewer(session, patch);
    if (interactionKind) Core.recordInteraction(session, interactionKind, details);
    renderActive();
  }
  async function request(path, payload) {
    var response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    var body = await response.json();
    if (!response.ok) throw Object.assign(new Error(body.message || "Host request failed"), { body: body });
    return body;
  }
  function bindNew(envelope, readOnly) {
    if (!envelope || envelope.status !== "READY") throw new Error(envelope && envelope.diagnostic && envelope.diagnostic.message || "Spatial candidate is not READY");
    session = Core.createSession(envelope.result, envelope.handoff);
    session.read_only_degraded = readOnly === true;
    writeControls(session.current_controls);
    setEditEnabled(!session.read_only_degraded);
    setReviewEnabled(true);
    loadedGlbSha = null;
    byId("diagnostic").textContent = "Candidate bound through deterministic spatial handoff PASS.";
    renderActive();
  }
  async function createCandidate() {
    setStatus("CREATING", "warn");
    byId("newCandidate").disabled = true;
    try {
      var controls = session ? readControls() : Core.normalizeControls({ primitive: byId("primitive").value, dimensions: { width: number("width"), height: number("height"), depth: number("depth"), unit: byId("unit").value }, max_polygon_count: number("polygons"), position: [0,0,0], rotation: [0,0,0], inflate: 0, twist: 0, baseColor: byId("baseColor").value, metallic: number("metallic"), roughness: number("roughness"), opacity: number("opacity"), doubleSided: byId("doubleSided").checked, seed: byId("seed").value });
      bindNew(await request("/api/create", { controls: controls }), false);
      announce("New spatial candidate created and rendered.");
    } catch (error) {
      setStatus("CREATE FAILED", "error");
      byId("diagnostic").textContent = error.message;
    } finally { byId("newCandidate").disabled = !(hostHealth && hostHealth.status === "READY"); }
  }
  async function regenerate() {
    if (!session) return;
    setStatus("REGENERATING", "warn");
    byId("regenerate").disabled = true;
    try {
      Core.replaceDraftControls(session, readControls());
      var envelope = await request("/api/edit", { controls: session.draft_controls, project: session.current_project });
      if (envelope.status !== "READY") {
        Core.recordRegenerationFailure(session, envelope.diagnostic || { code: envelope.status, message: "Candidate was not reviewable", result_status: envelope.status });
        byId("diagnostic").textContent = "Regeneration " + envelope.status + "; prior candidate and review preserved.";
        setStatus(envelope.status + " · PRIOR PRESERVED", "warn");
        updateUi();
        return;
      }
      var previous = session.current_result.digest;
      Core.bindRegeneratedResult(session, envelope.result, envelope.handoff);
      writeControls(session.current_controls);
      loadedGlbSha = null;
      byId("diagnostic").textContent = "All four artifacts replaced · " + previous + " → " + envelope.result.digest;
      renderActive();
      announce("Spatial edit regenerated all four artifacts and reset the observation journey.");
    } catch (error) {
      Core.recordRegenerationFailure(session, { code: "HOST_REQUEST_FAILED", message: error.message });
      byId("diagnostic").textContent = "Regeneration failed; prior candidate preserved: " + error.message;
      setStatus("FAILED · PRIOR PRESERVED", "error");
      updateUi();
    } finally { byId("regenerate").disabled = false; }
  }
  function resetDraft() {
    if (!session) return;
    Core.cancelPendingEdit(session);
    writeControls(session.current_controls);
    byId("diagnostic").textContent = "Draft reset to the current gated project.";
  }
  function recordReview() {
    if (!session) return;
    try {
      var receipt = Core.setReview(session, { decision: byId("decision").value, notes: byId("reviewNotes").value || "No notes supplied" });
      byId("evidenceJson").textContent = JSON.stringify(receipt, null, 2);
      announce("Human review receipt recorded as " + receipt.decision + ".");
      updateUi();
    } catch (error) {
      byId("gateStatus").className = "gate fail";
      byId("gateStatus").textContent = error.message;
      announce(error.message);
    }
  }
  function downloadReceipt() {
    if (!session || !session.human_judgment) return;
    var blob = new Blob([JSON.stringify(Core.exportSession(session), null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "spatial-sensory-review-" + session.current_result.digest + ".json";
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  function loadSerialized() {
    try {
      var payload = JSON.parse(byId("serializedBundle").value);
      bindNew({ status: "READY", result: payload.result, handoff: payload.handoff }, true);
      byId("hostStatus").textContent = "DEGRADED · SERIALIZED";
      announce("Serialized candidate loaded in read-only degraded mode.");
    } catch (error) {
      byId("diagnostic").textContent = "Serialized candidate refused: " + error.message;
      setStatus("SERIALIZED REFUSED", "error");
    }
  }
  async function connect() {
    try {
      var response = await fetch("/api/health", { cache: "no-store" });
      hostHealth = await response.json();
      byId("hostStatus").textContent = hostHealth.status + " · LOOPBACK";
      byId("hostStatus").className = "chip " + (hostHealth.status === "READY" ? "" : "warn");
      if (hostHealth.status === "READY") await createCandidate();
      else { setEditEnabled(false); setReviewEnabled(false); setStatus("DEGRADED · LOAD SERIALIZED", "warn"); }
    } catch (error) {
      byId("hostStatus").textContent = "DEGRADED · HOST OFFLINE";
      byId("hostStatus").className = "chip warn";
      setEditEnabled(false);
      setReviewEnabled(false);
      setStatus("DEGRADED · LOAD SERIALIZED", "warn");
      byId("diagnostic").textContent = "Host unavailable. Serialized PASS candidates remain inspectable: " + error.message;
    }
  }
  function bindViewerEvents() {
    var canvas = byId("spatialCanvas");
    canvas.addEventListener("pointerdown", function (event) { drag = { x: event.clientX, y: event.clientY, yaw: session && session.viewer.yaw_deg, pitch: session && session.viewer.pitch_deg }; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointermove", function (event) {
      if (!drag || !session) return;
      var yaw = drag.yaw + (event.clientX - drag.x) * 0.45;
      var pitch = Math.max(-89, Math.min(89, drag.pitch + (event.clientY - drag.y) * 0.35));
      setViewerAndRender({ yaw_deg: yaw, pitch_deg: pitch }, "orbit", { input: "pointer" });
    });
    function endDrag() { drag = null; }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", function (event) {
      if (!session) return;
      event.preventDefault();
      setViewerAndRender({ distance: Math.max(0.001, Math.min(100000, session.viewer.distance * Math.exp(event.deltaY * 0.001))) }, "zoom", { input: "wheel" });
    }, { passive: false });
    canvas.addEventListener("keydown", function (event) {
      if (!session) return;
      var patch = null, kind = "orbit";
      if (event.key === "ArrowLeft") patch = { yaw_deg: session.viewer.yaw_deg - 5 };
      if (event.key === "ArrowRight") patch = { yaw_deg: session.viewer.yaw_deg + 5 };
      if (event.key === "ArrowUp") patch = { pitch_deg: Math.min(89, session.viewer.pitch_deg + 5) };
      if (event.key === "ArrowDown") patch = { pitch_deg: Math.max(-89, session.viewer.pitch_deg - 5) };
      if (event.key === "+" || event.key === "=") { patch = { distance: session.viewer.distance * 0.9 }; kind = "zoom"; }
      if (event.key === "-" || event.key === "_") { patch = { distance: session.viewer.distance * 1.1 }; kind = "zoom"; }
      if (patch) { event.preventDefault(); setViewerAndRender(patch, kind, { input: "keyboard" }); }
    });
    document.querySelectorAll("[data-preset]").forEach(function (button) {
      button.addEventListener("click", function () {
        var preset = button.dataset.preset;
        var views = { front: { yaw_deg: 0, pitch_deg: 0 }, side: { yaw_deg: 90, pitch_deg: 0 }, top: { yaw_deg: 0, pitch_deg: 89 }, home: { yaw_deg: 35, pitch_deg: 24 } };
        setViewerAndRender(views[preset], "preset", { preset: preset });
      });
    });
    document.querySelectorAll("[data-compare]").forEach(function (button) { button.addEventListener("click", function () { setViewerAndRender({ comparison_source: button.dataset.compare }); }); });
    ["viewMode", "background", "normalPolicy"].forEach(function (id) { byId(id).addEventListener("change", function () { var patch = {}; patch[id === "viewMode" ? "view_mode" : id === "normalPolicy" ? "normal_policy" : "background"] = byId(id).value; setViewerAndRender(patch, "overlay", { control: id }); }); });
    byId("projection").addEventListener("change", function () { setViewerAndRender({ projection: byId("projection").value }, "projection", { value: byId("projection").value }); });
    [["lightAzimuth","light_azimuth_deg"],["lightElevation","light_elevation_deg"],["lightIntensity","light_intensity"],["ambientIntensity","ambient_intensity"]].forEach(function (pair) { byId(pair[0]).addEventListener("input", function () { var patch = {}; patch[pair[1]] = number(pair[0]); setViewerAndRender(patch, "overlay", { control: pair[0] }); }); });
    [["showGrid","show_grid"],["showAxes","show_axes"],["showBounds","show_bounds"],["highContrast","high_contrast_ui"],["reducedMotion","reduced_motion"]].forEach(function (pair) { byId(pair[0]).addEventListener("change", function () { var patch = {}; patch[pair[1]] = byId(pair[0]).checked; setViewerAndRender(patch, "overlay", { control: pair[0] }); }); });
    window.addEventListener("resize", function () { if (session && renderer) renderActive(); });
  }
  function bindEvents() {
    editControlIds.forEach(function (id) { byId(id).addEventListener(id === "seed" ? "change" : "input", draftChanged); });
    byId("newCandidate").addEventListener("click", createCandidate);
    byId("regenerate").addEventListener("click", regenerate);
    byId("resetDraft").addEventListener("click", resetDraft);
    byId("recordReview").addEventListener("click", recordReview);
    byId("downloadReceipt").addEventListener("click", downloadReceipt);
    byId("loadSerialized").addEventListener("click", loadSerialized);
    bindViewerEvents();
  }
  function init() {
    requireValue(Core && Render, "Spatial workbench dependencies are missing");
    try { renderer = new Render.SpatialRenderer(byId("spatialCanvas")); }
    catch (error) { renderer = null; setStatus("DEGRADED · WEBGL2 MISSING", "error"); byId("diagnostic").textContent = error.message; }
    bindEvents();
    updateOutputs();
    connect();
    window.__AXM_SPATIAL_WORKBENCH__ = {
      getSession: function () { return session; },
      getHealth: function () { return hostHealth; },
      snapshot: function () { return renderer ? renderer.snapshot() : null; },
      actions: { createCandidate: createCandidate, regenerate: regenerate, renderActive: renderActive, setViewerAndRender: setViewerAndRender }
    };
  }
  function requireValue(condition, message) { if (!condition) throw new Error(message); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
