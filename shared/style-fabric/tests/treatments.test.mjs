import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { compileStyleIntent } from "../src/core/recipe.mjs";
import { stableStringify } from "../src/core/stable.mjs";
import { validateSkinPack } from "../src/core/validator.mjs";
import {
  TREATMENT_MOLDS,
  applyTreatmentToPack,
  generateTreatmentDirections,
  getTreatmentMold,
  instantiateTreatmentMold,
  listTreatmentMolds,
  validateTreatmentMold
} from "../src/core/treatments.mjs";

const MATERIAL_BOUNDS = {
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
};

const LAYER_BOUNDS = {
  opacity: [0, 1],
  intensity: [0, 1],
  threshold: [0, 1],
  softness: [0, 1],
  radius: [0, 64],
  spread: [0, 32],
  scale: [0.1, 16]
};

function assertBounds(value, bounds, label) {
  assert.equal(Number.isFinite(value), true, `${label} must be finite`);
  assert(value >= bounds[0], `${label} is below ${bounds[0]}`);
  assert(value <= bounds[1], `${label} is above ${bounds[1]}`);
}

function sourcePack() {
  return compileStyleIntent({
    type: "axm.style-intent",
    version: "1.0",
    name: "Treatment Source",
    seed: "treatment-source",
    scope: ["global"],
    keywords: ["dark", "neon"],
    intensity: 0.72,
    sharing: {
      attribution: "Treatment Test",
      license: "LicenseRef-Test",
      remixAllowed: true
    }
  });
}

test("catalog exposes three valid clone-safe treatment molds", () => {
  assert.equal(TREATMENT_MOLDS.length, 3);
  assert.deepEqual(
    TREATMENT_MOLDS.map((mold) => mold.id),
    [
      "aetherglass-cinematic",
      "neon-paper-selective",
      "accessible-night-edge"
    ]
  );
  for (const mold of TREATMENT_MOLDS) {
    const report = validateTreatmentMold(mold);
    assert.equal(report.ok, true, stableStringify(report.errors));
    assert.equal(report.checks.length, 3);
  }
  const listed = listTreatmentMolds();
  listed[0].name = "Mutated";
  assert.notEqual(getTreatmentMold(listed[0].id).name, "Mutated");
  assert.equal(getTreatmentMold("missing"), null);
});

test("portable treatment mold examples validate through the same runtime gate", async () => {
  for (const id of [
    "aetherglass-cinematic",
    "neon-paper-selective",
    "accessible-night-edge"
  ]) {
    const url = new URL(
      `../examples/treatments/${id}.treatment-mold.json`,
      import.meta.url
    );
    const example = JSON.parse(await readFile(url, "utf8"));
    const report = validateTreatmentMold(example);
    assert.equal(report.ok, true, `${id}: ${stableStringify(report.errors)}`);
    assert.equal(example.id, id);
    assert.equal(
      stableStringify(example),
      stableStringify(getTreatmentMold(id)),
      `${id} portable example drifted from its source mold`
    );
  }
});

test("same visible mold inputs produce byte-identical treatment data and receipts", () => {
  const options = {
    seed: "same-treatment-seed",
    profile: "balanced",
    targets: ["world.lighting", "ui.panel"],
    intensity: 0.81,
    variation: 0.07
  };
  const first = instantiateTreatmentMold("aetherglass-cinematic", options);
  const second = instantiateTreatmentMold("aetherglass-cinematic", options);
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.receipt.automaticWrites, 0);
  assert.equal(first.receipt.saved, false);
  assert.equal(first.receipt.runtimeApplied, false);
  assert.equal(first.receipt.promoted, false);
});

test("direction generator returns exactly three distinct ordinary drafts", () => {
  const result = generateTreatmentDirections("neon-paper-selective", {
    seed: "three-visible-directions"
  });
  assert.equal(result.directions.length, 3);
  assert.equal(result.receipt.count, 3);
  assert.equal(result.receipt.distinct, 3);
  assert.equal(result.receipt.selected, null);
  assert.equal(new Set(result.directions.map((entry) => entry.id)).size, 3);
  assert.deepEqual(
    result.directions.map((entry) => entry.type),
    ["axm.treatment", "axm.treatment", "axm.treatment"]
  );
  assert(result.directions.every((entry) => entry.status === "DRAFT"));
  assert(result.directions.every((entry) => entry.provenance.promoted === false));
});

test("compiled legacy, layer, motion, and lighting values stay inside finite bounds", () => {
  for (const mold of TREATMENT_MOLDS) {
    for (const profile of ["legacy", "balanced", "showcase", "reduced-motion"]) {
      const { treatment } = instantiateTreatmentMold(mold, {
        seed: `bounds:${mold.id}:${profile}`,
        profile,
        intensity: 1,
        variation: 0.2
      });
      for (const [target, material] of Object.entries(treatment.materials)) {
        for (const [field, bounds] of Object.entries(MATERIAL_BOUNDS)) {
          if (material[field] !== undefined) {
            assertBounds(material[field], bounds, `${target}.${field}`);
          }
        }
        assert(material.effectStack.layers.length <= 8);
        for (const layer of material.effectStack.layers) {
          for (const [field, bounds] of Object.entries(LAYER_BOUNDS)) {
            if (layer[field] !== undefined) {
              assertBounds(layer[field], bounds, `${target}.${layer.id}.${field}`);
            }
          }
          if (layer.motion) {
            assertBounds(layer.motion.speed, [0, 4], `${target}.${layer.id}.motion.speed`);
            assertBounds(layer.motion.amount, [0, 1], `${target}.${layer.id}.motion.amount`);
          }
        }
        if (material.lightingRig) {
          for (const light of ["ambient", "key", "fill", "rim"]) {
            assertBounds(
              material.lightingRig[light].intensity,
              [0, 2],
              `${target}.lightingRig.${light}.intensity`
            );
          }
          assertBounds(
            material.lightingRig.bloom.intensity,
            [0, 1],
            `${target}.lightingRig.bloom.intensity`
          );
          assertBounds(
            material.lightingRig.haze.density,
            [0, 1],
            `${target}.lightingRig.haze.density`
          );
        }
      }
    }
  }
});

test("enhanced treatments always retain flattened legacy fields", () => {
  const { treatment } = instantiateTreatmentMold("aetherglass-cinematic", {
    seed: "fallback-fields",
    profile: "showcase"
  });
  for (const [target, material] of Object.entries(treatment.materials)) {
    for (const field of [
      "baseColor",
      "secondaryColor",
      "accentColor",
      "emissiveColor",
      "emissiveStrength",
      "glowIntensity",
      "glowRadius",
      "roughness",
      "gloss",
      "opacity",
      "pulseSpeed",
      "shimmerSpeed"
    ]) {
      assert.notEqual(material[field], undefined, `${target}.${field}`);
    }
    assert.equal(material.effectStack.fallback, "legacy-material-fields");
    assert(material.effectStack.layers.length > 0);
  }
  assert(treatment.materials["world.lighting"].lightingRig);
  assert.equal(treatment.materials["ui.panel"].lightingRig, undefined);
});

test("legacy and reduced-motion profiles enforce cost and stop every motion source", () => {
  for (const profile of ["legacy", "reduced-motion"]) {
    const result = instantiateTreatmentMold("aetherglass-cinematic", {
      seed: `motion:${profile}`,
      profile,
      intensity: 1
    });
    for (const material of Object.values(result.treatment.materials)) {
      assert.equal(material.pulseSpeed, 0);
      assert.equal(material.shimmerSpeed, 0);
      const animated = material.effectStack.layers.filter(
        (layer) => layer.motion?.kind && layer.motion.kind !== "none"
      );
      assert.equal(animated.length, 0);
      assert(
        material.effectStack.layers.length <=
          (profile === "legacy" ? 3 : 6)
      );
      if (profile === "legacy") {
        assert(material.glowIntensity <= 0.22);
        assert(material.glowRadius <= 12);
        assert(material.emissiveStrength <= 0.55);
        const bloom = material.effectStack.layers.find(
          (layer) => layer.kind === "bloom"
        );
        if (bloom) assert.equal(bloom.intensity, 0);
      }
    }
    assert(
      result.receipt.profileReceipts.some(
        (entry) => entry.changes.length > 0
      )
    );
  }
});

test("application changes only requested bindings and preserves shared source materials", () => {
  const pack = sourcePack();
  const panelBinding = pack.bindings.find((entry) => entry.target === "ui.panel");
  const hudBinding = pack.bindings.find((entry) => entry.target === "ui.hud");
  hudBinding.material = panelBinding.material;
  const sharedMaterialId = panelBinding.material;
  const sharedBefore = structuredClone(pack.materials[sharedMaterialId]);

  const { treatment } = instantiateTreatmentMold("accessible-night-edge", {
    seed: "isolated-panel",
    targets: ["ui.panel"]
  });
  const result = applyTreatmentToPack(pack, treatment, {
    targets: ["ui.panel"]
  });
  const nextPanel = result.pack.bindings.find(
    (entry) => entry.target === "ui.panel"
  );
  const nextHud = result.pack.bindings.find((entry) => entry.target === "ui.hud");

  assert.notEqual(nextPanel.material, sharedMaterialId);
  assert.equal(nextHud.material, sharedMaterialId);
  assert.deepEqual(result.pack.materials[sharedMaterialId], sharedBefore);
  assert(result.pack.materials[nextPanel.material].effectStack);
  assert.equal(result.receipt.applied.length, 1);
  assert.equal(result.receipt.applied[0].target, "ui.panel");
  assert.equal(result.receipt.targetIsolation, true);
  assert.equal(result.receipt.statusPreserved, true);
  assert.equal(result.receipt.runtimeApplied, false);
  assert.equal(result.receipt.saved, false);
  assert.equal(result.receipt.promoted, false);
  assert.equal(result.receipt.automaticWrites, 0);
  assert(result.pack.capabilities.includes("treatment-stack.v1"));
  assert.equal(validateSkinPack(result.pack).ok, true);
});

test("application never invents missing bindings and reports the fallback", () => {
  const pack = sourcePack();
  pack.bindings = pack.bindings.filter(
    (binding) => binding.target !== "fx.ambient"
  );
  const { treatment } = instantiateTreatmentMold("aetherglass-cinematic", {
    seed: "missing-target",
    targets: ["fx.ambient"]
  });
  const result = applyTreatmentToPack(pack, treatment);
  assert.equal(result.receipt.applied.length, 0);
  assert.deepEqual(result.receipt.skipped, [
    { target: "fx.ambient", reason: "pack has no matching binding" }
  ]);
  assert.equal(
    result.pack.bindings.some((binding) => binding.target === "fx.ambient"),
    false
  );
});

test("code, remote URLs, and authoritative targets fail closed", () => {
  const executable = getTreatmentMold("aetherglass-cinematic");
  executable.effectStack.layers[0].code = "run()";
  const executableReport = validateTreatmentMold(executable);
  assert.equal(executableReport.ok, false);
  assert(executableReport.errors.some((entry) => entry.code === "FORBIDDEN_KEY"));

  const remote = getTreatmentMold("aetherglass-cinematic");
  remote.effectStack.layers[0].source = "https://example.invalid/texture.png";
  const remoteReport = validateTreatmentMold(remote);
  assert.equal(remoteReport.ok, false);
  assert(
    remoteReport.errors.some(
      (entry) => entry.code === "REMOTE_OR_EXECUTABLE_TEXT"
    )
  );

  const authoritative = getTreatmentMold("aetherglass-cinematic");
  authoritative.targets[0] = "gameplay.damage";
  const authoritativeReport = validateTreatmentMold(authoritative);
  assert.equal(authoritativeReport.ok, false);
  assert(
    authoritativeReport.errors.some(
      (entry) => entry.code === "NON_PRESENTATION_TARGET"
    )
  );
});

test("treatment validation rejects accessors and exotic prototypes without reading them", () => {
  let invoked = false;
  const accessor = structuredClone(TREATMENT_MOLDS[0]);
  Object.defineProperty(accessor, "name", {
    enumerable: true,
    get() {
      invoked = true;
      return "unsafe";
    }
  });
  const accessorReport = validateTreatmentMold(accessor);
  assert.equal(accessorReport.ok, false);
  assert(accessorReport.errors.some((entry) => entry.code === "UNSAFE_DATA_TREE"));
  assert.equal(invoked, false);

  const inherited = Object.create({ type: "axm.treatment-mold" });
  const inheritedReport = validateTreatmentMold(inherited);
  assert.equal(inheritedReport.ok, false);
  assert(inheritedReport.errors.some((entry) => entry.code === "UNSAFE_DATA_TREE"));
});
