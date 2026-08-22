(function (root, factory) {
  var provider = factory(typeof module === "object" && module.exports ? require("../asset-hand-core") : root.AXMAssetHandCore);
  if (typeof module === "object" && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register) root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var RECIPE_SCHEMA = "axm.ui-component-recipe/v1";
  var SPEC_SCHEMA = "axm.ui-component-spec/v1";
  var KINDS = ["panel", "button", "hud", "ui-component"];
  var MEDIUMS = ["ui", "screen", "game-world"];
  var TRANSPARENCY = ["required", "allowed", "opaque"];
  var DIRECTIONS = ["ltr", "rtl", "auto"];
  var MODALITIES = ["pointer", "keyboard", "touch", "gamepad"];
  var STATES = ["default", "hover", "active", "disabled"];

  function plain(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function exactKeys(value, expected) {
    if (!plain(value)) return false;
    var actual = Object.keys(value).sort();
    expected = expected.slice().sort();
    return actual.length === expected.length && actual.every(function (key, index) { return key === expected[index]; });
  }

  function finite(value, minimum, maximum) {
    return Number.isFinite(value) && value >= minimum && value <= maximum;
  }

  function hex(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function uniqueAllowed(values, allowed) {
    if (!Array.isArray(values)) return false;
    var seen = {};
    return values.every(function (value) {
      if (allowed.indexOf(value) < 0 || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validateRecipe(recipe, targetCanvas, operationMode) {
    if (!exactKeys(recipe, ["schema", "version", "id", "title", "kind", "seed", "authority", "target", "palette", "geometry", "states", "provenance"]))
      throw new Error("UI recipe fields do not match the bounded v1 contract");
    if (recipe.schema !== RECIPE_SCHEMA || recipe.version !== "1.0.0" || recipe.authority !== "candidate-only")
      throw new Error("UI recipe schema, version or authority is invalid");
    if (typeof recipe.id !== "string" || !recipe.id.trim() || recipe.id.length > 100 || typeof recipe.title !== "string" || !recipe.title.trim() || recipe.title.length > 120)
      throw new Error("UI recipe id/title is invalid");
    if (KINDS.indexOf(recipe.kind) < 0 || typeof recipe.seed !== "string" || !recipe.seed || recipe.seed.length > 180)
      throw new Error("UI recipe kind/seed is invalid");
    if (!exactKeys(recipe.target, ["medium", "dimensions", "transparency", "minimum_contrast_ratio", "direction", "input_modalities", "reduced_motion", "minimum_target_size", "alternative_text", "focus_visible", "focus_ring"]))
      throw new Error("UI recipe target fields are invalid");
    if (MEDIUMS.indexOf(recipe.target.medium) < 0 || TRANSPARENCY.indexOf(recipe.target.transparency) < 0 || DIRECTIONS.indexOf(recipe.target.direction) < 0)
      throw new Error("UI recipe target enum is invalid");
    if (!exactKeys(recipe.target.dimensions, ["width", "height", "unit"]) || recipe.target.dimensions.unit !== "px" || !finite(recipe.target.dimensions.width, 1, 8192) || !finite(recipe.target.dimensions.height, 1, 8192))
      throw new Error("UI recipe dimensions must be 1..8192 px");
    if (!finite(recipe.target.minimum_contrast_ratio, 1, 21) || !finite(recipe.target.minimum_target_size, 1, 1000) || !uniqueAllowed(recipe.target.input_modalities, MODALITIES))
      throw new Error("UI recipe accessibility/input target is invalid");
    if (typeof recipe.target.reduced_motion !== "boolean" || typeof recipe.target.alternative_text !== "boolean" || typeof recipe.target.focus_visible !== "boolean")
      throw new Error("UI recipe target booleans are invalid");
    if (!exactKeys(recipe.target.focus_ring, ["colour", "width"]) || !hex(recipe.target.focus_ring.colour) || !finite(recipe.target.focus_ring.width, 1, 16))
      throw new Error("UI recipe focus ring is invalid");
    if (!exactKeys(recipe.palette, ["surface", "accent", "foreground", "attention"]) || !Object.keys(recipe.palette).every(function (key) { return hex(recipe.palette[key]); }))
      throw new Error("UI recipe palette is invalid");
    if (!exactKeys(recipe.geometry, ["inset", "radius", "nine_slice"]) || !finite(recipe.geometry.inset, 0, 8192) || !finite(recipe.geometry.radius, 0, Math.min(recipe.target.dimensions.width, recipe.target.dimensions.height) / 2))
      throw new Error("UI recipe geometry is invalid");
    if (recipe.geometry.inset * 2 >= recipe.target.dimensions.width || recipe.geometry.inset * 2 >= recipe.target.dimensions.height)
      throw new Error("UI recipe inset must leave positive inner dimensions");
    if (!exactKeys(recipe.geometry.nine_slice, ["left", "top", "right", "bottom"]) || !Object.keys(recipe.geometry.nine_slice).every(function (key) { return finite(recipe.geometry.nine_slice[key], 0, 8192); }))
      throw new Error("UI recipe nine-slice fields are invalid");
    if (recipe.geometry.nine_slice.left + recipe.geometry.nine_slice.right >= recipe.target.dimensions.width || recipe.geometry.nine_slice.top + recipe.geometry.nine_slice.bottom >= recipe.target.dimensions.height)
      throw new Error("UI recipe nine-slice opposing edges must leave positive centre dimensions");
    if (!exactKeys(recipe.states, STATES)) throw new Error("UI recipe must define exactly four states");
    STATES.forEach(function (state) {
      var value = recipe.states[state];
      if (!exactKeys(value, ["opacity", "scale"]) || !finite(value.opacity, 0, 1) || !finite(value.scale, 0.85, 1.15))
        throw new Error("UI recipe state is invalid: " + state);
      if (recipe.target.reduced_motion && value.scale !== 1)
        throw new Error("reduced-motion UI recipes require scale=1 for every state");
    });
    if (operationMode === "create" && recipe.provenance !== null)
      throw new Error("create recipe provenance must be null");
    if (operationMode === "edit" && (!exactKeys(recipe.provenance, ["operation", "source_artifact_id", "source_recipe_digest"]) || recipe.provenance.operation !== "edit" || recipe.provenance.source_artifact_id !== "ui-recipe" || typeof recipe.provenance.source_recipe_digest !== "string" || !recipe.provenance.source_recipe_digest))
      throw new Error("edit recipe provenance is invalid");
    var canvas = targetCanvas || {};
    var dimensions = canvas.dimensions || {};
    var responsive = canvas.responsive || {};
    var accessibility = canvas.accessibility || {};
    var colour = canvas.colour || {};
    if (recipe.target.medium !== canvas.medium || recipe.target.dimensions.width !== dimensions.width || recipe.target.dimensions.height !== dimensions.height || recipe.target.dimensions.unit !== dimensions.unit)
      throw new Error("UI recipe dimensions/medium must equal target_canvas");
    var canvasContrast = colour.minimum_contrast_ratio == null ? 4.5 : colour.minimum_contrast_ratio;
    var canvasMinimumTarget = responsive.minimum_target_size == null ? 44 : responsive.minimum_target_size;
    if (recipe.target.transparency !== colour.transparency || recipe.target.minimum_contrast_ratio !== canvasContrast || recipe.target.direction !== responsive.direction || JSON.stringify(recipe.target.input_modalities) !== JSON.stringify(responsive.input_modalities) || recipe.target.reduced_motion !== responsive.reduced_motion || recipe.target.minimum_target_size !== canvasMinimumTarget || recipe.target.alternative_text !== accessibility.alternative_text || recipe.target.focus_visible !== accessibility.focus_visible)
      throw new Error("UI recipe target settings must equal target_canvas");
    return recipe;
  }

  function parseEditRecipe(context) {
    if (context.operationMode !== "edit") return null;
    if (!Array.isArray(context.sourceArtifacts) || context.sourceArtifacts.length !== 1)
      throw new Error("UI edit requires exactly one ui-recipe source artifact");
    var source = context.sourceArtifacts[0];
    if (source.id !== "ui-recipe" || source.mime !== "application/json" || source.format !== "JSON" || source.content_schema !== RECIPE_SCHEMA || !source.metadata || source.metadata.schema !== RECIPE_SCHEMA || source.editable !== true || typeof source.text !== "string")
      throw new Error("UI edit source must be the editable axm.ui-component-recipe/v1 artifact");
    var parsed;
    try { parsed = JSON.parse(source.text); }
    catch (_error) { throw new Error("UI recipe source is not valid JSON"); }
    parsed.provenance = { operation: "edit", source_artifact_id: "ui-recipe", source_recipe_digest: source.digest };
    return validateRecipe(parsed, context.targetCanvas, "edit");
  }

  function defaultRecipe(context) {
    var canvas = context.targetCanvas;
    var width = canvas.dimensions.width;
    var height = canvas.dimensions.height;
    var unit = Math.min(width, height);
    var inset = Math.min(Math.max(0, Math.round(unit * 0.075)), Math.max(0, (unit - 0.01) / 2));
    var radius = Math.min(Math.max(0, Math.round(unit * 0.08)), unit / 2);
    var sliceX = Math.min(inset * 2, Math.max(0, (width - 0.01) / 2));
    var sliceY = Math.min(inset * 2, Math.max(0, (height - 0.01) / 2));
    var line = Math.min(16, Math.max(1, Math.round(unit * 0.036)));
    var activeScale = canvas.responsive.reduced_motion ? 1 : 0.98;
    var recipe = {
      schema: RECIPE_SCHEMA,
      version: "1.0.0",
      id: context.brief.id,
      title: context.brief.title,
      kind: KINDS.indexOf(context.brief.kind) >= 0 ? context.brief.kind : "ui-component",
      seed: context.seed,
      authority: "candidate-only",
      target: {
        medium: canvas.medium,
        dimensions: { width: width, height: height, unit: canvas.dimensions.unit },
        transparency: canvas.colour.transparency,
        minimum_contrast_ratio: canvas.colour.minimum_contrast_ratio == null ? 4.5 : canvas.colour.minimum_contrast_ratio,
        direction: canvas.responsive.direction,
        input_modalities: canvas.responsive.input_modalities.slice(),
        reduced_motion: canvas.responsive.reduced_motion,
        minimum_target_size: canvas.responsive.minimum_target_size == null ? 44 : canvas.responsive.minimum_target_size,
        alternative_text: canvas.accessibility.alternative_text,
        focus_visible: canvas.accessibility.focus_visible,
        focus_ring: { colour: context.palette[3], width: line },
      },
      palette: { surface: context.palette[0], accent: context.palette[1], foreground: context.palette[2], attention: context.palette[3] },
      geometry: { inset: inset, radius: radius, nine_slice: { left: sliceX, top: sliceY, right: sliceX, bottom: sliceY } },
      states: {
        default: { opacity: 1, scale: 1 },
        hover: { opacity: 1, scale: 1 },
        active: { opacity: 0.92, scale: activeScale },
        disabled: { opacity: 0.45, scale: 1 },
      },
      provenance: null,
    };
    return validateRecipe(recipe, canvas, "create");
  }

  function buildSvg(context, recipe, effective) {
    var width = recipe.target.dimensions.width;
    var height = recipe.target.dimensions.height;
    var inset = recipe.geometry.inset;
    var radius = recipe.geometry.radius;
    var innerWidth = width - inset * 2;
    var innerHeight = height - inset * 2;
    var line = Math.max(0.25, Math.min(recipe.target.focus_ring.width / 2, Math.min(width, height) / 8));
    var body = "";
    if (recipe.target.transparency === "opaque") body += '<rect width="100%" height="100%" fill="' + effective.surface + '"/>';
    body += '<defs><linearGradient id="panel-gradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="' + effective.surface + '"/><stop offset="1" stop-color="' + effective.surface + '" stop-opacity=".78"/></linearGradient></defs>';
    body += '<rect x="' + inset + '" y="' + inset + '" width="' + innerWidth + '" height="' + innerHeight + '" rx="' + radius + '" fill="url(#panel-gradient)" stroke="' + effective.accent + '" stroke-width="' + line + '"/>';
    if (recipe.kind === "button" && innerWidth > line * 4 && innerHeight > line * 4) {
      body += '<path d="M' + (width * 0.32) + " " + (height * 0.5) + " H" + (width * 0.68) + '" stroke="' + effective.foreground + '" stroke-width="' + Math.max(0.5, line * 2) + '" stroke-linecap="round"/>';
    } else if (innerWidth > line * 4 && innerHeight > line * 4) {
      body += '<path d="M' + inset + " " + (inset + innerHeight * 0.24) + " H" + (width - inset) + '" stroke="' + effective.accent + '" stroke-opacity=".5" stroke-width="' + line + '"/>';
      body += '<circle cx="' + (width - inset - Math.max(line, innerWidth * 0.08)) + '" cy="' + (height - inset - Math.max(line, innerHeight * 0.12)) + '" r="' + Math.max(0.5, Math.min(innerWidth, innerHeight) * 0.065) + '" fill="' + effective.attention + '"/>';
    }
    return Core.svgDocument(context.brief, body, { width: width, height: height, label: recipe.title, extraAttributes: 'direction="' + recipe.target.direction + '"' });
  }

  return {
    descriptor: {
      schema: Core.HAND_SCHEMA,
      contract_version: "2.0",
      id: "ui-component",
      title: "UI Component Hand",
      version: "1.2.0",
      category: "creation",
      lifecycle_status: "beta",
      summary: "Creates or edits bounded UI components with a strict recipe master, static SVG delivery, state tokens and nine-slice metadata.",
      operation_modes: ["create", "edit"],
      canvas_models: ["dom-component", "vector-document"],
      entry_surfaces: ["command", "component-editor", "export-recipe"],
      mutability: "transform",
      kinds: KINDS.slice(),
      accepts: [Core.BRIEF_SCHEMA, RECIPE_SCHEMA],
      produces: [Core.RESULT_SCHEMA, "image/svg+xml", "application/json", SPEC_SCHEMA, RECIPE_SCHEMA],
      input_types: [{ mime: "application/json", format: "JSON", schema: RECIPE_SCHEMA, roles: ["source", "editable-ui-recipe"], required_for: ["edit"], mutable: false, max_bytes: 262144 }],
      output_types: [
        { mime: "image/svg+xml", format: "SVG", schema: "", role: "editable-source", editable: true, deterministic: true, lossy: false, known_losses: [] },
        { mime: "application/json", format: "JSON", schema: SPEC_SCHEMA, role: "runtime-metadata", editable: true, deterministic: true, lossy: false, known_losses: [] },
        { mime: "application/json", format: "JSON", schema: RECIPE_SCHEMA, role: "editable-ui-recipe", editable: true, deterministic: true, lossy: false, known_losses: [] },
      ],
      canvas_types: [
        { medium: "ui", units: ["px"], colour_spaces: ["srgb"], transparency_modes: TRANSPARENCY.slice(), behaviours: ["static", "interactive", "responsive"], intended_uses: KINDS.concat(["icon"]) },
        { medium: "screen", units: ["px"], colour_spaces: ["srgb"], transparency_modes: TRANSPARENCY.slice(), behaviours: ["static", "interactive", "responsive"], intended_uses: KINDS.slice() },
        { medium: "game-world", units: ["px"], colour_spaces: ["srgb"], transparency_modes: TRANSPARENCY.slice(), behaviours: ["static", "interactive", "responsive"], intended_uses: KINDS.slice() },
      ],
      canvas_limits: { min_width: 1, min_height: 1, max_width: 8192, max_height: 8192, max_pixels: 67108864 },
      constraints_honoured: ["dimensions", "dimensions.unit", "colour.space", "colour.transparency", "colour.contrast", "responsive.direction", "responsive.input-modalities", "responsive.reduced-motion", "responsive.minimum-target-size", "accessibility.alternative-text", "accessibility.focus-visible", "behaviour.static", "behaviour.interactive", "behaviour.responsive", "performance.max-file-bytes"],
      editable_recipe_formats: [Core.RECIPE_SCHEMA, RECIPE_SCHEMA],
      operations: { preview: true, validate: true, edit: true },
      emits_editable_source: true,
      supports_edit_operation: true,
      required_permissions: { local_file_system: "none", network_domains: [] },
      network_policy: { mode: "none", domains: [] },
      editable: true,
      deterministic: true,
      engine: { name: "AXM interface component geometry", version: "1.2.0", execution: "same-thread-bounded" },
      rollback: { strategy: "discard-candidate" },
      limits: { states: STATES.slice(), externalResources: false, executableSvg: false, interactiveProof: false, automaticPublish: false },
    },
    create: function (context) {
      var recipe = parseEditRecipe(context) || defaultRecipe(context);
      var contrast = Core.accessiblePair(recipe.palette.surface, recipe.palette.foreground, recipe.target.minimum_contrast_ratio);
      var effective = { surface: contrast.background, accent: recipe.palette.accent, foreground: contrast.foreground, attention: recipe.palette.attention };
      var warnings = [];
      if (effective.surface !== recipe.palette.surface || effective.foreground !== recipe.palette.foreground)
        warnings.push("Requested palette was contrast-normalized; recipe palette remains requested while metadata tokens record effective colours.");
      var svg = buildSvg(context, recipe, effective);
      var metadata = {
        schema: SPEC_SCHEMA,
        legacy_schema: "axm.ui-asset-metadata/v1",
        name: recipe.title,
        kind: recipe.kind,
        dimensions: { width: recipe.target.dimensions.width, height: recipe.target.dimensions.height },
        nineSlice: clone(recipe.geometry.nine_slice),
        states: STATES.slice(),
        scalable: true,
        stateStyles: clone(recipe.states),
        interaction: {
          minimumTargetSize: recipe.target.minimum_target_size,
          inputModalities: recipe.target.input_modalities.slice(),
          direction: recipe.target.direction,
          reducedMotion: recipe.target.reduced_motion,
          focusVisible: recipe.target.focus_visible,
          focusRing: clone(recipe.target.focus_ring),
        },
        tokens: {
          surface: effective.surface,
          accent: effective.accent,
          foreground: effective.foreground,
          attention: effective.attention,
          radius: recipe.geometry.radius,
          contrastRatio: contrast.ratio,
          requestedPalette: clone(recipe.palette),
        },
      };
      var metadataText = JSON.stringify(metadata, null, 2);
      var recipeText = JSON.stringify(recipe, null, 2);
      var totalBytes = svg.length + metadataText.length + recipeText.length;
      var interactive = context.targetCanvas.behaviour.indexOf("interactive") >= 0;
      var artifacts = [
        { id: "ui-source", role: "editable-source", name: recipe.title, filename: Core.slug(recipe.title) + ".svg", mime: "image/svg+xml", format: "SVG", width: recipe.target.dimensions.width, height: recipe.target.dimensions.height, editable: true, text: svg, metadata: { nineSlice: clone(recipe.geometry.nine_slice) } },
        { id: "ui-metadata", role: "runtime-metadata", name: recipe.title + " UI metadata", filename: Core.slug(recipe.title) + ".ui.json", mime: "application/json", format: "JSON", width: 0, height: 0, editable: true, text: metadataText, metadata: { schema: SPEC_SCHEMA } },
        { id: "ui-recipe", role: "editable-ui-recipe", name: recipe.title + " UI recipe", filename: Core.slug(recipe.title) + ".ui-recipe.json", mime: "application/json", format: "JSON", width: 0, height: 0, editable: true, text: recipeText, metadata: { schema: RECIPE_SCHEMA } },
      ];
      return {
        artifacts: artifacts,
        previewArtifactId: "ui-source",
        recipe: {
          format: RECIPE_SCHEMA,
          parameters: { operation: context.operationMode, recipeId: recipe.id, recipeSchema: RECIPE_SCHEMA, staticVisualOnly: true },
          steps: [{ op: "validate-ui-recipe" }, { op: "project-requested-palette-to-effective-accessible-tokens" }, { op: "build-static-svg" }, { op: "emit-state-nine-slice-metadata" }, { op: "emit-editable-recipe-master" }],
        },
        validationChecks: [
          { name: "target-canvas-propagated", pass: context.targetCanvas.schema === Core.TARGET_CANVAS_SCHEMA },
          { name: "foreground-contrast", pass: contrast.ratio >= recipe.target.minimum_contrast_ratio, details: contrast },
          { name: "minimum-target-size", pass: !interactive || (recipe.target.dimensions.width >= recipe.target.minimum_target_size && recipe.target.dimensions.height >= recipe.target.minimum_target_size) },
          { name: "reduced-motion", pass: !recipe.target.reduced_motion || STATES.every(function (state) { return recipe.states[state].scale === 1; }) },
          { name: "alternative-text", pass: !recipe.target.alternative_text || /aria-label=/.test(svg) },
          { name: "focus-visible", pass: !recipe.target.focus_visible || !!metadata.interaction.focusRing },
          { name: "three-artifact-transaction", pass: artifacts.length === 3 },
          { name: "file-budget", pass: context.targetCanvas.performance.max_file_bytes == null || totalBytes <= context.targetCanvas.performance.max_file_bytes },
        ],
        measures: { scalable: true, nineSliceReady: true, stateCount: STATES.length, contrastRatio: contrast.ratio, minimumTargetSize: recipe.target.minimum_target_size, totalBytes: totalBytes },
        notes: ["ui-recipe is the sole Asset Hand regeneration master; ui-source and ui-metadata remain downstream/manual artifacts.", "ui-source is a static visual only and does not prove state transitions, nine-slice behavior, focus journeys or input devices."].concat(warnings),
      };
    },
  };
}));
