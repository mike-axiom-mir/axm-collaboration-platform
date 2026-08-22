"use strict";

const Core = require("../asset-hand-core");
const Audio = require("../../deterministic-audio-fabric");

function parseSource(context) {
  const sources = (context.sourceArtifacts || []).filter((artifact) =>
    artifact.content_schema === Audio.RECIPE_SCHEMA,
  );
  for (let index = 0; index < sources.length; index += 1) {
    try {
      const parsed = JSON.parse(sources[index].text);
      if (parsed && parsed.schema === Audio.RECIPE_SCHEMA) {
        const recipe = Audio.normalizeRecipe(parsed);
        return {
          artifact: sources[index],
          recipe,
          recipe_digest: Audio.sha256(recipe),
        };
      }
    } catch (error) {
      throw new Error("deterministic audio edit source is invalid: " + error.message);
    }
  }
  if (context.operationMode === "edit")
    throw new Error("deterministic audio edit requires an axm.deterministic-audio-recipe/v1 source artifact");
  return null;
}

function choosePreset(brief) {
  const names = Object.keys(require("../../audio-sfx-bake").PRESETS);
  const tags = Array.isArray(brief.styleTags) ? brief.styleTags : [];
  const tagged = tags.find((tag) => names.includes(String(tag).toLowerCase()));
  if (tagged) return String(tagged).toLowerCase();
  const title = String(brief.title || "").toLowerCase();
  return names.find((name) => title.includes(name)) || "blip";
}

function byteLength(text) {
  return Buffer.byteLength(String(text || ""), "utf8");
}

module.exports = {
  descriptor: {
    schema: Core.HAND_SCHEMA,
    contract_version: "2.0",
    id: "deterministic-audio-fabric",
    title: "Deterministic Audio Fabric Hand",
    version: "1.0.0",
    category: "audio",
    lifecycle_status: "beta",
    summary: "Adapts the preserved audio-sfx-bake engine into bounded editable recipes, genuine deterministic PCM16 WAV delivery, local technical analysis, and non-promoting verification.",
    operation_modes: ["create", "edit"],
    canvas_models: ["audio-device"],
    entry_surfaces: ["asset-fabric", "export-recipe"],
    mutability: "transform",
    kinds: ["sound-effect"],
    accepts: [Core.BRIEF_SCHEMA, Audio.RECIPE_SCHEMA],
    produces: [
      Core.RESULT_SCHEMA,
      Audio.RECIPE_SCHEMA,
      Audio.ANALYSIS_SCHEMA,
      Audio.VERIFICATION_SCHEMA,
      "audio/wav",
    ],
    input_types: [
      {
        mime: "application/json",
        format: "JSON",
        schema: Audio.RECIPE_SCHEMA,
        roles: ["source", "recipe"],
        required_for: ["edit"],
        mutable: false,
        max_bytes: 200000,
      },
    ],
    output_types: [
      {
        mime: "application/json",
        format: "JSON",
        schema: Audio.RECIPE_SCHEMA,
        role: "editable-audio-recipe",
        editable: true,
        deterministic: true,
        lossy: false,
        known_losses: [],
      },
      {
        mime: "audio/wav",
        format: "WAV",
        schema: "audio/wav",
        role: "pcm16-wav-delivery",
        editable: false,
        deterministic: true,
        lossy: true,
        known_losses: ["the preserved renderer quantizes its floating-point render to mono 44100 Hz signed PCM16"],
      },
      {
        mime: "application/json",
        format: "JSON",
        schema: Audio.ANALYSIS_SCHEMA,
        role: "technical-audio-analysis",
        editable: false,
        deterministic: true,
        lossy: false,
        known_losses: [],
      },
      {
        mime: "application/json",
        format: "JSON",
        schema: Audio.VERIFICATION_SCHEMA,
        role: "technical-verification",
        editable: false,
        deterministic: true,
        lossy: false,
        known_losses: [],
      },
    ],
    canvas_types: [
      {
        medium: "audio-device",
        units: ["px"],
        colour_spaces: ["srgb"],
        transparency_modes: ["opaque"],
        behaviours: ["static"],
        intended_uses: ["sound-effect", "audio-sfx", "effect", "audio"],
      },
    ],
    canvas_limits: {
      min_width: 1,
      min_height: 1,
      max_width: 16384,
      max_height: 16384,
    },
    constraints_honoured: [
      "dimensions",
      "dimensions.unit",
      "colour.space",
      "colour.transparency",
      "behaviour.static",
      "performance.max-file-bytes",
      "performance.max-duration-seconds",
      "temporal.sample-rate",
      "temporal.channel-layout",
    ],
    editable_recipe_formats: [Audio.RECIPE_SCHEMA],
    operations: { preview: true, validate: true, edit: true },
    emits_editable_source: true,
    supports_edit_operation: true,
    requires: [],
    editable: true,
    deterministic: true,
    authority: "candidate-only",
    required_permissions: { local_file_system: "none", network_domains: [] },
    network_policy: { mode: "none", domains: [] },
    host_compatibility: {
      dependencies: [
        { id: "node-commonjs", version: ">=18" },
        { id: "audio-sfx-bake", version: "0.1.0" },
        { id: "asset-hands/audio-production", version: "1" },
      ],
    },
    engine: {
      name: "AXM deterministic audio adapter over audio-sfx-bake",
      version: Audio.ENGINE_VERSION,
      execution: "node-commonjs-same-thread-bounded",
    },
    safety_tier: "safe-local",
    portability: {
      interchange_formats: [Audio.RECIPE_SCHEMA, "PCM16 WAV", Audio.ANALYSIS_SCHEMA, Audio.VERIFICATION_SCHEMA],
      known_losses: ["the WAV delivery is a PCM16 render; the JSON recipe remains the editable candidate source"],
      unsupported_features: ["browser-direct synthesis", "audible playback proof", "human listening approval", "device-output proof", "external WAV conformance", "automatic installation", "automatic promotion"],
      fallbacks: ["a host may expose this exact CommonJS route through a bounded local bridge and must degrade to read-only when unavailable"],
    },
    validation: {
      checks: ["canonical recipe", "preserved renderer receipt", "canonical RIFF/WAVE PCM16 header", "second local decode", "repeat byte render", "repeat analysis", "duration budget", "file budget", "candidate authority"],
    },
    rollback: { strategy: "discard-candidate" },
    evidence: [
      {
        claim: "Repeated adapter renders reproduce the exact WAV and analysis digests while retaining the source renderer's unreviewed receipt.",
        source_url: "local:shared/deterministic-audio-fabric/selftest.js",
        specification_version: Audio.VERSION,
      },
    ],
    tests: ["deterministic-audio-fabric-selftest", "asset-hand-deterministic-audio-fabric-selftest"],
    implementation_priority: "high",
    limits: {
      sampleRateHz: Audio.SAMPLE_RATE_HZ,
      channels: Audio.CHANNELS,
      sampleFormat: Audio.SAMPLE_FORMAT,
      maximumDurationSeconds: Audio.MAX_DURATION_SECONDS,
      browserDirectSynthesis: false,
      audiblePlaybackVerification: false,
      humanListeningReviewRequired: true,
      externalWavConformance: false,
      automaticPromotion: false,
    },
  },

  create(context) {
    const source = parseSource(context);
    const maximumDuration = context.targetCanvas.performance.max_duration_seconds;
    const recipe = source
      ? source.recipe
      : Audio.createCandidateRecipe({
          id: Core.slug(context.brief.title) + "-audio",
          seed: context.seed,
          preset: choosePreset(context.brief),
          max_duration_seconds: maximumDuration != null && maximumDuration >= 0.01
            ? Math.min(maximumDuration, Audio.MAX_DURATION_SECONDS)
            : null,
        });
    const rendered = Audio.render(recipe);
    const verification = Audio.verify(recipe, rendered);
    const recipeText = JSON.stringify(rendered.recipe, null, 2);
    const analysisText = JSON.stringify(rendered.analysis, null, 2);
    const verificationText = JSON.stringify(verification, null, 2);
    const wavDataUrl = "data:audio/wav;base64," + rendered.wav.toString("base64");
    const slug = Core.slug(context.brief.title);
    const artifacts = [
      {
        id: "deterministic-audio-recipe",
        role: "editable-audio-recipe",
        name: context.brief.title + " deterministic audio recipe",
        filename: slug + ".deterministic-audio.json",
        mime: "application/json",
        format: "JSON",
        content_schema: Audio.RECIPE_SCHEMA,
        editable: true,
        text: recipeText,
        metadata: {
          schema: Audio.RECIPE_SCHEMA,
          digest: rendered.recipe_digest,
          version: Audio.VERSION,
          candidate_only: true,
        },
      },
      {
        id: "deterministic-audio-wav",
        role: "pcm16-wav-delivery",
        name: context.brief.title + " deterministic PCM16 WAV",
        filename: slug + ".wav",
        mime: "audio/wav",
        format: "WAV",
        editable: false,
        dataUrl: wavDataUrl,
        metadata: {
          schema: "audio/wav",
          digest: rendered.wav_sha256,
          sha256: rendered.wav_sha256,
          sample_rate_hz: rendered.analysis.sample_rate_hz,
          channels: rendered.analysis.channels,
          sample_format: rendered.analysis.sample_format,
          frame_count: rendered.analysis.frame_count,
          duration_seconds: rendered.analysis.duration_seconds,
          bytes: rendered.wav.length,
          human_listened: false,
          approved: false,
        },
      },
      {
        id: "deterministic-audio-analysis",
        role: "technical-audio-analysis",
        name: context.brief.title + " deterministic audio technical analysis",
        filename: slug + ".audio-analysis.json",
        mime: "application/json",
        format: "JSON",
        content_schema: Audio.ANALYSIS_SCHEMA,
        editable: false,
        text: analysisText,
        metadata: {
          schema: Audio.ANALYSIS_SCHEMA,
          digest: rendered.analysis.digest,
          status: rendered.analysis.status,
        },
      },
      {
        id: "deterministic-audio-verification",
        role: "technical-verification",
        name: context.brief.title + " deterministic audio verification",
        filename: slug + ".audio-verification.json",
        mime: "application/json",
        format: "JSON",
        content_schema: Audio.VERIFICATION_SCHEMA,
        editable: false,
        text: verificationText,
        metadata: {
          schema: Audio.VERIFICATION_SCHEMA,
          digest: verification.digest,
          status: verification.status,
          human_listened: false,
          approved: false,
        },
      },
    ];
    const totalBytes = rendered.wav.length + byteLength(recipeText) + byteLength(analysisText) + byteLength(verificationText);
    const requestedSampleRate = context.targetCanvas.temporal.sample_rate;
    const requestedChannelLayout = context.targetCanvas.temporal.channel_layout;
    const maximumBytes = context.targetCanvas.performance.max_file_bytes;
    return {
      artifacts,
      previewArtifactId: "deterministic-audio-wav",
      recipe: {
        format: Audio.RECIPE_SCHEMA,
        parameters: {
          operation: context.operationMode,
          sourceRecipeUsed: !!source,
          sourceArtifactDigest: source ? source.artifact.digest : null,
          sourceRecipeDigest: source ? source.recipe_digest : null,
          recipeDigest: rendered.recipe_digest,
          wavSha256: rendered.wav_sha256,
          analysisDigest: rendered.analysis.digest,
          verificationDigest: verification.digest,
          sampleRateHz: rendered.analysis.sample_rate_hz,
          channels: rendered.analysis.channels,
          sampleFormat: rendered.analysis.sample_format,
          frameCount: rendered.analysis.frame_count,
          durationSeconds: rendered.analysis.duration_seconds,
        },
        steps: [
          { op: "normalize-bounded-editable-audio-recipe" },
          { op: "render-with-preserved-audio-sfx-bake-engine" },
          { op: "inspect-canonical-pcm16-wav-header" },
          { op: "decode-and-analyze-with-second-local-module" },
          { op: "repeat-render-and-compare-bytes" },
          { op: "emit-candidate-only-technical-receipts" },
        ],
      },
      validationChecks: [
        { name: "deterministic-audio-technical-verification", pass: verification.status === "PASS", details: { status: verification.status, digest: verification.digest } },
        { name: "sample-rate", pass: requestedSampleRate == null || requestedSampleRate === Audio.SAMPLE_RATE_HZ, details: { requested: requestedSampleRate, actual: Audio.SAMPLE_RATE_HZ } },
        { name: "channel-layout", pass: requestedChannelLayout == null || ["mono", "1.0", "1-channel"].includes(String(requestedChannelLayout).toLowerCase()), details: { requested: requestedChannelLayout, actual: "mono" } },
        { name: "duration-budget", pass: maximumDuration == null || rendered.analysis.duration_seconds <= maximumDuration, details: { requested_maximum_seconds: maximumDuration, actual_seconds: rendered.analysis.duration_seconds } },
        { name: "file-budget", pass: maximumBytes == null || totalBytes <= maximumBytes, details: { requested_maximum_bytes: maximumBytes, actual_bytes: totalBytes } },
        { name: "candidate-authority", pass: !rendered.recipe.authority.installed && !rendered.recipe.authority.promoted && !rendered.recipe.authority.canonical, details: rendered.recipe.authority },
        { name: "human-listening-claim-withheld", pass: verification.claims.human_listened === false && verification.claims.human_aesthetic_approval === false && verification.claims.audible_playback_verified === false, details: { human_listened: false, human_aesthetic_approval: false, audible_playback_verified: false } },
      ],
      measures: {
        totalBytes,
        wavBytes: rendered.wav.length,
        sampleRateHz: rendered.analysis.sample_rate_hz,
        channels: rendered.analysis.channels,
        bitsPerSample: rendered.analysis.bits_per_sample,
        frames: rendered.analysis.frame_count,
        durationSeconds: rendered.analysis.duration_seconds,
        rms: rendered.analysis.rms,
        rmsDbfs: rendered.analysis.rms_dbfs,
        samplePeak: rendered.analysis.sample_peak,
        clippedSamples: rendered.analysis.clipped_samples,
        recipeDigest: rendered.recipe_digest,
        wavSha256: rendered.wav_sha256,
        analysisDigest: rendered.analysis.digest,
        verificationDigest: verification.digest,
      },
      notes: [
        "The axm.deterministic-audio-recipe/v1 JSON is the canonical editable candidate source; every edit regenerates all derived artifacts.",
        "The audio/wav data URL contains genuine mono 44100 Hz signed PCM16 RIFF/WAVE bytes from the preserved audio-sfx-bake renderer.",
        "READY and PASS mean technical structure, decode, bounds, and repeat-byte checks passed; they do not mean the sound was played or heard.",
        "Audible playback, device behavior, accessibility of the listening surface, and human aesthetic approval require separate human-lane evidence.",
        "No artifact is installed, promoted, approved, or canonical without an explicit human decision.",
      ],
    };
  },
};
