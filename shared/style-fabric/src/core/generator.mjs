import { hslToHex } from "./color.mjs";
import { createHarmonyPalette, PALETTE_HARMONIES } from "./palette.mjs";
import { RECOGNIZED_PATTERN_KINDS, RECOGNIZED_STYLE_KEYWORDS } from "./recipe.mjs";
import { getSkinMold } from "./molds.mjs";
import { clamp, seededRandom, slugify } from "./stable.mjs";

const MOODS = Object.freeze({
  balanced: ["dark", "minimal", "cool"],
  wonder: ["cosmic", "holographic", "glass", "cool"],
  playful: ["cartoon", "candy", "soft"],
  grounded: ["nature", "matte", "weathered"],
  dramatic: ["dark", "neon", "high-contrast", "noir"],
  luxurious: ["dark", "luxury", "metallic", "royal"]
});

const SILHOUETTES = ["balanced", "compact", "angular", "tall", "broad", "chibi", "floating"];
const HEADS = ["round", "square", "helmet", "orb", "faceted", "masked", "creature"];
const OUTFITS = [
  "future-tailored",
  "modular",
  "paper-armor",
  "street-tech",
  "ceremonial",
  "explorer",
  "biomech",
  "artisan"
];
const ACCESSORIES = ["none", "energy-sash", "visor", "cape", "orbiting-charm", "crown", "wings", "tool-rig"];

function pick(random, entries) {
  return entries[Math.floor(random() * entries.length)];
}

export function listGeneratorMoods() {
  return Object.keys(MOODS);
}

export function generateStyleIntent({
  seed,
  name = "Generated AXM Style",
  moldId = "universal-core",
  mood = "balanced",
  complexity = 0.55,
  sharing = {}
}) {
  const mold = getSkinMold(moldId);
  if (!mold) throw new Error(`Unknown skin mold: ${moldId}`);
  if (!MOODS[mood]) throw new Error(`Unknown generator mood: ${mood}`);
  const stableSeed = String(seed || slugify(name));
  const random = seededRandom(`axm.mold-maker.v1:${stableSeed}:${moldId}:${mood}`);
  const baseHue = Math.floor(random() * 360);
  const harmony = pick(random, PALETTE_HARMONIES);
  const palette = createHarmonyPalette(hslToHex(baseHue, 86, 58), harmony);
  const moodWords = [...MOODS[mood]];
  const additions = RECOGNIZED_STYLE_KEYWORDS.filter(
    (word) => !moodWords.includes(word)
  );
  const extraCount = Math.round(clamp(complexity) * 2);
  for (let index = 0; index < extraCount; index += 1) {
    const word = pick(random, additions);
    if (!moodWords.includes(word)) moodWords.push(word);
  }
  const patternChoices = RECOGNIZED_PATTERN_KINDS.filter((kind) => kind !== "none");
  const patternKind = complexity < 0.12 ? "none" : pick(random, patternChoices);
  const scopes = mold.recommendedScopes.includes("global")
    ? ["global", "character.player"]
    : [...mold.recommendedScopes];

  return {
    type: "axm.style-intent",
    version: "1.0",
    name: String(name).slice(0, 80),
    seed: stableSeed.slice(0, 120),
    scope: scopes,
    keywords: [...new Set(moodWords)].sort(),
    intensity: Number((0.42 + random() * 0.48).toFixed(4)),
    palette,
    material: {
      glowIntensity: Number((0.18 + random() * 0.7).toFixed(4)),
      glowRadius: Number((8 + random() * 40).toFixed(2)),
      gloss: Number((0.12 + random() * 0.78).toFixed(4)),
      metallic: Number((random() * 0.82).toFixed(4)),
      roughness: Number((0.12 + random() * 0.78).toFixed(4)),
      clearcoat: Number((random() * 0.74).toFixed(4)),
      sheen: Number((random() * 0.72).toFixed(4)),
      iridescence: Number((random() * clamp(complexity)).toFixed(4)),
      translucency: Number((random() * clamp(complexity) * 0.7).toFixed(4)),
      grain: Number((random() * 0.55).toFixed(4)),
      weathering: Number((random() * clamp(complexity)).toFixed(4)),
      outlineWidth: Number((1 + random() * 5).toFixed(2)),
      emissiveStrength: Number((0.25 + random() * 1.4).toFixed(4)),
      pulseSpeed: Number((random() * 1.5).toFixed(4)),
      shimmerSpeed: Number((random() * 1.2).toFixed(4))
    },
    pattern: {
      kind: patternKind,
      strength: patternKind === "none" ? 0 : Number((0.15 + random() * 0.7).toFixed(4)),
      scale: Number((0.5 + random() * 2.8).toFixed(4))
    },
    geometry: {
      cornerRoundness: Number(random().toFixed(4)),
      silhouetteExaggeration: Number((random() * clamp(complexity)).toFixed(4)),
      detailDensity: Number((0.15 + random() * 0.8).toFixed(4))
    },
    character: {
      silhouette: pick(random, SILHOUETTES),
      headShape: pick(random, HEADS),
      outfit: pick(random, OUTFITS),
      accessory: pick(random, ACCESSORIES),
      proportion: Number(random().toFixed(4))
    },
    accessibility: {
      highContrast: mood === "dramatic",
      reducedMotion: false,
      minimumTextContrast: 4.5
    },
    sharing: {
      license: String(sharing.license ?? "LicenseRef-All-Rights-Reserved").slice(0, 80),
      remixAllowed: Boolean(sharing.remixAllowed),
      attribution: String(sharing.attribution ?? "Mike - Axiom/mir").slice(0, 160)
    },
    generator: {
      type: "axm.mold-maker",
      version: "1.0",
      moldId,
      mood,
      complexity: clamp(complexity),
      harmony
    }
  };
}

