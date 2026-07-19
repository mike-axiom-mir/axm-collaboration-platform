'use strict';

const PackageCodec = require('./package-codec');
const { canvasCoverage } = require('./runtime');
const { versionTuple, compare } = require('./blender/blender-driver');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function accepts(values, value) {
  return Array.isArray(values) && (values.includes('*') || values.includes(value));
}

class NativeAdapterRegistry {
  constructor(options) {
    options = options || {};
    this.trustStore = options.trustStore || {};
    this.entries = [];
  }

  register(input) {
    input = input || {};
    const checked = PackageCodec.verify(input.manifest, { packageRoot: input.packageRoot, trustStore: this.trustStore });
    if (!checked.ok) throw new Error(checked.errors.join('; '));
    if (this.entries.some(function (entry) { return entry.manifest.package_id === input.manifest.package_id && entry.manifest.package_version === input.manifest.package_version; })) {
      throw new Error('native adapter package version already registered');
    }
    const entry = {
      manifest: clone(input.manifest),
      packageRoot: input.packageRoot,
      packageCheck: checked,
      runtimeFactory: input.runtimeFactory || null
    };
    this.entries.push(entry);
    return this.describe(entry);
  }

  describe(entry) {
    return {
      package_id: entry.manifest.package_id,
      package_version: entry.manifest.package_version,
      adapter_id: entry.manifest.adapter_id,
      signed: entry.packageCheck.signature_verified,
      signature_key_id: entry.manifest.signature.key_id,
      capabilities: clone(entry.manifest.capabilities)
    };
  }

  list() {
    return this.entries.map((entry) => this.describe(entry));
  }

  diagnose(request) {
    request = request || {};
    const sameAdapter = this.entries.filter(function (entry) { return entry.manifest.adapter_id === request.adapter_id; });
    if (!sameAdapter.length) return { status: 'MISSING_NATIVE_ADAPTER', matches: [], rejections: [], request: clone(request) };
    const rejections = [];
    const matches = sameAdapter.filter(function (entry) {
      const reasons = [];
      const manifest = entry.manifest;
      const requested = versionTuple(request.application_version);
      const minimum = versionTuple(manifest.host_application.minimum_version);
      const maximum = versionTuple(manifest.host_application.maximum_version_exclusive);
      if (!requested || compare(requested, minimum) < 0 || compare(requested, maximum) >= 0) reasons.push('APPLICATION_VERSION_UNSUPPORTED');
      const coverage = canvasCoverage(manifest, request.target_canvas || {});
      if (!coverage.ok) reasons.push('UNSUPPORTED_CANVAS');
      if (!accepts(manifest.capabilities.source_mime_types, request.source_mime)) reasons.push('SOURCE_TYPE_UNSUPPORTED');
      if ((request.operations || []).some(function (operation) { return !accepts(manifest.capabilities.operations, operation); })) reasons.push('OPERATION_UNSUPPORTED');
      if (reasons.length) rejections.push({ package_id: manifest.package_id, package_version: manifest.package_version, reasons, canvas_checks: coverage.checks });
      return reasons.length === 0;
    });
    if (matches.length) {
      matches.sort(function (left, right) { return right.manifest.package_version.localeCompare(left.manifest.package_version, undefined, { numeric: true }); });
      return { status: 'MATCHED', match: this.describe(matches[0]), matches: matches.map((entry) => this.describe(entry)), rejections, request: clone(request) };
    }
    const onlyCanvas = rejections.length && rejections.every(function (item) {
      return item.reasons.length > 0 && item.reasons.every(function (reason) { return reason === 'UNSUPPORTED_CANVAS'; });
    });
    return { status: onlyCanvas ? 'UNSUPPORTED_CANVAS' : 'MISSING_NATIVE_CAPABILITY', matches: [], rejections, request: clone(request) };
  }

  hostProfile(request, base) {
    const diagnosis = this.diagnose(request);
    const profile = clone(base || { capabilities: ['json', 'svg'], permissions: [], accepts: ['axm.asset-hand-result/v1', 'application/json', 'image/svg+xml'] });
    profile.native_adapter_diagnosis = diagnosis;
    if (diagnosis.status === 'MATCHED') {
      if (!profile.capabilities.includes('native-dcc-adapter')) profile.capabilities.push('native-dcc-adapter');
      if (!profile.permissions.includes('filesystem:write')) profile.permissions.push('filesystem:write');
      if (!profile.permissions.includes('plugin-data')) profile.permissions.push('plugin-data');
    }
    return profile;
  }
}

module.exports = { NativeAdapterRegistry };
