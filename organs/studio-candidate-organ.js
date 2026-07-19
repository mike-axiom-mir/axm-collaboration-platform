'use strict';

const State = require('../kernel/state-language');

const SCHEMA = 'axm.mirror.studio-candidate-set/v1';
const ORGAN_ID = 'axm.mirror.organ.studio-candidate/seed-0';
const PACKET_SCHEMA = 'axm.drawpacket/v1';
const PALETTE = Object.freeze(['#38d6ec', '#e8b54a', '#a855f7', '#46e09a']);

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Number(value) || 0));
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function normalizeObservation(input) {
  const observation = input && typeof input === 'object' ? input : {};
  const width = round(clamp(observation.width, 64, 600));
  const height = round(clamp(observation.height, 64, 600));
  const visiblePixels = Math.max(0, round(observation.visiblePixels));
  return {
    width,
    height,
    visiblePixels,
    blank: observation.blank === true || visiblePixels === 0,
    layerCount: Math.max(1, round(observation.layerCount || 1)),
    signature: String(observation.signature || 'unobserved').slice(0, 160),
    backgroundColor: /^#[0-9a-f]{6}$/i.test(String(observation.backgroundColor || '')) ? String(observation.backgroundColor).toLowerCase() : '#050914'
  };
}

function channel(hex, offset) {
  return parseInt(hex.slice(offset, offset + 2), 16) / 255;
}

function luminance(hex) {
  const convert = value => value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  return 0.2126 * convert(channel(hex, 1)) + 0.7152 * convert(channel(hex, 3)) + 0.0722 * convert(channel(hex, 5));
}

function contrast(a, b) {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

function scoreCandidate(candidate, observation) {
  const feature = candidate.features;
  const contrastScore = clamp(contrast(candidate.primaryColor, observation.backgroundColor) / 12, 0, 1);
  const score =
    feature.boundaryMargin * 0.20 +
    feature.symmetry * 0.25 +
    feature.simplicity * 0.20 +
    feature.blankCanvasFit * 0.15 +
    contrastScore * 0.20;
  return Number(score.toFixed(6));
}

function rankCandidates(candidates, observationInput) {
  const observation = normalizeObservation(observationInput);
  return (Array.isArray(candidates) ? candidates : []).map(candidate => {
    const copy = JSON.parse(JSON.stringify(candidate));
    copy.score = scoreCandidate(copy, observation);
    copy.scoreBasis = {
      boundaryMargin: copy.features.boundaryMargin,
      symmetry: copy.features.symmetry,
      simplicity: copy.features.simplicity,
      blankCanvasFit: copy.features.blankCanvasFit,
      contrast: Number(clamp(contrast(copy.primaryColor, observation.backgroundColor) / 12, 0, 1).toFixed(6))
    };
    return copy;
  }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

function makeCandidates(observation) {
  const cx = round(observation.width / 2);
  const cy = round(observation.height / 2);
  const unit = Math.max(12, round(Math.min(observation.width, observation.height) * 0.085));
  const suffix = State.digest({ observation, grammar: 'studio-primitives-v1' }, 10);
  return [
    {
      id: `native-orbit-${suffix}`,
      name: 'Native orbit',
      primaryColor: PALETTE[0],
      features: { boundaryMargin: 1, symmetry: 1, simplicity: 0.90, blankCanvasFit: observation.blank ? 1 : 0.55 },
      packet: {
        schema: PACKET_SCHEMA, identityId: 'mirror', owner: 'mirror', name: 'Mirror · native orbit',
        draw: [
          { op: 'circle', x: cx, y: cy, r: unit, fill: false, color: PALETTE[0], width: 6 },
          { op: 'dot', x: cx, y: cy, r: Math.max(3, round(unit * 0.10)), color: PALETTE[1] }
        ]
      }
    },
    {
      id: `balanced-bridge-${suffix}`,
      name: 'Balanced bridge',
      primaryColor: PALETTE[1],
      features: { boundaryMargin: 0.96, symmetry: 0.95, simplicity: 0.78, blankCanvasFit: observation.blank ? 0.92 : 0.58 },
      packet: {
        schema: PACKET_SCHEMA, identityId: 'mirror', owner: 'mirror', name: 'Mirror · balanced bridge',
        draw: [
          { op: 'line', x1: cx - unit, y1: cy, x2: cx + unit, y2: cy, color: PALETTE[1], width: 5 },
          { op: 'dot', x: cx - unit, y: cy, r: Math.max(3, round(unit * 0.10)), color: PALETTE[0] },
          { op: 'dot', x: cx + unit, y: cy, r: Math.max(3, round(unit * 0.10)), color: PALETTE[0] }
        ]
      }
    },
    {
      id: `seed-triad-${suffix}`,
      name: 'Seed triad',
      primaryColor: PALETTE[2],
      features: { boundaryMargin: 0.98, symmetry: 0.92, simplicity: 0.84, blankCanvasFit: observation.blank ? 0.88 : 0.62 },
      packet: {
        schema: PACKET_SCHEMA, identityId: 'mirror', owner: 'mirror', name: 'Mirror · seed triad',
        draw: [
          { op: 'polygon', x: cx, y: cy, r: round(unit * 0.82), sides: 3, fill: false, color: PALETTE[2], width: 5 },
          { op: 'dot', x: cx, y: cy, r: Math.max(3, round(unit * 0.09)), color: PALETTE[3] }
        ]
      }
    }
  ];
}

function originate(input = {}) {
  const observation = normalizeObservation(input.observation);
  const observationDigest = State.digest(observation, 24);
  const ranked = rankCandidates(makeCandidates(observation), observation).map((candidate, index) => Object.assign(candidate, { rank: index + 1 }));
  return {
    ok: true,
    schema: SCHEMA,
    status: 'EXPERIMENTAL',
    organ: {
      id: ORGAN_ID,
      kind: 'deterministic-bounded-candidate-organ',
      learnedWeights: false,
      toolAuthority: false,
      selfModification: false
    },
    observation,
    observationDigest,
    criteria: [
      'stay inside the observed canvas boundary',
      'prefer geometric balance on a blank room',
      'prefer low command complexity',
      'prefer visible contrast against the declared background',
      'break equal scores by stable candidate id, never input order'
    ],
    candidates: ranked,
    recommendedCandidateId: ranked[0] ? ranked[0].id : null,
    recommendationReason: ranked[0] ? `${ranked[0].name} received the highest declared feature score (${ranked[0].score}).` : 'No bounded candidate was generated.',
    limitations: [
      'This is rule-based proposal origination, not learned imagination or aesthetic understanding.',
      'The organ cannot execute Studio operations.',
      'Seed-0 must independently gate every returned packet.',
      'A visible result remains a reversible proposal, not proof of general creativity.'
    ]
  };
}

module.exports = { SCHEMA, ORGAN_ID, normalizeObservation, rankCandidates, originate };
