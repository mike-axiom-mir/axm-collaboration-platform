'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('../../shared/game-production-runner');

const root = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const neutralStepSchema = JSON.parse(fs.readFileSync(path.join(root, 'shared', 'game-production-runner', 'schemas', 'production-step-receipt.schema.json'), 'utf8'));
const confinementSchema = JSON.parse(fs.readFileSync(path.join(root, 'shared', 'game-production-runner', 'schemas', 'hand-process-confinement-probe.schema.json'), 'utf8'));
const integration = Core.adapters.inspect(root);
let checks = 0;
function ok(value, message) { assert.ok(value, message); checks += 1; }

ok(manifest.id === contract.id && manifest.version === contract.version, 'manifest and contract identity agree');
ok(manifest.status === 'EXPERIMENTAL' && contract.status === 'EXPERIMENTAL', 'status remains experimental');
ok(JSON.stringify(manifest.permissions.slice().sort()) === JSON.stringify(contract.permissions.slice().sort()), 'permissions agree');
ok(contract.boundaries.refuses.includes('native-execution-v0.1'), 'native execution remains refused');
ok(contract.boundaries.refuses.includes('automatic-game-hub-install'), 'Game Hub install remains refused');
ok(manifest.accepts.includes('axm.production-intent-lock/v1') && manifest.produces.includes('axm.production-run-state/v1') && manifest.produces.includes('axm.production-run/v1'), 'portable profile schemas are declared');
ok(contract.boundaries.refuses.includes('universal-kernel-claim-by-adapter'), 'portable adapter cannot claim a universal kernel');
ok(Core.portable.SCHEMAS.plan === 'axm.production-plan/v1' && Core.portable.SCHEMAS.run === 'axm.production-run/v1', 'portable profile exposes exact neutral plan and run schemas');
ok(Core.portable.SCHEMAS.step === 'axm.production-step-receipt/v1' && Core.stepReceipts.SCHEMAS.production === Core.portable.SCHEMAS.step, 'portable profile and receipt contract agree on the neutral step schema');
ok(neutralStepSchema.$id === Core.portable.SCHEMAS.step && neutralStepSchema.properties.schema.const === Core.portable.SCHEMAS.step, 'tracked neutral step schema document matches the runtime contract');
ok(manifest.produces.includes(Core.portable.SCHEMAS.step), 'tool manifest declares neutral step receipts');
ok(manifest.actions.includes('run an explicit content-verified documentation candidate'), 'content-derived documentation route is declared');
ok(contract.boundaries.refuses.includes('operating-system-sandbox-claim-for-in-process-hands'), 'in-process Hands do not claim an operating-system sandbox');
ok(Core.documentRegistry.EXECUTOR.id !== Core.documentRegistry.VERIFIER.id, 'documentation Hand and verifier identities remain separate');
ok(confinementSchema.$id === Core.confinement.SCHEMA && confinementSchema.properties.schema.const === Core.confinement.SCHEMA, 'tracked confinement schema matches the runtime contract');
ok(manifest.produces.includes(Core.confinement.SCHEMA), 'tool manifest declares the confinement receipt');
ok(manifest.actions.includes('probe trusted Hand confinement substrate explicitly'), 'explicit confinement probe action is declared');
ok(contract.boundaries.refuses.includes('node-permission-mode-as-malicious-code-sandbox') && contract.boundaries.refuses.includes('process-hand-activation-when-any-required-denial-fails'), 'confinement claim and activation boundaries are explicit');
ok(integration.checks.every((item) => item.available), 'all tracked read-only AXM seams are present');
ok(integration.native_runtime_probed === false && integration.authority_granted === false, 'discovery grants no runtime authority');
console.log('Game Production Runner discovery seam review passed ' + checks + ' checks.');
