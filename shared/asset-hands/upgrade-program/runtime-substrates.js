'use strict';

const U = require('./foundation-utils');

const MANIFEST_SCHEMA = 'axm.runtime-substrate-manifest/v1';
const RESOLUTION_SCHEMA = 'axm.runtime-substrate-resolution/v1';
const PRIVATE_KEYS = /(^|_)(path|home|directory|cwd|command|arguments|token|secret|key)$/i;

function assertPublic(value, trail) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    U.ensure(!PRIVATE_KEYS.test(key), 'private runtime field forbidden: ' + (trail ? trail + '.' : '') + key);
    assertPublic(value[key], (trail ? trail + '.' : '') + key);
  }
}

function createManifest(spec) {
  spec = U.clone(spec || {});
  assertPublic(spec, 'manifest');
  const capabilities = U.boundedArray(spec.capabilities, 1, 100, 'runtime capabilities')
    .map((item) => U.text(item, 100, 'runtime capability'));
  U.ensure(new Set(capabilities).size === capabilities.length, 'runtime capabilities must be unique');
  const body = {
    schema: MANIFEST_SCHEMA,
    version: '1.0.0',
    id: U.text(spec.id, 100, 'runtime id'),
    runtime_version: U.text(spec.runtime_version, 80, 'runtime version'),
    artifact_sha256: U.text(spec.artifact_sha256, 64, 'runtime artifact digest').toLowerCase(),
    licence: {
      spdx: U.text(spec.licence && spec.licence.spdx, 40, 'runtime licence SPDX'),
      review_status: U.text(spec.licence && spec.licence.review_status, 40, 'runtime licence review'),
      reviewed_by: U.text(spec.licence && spec.licence.reviewed_by, 100, 'runtime licence reviewer'),
      receipt_digest: U.text(spec.licence && spec.licence.receipt_digest, 128, 'runtime licence receipt digest'),
    },
    capabilities: capabilities.sort(),
    compatibility: {
      platforms: U.boundedArray(spec.compatibility && spec.compatibility.platforms, 1, 20, 'runtime platforms').map((item) => U.text(item, 60, 'runtime platform')).sort(),
      api_versions: U.boundedArray(spec.compatibility && spec.compatibility.api_versions, 1, 20, 'runtime API versions').map((item) => U.text(item, 40, 'runtime API version')).sort(),
    },
    network_required: spec.network_required === true,
    source: U.text(spec.source, 200, 'runtime source'),
  };
  U.ensure(/^[a-f0-9]{64}$/.test(body.artifact_sha256), 'runtime artifact digest must be SHA-256');
  U.ensure(body.licence.review_status === 'APPROVED', 'runtime licence must be explicitly approved');
  body.digest = U.sha256(body);
  return body;
}

function resolve(manifests, observations, request) {
  request = U.clone(request || {});
  observations = Array.isArray(observations) ? U.clone(observations) : [];
  const wanted = {
    id: U.text(request.id, 100, 'requested runtime id'),
    runtime_version: U.text(request.runtime_version, 80, 'requested runtime version'),
    platform: U.text(request.platform, 60, 'requested platform'),
    api_version: U.text(request.api_version, 40, 'requested API version'),
    capabilities: U.boundedArray(request.capabilities || [], 0, 100, 'requested runtime capabilities').map((item) => U.text(item, 100, 'requested capability')).sort(),
  };
  const manifest = (manifests || []).find((item) => item.id === wanted.id && item.runtime_version === wanted.runtime_version);
  let status = 'MISSING';
  let reason = 'no reviewed manifest matches the exact runtime id and version';
  let selected = null;
  if (manifest) {
    assertPublic(manifest, 'manifest');
    const observation = observations.find((item) => item.id === wanted.id && item.runtime_version === wanted.runtime_version);
    if (manifest.licence.review_status !== 'APPROVED') {
      status = 'UNREVIEWED';
      reason = 'runtime licence is not approved';
    } else if (!observation || observation.present !== true) {
      status = 'MISSING';
      reason = 'reviewed runtime is not present';
    } else {
      assertPublic(observation, 'observation');
      const observedDigest = U.text(observation.artifact_sha256, 64, 'observed runtime digest').toLowerCase();
      if (observedDigest !== manifest.artifact_sha256) {
        status = 'TAMPERED';
        reason = 'observed runtime digest does not match the reviewed artifact';
      } else if (!manifest.compatibility.platforms.includes(wanted.platform) || !manifest.compatibility.api_versions.includes(wanted.api_version)) {
        status = 'INCOMPATIBLE';
        reason = 'runtime does not declare the requested platform and API version';
      } else if (wanted.capabilities.some((item) => !manifest.capabilities.includes(item))) {
        status = 'INCOMPATIBLE';
        reason = 'runtime lacks one or more requested capabilities';
      } else {
        status = 'READY';
        reason = 'exact reviewed runtime observed with matching digest and compatibility';
        selected = {
          id: manifest.id,
          runtime_version: manifest.runtime_version,
          artifact_sha256: manifest.artifact_sha256,
          manifest_digest: manifest.digest,
          capabilities: wanted.capabilities,
        };
      }
    }
  }
  const receipt = {
    schema: RESOLUTION_SCHEMA,
    version: '1.0.0',
    request: wanted,
    status,
    reason,
    selected,
    installation_performed: false,
    private_location_retained: false,
  };
  receipt.id = U.receiptId('runtime-resolution', receipt);
  receipt.digest = U.sha256(receipt);
  return receipt;
}

module.exports = { MANIFEST_SCHEMA, RESOLUTION_SCHEMA, createManifest, resolve };
