(function (root, factory) {
  var node = typeof module === "object" && module.exports,
    JsPDF = node ? require("jspdf").jsPDF : root.jspdf && root.jspdf.jsPDF;
  var api = factory(JsPDF);
  if (node) module.exports = api;
  if (root) root.AXMPdfCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (jsPDF) {
  "use strict";
  var VERSION = "1.0.0";
  function bytesToBase64(bytes) {
    if (typeof Buffer !== "undefined")
      return Buffer.from(bytes).toString("base64");
    var binary = "",
      step = 32768;
    for (var i = 0; i < bytes.length; i += step)
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(bytes.length, i + step)),
      );
    return btoa(binary);
  }
  function deterministicId(value) {
    var source = String(value),
      parts = [];
    for (var seed = 0; seed < 4; seed++) {
      var hash = (2166136261 ^ seed) >>> 0;
      for (var i = 0; i < source.length; i++) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      parts.push((hash >>> 0).toString(16).padStart(8, "0"));
    }
    return parts.join("").toUpperCase();
  }
  function ascii(bytes) {
    var out = "",
      step = 32768;
    for (var i = 0; i < bytes.length; i += step)
      out += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(bytes.length, i + step)),
      );
    return out;
  }
  function inspect(bytes) {
    var text = ascii(bytes),
      errors = [];
    if (text.slice(0, 5) !== "%PDF-") errors.push("PDF header missing");
    if (text.indexOf("%%EOF") < 0) errors.push("PDF EOF marker missing");
    if (!/\/(?:MediaBox)\s*\[/.test(text)) errors.push("PDF MediaBox missing");
    if (
      !/(?:^|\s)[0-9.]+\s+[0-9.]+\s+[0-9.]+\s+[0-9.]+\s+[kK](?:\s|$)/m.test(
        text,
      )
    )
      errors.push("DeviceCMYK paint operators missing");
    return {
      pass: !errors.length,
      errors: errors,
      bytes: bytes.length,
      header: text.slice(0, 8),
      deviceCmyk: /[0-9.]\s+[0-9.]\s+[0-9.]\s+[0-9.]\s+[kK]/.test(text),
      hasEof: text.indexOf("%%EOF") >= 0,
    };
  }
  function bounded(value, min, max, name, fallback) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) parsed = fallback;
    if (!Number.isFinite(parsed) || parsed < min || parsed > max)
      throw new Error(name + " must be between " + min + " and " + max);
    return parsed;
  }
  function hexToCmyk(value, fallback) {
    var match = /^#([0-9a-f]{6})$/i.exec(String(value || ""));
    if (!match) return fallback;
    var rgb = parseInt(match[1], 16),
      r = ((rgb >>> 16) & 255) / 255,
      g = ((rgb >>> 8) & 255) / 255,
      b = (rgb & 255) / 255,
      k = 1 - Math.max(r, g, b);
    if (k > 0.999) return ["0", "0", "0", "1"];
    return [
      ((1 - r - k) / (1 - k)).toFixed(4),
      ((1 - g - k) / (1 - k)).toFixed(4),
      ((1 - b - k) / (1 - k)).toFixed(4),
      k.toFixed(4),
    ];
  }
  function encodePrintDocument(input) {
    if (!jsPDF) throw new Error("jsPDF 4.2.1 is unavailable");
    input = input || {};
    var width = bounded(input.widthMm, 10, 2000, "print width", 210),
      height = bounded(input.heightMm, 10, 2000, "print height", 297),
      bleed = bounded(input.bleedMm, 0, 50, "print bleed", 0),
      minimumStroke = bounded(
        input.minimumStrokeMm,
        0.05,
        20,
        "minimum stroke",
        0.25,
      ),
      safeMargin = bounded(
        input.safeMarginMm,
        0,
        Math.min(width, height) * 0.4,
        "safe margin",
        Math.min(width, height) * 0.06,
      ),
      cropMarks = input.cropMarks !== false,
      registrationMarks = input.registrationMarks === true,
      elements = Array.isArray(input.elements)
        ? input.elements.slice(0, 100)
        : [],
      titleElement = elements.find(function (element) {
        return element && element.kind === "title";
      }),
      bodyElement = elements.find(function (element) {
        return element && element.kind === "body";
      }),
      accentElement = elements.find(function (element) {
        return element && element.kind === "accent-geometry";
      }),
      title = String(
        (titleElement && titleElement.text) ||
          input.title ||
          "AXM Print Document",
      ).slice(0, 160),
      purpose = String(
        (bodyElement && bodyElement.text) ||
          input.purpose ||
          "Target-canvas print asset",
      ).slice(0, 500),
      palette =
        accentElement && Array.isArray(accentElement.palette)
          ? accentElement.palette
          : [],
      accentA = hexToCmyk(palette[1], ["0.00", "0.24", "0.72", "0.00"]),
      accentB = hexToCmyk(palette[2], ["0.72", "0.00", "0.20", "0.00"]),
      pageWidth = width + bleed * 2,
      pageHeight = height + bleed * 2,
      doc = new jsPDF({
        unit: "mm",
        format: [pageWidth, pageHeight],
        orientation: pageWidth > pageHeight ? "landscape" : "portrait",
        compress: false,
        putOnlyUsedFonts: true,
        precision: 4,
      });
    doc.setCreationDate(new Date("2000-01-01T00:00:00.000Z"));
    doc.setFileId(
      deterministicId(
        [
          title,
          purpose,
          width,
          height,
          bleed,
          minimumStroke,
          safeMargin,
          cropMarks,
          registrationMarks,
          palette,
        ].join("|"),
      ),
    );
    doc.setProperties({
      title: title,
      subject: "AXM target-canvas print document",
      creator: "AXM Production Print Hand",
      keywords: "AXM, print, target canvas, CMYK",
    });
    doc.setFillColor("0.88", "0.42", "0.00", "0.08");
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFillColor("0.12", "0.03", "0.00", "0.88");
    doc.roundedRect(
      bleed + safeMargin,
      bleed + safeMargin,
      width - safeMargin * 2,
      height - safeMargin * 2,
      Math.min(8, width * 0.025),
      Math.min(8, width * 0.025),
      "F",
    );
    doc.setDrawColor("0.72", "0.12", "0.00", "0.05");
    doc.setLineWidth(minimumStroke);
    doc.line(
      bleed + safeMargin,
      bleed + height * 0.27,
      bleed + width - safeMargin,
      bleed + height * 0.27,
    );
    doc.setTextColor("0.00", "0.00", "0.00", "0.00");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(16, Math.min(52, width * 0.12)));
    doc.text(title, bleed + safeMargin, bleed + height * 0.2, {
      maxWidth: width - safeMargin * 2,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(8, Math.min(18, width * 0.035)));
    var lines = doc.splitTextToSize(purpose, width - safeMargin * 2);
    doc.text(lines.slice(0, 8), bleed + safeMargin, bleed + height * 0.36);
    doc.setFillColor.apply(doc, accentA);
    doc.circle(
      bleed + width * 0.78,
      bleed + height * 0.73,
      Math.min(width, height) * 0.075,
      "F",
    );
    doc.setFillColor.apply(doc, accentB);
    doc.circle(
      bleed + width * 0.66,
      bleed + height * 0.73,
      Math.min(width, height) * 0.052,
      "F",
    );
    if (bleed > 0 && cropMarks) {
      doc.setDrawColor("0", "0", "0", "1");
      doc.setLineWidth(0.1);
      var mark = Math.min(5, Math.max(2, bleed * 0.8)),
        x0 = bleed,
        y0 = bleed,
        x1 = bleed + width,
        y1 = bleed + height;
      [
        [x0 - mark, y0, x0 - 0.4, y0],
        [x0, y0 - mark, x0, y0 - 0.4],
        [x1 + 0.4, y0, x1 + mark, y0],
        [x1, y0 - mark, x1, y0 - 0.4],
        [x0 - mark, y1, x0 - 0.4, y1],
        [x0, y1 + 0.4, x0, y1 + mark],
        [x1 + 0.4, y1, x1 + mark, y1],
        [x1, y1 + 0.4, x1, y1 + mark],
      ].forEach(function (m) {
        doc.line(m[0], m[1], m[2], m[3]);
      });
    }
    if (bleed > 0 && registrationMarks) {
      doc.setDrawColor("1", "0", "0", "0");
      doc.setLineWidth(0.1);
      [
        [pageWidth / 2, bleed / 2],
        [pageWidth / 2, pageHeight - bleed / 2],
        [bleed / 2, pageHeight / 2],
        [pageWidth - bleed / 2, pageHeight / 2],
      ].forEach(function (point) {
        doc.circle(point[0], point[1], Math.min(1, bleed * 0.22), "S");
        doc.line(
          point[0] - Math.min(1.5, bleed * 0.3),
          point[1],
          point[0] + Math.min(1.5, bleed * 0.3),
          point[1],
        );
        doc.line(
          point[0],
          point[1] - Math.min(1.5, bleed * 0.3),
          point[0],
          point[1] + Math.min(1.5, bleed * 0.3),
        );
      });
    }
    var bytes = new Uint8Array(doc.output("arraybuffer")),
      inspection = inspect(bytes);
    if (!inspection.pass)
      throw new Error(
        "PDF structural validation failed: " + inspection.errors.join(", "),
      );
    return {
      mime: "application/pdf",
      format: "PDF",
      widthMm: width,
      heightMm: height,
      bleedMm: bleed,
      safeMarginMm: safeMargin,
      cropMarks: cropMarks,
      registrationMarks: registrationMarks,
      renderedContent: {
        title: title,
        purpose: purpose,
        accentPalette: palette.slice(0, 8),
      },
      pageWidthMm: pageWidth,
      pageHeightMm: pageHeight,
      byteLength: bytes.length,
      dataUrl: "data:application/pdf;base64," + bytesToBase64(bytes),
      bytes: bytes,
      inspection: inspection,
    };
  }
  return {
    VERSION: VERSION,
    available: !!jsPDF,
    encodePrintDocument: encodePrintDocument,
    inspect: inspect,
  };
});
