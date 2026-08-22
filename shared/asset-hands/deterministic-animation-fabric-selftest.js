"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Hands = require("./asset-hands.js");
const Core = require("./asset-hand-core.js");
const Motion = require("../deterministic-animation-fabric/index.js");

function brief(overrides = {}) {
  const value = {
    id: "asset-fabric-motion-proof",
    title: "Asset Fabric Motion Proof",
    kind: "procedural-animation",
    operation_mode: "create",
    intended_use: "procedural-animation",
    target_canvas: {
      medium: "game-world",
      dimensions: { width: 96, height: 96, unit: "px" },
      colour: { space: "srgb", transparency: "allowed" },
      behaviour: ["animated"],
      intended_use: "procedural-animation",
      performance: {
        max_file_bytes: 3000000,
        max_animation_frames: 60,
        frames_per_second: 30,
        max_duration_seconds: 2,
      },
    },
    required_outputs: [
      Motion.RECIPE_SCHEMA,
      Motion.COMPOSITION_SCHEMA,
      Motion.BAKE_SCHEMA,
      Motion.RECEIPT_SCHEMA,
      "axm.sprite-atlas/v1",
      "text/css",
      "image/svg+xml",
    ],
    editable_recipe_formats: [Motion.RECIPE_SCHEMA],
    quality_requirements: {
      require_preview: true,
      require_validation: true,
      require_editable_source: true,
    },
  };
  return Object.assign(value, overrides);
}

const descriptor = Hands.list().find((item) => item.id === "deterministic-animation-fabric");
assert.ok(descriptor, "the deterministic motion hand must be registered");
assert.equal(Core.validateDescriptor(descriptor).pass, true);
assert.equal(descriptor.deterministic, true);
assert.equal(descriptor.version, "1.1.0");
assert.equal(descriptor.kinds.includes("procedural-animation"), true);
assert.equal(descriptor.authority, "candidate-only");
assert.equal(descriptor.limits.finalMediaEncoding, false);
assert.equal(descriptor.limits.maximumCompositionLayers, 128);
assert.equal(descriptor.limits.maximumAtlasFrames, 256);

const routes = Hands.routes(brief());
const route = routes.find((item) => item.hand.id === "deterministic-animation-fabric");
assert.ok(route);
assert.equal(route.compatible, true);
assert.match(route.reason, /exact asset-kind/);

const first = Hands.create("deterministic-animation-fabric", brief(), { seed: "asset-hand-proof-seed" });
const second = Hands.create("deterministic-animation-fabric", brief(), { seed: "asset-hand-proof-seed" });
assert.equal(first.status, "READY", first.technical.errors.join("; "));
assert.equal(first.digest, second.digest);
assert.deepEqual(first.artifacts, second.artifacts);
assert.deepEqual(first.creation_recipe, second.creation_recipe);
assert.equal(first.hand.id, "deterministic-animation-fabric");
assert.equal(first.artifacts.length, 8);
assert.equal(first.previewArtifactId, "deterministic-motion-filmstrip");
assert.equal(first.validation_receipt.status, "PASS");
assert.equal(first.validation_receipt.checks.every((check) => check.pass), true);
assert.equal(first.hand.authority, "candidate-only");

const compositionArtifact = first.artifacts.find((item) => item.id === "deterministic-motion-composition");
const recipeArtifact = first.artifacts.find((item) => item.id === "deterministic-motion-recipe");
const bakeArtifact = first.artifacts.find((item) => item.id === "deterministic-motion-bake");
const cssArtifact = first.artifacts.find((item) => item.id === "deterministic-motion-css");
const atlasImageArtifact = first.artifacts.find((item) => item.id === "deterministic-motion-atlas-image");
const atlasManifestArtifact = first.artifacts.find((item) => item.id === "deterministic-motion-atlas-manifest");
const svgArtifact = first.artifacts.find((item) => item.id === "deterministic-motion-filmstrip");
const verificationArtifact = first.artifacts.find((item) => item.id === "deterministic-motion-verification");
assert.equal(JSON.parse(compositionArtifact.text).schema, Motion.COMPOSITION_SCHEMA);
assert.equal(JSON.parse(compositionArtifact.text).layers.length, 2);
assert.equal(JSON.parse(recipeArtifact.text).schema, Motion.RECIPE_SCHEMA);
assert.equal(JSON.parse(bakeArtifact.text).schema, Motion.BAKE_SCHEMA);
assert.equal(JSON.parse(verificationArtifact.text).status, "PASS");
assert.equal(JSON.parse(atlasManifestArtifact.text).schema, "axm.sprite-atlas/v1");
assert.equal(JSON.parse(atlasManifestArtifact.text).frameCount, 60);
assert.match(atlasImageArtifact.text, /deterministic sprite atlas/);
assert.equal(atlasImageArtifact.metadata.exact_frame_coverage, true);
assert.match(cssArtifact.text, /@keyframes axm-motion-hero/);
assert.match(svgArtifact.text, /static|filmstrip|f59/);
assert.equal(first.creation_recipe.parameters.fixedPointPrecision, Motion.PRECISION);
assert.equal(first.measures.frames, 60);
assert.equal(first.measures.nodes >= 14, true);
assert.equal(first.measures.sources, 2);
assert.equal(first.measures.layers, 2);
assert.equal(first.measures.atlasFrames, 60);
assert.equal(first.notes.some((note) => /not good motion/.test(note)), true);

const determinism = Hands.verifyDeterminism("deterministic-animation-fabric", brief(), {
  seed: "asset-hand-proof-seed",
});
assert.equal(determinism.declared, true);
assert.equal(determinism.pass, true);
assert.equal(determinism.recipeMatch, true);
assert.equal(determinism.artifactsMatch, true);

const family = Hands.createFamily(brief(), { seed: "family-proof", limit: 4 });
assert.equal(family.status, "READY");
assert.equal(family.results.some((result) => result.hand.id === "deterministic-animation-fabric"), true);

const editBrief = brief({
  id: "asset-fabric-motion-edit-proof",
  title: "Asset Fabric Motion Edit Proof",
  operation_mode: "edit",
  source_artifacts: [
    {
      id: "source-motion-recipe",
      role: "recipe",
      name: "Motion source",
      mime: "application/json",
      format: "JSON",
      content_schema: Motion.RECIPE_SCHEMA,
      editable: true,
      text: recipeArtifact.text,
    },
  ],
});
const edited = Hands.create("deterministic-animation-fabric", editBrief, { seed: "ignored-by-source" });
assert.equal(edited.status, "READY");
assert.equal(edited.creation_recipe.parameters.sourceRecipeUsed, true);
assert.equal(edited.creation_recipe.parameters.sourceSchema, Motion.RECIPE_SCHEMA);
assert.equal(edited.measures.sources, 1);
assert.equal(edited.measures.layers, 1);

const compositionEditBrief = brief({
  id: "asset-fabric-motion-composition-edit-proof",
  title: "Asset Fabric Motion Composition Edit Proof",
  operation_mode: "edit",
  source_artifacts: [
    {
      id: "source-motion-composition",
      role: "composition",
      name: "Motion composition source",
      mime: "application/json",
      format: "JSON",
      content_schema: Motion.COMPOSITION_SCHEMA,
      editable: true,
      text: compositionArtifact.text,
    },
  ],
});
const compositionEdited = Hands.create("deterministic-animation-fabric", compositionEditBrief, { seed: "ignored-by-composition" });
assert.equal(compositionEdited.status, "READY");
assert.equal(compositionEdited.creation_recipe.parameters.sourceSchema, Motion.COMPOSITION_SCHEMA);
assert.equal(JSON.parse(compositionEdited.artifacts.find((item) => item.id === "deterministic-motion-bake").text).digest, JSON.parse(bakeArtifact.text).digest);

const tightBudget = brief();
tightBudget.target_canvas.performance.max_animation_frames = 10;
const held = Hands.create("deterministic-animation-fabric", tightBudget, { seed: "tight-budget" });
assert.equal(held.status, "READY", "generated recipes must adapt to the declared frame budget");
assert.equal(held.measures.frames, 10);

const incompatibleAtlasBrief = brief({ id: "incompatible-atlas-proof", title: "Incompatible Atlas Proof" });
incompatibleAtlasBrief.target_canvas.dimensions.unit = "game-world-unit";
const atlasHeld = Hands.create("deterministic-animation-fabric", incompatibleAtlasBrief, { seed: "atlas-hold" });
assert.equal(atlasHeld.status, "HOLD", "an explicitly requested atlas must not disappear behind a passing receipt");
assert.equal(atlasHeld.artifacts.some((item) => item.id === "deterministic-motion-atlas-manifest"), false);
assert.equal(atlasHeld.validation_receipt.checks.find((check) => check.name === "sprite-atlas-boundary").pass, false);

const apngBrief = brief({ kind: "animation", intended_use: "animation" });
apngBrief.target_canvas.intended_use = "animation";
apngBrief.required_outputs = ["image/apng"];
apngBrief.editable_recipe_formats = ["axm.animated-raster-recipe/v1"];
assert.equal(
  Hands.routes(apngBrief).some((item) => item.hand.id === "deterministic-animation-fabric"),
  false,
  "the new route must not impersonate or displace the existing APNG hand",
);

const html = fs.readFileSync(path.join(__dirname, "..", "..", "tools", "asset-fabric", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "..", "tools", "asset-fabric", "app.js"), "utf8");
assert.match(html, /<option>procedural-animation<\/option>/);
assert.ok(html.indexOf("deterministic-animation-fabric/index.js") < html.indexOf("hands/deterministic-animation-fabric.js"));
assert.ok(html.indexOf("hands/deterministic-animation-fabric.js") < html.indexOf("asset-hands.js"));
assert.match(app, /kind === "procedural-animation"/);
assert.match(app, /axm\.deterministic-animation-recipe\/v1/);
assert.match(app, /axm\.deterministic-animation-composition\/v1/);
assert.match(app, /item\.id === candidate\.preview\.artifactId/);

console.log(
  "Asset Hand deterministic animation integration selftest PASS " +
    "(clip composition route, 8 candidate artifacts, atlas coverage, repeat determinism, recipe/composition edits, APNG route preserved)",
);
