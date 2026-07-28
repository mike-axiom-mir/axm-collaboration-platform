import { hslToHex, mixHex, normalizeHex, readableText } from "./color.mjs";
import { clamp, deepMerge, hash32, seededRandom, slugify } from "./stable.mjs";

export const RECOGNIZED_STYLE_KEYWORDS = Object.freeze([
  "dark",
  "light",
  "neon",
  "paper",
  "luxury",
  "metallic",
  "matte",
  "glass",
  "holographic",
  "pixel",
  "cartoon",
  "nature",
  "cosmic",
  "warm",
  "cool",
  "minimal",
  "weathered",
  "high-contrast",
  "ink",
  "clay",
  "watercolor",
  "retro",
  "candy",
  "noir",
  "ocean",
  "desert",
  "forest",
  "royal",
  "industrial",
  "soft",
  "ice",
  "lava"
]);

export const RECOGNIZED_PATTERN_KINDS = Object.freeze([
  "none",
  "circuit",
  "paper-fiber",
  "holo-grid",
  "pixel-grid",
  "organic-cells",
  "star-noise",
  "scratches",
  "ink-hatch",
  "clay-speckle",
  "watercolor-bloom",
  "retro-stripe",
  "candy-dots",
  "waves",
  "sandgrain",
  "frost",
  "embers",
  "royal-lines",
  "prism-weave"
]);

const BASE = Object.freeze({
  colors: {
    background: "#11131d",
    surface: "#1a1e2d",
    primary: "#7c5cff",
    secondary: "#19d3c5",
    accent: "#ff4fa3",
    outline: "#090b12",
    danger: "#ff5263",
    success: "#44df91",
    objective: "#ffd166",
    text: "#f5f7ff",
    mutedText: "#aeb6ce"
  },
  material: {
    metallic: 0.12,
    roughness: 0.48,
    gloss: 0.52,
    specular: 0.52,
    clearcoat: 0.1,
    sheen: 0.18,
    translucency: 0,
    iridescence: 0,
    emissiveStrength: 0.35,
    glowIntensity: 0.28,
    glowRadius: 18,
    opacity: 1,
    outlineWidth: 2,
    grain: 0.04,
    weathering: 0,
    patternScale: 1,
    pulseSpeed: 0.7,
    shimmerSpeed: 0.35
  },
  geometry: {
    cornerRoundness: 0.62,
    silhouetteExaggeration: 0.25,
    detailDensity: 0.52
  },
  pattern: {
    kind: "none",
    strength: 0,
    scale: 1
  }
});

const KEYWORD_PATCHES = Object.freeze({
  dark: {
    colors: { background: "#070912", surface: "#101522" },
    material: { glowIntensity: 0.38 }
  },
  light: {
    colors: { background: "#f1f3f9", surface: "#ffffff", outline: "#24293b" },
    material: { glowIntensity: 0.12, grain: 0.02 }
  },
  neon: {
    material: { emissiveStrength: 1.2, glowIntensity: 0.78, glowRadius: 28 },
    pattern: { kind: "circuit", strength: 0.35 }
  },
  paper: {
    material: { metallic: 0, roughness: 0.82, gloss: 0.18, grain: 0.62 },
    geometry: { cornerRoundness: 0.34 },
    pattern: { kind: "paper-fiber", strength: 0.7 }
  },
  luxury: {
    material: { metallic: 0.52, roughness: 0.2, gloss: 0.82, clearcoat: 0.72 },
    geometry: { detailDensity: 0.68 }
  },
  metallic: {
    material: { metallic: 0.92, roughness: 0.24, gloss: 0.76, specular: 0.8 }
  },
  matte: {
    material: { metallic: 0.04, roughness: 0.92, gloss: 0.08, clearcoat: 0 }
  },
  glass: {
    material: { translucency: 0.72, opacity: 0.72, roughness: 0.12, gloss: 0.88 }
  },
  holographic: {
    material: { iridescence: 0.92, metallic: 0.44, shimmerSpeed: 1.1 },
    pattern: { kind: "holo-grid", strength: 0.5 }
  },
  pixel: {
    geometry: { cornerRoundness: 0.05, detailDensity: 0.3 },
    pattern: { kind: "pixel-grid", strength: 0.48, scale: 0.5 }
  },
  cartoon: {
    material: { metallic: 0.02, roughness: 0.64, outlineWidth: 5 },
    geometry: { silhouetteExaggeration: 0.7, cornerRoundness: 0.74 }
  },
  nature: {
    colors: {
      primary: "#55b86a",
      secondary: "#8bd17c",
      accent: "#f0b35a",
      objective: "#f4dc73"
    },
    pattern: { kind: "organic-cells", strength: 0.35 }
  },
  cosmic: {
    colors: { background: "#050515", primary: "#824dff", secondary: "#16d9ff", accent: "#ff3e9d" },
    material: { glowIntensity: 0.66, iridescence: 0.42 },
    pattern: { kind: "star-noise", strength: 0.42 }
  },
  warm: {
    colors: { primary: "#ff704d", secondary: "#ffb347", accent: "#ff4d89" }
  },
  cool: {
    colors: { primary: "#5a7dff", secondary: "#20d7d2", accent: "#b44dff" }
  },
  minimal: {
    material: { grain: 0, weathering: 0, outlineWidth: 1 },
    geometry: { detailDensity: 0.15 },
    pattern: { kind: "none", strength: 0 }
  },
  weathered: {
    material: { weathering: 0.74, roughness: 0.76, gloss: 0.2 },
    pattern: { kind: "scratches", strength: 0.48 }
  },
  "high-contrast": {
    colors: { background: "#050507", surface: "#16171c", text: "#ffffff", mutedText: "#d9deea" },
    material: { outlineWidth: 4 }
  },
  ink: {
    material: { roughness: 0.86, gloss: 0.08, grain: 0.34, outlineWidth: 6 },
    geometry: { detailDensity: 0.58 },
    pattern: { kind: "ink-hatch", strength: 0.42, scale: 0.86 }
  },
  clay: {
    material: { metallic: 0, roughness: 0.84, gloss: 0.12, sheen: 0.34, grain: 0.24 },
    geometry: { cornerRoundness: 0.92, silhouetteExaggeration: 0.56 },
    pattern: { kind: "clay-speckle", strength: 0.3, scale: 1.3 }
  },
  watercolor: {
    material: { metallic: 0, roughness: 0.96, gloss: 0.04, grain: 0.5 },
    pattern: { kind: "watercolor-bloom", strength: 0.66, scale: 1.7 }
  },
  retro: {
    material: { glowIntensity: 0.34, grain: 0.28, outlineWidth: 3 },
    geometry: { cornerRoundness: 0.18, detailDensity: 0.42 },
    pattern: { kind: "retro-stripe", strength: 0.44, scale: 0.74 }
  },
  candy: {
    colors: { primary: "#ff5fa2", secondary: "#5bd8ff", accent: "#ffd84d" },
    material: { gloss: 0.68, roughness: 0.34, sheen: 0.54 },
    geometry: { cornerRoundness: 0.94, silhouetteExaggeration: 0.7 },
    pattern: { kind: "candy-dots", strength: 0.48, scale: 1.35 }
  },
  noir: {
    colors: {
      background: "#050608",
      surface: "#13161d",
      primary: "#e9edf5",
      secondary: "#7a8496",
      accent: "#ff4058"
    },
    material: { glowIntensity: 0.14, roughness: 0.82, gloss: 0.1, grain: 0.32 }
  },
  ocean: {
    colors: { primary: "#20d8d2", secondary: "#2776d6", accent: "#8af6ff" },
    material: { sheen: 0.46, gloss: 0.62 },
    pattern: { kind: "waves", strength: 0.45, scale: 1.5 }
  },
  desert: {
    colors: { primary: "#d9984a", secondary: "#8f5b3b", accent: "#ff5f43" },
    material: { roughness: 0.86, grain: 0.58, weathering: 0.54 },
    pattern: { kind: "sandgrain", strength: 0.56, scale: 0.9 }
  },
  forest: {
    colors: { primary: "#58c878", secondary: "#8ecf72", accent: "#e6b85b" },
    material: { roughness: 0.72, sheen: 0.3 },
    pattern: { kind: "organic-cells", strength: 0.4, scale: 1.7 }
  },
  royal: {
    material: { metallic: 0.58, gloss: 0.74, clearcoat: 0.64 },
    geometry: { detailDensity: 0.78 },
    pattern: { kind: "royal-lines", strength: 0.34, scale: 1.3 }
  },
  industrial: {
    material: { metallic: 0.7, roughness: 0.5, weathering: 0.42 },
    geometry: { cornerRoundness: 0.16, detailDensity: 0.76 }
  },
  soft: {
    material: { metallic: 0.02, roughness: 0.76, gloss: 0.2, sheen: 0.42 },
    geometry: { cornerRoundness: 0.96, silhouetteExaggeration: 0.58 }
  },
  ice: {
    material: { gloss: 0.78, roughness: 0.16, translucency: 0.34, iridescence: 0.2 },
    pattern: { kind: "frost", strength: 0.52, scale: 1.1 }
  },
  lava: {
    colors: { primary: "#ff6a35", secondary: "#a83b2f", accent: "#ffc247" },
    material: { glowIntensity: 0.66, emissiveStrength: 1.35, roughness: 0.48 },
    pattern: { kind: "embers", strength: 0.5, scale: 1.2 }
  }
});

function finiteIntent(input) {
  const intent = structuredClone(input ?? {});
  const name = String(intent.name ?? "Untitled AXM Style").trim().slice(0, 80);
  const seed = String(intent.seed ?? slugify(name)).trim().slice(0, 120);
  const scope = Array.isArray(intent.scope) && intent.scope.length ? intent.scope : ["global"];
  const keywords = [...new Set((intent.keywords ?? []).map((value) => String(value).toLowerCase()))]
    .filter((value) => RECOGNIZED_STYLE_KEYWORDS.includes(value))
    .sort();

  return {
    type: "axm.style-intent",
    version: "1.0",
    name,
    seed,
    scope,
    keywords,
    intensity: clamp(intent.intensity ?? 0.72),
    palette: intent.palette ?? {},
    material: intent.material ?? {},
    pattern: {
      ...(RECOGNIZED_PATTERN_KINDS.includes(intent.pattern?.kind)
        ? { kind: intent.pattern.kind }
        : {}),
      ...(Number.isFinite(intent.pattern?.strength)
        ? { strength: clamp(intent.pattern.strength) }
        : {}),
      ...(Number.isFinite(intent.pattern?.scale)
        ? { scale: clamp(intent.pattern.scale, 0.1, 16) }
        : {})
    },
    geometry: {
      ...(Number.isFinite(intent.geometry?.cornerRoundness)
        ? { cornerRoundness: clamp(intent.geometry.cornerRoundness) }
        : {}),
      ...(Number.isFinite(intent.geometry?.silhouetteExaggeration)
        ? { silhouetteExaggeration: clamp(intent.geometry.silhouetteExaggeration) }
        : {}),
      ...(Number.isFinite(intent.geometry?.detailDensity)
        ? { detailDensity: clamp(intent.geometry.detailDensity) }
        : {})
    },
    character: intent.character ?? {},
    accessibility: {
      highContrast: Boolean(intent.accessibility?.highContrast),
      reducedMotion: Boolean(intent.accessibility?.reducedMotion),
      minimumTextContrast: clamp(intent.accessibility?.minimumTextContrast ?? 4.5, 1, 21)
    },
    sharing: {
      license: String(intent.sharing?.license ?? "LicenseRef-All-Rights-Reserved").slice(0, 80),
      remixAllowed: Boolean(intent.sharing?.remixAllowed),
      attribution: String(intent.sharing?.attribution ?? "Mike - Axiom/mir").slice(0, 160)
    },
    preset: intent.preset
      ? {
          catalog: String(intent.preset.catalog ?? "axm.preskins.v1").slice(0, 80),
          primary: String(intent.preset.primary ?? "").slice(0, 80),
          secondary: intent.preset.secondary
            ? String(intent.preset.secondary).slice(0, 80)
            : null,
          blend: clamp(intent.preset.blend ?? 0)
        }
      : null,
    generator: intent.generator
      ? {
          type: "axm.mold-maker",
          version: "1.0",
          moldId: String(intent.generator.moldId ?? "universal-core").slice(0, 80),
          mood: String(intent.generator.mood ?? "balanced").slice(0, 40),
          complexity: clamp(intent.generator.complexity ?? 0.55),
          harmony: String(intent.generator.harmony ?? "triadic").slice(0, 40)
        }
      : null
  };
}

function generateSeedPalette(seed, keywords) {
  const random = seededRandom(`${seed}:${keywords.join(",")}`);
  const baseHue = Math.floor(random() * 360);
  const dark = keywords.includes("dark") || keywords.includes("cosmic");
  const lightness = dark ? 57 : 49;
  return {
    primary: hslToHex(baseHue, 88, lightness),
    secondary: hslToHex(baseHue + 86, 82, lightness + 4),
    accent: hslToHex(baseHue + 206, 91, 62)
  };
}

export function normalizeStyleIntent(input) {
  return finiteIntent(input);
}

export function parseStylePhrase(phrase, base = {}) {
  const text = String(phrase ?? "").toLowerCase();
  const keywords = RECOGNIZED_STYLE_KEYWORDS.filter((word) => {
    const expression = new RegExp(`\\b${word.replace("-", "[- ]")}\\b`, "i");
    return expression.test(text);
  });
  const hexes = text.match(/#[0-9a-f]{3,6}\b/gi) ?? [];
  const recognizedFragments = new Set([
    ...keywords.flatMap((word) => word.split("-")),
    ...hexes.map((hex) => hex.toLowerCase()),
    "and",
    "with",
    "style",
    "game",
    "character",
    "reduced",
    "motion"
  ]);
  const unrecognized = text
    .replace(/#[0-9a-f]{3,6}\b/gi, " ")
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length > 2 && !recognizedFragments.has(word));

  return {
    intent: normalizeStyleIntent({
      ...base,
      keywords,
      palette: {
        ...(base.palette ?? {}),
        ...(hexes[0] ? { primary: hexes[0] } : {}),
        ...(hexes[1] ? { accent: hexes[1] } : {})
      },
      accessibility: {
        ...(base.accessibility ?? {}),
        reducedMotion: /\breduced[- ]motion\b/i.test(text),
        highContrast: /\bhigh[- ]contrast\b/i.test(text)
      }
    }),
    unrecognized: [...new Set(unrecognized)].sort()
  };
}

export function compileStyleIntent(input) {
  const intent = normalizeStyleIntent(input);
  let recipe = structuredClone(BASE);
  recipe.colors = { ...recipe.colors, ...generateSeedPalette(intent.seed, intent.keywords) };

  for (const keyword of intent.keywords) {
    recipe = deepMerge(recipe, KEYWORD_PATCHES[keyword] ?? {});
  }

  recipe.colors = {
    ...recipe.colors,
    ...Object.fromEntries(
      Object.entries(intent.palette).map(([key, value]) => [key, normalizeHex(value, recipe.colors[key])])
    )
  };
  recipe.pattern = {
    ...recipe.pattern,
    ...intent.pattern,
    kind: intent.pattern.kind ?? recipe.pattern.kind
  };
  recipe.geometry = { ...recipe.geometry, ...intent.geometry };
  recipe.material = { ...recipe.material, ...intent.material };
  recipe.material.patternScale = recipe.pattern.scale;

  const intensity = intent.intensity;
  recipe.material.glowIntensity = clamp(recipe.material.glowIntensity * (0.35 + intensity * 0.9));
  recipe.material.emissiveStrength = clamp(recipe.material.emissiveStrength * (0.4 + intensity), 0, 2);
  recipe.pattern.strength = clamp(recipe.pattern.strength * (0.3 + intensity));

  if (intent.accessibility.highContrast) {
    recipe = deepMerge(recipe, KEYWORD_PATCHES["high-contrast"]);
  }
  if (intent.accessibility.reducedMotion) {
    recipe.material.pulseSpeed = 0;
    recipe.material.shimmerSpeed = 0;
  }
  recipe.colors.text = readableText(recipe.colors.surface);
  recipe.colors.mutedText = mixHex(recipe.colors.text, recipe.colors.surface, 0.32);

  const idSuffix = hash32(`${intent.seed}:${intent.keywords.join(",")}`).toString(16).padStart(8, "0");
  const material = {
    baseColor: recipe.colors.primary,
    secondaryColor: recipe.colors.secondary,
    accentColor: recipe.colors.accent,
    emissiveColor: recipe.colors.accent,
    ...recipe.material,
    pattern: recipe.pattern
  };
  const materials = {
    "world.sky": {
      ...material,
      baseColor: mixHex(recipe.colors.background, recipe.colors.primary, 0.26),
      secondaryColor: recipe.colors.background,
      opacity: 1
    },
    "world.base": {
      ...material,
      baseColor: recipe.colors.surface,
      secondaryColor: recipe.colors.background
    },
    "world.terrain": {
      ...material,
      baseColor: mixHex(recipe.colors.surface, recipe.colors.primary, 0.2),
      roughness: Math.max(0.42, material.roughness)
    },
    "world.accent": material,
    "world.water": {
      ...material,
      baseColor: mixHex(recipe.colors.secondary, "#2776d6", 0.42),
      translucency: Math.max(0.24, material.translucency),
      gloss: Math.max(0.52, material.gloss)
    },
    "world.weather": {
      ...material,
      baseColor: recipe.colors.mutedText,
      opacity: Math.min(0.72, Math.max(0.18, material.opacity))
    },
    "world.lighting": {
      ...material,
      baseColor: recipe.colors.text,
      accentColor: recipe.colors.primary,
      emissiveStrength: Math.max(0.35, material.emissiveStrength)
    },
    "world.postfx": {
      ...material,
      baseColor: recipe.colors.primary,
      opacity: Math.min(0.42, Math.max(0.1, material.opacity))
    },
    "structure.building": {
      ...material,
      baseColor: mixHex(recipe.colors.surface, recipe.colors.primary, 0.25),
      roughness: Math.max(0.38, material.roughness)
    },
    "structure.interior": {
      ...material,
      baseColor: recipe.colors.surface,
      secondaryColor: recipe.colors.text
    },
    "prop.environment": {
      ...material,
      baseColor: mixHex(recipe.colors.surface, recipe.colors.secondary, 0.34)
    },
    "prop.interactive": {
      ...material,
      baseColor: recipe.colors.secondary,
      accentColor: recipe.colors.objective
    },
    "vehicle.body": {
      ...material,
      baseColor: recipe.colors.primary,
      secondaryColor: recipe.colors.secondary
    },
    "vehicle.detail": {
      ...material,
      baseColor: recipe.colors.secondary,
      accentColor: recipe.colors.accent,
      metallic: Math.max(0.18, material.metallic)
    },
    "equipment.weapon": {
      ...material,
      baseColor: mixHex(recipe.colors.surface, recipe.colors.primary, 0.46),
      accentColor: recipe.colors.accent,
      metallic: Math.max(0.22, material.metallic)
    },
    "equipment.tool": {
      ...material,
      baseColor: mixHex(recipe.colors.surface, recipe.colors.secondary, 0.46),
      accentColor: recipe.colors.secondary
    },
    "item.pickup": {
      ...material,
      baseColor: recipe.colors.success,
      accentColor: recipe.colors.text,
      glowIntensity: Math.max(0.22, material.glowIntensity)
    },
    "item.objective": {
      ...material,
      baseColor: recipe.colors.objective,
      accentColor: recipe.colors.text,
      glowIntensity: Math.max(0.28, material.glowIntensity)
    },
    "projectile.primary": {
      ...material,
      baseColor: recipe.colors.accent,
      opacity: Math.min(0.94, Math.max(0.35, material.opacity)),
      emissiveStrength: Math.max(0.5, material.emissiveStrength)
    },
    "character.player": {
      ...material,
      baseColor: recipe.colors.primary,
      secondaryColor: recipe.colors.secondary
    },
    "character.player.detail": {
      ...material,
      baseColor: recipe.colors.secondary,
      accentColor: recipe.colors.accent
    },
    "character.player.face": {
      ...material,
      baseColor: mixHex("#f0c8a0", recipe.colors.primary, 0.16),
      secondaryColor: recipe.colors.primary
    },
    "character.enemy": {
      ...material,
      baseColor: recipe.colors.danger,
      secondaryColor: mixHex(recipe.colors.danger, recipe.colors.accent, 0.45)
    },
    "character.npc": {
      ...material,
      baseColor: recipe.colors.success,
      secondaryColor: mixHex(recipe.colors.success, recipe.colors.secondary, 0.5)
    },
    "fx.primary": {
      ...material,
      baseColor: recipe.colors.accent,
      emissiveStrength: Math.max(0.5, material.emissiveStrength)
    },
    "fx.impact": {
      ...material,
      baseColor: recipe.colors.objective,
      accentColor: recipe.colors.accent,
      emissiveStrength: Math.max(0.62, material.emissiveStrength)
    },
    "fx.ambient": {
      ...material,
      baseColor: recipe.colors.primary,
      secondaryColor: recipe.colors.secondary,
      opacity: Math.min(0.62, Math.max(0.18, material.opacity))
    },
    "ui.panel": {
      ...material,
      baseColor: recipe.colors.surface,
      secondaryColor: recipe.colors.text,
      opacity: Math.max(0.58, material.opacity),
      translucency: Math.min(0.65, material.translucency)
    },
    "ui.hud": {
      ...material,
      baseColor: recipe.colors.surface,
      secondaryColor: recipe.colors.text,
      accentColor: recipe.colors.secondary,
      opacity: Math.max(0.5, material.opacity)
    },
    "ui.menu": {
      ...material,
      baseColor: mixHex(recipe.colors.surface, recipe.colors.background, 0.24),
      secondaryColor: recipe.colors.text,
      accentColor: recipe.colors.primary,
      opacity: Math.max(0.58, material.opacity)
    },
    "ui.marker": {
      ...material,
      baseColor: recipe.colors.objective,
      secondaryColor: readableText(recipe.colors.objective),
      opacity: 1
    },
    "ui.cursor": {
      ...material,
      baseColor: recipe.colors.text,
      accentColor: recipe.colors.primary,
      opacity: 1
    },
    "ui.icon": {
      ...material,
      baseColor: recipe.colors.text,
      accentColor: recipe.colors.secondary,
      opacity: 1
    }
  };
  const bindingMaterials = {
    "world.background": "world.base",
    "world.surface": "world.accent",
    "character.player.body": "character.player",
    "character.enemy.body": "character.enemy",
    "character.npc.body": "character.npc"
  };
  const targets = [
    "world.sky",
    "world.background",
    "world.terrain",
    "world.surface",
    "world.water",
    "world.weather",
    "world.lighting",
    "world.postfx",
    "structure.building",
    "structure.interior",
    "prop.environment",
    "prop.interactive",
    "vehicle.body",
    "vehicle.detail",
    "equipment.weapon",
    "equipment.tool",
    "item.pickup",
    "item.objective",
    "projectile.primary",
    "character.player.body",
    "character.player.detail",
    "character.player.face",
    "character.enemy.body",
    "character.npc.body",
    "fx.primary",
    "fx.impact",
    "fx.ambient",
    "ui.panel",
    "ui.hud",
    "ui.menu",
    "ui.marker",
    "ui.cursor",
    "ui.icon"
  ];
  const bindings = targets.map((target) => ({
    target,
    material: bindingMaterials[target] ?? target,
    optional: true
  }));
  const scopePrefixes = {
    world: ["world."],
    objects: ["structure.", "prop."],
    gear: ["vehicle.", "equipment."],
    items: ["item.", "projectile."],
    characters: ["character."],
    "character.cast": ["character."],
    interface: ["ui."],
    ui: ["ui."],
    effects: ["fx."],
    fx: ["fx."]
  };
  const onlyScope = intent.scope.length === 1 ? intent.scope[0] : null;
  const prefixes = scopePrefixes[onlyScope] ?? (onlyScope ? [`${onlyScope}.`] : []);
  const scopedBindings =
    !onlyScope || onlyScope === "global"
      ? bindings
      : bindings.filter(
          (binding) =>
            binding.target === onlyScope ||
            prefixes.some((prefix) => binding.target.startsWith(prefix))
        );

  return {
    type: "axm.skin-pack",
    version: "1.0",
    id: `user.${slugify(intent.name)}.${idSuffix}`,
    release: "0.5.0",
    status: "WORKING_TEST",
    metadata: {
      name: intent.name,
      description: `${intent.keywords.join(" + ") || "custom"} deterministic AXM style`,
      creator: intent.sharing.attribution,
      license: intent.sharing.license,
      remixAllowed: intent.sharing.remixAllowed,
      aiAssistance: "DECLARATIVE_INTENT_COMPILER",
      createdAt: null
    },
    extends: null,
    scopes: intent.scope,
    capabilities: [
      "palette.v1",
      "theme-tokens.v1",
      "material-params.v1",
      "character-parts.v1",
      "environment-surfaces.v1",
      "game-surfaces.v1",
      "lighting-profile.v1",
      "vehicle-presentation.v1",
      "equipment-presentation.v1",
      "item-presentation.v1",
      "postfx-profile.v1",
      "ui-theme.v1",
      "fx-preset.v1",
      ...(intent.generator ? ["semantic-mold.v1"] : [])
    ],
    parameters: {
      glow: { type: "number", min: 0, max: 1, default: material.glowIntensity },
      gloss: { type: "number", min: 0, max: 1, default: material.gloss },
      metallic: { type: "number", min: 0, max: 1, default: material.metallic },
      roughness: { type: "number", min: 0, max: 1, default: material.roughness },
      clearcoat: { type: "number", min: 0, max: 1, default: material.clearcoat },
      sheen: { type: "number", min: 0, max: 1, default: material.sheen },
      iridescence: { type: "number", min: 0, max: 1, default: material.iridescence },
      translucency: { type: "number", min: 0, max: 1, default: material.translucency },
      weathering: { type: "number", min: 0, max: 1, default: material.weathering },
      outline: { type: "number", min: 0, max: 12, default: material.outlineWidth },
      patternStrength: { type: "number", min: 0, max: 1, default: recipe.pattern.strength }
    },
    tokens: {
      color: recipe.colors,
      geometry: recipe.geometry,
      motion: {
        pulseSpeed: material.pulseSpeed,
        shimmerSpeed: material.shimmerSpeed
      },
      typography: {
        familyRole: "game-default",
        weight: intent.keywords.includes("luxury") ? 650 : 580,
        tracking: intent.keywords.includes("pixel") ? 0.08 : 0.02
      }
    },
    materials,
    bindings: scopedBindings,
    assets: {},
    characterBlueprints: {
      default: {
        silhouette: intent.character.silhouette ?? (intent.keywords.includes("cartoon") ? "heroic-soft" : "balanced"),
        headShape: intent.character.headShape ?? "round",
        outfit: intent.character.outfit ?? (intent.keywords.includes("luxury") ? "future-tailored" : "modular"),
        accessory: intent.character.accessory ?? "none",
        proportion: clamp(intent.character.proportion ?? 0.5),
        paletteRegions: ["base", "secondary", "trim", "outline", "emissive"]
      }
    },
    accessibility: {
      minimumTextContrast: intent.accessibility.minimumTextContrast,
      preserveGameplayCues: true,
      reducedMotionSafe: intent.accessibility.reducedMotion,
      colorIsNotOnlySignal: true
    },
    provenance: {
      origin: "deterministic-recipe",
      compiler: "axm.style-recipe.v5",
      seed: intent.seed,
      preset: intent.preset,
      sourceIntent: intent,
      sourceAssetHashes: []
    },
    integrity: null
  };
}
