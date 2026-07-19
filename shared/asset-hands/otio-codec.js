(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMOtioCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = "1.0.0",
    MIME = "application/vnd.opentimelineio+json";
  function time(value, rate) {
    return {
      OTIO_SCHEMA: "RationalTime.1",
      value: Number(value) || 0,
      rate: Number(rate) || 24,
    };
  }
  function range(start, duration, rate) {
    return {
      OTIO_SCHEMA: "TimeRange.1",
      start_time: time(start, rate),
      duration: time(duration, rate),
    };
  }
  function gap(duration, rate) {
    return {
      OTIO_SCHEMA: "Gap.1",
      name: "Gap",
      metadata: {},
      source_range: range(0, duration, rate),
      effects: [],
      markers: [],
      enabled: true,
    };
  }
  function fileReference(asset) {
    var source = String((asset && asset.source) || ""),
      valid =
        /^(?:file:\/\/|[a-z]:[\\/]|\.{0,2}[\\/])/i.test(source) ||
        /[\\/]/.test(source) ||
        /\.[a-z0-9]{1,8}(?:[?#].*)?$/i.test(source),
      metadata = {
        axm: {
          asset_id: (asset && asset.id) || "",
          source_schema: (asset && asset.sourceSchema) || "",
          original_source: source || null,
        },
      };
    return valid
      ? {
          OTIO_SCHEMA: "ExternalReference.1",
          name: (asset && asset.name) || "External source",
          metadata: metadata,
          target_url: source,
          available_range: null,
        }
      : {
          OTIO_SCHEMA: "MissingReference.1",
          name: (asset && asset.name) || "Unlinked generated source",
          metadata: metadata,
          available_range: null,
        };
  }
  function clip(c, asset, rate) {
    var speed = c.speed == null ? 1 : Number(c.speed),
      effects = [];
    if (Number.isFinite(speed) && speed !== 1)
      effects.push({
        OTIO_SCHEMA: "LinearTimeWarp.1",
        name: "AXM clip speed",
        metadata: { axm: { source_speed: speed } },
        effect_name: "LinearTimeWarp",
        time_scalar: speed,
        enabled: true,
      });
    return {
      OTIO_SCHEMA: "Clip.2",
      name: c.name || "Clip",
      metadata: {
        axm: {
          clip_id: c.id,
          track_id: c.trackId,
          record_start_frame: c.startFrame,
          speed: c.speed,
          opacity: c.opacity,
          blend: c.blend,
        },
      },
      media_reference: fileReference(asset),
      source_range: range(c.inFrame, c.durationFrames, rate),
      effects: effects,
      markers: [],
      enabled: true,
    };
  }
  function lanes(clips) {
    var out = [];
    (clips || [])
      .slice()
      .sort(function (a, b) {
        return (
          a.startFrame - b.startFrame ||
          String(a.id).localeCompare(String(b.id))
        );
      })
      .forEach(function (c) {
        var lane = out.find(function (items) {
          var last = items[items.length - 1];
          return !last || last.startFrame + last.durationFrames <= c.startFrame;
        });
        if (!lane) {
          lane = [];
          out.push(lane);
        }
        lane.push(c);
      });
    return out;
  }
  function fromProject(project) {
    var rate = Number(project.fps) || 24,
      tracks = [];
    (project.tracks || []).forEach(function (track) {
      var sourceClips = (project.clips || []).filter(function (c) {
          return c.trackId === track.id;
        }),
        trackLanes = lanes(sourceClips);
      if (!trackLanes.length) trackLanes = [[]];
      trackLanes.forEach(function (clips, laneIndex) {
        var cursor = 0,
          children = [];
        clips.forEach(function (c) {
          if (c.startFrame > cursor)
            children.push(gap(c.startFrame - cursor, rate));
          children.push(
            clip(
              c,
              (project.assets || []).find(function (a) {
                return a.id === c.assetId;
              }),
              rate,
            ),
          );
          cursor = Math.max(cursor, c.startFrame + c.durationFrames);
        });
        if (cursor < project.durationFrames)
          children.push(gap(project.durationFrames - cursor, rate));
        tracks.push({
          OTIO_SCHEMA: "Track.1",
          name:
            (track.name || track.id) +
            (trackLanes.length > 1 ? " - overlap lane " + (laneIndex + 1) : ""),
          metadata: {
            axm: {
              track_id: track.id,
              overlap_lane: laneIndex,
              muted: track.muted,
              locked: track.locked,
            },
          },
          children: children,
          source_range: null,
          effects: [],
          markers: [],
          kind: track.kind === "audio" ? "Audio" : "Video",
        });
      });
    });
    var document = {
        OTIO_SCHEMA: "Timeline.1",
        name: project.name || "AXM Timeline",
        metadata: {
          axm: {
            source_schema: project.format || "axm.film-motion.project/v1",
            source_id: project.id || "",
            fps: rate,
            resolution: [project.width, project.height],
            duration_frames: project.durationFrames,
            known_losses: [
              "tracking, reviews and renderer-specific effects are omitted",
            ],
          },
        },
        global_start_time: null,
        tracks: {
          OTIO_SCHEMA: "Stack.1",
          name: "AXM Tracks",
          metadata: {},
          children: tracks,
          source_range: null,
          effects: [],
          markers: [],
        },
      },
      text = JSON.stringify(document, null, 2),
      inspection = inspect(text);
    if (!inspection.pass)
      throw new Error(
        "OTIO structural validation failed: " + inspection.errors.join(", "),
      );
    return {
      mime: MIME,
      format: "OTIO",
      text: text,
      document: document,
      inspection: inspection,
    };
  }
  function inspect(input) {
    var errors = [],
      value;
    try {
      value = typeof input === "string" ? JSON.parse(input) : input;
    } catch (error) {
      return { pass: false, errors: ["OTIO JSON invalid"] };
    }
    if (!value || value.OTIO_SCHEMA !== "Timeline.1")
      errors.push("Timeline.1 root required");
    if (
      !value.tracks ||
      value.tracks.OTIO_SCHEMA !== "Stack.1" ||
      !Array.isArray(value.tracks.children)
    )
      errors.push("Stack.1 tracks required");
    ((value && value.tracks && value.tracks.children) || []).forEach(
      function (track, index) {
        if (track.OTIO_SCHEMA !== "Track.1" || !Array.isArray(track.children)) {
          errors.push("Track.1 children required");
          return;
        }
        track.children.forEach(function (item) {
          if (["Clip.2", "Gap.1"].indexOf(item.OTIO_SCHEMA) < 0)
            errors.push(
              "track " + index + " contains unsupported child schema",
            );
          if (
            !item.source_range ||
            !item.source_range.duration ||
            !(item.source_range.duration.rate > 0) ||
            item.source_range.duration.value < 0
          )
            errors.push(
              "track " + index + " child has invalid RationalTime duration",
            );
          if (
            item.OTIO_SCHEMA === "Clip.2" &&
            (!item.media_reference ||
              ["ExternalReference.1", "MissingReference.1"].indexOf(
                item.media_reference.OTIO_SCHEMA,
              ) < 0)
          )
            errors.push("clip media reference is invalid");
          if (
            item.media_reference &&
            item.media_reference.OTIO_SCHEMA === "ExternalReference.1" &&
            !item.media_reference.target_url
          )
            errors.push("ExternalReference target_url is required");
        });
      },
    );
    return {
      pass: !errors.length,
      errors: errors,
      tracks:
        (value &&
          value.tracks &&
          value.tracks.children &&
          value.tracks.children.length) ||
        0,
    };
  }
  return {
    VERSION: VERSION,
    MIME: MIME,
    fromProject: fromProject,
    inspect: inspect,
  };
});
