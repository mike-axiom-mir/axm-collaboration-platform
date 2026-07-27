'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const Core = require('./core');
const Toolchain = require('./toolchain');

const root = path.resolve(__dirname);
const workRoot = path.join(root, 'work');
const vendorRoot = path.resolve(__dirname, '../ps2-asset-forge/vendor');
const decoderRuntimeRoot = path.resolve(__dirname, '../../shared/asset-hands/browser-3d-runtime');
const port = Number(process.env.AXM_MODERN_FORGE_PORT || 8903);
const types = {
  '.css': 'text/css; charset=utf-8', '.glb': 'model/gltf-binary', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.ktx2': 'image/ktx2',
  '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm'
};

function responseJson(response, status, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
  response.end(bytes);
}

function safeFile(base, relative) {
  let decoded;
  try { decoded = decodeURIComponent(relative); } catch (error) { return null; }
  const file = path.resolve(base, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  return file === base || file.startsWith(base + path.sep) ? file : null;
}

function serveFile(response, base, relative) {
  const file = safeFile(base, relative);
  if (!file) return response.writeHead(403).end('Forbidden');
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return response.writeHead(404).end('Not found');
    response.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size, 'Cache-Control': 'no-store', 'Cross-Origin-Resource-Policy': 'same-origin'
    });
    fs.createReadStream(file).pipe(response);
  });
}

function jobRecords() {
  if (!fs.existsSync(workRoot)) return [];
  return fs.readdirSync(workRoot, { withFileTypes: true }).filter(item => item.isDirectory()).slice(0, 100).map(item => {
    const directory = path.join(workRoot, item.name);
    const planFile = path.join(directory, 'smoke-plan.json');
    const receiptFile = path.join(directory, 'build-receipt.json');
    let plan = null;
    let receipt = null;
    try { plan = JSON.parse(fs.readFileSync(planFile, 'utf8')); } catch (error) {}
    try { receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8')); } catch (error) {}
    return { directory: item.name, plan, receipt };
  }).filter(item => item.plan || item.receipt);
}

function findJob(jobId) {
  return jobRecords().find(item => item.plan && item.plan.job_id === jobId) || null;
}

function readBody(request, limit = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('request body exceeds limit'));
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (error) { reject(new Error('request body must be JSON')); }
    });
    request.on('error', reject);
  });
}

async function smokeReceipt(request, response) {
  try {
    const body = await readBody(request);
    if (!body || !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(body.job_id || '')) throw new Error('invalid job_id');
    const job = findJob(body.job_id);
    if (!job) throw new Error('unknown smoke job');
    if (body.token !== job.plan.token) throw new Error('smoke token mismatch');
    if (body.asset_url !== job.plan.asset_url) throw new Error('asset URL mismatch');
    const assetPrefix = '/builds/' + job.directory + '/';
    if (!body.asset_url.startsWith(assetPrefix)) throw new Error('asset URL is outside the job');
    const assetFile = safeFile(path.join(workRoot, job.directory), body.asset_url.slice(assetPrefix.length));
    if (!assetFile || !fs.existsSync(assetFile) || Core.fileDigest(assetFile) !== job.plan.asset_sha256) throw new Error('asset digest mismatch');
    const metrics = body.metrics || {};
    const checks = [
      { name: 'webgl2-context', pass: body.renderer === 'WebGL2' },
      { name: 'asset-digest-bound', pass: true },
      { name: 'gltf-loader-complete', pass: body.loader_status === 'loaded' },
      { name: 'ktx2-decoder-ready', pass: body.ktx2_decoder === 'ready' },
      { name: 'meshopt-decoder-ready', pass: body.meshopt_decoder === 'ready' },
      { name: 'required-extensions-observed', pass: Array.isArray(body.extensions_used) && (job.plan.extensions_used || []).every(extension => body.extensions_used.includes(extension)) },
      { name: 'visible-render-frames', pass: Number(metrics.frames_rendered) >= 2 },
      { name: 'mesh-present', pass: Number(metrics.meshes) > 0 }
    ];
    const receipt = {
      schema: 'axm.modern-asset-forge.browser-smoke-receipt/v1', version: '1.0.0', job_id: body.job_id,
      status: checks.every(item => item.pass) ? 'PASS' : 'FAIL', renderer: body.renderer, asset_url: body.asset_url,
      asset_sha256: job.plan.asset_sha256, evidence_role: job.plan.evidence_role,
      counts_as_canonical_delivery: false, visual_quality_approved: false, checks, metrics,
      observed_at: new Date().toISOString(), private_location_retained: false
    };
    receipt.digest = Core.sha256(Core.stableStringify(receipt));
    const file = path.join(workRoot, job.directory, 'receipts', 'browser-smoke-' + job.plan.token + '.json');
    try {
      fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      return responseJson(response, 200, JSON.parse(fs.readFileSync(file, 'utf8')));
    }
    responseJson(response, receipt.status === 'PASS' ? 201 : 422, receipt);
  } catch (error) {
    responseJson(response, 400, { error: error.message });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/api/capabilities') {
    try { return responseJson(response, 200, (await Toolchain.discover({})).inventory); }
    catch (error) { return responseJson(response, 500, { error: error.message }); }
  }
  if (request.method === 'GET' && url.pathname === '/api/jobs') {
    return responseJson(response, 200, jobRecords().map(item => ({ directory: item.directory, job_id: item.plan && item.plan.job_id || item.receipt && item.receipt.job_id, status: item.receipt && item.receipt.status, smoke_url: item.plan ? '/smoke.html?job=' + encodeURIComponent(item.plan.job_id) : null })));
  }
  if (request.method === 'GET' && url.pathname === '/api/smoke-plan') {
    const job = findJob(url.searchParams.get('job') || '');
    return job ? responseJson(response, 200, job.plan) : responseJson(response, 404, { error: 'smoke job not found' });
  }
  if (request.method === 'POST' && url.pathname === '/api/smoke-receipt') return smokeReceipt(request, response);
  if (request.method !== 'GET' && request.method !== 'HEAD') return response.writeHead(405).end('Method not allowed');
  if (url.pathname.startsWith('/vendor/')) return serveFile(response, vendorRoot, url.pathname.slice('/vendor'.length));
  if (url.pathname.startsWith('/decoder-runtime/')) return serveFile(response, decoderRuntimeRoot, url.pathname.slice('/decoder-runtime'.length));
  if (url.pathname.startsWith('/builds/')) return serveFile(response, workRoot, url.pathname.slice('/builds'.length));
  return serveFile(response, root, url.pathname === '/' ? '/index.html' : url.pathname);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write('AXM Modern Asset Forge: http://127.0.0.1:' + port + '/\n');
});
