import {
  PRESENTATION_LAYER_SCOPES,
  derivePresentationCapabilities,
  targetMatchesPresentationScope
} from "./capabilities.mjs";
import { clone, deepMerge, hash32, slugify } from "./stable.mjs";

export const SKIN_LAYER_SCOPES = PRESENTATION_LAYER_SCOPES;

function layerId(layer, index) {
  return slugify(layer.id ?? layer.pack?.metadata?.name ?? `layer-${index + 1}`);
}

function uniqueLayerIds(layers) {
  const used = new Set();
  return layers.map((layer, index) => {
    const base = layerId(layer, index);
    let candidate = base;
    let ordinal = 1;
    while (used.has(candidate)) {
      ordinal += 1;
      const suffix = `-${ordinal}`;
      candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    }
    used.add(candidate);
    return candidate;
  });
}

function namespacedRef(id, original, registry, kind) {
  if (typeof original !== "string") {
    throw new Error(`${kind} references must use portable string IDs.`);
  }
  const origin = `${id}\u0000${original}`;
  const full = `${id}.${original}`;
  const digest = hash32(origin).toString(16).padStart(8, "0");
  const suffix = `.${digest}`;
  const reference =
    full.length <= 127 ? full : `${full.slice(0, 127 - suffix.length)}${suffix}`;
  const previous = registry.get(reference);
  if (previous && previous !== origin) {
    throw new Error(`Namespaced ${kind} reference collision: ${reference}`);
  }
  registry.set(reference, origin);
  return reference;
}

function accessibilityRecord(value) {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stack accessibility declarations must be plain objects.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Stack accessibility declarations must be plain objects.");
  }
  return value;
}

function mergeAccessibilityConservatively(base, overlay) {
  const baseRecord = accessibilityRecord(base);
  const overlayRecord = accessibilityRecord(overlay);
  const merged = deepMerge(baseRecord, overlayRecord);
  const contrasts = [
    baseRecord.minimumTextContrast,
    overlayRecord.minimumTextContrast
  ].filter(Number.isFinite);
  if (contrasts.length) merged.minimumTextContrast = Math.max(...contrasts);
  for (const property of ["preserveGameplayCues", "colorIsNotOnlySignal"]) {
    if (Object.hasOwn(baseRecord, property) || Object.hasOwn(overlayRecord, property)) {
      merged[property] =
        baseRecord[property] !== false && overlayRecord[property] !== false;
    }
  }
  if (
    Object.hasOwn(baseRecord, "reducedMotionSafe") ||
    Object.hasOwn(overlayRecord, "reducedMotionSafe")
  ) {
    merged.reducedMotionSafe =
      baseRecord.reducedMotionSafe === true ||
      overlayRecord.reducedMotionSafe === true;
  }
  return merged;
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
  const layerIds = uniqueLayerIds(enabled);
  const bindings = new Map();
  const materials = {};
  const assets = {};
  const characterBlueprints = {};
  const materialOrigins = new Map();
  const assetOrigins = new Map();
  const blueprintOrigins = new Map();
  let tokens = clone(first.tokens ?? {});
  let accessibility = {};
  const sourceLayers = [];
  const sourceAssetHashes = new Set();

  enabled.forEach((layer, index) => {
    const id = layerIds[index];
    const selected = (layer.pack.bindings ?? []).filter((binding) =>
      targetMatchesPresentationScope(layer.scope, binding.target)
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
    accessibility = mergeAccessibilityConservatively(
      accessibility,
      layer.pack.accessibility ?? {}
    );
    for (const asset of Object.values(layer.pack.assets ?? {})) {
      if (asset?.sha256) sourceAssetHashes.add(asset.sha256);
    }
    for (const binding of selected) {
      const next = clone(binding);
      if (
        binding.material &&
        Object.hasOwn(layer.pack.materials ?? {}, binding.material)
      ) {
        next.material = namespacedRef(
          id,
          binding.material,
          materialOrigins,
          "material"
        );
        materials[next.material] = clone(layer.pack.materials[binding.material]);
      }
      if (binding.asset && Object.hasOwn(layer.pack.assets ?? {}, binding.asset)) {
        next.asset = namespacedRef(id, binding.asset, assetOrigins, "asset");
        assets[next.asset] = clone(layer.pack.assets[binding.asset]);
      }
      if (
        binding.blueprint &&
        Object.hasOwn(layer.pack.characterBlueprints ?? {}, binding.blueprint)
      ) {
        next.blueprint = namespacedRef(
          id,
          binding.blueprint,
          blueprintOrigins,
          "blueprint"
        );
        characterBlueprints[next.blueprint] = clone(
          layer.pack.characterBlueprints[binding.blueprint]
        );
      } else if (
        binding.target.startsWith("character.") &&
        Object.hasOwn(layer.pack.characterBlueprints ?? {}, "default")
      ) {
        next.blueprint = namespacedRef(
          id,
          "default",
          blueprintOrigins,
          "blueprint"
        );
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
      integrity: layer.pack.integrity?.contentSha256 ?? null,
      selectedBindings: selected.map((binding) => binding.target)
    });
  });

  const name = String(options.name ?? "AXM Layered Skin").slice(0, 80);
  const seed = String(options.seed ?? "layer-stack");
  const idSuffix = hash32(
    [
      seed,
      ...sourceLayers.map(
        (layer) =>
          `${layer.id}:${layer.packId}:${layer.release}:${layer.scope}:${layer.integrity ?? ""}`
      )
    ].join("|")
  )
    .toString(16)
    .padStart(8, "0");
  const capabilities = derivePresentationCapabilities(bindings.values(), {
    rasterAssets: Object.keys(assets).length > 0,
    semanticMold: enabled.some(
      (layer, index) =>
        sourceLayers[index].selectedBindings.length > 0 &&
        layer.pack.capabilities?.includes("semantic-mold.v1")
    ),
    skinStack: true,
    treatmentStack: Object.values(materials).some(
      (material) => material?.effectStack || material?.lightingRig
    )
  }).sort();
  return {
    type: "axm.skin-pack",
    version: "1.0",
    id: `user.${slugify(name)}.${idSuffix}`,
    release: "0.6.0",
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
    capabilities,
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
      seed,
      sourceLayers,
      sourceAssetHashes: [...sourceAssetHashes].sort()
    },
    integrity: null
  };
}
