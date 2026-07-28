import {
  LocalSkinLibrary,
  PALETTE_HARMONIES,
  PRESKIN_FAMILIES,
  RECOGNIZED_PATTERN_KINDS,
  RECOGNIZED_STYLE_KEYWORDS,
  applyPerformanceProfile,
  applyPreskin,
  assessGameAdapterConformance,
  assessMoldCompatibility,
  blendPreskins,
  chooseDeterministicPreskin,
  compileStyleIntent,
  composeSkinStack,
  createGameContractFromMold,
  createHarmonyPalette,
  downloadSkinPack,
  finalizePackForExport,
  generateStyleIntent,
  gameSurfaceCoverage,
  listGameSurfaceCategories,
  listGameSurfaceSlots,
  listGeneratorMoods,
  listPerformanceProfiles,
  listPreskins,
  listSkinMolds,
  parseStylePhrase,
  rasterFileToAsset,
  readSkinPackFile,
  resolveSkinForGame,
  stableStringify,
  validateSkinPack
} from "../src/index.mjs";

const byId = (id) => document.getElementById(id);
const library = new LocalSkinLibrary();
const surfaceCategories = listGameSurfaceCategories();
const surfaceSlots = listGameSurfaceSlots();
const surfaceById = new Map(surfaceSlots.map((slot) => [slot.id, slot]));
const categoryBySlot = new Map(
  surfaceCategories.flatMap((category) =>
    category.slots.map((slotId) => [slotId, category])
  )
);
const ORGAN_COLORS = Object.freeze({
  all: "#38e8ff",
  world: "#38e8ff",
  objects: "#7c8fff",
  gear: "#c47cff",
  items: "#ffd166",
  characters: "#ff6bb5",
  effects: "#ff7657",
  interface: "#55efa2"
});

const controls = [
  { group: "Core", id: "intensity", label: "Style strength", min: 0, max: 1, step: 0.01, value: 0.82 },
  { group: "Light", id: "glowIntensity", label: "Glow", min: 0, max: 1, step: 0.01, value: 0.78 },
  { group: "Light", id: "glowRadius", label: "Glow radius", min: 0, max: 64, step: 0.1, value: 28 },
  { group: "Light", id: "emissiveStrength", label: "Emissive", min: 0, max: 2, step: 0.01, value: 1.2 },
  { group: "Surface", id: "gloss", label: "Gloss", min: 0, max: 1, step: 0.01, value: 0.66 },
  { group: "Surface", id: "metallic", label: "Metallic", min: 0, max: 1, step: 0.01, value: 0.34 },
  { group: "Surface", id: "roughness", label: "Roughness", min: 0, max: 1, step: 0.01, value: 0.54 },
  { group: "Surface", id: "specular", label: "Specular", min: 0, max: 1, step: 0.01, value: 0.52 },
  { group: "Surface", id: "clearcoat", label: "Clearcoat", min: 0, max: 1, step: 0.01, value: 0.1 },
  { group: "Surface", id: "sheen", label: "Sheen", min: 0, max: 1, step: 0.01, value: 0.18 },
  { group: "Surface", id: "iridescence", label: "Iridescence", min: 0, max: 1, step: 0.01, value: 0.08 },
  { group: "Surface", id: "translucency", label: "Glass", min: 0, max: 0.9, step: 0.01, value: 0 },
  { group: "Texture", id: "grain", label: "Grain", min: 0, max: 1, step: 0.01, value: 0.62 },
  { group: "Texture", id: "weathering", label: "Weathering", min: 0, max: 1, step: 0.01, value: 0 },
  { group: "Texture", id: "outlineWidth", label: "Outline", min: 0, max: 12, step: 0.1, value: 4 },
  { group: "Motion", id: "pulseSpeed", label: "Pulse", min: 0, max: 4, step: 0.01, value: 0.7 },
  { group: "Motion", id: "shimmerSpeed", label: "Shimmer", min: 0, max: 4, step: 0.01, value: 0.35 }
];

const patternControls = [
  { id: "pattern-strength", label: "Pattern strength", min: 0, max: 1, step: 0.01, value: 0.35 },
  { id: "pattern-scale", label: "Pattern scale", min: 0.1, max: 4, step: 0.01, value: 1 }
];

const geometryControls = [
  { id: "corner-roundness", label: "Corner roundness", min: 0, max: 1, step: 0.01, value: 0.62 },
  { id: "silhouette-exaggeration", label: "Silhouette energy", min: 0, max: 1, step: 0.01, value: 0.25 },
  { id: "detail-density", label: "Detail density", min: 0, max: 1, step: 0.01, value: 0.52 }
];

const state = {
  contract: null,
  scope: ["global"],
  pack: null,
  intent: null,
  resolution: null,
  customAsset: null,
  currentDialogTab: "pack",
  motionPaused: false,
  imported: false,
  activePreskinId: "axm-balanced",
  preskinFamily: "All",
  fusionPreskinId: null,
  fusionAmount: 0.5,
  surpriseIndex: 0,
  moldId: "arcade-arena",
  performanceProfile: "balanced",
  selectedSurfaceId: "world.sky",
  surfaceOrgan: "all",
  surfaceSearch: "",
  surfaceOverrides: {},
  surfaceBaselines: {},
  adapterEvidence: {
    previewIsolated: false,
    fallbackObserved: false,
    rollbackObserved: false,
    receiptObserved: false
  },
  conformanceReport: null
};

function buildRange(container, control, prefix = "") {
    const row = document.createElement("div");
    row.className = "range-row";
    const label = document.createElement("label");
    label.htmlFor = `${prefix}${control.id}`;
    label.textContent = control.label;
    const input = document.createElement("input");
    input.id = `${prefix}${control.id}`;
    input.type = "range";
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
    input.value = String(control.value);
    const output = document.createElement("output");
    output.htmlFor = input.id;
    output.textContent = Number(control.value).toFixed(control.step < 0.1 ? 2 : 1);
    input.addEventListener("input", () => {
      output.textContent = Number(input.value).toFixed(control.step < 0.1 ? 2 : 1);
      compileFromControls({ quiet: true });
    });
    row.append(label, input, output);
    container.append(row);
}

function buildPreskinControls() {
  const filters = byId("preskin-family-filters");
  for (const family of ["All", ...PRESKIN_FAMILIES]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preskin-filter";
    button.dataset.family = family;
    button.textContent = family.replace("AXM Identity", "AXM");
    button.classList.toggle("active", family === state.preskinFamily);
    filters.append(button);
  }

  const fusion = byId("fusion-preskin");
  for (const preset of listPreskins()) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = `${preset.family} · ${preset.name}`;
    fusion.append(option);
  }
  renderPreskinGallery();
}

function fillPreskinSelect(id, selectedId) {
  const select = byId(id);
  for (const preset of listPreskins()) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = `${preset.family} · ${preset.name}`;
    option.selected = preset.id === selectedId;
    select.append(option);
  }
}

function buildMoldControls() {
  const moldSelect = byId("mold-select");
  for (const mold of listSkinMolds()) {
    const option = document.createElement("option");
    option.value = mold.id;
    option.textContent = mold.name;
    option.title = mold.purpose;
    option.selected = mold.id === state.moldId;
    moldSelect.append(option);
  }
  for (const mood of listGeneratorMoods()) {
    const option = document.createElement("option");
    option.value = mood;
    option.textContent = mood[0].toUpperCase() + mood.slice(1);
    byId("generator-mood").append(option);
  }
  for (const profile of listPerformanceProfiles()) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    option.selected = profile.id === state.performanceProfile;
    byId("performance-profile").append(option);
  }
  fillPreskinSelect("stack-world", "world-cosmic-deep");
  fillPreskinSelect("stack-objects", "world-ember-foundry");
  fillPreskinSelect("stack-gear", "arcade-chrome-royale");
  fillPreskinSelect("stack-items", "arcade-neon-circuit");
  fillPreskinSelect("stack-character", "character-comic-vanguard");
  fillPreskinSelect("stack-ui", "axm-balanced");
  fillPreskinSelect("stack-fx", "arcade-neon-circuit");
}

function humanizeSurfaceId(id) {
  const title = String(id)
    .split(".")
    .map((part) => part.replaceAll("-", " "))
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return title.replace(/\b(?:Ui|Hud|Npc|Fx|Rpg)\b/g, (word) => word.toUpperCase());
}

function buildSurfaceControls() {
  const filters = byId("surface-organ-filters");
  for (const category of [
    { id: "all", name: "All 33" },
    ...surfaceCategories
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "organ-filter";
    button.dataset.organ = category.id;
    button.textContent = category.name;
    button.style.setProperty("--organ-color", ORGAN_COLORS[category.id] ?? "#38e8ff");
    button.classList.toggle("active", category.id === state.surfaceOrgan);
    filters.append(button);
  }

  const assetTarget = byId("asset-target");
  for (const category of surfaceCategories) {
    const group = document.createElement("optgroup");
    group.label = category.name;
    for (const slotId of category.slots) {
      const option = document.createElement("option");
      option.value = slotId;
      option.textContent = humanizeSurfaceId(slotId);
      option.selected = slotId === "world.background";
      group.append(option);
    }
    assetTarget.append(group);
  }
}

function renderPreskinGallery() {
  const gallery = byId("preskin-gallery");
  const presets = listPreskins(state.preskinFamily === "All" ? null : state.preskinFamily);
  gallery.replaceChildren();
  for (const preset of presets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preskin-card";
    button.dataset.preskinId = preset.id;
    button.classList.toggle("active", preset.id === state.activePreskinId);
    button.setAttribute("aria-pressed", String(preset.id === state.activePreskinId));
    button.title = preset.tagline;
    const colors = document.createElement("span");
    colors.className = "preskin-swatches";
    preset.swatches.forEach((color) => {
      const swatch = document.createElement("i");
      swatch.style.background = color;
      colors.append(swatch);
    });
    const name = document.createElement("strong");
    name.textContent = preset.name;
    const family = document.createElement("small");
    family.textContent = preset.family;
    button.append(colors, name, family);
    gallery.append(button);
  }
  const catalog = listPreskins();
  const primaryName = catalog.find((preset) => preset.id === state.activePreskinId)?.name;
  const secondaryName = catalog.find((preset) => preset.id === state.fusionPreskinId)?.name;
  byId("active-preskin-name").textContent = primaryName
    ? secondaryName
      ? `${primaryName} × ${secondaryName}`
      : primaryName
    : "Custom recipe";
}

function buildControls() {
  const chips = byId("keyword-chips");
  for (const keyword of RECOGNIZED_STYLE_KEYWORDS) {
    const label = document.createElement("label");
    label.className = "chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = keyword;
    input.checked = ["dark", "neon", "paper", "luxury"].includes(keyword);
    const text = document.createElement("span");
    text.textContent = keyword.replaceAll("-", " ");
    label.append(input, text);
    chips.append(label);
  }

  const materialControls = byId("material-controls");
  let currentGroup = null;
  let groupContainer = null;
  for (const control of controls) {
    if (control.group !== currentGroup) {
      currentGroup = control.group;
      groupContainer = document.createElement("section");
      groupContainer.className = "range-group";
      const heading = document.createElement("h4");
      heading.textContent = currentGroup;
      groupContainer.append(heading);
      materialControls.append(groupContainer);
    }
    buildRange(groupContainer, control, "material-");
  }

  const patternSelect = byId("pattern-kind");
  for (const kind of RECOGNIZED_PATTERN_KINDS) {
    const option = document.createElement("option");
    option.value = kind;
    option.textContent = kind.replaceAll("-", " ");
    patternSelect.append(option);
  }
  for (const control of patternControls) buildRange(byId("pattern-controls"), control);
  for (const control of geometryControls) buildRange(byId("geometry-controls"), control);
  buildPreskinControls();
  buildMoldControls();
  buildSurfaceControls();
}

function selectedKeywords() {
  return [...document.querySelectorAll("#keyword-chips input:checked")].map((input) => input.value);
}

function materialValue(id) {
  return Number(byId(`material-${id}`).value);
}

function rangeValue(id) {
  return Number(byId(id).value);
}

function collectIntent() {
  const material = Object.fromEntries(
    controls
      .filter((control) => control.id !== "intensity")
      .map((control) => [control.id, materialValue(control.id)])
  );
  return {
    type: "axm.style-intent",
    version: "1.0",
    name: byId("style-name").value.trim() || "Untitled AXM Style",
    seed: byId("style-seed").value.trim() || "axm-style-seed",
    scope: state.scope,
    keywords: selectedKeywords(),
    intensity: materialValue("intensity"),
    palette: {
      primary: byId("color-primary").value,
      secondary: byId("color-secondary").value,
      accent: byId("color-accent").value
    },
    material,
    pattern: {
      kind: byId("pattern-kind").value,
      strength: rangeValue("pattern-strength"),
      scale: rangeValue("pattern-scale")
    },
    geometry: {
      cornerRoundness: rangeValue("corner-roundness"),
      silhouetteExaggeration: rangeValue("silhouette-exaggeration"),
      detailDensity: rangeValue("detail-density")
    },
    character: {
      silhouette: byId("character-silhouette").value,
      headShape: byId("character-head").value,
      outfit: byId("character-outfit").value,
      accessory: byId("character-accessory").value,
      proportion: Number(byId("character-proportion").value)
    },
    accessibility: {
      highContrast: byId("high-contrast").checked,
      reducedMotion: byId("reduced-motion").checked,
      minimumTextContrast: 4.5
    },
    sharing: {
      license: "LicenseRef-All-Rights-Reserved",
      remixAllowed: byId("remix-allowed").checked,
      attribution: "Mike - Axiom/mir"
    },
    preset: state.activePreskinId
      ? {
          catalog: "axm.preskins.v1",
          primary: state.activePreskinId,
          secondary: state.fusionPreskinId,
          blend: state.fusionPreskinId ? state.fusionAmount : 0
        }
      : null
  };
}

function attachCustomAsset(pack) {
  if (!state.customAsset) return pack;
  const next = structuredClone(pack);
  next.assets[state.customAsset.id] = state.customAsset.asset;
  if (!next.capabilities.includes("raster-asset.v1")) next.capabilities.push("raster-asset.v1");
  const target = byId("asset-target").value;
  const binding = next.bindings.find((entry) => entry.target === target);
  if (binding) binding.asset = state.customAsset.id;
  else {
    next.bindings.push({
      target,
      material: "world.accent",
      asset: state.customAsset.id,
      optional: true
    });
  }
  next.provenance.sourceAssetHashes = [
    ...new Set([...(next.provenance.sourceAssetHashes ?? []), state.customAsset.asset.sha256])
  ];
  return next;
}

function surfaceMaterialEntry(pack, slotId) {
  const binding = pack?.bindings?.find((entry) => entry.target === slotId);
  const material = binding?.material ? pack?.materials?.[binding.material] : null;
  return {
    binding: binding ?? null,
    material: material ?? null,
    materialId: binding?.material ?? null
  };
}

function captureSurfaceBaselines(pack) {
  state.surfaceBaselines = Object.fromEntries(
    surfaceSlots.flatMap((slot) => {
      const material = surfaceMaterialEntry(pack, slot.id).material;
      return material ? [[slot.id, structuredClone(material)]] : [];
    })
  );
}

function applySurfaceOverrides(pack) {
  const entries = Object.entries(state.surfaceOverrides);
  if (!entries.length) return pack;
  const next = structuredClone(pack);
  for (const [slotId, override] of entries) {
    const { materialId } = surfaceMaterialEntry(next, slotId);
    if (!materialId || !next.materials?.[materialId]) continue;
    next.materials[materialId] = {
      ...next.materials[materialId],
      ...structuredClone(override)
    };
  }
  next.integrity = null;
  next.provenance = {
    ...(next.provenance ?? {}),
    surfaceOverrides: Object.fromEntries(
      entries
        .map(([slotId, override]) => [slotId, Object.keys(override).sort()])
        .sort(([a], [b]) => a.localeCompare(b))
    )
  };
  return next;
}

function acceptFreshPack(pack, { clearOverrides = false } = {}) {
  if (clearOverrides) state.surfaceOverrides = {};
  captureSurfaceBaselines(pack);
  state.pack = applySurfaceOverrides(pack);
}

function resetAdapterEvidence() {
  state.adapterEvidence = {
    previewIsolated: false,
    fallbackObserved: false,
    rollbackObserved: false,
    receiptObserved: false
  };
  for (const id of ["proof-preview", "proof-fallback", "proof-rollback", "proof-receipt"]) {
    byId(id).checked = false;
  }
}

async function compileFromControls({ quiet = false } = {}) {
  state.intent = collectIntent();
  acceptFreshPack(attachCustomAsset(compileStyleIntent(state.intent)));
  state.imported = false;
  await renderPack();
  if (!quiet) toast("Deterministic draft rebuilt from the visible recipe.");
}

async function applySelectedPreskin({ quiet = false } = {}) {
  if (!state.activePreskinId) return;
  const base = collectIntent();
  const intent = state.fusionPreskinId
    ? blendPreskins(base, state.activePreskinId, state.fusionPreskinId, state.fusionAmount)
    : applyPreskin(base, state.activePreskinId);
  state.intent = intent;
  applyIntentToControls(intent);
  byId("style-phrase").value = intent.keywords.join(" ");
  acceptFreshPack(attachCustomAsset(compileStyleIntent(intent)));
  state.imported = false;
  await renderPack();
  if (!quiet) {
    toast(
      state.fusionPreskinId
        ? "Two preskins fused into one deterministic editable recipe."
        : "Preskin loaded as a fully editable recipe."
    );
  }
}

function setStyleVariable(name, value) {
  byId("specimen").style.setProperty(name, String(value));
}

function updatePreviewVariables(resolution) {
  const tokens = resolution.resolved.tokens?.color ?? {};
  const world = resolution.resolved.slots["world.background"]?.material ?? null;
  const player = resolution.resolved.slots["character.player.body"]?.material ?? null;
  const enemy = resolution.resolved.slots["character.enemy.body"]?.material ?? null;
  const fx = resolution.resolved.slots["fx.primary"]?.material ?? null;
  const ui = resolution.resolved.slots["ui.panel"]?.material ?? null;
  const playerBlueprint = resolution.resolved.slots["character.player.body"]?.blueprint ?? null;
  const geometry = resolution.resolved.tokens?.geometry ?? {};
  const motion = fx ? (resolution.resolved.tokens?.motion ?? {}) : {};
  const motionIsZero =
    Number(motion.pulseSpeed ?? 0) === 0 &&
    Number(motion.shimmerSpeed ?? 0) === 0;
  const worldPattern = world?.pattern ?? {};
  const characterPattern = player?.pattern ?? {};
  const globalMaterial = world ?? fx ?? ui;
  const original = {
    background: "#0b0f18",
    surface: "#1a2130",
    primary: "#4e79ff",
    secondary: "#31b39f",
    accent: "#ffb454",
    danger: "#e85d67",
    text: "#f5f7ff"
  };

  const values = {
    "--preview-bg": world?.secondaryColor ?? (world ? tokens.background : original.background),
    "--preview-surface": world?.baseColor ?? (world ? tokens.surface : original.surface),
    "--preview-primary": world ? (tokens.primary ?? original.primary) : original.primary,
    "--preview-secondary": world ? (tokens.secondary ?? original.secondary) : original.secondary,
    "--preview-accent": fx?.baseColor ?? original.accent,
    "--preview-danger": enemy?.baseColor ?? original.danger,
    "--preview-text": world || ui ? tokens.text : original.text,
    "--preview-glow": globalMaterial?.glowIntensity ?? 0.12,
    "--preview-glow-radius": globalMaterial?.glowRadius ?? 8,
    "--preview-metallic": globalMaterial?.metallic ?? 0.08,
    "--preview-roughness": globalMaterial?.roughness ?? 0.7,
    "--preview-gloss": globalMaterial?.gloss ?? 0.2,
    "--preview-specular": globalMaterial?.specular ?? 0.3,
    "--preview-clearcoat": globalMaterial?.clearcoat ?? 0,
    "--preview-sheen": globalMaterial?.sheen ?? 0,
    "--preview-iridescence": globalMaterial?.iridescence ?? 0,
    "--preview-translucency": globalMaterial?.translucency ?? 0,
    "--preview-emissive": globalMaterial?.emissiveStrength ?? 0.3,
    "--preview-grain": world?.grain ?? 0,
    "--preview-weathering": world?.weathering ?? 0,
    "--preview-outline": globalMaterial?.outlineWidth ?? 1,
    "--preview-player-primary": player?.baseColor ?? original.primary,
    "--preview-player-secondary": player?.secondaryColor ?? original.secondary,
    "--preview-player-accent": player?.accentColor ?? player?.emissiveColor ?? original.accent,
    "--preview-player-glow": player?.glowIntensity ?? 0.12,
    "--preview-player-glow-radius": player?.glowRadius ?? 8,
    "--preview-player-metallic": player?.metallic ?? 0.08,
    "--preview-player-roughness": player?.roughness ?? 0.7,
    "--preview-player-gloss": player?.gloss ?? 0.2,
    "--preview-player-clearcoat": player?.clearcoat ?? 0,
    "--preview-player-iridescence": player?.iridescence ?? 0,
    "--preview-player-outline": player?.outlineWidth ?? 1,
    "--preview-enemy-glow": enemy?.glowIntensity ?? 0.12,
    "--preview-enemy-glow-radius": enemy?.glowRadius ?? 8,
    "--preview-enemy-metallic": enemy?.metallic ?? 0.08,
    "--preview-enemy-roughness": enemy?.roughness ?? 0.7,
    "--preview-enemy-gloss": enemy?.gloss ?? 0.2,
    "--preview-enemy-clearcoat": enemy?.clearcoat ?? 0,
    "--preview-enemy-iridescence": enemy?.iridescence ?? 0,
    "--preview-enemy-outline": enemy?.outlineWidth ?? 1,
    "--preview-pattern-strength": worldPattern.strength ?? 0,
    "--preview-pattern-scale": worldPattern.scale ?? world?.patternScale ?? 1,
    "--preview-character-pattern-strength": characterPattern.strength ?? 0,
    "--preview-roundness": geometry.cornerRoundness ?? 0.5,
    "--preview-detail": geometry.detailDensity ?? 0.5,
    "--preview-pulse-duration": `${motion.pulseSpeed > 0 ? Math.max(0.7, 3.6 / motion.pulseSpeed) : 2.7}s`,
    "--preview-shimmer-duration": `${motion.shimmerSpeed > 0 ? Math.max(0.8, 5 / motion.shimmerSpeed) : 7}s`,
    "--motion-state":
      state.motionPaused ||
      motionIsZero ||
      resolution.resolved.accessibility?.reducedMotionSafe
        ? "paused"
        : "running"
  };
  for (const [name, value] of Object.entries(values)) setStyleVariable(name, value);
  const specimen = byId("specimen");
  specimen.dataset.silhouette = playerBlueprint?.silhouette ?? "balanced";
  specimen.dataset.head = playerBlueprint?.headShape ?? "round";
  specimen.dataset.outfit = playerBlueprint?.outfit ?? "modular";
  specimen.dataset.accessory = playerBlueprint?.accessory ?? "none";
  specimen.dataset.pattern = worldPattern.kind ?? "none";
  specimen.dataset.characterPattern = characterPattern.kind ?? "none";
  setStyleVariable(
    "--player-proportion",
    playerBlueprint ? 0.86 + Number(playerBlueprint.proportion ?? 0.5) * 0.28 : 1
  );

  const assetBinding = state.pack.bindings.find((binding) => binding.asset);
  const asset = assetBinding ? state.pack.assets[assetBinding.asset] : null;
  const texturePreview = byId("texture-preview");
  if (asset?.source?.kind === "embedded-data") {
    setStyleVariable("--custom-texture", `url("${asset.source.data}")`);
    texturePreview.hidden = false;
  } else {
    setStyleVariable("--custom-texture", "none");
    texturePreview.hidden = true;
  }
}

function renderReceipt() {
  const receipt = state.resolution?.receipt;
  const list = byId("receipt-summary").querySelectorAll("dd");
  const values = receipt
    ? [
        receipt.summary.applied,
        receipt.summary.inherited,
        receipt.summary.protected,
        receipt.summary.unsupported
      ]
    : ["—", "—", "—", "—"];
  list.forEach((element, index) => {
    element.textContent = String(values[index]);
  });
  byId("compatibility-label").textContent = receipt
    ? `${state.resolution.compatibility} SUPPORT · ${receipt.summary.applied}/${state.contract.slots.length} SLOTS`
    : "INCOMPATIBLE";
}

function renderValidation(validation) {
  const card = document.querySelector(".truth-card");
  card.classList.toggle("invalid", !validation.ok);
  byId("validation-icon").textContent = validation.ok ? "✓" : "!";
  byId("validation-title").textContent = validation.ok
    ? "STRUCTURE VALIDATED"
    : `${validation.errors.length} ISSUE${validation.errors.length === 1 ? "" : "S"}`;
  byId("validation-detail").textContent = validation.ok
    ? `${validation.warnings.length} warning(s). Presentation-only keys and declared assets checked.`
    : validation.errors[0]?.message ?? "Draft rejected.";
}

function declaredSurfaceRoles() {
  return new Set(
    (state.contract?.slots ?? []).map(
      (slot) => slot.adapterHints?.semanticRole ?? slot.id
    )
  );
}

function surfaceState(slotId) {
  const packBound = Boolean(surfaceMaterialEntry(state.pack, slotId).material);
  const gameDeclared = declaredSurfaceRoles().has(slotId);
  return packBound && gameDeclared
    ? "connected"
    : packBound
      ? "pack-ready"
      : "missing";
}

function surfaceDisplayMaterial(slotId) {
  const authored = surfaceMaterialEntry(state.pack, slotId).material;
  const fallback = surfaceById.get(slotId)?.fallback ?? {};
  return {
    baseColor: authored?.baseColor ?? fallback.baseColor ?? "#282f45",
    secondaryColor:
      authored?.secondaryColor ?? fallback.secondaryColor ?? authored?.baseColor ?? "#11131d",
    accentColor:
      authored?.accentColor ?? authored?.emissiveColor ?? fallback.accentColor ?? "#38e8ff",
    glowIntensity: Number(authored?.glowIntensity ?? 0),
    metallic: Number(authored?.metallic ?? 0),
    roughness: Number(authored?.roughness ?? fallback.roughness ?? 0.5),
    gloss: Number(authored?.gloss ?? fallback.gloss ?? 0.25),
    opacity: Number(authored?.opacity ?? fallback.opacity ?? 1)
  };
}

function setSurfaceSampleVariables(element, material) {
  element.style.setProperty("--surface-base", material.baseColor);
  element.style.setProperty("--surface-secondary", material.secondaryColor);
  element.style.setProperty("--surface-accent", material.accentColor);
  element.style.setProperty("--surface-glow", String(material.glowIntensity));
  element.style.setProperty("--surface-metallic", String(material.metallic));
  element.style.setProperty("--surface-roughness", String(material.roughness));
  element.style.setProperty("--surface-gloss", String(material.gloss));
  element.style.setProperty("--surface-opacity", String(material.opacity));
}

function renderSurfaceInspector() {
  const slot = surfaceById.get(state.selectedSurfaceId) ?? surfaceSlots[0];
  if (!slot) return;
  state.selectedSurfaceId = slot.id;
  const category = categoryBySlot.get(slot.id);
  const material = surfaceMaterialEntry(state.pack, slot.id).material;
  const display = surfaceDisplayMaterial(slot.id);
  const connection = surfaceState(slot.id);
  const supported = new Set(slot.supportedProperties ?? []);

  byId("surface-category").textContent = category?.name ?? "Game surface";
  byId("surface-name").textContent = humanizeSurfaceId(slot.id);
  byId("surface-id").textContent = slot.id;
  byId("surface-status").textContent =
    connection === "connected"
      ? "CONNECTED"
      : connection === "pack-ready"
        ? "PACK READY"
        : "NOT AUTHORED";
  byId("surface-status").dataset.state = connection;
  byId("surface-explanation").textContent =
    connection === "connected"
      ? "This surface is authored by the pack and declared by the active game mold."
      : connection === "pack-ready"
        ? "The pack carries this surface, but the active game mold does not declare it. The game keeps its own fallback."
        : "The current scoped pack does not author this surface. The game-owned fallback remains visible.";

  const colorControls = [
    ["surface-base-color", "baseColor", display.baseColor],
    ["surface-secondary-color", "secondaryColor", display.secondaryColor],
    ["surface-accent-color", "accentColor", display.accentColor]
  ];
  for (const [id, property, value] of colorControls) {
    const input = byId(id);
    input.value = value;
    input.disabled = !material || !supported.has(property);
  }
  const rangeControls = [
    ["surface-glow", "glowIntensity", display.glowIntensity],
    ["surface-metallic", "metallic", display.metallic],
    ["surface-roughness", "roughness", display.roughness],
    ["surface-gloss", "gloss", display.gloss],
    ["surface-opacity", "opacity", display.opacity]
  ];
  for (const [id, property, value] of rangeControls) {
    const input = byId(id);
    input.value = String(value);
    input.disabled = !material || !supported.has(property);
    input.nextElementSibling.textContent = Number(value).toFixed(2);
  }

  byId("surface-kind").textContent = slot.kind;
  byId("surface-adoption").textContent =
    `Level ${slot.adapterHints?.adoptionLevel ?? 0}`;
  byId("surface-cues").textContent =
    slot.protectedCues?.length ? slot.protectedCues.join(", ") : "None";
  byId("surface-property-count").textContent =
    `${slot.supportedProperties?.length ?? 0} supported`;
  byId("reset-surface").disabled = !state.surfaceOverrides[slot.id];
}

function renderSurfaceChamber() {
  const coverage = gameSurfaceCoverage(state.pack, state.contract);
  const authored = surfaceSlots.filter(
    (slot) => surfaceMaterialEntry(state.pack, slot.id).material
  ).length;
  byId("chamber-authored").textContent = `${authored}/33`;
  byId("chamber-connected").textContent = `${coverage.summary.connected}/33`;
  byId("chamber-fallback").textContent = String(33 - coverage.summary.connected);

  const query = state.surfaceSearch.trim().toLowerCase();
  const visible = surfaceSlots.filter((slot) => {
    const category = categoryBySlot.get(slot.id);
    const organMatch =
      state.surfaceOrgan === "all" || category?.id === state.surfaceOrgan;
    const searchMatch =
      !query ||
      slot.id.toLowerCase().includes(query) ||
      humanizeSurfaceId(slot.id).toLowerCase().includes(query) ||
      category?.name.toLowerCase().includes(query);
    return organMatch && searchMatch;
  });

  const grid = byId("surface-grid");
  grid.replaceChildren();
  for (const slot of visible) {
    const category = categoryBySlot.get(slot.id);
    const material = surfaceDisplayMaterial(slot.id);
    const connection = surfaceState(slot.id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "surface-card";
    card.dataset.surfaceId = slot.id;
    card.dataset.state = connection;
    card.classList.toggle("active", slot.id === state.selectedSurfaceId);
    card.setAttribute("aria-pressed", String(slot.id === state.selectedSurfaceId));
    card.style.setProperty(
      "--surface-accent",
      material.accentColor ?? ORGAN_COLORS[category?.id] ?? "#38e8ff"
    );
    setSurfaceSampleVariables(card, material);

    const top = document.createElement("span");
    top.className = "surface-card-top";
    const kind = document.createElement("span");
    kind.className = "surface-card-kind";
    kind.textContent = category?.name ?? slot.kind;
    const status = document.createElement("span");
    status.className = "surface-card-state";
    status.textContent =
      connection === "connected"
        ? "Connected"
        : connection === "pack-ready"
          ? "Fallback"
          : "Missing";
    top.append(kind, status);

    const sample = document.createElement("span");
    sample.className = "surface-sample";
    sample.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "surface-card-copy";
    const names = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = humanizeSurfaceId(slot.id);
    const id = document.createElement("code");
    id.textContent = slot.id;
    names.append(name, id);
    const count = document.createElement("span");
    count.className = "surface-card-count";
    count.textContent = String(slot.supportedProperties?.length ?? 0);
    count.title = "Supported material properties";
    copy.append(names, count);
    card.append(top, sample, copy);
    grid.append(card);
  }
  byId("surface-empty").hidden = visible.length > 0;
  renderSurfaceInspector();
}

function renderConformance() {
  const report = assessGameAdapterConformance({
    gameContract: state.contract,
    adapterEvidence: state.adapterEvidence
  });
  state.conformanceReport = report;
  byId("conformance-readiness").textContent =
    report.readiness === "READY_FOR_ADOPTION_REVIEW"
      ? "READY FOR ADOPTION REVIEW"
      : report.readiness === "CONTRACT_READY_RUNTIME_PENDING"
        ? "CONTRACT READY · RUNTIME PENDING"
        : "NOT READY";
  byId("conformance-score").textContent =
    `${report.summary.passed}/${report.summary.total}`;
  byId("conformance-readiness").closest(".conformance-result").dataset.state =
    report.readiness;

  const container = byId("conformance-checks");
  container.replaceChildren();
  for (const check of report.checks) {
    const card = document.createElement("div");
    card.className = "conformance-check";
    card.dataset.state = check.state;
    card.title = check.detail
      ? typeof check.detail === "string"
        ? check.detail
        : stableStringify(check.detail)
      : check.message;
    const stateLabel = document.createElement("span");
    stateLabel.textContent = `${check.state} · ${check.stage}`;
    const name = document.createElement("strong");
    name.textContent = check.name;
    card.append(stateLabel, name);
    container.append(card);
  }
}

async function renderPack() {
  if (!state.pack || !state.contract) return;
  const validation = validateSkinPack(state.pack);
  renderValidation(validation);

  const resolution = await resolveSkinForGame({
    packs: [state.pack],
    gameContract: state.contract
  });
  state.resolution = resolution.ok ? resolution : null;
  if (resolution.ok) updatePreviewVariables(resolution);
  const moldReport = assessMoldCompatibility(state.pack, state.contract, state.moldId);
  const surfaceReport = gameSurfaceCoverage(state.pack);
  byId("mold-report").textContent =
    `${moldReport.compatibility} · ${moldReport.summary.connected}/${moldReport.summary.total} semantic slots connected · ` +
    `${surfaceReport.summary.connected}/${surfaceReport.summary.total} full-fabric surfaces authored · ` +
    `${moldReport.rows.reduce((total, row) => total + row.protectedCues.length, 0)} protected cue declarations retained.`;
  renderReceipt();

  byId("preview-name").textContent = state.pack.metadata.name;
  byId("preview-seed").textContent =
    `SEED · ${String(state.pack.provenance?.seed ?? "IMPORTED").toUpperCase()}`;
  byId("pack-id").textContent = state.pack.id;
  byId("capability-count").textContent = String(state.pack.capabilities?.length ?? 0);
  byId("asset-count").textContent = String(Object.keys(state.pack.assets ?? {}).length);
  byId("recipe-info").textContent = state.pack.provenance?.compiler ?? "shared imported pack";
  renderSurfaceChamber();
  renderConformance();
  renderDialog();
}

function applyIntentToControls(intent) {
  if (!intent) {
    state.activePreskinId = null;
    state.fusionPreskinId = null;
    byId("fusion-preskin").value = "";
    byId("fusion-amount").disabled = true;
    renderPreskinGallery();
    return;
  }
  byId("style-name").value = intent.name ?? state.pack?.metadata?.name ?? "Imported Style";
  byId("style-seed").value = intent.seed ?? "imported-pack";
  for (const input of document.querySelectorAll("#keyword-chips input")) {
    input.checked = intent.keywords?.includes(input.value) ?? false;
  }
  for (const key of ["primary", "secondary", "accent"]) {
    if (intent.palette?.[key]) byId(`color-${key}`).value = intent.palette[key];
  }
  byId("high-contrast").checked = Boolean(intent.accessibility?.highContrast);
  byId("reduced-motion").checked = Boolean(intent.accessibility?.reducedMotion);
  byId("remix-allowed").checked = Boolean(intent.sharing?.remixAllowed);
  if (intent.character) {
    byId("character-silhouette").value = intent.character.silhouette ?? "balanced";
    byId("character-head").value = intent.character.headShape ?? "round";
    byId("character-outfit").value = intent.character.outfit ?? "modular";
    byId("character-accessory").value = intent.character.accessory ?? "none";
    const proportion = Number(intent.character.proportion ?? 0.5);
    byId("character-proportion").value = String(proportion);
    byId("character-proportion").nextElementSibling.textContent = proportion.toFixed(2);
  }
  const values = { intensity: intent.intensity, ...(intent.material ?? {}) };
  for (const control of controls) {
    if (!Number.isFinite(values[control.id])) continue;
    const input = byId(`material-${control.id}`);
    input.value = String(values[control.id]);
    input.nextElementSibling.textContent = Number(values[control.id]).toFixed(
      control.step < 0.1 ? 2 : 1
    );
  }
  if (intent.pattern) {
    if (RECOGNIZED_PATTERN_KINDS.includes(intent.pattern.kind)) {
      byId("pattern-kind").value = intent.pattern.kind;
    }
    for (const [id, value] of [
      ["pattern-strength", intent.pattern.strength],
      ["pattern-scale", intent.pattern.scale]
    ]) {
      if (!Number.isFinite(value)) continue;
      const input = byId(id);
      input.value = String(value);
      input.nextElementSibling.textContent = Number(value).toFixed(2);
    }
  }
  if (intent.geometry) {
    for (const [id, value] of [
      ["corner-roundness", intent.geometry.cornerRoundness],
      ["silhouette-exaggeration", intent.geometry.silhouetteExaggeration],
      ["detail-density", intent.geometry.detailDensity]
    ]) {
      if (!Number.isFinite(value)) continue;
      const input = byId(id);
      input.value = String(value);
      input.nextElementSibling.textContent = Number(value).toFixed(2);
    }
  }

  const preset = intent.preset;
  state.activePreskinId = preset?.primary || null;
  state.fusionPreskinId = preset?.secondary || null;
  state.fusionAmount = state.fusionPreskinId ? Number(preset?.blend ?? 0.5) : 0.5;
  byId("fusion-preskin").value = state.fusionPreskinId ?? "";
  byId("fusion-amount").disabled = !state.fusionPreskinId;
  byId("fusion-amount").value = String(state.fusionAmount);
  byId("fusion-amount").nextElementSibling.textContent = `${Math.round(state.fusionAmount * 100)}%`;
  renderPreskinGallery();
}

function renderDialog() {
  const value =
    state.currentDialogTab === "surface"
      ? {
          slot: surfaceById.get(state.selectedSurfaceId) ?? null,
          binding: surfaceMaterialEntry(state.pack, state.selectedSurfaceId).binding,
          material: surfaceMaterialEntry(state.pack, state.selectedSurfaceId).material,
          connection: surfaceState(state.selectedSurfaceId),
          override: state.surfaceOverrides[state.selectedSurfaceId] ?? null,
          automaticWrites: 0
        }
      : state.currentDialogTab === "receipt"
      ? state.resolution?.receipt
      : state.currentDialogTab === "conformance"
        ? state.conformanceReport
      : state.currentDialogTab === "intent"
        ? state.intent ?? state.pack?.provenance?.sourceIntent
        : state.pack;
  byId("data-output").textContent = value ? stableStringify(value, 2) : "No output available.";
}

function toast(message) {
  const element = byId("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2600);
}

async function refreshLibrary() {
  const container = byId("library-list");
  let entries;
  try {
    entries = await library.list();
  } catch {
    container.replaceChildren();
    const unavailable = document.createElement("p");
    unavailable.className = "empty";
    unavailable.textContent = "Local browser storage is unavailable in this context.";
    container.append(unavailable);
    return;
  }
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Nothing saved yet. Your local library never uploads itself.";
    container.append(empty);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "library-entry";
    const dot = document.createElement("i");
    dot.style.setProperty("--entry-color", entry.pack.tokens?.color?.primary ?? "#38e8ff");
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = entry.pack.metadata?.name ?? entry.pack.id;
    const meta = document.createElement("small");
    meta.textContent = `${entry.pack.release} · ${entry.pack.integrity.contentSha256.slice(0, 8)}`;
    copy.append(name, meta);
    const load = document.createElement("button");
    load.type = "button";
    load.textContent = "LOAD";
    load.addEventListener("click", async () => {
      acceptFreshPack(structuredClone(entry.pack), { clearOverrides: true });
      state.intent = entry.pack.provenance?.sourceIntent ?? null;
      state.imported = true;
      applyIntentToControls(state.intent);
      await renderPack();
      toast(`Loaded ${entry.pack.metadata?.name ?? entry.pack.id}.`);
    });
    row.append(dot, copy, load);
    container.append(row);
  }
}

function openDialogTab(tabName) {
  state.currentDialogTab = tabName;
  document.querySelectorAll("[data-dialog-tab]").forEach((entry) => {
    entry.classList.toggle("active", entry.dataset.dialogTab === tabName);
  });
  renderDialog();
  byId("data-dialog").showModal();
}

async function updateSelectedSurfaceProperty(property, value) {
  const slotId = state.selectedSurfaceId;
  const { material } = surfaceMaterialEntry(state.pack, slotId);
  const slot = surfaceById.get(slotId);
  if (!material || !slot?.supportedProperties?.includes(property)) return;
  state.surfaceOverrides[slotId] = {
    ...(state.surfaceOverrides[slotId] ?? {}),
    [property]: value
  };
  state.pack = applySurfaceOverrides(state.pack);
  state.imported = false;
  await renderPack();
}

async function resetSelectedSurface() {
  const slotId = state.selectedSurfaceId;
  const baseline = state.surfaceBaselines[slotId];
  const { materialId } = surfaceMaterialEntry(state.pack, slotId);
  if (!baseline || !materialId) return;
  const next = structuredClone(state.pack);
  next.materials[materialId] = structuredClone(baseline);
  delete state.surfaceOverrides[slotId];
  next.integrity = null;
  const remaining = Object.entries(state.surfaceOverrides);
  if (remaining.length) {
    next.provenance.surfaceOverrides = Object.fromEntries(
      remaining
        .map(([id, override]) => [id, Object.keys(override).sort()])
        .sort(([a], [b]) => a.localeCompare(b))
    );
  } else {
    delete next.provenance.surfaceOverrides;
  }
  state.pack = next;
  await renderPack();
  toast(`${humanizeSurfaceId(slotId)} restored to the current recipe baseline.`);
}

function wireEvents() {
  for (const element of [
    byId("style-name"),
    byId("style-seed"),
    byId("color-primary"),
    byId("color-secondary"),
    byId("color-accent"),
    byId("high-contrast"),
    byId("reduced-motion"),
    byId("remix-allowed"),
    byId("character-silhouette"),
    byId("character-head"),
    byId("character-outfit"),
    byId("character-accessory"),
    byId("pattern-kind"),
    byId("asset-target")
  ]) {
    element.addEventListener("change", () => compileFromControls({ quiet: true }));
  }
  byId("character-proportion").addEventListener("input", async (event) => {
    event.target.nextElementSibling.textContent = Number(event.target.value).toFixed(2);
    await compileFromControls({ quiet: true });
  });
  for (const input of document.querySelectorAll("#keyword-chips input")) {
    input.addEventListener("change", () => compileFromControls({ quiet: true }));
  }

  byId("surface-organ-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-organ]");
    if (!button) return;
    state.surfaceOrgan = button.dataset.organ;
    document.querySelectorAll(".organ-filter").forEach((entry) => {
      entry.classList.toggle("active", entry === button);
    });
    renderSurfaceChamber();
  });

  byId("surface-search").addEventListener("input", (event) => {
    state.surfaceSearch = event.target.value;
    renderSurfaceChamber();
  });

  byId("surface-grid").addEventListener("click", (event) => {
    const card = event.target.closest("[data-surface-id]");
    if (!card) return;
    state.selectedSurfaceId = card.dataset.surfaceId;
    renderSurfaceChamber();
  });

  for (const [id, property] of [
    ["surface-base-color", "baseColor"],
    ["surface-secondary-color", "secondaryColor"],
    ["surface-accent-color", "accentColor"]
  ]) {
    byId(id).addEventListener("input", (event) => {
      updateSelectedSurfaceProperty(property, event.target.value);
    });
  }
  for (const [id, property] of [
    ["surface-glow", "glowIntensity"],
    ["surface-metallic", "metallic"],
    ["surface-roughness", "roughness"],
    ["surface-gloss", "gloss"],
    ["surface-opacity", "opacity"]
  ]) {
    byId(id).addEventListener("input", (event) => {
      event.target.nextElementSibling.textContent = Number(event.target.value).toFixed(2);
      updateSelectedSurfaceProperty(property, Number(event.target.value));
    });
  }
  byId("reset-surface").addEventListener("click", resetSelectedSurface);
  byId("inspect-surface-data").addEventListener("click", () => {
    openDialogTab("surface");
  });

  for (const [id, key] of [
    ["proof-preview", "previewIsolated"],
    ["proof-fallback", "fallbackObserved"],
    ["proof-rollback", "rollbackObserved"],
    ["proof-receipt", "receiptObserved"]
  ]) {
    byId(id).addEventListener("change", (event) => {
      state.adapterEvidence[key] = event.target.checked;
      renderConformance();
      renderDialog();
    });
  }
  byId("inspect-conformance").addEventListener("click", () => {
    openDialogTab("conformance");
  });

  byId("preskin-family-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-family]");
    if (!button) return;
    state.preskinFamily = button.dataset.family;
    document.querySelectorAll(".preskin-filter").forEach((entry) => {
      entry.classList.toggle("active", entry === button);
    });
    renderPreskinGallery();
  });

  byId("preskin-gallery").addEventListener("click", async (event) => {
    const card = event.target.closest("[data-preskin-id]");
    if (!card) return;
    state.activePreskinId = card.dataset.preskinId;
    if (state.fusionPreskinId === state.activePreskinId) {
      state.fusionPreskinId = null;
      byId("fusion-preskin").value = "";
      byId("fusion-amount").disabled = true;
    }
    renderPreskinGallery();
    await applySelectedPreskin();
  });

  byId("random-preskin").addEventListener("click", async () => {
    state.surpriseIndex += 1;
    const family = state.preskinFamily === "All" ? null : state.preskinFamily;
    const preset = chooseDeterministicPreskin(
      `${byId("style-seed").value}:${state.surpriseIndex}`,
      family
    );
    state.activePreskinId = preset.id;
    state.fusionPreskinId = null;
    byId("fusion-preskin").value = "";
    byId("fusion-amount").disabled = true;
    renderPreskinGallery();
    await applySelectedPreskin();
  });

  byId("fusion-preskin").addEventListener("change", async (event) => {
    state.fusionPreskinId = event.target.value || null;
    byId("fusion-amount").disabled = !state.fusionPreskinId;
    await applySelectedPreskin();
  });
  byId("fusion-amount").addEventListener("input", async (event) => {
    state.fusionAmount = Number(event.target.value);
    event.target.nextElementSibling.textContent = `${Math.round(state.fusionAmount * 100)}%`;
    await applySelectedPreskin({ quiet: true });
  });

  byId("generator-complexity").addEventListener("input", (event) => {
    event.target.nextElementSibling.textContent = Number(event.target.value).toFixed(2);
  });

  byId("mold-select").addEventListener("change", async (event) => {
    state.moldId = event.target.value;
    state.contract = createGameContractFromMold({
      moldId: state.moldId,
      gameId: "axm.demo.style-fabric",
      gameVersion: "0.5.0",
      rendererProfile: "browser-css-core"
    });
    resetAdapterEvidence();
    await renderPack();
    toast("Mold changed. Adapter proof reset because this contract needs fresh observation.");
  });

  byId("performance-profile").addEventListener("change", (event) => {
    state.performanceProfile = event.target.value;
  });

  byId("grow-from-seed").addEventListener("click", async () => {
    const intent = generateStyleIntent({
      seed: byId("style-seed").value,
      name: byId("style-name").value || "Generated AXM Style",
      moldId: state.moldId,
      mood: byId("generator-mood").value,
      complexity: Number(byId("generator-complexity").value),
      sharing: {
        attribution: "Mike - Axiom/mir",
        remixAllowed: byId("remix-allowed").checked
      }
    });
    state.intent = intent;
    state.activePreskinId = null;
    state.fusionPreskinId = null;
    applyIntentToControls(intent);
    const profiled = applyPerformanceProfile(
      compileStyleIntent(intent),
      state.performanceProfile
    );
    acceptFreshPack(attachCustomAsset(profiled.pack));
    state.imported = false;
    byId("style-phrase").value = intent.keywords.join(" ");
    await renderPack();
    toast(`Seed-grown ${state.moldId} style created with ${state.performanceProfile} limits.`);
  });

  byId("apply-performance").addEventListener("click", async () => {
    const profiled = applyPerformanceProfile(state.pack, state.performanceProfile);
    acceptFreshPack(profiled.pack, { clearOverrides: true });
    await renderPack();
    toast(
      profiled.receipt.changes.length
        ? `${profiled.receipt.changes.length} material values capped for ${state.performanceProfile}.`
        : `Already inside the ${state.performanceProfile} profile.`
    );
  });

  byId("build-stack").addEventListener("click", async () => {
    const source = (selectId) =>
      compileStyleIntent(
        applyPreskin(
          {
            type: "axm.style-intent",
            version: "1.0",
            name: `Layer ${selectId}`,
            seed: `${byId("style-seed").value}:${selectId}`,
            scope: ["global"],
            sharing: { attribution: "Mike - Axiom/mir", remixAllowed: false }
          },
          byId(selectId).value
        )
      );
    const layered = composeSkinStack(
      [
        { id: "world", scope: "world", pack: source("stack-world") },
        { id: "objects", scope: "objects", pack: source("stack-objects") },
        { id: "gear", scope: "gear", pack: source("stack-gear") },
        { id: "items", scope: "items", pack: source("stack-items") },
        { id: "characters", scope: "characters", pack: source("stack-character") },
        { id: "interface", scope: "interface", pack: source("stack-ui") },
        { id: "effects", scope: "effects", pack: source("stack-fx") }
      ],
      {
        name: `${byId("style-name").value || "AXM"} Layer Mix`,
        seed: byId("style-seed").value,
        creator: "Mike - Axiom/mir"
      }
    );
    const profiled = applyPerformanceProfile(layered, state.performanceProfile);
    acceptFreshPack(profiled.pack);
    state.intent = null;
    state.activePreskinId = null;
    state.fusionPreskinId = null;
    renderPreskinGallery();
    await renderPack();
    toast("Seven independent game-skin organs composed without cross-scope material leakage.");
  });

  byId("apply-harmony").addEventListener("click", async () => {
    const harmony = PALETTE_HARMONIES.includes(byId("palette-harmony").value)
      ? byId("palette-harmony").value
      : "triadic";
    const palette = createHarmonyPalette(byId("color-primary").value, harmony);
    for (const [key, value] of Object.entries(palette)) {
      byId(`color-${key}`).value = value;
    }
    await compileFromControls({ quiet: true });
    toast(`${harmony.replaceAll("-", " ")} palette forged from the primary color.`);
  });

  document.querySelectorAll(".mode").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll(".mode").forEach((entry) => entry.classList.remove("active"));
      button.classList.add("active");
      const scope = button.dataset.scope;
      state.scope =
        scope === "global"
          ? ["global"]
          : scope === "character.player"
            ? ["character.player"]
            : ["reusable"];
      await compileFromControls({ quiet: true });
    });
  });

  byId("compile-style").addEventListener("click", () => compileFromControls());
  byId("new-seed").addEventListener("click", async () => {
    const bytes = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint32Array(2))
      : new Uint32Array([
          Math.floor(Math.random() * 0xffff_ffff),
          Math.floor((Date.now() % 0xffff_ffff) ^ (Math.random() * 0xffff_ffff))
        ]);
    byId("style-seed").value = `axm-${bytes[0].toString(36)}-${bytes[1].toString(36)}`;
    await compileFromControls();
  });

  byId("interpret-phrase").addEventListener("click", async () => {
    const parsed = parseStylePhrase(byId("style-phrase").value, collectIntent());
    applyIntentToControls(parsed.intent);
    byId("phrase-report").textContent = parsed.unrecognized.length
      ? `Not mapped: ${parsed.unrecognized.join(", ")}. Those words were left out instead of guessed.`
      : `Mapped ${parsed.intent.keywords.length} recognized style words with no hidden additions.`;
    await compileFromControls();
  });

  const original = byId("toggle-original");
  const showOriginal = () => byId("specimen").classList.add("show-original");
  const hideOriginal = () => byId("specimen").classList.remove("show-original");
  original.addEventListener("pointerdown", showOriginal);
  original.addEventListener("pointerup", hideOriginal);
  original.addEventListener("pointerleave", hideOriginal);
  original.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") showOriginal();
  });
  original.addEventListener("keyup", hideOriginal);

  byId("toggle-motion").addEventListener("click", () => {
    state.motionPaused = !state.motionPaused;
    byId("toggle-motion").textContent = state.motionPaused ? "Resume motion" : "Pause motion";
    setStyleVariable("--motion-state", state.motionPaused ? "paused" : "running");
  });

  byId("asset-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      byId("asset-report").textContent = "Rejected: local embedded asset limit is 12 MiB.";
      return;
    }
    try {
      state.customAsset = await rasterFileToAsset(file);
      byId("asset-report").textContent =
        `${file.name} · ${(file.size / 1024).toFixed(1)} KiB · SHA-256 ${state.customAsset.asset.sha256.slice(0, 12)}…`;
      await compileFromControls({ quiet: true });
      toast("Custom asset embedded in the local draft.");
    } catch (error) {
      byId("asset-report").textContent = `Rejected: ${error.message}`;
    }
  });

  byId("export-pack").addEventListener("click", async () => {
    const validation = validateSkinPack(state.pack);
    if (!validation.ok) {
      toast("Export blocked: repair the validation issue first.");
      return;
    }
    const exported = await downloadSkinPack(state.pack);
    state.pack = exported.pack;
    await renderPack();
    toast(`Exported ${exported.filename}.`);
  });

  byId("import-pack").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await readSkinPackFile(file);
    if (!result.ok) {
      const issue = result.validation?.errors?.[0]?.message ?? result.errors?.[0]?.message ?? result.status;
      toast(`Import rejected: ${issue}`);
      return;
    }
    acceptFreshPack(result.pack, { clearOverrides: true });
    state.intent = result.pack.provenance?.sourceIntent ?? null;
    state.customAsset = null;
    state.imported = true;
    applyIntentToControls(state.intent);
    await renderPack();
    toast(
      result.integrity?.ok
        ? "Shared skin imported with verified integrity."
        : "Shared skin imported as structurally valid but unsigned."
    );
  });

  byId("save-library").addEventListener("click", async () => {
    const validation = validateSkinPack(state.pack);
    if (!validation.ok) {
      toast("Save blocked: repair the validation issue first.");
      return;
    }
    try {
      state.pack = await finalizePackForExport(state.pack);
      await library.save(state.pack);
      await refreshLibrary();
      await renderPack();
      toast("Saved as an immutable local skin version.");
    } catch (error) {
      toast(`Local save unavailable: ${error.message}`);
    }
  });

  byId("refresh-library").addEventListener("click", refreshLibrary);
  byId("view-data").addEventListener("click", () => {
    renderDialog();
    byId("data-dialog").showModal();
  });
  document.querySelectorAll("[data-dialog-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-dialog-tab]")
        .forEach((entry) => entry.classList.toggle("active", entry === button));
      state.currentDialogTab = button.dataset.dialogTab;
      renderDialog();
    });
  });
}

async function initialize() {
  buildControls();
  wireEvents();
  try {
    const [contractResponse, intentResponse] = await Promise.all([
      fetch("../examples/contracts/orb-arena.game-skin-contract.json"),
      fetch("../examples/intents/neon-paper-luxe.intent.json")
    ]);
    if (!contractResponse.ok || !intentResponse.ok) throw new Error("Example contracts could not load.");
    await contractResponse.json();
    state.contract = createGameContractFromMold({
      moldId: state.moldId,
      gameId: "axm.demo.style-fabric",
      gameVersion: "0.5.0",
      rendererProfile: "browser-css-core"
    });
    const baseIntent = await intentResponse.json();
    const intent = applyPreskin(baseIntent, state.activePreskinId);
    state.intent = intent;
    applyIntentToControls(intent);
    acceptFreshPack(compileStyleIntent(intent), { clearOverrides: true });
    await renderPack();
    await refreshLibrary();
  } catch (error) {
    byId("compatibility-label").textContent = "STARTUP BLOCKED";
    renderValidation({
      ok: false,
      errors: [{ message: `${error.message} Start with npm start; direct file opening cannot load modules.` }]
    });
  }
}

initialize();
