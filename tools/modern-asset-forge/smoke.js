import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { KTX2Loader } from './decoder-runtime/loaders/KTX2Loader.js';
import { MeshoptDecoder } from './decoder-runtime/meshopt_decoder.mjs';

const statusNode = document.getElementById('status');
const jobNode = document.getElementById('job');
const canvas = document.getElementById('viewport');
const jobId = new URL(location.href).searchParams.get('job');

function setStatus(text, kind) {
  statusNode.textContent = text;
  statusNode.className = 'status' + (kind ? ' ' + kind : '');
  document.body.dataset.smokeStatus = kind === 'pass' ? 'PASS' : kind === 'fail' ? 'FAIL' : 'RUNNING';
}

async function main() {
  if (!jobId) throw new Error('The smoke URL requires a job query parameter.');
  const planResponse = await fetch('./api/smoke-plan?job=' + encodeURIComponent(jobId), { cache: 'no-store' });
  if (!planResponse.ok) throw new Error('The smoke plan could not be loaded.');
  const plan = await planResponse.json();
  jobNode.textContent = plan.job_id;
  setStatus('Creating an explicit WebGL2 context…');
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!context) throw new Error('WebGL2 is unavailable in this browser.');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07100d);
  scene.add(new THREE.HemisphereLight(0xddeee4, 0x25342d, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(4, 7, 5);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(46, 1, .01, 10000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  setStatus('Starting the pinned local KTX2 and meshopt decoders…');
  const ktx2Loader = new KTX2Loader().setTranscoderPath('./decoder-runtime/basis/').detectSupport(renderer);
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setKTX2Loader(ktx2Loader).setMeshoptDecoder(MeshoptDecoder);
  setStatus('Loading the compressed GLB through the local Three.js runtime…');
  const gltf = await new Promise((resolve, reject) => loader.load(plan.asset_url, resolve, undefined, reject));
  scene.add(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, .1);
  controls.target.copy(center);
  camera.position.set(center.x + radius * 1.25, center.y + radius * .75, center.z + radius * 1.55);
  camera.near = Math.max(.001, radius / 1000);
  camera.far = Math.max(100, radius * 100);
  camera.updateProjectionMatrix();
  let meshes = 0;
  let primitives = 0;
  let triangles = 0;
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    meshes += 1;
    primitives += Array.isArray(object.material) ? object.material.length : 1;
    const geometry = object.geometry;
    const elements = geometry.index ? geometry.index.count : geometry.attributes.position ? geometry.attributes.position.count : 0;
    triangles += Math.floor(elements / 3);
  });
  let frames = 0;
  function resize() {
    const width = innerWidth;
    const height = innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);
  await new Promise(resolve => {
    function frame() {
      controls.update();
      renderer.render(scene, camera);
      frames += 1;
      if (frames >= 3) resolve(); else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  const payload = {
    job_id: plan.job_id, token: plan.token, asset_url: plan.asset_url, renderer: 'WebGL2', loader_status: 'loaded',
    ktx2_decoder: 'ready', meshopt_decoder: 'ready', extensions_used: gltf.parser.json.extensionsUsed || [],
    metrics: { frames_rendered: frames, meshes, primitives, triangles, animations: gltf.animations.length, bounds: { x: size.x, y: size.y, z: size.z } }
  };
  const receiptResponse = await fetch('./api/smoke-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const receipt = await receiptResponse.json();
  if (!receiptResponse.ok || receipt.status !== 'PASS') throw new Error(receipt.error || 'Browser receipt failed its checks.');
  setStatus('PASS · WebGL2 loaded and rendered ' + meshes + ' mesh(es), ' + triangles + ' estimated triangles. Human visual approval remains open.', 'pass');
  function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
}

main().catch(error => setStatus('FAIL · ' + String(error.message || error), 'fail'));
