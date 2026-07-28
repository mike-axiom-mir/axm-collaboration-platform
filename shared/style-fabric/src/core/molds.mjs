import {
  STYLE_INTENT_SCOPES,
  targetMatchesPresentationScope
} from "./capabilities.mjs";
import {
  assertSafeObjectTree,
  clone,
  deepMerge,
  slugify
} from "./stable.mjs";

export const UNIVERSAL_MATERIAL_PROPERTIES = Object.freeze([
  "baseColor",
  "secondaryColor",
  "accentColor",
  "emissiveColor",
  "metallic",
  "roughness",
  "gloss",
  "specular",
  "clearcoat",
  "sheen",
  "translucency",
  "iridescence",
  "emissiveStrength",
  "glowIntensity",
  "glowRadius",
  "opacity",
  "outlineWidth",
  "grain",
  "weathering",
  "patternScale",
  "pulseSpeed",
  "shimmerSpeed",
  "pattern"
]);

const SURFACE_PROPERTIES = Object.freeze([
  "baseColor",
  "secondaryColor",
  "accentColor",
  "emissiveColor",
  "metallic",
  "roughness",
  "gloss",
  "specular",
  "clearcoat",
  "sheen",
  "translucency",
  "iridescence",
  "emissiveStrength",
  "glowIntensity",
  "glowRadius",
  "opacity",
  "outlineWidth",
  "grain",
  "weathering",
  "patternScale",
  "pattern"
]);

const FX_PROPERTIES = Object.freeze([
  "baseColor",
  "secondaryColor",
  "accentColor",
  "emissiveColor",
  "emissiveStrength",
  "glowIntensity",
  "glowRadius",
  "opacity",
  "outlineWidth",
  "pulseSpeed",
  "shimmerSpeed",
  "patternScale",
  "pattern"
]);

const UI_PROPERTIES = Object.freeze([
  "baseColor",
  "secondaryColor",
  "accentColor",
  "emissiveColor",
  "roughness",
  "gloss",
  "sheen",
  "translucency",
  "iridescence",
  "glowIntensity",
  "glowRadius",
  "opacity",
  "outlineWidth",
  "grain",
  "patternScale",
  "pattern"
]);

function defineSlot(
  id,
  {
    kind = "surface",
    required = false,
    supportedProperties = SURFACE_PROPERTIES,
    protectedCues = [],
    constraints = {},
    fallback = { baseColor: "#282f45" },
    adoptionLevel = 0
  } = {}
) {
  return Object.freeze({
    kind,
    required,
    supportedProperties: Object.freeze([...supportedProperties]),
    protectedCues: Object.freeze([...protectedCues]),
    constraints: Object.freeze({ ...constraints }),
    fallback: Object.freeze({ ...fallback }),
    adapterHints: Object.freeze({ semanticRole: id, adoptionLevel })
  });
}

export const GAME_SURFACE_CATEGORIES = Object.freeze([
  Object.freeze({
    id: "world",
    name: "World & atmosphere",
    slots: Object.freeze([
      "world.sky",
      "world.background",
      "world.terrain",
      "world.surface",
      "world.water",
      "world.weather",
      "world.lighting",
      "world.postfx"
    ])
  }),
  Object.freeze({
    id: "objects",
    name: "Structures & props",
    slots: Object.freeze([
      "structure.building",
      "structure.interior",
      "prop.environment",
      "prop.interactive"
    ])
  }),
  Object.freeze({
    id: "gear",
    name: "Vehicles & equipment",
    slots: Object.freeze([
      "vehicle.body",
      "vehicle.detail",
      "equipment.weapon",
      "equipment.tool"
    ])
  }),
  Object.freeze({
    id: "items",
    name: "Items & projectiles",
    slots: Object.freeze(["item.pickup", "item.objective", "projectile.primary"])
  }),
  Object.freeze({
    id: "characters",
    name: "Character regions",
    slots: Object.freeze([
      "character.player.body",
      "character.player.detail",
      "character.player.face",
      "character.enemy.body",
      "character.npc.body"
    ])
  }),
  Object.freeze({
    id: "effects",
    name: "Effects",
    slots: Object.freeze(["fx.primary", "fx.impact", "fx.ambient"])
  }),
  Object.freeze({
    id: "interface",
    name: "Interface",
    slots: Object.freeze([
      "ui.panel",
      "ui.hud",
      "ui.menu",
      "ui.marker",
      "ui.cursor",
      "ui.icon"
    ])
  })
]);

export const SLOT_LIBRARY = Object.freeze({
  "world.sky": defineSlot("world.sky", {
    required: true,
    supportedProperties: FX_PROPERTIES,
    constraints: { minimumOpacity: 0.7 },
    fallback: { baseColor: "#090b12", secondaryColor: "#171b28", opacity: 1 }
  }),
  "world.background": defineSlot("world.background", {
    required: true,
    constraints: { minimumOpacity: 0.7 },
    fallback: { baseColor: "#090b12", secondaryColor: "#171b28", opacity: 1 }
  }),
  "world.terrain": defineSlot("world.terrain", {
    required: true,
    protectedCues: ["walkable-edge"],
    fallback: { baseColor: "#282f45", roughness: 0.72 }
  }),
  "world.surface": defineSlot("world.surface", {
    fallback: { baseColor: "#282f45", roughness: 0.58 }
  }),
  "world.water": defineSlot("world.water", {
    fallback: { baseColor: "#2776d6", translucency: 0.34, gloss: 0.72 }
  }),
  "world.weather": defineSlot("world.weather", {
    kind: "fx",
    supportedProperties: FX_PROPERTIES,
    protectedCues: ["reduced-motion-cap"],
    constraints: { minimumOpacity: 0.18 },
    fallback: { baseColor: "#aeb6ce", opacity: 0.42 }
  }),
  "world.lighting": defineSlot("world.lighting", {
    kind: "fx",
    supportedProperties: FX_PROPERTIES,
    protectedCues: ["readable-silhouettes"],
    fallback: { baseColor: "#f5f7ff", accentColor: "#7c5cff" }
  }),
  "world.postfx": defineSlot("world.postfx", {
    kind: "fx",
    supportedProperties: FX_PROPERTIES,
    protectedCues: ["readable-silhouettes", "reduced-motion-cap"],
    constraints: { minimumOpacity: 0.1 },
    fallback: { baseColor: "#7c5cff", opacity: 0.18 }
  }),
  "structure.building": defineSlot("structure.building", {
    fallback: { baseColor: "#30384e", roughness: 0.64 }
  }),
  "structure.interior": defineSlot("structure.interior", {
    fallback: { baseColor: "#22283a", secondaryColor: "#f5f7ff" }
  }),
  "prop.environment": defineSlot("prop.environment", {
    fallback: { baseColor: "#39425b", roughness: 0.68 }
  }),
  "prop.interactive": defineSlot("prop.interactive", {
    protectedCues: ["interaction-marker"],
    fallback: { baseColor: "#19d3c5", accentColor: "#ffd166" }
  }),
  "vehicle.body": defineSlot("vehicle.body", {
    protectedCues: ["vehicle-silhouette", "team-marker"],
    adoptionLevel: 1,
    fallback: { baseColor: "#7c5cff", secondaryColor: "#19d3c5" }
  }),
  "vehicle.detail": defineSlot("vehicle.detail", {
    protectedCues: ["vehicle-facing-cue"],
    adoptionLevel: 1,
    fallback: { baseColor: "#19d3c5", accentColor: "#ff4fa3" }
  }),
  "equipment.weapon": defineSlot("equipment.weapon", {
    protectedCues: ["equipment-class-cue"],
    adoptionLevel: 1,
    fallback: { baseColor: "#5d6682", accentColor: "#ff4fa3" }
  }),
  "equipment.tool": defineSlot("equipment.tool", {
    protectedCues: ["equipment-class-cue"],
    adoptionLevel: 1,
    fallback: { baseColor: "#5d6682", accentColor: "#19d3c5" }
  }),
  "item.pickup": defineSlot("item.pickup", {
    protectedCues: ["pickup-class-cue"],
    fallback: { baseColor: "#44df91", accentColor: "#f5f7ff" }
  }),
  "item.objective": defineSlot("item.objective", {
    protectedCues: ["objective-marker"],
    fallback: { baseColor: "#ffd166", accentColor: "#f5f7ff" }
  }),
  "projectile.primary": defineSlot("projectile.primary", {
    kind: "fx",
    supportedProperties: FX_PROPERTIES,
    protectedCues: ["projectile-readability"],
    fallback: { baseColor: "#ff4fa3", opacity: 0.86 }
  }),
  "character.player.body": defineSlot("character.player.body", {
    kind: "character-region",
    required: true,
    supportedProperties: UNIVERSAL_MATERIAL_PROPERTIES,
    protectedCues: ["player-silhouette", "team-marker"],
    constraints: { minimumOpacity: 0.65 },
    adoptionLevel: 1,
    fallback: { baseColor: "#7c5cff", secondaryColor: "#19d3c5" }
  }),
  "character.player.detail": defineSlot("character.player.detail", {
    kind: "character-region",
    supportedProperties: UNIVERSAL_MATERIAL_PROPERTIES,
    protectedCues: ["team-marker"],
    adoptionLevel: 1,
    fallback: { baseColor: "#19d3c5", accentColor: "#ff4fa3" }
  }),
  "character.player.face": defineSlot("character.player.face", {
    kind: "character-region",
    supportedProperties: UNIVERSAL_MATERIAL_PROPERTIES,
    protectedCues: ["identity-cue"],
    adoptionLevel: 2,
    fallback: { baseColor: "#f0c8a0", secondaryColor: "#7c5cff" }
  }),
  "character.enemy.body": defineSlot("character.enemy.body", {
    kind: "character-region",
    supportedProperties: UNIVERSAL_MATERIAL_PROPERTIES,
    protectedCues: ["enemy-silhouette", "danger-marker"],
    constraints: { minimumOpacity: 0.72 },
    adoptionLevel: 1,
    fallback: { baseColor: "#ff5263", secondaryColor: "#751c38" }
  }),
  "character.npc.body": defineSlot("character.npc.body", {
    kind: "character-region",
    supportedProperties: UNIVERSAL_MATERIAL_PROPERTIES,
    protectedCues: ["npc-silhouette"],
    adoptionLevel: 1,
    fallback: { baseColor: "#44df91", secondaryColor: "#286a59" }
  }),
  "fx.primary": defineSlot("fx.primary", {
    kind: "fx",
    supportedProperties: FX_PROPERTIES,
    protectedCues: ["reduced-motion-cap"],
    constraints: { minimumOpacity: 0.35 },
    fallback: { baseColor: "#ff4fa3", opacity: 0.8 }
  }),
  "fx.impact": defineSlot("fx.impact", {
    kind: "fx",
    supportedProperties: FX_PROPERTIES,
    protectedCues: ["impact-readability", "reduced-motion-cap"],
    constraints: { minimumOpacity: 0.3 },
    fallback: { baseColor: "#ffd166", opacity: 0.82 }
  }),
  "fx.ambient": defineSlot("fx.ambient", {
    kind: "fx",
    supportedProperties: FX_PROPERTIES,
    protectedCues: ["reduced-motion-cap"],
    constraints: { minimumOpacity: 0.15 },
    fallback: { baseColor: "#7c5cff", opacity: 0.36 }
  }),
  "ui.panel": defineSlot("ui.panel", {
    kind: "ui",
    required: true,
    supportedProperties: UI_PROPERTIES,
    protectedCues: ["readable-text"],
    constraints: { minimumOpacity: 0.58, minimumContrast: 4.5 },
    fallback: { baseColor: "#151a2a", secondaryColor: "#f5f7ff", opacity: 0.94 }
  }),
  "ui.hud": defineSlot("ui.hud", {
    kind: "ui",
    supportedProperties: UI_PROPERTIES,
    protectedCues: ["readable-text", "status-cue"],
    constraints: { minimumOpacity: 0.5, minimumContrast: 4.5 },
    fallback: { baseColor: "#151a2a", secondaryColor: "#f5f7ff", opacity: 0.88 }
  }),
  "ui.menu": defineSlot("ui.menu", {
    kind: "ui",
    supportedProperties: UI_PROPERTIES,
    protectedCues: ["readable-text", "focus-cue"],
    constraints: { minimumOpacity: 0.58, minimumContrast: 4.5 },
    fallback: { baseColor: "#151a2a", secondaryColor: "#f5f7ff", opacity: 0.96 }
  }),
  "ui.marker": defineSlot("ui.marker", {
    kind: "ui",
    supportedProperties: UI_PROPERTIES,
    protectedCues: ["objective-marker", "team-marker"],
    fallback: { baseColor: "#ffd166", secondaryColor: "#090b12", opacity: 1 }
  }),
  "ui.cursor": defineSlot("ui.cursor", {
    kind: "ui",
    supportedProperties: UI_PROPERTIES,
    protectedCues: ["pointer-cue", "focus-cue"],
    fallback: { baseColor: "#f5f7ff", accentColor: "#7c5cff", opacity: 1 }
  }),
  "ui.icon": defineSlot("ui.icon", {
    kind: "ui",
    supportedProperties: UI_PROPERTIES,
    protectedCues: ["icon-meaning", "status-cue"],
    fallback: { baseColor: "#f5f7ff", accentColor: "#19d3c5", opacity: 1 }
  })
});

function defineMold(id, name, purpose, slots, recommendedScopes) {
  return Object.freeze({
    id,
    name,
    purpose,
    slots: Object.freeze([...slots]),
    recommendedScopes: Object.freeze([...recommendedScopes])
  });
}

export const SKIN_MOLDS = Object.freeze([
  defineMold(
    "universal-core",
    "Universal Core",
    "Smallest practical whole-game skin surface.",
    ["world.background", "ui.panel", "character.player.body"],
    ["global", "character.player"]
  ),
  defineMold(
    "world-atmosphere",
    "World + Atmosphere",
    "Environment surfaces and presentation effects without character replacement.",
    GAME_SURFACE_CATEGORIES[0].slots,
    ["world"]
  ),
  defineMold(
    "playable-character",
    "Playable Character",
    "Player body, detail, and face regions for character-focused games.",
    ["character.player.body", "character.player.detail", "character.player.face"],
    ["character.player"]
  ),
  defineMold(
    "character-cast",
    "Character Cast",
    "Player and opposing cast styling with gameplay silhouettes preserved.",
    [
      "character.player.body",
      "character.player.detail",
      "character.player.face",
      "character.enemy.body",
      "character.npc.body"
    ],
    ["characters"]
  ),
  defineMold(
    "arcade-arena",
    "Arcade Arena",
    "World, player, opponent, interface, and primary effects.",
    [
      "world.background",
      "world.terrain",
      "world.surface",
      "ui.panel",
      "ui.hud",
      "ui.marker",
      "character.player.body",
      "character.player.detail",
      "character.enemy.body",
      "item.pickup",
      "projectile.primary",
      "fx.primary",
      "fx.impact"
    ],
    ["world", "characters", "items", "interface", "effects"]
  ),
  defineMold(
    "ui-shell",
    "Interface Shell",
    "Presentation-only menus, HUD, markers, cursor, and icons.",
    GAME_SURFACE_CATEGORIES[6].slots,
    ["interface"]
  ),
  defineMold(
    "effects-stage",
    "Effects Stage",
    "Bounded primary, impact, and ambient effects.",
    GAME_SURFACE_CATEGORIES[5].slots,
    ["effects"]
  ),
  defineMold(
    "environment-kit",
    "Environment Kit",
    "World, structures, interiors, and props for explorable spaces.",
    [...GAME_SURFACE_CATEGORIES[0].slots, ...GAME_SURFACE_CATEGORIES[1].slots],
    ["world", "objects"]
  ),
  defineMold(
    "structures-props",
    "Structures + Props",
    "Buildings, interiors, scenery, and interactive objects.",
    GAME_SURFACE_CATEGORIES[1].slots,
    ["objects"]
  ),
  defineMold(
    "vehicle-action",
    "Vehicle Action",
    "Vehicles, equipment, projectiles, HUD, markers, and impact effects.",
    [
      ...GAME_SURFACE_CATEGORIES[2].slots,
      "projectile.primary",
      "fx.primary",
      "fx.impact",
      "ui.hud",
      "ui.marker"
    ],
    ["gear", "items", "effects", "interface"]
  ),
  defineMold(
    "loot-combat",
    "Loot + Combat",
    "Weapons, tools, pickups, objectives, projectiles, and combat effects.",
    [
      "equipment.weapon",
      "equipment.tool",
      ...GAME_SURFACE_CATEGORIES[3].slots,
      "fx.primary",
      "fx.impact",
      "ui.hud",
      "ui.icon"
    ],
    ["gear", "items", "effects", "interface"]
  ),
  defineMold(
    "rpg-adventure",
    "RPG Adventure",
    "Explorable world, character cast, gear, objectives, effects, and interface.",
    [
      "world.sky",
      "world.background",
      "world.terrain",
      "world.lighting",
      "structure.building",
      "structure.interior",
      "prop.environment",
      "prop.interactive",
      "equipment.weapon",
      "equipment.tool",
      "item.pickup",
      "item.objective",
      ...GAME_SURFACE_CATEGORIES[4].slots,
      "fx.primary",
      "fx.impact",
      "ui.panel",
      "ui.hud",
      "ui.menu",
      "ui.marker",
      "ui.icon"
    ],
    ["world", "objects", "gear", "items", "characters", "effects", "interface"]
  ),
  defineMold(
    "strategy-sim",
    "Strategy + Simulation",
    "Terrain, structures, interactive props, vehicles, objectives, markers, and interface.",
    [
      "world.sky",
      "world.background",
      "world.terrain",
      "world.surface",
      "world.lighting",
      ...GAME_SURFACE_CATEGORIES[1].slots,
      "vehicle.body",
      "vehicle.detail",
      "item.objective",
      "fx.primary",
      "ui.panel",
      "ui.hud",
      "ui.menu",
      "ui.marker",
      "ui.cursor",
      "ui.icon"
    ],
    ["world", "objects", "gear", "items", "effects", "interface"]
  ),
  defineMold(
    "party-game",
    "Party Game",
    "Playful world, character cast, pickups, impact effects, markers, and interface.",
    [
      "world.background",
      "world.terrain",
      "world.lighting",
      "prop.environment",
      "prop.interactive",
      "item.pickup",
      "item.objective",
      ...GAME_SURFACE_CATEGORIES[4].slots,
      "fx.primary",
      "fx.impact",
      "ui.panel",
      "ui.hud",
      "ui.marker",
      "ui.icon"
    ],
    ["world", "objects", "items", "characters", "effects", "interface"]
  ),
  defineMold(
    "platformer-action",
    "Platformer Action",
    "Terrain, props, cast, pickups, projectiles, effects, and HUD.",
    [
      "world.background",
      "world.terrain",
      "world.surface",
      "world.lighting",
      "prop.environment",
      "prop.interactive",
      "item.pickup",
      "item.objective",
      "projectile.primary",
      "character.player.body",
      "character.player.detail",
      "character.enemy.body",
      "fx.primary",
      "fx.impact",
      "ui.hud",
      "ui.marker"
    ],
    ["world", "objects", "items", "characters", "effects", "interface"]
  ),
  defineMold(
    "full-presentation",
    "Full Game Skin",
    "All portable game-presentation surfaces currently understood by Style Fabric.",
    Object.keys(SLOT_LIBRARY),
    ["global"]
  )
]);

const MOLD_BY_ID = new Map(SKIN_MOLDS.map((mold) => [mold.id, mold]));
const MOLD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
const KNOWN_MOLD_SCOPES = new Set(STYLE_INTENT_SCOPES);

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateDenseStringArray(value, field, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${field} must contain at least one value`);
    return false;
  }
  let valid = true;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      errors.push(`${field} must not contain sparse entries`);
      valid = false;
      continue;
    }
    if (typeof value[index] !== "string" || !value[index].trim()) {
      errors.push(`${field} entries must be non-empty strings`);
      valid = false;
    }
  }
  return valid;
}

export function validateSkinMold(mold) {
  const errors = [];
  if (!isPlainRecord(mold)) {
    return { ok: false, errors: ["mold must be a plain declarative object"] };
  }
  try {
    assertSafeObjectTree(mold, "$mold");
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
  const allowed = new Set(["id", "name", "purpose", "slots", "recommendedScopes"]);
  for (const key of Object.keys(mold)) {
    if (!allowed.has(key)) errors.push(`unknown mold field: ${key}`);
  }
  if (
    !Object.hasOwn(mold, "id") ||
    typeof mold.id !== "string" ||
    !MOLD_ID_PATTERN.test(mold.id)
  ) {
    errors.push("id is invalid");
  }
  if (
    !Object.hasOwn(mold, "name") ||
    typeof mold.name !== "string" ||
    !mold.name.trim() ||
    mold.name.length > 80
  ) {
    errors.push("name must contain 1 to 80 characters");
  }
  if (
    !Object.hasOwn(mold, "purpose") ||
    typeof mold.purpose !== "string" ||
    !mold.purpose.trim() ||
    mold.purpose.length > 240
  ) {
    errors.push("purpose must contain 1 to 240 characters");
  }
  if (!Object.hasOwn(mold, "slots") || !Array.isArray(mold.slots) || mold.slots.length === 0) {
    errors.push("slots must contain at least one semantic surface");
  } else {
    const validEntries = validateDenseStringArray(mold.slots, "slots", errors);
    if (validEntries) {
      if (new Set(mold.slots).size !== mold.slots.length) errors.push("slots must be unique");
      for (const slot of mold.slots) {
        if (!Object.hasOwn(SLOT_LIBRARY, slot)) {
          errors.push(`unknown semantic surface: ${slot}`);
        }
      }
    }
  }
  if (
    !Object.hasOwn(mold, "recommendedScopes") ||
    !Array.isArray(mold.recommendedScopes) ||
    mold.recommendedScopes.length === 0
  ) {
    errors.push("recommendedScopes must contain at least one scope");
  } else {
    const validEntries = validateDenseStringArray(
      mold.recommendedScopes,
      "recommendedScopes",
      errors
    );
    if (validEntries) {
      if (new Set(mold.recommendedScopes).size !== mold.recommendedScopes.length) {
        errors.push("recommendedScopes must be unique");
      }
      for (const scope of mold.recommendedScopes) {
        if (!KNOWN_MOLD_SCOPES.has(scope)) errors.push(`unknown recommended scope: ${scope}`);
      }
      if (
        Array.isArray(mold.slots) &&
        mold.slots.length &&
        mold.slots.every((slot) => typeof slot === "string") &&
        mold.recommendedScopes.every((scope) => KNOWN_MOLD_SCOPES.has(scope))
      ) {
        for (const scope of mold.recommendedScopes) {
          if (!mold.slots.some((slot) => targetMatchesPresentationScope(scope, slot))) {
            errors.push(`recommended scope does not cover a mold slot: ${scope}`);
          }
        }
        for (const slot of mold.slots) {
          if (
            !mold.recommendedScopes.some((scope) =>
              targetMatchesPresentationScope(scope, slot)
            )
          ) {
            errors.push(`recommendedScopes do not cover semantic surface: ${slot}`);
          }
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function scopesForSlots(slots) {
  if (slots.length === Object.keys(SLOT_LIBRARY).length) return ["global"];
  return GAME_SURFACE_CATEGORIES.filter((category) =>
    category.slots.some((slot) => slots.includes(slot))
  ).map((category) => category.id);
}

export function forgeSkinMold({
  id,
  name = "Untitled Skin Mold",
  purpose = "Explicit local presentation mold.",
  slots,
  recommendedScopes = null
}) {
  const portableId = slugify(id ?? name).slice(0, 64);
  const uniqueSlots = [...new Set((slots ?? []).map(String))];
  const mold = {
    id: portableId,
    name: String(name).trim().slice(0, 80),
    purpose: String(purpose).trim().slice(0, 240),
    slots: uniqueSlots,
    recommendedScopes: recommendedScopes
      ? [...new Set(recommendedScopes.map(String))]
      : scopesForSlots(uniqueSlots)
  };
  const validation = validateSkinMold(mold);
  if (!validation.ok) {
    throw new Error(`Invalid skin mold: ${validation.errors.join("; ")}`);
  }
  return {
    mold,
    receipt: {
      type: "axm.skin-mold-forge-receipt",
      version: "1.0",
      mode: "EXPLICIT",
      moldId: mold.id,
      slots: [...mold.slots],
      promotion: "DRAFT_REVIEW_REQUIRED",
      automaticGameWrites: 0
    }
  };
}

export function growSkinMold(
  base,
  {
    id,
    name,
    purpose,
    addOrgans = [],
    addSlots = [],
    removeSlots = [],
    recommendedScopes = null
  } = {}
) {
  const sourceInput = typeof base === "string" ? getSkinMold(base) : base;
  const sourceValidation = validateSkinMold(sourceInput);
  if (!sourceValidation.ok) {
    throw new Error(`Invalid parent skin mold: ${sourceValidation.errors.join("; ")}`);
  }
  const source = clone(sourceInput);
  const additions = [
    ...addSlots.map(String),
    ...addOrgans.flatMap((organId) => {
      const organ = GAME_SURFACE_CATEGORIES.find((category) => category.id === organId);
      if (!organ) throw new Error(`Unknown skin organ: ${organId}`);
      return organ.slots;
    })
  ];
  const removed = new Set(removeSlots.map(String));
  const slots = [...new Set([...source.slots, ...additions])].filter((slot) => !removed.has(slot));
  const result = forgeSkinMold({
    id: id ?? `${source.id}-grown`,
    name: name ?? `${source.name} — Grown`,
    purpose: purpose ?? `${source.purpose} Explicitly grown from ${source.id}.`,
    slots,
    recommendedScopes
  });
  result.receipt = {
    ...result.receipt,
    type: "axm.skin-mold-growth-receipt",
    parentMoldId: source.id,
    addedSlots: slots.filter((slot) => !source.slots.includes(slot)),
    removedSlots: source.slots.filter((slot) => !slots.includes(slot)),
    requestedOrgans: [...addOrgans]
  };
  return result;
}

export function listSkinMolds() {
  return clone(SKIN_MOLDS);
}

export function listGameSurfaceCategories() {
  return clone(GAME_SURFACE_CATEGORIES);
}

export function listGameSurfaceSlots() {
  return Object.entries(SLOT_LIBRARY).map(([id, definition]) => ({
    id,
    ...clone(definition)
  }));
}

export function getSkinMold(id) {
  const mold = MOLD_BY_ID.get(String(id));
  return mold ? clone(mold) : null;
}

export function createGameContractFromMold({
  moldId = "universal-core",
  mold: customMold = null,
  gameId,
  gameVersion = "0.0.0",
  rendererProfile = "engine-neutral",
  slotOverrides = {}
}) {
  let mold = null;
  if (customMold) {
    const validation = validateSkinMold(customMold);
    if (!validation.ok) throw new Error(`Invalid skin mold: ${validation.errors.join("; ")}`);
    mold = clone(customMold);
  } else {
    mold = MOLD_BY_ID.get(String(moldId));
  }
  if (!mold) throw new Error(`Unknown skin mold: ${moldId}`);
  const portableGameId = slugify(gameId, "unnamed-game").replaceAll("-", ".");
  const slots = mold.slots.map((slotId) => {
    const base = clone(SLOT_LIBRARY[slotId]);
    return {
      id: slotId,
      ...deepMerge(base, slotOverrides[slotId] ?? {})
    };
  });
  return {
    type: "axm.game-skin-contract",
    version: "1.0",
    gameId: portableGameId,
    gameVersion: String(gameVersion),
    adapterApi: "axm.style-adapter.v1",
    rendererProfile: String(rendererProfile),
    slots
  };
}

export function assessMoldCompatibility(pack, gameContract, moldId = "universal-core") {
  let mold = null;
  if (moldId && typeof moldId === "object") {
    const validation = validateSkinMold(moldId);
    if (!validation.ok) throw new Error(`Invalid skin mold: ${validation.errors.join("; ")}`);
    mold = clone(moldId);
  } else {
    mold = MOLD_BY_ID.get(String(moldId));
  }
  if (!mold) throw new Error(`Unknown skin mold: ${moldId}`);
  const bindings = new Map((pack?.bindings ?? []).map((binding) => [binding.target, binding]));
  const gameSlots = new Map((gameContract?.slots ?? []).map((slot) => [slot.id, slot]));
  const rows = mold.slots.map((semanticSlot) => {
    const gameSlot =
      gameSlots.get(semanticSlot) ??
      [...gameSlots.values()].find(
        (candidate) => candidate.adapterHints?.semanticRole === semanticSlot
      );
    const binding = bindings.get(semanticSlot);
    const supported = new Set(gameSlot?.supportedProperties ?? []);
    const material = binding ? pack?.materials?.[binding.material] : null;
    const requestedProperties = Object.keys(material ?? {});
    const acceptedProperties = requestedProperties.filter((property) => supported.has(property));
    return {
      semanticSlot,
      gameSlot: gameSlot?.id ?? null,
      gameDeclaresSlot: Boolean(gameSlot),
      packDeclaresBinding: Boolean(binding),
      acceptedProperties: acceptedProperties.length,
      requestedProperties: requestedProperties.length,
      protectedCues: clone(gameSlot?.protectedCues ?? []),
      status:
        gameSlot && binding
          ? acceptedProperties.length === requestedProperties.length
            ? "FULL"
            : "PARTIAL"
          : "MISSING"
    };
  });
  const connected = rows.filter(
    (row) => row.gameDeclaresSlot && row.packDeclaresBinding
  ).length;
  const partial = rows.some((row) => row.status === "PARTIAL");
  return {
    type: "axm.mold-compatibility-report",
    version: "1.0",
    moldId: mold.id,
    gameId: gameContract?.gameId ?? null,
    packId: pack?.id ?? null,
    compatibility:
      connected === 0
        ? "INCOMPATIBLE"
        : connected === rows.length && !partial
          ? "FULL"
          : "PARTIAL",
    summary: {
      connected,
      total: rows.length,
      percent: rows.length ? Math.round((connected / rows.length) * 100) : 0
    },
    rows,
    automaticWrites: 0
  };
}

export function gameSurfaceCoverage(pack, gameContract = null) {
  const bindings = new Set((pack?.bindings ?? []).map((binding) => binding.target));
  const declared = gameContract
    ? new Set((gameContract.slots ?? []).map((slot) => slot.adapterHints?.semanticRole ?? slot.id))
    : null;
  const categories = GAME_SURFACE_CATEGORIES.map((category) => {
    const rows = category.slots.map((slot) => ({
      slot,
      packBound: bindings.has(slot),
      gameDeclared: declared ? declared.has(slot) : null,
      connected: bindings.has(slot) && (!declared || declared.has(slot))
    }));
    const connected = rows.filter((row) => row.connected).length;
    return {
      id: category.id,
      name: category.name,
      connected,
      total: rows.length,
      percent: Math.round((connected / rows.length) * 100),
      rows
    };
  });
  const connected = categories.reduce((sum, category) => sum + category.connected, 0);
  const total = categories.reduce((sum, category) => sum + category.total, 0);
  return {
    type: "axm.game-surface-coverage-report",
    version: "1.0",
    packId: pack?.id ?? null,
    gameId: gameContract?.gameId ?? null,
    summary: {
      connected,
      total,
      percent: Math.round((connected / total) * 100)
    },
    categories,
    automaticWrites: 0
  };
}

export function remapPackBindings(pack, explicitMap) {
  const available = new Set(Object.keys(explicitMap ?? {}));
  const remapped = clone(pack);
  remapped.bindings = (pack?.bindings ?? []).map((binding) => ({
    ...clone(binding),
    target: available.has(binding.target) ? String(explicitMap[binding.target]) : binding.target
  }));
  remapped.integrity = null;
  remapped.provenance = {
    ...(remapped.provenance ?? {}),
    bindingMap: Object.fromEntries(
      Object.entries(explicitMap ?? {}).sort(([a], [b]) => a.localeCompare(b))
    ),
    bindingMode: "EXPLICIT_ONLY"
  };
  return remapped;
}
