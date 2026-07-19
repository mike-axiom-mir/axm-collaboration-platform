(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
      node ? require("../audio-notation-codec") : root.AXMAudioNotationCodec,
    );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register)
    root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (Core, Audio) {
    "use strict";
    if (!Core || !Audio)
      throw new Error("AXM core and audio notation codec are required");
    var SEQUENCE_SCHEMA = "axm.musical-sequence/v1",
      DEVICE_SCHEMA = "audio-device+json",
      RECIPE_SCHEMA = "axm.audio-notation-recipe/v1",
      REPORT_SCHEMA = "axm.audio-notation-validation/v1",
      MUSICXML_MIME = "application/vnd.recordare.musicxml+xml";
    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }
    function luminance(hex) {
      var channels = [1, 3, 5].map(function (index) {
        var value = parseInt(hex.slice(index, index + 2), 16) / 255;
        return value <= 0.04045
          ? value / 12.92
          : Math.pow((value + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }
    function contrast(a, b) {
      var left = luminance(a),
        right = luminance(b);
      return Number(
        (
          (Math.max(left, right) + 0.05) /
          (Math.min(left, right) + 0.05)
        ).toFixed(3),
      );
    }
    function sourceSequence(context) {
      var item = context.sourceArtifacts.find(function (source) {
        return source.content_schema === SEQUENCE_SCHEMA;
      });
      if (!item) return null;
      var value;
      try {
        value = JSON.parse(item.text);
      } catch (error) {
        throw new Error("musical sequence source is not valid JSON");
      }
      if (
        !value ||
        value.schema !== SEQUENCE_SCHEMA ||
        !Array.isArray(value.notes) ||
        !value.notes.length
      )
        throw new Error("musical sequence source is incomplete");
      value.notes.forEach(function (note, index) {
        if (
          !Number.isInteger(note.midi) ||
          note.midi < 0 ||
          note.midi > 127 ||
          !(Number(note.duration_beats) > 0) ||
          !(Number(note.start_beat) >= 0)
        )
          throw new Error("musical sequence note is invalid at index " + index);
      });
      return { item: item, value: value };
    }
    function timing(canvas) {
      var temporal = canvas.temporal || {};
      return {
        tempo: Number(temporal.tempo_bpm) || 120,
        numerator: Number(temporal.time_signature_numerator) || 4,
        denominator: Number(temporal.time_signature_denominator) || 4,
        ppq: Number(temporal.ticks_per_quarter) || 480,
        channel: Number(temporal.midi_channel) || 1,
        noteMin: temporal.note_min == null ? 48 : Number(temporal.note_min),
        noteMax: temporal.note_max == null ? 84 : Number(temporal.note_max),
      };
    }
    function generatedSequence(context) {
      var canvas = context.targetCanvas,
        t = timing(canvas),
        beatSeconds = 60 / t.tempo,
        maxSeconds =
          canvas.performance.max_duration_seconds == null
            ? 4
            : canvas.performance.max_duration_seconds,
        maxTicks = Math.floor((maxSeconds / beatSeconds) * t.ppq),
        noteTicks = Math.max(1, Math.min(Math.round(t.ppq / 2), maxTicks)),
        count = Math.max(1, Math.min(8, Math.floor(maxTicks / noteTicks))),
        pattern = [0, 3, 7, 10, 12, 10, 7, 3],
        base = Math.max(t.noteMin, Math.min(t.noteMax, 60)),
        notes = [];
      for (var index = 0; index < count; index += 1) {
        var pitch = Math.max(
          t.noteMin,
          Math.min(t.noteMax, base + pattern[index % pattern.length]),
        );
        notes.push({
          id: "note-" + (index + 1),
          midi: pitch,
          start_beat: (index * noteTicks) / t.ppq,
          duration_beats: noteTicks / t.ppq,
          velocity: Math.min(120, 88 + index * 4),
        });
      }
      var durationBeats = (count * noteTicks) / t.ppq;
      return {
        schema: SEQUENCE_SCHEMA,
        version: "1.0.0",
        id: "sequence-" + Core.slug(context.brief.id),
        title: context.brief.title,
        target_canvas: clone(canvas),
        tempo_bpm: t.tempo,
        time_signature: [t.numerator, t.denominator],
        ticks_per_quarter: t.ppq,
        midi_channel: t.channel,
        notes: notes,
        duration_seconds: Number((durationBeats * beatSeconds).toFixed(6)),
        provenance: {
          hand: "audio-notation-device",
          hand_version: "1.0.0",
          seed: context.seed,
          source_artifact_digests: [],
        },
      };
    }
    function adaptSequence(context, source) {
      var value = clone(source.value),
        t = timing(context.targetCanvas);
      value.target_canvas = clone(context.targetCanvas);
      value.tempo_bpm = t.tempo;
      value.time_signature = [t.numerator, t.denominator];
      value.ticks_per_quarter = t.ppq;
      value.midi_channel = t.channel;
      var maximum = context.targetCanvas.performance.max_duration_seconds;
      value.notes = value.notes.filter(function (note) {
        return note.midi >= t.noteMin && note.midi <= t.noteMax;
      });
      if (!value.notes.length)
        throw new Error(
          "musical sequence has no notes inside the target canvas note range",
        );
      if (maximum != null)
        value.notes = value.notes.filter(function (note) {
          return (
            ((note.start_beat + note.duration_beats) * 60) / t.tempo <=
            maximum + 0.000001
          );
        });
      if (!value.notes.length)
        throw new Error("musical sequence cannot fit the target duration");
      value.duration_seconds = Number(
        (
          (Math.max.apply(
            null,
            value.notes.map(function (note) {
              return note.start_beat + note.duration_beats;
            }),
          ) *
            60) /
          t.tempo
        ).toFixed(6),
      );
      value.provenance = {
        hand: "audio-notation-device",
        hand_version: "1.0.0",
        seed: context.seed,
        source_artifact_digests: [source.item.digest],
      };
      return value;
    }
    function device(context, sequence) {
      var canvas = context.targetCanvas,
        w = canvas.dimensions.width,
        h = canvas.dimensions.height,
        padding = Math.max(12, Math.min(w, h) * 0.05),
        gap = Math.max(6, Math.min(w, h) * 0.02),
        columns = 4,
        rows = 2,
        cellWidth = (w - padding * 2 - gap * (columns - 1)) / columns,
        cellHeight = (h - padding * 2 - gap * (rows - 1)) / rows,
        keys = ["1", "2", "3", "4", "Q", "W", "E", "R"],
        controls = [];
      for (var index = 0; index < 8; index += 1) {
        var note = sequence.notes[index % sequence.notes.length],
          column = index % columns,
          row = Math.floor(index / columns);
        controls.push({
          id: "pad-" + (index + 1),
          type: "trigger-pad",
          label: "Pad " + (index + 1) + " note " + note.midi,
          accessible_name: "Play MIDI note " + note.midi,
          key: keys[index],
          tab_index: index + 1,
          bounds: {
            x: Number((padding + column * (cellWidth + gap)).toFixed(3)),
            y: Number((padding + row * (cellHeight + gap)).toFixed(3)),
            width: Number(cellWidth.toFixed(3)),
            height: Number(cellHeight.toFixed(3)),
            unit: "px",
          },
          midi: {
            channel: sequence.midi_channel,
            note: note.midi,
            velocity: note.velocity,
          },
        });
      }
      return {
        schema: DEVICE_SCHEMA,
        version: "1.0.0",
        id: "device-" + Core.slug(context.brief.id),
        name: context.brief.title + " device surface",
        target_canvas: clone(canvas),
        dimensions: { width: w, height: h, unit: "px" },
        colours: {
          background: "#07131d",
          foreground: "#ffffff",
          control: "#6ee5d2",
          control_text: "#000000",
          focus: "#ffffff",
        },
        contrast_ratio: contrast("#07131d", "#ffffff"),
        behaviour: canvas.behaviour.slice(),
        controls: controls,
        midi_mapping: controls.map(function (control) {
          return {
            control_id: control.id,
            channel: control.midi.channel,
            note: control.midi.note,
            keyboard_key: control.key,
          };
        }),
        accessibility: {
          keyboard: true,
          focus_visible: true,
          accessible_names: true,
          minimum_target_size_px: Number(
            Math.min(cellWidth, cellHeight).toFixed(3),
          ),
          requested_keyboard: canvas.accessibility.keyboard,
          requested_focus_visible: canvas.accessibility.focus_visible,
        },
        provenance: {
          hand: "audio-notation-device",
          hand_version: "1.0.0",
          seed: context.seed,
          source_artifact_digests: context.sourceArtifacts.map(function (item) {
            return item.digest;
          }),
        },
      };
    }
    function preview(context, value) {
      var w = context.brief.canvas.width,
        h = context.brief.canvas.height,
        sx = w / value.dimensions.width,
        sy = h / value.dimensions.height,
        controls = value.controls
          .map(function (control) {
            var b = control.bounds;
            return (
              '<g role="button" tabindex="' +
              control.tab_index +
              '" aria-label="' +
              Core.escapeXml(control.accessible_name) +
              '"><rect x="' +
              (b.x * sx).toFixed(2) +
              '" y="' +
              (b.y * sy).toFixed(2) +
              '" width="' +
              (b.width * sx).toFixed(2) +
              '" height="' +
              (b.height * sy).toFixed(2) +
              '" rx="8" fill="' +
              value.colours.control +
              '" stroke="' +
              value.colours.focus +
              '" stroke-width="2"/><text x="' +
              ((b.x + b.width / 2) * sx).toFixed(2) +
              '" y="' +
              ((b.y + b.height / 2) * sy).toFixed(2) +
              '" text-anchor="middle" dominant-baseline="middle" fill="' +
              value.colours.control_text +
              '" font-family="system-ui" font-size="12">' +
              Core.escapeXml(control.key + " · " + control.midi.note) +
              "</text></g>"
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
        '" role="img" aria-label="Accessible MIDI device surface preview"><rect width="100%" height="100%" fill="' +
        value.colours.background +
        '"/>' +
        controls +
        "</svg>"
      );
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
    function generated(context) {
      var source = sourceSequence(context),
        sequence = source
          ? adaptSequence(context, source)
          : generatedSequence(context),
        t = {
          tempo: sequence.tempo_bpm,
          ppq: sequence.ticks_per_quarter,
          channel: sequence.midi_channel,
          numerator: sequence.time_signature[0],
          denominator: sequence.time_signature[1],
          notes: sequence.notes,
          title: sequence.title,
        },
        midi = Audio.makeMidi(t),
        musicxml = Audio.makeMusicXml(t),
        surface = device(context, sequence),
        svg = preview(context, surface),
        canvas = context.targetCanvas,
        sequenceText = JSON.stringify(sequence, null, 2),
        deviceText = JSON.stringify(surface, null, 2),
        totalBytes =
          midi.byteLength +
          musicxml.byteLength +
          sequenceText.length +
          deviceText.length +
          svg.length,
        minimumContrast = canvas.colour.minimum_contrast_ratio || 1,
        refreshFps = canvas.performance.frames_per_second || null,
        sourceRecord = source
          ? {
              id: source.item.id,
              digest: source.item.digest,
              schema: SEQUENCE_SCHEMA,
            }
          : null,
        checks = [
          {
            name: "standard-midi-file-structure",
            pass: midi.inspection.pass,
            details: midi.inspection,
          },
          {
            name: "musicxml-4-score-structure",
            pass: musicxml.inspection.pass,
            details: musicxml.inspection,
          },
          {
            name: "midi-musicxml-note-and-timing-equivalence",
            pass:
              midi.inspection.notes.length === musicxml.inspection.notes &&
              midi.inspection.durationTicks ===
                musicxml.inspection.durationTicks &&
              midi.inspection.division === musicxml.inspection.divisions,
          },
          {
            name: "duration-budget",
            pass:
              canvas.performance.max_duration_seconds == null ||
              sequence.duration_seconds <=
                canvas.performance.max_duration_seconds + 0.000001,
            details: {
              actual: sequence.duration_seconds,
              maximum: canvas.performance.max_duration_seconds,
            },
          },
          {
            name: "note-range",
            pass: sequence.notes.every(function (note) {
              return (
                note.midi >= timing(canvas).noteMin &&
                note.midi <= timing(canvas).noteMax
              );
            }),
            details: {
              minimum: timing(canvas).noteMin,
              maximum: timing(canvas).noteMax,
            },
          },
          {
            name: "device-dimensions",
            pass:
              surface.dimensions.width === canvas.dimensions.width &&
              surface.dimensions.height === canvas.dimensions.height,
          },
          {
            name: "device-contrast",
            pass: surface.contrast_ratio >= minimumContrast,
            details: {
              actual: surface.contrast_ratio,
              minimum: minimumContrast,
            },
          },
          {
            name: "keyboard-and-focus-accessibility",
            pass:
              (!canvas.accessibility.keyboard ||
                surface.accessibility.keyboard) &&
              (!canvas.accessibility.focus_visible ||
                surface.accessibility.focus_visible) &&
              surface.controls.every(function (control) {
                return !!control.key && !!control.accessible_name;
              }),
          },
          {
            name: "device-refresh-rate",
            pass: refreshFps == null || refreshFps > 0,
            details: { frames_per_second: refreshFps },
          },
          {
            name: "file-budget",
            pass:
              canvas.performance.max_file_bytes == null ||
              totalBytes <= canvas.performance.max_file_bytes,
            details: {
              actual: totalBytes,
              maximum: canvas.performance.max_file_bytes,
            },
          },
          {
            name: "playback-claim-is-not-made",
            pass: true,
            details: { playback_validation: false },
          },
        ],
        recipe = {
          schema: RECIPE_SCHEMA,
          version: "1.0.0",
          id: "audio-notation-" + Core.slug(context.brief.id),
          target_canvas: clone(canvas),
          operation: context.operationMode,
          source: sourceRecord,
          sequence: {
            schema: SEQUENCE_SCHEMA,
            notes: sequence.notes.length,
            duration_seconds: sequence.duration_seconds,
            digest: Core.hash(sequenceText),
          },
          device: {
            schema: DEVICE_SCHEMA,
            controls: surface.controls.length,
            digest: Core.hash(deviceText),
          },
          deliveries: [
            {
              mime: "audio/midi",
              format: "SMF 1",
              bytes: midi.byteLength,
              notes: midi.inspection.notes.length,
            },
            {
              mime: MUSICXML_MIME,
              format: "MusicXML 4.0",
              bytes: musicxml.byteLength,
              notes: musicxml.inspection.notes,
            },
          ],
          timing: {
            tempo_bpm: sequence.tempo_bpm,
            time_signature: sequence.time_signature,
            ticks_per_quarter: sequence.ticks_per_quarter,
            midi_channel: sequence.midi_channel,
            refresh_fps: refreshFps,
          },
          budgets: {
            duration_seconds: sequence.duration_seconds,
            max_duration_seconds: canvas.performance.max_duration_seconds,
            total_bytes: totalBytes,
            max_file_bytes: canvas.performance.max_file_bytes,
          },
          claims: [
            "Standard MIDI File format 1 with tempo/time-signature and paired note-on/note-off events",
            "MusicXML 4.0 score-partwise notation",
            "keyboard-labelled accessible device control map",
          ],
          known_limits: [
            "no audio waveform is synthesized or rendered",
            "playback, sound-font choice and audible quality are not validated",
            "bounded monophonic piano-note sequence with one MIDI channel",
            "no ties, tuplets, lyrics, articulations, dynamics, pedal, MPE or MIDI 2.0 UMP",
            "MusicXML is structurally inspected locally; external music-notation application validation is not bundled",
          ],
          provenance: {
            hand: "audio-notation-device",
            hand_version: "1.0.0",
            codec_version: Audio.VERSION,
            seed: context.seed,
            source_artifact_digests: context.sourceArtifacts.map(
              function (item) {
                return item.digest;
              },
            ),
          },
        },
        report = {
          schema: REPORT_SCHEMA,
          version: "1.0.0",
          status: checks.every(function (check) {
            return check.pass;
          })
            ? "PASS"
            : "HOLD",
          claim:
            "playback-independent structural and timing validation of Standard MIDI File 1, MusicXML 4.0 and an accessible device/MIDI map; no audio playback was executed",
          target_canvas: clone(canvas),
          operation: context.operationMode,
          source: sourceRecord,
          timing: recipe.timing,
          midi: midi.inspection,
          musicxml: musicxml.inspection,
          device: {
            schema: DEVICE_SCHEMA,
            controls: surface.controls.length,
            contrast_ratio: surface.contrast_ratio,
            keyboard: surface.accessibility.keyboard,
            focus_visible: surface.accessibility.focus_visible,
          },
          budgets: recipe.budgets,
          playback_validation: false,
          checks: checks,
        },
        slug = Core.slug(context.brief.title);
      return {
        artifacts: [
          {
            id: "standard-midi-file",
            role: "standard-midi-file",
            name: context.brief.title + " MIDI",
            filename: slug + ".mid",
            mime: "audio/midi",
            format: "SMF 1",
            editable: false,
            dataUrl: midi.dataUrl,
            metadata: {
              schema: "StandardMIDIFile.1",
              tracks: midi.inspection.trackCount,
              notes: midi.inspection.notes.length,
              ppq: midi.inspection.division,
            },
          },
          {
            id: "musicxml-score",
            role: "musicxml-score",
            name: context.brief.title + " MusicXML",
            filename: slug + ".musicxml",
            mime: MUSICXML_MIME,
            format: "MusicXML 4.0",
            editable: true,
            text: musicxml.text,
            metadata: {
              schema: "MusicXML.4.0",
              notes: musicxml.inspection.notes,
            },
          },
          jsonArtifact(
            "musical-sequence",
            "editable-musical-sequence",
            context.brief.title + " musical sequence",
            slug + "-sequence.json",
            sequence,
            true,
          ),
          jsonArtifact(
            "audio-device-surface",
            "editable-audio-device-surface",
            context.brief.title + " device surface",
            slug + "-device.json",
            surface,
            true,
          ),
          jsonArtifact(
            "audio-notation-recipe",
            "editable-audio-notation-recipe",
            context.brief.title + " audio notation recipe",
            slug + "-audio-recipe.json",
            recipe,
            true,
          ),
          jsonArtifact(
            "audio-notation-validation",
            "audio-notation-validation",
            context.brief.title + " audio notation validation",
            slug + "-audio-validation.json",
            report,
            false,
          ),
          {
            id: "audio-device-preview",
            role: "audio-device-preview",
            name: context.brief.title + " device preview",
            filename: slug + "-device.svg",
            mime: "image/svg+xml",
            format: "SVG",
            editable: false,
            text: svg,
            width: context.brief.canvas.width,
            height: context.brief.canvas.height,
            metadata: { deviceSurface: true, notAudio: true },
          },
        ],
        previewArtifactId: "audio-device-preview",
        recipe: {
          format: RECIPE_SCHEMA,
          parameters: recipe,
          steps: [
            { op: "derive-musical-timing-and-note-range-from-target-canvas" },
            { op: "shape-sequence-to-duration-budget" },
            { op: "encode-standard-midi-file-format-1" },
            { op: "author-musicxml-4-score-partwise" },
            { op: "build-keyboard-accessible-device-midi-map" },
            { op: "validate-containers-timing-contrast-and-file-budget" },
          ],
        },
        validationChecks: checks,
        measures: {
          notes: sequence.notes.length,
          durationSeconds: sequence.duration_seconds,
          midiTracks: midi.inspection.trackCount,
          midiBytes: midi.byteLength,
          musicXmlBytes: musicxml.byteLength,
          deviceControls: surface.controls.length,
          contrastRatio: surface.contrast_ratio,
          totalBytes: totalBytes,
        },
        notes: [
          "MIDI and MusicXML are genuine musical interchange artifacts and are never treated as SVG or raster images.",
          "The device JSON describes controls and mappings; the SVG is only its visual preview. No audio waveform or playback-success claim is emitted.",
        ],
      };
    }
    function inspectExisting(context) {
      var item = context.sourceArtifacts.find(function (source) {
        return source.mime === "audio/midi" || source.mime === MUSICXML_MIME;
      });
      if (!item)
        throw new Error(
          "audio inspect/validate requires MIDI or MusicXML source",
        );
      var isMidi = item.mime === "audio/midi",
        midi = isMidi ? Audio.inspectMidi(item.dataUrl) : null,
        musicxml = isMidi ? null : Audio.inspectMusicXml(item.text),
        inspection = midi || musicxml,
        tempo = inspection.tempoBpm || 120,
        division = inspection.division || inspection.divisions || 480,
        duration = Number(
          (((inspection.durationTicks / division) * 60) / tempo).toFixed(6),
        ),
        canvas = context.targetCanvas,
        requestedTiming = timing(canvas),
        fileBytes = isMidi
          ? Audio.bytesFromDataUrl(item.dataUrl).length
          : item.text.length,
        checks = [
          {
            name: isMidi
              ? "standard-midi-file-structure"
              : "musicxml-4-score-structure",
            pass: inspection.pass,
            details: inspection,
          },
          {
            name: "target-canvas-musical-timing",
            pass:
              (canvas.temporal.tempo_bpm == null ||
                Math.abs(tempo - requestedTiming.tempo) < 0.001) &&
              (canvas.temporal.ticks_per_quarter == null ||
                division === requestedTiming.ppq) &&
              (canvas.temporal.time_signature_numerator == null ||
                (inspection.timeSignature &&
                  inspection.timeSignature[0] === requestedTiming.numerator)) &&
              (canvas.temporal.time_signature_denominator == null ||
                (inspection.timeSignature &&
                  inspection.timeSignature[1] ===
                    requestedTiming.denominator)) &&
              (!isMidi ||
                canvas.temporal.midi_channel == null ||
                inspection.notes.every(function (note) {
                  return note.channel === requestedTiming.channel;
                })),
            details: {
              actual: {
                tempo_bpm: tempo,
                time_signature: inspection.timeSignature,
                ticks_per_quarter: division,
              },
              requested: requestedTiming,
            },
          },
          {
            name: "target-canvas-note-range",
            pass:
              !isMidi ||
              inspection.notes.every(function (note) {
                return (
                  note.midi >= requestedTiming.noteMin &&
                  note.midi <= requestedTiming.noteMax
                );
              }),
            details: {
              minimum: requestedTiming.noteMin,
              maximum: requestedTiming.noteMax,
            },
          },
          {
            name: "duration-budget",
            pass:
              canvas.performance.max_duration_seconds == null ||
              duration <= canvas.performance.max_duration_seconds + 0.000001,
            details: {
              actual: duration,
              maximum: canvas.performance.max_duration_seconds,
            },
          },
          {
            name: "file-budget",
            pass:
              canvas.performance.max_file_bytes == null ||
              fileBytes <= canvas.performance.max_file_bytes,
            details: {
              actual: fileBytes,
              maximum: canvas.performance.max_file_bytes,
            },
          },
          {
            name: "source-preserved",
            pass: true,
            details: { digest: item.digest },
          },
          {
            name: "playback-claim-is-not-made",
            pass: true,
            details: { playback_validation: false },
          },
        ],
        sourceRecord = { id: item.id, digest: item.digest, mime: item.mime },
        recipe = {
          schema: RECIPE_SCHEMA,
          version: "1.0.0",
          id: "inspect-audio-" + Core.slug(context.brief.id),
          target_canvas: clone(canvas),
          operation: context.operationMode,
          source: sourceRecord,
          sequence: null,
          device: null,
          deliveries: [
            { mime: item.mime, format: item.format, bytes: fileBytes },
          ],
          timing: {
            tempo_bpm: tempo,
            ticks_per_quarter: division,
            duration_seconds: duration,
          },
          budgets: {
            duration_seconds: duration,
            max_duration_seconds: canvas.performance.max_duration_seconds,
            total_bytes: fileBytes,
            max_file_bytes: canvas.performance.max_file_bytes,
          },
          claims: ["source container parsed without playback"],
          known_limits: [
            "inspection preserves the source and does not repair, rescore, synthesize or play it",
            "cross-format equivalence requires both source forms and is not inferred from one container",
          ],
          provenance: {
            hand: "audio-notation-device",
            hand_version: "1.0.0",
            codec_version: Audio.VERSION,
            seed: context.seed,
            source_artifact_digests: [item.digest],
          },
        },
        report = {
          schema: REPORT_SCHEMA,
          version: "1.0.0",
          status: checks.every(function (check) {
            return check.pass;
          })
            ? "PASS"
            : "HOLD",
          claim:
            "playback-independent structural inspection of the supplied musical interchange source; no synthesis or audible validation was executed",
          target_canvas: clone(canvas),
          operation: context.operationMode,
          source: sourceRecord,
          timing: recipe.timing,
          midi: midi,
          musicxml: musicxml,
          device: null,
          budgets: recipe.budgets,
          playback_validation: false,
          checks: checks,
        },
        slug = Core.slug(context.brief.title),
        preview =
          '<svg xmlns="http://www.w3.org/2000/svg" width="' +
          context.brief.canvas.width +
          '" height="' +
          context.brief.canvas.height +
          '" viewBox="0 0 ' +
          context.brief.canvas.width +
          " " +
          context.brief.canvas.height +
          '" role="img" aria-label="Musical interchange inspection preview"><rect width="100%" height="100%" fill="#07131d"/><text x="50%" y="45%" text-anchor="middle" fill="#fff" font-family="system-ui" font-size="20">' +
          (isMidi ? "MIDI SMF 1" : "MusicXML 4.0") +
          '</text><text x="50%" y="58%" text-anchor="middle" fill="#6ee5d2" font-family="system-ui" font-size="14">' +
          inspection.notes +
          " notes · " +
          duration +
          " seconds · playback not run</text></svg>",
        preserved = isMidi
          ? {
              id: "inspected-midi-source",
              role: "inspected-midi-source",
              name: context.brief.title + " MIDI source",
              filename: slug + "-inspected.mid",
              mime: "audio/midi",
              format: "SMF 1",
              editable: false,
              dataUrl: item.dataUrl,
              metadata: {
                schema: "StandardMIDIFile.1",
                sourceDigest: item.digest,
              },
            }
          : {
              id: "inspected-musicxml-source",
              role: "inspected-musicxml-source",
              name: context.brief.title + " MusicXML source",
              filename: slug + "-inspected.musicxml",
              mime: MUSICXML_MIME,
              format: "MusicXML 4.0",
              editable: true,
              text: item.text,
              metadata: { schema: "MusicXML.4.0", sourceDigest: item.digest },
            };
      return {
        artifacts: [
          preserved,
          jsonArtifact(
            "audio-notation-recipe",
            "editable-audio-notation-recipe",
            context.brief.title + " inspection recipe",
            slug + "-inspection-recipe.json",
            recipe,
            true,
          ),
          jsonArtifact(
            "audio-notation-validation",
            "audio-notation-validation",
            context.brief.title + " inspection validation",
            slug + "-inspection-validation.json",
            report,
            false,
          ),
          {
            id: "audio-inspection-preview",
            role: "audio-inspection-preview",
            name: context.brief.title + " inspection preview",
            filename: slug + "-inspection.svg",
            mime: "image/svg+xml",
            format: "SVG",
            editable: false,
            text: preview,
            width: context.brief.canvas.width,
            height: context.brief.canvas.height,
          },
        ],
        previewArtifactId: "audio-inspection-preview",
        recipe: {
          format: RECIPE_SCHEMA,
          parameters: recipe,
          steps: [
            {
              op: isMidi
                ? "parse-midi-header-tracks-vlq-and-note-pairs"
                : "parse-musicxml-score-parts-notes-and-timing",
            },
            { op: "validate-duration-and-file-budget" },
            { op: "preserve-source-without-repair-or-playback" },
          ],
        },
        validationChecks: checks,
        measures: {
          notes: inspection.notes,
          durationSeconds: duration,
          sourceBytes: fileBytes,
        },
        notes: [
          "The supplied source is preserved byte-for-byte/text-for-text and is not silently repaired.",
        ],
      };
    }
    return {
      descriptor: {
        schema: Core.HAND_SCHEMA,
        contract_version: "2.0",
        id: "audio-notation-device",
        title: "Audio, MIDI & Notation Hand",
        version: "1.0.0",
        category: "audio-notation-device",
        lifecycle_status: "beta",
        summary:
          "Creates genuine Standard MIDI File 1, MusicXML 4.0 notation and an accessible keyboard-labelled device/MIDI map from an audio-device target canvas.",
        purpose:
          "Represent musical timing, notation and controller semantics as first-class technological assets instead of pretending they are visual pixels or rendered audio.",
        operation_modes: ["create", "edit", "inspect", "validate"],
        canvas_models: ["audio-device", "timeline", "procedural-graph"],
        entry_surfaces: [
          "command",
          "audio-studio",
          "asset-fabric",
          "studio-handoff",
          "export-recipe",
        ],
        mutability: "transform",
        kinds: [
          "device-ui",
          "midi-map",
          "notation",
          "score",
          "music",
          "audio-device",
        ],
        accepts: [
          Core.BRIEF_SCHEMA,
          SEQUENCE_SCHEMA,
          "audio/midi",
          MUSICXML_MIME,
        ],
        produces: [
          Core.RESULT_SCHEMA,
          "audio/midi",
          MUSICXML_MIME,
          DEVICE_SCHEMA,
          SEQUENCE_SCHEMA,
          "application/json",
          "image/svg+xml",
          RECIPE_SCHEMA,
          REPORT_SCHEMA,
        ],
        input_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: SEQUENCE_SCHEMA,
            roles: ["source"],
            required_for: ["edit"],
            mutable: false,
            max_bytes: 2000000,
          },
          {
            mime: "audio/midi",
            format: "SMF 1",
            roles: ["source"],
            required_for: ["inspect", "validate"],
            mutable: false,
            max_bytes: 10000000,
          },
          {
            mime: MUSICXML_MIME,
            format: "MUSICXML 4.0",
            roles: ["source"],
            required_for: ["inspect", "validate"],
            mutable: false,
            max_bytes: 10000000,
          },
        ],
        output_types: [
          {
            mime: "audio/midi",
            format: "SMF 1",
            schema: "StandardMIDIFile.1",
            role: "standard-midi-file",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: MUSICXML_MIME,
            format: "MUSICXML 4.0",
            schema: "MusicXML.4.0",
            role: "musicxml-score",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: SEQUENCE_SCHEMA,
            role: "editable-musical-sequence",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: DEVICE_SCHEMA,
            role: "editable-audio-device-surface",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: RECIPE_SCHEMA,
            role: "editable-audio-notation-recipe",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: REPORT_SCHEMA,
            role: "audio-notation-validation",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "image/svg+xml",
            format: "SVG",
            role: "audio-device-or-inspection-preview",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: [
              "visual preview cannot represent sound or prove playback",
            ],
          },
        ],
        canvas_types: [
          {
            medium: "audio-device",
            units: ["px"],
            colour_spaces: ["srgb", "grayscale"],
            transparency_modes: ["opaque"],
            behaviours: ["interactive", "animated"],
            intended_uses: [
              "device-ui",
              "midi-map",
              "notation",
              "score",
              "music",
              "audio-device",
            ],
          },
        ],
        canvas_limits: {
          min_width: 160,
          min_height: 100,
          max_width: 4096,
          max_height: 4096,
          max_pixels: 16777216,
        },
        constraints_honoured: [
          "dimensions",
          "dimensions.unit",
          "colour.space",
          "colour.transparency",
          "colour.contrast",
          "behaviour.interactive",
          "behaviour.animated",
          "performance.max-file-bytes",
          "performance.max-duration-seconds",
          "performance.frames-per-second",
          "temporal.frame-rate-numerator",
          "temporal.frame-rate-denominator",
          "temporal.tempo-bpm",
          "temporal.time-signature-numerator",
          "temporal.time-signature-denominator",
          "temporal.ticks-per-quarter",
          "temporal.midi-channel",
          "temporal.note-min",
          "temporal.note-max",
          "accessibility.keyboard",
          "accessibility.focus-visible",
        ],
        editable_recipe_formats: [
          Core.RECIPE_SCHEMA,
          SEQUENCE_SCHEMA,
          DEVICE_SCHEMA,
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
            "MIDI, MusicXML, device mappings and validators are generated locally without device or network access.",
        },
        host_compatibility: {
          hosts: [
            "asset-fabric",
            "studio",
            "mirror",
            "audio-studio",
            "standalone",
          ],
          dependencies: [
            {
              name: "AXM MIDI + MusicXML codec",
              version: Audio.VERSION,
              bundled: true,
            },
          ],
        },
        engine: {
          name: "AXM Standard MIDI File 1 + MusicXML 4.0 writer/parser",
          version: Audio.VERSION,
          execution: "local-bounded",
        },
        safety_tier: "safe-local",
        authority: "candidate-only",
        implementation_status: "executable",
        portability: {
          interchange_formats: [
            "audio/midi",
            MUSICXML_MIME,
            SEQUENCE_SCHEMA,
            DEVICE_SCHEMA,
            RECIPE_SCHEMA,
          ],
          known_losses: [
            "the SVG preview displays controls but carries no audio",
          ],
          unsupported_features: [
            "audio waveform synthesis",
            "playback certification",
            "sound fonts",
            "MIDI 2.0 UMP",
            "MPE",
            "polyphonic overlap",
            "advanced notation",
            "external MusicXML validator",
            "hardware device access",
          ],
          fallbacks: [],
        },
        validation: {
          checks: [
            "MIDI MThd/MTrk structure, VLQ, tempo/time signature, paired note-on/note-off and end tracks",
            "MusicXML 4.0 score-partwise/part/measure/pitch/duration/tempo structure",
            "cross-format note count and tick duration",
            "canvas note range, duration and file budgets",
            "device dimensions, contrast, keyboard labels and focus",
            "honest no-playback claim boundary",
          ],
        },
        evidence: [
          {
            claim:
              "MusicXML 4.0 defines an XML interchange representation for digital sheet music.",
            source_url: "https://www.w3.org/2021/06/musicxml40/",
            specification_version: "MusicXML 4.0",
            retrieved_at: "2026-07-19",
          },
          {
            claim:
              "The MIDI Association publishes the Standard MIDI File specification and related MIDI standards.",
            source_url: "https://midi.org/specs",
            specification_version: "Standard MIDI Files",
            retrieved_at: "2026-07-19",
          },
        ],
        tests: [
          "asset-hands-audio-notation-selftest",
          "audio-studio-selftest",
          "asset-hands-hardening-selftest",
        ],
        implementation_priority: "high",
        limits: {
          midiFormat: 1,
          tracks: 2,
          channels: 1,
          maximumNotes: 8,
          musicXml: "4.0 score-partwise",
          audioWaveform: false,
          playbackValidation: false,
          deviceAccess: false,
        },
      },
      create: function (context) {
        return context.operationMode === "inspect" ||
          context.operationMode === "validate"
          ? inspectExisting(context)
          : generated(context);
      },
    };
  },
);
