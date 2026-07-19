(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node
      ? require("../../../tools/film-motion-studio/film-motion-core")
      : root.AXMFilmMotionCore,
    node ? require("../otio-codec") : root.AXMOtioCodec,
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
  function (Core, Film, Otio) {
    "use strict";
    if (!Film || !Otio)
      throw new Error("AXM Film & Motion Core and OTIO Codec are required");
    function fixedTime() {
      return "1970-01-01T00:00:00.000Z";
    }
    function parseProject(context) {
      if (context.operationMode !== "edit") return null;
      try {
        return Film.normalizeProject(
          JSON.parse(context.sourceArtifacts[0].text),
        );
      } catch (error) {
        throw new Error(
          "Timeline edit requires valid axm.film-motion.project/v1 JSON",
        );
      }
    }
    function project(context) {
      var source = parseProject(context),
        canvas = context.targetCanvas,
        fps = canvas.performance.frames_per_second || 24,
        defaultFrames = Math.round(fps * 6),
        durationBudget = canvas.performance.max_duration_seconds == null ? defaultFrames : Math.floor(canvas.performance.max_duration_seconds * fps),
        frames = Math.max(1,Math.min(defaultFrames,canvas.performance.max_animation_frames || defaultFrames,durationBudget)),
        seed = Core.hash(context.seed);
      if (source) {
        source.name = context.brief.title;
        source.fps = fps;
        source.width = Math.round(canvas.dimensions.width);
        source.height = Math.round(canvas.dimensions.height);
        source.durationFrames = Math.max(1, frames);
        source.updatedAt = fixedTime();
        return Film.normalizeProject(source);
      }
      var trackId = "track-" + seed,
        assetId = "asset-" + seed,
        clipCount = Math.min(4, Math.max(1, Math.round(frames / fps))),
        clipFrames = Math.max(1, Math.floor(frames / clipCount)),
        clips = [];
      for (var i = 0; i < clipCount; i += 1)
        clips.push({
          id: "clip-" + seed + "-" + i,
          trackId: trackId,
          assetId: assetId,
          name: "Beat " + (i + 1),
          startFrame: i * clipFrames,
          durationFrames:
            i === clipCount - 1 ? frames - i * clipFrames : clipFrames,
          inFrame: 0,
          speed: 1,
          opacity: 1,
          blend: "normal",
        });
      return Film.normalizeProject({
        format: Film.FORMAT,
        version: Film.VERSION,
        id: "film-" + seed,
        name: context.brief.title,
        fps: fps,
        width: Math.round(canvas.dimensions.width),
        height: Math.round(canvas.dimensions.height),
        durationFrames: frames,
        createdAt: fixedTime(),
        updatedAt: fixedTime(),
        assets: [
          {
            id: assetId,
            name: context.brief.title + " generated source",
            kind: "sequence",
            mime: "application/json",
            bytes: 0,
            durationFrames: frames,
            width: Math.round(canvas.dimensions.width),
            height: Math.round(canvas.dimensions.height),
            source: "timeline-sequence hand",
            rights: "unknown",
            sessionAvailable: true,
            sourceSchema: Core.BRIEF_SCHEMA,
            createdAt: fixedTime(),
          },
        ],
        tracks: [
          {
            id: trackId,
            name: "G1 Generated Sequence",
            kind: "graphics",
            order: 0,
            muted: false,
            locked: false,
          },
        ],
        clips: clips,
        scenes: [],
        keyframes: [],
        effects: [],
        storyboards: [],
        reviews: [],
        tracking: [],
        captureTakes: [],
        exports: [],
      });
    }
    function preview(brief, p, edl, palette) {
      var w = brief.canvas.width,
        h = brief.canvas.height,
        pad = Math.max(8, Math.min(w, h) * 0.06),
        laneY = h * 0.35,
        laneH = Math.max(14, h * 0.28),
        body =
          '<rect width="' +
          w +
          '" height="' +
          h +
          '" fill="' +
          palette[0] +
          '"/><path d="M' +
          pad +
          " " +
          (laneY - 10) +
          " H" +
          (w - pad) +
          '" stroke="' +
          palette[2] +
          '" stroke-opacity=".35"/>';
      edl.events.forEach(function (event, index) {
        var clip = p.clips.find(function (item) {
            return item.id === event.clipId;
          }),
          x = pad + (w - pad * 2) * (clip.startFrame / p.durationFrames),
          cw = (w - pad * 2) * (clip.durationFrames / p.durationFrames);
        body +=
          '<rect x="' +
          x.toFixed(2) +
          '" y="' +
          laneY +
          '" width="' +
          Math.max(2, cw - 3).toFixed(2) +
          '" height="' +
          laneH +
          '" rx="' +
          Math.max(3, laneH * 0.12) +
          '" fill="' +
          palette[(index % 3) + 1] +
          '" fill-opacity=".45" stroke="' +
          palette[(index % 3) + 1] +
          '"/><path d="M' +
          x.toFixed(2) +
          " " +
          (laneY - 16) +
          " V" +
          (laneY + laneH + 10) +
          '" stroke="' +
          palette[3] +
          '" stroke-opacity=".55"/>';
      });
      return Core.svgDocument(brief, body, {
        label: brief.title + " frame timeline preview",
      });
    }
    return {
      descriptor: {
        schema: Core.HAND_SCHEMA,
        contract_version: "2.0",
        id: "timeline-sequence",
        title: "Timeline & Sequencing Hand",
        version: "1.2.0",
        category: "timeline",
        lifecycle_status: "beta",
        summary:
          "Creates or retargets a deterministic frame-accurate AXM Film & Motion project, EDL and OpenTimelineIO document without claiming final video encoding.",
        operation_modes: ["create", "edit"],
        canvas_models: ["timeline"],
        entry_surfaces: ["timeline-editor", "export-recipe"],
        mutability: "transform",
        kinds: ["timeline", "sequence", "motion"],
        accepts: [Core.BRIEF_SCHEMA, "axm.film-motion.project/v1"],
        produces: [
          Core.RESULT_SCHEMA,
          "application/json",
          Otio.MIME,
          "image/svg+xml",
        ],
        input_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: "axm.film-motion.project/v1",
            roles: ["source"],
            required_for: ["edit"],
            mutable: false,
            max_bytes: 8000000,
          },
        ],
        output_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: "axm.film-motion.project/v1",
            role: "editable-timeline-project",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: "axm.film.edl/v1",
            role: "edl-delivery",
            editable: true,
            deterministic: true,
            lossy: true,
            known_losses: [
              "effects, layers, reviews and tracking points are not encoded in EDL",
            ],
          },
          {
            mime: Otio.MIME,
            format: "OTIO",
            schema: "Timeline.1",
            role: "timeline-interchange",
            editable: true,
            deterministic: true,
            lossy: true,
            known_losses: [
              "effects, tracking, reviews and non-unit clip speed are metadata or omitted",
            ],
          },
          {
            mime: "image/svg+xml",
            format: "SVG",
            role: "timeline-preview",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: ["preview is a static timeline proof"],
          },
        ],
        canvas_types: [
          {
            medium: "screen",
            units: ["px"],
            colour_spaces: ["srgb"],
            transparency_modes: ["opaque"],
            behaviours: ["animated"],
            intended_uses: [
              "timeline",
              "sequence",
              "motion",
              "animation",
              "promo-cut",
            ],
          },
          {
            medium: "ui",
            units: ["px"],
            colour_spaces: ["srgb"],
            transparency_modes: ["opaque"],
            behaviours: ["animated"],
            intended_uses: ["timeline", "sequence", "motion", "animation"],
          },
        ],
        canvas_limits: {min_width:16,min_height:16,max_width:8192,max_height:8192,min_animation_frames:2,max_animation_frames:100000,min_fps:1,max_fps:240},
        constraints_honoured: [
          "dimensions",
          "dimensions.unit",
          "colour.space",
          "colour.transparency",
          "behaviour.animated",
          "performance.max-file-bytes",
          "performance.max-animation-frames",
          "performance.frames-per-second",
          "performance.max-duration-seconds",
        ],
        editable_recipe_formats: [
          Core.RECIPE_SCHEMA,
          "axm.timeline-sequence-recipe/v1",
          "axm.film-motion.project/v1",
        ],
        operations: { preview: true, validate: true, edit: true },
        emits_editable_source: true,
        supports_edit_operation: true,
        requires: [],
        editable: true,
        deterministic: true,
        required_permissions: {
          local_file_system: "none",
          network_domains: [],
        },
        network_policy: { mode: "none", domains: [] },
        host_compatibility: {
          dependencies: [
            { id: "film-motion-core", version: "v1" },
            { id: "axm-otio-codec", version: Otio.VERSION },
          ],
        },
        engine: {
          name: "AXM Film & Motion timeline + OTIO",
          version: "1.2",
          execution: "same-thread-bounded",
        },
        safety_tier: "safe-local",
        portability: {
          interchange_formats: [
            "axm.film-motion.project/v1",
            "axm.film.edl/v1",
            "OpenTimelineIO Timeline.1",
          ],
          known_losses: [
            "AXM EDL and OTIO are delivery views, not the editable AXM master",
          ],
          unsupported_features: [
            "final encoded video",
            "automatic media persistence",
            "effect adapter parity",
          ],
          fallbacks: [],
        },
        validation: {
          checks: [
            "project normalization",
            "OTIO Timeline/Stack/Track schemas",
            "duration",
            "frame rate",
            "gap and overlap report",
            "file budget",
          ],
        },
        rollback: { strategy: "discard-candidate" },
        evidence: [
          {
            claim:
              "Film & Motion projects are mapped to OpenTimelineIO Timeline.1, Stack.1, Track.1, Clip.2 and RationalTime.1 structures.",
            source_url: "local:shared/asset-hands/otio-codec.js",
            specification_version: Otio.VERSION,
          },
        ],
        tests: [
          "film-motion-studio-selftest",
          "asset-hands-interchange-selftest",
          "asset-hands-selftest",
        ],
        implementation_priority: "medium",
        limits: {
          otio: true,
          finalVideoEncoding: false,
          automaticTimelinePlacement: false,
          effectAdapterParity: false,
        },
      },
      create: function (context) {
        var p = project(context),
          edl = Film.edl(p),
          otio = Otio.fromProject(p),
          projectText = JSON.stringify(p, null, 2),
          edlText = JSON.stringify(edl, null, 2),
          svg = preview(context.brief, p, edl, context.palette),
          total =
            projectText.length + edlText.length + otio.text.length + svg.length,
          gaps = 0,
          overlaps = 0,
          clips = p.clips.slice().sort(function (a, b) {
            return a.startFrame - b.startFrame;
          });
        for (var i = 1; i < clips.length; i += 1) {
          var end = clips[i - 1].startFrame + clips[i - 1].durationFrames;
          if (clips[i].startFrame > end) gaps += 1;
          if (clips[i].startFrame < end) overlaps += 1;
        }
        return {
          artifacts: [
            {
              id: "timeline-project",
              role: "editable-timeline-project",
              name: context.brief.title + " Film project",
              filename: Core.slug(context.brief.title) + ".film.json",
              mime: "application/json",
              format: "JSON",
              editable: true,
              text: projectText,
              metadata: { schema: Film.FORMAT },
            },
            {
              id: "timeline-edl",
              role: "edl-delivery",
              name: context.brief.title + " EDL",
              filename: Core.slug(context.brief.title) + ".edl.json",
              mime: "application/json",
              format: "JSON",
              editable: true,
              text: edlText,
              metadata: { schema: "axm.film.edl/v1", lossy: true },
            },
            {
              id: "timeline-otio",
              role: "timeline-interchange",
              name: context.brief.title + " OpenTimelineIO",
              filename: Core.slug(context.brief.title) + ".otio",
              mime: Otio.MIME,
              format: "OTIO",
              editable: true,
              text: otio.text,
              metadata: { schema: "Timeline.1", lossy: true },
            },
            {
              id: "timeline-preview",
              role: "timeline-preview",
              name: context.brief.title + " timeline",
              filename: Core.slug(context.brief.title) + "-timeline.svg",
              mime: "image/svg+xml",
              format: "SVG",
              editable: false,
              text: svg,
              width: context.brief.canvas.width,
              height: context.brief.canvas.height,
            },
          ],
          previewArtifactId: "timeline-preview",
          recipe: {
            format: "axm.timeline-sequence-recipe/v1",
            parameters: {
              operation: context.operationMode,
              fps: p.fps,
              durationFrames: p.durationFrames,
              resolution: [p.width, p.height],
              clips: p.clips.length,
              otioSchema: "Timeline.1",
            },
            steps: [
              { op: "normalize-frame-timebase" },
              { op: "build-or-retarget-editable-project" },
              { op: "derive-loss-declared-edl" },
              { op: "map-tracks-clips-and-gaps-to-otio" },
              { op: "validate-otio-structure" },
              { op: "render-static-timeline-proof" },
            ],
          },
          validationChecks: [
            {
              name: "target-canvas-propagated",
              pass: context.targetCanvas.schema === Core.TARGET_CANVAS_SCHEMA,
            },
            { name: "positive-duration", pass: p.durationFrames > 0 },
            {
              name: "duration-budget",
              pass:
                context.targetCanvas.performance.max_duration_seconds == null ||
                p.durationFrames / p.fps <=
                  context.targetCanvas.performance.max_duration_seconds,
            },
            {
              name: "frame-rate-recorded",
              pass:
                p.fps === context.targetCanvas.performance.frames_per_second ||
                context.targetCanvas.performance.frames_per_second == null,
            },
            {
              name: "otio-structure",
              pass: otio.inspection.pass,
              details: otio.inspection,
            },
            {
              name: "gap-overlap-report",
              pass: true,
              details: { gaps: gaps, overlaps: overlaps },
            },
            {
              name: "file-budget",
              pass:
                context.targetCanvas.performance.max_file_bytes == null ||
                total <= context.targetCanvas.performance.max_file_bytes,
            },
          ],
          measures: {
            fps: p.fps,
            durationFrames: p.durationFrames,
            clips: p.clips.length,
            otioTracks: otio.inspection.tracks,
            gaps: gaps,
            overlaps: overlaps,
            totalBytes: total,
          },
          notes: [
            "The AXM Film project is the editable master; EDL and OTIO declare their losses.",
            "Final video encoding and effect-adapter parity remain explicit missing capabilities.",
          ],
        };
      },
    };
  },
);
