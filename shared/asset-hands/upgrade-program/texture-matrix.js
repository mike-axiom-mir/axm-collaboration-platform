'use strict';

const U = require('./foundation-utils');

const RECEIPT_SCHEMA = 'axm.ktx2-transcode-matrix-receipt/v1';

function assess(spec) {
  spec = U.clone(spec || {});
  const profile = U.text(spec.profile, 40, 'KTX2 profile');
  U.ensure(['UASTC', 'UASTC_HDR_4x4', 'UASTC_HDR_6x6'].includes(profile), 'KTX2 profile is not UASTC or a declared UASTC HDR mode');
  const sourceDigest = U.text(spec.source_digest, 128, 'KTX2 source digest');
  const reference = spec.reference_tool_receipt;
  const transcodes = U.boundedArray(spec.transcodes, 2, 20, 'KTX2 transcodes').map((item) => ({
    target: U.text(item.target, 60, 'KTX2 transcode target'), status: U.text(item.status, 30, 'KTX2 transcode status'),
    source_digest: U.text(item.source_digest, 128, 'KTX2 transcode source digest'), decoded_pixel_digest: U.text(item.decoded_pixel_digest, 128, 'decoded pixel digest'),
    rmse: U.finite(item.rmse, 'KTX2 transcode RMSE'), gpu_bytes: U.finite(item.gpu_bytes, 'KTX2 GPU bytes'), receipt_digest: U.text(item.receipt_digest, 128, 'KTX2 transcode receipt digest'),
  }));
  const maxRmse = U.finite(spec.budgets && spec.budgets.max_rmse, 'KTX2 maximum RMSE');
  const maxGpuBytes = U.finite(spec.budgets && spec.budgets.max_gpu_bytes, 'KTX2 maximum GPU bytes');
  const profileChecks = [
    { name: 'reference-tool-pass', pass: !!(reference && reference.status === 'PASS') },
    { name: 'encoding-not-relabelled', pass: reference && reference.report && reference.report.encoding === profile },
    { name: 'source-digest-bound', pass: transcodes.every((item) => item.source_digest === sourceDigest) },
    { name: 'independent-targets', pass: new Set(transcodes.map((item) => item.target)).size === transcodes.length },
    { name: 'transcodes-pass', pass: transcodes.every((item) => item.status === 'PASS' && item.receipt_digest) },
    { name: 'pixel-thresholds', pass: transcodes.every((item) => item.rmse <= maxRmse) },
    { name: 'GPU-budget', pass: transcodes.every((item) => item.gpu_bytes <= maxGpuBytes) },
    { name: 'HDR-payload', pass: !profile.includes('HDR') || !!(reference && reference.report && reference.report.hdr === true && Number(reference.report.bit_depth) > 8) },
  ];
  const receipt = {
    schema: RECEIPT_SCHEMA, version: '1.0.0', source_digest: sourceDigest, profile,
    reference_tool_receipt_digest: reference && reference.digest || null, transcodes,
    budgets: { max_rmse: maxRmse, max_gpu_bytes: maxGpuBytes }, checks: profileChecks,
    status: reference && reference.status === 'MISSING_SUBSTRATE' ? 'MISSING_SUBSTRATE' : profileChecks.every((item) => item.pass) ? 'PASS' : 'FAIL',
  };
  receipt.digest = U.sha256(receipt);
  return receipt;
}

module.exports = { RECEIPT_SCHEMA, assess };
