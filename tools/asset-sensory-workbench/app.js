(function () {
  "use strict";

  var Core = window.AXMAssetSensoryWorkbenchCore;
  var Fabric = window.AXMDeterministicAnimationFabric;
  var Hands = window.AXMAssetHands;
  var state = {
    brief: null,
    initialResult: null,
    result: null,
    session: null,
    compiled: null,
    tick: 0,
    playing: true,
    lastFrameAt: 0,
    receipt: null,
  };

  function $(id) { return document.getElementById(id); }

  function announce(message) {
    $("announcer").textContent = "";
    window.setTimeout(function () { $("announcer").textContent = message; }, 20);
  }

  function brief() {
    return {
      id: "asset-sensory-live-proof",
      title: "Asset Sensory Live Proof",
      kind: "procedural-animation",
      operation_mode: "create",
      intended_use: "procedural-animation",
      target_canvas: {
        medium: "game-world",
        dimensions: { width: 96, height: 96, unit: "px" },
        colour: { space: "srgb", transparency: "allowed" },
        behaviour: ["animated"],
        intended_use: "procedural-animation",
        performance: {
          max_file_bytes: 3000000,
          max_animation_frames: 24,
          frames_per_second: 12,
          max_duration_seconds: 2,
        },
      },
      required_outputs: [
        Fabric.RECIPE_SCHEMA,
        Fabric.COMPOSITION_SCHEMA,
        Fabric.BAKE_SCHEMA,
        Fabric.RECEIPT_SCHEMA,
        "axm.sprite-atlas/v1",
        "text/css",
        "image/svg+xml",
      ],
      editable_recipe_formats: [Fabric.RECIPE_SCHEMA, Fabric.COMPOSITION_SCHEMA],
      quality_requirements: {
        require_preview: true,
        require_validation: true,
        require_editable_source: true,
      },
    };
  }

  function compile() {
    state.compiled = state.session.draft_source.schema === Fabric.COMPOSITION_SCHEMA
      ? Fabric.compileComposition(state.session.draft_source)
      : Fabric.compileRecipe(state.session.draft_source);
    var duration = state.session.draft_source.timebase.duration_ticks;
    $("timelineScrub").max = String(duration);
    state.tick = Math.max(0, Math.min(duration, state.tick));
  }

  function sampleAt(tick) {
    return state.session.draft_source.schema === Fabric.COMPOSITION_SCHEMA
      ? Fabric.sampleComposition(state.compiled, Math.floor(tick))
      : Fabric.sampleCompiled(state.compiled, Math.floor(tick));
  }

  function valueFor(sample, property, fallback) {
    var item = (sample.values || []).find(function (value) { return value.property === property; });
    return item && Number.isFinite(item.value) ? item.value : fallback;
  }

  function presentation() { return state.session.draft_source.presentation; }

  function shapePath(shape) {
    if (shape === "circle") return "M0 -48 A48 48 0 1 1 0 48 A48 48 0 1 1 0 -48 Z";
    if (shape === "square") return "M-44 -44 H44 V44 H-44 Z";
    return "M0 -48 L48 0 L0 48 L-48 0 Z";
  }

  function renderFrame() {
    if (!state.session || !state.compiled) return;
    var sample = sampleAt(state.tick);
    var motionScale = state.session.viewer.motion_scale;
    var x = valueFor(sample, "transform.x", 0) * motionScale;
    var y = valueFor(sample, "transform.y", 0) * motionScale;
    var scale = motionScale === 0 ? 1 : valueFor(sample, "transform.scale", 1);
    var rotation = valueFor(sample, "transform.rotation", 0) * motionScale;
    var opacity = valueFor(sample, "opacity", 1);
    var zoom = state.session.viewer.zoom;
    var colours = presentation();
    var highContrast = state.session.viewer.high_contrast;

    $("assetMark").setAttribute(
      "transform",
      "translate(" + (320 + x * 3) + " " + (180 + y * 3) + ") rotate(" + rotation + ") scale(" + (scale * zoom) + ")",
    );
    $("assetMark").style.opacity = String(opacity);
    $("assetShape").setAttribute("d", shapePath(colours.shape));
    $("assetShape").style.fill = highContrast ? "#ffdf5e" : colours.fill;
    $("assetShape").style.stroke = highContrast ? "#ffffff" : colours.stroke;
    $("stageBackground").style.fill = highContrast ? "#000000" : colours.background;
    $("visualStage").classList.toggle("high-contrast", highContrast);
    $("tickReadout").textContent = "tick " + Math.floor(state.tick);
    $("sampleReadout").textContent =
      "x " + x.toFixed(2) + " · y " + y.toFixed(2) + " · scale " + scale.toFixed(3) + " · turn " + rotation.toFixed(2) + "°";
    $("timelineScrub").value = String(Math.floor(state.tick));
    $("timelineValue").textContent =
      (state.tick / state.session.draft_source.timebase.ticks_per_second).toFixed(3) + " s";
    $("previewDescription").textContent =
      "A " + (colours.shape || "geometric") + " asset at x " + x.toFixed(1) +
      ", y " + y.toFixed(1) + ", scale " + scale.toFixed(2) +
      ", rotation " + rotation.toFixed(1) + " degrees.";
  }

  function animationFrame(now) {
    if (!state.lastFrameAt) state.lastFrameAt = now;
    var elapsed = Math.min(100, now - state.lastFrameAt);
    state.lastFrameAt = now;
    if (state.session && state.playing && !state.session.viewer.reduced_motion) {
      var timebase = state.session.draft_source.timebase;
      var rate = state.session.viewer.playback_rate;
      state.tick += elapsed * timebase.ticks_per_second / 1000 * rate.numerator / rate.denominator;
      if (state.tick >= timebase.duration_ticks) state.tick %= timebase.duration_ticks;
    }
    renderFrame();
    window.requestAnimationFrame(animationFrame);
  }

  function exactFrameTicks() {
    var timebase = state.session.draft_source.timebase;
    return timebase.ticks_per_second / timebase.frames_per_second;
  }

  function formatField(field, value) {
    if (field === "motion.cycle_ticks") {
      return value + " ticks · " + (value / state.session.draft_source.timebase.ticks_per_second).toFixed(2) + " s";
    }
    if (field === "motion.rotation_degrees") return Number(value).toFixed(1) + "°";
    if (field.indexOf("amplitude") >= 0) return Number(value).toFixed(1) + " px";
    return String(value);
  }

  var controlBindings = [
    ["horizontalAmplitude", "horizontalAmplitudeValue"],
    ["verticalAmplitude", "verticalAmplitudeValue"],
    ["cycleTicks", "cycleTicksValue"],
    ["rotationDegrees", "rotationDegreesValue"],
    ["assetColour", null],
    ["stageColour", null],
    ["edgeColour", null],
  ];

  function syncControls() {
    controlBindings.forEach(function (binding) {
      var input = $(binding[0]);
      var value = Core.readField(state.session.draft_source, input.dataset.field);
      input.value = String(value);
      if (binding[1]) $(binding[1]).textContent = formatField(input.dataset.field, value);
    });
    $("playbackRate").value = String(
      state.session.viewer.playback_rate.numerator / state.session.viewer.playback_rate.denominator,
    );
    $("reducedMotion").checked = state.session.viewer.reduced_motion;
    $("highContrast").checked = state.session.viewer.high_contrast;
    $("viewerZoom").value = String(state.session.viewer.zoom);
    $("zoomValue").textContent = state.session.viewer.zoom.toFixed(1) + "×";
    $("playPause").textContent = state.playing ? "Pause" : "Play";
    $("playPause").setAttribute("aria-pressed", String(state.playing));
    $("playPause").disabled = state.session.viewer.reduced_motion;
    $("liveState").textContent = state.session.viewer.reduced_motion
      ? "REDUCED MOTION · STATIC"
      : "LIVE PLAYER · TEST";
  }

  function renderTruth() {
    var binding = state.session.result_binding || {};
    $("handBinding").textContent = binding.hand
      ? binding.hand.id + " · v" + binding.hand.version + " · " + binding.hand.authority
      : "direct source · no hand result";
    $("resultDigest").textContent = binding.digest || "unbound";
    $("compositionDigest").textContent = binding.composition_digest || state.session.draft_digest;
    $("bakeDigest").textContent = binding.bake_digest || "not regenerated";
    $("staticPreviewTruth").textContent = state.session.static_preview
      ? state.session.static_preview.label + " · not live"
      : "none";
    $("derivedCount").textContent = state.session.derived_artifacts.length + " regenerated artifacts";
    $("technicalState").textContent = binding.status && binding.validation_status
      ? binding.status + " + " + binding.validation_status
      : "UNBOUND";
    $("machineJson").textContent = JSON.stringify(Core.machinePatch(state.session), null, 2);
  }

  function invalidateReview() {
    state.receipt = null;
    $("downloadReview").disabled = true;
    $("reviewState").classList.remove("recorded");
    $("reviewState").textContent = "No human sensory receipt recorded for this digest.";
  }

  function regenerate(nextSession) {
    var sourceArtifact = Core.roundTripSourceArtifact(nextSession);
    var editBrief = Object.assign({}, state.brief, {
      id: "asset-sensory-live-edit-" + nextSession.draft_digest.slice(-8),
      operation_mode: "edit",
      source_artifacts: [sourceArtifact],
    });
    var result = Hands.create("deterministic-animation-fabric", editBrief, {
      seed: state.initialResult.seed,
      createdAt: "2000-01-01T00:00:00.000Z",
    });
    if (!result || result.status !== "READY" || result.validation_receipt.status !== "PASS") {
      throw new Error("edited source returned " + (result && result.status || "no result"));
    }
    nextSession = Core.bindRegeneratedResult(nextSession, result);
    state.result = result;
    state.session = nextSession;
    compile();
    invalidateReview();
    syncControls();
    renderTruth();
  }

  function commitField(input) {
    try {
      var next = Core.applyEdit(state.session, {
        field: input.dataset.field,
        value: input.type === "range" ? Number(input.value) : input.value,
        actor_kind: "human",
        actor_id: "local-human-seat",
      });
      regenerate(next);
      announce("Committed " + input.dataset.field + " and regenerated all derived artifacts.");
    } catch (error) {
      syncControls();
      announce("Edit refused: " + error.message);
      window.alert("Edit refused: " + error.message);
    }
  }

  function viewerPatch(patch, message) {
    try {
      state.session = Core.setViewer(state.session, patch);
      if (patch.reduced_motion === true) state.playing = false;
      invalidateReview();
      syncControls();
      renderTruth();
      renderFrame();
      announce(message);
    } catch (error) {
      announce("Viewer adaptation refused: " + error.message);
    }
  }

  function download(filename, value) {
    var blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function bindEvents() {
    controlBindings.forEach(function (binding) {
      var input = $(binding[0]);
      input.addEventListener("input", function () {
        if (binding[1]) $(binding[1]).textContent = formatField(input.dataset.field, Number(input.value));
      });
      input.addEventListener("change", function () { commitField(input); });
    });

    $("playPause").addEventListener("click", function () {
      state.playing = !state.playing;
      syncControls();
      announce(state.playing ? "Playback started." : "Playback paused.");
    });
    $("stepBack").addEventListener("click", function () {
      state.playing = false;
      state.tick = Math.max(0, state.tick - exactFrameTicks());
      syncControls(); renderFrame(); announce("Moved to the previous exact frame.");
    });
    $("stepForward").addEventListener("click", function () {
      state.playing = false;
      state.tick = Math.min(state.session.draft_source.timebase.duration_ticks, state.tick + exactFrameTicks());
      syncControls(); renderFrame(); announce("Moved to the next exact frame.");
    });
    $("timelineScrub").addEventListener("input", function () {
      state.tick = Number(this.value);
      renderFrame();
    });
    $("playbackRate").addEventListener("change", function () {
      viewerPatch({ playback_rate: Number(this.value) }, "Viewer playback rate set to " + this.value + " times.");
    });
    $("reducedMotion").addEventListener("change", function () {
      viewerPatch({ reduced_motion: this.checked }, this.checked ? "Reduced motion enabled." : "Reduced motion disabled.");
    });
    $("highContrast").addEventListener("change", function () {
      viewerPatch({ high_contrast: this.checked }, this.checked ? "High contrast enabled." : "High contrast disabled.");
    });
    $("viewerZoom").addEventListener("input", function () {
      viewerPatch({ zoom: Number(this.value) }, "Viewer zoom changed.");
    });
    $("resetCandidate").addEventListener("click", function () {
      state.result = state.initialResult;
      state.session = Core.ingestHandResult(state.initialResult, { id: "asset-sensory-live-session" });
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        state.session = Core.setViewer(state.session, { reduced_motion: true });
      }
      state.tick = 0; state.playing = !state.session.viewer.reduced_motion; state.receipt = null;
      compile(); syncControls(); renderTruth(); invalidateReview(); renderFrame();
      announce("Candidate reset to its original deterministic result.");
    });
    $("downloadPatch").addEventListener("click", function () {
      download("asset-sensory-machine-patch.json", Core.machinePatch(state.session));
      announce("Machine patch download prepared.");
    });
    $("showExactJson").addEventListener("click", function () {
      $("jsonDetails").open = true;
      $("jsonDetails").scrollIntoView({ behavior: state.session.viewer.reduced_motion ? "auto" : "smooth", block: "nearest" });
    });
    $("recordReview").addEventListener("click", function () {
      try {
        state.session = Core.recordHumanJudgment(state.session, {
          reviewer_id: "local-human-seat",
          verdict: $("reviewVerdict").value,
          impression: $("reviewImpression").value,
          note: $("reviewNote").value,
          recorded_at: new Date().toISOString(),
        });
        state.receipt = Core.createReceipt(state.session, {
          status: state.session.result_binding.validation_status,
          evidence: [
            "digest-bound deterministic composition",
            "regenerated Asset Hand result " + state.session.result_binding.digest,
            "bounded browser sensory session; frame pacing not certified",
          ],
        });
        $("downloadReview").disabled = false;
        $("reviewState").classList.add("recorded");
        $("reviewState").textContent =
          state.receipt.human_judgment.verdict + " recorded for " + state.receipt.draft.digest + ". No promotion occurred.";
        renderTruth();
        announce("Human sensory receipt recorded without promotion.");
      } catch (error) {
        announce("Review receipt refused: " + error.message);
      }
    });
    $("downloadReview").addEventListener("click", function () {
      if (state.receipt) download("asset-human-sensory-review-receipt.json", state.receipt);
    });
    document.addEventListener("keydown", function (event) {
      var tag = event.target && event.target.tagName;
      if (event.code === "Space" && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].indexOf(tag) < 0) {
        event.preventDefault(); $("playPause").click();
      }
    });
  }

  function initialize() {
    if (!Core || !Fabric || !Hands) throw new Error("required AXM asset runtimes are unavailable");
    state.brief = brief();
    state.initialResult = Hands.create("deterministic-animation-fabric", state.brief, {
      seed: "asset-sensory-live-proof",
      createdAt: "2000-01-01T00:00:00.000Z",
    });
    state.result = state.initialResult;
    state.session = Core.ingestHandResult(state.result, { id: "asset-sensory-live-session" });
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      state.session = Core.setViewer(state.session, { reduced_motion: true });
      state.playing = false;
    }
    compile(); bindEvents(); syncControls(); renderTruth(); renderFrame();
    window.requestAnimationFrame(animationFrame);
    announce("Asset Sensory Workbench ready. The candidate remains TEST and unpromoted.");
  }

  try { initialize(); }
  catch (error) {
    document.body.dataset.error = "true";
    $("announcer").textContent = "Workbench failed to initialize: " + error.message;
    window.console.error(error);
  }
})();
