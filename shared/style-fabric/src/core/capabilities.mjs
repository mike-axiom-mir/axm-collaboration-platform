export const PRESENTATION_SCOPE_PREFIXES = Object.freeze({
  world: Object.freeze(["world."]),
  objects: Object.freeze(["structure.", "prop."]),
  gear: Object.freeze(["vehicle.", "equipment."]),
  items: Object.freeze(["item.", "projectile."]),
  characters: Object.freeze(["character."]),
  interface: Object.freeze(["ui."]),
  effects: Object.freeze(["fx."]),
  ui: Object.freeze(["ui."]),
  "character.cast": Object.freeze(["character."]),
  fx: Object.freeze(["fx."])
});

export const PRESENTATION_LAYER_SCOPES = Object.freeze([
  "global",
  "world",
  "objects",
  "gear",
  "items",
  "characters",
  "interface",
  "effects",
  "ui",
  "character.player",
  "character.enemy",
  "character.cast",
  "fx"
]);

export const STYLE_INTENT_SCOPES = Object.freeze([
  ...PRESENTATION_LAYER_SCOPES,
  "reusable"
]);

export function targetMatchesPresentationScope(scope, target) {
  if (scope === "global" || scope === "reusable") return true;
  const prefixes = PRESENTATION_SCOPE_PREFIXES[scope] ?? [`${scope}.`];
  return target === scope || prefixes.some((prefix) => target.startsWith(prefix));
}

export function derivePresentationCapabilities(
  targets,
  {
    semanticMold = false,
    skinStack = false,
    rasterAssets = false,
    treatmentStack = false
  } = {}
) {
  const targetSet = new Set(
    [...(targets ?? [])]
      .map((entry) => (typeof entry === "string" ? entry : entry?.target))
      .filter((target) => typeof target === "string")
  );
  const hasPrefix = (prefix) =>
    [...targetSet].some((target) => target.startsWith(prefix));

  return [
    "palette.v1",
    "theme-tokens.v1",
    "material-params.v1",
    ...(targetSet.size ? ["game-surfaces.v1"] : []),
    ...(hasPrefix("character.") ? ["character-parts.v1"] : []),
    ...(hasPrefix("world.") || hasPrefix("structure.") || hasPrefix("prop.")
      ? ["environment-surfaces.v1"]
      : []),
    ...(targetSet.has("world.lighting") ? ["lighting-profile.v1"] : []),
    ...(hasPrefix("vehicle.") ? ["vehicle-presentation.v1"] : []),
    ...(hasPrefix("equipment.") ? ["equipment-presentation.v1"] : []),
    ...(hasPrefix("item.") || hasPrefix("projectile.")
      ? ["item-presentation.v1"]
      : []),
    ...(targetSet.has("world.postfx") ? ["postfx-profile.v1"] : []),
    ...(hasPrefix("ui.") ? ["ui-theme.v1"] : []),
    ...(hasPrefix("fx.") ||
    hasPrefix("projectile.") ||
    targetSet.has("world.weather") ||
    targetSet.has("world.lighting") ||
    targetSet.has("world.postfx")
      ? ["fx-preset.v1"]
      : []),
    ...(rasterAssets ? ["raster-asset.v1"] : []),
    ...(semanticMold ? ["semantic-mold.v1"] : []),
    ...(skinStack ? ["skin-stack.v1"] : []),
    ...(treatmentStack ? ["treatment-stack.v1"] : [])
  ];
}
