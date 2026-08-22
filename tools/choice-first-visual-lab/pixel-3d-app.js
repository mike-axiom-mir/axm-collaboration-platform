(function () {
  "use strict";
  var Pixel3D = window.AXMPixel3DCore;
  if (!Pixel3D) throw new Error("pixel 3D browser core is required");
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("pixel3dCanvas"), selectedProfile = "pixel-8bit-3d", renderer = null, loadToken = 0, start = performance.now(), lastReadoutAt = 0;
  var gameState = { player: { x: 999, z: 999, yaw: 0 }, beacons: [] };
  var identitySettings = {
    "axm.park.ferris-wheel": { slug: "park-ferris-wheel", target: [0, 3.7, 0], distance: 12.5 },
    "axm.park.carousel-horse": { slug: "park-carousel-horse", target: [0, 1.05, 0], distance: 4.2 },
    "axm.park.ticket-gate": { slug: "park-ticket-gate", target: [0, 0.8, 0], distance: 4.1 },
    "axm.home.starter-sofa": { slug: "home-starter-sofa", target: [0, 0.55, 0], distance: 4.2 }
  };

  function modelUrl(identityId, profileId) {
    var slug = identitySettings[identityId].slug;
    return "pilots/pixel-3d/" + slug + "/" + profileId + "/" + slug + "-" + profileId + ".glb";
  }

  function fixedResize() {
    var profile = Pixel3D.resolveProfile(selectedProfile).profile;
    if (canvas.width !== profile.axes.target_canvas.internal_width) canvas.width = profile.axes.target_canvas.internal_width;
    if (canvas.height !== profile.axes.target_canvas.internal_height) canvas.height = profile.axes.target_canvas.internal_height;
    renderer.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function showError(message) {
    var panel = $("pixel3dError");
    panel.hidden = false;
    panel.textContent = message + "\n\nFallback used: false\nNearest substitute used: false";
  }

  function updateReadout() {
    if (!renderer || !renderer.assets.length) return;
    var summary = renderer.summaries()[0], stats = renderer.lastStats;
    $("pixel3dIdentity").textContent = $("pixel3dAsset").value;
    $("pixel3dStructure").textContent = summary.nodes + " nodes · " + summary.meshes + " meshes · " + summary.materials + " materials";
    $("pixel3dFrame").textContent = stats.draws + " draws · " + stats.triangles + " triangles";
    $("pixel3dAnimation").textContent = (summary.animation || "none") + " · " + summary.animations + " clip" + (summary.animations === 1 ? "" : "s");
  }

  async function loadSelected() {
    var token = ++loadToken, identityId = $("pixel3dAsset").value;
    var resolved = Pixel3D.resolveProfile(selectedProfile);
    if (resolved.status !== "READY") { showError(resolved.status + "\n" + resolved.missing.join(", ")); return; }
    $("pixel3dError").hidden = true;
    var url = modelUrl(identityId, selectedProfile);
    $("pixel3dDownload").href = url;
    $("pixel3dDownload").download = identitySettings[identityId].slug + "-" + selectedProfile + ".glb";
    $("pixel3dProfileBadge").textContent = selectedProfile;
    $("pixel3dResolution").textContent = resolved.profile.axes.target_canvas.internal_width + " × " + resolved.profile.axes.target_canvas.internal_height + " internal";
    try {
      if (!renderer) {
        var module = await import("../local-3d-game-runtime/native-renderer.mjs");
        if (token !== loadToken) return;
        renderer = new module.NativeWebGL2Renderer(canvas);
        if (!renderer.available) throw new Error(renderer.reason || "WebGL2 unavailable");
        renderer.resize = fixedResize;
      }
      renderer.assets.length = 0;
      var loaded = await renderer.loadAsset({ id: identityId + ":" + selectedProfile, url: url, animationPattern: /.*/ });
      if (token !== loadToken) { renderer.assets = renderer.assets.filter(function (asset) { return asset !== loaded; }); return; }
      fixedResize();
      updateReadout();
    } catch (error) {
      if (token === loadToken) showError("MISSING_REPRESENTATION\n" + (error && error.message ? error.message : error));
    }
  }

  function camera() {
    var setting = identitySettings[$("pixel3dAsset").value], angle = Number($("pixel3dOrbit").value) * Math.PI / 180;
    var distance = setting.distance * 100 / Number($("pixel3dZoom").value);
    return { eye: [Math.sin(angle) * distance, setting.target[1] + distance * .38, Math.cos(angle) * distance], target: setting.target, fov: 46 };
  }

  function tick(now) {
    if (renderer && renderer.available && renderer.assets.length) {
      renderer.render({ gameState: gameState, camera: camera(), time: (now - start) / 1000, night: false });
      if (now - lastReadoutAt >= 250) { updateReadout(); lastReadoutAt = now; }
    }
    requestAnimationFrame(tick);
  }

  $("pixel3dAsset").addEventListener("change", loadSelected);
  document.querySelectorAll("[data-pixel3d-profile]").forEach(function (button) {
    button.addEventListener("click", function () {
      selectedProfile = button.dataset.pixel3dProfile;
      document.querySelectorAll("[data-pixel3d-profile]").forEach(function (item) { item.setAttribute("aria-pressed", item === button ? "true" : "false"); });
      loadSelected();
    });
  });
  $("pixel3dLeft").addEventListener("click", function () { $("pixel3dOrbit").value = Math.max(-180, Number($("pixel3dOrbit").value) - 15); });
  $("pixel3dRight").addEventListener("click", function () { $("pixel3dOrbit").value = Math.min(180, Number($("pixel3dOrbit").value) + 15); });
  loadSelected();
  requestAnimationFrame(tick);
})();
