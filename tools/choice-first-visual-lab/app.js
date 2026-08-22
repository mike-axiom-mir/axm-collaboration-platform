(function () {
  "use strict";
  var Choice = window.AXMChoiceFirstCore, Pilot = window.AXMChoiceFirstPilotCore;
  if (!Choice || !Pilot) throw new Error("choice-first browser cores are required");
  var $ = function (id) { return document.getElementById(id); };
  var selectedProfile = "pixel-8bit", eventCounter = 0, frameCounter = 0, lastFrameAt = 0;
  var simulation, sofa, resources;

  function resetAsset() {
    var id = $("assetSelect").value;
    simulation = Choice.createSimulation(id, id + ".browser-demo");
    sofa = id === "axm.home.starter-sofa" ? Choice.createStarterSofa("sofa-browser-instance-001") : null;
    resources = { money: 620, labour_hours: 30, materials: { fasteners: 20, hardwood: 15, textile: 20, filling: 15, springs: 12, sealant: 4, mechanism: 2, cleaner: 8 } };
    $("sofaPanel").hidden = !sofa;
    updateState();
  }

  function profileRequest() {
    if (selectedProfile !== "pixel-custom") return { preset_id: selectedProfile };
    return {
      preset_id: "pixel-custom",
      axes: {
        detail: { cell_width: Number($("customSize").value), cell_height: Number($("customSize").value), edge_language: "caller-selected-pixel" },
        palette: { max_colours: Number($("customColours").value) },
        motion: { frame_rate: { numerator: Number($("customFps").value), denominator: 1 } },
      },
    };
  }

  function resolvedProfile() {
    return Choice.resolveProfile(profileRequest());
  }

  function renderGap(gap) {
    var panel = $("gapPanel");
    panel.hidden = false;
    panel.textContent = "MISSING_REPRESENTATION\n\nRequested: " + (gap.request.preset_id || "custom") + "\nMissing: " + gap.missing.join(", ") + "\n\nFallback used: false\nNearest substitute used: false";
    var canvas = $("assetCanvas"), context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    $("profileBadge").textContent = (gap.request.preset_id || "custom") + " unavailable";
    $("materialBadge").textContent = "no active representation";
    $("profileJson").textContent = JSON.stringify(gap, null, 2);
  }

  function renderAsset() {
    var resolved = resolvedProfile();
    if (resolved.status !== "READY") { renderGap(resolved); return; }
    $("gapPanel").hidden = true;
    var profile = resolved.profile;
    var frame = Pilot.render($("assetSelect").value, profile.id, frameCounter, { profile: profile, simulation: simulation, sofa: sofa });
    var canvas = $("assetCanvas"), context = canvas.getContext("2d");
    if (canvas.width !== frame.width || canvas.height !== frame.height) { canvas.width = frame.width; canvas.height = frame.height; }
    context.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height), 0, 0);
    var zoom = Number($("zoom").value);
    canvas.style.width = frame.width * zoom + "px";
    canvas.style.height = frame.height * zoom + "px";
    $("profileBadge").textContent = profile.id;
    $("materialBadge").textContent = profile.axes.target_canvas.pixel_format + " / " + profile.axes.target_canvas.colour_space;
    $("profileJson").textContent = JSON.stringify(profile.axes, null, 2);
  }

  function updateZoom() {
    $("zoomValue").textContent = $("zoom").value + "×";
    renderAsset();
  }

  function updateState(receipt) {
    var state = simulation.state;
    $("condition").textContent = state.condition.toFixed(2).replace(/\.00$/, "");
    $("cleanliness").textContent = state.cleanliness.toFixed(2).replace(/\.00$/, "");
    $("cycles").textContent = state.cycle_count;
    $("operating").textContent = state.animation_state;
    if (receipt) $("causalReceipt").textContent = receipt.event_type + " · condition Δ " + receipt.condition_delta + " · cleanliness Δ " + receipt.cleanliness_delta + " · time-only no-decay " + receipt.time_only_no_decay;
    if (sofa) updateSofa();
  }

  function applyEvent(type) {
    eventCounter += 1;
    var event = { id: "browser-event-" + eventCounter, type: type };
    if (type === "time_elapsed") event.duration_ms = 31557600000;
    if (type === "use_cycle") { event.cycles = 12; event.load_factor = 1.2; }
    if (type === "fault") event.code = "operator-demo-fault";
    if (type === "repair") { event.condition_points = 12; event.clear_faults = true; }
    var result = Choice.applySimulationEvent(simulation, event);
    simulation = result.simulation;
    updateState(result.receipt);
  }

  function updateSofa() {
    $("sofaId").textContent = sofa.id;
    $("sofaComponents").textContent = JSON.stringify(sofa.installed_components);
    $("sofaQualities").textContent = JSON.stringify(sofa.qualities);
    $("resources").textContent = "€" + resources.money + " · " + resources.labour_hours + "h · materials " + Object.keys(resources.materials).filter(function (key) { return resources.materials[key] > 0; }).map(function (key) { return key + ":" + resources.materials[key]; }).join(" ");
  }

  function buildSofaButtons() {
    var container = $("sofaUpgrades");
    Object.keys(Choice.SOFA_UPGRADES).forEach(function (id) {
      var spec = Choice.SOFA_UPGRADES[id], button = document.createElement("button");
      button.type = "button";
      button.innerHTML = "<strong>" + id.replace(/-/g, " ") + "</strong><small>€" + spec.cost.money + " · " + spec.cost.labour_hours + "h · " + (spec.slot || "service") + "</small>";
      button.addEventListener("click", function () {
        if (!sofa) return;
        var result = Choice.applySofaUpgrade(sofa, id, resources);
        sofa = result.object; resources = result.resources;
        $("causalReceipt").textContent = result.status + " · " + id + (result.shortages ? " · missing " + result.shortages.join(", ") : " · identity preserved " + (result.receipt && result.receipt.identity_preserved));
        updateSofa(); renderAsset();
      });
      container.appendChild(button);
    });
  }

  function buildProfileButtons() {
    var container = $("profileChoices");
    Choice.listRepresentationChoices().forEach(function (choice) {
      var button = document.createElement("button");
      button.type = "button"; button.dataset.profile = choice.id; button.dataset.installed = String(choice.installed); button.textContent = choice.label; button.setAttribute("aria-pressed", choice.id === selectedProfile ? "true" : "false");
      button.addEventListener("click", function () {
        selectedProfile = choice.id;
        Array.prototype.forEach.call(container.children, function (item) { item.setAttribute("aria-pressed", item === button ? "true" : "false"); });
        $("customAxes").hidden = selectedProfile !== "pixel-custom";
        renderAsset();
      });
      container.appendChild(button);
    });
  }

  function tick(now) {
    var resolved = resolvedProfile(), fps = resolved.status === "READY" ? resolved.profile.axes.motion.frame_rate.numerator / resolved.profile.axes.motion.frame_rate.denominator : 12;
    if (now - lastFrameAt >= 1000 / fps) { frameCounter += 1; lastFrameAt = now; renderAsset(); }
    requestAnimationFrame(tick);
  }

  buildProfileButtons(); buildSofaButtons(); resetAsset(); renderAsset();
  window.addEventListener("axm-game-visual-pack-selected", function (event) {
    var profileId = event && event.detail && event.detail.representationProfileId;
    var button = profileId && document.querySelector("#profileChoices [data-profile='" + profileId + "']");
    if (button) button.click();
  });
  $("assetSelect").addEventListener("change", function () { resetAsset(); renderAsset(); });
  document.querySelectorAll("[data-event]").forEach(function (button) { button.addEventListener("click", function () { applyEvent(button.dataset.event); }); });
  ["customSize", "customColours", "customFps"].forEach(function (id) { $(id).addEventListener("change", renderAsset); });
  $("zoom").addEventListener("input", updateZoom);
  $("zoom").addEventListener("change", updateZoom);
  $("zoomMinus").addEventListener("click", function () {
    $("zoom").value = Math.max(Number($("zoom").min), Number($("zoom").value) - 1);
    updateZoom();
  });
  $("zoomPlus").addEventListener("click", function () {
    $("zoom").value = Math.min(Number($("zoom").max), Number($("zoom").value) + 1);
    updateZoom();
  });
  requestAnimationFrame(tick);
})();
