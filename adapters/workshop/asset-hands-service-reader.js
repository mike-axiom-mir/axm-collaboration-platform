'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const WorkshopRoot = require('../../config/workshop-root');

const SCHEMA = 'axm.mirror.asset-hands-service-observation/v1';
const MAX_CONTRACT_BYTES = 1024 * 1024;
const MAX_SCHEMA_BYTES = 2 * 1024 * 1024;

function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function boundedJson(file, limit) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`Expected a file: ${file}`);
  if (stat.size > limit) throw new Error(`Typed declaration exceeds ${limit} bytes: ${file}`);
  const bytes = fs.readFileSync(file);
  return { value: JSON.parse(bytes.toString('utf8')), bytes, sha256: digest(bytes) };
}
function containedFile(base, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('Schema path must be a non-empty relative path');
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, relative);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) throw new Error(`Schema path escapes Asset Hands: ${relative}`);
  return resolved;
}
function observe(options = {}) {
  const resolution = WorkshopRoot.inspect(options);
  if (!resolution.available) return { schema: SCHEMA, state: 'WORKSHOP_ABSENT', executable: false, workshop: resolution, service: null, reason: resolution.reason };
  const serviceDirectory = path.join(resolution.root, 'shared', 'asset-hands');
  const contractFile = path.join(serviceDirectory, 'service.contract.json');
  if (!fs.existsSync(contractFile)) return { schema: SCHEMA, state: 'ASSET_HANDS_ABSENT', executable: false, workshop: resolution, service: null, reason: 'The Workshop root exists but has no shared/asset-hands/service.contract.json declaration.' };
  const contractRead = boundedJson(contractFile, MAX_CONTRACT_BYTES);
  const contract = contractRead.value;
  if (!contract || contract.schema !== 'axm.shared-service-contract/v1' || contract.id !== 'asset-hands') throw new Error('Asset Hands shared-service contract identity mismatch');
  if (!contract.schemaFiles || typeof contract.schemaFiles !== 'object' || Array.isArray(contract.schemaFiles)) throw new Error('Asset Hands schemaFiles map is required');
  const schemas = Object.entries(contract.schemaFiles).map(([schemaId, relative]) => {
    const file = containedFile(serviceDirectory, relative);
    const read = boundedJson(file, MAX_SCHEMA_BYTES);
    return { schemaId, relativePath: relative, sha256: read.sha256, declaredId: read.value.$id || null };
  }).sort((left, right) => left.schemaId.localeCompare(right.schemaId));
  const builtInHands = Array.isArray(contract.builtInHands) ? contract.builtInHands.map(String) : [];
  const plannedMissingHands = Array.isArray(contract.plannedMissingHands) ? contract.plannedMissingHands.map(String) : [];
  return {
    schema: SCHEMA,
    state: 'DECLARED_TEST_SERVICE',
    executable: false,
    workshop: resolution,
    service: {
      id: contract.id,
      version: String(contract.version || ''),
      status: String(contract.status || 'UNKNOWN'),
      contractRelativePath: 'shared/asset-hands/service.contract.json',
      contractSha256: contractRead.sha256,
      schemaCount: schemas.length,
      schemas,
      executableHandCount: builtInHands.length,
      builtInHands,
      plannedMissingHandCount: plannedMissingHands.length,
      plannedMissingHands,
      provides: Array.isArray(contract.provides) ? contract.provides.map(String) : [],
      refuses: contract.boundaries && Array.isArray(contract.boundaries.refuses) ? contract.boundaries.refuses.map(String) : []
    },
    reason: 'Mirror read the typed Asset Hands declaration and schema evidence without loading or executing hand provider code.'
  };
}

module.exports = { SCHEMA, MAX_CONTRACT_BYTES, MAX_SCHEMA_BYTES, boundedJson, containedFile, observe };
