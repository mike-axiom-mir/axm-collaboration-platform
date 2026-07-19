(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
      node ? require("../native-bridge-codec") : root.AXMNativeBridgeCodec,
      node ? require("../target-canvas") : root.AXMTargetCanvas,
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
  function (Core, Bridge, TargetCanvas) {
    "use strict";
    if (!Core || !Bridge || !TargetCanvas)
      throw new Error(
        "AXM core, native bridge codec and target canvas are required",
      );

    var BUNDLE_SCHEMA = "axm.native-bridge-bundle/v1",
      CHANGE_SCHEMA = "native-project-change",
      RECEIPT_SCHEMA = "bridge-receipt",
      RECIPE_SCHEMA = "axm.native-bridge-recipe/v1";

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function unique(values) {
      return Array.from(new Set(values));
    }

    function jsonArtifact(id, role, name, filename, value, editable) {
      return {
        id: id,
        role: role,
        name: name,
        filename: filename,
        mime: "application/json",
        format: "JSON",
        editable: editable,
        text: JSON.stringify(value, null, 2),
        metadata: { schema: value.schema },
      };
    }

    function sourceBundle(context) {
      var item = context.sourceArtifacts.find(function (source) {
        return source.content_schema === BUNDLE_SCHEMA;
      });
      if (!item)
        throw new Error("native bridge requires a native bridge bundle source");
      var value;
      try {
        value = JSON.parse(item.text);
      } catch (error) {
        throw new Error("native bridge bundle source is not valid JSON");
      }
      return { item: item, value: value };
    }

    function adapterCanvasChecks(context, bundle) {
      var canvas = context.targetCanvas,
        adapter = bundle.adapter || {},
        requested = TargetCanvas.requestedConstraints(canvas),
        supported = Array.isArray(adapter.supported_constraints)
          ? adapter.supported_constraints
          : [],
        behaviours = Array.isArray(adapter.behaviours)
          ? adapter.behaviours
          : [],
        uses = Array.isArray(adapter.intended_uses)
          ? adapter.intended_uses
          : [],
        digest = Bridge.sha256(canvas);
      function contains(values, value) {
        return values.indexOf("*") >= 0 || values.indexOf(value) >= 0;
      }
      return [
        {
          name: "adapter-understands-target-canvas-medium",
          pass: contains(adapter.canvas_mediums || [], canvas.medium),
          details: {
            requested: canvas.medium,
            declared: adapter.canvas_mediums || [],
          },
        },
        {
          name: "adapter-understands-target-canvas-unit",
          pass: contains(adapter.units || [], canvas.dimensions.unit),
          details: {
            requested: canvas.dimensions.unit,
            declared: adapter.units || [],
          },
        },
        {
          name: "adapter-understands-target-colour-space",
          pass: contains(adapter.colour_spaces || [], canvas.colour.space),
          details: {
            requested: canvas.colour.space,
            declared: adapter.colour_spaces || [],
          },
        },
        {
          name: "adapter-understands-target-transparency",
          pass: contains(
            adapter.transparency_modes || [],
            canvas.colour.transparency,
          ),
          details: {
            requested: canvas.colour.transparency,
            declared: adapter.transparency_modes || [],
          },
        },
        {
          name: "adapter-understands-target-behaviour",
          pass: canvas.behaviour.every(function (behaviour) {
            return contains(behaviours, behaviour);
          }),
          details: { requested: canvas.behaviour, declared: behaviours },
        },
        {
          name: "adapter-understands-intended-use",
          pass:
            contains(uses, context.brief.intended_use) ||
            contains(uses, "native-bridge"),
          details: { requested: context.brief.intended_use, declared: uses },
        },
        {
          name: "adapter-honours-every-requested-canvas-constraint",
          pass: requested.every(function (constraint) {
            return contains(supported, constraint);
          }),
          details: {
            requested: requested,
            unsupported: requested.filter(function (constraint) {
              return !contains(supported, constraint);
            }),
          },
        },
        {
          name: "change-is-bound-to-effective-target-canvas",
          pass:
            !!bundle.change && bundle.change.target_canvas_digest === digest,
          details: {
            expected: digest,
            actual: bundle.change && bundle.change.target_canvas_digest,
          },
        },
      ];
    }

    function preview(context, state, adapter, validation) {
      var width = context.brief.canvas.width,
        height = context.brief.canvas.height,
        good = validation.pass,
        accent = good ? "#6ee5d2" : "#ff8f70",
        title = good ? state.replace(/_/g, " ") : "REFUSED",
        errors =
          validation.errors.slice(0, 2).join("; ") ||
          "No native application execution occurred";
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        width +
        '" height="' +
        height +
        '" viewBox="0 0 ' +
        width +
        " " +
        height +
        '" role="img" aria-label="Native project change transaction preview">' +
        '<rect width="100%" height="100%" rx="18" fill="#07131d"/>' +
        '<rect x="24" y="24" width="' +
        Math.max(1, width - 48) +
        '" height="' +
        Math.max(1, height - 48) +
        '" rx="12" fill="#102635" stroke="' +
        accent +
        '" stroke-width="2"/>' +
        '<text x="48" y="72" fill="#fff" font-family="system-ui" font-size="22">' +
        Core.escapeXml(String(adapter.id || "unknown").toUpperCase()) +
        " native bridge</text>" +
        '<text x="48" y="108" fill="' +
        accent +
        '" font-family="system-ui" font-size="16">' +
        Core.escapeXml(title) +
        "</text>" +
        '<text x="48" y="145" fill="#b8cad5" font-family="system-ui" font-size="12">' +
        Core.escapeXml(errors.slice(0, 110)) +
        "</text>" +
        '<text x="48" y="' +
        Math.max(170, height - 48) +
        '" fill="#b8cad5" font-family="system-ui" font-size="12">Host adapter only - native_execution=false</text></svg>'
      );
    }

    function create(context) {
      var source = sourceBundle(context),
        bundle = source.value,
        bridgeValidation = Bridge.validate(bundle),
        canvasChecks = adapterCanvasChecks(context, bundle),
        finish = context.operationMode === "finish",
        hostReceipt = bridgeValidation.hostReceipt,
        hostIndependent = !!(
          hostReceipt && hostReceipt.independently_verified === true
        ),
        finishCheck = {
          name: "finish-requires-bound-host-application-receipt",
          pass:
            !finish ||
            (!!hostReceipt &&
              hostReceipt.applied === true &&
              hostReceipt.application_version ===
                bundle.adapter.application_version),
          details: {
            finish: finish,
            host_receipt_present: !!hostReceipt,
            host_reported_applied: !!(
              hostReceipt && hostReceipt.applied === true
            ),
          },
        },
        errors = bridgeValidation.errors.slice();

      canvasChecks.forEach(function (check) {
        if (!check.pass) errors.push(check.name);
      });
      if (!finishCheck.pass) errors.push(finishCheck.name);
      errors = unique(errors);

      var pass = !errors.length,
        state = !pass
          ? "REFUSED"
          : finish
            ? hostIndependent
              ? "HOST_REPORTED_INSPECTED"
              : "HOST_REPORTED_APPLIED"
            : context.operationMode === "validate"
              ? "VALIDATED_NOT_EXECUTED"
              : "STAGED_NOT_EXECUTED",
        commands = pass ? Bridge.commandPlan(bundle, bridgeValidation) : [],
        canvas = clone(context.targetCanvas),
        provenance = {
          hand: "native-dcc-bridge",
          hand_version: "1.1.0",
          codec_version: Bridge.VERSION,
          seed: context.seed,
          source_artifact_digests: [source.item.digest],
        },
        change = {
          schema: CHANGE_SCHEMA,
          version: "1.0.0",
          id: "native-change-" + Core.slug(context.brief.id),
          target_canvas: canvas,
          state: state,
          adapter: {
            id: bundle.adapter && bundle.adapter.id,
            application_version:
              bundle.adapter && bundle.adapter.application_version,
            contract_version: bundle.adapter && bundle.adapter.contract_version,
          },
          project: clone(bundle.project || {}),
          source_artifact: clone(
            (bundle.change && bundle.change.source_artifact) || {},
          ),
          change_digest: bridgeValidation.changeDigest,
          commands: commands,
          required_permissions: ["filesystem:write", "plugin-data"],
          approval: clone(bundle.approval || {}),
          rollback: clone(bundle.rollback || {}),
          native_execution: false,
          provenance: provenance,
        },
        recipe = {
          schema: RECIPE_SCHEMA,
          version: "1.0.0",
          id: "native-bridge-recipe-" + Core.slug(context.brief.id),
          target_canvas: canvas,
          operation: context.operationMode,
          source: {
            bundle_id: bundle.id,
            artifact_id: source.item.id,
            artifact_digest: source.item.digest,
            bundle_digest: Bridge.sha256(bundle),
          },
          adapter: clone(bundle.adapter || {}),
          change: {
            digest: bridgeValidation.changeDigest,
            source_artifact: clone(
              (bundle.change && bundle.change.source_artifact) || {},
            ),
            commands: clone(commands),
          },
          approval: clone(bundle.approval || {}),
          rollback: clone(bundle.rollback || {}),
          execution_boundary: {
            native_execution: false,
            adapter_execution_required: true,
            host_report_is_independently_verified: false,
            automatic_host_import: false,
          },
          host_application_receipt: clone(hostReceipt),
          known_limits: [
            "the hand emits a bounded transaction and never writes directly into a native application",
            "the portable bundle adapter manifest has SHA-256 integrity only; cryptographic trust belongs to a separately installed adapter package",
            hostIndependent
              ? "the installed adapter reports a separate native-process inspection, but the portable hand did not authenticate that host receipt against the local trust store"
              : "HOST_REPORTED_APPLIED means a bound host receipt reported success; AXM did not independently inspect native application state",
            "rollback is contractually bound but must be executed by the native host adapter",
          ],
          provenance: provenance,
        },
        checks = [
          {
            name: "native-bridge-bundle-contract",
            pass: bridgeValidation.pass,
            details: {
              errors: bridgeValidation.errors,
              warnings: bridgeValidation.warnings,
            },
          },
        ].concat(canvasChecks, [finishCheck]),
        svg = preview(context, state, bundle.adapter || {}, {
          pass: pass,
          errors: errors,
        }),
        preliminaryBytes =
          JSON.stringify(change).length +
          JSON.stringify(recipe).length +
          source.item.text.length +
          svg.length +
          2048,
        maximumBytes = context.targetCanvas.performance.max_file_bytes,
        budgetCheck = {
          name: "native-bridge-transaction-file-budget",
          pass: maximumBytes == null || preliminaryBytes <= maximumBytes,
          details: { estimated: preliminaryBytes, maximum: maximumBytes },
        };
      checks.push(budgetCheck);
      if (!budgetCheck.pass) {
        errors.push(budgetCheck.name);
        state = "REFUSED";
        change.state = state;
        change.commands = [];
        recipe.change.commands = [];
        commands = [];
        svg = preview(context, state, bundle.adapter || {}, {
          pass: false,
          errors: errors,
        });
      }
      pass = !errors.length;

      var receipt = {
          schema: RECEIPT_SCHEMA,
          version: "1.0.0",
          status: pass ? "PASS" : "HOLD",
          result: state,
          claim: pass
            ? state === "HOST_REPORTED_INSPECTED"
              ? "an installed adapter receipt reports that the exact approved change was applied and re-opened in a separate native process; the portable hand preserves but does not authenticate that report"
              : state === "HOST_REPORTED_APPLIED"
                ? "a version-compatible host adapter receipt reports that the exact approved change was applied; native application state was not independently inspected"
              : "the exact approved native change transaction is structurally valid and remains unexecuted"
            : "the native change transaction was refused and contains no executable command plan",
          target_canvas: canvas,
          operation: context.operationMode,
          adapter: {
            id: bundle.adapter && bundle.adapter.id,
            application_version:
              bundle.adapter && bundle.adapter.application_version,
            contract_version: bundle.adapter && bundle.adapter.contract_version,
          },
          change_digest: bridgeValidation.changeDigest,
          bundle_digest: Bridge.sha256(bundle),
          integrity: {
            algorithm: "sha-256",
            manifest_integrity_verified: bridgeValidation.integrityVerified,
            cryptographic_signature_verified: false,
          },
          approval: clone(bundle.approval || {}),
          rollback: clone(bundle.rollback || {}),
          native_execution: false,
          host_reported_applied:
            state === "HOST_REPORTED_APPLIED" ||
            state === "HOST_REPORTED_INSPECTED",
          independently_verified_application: false,
          host_reported_independent_inspection: hostIndependent,
          host_application_receipt: clone(hostReceipt),
          errors: unique(errors),
          warnings: unique(
            bridgeValidation.warnings.concat(
              hostIndependent
                ? [
                    "host independent-inspection report was not authenticated against the installed adapter trust store",
                  ]
                : ["native application state was not independently inspected"],
            ),
          ),
          checks: checks,
        },
        slug = Core.slug(context.brief.title);

      return {
        artifacts: [
          jsonArtifact(
            "native-project-change",
            "native-project-change",
            context.brief.title + " native project change",
            slug + "-native-change.json",
            change,
            false,
          ),
          jsonArtifact(
            "bridge-receipt",
            "bridge-receipt",
            context.brief.title + " native bridge receipt",
            slug + "-bridge-receipt.json",
            receipt,
            false,
          ),
          jsonArtifact(
            "native-bridge-recipe",
            "editable-native-bridge-recipe",
            context.brief.title + " native bridge recipe",
            slug + "-native-bridge-recipe.json",
            recipe,
            true,
          ),
          {
            id: "native-bridge-preview",
            role: "native-bridge-preview",
            name: context.brief.title + " native bridge preview",
            filename: slug + "-native-bridge.svg",
            mime: "image/svg+xml",
            format: "SVG",
            editable: false,
            text: svg,
            width: context.brief.canvas.width,
            height: context.brief.canvas.height,
            metadata: {
              transactionOnly: true,
              nativeExecution: false,
              state: state,
            },
          },
        ],
        previewArtifactId: "native-bridge-preview",
        recipe: {
          format: RECIPE_SCHEMA,
          parameters: recipe,
          steps: [
            { op: "verify-adapter-version-and-manifest-integrity" },
            { op: "verify-full-target-canvas-capability" },
            { op: "verify-safe-relative-paths-and-allowlisted-operations" },
            { op: "bind-independent-dual-approval-to-exact-change-digest" },
            { op: "bind-reversible-rollback-snapshot" },
            { op: "emit-host-adapter-command-plan-without-executing-it" },
            { op: "validate-optional-host-application-receipt" },
          ],
        },
        validationChecks: checks,
        measures: {
          commands: commands.length,
          errors: unique(errors).length,
          estimatedBytes: preliminaryBytes,
          nativeExecution: false,
          hostReportedApplied:
            state === "HOST_REPORTED_APPLIED" ||
            state === "HOST_REPORTED_INSPECTED",
          independentlyVerifiedApplication: false,
          hostReportedIndependentInspection: hostIndependent,
        },
        notes: [
          "This hand never writes to Blender, Godot, Unity, Unreal, FreeCAD or another native application directly.",
          "Only an explicitly installed native host adapter may execute the emitted command plan after permission, version, approval and rollback checks.",
          "A host-reported success receipt is preserved as a report and is never upgraded into an independent AXM verification claim.",
        ],
      };
    }

    return {
      descriptor: {
        schema: Core.HAND_SCHEMA,
        contract_version: "2.0",
        id: "native-dcc-bridge",
        title: "Native DCC / Engine Bridge Hand",
        version: "1.1.0",
        category: "native-dcc-bridge",
        lifecycle_status: "beta",
        summary:
          "Stages and validates exact, dual-approved native project change transactions for explicitly installed Blender, Godot, Unity, Unreal and FreeCAD host adapters.",
        purpose:
          "Provide an honest permission, version, target-canvas, provenance and rollback boundary between portable Asset Hands output and native creative applications.",
        operation_modes: ["workflow", "finish", "validate"],
        canvas_models: ["viewport-3d", "cad-parametric", "procedural-graph"],
        entry_surfaces: [
          "command",
          "asset-fabric",
          "studio-handoff",
          "mirror-handoff",
          "export-recipe",
        ],
        mutability: "transform",
        kinds: ["*"],
        wildcard_kind_policy: "native",
        accepts: [Core.BRIEF_SCHEMA, BUNDLE_SCHEMA],
        produces: [
          Core.RESULT_SCHEMA,
          CHANGE_SCHEMA,
          RECEIPT_SCHEMA,
          RECIPE_SCHEMA,
          "application/json",
          "image/svg+xml",
        ],
        input_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: BUNDLE_SCHEMA,
            roles: ["source"],
            required_for: ["workflow", "finish", "validate"],
            mutable: false,
            max_bytes: 2000000,
          },
        ],
        output_types: [
          {
            mime: "application/json",
            format: "JSON",
            schema: CHANGE_SCHEMA,
            role: "native-project-change",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: RECEIPT_SCHEMA,
            role: "bridge-receipt",
            editable: false,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "application/json",
            format: "JSON",
            schema: RECIPE_SCHEMA,
            role: "editable-native-bridge-recipe",
            editable: true,
            deterministic: true,
            lossy: false,
            known_losses: [],
          },
          {
            mime: "image/svg+xml",
            format: "SVG",
            role: "native-bridge-transaction-preview",
            editable: false,
            deterministic: true,
            lossy: true,
            known_losses: [
              "preview communicates transaction state and does not represent native project contents",
            ],
          },
        ],
        canvas_types: [
          {
            medium: "*",
            units: ["px", "mm", "m", "game-world-unit"],
            colour_spaces: [
              "srgb",
              "display-p3",
              "linear-srgb",
              "cmyk",
              "grayscale",
              "material-channel",
            ],
            transparency_modes: ["opaque", "required", "allowed"],
            material_behaviours: ["*"],
            behaviours: [
              "static",
              "animated",
              "interactive",
              "responsive",
              "tileable",
            ],
            intended_uses: ["*"],
          },
        ],
        canvas_limits: {},
        constraints_honoured: ["*"],
        editable_recipe_formats: [
          Core.RECIPE_SCHEMA,
          BUNDLE_SCHEMA,
          RECIPE_SCHEMA,
        ],
        operations: { preview: true, validate: true, edit: false },
        emits_editable_source: true,
        supports_edit_operation: false,
        requires: ["native-dcc-adapter"],
        editable: true,
        deterministic: true,
        required_permissions: {
          local_file_system: "write",
          clipboard: false,
          network_domains: [],
          device_access: [],
          plugin_data: true,
        },
        network_policy: {
          mode: "none",
          domains: [],
          rationale:
            "The shared hand validates and stages local transactions; the installed host adapter owns native application access.",
        },
        host_compatibility: {
          hosts: ["asset-fabric", "studio", "mirror", "standalone"],
          dependencies: [
            {
              name: "AXM native bridge transaction codec",
              version: Bridge.VERSION,
              bundled: true,
            },
            {
              name: "explicitly installed native DCC/engine adapter",
              version: "host-declared",
              bundled: false,
            },
          ],
        },
        engine: {
          name: "AXM permission-gated native project transaction validator",
          version: Bridge.VERSION,
          execution: "local-bounded-no-native-execution",
        },
        safety_tier: "native-bridge",
        authority: "candidate-only",
        implementation_status: "executable",
        portability: {
          interchange_formats: [BUNDLE_SCHEMA, CHANGE_SCHEMA, RECEIPT_SCHEMA],
          known_losses: [
            "portable transactions cannot independently observe proprietary native project state",
          ],
          unsupported_features: [
            "direct native application execution",
            "automatic host import",
            "network adapter discovery",
          ],
          fallbacks: [],
        },
        validation: {
          checks: [
            "adapter identifier and application version compatibility",
            "SHA-256 adapter manifest integrity without signature overclaim",
            "complete dynamic target-canvas capability declaration",
            "safe relative project/source/operation paths",
            "allowlisted bounded native operations",
            "independent dual approval bound to exact change digest",
            "reversible rollback snapshot binding",
            "optional host application receipt binding",
            "honest no-direct-native-execution claim",
          ],
        },
        evidence: [
          {
            claim:
              "OpenUSD is an extensible ecosystem for describing, composing, simulating and collaborating within 3D worlds.",
            source_url: "https://openusd.org/release/",
            specification_version: "OpenUSD",
            retrieved_at: "2026-07-19",
          },
          {
            claim:
              "glTF 2.0 defines a runtime-neutral format for transmission and loading of 3D scenes and models.",
            source_url:
              "https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html",
            specification_version: "glTF 2.0",
            retrieved_at: "2026-07-19",
          },
        ],
        tests: [
          "asset-hands-native-bridge-selftest",
          "asset-hands-hardening-selftest",
          "asset-fabric-selftest",
          "studio-selftest",
        ],
        implementation_priority: "high",
        limits: {
          adapters: ["blender", "godot", "unity", "unreal", "freecad"],
          maximumOperations: 20,
          maximumBundleBytes: 2000000,
          nativeExecution: false,
          cryptographicSignatureVerification: false,
          independentHostApplicationVerification: false,
        },
      },
      create: create,
    };
  },
);
