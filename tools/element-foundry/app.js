(function () {
  "use strict";

  var Protocol = window.AXMElementProtocol;
  var STORAGE_KEY = "axm.element-foundry.v1";
  var SKINS = ["nexus", "aurora", "foundry"];
  var TARGETS = {
    screen: { context: "tool", canvas: "screen-2d", allowed: ["interface", "visual", "interaction", "spatial", "media", "logic", "content"] },
    world: { context: "world-view", canvas: "game-world", allowed: ["visual", "spatial", "media", "logic", "content"] },
    physical: { context: "fabrication", canvas: "physical-object", allowed: ["fabrication", "visual", "spatial"] },
  };
  var DEFAULT_IDS = [
    "axm.element.visual.cosmic-field",
    "axm.element.interface.command-panel",
    "axm.element.interface.metric-cell",
    "axm.element.interface.status-orb",
    "axm.element.spatial.orbit-anchor",
    "axm.element.content.identity-title",
    "axm.element.content.metric-record",
    "axm.element.interaction.primary-action",
  ];
  var state = { filter: "all", target: "screen", skin: 0, instances: [], selected: null, receipt: null, composition: null };
  var categories = null, catalog = null, elements = [], registry = null, categoryById = new Map(), elementById = new Map();

  function $(id) { return document.getElementById(id); }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]; }); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function shortDigest(value) { value = String(value || ""); return value ? value.slice(0, 10) + "…" + value.slice(-7) : "UNSEALED"; }
  function facetsCount(element) { return Object.keys(element && element.facets || {}).length; }
  function currentTarget() { return TARGETS[state.target] || TARGETS.screen; }
  function categoryAccent(id) { var category = categoryById.get(id); return category ? category.accent : "#37e7ff"; }
  function announce(message, level) {
    $("statusText").textContent = message;
    if (window.parent !== window) window.parent.postMessage({ type: "hub:log", moduleId: "element-foundry", level: level || "info", msg: message }, "*");
  }
  function persist() {
    var saved = { filter: state.filter, target: state.target, skin: state.skin, instances: state.instances.map(function (item) { return { instance_id: item.instance_id, element_id: item.element_id }; }), selected: state.selected };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    if (window.parent !== window) window.parent.postMessage({ type: "hub:save", moduleId: "element-foundry", state: saved }, "*");
  }
  function restore() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return false;
      state.filter = saved.filter || "all";
      state.target = TARGETS[saved.target] ? saved.target : "screen";
      state.skin = Math.max(0, Math.min(SKINS.length - 1, Number(saved.skin) || 0));
      state.instances = Array.isArray(saved.instances) ? saved.instances.filter(function (item) { return elementById.has(item.element_id); }).map(function (item, index) { return { instance_id: String(item.instance_id || "element-" + (index + 1)), element_id: item.element_id }; }) : [];
      state.selected = saved.selected || null;
      return true;
    } catch (error) { return false; }
  }
  function sealSeed(seed) {
    var category = categoryById.get(seed.category);
    return Protocol.sealElement(Object.assign({
      version: "1.0.0", dependencies: [], artifact_refs: [],
      provenance: { origin_type: "authored", source_id: "axm-element-core-catalog-v1", source_digest: Protocol.sha256("axm-element-core-catalog-v1"), license_id: "AXM-LOCAL", created_by: "axiom-mir", created_at: "2026-07-23T00:00:00.000Z" },
      resource_profile: { cpu: "light", gpu: "none", peak_memory_bytes: 4096, working_storage_bytes: 4096, native_runtime: null },
      verification: { category_verifier: category.verifier, automatic_checks: ["schema-and-digest", "category-facet-fit"], human_judgments: ["meaning and appearance in intended context"], assurance_ceiling: "contract and deterministic structure; rendered quality requires live review" },
      mutability: "versioned",
    }, seed), categories);
  }
  function nextInstanceId(element) {
    var base = (element.category + "-" + element.kind).replace(/[^a-z0-9.-]/g, "-"), used = new Set(state.instances.map(function (item) { return item.instance_id; })), n = 1, value = base;
    while (used.has(value)) value = base + "-" + (++n);
    return value;
  }
  function addElement(id) {
    var element = elementById.get(id); if (!element) return;
    var instance = { instance_id: nextInstanceId(element), element_id: element.id };
    state.instances.push(instance); state.selected = instance.instance_id; state.receipt = null; state.composition = null;
    persist(); render(); announce(element.title + " added as an exact local element");
  }
  function removeElement(instanceId) {
    state.instances = state.instances.filter(function (item) { return item.instance_id !== instanceId; });
    if (state.selected === instanceId) state.selected = state.instances.length ? state.instances[state.instances.length - 1].instance_id : null;
    state.receipt = null; state.composition = null; persist(); render(); announce("Element removed from the draft; source catalog unchanged");
  }
  function compositionFromState() {
    var target = currentTarget(), refs = state.instances.map(function (instance) {
      var element = elementById.get(instance.element_id);
      return { instance_id: instance.instance_id, element_id: element.id, element_version: element.version, element_digest: element.digest, configuration: {} };
    });
    var placements = state.instances.map(function (instance, index) {
      var element = elementById.get(instance.element_id), region = element.category === "visual" ? "background" : element.category === "interface" ? "primary" : element.category === "content" ? "header" : "secondary";
      return { instance_id: instance.instance_id, region: region, order: index, configuration: {} };
    });
    var first = state.instances.map(function (instance) { return { instance: instance, element: elementById.get(instance.element_id) }; }).find(function (pair) { return pair.element.ports.outputs.length; });
    return Protocol.sealComposition({
      id: "axm.element-composition.local-future-surface",
      title: "Local Future Surface",
      target: { context: target.context, canvas: target.canvas, allowed_categories: clone(target.allowed) },
      elements: refs, placements: placements, bindings: [],
      outputs: first ? [{ id: "primary", instance_id: first.instance.instance_id, port: first.element.ports.outputs[0].id, role: "editable-element-composition" }] : [],
    });
  }
  function checkComposition(seal) {
    if (!state.instances.length) { announce("Add at least one element before checking", "warn"); return null; }
    var composition = compositionFromState(), validation = Protocol.validateComposition(composition, registry);
    state.composition = composition;
    state.receipt = seal ? Protocol.compose(composition, registry, categories) : null;
    var ready = validation.pass;
    $("previewState").textContent = ready ? (seal ? "READY CONTRACT" : "COMPATIBLE / UNSEALED") : "HELD / " + (validation.codes[0] || "INVALID");
    $("previewState").style.color = ready ? "var(--green)" : "var(--red)";
    $("inspectionState").textContent = ready ? "READY" : "HELD";
    $("inspectionState").className = "state " + (ready ? "ready" : "blocked");
    $("exportComposition").disabled = !(seal && state.receipt && state.receipt.status === "READY_CONTRACT");
    if (seal && state.receipt) $("previewDigest").textContent = "RECEIPT " + shortDigest(state.receipt.digest);
    announce(ready ? (seal ? "Contract sealed; execution, installation and visual approval remain false" : "Compatibility PASS; contract is not sealed yet") : "Composition held: " + validation.errors[0], ready ? "info" : "warn");
    renderInspector();
    return { composition: composition, validation: validation, receipt: state.receipt };
  }
  function download() {
    if (!state.receipt || state.receipt.status !== "READY_CONTRACT" || !state.composition) return;
    var payload = { schema: "axm.element-foundry-export/v1", composition: state.composition, receipt: state.receipt, exported_at: new Date().toISOString() };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "axm-element-composition-" + state.receipt.digest.slice(0, 12) + ".json"; link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000); announce("Exact composition and contract-only receipt downloaded");
  }
  function reset() {
    state.instances = DEFAULT_IDS.filter(function (id) { return elementById.has(id); }).map(function (id, index) { return { instance_id: "element-" + (index + 1), element_id: id }; });
    state.target = "screen"; state.filter = "all"; state.selected = state.instances[0] && state.instances[0].instance_id; state.receipt = null; state.composition = null;
    persist(); render(); announce("Element Foundry reset to its deterministic starter composition");
  }
  function renderCategories() {
    var all = [{ id: "all", label: "All families", glyph: "ALL", accent: "#eef8ff" }].concat(categories.categories);
    $("categoryRail").innerHTML = all.map(function (category) {
      return '<button class="category-button" type="button" data-category="' + escapeHtml(category.id) + '" aria-pressed="' + (state.filter === category.id) + '" style="--category-accent:' + escapeHtml(category.accent || "#eef8ff") + '"><b>' + escapeHtml(category.glyph || "ALL") + '</b><span>' + escapeHtml(category.label) + '</span></button>';
    }).join("");
    $("categoryRail").querySelectorAll("button").forEach(function (button) { button.addEventListener("click", function () { state.filter = button.dataset.category; persist(); renderCategories(); renderLibrary(); }); });
  }
  function renderLibrary() {
    var visible = elements.filter(function (element) { return state.filter === "all" || element.category === state.filter; });
    $("catalogCount").textContent = visible.length;
    $("elementLibrary").innerHTML = visible.map(function (element) {
      var category = categoryById.get(element.category);
      return '<button class="element-card" type="button" draggable="true" data-element="' + escapeHtml(element.id) + '" style="--element-accent:' + escapeHtml(category.accent) + '"><small>' + escapeHtml(category.label.toUpperCase()) + ' / ' + escapeHtml(element.kind.toUpperCase()) + '</small><b>' + escapeHtml(element.title) + '</b><p>' + escapeHtml(element.description) + '</p><i>' + escapeHtml(category.glyph) + '</i></button>';
    }).join("");
    $("elementLibrary").querySelectorAll(".element-card").forEach(function (card) {
      card.addEventListener("click", function () { addElement(card.dataset.element); });
      card.addEventListener("dragstart", function (event) { event.dataTransfer.setData("text/axm-element", card.dataset.element); event.dataTransfer.effectAllowed = "copy"; });
    });
  }
  function renderPlaced() {
    var host = $("placedElements");
    if (!state.instances.length) { host.innerHTML = '<div class="empty-stage">DROP OR ADD AN ELEMENT TO BEGIN</div>'; return; }
    host.innerHTML = state.instances.map(function (instance) {
      var element = elementById.get(instance.element_id), category = categoryById.get(element.category);
      return '<div class="placed-chip ' + (state.selected === instance.instance_id ? "selected" : "") + '" role="button" tabindex="0" data-instance="' + escapeHtml(instance.instance_id) + '" style="--chip-accent:' + escapeHtml(category.accent) + '"><small>' + escapeHtml(category.label.toUpperCase()) + '</small><b>' + escapeHtml(element.title) + '</b><button type="button" aria-label="Remove ' + escapeHtml(element.title) + '" data-remove="' + escapeHtml(instance.instance_id) + '">×</button></div>';
    }).join("");
    host.querySelectorAll(".placed-chip").forEach(function (chip) {
      function select() { state.selected = chip.dataset.instance; persist(); renderPlaced(); renderInspector(); }
      chip.addEventListener("click", function (event) { if (!event.target.closest("button")) select(); });
      chip.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } });
    });
    host.querySelectorAll("[data-remove]").forEach(function (button) { button.addEventListener("click", function () { removeElement(button.dataset.remove); }); });
  }
  function renderPreview() {
    document.body.dataset.skin = SKINS[state.skin]; $("targetSelect").value = state.target;
    var chosen = state.instances.map(function (item) { return elementById.get(item.element_id); }).filter(Boolean), categoryCount = new Set(chosen.map(function (item) { return item.category; })).size, facetTotal = chosen.reduce(function (total, item) { return total + facetsCount(item); }, 0);
    $("previewMetrics").innerHTML = '<div class="metric"><small>EXACT ELEMENTS</small><b>' + chosen.length + '</b></div><div class="metric"><small>CATEGORIES</small><b>' + categoryCount + '/8</b></div><div class="metric"><small>FACETS</small><b>' + facetTotal + '</b></div>';
    if (!state.receipt) { $("previewState").textContent = "DRAFT / UNSEALED"; $("previewState").style.color = "var(--gold)"; $("previewDigest").textContent = "NO RECEIPT"; $("exportComposition").disabled = true; }
    else { $("previewState").textContent = state.receipt.status.replace(/_/g, " "); $("previewDigest").textContent = "RECEIPT " + shortDigest(state.receipt.digest); }
    renderPlaced();
  }
  function renderInspector() {
    var instance = state.instances.find(function (item) { return item.instance_id === state.selected; }), element = instance && elementById.get(instance.element_id), host = $("inspectorBody");
    if (!element) { host.innerHTML = '<div class="empty-inspector"><b>SELECT AN ELEMENT</b><p>Its exact identity, facets, ports, target fit and category verifier will appear here.</p></div>'; return; }
    var category = categoryById.get(element.category), target = currentTarget(), targetFit = target.allowed.indexOf(element.category) >= 0 && (element.compatibility.contexts.indexOf("*") >= 0 || element.compatibility.contexts.indexOf(target.context) >= 0) && (element.compatibility.canvases.indexOf("*") >= 0 || element.compatibility.canvases.indexOf(target.canvas) >= 0);
    $("inspectionState").textContent = targetFit ? "READY" : "HELD"; $("inspectionState").className = "state " + (targetFit ? "ready" : "blocked");
    host.innerHTML = '<div class="record-title" style="--record-accent:' + escapeHtml(category.accent) + '"><small>' + escapeHtml(category.label.toUpperCase()) + ' / ' + escapeHtml(element.kind.toUpperCase()) + '</small><h3>' + escapeHtml(element.title) + '</h3><p>' + escapeHtml(element.description) + '</p></div>' +
      '<div class="record-grid"><div><small>INSTANCE</small><b>' + escapeHtml(instance.instance_id) + '</b></div><div><small>VERSION</small><b>' + escapeHtml(element.version) + '</b></div><div><small>TARGET FIT</small><b>' + (targetFit ? "PASS" : "HELD") + '</b></div><div><small>VERIFIER</small><b>' + escapeHtml(element.verification.category_verifier) + '</b></div></div>' +
      '<div class="facet-list">' + Object.keys(element.facets).map(function (facet) { return '<div class="facet" style="--record-accent:' + escapeHtml(category.accent) + '"><b>' + escapeHtml(facet) + '</b><code>' + escapeHtml(JSON.stringify(element.facets[facet])) + '</code></div>'; }).join("") + '</div>' +
      '<p class="digest">ELEMENT ' + escapeHtml(element.id) + '<br>DIGEST ' + escapeHtml(element.digest) + '</p>';
  }
  function render() { renderCategories(); renderLibrary(); renderPreview(); renderInspector(); }
  function bind() {
    $("targetSelect").addEventListener("change", function () { state.target = this.value; state.receipt = null; state.composition = null; persist(); render(); announce("Target changed; compatibility must be checked again"); });
    $("cycleSkin").addEventListener("click", function () { state.skin = (state.skin + 1) % SKINS.length; persist(); renderPreview(); announce("Bounded surface variant: " + SKINS[state.skin]); });
    $("checkComposition").addEventListener("click", function () { checkComposition(false); });
    $("sealComposition").addEventListener("click", function () { checkComposition(true); });
    $("exportComposition").addEventListener("click", download);
    $("resetComposition").addEventListener("click", reset);
    $("preview").addEventListener("dragover", function (event) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
    $("preview").addEventListener("drop", function (event) { event.preventDefault(); addElement(event.dataTransfer.getData("text/axm-element")); });
    setInterval(function () { $("clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }, 1000);
  }
  function boot() {
    if (!Protocol) throw new Error("Element Protocol unavailable");
    Promise.all([
      fetch("../../shared/elements/category-registry.json").then(function (response) { if (!response.ok) throw new Error("category registry unavailable"); return response.json(); }),
      fetch("../../shared/elements/core-element-seeds.json").then(function (response) { if (!response.ok) throw new Error("element catalog unavailable"); return response.json(); }),
    ]).then(function (values) {
      categories = values[0]; catalog = values[1];
      var categoryValidation = Protocol.validateCategoryRegistry(categories); if (!categoryValidation.pass) throw new Error(categoryValidation.errors.join("; "));
      categories.categories.forEach(function (category) { categoryById.set(category.id, category); });
      elements = catalog.seeds.map(sealSeed); registry = Protocol.createRegistry(categories, elements); elements.forEach(function (element) { elementById.set(element.id, element); });
      if (!restore() || !state.instances.length) reset(); else render();
      bind(); announce("Element Protocol ready · " + elements.length + " exact seeds · " + categories.categories.length + " verifier routes declared");
      if (window.parent !== window) window.parent.postMessage({ type: "hub:ready", moduleId: "element-foundry" }, "*");
    }).catch(function (error) { $("statusText").textContent = "BLOCKED · " + error.message; $("statusText").style.color = "var(--red)"; console.error(error); });
  }
  boot();
})();
