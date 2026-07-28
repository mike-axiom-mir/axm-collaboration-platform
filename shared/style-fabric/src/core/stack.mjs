import { clone, deepMerge, hash32, slugify } from "./stable.mjs";

export const SKIN_LAYER_SCOPES = Object.freeze([
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

const SCOPE_PREFIXES = Object.freeze({
  world: ["world."],
  objects: ["structure.", "prop."],
  gear: ["vehicle.", "equipment."],
  items: ["item.", "projectile."],
  characters: ["character."],
  interface: ["ui."],
  effects: ["fx."],
  ui: ["ui."],
  "character.cast": ["character."],
  fx: ["fx."]
});

function targetMatches(scope, target) {
  if (scope === "global") return true;
  const prefixes = SCOPE_PREFIXES[scope] ?? [`${scope}.`];
  return target === scope || prefixes.some((prefix) => target.startsWith(prefix));
}

function layerId(layer, index) {
  return slugify(layer.id ?? layer.pack?.metadata?.name ?? `layer-${index + 1}`);
}

function materialRef(id, original) {
  return `${id}.${original}`.slice(0, 127);
}

export function composeSkinStack(layers, options = {}) {
  const enabled = (layers ?? []).filter((layer) => layer?.enabled !== false);
  if (!enabled.length) throw new Error("A skin stack requires at least one enabled layer.");
  for (const [index, layer] of enabled.entries()) {
    if (!layer.pack || layer.pack.type !== "axm.skin-pack") {
      throw new Error(`Layer ${index + 1} does not contain an AXM skin pack.`);
    }
    if (!SKIN_LAYER_SCOPES.includes(layer.scope)) {
      throw new Error(`Layer ${index + 1} uses unknown scope ${layer.scope}.`);
    }
  }

  const first = enabled[0].pack;
  const bindings = new Map();
  const materials = {};
  const assets = {};
  const characterBlueprints = {};
  let tokens = clone(first.tokens ?? {});
  let accessibility = clone(first.accessibility ?? {});
  const sourceLayers = [];

  enabled.forEach((layer, index) => {
    const id = layerId(layer, index);
    const selected = (layer.pack.bindings ?? []).filter((binding) =>
      targetMatches(layer.scope, binding.target)
    );
    if (["global", "world"].includes(layer.scope)) {
      tokens = deepMerge(tokens, layer.pack.tokens ?? {});
    } else if (["interface", "ui"].includes(layer.scope)) {
      tokens.interface = clone(layer.pack.tokens ?? {});
    } else if (
      layer.scope === "characters" ||
      layer.scope.startsWith("character.")
    ) {
      tokens.character = clone(layer.pack.tokens ?? {});
    } else if (["effects", "fx"].includes(layer.scope)) {
      tokens.fx = clone(layer.pack.tokens ?? {});
      tokens.motion = deepMerge(tokens.motion ?? {}, layer.pack.tokens?.motion ?? {});
    } else {
      tokens[layer.scope] = clone(layer.pack.tokens ?? {});
    }
    accessibility = deepMerge(accessibility, layer.pack.accessibility ?? {});
    for (const binding of selected) {
      const next = clone(binding);
      if (binding.material && layer.pack.materials?.[binding.material]) {
        next.material = materialRef(id, binding.material);
        materials[next.material] = clone(layer.pack.materials[binding.material]);
      }
      if (binding.asset && layer.pack.assets?.[binding.asset]) {
        next.asset = materialRef(id, binding.asset);
        assets[next.asset] = clone(layer.pack.assets[binding.asset]);
      }
      if (binding.blueprint && layer.pack.characterBlueprints?.[binding.blueprint]) {
        next.blueprint = materialRef(id, binding.blueprint);
        characterBlueprints[next.blueprint] = clone(
          layer.pack.characterBlueprints[binding.blueprint]
        );
      } else if (
        binding.target.startsWith("character.") &&
        layer.pack.characterBlueprints?.default
      ) {
        next.blueprint = materialRef(id, "default");
        characterBlueprints[next.blueprint] = clone(
          layer.pack.characterBlueprints.default
        );
      }
      bindings.set(next.target, next);
    }
    sourceLayers.push({
      order: index,
      id,
      scope: layer.scope,
      packId: layer.pack.id,
      release: layer.pack.release,
      selectedBindings: selected.map((binding) => binding.target)
    });
  });

  const name = String(options.name ?? "AXM Layered Skin").slice(0, 80);
  const idSuffix = hash32(
    sourceLayers.map((layer) => `${layer.packId}:${layer.scope}`).join("|")
  )
    .toString(16)
    .padStart(8, "0");
  return {
    type: "axm.skin-pack",
    version: "1.0",
    id: `user.${slugify(name)}.${idSuffix}`,
    release: "0.5.0",
    status: "WORKING_TEST",
    metadata: {
      name,
      description: "Deterministic layered AXM presentation skin",
      creator: String(options.creator ?? "Mike - Axiom/mir").slice(0, 160),
      license: String(options.license ?? first.metadata?.license ?? "LicenseRef-All-Rights-Reserved"),
      remixAllowed: Boolean(options.remixAllowed),
      aiAssistance: "DECLARATIVE_LAYER_COMPOSER",
      createdAt: null
    },
    extends: null,
    scopes: [...new Set(enabled.map((layer) => layer.scope))],
    capabilities: [
      ...new Set([
        ...enabled.flatMap((layer) => layer.pack.capabilities ?? []),
        "skin-stack.v1"
      ])
    ].sort(),
    parameters: {},
    tokens,
    materials,
    bindings: [...bindings.values()],
    assets,
    characterBlueprints,
    accessibility,
    provenance: {
      origin: "deterministic-skin-stack",
      compiler: "axm.skin-stack.v1",
      seed: String(options.seed ?? "layer-stack"),
      sourceLayers,
      sourceAssetHashes: []
    },
    integrity: null
  };
}
