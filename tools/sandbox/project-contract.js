#!/usr/bin/env node
'use strict';
/*
 * AXM SANDBOX — PROJECT CONTRACT v0.1 (Session 1)
 * Route steps: W03.01 project identity, W03.06 portable directory contract,
 *              W07.01 boundary syntax, W07.02 boundary validation.
 * STATUS: TEST — not canon.
 *
 * LONG-GOAL GUARDRAILS (master route rules honored here so the alpha
 * never becomes a corner):
 *  - bodies (render/input) are DECLARED per project, never assumed.
 *    canvas-2d today; 3d/headless/spatial later = new body, same contract.
 *  - cores[] are adapter seats. Empty today. A physics core later plugs a
 *    seat; it never enters this file.
 *  - schema_version + contract_version make migration (W07.05) possible
 *    instead of painful.
 *  - unknown keys are preserved, reported, never deleted (no-loss).
 */

const CONTRACT_VERSION = '0.1';
const SCHEMA_VERSION = 1;

/* W03.06 — portable project directory contract.
 * A project is a plain folder. Removing the folder removes the project.
 * Nothing outside the folder owns project truth. */
const DIRECTORY_CONTRACT = {
  required: ['project.manifest.json'],
  optional: ['world/', 'assets/', 'saves/', 'notes/'],
  rule: 'A project folder is self-contained, inspectable, portable, and removable.'
};

/* W03.01 — stable project identity. Never derived from folder name. */
function makeProjectId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `axm-prj-${t}-${r}`;
}

/* W07.01 — boundary file syntax: what the project IS, what it USES,
 * what BODIES it wants, how it may DEGRADE. Plain JSON, human-readable. */
function newManifest(name, opts = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    contract_version: CONTRACT_VERSION,
    id: makeProjectId(),
    name: String(name || 'Untitled Project'),
    created: new Date().toISOString(),
    kind: opts.kind || 'sandbox-scene',            // boundary: what it is
    bodies: {                                       // declared, not assumed
      render: opts.render || 'canvas-2d',           // future: canvas-3d, headless, spatial
      input: opts.input || 'touch-pointer'          // future: gamepad, vr, robotic
    },
    cores: [],                                      // adapter seats (P08+), empty at alpha
    capabilities: opts.capabilities || ['entities', 'fixed-clock', 'save-load'],
    degrade: 'If a declared body or core is unavailable, block honestly and say so; never fake a fallback.',
    status: 'TEST'
  };
}

/* W07.02 — validation. Report problems, preserve unknowns, mutate nothing. */
const KNOWN_KEYS = ['schema_version','contract_version','id','name','created','kind','bodies','cores','capabilities','degrade','status'];
const KNOWN_RENDER_BODIES = ['canvas-2d'];      // alpha floor; future bodies extend this list
const KNOWN_INPUT_BODIES = ['touch-pointer'];

function validateManifest(m) {
  const errors = [], warnings = [];
  if (!m || typeof m !== 'object') return { ok:false, errors:['manifest is not an object'], warnings };
  if (m.schema_version !== SCHEMA_VERSION) errors.push(`schema_version ${m.schema_version} != ${SCHEMA_VERSION} (migration seat W07.05, not built at alpha)`);
  if (typeof m.id !== 'string' || !m.id.startsWith('axm-prj-')) errors.push('id missing or not axm-prj-*');
  if (typeof m.name !== 'string' || !m.name.trim()) errors.push('name missing');
  if (!m.bodies || typeof m.bodies !== 'object') errors.push('bodies missing — bodies must be declared, never assumed');
  else {
    if (!KNOWN_RENDER_BODIES.includes(m.bodies.render)) warnings.push(`render body '${m.bodies.render}' not available in this build — project loads BLOCKED-honest, not faked`);
    if (!KNOWN_INPUT_BODIES.includes(m.bodies.input)) warnings.push(`input body '${m.bodies.input}' not available in this build`);
  }
  if (!Array.isArray(m.cores)) errors.push('cores must be an array of adapter-seat declarations');
  else if (m.cores.length) warnings.push('cores declared but core loading is P08+; seats acknowledged, not loaded');
  const unknown = Object.keys(m).filter(k => !KNOWN_KEYS.includes(k));
  if (unknown.length) warnings.push(`unknown keys preserved untouched: ${unknown.join(', ')}`);
  return { ok: errors.length === 0, errors, warnings };
}

/* Directory-level validation for a project folder listing. */
function validateProjectDir(fileList) {
  const errors = [];
  for (const req of DIRECTORY_CONTRACT.required) {
    if (!fileList.includes(req)) errors.push(`missing required ${req}`);
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { CONTRACT_VERSION, SCHEMA_VERSION, DIRECTORY_CONTRACT, makeProjectId, newManifest, validateManifest, validateProjectDir };
