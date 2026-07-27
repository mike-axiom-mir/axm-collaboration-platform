(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./target-canvas")
      : root.AXMTargetCanvas,
    typeof module === "object" && module.exports
      ? require("./universal-component")
      : root.AXMUniversalComponentProtocol,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMPlayComposer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (TargetCanvas, UCP) {
  "use strict";

  if (!TargetCanvas || !UCP)
    throw new Error("AXM Play Composer requires Target Canvas and UCP");

  var VERSION = "1.0.0";
  var DRAFT_SCHEMA = "axm.play-compose-draft/v1";
  var SHAPES = ["circle", "rounded-square", "diamond", "capsule"];
  var DIRECTIONS = ["palette", "silhouette", "weight", "balance", "contrast"];
  var FIXED_TIME = "1970-01-01T00:00:00.000Z";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function clamp(value, minimum, maximum, fallback) {
    value = Number(value);
    return Number.isFinite(value)
      ? Math.min(maximum, Math.max(minimum, value))
      : fallback;
  }
  function colour(value, fallback) {
    value = String(value || "").trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(value) ? value : fallback;
  }
  function text(value, maximum, fallback) {
    value = String(value == null ? "" : value).trim();
    return (value || fallback).slice(0, maximum);
  }
  function xml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character];
    });
  }
  function normalizeSpec(input) {
    input = input || {};
    var shape = String(input.shape || "rounded-square");
    if (SHAPES.indexOf(shape) < 0) shape = "rounded-square";
    var direction = String(input.growth_direction || "palette");
    if (DIRECTIONS.indexOf(direction) < 0) direction = "palette";
    var parentDigest = /^[a-f0-9]{64}$/.test(String(input.parent_input_digest || ""))
      ? String(input.parent_input_digest)
      : null;
    return {
      title: text(input.title, 80, "Untitled component draft"),
      label: text(input.label, 16, "AXM"),
      shape: shape,
      primary: colour(input.primary, "#35e6ff"),
      secondary: colour(input.secondary, "#6f54ff"),
      background: colour(input.background, "#07101d"),
      angle: Math.round(clamp(input.angle, 0, 360, 135)),
      roundness: Number(clamp(input.roundness, 0, 1, 0.28).toFixed(3)),
      scale: Number(clamp(input.scale, 0.25, 0.92, 0.64).toFixed(3)),
      stroke: Number(clamp(input.stroke, 0, 20, 3).toFixed(2)),
      glow: Number(clamp(input.glow, 0, 24, 10).toFixed(2)),
      x: Number(clamp(input.x, 0.2, 0.8, 0.5).toFixed(3)),
      y: Number(clamp(input.y, 0.2, 0.8, 0.5).toFixed(3)),
      growth_direction: direction,
      growth_energy: Math.round(clamp(input.growth_energy, 1, 5, 2)),
      parent_input_digest: parentDigest,
      branch: Math.max(0, Math.round(clamp(input.branch, 0, 9999, 0))),
    };
  }
  function directedVariation(input, direction, energy, branch, requestedCanvas) {
    var base = normalizeSpec(input);
    direction = DIRECTIONS.indexOf(direction) >= 0 ? direction : base.growth_direction;
    energy = Math.round(clamp(energy, 1, 5, base.growth_energy));
    branch = Math.max(1, Math.round(clamp(branch, 1, 9999, base.branch + 1 || 1)));
    var canvas = TargetCanvas.normalize(requestedCanvas || defaultCanvas());
    var parentDigest = UCP.sha256({ spec: base, target_canvas: canvas });
    var seed = UCP.sha256({
      parent_input_digest: parentDigest,
      direction: direction,
      energy: energy,
      branch: branch,
    });
    function band(offset, length) {
      return parseInt(seed.slice(offset, offset + 8), 16) % length;
    }
    var next = clone(base);
    var palettes = [
      ["#35e6ff", "#6f54ff", "#07101d"],
      ["#ffb84d", "#ff4d8d", "#170b18"],
      ["#78f29a", "#22b8cf", "#071611"],
      ["#f5f7ff", "#93a4bf", "#10141c"],
      ["#ff6b4a", "#ffd166", "#171007"],
      ["#b68cff", "#ff72d2", "#120a1b"],
    ];
    if (direction === "palette" || direction === "contrast") {
      var palette = palettes[(band(0, palettes.length) + energy) % palettes.length];
      next.primary = palette[0];
      next.secondary = palette[1];
      next.background = palette[2];
      next.angle = (base.angle + 23 * energy + band(8, 97)) % 361;
      if (direction === "contrast") {
        next.stroke = Math.min(20, Math.max(2, base.stroke + energy));
        next.glow = Math.min(24, Math.max(0, base.glow - energy));
      }
    } else if (direction === "silhouette") {
      var currentShape = SHAPES.indexOf(base.shape);
      next.shape = SHAPES[(currentShape + 1 + band(0, SHAPES.length - 1)) % SHAPES.length];
      next.scale = Number(clamp(base.scale + (band(8, 2) ? 1 : -1) * energy * 0.035, 0.25, 0.92, base.scale).toFixed(3));
      next.roundness = Number(clamp(base.roundness + (band(16, 2) ? 1 : -1) * energy * 0.07, 0, 1, base.roundness).toFixed(3));
    } else if (direction === "weight") {
      next.stroke = Number(clamp(base.stroke + (band(0, 2) ? 1 : -1) * energy * 1.5, 0, 20, base.stroke).toFixed(2));
      next.glow = Number(clamp(base.glow + (band(8, 2) ? 1 : -1) * energy * 2, 0, 24, base.glow).toFixed(2));
    } else if (direction === "balance") {
      next.x = Number(clamp(base.x + (band(0, 2) ? 1 : -1) * energy * 0.025, 0.2, 0.8, base.x).toFixed(3));
      next.y = Number(clamp(base.y + (band(8, 2) ? 1 : -1) * energy * 0.025, 0.2, 0.8, base.y).toFixed(3));
      next.scale = Number(clamp(base.scale + (band(16, 2) ? 1 : -1) * energy * 0.02, 0.25, 0.92, base.scale).toFixed(3));
    }
    next.growth_direction = direction;
    next.growth_energy = energy;
    next.parent_input_digest = parentDigest;
    next.branch = branch;
    return next;
  }
  function defaultCanvas() {
    return TargetCanvas.normalize({
      medium: "ui",
      dimensions: { width: 640, height: 360, unit: "px" },
      colour: {
        space: "srgb",
        transparency: "opaque",
        minimum_contrast_ratio: 4.5,
      },
      behaviour: ["static", "responsive"],
      intended_use: "component-draft",
    });
  }
  function common(spec, canvas, inputDigest) {
    return {
      canvas_compatibility: {
        mediums: [canvas.medium],
        intended_uses: [canvas.intended_use],
        constraints: [],
      },
      artifact_refs: [],
      provenance: {
        origin_type: "human-interface",
        source_id: "play-compose:" + inputDigest.slice(0, 20),
        source_digest: inputDigest,
        license_id: "LicenseRef-User-Draft",
        created_by: "human-play-compose",
        created_at: FIXED_TIME,
      },
      resource_profile: {
        cpu: "light",
        gpu: "none",
        peak_memory_bytes: 32768,
        working_storage_bytes: 0,
        native_runtime: null,
      },
      mutability: "immutable",
    };
  }
  function sealPiece(spec, canvas, inputDigest, piece) {
    var base = common(spec, canvas, inputDigest);
    return UCP.sealComponent(
      Object.assign({}, base, piece, {
        version: "draft-" + inputDigest.slice(0, 12),
      }),
    );
  }
  function shapeMarkup(spec) {
    var width = 640 * spec.scale;
    var height = 260 * spec.scale;
    var centerX = 640 * spec.x;
    var centerY = 360 * spec.y;
    var x = centerX - width / 2;
    var y = centerY - height / 2;
    var shared =
      ' fill="url(#ucp-gradient)" stroke="rgba(255,255,255,.82)" stroke-width="' +
      spec.stroke +
      '"' +
      (spec.glow ? ' filter="url(#ucp-glow)"' : "");
    if (spec.shape === "circle") {
      var radius = Math.min(width, height) / 2;
      return (
        '<circle cx="' + centerX + '" cy="' + centerY + '" r="' + radius + '"' + shared + "/>"
      ).replace('/>"', "/>");
    }
    if (spec.shape === "diamond") {
      return (
        '<polygon points="' +
        centerX +
        "," +
        y +
        " " +
        (x + width) +
        "," +
        centerY +
        " " +
        centerX +
        "," +
        (y + height) +
        " " +
        x +
        "," +
        centerY +
        '"' +
        shared +
        "/>"
      ).replace('/>"', "/>");
    }
    if (spec.shape === "capsule") {
      return (
        '<rect x="' +
        x +
        '" y="' +
        y +
        '" width="' +
        width +
        '" height="' +
        height +
        '" rx="' +
        height / 2 +
        '"' +
        shared +
        "/>"
      ).replace('/>"', "/>");
    }
    return (
      '<rect x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      width +
      '" height="' +
      height +
      '" rx="' +
      Math.min(width, height) * spec.roundness +
      '"' +
      shared +
      "/>"
    ).replace('/>"', "/>");
  }
  function renderSvg(spec) {
    var radians = (spec.angle * Math.PI) / 180;
    var x1 = Number((50 - Math.cos(radians) * 50).toFixed(2));
    var y1 = Number((50 - Math.sin(radians) * 50).toFixed(2));
    var x2 = Number((50 + Math.cos(radians) * 50).toFixed(2));
    var y2 = Number((50 + Math.sin(radians) * 50).toFixed(2));
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360" role="img" aria-label="' +
      xml(spec.title) +
      '"><defs><linearGradient id="ucp-gradient" x1="' +
      x1 +
      '%" y1="' +
      y1 +
      '%" x2="' +
      x2 +
      '%" y2="' +
      y2 +
      '%"><stop offset="0" stop-color="' +
      spec.primary +
      '"/><stop offset="1" stop-color="' +
      spec.secondary +
      '"/></linearGradient><filter id="ucp-glow"><feGaussianBlur stdDeviation="' +
      spec.glow +
      '" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="640" height="360" fill="' +
      spec.background +
      '"/>' +
      shapeMarkup(spec) +
      '<text x="' +
      640 * spec.x +
      '" y="' +
      (360 * spec.y + 9) +
      '" fill="#ffffff" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="800" letter-spacing="3">' +
      xml(spec.label) +
      "</text></svg>"
    );
  }
  function buildDraft(input, requestedCanvas) {
    var spec = normalizeSpec(input);
    var canvas = TargetCanvas.normalize(requestedCanvas || defaultCanvas());
    var canvasValidation = TargetCanvas.validate(canvas);
    if (!canvasValidation.pass)
      throw new Error("target canvas invalid: " + canvasValidation.errors.join("; "));
    var inputDigest = UCP.sha256({ spec: spec, target_canvas: canvas });
    var palette = sealPiece(spec, canvas, inputDigest, {
      id: "axm.play.palette",
      kind: "palette",
      title: "Play Composer palette",
      ports: {
        inputs: [],
        outputs: [
          { id: "palette", type: "visual.palette", required: false, multiple: true },
        ],
      },
      capabilities: { provides: ["visual.palette"], requires: [] },
      payload: {
        primary: spec.primary,
        secondary: spec.secondary,
        background: spec.background,
        gradient_angle: spec.angle,
      },
      verification: {
        automatic_checks: ["hex-colour-and-range"],
        human_judgments: ["palette taste and emotional fit"],
        assurance_ceiling: "declared colour recipe; not appearance approval",
      },
    });
    var geometry = sealPiece(spec, canvas, inputDigest, {
      id: "axm.play.geometry",
      kind: "geometry",
      title: "Play Composer geometry",
      ports: {
        inputs: [
          { id: "palette", type: "visual.palette", required: true, multiple: false },
        ],
        outputs: [
          { id: "layer", type: "visual.layer", required: false, multiple: true },
        ],
      },
      capabilities: { provides: ["visual.geometry"], requires: [] },
      payload: {
        shape: spec.shape,
        roundness: spec.roundness,
        scale: spec.scale,
        x: spec.x,
        y: spec.y,
        stroke: spec.stroke,
        glow: spec.glow,
      },
      verification: {
        automatic_checks: ["geometry-range"],
        human_judgments: ["silhouette and balance"],
        assurance_ceiling: "geometry recipe; not legibility approval",
      },
    });
    var label = sealPiece(spec, canvas, inputDigest, {
      id: "axm.play.label",
      kind: "typography",
      title: "Play Composer label",
      ports: {
        inputs: [
          { id: "palette", type: "visual.palette", required: true, multiple: false },
        ],
        outputs: [
          { id: "layer", type: "visual.layer", required: false, multiple: true },
        ],
      },
      capabilities: { provides: ["visual.typography"], requires: [] },
      payload: { text: spec.label, placement: { x: spec.x, y: spec.y } },
      verification: {
        automatic_checks: ["text-length"],
        human_judgments: ["wording and readability"],
        assurance_ceiling: "text recipe; not accessibility approval",
      },
    });
    var composition = sealPiece(spec, canvas, inputDigest, {
      id: "axm.play.composition",
      kind: "composition",
      title: "Play Composer composition",
      ports: {
        inputs: [
          { id: "layers", type: "visual.layer", required: true, multiple: true },
        ],
        outputs: [
          { id: "draft", type: "visual.draft", required: false, multiple: true },
        ],
      },
      capabilities: { provides: ["visual.draft"], requires: [] },
      payload: {
        width: 640,
        height: 360,
        layer_order: ["geometry", "label"],
        growth: {
          direction: spec.growth_direction,
          energy: spec.growth_energy,
          parent_input_digest: spec.parent_input_digest,
          branch: spec.branch,
        },
      },
      verification: {
        automatic_checks: ["layer-binding"],
        human_judgments: ["composition, taste and usefulness"],
        assurance_ceiling: "ephemeral draft only",
      },
    });
    var components = [palette, geometry, label, composition];
    var registry = UCP.createRegistry(components);
    var graph = UCP.sealGraph({
      id: "axm.play.draft-" + inputDigest.slice(0, 16),
      title: spec.title,
      target_canvas: canvas,
      components: components.map(function (component) {
        return {
          instance_id: component.kind,
          component_id: component.id,
          component_version: component.version,
          component_digest: component.digest,
          configuration: {},
        };
      }),
      connections: [
        {
          from: { instance_id: "palette", port: "palette" },
          to: { instance_id: "geometry", port: "palette" },
          relation: "applies",
        },
        {
          from: { instance_id: "palette", port: "palette" },
          to: { instance_id: "typography", port: "palette" },
          relation: "applies",
        },
        {
          from: { instance_id: "geometry", port: "layer" },
          to: { instance_id: "composition", port: "layers" },
          relation: "contains",
        },
        {
          from: { instance_id: "typography", port: "layer" },
          to: { instance_id: "composition", port: "layers" },
          relation: "contains",
        },
      ],
      outputs: [
        {
          id: "preview-draft",
          instance_id: "composition",
          port: "draft",
          role: "ephemeral-preview-draft",
        },
      ],
    });
    var receipt = UCP.compose(graph, registry, { createdAt: FIXED_TIME });
    var svg = renderSvg(spec);
    var draft = {
      schema: DRAFT_SCHEMA,
      version: VERSION,
      input_digest: inputDigest,
      spec: spec,
      components: components,
      graph: graph,
      receipt: receipt,
      preview: {
        mime: "image/svg+xml",
        svg: svg,
        digest: UCP.sha256(svg),
        ephemeral: true,
        persisted: false,
      },
      truth: {
        deterministic: true,
        ai_required: false,
        rendered_final: false,
        visually_approved: false,
      },
    };
    draft.digest = UCP.sha256(draft);
    var validation = validateDraft(draft);
    if (!validation.pass) throw new Error(validation.errors.join("; "));
    return draft;
  }
  function validateDraft(draft) {
    var errors = [];
    if (!draft || draft.schema !== DRAFT_SCHEMA) errors.push("draft schema mismatch");
    if (!draft || draft.input_digest !== UCP.sha256({ spec: draft.spec, target_canvas: draft.graph && draft.graph.target_canvas }))
      errors.push("draft input digest mismatch");
    var components = (draft && draft.components) || [];
    components.forEach(function (component) {
      var validation = UCP.validateComponent(component);
      if (!validation.pass) errors = errors.concat(validation.errors);
    });
    try {
      var registry = UCP.createRegistry(components);
      var graphValidation = UCP.validateGraph(draft && draft.graph, registry);
      if (!graphValidation.pass) errors = errors.concat(graphValidation.errors);
    } catch (error) {
      errors.push(error.message);
    }
    var receiptValidation = UCP.validateReceipt(draft && draft.receipt, draft && draft.graph);
    if (!receiptValidation.pass) errors = errors.concat(receiptValidation.errors);
    if (!draft || !draft.preview || draft.preview.ephemeral !== true || draft.preview.persisted !== false)
      errors.push("preview must remain ephemeral until explicit incubation");
    if (!draft || !draft.preview || draft.preview.digest !== UCP.sha256(draft.preview.svg || ""))
      errors.push("preview digest mismatch");
    if (!draft || !draft.truth || draft.truth.deterministic !== true || draft.truth.ai_required !== false || draft.truth.rendered_final !== false || draft.truth.visually_approved !== false)
      errors.push("draft truth boundary missing");
    if (!draft || draft.digest !== UCP.sha256(Object.assign({}, clone(draft), { digest: undefined }))) {
      var copy = clone(draft || {});
      delete copy.digest;
      if (!draft || draft.digest !== UCP.sha256(copy)) errors.push("draft digest mismatch");
    }
    return { pass: errors.length === 0, errors: Array.from(new Set(errors)).sort() };
  }

  return {
    VERSION: VERSION,
    DRAFT_SCHEMA: DRAFT_SCHEMA,
    SHAPES: SHAPES.slice(),
    DIRECTIONS: DIRECTIONS.slice(),
    defaultCanvas: defaultCanvas,
    normalizeSpec: normalizeSpec,
    directedVariation: directedVariation,
    renderSvg: renderSvg,
    buildDraft: buildDraft,
    validateDraft: validateDraft,
  };
});
