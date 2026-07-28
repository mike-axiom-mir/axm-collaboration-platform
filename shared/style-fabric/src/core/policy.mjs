export const PRESENTATION_CAPABILITIES = Object.freeze([
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
  "raster-asset.v1",
  "semantic-mold.v1",
  "skin-stack.v1"
]);

export const MATERIAL_LIMITS = Object.freeze({
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

export const LOCAL_CREATOR_POLICY = Object.freeze({
  id: "axm.style-policy.local-creator.v1",
  maxPackBytes: 50 * 1024 * 1024,
  maxAssets: 128,
  maxEmbeddedAssetBytes: 12 * 1024 * 1024,
  maxTotalEmbeddedBytes: 48 * 1024 * 1024,
  maxImageDimension: 8192,
  maxImagePixels: 33_554_432,
  allowedAssetMimes: ["image/png", "image/jpeg", "image/webp"],
  allowRemoteAssets: false,
  requireLicenseDeclaration: false,
  requireIntegrity: false,
  allowUnknownTopLevelFields: false
});

export const HOSTED_POLICY_EXAMPLE = Object.freeze({
  ...LOCAL_CREATOR_POLICY,
  id: "axm.style-policy.hosted-example.v1",
  maxPackBytes: 5 * 1024 * 1024,
  maxAssets: 32,
  maxEmbeddedAssetBytes: 2 * 1024 * 1024,
  maxTotalEmbeddedBytes: 4 * 1024 * 1024,
  maxImageDimension: 4096,
  maxImagePixels: 16_777_216,
  requireLicenseDeclaration: true,
  requireIntegrity: true
});

export const FORBIDDEN_PACK_KEYS = Object.freeze(
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

export const ALLOWED_PACK_FIELDS = Object.freeze(
  new Set([
    "type",
    "version",
    "id",
    "release",
    "status",
    "metadata",
    "extends",
    "scopes",
    "capabilities",
    "parameters",
    "tokens",
    "materials",
    "bindings",
    "assets",
    "characterBlueprints",
    "accessibility",
    "provenance",
    "integrity"
  ])
);
