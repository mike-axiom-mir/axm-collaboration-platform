'use strict';

const crypto = require('crypto');
const path = require('path');

const WARNING_QUEUE_SCHEMA = 'axm.repairbuddy.warning-queue/v1';
const CLASSIFICATIONS = new Set(['REPLAYABLE', 'EVIDENCE_REQUIRED', 'REPAIR_DESIGN_REQUIRED']);

const GAME_WARNING_RULES = {
  'physical phone qa is pending': {
    code: 'PHYSICAL_PHONE_QA_PENDING',
    classification: 'EVIDENCE_REQUIRED',
    owner: 'browser-lan-hardware-qa-lab',
    next: 'Run the package on a physical phone over the intended LAN route, preserve a device evidence receipt, then change the manifest state only when that receipt passes review.'
  },
  'disconnect recovery is pending': {
    code: 'DISCONNECT_RECOVERY_PENDING',
    classification: 'EVIDENCE_REQUIRED',
    owner: 'browser-lan-hardware-qa-lab',
    next: 'Exercise disconnect and reconnect against the live game runtime, preserve the journey receipt, and keep the manifest pending until the recovery behavior is observed.'
  },
  'blocking overlay escape is pending': {
    code: 'BLOCKING_OVERLAY_ESCAPE_PENDING',
    classification: 'EVIDENCE_REQUIRED',
    owner: 'automated-playtester-scenario-agent',
    next: 'Exercise every blocking overlay through a live interaction journey, preserve the escape evidence, and mark verified only after the journey passes.'
  },
  'external collaborator state interface is pending': {
    code: 'EXTERNAL_COLLABORATOR_INTERFACE_PENDING',
    classification: 'REPAIR_DESIGN_REQUIRED',
    owner: 'platform-ai-plus-human-review',
    next: 'Inspect the game state boundary, implement a seat-visible semantic adapter interface and its evidence, then rerun the Game Package Verifier. No generic field copy can safely invent this interface.'
  }
};

function stableId(parts) {
  return 'rbw-' + crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 12);
}

function portableSurface(root, candidate, fallback) {
  if (!candidate) return fallback;
  if (!root || !path.isAbsolute(candidate)) return String(candidate).replace(/\\/g, '/');
  const rel = path.relative(root, candidate);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return rel.replace(/\\/g, '/');
  return fallback;
}

function itemBase(source, subjectKind, subjectId, code, message) {
  return {
    id: stableId([source, subjectKind, subjectId, code, message]),
    source,
    subject: { kind: subjectKind, id: subjectId },
    code,
    message,
    automaticRepair: false,
    repair: {
      recipeId: null,
      owner: null,
      next: null,
      verifyCommand: 'node verify.js'
    }
  };
}

function routeGameWarning(game, message, root) {
  const rule = GAME_WARNING_RULES[message] || {
    code: 'UNCLASSIFIED_GAME_WARNING',
    classification: 'REPAIR_DESIGN_REQUIRED',
    owner: 'platform-ai-plus-human-review',
    next: 'Inspect the game warning at its source and design a verifier-bound repair or evidence journey. Unknown warnings never receive an automatic recipe.'
  };
  const item = itemBase('game-night', 'game', String(game.game || 'unknown-game'), rule.code, message);
  item.classification = rule.classification;
  item.surface = portableSurface(root, game.manifest, 'tools/game-hub/game-library');
  item.repair.owner = rule.owner;
  item.repair.next = rule.next;
  item.repair.verifyCommand = 'node tools/game-hub/game-package-verifier.js';
  return item;
}

function routeModuleGap(module, gap) {
  const id = String(module.id || 'unknown-module');
  let code = 'MODULE_LIFECYCLE_GAP';
  let next = 'Inspect the module lifecycle and author an explicit state owner, reload, disconnect and cleanup decision. Verify the contract before installing it.';
  if (gap === 'module contract not declared') {
    code = 'MODULE_CONTRACT_NOT_DECLARED';
    next = 'Use Module Contract Workbench to author and stage a complete contract. A generic replay cannot safely invent capabilities, permissions, handoffs, boundaries or lifecycle semantics.';
  } else if (gap === 'lifecycle seam declaration missing') {
    code = 'LIFECYCLE_DECLARATION_MISSING';
    next = 'Inspect the module implementation, add explicit state owner, reload, disconnect and cleanup decisions to its declared contract, then rerun the lifecycle audit.';
  }
  const item = itemBase('module-lifecycle', 'module', id, code, gap);
  item.classification = 'REPAIR_DESIGN_REQUIRED';
  item.surface = module.contract ? 'tools/' + id + '/' + module.contract : 'tools/' + id + '/manifest.json';
  item.repair.owner = 'module-contract-workbench';
  item.repair.next = next;
  item.repair.verifyCommand = 'node hub/module-seam-audit-selftest.js && node verify.js';
  return item;
}

function groupItems(items) {
  const grouped = new Map();
  items.forEach(item => {
    const key = item.classification + '|' + item.code;
    if (!grouped.has(key)) grouped.set(key, {
      classification: item.classification,
      code: item.code,
      count: 0,
      owner: item.repair.owner,
      subjects: []
    });
    const group = grouped.get(key);
    group.count += 1;
    group.subjects.push(item.subject.id);
  });
  return Array.from(grouped.values()).map(group => {
    group.subjects.sort();
    return group;
  }).sort((a, b) => a.classification.localeCompare(b.classification) || a.code.localeCompare(b.code));
}

function buildWarningQueue(gameReport, moduleReport, options = {}) {
  const items = [];
  const root = options.root ? path.resolve(options.root) : null;
  (gameReport && gameReport.games || []).forEach(game => {
    (game.warnings || []).forEach(message => items.push(routeGameWarning(game, String(message), root)));
  });
  (moduleReport && moduleReport.modules || []).forEach(module => {
    (module.gaps || []).forEach(gap => items.push(routeModuleGap(module, String(gap))));
  });
  items.sort((a, b) => a.source.localeCompare(b.source) || a.subject.id.localeCompare(b.subject.id) || a.code.localeCompare(b.code));

  const count = classification => items.filter(item => item.classification === classification).length;
  const gameWarnings = gameReport && Number(gameReport.warningCount) || 0;
  const moduleGaps = moduleReport && Number(moduleReport.gapCount) || 0;
  return {
    schema: WARNING_QUEUE_SCHEMA,
    generatedAt: options.generatedAt || new Date().toISOString(),
    source: {
      gameReport: 'exports/game-night-seam-report.json',
      moduleReport: 'exports/module-seam-gaps.json'
    },
    summary: {
      routedItems: items.length,
      routedVerifierWarningLines: gameWarnings + (moduleGaps ? 1 : 0),
      replayable: count('REPLAYABLE'),
      evidenceRequired: count('EVIDENCE_REQUIRED'),
      repairDesignRequired: count('REPAIR_DESIGN_REQUIRED')
    },
    groups: groupItems(items),
    items,
    truth: {
      automaticRepairsApplied: 0,
      verifierWarningsSuppressed: 0,
      warningsRemainOpenUntilSourceVerifierPasses: true,
      note: 'Routing makes every warning actionable; it does not turn missing evidence or semantic design into a pass.'
    }
  };
}

function validateWarningQueue(queue) {
  const errors = [];
  if (!queue || typeof queue !== 'object') return { pass: false, errors: ['queue is not an object'] };
  if (queue.schema !== WARNING_QUEUE_SCHEMA) errors.push('schema must be ' + WARNING_QUEUE_SCHEMA);
  if (!queue.summary || typeof queue.summary !== 'object') errors.push('summary is required');
  if (!Array.isArray(queue.groups)) errors.push('groups must be an array');
  if (!Array.isArray(queue.items)) errors.push('items must be an array');
  else {
    const ids = new Set();
    queue.items.forEach((item, index) => {
      if (!item.id || ids.has(item.id)) errors.push('item ' + index + ' has a missing or duplicate id');
      ids.add(item.id);
      if (!CLASSIFICATIONS.has(item.classification)) errors.push('item ' + index + ' has an unsupported classification');
      if (item.automaticRepair !== false && item.classification !== 'REPLAYABLE') errors.push('item ' + index + ' claims automatic repair without a replayable recipe');
    });
    if (queue.summary && queue.summary.routedItems !== queue.items.length) errors.push('summary routedItems does not match item count');
  }
  if (!queue.truth || queue.truth.verifierWarningsSuppressed !== 0) errors.push('queue must state that it suppresses zero verifier warnings');
  return { pass: errors.length === 0, errors };
}

module.exports = {
  WARNING_QUEUE_SCHEMA,
  CLASSIFICATIONS,
  GAME_WARNING_RULES,
  buildWarningQueue,
  validateWarningQueue
};
