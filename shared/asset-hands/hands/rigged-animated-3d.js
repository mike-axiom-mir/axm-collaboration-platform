(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
      node ? require("../rigged-gltf-codec") : root.AXMRiggedGlTFCodec,
    );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register)
    root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, Rig) {
  "use strict";
  if (!Core || !Rig)
    throw new Error("AXM core and rigged glTF codec are required");
  var CLIP_SCHEMA = "animation/clip+json",
    RECIPE_SCHEMA = "axm.rigged-animation-recipe/v1",
    REPORT_SCHEMA = "axm.rigged-animation-validation/v1";
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
  function clipSource(context) {
    var item = context.sourceArtifacts.find(function (value) {
      return value.content_schema === CLIP_SCHEMA;
    });
    if (!item) throw new Error("rig edit requires animation/clip+json source");
    var value;
    try {
      value = JSON.parse(item.text);
    } catch (error) {
      throw new Error("animation clip source is not valid JSON");
    }
    return { item: item, value: value };
  }
  function colour(value) {
    var match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
    if (!match) return [0.25, 0.72, 0.68, 1];
    var number = parseInt(match[1], 16);
    return [
      ((number >> 16) & 255) / 255,
      ((number >> 8) & 255) / 255,
      (number & 255) / 255,
      1,
    ];
  }
  function preview(context, clip) {
    var w = context.brief.canvas.width,
      h = context.brief.canvas.height,
      cx = w / 2,
      top = h * 0.18,
      bottom = h * 0.82,
      mid = (top + bottom) / 2,
      pose = clip.frames[Math.floor(clip.frames.length / 4)],
      spineAngle =
        2 * Math.atan2(pose.spine_rotation[2], pose.spine_rotation[3]),
      headAngle = 2 * Math.atan2(pose.head_rotation[2], pose.head_rotation[3]),
      length = (bottom - top) / 2,
      spineX = cx + Math.sin(spineAngle) * length,
      spineY = bottom - Math.cos(spineAngle) * length,
      headX = spineX + Math.sin(spineAngle + headAngle) * length,
      headY = spineY - Math.cos(spineAngle + headAngle) * length;
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      w +
      '" height="' +
      h +
      '" viewBox="0 0 ' +
      w +
      " " +
      h +
      '" role="img" aria-label="Skinned skeleton deformation preview"><rect width="100%" height="100%" fill="' +
      context.palette[0] +
      '"/><path d="M' +
      cx +
      " " +
      bottom +
      " L" +
      spineX.toFixed(3) +
      " " +
      spineY.toFixed(3) +
      " L" +
      headX.toFixed(3) +
      " " +
      headY.toFixed(3) +
      '" fill="none" stroke="' +
      context.palette[1] +
      '" stroke-width="' +
      Math.max(8, w * 0.035) +
      '" stroke-linecap="round"/><g fill="' +
      context.palette[2] +
      '"><circle cx="' +
      cx +
      '" cy="' +
      bottom +
      '" r="8"/><circle cx="' +
      spineX.toFixed(3) +
      '" cy="' +
      spineY.toFixed(3) +
      '" r="8"/><circle cx="' +
      headX.toFixed(3) +
      '" cy="' +
      headY.toFixed(3) +
      '" r="12"/></g><text x="16" y="28" fill="#fff" font-family="system-ui" font-size="13">3 joints · ' +
      clip.frames.length +
      " keys · " +
      clip.fps +
      " fps</text></svg>"
    );
  }
  function validation(context, inspection, bytes, operation) {
    var canvas = context.targetCanvas,
      checks = [
        {
          name: "glb-container",
          pass: inspection.base.pass,
          details: {
            version: inspection.base.version,
            length: inspection.base.length,
          },
        },
        {
          name: "skin-joints-and-inverse-bind-matrices",
          pass: !!inspection.skin && inspection.skin.joints === 3,
        },
        { name: "joint-indices", pass: inspection.jointIndicesPass },
        { name: "normalized-weights", pass: inspection.weightSumsPass },
        {
          name: "animation-channels-and-timebase",
          pass:
            !!inspection.animation &&
            inspection.animation.channels === 2 &&
            inspection.animation.frames >= 2,
        },
        {
          name: "cpu-deformation-bounds",
          pass: inspection.deformation.pass && inspection.deformation.changed,
        },
        {
          name: "polygon-budget",
          pass:
            canvas.performance.max_polygon_count == null ||
            inspection.triangles <= canvas.performance.max_polygon_count,
        },
        {
          name: "vertex-budget",
          pass:
            canvas.performance.max_vertices == null ||
            inspection.vertices <= canvas.performance.max_vertices,
        },
        {
          name: "frame-budget",
          pass:
            canvas.performance.max_animation_frames == null ||
            inspection.animation.frames <=
              canvas.performance.max_animation_frames,
        },
        {
          name: "duration-budget",
          pass:
            canvas.performance.max_duration_seconds == null ||
            inspection.animation.durationSeconds <=
              canvas.performance.max_duration_seconds + 0.0001,
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
            bytes <= canvas.performance.max_file_bytes,
        },
      ];
    return {
      checks: checks,
      report: {
        schema: REPORT_SCHEMA,
        version: "1.0.0",
        status: checks.every(function (check) {
          return check.pass;
        })
          ? "PASS"
          : "HOLD",
        claim:
          "bounded glTF 2.0 skin and animation validation with CPU deformation samples; external Khronos validator not run",
        target_canvas: JSON.parse(JSON.stringify(canvas)),
        operation: operation,
        container: {
          mime: "model/gltf-binary",
          format: "GLB",
          bytes: bytes,
          version: inspection.base.version,
        },
        skin: inspection.skin,
        animation: inspection.animation,
        deformation: inspection.deformation,
        budgets: {
          triangles: inspection.triangles,
          vertices: inspection.vertices,
          frames: inspection.animation && inspection.animation.frames,
          duration_seconds:
            inspection.animation && inspection.animation.durationSeconds,
          max_polygon_count: canvas.performance.max_polygon_count,
          max_vertices: canvas.performance.max_vertices,
          max_animation_frames: canvas.performance.max_animation_frames,
          max_duration_seconds: canvas.performance.max_duration_seconds,
          max_file_bytes: canvas.performance.max_file_bytes,
        },
        checks: checks,
      },
    };
  }
  function recipe(context, clip, inspection, source, scale) {
    return {
      schema: RECIPE_SCHEMA,
      version: "1.0.0",
      id: "rig-" + Core.slug(context.brief.id),
      target_canvas: JSON.parse(JSON.stringify(context.targetCanvas)),
      operation: context.operationMode,
      source: source,
      geometry: {
        type: "weighted cylindrical character proxy",
        triangles: inspection.triangles,
        vertices: inspection.vertices,
        height_metres: scale.height,
        radius_metres: scale.radius,
      },
      skeleton: {
        joints: inspection.skin.joints,
        root: "root",
        inverse_bind_matrices: true,
        weights: "JOINTS_0 + normalized WEIGHTS_0",
      },
      animation: {
        name: clip.name,
        frames: clip.frames.length,
        fps: clip.fps,
        duration_seconds: clip.duration_seconds,
        channels: inspection.animation.channels,
        interpolation: "LINEAR",
        loop: clip.loop,
      },
      interchange: {
        container: "GLB",
        specification: "glTF 2.0",
        embedded_buffer: true,
        external_validator: false,
      },
      known_limits: [
        "three-joint bounded character proxy",
        "rotation channels only",
        "no morph targets, IK, constraints or root motion",
        "external Khronos glTF Validator not bundled",
      ],
      provenance: {
        hand: "rigged-animated-3d",
        hand_version: "1.0.0",
        seed: context.seed,
        source_artifact_digests: context.sourceArtifacts.map(function (item) {
          return item.digest;
        }),
      },
    };
  }
  function validateSource(context) {
    var item = context.sourceArtifacts.find(function (value) {
      return value.mime === "model/gltf-binary";
    });
    if (!item)
      throw new Error("rig validation requires model/gltf-binary source");
    var data = Rig.bytesFromDataUrl(item.dataUrl),
      inspection = Rig.inspect(data),
      fps = context.targetCanvas.performance.frames_per_second || 24,
      maxFrames =
        context.targetCanvas.performance.max_animation_frames ||
        Math.max(2, (inspection.animation && inspection.animation.frames) || 2),
      duration =
        context.targetCanvas.performance.max_duration_seconds ||
        (inspection.animation && inspection.animation.durationSeconds) ||
        1,
      clip = Rig.makeClip({
        id: "validated-" + Core.slug(context.brief.id),
        name: context.brief.title + " validation source",
        fps: fps,
        maxFrames: maxFrames,
        duration: duration,
        provenance: {
          hand: "rigged-animated-3d",
          hand_version: "1.0.0",
          seed: context.seed,
          source_artifact_digests: [item.digest],
        },
      }),
      scale = {
        height:
          context.targetCanvas.dimensions.height *
          (context.targetCanvas.dimensions.unit === "game-world-unit"
            ? context.targetCanvas.spatial.world_scale || 1
            : 1),
        radius:
          Math.min(
            context.targetCanvas.dimensions.width,
            context.targetCanvas.dimensions.depth ||
              context.targetCanvas.dimensions.width,
          ) / 2,
      },
      checked = validation(context, inspection, data.length, "validate"),
      recipeValue = recipe(
        context,
        clip,
        inspection,
        { id: item.id, digest: item.digest, mime: item.mime },
        scale,
      ),
      slug = Core.slug(context.brief.title),
      artifacts = [
        {
          id: "validated-rigged-glb",
          role: "validated-rigged-glb",
          name: context.brief.title + " validated rigged GLB",
          filename: slug + "-validated.glb",
          mime: "model/gltf-binary",
          format: "GLB",
          editable: false,
          dataUrl: item.dataUrl,
          metadata: {
            schema: "glTF.2.0",
            skin: true,
            animation: true,
            sourceDigest: item.digest,
          },
        },
        jsonArtifact(
          "animation-clip",
          "editable-animation-clip",
          context.brief.title + " reconstructed clip receipt",
          slug + "-clip.json",
          clip,
          true,
        ),
        jsonArtifact(
          "rigged-animation-recipe",
          "editable-rigged-animation-recipe",
          context.brief.title + " rig recipe",
          slug + "-rig-recipe.json",
          recipeValue,
          true,
        ),
        jsonArtifact(
          "rigged-animation-validation",
          "rigged-animation-validation",
          context.brief.title + " rig validation",
          slug + "-rig-validation.json",
          checked.report,
          false,
        ),
      ];
    return {
      artifacts: artifacts,
      previewArtifactId: "validated-rigged-glb",
      recipe: {
        format: RECIPE_SCHEMA,
        parameters: recipeValue,
        steps: [
          { op: "parse-glb-skin-animation-and-accessors" },
          { op: "verify-weights-joint-indices-timebase-and-quaternions" },
          { op: "sample-cpu-skin-deformation-bounds" },
        ],
      },
      validationChecks: checked.checks,
      measures: {
        triangles: inspection.triangles,
        vertices: inspection.vertices,
        joints: inspection.skin && inspection.skin.joints,
        frames: inspection.animation && inspection.animation.frames,
        durationSeconds:
          inspection.animation && inspection.animation.durationSeconds,
        glbBytes: data.length,
      },
      notes: [
        "Validation preserves the supplied GLB and does not silently repair or retarget it.",
      ],
    };
  }
  var descriptor = {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "rigged-animated-3d",
    title: "Rigged & Animated 3D Hand",
    version: "1.0.0",
    category: "rigged-animation-3d",
    lifecycle_status: "beta",
    summary:
      "Creates or edits a bounded glTF 2.0 skinned character with real JOINTS_0/WEIGHTS_0 attributes, inverse bind matrices, skeleton hierarchy and quaternion animation channels.",
    purpose:
      "Provide an honest executable rig/animation path distinct from static mesh delivery.",
    operation_modes: ["create", "edit", "validate"],
    canvas_models: ["viewport-3d", "timeline"],
    entry_surfaces: [
      "command",
      "spatial-studio",
      "film-motion-studio",
      "export-recipe",
    ],
    mutability: "transform",
    kinds: ["character", "rig", "animation", "3d-model", "skinned-mesh"],
    accepts: [
      Core.BRIEF_SCHEMA,
      CLIP_SCHEMA,
      "model/gltf-binary",
      RECIPE_SCHEMA,
    ],
    produces: [
      Core.RESULT_SCHEMA,
      "model/gltf-binary",
      "application/json",
      "image/svg+xml",
      CLIP_SCHEMA,
      RECIPE_SCHEMA,
      REPORT_SCHEMA,
    ],
    input_types: [
      {
        mime: "application/json",
        format: "JSON",
        schema: CLIP_SCHEMA,
        roles: ["source"],
        required_for: ["edit"],
        mutable: false,
        max_bytes: 4000000,
      },
      {
        mime: "model/gltf-binary",
        format: "GLB",
        roles: ["source"],
        required_for: ["validate"],
        mutable: false,
        max_bytes: 25000000,
      },
    ],
    output_types: [
      {
        mime: "model/gltf-binary",
        format: "GLB",
        schema: "glTF.2.0",
        role: "rigged-animated-glb",
        editable: false,
        deterministic: true,
        lossy: false,
        known_losses: [],
      },
      {
        mime: "application/json",
        format: "JSON",
        schema: CLIP_SCHEMA,
        role: "editable-animation-clip",
        editable: true,
        deterministic: true,
        lossy: false,
        known_losses: [],
      },
      {
        mime: "application/json",
        format: "JSON",
        schema: RECIPE_SCHEMA,
        role: "editable-rigged-animation-recipe",
        editable: true,
        deterministic: true,
        lossy: false,
        known_losses: [],
      },
      {
        mime: "application/json",
        format: "JSON",
        schema: REPORT_SCHEMA,
        role: "rigged-animation-validation",
        editable: false,
        deterministic: true,
        lossy: false,
        known_losses: [],
      },
      {
        mime: "image/svg+xml",
        format: "SVG",
        role: "skeleton-deformation-preview",
        editable: false,
        deterministic: true,
        lossy: true,
        known_losses: [
          "preview shows one sampled skeleton pose, not the rendered mesh",
        ],
      },
    ],
    canvas_types: [
      {
        medium: "game-world",
        units: ["game-world-unit", "m"],
        colour_spaces: ["linear-srgb", "material-channel"],
        transparency_modes: ["opaque"],
        behaviours: ["animated", "interactive"],
        intended_uses: [
          "character",
          "3d-model",
          "animation",
          "rig",
          "skinned-mesh",
        ],
        up_axes: ["y"],
        handedness: ["right"],
      },
      {
        medium: "3d-surface",
        units: ["m"],
        colour_spaces: ["linear-srgb", "material-channel"],
        transparency_modes: ["opaque"],
        behaviours: ["animated", "interactive"],
        intended_uses: [
          "character",
          "3d-model",
          "animation",
          "rig",
          "skinned-mesh",
        ],
        up_axes: ["y"],
        handedness: ["right"],
      },
    ],
    canvas_limits: {
      min_width: 0.1,
      min_height: 0.2,
      max_width: 20,
      max_height: 20,
      min_animation_frames: 2,
      max_animation_frames: 240,
      min_fps: 1,
      max_fps: 60,
      min_polygon_count: 16,
      min_vertices: 16,
    },
    constraints_honoured: [
      "dimensions",
      "dimensions.unit",
      "colour.space",
      "colour.transparency",
      "behaviour.animated",
      "behaviour.interactive",
      "performance.max-file-bytes",
      "performance.max-polygon-count",
      "performance.max-vertices",
      "performance.max-animation-frames",
      "performance.frames-per-second",
      "performance.max-duration-seconds",
      "spatial.up-axis",
      "spatial.handedness",
      "spatial.world-scale",
    ],
    editable_recipe_formats: [Core.RECIPE_SCHEMA, CLIP_SCHEMA, RECIPE_SCHEMA],
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
        "The glTF writer, accessor validator and CPU skin-deformation sampler are local.",
    },
    host_compatibility: {
      hosts: ["asset-fabric", "studio", "mirror", "standalone"],
      dependencies: [
        { name: "AXM glTF codec", version: "1.0.0", bundled: true },
        { name: "AXM rigged glTF codec", version: Rig.VERSION, bundled: true },
      ],
    },
    engine: {
      name: "AXM glTF 2.0 skin/animation writer + CPU deformation validator",
      version: Rig.VERSION,
      execution: "local-bounded",
    },
    safety_tier: "safe-local",
    authority: "candidate-only",
    implementation_status: "executable",
    portability: {
      interchange_formats: ["model/gltf-binary", CLIP_SCHEMA, RECIPE_SCHEMA],
      known_losses: ["SVG preview is a sampled skeleton pose"],
      unsupported_features: [
        "more than three joints",
        "morph targets",
        "inverse kinematics",
        "constraints",
        "root motion",
        "animation compression",
        "z-up or left-handed export",
        "external glTF validation certification",
      ],
      fallbacks: [],
    },
    validation: {
      checks: [
        "GLB 2.0 container and accessors",
        "JOINTS_0 and normalized WEIGHTS_0",
        "skin hierarchy and inverse bind matrices",
        "strictly increasing animation time input",
        "normalized quaternion outputs",
        "CPU-skinned deformation bounds at five samples",
        "polygon, vertex, frame, duration and file budgets",
      ],
    },
    evidence: [
      {
        claim:
          "glTF 2.0 defines skins using joint node indices and inverse bind matrices, with vertex joint and weight attributes.",
        source_url: "https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html",
        specification_version: "glTF 2.0",
        retrieved_at: "2026-07-19",
      },
      {
        claim:
          "The Khronos glTF Validator is the external follow-up validator for broader conformance checks.",
        source_url: "https://github.com/KhronosGroup/glTF-Validator",
        specification_version: "current project guidance",
        retrieved_at: "2026-07-19",
      },
    ],
    tests: ["rigged-animation-selftest", "asset-hands-interchange-selftest"],
    limits: {
      joints: 3,
      maxFrames: 240,
      maxFps: 60,
      maxTriangles: 50000,
      maxVertices: 50000,
      upAxis: "y",
      handedness: "right",
      network: false,
    },
  };
  async function createAsync(context) {
    if (context.operationMode === "validate") return validateSource(context);
    var canvas = context.targetCanvas,
      fps = canvas.performance.frames_per_second || 24,
      maxFrames = canvas.performance.max_animation_frames || 48,
      duration = Math.min(
        canvas.performance.max_duration_seconds || 2,
        (maxFrames - 1) / fps,
      ),
      provenance = {
        hand: "rigged-animated-3d",
        hand_version: "1.0.0",
        seed: context.seed,
        source_artifact_digests: context.sourceArtifacts.map(function (item) {
          return item.digest;
        }),
      },
      sourceReceipt = null,
      clip;
    if (context.operationMode === "edit") {
      var prepared = clipSource(context);
      clip = Rig.normalizedClip(prepared.value, {
        fps: fps,
        maxFrames: maxFrames,
        name: context.brief.title,
        provenance: provenance,
      });
      sourceReceipt = {
        id: prepared.item.id,
        digest: prepared.item.digest,
        schema: CLIP_SCHEMA,
      };
    } else
      clip = Rig.makeClip({
        id: "clip-" + Core.slug(context.brief.id),
        name: context.brief.title,
        fps: fps,
        maxFrames: maxFrames,
        duration: duration,
        provenance: provenance,
      });
    var scaleFactor =
        canvas.dimensions.unit === "game-world-unit"
          ? canvas.spatial.world_scale || 1
          : 1,
      height = canvas.dimensions.height * scaleFactor,
      radius =
        (Math.min(
          canvas.dimensions.width,
          canvas.dimensions.depth || canvas.dimensions.width,
        ) *
          scaleFactor) /
        2,
      packed = Rig.pack(clip, {
        name: context.brief.title,
        height: height,
        radius: radius,
        maxTriangles: canvas.performance.max_polygon_count || 2048,
        maxVertices: canvas.performance.max_vertices || 4096,
        baseColor: colour(context.palette[1]),
      }),
      inspection = packed.inspection,
      checked = validation(
        context,
        inspection,
        packed.byteLength,
        context.operationMode,
      ),
      recipeValue = recipe(context, clip, inspection, sourceReceipt, {
        height: height,
        radius: radius,
      }),
      svg = preview(context, clip),
      slug = Core.slug(context.brief.title),
      artifacts = [
        {
          id: "rigged-animated-glb",
          role: "rigged-animated-glb",
          name: context.brief.title + " rigged animated GLB",
          filename: slug + "-rigged.glb",
          mime: "model/gltf-binary",
          format: "GLB",
          editable: false,
          dataUrl: packed.dataUrl,
          metadata: {
            schema: "glTF.2.0",
            skin: true,
            animation: true,
            triangles: packed.triangles,
            vertices: packed.vertices,
            joints: inspection.skin.joints,
            frames: inspection.animation.frames,
            fps: clip.fps,
            durationSeconds: clip.duration_seconds,
            upAxis: "y",
            handedness: "right",
          },
        },
        jsonArtifact(
          "animation-clip",
          "editable-animation-clip",
          context.brief.title + " animation clip",
          slug + "-animation-clip.json",
          clip,
          true,
        ),
        jsonArtifact(
          "rigged-animation-recipe",
          "editable-rigged-animation-recipe",
          context.brief.title + " rig recipe",
          slug + "-rig-recipe.json",
          recipeValue,
          true,
        ),
        jsonArtifact(
          "rigged-animation-validation",
          "rigged-animation-validation",
          context.brief.title + " rig validation",
          slug + "-rig-validation.json",
          checked.report,
          false,
        ),
        {
          id: "rig-skeleton-preview",
          role: "skeleton-deformation-preview",
          name: context.brief.title + " skeleton preview",
          filename: slug + "-skeleton.svg",
          mime: "image/svg+xml",
          format: "SVG",
          editable: false,
          text: svg,
          width: context.brief.canvas.width,
          height: context.brief.canvas.height,
          metadata: {
            sampleFrame: Math.floor(clip.frames.length / 4),
            meshRender: false,
          },
        },
      ],
      totalBytes =
        packed.byteLength +
        JSON.stringify(clip).length +
        JSON.stringify(recipeValue).length +
        JSON.stringify(checked.report).length +
        svg.length;
    checked.checks.find(function (check) {
      return check.name === "file-budget";
    }).pass =
      canvas.performance.max_file_bytes == null ||
      totalBytes <= canvas.performance.max_file_bytes;
    checked.report.status = checked.checks.every(function (check) {
      return check.pass;
    })
      ? "PASS"
      : "HOLD";
    artifacts.find(function (artifact) {
      return artifact.id === "rigged-animation-validation";
    }).text = JSON.stringify(checked.report, null, 2);
    return {
      artifacts: artifacts,
      previewArtifactId: "rig-skeleton-preview",
      recipe: {
        format: RECIPE_SCHEMA,
        parameters: recipeValue,
        steps: [
          { op: "fit-weighted-mesh-to-polygon-and-vertex-budgets" },
          { op: "author-three-joint-hierarchy-and-inverse-bind-matrices" },
          { op: "normalize-four-weight-vertex-influences" },
          { op: "author-quaternion-animation-channels" },
          { op: "pack-glb-2-embedded-buffer" },
          { op: "sample-cpu-skin-deformation-bounds" },
        ],
      },
      validationChecks: checked.checks,
      measures: {
        triangles: packed.triangles,
        vertices: packed.vertices,
        joints: inspection.skin.joints,
        frames: inspection.animation.frames,
        fps: clip.fps,
        durationSeconds: clip.duration_seconds,
        deformationSamples: inspection.deformation.samples.length,
        glbBytes: packed.byteLength,
        totalBytes: totalBytes,
      },
      notes: [
        "The GLB contains actual skin, joint, inverse-bind, weight and animation structures; it is not a static GLB relabelled as animated.",
        "The editable animation/clip+json source remains separate from the GLB delivery.",
        "The receipt covers AXM’s bounded rig profile and CPU deformation samples, not an external Khronos certification.",
      ],
    };
  }
  return { descriptor: descriptor, createAsync: createAsync };
});
