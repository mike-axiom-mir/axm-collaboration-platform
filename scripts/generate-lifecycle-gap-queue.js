#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEMA = 'axm.lifecycle-gap-queue/v1';

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function buildQueue(index, gapReport, lifecycleState, generatedAt) {
  if (!index || index.schema !== 'axm.tools-index/v1' || !Array.isArray(index.tools)) throw new Error('valid tools index required');
  if (!gapReport || gapReport.schema !== 'axm.module-seam-gap-report/v1' || !Array.isArray(gapReport.modules)) throw new Error('valid module seam gap report required');
  const tools = new Map(index.tools.map(tool => [tool.id, tool]));
  const lifecycles = lifecycleState && lifecycleState.lifecycles || {};
  const gapRows = gapReport.modules.filter(row => row && row.status === 'open');
  if (gapReport.moduleCount !== index.tools.length) throw new Error('module seam gap report does not cover the current tool count');
  gapRows.forEach(row => { if (!tools.has(row.id)) throw new Error('gap report contains unknown module: ' + row.id); });

  const entries = gapRows.map(row => {
    const tool = tools.get(row.id);
    const lifecycle = lifecycles[row.id] && lifecycles[row.id].lifecycle || 'CLAIMED';
    const blockers = tool.promotion && Array.isArray(tool.promotion.blockers) ? tool.promotion.blockers.slice() : [];
    const missingContract = row.gaps.includes('module contract not declared');
    const missingLifecycle = row.gaps.includes('lifecycle seam declaration missing');
    let score = lifecycle === 'WORKING' || lifecycle === 'SAVED CHECKPOINT' ? 100 : lifecycle === 'TEST-HOLD' ? 60 : lifecycle === 'NEEDS VERIFY' ? 30 : 10;
    if (tool.status === 'TEST') score += 30;
    if (missingContract) score += 30;
    if (missingLifecycle) score += 20;
    if (blockers.includes('top-level executable selftest is missing')) score += 25;
    if (blockers.includes('permissions are undeclared')) score += 10;
    if (blockers.includes('kind is undeclared')) score += 5;
    const priority = lifecycle === 'WORKING' || lifecycle === 'SAVED CHECKPOINT' ? 'P0' : lifecycle === 'TEST-HOLD' ? 'P1' : 'P2';
    const requiredInspection = [];
    if (missingContract) requiredInspection.push('Inspect actual inputs, outputs, side effects, permissions and failure behavior before authoring one module contract.');
    if (missingLifecycle) requiredInspection.push('Observe shutdown, save, resume and rollback behavior before declaring lifecycle seams.');
    if (blockers.includes('top-level executable selftest is missing')) requiredInspection.push('Add a bounded top-level selftest only after the runtime claim is identified.');
    return {
      id: row.id,
      priority,
      score,
      currentHubLifecycle: lifecycle,
      manifestStatus: tool.status,
      readinessState: tool.promotion && tool.promotion.state || 'UNKNOWN',
      gaps: row.gaps.slice(),
      readinessBlockers: blockers,
      requiredInspection,
      evidence: [
        { path:'tools-index.json', sourceDigest:index.sourceDigest, moduleId:row.id },
        { path:'exports/module-seam-gaps.json', checkedAt:gapReport.checkedAt, moduleId:row.id },
        { path:'state/hub-lifecycle/lifecycle.json', updatedAt:lifecycleState && lifecycleState.updatedAt || null, moduleId:row.id }
      ],
      authority: { automaticContractCreation:false, automaticPromotion:false, canonRequiresMike:true }
    };
  }).sort((a, b) => ({ P0:0, P1:1, P2:2 }[a.priority] - { P0:0, P1:1, P2:2 }[b.priority]) || b.score - a.score || a.id.localeCompare(b.id));

  const priorities = entries.reduce((counts, entry) => {
    counts[entry.priority] = Number(counts[entry.priority] || 0) + 1;
    return counts;
  }, { P0:0, P1:0, P2:0 });
  return {
    schema: SCHEMA,
    generatedAt: generatedAt || new Date().toISOString(),
    summary: { openModules:entries.length, priorities },
    inputs: {
      toolsIndexSourceDigest:index.sourceDigest,
      toolsIndexGeneratedAt:index.generatedAt,
      moduleSeamReportCheckedAt:gapReport.checkedAt,
      lifecycleStateUpdatedAt:lifecycleState && lifecycleState.updatedAt || null
    },
    entries,
    truth: {
      queueIsProofOfMissingDeclarationsOnly:true,
      folderNamesAreNotCapabilityEvidence:true,
      contractsMustBeAuthoredOneModuleAtATime:true,
      automaticContractCreation:false,
      automaticPromotion:false,
      canonRequiresMike:true
    }
  };
}

function main() {
  const root = path.resolve(__dirname, '..');
  const indexFile = path.join(root, 'tools-index.json');
  const gapFile = path.join(root, 'exports', 'module-seam-gaps.json');
  const lifecycleFile = path.join(root, 'state', 'hub-lifecycle', 'lifecycle.json');
  const outputFile = path.join(root, 'exports', 'stewardship', 'lifecycle-gap-queue.json');
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  const gaps = JSON.parse(fs.readFileSync(gapFile, 'utf8'));
  const lifecycle = JSON.parse(fs.readFileSync(lifecycleFile, 'utf8'));
  const report = buildQueue(index, gaps, lifecycle);
  report.inputFiles = {
    toolsIndex:{ path:'tools-index.json', sha256:sha256File(indexFile) },
    moduleSeams:{ path:'exports/module-seam-gaps.json', sha256:sha256File(gapFile) },
    hubLifecycle:{ path:'state/hub-lifecycle/lifecycle.json', sha256:sha256File(lifecycleFile) }
  };
  fs.mkdirSync(path.dirname(outputFile), { recursive:true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.stdout.write('lifecycle-gap-queue: ' + report.summary.openModules + ' open · P0 ' + report.summary.priorities.P0 + ' · P1 ' + report.summary.priorities.P1 + ' · P2 ' + report.summary.priorities.P2 + '\n');
}

if (require.main === module) main();
module.exports = { SCHEMA, buildQueue };
