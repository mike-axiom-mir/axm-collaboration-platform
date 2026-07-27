(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("../asset-hands/universal-component")
      : root.AXMUniversalComponentProtocol,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMElementProtocol = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (UCP) {
  "use strict";

  if (!UCP || typeof UCP.sha256 !== "function" || typeof UCP.sealComponent !== "function")
    throw new Error("AXM Element Protocol requires the Universal Component Protocol");

  var VERSION = "1.0.0";
  var ELEMENT_SCHEMA = "axm.modular-element/v1";
  var COMPOSITION_SCHEMA = "axm.element-composition/v1";
  var RECEIPT_SCHEMA = "axm.element-composition-receipt/v1";
  var CATEGORY_SCHEMA = "axm.element-category-registry/v1";
  var ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
  var DIGEST = /^[a-f0-9]{64}$/;
  var FACETS = ["behavior", "content", "appearance", "spatial", "temporal", "physical"];
  var INTENSITY = { none: 0, light: 1, medium: 2, heavy: 3 };
  var ORIGIN_TYPES = ["authored", "generated", "imported", "derived", "adapted"];

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function unique(values) { return Array.from(new Set(values || [])).sort(); }
  function withoutDigest(value) { var copy = clone(value || {}); delete copy.digest; return copy; }
  function digest(value) { return UCP.sha256(withoutDigest(value)); }
  function key(id, version) { return String(id) + "@" + String(version); }
  function nonEmptyObject(value) { return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0; }
  function plainObject(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
  function nonEmptyStringArray(value) { return Array.isArray(value) && value.every(function (item) { return typeof item === "string" && item.trim().length > 0; }); }
  function portableStorageRef(value) {
    if (value == null || value === "") return true;
    var text = String(value);
    return !/^[a-z]:[\\/]/i.test(text) && !/^[/\\]{1,2}/.test(text) && !/^file:/i.test(text);
  }
  function declarativeOnly(value) {
    var text = JSON.stringify(value || {});
    return !/<script\b|javascript\s*:|\bon[a-z]+\s*=|\beval\s*\(|\bnew\s+Function\s*\(/i.test(text);
  }
  function portMap(element, direction) {
    var map = new Map();
    (((element || {}).ports || {})[direction] || []).forEach(function (port) { map.set(port.id, port); });
    return map;
  }
  function typesMatch(outputType, inputType) { return outputType === inputType || outputType === "*" || inputType === "*"; }

  function validateCategoryRegistry(registry) {
    var errors = [], ids = new Set(), verifiers = new Set();
    if (!registry || registry.schema !== CATEGORY_SCHEMA) errors.push("category registry schema mismatch");
    if (!registry || !Array.isArray(registry.categories) || !registry.categories.length) errors.push("category registry requires categories");
    (registry && registry.categories || []).forEach(function (category) {
      if (!category || !ID.test(String(category.id || ""))) errors.push("invalid category id");
      else if (ids.has(category.id)) errors.push("duplicate category " + category.id);
      else ids.add(category.id);
      if (!category || !String(category.label || "").trim()) errors.push("category label required");
      if (!category || !Array.isArray(category.allowed_facets) || !category.allowed_facets.length) errors.push("category allowed_facets required");
      else category.allowed_facets.forEach(function (facet) { if (FACETS.indexOf(facet) < 0) errors.push("unknown category facet " + facet); });
      if (!category || !Array.isArray(category.required_any) || !category.required_any.length) errors.push("category required_any required");
      else category.required_any.forEach(function (facet) {
        if (!category.allowed_facets || category.allowed_facets.indexOf(facet) < 0) errors.push("required facet is not allowed: " + facet);
      });
      if (!category || !ID.test(String(category.verifier || ""))) errors.push("category verifier required");
      else if (verifiers.has(category.verifier)) errors.push("category verifier must be unique: " + category.verifier);
      else verifiers.add(category.verifier);
      if (!category || !Array.isArray(category.native_claims) || !category.native_claims.length) errors.push("category native_claims required");
    });
    return { pass: errors.length === 0, errors: unique(errors) };
  }

  function categoryMap(registry) {
    var map = new Map();
    (registry && registry.categories || []).forEach(function (category) { map.set(category.id, category); });
    return map;
  }

  function validateElement(element, registry) {
    var errors = [], warnings = [], registryValidation = validateCategoryRegistry(registry), categories = categoryMap(registry);
    if (!registryValidation.pass) errors = errors.concat(registryValidation.errors);
    if (!element || element.schema !== ELEMENT_SCHEMA) errors.push("element schema mismatch");
    if (!element || !ID.test(String(element.id || ""))) errors.push("element id must be portable lowercase dotted or dashed text");
    if (!element || !String(element.version || "").trim()) errors.push("element version required");
    if (!element || !ID.test(String(element.category || ""))) errors.push("element category required");
    if (!element || !ID.test(String(element.kind || ""))) errors.push("element kind required");
    if (!element || !String(element.title || "").trim()) errors.push("element title required");
    var category = element && categories.get(element.category);
    if (!category) errors.push("unknown element category " + String(element && element.category || ""));
    if (!element || !nonEmptyObject(element.facets)) errors.push("element requires at least one non-empty facet");
    else {
      Object.keys(element.facets).forEach(function (facet) {
        if (FACETS.indexOf(facet) < 0) errors.push("unknown element facet " + facet);
        if (!nonEmptyObject(element.facets[facet])) errors.push("element facet must be a non-empty object: " + facet);
        if (category && category.allowed_facets.indexOf(facet) < 0) errors.push("facet " + facet + " is not allowed for category " + category.id);
      });
      if (category && !category.required_any.some(function (facet) { return nonEmptyObject(element.facets[facet]); }))
        errors.push("category " + category.id + " requires one of: " + category.required_any.join(", "));
      if (!declarativeOnly(element.facets)) errors.push("element facets must be declarative; executable script or event-handler text is refused");
    }
    ["inputs", "outputs"].forEach(function (direction) {
      var ports = element && element.ports && element.ports[direction], seen = new Set();
      if (!Array.isArray(ports)) { errors.push(direction + " ports required"); return; }
      ports.forEach(function (port) {
        if (!port || !ID.test(String(port.id || ""))) errors.push("invalid " + direction + " port id");
        else if (seen.has(port.id)) errors.push("duplicate " + direction + " port " + port.id);
        else seen.add(port.id);
        if (!port || !String(port.type || "").trim()) errors.push("port type required");
        if (!port || typeof port.required !== "boolean" || typeof port.multiple !== "boolean") errors.push("port required/multiple flags required");
      });
    });
    if (!element || !element.capabilities || !nonEmptyStringArray(element.capabilities.provides) || !nonEmptyStringArray(element.capabilities.requires))
      errors.push("element capability declaration required");
    var compatibility = element && element.compatibility;
    if (!compatibility || !Array.isArray(compatibility.contexts) || !compatibility.contexts.length) errors.push("element contexts required");
    if (!compatibility || !Array.isArray(compatibility.canvases) || !compatibility.canvases.length) errors.push("element canvases required");
    if (!compatibility || !Array.isArray(compatibility.constraints)) errors.push("element compatibility constraints required");
    if (!Array.isArray(element && element.dependencies)) errors.push("element dependencies required");
    else element.dependencies.forEach(function (reference) {
      if (!reference || !ID.test(String(reference.element_id || "")) || !reference.element_version || !DIGEST.test(String(reference.element_digest || "")))
        errors.push("invalid exact element dependency");
    });
    if (!Array.isArray(element && element.artifact_refs)) errors.push("element artifact_refs required");
    else element.artifact_refs.forEach(function (artifact) {
      if (!artifact || !artifact.id || !artifact.role || !artifact.mime || !DIGEST.test(String(artifact.digest || ""))) errors.push("invalid element artifact reference");
      if (artifact && !portableStorageRef(artifact.storage_ref)) errors.push("element artifact storage_ref must be portable, relative or vault-addressed");
    });
    var provenance = element && element.provenance;
    ["origin_type", "source_id", "source_digest", "license_id", "created_by", "created_at"].forEach(function (field) {
      if (!provenance || !String(provenance[field] || "").trim()) errors.push("provenance " + field + " required");
    });
    if (provenance && ORIGIN_TYPES.indexOf(provenance.origin_type) < 0) errors.push("provenance origin_type is not supported");
    if (provenance && !DIGEST.test(String(provenance.source_digest || ""))) errors.push("provenance source_digest must be SHA-256");
    if (provenance && Number.isNaN(Date.parse(String(provenance.created_at || "")))) errors.push("provenance created_at must be a date-time");
    var resource = element && element.resource_profile;
    if (!resource || !Object.prototype.hasOwnProperty.call(INTENSITY, resource.cpu) || !Object.prototype.hasOwnProperty.call(INTENSITY, resource.gpu))
      errors.push("element resource CPU/GPU intensity required");
    if (!resource || typeof resource.native_runtime === "undefined") errors.push("element native runtime declaration required");
    if (resource && !((resource.peak_memory_bytes === null) || (Number.isInteger(resource.peak_memory_bytes) && resource.peak_memory_bytes >= 0))) errors.push("element peak_memory_bytes must be a non-negative integer or null");
    if (resource && !((resource.working_storage_bytes === null) || (Number.isInteger(resource.working_storage_bytes) && resource.working_storage_bytes >= 0))) errors.push("element working_storage_bytes must be a non-negative integer or null");
    if (resource && !((resource.native_runtime === null) || typeof resource.native_runtime === "string")) errors.push("element native_runtime must be text or null");
    var verification = element && element.verification;
    if (!verification || !nonEmptyStringArray(verification.automatic_checks) || !nonEmptyStringArray(verification.human_judgments) || !verification.assurance_ceiling)
      errors.push("element verification boundary required");
    if (category && (!verification || verification.category_verifier !== category.verifier))
      errors.push("element category verifier must match " + category.verifier);
    if (!element || ["immutable", "versioned"].indexOf(element.mutability) < 0) errors.push("element mutability must be immutable or versioned");
    if (!element || !DIGEST.test(String(element.digest || ""))) errors.push("element digest required");
    else if (element.digest !== digest(element)) errors.push("element digest mismatch");
    if (element && element.verification && !element.verification.human_judgments.length && ["interface", "visual", "media", "fabrication"].indexOf(element.category) >= 0)
      warnings.push("appearance or physical quality remains unjudged by a human seat");
    return { pass: errors.length === 0, errors: unique(errors), warnings: unique(warnings), category: category ? clone(category) : null };
  }

  function sealElement(input, registry) {
    var element = clone(input || {}), categories = categoryMap(registry), category;
    element.schema = ELEMENT_SCHEMA;
    element.version = String(element.version || "1.0.0");
    element.facets = element.facets || {};
    element.ports = element.ports || { inputs: [], outputs: [] };
    element.capabilities = element.capabilities || { provides: [], requires: [] };
    element.compatibility = element.compatibility || { contexts: ["*"], canvases: ["*"], constraints: [] };
    element.dependencies = element.dependencies || [];
    element.artifact_refs = element.artifact_refs || [];
    element.resource_profile = element.resource_profile || { cpu: "none", gpu: "none", peak_memory_bytes: 0, working_storage_bytes: 0, native_runtime: null };
    category = categories.get(element.category);
    element.verification = element.verification || {
      category_verifier: category ? category.verifier : "element.unknown.v1",
      automatic_checks: ["schema-and-digest"],
      human_judgments: [],
      assurance_ceiling: "element contract only",
    };
    element.mutability = element.mutability || "versioned";
    element.digest = digest(element);
    var validation = validateElement(element, registry);
    if (!validation.pass) throw new Error(validation.errors.join("; "));
    return element;
  }

  function createRegistry(categoryRegistry, initial) {
    var records = new Map();
    function register(element) {
      var validation = validateElement(element, categoryRegistry);
      if (!validation.pass) throw new Error(validation.errors.join("; "));
      var recordKey = key(element.id, element.version), existing = records.get(recordKey);
      if (existing && existing.digest !== element.digest) throw new Error("element version collision for " + recordKey);
      if (!existing) records.set(recordKey, clone(element));
      return clone(records.get(recordKey));
    }
    function resolve(reference) {
      var element = records.get(key(reference.element_id, reference.element_version));
      if (!element || element.digest !== reference.element_digest) return null;
      return clone(element);
    }
    (initial || []).forEach(register);
    return {
      schema: "axm.element-registry/v1",
      register: register,
      resolve: resolve,
      get: function (id, version) { return clone(records.get(key(id, version)) || null); },
      list: function () { return Array.from(records.values()).map(clone).sort(function (a, b) { return key(a.id, a.version).localeCompare(key(b.id, b.version)); }); },
      categories: function () { return clone(categoryRegistry.categories || []); },
    };
  }

  function sealComposition(input) {
    var composition = clone(input || {});
    composition.schema = COMPOSITION_SCHEMA;
    composition.version = String(composition.version || "1.0.0");
    composition.elements = composition.elements || [];
    composition.placements = composition.placements || [];
    composition.bindings = composition.bindings || [];
    composition.outputs = composition.outputs || [];
    composition.policy = composition.policy || { acyclic: true, missing_element: "fail", category_conflict: "fail", execution_authority: "none" };
    composition.digest = digest(composition);
    return composition;
  }

  function validateComposition(composition, registry) {
    var errors = [], warnings = [], codes = [], resolved = new Map(), instances = new Map(), incoming = new Map(), outgoing = new Map();
    if (!composition || composition.schema !== COMPOSITION_SCHEMA) errors.push("composition schema mismatch");
    if (!composition || !ID.test(String(composition.id || ""))) errors.push("composition id must be portable lowercase dotted or dashed text");
    if (!composition || !String(composition.version || "").trim()) errors.push("composition version required");
    if (!composition || !String(composition.title || "").trim()) errors.push("composition title required");
    if (!composition || !DIGEST.test(String(composition.digest || "")) || composition.digest !== digest(composition)) errors.push("composition digest mismatch");
    if (!composition || !composition.target || !composition.target.context || !composition.target.canvas || !Array.isArray(composition.target.allowed_categories) || !composition.target.allowed_categories.length)
      errors.push("composition target context, canvas and allowed categories are required");
    if (!composition || !composition.policy || composition.policy.acyclic !== true || composition.policy.missing_element !== "fail" || composition.policy.category_conflict !== "fail" || composition.policy.execution_authority !== "none")
      errors.push("composition fail-closed policy required");
    var allowedCategories = composition && composition.target && Array.isArray(composition.target.allowed_categories) ? composition.target.allowed_categories : [];
    var declaredCategories = registry && typeof registry.categories === "function" ? new Set(registry.categories().map(function (category) { return category.id; })) : null;
    if (new Set(allowedCategories).size !== allowedCategories.length) errors.push("composition allowed categories must be unique");
    allowedCategories.forEach(function (categoryId) {
      if (!ID.test(String(categoryId || "")) || (declaredCategories && !declaredCategories.has(categoryId))) {
        errors.push("composition target declares unknown category " + String(categoryId || ""));
        codes.push("CATEGORY_CONFLICT");
      }
    });
    var refs = composition && Array.isArray(composition.elements) ? composition.elements : [];
    if (composition && !Array.isArray(composition.elements)) errors.push("composition elements must be an array");
    if (!refs.length) errors.push("composition requires elements");
    refs.forEach(function (reference) {
      if (!reference || !ID.test(String(reference.instance_id || ""))) { errors.push("invalid element instance id"); return; }
      if (instances.has(reference.instance_id)) { errors.push("duplicate element instance " + reference.instance_id); return; }
      instances.set(reference.instance_id, reference);
      incoming.set(reference.instance_id, 0);
      outgoing.set(reference.instance_id, []);
      if (!ID.test(String(reference.element_id || "")) || !String(reference.element_version || "").trim() || !DIGEST.test(String(reference.element_digest || ""))) errors.push("invalid exact element reference for " + reference.instance_id);
      if (typeof reference.configuration !== "undefined" && !plainObject(reference.configuration)) errors.push("element configuration must be an object: " + reference.instance_id);
      var element = registry && registry.resolve(reference);
      if (!element) { errors.push("missing exact element " + reference.element_id + "@" + reference.element_version); codes.push("MISSING_ELEMENT"); return; }
      resolved.set(reference.instance_id, element);
      if (composition.target.allowed_categories.indexOf(element.category) < 0) { errors.push("category " + element.category + " is not allowed by target"); codes.push("CATEGORY_CONFLICT"); }
      var contexts = element.compatibility.contexts || [], canvases = element.compatibility.canvases || [];
      if (contexts.indexOf("*") < 0 && contexts.indexOf(composition.target.context) < 0) { errors.push("element " + reference.instance_id + " does not support target context"); codes.push("UNSUPPORTED_TARGET"); }
      if (canvases.indexOf("*") < 0 && canvases.indexOf(composition.target.canvas) < 0) { errors.push("element " + reference.instance_id + " does not support target canvas"); codes.push("UNSUPPORTED_TARGET"); }
      (element.dependencies || []).forEach(function (dependency) {
        if (!registry.resolve(dependency)) { errors.push("missing dependency " + dependency.element_id + "@" + dependency.element_version); codes.push("MISSING_ELEMENT"); }
      });
    });
    var placed = new Set(), placements = composition && Array.isArray(composition.placements) ? composition.placements : [];
    if (composition && !Array.isArray(composition.placements)) errors.push("composition placements must be an array");
    placements.forEach(function (placement) {
      if (!instances.has(placement.instance_id)) errors.push("placement references unknown element " + placement.instance_id);
      if (placed.has(placement.instance_id)) errors.push("duplicate placement " + placement.instance_id);
      placed.add(placement.instance_id);
      if (!placement.region || !Number.isInteger(placement.order)) errors.push("placement region and integer order required");
      if (typeof placement.configuration !== "undefined" && !plainObject(placement.configuration)) errors.push("placement configuration must be an object: " + placement.instance_id);
    });
    refs.forEach(function (reference) { if (!placed.has(reference.instance_id)) warnings.push("element " + reference.instance_id + " has no visual/spatial placement"); });
    var boundInputs = new Map(), bindings = composition && Array.isArray(composition.bindings) ? composition.bindings : [];
    if (composition && !Array.isArray(composition.bindings)) errors.push("composition bindings must be an array");
    bindings.forEach(function (binding) {
      if (!binding || !String(binding.relation || "").trim()) errors.push("binding relation required");
      var fromElement = resolved.get(binding && binding.from && binding.from.instance_id), toElement = resolved.get(binding && binding.to && binding.to.instance_id);
      if (!fromElement || !toElement) { errors.push("binding references unknown element instance"); return; }
      var output = portMap(fromElement, "outputs").get(binding.from.port), input = portMap(toElement, "inputs").get(binding.to.port);
      if (!output) errors.push("binding references missing output port " + binding.from.instance_id + "." + binding.from.port);
      if (!input) errors.push("binding references missing input port " + binding.to.instance_id + "." + binding.to.port);
      if (output && input && !typesMatch(output.type, input.type)) errors.push("binding type mismatch " + output.type + " -> " + input.type);
      if (output && input) {
        var inputKey = binding.to.instance_id + "." + binding.to.port;
        boundInputs.set(inputKey, (boundInputs.get(inputKey) || 0) + 1);
        if (!input.multiple && boundInputs.get(inputKey) > 1) errors.push("single input receives multiple bindings: " + inputKey);
        outgoing.get(binding.from.instance_id).push(binding.to.instance_id);
        incoming.set(binding.to.instance_id, incoming.get(binding.to.instance_id) + 1);
      }
    });
    resolved.forEach(function (element, instanceId) {
      portMap(element, "inputs").forEach(function (input) {
        if (input.required && !boundInputs.has(instanceId + "." + input.id)) errors.push("required input is not bound: " + instanceId + "." + input.id);
      });
    });
    var outputs = composition && Array.isArray(composition.outputs) ? composition.outputs : [], outputIds = new Set();
    if (composition && !Array.isArray(composition.outputs)) errors.push("composition outputs must be an array");
    outputs.forEach(function (output) {
      if (!output || !String(output.id || "").trim() || !String(output.role || "").trim()) errors.push("composition output id and role required");
      if (output && outputIds.has(output.id)) errors.push("duplicate composition output " + output.id);
      if (output) outputIds.add(output.id);
      var element = resolved.get(output.instance_id);
      if (!element || !portMap(element, "outputs").has(output.port)) errors.push("composition output references missing output port: " + output.instance_id + "." + output.port);
    });
    if (!outputs.length) errors.push("composition requires at least one output");
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
    if (order.length !== refs.length) errors.push("element composition contains a cycle");
    return { pass: errors.length === 0, errors: unique(errors), warnings: unique(warnings), codes: unique(codes), resolved: resolved, execution_order: order };
  }

  function toUniversalComponent(element, categoryRegistry) {
    var validation = validateElement(element, categoryRegistry);
    if (!validation.pass) throw new Error(validation.errors.join("; "));
    return UCP.sealComponent({
      id: element.id,
      version: element.version,
      kind: "element." + element.category + "." + element.kind,
      title: element.title,
      description: element.description || "AXM modular " + element.category + " element",
      ports: clone(element.ports),
      canvas_compatibility: { mediums: clone(element.compatibility.canvases), intended_uses: clone(element.compatibility.contexts), constraints: clone(element.compatibility.constraints) },
      capabilities: clone(element.capabilities),
      artifact_refs: clone(element.artifact_refs),
      payload: { element_schema: element.schema, category: element.category, kind: element.kind, facets: clone(element.facets), dependencies: clone(element.dependencies) },
      provenance: clone(element.provenance),
      resource_profile: clone(element.resource_profile),
      verification: { automatic_checks: unique([element.verification.category_verifier].concat(element.verification.automatic_checks)), human_judgments: clone(element.verification.human_judgments), assurance_ceiling: element.verification.assurance_ceiling },
      mutability: element.mutability,
    });
  }

  function compose(composition, registry, categoryRegistry, options) {
    var validation = validateComposition(composition, registry), exact = [], categories = [], ucp = [];
    validation.resolved.forEach(function (element, instanceId) {
      exact.push({ instance_id: instanceId, element_id: element.id, element_version: element.version, digest: element.digest });
      categories.push(element.category);
      var component = toUniversalComponent(element, categoryRegistry);
      ucp.push({ instance_id: instanceId, component_id: component.id, component_version: component.version, component_digest: component.digest });
    });
    var status = validation.pass ? "READY_CONTRACT" : validation.codes.indexOf("MISSING_ELEMENT") >= 0 ? "MISSING_ELEMENT" : validation.codes.indexOf("CATEGORY_CONFLICT") >= 0 ? "CATEGORY_CONFLICT" : validation.codes.indexOf("UNSUPPORTED_TARGET") >= 0 ? "UNSUPPORTED_TARGET" : "INVALID_COMPOSITION";
    var receipt = {
      schema: RECEIPT_SCHEMA,
      status: status,
      composition_id: String(composition && composition.id || "unknown"),
      composition_digest: DIGEST.test(String(composition && composition.digest || "")) ? composition.digest : UCP.sha256(composition || {}),
      element_digests: exact.sort(function (a, b) { return a.instance_id.localeCompare(b.instance_id); }),
      categories: unique(categories),
      ucp_components: ucp.sort(function (a, b) { return a.instance_id.localeCompare(b.instance_id); }),
      checks: [
        { id: "element-resolution", pass: !validation.errors.some(function (item) { return /missing exact|missing dependency|unknown element/.test(item); }), details: validation.errors.filter(function (item) { return /missing exact|missing dependency|unknown element/.test(item); }).join("; ") || "all exact elements and dependencies resolved" },
        { id: "category-and-target-fit", pass: !validation.errors.some(function (item) { return /category|target context|target canvas/.test(item); }), details: validation.errors.filter(function (item) { return /category|target context|target canvas/.test(item); }).join("; ") || "categories, context and canvas agree" },
        { id: "ports-and-graph", pass: !validation.errors.some(function (item) { return /port|input|binding|cycle|digest|schema/.test(item); }), details: validation.errors.filter(function (item) { return /port|input|binding|cycle|digest|schema/.test(item); }).join("; ") || "typed ports, digest and acyclic composition agree" },
        { id: "ucp-adaptation", pass: ucp.length === validation.resolved.size, details: ucp.length === validation.resolved.size ? "every resolved element sealed as an exact UCP component" : "one or more elements could not adapt to UCP" },
      ],
      truth: { contract_only: true, executed: false, rendered: false, visually_approved: false, installed: false },
      created_at: String(options && options.createdAt || new Date().toISOString()),
    };
    receipt.digest = digest(receipt);
    return receipt;
  }

  function validateReceipt(receipt, composition) {
    var errors = [];
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) errors.push("element receipt schema mismatch");
    if (!receipt || !DIGEST.test(String(receipt.digest || "")) || receipt.digest !== digest(receipt)) errors.push("element receipt digest mismatch");
    if (composition && receipt.composition_id !== composition.id) errors.push("element receipt composition id mismatch");
    if (composition && receipt.composition_digest !== composition.digest) errors.push("element receipt composition digest mismatch");
    if (receipt && receipt.status === "READY_CONTRACT" && (!Array.isArray(receipt.checks) || receipt.checks.some(function (check) { return check.pass !== true; }))) errors.push("READY_CONTRACT element receipt contains a failed check");
    if (!receipt || !receipt.truth || receipt.truth.contract_only !== true || receipt.truth.executed !== false || receipt.truth.rendered !== false || receipt.truth.visually_approved !== false || receipt.truth.installed !== false) errors.push("element receipt truth boundary missing");
    return { pass: errors.length === 0, errors: unique(errors) };
  }

  return {
    VERSION: VERSION,
    ELEMENT_SCHEMA: ELEMENT_SCHEMA,
    COMPOSITION_SCHEMA: COMPOSITION_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CATEGORY_SCHEMA: CATEGORY_SCHEMA,
    FACETS: FACETS.slice(),
    sha256: UCP.sha256,
    validateCategoryRegistry: validateCategoryRegistry,
    validateElement: validateElement,
    sealElement: sealElement,
    createRegistry: createRegistry,
    sealComposition: sealComposition,
    validateComposition: validateComposition,
    toUniversalComponent: toUniversalComponent,
    compose: compose,
    validateReceipt: validateReceipt,
  };
});
