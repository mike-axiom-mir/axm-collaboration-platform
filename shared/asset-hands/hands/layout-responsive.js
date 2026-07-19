(function (root, factory) {
  var provider = factory(
    typeof module === "object" && module.exports
      ? require("../asset-hand-core")
      : root.AXMAssetHandCore,
  );
  if (typeof module === "object" && module.exports) module.exports = provider;
  else if (root.AXMAssetHands && root.AXMAssetHands.register)
    root.AXMAssetHands.register(provider);
  else {
    root.AXMAssetHandProviders = root.AXMAssetHandProviders || [];
    root.AXMAssetHandProviders.push(provider);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";
  function sourceLayout(context) {
    if (context.operationMode !== "edit") return null;
    try {
      var parsed = JSON.parse(context.sourceArtifacts[0].text);
      if (parsed.schema !== "axm.responsive-layout/v1") throw new Error();
      return parsed;
    } catch (error) {
      throw new Error(
        "Layout edit requires valid axm.responsive-layout/v1 JSON",
      );
    }
  }
  function makeLayout(context, source) {
    var canvas = context.targetCanvas,
      width = canvas.dimensions.width,
      height = canvas.dimensions.height,
      compact = /compact|dense/i.test(context.brief.styleTags.join(" ")),
      gap = compact ? 8 : 16,
      pad = compact ? 12 : 24,
      contrast = Core.accessiblePair(context.palette[0],context.palette[2],canvas.colour.minimum_contrast_ratio || 4.5),
      minimumTarget = canvas.responsive.minimum_target_size || 44;
    var declaredBreakpoints=canvas.responsive.breakpoints.length?canvas.responsive.breakpoints.map(function(item,index){return{id:item.id,min:item.min_width,max:item.max_width,unit:item.unit,columns:Math.min(3,index+1)};}):[
        { id: "compact", min:null,max: 559,unit:"px", columns: 1 },
        { id: "medium", min: 560, max: 979,unit:"px", columns: 2 },
        { id: "wide", min: 980,max:null,unit:"px", columns: 3 },
      ],activeBreakpoint=declaredBreakpoints.find(function(item){return(item.min==null||width>=item.min)&&(item.max==null||width<=item.max);})||declaredBreakpoints[declaredBreakpoints.length-1],columns=activeBreakpoint.columns,
      regions = (source && Array.isArray(source.regions) && source.regions.length
        ? source.regions
        : [
            { id: "header", role: "banner", span: "full" },
            { id: "navigation", role: "navigation", span: 1 },
            { id: "content", role: "main", span: Math.max(1, columns - 1) },
            { id: "status", role: "status", span: "full" },
          ]
      ).slice(0, 24);
    return {
      schema: "axm.responsive-layout/v1",
      version: 1,
      id: Core.slug(context.brief.title),
      name: context.brief.title,
      target_canvas: canvas,
      operation: context.operationMode,
      container: {
        width: width,
        height: height,
        unit: "px",
        padding: pad,
        gap: gap,
        direction: canvas.responsive.direction,
        locale: canvas.responsive.locale,
      },
      breakpoints: declaredBreakpoints,
      active: {
        breakpoint: activeBreakpoint.id,
        columns: columns,
        density: compact ? "compact" : "comfortable",
        navigation: width < 700 ? "rail" : "left",
      },
      regions: regions,
      interaction: {
        minimum_target_px: minimumTarget,
        keyboard_order: regions.map(function (region) { return region.id; }),
        overflow: "auto",
        input_modalities: canvas.responsive.input_modalities,
        reduced_motion: canvas.responsive.reduced_motion,
        focus_visible: true,
      },
      tokens: {background:contrast.background,foreground:contrast.foreground,focus:context.palette[3],contrast_ratio:contrast.ratio},
      provenance: {
        engine: "AXM responsive grid",
        source_layout_id: (source && source.id) || null,
      },
    };
  }
  function css(layout) {
    var gap = layout.container.gap,
      pad = layout.container.padding;
    var lines=[
      "/* axm.responsive-layout/v1 - "+layout.id+" */",
      ".axm-layout { display:grid; grid-template-columns:repeat("+layout.active.columns+",minmax(0,1fr)); gap:"+gap+"px; padding:"+pad+"px; min-width:0; direction:"+layout.container.direction+"; background:"+layout.tokens.background+"; color:"+layout.tokens.foreground+"; }",
      '.axm-layout > [data-span="full"] { grid-column:1 / -1; }',
      '.axm-layout button,.axm-layout [role="button"] { min-width:'+layout.interaction.minimum_target_px+'px; min-height:'+layout.interaction.minimum_target_px+'px; }',
      ".axm-layout :focus-visible { outline:3px solid "+layout.tokens.focus+"; outline-offset:2px; }"
    ];
    layout.breakpoints.forEach(function(item){var conditions=[];if(item.min!=null)conditions.push("(min-width:"+item.min+item.unit+")");if(item.max!=null)conditions.push("(max-width:"+item.max+item.unit+")");if(conditions.length)lines.push("@media "+conditions.join(" and ")+" { .axm-layout { grid-template-columns:repeat("+item.columns+",minmax(0,1fr));"+(item.columns===1?" padding:"+Math.max(8,pad/2)+"px;":"")+" } }");});
    if(layout.interaction.reduced_motion)lines.push("@media (prefers-reduced-motion: reduce) { .axm-layout,.axm-layout * { animation:none !important; transition:none !important; } }");
    return lines.join("\n")+"\n";
  }
  function preview(brief, layout, palette) {
    var w = brief.canvas.width,
      h = brief.canvas.height,
      p = layout.container.padding,
      g = layout.container.gap,
      cols = layout.active.columns,
      usable = w - p * 2,
      cell = Math.max(1, (usable - g * (cols - 1)) / cols),
      head = Math.max(12, h * 0.16),
      body =
        '<rect width="' +
        w +
        '" height="' +
        h +
        '" fill="' +
        palette[0] +
        '"/><rect x="' +
        p +
        '" y="' +
        p +
        '" width="' +
        usable +
        '" height="' +
        Math.max(8, head - p * 0.25) +
        '" rx="' +
        Math.max(4, p * 0.3) +
        '" fill="' +
        palette[1] +
        '" fill-opacity=".34"/>';
    for (var i = 0; i < cols; i += 1) {
      body +=
        '<rect x="' +
        (p + i * (cell + g)) +
        '" y="' +
        (p + head) +
        '" width="' +
        cell +
        '" height="' +
        Math.max(8, h - p * 2 - head) +
        '" rx="' +
        Math.max(4, p * 0.25) +
        '" fill="' +
        (i % 2 ? palette[1] : palette[2]) +
        '" fill-opacity="' +
        (i % 2 ? ".18" : ".10") +
        '" stroke="' +
        palette[1] +
        '" stroke-opacity=".45"/>';
    }
    return Core.svgDocument(brief, body, {
      label: brief.title + " responsive layout preview",
      extraAttributes:'direction="'+layout.container.direction+'"'+(layout.container.locale?' xml:lang="'+Core.escapeXml(layout.container.locale)+'"':''),
    });
  }
  return {
    descriptor: {
      schema: Core.HAND_SCHEMA,
      contract_version: "2.0",
      id: "layout-responsive",
      title: "Layout & Responsive Hand",
      version: "1.1.0",
      category: "layout",
      lifecycle_status: "beta",
      summary:
        "Creates responsive grid contracts, deterministic CSS and a geometry-derived preview for UI and screen canvases.",
      operation_modes: ["create", "edit"],
      canvas_models: ["dom-component"],
      entry_surfaces: ["command", "component-editor", "export-recipe"],
      mutability: "transform",
      kinds: ["layout", "ui-layout", "panel"],
      accepts: [Core.BRIEF_SCHEMA, "axm.responsive-layout/v1"],
      produces: [
        Core.RESULT_SCHEMA,
        "application/json",
        "text/css",
        "image/svg+xml",
      ],
      input_types: [
        {
          mime: "application/json",
          schema: "axm.responsive-layout/v1",
          roles: ["source"],
          required_for: ["edit"],
          mutable: false,
          max_bytes: 524288,
        },
      ],
      output_types: [
        {
          mime: "application/json",
          format: "JSON",
          schema: "axm.responsive-layout/v1",
          role: "editable-layout-source",
          editable: true,
          deterministic: true,
          lossy: false,
          known_losses: [],
        },
        {
          mime: "text/css",
          format: "CSS",
          role: "responsive-css",
          editable: true,
          deterministic: true,
          lossy: true,
          known_losses: ["host-specific component behaviour is not encoded"],
        },
        {
          mime: "image/svg+xml",
          format: "SVG",
          role: "layout-preview",
          editable: false,
          deterministic: true,
          lossy: true,
          known_losses: ["preview is a static geometry proof"],
        },
      ],
      canvas_types: [
        {
          medium: "ui",
          units: ["px"],
          colour_spaces: ["srgb"],
          transparency_modes: ["opaque"],
          behaviours: ["static", "interactive", "responsive"],
          intended_uses: [
            "layout",
            "ui-layout",
            "panel",
            "dashboard",
            "ui-component",
          ],
        },
        {
          medium: "screen",
          units: ["px"],
          colour_spaces: ["srgb"],
          transparency_modes: ["opaque"],
          behaviours: ["static", "interactive", "responsive"],
          intended_uses: ["layout", "ui-layout", "dashboard", "screen"],
        },
      ],
      constraints_honoured: [
        "dimensions",
        "dimensions.unit",
        "colour.space",
        "colour.transparency",
        "colour.contrast",
        "responsive.direction",
        "responsive.breakpoints",
        "responsive.locale",
        "responsive.input-modalities",
        "responsive.reduced-motion",
        "responsive.minimum-target-size",
        "accessibility.reading-order",
        "accessibility.focus-visible",
        "behaviour.static",
        "behaviour.interactive",
        "behaviour.responsive",
        "performance.max-file-bytes",
      ],
      canvas_limits: {min_width:1,min_height:1,max_width:8192,max_height:8192},
      editable_recipe_formats: [
        Core.RECIPE_SCHEMA,
        "axm.responsive-layout-recipe/v1",
      ],
      operations: { preview: true, validate: true, edit: true },
      emits_editable_source: true,
      supports_edit_operation: true,
      requires: [],
      editable: true,
      deterministic: true,
      required_permissions: { local_file_system: "none", network_domains: [] },
      network_policy: { mode: "none", domains: [] },
      engine: {
        name: "AXM responsive grid",
        version: "1.0.0",
        execution: "same-thread-bounded",
      },
      safety_tier: "safe-local",
      portability: {
        interchange_formats: ["application/json", "text/css"],
        known_losses: [
          "USS, TSS and native layout systems require explicit adapters",
        ],
        unsupported_features: ["automatic host apply"],
        fallbacks: [],
      },
      validation: {
        checks: [
          "overflow policy",
          "minimum target size",
          "breakpoint coverage",
          "file budget",
        ],
      },
      rollback: { strategy: "discard-candidate" },
      tests: ["asset-hands-selftest"],
      implementation_priority: "quick-win",
      limits: {
        maxRegions: 24,
        automaticApply: false,
        absolutePositioning: false,
      },
    },
    create: function (context) {
      var source = sourceLayout(context),
        layout = makeLayout(context, source),
        layoutText = JSON.stringify(layout, null, 2),
        cssText = css(layout),
        svg = preview(context.brief, layout, [layout.tokens.background,context.palette[1],layout.tokens.foreground,layout.tokens.focus]),
        total = layoutText.length + cssText.length + svg.length;
      return {
        artifacts: [
          {
            id: "layout-source",
            role: "editable-layout-source",
            name: context.brief.title + " layout",
            filename: Core.slug(context.brief.title) + ".layout.json",
            mime: "application/json",
            format: "JSON",
            editable: true,
            text: layoutText,
            metadata: { schema: layout.schema },
          },
          {
            id: "layout-css",
            role: "responsive-css",
            name: context.brief.title + " CSS",
            filename: Core.slug(context.brief.title) + ".layout.css",
            mime: "text/css",
            format: "CSS",
            editable: true,
            text: cssText,
          },
          {
            id: "layout-preview",
            role: "layout-preview",
            name: context.brief.title + " preview",
            filename: Core.slug(context.brief.title) + "-layout.svg",
            mime: "image/svg+xml",
            format: "SVG",
            editable: false,
            text: svg,
            width: context.brief.canvas.width,
            height: context.brief.canvas.height,
          },
        ],
        previewArtifactId: "layout-preview",
        recipe: {
          format: "axm.responsive-layout-recipe/v1",
          parameters: {
            operation: context.operationMode,
            columns: layout.active.columns,
            padding: layout.container.padding,
            gap: layout.container.gap,
            breakpoints: layout.breakpoints,
            direction: layout.container.direction,
            minimumTargetSize: layout.interaction.minimum_target_px,
            contrastRatio: layout.tokens.contrast_ratio,
          },
          steps: [
            { op: "measure-target-container" },
            { op: "select-responsive-grid" },
            { op: "declare-overflow-and-focus-order" },
            { op: "emit-layout-css-and-preview" },
          ],
        },
        validationChecks: [
          {
            name: "target-canvas-propagated",
            pass: layout.target_canvas.schema === Core.TARGET_CANVAS_SCHEMA,
          },
          {
            name: "breakpoint-coverage",
            pass: layout.breakpoints.length > 0 && (!context.targetCanvas.responsive.breakpoints.length || layout.breakpoints.length === context.targetCanvas.responsive.breakpoints.length),
          },
          {
            name: "minimum-target-size",
            pass: context.targetCanvas.behaviour.indexOf("interactive") < 0 || (layout.container.width >= layout.interaction.minimum_target_px && layout.container.height >= layout.interaction.minimum_target_px),
          },
          {
            name: "foreground-contrast",
            pass: context.targetCanvas.colour.minimum_contrast_ratio == null || layout.tokens.contrast_ratio >= context.targetCanvas.colour.minimum_contrast_ratio,
          },
          {
            name: "reading-and-keyboard-order",
            pass: layout.interaction.keyboard_order.length === layout.regions.length,
          },
          {
            name: "focus-visible",
            pass: cssText.indexOf(":focus-visible") >= 0,
          },
          {
            name: "overflow-policy",
            pass: layout.interaction.overflow === "auto",
          },
          {
            name: "file-budget",
            pass:
              context.targetCanvas.performance.max_file_bytes == null ||
              total <= context.targetCanvas.performance.max_file_bytes,
          },
        ],
        measures: {
          columns: layout.active.columns,
          regions: layout.regions.length,
          contrastRatio: layout.tokens.contrast_ratio,
          minimumTargetSize: layout.interaction.minimum_target_px,
          totalBytes: total,
        },
        notes: [
          "The CSS is a portable DOM mapping; non-DOM hosts still require explicit adapters.",
        ],
      };
    },
  };
});
