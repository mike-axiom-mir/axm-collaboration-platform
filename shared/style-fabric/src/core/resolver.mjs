import { contrastRatio } from "./color.mjs";
import { validateSkinInstance } from "./instance.mjs";
import { LOCAL_CREATOR_POLICY } from "./policy.mjs";
import { clone, deepMerge, flattenObject, sha256Hex } from "./stable.mjs";
import {
  admitSkinPack,
  validateGameSkinContract,
  validateResolvedPresentation,
  validateSkinPack
} from "./validator.mjs";

function bindingMap(bindings = []) {
  return new Map(bindings.map((binding) => [binding.target, binding]));
}

function conservativePackAccessibility(packs) {
  const declarations = packs.map((pack) => pack.accessibility ?? {});
  return {
    minimumTextContrast: Math.max(
      1,
      ...declarations.map((entry) =>
        Number.isFinite(entry.minimumTextContrast) ? entry.minimumTextContrast : 1
      )
    ),
    preserveGameplayCues: declarations.every(
      (entry) => entry.preserveGameplayCues !== false
    ),
    reducedMotionSafe: declarations.some(
      (entry) => entry.reducedMotionSafe === true
    ),
    colorIsNotOnlySignal: declarations.every(
      (entry) => entry.colorIsNotOnlySignal !== false
    )
  };
}

function instanceAccessibility(instance) {
  if (!instance) {
    return { reducedMotion: false, highContrast: false, effectScale: 1 };
  }
  const merged = deepMerge(
    instance.accessibility ?? {},
    instance.overrides?.accessibility ?? {}
  );
  return {
    reducedMotion: merged.reducedMotion === true,
    highContrast: merged.highContrast === true,
    effectScale: Number.isFinite(merged.effectScale) ? merged.effectScale : 1
  };
}

function scale(value, amount) {
  return Number((value * amount).toFixed(6));
}

function enforceAccessibility(composed, instance, receipt) {
  const preferences = instanceAccessibility(instance);
  const reducedMotion =
    preferences.reducedMotion || composed.accessibility.reducedMotionSafe === true;
  const effectScale = Math.min(1, Math.max(0, preferences.effectScale));

  if (composed.tokens?.motion) {
    if (reducedMotion) {
      composed.tokens.motion.pulseSpeed = 0;
      composed.tokens.motion.shimmerSpeed = 0;
    }
  }

  let materialChanges = 0;
  for (const material of Object.values(composed.materials)) {
    if (reducedMotion) {
      for (const field of ["pulseSpeed", "shimmerSpeed"]) {
        if (Number.isFinite(material[field]) && material[field] !== 0) {
          material[field] = 0;
          materialChanges += 1;
        }
      }
      for (const layer of material.effectStack?.layers ?? []) {
        if (!layer.motion) continue;
        if (
          layer.motion.kind !== "none" ||
          layer.motion.speed !== 0 ||
          layer.motion.amount !== 0
        ) {
          layer.motion.kind = "none";
          layer.motion.speed = 0;
          layer.motion.amount = 0;
          materialChanges += 1;
        }
      }
    }
    if (effectScale < 1) {
      for (const field of ["glowIntensity", "emissiveStrength"]) {
        if (Number.isFinite(material[field])) {
          material[field] = scale(material[field], effectScale);
          materialChanges += 1;
        }
      }
      for (const layer of material.effectStack?.layers ?? []) {
        for (const field of ["intensity", "opacity"]) {
          if (Number.isFinite(layer[field])) {
            layer[field] = scale(layer[field], effectScale);
            materialChanges += 1;
          }
        }
      }
      for (const field of ["bloom", "haze"]) {
        const treatment = material.lightingRig?.[field];
        const valueField = field === "bloom" ? "intensity" : "density";
        if (Number.isFinite(treatment?.[valueField])) {
          treatment[valueField] = scale(treatment[valueField], effectScale);
          materialChanges += 1;
        }
      }
    }
  }

  if (reducedMotion || effectScale < 1 || preferences.highContrast) {
    receipt.accessibilityEnforcement = {
      reducedMotion,
      highContrast: preferences.highContrast,
      effectScale,
      materialChanges
    };
  }
  return {
    ...composed.accessibility,
    reducedMotionSafe: reducedMotion,
    reducedMotion,
    highContrast: preferences.highContrast,
    effectScale
  };
}

function mergePacks(packs, instance, receipt) {
  const composed = {
    tokens: {},
    materials: {},
    assets: {},
    characterBlueprints: {},
    accessibility: conservativePackAccessibility(packs),
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
    const overrides = clone(instance.overrides);
    delete overrides.accessibility;
    const flattened = flattenObject(instance.overrides);
    for (const [path, value] of Object.entries(flattened)) {
      receipt.instanceOverrides.push({ path, value });
    }
    for (const root of ["tokens", "materials", "characterBlueprints"]) {
      if (overrides[root] !== undefined) {
        composed[root] = deepMerge(composed[root], overrides[root]);
      }
    }
  }
  return composed;
}

function composedValidationPack(composed, packs) {
  const first = packs[0];
  return {
    type: "axm.skin-pack",
    version: "1.0",
    id: "axm.resolver.composed",
    release: "0.6.0",
    status: "WORKING_TEST",
    metadata: {
      name: "Resolver composed presentation",
      creator: first.metadata.creator,
      license: first.metadata.license,
      remixAllowed: false
    },
    scopes: [...new Set(packs.flatMap((pack) => pack.scopes))],
    capabilities: [...new Set(packs.flatMap((pack) => pack.capabilities))],
    tokens: composed.tokens,
    materials: composed.materials,
    bindings: [...composed.bindings.values()],
    assets: composed.assets,
    characterBlueprints: composed.characterBlueprints,
    accessibility: composed.accessibility,
    provenance: { origin: "resolver-composition" },
    integrity: null
  };
}

function filterMaterial(material, slot, receipt, accessibility) {
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

  const minimumContrast = Math.max(
    Number.isFinite(slot.constraints?.minimumContrast)
      ? slot.constraints.minimumContrast
      : 1,
    slot.kind === "ui" && Number.isFinite(accessibility.minimumTextContrast)
      ? accessibility.minimumTextContrast
      : 1,
    slot.kind === "ui" && accessibility.highContrast ? 7 : 1
  );
  if (
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

function instanceReferenceErrors(instance, packs) {
  if (!instance) return [];
  const expected = packs.map((pack) =>
    `${pack.id}\u0000${pack.release}\u0000${pack.integrity?.contentSha256 ?? ""}`
  ).sort();
  const actual = instance.packRefs.map((reference) =>
    `${reference.id}\u0000${reference.release}\u0000${reference.integrity ?? ""}`
  ).sort();
  if (
    expected.length !== actual.length ||
    expected.some((entry, index) => entry !== actual[index])
  ) {
    return [{
      code: "INSTANCE_PACK_REF_MISMATCH",
      path: "$.instance.packRefs",
      message: "Instance packRefs must exactly match the admitted input packs."
    }];
  }
  return [];
}

export async function resolveSkinForGame({
  packs,
  gameContract,
  instance = null,
  policy = LOCAL_CREATOR_POLICY
}) {
  const packList = Array.isArray(packs) ? packs : [packs];
  const gameValidation = validateGameSkinContract(gameContract);
  const admissions = await Promise.all(
    packList.map(async (pack) => ({
      id: pack?.id,
      admission: await admitSkinPack(pack, policy)
    }))
  );
  const instanceValidation =
    instance === null ? { ok: true, errors: [] } : validateSkinInstance(instance);
  const validation = {
    game: gameValidation,
    packs: admissions.map((entry) => ({
      id: entry.id,
      admission: entry.admission,
      report: entry.admission.structure,
      assets: entry.admission.assets,
      integrity: entry.admission.integrity
    })),
    instance: instanceValidation,
    composed: null,
    resolved: null
  };
  const instanceErrors = instanceValidation.ok
    ? instanceReferenceErrors(instance, packList)
    : instanceValidation.errors.map((message) => ({
        code: "INVALID_SKIN_INSTANCE",
        path: "$.instance",
        message
      }));
  const errors = [
    ...gameValidation.errors,
    ...admissions.flatMap((entry) => entry.admission.errors),
    ...instanceErrors
  ];
  if (!packList.length || errors.length) {
    if (!packList.length) {
      errors.push({
        code: "NO_SKIN_PACKS",
        path: "$.packs",
        message: "At least one skin pack is required."
      });
    }
    return { ok: false, status: "REJECTED", errors, validation };
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

  let composed;
  try {
    composed = mergePacks(packList, instance, receipt);
  } catch (cause) {
    return {
      ok: false,
      status: "REJECTED",
      errors: [{ code: "COMPOSITION_REJECTED", path: "$.instance", message: cause.message }],
      validation
    };
  }
  const effectiveAccessibility = enforceAccessibility(composed, instance, receipt);
  composed.accessibility = {
    minimumTextContrast: effectiveAccessibility.minimumTextContrast,
    preserveGameplayCues: effectiveAccessibility.preserveGameplayCues,
    reducedMotionSafe: effectiveAccessibility.reducedMotionSafe,
    colorIsNotOnlySignal: effectiveAccessibility.colorIsNotOnlySignal
  };
  validation.composed = validateSkinPack(
    composedValidationPack(composed, packList),
    { ...policy, requireIntegrity: false, allowUnsigned: true }
  );
  if (!validation.composed.ok) {
    return {
      ok: false,
      status: "REJECTED",
      errors: validation.composed.errors,
      validation
    };
  }

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
      material: filterMaterial(material, slot, receipt, effectiveAccessibility),
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
    accessibility: effectiveAccessibility,
    presentationAuthority: "ZERO_AUTHORITATIVE_WRITES"
  };
  validation.resolved = validateResolvedPresentation(resolved, gameContract, policy);
  if (!validation.resolved.ok) {
    return {
      ok: false,
      status: "REJECTED",
      errors: validation.resolved.errors,
      validation
    };
  }

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
