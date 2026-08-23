'use strict';

const buildManifest = require('../manifests/build-manifest.json');
const capabilityProfile = require('../manifests/capability-profile.json');
const Digest = require('./digest');

function engineMetadata() {
  return {
    engineVersion: buildManifest.engineVersion,
    sourceCommit: buildManifest.sourceCommit,
    buildManifestDigest: Digest.canonicalDigest(buildManifest),
    standardsProfile: buildManifest.standardsProfile,
    featureMatrixDigest: Digest.canonicalDigest(capabilityProfile),
    status: buildManifest.status,
    installed: buildManifest.installed,
    promoted: buildManifest.promoted,
    implementation: Object.assign({}, buildManifest.implementation)
  };
}

function capabilities() {
  return JSON.parse(JSON.stringify(capabilityProfile));
}

module.exports = { engineMetadata, capabilities };
