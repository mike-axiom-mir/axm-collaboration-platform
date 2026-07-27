'use strict';

const U = require('./foundation-utils');

const STYLE_SCHEMA = 'axm.asset-family-style/v1';
const FAMILY_SCHEMA = 'axm.asset-family-reference/v1';

function colour(value) {
  value = String(value || '').toLowerCase();
  U.ensure(/^#[0-9a-f]{6}$/.test(value), 'palette colours must be six-digit hex');
  return value;
}

function createStyleContract(spec) {
  spec = U.clone(spec || {});
  const palette = U.boundedArray(spec.palette, 2, 12, 'palette').map(colour);
  const shapeLanguage = U.boundedArray(spec.shape_language, 1, 8, 'shape language').map((item) => U.text(item, 40, 'shape language item'));
  const materialLanguage = U.boundedArray(spec.material_language, 1, 8, 'material language').map((item) => U.text(item, 60, 'material language item'));
  const body = {
    schema: STYLE_SCHEMA,
    version: '1.0.0',
    id: U.text(spec.id, 100, 'style id'),
    title: U.text(spec.title, 160, 'style title'),
    target_canvas_digest: U.text(spec.target_canvas_digest, 128, 'target canvas digest'),
    palette,
    shape_language: shapeLanguage,
    material_language: materialLanguage,
    proportions: U.clone(spec.proportions || { base: 1, accent: 0.38 }),
    detail_density: U.finite(spec.detail_density == null ? 0.5 : spec.detail_density, 'detail density'),
    variation_axes: U.clone(spec.variation_axes || { scale: [0.85, 1.15], accent: [0, 1] }),
    prohibited_motifs: (spec.prohibited_motifs || []).map((item) => U.text(item, 100, 'prohibited motif')),
    seed: U.text(spec.seed, 100, 'style seed'),
  };
  U.ensure(body.detail_density >= 0 && body.detail_density <= 1, 'detail density outside 0..1');
  body.digest = U.sha256(body);
  return body;
}

function memberSvg(style, member, index, width, height) {
  const primary = style.palette[index % style.palette.length];
  const accent = style.palette[(index + 1) % style.palette.length];
  const rounded = style.shape_language.some((item) => /round|soft|organic/i.test(item));
  const inset = 8 + (index % 3) * 3;
  const radius = rounded ? Math.max(4, Math.round(Math.min(width, height) * 0.12)) : 1;
  const detailCount = Math.max(1, Math.min(8, Math.round(1 + style.detail_density * 7)));
  const details = [];
  for (let i = 0; i < detailCount; i += 1) {
    const x = inset + ((i + 1) * (width - inset * 2)) / (detailCount + 1);
    const y = height * (0.35 + ((i + index) % 3) * 0.13);
    details.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${Math.max(1.5, width * 0.018).toFixed(2)}" fill="${accent}"/>`);
  }
  const label = String(member.label || member.role).replace(/[<>&"]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><rect width="${width}" height="${height}" fill="none"/><rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" rx="${radius}" fill="${primary}" stroke="${accent}" stroke-width="${Math.max(1, width * 0.025).toFixed(2)}"/>${details.join('')}<path d="M ${inset * 1.5} ${height - inset * 2} L ${width / 2} ${inset * 1.6} L ${width - inset * 1.5} ${height - inset * 2} Z" fill="${accent}" opacity="0.72"/></svg>`;
}

function createReferenceFamily(spec) {
  spec = U.clone(spec || {});
  U.ensure(spec.style && spec.style.schema === STYLE_SCHEMA, 'style contract required');
  const members = U.boundedArray(spec.members, 3, 32, 'family members').map((member) => ({
    id: U.text(member.id, 100, 'member id'),
    role: U.text(member.role, 80, 'member role'),
    label: U.text(member.label || member.role, 120, 'member label'),
    intended_use: U.text(member.intended_use, 100, 'member intended use'),
  }));
  U.ensure(new Set(members.map((item) => item.id)).size === members.length, 'family member ids must be unique');
  const width = Math.max(32, Math.min(2048, Math.round(U.finite(spec.width || 128, 'family width'))));
  const height = Math.max(32, Math.min(2048, Math.round(U.finite(spec.height || 128, 'family height'))));
  const artifacts = members.map((member, index) => {
    const svg = memberSvg(spec.style, member, index, width, height);
    return {
      id: member.id,
      role: member.role,
      label: member.label,
      intended_use: member.intended_use,
      mime: 'image/svg+xml',
      format: 'SVG',
      editable: true,
      text: svg,
      digest: U.sha256(svg),
      style_binding: { style_id: spec.style.id, style_digest: spec.style.digest, palette_indices: [index % spec.style.palette.length, (index + 1) % spec.style.palette.length], family_seed: U.sha256([spec.style.seed, member.id]).slice(0, 24) },
    };
  });
  const checks = [
    { name: 'minimum-family-size', pass: artifacts.length >= 3 },
    { name: 'unique-member-digests', pass: new Set(artifacts.map((item) => item.digest)).size === artifacts.length },
    { name: 'shared-style-binding', pass: artifacts.every((item) => item.style_binding.style_digest === spec.style.digest) },
    { name: 'declared-palette-used', pass: artifacts.every((item) => spec.style.palette.some((value) => item.text.includes(value))) },
    { name: 'target-canvas-bound', pass: !!spec.style.target_canvas_digest },
  ];
  const result = {
    schema: FAMILY_SCHEMA,
    version: '1.0.0',
    id: U.text(spec.id, 100, 'family id'),
    title: U.text(spec.title, 160, 'family title'),
    target_canvas_digest: spec.style.target_canvas_digest,
    style: U.clone(spec.style),
    artifacts,
    coherence_receipt: {
      schema: 'axm.asset-family-coherence-receipt/v1',
      status: checks.every((item) => item.pass) ? 'TECHNICAL_PASS_HUMAN_REVIEW_REQUIRED' : 'FAIL',
      checks,
      human_visual_review: 'PENDING',
      automatic_promotion: false,
    },
  };
  result.digest = U.sha256(result);
  return result;
}

module.exports = { STYLE_SCHEMA, FAMILY_SCHEMA, createStyleContract, createReferenceFamily };
