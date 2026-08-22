(function () {
  "use strict";
  var Core = window.AXMGameVisualPackCore;
  if (!Core) throw new Error("game visual pack browser core is required");
  var $ = function (id) { return document.getElementById(id); };
  var game = Core.createPilotGameContract();
  var packs = Core.createPilotPacks(game);
  var hardwareProfiles = Core.createHardwareProfiles();
  var inventory = Core.createInventory(game, packs);
  var save = Core.createPilotSave();
  var activePackId = game.baseline_policy.pack_id;
  var recommendation = null;

  function hardware() {
    return hardwareProfiles.find(function (profile) { return profile.id === $("hardwareProfileSelect").value; }) || hardwareProfiles[0];
  }

  function inventoryEntry(packId) {
    return inventory.entries.find(function (entry) { return entry.pack_id === packId; });
  }

  function compactBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(bytes % 1073741824 ? 1 : 0) + " GB";
    return Math.round(bytes / 1048576) + " MB";
  }

  function request(mode, packId, acceptRecommendation) {
    var value = Core.createSelectionRequest({
      id: "browser-game-layer-" + hardware().id.split(".").pop() + "-" + mode,
      mode: mode,
      game_contract: game,
      packs: packs,
      hardware_profile: hardware(),
      inventory: inventory,
      save_state: save,
      current_pack_id: activePackId
    });
    if (packId) value.requested_pack_id = packId;
    if (acceptRecommendation) value.accept_recommendation = true;
    return value;
  }

  function renderTruth() {
    $("gameTruthDigest").textContent = Core.digest({ simulation: game.simulation_contract, gameplay: game.gameplay_proxy_contract });
    $("saveDigest").textContent = Core.digest(save);
    var active = packs.find(function (pack) { return pack.id === activePackId; });
    $("activePackLabel").textContent = active ? active.title : "none";
    $("stagePackTitle").textContent = active ? active.title : "No active layer";
    $("gameLayerStage").dataset.activePack = active && active.representation_profiles[0] === "pixel-16bit" ? "pixel-16bit" : "pixel-8bit";
    Array.prototype.forEach.call(document.querySelectorAll(".game-pack-choice"), function (button) {
      button.setAttribute("aria-pressed", button.dataset.packId === activePackId ? "true" : "false");
    });
  }

  function renderStatus(result) {
    var panel = $("packSelectionStatus");
    panel.dataset.status = result.status;
    var lines = [result.status, result.message];
    if (result.status !== "SELECTED") lines.push("Active layer unchanged: " + (result.active_pack_changed === false));
    lines.push("Save unchanged: " + (result.save_digest_before === result.save_digest_after));
    lines.push("Fallback used: " + result.fallback_used);
    panel.textContent = lines.join("\n");
  }

  function recommend() {
    var result = Core.resolveSelection(request("recommend"));
    recommendation = result.recommendation;
    $("recommendedPackLabel").textContent = recommendation ? recommendation.title : "No compatible installed pack";
    $("acceptRecommendation").disabled = !recommendation;
    renderStatus(result);
    renderTruth();
  }

  function select(packId, acceptRecommendation) {
    var result = Core.resolveSelection(request("select", packId, acceptRecommendation));
    if (result.status === "SELECTED") {
      activePackId = result.selection.pack_id;
      var selectedPack = packs.find(function (pack) { return pack.id === activePackId; });
      var profileId = selectedPack && selectedPack.representation_profiles[0];
      if (profileId === "pixel-8bit" || profileId === "pixel-16bit") {
        window.dispatchEvent(new CustomEvent("axm-game-visual-pack-selected", { detail: { packId: activePackId, representationProfileId: profileId } }));
      }
    }
    renderStatus(result);
    renderTruth();
  }

  function buildHardwareChoices() {
    hardwareProfiles.forEach(function (profile) {
      var option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.label;
      $("hardwareProfileSelect").appendChild(option);
    });
    $("hardwareProfileSelect").value = "axm.hardware.family-laptop";
  }

  function buildPackChoices() {
    packs.forEach(function (pack) {
      var entry = inventoryEntry(pack.id);
      var button = document.createElement("button");
      button.type = "button";
      button.className = "game-pack-choice";
      button.dataset.packId = pack.id;
      button.dataset.state = entry ? entry.state : "UNAVAILABLE";
      button.setAttribute("aria-pressed", pack.id === activePackId ? "true" : "false");
      button.innerHTML = "<strong>" + pack.title + "</strong><small>" + pack.art_direction.intent + "</small><small>" + pack.requirements.memory_mb + " MB RAM / " + pack.requirements.video_memory_mb + " MB VRAM / " + compactBytes(pack.package.bytes) + "</small><em>" + (entry ? entry.state.replace(/_/g, " ") : "UNAVAILABLE") + "</em>";
      button.addEventListener("click", function () { select(pack.id, false); });
      $("gamePackChoices").appendChild(button);
    });
  }

  function buildSlotCoverage() {
    game.required_visual_slots.forEach(function (slot) {
      var badge = document.createElement("span");
      badge.textContent = slot;
      $("visualSlotList").appendChild(badge);
    });
  }

  buildHardwareChoices();
  buildPackChoices();
  buildSlotCoverage();
  renderTruth();
  recommend();
  $("hardwareProfileSelect").addEventListener("change", recommend);
  $("acceptRecommendation").addEventListener("click", function () { select(null, true); });
})();
