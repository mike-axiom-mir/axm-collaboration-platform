(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
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
  function (Core, Spatial, Geometry, GlTF) {
    "use strict";
    if (!Spatial || !Geometry || !GlTF)
      throw new Error("Spatial and glTF codecs are required");
    function colour3(hex) {
      var n = parseInt(String(hex || "#58d2df").replace("#", ""), 16);
      return [
        ((n >> 16) & 255) / 255,
        ((n >> 8) & 255) / 255,
        (n & 255) / 255,
      ].map(function (v) {
        return Number(v.toFixed(6));
      });
    }
    function materialX(graph) {
      var c = graph.parameters.base_color;
      return (
        '<?xml version="1.0" encoding="UTF-8"?>\n<materialx version="1.38">\n  <standard_surface name="AXM_StandardSurface" type="surfaceshader">\n    <input name="base_color" type="color3" value="' +
        c.join(", ") +
        '"/>\n    <input name="metalness" type="float" value="' +
        graph.parameters.metallic +
        '"/>\n    <input name="specular_roughness" type="float" value="' +
        graph.parameters.roughness +
        '"/>\n    <input name="opacity" type="float" value="' +
        graph.parameters.opacity +
        '"/>\n    <input name="emission_color" type="color3" value="0, 0, 0"/>\n  </standard_surface>\n  <surfacematerial name="AXM_Material" type="material">\n    <input name="surfaceshader" type="surfaceshader" nodename="AXM_StandardSurface"/>\n  </surfacematerial>\n</materialx>\n'
      );
    }
    function inspectMaterialX(text) {
      var errors = [];
      if (
        !/^<\?xml/.test(text) ||
        !/<materialx\s+version="1\.38"/.test(text) ||
        !/<standard_surface\b/.test(text) ||
        !/<surfacematerial\b/.test(text) ||
        !/<\/materialx>\s*$/.test(text)
      )
        errors.push("MaterialX 1.38 standard surface structure missing");
      return { pass: !errors.length, errors: errors };
    }
    function source(context) {
      if (context.operationMode !== "edit") return null;
      try {
        var value = JSON.parse(context.sourceArtifacts[0].text);
        if (value.schema !== "axm.material-graph/v1") throw new Error();
        value.target_canvas = context.targetCanvas;
        return value;
      } catch (error) {
        throw new Error("Material edit requires axm.material-graph/v1 JSON");
      }
    }
    function project(context, graph) {
      var canvas = context.targetCanvas,
        scale = canvas.dimensions.unit === "mm" ? 0.001 : 1,
        size = Math.max(
          0.001,
          Math.min(canvas.dimensions.width, canvas.dimensions.height) *
            scale *
            0.5,
        ),
        budget =
          canvas.performance.max_polygon_count == null
            ? 4000
            : canvas.performance.max_polygon_count,
        detail = 28,
        mesh = Geometry.build("sphere", detail, {});
      while (mesh.indices.length / 3 > budget && detail > 6) {
        detail--;
        mesh = Geometry.build("sphere", detail, {});
      }
      var id = Core.hash(context.seed);
      return Spatial.normalizeProject({
        format: Spatial.FORMAT,
        version: Spatial.VERSION,
        id: "material-preview-" + id,
        name: context.brief.title,
        fps: 24,
        durationFrames: 1,
        createdAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z",
        materials: [
          {
            id: "material-" + id,
            name: context.brief.title,
            baseColor: graph.parameters.base_color_hex,
            metallic: graph.parameters.metallic,
            roughness: graph.parameters.roughness,
            emissive: "#000000",
            opacity: graph.parameters.opacity,
            doubleSided: false,
            source: "MaterialX hand",
            createdAt: "1970-01-01T00:00:00.000Z",
          },
        ],
        objects: [
          {
            id: "sphere-" + id,
            name: "Material preview sphere",
            type: "sphere",
            parentId: "",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [size, size, size],
            materialId: "material-" + id,
            visible: true,
            locked: false,
            castShadow: true,
            receiveShadow: true,
            geometry: {
              detail: detail,
              inflate: 0,
              twist: 0,
              seed: parseInt(id, 16),
            },
            metadata: { domain: "material-preview" },
            createdAt: "1970-01-01T00:00:00.000Z",
          },
        ],
        lights: [],
        camera: {
          target: [0, 0, 0],
          yaw: 35,
          pitch: 20,
          distance: size * 4,
          fov: 48,
          near: 0.001,
          far: 10000,
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
    function preview(brief, palette, graph) {
      var w = brief.canvas.width,
        h = brief.canvas.height,
        r = Math.min(w, h) * 0.27,
        cx = w * 0.5,
        cy = h * 0.47,
        body =
          '<defs><radialGradient id="m"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".35" stop-color="' +
          palette[0] +
          '"/><stop offset="1" stop-color="#02070c"/></radialGradient></defs><rect width="' +
          w +
          '" height="' +
          h +
          '" fill="#07111f"/><circle cx="' +
          cx +
          '" cy="' +
          cy +
          '" r="' +
          r +
          '" fill="url(#m)" stroke="' +
          palette[1] +
          '" stroke-width="3"/><text x="' +
          w * 0.06 +
          '" y="' +
          h * 0.88 +
          '" fill="#d9f8ff" font-family="system-ui" font-size="13">MaterialX 1.38 · metallic ' +
          graph.parameters.metallic +
          " · roughness " +
          graph.parameters.roughness +
          "</text>";
      return Core.svgDocument(brief, body, {
        label: brief.title + " material preview",
      });
    }
    return {
    descriptor: {
      schema: Core.HAND_SCHEMA,
      contract_version: "2.0",
      id: "material-shader",
      title: "Material & Shader Hand",
      version: "1.1.0",
        category: "material",
        lifecycle_status: "beta",
        summary:
          "Creates an editable MaterialX 1.38 standard-surface graph and a real glTF 2.0 GLB preview scene with matching PBR factors.",
        purpose:
          "Provide a portable material source and runtime preview without pretending renderer parity or texture compression.",
        operation_modes: ["create", "edit"],
        canvas_models: ["procedural-graph", "viewport-3d"],
        entry_surfaces: ["command", "material-editor", "export-recipe"],
        mutability: "transform",
        kinds: ["material", "shader", "texture"],
        accepts: [Core.BRIEF_SCHEMA, "axm.material-graph/v1"],
        produces: [
          Core.RESULT_SCHEMA,
          "application/mtlx+xml",
          "application/json",
          "model/gltf-binary",
          "image/svg+xml",
        ],
        input_types: [
          {
            mime: "application/json",
            schema: "axm.material-graph/v1",
            roles: ["source"],
            required_for: ["edit"],
            mutable: false,
            max_bytes: 1000000,
          },
        ],
        output_types: [
          {
            mime: "application/mtlx+xml",
            format: "MTLX",
            schema: "MaterialX.1.38",
            role: "portable-material-source",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: "axm.material-graph/v1",
            role: "editable-material-graph",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "model/gltf-binary",
            format: "GLB",
            schema: "glTF.2.0",
            role: "runtime-material-preview",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: [
              "GLB preview uses glTF metallic-roughness and omits renderer-specific nodes",
            ],
          },
          {
            mime: "image/svg+xml",
            format: "SVG",
            role: "material-preview",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: [
              "SVG preview is illustrative and not a shader render",
            ],
          },
        ],
        canvas_types: [
          {
            medium: "3d-surface",
            units: ["m", "mm"],
            colour_spaces: ["material-channel", "linear-srgb", "srgb"],
            transparency_modes: ["required", "allowed", "opaque"],
            behaviours: ["static"],
            intended_uses: ["material", "shader", "surface", "texture"],
          },
        ],
        constraints_honoured: [
          "dimensions",
          "dimensions.unit",
          "colour.space",
          "colour.transparency",
          "behaviour.static",
          "performance.max-file-bytes",
          "performance.max-polygon-count",
        ],
        editable_recipe_formats: [
          Core.RECIPE_SCHEMA,
          "axm.material-graph/v1",
          "axm.material-shader-recipe/v1",
        ],
      operations: { preview: true, validate: true, edit: true },
      emits_editable_source: true,
      supports_edit_operation: true,
        requires: [],
        editable: true,
        deterministic: true,
        required_permissions: {
          local_file_system: "none",
          network_domains: [],
        },
        network_policy: { mode: "none", domains: [] },
        host_compatibility: {
          dependencies: [
            { id: "spatial-geometry", version: "v1" },
            { id: "axm-gltf-codec", version: GlTF.VERSION },
          ],
        },
        engine: {
          name: "AXM MaterialX + glTF PBR",
          version: "1.0.0",
          execution: "same-thread-bounded",
        },
        safety_tier: "safe-local",
        portability: {
          interchange_formats: [
            "MaterialX 1.38",
            "glTF 2.0 GLB",
            "axm.material-graph/v1",
          ],
          known_losses: [
            "MaterialX renderer support and glTF shader vocabulary differ",
          ],
          unsupported_features: [
            "KTX2 compression",
            "UV baking",
            "renderer-specific shader code",
            "displacement baking",
          ],
          fallbacks: [],
        },
        validation: {
          checks: [
            "MaterialX document structure",
            "GLB header and glTF JSON",
            "matching PBR factors",
            "polygon and file budgets",
          ],
        },
        rollback: { strategy: "discard-candidate" },
        evidence: [
          {
            claim:
              "Material source uses a MaterialX 1.38 standard_surface and delivery preview uses a structurally validated glTF 2.0 GLB.",
            source_url: "local:shared/asset-hands/gltf-codec.js",
            specification_version: GlTF.VERSION,
          },
        ],
        tests: ["asset-hands-interchange-selftest", "asset-hands-selftest"],
        implementation_priority: "medium",
        limits: {
          materialX: "1.38",
          gltf: "2.0",
          ktx2: false,
          uvBake: false,
          rendererParity: false,
        },
      },
      create: function (context) {
        var existing = source(context),
          signal = (
            context.brief.title +
            " " +
            context.brief.purpose +
            " " +
            (context.brief.styleTags || []).join(" ")
          ).toLowerCase(),
          base = context.palette[0],
          graph = existing || {
            schema: "axm.material-graph/v1",
            version: 1,
            id: Core.slug(context.brief.title),
            name: context.brief.title,
            target_canvas: context.targetCanvas,
            node: "standard_surface",
            parameters: {
              base_color_hex: base,
              base_color: colour3(base),
              metallic: /metal|chrome|steel|armou?r/.test(signal) ? 0.82 : 0.12,
              roughness: /rough|cloth|wood/.test(signal)
                ? 0.78
                : /gloss|polish|chrome/.test(signal)
                  ? 0.18
                  : 0.48,
              opacity:
                context.targetCanvas.colour.transparency === "opaque"
                  ? 1
                  : 0.85,
            },
            bindings: [],
            provenance: { engine: "AXM MaterialX + glTF PBR" },
          },
          targetOpacity=context.targetCanvas.colour.transparency === "opaque" ? 1 : 0.85;
        graph.parameters.opacity=targetOpacity;
        var mtlx = materialX(graph),
          mtlxCheck = inspectMaterialX(mtlx),
          spatial = project(context, graph),
          glb = GlTF.fromProject(spatial, Geometry),
          json = JSON.stringify(graph, null, 2),
          svg = preview(context.brief, context.palette, graph),
          total = mtlx.length + glb.byteLength + json.length + svg.length;
        return {
          artifacts: [
            {
              id: "materialx-source",
              role: "portable-material-source",
              name: context.brief.title + " MaterialX",
              filename: Core.slug(context.brief.title) + ".mtlx",
              mime: "application/mtlx+xml",
              format: "MTLX",
              editable: true,
              text: mtlx,
              metadata: { schema: "MaterialX.1.38", node: "standard_surface" },
            },
            {
              id: "material-graph",
              role: "editable-material-graph",
              name: context.brief.title + " material graph",
              filename: Core.slug(context.brief.title) + ".material.json",
              mime: "application/json",
              format: "JSON",
              editable: true,
              text: json,
              metadata: { schema: graph.schema },
            },
            {
              id: "material-glb",
              role: "runtime-material-preview",
              name: context.brief.title + " GLB preview",
              filename: Core.slug(context.brief.title) + ".glb",
              mime: "model/gltf-binary",
              format: "GLB",
              editable: false,
              dataUrl: glb.dataUrl,
              metadata: {
                schema: "glTF.2.0",
                triangles: glb.triangles,
                materialPreview: true,
              },
            },
            {
              id: "material-preview",
              role: "material-preview",
              name: context.brief.title + " preview",
              filename: Core.slug(context.brief.title) + "-material.svg",
              mime: "image/svg+xml",
              format: "SVG",
              editable: false,
              text: svg,
              width: context.brief.canvas.width,
              height: context.brief.canvas.height,
            },
          ],
          previewArtifactId: "material-preview",
          recipe: {
            format: "axm.material-graph/v1",
            parameters: {
              operation: context.operationMode,
              node: "standard_surface",
              materialXVersion: "1.38",
              gltfVersion: "2.0",
              baseColor: graph.parameters.base_color,
              metallic: graph.parameters.metallic,
              roughness: graph.parameters.roughness,
              opacity: graph.parameters.opacity,
            },
            steps: [
              { op: "derive-portable-pbr-parameters" },
              { op: "emit-materialx-standard-surface" },
              { op: "build-bounded-preview-sphere" },
              { op: "encode-gltf-2-glb" },
              { op: "validate-material-and-container" },
            ],
          },
          validationChecks: [
            {
              name: "materialx-structure",
              pass: mtlxCheck.pass,
              details: mtlxCheck,
            },
            {
              name: "glb-structure",
              pass: glb.inspection.pass,
              details: {
                version: glb.inspection.version,
                length: glb.inspection.length,
              },
            },
            {
              name: "polygon-budget",
              pass:
                context.targetCanvas.performance.max_polygon_count == null ||
                glb.triangles <=
                  context.targetCanvas.performance.max_polygon_count,
            },
            {
              name: "file-budget",
              pass:
                context.targetCanvas.performance.max_file_bytes == null ||
                total <= context.targetCanvas.performance.max_file_bytes,
            },
            {
              name: "transparency-mode-honoured",
              pass:
                (context.targetCanvas.colour.transparency === "opaque" &&
                  graph.parameters.opacity === 1) ||
                (context.targetCanvas.colour.transparency !== "opaque" &&
                  graph.parameters.opacity < 1),
            },
          ],
          measures: {
            triangles: glb.triangles,
            glbBytes: glb.byteLength,
            materialXBytes: mtlx.length,
            totalBytes: total,
          },
          notes: [
            "MaterialX and GLB are genuine interchange documents.",
            "KTX2 delivery is handled by its own texture hand; UV baking and renderer-specific shader parity remain explicit missing capabilities here.",
          ],
        };
      },
    };
  },
);
