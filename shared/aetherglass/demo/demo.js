(function startAetherglassDemo() {
  "use strict";

  const engine = AXMVisualEngine.mount({
    theme: "aether",
    atmosphere: "cosmos",
    material: "crystal",
    depth: "deep",
    luminosity: "balanced",
    density: "comfortable",
    shape: "sculpted",
    quality: "auto",
    motion: "auto",
    transparency: "auto",
    intensity: 1,
    atmosphereStrength: .86,
    glowStrength: .82,
    pointerLighting: true,
    reactivePanels: true,
    parallax: true,
    persist: false
  });

  const lighting = new AXMLightingDirector(engine, { maxLights: 14 });
  const lightLayers = AXMLuminousLayerForge.mount(engine, { preset: "sovereign-aurora", reactive: true });
  const field = AXMAetherfield.mount(engine, { preset: "constellation", density: .64, energy: .72, speed: .48 });
  const scenes = new AXMSceneDirector(engine, { field, lighting, transitionDuration: 760 });
  const interactions = AXMInteractionFX.mount(engine, { lighting, field });
  const governor = new AXMPerformanceGovernor(engine, { mode: "recommend", sampleFrames: 90, field });
  const bridge = AXMVisualStateBridge.mount(engine, { scenes, lighting, interactions, field });
  const surfaces = new AXMSurfaceComposer({ root: document });
  const transitions = AXMTransitionDirector.mount(engine, { duration: 920, policy: "replace" });
  const cues = new AXMCueSequencer(engine, { field, lighting, scenes, interactions });
  const productionRoot = document.querySelector("#productionSandbox");
  const productionAdapter = new AXMProductionAdapter({ root: productionRoot, includeStructuralPanels: true, minimumConfidence: .68 });
  const guardian = new AXMReadabilityGuardian({ root: productionRoot });
  const auditor = new AXMConsistencyAuditor({ root: productionRoot, guardian, adapter: productionAdapter, maxGlowSources: 6, minimumTouchSize: 40 });
  const vault = new AXMPresetVault(engine, { field, lighting, scenes, transitions, surfaces, cues });
  const supervisor = new AXMRuntimeSupervisor(engine, {
    field, lighting, lightLayers, scenes, interactions, governor, bridge, surfaces, transitions, cues,
    productionAdapter, guardian, auditor, vault
  });
  const tokens = new AXMDesignTokenForge({ root: document, target: engine.root });
  const contracts = new AXMVisualContract({ root: document, engine });
  const workbench = new AXMCompositionWorkbench(engine, { root: document, field, scenes, transitions, surfaces, tokens, contracts, cues });
  const orchestrator = new AXMAdaptiveOrchestrator({ engine, workbench, vault, mode: "recommend" });
  const drift = new AXMVisualDriftMonitor({ root: document });
  const focus = new AXMFocusDirector(engine, { root: document, padding: 16 });
  const capture = new AXMCaptureStudio(engine, { root: document, field, cues, transitions, focus });
  const journeys = new AXMJourneyDirector(engine, { root: document, focus, workbench, cues, capture });
  supervisor.connect({ tokens, contracts, workbench, orchestrator, drift, focus, capture, journeys });

  const $ = (selector) => document.querySelector(selector);
  const controls = {
    scene: $("#sceneSelect"),
    theme: $("#themeSelect"),
    atmosphere: $("#atmosphereSelect"),
    material: $("#materialSelect"),
    field: $("#fieldSelect"),
    depth: $("#depthSelect"),
    motion: $("#motionSelect"),
    quality: $("#qualitySelect"),
    transparency: $("#transparencySelect"),
    intensity: $("#intensityRange"),
    atmosphereGain: $("#atmosphereGainRange"),
    glowGain: $("#glowGainRange"),
    lightLayerPreset: $("#lightLayerPresetSelect"),
    lightLayerIntensity: $("#lightLayerIntensityRange"),
    lightLayerDepth: $("#lightLayerDepthRange"),
    surfaceRecipe: $("#surfaceRecipeSelect"),
    transition: $("#transitionSelect"),
    cue: $("#cueSelect"),
    productionPreset: $("#productionPresetSelect"),
    tokenPack: $("#tokenPackSelect"),
    blueprint: $("#blueprintSelect"),
    contractPolicy: $("#contractPolicySelect"),
    intent: $("#intentSelect"),
    journey: $("#journeySelect"),
    captureProfile: $("#captureProfileSelect")
  };

  const fieldModes = AXMAetherfield.presets;
  const label = (value) => value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

  function populate(select, values) {
    const options = values.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label(value);
      return option;
    });
    select.replaceChildren(...options);
  }

  const capabilities = engine.getCapabilities();
  populate(controls.scene, scenes.list().map((scene) => scene.name));
  populate(controls.theme, capabilities.themes);
  populate(controls.atmosphere, capabilities.atmospheres);
  populate(controls.material, capabilities.materials);
  populate(controls.depth, capabilities.depths);
  populate(controls.motion, capabilities.motions);
  populate(controls.quality, capabilities.qualities);
  populate(controls.transparency, capabilities.transparencies);
  populate(controls.field, fieldModes);
  populate(controls.surfaceRecipe, surfaces.list().map((recipe) => recipe.name));
  populate(controls.transition, AXMTransitionDirector.transitions);
  populate(controls.cue, cues.list().map((sequence) => sequence.name));
  populate(controls.lightLayerPreset, lightLayers.listPresets().map((preset) => preset.name));
  populate(controls.productionPreset, vault.list().map((preset) => preset.name));
  populate(controls.tokenPack, tokens.list().map((pack) => pack.name));
  populate(controls.blueprint, workbench.list().map((blueprint) => blueprint.name));
  populate(controls.contractPolicy, AXMVisualContract.policies);
  populate(controls.intent, AXMAdaptiveOrchestrator.intents);
  populate(controls.journey, journeys.list().map((journey) => journey.name));
  populate(controls.captureProfile, capture.list().map((profile) => profile.name));
  controls.productionPreset.value = "daily-workspace";
  controls.tokenPack.value = "sovereign-aurora";
  controls.blueprint.value = "sovereign-command";
  controls.contractPolicy.value = "production-safe";
  controls.intent.value = "work";
  controls.journey.value = "axiom-awakening";
  controls.captureProfile.value = "documentation";
  controls.surfaceRecipe.value = "prism-vault";
  controls.transition.value = "prism";
  controls.cue.value = "awakening";
  controls.lightLayerPreset.value = "sovereign-aurora";

  const boundLights = [
    lighting.bind(".demo-hero-copy", { color: "var(--axm-accent-1)", strength: .17, scaleToTarget: true, targetScale: 1.25, group: "interface" }),
    lighting.bind(".demo-portal-panel", { color: "var(--axm-accent-2)", strength: .20, scaleToTarget: true, targetScale: 1.35, kind: "ring", group: "interface" }),
    lighting.bind(".demo-conductor", { color: "var(--axm-lux)", strength: .09, scaleToTarget: true, targetScale: 1.5, group: "interface" }),
    lighting.bind(".demo-system-map", { color: "var(--axm-accent-1)", strength: .11, scaleToTarget: true, targetScale: 1.25, group: "interface" })
  ].filter(Boolean);

  function syncReadouts() {
    const state = engine.getState();
    const fieldState = field.getState();
    const lightLayerState = lightLayers.getState();
    controls.theme.value = state.theme;
    controls.atmosphere.value = state.atmosphere;
    controls.material.value = state.material;
    controls.depth.value = state.depth;
    controls.motion.value = state.requested.motion;
    controls.quality.value = state.requested.quality;
    controls.transparency.value = state.requested.transparency;
    controls.field.value = fieldState.preset;
    controls.intensity.value = state.intensity;
    controls.atmosphereGain.value = state.atmosphereStrength;
    controls.glowGain.value = state.glowStrength;
    controls.lightLayerPreset.value = lightLayerState.preset === "custom" ? controls.lightLayerPreset.value : lightLayerState.preset;
    controls.lightLayerIntensity.value = lightLayerState.intensity;
    controls.lightLayerDepth.value = lightLayerState.depth;
    $("#intensityValue").textContent = Number(state.intensity).toFixed(2);
    $("#atmosphereGainValue").textContent = Number(state.atmosphereStrength).toFixed(2);
    $("#glowGainValue").textContent = Number(state.glowStrength).toFixed(2);
    $("#lightLayerIntensityValue").textContent = Number(lightLayerState.intensity).toFixed(2);
    $("#lightLayerDepthValue").textContent = Number(lightLayerState.depth).toFixed(2);
    $("#lightReactiveToggle").checked = lightLayerState.reactive;
    $("#intensityOrb").textContent = Number(state.intensity).toFixed(2);
    $("#atmosphereReadout").textContent = state.atmosphere.toUpperCase();
    $("#fieldReadout").textContent = fieldState.preset.toUpperCase();
    $("#fpsReadout").textContent = `Quality: ${state.quality.toUpperCase()}`;
    const budget = engine.root.getAttribute("data-axm-budget") || "balanced";
    if ($("#budgetReadout")) $("#budgetReadout").textContent = budget.toUpperCase();
    if (vault.getState().active && controls.productionPreset) controls.productionPreset.value = vault.getState().active;
    if ($("#authoringTokenMetric")) $("#authoringTokenMetric").textContent = String(tokens.getState().tokenNames.length);
    if ($("#authoringSurfaceMetric")) $("#authoringSurfaceMetric").textContent = String(workbench.getState().appliedSurfaceTargets);
  }

  function setCustomCommand(text) {
    $("#commandReadout").textContent = text;
  }

  function showToast(title, copy, accent = "var(--axm-positive)") {
    const stack = $("#toastStack");
    const toast = document.createElement("div");
    toast.className = "axm-toast axm-glass axm-glass--solid";
    const icon = document.createElement("span");
    icon.className = "axm-icon-tile";
    icon.style.setProperty("--axm-icon-accent", accent);
    icon.textContent = "AΞ";
    const body = document.createElement("div");
    const heading = document.createElement("div");
    heading.className = "axm-toast__title";
    heading.textContent = String(title);
    const detail = document.createElement("div");
    detail.className = "axm-toast__copy";
    detail.textContent = String(copy);
    body.append(heading, detail);
    const status = document.createElement("span");
    status.className = "axm-status-dot";
    status.style.color = accent;
    toast.append(icon, body, status);
    stack.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3300);
  }

  function sceneApply(name, announce = true) {
    if (!scenes.apply(name)) return;
    controls.scene.value = name;
    setCustomCommand(`scenes.apply("${name}")`);
    window.setTimeout(syncReadouts, 30);
    if (announce) {
      const scene = scenes.get(name);
      showToast(scene.label, scene.description, "var(--axm-accent-1)");
    }
  }



  function setProductionStatus(text) {
    const target = $("#productionStatus");
    if (target) target.textContent = text;
  }

  function renderAudit(report) {
    if (!report) return;
    $("#auditScore").textContent = report.score ?? "—";
    $("#auditGrade").textContent = report.grade ? `GRADE ${report.grade}` : "NOT RUN";
    $("#auditSummary").textContent = report.issueCount
      ? `${report.issueCount} review point${report.issueCount === 1 ? "" : "s"}: ${Object.entries(report.byCode || {}).map(([key, value]) => `${value} ${label(key)}`).join(", ")}.`
      : "No consistency issues were detected inside the contained integration sandbox.";
    const ring = $("#auditRing");
    if (ring) ring.style.setProperty("--demo-audit-score", String(report.score ?? 0));
  }

  function runProductionAudit() {
    const report = auditor.audit();
    renderAudit(report);
    return report;
  }

  function setAuthoringStatus(text) {
    const target = $("#authoringStatus");
    if (target) target.textContent = text;
  }

  function renderContractPreview(preview) {
    if (!preview) return;
    $("#contractScore").textContent = preview.score ?? "—";
    $("#contractGrade").textContent = preview.grade ? `GRADE ${preview.grade}` : "NOT RUN";
    $("#contractFingerprint").textContent = `fingerprint: ${preview.fingerprint || "—"}`;
    const surfaces = preview.totalMatchedSurfaces ?? 0;
    const warnings = preview.warnings?.length || 0;
    const errors = preview.errors?.length || 0;
    $("#contractSummary").textContent = preview.valid
      ? `${surfaces} local surface match${surfaces === 1 ? "" : "es"}; ${warnings} warning${warnings === 1 ? "" : "s"}; approval is still required.`
      : `${errors} contract error${errors === 1 ? "" : "s"}; no composition can be applied.`;
  }

  function previewSelectedBlueprint() {
    const blueprint = workbench.get(controls.blueprint.value);
    if (!blueprint) return null;
    delete blueprint.builtIn;
    blueprint.policy = controls.contractPolicy.value;
    const report = contracts.validate(blueprint, { policy: controls.contractPolicy.value });
    const preview = workbench.preview(blueprint);
    preview.score = report.score;
    preview.grade = report.grade;
    preview.fingerprint = report.fingerprint;
    preview.valid = report.valid;
    preview.errors = report.errors;
    preview.warnings = report.warnings;
    renderContractPreview(preview);
    setAuthoringStatus(preview.valid ? `Preview complete. ${preview.totalMatchedSurfaces} targets mapped with zero mutations.` : "The selected contract violates the active policy and remains blocked.");
    return preview;
  }

  function setStorycraftStatus(text) {
    const target = $("#storycraftStatus");
    if (target) target.textContent = text;
  }

  function renderJourneyMap(name = controls.journey.value) {
    const journey = journeys.get(name);
    const map = $("#storyStepMap");
    if (!journey || !map) return;
    map.replaceChildren();
    journey.steps.forEach((step, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.storyStep = String(index);
      const title = document.createTextNode(step.eyebrow || `Step ${index + 1}`);
      const meta = document.createElement("span");
      meta.textContent = step.title || label(step.blueprint || "focus");
      button.append(title, meta);
      button.addEventListener("click", async () => {
        if (journeys.getState().active !== name) {
          setStorycraftStatus("Begin the selected journey before jumping to a step. Nothing changed.");
          return;
        }
        const result = await journeys.goTo(index, { schedule: Boolean($("#journeyAutoplay")?.checked) });
        setStorycraftStatus(result.entered ? `Moved to step ${index + 1}: ${step.title}.` : `Step remained blocked: ${result.reason}.`);
        updateJourneyUI();
      });
      map.appendChild(button);
    });
    $("#storyJourneyTitle").textContent = journey.label;
    updateJourneyUI();
  }

  function updateJourneyUI() {
    const state = journeys.getState();
    const selected = journeys.get(state.active || controls.journey.value);
    const total = selected?.steps.length || 0;
    const displayIndex = state.active && state.index >= 0 ? state.index : 0;
    const displayStep = selected?.steps[displayIndex] || null;
    const current = state.active ? state.index + 1 : 0;
    if (displayStep) {
      $("#storyStepEyebrow").textContent = displayStep.eyebrow || `Step ${displayIndex + 1}`;
      $("#storyStepTitle").textContent = displayStep.title || label(displayStep.blueprint || "Visual focus");
      $("#storyStepCopy").textContent = displayStep.copy || "This finite step uses supplied visual narration only.";
    }
    $("#storyProgressLabel").textContent = `${current} / ${total}`;
    $("#storyProgressBar").style.setProperty("--axm-story-progress", total ? `${Math.max(0, current / total * 100)}%` : "0%");
    $("#storyStepMap").querySelectorAll("button").forEach((button, index) => {
      if (state.active && index === state.index) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    const pauseButton = $("#pauseJourney");
    if (pauseButton) pauseButton.textContent = state.paused ? "Resume" : "Pause";
    const active = Boolean(state.active);
    $("#previousJourneyStep").disabled = !active || state.index <= 0;
    $("#nextJourneyStep").disabled = !active;
    $("#pauseJourney").disabled = !active || !state.playing;
    $("#stopJourney").disabled = !active;
    $("#journeyAutoplay").disabled = active;
  }

  function currentExport() {
    return JSON.stringify({
      module: "axm.visual.aetherglass.composition",
      version: "7.1.0",
      scene: scenes.active,
      engine: engine.getConfig(),
      field: {
        preset: field.getState().preset,
        density: field.getState().density,
        energy: field.getState().energy,
        speed: field.getState().speed,
        interactive: field.getState().interactive
      },
      luminousArchitecture: {
        surfaceRecipe: controls.surfaceRecipe.value,
        transition: controls.transition.value,
        cue: controls.cue.value,
        surfaceState: surfaces.getState(),
        transitionState: transitions.getState(),
        cueState: cues.getState()
      },
      production: {
        presetVault: vault.getState(),
        platformMapper: productionAdapter.getState(),
        readabilityGuardian: guardian.getState(),
        consistencyAuditor: auditor.getState(),
        runtimeSupervisor: supervisor.getState()
      },
      authoring: {
        tokenForge: tokens.getState(),
        visualContract: contracts.getState(),
        compositionWorkbench: workbench.getState(),
        adaptiveOrchestrator: orchestrator.getState(),
        driftMonitor: drift.getState(),
        selectedBlueprint: controls.blueprint.value,
        selectedPolicy: controls.contractPolicy.value
      },
      luminousLayers: lightLayers.getConfig(),
      storycraft: {
        focusDirector: focus.getState(),
        journeyDirector: journeys.getState(),
        captureStudio: capture.getState(),
        selectedJourney: controls.journey.value,
        selectedCaptureProfile: controls.captureProfile.value,
        boundaries: { contentRead: false, semanticInference: false, navigationControl: false, screenshotTaken: false }
      },
      boundaries: {
        localOnly: true,
        telemetry: false,
        automaticRewrite: false
      }
    }, null, 2);
  }

  function openExport() {
    $("#configOutput").value = currentExport();
    const dialog = $("#configDialog");
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  controls.scene.addEventListener("change", (event) => sceneApply(event.target.value));
  controls.theme.addEventListener("change", (event) => { engine.setTheme(event.target.value); setCustomCommand(`engine.setTheme("${event.target.value}")`); syncReadouts(); });
  controls.atmosphere.addEventListener("change", (event) => { engine.setAtmosphere(event.target.value); setCustomCommand(`engine.setAtmosphere("${event.target.value}")`); syncReadouts(); });
  controls.material.addEventListener("change", (event) => { engine.setMaterial(event.target.value); setCustomCommand(`engine.setMaterial("${event.target.value}")`); syncReadouts(); });
  controls.depth.addEventListener("change", (event) => { engine.setDepth(event.target.value); setCustomCommand(`engine.setDepth("${event.target.value}")`); syncReadouts(); });
  controls.motion.addEventListener("change", (event) => { engine.setMotion(event.target.value); setCustomCommand(`engine.setMotion("${event.target.value}")`); syncReadouts(); });
  controls.quality.addEventListener("change", (event) => { engine.setQuality(event.target.value); setCustomCommand(`engine.setQuality("${event.target.value}")`); syncReadouts(); });
  controls.transparency.addEventListener("change", (event) => { engine.setTransparency(event.target.value); setCustomCommand(`engine.setTransparency("${event.target.value}")`); syncReadouts(); });
  controls.field.addEventListener("change", (event) => { field.setPreset(event.target.value); $("#fieldToggle").checked = event.target.value !== "off"; setCustomCommand(`field.setPreset("${event.target.value}")`); syncReadouts(); });
  controls.intensity.addEventListener("input", (event) => { engine.setIntensity(event.target.value, false); syncReadouts(); });
  controls.intensity.addEventListener("change", (event) => setCustomCommand(`engine.setIntensity(${Number(event.target.value).toFixed(2)})`));
  controls.atmosphereGain.addEventListener("input", (event) => { engine.setAtmosphereStrength(event.target.value, false); syncReadouts(); });
  controls.atmosphereGain.addEventListener("change", (event) => setCustomCommand(`engine.setAtmosphereStrength(${Number(event.target.value).toFixed(2)})`));
  controls.glowGain.addEventListener("input", (event) => { engine.setGlowStrength(event.target.value, false); syncReadouts(); });
  controls.glowGain.addEventListener("change", (event) => setCustomCommand(`engine.setGlowStrength(${Number(event.target.value).toFixed(2)})`));
  controls.lightLayerIntensity.addEventListener("input", (event) => { lightLayers.setIntensity(event.target.value); syncReadouts(); });
  controls.lightLayerIntensity.addEventListener("change", (event) => setCustomCommand(`lightLayers.setIntensity(${Number(event.target.value).toFixed(2)})`));
  controls.lightLayerDepth.addEventListener("input", (event) => { lightLayers.setDepth(event.target.value); syncReadouts(); });
  controls.lightLayerDepth.addEventListener("change", (event) => setCustomCommand(`lightLayers.setDepth(${Number(event.target.value).toFixed(2)})`));

  $("#pointerToggle").addEventListener("change", (event) => engine.setPointerLighting(event.target.checked));
  $("#parallaxToggle").addEventListener("change", (event) => engine.setParallax(event.target.checked));
  $("#fieldToggle").addEventListener("change", (event) => {
    if (event.target.checked) field.setPreset(controls.field.value === "off" ? "constellation" : controls.field.value);
    else field.setPreset("off");
    syncReadouts();
  });
  $("#lightReactiveToggle").addEventListener("change", (event) => lightLayers.setReactive(event.target.checked));

  $("#applyLightLayerPreset").addEventListener("click", () => {
    const preset = controls.lightLayerPreset.value;
    const preview = lightLayers.previewPreset(preset);
    if (!preview.valid || !lightLayers.setPreset(preset)) return;
    setCustomCommand(`lightLayers.setPreset("${preset}")`);
    syncReadouts();
    showToast(preview.label, `${preview.effectiveLayers.length} adaptive light planes are active under the current visual policy.`, "var(--axm-accent-1)");
  });

  $("#focusRadiance").addEventListener("click", () => {
    const applied = lightLayers.radianceAt("#portalTarget", { color: "var(--axm-lux)", size: 920, strength: .72, duration: 1100 });
    setCustomCommand('lightLayers.radianceAt("#portalTarget")');
    showToast(applied ? "Radiance focused" : "Radiance unavailable", applied ? "A finite owned bloom illuminated the portal without changing content or navigation." : "The target or light stack is unavailable.", applied ? "var(--axm-lux)" : "var(--axm-warning)");
  });

  $("#applySurfaceRecipe").addEventListener("click", () => {
    const recipe = controls.surfaceRecipe.value;
    surfaces.apply([$(".demo-hero-copy"), $(".demo-system-map")], recipe);
    surfaces.wake([$(".demo-hero-copy"), $(".demo-system-map")], true);
    window.setTimeout(() => surfaces.wake([$(".demo-hero-copy"), $(".demo-system-map")], false), 1000);
    setCustomCommand(`surfaces.apply(targets, "${recipe}")`);
    showToast(label(recipe), "The local material recipe was applied only to the selected surfaces.", "var(--axm-lux)");
  });

  $("#morphScene").addEventListener("click", async () => {
    const scene = controls.scene.value;
    const transition = controls.transition.value;
    const result = await transitions.transitionScene(scene, scenes, { transition, duration: 920 });
    if (result.completed) {
      setCustomCommand(`transitions.transitionScene("${scene}", scenes, { transition: "${transition}" })`);
      syncReadouts();
      showToast(label(scene), `${label(transition)} transition completed without intercepting platform navigation.`, "var(--axm-accent-1)");
    }
  });

  $("#playCue").addEventListener("click", async () => {
    const cue = controls.cue.value;
    setCustomCommand(`cues.play("${cue}", { target: "#portalTarget" })`);
    const result = await cues.play(cue, { target: "#portalTarget" });
    if (result.completed) showToast(label(cue), "Finite choreography completed and stopped cleanly.", "var(--axm-accent-3)");
    syncReadouts();
  });

  $("#scanWorld").addEventListener("click", () => {
    const ran = interactions.scan({ color: "var(--axm-lux)", strength: .44, duration: 1350 });
    if (ran) lightLayers.radianceAt("#portalTarget", { color: "var(--axm-accent-1)", size: 1100, strength: .48, duration: 1180 });
    showToast(ran ? "Light sweep" : "Motion preference honored", ran ? "A transient global effect fired without changing the platform state." : "The decorative sweep stayed off because reduced or off motion is active.", ran ? "var(--axm-lux)" : "var(--axm-positive)");
  });

  $("#pulseMap").addEventListener("click", () => interactions.attention($("#networkTarget"), { particles: 24, size: 950, colorIndex: 1 }));
  $("#enterScene").addEventListener("click", async () => {
    controls.scene.value = "auric-throne";
    await transitions.transitionScene("auric-throne", scenes, { transition: "gate", duration: 980 });
    syncReadouts();
    setCustomCommand('transitions.transitionScene("auric-throne", scenes, { transition: "gate" })');
  });

  async function igniteWorld() {
    controls.scene.value = "celestial-orbit";
    await transitions.transitionScene("celestial-orbit", scenes, { transition: "bloom", duration: 980 });
    cues.play("showcase", { target: "#portalTarget", speed: 1.15 });
    lightLayers.setPreset("prismatic-cathedral");
    lightLayers.radianceAt("#portalTarget", { color: "var(--axm-lux)", size: 1260, strength: .82, duration: 1320 });
    setCustomCommand('transitions.transitionScene("celestial-orbit", scenes); cues.play("showcase")');
    syncReadouts();
    showToast("World ignited", "Scene morph and finite light choreography are running as separate reversible organs.", "var(--axm-accent-3)");
  }
  $("#igniteTop").addEventListener("click", igniteWorld);

  document.querySelectorAll("[data-visual-state]").forEach((button) => {
    button.addEventListener("click", () => {
      const state = button.dataset.visualState;
      const target = state === "success" ? $("#portalTarget") : $("#networkTarget");
      bridge.dispatch(state, { target, duration: 2200 });
      setCustomCommand(`bridge.dispatch("${state}")`);
      if (state === "success") {
        controls.scene.value = "nebula-celebration";
        window.setTimeout(() => { controls.scene.value = scenes.getState().active || "aether-command"; syncReadouts(); }, 2280);
      } else {
        window.setTimeout(() => { controls.scene.value = scenes.getState().active || controls.scene.value; syncReadouts(); }, 30);
      }
    });
  });

  $("#restoreScene").addEventListener("click", () => {
    if (scenes.restore()) {
      controls.scene.value = "aether-command";
      setCustomCommand("scenes.restore()");
      syncReadouts();
      showToast("Original state restored", "Only scene-owned settings were returned to their prior values.");
    } else {
      sceneApply("aether-command");
    }
  });



  $("#applyProductionPreset").addEventListener("click", async () => {
    const name = controls.productionPreset.value;
    setProductionStatus(`Applying reviewed production preset: ${name}…`);
    const result = await vault.apply(name, { target: "#portalTarget" });
    syncReadouts();
    setCustomCommand(`vault.apply("${name}")`);
    setProductionStatus(result.applied
      ? `${label(name)} is active. Prior engine, field, lighting, and budget state are held for exact restoration.`
      : `Preset was not applied: ${result.reason}.`);
    if (result.applied) showToast(label(name), "Production preset applied with a reversible state snapshot.", "var(--axm-lux)");
  });

  $("#restoreProductionPreset").addEventListener("click", () => {
    const restored = vault.restore();
    syncReadouts();
    setCustomCommand("vault.restore()");
    setProductionStatus(restored ? "The exact pre-preset visual composition was restored." : "No production preset snapshot is currently held.");
  });

  $("#analyzePlatform").addEventListener("click", () => {
    const report = productionAdapter.analyze({ includeStructuralPanels: true });
    setCustomCommand("productionAdapter.analyze()");
    setProductionStatus(`Read-only preview found ${report.candidates} candidates; ${report.applicable} meet the approval threshold. DOM mutations: ${report.mutations}.`);
    showToast("Platform map previewed", "The mapper inspected structure and roles only; nothing was changed.");
  });

  $("#applyApprovedMap").addEventListener("click", () => {
    if (!productionAdapter.getState().candidates) productionAdapter.analyze({ includeStructuralPanels: true });
    const result = productionAdapter.apply({ minimumConfidence: .68 });
    const report = runProductionAudit();
    setCustomCommand("productionAdapter.apply({ minimumConfidence: .68 })");
    setProductionStatus(`${result.applied} reviewed elements received ${result.addedClasses} owned classes. Current sandbox grade: ${report.grade}.`);
  });

  $("#guardReadability").addEventListener("click", () => {
    const result = guardian.ensure();
    const report = runProductionAudit();
    setCustomCommand("guardian.ensure()");
    setProductionStatus(`${result.applied} low-contrast text surface${result.applied === 1 ? "" : "s"} received ownership-safe protection. Current grade: ${report.grade}.`);
  });

  $("#runConsistencyAudit").addEventListener("click", () => {
    const report = runProductionAudit();
    setCustomCommand("auditor.audit()");
    setProductionStatus(`Read-only audit complete: score ${report.score}/100, grade ${report.grade}, ${report.issueCount} review points, zero audit mutations.`);
  });

  $("#runStress").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    setProductionStatus("Running 24 finite production-state switches, then restoring the exact starting composition…");
    const result = await supervisor.stress({
      iterations: 24,
      presets: ["daily-workspace", "deep-focus", "creation-flow", "review-proof", "live-command", "low-power"],
      restore: true
    });
    button.disabled = false;
    syncReadouts();
    setCustomCommand("supervisor.stress({ iterations: 24, restore: true })");
    setProductionStatus(`${result.completedIterations}/${result.requestedIterations} switches completed; ${result.errors.length} errors; ${result.leakSignals.length} owned-DOM growth signals; starting composition restored: ${result.restored}.`);
    showToast(result.completed ? "Stress cycle passed" : "Stress cycle needs review", result.completed ? "Finite switching completed with no observable owned-DOM growth." : "Review the returned stress evidence before intake.", result.completed ? "var(--axm-positive)" : "var(--axm-warning)");
  });

  $("#deriveTokenPack").addEventListener("click", () => {
    const name = "studio-forged";
    const okay = tokens.derive(name, { primary: $("#tokenPrimary").value, secondary: $("#tokenSecondary").value, luxury: $("#tokenLuxury").value }, { replace: true, label: "Studio Forged" });
    populate(controls.tokenPack, tokens.list().map((pack) => pack.name));
    controls.tokenPack.value = name;
    setAuthoringStatus(`${okay.label} was derived locally as inspectable tokens. No visual state changed.`);
    showToast("Token pack forged", "The local pack is ready for explicit application.", "var(--axm-lux)");
  });

  $("#applyTokenPack").addEventListener("click", () => {
    const preview = tokens.preview(controls.tokenPack.value, engine.root);
    const result = tokens.apply(controls.tokenPack.value, engine.root, { approved: true });
    setAuthoringStatus(`${result.name} applied ${result.applied} time after explicit approval; ${preview.tokenCount} tokens are active.`);
    syncReadouts();
  });

  $("#previewBlueprint").addEventListener("click", () => previewSelectedBlueprint());
  controls.blueprint.addEventListener("change", () => previewSelectedBlueprint());
  controls.contractPolicy.addEventListener("change", () => previewSelectedBlueprint());

  $("#applyBlueprint").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const preview = previewSelectedBlueprint();
      if (!preview?.valid) return;
      const result = await workbench.apply(controls.blueprint.value, { approved: true, transition: false, cue: false });
      if (!result.applied) {
        setAuthoringStatus(`Composition remained blocked: ${result.reason}.`);
        return;
      }
      setAuthoringStatus(`${label(result.name)} is active. Prior world state is held for exact restoration.`);
      setCustomCommand(`workbench.apply("${result.name}", { approved: true })`);
      syncReadouts();
      showToast("Composition approved", `${label(result.name)} now coordinates the authored visual language.`, "var(--axm-accent-1)");
    } finally { button.disabled = false; }
  });

  $("#restoreBlueprint").addEventListener("click", () => {
    const restored = workbench.restore({ reason: "demo-restore" });
    setAuthoringStatus(restored ? "The exact prior visual world was restored where ownership was unchanged." : "No workbench composition snapshot was active.");
    syncReadouts();
  });

  $("#recommendComposition").addEventListener("click", () => {
    const recommendation = orchestrator.recommend({ intent: controls.intent.value });
    const trace = $("#recommendationTrace");
    const reasons = recommendation.reasons.map((reason) => {
      const row = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = label(reason.code);
      row.append(heading, document.createElement("br"), document.createTextNode(reason.message));
      return row;
    });
    trace.replaceChildren(...reasons);
    setAuthoringStatus(`Recommended ${label(recommendation.blueprint)} under the ${label(recommendation.budget)} budget. Nothing was applied.`);
  });

  $("#captureVisualBaseline").addEventListener("click", () => {
    const result = drift.setBaseline("authoring-studio", "#authoringSandbox > *");
    setAuthoringStatus(result.saved ? `Read-only baseline captured for ${result.count} surfaces (${result.fingerprint}).` : "No baseline targets were found.");
    $("#authoringDriftMetric").textContent = "0";
  });

  $("#compareVisualDrift").addEventListener("click", () => {
    const result = drift.compare("authoring-studio");
    if (!result.compared) {
      setAuthoringStatus("Capture a baseline before comparing visual drift.");
      return;
    }
    $("#authoringDriftMetric").textContent = String(result.changeCount);
    setAuthoringStatus(result.drifted ? `${result.changeCount} read-only visual drift signal${result.changeCount === 1 ? "" : "s"} detected; score ${result.score}.` : "No visual drift was detected against the saved local baseline.");
  });

  controls.journey.addEventListener("change", () => {
    if (journeys.getState().active) journeys.stop("journey-selection-change", { restore: true });
    renderJourneyMap(controls.journey.value);
    const preview = journeys.preview(controls.journey.value);
    setStorycraftStatus(`${preview.label}: ${preview.steps} finite steps, ${preview.matchedTargets} matched targets, zero preview mutations.`);
  });

  $("#previewJourney").addEventListener("click", () => {
    const preview = journeys.preview(controls.journey.value);
    renderJourneyMap(controls.journey.value);
    setCustomCommand(`journeys.preview("${controls.journey.value}")`);
    setStorycraftStatus(preview.valid
      ? `${preview.label} is ready: ${preview.steps} steps, ${(preview.totalDuration / 1000).toFixed(1)} seconds of authored dwell, ${preview.matchedTargets} matched targets, zero mutations.`
      : `Journey remains blocked: ${preview.errors.join(" ")}`);
  });

  $("#startJourney").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (capture.getState().active) capture.exit({ reason: "journey-start" });
      const autoplay = Boolean($("#journeyAutoplay")?.checked);
      const result = await journeys.start(controls.journey.value, { approved: true, autoplay });
      setCustomCommand(`journeys.start("${controls.journey.value}", { approved: true, autoplay: ${autoplay} })`);
      setStorycraftStatus(result.started ? `${result.preview.label} started in ${autoplay ? "autoplay" : "manual"} mode. Focus, composition and cues remain finite and reversible.` : `Journey remained blocked: ${result.reason}.`);
      updateJourneyUI();
    } finally { button.disabled = false; }
  });

  $("#previousJourneyStep").addEventListener("click", async () => {
    const result = await journeys.previous();
    setStorycraftStatus(result.entered ? `Returned to step ${result.index + 1}.` : `Previous step unavailable: ${result.reason}.`);
    updateJourneyUI();
  });

  $("#nextJourneyStep").addEventListener("click", async () => {
    const result = await journeys.next();
    setStorycraftStatus(result.entered ? `Advanced to step ${result.index + 1}.` : (result.reason === "completed" ? "Journey completed and the prior world was restored." : `Next step unavailable: ${result.reason}.`));
    updateJourneyUI();
  });

  $("#pauseJourney").addEventListener("click", () => {
    const state = journeys.getState();
    const changed = state.paused ? journeys.resume() : journeys.pause();
    setStorycraftStatus(changed ? (state.paused ? "Journey resumed." : "Journey paused. The current focus remains visible.") : "No active journey is available to pause or resume.");
    updateJourneyUI();
  });

  $("#stopJourney").addEventListener("click", () => {
    const stopped = journeys.stop("manual-restore", { restore: true });
    setStorycraftStatus(stopped ? "Journey stopped. The prior visual world was restored." : "No journey is active.");
    updateJourneyUI();
  });

  $("#enterCaptureMode").addEventListener("click", () => {
    if (journeys.getState().active) journeys.stop("capture-preparation", { restore: true });
    const profile = controls.captureProfile.value;
    const result = capture.enter(profile, { approved: true, replace: true, label: `AXM · ${label(profile)}` });
    setCustomCommand(`capture.enter("${profile}", { approved: true })`);
    if (!result.entered) {
      setStorycraftStatus(`Capture preparation remained blocked: ${result.reason}.`);
      return;
    }
    const ready = result.readiness;
    setStorycraftStatus(`${label(profile)} prepared locally. Fonts: ${ready.fonts}; incomplete images: ${ready.incompleteImages}; overflow: ${ready.horizontalOverflow}px. No screenshot was taken.`);
    updateJourneyUI();
  });

  $("#exitCaptureMode").addEventListener("click", () => {
    const restored = capture.exit({ reason: "manual-restore" });
    setStorycraftStatus(restored ? "Live visual state restored. Capture Studio did not take or upload a screenshot." : "No capture profile is active.");
    syncReadouts();
  });

  engine.root.addEventListener("axmjourney:step", () => updateJourneyUI());
  engine.root.addEventListener("axmjourney:completed", () => { setStorycraftStatus("Journey completed and restored the prior visual world."); updateJourneyUI(); syncReadouts(); });
  engine.root.addEventListener("axmjourney:stopped", () => { updateJourneyUI(); syncReadouts(); });
  engine.root.addEventListener("axmcapture:entered", syncReadouts);
  engine.root.addEventListener("axmcapture:exited", syncReadouts);

  $("#exportTop").addEventListener("click", openExport);
  $("#exportConfig").addEventListener("click", openExport);
  $("#copyConfig").addEventListener("click", async () => {
    const output = $("#configOutput");
    try {
      await navigator.clipboard.writeText(output.value);
      showToast("Configuration copied", "The visual JSON is ready to paste into a local integration.");
    } catch (_) {
      output.select();
      document.execCommand?.("copy");
      showToast("Configuration selected", "Copy the selected visual JSON from the dialog.", "var(--axm-warning)");
    }
  });
  $("#downloadConfig").addEventListener("click", () => {
    const blob = new Blob([$("#configOutput").value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "AXM_AETHERGLASS_CONFIG.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });

  const sectionTabs = Array.from(document.querySelectorAll(".demo-tabs .axm-tab"));
  function setActiveSection(hash) {
    sectionTabs.forEach((item) => {
      const active = item.hash === hash;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }
  sectionTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveSection(tab.hash);
      interactions.attention(tab, { particles: 8, size: 260, strength: .28 });
    });
  });
  if ("IntersectionObserver" in window) {
    const observedSections = sectionTabs.map((tab) => document.querySelector(tab.hash)).filter(Boolean);
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActiveSection(`#${visible.target.id}`);
    }, { rootMargin: "-20% 0px -62% 0px", threshold: [0, .08, .3] });
    observedSections.forEach((section) => sectionObserver.observe(section));
  }

  engine.root.addEventListener("axmvisual:qualitychange", syncReadouts);
  engine.root.addEventListener("axmvisual:themechange", syncReadouts);
  engine.root.addEventListener("axmfield:presetchange", syncReadouts);
  engine.root.addEventListener("axmlightlayers:policychange", syncReadouts);
  engine.root.addEventListener("axmlightlayers:presetchange", syncReadouts);

  surfaces.apply(".demo-hero-copy", "prism-vault");
  surfaces.apply(".demo-portal-panel", "black-diamond");
  surfaces.apply(".demo-system-map", "phantom-silk");
  sceneApply("aether-command", false);
  renderAudit(auditor.audit());
  previewSelectedBlueprint();
  renderJourneyMap("axiom-awakening");
  syncReadouts();

  window.axmDemo = {
    engine, lighting, lightLayers, field, scenes, interactions, governor, bridge, surfaces, transitions, cues,
    productionAdapter, guardian, auditor, vault, supervisor, tokens, contracts, workbench, orchestrator, drift,
    focus, capture, journeys, boundLights,
    exportConfig: currentExport,
    showToast,
    igniteWorld
  };
})();
