(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports ? require("../../hub/skin-core") : root.AXMSkin,
    typeof module === "object" && module.exports ? require("../asset-hands/universal-component") : root.AXMUniversalComponentProtocol,
    typeof module === "object" && module.exports ? require("../asset-hands/target-canvas") : root.AXMTargetCanvas,
    typeof module === "object" && module.exports ? require("./visual-grammar-core") : root.AXMVisualGrammar,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMHubSkinVisualAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (HubSkin, UCP, TargetCanvas, VisualGrammar) {
  "use strict";

  if (!HubSkin || !UCP || !TargetCanvas || !VisualGrammar) throw new Error("Hub skin adapter dependencies unavailable");

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function subset(object, keys) {
    var result = {};
    (keys || []).forEach(function (key) { if (Object.prototype.hasOwnProperty.call(object || {}, key)) result[key] = object[key]; });
    return result;
  }
  function portableId(value) {
    var text = String(value || "skin").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^[^a-z]+/, "").replace(/[-.]+$/, "");
    return text || "skin";
  }
  function port(id, type, required, multiple) { return { id: id, type: type, required: required, multiple: multiple }; }

  function fromHubSkin(skin, options) {
    options = options || {};
    var accepted = HubSkin.accept(skin);
    if (!accepted.ok) return { status: "REFUSED", errors: accepted.errors || [], components: [], profile: null, registry: null };
    var resolved = HubSkin.resolve(skin), sourceDigest = UCP.sha256(skin), stem = "axm.hubskin." + portableId(skin.id || skin.name);
    var createdAt = String(options.createdAt || new Date().toISOString());
    var provenance = {
      origin_type: "adapted",
      source_id: String(skin.id || skin.name || "hub-skin"),
      source_digest: sourceDigest,
      license_id: String(options.licenseId || "NOASSERTION"),
      created_by: String(options.createdBy || "axm-hub-skin-adapter"),
      created_at: createdAt,
      author_claimed: skin.author || null,
      authorship_verified: false
    };
    var compatibility = { mediums: ["ui"], intended_uses: ["hub-shell"], constraints: ["truth-surfaces-remain-visible", "local-vault-assets-only"] };
    function component(suffix, kind, title, outputType, capability, payload) {
      return UCP.sealComponent({
        id: stem + "." + suffix,
        version: "1.0.0",
        kind: kind,
        title: title,
        ports: { inputs: [], outputs: [port("value", outputType, false, true)] },
        canvas_compatibility: compatibility,
        capabilities: { provides: [capability], requires: [] },
        artifact_refs: [],
        payload: payload,
        provenance: provenance,
        resource_profile: { cpu: "none", gpu: "none", peak_memory_bytes: 0, working_storage_bytes: 0, native_runtime: null },
        verification: { automatic_checks: ["hub-skin-v1-data-gate"], human_judgments: ["appearance and taste"], assurance_ceiling: "data contract only; not rendered or visually approved" },
        mutability: "versioned"
      });
    }
    var components = [
      component("palette", "tokens.colour", "Hub colour palette", "style.tokens.colour", "presentation.palette", subset(resolved.tokens, HubSkin.COLOR_TOKENS)),
      component("typography", "tokens.typography", "Hub typography", "style.tokens.typography", "presentation.typography", subset(resolved.tokens, HubSkin.FONT_TOKENS)),
      component("shape", "tokens.metric", "Hub shape and density metrics", "style.tokens.metric", "presentation.shape", subset(resolved.tokens, Object.keys(HubSkin.NUMBER_TOKENS))),
      component("layout", "layout.profile", "Hub layout slots", "style.layout", "presentation.layout", resolved.slots),
      component("imagery", "imagery.profile", "Hub vault imagery", "style.imagery", "presentation.imagery", resolved.assets)
    ];
    var adapter = UCP.sealComponent({
      id: stem + ".adapter",
      version: "1.0.0",
      kind: "adapter",
      title: "Hub skin v1 output adapter",
      ports: {
        inputs: [
          port("palette", "style.tokens.colour", true, false),
          port("typography", "style.tokens.typography", true, false),
          port("shape", "style.tokens.metric", true, false),
          port("layout", "style.layout", true, false),
          port("imagery", "style.imagery", true, false)
        ],
        outputs: [port("skin", "skin.hub.data", false, true)]
      },
      canvas_compatibility: compatibility,
      capabilities: { provides: ["presentation.skin.hub.data"], requires: ["hand.skin.hub.apply"] },
      artifact_refs: [],
      payload: { schema: HubSkin.SCHEMA, renderer: "hub/skin-renderer.js", editable_surface: "hub/skin-core.js" },
      adapter: {
        from_types: ["style.tokens.colour", "style.tokens.typography", "style.tokens.metric", "style.layout", "style.imagery"],
        to_types: ["skin.hub.data"],
        required_hand: "hand.skin.hub.apply",
        known_losses: ["Hub skin v1 cannot render generic compositor, filter, material, lighting, motion or 3D roles; those require a target adapter that declares them."]
      },
      provenance: provenance,
      resource_profile: { cpu: "light", gpu: "none", peak_memory_bytes: 65536, working_storage_bytes: 0, native_runtime: "browser-dom" },
      verification: { automatic_checks: ["hub-skin-v1-data-gate", "contrast-invariants", "required-truth-surface-invariants"], human_judgments: ["appearance and taste"], assurance_ceiling: "Hub data acceptance only; live render still requires visual evidence" },
      mutability: "versioned"
    });
    components.push(adapter);
    var registry = UCP.createRegistry(components);
    var refs = components.map(function (item) {
      return { instance_id: item.id.split(".").pop(), component_id: item.id, component_version: item.version, component_digest: item.digest, configuration: {} };
    });
    var graph = UCP.sealGraph({
      id: stem + ".graph",
      title: String(skin.name || "Hub skin") + " visual component graph",
      target_canvas: TargetCanvas.normalize({
        medium: "ui",
        dimensions: { width: 1600, height: 900, unit: "px" },
        colour: { space: "srgb", transparency: "alpha" },
        behaviour: ["responsive"],
        performance: { max_draw_calls: 256 },
        intended_use: "hub-shell"
      }),
      components: refs,
      connections: ["palette", "typography", "shape", "layout", "imagery"].map(function (id) {
        return { from: { instance_id: id, port: "value" }, to: { instance_id: "adapter", port: id }, relation: "adapts" };
      }),
      outputs: [{ id: "hub-skin", instance_id: "adapter", port: "skin", role: "editable-hub-skin-data" }],
      policy: { acyclic: true, missing_component: "fail", loss_policy: "declare", execution_authority: "none" }
    });
    var profile = VisualGrammar.sealProfile({
      id: stem,
      version: "1.0.0",
      title: String(skin.name || "Hub skin") + " visual grammar",
      graph: graph,
      role_bindings: [
        { instance_id: "palette", role: "palette", category: "foundation", plane: "presentation", editable: true, order: 10 },
        { instance_id: "typography", role: "typography", category: "foundation", plane: "presentation", editable: true, order: 20 },
        { instance_id: "shape", role: "shape", category: "foundation", plane: "presentation", editable: true, order: 30 },
        { instance_id: "layout", role: "layout", category: "behaviour", plane: "presentation", editable: true, order: 40 },
        { instance_id: "imagery", role: "imagery", category: "source", plane: "presentation", editable: true, order: 50 },
        { instance_id: "adapter", role: "output-adapter", category: "delivery", plane: "presentation", editable: true, order: 100 }
      ],
      required_roles: ["palette", "typography", "shape", "layout", "imagery", "output-adapter"],
      required_capabilities: [],
      protected_instances: [],
      target_outputs: [{ output_id: "hub-skin", mime: "application/vnd.axm.skin+json", role: "hub-skin-data", required: true }],
      policy: { data_only: true, execution_authority: "none", preserve_semantics: true, unknown_role: "namespaced-extension", visual_change: "invalidate-approval" },
      approval: { technical: "UNTESTED", visual: "UNREVIEWED", canon: false },
      source: { schema: HubSkin.SCHEMA, id: skin.id || null, name: skin.name || null, author_claimed: skin.author || null, source_digest: sourceDigest }
    });
    return { status: "ADAPTED", errors: [], components: components, profile: profile, registry: registry };
  }

  function toHubSkin(profile, registry) {
    var validation = VisualGrammar.validateProfile(profile, registry);
    if (!validation.pass) return { status: "REFUSED", errors: validation.errors, skin: null };
    var refs = new Map(profile.graph.components.map(function (item) { return [item.instance_id, item]; }));
    var roles = new Map(profile.role_bindings.map(function (item) { return [item.role, item.instance_id]; }));
    function payload(role) {
      var instanceId = roles.get(role), ref = refs.get(instanceId), component = ref && registry.resolve(ref);
      if (!component) throw new Error("role does not resolve: " + role);
      return component.payload || {};
    }
    var skin;
    try {
      skin = {
        schema: HubSkin.SCHEMA,
        id: profile.source && profile.source.id || profile.id,
        name: profile.source && profile.source.name || profile.title,
        author: profile.source && profile.source.author_claimed || "unknown",
        tokens: Object.assign({}, payload("palette"), payload("typography"), payload("shape")),
        slots: clone(payload("layout")),
        assets: clone(payload("imagery"))
      };
    } catch (error) {
      return { status: "REFUSED", errors: [error.message], skin: null };
    }
    var accepted = HubSkin.accept(skin);
    return accepted.ok
      ? { status: "READY_DATA", errors: [], warnings: accepted.warnings || [], skin: skin, fingerprint: HubSkin.fingerprint(skin), truth: { applied: false, rendered: false, visually_approved: false } }
      : { status: "REFUSED", errors: accepted.errors || [], skin: null };
  }

  return Object.freeze({ fromHubSkin: fromHubSkin, toHubSkin: toHubSkin });
});
