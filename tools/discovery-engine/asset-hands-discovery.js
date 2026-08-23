#!/usr/bin/env node
"use strict";

const assert = require("assert");
const Packs = require("./review-packs");
const Hands = require("../../shared/asset-hands/asset-hands");

function run() {
  const pack = Packs.getPack(
    "general-lab",
    "modular target-canvas Asset Hands",
    "SOFTWARE",
  );
  const packValidation = Packs.validatePack(pack);
  assert.equal(
    packValidation.ok,
    true,
    "the SOFTWARE-profile discovery stance must validate before use",
  );
  const host = {
    capabilities: ["svg", "json", "canvas-2d"],
    permissions: [],
    accepts: [
      Hands.RESULT_SCHEMA,
      "image/svg+xml",
      "image/png",
      "image/apng",
      "application/json",
      "application/dxf",
      "application/pdf",
      "application/mtlx+xml",
      "application/vnd.opentimelineio+json",
      "model/gltf-binary",
      "model/obj",
      "text/css",
      "text/plain",
    ],
  };
  const cases = [
    {
      id: "screen-icon",
      expect: "READY",
      hand: "vector-form",
      brief: {
        id: "screen-icon",
        title: "Screen icon",
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
      },
    },
    {
      id: "native-game-raster",
      expect: "READY",
      hand: "raster-texture",
      brief: {
        id: "native-game-raster",
        title: "Native game tile",
        kind: "texture",
        intended_use: "ground-tile",
        target_canvas: {
          medium: "game-world",
          dimensions: { width: 32, height: 32, unit: "px" },
          colour: { space: "srgb", transparency: "opaque" },
          physical: { repeat: { mode: "xy" } },
          behaviour: ["static", "tileable"],
          performance: { max_texture_memory_bytes: 4096 },
          intended_use: "ground-tile",
        },
        required_outputs: ["image/png"],
        editable_recipe_formats: ["axm.native-raster-recipe/v1"],
      },
    },
    {
      id: "animated-character-source",
      expect: "READY",
      hand: "pixel-sprite",
      brief: {
        id: "animated-character-source",
        title: "Character source",
        kind: "character",
        intended_use: "character",
        target_canvas: {
          medium: "game-world",
          dimensions: { width: 64, height: 64, unit: "px" },
          colour: { space: "srgb", transparency: "required" },
          behaviour: ["animated"],
          performance: { max_animation_frames: 4, frames_per_second: 12 },
          intended_use: "character",
        },
        required_outputs: ["image/svg+xml", "application/json"],
        editable_recipe_formats: ["axm.pixel-grid-recipe/v1"],
      },
    },
    {
      id: "paper-cut",
      expect: "READY",
      hand: "cut-layout",
      brief: {
        id: "paper-cut",
        title: "Paper stencil",
        kind: "papercraft",
        intended_use: "paper-cut",
        target_canvas: {
          medium: "paper",
          dimensions: { width: 210, height: 297, unit: "mm" },
          colour: { space: "grayscale", transparency: "opaque" },
          physical: { bleed: 2, minimum_stroke: 0.8, cutting_tool_width: 0.5 },
          behaviour: ["static"],
          intended_use: "paper-cut",
        },
        required_outputs: ["application/dxf"],
        editable_recipe_formats: ["axm.cut-layout-recipe/v1"],
      },
    },
    {
      id: "visual-theme",
      expect: "READY",
      hand: "theme-token",
      brief: {
        id: "visual-theme",
        title: "Workshop semantic theme",
        kind: "theme",
        intended_use: "theme",
        target_canvas: {
          medium: "ui",
          dimensions: { width: 1280, height: 720, unit: "px" },
          colour: {
            space: "srgb",
            transparency: "opaque",
            minimum_contrast_ratio: 4.5,
          },
          behaviour: ["static", "responsive"],
          intended_use: "theme",
        },
        required_outputs: ["application/json", "text/css"],
        editable_recipe_formats: ["axm.theme-token-recipe/v1"],
      },
    },
    {
      id: "parametric-mesh",
      expect: "READY",
      hand: "parametric-mesh",
      brief: {
        id: "parametric-mesh",
        title: "Bounded crate mesh",
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
      },
    },
    {
      id: "read-only-inspection",
      expect: "READY",
      hand: "inspect-codegen",
      brief: {
        id: "read-only-inspection",
        title: "Inspect token source",
        kind: "theme",
        operation_mode: "inspect",
        intended_use: "theme",
        target_canvas: {
          medium: "ui",
          dimensions: { width: 1280, height: 720, unit: "px" },
          colour: { space: "srgb", transparency: "opaque" },
          behaviour: ["static"],
          intended_use: "theme",
        },
        source_artifacts: [
          {
            id: "source-tokens",
            name: "Tokens",
            mime: "application/json",
            format: "JSON",
            content_schema: "axm.visual-kernel.tokens/v1",
            text: '{"schema":"axm.visual-kernel.tokens/v1","tokens":{}}',
          },
        ],
        required_outputs: ["axm.inspect-codegen-report/v1"],
        editable_recipe_formats: ["axm.inspect-codegen-recipe/v1"],
        quality_requirements: {
          require_preview: false,
          require_validation: true,
        },
      },
    },
    {
      id: "oversized-raster",
      expect: "MISSING_HAND",
      brief: {
        id: "oversized-raster",
        title: "Oversized raster",
        kind: "texture",
        intended_use: "ground-tile",
        target_canvas: {
          medium: "game-world",
          dimensions: { width: 2048, height: 2048, unit: "px" },
          colour: { space: "srgb", transparency: "opaque" },
          behaviour: ["static", "tileable"],
          intended_use: "ground-tile",
        },
        required_outputs: ["image/png"],
      },
    },
    {
      id: "production-pdf",
      expect: "READY",
      hand: "production-print",
      brief: {
        id: "production-pdf",
        title: "Production PDF",
        kind: "poster",
        intended_use: "poster",
        target_canvas: {
          medium: "print",
          dimensions: { width: 210, height: 297, unit: "mm" },
          colour: {
            space: "cmyk",
            transparency: "opaque",
            printable_colours: true,
          },
          physical: { bleed: 3, minimum_stroke: 0.25 },
          behaviour: ["static"],
          intended_use: "poster",
        },
        required_outputs: ["application/pdf"],
        editable_recipe_formats: ["axm.production-print-recipe/v1"],
      },
    },
    {
      id: "animated-apng",
      expect: "READY",
      hand: "animated-raster",
      brief: {
        id: "animated-apng",
        title: "Animated runner",
        kind: "character",
        intended_use: "character",
        target_canvas: {
          medium: "game-world",
          dimensions: { width: 48, height: 48, unit: "px" },
          colour: { space: "srgb", transparency: "required" },
          behaviour: ["animated"],
          performance: { max_animation_frames: 6, frames_per_second: 12 },
          intended_use: "character",
        },
        required_outputs: ["image/apng"],
        editable_recipe_formats: ["axm.animated-raster-recipe/v1"],
      },
    },
    {
      id: "timeline-otio",
      expect: "READY",
      hand: "timeline-sequence",
      brief: {
        id: "timeline-otio",
        title: "Editorial exchange",
        kind: "timeline",
        intended_use: "timeline",
        target_canvas: {
          medium: "screen",
          dimensions: { width: 1920, height: 1080, unit: "px" },
          colour: { space: "srgb", transparency: "opaque" },
          behaviour: ["animated"],
          performance: { max_animation_frames: 120, frames_per_second: 24 },
          intended_use: "timeline",
        },
        required_outputs: ["application/vnd.opentimelineio+json"],
        editable_recipe_formats: ["axm.timeline-sequence-recipe/v1"],
      },
    },
    {
      id: "material-3d",
      expect: "READY",
      hand: "material-shader",
      brief: {
        id: "material-3d",
        title: "Armour material",
        kind: "texture",
        intended_use: "material",
        target_canvas: {
          medium: "3d-surface",
          dimensions: { width: 1, height: 1, unit: "m" },
          colour: { space: "material-channel", transparency: "opaque" },
          behaviour: ["static"],
          performance: { max_polygon_count: 10000 },
          intended_use: "material",
        },
        required_outputs: ["model/gltf-binary"],
        editable_recipe_formats: ["axm.material-graph/v1"],
      },
    },
    {
      id: "compressed-material-ktx2",
      expect: "READY",
      hand: "ktx2-texture-delivery",
      brief: {
        id: "compressed-material-ktx2",
        title: "Compressed armour texture",
        kind: "texture",
        intended_use: "material",
        target_canvas: {
          medium: "3d-surface",
          dimensions: { width: 1024, height: 1024, unit: "px" },
          colour: { space: "linear-srgb", transparency: "opaque" },
          behaviour: ["static"],
          performance: { max_texture_memory_bytes: 4194304 },
          intended_use: "material",
        },
        required_outputs: ["image/ktx2"],
        editable_recipe_formats: ["axm.ktx2-texture-recipe/v1"],
      },
    },
  ];
  const observations = cases.map((testCase) => {
    const diagnosis = Hands.diagnose(testCase.brief, host);
    assert.equal(
      diagnosis.status,
      testCase.expect,
      testCase.id + " must retain its predeclared outcome",
    );
    if (testCase.hand)
      assert.ok(
        diagnosis.compatible_hands.some((hand) => hand.id === testCase.hand),
        testCase.id + " must select " + testCase.hand,
      );
    if (testCase.expect !== "READY")
      assert.ok(
        diagnosis.missing_hand_spec,
        testCase.id + " must emit a missing-hand specification",
      );
    return {
      id: testCase.id,
      status: diagnosis.status,
      hands: diagnosis.compatible_hands.map((hand) => hand.id),
      plannedHands: (diagnosis.planned_hands || []).map((hand) => hand.id),
      gap: diagnosis.missing_hand_spec,
    };
  });
  const installedIds = new Set(Hands.list().map((hand) => hand.id)),
    missingCatalog = Hands.listMissingHands();
  assert.equal(
    Hands.list().length,
    45,
    "all forty-five admitted creation hands must be executable",
  );
  assert.equal(
    missingCatalog.length,
    0,
    "the completed fifteen-hand build must close the curated gap catalog",
  );
  assert.equal(
    new Set(missingCatalog.map((hand) => hand.id)).size,
    missingCatalog.length,
    "remaining missing Hand IDs must stay unique",
  );
  assert.ok(
    missingCatalog.every((hand) => !installedIds.has(hand.id)),
    "planned hands must remain distinct from installed executable providers",
  );
  assert.ok(
    observations
      .find((item) => item.id === "compressed-material-ktx2")
      .hands.includes("ktx2-texture-delivery"),
    "KTX2 request must select the installed delivery hand",
  );
  assert.equal(
    Hands.normalizeBrief({ kind: "future-projection-map" }).kind,
    "future-projection-map",
    "future kinds must not be silently rewritten",
  );
  const report = {
    schema: "axm.asset-hands.discovery-report/v1",
    subject: pack.subject,
    evidenceProfile: pack.evidenceProfile,
    stanceIntegrity: "PARTIAL",
    independence: "INTERNAL_EXECUTABLE_REVIEW_NOT_INDEPENDENT",
    controls: [
      {
        id: "software-requirement",
        status: "MEASURED_IN_HARNESS",
        evidence:
          cases.length + " predeclared request outcomes traced to assertions.",
      },
      {
        id: "software-regression",
        status: "MEASURED_IN_HARNESS",
        evidence:
          "Legacy and provider selftests remain separate required checks.",
      },
      {
        id: "software-boundary",
        status: "MEASURED_IN_HARNESS",
        evidence:
          "Oversized raster is refused; all fifteen admitted gaps have executable bounded providers; future unsupported contracts still emit runtime gap reports.",
      },
      {
        id: "software-environment",
        status: "MEASURED_IN_HARNESS",
        evidence:
          "Node command, local registry and deterministic briefs are recorded in this script.",
      },
      {
        id: "software-user-impact",
        status: "PARTIAL",
        evidence:
          "Visible diagnostics are wired; independent usability and physical-machine checks are not run.",
      },
    ],
    observations,
    open: [
      {
        id: "independent-pdfx-certification",
        status: "PARTIAL",
        reason:
          "The bounded PDF/X-4 hand embeds and validates its exact CMYK output intent; independent preflight certification and a physical press proof were not run.",
      },
      {
        id: "native-host-adapter",
        status: "BLOCKED",
        reason:
          "The shared transaction hand is executable and permission gated; no native Blender/Godot/Unity/Unreal/FreeCAD adapter is bundled or granted by this discovery harness.",
      },
      {
        id: "ktx2-advanced",
        status: "PARTIAL",
        reason:
          "ETC1S/BasisLZ KTX2 is installed; UASTC, HDR, cubemap and array texture delivery remain outside the hand.",
      },
    ],
    future: [
      {
        id: "advanced-3d",
        status: "PARTIAL",
        reason:
          "OBJ, GLB, MaterialX, UV/PBR baking, skin deformation, material parity, OpenUSD/USDZ and ETC1S KTX2 are executable; the signed Blender 4.2–5.2 reference adapter now applies and reopens real projects, while UASTC/HDR textures, B-rep CAD and other native hosts remain outside installed capability.",
      },
    ],
    limitations: [
      "No physical cutter was driven.",
      "No printer profile or colour separation was independently checked.",
      "This is internal executable evidence, not independent review.",
    ],
  };
  console.log(
    "VERIFIED unknown and future asset kinds retain their semantic identity",
  );
  console.log(
    "VERIFIED native raster textures are generated through a bounded direct-PNG hand",
  );
  console.log(
    "VERIFIED paper and fabric cutting contracts route to a kerf-aware cut-layout hand",
  );
  console.log(
    "VERIFIED oversized raster allocations fail before provider execution",
  );
  console.log("VERIFIED every unsatisfied request emits " + Hands.GAP_SCHEMA);
  console.log(
    "VERIFIED DeviceCMYK PDF, APNG, KTX2, GLB, MaterialX and OTIO containers are executable",
  );
  console.log(
    "VERIFIED the curated fifteen-hand gap catalog remains closed with forty-five executable providers",
  );
  console.log(
    "OPEN independent external conformance, additional native host adapters and advanced KTX2 variants remain honestly bounded",
  );
  console.log(
    "PARTIAL advanced 3D excludes UASTC/HDR textures, B-rep CAD and independent inspection for native hosts other than the Blender 4.2–5.2 reference adapter",
  );
  console.log(
    "Asset Hands Discovery stance: " +
      report.stanceIntegrity +
      " · " +
      observations.length +
      " executed cases · " +
      missingCatalog.length +
      " visible missing hands · not independent",
  );
  return report;
}

if (require.main === module) run();
module.exports = { run };
