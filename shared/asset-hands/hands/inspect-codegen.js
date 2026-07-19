(function (root, factory) {
  var node=typeof module === "object" && module.exports;
  var provider = factory(
    node ? require("../asset-hand-core") : root.AXMAssetHandCore,
    node ? require("../raster-codec") : root.AXMRasterCodec,
    node ? require("../pdf-codec") : root.AXMPdfCodec,
    node ? require("../gltf-codec") : root.AXMGlTFCodec,
    node ? require("../otio-codec") : root.AXMOtioCodec,
  );
  if (typeof module === "object" && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register)
    root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core,Raster,Pdf,GlTF,Otio) {
  "use strict";
  function dataBytes(dataUrl){var source=String(dataUrl||""),comma=source.indexOf(",");if(comma<0)return new Uint8Array(0);var body=source.slice(comma+1);if(/;base64/i.test(source.slice(0,comma))){if(typeof Buffer!=="undefined")return new Uint8Array(Buffer.from(body,"base64"));var binary=atob(body),bytes=new Uint8Array(binary.length);for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}var decoded=decodeURIComponent(body),out=new Uint8Array(decoded.length);for(var j=0;j<decoded.length;j++)out[j]=decoded.charCodeAt(j)&255;return out;}
  function inspect(source) {
    var report = {
      schema: "axm.inspect-codegen-report/v1",
      source: {
        id: source.id,
        digest: source.digest,
        mime: source.mime,
        format: source.format,
        content_schema: source.content_schema,
      },
      summary: {
        bytes: (source.text || "").length + (source.dataUrl || "").length,
      },
      facts: {},
      errors: [],
      warnings: [],
      snippets: [],
    };
    if (source.mime === "application/json") {
      try {
        var data = JSON.parse(source.text),
          keys =
            data && typeof data === "object" ? Object.keys(data).sort() : [];
        report.facts = {
          type: Array.isArray(data) ? "array" : typeof data,
          topLevelKeys: keys,
          schema: (data && data.schema) || (data && data.format) || "",
          arrayLengths: {},
        };
        keys.forEach(function (key) {
          if (Array.isArray(data[key]))
            report.facts.arrayLengths[key] = data[key].length;
        });
        report.snippets.push({
          language: "json",
          purpose: "schema-and-keys",
          text: JSON.stringify(
            { schema: report.facts.schema, keys: keys },
            null,
            2,
          ),
        });
      } catch (error) {
        report.errors.push("JSON parse failed: " + error.message);
      }
    } else if (source.mime === "image/png" || source.mime === "image/apng") {
      var rasterBytes=dataBytes(source.dataUrl),rasterCheck=source.mime === "image/apng" ? Raster.inspectApng(rasterBytes) : Raster.inspectPng(rasterBytes);
      report.facts={container:source.mime === "image/apng"?"APNG":"PNG",width:rasterCheck.width,height:rasterCheck.height,chunks:rasterCheck.chunks,frames:rasterCheck.frames||1,deepValidated:rasterCheck.deepValidated===true};
      report.errors=report.errors.concat(rasterCheck.errors||[]);report.warnings=report.warnings.concat(rasterCheck.warnings||[]);
    } else if (source.mime === "application/pdf") {
      var pdfCheck=Pdf.inspect(dataBytes(source.dataUrl));report.facts={container:"PDF",bytes:pdfCheck.bytes,deviceCmyk:pdfCheck.deviceCmyk,header:pdfCheck.header};report.errors=report.errors.concat(pdfCheck.errors||[]);
    } else if (source.mime === "model/gltf-binary") {
      var glbCheck=GlTF.inspect(dataBytes(source.dataUrl));report.facts={container:"GLB",version:glbCheck.version,length:glbCheck.length,asset:glbCheck.json&&glbCheck.json.asset||null,meshes:glbCheck.json&&glbCheck.json.meshes&&glbCheck.json.meshes.length||0};report.errors=report.errors.concat(glbCheck.errors||[]);
    } else if (source.mime === "application/vnd.opentimelineio+json") {
      var otioCheck=Otio.inspect(source.text);report.facts={container:"OTIO",tracks:otioCheck.tracks};report.errors=report.errors.concat(otioCheck.errors||[]);
    } else if (source.mime === "application/mtlx+xml") {
      report.facts={container:"MaterialX",version:(/<materialx\s+version=["']([^"']+)/i.exec(source.text)||[])[1]||"",standardSurfaceCount:(source.text.match(/standard_surface/gi)||[]).length};if(!/^<\?xml|^<materialx/i.test(source.text.trim())||!/<materialx\b/i.test(source.text)||!/<\/materialx>\s*$/i.test(source.text))report.errors.push("MaterialX document envelope invalid");
    } else if (source.mime === "application/dxf") {
      report.facts={container:"DXF",layers:Array.from(new Set((source.text.match(/(?:CUT|ENGRAVE|SLOT|REGISTRATION)/g)||[]))).sort(),hasUnits:source.text.indexOf("$INSUNITS")>=0};if(!/^0\r?\nSECTION/m.test(source.text)||!/0\r?\nEOF\s*$/.test(source.text))report.errors.push("DXF SECTION/EOF envelope invalid");
    } else if (source.mime === "model/obj") {
      report.facts={container:"OBJ",vertices:(source.text.match(/^v\s+/gm)||[]).length,faces:(source.text.match(/^f\s+/gm)||[]).length};if(!report.facts.vertices||!report.facts.faces)report.errors.push("OBJ vertices and faces required");
    } else if (source.mime === "text/css") {
      var variables = [],
        match,
        re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
      while ((match = re.exec(source.text)) && variables.length < 300)
        variables.push({ name: "--" + match[1], value: match[2].trim() });
      report.facts = {
        customProperties: variables,
        ruleCount: (source.text.match(/\{/g) || []).length,
        externalReferences: (
          source.text.match(/(?:@import|url\(\s*["']?https?:)/gi) || []
        ).length,
      };
      report.snippets.push({
        language: "css",
        purpose: "declared-custom-properties",
        text: variables
          .map(function (item) {
            return item.name + ": " + item.value + ";";
          })
          .join("\n"),
      });
      if (report.facts.externalReferences)
        report.warnings.push(
          "External CSS references require separate host permission review.",
        );
    } else if (source.mime === "image/svg+xml") {
      var svgErrors = Core.validateSvg(source.text);
      report.facts = {
        viewBox: (/viewBox=["']([^"']+)/.exec(source.text) || [])[1] || "",
        pathCount: (source.text.match(/<path\b/g) || []).length,
        shapeCount: (
          source.text.match(
            /<(?:rect|circle|ellipse|polygon|polyline|line)\b/g,
          ) || []
        ).length,
      };
      report.errors = report.errors.concat(svgErrors);
      report.snippets.push({
        language: "svg",
        purpose: "document-facts",
        text:
          "viewBox=" +
          report.facts.viewBox +
          "; paths=" +
          report.facts.pathCount +
          "; shapes=" +
          report.facts.shapeCount,
      });
    } else {
      report.facts = {
        lineCount: (source.text || "").split(/\r?\n/).length,
        hasDataUrl: !!source.dataUrl,
      };
      report.snippets.push({
        language: "text",
        purpose: "container-facts",
        text: "mime=" + source.mime + "; bytes=" + report.summary.bytes,
      });
    }
    report.status = report.errors.length
      ? "FAIL"
      : report.warnings.length
        ? "WARN"
        : "PASS";
    return report;
  }
  return {
    descriptor: {
      schema: Core.HAND_SCHEMA,
      contract_version: "2.0",
      id: "inspect-codegen",
      title: "Validation, Inspect & Codegen Hand",
      version: "1.1.0",
      category: "inspection",
      lifecycle_status: "beta",
      summary:
        "Validates or inspects typed AXM source artifacts without mutating them and emits a bounded machine report plus small code-oriented facts.",
      operation_modes: ["inspect", "validate"],
      canvas_models: ["node-tree-design", "dom-component", "vector-document"],
      entry_surfaces: ["inspect", "codegen", "validator-panel"],
      mutability: "read-only",
      kinds: ["*"],
      wildcard_kind_policy: "native",
      accepts: [Core.BRIEF_SCHEMA, Core.SOURCE_ARTIFACT_SCHEMA],
      produces: [Core.RESULT_SCHEMA, "application/json", "text/plain"],
      input_types: [
        {
          mime: "application/json",
          required_for: ["inspect", "validate"],
          mutable: false,
          max_bytes: 2000000,
        },
        {
          mime: "text/css",
          required_for: ["inspect", "validate"],
          mutable: false,
          max_bytes: 2000000,
        },
        {
          mime: "image/svg+xml",
          required_for: ["inspect", "validate"],
          mutable: false,
          max_bytes: 600000,
        },
        {
          mime: "text/plain",
          required_for: ["inspect", "validate"],
          mutable: false,
          max_bytes: 2000000,
        },
        {mime:"image/png",required_for:["inspect","validate"],mutable:false,max_bytes:12000000},
        {mime:"image/apng",required_for:["inspect","validate"],mutable:false,max_bytes:12000000},
        {mime:"application/pdf",required_for:["inspect","validate"],mutable:false,max_bytes:12000000},
        {mime:"model/gltf-binary",required_for:["inspect","validate"],mutable:false,max_bytes:12000000},
        {mime:"application/vnd.opentimelineio+json",required_for:["inspect","validate"],mutable:false,max_bytes:4000000},
        {mime:"application/mtlx+xml",required_for:["inspect","validate"],mutable:false,max_bytes:4000000},
        {mime:"application/dxf",required_for:["inspect","validate"],mutable:false,max_bytes:4000000},
        {mime:"model/obj",required_for:["inspect","validate"],mutable:false,max_bytes:12000000},
      ],
      output_types: [
        {
          mime: "application/json",
          format: "JSON",
          schema: "axm.inspect-codegen-report/v1",
          role: "inspection-report",
          editable: false,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
        {
          mime: "text/plain",
          format: "TEXT",
          schema: "",
          role: "codegen-summary",
          editable: false,
          deterministic: true,
          lossy: true,
          known_losses: [
            "summary contains selected facts rather than the full source",
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
          transparency_modes: ["required", "allowed", "opaque"],
          behaviours: [
            "static",
            "animated",
            "interactive",
            "responsive",
            "tileable",
          ],
          material_behaviours: ["*"],
          intended_uses: ["*"],
        },
      ],
      constraints_honoured: ["*"],
      editable_recipe_formats: [
        Core.RECIPE_SCHEMA,
        "axm.inspect-codegen-recipe/v1",
      ],
      operations: { preview: false, validate: true, edit: false },
      emits_editable_source: false,
      supports_edit_operation: false,
      requires: [],
      editable: false,
      deterministic: true,
      required_permissions: { local_file_system: "none", network_domains: [] },
      network_policy: { mode: "none", domains: [] },
      engine: {
        name: "AXM bounded artifact inspector",
        version: "1.0.0",
        execution: "same-thread-bounded",
      },
      safety_tier: "safe-local",
      portability: {
        interchange_formats: [
          "application/json",
          "text/css",
          "image/svg+xml",
          "text/plain",
          "image/png",
          "image/apng",
          "application/pdf",
          "model/gltf-binary",
          "application/vnd.opentimelineio+json",
          "application/mtlx+xml",
          "application/dxf",
          "model/obj",
        ],
        known_losses: ["binary validation is structural and does not simulate every consuming application"],
        unsupported_features: [
          "source mutation",
          "automatic host apply",
          "full renderer or press simulation",
        ],
        fallbacks: [],
      },
      validation: {
        checks: [
          "source digest retained",
          "container parse",
          "external reference warning",
          "file budget",
        ],
      },
      rollback: { strategy: "no-write-read-only" },
      tests: ["asset-hands-selftest"],
      implementation_priority: "quick-win",
      limits: { readOnly: true, maxSourceBytes: 2000000, maxSnippets: 300 },
    },
    create: function (context) {
      var source = context.sourceArtifacts[0],
        before = Core.hash(source),
        report = inspect(source),
        after = Core.hash(source),
        json = JSON.stringify(report, null, 2),
        summary = [
          report.status,
          source.name,
          source.content_schema || source.mime,
          report.summary.bytes + " bytes",
        ]
          .concat(report.errors, report.warnings)
          .join("\n"),
        total = json.length + summary.length,
        strict =
          context.operationMode === "validate" ||
          context.qualityRequirements.strict_validation;
      return {
        artifacts: [
          {
            id: "inspection-report",
            role: "inspection-report",
            name: source.name + " inspection",
            filename: Core.slug(source.name) + "-inspection.json",
            mime: "application/json",
            format: "JSON",
            editable: false,
            text: json,
            metadata: { schema: report.schema, sourceDigest: source.digest },
          },
          {
            id: "codegen-summary",
            role: "codegen-summary",
            name: source.name + " code facts",
            filename: Core.slug(source.name) + "-codegen.txt",
            mime: "text/plain",
            format: "TEXT",
            editable: false,
            text: summary,
            metadata: { sourceDigest: source.digest },
          },
        ],
        previewArtifactId: "inspection-report",
        recipe: {
          format: "axm.inspect-codegen-recipe/v1",
          parameters: {
            operation: context.operationMode,
            sourceId: source.id,
            sourceDigest: source.digest,
            mime: source.mime,
            strict: strict,
          },
          steps: [
            { op: "verify-bounded-source-envelope" },
            { op: "inspect-container-read-only" },
            { op: "emit-selected-code-facts" },
            { op: "verify-source-unchanged" },
          ],
        },
        validationChecks: [
          { name: "source-artifact-present", pass: !!source },
          { name: "source-unchanged", pass: before === after },
          {
            name: "container-readable",
            pass:
              report.status !== "FAIL" && (!strict || report.status === "PASS"),
          },
          {
            name: "file-budget",
            pass:
              context.targetCanvas.performance.max_file_bytes == null ||
              total <= context.targetCanvas.performance.max_file_bytes,
          },
        ],
        measures: {
          sourceBytes: report.summary.bytes,
          errorCount: report.errors.length,
          warningCount: report.warnings.length,
          outputBytes: total,
        },
        notes: [
          "The hand is read-only and emits selected facts; it does not modify or apply source content.",
        ],
      };
    },
  };
});
