(function (root) {
  'use strict';

  const AXM = root.AXM;
  const STORAGE = {
    recipe: 'axm.visual-fabric.recipe.v1',
    customModules: 'axm.visual-fabric.custom-modules.v1',
    snapshots: 'axm.visual-fabric.snapshots.v1',
    rejectedRecipe: 'axm.visual-fabric.rejected-recipe.v1'
  };

  const ICONS = {
    blur: '◌', sun: '☼', gradient: '◩', noise: '░', mask: '◯', layers: '▱', wave: '∿', move: '⌁', opacity: '◐', blend: '◈', filter: '◇',
    cube: '⬡', snow: '❄', scan: '▤', shield: '⬟', rectangle: '▭', slash: '╱', frame: '⌗', halo: '◎', circle: '◯', triangle: '△', target: '⊙', corners: '⌜',
    up: '⇧', pulse: '∿', progress: '▰', wind: '≈', ripple: '◉', enter: '↳', stack: '▱', inset: '▣', beacon: '✦', stars: '✧', vignette: '◉', flare: '✺',
    dashboard: '▦', hero: '✦', gamepad: '🎮', launcher: '⌘', sparkles: '✧', droplet: '◒', diamond: '◇', rainbow: '◫', waves: '≋', sunrays: '☀', aurora: '⌁', fog: '≋', dust: '·', rain: '╲', magnet: '∪', spring: '↟', trail: '➜'
  };

  const dom = {};
  const volatileStorage = new Map();
  let storageWarningShown = false;
  let registry;
  let adapter;
  let composer;
  let history;
  let governor;
  let recipe;
  let compiled;
  let selectedInstanceId = null;
  let activeTab = 'library';
  let creatorMode = 'derived';
  let showPrimitives = false;
  let fpsTimer = null;
  let pendingImport = null;
  let lastRepairAnalysis = null;
  let lastPerformanceReport = null;
  let graphClipboardText = '';

  function byId(id) { return document.getElementById(id); }
  function glyph(icon) { return ICONS[icon] || '◇'; }
  function esc(value) { return AXM.Utils.escapeHtml(value); }

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      const raw = volatileStorage.get(key);
      if (!storageWarningShown) console.warn('[AXM] Persistent browser storage is unavailable; using session memory.', error);
      return raw ? JSON.parse(raw) : fallback;
    }
  }

  function writeStorage(key, value) {
    const serialized = JSON.stringify(value);
    try {
      localStorage.setItem(key, serialized);
      volatileStorage.delete(key);
      return 'persistent';
    } catch (error) {
      volatileStorage.set(key, serialized);
      if (!storageWarningShown) {
        storageWarningShown = true;
        console.warn('[AXM] Persistent browser storage is unavailable; using session memory.', error);
        toast('Persistent storage is unavailable. Work is safe for this session; export a package before closing.', 'warn');
      }
      return 'volatile';
    }
  }

  function toast(message, tone = 'good') {
    const node = document.createElement('div');
    node.className = `toast ${tone}`;
    node.textContent = message;
    dom.toastRegion.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  function persistCustomModules() {
    writeStorage(STORAGE.customModules, registry.customModules());
  }

  function persistRecipe() {
    recipe.provenance = {
      creator: 'Mike — Axiom/Mir',
      created: recipe.provenance?.created || new Date().toISOString(),
      source: 'AXM AetherFX Visual Effect Fabric local studio',
      license: recipe.provenance?.license || 'UNSET — choose before public sharing',
      ...recipe.provenance,
      lastModified: new Date().toISOString()
    };
    const storageMode = writeStorage(STORAGE.recipe, recipe);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dom.autosaveStatus.textContent = storageMode === 'persistent' ? `Saved locally · ${time}` : `Session memory only · ${time}`;
  }

  function loadCustomModules() {
    const modules = readStorage(STORAGE.customModules, []);
    if (!Array.isArray(modules)) return;
    const staging = registry.clone();
    const seen = new Set();
    try {
      modules.forEach((module) => {
        if (!module?.id || seen.has(module.id)) throw new Error(`Duplicate or missing custom module id: ${module?.id || 'unknown'}.`);
        seen.add(module.id);
        if (staging.sourceOf(module.id) === 'builtin') throw new Error(`Custom module collides with built-in ${module.id}.`);
        staging.register(module, { source: 'custom' });
      });
      const report = AXM.Validator.validateCatalog(staging);
      if (!report.valid) throw new Error(report.errors.map((item) => item.message).join(' '));
      registry.replaceFrom(staging);
    } catch (error) {
      console.warn('[AXM] Stored custom module transaction was rejected without partial loading.', error);
    }
  }

  function loadRecipe() {
    const saved = readStorage(STORAGE.recipe, null);
    if (saved) {
      const rawReport = AXM.Validator.validateRecipe(saved, registry);
      if (!rawReport.valid) {
        writeStorage(STORAGE.rejectedRecipe, {
          capturedAt: new Date().toISOString(),
          raw: saved,
          errors: rawReport.errors
        });
        console.warn('[AXM] Saved recipe was rejected before normalization; using default.', rawReport.errors);
        toast('Saved recipe was invalid. An untouched recovery copy was preserved locally before the default opened.', 'warn');
        return composer.createDefaultRecipe();
      }
      const normalized = composer.normalizeRecipe(saved);
      const report = AXM.Validator.validateRecipe(normalized, registry);
      if (report.valid) return normalized;
      console.warn('[AXM] Saved recipe failed validation; using default.', report.errors);
    }
    return composer.createDefaultRecipe();
  }

  function selectedLayer() {
    return recipe.layers.find((layer) => layer.instanceId === selectedInstanceId) || null;
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('[data-tab]').forEach((button) => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== tab;
    });
  }

  function setCreatorMode(mode) {
    creatorMode = mode;
    document.querySelectorAll('[data-creator-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.creatorMode === mode));
    dom.creatorDerived.hidden = mode !== 'derived';
    dom.creatorComposite.hidden = mode !== 'composite';
    updateCreatorSummary();
  }

  function commit(label, mutator, options = {}) {
    const next = AXM.Utils.clone(recipe);
    mutator(next);
    recipe = composer.normalizeRecipe(next);
    history.commit(recipe);
    persistRecipe();
    renderWorkspace();
    if (!options.silent) toast(label, options.tone || 'good');
  }

  function commitCurrent(label, options = {}) {
    recipe = composer.normalizeRecipe(recipe);
    history.commit(recipe);
    persistRecipe();
    renderChrome();
    if (!options.silent) toast(label, options.tone || 'good');
  }

  function renderPreview() {
    if (recipe.globals.quality === 'auto') recipe.globals.resolvedQuality = governor?.lastDecision || recipe.globals.resolvedQuality || 'high';
    compiled = composer.render(recipe);
    const errors = compiled.report.errors.length;
    const warnings = compiled.report.warnings.length;
    const load = AXM.PerformanceGovernor.estimatePlan(compiled.plan, compiled.resolvedQuality, recipe.globals);
    dom.modulePlanStatus.textContent = `${compiled.plan.length} resolved modules · ${load.tier} est. load`;
    dom.recipeStatus.textContent = `${recipe.layers.filter((layer) => layer.enabled !== false).length} active layers · ${compiled.resolvedQuality} quality`;
    dom.renderStatus.className = `status-pill ${errors ? 'bad' : warnings ? 'warn' : 'good'}`;
    dom.renderStatus.textContent = errors ? `● ${errors} blocking` : warnings ? `● ${warnings} notices` : '● Verified render';
    dom.validationLabel.textContent = errors ? `${errors} errors` : warnings ? `${warnings} warnings` : 'Clean';
    renderValidationMini();
    document.documentElement.dataset.axmReady = compiled.report.valid ? 'true' : 'false';
  }

  function renderWorkspace() {
    renderLibrary();
    renderStack();
    renderGlobalControls();
    renderInspector();
    renderSceneSelect();
    renderCreatorBase();
    renderPreview();
    updateHistoryButtons();
  }

  function renderChrome() {
    renderStack();
    renderGlobalControls();
    renderInspector();
    renderSceneSelect();
    renderPreview();
    updateHistoryButtons();
  }

  function renderSceneSelect() {
    const scenes = registry.sceneModules();
    dom.sceneSelect.innerHTML = scenes.map((scene) => `<option value="${esc(scene.id)}">${esc(scene.name)}</option>`).join('');
    dom.sceneSelect.value = recipe.sceneId;
  }

  function renderGlobalControls() {
    dom.moodSelect.innerHTML = registry.moods.map((mood) => `<option value="${esc(mood.id)}">${esc(mood.name)}</option>`).join('');
    dom.moodSelect.value = recipe.globals.mood;
    dom.qualitySelect.value = recipe.globals.quality;
    dom.performanceBiasSelect.value = recipe.globals.performanceBias || 'balanced';
    dom.globalIntensity.value = recipe.globals.intensity;
    dom.globalDepth.value = recipe.globals.depth;
    dom.globalMotion.value = recipe.globals.motion;
    dom.globalIntensityOut.textContent = `${Math.round(recipe.globals.intensity * 100)}%`;
    dom.globalDepthOut.textContent = `${Math.round(recipe.globals.depth * 100)}%`;
    dom.globalMotionOut.textContent = `${Math.round(recipe.globals.motion * 100)}%`;
    dom.toggleReducedMotion.checked = Boolean(recipe.globals.reducedMotion);
    dom.togglePhotosensitiveSafe.checked = Boolean(recipe.globals.photosensitiveSafe);
    dom.toggleHighContrast.checked = Boolean(recipe.globals.highContrast);
    dom.toggleLargeText.checked = Boolean(recipe.globals.largeText);
  }

  function renderLibrary() {
    const search = dom.moduleSearch?.value || '';
    const kinds = showPrimitives ? ['primitive', 'effect', 'organ', 'mold'] : ['effect', 'organ', 'mold'];
    const modules = registry.list({ kind: kinds, search, includeHidden: showPrimitives });
    const groups = modules.reduce((map, module) => {
      if (!map.has(module.category)) map.set(module.category, []);
      map.get(module.category).push(module);
      return map;
    }, new Map());
    dom.libraryCount.textContent = `${registry.list({ includeHidden: true }).length} modules · ${registry.customModules().length} custom`;
    dom.btnShowPrimitives.classList.toggle('primary', showPrimitives);
    if (!modules.length) {
      dom.moduleLibrary.innerHTML = '<div class="stack-empty">No modules match this search.</div>';
      return;
    }
    dom.moduleLibrary.innerHTML = [...groups.entries()].map(([category, items]) => `
      <section class="category-block">
        <div class="category-heading"><h3>${esc(category)}</h3><span>${items.length}</span></div>
        <div class="module-list">
          ${items.map((module) => {
            const custom = registry.sourceOf(module.id) === 'custom';
            const isPrimitive = module.kind === 'primitive';
            return `<article class="module-card" data-module-id="${esc(module.id)}">
              <span class="module-icon" aria-hidden="true">${glyph(module.ui?.icon)}</span>
              <span class="module-copy"><strong title="${esc(module.name)}">${esc(module.name)}</strong><small>${esc(module.description)}</small>${custom ? '<span class="custom-badge">CUSTOM</span>' : ''}</span>
              <button class="icon-button" data-action="add-module" ${isPrimitive ? 'disabled title="Foundation capability; used through effects"' : `title="Add ${esc(module.name)}"`} aria-label="Add ${esc(module.name)}">${isPrimitive ? '·' : '+'}</button>
            </article>`;
          }).join('')}
        </div>
      </section>`).join('');
  }

  function renderStack() {
    if (!recipe.layers.length) {
      dom.activeStack.innerHTML = '<div class="stack-empty">The stack is empty. Add a material, light, motion, or scene mold from the Library.</div>';
      return;
    }
    dom.activeStack.innerHTML = recipe.layers.map((layer, index) => {
      const module = registry.get(layer.moduleId);
      const selected = layer.instanceId === selectedInstanceId;
      return `<article class="stack-item ${selected ? 'is-selected' : ''} ${layer.enabled === false ? 'is-disabled' : ''}" data-instance-id="${esc(layer.instanceId)}">
        <input class="stack-toggle" type="checkbox" data-action="toggle-layer" ${layer.enabled !== false ? 'checked' : ''} aria-label="Enable ${esc(module?.name || layer.moduleId)}">
        <button type="button" class="stack-copy stack-select" data-action="select-layer" aria-label="Edit ${esc(module?.name || layer.moduleId)}"><strong>${esc(module?.name || layer.moduleId)}</strong><small>${esc(module?.kind || 'missing')} · ${index + 1}</small></button>
        <span class="stack-actions"><button data-action="move-up" title="Move up" ${index === 0 ? 'disabled' : ''}>↑</button><button data-action="move-down" title="Move down" ${index === recipe.layers.length - 1 ? 'disabled' : ''}>↓</button><button data-action="remove-layer" title="Remove">×</button></span>
      </article>`;
    }).join('');
  }

  function renderInspector() {
    const layer = selectedLayer();
    if (!layer) {
      dom.selectedSource.textContent = '';
      dom.selectedInspector.className = 'inspector-empty';
      dom.selectedInspector.innerHTML = 'Select a layer in the Active Stack to tune its exposed controls.';
      return;
    }
    const module = registry.get(layer.moduleId);
    if (!module) {
      dom.selectedInspector.className = 'inspector-empty';
      dom.selectedInspector.textContent = `Missing module: ${layer.moduleId}`;
      return;
    }
    const source = registry.sourceOf(module.id);
    dom.selectedSource.textContent = source === 'custom' ? 'Custom' : 'Built-in';
    const isComposite = module.renderer?.type === 'composite';
    const controls = (module.parameters || []).map((parameter) => {
      const value = layer.params?.[parameter.id] ?? parameter.default;
      if (parameter.type === 'number') {
        const unit = parameter.unit || '';
        const displayValue = parameter.unit === '%' ? `${value}%` : `${Number(value).toFixed(parameter.step && parameter.step < 1 ? 2 : 0)}${unit}`;
        return `<div class="range-field"><div class="range-head"><label for="param-${esc(parameter.id)}">${esc(parameter.label)}</label><output data-output-for="${esc(parameter.id)}">${esc(displayValue)}</output></div><input id="param-${esc(parameter.id)}" data-param="${esc(parameter.id)}" type="range" min="${parameter.min}" max="${parameter.max}" step="${parameter.step || 1}" value="${value}" data-unit="${esc(unit)}"></div>`;
      }
      return `<div class="field"><label>${esc(parameter.label)}</label><input data-param="${esc(parameter.id)}" value="${esc(value)}"></div>`;
    }).join('');
    const dependencyCount = (() => { try { return registry.dependencyClosure(module.id).length - 1; } catch { return module.dependencies?.length || 0; } })();
    dom.selectedInspector.className = '';
    dom.selectedInspector.innerHTML = `
      <div class="selected-module-head"><span class="module-icon">${glyph(module.ui?.icon)}</span><div><strong>${esc(module.name)}</strong><small>${esc(module.kind)} · ${dependencyCount} dependencies · v${esc(module.version)}</small></div></div>
      ${module.description ? `<p class="creator-intro">${esc(module.description)}</p>` : ''}
      ${controls || `<div class="creator-summary">${isComposite ? `Composite mold containing ${(module.renderer.layers || []).length} nested layers.` : 'This module exposes no direct parameters.'}</div>`}
      <div class="parameter-actions">
        ${isComposite ? '<button class="app-button small" data-inspector-action="expand-composite">Expand into layers</button>' : '<button class="app-button small" data-inspector-action="reset-params">Reset controls</button>'}
        <button class="app-button small" data-inspector-action="derive-module">Create derivative</button>
        <button class="app-button small" data-inspector-action="export-module">Export package</button>
        <button class="app-button small" data-inspector-action="inspect-graph">View dependency graph</button>
        ${source === 'custom' ? '<button class="app-button small danger" data-inspector-action="delete-module">Delete custom module</button>' : '<button class="app-button small" data-inspector-action="inspect-module">Inspect definition</button>'}
      </div>`;
  }

  function renderValidationMini() {
    if (!compiled) return;
    const items = [
      ...compiled.report.errors.slice(0, 2).map((item) => ({ ...item, tone: 'error' })),
      ...compiled.report.warnings.slice(0, 3).map((item) => ({ ...item, tone: 'warning' }))
    ];
    if (!items.length) {
      dom.validationMini.innerHTML = '<div class="validation-line note"><span>✓</span><span>Recipe, dependencies, quality behavior, and active render plan are valid.</span></div>';
      return;
    }
    dom.validationMini.innerHTML = items.map((item) => `<div class="validation-line ${item.tone}"><span>${item.tone === 'error' ? '×' : '!'}</span><span>${esc(item.message)}</span></div>`).join('');
  }

  function renderCreatorBase() {
    const prior = dom.creatorBase.value;
    const modules = registry.list({ kind: ['effect', 'organ'] });
    dom.creatorBase.innerHTML = modules.map((module) => `<option value="${esc(module.id)}">${esc(module.category)} · ${esc(module.name)}</option>`).join('');
    const selected = selectedLayer();
    const preferred = selected && ['effect', 'organ'].includes(registry.get(selected.moduleId)?.kind) ? selected.moduleId : prior;
    if (preferred && registry.has(preferred)) dom.creatorBase.value = preferred;
    updateCreatorSummary();
  }

  function updateCreatorSummary() {
    if (!dom.creatorBase) return;
    if (creatorMode === 'derived') {
      const base = registry.get(dom.creatorBase.value);
      if (!base) { dom.creatorDerivedSummary.textContent = 'Choose a base module.'; return; }
      dom.creatorDerivedSummary.textContent = `${base.name} exposes ${(base.parameters || []).length} controls and depends on ${(base.dependencies || []).length} foundation parts. The source module will not be edited.`;
    } else {
      const enabled = recipe.layers.filter((layer) => layer.enabled !== false);
      const expose = dom.creatorCompositeExpose?.checked !== false;
      const limit = Number(dom.creatorCompositeLimit?.value || 6);
      const candidateCount = enabled.reduce((total, layer) => total + (registry.get(layer.moduleId)?.parameters?.length || 0), 0);
      dom.creatorCompositeSummary.textContent = `${enabled.length} enabled layers will be captured. ${expose ? `Up to ${Math.min(limit, candidateCount)} key child controls will remain directly editable.` : 'The mold will use fixed captured values until expanded.'} The dependency graph stays traceable.`;
    }
  }

  function updateHistoryButtons() {
    dom.btnUndo.disabled = !history.canUndo;
    dom.btnRedo.disabled = !history.canRedo;
  }

  function addModule(moduleId) {
    const module = registry.get(moduleId);
    if (!module || ['primitive', 'scene'].includes(module.kind)) return;
    commit(`Added ${module.name}`, (next) => {
      if (module.exclusiveGroup) {
        next.layers = next.layers.filter((layer) => registry.get(layer.moduleId)?.exclusiveGroup !== module.exclusiveGroup);
      }
      const instance = composer.instance(moduleId);
      next.layers.push(instance);
      selectedInstanceId = instance.instanceId;
    });
    setTab('stack');
  }

  function removeLayer(instanceId) {
    const layer = recipe.layers.find((item) => item.instanceId === instanceId);
    const name = registry.get(layer?.moduleId)?.name || 'layer';
    commit(`Removed ${name}`, (next) => {
      next.layers = next.layers.filter((item) => item.instanceId !== instanceId);
      if (selectedInstanceId === instanceId) selectedInstanceId = next.layers.at(-1)?.instanceId || null;
    }, { tone: 'warn' });
  }

  function moveLayer(instanceId, direction) {
    commit('Layer order updated', (next) => {
      const index = next.layers.findIndex((layer) => layer.instanceId === instanceId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.layers.length) return;
      [next.layers[index], next.layers[target]] = [next.layers[target], next.layers[index]];
    }, { silent: true });
  }

  function toggleLayer(instanceId, enabled) {
    commit(enabled ? 'Layer enabled' : 'Layer disabled', (next) => {
      const layer = next.layers.find((item) => item.instanceId === instanceId);
      if (layer) layer.enabled = enabled;
    }, { silent: true });
  }

  function uniqueCustomId(name) {
    const base = `custom.${AXM.Utils.slugify(name).replaceAll('-', '.')}`;
    let id = base;
    let suffix = 2;
    while (registry.has(id)) { id = `${base}.${suffix}`; suffix += 1; }
    return id;
  }

  function buildProvenance(origin) {
    return {
      author: 'Mike — Axiom/Mir',
      origin,
      license: 'UNSET — choose before public sharing',
      created: new Date().toISOString(),
      sourceIntegrity: 'Created through AXM AetherFX Visual Effect Fabric; source dependencies remain separately versioned.'
    };
  }

  function createDerivedModule() {
    const base = registry.get(dom.creatorBase.value);
    const name = dom.creatorDerivedName.value.trim();
    if (!base || !name) { toast('Choose a base and give the new module a name.', 'warn'); return; }
    const selected = selectedLayer();
    const sourceParams = selected?.moduleId === base.id ? selected.params : registry.defaultParams(base);
    const parameters = AXM.Utils.clone(base.parameters || []).map((parameter) => ({
      ...parameter,
      default: sourceParams[parameter.id] ?? parameter.default
    }));
    const module = {
      id: uniqueCustomId(name),
      name,
      version: '1.0.0',
      schema: 'axm.visual-module/1',
      kind: base.kind,
      category: `Custom ${base.category}`,
      status: 'WORKING',
      description: dom.creatorDerivedDescription.value.trim() || `Derived from ${base.name}.`,
      tags: [...new Set([...(base.tags || []), 'custom', 'derived'])],
      dependencies: [base.id],
      exclusiveGroup: base.exclusiveGroup || null,
      shareable: true,
      ui: AXM.Utils.clone(base.ui || { icon: 'sparkles' }),
      parameters,
      renderer: { type: 'derived', baseModuleId: base.id, parameterOverrides: {} },
      quality: AXM.Utils.clone(base.quality),
      accessibility: AXM.Utils.clone(base.accessibility),
      provenance: buildProvenance(`Derived from ${base.id}@${base.version}`)
    };
    const report = AXM.Validator.validateModule(module, registry);
    if (!report.valid) { toast(report.errors.map((item) => item.message).join(' '), 'bad'); return; }
    registry.register(module, { source: 'custom' });
    persistCustomModules();
    dom.creatorDerivedName.value = '';
    dom.creatorDerivedDescription.value = '';
    renderLibrary();
    renderCreatorBase();
    addModule(module.id);
    toast(`${module.name} is now a reusable module.`, 'good');
  }

  function promotedCompositeDefinition(enabledLayers, limit = 6) {
    const priority = ['intensity', 'opacity', 'blur', 'edge', 'spread', 'depth', 'distance', 'softness', 'height', 'radius', 'density', 'speed', 'color', 'angle', 'parallax', 'roughness'];
    const candidates = [];
    enabledLayers.forEach((layer, layerIndex) => {
      const child = registry.get(layer.moduleId);
      (child?.parameters || []).forEach((parameter, parameterIndex) => {
        const priorityIndex = priority.indexOf(parameter.id);
        candidates.push({
          layer,
          layerIndex,
          child,
          parameter,
          score: priorityIndex === -1 ? 100 + parameterIndex : priorityIndex
        });
      });
    });
    candidates.sort((a, b) => a.score - b.score || a.layerIndex - b.layerIndex || a.parameter.id.localeCompare(b.parameter.id));
    const parameters = [];
    const bindingsByLayer = new Map();
    const used = new Set();
    for (const candidate of candidates) {
      if (parameters.length >= limit) break;
      const key = `${candidate.layerIndex + 1}.${candidate.parameter.id}`;
      if (used.has(key)) continue;
      used.add(key);
      const exposedId = `l${candidate.layerIndex + 1}.${candidate.parameter.id}`;
      const sourceValue = candidate.layer.params?.[candidate.parameter.id] ?? candidate.parameter.default;
      parameters.push({
        ...AXM.Utils.clone(candidate.parameter),
        id: exposedId,
        label: `${candidate.child.name} · ${candidate.parameter.label || candidate.parameter.name || candidate.parameter.id}`,
        default: AXM.Utils.clone(sourceValue),
        description: `Promoted from ${candidate.child.id}.${candidate.parameter.id}`
      });
      if (!bindingsByLayer.has(candidate.layerIndex)) bindingsByLayer.set(candidate.layerIndex, {});
      bindingsByLayer.get(candidate.layerIndex)[candidate.parameter.id] = exposedId;
    }
    return { parameters, bindingsByLayer };
  }

  function createCompositeModule(nameOverride = '') {
    const name = (nameOverride || dom.creatorCompositeName.value).trim();
    const description = dom.creatorCompositeDescription.value.trim();
    const enabledLayers = recipe.layers.filter((layer) => layer.enabled !== false);
    if (!name) { toast('Give the composite a name.', 'warn'); return; }
    if (!enabledLayers.length) { toast('There are no enabled layers to capture.', 'warn'); return; }
    const exposeControls = dom.creatorCompositeExpose?.checked !== false;
    const limit = Math.max(0, Number(dom.creatorCompositeLimit?.value || 6));
    const promoted = exposeControls ? promotedCompositeDefinition(enabledLayers, limit) : { parameters: [], bindingsByLayer: new Map() };
    const layers = enabledLayers.map((layer, index) => ({
      moduleId: layer.moduleId,
      params: AXM.Utils.clone(layer.params),
      ...(promoted.bindingsByLayer.get(index) ? { bindings: promoted.bindingsByLayer.get(index) } : {})
    }));
    const childAccessibility = enabledLayers.map((layer) => registry.get(layer.moduleId)?.accessibility || {});
    const reducedMotionSafe = childAccessibility.every((item) => item.reducedMotionSafe === true);
    const highContrastSafe = childAccessibility.every((item) => item.highContrastSafe === true);
    const photosensitiveSafe = childAccessibility.every((item) => item.photosensitiveSafe === true);
    const module = {
      id: uniqueCustomId(name),
      name,
      version: '1.0.0',
      schema: 'axm.visual-module/1',
      kind: 'mold',
      category: 'Custom Composites',
      status: 'WORKING',
      description: description || `Composite captured from ${enabledLayers.length} active layers.`,
      tags: ['custom', 'composite', 'mold'],
      dependencies: [...new Set(enabledLayers.map((layer) => layer.moduleId))],
      exclusiveGroup: null,
      shareable: true,
      ui: { icon: 'stack' },
      parameters: promoted.parameters,
      renderer: { type: 'composite', layers, exposedControlCount: promoted.parameters.length },
      quality: { low: { enabled: true }, medium: { enabled: true }, high: { enabled: true }, cinematic: { enabled: true } },
      accessibility: {
        reducedMotionSafe,
        highContrastSafe,
        photosensitiveSafe,
        notes: `Derived from ${childAccessibility.length} child declarations; safety is true only when every child explicitly declares it.`
      },
      provenance: buildProvenance(`Captured from recipe ${recipe.id}@${recipe.version}`)
    };
    const report = AXM.Validator.validateModule(module, registry);
    if (!report.valid) { toast(report.errors.map((item) => item.message).join(' '), 'bad'); return; }
    registry.register(module, { source: 'custom' });
    persistCustomModules();
    dom.creatorCompositeName.value = '';
    dom.creatorCompositeDescription.value = '';
    renderLibrary();
    renderCreatorBase();
    addModule(module.id);
    toast(`${module.name} captured as a recursive composite with ${promoted.parameters.length} promoted controls.`, 'good');
  }

  function expandComposite(instanceId) {
    const layer = recipe.layers.find((item) => item.instanceId === instanceId);
    const module = registry.get(layer?.moduleId);
    if (!module || module.renderer?.type !== 'composite') return;
    commit(`${module.name} expanded into ${(module.renderer.layers || []).length} layers`, (next) => {
      const index = next.layers.findIndex((item) => item.instanceId === instanceId);
      const parentParams = layer.params || {};
      const expanded = (module.renderer.layers || []).map((child) => {
        const childParams = { ...(child.params || {}) };
        Object.entries(child.bindings || {}).forEach(([childParamId, parentParamId]) => {
          if (Object.prototype.hasOwnProperty.call(parentParams, parentParamId)) childParams[childParamId] = parentParams[parentParamId];
        });
        return composer.instance(child.moduleId, childParams);
      });
      next.layers.splice(index, 1, ...expanded);
      selectedInstanceId = expanded[0]?.instanceId || null;
    });
  }

  function deleteCustomModule(moduleId) {
    if (registry.sourceOf(moduleId) !== 'custom') return;
    const module = registry.get(moduleId);
    const used = recipe.layers.filter((layer) => layer.moduleId === moduleId).length;
    const dependentCustom = registry.customModules().filter((candidate) => candidate.id !== moduleId && (candidate.dependencies || []).includes(moduleId));
    if (dependentCustom.length) {
      toast(`Cannot delete ${module.name}; ${dependentCustom.map((item) => item.name).join(', ')} depend on it.`, 'bad');
      return;
    }
    const confirmed = root.confirm(`Delete the custom definition “${module.name}”? ${used ? `${used} active layer(s) will also be removed.` : ''} This does not affect exported copies.`);
    if (!confirmed) return;
    commit(`Deleted custom module ${module.name}`, (next) => {
      next.layers = next.layers.filter((layer) => layer.moduleId !== moduleId);
      selectedInstanceId = next.layers.at(-1)?.instanceId || null;
    }, { tone: 'warn' });
    registry.unregister(moduleId);
    persistCustomModules();
    renderWorkspace();
  }

  function applyPreset(presetId) {
    const presets = {
      dashboard: { sceneId: 'scene.dashboard', moldId: 'mold.command-dashboard', name: 'Command Dashboard' },
      hero: { sceneId: 'scene.hero', moldId: 'mold.luminous-hero', name: 'Luminous Hero' },
      hud: { sceneId: 'scene.hud', moldId: 'mold.game-hud', name: 'Game HUD' },
      launcher: { sceneId: 'scene.launcher', moldId: 'mold.launcher-shell', name: 'Launcher Shell' }
    };
    const preset = presets[presetId];
    if (!preset) return;
    const mold = registry.get(preset.moldId);
    commit(`Applied ${preset.name} mold`, (next) => {
      next.sceneId = preset.sceneId;
      next.name = `AXM ${preset.name}`;
      next.layers = (mold.renderer.layers || []).map((child) => composer.instance(child.moduleId, child.params || {}));
      selectedInstanceId = next.layers[0]?.instanceId || null;
    });
    dom.presetSelect.value = '';
  }

  function composeVariation() {
    const moods = registry.moods.map((mood) => mood.id).filter((id) => id !== recipe.globals.mood);
    commit('Composed a traceable variation', (next) => {
      next.globals.mood = moods[Math.floor(Math.random() * moods.length)] || next.globals.mood;
      ['intensity', 'depth', 'motion'].forEach((key) => {
        next.globals[key] = AXM.Utils.clamp(next.globals[key] + (Math.random() - .5) * .18, .18, 1);
      });
      next.layers.forEach((layer) => {
        const module = registry.get(layer.moduleId);
        (module?.parameters || []).forEach((parameter) => {
          if (parameter.type !== 'number') return;
          const current = Number(layer.params[parameter.id] ?? parameter.default);
          const span = Number(parameter.max) - Number(parameter.min);
          const varied = current + (Math.random() - .5) * span * .12;
          layer.params[parameter.id] = AXM.Utils.clamp(varied, parameter.min, parameter.max);
        });
      });
    });
  }

  function saveSnapshot(name = '') {
    const snapshots = readStorage(STORAGE.snapshots, []);
    const snapshot = {
      id: AXM.Utils.uid('snapshot'),
      name: name || `${recipe.name} · ${new Date().toLocaleString()}`,
      created: new Date().toISOString(),
      recipe: AXM.Utils.clone(recipe),
      customModules: AXM.Utils.clone(registry.customModules())
    };
    snapshots.unshift(snapshot);
    const storageMode = writeStorage(STORAGE.snapshots, snapshots.slice(0, 16));
    toast(storageMode === 'persistent' ? 'Rollback snapshot saved locally.' : 'Rollback snapshot kept for this session. Export important work before closing.', storageMode === 'persistent' ? 'good' : 'warn');
  }

  function autoSnapshot(label) {
    saveSnapshot(`${label} · ${new Date().toLocaleString()}`);
  }

  function renderSnapshotsDialog() {
    const snapshots = readStorage(STORAGE.snapshots, []);
    if (!snapshots.length) {
      dom.snapshotsDialogBody.innerHTML = '<div class="inspector-empty">No snapshots yet.</div>';
      return;
    }
    dom.snapshotsDialogBody.innerHTML = `<div class="module-list">${snapshots.map((snapshot) => `<article class="module-card" data-snapshot-id="${esc(snapshot.id)}"><span class="module-icon">◇</span><span class="module-copy"><strong>${esc(snapshot.name)}</strong><small>${esc(new Date(snapshot.created).toLocaleString())} · ${snapshot.recipe.layers?.length || 0} layers · ${snapshot.customModules?.length ?? 'legacy'} custom definitions</small></span><span class="stack-actions"><button data-snapshot-action="restore" title="Restore">↶</button><button data-snapshot-action="delete" title="Delete">×</button></span></article>`).join('')}</div>`;
  }

  function restoreSnapshot(snapshotId) {
    const snapshots = readStorage(STORAGE.snapshots, []);
    const snapshot = snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return;
    let stagedRegistry = null;
    if (Array.isArray(snapshot.customModules)) {
      stagedRegistry = new AXM.ModuleRegistry(root.AXM_DEFAULT_CATALOG);
      try {
        snapshot.customModules.forEach((module) => {
          if (stagedRegistry.has(module.id)) throw new Error(`Snapshot custom module collides with built-in ${module.id}.`);
          stagedRegistry.register(module, { source: 'custom' });
        });
        const registryReport = AXM.Validator.validateCatalog(stagedRegistry);
        if (!registryReport.valid) throw new Error(registryReport.errors.map((item) => item.message).join(' '));
      } catch (error) {
        toast(`Snapshot registry restore blocked: ${error.message}`, 'bad');
        return;
      }
    }
    const recipeReport = AXM.Validator.validateRecipe(snapshot.recipe, stagedRegistry || registry);
    if (!recipeReport.valid) {
      toast(`Snapshot recipe restore blocked: ${recipeReport.errors.map((item) => item.message).join(' ')}`, 'bad');
      return;
    }
    autoSnapshot('Before snapshot restore');
    if (stagedRegistry) {
      registry.replaceFrom(stagedRegistry);
      persistCustomModules();
    }
    recipe = composer.normalizeRecipe(snapshot.recipe);
    selectedInstanceId = recipe.layers[0]?.instanceId || null;
    history.commit(recipe);
    persistRecipe();
    renderWorkspace();
    dom.snapshotsDialog.close();
    toast(stagedRegistry ? `Restored ${snapshot.name}, including custom module definitions.` : `Restored legacy snapshot ${snapshot.name}; custom definitions were not changed.`, 'good');
  }

  function deleteSnapshot(snapshotId) {
    const snapshots = readStorage(STORAGE.snapshots, []).filter((item) => item.id !== snapshotId);
    writeStorage(STORAGE.snapshots, snapshots);
    renderSnapshotsDialog();
  }

  function validationReport() {
    const recipeCompiled = composer.compile(recipe);
    const catalogReport = AXM.Validator.validateCatalog(registry);
    const errors = [...catalogReport.errors, ...recipeCompiled.report.errors];
    const warnings = [...catalogReport.warnings, ...recipeCompiled.report.warnings];
    const notes = [...catalogReport.notes, ...recipeCompiled.report.notes];
    return { errors, warnings, notes, compiled: recipeCompiled };
  }

  function openValidationDialog() {
    const report = validationReport();
    const section = (title, items, tone) => items.length ? `<h3>${esc(title)}</h3><div class="validation-mini">${items.map((item) => `<div class="validation-line ${tone}"><span>${tone === 'error' ? '×' : tone === 'warning' ? '!' : 'i'}</span><span><strong>${esc(item.code)}</strong> — ${esc(item.message)}${item.path ? `<br><small>${esc(item.path)}</small>` : ''}</span></div>`).join('')}</div>` : '';
    dom.validationDialogBody.innerHTML = `
      <div class="validation-summary"><div class="summary-tile errors"><strong>${report.errors.length}</strong><small>Blocking errors</small></div><div class="summary-tile warnings"><strong>${report.warnings.length}</strong><small>Warnings</small></div><div class="summary-tile notes"><strong>${report.compiled.plan.length}</strong><small>Resolved render modules</small></div></div>
      ${!report.errors.length && !report.warnings.length ? '<div class="validation-line note"><span>✓</span><span>Catalog, dependencies, recipe, and active render plan are structurally valid.</span></div>' : ''}
      ${section('Errors', report.errors, 'error')}${section('Warnings', report.warnings, 'warning')}${section('Notes', report.notes, 'note')}`;
    dom.validationDialog.showModal();
  }

  function guidePresetMap() {
    return {
      dashboard: { sceneId: 'scene.dashboard', moldId: 'mold.command-dashboard', name: 'Command Dashboard' },
      hero: { sceneId: 'scene.hero', moldId: 'mold.luminous-hero', name: 'Luminous Hero' },
      hud: { sceneId: 'scene.hud', moldId: 'mold.game-hud', name: 'Game HUD' },
      launcher: { sceneId: 'scene.launcher', moldId: 'mold.launcher-shell', name: 'Launcher Shell' }
    };
  }

  function updateGuideSummary() {
    const preset = guidePresetMap()[dom.guideGoal.value] || guidePresetMap().dashboard;
    const energyName = { calm: 'calm and restrained', balanced: 'balanced premium', cinematic: 'cinematic showcase' }[dom.guideEnergy.value];
    const deviceName = { battery: 'weak-device safe', balanced: 'adaptive balanced', quality: 'quality-preferring' }[dom.guideDevice.value];
    const safeguards = [dom.guideReducedMotion.checked && 'reduced motion', dom.guidePhotosensitiveSafe.checked && 'photosensitive safe', dom.guideHighContrast.checked && 'high contrast'].filter(Boolean);
    dom.guideSummary.textContent = `${preset.name} · ${energyName} · ${deviceName}${safeguards.length ? ` · ${safeguards.join(', ')}` : ''}. The resulting layers remain editable and traceable.`;
  }

  function openGuideDialog() {
    dom.guideMood.innerHTML = registry.moods.map((mood) => `<option value="${esc(mood.id)}">${esc(mood.name)}</option>`).join('');
    const currentPreset = Object.entries(guidePresetMap()).find(([, preset]) => preset.sceneId === recipe.sceneId)?.[0] || 'dashboard';
    dom.guideGoal.value = currentPreset;
    dom.guideMood.value = recipe.globals.mood;
    dom.guideDevice.value = recipe.globals.performanceBias || 'balanced';
    dom.guideReducedMotion.checked = Boolean(recipe.globals.reducedMotion);
    dom.guidePhotosensitiveSafe.checked = Boolean(recipe.globals.photosensitiveSafe);
    dom.guideHighContrast.checked = Boolean(recipe.globals.highContrast);
    updateGuideSummary();
    dom.guideDialog.showModal();
  }

  function applyGuide() {
    const preset = guidePresetMap()[dom.guideGoal.value] || guidePresetMap().dashboard;
    const mold = registry.get(preset.moldId);
    if (!mold || mold.renderer?.type !== 'composite') { toast('The selected guided foundation is unavailable.', 'bad'); return; }
    const energy = {
      calm: { intensity: 0.48, depth: 0.48, motion: 0.28, additions: [] },
      balanced: { intensity: 0.72, depth: 0.64, motion: 0.62, additions: [] },
      cinematic: { intensity: 0.9, depth: 0.82, motion: 0.78, additions: ['light.prismatic-dispersion', 'atmosphere.depth-fog'] }
    }[dom.guideEnergy.value] || { intensity: 0.72, depth: 0.64, motion: 0.62, additions: [] };
    if (dom.guideGoal.value === 'hero' && dom.guideEnergy.value === 'cinematic') energy.additions.push('light.godray-fan');
    if (dom.guideGoal.value === 'hud' && dom.guideEnergy.value === 'cinematic') energy.additions.push('focus.guidance-trail');
    autoSnapshot('Before guided creation');
    commit(`Built guided ${preset.name}`, (next) => {
      next.sceneId = preset.sceneId;
      next.name = `AXM ${preset.name}`;
      next.globals.mood = dom.guideMood.value;
      next.globals.intensity = energy.intensity;
      next.globals.depth = energy.depth;
      next.globals.motion = energy.motion;
      next.globals.quality = 'auto';
      next.globals.performanceBias = dom.guideDevice.value;
      next.globals.reducedMotion = dom.guideReducedMotion.checked;
      next.globals.photosensitiveSafe = dom.guidePhotosensitiveSafe.checked;
      next.globals.highContrast = dom.guideHighContrast.checked;
      next.layers = (mold.renderer.layers || []).map((child) => composer.instance(child.moduleId, child.params || {}));
      for (const moduleId of [...new Set(energy.additions)]) if (registry.has(moduleId)) next.layers.push(composer.instance(moduleId));
      selectedInstanceId = next.layers[0]?.instanceId || null;
    });
    governor.setBias(dom.guideDevice.value);
    dom.guideDialog.close();
  }

  function performanceReport() {
    const compileResult = composer.compile(recipe);
    const estimate = AXM.PerformanceGovernor.estimatePlan(compileResult.plan, compileResult.resolvedQuality, recipe.globals);
    return {
      schema: 'axm.performance-report/1',
      generatedAt: new Date().toISOString(),
      generatedBy: `AXM AetherFX Visual Effect Fabric v${AXM.version}`,
      recipe: { id: recipe.id, name: recipe.name, sceneId: recipe.sceneId, activeLayers: recipe.layers.filter((layer) => layer.enabled !== false).length },
      quality: { requested: recipe.globals.quality, resolved: compileResult.resolvedQuality, bias: recipe.globals.performanceBias || 'balanced' },
      accessibility: { reducedMotion: Boolean(recipe.globals.reducedMotion), photosensitiveSafe: Boolean(recipe.globals.photosensitiveSafe), highContrast: Boolean(recipe.globals.highContrast) },
      measured: governor.snapshot(),
      estimatedLoad: estimate,
      validation: { valid: compileResult.report.valid, errors: compileResult.report.errors.length, warnings: compileResult.report.warnings.length },
      boundary: 'FPS is measured in this browser session. Visual-load score is a transparent heuristic, not a GPU benchmark.'
    };
  }

  function openPerformanceDialog() {
    lastPerformanceReport = performanceReport();
    const measured = lastPerformanceReport.measured;
    const load = lastPerformanceReport.estimatedLoad;
    const maxScore = 110;
    const meter = Math.min(100, Math.round(load.score / maxScore * 100));
    const top = load.topContributors.map((item) => `<div class="cost-row"><span><strong>${esc(item.name)}</strong><br><small>${esc(item.moduleId)}</small></span><span>${item.score.toFixed(1)}</span></div>`).join('');
    dom.performanceDialogBody.innerHTML = `
      <div class="metric-grid">
        <div class="metric-card"><strong>${measured.averageFps || '—'}</strong><small>Average FPS</small></div>
        <div class="metric-card"><strong>${measured.lowPercentileFps || '—'}</strong><small>10% low FPS</small></div>
        <div class="metric-card"><strong>${load.score}</strong><small>Estimated load</small></div>
        <div class="metric-card"><strong>${esc(lastPerformanceReport.quality.resolved)}</strong><small>Resolved quality</small></div>
      </div>
      <p class="section-note">${esc(load.note)} Auto mode uses measured frame stability, device hints, and your ${esc(lastPerformanceReport.quality.bias)} bias. It never silently chooses cinematic.</p>
      <div class="load-meter" style="--load:${meter}%"><i></i></div>
      <div class="pill-row"><span class="info-pill">${esc(load.tier)} estimated load</span><span class="info-pill">${load.activeModules} resolved modules</span><span class="info-pill">recommended ${esc(load.recommendedQuality)}</span><span class="info-pill">${measured.sampleCount} FPS samples</span></div>
      <h3>Largest estimated contributors</h3>
      <div class="cost-list">${top || '<div class="inspector-empty">No active render modules.</div>'}</div>
      <h3>Device signal</h3>
      <div class="creator-summary">Logical processors: ${measured.hardware.logicalProcessors || 'not exposed'} · Device memory: ${measured.hardware.deviceMemoryGb ? `${measured.hardware.deviceMemoryGb} GB` : 'not exposed'} · OS reduced-motion preference: ${measured.hardware.reducedMotionPreference ? 'yes' : 'no'}.</div>`;
    dom.performanceDialog.showModal();
  }

  function dependencyGraph(moduleId) {
    const rows = [];
    const lines = [];
    const expanded = new Set();
    const walk = (id, depth, relation, trail = []) => {
      const module = registry.get(id);
      const prefix = `${'  '.repeat(depth)}${depth ? '↳ ' : ''}`;
      if (!module) {
        rows.push({ depth, id, relation, missing: true });
        lines.push(`${prefix}[MISSING] ${id}`);
        return;
      }
      const cycle = trail.includes(id);
      const reference = expanded.has(id) && depth > 0;
      rows.push({ depth, id, relation, module, cycle, reference });
      lines.push(`${prefix}${module.name} (${module.id}@${module.version})${cycle ? ' [CYCLE]' : reference ? ' [REFERENCE]' : ''}`);
      if (cycle || reference) return;
      expanded.add(id);
      const children = [];
      (module.dependencies || []).forEach((childId) => children.push({ id: childId, relation: 'dependency' }));
      if (module.renderer?.type === 'derived' && module.renderer.baseModuleId) children.push({ id: module.renderer.baseModuleId, relation: 'derived base' });
      if (module.renderer?.type === 'composite') (module.renderer.layers || []).forEach((layer) => children.push({ id: layer.moduleId, relation: 'composite layer' }));
      for (const child of children) walk(child.id, depth + 1, child.relation, [...trail, id]);
    };
    walk(moduleId, 0, 'entry');
    return { rows, text: lines.join('\n') };
  }

  function openGraphDialog(moduleId = selectedLayer()?.moduleId) {
    if (!moduleId || !registry.has(moduleId)) { toast('Select a module to inspect its dependency graph.', 'warn'); return; }
    const graph = dependencyGraph(moduleId);
    graphClipboardText = graph.text;
    const load = compiled ? AXM.PerformanceGovernor.estimatePlan(compiled.plan, compiled.resolvedQuality, recipe.globals) : null;
    dom.graphDialog.querySelector('h2').textContent = `${registry.get(moduleId).name} — Dependency Graph`;
    dom.graphDialogBody.innerHTML = `
      <p class="section-note">This is the actual declarative dependency/composite graph. Repeated modules are marked as references instead of being expanded forever.</p>
      <div class="graph-tree">${graph.rows.map((row) => `<div class="graph-node"><span class="graph-indent">${esc('│ '.repeat(row.depth))}</span><span class="graph-copy"><strong>${row.missing ? esc(row.id) : esc(row.module.name)}</strong><small>${esc(row.relation)} · ${row.missing ? 'missing' : `${esc(row.module.kind)} · ${esc(registry.sourceOf(row.id))} · ${esc(row.id)}`}</small></span><span class="graph-meta">${row.cycle ? 'cycle' : row.reference ? 'ref' : row.module ? `v${esc(row.module.version)}` : '×'}</span></div>`).join('')}</div>
      ${load ? `<div class="creator-summary">Active recipe: ${compiled.plan.length} resolved render modules · ${load.score} estimated load · ${load.tier}. This graph may include capability dependencies that do not each become a separate visible layer.</div>` : ''}`;
    dom.graphDialog.showModal();
  }

  function renderRepairAnalysis() {
    lastRepairAnalysis = AXM.RepairCenter.analyzeRecipe(recipe, registry, composer);
    const registryAnalysis = AXM.RepairCenter.analyzeRegistry(registry);
    const actions = lastRepairAnalysis.actions.map((item) => `<div class="repair-row"><span><strong>${esc(item.code)}</strong><br><small>${esc(item.message)}</small></span><span>repair</span></div>`).join('');
    const customWarnings = [...registryAnalysis.invalidCustom, ...registryAnalysis.dependencyErrors].map((item) => `<div class="repair-row"><span><strong>${esc(item.name || item.moduleId)}</strong><br><small>${esc(item.message || (item.errors || []).map((error) => error.message).join(' '))}</small></span><span>custom</span></div>`).join('');
    dom.repairDialogBody.innerHTML = `
      <div class="validation-summary"><div class="summary-tile errors"><strong>${lastRepairAnalysis.before.errors.length}</strong><small>Current recipe errors</small></div><div class="summary-tile warnings"><strong>${lastRepairAnalysis.actions.length}</strong><small>Safe repair actions</small></div><div class="summary-tile notes"><strong>${lastRepairAnalysis.after.valid ? '✓' : '×'}</strong><small>After-repair validity</small></div></div>
      <div class="review-banner ${lastRepairAnalysis.changed ? 'warn' : 'good'}">${lastRepairAnalysis.changed ? 'Repairable drift was found. Nothing changes until you explicitly apply the repair.' : 'No repairable recipe drift was found.'}</div>
      <h3>Proposed recipe actions</h3><div class="repair-list">${actions || '<div class="inspector-empty">No recipe changes proposed.</div>'}</div>
      <h3>Custom module health</h3><div class="repair-list">${customWarnings || '<div class="validation-line note"><span>✓</span><span>Custom module definitions and dependency closures are clean.</span></div>'}</div>
      <p class="section-note">Applying repair first creates a rollback snapshot. Built-in modules are never rewritten. Invalid custom modules are reported, not silently deleted.</p>`;
    dom.btnApplyRepair.disabled = !lastRepairAnalysis.changed || !lastRepairAnalysis.after.valid;
  }

  function openRepairDialog() {
    renderRepairAnalysis();
    dom.repairDialog.showModal();
  }

  function applyRepair() {
    if (!lastRepairAnalysis?.changed || !lastRepairAnalysis.after.valid) return;
    const actionCount = lastRepairAnalysis.actions.length;
    autoSnapshot('Before safe repair');
    recipe = composer.normalizeRecipe(lastRepairAnalysis.repaired);
    selectedInstanceId = recipe.layers[0]?.instanceId || null;
    history.commit(recipe);
    persistRecipe();
    renderWorkspace();
    renderRepairAnalysis();
    toast(`Applied ${actionCount} safe repair actions.`, 'good');
  }

  function normalizationDiff(before, after, path = 'recipe', output = [], limit = 32) {
    if (output.length >= limit) return output;
    if (AXM.Utils.canonicalJson(before) === AXM.Utils.canonicalJson(after)) return output;
    const beforeObject = before && typeof before === 'object';
    const afterObject = after && typeof after === 'object';
    if (!beforeObject || !afterObject || Array.isArray(before) !== Array.isArray(after)) {
      output.push({ path, before, after });
      return output;
    }
    if (Array.isArray(before) && before.length !== after.length) {
      output.push({ path: `${path}.length`, before: before.length, after: after.length });
    }
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      if (output.length >= limit) break;
      if (!Object.prototype.hasOwnProperty.call(before, key)) {
        output.push({ path: `${path}.${key}`, before: undefined, after: after[key] });
      } else if (!Object.prototype.hasOwnProperty.call(after, key)) {
        output.push({ path: `${path}.${key}`, before: before[key], after: undefined });
      } else {
        normalizationDiff(before[key], after[key], `${path}.${key}`, output, limit);
      }
    }
    return output;
  }

  function shortValue(value) {
    if (value === undefined) return 'not present';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > 90 ? `${text.slice(0, 87)}…` : text;
  }

  async function reviewImportFile(file) {
    try {
      const data = await AXM.Utils.readJsonFile(file);
      pendingImport = { data, fileName: file.name, canApply: false, kind: 'unknown', preview: null };
      if (data.schema === 'axm.visual-recipe/1') {
        const rawReport = AXM.Validator.validateRecipe(data, registry);
        if (!rawReport.valid) {
          pendingImport = { ...pendingImport, kind: 'raw-recipe', canApply: false, preview: { report: rawReport } };
          dom.importReviewDialogBody.innerHTML = `
            <div class="review-banner bad">Raw recipe review found blocking errors. The file was not normalized or changed before review.</div>
            <div class="metric-grid"><div class="metric-card"><strong>${Array.isArray(data.layers) ? data.layers.length : '×'}</strong><small>Raw layers</small></div><div class="metric-card"><strong>${rawReport.errors.length}</strong><small>Errors</small></div><div class="metric-card"><strong>${rawReport.warnings.length}</strong><small>Warnings</small></div><div class="metric-card"><strong>blocked</strong><small>Mutation</small></div></div>
            <h3>Blocking raw-source errors</h3><div class="validation-mini">${rawReport.errors.slice(0, 16).map((item) => `<div class="validation-line error"><span>×</span><span>${esc(item.message)}${item.path ? `<br><small>${esc(item.path)}</small>` : ''}</span></div>`).join('')}</div>
            <p class="section-note">File: ${esc(file.name)}. Correct the source or import a sealed recipe package. No silent schema, scene, parameter, or provenance repair was applied.</p>`;
          dom.btnConfirmImport.disabled = true;
          dom.importReviewDialog.showModal();
          return;
        }
        const normalized = composer.normalizeRecipe(data);
        const normalizedReport = AXM.Validator.validateRecipe(normalized, registry);
        const changes = normalizationDiff(data, normalized);
        pendingImport = { ...pendingImport, kind: 'raw-recipe', normalized, canApply: normalizedReport.valid, preview: { report: normalizedReport, rawReport, changes } };
        dom.importReviewDialogBody.innerHTML = `
          <div class="review-banner ${changes.length ? 'warn' : 'good'}">${changes.length ? 'The raw recipe is valid, but normalization will make explicit changes. Review them before confirming.' : 'The raw recipe is valid and normalization makes no material change.'}</div>
          <div class="metric-grid"><div class="metric-card"><strong>${normalized.layers.length}</strong><small>Layers</small></div><div class="metric-card"><strong>${rawReport.errors.length}</strong><small>Raw errors</small></div><div class="metric-card"><strong>${changes.length}</strong><small>Shown changes</small></div><div class="metric-card"><strong>${esc(normalized.sceneId)}</strong><small>Scene</small></div></div>
          ${changes.length ? `<h3>Normalization diff</h3><div class="repair-list">${changes.map((item) => `<div class="repair-row"><span><strong>${esc(item.path)}</strong><br><small>${esc(shortValue(item.before))} → ${esc(shortValue(item.after))}</small></span><span>review</span></div>`).join('')}</div>` : ''}
          ${rawReport.warnings.length ? `<h3>Raw-source warnings</h3><div class="validation-mini">${rawReport.warnings.slice(0, 12).map((item) => `<div class="validation-line warning"><span>!</span><span>${esc(item.message)}${item.path ? `<br><small>${esc(item.path)}</small>` : ''}</span></div>`).join('')}</div>` : ''}
          <p class="section-note">File: ${esc(file.name)}. Confirming explicitly accepts the displayed normalization and creates a rollback snapshot first.</p>`;
      } else {
        const preview = await AXM.PackageIO.previewPackage(data, registry);
        pendingImport = { ...pendingImport, kind: 'package', preview, canApply: !preview.blocked };
        const integrityLabel = data.integrity?.value ? (preview.integrity.verified ? 'verified' : 'failed') : 'not supplied';
        dom.importReviewDialogBody.innerHTML = `
          <div class="review-banner ${preview.blocked ? 'bad' : preview.unresolvedLicenses ? 'warn' : 'good'}">${preview.blocked ? 'This package is blocked and will not mutate the library.' : 'Package passed structural and integrity review. Confirm before applying.'}</div>
          <div class="metric-grid"><div class="metric-card"><strong>${preview.counts.modules}</strong><small>Bundled modules</small></div><div class="metric-card"><strong>${preview.counts.newCustom}</strong><small>New custom</small></div><div class="metric-card"><strong>${preview.counts.customUpdates}</strong><small>Custom updates</small></div><div class="metric-card"><strong>${esc(integrityLabel)}</strong><small>SHA-256</small></div></div>
          <div class="pill-row"><span class="info-pill">${esc(preview.schema)}</span><span class="info-pill">v${esc(preview.version)}</span><span class="info-pill">${preview.unresolvedLicenses} unset licences</span><span class="info-pill">${preview.counts.builtInMatches} matching built-ins</span></div>
          ${preview.report.errors.length ? `<h3>Blocking errors</h3><div class="validation-mini">${preview.report.errors.map((item) => `<div class="validation-line error"><span>×</span><span>${esc(item.message)}</span></div>`).join('')}</div>` : ''}
          ${preview.report.warnings.length ? `<h3>Warnings</h3><div class="validation-mini">${preview.report.warnings.slice(0, 12).map((item) => `<div class="validation-line warning"><span>!</span><span>${esc(item.message)}</span></div>`).join('')}</div>` : ''}
          <p class="section-note">File: ${esc(file.name)}. Review proves structure and file consistency, not ownership or public redistribution rights.</p>`;
      }
      dom.btnConfirmImport.disabled = !pendingImport.canApply;
      dom.importReviewDialog.showModal();
    } catch (error) {
      pendingImport = null;
      toast(error.message, 'bad');
    } finally {
      dom.fileImport.value = '';
    }
  }

  async function confirmPendingImport() {
    if (!pendingImport?.canApply) return;
    try {
      autoSnapshot('Before reviewed import');
      if (pendingImport.kind === 'raw-recipe') {
        recipe = pendingImport.normalized;
        selectedInstanceId = recipe.layers[0]?.instanceId || null;
        history.commit(recipe);
        persistRecipe();
        renderWorkspace();
        toast('Reviewed recipe imported. Existing work remains in rollback snapshots.', 'good');
      } else {
        const imported = await AXM.PackageIO.importPackage(pendingImport.data, registry);
        persistCustomModules();
        if (imported.type === 'recipe') {
          recipe = composer.normalizeRecipe(imported.recipe);
          selectedInstanceId = recipe.layers[0]?.instanceId || null;
          history.commit(recipe);
          persistRecipe();
        }
        renderWorkspace();
        toast(imported.type === 'module' ? `Imported ${imported.imported.length} reviewed custom module definitions.` : 'Reviewed recipe package imported and verified.', 'good');
      }
      dom.importReviewDialog.close();
      pendingImport = null;
    } catch (error) { toast(error.message, 'bad'); }
  }

  async function exportModule(moduleId) {
    if (!moduleId) { toast('Select an active module first.', 'warn'); return; }
    try {
      const pkg = await AXM.PackageIO.createModulePackage(moduleId, registry);
      const filename = `${AXM.Utils.slugify(pkg.name)}_v${pkg.version}.axmfx.json`;
      AXM.Utils.downloadJson(filename, pkg);
      toast(`Exported ${pkg.modules.length} versioned modules with integrity metadata.`, 'good');
    } catch (error) {
      toast(error.message, 'bad');
    }
  }

  async function exportRecipePackage() {
    try {
      const pkg = await AXM.PackageIO.createRecipePackage(recipe, registry);
      AXM.Utils.downloadJson(`${AXM.Utils.slugify(recipe.name)}_v${recipe.version}.axmrecipe.json`, pkg);
      toast('Recipe package exported with custom dependencies and integrity hash.', 'good');
      dom.exportDialog.close();
    } catch (error) { toast(error.message, 'bad'); }
  }

  function exportRawRecipe() {
    AXM.Utils.downloadJson(`${AXM.Utils.slugify(recipe.name)}_recipe.json`, recipe);
    toast('Readable recipe JSON exported.', 'good');
    dom.exportDialog.close();
  }

  function exportCssTokens() {
    if (!compiled?.report.valid) { toast('Resolve blocking validation errors before CSS export.', 'bad'); return; }
    const mood = registry.mood(recipe.globals.mood) || {};
    const lines = [
      '/* AXM AetherFX token snapshot — declarative output */',
      ':root {',
      `  --axm-accent: ${mood.accent || '#58e6ff'};`,
      `  --axm-accent-2: ${mood.accent2 || '#a56cff'};`,
      `  --axm-warm: ${mood.warm || '#ff75d8'};`,
      `  --axm-scene-bg: ${mood.bg || '#050814'};`,
      `  --axm-global-intensity: ${Number(recipe.globals.intensity || 0).toFixed(3)};`,
      `  --axm-global-depth: ${Number(recipe.globals.depth || 0).toFixed(3)};`,
      `  --axm-global-motion: ${Number(recipe.globals.motion || 0).toFixed(3)};`
    ];
    compiled.plan.forEach((item, index) => {
      (item.module.parameters || []).forEach((definition) => {
        if (!definition.cssVar || item.params[definition.id] === undefined) return;
        const value = item.params[definition.id];
        const unit = definition.unit && typeof value === 'number' ? definition.unit : '';
        lines.push(`  ${definition.cssVar}-${index + 1}: ${value}${unit}; /* ${item.moduleId}.${definition.id} */`);
      });
    });
    lines.push('}', '', '/* Module order */');
    compiled.plan.forEach((item, index) => lines.push(`/* ${index + 1}. ${item.moduleId} (${item.source}) */`));
    AXM.Utils.downloadText(`${AXM.Utils.slugify(recipe.name)}_tokens.css`, lines.join('\n'), 'text/css;charset=utf-8');
    toast('CSS token snapshot exported.', 'good');
    dom.exportDialog.close();
  }

  function exportVisualIntent() {
    if (!compiled?.report.valid) { toast('Resolve blocking validation errors before intent export.', 'bad'); return; }
    const contract = AXM.Intent.create(compiled, registry, { target: 'engine-neutral' });
    AXM.Utils.downloadJson(`${AXM.Utils.slugify(recipe.name)}_visual-intent.json`, contract);
    toast(`Canonical visual intent exported with ${contract.operations.length} resolved operations.`, 'good');
    dom.exportDialog.close();
  }

  function exportTargetReport() {
    if (!compiled?.report.valid) { toast('Resolve blocking validation errors before target export.', 'bad'); return; }
    const target = dom.exportTargetProfile.value || 'generic-game-contract';
    const report = AXM.Intent.targetReport(compiled, registry, target);
    AXM.Utils.downloadJson(`${AXM.Utils.slugify(recipe.name)}_${target}_support.json`, report);
    toast(`${report.target.name}: ${report.summary.implemented} implemented, ${report.summary.approximated} approximated, ${report.summary.contract} contract-only, ${report.summary.unsupported} unsupported.`, report.summary.unsupported ? 'warn' : 'good');
    dom.exportDialog.close();
  }

  function standaloneInteractionScript() {
    return `(() => {
      const stage = document.querySelector('.axm-stage');
      const spotlight = stage?.querySelector('.fx-overlay-spotlight');
      if (stage && spotlight) stage.addEventListener('pointermove', e => { const r=stage.getBoundingClientRect(); spotlight.style.setProperty('--pointer-x',(e.clientX-r.left)+'px'); spotlight.style.setProperty('--pointer-y',(e.clientY-r.top)+'px'); });
      if (stage?.classList.contains('fx-click-ripple')) stage.addEventListener('pointerdown', e => { const r=stage.getBoundingClientRect(), n=document.createElement('span'); n.className='fx-ripple-instance'; n.style.left=(e.clientX-r.left)+'px'; n.style.top=(e.clientY-r.top)+'px'; stage.appendChild(n); setTimeout(()=>n.remove(),800); });
      if (stage?.classList.contains('fx-multi-plane')) stage.addEventListener('pointermove', e => { const r=stage.getBoundingClientRect(); stage.style.setProperty('--parallax-x',(((e.clientX-r.left)/r.width-.5)*20)+'px'); stage.style.setProperty('--parallax-y',(((e.clientY-r.top)/r.height-.5)*20)+'px'); });
    })();`;
  }

  function exportStandalone() {
    if (!compiled?.report.valid) { toast('Resolve blocking validation errors before standalone export.', 'bad'); return; }
    const clone = adapter.cloneStage();
    clone.style.width = 'min(1400px, calc(100vw - 24px))';
    clone.style.margin = '12px auto';
    clone.style.minHeight = 'min(800px, calc(100vh - 24px))';
    clone.removeAttribute('aria-live');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(recipe.name)}</title><style>html,body{margin:0;min-height:100%;background:#03050a;display:grid;place-items:center;overflow:auto}${root.AXM_RUNTIME_CSS || ''}</style></head><body>${clone.outerHTML}<script>${standaloneInteractionScript().replaceAll('</script>', '<\\/script>')}<\\/script></body></html>`;
    AXM.Utils.downloadText(`${AXM.Utils.slugify(recipe.name)}_standalone.html`, html, 'text/html;charset=utf-8');
    toast('Standalone live HTML scene exported.', 'good');
    dom.exportDialog.close();
  }

  function exportWebComponent() {
    if (!compiled?.report.valid) { toast('Resolve blocking validation errors before Web Component export.', 'bad'); return; }
    const clone = adapter.cloneStage();
    clone.removeAttribute('aria-live');
    const tag = `axm-${AXM.Utils.slugify(recipe.name).slice(0, 42) || 'aether-surface'}`;
    const escapeTemplate = (value) => String(value).replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${').replaceAll('</script>', '<\\/script>');
    const css = escapeTemplate(`:host{display:block;contain:content}${root.AXM_RUNTIME_CSS || ''}`);
    const markup = escapeTemplate(clone.outerHTML);
    const source = `/* AXM AetherFX v1.3.0 — self-contained Web Component.\n   Generated locally with no network dependency. */\nclass AXMAetherSurface extends HTMLElement {\n  connectedCallback(){\n    if(this.shadowRoot) return;\n    const root=this.attachShadow({mode:'open'});\n    root.innerHTML=\`<style>${css}</style>${markup}\`;\n    const stage=root.querySelector('.axm-stage');\n    const spotlight=stage?.querySelector('.fx-overlay-spotlight');\n    if(stage&&spotlight) stage.addEventListener('pointermove',event=>{const rect=stage.getBoundingClientRect();spotlight.style.setProperty('--pointer-x',(event.clientX-rect.left)+'px');spotlight.style.setProperty('--pointer-y',(event.clientY-rect.top)+'px');});\n    if(stage?.classList.contains('fx-click-ripple')) stage.addEventListener('pointerdown',event=>{const rect=stage.getBoundingClientRect(),node=document.createElement('span');node.className='fx-ripple-instance';node.style.left=(event.clientX-rect.left)+'px';node.style.top=(event.clientY-rect.top)+'px';stage.appendChild(node);setTimeout(()=>node.remove(),800);});\n    if(stage?.classList.contains('fx-multi-plane')) stage.addEventListener('pointermove',event=>{const rect=stage.getBoundingClientRect();stage.style.setProperty('--parallax-x',(((event.clientX-rect.left)/rect.width-.5)*20)+'px');stage.style.setProperty('--parallax-y',(((event.clientY-rect.top)/rect.height-.5)*20)+'px');});\n  }\n}\nif(!customElements.get('${tag}')) customElements.define('${tag}',AXMAetherSurface);\n// Usage: <${tag}></${tag}>\n`;
    AXM.Utils.downloadText(`${AXM.Utils.slugify(recipe.name)}_web-component.js`, source, 'text/javascript;charset=utf-8');
    toast(`Embeddable <${tag}> Web Component exported.`, 'good');
    dom.exportDialog.close();
  }

  async function importFile(file) { return reviewImportFile(file); }

  function inspectJson(value, title = 'Inspectable Recipe') {
    dom.jsonDialog.querySelector('h2').textContent = title;
    dom.jsonView.textContent = JSON.stringify(value, null, 2);
    dom.jsonDialog.showModal();
  }

  async function copyJson() {
    const text = dom.jsonView.textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('JSON copied.', 'good');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      toast('JSON copied.', 'good');
    }
  }

  function bindStaticEvents() {
    document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog')?.close()));
    document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
    document.querySelectorAll('[data-creator-mode]').forEach((button) => button.addEventListener('click', () => setCreatorMode(button.dataset.creatorMode)));
    document.querySelector('.mobile-tools-menu')?.addEventListener('click', (event) => {
      const action = event.target.closest('[data-mobile-action]')?.dataset.mobileAction;
      const targetId = { guide: 'btnGuide', performance: 'btnPerformance', repair: 'btnRepair', snapshot: 'btnSnapshot', restore: 'btnSnapshots', validate: 'btnValidate', import: 'btnImport' }[action];
      if (!targetId) return;
      byId('mobileTools')?.removeAttribute('open');
      byId(targetId)?.click();
    });

    dom.moduleSearch.addEventListener('input', AXM.Utils.debounce(renderLibrary, 80));
    dom.btnShowPrimitives.addEventListener('click', () => { showPrimitives = !showPrimitives; renderLibrary(); });
    dom.moduleLibrary.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="add-module"]');
      if (!button || button.disabled) return;
      addModule(button.closest('[data-module-id]').dataset.moduleId);
    });

    dom.activeStack.addEventListener('click', (event) => {
      const item = event.target.closest('[data-instance-id]');
      if (!item) return;
      const instanceId = item.dataset.instanceId;
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'select-layer') { selectedInstanceId = instanceId; renderStack(); renderInspector(); return; }
      if (action === 'move-up') moveLayer(instanceId, -1);
      if (action === 'move-down') moveLayer(instanceId, 1);
      if (action === 'remove-layer') removeLayer(instanceId);
    });
    dom.activeStack.addEventListener('change', (event) => {
      if (event.target.matches('[data-action="toggle-layer"]')) toggleLayer(event.target.closest('[data-instance-id]').dataset.instanceId, event.target.checked);
    });

    dom.selectedInspector.addEventListener('input', (event) => {
      const input = event.target.closest('[data-param]');
      if (!input) return;
      const layer = selectedLayer();
      const module = registry.get(layer?.moduleId);
      const definition = module?.parameters?.find((parameter) => parameter.id === input.dataset.param);
      if (!layer || !definition) return;
      layer.params[definition.id] = definition.type === 'number' ? Number(input.value) : input.value;
      const output = dom.selectedInspector.querySelector(`[data-output-for="${CSS.escape(definition.id)}"]`);
      if (output) output.textContent = `${definition.type === 'number' && definition.step < 1 ? Number(input.value).toFixed(2) : input.value}${input.dataset.unit || ''}`;
      renderPreview();
    });
    dom.selectedInspector.addEventListener('change', (event) => {
      if (event.target.closest('[data-param]')) commitCurrent('Module controls updated', { silent: true });
    });
    dom.selectedInspector.addEventListener('click', (event) => {
      const action = event.target.closest('[data-inspector-action]')?.dataset.inspectorAction;
      if (!action) return;
      const layer = selectedLayer();
      const module = registry.get(layer?.moduleId);
      if (!layer || !module) return;
      if (action === 'reset-params') commit(`Reset ${module.name}`, (next) => { const target = next.layers.find((item) => item.instanceId === layer.instanceId); target.params = registry.defaultParams(module); });
      if (action === 'expand-composite') expandComposite(layer.instanceId);
      if (action === 'derive-module') { setTab('creator'); setCreatorMode('derived'); dom.creatorBase.value = module.id; dom.creatorDerivedName.value = `${module.name} Variation`; updateCreatorSummary(); }
      if (action === 'export-module') exportModule(module.id);
      if (action === 'inspect-graph') openGraphDialog(module.id);
      if (action === 'delete-module') deleteCustomModule(module.id);
      if (action === 'inspect-module') inspectJson(module, module.name);
    });

    dom.sceneSelect.addEventListener('change', () => commit('Scene changed', (next) => { next.sceneId = dom.sceneSelect.value; }, { silent: true }));
    dom.presetSelect.addEventListener('change', () => applyPreset(dom.presetSelect.value));
    dom.moodSelect.addEventListener('change', () => commit('Mood changed', (next) => { next.globals.mood = dom.moodSelect.value; }, { silent: true }));
    dom.qualitySelect.addEventListener('change', () => commit('Performance tier changed', (next) => { next.globals.quality = dom.qualitySelect.value; }, { silent: true }));
    dom.performanceBiasSelect.addEventListener('change', () => { governor.setBias(dom.performanceBiasSelect.value); commit('Auto quality bias updated', (next) => { next.globals.performanceBias = dom.performanceBiasSelect.value; if (next.globals.quality === 'auto') next.globals.resolvedQuality = governor.lastDecision; }, { silent: true }); });

    const bindGlobalRange = (input, output, key) => {
      input.addEventListener('input', () => { recipe.globals[key] = Number(input.value); output.textContent = `${Math.round(Number(input.value) * 100)}%`; renderPreview(); });
      input.addEventListener('change', () => commitCurrent(`${key} updated`, { silent: true }));
    };
    bindGlobalRange(dom.globalIntensity, dom.globalIntensityOut, 'intensity');
    bindGlobalRange(dom.globalDepth, dom.globalDepthOut, 'depth');
    bindGlobalRange(dom.globalMotion, dom.globalMotionOut, 'motion');
    dom.toggleReducedMotion.addEventListener('change', () => commit('Reduced-motion setting updated', (next) => { next.globals.reducedMotion = dom.toggleReducedMotion.checked; }, { silent: true }));
    dom.togglePhotosensitiveSafe.addEventListener('change', () => commit('Photosensitive-safe setting updated', (next) => { next.globals.photosensitiveSafe = dom.togglePhotosensitiveSafe.checked; }, { silent: true }));
    dom.toggleHighContrast.addEventListener('change', () => commit('Contrast setting updated', (next) => { next.globals.highContrast = dom.toggleHighContrast.checked; }, { silent: true }));
    dom.toggleLargeText.addEventListener('change', () => commit('Preview text setting updated', (next) => { next.globals.largeText = dom.toggleLargeText.checked; }, { silent: true }));

    dom.btnUndo.addEventListener('click', () => { const state = history.undo(); if (!state) return; recipe = state; selectedInstanceId = recipe.layers.find((layer) => layer.instanceId === selectedInstanceId)?.instanceId || recipe.layers.at(-1)?.instanceId || null; persistRecipe(); renderWorkspace(); toast('Undid the last committed change.', 'good'); });
    dom.btnRedo.addEventListener('click', () => { const state = history.redo(); if (!state) return; recipe = state; selectedInstanceId = recipe.layers.at(-1)?.instanceId || null; persistRecipe(); renderWorkspace(); toast('Redid the change.', 'good'); });
    dom.btnGuide.addEventListener('click', openGuideDialog);
    dom.btnPerformance.addEventListener('click', openPerformanceDialog);
    dom.btnRepair.addEventListener('click', openRepairDialog);
    dom.btnSnapshot.addEventListener('click', () => saveSnapshot());
    dom.btnSnapshots.addEventListener('click', () => { renderSnapshotsDialog(); dom.snapshotsDialog.showModal(); });
    dom.btnValidate.addEventListener('click', openValidationDialog);
    dom.btnImport.addEventListener('click', () => dom.fileImport.click());
    dom.fileImport.addEventListener('change', () => { const file = dom.fileImport.files?.[0]; if (file) importFile(file); });
    dom.btnExport.addEventListener('click', () => dom.exportDialog.showModal());
    dom.btnInspectJson.addEventListener('click', () => inspectJson(recipe));
    dom.btnCopyJson.addEventListener('click', copyJson);
    [dom.guideGoal, dom.guideMood, dom.guideEnergy, dom.guideDevice, dom.guideReducedMotion, dom.guidePhotosensitiveSafe, dom.guideHighContrast].forEach((control) => control.addEventListener('change', updateGuideSummary));
    dom.btnApplyGuide.addEventListener('click', applyGuide);
    dom.btnExportPerformanceReport.addEventListener('click', () => { const report = lastPerformanceReport || performanceReport(); AXM.Utils.downloadJson(`${AXM.Utils.slugify(recipe.name)}_performance-report.json`, report); toast('Performance report exported.', 'good'); });
    dom.btnCopyGraph.addEventListener('click', async () => { try { await navigator.clipboard.writeText(graphClipboardText); toast('Dependency graph copied.', 'good'); } catch { AXM.Utils.downloadText(`${AXM.Utils.slugify(recipe.name)}_dependency-graph.txt`, graphClipboardText); toast('Clipboard unavailable; graph downloaded as text.', 'warn'); } });
    dom.btnAnalyzeRepair.addEventListener('click', renderRepairAnalysis);
    dom.btnApplyRepair.addEventListener('click', applyRepair);
    dom.btnConfirmImport.addEventListener('click', confirmPendingImport);

    dom.btnVariation.addEventListener('click', composeVariation);
    dom.btnResetRecipe.addEventListener('click', () => {
      autoSnapshot('Before reset');
      commit('Reset to the working foundation', (next) => {
        const fresh = composer.createDefaultRecipe();
        Object.keys(next).forEach((key) => delete next[key]);
        Object.assign(next, fresh);
        selectedInstanceId = fresh.layers[0]?.instanceId || null;
      }, { tone: 'warn' });
    });
    dom.btnFullscreen.addEventListener('click', async () => { try { if (!document.fullscreenElement) await dom.previewWrap.requestFullscreen(); else await document.exitFullscreen(); } catch (error) { toast(`Fullscreen is unavailable: ${error.message}`, 'warn'); } });

    dom.btnCreateDerived.addEventListener('click', createDerivedModule);
    dom.btnCreateComposite.addEventListener('click', () => createCompositeModule());
    dom.btnCaptureComposite.addEventListener('click', () => { setTab('creator'); setCreatorMode('composite'); dom.creatorCompositeName.focus(); });
    dom.btnClearStack.addEventListener('click', () => commit('Cleared active stack', (next) => { next.layers = []; selectedInstanceId = null; }, { tone: 'warn' }));
    dom.creatorBase.addEventListener('change', updateCreatorSummary);
    dom.creatorCompositeExpose.addEventListener('change', updateCreatorSummary);
    dom.creatorCompositeLimit.addEventListener('change', updateCreatorSummary);

    dom.snapshotsDialogBody.addEventListener('click', (event) => {
      const card = event.target.closest('[data-snapshot-id]');
      const action = event.target.closest('[data-snapshot-action]')?.dataset.snapshotAction;
      if (!card || !action) return;
      if (action === 'restore') restoreSnapshot(card.dataset.snapshotId);
      if (action === 'delete') deleteSnapshot(card.dataset.snapshotId);
    });

    dom.exportRecipePackage.addEventListener('click', exportRecipePackage);
    dom.exportRawRecipe.addEventListener('click', exportRawRecipe);
    dom.exportSelectedModule.addEventListener('click', () => { const layer = selectedLayer(); exportModule(layer?.moduleId); if (layer) dom.exportDialog.close(); });
    dom.exportStandalone.addEventListener('click', exportStandalone);
    dom.exportWebComponent.addEventListener('click', exportWebComponent);
    dom.exportCssTokens.addEventListener('click', exportCssTokens);
    dom.exportVisualIntent.addEventListener('click', exportVisualIntent);
    dom.exportTargetReport.addEventListener('click', exportTargetReport);

    document.addEventListener('keydown', (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); dom.btnUndo.click(); }
      if (modifier && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) { event.preventDefault(); dom.btnRedo.click(); }
      if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); saveSnapshot(); }
    });
  }

  function cacheDom() {
    [
      'toastRegion','libraryCount','btnShowPrimitives','moduleSearch','moduleLibrary','activeStack','creatorDerived','creatorComposite','creatorBase','creatorDerivedName','creatorDerivedDescription','creatorDerivedSummary','creatorCompositeName','creatorCompositeDescription','creatorCompositeExpose','creatorCompositeLimit','creatorCompositeSummary','btnCreateDerived','btnCreateComposite','btnCaptureComposite','btnClearStack',
      'sceneSelect','presetSelect','previewWrap','previewStage','renderStatus','recipeStatus','modulePlanStatus','fpsStatus','autosaveStatus','btnVariation','btnResetRecipe','btnFullscreen',
      'moodSelect','qualitySelect','performanceBiasSelect','globalIntensity','globalIntensityOut','globalDepth','globalDepthOut','globalMotion','globalMotionOut','toggleReducedMotion','togglePhotosensitiveSafe','toggleHighContrast','toggleLargeText','selectedSource','selectedInspector','validationLabel','validationMini','btnInspectJson',
      'btnUndo','btnRedo','btnGuide','btnPerformance','btnRepair','btnSnapshot','btnSnapshots','btnValidate','btnImport','btnExport','fileImport','validationDialog','validationDialogBody','snapshotsDialog','snapshotsDialogBody','exportDialog','jsonDialog','jsonView','btnCopyJson','exportRecipePackage','exportRawRecipe','exportSelectedModule','exportStandalone','exportWebComponent','exportCssTokens','exportVisualIntent','exportTargetProfile','exportTargetReport','guideDialog','guideGoal','guideMood','guideEnergy','guideDevice','guideReducedMotion','guidePhotosensitiveSafe','guideHighContrast','guideSummary','btnApplyGuide','performanceDialog','performanceDialogBody','btnExportPerformanceReport','graphDialog','graphDialogBody','btnCopyGraph','repairDialog','repairDialogBody','btnAnalyzeRepair','btnApplyRepair','importReviewDialog','importReviewDialogBody','btnConfirmImport'
    ].forEach((id) => { dom[id] = byId(id); });
    dom.tabLibrary = byId('tabLibrary');
    dom.tabStack = byId('tabStack');
    dom.tabCreator = byId('tabCreator');
  }

  function init() {
    cacheDom();
    registry = new AXM.ModuleRegistry(root.AXM_DEFAULT_CATALOG);
    loadCustomModules();
    adapter = new AXM.WebAdapter(dom.previewStage);
    composer = new AXM.Composer(registry, adapter);
    history = new AXM.HistoryStack(48);
    recipe = loadRecipe();
    selectedInstanceId = recipe.layers[0]?.instanceId || null;
    history.seed(recipe);

    governor = new AXM.PerformanceGovernor({
      bias: recipe.globals.performanceBias || 'balanced',
      onChange({ quality, fps, reason }) {
        if (recipe.globals.quality !== 'auto') return;
        recipe.globals.resolvedQuality = quality;
        dom.fpsStatus.textContent = `${Math.round(fps)} FPS · auto ${quality} · ${reason}`;
        renderPreview();
      }
    });
    if (recipe.globals.quality === 'auto') recipe.globals.resolvedQuality = governor.lastDecision;
    governor.start();
    fpsTimer = setInterval(() => {
      const fps = governor.averageFps;
      if (recipe.globals.quality === 'auto') dom.fpsStatus.textContent = fps ? `${Math.round(fps)} FPS · auto ${recipe.globals.resolvedQuality || governor.lastDecision}` : 'Measuring performance';
      else dom.fpsStatus.textContent = `${recipe.globals.quality} quality locked`;
    }, 1200);

    bindStaticEvents();
    setTab(activeTab);
    setCreatorMode(creatorMode);
    renderWorkspace();
    persistRecipe();
    document.body.dataset.axmStudioReady = 'true';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(typeof globalThis !== 'undefined' ? globalThis : window);
