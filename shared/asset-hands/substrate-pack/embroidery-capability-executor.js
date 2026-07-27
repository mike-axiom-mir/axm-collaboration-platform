'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Softgoods = require('../upgrade-program/softgoods-production');
const Pack = require('./pack-core');

const RECEIPT_SCHEMA = 'axm.embroidery-capability-receipt/v1';
const RECIPE = Object.freeze({
  schema: 'axm.embroidery-capability-recipe/v1',
  format: 'Tajima DST',
  units: 'millimetres',
  paths: [
    { thread: 'red-40wt', density_stitches_per_mm: 1.2, pull_compensation_mm: 0.2, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }] },
    { thread: 'blue-40wt', density_stitches_per_mm: 1, pull_compensation_mm: 0.1, points: [{ x: 20, y: 20 }, { x: 0, y: 20 }] },
  ],
  machine_limits: { max_stitches: 10000, max_colours: 4, max_delta_tenths_mm: 121 },
  repetitions: 2,
});

const SCRIPT = String.raw`import hashlib
import json
import math
import os
import sys
import pyembroidery as p

source = sys.argv[1]
svg = sys.argv[2]
strict = sys.argv[3] == "strict"
pattern = p.read_dst(source)
stitches = pattern.stitches
commands = [int(stitch[2]) & p.COMMAND_MASK for stitch in stitches]
movement = []
previous = (0.0, 0.0)
maximum_delta = 0.0
for stitch, command in zip(stitches, commands):
    point = (float(stitch[0]), float(stitch[1]))
    if command in (p.STITCH, p.JUMP, p.SEQUIN_EJECT):
        maximum_delta = max(maximum_delta, math.dist(previous, point))
        movement.append([round(point[0], 6), round(point[1], 6), command])
        previous = point
bounds = tuple(float(value) for value in pattern.bounds()) if stitches else (0.0, 0.0, 0.0, 0.0)
metrics = {
    "stitch_records": len(stitches),
    "stitch_commands": sum(1 for command in commands if command == p.STITCH),
    "jump_commands": sum(1 for command in commands if command == p.JUMP),
    "trim_commands": sum(1 for command in commands if command == p.TRIM),
    "colour_changes": sum(1 for command in commands if command == p.COLOR_CHANGE),
    "end_commands": sum(1 for command in commands if command == p.END),
    "bounds_tenths_mm": [round(value, 6) for value in bounds],
    "maximum_delta_tenths_mm": round(maximum_delta, 6),
    "movement_digest": hashlib.sha256(json.dumps(movement, separators=(",", ":")).encode("utf-8")).hexdigest(),
}
valid = metrics["stitch_commands"] >= 20 and metrics["colour_changes"] == 1 and metrics["end_commands"] >= 1 and metrics["maximum_delta_tenths_mm"] <= 121
metrics["valid_machine_pattern"] = valid
if valid:
    pattern.threadlist.clear()
    pattern.add_thread("#d7263d")
    pattern.add_thread("#1b6ca8")
    p.write_svg(pattern, svg)
    metrics["simulation_bytes"] = os.path.getsize(svg)
    metrics["simulation_digest"] = hashlib.sha256(open(svg, "rb").read()).hexdigest()
else:
    metrics["simulation_bytes"] = 0
    metrics["simulation_digest"] = None
print("AXM_EMBROIDERY_CAPABILITY:" + json.dumps(metrics, sort_keys=True, separators=(",", ":")))
if strict and not valid:
    raise SystemExit(2)
`;

function capture(command, args, job, label) {
  const stdoutFile = path.join(job, label + '-stdout.txt');
  const stderrFile = path.join(job, label + '-stderr.txt');
  const out = fs.openSync(stdoutFile, 'wx');
  const err = fs.openSync(stderrFile, 'wx');
  let result;
  try {
    result = childProcess.spawnSync(command, args, { windowsHide: true, shell: false, timeout: 30000, stdio: ['ignore', out, err] });
  } finally { fs.closeSync(out); fs.closeSync(err); }
  const stdout = fs.readFileSync(stdoutFile); const stderr = fs.readFileSync(stderrFile);
  if (stdout.length > 4 * 1024 * 1024 || stderr.length > 4 * 1024 * 1024) throw new Error('embroidery capability output exceeds bounds');
  return { status: result.status, error: result.error && (result.error.code || 'PROCESS_ERROR'), stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'), process: { status: result.status, error: result.error && (result.error.code || 'PROCESS_ERROR') || null, stdout_digest: Pack.sha256(stdout), stderr_digest: Pack.sha256(stderr) } };
}

function parse(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find((item) => item.startsWith('AXM_EMBROIDERY_CAPABILITY:'));
  if (!line) return null;
  try { return JSON.parse(line.slice('AXM_EMBROIDERY_CAPABILITY:'.length)); } catch (error) { return null; }
}

function cleanDiagnostic(execution) {
  return Pack.cleanText((execution.stderr + '\n' + execution.stdout).split(/\r?\n/).filter((line) => /error|invalid|failed|traceback/i.test(line)).slice(-20).join('\n'), 3000) || null;
}

function createExecutor(options) {
  options = options || {};
  const root = Pack.assertSafeRoot(options.root || Pack.defaultRoot());
  const lock = options.lock || Pack.loadLock(options.lockPath);
  const identity = Object.freeze({ kind: 'independent-parser-simulator', fresh_process: true, id: 'axm-pyembroidery-capability-matrix', version: '1.0.0', host: 'pyembroidery', network: false, repetitions: 2, retains_design: false });
  function resolve() { return Pack.resolveRequest({ id: 'pyembroidery' }, { root, lock, inventory: options.inventory }); }
  function run() {
    const resolution = resolve();
    if (resolution.status !== 'READY') return { schema: RECEIPT_SCHEMA, version: '1.0.0', status: 'MISSING_SUBSTRATE', missing: resolution.missing || ['pyembroidery'], identity, private_location_retained: false };
    const jobRoot = path.resolve(root, '.jobs'); fs.mkdirSync(jobRoot, { recursive: true });
    const job = path.join(jobRoot, 'embroidery-capabilities-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
    if (!job.startsWith(jobRoot + path.sep)) throw new Error('embroidery capability job escaped root');
    fs.mkdirSync(job, { recursive: false });
    try {
      const source = Softgoods.createEmbroidery({ name: 'AXM-HANDS', max_stitch_mm: 4, paths: RECIPE.paths, machine_limits: RECIPE.machine_limits });
      const dst = Buffer.from(source.dst_base64, 'base64');
      const sourceFile = path.join(job, 'source.dst');
      const invalidFile = path.join(job, 'invalid.dst');
      const scriptFile = path.join(job, 'inspect.py');
      fs.writeFileSync(sourceFile, dst, { flag: 'wx' });
      fs.writeFileSync(invalidFile, Buffer.alloc(128, 0x20), { flag: 'wx' });
      fs.writeFileSync(scriptFile, SCRIPT, { flag: 'wx' });
      const python = Pack.entrypointPath(root, Pack.entryById(lock, 'python-cpython'), 'python');
      const runs = ['a', 'b'].map((label) => {
        const svg = path.join(job, 'simulation-' + label + '.svg');
        const execution = capture(python, [scriptFile, sourceFile, svg, 'strict'], job, 'parse-' + label);
        const metrics = parse(execution.stdout);
        return { label, process: execution.process, process_pass: execution.status === 0 && !execution.error && !!metrics, metrics, diagnostic: cleanDiagnostic(execution) };
      });
      const invalidSvg = path.join(job, 'invalid.svg');
      const invalidExecution = capture(python, [scriptFile, invalidFile, invalidSvg, 'strict'], job, 'invalid');
      const invalidMetrics = parse(invalidExecution.stdout);
      const invalidRejected = invalidExecution.status !== 0 && !invalidExecution.error && invalidMetrics && invalidMetrics.valid_machine_pattern === false && !fs.existsSync(invalidSvg);
      const valid = (run) => run.process_pass && run.metrics.valid_machine_pattern === true && run.metrics.stitch_commands >= 20 && run.metrics.colour_changes === 1 && run.metrics.end_commands >= 1 && run.metrics.maximum_delta_tenths_mm <= RECIPE.machine_limits.max_delta_tenths_mm && run.metrics.simulation_bytes > 100 && /^[a-f0-9]{64}$/.test(run.metrics.simulation_digest || '');
      const checks = [
        { name: 'source-dst-bound-to-production-hand', pass: source.status === 'TECHNICAL_PASS_INDEPENDENT_MACHINE_VALIDATION_REQUIRED' && Pack.sha256(dst) === source.dst_digest },
        { name: 'two-fresh-parser-simulator-processes', pass: runs.every(valid) },
        { name: 'colour-change-preserved', pass: runs.every((run) => run.metrics && run.metrics.colour_changes === 1) },
        { name: 'machine-delta-limit-honoured', pass: runs.every((run) => run.metrics && run.metrics.maximum_delta_tenths_mm <= RECIPE.machine_limits.max_delta_tenths_mm) },
        { name: 'stitch-simulation-created', pass: runs.every((run) => run.metrics && run.metrics.simulation_bytes > 100) },
        { name: 'parsed-movement-repeatability', pass: runs[0].metrics && runs[1].metrics && runs[0].metrics.movement_digest === runs[1].metrics.movement_digest },
        { name: 'simulation-repeatability', pass: runs[0].metrics && runs[1].metrics && runs[0].metrics.simulation_digest === runs[1].metrics.simulation_digest },
        { name: 'truncated-counterexample-rejected', pass: !!invalidRejected },
      ];
      const receipt = { schema: RECEIPT_SCHEMA, version: '1.0.0', status: checks.every((check) => check.pass) ? 'PASS' : 'FAIL', identity, runtime: resolution.selected, recipe: RECIPE, recipe_digest: Pack.digest(RECIPE), source: { schema: source.schema, dst_digest: source.dst_digest, dst_bytes: source.dst_bytes, path_profiles: source.path_profiles, bounds_tenths_mm: source.bounds_tenths_mm }, provides_substrates: ['embroidery-parser-or-simulator'], checks, runs, counterexample: { process: invalidExecution.process, rejected: !!invalidRejected, metrics: invalidMetrics }, private_location_retained: false, generated_design_retained: false, automatic_design_retention: false };
      receipt.digest = Pack.digest(receipt); return receipt;
    } finally {
      const resolved = path.resolve(job); if (!resolved.startsWith(jobRoot + path.sep)) throw new Error('refused unsafe embroidery capability cleanup');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
  return Object.freeze({ identity, resolve, run });
}

module.exports = Object.freeze({ RECEIPT_SCHEMA, RECIPE, createExecutor });
