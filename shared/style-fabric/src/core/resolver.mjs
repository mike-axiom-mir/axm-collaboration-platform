import { contrastRatio } from "./color.mjs";
import { LOCAL_CREATOR_POLICY } from "./policy.mjs";
import { clone, deepMerge, flattenObject, sha256Hex } from "./stable.mjs";
import {
  validateGameSkinContract,
  validateSkinPack,
  verifyEmbeddedAssets
} from "./validator.mjs";

function bindingMap(bindings = []) {
  return new Map(bindings.map((binding) => [binding.target, binding]));
}

function mergePacks(packs, instance, receipt) {
  const composed = {
    tokens: {},
    materials: {},
    assets: {},
    characterBlueprints: {},
    accessibility: {},
    bindings: new Map()
  };

  for (const pack of packs) {
    composed.tokens = deepMerge(composed.tokens, pack.tokens ?? {});
    composed.materials = deepMerge(composed.materials, pack.materials ?? {});
    composed.assets = deepMerge(composed.assets, pack.assets ?? {});
    composed.characterBlueprints = deepMerge(
      composed.characterBlueprints,
      pack.characterBlueprints ?? {}
    );
    composed.accessibility = deepMerge(composed.accessibility, pack.accessibility ?? {});
    for (const binding of pack.bindings ?? []) {
      const replaced = composed.bindings.has(binding.target);
      composed.bindings.set(binding.target, clone(binding));
      receipt.layerEvents.push({
        packId: pack.id,
        target: binding.target,
        action: replaced ? "override" : "add"
      });
    }
  }

  if (instance?.overrides) {
    const flattened = flattenObject(instance.overrides);
    for (const [path, value] of Object.entries(flattened)) {
      receipt.instanceOverrides.push({ path, value });
    }
    const withOverrides = deepMerge(composed, instance.overrides);
    Object.assign(composed, withOverrides);
  }
  return composed;
}

function filterMaterial(material, slot, receipt) {
  const supported = new Set(slot.supportedProperties);
  const filtered = {};
  for (const [key, value] of Object.entries(material ?? {})) {
    if (supported.has(key)) {
      filtered[key] = clone(value);
    } else {
      receipt.unsupported.push({ slot: slot.id, property: key, action: "omitted" });
    }
  }

  const minimumOpacity = slot.constraints?.minimumOpacity;
  if (Number.isFinite(minimumOpacity) && Number(filtered.opacity) < minimumOpacity) {
    receipt.protected.push({
      slot: slot.id,
      property: "opacity",
      requested: filtered.opacity,
      applied: minimumOpacity,
      reason: "gameplay cue visibility"
    });
    filtered.opacity = minimumOpacity;
  }

  const minimumContrast = slot.constraints?.minimumContrast;
  if (
    Number.isFinite(minimumContrast) &&
    filtered.baseColor &&
    filtered.secondaryColor &&
    contrastRatio(filtered.baseColor, filtered.secondaryColor) < minimumContrast
  ) {
    receipt.protected.push({
      slot: slot.id,
      property: "color contrast",
      reason: `below protected ratio ${minimumContrast}`,
      action: "game fallback colors retained"
    });
    delete filtered.baseColor;
    delete filtered.secondaryColor;
  }

  return filtered;
}

export async function resolveSkinForGame({
  packs,
  gameContract,
  instance = null,
  policy = LOCAL_CREATOR_POLICY
}) {
  const packList = Array.isArray(packs) ? packs : [packs];
  const validation = {
    game: validateGameSkinContract(gameContract),
    packs: await Promise.all(
      packList.map(async (pack) => ({
        id: pack?.id,
        report: validateSkinPack(pack, policy),
        assets: await verifyEmbeddedAssets(pack, policy)
      }))
    )
  };
  const errors = [
    ...validation.game.errors,
    ...validation.packs.flatMap((entry) => [...entry.report.errors, ...entry.assets.errors])
  ];
  if (errors.length) {
    return {
      ok: false,
      status: "REJECTED",
      errors,
      validation
    };
  }

  const receipt = {
    type: "axm.skin-resolution-receipt",
    version: "1.0",
    gameId: gameContract.gameId,
    gameVersion: gameContract.gameVersion,
    packRefs: packList.map((pack) => ({
      id: pack.id,
      release: pack.release,
      integrity: pack.integrity?.contentSha256 ?? null
    })),
    layerEvents: [],
    instanceOverrides: [],
    applied: [],
    inherited: [],
    unsupported: [],
    protected: [],
    unknownBindings: []
  };

  const composed = mergePacks(packList, instance, receipt);
  const declaredSlots = new Set(gameContract.slots.map((slot) => slot.id));
  for (const target of composed.bindings.keys()) {
    if (!declaredSlots.has(target)) receipt.unknownBindings.push(target);
  }

  const slots = {};
  for (const slot of gameContract.slots) {
    const binding = composed.bindings.get(slot.id);
    if (!binding) {
      receipt.inherited.push({ slot: slot.id, reason: "no skin binding", fallback: slot.fallback });
      continue;
    }

    const material = composed.materials[binding.material];
    if (!material) {
      receipt.inherited.push({
        slot: slot.id,
        reason: `missing material ${binding.material}`,
        fallback: slot.fallback
      });
      continue;
    }

    const asset = binding.asset ? composed.assets[binding.asset] : null;
    slots[slot.id] = {
      kind: slot.kind,
      material: filterMaterial(material, slot, receipt),
      asset: asset ? clone(asset) : null,
      blueprint:
        slot.kind === "character-region"
          ? clone(composed.characterBlueprints[binding.blueprint ?? "default"] ?? null)
          : null
    };
    receipt.applied.push({ slot: slot.id, material: binding.material, asset: binding.asset ?? null });
  }

  const compatibility =
    receipt.applied.length === 0
      ? "INCOMPATIBLE"
      : receipt.inherited.length || receipt.unsupported.length || receipt.protected.length
        ? "PARTIAL"
        : "FULL";

  const resolved = {
    type: "axm.resolved-skin",
    version: "1.0",
    gameId: gameContract.gameId,
    gameVersion: gameContract.gameVersion,
    compatibility,
    tokens: composed.tokens,
    slots,
    accessibility: deepMerge(composed.accessibility, instance?.accessibility ?? {}),
    presentationAuthority: "ZERO_AUTHORITATIVE_WRITES"
  };
  receipt.summary = {
    applied: receipt.applied.length,
    inherited: receipt.inherited.length,
    unsupported: receipt.unsupported.length,
    protected: receipt.protected.length,
    unknownBindings: receipt.unknownBindings.length
  };
  receipt.resolutionSha256 = await sha256Hex(resolved);

  return {
    ok: true,
    status: "RESOLVED",
    compatibility,
    resolved,
    receipt,
    validation
  };
}

export function gameBindingCoverage(pack, gameContract) {
  const bindings = bindingMap(pack.bindings);
  const slots = gameContract.slots.map((slot) => ({
    id: slot.id,
    bound: bindings.has(slot.id),
    required: Boolean(slot.required)
  }));
  return {
    slots,
    total: slots.length,
    bound: slots.filter((slot) => slot.bound).length,
    missingRequired: slots.filter((slot) => slot.required && !slot.bound).map((slot) => slot.id)
  };
}
