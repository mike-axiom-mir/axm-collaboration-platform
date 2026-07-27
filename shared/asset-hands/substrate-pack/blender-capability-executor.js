'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Pack = require('./pack-core');

const RECEIPT_SCHEMA = 'axm.blender-capability-matrix-receipt/v1';
const MATRIX_RECIPE = Object.freeze({
  schema: 'axm.blender-capability-matrix-recipe/v1',
  texture_bake: { engine: 'CYCLES', type: 'AO', width: 32, height: 32, samples: 2, margin: 2 },
  rig: { bones: 1, weighted_vertices: 4, start_frame: 1, end_frame: 12, rotation_degrees: 35 },
  simulation: { type: 'RIGID_BODY', start_frame: 1, end_frame: 30, fps: 24, gravity: -9.81 },
  repetitions: 2,
});

const SCRIPT = String.raw`import array
import bpy
import hashlib
import json
import math
import os
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
def option(name):
    return argv[argv.index(name) + 1]

output_dir = option("--output-dir")
label = option("--label")
os.makedirs(output_dir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 2
scene.cycles.seed = 91
scene.cycles.use_denoising = False
scene.cycles.use_adaptive_sampling = False
scene.render.threads_mode = "FIXED"
scene.render.threads = 1

# Real AO texture bake into an image node on a UV-unwrapped mesh.
bpy.ops.mesh.primitive_cube_add(size=2.0, location=(-4.0, 0.0, 0.0))
bake_mesh = bpy.context.object
bake_mesh.name = "AXM Bake Mesh"
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.02)
bpy.ops.object.mode_set(mode="OBJECT")
material = bpy.data.materials.new("AXM Bake Material")
material.use_nodes = True
image = bpy.data.images.new("AXM AO Bake", width=32, height=32, alpha=False, float_buffer=False)
image_node = material.node_tree.nodes.new("ShaderNodeTexImage")
image_node.image = image
material.node_tree.nodes.active = image_node
bake_mesh.data.materials.append(material)
bpy.context.view_layer.objects.active = bake_mesh
bake_mesh.select_set(True)
bpy.ops.object.bake(type="AO", margin=2, use_clear=True)
bake_file = os.path.join(output_dir, "ao-" + label + ".png")
image.filepath_raw = bake_file
image.file_format = "PNG"
image.save()
decoded = bpy.data.images.load(bake_file, check_existing=False)
bake_pixels = decoded.pixels[:]
bake_bytes = array.array("f", bake_pixels).tobytes()
bake_values = list(bake_pixels[0::4]) + list(bake_pixels[1::4]) + list(bake_pixels[2::4])

# A weighted mesh driven by a one-bone armature and keyed pose.
mesh_data = bpy.data.meshes.new("AXM Rig Mesh Data")
mesh_data.from_pydata([(-0.6, 0.0, 0.0), (0.6, 0.0, 0.0), (-0.6, 1.5, 0.0), (0.6, 1.5, 0.0)], [], [(0, 1, 3, 2)])
mesh_data.update()
rig_mesh = bpy.data.objects.new("AXM Rig Mesh", mesh_data)
scene.collection.objects.link(rig_mesh)
armature_data = bpy.data.armatures.new("AXM Armature Data")
armature = bpy.data.objects.new("AXM Armature", armature_data)
scene.collection.objects.link(armature)
bpy.context.view_layer.objects.active = armature
armature.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bone = armature_data.edit_bones.new("AXM Bone")
bone.head = (0.0, 0.0, 0.0)
bone.tail = (0.0, 1.5, 0.0)
bpy.ops.object.mode_set(mode="POSE")
pose_bone = armature.pose.bones["AXM Bone"]
pose_bone.rotation_mode = "XYZ"
pose_bone.rotation_euler = (0.0, 0.0, 0.0)
pose_bone.keyframe_insert(data_path="rotation_euler", frame=1)
pose_bone.rotation_euler = (0.0, 0.0, math.radians(35.0))
pose_bone.keyframe_insert(data_path="rotation_euler", frame=12)
bpy.ops.object.mode_set(mode="OBJECT")
group = rig_mesh.vertex_groups.new(name="AXM Bone")
group.add([0, 1, 2, 3], 1.0, "REPLACE")
modifier = rig_mesh.modifiers.new("AXM Armature Modifier", "ARMATURE")
modifier.object = armature

def evaluated_vertices(frame):
    scene.frame_set(frame)
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = rig_mesh.evaluated_get(graph)
    return [tuple(round(value, 8) for value in (evaluated.matrix_world @ vertex.co)) for vertex in evaluated.data.vertices]

rig_start = evaluated_vertices(1)
rig_end = evaluated_vertices(12)
rig_displacements = [math.dist(left, right) for left, right in zip(rig_start, rig_end)]
weight_sums = []
for vertex in rig_mesh.data.vertices:
    weight_sums.append(sum(group.weight for group in vertex.groups))

# A real rigid-body world with a passive floor and one active body.
scene.frame_start = 1
scene.frame_end = 30
scene.render.fps = 24
scene.gravity = (0.0, 0.0, -9.81)
scene.frame_set(1)
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(4.0, 0.0, 3.0))
falling = bpy.context.object
falling.name = "AXM Falling Body"
bpy.ops.rigidbody.object_add()
falling.rigid_body.type = "ACTIVE"
falling.rigid_body.mass = 1.0
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(4.0, 0.0, -0.25), scale=(3.0, 3.0, 0.25))
floor = bpy.context.object
floor.name = "AXM Passive Floor"
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.rigidbody.object_add()
floor.rigid_body.type = "PASSIVE"
scene.rigidbody_world.enabled = True
scene.rigidbody_world.point_cache.frame_start = 1
scene.rigidbody_world.point_cache.frame_end = 30
project_file = os.path.join(output_dir, "capability-" + label + ".blend")
bpy.ops.wm.save_as_mainfile(filepath=project_file, check_existing=False)
bpy.ops.ptcache.bake_all(bake=True)
def simulated_z(frame):
    scene.frame_set(frame)
    graph = bpy.context.evaluated_depsgraph_get()
    graph.update()
    return round(falling.evaluated_get(graph).matrix_world.translation.z, 8)

simulation_start_z = simulated_z(1)
simulation_end_z = simulated_z(30)

bpy.ops.wm.save_as_mainfile(filepath=project_file, check_existing=False)
result = {
    "blender_version": bpy.app.version_string,
    "texture_bake": {
        "type": "AO",
        "width": decoded.size[0],
        "height": decoded.size[1],
        "pixel_float_count": len(bake_pixels),
        "pixel_digest": hashlib.sha256(bake_bytes).hexdigest(),
        "minimum": round(min(bake_values), 8),
        "maximum": round(max(bake_values), 8),
        "file_bytes": os.path.getsize(bake_file),
    },
    "rig": {
        "bones": len(armature.data.bones),
        "vertices": len(rig_mesh.data.vertices),
        "weighted_vertices": sum(1 for value in weight_sums if abs(value - 1.0) < 0.000001),
        "maximum_displacement": round(max(rig_displacements), 8),
        "start_digest": hashlib.sha256(json.dumps(rig_start, separators=(",", ":")).encode("utf-8")).hexdigest(),
        "end_digest": hashlib.sha256(json.dumps(rig_end, separators=(",", ":")).encode("utf-8")).hexdigest(),
    },
    "simulation": {
        "type": "RIGID_BODY",
        "start_z": simulation_start_z,
        "end_z": simulation_end_z,
        "delta_z": round(simulation_end_z - simulation_start_z, 8),
        "frames": 30,
        "fps": scene.render.fps,
    },
    "project_bytes": os.path.getsize(project_file),
}
print("AXM_BLENDER_CAPABILITY:" + json.dumps(result, sort_keys=True, separators=(",", ":")))
`;

function capture(command, args, job, label) {
  const stdoutFile = path.join(job, label + '-stdout.txt');
  const stderrFile = path.join(job, label + '-stderr.txt');
  const out = fs.openSync(stdoutFile, 'wx');
  const err = fs.openSync(stderrFile, 'wx');
  let result;
  try {
    result = childProcess.spawnSync(command, args, { windowsHide: true, shell: false, timeout: 300000, stdio: ['ignore', out, err], env: Object.assign({}, process.env, { BLENDER_USER_CONFIG: path.join(job, 'config'), BLENDER_USER_SCRIPTS: path.join(job, 'scripts') }) });
  } finally {
    fs.closeSync(out); fs.closeSync(err);
  }
  const stdout = fs.readFileSync(stdoutFile); const stderr = fs.readFileSync(stderrFile);
  if (stdout.length > 16 * 1024 * 1024 || stderr.length > 16 * 1024 * 1024) throw new Error('Blender capability output exceeds bounds');
  return { status: result.status, error: result.error && (result.error.code || 'PROCESS_ERROR'), stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'), stdout_digest: Pack.sha256(stdout), stderr_digest: Pack.sha256(stderr) };
}

function parse(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find((item) => item.startsWith('AXM_BLENDER_CAPABILITY:'));
  if (!line) return null;
  try { return JSON.parse(line.slice('AXM_BLENDER_CAPABILITY:'.length)); } catch (error) { return null; }
}

function cleanDiagnostic(execution) {
  return Pack.cleanText((String(execution.stderr || '') + '\n' + String(execution.stdout || '')).split(/\r?\n/).filter((line) => /error|exception|traceback|failed/i.test(line)).slice(-20).join('\n'), 3000) || null;
}

function approximately(left, right, tolerance) { return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance; }

function createExecutor(options) {
  options = options || {};
  const root = Pack.assertSafeRoot(options.root || Pack.defaultRoot());
  const lock = options.lock || Pack.loadLock(options.lockPath);
  const identity = Object.freeze({ kind: 'native-host', fresh_process: true, id: 'axm-blender-capability-matrix', version: '1.0.0', host: 'blender', network: false, repetitions: 2, retains_project: false });
  function resolve() { return Pack.resolveRequest({ id: 'blender' }, { root, lock, inventory: options.inventory }); }
  function run() {
    const resolution = resolve();
    if (resolution.status !== 'READY') return { schema: RECEIPT_SCHEMA, version: '1.0.0', status: 'MISSING_SUBSTRATE', missing: resolution.missing || ['blender'], identity, private_location_retained: false };
    const jobRoot = path.resolve(root, '.jobs'); fs.mkdirSync(jobRoot, { recursive: true });
    const job = path.join(jobRoot, 'blender-capabilities-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
    if (!job.startsWith(jobRoot + path.sep)) throw new Error('Blender capability job escaped root');
    fs.mkdirSync(job, { recursive: false });
    try {
      const script = path.join(job, 'capability-matrix.py'); fs.writeFileSync(script, SCRIPT, { flag: 'wx' });
      const blender = Pack.entrypointPath(root, Pack.entryById(lock, 'blender'), 'blender');
      const runs = ['a', 'b'].map((label) => {
        const outputDir = path.join(job, 'output-' + label); fs.mkdirSync(outputDir, { recursive: false });
        const execution = capture(blender, ['--background', '--factory-startup', '--python', script, '--', '--output-dir', outputDir, '--label', label], job, 'run-' + label);
        const metrics = parse(execution.stdout);
        const bake = path.join(outputDir, 'ao-' + label + '.png');
        const project = path.join(outputDir, 'capability-' + label + '.blend');
        return {
          label,
          process: { status: execution.status, error: execution.error || null, stdout_digest: execution.stdout_digest, stderr_digest: execution.stderr_digest },
          process_pass: execution.status === 0 && !execution.error && !!metrics,
          metrics,
          bake_digest: fs.existsSync(bake) && fs.statSync(bake).size > 128 ? Pack.sha256(fs.readFileSync(bake)) : null,
          project_digest: fs.existsSync(project) && fs.statSync(project).size > 1024 ? Pack.sha256(fs.readFileSync(project)) : null,
          diagnostic: cleanDiagnostic(execution),
        };
      });
      const a = runs[0].metrics; const b = runs[1].metrics;
      const emptyDigest = Pack.sha256(Buffer.alloc(0));
      const texturePass = runs.every((item) => item.metrics && item.metrics.texture_bake && item.metrics.texture_bake.width === 32 && item.metrics.texture_bake.height === 32 && item.metrics.texture_bake.pixel_float_count === 4096 && item.metrics.texture_bake.pixel_digest !== emptyDigest && item.bake_digest);
      const textureRepeat = texturePass && a.texture_bake.pixel_digest === b.texture_bake.pixel_digest;
      const rigPass = runs.every((item) => item.metrics && item.metrics.rig && item.metrics.rig.bones === 1 && item.metrics.rig.vertices === 4 && item.metrics.rig.weighted_vertices === 4 && item.metrics.rig.maximum_displacement > 0.1 && item.metrics.rig.start_digest !== item.metrics.rig.end_digest);
      const rigRepeat = rigPass && a.rig.start_digest === b.rig.start_digest && a.rig.end_digest === b.rig.end_digest && approximately(a.rig.maximum_displacement, b.rig.maximum_displacement, 1e-8);
      const simulationPass = runs.every((item) => item.metrics && item.metrics.simulation && item.metrics.simulation.type === 'RIGID_BODY' && item.metrics.simulation.start_z > item.metrics.simulation.end_z && item.metrics.simulation.end_z > 0.2 && item.metrics.simulation.end_z < 1.0);
      const simulationRepeat = simulationPass && approximately(a.simulation.start_z, b.simulation.start_z, 1e-8) && approximately(a.simulation.end_z, b.simulation.end_z, 1e-6);
      const checks = [
        { name: 'two-fresh-blender-processes', pass: runs.every((item) => item.process_pass) },
        { name: 'real-ao-texture-bake', pass: texturePass },
        { name: 'texture-bake-repeatability', pass: textureRepeat },
        { name: 'weighted-rig-deformation', pass: rigPass },
        { name: 'rig-deformation-repeatability', pass: rigRepeat },
        { name: 'bounded-rigid-body-simulation', pass: simulationPass },
        { name: 'simulation-repeatability', pass: simulationRepeat },
        { name: 'editable-projects-created', pass: runs.every((item) => !!item.project_digest) },
      ];
      const receipt = { schema: RECEIPT_SCHEMA, version: '1.0.0', status: checks.every((item) => item.pass) ? 'PASS' : 'FAIL', identity, runtime: resolution.selected, matrix_recipe: MATRIX_RECIPE, matrix_recipe_digest: Pack.digest(MATRIX_RECIPE), provides_substrates: ['rig-runtime', 'simulation-runtime', 'texture-baker'], checks, runs, private_location_retained: false, editable_source_retained: false, automatic_project_retention: false };
      receipt.digest = Pack.digest(receipt); return receipt;
    } finally {
      const resolved = path.resolve(job); if (!resolved.startsWith(jobRoot + path.sep)) throw new Error('refused unsafe Blender capability cleanup');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
  return Object.freeze({ identity, resolve, run });
}

module.exports = { RECEIPT_SCHEMA, MATRIX_RECIPE, createExecutor, parse };
