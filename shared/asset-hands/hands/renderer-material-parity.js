(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
      node ? require("../material-parity-codec") : root.AXMMaterialParityCodec,
    );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register)
    root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (Core, Parity) {
    "use strict";
    if (!Core || !Parity)
      throw new Error("AXM core and material parity codec are required");

    var GRAPH_SCHEMA = "axm.material-graph/v1",
      RECIPE_SCHEMA = "axm.material-parity-recipe/v1",
      REPORT_SCHEMA = "material-parity-report";

    function jsonArtifact(id, role, name, filename, value, editable, format) {
      return {
        id: id,
        role: role,
        name: name,
        filename: filename,
        mime: "application/json",
        format: format || "JSON",
        editable: editable,
        text: JSON.stringify(value, null, 2),
        metadata: { schema: value.schema },
      };
    }
    function readGraph(context) {
      var item = context.sourceArtifacts.find(function (source) {
        return source.content_schema === GRAPH_SCHEMA;
      });
      if (!item)
        throw new Error(
          "material parity requires axm.material-graph/v1 source",
        );
      var graph;
      try {
        graph = JSON.parse(item.text);
      } catch (error) {
        throw new Error("material graph source is not valid JSON");
      }
      var inspection = Parity.graphCheck(graph);
      if (!inspection.pass)
        throw new Error(
          "material graph validation failed: " + inspection.errors.join("; "),
        );
      return { item: item, graph: graph };
    }
    function pngArtifact(id, role, name, filename, encoded, backend) {
      return {
        id: id,
        role: role,
        name: name,
        filename: filename,
        mime: "image/png",
        format: "PNG",
        editable: false,
        dataUrl: encoded.dataUrl,
        width: encoded.width,
        height: encoded.height,
        metadata: {
          colourSpace: "sRGB",
          backend: backend,
          structuralValidation: encoded.inspection.pass,
        },
      };
    }
    function create(context) {
      var source = readGraph(context),
        canvas = context.targetCanvas,
        resolution = Parity.resolution(canvas.performance.max_frame_ms),
        gltf = Parity.render(
          source.graph,
          Parity.GLTF_BACKEND,
          resolution.width,
          resolution.height,
        ),
        materialX = Parity.render(
          source.graph,
          Parity.MATERIALX_BACKEND,
          resolution.width,
          resolution.height,
        ),
        comparison = Parity.compare(gltf, materialX),
        slug = Core.slug(context.brief.title),
        sourceRecord = {
          id: source.item.id,
          digest: source.item.digest,
          schema: GRAPH_SCHEMA,
        },
        referenceScene = {
          geometry: "unit sphere",
          camera: { projection: "orthographic", view_direction: [0, 0, -1] },
          key_light_direction: [-0.42, 0.58, 0.7],
          environment: "deterministic checker + 0.025 linear ambient",
          resolution: [resolution.width, resolution.height],
          output_encoding: "8-bit sRGB PNG with straight alpha",
        },
        backends = [
          {
            id: Parity.GLTF_BACKEND,
            vocabulary: "glTF 2.0 metallic-roughness",
            parameters: gltf.parameters,
            native_renderer: false,
          },
          {
            id: Parity.MATERIALX_BACKEND,
            vocabulary: "MaterialX 1.38 standard_surface bounded mapping",
            parameters: materialX.parameters,
            native_renderer: false,
          },
        ],
        recipeValue = {
          schema: RECIPE_SCHEMA,
          version: "1.0.0",
          id: "parity-" + Core.slug(context.brief.id),
          target_canvas: JSON.parse(JSON.stringify(canvas)),
          operation: context.operationMode,
          source: sourceRecord,
          reference_scene: referenceScene,
          backends: backends.map(function (backend) {
            return backend.id;
          }),
          bindings: JSON.parse(JSON.stringify(source.graph.bindings || [])),
          thresholds: comparison.threshold,
          performance_model: {
            estimated_frame_ms: resolution.estimated_frame_ms,
            maximum_frame_ms: canvas.performance.max_frame_ms,
            model: resolution.model,
            hardware_benchmark: false,
          },
          known_limits: [
            "CPU reference interpreters only; native Unity, Unreal, Blender and GPU backends are not executed",
            "bounded standard_surface to metallic-roughness subset; textures, normal maps, clearcoat, transmission and displacement are unsupported",
            "performance is a deterministic conservative work-budget estimate, not a wall-clock hardware benchmark",
          ],
          provenance: {
            hand: "renderer-material-parity",
            hand_version: "1.0.0",
            codec_version: Parity.VERSION,
            seed: context.seed,
            source_artifact_digests: [source.item.digest],
          },
        },
        checks = [
          { name: "material-graph-schema-and-ranges", pass: true },
          {
            name: "gltf-reference-png-structure",
            pass: gltf.png.inspection.pass && gltf.png.inspection.hasSrgb,
            details: {
              width: gltf.png.width,
              height: gltf.png.height,
              bytes: gltf.png.byteLength,
            },
          },
          {
            name: "materialx-reference-png-structure",
            pass:
              materialX.png.inspection.pass && materialX.png.inspection.hasSrgb,
            details: {
              width: materialX.png.width,
              height: materialX.png.height,
              bytes: materialX.png.byteLength,
            },
          },
          {
            name: "parity-within-declared-thresholds",
            pass: comparison.pass,
            details: comparison.metrics,
          },
          {
            name: "deterministic-frame-work-budget",
            pass:
              canvas.performance.max_frame_ms == null ||
              resolution.estimated_frame_ms <= canvas.performance.max_frame_ms,
            details: {
              estimated_frame_ms: resolution.estimated_frame_ms,
              maximum_frame_ms: canvas.performance.max_frame_ms,
              hardware_benchmark: false,
            },
          },
          {
            name: "spatial-convention",
            pass:
              canvas.spatial.up_axis === "y" &&
              canvas.spatial.handedness === "right",
          },
          {
            name: "native-renderer-claim-is-not-made",
            pass: true,
            details: { native_renderer_validation: false },
          },
          { name: "file-budget", pass: true, details: null },
        ],
        report = {
          schema: REPORT_SCHEMA,
          version: "1.0.0",
          status: "PASS",
          claim:
            "numeric equivalence of two versioned AXM CPU reference interpretations for the bounded glTF metallic-roughness / MaterialX standard_surface subset; no native renderer was executed",
          target_canvas: JSON.parse(JSON.stringify(canvas)),
          operation: context.operationMode,
          source: sourceRecord,
          reference_scene: referenceScene,
          backends: backends,
          metrics: comparison.metrics,
          thresholds: comparison.threshold,
          performance: recipeValue.performance_model,
          native_renderer_validation: false,
          checks: checks,
        },
        sourceText = JSON.stringify(source.graph, null, 2),
        recipeText = JSON.stringify(recipeValue, null, 2),
        estimatedTotal =
          gltf.png.byteLength +
          materialX.png.byteLength +
          comparison.png.byteLength +
          sourceText.length +
          recipeText.length +
          JSON.stringify(report, null, 2).length,
        fileCheck = checks[checks.length - 1];
      fileCheck.details = {
        estimated_total_bytes: estimatedTotal,
        maximum_file_bytes: canvas.performance.max_file_bytes,
      };
      fileCheck.pass =
        canvas.performance.max_file_bytes == null ||
        estimatedTotal <= canvas.performance.max_file_bytes;
      report.status = checks.every(function (check) {
        return check.pass;
      })
        ? "PASS"
        : "HOLD";

      return {
        artifacts: [
          pngArtifact(
            "gltf-reference-swatch",
            "gltf-reference-render",
            context.brief.title + " glTF reference swatch",
            slug + "-gltf-reference.png",
            gltf.png,
            Parity.GLTF_BACKEND,
          ),
          pngArtifact(
            "materialx-reference-swatch",
            "materialx-reference-render",
            context.brief.title + " MaterialX reference swatch",
            slug + "-materialx-reference.png",
            materialX.png,
            Parity.MATERIALX_BACKEND,
          ),
          pngArtifact(
            "material-parity-diff",
            "material-parity-diff",
            context.brief.title + " parity difference",
            slug + "-parity-diff.png",
            comparison.png,
            "numeric-diff/v1",
          ),
          jsonArtifact(
            "material-graph-source",
            "editable-material-graph",
            context.brief.title + " preserved material graph",
            slug + "-material.json",
            source.graph,
            true,
          ),
          jsonArtifact(
            "material-parity-recipe",
            "editable-material-parity-recipe",
            context.brief.title + " parity recipe",
            slug + "-parity-recipe.json",
            recipeValue,
            true,
          ),
          jsonArtifact(
            "material-parity-report",
            "material-parity-report",
            context.brief.title + " parity report",
            slug + "-parity-report.json",
            report,
            false,
            "JSON",
          ),
        ],
        previewArtifactId: "material-parity-diff",
        recipe: {
          format: RECIPE_SCHEMA,
          parameters: recipeValue,
          steps: [
            { op: "parse-and-range-check-material-graph" },
            { op: "bind-gltf-metallic-roughness-reference" },
            { op: "bind-materialx-standard-surface-reference" },
            { op: "render-deterministic-cpu-reference-swatches" },
            { op: "compare-linear-light-pixels-and-emit-diff" },
          ],
        },
        validationChecks: checks,
        measures: {
          width: resolution.width,
          height: resolution.height,
          comparedPixels: comparison.metrics.compared_pixels,
          meanAbsoluteLinear: comparison.metrics.mean_absolute_linear,
          rmseLinear: comparison.metrics.rmse_linear,
          maxAbsoluteLinear: comparison.metrics.max_absolute_linear,
          mismatchedPixels: comparison.metrics.mismatched_pixels,
          estimatedFrameMs: resolution.estimated_frame_ms,
          pngBytes:
            gltf.png.byteLength +
            materialX.png.byteLength +
            comparison.png.byteLength,
        },
        notes: [
          "The PNG swatches and heatmap are real bounded raster outputs, not SVG placeholders.",
          "PASS means the two named CPU reference semantics agree within the receipt thresholds; it does not certify a native renderer.",
        ],
      };
    }

    return {
      descriptor: {
        schema: Core.HAND_SCHEMA,
        contract_version: "2.0",
        id: "renderer-material-parity",
        title: "Renderer Material Parity Hand",
        version: "1.0.0",
        category: "material-validation",
        lifecycle_status: "beta",
        summary:
          "Renders deterministic glTF metallic-roughness and MaterialX standard-surface CPU reference swatches, then emits a real PNG heatmap and numeric parity receipt.",
        purpose:
          "Measure a bounded portable material mapping without pretending that unexecuted native renderers are equivalent.",
        operation_modes: ["inspect", "validate", "workflow"],
        canvas_models: ["viewport-3d", "procedural-graph"],
        entry_surfaces: [
          "command",
          "material-editor",
          "asset-fabric",
          "studio-handoff",
        ],
        mutability: "read-only",
        kinds: ["material", "shader", "texture", "3d-model"],
        accepts: [Core.BRIEF_SCHEMA, GRAPH_SCHEMA],
        produces: [
          Core.RESULT_SCHEMA,
          "image/png",
          "application/json",
          RECIPE_SCHEMA,
          REPORT_SCHEMA,
          "material-parity-report",
        ],
        input_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: GRAPH_SCHEMA,
            roles: ["source"],
            required_for: ["inspect", "validate", "workflow"],
            mutable: false,
            max_bytes: 2000000,
          },
        ],
        output_types: [
          {
            mime: "image/png",
            format: "PNG",
            role: "reference-render-or-diff",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: [
              "8-bit display swatches quantize the linear reference values; metrics are computed from those exact delivered pixels",
            ],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: GRAPH_SCHEMA,
            role: "editable-material-graph",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: RECIPE_SCHEMA,
            role: "editable-material-parity-recipe",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: REPORT_SCHEMA,
            role: "material-parity-report",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
        ],
        canvas_types: [
          {
            medium: "3d-surface",
            units: ["m", "mm", "px"],
            colour_spaces: ["srgb", "linear-srgb", "material-channel"],
            transparency_modes: ["required", "allowed", "opaque"],
            behaviours: ["static"],
            intended_uses: [
              "material",
              "shader",
              "surface",
              "texture",
              "3d-model",
            ],
            up_axes: ["y"],
            handedness: ["right"],
          },
          {
            medium: "game-world",
            units: ["game-world-unit", "m", "px"],
            colour_spaces: ["srgb", "linear-srgb", "material-channel"],
            transparency_modes: ["required", "allowed", "opaque"],
            behaviours: ["static"],
            intended_uses: [
              "material",
              "shader",
              "surface",
              "texture",
              "3d-model",
            ],
            up_axes: ["y"],
            handedness: ["right"],
          },
        ],
        canvas_limits: { min_width: 0.0001, min_height: 0.0001 },
        constraints_honoured: [
          "dimensions",
          "dimensions.unit",
          "colour.space",
          "colour.transparency",
          "behaviour.static",
          "performance.max-frame-ms",
          "performance.max-file-bytes",
          "spatial.up-axis",
          "spatial.handedness",
        ],
        editable_recipe_formats: [
          Core.RECIPE_SCHEMA,
          GRAPH_SCHEMA,
          RECIPE_SCHEMA,
        ],
        operations: { preview: true, validate: true, edit: false },
        emits_editable_source: true,
        supports_edit_operation: false,
        requires: [],
        editable: false,
        deterministic: true,
        required_permissions: {
          local_file_system: "none",
          clipboard: false,
          network_domains: [],
          device_access: [],
          plugin_data: false,
        },
        network_policy: {
          mode: "none",
          domains: [],
          rationale:
            "Both reference interpreters, PNG writer and diff engine are bundled and deterministic.",
        },
        host_compatibility: {
          hosts: ["asset-fabric", "studio", "mirror", "standalone"],
          dependencies: [
            { name: "AXM raster codec", version: "1.1.0", bundled: true },
            {
              name: "AXM material parity codec",
              version: Parity.VERSION,
              bundled: true,
            },
          ],
        },
        engine: {
          name: "AXM dual material CPU reference + linear-light visual diff",
          version: Parity.VERSION,
          execution: "local-bounded",
        },
        safety_tier: "safe-local",
        authority: "candidate-only",
        implementation_status: "executable",
        portability: {
          interchange_formats: [
            GRAPH_SCHEMA,
            RECIPE_SCHEMA,
            REPORT_SCHEMA,
            "image/png",
          ],
          known_losses: [
            "reference swatches cover a bounded uniform standard-surface subset",
          ],
          unsupported_features: [
            "native DCC and game-engine execution",
            "textures and UV sampling",
            "normal maps",
            "clearcoat",
            "transmission",
            "subsurface scattering",
            "displacement",
            "GPU performance certification",
          ],
          fallbacks: [],
        },
        validation: {
          checks: [
            "material graph schema and numeric ranges",
            "PNG structure and sRGB declaration",
            "linear-light MAE/RMSE/maximum difference",
            "mismatched-pixel fraction",
            "deterministic work budget",
            "file budget",
            "honest native-renderer claim boundary",
          ],
        },
        evidence: [
          {
            claim:
              "glTF 2.0 defines the metallic-roughness material model and its factors.",
            source_url:
              "https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html",
            specification_version: "glTF 2.0",
            retrieved_at: "2026-07-19",
          },
          {
            claim:
              "MaterialX supplies the portable standard_surface material vocabulary used for the second bounded mapping.",
            source_url: "https://materialx.org/",
            specification_version: "MaterialX 1.38",
            retrieved_at: "2026-07-19",
          },
        ],
        tests: [
          "asset-hands-material-parity-selftest",
          "asset-hands-hardening-selftest",
        ],
        implementation_priority: "high",
        limits: {
          referenceBackends: [Parity.GLTF_BACKEND, Parity.MATERIALX_BACKEND],
          nativeRenderers: false,
          textures: false,
          maximumReferenceResolution: 128,
        },
      },
      create: create,
    };
  },
);
