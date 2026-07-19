'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/contract-manifest-binding-v1';
const SCHEMA = 'axm.mirror.contract-manifest-binding/v1';
const MAX_DECLARATIONS = 64;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function clean(value, maximum = 240) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum);
}

function sha(value, field) {
  const result = clean(value, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error(`${field} must be a sha256 digest`);
  return result;
}

function relativePath(value, field, allowEmpty = false) {
  const result = clean(value, 300).replace(/\\/g, '/');
  if (!result && allowEmpty) return '';
  if (!result || result.startsWith('/') || /^[a-z]:/i.test(result) || result.split('/').includes('..')) {
    throw new Error(`${field} must be a safe relative path`);
  }
  return result;
}

function list(value, field) {
  if (!Array.isArray(value) || value.length > MAX_DECLARATIONS) throw new Error(`${field} must be a bounded array`);
  const result = value.map(item => clean(item)).sort();
  if (result.some(item => !item) || new Set(result).size !== result.length) throw new Error(`${field} must contain unique non-empty declarations`);
  return result;
}

function normalizeContract(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('contract evidence is required');
  return {
    moduleId: clean(value.moduleId, 120),
    contractRelativePath: relativePath(value.contractRelativePath, 'contractRelativePath'),
    contractSha256: sha(value.contractSha256, 'contractSha256'),
    permissions: list(value.permissions, 'contract.permissions')
  };
}

function normalizeManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('manifest evidence is required');
  return {
    moduleId: clean(value.moduleId, 120),
    manifestRelativePath: relativePath(value.manifestRelativePath, 'manifestRelativePath'),
    manifestSha256: sha(value.manifestSha256, 'manifestSha256'),
    declaredContractRelativePath: relativePath(value.declaredContractRelativePath, 'declaredContractRelativePath', true),
    uses: list(value.uses, 'manifest.uses')
  };
}

function evaluate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('manifest binding input is required');
  const unexpected = Object.keys(input).filter(key => !['contract', 'manifest'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical manifest binding fields: ${unexpected.join(', ')}`);
  const contract = normalizeContract(input.contract);
  const manifest = normalizeManifest(input.manifest);
  if (!contract.moduleId || !manifest.moduleId) throw new Error('contract and manifest module IDs are required');
  const missingPermissionDeclarations = contract.permissions.filter(permission => !manifest.uses.includes(permission));
  const checks = {
    moduleIdsMatch: contract.moduleId === manifest.moduleId,
    manifestDeclaresExactContractPath: !!manifest.declaredContractRelativePath && manifest.declaredContractRelativePath === contract.contractRelativePath,
    contractPermissionsDeclaredInManifestUses: missingPermissionDeclarations.length === 0
  };
  const bound = Object.values(checks).every(Boolean);
  const receipt = {
    schema: SCHEMA,
    cellId: CELL_ID,
    receiptDigest: null,
    contract,
    manifest,
    checks,
    missingPermissionDeclarations,
    bound,
    verdict: bound ? 'PASS' : 'FAIL',
    interpretation: bound
      ? 'The manifest explicitly binds this exact contract path and declares every contract permission in uses[].'
      : 'The contract is not safely bound to this manifest declaration.',
    authority: {
      candidateGeneration: false,
      permissionGrant: false,
      runtimeReadinessClaim: false,
      contractWrite: false,
      manifestWrite: false,
      trainingAdmission: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'This cell verifies declaration binding only. A declared permission is not a granted permission, and a bound contract is not proof of runtime readiness, semantic suitability, or execution success.'
  };
  receipt.receiptDigest = digest(Object.assign({}, receipt, { receiptDigest: null }));
  return receipt;
}

function verify(receipt) {
  if (!receipt || receipt.schema !== SCHEMA || receipt.cellId !== CELL_ID) throw new Error('invalid contract-manifest binding receipt');
  const expected = evaluate({ contract: receipt.contract, manifest: receipt.manifest });
  if (receipt.receiptDigest !== expected.receiptDigest) throw new Error('contract-manifest binding receipt digest mismatch');
  if (JSON.stringify(stable(receipt)) !== JSON.stringify(stable(expected))) throw new Error('contract-manifest binding receipt content mismatch');
  return true;
}

module.exports = { CELL_ID, SCHEMA, MAX_DECLARATIONS, digest, evaluate, verify };
