(function () {
  "use strict";
  var Core = window.AXMUISensoryCore;
  var Renderer = window.AXMUISensoryRenderer;
  var state = { session: null, currentImage: null, sourceImage: null, receipt: null, hostReady: false, lastRender: null };
  var byId = function (id) { return document.getElementById(id); };
  function value(id) { return byId(id).value; }
  function number(id) { return Number(value(id)); }
  function checked(id) { return byId(id).checked; }
  function setStatus(kind, message) { var element = byId("host-status"); element.textContent = message; element.className = "pill " + kind; }
  function show(message, extra) { byId("diagnostics").textContent = message + (extra ? "\n\n" + JSON.stringify(extra, null, 2) : ""); }
  function modalities() { return [["mod-pointer", "pointer"], ["mod-keyboard", "keyboard"], ["mod-touch", "touch"], ["mod-gamepad", "gamepad"]].filter(function (pair) { return checked(pair[0]); }).map(function (pair) { return pair[1]; }); }
  function createPayload() {
    return { id: "ui-sensory-hud", title: value("title"), kind: value("kind"), seed: "ui-sensory-01", medium: value("medium"), width: number("width"), height: number("height"), transparency: value("transparency"), minimum_contrast_ratio: number("contrast"), direction: value("direction"), input_modalities: modalities(), reduced_motion: checked("reduced-motion"), minimum_target_size: number("min-target"), alternative_text: checked("alt-text"), focus_visible: checked("focus-visible-source"), palette: { surface: value("surface"), accent: value("accent"), foreground: value("foreground"), attention: value("attention") } };
  }
  function setValue(id, output) { byId(id).value = output; }
  function fillRecipe(recipe) {
    setValue("title", recipe.title); setValue("kind", recipe.kind); setValue("medium", recipe.target.medium); setValue("width", recipe.target.dimensions.width); setValue("height", recipe.target.dimensions.height); setValue("transparency", recipe.target.transparency); setValue("contrast", recipe.target.minimum_contrast_ratio); setValue("direction", recipe.target.direction); setValue("min-target", recipe.target.minimum_target_size);
    ["pointer", "keyboard", "touch", "gamepad"].forEach(function (item) { byId("mod-" + item).checked = recipe.target.input_modalities.indexOf(item) >= 0; });
    byId("reduced-motion").checked = recipe.target.reduced_motion; byId("alt-text").checked = recipe.target.alternative_text; byId("focus-visible-source").checked = recipe.target.focus_visible;
    Object.keys(recipe.palette).forEach(function (key) { setValue(key, recipe.palette[key]); });
    setValue("inset", recipe.geometry.inset); setValue("radius", recipe.geometry.radius); Object.keys(recipe.geometry.nine_slice).forEach(function (key) { setValue("slice-" + key, recipe.geometry.nine_slice[key]); });
    setValue("focus-colour", recipe.target.focus_ring.colour); setValue("focus-width", recipe.target.focus_ring.width);
    Core.STATES.forEach(function (name) { setValue(name + "-opacity", recipe.states[name].opacity); setValue(name + "-scale", recipe.states[name].scale); });
    byId("stretch-width").value = recipe.target.dimensions.width; byId("stretch-height").value = recipe.target.dimensions.height;
  }
  function recipeFromControls() {
    var recipe = JSON.parse(JSON.stringify(state.session.current_recipe));
    recipe.title = value("title"); recipe.kind = value("kind"); recipe.target.medium = value("medium"); recipe.target.dimensions.width = number("width"); recipe.target.dimensions.height = number("height"); recipe.target.transparency = value("transparency"); recipe.target.minimum_contrast_ratio = number("contrast"); recipe.target.direction = value("direction"); recipe.target.input_modalities = modalities(); recipe.target.reduced_motion = checked("reduced-motion"); recipe.target.minimum_target_size = number("min-target"); recipe.target.alternative_text = checked("alt-text"); recipe.target.focus_visible = checked("focus-visible-source"); recipe.target.focus_ring = { colour: value("focus-colour"), width: number("focus-width") };
    recipe.palette = { surface: value("surface"), accent: value("accent"), foreground: value("foreground"), attention: value("attention") };
    recipe.geometry = { inset: number("inset"), radius: number("radius"), nine_slice: { left: number("slice-left"), top: number("slice-top"), right: number("slice-right"), bottom: number("slice-bottom") } };
    Core.STATES.forEach(function (name) { recipe.states[name] = { opacity: number(name + "-opacity"), scale: number(name + "-scale") }; });
    return Core.validateRecipe(recipe);
  }
  function viewerFromControls() { return { render_mode: value("render-mode"), stretch_width: number("stretch-width"), stretch_height: number("stretch-height"), zoom_percent: number("zoom"), background: value("background"), contrast_mode: value("contrast-mode"), safe_area: value("safe-area"), focus_visible: checked("viewer-focus"), reduced_motion_preference: checked("viewer-reduced") }; }
  function syncViewer(patch) { if (!state.session) return; Core.setViewer(state.session, Object.assign(viewerFromControls(), patch || {})); render(); updateReadiness(); }
  function render() {
    if (!state.session || !state.currentImage || !state.sourceImage) return;
    state.lastRender = Renderer.renderToCanvas(byId("current-canvas"), state.currentImage, state.session.current_recipe, state.session.viewer);
    Renderer.renderToCanvas(byId("original-canvas"), state.sourceImage, state.session.source_recipe, state.session.viewer);
    byId("current-digest").textContent = state.session.current_result_digest + " · " + state.session.viewer_state_digest;
    document.querySelectorAll("[data-state]").forEach(function (button) { button.classList.toggle("selected", button.dataset.state === state.session.viewer.component_state); });
  }
  function record(kind, details) { if (!state.session) return; Core.recordJourneyEvent(state.session, kind, Object.assign({ renderer: state.lastRender }, details || {})); updateReadiness(); }
  function updateReadiness() {
    if (!state.session) return;
    var readiness = Core.journeyReadiness(state.session); var keys = Object.keys(readiness.checks); var count = keys.filter(function (key) { return readiness.checks[key]; }).length;
    byId("journey-status").textContent = "JOURNEY " + count + "/" + keys.length; byId("journey-status").className = "pill " + (readiness.pass ? "ready" : "hold");
    byId("journey-checks").innerHTML = ""; keys.forEach(function (key) { var span = document.createElement("span"); span.className = "check " + (readiness.checks[key] ? "pass" : ""); span.textContent = key.replaceAll("_", " "); byId("journey-checks").appendChild(span); });
    window.__AXM_UI_WORKBENCH__ = { state: state, readiness: readiness };
  }
  function parseSvg(result) { return result.artifacts.find(function (item) { return item.id === "ui-source"; }).text; }
  function bindResponse(body, first) {
    if (body.status !== "READY") { if (state.session) Core.recordRegenerationFailure(state.session, body.diagnostic || body); show("Regeneration refused; current candidate preserved.", body.diagnostic || body); updateReadiness(); return Promise.resolve(false); }
    if (first || !state.session) state.session = Core.createSession(body.result, body.handoff);
    else Core.bindRegeneratedResult(state.session, body.result, body.handoff);
    return Promise.all([Renderer.decodeSvg(parseSvg(state.session.current_result)), Renderer.decodeSvg(parseSvg(state.session.source_result))]).then(function (images) {
      state.currentImage = images[0]; state.sourceImage = images[1]; state.receipt = null; fillRecipe(state.session.current_recipe); byId("recipe-controls").disabled = false; byId("edit-btn").disabled = false; byId("cancel-btn").disabled = false; byId("review-btn").disabled = false; byId("download-btn").disabled = true; byId("edit-mode").textContent = "RECIPE BOUND"; byId("viewer-reduced").checked = state.session.current_recipe.target.reduced_motion; syncViewer({ stretch_width: state.session.current_recipe.target.dimensions.width, stretch_height: state.session.current_recipe.target.dimensions.height }); show("Candidate bound through deterministic-ui-fabric.", { operation: body.handoff.operation_mode, result_digest: body.handoff.result_digest, recipe_digest: body.handoff.recipe_digest, warnings: body.handoff.warnings, static_visual_only: body.handoff.preview.static_visual_only }); return true;
    });
  }
  function api(path, payload) { return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(function (response) { return response.json(); }); }
  byId("create-btn").addEventListener("click", function () { show("Creating deterministic UI candidate..."); api("/api/create", { create: createPayload(), seed: "ui-sensory-01" }).then(function (body) { return bindResponse(body, true); }).catch(function (error) { show("Create failed.", { message: error.message }); }); });
  byId("edit-btn").addEventListener("click", function () { try { var recipe = recipeFromControls(); Core.replaceDraftRecipe(state.session, recipe); show("Regenerating all three artifacts..."); api("/api/edit", { recipe: recipe, seed: recipe.seed }).then(function (body) { return bindResponse(body, false); }).catch(function (error) { Core.recordRegenerationFailure(state.session, { code: "HOST_REQUEST_FAILED", message: error.message }); show("Edit failed; current candidate preserved.", { message: error.message }); }); } catch (error) { show("Edit input refused before transport.", { message: error.message }); } });
  byId("cancel-btn").addEventListener("click", function () { if (!state.session) return; Core.cancelPendingEdit(state.session); fillRecipe(state.session.current_recipe); show("Draft reset to current bound recipe."); });
  document.querySelectorAll("[data-state]").forEach(function (button) { button.addEventListener("click", function () { syncViewer({ component_state: button.dataset.state }); record("state"); }); });
  byId("render-mode").addEventListener("change", function () { syncViewer(); record("mode"); });
  ["stretch-width", "stretch-height"].forEach(function (id) { byId(id).addEventListener("change", function () { syncViewer(); record("mode", { stretch_changed: true }); }); });
  byId("zoom").addEventListener("change", function () { syncViewer(); record("zoom"); });
  byId("background").addEventListener("change", function () { syncViewer(); record("background"); });
  byId("contrast-mode").addEventListener("change", function () { syncViewer(); record("render", { high_contrast: value("contrast-mode") === "high" }); });
  byId("safe-area").addEventListener("change", function () { syncViewer(); record("safe-area"); });
  byId("viewer-focus").addEventListener("change", function () { syncViewer(); });
  byId("viewer-reduced").addEventListener("change", function () { syncViewer(); record("reduced-motion"); });
  byId("pointer-btn").addEventListener("click", function () { syncViewer({ input_journey: "pointer", component_state: "hover" }); record("pointer"); });
  byId("keyboard-btn").addEventListener("click", function () { byId("viewer-focus").checked = true; syncViewer({ input_journey: "keyboard", focus_visible: true }); record("keyboard"); });
  byId("gamepad-btn").addEventListener("click", function () { syncViewer({ input_journey: "simulated-gamepad", component_state: "active" }); record("simulated-gamepad", { physical_device: false }); });
  byId("observe-btn").addEventListener("click", function () { syncViewer(); record("render"); });
  byId("review-btn").addEventListener("click", function () { try { Core.recordHumanJudgment(state.session, { reviewer: value("reviewer"), decision: value("decision"), notes: value("notes") }); state.receipt = Core.createReceipt(state.session); byId("download-btn").disabled = false; show("Explicit human review receipt prepared locally.", state.receipt); } catch (error) { show("Review not recorded.", { message: error.message, readiness: Core.journeyReadiness(state.session) }); } });
  byId("download-btn").addEventListener("click", function () { if (!state.receipt) return; var blob = new Blob([JSON.stringify(state.receipt, null, 2)], { type: "application/json" }); var url = URL.createObjectURL(blob); var link = document.createElement("a"); link.href = url; link.download = "ui-sensory-review-receipt.json"; link.click(); URL.revokeObjectURL(url); });
  fetch("/api/health").then(function (response) { return response.json(); }).then(function (health) { state.hostReady = health.status === "READY"; setStatus(state.hostReady ? "ready" : "hold", health.status); byId("connection-note").textContent = state.hostReady ? "Loopback host ready: ui-component@1.2.0 + deterministic-ui-fabric. Create derives focus defaults; recipe edit then controls them exactly." : "DEGRADED: machine provider or gate unavailable. Existing serialized candidates remain inspectable, but create/edit/review are disabled."; if (!state.hostReady) ["create-btn", "edit-btn", "review-btn"].forEach(function (id) { byId(id).disabled = true; }); show("Host health.", health); }).catch(function (error) { setStatus("bad", "DEGRADED"); byId("connection-note").textContent = "Loopback health route unavailable. Read-only degraded mode."; ["create-btn", "edit-btn", "review-btn"].forEach(function (id) { byId(id).disabled = true; }); show("Health check failed.", { message: error.message }); });
})();
