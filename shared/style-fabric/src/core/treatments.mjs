import {
  assertSafeObjectTree,
  clamp,
  clone,
  hash32,
  seededRandom,
  slugify,
  stableStringify
} from "./stable.mjs";

const PORTABLE_ID = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const REMOTE_OR_EXECUTABLE_TEXT = /(?:https?:\/\/|data:|blob:|file:|javascript:)/i;

const COLOR_ROLES = Object.freeze([
  "background",
  "surface",
  "primary",
  "secondary",
  "accent",
  "text",
  "mutedText",
  "shadow",
  "highlight"
]);

const LAYER_KINDS = Object.freeze([
  "fill",
  "texture",
  "inner-glow",
  "outer-glow",
  "rim-light",
  "shadow",
  "highlight",
  "bloom",
  "haze",
  "gradient"
]);

const BLEND_MODES = Object.freeze([
  "normal",
  "screen",
  "add",
  "multiply",
  "soft-light"
]);

const LAYER_MASKS = Object.freeze([
  "full",
  "inside",
  "outside",
  "edge",
  "top",
  "bottom",
  "radial"
]);

const PATTERNS = Object.freeze([
  "none",
  "paper-fiber",
  "grain",
  "circuit",
  "holo-grid",
  "ink-hatch"
]);

const MOTION_KINDS = Object.freeze(["none", "pulse", "shimmer", "drift"]);

const MATERIAL_NUMBER_BOUNDS = Object.freeze({
  metallic: [0, 1],
  roughness: [0, 1],
  gloss: [0, 1],
  specular: [0, 1],
  clearcoat: [0, 1],
  sheen: [0, 1],
  translucency: [0, 1],
  iridescence: [0, 1],
  emissiveStrength: [0, 2],
  glowIntensity: [0, 1],
  glowRadius: [0, 64],
  opacity: [0.1, 1],
  outlineWidth: [0, 12],
  grain: [0, 1],
  weathering: [0, 1],
  patternScale: [0.1, 16],
  pulseSpeed: [0, 4],
  shimmerSpeed: [0, 4]
});

const LAYER_NUMBER_BOUNDS = Object.freeze({
  opacity: [0, 1],
  intensity: [0, 1],
  threshold: [0, 1],
  softness: [0, 1],
  radius: [0, 64],
  spread: [0, 32],
  scale: [0.1, 16]
});

const FORBIDDEN_KEYS = Object.freeze(
  new Set([
    "__proto__",
    "prototype",
    "constructor",
    "script",
    "scripts",
    "javascript",
    "executable",
    "shaderSource",
    "code",
    "eval",
    "filesystem",
    "network",
    "permissions",
    "gameplay",
    "damage",
    "health",
    "score",
    "physics",
    "collision",
    "hitbox",
    "input",
    "randomness",
    "rng",
    "authority",
    "simulation",
    "saveData",
    "aiBehavior",
    "spawnRate"
  ])
);

const FORBIDDEN_TARGET_SEGMENTS = Object.freeze(
  new Set([
    "gameplay",
    "damage",
    "health",
    "score",
    "physics",
    "collision",
    "hitbox",
    "input",
    "network",
    "permissions",
    "authority",
    "simulation",
    "save"
  ])
);

const MOLD_FIELDS = Object.freeze(
  new Set([
    "type",
    "version",
    "id",
    "name",
    "description",
    "status",
    "targets",
    "defaultProfile",
    "palette",
    "legacy",
    "effectStack",
    "lightingRig",
    "constraints",
    "provenance"
  ])
);

const LEGACY_FIELDS = Object.freeze(
  new Set(["colors", "pattern", ...Object.keys(MATERIAL_NUMBER_BOUNDS)])
);

const LEGACY_COLOR_FIELDS = Object.freeze(
  new Set(["baseColor", "secondaryColor", "accentColor", "emissiveColor"])
);

const LAYER_FIELDS = Object.freeze(
  new Set([
    "id",
    "kind",
    "blendMode",
    "colorRole",
    "secondaryColorRole",
    "mask",
    "opacity",
    "intensity",
    "threshold",
    "softness",
    "radius",
    "spread",
    "scale",
    "pattern",
    "motion"
  ])
);

const LIGHT_FIELDS = Object.freeze(
  new Set(["colorRole", "intensity", "directionDegrees", "softness"])
);

const LIGHTING_FIELDS = Object.freeze(
  new Set([
    "version",
    "ambient",
    "key",
    "fill",
    "rim",
    "shadows",
    "bloom",
    "haze",
    "exposure",
    "contrast"
  ])
);

const CONSTRAINT_FIELDS = Object.freeze(
  new Set([
    "maxLayers",
    "maxEffectCost",
    "minimumTextContrast",
    "preserveGameplayCues",
    "reducedMotionFallback"
  ])
);

const PROVENANCE_FIELDS = Object.freeze(
  new Set(["origin", "creator", "license", "remixAllowed"])
);

const LAYER_COST = Object.freeze({
  fill: 0,
  texture: 1,
  "inner-glow": 1,
  "outer-glow": 1,
  "rim-light": 1,
  shadow: 1,
  highlight: 1,
  gradient: 1,
  haze: 2,
  bloom: 3
});

export const TREATMENT_PROFILES = Object.freeze({
  legacy: Object.freeze({
    id: "legacy",
    maxLayers: 3,
    maxEffectCost: 3,
    maxGlowIntensity: 0.22,
    maxGlowRadius: 12,
    maxEmissiveStrength: 0.55,
    maxBloomIntensity: 0,
    maxHazeDensity: 0.05,
    maxAnimatedLayers: 0,
    maxLightIntensity: 0.7
  }),
  balanced: Object.freeze({
    id: "balanced",
    maxLayers: 6,
    maxEffectCost: 8,
    maxGlowIntensity: 0.68,
    maxGlowRadius: 32,
    maxEmissiveStrength: 1.3,
    maxBloomIntensity: 0.4,
    maxHazeDensity: 0.2,
    maxAnimatedLayers: 1,
    maxLightIntensity: 1.25
  }),
  showcase: Object.freeze({
    id: "showcase",
    maxLayers: 8,
    maxEffectCost: 14,
    maxGlowIntensity: 1,
    maxGlowRadius: 64,
    maxEmissiveStrength: 2,
    maxBloomIntensity: 1,
    maxHazeDensity: 0.5,
    maxAnimatedLayers: 2,
    maxLightIntensity: 2
  }),
  "reduced-motion": Object.freeze({
    id: "reduced-motion",
    maxLayers: 6,
    maxEffectCost: 8,
    maxGlowIntensity: 0.68,
    maxGlowRadius: 32,
    maxEmissiveStrength: 1.3,
    maxBloomIntensity: 0.4,
    maxHazeDensity: 0.2,
    maxAnimatedLayers: 0,
    maxLightIntensity: 1.25
  })
});

const BUILT_IN_MOLDS = [
  {
    type: "axm.treatment-mold",
    version: "1.0",
    id: "aetherglass-cinematic",
    name: "Aetherglass Cinematic",
    description:
      "Deep glass, selective cyan and violet edge light, soft bloom, and a restrained cinematic lighting rig.",
    status: "WORKING_TEST",
    targets: ["world.lighting", "world.postfx", "ui.panel", "fx.ambient"],
    defaultProfile: "showcase",
    palette: {
      background: "#050812",
      surface: "#10192a",
      primary: "#38e8ff",
      secondary: "#7c5cff",
      accent: "#ff43c8",
      text: "#f6fbff",
      mutedText: "#aebbd2",
      shadow: "#02040a",
      highlight: "#dffcff"
    },
    legacy: {
      colors: {
        baseColor: "surface",
        secondaryColor: "primary",
        accentColor: "accent",
        emissiveColor: "secondary"
      },
      metallic: 0.28,
      roughness: 0.18,
      gloss: 0.86,
      specular: 0.78,
      clearcoat: 0.74,
      sheen: 0.34,
      translucency: 0.62,
      iridescence: 0.24,
      emissiveStrength: 1.28,
      glowIntensity: 0.72,
      glowRadius: 34,
      opacity: 0.78,
      outlineWidth: 1.4,
      grain: 0.04,
      weathering: 0,
      patternScale: 1,
      pulseSpeed: 0,
      shimmerSpeed: 0.44,
      pattern: { kind: "holo-grid", strength: 0.18, scale: 1.4 }
    },
    effectStack: {
      version: "1.0",
      layers: [
        {
          id: "glass-fill",
          kind: "fill",
          blendMode: "normal",
          colorRole: "surface",
          mask: "inside",
          opacity: 0.78,
          intensity: 0.72
        },
        {
          id: "inner-highlight",
          kind: "inner-glow",
          blendMode: "screen",
          colorRole: "highlight",
          mask: "inside",
          opacity: 0.34,
          intensity: 0.38,
          radius: 9,
          softness: 0.76
        },
        {
          id: "cyan-rim",
          kind: "rim-light",
          blendMode: "screen",
          colorRole: "primary",
          mask: "edge",
          opacity: 0.82,
          intensity: 0.72,
          radius: 12,
          softness: 0.52,
          motion: { kind: "shimmer", speed: 0.44, amount: 0.16 }
        },
        {
          id: "violet-aura",
          kind: "outer-glow",
          blendMode: "screen",
          colorRole: "secondary",
          mask: "outside",
          opacity: 0.46,
          intensity: 0.48,
          radius: 24,
          spread: 5,
          softness: 0.82
        },
        {
          id: "accent-bloom",
          kind: "bloom",
          blendMode: "add",
          colorRole: "accent",
          mask: "edge",
          opacity: 0.3,
          intensity: 0.28,
          radius: 32,
          threshold: 0.72,
          softness: 0.9
        },
        {
          id: "depth-haze",
          kind: "haze",
          blendMode: "screen",
          colorRole: "primary",
          mask: "radial",
          opacity: 0.14,
          intensity: 0.12,
          radius: 44,
          softness: 0.96
        }
      ]
    },
    lightingRig: {
      version: "1.0",
      ambient: { colorRole: "background", intensity: 0.28, softness: 1 },
      key: {
        colorRole: "primary",
        intensity: 0.84,
        directionDegrees: 315,
        softness: 0.55
      },
      fill: {
        colorRole: "secondary",
        intensity: 0.34,
        directionDegrees: 45,
        softness: 0.82
      },
      rim: {
        colorRole: "accent",
        intensity: 0.68,
        directionDegrees: 150,
        softness: 0.48
      },
      shadows: { strength: 0.62, softness: 0.7 },
      bloom: { intensity: 0.28, threshold: 0.72, radius: 32 },
      haze: { colorRole: "primary", density: 0.12 },
      exposure: 1.04,
      contrast: 1.08
    },
    constraints: {
      maxLayers: 8,
      maxEffectCost: 14,
      minimumTextContrast: 4.5,
      preserveGameplayCues: true,
      reducedMotionFallback: true
    },
    provenance: {
      origin: "built-in-treatment-mold",
      creator: "Mike - Axiom/mir",
      license: "LicenseRef-AXM-Treatment-Test",
      remixAllowed: true
    }
  },
  {
    type: "axm.treatment-mold",
    version: "1.0",
    id: "neon-paper-selective",
    name: "Neon Paper Selective",
    description:
      "Warm paper and ink remain tactile while only trim and interaction edges receive neon energy.",
    status: "WORKING_TEST",
    targets: ["world.surface", "character.player.detail", "ui.panel", "fx.primary"],
    defaultProfile: "balanced",
    palette: {
      background: "#111018",
      surface: "#e8d9bd",
      primary: "#24d9df",
      secondary: "#7658e8",
      accent: "#ff4f9a",
      text: "#15131b",
      mutedText: "#655d64",
      shadow: "#1c1720",
      highlight: "#fff3d8"
    },
    legacy: {
      colors: {
        baseColor: "surface",
        secondaryColor: "primary",
        accentColor: "accent",
        emissiveColor: "primary"
      },
      metallic: 0.02,
      roughness: 0.82,
      gloss: 0.16,
      specular: 0.22,
      clearcoat: 0.04,
      sheen: 0.18,
      translucency: 0,
      iridescence: 0,
      emissiveStrength: 0.82,
      glowIntensity: 0.42,
      glowRadius: 18,
      opacity: 1,
      outlineWidth: 4.2,
      grain: 0.68,
      weathering: 0.08,
      patternScale: 1.1,
      pulseSpeed: 0.26,
      shimmerSpeed: 0,
      pattern: { kind: "paper-fiber", strength: 0.72, scale: 1.1 }
    },
    effectStack: {
      version: "1.0",
      layers: [
        {
          id: "paper-base",
          kind: "texture",
          blendMode: "normal",
          colorRole: "surface",
          mask: "inside",
          opacity: 0.88,
          intensity: 0.76,
          scale: 1.1,
          pattern: "paper-fiber"
        },
        {
          id: "ink-shadow",
          kind: "shadow",
          blendMode: "multiply",
          colorRole: "shadow",
          mask: "outside",
          opacity: 0.72,
          intensity: 0.56,
          radius: 4,
          spread: 2,
          softness: 0.28
        },
        {
          id: "cyan-trim",
          kind: "rim-light",
          blendMode: "screen",
          colorRole: "primary",
          mask: "edge",
          opacity: 0.74,
          intensity: 0.52,
          radius: 8,
          softness: 0.34,
          motion: { kind: "pulse", speed: 0.26, amount: 0.08 }
        },
        {
          id: "pink-signal",
          kind: "outer-glow",
          blendMode: "screen",
          colorRole: "accent",
          mask: "edge",
          opacity: 0.34,
          intensity: 0.3,
          radius: 16,
          spread: 2,
          softness: 0.68
        }
      ]
    },
    lightingRig: {
      version: "1.0",
      ambient: { colorRole: "background", intensity: 0.34, softness: 1 },
      key: {
        colorRole: "highlight",
        intensity: 0.66,
        directionDegrees: 330,
        softness: 0.72
      },
      fill: {
        colorRole: "primary",
        intensity: 0.22,
        directionDegrees: 60,
        softness: 0.84
      },
      rim: {
        colorRole: "accent",
        intensity: 0.42,
        directionDegrees: 160,
        softness: 0.38
      },
      shadows: { strength: 0.7, softness: 0.36 },
      bloom: { intensity: 0.18, threshold: 0.8, radius: 18 },
      haze: { colorRole: "primary", density: 0.03 },
      exposure: 1,
      contrast: 1.06
    },
    constraints: {
      maxLayers: 6,
      maxEffectCost: 8,
      minimumTextContrast: 4.5,
      preserveGameplayCues: true,
      reducedMotionFallback: true
    },
    provenance: {
      origin: "built-in-treatment-mold",
      creator: "Mike - Axiom/mir",
      license: "LicenseRef-AXM-Treatment-Test",
      remixAllowed: true
    }
  },
  {
    type: "axm.treatment-mold",
    version: "1.0",
    id: "accessible-night-edge",
    name: "Accessible Night Edge",
    description:
      "Crisp high-contrast night treatment that remains readable without bloom or motion.",
    status: "WORKING_TEST",
    targets: ["ui.panel", "ui.hud", "ui.menu", "ui.marker"],
    defaultProfile: "reduced-motion",
    palette: {
      background: "#050609",
      surface: "#141821",
      primary: "#65e8ff",
      secondary: "#a99aff",
      accent: "#ffd166",
      text: "#ffffff",
      mutedText: "#d2d8e2",
      shadow: "#000000",
      highlight: "#ffffff"
    },
    legacy: {
      colors: {
        baseColor: "surface",
        secondaryColor: "text",
        accentColor: "accent",
        emissiveColor: "primary"
      },
      metallic: 0,
      roughness: 0.72,
      gloss: 0.18,
      specular: 0.3,
      clearcoat: 0,
      sheen: 0.08,
      translucency: 0.04,
      iridescence: 0,
      emissiveStrength: 0.38,
      glowIntensity: 0.18,
      glowRadius: 6,
      opacity: 0.96,
      outlineWidth: 3.2,
      grain: 0,
      weathering: 0,
      patternScale: 1,
      pulseSpeed: 0,
      shimmerSpeed: 0,
      pattern: { kind: "none", strength: 0, scale: 1 }
    },
    effectStack: {
      version: "1.0",
      layers: [
        {
          id: "night-fill",
          kind: "fill",
          blendMode: "normal",
          colorRole: "surface",
          mask: "inside",
          opacity: 0.96,
          intensity: 0.92
        },
        {
          id: "crisp-shadow",
          kind: "shadow",
          blendMode: "multiply",
          colorRole: "shadow",
          mask: "outside",
          opacity: 0.76,
          intensity: 0.54,
          radius: 3,
          spread: 1,
          softness: 0.18
        },
        {
          id: "focus-edge",
          kind: "rim-light",
          blendMode: "screen",
          colorRole: "accent",
          mask: "edge",
          opacity: 0.88,
          intensity: 0.44,
          radius: 3,
          softness: 0.12,
          motion: { kind: "none", speed: 0, amount: 0 }
        }
      ]
    },
    lightingRig: {
      version: "1.0",
      ambient: { colorRole: "background", intensity: 0.42, softness: 1 },
      key: {
        colorRole: "text",
        intensity: 0.58,
        directionDegrees: 315,
        softness: 0.54
      },
      fill: {
        colorRole: "primary",
        intensity: 0.16,
        directionDegrees: 45,
        softness: 0.72
      },
      rim: {
        colorRole: "accent",
        intensity: 0.34,
        directionDegrees: 160,
        softness: 0.16
      },
      shadows: { strength: 0.74, softness: 0.22 },
      bloom: { intensity: 0, threshold: 1, radius: 0 },
      haze: { colorRole: "background", density: 0 },
      exposure: 1,
      contrast: 1.12
    },
    constraints: {
      maxLayers: 4,
      maxEffectCost: 4,
      minimumTextContrast: 7,
      preserveGameplayCues: true,
      reducedMotionFallback: true
    },
    provenance: {
      origin: "built-in-treatment-mold",
      creator: "Mike - Axiom/mir",
      license: "LicenseRef-AXM-Treatment-Test",
      remixAllowed: true
    }
  }
];

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

export const TREATMENT_MOLDS = Object.freeze(BUILT_IN_MOLDS.map(deepFreeze));

const TREATMENT_MOLD_BY_ID = new Map(
  TREATMENT_MOLDS.map((mold) => [mold.id, mold])
);

function createReport() {
  return { ok: true, errors: [], warnings: [], checks: [] };
}

function addError(report, code, path, message) {
  report.ok = false;
  report.errors.push({ code, path, message });
}

function addWarning(report, code, path, message) {
  report.warnings.push({ code, path, message });
}

function checkFields(value, allowed, report, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    addError(report, "EXPECTED_OBJECT", path, "Expected a plain declarative object.");
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addError(report, "UNKNOWN_FIELD", `${path}.${key}`, `Unknown field "${key}".`);
    }
  }
  return true;
}

function scanUnsafe(value, report, path = "$", depth = 0) {
  if (depth > 32) {
    addError(report, "MAX_DEPTH", path, "Treatment data exceeds 32 levels.");
    return;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    addError(report, "NON_FINITE_NUMBER", path, "Treatment numbers must be finite.");
    return;
  }
  if (typeof value === "string" && REMOTE_OR_EXECUTABLE_TEXT.test(value)) {
    addError(
      report,
      "REMOTE_OR_EXECUTABLE_TEXT",
      path,
      "Remote, data, file, blob, and executable URL text is not allowed."
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (FORBIDDEN_KEYS.has(key)) {
      addError(
        report,
        "FORBIDDEN_KEY",
        nextPath,
        `"${key}" is outside the declarative presentation boundary.`
      );
    }
    scanUnsafe(entry, report, nextPath, depth + 1);
  }
}

function validateNumber(value, bounds, report, path) {
  if (
    !Number.isFinite(value) ||
    value < bounds[0] ||
    value > bounds[1]
  ) {
    addError(
      report,
      "NUMBER_OUT_OF_RANGE",
      path,
      `Expected a finite number from ${bounds[0]} through ${bounds[1]}.`
    );
  }
}

function validateColorRole(role, palette, report, path) {
  if (!COLOR_ROLES.includes(role)) {
    addError(report, "UNKNOWN_COLOR_ROLE", path, `Unknown color role "${role}".`);
  } else if (!(role in palette)) {
    addError(
      report,
      "MISSING_PALETTE_ROLE",
      path,
      `Palette does not define the "${role}" role.`
    );
  }
}

function validateMotion(motion, report, path) {
  const allowed = new Set(["kind", "speed", "amount"]);
  if (!checkFields(motion, allowed, report, path)) return;
  if (!MOTION_KINDS.includes(motion.kind)) {
    addError(report, "UNKNOWN_MOTION", `${path}.kind`, "Unknown motion kind.");
  }
  validateNumber(motion.speed, [0, 4], report, `${path}.speed`);
  validateNumber(motion.amount, [0, 1], report, `${path}.amount`);
}

function validateLayer(layer, palette, report, path) {
  if (!checkFields(layer, LAYER_FIELDS, report, path)) return;
  if (!PORTABLE_ID.test(layer.id ?? "")) {
    addError(report, "INVALID_LAYER_ID", `${path}.id`, "Layer ID is not portable.");
  }
  if (!LAYER_KINDS.includes(layer.kind)) {
    addError(report, "UNKNOWN_LAYER_KIND", `${path}.kind`, "Unknown layer kind.");
  }
  if (!BLEND_MODES.includes(layer.blendMode)) {
    addError(report, "UNKNOWN_BLEND_MODE", `${path}.blendMode`, "Unknown blend mode.");
  }
  validateColorRole(layer.colorRole, palette, report, `${path}.colorRole`);
  if (layer.secondaryColorRole !== undefined) {
    validateColorRole(
      layer.secondaryColorRole,
      palette,
      report,
      `${path}.secondaryColorRole`
    );
  }
  if (layer.mask !== undefined && !LAYER_MASKS.includes(layer.mask)) {
    addError(report, "UNKNOWN_LAYER_MASK", `${path}.mask`, "Unknown layer mask.");
  }
  for (const [field, bounds] of Object.entries(LAYER_NUMBER_BOUNDS)) {
    if (layer[field] !== undefined) {
      validateNumber(layer[field], bounds, report, `${path}.${field}`);
    }
  }
  if (layer.pattern !== undefined && !PATTERNS.includes(layer.pattern)) {
    addError(report, "UNKNOWN_PATTERN", `${path}.pattern`, "Unknown bounded pattern.");
  }
  if (layer.motion !== undefined) {
    validateMotion(layer.motion, report, `${path}.motion`);
  }
}

function validateLight(light, palette, report, path) {
  if (!checkFields(light, LIGHT_FIELDS, report, path)) return;
  validateColorRole(light.colorRole, palette, report, `${path}.colorRole`);
  validateNumber(light.intensity, [0, 2], report, `${path}.intensity`);
  if (light.directionDegrees !== undefined) {
    validateNumber(
      light.directionDegrees,
      [0, 360],
      report,
      `${path}.directionDegrees`
    );
  }
  if (light.softness !== undefined) {
    validateNumber(light.softness, [0, 1], report, `${path}.softness`);
  }
}

function validateLightingRig(rig, palette, report, path) {
  if (!checkFields(rig, LIGHTING_FIELDS, report, path)) return;
  if (rig.version !== "1.0") {
    addError(report, "UNSUPPORTED_LIGHTING_VERSION", `${path}.version`, "Expected version 1.0.");
  }
  for (const name of ["ambient", "key", "fill", "rim"]) {
    if (!rig[name]) {
      addError(report, "MISSING_LIGHT", `${path}.${name}`, `${name} light is required.`);
    } else {
      validateLight(rig[name], palette, report, `${path}.${name}`);
    }
  }
  if (
    checkFields(
      rig.shadows,
      new Set(["strength", "softness"]),
      report,
      `${path}.shadows`
    )
  ) {
    validateNumber(rig.shadows.strength, [0, 1], report, `${path}.shadows.strength`);
    validateNumber(rig.shadows.softness, [0, 1], report, `${path}.shadows.softness`);
  }
  if (
    checkFields(
      rig.bloom,
      new Set(["intensity", "threshold", "radius"]),
      report,
      `${path}.bloom`
    )
  ) {
    validateNumber(rig.bloom.intensity, [0, 1], report, `${path}.bloom.intensity`);
    validateNumber(rig.bloom.threshold, [0, 1], report, `${path}.bloom.threshold`);
    validateNumber(rig.bloom.radius, [0, 64], report, `${path}.bloom.radius`);
  }
  if (
    checkFields(
      rig.haze,
      new Set(["colorRole", "density"]),
      report,
      `${path}.haze`
    )
  ) {
    validateColorRole(rig.haze.colorRole, palette, report, `${path}.haze.colorRole`);
    validateNumber(rig.haze.density, [0, 1], report, `${path}.haze.density`);
  }
  validateNumber(rig.exposure, [0.5, 2], report, `${path}.exposure`);
  validateNumber(rig.contrast, [0.5, 2], report, `${path}.contrast`);
}

function targetIsPresentationOnly(target) {
  const segments = String(target).toLowerCase().split(/[._-]+/);
  return !segments.some((segment) => FORBIDDEN_TARGET_SEGMENTS.has(segment));
}

export function validateTreatmentMold(mold) {
  const report = createReport();
  try {
    assertSafeObjectTree(mold);
  } catch (cause) {
    addError(report, "UNSAFE_DATA_TREE", "$", cause.message);
    return report;
  }
  scanUnsafe(mold, report);
  if (!checkFields(mold, MOLD_FIELDS, report, "$")) return report;

  if (mold.type !== "axm.treatment-mold") {
    addError(report, "INVALID_TYPE", "$.type", "Expected axm.treatment-mold.");
  }
  if (mold.version !== "1.0") {
    addError(report, "UNSUPPORTED_VERSION", "$.version", "Expected version 1.0.");
  }
  if (!PORTABLE_ID.test(mold.id ?? "")) {
    addError(report, "INVALID_MOLD_ID", "$.id", "Mold ID is not portable.");
  }
  if (!String(mold.name ?? "").trim() || String(mold.name).length > 80) {
    addError(report, "INVALID_NAME", "$.name", "Name must contain 1 through 80 characters.");
  }
  if (!["DRAFT", "WORKING_TEST", "TEST_HOLD_REVIEW"].includes(mold.status)) {
    addError(report, "INVALID_STATUS", "$.status", "Treatment molds cannot self-promote.");
  }
  if (!Array.isArray(mold.targets) || !mold.targets.length || mold.targets.length > 33) {
    addError(report, "INVALID_TARGETS", "$.targets", "Expected 1 through 33 targets.");
  } else {
    const seen = new Set();
    mold.targets.forEach((target, index) => {
      if (!PORTABLE_ID.test(target) || !target.includes(".")) {
        addError(
          report,
          "INVALID_TARGET",
          `$.targets[${index}]`,
          "Target must be a portable semantic presentation ID."
        );
      }
      if (!targetIsPresentationOnly(target)) {
        addError(
          report,
          "NON_PRESENTATION_TARGET",
          `$.targets[${index}]`,
          "Treatment targets cannot address authoritative or gameplay state."
        );
      }
      if (seen.has(target)) {
        addError(report, "DUPLICATE_TARGET", `$.targets[${index}]`, "Targets must be unique.");
      }
      seen.add(target);
    });
  }
  if (!TREATMENT_PROFILES[mold.defaultProfile]) {
    addError(report, "UNKNOWN_PROFILE", "$.defaultProfile", "Unknown treatment profile.");
  }

  if (!mold.palette || typeof mold.palette !== "object" || Array.isArray(mold.palette)) {
    addError(report, "INVALID_PALETTE", "$.palette", "Palette must be an object.");
  } else {
    for (const role of COLOR_ROLES) {
      if (!HEX_COLOR.test(mold.palette[role] ?? "")) {
        addError(
          report,
          "INVALID_PALETTE_COLOR",
          `$.palette.${role}`,
          `Palette role "${role}" requires a six-digit color.`
        );
      }
    }
    for (const role of Object.keys(mold.palette)) {
      if (!COLOR_ROLES.includes(role)) {
        addError(report, "UNKNOWN_PALETTE_ROLE", `$.palette.${role}`, "Unknown palette role.");
      }
    }
  }

  if (checkFields(mold.legacy, LEGACY_FIELDS, report, "$.legacy")) {
    if (
      checkFields(
        mold.legacy.colors,
        LEGACY_COLOR_FIELDS,
        report,
        "$.legacy.colors"
      )
    ) {
      for (const colorField of LEGACY_COLOR_FIELDS) {
        validateColorRole(
          mold.legacy.colors[colorField],
          mold.palette ?? {},
          report,
          `$.legacy.colors.${colorField}`
        );
      }
    }
    for (const [field, bounds] of Object.entries(MATERIAL_NUMBER_BOUNDS)) {
      if (mold.legacy[field] !== undefined) {
        validateNumber(mold.legacy[field], bounds, report, `$.legacy.${field}`);
      }
    }
    if (mold.legacy.pattern !== undefined) {
      if (
        checkFields(
          mold.legacy.pattern,
          new Set(["kind", "strength", "scale"]),
          report,
          "$.legacy.pattern"
        )
      ) {
        if (
          typeof mold.legacy.pattern.kind !== "string" ||
          mold.legacy.pattern.kind.length > 48
        ) {
          addError(
            report,
            "INVALID_LEGACY_PATTERN",
            "$.legacy.pattern.kind",
            "Legacy pattern kind must be a short declarative name."
          );
        }
        validateNumber(
          mold.legacy.pattern.strength,
          [0, 1],
          report,
          "$.legacy.pattern.strength"
        );
        validateNumber(
          mold.legacy.pattern.scale,
          [0.1, 16],
          report,
          "$.legacy.pattern.scale"
        );
      }
    }
  }

  if (
    checkFields(
      mold.effectStack,
      new Set(["version", "layers"]),
      report,
      "$.effectStack"
    )
  ) {
    if (mold.effectStack.version !== "1.0") {
      addError(
        report,
        "UNSUPPORTED_EFFECT_VERSION",
        "$.effectStack.version",
        "Expected version 1.0."
      );
    }
    if (
      !Array.isArray(mold.effectStack.layers) ||
      !mold.effectStack.layers.length ||
      mold.effectStack.layers.length > 8
    ) {
      addError(
        report,
        "INVALID_EFFECT_LAYERS",
        "$.effectStack.layers",
        "Expected 1 through 8 effect layers."
      );
    } else {
      const layerIds = new Set();
      mold.effectStack.layers.forEach((layer, index) => {
        validateLayer(layer, mold.palette ?? {}, report, `$.effectStack.layers[${index}]`);
        if (layerIds.has(layer.id)) {
          addError(
            report,
            "DUPLICATE_LAYER_ID",
            `$.effectStack.layers[${index}].id`,
            "Layer IDs must be unique."
          );
        }
        layerIds.add(layer.id);
      });
    }
  }

  if (mold.lightingRig !== undefined) {
    validateLightingRig(mold.lightingRig, mold.palette ?? {}, report, "$.lightingRig");
  }

  if (checkFields(mold.constraints, CONSTRAINT_FIELDS, report, "$.constraints")) {
    validateNumber(mold.constraints.maxLayers, [1, 8], report, "$.constraints.maxLayers");
    validateNumber(
      mold.constraints.maxEffectCost,
      [0, 20],
      report,
      "$.constraints.maxEffectCost"
    );
    validateNumber(
      mold.constraints.minimumTextContrast,
      [1, 21],
      report,
      "$.constraints.minimumTextContrast"
    );
    for (const field of ["preserveGameplayCues", "reducedMotionFallback"]) {
      if (typeof mold.constraints[field] !== "boolean") {
        addError(
          report,
          "EXPECTED_BOOLEAN",
          `$.constraints.${field}`,
          `${field} must be boolean.`
        );
      }
    }
  }

  if (checkFields(mold.provenance, PROVENANCE_FIELDS, report, "$.provenance")) {
    if (!String(mold.provenance.origin ?? "").trim()) {
      addError(report, "MISSING_ORIGIN", "$.provenance.origin", "Origin is required.");
    }
    if (!String(mold.provenance.creator ?? "").trim()) {
      addError(report, "MISSING_CREATOR", "$.provenance.creator", "Creator is required.");
    }
    if (typeof mold.provenance.remixAllowed !== "boolean") {
      addError(
        report,
        "EXPECTED_BOOLEAN",
        "$.provenance.remixAllowed",
        "remixAllowed must be boolean."
      );
    }
  }

  if (report.ok) {
    report.checks.push(
      {
        code: "DECLARATIVE_ONLY",
        message: "No executable, remote, authoritative, or gameplay fields were found."
      },
      {
        code: "FINITE_BOUNDS",
        message: "Materials, layers, lighting, motion, and performance limits are bounded."
      },
      {
        code: "EXPLICIT_PROMOTION",
        message: "The mold can generate drafts but contains no save, apply, or promotion action."
      }
    );
  }
  return report;
}

export function listTreatmentMolds() {
  return clone(TREATMENT_MOLDS);
}

export function getTreatmentMold(id) {
  const mold = TREATMENT_MOLD_BY_ID.get(String(id));
  return mold ? clone(mold) : null;
}

function resolveMold(moldOrId) {
  const mold =
    typeof moldOrId === "string" ? getTreatmentMold(moldOrId) : clone(moldOrId);
  if (!mold) throw new RangeError(`Unknown treatment mold: ${moldOrId}`);
  const validation = validateTreatmentMold(mold);
  if (!validation.ok) {
    const first = validation.errors[0];
    throw new TypeError(
      `Invalid treatment mold at ${first?.path ?? "$"}: ${first?.message ?? "unknown error"}`
    );
  }
  return mold;
}

function rotatePalette(palette, directionIndex) {
  const next = clone(palette);
  if (directionIndex === 1) {
    next.primary = palette.secondary;
    next.secondary = palette.accent;
    next.accent = palette.primary;
  } else if (directionIndex === 2) {
    next.primary = palette.accent;
    next.secondary = palette.primary;
    next.accent = palette.secondary;
  }
  return next;
}

function resolvePalette(base, overrides, directionIndex) {
  const palette = rotatePalette(base, directionIndex);
  for (const [role, value] of Object.entries(overrides ?? {})) {
    if (!COLOR_ROLES.includes(role)) {
      throw new RangeError(`Unknown treatment palette role: ${role}`);
    }
    if (!HEX_COLOR.test(value)) {
      throw new TypeError(`Treatment palette role ${role} requires #RRGGBB.`);
    }
    palette[role] = value.toLowerCase();
  }
  return palette;
}

function varied(value, bounds, random, amount) {
  if (!Number.isFinite(value)) return value;
  const span = bounds[1] - bounds[0];
  return Number(
    clamp(value + (random() * 2 - 1) * span * amount, bounds[0], bounds[1]).toFixed(4)
  );
}

function compileLegacyMaterial(mold, palette, random, variation, intensity) {
  const material = {};
  for (const [field, role] of Object.entries(mold.legacy.colors)) {
    material[field] = palette[role];
  }
  for (const [field, bounds] of Object.entries(MATERIAL_NUMBER_BOUNDS)) {
    if (mold.legacy[field] === undefined) continue;
    const variableFields = new Set([
      "metallic",
      "roughness",
      "gloss",
      "clearcoat",
      "sheen",
      "iridescence",
      "emissiveStrength",
      "glowIntensity",
      "glowRadius",
      "grain"
    ]);
    const amount = variableFields.has(field) ? variation : 0;
    material[field] = varied(mold.legacy[field], bounds, random, amount);
  }
  material.glowIntensity = Number(
    clamp(material.glowIntensity * (0.65 + intensity * 0.45), 0, 1).toFixed(4)
  );
  material.emissiveStrength = Number(
    clamp(material.emissiveStrength * (0.7 + intensity * 0.4), 0, 2).toFixed(4)
  );
  material.pattern = clone(mold.legacy.pattern);
  material.patternScale = material.pattern?.scale ?? material.patternScale ?? 1;
  return material;
}

function compileLayer(layer, palette, random, variation, intensity) {
  const output = clone(layer);
  output.color = palette[layer.colorRole];
  if (layer.secondaryColorRole) {
    output.secondaryColor = palette[layer.secondaryColorRole];
  }
  for (const [field, bounds] of Object.entries(LAYER_NUMBER_BOUNDS)) {
    if (output[field] === undefined) continue;
    const amount = ["intensity", "radius", "spread", "softness"].includes(field)
      ? variation
      : 0;
    output[field] = varied(output[field], bounds, random, amount);
  }
  if (Number.isFinite(output.intensity)) {
    output.intensity = Number(
      clamp(output.intensity * (0.7 + intensity * 0.4), 0, 1).toFixed(4)
    );
  }
  return output;
}

function compileLight(light, palette, random, variation, intensity) {
  const output = clone(light);
  output.color = palette[light.colorRole];
  output.intensity = varied(output.intensity, [0, 2], random, variation);
  output.intensity = Number(
    clamp(output.intensity * (0.72 + intensity * 0.38), 0, 2).toFixed(4)
  );
  return output;
}

function compileLightingRig(rig, palette, random, variation, intensity) {
  if (!rig) return null;
  const output = {
    version: "1.0",
    ambient: compileLight(rig.ambient, palette, random, variation, intensity),
    key: compileLight(rig.key, palette, random, variation, intensity),
    fill: compileLight(rig.fill, palette, random, variation, intensity),
    rim: compileLight(rig.rim, palette, random, variation, intensity),
    shadows: clone(rig.shadows),
    bloom: clone(rig.bloom),
    haze: {
      ...clone(rig.haze),
      color: palette[rig.haze.colorRole]
    },
    exposure: rig.exposure,
    contrast: rig.contrast
  };
  output.bloom.intensity = varied(
    output.bloom.intensity,
    [0, 1],
    random,
    variation
  );
  output.bloom.radius = varied(output.bloom.radius, [0, 64], random, variation);
  output.haze.density = varied(output.haze.density, [0, 1], random, variation);
  return output;
}

function pushCapChange(changes, path, requested, applied, reason) {
  if (requested === applied) return;
  changes.push({ path, requested, applied, reason });
}

function capNumber(object, field, maximum, changes, path, reason) {
  if (!Number.isFinite(object?.[field])) return;
  const requested = object[field];
  object[field] = Number(clamp(requested, 0, maximum).toFixed(4));
  pushCapChange(changes, `${path}.${field}`, requested, object[field], reason);
}

function applyProfile(material, profile, constraints) {
  const output = clone(material);
  const changes = [];
  capNumber(
    output,
    "glowIntensity",
    profile.maxGlowIntensity,
    changes,
    "$.legacy",
    `${profile.id} glow cap`
  );
  capNumber(
    output,
    "glowRadius",
    profile.maxGlowRadius,
    changes,
    "$.legacy",
    `${profile.id} glow radius cap`
  );
  capNumber(
    output,
    "emissiveStrength",
    profile.maxEmissiveStrength,
    changes,
    "$.legacy",
    `${profile.id} emissive cap`
  );

  const maxLayers = Math.min(profile.maxLayers, constraints.maxLayers);
  const maxCost = Math.min(profile.maxEffectCost, constraints.maxEffectCost);
  const kept = [];
  let cost = 0;
  let animated = 0;
  for (const sourceLayer of output.effectStack?.layers ?? []) {
    if (kept.length >= maxLayers) {
      changes.push({
        path: `$.effectStack.layers.${sourceLayer.id}`,
        requested: "enabled",
        applied: "omitted",
        reason: `${profile.id} layer-count cap`
      });
      continue;
    }
    const layer = clone(sourceLayer);
    capNumber(
      layer,
      "radius",
      profile.maxGlowRadius,
      changes,
      `$.effectStack.layers.${layer.id}`,
      `${profile.id} radius cap`
    );
    if (layer.kind === "bloom") {
      capNumber(
        layer,
        "intensity",
        profile.maxBloomIntensity,
        changes,
        `$.effectStack.layers.${layer.id}`,
        `${profile.id} bloom cap`
      );
    }
    if (layer.kind === "haze") {
      capNumber(
        layer,
        "intensity",
        profile.maxHazeDensity,
        changes,
        `$.effectStack.layers.${layer.id}`,
        `${profile.id} haze cap`
      );
    }
    if (layer.motion?.kind && layer.motion.kind !== "none") {
      if (animated >= profile.maxAnimatedLayers) {
        const requested = clone(layer.motion);
        layer.motion = { kind: "none", speed: 0, amount: 0 };
        changes.push({
          path: `$.effectStack.layers.${layer.id}.motion`,
          requested,
          applied: clone(layer.motion),
          reason: `${profile.id} motion cap`
        });
      } else {
        animated += 1;
      }
    }
    const layerCost = LAYER_COST[layer.kind] ?? 1;
    if (layerCost > 0 && cost + layerCost > maxCost) {
      changes.push({
        path: `$.effectStack.layers.${layer.id}`,
        requested: "enabled",
        applied: "omitted",
        reason: `${profile.id} effect-cost cap`
      });
      continue;
    }
    cost += layerCost;
    kept.push(layer);
  }
  output.effectStack.layers = kept;

  if (profile.maxAnimatedLayers === 0) {
    for (const field of ["pulseSpeed", "shimmerSpeed"]) {
      if (Number(output[field] ?? 0) !== 0) {
        const requested = output[field];
        output[field] = 0;
        pushCapChange(
          changes,
          `$.legacy.${field}`,
          requested,
          0,
          `${profile.id} motion cap`
        );
      }
    }
  }

  if (output.lightingRig) {
    for (const lightName of ["ambient", "key", "fill", "rim"]) {
      capNumber(
        output.lightingRig[lightName],
        "intensity",
        profile.maxLightIntensity,
        changes,
        `$.lightingRig.${lightName}`,
        `${profile.id} light cap`
      );
    }
    capNumber(
      output.lightingRig.bloom,
      "intensity",
      profile.maxBloomIntensity,
      changes,
      "$.lightingRig.bloom",
      `${profile.id} bloom cap`
    );
    capNumber(
      output.lightingRig.bloom,
      "radius",
      profile.maxGlowRadius,
      changes,
      "$.lightingRig.bloom",
      `${profile.id} bloom-radius cap`
    );
    capNumber(
      output.lightingRig.haze,
      "density",
      profile.maxHazeDensity,
      changes,
      "$.lightingRig.haze",
      `${profile.id} haze cap`
    );
  }

  return {
    material: output,
    receipt: {
      profile: profile.id,
      maxLayers,
      maxEffectCost: maxCost,
      appliedLayers: kept.length,
      appliedEffectCost: cost,
      animatedLayers: animated,
      changes
    }
  };
}

function requestedTargets(mold, targets) {
  const requested = targets ? [...new Set(targets.map(String))] : [...mold.targets];
  for (const target of requested) {
    if (!mold.targets.includes(target)) {
      throw new RangeError(
        `Treatment target ${target} is outside mold ${mold.id}.`
      );
    }
  }
  if (!requested.length) throw new RangeError("A treatment requires at least one target.");
  return requested;
}

export function instantiateTreatmentMold(moldOrId, options = {}) {
  const mold = resolveMold(moldOrId);
  const profileId = String(options.profile ?? mold.defaultProfile);
  const profile = TREATMENT_PROFILES[profileId];
  if (!profile) throw new RangeError(`Unknown treatment profile: ${profileId}`);
  const seed = String(options.seed ?? `treatment:${mold.id}`).slice(0, 120);
  const directionIndex = Math.trunc(clamp(options.directionIndex ?? 0, 0, 2));
  const variation = clamp(
    options.variation ?? (mold.id === "accessible-night-edge" ? 0.025 : 0.06),
    0,
    0.2
  );
  const intensity = clamp(options.intensity ?? 0.72);
  const targets = requestedTargets(mold, options.targets);
  const palette = resolvePalette(mold.palette, options.palette, directionIndex);
  const random = seededRandom(
    `axm.treatment-forge.v1:${mold.id}:${seed}:${directionIndex}:${profileId}`
  );
  const materials = {};
  const profileReceipts = [];

  for (const target of targets) {
    const material = compileLegacyMaterial(
      mold,
      palette,
      random,
      variation,
      intensity
    );
    material.effectStack = {
      version: "1.0",
      layers: mold.effectStack.layers.map((layer) =>
        compileLayer(layer, palette, random, variation, intensity)
      ),
      fallback: "legacy-material-fields"
    };
    if (target === "world.lighting" && mold.lightingRig) {
      material.lightingRig = compileLightingRig(
        mold.lightingRig,
        palette,
        random,
        variation,
        intensity
      );
    }
    const profiled = applyProfile(material, profile, mold.constraints);
    materials[target] = profiled.material;
    profileReceipts.push({ target, ...profiled.receipt });
  }

  const suffix = hash32(
    `${mold.id}:${seed}:${directionIndex}:${profileId}:${stableStringify(palette)}`
  )
    .toString(16)
    .padStart(8, "0");
  const directionLabels = ["Foundation", "Prism Shift", "Accent Inversion"];
  const treatment = {
    type: "axm.treatment",
    version: "1.0",
    id: `treatment.${slugify(mold.id)}.${suffix}`,
    status: "DRAFT",
    name: `${mold.name} · ${directionLabels[directionIndex]}`,
    mold: { id: mold.id, version: mold.version },
    seed,
    direction: {
      index: directionIndex,
      label: directionLabels[directionIndex]
    },
    profile: profileId,
    targets,
    palette,
    materials,
    accessibility: {
      minimumTextContrast: mold.constraints.minimumTextContrast,
      preserveGameplayCues: mold.constraints.preserveGameplayCues,
      reducedMotionSafe: profile.maxAnimatedLayers === 0,
      colorIsNotOnlySignal: true
    },
    provenance: {
      origin: "deterministic-treatment-mold",
      creator: mold.provenance.creator,
      license: mold.provenance.license,
      remixAllowed: mold.provenance.remixAllowed,
      variation,
      intensity,
      saved: false,
      runtimeApplied: false,
      promoted: false,
      automaticWrites: 0
    }
  };

  return {
    treatment,
    receipt: {
      type: "axm.treatment-instantiation-receipt",
      version: "1.0",
      moldId: mold.id,
      treatmentId: treatment.id,
      seed,
      direction: directionIndex,
      profile: profileId,
      targets,
      profileReceipts,
      saved: false,
      runtimeApplied: false,
      promoted: false,
      automaticWrites: 0
    }
  };
}

export function generateTreatmentDirections(moldOrId, options = {}) {
  const mold = resolveMold(moldOrId);
  const seed = String(options.seed ?? `directions:${mold.id}`).slice(0, 120);
  const results = [0, 1, 2].map((directionIndex) =>
    instantiateTreatmentMold(mold, {
      ...options,
      seed,
      directionIndex
    })
  );
  const directions = results.map((result) => result.treatment);
  const distinct = new Set(
    directions.map((direction) =>
      stableStringify({
        palette: direction.palette,
        materials: direction.materials
      })
    )
  ).size;
  if (distinct !== 3) {
    throw new Error("Treatment direction generation failed to produce three distinct drafts.");
  }
  return {
    directions,
    receipt: {
      type: "axm.treatment-direction-receipt",
      version: "1.0",
      moldId: mold.id,
      seed,
      count: 3,
      distinct,
      directionIds: directions.map((direction) => direction.id),
      selected: null,
      saved: false,
      runtimeApplied: false,
      promoted: false,
      automaticWrites: 0
    }
  };
}

function validateTreatmentObject(treatment) {
  const report = createReport();
  try {
    assertSafeObjectTree(treatment);
  } catch (cause) {
    addError(report, "UNSAFE_DATA_TREE", "$", cause.message);
    return report;
  }
  scanUnsafe(treatment, report);
  if (!treatment || treatment.type !== "axm.treatment" || treatment.version !== "1.0") {
    addError(report, "INVALID_TREATMENT", "$", "Expected an axm.treatment version 1.0.");
    return report;
  }
  if (!Array.isArray(treatment.targets) || !treatment.targets.length) {
    addError(report, "INVALID_TARGETS", "$.targets", "Treatment requires targets.");
  }
  for (const target of treatment.targets ?? []) {
    if (!targetIsPresentationOnly(target)) {
      addError(
        report,
        "NON_PRESENTATION_TARGET",
        "$.targets",
        "Treatment targets must remain presentation-only."
      );
    }
    const material = treatment.materials?.[target];
    if (!material || typeof material !== "object") {
      addError(
        report,
        "MISSING_TREATMENT_MATERIAL",
        `$.materials.${target}`,
        "Every target requires a compiled treatment material."
      );
      continue;
    }
    for (const [field, bounds] of Object.entries(MATERIAL_NUMBER_BOUNDS)) {
      if (material[field] !== undefined) {
        validateNumber(material[field], bounds, report, `$.materials.${target}.${field}`);
      }
    }
    for (const colorField of LEGACY_COLOR_FIELDS) {
      if (!HEX_COLOR.test(material[colorField] ?? "")) {
        addError(
          report,
          "INVALID_MATERIAL_COLOR",
          `$.materials.${target}.${colorField}`,
          "Compiled treatment colors require #RRGGBB."
        );
      }
    }
    if (!Array.isArray(material.effectStack?.layers)) {
      addError(
        report,
        "MISSING_EFFECT_STACK",
        `$.materials.${target}.effectStack`,
        "Compiled treatment requires an effect stack."
      );
    }
  }
  return report;
}

function uniqueMaterialId(materials, target, treatmentId) {
  const suffix = hash32(`${target}:${treatmentId}`).toString(16).padStart(8, "0");
  const base = `treatment.${slugify(target)}.${suffix}`.slice(0, 127);
  if (!materials[base]) return base;
  return base;
}

function monotonicAccessibility(base, treatment) {
  return {
    ...(base ?? {}),
    minimumTextContrast: Math.max(
      Number(base?.minimumTextContrast ?? 1),
      Number(treatment?.minimumTextContrast ?? 1)
    ),
    preserveGameplayCues:
      Boolean(base?.preserveGameplayCues) ||
      Boolean(treatment?.preserveGameplayCues),
    reducedMotionSafe:
      Boolean(base?.reducedMotionSafe) ||
      Boolean(treatment?.reducedMotionSafe),
    colorIsNotOnlySignal:
      Boolean(base?.colorIsNotOnlySignal) ||
      Boolean(treatment?.colorIsNotOnlySignal)
  };
}

export function applyTreatmentToPack(pack, treatmentInput, options = {}) {
  if (!pack || pack.type !== "axm.skin-pack" || pack.version !== "1.0") {
    throw new TypeError("Treatment application requires an axm.skin-pack version 1.0.");
  }
  const treatment = clone(treatmentInput?.treatment ?? treatmentInput);
  const validation = validateTreatmentObject(treatment);
  if (!validation.ok) {
    const first = validation.errors[0];
    throw new TypeError(
      `Invalid treatment at ${first?.path ?? "$"}: ${first?.message ?? "unknown error"}`
    );
  }
  const targets = options.targets
    ? [...new Set(options.targets.map(String))]
    : [...treatment.targets];
  for (const target of targets) {
    if (!treatment.targets.includes(target)) {
      throw new RangeError(`Treatment ${treatment.id} does not declare target ${target}.`);
    }
  }

  const output = clone(pack);
  output.materials = output.materials ?? {};
  output.bindings = output.bindings ?? [];
  const applied = [];
  const skipped = [];

  for (const target of targets) {
    const targetBindings = output.bindings.filter((binding) => binding.target === target);
    if (!targetBindings.length) {
      skipped.push({ target, reason: "pack has no matching binding" });
      continue;
    }
    const patch = treatment.materials[target];
    const sourceMaterialId = targetBindings[0].material;
    const sourceMaterial = output.materials[sourceMaterialId];
    if (!sourceMaterial) {
      skipped.push({ target, reason: `missing source material ${sourceMaterialId}` });
      continue;
    }
    const nextMaterialId = uniqueMaterialId(output.materials, target, treatment.id);
    output.materials[nextMaterialId] = {
      ...clone(sourceMaterial),
      ...clone(patch)
    };
    for (const binding of targetBindings) binding.material = nextMaterialId;
    applied.push({
      target,
      previousMaterial: sourceMaterialId,
      material: nextMaterialId
    });
  }

  output.capabilities = [
    ...new Set([...(output.capabilities ?? []), "treatment-stack.v1"])
  ].sort();
  output.accessibility = monotonicAccessibility(
    output.accessibility,
    treatment.accessibility
  );
  output.integrity = null;
  output.provenance = {
    ...(output.provenance ?? {}),
    treatmentApplications: [
      ...(output.provenance?.treatmentApplications ?? []),
      {
        treatmentId: treatment.id,
        moldId: treatment.mold.id,
        targets: applied.map((entry) => entry.target),
        seed: treatment.seed,
        profile: treatment.profile,
        saved: false,
        runtimeApplied: false,
        promoted: false,
        automaticWrites: 0
      }
    ]
  };

  return {
    pack: output,
    receipt: {
      type: "axm.treatment-application-receipt",
      version: "1.0",
      packId: pack.id,
      treatmentId: treatment.id,
      applied,
      skipped,
      targetIsolation: true,
      statusPreserved: output.status === pack.status,
      saved: false,
      runtimeApplied: false,
      promoted: false,
      automaticWrites: 0
    }
  };
}
