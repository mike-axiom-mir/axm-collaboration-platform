(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("../asset-hands/universal-component")
      : root.AXMUniversalComponentProtocol,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMVisualGrammar = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (UCP) {
  "use strict";

  if (!UCP || typeof UCP.compose !== "function") throw new Error("AXM Visual Grammar requires UCP");

  var VERSION = "1.0.0";
  var PROFILE_SCHEMA = "axm.visual-grammar/v1";
  var ROUTE_SCHEMA = "axm.visual-route-receipt/v1";
  var SWAP_SCHEMA = "axm.visual-swap-receipt/v1";
  var ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
  var DIGEST = /^[a-f0-9]{64}$/;
  var PLANES = ["semantic", "presentation", "governance"];
  var ROLE_CATALOG = Object.freeze({
    "palette": "foundation",
    "colour-policy": "foundation",
    "typography": "foundation",
    "spacing": "foundation",
    "shape": "foundation",
    "density": "foundation",
    "raster-source": "source",
    "vector-source": "source",
    "text-source": "source",
    "mesh-source": "source",
    "imagery": "source",
    "layer": "composition",
    "layer-order": "composition",
    "mask": "composition",
    "blend": "composition",
    "compositor": "composition",
    "filter": "composition",
    "effect": "composition",
    "material": "surface",
    "texture": "surface",
    "lighting": "surface",
    "camera": "surface",
    "layout": "behaviour",
    "responsive-layout": "behaviour",
    "motion": "behaviour",
    "interaction-state": "behaviour",
    "renderer": "delivery",
    "output-adapter": "delivery",
    "accessibility-policy": "governance",
    "performance-budget": "governance",
    "truth-surface-policy": "governance"
  });

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function unique(values) { return Array.from(new Set(values || [])).sort(); }
  function withoutDigest(value) { var copy = clone(value || {}); delete copy.digest; return copy; }
  function digest(value) { return UCP.sha256(withoutDigest(value)); }
  function extensionRole(role) { return /^x\.[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(String(role || "")); }
  function roleCategory(role) { return ROLE_CATALOG[role] || (extensionRole(role) ? "extension" : null); }

  function sealProfile(input) {
    var profile = clone(input || {});
    profile.schema = PROFILE_SCHEMA;
    profile.version = String(profile.version || VERSION);
    profile.graph = UCP.sealGraph(profile.graph || {});
    profile.role_bindings = profile.role_bindings || [];
    profile.required_roles = unique(profile.required_roles || []);
    profile.required_capabilities = unique(profile.required_capabilities || []);
    profile.protected_instances = unique(profile.protected_instances || []);
    profile.target_outputs = profile.target_outputs || [];
    profile.policy = profile.policy || {
      data_only: true,
      execution_authority: "none",
      preserve_semantics: true,
      unknown_role: "namespaced-extension",
      visual_change: "invalidate-approval"
    };
    profile.approval = profile.approval || { technical: "UNTESTED", visual: "UNREVIEWED", canon: false };
    profile.digest = digest(profile);
    return profile;
  }

  function validateProfile(profile, registry) {
    var errors = [], warnings = [], codes = [];
    if (!profile || profile.schema !== PROFILE_SCHEMA) errors.push("profile schema mismatch");
    if (!profile || !ID.test(String(profile.id || ""))) errors.push("profile id must be portable lowercase dotted or dashed text");
    if (!profile || !String(profile.version || "").trim()) errors.push("profile version required");
    if (!profile || !String(profile.title || "").trim()) errors.push("profile title required");
    if (!profile || !DIGEST.test(String(profile.digest || "")) || profile.digest !== digest(profile)) errors.push("profile digest mismatch");

    var policy = profile && profile.policy;
    if (!policy || policy.data_only !== true || policy.execution_authority !== "none" || policy.preserve_semantics !== true || policy.visual_change !== "invalidate-approval") errors.push("visual grammar fail-closed policy required");
    if (!policy || ["fail", "namespaced-extension"].indexOf(policy.unknown_role) < 0) errors.push("unknown-role policy required");
    var approval = profile && profile.approval;
    if (!approval || typeof approval.canon !== "boolean" || !approval.technical || !approval.visual) errors.push("separate technical, visual and canon approval state required");

    var graphValidation = UCP.validateGraph(profile && profile.graph, registry);
    errors = errors.concat(graphValidation.errors || []);
    codes = codes.concat(graphValidation.codes || []);

    var graphInstances = new Set(((profile && profile.graph && profile.graph.components) || []).map(function (item) { return item.instance_id; }));
    var boundInstances = new Set(), roles = new Set();
    var bindings = profile && Array.isArray(profile.role_bindings) ? profile.role_bindings : [];
    if (!bindings.length) errors.push("at least one visual role binding required");
    bindings.forEach(function (binding) {
      if (!binding || !graphInstances.has(binding.instance_id)) errors.push("role binding references unknown instance " + String(binding && binding.instance_id || ""));
      if (binding && boundInstances.has(binding.instance_id)) errors.push("instance has more than one primary visual role " + binding.instance_id);
      if (binding) boundInstances.add(binding.instance_id);
      var expected = binding && roleCategory(binding.role);
      if (!expected) errors.push("unknown visual role " + String(binding && binding.role || ""));
      else if (expected !== "extension" && binding.category !== expected) errors.push("role/category mismatch for " + binding.role + ": expected " + expected);
      else if (expected === "extension" && binding.category !== "extension") errors.push("namespaced role must use extension category");
      if (!binding || PLANES.indexOf(binding.plane) < 0) errors.push("invalid visual plane for " + String(binding && binding.instance_id || ""));
      if (!binding || typeof binding.editable !== "boolean") errors.push("editable flag required for " + String(binding && binding.instance_id || ""));
      if (binding) roles.add(binding.role);
    });

    var missingRoles = (profile && profile.required_roles || []).filter(function (role) { return !roles.has(role); });
    if (missingRoles.length) { errors.push("missing required visual roles: " + missingRoles.join(", ")); codes.push("MISSING_ROLE"); }
    (profile && profile.protected_instances || []).forEach(function (id) {
      if (!graphInstances.has(id)) errors.push("protected instance is not in graph: " + id);
    });
    var graphOutputs = new Set(((profile && profile.graph && profile.graph.outputs) || []).map(function (item) { return item.id; }));
    var targets = profile && Array.isArray(profile.target_outputs) ? profile.target_outputs : [];
    if (!targets.length) errors.push("at least one target output required");
    targets.forEach(function (target) {
      if (!target || !graphOutputs.has(target.output_id)) errors.push("target output is not a graph output: " + String(target && target.output_id || ""));
      if (!target || !String(target.mime || "").includes("/")) errors.push("target output MIME required");
      if (!target || typeof target.required !== "boolean") errors.push("target output required flag missing");
    });
    if (policy && policy.unknown_role === "fail" && bindings.some(function (binding) { return extensionRole(binding.role); })) errors.push("namespaced extension role refused by profile policy");
    if (errors.some(function (item) { return item.indexOf("missing exact") >= 0; })) codes.push("MISSING_COMPONENT");
    return {
      pass: errors.length === 0,
      errors: unique(errors),
      warnings: unique(warnings.concat(graphValidation.warnings || [])),
      codes: unique(codes),
      graph_validation: graphValidation,
      role_inventory: bindings.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0) || a.instance_id.localeCompare(b.instance_id); }),
      missing_roles: missingRoles
    };
  }

  function statusFromValidation(validation) {
    if (validation.codes.indexOf("MISSING_ROLE") >= 0) return "MISSING_ROLE";
    if (validation.codes.indexOf("MISSING_COMPONENT") >= 0) return "MISSING_COMPONENT";
    if (validation.codes.indexOf("UNSUPPORTED_CANVAS") >= 0) return "UNSUPPORTED_CANVAS";
    return "INVALID_PROFILE";
  }

  function plan(profile, registry, options) {
    options = options || {};
    var validation = validateProfile(profile, registry);
    var graphReceipt = UCP.compose(profile && profile.graph || {}, registry, { createdAt: options.createdAt });
    var required = unique((profile && profile.required_capabilities || []).concat(graphReceipt.required_capabilities || []));
    var inventorySupplied = Array.isArray(options.availableCapabilities);
    var available = new Set(options.availableCapabilities || []);
    var missing = inventorySupplied ? required.filter(function (capability) { return !available.has(capability); }) : [];
    var status = !validation.pass ? statusFromValidation(validation)
      : !inventorySupplied && required.length ? "CAPABILITY_INVENTORY_REQUIRED"
      : missing.length ? "MISSING_HANDS"
      : "READY_CONTRACT";
    var receipt = {
      schema: ROUTE_SCHEMA,
      status: status,
      profile_id: String(profile && profile.id || "unknown"),
      profile_digest: String(profile && profile.digest || UCP.sha256(profile || {})),
      graph_digest: String(profile && profile.graph && profile.graph.digest || UCP.sha256(profile && profile.graph || {})),
      required_capabilities: required,
      missing_capabilities: missing,
      capability_inventory_supplied: inventorySupplied,
      role_inventory: validation.role_inventory,
      target_outputs: clone(profile && profile.target_outputs || []),
      resource_summary: graphReceipt.resource_summary || null,
      known_losses: graphReceipt.known_losses || [],
      checks: [
        { id: "profile-integrity", pass: validation.pass, details: validation.errors.join("; ") || "profile, roles and policy agree" },
        { id: "component-graph", pass: graphReceipt.status === "READY_CONTRACT", details: graphReceipt.status },
        { id: "capability-route", pass: inventorySupplied && missing.length === 0, details: !inventorySupplied ? "capability inventory not supplied" : missing.length ? "missing: " + missing.join(", ") : "all required hands declared available" }
      ],
      truth: { contract_only: true, executed: false, rendered: false, visually_approved: false, canon_promoted: false },
      created_at: String(options.createdAt || new Date().toISOString())
    };
    receipt.digest = digest(receipt);
    return receipt;
  }

  function swapComponents(profile, replacements, registry, options) {
    options = options || {};
    var before = validateProfile(profile, registry), errors = [];
    if (!before.pass) errors.push("base profile is invalid: " + before.errors.join("; "));
    var next = clone(profile || {}), changed = [];
    var refs = new Map(((next.graph && next.graph.components) || []).map(function (item) { return [item.instance_id, item]; }));
    var bindings = new Map((next.role_bindings || []).map(function (item) { return [item.instance_id, item]; }));
    (replacements || []).forEach(function (replacement) {
      var instanceId = replacement && replacement.instance_id;
      var ref = refs.get(instanceId), binding = bindings.get(instanceId);
      if (!ref || !binding) { errors.push("replacement instance not found: " + String(instanceId || "")); return; }
      if ((next.protected_instances || []).indexOf(instanceId) >= 0 || binding.plane !== "presentation" || binding.editable !== true) {
        errors.push("replacement refused for protected or non-editable instance: " + instanceId); return;
      }
      var componentRef = replacement.component || {};
      var component = registry && registry.resolve(componentRef);
      if (!component) { errors.push("replacement component does not resolve exactly for " + instanceId); return; }
      changed.push({ instance_id: instanceId, role: binding.role, from_digest: ref.component_digest, to_digest: component.digest });
      ref.component_id = component.id;
      ref.component_version = component.version;
      ref.component_digest = component.digest;
      if (Object.prototype.hasOwnProperty.call(replacement, "configuration")) ref.configuration = clone(replacement.configuration);
    });
    if (!changed.length) errors.push("no presentation components were replaced");
    if (!errors.length) {
      next.graph = UCP.sealGraph(next.graph);
      next.approval = { technical: "UNTESTED", visual: "INVALIDATED", canon: false };
      next.digest = undefined;
      next = sealProfile(next);
      var after = validateProfile(next, registry);
      if (!after.pass) errors.push("replacement graph is incompatible: " + after.errors.join("; "));
    }
    var status = errors.length ? "REFUSED" : "SWAPPED";
    var receipt = {
      schema: SWAP_SCHEMA,
      status: status,
      profile_id: String(profile && profile.id || "unknown"),
      before_digest: String(profile && profile.digest || UCP.sha256(profile || {})),
      after_digest: errors.length ? null : next.digest,
      changes: changed,
      approval_after: errors.length ? clone(profile && profile.approval || null) : clone(next.approval),
      errors: unique(errors),
      truth: { data_only: true, executed: false, rendered: false, visual_approval_invalidated: !errors.length, canon_promoted: false },
      created_at: String(options.createdAt || new Date().toISOString())
    };
    receipt.digest = digest(receipt);
    return { status: status, profile: errors.length ? null : next, receipt: receipt };
  }

  return Object.freeze({
    VERSION: VERSION,
    PROFILE_SCHEMA: PROFILE_SCHEMA,
    ROUTE_SCHEMA: ROUTE_SCHEMA,
    SWAP_SCHEMA: SWAP_SCHEMA,
    ROLE_CATALOG: ROLE_CATALOG,
    sealProfile: sealProfile,
    validateProfile: validateProfile,
    plan: plan,
    swapComponents: swapComponents
  });
});
