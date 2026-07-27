'use strict';

const Core = require('./core');

const SCHEMA = 'axm.research-goal/v1';
const GAP_TYPES = ['HAND', 'SKILL', 'AUTHORITY', 'SUBSTRATE', 'EVIDENCE', 'CONTRACT', 'UNKNOWN'];

function normalizeRequirement(raw, index) {
  raw = raw || {};
  const capabilities = Core.list(raw.capabilities || raw.requiredCapabilities, 100);
  Core.assert(capabilities.length > 0, 'requirement ' + index + ' needs exact capabilities');
  const gapType = Core.text(raw.gapType, 30).toUpperCase();
  const requirement = {
    id: Core.text(raw.id, 120) || Core.id('requirement', { index, capabilities }),
    title: Core.text(raw.title, 240) || capabilities.join(' + '),
    capabilities,
    required: raw.required !== false,
    priority: Math.round(Core.clamp(raw.priority, 50, 0, 100)),
    gapType: GAP_TYPES.includes(gapType) ? gapType : 'UNKNOWN',
    acceptanceClaims: (Array.isArray(raw.acceptanceClaims) ? raw.acceptanceClaims : []).map((claim, claimIndex) => ({
      id: Core.text(claim && claim.id, 120) || Core.id('claim', { requirement: raw.id || index, claimIndex, claim: claim && claim.claim }),
      claim: Core.text(claim && claim.claim, 2000),
      kind: Core.text(claim && claim.kind, 40).toLowerCase() || 'behavior',
      risk: Core.text(claim && claim.risk, 20).toLowerCase() || 'medium',
      passCondition: Core.text(claim && claim.passCondition, 2000)
    })).filter(claim => claim.claim)
  };
  return requirement;
}

function normalize(input) {
  input = input || {};
  const requirements = (Array.isArray(input.requirements) ? input.requirements : []).map(normalizeRequirement).sort((a, b) => a.id.localeCompare(b.id));
  Core.assert(requirements.length > 0, 'research goal needs at least one exact requirement');
  const goal = {
    schema: SCHEMA,
    id: Core.text(input.id, 120) || Core.id('research-goal', { title: input.title, objective: input.objective, requirements }),
    title: Core.text(input.title, 240) || 'Untitled research goal',
    objective: Core.text(input.objective || input.description, 5000),
    source: {
      kind: Core.text(input.source && input.source.kind, 40).toUpperCase() || 'EXPLICIT',
      ref: Core.text(input.source && input.source.ref, 500) || null
    },
    requirements,
    boundaries: Core.list(input.boundaries, 100),
    successConditions: Core.list(input.successConditions, 100),
    authority: 'RECOMMENDATION_ONLY'
  };
  Core.assert(goal.objective, 'research goal objective is required');
  goal.goalDigest = Core.digest(goal);
  return goal;
}

function fromDirection(plan) {
  Core.assert(plan && plan.request, 'Workshop Direction plan required');
  const handRequests = Array.isArray(plan.handRequests) ? plan.handRequests : [];
  const routes = Array.isArray(plan.routes) ? plan.routes : [];
  const requirements = handRequests.map((hand, index) => ({
    id: hand.handRequestId || hand.id || 'direction-hand-' + index,
    title: hand.purpose || hand.target || hand.desiredContract,
    capabilities: [hand.desiredContract || ('module:' + hand.target)],
    gapType: 'HAND', required: true,
    priority: plan.request.priority
  }));
  routes.filter(route => route.status === 'HELD_MISSING_CAPABILITY').forEach((route, index) => requirements.push({
    id: route.routeId || 'direction-route-' + index,
    title: route.action || route.moduleId,
    capabilities: ['module:' + route.moduleId],
    gapType: 'HAND', required: true,
    priority: plan.request.priority
  }));
  if (!requirements.length) routes.forEach((route, index) => requirements.push({
    id: route.routeId || 'direction-route-' + index,
    title: route.action || route.moduleId,
    capabilities: ['module:' + route.moduleId],
    gapType: 'EVIDENCE', required: true,
    priority: plan.request.priority
  }));
  return normalize({
    id: 'research-' + plan.request.requestId,
    title: 'Research for ' + plan.request.title,
    objective: plan.request.description,
    source: { kind: 'WORKSHOP_DIRECTION', ref: plan.request.requestId },
    requirements,
    boundaries: ['do-not-change-direction-state', 'do-not-queue-work', 'do-not-promote-findings']
  });
}

module.exports = { SCHEMA, GAP_TYPES, normalize, fromDirection };
