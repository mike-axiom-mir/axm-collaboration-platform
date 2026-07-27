#!/usr/bin/env node
"use strict";
const assert = require("assert");
const Hands = require("./asset-hands");
const TargetCanvas = require("./target-canvas");
const Bridge = require("./native-bridge-codec");
const Schemas = require("./artifact-schema-catalog");
const CHANGE_SCHEMA = "native-project-change";

const createdAt = "2026-07-19T00:00:00Z";
const privilegedHost = {
  capabilities: ["json", "svg", "native-dcc-adapter"],
  permissions: ["filesystem:write", "plugin-data"],
  accepts: [Hands.RESULT_SCHEMA, "application/json", "image/svg+xml"],
};
const normalHost = {
  capabilities: ["json", "svg"],
  permissions: [],
  accepts: [Hands.RESULT_SCHEMA, "application/json", "image/svg+xml"],
};
const canvas = {
  medium: "3d-surface",
  dimensions: { width: 4, height: 2, unit: "m" },
  colour: {
    space: "material-channel",
    transparency: "opaque",
    bit_depth: 8,
  },
  spatial: {
    coordinate_unit: "m",
    up_axis: "y",
    handedness: "right",
    world_scale: 1,
    origin: [0, 0, 0],
  },
  behaviour: ["static"],
  performance: {
    max_file_bytes: 500000,
    max_polygon_count: 100000,
    max_vertices: 80000,
  },
  intended_use: "native-bridge",
};
const normalizedCanvas = TargetCanvas.inspect(canvas).canvas;

function adapter(overrides) {
  return Bridge.sealManifest(
    Object.assign(
      {
        id: "blender",
        contract_version: "1.0.0",
        application_version: "4.3.2",
        canvas_mediums: ["3d-surface"],
        units: ["m"],
        colour_spaces: ["material-channel"],
        transparency_modes: ["opaque"],
        behaviours: ["static"],
        intended_uses: ["native-bridge"],
        supported_constraints:
          TargetCanvas.requestedConstraints(normalizedCanvas),
      },
      overrides || {},
    ),
  );
}

function bundle(overrides) {
  const value = {
    schema: "axm.native-bridge-bundle/v1",
    version: "1.0.0",
    id: "bridge-bundle-blender-demo",
    adapter: adapter(),
    project: {
      id: "blender-demo",
      adapter_id: "blender",
      root: "projects/blender-demo",
      project_file: "projects/blender-demo/demo.blend",
    },
    change: {
      target_canvas_digest: Bridge.sha256(normalizedCanvas),
      source_artifact: {
        digest: Bridge.sha256("real-glb-source"),
        mime: "model/gltf-binary",
        format: "GLB 2.0",
        staged_path: "staging/model.glb",
      },
      operations: [
        {
          type: "create-directory",
          path: "projects/blender-demo/assets",
        },
        {
          type: "import-asset",
          path: "projects/blender-demo/assets/model.glb",
          source_path: "staging/model.glb",
        },
        {
          type: "set-metadata",
          path: "projects/blender-demo/assets/model.glb",
          metadata: { axm_provenance: "asset-digest-bound" },
        },
        {
          type: "refresh-index",
          path: "projects/blender-demo/assets",
        },
      ],
    },
    approval: {
      bound_change_digest: "",
      human: { approved: true, actor: "human:mike" },
      machine: {
        approved: true,
        actor: "machine:axm-governor",
        receipt_digest: Bridge.sha256("governance-receipt"),
      },
    },
    rollback: {
      reversible: true,
      strategy: "restore-project-snapshot",
      snapshot_digest: Bridge.sha256("project-snapshot-before-change"),
      snapshot_path: "snapshots/blender-demo-before-change.blend",
    },
    host_application_receipt: null,
    provenance: {
      fabric_record_id: "fabric-record-1",
      studio_handoff_id: "studio-handoff-1",
    },
  };
  Object.assign(value, overrides || {});
  value.approval.bound_change_digest = Bridge.validate(value).changeDigest;
  return value;
}

function brief(value, overrides) {
  return Object.assign(
    {
      id: "native-bridge-demo",
      title: "Approved Blender model handoff",
      kind: "native-bridge",
      operation_mode: "workflow",
      intended_use: "native-bridge",
      target_canvas: canvas,
      required_outputs: ["native-project-change", "bridge-receipt"],
      editable_recipe_formats: ["axm.native-bridge-recipe/v1"],
      quality_requirements: {
        require_preview: true,
        require_validation: true,
        require_editable_source: true,
      },
      source_artifacts: [
        {
          id: "native-bridge-bundle",
          role: "source",
          mime: "application/json",
          format: "JSON",
          text: JSON.stringify(value),
          digest: Bridge.sha256(value),
          editable: true,
          metadata: { schema: "axm.native-bridge-bundle/v1" },
        },
      ],
    },
    overrides || {},
  );
}

function artifact(result, id) {
  const found = result.artifacts.find((item) => item.id === id);
  assert(found, "missing " + id);
  return found;
}

function value(result, id) {
  return JSON.parse(artifact(result, id).text);
}

(async function () {
  assert.equal(
    Bridge.sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(new Set(Hands.list().map((hand) => hand.id)).size, Hands.list().length);
  assert.equal(Hands.listMissingHands().length, 0);
  assert(!Hands.getMissingHand("native-dcc-bridge"));
  const hand = Hands.list().find((item) => item.id === "native-dcc-bridge");
  assert(hand);
  assert.equal(hand.implementation_status, "executable");
  assert.equal(hand.safety_tier, "native-bridge");
  assert.deepEqual(hand.requires, ["native-dcc-adapter"]);
  assert.equal(hand.required_permissions.local_file_system, "write");
  assert.equal(hand.required_permissions.plugin_data, true);
  assert.equal(hand.limits.nativeExecution, false);

  const validBundle = bundle();
  const validation = Bridge.validate(validBundle);
  assert(validation.pass, validation.errors.join("; "));
  assert(validation.integrityVerified);
  assert.equal(validation.signatureVerified, false);
  assert.equal(
    validation.changeDigest,
    validBundle.approval.bound_change_digest,
  );
  assert(Bridge.withinRoot("projects/demo/a.glb", "projects/demo"));
  assert(!Bridge.withinRoot("projects/other/a.glb", "projects/demo"));
  assert(!Bridge.safePath("../escape.blend"));

  assert.equal(Hands.routes(brief(validBundle), normalHost).length, 0);
  const denied = Hands.diagnose(brief(validBundle), normalHost);
  assert.equal(denied.status, "MISSING_HAND");
  const deniedBridge = denied.rejections.find(
    (item) => item.handId === "native-dcc-bridge",
  );
  assert(deniedBridge);
  assert.equal(deniedBridge.code, "HOST_INCOMPATIBLE");
  assert(
    Hands.routes(brief(validBundle), privilegedHost).some(
      (route) => route.hand.id === "native-dcc-bridge",
    ),
  );

  const staged = await Hands.createAsync(
    "native-dcc-bridge",
    brief(validBundle),
    { host: privilegedHost, createdAt, seed: "native-bridge" },
  );
  assert.equal(staged.status, "READY");
  assert(staged.technical.pass);
  const change = value(staged, "native-project-change");
  const receipt = value(staged, "bridge-receipt");
  const recipe = value(staged, "native-bridge-recipe");
  assert.equal(change.state, "STAGED_NOT_EXECUTED");
  assert.equal(change.native_execution, false);
  assert.equal(change.commands.length, 4);
  assert(
    change.commands.every(
      (command) => command.execution === "native-host-adapter-only",
    ),
  );
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.result, "STAGED_NOT_EXECUTED");
  assert.equal(receipt.native_execution, false);
  assert.equal(receipt.host_reported_applied, false);
  assert.equal(receipt.independently_verified_application, false);
  assert.equal(receipt.integrity.manifest_integrity_verified, true);
  assert.equal(receipt.integrity.cryptographic_signature_verified, false);
  assert.equal(recipe.execution_boundary.native_execution, false);
  assert.equal(recipe.execution_boundary.automatic_host_import, false);
  assert(Schemas.validate(change.schema, change).pass);
  assert(Schemas.validate(receipt.schema, receipt).pass);
  assert(Schemas.validate(recipe.schema, recipe).pass);
  assert(
    !staged.artifacts.some(
      (item) =>
        /javascript|shell|python|executable/.test(item.mime) ||
        /\.(js|ps1|bat|cmd|py|exe)$/i.test(item.filename),
    ),
  );

  const proof = await Hands.verifyDeterminismAsync(
    "native-dcc-bridge",
    brief(validBundle),
    { host: privilegedHost, createdAt, seed: "native-bridge" },
  );
  assert(proof.pass, JSON.stringify(proof));

  const validateOnly = await Hands.createAsync(
    "native-dcc-bridge",
    brief(validBundle, {
      id: "validate-native-bridge",
      operation_mode: "validate",
    }),
    { host: privilegedHost, createdAt, seed: "validate-native-bridge" },
  );
  assert.equal(
    value(validateOnly, "native-project-change").state,
    "VALIDATED_NOT_EXECUTED",
  );

  const appliedBundle = JSON.parse(JSON.stringify(validBundle));
  appliedBundle.host_application_receipt = {
    receipt_id: "blender-host-receipt-1",
    applied: true,
    application_version: appliedBundle.adapter.application_version,
    change_digest: validation.changeDigest,
    rollback_snapshot_digest: appliedBundle.rollback.snapshot_digest,
  };
  const applied = await Hands.createAsync(
    "native-dcc-bridge",
    brief(appliedBundle, {
      id: "finish-native-bridge",
      operation_mode: "finish",
    }),
    { host: privilegedHost, createdAt, seed: "finish-native-bridge" },
  );
  assert.equal(applied.status, "READY");
  assert.equal(
    value(applied, "native-project-change").state,
    "HOST_REPORTED_APPLIED",
  );
  assert.equal(value(applied, "bridge-receipt").host_reported_applied, true);
  assert.equal(
    value(applied, "bridge-receipt").independently_verified_application,
    false,
  );
  assert.equal(applied.measures.nativeExecution, false);

  const finishWithoutReceipt = await Hands.createAsync(
    "native-dcc-bridge",
    brief(validBundle, {
      id: "finish-without-receipt",
      operation_mode: "finish",
    }),
    { host: privilegedHost, createdAt, seed: "finish-without-receipt" },
  );
  assert.equal(finishWithoutReceipt.status, "HOLD");
  assert.equal(
    value(finishWithoutReceipt, "native-project-change").state,
    "REFUSED",
  );
  assert.equal(
    value(finishWithoutReceipt, "native-project-change").commands.length,
    0,
  );

  async function held(mutator, id) {
    const bad = JSON.parse(JSON.stringify(validBundle));
    mutator(bad);
    const result = await Hands.createAsync(
      "native-dcc-bridge",
      brief(bad, { id }),
      { host: privilegedHost, createdAt, seed: id },
    );
    assert.equal(result.status, "HOLD", id);
    assert.equal(value(result, "native-project-change").state, "REFUSED", id);
    assert.equal(value(result, "native-project-change").commands.length, 0, id);
    assert(value(result, "bridge-receipt").errors.length, id);
  }
  const blender52 = JSON.parse(JSON.stringify(validBundle));
  blender52.adapter.application_version = "5.2.0";
  blender52.adapter = Bridge.sealManifest(blender52.adapter);
  blender52.approval.bound_change_digest = Bridge.validate(blender52).changeDigest;
  assert.equal(Bridge.validate(blender52).pass, true, "Blender 5.2 must remain within the tested bridge range");
  await held((bad) => {
    bad.adapter.application_version = "5.3.0";
    bad.adapter = Bridge.sealManifest(bad.adapter);
  }, "unsupported-adapter-version");
  await held((bad) => {
    bad.adapter.units = ["mm"];
    bad.adapter = Bridge.sealManifest(bad.adapter);
  }, "unsupported-adapter-canvas");
  await held((bad) => {
    bad.adapter.application_version = "4.4.0";
  }, "tampered-adapter-manifest");
  await held((bad) => {
    bad.change.operations[1].path = "../escape/model.glb";
  }, "unsafe-operation-path");
  await held((bad) => {
    bad.approval.human.actor = bad.approval.machine.actor;
  }, "non-independent-approval");
  await held((bad) => {
    bad.change.target_canvas_digest = Bridge.sha256("wrong-canvas");
    bad.approval.bound_change_digest = Bridge.validate(bad).changeDigest;
  }, "wrong-target-canvas-binding");
  await held((bad) => {
    bad.host_application_receipt = {
      receipt_id: "bad-host-receipt",
      applied: true,
      application_version: bad.adapter.application_version,
      change_digest: validation.changeDigest,
      rollback_snapshot_digest: Bridge.sha256("wrong-snapshot"),
    };
  }, "wrong-rollback-receipt");

  const missingBundleBrief = Object.assign({}, brief(validBundle), {
    id: "missing-native-bundle",
    source_artifacts: [],
  });
  assert.equal(Hands.routes(missingBundleBrief, privilegedHost).length, 0);
  assert.equal(
    Hands.diagnose(missingBundleBrief, privilegedHost).status,
    "MISSING_HAND",
  );

  const legacy = Hands.create(
    "vector-form",
    {
      id: "legacy-svg-after-native-bridge",
      title: "Legacy SVG remains portable",
      kind: "icon",
      intended_use: "icon",
      target_canvas: {
        medium: "screen",
        dimensions: { width: 64, height: 64, unit: "px" },
        colour: { space: "srgb", transparency: "allowed" },
        behaviour: ["static"],
        intended_use: "icon",
      },
      required_outputs: ["image/svg+xml"],
      editable_recipe_formats: [Hands.RECIPE_SCHEMA],
    },
    { host: normalHost, createdAt, seed: "legacy-svg-native-bridge" },
  );
  assert.equal(legacy.status, "READY");
  assert(legacy.artifacts.some((item) => item.mime === "image/svg+xml"));
  assert(
    !legacy.artifacts.some((item) => item.metadata.schema === CHANGE_SCHEMA),
  );

  console.log(
    "Asset Hands native-bridge selftest PASS (35 executable hands, zero visible planned gaps, SHA-256 known vector, explicit native adapter capability + write/plugin permissions, Blender version range, full target-canvas binding, safe project-relative allowlisted transaction, independent dual approval, rollback snapshot, staged/validate/host-reported states, no direct execution or signature/verification overclaim, refusal/tamper/determinism, legacy SVG)",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
