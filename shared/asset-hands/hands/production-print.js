(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    provider = factory(
      node ? require("../asset-hand-core") : root.AXMAssetHandCore,
      node ? require("../pdf-codec") : root.AXMPdfCodec,
    );
  if (node) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register)
    root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core, Pdf) {
  "use strict";
  if (!Pdf) throw new Error("AXM PDF Codec is required");
  function source(context) {
    if (context.operationMode !== "edit") return null;
    try {
      var value = JSON.parse(context.sourceArtifacts[0].text),
        canvas = context.targetCanvas;
      if (value.schema !== "axm.print-document/v1") throw new Error();
      value.target_canvas = canvas;
      value.layout = Object.assign({}, value.layout || {}, {
        kind: context.brief.kind,
        trim: [canvas.dimensions.width, canvas.dimensions.height],
        bleed: canvas.physical.bleed || 0,
        minimum_stroke: Math.max(
          0.05,
          canvas.physical.minimum_stroke == null
            ? 0.25
            : canvas.physical.minimum_stroke,
        ),
        safe_margin: canvas.print.safe_margin,
        crop_marks: canvas.print.crop_marks,
        registration_marks: canvas.print.registration_marks,
      });
      return value;
    } catch (error) {
      throw new Error("Print edit requires axm.print-document/v1 JSON");
    }
  }
  function preview(brief, canvas, palette) {
    var w = brief.canvas.width,
      h = brief.canvas.height,
      pad = Math.max(10, Math.min(w, h) * 0.07),
      body =
        '<rect width="' +
        w +
        '" height="' +
        h +
        '" fill="#d9e0e5"/><rect x="' +
        pad +
        '" y="' +
        pad +
        '" width="' +
        (w - pad * 2) +
        '" height="' +
        (h - pad * 2) +
        '" rx="8" fill="' +
        palette[0] +
        '"/><text x="' +
        pad * 1.8 +
        '" y="' +
        pad * 2.5 +
        '" fill="#fff" font-family="system-ui" font-size="' +
        Math.max(14, w * 0.055) +
        '" font-weight="700">' +
        Core.escapeXml(brief.title) +
        '</text><path d="M' +
        pad * 1.8 +
        " " +
        pad * 3.1 +
        " H" +
        (w - pad * 1.8) +
        '" stroke="' +
        palette[1] +
        '" stroke-width="3"/><circle cx="' +
        (w - pad * 2.6) +
        '" cy="' +
        (h - pad * 2.3) +
        '" r="' +
        Math.max(8, Math.min(w, h) * 0.08) +
        '" fill="' +
        palette[2] +
        '"/><text x="' +
        pad * 1.8 +
        '" y="' +
        (h - pad * 1.7) +
        '" fill="#c8d5df" font-family="system-ui" font-size="11">CMYK operators · ' +
        canvas.dimensions.width +
        "×" +
        canvas.dimensions.height +
        " " +
        canvas.dimensions.unit +
        " · bleed " +
        (canvas.physical.bleed || 0) +
        "</text>";
    return Core.svgDocument(brief, body, {
      label: brief.title + " print proof preview",
    });
  }
  return {
    descriptor: {
      schema: Core.HAND_SCHEMA,
      contract_version: "2.0",
      id: "production-print",
      title: "Production Print Hand",
      version: "1.1.0",
      category: "print",
      lifecycle_status: "beta",
      summary:
        "Creates a real DeviceCMYK PDF with declared trim, bleed, crop marks and minimum stroke plus an editable print document and preview.",
      purpose:
        "Produce a bounded printable PDF whose target canvas shapes page geometry before encoding.",
      operation_modes: ["create", "edit"],
      canvas_models: ["page-document"],
      entry_surfaces: ["command", "print-editor", "export-recipe"],
      mutability: "transform",
      kinds: [
        "poster",
        "cover",
        "illustration",
        "document",
        "print-document",
        "label",
      ],
      accepts: [Core.BRIEF_SCHEMA, "axm.print-document/v1"],
      produces: [
        Core.RESULT_SCHEMA,
        "application/pdf",
        "application/json",
        "image/svg+xml",
      ],
      input_types: [
        {
          mime: "application/json",
          format: "JSON",
          schema: "axm.print-document/v1",
          roles: ["source"],
          required_for: ["edit"],
          mutable: false,
          max_bytes: 1000000,
        },
      ],
      output_types: [
        {
          mime: "application/pdf",
          format: "PDF",
          schema: "",
          role: "print-delivery",
          editable: false,
          deterministic: true,
          lossy: true,
          known_losses: [
            "PDF is a delivery container, not the editable print master",
          ],
        },
        {
          mime: "application/json",
          format: "JSON",
          schema: "axm.print-document/v1",
          role: "editable-print-source",
          editable: true,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
        {
          mime: "image/svg+xml",
          format: "SVG",
          schema: "",
          role: "print-preview",
          editable: false,
          deterministic: true,
          lossy: true,
          known_losses: [
            "screen preview does not simulate press, paper or ICC output",
          ],
        },
      ],
      canvas_types: [
        {
          medium: "print",
          units: ["mm"],
          colour_spaces: ["cmyk"],
          transparency_modes: ["opaque"],
          behaviours: ["static"],
          intended_uses: [
            "poster",
            "cover",
            "document",
            "print-document",
            "label",
            "illustration",
          ],
        },
        {
          medium: "paper",
          units: ["mm"],
          colour_spaces: ["cmyk"],
          transparency_modes: ["opaque"],
          behaviours: ["static"],
          intended_uses: [
            "poster",
            "cover",
            "document",
            "print-document",
            "label",
          ],
        },
      ],
      canvas_limits: {
        min_width: 10,
        min_height: 10,
        max_width: 2000,
        max_height: 2000,
        max_bleed: 50,
        min_stroke: 0.05,
        max_stroke: 20,
      },
      constraints_honoured: [
        "dimensions",
        "dimensions.unit",
        "colour.space",
        "colour.transparency",
        "colour.printable",
        "physical.bleed",
        "physical.minimum-stroke",
        "print.safe-margin",
        "print.crop-marks",
        "print.registration-marks",
        "behaviour.static",
        "performance.max-file-bytes",
      ],
      editable_recipe_formats: [
        Core.RECIPE_SCHEMA,
        "axm.production-print-recipe/v1",
        "axm.print-document/v1",
      ],
      operations: { preview: true, validate: true, edit: true },
      emits_editable_source: true,
      supports_edit_operation: true,
      requires: [],
      editable: true,
      deterministic: true,
      required_permissions: { local_file_system: "none", network_domains: [] },
      network_policy: { mode: "none", domains: [] },
      host_compatibility: { dependencies: [{ id: "jsPDF", version: "4.2.1" }] },
      engine: {
        name: "jsPDF DeviceCMYK print encoder",
        version: "4.2.1",
        execution: "same-thread-bounded",
      },
      safety_tier: "safe-local",
      portability: {
        interchange_formats: ["application/pdf", "axm.print-document/v1"],
        known_losses: [
          "No PDF/X conformance or embedded press ICC profile is claimed",
        ],
        unsupported_features: [
          "PDF/X certification",
          "ICC output intent",
          "font embedding beyond jsPDF core fonts",
          "tagged accessible PDF",
        ],
        fallbacks: [],
      },
      validation: {
        checks: [
          "PDF header and EOF",
          "MediaBox",
          "DeviceCMYK operators",
          "exact trim and bleed geometry",
          "file budget",
        ],
      },
      rollback: { strategy: "discard-candidate" },
      evidence: [
        {
          claim:
            "The installed jsPDF engine emits real PDF bytes and supports four-channel CMYK colour operators.",
          source_url: "local:node_modules/jspdf",
          specification_version: "4.2.1",
        },
      ],
      tests: ["asset-hands-interchange-selftest", "asset-hands-selftest"],
      implementation_priority: "quick-win",
      limits: {
        maxWidthMm: 2000,
        maxHeightMm: 2000,
        maxBleedMm: 50,
        pdfX: false,
        icc: false,
      },
    },
    create: function (context) {
      var canvas = context.targetCanvas,
        minimumStroke = Math.max(
          0.05,
          canvas.physical.minimum_stroke == null
            ? 0.25
            : canvas.physical.minimum_stroke,
        ),
        existing = source(context),
        document = existing || {
          schema: "axm.print-document/v1",
          version: 1,
          id: Core.slug(context.brief.title),
          title: context.brief.title,
          purpose: context.brief.purpose,
          target_canvas: canvas,
          layout: {
            kind: context.brief.kind,
            trim: [canvas.dimensions.width, canvas.dimensions.height],
            bleed: canvas.physical.bleed || 0,
            minimum_stroke: minimumStroke,
            safe_margin: canvas.print.safe_margin,
            crop_marks: canvas.print.crop_marks,
            registration_marks: canvas.print.registration_marks,
          },
          colour: { model: "DeviceCMYK", printable_colours: true },
          elements: [
            { kind: "title", text: context.brief.title },
            { kind: "body", text: context.brief.purpose },
            { kind: "accent-geometry", palette: context.palette.slice(0, 4) },
          ],
        },
        pdf = Pdf.encodePrintDocument({
          title: document.title,
          purpose: document.purpose,
          widthMm: canvas.dimensions.width,
          heightMm: canvas.dimensions.height,
          bleedMm: canvas.physical.bleed || 0,
          minimumStrokeMm: minimumStroke,
          safeMarginMm: canvas.print.safe_margin,
          cropMarks: canvas.print.crop_marks || canvas.physical.bleed > 0,
          registrationMarks: canvas.print.registration_marks,
          elements: document.elements,
        }),
        json = JSON.stringify(document, null, 2),
        svg = preview(context.brief, canvas, context.palette),
        total = pdf.byteLength + json.length + svg.length;
      return {
        artifacts: [
          {
            id: "production-pdf",
            role: "print-delivery",
            name: context.brief.title + " print PDF",
            filename: Core.slug(context.brief.title) + ".pdf",
            mime: "application/pdf",
            format: "PDF",
            editable: false,
            dataUrl: pdf.dataUrl,
            metadata: {
              pages: 1,
              trim_mm: [pdf.widthMm, pdf.heightMm],
              bleed_mm: pdf.bleedMm,
              safe_margin_mm: pdf.safeMarginMm,
              crop_marks: pdf.cropMarks,
              registration_marks: pdf.registrationMarks,
              page_mm: [pdf.pageWidthMm, pdf.pageHeightMm],
              rendered_content: pdf.renderedContent,
              colour: "DeviceCMYK",
              pdfX: false,
              iccProfile: false,
            },
          },
          {
            id: "print-document",
            role: "editable-print-source",
            name: context.brief.title + " print document",
            filename: Core.slug(context.brief.title) + ".print.json",
            mime: "application/json",
            format: "JSON",
            editable: true,
            text: json,
            metadata: { schema: document.schema },
          },
          {
            id: "print-preview",
            role: "print-preview",
            name: context.brief.title + " print preview",
            filename: Core.slug(context.brief.title) + "-print-preview.svg",
            mime: "image/svg+xml",
            format: "SVG",
            editable: false,
            text: svg,
            width: context.brief.canvas.width,
            height: context.brief.canvas.height,
          },
        ],
        previewArtifactId: "print-preview",
        recipe: {
          format: "axm.production-print-recipe/v1",
          parameters: {
            operation: context.operationMode,
            trimMm: [pdf.widthMm, pdf.heightMm],
            bleedMm: pdf.bleedMm,
            minimumStrokeMm: minimumStroke,
            safeMarginMm: pdf.safeMarginMm,
            cropMarks: pdf.cropMarks,
            registrationMarks: pdf.registrationMarks,
            colourOperator: "DeviceCMYK",
            pdfX: false,
            iccProfile: false,
          },
          steps: [
            { op: "derive-page-box-from-target-canvas" },
            { op: "extend-artwork-through-bleed" },
            { op: "draw-crop-marks" },
            { op: "encode-device-cmyk-pdf" },
            { op: "validate-pdf-structure" },
          ],
        },
        validationChecks: [
          {
            name: "target-canvas-propagated",
            pass: document.target_canvas.schema === Core.TARGET_CANVAS_SCHEMA,
          },
          {
            name: "pdf-structure",
            pass: pdf.inspection.pass,
            details: pdf.inspection,
          },
          { name: "device-cmyk-operators", pass: pdf.inspection.deviceCmyk },
          {
            name: "trim-honoured",
            pass:
              pdf.widthMm === canvas.dimensions.width &&
              pdf.heightMm === canvas.dimensions.height,
          },
          {
            name: "bleed-honoured",
            pass: pdf.bleedMm === (canvas.physical.bleed || 0),
          },
          {
            name: "minimum-stroke-honoured",
            pass: minimumStroke >= (canvas.physical.minimum_stroke || 0),
          },
          {
            name: "safe-margin-honoured",
            pass:
              canvas.print.safe_margin == null ||
              pdf.safeMarginMm === canvas.print.safe_margin,
          },
          {
            name: "crop-marks-honoured",
            pass: !canvas.print.crop_marks || pdf.cropMarks === true,
          },
          {
            name: "registration-marks-honoured",
            pass:
              !canvas.print.registration_marks ||
              pdf.registrationMarks === true,
          },
          {
            name: "file-budget",
            pass:
              canvas.performance.max_file_bytes == null ||
              total <= canvas.performance.max_file_bytes,
          },
        ],
        measures: { pdfBytes: pdf.byteLength, totalBytes: total, pages: 1 },
        notes: [
          "This is a real CMYK-operator PDF with trim and bleed geometry.",
          "PDF/X certification and embedded press ICC output intent are outside this general PDF hand; use the dedicated PDF/X press-production hand when requested.",
        ],
      };
    },
  };
});
