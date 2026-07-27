#!/usr/bin/env node
"use strict";

const assert = require("assert");
const zlib = require("zlib");
const Hands = require("./asset-hands");
const Core = require("./asset-hand-core");
const TargetCanvas = require("./target-canvas");
const targetCanvasSchema = require("./target-canvas.schema.json");
const gapReportSchema = require("./asset-hand-gap-report.schema.json");
const printDocumentSchema = require("./print-document.schema.json");
const animatedRasterRecipeSchema = require("./animated-raster-recipe.schema.json");
const materialGraphSchema = require("./material-graph.schema.json");
const Finisher = require("./asset-finisher");
const contract = require("./service.contract.json");
const host = {
  capabilities: ["svg", "json", "canvas-2d", "output:image.transform"],
  permissions: [],
  accepts: [
    Hands.RESULT_SCHEMA,
    "image/svg+xml",
    "image/png",
    "image/apng",
    "image/ktx2",
    "application/json",
    "application/pdf",
    "application/dxf",
    "application/mtlx+xml",
    "application/vnd.opentimelineio+json",
    "text/css",
    "text/plain",
    "model/obj",
    "model/gltf-binary",
  ],
};
const createdAt = "2026-07-18T00:00:00.000Z";
function assertRequiredSchema(schema, value) {
  schema.required.forEach((key) =>
    assert.ok(
      Object.prototype.hasOwnProperty.call(value, key),
      schema.title + " output is missing " + key,
    ),
  );
}

assert.equal(
  Hands.list().length,
  36,
  "all admitted modular creation hands should be registered",
);
assert.equal(
  Hands.listMissingHands().length,
  0,
  "the curated fifteen-hand build should have no remaining catalog gaps",
);
assert.ok(contract.builtInHands.includes("physical-mark"));
assert.equal(
  targetCanvasSchema.properties.schema.const,
  TargetCanvas.SCHEMA,
  "standalone JSON Schema and runtime contract must agree",
);
assert.deepEqual(
  targetCanvasSchema.properties.medium.enum,
  TargetCanvas.MEDIUMS,
  "standalone schema covers every runtime canvas medium",
);
assert.equal(
  gapReportSchema.properties.schema.const,
  Hands.GAP_SCHEMA,
  "gap report runtime and standalone schema must agree",
);
assert.equal(
  printDocumentSchema.properties.schema.const,
  "axm.print-document/v1",
);
assert.equal(
  animatedRasterRecipeSchema.properties.schema.const,
  "axm.animated-raster-recipe/v1",
);
assert.equal(
  materialGraphSchema.properties.schema.const,
  "axm.material-graph/v1",
);
assert.ok(
  Hands.list().every(
    (hand) =>
      hand.schema === Hands.HAND_SCHEMA &&
      hand.contract_version === "2.0" &&
      hand.operation_modes.length &&
      hand.canvas_models.length &&
      hand.entry_surfaces.length &&
      hand.output_types.length &&
      hand.canvas_types.length &&
      hand.constraints_honoured.length &&
      hand.required_permissions &&
      hand.network_policy &&
      hand.portability &&
      typeof hand.operations.preview === "boolean" &&
      typeof hand.operations.validate === "boolean" &&
      typeof hand.operations.edit === "boolean",
  ),
  "every hand declares the v2 operation, canvas-model, output, permission, portability and validation capabilities",
);
assert.equal(
  Hands.normalizeBrief({ kind: "character" }).kind,
  "character",
  "known kinds are not silently rewritten as icons",
);
assert.equal(
  Hands.normalizeBrief({ kind: "future-special-asset" }).kind,
  "future-special-asset",
  "future modular kinds retain their semantic identity",
);

const legacy = Hands.normalizeBrief({
  id: "legacy-icon",
  title: "Legacy SVG icon",
  kind: "icon",
  width: 128,
  height: 128,
});
assert.equal(legacy.schema, Hands.BRIEF_SCHEMA);
assert.equal(legacy.target_canvas.schema, TargetCanvas.SCHEMA);
assert.equal(legacy.target_canvas.declaration, "legacy-inferred");
assert.equal(
  legacy.canvas.width,
  128,
  "legacy pixel canvas remains available to old providers",
);
const legacySvg = Hands.create("vector-form", legacy, {
  seed: "legacy",
  createdAt,
  host,
});
assert.equal(legacySvg.technical.pass, true);
assert.ok(
  legacySvg.artifacts.some(
    (artifact) =>
      artifact.mime === "image/svg+xml" && artifact.format === "SVG",
  ),
);
const legacyDescriptorResult = Core.clone(legacySvg);
legacyDescriptorResult.hand.schema = Hands.LEGACY_HAND_SCHEMA;
assert.equal(
  Core.validateResult(legacyDescriptorResult).pass,
  true,
  "saved results with embedded v1 hand descriptors remain readable",
);

const uiBrief = {
  id: "ui",
  title: "Party controls",
  kind: "ui-component",
  intended_use: "ui-component",
  target_canvas: {
    medium: "ui",
    dimensions: { width: 480, height: 240, unit: "px" },
    colour: {
      space: "srgb",
      transparency: "allowed",
      minimum_contrast_ratio: 4.5,
    },
    behaviour: ["static", "interactive", "responsive"],
    intended_use: "ui-component",
  },
  required_outputs: ["image/svg+xml", "application/json"],
  editable_recipe_formats: ["axm.ui-component-recipe/v1"],
};
const uiRoutes = Hands.routes(uiBrief, host);
assert.ok(uiRoutes.some((route) => route.hand.id === "ui-component"));
assert.ok(!uiRoutes.some((route) => route.hand.id === "surface-pattern"));

const gameBrief = {
  id: "game-tile",
  title: "Forest ground",
  kind: "tile",
  intended_use: "ground-tile",
  target_canvas: {
    medium: "game-world",
    dimensions: { width: 1, height: 1, unit: "game-world-unit" },
    colour: { space: "srgb", transparency: "opaque" },
    physical: { repeat: { mode: "xy" } },
    behaviour: ["static", "tileable"],
    intended_use: "ground-tile",
  },
  required_outputs: ["image/svg+xml"],
  editable_recipe_formats: ["axm.repeat-surface-recipe/v1"],
};
const gameRoutes = Hands.routes(gameBrief, host);
assert.ok(
  gameRoutes.some((route) => route.hand.id === "surface-pattern"),
  "game tile canvas selects a game-aware surface hand",
);

const nativeRasterBrief = {
  id: "native-raster",
  title: "Native ground texture",
  kind: "texture",
  intended_use: "ground-tile",
  target_canvas: {
    medium: "game-world",
    dimensions: { width: 32, height: 16, unit: "px" },
    colour: { space: "srgb", transparency: "opaque" },
    physical: { repeat: { mode: "xy" } },
    behaviour: ["static", "tileable"],
    performance: { max_texture_memory_bytes: 4096 },
    intended_use: "ground-tile",
  },
  required_outputs: ["image/png"],
  editable_recipe_formats: ["axm.native-raster-recipe/v1"],
};
const nativeRaster = Hands.create("raster-texture", nativeRasterBrief, {
  seed: "native-raster",
  createdAt,
  host,
});
assert.equal(nativeRaster.technical.pass, true);
assert.equal(
  nativeRaster.measures.nativeRaster,
  true,
  "the raster hand creates pixels directly rather than converting SVG",
);
assert.equal(nativeRaster.measures.textureMemoryBytes, 2048);
const nativePng = nativeRaster.artifacts.find(
  (artifact) => artifact.mime === "image/png",
);
assert.ok(
  nativePng &&
    nativePng.format === "PNG" &&
    /^data:image\/png;base64,iVBORw0KGgo/.test(nativePng.dataUrl),
);
const pngBytes = Buffer.from(nativePng.dataUrl.split(",")[1], "base64");
assert.equal(pngBytes.readUInt32BE(16), 32);
assert.equal(pngBytes.readUInt32BE(20), 16);
let pngOffset = 8,
  idat = [];
while (pngOffset < pngBytes.length) {
  const length = pngBytes.readUInt32BE(pngOffset),
    type = pngBytes.toString("ascii", pngOffset + 4, pngOffset + 8);
  if (type === "IDAT")
    idat.push(pngBytes.subarray(pngOffset + 8, pngOffset + 8 + length));
  pngOffset += 12 + length;
}
assert.equal(
  zlib.inflateSync(Buffer.concat(idat)).length,
  16 * (1 + 32 * 4),
  "native PNG scanlines are structurally decodable",
);
assert.ok(
  nativeRaster.artifacts.some(
    (artifact) => artifact.mime === "application/json" && artifact.editable,
  ),
);
assert.equal(
  Hands.create("raster-texture", nativeRasterBrief, {
    seed: "native-raster",
    createdAt,
    host,
  }).digest,
  nativeRaster.digest,
  "native raster output is deterministic for the same contract and seed",
);
const rasterLimitDiagnosis = Hands.diagnose(
  {
    ...nativeRasterBrief,
    id: "oversized-raster",
    target_canvas: {
      ...nativeRasterBrief.target_canvas,
      dimensions: { width: 2048, height: 2048, unit: "px" },
    },
  },
  host,
);
assert.equal(rasterLimitDiagnosis.schema, Hands.GAP_SCHEMA);
assert.equal(
  rasterLimitDiagnosis.status,
  "MISSING_HAND",
  "declared canvas limits prevent an unsafe raster allocation before generation",
);
assert.ok(
  rasterLimitDiagnosis.missing_hand_spec.output_types.includes("image/png"),
);
const animatedBrief = {
  id: "animated-raster",
  title: "Animated runner",
  kind: "character",
  intended_use: "character",
  target_canvas: {
    medium: "game-world",
    dimensions: { width: 48, height: 48, unit: "px" },
    colour: { space: "srgb", transparency: "required" },
    behaviour: ["animated"],
    performance: {
      max_animation_frames: 6,
      frames_per_second: 12,
      max_texture_memory_bytes: 9216,
    },
    intended_use: "character",
  },
  required_outputs: ["image/apng"],
  editable_recipe_formats: ["axm.animated-raster-recipe/v1"],
};
const animated = Hands.create("animated-raster", animatedBrief, {
  seed: "animated-raster",
  createdAt,
  host,
});
assert.equal(animated.technical.pass, true);
const apngArtifact = animated.artifacts.find(
  (artifact) => artifact.mime === "image/apng",
);
assert.ok(
  apngArtifact &&
    apngArtifact.format === "APNG" &&
    apngArtifact.dataUrl.startsWith("data:image/apng;base64,iVBORw0KGgo"),
);
assert.equal(apngArtifact.metadata.frames, 6);
assert.ok(
  apngArtifact.metadata.chunkSequence.includes("acTL") &&
    apngArtifact.metadata.chunkSequence.includes("fdAT"),
);
assertRequiredSchema(
  animatedRasterRecipeSchema,
  JSON.parse(
    animated.artifacts.find(
      (artifact) =>
        artifact.metadata &&
        artifact.metadata.schema === "axm.animated-raster-recipe/v1",
    ).text,
  ),
);

const printBrief = {
  id: "print",
  title: "Workshop poster",
  kind: "poster",
  intended_use: "poster",
  target_canvas: {
    medium: "print",
    dimensions: { width: 210, height: 297, unit: "mm" },
    colour: { space: "srgb", transparency: "opaque" },
    physical: { bleed: 3, minimum_stroke: 0.25 },
    behaviour: ["static"],
    performance: { max_file_bytes: 600000 },
    intended_use: "poster",
  },
  required_outputs: ["image/svg+xml", "application/json"],
  editable_recipe_formats: ["axm.print-layout-recipe/v1"],
  quality_requirements: {
    require_preview: true,
    require_validation: true,
    require_editable_source: true,
  },
};
const print = Hands.create("print-layout", printBrief, {
  seed: "print",
  createdAt,
  host,
});
assert.equal(
  print.target_canvas.physical.bleed,
  3,
  "canvas constraints reach the hand result",
);
assert.equal(
  print.creation_recipe.parameters.minimumStroke,
  0.25,
  "the provider recipe is shaped by the physical canvas",
);
assert.equal(print.validation_receipt.status, "PASS");
assert.ok(print.preview && print.preview.available);
const productionPrintBrief = {
  ...printBrief,
  id: "production-pdf",
  target_canvas: {
    ...printBrief.target_canvas,
    colour: { space: "cmyk", transparency: "opaque", printable_colours: true },
  },
  required_outputs: ["application/pdf"],
  editable_recipe_formats: ["axm.production-print-recipe/v1"],
};
const productionPdf = Hands.create("production-print", productionPrintBrief, {
  seed: "production-pdf",
  createdAt,
  host,
});
assert.equal(productionPdf.technical.pass, true);
const pdfArtifact = productionPdf.artifacts.find(
  (artifact) => artifact.mime === "application/pdf",
);
assert.ok(
  pdfArtifact &&
    pdfArtifact.format === "PDF" &&
    pdfArtifact.dataUrl.startsWith("data:application/pdf;base64,JVBERi0"),
);
assert.equal(pdfArtifact.metadata.colour, "DeviceCMYK");
assert.equal(pdfArtifact.metadata.bleed_mm, 3);
const printSource = productionPdf.artifacts.find(
  (artifact) =>
    artifact.metadata && artifact.metadata.schema === "axm.print-document/v1",
);
assertRequiredSchema(printDocumentSchema, JSON.parse(printSource.text));
const retargetedPdf = Hands.create(
  "production-print",
  {
    ...productionPrintBrief,
    id: "retargeted-pdf",
    operation_mode: "edit",
    source_artifacts: [printSource],
    target_canvas: {
      ...productionPrintBrief.target_canvas,
      dimensions: { width: 100, height: 150, unit: "mm" },
    },
  },
  { seed: "retargeted-pdf", createdAt, host },
);
const retargetedSource = JSON.parse(
  retargetedPdf.artifacts.find(
    (artifact) =>
      artifact.metadata && artifact.metadata.schema === "axm.print-document/v1",
  ).text,
);
assert.equal(
  retargetedSource.target_canvas.dimensions.width,
  100,
  "print edits are regenerated against the new target canvas",
);
assert.deepEqual(retargetedSource.layout.trim, [100, 150]);

const fabricBrief = {
  id: "fabric",
  title: "Jacket repeat",
  kind: "pattern",
  intended_use: "clothing-pattern",
  target_canvas: {
    medium: "fabric",
    dimensions: { width: 600, height: 900, unit: "mm" },
    colour: { space: "srgb", transparency: "opaque" },
    physical: {
      minimum_stroke: 1.2,
      repeat: { mode: "xy", width: 150, height: 150 },
      material_behaviour: ["stretch-on-bias"],
    },
    behaviour: ["static", "tileable"],
    intended_use: "clothing-pattern",
  },
  required_outputs: ["image/svg+xml"],
  editable_recipe_formats: ["axm.fabric-repeat-recipe/v1"],
};
const fabric = Hands.create("fabric-pattern", fabricBrief, {
  seed: "fabric",
  createdAt,
  host,
});
assert.deepEqual(fabric.measures.materialBehaviour, ["stretch-on-bias"]);
assert.equal(fabric.measures.repeatCell.width, 150);

const physicalBrief = {
  id: "wood",
  title: "Workshop plaque",
  kind: "logo",
  intended_use: "engraving",
  target_canvas: {
    medium: "wood",
    dimensions: { width: 180, height: 80, unit: "mm" },
    colour: { space: "grayscale", transparency: "opaque" },
    physical: {
      minimum_stroke: 0.8,
      cutting_tool_width: 1.2,
      depth: 2,
      material_behaviour: ["grain-direction-horizontal"],
    },
    behaviour: ["static"],
    intended_use: "engraving",
  },
  required_outputs: ["application/dxf"],
  editable_recipe_formats: ["axm.physical-toolpath-recipe/v1"],
};
const physical = Hands.create("physical-mark", physicalBrief, {
  seed: "wood",
  createdAt,
  host,
});
assert.ok(
  physical.artifacts.some(
    (artifact) =>
      artifact.mime === "application/dxf" && artifact.format === "DXF",
  ),
);
assert.equal(physical.measures.cuttingToolWidth.value, 1.2);
assert.equal(
  physical.technical.pass,
  true,
  "non-SVG toolpath artifacts are validated by their own type",
);

const cutBrief = {
  id: "paper-cut",
  title: "Paper stencil",
  kind: "papercraft",
  intended_use: "paper-cut",
  target_canvas: {
    medium: "paper",
    dimensions: { width: 210, height: 297, unit: "mm" },
    colour: { space: "srgb", transparency: "opaque" },
    physical: {
      bleed: 2,
      minimum_stroke: 0.8,
      cutting_tool_width: 0.5,
      material_behaviour: ["low-tack-mat"],
    },
    behaviour: ["static"],
    intended_use: "paper-cut",
  },
  required_outputs: ["application/dxf"],
  editable_recipe_formats: ["axm.cut-layout-recipe/v1"],
};
const cut = Hands.create("cut-layout", cutBrief, {
  seed: "paper-cut",
  createdAt,
  host,
});
assert.equal(cut.technical.pass, true);
assert.equal(cut.creation_recipe.parameters.toolWidth, 0.5);
assert.equal(cut.measures.bleed.value, 2);
assert.ok(
  cut.artifacts.some(
    (artifact) =>
      artifact.mime === "application/dxf" && artifact.format === "DXF",
  ),
);

const themeBrief = {
  id: "theme",
  title: "Workshop semantic theme",
  kind: "theme",
  operation_mode: "create",
  intended_use: "theme",
  target_canvas: {
    medium: "ui",
    dimensions: { width: 960, height: 540, unit: "px" },
    colour: {
      space: "srgb",
      transparency: "opaque",
      minimum_contrast_ratio: 4.5,
    },
    behaviour: ["static", "responsive"],
    intended_use: "theme",
  },
  required_outputs: ["text/css"],
  editable_recipe_formats: ["axm.theme-token-recipe/v1"],
};
const theme = Hands.create("theme-token", themeBrief, {
  seed: "theme",
  createdAt,
  host,
});
assert.equal(theme.technical.pass, true);
assert.equal(theme.hand.contract_version, "2.0");
assert.equal(theme.creation_recipe.operation_mode, "create");
assert.ok(
  theme.artifacts.some(
    (artifact) =>
      artifact.mime === "text/css" && artifact.text.includes("--axm-focus:"),
  ),
);
const tokenArtifact = theme.artifacts.find(
  (artifact) =>
    artifact.metadata &&
    artifact.metadata.schema === "axm.visual-kernel.tokens/v1",
);

const layoutBrief = {
  id: "layout",
  title: "Responsive dashboard",
  kind: "layout",
  intended_use: "layout",
  target_canvas: {
    medium: "ui",
    dimensions: { width: 1200, height: 720, unit: "px" },
    colour: {
      space: "srgb",
      transparency: "opaque",
      minimum_contrast_ratio: 4.5,
    },
    behaviour: ["static", "responsive"],
    intended_use: "layout",
  },
  required_outputs: ["axm.responsive-layout/v1"],
  editable_recipe_formats: ["axm.responsive-layout-recipe/v1"],
};
const layout = Hands.create("layout-responsive", layoutBrief, {
  seed: "layout",
  createdAt,
  host,
});
assert.equal(layout.technical.pass, true);
assert.equal(layout.creation_recipe.parameters.columns, 3);
assert.ok(layout.artifacts.some((artifact) => artifact.mime === "text/css"));

const inspectBrief = {
  id: "inspect",
  title: "Inspect theme tokens",
  kind: "inspection",
  operation_mode: "inspect",
  intended_use: "theme",
  target_canvas: themeBrief.target_canvas,
  source_artifacts: [tokenArtifact],
  required_outputs: ["axm.inspect-codegen-report/v1"],
  editable_recipe_formats: ["axm.inspect-codegen-recipe/v1"],
  quality_requirements: { require_preview: false, require_validation: true },
};
const inspect = Hands.create("inspect-codegen", inspectBrief, {
  seed: "inspect",
  createdAt,
  host,
});
assert.equal(inspect.technical.pass, true);
assert.equal(inspect.creation_recipe.operation_mode, "inspect");
assert.equal(
  inspect.creation_recipe.source_artifact_digests[0].digest,
  tokenArtifact.digest,
);
assert.ok(
  inspect.validation_receipt.checks.some(
    (check) => check.name === "source-unchanged" && check.pass,
  ),
);
const missingInspect = Hands.diagnose(
  { ...inspectBrief, id: "inspect-missing", source_artifacts: [] },
  host,
);
assert.equal(
  missingInspect.status,
  "MISSING_HAND",
  "inspect operations require a compatible typed source artifact",
);
assert.equal(missingInspect.missing_hand_spec.operation_modes[0], "inspect");

const meshBrief = {
  id: "mesh",
  title: "Workshop crate",
  kind: "mesh",
  intended_use: "mesh",
  target_canvas: {
    medium: "3d-surface",
    dimensions: { width: 2, height: 1, depth: 1, unit: "m" },
    colour: { space: "material-channel", transparency: "opaque" },
    behaviour: ["static"],
    performance: { max_polygon_count: 100 },
    intended_use: "mesh",
  },
  required_outputs: ["model/obj"],
  editable_recipe_formats: ["axm.parametric-mesh-recipe/v1"],
};
const mesh = Hands.create("parametric-mesh", meshBrief, {
  seed: "mesh",
  createdAt,
  host,
});
assert.equal(mesh.technical.pass, true);
assert.ok(
  mesh.artifacts.some(
    (artifact) =>
      artifact.mime === "model/obj" && /\nf [0-9]/.test(artifact.text),
  ),
);
const meshGlb = mesh.artifacts.find(
  (artifact) => artifact.mime === "model/gltf-binary",
);
assert.ok(
  meshGlb &&
    meshGlb.format === "GLB" &&
    meshGlb.dataUrl.startsWith("data:model/gltf-binary;base64,Z2xURg"),
);
assert.ok(mesh.measures.triangles <= 100);
assert.ok(
  mesh.hand.output_types.find((output) => output.mime === "model/obj").lossy,
  "OBJ loss is declared in the hand contract",
);

const timelineBrief = {
  id: "timeline",
  title: "Workshop promo sequence",
  kind: "timeline",
  intended_use: "timeline",
  target_canvas: {
    medium: "screen",
    dimensions: { width: 1280, height: 720, unit: "px" },
    colour: { space: "srgb", transparency: "opaque" },
    behaviour: ["animated"],
    performance: { max_animation_frames: 120, frames_per_second: 24 },
    intended_use: "timeline",
  },
  required_outputs: ["axm.film.edl/v1"],
  editable_recipe_formats: ["axm.timeline-sequence-recipe/v1"],
};
const timeline = Hands.create("timeline-sequence", timelineBrief, {
  seed: "timeline",
  createdAt,
  host,
});
assert.equal(timeline.technical.pass, true);
assert.equal(timeline.measures.fps, 24);
assert.ok(
  timeline.artifacts.some(
    (artifact) =>
      artifact.metadata && artifact.metadata.schema === "axm.film.edl/v1",
  ),
);
const otioArtifact = timeline.artifacts.find(
  (artifact) => artifact.format === "OTIO",
);
assert.ok(
  otioArtifact && JSON.parse(otioArtifact.text).OTIO_SCHEMA === "Timeline.1",
);
assert.ok(
  !timeline.hand.portability.unsupported_features.includes("OpenTimelineIO"),
);

const materialBrief = {
  id: "material",
  title: "Robot armour",
  kind: "texture",
  intended_use: "material",
  target_canvas: {
    medium: "3d-surface",
    dimensions: { width: 1, height: 1, unit: "m" },
    colour: { space: "material-channel", transparency: "opaque" },
    behaviour: ["static"],
    performance: { max_polygon_count: 12000 },
    intended_use: "material",
  },
  required_outputs: ["model/gltf-binary"],
  editable_recipe_formats: ["axm.material-graph/v1"],
};
const material = Hands.create("material-shader", materialBrief, {
  seed: "material",
  createdAt,
  host,
});
assert.equal(material.technical.pass, true);
assert.ok(
  material.artifacts.some(
    (artifact) =>
      artifact.mime === "application/mtlx+xml" &&
      artifact.text.includes('<materialx version="1.38">'),
  ),
);
assert.ok(
  material.artifacts.some(
    (artifact) =>
      artifact.mime === "model/gltf-binary" && artifact.format === "GLB",
  ),
);
assertRequiredSchema(
  materialGraphSchema,
  JSON.parse(
    material.artifacts.find(
      (artifact) =>
        artifact.metadata &&
        artifact.metadata.schema === "axm.material-graph/v1",
    ).text,
  ),
);
const compressedTextureBrief = {
  id: "compressed-material",
  title: "Compressed armour texture",
  kind: "texture",
  intended_use: "material",
  target_canvas: {
    medium: "3d-surface",
    dimensions: { width: 128, height: 128, unit: "px" },
    colour: { space: "linear-srgb", transparency: "opaque" },
    behaviour: ["static"],
    performance: { max_mip_levels: 5, max_texture_memory_bytes: 16384 },
    intended_use: "material",
  },
  required_outputs: ["image/ktx2"],
  editable_recipe_formats: ["axm.ktx2-texture-recipe/v1"],
};
const compressedTextureRoute = Hands.diagnose(compressedTextureBrief, host);
assert.equal(compressedTextureRoute.status, "READY");
assert.ok(
  compressedTextureRoute.compatible_hands.some(
    (hand) => hand.id === "ktx2-texture-delivery",
  ),
);

const rasterRegistry = Core.createRegistry([]);
rasterRegistry.register({
  descriptor: {
    id: "deterministic-raster",
    title: "Deterministic Raster Hand",
    version: "1.0.0",
    kinds: ["icon"],
    requires: [],
    produces: [Core.RESULT_SCHEMA, "image/png"],
    output_types: [{ mime: "image/png", format: "PNG", editable: false }],
    canvas_types: [
      {
        medium: "screen",
        units: ["px"],
        colour_spaces: ["srgb"],
        behaviours: ["static"],
        intended_uses: ["icon"],
      },
    ],
    constraints_honoured: [
      "dimensions",
      "dimensions.unit",
      "colour.space",
      "colour.transparency",
      "behaviour.static",
    ],
    editable_recipe_formats: [Core.RECIPE_SCHEMA],
    operations: { preview: true, validate: true, edit: false },
  },
  create: ({ brief, targetCanvas }) => ({
    artifacts: [
      {
        id: "png",
        name: brief.title,
        filename: "pixel.png",
        mime: "image/png",
        format: "PNG",
        width: 1,
        height: 1,
        dataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      },
    ],
    previewArtifactId: "png",
    recipe: { parameters: { medium: targetCanvas.medium } },
    validationChecks: [{ name: "raster-container", pass: true }],
  }),
});
const raster = rasterRegistry.create(
  "deterministic-raster",
  {
    id: "raster",
    title: "Raster icon",
    kind: "icon",
    target_canvas: {
      medium: "screen",
      dimensions: { width: 1, height: 1, unit: "px" },
      colour: { space: "srgb", transparency: "allowed" },
      behaviour: ["static"],
      intended_use: "icon",
    },
    required_outputs: ["image/png"],
  },
  { createdAt },
);
assert.equal(raster.technical.pass, true);
assert.equal(raster.artifacts[0].format, "PNG");
assert.equal(
  raster.artifacts[0].text,
  "",
  "raster bytes are not treated as SVG text",
);
const mislabeled = Core.clone(raster);
mislabeled.artifacts[0].format = "SVG";
assert.equal(
  Core.validateResult(mislabeled).pass,
  false,
  "MIME and SVG format disagreement is refused",
);

const repeatA = Hands.createFamily(gameBrief, {
  host,
  maxHands: 8,
  seed: "repeat",
  createdAt,
});
const repeatB = Hands.createFamily(gameBrief, {
  host,
  maxHands: 8,
  seed: "repeat",
  createdAt,
});
assert.deepEqual(
  repeatA.results.map((result) => result.digest),
  repeatB.results.map((result) => result.digest),
  "canvas-aware creation stays deterministic",
);
assert.ok(
  repeatA.results.every(
    (result) =>
      result.creation_recipe &&
      result.validation_receipt &&
      result.provenance &&
      result.target_canvas,
  ),
);

assert.equal(Finisher.descriptor().id, "delivery-finisher");
assert.equal(Finisher.descriptor().schema, Core.HAND_SCHEMA);
assert.ok(Finisher.source(legacySvg).text.startsWith("<svg"));
console.log(
  "AXM Asset Hands selftest: PASS (Hand Contract v2, 36 providers, 0 curated gaps, real cross-format interchange, legacy state and honest dynamic failure)",
);
