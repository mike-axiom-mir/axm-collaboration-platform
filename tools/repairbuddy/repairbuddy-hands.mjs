/* RepairBuddy hands & eyes — node-side module inspection and bounded repair.
   Eyes: read the real files underneath a seam, never trust the message alone.
   Hands: compute an exact, formatting-preserving edit; apply ONLY when a
   human passes an explicit apply flag; back up first; verify after; receipt
   always. Rollback on any verification failure.                            */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RECEIPT_SCHEMA = 'axm.repairbuddy.apply-receipt/v1';
export const REPLAY_RECEIPT_SCHEMA = 'axm.repairbuddy.replay-receipt/v1';

/* ---------- EYES ---------- */

export function inspectModule(root, moduleId) {
  const folder = path.join(root, 'tools', moduleId);
  const eyes = { schema: 'axm.repairbuddy.module-observation/v1', moduleId, folder: 'tools/' + moduleId, exists: fs.existsSync(folder), files: [], manifest: null, contract: null, entryExists: null, selftestExists: null, permissionDiff: null, observations: [] };
  if (!eyes.exists) { eyes.observations.push('Module folder does not exist.'); return eyes; }
  eyes.files = fs.readdirSync(folder).sort();
  const readJson = f => { try { return JSON.parse(fs.readFileSync(path.join(folder, f), 'utf8')); } catch (e) { return { __unreadable: e.message }; } };
  if (eyes.files.includes('manifest.json')) eyes.manifest = readJson('manifest.json');
  else eyes.observations.push('No manifest.json — module is invisible to canon.');
  if (eyes.files.includes('module.contract.json')) eyes.contract = readJson('module.contract.json');
  else eyes.observations.push('No module.contract.json — capabilities are undeclared.');
  if (eyes.manifest && !eyes.manifest.__unreadable) {
    eyes.entryExists = !!eyes.manifest.entry && fs.existsSync(path.join(folder, eyes.manifest.entry));
    if (!eyes.entryExists) eyes.observations.push('Declared entry "' + eyes.manifest.entry + '" is missing on disk.');
  }
  eyes.selftestExists = eyes.files.includes('selftest.js');
  if (!eyes.selftestExists) eyes.observations.push('No selftest.js — claims here cannot be locally re-proven.');
  if (eyes.manifest && eyes.contract && !eyes.manifest.__unreadable && !eyes.contract.__unreadable) {
    const uses = Array.isArray(eyes.manifest.uses) ? eyes.manifest.uses : [];
    const perms = Array.isArray(eyes.contract.permissions) ? eyes.contract.permissions : [];
    const missing = perms.filter(p => !uses.includes(p));
    eyes.permissionDiff = { contractPermissions: perms, manifestUses: uses, missingFromUses: missing };
    if (missing.length) eyes.observations.push('Contract permissions missing from manifest uses: ' + missing.join(', '));
  }
  if (!eyes.observations.length) eyes.observations.push('No structural problems observed at this depth.');
  return eyes;
}

export function readCodeWindow(root, relativePath, maxBytes = 16384) {
  const abs = path.resolve(root, relativePath);
  if (!abs.startsWith(path.resolve(root) + path.sep)) throw new Error('eyes refuse to leave the workshop: ' + relativePath);
  if (!fs.existsSync(abs)) return { path: relativePath, exists: false };
  const raw = fs.readFileSync(abs);
  return { path: relativePath, exists: true, bytes: raw.length, truncated: raw.length > maxBytes, text: raw.slice(0, maxBytes).toString('utf8') };
}

/* ---------- HANDS (compute) ---------- */

export function computeUsesInsertion(rawManifestText, permission) {
  if (!/^[a-z][a-z0-9-]*$/.test(permission)) throw new Error('untyped permission refused: ' + permission);
  const before = JSON.parse(rawManifestText);
  const uses = Array.isArray(before.uses) ? before.uses : null;
  if (!uses) throw new Error('manifest has no uses array');
  if (uses.includes(permission)) return { changed: false, reason: 'already declared' };
  const m = /("uses"\s*:\s*\[)([^\]]*)(\])/.exec(rawManifestText);
  if (!m) throw new Error('uses array not found textually');
  const body = m[2];
  let newText;
  if (body.includes('\n')) {
    const items = body.split('\n').filter(l => l.trim());
    const indent = items.length ? (items[items.length - 1].match(/^\s*/) || [''])[0] : '    ';
    const tail = (body.split('\n').pop().match(/^\s*/) || [''])[0];
    const addition = (items.length ? ',' : '') + '\n' + indent + JSON.stringify(permission);
    newText = rawManifestText.slice(0, m.index + m[1].length) + body.replace(/\s*$/, '') + addition + '\n' + tail + rawManifestText.slice(m.index + m[1].length + body.length);
  } else {
    const sep = body.trim() ? ', ' : '';
    newText = rawManifestText.slice(0, m.index + m[1].length) + body.replace(/\s*$/, '') + sep + JSON.stringify(permission) + rawManifestText.slice(m.index + m[1].length + body.length);
  }
  const after = JSON.parse(newText);
  const a = { ...before }, b = { ...after };
  if (JSON.stringify(after.uses) !== JSON.stringify([...uses, permission])) throw new Error('post-check: uses did not gain exactly the one permission');
  delete a.uses; delete b.uses;
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('post-check: a field other than uses changed');
  return { changed: true, newText, diff: `uses: [${uses.join(', ')}] -> [+ ${permission}]` };
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function boundedManifestPath(root, moduleId) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(moduleId || ''))) throw new Error('replay refused: invalid module id');
  const toolsRoot = path.resolve(root, 'tools');
  const target = path.resolve(toolsRoot, moduleId, 'manifest.json');
  if (!target.startsWith(toolsRoot + path.sep)) throw new Error('replay refused: target escapes tools');
  return target;
}

export function previewReplay(root, recipe, moduleId, observedFailures) {
  if (!recipe || recipe.operation !== 'copy-proven-json-fields') throw new Error('replay refused: unknown recipe operation');
  const target = boundedManifestPath(root, moduleId);
  if (!fs.existsSync(target)) throw new Error('replay refused: target manifest is missing');
  const raw = fs.readFileSync(target, 'utf8');
  const before = JSON.parse(raw);
  if (before.type !== recipe.match.type) throw new Error('replay refused: manifest type differs from proven repair');
  for (const field of recipe.match.absentFields) {
    if (Object.prototype.hasOwnProperty.call(before, field)) throw new Error('replay refused: expected field is not absent: ' + field);
  }
  const uses = Array.isArray(before.uses) ? before.uses : [];
  for (const value of recipe.match.usesContains) {
    if (!uses.includes(value)) throw new Error('replay refused: uses does not contain proven prerequisite: ' + value);
  }
  const failures = Array.isArray(observedFailures) ? observedFailures : [];
  for (const expected of recipe.expectedVerifierFailures) {
    if (!failures.includes(expected)) throw new Error('replay refused: verifier did not report exact failure: ' + expected);
  }
  const after = JSON.parse(JSON.stringify(before));
  for (const [field, value] of Object.entries(recipe.copyFields)) after[field] = JSON.parse(JSON.stringify(value));
  const changedFields = Object.keys(recipe.copyFields);
  const untouchedBefore = JSON.parse(JSON.stringify(before));
  const untouchedAfter = JSON.parse(JSON.stringify(after));
  changedFields.forEach(field => { delete untouchedBefore[field]; delete untouchedAfter[field]; });
  if (JSON.stringify(untouchedBefore) !== JSON.stringify(untouchedAfter)) throw new Error('replay refused: fields outside the recipe changed');
  const newText = JSON.stringify(after, null, 2) + '\n';
  return {
    schema: 'axm.repairbuddy.replay-preview/v1',
    recipeId: recipe.id,
    moduleId,
    file: path.relative(root, target).replace(/\\/g, '/'),
    beforeDigest: digest(raw),
    afterDigest: digest(newText),
    changedFields,
    copiedValues: recipe.copyFields,
    raw,
    newText,
    target
  };
}

function atomicWrite(target, value) {
  const temp = target + '.repairbuddy-' + process.pid + '.tmp';
  fs.writeFileSync(temp, value, 'utf8');
  fs.renameSync(temp, target);
}

export async function applyReplay(root, recipe, moduleId, observedFailures, options) {
  const opts = options || {};
  if (opts.humanApply !== true) throw new Error('replay refused: explicit human apply flag is required');
  const preview = previewReplay(root, recipe, moduleId, observedFailures);
  const receipt = {
    schema: REPLAY_RECEIPT_SCHEMA,
    replayedAt: new Date().toISOString(),
    recipeId: recipe.id,
    sourceRepair: recipe.lineage.sourceRepair,
    moduleId,
    file: preview.file,
    beforeDigest: preview.beforeDigest,
    afterDigest: preview.afterDigest,
    changedFields: preview.changedFields,
    copiedValues: preview.copiedValues,
    verification: null,
    rolledBack: false
  };
  atomicWrite(preview.target, preview.newText);
  const verdict = opts.verifyAfter ? await opts.verifyAfter() : { pass: false, detail: 'no verifier supplied' };
  receipt.verification = verdict;
  if (verdict.pass !== true) {
    atomicWrite(preview.target, preview.raw);
    receipt.rolledBack = true;
  }
  const outDir = path.join(root, 'exports', 'repairbuddy');
  fs.mkdirSync(outDir, { recursive: true });
  const receiptPath = path.join(outDir, 'replay-receipt-' + receipt.replayedAt.replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  receipt.receiptPath = path.relative(root, receiptPath).replace(/\\/g, '/');
  return receipt;
}

/* ---------- HANDS (apply, human-gated) ---------- */

export async function applyProposals(root, proposals, options) {
  throw new Error('proposal application retired: proposals may explain, but only a frozen replay recipe may write');
  /* Legacy implementation intentionally unreachable; retained temporarily so old receipts remain understandable. */
  const opts = options || {};
  if (opts.humanApply !== true) throw new Error('applyProposals refused: hands move only with an explicit human apply flag');
  const receipt = { schema: RECEIPT_SCHEMA, appliedAt: new Date().toISOString(), humanApply: true, applied: [], skipped: [], verification: null, rolledBack: false };
  const backups = [];
  for (const p of proposals) {
    if (p.operation !== 'insert-into-manifest-uses') { receipt.skipped.push({ moduleId: p.moduleId, reason: 'operation ' + p.operation + ' has no hands yet — escalate' }); continue; }
    const manifestPath = path.join(root, 'tools', p.moduleId, 'manifest.json');
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const edit = computeUsesInsertion(raw, p.slots.permission);
    if (!edit.changed) { receipt.skipped.push({ moduleId: p.moduleId, reason: edit.reason }); continue; }
    backups.push({ manifestPath, raw });
    fs.writeFileSync(manifestPath, edit.newText);
    receipt.applied.push({ moduleId: p.moduleId, patternId: p.patternId, diff: edit.diff, file: 'tools/' + p.moduleId + '/manifest.json' });
  }
  if (receipt.applied.length) {
    const { verifyAfter } = opts;
    const verdict = verifyAfter ? await verifyAfter() : { pass: null, detail: 'no verifier supplied' };
    receipt.verification = verdict;
    if (verdict.pass === false) {
      backups.forEach(b => fs.writeFileSync(b.manifestPath, b.raw));
      receipt.rolledBack = true;
      receipt.applied.forEach(entry => { entry.revertedByRollback = true; });
    }
  }
  const outDir = path.join(root, 'exports', 'repairbuddy');
  fs.mkdirSync(outDir, { recursive: true });
  const receiptPath = path.join(outDir, 'apply-receipt-' + receipt.appliedAt.replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  receipt.receiptPath = path.relative(root, receiptPath);
  return receipt;
}
