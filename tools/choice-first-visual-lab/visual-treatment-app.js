(function () {
  "use strict";
  var Treatment = window.AXMVisualTreatmentCore;
  if (!Treatment) throw new Error("visual treatment browser core is required");
  var $ = function (id) { return document.getElementById(id); };
  var choices = Treatment.listChoices(), renderer = null, loadToken = 0, start = performance.now(), storyboardUrl = null;
  var cameraSettings = {
    "axm.park.ferris-wheel": { target: [0, 3.7, 0], distance: 12.5, state: "running" },
    "axm.park.carousel-horse": { target: [0, 1.05, 0], distance: 4.2, state: "running" },
    "axm.park.ticket-gate": { target: [0, .8, 0], distance: 4.1, state: "open" },
    "axm.home.starter-sofa": { target: [0, .55, 0], distance: 4.2, state: "sit" }
  };
  var presets = {
    aetherglass: { style: "aetherglass-cinematic", material: "glass", effects: ["material.aetherglass", "light.neon-edge-glow", "motion.idle-pulse"] },
    comic: { style: "character-comic-vanguard", material: "painted-metal", effects: ["light.neon-edge-glow", "depth.layered-shadow"] },
    night: { style: "accessible-night-edge", material: "painted-metal", effects: ["material.dark-shell", "focus.halo", "light.soft-bloom-halo"] },
    ocean: { style: "world-oceanic-glass", material: "glass", effects: ["material.frosted-panel", "light.reflection-streak", "atmosphere.ambient-field"] }
  };
  var gameState = { player: { x: 999, z: 999, yaw: 0 }, beacons: [] };

  function option(select, value, label) { var item = document.createElement("option"); item.value = value; item.textContent = label; select.appendChild(item); }
  choices.styles.forEach(function (item) { option($("treatmentStyle"), item.id, item.name + " / " + item.family); });
  choices.materials.forEach(function (item) { option($("treatmentMaterial"), item.id, item.name); });
  choices.effects.forEach(function (item) { option($("treatmentEffects"), item.id, (item.direct_3d ? "3D + WEB · " : "WEB/TOKEN · ") + item.name); });
  $("treatmentStyleCount").textContent = choices.styles.length;
  $("treatmentEffectCount").textContent = choices.effects.length;
  $("treatmentMaterialCount").textContent = choices.materials.length;
  $("treatmentAdapterCount").textContent = choices.adapters.length;

  function setSelectedEffects(ids) {
    Array.prototype.forEach.call($("treatmentEffects").options, function (item) { item.selected = ids.indexOf(item.value) >= 0; });
  }
  function applyPreset() {
    var preset = presets[$("treatmentPreset").value];
    if (!preset) return;
    $("treatmentStyle").value = preset.style;
    $("treatmentMaterial").value = preset.material;
    setSelectedEffects(preset.effects);
  }
  function selectedEffects() { return Array.prototype.filter.call($("treatmentEffects").options, function (item) { return item.selected; }).map(function (item) { return { id: item.value, params: {} }; }); }
  function request() {
    var identityId = $("treatmentAsset").value, setting = cameraSettings[identityId];
    return {
      schema: Treatment.SCHEMAS.request,
      version: "1.0.0",
      id: "live-treatment-" + identityId.split(".").pop(),
      identity_id: identityId,
      profile_id: $("treatmentProfile").value,
      animation_state: setting.state,
      style_layers: [{ id: $("treatmentStyle").value, weight: 1 }],
      effect_modules: selectedEffects(),
      material_family: $("treatmentMaterial").value,
      story: { title: $("treatmentStoryTitle").value, nodes: [{ id: "supplied-direction", caption: $("treatmentStoryCaption").value, duration_s: 3, focus_component: identityId }] },
      accessibility: { reduced_motion: matchMedia("(prefers-reduced-motion: reduce)").matches, high_contrast: false, effect_scale: 1 },
      authority: "candidate-only"
    };
  }
  function dataDownload(value, mime) { return "data:" + mime + ";charset=utf-8," + encodeURIComponent(value); }
  function showError(message) { $("treatmentError").hidden = false; $("treatmentError").textContent = message; }

  async function compose() {
    var token = ++loadToken, result = Treatment.buildPackage(request());
    if (result.status !== "READY") {
      showError(result.status + "\n" + (result.missing || []).map(function (item) { return item.id; }).join("\n") + "\n\nFallback used: false\nNearest substitute used: false");
      $("treatmentFallback").textContent = "false / false";
      return;
    }
    $("treatmentError").hidden = true;
    $("treatmentDownload").href = result.glb.dataUrl;
    $("treatmentDownload").download = result.recipe.id + ".glb";
    $("treatmentRecipeDownload").href = dataDownload(JSON.stringify({ recipe: result.recipe, receipt: result.receipt }, null, 2), "application/json");
    $("treatmentRecipeDownload").download = result.recipe.id + "-recipe-receipt.json";
    $("treatmentStyleBadge").textContent = $("treatmentStyle").value;
    $("treatmentProfileBadge").textContent = $("treatmentProfile").value;
    $("treatmentIdentity").textContent = result.identity.id + " · preserved";
    $("treatmentDigest").textContent = result.receipt.treatment_digest;
    $("treatmentFallback").textContent = String(result.receipt.fallback_used) + " / " + String(result.receipt.nearest_substitute_used);
    var routeCounts = {};
    result.receipt.adapter_results.forEach(function (item) { routeCounts[item.route] = (routeCounts[item.route] || 0) + 1; });
    $("treatmentRoutes").textContent = Object.keys(routeCounts).sort().map(function (route) { return route + " × " + routeCounts[route]; }).join(" · ");
    if (storyboardUrl) URL.revokeObjectURL(storyboardUrl);
    storyboardUrl = URL.createObjectURL(new Blob([result.storyboard_svg], { type: "image/svg+xml" }));
    $("treatmentStoryPreview").src = storyboardUrl;
    $("treatmentMaterialPreview").src = "pilots/pbr-materials/" + $("treatmentMaterial").value + "/" + $("treatmentMaterial").value + "-preview.png";
    $("treatmentMaterialCaption").textContent = $("treatmentMaterial").value + " · 5 verified PBR maps";
    try {
      if (!renderer) {
        var module = await import("../local-3d-game-runtime/native-renderer.mjs");
        if (token !== loadToken) return;
        renderer = new module.NativeWebGL2Renderer($("treatmentCanvas"));
        if (!renderer.available) throw new Error(renderer.reason || "WebGL2 unavailable");
      }
      renderer.assets.length = 0;
      var loaded = await renderer.loadAsset({ id: result.identity.id + ":treatment", url: result.glb.dataUrl, animationPattern: /.*/ });
      if (token !== loadToken) { renderer.assets = renderer.assets.filter(function (asset) { return asset !== loaded; }); return; }
      var summary = renderer.summaries()[0];
      $("treatmentStructure").textContent = summary.nodes + " nodes · " + summary.meshes + " meshes · " + summary.materials + " materials · " + result.glb.bytes.length + " bytes";
    } catch (error) {
      if (token === loadToken) showError("LIVE_RENDER_GAP\n" + (error && error.message ? error.message : error) + "\n\nThe generated GLB remains downloadable. No fallback was used.");
    }
  }

  function proveMissing() {
    var invalid = request();
    invalid.id = "typed-missing-proof";
    invalid.effect_modules = [{ id: "cinematic.magic-nearest-effect", params: {} }];
    var result = Treatment.buildPackage(invalid);
    showError(result.status + "\n" + result.missing.map(function (item) { return item.id; }).join("\n") + "\n\nFallback used: " + result.fallback_used + "\nNearest substitute used: " + result.nearest_substitute_used);
    $("treatmentFallback").textContent = String(result.fallback_used) + " / " + String(result.nearest_substitute_used);
  }

  function tick(now) {
    if (renderer && renderer.available && renderer.assets.length) {
      var setting = cameraSettings[$("treatmentAsset").value], angle = Number($("treatmentOrbit").value) * Math.PI / 180;
      renderer.render({ gameState: gameState, camera: { eye: [Math.sin(angle) * setting.distance, setting.target[1] + setting.distance * .38, Math.cos(angle) * setting.distance], target: setting.target, fov: 46 }, time: (now - start) / 1000, night: false });
    }
    requestAnimationFrame(tick);
  }

  $("treatmentPreset").addEventListener("change", function () { applyPreset(); compose(); });
  $("treatmentCompose").addEventListener("click", compose);
  $("treatmentMissing").addEventListener("click", proveMissing);
  $("treatmentAsset").addEventListener("change", compose);
  $("treatmentProfile").addEventListener("change", compose);
  applyPreset();
  compose();
  requestAnimationFrame(tick);
})();
