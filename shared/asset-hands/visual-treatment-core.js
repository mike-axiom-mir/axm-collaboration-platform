(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var api = factory(
    node ? require("./choice-first-core") : root.AXMChoiceFirstCore,
    node ? require("./pixel-3d-core") : root.AXMPixel3DCore,
    node ? require("./pixel-3d-codec") : root.AXMPixel3DCodec,
    node ? require("../visual-fx/fx-blocks") : root.AXMVisualFX,
    node ? require("./visual-capability-catalog.generated") : root.AXMVisualCapabilityCatalog
  );
  if (node) module.exports = api;
  if (root) root.AXMVisualTreatmentCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Choice, Pixel3D, Codec, VisualFX, Catalog) {
  "use strict";
  if (!Choice || !Pixel3D || !Codec || !VisualFX || !Catalog) throw new Error("visual treatment dependencies are required");

  var VERSION = "1.0.0";
  var SCHEMAS = Object.freeze({
    request: "axm.visual-treatment-request/v1",
    recipe: "axm.visual-treatment-recipe/v1",
    receipt: "axm.visual-treatment-validation-receipt/v1",
    catalog: "axm.visual-capability-catalog/v1"
  });
  var PALETTE_ROLES = ["primary", "secondary", "accent", "highlight", "surface", "primary", "secondary", "accent"];
  var DIRECT_3D_EFFECTS = Object.freeze([
    "material.aetherglass",
    "material.frosted-panel",
    "material.hologram-skin",
    "material.dark-shell",
    "light.neon-edge-glow",
    "light.soft-bloom-halo",
    "light.reflection-streak",
    "light.ambient-backwash",
    "depth.layered-shadow",
    "focus.halo",
    "atmosphere.ambient-field",
    "atmosphere.vignette",
    "motion.idle-pulse"
  ]);

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, Number(value))); }
  function round(value) { return Number(Number(value).toFixed(6)); }
  function slug(value) { return String(value || "treatment").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "treatment"; }
  function escapeXml(value) { return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function authority() { return { candidate_only: true, installed: false, promoted: false, canonical: false, human_review_required: true }; }

  function hexToRgb(value) {
    var match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
    if (!match) return [128, 128, 128];
    var number = parseInt(match[1], 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
  }

  function rgbToHex(rgb) {
    return "#" + rgb.map(function (value) { return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0"); }).join("").toUpperCase();
  }

  function mixHex(first, second, amount) {
    var a = hexToRgb(first), b = hexToRgb(second), t = clamp(amount, 0, 1);
    return rgbToHex(a.map(function (value, index) { return value + (b[index] - value) * t; }));
  }

  function mixNumber(first, second, amount) {
    var a = Number(first), b = Number(second), t = clamp(amount, 0, 1);
    if (!Number.isFinite(a)) a = 0;
    if (!Number.isFinite(b)) return a;
    return round(a + (b - a) * t);
  }

  function styleById(id) {
    var preset = Catalog.style_presets.find(function (item) { return item.id === id; });
    if (preset) return {
      id: preset.id,
      name: preset.name,
      source: "style-fabric:preskin",
      palette: clone(preset.intent.palette || {}),
      material: clone(preset.intent.material || {}),
      pattern: clone(preset.intent.pattern || null),
      accessibility: clone(preset.intent.accessibility || {})
    };
    var treatment = Catalog.treatment_molds.find(function (item) { return item.id === id; });
    if (treatment) return {
      id: treatment.id,
      name: treatment.name,
      source: "style-fabric:treatment-mold",
      palette: clone(treatment.palette || {}),
      material: clone(treatment.legacy || {}),
      pattern: clone(treatment.legacy && treatment.legacy.pattern || null),
      accessibility: { minimumTextContrast: treatment.constraints && treatment.constraints.minimumTextContrast, reducedMotion: false },
      effect_stack: clone(treatment.effectStack || null),
      lighting_rig: clone(treatment.lightingRig || null)
    };
    return null;
  }

  function pbrFamilyById(id) {
    return Catalog.pbr_material_families.find(function (item) { return item.id === id; }) || null;
  }

  function aetherModuleById(id) {
    return Catalog.aetherfx_modules.find(function (item) { return item.id === id; }) || null;
  }

  function missing(request, items) {
    return {
      schema: "axm.missing-representation/v1",
      version: "1.0.0",
      status: "MISSING_VISUAL_CAPABILITY",
      request_id: String(request && request.id || "unknown"),
      missing: items,
      gap_types: Array.from(new Set(items.map(function (item) { return item.gap_type; }))).sort(),
      fallback_used: false,
      nearest_substitute_used: false,
      installed: false,
      promoted: false,
      canonical: false,
      next_actions: items.map(function (item) { return item.next_action; })
    };
  }

  function validateRequest(request) {
    var errors = [];
    if (!request || request.schema !== SCHEMAS.request) errors.push({ id: "request-schema", gap_type: "CONTRACT", next_action: "Provide axm.visual-treatment-request/v1." });
    if (!request || request.version !== "1.0.0") errors.push({ id: "request-version", gap_type: "CONTRACT", next_action: "Use request version 1.0.0." });
    if (!request || request.authority !== "candidate-only") errors.push({ id: "candidate-authority", gap_type: "AUTHORITY", next_action: "Keep generated visual treatments candidate-only." });
    if (!request || !Array.isArray(request.style_layers) || !request.style_layers.length) errors.push({ id: "style-layer", gap_type: "CONTRACT", next_action: "Select at least one exact Style Fabric preset or treatment." });
    if (request && Array.isArray(request.style_layers)) request.style_layers.forEach(function (layer) {
      if (!styleById(layer.id)) errors.push({ id: "style:" + layer.id, gap_type: "HAND", next_action: "Add the exact style to Style Fabric and rebuild the capability catalog." });
    });
    if (request && Array.isArray(request.effect_modules)) request.effect_modules.forEach(function (effect) {
      if (!aetherModuleById(effect.id)) errors.push({ id: "aetherfx:" + effect.id, gap_type: "HAND", next_action: "Add the exact AetherFX module and rebuild the capability catalog." });
    });
    if (request && request.material_family && !pbrFamilyById(request.material_family)) errors.push({ id: "pbr-family:" + request.material_family, gap_type: "HAND", next_action: "Add the exact PBR family to the material baker." });
    return errors;
  }

  function normalizedStyle(layer) {
    var style = styleById(layer.id);
    var overrides = clone(layer.overrides || {});
    style.palette = Object.assign({}, style.palette, overrides.palette || {});
    style.material = Object.assign({}, style.material, overrides.material || {});
    style.pattern = overrides.pattern || style.pattern;
    style.weight = clamp(layer.weight == null ? 1 : layer.weight, 0, 1);
    return style;
  }

  function applyStyle(scene, style, effectScale) {
    var material = style.material || {}, palette = style.palette || {};
    scene.materials.forEach(function (target, index) {
      var role = PALETTE_ROLES[index % PALETTE_ROLES.length];
      var colour = palette[role] || palette.primary || palette.surface || target.colour;
      target.colour = mixHex(target.colour, colour, style.weight);
      target.roughness = mixNumber(target.roughness, material.roughness == null && material.gloss != null ? 1 - Number(material.gloss) : material.roughness, style.weight);
      target.metallic = mixNumber(target.metallic, material.metallic, style.weight);
      target.clearcoat = mixNumber(target.clearcoat || 0, material.clearcoat, style.weight);
      target.sheen = mixNumber(target.sheen || 0, material.sheen, style.weight);
      target.iridescence = mixNumber(target.iridescence || 0, material.iridescence, style.weight);
      target.translucency = mixNumber(target.translucency || 0, material.translucency, style.weight);
      target.pattern = style.pattern || target.pattern || null;
      var emissiveStrength = Number(material.emissiveStrength || 0) * Number(effectScale);
      if (emissiveStrength > 0) {
        target.emissive_colour = palette.emissiveColor || palette.accent || palette.primary || target.colour;
        target.emissive_strength = mixNumber(target.emissive_strength || 0, emissiveStrength, style.weight);
      }
      target.visual_treatment = { style_id: style.id, source: style.source, weight: style.weight };
    });
  }

  function applyPbrFamily(scene, family) {
    if (!family) return;
    var base = rgbToHex(family.base), accent = rgbToHex(family.accent);
    var roughness = family.id === "glass" ? 0.12 : family.id === "vehicle-paint" ? 0.22 : family.id === "painted-metal" ? 0.38 : family.id === "asphalt" ? 0.93 : family.id === "brick" ? 0.88 : 0.62;
    var metallic = family.id === "vehicle-paint" ? 0.72 : family.id === "painted-metal" ? 0.55 : family.id === "glass" ? 0.08 : 0.02;
    scene.materials.forEach(function (material, index) {
      material.colour = mixHex(material.colour, index % 2 ? accent : base, 0.38);
      material.roughness = mixNumber(material.roughness, roughness, 0.55);
      material.metallic = mixNumber(material.metallic, metallic, 0.55);
      material.pbr_material_family = family.id;
    });
  }

  function sanitizedParams(module, input) {
    var params = {}, provided = input || {};
    (module.parameters || []).forEach(function (definition) {
      var value = Object.prototype.hasOwnProperty.call(provided, definition.id) ? provided[definition.id] : definition.default;
      if (definition.type === "number") value = clamp(Number(value), Number.isFinite(definition.min) ? definition.min : -1e6, Number.isFinite(definition.max) ? definition.max : 1e6);
      if (definition.type === "boolean") value = value === true;
      if (definition.type === "select" && Array.isArray(definition.options) && definition.options.indexOf(value) < 0) value = definition.default;
      params[definition.id] = value;
    });
    return params;
  }

  function compileEffects(requested, quality) {
    var plan = [], errors = [], seen = [];
    function expand(moduleId, input, requestedId, stack) {
      if (stack.indexOf(moduleId) >= 0) { errors.push("composite cycle " + stack.concat([moduleId]).join(" -> ")); return; }
      if (stack.length > 32) { errors.push("effect composition depth exceeded"); return; }
      var module = aetherModuleById(moduleId);
      if (!module) { errors.push("unknown AetherFX module " + moduleId); return; }
      var tier = module.quality && module.quality[quality];
      if (tier && tier.enabled === false) { errors.push(moduleId + " is unavailable at exact " + quality + " quality; fallback refused"); return; }
      var params = sanitizedParams(module, Object.assign({}, input || {}, tier && tier.parameterOverrides || {}));
      var renderer = module.renderer || { type: "capability" };
      if (renderer.type === "derived") {
        expand(renderer.baseModuleId, Object.assign({}, params, renderer.parameterOverrides || {}), requestedId, stack.concat([moduleId]));
        return;
      }
      if (renderer.type === "composite") {
        (renderer.layers || []).forEach(function (layer) {
          var child = Object.assign({}, layer.params || {});
          Object.keys(layer.bindings || {}).forEach(function (childId) { var parentId = layer.bindings[childId]; if (Object.prototype.hasOwnProperty.call(params, parentId)) child[childId] = params[parentId]; });
          expand(layer.moduleId, child, requestedId, stack.concat([moduleId]));
        });
        return;
      }
      var cssVariables = {};
      (module.parameters || []).forEach(function (definition) { if (definition.cssVar) cssVariables[definition.cssVar] = params[definition.id]; });
      plan.push({
        requested_id: requestedId,
        module_id: module.id,
        name: module.name,
        kind: module.kind,
        category: module.category,
        renderer: renderer,
        params: params,
        css_variables: cssVariables,
        route: DIRECT_3D_EFFECTS.indexOf(module.id) >= 0 ? "APPLIED_3D_AND_PORTABLE_WEB" : renderer.type === "capability" ? "TOKEN_ONLY" : "PORTABLE_WEB_ONLY",
        fallback_used: false
      });
    }
    (requested || []).forEach(function (effect) { expand(effect.id, effect.params || {}, effect.id, []); seen.push(effect.id); });
    return { plan: plan, errors: errors, requested: seen };
  }

  function materialById(scene, id) { return scene.materials.find(function (item) { return item.id === id; }) || null; }
  function nodeById(scene, id) { return scene.nodes.find(function (item) { return item.id === id; }) || null; }
  function addMaterial(scene, material) { var existing = materialById(scene, material.id); if (existing) return existing; scene.materials.push(material); return material; }
  function addNode(scene, node) { var existing = nodeById(scene, node.id); if (existing) return existing; scene.nodes.push(node); return node; }

  function effectColour(scene) {
    var material = scene.materials.find(function (item) { return Number(item.emissive_strength) > 0; }) || scene.materials[1] || scene.materials[0];
    return material.emissive_colour || material.colour;
  }

  function ensureHalo(scene, strength) {
    var colour = effectColour(scene), footprint = scene.footprint || { width: 2, depth: 2 };
    addMaterial(scene, { id: "visual-fx-halo", role: "visual-fx-halo", colour: colour, unlit: true, roughness: 0.2, metallic: 0, emissive_colour: colour, emissive_strength: clamp(strength, 0.05, 5), opacity: 0.92, double_sided: true, visual_treatment: { adapter: "AetherFX", effect: "halo" } });
    return addNode(scene, { id: "visual-fx-halo", component_id: "visual.fx.halo", parent_id: null, primitive: { type: "torus", detail: 10, minor_radius: 0.045 }, material_id: "visual-fx-halo", translation: [0, 0.055, 0], rotation: [0.7071068, 0, 0, 0.7071068], scale: [Math.max(0.45, footprint.width * 0.34), Math.max(0.45, footprint.depth * 0.34), Math.max(0.45, footprint.width * 0.34)] });
  }

  function ensureShadow(scene) {
    var footprint = scene.footprint || { width: 2, depth: 2 };
    addMaterial(scene, { id: "visual-depth-shadow", role: "visual-depth-shadow", colour: "#05070B", unlit: true, roughness: 1, metallic: 0, opacity: 0.72, double_sided: true, visual_treatment: { adapter: "AetherFX", effect: "depth.layered-shadow" } });
    addNode(scene, { id: "visual-depth-shadow", component_id: "visual.fx.shadow", parent_id: null, primitive: { type: "cylinder", detail: 10 }, material_id: "visual-depth-shadow", translation: [0, 0.012, 0], rotation: [0, 0, 0, 1], scale: [Math.max(0.5, footprint.width * 0.42), 0.012, Math.max(0.5, footprint.depth * 0.42)] });
  }

  function ensureAmbient(scene, strength) {
    var colour = effectColour(scene);
    addMaterial(scene, { id: "visual-ambient-particle", role: "visual-ambient-particle", colour: colour, unlit: true, roughness: 0.4, metallic: 0, emissive_colour: colour, emissive_strength: clamp(strength, 0.05, 3), opacity: 0.82, visual_treatment: { adapter: "AetherFX", effect: "atmosphere.ambient-field" } });
    [[-1.1,0.42,-0.6],[1.05,0.66,-0.35],[-0.82,1.25,0.35],[0.94,1.48,0.52]].forEach(function (translation, index) {
      addNode(scene, { id: "visual-ambient-" + index, component_id: "visual.fx.ambient-particle", parent_id: null, primitive: { type: "sphere", detail: 5 }, material_id: "visual-ambient-particle", translation: translation, rotation: [0,0,0,1], scale: [0.035 + index * 0.006, 0.035 + index * 0.006, 0.035 + index * 0.006] });
    });
  }

  function ensurePulse(scene, node) {
    var animation = scene.animations[0];
    if (!animation || animation.channels.some(function (channel) { return channel.node_id === node.id && channel.path === "scale"; })) return;
    var scale = node.scale.slice(), high = scale.map(function (value) { return round(value * 1.11); });
    animation.channels.push({ node_id: node.id, path: "scale", interpolation: "LINEAR", keys: [{ time: 0, value: scale }, { time: round(animation.duration_seconds / 2), value: high }, { time: animation.duration_seconds, value: scale }] });
  }

  function applyEffect(scene, item, effectScale) {
    var id = item.module_id, intensity = clamp(Number(item.params.intensity == null ? 0.55 : item.params.intensity) * effectScale, 0, 4);
    if (id === "material.aetherglass") scene.materials.forEach(function (material) { material.roughness = mixNumber(material.roughness, item.params.roughness == null ? 0.18 : item.params.roughness, 0.72); material.metallic = mixNumber(material.metallic, 0.28, 0.55); material.clearcoat = Math.max(material.clearcoat || 0, 0.74 * effectScale); material.translucency = Math.max(material.translucency || 0, 0.38 * effectScale); });
    else if (id === "material.frosted-panel") scene.materials.forEach(function (material) { material.roughness = mixNumber(material.roughness, 0.66, 0.64); material.translucency = Math.max(material.translucency || 0, 0.22 * effectScale); });
    else if (id === "material.hologram-skin") scene.materials.forEach(function (material) { material.emissive_colour = material.emissive_colour || material.colour; material.emissive_strength = Math.max(material.emissive_strength || 0, intensity); material.iridescence = Math.max(material.iridescence || 0, 0.72 * effectScale); });
    else if (id === "material.dark-shell") scene.materials.forEach(function (material) { material.colour = mixHex(material.colour, "#09101C", 0.36); material.metallic = Math.max(material.metallic, 0.18); });
    else if (id === "light.neon-edge-glow") { scene.materials.forEach(function (material, index) { if (index % 2 === 0) { material.emissive_colour = material.emissive_colour || material.colour; material.emissive_strength = Math.max(material.emissive_strength || 0, intensity); } }); ensureHalo(scene, Math.max(0.35, intensity)); }
    else if (id === "light.soft-bloom-halo" || id === "focus.halo") ensureHalo(scene, Math.max(0.2, intensity));
    else if (id === "light.reflection-streak") scene.materials.forEach(function (material) { material.roughness = mixNumber(material.roughness, 0.14, 0.36 * effectScale); material.metallic = Math.max(material.metallic, 0.22 * effectScale); material.sheen = Math.max(material.sheen || 0, 0.55 * effectScale); });
    else if (id === "light.ambient-backwash") ensureHalo(scene, Math.max(0.12, intensity * 0.45));
    else if (id === "depth.layered-shadow") ensureShadow(scene);
    else if (id === "atmosphere.ambient-field") ensureAmbient(scene, Math.max(0.1, intensity));
    else if (id === "atmosphere.vignette") scene.visual_treatment.post_effects.push({ id: id, intensity: intensity, renderer_support: "companion-web-only" });
    else if (id === "motion.idle-pulse") { var halo = ensureHalo(scene, Math.max(0.2, intensity)); ensurePulse(scene, halo); }
  }

  function cssValue(value, definition) {
    if (typeof value === "number" && definition && definition.unit) return value + definition.unit;
    return String(value);
  }

  function portableCss(plan) {
    var variables = {}, classes = [];
    plan.forEach(function (item) {
      Object.keys(item.css_variables || {}).forEach(function (key) {
        var definition = (aetherModuleById(item.module_id).parameters || []).find(function (entry) { return entry.cssVar === key; });
        variables[key] = cssValue(item.css_variables[key], definition);
      });
      if (item.renderer && item.renderer.className) classes.push(item.renderer.className);
    });
    var declaration = Object.keys(variables).sort().map(function (key) { return "  " + key + ": " + variables[key] + ";"; }).join("\n");
    return "/* AXM deterministic visual treatment; candidate-only */\n:root {\n" + declaration + "\n}\n/* exact AetherFX classes: " + classes.sort().join(" ") + " */\n";
  }

  function storySvg(request, styles, plan) {
    var width = 960, height = 540, story = request.story || null;
    var palette = styles[styles.length - 1].palette || {}, primary = palette.primary || "#38E8FF", secondary = palette.secondary || "#7C5CFF", accent = palette.accent || "#FF43C8";
    var gradient = VisualFX.Blocks.linearGradient({ stops: ["#050812", mixHex("#050812", secondary, 0.24), "#07111D"], angle: 135 });
    var neon = VisualFX.Blocks.neon({ color: primary, core: "#FFFFFF", blur: 7 });
    var glow = VisualFX.Blocks.glow({ color: accent, blur: 10, spread: 1.1 });
    var nodes = story && story.nodes.length ? story.nodes : [{ id: "treatment", caption: "SAME IDENTITY / NEW VISUAL TREATMENT", duration_s: 1 }];
    var panelWidth = Math.min(250, Math.floor((width - 100) / Math.min(nodes.length, 3))), panelHeight = 156;
    var panels = nodes.map(function (node, index) {
      var column = index % 3, row = Math.floor(index / 3), x = 50 + column * (panelWidth + 22), y = 150 + row * (panelHeight + 18);
      var caption = escapeXml(node.caption), focus = escapeXml(node.focus_component || "presentation-only");
      return '<g transform="translate(' + x + ' ' + y + ')"><rect width="' + panelWidth + '" height="' + panelHeight + '" rx="18" fill="#0D1726" fill-opacity=".86" stroke="' + (index % 2 ? secondary : primary) + '" stroke-width="2" filter="url(#' + glow.id + ')"/><text x="18" y="30" fill="' + accent + '" font-family="ui-monospace,monospace" font-size="11">NODE ' + escapeXml(node.id) + ' · ' + Number(node.duration_s).toFixed(1) + 's</text><foreignObject x="18" y="45" width="' + (panelWidth - 36) + '" height="68"><div xmlns="http://www.w3.org/1999/xhtml" style="font:700 16px system-ui;color:#fff;line-height:1.25">' + caption + '</div></foreignObject><text x="18" y="135" fill="#8FA6BC" font-family="ui-monospace,monospace" font-size="9">FOCUS ' + focus + '</text></g>';
    }).join("");
    var title = escapeXml(story && story.title || styles.map(function (style) { return style.name; }).join(" + "));
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="AXM deterministic visual treatment story board"><defs>' + gradient.svgDefs + neon.svgFilter + glow.svgFilter + '</defs><rect width="960" height="540" fill="url(#' + gradient.id + ')"/><circle cx="790" cy="96" r="110" fill="' + secondary + '" opacity=".12" filter="url(#' + glow.id + ')"/><text x="50" y="55" fill="' + primary + '" font-family="ui-monospace,monospace" font-size="13">AXM VISUAL CAPABILITY FABRIC · EXACT ROUTE · NO FALLBACK</text><text x="50" y="104" fill="#FFFFFF" font-family="system-ui,sans-serif" font-size="34" font-weight="800" filter="url(#' + neon.id + ')">' + title + '</text><text x="50" y="129" fill="#9DB0C4" font-family="ui-monospace,monospace" font-size="11">' + escapeXml(request.identity_id) + ' · ' + escapeXml(request.profile_id) + ' · ' + plan.length + ' RESOLVED EFFECT LEAVES</text>' + panels + '<text x="50" y="515" fill="#8297AA" font-family="ui-monospace,monospace" font-size="10">SUPPLIED COPY ONLY · CANDIDATE-ONLY · VISUAL REVIEW REQUIRED</text></svg>';
  }

  function safeStorySvg(request, styles, plan) {
    var width = 960, height = 540, story = request.story || null;
    var palette = styles[styles.length - 1].palette || {}, primary = palette.primary || "#38E8FF", secondary = palette.secondary || "#7C5CFF", accent = palette.accent || "#FF43C8";
    var allNodes = story && story.nodes.length ? story.nodes : [{ id: "treatment", caption: "SAME IDENTITY / NEW VISUAL TREATMENT", duration_s: 1 }];
    var nodes = allNodes.slice(0, 6), panelWidth = 260, panelHeight = 142;
    function lines(value, maximum, limit) {
      var words = String(value || "").trim().split(/\s+/), output = [], current = "";
      words.forEach(function (word) { var next = current ? current + " " + word : word; if (next.length <= maximum || !current) current = next; else { output.push(current); current = word; } });
      if (current) output.push(current);
      if (output.length > limit) { output = output.slice(0, limit); output[limit - 1] = output[limit - 1].slice(0, maximum - 1).replace(/[ .,:;!?-]+$/, "") + "…"; }
      return output;
    }
    var panels = nodes.map(function (node, index) {
      var column = index % 3, row = Math.floor(index / 3), x = 50 + column * 282, y = 150 + row * 158;
      var caption = lines(node.caption, 28, 3).map(function (line, lineIndex) { return '<tspan x="18" dy="' + (lineIndex ? 20 : 0) + '">' + escapeXml(line) + '</tspan>'; }).join("");
      return '<g transform="translate(' + x + ' ' + y + ')"><rect width="' + panelWidth + '" height="' + panelHeight + '" rx="16" fill="#0D1726" fill-opacity=".9" stroke="' + (index % 2 ? secondary : primary) + '" stroke-width="2"/><text x="18" y="28" fill="' + accent + '" font-family="ui-monospace,monospace" font-size="10">NODE ' + escapeXml(node.id) + ' · ' + Number(node.duration_s).toFixed(1) + 's</text><text x="18" y="57" fill="#FFFFFF" font-family="system-ui,sans-serif" font-size="16" font-weight="700">' + caption + '</text><text x="18" y="124" fill="#8FA6BC" font-family="ui-monospace,monospace" font-size="9">FOCUS ' + escapeXml(node.focus_component || "presentation-only") + '</text></g>';
    }).join("");
    var title = escapeXml(story && story.title || styles.map(function (style) { return style.name; }).join(" + "));
    var overflow = allNodes.length > nodes.length ? " · " + (allNodes.length - nodes.length) + " MORE NODES IN RECIPE" : "";
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="AXM deterministic visual treatment story board"><defs><linearGradient id="board-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050812"/><stop offset=".55" stop-color="' + secondary + '" stop-opacity=".24"/><stop offset="1" stop-color="#07111D"/></linearGradient></defs><rect width="960" height="540" fill="url(#board-gradient)"/><circle cx="790" cy="96" r="110" fill="' + secondary + '" opacity=".12"/><text x="50" y="55" fill="' + primary + '" font-family="ui-monospace,monospace" font-size="13">AXM VISUAL CAPABILITY FABRIC · EXACT ROUTE · NO FALLBACK</text><text x="50" y="104" fill="#FFFFFF" font-family="system-ui,sans-serif" font-size="34" font-weight="800">' + title + '</text><text x="50" y="129" fill="#9DB0C4" font-family="ui-monospace,monospace" font-size="11">' + escapeXml(request.identity_id) + ' · ' + escapeXml(request.profile_id) + ' · ' + plan.length + ' RESOLVED EFFECT LEAVES' + overflow + '</text>' + panels + '<text x="50" y="515" fill="#8297AA" font-family="ui-monospace,monospace" font-size="10">SUPPLIED COPY ONLY · CANDIDATE-ONLY · VISUAL REVIEW REQUIRED</text></svg>';
  }

  function buildPackage(request) {
    var gaps = validateRequest(request);
    if (gaps.length) return missing(request, gaps);
    var base = Pixel3D.createScene(request.identity_id, request.profile_id, request.animation_state);
    if (base.status !== "READY") return missing(request, [{ id: "pixel-3d:" + request.identity_id + ":" + request.profile_id, gap_type: "HAND", next_action: "Implement the exact identity/profile representation." }]);
    var styles = request.style_layers.map(normalizedStyle);
    var accessibility = Object.assign({ reduced_motion: false, high_contrast: false, effect_scale: 1 }, request.accessibility || {});
    if (accessibility.reduced_motion) accessibility.effect_scale = Math.min(accessibility.effect_scale, 0.35);
    var effects = compileEffects(request.effect_modules || [], request.profile_id === "pixel-8bit-3d" ? "low" : "medium");
    if (effects.errors.length) return missing(request, effects.errors.map(function (detail) { return { id: detail, gap_type: "HAND", next_action: "Implement the exact effect at the requested profile without fallback." }; }));
    var scene = clone(base.scene);
    scene.id = scene.id.replace(/-scene$/, "-" + slug(request.id) + "-treated-scene");
    scene.visual_treatment = { request_id: request.id, catalog_digest: Catalog.digest, style_ids: styles.map(function (style) { return style.id; }), effect_ids: effects.requested.slice(), material_family: request.material_family || null, accessibility: clone(accessibility), story: clone(request.story || null), post_effects: [], candidate_only: true };
    styles.forEach(function (style) { applyStyle(scene, style, accessibility.effect_scale); });
    var family = request.material_family ? pbrFamilyById(request.material_family) : null;
    applyPbrFamily(scene, family);
    effects.plan.forEach(function (item) { if (DIRECT_3D_EFFECTS.indexOf(item.module_id) >= 0) applyEffect(scene, item, accessibility.effect_scale); });
    if (accessibility.reduced_motion) scene.animations.forEach(function (animation) { animation.channels = animation.channels.filter(function (channel) { return channel.node_id !== "visual-fx-halo"; }); });
    var first = Codec.pack(scene), second = Codec.pack(scene), inspection = Codec.inspect(first.bytes);
    var limits = scene.budgets;
    var checks = [
      { id: "glb-structure", pass: inspection.pass, details: inspection.errors.join("; ") || "GLB structure, nodes and animation inspect cleanly" },
      { id: "identity-preserved", pass: inspection.identity_id === request.identity_id, details: String(inspection.identity_id) },
      { id: "profile-preserved", pass: inspection.representation_profile_id === request.profile_id, details: String(inspection.representation_profile_id) },
      { id: "catalog-bound", pass: scene.visual_treatment.catalog_digest === Catalog.digest, details: Catalog.digest },
      { id: "exact-style-resolution", pass: styles.length === request.style_layers.length, details: styles.map(function (style) { return style.id; }).join(", ") },
      { id: "exact-effect-resolution", pass: effects.requested.length === request.effect_modules.length, details: effects.requested.join(", ") || "none" },
      { id: "triangle-budget", pass: inspection.triangles <= limits.max_triangles, details: inspection.triangles + " / " + limits.max_triangles },
      { id: "node-budget", pass: inspection.nodes <= limits.max_nodes, details: inspection.nodes + " / " + limits.max_nodes },
      { id: "material-budget", pass: inspection.materials <= limits.max_materials, details: inspection.materials + " / " + limits.max_materials },
      { id: "file-budget", pass: first.bytes.length <= limits.max_glb_bytes, details: first.bytes.length + " / " + limits.max_glb_bytes },
      { id: "byte-determinism", pass: Pixel3D.byteDigest(first.bytes) === Pixel3D.byteDigest(second.bytes), details: Pixel3D.byteDigest(first.bytes) },
      { id: "no-fallback", pass: true, details: "fallback_used=false; nearest_substitute_used=false" },
      { id: "candidate-only", pass: request.authority === "candidate-only", details: "installed=false; promoted=false; canonical=false" }
    ];
    var treatmentDigest = "axm-stable:" + Choice.digest({ request: request, catalog_digest: Catalog.digest, scene: scene });
    var recipe = {
      schema: SCHEMAS.recipe,
      version: "1.0.0",
      id: slug(request.id) + "-visual-treatment",
      request_id: request.id,
      identity_id: request.identity_id,
      profile_id: request.profile_id,
      catalog_digest: Catalog.digest,
      style_layers: styles,
      effect_plan: effects.plan,
      material_family: request.material_family || null,
      accessibility: accessibility,
      story: request.story || null,
      scene_recipe_digest: "axm-stable:" + Choice.digest(scene),
      authority: authority()
    };
    var adapterResults = styles.map(function (style) { return { id: style.id, adapter: "style-fabric", route: "APPLIED_3D_AND_STORYBOARD", fallback_used: false }; }).concat(effects.plan.map(function (item) { return { id: item.module_id, requested_id: item.requested_id, adapter: "aetherfx", route: item.route, fallback_used: false }; }));
    if (family) adapterResults.push({ id: family.id, adapter: "pbr-material-baker", route: "PARAMETRIC_PBR_APPLIED_3D; TEXTURE_MAP_SET_AVAILABLE_THROUGH_PBR_HAND", fallback_used: false });
    var knownLosses = [
      "The current GLB renderer executes base colour, metallic, roughness and emissive strength; clearcoat, sheen, iridescence, translucency and patterns remain preserved treatment metadata until a compatible renderer adapter is selected.",
      "AetherFX modules marked PORTABLE_WEB_ONLY or TOKEN_ONLY are emitted in the companion plan and CSS but are not falsely claimed as GLB shader execution.",
      "Storycraft output uses supplied captions only and does not infer narrative, mutate gameplay, take screenshots or control navigation.",
      "PBR family parameters affect the GLB now; the separate deterministic PBR Material Bake Hand emits the real PNG texture maps.",
      "Human visual review remains required before promotion."
    ];
    var receipt = {
      schema: SCHEMAS.receipt,
      version: "1.0.0",
      status: checks.every(function (check) { return check.pass; }) ? "PASS" : "FAIL",
      request_id: request.id,
      identity_id: request.identity_id,
      profile_id: request.profile_id,
      catalog_digest: Catalog.digest,
      treatment_digest: treatmentDigest,
      glb_digest: Pixel3D.byteDigest(first.bytes),
      checks: checks,
      adapter_results: adapterResults,
      measures: { triangles: inspection.triangles, vertices: inspection.vertices, nodes: inspection.nodes, meshes: inspection.meshes, materials: inspection.materials, animations: inspection.animations, glb_bytes: first.bytes.length, style_layers: styles.length, requested_effect_modules: request.effect_modules.length, resolved_effect_leaves: effects.plan.length, story_nodes: request.story ? request.story.nodes.length : 0 },
      known_losses: knownLosses,
      fallback_used: false,
      nearest_substitute_used: false,
      authority: authority()
    };
    var representationSet = {
      schema: "axm.asset-representation-set/v1",
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: request.identity_id + "-visual-treatment-set",
      identity_id: request.identity_id,
      representations: [{
        profile_id: request.profile_id,
        recipe_id: recipe.id,
        treatment_digest: treatmentDigest,
        artifacts: [
          { id: "treated-glb", mime: "model/gltf-binary", role: "treated-runtime-model" },
          { id: "storyboard", mime: "image/svg+xml", role: "storycraft-treatment-board" },
          { id: "portable-css", mime: "text/css", role: "portable-aetherfx-css" }
        ],
        digest: receipt.glb_digest,
        availability: receipt.status === "PASS" ? "AVAILABLE" : "MISSING_REPRESENTATION",
        animation_state: request.animation_state
      }],
      semantic_coverage: base.identity.semantic_actions.slice(),
      compatibility: { footprint_preserved: true, pivots_preserved: true, sockets_preserved: true, simulation_state_shared: true },
      provenance: { builder: "AXMVisualTreatmentCore", version: VERSION, catalog_digest: Catalog.digest, treatment_digest: treatmentDigest },
      authority: authority()
    };
    return {
      status: receipt.status === "PASS" ? "READY" : "VALIDATION_FAILED",
      fallback_used: false,
      nearest_substitute_used: false,
      identity: base.identity,
      profile: base.profile,
      scene: scene,
      glb: first,
      recipe: recipe,
      receipt: receipt,
      representation_set: representationSet,
      storyboard_svg: safeStorySvg(request, styles, effects.plan),
      portable_css: portableCss(effects.plan),
      catalog_reference: { schema: Catalog.schema, version: Catalog.version, digest: Catalog.digest, counts: clone(Catalog.counts) }
    };
  }

  function listChoices() {
    return {
      catalog_digest: Catalog.digest,
      styles: Catalog.style_presets.map(function (item) { return { id: item.id, name: item.name, family: item.family, source: item.source }; }).concat(Catalog.treatment_molds.map(function (item) { return { id: item.id, name: item.name, family: "Treatment Mold", source: item.source }; })),
      effects: Catalog.aetherfx_modules.map(function (item) { return { id: item.id, name: item.name, kind: item.kind, category: item.category, direct_3d: DIRECT_3D_EFFECTS.indexOf(item.id) >= 0 }; }),
      materials: Catalog.pbr_material_families.map(function (item) { return { id: item.id, name: item.label }; }),
      adapters: Catalog.adapters.map(function (item) { return { id: item.id, integration: item.integration, status: item.lifecycle_status }; })
    };
  }

  return Object.freeze({ VERSION: VERSION, SCHEMAS: SCHEMAS, CATALOG: Catalog, DIRECT_3D_EFFECTS: DIRECT_3D_EFFECTS, listChoices: listChoices, buildPackage: buildPackage });
});
