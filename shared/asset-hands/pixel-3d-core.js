(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var api = factory(
    node ? require("./choice-first-core") : root.AXMChoiceFirstCore,
    node ? require("./pixel-3d-codec") : root.AXMPixel3DCodec
  );
  if (node) module.exports = api;
  if (root) root.AXMPixel3DCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Choice, Codec) {
  "use strict";
  if (!Choice || !Codec) throw new Error("pixel 3D core requires Choice First Core and Pixel 3D Codec");

  var VERSION = "1.0.0";
  var SCHEMAS = {
    request: "axm.pixel-3d-request/v1",
    recipe: "axm.pixel-3d-scene-recipe/v1",
    receipt: "axm.pixel-3d-validation-receipt/v1",
    profile: "axm.visual-representation-profile/v1",
    representationSet: "axm.asset-representation-set/v1",
    missing: "axm.missing-representation/v1"
  };

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function authority() { return Choice.authority(); }
  function round(value) { return Math.round(Number(value) * 1000000) / 1000000; }
  function qx(angle) { return [round(Math.sin(angle / 2)), 0, 0, round(Math.cos(angle / 2))]; }
  function qy(angle) { return [0, round(Math.sin(angle / 2)), 0, round(Math.cos(angle / 2))]; }
  function qz(angle) { return [0, 0, round(Math.sin(angle / 2)), round(Math.cos(angle / 2))]; }
  function stable(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    return "{" + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ":" + stable(value[key]); }).join(",") + "}";
  }
  function byteDigest(bytes) {
    var a = 0x811c9dc5, b = 0x9e3779b9;
    for (var index = 0; index < bytes.length; index += 1) {
      a ^= bytes[index]; a = Math.imul(a, 0x01000193) >>> 0;
      b ^= bytes[index] + ((index + 1) * 97); b = Math.imul(b, 0x85ebca6b) >>> 0;
    }
    return "axm-fnv128:" + a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  }

  var PROFILES = {
    "pixel-8bit-3d": {
      label: "Pixel 8-bit 3D art direction",
      axes: {
        medium: "pixel-styled-realtime-3d",
        projection: "perspective-world",
        detail: { geometry_language: "chunky-low-poly", radial_facets: 8, silhouette_steps: 2 },
        palette: { max_colours: 16, enforcement: "hard-limit", colour_space: "sRGB" },
        motion: { frame_rate: { numerator: 8, denominator: 1 }, interpolation: "STEP", deterministic_clips: true },
        materials: { model: "flat-palette", authored_channels: ["colour"], unlit: true },
        lighting: { model: "unlit-authored-value", dynamic: false },
        camera: { projection: "perspective", identity_anchors: true, player_controlled: true },
        target_canvas: { internal_width: 320, internal_height: 180, pixel_format: "RGBA8", nearest_upscale: true },
        budgets: { max_triangles: 1500, max_nodes: 48, max_materials: 16, max_glb_bytes: 524288 }
      },
      limits: { maximum_colours: 16, maximum_triangles: 1500, maximum_nodes: 48, maximum_glb_bytes: 524288 }
    },
    "pixel-16bit-3d": {
      label: "Pixel 16-bit 3D art direction",
      axes: {
        medium: "pixel-styled-realtime-3d",
        projection: "perspective-world",
        detail: { geometry_language: "faceted-readable-3d", radial_facets: 16, silhouette_steps: 4 },
        palette: { max_colours: 64, enforcement: "hard-limit", colour_space: "sRGB" },
        motion: { frame_rate: { numerator: 12, denominator: 1 }, interpolation: "LINEAR", deterministic_clips: true },
        materials: { model: "faceted-pbr-palette", authored_channels: ["colour", "roughness", "metallic"], unlit: false },
        lighting: { model: "realtime-key-fill", dynamic: true },
        camera: { projection: "perspective", identity_anchors: true, player_controlled: true },
        target_canvas: { internal_width: 640, internal_height: 360, pixel_format: "RGBA8", nearest_upscale: true },
        budgets: { max_triangles: 6000, max_nodes: 96, max_materials: 64, max_glb_bytes: 1048576 }
      },
      limits: { maximum_colours: 64, maximum_triangles: 6000, maximum_nodes: 96, maximum_glb_bytes: 1048576 }
    }
  };

  function missing(request, items, gapTypes, unblock) {
    return {
      schema: SCHEMAS.missing,
      version: "1.0.0",
      status: "MISSING_REPRESENTATION",
      request: clone(request || {}),
      missing: items.slice(),
      gap_types: gapTypes.slice(),
      fallback_used: false,
      nearest_substitute_used: false,
      unblock_conditions: unblock.slice(),
      authority: authority()
    };
  }

  function profileDocument(id) {
    var preset = PROFILES[id];
    return {
      schema: SCHEMAS.profile,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: id,
      label: preset.label,
      installed: true,
      preset: true,
      axes: clone(preset.axes),
      limits: clone(preset.limits),
      provenance: {
        resolver: "AXMPixel3DCore",
        resolver_version: VERSION,
        semantic_note: "8-bit and 16-bit name visual art directions, not literal GPU colour depth.",
        source_geometry: "deterministic AXM primitives"
      },
      authority: authority()
    };
  }

  function resolveProfile(raw) {
    var request = typeof raw === "string" ? { profile_id: raw } : clone(raw || {});
    var id = String(request.profile_id || request.id || "");
    if (!PROFILES[id]) return missing(request, ["profile:" + (id || "unspecified")], ["HAND", "CONTRACT", "EVIDENCE"], ["Implement the exact requested 3D representation; no nearest-profile fallback is permitted."]);
    return { status: "READY", fallback_used: false, nearest_substitute_used: false, profile: profileDocument(id) };
  }

  function material(id, colour, profile, options) {
    options = options || {};
    return {
      id: id,
      role: options.role || id,
      colour: colour,
      unlit: profile.axes.materials.unlit,
      roughness: options.roughness == null ? 0.82 : options.roughness,
      metallic: options.metallic == null ? 0 : options.metallic,
      double_sided: options.double_sided === true
    };
  }

  function node(id, component, parent, primitive, materialId, translation, rotation, scale) {
    return {
      id: id,
      component_id: component,
      parent_id: parent == null ? null : parent,
      primitive: primitive || null,
      material_id: materialId || null,
      translation: translation || [0, 0, 0],
      rotation: rotation || [0, 0, 0, 1],
      scale: scale || [1, 1, 1]
    };
  }

  function animation(id, name, duration, profile, channels) {
    return {
      id: id,
      name: name,
      duration_seconds: duration,
      loop: true,
      channels: channels.map(function (channel) {
        return { node_id: channel.node_id, path: channel.path, interpolation: profile.axes.motion.interpolation, keys: channel.keys };
      })
    };
  }

  function ferris(profile, identity, state) {
    var detail = profile.axes.detail.radial_facets;
    var richer = profile.id === "pixel-16bit-3d";
    var materials = [
      material("steel-blue", "#277DA1", profile, { roughness: 0.62, metallic: richer ? 0.18 : 0 }),
      material("wheel-gold", "#F9C74F", profile, { roughness: 0.7 }),
      material("cabin-red", "#F94144", profile),
      material("cabin-green", "#43AA8B", profile),
      material("base-dark", "#223047", profile),
      material("lamp", richer ? "#FDF1A7" : "#F9844A", profile)
    ];
    var nodes = [
      node("ferris-root", "base", null),
      node("base-platform", "base", "ferris-root", { type: "cube", detail: 4 }, "base-dark", [0, 0.22, 0], [0, 0, 0, 1], [3.7, 0.22, 1.65]),
      node("support-a", "support-a", "ferris-root", { type: "cube", detail: 4 }, "steel-blue", [-1.65, 2.55, 0], qz(-0.34), [0.24, 2.8, 0.24]),
      node("support-b", "support-b", "ferris-root", { type: "cube", detail: 4 }, "steel-blue", [1.65, 2.55, 0], qz(0.34), [0.24, 2.8, 0.24]),
      node("wheel-axis", "wheel", "ferris-root", null, null, [0, 5.15, 0]),
      node("wheel-ring", "wheel", "wheel-axis", { type: "torus", detail: detail, minor_radius: 0.06 }, "wheel-gold", [0, 0, 0], qx(Math.PI / 2), [4.15, 4.15, 4.15]),
      node("drive-hub", "drive", "wheel-axis", { type: "cylinder", detail: detail }, "steel-blue", [0, 0, 0], qx(Math.PI / 2), [0.48, 0.42, 0.48]),
      node("control-box", "control-box", "ferris-root", { type: "cube", detail: 4 }, "cabin-red", [2.8, 0.85, 0.75], [0, 0, 0, 1], [0.45, 0.65, 0.38])
    ];
    var count = richer ? 12 : 8;
    for (var index = 0; index < count; index += 1) {
      var angle = index / count * Math.PI * 2;
      nodes.push(node("spoke-" + index, "wheel", "wheel-axis", { type: "cube", detail: 4 }, "steel-blue", [Math.cos(angle) * 1.48, Math.sin(angle) * 1.48, 0], qz(angle), [1.55, 0.055, 0.055]));
      nodes.push(node("gondola-" + index, "gondolas", "wheel-axis", { type: "cube", detail: 4 }, index % 2 ? "cabin-green" : "cabin-red", [Math.cos(angle) * 3.25, Math.sin(angle) * 3.25, 0], [0, 0, 0, 1], [0.38, 0.32, 0.52]));
      if (richer) nodes.push(node("lamp-" + index, "wheel", "wheel-axis", { type: "sphere", detail: 8 }, "lamp", [Math.cos(angle) * 2.73, Math.sin(angle) * 2.73, 0.22], [0, 0, 0, 1], [0.08, 0.08, 0.08]));
    }
    var steps = richer ? 8 : 4, keys = [];
    for (var k = 0; k <= steps; k += 1) keys.push({ time: round(k * 8 / steps), value: qz(k * Math.PI * 2 / steps) });
    return { materials: materials, nodes: nodes, animations: [animation("wheel-motion", state, 8, profile, [{ node_id: "wheel-axis", path: "rotation", keys: keys }])] };
  }

  function carousel(profile, identity, state) {
    var detail = profile.axes.detail.radial_facets, richer = profile.id === "pixel-16bit-3d";
    var materials = [
      material("horse-cream", "#F8E3C5", profile), material("mane", "#7A4E32", profile),
      material("saddle", "#E76F51", profile), material("pole", "#F9C74F", profile, { metallic: richer ? 0.2 : 0 }),
      material("hoof", "#283845", profile), material("accent", "#90BE6D", profile)
    ];
    var nodes = [
      node("horse-root", "base-connector", null, null, null, [0, 0.12, 0]),
      node("pole", "pole", "horse-root", { type: "cylinder", detail: detail }, "pole", [0, 1.05, 0], [0, 0, 0, 1], [0.055, 1.05, 0.055]),
      node("body", "mount", "horse-root", { type: "sphere", detail: detail }, "horse-cream", [0, 1.03, 0], qz(Math.PI / 2), [0.48, 0.82, 0.34]),
      node("neck", "mount", "horse-root", { type: "cube", detail: 4 }, "horse-cream", [0.54, 1.36, 0], qz(-0.42), [0.18, 0.48, 0.22]),
      node("head", "mount", "horse-root", { type: "sphere", detail: detail }, "horse-cream", [0.78, 1.63, 0], qz(Math.PI / 2), [0.25, 0.38, 0.23]),
      node("muzzle", "mount", "horse-root", { type: "cube", detail: 4 }, "horse-cream", [1.02, 1.55, 0], [0, 0, 0, 1], [0.24, 0.14, 0.18]),
      node("mane", "mount", "horse-root", { type: "cube", detail: 4 }, "mane", [0.49, 1.56, 0], qz(-0.42), [0.08, 0.38, 0.25]),
      node("saddle", "saddle", "horse-root", { type: "cube", detail: 4 }, "saddle", [-0.08, 1.35, 0], [0, 0, 0, 1], [0.33, 0.11, 0.39]),
      node("leg-front", "mount", "horse-root", { type: "cube", detail: 4 }, "horse-cream", [0.38, 0.62, 0.16], qz(-0.22), [0.12, 0.48, 0.12]),
      node("leg-back", "mount", "horse-root", { type: "cube", detail: 4 }, "horse-cream", [-0.38, 0.62, -0.16], qz(0.22), [0.12, 0.48, 0.12]),
      node("hoof-front", "mount", "horse-root", { type: "cube", detail: 4 }, "hoof", [0.48, 0.18, 0.16], [0, 0, 0, 1], [0.17, 0.1, 0.14]),
      node("hoof-back", "mount", "horse-root", { type: "cube", detail: 4 }, "hoof", [-0.48, 0.18, -0.16], [0, 0, 0, 1], [0.17, 0.1, 0.14])
    ];
    if (richer) {
      nodes.push(node("tail", "mount", "horse-root", { type: "cone", detail: detail }, "mane", [-0.74, 1.1, 0], qz(-Math.PI / 2), [0.12, 0.42, 0.12]));
      nodes.push(node("saddle-trim", "saddle", "horse-root", { type: "cube", detail: 4 }, "accent", [-0.08, 1.42, 0], [0, 0, 0, 1], [0.24, 0.035, 0.41]));
    }
    var keys = richer ? [
      { time: 0, value: [0, 0.12, 0] }, { time: 0.5, value: [0, 0.33, 0] }, { time: 1, value: [0, 0.12, 0] }, { time: 1.5, value: [0, -0.09, 0] }, { time: 2, value: [0, 0.12, 0] }
    ] : [
      { time: 0, value: [0, 0.12, 0] }, { time: 1, value: [0, 0.32, 0] }, { time: 2, value: [0, 0.12, 0] }, { time: 3, value: [0, -0.08, 0] }, { time: 4, value: [0, 0.12, 0] }
    ];
    return { materials: materials, nodes: nodes, animations: [animation("horse-bob", state, richer ? 2 : 4, profile, [{ node_id: "horse-root", path: "translation", keys: keys }])] };
  }

  function ticketGate(profile, identity, state) {
    var detail = profile.axes.detail.radial_facets, richer = profile.id === "pixel-16bit-3d";
    var materials = [
      material("post", "#277DA1", profile, { metallic: richer ? 0.15 : 0 }), material("barrier", "#F94144", profile),
      material("scanner", "#18293B", profile), material("go-light", "#43AA8B", profile), material("trim", "#F9C74F", profile)
    ];
    var nodes = [
      node("gate-root", "entrance-post", null),
      node("entrance-post", "entrance-post", "gate-root", { type: "cube", detail: 4 }, "post", [-0.62, 0.7, 0], [0, 0, 0, 1], [0.22, 0.7, 0.3]),
      node("exit-post", "exit-post", "gate-root", { type: "cube", detail: 4 }, "post", [0.62, 0.7, 0], [0, 0, 0, 1], [0.22, 0.7, 0.3]),
      node("scanner", "scanner", "gate-root", { type: "cube", detail: 4 }, "scanner", [-0.62, 1.42, 0], [0, 0, 0, 1], [0.28, 0.12, 0.35]),
      node("status-light", "status-light", "gate-root", { type: "sphere", detail: detail }, "go-light", [-0.62, 1.62, 0], [0, 0, 0, 1], [0.11, 0.11, 0.11]),
      node("barrier-hinge", "barrier", "gate-root", null, null, [-0.39, 1.02, 0]),
      node("barrier-arm", "barrier", "barrier-hinge", { type: "cube", detail: 4 }, "barrier", [0.5, 0, 0], [0, 0, 0, 1], [0.5, 0.075, 0.075])
    ];
    if (richer) {
      nodes.push(node("scanner-ring", "scanner", "gate-root", { type: "torus", detail: detail, minor_radius: 0.08 }, "trim", [-0.62, 1.55, -0.36], qx(Math.PI / 2), [0.14, 0.14, 0.14]));
      nodes.push(node("base-trim", "entrance-post", "gate-root", { type: "cube", detail: 4 }, "trim", [0, 0.08, 0], [0, 0, 0, 1], [0.9, 0.08, 0.4]));
    }
    var keys = [
      { time: 0, value: qy(0) }, { time: 0.8, value: qy(-Math.PI / 2) },
      { time: 1.8, value: qy(-Math.PI / 2) }, { time: 2.6, value: qy(0) }, { time: 3.2, value: qy(0) }
    ];
    return { materials: materials, nodes: nodes, animations: [animation("barrier-cycle", state, 3.2, profile, [{ node_id: "barrier-hinge", path: "rotation", keys: keys }])] };
  }

  function sofa(profile, identity, state) {
    var richer = profile.id === "pixel-16bit-3d";
    var materials = [
      material("fabric", richer ? "#9876C6" : "#6D597A", profile), material("fabric-shadow", richer ? "#77559B" : "#4D3A59", profile),
      material("wood", "#8B5E3C", profile), material("stitch", "#F9C74F", profile)
    ];
    var nodes = [
      node("sofa-root", "frame", null),
      node("frame-base", "frame", "sofa-root", { type: "cube", detail: 4 }, "fabric-shadow", [0, 0.35, 0], [0, 0, 0, 1], [1.05, 0.2, 0.42]),
      node("back", "frame", "sofa-root", { type: "cube", detail: 4 }, "fabric", [0, 0.75, -0.35], qx(-0.12), [1.05, 0.46, 0.13]),
      node("arm-left", "frame", "sofa-root", { type: "cube", detail: 4 }, "fabric", [-0.96, 0.62, 0], [0, 0, 0, 1], [0.14, 0.34, 0.44]),
      node("arm-right", "frame", "sofa-root", { type: "cube", detail: 4 }, "fabric", [0.96, 0.62, 0], [0, 0, 0, 1], [0.14, 0.34, 0.44]),
      node("seat-left", "cushions", "sofa-root", { type: "cube", detail: 4 }, "fabric", [-0.46, 0.58, 0.06], [0, 0, 0, 1], [0.44, 0.15, 0.36]),
      node("seat-right", "cushions", "sofa-root", { type: "cube", detail: 4 }, "fabric", [0.46, 0.58, 0.06], [0, 0, 0, 1], [0.44, 0.15, 0.36]),
      node("leg-a", "legs", "sofa-root", { type: "cube", detail: 4 }, "wood", [-0.78, 0.1, 0.28], [0, 0, 0, 1], [0.08, 0.12, 0.08]),
      node("leg-b", "legs", "sofa-root", { type: "cube", detail: 4 }, "wood", [0.78, 0.1, 0.28], [0, 0, 0, 1], [0.08, 0.12, 0.08]),
      node("leg-c", "legs", "sofa-root", { type: "cube", detail: 4 }, "wood", [-0.78, 0.1, -0.28], [0, 0, 0, 1], [0.08, 0.12, 0.08]),
      node("leg-d", "legs", "sofa-root", { type: "cube", detail: 4 }, "wood", [0.78, 0.1, -0.28], [0, 0, 0, 1], [0.08, 0.12, 0.08])
    ];
    if (richer) {
      nodes.push(node("back-left", "cushions", "sofa-root", { type: "cube", detail: 4 }, "fabric", [-0.47, 0.87, -0.2], qx(-0.12), [0.43, 0.3, 0.12]));
      nodes.push(node("back-right", "cushions", "sofa-root", { type: "cube", detail: 4 }, "fabric", [0.47, 0.87, -0.2], qx(-0.12), [0.43, 0.3, 0.12]));
      nodes.push(node("stitch-left", "upholstery", "sofa-root", { type: "cube", detail: 4 }, "stitch", [-0.46, 0.735, 0.06], [0, 0, 0, 1], [0.36, 0.012, 0.28]));
      nodes.push(node("stitch-right", "upholstery", "sofa-root", { type: "cube", detail: 4 }, "stitch", [0.46, 0.735, 0.06], [0, 0, 0, 1], [0.36, 0.012, 0.28]));
    }
    var keys = [{ time: 0, value: [0.44, 0.15, 0.36] }, { time: 0.7, value: [0.449, 0.135, 0.367] }, { time: 1.4, value: [0.44, 0.15, 0.36] }];
    return { materials: materials, nodes: nodes, animations: [animation("cushion-response", state, 1.4, profile, [{ node_id: "seat-left", path: "scale", keys: keys }, { node_id: "seat-right", path: "scale", keys: keys }])] };
  }

  var BUILDERS = {
    "axm.park.ferris-wheel": ferris,
    "axm.park.carousel-horse": carousel,
    "axm.park.ticket-gate": ticketGate,
    "axm.home.starter-sofa": sofa
  };

  function createScene(identityId, profileId, animationState) {
    if (!BUILDERS[identityId]) return missing({ identity_id: identityId, profile_id: profileId }, ["identity-builder:" + identityId], ["HAND"], ["Implement a deterministic identity-bound scene builder."]);
    var resolved = resolveProfile(profileId);
    if (resolved.status !== "READY") return resolved;
    var identity = Choice.getIdentity(identityId), profile = resolved.profile;
    var state = String(animationState || (identityId === "axm.park.ticket-gate" ? "open" : identityId === "axm.home.starter-sofa" ? "sit" : "running"));
    var built = BUILDERS[identityId](profile, identity, state);
    var scene = {
      schema: SCHEMAS.recipe,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: identityId.replace(/^axm\./, "").replace(/\./g, "-") + "-" + profile.id + "-scene",
      identity_id: identity.id,
      representation_profile_id: profile.id,
      animation_state: state,
      footprint: clone(identity.footprint),
      pivots: clone(identity.pivots),
      sockets: clone(identity.sockets),
      materials: built.materials,
      nodes: built.nodes,
      animations: built.animations,
      budgets: clone(profile.axes.budgets),
      game_adapter: {
        format: "glTF.2.0/GLB",
        coordinate_system: "right-handed-y-up",
        unit: "world-unit",
        animation_clips: built.animations.map(function (clip) { return clip.name; }),
        identity_extras: true,
        integration_boundary: "Engine-neutral candidate GLB; collision, physics and gameplay adapters remain caller-owned."
      },
      invariants: identity.invariants.concat([
        "8-bit-and-16-bit-are-art-directions-not-hardware-bit-depth",
        "animation-is-driven-by-semantic-state-not-visual-profile",
        "profile-resolution-never-falls-back-silently"
      ]),
      provenance: {
        generated_by: "AXMPixel3DCore",
        version: VERSION,
        identity_digest: Choice.digest(identity),
        profile_digest: Choice.digest(profile),
        originality_boundary: "Original deterministic primitive construction; no copied mesh, texture, map, sound, or layout."
      },
      authority: authority()
    };
    return { status: "READY", fallback_used: false, nearest_substitute_used: false, identity: identity, profile: profile, scene: scene };
  }

  function check(id, pass, detail) { return { id: id, pass: !!pass, detail: detail }; }
  function buildPackage(request) {
    request = clone(request || {});
    if (request.schema && request.schema !== SCHEMAS.request) return missing(request, ["request-schema:" + request.schema], ["CONTRACT"], ["Use " + SCHEMAS.request + "."]);
    var result = createScene(request.identity_id, request.profile_id, request.animation_state);
    if (result.status !== "READY") return result;
    var first = Codec.pack(result.scene), second = Codec.pack(result.scene), inspection = Codec.inspect(first.bytes);
    var same = first.bytes.length === second.bytes.length;
    for (var index = 0; same && index < first.bytes.length; index += 1) if (first.bytes[index] !== second.bytes[index]) same = false;
    var limits = result.scene.budgets;
    var checks = [
      check("glb-structural-validation", inspection.pass, inspection.errors),
      check("identity-extras-exact", inspection.identity_id === result.identity.id, inspection.identity_id),
      check("profile-extras-exact", inspection.representation_profile_id === result.profile.id, inspection.representation_profile_id),
      check("footprint-preserved", stable(inspection.json.extras.axm.footprint) === stable(result.identity.footprint), result.identity.footprint),
      check("pivots-preserved", stable(inspection.json.extras.axm.pivots) === stable(result.identity.pivots), result.identity.pivots.length),
      check("sockets-preserved", stable(inspection.json.extras.axm.sockets) === stable(result.identity.sockets), result.identity.sockets.length),
      check("animated-node-hierarchy", inspection.animations > 0 && inspection.nodes > 1, { animations: inspection.animations, nodes: inspection.nodes }),
      check("palette-budget", inspection.palette_colours <= result.profile.axes.palette.max_colours, inspection.palette_colours),
      check("triangle-budget", inspection.triangles <= limits.max_triangles, inspection.triangles),
      check("node-budget", inspection.nodes <= limits.max_nodes, inspection.nodes),
      check("material-budget", inspection.materials <= limits.max_materials, inspection.materials),
      check("file-budget", first.bytes.length <= limits.max_glb_bytes, first.bytes.length),
      check("byte-determinism", same, byteDigest(first.bytes)),
      check("no-silent-fallback", result.fallback_used === false && result.nearest_substitute_used === false, result.profile.id)
    ];
    var recipeDigest = "axm-stable:" + Choice.digest(result.scene), glbDigest = byteDigest(first.bytes);
    var receipt = {
      schema: SCHEMAS.receipt,
      version: "1.0.0",
      status: checks.every(function (item) { return item.pass; }) ? "PASS" : "FAIL",
      identity_id: result.identity.id,
      representation_profile_id: result.profile.id,
      recipe_digest: recipeDigest,
      glb_digest: glbDigest,
      outputs: [
        { id: "scene-glb", mime: "model/gltf-binary", format: "GLB", bytes: first.bytes.length, digest: glbDigest },
        { id: "scene-recipe", mime: "application/json", format: "JSON", digest: recipeDigest }
      ],
      checks: checks,
      measures: { triangles: inspection.triangles, vertices: inspection.vertices, nodes: inspection.nodes, meshes: inspection.meshes, materials: inspection.materials, palette_colours: inspection.palette_colours, animations: inspection.animations, animation_keys: result.scene.animations.reduce(function (maximum, clip) { return Math.max(maximum, clip.channels.reduce(function (channelMaximum, channel) { return Math.max(channelMaximum, channel.keys.length); }, 0)); }, 0), glb_bytes: first.bytes.length },
      limits: clone(limits),
      known_losses: [
        "Stylized primitive geometry is a pilot, not final art.",
        "No high-resolution textures or cinematic material channels are authored.",
        "Collision meshes, physics properties and engine-specific import settings are not included.",
        "Individual asset availability does not make the whole-game walkable-3D visual pack available."
      ],
      authority: authority()
    };
    var representationSet = {
      schema: SCHEMAS.representationSet,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: result.identity.id + ".pixel-3d-representations",
      identity_id: result.identity.id,
      representations: [{
        profile_id: result.profile.id,
        recipe_id: result.scene.id,
        artifacts: [
          { role: "runtime-model", mime: "model/gltf-binary", format: "GLB", digest: glbDigest },
          { role: "editable-recipe", mime: "application/json", format: "JSON", digest: recipeDigest }
        ],
        digest: glbDigest,
        availability: receipt.status === "PASS" ? "AVAILABLE" : "MISSING_REPRESENTATION",
        animation_state: result.scene.animation_state
      }],
      semantic_coverage: result.identity.semantic_actions.slice(),
      compatibility: { footprint_preserved: true, pivots_preserved: true, sockets_preserved: true, simulation_state_shared: true },
      provenance: { builder: "AXMPixel3DCore", version: VERSION, recipe_digest: recipeDigest },
      authority: authority()
    };
    return {
      status: receipt.status === "PASS" ? "READY" : "VALIDATION_FAILED",
      fallback_used: false,
      nearest_substitute_used: false,
      identity: result.identity,
      profile: result.profile,
      scene: result.scene,
      glb: first,
      representation_set: representationSet,
      receipt: receipt
    };
  }

  function listChoices() {
    return Object.keys(PROFILES).map(function (id) { return { id: id, label: PROFILES[id].label, installed: true, medium: PROFILES[id].axes.medium }; }).concat([
      { id: "realtime-3d-high-detail", label: "High-detail realtime 3D", installed: false, missing: ["high-detail model hand", "texture/material pipeline", "performance evidence", "human review"] },
      { id: "cinematic-render", label: "Cinematic render", installed: false, missing: ["cinematic asset hand", "render substrate", "camera/lighting contract", "human review"] }
    ]);
  }

  return {
    VERSION: VERSION,
    SCHEMAS: SCHEMAS,
    PROFILES: clone(PROFILES),
    listChoices: listChoices,
    resolveProfile: resolveProfile,
    createScene: createScene,
    buildPackage: buildPackage,
    byteDigest: byteDigest
  };
});
