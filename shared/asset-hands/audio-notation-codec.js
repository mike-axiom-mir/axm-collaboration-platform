(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMAudioNotationCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = "1.0.0";
  function concat(parts) {
    var size = parts.reduce(function (sum, item) {
        return sum + item.length;
      }, 0),
      out = new Uint8Array(size),
      offset = 0;
    parts.forEach(function (item) {
      out.set(item, offset);
      offset += item.length;
    });
    return out;
  }
  function ascii(value) {
    var text = String(value),
      out = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 255;
    return out;
  }
  function be16(value) {
    return new Uint8Array([(value >>> 8) & 255, value & 255]);
  }
  function be32(value) {
    return new Uint8Array([
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
    ]);
  }
  function read16(data, offset) {
    return (data[offset] << 8) | data[offset + 1];
  }
  function read32(data, offset) {
    return (
      ((data[offset] << 24) |
        (data[offset + 1] << 16) |
        (data[offset + 2] << 8) |
        data[offset + 3]) >>>
      0
    );
  }
  function vlq(value) {
    value = Math.max(0, Math.floor(Number(value) || 0));
    var buffer = value & 127,
      bytes = [];
    while ((value >>>= 7)) {
      buffer <<= 8;
      buffer |= (value & 127) | 128;
    }
    for (;;) {
      bytes.push(buffer & 255);
      if (buffer & 128) buffer >>>= 8;
      else break;
    }
    return new Uint8Array(bytes);
  }
  function readVlq(data, state, end) {
    var value = 0,
      count = 0,
      byte;
    do {
      if (state.offset >= end || count++ >= 4)
        throw new Error("MIDI variable-length quantity is invalid");
      byte = data[state.offset++];
      value = (value << 7) | (byte & 127);
    } while (byte & 128);
    return value;
  }
  function base64(data) {
    if (typeof Buffer !== "undefined")
      return Buffer.from(data).toString("base64");
    var binary = "";
    for (var i = 0; i < data.length; i += 32768)
      binary += String.fromCharCode.apply(
        null,
        data.subarray(i, Math.min(data.length, i + 32768)),
      );
    return btoa(binary);
  }
  function dataUrl(mime, data) {
    return "data:" + mime + ";base64," + base64(data);
  }
  function bytes(value) {
    if (value instanceof Uint8Array) return value;
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(value))
      return new Uint8Array(value);
    var text = String(value || ""),
      body = text.slice(text.indexOf(",") + 1);
    if (typeof Buffer !== "undefined")
      return new Uint8Array(Buffer.from(body, "base64"));
    var raw = atob(body),
      out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function meta(type, payload, delta) {
    payload = payload instanceof Uint8Array ? payload : ascii(payload);
    return concat([
      vlq(delta || 0),
      new Uint8Array([0xff, type]),
      vlq(payload.length),
      payload,
    ]);
  }
  function trackChunk(events) {
    var content = concat(events),
      header = concat([ascii("MTrk"), be32(content.length)]);
    return concat([header, content]);
  }
  function makeMidi(input) {
    var tempo = Math.max(20, Math.min(400, Number(input.tempo) || 120)),
      ppq = Math.max(24, Math.min(9600, Math.round(Number(input.ppq) || 480))),
      channel =
        Math.max(1, Math.min(16, Math.round(Number(input.channel) || 1))) - 1,
      numerator = Math.max(
        1,
        Math.min(32, Math.round(Number(input.numerator) || 4)),
      ),
      denominator = Math.max(
        1,
        Math.min(32, Math.round(Number(input.denominator) || 4)),
      ),
      denominatorPower = Math.round(Math.log(denominator) / Math.log(2)),
      micros = Math.round(60000000 / tempo),
      tempoTrack = [
        meta(0x03, "AXM Tempo", 0),
        meta(
          0x51,
          new Uint8Array([
            (micros >>> 16) & 255,
            (micros >>> 8) & 255,
            micros & 255,
          ]),
          0,
        ),
        meta(0x58, new Uint8Array([numerator, denominatorPower, 24, 8]), 0),
        meta(0x2f, new Uint8Array(0), 0),
      ],
      noteTrack = [
        meta(0x03, "AXM Notes", 0),
        concat([vlq(0), new Uint8Array([0xc0 | channel, 0])]),
      ],
      lastTick = 0;
    (input.notes || [])
      .slice()
      .sort(function (a, b) {
        return a.start_beat - b.start_beat || a.midi - b.midi;
      })
      .forEach(function (note) {
        var start = Math.max(lastTick, Math.round(note.start_beat * ppq)),
          duration = Math.max(1, Math.round(note.duration_beats * ppq)),
          midi = Math.max(0, Math.min(127, Math.round(note.midi))),
          velocity = Math.max(
            1,
            Math.min(127, Math.round(note.velocity || 96)),
          );
        noteTrack.push(
          concat([
            vlq(start - lastTick),
            new Uint8Array([0x90 | channel, midi, velocity]),
          ]),
          concat([vlq(duration), new Uint8Array([0x80 | channel, midi, 0])]),
        );
        lastTick = start + duration;
      });
    noteTrack.push(meta(0x2f, new Uint8Array(0), 0));
    var output = concat([
        ascii("MThd"),
        be32(6),
        be16(1),
        be16(2),
        be16(ppq),
        trackChunk(tempoTrack),
        trackChunk(noteTrack),
      ]),
      inspection = inspectMidi(output);
    if (!inspection.pass)
      throw new Error(
        "MIDI validation failed: " + inspection.errors.join(", "),
      );
    return {
      mime: "audio/midi",
      format: "SMF 1",
      bytes: output,
      byteLength: output.length,
      dataUrl: dataUrl("audio/midi", output),
      inspection: inspection,
    };
  }
  function inspectMidi(value) {
    var data = bytes(value),
      errors = [],
      tracks = [],
      notes = [],
      tempo = null,
      timeSignature = null,
      format = null,
      division = null,
      trackCount = 0,
      offset = 0;
    if (
      data.length < 14 ||
      String.fromCharCode.apply(null, data.slice(0, 4)) !== "MThd"
    )
      errors.push("MIDI MThd header missing");
    else {
      var headerLength = read32(data, 4);
      format = read16(data, 8);
      trackCount = read16(data, 10);
      division = read16(data, 12);
      offset = 8 + headerLength;
      if (headerLength !== 6) errors.push("MIDI header length must be 6");
      if (format !== 1) errors.push("bounded MIDI profile requires format 1");
      if (division & 0x8000) errors.push("SMPTE division is unsupported");
    }
    for (
      var trackIndex = 0;
      !errors.length && trackIndex < trackCount;
      trackIndex += 1
    ) {
      if (
        offset + 8 > data.length ||
        String.fromCharCode.apply(null, data.slice(offset, offset + 4)) !==
          "MTrk"
      ) {
        errors.push("MIDI track chunk missing");
        break;
      }
      var length = read32(data, offset + 4),
        start = offset + 8,
        end = start + length,
        state = { offset: start },
        absolute = 0,
        running = 0,
        ended = false,
        open = {};
      if (end > data.length) {
        errors.push("MIDI track exceeds file");
        break;
      }
      while (state.offset < end) {
        try {
          absolute += readVlq(data, state, end);
        } catch (error) {
          errors.push(error.message);
          break;
        }
        if (state.offset >= end) {
          errors.push("MIDI event status missing");
          break;
        }
        var status = data[state.offset];
        if (status < 0x80) {
          if (!running) {
            errors.push("MIDI running status has no previous status");
            break;
          }
          status = running;
        } else state.offset += 1;
        if (status === 0xff) {
          running = 0;
          if (state.offset >= end) {
            errors.push("MIDI meta event truncated");
            break;
          }
          var type = data[state.offset++],
            metaLength;
          try {
            metaLength = readVlq(data, state, end);
          } catch (error) {
            errors.push(error.message);
            break;
          }
          if (state.offset + metaLength > end) {
            errors.push("MIDI meta payload truncated");
            break;
          }
          var payload = data.slice(state.offset, state.offset + metaLength);
          state.offset += metaLength;
          if (type === 0x51 && payload.length === 3)
            tempo =
              60000000 / ((payload[0] << 16) | (payload[1] << 8) | payload[2]);
          if (type === 0x58 && payload.length >= 2)
            timeSignature = [payload[0], Math.pow(2, payload[1])];
          if (type === 0x2f) {
            ended = true;
            if (metaLength !== 0)
              errors.push("MIDI end-of-track payload must be empty");
          }
        } else {
          running = status;
          var high = status & 0xf0,
            channel = status & 15,
            needed = high === 0xc0 || high === 0xd0 ? 1 : 2;
          if (state.offset + needed > end) {
            errors.push("MIDI channel event truncated");
            break;
          }
          var a = data[state.offset++],
            b = needed === 2 ? data[state.offset++] : 0,
            key = channel + ":" + a;
          if (high === 0x90 && b > 0) {
            if (open[key] != null)
              errors.push("overlapping MIDI note without note-off");
            open[key] = {
              start: absolute,
              velocity: b,
              channel: channel + 1,
              midi: a,
            };
          }
          if (high === 0x80 || (high === 0x90 && b === 0)) {
            if (!open[key]) errors.push("MIDI note-off has no note-on");
            else {
              notes.push({
                midi: a,
                channel: channel + 1,
                velocity: open[key].velocity,
                start_tick: open[key].start,
                duration_ticks: absolute - open[key].start,
              });
              delete open[key];
            }
          }
        }
      }
      if (Object.keys(open).length)
        errors.push("MIDI track has unterminated notes");
      if (!ended) errors.push("MIDI track end meta event missing");
      tracks.push({
        index: trackIndex,
        bytes: length,
        end_tick: absolute,
        ended: ended,
      });
      offset = end;
    }
    if (offset !== data.length) errors.push("MIDI trailing or unparsed bytes");
    if (tracks.length !== trackCount)
      errors.push("MIDI declared track count mismatch");
    if (!notes.length) errors.push("MIDI contains no complete notes");
    return {
      pass: !errors.length,
      errors: Array.from(new Set(errors)),
      format: format,
      tracks: tracks,
      trackCount: trackCount,
      division: division,
      tempoBpm: tempo ? Math.round(tempo * 1000) / 1000 : null,
      timeSignature: timeSignature,
      notes: notes,
      durationTicks: tracks.reduce(function (max, track) {
        return Math.max(max, track.end_tick);
      }, 0),
      bytes: data.length,
    };
  }
  function xml(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (character) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        }[character];
      },
    );
  }
  function pitch(midi) {
    var names = [
        ["C", 0],
        ["C", 1],
        ["D", 0],
        ["D", 1],
        ["E", 0],
        ["F", 0],
        ["F", 1],
        ["G", 0],
        ["G", 1],
        ["A", 0],
        ["A", 1],
        ["B", 0],
      ],
      item = names[midi % 12];
    return { step: item[0], alter: item[1], octave: Math.floor(midi / 12) - 1 };
  }
  function noteType(beats) {
    return beats >= 2
      ? "half"
      : beats >= 1
        ? "quarter"
        : beats >= 0.5
          ? "eighth"
          : "16th";
  }
  function makeMusicXml(input) {
    var ppq = Math.round(input.ppq || 480),
      numerator = Math.round(input.numerator || 4),
      denominator = Math.round(input.denominator || 4),
      measureTicks = (ppq * numerator * 4) / denominator,
      measures = [],
      current = [],
      tick = 0;
    input.notes.forEach(function (note, index) {
      var duration = Math.max(1, Math.round(note.duration_beats * ppq));
      if (current.length && tick + duration > measureTicks) {
        measures.push(current);
        current = [];
        tick = 0;
      }
      current.push({ note: note, duration: duration, index: index });
      tick += duration;
    });
    if (current.length) measures.push(current);
    var body = measures
        .map(function (measure, measureIndex) {
          return (
            '  <measure number="' +
            (measureIndex + 1) +
            '">\n' +
            (measureIndex === 0
              ? "    <attributes><divisions>" +
                ppq +
                "</divisions><key><fifths>0</fifths></key><time><beats>" +
                numerator +
                "</beats><beat-type>" +
                denominator +
                '</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>\n    <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>' +
                input.tempo +
                '</per-minute></metronome></direction-type><sound tempo="' +
                input.tempo +
                '"/></direction>\n'
              : "") +
            measure
              .map(function (entry) {
                var p = pitch(entry.note.midi);
                return (
                  '    <note id="note-' +
                  (entry.index + 1) +
                  '"><pitch><step>' +
                  p.step +
                  "</step>" +
                  (p.alter ? "<alter>" + p.alter + "</alter>" : "") +
                  "<octave>" +
                  p.octave +
                  "</octave></pitch><duration>" +
                  entry.duration +
                  "</duration><voice>1</voice><type>" +
                  noteType(entry.note.duration_beats) +
                  "</type></note>"
                );
              })
              .join("\n") +
            "\n  </measure>"
          );
        })
        .join("\n"),
      text =
        '<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0">\n<work><work-title>' +
        xml(input.title || "AXM Score") +
        '</work-title></work>\n<identification><encoding><software>AXM Audio Notation Hand</software><encoding-date>2000-01-01</encoding-date></encoding></identification>\n<part-list><score-part id="P1"><part-name>AXM Instrument</part-name><score-instrument id="P1-I1"><instrument-name>Acoustic Grand Piano</instrument-name></score-instrument><midi-instrument id="P1-I1"><midi-channel>' +
        input.channel +
        '</midi-channel><midi-program>1</midi-program></midi-instrument></score-part></part-list>\n<part id="P1">\n' +
        body +
        "\n</part>\n</score-partwise>\n",
      inspection = inspectMusicXml(text);
    if (!inspection.pass)
      throw new Error(
        "MusicXML validation failed: " + inspection.errors.join(", "),
      );
    return {
      mime: "application/vnd.recordare.musicxml+xml",
      format: "MusicXML 4.0",
      text: text,
      byteLength: text.length,
      inspection: inspection,
    };
  }
  function inspectMusicXml(text) {
    text = String(text || "");
    var errors = [],
      version =
        (/<score-partwise\s+version="([^"]+)"/.exec(text) || [])[1] || null,
      notes = Array.from(text.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)),
      divisions = Number((/<divisions>(\d+)<\/divisions>/.exec(text) || [])[1]),
      tempo = Number((/<sound\s+tempo="([0-9.]+)"/.exec(text) || [])[1]),
      beats = Number((/<beats>(\d+)<\/beats>/.exec(text) || [])[1]),
      beatType = Number((/<beat-type>(\d+)<\/beat-type>/.exec(text) || [])[1]),
      durationTicks = 0;
    if (!/^<\?xml/.test(text) || !/<\/score-partwise>\s*$/.test(text))
      errors.push("MusicXML document is incomplete");
    if (version !== "4.0")
      errors.push("MusicXML 4.0 score-partwise declaration missing");
    if (
      !/<part-list>[\s\S]*<score-part\b/.test(text) ||
      !/<part\s+id="P1">/.test(text)
    )
      errors.push("MusicXML part structure missing");
    if (!Number.isFinite(divisions) || divisions <= 0)
      errors.push("MusicXML divisions missing");
    if (!Number.isFinite(tempo) || tempo <= 0)
      errors.push("MusicXML tempo missing");
    if (!Number.isFinite(beats) || !Number.isFinite(beatType))
      errors.push("MusicXML time signature missing");
    notes.forEach(function (match, index) {
      var content = match[1],
        duration = Number(
          (/<duration>(\d+)<\/duration>/.exec(content) || [])[1],
        );
      if (
        !/<pitch>[\s\S]*<step>[A-G]<\/step>[\s\S]*<octave>-?\d+<\/octave>[\s\S]*<\/pitch>/.test(
          content,
        )
      )
        errors.push("MusicXML note pitch missing at " + index);
      if (!Number.isFinite(duration) || duration <= 0)
        errors.push("MusicXML note duration missing at " + index);
      else durationTicks += duration;
    });
    if (!notes.length) errors.push("MusicXML contains no notes");
    if (/<!ENTITY|<script\b|javascript:/i.test(text))
      errors.push("MusicXML active or external entity content is forbidden");
    return {
      pass: !errors.length,
      errors: errors,
      version: version,
      format: "MusicXML 4.0",
      notes: notes.length,
      divisions: divisions,
      tempoBpm: tempo,
      timeSignature: [beats, beatType],
      durationTicks: durationTicks,
      bytes: text.length,
    };
  }
  return {
    VERSION: VERSION,
    makeMidi: makeMidi,
    inspectMidi: inspectMidi,
    makeMusicXml: makeMusicXml,
    inspectMusicXml: inspectMusicXml,
    bytesFromDataUrl: bytes,
    dataUrl: dataUrl,
  };
});
