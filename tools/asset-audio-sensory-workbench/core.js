(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AXMAssetAudioSensoryCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";
  var SESSION_SCHEMA = "axm.asset-audio-sensory-session/v1";
  var RESULT_SCHEMA = "axm.asset-hand-result/v1";
  var RECIPE_SCHEMA = "axm.deterministic-audio-recipe/v1";
  var ANALYSIS_SCHEMA = "axm.deterministic-audio-analysis/v1";
  var VERIFICATION_SCHEMA = "axm.deterministic-audio-verification/v1";
  var HAND_ID = "deterministic-audio-fabric";
  var HAND_VERSION = "1.0.0";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      var out = {};
      Object.keys(value).sort().forEach(function (key) { out[key] = stable(value[key]); });
      return out;
    }
    return value;
  }

  function canonicalStringify(value) {
    return JSON.stringify(stable(value));
  }

  function digest(value) {
    var text = typeof value === "string" ? value : canonicalStringify(value);
    var hash = 0x811c9dc5;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return "fnv1a32:" + ("00000000" + hash.toString(16)).slice(-8);
  }

  function invariant(condition, message) {
    if (!condition) throw new Error(message);
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, limit);
  }

  function parseJsonArtifact(artifact, expectedSchema) {
    invariant(artifact && typeof artifact.text === "string", "artifact " + (artifact && artifact.id || "unknown") + " has no JSON text");
    var parsed;
    try { parsed = JSON.parse(artifact.text); }
    catch (error) { throw new Error("artifact " + artifact.id + " contains invalid JSON: " + error.message); }
    invariant(parsed && parsed.schema === expectedSchema, "artifact " + artifact.id + " parsed schema mismatch");
    invariant(artifact.metadata && artifact.metadata.schema === expectedSchema, "artifact " + artifact.id + " metadata.schema mismatch");
    return parsed;
  }

  function findArtifact(result, id) {
    var artifact = (result.artifacts || []).find(function (item) { return item.id === id; });
    invariant(artifact, "required artifact missing: " + id);
    return artifact;
  }

  function bytesFromDataUrl(dataUrl) {
    invariant(typeof dataUrl === "string" && /^data:audio\/wav;base64,/i.test(dataUrl), "WAV artifact must be an audio/wav base64 data URL");
    var base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(base64, "base64"));
    invariant(typeof atob === "function", "base64 decoder unavailable");
    var raw = atob(base64);
    var bytes = new Uint8Array(raw.length);
    for (var index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    return bytes;
  }

  function ascii(bytes, offset, length) {
    var out = "";
    for (var index = 0; index < length; index += 1) out += String.fromCharCode(bytes[offset + index]);
    return out;
  }

  function inspectWav(dataUrl) {
    var bytes = bytesFromDataUrl(dataUrl);
    invariant(bytes.length >= 44, "WAV payload is shorter than a canonical header");
    invariant(ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE", "WAV RIFF header mismatch");
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var offset = 12;
    var format = null;
    var data = null;
    while (offset + 8 <= bytes.length) {
      var id = ascii(bytes, offset, 4);
      var length = view.getUint32(offset + 4, true);
      invariant(offset + 8 + length <= bytes.length, "WAV chunk exceeds payload");
      if (id === "fmt ") {
        invariant(length >= 16, "WAV fmt chunk is too short");
        format = {
          audio_format: view.getUint16(offset + 8, true),
          channels: view.getUint16(offset + 10, true),
          sample_rate: view.getUint32(offset + 12, true),
          byte_rate: view.getUint32(offset + 16, true),
          block_align: view.getUint16(offset + 20, true),
          bits_per_sample: view.getUint16(offset + 22, true)
        };
      }
      if (id === "data") data = { offset: offset + 8, bytes: length };
      offset += 8 + length + (length % 2);
    }
    invariant(format && data, "WAV fmt or data chunk missing");
    invariant(format.audio_format === 1 && format.bits_per_sample === 16, "only PCM16 WAV is supported by this review surface");
    invariant(format.channels >= 1 && format.channels <= 8 && format.sample_rate >= 8000, "WAV channel/sample-rate bounds invalid");
    var frames = data.bytes / format.block_align;
    return {
      bytes: bytes.length,
      data_bytes: data.bytes,
      data_offset: data.offset,
      channels: format.channels,
      sample_rate: format.sample_rate,
      bits_per_sample: format.bits_per_sample,
      frames: frames,
      duration_seconds: frames / format.sample_rate,
      byte_rate: format.byte_rate,
      block_align: format.block_align
    };
  }

  function waveformEnvelope(dataUrl, bins) {
    var bytes = bytesFromDataUrl(dataUrl);
    var wav = inspectWav(dataUrl);
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var frameCount = wav.frames;
    var count = Math.max(16, Math.min(1024, Math.floor(Number(bins) || 240)));
    var out = [];
    for (var bin = 0; bin < count; bin += 1) {
      var start = Math.floor(bin * frameCount / count);
      var end = Math.max(start + 1, Math.floor((bin + 1) * frameCount / count));
      var min = 1;
      var max = -1;
      var sum = 0;
      var samples = 0;
      for (var frame = start; frame < end && frame < frameCount; frame += 1) {
        var mixed = 0;
        for (var channel = 0; channel < wav.channels; channel += 1) {
          var sampleOffset = wav.data_offset + (frame * wav.channels + channel) * 2;
          mixed += view.getInt16(sampleOffset, true) / 32768;
        }
        mixed /= wav.channels;
        min = Math.min(min, mixed);
        max = Math.max(max, mixed);
        sum += mixed * mixed;
        samples += 1;
      }
      out.push({ min: min, max: max, rms: Math.sqrt(sum / Math.max(1, samples)) });
    }
    return out;
  }

  var FIELD_DEFINITIONS = [
    { id: "kind", label: "Source kind", type: "select", options: ["tone", "noise"], keys: ["kind"] },
    { id: "waveform", label: "Waveform", type: "select", options: ["sine", "triangle", "square", "sawtooth"], keys: ["wave", "waveform"] },
    { id: "frequency_hz", label: "Start frequency", type: "number", min: 1, max: 20000, step: 1, unit: "Hz", keys: ["freq", "frequency", "frequency_hz"] },
    { id: "sweep", label: "Frequency sweep", type: "boolean", keys: ["sweep"] },
    { id: "frequency_end_hz", label: "End frequency", type: "number", min: 1, max: 20000, step: 1, unit: "Hz", keys: ["freqEnd", "frequency_end", "frequency_end_hz"] },
    { id: "duration_seconds", label: "Duration", type: "number", min: 0.01, max: 2, step: 0.01, unit: "s", keys: ["dur", "duration", "duration_seconds"] },
    { id: "attack_seconds", label: "Attack", type: "number", min: 0.0001, max: 2, step: 0.0001, unit: "s", keys: ["attack", "attack_seconds"] },
    { id: "gain", label: "Gain", type: "number", min: 0.001, max: 1, step: 0.001, keys: ["gain", "amplitude"] },
    { id: "noise_layer", label: "Noise layer", type: "boolean", keys: ["noise"] },
    { id: "filter_frequency_hz", label: "Noise filter", type: "number", min: 20, max: 20000, step: 10, unit: "Hz", keys: ["filterFreq", "filter_frequency", "filter_frequency_hz"] },
    { id: "noise_gain", label: "Noise gain", type: "number", min: 0.001, max: 1, step: 0.001, keys: ["noiseGain", "noise_gain"] },
    { id: "seed", label: "Seed", type: "text", maxLength: 180, keys: ["seed"], root: true }
  ];

  function recipeParams(recipe) {
    if (recipe.params && typeof recipe.params === "object") return recipe.params;
    if (recipe.sound && recipe.sound.params && typeof recipe.sound.params === "object") return recipe.sound.params;
    if (recipe.sound && typeof recipe.sound === "object") return recipe.sound;
    return recipe;
  }

  function fieldDefinition(id) {
    var definition = FIELD_DEFINITIONS.find(function (item) { return item.id === id; });
    invariant(definition, "unsupported audio edit field: " + id);
    return definition;
  }

  function fieldLocation(recipe, definition, create) {
    var owner = definition.root ? recipe : recipeParams(recipe);
    for (var index = 0; index < definition.keys.length; index += 1) {
      if (Object.prototype.hasOwnProperty.call(owner, definition.keys[index])) return { owner: owner, key: definition.keys[index] };
    }
    if (!create) return null;
    return { owner: owner, key: definition.keys[0] };
  }

  function normalizeField(definition, value) {
    if (definition.type === "select") {
      var text = String(value || "").toLowerCase();
      invariant(definition.options.indexOf(text) >= 0, definition.label + " is unsupported");
      return text;
    }
    if (definition.type === "boolean") return value === true || value === "true" || value === 1 || value === "1";
    if (definition.type === "text") {
      var clean = cleanText(value, definition.maxLength || 180).trim();
      invariant(clean.length > 0, definition.label + " cannot be empty");
      return clean;
    }
    var number = Number(value);
    invariant(Number.isFinite(number), definition.label + " must be finite");
    if (definition.type === "integer") number = Math.round(number);
    invariant(number >= definition.min && number <= definition.max, definition.label + " is outside bounds");
    return number;
  }

  function readField(recipe, id) {
    var definition = fieldDefinition(id);
    var location = fieldLocation(recipe, definition, false);
    return location ? location.owner[location.key] : null;
  }

  function listFields(recipe) {
    return FIELD_DEFINITIONS.map(function (definition) {
      var out = clone(definition);
      delete out.keys;
      delete out.root;
      out.value = readField(recipe, definition.id);
      out.available = out.value != null || ["kind", "duration_seconds", "gain", "seed"].indexOf(definition.id) >= 0;
      return out;
    });
  }

  function validateRecipe(recipe) {
    var errors = [];
    if (!recipe || recipe.schema !== RECIPE_SCHEMA) errors.push("recipe schema mismatch");
    var params = recipe && recipeParams(recipe);
    if (!params || typeof params !== "object") errors.push("recipe params missing");
    var kind = recipe && readField(recipe, "kind");
    if (["tone", "noise"].indexOf(kind) < 0) errors.push("recipe kind unsupported");
    ["duration_seconds", "gain"].forEach(function (id) {
      var value = recipe && readField(recipe, id);
      if (value == null || !Number.isFinite(Number(value))) errors.push(id + " missing");
    });
    return { pass: errors.length === 0, errors: errors };
  }

  function inspectHandResult(result) {
    invariant(result && result.schema === RESULT_SCHEMA, "Asset Hand result schema mismatch");
    invariant(result.hand && result.hand.id === HAND_ID, "unexpected Asset Hand id");
    invariant(result.hand.version === HAND_VERSION, "unexpected Asset Hand version");
    invariant(result.status === "READY", "Asset Hand result is not READY");
    invariant(result.failure_code == null, "Asset Hand result carries a failure code");
    invariant(result.technical && result.technical.pass === true, "Asset Hand technical gate did not pass");
    invariant(result.validation_receipt && result.validation_receipt.status === "PASS", "Asset Hand validation receipt is not PASS");
    var recipeArtifact = findArtifact(result, "deterministic-audio-recipe");
    var wavArtifact = findArtifact(result, "deterministic-audio-wav");
    var analysisArtifact = findArtifact(result, "deterministic-audio-analysis");
    var verificationArtifact = findArtifact(result, "deterministic-audio-verification");
    invariant(recipeArtifact.editable === true, "audio recipe must be editable");
    invariant(wavArtifact.editable === false && wavArtifact.mime === "audio/wav", "WAV delivery must be immutable audio/wav");
    invariant(result.previewArtifactId === wavArtifact.id, "preview pointer must identify the WAV payload");
    invariant(result.preview && result.preview.artifactId === wavArtifact.id && result.preview.available === true, "WAV preview availability pointer is missing");
    var recipe = parseJsonArtifact(recipeArtifact, RECIPE_SCHEMA);
    var analysis = parseJsonArtifact(analysisArtifact, ANALYSIS_SCHEMA);
    var verification = parseJsonArtifact(verificationArtifact, VERIFICATION_SCHEMA);
    var validation = validateRecipe(recipe);
    invariant(validation.pass, validation.errors.join("; "));
    var wav = inspectWav(wavArtifact.dataUrl);
    var wavSha256 = wavArtifact.metadata && (wavArtifact.metadata.sha256 || wavArtifact.metadata.digest);
    invariant(/^[a-f0-9]{64}$/.test(String(wavSha256 || "")), "WAV metadata SHA-256 is missing or invalid");
    if (analysis.sample_rate_hz != null) invariant(Number(analysis.sample_rate_hz) === wav.sample_rate, "analysis sample rate differs from WAV");
    if (analysis.sample_rate != null) invariant(Number(analysis.sample_rate) === wav.sample_rate, "analysis sample rate differs from WAV");
    if (analysis.channels != null) invariant(Number(analysis.channels) === wav.channels, "analysis channels differ from WAV");
    if (analysis.duration_seconds != null) invariant(Math.abs(Number(analysis.duration_seconds) - wav.duration_seconds) < 1 / wav.sample_rate + 1e-9, "analysis duration differs from WAV");
    invariant(analysis.wav_sha256 === wavSha256, "analysis WAV SHA-256 differs from delivery metadata");
    invariant(verification.wav_sha256 === wavSha256, "verification WAV SHA-256 differs from delivery metadata");
    invariant(analysis.recipe_digest === recipeArtifact.metadata.digest, "analysis recipe digest differs from canonical recipe metadata");
    invariant(verification.recipe_digest === recipeArtifact.metadata.digest, "verification recipe digest differs from canonical recipe metadata");
    invariant(verification.status === "PASS", "technical verification artifact is not PASS");
    var falseClaims = ["human_listened", "approved", "playback_verified", "audible_playback_verified", "human_aesthetic_approval", "device_output_verified", "webaudio_sample_identical", "external_wav_conformance"];
    falseClaims.forEach(function (name) {
      if (verification.claims && Object.prototype.hasOwnProperty.call(verification.claims, name)) invariant(verification.claims[name] === false, "technical verification must not claim " + name);
    });
    return {
      result: clone(result),
      recipe_artifact: clone(recipeArtifact),
      wav_artifact: clone(wavArtifact),
      analysis_artifact: clone(analysisArtifact),
      verification_artifact: clone(verificationArtifact),
      recipe: recipe,
      analysis: analysis,
      verification: verification,
      wav: wav,
      wav_sha256: wavSha256,
      artifact_digests: result.artifacts.map(function (item) { return { id: item.id, digest: item.digest, role: item.role, editable: item.editable === true }; })
    };
  }

  function defaultListener() {
    return {
      volume: 0.75,
      playback_rate: 1,
      loop: false,
      muted: false,
      waveform_zoom: 1,
      high_contrast: false,
      output_route: "browser-default-unverified"
    };
  }

  function normalizeListener(current, patch) {
    var next = Object.assign({}, current || defaultListener(), patch || {});
    next.volume = Math.max(0, Math.min(1, Number(next.volume)));
    next.playback_rate = Math.max(0.5, Math.min(2, Number(next.playback_rate)));
    next.loop = next.loop === true;
    next.muted = next.muted === true;
    next.waveform_zoom = Math.max(1, Math.min(8, Number(next.waveform_zoom)));
    next.high_contrast = next.high_contrast === true;
    next.output_route = cleanText(next.output_route || "browser-default-unverified", 120);
    invariant(Number.isFinite(next.volume) && Number.isFinite(next.playback_rate) && Number.isFinite(next.waveform_zoom), "listener state contains non-finite values");
    return next;
  }

  function listenerStateDigest(listener) {
    return digest(normalizeListener(defaultListener(), listener));
  }

  function archiveJudgment(session, reason, boundary) {
    if (!session.human_judgment) return session;
    session.stale_review_history.push({
      schema: "axm.asset-stale-audio-sensory-review/v1",
      stale_reason: reason,
      stale_at_sequence: session.sequence,
      boundary: clone(boundary || {}),
      judgment: clone(session.human_judgment),
      prior_receipt: session.human_receipt ? clone(session.human_receipt) : null
    });
    session.human_judgment = null;
    session.human_receipt = null;
    return session;
  }

  function createSession(result, options) {
    var inspected = inspectHandResult(result);
    var listener = normalizeListener(defaultListener(), options && options.listener);
    return {
      schema: SESSION_SCHEMA,
      id: "audio-session-" + digest(result.digest + ":" + canonicalStringify(listener)).slice(-8),
      version: VERSION,
      sequence: 0,
      source_result: clone(result),
      source_result_digest: result.digest,
      source_recipe: clone(inspected.recipe),
      source_recipe_digest: inspected.recipe_artifact.digest,
      current_result: clone(result),
      current_result_digest: result.digest,
      current_recipe: clone(inspected.recipe),
      current_recipe_digest: inspected.recipe_artifact.digest,
      draft_recipe: clone(inspected.recipe),
      wav_artifact: clone(inspected.wav_artifact),
      wav_sha256: inspected.wav_sha256,
      analysis: clone(inspected.analysis),
      analysis_digest: inspected.analysis_artifact.digest,
      verification: clone(inspected.verification),
      verification_digest: inspected.verification_artifact.digest,
      wav: clone(inspected.wav),
      listener: listener,
      listener_state_digest: listenerStateDigest(listener),
      edits: [],
      pending_edit: null,
      playback_events: [],
      human_judgment: null,
      human_receipt: null,
      stale_review_history: [],
      authority: { installed: false, promoted: false, canonical: false, publishes: false }
    };
  }

  function assertSession(session) {
    invariant(session && session.schema === SESSION_SCHEMA, "audio sensory session required");
  }

  function applyEdit(session, rawEdit) {
    assertSession(session);
    invariant(!session.pending_edit, "a regeneration is already pending");
    var next = clone(session);
    var field = fieldDefinition(rawEdit && rawEdit.field);
    var value = normalizeField(field, rawEdit.value);
    var before = readField(next.draft_recipe, field.id);
    if (canonicalStringify(before) === canonicalStringify(value)) return next;
    var previousDigest = next.current_recipe_digest;
    var location = fieldLocation(next.draft_recipe, field, true);
    location.owner[location.key] = value;
    next.sequence += 1;
    var operation = {
      schema: "axm.asset-audio-edit-operation/v1",
      sequence: next.sequence,
      actor: cleanText(rawEdit.actor || "human", 40),
      channel: cleanText(rawEdit.channel || "human-control", 60),
      field: field.id,
      before: before,
      after: value,
      parent_recipe_digest: previousDigest,
      requested_recipe_digest: digest(next.draft_recipe),
      result_recipe_digest: null,
      result_digest: null
    };
    operation.digest = digest(operation);
    next.edits.push(operation);
    next.pending_edit = clone(operation);
    return next;
  }

  function replaceRecipe(session, recipe, raw) {
    assertSession(session);
    invariant(!session.pending_edit, "a regeneration is already pending");
    var validation = validateRecipe(recipe);
    invariant(validation.pass, validation.errors.join("; "));
    var next = clone(session);
    if (canonicalStringify(next.current_recipe) === canonicalStringify(recipe)) return next;
    var previousDigest = next.current_recipe_digest;
    next.draft_recipe = clone(recipe);
    next.sequence += 1;
    var operation = {
      schema: "axm.asset-audio-edit-operation/v1",
      sequence: next.sequence,
      actor: cleanText(raw && raw.actor || "human", 40),
      channel: cleanText(raw && raw.channel || "recipe-replacement", 60),
      field: "__recipe__",
      before: previousDigest,
      after: digest(next.draft_recipe),
      label: cleanText(raw && raw.label || "replace canonical recipe", 120),
      parent_recipe_digest: previousDigest,
      requested_recipe_digest: digest(next.draft_recipe),
      result_recipe_digest: null,
      result_digest: null
    };
    operation.digest = digest(operation);
    next.edits.push(operation);
    next.pending_edit = clone(operation);
    return next;
  }

  function bindRegeneratedResult(session, result) {
    assertSession(session);
    invariant(session.pending_edit, "no pending edit to bind");
    var inspected = inspectHandResult(result);
    var requestedField = session.pending_edit.field;
    if (requestedField === "__recipe__") invariant(canonicalStringify(inspected.recipe) === canonicalStringify(session.draft_recipe), "regenerated recipe did not preserve the requested replacement");
    else invariant(canonicalStringify(readField(inspected.recipe, requestedField)) === canonicalStringify(session.pending_edit.after), "regenerated recipe did not preserve the requested edit");
    var next = clone(session);
    archiveJudgment(next, "source-change", {
      previous_recipe_digest: next.current_recipe_digest,
      previous_result_digest: next.current_result_digest,
      current_recipe_digest: inspected.recipe_artifact.digest,
      current_result_digest: result.digest
    });
    next.current_result = clone(result);
    next.current_result_digest = result.digest;
    next.current_recipe = clone(inspected.recipe);
    next.current_recipe_digest = inspected.recipe_artifact.digest;
    next.draft_recipe = clone(inspected.recipe);
    next.wav_artifact = clone(inspected.wav_artifact);
    next.wav_sha256 = inspected.wav_sha256;
    next.analysis = clone(inspected.analysis);
    next.analysis_digest = inspected.analysis_artifact.digest;
    next.verification = clone(inspected.verification);
    next.verification_digest = inspected.verification_artifact.digest;
    next.wav = clone(inspected.wav);
    var operation = next.edits[next.edits.length - 1];
    operation.result_recipe_digest = inspected.recipe_artifact.digest;
    operation.result_digest = result.digest;
    operation.digest = digest(Object.assign({}, operation, { digest: undefined }));
    next.pending_edit = null;
    next.playback_events = [];
    return next;
  }

  function cancelPendingEdit(session, reason) {
    assertSession(session);
    if (!session.pending_edit) return clone(session);
    var next = clone(session);
    next.draft_recipe = clone(next.current_recipe);
    next.edits.pop();
    next.pending_edit = null;
    next.last_error = cleanText(reason || "regeneration failed", 400);
    return next;
  }

  function setListener(session, patch) {
    assertSession(session);
    var next = clone(session);
    var previous = next.listener_state_digest;
    var listener = normalizeListener(next.listener, patch);
    var current = listenerStateDigest(listener);
    if (previous === current) return next;
    archiveJudgment(next, "listener-state-change", { previous_listener_state_digest: previous, current_listener_state_digest: current });
    next.sequence += 1;
    next.listener = listener;
    next.listener_state_digest = current;
    return next;
  }

  function recordPlaybackEvent(session, raw) {
    assertSession(session);
    var allowed = ["play-requested", "playing", "pause", "ended", "error"];
    var kind = cleanText(raw && raw.kind, 40);
    invariant(allowed.indexOf(kind) >= 0, "unsupported playback event");
    var next = clone(session);
    next.sequence += 1;
    next.playback_events.push({
      schema: "axm.asset-audio-playback-observation/v1",
      sequence: next.sequence,
      kind: kind,
      artifact_digest: next.wav_artifact.digest,
      wav_sha256: next.wav_sha256,
      listener_state_digest: next.listener_state_digest,
      position_seconds: Math.max(0, Number(raw.position_seconds) || 0),
      duration_seconds: next.wav.duration_seconds,
      trusted_user_gesture: raw.trusted_user_gesture === true,
      physical_audibility_verified: false,
      observed_at_monotonic_ms: Number.isFinite(Number(raw.observed_at_monotonic_ms)) ? Number(raw.observed_at_monotonic_ms) : null,
      error: kind === "error" ? cleanText(raw.error || "playback error", 300) : null
    });
    if (next.playback_events.length > 80) next.playback_events = next.playback_events.slice(-80);
    return next;
  }

  function relevantPlaybackEvents(session) {
    return session.playback_events.filter(function (event) {
      return event.artifact_digest === session.wav_artifact.digest && event.wav_sha256 === session.wav_sha256 && event.listener_state_digest === session.listener_state_digest;
    });
  }

  function recordHumanJudgment(session, raw) {
    assertSession(session);
    invariant(!session.pending_edit, "finish regeneration before reviewing");
    var verdicts = ["ACCEPT_FOR_TEST", "REVISE", "REJECT"];
    var impressions = ["BALANCED", "TOO_LOUD", "TOO_QUIET", "HARSH", "DULL", "TOO_LONG", "TOO_SHORT", "INAUDIBLE", "DEVICE_PROBLEM", "UNCERTAIN"];
    var verdict = cleanText(raw && raw.verdict, 40);
    var impression = cleanText(raw && raw.impression, 40);
    invariant(verdicts.indexOf(verdict) >= 0, "human review verdict is invalid");
    invariant(impressions.indexOf(impression) >= 0, "human listening impression is invalid");
    var events = relevantPlaybackEvents(session);
    invariant(events.some(function (event) { return event.kind === "playing"; }), "recorded playback of the current WAV/listener state is required");
    invariant(raw.heard_as_presented === true || verdict !== "ACCEPT_FOR_TEST", "ACCEPT_FOR_TEST requires an explicit heard-as-presented assertion");
    var next = clone(session);
    archiveJudgment(next, "review-replaced", { current_result_digest: next.current_result_digest, listener_state_digest: next.listener_state_digest });
    next.sequence += 1;
    next.human_judgment = {
      reviewer: cleanText(raw.reviewer || "local-human-reviewer", 100),
      verdict: verdict,
      impression: impression,
      notes: cleanText(raw.notes, 2000),
      heard_as_presented: raw.heard_as_presented === true,
      result_digest: next.current_result_digest,
      recipe_digest: next.current_recipe_digest,
      wav_digest: next.wav_artifact.digest,
      wav_sha256: next.wav_sha256,
      listener_state_digest: next.listener_state_digest,
      playback_event_digests: events.map(digest),
      sequence: next.sequence
    };
    next.human_judgment.digest = digest(next.human_judgment);
    next.human_receipt = createReceipt(next);
    return next;
  }

  function createReceipt(session) {
    assertSession(session);
    invariant(session.human_judgment, "human judgment required");
    var events = relevantPlaybackEvents(session);
    var receipt = {
      schema: "axm.asset-human-audio-sensory-review-receipt/v1",
      id: "audio-review-" + session.id + "-" + session.sequence,
      session_id: session.id,
      modality: "audio",
      source: { result_digest: session.source_result_digest, recipe_digest: session.source_recipe_digest },
      candidate: {
        result_digest: session.current_result_digest,
        recipe_digest: session.current_recipe_digest,
        wav_digest: session.wav_artifact.digest,
        wav_sha256: session.wav_sha256,
        analysis_digest: session.analysis_digest,
        verification_digest: session.verification_digest
      },
      edits: clone(session.edits),
      listener: clone(session.listener),
      listener_state_digest: session.listener_state_digest,
      playback_observation: {
        event_count: events.length,
        saw_playing_event: events.some(function (event) { return event.kind === "playing"; }),
        saw_ended_event: events.some(function (event) { return event.kind === "ended"; }),
        browser_transport_observed: true,
        physical_device_verified: false,
        physical_audibility_verified: false,
        events: clone(events)
      },
      human_judgment: clone(session.human_judgment),
      runtime: {
        id: "asset-audio-sensory-workbench",
        version: VERSION,
        surface: "local-browser-plus-bounded-loopback-host",
        playback_api: "HTMLMediaElement",
        exact_output_device_known: false,
        acoustic_capture_available: false
      },
      authority: clone(session.authority),
      truth: "This receipt binds a human report and browser transport events to exact source, WAV and listener-state digests. It does not prove speakers, headphones, room acoustics, physical audibility, accessibility conformance, approval, promotion or canon."
    };
    receipt.digest = digest(receipt);
    return receipt;
  }

  function roundTripSourceArtifact(session) {
    assertSession(session);
    return {
      schema: "axm.asset-source-artifact/v1",
      id: "deterministic-audio-recipe-source",
      role: "editable-audio-recipe",
      name: "Deterministic audio recipe",
      mime: "application/json",
      format: "json",
      content_schema: RECIPE_SCHEMA,
      editable: true,
      text: canonicalStringify(session.draft_recipe),
      dataUrl: "",
      digest: digest(session.draft_recipe),
      metadata: { schema: RECIPE_SCHEMA, session_digest_only: true }
    };
  }

  function machinePatch(session) {
    assertSession(session);
    var patch = {
      schema: "axm.asset-audio-sensory-machine-patch/v1",
      version: VERSION,
      session_id: session.id,
      source_result_digest: session.source_result_digest,
      current_result_digest: session.current_result_digest,
      source_recipe_digest: session.source_recipe_digest,
      current_recipe_digest: session.current_recipe_digest,
      wav_digest: session.wav_artifact.digest,
      wav_sha256: session.wav_sha256,
      source_artifact: roundTripSourceArtifact(session),
      edits: clone(session.edits),
      listener_state_digest: session.listener_state_digest,
      listener_state_is_source_neutral: true,
      stale_review_history: clone(session.stale_review_history),
      authority: clone(session.authority),
      truth: "Candidate-only edit history; applying it does not install, promote, approve or canonize an asset."
    };
    patch.digest = digest(patch);
    return patch;
  }

  function resetToSource(session) {
    assertSession(session);
    return createSession(session.source_result, { listener: session.listener });
  }

  return {
    VERSION: VERSION,
    SESSION_SCHEMA: SESSION_SCHEMA,
    RESULT_SCHEMA: RESULT_SCHEMA,
    RECIPE_SCHEMA: RECIPE_SCHEMA,
    ANALYSIS_SCHEMA: ANALYSIS_SCHEMA,
    VERIFICATION_SCHEMA: VERIFICATION_SCHEMA,
    HAND_ID: HAND_ID,
    HAND_VERSION: HAND_VERSION,
    canonicalStringify: canonicalStringify,
    digest: digest,
    inspectWav: inspectWav,
    waveformEnvelope: waveformEnvelope,
    inspectHandResult: inspectHandResult,
    validateRecipe: validateRecipe,
    listFields: listFields,
    readField: readField,
    createSession: createSession,
    applyEdit: applyEdit,
    replaceRecipe: replaceRecipe,
    bindRegeneratedResult: bindRegeneratedResult,
    cancelPendingEdit: cancelPendingEdit,
    setListener: setListener,
    listenerStateDigest: listenerStateDigest,
    recordPlaybackEvent: recordPlaybackEvent,
    recordHumanJudgment: recordHumanJudgment,
    createReceipt: createReceipt,
    roundTripSourceArtifact: roundTripSourceArtifact,
    machinePatch: machinePatch,
    resetToSource: resetToSource
  };
});
