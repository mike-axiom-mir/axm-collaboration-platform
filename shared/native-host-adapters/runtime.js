'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Bridge = require('../asset-hands/native-bridge-codec');
const TargetCanvas = require('../asset-hands/target-canvas');
const PackageCodec = require('./package-codec');

const TRANSACTION_SCHEMA = 'axm.native-host-transaction/v1';
const RECEIPT_SCHEMA = 'axm.native-host-application-receipt/v1';
const TERMINAL = new Set(['INSPECTED', 'ROLLED_BACK']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function atomicJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = filename + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'w' });
  fs.renameSync(temporary, filename);
}

function atomicCopy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + '.tmp-' + process.pid;
  fs.copyFileSync(source, temporary);
  fs.renameSync(temporary, target);
}

function baselineDigest(projectFile, relativeProjectFile) {
  return fs.existsSync(projectFile)
    ? PackageCodec.sha256File(projectFile)
    : PackageCodec.sha256Bytes(Buffer.from(PackageCodec.canonical({ exists: false, project_file: relativeProjectFile }), 'utf8'));
}

function includesOrWildcard(values, value) {
  return Array.isArray(values) && (values.includes('*') || values.includes(value));
}

function canvasCoverage(manifest, targetCanvas) {
  const capabilities = manifest.capabilities;
  const checks = [];
  function check(name, pass, requested) { checks.push({ name, pass: !!pass, requested }); }
  check('canvas-medium', includesOrWildcard(capabilities.canvas_mediums, targetCanvas.medium), targetCanvas.medium);
  check('canvas-unit', includesOrWildcard(capabilities.units, targetCanvas.dimensions && targetCanvas.dimensions.unit), targetCanvas.dimensions && targetCanvas.dimensions.unit);
  check('canvas-colour-space', includesOrWildcard(capabilities.colour_spaces, targetCanvas.colour && targetCanvas.colour.space), targetCanvas.colour && targetCanvas.colour.space);
  check('canvas-transparency', includesOrWildcard(capabilities.transparency_modes, targetCanvas.colour && targetCanvas.colour.transparency), targetCanvas.colour && targetCanvas.colour.transparency);
  (targetCanvas.behaviour || []).forEach(function (behaviour) { check('canvas-behaviour:' + behaviour, includesOrWildcard(capabilities.behaviours, behaviour), behaviour); });
  check('canvas-intended-use', includesOrWildcard(capabilities.intended_uses, targetCanvas.intended_use), targetCanvas.intended_use);
  TargetCanvas.requestedConstraints(targetCanvas).forEach(function (constraint) {
    check('canvas-constraint:' + constraint, includesOrWildcard(capabilities.supported_constraints, constraint), constraint);
  });
  return { ok: checks.every(function (item) { return item.pass; }), checks };
}

function boundedMetadata(operations) {
  const output = {};
  (operations || []).filter(function (operation) { return operation.type === 'set-metadata'; }).forEach(function (operation) {
    Object.entries(operation.metadata || {}).forEach(function (entry) {
      const key = String(entry[0]);
      const value = entry[1];
      if (!/^axm_[a-z0-9_]{1,48}$/i.test(key)) throw new Error('Blender metadata keys must use the bounded axm_ namespace');
      if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'string' && value.length > 200) || (typeof value === 'number' && !Number.isFinite(value))) {
        throw new Error('Blender metadata values must be bounded strings, finite numbers or booleans');
      }
      output[key] = value;
    });
  });
  return output;
}

function operationPlan(bundle) {
  const operations = bundle.change.operations || [];
  const imports = operations.filter(function (item) { return item.type === 'import-asset'; });
  if (imports.length !== 1) throw new Error('Blender adapter requires exactly one import-asset operation');
  const imported = imports[0];
  if (!/\.glb$/i.test(bundle.change.source_artifact.staged_path) || !/\.glb$/i.test(imported.path) || !/\.blend$/i.test(bundle.project.project_file)) {
    throw new Error('Blender reference adapter requires GLB staging/import and a .blend project');
  }
  const distinct = [bundle.change.source_artifact.staged_path, imported.path, bundle.project.project_file, bundle.rollback.snapshot_path];
  if (new Set(distinct.map(function (item) { return String(item).toLowerCase(); })).size !== distinct.length) throw new Error('staged, imported, project and snapshot paths must be distinct');
  operations.filter(function (item) { return item.type === 'set-metadata'; }).forEach(function (item) {
    if (item.path !== imported.path) throw new Error('Blender metadata operation must target the imported asset');
  });
  return {
    imported_path: imported.path,
    created_directories: operations.filter(function (item) { return item.type === 'create-directory'; }).map(function (item) { return item.path; }),
    refreshed_paths: operations.filter(function (item) { return item.type === 'refresh-index'; }).map(function (item) { return item.path; }),
    metadata: boundedMetadata(operations)
  };
}

class NativeHostRuntime {
  constructor(options) {
    options = options || {};
    this.workspaceRoot = path.resolve(options.workspaceRoot || '');
    this.packageRoot = path.resolve(options.packageRoot || '');
    this.manifest = clone(options.manifest || {});
    this.driver = options.driver;
    this.clock = options.clock || now;
    this.faultInjector = options.faultInjector || null;
    this.transactionsRoot = path.join(this.workspaceRoot, '.axm-native-adapters', 'transactions');
    if (!fs.existsSync(this.workspaceRoot) || !fs.statSync(this.workspaceRoot).isDirectory()) throw new Error('configured native workspace root does not exist');
    const packageCheck = PackageCodec.verify(this.manifest, { packageRoot: this.packageRoot, trustStore: options.trustStore || {} });
    if (!packageCheck.ok) throw new Error(packageCheck.errors.join('; '));
    if (!this.driver) throw new Error('native host driver is required');
    this.packageCheck = packageCheck;
    fs.mkdirSync(this.transactionsRoot, { recursive: true });
  }

  resolve(relativePath) {
    if (!PackageCodec.safeRelative(relativePath)) throw new Error('unsafe native workspace path');
    const target = path.resolve(this.workspaceRoot, relativePath);
    if (!PackageCodec.inside(this.workspaceRoot, target)) throw new Error('native workspace path escapes configured root');
    return target;
  }

  transactionId(changeDigest) {
    return 'native-' + changeDigest.slice(0, 32);
  }

  transactionDir(transactionId) {
    if (!/^native-[a-f0-9]{32}$/.test(String(transactionId || ''))) throw new Error('invalid native transaction id');
    return path.join(this.transactionsRoot, transactionId);
  }

  journalFile(transactionId) {
    return path.join(this.transactionDir(transactionId), 'transaction.json');
  }

  read(transactionId) {
    const filename = this.journalFile(transactionId);
    if (!fs.existsSync(filename)) throw new Error('native transaction not found');
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  }

  write(record, state, details) {
    record.state = state;
    record.updated_at = this.clock();
    record.history = record.history || [];
    record.history.push({ state, at: record.updated_at, details: clone(details || {}) });
    atomicJson(this.journalFile(record.transaction_id), record);
    return clone(record);
  }

  captureBaseline(bundle) {
    if (!bundle || !bundle.project || !Bridge.withinRoot(bundle.project.project_file, bundle.project.root)) throw new Error('native project binding is invalid');
    const projectFile = this.resolve(bundle.project.project_file);
    return {
      exists: fs.existsSync(projectFile),
      digest: baselineDigest(projectFile, bundle.project.project_file),
      project_file: bundle.project.project_file
    };
  }

  baselineForProject(projectFile) {
    if (!PackageCodec.safeRelative(projectFile)) throw new Error('unsafe native project path');
    const absolute = this.resolve(projectFile);
    return {
      exists: fs.existsSync(absolute),
      digest: baselineDigest(absolute, projectFile),
      project_file: projectFile
    };
  }

  preview(input) {
    const bundle = clone(input.bundle || {});
    const validation = Bridge.validate(bundle);
    const errors = validation.errors.slice();
    const canvas = clone(input.targetCanvas || {});
    if (Bridge.sha256(canvas) !== bundle.change.target_canvas_digest) errors.push('runtime target canvas does not match approved bundle digest');
    const coverage = canvasCoverage(this.manifest, canvas);
    if (!coverage.ok) errors.push('signed adapter package does not cover the target canvas');
    if (this.manifest.adapter_id !== bundle.adapter.id || this.manifest.adapter_contract_version !== bundle.adapter.contract_version) errors.push('signed adapter package does not match requested adapter');
    if (!includesOrWildcard(this.manifest.capabilities.source_mime_types, bundle.change.source_artifact.mime)) errors.push('signed adapter package does not accept source MIME type');
    const operations = (bundle.change.operations || []).map(function (item) { return item.type; });
    if (operations.some((item) => !includesOrWildcard(this.manifest.capabilities.operations, item))) errors.push('signed adapter package does not cover all operations');
    let plan = null;
    try { plan = operationPlan(bundle); }
    catch (error) { errors.push(error.message); }
    let sourceDigest = null;
    try { sourceDigest = PackageCodec.sha256File(path.resolve(input.sourcePath || '')); }
    catch (error) { errors.push('staged source file is unreadable'); }
    if (sourceDigest && sourceDigest !== bundle.change.source_artifact.digest) errors.push('staged source bytes do not match approved artifact digest');
    let baseline = null;
    try { baseline = this.captureBaseline(bundle); }
    catch (error) { errors.push(error.message); }
    if (baseline && baseline.digest !== bundle.rollback.snapshot_digest) errors.push('rollback snapshot digest does not match current project baseline');
    return {
      ok: errors.length === 0,
      errors: Array.from(new Set(errors)),
      change_digest: validation.changeDigest,
      package_id: this.manifest.package_id,
      package_signature_verified: this.packageCheck.signature_verified,
      canvas_coverage: coverage,
      source_digest: sourceDigest,
      baseline,
      operation_plan: plan
    };
  }

  prepare(input) {
    const preview = this.preview(input);
    if (!preview.ok) throw new Error(preview.errors.join('; '));
    const bundle = clone(input.bundle);
    const transactionId = this.transactionId(preview.change_digest);
    const journal = this.journalFile(transactionId);
    if (fs.existsSync(journal)) {
      const existing = this.read(transactionId);
      if (existing.change_digest !== preview.change_digest) throw new Error('transaction identifier collision');
      if (TERMINAL.has(existing.state) || ['PREPARING', 'PREPARED', 'APPLIED', 'RECOVERY_REQUIRED'].includes(existing.state)) return existing;
      throw new Error('existing transaction is in non-resumable state ' + existing.state);
    }
    const transactionDir = this.transactionDir(transactionId);
    fs.mkdirSync(transactionDir, { recursive: true });
    const projectFile = this.resolve(bundle.project.project_file);
    const stagedFile = this.resolve(bundle.change.source_artifact.staged_path);
    const snapshotFile = this.resolve(bundle.rollback.snapshot_path);
    const importedFile = this.resolve(preview.operation_plan.imported_path);
    const sourcePath = path.resolve(input.sourcePath);
    if (!PackageCodec.inside(this.workspaceRoot, sourcePath) && input.allowExternalSource !== true) throw new Error('source must already be inside configured workspace');
    let record = {
      schema: TRANSACTION_SCHEMA,
      version: '1.0.0',
      transaction_id: transactionId,
      state: 'NEW',
      bundle_id: bundle.id,
      change_digest: preview.change_digest,
      source_digest: bundle.change.source_artifact.digest,
      target_canvas_digest: bundle.change.target_canvas_digest,
      project_file: bundle.project.project_file,
      staged_path: bundle.change.source_artifact.staged_path,
      imported_path: preview.operation_plan.imported_path,
      snapshot_path: bundle.rollback.snapshot_path,
      created_directories: preview.operation_plan.created_directories,
      refreshed_paths: preview.operation_plan.refreshed_paths,
      metadata: preview.operation_plan.metadata,
      target_canvas: clone(input.targetCanvas),
      baseline: preview.baseline,
      adapter: { id: bundle.adapter.id, application_version: bundle.adapter.application_version },
      adapter_package: {
        package_id: this.manifest.package_id,
        package_version: this.manifest.package_version,
        payload_digest: this.packageCheck.package_payload_digest,
        signature_key_id: this.manifest.signature.key_id,
        signature_verified: true
      },
      created_at: this.clock(),
      updated_at: this.clock(),
      history: [],
      host_receipt: null,
      inspection: null,
      rollback_receipt: null,
      snapshot_captured: false,
      import_materialized: false
    };
    record = this.write(record, 'PREPARING', { write_ahead: true });
    try {
      if (path.resolve(sourcePath) !== path.resolve(stagedFile)) atomicCopy(sourcePath, stagedFile);
      if (PackageCodec.sha256File(stagedFile) !== bundle.change.source_artifact.digest) throw new Error('staged copy digest mismatch');
      if (fs.existsSync(importedFile)) throw new Error('Blender import destination already exists; overwrite is refused');
      if (fs.existsSync(snapshotFile) || fs.existsSync(snapshotFile + '.absent.json')) throw new Error('rollback snapshot destination already exists; overwrite is refused');
      if (preview.baseline.exists) atomicCopy(projectFile, snapshotFile);
      else atomicJson(snapshotFile + '.absent.json', { schema: 'axm.absent-project-snapshot/v1', project_file: bundle.project.project_file, digest: preview.baseline.digest });
      record.snapshot_captured = true;
      preview.operation_plan.created_directories.forEach((relative) => fs.mkdirSync(this.resolve(relative), { recursive: true }));
      atomicCopy(stagedFile, importedFile);
      if (PackageCodec.sha256File(importedFile) !== bundle.change.source_artifact.digest) throw new Error('project-local import copy digest mismatch');
      record.import_materialized = true;
      if (this.faultInjector) this.faultInjector('after-project-materialization-before-prepare-commit', clone(record));
      return this.write(record, 'PREPARED', { source_staged: true, snapshot_captured: true, import_materialized: true });
    } catch (error) {
      record.last_error = String(error.message || error).slice(0, 1000);
      this.write(record, 'RECOVERY_REQUIRED', { phase: 'prepare', error: record.last_error });
      throw error;
    }
  }

  hostInput(record, mode) {
    const transactionDir = this.transactionDir(record.transaction_id);
    const requestFile = path.join(transactionDir, mode + '-request.json');
    const receiptFile = path.join(transactionDir, mode + '-receipt.json');
    const request = {
      schema: 'axm.blender-host-request/v1',
      mode,
      bundle_id: record.bundle_id,
      change_digest: record.change_digest,
      source_digest: record.source_digest,
      source_mime: 'model/gltf-binary',
      source_path: this.resolve(record.imported_path),
      project_file: this.resolve(record.project_file),
      metadata: clone(record.metadata || {}),
      target_canvas: clone(record.target_canvas || {})
    };
    atomicJson(requestFile, request);
    try { fs.unlinkSync(receiptFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return Object.assign(request, { request_file: requestFile, receipt_file: receiptFile });
  }

  buildReceipt(record, inspection) {
    return {
      schema: RECEIPT_SCHEMA,
      version: '1.0.0',
      receipt_id: 'host-receipt-' + record.transaction_id,
      transaction_id: record.transaction_id,
      applied: true,
      independently_verified: true,
      application_version: record.adapter.application_version,
      host_application_version_actual: inspection.blender_version,
      change_digest: record.change_digest,
      rollback_snapshot_digest: record.baseline.digest,
      source_digest: record.source_digest,
      project_digest: inspection.project_digest,
      inspection_digest: PackageCodec.sha256Bytes(Buffer.from(PackageCodec.canonical(inspection), 'utf8')),
      adapter_package_id: record.adapter_package.package_id,
      adapter_package_version: record.adapter_package.package_version,
      adapter_package_digest: record.adapter_package.payload_digest,
      adapter_signature_key_id: record.adapter_package.signature_key_id,
      adapter_package_signature_verified: true,
      host_executable_digest: inspection.host_executable_digest || null,
      host_executable_digest_verified: inspection.host_executable_digest_verified === true,
      applied_at: this.clock()
    };
  }

  inspect(transactionId) {
    let record = this.read(transactionId);
    if (!['APPLIED', 'INSPECTED', 'RECOVERY_REQUIRED', 'APPLYING'].includes(record.state)) throw new Error('transaction cannot be inspected in state ' + record.state);
    const inspection = this.driver.inspect(this.hostInput(record, 'inspect'));
    const projectDigest = PackageCodec.sha256File(this.resolve(record.project_file));
    const performance = record.target_canvas && record.target_canvas.performance || {};
    const metadataOk = PackageCodec.canonical(inspection.axm_metadata || {}) === PackageCodec.canonical(record.metadata || {});
    const budgetOk = (performance.max_file_bytes == null || fs.statSync(this.resolve(record.project_file)).size <= performance.max_file_bytes) &&
      (performance.max_polygon_count == null || inspection.polygons <= performance.max_polygon_count) &&
      (performance.max_vertices == null || inspection.vertices <= performance.max_vertices);
    const ok = inspection.ok && inspection.project_digest === projectDigest && inspection.axm_change_digest === record.change_digest && inspection.axm_source_digest === record.source_digest && inspection.matching_object_count > 0 && metadataOk && budgetOk;
    if (!ok) {
      record.inspection = clone(inspection);
      record.recovery_project_digest = projectDigest;
      this.write(record, 'RECOVERY_REQUIRED', { reason: 'independent inspection, metadata or canvas-budget mismatch', metadata_ok: metadataOk, budget_ok: budgetOk });
      throw new Error('independent native project inspection mismatch');
    }
    inspection.independent_process = true;
    inspection.project_digest = projectDigest;
    record.inspection = clone(inspection);
    record.host_receipt = this.buildReceipt(record, inspection);
    return this.write(record, 'INSPECTED', { inspection_digest: record.host_receipt.inspection_digest });
  }

  apply(transactionId) {
    let record = this.read(transactionId);
    if (record.state === 'INSPECTED') return clone(record.host_receipt);
    if (record.state !== 'PREPARED') throw new Error('transaction cannot apply in state ' + record.state);
    record = this.write(record, 'APPLYING', { write_ahead: true });
    try {
      const applied = this.driver.apply(this.hostInput(record, 'apply'));
      record.native_apply = clone(applied);
      record.recovery_project_digest = PackageCodec.sha256File(this.resolve(record.project_file));
      if (this.faultInjector) this.faultInjector('after-native-save-before-commit', clone(record));
      record = this.write(record, 'APPLIED', { project_digest: record.recovery_project_digest });
      record = this.inspect(record.transaction_id);
      return clone(record.host_receipt);
    } catch (error) {
      record = this.read(transactionId);
      if (fs.existsSync(this.resolve(record.project_file))) record.recovery_project_digest = PackageCodec.sha256File(this.resolve(record.project_file));
      record.last_error = String(error.message || error).slice(0, 1000);
      this.write(record, 'RECOVERY_REQUIRED', { error: record.last_error });
      throw error;
    }
  }

  rollback(transactionId) {
    let record = this.read(transactionId);
    if (record.state === 'ROLLED_BACK') return clone(record.rollback_receipt);
    if (!['PREPARING', 'PREPARED', 'APPLYING', 'APPLIED', 'INSPECTED', 'RECOVERY_REQUIRED'].includes(record.state)) throw new Error('transaction is not rollback eligible in state ' + record.state);
    const projectFile = this.resolve(record.project_file);
    if (fs.existsSync(projectFile) && record.recovery_project_digest && PackageCodec.sha256File(projectFile) !== record.recovery_project_digest && (!record.host_receipt || PackageCodec.sha256File(projectFile) !== record.host_receipt.project_digest)) {
      throw new Error('rollback blocked: native project changed after transaction');
    }
    if (record.baseline.exists) {
      const currentIsBaseline = fs.existsSync(projectFile) && PackageCodec.sha256File(projectFile) === record.baseline.digest;
      if (!currentIsBaseline) {
        const snapshotFile = this.resolve(record.snapshot_path);
        if (!fs.existsSync(snapshotFile)) throw new Error('rollback blocked: baseline snapshot was not captured');
        atomicCopy(snapshotFile, projectFile);
      }
    } else if (fs.existsSync(projectFile)) {
      const knownCreatedProject = record.recovery_project_digest || record.host_receipt && record.host_receipt.project_digest;
      if (!knownCreatedProject) throw new Error('rollback blocked: an untracked project appeared during preparation');
      fs.unlinkSync(projectFile);
    }
    const importedFile = this.resolve(record.imported_path);
    if (fs.existsSync(importedFile)) {
      if (PackageCodec.sha256File(importedFile) !== record.source_digest) throw new Error('rollback blocked: project-local imported asset changed after transaction');
      fs.unlinkSync(importedFile);
    }
    (record.created_directories || []).slice().reverse().forEach((relative) => {
      const directory = this.resolve(relative);
      if (fs.existsSync(directory) && fs.statSync(directory).isDirectory() && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
    });
    const restored = baselineDigest(projectFile, record.project_file);
    if (restored !== record.baseline.digest) throw new Error('rollback restoration digest mismatch');
    record.rollback_receipt = {
      schema: 'axm.native-host-rollback-receipt/v1',
      transaction_id: record.transaction_id,
      ok: true,
      restored_digest: restored,
      removed_created_project: !record.baseline.exists,
      rolled_back_at: this.clock()
    };
    record = this.write(record, 'ROLLED_BACK', { restored_digest: restored });
    return clone(record.rollback_receipt);
  }

  listRecoveryRequired() {
    if (!fs.existsSync(this.transactionsRoot)) return [];
    return fs.readdirSync(this.transactionsRoot, { withFileTypes: true }).filter(function (item) { return item.isDirectory(); }).map((item) => {
      try { return this.read(item.name); } catch (error) { return null; }
    }).filter(function (item) { return item && ['PREPARING', 'APPLYING', 'RECOVERY_REQUIRED'].includes(item.state); }).map(function (item) {
      return { transaction_id: item.transaction_id, state: item.state, project_file: item.project_file, last_error: item.last_error || null };
    });
  }
}

module.exports = {
  NativeHostRuntime,
  TRANSACTION_SCHEMA,
  RECEIPT_SCHEMA,
  baselineDigest,
  canvasCoverage,
  atomicJson,
  operationPlan,
  boundedMetadata
};
