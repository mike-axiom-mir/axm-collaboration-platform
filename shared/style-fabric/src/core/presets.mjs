import { mixHex } from "./color.mjs";
import { clamp, clone, deepMerge, hash32 } from "./stable.mjs";

export const PRESKIN_FAMILIES = Object.freeze([
  "AXM Identity",
  "Worlds",
  "Arcade",
  "Characters",
  "Atmosphere",
  "Clarity"
]);

const BASE_INTENT = Object.freeze({
  keywords: ["dark", "minimal"],
  intensity: 0.7,
  palette: {
    primary: "#38e8ff",
    secondary: "#7c5cff",
    accent: "#ff43c8"
  },
  material: {
    glowIntensity: 0.4,
    glowRadius: 20,
    gloss: 0.45,
    metallic: 0.15,
    roughness: 0.55,
    specular: 0.52,
    clearcoat: 0.1,
    sheen: 0.18,
    iridescence: 0,
    translucency: 0,
    grain: 0.12,
    weathering: 0,
    outlineWidth: 2,
    emissiveStrength: 0.5,
    pulseSpeed: 0.6,
    shimmerSpeed: 0.3
  },
  pattern: {
    kind: "none",
    strength: 0,
    scale: 1
  },
  geometry: {
    cornerRoundness: 0.6,
    silhouetteExaggeration: 0.25,
    detailDensity: 0.5
  },
  character: {
    silhouette: "balanced",
    headShape: "round",
    outfit: "modular",
    accessory: "none",
    proportion: 0.5
  },
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    minimumTextContrast: 4.5
  }
});

function define(id, name, family, tagline, patch) {
  const intent = deepMerge(BASE_INTENT, patch);
  return Object.freeze({
    id,
    name,
    family,
    tagline,
    swatches: Object.freeze([
      intent.palette.primary,
      intent.palette.secondary,
      intent.palette.accent
    ]),
    intent: Object.freeze(intent)
  });
}

export const PRESKINS = Object.freeze([
  define(
    "axm-balanced",
    "Balanced AXM",
    "AXM Identity",
    "Cyan clarity, violet depth, pink creative energy.",
    {
      keywords: ["dark", "neon", "minimal", "cool"],
      material: { glowIntensity: 0.66, gloss: 0.56, metallic: 0.22, roughness: 0.42 },
      pattern: { kind: "circuit", strength: 0.28, scale: 1.2 },
      geometry: { cornerRoundness: 0.66, detailDensity: 0.52 },
      character: { outfit: "future-tailored", accessory: "energy-sash" }
    }
  ),
  define(
    "axm-axiom-heavy",
    "Axiom-heavy",
    "AXM Identity",
    "Command gold, engineered violet, disciplined contrast.",
    {
      keywords: ["dark", "metallic", "royal", "high-contrast"],
      palette: { primary: "#f0a53a", secondary: "#7c5cff", accent: "#ffe08a" },
      material: {
        glowIntensity: 0.48,
        gloss: 0.72,
        metallic: 0.74,
        roughness: 0.23,
        clearcoat: 0.65
      },
      pattern: { kind: "royal-lines", strength: 0.32, scale: 1.4 },
      geometry: { cornerRoundness: 0.34, detailDensity: 0.7 },
      character: { silhouette: "tall", headShape: "helmet", outfit: "ceremonial", accessory: "cape" },
      accessibility: { highContrast: true }
    }
  ),
  define(
    "axm-mir-heavy",
    "Mir-heavy",
    "AXM Identity",
    "Living violet, cool intuition, holographic wonder.",
    {
      keywords: ["dark", "cosmic", "holographic", "glass", "cool"],
      palette: { primary: "#9c7dff", secondary: "#38e8ff", accent: "#ff43c8" },
      material: {
        glowIntensity: 0.75,
        gloss: 0.82,
        metallic: 0.38,
        roughness: 0.16,
        iridescence: 0.72,
        translucency: 0.34,
        sheen: 0.72
      },
      pattern: { kind: "holo-grid", strength: 0.46, scale: 0.85 },
      geometry: { cornerRoundness: 0.82, silhouetteExaggeration: 0.48 },
      character: { silhouette: "heroic-soft", headShape: "orb", accessory: "orbiting-charm" }
    }
  ),
  define(
    "axm-public-safe",
    "Public-safe AXM",
    "AXM Identity",
    "Grounded AXM identity with quiet effects and strong readability.",
    {
      keywords: ["dark", "minimal", "high-contrast", "cool"],
      palette: { primary: "#58d7e8", secondary: "#8d80e8", accent: "#f18dcf" },
      intensity: 0.55,
      material: {
        glowIntensity: 0.24,
        glowRadius: 12,
        gloss: 0.32,
        roughness: 0.68,
        outlineWidth: 3,
        pulseSpeed: 0.2,
        shimmerSpeed: 0
      },
      pattern: { kind: "circuit", strength: 0.1, scale: 1.6 },
      accessibility: { highContrast: true, minimumTextContrast: 7 }
    }
  ),
  define(
    "axm-experimental",
    "Experimental AXM",
    "AXM Identity",
    "Maximum visual play while authority stays locked.",
    {
      keywords: ["dark", "neon", "holographic", "glass", "cosmic"],
      palette: { primary: "#00f5ff", secondary: "#8b5cff", accent: "#ff2fb3" },
      intensity: 0.96,
      material: {
        glowIntensity: 0.92,
        glowRadius: 44,
        gloss: 0.9,
        metallic: 0.54,
        roughness: 0.1,
        iridescence: 0.94,
        translucency: 0.42,
        emissiveStrength: 1.65,
        shimmerSpeed: 1.5
      },
      pattern: { kind: "prism-weave", strength: 0.72, scale: 0.62 },
      geometry: { cornerRoundness: 0.74, silhouetteExaggeration: 0.7, detailDensity: 0.82 },
      character: { silhouette: "angular", headShape: "orb", outfit: "modular", accessory: "orbiting-charm" }
    }
  ),
  define(
    "world-verdant-canopy",
    "Verdant Canopy",
    "Worlds",
    "Layered forest greens with warm living highlights.",
    {
      keywords: ["dark", "nature", "forest", "matte"],
      palette: { primary: "#58c878", secondary: "#a6d978", accent: "#f0bd5c" },
      material: { roughness: 0.78, gloss: 0.18, grain: 0.42, sheen: 0.34 },
      pattern: { kind: "organic-cells", strength: 0.42, scale: 1.7 },
      geometry: { cornerRoundness: 0.78, silhouetteExaggeration: 0.4 },
      character: { silhouette: "heroic-soft", outfit: "paper-armor", accessory: "energy-sash" }
    }
  ),
  define(
    "world-cosmic-deep",
    "Cosmic Deep",
    "Worlds",
    "Deep-space violet, ion blue, and starfield shimmer.",
    {
      keywords: ["dark", "cosmic", "cool", "holographic"],
      palette: { primary: "#7956ff", secondary: "#14d9ff", accent: "#ff4aa8" },
      material: { glowIntensity: 0.72, iridescence: 0.52, roughness: 0.26 },
      pattern: { kind: "star-noise", strength: 0.58, scale: 0.72 },
      character: { headShape: "helmet", outfit: "future-tailored", accessory: "visor" }
    }
  ),
  define(
    "world-ember-foundry",
    "Ember Foundry",
    "Worlds",
    "Industrial iron, furnace orange, and restrained embers.",
    {
      keywords: ["dark", "industrial", "metallic", "lava", "warm"],
      palette: { primary: "#ff6a35", secondary: "#a83b2f", accent: "#ffc247" },
      material: {
        metallic: 0.78,
        roughness: 0.48,
        weathering: 0.62,
        glowIntensity: 0.58,
        emissiveStrength: 1.2
      },
      pattern: { kind: "embers", strength: 0.48, scale: 1.25 },
      geometry: { cornerRoundness: 0.2, detailDensity: 0.76 },
      character: { silhouette: "angular", headShape: "helmet", outfit: "modular", accessory: "visor" }
    }
  ),
  define(
    "world-oceanic-glass",
    "Oceanic Glass",
    "Worlds",
    "Aqua depth, sea-glass surfaces, and gentle wave motion.",
    {
      keywords: ["dark", "ocean", "glass", "cool"],
      palette: { primary: "#20d8d2", secondary: "#2776d6", accent: "#8af6ff" },
      material: {
        gloss: 0.86,
        roughness: 0.12,
        translucency: 0.58,
        iridescence: 0.28,
        clearcoat: 0.72
      },
      pattern: { kind: "waves", strength: 0.45, scale: 1.5 },
      geometry: { cornerRoundness: 0.86 },
      character: { silhouette: "tall", headShape: "orb", outfit: "future-tailored" }
    }
  ),
  define(
    "world-paper-kingdom",
    "Paper Kingdom",
    "Worlds",
    "Hand-cut color, warm fiber, and storybook character shapes.",
    {
      keywords: ["light", "paper", "cartoon", "royal", "warm"],
      palette: { primary: "#e94f67", secondary: "#4ba3c7", accent: "#f3b940" },
      material: { glowIntensity: 0.08, gloss: 0.12, roughness: 0.9, grain: 0.75, outlineWidth: 4 },
      pattern: { kind: "paper-fiber", strength: 0.72, scale: 1.1 },
      geometry: { cornerRoundness: 0.46, silhouetteExaggeration: 0.76, detailDensity: 0.58 },
      character: { silhouette: "heroic-soft", headShape: "round", outfit: "paper-armor", accessory: "cape" }
    }
  ),
  define(
    "arcade-neon-circuit",
    "Neon Circuit",
    "Arcade",
    "Fast cyan-magenta energy over a readable dark arena.",
    {
      keywords: ["dark", "neon", "cool", "high-contrast"],
      palette: { primary: "#25e6ff", secondary: "#7f5cff", accent: "#ff3fae" },
      material: { glowIntensity: 0.84, glowRadius: 34, emissiveStrength: 1.4, roughness: 0.28 },
      pattern: { kind: "circuit", strength: 0.54, scale: 0.78 },
      geometry: { cornerRoundness: 0.32, detailDensity: 0.7 },
      character: { silhouette: "angular", outfit: "street-tech", accessory: "visor" },
      accessibility: { highContrast: true }
    }
  ),
  define(
    "arcade-pixel-sunset",
    "Pixel Sunset",
    "Arcade",
    "Chunky pixels in electric dusk colors.",
    {
      keywords: ["dark", "pixel", "retro", "warm"],
      palette: { primary: "#ff7a50", secondary: "#7c4dff", accent: "#ffd64a" },
      material: { glowIntensity: 0.42, gloss: 0.22, roughness: 0.72, outlineWidth: 3 },
      pattern: { kind: "pixel-grid", strength: 0.64, scale: 0.48 },
      geometry: { cornerRoundness: 0.05, detailDensity: 0.34 },
      character: { silhouette: "compact", headShape: "square", outfit: "street-tech" }
    }
  ),
  define(
    "arcade-chrome-royale",
    "Chrome Royale",
    "Arcade",
    "High-score glamour in polished chrome and jewel color.",
    {
      keywords: ["dark", "metallic", "luxury", "royal"],
      palette: { primary: "#d9e5f6", secondary: "#704cff", accent: "#ffbe3d" },
      material: {
        metallic: 0.96,
        gloss: 0.88,
        roughness: 0.08,
        specular: 0.92,
        clearcoat: 0.86,
        glowIntensity: 0.38
      },
      pattern: { kind: "royal-lines", strength: 0.38, scale: 0.9 },
      geometry: { cornerRoundness: 0.38, detailDensity: 0.8 },
      character: { silhouette: "tall", outfit: "ceremonial", accessory: "cape" }
    }
  ),
  define(
    "arcade-candy-burst",
    "Candy Burst",
    "Arcade",
    "Playful candy color with bold readable outlines.",
    {
      keywords: ["light", "candy", "cartoon", "soft"],
      palette: { primary: "#ff5fa2", secondary: "#5bd8ff", accent: "#ffd84d" },
      material: { gloss: 0.66, roughness: 0.38, sheen: 0.52, glowIntensity: 0.26, outlineWidth: 5 },
      pattern: { kind: "candy-dots", strength: 0.46, scale: 1.35 },
      geometry: { cornerRoundness: 0.92, silhouetteExaggeration: 0.78 },
      character: { silhouette: "compact", headShape: "round", outfit: "modular", accessory: "orbiting-charm" }
    }
  ),
  define(
    "character-comic-vanguard",
    "Comic Vanguard",
    "Characters",
    "Heroic silhouette, inked edge, energetic primary colors.",
    {
      keywords: ["dark", "cartoon", "ink", "high-contrast"],
      palette: { primary: "#3c7cff", secondary: "#20c98b", accent: "#ffce3a" },
      material: { roughness: 0.68, gloss: 0.2, outlineWidth: 7, glowIntensity: 0.22 },
      pattern: { kind: "ink-hatch", strength: 0.4, scale: 0.82 },
      geometry: { silhouetteExaggeration: 0.9, cornerRoundness: 0.58 },
      character: { silhouette: "heroic-soft", headShape: "square", outfit: "paper-armor", accessory: "cape" },
      accessibility: { highContrast: true }
    }
  ),
  define(
    "character-street-tech-rogue",
    "Street-Tech Rogue",
    "Characters",
    "Angular street gear, selective neon, quick visual attitude.",
    {
      keywords: ["dark", "neon", "industrial", "weathered"],
      palette: { primary: "#28e0c0", secondary: "#5267ff", accent: "#ff556f" },
      material: { metallic: 0.38, roughness: 0.58, weathering: 0.34, glowIntensity: 0.6 },
      pattern: { kind: "scratches", strength: 0.3, scale: 0.9 },
      geometry: { cornerRoundness: 0.18, silhouetteExaggeration: 0.58, detailDensity: 0.78 },
      character: { silhouette: "angular", headShape: "helmet", outfit: "street-tech", accessory: "visor" }
    }
  ),
  define(
    "character-ceremonial-star",
    "Ceremonial Star",
    "Characters",
    "Regal proportions, polished trim, and orbiting light.",
    {
      keywords: ["dark", "luxury", "royal", "cosmic"],
      palette: { primary: "#a989ff", secondary: "#f0b34a", accent: "#63efff" },
      material: { metallic: 0.62, gloss: 0.78, clearcoat: 0.68, iridescence: 0.28, glowIntensity: 0.52 },
      pattern: { kind: "royal-lines", strength: 0.26, scale: 1.8 },
      geometry: { silhouetteExaggeration: 0.52, detailDensity: 0.82 },
      character: { silhouette: "tall", headShape: "orb", outfit: "ceremonial", accessory: "orbiting-charm", proportion: 0.68 }
    }
  ),
  define(
    "character-soft-hero",
    "Soft Hero",
    "Characters",
    "Friendly compact proportions with tactile clay softness.",
    {
      keywords: ["light", "soft", "clay", "cartoon"],
      palette: { primary: "#ef7f73", secondary: "#6bb7a8", accent: "#f2c45c" },
      material: { gloss: 0.18, roughness: 0.82, sheen: 0.38, grain: 0.26, outlineWidth: 3 },
      pattern: { kind: "clay-speckle", strength: 0.28, scale: 1.3 },
      geometry: { cornerRoundness: 0.96, silhouetteExaggeration: 0.66 },
      character: { silhouette: "compact", headShape: "round", outfit: "modular", accessory: "energy-sash", proportion: 0.34 }
    }
  ),
  define(
    "atmosphere-noir-signal",
    "Noir Signal",
    "Atmosphere",
    "Ink black, cold white, one dangerous red signal.",
    {
      keywords: ["dark", "noir", "ink", "minimal", "high-contrast"],
      palette: { primary: "#e9edf5", secondary: "#7a8496", accent: "#ff4058" },
      material: { glowIntensity: 0.18, gloss: 0.12, roughness: 0.84, grain: 0.34, outlineWidth: 4 },
      pattern: { kind: "ink-hatch", strength: 0.24, scale: 1.5 },
      geometry: { cornerRoundness: 0.16, detailDensity: 0.32 },
      accessibility: { highContrast: true, minimumTextContrast: 7 }
    }
  ),
  define(
    "atmosphere-frost-relay",
    "Frost Relay",
    "Atmosphere",
    "Cold crystal edges, pale blue glow, and frozen texture.",
    {
      keywords: ["dark", "ice", "glass", "cool"],
      palette: { primary: "#8de8ff", secondary: "#5d79d8", accent: "#f1fbff" },
      material: { gloss: 0.76, roughness: 0.18, translucency: 0.36, iridescence: 0.22, glowIntensity: 0.48 },
      pattern: { kind: "frost", strength: 0.52, scale: 1.1 },
      geometry: { cornerRoundness: 0.22, detailDensity: 0.72 },
      character: { silhouette: "angular", headShape: "helmet", outfit: "future-tailored" }
    }
  ),
  define(
    "atmosphere-desert-signal",
    "Desert Signal",
    "Atmosphere",
    "Sun-worn ochre, heat red, and dusty field texture.",
    {
      keywords: ["dark", "desert", "warm", "weathered", "matte"],
      palette: { primary: "#d9984a", secondary: "#8f5b3b", accent: "#ff5f43" },
      material: { roughness: 0.88, gloss: 0.08, grain: 0.62, weathering: 0.68, glowIntensity: 0.22 },
      pattern: { kind: "sandgrain", strength: 0.58, scale: 0.9 },
      geometry: { cornerRoundness: 0.28, detailDensity: 0.62 },
      character: { outfit: "street-tech", accessory: "energy-sash" }
    }
  ),
  define(
    "atmosphere-watercolor-dream",
    "Watercolor Dream",
    "Atmosphere",
    "Soft pigment blooms with airy color transitions.",
    {
      keywords: ["light", "watercolor", "soft", "nature"],
      palette: { primary: "#6ea8d9", secondary: "#8fc59c", accent: "#eaa0b8" },
      material: { gloss: 0.08, roughness: 0.94, grain: 0.48, glowIntensity: 0.06, outlineWidth: 1.5 },
      pattern: { kind: "watercolor-bloom", strength: 0.64, scale: 1.7 },
      geometry: { cornerRoundness: 0.86, detailDensity: 0.38 },
      character: { silhouette: "heroic-soft", outfit: "paper-armor" }
    }
  ),
  define(
    "clarity-accessible-night",
    "Accessible Night",
    "Clarity",
    "Strong night contrast with restrained motion and cue-safe color.",
    {
      keywords: ["dark", "minimal", "high-contrast", "cool"],
      palette: { primary: "#57e5ff", secondary: "#b8a8ff", accent: "#ffd45c" },
      intensity: 0.52,
      material: {
        glowIntensity: 0.2,
        glowRadius: 10,
        gloss: 0.22,
        roughness: 0.72,
        outlineWidth: 4,
        pulseSpeed: 0,
        shimmerSpeed: 0
      },
      pattern: { kind: "none", strength: 0, scale: 1 },
      accessibility: { highContrast: true, reducedMotion: true, minimumTextContrast: 7 }
    }
  ),
  define(
    "clarity-clean-day",
    "Clean Day",
    "Clarity",
    "Bright neutral surfaces with clear color separation.",
    {
      keywords: ["light", "minimal", "high-contrast"],
      palette: { primary: "#2567d8", secondary: "#13806a", accent: "#b54a12" },
      intensity: 0.48,
      material: { glowIntensity: 0.04, gloss: 0.18, roughness: 0.72, grain: 0, outlineWidth: 2.5 },
      pattern: { kind: "none", strength: 0, scale: 1 },
      geometry: { cornerRoundness: 0.48, detailDensity: 0.24 },
      accessibility: { highContrast: true, minimumTextContrast: 7 }
    }
  ),
  define(
    "clarity-low-motion-focus",
    "Low-motion Focus",
    "Clarity",
    "Calm matte color with every animated value stopped.",
    {
      keywords: ["dark", "matte", "minimal", "high-contrast"],
      palette: { primary: "#6fc7d5", secondary: "#8892d6", accent: "#e6b96b" },
      intensity: 0.42,
      material: {
        glowIntensity: 0.12,
        glowRadius: 8,
        gloss: 0.08,
        roughness: 0.9,
        pulseSpeed: 0,
        shimmerSpeed: 0,
        outlineWidth: 3
      },
      pattern: { kind: "none", strength: 0, scale: 1 },
      accessibility: { highContrast: true, reducedMotion: true, minimumTextContrast: 7 }
    }
  )
]);

export function listPreskins(family = null) {
  return clone(family ? PRESKINS.filter((preset) => preset.family === family) : PRESKINS);
}

export function getPreskin(id) {
  const preset = PRESKINS.find((entry) => entry.id === id);
  return preset ? clone(preset) : null;
}

function preservedBase(base) {
  return {
    type: "axm.style-intent",
    version: "1.0",
    seed: String(base?.seed ?? "axm-preskin-seed"),
    scope: clone(base?.scope ?? ["global", "character.player"]),
    sharing: clone(
      base?.sharing ?? {
        license: "LicenseRef-All-Rights-Reserved",
        remixAllowed: false,
        attribution: "Mike - Axiom/mir"
      }
    )
  };
}

export function applyPreskin(base, id) {
  const preset = getPreskin(id);
  if (!preset) throw new RangeError(`Unknown preskin "${id}".`);
  return {
    ...preservedBase(base),
    ...clone(preset.intent),
    name: preset.name,
    preset: {
      catalog: "axm.preskins.v1",
      primary: preset.id,
      secondary: null,
      blend: 0
    }
  };
}

function blendNumbers(first, second, amount) {
  const keys = new Set([...Object.keys(first ?? {}), ...Object.keys(second ?? {})]);
  const output = {};
  for (const key of keys) {
    const a = first?.[key];
    const b = second?.[key];
    if (Number.isFinite(a) && Number.isFinite(b)) output[key] = a + (b - a) * amount;
    else output[key] = clone(amount < 0.5 ? (a ?? b) : (b ?? a));
  }
  return output;
}

export function blendPreskins(base, primaryId, secondaryId, amount = 0.5) {
  const first = getPreskin(primaryId);
  const second = getPreskin(secondaryId);
  if (!first || !second) throw new RangeError("Both preskin IDs must exist before blending.");
  const mix = clamp(amount);
  const chooseSecond = mix >= 0.5;

  return {
    ...preservedBase(base),
    name: `${first.name} × ${second.name}`,
    keywords: [...new Set([...first.intent.keywords, ...second.intent.keywords])],
    intensity: first.intent.intensity + (second.intent.intensity - first.intent.intensity) * mix,
    palette: {
      primary: mixHex(first.intent.palette.primary, second.intent.palette.primary, mix),
      secondary: mixHex(first.intent.palette.secondary, second.intent.palette.secondary, mix),
      accent: mixHex(first.intent.palette.accent, second.intent.palette.accent, mix)
    },
    material: blendNumbers(first.intent.material, second.intent.material, mix),
    pattern: {
      kind: chooseSecond ? second.intent.pattern.kind : first.intent.pattern.kind,
      strength:
        first.intent.pattern.strength +
        (second.intent.pattern.strength - first.intent.pattern.strength) * mix,
      scale:
        first.intent.pattern.scale + (second.intent.pattern.scale - first.intent.pattern.scale) * mix
    },
    geometry: blendNumbers(first.intent.geometry, second.intent.geometry, mix),
    character: {
      ...(chooseSecond ? clone(second.intent.character) : clone(first.intent.character)),
      proportion:
        first.intent.character.proportion +
        (second.intent.character.proportion - first.intent.character.proportion) * mix
    },
    accessibility: {
      highContrast:
        first.intent.accessibility.highContrast || second.intent.accessibility.highContrast,
      reducedMotion:
        first.intent.accessibility.reducedMotion || second.intent.accessibility.reducedMotion,
      minimumTextContrast: Math.max(
        first.intent.accessibility.minimumTextContrast,
        second.intent.accessibility.minimumTextContrast
      )
    },
    preset: {
      catalog: "axm.preskins.v1",
      primary: first.id,
      secondary: second.id,
      blend: mix
    }
  };
}

export function chooseDeterministicPreskin(seed, family = null) {
  const candidates = family ? PRESKINS.filter((entry) => entry.family === family) : PRESKINS;
  if (!candidates.length) throw new RangeError(`No preskins exist in family "${family}".`);
  return clone(candidates[hash32(`${seed}:${family ?? "all"}`) % candidates.length]);
}
