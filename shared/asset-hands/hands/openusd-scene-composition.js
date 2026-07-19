(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
      node ? require("../openusd-codec") : root.AXMOpenUSDCodec,
    );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register)
    root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, USD) {
  "use strict";
  if (!Core || !USD) throw new Error("AXM core and OpenUSD codec are required");
  var COMPOSITION_SCHEMA = "axm.usd-scene-composition/v1",
    RECIPE_SCHEMA = "axm.openusd-scene-recipe/v1",
    REPORT_SCHEMA = "scene-composition-report";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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
  function sourceRecord(item) {
    return item
      ? {
          id: item.id,
          digest: item.digest,
          mime: item.mime,
          schema: item.content_schema || null,
        }
      : null;
  }
  function metersPerUnit(canvas) {
    if (canvas.dimensions.unit === "m") return 1;
    if (canvas.dimensions.unit === "mm") return 0.001;
    return canvas.spatial.world_scale || 1;
  }
  function defaultComposition(context) {
    var canvas = context.targetCanvas,
      dims = canvas.dimensions;
    return {
      schema: COMPOSITION_SCHEMA,
      version: "1.0.0",
      id: "usd-scene-" + Core.slug(context.brief.id),
      name: context.brief.title,
      target_canvas: clone(canvas),
      root_layer: "root.usda",
      meters_per_unit: metersPerUnit(canvas),
      up_axis: "Y",
      handedness: "right",
      dimensions: {
        width: dims.width,
        height: dims.height,
        depth: dims.depth || dims.height,
        unit: dims.unit,
      },
      layers: [
        {
          id: "ground",
          path: "layers/ground.usda",
          arc: "reference",
          prim: "/Asset",
        },
        {
          id: "environment",
          path: "payloads/environment.usda",
          arc: "payload",
          prim: "/Asset",
          load_policy: "deferred-capable",
        },
      ],
      variants: [
        {
          id: "Cube",
          layer: "layers/cube.usda",
          shape: "cube",
          prim: "/Asset",
        },
        {
          id: "Sphere",
          layer: "layers/sphere.usda",
          shape: "octahedron",
          prim: "/Asset",
        },
      ],
      active_variant: "Cube",
      resolver_policy: {
        scheme: "package-relative",
        allow_absolute: false,
        allow_parent_traversal: false,
        allow_network: false,
        missing_reference: "HOLD",
      },
      provenance: {
        hand: "openusd-scene-composition",
        hand_version: "1.0.0",
        seed: context.seed,
        source_artifact_digests: context.sourceArtifacts.map(function (item) {
          return item.digest;
        }),
      },
    };
  }
  function validateComposition(value) {
    var errors = [];
    if (!value || value.schema !== COMPOSITION_SCHEMA)
      errors.push("composition schema mismatch");
    if (!value || value.root_layer !== "root.usda")
      errors.push("bounded composition root layer must be root.usda");
    if (!value || value.up_axis !== "Y" || value.handedness !== "right")
      errors.push("bounded composition requires Y-up right-handed convention");
    if (!value || !Array.isArray(value.variants) || value.variants.length < 2)
      errors.push("at least two variants are required");
    if (!value || !Array.isArray(value.layers) || value.layers.length < 2)
      errors.push("reference and payload layers are required");
    var paths = [];
    ((value && value.variants) || []).forEach(function (variant) {
      paths.push(variant.layer);
    });
    ((value && value.layers) || []).forEach(function (layer) {
      paths.push(layer.path);
    });
    paths.forEach(function (path) {
      if (!USD.safePath(path)) errors.push("unsafe composition path: " + path);
    });
    if (new Set(paths).size !== paths.length)
      errors.push("composition layer paths must be unique");
    if (
      value &&
      Array.isArray(value.variants) &&
      !value.variants.some(function (variant) {
        return variant.id === value.active_variant;
      })
    )
      errors.push("active variant is not declared");
    if (
      value &&
      Array.isArray(value.layers) &&
      !value.layers.some(function (layer) {
        return layer.arc === "payload";
      })
    )
      errors.push("payload layer is required");
    return { pass: !errors.length, errors: errors };
  }
  function editComposition(context) {
    var item = context.sourceArtifacts.find(function (source) {
      return source.content_schema === COMPOSITION_SCHEMA;
    });
    if (!item)
      throw new Error(
        "OpenUSD scene edit requires axm.usd-scene-composition/v1 source",
      );
    var value;
    try {
      value = JSON.parse(item.text);
    } catch (error) {
      throw new Error("OpenUSD composition source is not valid JSON");
    }
    var checked = validateComposition(value);
    if (!checked.pass)
      throw new Error(
        "OpenUSD composition validation failed: " + checked.errors.join("; "),
      );
    value = clone(value);
    value.target_canvas = clone(context.targetCanvas);
    value.dimensions = {
      width: context.targetCanvas.dimensions.width,
      height: context.targetCanvas.dimensions.height,
      depth:
        context.targetCanvas.dimensions.depth ||
        context.targetCanvas.dimensions.height,
      unit: context.targetCanvas.dimensions.unit,
    };
    value.meters_per_unit = metersPerUnit(context.targetCanvas);
    value.provenance = {
      hand: "openusd-scene-composition",
      hand_version: "1.0.0",
      seed: context.seed,
      source_artifact_digests: [item.digest],
    };
    return { item: item, composition: value };
  }
  function activeGeometry(composition, inspection) {
    var names = [];
    var variant = composition.variants.find(function (item) {
      return item.id === composition.active_variant;
    });
    if (variant) names.push(variant.layer);
    composition.layers.forEach(function (layer) {
      names.push(layer.path);
    });
    return names.reduce(
      function (sum, name) {
        var layer = inspection.layers[name];
        if (layer) {
          sum.triangles += layer.triangles;
          sum.vertices += layer.vertices;
        }
        return sum;
      },
      { triangles: 0, vertices: 0 },
    );
  }
  function checksFor(context, inspection, composition, packageBytes) {
    var canvas = context.targetCanvas,
      active = composition
        ? activeGeometry(composition, inspection)
        : {
            triangles: inspection.packagedTriangles,
            vertices: inspection.packagedVertices,
          },
      root = inspection.layers[inspection.rootLayer] || null;
    var checks = [
      {
        name: "usdz-container-and-crc",
        pass: inspection.pass,
        details: {
          entries: inspection.entries.length,
          bytes: inspection.bytes,
        },
      },
      { name: "root-layer-first", pass: inspection.rootLayer === "root.usda" },
      { name: "stored-and-unencrypted", pass: inspection.storedOnly },
      {
        name: "sixty-four-byte-file-alignment",
        pass: inspection.allDataAligned64,
      },
      {
        name: "package-relative-references-resolve",
        pass: inspection.missingReferences.length === 0,
        details: {
          references: inspection.references,
          missing: inspection.missingReferences,
        },
      },
      {
        name: "variant-set-present",
        pass: !!root && root.variantSets.indexOf("model") >= 0,
      },
      {
        name: "meters-per-unit",
        pass:
          !!root &&
          Math.abs(root.metersPerUnit - metersPerUnit(canvas)) < 0.0000001,
        details: {
          actual: root && root.metersPerUnit,
          expected: metersPerUnit(canvas),
        },
      },
      {
        name: "spatial-convention",
        pass:
          !!root &&
          root.upAxis === "Y" &&
          canvas.spatial.up_axis === "y" &&
          canvas.spatial.handedness === "right",
      },
      {
        name: "polygon-budget",
        pass:
          canvas.performance.max_polygon_count == null ||
          active.triangles <= canvas.performance.max_polygon_count,
        details: {
          active: active.triangles,
          packaged: inspection.packagedTriangles,
          maximum: canvas.performance.max_polygon_count,
        },
      },
      {
        name: "vertex-budget",
        pass:
          canvas.performance.max_vertices == null ||
          active.vertices <= canvas.performance.max_vertices,
        details: {
          active: active.vertices,
          packaged: inspection.packagedVertices,
          maximum: canvas.performance.max_vertices,
        },
      },
      {
        name: "file-budget",
        pass:
          canvas.performance.max_file_bytes == null ||
          packageBytes <= canvas.performance.max_file_bytes,
        details: {
          package_bytes: packageBytes,
          maximum: canvas.performance.max_file_bytes,
        },
      },
      {
        name: "external-openusd-claim-is-not-made",
        pass: true,
        details: { external_openusd_validation: false },
      },
    ];
    return { checks: checks, active: active, root: root };
  }
  function reportValue(context, inspection, composition, source, packageBytes) {
    var validated = checksFor(context, inspection, composition, packageBytes),
      rootText = validated.root;
    return {
      schema: REPORT_SCHEMA,
      version: "1.0.0",
      status: validated.checks.every(function (check) {
        return check.pass;
      })
        ? "PASS"
        : "HOLD",
      claim:
        "bounded structural validation of readable USDA layers, deterministic USDZ stored packaging, 64-byte file-data alignment, package-relative reference resolution and variant/payload declarations; an external OpenUSD runtime was not executed",
      target_canvas: clone(context.targetCanvas),
      operation: context.operationMode,
      source: source,
      root_layer: rootText,
      package: {
        mime: USD.MIME,
        format: "USDZ",
        bytes: packageBytes,
        entries: inspection.entries.map(function (entry) {
          return {
            name: entry.name,
            bytes: entry.bytes,
            data_offset: entry.data_offset,
            aligned_64: entry.aligned_64,
          };
        }),
      },
      composition_arcs: {
        references: inspection.references.filter(function (item) {
          return item.reference.indexOf("payloads/") !== 0;
        }).length,
        payloads: inspection.references.filter(function (item) {
          return item.reference.indexOf("payloads/") === 0;
        }).length,
      },
      variants: rootText ? rootText.variantSets : [],
      resolver: {
        policy: "package-relative-only",
        missing_references: inspection.missingReferences,
        network: false,
        absolute_paths: false,
        parent_traversal: false,
      },
      geometry: {
        active_triangles: validated.active.triangles,
        active_vertices: validated.active.vertices,
        packaged_triangles: inspection.packagedTriangles,
        packaged_vertices: inspection.packagedVertices,
      },
      external_openusd_validation: false,
      checks: validated.checks,
    };
  }
  function recipeValue(context, composition, inspection, source, packageBytes) {
    var active = composition
      ? activeGeometry(composition, inspection)
      : {
          triangles: inspection.packagedTriangles,
          vertices: inspection.packagedVertices,
        };
    return {
      schema: RECIPE_SCHEMA,
      version: "1.0.0",
      id: "openusd-" + Core.slug(context.brief.id),
      target_canvas: clone(context.targetCanvas),
      operation: context.operationMode,
      source: source,
      composition: composition
        ? {
            schema: composition.schema,
            root_layer: composition.root_layer,
            layers: composition.layers.map(function (layer) {
              return { id: layer.id, path: layer.path, arc: layer.arc };
            }),
            variants: composition.variants.map(function (variant) {
              return { id: variant.id, layer: variant.layer };
            }),
            active_variant: composition.active_variant,
            meters_per_unit: composition.meters_per_unit,
            up_axis: composition.up_axis,
            handedness: composition.handedness,
          }
        : {
            root_layer: inspection.rootLayer,
            layers: inspection.layerCount,
            variants:
              (inspection.layers[inspection.rootLayer] || {}).variantSets || [],
          },
      package: {
        format: "USDZ stored ZIP",
        alignment_bytes: 64,
        entries: inspection.entries.length,
        bytes: packageBytes,
        all_references_embedded: inspection.missingReferences.length === 0,
      },
      budgets: {
        active_triangles: active.triangles,
        active_vertices: active.vertices,
        max_polygon_count: context.targetCanvas.performance.max_polygon_count,
        max_vertices: context.targetCanvas.performance.max_vertices,
        max_file_bytes: context.targetCanvas.performance.max_file_bytes,
      },
      claims: [
        "USDA 1.0 text layers",
        "stored and unencrypted USDZ package with 64-byte file-data alignment",
        "package-relative reference and payload closure",
      ],
      known_limits: [
        "bounded USDA syntax inspector, not the full OpenUSD composition engine",
        "no sublayers, inherits, specializes, value clips, schemas, animation or native renderer execution",
        "USDZ package contains only generated text USDA layers; crate USDC is not emitted",
        "external usdchecker and OpenUSD asset resolver were not bundled",
      ],
      provenance: {
        hand: "openusd-scene-composition",
        hand_version: "1.0.0",
        codec_version: USD.VERSION,
        seed: context.seed,
        source_artifact_digests: context.sourceArtifacts.map(function (item) {
          return item.digest;
        }),
      },
    };
  }
  function preview(context, composition) {
    var w = context.brief.canvas.width,
      h = context.brief.canvas.height,
      cx = w / 2,
      rootY = h * 0.18,
      childY = h * 0.62,
      items = composition
        ? composition.variants
            .map(function (item) {
              return item.id;
            })
            .concat(
              composition.layers.map(function (item) {
                return item.id;
              }),
            )
        : ["resolved layers"],
      step = w / (items.length + 1),
      paths = items
        .map(function (_, index) {
          return (
            '<path d="M' +
            cx +
            " " +
            (rootY + 28) +
            " L" +
            step * (index + 1) +
            " " +
            (childY - 24) +
            '" stroke="#7dd8cb" stroke-width="3"/>'
          );
        })
        .join(""),
      nodes = items
        .map(function (name, index) {
          var x = step * (index + 1);
          return (
            '<rect x="' +
            (x - 38) +
            '" y="' +
            (childY - 24) +
            '" width="76" height="48" rx="8" fill="#18394a" stroke="#7dd8cb"/><text x="' +
            x +
            '" y="' +
            (childY + 5) +
            '" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="11">' +
            Core.escapeXml(name) +
            "</text>"
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
      '" role="img" aria-label="OpenUSD layer composition preview"><rect width="100%" height="100%" fill="#07131d"/>' +
      paths +
      '<rect x="' +
      (cx - 54) +
      '" y="' +
      rootY +
      '" width="108" height="56" rx="10" fill="#326c78"/><text x="' +
      cx +
      '" y="' +
      (rootY + 34) +
      '" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="13">root.usda</text>' +
      nodes +
      '<text x="16" y="28" fill="#bcefe7" font-family="system-ui" font-size="12">USDZ · package-relative · 64-byte aligned</text></svg>'
    );
  }
  function generated(context) {
    var edited =
        context.operationMode === "edit" ? editComposition(context) : null,
      composition = edited ? edited.composition : defaultComposition(context),
      checked = validateComposition(composition);
    if (!checked.pass)
      throw new Error(
        "OpenUSD composition validation failed: " + checked.errors.join("; "),
      );
    var built = USD.build(composition),
      inspection = built.inspection,
      source = sourceRecord(edited && edited.item),
      report = reportValue(
        context,
        inspection,
        composition,
        source,
        built.package.byteLength,
      ),
      recipe = recipeValue(
        context,
        composition,
        inspection,
        source,
        built.package.byteLength,
      ),
      slug = Core.slug(context.brief.title),
      artifacts = [];
    Object.keys(built.files).forEach(function (name, index) {
      artifacts.push({
        id: index === 0 ? "openusd-root-layer" : "openusd-layer-" + index,
        role: index === 0 ? "openusd-root-layer" : "openusd-composition-layer",
        name: context.brief.title + " " + name,
        filename: name,
        mime: "model/vnd.usd",
        format: "USDA",
        editable: true,
        text: built.files[name],
        metadata: {
          schema: "OpenUSD.USDA.1.0",
          packagePath: name,
          rootLayer: index === 0,
        },
      });
    });
    artifacts.push({
      id: "openusd-scene-package",
      role: "openusd-scene-package",
      name: context.brief.title + " USDZ",
      filename: slug + ".usdz",
      mime: USD.MIME,
      format: "USDZ",
      editable: false,
      dataUrl: built.package.dataUrl,
      metadata: {
        schema: "OpenUSD.USDZ.1.0",
        rootLayer: composition.root_layer,
        entries: inspection.entries.length,
      },
    });
    artifacts.push(
      jsonArtifact(
        "usd-scene-composition",
        "editable-scene-composition",
        context.brief.title + " scene composition",
        slug + "-composition.json",
        composition,
        true,
      ),
    );
    artifacts.push(
      jsonArtifact(
        "openusd-scene-recipe",
        "editable-openusd-scene-recipe",
        context.brief.title + " OpenUSD recipe",
        slug + "-openusd-recipe.json",
        recipe,
        true,
      ),
    );
    artifacts.push(
      jsonArtifact(
        "scene-composition-report",
        "scene-composition-report",
        context.brief.title + " scene composition report",
        slug + "-composition-report.json",
        report,
        false,
      ),
    );
    artifacts.push({
      id: "openusd-composition-preview",
      role: "scene-composition-preview",
      name: context.brief.title + " layer graph preview",
      filename: slug + "-composition.svg",
      mime: "image/svg+xml",
      format: "SVG",
      editable: false,
      text: preview(context, composition),
      width: context.brief.canvas.width,
      height: context.brief.canvas.height,
    });
    return {
      artifacts: artifacts,
      previewArtifactId: "openusd-composition-preview",
      recipe: {
        format: RECIPE_SCHEMA,
        parameters: recipe,
        steps: [
          { op: "normalize-scene-composition-and-resolver-policy" },
          { op: "author-usda-reference-payload-and-variant-layers" },
          { op: "package-stored-usdz-with-64-byte-file-alignment" },
          { op: "resolve-package-relative-arcs" },
          { op: "validate-geometry-and-file-budgets" },
        ],
      },
      validationChecks: report.checks,
      measures: {
        layers: inspection.layerCount,
        packageEntries: inspection.entries.length,
        packageBytes: built.package.byteLength,
        references: inspection.references.length,
        variants: composition.variants.length,
        activeTriangles: report.geometry.active_triangles,
        activeVertices: report.geometry.active_vertices,
        packagedTriangles: inspection.packagedTriangles,
        packagedVertices: inspection.packagedVertices,
        aligned64: inspection.allDataAligned64,
      },
      notes: [
        "USDA layers and the USDZ stored package are genuine composition artifacts, not renamed JSON or GLB files.",
        "The local validator proves package closure and bounded syntax only; full OpenUSD composition and native renderer certification remain outside this hand.",
      ],
    };
  }
  function inspectExisting(context) {
    var item = context.sourceArtifacts.find(function (source) {
      return source.mime === USD.MIME;
    });
    if (!item)
      throw new Error(
        "OpenUSD inspect/validate requires model/vnd.usdz+zip source",
      );
    var data = USD.bytesFromDataUrl(item.dataUrl),
      inspection = USD.inspectPackage(data),
      source = sourceRecord(item),
      report = reportValue(context, inspection, null, source, data.length),
      recipe = recipeValue(context, null, inspection, source, data.length),
      slug = Core.slug(context.brief.title),
      rootText =
        inspection.rootLayer && inspection.layers[inspection.rootLayer]
          ? USD.decode(USD.inspectArchive(data).files[inspection.rootLayer])
          : "";
    return {
      artifacts: [
        {
          id: "validated-openusd-package",
          role: "validated-openusd-package",
          name: context.brief.title + " validated USDZ",
          filename: slug + "-validated.usdz",
          mime: USD.MIME,
          format: "USDZ",
          editable: false,
          dataUrl: item.dataUrl,
          metadata: { schema: "OpenUSD.USDZ.1.0", sourceDigest: item.digest },
        },
        {
          id: "validated-openusd-root",
          role: "validated-openusd-root",
          name: context.brief.title + " inspected root layer",
          filename: "root.usda",
          mime: "model/vnd.usd",
          format: "USDA",
          editable: true,
          text: rootText,
          metadata: { schema: "OpenUSD.USDA.1.0", sourceDigest: item.digest },
        },
        jsonArtifact(
          "openusd-scene-recipe",
          "editable-openusd-scene-recipe",
          context.brief.title + " OpenUSD recipe",
          slug + "-openusd-recipe.json",
          recipe,
          true,
        ),
        jsonArtifact(
          "scene-composition-report",
          "scene-composition-report",
          context.brief.title + " scene composition report",
          slug + "-composition-report.json",
          report,
          false,
        ),
        {
          id: "openusd-composition-preview",
          role: "scene-composition-preview",
          name: context.brief.title + " package preview",
          filename: slug + "-composition.svg",
          mime: "image/svg+xml",
          format: "SVG",
          editable: false,
          text: preview(context, null),
          width: context.brief.canvas.width,
          height: context.brief.canvas.height,
        },
      ],
      previewArtifactId: "openusd-composition-preview",
      recipe: {
        format: RECIPE_SCHEMA,
        parameters: recipe,
        steps: [
          { op: "parse-stored-usdz-and-crc" },
          { op: "verify-64-byte-file-data-alignment" },
          { op: "inspect-bounded-usda-layers" },
          { op: "resolve-package-relative-arcs" },
        ],
      },
      validationChecks: report.checks,
      measures: {
        layers: inspection.layerCount,
        packageEntries: inspection.entries.length,
        packageBytes: data.length,
        references: inspection.references.length,
        packagedTriangles: inspection.packagedTriangles,
        packagedVertices: inspection.packagedVertices,
        aligned64: inspection.allDataAligned64,
      },
      notes: [
        "The supplied package is preserved byte-for-byte and is never silently repaired.",
      ],
    };
  }

  return {
    descriptor: {
      schema: Core.HAND_SCHEMA,
      contract_version: "2.0",
      id: "openusd-scene-composition",
      title: "OpenUSD Scene Composition Hand",
      version: "1.0.0",
      category: "scene-composition",
      lifecycle_status: "beta",
      summary:
        "Authors deterministic USDA reference, payload and variant layers and packages them as a stored USDZ archive with 64-byte file-data alignment and package-relative resolution receipts.",
      purpose:
        "Provide a real bounded OpenUSD scene-composition interchange path while keeping full runtime composition and native DCC validation visibly out of scope.",
      operation_modes: ["create", "edit", "inspect", "validate", "workflow"],
      canvas_models: ["viewport-3d", "scene-graph", "procedural-graph"],
      entry_surfaces: [
        "command",
        "spatial-studio",
        "asset-fabric",
        "studio-handoff",
        "export-recipe",
      ],
      mutability: "transform",
      kinds: ["scene", "3d-model", "environment"],
      accepts: [Core.BRIEF_SCHEMA, COMPOSITION_SCHEMA, USD.MIME],
      produces: [
        Core.RESULT_SCHEMA,
        "model/vnd.usd",
        USD.MIME,
        "application/json",
        "image/svg+xml",
        COMPOSITION_SCHEMA,
        RECIPE_SCHEMA,
        REPORT_SCHEMA,
      ],
      input_types: [
        {
          mime: "application/json",
          format: "JSON",
          schema: COMPOSITION_SCHEMA,
          roles: ["source"],
          required_for: ["edit"],
          mutable: false,
          max_bytes: 2000000,
        },
        {
          mime: USD.MIME,
          format: "USDZ",
          roles: ["source"],
          required_for: ["inspect", "validate"],
          mutable: false,
          max_bytes: 50000000,
        },
      ],
      output_types: [
        {
          mime: "model/vnd.usd",
          format: "USDA",
          schema: "OpenUSD.USDA.1.0",
          role: "openusd-layer",
          editable: true,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
        {
          mime: USD.MIME,
          format: "USDZ",
          schema: "OpenUSD.USDZ.1.0",
          role: "openusd-package",
          editable: false,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
        {
          mime: "application/json",
          format: "JSON",
          schema: COMPOSITION_SCHEMA,
          role: "editable-scene-composition",
          editable: true,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
        {
          mime: "application/json",
          format: "JSON",
          schema: RECIPE_SCHEMA,
          role: "editable-openusd-scene-recipe",
          editable: true,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
        {
          mime: "application/json",
          format: "JSON",
          schema: REPORT_SCHEMA,
          role: "scene-composition-report",
          editable: false,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
        {
          mime: "image/svg+xml",
          format: "SVG",
          role: "scene-composition-preview",
          editable: false,
          deterministic: true,
          lossy: true,
          known_losses: [
            "preview depicts the layer graph, not a native OpenUSD render",
          ],
        },
      ],
      canvas_types: [
        {
          medium: "3d-surface",
          units: ["m", "mm"],
          colour_spaces: ["linear-srgb", "material-channel"],
          transparency_modes: ["opaque"],
          behaviours: ["static", "interactive"],
          intended_uses: ["scene", "3d-model", "environment"],
          up_axes: ["y"],
          handedness: ["right"],
        },
        {
          medium: "game-world",
          units: ["game-world-unit", "m"],
          colour_spaces: ["linear-srgb", "material-channel"],
          transparency_modes: ["opaque"],
          behaviours: ["static", "interactive"],
          intended_uses: ["scene", "3d-model", "environment"],
          up_axes: ["y"],
          handedness: ["right"],
        },
      ],
      canvas_limits: {
        min_width: 0.01,
        min_height: 0.01,
        min_polygon_count: 26,
        min_vertices: 20,
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
      ],
      editable_recipe_formats: [
        Core.RECIPE_SCHEMA,
        COMPOSITION_SCHEMA,
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
          "The USDA author, stored USDZ packager and package-relative resolver are bundled.",
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
            name: "AXM OpenUSD bounded codec",
            version: USD.VERSION,
            bundled: true,
          },
        ],
      },
      engine: {
        name: "AXM USDA author + aligned stored USDZ package resolver",
        version: USD.VERSION,
        execution: "local-bounded",
      },
      safety_tier: "safe-local",
      authority: "candidate-only",
      implementation_status: "executable",
      portability: {
        interchange_formats: [
          "USDA 1.0",
          "USDZ stored ZIP",
          COMPOSITION_SCHEMA,
          RECIPE_SCHEMA,
        ],
        known_losses: [
          "the editable JSON graph describes only the bounded authored subset",
        ],
        unsupported_features: [
          "USDC crate authoring",
          "full OpenUSD composition evaluation",
          "sublayers/inherits/specializes/value clips",
          "animation",
          "native DCC rendering",
          "external usdchecker certification",
          "z-up and left-handed scenes",
          "external or network asset resolution",
        ],
        fallbacks: [],
      },
      validation: {
        checks: [
          "USDA 1.0 headers and path safety",
          "USDZ stored and unencrypted ZIP structure/CRC",
          "64-byte file-data alignment",
          "root layer first",
          "package-relative reference and payload closure",
          "variant-set declaration",
          "meters-per-unit and spatial convention",
          "active polygon/vertex and package file budgets",
          "honest external-runtime claim boundary",
        ],
      },
      evidence: [
        {
          claim:
            "OpenUSD scene composition uses layer composition arcs including references, payloads and variant sets.",
          source_url: "https://openusd.org/release/",
          specification_version: "OpenUSD release documentation",
          retrieved_at: "2026-07-19",
        },
        {
          claim:
            "USDZ packages use uncompressed ZIP entries and alignment constraints for package assets.",
          source_url: "https://openusd.org/release/spec_usdz.html",
          specification_version: "USDZ specification",
          retrieved_at: "2026-07-19",
        },
      ],
      tests: ["asset-hands-openusd-selftest", "asset-hands-hardening-selftest"],
      implementation_priority: "high",
      limits: {
        usda: true,
        usdc: false,
        packageAlignmentBytes: 64,
        resolver: "package-relative-only",
        externalOpenUSDValidation: false,
        animation: false,
      },
    },
    create: function (context) {
      return context.operationMode === "inspect" ||
        context.operationMode === "validate"
        ? inspectExisting(context)
        : generated(context);
    },
  };
});
