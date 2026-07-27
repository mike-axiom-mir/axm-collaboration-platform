'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Pack = require('./pack-core');

const RECEIPT_SCHEMA = 'axm.blender-live-render-receipt/v1';
const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;

const SCENE_RECIPE = Object.freeze({
  schema: 'axm.blender-render-probe-recipe/v1',
  engine: 'CYCLES',
  device: 'CPU',
  resolution: { width: 96, height: 96, percentage: 100 },
  sampling: { samples: 4, seed: 73, adaptive: false, denoise: false, threads: 1 },
  colour: { display: 'sRGB', view_transform: 'Standard', output: 'PNG/RGBA/8' },
  scene: ['matte-plane', 'principled-uv-sphere', 'principled-cube', 'camera', 'area-key', 'area-fill'],
  deterministic_repetitions: 2,
});

const SCRIPT = String.raw`import array
import bpy
import hashlib
import json
import math
import os
import sys
import time
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
def option(name):
    index = argv.index(name)
    return argv[index + 1]

output_path = option("--output")
blend_path = option("--blend")
started = time.perf_counter()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 4
scene.cycles.seed = 73
scene.cycles.use_adaptive_sampling = False
scene.cycles.use_denoising = False
scene.render.threads_mode = "FIXED"
scene.render.threads = 1
scene.render.resolution_x = 96
scene.render.resolution_y = 96
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.image_settings.compression = 15
scene.render.film_transparent = False
scene.render.filepath = output_path
scene.view_settings.view_transform = "Standard"

world = bpy.data.worlds.new("AXM World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.035, 0.045, 0.065, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22
scene.world = world

def material(name, colour, metallic, roughness):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = colour
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return value

bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -1.25))
plane = bpy.context.object
plane.name = "AXM Matte Plane"
plane.data.materials.append(material("AXM Plane", (0.07, 0.09, 0.13, 1.0), 0.0, 0.72))

bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1.0, location=(-0.65, 0.0, 0.0))
sphere = bpy.context.object
sphere.name = "AXM Principled Sphere"
sphere.data.materials.append(material("AXM Copper", (0.52, 0.11, 0.035, 1.0), 0.72, 0.24))
bpy.ops.object.shade_smooth()

bpy.ops.mesh.primitive_cube_add(size=1.35, location=(1.15, 0.15, -0.55), rotation=(0.18, 0.0, 0.34))
cube = bpy.context.object
cube.name = "AXM Principled Cube"
cube.data.materials.append(material("AXM Blue", (0.035, 0.21, 0.62, 1.0), 0.08, 0.32))
bevel = cube.modifiers.new("AXM Bevel", "BEVEL")
bevel.width = 0.09
bevel.segments = 3

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.camera_add(location=(5.2, -6.8, 4.1))
camera = bpy.context.object
camera.name = "AXM Camera"
camera.data.lens = 52
aim(camera, (0.15, 0.0, -0.25))
scene.camera = camera

def area(name, location, energy, size, colour):
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.name = name
    lamp.data.energy = energy
    lamp.data.shape = "DISK"
    lamp.data.size = size
    lamp.data.color = colour
    aim(lamp, (0.0, 0.0, -0.25))

area("AXM Key", (-3.5, -3.0, 6.5), 850.0, 4.0, (1.0, 0.72, 0.52))
area("AXM Fill", (4.0, 1.8, 3.5), 620.0, 3.0, (0.45, 0.62, 1.0))

bpy.ops.wm.save_as_mainfile(filepath=blend_path, check_existing=False)
bpy.ops.render.render(write_still=True)
decoded_frame = bpy.data.images.load(output_path, check_existing=False)
pixel_values = decoded_frame.pixels[:]
pixel_bytes = array.array("f", pixel_values).tobytes()
receipt = {
    "blender_version": bpy.app.version_string,
    "engine": scene.render.engine,
    "device": scene.cycles.device,
    "width": scene.render.resolution_x,
    "height": scene.render.resolution_y,
    "samples": scene.cycles.samples,
    "seed": scene.cycles.seed,
    "objects": len(scene.objects),
    "frame_bytes": os.path.getsize(output_path),
    "pixel_digest": hashlib.sha256(pixel_bytes).hexdigest(),
    "pixel_float_count": len(pixel_values),
    "render_ms": round((time.perf_counter() - started) * 1000.0, 3),
}
print("AXM_BLENDER_PROBE:" + json.dumps(receipt, sort_keys=True, separators=(",", ":")))
`;

function runCaptured(command, args, job, label) {
  const stdoutFile = path.join(job, label + '-stdout.txt');
  const stderrFile = path.join(job, label + '-stderr.txt');
  const out = fs.openSync(stdoutFile, 'wx');
  const err = fs.openSync(stderrFile, 'wx');
  let result;
  try {
    result = childProcess.spawnSync(command, args, {
      windowsHide: true,
      shell: false,
      timeout: 300000,
      stdio: ['ignore', out, err],
      env: Object.assign({}, process.env, { BLENDER_USER_CONFIG: path.join(job, 'config'), BLENDER_USER_SCRIPTS: path.join(job, 'scripts') }),
    });
  } finally {
    fs.closeSync(out);
    fs.closeSync(err);
  }
  const stdout = fs.readFileSync(stdoutFile);
  const stderr = fs.readFileSync(stderrFile);
  if (stdout.length > MAX_CAPTURE_BYTES || stderr.length > MAX_CAPTURE_BYTES) throw new Error('Blender process output exceeds bounds');
  return {
    status: result.status,
    error: result.error && (result.error.code || 'PROCESS_ERROR'),
    stdout: stdout.toString('utf8'),
    stderr: stderr.toString('utf8'),
    stdout_digest: Pack.sha256(stdout),
    stderr_digest: Pack.sha256(stderr),
  };
}

function parseProbe(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find((item) => item.startsWith('AXM_BLENDER_PROBE:'));
  if (!line) return null;
  try { return JSON.parse(line.slice('AXM_BLENDER_PROBE:'.length)); } catch (error) { return null; }
}

function boundedDiagnostic(execution) {
  const combined = String(execution && execution.stderr || '') + '\n' + String(execution && execution.stdout || '');
  return Pack.cleanText(combined.split(/\r?\n/).filter((line) => /error|exception|traceback|failed/i.test(line)).slice(-20).join('\n'), 3000) || null;
}

function createExecutor(options) {
  options = options || {};
  const root = Pack.assertSafeRoot(options.root || Pack.defaultRoot());
  const lock = options.lock || Pack.loadLock(options.lockPath);
  const identity = Object.freeze({ kind: 'native-host', fresh_process: true, id: 'axm-blender-cycles-live-renderer', version: '1.0.0', host: 'blender', engine: 'CYCLES', device: 'CPU', network: false, deterministic_repetitions: 2, retains_project: false });

  function resolve() { return Pack.resolveRequest({ id: 'offline-renderer' }, { root, lock, inventory: options.inventory }); }

  function run() {
    const resolution = resolve();
    if (resolution.status !== 'READY') return { schema: RECEIPT_SCHEMA, version: '1.0.0', status: 'MISSING_SUBSTRATE', missing: resolution.missing || ['offline-renderer'], identity, private_location_retained: false };
    const jobRoot = path.resolve(root, '.jobs');
    fs.mkdirSync(jobRoot, { recursive: true });
    const job = path.join(jobRoot, 'blender-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
    if (!job.startsWith(jobRoot + path.sep)) throw new Error('Blender job escaped root');
    fs.mkdirSync(job, { recursive: false });
    try {
      const script = path.join(job, 'render-probe.py');
      fs.writeFileSync(script, SCRIPT, { flag: 'wx' });
      const blender = Pack.entrypointPath(root, Pack.entryById(lock, 'blender'), 'blender');
      const runs = ['a', 'b'].map((label) => {
        const frame = path.join(job, 'frame-' + label + '.png');
        const source = path.join(job, 'scene-' + label + '.blend');
        const executed = runCaptured(blender, ['--background', '--factory-startup', '--python', script, '--', '--output', frame, '--blend', source], job, 'run-' + label);
        const metrics = parseProbe(executed.stdout);
        const frameReady = fs.existsSync(frame) && fs.statSync(frame).isFile() && fs.statSync(frame).size > 128;
        const sourceReady = fs.existsSync(source) && fs.statSync(source).isFile() && fs.statSync(source).size > 1024;
        return {
          label,
          process: { status: executed.status, error: executed.error || null, stdout_digest: executed.stdout_digest, stderr_digest: executed.stderr_digest },
          process_pass: executed.status === 0 && !executed.error,
          metrics,
          frame_digest: frameReady ? Pack.sha256(fs.readFileSync(frame)) : null,
          frame_bytes: frameReady ? fs.statSync(frame).size : 0,
          editable_source_digest: sourceReady ? Pack.sha256(fs.readFileSync(source)) : null,
          diagnostic: boundedDiagnostic(executed),
        };
      });
      const containerByteMatch = runs.every((item) => item.frame_digest) && runs[0].frame_digest === runs[1].frame_digest;
      const expectedPixelCount = SCENE_RECIPE.resolution.width * SCENE_RECIPE.resolution.height * 4;
      const decoded = runs.every((item) => item.metrics && item.metrics.pixel_float_count === expectedPixelCount && /^[a-f0-9]{64}$/.test(item.metrics.pixel_digest || '') && item.metrics.pixel_digest !== Pack.sha256(Buffer.alloc(0)));
      const deterministic = decoded && runs[0].metrics.pixel_digest === runs[1].metrics.pixel_digest;
      const checks = [
        { name: 'two-fresh-blender-processes', pass: runs.every((item) => item.process_pass) },
        { name: 'cycles-cpu-engine', pass: runs.every((item) => item.metrics && item.metrics.engine === 'CYCLES' && item.metrics.device === 'CPU') },
        { name: 'declared-render-canvas', pass: runs.every((item) => item.metrics && item.metrics.width === SCENE_RECIPE.resolution.width && item.metrics.height === SCENE_RECIPE.resolution.height) },
        { name: 'visible-frames-created', pass: runs.every((item) => !!item.frame_digest) },
        { name: 'full-rgba-frames-decoded', pass: decoded },
        { name: 'editable-blend-sources-created', pass: runs.every((item) => !!item.editable_source_digest) },
        { name: 'deterministic-decoded-pixel-digest', pass: deterministic },
      ];
      const receipt = {
        schema: RECEIPT_SCHEMA,
        version: '1.0.0',
        status: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
        identity,
        runtime: resolution.selected,
        scene_recipe: SCENE_RECIPE,
        scene_recipe_digest: Pack.digest(SCENE_RECIPE),
        frame_digest: runs[0].frame_digest,
        deterministic_pixel_match: deterministic,
        container_byte_match: containerByteMatch,
        checks,
        runs,
        editable_source_supported: true,
        editable_source_retained: false,
        private_location_retained: false,
        automatic_project_retention: false,
      };
      receipt.digest = Pack.digest(receipt);
      return receipt;
    } finally {
      const resolved = path.resolve(job);
      if (!resolved.startsWith(jobRoot + path.sep)) throw new Error('refused unsafe Blender job cleanup');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  return Object.freeze({ identity, resolve, run });
}

module.exports = { RECEIPT_SCHEMA, SCENE_RECIPE, createExecutor, parseProbe };
