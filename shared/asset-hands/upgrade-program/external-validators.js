'use strict';

const U = require('./foundation-utils');

const RECEIPT_SCHEMA = 'axm.external-validator-receipt/v1';
const CORPUS_SCHEMA = 'axm.external-validator-corpus-receipt/v1';

function createProfile(spec) {
  spec = U.clone(spec || {});
  return Object.freeze({
    schema: 'axm.external-validator-profile/v1',
    id: U.text(spec.id, 100, 'validator profile id'),
    title: U.text(spec.title, 160, 'validator title'),
    claims: Object.freeze(U.boundedArray(spec.claims, 1, 30, 'validator claims').map((item) => U.text(item, 120, 'validator claim')).sort()),
    mimes: Object.freeze(U.boundedArray(spec.mimes, 1, 30, 'validator MIME types').map((item) => U.text(item, 100, 'validator MIME')).sort()),
    runtime_request: U.clone(spec.runtime_request),
    official_report_format: U.text(spec.official_report_format, 120, 'validator report format'),
    independence_basis: U.text(spec.independence_basis, 500, 'validator independence basis'),
    authority_required: 'external-process',
  });
}

const PROFILES = Object.freeze({
  epubcheck: createProfile({ id: 'w3c-epubcheck', title: 'W3C EPUBCheck', claims: ['epub.3.3.conformance'], mimes: ['application/epub+zip'], runtime_request: { id: 'epubcheck', runtime_version: 'reviewed', capabilities: ['validate:epub33'] }, official_report_format: 'EPUBCheck JSON', independence_basis: 'official EPUBCheck runtime is independent from the AXM EPUB writer' }),
  verapdf: createProfile({ id: 'verapdf-pdfua-pdfa', title: 'veraPDF PDF/UA and PDF/A', claims: ['pdf.ua', 'pdf.a'], mimes: ['application/pdf'], runtime_request: { id: 'verapdf', runtime_version: 'reviewed', capabilities: ['validate:pdfua', 'validate:pdfa'] }, official_report_format: 'veraPDF XML/JSON', independence_basis: 'veraPDF runtime is independent from the AXM PDF writer' }),
  pdfx: createProfile({ id: 'independent-pdfx', title: 'Independent PDF/X validator', claims: ['pdf.x'], mimes: ['application/pdf'], runtime_request: { id: 'pdfx-validator', runtime_version: 'reviewed', capabilities: ['validate:pdfx'] }, official_report_format: 'validator-native structured report', independence_basis: 'licence-reviewed ISO 15930 validator is independent from the AXM PDF/X writer' }),
  openimageio: createProfile({ id: 'openimageio-openexr', title: 'OpenImageIO and OpenEXR inspection', claims: ['image.metadata', 'image.pixel-diff', 'image.openexr'], mimes: ['image/png', 'image/jpeg', 'image/tiff', 'image/exr'], runtime_request: { id: 'openimageio-openexr', runtime_version: 'reviewed', capabilities: ['inspect:image', 'diff:pixels', 'inspect:openexr'] }, official_report_format: 'oiiotool JSON/text and exrheader', independence_basis: 'OpenImageIO/OpenEXR readers are independent from AXM image writers' }),
  gltf: createProfile({ id: 'khronos-gltf-validator', title: 'Khronos glTF Validator', claims: ['gltf.2.0.conformance'], mimes: ['model/gltf+json', 'model/gltf-binary'], runtime_request: { id: 'gltf-validator', runtime_version: 'reviewed', capabilities: ['validate:gltf2'] }, official_report_format: 'Khronos glTF Validator JSON', independence_basis: 'official validator is independent from AXM glTF serializers' }),
  ktx: createProfile({ id: 'khronos-ktx-tools', title: 'Khronos KTX reference tools', claims: ['ktx2.uastc', 'ktx2.hdr', 'ktx2.transcode'], mimes: ['image/ktx2'], runtime_request: { id: 'ktx-tools', runtime_version: 'reviewed', capabilities: ['inspect:ktx2', 'transcode:ktx2'] }, official_report_format: 'KTX tool structured output', independence_basis: 'Khronos KTX tools are independent from AXM KTX writers' }),
  ocio: createProfile({ id: 'opencolorio-aces2', title: 'OpenColorIO ACES 2', claims: ['colour.ocio', 'colour.aces2'], mimes: ['image/exr', 'image/tiff', 'image/png'], runtime_request: { id: 'opencolorio', runtime_version: 'reviewed', capabilities: ['transform:ocio', 'config:aces2'] }, official_report_format: 'OCIO processor and configuration receipt', independence_basis: 'pinned OCIO processor performs the pixel transform independently from AXM metadata' }),
  materialx: createProfile({ id: 'materialx-1.39', title: 'MaterialX 1.39 validator and shader generator', claims: ['materialx.1.39', 'materialx.shader-generation'], mimes: ['application/mtlx+xml'], runtime_request: { id: 'materialx', runtime_version: '1.39-reviewed', capabilities: ['validate:materialx', 'generate:shader'] }, official_report_format: 'MaterialX validator and shader generator output', independence_basis: 'official MaterialX runtime is independent from AXM material graph authoring' }),
});

function artifactBytes(artifact) {
  if (Buffer.isBuffer(artifact && artifact.content)) return Buffer.from(artifact.content);
  if (typeof (artifact && artifact.content) === 'string') return Buffer.from(artifact.content, 'utf8');
  if (typeof (artifact && artifact.text) === 'string') return Buffer.from(artifact.text, 'utf8');
  throw new Error('validator artifact content required');
}

function baseReceipt(profile, artifact, status, reason) {
  const content = artifactBytes(artifact);
  const receipt = {
    schema: RECEIPT_SCHEMA, version: '1.0.0', validator: { id: profile.id, title: profile.title },
    artifact: { id: U.text(artifact.id, 120, 'artifact id'), mime: U.text(artifact.mime, 100, 'artifact MIME'), digest: U.sha256(content), bytes: content.length },
    status, reason, runtime: null, executor: null, report: null, checks: [],
    scope: profile.claims.slice(), authority: 'external-validator-required',
  };
  receipt.id = U.receiptId('external-validator', receipt);
  receipt.digest = U.sha256(receipt);
  return receipt;
}

function run(profile, runtimeResolution, artifact, executor) {
  U.ensure(profile && profile.schema === 'axm.external-validator-profile/v1', 'external validator profile required');
  U.ensure(profile.mimes.includes(artifact && artifact.mime), 'artifact MIME is unsupported by validator ' + profile.id);
  if (!runtimeResolution || runtimeResolution.status !== 'READY') return baseReceipt(profile, artifact, 'MISSING_SUBSTRATE', 'reviewed validator runtime is unavailable');
  U.ensure(executor && typeof executor.run === 'function', 'external validator executor required');
  const content = artifactBytes(artifact);
  const artifactDigest = U.sha256(content);
  let result;
  try { result = executor.run({ profile: U.clone(profile), artifact: { id: artifact.id, mime: artifact.mime, digest: artifactDigest, content: Buffer.from(content) }, runtime: U.clone(runtimeResolution.selected) }); }
  catch (error) { return baseReceipt(profile, artifact, 'TOOL_ERROR', String(error.message || error).slice(0, 500)); }
  const identity = executor.identity || {};
  const authority = identity.kind === 'external-process' && identity.fresh_process === true;
  const bound = result && result.artifact_digest === artifactDigest && result.validator_id === profile.id && result.runtime_artifact_sha256 === runtimeResolution.selected.artifact_sha256;
  const toolStatus = result && result.pass === true ? 'PASS' : result && result.pass === false ? 'FAIL' : 'TOOL_ERROR';
  const status = !bound ? 'UNBOUND_REPORT' : !authority ? (toolStatus === 'PASS' ? 'FIXTURE_PASS' : toolStatus === 'FAIL' ? 'FIXTURE_FAIL' : 'TOOL_ERROR') : toolStatus;
  const receipt = baseReceipt(profile, artifact, status, bound ? (authority ? 'independent validator report is digest-bound' : 'report came from a non-production fixture executor') : 'validator report is not bound to artifact, tool and runtime');
  receipt.runtime = U.clone(runtimeResolution.selected);
  receipt.executor = U.clone(identity);
  receipt.report = U.clone(result && result.report || null);
  receipt.checks = U.clone(result && result.checks || []);
  receipt.official_report_format = profile.official_report_format;
  receipt.independence_basis = profile.independence_basis;
  receipt.digest = U.sha256(Object.assign({}, receipt, { digest: undefined }));
  return receipt;
}

function runCorpus(profile, runtimeResolution, corpus, executor) {
  const valid = run(profile, runtimeResolution, corpus.valid, executor);
  const invalid = run(profile, runtimeResolution, corpus.invalid, executor);
  const livePass = valid.status === 'PASS' && invalid.status === 'FAIL';
  const fixturePass = valid.status === 'FIXTURE_PASS' && invalid.status === 'FIXTURE_FAIL';
  const receipt = {
    schema: CORPUS_SCHEMA, version: '1.0.0', validator_id: profile.id,
    valid_receipt: valid, invalid_receipt: invalid,
    status: livePass ? 'PASS' : fixturePass ? 'TEST_ONLY' : valid.status === 'MISSING_SUBSTRATE' || invalid.status === 'MISSING_SUBSTRATE' ? 'MISSING_SUBSTRATE' : 'FAIL',
    requirement: 'known-valid artifact must pass and deliberately invalid artifact must fail in a fresh external process',
  };
  receipt.id = U.receiptId('validator-corpus', receipt);
  receipt.digest = U.sha256(receipt);
  return receipt;
}

module.exports = { RECEIPT_SCHEMA, CORPUS_SCHEMA, PROFILES, createProfile, run, runCorpus };
