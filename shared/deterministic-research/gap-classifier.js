'use strict';

const Core = require('./core');
const GapHand = require('../ai-native-hands/capability-gap-hand');

function classify(goal, snapshot, includeWorkshopGaps) {
  const requirements = goal.requirements.map(requirement => ({
    id: requirement.id,
    capabilities: requirement.capabilities,
    required: requirement.required,
    gapType: requirement.gapType
  }));
  const comparison = GapHand.compare(requirements, snapshot.capabilities);
  const requirementById = new Map(goal.requirements.map(item => [item.id, item]));
  const gaps = [];
  comparison.requirements.forEach(row => {
    const requirement = requirementById.get(row.id);
    const add = (capabilityId, status, declaredStatus) => gaps.push({
      id: Core.id('gap', { goal: goal.id, requirement: row.id, capabilityId, status }),
      gapType: requirement.gapType,
      status,
      source: 'GOAL_COMPARISON',
      sourceRef: goal.id + '#' + row.id,
      title: requirement.title + ': ' + capabilityId,
      capabilityId,
      requiredBy: [row.id],
      required: row.required,
      priority: requirement.priority,
      declaredStatus
    });
    row.missing.forEach(id => add(id, 'MISSING', 'unavailable'));
    row.degraded.forEach(id => add(id, 'DEGRADED', 'degraded'));
    row.unknown.forEach(id => add(id, 'UNKNOWN', 'unknown'));
  });
  if (includeWorkshopGaps !== false) gaps.push(...snapshot.observedGaps.map(Core.clone));
  const unique = new Map();
  gaps.forEach(gap => { if (!unique.has(gap.id)) unique.set(gap.id, gap); });
  return { comparison, gaps: Array.from(unique.values()).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)) };
}

module.exports = { classify };
