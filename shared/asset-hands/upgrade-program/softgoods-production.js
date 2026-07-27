'use strict';

const U = require('./foundation-utils');

const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const EAN_PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

function ean13(value) {
  let digits = String(value || '').replace(/\s/g, ''); U.ensure(/^\d{12,13}$/.test(digits), 'EAN-13 requires 12 data digits or 13 digits including check digit');
  const data = digits.slice(0, 12).split('').map(Number); const check = (10 - (data.reduce((sum, digit, index) => sum + digit * (index % 2 ? 3 : 1), 0) % 10)) % 10;
  if (digits.length === 13) U.ensure(Number(digits[12]) === check, 'EAN-13 check digit mismatch'); else digits += check;
  const parity = EAN_PARITY[Number(digits[0])]; let bits = '101';
  for (let index = 1; index <= 6; index += 1) bits += (parity[index - 1] === 'L' ? EAN_L : EAN_G)[Number(digits[index])];
  bits += '01010'; for (let index = 7; index <= 12; index += 1) bits += EAN_R[Number(digits[index])]; bits += '101';
  U.ensure(bits.length === 95, 'EAN-13 encoding must contain 95 modules');
  return { digits, check_digit: check, bits, digest: U.sha256(bits) };
}

function barcodeSvg(barcode, moduleWidth, height) {
  moduleWidth = U.finite(moduleWidth || 0.33, 'barcode module width'); height = U.finite(height || 25, 'barcode height');
  const bars = Array.from(barcode.bits).map((bit, index) => bit === '1' ? `<rect x="${(index * moduleWidth).toFixed(3)}" width="${moduleWidth.toFixed(3)}" height="${height}"/>` : '').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(95 * moduleWidth).toFixed(3)} ${height + 5}">${bars}<text x="${(47.5 * moduleWidth).toFixed(3)}" y="${height + 4}" font-size="3" text-anchor="middle">${barcode.digits}</text></svg>`;
}

function createPackaging(spec) {
  spec = U.clone(spec || {});
  const width = U.finite(spec.width_mm, 'packaging width'); const height = U.finite(spec.height_mm, 'packaging height'); const bleed = U.finite(spec.bleed_mm, 'packaging bleed');
  U.ensure(width > 0 && height > 0 && bleed >= 0, 'packaging dimensions invalid');
  const dielines = U.boundedArray(spec.dielines, 1, 10000, 'packaging dielines').map((line) => ({ id: U.text(line.id, 100, 'dieline id'), operation: U.text(line.operation, 20, 'dieline operation'), from: { x: U.finite(line.from.x, 'dieline x1'), y: U.finite(line.from.y, 'dieline y1') }, to: { x: U.finite(line.to.x, 'dieline x2'), y: U.finite(line.to.y, 'dieline y2') }, spot_plate: U.text(line.spot_plate, 80, 'dieline spot plate'), overprint: line.overprint === true }));
  U.ensure(dielines.every((line) => ['cut', 'crease'].includes(line.operation) && line.overprint), 'cut and crease dielines must use explicit overprinting spot plates');
  const plates = U.boundedArray(spec.plates, 1, 20, 'packaging plates').map((plate) => ({ name: U.text(plate.name, 80, 'plate name'), kind: U.text(plate.kind, 20, 'plate kind'), overprint: plate.overprint === true, trap_mm: U.finite(plate.trap_mm || 0, 'plate trap') }));
  const barcode = ean13(spec.ean13); const svg = barcodeSvg(barcode, spec.barcode_module_mm || 0.33, spec.barcode_height_mm || 25);
  const preflight = spec.external_pdfx_receipt;
  const checks = [{ name: 'cut-dieline', pass: dielines.some((item) => item.operation === 'cut') }, { name: 'crease-dieline', pass: dielines.some((item) => item.operation === 'crease') }, { name: 'spot-plates', pass: plates.some((item) => item.kind === 'spot') }, { name: 'overprint', pass: dielines.every((item) => item.overprint) }, { name: 'trapping-explicit', pass: plates.every((item) => item.trap_mm >= 0) }, { name: 'barcode-checksum', pass: barcode.digits.endsWith(String(barcode.check_digit)) }];
  const result = { schema: 'axm.packaging-production/v1', version: '1.0.0', id: U.text(spec.id, 100, 'packaging id'), dimensions: { width_mm: width, height_mm: height, bleed_mm: bleed }, dielines, plates, separations: plates.map((item) => ({ name: item.name, kind: item.kind, overprint: item.overprint, trap_mm: item.trap_mm })), barcode: Object.assign({}, barcode, { svg, svg_digest: U.sha256(svg) }), checks, external_preflight_digest: preflight && preflight.digest || null, status: !checks.every((item) => item.pass) ? 'FAIL' : preflight && preflight.status === 'PASS' ? 'PREFLIGHT_PASS_OPERATOR_REVIEW_REQUIRED' : preflight && preflight.status === 'MISSING_SUBSTRATE' ? 'TECHNICAL_PASS_MISSING_FORMAL_PREFLIGHT' : 'TECHNICAL_PASS_FORMAL_PREFLIGHT_REQUIRED', physical_mockup: 'PENDING' };
  result.digest = U.sha256(result); return result;
}

function createFabric(spec) {
  spec = U.clone(spec || {});
  const repeat = { width_mm: U.finite(spec.repeat.width_mm, 'fabric repeat width'), height_mm: U.finite(spec.repeat.height_mm, 'fabric repeat height') };
  U.ensure(repeat.width_mm > 0 && repeat.height_mm > 0, 'fabric repeat dimensions must be positive');
  const profile = { construction: U.text(spec.profile.construction, 30, 'fabric construction'), grain: U.text(spec.profile.grain, 30, 'fabric grain'), stretch_warp: U.finite(spec.profile.stretch_warp, 'warp stretch'), stretch_weft: U.finite(spec.profile.stretch_weft, 'weft stretch'), shrink_warp: U.finite(spec.profile.shrink_warp, 'warp shrink'), shrink_weft: U.finite(spec.profile.shrink_weft, 'weft shrink') };
  U.ensure(['weave', 'knit'].includes(profile.construction) && [profile.stretch_warp, profile.stretch_weft, profile.shrink_warp, profile.shrink_weft].every((value) => value >= 0 && value < 0.5), 'fabric behaviour profile invalid');
  const colourways = U.boundedArray(spec.colourways, 1, 50, 'fabric colourways').map((item) => ({ id: U.text(item.id, 80, 'colourway id'), colours: U.boundedArray(item.colours, 2, 20, 'colourway colours').map((colour) => U.text(colour, 30, 'colourway colour')) }));
  const productionRepeat = { width_mm: repeat.width_mm / (1 - profile.shrink_weft), height_mm: repeat.height_mm / (1 - profile.shrink_warp) };
  const previews = colourways.map((item) => { const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="scale(${1 + profile.stretch_weft} ${1 + profile.stretch_warp})"><rect width="40" height="40" fill="${item.colours[0]}"/><path d="M0 0L40 40M40 0L0 40" stroke="${item.colours[1]}" stroke-width="${profile.construction === 'knit' ? 5 : 2}"/></pattern></defs><rect width="200" height="200" fill="url(#p)"/></svg>`; return { colourway_id: item.id, svg, digest: U.sha256(svg) }; });
  const garmentMap = U.boundedArray(spec.garment_map || [], 0, 1000, 'fabric garment map').map((item) => ({ piece_id: U.text(item.piece_id, 100, 'garment piece id'), repeat_offset_mm: { x: U.finite(item.repeat_offset_mm.x, 'garment repeat x'), y: U.finite(item.repeat_offset_mm.y, 'garment repeat y') }, grain_angle_degrees: U.finite(item.grain_angle_degrees, 'garment grain angle'), seam_match_group: item.seam_match_group == null ? null : U.text(item.seam_match_group, 80, 'seam match group') }));
  const result = { schema: 'axm.fabric-material-production/v1', version: '1.0.0', id: U.text(spec.id, 100, 'fabric id'), repeat, production_repeat: productionRepeat, profile, colourways, garment_map: garmentMap, previews, status: 'TECHNICAL_PASS_PRINTED_SWATCH_REVIEW_REQUIRED', swatch_review: 'PENDING' };
  result.digest = U.sha256(result); return result;
}

function polygonBounds(points) { return { x: Math.min(...points.map((item) => item.x)), y: Math.min(...points.map((item) => item.y)), width: Math.max(...points.map((item) => item.x)) - Math.min(...points.map((item) => item.x)), height: Math.max(...points.map((item) => item.y)) - Math.min(...points.map((item) => item.y)) }; }
function edgeLength(piece, edge) { const a = piece.points[edge.from]; const b = piece.points[edge.to]; return Math.hypot(b.x - a.x, b.y - a.y); }

function createGarment(spec) {
  spec = U.clone(spec || {}); const materialWidth = U.finite(spec.material_width_mm, 'material width'); const tolerance = U.finite(spec.seam_tolerance_mm || 0.5, 'seam tolerance');
  const basePieces = U.boundedArray(spec.pieces, 1, 1000, 'garment pieces').map((piece) => ({ id: U.text(piece.id, 100, 'garment piece id'), points: U.boundedArray(piece.points, 3, 10000, 'garment piece points').map((point) => ({ x: U.finite(point.x, 'piece x'), y: U.finite(point.y, 'piece y') })), grain_angle_degrees: U.finite(piece.grain_angle_degrees || 0, 'piece grain angle'), seam_allowance_mm: U.finite(piece.seam_allowance_mm, 'seam allowance'), notches: U.clone(piece.notches || []), match_edges: U.clone(piece.match_edges || []) }));
  const sizes = U.boundedArray(spec.sizes, 1, 30, 'garment sizes').map((size) => ({ id: U.text(size.id, 40, 'size id'), dx: U.finite(size.dx || 0, 'grade dx'), dy: U.finite(size.dy || 0, 'grade dy') }));
  const graded = sizes.map((size) => ({ size: size.id, pieces: basePieces.map((piece) => ({ ...U.clone(piece), points: piece.points.map((point, index) => ({ x: point.x + size.dx * (index % 2 ? 1 : -1), y: point.y + size.dy * (index >= piece.points.length / 2 ? 1 : -1) })) })) }));
  const seamChecks = [];
  for (const match of spec.seam_matches || []) { const left = basePieces.find((item) => item.id === match.left.piece_id); const right = basePieces.find((item) => item.id === match.right.piece_id); U.ensure(left && right, 'seam match piece missing'); const leftLength = edgeLength(left, match.left); const rightLength = edgeLength(right, match.right); seamChecks.push({ id: U.text(match.id, 80, 'seam match id'), left_mm: leftLength, right_mm: rightLength, delta_mm: Math.abs(leftLength - rightLength), pass: Math.abs(leftLength - rightLength) <= tolerance }); }
  const markerPieces = graded[0].pieces.map((piece) => ({ piece_id: piece.id, bounds: polygonBounds(piece.points), grain_angle_degrees: piece.grain_angle_degrees })).sort((a, b) => b.bounds.height - a.bounds.height);
  let x = 0; let y = 0; let rowHeight = 0; const placements = [];
  for (const item of markerPieces) { if (item.bounds.width > materialWidth) throw new Error('garment piece exceeds material width: ' + item.piece_id); if (x + item.bounds.width > materialWidth) { x = 0; y += rowHeight; rowHeight = 0; } const repeatHeight = spec.repeat_height_mm ? U.finite(spec.repeat_height_mm, 'garment repeat height') : 0; if (repeatHeight) y = Math.ceil(y / repeatHeight) * repeatHeight; placements.push({ piece_id: item.piece_id, x, y, width: item.bounds.width, height: item.bounds.height, grain_angle_degrees: item.grain_angle_degrees }); x += item.bounds.width; rowHeight = Math.max(rowHeight, item.bounds.height); }
  const overlaps = placements.some((a, index) => placements.slice(index + 1).some((b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y));
  const checks = [{ name: 'matched-seams', pass: seamChecks.every((item) => item.pass) }, { name: 'seam-allowances', pass: basePieces.every((item) => item.seam_allowance_mm > 0) }, { name: 'notches', pass: basePieces.every((item) => item.notches.length > 0) }, { name: 'grain', pass: placements.every((item) => Math.abs(item.grain_angle_degrees) <= (spec.maximum_grain_deviation_degrees || 2)) }, { name: 'marker-no-overlap', pass: !overlaps }, { name: 'material-width', pass: placements.every((item) => item.x + item.width <= materialWidth) }];
  const result = { schema: 'axm.garment-pattern-production/v1', version: '1.0.0', id: U.text(spec.id, 100, 'garment id'), base_pieces: basePieces, graded, seam_checks: seamChecks, marker: { material_width_mm: materialWidth, repeat_height_mm: spec.repeat_height_mm || null, placements, length_mm: y + rowHeight }, checks, status: checks.every((item) => item.pass) ? 'TECHNICAL_PASS_PATTERN_MAKER_REVIEW_REQUIRED' : 'FAIL', pattern_maker_review: 'PENDING' };
  result.digest = U.sha256(result); return result;
}

function balanced(value) { const results = []; for (let a = -1; a <= 1; a += 1) for (let b = -1; b <= 1; b += 1) for (let c = -1; c <= 1; c += 1) for (let d = -1; d <= 1; d += 1) for (let e = -1; e <= 1; e += 1) if (a * 81 + b * 27 + c * 9 + d * 3 + e === value) return [a,b,c,d,e]; return results; }
function encodeDelta(dx, dy, jump) {
  U.ensure(Number.isInteger(dx) && Number.isInteger(dy) && Math.abs(dx) <= 121 && Math.abs(dy) <= 121, 'DST delta outside -121..121'); const x = balanced(dx); const y = balanced(dy); U.ensure(x.length && y.length, 'DST delta cannot be encoded'); const bytes = [0, 0, jump ? 0x83 : 0x03];
  const xPos = [[2,2],[1,2],[0,2],[1,0],[0,0]], xNeg = [[2,3],[1,3],[0,3],[1,1],[0,1]], yPos = [[2,5],[1,5],[0,5],[1,7],[0,7]], yNeg = [[2,4],[1,4],[0,4],[1,6],[0,6]];
  x.forEach((digit, index) => { if (digit) { const bit = digit > 0 ? xPos[index] : xNeg[index]; bytes[bit[0]] |= 1 << bit[1]; } }); y.forEach((digit, index) => { if (digit) { const bit = digit > 0 ? yPos[index] : yNeg[index]; bytes[bit[0]] |= 1 << bit[1]; } }); return Buffer.from(bytes);
}

function createEmbroidery(spec) {
  spec = U.clone(spec || {}); const maxStitch = U.finite(spec.max_stitch_mm || 4, 'maximum stitch length'); const paths = U.boundedArray(spec.paths, 1, 10000, 'embroidery paths'); const stitches = []; const pathProfiles = []; let colour = null;
  for (const path of paths) { const pathColour = U.text(path.thread, 80, 'embroidery thread'); const density = U.finite(path.density_stitches_per_mm, 'embroidery density'); U.ensure(density > 0 && density <= 20, 'embroidery density outside 0..20 stitches/mm'); const pull = U.finite(path.pull_compensation_mm || 0, 'pull compensation'); pathProfiles.push({ thread: pathColour, density_stitches_per_mm: density, pull_compensation_mm: pull }); if (colour != null && colour !== pathColour) stitches.push({ command: 'colour-change' }); colour = pathColour; const points = U.boundedArray(path.points, 2, 100000, 'embroidery path points').map((point) => ({ x: U.finite(point.x, 'stitch x') + (pull * Math.sign(point.x || 1)), y: U.finite(point.y, 'stitch y') })); stitches.push({ command: 'move', x: points[0].x, y: points[0].y, thread: pathColour }); for (let index = 1; index < points.length; index += 1) { const a = points[index - 1]; const b = points[index]; const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.min(maxStitch, 1 / density))); for (let step = 1; step <= count; step += 1) stitches.push({ command: 'stitch', x: a.x + (b.x - a.x) * step / count, y: a.y + (b.y - a.y) * step / count, thread: pathColour }); } }
  let currentX = 0; let currentY = 0; let minX = 0; let maxX = 0; let minY = 0; let maxY = 0; const commands = [];
  for (const stitch of stitches) { if (stitch.command === 'colour-change') { commands.push(Buffer.from([0,0,0xc3])); continue; } const targetX = Math.round(stitch.x * 10); const targetY = Math.round(stitch.y * 10); let dx = targetX - currentX; let dy = targetY - currentY; while (dx || dy) { const stepX = Math.max(-121, Math.min(121, dx)); const stepY = Math.max(-121, Math.min(121, dy)); commands.push(encodeDelta(stepX, stepY, stitch.command === 'move')); currentX += stepX; currentY += stepY; minX = Math.min(minX, currentX); maxX = Math.max(maxX, currentX); minY = Math.min(minY, currentY); maxY = Math.max(maxY, currentY); dx = targetX - currentX; dy = targetY - currentY; } }
  commands.push(Buffer.from([0,0,0xf3])); const name = U.text(spec.name, 16, 'DST design name').padEnd(16, ' '); const headerText = `LA:${name}\rST:${String(commands.length).padStart(7,' ')}\rCO:${String(new Set(paths.map((item) => item.thread)).size).padStart(3,' ')}\r+X:${String(maxX).padStart(5,' ')}\r-X:${String(-minX).padStart(5,' ')}\r+Y:${String(maxY).padStart(5,' ')}\r-Y:${String(-minY).padStart(5,' ')}\rAX:+00000\rAY:+00000\rMX:+00000\rMY:+00000\rPD:******\r`;
  const header = Buffer.alloc(512, 0x20); Buffer.from(headerText, 'ascii').copy(header, 0, 0, Math.min(511, Buffer.byteLength(headerText))); header[511] = 0x1a; const dst = Buffer.concat([header].concat(commands));
  const checks = [{ name: 'DST-header', pass: dst.length >= 515 && dst[511] === 0x1a }, { name: 'DST-end', pass: dst.subarray(-3).equals(Buffer.from([0,0,0xf3])) }, { name: 'stitch-count-bounded', pass: commands.length <= (spec.machine_limits && spec.machine_limits.max_stitches || 1000000) }, { name: 'colour-count-bounded', pass: new Set(paths.map((item) => item.thread)).size <= (spec.machine_limits && spec.machine_limits.max_colours || 16) }];
  const result = { schema: 'axm.embroidery-production/v1', version: '1.0.0', name: name.trim(), stitch_plan: stitches, path_profiles: pathProfiles, thread_map: Array.from(new Set(paths.map((item) => item.thread))), dst_base64: dst.toString('base64'), dst_digest: U.sha256(dst), dst_bytes: dst.length, bounds_tenths_mm: { min_x: minX, max_x: maxX, min_y: minY, max_y: maxY }, checks, status: checks.every((item) => item.pass) ? 'TECHNICAL_PASS_INDEPENDENT_MACHINE_VALIDATION_REQUIRED' : 'FAIL', machine_validation: 'PENDING', test_stitch: 'PENDING' };
  result.digest = U.sha256(result); return result;
}

module.exports = { ean13, barcodeSvg, createPackaging, createFabric, createGarment, createEmbroidery, encodeDelta };
