#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { SVGPathData } = require('svg-pathdata');
const U = require('./foundation-utils');
const F = require('./foundation-index');

// #24: executable finite-state prototype with real-input authority boundary.
const prototypeCanvasDigest = U.sha256('prototype-canvas');
const prototype = F.interactivePrototype.create({
  id: 'checkout-prototype', title: 'Checkout prototype', target_canvas: { medium: 'ui', behaviour: ['interactive', 'responsive'] }, target_canvas_digest: prototypeCanvasDigest, initial_state: 'cart',
  states: [{ id: 'cart', title: 'Cart', document: { nodes: ['checkout'] } }, { id: 'payment', title: 'Payment', document: { nodes: ['card'] } }, { id: 'complete', title: 'Complete', document: { nodes: ['receipt'] } }],
  transitions: [{ id: 'checkout', from: 'cart', to: 'payment', input: 'activate-checkout' }, { id: 'pay', from: 'payment', to: 'complete', input: 'submit-payment' }],
  input_map: { 'activate-checkout': { key: 'Enter' }, 'submit-payment': { key: 'Enter' } }, design_tokens: { schema: F.dtcgTokens.DOCUMENT_SCHEMA },
});
assert.ok(prototype.html.includes('window.AXMPrototype'));
const prototypeRun = F.interactivePrototype.run(prototype, [{ input: 'activate-checkout' }, { input: 'submit-payment' }], { source: { kind: 'live-browser', fresh_session: true, driver_receipt_digest: U.sha256('driver') }, accessibility_receipt: { status: 'PASS', target_canvas_digest: prototypeCanvasDigest, digest: U.sha256('a11y') } });
assert.equal(prototypeRun.status, 'PASS');
assert.equal(prototypeRun.final_state, 'complete');
assert.equal(F.interactivePrototype.run(prototype, [{ input: 'activate-checkout' }], { source: { kind: 'fixture', fresh_session: false }, accessibility_receipt: { status: 'PASS', target_canvas_digest: prototypeCanvasDigest } }).status, 'TEST_ONLY');
assert.equal(F.interactivePrototype.run(prototype, [{ input: 'unknown-input' }], {}).status, 'FAIL');

// #25-27: actual layered bitmap project, pressure stroke replay and region-bounded retouch.
const rasterWidth = 16; const rasterHeight = 16; const basePixels = Buffer.alloc(rasterWidth * rasterHeight * 4);
for (let y = 0; y < rasterHeight; y += 1) for (let x = 0; x < rasterWidth; x += 1) { const index = (y * rasterWidth + x) * 4; basePixels[index] = x * 12; basePixels[index + 1] = y * 12; basePixels[index + 2] = 40; basePixels[index + 3] = 255; }
const rasterDocument = F.rasterDocument.create({ id: 'layered-raster', width: rasterWidth, height: rasterHeight, colour_space: 'srgb', layers: [{ id: 'base', name: 'Base pixels', kind: 'pixels', rgba8: basePixels, blend_mode: 'normal', opacity: 1 }, { id: 'brightness', name: 'Brightness', kind: 'adjustment', adjustments: [{ type: 'brightness', value: 0.05 }], blend_mode: 'normal', opacity: 1 }] });
const baseRender = F.rasterDocument.render(rasterDocument);
assert.equal(baseRender.png.inspection.pass, true);
assert.equal(baseRender.rgba8.length, rasterWidth * rasterHeight * 4);
const stroked = F.rasterDocument.stroke(rasterDocument, { layer_id: 'ink', layer_name: 'Pressure ink', samples: [{ x: 2, y: 3, pressure: 0.15, time_ms: 0 }, { x: 8, y: 8, pressure: 0.6, time_ms: 10 }, { x: 14, y: 12, pressure: 1, time_ms: 20 }], stabilization: 2, colour_rgba: [10, 10, 10, 255], base_radius: 3, tip: 'circle', texture_seed: 'paper-grain' });
assert.equal(stroked.receipt.status, 'PASS');
assert.deepEqual(stroked.receipt.pressure_range, [0.15, 1]);
assert.equal(stroked.document.layers.length, 3);
const savedRaster = F.rasterDocument.save(stroked.document); const reloadedRaster = F.rasterDocument.load(savedRaster.text);
assert.equal(F.rasterDocument.render(reloadedRaster).pixel_digest, F.rasterDocument.render(stroked.document).pixel_digest);
const retouched = F.rasterDocument.retouch(stroked.document, { layer_id: 'base', operation: 'clone', region: { x: 6, y: 6, width: 5, height: 5 }, source_offset: { x: -4, y: -4 } });
assert.equal(retouched.receipt.status, 'PASS');
assert.equal(retouched.receipt.outside_changed_pixels, 0);
assert.ok(retouched.receipt.inside_changed_pixels > 0);
assert.notEqual(retouched.receipt.before_digest, retouched.receipt.after_digest);

// #28: finite cubic geometry, exact split continuity, open-path join, offsets and rectangle booleans.
const curve = F.vectorEngine.createPath({ id: 'curve', intentionally_open: true, commands: [{ type: 'M', to: { x: 0, y: 0 } }, { type: 'C', c1: { x: 0, y: 100 }, c2: { x: 100, y: 100 }, to: { x: 100, y: 0 } }] });
assert.equal(curve.bounds.height, 75);
const split = F.vectorEngine.splitCubic({ p0: { x: 0, y: 0 }, p1: { x: 0, y: 100 }, p2: { x: 100, y: 100 }, p3: { x: 100, y: 0 } }, 0.5);
assert.deepEqual(split.left.p3, split.right.p0);
const lineA = F.vectorEngine.createPath({ id: 'line-a', intentionally_open: true, commands: [{ type: 'M', to: { x: 0, y: 0 } }, { type: 'L', to: { x: 10, y: 0 } }] });
const lineB = F.vectorEngine.createPath({ id: 'line-b', intentionally_open: true, commands: [{ type: 'M', to: { x: 10, y: 0 } }, { type: 'L', to: { x: 20, y: 10 } }] });
const joined = F.vectorEngine.join(lineA, lineB, 'joined', 1e-6);
assert.equal(joined.commands.length, 3);
const offset = F.vectorEngine.offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 2, 'offset', false);
assert.ok(offset.commands.every((item) => item.type === 'M' || item.type === 'L'));
const union = F.vectorEngine.booleanRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 0, width: 10, height: 10 }, 'union', 'rect-union');
assert.equal(union.regions.reduce((sum, item) => sum + item.width * item.height, 0), 150);
union.paths.forEach((item) => assert.doesNotThrow(() => new SVGPathData(F.vectorEngine.pathData(item)).commands));

// #29: variable-stroke outline and gradients are real SVG; unsupported blends receive exact losses.
const appearance = F.vectorEngine.appearanceSvg({ width: 128, height: 64, stroke: { points: [{ x: 5, y: 32 }, { x: 64, y: 20 }, { x: 123, y: 32 }], widths: [2, 18, 4] }, gradient: { stops: [{ offset: 0, colour: '#ff0000' }, { offset: 1, colour: '#0000ff' }] }, blend_mode: 'multiply', host_capabilities: ['css-mix-blend-mode'], renderer_matrix: { status: 'PASS', digest: U.sha256('vector-render-matrix') } });
assert.equal(appearance.receipt.status, 'PASS');
assert.ok(appearance.svg.includes('<linearGradient'));
assert.ok(appearance.svg.includes('<polygon'));
const lossyAppearance = F.vectorEngine.appearanceSvg({ width: 128, height: 64, stroke: { points: [{ x: 5, y: 32 }, { x: 123, y: 32 }], widths: [2, 8] }, gradient: { stops: [{ offset: 0, colour: '#fff' }, { offset: 1, colour: '#000' }] }, blend_mode: 'screen', host_capabilities: [], renderer_matrix: { status: 'PASS', digest: U.sha256('vector-render-matrix') } });
assert.equal(lossyAppearance.receipt.status, 'DECLARED_LOSS');
assert.equal(lossyAppearance.receipt.exact_loss_map[0].feature, 'mix-blend-mode:screen');

// #30: paragraph layout consumes HarfBuzz/subset evidence and retains logical order for bidi text.
const paragraphText = 'Hello modular hands';
const shapingReceipt = { status: 'PASS', engine: 'HarfBuzz 10', cluster_advances: Array.from(paragraphText).map(() => 6), missing_glyphs: [], digest: U.sha256('hb') };
const subsetReceipt = { status: 'PASS', codepoints: Array.from(new Set(Array.from(paragraphText).filter((character) => !/\s/.test(character)).map((character) => character.codePointAt(0)))), digest: U.sha256('subset') };
const paragraph = F.typographyStory.layoutParagraph({ id: 'paragraph', text: paragraphText, width: 72, font_size: 10, line_height: 14, locale: 'en', direction: 'ltr', shaping_receipt: shapingReceipt, subset_receipt: subsetReceipt, variable_axes: { wght: 550 } });
assert.equal(paragraph.status, 'PASS');
assert.ok(paragraph.lines.length >= 2);
assert.ok(paragraph.lines.every((line) => line.advance <= paragraph.width));
const arabic = F.typographyStory.layoutParagraph({ id: 'arabic', text: 'مرحبا', width: 100, font_size: 12, line_height: 16, locale: 'ar', direction: 'auto', shaping_receipt: { status: 'PASS', engine: 'HarfBuzz', cluster_advances: [8,8,8,8,8], missing_glyphs: [], digest: U.sha256('hb-ar') }, subset_receipt: { status: 'PASS', codepoints: Array.from('مرحبا').map((character) => character.codePointAt(0)), digest: U.sha256('sub-ar') } });
assert.equal(arabic.direction, 'rtl');
assert.equal(arabic.logical_text_digest, U.sha256('مرحبا'));
assert.ok(F.typographyStory.textPathSvg(paragraph, 'M 0 50 C 40 0 80 100 120 50', 128, 100).includes('<textPath'));

// #31: multi-page story retains each logical block once, tables/footnotes and booklet imposition.
const story = F.typographyStory.createStory({ id: 'manual', page: { width: 210, height: 297, margin_top: 20, margin_right: 20, margin_bottom: 20, margin_left: 20, unit: 'mm' }, master: { header: 'AXM Manual' }, imposition: 'booklet', blocks: [{ id: 'intro', kind: 'paragraph', height: 100, content: { text: 'Introduction' }, keep_with_next: true }, { id: 'table', kind: 'table', height: 120, content: { text: 'Capability table' }, footnotes: [{ id: 'note-1', height: 20, text: 'Evidence note' }] }, { id: 'end', kind: 'paragraph', height: 80, content: { text: 'Conclusion' } }], accessibility_validator_receipt: { status: 'MISSING_SUBSTRATE', digest: U.sha256('missing-verapdf') } });
assert.equal(story.reading_order.join(','), 'intro,table,end');
assert.ok(story.pages.length >= 2);
assert.equal(story.structures.tables[0], 'table');
assert.equal(story.structures.footnotes[0], 'note-1');
assert.equal(story.imposition.padded_pages % 4, 0);
assert.match(story.status, /MISSING_EXTERNAL_ACCESSIBILITY_VALIDATOR/);

// #32: packaging includes overprinting dielines, separations, trapping and a checksum-valid real EAN-13 module pattern.
const packaging = F.softgoodsProduction.createPackaging({ id: 'box', width_mm: 200, height_mm: 150, bleed_mm: 3, dielines: [{ id: 'cut-top', operation: 'cut', from: { x: 0, y: 0 }, to: { x: 200, y: 0 }, spot_plate: 'CutContour', overprint: true }, { id: 'crease-mid', operation: 'crease', from: { x: 0, y: 75 }, to: { x: 200, y: 75 }, spot_plate: 'Crease', overprint: true }], plates: [{ name: 'Process Black', kind: 'process', overprint: false, trap_mm: 0.1 }, { name: 'CutContour', kind: 'spot', overprint: true, trap_mm: 0 }], ean13: '400638133393', barcode_module_mm: 0.33, barcode_height_mm: 25, external_pdfx_receipt: { status: 'MISSING_SUBSTRATE', digest: U.sha256('missing-pdfx') } });
assert.equal(packaging.barcode.bits.length, 95);
assert.equal(packaging.barcode.digits, '4006381333931');
assert.ok(packaging.barcode.svg.includes('<rect'));
assert.match(packaging.status, /MISSING_FORMAL_PREFLIGHT/);

// #33: shrink/stretch and construction alter production repeat and material previews.
const fabric = F.softgoodsProduction.createFabric({ id: 'woven-repeat', repeat: { width_mm: 100, height_mm: 80 }, profile: { construction: 'weave', grain: 'warp', stretch_warp: 0.02, stretch_weft: 0.08, shrink_warp: 0.04, shrink_weft: 0.03 }, colourways: [{ id: 'day', colours: ['#ffffff', '#2244aa'] }, { id: 'night', colours: ['#111111', '#88aaff'] }], garment_map: [{ piece_id: 'front', repeat_offset_mm: { x: 0, y: 0 }, grain_angle_degrees: 0, seam_match_group: 'side-seam' }] });
assert.ok(fabric.production_repeat.width_mm > fabric.repeat.width_mm);
assert.ok(fabric.production_repeat.height_mm > fabric.repeat.height_mm);
assert.notEqual(fabric.previews[0].digest, fabric.previews[1].digest);
assert.match(fabric.status, /SWATCH_REVIEW_REQUIRED/);

// #34: pattern grading, seam matching, notches, grain and conservative marker placement.
const garment = F.softgoodsProduction.createGarment({ id: 'shirt', material_width_mm: 300, repeat_height_mm: 20, seam_tolerance_mm: 0.1, maximum_grain_deviation_degrees: 2, sizes: [{ id: 'M', dx: 0, dy: 0 }, { id: 'L', dx: 5, dy: 8 }], pieces: [{ id: 'front', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 150 }, { x: 0, y: 150 }], grain_angle_degrees: 0, seam_allowance_mm: 10, notches: [{ edge: 1, t: 0.5 }] }, { id: 'back', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 150 }, { x: 0, y: 150 }], grain_angle_degrees: 0, seam_allowance_mm: 10, notches: [{ edge: 3, t: 0.5 }] }], seam_matches: [{ id: 'side', left: { piece_id: 'front', from: 1, to: 2 }, right: { piece_id: 'back', from: 3, to: 0 } }] });
assert.match(garment.status, /TECHNICAL_PASS/);
assert.equal(garment.seam_checks[0].pass, true);
assert.equal(garment.checks.find((item) => item.name === 'marker-no-overlap').pass, true);
assert.equal(garment.graded.length, 2);

// #35: bounded stitch plan becomes actual Tajima DST bytes, never a relabelled SVG.
const embroidery = F.softgoodsProduction.createEmbroidery({ name: 'AXM-HANDS', max_stitch_mm: 4, paths: [{ thread: 'red-40wt', density_stitches_per_mm: 1.2, pull_compensation_mm: 0.2, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }] }, { thread: 'blue-40wt', density_stitches_per_mm: 1, pull_compensation_mm: 0.1, points: [{ x: 20, y: 20 }, { x: 0, y: 20 }] }], machine_limits: { max_stitches: 10000, max_colours: 4 } });
const dst = Buffer.from(embroidery.dst_base64, 'base64');
assert.equal(dst[511], 0x1a);
assert.deepEqual(Array.from(dst.subarray(-3)), [0, 0, 0xf3]);
assert.ok(embroidery.stitch_plan.some((item) => item.command === 'colour-change'));
assert.match(embroidery.status, /INDEPENDENT_MACHINE_VALIDATION_REQUIRED/);

// #36: no mesh is relabelled B-rep/STEP when the CAD kernel is absent.
const sketch = F.manufacturing.createSketch({ id: 'rectangle-sketch', unit: 'mm', tolerance: 1e-6, points: [{ id: 'a', x: 0, y: 0, fixed: true }, { id: 'b', x: 40, y: 0 }, { id: 'c', x: 40, y: 20 }, { id: 'd', x: 0, y: 20 }], constraints: [{ type: 'fixed', points: ['a'] }, { type: 'horizontal', points: ['a', 'b'] }, { type: 'vertical', points: ['b', 'c'] }, { type: 'horizontal', points: ['c', 'd'] }, { type: 'vertical', points: ['d', 'a'] }, { type: 'distance', points: ['a', 'b'], value: 40 }] });
assert.equal(sketch.status, 'CONSTRAINED');
const cadMissing = F.manufacturing.buildCad({ sketch, features: [{ type: 'extrude', depth_mm: 10 }], runtime_resolution: { status: 'MISSING' } });
assert.equal(cadMissing.status, 'MISSING_SUBSTRATE');
assert.equal(cadMissing.step, null);
assert.equal(cadMissing.brep, null);

// #37: bend allowance and flat pattern are explicit math, with B-rep/refold evidence still required.
const sheet = F.manufacturing.developSheetMetal({ thickness_mm: 1.5, inside_radius_mm: 2, bend_angle_degrees: 90, k_factor: 0.42, leg_a_mm: 50, leg_b_mm: 40, width_mm: 100, relief: { kind: 'rectangular', width_mm: 3 }, tolerance_mm: 0.1, cad_receipt: cadMissing });
assert.equal(sheet.status, 'MISSING_BREP_SUBSTRATE');
assert.ok(sheet.bend.allowance_mm > 0);
assert.ok(sheet.flat_pattern.length_mm < 90);

// #38: genuine OPC/3MF package contains model, materials, vertices, triangles and build object.
const threeMf = F.manufacturing.create3mf({ id: 'tetra', title: 'Tetrahedron', unit: 'millimeter', vertices: [[0,0,0],[10,0,0],[0,10,0],[0,0,10]], triangles: [[0,2,1],[0,1,3],[1,2,3],[2,0,3]], materials: [{ name: 'Red', displaycolor: '#ff0000ff' }], external_conformance_receipt: { status: 'MISSING_SUBSTRATE', digest: U.sha256('missing-3mf-validator') } });
const threeMfBytes = Buffer.from(threeMf.package_base64, 'base64');
assert.equal(threeMfBytes.subarray(0, 2).toString('ascii'), 'PK');
assert.equal(threeMf.checks.every((item) => item.pass), true);
assert.match(threeMf.status, /MISSING_OFFICIAL_CONFORMANCE/);

// #39: machine-bound CAM remains a candidate until a digest-bound human dry-run approval.
const machine = F.manufacturing.createMachineProfile({ id: 'router-1', machine: 'Workshop Router', controller: 'GRBL', units: 'mm', travel: { x: 500, y: 400, z: 80 }, limits: { max_feed: 3000, max_spindle_rpm: 24000 }, tools: [{ id: '1', diameter_mm: 6, max_depth_mm: 30 }], post: { id: 'grbl-safe', version: '1.0.0', digest: U.sha256('post') } });
const simulation = { status: 'PASS', profile_digest: machine.digest, digest: U.sha256('simulation') };
const cam = F.manufacturing.createCamCandidate(machine, { stock: { width_mm: 200, height_mm: 100, depth_mm: 20 }, fixtures: [{ x: 180, y: 80, width: 15, height: 15, top_z: 0, bottom_z: -20 }], moves: [{ kind: 'rapid', x: 10, y: 10, z: 0, tool_id: '1' }, { kind: 'cut', x: 100, y: 50, z: -5, feed: 1200, tool_id: '1' }], simulation_receipt: simulation });
assert.equal(cam.status, 'CANDIDATE_AWAITING_OPERATOR_APPROVAL');
assert.equal(cam.machine_ready, false);
assert.throws(() => F.manufacturing.approveCam(cam, { reviewer: { id: 'robot', kind: 'machine' }, action: 'approve-bounded-dry-run', candidate_digest: cam.digest, profile_digest: machine.digest }), /human seat/);
const approvedCam = F.manufacturing.approveCam(cam, { id: 'operator-approval-1', reviewer: { id: 'mike', kind: 'human' }, action: 'approve-bounded-dry-run', candidate_digest: cam.digest, profile_digest: machine.digest, approved_at: '2026-07-19T20:00:00Z', expires_at: '2026-07-20T20:00:00Z' });
assert.equal(approvedCam.status, 'APPROVED_FOR_BOUNDED_DRY_RUN');
assert.equal(approvedCam.machine_ready, false);
assert.equal(approvedCam.operator_approval.scope, 'bounded-dry-run-only');

console.log('Asset Hands upgrade wave 3 PASS (16 creation-depth upgrades; real artifacts and honest external gates verified)');
