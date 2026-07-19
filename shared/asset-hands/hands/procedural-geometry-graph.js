(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
      node ? require("../geometry-graph-codec") : root.AXMGeometryGraphCodec,
      node
        ? require("../../../tools/spatial-studio/spatial-core")
        : root.AXMSpatialCore,
      node
        ? require("../../../tools/spatial-studio/spatial-geometry")
        : root.AXMSpatialGeometry,
      node ? require("../gltf-codec") : root.AXMGlTFCodec,
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
  function (Core, Graph, Spatial, Geometry, GlTF) {
    "use strict";
    if (!Core || !Graph || !Spatial || !Geometry || !GlTF)
      throw new Error(
        "AXM core, geometry graph, Spatial and glTF codecs are required",
      );
    var RECIPE_SCHEMA = "axm.geometry-graph-recipe/v1",
      REPORT_SCHEMA = "axm.geometry-graph-validation/v1";
    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }
    function fixedTime() {
      return "1970-01-01T00:00:00.000Z";
    }
    function unitScale(canvas) {
      return canvas.dimensions.unit === "mm"
        ? 0.001
        : canvas.dimensions.unit === "game-world-unit"
          ? canvas.spatial.world_scale || 1
          : 1;
    }
    function toleranceMetres(canvas) {
      return canvas.physical.tolerance == null
        ? 0
        : canvas.physical.tolerance * unitScale(canvas);
    }
    function preferredShape(context) {
      var signal = [context.brief.title, context.brief.purpose]
        .concat(context.brief.styleTags || [])
        .join(" ")
        .toLowerCase();
      if (/sphere|orb|ball/.test(signal)) return "sphere";
      if (/torus|ring/.test(signal)) return "torus";
      if (/cylinder|column/.test(signal)) return "cylinder";
      if (/cone|spike/.test(signal)) return "cone";
      if (/ground|plane|sheet/.test(signal)) return "plane";
      return "cube";
    }
    function fittedPrimitive(shape, triangleBudget, vertexBudget) {
      var detail = 24,
        mesh = Geometry.build(shape, detail, {});
      while (
        detail > 3 &&
        (mesh.indices.length / 3 > triangleBudget ||
          mesh.positions.length / 3 > vertexBudget)
      ) {
        detail -= 1;
        mesh = Geometry.build(shape, detail, {});
      }
      if (
        mesh.indices.length / 3 > triangleBudget ||
        mesh.positions.length / 3 > vertexBudget
      ) {
        shape = "plane";
        detail = 3;
        mesh = Geometry.build(shape, detail, {});
      }
      return {
        shape: shape,
        detail: detail,
        triangles: mesh.indices.length / 3,
        vertices: mesh.positions.length / 3,
      };
    }
    function generatedGraph(context) {
      var canvas = context.targetCanvas,
        scale = unitScale(canvas),
        width = canvas.dimensions.width * scale,
        height = canvas.dimensions.height * scale,
        depth = (canvas.dimensions.depth || canvas.dimensions.height) * scale,
        triangleBudget =
          canvas.performance.max_polygon_count == null
            ? 12000
            : canvas.performance.max_polygon_count,
        vertexBudget =
          canvas.performance.max_vertices == null
            ? 20000
            : canvas.performance.max_vertices,
        fit = fittedPrimitive(
          preferredShape(context),
          triangleBudget,
          vertexBudget,
        ),
        copies = Math.max(
          1,
          Math.min(
            5,
            Math.floor(triangleBudget / fit.triangles),
            Math.floor(vertexBudget / fit.vertices),
          ),
        ),
        cell = width / copies;
      return {
        schema: Graph.SCHEMA,
        version: "1.0.0",
        id: "geometry-graph-" + Core.slug(context.brief.id),
        name: context.brief.title,
        target_canvas: clone(canvas),
        coordinate_unit: "metre",
        nodes: [
          {
            id: "source-primitive",
            type: "primitive",
            shape: fit.shape,
            detail: fit.detail,
          },
          {
            id: "fit-to-canvas",
            type: "transform",
            input: "source-primitive",
            translate: [-width / 2 + cell / 2, 0, 0],
            rotate: [0, 0, 0],
            scale: [
              Math.max(0.000001, cell * 0.38),
              Math.max(0.000001, height * 0.38),
              Math.max(0.000001, depth * 0.38),
            ],
          },
          {
            id: "bounded-array",
            type: "linear-array",
            input: "fit-to-canvas",
            count: copies,
            offset: [cell, 0, 0],
          },
          { id: "final-output", type: "output", input: "bounded-array" },
        ],
        output: "final-output",
        cache_policy: {
          scope: "request-local",
          key: "canonical-node-plus-input-digests",
          deterministic: true,
          cross_request_state: false,
        },
        provenance: {
          hand: "procedural-geometry-graph",
          hand_version: "1.0.0",
          seed: context.seed,
          source_artifact_digests: [],
        },
      };
    }
    function sourceGraph(context) {
      var item = context.sourceArtifacts.find(function (source) {
        return source.content_schema === Graph.SCHEMA;
      });
      if (!item) return null;
      var value;
      try {
        value = JSON.parse(item.text);
      } catch (error) {
        throw new Error("geometry graph source is not valid JSON");
      }
      var checked = Graph.inspect(value);
      if (!checked.pass)
        throw new Error(
          "geometry graph validation failed: " + checked.errors.join("; "),
        );
      value = clone(value);
      value.target_canvas = clone(context.targetCanvas);
      value.provenance = {
        hand: "procedural-geometry-graph",
        hand_version: "1.0.0",
        seed: context.seed,
        source_artifact_digests: [item.digest],
      };
      return { item: item, graph: value };
    }
    function projectFromEvaluation(context, evaluation) {
      var id = Core.hash(context.seed),
        materialId = "graph-material-" + id,
        objects = evaluation.instances.map(function (instance, index) {
          return {
            id: "graph-object-" + index + "-" + Core.slug(instance.id),
            name: instance.id,
            type: instance.shape,
            parentId: "",
            position: instance.position,
            rotation: instance.rotation,
            scale: instance.scale,
            materialId: materialId,
            visible: true,
            locked: false,
            castShadow: true,
            receiveShadow: true,
            geometry: {
              detail: instance.detail,
              inflate: 0,
              twist: 0,
              seed: parseInt(id, 16) + index,
            },
            metadata: {
              domain: "procedural-geometry-graph",
              sourceNodes: instance.source_nodes,
            },
            createdAt: fixedTime(),
          };
        });
      return Spatial.normalizeProject({
        format: Spatial.FORMAT,
        version: Spatial.VERSION,
        id: "graph-project-" + id,
        name: context.brief.title,
        fps: 24,
        durationFrames: 1,
        createdAt: fixedTime(),
        updatedAt: fixedTime(),
        materials: [
          {
            id: materialId,
            name: "Geometry Graph Material",
            baseColor: context.palette[1] || context.palette[0],
            metallic: 0.1,
            roughness: 0.62,
            emissive: "#000000",
            opacity:
              context.targetCanvas.colour.transparency === "opaque" ? 1 : 0.85,
            doubleSided: false,
            source: "procedural-geometry-graph",
            createdAt: fixedTime(),
          },
        ],
        objects: objects,
        lights: [],
        camera: {
          target: [0, 0, 0],
          yaw: 35,
          pitch: 24,
          distance:
            Math.max(
              context.targetCanvas.dimensions.width,
              context.targetCanvas.dimensions.height,
            ) *
            unitScale(context.targetCanvas) *
            3,
          fov: 48,
          near: 0.001,
          far: 100000,
        },
        keyframes: [],
        rigs: [],
        emitters: [],
        voxels: [],
        captures: [],
        simulationReceipts: [],
        renderReceipts: [],
        exports: [],
        template: "blank",
      });
    }
    function bounds(evaluation) {
      var minimum = [Infinity, Infinity, Infinity],
        maximum = [-Infinity, -Infinity, -Infinity];
      evaluation.instances.forEach(function (instance) {
        for (var axis = 0; axis < 3; axis += 1) {
          minimum[axis] = Math.min(
            minimum[axis],
            instance.position[axis] - instance.scale[axis],
          );
          maximum[axis] = Math.max(
            maximum[axis],
            instance.position[axis] + instance.scale[axis],
          );
        }
      });
      return {
        minimum: minimum,
        maximum: maximum,
        size: maximum.map(function (value, axis) {
          return value - minimum[axis];
        }),
        unit: "m",
      };
    }
    function preview(context, evaluation, measuredBounds) {
      var w = context.brief.canvas.width,
        h = context.brief.canvas.height,
        spanX = Math.max(0.000001, measuredBounds.size[0]),
        spanY = Math.max(0.000001, measuredBounds.size[1]),
        pad = Math.min(w, h) * 0.1,
        sx = (w - pad * 2) / spanX,
        sy = (h - pad * 2) / spanY,
        scale = Math.min(sx, sy),
        elements = evaluation.instances
          .map(function (instance) {
            var x =
                pad +
                (instance.position[0] -
                  instance.scale[0] -
                  measuredBounds.minimum[0]) *
                  scale,
              y =
                h -
                pad -
                (instance.position[1] +
                  instance.scale[1] -
                  measuredBounds.minimum[1]) *
                  scale,
              rw = Math.max(2, instance.scale[0] * 2 * scale),
              rh = Math.max(2, instance.scale[1] * 2 * scale);
            return (
              '<rect x="' +
              x.toFixed(2) +
              '" y="' +
              y.toFixed(2) +
              '" width="' +
              rw.toFixed(2) +
              '" height="' +
              rh.toFixed(2) +
              '" rx="4" fill="none" stroke="#62d6c8" stroke-width="2"/><path d="M' +
              x.toFixed(2) +
              " " +
              y.toFixed(2) +
              " l" +
              Math.min(10, rw * 0.2).toFixed(2) +
              " -" +
              Math.min(10, rh * 0.2).toFixed(2) +
              '" stroke="#a8fff1"/>'
            );
          })
          .join("");
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        w +
        '" height="' +
        h +
        '" viewBox="0 0 ' +
        w +
        " " +
        h +
        '" role="img" aria-label="Geometry graph evaluated bounds preview"><rect width="100%" height="100%" fill="#07131d"/>' +
        elements +
        '<text x="16" y="28" fill="#c7fff7" font-family="system-ui" font-size="12">' +
        evaluation.instances.length +
        " instances · " +
        evaluation.triangles +
        " triangles · graph " +
        evaluation.graphDigest +
        "</text></svg>"
      );
    }
    function jsonArtifact(id, role, name, filename, value, editable) {
      return {
        id: id,
        role: role,
        name: name,
        filename: filename,
        mime: "application/json",
        format: "JSON",
        editable: editable,
        text: JSON.stringify(value, null, 2),
        metadata: { schema: value.schema },
      };
    }
    function create(context) {
      var supplied = sourceGraph(context),
        graph = supplied ? supplied.graph : generatedGraph(context),
        graphInspection = Graph.inspect(graph),
        canvas = context.targetCanvas,
        evaluation = Graph.evaluate(graph, {
          toleranceMetres: toleranceMetres(canvas),
          maxTriangles:
            canvas.performance.max_polygon_count == null
              ? 200000
              : canvas.performance.max_polygon_count,
          maxVertices:
            canvas.performance.max_vertices == null
              ? 300000
              : canvas.performance.max_vertices,
        }),
        project = projectFromEvaluation(context, evaluation),
        obj = Geometry.toOBJ(project),
        glb = GlTF.fromProject(project, Geometry),
        measuredBounds = bounds(evaluation),
        targetSize = [
          canvas.dimensions.width * unitScale(canvas),
          canvas.dimensions.height * unitScale(canvas),
          (canvas.dimensions.depth || canvas.dimensions.height) *
            unitScale(canvas),
        ],
        projectText = JSON.stringify(project, null, 2),
        graphText = JSON.stringify(graph, null, 2),
        svg = preview(context, evaluation, measuredBounds),
        totalBytes =
          obj.length +
          glb.byteLength +
          projectText.length +
          graphText.length +
          svg.length,
        source = supplied
          ? {
              id: supplied.item.id,
              digest: supplied.item.digest,
              schema: Graph.SCHEMA,
            }
          : null,
        integrity = {
          graph_digest: evaluation.graphDigest,
          evaluation_digest: evaluation.outputDigest,
          output_node_cache_key: evaluation.outputNodeKey,
          obj_digest: Core.hash(obj),
          glb_digest: Core.hash(glb.dataUrl),
          spatial_project_digest: Core.hash(projectText),
        },
        checks = [
          {
            name: "graph-schema-and-allowlist",
            pass: graphInspection.pass,
            details: {
              nodes: graphInspection.nodeCount,
              allowed: graphInspection.allowedNodeTypes,
            },
          },
          {
            name: "deterministic-request-local-cache",
            pass:
              evaluation.cache.deterministic &&
              evaluation.cache.scope === "request-local" &&
              evaluation.cache.entries === graph.nodes.length,
            details: evaluation.cache,
          },
          {
            name: "evaluation-budget",
            pass: evaluation.pass,
            details: {
              errors: evaluation.errors,
              triangles: evaluation.triangles,
              vertices: evaluation.vertices,
            },
          },
          {
            name: "canvas-bounds",
            pass: measuredBounds.size.every(function (size, axis) {
              return size <= targetSize[axis] + 0.000001;
            }),
            details: { actual: measuredBounds.size, maximum: targetSize },
          },
          {
            name: "tolerance-quantization",
            pass: evaluation.toleranceMetres === toleranceMetres(canvas),
            details: { tolerance_metres: evaluation.toleranceMetres },
          },
          {
            name: "obj-geometry",
            pass: /\nv [-0-9]/.test(obj) && /\nf [0-9]/.test(obj),
          },
          {
            name: "glb-container",
            pass: glb.inspection.pass,
            details: {
              version: glb.inspection.version,
              length: glb.inspection.length,
            },
          },
          {
            name: "bake-integrity-digests",
            pass: Object.keys(integrity).every(function (key) {
              return !!integrity[key];
            }),
            details: integrity,
          },
          {
            name: "spatial-convention",
            pass:
              canvas.spatial.up_axis === "y" &&
              canvas.spatial.handedness === "right",
          },
          {
            name: "file-budget",
            pass:
              canvas.performance.max_file_bytes == null ||
              totalBytes <= canvas.performance.max_file_bytes,
            details: {
              actual: totalBytes,
              maximum: canvas.performance.max_file_bytes,
            },
          },
        ],
        recipe = {
          schema: RECIPE_SCHEMA,
          version: "1.0.0",
          id: "geometry-recipe-" + Core.slug(context.brief.id),
          target_canvas: clone(canvas),
          operation: context.operationMode,
          source: source,
          graph: {
            schema: graph.schema,
            digest: evaluation.graphDigest,
            nodes: graph.nodes.length,
            output: graph.output,
            coordinate_unit: graph.coordinate_unit,
          },
          evaluation: {
            instances: evaluation.instances.length,
            triangles: evaluation.triangles,
            vertices: evaluation.vertices,
            output_digest: evaluation.outputDigest,
            tolerance_metres: evaluation.toleranceMetres,
            cache: evaluation.cache,
          },
          bake: {
            obj: { format: "OBJ", digest: integrity.obj_digest },
            glb: { format: "glTF 2.0 GLB", digest: integrity.glb_digest },
            spatial_project: {
              schema: Spatial.FORMAT,
              digest: integrity.spatial_project_digest,
            },
          },
          budgets: {
            max_polygon_count: canvas.performance.max_polygon_count,
            max_vertices: canvas.performance.max_vertices,
            max_file_bytes: canvas.performance.max_file_bytes,
            total_bytes: totalBytes,
          },
          known_limits: [
            "allowlisted acyclic graph nodes only: primitive, transform, linear-array, merge and output",
            "request-local cache proves deterministic graph reuse but is intentionally not a persistent cross-request cache",
            "no boolean CSG, subdivision, modifiers, UV generation, rigging or animation",
            "OBJ and GLB are baked delivery outputs; the graph JSON remains the editable source",
          ],
          provenance: {
            hand: "procedural-geometry-graph",
            hand_version: "1.0.0",
            codec_version: Graph.VERSION,
            seed: context.seed,
            source_artifact_digests: context.sourceArtifacts.map(
              function (item) {
                return item.digest;
              },
            ),
          },
        },
        report = {
          schema: REPORT_SCHEMA,
          version: "1.0.0",
          status: checks.every(function (check) {
            return check.pass;
          })
            ? "PASS"
            : "HOLD",
          claim:
            "bounded deterministic evaluation of an allowlisted acyclic geometry DAG with request-local cache keys and integrity-bound OBJ/GLB bakes",
          target_canvas: clone(canvas),
          operation: context.operationMode,
          graph: {
            digest: evaluation.graphDigest,
            nodes: graph.nodes.length,
            output: graph.output,
            allowed_node_types: Graph.ALLOWED_NODE_TYPES,
          },
          evaluation: {
            pass: evaluation.pass,
            errors: evaluation.errors,
            instances: evaluation.instances.length,
            triangles: evaluation.triangles,
            vertices: evaluation.vertices,
            digest: evaluation.outputDigest,
          },
          cache: evaluation.cache,
          bake_integrity: integrity,
          bounds: measuredBounds,
          budgets: recipe.budgets,
          checks: checks,
        },
        slug = Core.slug(context.brief.title);
      return {
        artifacts: [
          {
            id: "geometry-graph",
            role: "editable-geometry-graph",
            name: context.brief.title + " geometry graph",
            filename: slug + ".geometry-graph.json",
            mime: "application/json",
            format: "JSON",
            editable: true,
            text: graphText,
            metadata: {
              schema: Graph.SCHEMA,
              graphDigest: evaluation.graphDigest,
            },
          },
          {
            id: "geometry-graph-obj",
            role: "baked-geometry-obj",
            name: context.brief.title + " OBJ bake",
            filename: slug + ".obj",
            mime: "model/obj",
            format: "OBJ",
            editable: true,
            text: obj,
            metadata: {
              triangles: evaluation.triangles,
              vertices: evaluation.vertices,
              graphDigest: evaluation.graphDigest,
              unit: "m",
            },
          },
          {
            id: "geometry-graph-glb",
            role: "baked-geometry-glb",
            name: context.brief.title + " GLB bake",
            filename: slug + ".glb",
            mime: "model/gltf-binary",
            format: "GLB",
            editable: false,
            dataUrl: glb.dataUrl,
            metadata: {
              schema: "glTF.2.0",
              triangles: evaluation.triangles,
              vertices: evaluation.vertices,
              graphDigest: evaluation.graphDigest,
            },
          },
          {
            id: "geometry-graph-spatial-project",
            role: "editable-spatial-project",
            name: context.brief.title + " Spatial project",
            filename: slug + ".spatial.json",
            mime: "application/json",
            format: "JSON",
            editable: true,
            text: projectText,
            metadata: {
              schema: Spatial.FORMAT,
              graphDigest: evaluation.graphDigest,
            },
          },
          jsonArtifact(
            "geometry-graph-recipe",
            "editable-geometry-graph-recipe",
            context.brief.title + " graph recipe",
            slug + "-graph-recipe.json",
            recipe,
            true,
          ),
          jsonArtifact(
            "geometry-graph-validation",
            "geometry-graph-validation",
            context.brief.title + " graph validation",
            slug + "-graph-validation.json",
            report,
            false,
          ),
          {
            id: "geometry-graph-preview",
            role: "geometry-derived-preview",
            name: context.brief.title + " evaluated preview",
            filename: slug + "-graph-preview.svg",
            mime: "image/svg+xml",
            format: "SVG",
            editable: false,
            text: svg,
            width: context.brief.canvas.width,
            height: context.brief.canvas.height,
            metadata: {
              geometryDerived: true,
              graphDigest: evaluation.graphDigest,
            },
          },
        ],
        previewArtifactId: "geometry-graph-preview",
        recipe: {
          format: RECIPE_SCHEMA,
          parameters: recipe,
          steps: [
            { op: "validate-allowlisted-acyclic-graph" },
            { op: "evaluate-with-request-local-content-cache" },
            { op: "quantize-to-declared-physical-tolerance" },
            { op: "build-spatial-project-and-bake-obj-glb" },
            { op: "bind-bake-integrity-digests" },
          ],
        },
        validationChecks: checks,
        measures: {
          nodes: graph.nodes.length,
          instances: evaluation.instances.length,
          triangles: evaluation.triangles,
          vertices: evaluation.vertices,
          cacheHits: evaluation.cache.hits,
          cacheMisses: evaluation.cache.misses,
          toleranceMetres: evaluation.toleranceMetres,
          objBytes: obj.length,
          glbBytes: glb.byteLength,
          totalBytes: totalBytes,
        },
        notes: [
          "The graph evaluator executes no user code and rejects unknown nodes, missing inputs and cycles before geometry work.",
          "The editable graph, recipe, cache keys and bake digests travel with the actual OBJ and GLB outputs.",
        ],
      };
    }
    return {
      descriptor: {
        schema: Core.HAND_SCHEMA,
        contract_version: "2.0",
        id: "procedural-geometry-graph",
        title: "Procedural Geometry Graph Hand",
        version: "1.0.0",
        category: "procedural-geometry",
        lifecycle_status: "beta",
        summary:
          "Evaluates a safe versioned geometry DAG with deterministic request-local cache keys, target-canvas fitting/tolerance and integrity-bound OBJ/GLB bakes.",
        purpose:
          "Extend bounded parametric primitives into reusable modular procedural graphs without executing arbitrary code or hiding bake loss.",
        operation_modes: ["create", "edit", "validate", "workflow"],
        canvas_models: ["procedural-graph", "viewport-3d"],
        entry_surfaces: [
          "command",
          "spatial-studio",
          "asset-fabric",
          "studio-handoff",
          "export-recipe",
        ],
        mutability: "transform",
        kinds: ["3d-model", "mesh", "environment", "physical-object", "prop"],
        accepts: [Core.BRIEF_SCHEMA, Graph.SCHEMA],
        produces: [
          Core.RESULT_SCHEMA,
          Graph.SCHEMA,
          "model/obj",
          "model/gltf-binary",
          "application/json",
          "image/svg+xml",
          RECIPE_SCHEMA,
          REPORT_SCHEMA,
        ],
        input_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: Graph.SCHEMA,
            roles: ["source"],
            required_for: ["edit", "validate"],
            mutable: false,
            max_bytes: 4000000,
          },
        ],
        output_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: Graph.SCHEMA,
            role: "editable-geometry-graph",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "model/obj",
            format: "OBJ",
            role: "baked-geometry-obj",
            editable: true,
            deterministic: true,
            lossy: true,
            known_losses: [
              "procedural node structure, material graph and cache metadata are not encoded",
            ],
          },
          {
            mime: "model/gltf-binary",
            format: "GLB",
            schema: "glTF.2.0",
            role: "baked-geometry-glb",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: [
              "procedural graph nodes and cache metadata are not encoded",
            ],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: "axm.spatial.project/v1",
            role: "editable-spatial-project",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: RECIPE_SCHEMA,
            role: "editable-geometry-graph-recipe",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: REPORT_SCHEMA,
            role: "geometry-graph-validation",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "image/svg+xml",
            format: "SVG",
            role: "geometry-derived-preview",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: [
              "preview uses projected instance bounds rather than a shaded render",
            ],
          },
        ],
        canvas_types: [
          {
            medium: "3d-surface",
            units: ["m", "mm"],
            colour_spaces: ["material-channel", "linear-srgb", "grayscale"],
            transparency_modes: ["opaque", "allowed", "required"],
            behaviours: ["static"],
            intended_uses: ["3d-model", "mesh", "environment", "prop"],
            up_axes: ["y"],
            handedness: ["right"],
          },
          {
            medium: "game-world",
            units: ["game-world-unit", "m"],
            colour_spaces: ["material-channel", "linear-srgb"],
            transparency_modes: ["opaque", "allowed", "required"],
            behaviours: ["static"],
            intended_uses: ["3d-model", "mesh", "environment", "prop"],
            up_axes: ["y"],
            handedness: ["right"],
          },
          {
            medium: "physical-object",
            units: ["mm", "m"],
            colour_spaces: ["material-channel", "grayscale"],
            transparency_modes: ["opaque"],
            behaviours: ["static"],
            intended_uses: ["physical-object", "3d-model", "mesh", "prop"],
            material_behaviours: ["*"],
            up_axes: ["y"],
            handedness: ["right"],
          },
        ],
        canvas_limits: {
          min_width: 0.001,
          min_height: 0.001,
          min_polygon_count: 2,
          min_vertices: 4,
        },
        constraints_honoured: [
          "dimensions",
          "dimensions.unit",
          "colour.space",
          "colour.transparency",
          "behaviour.static",
          "performance.max-polygon-count",
          "performance.max-vertices",
          "performance.max-file-bytes",
          "spatial.up-axis",
          "spatial.handedness",
          "spatial.world-scale",
          "physical.tolerance",
        ],
        editable_recipe_formats: [
          Core.RECIPE_SCHEMA,
          Graph.SCHEMA,
          RECIPE_SCHEMA,
        ],
        operations: { preview: true, validate: true, edit: true },
        emits_editable_source: true,
        supports_edit_operation: true,
        requires: [],
        editable: true,
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
            "The DAG evaluator, geometry primitives, OBJ writer and glTF writer are bundled.",
        },
        host_compatibility: {
          hosts: [
            "asset-fabric",
            "studio",
            "mirror",
            "spatial-studio",
            "standalone",
          ],
          dependencies: [
            {
              name: "AXM geometry graph codec",
              version: Graph.VERSION,
              bundled: true,
            },
            { name: "AXM Spatial geometry", version: "v1", bundled: true },
            { name: "AXM glTF codec", version: GlTF.VERSION, bundled: true },
          ],
        },
        engine: {
          name: "AXM allowlisted geometry DAG + deterministic cache + OBJ/glTF bake",
          version: Graph.VERSION,
          execution: "local-bounded",
        },
        safety_tier: "safe-local",
        authority: "candidate-only",
        implementation_status: "executable",
        portability: {
          interchange_formats: [
            Graph.SCHEMA,
            "model/obj",
            "model/gltf-binary",
            "axm.spatial.project/v1",
            RECIPE_SCHEMA,
          ],
          known_losses: [
            "OBJ and GLB are baked deliveries and do not preserve graph editability",
          ],
          unsupported_features: [
            "arbitrary code nodes",
            "cycles",
            "boolean CSG",
            "subdivision",
            "UV generation",
            "rigging",
            "animation",
            "persistent cross-request cache",
            "z-up or left-handed output",
          ],
          fallbacks: [],
        },
        validation: {
          checks: [
            "graph schema, allowlist, input references and acyclicity",
            "bounded node/array counts",
            "deterministic cache keys",
            "canvas fit and physical tolerance",
            "polygon/vertex/file budgets",
            "real OBJ geometry and glTF 2.0 structure",
            "bake-integrity digests",
          ],
        },
        evidence: [
          {
            claim:
              "glTF 2.0 is used as the runtime baked interchange and independently inspected after encoding.",
            source_url:
              "https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html",
            specification_version: "glTF 2.0",
            retrieved_at: "2026-07-19",
          },
        ],
        tests: [
          "asset-hands-geometry-graph-selftest",
          "asset-hands-hardening-selftest",
        ],
        implementation_priority: "high",
        limits: {
          nodeTypes: Graph.ALLOWED_NODE_TYPES,
          maximumNodes: 64,
          maximumArrayCount: 32,
          maximumInstances: 256,
          cache: "request-local",
          arbitraryCode: false,
          csg: false,
          animation: false,
        },
      },
      create: create,
    };
  },
);
