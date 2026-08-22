(function () {
  "use strict";

  var Core = window.AXMMaterialSensoryCore;
  var Lookdev = window.AXMMaterialLookdevRenderer;
  if (!Core || !Lookdev) throw new Error("Material sensory core and renderer are required");

  var $ = function (id) { return document.getElementById(id); };
  var session = null;
  var renderer = new Lookdev.LookdevRenderer($("lookdevCanvas"));
  var hostHealth = null;
  var interactionCount = 0;
  var dragging = false;
  var pointer = [0, 0];
  var lastReadout = 0;
  var observationFrames = new Map();
  var downloadUrls = [];
  var frameRequestCounter = 0;

  var DEFAULT_RECIPE = {
    schema: Core.RECIPE_SCHEMA,
    version: "1.0.0",
    id: "material-sensory-brick",
    family: "brick",
    seed: "material-sensory-01",
    size: 128,
    normal_strength: 3.1,
    authority: "candidate-only"
  };

  var EXPECTED_SAMPLING = {
    "pbr-albedo-map": { interpretation: "colour", transfer_function: "srgb", channel_semantics: { r: "base-color-red", g: "base-color-green", b: "base-color-blue", a: "opacity" }, wrap: "repeat" },
    "pbr-normal-map": { interpretation: "data", transfer_function: "linear", channel_semantics: { r: "tangent-x", g: "tangent-y-positive-opengl", b: "tangent-z", a: "one" }, wrap: "repeat" },
    "pbr-orm-map": { interpretation: "data", transfer_function: "linear", channel_semantics: { r: "ambient-occlusion", g: "roughness", b: "metalness", a: "one" }, wrap: "repeat" },
    "pbr-emissive-map": { interpretation: "colour", transfer_function: "srgb", channel_semantics: { r: "emissive-red", g: "emissive-green", b: "emissive-blue", a: "one" }, wrap: "repeat" },
    "pbr-height-map": { interpretation: "data", transfer_function: "linear", channel_semantics: { r: "height", g: "height", b: "height", a: "one" }, wrap: "repeat" },
    "pbr-material-preview": { interpretation: "colour", transfer_function: "srgb", channel_semantics: { r: "reference-preview-red", g: "reference-preview-green", b: "reference-preview-blue", a: "one" }, wrap: "clamp" }
  };

  var MAP_ELEMENTS = {
    "pbr-albedo-map": "mapAlbedoImage",
    "pbr-normal-map": "mapNormalImage",
    "pbr-orm-map": "mapOrmImage",
    "pbr-emissive-map": "mapEmissiveImage",
    "pbr-height-map": "mapHeightImage",
    "pbr-material-preview": "mapPreviewImage"
  };

  function setBadge(element, text, state) {
    element.textContent = text;
    element.className = "badge" + (state ? " " + state : "");
  }

  function diagnostic(message, details) {
    var box = $("diagnostic");
    box.hidden = false;
    box.textContent = String(message || "Material operation failed") + (details ? "\n" + String(details) : "");
  }

  function clearDiagnostic() {
    $("diagnostic").hidden = true;
    $("diagnostic").textContent = "";
  }

  function frameApi(pathname, body) {
    return new Promise(function (resolve, reject) {
      var name = "axm-material-host-frame-" + (++frameRequestCounter), frame = document.createElement("iframe"), form = null, submitted = false, timer;
      frame.name = name; frame.hidden = true; frame.setAttribute("aria-hidden", "true");
      function cleanup() { clearTimeout(timer); if (form) form.remove(); frame.remove(); }
      frame.addEventListener("load", function () {
        if (!submitted) return;
        try {
          var text = frame.contentDocument && frame.contentDocument.body && frame.contentDocument.body.textContent || "";
          var payload = JSON.parse(text);
          cleanup();
          if (payload && payload.schema === "axm.asset-material-host-error/v1") {
            var error = new Error(payload.message || payload.error || "Material host request failed");
            error.code = payload.code || "HOST_REQUEST_FAILED";
            reject(error);
          } else resolve(payload);
        } catch (error) { cleanup(); reject(new Error("Material host frame returned unreadable data: " + error.message)); }
      });
      timer = setTimeout(function () { cleanup(); reject(new Error("Material host frame request timed out")); }, 30000);
      if (body == null) {
        frame.src = pathname; submitted = true; document.body.appendChild(frame);
        return;
      }
      document.body.appendChild(frame);
      form = document.createElement("form"); form.method = "POST"; form.action = pathname; form.target = name; form.hidden = true;
      var field = document.createElement("input"); field.type = "hidden"; field.name = "payload"; field.value = JSON.stringify(body);
      form.appendChild(field); document.body.appendChild(form); submitted = true; form.submit();
    });
  }

  async function api(pathname, body) {
    if (typeof fetch === "function") {
      try {
        var response = await fetch(pathname, {
          method: body == null ? "GET" : "POST",
          headers: body == null ? {} : { "Content-Type": "application/json" },
          body: body == null ? null : JSON.stringify(body),
          cache: "no-store"
        });
        var payload;
        try { payload = await response.json(); }
        catch (_error) { throw new Error("Material host returned non-JSON data"); }
        if (!response.ok) {
          var responseError = new Error(payload.message || payload.error || ("Material host HTTP " + response.status));
          responseError.code = payload.code || "HOST_REQUEST_FAILED";
          throw responseError;
        }
        return payload;
      } catch (error) {
        if (error && error.code) throw error;
      }
    }
    return frameApi(pathname, body);
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(function (key) { return [key, stable(value[key])]; }));
    return value;
  }

  function canonical(value) { return JSON.stringify(stable(value)); }

  async function shaText(value) {
    var bytes = new TextEncoder().encode(typeof value === "string" ? value : canonical(value));
    return Lookdev.sha256Hex(bytes.buffer);
  }

  function exact(a, b) { return canonical(a) === canonical(b); }

  function inspectPngBytes(id, buffer, artifact, recipeSize) {
    var bytes = new Uint8Array(buffer);
    var signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 33 || !signature.every(function (value, index) { return bytes[index] === value; })) throw new Error(id + " PNG signature/IHDR is invalid");
    if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") throw new Error(id + " PNG has no leading IHDR chunk");
    var view = new DataView(buffer), width = view.getUint32(16), height = view.getUint32(20);
    if (width !== height || width !== recipeSize || width !== artifact.width || height !== artifact.height || width < 32 || width > 512) throw new Error(id + " PNG dimensions disagree with the bounded recipe/artifact envelope");
    return { width: width, height: height };
  }

  async function clientGateRawResult(result) {
    if (!result || result.schema !== Core.RESULT_SCHEMA || !result.hand || result.hand.id !== Core.HAND_ID || result.hand.version !== Core.HAND_VERSION) throw new Error("Serialized result must come from pbr-material-bake@1.1.0");
    if (result.status !== "READY" || !result.technical || result.technical.pass !== true || !result.validation_receipt || result.validation_receipt.status !== "PASS") throw new Error("Serialized HOLD/FAIL result is diagnostic-only and cannot bind");
    if (!result.hand || result.hand.authority !== "candidate-only" || !result.provenance || result.provenance.authority !== "candidate-only") throw new Error("Serialized result authority mismatch");
    if (!result.creation_recipe || ["create", "edit"].indexOf(result.creation_recipe.operation_mode) < 0) throw new Error("Serialized result must bind a create or edit operation");
    if (result.previewArtifactId !== "pbr-material-preview" || !result.preview || result.preview.available !== true || result.preview.artifactId !== "pbr-material-preview") throw new Error("Serialized result must retain the static reference preview pointer");
    var serializedBytes = new TextEncoder().encode(JSON.stringify(result)).length;
    if (serializedBytes > 12 * 1024 * 1024) throw new Error("RESPONSE_BUDGET_EXCEEDED: serialized result exceeds 12 MiB");
    if (!Array.isArray(result.artifacts) || result.artifacts.length !== 8) throw new Error("Serialized result must contain exactly eight artifacts");
    var artifacts = {};
    result.artifacts.forEach(function (artifact) {
      if (!artifact || typeof artifact.id !== "string" || artifacts[artifact.id]) throw new Error("Serialized artifact ids must be present and unique");
      artifacts[artifact.id] = artifact;
    });
    var recipeArtifact = artifacts["editable-pbr-material-recipe"], receiptArtifact = artifacts["pbr-material-bake-receipt"];
    if (!recipeArtifact || !receiptArtifact) throw new Error("Serialized recipe and machine receipt are required");
    if (recipeArtifact.role !== "editable-pbr-material-recipe" || recipeArtifact.mime !== "application/json" || recipeArtifact.format !== "JSON" || recipeArtifact.editable !== true || !recipeArtifact.metadata || recipeArtifact.metadata.schema !== Core.RECIPE_SCHEMA || recipeArtifact.metadata.candidateOnly !== true || recipeArtifact.metadata.canonical !== false) throw new Error("Serialized recipe artifact envelope mismatch");
    if (receiptArtifact.role !== "pbr-material-bake-receipt" || receiptArtifact.mime !== "application/json" || receiptArtifact.format !== "JSON" || receiptArtifact.editable !== false || !receiptArtifact.metadata || receiptArtifact.metadata.schema !== "axm.pbr-material-bake-receipt/v1" || receiptArtifact.metadata.candidateOnly !== true || receiptArtifact.metadata.canonical !== false) throw new Error("Serialized machine receipt artifact envelope mismatch");
    var recipe = JSON.parse(recipeArtifact.text), machineReceipt = JSON.parse(receiptArtifact.text);
    Core.validateRecipe(recipe);
    if (machineReceipt.schema !== "axm.pbr-material-bake-receipt/v1" || machineReceipt.version !== "1.0.0" || machineReceipt.status !== "PASS" || machineReceipt.deterministic !== true || machineReceipt.recipe_id !== recipe.id || machineReceipt.family !== recipe.family || machineReceipt.size !== recipe.size) throw new Error("Serialized machine receipt does not bind the recipe");
    if (!machineReceipt.authority || machineReceipt.authority.candidate_only !== true || machineReceipt.authority.installed !== false || machineReceipt.authority.promoted !== false || machineReceipt.authority.canonical !== false || machineReceipt.authority.human_review_required !== true) throw new Error("Serialized machine receipt authority mismatch");
    if (!result.target_canvas || !result.target_canvas.dimensions || result.target_canvas.dimensions.width !== recipe.size || result.target_canvas.dimensions.height !== recipe.size) throw new Error("Serialized target canvas does not bind recipe size");
    var pngs = [], pngSha = {}, transport = {};
    for (var artifact of result.artifacts) transport[artifact.id] = artifact.digest;
    for (var id of Object.keys(EXPECTED_SAMPLING)) {
      var pngArtifact = artifacts[id];
      if (!pngArtifact || pngArtifact.role !== id || pngArtifact.mime !== "image/png" || pngArtifact.format !== "PNG" || pngArtifact.editable !== false || !pngArtifact.metadata || pngArtifact.metadata.schema !== "PNG.1.0" || pngArtifact.metadata.candidateOnly !== true || pngArtifact.metadata.canonical !== false) throw new Error(id + " envelope mismatch");
      if (!exact(pngArtifact.metadata.sampling, EXPECTED_SAMPLING[id])) throw new Error(id + " sampling contract mismatch");
      var expectedMap = id === "pbr-material-preview" ? "preview" : id.replace(/^pbr-/, "").replace(/-map$/, "");
      if (pngArtifact.metadata.map !== expectedMap) throw new Error(id + " map semantic mismatch");
      if (id === "pbr-normal-map" && pngArtifact.metadata.normalConvention !== "OpenGL tangent space; +Y green; texture V increases downward") throw new Error("Normal convention mismatch");
      if (id === "pbr-orm-map" && !exact(pngArtifact.metadata.packing, { red: "ambient-occlusion", green: "roughness", blue: "metalness" })) throw new Error("ORM packing mismatch");
      var arrayBuffer = await Lookdev.bytesFromDataUrl(pngArtifact.dataUrl);
      var dimensions = inspectPngBytes(id, arrayBuffer, pngArtifact, recipe.size);
      var fullSha = await Lookdev.sha256Hex(arrayBuffer);
      pngSha[id] = fullSha;
      pngs.push({ id: id, role: id, transport_digest: pngArtifact.digest, byte_sha256: fullSha, bytes: arrayBuffer.byteLength, width: dimensions.width, height: dimensions.height, sampling: EXPECTED_SAMPLING[id] });
    }
    var samplingDigest = await shaText(EXPECTED_SAMPLING);
    return {
      schema: Core.HANDOFF_SCHEMA,
      version: "1.0.0",
      status: "PASS",
      hand: { id: Core.HAND_ID, version: Core.HAND_VERSION },
      operation_mode: result.creation_recipe.operation_mode,
      result_digest: result.digest,
      recipe_digest: await shaText(recipe),
      recipe_artifact_digest: recipeArtifact.digest,
      receipt_artifact_digest: receiptArtifact.digest,
      artifact_transport_digests: transport,
      pngs: pngs,
      png_sha256: pngSha,
      sampling_contract: EXPECTED_SAMPLING,
      sampling_contract_digest: samplingDigest,
      total_png_bytes: pngs.reduce(function (sum, png) { return sum + png.bytes; }, 0),
      serialized_result_bytes: serializedBytes,
      budgets: { request_body_max_bytes: 262144, response_body_max_bytes: 12582912 },
      authority: { candidate_only: true, installed: false, promoted: false, canonical: false, human_review_required: true },
      claims: { deterministic_png_bytes: true, technical_material_verification: true, dynamic_browser_render_observed: false, target_renderer_parity: false, physical_surface_verified: false, human_aesthetic_approval: false }
    };
  }

  function activeBundle() { return session ? Core.activeBundle(session) : null; }
  function activeKey() { var bundle = activeBundle(); return bundle ? bundle.result.digest : null; }

  async function bindCandidate(result, handoff, initial) {
    var previousCurrentDigest = session && session.current_result_digest;
    var sourceDigest = session && session.source_result_digest;
    Core.inspectBundle(result, handoff);
    if (renderer.available) await renderer.loadCandidate(result.digest, result, handoff);
    if (initial || !session) session = Core.createSession(result, handoff);
    else Core.bindRegeneratedResult(session, result, handoff);
    if (renderer.available && previousCurrentDigest && previousCurrentDigest !== sourceDigest && previousCurrentDigest !== result.digest) renderer.dropCandidate(previousCurrentDigest);
    if (renderer.available) renderer.selectCandidate(activeKey());
    clearDiagnostic();
    syncAll();
  }

  function artifact(bundle, id) { return bundle && bundle.result.artifacts.find(function (item) { return item.id === id; }); }

  function syncMaps() {
    var bundle = activeBundle();
    Object.keys(MAP_ELEMENTS).forEach(function (id) {
      var image = $(MAP_ELEMENTS[id]), item = artifact(bundle, id);
      if (item) image.src = item.dataUrl; else image.removeAttribute("src");
    });
    $("mapSizeLabel").textContent = bundle ? (bundle.recipe.size + " × " + bundle.recipe.size + " · " + bundle.recipe.family) : "No maps loaded";
  }

  function syncRecipe() {
    var recipe = session && session.draft_recipe;
    $("recipeFieldset").disabled = !session || !hostHealth || hostHealth.status !== "READY";
    if (!recipe) return;
    $("recipeId").value = recipe.id;
    $("recipeFamily").value = recipe.family;
    $("recipeSeed").value = recipe.seed;
    $("recipeSize").value = String(recipe.size);
    $("normalStrength").value = String(recipe.normal_strength);
    $("normalStrengthOutput").textContent = Number(recipe.normal_strength).toFixed(2);
    $("draftStatus").textContent = session.pending_edit
      ? session.pending_edit.changes.length + " staged field" + (session.pending_edit.changes.length === 1 ? "" : "s") + " · current rendered candidate preserved until READY/PASS regeneration"
      : "No staged edit.";
  }

  function syncViewerControls() {
    var viewer = session ? session.viewer : Core.defaultViewer();
    $("viewMode").value = viewer.view_mode;
    $("uvTiling").value = viewer.uv_tiling; $("tilingOutput").textContent = Number(viewer.uv_tiling).toFixed(2) + "×";
    $("lightAzimuth").value = viewer.light_azimuth_deg; $("lightAzimuthOutput").textContent = Math.round(viewer.light_azimuth_deg) + "°";
    $("lightElevation").value = viewer.light_elevation_deg; $("lightElevationOutput").textContent = Math.round(viewer.light_elevation_deg) + "°";
    $("lightIntensity").value = viewer.light_intensity; $("lightIntensityOutput").textContent = Number(viewer.light_intensity).toFixed(2);
    $("ambientIntensity").value = viewer.ambient_intensity; $("ambientOutput").textContent = Number(viewer.ambient_intensity).toFixed(2);
    $("fillIntensity").value = viewer.fill_intensity; $("fillOutput").textContent = Number(viewer.fill_intensity).toFixed(2);
    $("exposure").value = viewer.exposure; $("exposureOutput").textContent = Number(viewer.exposure).toFixed(2);
    $("background").value = viewer.background;
    $("mapAlbedo").checked = viewer.albedo_enabled; $("mapNormal").checked = viewer.normal_enabled; $("mapOrm").checked = viewer.orm_enabled; $("mapEmissive").checked = viewer.emissive_enabled;
    $("highContrast").checked = viewer.high_contrast_ui; $("reducedMotion").checked = viewer.reduced_motion;
    $("shapeSphere").setAttribute("aria-pressed", String(viewer.geometry === "sphere"));
    $("shapePlane").setAttribute("aria-pressed", String(viewer.geometry === "plane"));
    $("compareOriginal").setAttribute("aria-pressed", String(viewer.comparison_source === "original"));
    $("compareCurrent").setAttribute("aria-pressed", String(viewer.comparison_source === "current"));
    document.body.classList.toggle("high-contrast", viewer.high_contrast_ui);
    document.body.classList.toggle("reduced-motion", viewer.reduced_motion);
  }

  function syncEvidence() {
    var bundle = activeBundle();
    $("resultDigest").textContent = bundle ? bundle.result.digest : "—";
    $("recipeDigest").textContent = bundle ? bundle.handoff.recipe_digest : "—";
    $("samplingDigest").textContent = bundle ? bundle.handoff.sampling_contract_digest : "—";
    $("viewerDigest").textContent = session ? session.viewer_state_digest : "—";
    $("candidateLabel").textContent = bundle ? (session.viewer.comparison_source.toUpperCase() + " · " + bundle.recipe.family + " · " + bundle.result.digest) : "No candidate bound";
    $("downloadPatch").disabled = !session;
    var rows = $("shaRows");
    rows.replaceChildren();
    if (!bundle) { var empty = document.createElement("tr"); empty.innerHTML = "<td colspan=\"2\">No candidate bound.</td>"; rows.appendChild(empty); return; }
    bundle.handoff.pngs.forEach(function (png) {
      var row = document.createElement("tr"), name = document.createElement("td"), hash = document.createElement("td");
      name.textContent = png.id.replace(/^pbr-/, "").replace(/-map$/, ""); hash.textContent = png.byte_sha256;
      row.append(name, hash); rows.appendChild(row);
    });
  }

  function syncReview() {
    var dynamic = session && renderer.available && Core.hasDynamicObservation(session);
    $("saveReview").disabled = !session;
    $("downloadReceipt").disabled = !session || !session.human_judgment;
    if (!session) $("reviewState").textContent = "WAITING FOR A GATED CANDIDATE";
    else if (!renderer.available) $("reviewState").textContent = "RAW-ONLY DEGRADED · ACCEPT FOR TEST DISABLED";
    else if (!dynamic) $("reviewState").textContent = "CHANGE LIGHT / MAPS TO REVIEW";
    else if (session.human_judgment) $("reviewState").textContent = "CURRENT REVIEW BOUND · " + session.human_judgment.verdict;
    else $("reviewState").textContent = "DYNAMIC VIEW OBSERVED · HUMAN VERDICT OPEN";
    var history = session && session.stale_review_history || [];
    $("reviewHistory").textContent = history.length
      ? history.length + " stale review" + (history.length === 1 ? "" : "s") + " preserved: " + history.map(function (item) { return item.reason; }).join(", ")
      : "No stale review history.";
    document.body.dataset.dynamicObserved = String(!!dynamic);
    document.body.dataset.reviewCurrent = String(!!(session && session.human_judgment));
  }

  function syncStatus() {
    setBadge($("hostBadge"), hostHealth ? ("HOST " + hostHealth.status) : "HOST UNAVAILABLE", hostHealth && hostHealth.status === "READY" ? "ready" : "degraded");
    setBadge($("handBadge"), hostHealth && hostHealth.hand_registered ? "HAND 1.1.0" : "HAND UNAVAILABLE", hostHealth && hostHealth.hand_registered ? "ready" : "degraded");
    setBadge($("gateBadge"), session ? "GATE PASS" : "GATE WAITING", session ? "ready" : "degraded");
    setBadge($("renderBadge"), renderer.available ? (session ? "WEBGL2 READY" : "WEBGL2 WAITING") : "RAW ONLY", renderer.available ? "ready" : "degraded");
    var overlay = $("canvasOverlay");
    if (!renderer.available) { overlay.hidden = false; overlay.textContent = "WebGL2 unavailable. Raw maps remain inspectable; ACCEPT_FOR_TEST is disabled."; }
    else if (!session) { overlay.hidden = false; overlay.textContent = "Waiting for a gated material candidate."; }
    else overlay.hidden = true;
  }

  function syncRuntimeMarkers() {
    document.body.dataset.resultDigest = session ? session.current_result_digest : "";
    document.body.dataset.recipeDigest = session ? session.current_recipe_digest : "";
    document.body.dataset.viewerDigest = session ? session.viewer_state_digest : "";
    document.body.dataset.comparison = session ? session.viewer.comparison_source : "";
  }

  function syncAll() {
    if (session && renderer.available && renderer.cache.has(activeKey())) renderer.selectCandidate(activeKey());
    syncStatus(); syncViewerControls(); syncRecipe(); syncMaps(); syncEvidence(); syncReview();
    syncRuntimeMarkers();
  }

  function applyViewerPatch(patch, countInteraction) {
    if (!session) return;
    Core.setViewer(session, patch);
    if (countInteraction) interactionCount += 1;
    $("dynamicObserved").checked = false;
    if (renderer.available && renderer.cache.has(activeKey())) renderer.selectCandidate(activeKey());
    syncViewerControls(); syncMaps(); syncEvidence(); syncReview(); syncRuntimeMarkers();
  }

  function stageRecipe(field, value) {
    if (!session) return;
    try { Core.applyRecipeEdit(session, field, value); clearDiagnostic(); syncRecipe(); syncEvidence(); }
    catch (error) { diagnostic("Recipe edit refused", error.message); syncRecipe(); }
  }

  async function regenerate() {
    if (!session || !session.pending_edit) { diagnostic("No staged edit", "Change one or more recipe fields before regeneration."); return; }
    $("regenerate").disabled = true;
    $("draftStatus").textContent = "Regenerating and gating all eight artifacts…";
    try {
      var payload = await api("/api/edit", { recipe: session.draft_recipe, brief: session.current_result.brief, seed: session.draft_recipe.seed });
      if (payload.status !== "READY") {
        Core.recordRegenerationFailure(session, payload.diagnostic || { code: payload.status, message: "Material result was held" });
        diagnostic("Regeneration " + payload.status + " · prior candidate preserved", payload.diagnostic ? (payload.diagnostic.code + "\n" + payload.diagnostic.message + (payload.diagnostic.failed_checks && payload.diagnostic.failed_checks.length ? "\n" + JSON.stringify(payload.diagnostic.failed_checks, null, 2) : "")) : "No reviewable result returned.");
        syncAll();
        return;
      }
      await bindCandidate(payload.result, payload.handoff, false);
      $("dynamicObserved").checked = false;
    } catch (error) {
      Core.recordRegenerationFailure(session, { code: error.code || "HOST_REQUEST_FAILED", message: error.message });
      diagnostic("Regeneration failed · prior candidate preserved", (error.code || "HOST_REQUEST_FAILED") + "\n" + error.message);
      syncAll();
    } finally {
      $("regenerate").disabled = false;
    }
  }

  function collectObservations() {
    var output = {};
    document.querySelectorAll("[data-observation]").forEach(function (select) { output[select.dataset.observation] = select.value; });
    return output;
  }

  function downloadJson(filename, value) {
    var url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    downloadUrls.push(url);
    var link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); downloadUrls = downloadUrls.filter(function (item) { return item !== url; }); }, 1000);
  }

  async function loadSerialized(file) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { diagnostic("Serialized result refused", "RESPONSE_BUDGET_EXCEEDED: file exceeds 12 MiB"); return; }
    try {
      var value = JSON.parse(await file.text()), result, handoff;
      if (value && value.schema === "axm.asset-material-host-result/v1") {
        if (value.status !== "READY") throw new Error("Serialized HOLD/FAIL envelope is diagnostic-only");
        result = value.result; handoff = value.handoff;
      } else { result = value; handoff = await clientGateRawResult(result); }
      await bindCandidate(result, handoff, !session);
      hostHealth = hostHealth || { status: "DEGRADED", hand_registered: false };
      syncAll();
    } catch (error) { diagnostic("Serialized result refused", error.message); }
  }

  function bindControls() {
    $("shapeSphere").addEventListener("click", function () { applyViewerPatch({ geometry: "sphere" }, true); });
    $("shapePlane").addEventListener("click", function () { applyViewerPatch({ geometry: "plane" }, true); });
    $("compareOriginal").addEventListener("click", function () { applyViewerPatch({ comparison_source: "original" }, true); });
    $("compareCurrent").addEventListener("click", function () { applyViewerPatch({ comparison_source: "current" }, true); });
    $("resetView").addEventListener("click", function () { if (session) { Core.resetViewer(session); interactionCount += 1; $("dynamicObserved").checked = false; syncAll(); } });
    var viewerBindings = [
      ["viewMode", "view_mode", "change", function (value) { return value; }],
      ["uvTiling", "uv_tiling", "input", Number],
      ["lightAzimuth", "light_azimuth_deg", "input", Number],
      ["lightElevation", "light_elevation_deg", "input", Number],
      ["lightIntensity", "light_intensity", "input", Number],
      ["ambientIntensity", "ambient_intensity", "input", Number],
      ["fillIntensity", "fill_intensity", "input", Number],
      ["exposure", "exposure", "input", Number],
      ["background", "background", "change", function (value) { return value; }]
    ];
    viewerBindings.forEach(function (binding) {
      $(binding[0]).addEventListener(binding[2], function () { var patch = {}; patch[binding[1]] = binding[3](this.value); applyViewerPatch(patch, true); });
    });
    [["mapAlbedo", "albedo_enabled"], ["mapNormal", "normal_enabled"], ["mapOrm", "orm_enabled"], ["mapEmissive", "emissive_enabled"], ["highContrast", "high_contrast_ui"], ["reducedMotion", "reduced_motion"]].forEach(function (binding) {
      $(binding[0]).addEventListener("change", function () { var patch = {}; patch[binding[1]] = this.checked; applyViewerPatch(patch, true); });
    });
    $("recipeId").addEventListener("change", function () { stageRecipe("id", this.value); });
    $("recipeFamily").addEventListener("change", function () { stageRecipe("family", this.value); });
    $("recipeSeed").addEventListener("change", function () { stageRecipe("seed", this.value); });
    $("recipeSize").addEventListener("change", function () { stageRecipe("size", Number(this.value)); });
    $("normalStrength").addEventListener("input", function () { $("normalStrengthOutput").textContent = Number(this.value).toFixed(2); stageRecipe("normal_strength", Number(this.value)); });
    $("regenerate").addEventListener("click", regenerate);
    $("cancelDraft").addEventListener("click", function () { if (session) { Core.cancelPendingEdit(session); clearDiagnostic(); syncRecipe(); } });
    document.querySelectorAll("[data-map-mode]").forEach(function (button) {
      button.addEventListener("click", function () { applyViewerPatch({ view_mode: button.dataset.mapMode }, true); });
    });
    $("reviewForm").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!session) return;
      try {
        Core.recordHumanJudgment(session, {
          reviewer: $("reviewer").value,
          verdict: $("verdict").value,
          dynamic_view_observed: $("dynamicObserved").checked,
          observations: collectObservations(),
          notes: $("reviewNotes").value
        });
        clearDiagnostic(); syncReview();
      } catch (error) { diagnostic("Review not saved", error.message); }
    });
    $("downloadReceipt").addEventListener("click", function () { if (session && session.human_judgment) { var receipt = Core.createReceipt(session); downloadJson("material-sensory-review-" + receipt.digest.replace(":", "-") + ".json", receipt); } });
    $("downloadPatch").addEventListener("click", function () { if (session) { var patch = Core.machinePatch(session); downloadJson("material-machine-patch-" + patch.digest.replace(":", "-") + ".json", patch); } });
    $("serializedResult").addEventListener("change", function () { loadSerialized(this.files && this.files[0]); this.value = ""; });

    var canvas = $("lookdevCanvas");
    canvas.addEventListener("pointerdown", function (event) { dragging = true; pointer = [event.clientX, event.clientY]; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointermove", function (event) {
      if (!dragging || !session) return;
      var dx = event.clientX - pointer[0], dy = event.clientY - pointer[1]; pointer = [event.clientX, event.clientY];
      applyViewerPatch({ orbit_deg: session.viewer.orbit_deg + dx * .45, pitch_deg: Math.max(-80, Math.min(80, session.viewer.pitch_deg - dy * .35)) }, true);
    });
    canvas.addEventListener("pointerup", function (event) { dragging = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); });
    canvas.addEventListener("pointercancel", function () { dragging = false; });
    canvas.addEventListener("wheel", function (event) { if (!session) return; event.preventDefault(); applyViewerPatch({ zoom: Math.max(1.4, Math.min(8, session.viewer.zoom + event.deltaY * .004)) }, true); }, { passive: false });
    canvas.addEventListener("keydown", function (event) {
      if (!session) return;
      var patch = null;
      if (event.key === "ArrowLeft") patch = { orbit_deg: session.viewer.orbit_deg - 8 };
      if (event.key === "ArrowRight") patch = { orbit_deg: session.viewer.orbit_deg + 8 };
      if (event.key === "ArrowUp") patch = { pitch_deg: Math.min(80, session.viewer.pitch_deg + 6) };
      if (event.key === "ArrowDown") patch = { pitch_deg: Math.max(-80, session.viewer.pitch_deg - 6) };
      if (event.key === "+" || event.key === "=") patch = { zoom: Math.max(1.4, session.viewer.zoom - .25) };
      if (event.key === "-" || event.key === "_") patch = { zoom: Math.min(8, session.viewer.zoom + .25) };
      if (patch) { event.preventDefault(); applyViewerPatch(patch, true); }
    });
  }

  function tick(now) {
    if (session && renderer.available && renderer.cache.has(activeKey())) {
      var stats = renderer.render(session.viewer);
      if (stats) {
        var key = [activeKey(), session.viewer_state_digest, session.viewer.comparison_source].join(":");
        var count = (observationFrames.get(key) || 0) + 1; observationFrames.set(key, count);
        if (count === 4) {
          try {
            Core.recordRenderObservation(session, { webgl2: true, dynamic_frame_observed: true, result_digest: activeKey(), viewer_state_digest: session.viewer_state_digest, frame_count: count, interaction_count: interactionCount, renderer_id: renderer.info().id });
            syncReview();
          } catch (error) { diagnostic("Render observation rejected", error.message); }
        }
        if (now - lastReadout > 250) {
          $("viewerReadout").textContent = stats.width + "×" + stats.height + " · " + stats.triangles.toLocaleString("en-US") + " triangles · " + stats.geometry + " · " + stats.viewMode + " · result " + stats.resultDigest;
          lastReadout = now;
        }
      }
    }
    requestAnimationFrame(tick);
  }

  async function boot() {
    bindControls();
    syncAll();
    try {
      hostHealth = await api("/api/health");
      syncAll();
      if (hostHealth.status === "READY") {
        var payload = await api("/api/create", { recipe: DEFAULT_RECIPE, seed: DEFAULT_RECIPE.seed });
        if (payload.status === "READY") await bindCandidate(payload.result, payload.handoff, true);
        else diagnostic("Initial candidate is not reviewable", payload.diagnostic && (payload.diagnostic.code + "\n" + payload.diagnostic.message));
      }
    } catch (error) {
      hostHealth = { status: "DEGRADED", hand_registered: false };
      diagnostic("Host unavailable · serialized read-only mode", error.message);
      syncAll();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("beforeunload", function () { downloadUrls.forEach(function (url) { URL.revokeObjectURL(url); }); });
  window.__AXM_MATERIAL_WORKBENCH__ = {
    getSession: function () { return session; },
    getRenderer: function () { return renderer; },
    getHostHealth: function () { return hostHealth; },
    clientGateRawResult: clientGateRawResult,
    applyViewerPatch: applyViewerPatch
  };

  boot();
})();
