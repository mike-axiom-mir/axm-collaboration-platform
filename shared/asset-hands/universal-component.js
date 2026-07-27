(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./target-canvas")
      : root.AXMTargetCanvas,
    typeof module === "object" && module.exports
      ? require("./native-bridge-codec")
      : root.AXMNativeBridgeCodec,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMUniversalComponentProtocol = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (TargetCanvas, Digest) {
  "use strict";

  if (!TargetCanvas || !Digest || typeof Digest.sha256 !== "function")
    throw new Error("AXM UCP requires Target Canvas and the portable SHA-256 codec");

  var VERSION = "1.0.0";
  var COMPONENT_SCHEMA = "axm.universal-component/v1";
  var GRAPH_SCHEMA = "axm.universal-component-graph/v1";
  var RECEIPT_SCHEMA = "axm.universal-component-composition-receipt/v1";
  var DIGEST = /^[a-f0-9]{64}$/;
  var ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
  var INTENSITY = { none: 0, light: 1, medium: 2, heavy: 3 };
  var INTENSITY_NAMES = ["none", "light", "medium", "heavy"];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function unique(values) {
    return Array.from(new Set(values || [])).sort();
  }
  function withoutDigest(value) {
    var copy = clone(value || {});
    delete copy.digest;
    return copy;
  }
  function digest(value) {
    return Digest.sha256(withoutDigest(value));
  }
  function isPortableStorageRef(value) {
    if (value == null || value === "") return true;
    var text = String(value);
    return !/^[a-z]:[\\/]/i.test(text) && !/^[/\\]{1,2}/.test(text) && !/^file:/i.test(text);
  }
  function portMap(component, direction) {
    var map = new Map();
    ((component.ports && component.ports[direction]) || []).forEach(function (port) {
      map.set(port.id, port);
    });
    return map;
  }
  function portTypesMatch(outputType, inputType) {
    return outputType === inputType || outputType === "*" || inputType === "*";
  }
  function componentKey(id, version) {
    return String(id) + "@" + String(version);
  }

  function validateComponent(component) {
    var errors = [], warnings = [];
    if (!component || component.schema !== COMPONENT_SCHEMA) errors.push("component schema mismatch");
    if (!component || !ID.test(String(component.id || ""))) errors.push("component id must be portable lowercase dotted or dashed text");
    if (!component || !String(component.version || "").trim()) errors.push("component version required");
    if (!component || !ID.test(String(component.kind || ""))) errors.push("component kind must be portable lowercase dotted or dashed text");
    if (!component || !String(component.title || "").trim()) errors.push("component title required");
    var inputIds = new Set(), outputIds = new Set();
    ["inputs", "outputs"].forEach(function (direction) {
      var ports = component && component.ports && component.ports[direction];
      if (!Array.isArray(ports)) {
        errors.push(direction + " ports required");
        return;
      }
      ports.forEach(function (port) {
        var seen = direction === "inputs" ? inputIds : outputIds;
        if (!port || !ID.test(String(port.id || ""))) errors.push("invalid " + direction + " port id");
        else if (seen.has(port.id)) errors.push("duplicate " + direction + " port " + port.id);
        else seen.add(port.id);
        if (!port || !String(port.type || "").trim()) errors.push("port type required");
        if (!port || typeof port.required !== "boolean" || typeof port.multiple !== "boolean") errors.push("port required/multiple flags required");
      });
    });
    var compatibility = component && component.canvas_compatibility;
    if (!compatibility || !Array.isArray(compatibility.mediums) || !compatibility.mediums.length) errors.push("canvas mediums required");
    if (!compatibility || !Array.isArray(compatibility.intended_uses) || !compatibility.intended_uses.length) errors.push("canvas intended uses required");
    if (!compatibility || !Array.isArray(compatibility.constraints)) errors.push("canvas constraints required");
    var capabilities = component && component.capabilities;
    if (!capabilities || !Array.isArray(capabilities.provides) || !Array.isArray(capabilities.requires)) errors.push("component capability declaration required");
    if (!Array.isArray(component && component.artifact_refs)) errors.push("artifact_refs required");
    else component.artifact_refs.forEach(function (artifact) {
      if (!artifact || !artifact.id || !artifact.role || !artifact.mime || !DIGEST.test(String(artifact.digest || ""))) errors.push("invalid artifact reference");
      if (artifact && !isPortableStorageRef(artifact.storage_ref)) errors.push("artifact storage_ref must be portable, relative or vault-addressed");
    });
    if (!component || !component.payload || typeof component.payload !== "object" || Array.isArray(component.payload)) errors.push("small JSON payload required");
    else if (Digest.canonical(component.payload).length > 1024 * 1024) errors.push("component payload exceeds 1 MiB; use artifact_refs for large data");
    var provenance = component && component.provenance;
    ["origin_type", "source_id", "source_digest", "license_id", "created_by", "created_at"].forEach(function (field) {
      if (!provenance || !String(provenance[field] || "").trim()) errors.push("provenance " + field + " required");
    });
    if (provenance && !DIGEST.test(String(provenance.source_digest || ""))) errors.push("provenance source_digest must be SHA-256");
    var resource = component && component.resource_profile;
    if (!resource || !Object.prototype.hasOwnProperty.call(INTENSITY, resource.cpu) || !Object.prototype.hasOwnProperty.call(INTENSITY, resource.gpu)) errors.push("resource CPU/GPU intensity required");
    if (!resource || typeof resource.native_runtime === "undefined") errors.push("native runtime declaration required");
    var verification = component && component.verification;
    if (!verification || !Array.isArray(verification.automatic_checks) || !Array.isArray(verification.human_judgments) || !verification.assurance_ceiling) errors.push("verification boundary required");
    if (!component || ["immutable", "versioned"].indexOf(component.mutability) < 0) errors.push("component mutability must be immutable or versioned");
    if (component && component.kind === "adapter") {
      if (!component.adapter || !Array.isArray(component.adapter.from_types) || !Array.isArray(component.adapter.to_types) || !component.adapter.required_hand || !Array.isArray(component.adapter.known_losses)) errors.push("adapter components require exact types, hand and loss declaration");
      else if (!component.adapter.known_losses.length) warnings.push("adapter declares a lossless route; runtime parity still needs evidence");
    }
    if (!component || !DIGEST.test(String(component.digest || ""))) errors.push("component digest required");
    else if (component.digest !== digest(component)) errors.push("component digest mismatch");
    return { pass: errors.length === 0, errors: unique(errors), warnings: unique(warnings) };
  }

  function sealComponent(input) {
    var component = clone(input || {});
    component.schema = COMPONENT_SCHEMA;
    component.version = String(component.version || "1.0.0");
    component.ports = component.ports || { inputs: [], outputs: [] };
    component.canvas_compatibility = component.canvas_compatibility || { mediums: ["*"], intended_uses: ["*"], constraints: [] };
    component.capabilities = component.capabilities || { provides: [], requires: [] };
    component.artifact_refs = component.artifact_refs || [];
    component.payload = component.payload || {};
    component.resource_profile = component.resource_profile || { cpu: "none", gpu: "none", peak_memory_bytes: 0, working_storage_bytes: 0, native_runtime: null };
    component.verification = component.verification || { automatic_checks: [], human_judgments: [], assurance_ceiling: "contract-only" };
    component.mutability = component.mutability || "immutable";
    component.digest = digest(component);
    var result = validateComponent(component);
    if (!result.pass) throw new Error(result.errors.join("; "));
    return component;
  }

  function createRegistry(initial) {
    var records = new Map();
    function register(component) {
      var validation = validateComponent(component);
      if (!validation.pass) throw new Error(validation.errors.join("; "));
      var key = componentKey(component.id, component.version), existing = records.get(key);
      if (existing && existing.digest !== component.digest) throw new Error("component version collision for " + key);
      if (!existing) records.set(key, clone(component));
      return clone(records.get(key));
    }
    function resolve(reference) {
      var component = records.get(componentKey(reference.component_id, reference.component_version));
      if (!component || component.digest !== reference.component_digest) return null;
      return clone(component);
    }
    (initial || []).forEach(register);
    return {
      schema: "axm.universal-component-registry/v1",
      register: register,
      resolve: resolve,
      get: function (id, version) { return clone(records.get(componentKey(id, version)) || null); },
      list: function () { return Array.from(records.values()).map(clone).sort(function (a, b) { return componentKey(a.id, a.version).localeCompare(componentKey(b.id, b.version)); }); },
    };
  }

  function sealGraph(input) {
    var graph = clone(input || {});
    graph.schema = GRAPH_SCHEMA;
    graph.version = String(graph.version || "1.0.0");
    graph.components = graph.components || [];
    graph.connections = graph.connections || [];
    graph.outputs = graph.outputs || [];
    graph.policy = graph.policy || { acyclic: true, missing_component: "fail", loss_policy: "declare", execution_authority: "none" };
    graph.digest = digest(graph);
    return graph;
  }

  function canvasCompatible(component, canvas) {
    var profile = component.canvas_compatibility || {}, mediums = profile.mediums || [], uses = profile.intended_uses || [];
    return (mediums.indexOf("*") >= 0 || mediums.indexOf(canvas.medium) >= 0) && (uses.indexOf("*") >= 0 || uses.indexOf(canvas.intended_use) >= 0);
  }

  function validateGraph(graph, registry) {
    var errors = [], warnings = [], codes = [], resolved = new Map(), instances = new Map();
    if (!graph || graph.schema !== GRAPH_SCHEMA) errors.push("graph schema mismatch");
    if (!graph || !ID.test(String(graph.id || ""))) errors.push("graph id must be portable lowercase dotted or dashed text");
    if (!graph || !DIGEST.test(String(graph.digest || ""))) errors.push("graph digest required");
    else if (graph.digest !== digest(graph)) errors.push("graph digest mismatch");
    var canvasValidation = TargetCanvas.validate(graph && graph.target_canvas);
    if (!canvasValidation.pass) {
      errors.push("target canvas invalid: " + canvasValidation.errors.join(", "));
      codes.push("UNSUPPORTED_CANVAS");
    }
    if (!graph || !graph.policy || graph.policy.acyclic !== true || graph.policy.missing_component !== "fail" || graph.policy.execution_authority !== "none") errors.push("graph fail-closed policy required");
    var refs = graph && Array.isArray(graph.components) ? graph.components : [];
    if (!refs.length) errors.push("graph requires components");
    refs.forEach(function (reference) {
      if (!reference || !ID.test(String(reference.instance_id || ""))) { errors.push("invalid component instance id"); return; }
      if (instances.has(reference.instance_id)) { errors.push("duplicate component instance " + reference.instance_id); return; }
      instances.set(reference.instance_id, reference);
      var component = registry && registry.resolve(reference);
      if (!component) {
        errors.push("missing exact component " + reference.component_id + "@" + reference.component_version);
        codes.push("MISSING_COMPONENT");
        return;
      }
      resolved.set(reference.instance_id, component);
      if (canvasValidation.pass && !canvasCompatible(component, graph.target_canvas)) {
        errors.push("component " + reference.instance_id + " does not support target canvas");
        codes.push("UNSUPPORTED_CANVAS");
      }
      if (component.kind === "adapter" && component.adapter.known_losses.length && graph.policy.loss_policy === "refuse") errors.push("lossy adapter " + reference.instance_id + " refused by graph policy");
    });
    var incoming = new Map(), outgoing = new Map(), incomingPorts = new Map();
    refs.forEach(function (reference) { incoming.set(reference.instance_id, 0); outgoing.set(reference.instance_id, []); incomingPorts.set(reference.instance_id, new Map()); });
    (graph && Array.isArray(graph.connections) ? graph.connections : []).forEach(function (connection, index) {
      var from = connection && instances.get(connection.from && connection.from.instance_id), to = connection && instances.get(connection.to && connection.to.instance_id);
      if (!from || !to) { errors.push("connection " + index + " references an unknown instance"); return; }
      var source = resolved.get(from.instance_id), target = resolved.get(to.instance_id);
      if (!source || !target) return;
      var sourcePort = portMap(source, "outputs").get(connection.from.port), targetPort = portMap(target, "inputs").get(connection.to.port);
      if (!sourcePort) errors.push("connection " + index + " source port missing");
      if (!targetPort) errors.push("connection " + index + " target port missing");
      if (sourcePort && targetPort && !portTypesMatch(sourcePort.type, targetPort.type)) errors.push("connection " + index + " type mismatch " + sourcePort.type + " -> " + targetPort.type);
      var bound = incomingPorts.get(to.instance_id), count = bound.get(connection.to.port) || 0;
      if (targetPort && !targetPort.multiple && count) errors.push("input port " + to.instance_id + "." + connection.to.port + " does not accept multiple connections");
      bound.set(connection.to.port, count + 1);
      outgoing.get(from.instance_id).push(to.instance_id);
      incoming.set(to.instance_id, incoming.get(to.instance_id) + 1);
    });
    resolved.forEach(function (component, instanceId) {
      portMap(component, "inputs").forEach(function (port) {
        if (port.required && !(incomingPorts.get(instanceId).get(port.id) > 0)) errors.push("required input is unbound: " + instanceId + "." + port.id);
      });
    });
    (graph && Array.isArray(graph.outputs) ? graph.outputs : []).forEach(function (output) {
      var component = resolved.get(output.instance_id);
      if (!component || !portMap(component, "outputs").has(output.port)) errors.push("graph output references a missing output port: " + output.instance_id + "." + output.port);
    });
    if (!graph || !Array.isArray(graph.outputs) || !graph.outputs.length) errors.push("graph requires at least one output");
    var queue = [], order = [];
    incoming.forEach(function (count, id) { if (count === 0) queue.push(id); });
    queue.sort();
    while (queue.length) {
      var current = queue.shift();
      order.push(current);
      (outgoing.get(current) || []).slice().sort().forEach(function (next) {
        incoming.set(next, incoming.get(next) - 1);
        if (incoming.get(next) === 0) { queue.push(next); queue.sort(); }
      });
    }
    if (order.length !== refs.length) errors.push("component graph contains a cycle");
    if (errors.some(function (item) { return item.indexOf("unknown") >= 0 || item.indexOf("missing exact") >= 0; })) codes.push("MISSING_COMPONENT");
    return { pass: errors.length === 0, errors: unique(errors), warnings: unique(warnings), codes: unique(codes), resolved: resolved, execution_order: order };
  }

  function compose(graph, registry, options) {
    var validation = validateGraph(graph, registry), components = [], capabilities = [], losses = [], cpu = 0, gpu = 0, memory = 0, storage = 0, unknownMemory = false, unknownStorage = false, runtimes = [];
    validation.resolved.forEach(function (component, instanceId) {
      components.push({ instance_id: instanceId, component_id: component.id, component_version: component.version, digest: component.digest });
      capabilities = capabilities.concat(component.capabilities.requires || []);
      var resource = component.resource_profile || {};
      cpu = Math.max(cpu, INTENSITY[resource.cpu] || 0);
      gpu = Math.max(gpu, INTENSITY[resource.gpu] || 0);
      if (resource.peak_memory_bytes == null) unknownMemory = true; else memory += resource.peak_memory_bytes;
      if (resource.working_storage_bytes == null) unknownStorage = true; else storage += resource.working_storage_bytes;
      if (resource.native_runtime) runtimes.push(resource.native_runtime);
      if (component.kind === "adapter") {
        capabilities.push(component.adapter.required_hand);
        losses = losses.concat(component.adapter.known_losses || []);
      }
    });
    var status = validation.pass ? "READY_CONTRACT" : validation.codes.indexOf("MISSING_COMPONENT") >= 0 ? "MISSING_COMPONENT" : validation.codes.indexOf("UNSUPPORTED_CANVAS") >= 0 ? "UNSUPPORTED_CANVAS" : "INVALID_GRAPH";
    var receipt = {
      schema: RECEIPT_SCHEMA,
      status: status,
      graph_id: String(graph && graph.id || "unknown"),
      graph_digest: DIGEST.test(String(graph && graph.digest || "")) ? graph.digest : Digest.sha256(graph || {}),
      target_canvas_digest: Digest.sha256(graph && graph.target_canvas || {}),
      component_digests: components.sort(function (a, b) { return a.instance_id.localeCompare(b.instance_id); }),
      execution_order: validation.execution_order,
      required_capabilities: unique(capabilities),
      resource_summary: { cpu: INTENSITY_NAMES[cpu], gpu: INTENSITY_NAMES[gpu], peak_memory_bytes: unknownMemory ? null : memory, working_storage_bytes: unknownStorage ? null : storage, native_runtimes: unique(runtimes) },
      known_losses: unique(losses),
      checks: [
        { id: "graph-integrity", pass: !validation.errors.some(function (item) { return /digest|schema|cycle/.test(item); }), details: validation.errors.filter(function (item) { return /digest|schema|cycle/.test(item); }).join("; ") || "schema, digests and acyclic structure agree" },
        { id: "component-resolution", pass: !validation.errors.some(function (item) { return /missing exact|unknown instance/.test(item); }), details: validation.errors.filter(function (item) { return /missing exact|unknown instance/.test(item); }).join("; ") || "all exact component versions resolved" },
        { id: "port-and-canvas-fit", pass: !validation.errors.some(function (item) { return /port|input|canvas|type mismatch/.test(item); }), details: validation.errors.filter(function (item) { return /port|input|canvas|type mismatch/.test(item); }).join("; ") || "ports, types and target canvas are compatible" },
      ],
      truth: { contract_only: true, executed: false, rendered: false, visually_approved: false, manufacturing_approved: false },
      created_at: String(options && options.createdAt || new Date().toISOString()),
    };
    receipt.digest = digest(receipt);
    return receipt;
  }

  function validateReceipt(receipt, graph) {
    var errors = [];
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) errors.push("receipt schema mismatch");
    if (!receipt || !DIGEST.test(String(receipt.digest || "")) || receipt.digest !== digest(receipt)) errors.push("receipt digest mismatch");
    if (graph && receipt.graph_digest !== graph.digest) errors.push("receipt graph digest mismatch");
    if (graph && receipt.graph_id !== graph.id) errors.push("receipt graph id mismatch");
    if (graph && receipt.target_canvas_digest !== Digest.sha256(graph.target_canvas || {})) errors.push("receipt target canvas digest mismatch");
    if (receipt && receipt.status === "READY_CONTRACT" && (!Array.isArray(receipt.checks) || receipt.checks.some(function (check) { return check.pass !== true; }))) errors.push("READY_CONTRACT receipt contains a failed check");
    if (!receipt || !receipt.truth || receipt.truth.contract_only !== true || receipt.truth.executed !== false || receipt.truth.rendered !== false || receipt.truth.visually_approved !== false || receipt.truth.manufacturing_approved !== false) errors.push("receipt truth boundary missing");
    return { pass: errors.length === 0, errors: unique(errors) };
  }

  return {
    VERSION: VERSION,
    COMPONENT_SCHEMA: COMPONENT_SCHEMA,
    GRAPH_SCHEMA: GRAPH_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    canonical: Digest.canonical,
    sha256: Digest.sha256,
    sealComponent: sealComponent,
    validateComponent: validateComponent,
    createRegistry: createRegistry,
    sealGraph: sealGraph,
    validateGraph: validateGraph,
    compose: compose,
    validateReceipt: validateReceipt,
  };
});
