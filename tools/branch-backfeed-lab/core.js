(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMBranchBackfeed = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = 'axm.branch-backfeed-capsule/v1';
  const RECEIPT_SCHEMA = 'axm.branch-backfeed-intake-receipt/v1';
  const MANIFEST_NAME = 'AXM_BRANCH_CAPSULE.json';
  const SHA256 = /^[0-9a-f]{64}$/;

  function normalizeRelativePath(value) {
    const path = String(value || '');
    if (!path || path.indexOf('\\') >= 0 || path[0] === '/' || /^[A-Za-z]:/.test(path)) {
      throw new Error('path must be a non-empty portable relative path: ' + path);
    }
    const parts = path.split('/');
    if (parts.some(function (part) { return !part || part === '.' || part === '..'; })) {
      throw new Error('path contains an empty dot or parent segment: ' + path);
    }
    return parts.join('/');
  }

  function validateCapsule(capsule) {
    const errors = [];
    if (!capsule || typeof capsule !== 'object') return { pass: false, errors: ['capsule is not an object'] };
    if (capsule.schema !== SCHEMA) errors.push('schema must be ' + SCHEMA);
    if (!String(capsule.capsule_id || '').trim()) errors.push('capsule_id is required');
    if (!capsule.policy || typeof capsule.policy !== 'object') errors.push('policy object is required');
    else {
      if (capsule.policy.external_dependencies_allowed !== false) errors.push('external dependencies must be refused');
      if (capsule.policy.automatic_install_allowed !== false) errors.push('automatic install must be refused');
      if (capsule.policy.automatic_registry_change_allowed !== false) errors.push('automatic registry change must be refused');
      if (capsule.policy.automatic_promotion_allowed !== false) errors.push('automatic promotion must be refused');
    }
    if (!Array.isArray(capsule.modules) || capsule.modules.length === 0) errors.push('modules must be a non-empty array');
    if (!capsule.files || typeof capsule.files !== 'object' || Array.isArray(capsule.files)) errors.push('files must be an object');
    const files = capsule.files && typeof capsule.files === 'object' ? capsule.files : {};
    const normalizedFiles = new Set();
    Object.keys(files).forEach(function (path) {
      try {
        const normalized = normalizeRelativePath(path);
        if (normalizedFiles.has(normalized)) errors.push('duplicate normalized file path: ' + normalized);
        normalizedFiles.add(normalized);
      } catch (error) { errors.push(error.message); }
      const record = files[path];
      if (!record || !Number.isSafeInteger(record.bytes) || record.bytes < 0) errors.push('invalid byte count: ' + path);
      if (!record || !SHA256.test(String(record.sha256 || ''))) errors.push('invalid sha256: ' + path);
    });
    const ids = new Set();
    (capsule.modules || []).forEach(function (item) {
      const id = String(item && item.id || '');
      if (!id) errors.push('module id is required');
      if (ids.has(id)) errors.push('duplicate module id: ' + id);
      ids.add(id);
      let root = '';
      try { root = normalizeRelativePath(item.root); } catch (error) { errors.push(error.message); }
      if (root && root !== 'modules/' + id) errors.push('module root must be modules/' + id + ': ' + id);
      if (!Array.isArray(item.external_dependencies) || item.external_dependencies.length !== 0) {
        errors.push('module has external dependencies: ' + id);
      }
      if (!Array.isArray(item.file_paths) || item.file_paths.length === 0) errors.push('module file_paths missing: ' + id);
      (item.file_paths || []).forEach(function (path) {
        let normalized = '';
        try { normalized = normalizeRelativePath(path); } catch (error) { errors.push(error.message); }
        if (normalized && root && normalized.indexOf(root + '/') !== 0) errors.push('module file escapes its root: ' + path);
        if (normalized && !Object.prototype.hasOwnProperty.call(files, normalized)) errors.push('module file not in capsule inventory: ' + path);
      });
      ['manifest', 'contract', 'entry'].forEach(function (field) {
        let normalized = '';
        try { normalized = normalizeRelativePath(item[field]); } catch (error) { errors.push(error.message); }
        if (normalized && (item.file_paths || []).indexOf(normalized) < 0) errors.push(field + ' is not declared in module file_paths: ' + id);
      });
    });
    return { pass: errors.length === 0, errors: errors };
  }

  async function verifyInventory(capsule, selectedFiles, sha256File) {
    const shape = validateCapsule(capsule);
    const failures = shape.errors.slice();
    const expected = Object.keys(capsule && capsule.files || {}).sort();
    const observed = Object.keys(selectedFiles || {}).filter(function (path) { return path !== MANIFEST_NAME; }).sort();
    expected.filter(function (path) { return observed.indexOf(path) < 0; })
      .forEach(function (path) { failures.push('missing selected file: ' + path); });
    observed.filter(function (path) { return expected.indexOf(path) < 0; })
      .forEach(function (path) { failures.push('undeclared selected file: ' + path); });
    let checked = 0;
    if (shape.pass) {
      for (const path of expected) {
        const file = selectedFiles[path];
        if (!file) continue;
        const record = capsule.files[path];
        if (file.size !== record.bytes) {
          failures.push('byte count mismatch: ' + path);
          continue;
        }
        const digest = await sha256File(file);
        if (digest !== record.sha256) failures.push('sha256 mismatch: ' + path);
        else checked += 1;
      }
    }
    return {
      schema: RECEIPT_SCHEMA,
      capsule_id: capsule && capsule.capsule_id || null,
      verdict: failures.length ? 'HOLD' : 'READY_FOR_GRAFT',
      module_ids: (capsule && capsule.modules || []).map(function (item) { return item.id; }),
      declared_file_count: expected.length,
      checked_file_count: checked,
      failures: failures,
      boundaries: {
        installed: false,
        registry_changed: false,
        promoted: false,
        runtime_behavior_verified: false
      }
    };
  }

  return {
    SCHEMA: SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    MANIFEST_NAME: MANIFEST_NAME,
    normalizeRelativePath: normalizeRelativePath,
    validateCapsule: validateCapsule,
    verifyInventory: verifyInventory
  };
});
