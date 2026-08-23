#!/usr/bin/env node
'use strict';
/* RepairBuddy CLI — verifier-linked scan, module eyes, human-gated apply.
   Run from the workshop root:
     node tools/repairbuddy/repairbuddy-cli.js scan            live verifier scan, propose only
     node tools/repairbuddy/repairbuddy-cli.js scan --apply    apply matched mechanical fixes (backup, verify, receipt, rollback on fail)
     node tools/repairbuddy/repairbuddy-cli.js warnings        list verifier warnings routed to RepairBuddy
     node tools/repairbuddy/repairbuddy-cli.js warning-delta   compare every current warning with the known-open baseline
     node tools/repairbuddy/repairbuddy-cli.js packet <id>     emit one bounded human/AI warning action packet
     node tools/repairbuddy/repairbuddy-cli.js eyes <moduleId> look underneath one module's files and code
   Escalation prompts for unmatched failures are written to exports/repairbuddy/escalations/. */

const fs = require('fs'), path = require('path');
const childProcess = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');

(async () => {
  const K = await import('./repairbuddy-kernel.mjs');
  const H = await import('./repairbuddy-hands.mjs');
  const A = await import('./warning-action-packet.mjs');
  const Verifier = require(path.join(ROOT, 'hub', 'module-contract-verifier.js'));
  const args = process.argv.slice(2);
  const cmd = args[0] || 'scan';

  function loadPatterns() {
    const dir = path.join(__dirname, 'patterns');
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
      .filter(p => K.validatePattern(p).pass);
  }

  function loadRecipe(recipeId) {
    const file = path.join(__dirname, 'recipes', recipeId + '.json');
    if (!fs.existsSync(file)) throw new Error('unknown replay recipe: ' + recipeId);
    const recipe = JSON.parse(fs.readFileSync(file, 'utf8'));
    const verdict = K.validateReplayRecipe(recipe);
    if (!verdict.pass) throw new Error('invalid replay recipe: ' + verdict.errors.join('; '));
    return recipe;
  }

  function rootVerifierFailures(moduleId) {
    const run = childProcess.spawnSync(process.execPath, ['verify.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const prefix = 'tools/' + moduleId + '/manifest.json ';
    return String(run.stdout || '').split(/\r?\n/).map(line => line.trim())
      .filter(line => line.startsWith('FAIL  ' + prefix))
      .map(line => line.slice(('FAIL  ' + prefix).length));
  }

  function loadWarningQueue() {
    const file = path.join(ROOT, 'exports', 'repairbuddy-warning-queue.json');
    if (!fs.existsSync(file)) throw new Error('warning queue is missing; run node verify.js first');
    const queue = JSON.parse(fs.readFileSync(file, 'utf8'));
    const Router = require('./verifier-warning-router');
    const checked = Router.validateWarningQueue(queue);
    if (!checked.pass) throw new Error('warning queue is invalid: ' + checked.errors.join('; '));
    return queue;
  }

  function loadWarningDelta() {
    const Delta = require('./verifier-warning-delta');
    const reportFile = path.join(ROOT, 'exports', 'verify-report.json');
    const baselineFile = path.join(__dirname, 'verifier-warning-baseline.json');
    const outputFile = path.join(ROOT, 'exports', 'repairbuddy-warning-delta.json');
    const startedAt = Date.now();
    const verification = childProcess.spawnSync(process.execPath, [path.join(ROOT, 'verify.js')], {
      cwd:ROOT,
      encoding:'utf8',
      shell:false,
      windowsHide:true,
      timeout:180000,
      maxBuffer:32 * 1024 * 1024
    });
    if (verification.error || verification.status !== 0) {
      throw new Error('fresh root verification failed: ' + String(verification.stderr || verification.stdout || verification.error).slice(-1200));
    }
    if (!fs.existsSync(reportFile)) throw new Error('fresh verifier produced no report');
    const stat = fs.statSync(reportFile);
    if (stat.mtimeMs + 2000 < startedAt) throw new Error('verify report is not bound to the current warning-delta run');
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    const delta = Delta.compareWarnings(Delta.messagesFromVerifyReport(report), baseline);
    delta.verification = { invokedFresh:true, reportMtime:new Date(stat.mtimeMs).toISOString(), verifier:'node verify.js' };
    const body = JSON.parse(JSON.stringify(delta)); delete body.deltaDigest;
    delta.deltaDigest = Delta.canonicalDigest(body);
    const checked = Delta.validateDelta(delta);
    if (!checked.pass) throw new Error('warning delta is invalid: ' + checked.errors.join('; '));
    fs.mkdirSync(path.dirname(outputFile), { recursive:true });
    fs.writeFileSync(outputFile, JSON.stringify(delta, null, 2) + '\n', 'utf8');
    return delta;
  }

  function verifierSeams() {
    const report = Verifier.verifyDeclaredContracts(ROOT);
    const seams = [];
    report.results.filter(r => !r.pass).forEach(r => r.errors.forEach(message => seams.push({
      severity: 'HIGH', code: 'CONTRACT_INVALID', moduleId: r.id, message,
      evidence: 'tools/' + r.id + '/module.contract.json', next: 'Repair the contract seam.'
    })));
    return { seams, checked: report.results.length };
  }

  if (cmd === 'eyes') {
    const moduleId = args[1];
    if (!moduleId) { console.error('usage: eyes <moduleId> [relative/file/inside/module]'); process.exit(2); }
    const eyes = H.inspectModule(ROOT, moduleId);
    console.log(JSON.stringify(eyes, null, 2));
    if (args[2]) {
      const win = H.readCodeWindow(ROOT, path.join('tools', moduleId, args[2]));
      console.log('\n--- code window: ' + win.path + (win.exists ? (win.truncated ? ' (truncated)' : '') : ' (MISSING)') + ' ---');
      if (win.exists) console.log(win.text);
    }
    return;
  }

  if (cmd === 'warnings') {
    const queue = loadWarningQueue();
    if (args.includes('--json')) {
      console.log(JSON.stringify(queue, null, 2));
      return;
    }
    const s = queue.summary;
    console.log(`RepairBuddy warning queue · ${s.routedItems} routed item(s) from ${s.routedVerifierWarningLines} verifier warning line(s)`);
    console.log(`  ${s.replayable} replayable · ${s.evidenceRequired} evidence required · ${s.repairDesignRequired} repair design required`);
    queue.groups.forEach(group => {
      console.log(`\n${group.classification}  ${group.code} · ${group.count}`);
      console.log('  owner: ' + group.owner);
      console.log('  ' + group.subjects.join(', '));
    });
    if (args.includes('--details')) {
      queue.items.forEach(item => {
        console.log(`\n${item.id}  ${item.subject.id} · ${item.message}`);
        console.log('  ' + item.repair.next);
        console.log('  verify: ' + item.repair.verifyCommand);
        console.log('  packet: node tools/repairbuddy/repairbuddy-cli.js packet ' + item.id + ' --ai');
      });
    } else {
      console.log('\nUse warnings --details for exact next actions or warnings --json for the machine-readable queue.');
    }
    if (!s.replayable) console.log('No current warning has a frozen replay recipe, so RepairBuddy will not pretend to auto-fix one.');
    return;
  }

  if (cmd === 'warning-delta') {
    const delta = loadWarningDelta();
    if (args.includes('--json')) console.log(JSON.stringify(delta, null, 2));
    else {
      console.log(`RepairBuddy warning delta · ${delta.state} · ${delta.current.warnings} current known-open warning(s)`);
      console.log(`  ${delta.summary.added} added · ${delta.summary.resolved} resolved · ${delta.summary.changed} changed · ${delta.summary.unchanged} unchanged`);
      console.log('  baseline: ' + delta.baseline.id + ' · ' + delta.baseline.digest);
      delta.added.forEach(item => console.log('  ADDED    ' + item.message));
      delta.resolved.forEach(item => console.log('  RESOLVED ' + item.message));
      delta.changed.forEach(item => console.log('  CHANGED  ' + item.before + ' -> ' + item.after));
      console.log('Known-open means tracked, not acknowledged or suppressed.');
    }
    if (args.includes('--strict') && delta.state !== 'MATCH') process.exitCode = 2;
    return;
  }

  if (cmd === 'packet') {
    const warningId = args[1];
    if (!warningId) {
      console.error('usage: packet <warningId> [--human|--ai]');
      process.exit(2);
    }
    const queue = loadWarningQueue();
    const item = queue.items.find(candidate => candidate.id === warningId);
    if (!item) throw new Error('warning is not in the current queue: ' + warningId);
    const packet = A.buildWarningActionPacket(item);
    const checked = A.validateWarningActionPacket(packet);
    if (!checked.pass) throw new Error('invalid warning action packet: ' + checked.errors.join('; '));
    if (args.includes('--human')) console.log(A.humanChecklist(packet));
    else if (args.includes('--ai')) console.log(A.aiPrompt(packet));
    else console.log(JSON.stringify(packet, null, 2));
    return;
  }

  if (cmd === 'replay') {
    const recipeId = args[1], moduleId = args[2];
    if (!recipeId || !moduleId) {
      console.error('usage: replay <recipeId> <moduleId> [--apply]');
      process.exit(2);
    }
    const recipe = loadRecipe(recipeId);
    const observedFailures = rootVerifierFailures(moduleId);
    const preview = H.previewReplay(ROOT, recipe, moduleId, observedFailures);
    console.log(JSON.stringify({
      schema: preview.schema,
      recipeId: preview.recipeId,
      sourceRepair: recipe.lineage.sourceRepair,
      moduleId: preview.moduleId,
      file: preview.file,
      beforeDigest: preview.beforeDigest,
      afterDigest: preview.afterDigest,
      changedFields: preview.changedFields,
      copiedValues: preview.copiedValues,
      observedFailures
    }, null, 2));
    if (!args.includes('--apply')) {
      console.log('\nPREVIEW ONLY. Nothing was written. Add --apply only after human review.');
      return;
    }
    const receipt = await H.applyReplay(ROOT, recipe, moduleId, observedFailures, {
      humanApply: true,
      verifyAfter: async () => {
        const remaining = rootVerifierFailures(moduleId);
        return { pass: remaining.length === 0, detail: remaining.length ? remaining.join('; ') : 'target manifest passes the root verifier' };
      }
    });
    console.log('\n' + (receipt.rolledBack ? 'ROLLED BACK' : 'REPLAYED') + ' · ' + receipt.receiptPath);
    if (receipt.rolledBack) process.exitCode = 1;
    return;
  }

  if (cmd === 'scan') {
    const apply = args.includes('--apply');
    const patterns = loadPatterns();
    const { seams, checked } = verifierSeams();
    console.log(`RepairBuddy scan · verifier-linked · ${checked} contracts checked · ${seams.length} live failure(s) · ${patterns.length} pattern(s) loaded`);
    if (!seams.length) { console.log('Nothing forgotten right now. Quiet gate.'); return; }

    const report = K.compileReport(seams, patterns, { compiledAt: new Date().toISOString(), fingerprint: 'live-verifier' });
    const matched = report.results.filter(r => r.state === 'MATCHED');
    const escalations = report.results.filter(r => r.state === 'ESCALATE');

    matched.forEach(m => {
      const eyes = H.inspectModule(ROOT, m.moduleId);
      const confirmed = eyes.permissionDiff && eyes.permissionDiff.missingFromUses.includes(m.slots.permission);
      m.eyesConfirmed = !!confirmed;
      console.log(`\nMATCHED  ${m.moduleId} · ${m.patternId}${confirmed ? ' · eyes confirm the code agrees with the seam' : ' · EYES DISAGREE with the seam message — will not touch'}`);
      console.log('  ' + m.explanation);
    });
    escalations.forEach(e => console.log(`\nESCALATE ${e.moduleId} · ${e.seam.message}`));

    const outDir = path.join(ROOT, 'exports', 'repairbuddy');
    fs.mkdirSync(path.join(outDir, 'escalations'), { recursive: true });
    escalations.forEach((e, i) => {
      const file = path.join(outDir, 'escalations', `escalation-${e.moduleId || 'workshop'}-${i + 1}.txt`);
      fs.writeFileSync(file, K.buildEscalationPrompt(e.seam, {}));
      console.log('  prompt written: ' + path.relative(ROOT, file));
    });
    fs.writeFileSync(path.join(outDir, 'scan-report.json'), JSON.stringify(report, null, 2));

    if (!apply) {
      if (matched.length) console.log('\nA matched pattern is explanation only. Use a frozen replay recipe for any write.');
      if (matched.length) console.log(`\nProposals only — nothing touched. Rerun with --apply to let the hands move (backup + verify + receipt).`);
      return;
    }
    console.error('\nREFUSED: scan proposals never apply. Use replay <recipeId> <moduleId> to preview an exact proven repair.');
    process.exitCode = 2;
    return;
    const applicable = matched.filter(m => m.eyesConfirmed);
    if (!applicable.length) { console.log('\n--apply requested but no eyes-confirmed mechanical matches. Hands stay still.'); return; }
    const receipt = await H.applyProposals(ROOT, applicable, {
      humanApply: true,
      verifyAfter: async () => {
        const after = Verifier.verifyDeclaredContracts(ROOT);
        const fails = after.results.filter(r => !r.pass);
        return { pass: fails.length === 0, detail: `post-apply verifier: ${after.results.length} contracts, ${fails.length} fail` };
      }
    });
    console.log(`\nAPPLIED ${receipt.applied.length} · skipped ${receipt.skipped.length} · rolledBack=${receipt.rolledBack}`);
    console.log('verification: ' + (receipt.verification && receipt.verification.detail));
    console.log('receipt: ' + receipt.receiptPath);
    if (receipt.rolledBack) process.exitCode = 1;
    return;
  }

  console.error('unknown command: ' + cmd + ' (use scan | warnings [--details|--json] | warning-delta [--json|--strict] | packet <warningId> [--human|--ai] | replay <recipeId> <moduleId> | eyes <moduleId>)');
  process.exit(2);
})().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
