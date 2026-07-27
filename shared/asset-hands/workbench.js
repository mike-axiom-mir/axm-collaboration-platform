(function () {
  "use strict";

  var Hands = window.AXMAssetHands;
  var Finisher = window.AXMAssetFinisher;
  var $ = function (id) { return document.getElementById(id); };
  var results = [];
  var host = {
    capabilities: ["svg", "json", "canvas-2d", "output:image.transform"],
    permissions: [],
    accepts: [
      Hands.RESULT_SCHEMA, "image/svg+xml", "image/png", "image/apng", "image/ktx2",
      "image/jpeg", "image/webp", "application/json", "application/pdf",
      "application/dxf", "application/mtlx+xml",
      "application/vnd.opentimelineio+json", "text/css", "text/plain",
      "model/obj", "model/gltf-binary"
    ]
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
    });
  }
  function status(message, error) {
    var box = $("status");
    box.textContent = message;
    box.classList.toggle("error", !!error);
    box.classList.add("show");
    clearTimeout(status.timer);
    status.timer = setTimeout(function () { box.classList.remove("show"); }, 5000);
  }
  function dataUrl(svg) { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }
  function download(name, mime, content) {
    var anchor = document.createElement("a");
    anchor.download = name;
    anchor.href = URL.createObjectURL(new Blob([content], { type: mime }));
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(anchor.href); }, 1200);
  }
  function optionalNumber(id) { var value = $(id).value; return value === "" ? null : Number(value); }
  function optionalText(id) { var value = $(id).value.trim(); return value || null; }
  function csv(id) {
    return $(id).value.split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  }
  function numericCsv(id) { return csv(id).map(Number); }
  function jsonArray(id) {
    var value = $(id).value.trim();
    if (!value) return [];
    try { return JSON.parse(value); } catch (error) { return value; }
  }
  function sourceArtifacts() {
    var value = $("sourceArtifact").value.trim();
    if (!value) return [];
    try {
      var parsed = JSON.parse(value);
      if (parsed && [Hands.ARTIFACT_SCHEMA, Hands.SOURCE_ARTIFACT_SCHEMA].indexOf(parsed.schema) >= 0) return [parsed];
      return [{ role: "source", name: "Pasted JSON source", mime: "application/json", format: "JSON", text: value, editable: false, metadata: { schema: parsed && String(parsed.schema || parsed.format || "") } }];
    } catch (error) {
      if (/^<svg[\s>]/.test(value)) return [{ role: "source", name: "Pasted SVG source", mime: "image/svg+xml", format: "SVG", text: value, editable: false }];
      if (/(?:^|\s)--[a-z0-9-]+\s*:|\{[^}]*:[^}]*\}/i.test(value)) return [{ role: "source", name: "Pasted CSS source", mime: "text/css", format: "CSS", text: value, editable: false }];
      return [{ role: "source", name: "Pasted text source", mime: "text/plain", format: "TEXT", text: value, editable: false }];
    }
  }
  function brief() {
    return Hands.normalizeBrief({
      id: "workbench-" + String($("briefTitle").value || "asset").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: $("briefTitle").value,
      kind: $("briefKind").value,
      operation_mode: $("operationMode").value,
      target: $("briefTarget").value,
      width: $("briefWidth").value,
      height: $("briefHeight").value,
      purpose: $("briefPurpose").value,
      intended_use: $("intendedUse").value,
      target_canvas: {
        schema: Hands.TARGET_CANVAS_SCHEMA,
        medium: $("canvasMedium").value,
        dimensions: { width: Number($("briefWidth").value), height: Number($("briefHeight").value), depth: optionalNumber("dimensionDepth"), unit: $("canvasUnit").value },
        colour: {
          space: $("colourSpace").value,
          transparency: $("briefTransparent").checked ? "allowed" : "opaque",
          minimum_contrast_ratio: optionalNumber("minimumContrast"),
          printable_colours: $("printableColours").checked,
          profile: optionalText("colourProfile"),
          bit_depth: optionalNumber("bitDepth"),
          alpha_mode: $("alphaMode").value,
          spot_colours: csv("spotColours"),
          total_ink_coverage: optionalNumber("inkCoverage")
        },
        physical: {
          unit: $("canvasUnit").value,
          bleed: optionalNumber("canvasBleed"),
          minimum_stroke: optionalNumber("minimumStroke"),
          cutting_tool_width: optionalNumber("toolWidth"),
          depth: optionalNumber("canvasDepth"),
          repeat: { mode: $("repeatMode").value, width: optionalNumber("repeatWidth"), height: optionalNumber("repeatHeight") },
          material_behaviour: csv("materialBehaviour"),
          tolerance: optionalNumber("physicalTolerance"),
          material_thickness: optionalNumber("materialThickness"),
          kerf_side: $("kerfSide").value,
          grain_direction: optionalText("grainDirection"),
          operations: csv("physicalOperations")
        },
        behaviour: csv("canvasBehaviours"),
        performance: {
          max_file_bytes: optionalNumber("maxFileBytes"),
          max_texture_memory_bytes: optionalNumber("textureMemory"),
          max_polygon_count: optionalNumber("polygonBudget"),
          max_frame_ms: optionalNumber("frameBudget"),
          max_animation_frames: optionalNumber("animationFrames"),
          frames_per_second: optionalNumber("framesPerSecond"),
          max_duration_seconds: optionalNumber("durationBudget"),
          max_vertices: optionalNumber("vertexBudget"),
          max_draw_calls: optionalNumber("drawCallBudget"),
          max_mip_levels: optionalNumber("mipBudget")
        },
        print: {
          dpi: optionalNumber("printDpi"),
          safe_margin: optionalNumber("safeMargin"),
          crop_marks: $("cropMarks").checked,
          registration_marks: $("registrationMarks").checked,
          output_condition: optionalText("outputCondition"),
          font_policy: optionalText("fontPolicy")
        },
        responsive: {
          breakpoints: jsonArray("breakpoints"),
          locale: optionalText("locale"),
          direction: $("direction").value,
          input_modalities: csv("inputModalities"),
          reduced_motion: $("reducedMotion").checked,
          minimum_target_size: optionalNumber("minimumTargetSize"),
          pixel_density: optionalNumber("pixelDensity"),
          zoom_percent: optionalNumber("zoomPercent")
        },
        spatial: {
          up_axis: $("upAxis").value,
          handedness: $("handedness").value,
          origin: numericCsv("spatialOrigin"),
          world_scale: optionalNumber("worldScale"),
          uv_convention: optionalText("uvConvention"),
          tangent_convention: optionalText("tangentConvention"),
          lod_policy: optionalText("lodPolicy"),
          collision: optionalText("collisionPolicy")
        },
        temporal: {
          frame_rate_numerator: optionalNumber("frameRateNumerator"),
          frame_rate_denominator: optionalNumber("frameRateDenominator"),
          drop_frame: $("dropFrame").checked,
          codec: optionalText("temporalCodec"),
          container: optionalText("temporalContainer"),
          captions: optionalText("captionsPolicy")
        },
        accessibility: {
          standard: optionalText("accessibilityStandard"),
          reading_order: $("readingOrder").checked,
          alternative_text: $("alternativeText").checked,
          keyboard: $("keyboardAccess").checked,
          focus_visible: $("focusVisible").checked
        },
        intended_use: $("intendedUse").value
      },
      required_outputs: csv("requiredOutputs"),
      editable_recipe_formats: csv("recipeFormats"),
      source_artifacts: sourceArtifacts(),
      quality_requirements: {
        require_preview: ["inspect", "validate"].indexOf($("operationMode").value) < 0,
        require_validation: true,
        require_editable_source: $("requireEditable").checked
      },
      fallback_policy: { generalist: $("generalistFallback").value, lossy_conversion: $("lossyFallback").value },
      styleTags: $("briefStyle").value.split(","),
      transparent: $("briefTransparent").checked
    });
  }
  function renderRoutes() {
    var request = brief();
    var routes = Hands.routes(request, host);
    var diagnosis = Hands.diagnose(request, host);
    var planned = diagnosis.planned_hands || [];
    $("inventoryCount").textContent = Hands.list().length + " executable · " + Hands.listMissingHands().length + " visible missing";
    $("compatibilityCount").textContent = routes.length + " compatible now · finishing hand available";
    var missing = diagnosis.missing_hand_spec;
    var empty = '<div class="empty"><b>' + esc(diagnosis.status) + '</b> · No installed hand can honestly satisfy this contract.' +
      (missing ? '<br>Needed: ' + esc(missing.operation_modes.join(", ")) + ' ' + esc(missing.kinds.join(", ")) + ' on ' + esc(missing.canvas_types[0].medium) + ' · ' + esc(missing.output_types.join(", ") || "any declared output") + '.' : '') + '</div>' +
      planned.map(function (candidate) {
        return '<article class="hand-route planned"><b>' + esc(candidate.priority + " future · " + candidate.title) + '</b><span>' + esc(candidate.why_missing) + '</span><small>To unlock: ' + esc(candidate.unblock_conditions.join(" · ")) + '</small></article>';
      }).join("");
    $("handRoutes").innerHTML = routes.map(function (route) {
      return '<article class="hand-route ' + (route.score >= 100 ? "exact" : "") + '"><b>' + esc(route.hand.title) + '</b><span>' + esc(route.reason) + ' · ' + esc(route.hand.engine.name) + ' v' + esc(route.hand.version) + '</span></article>';
    }).join("") || empty;
  }
  function preview(result) {
    return result.artifacts.find(function (artifact) { return artifact.id === result.previewArtifactId; }) ||
      result.artifacts.find(function (artifact) { return artifact.mime === "image/svg+xml" || /^image\//.test(artifact.mime); });
  }
  function editableSource(result) {
    return result.artifacts.find(function (artifact) { return artifact.editable && artifact.id !== result.previewArtifactId; }) || result.artifacts[0];
  }
  function previewUrl(artifact) {
    if (!artifact) return "";
    if (artifact.mime === "image/svg+xml" && artifact.format === "SVG") return dataUrl(artifact.text);
    if (/^image\/(?:png|apng|jpeg|webp)$/.test(artifact.mime) && /^data:image\//.test(artifact.dataUrl || "")) return artifact.dataUrl;
    return "";
  }
  function downloadArtifact(artifact) {
    if (artifact.dataUrl) {
      var anchor = document.createElement("a");
      anchor.download = artifact.filename;
      anchor.href = artifact.dataUrl;
      anchor.click();
      return;
    }
    download(artifact.filename, artifact.mime, artifact.text);
  }
  function renderResults() {
    $("results").innerHTML = results.map(function (result) {
      var source = preview(result);
      var url = previewUrl(source);
      var formats = result.artifacts.map(function (artifact) { return artifact.format; }).filter(function (format, index, all) { return all.indexOf(format) === index; });
      var canFinish = result.artifacts.some(function (artifact) { return artifact.mime === "image/svg+xml" && artifact.format === "SVG"; });
      var visual = url ? '<img src="' + url + '" alt="">' : '<span class="no-preview">No visual preview for ' + esc(source && source.mime || "this output") + '</span>';
      return '<article class="card"><div class="preview">' + visual + '</div><div class="card-body"><h3>' + esc(result.brief.title) + '</h3><span class="by">' + esc(result.hand.title) + ' · v' + esc(result.hand.version) + ' · ' + esc(result.target_canvas.medium) + '</span><div class="tags"><span class="tag pass">' + esc(result.validation_receipt.status) + '</span>' + formats.map(function (format) { return '<span class="tag">' + esc(format) + '</span>'; }).join("") + '<span class="tag">' + result.artifacts.length + ' artifact' + (result.artifacts.length === 1 ? '' : 's') + '</span></div><div class="actions"><button data-source="' + result.id + '">Source</button><button data-finish="' + result.id + '" ' + (canFinish ? '' : 'disabled title="No SVG source is available to this raster finisher."') + '>Finish</button><button class="send" data-send="' + result.id + '">' + (window.parent !== window ? 'Send to host' : 'Export result packet') + '</button></div></div></article>';
    }).join("") || '<div class="empty">Create a family to run the compatible hands.</div>';
    Array.from(document.querySelectorAll("[data-source]")).forEach(function (button) {
      button.onclick = function () { var result = results.find(function (item) { return item.id === button.dataset.source; }); downloadArtifact(editableSource(result)); };
    });
    Array.from(document.querySelectorAll("[data-send]")).forEach(function (button) {
      button.onclick = function () {
        var result = results.find(function (item) { return item.id === button.dataset.send; });
        if (window.parent !== window) {
          window.parent.postMessage({ type: "axm-asset-hand-result", schema: Hands.RESULT_SCHEMA, result: result }, "*");
          status("Candidate sent to host for explicit import.");
        } else {
          download(result.brief.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-hand-result.json", "application/json", JSON.stringify(result, null, 2));
          status("Result packet exported.");
        }
      };
    });
    Array.from(document.querySelectorAll("[data-finish]")).forEach(function (button) {
      button.onclick = async function () {
        var result = results.find(function (item) { return item.id === button.dataset.finish; });
        var old = button.textContent;
        button.disabled = true;
        button.textContent = "Working…";
        try {
          var delivery = await Finisher.finish(result, $("deliveryFormat").value);
          window.AXMOutput.download(delivery.output);
          status(delivery.receipt.filename + " finished · receipt " + delivery.receipt.sha256.slice(0, 12));
        } catch (error) { status("Finishing held: " + error.message, true); }
        finally { button.disabled = false; button.textContent = old; }
      };
    });
  }
  async function createFamily() {
    var button=$("createFamily"),old=button.textContent;button.disabled=true;button.textContent="Creating…";status("Creating with compatible local hands…");
    try {
      var family = await Hands.createFamilyAsync(brief(), { host: host, maxHands: 8, seed: "workbench:" + Date.now().toString(36) });
      results = family.results;
      renderResults();
      if (!results.length) status(family.status + ": " + (family.issues[0] ? family.issues[0].message : "No compatible hand result."), true);
      else status(results.length + " compatible hands created candidates" + (family.failures.length ? " · " + family.failures.length + " held" : "") + ".");
    } catch(error) { status("Creation held: "+error.message,true); }
    finally { button.disabled=false;button.textContent=old; }
  }

  Hands.KINDS.forEach(function (kind) { var option = document.createElement("option"); option.value = kind; option.textContent = kind; $("briefKind").appendChild(option); });
  Hands.TARGET_CANVAS_MEDIUMS.forEach(function (medium) { var option = document.createElement("option"); option.value = medium; option.textContent = medium; $("canvasMedium").appendChild(option); });
  var query = new URLSearchParams(location.search);
  $("briefKind").value = query.get("kind") || "icon";
  $("canvasMedium").value = query.get("medium") || "screen";
  var mediumDefaults = {
    "print": ["mm", "cmyk"], "paper": ["mm", "cmyk"], "fabric": ["mm", "srgb"],
    "wood": ["mm", "grayscale"], "metal": ["mm", "grayscale"], "physical-object": ["mm", "grayscale"],
    "3d-surface": ["m", "material-channel"], "game-world": ["px", "srgb"], "ui": ["px", "srgb"], "screen": ["px", "srgb"]
  };
  function applyMediumDefaults(initial) {
    var medium = $("canvasMedium").value, defaults = mediumDefaults[medium] || ["px", "srgb"];
    $("canvasUnit").value = defaults[0];
    $("colourSpace").value = defaults[1];
    if (medium === "3d-surface" && (initial || !$("dimensionDepth").value)) {
      if (initial) { $("briefWidth").value = "1"; $("briefHeight").value = "1"; }
      $("dimensionDepth").value = "1";
    }
  }
  applyMediumDefaults(true);
  $("intendedUse").value = query.get("use") || $("briefKind").value;
  if (query.get("title")) $("briefTitle").value = query.get("title");
  if (query.get("target")) $("briefTarget").value = query.get("target");
  if (query.get("purpose")) $("briefPurpose").value = query.get("purpose");
  if (query.get("outputs")) $("requiredOutputs").value = query.get("outputs");
  if (query.get("editable") === "required") $("requireEditable").checked = true;

  var changeIds = ["briefKind", "operationMode", "briefTransparent", "canvasMedium", "canvasUnit", "colourSpace", "canvasBehaviours", "printableColours", "alphaMode", "repeatMode", "kerfSide", "cropMarks", "registrationMarks", "direction", "reducedMotion", "upAxis", "handedness", "dropFrame", "readingOrder", "alternativeText", "keyboardAccess", "focusVisible", "generalistFallback", "lossyFallback", "requireEditable"];
  var routeInputIds = ["briefTitle", "briefKind", "operationMode", "briefTarget", "briefWidth", "briefHeight", "dimensionDepth", "briefPurpose", "briefStyle", "briefTransparent", "canvasMedium", "intendedUse", "canvasUnit", "colourSpace", "canvasBehaviours", "requiredOutputs", "recipeFormats", "sourceArtifact", "minimumContrast", "printableColours", "colourProfile", "bitDepth", "alphaMode", "spotColours", "inkCoverage", "canvasBleed", "minimumStroke", "toolWidth", "canvasDepth", "repeatMode", "repeatWidth", "repeatHeight", "materialBehaviour", "physicalTolerance", "materialThickness", "kerfSide", "grainDirection", "physicalOperations", "maxFileBytes", "textureMemory", "polygonBudget", "frameBudget", "animationFrames", "framesPerSecond", "durationBudget", "vertexBudget", "drawCallBudget", "mipBudget", "printDpi", "safeMargin", "cropMarks", "registrationMarks", "outputCondition", "fontPolicy", "breakpoints", "locale", "direction", "inputModalities", "reducedMotion", "minimumTargetSize", "pixelDensity", "zoomPercent", "upAxis", "handedness", "spatialOrigin", "worldScale", "uvConvention", "tangentConvention", "lodPolicy", "collisionPolicy", "frameRateNumerator", "frameRateDenominator", "dropFrame", "temporalCodec", "temporalContainer", "captionsPolicy", "accessibilityStandard", "readingOrder", "alternativeText", "keyboardAccess", "focusVisible", "generalistFallback", "lossyFallback", "requireEditable"];
  $("canvasMedium").addEventListener("change", function () { applyMediumDefaults(false); });
  routeInputIds.forEach(function (id) { $(id).addEventListener(changeIds.indexOf(id) >= 0 ? "change" : "input", renderRoutes); });
  $("operationMode").addEventListener("change", function () {
    if (["inspect", "validate"].indexOf(this.value) >= 0 && $("requiredOutputs").value.trim() === "image/svg+xml") $("requiredOutputs").value = "application/json";
    renderRoutes();
  });
  $("createFamily").onclick = function(){createFamily();};
  renderRoutes();
  renderResults();
})();
