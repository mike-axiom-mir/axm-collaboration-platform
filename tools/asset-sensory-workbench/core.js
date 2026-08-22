(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMAssetSensoryWorkbenchCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";
  var SESSION_SCHEMA = "axm.asset-sensory-session/v1";
  var EDIT_SCHEMA = "axm.asset-sensory-edit/v1";
  var RECEIPT_SCHEMA = "axm.asset-human-sensory-review-receipt/v1";
  var RECIPE_SCHEMA = "axm.deterministic-animation-recipe/v1";
  var COMPOSITION_SCHEMA = "axm.deterministic-animation-composition/v1";
  var HAND_RESULT_SCHEMA = "axm.asset-hand-result/v1";
  var HAND_ID = "deterministic-animation-fabric";
  var HAND_VERSION = "1.1.0";
  var VERDICTS = ["ACCEPT_FOR_TEST", "REVISE", "REJECT"];
  var IMPRESSIONS = [
    "CLEAR",
    "TOO_FAST",
    "TOO_SLOW",
    "TOO_BUSY",
    "LOW_CONTRAST",
    "UNCOMFORTABLE",
    "UNCERTAIN",
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .reduce(function (out, key) {
          if (value[key] !== undefined) out[key] = stable(value[key]);
          return out;
        }, {});
    }
    return value;
  }

  function canonicalStringify(value) {
    return JSON.stringify(stable(value));
  }

  function digest(value) {
    var input = typeof value === "string" ? value : canonicalStringify(value);
    var hash = 0x811c9dc5;
    for (var i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return "fnv1a32:" + (hash >>> 0).toString(16).padStart(8, "0");
  }

  function findById(items, id, label) {
    var found = (Array.isArray(items) ? items : []).find(function (item) {
      return item && item.id === id;
    });
    if (!found) throw new Error(label + " " + id + " is missing");
    return found;
  }

  function primaryRecipe(document) {
    if (document && document.schema === RECIPE_SCHEMA) return document;
    if (!document || document.schema !== COMPOSITION_SCHEMA) {
      throw new Error("deterministic animation recipe or composition required");
    }
    var source = (document.sources || []).find(function (item) {
      return item && item.id === "primary";
    }) || (document.sources || [])[0];
    if (!source || !source.recipe || source.recipe.schema !== RECIPE_SCHEMA) {
      throw new Error("composition primary recipe is missing");
    }
    return source.recipe;
  }

  function horizontalInstance(document) {
    var recipe = primaryRecipe(document);
    return (recipe.instances || []).find(function (item) {
      return item && (item.id === "horizontal" || item.id === "sway");
    }) || findById(recipe.instances, "horizontal", "horizontal motion instance");
  }

  function verticalInstance(document) {
    var recipe = primaryRecipe(document);
    return (recipe.instances || []).find(function (item) {
      return item && (item.id === "vertical" || item.id === "bob");
    }) || findById(recipe.instances, "vertical", "vertical motion instance");
  }

  function rotationNode(document) {
    var recipe = primaryRecipe(document);
    return (recipe.nodes || []).find(function (item) {
      return item && (item.id === "turn" || item.id === "rotation");
    }) || findById(recipe.nodes, "turn", "rotation node");
  }

  function presentation(document) {
    if (!document.presentation || typeof document.presentation !== "object") {
      throw new Error("presentation is missing");
    }
    return document.presentation;
  }

  function finite(value, label) {
    var number = Number(value);
    if (!Number.isFinite(number)) throw new Error(label + " must be finite");
    return number;
  }

  function exactInteger(value, label) {
    var number = finite(value, label);
    if (!Number.isInteger(number)) throw new Error(label + " must be an integer");
    return number;
  }

  function bounded(value, definition) {
    var number = definition.kind === "integer"
      ? exactInteger(value, definition.id)
      : finite(value, definition.id);
    if (number < definition.min || number > definition.max) {
      throw new Error(
        definition.id + " must remain inside " + definition.min + ".." + definition.max,
      );
    }
    return number;
  }

  function colour(value, definition) {
    var normalized = String(value || "").trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) {
      throw new Error(definition.id + " must be a six-digit hexadecimal colour");
    }
    return normalized;
  }

  var FIELD_DEFINITIONS = {
    "motion.horizontal_amplitude": {
      id: "motion.horizontal_amplitude",
      label: "Horizontal reach",
      kind: "number",
      unit: "px",
      min: 0,
      max: 48,
      step: 0.5,
      read: function (document) {
        return horizontalInstance(document).parameters.amplitude;
      },
      write: function (document, value) {
        horizontalInstance(document).parameters.amplitude = value;
      },
    },
    "motion.vertical_amplitude": {
      id: "motion.vertical_amplitude",
      label: "Vertical lift",
      kind: "number",
      unit: "px",
      min: 0,
      max: 32,
      step: 0.5,
      read: function (document) {
        return verticalInstance(document).parameters.amplitude;
      },
      write: function (document, value) {
        verticalInstance(document).parameters.amplitude = value;
      },
    },
    "motion.cycle_ticks": {
      id: "motion.cycle_ticks",
      label: "Motion cycle",
      kind: "integer",
      unit: "ticks",
      min: 1000,
      max: 96000,
      step: 1000,
      read: function (document) {
        return horizontalInstance(document).parameters.period_ticks;
      },
      write: function (document, value) {
        horizontalInstance(document).parameters.period_ticks = value;
      },
    },
    "motion.rotation_degrees": {
      id: "motion.rotation_degrees",
      label: "Rotation range",
      kind: "number",
      unit: "deg",
      min: 0,
      max: 45,
      step: 0.5,
      read: function (document) {
        return Math.abs(rotationNode(document).output_max);
      },
      write: function (document, value) {
        var node = rotationNode(document);
        node.output_min = -value;
        node.output_max = value;
      },
    },
    "presentation.fill": {
      id: "presentation.fill",
      label: "Asset colour",
      kind: "colour",
      read: function (document) {
        return presentation(document).fill;
      },
      write: function (document, value) {
        presentation(document).fill = value;
      },
    },
    "presentation.background": {
      id: "presentation.background",
      label: "Stage colour",
      kind: "colour",
      read: function (document) {
        return presentation(document).background;
      },
      write: function (document, value) {
        presentation(document).background = value;
      },
    },
    "presentation.stroke": {
      id: "presentation.stroke",
      label: "Edge colour",
      kind: "colour",
      read: function (document) {
        return presentation(document).stroke;
      },
      write: function (document, value) {
        presentation(document).stroke = value;
      },
    },
  };

  function publicFieldDefinition(definition) {
    return {
      id: definition.id,
      label: definition.label,
      kind: definition.kind,
      unit: definition.unit || null,
      min: definition.min === undefined ? null : definition.min,
      max: definition.max === undefined ? null : definition.max,
      step: definition.step === undefined ? null : definition.step,
    };
  }

  function listFields() {
    return Object.keys(FIELD_DEFINITIONS).map(function (id) {
      return publicFieldDefinition(FIELD_DEFINITIONS[id]);
    });
  }

  function validateSource(document) {
    var errors = [];
    if (!document || [RECIPE_SCHEMA, COMPOSITION_SCHEMA].indexOf(document.schema) < 0) {
      errors.push("deterministic animation recipe or composition required");
    }
    if (!document || !document.id) errors.push("source id required");
    if (!document || !document.timebase || !Number.isInteger(document.timebase.duration_ticks)) {
      errors.push("integer duration_ticks required");
    }
    if (!document || !document.presentation || typeof document.presentation !== "object") {
      errors.push("presentation required");
    }
    if (!errors.length) {
      Object.keys(FIELD_DEFINITIONS).forEach(function (id) {
        try {
          FIELD_DEFINITIONS[id].read(document);
        } catch (error) {
          errors.push(error.message);
        }
      });
    }
    return { pass: errors.length === 0, errors: Array.from(new Set(errors)) };
  }

  function readField(document, fieldId) {
    var definition = FIELD_DEFINITIONS[fieldId];
    if (!definition) throw new Error("unsupported edit field " + fieldId);
    return clone(definition.read(document));
  }

  function normalizeFieldValue(definition, value) {
    return definition.kind === "colour" ? colour(value, definition) : bounded(value, definition);
  }

  function sourceBinding(document, options) {
    options = options || {};
    return {
      schema: document.schema,
      id: document.id,
      digest: digest(document),
      result_id: options.result_id || null,
      result_digest: options.result_digest || null,
      artifact_id: options.artifact_id || null,
      artifact_digest: options.artifact_digest || null,
      canonical_digest: options.canonical_digest || digest(document),
    };
  }

  function defaultViewer() {
    return {
      playback_rate: { numerator: 1, denominator: 1 },
      reduced_motion: false,
      reduced_motion_strategy: "none",
      motion_scale: 1,
      high_contrast: false,
      zoom: 1,
    };
  }

  function createSession(document, options) {
    options = options || {};
    var validation = validateSource(document);
    if (!validation.pass) throw new Error(validation.errors.join("; "));
    var source = sourceBinding(document, options.source || {});
    var draftSource = clone(document);
    var sessionSeed = {
      source: source,
      modality: "visual-motion",
      fields: listFields(),
    };
    return {
      schema: SESSION_SCHEMA,
      version: VERSION,
      id: String(options.id || "sensory-session-" + digest(sessionSeed).slice(-8)),
      status: "TEST",
      modality: "visual-motion",
      source: source,
      source_document: clone(document),
      draft_source: draftSource,
      draft_digest: digest(draftSource),
      result_binding: options.result_binding ? clone(options.result_binding) : null,
      source_artifact: options.source_artifact ? clone(options.source_artifact) : null,
      static_preview: options.static_preview ? clone(options.static_preview) : null,
      derived_artifacts: options.derived_artifacts ? clone(options.derived_artifacts) : [],
      edit_contract: {
        schema: "axm.asset-sensory-edit-contract/v1",
        fields: listFields(),
        refusal: "Fields outside this allowlist are MISSING_EDIT_CAPABILITY, never silently applied.",
      },
      edits: [],
      viewer: defaultViewer(),
      human_judgment: null,
      review_history: [],
      authority: {
        installed: false,
        promoted: false,
        canonical: false,
        publishes: false,
      },
    };
  }

  function assertSession(session) {
    if (!session || session.schema !== SESSION_SCHEMA) throw new Error("asset sensory session required");
    if (digest(session.draft_source) !== session.draft_digest) {
      throw new Error("draft source digest mismatch");
    }
  }

  function applyEdit(session, rawEdit) {
    assertSession(session);
    rawEdit = rawEdit || {};
    var definition = FIELD_DEFINITIONS[String(rawEdit.field || "")];
    if (!definition) {
      var missing = new Error("MISSING_EDIT_CAPABILITY: unsupported edit field " + String(rawEdit.field || ""));
      missing.code = "MISSING_EDIT_CAPABILITY";
      throw missing;
    }
    var actorKind = String(rawEdit.actor_kind || rawEdit.actorKind || "human");
    if (["human", "machine", "program"].indexOf(actorKind) < 0) {
      throw new Error("actor kind must be human, machine or program");
    }
    var next = clone(session);
    var previousValue = readField(next.draft_source, definition.id);
    var value = normalizeFieldValue(definition, rawEdit.value);
    var parentDigest = next.draft_digest;
    definition.write(next.draft_source, value);
    var nextDigest = digest(next.draft_source);
    var editBody = {
      schema: EDIT_SCHEMA,
      sequence: next.edits.length + 1,
      field: definition.id,
      previous_value: previousValue,
      value: value,
      actor: {
        kind: actorKind,
        id: String(rawEdit.actor_id || rawEdit.actorId || (actorKind === "human" ? "local-human" : "local-machine")),
      },
      channel: String(rawEdit.channel || (actorKind === "human" ? "human-control" : "machine-api")),
      parent_digest: parentDigest,
      result_digest: nextDigest,
    };
    editBody.id = "sensory-edit-" + digest(editBody).slice(-8);
    next.edits.push(editBody);
    next.draft_digest = nextDigest;
    archiveJudgment(next, "source-edit", {
      previous_draft_digest: parentDigest,
      current_draft_digest: nextDigest,
      viewer_state_digest: digest(next.viewer),
    });
    return next;
  }

  function rationalRate(value) {
    var number = finite(value, "playback rate");
    var allowed = {
      "0.25": { numerator: 1, denominator: 4 },
      "0.5": { numerator: 1, denominator: 2 },
      "1": { numerator: 1, denominator: 1 },
      "1.5": { numerator: 3, denominator: 2 },
      "2": { numerator: 2, denominator: 1 },
    };
    var key = String(number);
    if (!allowed[key]) throw new Error("playback rate must be one of 0.25, 0.5, 1, 1.5 or 2");
    return allowed[key];
  }

  function setViewer(session, patch) {
    assertSession(session);
    patch = patch || {};
    var next = clone(session);
    var previousViewerDigest = digest(next.viewer);
    if (patch.playback_rate !== undefined || patch.playbackRate !== undefined) {
      next.viewer.playback_rate = rationalRate(
        patch.playback_rate === undefined ? patch.playbackRate : patch.playback_rate,
      );
    }
    if (patch.reduced_motion !== undefined || patch.reducedMotion !== undefined) {
      next.viewer.reduced_motion = Boolean(
        patch.reduced_motion === undefined ? patch.reducedMotion : patch.reduced_motion,
      );
      next.viewer.motion_scale = next.viewer.reduced_motion ? 0 : 1;
      next.viewer.reduced_motion_strategy = next.viewer.reduced_motion
        ? "disable-transform-motion"
        : "none";
    }
    if (patch.high_contrast !== undefined || patch.highContrast !== undefined) {
      next.viewer.high_contrast = Boolean(
        patch.high_contrast === undefined ? patch.highContrast : patch.high_contrast,
      );
    }
    if (patch.zoom !== undefined) {
      var zoom = finite(patch.zoom, "zoom");
      if (zoom < 0.5 || zoom > 2) throw new Error("zoom must remain inside 0.5..2");
      next.viewer.zoom = zoom;
    }
    if (next.draft_digest !== session.draft_digest || digest(next.draft_source) !== session.draft_digest) {
      throw new Error("viewer adaptation must not mutate the deterministic draft");
    }
    var nextViewerDigest = digest(next.viewer);
    if (nextViewerDigest !== previousViewerDigest) {
      archiveJudgment(next, "viewer-change", {
        previous_viewer_state_digest: previousViewerDigest,
        current_viewer_state_digest: nextViewerDigest,
        draft_digest: next.draft_digest,
      });
    }
    return next;
  }

  function archiveJudgment(session, reason, boundary) {
    if (!session.human_judgment) return;
    session.review_history = Array.isArray(session.review_history) ? session.review_history : [];
    session.review_history.push({
      schema: "axm.asset-stale-human-sensory-review/v1",
      stale: true,
      stale_reason: reason,
      previous_judgment: clone(session.human_judgment),
      boundary: clone(boundary || {}),
    });
    session.human_judgment = null;
  }

  function cleanText(value, limit) {
    return String(value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, limit);
  }

  function recordHumanJudgment(session, raw) {
    assertSession(session);
    raw = raw || {};
    var verdict = String(raw.verdict || "");
    var impression = String(raw.impression || "");
    if (VERDICTS.indexOf(verdict) < 0) throw new Error("unsupported human verdict");
    if (IMPRESSIONS.indexOf(impression) < 0) throw new Error("unsupported sensory impression");
    var next = clone(session);
    archiveJudgment(next, "superseded-human-review", {
      draft_digest: next.draft_digest,
      viewer_state_digest: digest(next.viewer),
    });
    next.human_judgment = {
      reviewer: { kind: "human", id: cleanText(raw.reviewer_id || raw.reviewerId || "local-human", 100) },
      verdict: verdict,
      impression: impression,
      note: cleanText(raw.note, 1200),
      recorded_at: cleanText(raw.recorded_at || raw.recordedAt || "", 80) || null,
      source_digest: next.source.digest,
      draft_digest: next.draft_digest,
      viewer: clone(next.viewer),
      viewer_state_digest: digest(next.viewer),
      meaning: "Human perception evidence for this candidate and viewer state; not technical validation or promotion.",
    };
    return next;
  }

  function createReceipt(session, technical) {
    assertSession(session);
    if (!session.human_judgment) throw new Error("human judgment required before creating a receipt");
    var body = {
      schema: RECEIPT_SCHEMA,
      version: VERSION,
      session_id: session.id,
      modality: session.modality,
      source: clone(session.source),
      draft: {
        schema: session.draft_source.schema,
        id: session.draft_source.id,
        digest: session.draft_digest,
      },
      result_binding: clone(session.result_binding),
      runtime: {
        id: "asset-sensory-workbench",
        version: VERSION,
        surface: "local-browser",
        scheduler: "requestAnimationFrame",
        frame_pacing_verified: false,
        rolling_buffer_capability: false,
      },
      edits: clone(session.edits),
      viewer: clone(session.viewer),
      viewer_state_digest: digest(session.viewer),
      human_judgment: clone(session.human_judgment),
      stale_review_history_count: (session.review_history || []).length,
      technical: clone(technical || { status: "UNKNOWN", evidence: [] }),
      authority: clone(session.authority),
      truth: "This receipt records bounded human sensory review. ACCEPT_FOR_TEST does not install, promote, canonize or publish the asset.",
    };
    body.id = "sensory-review-" + digest(body).slice(-8);
    body.digest = digest(body);
    return body;
  }

  function machinePatch(session) {
    assertSession(session);
    var patch = {
      schema: "axm.asset-sensory-machine-patch/v1",
      source: clone(session.source),
      result: {
        schema: session.draft_source.schema,
        id: session.draft_source.id,
        digest: session.draft_digest,
      },
      operations: session.edits.map(function (edit) {
        return {
          id: edit.id,
          sequence: edit.sequence,
          field: edit.field,
          previous_value: clone(edit.previous_value),
          value: clone(edit.value),
          parent_digest: edit.parent_digest,
          result_digest: edit.result_digest,
          actor: clone(edit.actor),
          channel: edit.channel,
        };
      }),
      draft_source: clone(session.draft_source),
      roundtrip_source_artifact: roundTripSourceArtifact(session),
      result_binding: clone(session.result_binding),
      stale_review_history: clone(session.review_history || []),
      authority: clone(session.authority),
    };
    patch.digest = digest(patch);
    return patch;
  }

  function inspectHandResult(result) {
    if (!result || result.schema !== HAND_RESULT_SCHEMA) throw new Error("asset hand result required");
    if (!result.hand || result.hand.id !== HAND_ID || result.hand.version !== HAND_VERSION) {
      throw new Error("deterministic-animation-fabric v1.1.0 result required");
    }
    if (result.status !== "READY" || !result.validation_receipt || result.validation_receipt.status !== "PASS") {
      throw new Error("result must be READY with a PASS validation receipt");
    }
    if (result.hand.authority !== "candidate-only") throw new Error("candidate-only hand authority required");
    var artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
    var artifact = artifacts.find(function (item) {
      return item && item.id === "deterministic-motion-composition";
    });
    if (!artifact || artifact.mime !== "application/json" || artifact.editable !== true) {
      throw new Error("editable deterministic-motion-composition artifact required");
    }
    var parsed;
    try {
      parsed = JSON.parse(String(artifact.text || ""));
    } catch (error) {
      throw new Error("composition artifact JSON is invalid");
    }
    var metadataSchema = artifact.metadata && artifact.metadata.schema;
    if (metadataSchema !== COMPOSITION_SCHEMA || parsed.schema !== metadataSchema) {
      var mismatch = new Error("CONTRACT-ARTIFACT-SCHEMA-BRIDGE-001: metadata and parsed schemas disagree");
      mismatch.code = "CONTRACT-ARTIFACT-SCHEMA-BRIDGE-001";
      throw mismatch;
    }
    if (artifact.metadata.digest && digest(parsed) !== artifact.metadata.digest) {
      throw new Error("composition canonical digest mismatch");
    }
    var previewArtifact = artifacts.find(function (item) {
      return item && item.id === result.previewArtifactId;
    });
    if (!previewArtifact || !previewArtifact.metadata || previewArtifact.metadata.static_proof_only !== true) {
      throw new Error("static filmstrip preview truth marker required");
    }
    return {
      document: parsed,
      source: {
        result_id: result.id,
        result_digest: result.digest,
        artifact_id: artifact.id,
        artifact_digest: artifact.digest,
        canonical_digest: artifact.metadata.digest,
      },
      result_binding: {
        schema: result.schema,
        id: result.id,
        digest: result.digest,
        hand: { id: result.hand.id, version: result.hand.version, authority: result.hand.authority },
        status: result.status,
        validation_status: result.validation_receipt.status,
        composition_digest: result.measures && result.measures.compositionDigest,
        bake_digest: result.measures && result.measures.bakeDigest,
        frames_per_second: result.measures && result.measures.framesPerSecond,
        frame_count: result.measures && result.measures.frames,
      },
      source_artifact: {
        id: artifact.id,
        role: "composition",
        name: artifact.name || artifact.filename || "Deterministic motion composition",
        mime: artifact.mime,
        format: artifact.format,
        content_schema: metadataSchema,
        editable: true,
        origin_digest: artifact.digest,
      },
      static_preview: {
        artifact_id: previewArtifact.id,
        label: "Static filmstrip proof",
        static_proof_only: true,
        source_bake_digest: previewArtifact.metadata.source_bake_digest || null,
      },
      derived_artifacts: artifacts.filter(function (item) {
        return item.id !== artifact.id;
      }).map(function (item) {
        return { id: item.id, role: item.role, digest: item.digest, editable: item.editable === true };
      }),
    };
  }

  function ingestHandResult(result, options) {
    var inspected = inspectHandResult(result);
    options = options || {};
    return createSession(inspected.document, {
      id: options.id,
      source: inspected.source,
      result_binding: inspected.result_binding,
      source_artifact: inspected.source_artifact,
      static_preview: inspected.static_preview,
      derived_artifacts: inspected.derived_artifacts,
    });
  }

  function roundTripSourceArtifact(session) {
    assertSession(session);
    var source = session.source_artifact || {};
    return {
      id: source.id || "deterministic-motion-composition",
      role: source.role || (session.draft_source.schema === COMPOSITION_SCHEMA ? "composition" : "recipe"),
      name: source.name || "Edited deterministic motion source",
      mime: source.mime || "application/json",
      format: source.format || "JSON",
      content_schema: session.draft_source.schema,
      editable: true,
      text: canonicalStringify(session.draft_source),
      metadata: {
        source_result_digest: session.source.result_digest,
        origin_artifact_digest: source.origin_digest || session.source.artifact_digest,
        edited_canonical_digest: session.draft_digest,
      },
    };
  }

  function bindRegeneratedResult(session, result) {
    assertSession(session);
    var inspected = inspectHandResult(result);
    if (digest(inspected.document) !== session.draft_digest) {
      throw new Error("regenerated composition differs from the edited draft");
    }
    var next = clone(session);
    next.result_binding = inspected.result_binding;
    next.source_artifact = inspected.source_artifact;
    next.static_preview = inspected.static_preview;
    next.derived_artifacts = inspected.derived_artifacts;
    return next;
  }

  return {
    VERSION: VERSION,
    SESSION_SCHEMA: SESSION_SCHEMA,
    EDIT_SCHEMA: EDIT_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    RECIPE_SCHEMA: RECIPE_SCHEMA,
    COMPOSITION_SCHEMA: COMPOSITION_SCHEMA,
    VERDICTS: VERDICTS.slice(),
    IMPRESSIONS: IMPRESSIONS.slice(),
    canonicalStringify: canonicalStringify,
    digest: digest,
    listFields: listFields,
    validateRecipe: validateSource,
    validateSource: validateSource,
    readField: readField,
    createSession: createSession,
    applyEdit: applyEdit,
    setViewer: setViewer,
    recordHumanJudgment: recordHumanJudgment,
    createReceipt: createReceipt,
    machinePatch: machinePatch,
    inspectHandResult: inspectHandResult,
    ingestHandResult: ingestHandResult,
    roundTripSourceArtifact: roundTripSourceArtifact,
    bindRegeneratedResult: bindRegeneratedResult,
  };
});
