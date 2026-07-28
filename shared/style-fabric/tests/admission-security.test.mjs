import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  HOSTED_POLICY_EXAMPLE,
  LOCAL_CREATOR_POLICY,
  admitSkinPack,
  applyTreatmentToPack,
  calculateSkinIntegrity,
  compileStyleIntent,
  createSkinInstance,
  instantiateTreatmentMold,
  readSkinPackFile,
  resolveSkinForGame,
  serializeSkinPack,
  setInstanceOverride,
  sha256Hex,
  validateGameSkinContract,
  validateSkinPack
} from "../src/index.mjs";

const contract = JSON.parse(
  await readFile(
    new URL("../examples/contracts/orb-arena.game-skin-contract.json", import.meta.url),
    "utf8"
  )
);

function pack() {
  return compileStyleIntent({
    type: "axm.style-intent",
    version: "1.0",
    name: "Admission Security",
    seed: "admission-security",
    scope: ["global"],
    keywords: ["neon", "metallic"],
    intensity: 0.8,
    accessibility: {}
  });
}

test("one admission gate handles unsigned, verified, and stale-integrity packs", async () => {
  const unsigned = pack();
  const localAdmission = await admitSkinPack(unsigned, LOCAL_CREATOR_POLICY);
  assert.equal(localAdmission.ok, true);
  assert.equal(localAdmission.status, "ADMITTED_UNSIGNED");

  const signed = structuredClone(unsigned);
  signed.integrity = await calculateSkinIntegrity(signed);
  const hostedAdmission = await admitSkinPack(signed, HOSTED_POLICY_EXAMPLE);
  assert.equal(hostedAdmission.ok, true);
  assert.equal(hostedAdmission.status, "ADMITTED_INTEGRITY_VERIFIED");

  signed.metadata.name = "Mutation after signing";
  for (const policy of [LOCAL_CREATOR_POLICY, HOSTED_POLICY_EXAMPLE]) {
    const stale = await admitSkinPack(signed, policy);
    assert.equal(stale.ok, false);
    assert.equal(stale.status, "REJECTED");
    assert(stale.errors.some((entry) => entry.code === "INTEGRITY_MISMATCH"));
  }
});

test("forged raster payloads cannot cross admission or export", async () => {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(1, 16);
  bytes.writeUInt32BE(1, 20);
  const skin = pack();
  skin.assets["asset.fake-png"] = {
    mime: "image/png",
    role: "texture",
    source: {
      kind: "embedded-data",
      data: `data:image/png;base64,${bytes.toString("base64")}`
    },
    sha256: await sha256Hex(bytes),
    provenance: { origin: "adversarial-test" }
  };

  assert.equal(validateSkinPack(skin).ok, true);
  const admission = await admitSkinPack(skin);
  assert.equal(admission.ok, false);
  assert(admission.errors.some((entry) => entry.code === "RASTER_MAGIC_MISMATCH"));
  await assert.rejects(() => serializeSkinPack(skin), /cannot be finalized/i);
});

test("pack and contract validators require strict complete shapes", () => {
  const missingTokens = pack();
  delete missingTokens.tokens;
  assert.equal(validateSkinPack(missingTokens).ok, false);

  const extraMetadata = pack();
  extraMetadata.metadata.telemetry = "surprise";
  const packReport = validateSkinPack(extraMetadata);
  assert.equal(packReport.ok, false);
  assert(packReport.errors.some((entry) => entry.code === "UNKNOWN_FIELD"));

  const missingAdapter = structuredClone(contract);
  delete missingAdapter.adapterApi;
  assert.equal(validateGameSkinContract(missingAdapter).ok, false);

  const incompleteSlot = structuredClone(contract);
  delete incompleteSlot.slots[0].fallback;
  assert.equal(validateGameSkinContract(incompleteSlot).ok, false);
});

test("admission rejects accessor properties without executing them", async () => {
  const accessorPack = pack();
  let executed = false;
  Object.defineProperty(accessorPack.metadata, "name", {
    enumerable: true,
    configurable: true,
    get() {
      executed = true;
      return "Getter value";
    }
  });
  const admission = await admitSkinPack(accessorPack);
  assert.equal(admission.ok, false);
  assert(
    admission.errors.some((entry) => entry.code === "UNSAFE_DECLARATIVE_DATA")
  );
  assert.equal(executed, false);
});

test("bounded treatment stacks validate and unknown or excessive layers fail closed", () => {
  const source = pack();
  const treatment = instantiateTreatmentMold("aetherglass-cinematic", {
    seed: "admission-treatment",
    profile: "showcase",
    targets: ["ui.panel"]
  });
  const { pack: treated } = applyTreatmentToPack(source, treatment);
  assert.equal(validateSkinPack(treated).ok, true);
  assert(treated.capabilities.includes("treatment-stack.v1"));

  const materialId = treated.bindings.find(
    (binding) => binding.target === "ui.panel"
  ).material;
  const unknownField = structuredClone(treated);
  unknownField.materials[materialId].effectStack.layers[0].url =
    "https://example.invalid/shader";
  assert.equal(validateSkinPack(unknownField).ok, false);

  const excessive = structuredClone(treated);
  const seedLayer = excessive.materials[materialId].effectStack.layers[0];
  excessive.materials[materialId].effectStack.layers = Array.from(
    { length: LOCAL_CREATOR_POLICY.maxEffectLayers + 1 },
    (_, index) => ({ ...structuredClone(seedLayer), id: `layer-${index}` })
  );
  const excessiveReport = validateSkinPack(excessive);
  assert.equal(excessiveReport.ok, false);
  assert(
    excessiveReport.errors.some((entry) => entry.code === "TOO_MANY_EFFECT_LAYERS")
  );
});

test("resolver rejects stale integrity and mismatched instance pack references", async () => {
  const stale = pack();
  stale.integrity = await calculateSkinIntegrity(stale);
  stale.metadata.description = "Changed after integrity was calculated";
  const staleResolution = await resolveSkinForGame({
    packs: [stale],
    gameContract: contract,
    policy: HOSTED_POLICY_EXAMPLE
  });
  assert.equal(staleResolution.ok, false);
  assert(
    staleResolution.errors.some((entry) => entry.code === "INTEGRITY_MISMATCH")
  );

  const source = pack();
  const instance = createSkinInstance(source);
  instance.packRefs[0].release = "9.9.9";
  const mismatched = await resolveSkinForGame({
    packs: [source],
    gameContract: contract,
    instance
  });
  assert.equal(mismatched.ok, false);
  assert(
    mismatched.errors.some((entry) => entry.code === "INSTANCE_PACK_REF_MISMATCH")
  );
});

test("resolver enforces accessibility and validates instance overrides after merge", async () => {
  const source = pack();
  const originalGlow = source.materials["world.base"].glowIntensity;
  const accessibleInstance = createSkinInstance(source, {
    reducedMotion: true,
    highContrast: true,
    effectScale: 0.25
  });
  const accessible = await resolveSkinForGame({
    packs: [source],
    gameContract: contract,
    instance: accessibleInstance
  });
  assert.equal(accessible.ok, true);
  assert.equal(accessible.resolved.tokens.motion.pulseSpeed, 0);
  assert.equal(accessible.resolved.tokens.motion.shimmerSpeed, 0);
  assert.equal(accessible.resolved.accessibility.reducedMotion, true);
  assert.equal(accessible.resolved.accessibility.highContrast, true);
  assert.equal(accessible.resolved.accessibility.effectScale, 0.25);
  assert.equal(
    accessible.resolved.slots["world.background"].material.glowIntensity,
    Number((originalGlow * 0.25).toFixed(6))
  );

  const unsafeInstance = setInstanceOverride(
    createSkinInstance(source),
    ["materials", "world.base", "glowIntensity"],
    999
  );
  const unsafe = await resolveSkinForGame({
    packs: [source],
    gameContract: contract,
    instance: unsafeInstance
  });
  assert.equal(unsafe.ok, false);
  assert(
    unsafe.errors.some((entry) => entry.code === "MATERIAL_VALUE_OUT_OF_RANGE")
  );
});

test("portable import rejects oversized files before reading their contents", async () => {
  let read = false;
  const fakeFile = {
    size: LOCAL_CREATOR_POLICY.maxPackBytes + 1,
    async text() {
      read = true;
      throw new Error("oversized input should not be read");
    }
  };
  const imported = await readSkinPackFile(fakeFile);
  assert.equal(imported.ok, false);
  assert.equal(imported.status, "REJECTED");
  assert.equal(imported.errors[0].code, "PACK_TOO_LARGE");
  assert.equal(read, false);
});
