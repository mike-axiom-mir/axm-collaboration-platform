'use strict';

const U = require('./foundation-utils');

const PATH_SCHEMA = 'axm.precision-vector-path/v1';

function point(value, label) { return { x: U.finite(value && value.x, (label || 'point') + '.x'), y: U.finite(value && value.y, (label || 'point') + '.y') }; }
function same(a, b, tolerance) { return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance; }
function cubicAt(p0, p1, p2, p3, t) { const u = 1 - t; return { x: u ** 3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * p3.x, y: u ** 3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * p3.y }; }
function roots(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3; const b = 2 * (p0 - 2 * p1 + p2); const c = p1 - p0;
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b].filter((t) => t > 0 && t < 1);
  const discriminant = b * b - 4 * a * c; if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant); return [(-b + root) / (2 * a), (-b - root) / (2 * a)].filter((t) => t > 0 && t < 1);
}

function createPath(spec) {
  spec = U.clone(spec || {});
  const commands = U.boundedArray(spec.commands, 2, 100000, 'vector path commands').map((command) => {
    const type = U.text(command.type, 1, 'path command type').toUpperCase();
    U.ensure(['M', 'L', 'C', 'Z'].includes(type), 'unsupported vector command ' + type);
    if (type === 'Z') return { type: 'Z' };
    if (type === 'C') return { type, c1: point(command.c1, 'cubic control 1'), c2: point(command.c2, 'cubic control 2'), to: point(command.to, 'cubic end') };
    return { type, to: point(command.to, type + ' end') };
  });
  U.ensure(commands[0].type === 'M', 'vector path must begin with M');
  U.ensure(commands.slice(1).every((item) => item.type !== 'M'), 'subpaths must be represented as separate path objects');
  const intentionallyOpen = spec.intentionally_open === true;
  U.ensure(intentionallyOpen || commands[commands.length - 1].type === 'Z', 'path must close or explicitly declare intentionally_open');
  let current = commands[0].to; const start = commands[0].to; const samples = [current];
  for (const command of commands.slice(1)) {
    if (command.type === 'L') { current = command.to; samples.push(current); }
    else if (command.type === 'C') {
      const ts = [0, 1].concat(roots(current.x, command.c1.x, command.c2.x, command.to.x), roots(current.y, command.c1.y, command.c2.y, command.to.y));
      ts.forEach((t) => samples.push(cubicAt(current, command.c1, command.c2, command.to, t)));
      current = command.to;
    } else if (command.type === 'Z') { current = start; samples.push(start); }
  }
  const bounds = { x: Math.min(...samples.map((item) => item.x)), y: Math.min(...samples.map((item) => item.y)), width: Math.max(...samples.map((item) => item.x)) - Math.min(...samples.map((item) => item.x)), height: Math.max(...samples.map((item) => item.y)) - Math.min(...samples.map((item) => item.y)) };
  const path = { schema: PATH_SCHEMA, version: '1.0.0', id: U.text(spec.id, 100, 'vector path id'), commands, intentionally_open: intentionallyOpen, bounds };
  path.digest = U.sha256(path); return path;
}

function splitCubic(points, t) {
  const p0 = point(points.p0, 'p0'); const p1 = point(points.p1, 'p1'); const p2 = point(points.p2, 'p2'); const p3 = point(points.p3, 'p3');
  t = U.finite(t, 'split parameter'); U.ensure(t > 0 && t < 1, 'split parameter must be between 0 and 1');
  const lerp = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const q0 = lerp(p0, p1); const q1 = lerp(p1, p2); const q2 = lerp(p2, p3); const r0 = lerp(q0, q1); const r1 = lerp(q1, q2); const s = lerp(r0, r1);
  return { left: { p0, p1: q0, p2: r0, p3: s }, right: { p0: s, p1: r1, p2: q2, p3 }, split: s };
}

function endpoint(path) {
  let current = path.commands[0].to; const start = current;
  for (const command of path.commands.slice(1)) { if (command.type === 'L' || command.type === 'C') current = command.to; else if (command.type === 'Z') current = start; }
  return current;
}

function join(left, right, id, tolerance) {
  U.ensure(left.schema === PATH_SCHEMA && right.schema === PATH_SCHEMA, 'two precision paths required');
  tolerance = U.finite(tolerance == null ? 1e-6 : tolerance, 'join tolerance');
  U.ensure(left.intentionally_open && right.intentionally_open, 'only intentionally open paths can be joined');
  U.ensure(same(endpoint(left), right.commands[0].to, tolerance), 'path endpoints do not meet within tolerance');
  return createPath({ id, intentionally_open: right.commands[right.commands.length - 1].type !== 'Z', commands: left.commands.concat(right.commands.slice(1)) });
}

function offsetPolyline(points, distance, id, closed) {
  points = U.boundedArray(points, closed ? 3 : 2, 100000, 'polyline points').map((item) => point(item, 'polyline point'));
  distance = U.finite(distance, 'offset distance');
  const result = points.map((item, index) => {
    const previous = points[index === 0 ? (closed ? points.length - 1 : 0) : index - 1]; const next = points[index === points.length - 1 ? (closed ? 0 : points.length - 1) : index + 1];
    const dx = next.x - previous.x; const dy = next.y - previous.y; const length = Math.hypot(dx, dy); U.ensure(length > 1e-9, 'polyline contains a degenerate offset vertex');
    return { x: item.x - dy / length * distance, y: item.y + dx / length * distance };
  });
  const commands = [{ type: 'M', to: result[0] }].concat(result.slice(1).map((to) => ({ type: 'L', to })));
  if (closed) commands.push({ type: 'Z' });
  return createPath({ id, intentionally_open: !closed, commands });
}

function intersection(a, b) { const x = Math.max(a.x, b.x); const y = Math.max(a.y, b.y); const right = Math.min(a.x + a.width, b.x + b.width); const bottom = Math.min(a.y + a.height, b.y + b.height); return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null; }
function subtract(a, b) {
  const hit = intersection(a, b); if (!hit) return [a]; const pieces = [];
  if (hit.y > a.y) pieces.push({ x: a.x, y: a.y, width: a.width, height: hit.y - a.y });
  if (hit.y + hit.height < a.y + a.height) pieces.push({ x: a.x, y: hit.y + hit.height, width: a.width, height: a.y + a.height - hit.y - hit.height });
  if (hit.x > a.x) pieces.push({ x: a.x, y: hit.y, width: hit.x - a.x, height: hit.height });
  if (hit.x + hit.width < a.x + a.width) pieces.push({ x: hit.x + hit.width, y: hit.y, width: a.x + a.width - hit.x - hit.width, height: hit.height });
  return pieces;
}
function rectPath(rect, id) { return createPath({ id, commands: [{ type: 'M', to: { x: rect.x, y: rect.y } }, { type: 'L', to: { x: rect.x + rect.width, y: rect.y } }, { type: 'L', to: { x: rect.x + rect.width, y: rect.y + rect.height } }, { type: 'L', to: { x: rect.x, y: rect.y + rect.height } }, { type: 'Z' }] }); }
function booleanRect(a, b, operation, id) {
  [a, b].forEach((rect) => { ['x', 'y', 'width', 'height'].forEach((key) => { rect[key] = U.finite(rect[key], 'rectangle ' + key); }); U.ensure(rect.width > 0 && rect.height > 0, 'rectangle dimensions must be positive'); });
  let regions; if (operation === 'intersection') regions = intersection(a, b) ? [intersection(a, b)] : []; else if (operation === 'difference') regions = subtract(a, b); else if (operation === 'union') regions = [a].concat(subtract(b, a)); else throw new Error('unsupported rectangle boolean operation');
  return { schema: 'axm.vector-boolean-result/v1', operation, regions, paths: regions.map((rect, index) => rectPath(rect, id + '-' + index)), exact_for: 'axis-aligned-rectangles', digest: U.sha256({ operation, regions }) };
}

function pathData(path) { return path.commands.map((command) => command.type === 'Z' ? 'Z' : command.type === 'C' ? `C ${command.c1.x} ${command.c1.y} ${command.c2.x} ${command.c2.y} ${command.to.x} ${command.to.y}` : `${command.type} ${command.to.x} ${command.to.y}`).join(' '); }
function variableOutline(points, widths) {
  points = U.boundedArray(points, 2, 10000, 'variable stroke points').map((item) => point(item, 'stroke point')); widths = U.boundedArray(widths, points.length, points.length, 'variable stroke widths').map((item) => U.finite(item, 'stroke width'));
  const left = []; const right = [];
  points.forEach((item, index) => { const previous = points[Math.max(0, index - 1)]; const next = points[Math.min(points.length - 1, index + 1)]; const dx = next.x - previous.x; const dy = next.y - previous.y; const length = Math.hypot(dx, dy); U.ensure(length > 1e-9, 'variable stroke contains degenerate points'); const half = widths[index] / 2; left.push({ x: item.x - dy / length * half, y: item.y + dx / length * half }); right.push({ x: item.x + dy / length * half, y: item.y - dx / length * half }); });
  return left.concat(right.reverse());
}

function appearanceSvg(spec) {
  spec = U.clone(spec || {}); const width = Math.floor(U.finite(spec.width, 'SVG width')); const height = Math.floor(U.finite(spec.height, 'SVG height'));
  const polygon = variableOutline(spec.stroke.points, spec.stroke.widths); const points = polygon.map((item) => item.x + ',' + item.y).join(' ');
  const stops = U.boundedArray(spec.gradient.stops, 2, 20, 'gradient stops').map((item) => ({ offset: U.finite(item.offset, 'gradient offset'), colour: U.text(item.colour, 40, 'gradient colour'), opacity: item.opacity == null ? 1 : U.finite(item.opacity, 'gradient opacity') }));
  U.ensure(stops.every((item) => item.offset >= 0 && item.offset <= 1), 'gradient offsets outside 0..1');
  const blend = U.text(spec.blend_mode || 'normal', 40, 'vector blend mode');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g">${stops.map((item) => `<stop offset="${item.offset * 100}%" stop-color="${item.colour}" stop-opacity="${item.opacity}"/>`).join('')}</linearGradient></defs><polygon points="${points}" fill="url(#g)" style="mix-blend-mode:${blend}"/></svg>`;
  const unsupported = (spec.host_capabilities || []).includes('css-mix-blend-mode') ? [] : blend === 'normal' ? [] : [{ feature: 'mix-blend-mode:' + blend, fallback: 'normal', effect: 'blend appearance changes' }];
  const receipt = { schema: 'axm.vector-appearance-receipt/v1', svg_digest: U.sha256(svg), variable_stroke: { points: spec.stroke.points.length, min_width: Math.min(...spec.stroke.widths), max_width: Math.max(...spec.stroke.widths) }, gradient: { stops: stops.length }, blend_mode: blend, exact_loss_map: unsupported, renderer_matrix_digest: spec.renderer_matrix && spec.renderer_matrix.digest || null, status: unsupported.length ? 'DECLARED_LOSS' : spec.renderer_matrix && spec.renderer_matrix.status === 'PASS' ? 'PASS' : 'TEST_ONLY' };
  receipt.digest = U.sha256(receipt); return { svg, receipt };
}

module.exports = { PATH_SCHEMA, createPath, splitCubic, join, offsetPolyline, booleanRect, pathData, variableOutline, appearanceSvg };
