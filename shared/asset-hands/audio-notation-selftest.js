#!/usr/bin/env node
"use strict";
const assert = require("assert");
const Hands = require("./asset-hands");
const TargetCanvas = require("./target-canvas");
const Audio = require("./audio-notation-codec");
const Schemas = require("./artifact-schema-catalog");

const createdAt = "2026-07-19T00:00:00Z";
const host = {
  capabilities: ["json", "svg"],
  permissions: [],
  accepts: [
    Hands.RESULT_SCHEMA,
    "application/json",
    "image/svg+xml",
    "audio/midi",
    "application/vnd.recordare.musicxml+xml",
  ],
};
function brief(overrides) {
  return Object.assign(
    {
      id: "audio-device",
      title: "Accessible modular note pads",
      kind: "device-ui",
      operation_mode: "create",
      intended_use: "device-ui",
      target_canvas: {
        medium: "audio-device",
        dimensions: { width: 640, height: 360, unit: "px" },
        colour: {
          space: "srgb",
          transparency: "opaque",
          minimum_contrast_ratio: 4.5,
        },
        temporal: {
          tempo_bpm: 120,
          time_signature_numerator: 4,
          time_signature_denominator: 4,
          ticks_per_quarter: 480,
          midi_channel: 1,
          note_min: 48,
          note_max: 84,
        },
        accessibility: { keyboard: true, focus_visible: true },
        behaviour: ["interactive"],
        performance: { max_duration_seconds: 4, max_file_bytes: 1000000 },
        intended_use: "device-ui",
      },
      required_outputs: [
        "audio/midi",
        "application/vnd.recordare.musicxml+xml",
        "audio-device+json",
      ],
      editable_recipe_formats: ["axm.audio-notation-recipe/v1"],
      quality_requirements: {
        require_preview: true,
        require_validation: true,
        require_editable_source: true,
      },
    },
    overrides || {},
  );
}
function artifact(result, id) {
  const found = result.artifacts.find((item) => item.id === id);
  assert(found, "missing " + id);
  return found;
}
function sequenceSource(value, digest) {
  return {
    id: "sequence-source",
    role: "source",
    mime: "application/json",
    format: "JSON",
    text: JSON.stringify(value),
    digest: digest || "sequence-source-digest",
    editable: true,
    metadata: { schema: "axm.musical-sequence/v1" },
  };
}

(async function () {
  assert(Hands.TARGET_CANVAS_MEDIUMS.includes("audio-device"));
  assert.equal(new Set(Hands.list().map((hand) => hand.id)).size, Hands.list().length);
  assert.equal(Hands.listMissingHands().length, 0);
  assert(!Hands.getMissingHand("audio-notation-device"));
  const canvasInspection = TargetCanvas.inspect(brief().target_canvas);
  assert(canvasInspection.pass, canvasInspection.errors.join(", "));
  assert.equal(canvasInspection.canvas.temporal.tempo_bpm, 120);
  assert.equal(canvasInspection.canvas.temporal.ticks_per_quarter, 480);
  assert(
    !TargetCanvas.inspect(
      Object.assign({}, brief().target_canvas, {
        temporal: { time_signature_denominator: 3 },
      }),
    ).pass,
  );
  assert(
    !TargetCanvas.inspect(
      Object.assign({}, brief().target_canvas, {
        temporal: { note_min: 90, note_max: 40 },
      }),
    ).pass,
  );
  assert(
    Hands.routes(brief(), host).some(
      (route) => route.hand.id === "audio-notation-device",
    ),
  );

  const result = await Hands.createAsync("audio-notation-device", brief(), {
    host,
    createdAt,
    seed: "audio-device",
  });
  assert.equal(result.status, "READY");
  assert(result.technical.pass);
  assert.equal(result.measures.notes, 8);
  assert.equal(result.measures.durationSeconds, 2);
  assert.equal(result.measures.midiTracks, 2);
  assert.equal(result.measures.deviceControls, 8);
  assert(result.measures.contrastRatio >= 4.5);

  const midiArtifact = artifact(result, "standard-midi-file");
  const midiBytes = Audio.bytesFromDataUrl(midiArtifact.dataUrl);
  assert.equal(String.fromCharCode(...midiBytes.slice(0, 4)), "MThd");
  assert.notEqual(String.fromCharCode(...midiBytes.slice(0, 4)), "<svg");
  const midi = Audio.inspectMidi(midiBytes);
  assert(midi.pass, midi.errors.join(", "));
  assert.equal(midi.format, 1);
  assert.equal(midi.trackCount, 2);
  assert.equal(midi.division, 480);
  assert.equal(midi.tempoBpm, 120);
  assert.deepEqual(midi.timeSignature, [4, 4]);
  assert.equal(midi.notes.length, 8);
  assert(
    midi.notes.every((note) => note.duration_ticks > 0 && note.channel === 1),
  );

  const xmlArtifact = artifact(result, "musicxml-score");
  assert.equal(xmlArtifact.mime, "application/vnd.recordare.musicxml+xml");
  assert(xmlArtifact.text.startsWith('<?xml version="1.0"'));
  assert(xmlArtifact.text.includes('<score-partwise version="4.0">'));
  assert(!xmlArtifact.text.includes('<velocity>'));
  assert(!xmlArtifact.text.trimStart().startsWith("<svg"));
  const musicxml = Audio.inspectMusicXml(xmlArtifact.text);
  assert(musicxml.pass, musicxml.errors.join(", "));
  assert.equal(musicxml.notes, 8);
  assert.equal(musicxml.durationTicks, midi.durationTicks);
  assert.equal(musicxml.divisions, midi.division);

  const sequence = JSON.parse(artifact(result, "musical-sequence").text);
  const device = JSON.parse(artifact(result, "audio-device-surface").text);
  const recipe = JSON.parse(artifact(result, "audio-notation-recipe").text);
  const report = JSON.parse(artifact(result, "audio-notation-validation").text);
  assert(Schemas.validate(sequence.schema, sequence).pass);
  assert(Schemas.validate(device.schema, device).pass);
  assert(Schemas.validate(recipe.schema, recipe).pass);
  assert(Schemas.validate(report.schema, report).pass);
  assert.equal(report.status, "PASS");
  assert.equal(report.playback_validation, false);
  assert.equal(device.dimensions.width, 640);
  assert.equal(device.dimensions.height, 360);
  assert(
    device.controls.every(
      (control) =>
        control.key && control.accessible_name && control.tab_index > 0,
    ),
  );
  assert(device.midi_mapping.every((mapping) => mapping.channel === 1));
  assert(recipe.known_limits.some((limit) => /no audio waveform/.test(limit)));

  const proof = await Hands.verifyDeterminismAsync(
    "audio-notation-device",
    brief(),
    { host, createdAt, seed: "audio-device" },
  );
  assert(proof.pass, JSON.stringify(proof));

  const editedSequence = JSON.parse(JSON.stringify(sequence));
  editedSequence.notes[0].midi = 72;
  const edited = await Hands.createAsync(
    "audio-notation-device",
    brief({
      id: "edit-audio-device",
      operation_mode: "edit",
      source_artifacts: [
        sequenceSource(editedSequence, "edited-sequence-digest"),
      ],
    }),
    { host, createdAt, seed: "edit-audio-device" },
  );
  assert.equal(edited.status, "READY");
  assert.equal(
    Audio.inspectMidi(
      Audio.bytesFromDataUrl(artifact(edited, "standard-midi-file").dataUrl),
    ).notes[0].midi,
    72,
  );
  assert.deepEqual(
    JSON.parse(artifact(edited, "audio-notation-recipe").text).provenance
      .source_artifact_digests,
    ["edited-sequence-digest"],
  );

  const validateMidi = brief({
    id: "validate-midi",
    operation_mode: "validate",
    required_outputs: ["audio/midi"],
    editable_recipe_formats: ["axm.audio-notation-recipe/v1"],
    source_artifacts: [
      {
        id: "midi-source",
        role: "source",
        mime: "audio/midi",
        format: "SMF 1",
        dataUrl: midiArtifact.dataUrl,
        digest: "midi-source-digest",
      },
    ],
  });
  const midiValidation = await Hands.createAsync(
    "audio-notation-device",
    validateMidi,
    { host, createdAt, seed: "validate-midi" },
  );
  assert.equal(midiValidation.status, "READY");
  assert.equal(
    artifact(midiValidation, "inspected-midi-source").dataUrl,
    midiArtifact.dataUrl,
  );
  assert.equal(
    JSON.parse(artifact(midiValidation, "audio-notation-validation").text)
      .source.digest,
    "midi-source-digest",
  );

  const inspectXml = brief({
    id: "inspect-musicxml",
    operation_mode: "inspect",
    required_outputs: ["application/vnd.recordare.musicxml+xml"],
    editable_recipe_formats: ["axm.audio-notation-recipe/v1"],
    source_artifacts: [
      {
        id: "musicxml-source",
        role: "source",
        mime: "application/vnd.recordare.musicxml+xml",
        format: "MusicXML 4.0",
        text: xmlArtifact.text,
        digest: "musicxml-source-digest",
        editable: true,
      },
    ],
  });
  const xmlInspection = await Hands.createAsync(
    "audio-notation-device",
    inspectXml,
    { host, createdAt, seed: "inspect-musicxml" },
  );
  assert.equal(xmlInspection.status, "READY");
  assert.equal(
    artifact(xmlInspection, "inspected-musicxml-source").text,
    xmlArtifact.text,
  );

  const corruptMidi = midiBytes.slice();
  corruptMidi[0] = 0;
  assert(!Audio.inspectMidi(corruptMidi).pass);
  const corruptedValidation = await Hands.createAsync(
    "audio-notation-device",
    brief({
      id: "corrupt-midi",
      operation_mode: "validate",
      required_outputs: ["audio/midi"],
      editable_recipe_formats: ["axm.audio-notation-recipe/v1"],
      source_artifacts: [
        {
          id: "corrupt-midi-source",
          role: "source",
          mime: "audio/midi",
          format: "SMF 1",
          dataUrl: Audio.dataUrl("audio/midi", corruptMidi),
          digest: "corrupt-midi",
        },
      ],
    }),
    { host, createdAt, seed: "corrupt-midi" },
  );
  assert.equal(corruptedValidation.status, "HOLD");
  const corruptXml = xmlArtifact.text.replace("</score-partwise>", "");
  assert(!Audio.inspectMusicXml(corruptXml).pass);

  const bounded = brief({
    id: "bounded-audio-duration",
    target_canvas: Object.assign({}, brief().target_canvas, {
      performance: { max_duration_seconds: 0.5, max_file_bytes: 1000000 },
    }),
  });
  const boundedResult = await Hands.createAsync(
    "audio-notation-device",
    bounded,
    { host, createdAt, seed: "bounded-audio-duration" },
  );
  assert.equal(boundedResult.status, "READY");
  assert(boundedResult.measures.durationSeconds <= 0.5);
  assert(boundedResult.measures.notes < result.measures.notes);
  const impossible = brief({
    id: "impossible-audio-duration",
    target_canvas: Object.assign({}, brief().target_canvas, {
      performance: { max_duration_seconds: 0.001, max_file_bytes: 1000000 },
    }),
  });
  const impossibleResult = await Hands.createAsync(
    "audio-notation-device",
    impossible,
    { host, createdAt, seed: "impossible-audio-duration" },
  );
  assert.equal(impossibleResult.status, "HOLD");

  const legacy = Hands.create(
    "ui-component",
    {
      id: "legacy-ui",
      title: "Legacy UI",
      kind: "ui-component",
      intended_use: "ui-component",
      target_canvas: {
        medium: "ui",
        dimensions: { width: 320, height: 180, unit: "px" },
        colour: {
          space: "srgb",
          transparency: "opaque",
          minimum_contrast_ratio: 4.5,
        },
        behaviour: ["static", "interactive"],
        intended_use: "ui-component",
      },
      required_outputs: ["axm.ui-component-spec/v1"],
      editable_recipe_formats: ["axm.ui-component-recipe/v1"],
    },
    { host, createdAt, seed: "legacy-ui" },
  );
  assert.equal(legacy.status, "READY");
  assert(!legacy.artifacts.some((item) => item.mime === "audio/midi"));

  console.log(
    "Asset Hands audio-notation selftest PASS (additive audio-device canvas and musical timing limits, real SMF 1 bytes + independent event parser, real MusicXML 4.0 score + parser, accessible device/MIDI map, cross-format tick equivalence, duration/note-range/contrast/file budgets, edit/inspect/validate/tamper/determinism, honest no-playback boundary, legacy UI)",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
