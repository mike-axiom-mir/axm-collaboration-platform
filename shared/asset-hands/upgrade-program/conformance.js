'use strict';

const U = require('./foundation-utils');

const MATRIX_SCHEMA = 'axm.asset-hand-conformance-matrix/v1';

function claimIds(descriptor) {
  const claims = ['descriptor:schema'];
  for (const operation of descriptor.operation_modes || []) claims.push('operation:' + operation);
  for (const canvas of descriptor.canvas_types || []) claims.push('canvas:' + canvas.medium);
  for (const output of descriptor.output_types || []) claims.push('output:' + output.mime + ':' + output.role);
  for (const constraint of descriptor.constraints_honoured || []) claims.push('constraint:' + constraint);
  for (const permission of Object.keys(descriptor.required_permissions || {}).sort()) claims.push('permission:' + permission);
  return Array.from(new Set(claims)).sort();
}

function lintDescriptor(descriptor, validateDescriptor) {
  const errors = [];
  let normalized = descriptor;
  if (validateDescriptor) {
    try {
      const result = validateDescriptor(descriptor);
      if (result && result.pass === false) errors.push(...result.errors.map((item) => 'schema: ' + item));
      if (result && result.descriptor) normalized = result.descriptor;
    } catch (error) {
      errors.push('schema: ' + error.message);
    }
  }
  const outputs = normalized.output_types || [];
  const outputKeys = outputs.map((item) => item.mime + '|' + item.role);
  if (new Set(outputKeys).size !== outputKeys.length) errors.push('duplicate output MIME and role');
  for (const output of outputs) {
    if (output.format === 'SVG' && output.mime !== 'image/svg+xml') errors.push('SVG format must use image/svg+xml for ' + output.role);
    if (output.mime === 'image/svg+xml' && output.format !== 'SVG') errors.push('image/svg+xml must be declared as SVG for ' + output.role);
    if (output.editable && output.mime === 'application/json' && !output.schema) errors.push('editable JSON output needs a schema for ' + output.role);
    if (output.lossy === false && Array.isArray(output.known_losses) && output.known_losses.length) errors.push('lossless output declares losses for ' + output.role);
  }
  if (normalized.operations && normalized.operations.preview && !outputs.some((item) => /preview/i.test(item.role) || /^image\//.test(item.mime))) errors.push('preview operation lacks preview-capable output');
  if ((normalized.operation_modes || []).includes('validate') && !(normalized.operations && normalized.operations.validate)) errors.push('validate operation mode not reflected by operations.validate');
  if (normalized.network_policy && normalized.network_policy.mode === 'none' && Array.isArray(normalized.network_policy.domains) && normalized.network_policy.domains.length) errors.push('network-none descriptor declares domains');
  return { pass: errors.length === 0, errors, descriptor: U.clone(normalized), claims: claimIds(normalized) };
}

function buildMatrix(descriptors, evidence, options) {
  options = options || {};
  evidence = Array.isArray(evidence) ? evidence : [];
  const evidenceByHand = new Map(evidence.map((item) => [item.hand_id + '@' + item.hand_version, item]));
  const hands = (descriptors || []).map((descriptor) => {
    const lint = lintDescriptor(descriptor, options.validateDescriptor);
    const handEvidence = evidenceByHand.get(descriptor.id + '@' + descriptor.version);
    const claims = lint.claims.map((id) => {
      const proof = handEvidence && handEvidence.claims && handEvidence.claims[id];
      return {
        id,
        status: proof && proof.status === 'PASS' && proof.receipt_id && proof.digest ? 'PASS' : proof && proof.status === 'FAIL' ? 'FAIL' : 'UNPROVEN',
        receipt_id: proof && proof.receipt_id || null,
        digest: proof && proof.digest || null,
      };
    });
    const status = !lint.pass || claims.some((item) => item.status === 'FAIL') ? 'NONCONFORMANT' : claims.every((item) => item.status === 'PASS') ? 'CONFORMANT' : 'UNPROVEN';
    return { hand_id: descriptor.id, hand_version: descriptor.version, status, lint_errors: lint.errors, claims };
  });
  const matrix = {
    schema: MATRIX_SCHEMA,
    version: '1.0.0',
    status: hands.every((item) => item.status === 'CONFORMANT') ? 'CONFORMANT' : hands.some((item) => item.status === 'NONCONFORMANT') ? 'NONCONFORMANT' : 'UNPROVEN',
    hands,
    counts: {
      hands: hands.length,
      conformant: hands.filter((item) => item.status === 'CONFORMANT').length,
      unproven: hands.filter((item) => item.status === 'UNPROVEN').length,
      nonconformant: hands.filter((item) => item.status === 'NONCONFORMANT').length,
      claims: hands.reduce((sum, item) => sum + item.claims.length, 0),
    },
  };
  matrix.digest = U.sha256(matrix);
  return matrix;
}

module.exports = { MATRIX_SCHEMA, claimIds, lintDescriptor, buildMatrix };
