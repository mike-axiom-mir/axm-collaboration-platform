(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMNativeBridgeCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = "1.2.0",
    ADAPTERS = {
      blender: {
        minimum: [4, 2],
        maximum: [5, 3],
        command: "blender.import-interchange",
      },
      godot: {
        minimum: [4, 3],
        maximum: [5, 0],
        command: "godot.import-resource",
      },
      unity: {
        minimum: [2022, 3],
        maximum: [7000, 0],
        command: "unity.import-asset",
      },
      unreal: {
        minimum: [5, 4],
        maximum: [6, 0],
        command: "unreal.import-asset",
      },
      freecad: {
        minimum: [0, 21],
        maximum: [2, 0],
        command: "freecad.import-interchange",
      },
    };
  function canonical(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object")
      return (
        "{" +
        Object.keys(value)
          .sort()
          .map(function (key) {
            return JSON.stringify(key) + ":" + canonical(value[key]);
          })
          .join(",") +
        "}"
      );
    return JSON.stringify(value);
  }
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  function sha256(value) {
    var text = typeof value === "string" ? value : canonical(value),
      bytes;
    if (typeof TextEncoder !== "undefined")
      bytes = new TextEncoder().encode(text);
    else bytes = new Uint8Array(Buffer.from(text, "utf8"));
    var bitLength = bytes.length * 8,
      paddedLength = Math.ceil((bytes.length + 9) / 64) * 64,
      data = new Uint8Array(paddedLength);
    data.set(bytes);
    data[bytes.length] = 0x80;
    var view = new DataView(data.buffer);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 4294967296), false);
    var constants = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
        0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
        0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
        0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
        0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
      ],
      hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
        0x1f83d9ab, 0x5be0cd19,
      ],
      words = new Uint32Array(64);
    for (var offset = 0; offset < data.length; offset += 64) {
      for (var i = 0; i < 16; i++)
        words[i] = view.getUint32(offset + i * 4, false);
      for (var j = 16; j < 64; j++) {
        var s0 =
            rightRotate(words[j - 15], 7) ^
            rightRotate(words[j - 15], 18) ^
            (words[j - 15] >>> 3),
          s1 =
            rightRotate(words[j - 2], 17) ^
            rightRotate(words[j - 2], 19) ^
            (words[j - 2] >>> 10);
        words[j] = (words[j - 16] + s0 + words[j - 7] + s1) >>> 0;
      }
      var a = hash[0],
        b = hash[1],
        c = hash[2],
        d = hash[3],
        e = hash[4],
        f = hash[5],
        g = hash[6],
        h = hash[7];
      for (var round = 0; round < 64; round++) {
        var upper = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25),
          choice = (e & f) ^ (~e & g),
          temp1 = (h + upper + choice + constants[round] + words[round]) >>> 0,
          lower = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22),
          majority = (a & b) ^ (a & c) ^ (b & c),
          temp2 = (lower + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }
      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }
    return hash
      .map(function (value) {
        return value.toString(16).padStart(8, "0");
      })
      .join("");
  }
  function safePath(value) {
    value = String(value || "");
    return (
      !!value &&
      value.length <= 240 &&
      value[0] !== "/" &&
      value.indexOf("\\") < 0 &&
      !/(^|\/)\.\.?($|\/)/.test(value) &&
      !/^[a-z]+:/i.test(value)
    );
  }
  function withinRoot(value, root) {
    value = String(value || "");
    root = String(root || "").replace(/\/$/, "");
    return (
      safePath(value) &&
      safePath(root) &&
      (value === root || value.indexOf(root + "/") === 0)
    );
  }
  function isDigest(value) {
    return /^[a-f0-9]{64}$/.test(String(value || ""));
  }
  function version(value) {
    var match = /^(\d+)(?:\.(\d+))?/.exec(String(value || ""));
    return match ? [Number(match[1]), Number(match[2] || 0)] : null;
  }
  function compare(left, right) {
    return left[0] - right[0] || left[1] - right[1];
  }
  function manifestPayload(manifest) {
    var copy = JSON.parse(JSON.stringify(manifest || {}));
    delete copy.integrity;
    return copy;
  }
  function sealManifest(manifest) {
    var output = JSON.parse(JSON.stringify(manifest || {}));
    output.integrity = {
      algorithm: "sha-256",
      digest: sha256(manifestPayload(output)),
      cryptographic_signature: false,
    };
    return output;
  }
  function validate(bundle) {
    var errors = [],
      warnings = [];
    if (!bundle || bundle.schema !== "axm.native-bridge-bundle/v1")
      errors.push("native bridge bundle schema mismatch");
    var adapter = (bundle && bundle.adapter) || {},
      definition = ADAPTERS[adapter.id],
      parsed = version(adapter.application_version);
    if (adapter.contract_version !== "1.0.0")
      errors.push("native adapter contract version mismatch");
    [
      "canvas_mediums",
      "units",
      "colour_spaces",
      "transparency_modes",
      "behaviours",
      "intended_uses",
      "supported_constraints",
    ].forEach(function (field) {
      if (!Array.isArray(adapter[field]) || !adapter[field].length)
        errors.push("adapter capability declaration is incomplete: " + field);
    });
    if (!definition)
      errors.push("unsupported native adapter: " + String(adapter.id || ""));
    if (
      definition &&
      (!parsed ||
        compare(parsed, definition.minimum) < 0 ||
        compare(parsed, definition.maximum) >= 0)
    )
      errors.push(
        "native application version is outside the adapter compatibility range",
      );
    if (
      !adapter.integrity ||
      adapter.integrity.algorithm !== "sha-256" ||
      adapter.integrity.digest !== sha256(manifestPayload(adapter))
    )
      errors.push("adapter manifest integrity digest mismatch");
    if (
      adapter.integrity &&
      adapter.integrity.cryptographic_signature !== false
    )
      errors.push(
        "adapter manifest must not claim an unverified cryptographic signature",
      );
    var change = (bundle && bundle.change) || {},
      source = change.source_artifact || {},
      operations = Array.isArray(change.operations) ? change.operations : [];
    if (
      !isDigest(source.digest) ||
      !source.mime ||
      !safePath(source.staged_path)
    )
      errors.push("bridge source artifact or staged path is invalid");
    if (!isDigest(change.target_canvas_digest))
      errors.push("bridge change target canvas digest is invalid");
    var project = (bundle && bundle.project) || {};
    if (
      !project.id ||
      project.adapter_id !== adapter.id ||
      !safePath(project.root) ||
      !withinRoot(project.project_file, project.root)
    )
      errors.push("native project binding or relative project path is invalid");
    if (!operations.length || operations.length > 20)
      errors.push("bridge change requires 1..20 operations");
    var allowed = [
      "create-directory",
      "import-asset",
      "set-metadata",
      "refresh-index",
    ];
    operations.forEach(function (operation, index) {
      if (!operation || allowed.indexOf(operation.type) < 0)
        errors.push("operation " + index + " is not allowlisted");
      if (!safePath(operation.path))
        errors.push("operation " + index + " path is unsafe");
      if (!withinRoot(operation.path, project.root))
        errors.push(
          "operation " + index + " path is outside the bound project root",
        );
      if (operation.source_path && !safePath(operation.source_path))
        errors.push("operation " + index + " source path is unsafe");
      if (
        operation.type === "import-asset" &&
        operation.source_path !== source.staged_path
      )
        errors.push(
          "import operation is not bound to the staged source artifact",
        );
    });
    var digest = sha256({
        adapter: {
          id: adapter.id,
          application_version: adapter.application_version,
          contract_version: adapter.contract_version,
          integrity: adapter.integrity && adapter.integrity.digest,
        },
        project: project,
        target_canvas_digest: change.target_canvas_digest,
        source_artifact: source,
        operations: operations,
      }),
      approval = (bundle && bundle.approval) || {},
      human = approval.human || {},
      machine = approval.machine || {},
      rollback = (bundle && bundle.rollback) || {};
    if (approval.bound_change_digest !== digest)
      errors.push(
        "dual approval is not bound to the exact native change digest",
      );
    if (
      !human.approved ||
      !human.actor ||
      !machine.approved ||
      !machine.actor ||
      human.actor === machine.actor
    )
      errors.push("independent human and machine approval are required");
    if (!isDigest(machine.receipt_digest))
      errors.push("machine approval receipt digest is required");
    if (
      !rollback.reversible ||
      !isDigest(rollback.snapshot_digest) ||
      !rollback.strategy ||
      !safePath(rollback.snapshot_path)
    )
      errors.push("reversible rollback snapshot binding is required");
    var hostReceipt = (bundle && bundle.host_application_receipt) || null;
    if (
      hostReceipt &&
      (hostReceipt.change_digest !== digest ||
        hostReceipt.rollback_snapshot_digest !== rollback.snapshot_digest ||
        !hostReceipt.receipt_id ||
        typeof hostReceipt.applied !== "boolean" ||
        hostReceipt.application_version !== adapter.application_version)
    )
      errors.push(
        "host application receipt is not bound to the change and rollback snapshot",
      );
    if (
      hostReceipt &&
      hostReceipt.independently_verified === true &&
      (!hostReceipt.adapter_package_id ||
        !hostReceipt.adapter_package_version ||
        !isDigest(hostReceipt.adapter_package_digest) ||
        !hostReceipt.adapter_signature_key_id ||
        hostReceipt.adapter_package_signature_verified !== true ||
        !hostReceipt.host_application_version_actual ||
        !isDigest(hostReceipt.source_digest) ||
        !isDigest(hostReceipt.project_digest) ||
        !isDigest(hostReceipt.inspection_digest) ||
        hostReceipt.source_digest !== source.digest)
    )
      errors.push(
        "independently verified host receipt lacks signed package or inspection binding",
      );
    return {
      pass: !errors.length,
      errors: Array.from(new Set(errors)),
      warnings: warnings,
      adapterDefinition: definition || null,
      changeDigest: digest,
      hostReceipt: hostReceipt,
      signatureVerified: false,
      integrityVerified:
        !!adapter.integrity &&
        adapter.integrity.digest === sha256(manifestPayload(adapter)),
    };
  }
  function commandPlan(bundle, validation) {
    if (!validation.pass) return [];
    var command = validation.adapterDefinition.command;
    return bundle.change.operations.map(function (operation, index) {
      return {
        id: "command-" + (index + 1),
        adapter_command: command + "." + operation.type,
        path: operation.path,
        source_path: operation.source_path || null,
        metadata: operation.metadata || {},
        execution: "native-host-adapter-only",
      };
    });
  }
  return {
    VERSION: VERSION,
    ADAPTERS: JSON.parse(JSON.stringify(ADAPTERS)),
    canonical: canonical,
    sha256: sha256,
    safePath: safePath,
    withinRoot: withinRoot,
    sealManifest: sealManifest,
    validate: validate,
    commandPlan: commandPlan,
  };
});
