'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Pack = require('./pack-core');

const RECEIPT_SCHEMA = 'axm.brep-step-capability-receipt/v1';
const RECIPE = Object.freeze({ schema: 'axm.brep-step-capability-recipe/v1', kernel: 'CadQuery OCP / Open CASCADE', solid: { base: { type: 'box', x_mm: 40, y_mm: 30, z_mm: 10 }, subtract: { type: 'through-cylinder', radius_mm: 5, height_mm: 12, origin_mm: [20, 15, -1] } }, interchange: 'ISO 10303 STEP', repetitions: { create: 1, fresh_reopen: 2 }, tolerances: { volume_mm3: 0.000001, bounds_mm: 0.000001 } });

const COMMON = String.raw`import hashlib
import json
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.GProp import GProp_GProps
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer

def count(shape, kind):
    explorer = TopExp_Explorer(shape, kind)
    value = 0
    while explorer.More():
        value += 1
        explorer.Next()
    return value

def shape_metrics(shape):
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, props)
    bounds = Bnd_Box()
    BRepBndLib.Add_s(shape, bounds)
    return {
        "valid_brep": bool(BRepCheck_Analyzer(shape).IsValid()),
        "null_shape": bool(shape.IsNull()),
        "solids": count(shape, TopAbs_SOLID),
        "faces": count(shape, TopAbs_FACE),
        "edges": count(shape, TopAbs_EDGE),
        "volume_mm3": round(float(props.Mass()), 8),
        "bounds_mm": [round(float(value), 8) for value in bounds.Get()],
    }

def emit(label, metrics):
    metrics["semantic_digest"] = hashlib.sha256(json.dumps(metrics, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    print("AXM_BREP_STEP:" + json.dumps({"label": label, "metrics": metrics}, sort_keys=True, separators=(",", ":")))
`;

const CREATE_SCRIPT = COMMON + String.raw`
import os
import sys
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder
from OCP.BRepTools import BRepTools
from OCP.gp import gp_Ax2, gp_Dir, gp_Pnt
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_AsIs, STEPControl_Writer

step_file, brep_file = sys.argv[1], sys.argv[2]
base = BRepPrimAPI_MakeBox(40.0, 30.0, 10.0).Shape()
tool = BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(20.0, 15.0, -1.0), gp_Dir(0.0, 0.0, 1.0)), 5.0, 12.0).Shape()
cut = BRepAlgoAPI_Cut(base, tool)
cut.Build()
shape = cut.Shape()
writer = STEPControl_Writer()
transfer_status = writer.Transfer(shape, STEPControl_AsIs)
write_status = writer.Write(step_file)
BRepTools.Write_s(shape, brep_file)
metrics = shape_metrics(shape)
metrics.update({
    "boolean_complete": bool(cut.IsDone()),
    "step_transfer_done": bool(transfer_status == IFSelect_RetDone),
    "step_write_done": bool(write_status == IFSelect_RetDone),
    "step_bytes": os.path.getsize(step_file),
    "brep_bytes": os.path.getsize(brep_file),
})
emit("create", metrics)
if not (metrics["valid_brep"] and metrics["boolean_complete"] and metrics["step_transfer_done"] and metrics["step_write_done"]):
    raise SystemExit(2)
`;

const REOPEN_SCRIPT = COMMON + String.raw`
import os
import sys
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_Reader

step_file, label, strict = sys.argv[1], sys.argv[2], sys.argv[3] == "strict"
reader = STEPControl_Reader()
read_status = reader.ReadFile(step_file)
if read_status != IFSelect_RetDone:
    emit(label, {"read_done": False, "valid_brep": False, "null_shape": True, "solids": 0, "faces": 0, "edges": 0, "volume_mm3": 0.0, "bounds_mm": []})
    raise SystemExit(2 if strict else 0)
transferred = reader.TransferRoots()
shape = reader.OneShape()
metrics = shape_metrics(shape)
metrics.update({"read_done": True, "transferred_roots": int(transferred), "step_bytes": os.path.getsize(step_file)})
emit(label, metrics)
if strict and not (metrics["valid_brep"] and not metrics["null_shape"] and metrics["solids"] == 1):
    raise SystemExit(2)
`;

function capture(command, args, job, label) {
  const stdoutFile = path.join(job, label + '-stdout.txt'); const stderrFile = path.join(job, label + '-stderr.txt'); const out = fs.openSync(stdoutFile, 'wx'); const err = fs.openSync(stderrFile, 'wx'); let result;
  try { result = childProcess.spawnSync(command, args, { windowsHide: true, shell: false, timeout: 60000, stdio: ['ignore', out, err] }); } finally { fs.closeSync(out); fs.closeSync(err); }
  const stdout = fs.readFileSync(stdoutFile); const stderr = fs.readFileSync(stderrFile); if (stdout.length > 8 * 1024 * 1024 || stderr.length > 8 * 1024 * 1024) throw new Error('B-rep capability output exceeds bounds');
  const line = stdout.toString('utf8').split(/\r?\n/).find((item) => item.startsWith('AXM_BREP_STEP:')); let payload = null; try { payload = line ? JSON.parse(line.slice('AXM_BREP_STEP:'.length)) : null; } catch (error) { payload = null; }
  return { process: { status: result.status, error: result.error && (result.error.code || 'PROCESS_ERROR') || null, stdout_digest: Pack.sha256(stdout), stderr_digest: Pack.sha256(stderr) }, process_pass: result.status === 0 && !result.error && !!payload, payload, diagnostic: result.status === 0 && !result.error ? null : Pack.cleanText(stderr.toString('utf8') + '\n' + stdout.toString('utf8'), 3000) || null };
}

function approximately(left, right, tolerance) { return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance; }
function equalBounds(left, right, tolerance) { return Array.isArray(left) && Array.isArray(right) && left.length === 6 && right.length === 6 && left.every((value, index) => approximately(value, right[index], tolerance)); }

function createExecutor(options) {
  options = options || {}; const root = Pack.assertSafeRoot(options.root || Pack.defaultRoot()); const lock = options.lock || Pack.loadLock(options.lockPath);
  const identity = Object.freeze({ kind: 'native-cad-kernel-matrix', fresh_process: true, id: 'axm-ocp-brep-step-matrix', version: '1.0.0', host: 'Open CASCADE via CadQuery OCP', network: false, create_processes: 1, reopen_processes: 2, retains_cad: false });
  function resolve() { return Pack.resolveRequest({ id: 'cadquery-ocp' }, { root, lock, inventory: options.inventory }); }
  function run() {
    const resolution = resolve(); if (resolution.status !== 'READY') return { schema: RECEIPT_SCHEMA, version: '1.0.0', status: 'MISSING_SUBSTRATE', missing: resolution.missing || ['cadquery-ocp'], identity, private_location_retained: false };
    const jobRoot = path.resolve(root, '.jobs'); fs.mkdirSync(jobRoot, { recursive: true }); const job = path.join(jobRoot, 'brep-step-' + process.pid + '-' + crypto.randomBytes(8).toString('hex')); if (!job.startsWith(jobRoot + path.sep)) throw new Error('B-rep job escaped root'); fs.mkdirSync(job, { recursive: false });
    try {
      const createScript = path.join(job, 'create.py'); const reopenScript = path.join(job, 'reopen.py'); const step = path.join(job, 'holed-block.step'); const brep = path.join(job, 'holed-block.brep'); const invalid = path.join(job, 'invalid.step');
      fs.writeFileSync(createScript, CREATE_SCRIPT, { flag: 'wx' }); fs.writeFileSync(reopenScript, REOPEN_SCRIPT, { flag: 'wx' }); fs.writeFileSync(invalid, Buffer.from('ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;\n'), { flag: 'wx' });
      const python = Pack.entrypointPath(root, Pack.entryById(lock, 'python-cpython'), 'python'); const created = capture(python, [createScript, step, brep], job, 'create'); const reopens = ['a', 'b'].map((label) => capture(python, [reopenScript, step, 'reopen-' + label, 'strict'], job, 'reopen-' + label)); const rejected = capture(python, [reopenScript, invalid, 'invalid', 'strict'], job, 'invalid');
      const original = created.payload && created.payload.metrics; const reopened = reopens.map((item) => item.payload && item.payload.metrics); const expectedVolume = 40 * 30 * 10 - Math.PI * 5 * 5 * 10;
      const invalidRejected = rejected.process.status === 2 && !rejected.process.error && rejected.payload && rejected.payload.metrics.read_done === false;
      const checks = [
        { name: 'boolean-brep-created-and-valid', pass: created.process_pass && original.boolean_complete && original.valid_brep && original.solids === 1 && original.faces === 7 },
        { name: 'analytic-volume-within-tolerance', pass: original && approximately(original.volume_mm3, expectedVolume, RECIPE.tolerances.volume_mm3) },
        { name: 'step-and-editable-brep-sources-created', pass: original && original.step_write_done && original.step_bytes > 1000 && original.brep_bytes > 1000 && fs.existsSync(step) && fs.existsSync(brep) },
        { name: 'two-fresh-step-reopens-valid', pass: reopens.every((item) => item.process_pass && item.payload.metrics.read_done && item.payload.metrics.valid_brep && item.payload.metrics.solids === 1) },
        { name: 'topology-round-trip-preserved', pass: reopened.every((metrics) => metrics && metrics.solids === original.solids && metrics.faces === original.faces && metrics.edges === original.edges) },
        { name: 'volume-round-trip-within-tolerance', pass: reopened.every((metrics) => metrics && approximately(metrics.volume_mm3, original.volume_mm3, RECIPE.tolerances.volume_mm3)) },
        { name: 'bounds-round-trip-within-tolerance', pass: reopened.every((metrics) => metrics && equalBounds(metrics.bounds_mm, original.bounds_mm, RECIPE.tolerances.bounds_mm)) },
        { name: 'fresh-reopen-repeatability', pass: reopened[0] && reopened[1] && reopened[0].semantic_digest === reopened[1].semantic_digest },
        { name: 'truncated-step-counterexample-rejected', pass: !!invalidRejected },
      ];
      const receipt = { schema: RECEIPT_SCHEMA, version: '1.0.0', status: checks.every((check) => check.pass) ? 'PASS' : 'FAIL', identity, runtime: resolution.selected, recipe: RECIPE, recipe_digest: Pack.digest(RECIPE), expected_analytic_volume_mm3: Number(expectedVolume.toFixed(8)), checks, create: created, reopens, counterexample: { process: rejected.process, rejected: !!invalidRejected, metrics: rejected.payload && rejected.payload.metrics || null }, step_digest: fs.existsSync(step) ? Pack.sha256(fs.readFileSync(step)) : null, editable_brep_digest: fs.existsSync(brep) ? Pack.sha256(fs.readFileSync(brep)) : null, provides_substrates: ['brep-step-kernel'], private_location_retained: false, generated_cad_retained: false, automatic_cad_retention: false };
      receipt.digest = Pack.digest(receipt); return receipt;
    } finally { const resolved = path.resolve(job); if (!resolved.startsWith(jobRoot + path.sep)) throw new Error('refused unsafe B-rep cleanup'); fs.rmSync(resolved, { recursive: true, force: true }); }
  }
  return Object.freeze({ identity, resolve, run });
}

module.exports = Object.freeze({ RECEIPT_SCHEMA, RECIPE, createExecutor });
