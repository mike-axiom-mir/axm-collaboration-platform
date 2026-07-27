/* RepairBuddy kernel — deterministic pattern matcher and escalation builder.
   Mirror-lineage discipline: no learned weights, no free prose in proposals,
   no application authority. It reads seams, matches stored patterns, renders
   typed slots, and for everything else builds an escalation packet.        */

export const PATTERN_SCHEMA = 'axm.repairbuddy.pattern/v1';
export const REPLAY_RECIPE_SCHEMA = 'axm.repairbuddy.replay-recipe/v1';
export const REPORT_SCHEMA = 'axm.repairbuddy.report/v1';
export const SLOT_TYPES = {
  identifier: /^[a-z][a-z0-9-]*$/i,
  permission: /^[a-z][a-z0-9-]*$/,
  'relative-path': /^[^\0<>:"|?*]+$/,
  integer: /^\d+$/
};
const OPERATIONS = ['insert-into-manifest-uses', 'create-missing-file-from-template', 'report-only'];
const REPLAY_OPERATIONS = ['copy-proven-json-fields'];

export function validatePattern(pattern) {
  const errors = [];
  const push = m => errors.push(m);
  if (!pattern || typeof pattern !== 'object') return { pass: false, errors: ['pattern is not an object'] };
  if (pattern.schema !== PATTERN_SCHEMA) push('schema must be ' + PATTERN_SCHEMA);
  if (!/^pattern-\d{4}-[a-z0-9-]+$/.test(String(pattern.id || ''))) push('id must look like pattern-NNNN-kebab-name');
  ['name', 'version'].forEach(f => { if (!String(pattern[f] || '').trim()) push(f + ' is required'); });
  if (!['SHADOW', 'RETIRED'].includes(pattern.status)) push('status must be SHADOW or RETIRED — RepairBuddy never applies');
  if (!String(pattern.seamCode || '').match(/^[A-Z][A-Z0-9_]+$/)) push('seamCode must be an uppercase glasses code');
  if (!pattern.match || typeof pattern.match !== 'object') push('match object is required');
  else {
    try { new RegExp(pattern.match.messagePattern); } catch (e) { push('match.messagePattern is not a valid regex: ' + e.message); }
    if (!Array.isArray(pattern.match.slots)) push('match.slots must be an array');
    else pattern.match.slots.forEach((s, i) => {
      if (!s || !String(s.name || '').match(/^[a-zA-Z][a-zA-Z0-9]*$/)) push('slot ' + i + ' needs a simple name');
      if (!Number.isInteger(s.group) || s.group < 1) push('slot ' + i + ' needs a 1-based capture group');
      if (!SLOT_TYPES[s.type]) push('slot ' + i + ' has unknown type ' + s.type);
    });
  }
  if (!pattern.proposal || typeof pattern.proposal !== 'object') push('proposal object is required');
  else {
    if (!OPERATIONS.includes(pattern.proposal.operation)) push('proposal.operation must be one of: ' + OPERATIONS.join(', '));
    if (!String(pattern.proposal.explanation || '').trim()) push('proposal.explanation is required');
    if (!Array.isArray(pattern.proposal.verification) || !pattern.proposal.verification.length) push('proposal.verification must list at least one check');
  }
  if (!pattern.lineage || typeof pattern.lineage !== 'object') push('lineage object is required');
  else ['sourceRepair', 'distilledBy', 'date', 'verifiedBy'].forEach(f => {
    if (!String((pattern.lineage || {})[f] || '').trim()) push('lineage.' + f + ' is required — RepairBuddy only learns from repairs that really happened');
  });
  return { pass: errors.length === 0, errors };
}

export function validateReplayRecipe(recipe) {
  const errors = [];
  const push = message => errors.push(message);
  if (!recipe || typeof recipe !== 'object') return { pass: false, errors: ['recipe is not an object'] };
  if (recipe.schema !== REPLAY_RECIPE_SCHEMA) push('schema must be ' + REPLAY_RECIPE_SCHEMA);
  if (!/^replay-\d{4}-[a-z0-9-]+$/.test(String(recipe.id || ''))) push('id must look like replay-NNNN-kebab-name');
  if (recipe.status !== 'ACTIVE_REPLAY') push('status must be ACTIVE_REPLAY');
  if (!REPLAY_OPERATIONS.includes(recipe.operation)) push('operation must be one of: ' + REPLAY_OPERATIONS.join(', '));
  if (recipe.target !== 'tools/<moduleId>/manifest.json') push('target must be the bounded Hub manifest role');
  if (!recipe.match || recipe.match.type !== 'hub-module') push('match.type must be hub-module');
  if (!Array.isArray(recipe.match && recipe.match.absentFields) || !recipe.match.absentFields.length) push('match.absentFields is required');
  if (!Array.isArray(recipe.match && recipe.match.usesContains) || !recipe.match.usesContains.length) push('match.usesContains is required');
  if (!recipe.copyFields || typeof recipe.copyFields !== 'object' || Array.isArray(recipe.copyFields) || !Object.keys(recipe.copyFields).length) push('copyFields must be a non-empty fixed object');
  if (!Array.isArray(recipe.expectedVerifierFailures) || !recipe.expectedVerifierFailures.length) push('expectedVerifierFailures is required');
  if (!recipe.lineage || typeof recipe.lineage !== 'object') push('lineage object is required');
  else ['sourceRepair', 'verifiedBy', 'date'].forEach(field => {
    if (!String(recipe.lineage[field] || '').trim()) push('lineage.' + field + ' is required');
  });
  return { pass: errors.length === 0, errors };
}

function renderSlots(template, slots) {
  return String(template).replace(/\$\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(slots, name) ? slots[name] : whole);
}

export function matchSeam(seam, patterns) {
  for (const pattern of patterns) {
    if (pattern.status !== 'SHADOW') continue;
    if (pattern.seamCode !== seam.code) continue;
    const m = new RegExp(pattern.match.messagePattern).exec(String(seam.message || ''));
    if (!m) continue;
    const slots = {}; let typed = true;
    for (const slot of pattern.match.slots) {
      const value = m[slot.group];
      if (typeof value !== 'string' || !SLOT_TYPES[slot.type].test(value)) { typed = false; break; }
      slots[slot.name] = value;
    }
    if (!typed) continue;
    return {
      state: 'MATCHED',
      patternId: pattern.id,
      moduleId: seam.moduleId || null,
      slots,
      operation: pattern.proposal.operation,
      explanation: renderSlots(pattern.proposal.explanation, slots),
      verification: pattern.proposal.verification.slice(),
      lineage: pattern.lineage.sourceRepair,
      applied: false
    };
  }
  return { state: 'ESCALATE', moduleId: seam.moduleId || null, seam };
}

export function buildEscalationPrompt(seam, context) {
  const c = context || {};
  return [
    'You are helping the AXM Workshop, a local-first system whose rules are:',
    'truth before story, proof before claim, no fake done, no automatic writes.',
    '',
    'A seam (open technical problem) has no matching repair pattern yet:',
    JSON.stringify({ severity: seam.severity, code: seam.code, moduleId: seam.moduleId, message: seam.message, evidence: seam.evidence, next: seam.next }, null, 2),
    '',
    'Task 1 — describe the repair a careful engineer would make, citing which',
    'files to read first (manifest, module.contract.json, selftest) before any edit.',
    '',
    'Task 2 — if (and only if) the repair is mechanical and would recur, also',
    'author ONE pattern file conforming to axm.repairbuddy.pattern/v1 so the',
    'local RepairBuddy can recognize this seam class next time. Schema summary:',
    c.schemaSummary || 'see tools/repairbuddy/pattern.schema.json in the workshop',
    '',
    'Hard rules for the pattern file: status must be SHADOW; slots render only',
    'from regex capture groups; lineage.sourceRepair must cite the real repair',
    'you are describing; verification must list runnable checks. If the repair',
    'is creative rather than mechanical, say so plainly and produce no pattern.',
    '',
    'Return the pattern file as a single JSON code block. It will be validated',
    'before it is accepted; invalid or vague patterns are rejected, which is a',
    'normal and honest outcome.'
  ].join('\n');
}

export function compileReport(seams, patterns, meta) {
  const results = seams.map(seam => matchSeam(seam, patterns));
  const matched = results.filter(r => r.state === 'MATCHED');
  const escalations = results.filter(r => r.state === 'ESCALATE');
  return {
    schema: REPORT_SCHEMA,
    compiledAt: (meta && meta.compiledAt) || null,
    glassesFingerprint: (meta && meta.fingerprint) || null,
    patternsLoaded: patterns.length,
    seams: seams.length,
    matched: matched.length,
    escalations: escalations.length,
    coverage: seams.length ? Math.round((matched.length / seams.length) * 100) / 100 : null,
    results,
    truth: 'MATCHED means a stored, lineage-bound pattern proposes a repair; nothing was applied. ESCALATE means RepairBuddy honestly does not know; a bigger model should repair once and may donate a pattern.'
  };
}
