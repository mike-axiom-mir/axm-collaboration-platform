(function () {
  "use strict";

  var Core = window.AXMAssetAudioSensoryCore;
  var state = {
    session: null,
    bridgeReady: false,
    readOnly: true,
    busy: false,
    selectedSide: "current",
    baselineInfo: null,
    currentInfo: null,
    suppressAudioEvents: false,
    lastGestureTrusted: false,
    animationToken: 0
  };

  function $(id) { return document.getElementById(id); }

  function announce(message) {
    $("announcer").textContent = "";
    window.setTimeout(function () { $("announcer").textContent = message; }, 20);
  }

  function setStatus(element, text, status) {
    element.textContent = text;
    element.dataset.state = status;
  }

  function shortDigest(value) {
    var text = String(value || "—");
    return text.length > 18 ? text.slice(0, 9) + "…" + text.slice(-7) : text;
  }

  function formatTime(seconds) {
    var value = Math.max(0, Number(seconds) || 0);
    var minutes = Math.floor(value / 60);
    var remainder = value - minutes * 60;
    return minutes + ":" + (remainder < 10 ? "0" : "") + remainder.toFixed(3);
  }

  async function requestJson(path, body) {
    var response = await fetch(path, body ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    } : { cache: "no-store" });
    var payload;
    try { payload = await response.json(); }
    catch (_) { throw new Error("host returned non-JSON data"); }
    if (!response.ok) throw new Error(payload.error || ("host request failed: " + response.status));
    return payload;
  }

  function selectedAudio() {
    return state.selectedSide === "baseline" ? $("baselineAudio") : $("currentAudio");
  }

  function selectedInfo() {
    return state.selectedSide === "baseline" ? state.baselineInfo : state.currentInfo;
  }

  function stopBoth(reset) {
    state.suppressAudioEvents = true;
    [$("baselineAudio"), $("currentAudio")].forEach(function (audio) {
      audio.pause();
      if (reset) audio.currentTime = 0;
    });
    state.suppressAudioEvents = false;
    updateTransport();
  }

  function applyListenerToAudio() {
    if (!state.session) return;
    [$("baselineAudio"), $("currentAudio")].forEach(function (audio) {
      audio.volume = state.session.listener.volume;
      audio.playbackRate = state.session.listener.playback_rate;
      audio.loop = state.session.listener.loop;
      audio.muted = state.session.listener.muted;
    });
  }

  function installResult(result, hostWritable) {
    stopBoth(true);
    state.session = Core.createSession(result);
    state.baselineInfo = Core.inspectHandResult(result);
    state.currentInfo = state.baselineInfo;
    state.readOnly = !hostWritable;
    state.selectedSide = "current";
    $("baselineAudio").src = state.baselineInfo.wav_artifact.dataUrl;
    $("currentAudio").src = state.currentInfo.wav_artifact.dataUrl;
    applyListenerToAudio();
    renderAll();
    announce("Deterministic audio candidate loaded");
  }

  async function createCandidate() {
    state.busy = true;
    renderAll();
    setRegeneration("Creating through the deterministic audio Asset Hand…", "working");
    try {
      var result = await requestJson("/api/create", { seed: "asset-audio-sensory-seed" });
      installResult(result, true);
      setRegeneration("READY · four exact artifacts received · no listening claim", "pass");
    } catch (error) {
      state.session = null;
      state.readOnly = true;
      setRegeneration("Create failed: " + error.message, "error");
      degrade("The hand is registered but candidate creation failed.", error.message);
    } finally {
      state.busy = false;
      renderAll();
    }
  }

  function setRegeneration(message, status) {
    $("regenerationStatus").textContent = message;
    $("regenerationStatus").dataset.state = status || "";
  }

  function degrade(title, detail) {
    state.bridgeReady = false;
    $("connectionBanner").dataset.state = "degraded";
    $("connectionTitle").textContent = title;
    $("connectionDetail").textContent = detail || "Load a serialized Asset Hand result for read-only listening and review.";
    setStatus($("hostStatus"), "DEGRADED", "degraded");
    setStatus($("handStatus"), "UNAVAILABLE", "degraded");
  }

  function ready(health) {
    state.bridgeReady = true;
    $("connectionBanner").dataset.state = "ready";
    $("connectionTitle").textContent = "Bounded loopback host ready";
    $("connectionDetail").textContent = "Exact Node Asset Hand create/edit route · loopback only · no filesystem writes.";
    setStatus($("hostStatus"), "READY", "ready");
    setStatus($("handStatus"), health.hand_registered ? "REGISTERED" : "MISSING", health.hand_registered ? "ready" : "degraded");
  }

  function syncCurrentInfo() {
    state.currentInfo = Core.inspectHandResult(state.session.current_result);
    state.suppressAudioEvents = true;
    $("currentAudio").src = state.currentInfo.wav_artifact.dataUrl;
    $("currentAudio").load();
    state.suppressAudioEvents = false;
    applyListenerToAudio();
  }

  function drawWaveform() {
    var group = $("waveBars");
    while (group.firstChild) group.removeChild(group.firstChild);
    var info = selectedInfo();
    $("waveEmpty").hidden = !!info;
    if (!info) return;
    var zoom = state.session.listener.waveform_zoom;
    var all = Core.waveformEnvelope(info.wav_artifact.dataUrl, Math.round(320 * zoom));
    var envelope = all.slice(0, 320);
    var namespace = "http://www.w3.org/2000/svg";
    envelope.forEach(function (bin, index) {
      var x = index / Math.max(1, envelope.length - 1) * 960;
      var line = document.createElementNS(namespace, "line");
      line.setAttribute("class", "wave-bar");
      line.setAttribute("x1", x.toFixed(2));
      line.setAttribute("x2", x.toFixed(2));
      line.setAttribute("y1", (140 - bin.max * 118).toFixed(2));
      line.setAttribute("y2", (140 - bin.min * 118).toFixed(2));
      group.appendChild(line);
      if (index % 4 === 0) {
        var rms = document.createElementNS(namespace, "line");
        rms.setAttribute("class", "wave-rms");
        rms.setAttribute("x1", x.toFixed(2));
        rms.setAttribute("x2", x.toFixed(2));
        rms.setAttribute("y1", (140 - bin.rms * 118).toFixed(2));
        rms.setAttribute("y2", (140 + bin.rms * 118).toFixed(2));
        group.appendChild(rms);
      }
    });
    $("waveFacts").textContent = info.wav.sample_rate + " Hz · " + info.wav.channels + " ch · " + info.wav.duration_seconds.toFixed(3) + " s";
  }

  function updateTransport() {
    var audio = selectedAudio();
    var info = selectedInfo();
    var playing = info && !audio.paused && !audio.ended;
    $("playIcon").textContent = playing ? "Ⅱ" : "▶";
    $("playLabel").textContent = (playing ? "Pause " : "Play ") + (state.selectedSide === "baseline" ? "original" : "current");
    $("audioScrub").value = info && info.wav.duration_seconds ? Math.min(1, audio.currentTime / info.wav.duration_seconds) : 0;
    $("currentTime").textContent = formatTime(audio.currentTime);
    $("durationTime").textContent = formatTime(info && info.wav.duration_seconds);
    var x = info && info.wav.duration_seconds ? Math.min(1, audio.currentTime / info.wav.duration_seconds) * 960 : 0;
    $("playhead").setAttribute("x1", x.toFixed(2));
    $("playhead").setAttribute("x2", x.toFixed(2));
    if (playing) {
      var token = ++state.animationToken;
      window.requestAnimationFrame(function tick() {
        if (token !== state.animationToken) return;
        updateTransport();
      });
    }
  }

  function renderFields() {
    var container = $("editFields");
    container.innerHTML = "";
    if (!state.session) {
      var empty = document.createElement("p");
      empty.className = "empty-copy";
      empty.textContent = "Editable controls appear after the Asset Hand returns a canonical source recipe.";
      container.appendChild(empty);
      return;
    }
    Core.listFields(state.session.draft_recipe).filter(function (field) { return field.available; }).forEach(function (field) {
      var label = document.createElement("label");
      label.className = "field-control";
      var row = document.createElement("span");
      row.className = "field-label-row";
      var name = document.createElement("span");
      name.textContent = field.label;
      var output = document.createElement("output");
      output.textContent = String(field.value) + (field.unit ? " " + field.unit : "");
      row.appendChild(name); row.appendChild(output); label.appendChild(row);
      var input;
      if (field.type === "select") {
        input = document.createElement("select");
        field.options.forEach(function (option) {
          var node = document.createElement("option"); node.value = option; node.textContent = option; node.selected = option === field.value; input.appendChild(node);
        });
      } else if (field.type === "boolean") {
        input = document.createElement("input"); input.type = "checkbox"; input.checked = field.value === true;
      } else if (field.type === "text") {
        input = document.createElement("input"); input.type = "text"; input.maxLength = field.maxLength || 180; input.value = field.value;
      } else {
        input = document.createElement("input"); input.type = ["gain", "duration_seconds", "attack_seconds", "noise_gain"].indexOf(field.id) >= 0 ? "range" : "number";
        input.min = field.min; input.max = field.max; input.step = field.step; input.value = field.value;
        input.addEventListener("input", function () { output.textContent = input.value + (field.unit ? " " + field.unit : ""); });
      }
      input.dataset.field = field.id;
      input.setAttribute("aria-label", field.label);
      input.disabled = state.readOnly || state.busy;
      input.addEventListener("change", function () { commitField(field, input); });
      if (field.type === "text" || input.type === "number") input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") { event.preventDefault(); commitField(field, input); }
      });
      label.appendChild(input);
      container.appendChild(label);
    });
  }

  function controlValue(field, input) {
    if (field.type === "boolean") return input.checked;
    return input.value;
  }

  async function regenerate(nextSession, label) {
    state.session = nextSession;
    state.busy = true;
    stopBoth(true);
    renderAll();
    setRegeneration(label || "Regenerating all four artifacts…", "working");
    try {
      var result = await requestJson("/api/edit", {
        brief: state.session.current_result.brief,
        recipe: state.session.draft_recipe,
        seed: state.session.draft_recipe.seed
      });
      state.session = Core.bindRegeneratedResult(state.session, result);
      syncCurrentInfo();
      setRegeneration("PASS · recipe, WAV, analysis and verification regenerated together", "pass");
      announce("Audio edit regenerated and bound to new digests");
    } catch (error) {
      state.session = Core.cancelPendingEdit(state.session, error.message);
      setRegeneration("Edit failed and draft rolled back: " + error.message, "error");
      announce("Audio edit failed and was rolled back");
    } finally {
      state.busy = false;
      renderAll();
    }
  }

  function commitField(field, input) {
    if (!state.bridgeReady || state.readOnly || state.busy) return;
    try {
      var next = Core.applyEdit(state.session, { actor: "human", channel: input.type === "range" ? "slider" : "form-control", field: field.id, value: controlValue(field, input) });
      if (!next.pending_edit) return;
      regenerate(next, "Regenerating after " + field.label.toLowerCase() + " edit…");
    } catch (error) {
      setRegeneration("Edit refused: " + error.message, "error");
      renderFields();
    }
  }

  function listenerPatch(patch, message) {
    if (!state.session) return;
    stopBoth(false);
    state.session = Core.setListener(state.session, patch);
    applyListenerToAudio();
    renderAll();
    announce(message);
  }

  function renderAll() {
    var has = !!state.session;
    var currentPlaybackObserved = has && state.session.playback_events.some(function (event) {
      return event.kind === "playing" && event.wav_sha256 === state.session.wav_sha256 && event.listener_state_digest === state.session.listener_state_digest;
    });
    $("workbench").classList.toggle("high-contrast", has && state.session.listener.high_contrast);
    $("selectBaseline").classList.toggle("is-active", state.selectedSide === "baseline");
    $("selectCurrent").classList.toggle("is-active", state.selectedSide === "current");
    $("selectedSide").textContent = state.selectedSide === "baseline" ? "A · ORIGINAL" : "B · CURRENT";
    $("playPause").disabled = !has || state.busy;
    $("restartAudio").disabled = !has || state.busy;
    $("audioScrub").disabled = !has || state.busy;
    $("downloadWav").disabled = !has;
    $("downloadPatch").disabled = !has;
    $("downloadResult").disabled = !has;
    $("toggleExactJson").disabled = !has;
    $("resetCandidate").disabled = !has || state.readOnly || state.busy || state.session.current_result_digest === state.session.source_result_digest;
    $("recordReview").disabled = !has || state.busy || !currentPlaybackObserved;
    $("downloadReview").disabled = !has || !state.session.human_receipt;
    $("editMode").textContent = state.readOnly ? "READ-ONLY / DEGRADED" : "HOST-BRIDGED EDIT";
    $("editMode").dataset.state = state.readOnly ? "degraded" : "ready";
    if (has) {
      $("listenerDigest").textContent = shortDigest(state.session.listener_state_digest);
      $("volume").value = state.session.listener.volume;
      $("volumeValue").textContent = Math.round(state.session.listener.volume * 100) + "%";
      $("playbackRate").value = String(state.session.listener.playback_rate);
      $("waveformZoom").value = state.session.listener.waveform_zoom;
      $("zoomValue").textContent = state.session.listener.waveform_zoom + "×";
      $("loopPlayback").checked = state.session.listener.loop;
      $("mutePlayback").checked = state.session.listener.muted;
      $("highContrast").checked = state.session.listener.high_contrast;
      $("resultDigest").textContent = state.session.current_result_digest;
      $("recipeDigest").textContent = state.session.current_recipe_digest;
      $("wavDigest").textContent = state.session.wav_sha256;
      $("technicalStatus").textContent = state.session.verification.status + " · TECHNICAL ONLY";
      $("resultDelta").textContent = state.session.current_result_digest === state.session.source_result_digest ? "SAME" : "CHANGED";
      $("reviewState").textContent = state.session.human_receipt ? state.session.human_judgment.verdict : (currentPlaybackObserved ? "READY FOR JUDGMENT" : "PLAY CURRENT TO REVIEW");
      $("staleCount").textContent = state.session.stale_review_history.length + " stale judgment" + (state.session.stale_review_history.length === 1 ? "" : "s") + " preserved";
      $("sessionId").textContent = state.session.id;
      $("exactJson").textContent = JSON.stringify(state.session.current_result, null, 2);
    } else {
      ["resultDigest", "recipeDigest", "wavDigest", "technicalStatus"].forEach(function (id) { $(id).textContent = "—"; });
      $("listenerDigest").textContent = "—";
      $("reviewState").textContent = "NO CURRENT REVIEW";
      $("staleCount").textContent = "0 stale judgments preserved";
      $("sessionId").textContent = "No session";
      $("resultDelta").textContent = "WAITING";
    }
    renderFields();
    drawWaveform();
    updateTransport();
  }

  function recordCurrentEvent(kind, raw) {
    if (!state.session || state.selectedSide !== "current" || state.suppressAudioEvents) return;
    try {
      state.session = Core.recordPlaybackEvent(state.session, {
        kind: kind,
        trusted_user_gesture: raw && raw.trusted === true,
        position_seconds: $("currentAudio").currentTime,
        observed_at_monotonic_ms: performance.now(),
        error: raw && raw.error
      });
      renderAll();
    } catch (error) { setRegeneration("Playback observation refused: " + error.message, "error"); }
  }

  function selectSide(side) {
    stopBoth(false);
    state.selectedSide = side;
    renderAll();
    announce(side === "baseline" ? "Original candidate selected" : "Current candidate selected");
  }

  function downloadJson(filename, value) {
    var blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadWav() {
    if (!state.session) return;
    var anchor = document.createElement("a");
    anchor.href = state.currentInfo.wav_artifact.dataUrl;
    anchor.download = state.currentInfo.wav_artifact.filename || "deterministic-audio.wav";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  }

  function bindEvents() {
    $("selectBaseline").addEventListener("click", function () { selectSide("baseline"); });
    $("selectCurrent").addEventListener("click", function () { selectSide("current"); });
    $("playPause").addEventListener("click", function (event) {
      var audio = selectedAudio();
      if (!audio.paused && !audio.ended) { audio.pause(); return; }
      state.lastGestureTrusted = event.isTrusted === true;
      if (state.selectedSide === "current") recordCurrentEvent("play-requested", { trusted: state.lastGestureTrusted });
      audio.play().catch(function (error) { recordCurrentEvent("error", { trusted: state.lastGestureTrusted, error: error.message }); setRegeneration("Playback failed: " + error.message, "error"); });
    });
    $("restartAudio").addEventListener("click", function () { selectedAudio().currentTime = 0; updateTransport(); });
    $("audioScrub").addEventListener("input", function () {
      var info = selectedInfo();
      if (info) selectedAudio().currentTime = Number($("audioScrub").value) * info.wav.duration_seconds;
      updateTransport();
    });
    [$("baselineAudio"), $("currentAudio")].forEach(function (audio) {
      audio.addEventListener("playing", function () { if (audio === $("currentAudio")) recordCurrentEvent("playing", { trusted: state.lastGestureTrusted }); updateTransport(); });
      audio.addEventListener("pause", function () { if (audio === $("currentAudio") && audio.currentTime > 0 && !audio.ended) recordCurrentEvent("pause", { trusted: state.lastGestureTrusted }); updateTransport(); });
      audio.addEventListener("ended", function () { if (audio === $("currentAudio")) recordCurrentEvent("ended", { trusted: state.lastGestureTrusted }); updateTransport(); });
      audio.addEventListener("timeupdate", updateTransport);
      audio.addEventListener("error", function () { if (!state.suppressAudioEvents && audio.error) recordCurrentEvent("error", { trusted: state.lastGestureTrusted, error: audio.error.message || ("media error " + audio.error.code) }); });
    });
    $("volume").addEventListener("input", function () { listenerPatch({ volume: Number(this.value) }, "Listener volume changed; prior review is stale"); });
    $("playbackRate").addEventListener("change", function () { listenerPatch({ playback_rate: Number(this.value) }, "Playback speed changed; prior review is stale"); });
    $("waveformZoom").addEventListener("input", function () { listenerPatch({ waveform_zoom: Number(this.value) }, "Waveform zoom changed; prior review is stale"); });
    $("loopPlayback").addEventListener("change", function () { listenerPatch({ loop: this.checked }, "Loop mode changed; prior review is stale"); });
    $("mutePlayback").addEventListener("change", function () { listenerPatch({ muted: this.checked }, "Mute state changed; prior review is stale"); });
    $("highContrast").addEventListener("change", function () { listenerPatch({ high_contrast: this.checked }, "Contrast changed; prior review is stale"); });
    $("resetCandidate").addEventListener("click", function () {
      if (!state.session || state.readOnly || state.busy) return;
      try { regenerate(Core.replaceRecipe(state.session, state.session.source_recipe, { actor: "human", channel: "reset-control", label: "reset to original recipe" }), "Regenerating the original recipe…"); }
      catch (error) { setRegeneration("Reset refused: " + error.message, "error"); }
    });
    $("recordReview").addEventListener("click", function () {
      try {
        state.session = Core.recordHumanJudgment(state.session, {
          reviewer: $("reviewer").value,
          verdict: $("verdict").value,
          impression: $("impression").value,
          heard_as_presented: $("heardAsPresented").checked,
          notes: $("reviewNotes").value
        });
        renderAll();
        announce("Human listening review bound to the current WAV and listener-state digests");
      } catch (error) { setRegeneration("Review refused: " + error.message, "error"); announce("Review was not recorded"); }
    });
    $("downloadReview").addEventListener("click", function () { if (state.session && state.session.human_receipt) downloadJson("audio-sensory-review.json", state.session.human_receipt); });
    $("downloadPatch").addEventListener("click", function () { if (state.session) downloadJson("audio-sensory-machine-patch.json", Core.machinePatch(state.session)); });
    $("downloadResult").addEventListener("click", function () { if (state.session) downloadJson("deterministic-audio-result.json", state.session.current_result); });
    $("downloadWav").addEventListener("click", downloadWav);
    $("toggleExactJson").addEventListener("click", function () { var target = $("exactJson"); target.hidden = !target.hidden; this.textContent = target.hidden ? "Show exact JSON" : "Hide exact JSON"; if (!target.hidden) target.focus(); });
    $("loadResult").addEventListener("change", async function () {
      var file = this.files && this.files[0];
      if (!file) return;
      try {
        var result = JSON.parse(await file.text());
        installResult(result, state.bridgeReady);
        if (!state.bridgeReady) setRegeneration("Serialized result loaded in honest read-only mode", "pass");
      } catch (error) { setRegeneration("Serialized result refused: " + error.message, "error"); }
      this.value = "";
    });
    document.addEventListener("keydown", function (event) {
      if (event.code === "Space" && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName) && state.session) { event.preventDefault(); $("playPause").click(); }
      if (event.key.toLowerCase() === "a" && event.altKey && state.session) { event.preventDefault(); selectSide("baseline"); }
      if (event.key.toLowerCase() === "b" && event.altKey && state.session) { event.preventDefault(); selectSide("current"); }
    });
  }

  async function initialize() {
    if (!Core) {
      degrade("BROKEN: audio sensory core did not load", "core.js is unavailable");
      return;
    }
    bindEvents();
    renderAll();
    try {
      var health = await requestJson("/api/health");
      if (health.status !== "READY" || !health.hand_registered) {
        degrade("Bounded host is running without the deterministic audio hand", "Load a serialized result for read-only listening.");
        return;
      }
      ready(health);
      await createCandidate();
    } catch (error) {
      degrade("Bounded host unavailable — read-only fallback", "Start `node tools/asset-audio-sensory-workbench/server.js` or load a serialized result. " + error.message);
      setRegeneration("No live create/edit bridge. Serialized result playback remains available.", "error");
    }
  }

  initialize();
})();
