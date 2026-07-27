'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Core = require('./core');
const Toolchain = require('./toolchain');
const Ktx2Glb = require('./ktx2-glb');

const MODULE_ROOT = __dirname;
const WORKSHOP_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_VAULT_ROOT = path.join(__dirname, 'work');

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeNewJson(file, value) {
  ensureDirectory(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
}

function writeNewBytes(file, value) {
  ensureDirectory(path.dirname(file));
  fs.writeFileSync(file, value, { flag: 'wx' });
}

function gap(code, type, required, reason, unblock) {
  return { code, type, required, reason, unblock };
}

function processEvidence(execution) {
  return {
    exit_status: execution.status,
    error: execution.error,
    stdout_sha256: execution.stdout_sha256,
    stderr_sha256: execution.stderr_sha256
  };
}

function runBlender(tool, source, output, script) {
  return Toolchain.capture(tool.command, ['--background', source, '--python', script, '--', '--output', output], { cwd: path.dirname(source) });
}

function runValidator(tool, input) {
  return Toolchain.capture(tool.command, ['-o', '--no-write-timestamp', '--no-absolute-path', input], { cwd: path.dirname(input) });
}

function runOptimizer(tools, input, output) {
  if (tools.transform.available) {
    return { engine: 'gltf-transform', execution: Toolchain.capture(tools.transform.command, ['meshopt', input, output, '--level', 'medium'], { cwd: path.dirname(output) }) };
  }
  if (tools.gltfpack.available) {
    return { engine: 'gltfpack', execution: Toolchain.capture(tools.gltfpack.command, ['-i', input, '-o', output, '-cc', '-ke'], { cwd: path.dirname(output) }) };
  }
  return null;
}

function parseValidatorReport(execution) {
  try {
    return JSON.parse(execution.stdout);
  } catch (error) {
    return { parse_error: error.message, stdout_sha256: execution.stdout_sha256 };
  }
}

function validatorCounts(report) {
  const messages = report && report.issues && report.issues.messages || [];
  const countBySeverity = severity => messages.filter(item => item.severity === severity).length;
  return { errors: countBySeverity(0), warnings: countBySeverity(1), infos: countBySeverity(2), hints: countBySeverity(3), total: messages.length };
}

function stageBlocked(id, code, type, reason, unblock, extra = {}) {
  return Core.stage(id, 'BLOCKED', Object.assign({ gaps: [gap(code, type, true, reason, unblock)] }, extra));
}

async function run(request, options = {}) {
  const checked = Core.validateRequest(request);
  if (!checked.pass) throw new Error('invalid build request: ' + checked.errors.join('; '));
  const workspaceRoot = path.resolve(options.workspaceRoot || WORKSHOP_ROOT);
  const vaultRoot = path.resolve(options.vaultRoot || DEFAULT_VAULT_ROOT);
  const outputRelative = Core.cleanRelative(request.output_root, 'output_root');
  const outputRoot = Core.resolveInside(vaultRoot, outputRelative, 'output_root');
  if (fs.existsSync(outputRoot)) throw new Error('refusing to overwrite existing job output: ' + outputRelative);
  ensureDirectory(outputRoot);
  const sourcePath = Core.resolveInside(workspaceRoot, request.source.path, 'source.path');
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) throw new Error('source file does not exist: ' + request.source.path);
  const sourceDigest = Core.fileDigest(sourcePath);
  const discovered = await Toolchain.discover(request.tool_overrides || {});
  const tools = discovered.tools;
  const stages = [];
  const artifacts = [];
  const receiptsRoot = path.join(outputRoot, 'receipts');
  const runtimeRoot = path.join(outputRoot, 'runtime');
  const textureRoot = path.join(runtimeRoot, 'textures');
  ensureDirectory(receiptsRoot);
  ensureDirectory(runtimeRoot);

  stages.push(Core.stage('source-integrity', 'PASS', {
    evidence: [{ kind: 'sha256', value: sourceDigest }, { kind: 'portable-path', value: request.source.path }],
    detail: { source_kind: request.source.kind, source_bytes: fs.statSync(sourcePath).size, source_path_retained: false }
  }));
  writeNewJson(path.join(receiptsRoot, 'source-integrity.json'), {
    schema: 'axm.modern-asset-forge.source-integrity-receipt/v1',
    asset_id: request.job_id,
    source: {
      kind: request.source.kind,
      relative_path: request.source.path,
      sha256: sourceDigest,
      bytes: fs.statSync(sourcePath).size,
      license: request.source.license || 'UNDECLARED',
      source_url: request.source.source_url || null
    },
    private_location_retained: false
  });

  let currentGlb = null;
  if (request.source.kind === 'blend') {
    if (!tools.blender.available) {
      stages.push(stageBlocked('blender-export', 'MF-P1-BLENDER', 'SUBSTRATE', tools.blender.reason, 'Install and live-probe the pinned Blender substrate, or provide an explicitly approved executable override.'));
    } else {
      const target = path.join(runtimeRoot, request.job_id + '.export.glb');
      const execution = runBlender(tools.blender, sourcePath, target, path.join(__dirname, 'scripts', 'blender-export.py'));
      const pass = !execution.error && execution.status === 0 && fs.existsSync(target) && fs.statSync(target).size > 20;
      stages.push(Core.stage('blender-export', pass ? (tools.blender.status === 'READY' ? 'PASS' : 'DEGRADED') : 'FAIL', {
        evidence: [processEvidence(execution)],
        gaps: tools.blender.status === 'READY' ? [] : [gap('MF-P1-BLENDER-PIN', 'EVIDENCE', true, 'Blender ran from an unpinned PATH or override.', 'Bind the executable to the reviewed substrate lock and rerun.')],
        detail: { output_created: pass, private_location_retained: false }
      }));
      if (pass) currentGlb = target;
    }
  } else {
    const target = path.join(runtimeRoot, request.job_id + '.diagnostic-source.glb');
    fs.copyFileSync(sourcePath, target, fs.constants.COPYFILE_EXCL);
    currentGlb = target;
    stages.push(Core.stage('blender-export', 'SKIPPED', {
      evidence: [{ kind: 'source-kind', value: 'glb' }],
      gaps: [gap('MF-P1-AUTHORING-TRUTH', 'EVIDENCE', request.mode === 'canonical_build', 'A supplied GLB does not prove the required .blend authoring source or Blender export.', 'Run canonical_build from a preserved .blend source.')],
      detail: { counts_as_canonical_export_evidence: false }
    }));
  }

  let structural = null;
  if (!currentGlb) {
    stages.push(stageBlocked('axm-glb-inspection', 'MF-P1-NO-GLB', 'CONTRACT', 'No GLB exists because the export stage did not complete.', 'Satisfy the Blender export substrate and rerun.'));
  } else {
    structural = Core.inspectGlb(fs.readFileSync(currentGlb));
    stages.push(Core.stage('axm-glb-inspection', structural.pass ? 'PASS' : 'FAIL', {
      evidence: [{ kind: 'axm-glb-inspection', digest: Core.sha256(Core.stableStringify({ pass: structural.pass, errors: structural.errors, warnings: structural.warnings, metrics: structural.metrics })) }],
      detail: { errors: structural.errors, warnings: structural.warnings, metrics: structural.metrics, scope: 'structural-and-metric-inspection-not-khronos-certification' }
    }));
    writeNewJson(path.join(receiptsRoot, 'axm-glb-inspection.json'), {
      schema: 'axm.modern-asset-forge.glb-inspection/v1', version: '1.0.0', status: structural.pass ? 'PASS' : 'FAIL',
      artifact_sha256: Core.fileDigest(currentGlb), errors: structural.errors, warnings: structural.warnings, metrics: structural.metrics,
      validator: { id: 'modern-asset-forge-glb-inspector', version: '1.0.0', scope: 'bounded-structural-and-metric-inspection' }
    });
  }

  if (!currentGlb) {
    stages.push(stageBlocked('khronos-gltf-validation', 'MF-P1-VALIDATOR-UPSTREAM', 'SUBSTRATE', 'No GLB is available for the Khronos validator.', 'Complete export first.'));
  } else if (!tools.validator.available) {
    stages.push(stageBlocked('khronos-gltf-validation', 'MF-P1-VALIDATOR', 'SUBSTRATE', tools.validator.reason, 'Install and live-probe the pinned Khronos glTF Validator substrate, or provide an approved executable override.'));
  } else {
    const execution = runValidator(tools.validator, currentGlb);
    const report = parseValidatorReport(execution);
    const counts = validatorCounts(report);
    const pass = !execution.error && execution.status === 0 && !report.parse_error && counts.errors === 0;
    stages.push(Core.stage('khronos-gltf-validation', pass ? (tools.validator.status === 'READY' ? 'PASS' : 'DEGRADED') : 'FAIL', {
      evidence: [processEvidence(execution), { kind: 'khronos-report', digest: Core.sha256(Core.stableStringify(report)) }],
      gaps: tools.validator.status === 'READY' ? [] : [gap('MF-P1-VALIDATOR-PIN', 'EVIDENCE', true, 'Validator ran from an unpinned PATH or override.', 'Bind it to the reviewed substrate lock.')],
      detail: { issue_counts: counts, report_parse_error: report.parse_error || null }
    }));
    writeNewJson(path.join(receiptsRoot, 'khronos-gltf-validator.json'), { schema: 'axm.modern-asset-forge.external-validator-receipt/v1', status: pass ? 'PASS' : 'FAIL', tool: Toolchain.publicTool(tools.validator), process: processEvidence(execution), issue_counts: counts, report, private_location_retained: false });
  }

  let canonicalCandidate = null;
  if (!currentGlb) {
    stages.push(stageBlocked('meshopt-optimization', 'MF-P1-OPTIMIZER-UPSTREAM', 'SUBSTRATE', 'No validated GLB is available to optimize.', 'Complete export and validation first.'));
  } else {
    const optimizer = runOptimizer(tools, currentGlb, path.join(runtimeRoot, request.job_id + '.meshopt.glb'));
    if (!optimizer) {
      stages.push(stageBlocked('meshopt-optimization', 'MF-P1-OPTIMIZER', 'SUBSTRATE', 'Neither glTF Transform nor gltfpack is installed or configured.', 'Install one reviewed optimizer without changing the meshopt requirement, then rerun.'));
    } else {
      const target = path.join(runtimeRoot, request.job_id + '.meshopt.glb');
      const pass = !optimizer.execution.error && optimizer.execution.status === 0 && fs.existsSync(target) && Core.inspectGlb(fs.readFileSync(target)).pass;
      stages.push(Core.stage('meshopt-optimization', pass ? 'DEGRADED' : 'FAIL', {
        evidence: [processEvidence(optimizer.execution)],
        gaps: pass ? [gap('MF-P1-OPTIMIZER-PIN', 'EVIDENCE', true, optimizer.engine + ' ran but is not pinned by the current substrate lock.', 'Add a reviewed exact artifact, version probe, and license record before canonical promotion.')] : [],
        detail: { engine: optimizer.engine, output_created: pass, source_bytes: fs.statSync(currentGlb).size, output_bytes: pass ? fs.statSync(target).size : null }
      }));
      if (pass) canonicalCandidate = target;
    }
  }

  const textureArtifacts = [];
  const textureBindings = [];
  if (!(request.textures || []).length) {
    stages.push(stageBlocked('ktx2-encode', 'MF-P1-TEXTURE-INPUT', 'CONTRACT', 'No PNG texture sources were declared, so KTX2 delivery cannot be proven.', 'Declare bounded PNG base-color, normal, ORM, or emissive inputs with explicit color-space roles.'));
  } else if (!tools.basis.available) {
    stages.push(stageBlocked('ktx2-encode', 'MF-P1-BASIS', 'SUBSTRATE', tools.basis.reason, 'Restore the pinned bundled Basis Universal engine and rerun.'));
  } else {
    const results = [];
    for (const [textureOrder, texture] of request.textures.entries()) {
      const input = Core.resolveInside(workspaceRoot, texture.path, 'texture.path');
      if (!fs.existsSync(input)) throw new Error('texture source does not exist: ' + texture.path);
      const pngBytes = fs.readFileSync(input);
      const encoded = await Toolchain.KTX2.encodePng(pngBytes, {
        colourSpace: texture.colour_space,
        transparency: texture.transparency || 'opaque',
        tileable: texture.tileable === true,
        maxMipLevels: texture.max_mip_levels || 12,
        quality: texture.quality || 180,
        effort: 3
      });
      const filename = String(textureOrder + 1).padStart(2, '0') + '-' + path.basename(texture.path, path.extname(texture.path)) + '.ktx2';
      const target = path.join(textureRoot, filename);
      writeNewBytes(target, encoded.bytes);
      const validation = await Toolchain.KTX2.validate(encoded.bytes, { includePixels: false });
      const result = { role: texture.role, colour_space: texture.colour_space, target_texture_index: texture.target_texture_index == null ? null : texture.target_texture_index, source_sha256: Core.fileDigest(input), output_sha256: Core.fileDigest(target), output_bytes: encoded.byteLength, width: encoded.width, height: encoded.height, levels: encoded.mipPlan.levels, validation_pass: validation.pass, supercompression: validation.structural.supercompressionName };
      results.push(result);
      textureArtifacts.push({ id: 'texture-' + results.length, role: texture.role, relative_path: path.relative(outputRoot, target).replace(/\\/g, '/'), mime: 'image/ktx2', sha256: result.output_sha256, bytes: result.output_bytes, canonical: false });
      if (validation.pass && Number.isInteger(texture.target_texture_index)) textureBindings.push({ targetTextureIndex: texture.target_texture_index, bytes: Buffer.from(encoded.bytes), name: texture.role + '-' + texture.target_texture_index });
    }
    const pass = results.every(item => item.validation_pass);
    stages.push(Core.stage('ktx2-encode', pass ? 'PASS' : 'FAIL', {
      evidence: results.map(item => ({ kind: 'basis-encode-and-decode', digest: Core.sha256(Core.stableStringify(item)) })),
      detail: { textures: results, profile: 'ETC1S-BasisLZ-bounded' }
    }));
    writeNewJson(path.join(receiptsRoot, 'ktx2-bundled-validation.json'), { schema: 'axm.modern-asset-forge.ktx2-bundled-validation/v1', status: pass ? 'PASS' : 'FAIL', engine: { name: 'Basis Universal', version: Toolchain.KTX2.BASIS_VERSION, profile: 'ETC1S BasisLZ' }, textures: results });
  }

  let integratedCandidate = null;
  if (!textureArtifacts.length) {
    stages.push(stageBlocked('ktx2-gltf-integration', 'MF-P1-KTX2-INTEGRATION-UPSTREAM', 'CONTRACT', 'No encoded KTX2 texture is available for GLB integration.', 'Complete the KTX2 encoding stage first.'));
  } else if (!canonicalCandidate) {
    stages.push(stageBlocked('ktx2-gltf-integration', 'MF-P1-KTX2-INTEGRATION-GLB', 'CONTRACT', 'No optimized GLB candidate is available for KHR_texture_basisu integration.', 'Complete the optimizer stage, then integrate and revalidate GLB texture references.'));
  } else if (textureBindings.length !== textureArtifacts.length) {
    stages.push(stageBlocked('ktx2-gltf-integration', 'MF-P1-KTX2-TARGET', 'CONTRACT', 'Every encoded texture requires an explicit target_texture_index before it can replace a GLB texture honestly.', 'Declare a unique target_texture_index for every texture and rerun.'));
  } else {
    try {
      const target = path.join(runtimeRoot, request.job_id + '.meshopt-ktx2.glb');
      const bound = Ktx2Glb.bind(fs.readFileSync(canonicalCandidate), textureBindings);
      writeNewBytes(target, bound.bytes);
      writeNewJson(path.join(receiptsRoot, 'ktx2-glb-binding.json'), bound.receipt);
      integratedCandidate = target;
      stages.push(Core.stage('ktx2-gltf-integration', 'PASS', {
        evidence: [{ kind: 'binding-receipt', digest: Core.sha256(Core.stableStringify(bound.receipt)) }],
        detail: { output_created: true, output_sha256: bound.receipt.output_glb_sha256, mappings: bound.receipt.mappings, fallback_sources_removed: true }
      }));
    } catch (error) {
      stages.push(Core.stage('ktx2-gltf-integration', 'FAIL', { detail: { error: error.message, output_created: false } }));
    }
  }

  if (!integratedCandidate) {
    stages.push(stageBlocked('khronos-post-integration-validation', 'MF-P1-POST-VALIDATION-UPSTREAM', 'CONTRACT', 'No KTX2-integrated GLB is available for final Khronos validation.', 'Complete KTX2 GLB integration first.'));
  } else if (!tools.validator.available) {
    stages.push(stageBlocked('khronos-post-integration-validation', 'MF-P1-POST-VALIDATOR', 'SUBSTRATE', tools.validator.reason, 'Restore the pinned Khronos glTF Validator and rerun.'));
  } else {
    const execution = runValidator(tools.validator, integratedCandidate);
    const report = parseValidatorReport(execution);
    const counts = validatorCounts(report);
    const pass = !execution.error && execution.status === 0 && !report.parse_error && counts.errors === 0;
    stages.push(Core.stage('khronos-post-integration-validation', pass ? (tools.validator.status === 'READY' ? 'PASS' : 'DEGRADED') : 'FAIL', {
      evidence: [processEvidence(execution), { kind: 'khronos-report', digest: Core.sha256(Core.stableStringify(report)) }],
      detail: { issue_counts: counts, artifact_sha256: Core.fileDigest(integratedCandidate) }
    }));
    writeNewJson(path.join(receiptsRoot, 'khronos-post-integration-validator.json'), { schema: 'axm.modern-asset-forge.external-validator-receipt/v1', status: pass ? 'PASS' : 'FAIL', tool: Toolchain.publicTool(tools.validator), process: processEvidence(execution), issue_counts: counts, report, private_location_retained: false });
    if (!pass) integratedCandidate = null;
  }

  if (integratedCandidate) canonicalCandidate = integratedCandidate;

  if (!textureArtifacts.length) {
    stages.push(stageBlocked('khronos-ktx-validation', 'MF-P1-KTX-VALIDATOR-UPSTREAM', 'CONTRACT', 'No KTX2 output is available for independent validation.', 'Complete KTX2 encoding first.'));
  } else if (!tools.ktx.available) {
    stages.push(stageBlocked('khronos-ktx-validation', 'MF-P1-KTX-VALIDATOR', 'SUBSTRATE', tools.ktx.reason, 'Install and live-probe the pinned Khronos KTX tools substrate, then run ktx validate --gltf-basisu.'));
  } else {
    const validations = textureArtifacts.map(item => {
      const file = path.join(outputRoot, item.relative_path);
      const execution = Toolchain.capture(tools.ktx.command, ['validate', '--gltf-basisu', '--format', 'json', file], { cwd: path.dirname(file) });
      return { artifact_sha256: item.sha256, pass: !execution.error && execution.status === 0, process: processEvidence(execution) };
    });
    stages.push(Core.stage('khronos-ktx-validation', validations.every(item => item.pass) ? (tools.ktx.status === 'READY' ? 'PASS' : 'DEGRADED') : 'FAIL', { evidence: validations }));
  }

  const smokeGlb = canonicalCandidate || currentGlb;
  if (!smokeGlb) {
    stages.push(stageBlocked('browser-webgl2-smoke', 'MF-P1-BROWSER-UPSTREAM', 'CONTRACT', 'No GLB is available for the browser smoke page.', 'Complete export first.'));
  } else {
    const relativeGlb = path.relative(outputRoot, smokeGlb).replace(/\\/g, '/');
    const token = crypto.randomBytes(12).toString('hex');
    const plan = {
      schema: 'axm.modern-asset-forge.browser-smoke-plan/v1',
      job_id: request.job_id,
      token,
      asset_url: '/builds/' + outputRelative.replace(/\\/g, '/') + '/' + relativeGlb,
      asset_sha256: Core.fileDigest(smokeGlb),
      evidence_role: canonicalCandidate ? 'optimized-candidate-load' : 'diagnostic-unoptimized-load',
      counts_as_canonical_delivery: false,
      expected_renderer: 'WebGL2',
      human_visual_approval_required: true
    };
    plan.extensions_used = Core.inspectGlb(fs.readFileSync(smokeGlb)).metrics.extensions_used;
    writeNewJson(path.join(outputRoot, 'smoke-plan.json'), plan);
    const browserRuntimeGaps = [];
    if (!tools.browser.available) browserRuntimeGaps.push(gap('MF-P1-BROWSER-DECODERS', 'SUBSTRATE', true, tools.browser.reason, 'Restore the pinned AXM browser 3D runtime and rerun.'));
    stages.push(Core.stage('browser-webgl2-smoke', 'PREPARED', {
      evidence: [{ kind: 'smoke-plan', digest: Core.sha256(Core.stableStringify(plan)) }],
      gaps: browserRuntimeGaps.concat([gap('MF-P1-BROWSER-OBSERVATION', 'EVIDENCE', true, 'The page is prepared but has not yet produced a live browser receipt.', 'Open the smoke URL and retain its load/render receipt plus human visual review decision.')]),
      detail: { smoke_url: '/smoke.html?job=' + encodeURIComponent(request.job_id), evidence_role: plan.evidence_role, counts_as_canonical_delivery: false }
    }));
  }

  if (currentGlb) artifacts.push({
    id: 'glb-' + request.job_id,
    role: integratedCandidate ? 'compressed-browser-candidate' : canonicalCandidate ? 'pre-ktx2-optimized-candidate' : 'diagnostic-unoptimized-smoke-input',
    relative_path: path.relative(outputRoot, canonicalCandidate || currentGlb).replace(/\\/g, '/'),
    mime: 'model/gltf-binary', sha256: Core.fileDigest(canonicalCandidate || currentGlb), bytes: fs.statSync(canonicalCandidate || currentGlb).size,
    canonical: false
  });
  artifacts.push(...textureArtifacts);
  const status = Core.aggregateStatus(stages);
  const manifest = {
    schema: Core.ASSET_MANIFEST_SCHEMA, version: '1.0.0', asset_id: request.job_id, status,
    source: { kind: request.source.kind, relative_path: request.source.path, sha256: sourceDigest, license: request.source.license || 'UNDECLARED', source_url: request.source.source_url || null, authoring_truth_proven: request.source.kind === 'blend' && stages.some(item => item.id === 'blender-export' && item.status === 'PASS') },
    delivery_policy: request.delivery, artifacts,
    canonical_runtime_artifact_id: null,
    notes: ['No artifact becomes canonical until every required Phase 1 stage passes and human visual approval is recorded.', 'Paths are portable relative paths; private executable and vault roots are omitted.']
  };
  manifest.digest = Core.sha256(Core.stableStringify(manifest));
  const receipt = {
    schema: Core.BUILD_RECEIPT_SCHEMA, version: '1.0.0', job_id: request.job_id, mode: request.mode, workload_mode: request.workload_mode, status,
    output_root: outputRelative, source_sha256: sourceDigest,
    toolchain: Object.fromEntries(Object.entries(tools).map(([key, value]) => [key, Toolchain.publicTool(value)])),
    capability_inventory_digest: discovered.inventory.digest,
    stages,
    outputs: artifacts,
    canonical_delivery_emitted: false,
    automatic_installation: false,
    network_access_performed: false,
    private_location_retained: false
  };
  receipt.digest = Core.sha256(Core.stableStringify(receipt));
  writeNewJson(path.join(outputRoot, 'asset-manifest.json'), manifest);
  writeNewJson(path.join(outputRoot, 'build-receipt.json'), receipt);
  writeNewJson(path.join(outputRoot, 'capability-inventory.json'), discovered.inventory);
  return { outputRoot, manifest, receipt, capabilityInventory: discovered.inventory };
}

module.exports = { MODULE_ROOT, WORKSHOP_ROOT, DEFAULT_VAULT_ROOT, run, writeNewJson };
