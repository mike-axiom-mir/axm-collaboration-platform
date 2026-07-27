(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("../asset-hands/native-bridge-codec")
      : root.AXMNativeBridgeCodec
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMGameOrganism = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Codec) {
  "use strict";

  if (!Codec || typeof Codec.sha256 !== "function")
    throw new Error("AXM Game Organism requires the portable SHA-256 codec");

  var ORGAN_SCHEMA = "axm.game-organ/v1";
  var BLUEPRINT_SCHEMA = "axm.game-organism-blueprint/v1";
  var RECEIPT_SCHEMA = "axm.game-organism-assembly-receipt/v1";
  var ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
  var DIGEST = /^[a-f0-9]{64}$/;
  var CATEGORIES = [
    "intent", "design", "world-rules", "physics", "animation", "asset",
    "assembly", "playtest-eye", "evidence", "repair", "release-gate"
  ];

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function unique(values) { return Array.from(new Set(values || [])).sort(); }
  function withoutDigest(value) { var copy = clone(value || {}); delete copy.digest; return copy; }
  function digest(value) { return Codec.sha256(withoutDigest(value)); }
  function key(id, version) { return String(id) + "@" + String(version); }
  function portMap(organ, direction) {
    var map = new Map();
    (((organ || {}).ports || {})[direction] || []).forEach(function (port) { map.set(port.id, port); });
    return map;
  }
  function typesMatch(outputType, inputType) {
    return outputType === inputType || outputType === "*" || inputType === "*";
  }

  function validatePortSet(ports, label, errors) {
    if (!Array.isArray(ports)) { errors.push(label + " ports required"); return; }
    var seen = new Set();
    ports.forEach(function (port) {
      if (!port || !ID.test(String(port.id || ""))) errors.push("invalid " + label + " port id");
      else if (seen.has(port.id)) errors.push("duplicate " + label + " port " + port.id);
      else seen.add(port.id);
      if (!port || !String(port.type || "").trim()) errors.push(label + " port type required");
      if (!port || typeof port.required !== "boolean" || typeof port.multiple !== "boolean")
        errors.push(label + " port flags required");
    });
  }

  function validateOrgan(organ) {
    var errors = [], warnings = [];
    if (!organ || organ.schema !== ORGAN_SCHEMA) errors.push("organ schema mismatch");
    if (!organ || !ID.test(String(organ.id || ""))) errors.push("portable organ id required");
    if (!organ || !String(organ.version || "").trim()) errors.push("organ version required");
    if (!organ || CATEGORIES.indexOf(organ.category) < 0) errors.push("unknown organ category");
    if (!organ || !String(organ.title || "").trim()) errors.push("organ title required");
    validatePortSet(organ && organ.ports && organ.ports.inputs, "input", errors);
    validatePortSet(organ && organ.ports && organ.ports.outputs, "output", errors);
    var capabilities = organ && organ.capabilities;
    if (!capabilities || !Array.isArray(capabilities.provides) || !Array.isArray(capabilities.requires))
      errors.push("organ capabilities required");
    var authority = organ && organ.authority;
    if (!authority || authority.execution_scope !== "candidate-only") errors.push("candidate-only execution scope required");
    if (!authority || authority.canonical_writes !== false) errors.push("canonical writes must be false");
    if (!authority || authority.automatic_promotion !== false) errors.push("automatic promotion must be false");
    if (!authority || authority.network !== "none" || authority.side_effects !== "none")
      errors.push("organ must be side-effect-free and offline at this experimental rung");
    var budget = organ && organ.resource_budget;
    ["cpu_weight", "gpu_weight", "peak_memory_mb", "working_storage_mb"].forEach(function (field) {
      if (!budget || !Number.isInteger(budget[field]) || budget[field] < 0) errors.push("invalid resource budget " + field);
    });
    var verification = organ && organ.verification;
    if (!verification || !Array.isArray(verification.automatic_checks) || !Array.isArray(verification.human_judgments) || !String(verification.assurance_ceiling || ""))
      errors.push("verification contract required");
    if (!organ || !organ.implementation || !String(organ.implementation.reference || "")) errors.push("implementation reference required");
    if (!organ || !DIGEST.test(String(organ.digest || ""))) errors.push("organ digest required");
    else if (organ.digest !== digest(organ)) errors.push("organ digest mismatch");
    if (verification && verification.human_judgments.length) warnings.push("human judgment remains outside automatic verification");
    return { pass: errors.length === 0, errors: unique(errors), warnings: unique(warnings) };
  }

  function sealOrgan(input) {
    var organ = clone(input || {});
    organ.schema = ORGAN_SCHEMA;
    organ.version = String(organ.version || "1.0.0");
    organ.ports = organ.ports || { inputs: [], outputs: [] };
    organ.capabilities = organ.capabilities || { provides: [], requires: [] };
    organ.authority = organ.authority || {};
    organ.authority.execution_scope = "candidate-only";
    organ.authority.canonical_writes = false;
    organ.authority.automatic_promotion = false;
    organ.authority.network = "none";
    organ.authority.side_effects = "none";
    organ.resource_budget = organ.resource_budget || { cpu_weight: 0, gpu_weight: 0, peak_memory_mb: 0, working_storage_mb: 0 };
    organ.verification = organ.verification || { automatic_checks: [], human_judgments: [], assurance_ceiling: "contract-only" };
    organ.implementation = organ.implementation || { kind: "declared-machine", reference: "unimplemented", status: "DECLARED" };
    organ.digest = digest(organ);
    var checked = validateOrgan(organ);
    if (!checked.pass) throw new Error(checked.errors.join("; "));
    return organ;
  }

  function createRegistry(initial) {
    var records = new Map();
    function register(organ) {
      var checked = validateOrgan(organ);
      if (!checked.pass) throw new Error(checked.errors.join("; "));
      var recordKey = key(organ.id, organ.version), existing = records.get(recordKey);
      if (existing && existing.digest !== organ.digest) throw new Error("organ version collision for " + recordKey);
      if (!existing) records.set(recordKey, clone(organ));
      return clone(records.get(recordKey));
    }
    function resolve(reference) {
      var organ = records.get(key(reference.organ_id, reference.organ_version));
      if (!organ || organ.digest !== reference.organ_digest) return null;
      return clone(organ);
    }
    (initial || []).forEach(register);
    return {
      schema: "axm.game-organ-registry/v1",
      register: register,
      resolve: resolve,
      list: function () { return Array.from(records.values()).map(clone).sort(function (a, b) { return key(a.id, a.version).localeCompare(key(b.id, b.version)); }); }
    };
  }

  function sealBlueprint(input) {
    var blueprint = clone(input || {});
    blueprint.schema = BLUEPRINT_SCHEMA;
    blueprint.version = String(blueprint.version || "1.0.0");
    blueprint.organs = blueprint.organs || [];
    blueprint.connections = blueprint.connections || [];
    blueprint.required_categories = blueprint.required_categories || [];
    blueprint.host_capabilities = blueprint.host_capabilities || [];
    blueprint.resource_budget = blueprint.resource_budget || { cpu_weight: 20, gpu_weight: 20, peak_memory_mb: 1024, working_storage_mb: 2048 };
    blueprint.policy = {
      candidate_only: true,
      execution_authority: "none",
      automatic_promotion: false,
      missing_organ: "hold",
      category_conflict: "hold"
    };
    blueprint.digest = digest(blueprint);
    return blueprint;
  }

  function compile(blueprint, registry) {
    var errors = [], warnings = [], codes = [], resolved = new Map(), instances = new Map();
    if (!blueprint || blueprint.schema !== BLUEPRINT_SCHEMA) errors.push("blueprint schema mismatch");
    if (!blueprint || !ID.test(String(blueprint.id || ""))) errors.push("portable blueprint id required");
    if (!blueprint || !DIGEST.test(String(blueprint.digest || "")) || blueprint.digest !== digest(blueprint)) errors.push("blueprint digest mismatch");
    var policy = blueprint && blueprint.policy;
    if (!policy || policy.candidate_only !== true || policy.execution_authority !== "none" || policy.automatic_promotion !== false || policy.missing_organ !== "hold" || policy.category_conflict !== "hold")
      errors.push("fail-closed candidate policy required");

    (blueprint && blueprint.organs || []).forEach(function (reference) {
      if (!reference || !ID.test(String(reference.instance_id || ""))) { errors.push("invalid organ instance id"); return; }
      if (instances.has(reference.instance_id)) { errors.push("duplicate organ instance " + reference.instance_id); return; }
      instances.set(reference.instance_id, reference);
      var organ = registry && registry.resolve(reference);
      if (!organ) { errors.push("missing exact organ " + reference.organ_id + "@" + reference.organ_version); codes.push("MISSING_ORGAN"); return; }
      resolved.set(reference.instance_id, organ);
      if (reference.slot_category !== organ.category) {
        errors.push("category conflict at " + reference.instance_id + ": slot " + reference.slot_category + " cannot accept " + organ.category);
        codes.push("CATEGORY_CONFLICT");
      }
    });
    if (!instances.size) errors.push("blueprint requires organs");

    var presentCategories = unique(Array.from(resolved.values()).map(function (organ) { return organ.category; }));
    (blueprint && blueprint.required_categories || []).forEach(function (category) {
      if (presentCategories.indexOf(category) < 0) { errors.push("required category missing: " + category); codes.push("MISSING_CATEGORY"); }
    });

    var provided = new Set(blueprint && blueprint.host_capabilities || []);
    resolved.forEach(function (organ) { (organ.capabilities.provides || []).forEach(function (capability) { provided.add(capability); }); });
    resolved.forEach(function (organ, instanceId) {
      (organ.capabilities.requires || []).forEach(function (capability) {
        if (!provided.has(capability)) { errors.push("missing capability for " + instanceId + ": " + capability); codes.push("MISSING_CAPABILITY"); }
      });
    });

    var incoming = new Map(), outgoing = new Map(), boundPorts = new Map();
    instances.forEach(function (_, id) { incoming.set(id, 0); outgoing.set(id, []); boundPorts.set(id, new Map()); });
    (blueprint && blueprint.connections || []).forEach(function (connection, index) {
      var fromRef = connection && instances.get(connection.from && connection.from.instance_id);
      var toRef = connection && instances.get(connection.to && connection.to.instance_id);
      if (!fromRef || !toRef) { errors.push("connection " + index + " references an unknown organ"); codes.push("MISSING_ORGAN"); return; }
      var source = resolved.get(fromRef.instance_id), target = resolved.get(toRef.instance_id);
      if (!source || !target) return;
      var sourcePort = portMap(source, "outputs").get(connection.from.port);
      var targetPort = portMap(target, "inputs").get(connection.to.port);
      if (!sourcePort) errors.push("connection " + index + " source port missing");
      if (!targetPort) errors.push("connection " + index + " target port missing");
      if (sourcePort && targetPort && !typesMatch(sourcePort.type, targetPort.type)) {
        errors.push("connection " + index + " type mismatch " + sourcePort.type + " -> " + targetPort.type);
        codes.push("TYPE_MISMATCH");
      }
      var count = boundPorts.get(toRef.instance_id).get(connection.to.port) || 0;
      if (targetPort && !targetPort.multiple && count) errors.push("input does not accept multiple connections: " + toRef.instance_id + "." + connection.to.port);
      boundPorts.get(toRef.instance_id).set(connection.to.port, count + 1);
      outgoing.get(fromRef.instance_id).push(toRef.instance_id);
      incoming.set(toRef.instance_id, incoming.get(toRef.instance_id) + 1);
    });
    resolved.forEach(function (organ, instanceId) {
      portMap(organ, "inputs").forEach(function (port) {
        if (port.required && !(boundPorts.get(instanceId).get(port.id) > 0)) {
          errors.push("required input is unbound: " + instanceId + "." + port.id);
          codes.push("UNBOUND_INPUT");
        }
      });
    });

    var queue = [], order = [];
    incoming.forEach(function (count, id) { if (count === 0) queue.push(id); });
    queue.sort();
    while (queue.length) {
      var current = queue.shift(); order.push(current);
      (outgoing.get(current) || []).slice().sort().forEach(function (next) {
        incoming.set(next, incoming.get(next) - 1);
        if (incoming.get(next) === 0) { queue.push(next); queue.sort(); }
      });
    }
    if (order.length !== instances.size) { errors.push("organ graph contains a cycle"); codes.push("CYCLE"); }

    var resources = { cpu_weight: 0, gpu_weight: 0, peak_memory_mb: 0, working_storage_mb: 0 };
    resolved.forEach(function (organ) {
      Object.keys(resources).forEach(function (field) { resources[field] += organ.resource_budget[field]; });
    });
    Object.keys(resources).forEach(function (field) {
      var limit = blueprint && blueprint.resource_budget && blueprint.resource_budget[field];
      if (!Number.isInteger(limit) || limit < 0 || resources[field] > limit) {
        errors.push("resource budget exceeded: " + field + " " + resources[field] + "/" + limit);
        codes.push("RESOURCE_BUDGET");
      }
    });

    var evidence = [], judgments = [];
    resolved.forEach(function (organ, instanceId) {
      (organ.verification.automatic_checks || []).forEach(function (check) { evidence.push(instanceId + ":" + check); });
      (organ.verification.human_judgments || []).forEach(function (check) { judgments.push(instanceId + ":" + check); });
      if (organ.implementation.status === "DECLARED") warnings.push(instanceId + " is declared but has no available runtime");
    });
    if (judgments.length) warnings.push("human judgments remain unresolved until a steward reviews the candidate");

    var receipt = {
      schema: RECEIPT_SCHEMA,
      blueprint: { id: blueprint && blueprint.id || null, version: blueprint && blueprint.version || null, digest: blueprint && blueprint.digest || null },
      verdict: errors.length ? "HELD" : "CANDIDATE_READY",
      codes: unique(codes),
      errors: unique(errors),
      warnings: unique(warnings),
      execution_order: order,
      categories: presentCategories,
      resources: resources,
      evidence_plan: unique(evidence),
      human_judgments: unique(judgments),
      truth: {
        assemblyPlanCreated: errors.length === 0,
        executionStarted: false,
        canonicalGameChanged: false,
        automaticPromotion: false,
        humanReleaseRequired: true
      }
    };
    receipt.digest = Codec.sha256(receipt);
    return receipt;
  }

  return {
    VERSION: "0.1.0",
    ORGAN_SCHEMA: ORGAN_SCHEMA,
    BLUEPRINT_SCHEMA: BLUEPRINT_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CATEGORIES: CATEGORIES.slice(),
    sealOrgan: sealOrgan,
    validateOrgan: validateOrgan,
    createRegistry: createRegistry,
    sealBlueprint: sealBlueprint,
    compile: compile
  };
});
