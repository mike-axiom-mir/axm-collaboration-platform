(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
      node
        ? require("../spatial-navigation-codec")
        : root.AXMSpatialNavigationCodec,
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
  function (Core, Navigation, Spatial, Geometry, GlTF) {
    "use strict";
    if (!Core || !Navigation || !Spatial || !Geometry || !GlTF)
      throw new Error(
        "AXM core, navigation, Spatial and glTF codecs are required",
      );
    var RECIPE_SCHEMA = "axm.spatial-navigation-recipe/v1",
      REPORT_SCHEMA = "axm.spatial-navigation-validation/v1";
    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }
    function fixedTime() {
      return "1970-01-01T00:00:00.000Z";
    }
    function scale(canvas) {
      return canvas.dimensions.unit === "game-world-unit"
        ? canvas.spatial.world_scale || 1
        : canvas.dimensions.unit === "mm"
          ? 0.001
          : 1;
    }
    function sourceRecipe(context) {
      var item = context.sourceArtifacts.find(function (source) {
        return source.content_schema === RECIPE_SCHEMA;
      });
      if (!item) return null;
      var value;
      try {
        value = JSON.parse(item.text);
      } catch (error) {
        throw new Error("spatial navigation recipe source is not valid JSON");
      }
      if (
        !value ||
        value.schema !== RECIPE_SCHEMA ||
        !value.generation ||
        !value.collision ||
        !value.navigation
      )
        throw new Error("spatial navigation recipe source is incomplete");
      return { item: item, value: value };
    }
    function debugProject(context, built) {
      var obstacle = built.collision.shapes[1],
        canvas = context.targetCanvas,
        dimensions = [
          canvas.dimensions.width * scale(canvas),
          canvas.dimensions.height * scale(canvas),
          (canvas.dimensions.depth || canvas.dimensions.width) * scale(canvas),
        ],
        id = Core.hash(context.seed),
        materialId = "collision-debug-" + id;
      return Spatial.normalizeProject({
        format: Spatial.FORMAT,
        version: Spatial.VERSION,
        id: "collision-debug-project-" + id,
        name: context.brief.title + " collision debug",
        fps: 24,
        durationFrames: 1,
        createdAt: fixedTime(),
        updatedAt: fixedTime(),
        materials: [
          {
            id: materialId,
            name: "Collision Debug",
            baseColor: "#ff5c6c",
            metallic: 0,
            roughness: 0.8,
            emissive: "#210006",
            opacity: 0.55,
            doubleSided: true,
            source: "spatial-collision-navigation debug only",
            createdAt: fixedTime(),
          },
        ],
        objects: [
          {
            id: "collision-ground",
            name: "Collision ground",
            type: "plane",
            parentId: "",
            position: [
              built.collision.bounds.minimum[0] + dimensions[0] / 2,
              built.collision.bounds.minimum[1],
              built.collision.bounds.minimum[2] + dimensions[2] / 2,
            ],
            rotation: [0, 0, 0],
            scale: [dimensions[0] / 2, 1, dimensions[2] / 2],
            materialId: materialId,
            visible: true,
            locked: true,
            castShadow: false,
            receiveShadow: false,
            geometry: { detail: 3, inflate: 0, twist: 0, seed: 1 },
            metadata: {
              domain: "collision-proxy",
              note: "debug-only; not render geometry",
            },
            createdAt: fixedTime(),
          },
          {
            id: "collision-obstacle",
            name: "Collision obstacle",
            type: "cube",
            parentId: "",
            position: obstacle.center,
            rotation: [0, 0, 0],
            scale: obstacle.size.map(function (value) {
              return value / 2;
            }),
            materialId: materialId,
            visible: true,
            locked: true,
            castShadow: false,
            receiveShadow: false,
            geometry: { detail: 3, inflate: 0, twist: 0, seed: 2 },
            metadata: {
              domain: "collision-proxy",
              note: "debug-only; not render geometry; layer=" + obstacle.layer,
            },
            createdAt: fixedTime(),
          },
        ],
        lights: [],
        camera: {
          target: [0, 0, 0],
          yaw: 35,
          pitch: 45,
          distance: Math.max(dimensions[0], dimensions[2]) * 2,
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
    function preview(context, built) {
      var w = context.brief.canvas.width,
        h = context.brief.canvas.height,
        bounds = built.navigation.walkable_bounds,
        spanX = bounds.maximum[0] - bounds.minimum[0],
        spanZ = bounds.maximum[2] - bounds.minimum[2],
        pad = Math.min(w, h) * 0.08,
        sx = (w - pad * 2) / spanX,
        sz = (h - pad * 2) / spanZ,
        s = Math.min(sx, sz),
        obstacle = built.collision.shapes[1],
        polygons = built.navigation.polygons
          .map(function (polygon) {
            return (
              '<polygon points="' +
              polygon
                .map(function (index) {
                  var point = built.navigation.vertices[index];
                  return (
                    (pad + (point[0] - bounds.minimum[0]) * s).toFixed(2) +
                    "," +
                    (h - pad - (point[2] - bounds.minimum[2]) * s).toFixed(2)
                  );
                })
                .join(" ") +
              '" fill="#245d5a" stroke="#73ead7" stroke-width="1"/>'
            );
          })
          .join(""),
        obstacleX =
          pad +
          (obstacle.center[0] - obstacle.size[0] / 2 - bounds.minimum[0]) * s,
        obstacleY =
          h -
          pad -
          (obstacle.center[2] + obstacle.size[2] / 2 - bounds.minimum[2]) * s;
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        w +
        '" height="' +
        h +
        '" viewBox="0 0 ' +
        w +
        " " +
        h +
        '" role="img" aria-label="Collision and navigation topology preview"><rect width="100%" height="100%" fill="#07131d"/>' +
        polygons +
        '<rect x="' +
        obstacleX.toFixed(2) +
        '" y="' +
        obstacleY.toFixed(2) +
        '" width="' +
        (obstacle.size[0] * s).toFixed(2) +
        '" height="' +
        (obstacle.size[2] * s).toFixed(2) +
        '" fill="#e24b5f" stroke="#fff" stroke-width="2"/><text x="16" y="28" fill="#d5fff8" font-family="system-ui" font-size="12">' +
        built.navigation.polygons.length +
        " walkable triangles · " +
        built.collision.triangles.length +
        " collision triangles · separate proxy</text></svg>"
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
    function semanticCollisionDigest(value) {
      return Navigation.hash({
        policy: value.policy,
        vertices: value.vertices,
        triangles: value.triangles,
        shapes: value.shapes,
        layers: value.layers,
        bounds: value.bounds,
      });
    }
    function semanticNavigationDigest(value) {
      return Navigation.hash({
        settings: value.settings,
        vertices: value.vertices,
        polygons: value.polygons,
        adjacency: value.adjacency,
        walkable_bounds: value.walkable_bounds,
        excluded_regions: value.excluded_regions,
      });
    }
    function create(context) {
      var canvas = context.targetCanvas,
        source = sourceRecipe(context),
        factor = scale(canvas),
        dimensions = [
          canvas.dimensions.width * factor,
          canvas.dimensions.height * factor,
          (canvas.dimensions.depth || canvas.dimensions.width) * factor,
        ],
        origin = (
          canvas.spatial.origin.length ? canvas.spatial.origin : [0, 0, 0]
        ).map(function (value) {
          return value * factor;
        }),
        generation = source ? source.value.generation : {},
        policy =
          canvas.spatial.collision || generation.policy || "solid-and-walkable",
        provenance = {
          hand: "spatial-collision-navigation",
          hand_version: "1.0.0",
          seed: context.seed,
          source_artifact_digests: context.sourceArtifacts.map(function (item) {
            return item.digest;
          }),
        },
        built = Navigation.build({
          dimensions: dimensions,
          origin: origin,
          policy: policy,
          maxTriangles:
            canvas.performance.max_polygon_count == null
              ? 2000
              : canvas.performance.max_polygon_count,
          maxVertices:
            canvas.performance.max_vertices == null
              ? 3000
              : canvas.performance.max_vertices,
          agentRadius:
            generation.agent_radius ||
            Math.min(dimensions[0], dimensions[2]) * 0.035,
          agentHeight:
            generation.agent_height || Math.max(0.1, dimensions[1] * 0.5),
          maxSlopeDegrees: generation.max_slope_degrees || 45,
          stepHeight:
            generation.step_height || Math.max(0.02, dimensions[1] * 0.1),
          targetCanvas: clone(canvas),
          worldScale: factor,
          provenance: provenance,
        }),
        project = debugProject(context, built),
        glb = GlTF.fromProject(project, Geometry),
        collisionDigest = semanticCollisionDigest(built.collision),
        navigationDigest = semanticNavigationDigest(built.navigation),
        projectText = JSON.stringify(project, null, 2),
        collisionText = JSON.stringify(built.collision, null, 2),
        navigationText = JSON.stringify(built.navigation, null, 2),
        svg = preview(context, built),
        totalBytes =
          collisionText.length +
          navigationText.length +
          projectText.length +
          glb.byteLength +
          svg.length,
        expected =
          source && context.operationMode === "validate"
            ? {
                collision: source.value.collision.digest,
                navigation: source.value.navigation.digest,
              }
            : null,
        checks = [
          {
            name: "collision-triangles-and-shapes",
            pass: built.collisionInspection.pass,
            details: built.collisionInspection,
          },
          {
            name: "navigation-polygons-adjacency-and-connectivity",
            pass: built.navigationInspection.pass,
            details: built.navigationInspection,
          },
          {
            name: "collision-policy",
            pass: ["solid-and-walkable", "separate-proxy"].indexOf(policy) >= 0,
            details: { policy: policy },
          },
          {
            name: "obstacle-excluded-from-navigation",
            pass:
              built.navigationInspection.excludedRegions > 0 &&
              built.navigationInspection.errors.every(function (error) {
                return error.indexOf("enters collision obstacle") < 0;
              }),
          },
          {
            name: "combined-polygon-budget",
            pass:
              canvas.performance.max_polygon_count == null ||
              built.totalTriangles <= canvas.performance.max_polygon_count,
            details: {
              actual: built.totalTriangles,
              maximum: canvas.performance.max_polygon_count,
            },
          },
          {
            name: "combined-vertex-budget",
            pass:
              canvas.performance.max_vertices == null ||
              built.totalVertices <= canvas.performance.max_vertices,
            details: {
              actual: built.totalVertices,
              maximum: canvas.performance.max_vertices,
            },
          },
          {
            name: "spatial-convention-and-origin",
            pass:
              canvas.spatial.up_axis === "y" &&
              canvas.spatial.handedness === "right" &&
              built.collision.bounds.minimum[0] ===
                origin[0] - dimensions[0] / 2,
          },
          {
            name: "debug-glb-is-separate-proxy",
            pass:
              glb.inspection.pass &&
              project.objects.every(function (object) {
                return (
                  object.metadata.domain === "collision-proxy" &&
                  /not render geometry/.test(object.metadata.note)
                );
              }),
            details: {
              glb_version: glb.inspection.version,
              triangles: glb.triangles,
            },
          },
          {
            name: "source-recipe-integrity",
            pass:
              !expected ||
              (expected.collision === collisionDigest &&
                expected.navigation === navigationDigest),
            details: {
              expected: expected,
              actual: {
                collision: collisionDigest,
                navigation: navigationDigest,
              },
            },
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
        sourceRecord = source
          ? {
              id: source.item.id,
              digest: source.item.digest,
              schema: RECIPE_SCHEMA,
            }
          : null,
        recipe = {
          schema: RECIPE_SCHEMA,
          version: "1.0.0",
          id: "spatial-navigation-" + Core.slug(context.brief.id),
          target_canvas: clone(canvas),
          operation: context.operationMode,
          source: sourceRecord,
          generation: {
            dimensions_metres: dimensions,
            origin_metres: origin,
            policy: policy,
            divisions: built.divisions,
            agent_radius: built.navigation.settings.agent_radius,
            agent_height: built.navigation.settings.agent_height,
            max_slope_degrees: built.navigation.settings.max_slope_degrees,
            step_height: built.navigation.settings.step_height,
          },
          collision: {
            schema: Navigation.COLLISION_SCHEMA,
            digest: collisionDigest,
            triangles: built.collision.triangles.length,
            vertices: built.collision.vertices.length,
            shapes: built.collision.shapes.length,
          },
          navigation: {
            schema: Navigation.NAVIGATION_SCHEMA,
            digest: navigationDigest,
            polygons: built.navigation.polygons.length,
            vertices: built.navigation.vertices.length,
            connected: built.navigationInspection.connected,
            excluded_regions: built.navigation.excluded_regions.length,
          },
          debug_delivery: {
            format: "glTF 2.0 GLB",
            collision_proxy: true,
            render_geometry: false,
            digest: Core.hash(glb.dataUrl),
          },
          budgets: {
            total_triangles: built.totalTriangles,
            total_vertices: built.totalVertices,
            max_polygon_count: canvas.performance.max_polygon_count,
            max_vertices: canvas.performance.max_vertices,
            max_file_bytes: canvas.performance.max_file_bytes,
            total_bytes: totalBytes,
          },
          known_limits: [
            "deterministic planar grid navigation with one axis-aligned obstacle",
            "no arbitrary render-mesh decomposition, off-mesh links, dynamic obstacles, heightfields or runtime pathfinding",
            "debug GLB is explicitly a collision proxy and must not replace render geometry",
            "bounded local topology validator; Recast/Detour runtime validation is not bundled",
          ],
          provenance: provenance,
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
            "bounded independent collision-triangle and navigation-topology generation with obstacle exclusion, symmetric adjacency, connectivity and explicit non-render debug delivery",
          target_canvas: clone(canvas),
          operation: context.operationMode,
          collision: {
            schema: Navigation.COLLISION_SCHEMA,
            digest: collisionDigest,
            inspection: built.collisionInspection,
            policy: policy,
          },
          navigation: {
            schema: Navigation.NAVIGATION_SCHEMA,
            digest: navigationDigest,
            inspection: built.navigationInspection,
            settings: built.navigation.settings,
          },
          spatial: {
            up_axis: "y",
            handedness: "right",
            origin_metres: origin,
            world_scale: factor,
            bounds: built.collision.bounds,
          },
          budgets: recipe.budgets,
          debug_delivery: recipe.debug_delivery,
          checks: checks,
        },
        slug = Core.slug(context.brief.title);
      return {
        artifacts: [
          jsonArtifact(
            "collision-mesh",
            "collision-mesh",
            context.brief.title + " collision mesh",
            slug + "-collision.json",
            built.collision,
            true,
          ),
          jsonArtifact(
            "navigation-mesh",
            "navigation-mesh",
            context.brief.title + " navigation mesh",
            slug + "-navigation.json",
            built.navigation,
            true,
          ),
          {
            id: "collision-debug-glb",
            role: "collision-debug-proxy",
            name: context.brief.title + " collision debug GLB",
            filename: slug + "-collision-debug.glb",
            mime: "model/gltf-binary",
            format: "GLB",
            editable: false,
            dataUrl: glb.dataUrl,
            metadata: {
              schema: "glTF.2.0",
              collisionProxy: true,
              renderGeometry: false,
              triangles: glb.triangles,
            },
          },
          {
            id: "collision-debug-project",
            role: "editable-collision-debug-project",
            name: context.brief.title + " collision debug project",
            filename: slug + "-collision-debug.spatial.json",
            mime: "application/json",
            format: "JSON",
            editable: true,
            text: projectText,
            metadata: {
              schema: Spatial.FORMAT,
              collisionProxy: true,
              renderGeometry: false,
            },
          },
          jsonArtifact(
            "spatial-navigation-recipe",
            "editable-spatial-navigation-recipe",
            context.brief.title + " spatial navigation recipe",
            slug + "-navigation-recipe.json",
            recipe,
            true,
          ),
          jsonArtifact(
            "spatial-navigation-validation",
            "spatial-navigation-validation",
            context.brief.title + " spatial navigation validation",
            slug + "-navigation-validation.json",
            report,
            false,
          ),
          {
            id: "spatial-navigation-preview",
            role: "collision-navigation-preview",
            name: context.brief.title + " collision/navigation preview",
            filename: slug + "-navigation.svg",
            mime: "image/svg+xml",
            format: "SVG",
            editable: false,
            text: svg,
            width: context.brief.canvas.width,
            height: context.brief.canvas.height,
            metadata: { topologyDerived: true, collisionProxy: true },
          },
        ],
        previewArtifactId: "spatial-navigation-preview",
        recipe: {
          format: RECIPE_SCHEMA,
          parameters: recipe,
          steps: [
            { op: "derive-spatial-bounds-origin-and-collision-policy" },
            { op: "build-independent-ground-and-obstacle-collision-triangles" },
            { op: "fit-planar-navigation-grid-to-polygon-and-vertex-budgets" },
            { op: "exclude-collision-cells-and-build-symmetric-adjacency" },
            { op: "validate-connectivity-and-bake-separate-debug-glb" },
          ],
        },
        validationChecks: checks,
        measures: {
          collisionTriangles: built.collision.triangles.length,
          collisionVertices: built.collision.vertices.length,
          navigationPolygons: built.navigation.polygons.length,
          navigationVertices: built.navigation.vertices.length,
          totalTriangles: built.totalTriangles,
          totalVertices: built.totalVertices,
          divisions: built.divisions,
          excludedRegions: built.navigation.excluded_regions.length,
          connected: built.navigationInspection.connected,
          glbBytes: glb.byteLength,
          totalBytes: totalBytes,
        },
        notes: [
          "Collision and navigation are separate semantic JSON artifacts; the GLB is clearly marked as a debug proxy, never render geometry.",
          "This hand creates a bounded planar ground-navigation case. Complex source-mesh decomposition and production Recast integration remain unsupported rather than guessed.",
        ],
      };
    }
    return {
      descriptor: {
        schema: Core.HAND_SCHEMA,
        contract_version: "2.0",
        id: "spatial-collision-navigation",
        title: "Spatial Collision & Navigation Hand",
        version: "1.0.0",
        category: "spatial-runtime",
        lifecycle_status: "beta",
        summary:
          "Creates separate collision triangles, walkable navigation topology and a non-render debug GLB with deterministic obstacle exclusion, adjacency/connectivity checks and canvas budgets.",
        purpose:
          "Give game and 3D environments explicit collision/navigation semantics without pretending a render mesh is automatically safe runtime topology.",
        operation_modes: ["create", "edit", "validate"],
        canvas_models: ["viewport-3d", "scene-graph", "procedural-graph"],
        entry_surfaces: [
          "command",
          "spatial-studio",
          "asset-fabric",
          "studio-handoff",
          "export-recipe",
        ],
        mutability: "transform",
        kinds: [
          "environment",
          "ground-tile",
          "3d-model",
          "collision",
          "navigation",
        ],
        accepts: [Core.BRIEF_SCHEMA, RECIPE_SCHEMA],
        produces: [
          Core.RESULT_SCHEMA,
          Navigation.COLLISION_SCHEMA,
          Navigation.NAVIGATION_SCHEMA,
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
            schema: RECIPE_SCHEMA,
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
            schema: Navigation.COLLISION_SCHEMA,
            role: "collision-mesh",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: Navigation.NAVIGATION_SCHEMA,
            role: "navigation-mesh",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "model/gltf-binary",
            format: "GLB",
            schema: "glTF.2.0",
            role: "collision-debug-proxy",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: [
              "debug visualization contains collision proxy shapes only and is not render geometry",
            ],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: "axm.spatial.project/v1",
            role: "editable-collision-debug-project",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: RECIPE_SCHEMA,
            role: "editable-spatial-navigation-recipe",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: REPORT_SCHEMA,
            role: "spatial-navigation-validation",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "image/svg+xml",
            format: "SVG",
            role: "collision-navigation-preview",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: [
              "top-down topology view is not a rendered game scene",
            ],
          },
        ],
        canvas_types: [
          {
            medium: "game-world",
            units: ["game-world-unit", "m"],
            colour_spaces: ["material-channel", "linear-srgb"],
            transparency_modes: ["opaque"],
            behaviours: ["static", "interactive"],
            intended_uses: [
              "environment",
              "ground-tile",
              "3d-model",
              "collision",
              "navigation",
            ],
            up_axes: ["y"],
            handedness: ["right"],
          },
          {
            medium: "3d-surface",
            units: ["m"],
            colour_spaces: ["material-channel", "linear-srgb"],
            transparency_modes: ["opaque"],
            behaviours: ["static", "interactive"],
            intended_uses: [
              "environment",
              "ground-tile",
              "3d-model",
              "collision",
              "navigation",
            ],
            up_axes: ["y"],
            handedness: ["right"],
          },
        ],
        canvas_limits: {
          min_width: 0.1,
          min_height: 0.1,
          min_polygon_count: 20,
          min_vertices: 21,
        },
        constraints_honoured: [
          "dimensions",
          "dimensions.unit",
          "colour.space",
          "colour.transparency",
          "behaviour.static",
          "behaviour.interactive",
          "performance.max-polygon-count",
          "performance.max-vertices",
          "performance.max-file-bytes",
          "spatial.up-axis",
          "spatial.handedness",
          "spatial.world-scale",
          "spatial.origin",
          "spatial.collision",
        ],
        editable_recipe_formats: [
          Core.RECIPE_SCHEMA,
          Navigation.COLLISION_SCHEMA,
          Navigation.NAVIGATION_SCHEMA,
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
            "Collision triangles, navigation topology and debug GLB are generated and validated locally.",
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
              name: "AXM spatial navigation codec",
              version: Navigation.VERSION,
              bundled: true,
            },
            { name: "AXM Spatial geometry", version: "v1", bundled: true },
            { name: "AXM glTF codec", version: GlTF.VERSION, bundled: true },
          ],
        },
        engine: {
          name: "AXM collision proxy + planar navigation topology builder",
          version: Navigation.VERSION,
          execution: "local-bounded",
        },
        safety_tier: "safe-local",
        authority: "candidate-only",
        implementation_status: "executable",
        portability: {
          interchange_formats: [
            Navigation.COLLISION_SCHEMA,
            Navigation.NAVIGATION_SCHEMA,
            "model/gltf-binary",
            RECIPE_SCHEMA,
          ],
          known_losses: [
            "debug GLB conveys proxy shapes but not navigation adjacency",
          ],
          unsupported_features: [
            "arbitrary render-mesh decomposition",
            "convex decomposition",
            "heightfield navigation",
            "off-mesh links",
            "dynamic obstacles",
            "runtime pathfinding",
            "Recast/Detour certification",
            "z-up or left-handed output",
          ],
          fallbacks: [],
        },
        validation: {
          checks: [
            "collision triangle validity and non-degeneracy",
            "navigation polygon validity",
            "symmetric adjacency and connectivity",
            "collision obstacle exclusion",
            "combined polygon/vertex and file budgets",
            "world scale/origin and spatial convention",
            "debug GLB marked non-render",
            "source recipe digest integrity",
          ],
        },
        evidence: [
          {
            claim:
              "Recast Navigation separates navigation-mesh construction from runtime queries; this hand implements only a bounded local topology case and does not claim Recast compatibility.",
            source_url: "https://github.com/recastnavigation/recastnavigation",
            specification_version: "upstream project documentation",
            retrieved_at: "2026-07-19",
          },
        ],
        tests: [
          "asset-hands-spatial-navigation-selftest",
          "asset-hands-hardening-selftest",
        ],
        implementation_priority: "high",
        limits: {
          planar: true,
          obstacles: 1,
          dynamicObstacles: false,
          offMeshLinks: false,
          recast: false,
          runtimePathfinding: false,
          debugGlbIsRenderGeometry: false,
        },
      },
      create: create,
    };
  },
);
