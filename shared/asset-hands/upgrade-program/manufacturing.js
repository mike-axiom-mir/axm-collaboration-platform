'use strict';

const { zipSync, unzipSync, strToU8, strFromU8 } = require('fflate');
const U = require('./foundation-utils');

function createSketch(spec) {
  spec = U.clone(spec || {});
  const points = U.boundedArray(spec.points, 2, 100000, 'sketch points').map((item) => ({ id: U.text(item.id, 80, 'sketch point id'), x: U.finite(item.x, 'sketch point x'), y: U.finite(item.y, 'sketch point y'), fixed: item.fixed === true }));
  U.ensure(new Set(points.map((item) => item.id)).size === points.length, 'sketch point ids must be unique');
  const ids = new Set(points.map((item) => item.id));
  const constraints = U.boundedArray(spec.constraints, 1, 100000, 'sketch constraints').map((item) => ({ type: U.text(item.type, 30, 'sketch constraint type'), points: U.boundedArray(item.points, 1, 2, 'constraint points').map((id) => U.text(id, 80, 'constraint point id')), value: item.value == null ? null : U.finite(item.value, 'constraint value') }));
  U.ensure(constraints.every((item) => item.points.every((id) => ids.has(id))), 'sketch constraint references missing point');
  const byId = new Map(points.map((item) => [item.id, item]));
  const checks = constraints.map((constraint) => {
    const a = byId.get(constraint.points[0]); const b = constraint.points[1] ? byId.get(constraint.points[1]) : null; let error = 0;
    if (constraint.type === 'horizontal') error = Math.abs(a.y - b.y); else if (constraint.type === 'vertical') error = Math.abs(a.x - b.x); else if (constraint.type === 'distance') error = Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - constraint.value); else if (constraint.type === 'coincident') error = Math.hypot(a.x - b.x, a.y - b.y); else if (constraint.type === 'fixed') error = a.fixed ? 0 : Infinity; else throw new Error('unsupported sketch constraint: ' + constraint.type);
    return { type: constraint.type, points: constraint.points, error, pass: error <= (spec.tolerance || 1e-6) };
  });
  const sketch = { schema: 'axm.constraint-sketch/v1', version: '1.0.0', id: U.text(spec.id, 100, 'sketch id'), unit: U.text(spec.unit || 'mm', 10, 'sketch unit'), points, constraints, checks, status: checks.every((item) => item.pass) ? 'CONSTRAINED' : 'UNDER_OR_INCONSISTENT_CONSTRAINTS' };
  sketch.digest = U.sha256(sketch); return sketch;
}

function buildCad(spec) {
  spec = spec || {}; U.ensure(spec.sketch && spec.sketch.schema === 'axm.constraint-sketch/v1', 'constraint sketch required');
  const base = { schema: 'axm.parametric-brep-cad-receipt/v1', version: '1.0.0', sketch_digest: spec.sketch.digest, feature_history: U.clone(spec.features || []), status: 'MISSING_SUBSTRATE', brep: null, step: null, reopen: null, reason: 'reviewed independent B-rep/STEP CAD kernel is unavailable' };
  if (!spec.runtime_resolution || spec.runtime_resolution.status !== 'READY') { base.digest = U.sha256(base); return base; }
  U.ensure(spec.executor && typeof spec.executor.build_and_reopen === 'function', 'CAD kernel executor required');
  const identity = spec.executor.identity || {};
  let output; try { output = spec.executor.build_and_reopen({ sketch: U.clone(spec.sketch), features: U.clone(spec.features || []), tolerance: spec.tolerance || 1e-6, runtime: U.clone(spec.runtime_resolution.selected) }); } catch (error) { base.status = 'KERNEL_ERROR'; base.reason = String(error.message || error).slice(0, 500); base.digest = U.sha256(base); return base; }
  const bound = output && output.sketch_digest === spec.sketch.digest && output.step_bytes_base64 && output.brep_topology && output.reopen && output.reopen.status === 'PASS' && output.reopen.max_geometric_error <= (spec.tolerance || 1e-6);
  const live = identity.kind === 'external-cad-kernel' && identity.fresh_process === true;
  base.status = bound ? (live ? 'PASS' : 'TEST_ONLY') : 'FAIL'; base.reason = bound ? (live ? 'independent CAD kernel built and reopened the STEP model' : 'CAD transaction passed only with a fixture executor') : 'CAD output or reopen evidence is incomplete';
  base.brep = U.clone(output && output.brep_topology || null); base.step = output && output.step_bytes_base64 ? { mime: 'model/step', base64: output.step_bytes_base64, digest: U.sha256(Buffer.from(output.step_bytes_base64, 'base64')) } : null; base.reopen = U.clone(output && output.reopen || null); base.executor = U.clone(identity); base.digest = U.sha256(base); return base;
}

function developSheetMetal(spec) {
  spec = U.clone(spec || {}); const thickness = U.finite(spec.thickness_mm, 'sheet thickness'); const radius = U.finite(spec.inside_radius_mm, 'inside bend radius'); const angle = U.finite(spec.bend_angle_degrees, 'bend angle'); const k = U.finite(spec.k_factor, 'K factor'); const legA = U.finite(spec.leg_a_mm, 'leg A'); const legB = U.finite(spec.leg_b_mm, 'leg B');
  U.ensure(thickness > 0 && radius >= 0 && angle > 0 && angle < 180 && k >= 0 && k <= 1 && legA > 0 && legB > 0, 'sheet-metal parameters invalid');
  const radians = angle * Math.PI / 180; const bendAllowance = radians * (radius + k * thickness); const outsideSetback = Math.tan(radians / 2) * (radius + thickness); const bendDeduction = 2 * outsideSetback - bendAllowance; const flatLength = legA + legB - bendDeduction;
  const refold = spec.refold_receipt || null; const tolerance = U.finite(spec.tolerance_mm || 0.1, 'sheet-metal tolerance');
  const result = { schema: 'axm.sheet-metal-development/v1', version: '1.0.0', parameters: { thickness_mm: thickness, inside_radius_mm: radius, bend_angle_degrees: angle, k_factor: k, leg_a_mm: legA, leg_b_mm: legB }, bend: { allowance_mm: bendAllowance, outside_setback_mm: outsideSetback, deduction_mm: bendDeduction }, flat_pattern: { length_mm: flatLength, width_mm: U.finite(spec.width_mm, 'flat pattern width'), relief: U.clone(spec.relief) }, cad_receipt_digest: spec.cad_receipt && spec.cad_receipt.digest || null, refold_receipt_digest: refold && refold.digest || null, status: spec.cad_receipt && spec.cad_receipt.status === 'PASS' && refold && refold.status === 'PASS' && refold.max_error_mm <= tolerance ? 'PASS' : spec.cad_receipt && spec.cad_receipt.status === 'MISSING_SUBSTRATE' ? 'MISSING_BREP_SUBSTRATE' : 'TECHNICAL_BEND_MATH_ONLY' };
  result.digest = U.sha256(result); return result;
}

function xml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
function create3mf(spec) {
  spec = U.clone(spec || {}); const vertices = U.boundedArray(spec.vertices, 3, 1000000, '3MF vertices').map((item) => [U.finite(item[0], '3MF vertex x'), U.finite(item[1], '3MF vertex y'), U.finite(item[2], '3MF vertex z')]); const triangles = U.boundedArray(spec.triangles, 1, 2000000, '3MF triangles').map((item) => item.map((value) => Math.floor(U.finite(value, '3MF triangle index'))));
  U.ensure(triangles.every((item) => item.length === 3 && item.every((index) => index >= 0 && index < vertices.length) && new Set(item).size === 3), '3MF triangle indices invalid');
  const materials = U.boundedArray(spec.materials, 1, 1000, '3MF materials').map((item) => ({ name: U.text(item.name, 100, '3MF material name'), displaycolor: U.text(item.displaycolor, 9, '3MF material colour') }));
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="${xml(spec.unit || 'millimeter')}" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${xml(spec.title)}</metadata><resources><basematerials id="1">${materials.map((item) => `<base name="${xml(item.name)}" displaycolor="${xml(item.displaycolor)}"/>`).join('')}</basematerials><object id="2" type="model" pid="1" pindex="0"><mesh><vertices>${vertices.map((item) => `<vertex x="${item[0]}" y="${item[1]}" z="${item[2]}"/>`).join('')}</vertices><triangles>${triangles.map((item) => `<triangle v1="${item[0]}" v2="${item[1]}" v3="${item[2]}"/>`).join('')}</triangles></mesh></object></resources><build><item objectid="2"/></build></model>`;
  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const relationships = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
  const fixed = { mtime: new Date('1980-01-01T00:00:00.000Z') }; const bytes = Buffer.from(zipSync({ '[Content_Types].xml': [strToU8(contentTypes), fixed], '_rels/.rels': [strToU8(relationships), fixed], '3D/3dmodel.model': [strToU8(model), fixed] }, { level: 6 }));
  const reopened = unzipSync(bytes); const reopenedModel = strFromU8(reopened['3D/3dmodel.model']); const checks = [{ name: 'OPC-content-types', pass: !!reopened['[Content_Types].xml'] }, { name: 'OPC-root-relationship', pass: !!reopened['_rels/.rels'] }, { name: '3MF-model-part', pass: !!reopened['3D/3dmodel.model'] }, { name: 'vertex-count', pass: (reopenedModel.match(/<vertex /g) || []).length === vertices.length }, { name: 'triangle-count', pass: (reopenedModel.match(/<triangle /g) || []).length === triangles.length }, { name: 'build-object', pass: /<item objectid="2"\/>/.test(reopenedModel) }, { name: 'material-resource', pass: /<basematerials id="1">/.test(reopenedModel) }];
  const external = spec.external_conformance_receipt;
  const result = { schema: 'axm.3mf-production/v1', version: '1.0.0', id: U.text(spec.id, 100, '3MF id'), mime: 'model/3mf', package_base64: bytes.toString('base64'), package_digest: U.sha256(bytes), bytes: bytes.length, unit: spec.unit || 'millimeter', objects: 1, vertices: vertices.length, triangles: triangles.length, materials, checks, external_conformance_digest: external && external.digest || null, status: !checks.every((item) => item.pass) ? 'FAIL' : external && external.status === 'PASS' ? 'PASS' : external && external.status === 'MISSING_SUBSTRATE' ? 'TECHNICAL_PASS_MISSING_OFFICIAL_CONFORMANCE' : 'TECHNICAL_PASS_OFFICIAL_CONFORMANCE_REQUIRED' };
  result.digest = U.sha256(result); return result;
}

function createMachineProfile(spec) {
  spec = U.clone(spec || {}); const profile = { schema: 'axm.cam-machine-profile/v1', version: '1.0.0', id: U.text(spec.id, 100, 'machine profile id'), machine: U.text(spec.machine, 120, 'machine name'), controller: U.text(spec.controller, 80, 'controller'), units: U.text(spec.units || 'mm', 10, 'machine units'), travel: { x: U.finite(spec.travel.x, 'machine X travel'), y: U.finite(spec.travel.y, 'machine Y travel'), z: U.finite(spec.travel.z, 'machine Z travel') }, limits: { max_feed: U.finite(spec.limits.max_feed, 'machine max feed'), max_spindle_rpm: U.finite(spec.limits.max_spindle_rpm, 'machine max spindle') }, tools: U.boundedArray(spec.tools, 1, 100, 'machine tools').map((item) => ({ id: U.text(item.id, 30, 'tool id'), diameter_mm: U.finite(item.diameter_mm, 'tool diameter'), max_depth_mm: U.finite(item.max_depth_mm, 'tool max depth') })), post: { id: U.text(spec.post.id, 100, 'post id'), version: U.text(spec.post.version, 40, 'post version'), digest: U.text(spec.post.digest, 128, 'post digest') } };
  profile.digest = U.sha256(profile); return profile;
}

function createCamCandidate(profile, spec) {
  U.ensure(profile && profile.schema === 'axm.cam-machine-profile/v1', 'CAM machine profile required'); spec = U.clone(spec || {}); const stock = U.clone(spec.stock); const fixtures = U.clone(spec.fixtures || []); const moves = U.boundedArray(spec.moves, 1, 1000000, 'CAM moves').map((move) => ({ kind: U.text(move.kind, 20, 'CAM move kind'), x: U.finite(move.x, 'CAM X'), y: U.finite(move.y, 'CAM Y'), z: U.finite(move.z, 'CAM Z'), feed: move.kind === 'rapid' ? null : U.finite(move.feed, 'CAM feed'), tool_id: U.text(move.tool_id, 30, 'CAM tool id') }));
  const toolIds = new Set(profile.tools.map((item) => item.id)); const checks = [{ name: 'tools-declared', pass: moves.every((item) => toolIds.has(item.tool_id)) }, { name: 'travel-limits', pass: moves.every((item) => item.x >= 0 && item.x <= profile.travel.x && item.y >= 0 && item.y <= profile.travel.y && item.z >= -profile.travel.z && item.z <= 0) }, { name: 'feed-limits', pass: moves.every((item) => item.feed == null || item.feed > 0 && item.feed <= profile.limits.max_feed) }, { name: 'stock-bounds', pass: moves.every((item) => item.x <= stock.width_mm && item.y <= stock.height_mm && -item.z <= stock.depth_mm) }, { name: 'fixture-collision', pass: moves.every((move) => !fixtures.some((fixture) => move.x >= fixture.x && move.x <= fixture.x + fixture.width && move.y >= fixture.y && move.y <= fixture.y + fixture.height && move.z <= fixture.top_z && move.z >= fixture.bottom_z)) }, { name: 'independent-simulation', pass: spec.simulation_receipt && spec.simulation_receipt.status === 'PASS' && spec.simulation_receipt.profile_digest === profile.digest }];
  const lines = [`(AXM CANDIDATE ONLY)`, `(PROFILE ${profile.id} ${profile.digest})`, `(POST ${profile.post.id} ${profile.post.version} ${profile.post.digest})`, 'G90', profile.units === 'mm' ? 'G21' : 'G20']; let activeTool = null; for (const move of moves) { if (move.tool_id !== activeTool) { lines.push('T' + move.tool_id + ' M6'); activeTool = move.tool_id; } lines.push(`${move.kind === 'rapid' ? 'G0' : 'G1'} X${move.x.toFixed(3)} Y${move.y.toFixed(3)} Z${move.z.toFixed(3)}${move.feed == null ? '' : ' F' + move.feed.toFixed(1)}`); } lines.push('M30'); const gcode = lines.join('\n') + '\n';
  const receipt = { schema: 'axm.verified-cam-candidate/v1', version: '1.0.0', profile_digest: profile.digest, post: U.clone(profile.post), stock, fixtures, moves_digest: U.sha256(moves), simulation_receipt_digest: spec.simulation_receipt && spec.simulation_receipt.digest || null, checks, gcode_candidate: { mime: 'text/x-gcode', text: gcode, digest: U.sha256(gcode) }, status: checks.every((item) => item.pass) ? 'CANDIDATE_AWAITING_OPERATOR_APPROVAL' : 'FAIL', machine_ready: false, operator_approval: null };
  receipt.digest = U.sha256(receipt); return receipt;
}

function approveCam(candidate, approval) {
  U.ensure(candidate && candidate.schema === 'axm.verified-cam-candidate/v1', 'CAM candidate required'); U.ensure(candidate.status === 'CANDIDATE_AWAITING_OPERATOR_APPROVAL', 'only a passing CAM candidate can be approved'); approval = U.clone(approval || {});
  U.ensure(approval.reviewer && approval.reviewer.kind === 'human', 'CAM operator approval requires a human seat'); U.ensure(approval.action === 'approve-bounded-dry-run', 'CAM approval action mismatch'); U.ensure(approval.candidate_digest === candidate.digest, 'CAM approval candidate binding mismatch'); U.ensure(approval.profile_digest === candidate.profile_digest, 'CAM approval machine profile mismatch');
  const next = U.clone(candidate); next.operator_approval = { id: U.text(approval.id, 100, 'CAM approval id'), reviewer: { id: U.text(approval.reviewer.id, 100, 'CAM reviewer id'), kind: 'human' }, action: approval.action, candidate_digest: approval.candidate_digest, profile_digest: approval.profile_digest, approved_at: U.text(approval.approved_at, 60, 'CAM approval time'), expires_at: U.text(approval.expires_at, 60, 'CAM approval expiry'), scope: 'bounded-dry-run-only' }; next.operator_approval.digest = U.sha256(next.operator_approval); next.status = 'APPROVED_FOR_BOUNDED_DRY_RUN'; next.machine_ready = false; next.digest = U.sha256(Object.assign({}, next, { digest: undefined })); return next;
}

module.exports = { createSketch, buildCad, developSheetMetal, create3mf, createMachineProfile, createCamCandidate, approveCam };
