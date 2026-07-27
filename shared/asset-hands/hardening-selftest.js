#!/usr/bin/env node
"use strict";

const assert = require("assert");
const Core = require("./asset-hand-core");
const Hands = require("./asset-hands");
const TargetCanvas = require("./target-canvas");
const Raster = require("./raster-codec");
const Pdf = require("./pdf-codec");
const GlTF = require("./gltf-codec");
const Otio = require("./otio-codec");
const Finisher = require("./asset-finisher");

const createdAt = "2000-01-01T00:00:00.000Z";
const host = {
  capabilities: ["svg", "json", "canvas-2d", "output:image.transform"],
  permissions: [],
  accepts: [
    Core.RESULT_SCHEMA,
    "application/json",
    "image/svg+xml",
    "image/png",
    "image/apng",
    "application/pdf",
    "model/gltf-binary",
    "application/vnd.opentimelineio+json",
  ],
};
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("PASS " + name);
  } catch (error) {
    console.error("FAIL " + name + "\n  " + ((error && error.stack) || error));
    process.exitCode = 1;
  }
}
function canvas(overrides) {
  const base = {
    medium: "screen",
    dimensions: { width: 64, height: 64, unit: "px" },
    colour: { space: "srgb", transparency: "allowed" },
    behaviour: ["static"],
    intended_use: "test",
  };
  return Object.assign(base, overrides || {});
}
function brief(id, overrides) {
  return Object.assign(
    {
      id,
      title: id,
      kind: "test",
      operation_mode: "create",
      intended_use: "test",
      target_canvas: canvas(),
      required_outputs: ["axm.test-artifact/v1"],
      editable_recipe_formats: [Core.RECIPE_SCHEMA],
      quality_requirements: {
        require_preview: false,
        require_validation: true,
      },
    },
    overrides || {},
  );
}
function descriptor(id, overrides) {
  return Object.assign(
    {
      schema: Core.HAND_SCHEMA,
      contract_version: "2.0",
      id,
      title: id,
      version: "1.0.0",
      category: "test",
      lifecycle_status: "test",
      operation_modes: ["create"],
      canvas_models: ["vector-document"],
      entry_surfaces: ["selftest"],
      mutability: "create-only",
      kinds: ["test"],
      accepts: [Core.BRIEF_SCHEMA],
      produces: [Core.RESULT_SCHEMA, "axm.test-artifact/v1"],
      input_types: [],
      output_types: [
        {
          mime: "application/json",
          format: "JSON",
          schema: "axm.test-artifact/v1",
          role: "test-delivery",
          editable: false,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
      ],
      canvas_types: [
        {
          medium: "screen",
          units: ["px"],
          colour_spaces: ["srgb"],
          transparency_modes: ["required", "allowed", "opaque"],
          material_behaviours: [],
          behaviours: ["static"],
          intended_uses: ["test", "*"],
        },
      ],
      constraints_honoured: [
        "dimensions",
        "dimensions.unit",
        "colour.space",
        "colour.transparency",
        "behaviour.static",
        "performance.max-file-bytes",
      ],
      editable_recipe_formats: [Core.RECIPE_SCHEMA],
      operations: { preview: false, validate: true, edit: false },
      emits_editable_source: false,
      supports_edit_operation: false,
      requires: [],
      deterministic: true,
      required_permissions: { local_file_system: "none", network_domains: [] },
      network_policy: { mode: "none", domains: [] },
      implementation_status: "executable",
      safety_tier: "safe-local",
    },
    overrides || {},
  );
}
function goodDraft(extra) {
  return Object.assign(
    {
      artifacts: [
        {
          id: "test",
          role: "test-delivery",
          name: "test",
          filename: "test.json",
          mime: "application/json",
          format: "JSON",
          editable: false,
          text: JSON.stringify({ schema: "axm.test-artifact/v1", ok: true }),
          metadata: { schema: "axm.test-artifact/v1" },
        },
      ],
      recipe: { format: Core.RECIPE_SCHEMA },
      validationChecks: [{ name: "provider-test", pass: true }],
    },
    extra || {},
  );
}
function bytes(dataUrl) {
  return new Uint8Array(
    Buffer.from(String(dataUrl).split(",")[1] || "", "base64"),
  );
}

test("all installed hands and the finisher satisfy strict native-v2 descriptors", () => {
  Hands.list().forEach((hand) => {
    const result = Hands.validateDescriptor(hand);
    assert.equal(result.pass, true, hand.id + ": " + result.errors.join("; "));
    assert.equal(hand.source_contract, "native-v2");
  });
  assert.equal(Core.validateDescriptor(Finisher.descriptor()).pass, true);
});

test("native-v2 registration rejects implicit output and transparency claims", () => {
  const bad = descriptor("implicit-hand");
  delete bad.output_types[0].deterministic;
  delete bad.canvas_types[0].transparency_modes;
  const validation = Core.validateDescriptor(bad);
  assert.equal(validation.pass, false);
  assert(validation.errors.some((error) => /deterministic/.test(error)));
  assert(validation.errors.some((error) => /transparency/.test(error)));
  assert.throws(
    () =>
      Core.createRegistry([]).register({
        descriptor: bad,
        create: () => goodDraft(),
      }),
    /invalid asset hand descriptor/,
  );
});

test("invalid declared canvases are visible and never invoke a hand", () => {
  let invocations = 0;
  const registry = Core.createRegistry([
    {
      descriptor: descriptor("never-run"),
      create: () => {
        invocations += 1;
        return goodDraft();
      },
    },
  ]);
  const invalid = brief("invalid", {
    target_canvas: {
      medium: "screen",
      dimensions: { width: -2, height: 64, unit: "px" },
      colour: {
        space: "srgb",
        transparency: "opaque",
        printable_colours: "yes",
      },
      responsive: {
        breakpoints: [{ min_width: 900, max_width: 300, unit: "px" }],
      },
      spatial: { origin: [0, 1] },
      temporal: { frame_rate_numerator: 24, frame_rate_denominator: 1 },
      performance: { frames_per_second: 30 },
      behaviour: ["static"],
      intended_use: "test",
    },
  });
  const diagnosis = registry.diagnose(invalid, host),
    family = registry.createFamily(invalid, { host });
  assert.equal(diagnosis.status, "INVALID_CANVAS");
  assert.equal(family.status, "INVALID_CANVAS");
  assert.equal(invocations, 0);
  assert(
    diagnosis.rejections[0].reason.includes(
      "declared target canvas is invalid",
    ),
  );
});

test("an unknown canvas returns UNSUPPORTED_CANVAS rather than a substitute", () => {
  const registry = Core.createRegistry([
    { descriptor: descriptor("screen-only"), create: () => goodDraft() },
  ]);
  const request = brief("3d", {
    target_canvas: {
      medium: "3d-surface",
      dimensions: { width: 1, height: 1, unit: "m" },
      colour: { space: "material-channel", transparency: "opaque" },
      behaviour: ["static"],
      intended_use: "test",
    },
  });
  const family = registry.createFamily(request, { host });
  assert.equal(family.status, "UNSUPPORTED_CANVAS");
  assert.equal(family.results.length, 0);
  assert.equal(family.issues[0].code, "UNSUPPORTED_CANVAS");
});

test("generalist fallback is opt-in and remains visible in diagnosis", () => {
  const wildcard = descriptor("generalist", {
      kinds: ["*"],
      wildcard_kind_policy: "fallback",
    }),
    registry = Core.createRegistry([
      { descriptor: wildcard, create: () => goodDraft() },
    ]);
  const request = brief("future", { kind: "future-kind" });
  assert.equal(registry.diagnose(request, host).status, "MISSING_HAND");
  const allowed = Object.assign({}, request, {
    fallback_policy: { generalist: "permitted" },
  });
  assert.equal(registry.diagnose(allowed, host).status, "READY");
  assert.equal(
    registry.createFamily(allowed, { host, maxHands: 1, createdAt }).results
      .length,
    1,
  );
});

test("postconditions hold a provider that lies about artifact type, editability or recipe", () => {
  const lying = descriptor("lying-hand", {
      emits_editable_source: true,
      output_types: [
        {
          mime: "application/json",
          format: "JSON",
          schema: "axm.test-artifact/v1",
          role: "editable-source",
          editable: true,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
      ],
      editable_recipe_formats: [Core.RECIPE_SCHEMA, "axm.test-recipe/v1"],
    }),
    registry = Core.createRegistry([
      {
        descriptor: lying,
        create: () => ({
          artifacts: [
            {
              id: "wrong",
              mime: "application/json",
              format: "JSON",
              editable: false,
              text: JSON.stringify({ schema: "axm.wrong/v1" }),
              metadata: { schema: "axm.wrong/v1" },
            },
          ],
          recipe: { format: "axm.wrong-recipe/v1" },
          validationChecks: [],
        }),
      },
    ]);
  const result = registry.create(
    "lying-hand",
    brief("lied", {
      editable_recipe_formats: ["axm.test-recipe/v1"],
      quality_requirements: {
        require_preview: false,
        require_validation: true,
        require_editable_source: true,
      },
    }),
    { host, createdAt },
  );
  assert.equal(result.status, "HOLD");
  assert.equal(result.failure_code, "HAND_OUTPUT_REJECTED");
  assert(result.technical.errors.includes("declared-artifact-types"));
  assert(
    result.technical.errors.some(
      (error) => error.indexOf("editable-recipe:") === 0,
    ),
  );
  assert(result.technical.errors.includes("editable-source-emitted"));
});

test("minimum quality and file budgets are enforced after generation", () => {
  const registry = Core.createRegistry([
    {
      descriptor: descriptor("scored"),
      create: () => goodDraft({ measures: { qualityScore: 0.8 } }),
    },
  ]);
  const pass = registry.create(
    "scored",
    brief("quality-pass", {
      quality_requirements: {
        require_preview: false,
        require_validation: true,
        minimum_quality_score: 0.8,
      },
    }),
    { host, createdAt },
  );
  assert.equal(pass.technical.pass, true);
  const low = registry.create(
    "scored",
    brief("quality-low", {
      quality_requirements: {
        require_preview: false,
        require_validation: true,
        minimum_quality_score: 0.81,
      },
    }),
    { host, createdAt },
  );
  assert.equal(low.status, "HOLD");
  assert(low.technical.errors.includes("minimum-quality-score"));
  const large = registry.create(
    "scored",
    brief("file-small", {
      target_canvas: canvas({ performance: { max_file_bytes: 10 } }),
    }),
    { host, createdAt },
  );
  assert.equal(large.status, "HOLD");
  assert(large.technical.errors.includes("core-file-budget"));
});

test("pixel and animation budgets shape output rather than acting as desired counts", () => {
  const request = {
    id: "two-frame",
    title: "Two frame runner",
    kind: "character",
    intended_use: "character",
    target_canvas: {
      medium: "game-world",
      dimensions: { width: 16, height: 16, unit: "px" },
      colour: { space: "srgb", transparency: "required" },
      behaviour: ["animated"],
      performance: { max_animation_frames: 2, frames_per_second: 12 },
      intended_use: "character",
    },
    required_outputs: ["axm.sprite-atlas/v1"],
    editable_recipe_formats: ["axm.pixel-grid-recipe/v1"],
  };
  const result = Hands.create("pixel-sprite", request, {
    host,
    createdAt,
    seed: "two-frame",
  });
  assert.equal(result.technical.pass, true);
  assert.equal(result.measures.frameCount, 2);
  assert.equal(
    JSON.parse(
      result.artifacts.find(
        (item) =>
          item.metadata && item.metadata.schema === "axm.sprite-atlas/v1",
      ).text,
    ).frames.length,
    2,
  );
});

test("unsupported colour and oversized production canvases fail before generation", () => {
  const animation = {
    id: "p3-apng",
    title: "P3 motion",
    kind: "animation",
    intended_use: "animation",
    target_canvas: {
      medium: "screen",
      dimensions: { width: 64, height: 64, unit: "px" },
      colour: { space: "display-p3", transparency: "allowed" },
      behaviour: ["animated"],
      performance: { max_animation_frames: 4 },
      intended_use: "animation",
    },
    required_outputs: ["image/apng"],
    editable_recipe_formats: ["axm.animated-raster-recipe/v1"],
  };
  const print = {
    id: "huge-print",
    title: "Huge print",
    kind: "poster",
    intended_use: "poster",
    target_canvas: {
      medium: "print",
      dimensions: { width: 3000, height: 3000, unit: "mm" },
      colour: {
        space: "cmyk",
        transparency: "opaque",
        printable_colours: true,
      },
      physical: { bleed: 3 },
      behaviour: ["static"],
      intended_use: "poster",
    },
    required_outputs: ["application/pdf"],
    editable_recipe_formats: ["axm.production-print-recipe/v1"],
  };
  assert.equal(Hands.diagnose(animation, host).status, "MISSING_HAND");
  assert.equal(Hands.diagnose(print, host).status, "MISSING_HAND");
});

test("strict inspection holds malformed JSON and corrupted native containers", () => {
  const inspectCanvas = {
    medium: "screen",
    dimensions: { width: 64, height: 64, unit: "px" },
    colour: { space: "srgb", transparency: "opaque" },
    behaviour: ["static"],
    intended_use: "inspection",
  };
  function inspectSource(id, source) {
    return Hands.create(
      "inspect-codegen",
      {
        id,
        title: id,
        kind: "inspection",
        operation_mode: "validate",
        intended_use: "inspection",
        target_canvas: inspectCanvas,
        source_artifacts: [source],
        required_outputs: ["axm.inspect-codegen-report/v1"],
        editable_recipe_formats: ["axm.inspect-codegen-recipe/v1"],
        quality_requirements: {
          require_preview: false,
          require_validation: true,
          strict_validation: true,
        },
      },
      { host, createdAt, seed: id },
    );
  }
  assert.equal(
    inspectSource("bad-json", {
      id: "json",
      name: "bad JSON",
      role: "source",
      mime: "application/json",
      format: "JSON",
      text: '{"broken":',
    }).status,
    "HOLD",
  );
  const raster = Hands.create(
      "raster-texture",
      {
        id: "png-source",
        title: "PNG",
        kind: "texture",
        intended_use: "texture",
        target_canvas: {
          medium: "screen",
          dimensions: { width: 8, height: 8, unit: "px" },
          colour: { space: "srgb", transparency: "opaque" },
          behaviour: ["static"],
          intended_use: "texture",
        },
        required_outputs: ["image/png"],
        editable_recipe_formats: ["axm.native-raster-recipe/v1"],
      },
      { host, createdAt, seed: "png-source" },
    ),
    png = raster.artifacts.find((item) => item.mime === "image/png"),
    corrupt = Buffer.from(png.dataUrl.split(",")[1], "base64");
  corrupt[corrupt.length - 1] ^= 255;
  assert.equal(
    inspectSource("bad-png", {
      id: "png",
      name: "bad PNG",
      role: "source",
      mime: "image/png",
      format: "PNG",
      dataUrl: "data:image/png;base64," + corrupt.toString("base64"),
    }).status,
    "HOLD",
  );
});

test("PDF, GLB and OTIO validators reject structural tampering", () => {
  const pdf = Pdf.encodePrintDocument({
    widthMm: 100,
    heightMm: 150,
    bleedMm: 3,
    minimumStrokeMm: 0.2,
    title: "Hardening",
  });
  assert.equal(Pdf.inspect(pdf.bytes).pass, true);
  assert.equal(
    Pdf.inspect(pdf.bytes.slice(0, Math.max(1, pdf.bytes.length - 20))).pass,
    false,
  );
  const mesh = Hands.create(
      "parametric-mesh",
      {
        id: "glb",
        title: "GLB",
        kind: "mesh",
        intended_use: "mesh",
        target_canvas: {
          medium: "3d-surface",
          dimensions: { width: 1, height: 1, depth: 1, unit: "m" },
          colour: { space: "material-channel", transparency: "opaque" },
          behaviour: ["static"],
          performance: { max_polygon_count: 20 },
          intended_use: "mesh",
        },
        required_outputs: ["model/gltf-binary"],
        editable_recipe_formats: ["axm.parametric-mesh-recipe/v1"],
      },
      { host, createdAt, seed: "glb" },
    ),
    glb = bytes(
      mesh.artifacts.find((item) => item.mime === "model/gltf-binary").dataUrl,
    );
  assert.equal(GlTF.inspect(glb).pass, true);
  const brokenGlb = glb.slice();
  brokenGlb[4] = 1;
  assert.equal(GlTF.inspect(brokenGlb).pass, false);
  const timeline = Hands.create(
      "timeline-sequence",
      {
        id: "otio",
        title: "OTIO",
        kind: "timeline",
        intended_use: "timeline",
        target_canvas: {
          medium: "screen",
          dimensions: { width: 640, height: 360, unit: "px" },
          colour: { space: "srgb", transparency: "opaque" },
          behaviour: ["animated"],
          performance: { max_animation_frames: 48, frames_per_second: 24 },
          intended_use: "timeline",
        },
        required_outputs: ["application/vnd.opentimelineio+json"],
        editable_recipe_formats: ["axm.timeline-sequence-recipe/v1"],
      },
      { host, createdAt, seed: "otio" },
    ),
    otio = timeline.artifacts.find((item) => item.format === "OTIO");
  assert.equal(Otio.inspect(otio.text).pass, true);
  const brokenOtio = JSON.parse(otio.text);
  brokenOtio.OTIO_SCHEMA = "NotTimeline.1";
  assert.equal(Otio.inspect(brokenOtio).pass, false);
});

test("print edits affect actual PDF content and preserve the original canvas", () => {
  const target = {
    medium: "print",
    dimensions: { width: 100, height: 150, unit: "mm" },
    colour: { space: "cmyk", transparency: "opaque", printable_colours: true },
    physical: { bleed: 3, minimum_stroke: 0.2 },
    behaviour: ["static"],
    intended_use: "poster",
  };
  const request = {
      id: "print-a",
      title: "Original title",
      kind: "poster",
      intended_use: "poster",
      target_canvas: target,
      required_outputs: ["application/pdf"],
      editable_recipe_formats: ["axm.production-print-recipe/v1"],
    },
    first = Hands.create("production-print", request, {
      host,
      createdAt,
      seed: "print-a",
    }),
    source = first.artifacts.find(
      (item) =>
        item.metadata && item.metadata.schema === "axm.print-document/v1",
    ),
    edited = JSON.parse(source.text);
  edited.elements.find((item) => item.kind === "title").text = "Edited title";
  const second = Hands.create(
      "production-print",
      Object.assign({}, request, {
        id: "print-b",
        operation_mode: "edit",
        source_artifacts: [
          Object.assign({}, source, { text: JSON.stringify(edited) }),
        ],
      }),
      { host, createdAt, seed: "print-b" },
    ),
    firstPdf = first.artifacts.find((item) => item.mime === "application/pdf"),
    secondPdf = second.artifacts.find(
      (item) => item.mime === "application/pdf",
    );
  assert.notEqual(firstPdf.digest, secondPdf.digest);
  assert.equal(secondPdf.metadata.rendered_content.title, "Edited title");
  assert.deepEqual(second.target_canvas_original, target);
});

test("the finisher refuses unsupported canvas semantics before output work", () => {
  const vector = Hands.create(
    "vector-form",
    {
      id: "finish",
      title: "Finish",
      kind: "icon",
      intended_use: "icon",
      target_canvas: {
        medium: "screen",
        dimensions: { width: 64, height: 64, unit: "px" },
        colour: { space: "srgb", transparency: "allowed" },
        behaviour: ["static"],
        intended_use: "icon",
      },
      required_outputs: ["image/svg+xml"],
      editable_recipe_formats: ["axm.vector-geometry-recipe/v1"],
    },
    { host, createdAt, seed: "finish" },
  );
  assert.equal(Finisher.validateRequest(vector, "PNG").pass, true);
  assert.equal(Finisher.validateRequest(vector, "JPEG").pass, false);
  const p3 = Core.clone(vector);
  p3.target_canvas.colour.space = "display-p3";
  assert.equal(Finisher.validateRequest(p3, "PNG").pass, false);
  const animated = Core.clone(vector);
  animated.target_canvas.behaviour = ["animated"];
  assert.equal(Finisher.validateRequest(animated, "PNG").pass, false);
});

test("kerf, tolerance and stock thickness reach physical geometry and receipts", () => {
  function request(id, kerf) {
    return {
      id,
      title: id,
      kind: "logo",
      intended_use: "engraving",
      target_canvas: {
        medium: "wood",
        dimensions: { width: 100, height: 80, depth: 2, unit: "mm" },
        colour: { space: "grayscale", transparency: "opaque" },
        physical: {
          minimum_stroke: 0.5,
          cutting_tool_width: 2,
          depth: 2,
          tolerance: 0.25,
          material_thickness: 5,
          kerf_side: kerf,
          material_behaviour: ["grain-direction-horizontal"],
        },
        behaviour: ["static"],
        intended_use: "engraving",
      },
      required_outputs: ["axm.physical-tooling-spec/v1"],
      editable_recipe_formats: ["axm.physical-toolpath-recipe/v1"],
    };
  }
  const inside = Hands.create("physical-mark", request("inside", "inside"), {
      host,
      createdAt,
      seed: "kerf",
    }),
    outside = Hands.create("physical-mark", request("outside", "outside"), {
      host,
      createdAt,
      seed: "kerf",
    });
  assert.equal(inside.validation_receipt.status, "PASS");
  assert.equal(outside.validation_receipt.status, "PASS");
  const insideSpec = JSON.parse(
      inside.artifacts.find(
        (item) =>
          item.metadata &&
          item.metadata.schema === "axm.physical-tooling-spec/v1",
      ).text,
    ),
    outsideSpec = JSON.parse(
      outside.artifacts.find(
        (item) =>
          item.metadata &&
          item.metadata.schema === "axm.physical-tooling-spec/v1",
      ).text,
    );
  assert.equal(insideSpec.kerf.side, "inside");
  assert.equal(insideSpec.tolerance.value, 0.25);
  assert.equal(insideSpec.materialThickness.value, 5);
  assert.notEqual(insideSpec.kerf.offset.value, outsideSpec.kerf.offset.value);
  assert.notEqual(
    inside.artifacts.find((item) => item.format === "DXF").digest,
    outside.artifacts.find((item) => item.format === "DXF").digest,
  );
});

test("material opacity is authored in graph, MaterialX and GLB preview inputs", () => {
  const request = {
    id: "alpha-material",
    title: "Glass material",
    kind: "material",
    intended_use: "material",
    target_canvas: {
      medium: "3d-surface",
      dimensions: { width: 1, height: 1, depth: 1, unit: "m" },
      colour: { space: "material-channel", transparency: "allowed" },
      behaviour: ["static"],
      performance: { max_polygon_count: 200 },
      intended_use: "material",
    },
    required_outputs: ["axm.material-graph/v1"],
    editable_recipe_formats: ["axm.material-graph/v1"],
  };
  const result = Hands.create("material-shader", request, {
      host,
      createdAt,
      seed: "alpha-material",
    }),
    graph = JSON.parse(
      result.artifacts.find(
        (item) =>
          item.metadata && item.metadata.schema === "axm.material-graph/v1",
      ).text,
    ),
    mtlx = result.artifacts.find((item) => item.format === "MTLX").text,
    glb = GlTF.inspect(
      bytes(result.artifacts.find((item) => item.format === "GLB").dataUrl),
    );
  assert.equal(result.validation_receipt.status, "PASS");
  assert(graph.parameters.opacity < 1);
  assert(mtlx.includes('name="opacity"'));
  assert.equal(glb.pass, true);
  assert(glb.json.materials[0].pbrMetallicRoughness.baseColorFactor[3] < 1);
});

test("declared responsive breakpoints, locale and RTL direction shape layout output", () => {
  const request = {
    id: "rtl-layout",
    title: "RTL layout",
    kind: "layout",
    intended_use: "layout",
    target_canvas: {
      medium: "ui",
      dimensions: { width: 720, height: 480, unit: "px" },
      colour: {
        space: "srgb",
        transparency: "opaque",
        minimum_contrast_ratio: 4.5,
      },
      responsive: {
        breakpoints: [
          { id: "small", max_width: 500, unit: "px" },
          { id: "large", min_width: 501, unit: "px" },
        ],
        locale: "ar",
        direction: "rtl",
        minimum_target_size: 48,
        reduced_motion: true,
      },
      accessibility: { reading_order: true, focus_visible: true },
      behaviour: ["responsive"],
      intended_use: "layout",
    },
    required_outputs: ["axm.responsive-layout/v1"],
    editable_recipe_formats: ["axm.responsive-layout-recipe/v1"],
  };
  const result = Hands.create("layout-responsive", request, {
      host,
      createdAt,
      seed: "rtl-layout",
    }),
    layout = JSON.parse(
      result.artifacts.find(
        (item) =>
          item.metadata && item.metadata.schema === "axm.responsive-layout/v1",
      ).text,
    ),
    css = result.artifacts.find((item) => item.format === "CSS").text,
    svg = result.artifacts.find((item) => item.format === "SVG").text;
  assert.equal(result.validation_receipt.status, "PASS");
  assert.deepEqual(
    layout.breakpoints.map((item) => item.id),
    ["small", "large"],
  );
  assert.equal(layout.container.direction, "rtl");
  assert.equal(layout.container.locale, "ar");
  assert(css.includes("min-width:501px"));
  assert(css.includes("prefers-reduced-motion"));
  assert(svg.includes('direction="rtl"'));
  assert(svg.includes('xml:lang="ar"'));
});

test("repeat-size requests select true repeat hands and preserve analytic seam proof", () => {
  const request = {
    id: "sized-repeat",
    title: "Sized repeat",
    kind: "pattern",
    intended_use: "pattern",
    target_canvas: {
      medium: "screen",
      dimensions: { width: 192, height: 96, unit: "px" },
      colour: { space: "srgb", transparency: "opaque" },
      physical: { repeat: { mode: "xy", width: 48, height: 24 } },
      behaviour: ["static", "tileable"],
      intended_use: "pattern",
    },
    required_outputs: ["image/svg+xml"],
    editable_recipe_formats: ["axm.repeat-surface-recipe/v1"],
  };
  const routes = Hands.routes(request, host);
  assert(routes.some((route) => route.hand.id === "surface-pattern"));
  assert(!routes.some((route) => route.hand.id === "raster-texture"));
  const result = Hands.create("surface-pattern", request, {
    host,
    createdAt,
    seed: "sized-repeat",
  });
  assert.equal(result.validation_receipt.status, "PASS");
  assert.deepEqual(result.measures.repeatCell, {
    width: 48,
    height: 24,
    unit: "px",
  });
  assert.equal(result.measures.seamProof.pass, true);
});

test("total-duration budgets shape animation and reject impossible APNG timing", () => {
  const pixel = {
    id: "duration-pixel",
    title: "Duration pixel",
    kind: "character",
    intended_use: "character",
    target_canvas: {
      medium: "game-world",
      dimensions: { width: 16, height: 16, unit: "px" },
      colour: { space: "srgb", transparency: "required" },
      behaviour: ["animated"],
      performance: {
        max_animation_frames: 4,
        frames_per_second: 20,
        max_duration_seconds: 0.1,
      },
      intended_use: "character",
    },
    required_outputs: ["axm.sprite-atlas/v1"],
    editable_recipe_formats: ["axm.pixel-grid-recipe/v1"],
  };
  const result = Hands.create("pixel-sprite", pixel, {
    host,
    createdAt,
    seed: "duration-pixel",
  });
  assert.equal(result.measures.frameCount, 2);
  assert(result.measures.durationSeconds <= 0.1);
  const impossible = {
    id: "too-fast",
    title: "Impossible APNG",
    kind: "animation",
    intended_use: "animation",
    target_canvas: {
      medium: "screen",
      dimensions: { width: 32, height: 32, unit: "px" },
      colour: { space: "srgb", transparency: "allowed" },
      behaviour: ["animated"],
      performance: { max_animation_frames: 2, max_duration_seconds: 0.001 },
      intended_use: "animation",
    },
    required_outputs: ["image/apng"],
    editable_recipe_formats: ["axm.animated-raster-recipe/v1"],
  };
  const diagnosis = Hands.diagnose(impossible, host);
  assert.equal(diagnosis.status, "MISSING_HAND");
  assert(
    diagnosis.rejections
      .find((item) => item.handId === "animated-raster")
      .reason.includes("duration budget"),
  );
});

test("visible hand-gap catalog closes while native bridging remains permission and bundle gated", () => {
  assert.equal(Hands.listMissingHands().length, 0);
  assert.equal(new Set(Hands.list().map((hand) => hand.id)).size, Hands.list().length);
  assert(
    Hands.list().some(
      (hand) =>
        hand.id === "native-dcc-bridge" &&
        hand.implementation_status === "executable",
    ),
  );
  const request = {
    id: "native-bridge-gap",
    title: "Native DCC bridge gap",
    kind: "3d-model",
    operation_mode: "workflow",
    intended_use: "native-bridge",
    target_canvas: {
      medium: "screen",
      dimensions: { width: 1280, height: 720, unit: "px" },
      colour: { space: "srgb", transparency: "opaque" },
      behaviour: ["static"],
      intended_use: "native-bridge",
    },
    required_outputs: ["bridge-receipt"],
    editable_recipe_formats: [],
  };
  const diagnosis = Hands.diagnose(request, host);
  assert.equal(diagnosis.status, "MISSING_HAND");
  assert.deepEqual(diagnosis.planned_hands, []);
  const nativeRejection = diagnosis.rejections.find(
    (item) => item.handId === "native-dcc-bridge",
  );
  assert(nativeRejection);
  assert.equal(nativeRejection.code, "MISSING_HAND");
  assert(
    nativeRejection.reason.includes("requires one compatible source artifact"),
  );
  assert.equal(Hands.routes(request, host).length, 0);
});

test("deterministic receipts and canvas originals survive repeated creation", () => {
  const request = {
    id: "determinism",
    title: "Deterministic timeline",
    kind: "timeline",
    intended_use: "timeline",
    target_canvas: {
      medium: "screen",
      dimensions: { width: 640, height: 360, unit: "px" },
      colour: { space: "srgb", transparency: "opaque" },
      behaviour: ["animated"],
      performance: { max_animation_frames: 48, frames_per_second: 24 },
      intended_use: "timeline",
    },
    required_outputs: ["axm.film.edl/v1"],
    editable_recipe_formats: ["axm.timeline-sequence-recipe/v1"],
  };
  const proof = Hands.verifyDeterminism("timeline-sequence", request, {
    host,
    createdAt,
    seed: "determinism",
  });
  assert.equal(proof.pass, true);
  const result = Hands.create("timeline-sequence", request, {
    host,
    createdAt,
    seed: "determinism",
  });
  assert.deepEqual(result.target_canvas_original, request.target_canvas);
  assert.equal(result.canvas_transform_receipt.status, "UNCHANGED");
  assert.equal(result.validation_receipt.status, "PASS");
});

if (!process.exitCode)
  console.log(
    "\n" + passed + " PASS · 0 FAIL · Asset Hands adversarial hardening",
  );
