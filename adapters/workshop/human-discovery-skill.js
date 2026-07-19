'use strict';

const fs = require('fs');
const path = require('path');
const WorkshopRoot = require('../../config/workshop-root');

const SKILL_ID = 'human-discovery-stance';
const STAGES = new Set(['knownSpace', 'rejectedDirections', 'blindSpots', 'seams', 'patterns', 'realityChecks', 'soulChecks', 'minimalChecks']);

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 4000);
}

function loadCore(workshopRoot) {
  const root = WorkshopRoot.resolve({ workshopRoot });
  const file = path.join(root, 'tools', 'discovery-engine', 'discovery-core.js');
  if (!fs.existsSync(file)) throw new Error(`human Discovery/Stance source is unavailable: ${file}`);
  return { core: require(file), root, file };
}

function run(input, options) {
  input = input || {}; options = options || {};
  if (input.explicitInvocation !== true) throw new Error('human Discovery/Stance is a secondary skill and requires explicitInvocation: true');
  const loaded = options.core ? { core: options.core, root: options.workshopRoot || null, file: options.sourceFile || null } : loadCore(options.workshopRoot);
  const Core = loaded.core;
  if (!Core || typeof Core.createSession !== 'function' || typeof Core.recordDiscovery !== 'function' || typeof Core.validate !== 'function') throw new Error('Workshop Discovery Core contract is incomplete');
  const meta = { now: clean(input.at, 80), actorId: 'mirror-seed-0', actorKind: 'AI', provider: 'mirror-kernel', model: 'seed-0' };
  let state = Core.createSession({
    id: clean(input.sessionId, 120),
    title: clean(input.title, 240) || 'Mirror human-facing improvement review',
    subject: clean(input.subject),
    question: clean(input.question) || 'What would make this clearer, more useful, more accessible, or more repairable for a human?',
    intendedUse: clean(input.intendedUse),
    boundaries: Array.isArray(input.boundaries) ? input.boundaries : [],
    exclusions: ['No permission changes', 'No automatic implementation', 'No native seam closure', 'No learning promotion'],
    stakeholders: Array.isArray(input.stakeholders) ? input.stakeholders : ['human users', 'machine collaborators'],
    stakes: clean(input.stakes, 20) || 'LOW',
    evidenceProfile: clean(input.evidenceProfile, 40) || 'DESIGN',
    accessLogic: 'Same gate where possible; describe beginner friction in plain language.',
    successIsNot: ['visual polish without usability', 'machine confidence', 'automatic canon']
  }, meta);
  const entries = Array.isArray(input.entries) ? input.entries : [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] || {};
    if (!STAGES.has(entry.stage)) throw new Error(`unknown human Discovery/Stance stage: ${entry.stage}`);
    const result = Core.recordDiscovery(state, entry.stage, {
      text: clean(entry.text),
      claimLabel: clean(entry.claimLabel, 80) || 'HYPOTHESIS',
      source: clean(entry.source, 500),
      rationale: clean(entry.rationale, 1000),
      status: 'AI_ADVISORY_REQUIRES_HUMAN_REVIEW'
    }, Object.assign({}, meta, { recordId: `mirror-human-review-${index + 1}` }));
    if (!result.ok) throw new Error(result.errors.map(error => error.message).join('; '));
    state = result.state;
  }
  const validation = Core.validate(state);
  if (!validation.ok) throw new Error(`human Discovery/Stance session failed validation: ${validation.errors.join('; ')}`);
  return {
    schema: 'axm.mirror.skill-result/v1',
    skillId: SKILL_ID,
    priority: 'secondary',
    explicitInvocation: true,
    advisory: true,
    mayCloseNativeSeams: false,
    mayPromoteLearning: false,
    sourceCore: loaded.file,
    validation,
    bundle: typeof Core.exportBundle === 'function' ? Core.exportBundle(state) : { session: state },
    boundary: 'This human-facing review helps Mirror notice usability and access concerns. Its claims remain advisory until a human reviews them.'
  };
}

module.exports = { SKILL_ID, loadCore, run };
