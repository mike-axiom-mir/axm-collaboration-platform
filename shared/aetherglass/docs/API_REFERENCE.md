# AXM Aetherglass 7.1 — Public API Reference

Methods beginning with `_` are internal and should not be treated as stable platform contracts.

## v7.1 luminous-layer API

```js
const lightLayers = AXMLuminousLayerForge.mount(engine, {
  preset: "sovereign-aurora",
  reactive: true
});

AXMLuminousLayerForge.layers;
AXMLuminousLayerForge.presets;
lightLayers.listPresets();
lightLayers.previewPreset(name);
lightLayers.setPreset(name, options);
lightLayers.setLayer(name, enabled);
lightLayers.setIntensity(number);
lightLayers.setDepth(number);
lightLayers.setReactive(boolean);
lightLayers.radianceAt(target, options);
lightLayers.applyConfig(config, options);
lightLayers.getConfig();
lightLayers.getState();
lightLayers.destroy();
```

Planes: `halo`, `crown`, `aurora`, `prism`, `caustics`, and `refraction`.

Presets: `off`, `quiet-aura`, `sovereign-aurora`, `prismatic-cathedral`, `neon-sanctum`, and `event-horizon`.

Events use the `axmlightlayers:` prefix. The module reads only engine visual policy state; it does not read product content or control navigation.

## v7.1 offline Product Design helper

```text
python tools/local_product_design.py start
python tools/local_product_design.py status PATH_TO_RUN
python tools/local_product_design.py approve PATH_TO_RUN context --by "Reviewer"
python tools/local_product_design.py reopen PATH_TO_RUN visual-target --by "Reviewer" --reason "Target changed"
```

Visual QA approval additionally requires `--evidence PATH_TO_LOCAL_FILE`.

## v7 authoring and Storycraft APIs

AXMDesignTokenForge exposes list, get, derive, preview, apply, capture, restoreSnapshot, export, import, getState, and destroy.

AXMVisualContract exposes validate, diff, fingerprint, getState, and the static policy catalogue.

AXMCompositionWorkbench exposes connect, register, unregister, list, get, preview, apply, restore, export, import, getState, and destroy. v7 previews also report transitionAvailable and cueAvailable.

AXMAdaptiveOrchestrator exposes recommend, apply, restore, getState, and destroy. AXMVisualDriftMonitor exposes setBaseline, compare, clear, getState, and destroy.

AXMFocusDirector exposes preview, focus, pulse, clear, getState, and destroy. Focus application requires approved: true.

AXMJourneyDirector exposes list, get, preview, start, goTo, next, previous, pause, resume, stop, export, import, getState, and destroy. Journey dwell is controlled by authored duration and explicit speed, not motion preference.

AXMCaptureStudio exposes list, preview, enter, ready, exportManifest, exit, getState, and destroy. Capture preparation never takes or uploads a screenshot.

Authoring event prefixes are axmtokens:, axmcontract:, axmworkbench:, axmorchestrator:, and axmdrift:. Storycraft event prefixes are axmfocus:, axmjourney:, and axmcapture:.

## AXMVisualEngine

```js
const engine = AXMVisualEngine.mount(options);
AXMVisualEngine.getMounted(root);
AXMVisualEngine.version;
```

Configuration:

```js
engine.setTheme(value, persist);
engine.setAtmosphere(value, persist);
engine.setMaterial(value, persist);
engine.setDepth(value, persist);
engine.setLuminosity(value, persist);
engine.setDensity(value, persist);
engine.setShape(value, persist);
engine.setTransparency(value, persist);
engine.setContrast(value, persist);
engine.setQuality(value, persist);
engine.setMotion(value, persist);
engine.setIntensity(number, persist);
engine.setAtmosphereStrength(number, persist);
engine.setGlowStrength(number, persist);
engine.setPointerLighting(boolean, persist);
engine.setReactivePanels(boolean, persist);
engine.setParallax(boolean, persist);
engine.setTrackScroll(boolean, persist);
engine.setAccent(slot, cssColor);
engine.setPalette({ accent1, accent2, accent3, lux });
engine.applyConfig(config, options);
```

State and portability:

```js
engine.getConfig();
engine.getState();
engine.getCapabilities();
engine.exportConfig(space);
engine.importConfig(jsonOrObject, options);
engine.reset(options);
engine.clearPreferences();
engine.destroy();
```

## AXMLightingDirector

```js
const lighting = new AXMLightingDirector(engine, options);
lighting.bind(target, options);
lighting.addAt(x, y, options);
lighting.update(id, patch);
lighting.remove(id);
lighting.clear(group);
lighting.setGroupEnabled(group, enabled);
lighting.pulseAt(target, options);
lighting.sweep(options);
lighting.setScene(name, options);
lighting.restoreScene();
lighting.getState();
lighting.destroy();
```

Built-in lighting scenes:

```text
aether · sanctuary · dream · forge · living · royal · portal · auric · ocean · ultraviolet · void
```

## AXMAetherfield

```js
const field = AXMAetherfield.mount(engine, options);
AXMAetherfield.presets;
field.setPreset(name);
field.setDensity(number);
field.setEnergy(number);
field.setSpeed(number);
field.setInteractive(boolean);
field.start();
field.stop(clear);
field.resize();
field.burstAt(target, options);
field.getState();
field.destroy();
```

## AXMSceneDirector

```js
const scenes = new AXMSceneDirector(engine, { field, lighting, transitionDuration });
AXMSceneDirector.presets;
scenes.connect({ field, lighting });
scenes.register(name, definition, options);
scenes.unregister(name);
scenes.list();
scenes.get(name);
scenes.apply(name, options);
scenes.applyTemporary(name, duration, options);
scenes.restore(options);
scenes.export(name);
scenes.import(jsonOrObject, options);
scenes.getState();
scenes.destroy(options);
```

## AXMInteractionFX

```js
const interactions = AXMInteractionFX.mount(engine, options);
interactions.setLighting(lighting);
interactions.setField(field);
interactions.attention(target, options);
interactions.celebrate(target, options);
interactions.scan(options);
interactions.getState();
interactions.destroy();
```

## AXMPerformanceGovernor

```js
const governor = new AXMPerformanceGovernor(engine, options);
governor.start();
governor.stop();
governor.getReport();
governor.applyRecommendation();
governor.restoreApplied();
governor.getState();
governor.destroy(options);
```

## AXMVisualStateBridge

```js
const bridge = AXMVisualStateBridge.mount(engine, { scenes, lighting, interactions, field });
AXMVisualStateBridge.defaults;
bridge.connect({ scenes, lighting, interactions, field });
bridge.register(name, definition, options);
bridge.unregister(name);
bridge.list();
bridge.start();
bridge.stop();
bridge.dispatch(name, detail);
bridge.apply(name, detail);
bridge.getState();
bridge.destroy();
```

Default DOM event format: `axmvisualstate:<state-name>`.

## AXMSurfaceComposer

```js
const surfaces = new AXMSurfaceComposer({ root: document });
AXMSurfaceComposer.recipes;
surfaces.register(name, definition, options);
surfaces.unregister(name);
surfaces.list();
surfaces.preview(target, recipeName);
surfaces.apply(target, recipeName, overrides);
surfaces.wake(target, enabled);
surfaces.restore(target);
surfaces.restoreAll();
surfaces.getState();
surfaces.destroy();
```

## AXMTransitionDirector

```js
const transitions = AXMTransitionDirector.mount(engine, options);
AXMTransitionDirector.transitions;
transitions.run(name, action, options);
transitions.transitionScene(sceneName, sceneDirector, options);
transitions.cancel(reason);
transitions.clearQueue(reason);
transitions.getState();
transitions.destroy();
```

## AXMCueSequencer

```js
const cues = new AXMCueSequencer(engine, { field, lighting, scenes, interactions });
AXMCueSequencer.sequences;
cues.connect({ field, lighting, scenes, interactions });
cues.register(name, sequence, options);
cues.unregister(name);
cues.list();
cues.play(name, options);
cues.stop(reason);
cues.getState();
cues.destroy();
```

## AXMVisualAdapter

```js
const adapter = new AXMVisualAdapter(options);
adapter.preview();
adapter.apply(options);
adapter.applyTo(element);
adapter.startObserving();
adapter.stopObserving();
adapter.report();
adapter.rollback();
```

## Runtime events

Core events use `axmvisual:`. Optional module prefixes are:

```text
axmlighting: · axmfield: · axmscene: · axminteraction: · axmperformance:
axmvisualbridge: · axmsurface: · axmtransition: · axmcues:
```

Treat event details as visual runtime information, not as a storage or business-logic channel.


## Production APIs introduced in v4 and preserved in v7

### AXMProductionAdapter

```js
const mapper = new AXMProductionAdapter({ root });
mapper.analyze(options);       // read-only plan
mapper.exportPlan();
mapper.apply({ ids, types });  // explicit approval
mapper.decorate(element, type);
mapper.startObserving({ autoApprove: false });
mapper.analyzePending();
mapper.rollback();
mapper.getState();
mapper.destroy();
```

### AXMReadabilityGuardian

```js
const guardian = new AXMReadabilityGuardian({ root });
guardian.audit(options);
guardian.apply(report, options);
guardian.ensure(options);
guardian.restore(target);
guardian.startWatching({ autoApply: false });
guardian.stopWatching();
guardian.getState();
guardian.destroy();
```

### AXMConsistencyAuditor

```js
const auditor = new AXMConsistencyAuditor({ root, guardian });
auditor.audit(options);
auditor.createRepairPlan(report);
auditor.applySafeRepairs(options);
auditor.rollback();
auditor.getState();
auditor.destroy();
```

### AXMPresetVault

```js
const vault = new AXMPresetVault(engine, parts);
vault.list();
vault.get(name);
vault.register(name, definition);
await vault.apply(name, options);
vault.restore();
vault.export(name);
vault.import(json);
vault.getState();
vault.destroy();
```

### AXMRuntimeSupervisor

```js
const supervisor = new AXMRuntimeSupervisor(engine, modules);
supervisor.health();
supervisor.snapshot();
supervisor.restore(snapshot);
await supervisor.stress({ iterations, presets, restore: true });
supervisor.startWatch(options);
supervisor.stopWatch();
supervisor.exportHistory();
supervisor.getState();
supervisor.destroy();
```

Production event prefixes are `axmproduction:`, `axmreadability:`, `axmaudit:`, `axmpreset:`, and `axmsupervisor:` where emitted. Treat all event payloads as local visual-runtime information, not business data or a semantic inference channel.
