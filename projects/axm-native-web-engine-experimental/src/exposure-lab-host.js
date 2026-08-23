'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const Canonical = require('./canonical-json');
const Digest = require('./digest');
const Exposure = require('./exposure-search-broker');
const ExposureExecutor = require('./exposure-search-executor');

const EXPOSURE_LAB_HOST_RECEIPT_SCHEMA = 'axm.web.exposure-lab-host-receipt/v1';
const EXPOSURE_LAB_STATE_SCHEMA = 'axm.web.exposure-lab-state/v1';
const DEFAULT_MAX_JSON_BYTES = 16 * 1024;
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), display-capture=(), usb=(), serial=(), hid=(), bluetooth=()';

const CONTROLLER_SOURCE = `(function(){'use strict';
const q=id=>document.getElementById(id),query=q('query'),mode=q('mode'),facets=q('facets'),run=q('run'),status=q('status'),browser=q('browser'),results=q('results');let state=null,busy=false;
const el=(n,c,t)=>{const x=document.createElement(n);if(c)x.className=c;if(t!=null)x.textContent=String(t);return x};
function setStatus(t,k){status.textContent=t;status.dataset.kind=k||'info'}
async function post(route,body){const r=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store'}),p=await r.json();if(!r.ok)throw new Error((p.code||'REQUEST_FAILED')+': '+(p.message||r.status));return p}
function render(){browser.replaceChildren();if(state.browserVisualState){browser.append(el('strong',null,state.browserVisualState.page.title||'Current browser page'),el('code',null,state.browserVisualState.visualDigest));}else browser.append(el('span','muted','No browser visual-state packet.'));
results.replaceChildren();if(!state.lastRun){results.append(el('p','muted','No exposure query run yet.'));return}const rs=state.lastRun.resultSet;results.append(el('strong',null,'Shodan · '+rs.mode.toUpperCase()+' · total '+rs.total),el('code',null,rs.query));if(rs.mode==='count'){const pre=el('pre');pre.textContent=JSON.stringify(rs.facets,null,2);results.append(pre);return}const list=el('ol');(rs.assets||[]).forEach(a=>{const li=el('li');li.append(el('strong',null,a.ip+':'+a.port),el('span',null,[a.product,a.version,a.org,a.countryCode,a.city].filter(Boolean).join(' · ')),el('code',null,[a.transport,a.asn,(a.hostnames||[]).join(', ')].filter(Boolean).join(' · ')));list.append(li)});results.append(list)}
run.addEventListener('click',async()=>{if(busy)return;busy=true;setStatus('QUERYING SHODAN…','busy');try{const fs=facets.value.split(',').map(x=>x.trim()).filter(Boolean);state=await post('search',{query:query.value,mode:mode.value,facets:fs,resultLimit:20});render();setStatus('READY · metadata only','ready')}catch(e){setStatus(String(e&&e.message||e),'fail')}finally{busy=false}});
fetch('state',{credentials:'omit',cache:'no-store'}).then(r=>r.json()).then(p=>{state=p;render();setStatus(state.configured?'READY · Shodan configured':'HOLD · configure Shodan + explicit network authority',state.configured?'ready':'hold')}).catch(e=>setStatus(String(e&&e.message||e),'fail'));
}());`;

function escapeHtml(value) { return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function controllerHash() { return crypto.createHash('sha256').update(CONTROLLER_SOURCE,'utf8').digest('base64'); }
function contentSecurityPolicy() { return "default-src 'none'; script-src 'sha256-"+controllerHash()+"'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'"; }
function securityHeaders() { return {'Cache-Control':'no-store','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin','Permissions-Policy':PERMISSIONS_POLICY,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'}; }

function renderExposureLabHtml() {
  const policy = contentSecurityPolicy();
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+escapeHtml(policy)+'"><title>AXM Exposure Search — EXPERIMENTAL</title><style>'+':root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;--bg:#060810;--surface:#0d1727;--card:#14243a;--fg:#f4f7ff;--muted:#9fb1cc;--border:#2c4567;--accent:#70e2c2;--warn:#f3bd63;--bad:#ff9c75}*{box-sizing:border-box}body{margin:0;background:#060810;color:var(--fg)}button,input,select{font:inherit;color:inherit}.shell{width:min(1100px,calc(100% - 20px));margin:14px auto 40px}.panel{border:1px solid var(--border);border-radius:14px;background:var(--surface);padding:16px;margin-top:10px}.badges{display:flex;flex-wrap:wrap;gap:7px}.badge{border:1px solid var(--accent);border-radius:999px;padding:5px 8px;color:var(--accent);font:800 10px ui-monospace,monospace}.hold{border-color:var(--warn);color:var(--warn)}h1{margin:8px 0;font-size:clamp(28px,5vw,50px)}p,.muted{color:var(--muted);line-height:1.5}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.control{display:grid;gap:5px}.control input,.control select{width:100%;padding:11px;border:1px solid var(--border);border-radius:9px;background:#08101d}.button{padding:11px 14px;border:1px solid var(--accent);border-radius:9px;background:var(--card);color:var(--accent);cursor:pointer}.status{display:block;padding:10px;border:1px solid var(--border);border-radius:9px;font:700 11px ui-monospace,monospace}.status[data-kind=fail]{color:var(--bad)}.status[data-kind=hold]{color:var(--warn)}code,pre{font:11px/1.45 ui-monospace,monospace;color:#79c9ff;overflow-wrap:anywhere}ol{display:grid;gap:8px;padding-left:22px}li{padding:10px;border:1px solid var(--border);border-radius:9px;background:var(--card);display:grid;gap:5px}@media(max-width:720px){.grid{grid-template-columns:1fr}}'+'</style></head><body><main class="shell"><section class="panel"><div class="badges"><span class="badge">EXPERIMENTAL</span><span class="badge">SHODAN</span><span class="badge">READ-ONLY METADATA</span><span class="badge hold">NO ACTIVE SCAN</span><span class="badge hold">NO TARGET CONNECTION</span></div><h1>Exposure Search</h1><p>Search Shodan metadata from the AXM browser without turning discovery into action. No scan endpoint, no credential testing, no automatic connection to returned hosts, and no vulnerable-target query pack.</p></section><section class="panel"><div class="grid"><label class="control"><span>Shodan query</span><input id="query" maxlength="400" placeholder="apache country:NL"></label><label class="control"><span>Mode</span><select id="mode"><option value="count">Count / facets</option><option value="search">First-page assets</option></select></label><label class="control"><span>Facets (optional, comma-separated)</span><input id="facets" maxlength="80" placeholder="country,org,port"></label><div class="control"><span>Explicit action</span><button id="run" class="button" type="button">Search exposure metadata</button></div></div><output id="status" class="status">CONNECTING…</output></section><section class="panel"><h2>Current browser context</h2><div id="browser"></div></section><section class="panel"><h2>Results</h2><p class="muted">Only normalized metadata is rendered. Raw Shodan banners are deliberately omitted.</p><div id="results"></div></section></main><script>'+CONTROLLER_SOURCE+'</script></body></html>';
}

function errorEnvelope(error) { return {schema:'axm.web.error/v1',code:String(error&&error.code||'UNEXPECTED_ERROR'),message:String(error&&error.message||error),details:error&&error.details?error.details:null,status:'FAIL'}; }
function sendJson(response,statusCode,value){const body=Canonical.stringify(value)+'\n';response.writeHead(statusCode,Object.assign({'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body)},securityHeaders()));response.end(body);}
function sendHtml(response,html){response.writeHead(200,Object.assign({'Content-Type':'text/html; charset=utf-8','Content-Length':Buffer.byteLength(html),'Content-Security-Policy':contentSecurityPolicy()},securityHeaders()));response.end(html);}
function readBounded(request,maxBytes){return new Promise(function(resolve,reject){const declared=Number(request.headers['content-length']);if(Number.isFinite(declared)&&declared>maxBytes){reject(Object.assign(new Error('request exceeds configured byte bound'),{code:'EXPOSURE_HOST_BYTES_LIMIT'}));request.resume();return}const chunks=[];let total=0;request.on('data',function(chunk){total+=chunk.length;if(total>maxBytes){reject(Object.assign(new Error('request exceeds configured byte bound'),{code:'EXPOSURE_HOST_BYTES_LIMIT'}));request.destroy();return}chunks.push(chunk)});request.on('end',()=>resolve(Buffer.concat(chunks,total)));request.on('error',reject)});}
async function readJson(request,maxBytes){const bytes=await readBounded(request,maxBytes);try{return JSON.parse(bytes.toString('utf8'))}catch(_error){throw Object.assign(new Error('request must contain valid JSON'),{code:'EXPOSURE_HOST_INVALID_JSON'})}}
function listen(server,port){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve()})});}
function close(server){return new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}

async function createExposureLabHost(options) {
  options = options || {};
  const port = options.port == null ? 0 : Number(options.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('port must be 0..65535');
  const maxJsonBytes = Number.isInteger(options.maxJsonBytes) && options.maxJsonBytes > 0 ? options.maxJsonBytes : DEFAULT_MAX_JSON_BYTES;
  const token = crypto.randomBytes(24).toString('base64url');
  const basePath = '/e/' + token + '/';
  const html = renderExposureLabHtml();
  let expectedOrigin = null;
  let lastRun = null;

  function visualSummary() {
    const visual = typeof options.visualStateProvider === 'function' ? options.visualStateProvider() : null;
    return visual ? { visualDigest: visual.visualDigest, fidelity: visual.visualFidelity, page: visual.page, viewport: visual.viewport } : null;
  }

  function state() {
    const material = {
      schema: EXPOSURE_LAB_STATE_SCHEMA,
      version: 1,
      status: 'EXPERIMENTAL',
      configured: Boolean(options.searchConfig && options.searchConfig.shodan && options.searchConfig.shodan.enabled === true),
      browserVisualState: visualSummary(),
      lastRun,
      authority: {
        automaticNetworkAllowed: false,
        activeScanAllowed: false,
        targetConnectionAllowed: false,
        credentialTestingAllowed: false,
        exploitExecutionAllowed: false,
        installAllowed: false,
        promotionAllowed: false,
        canonAllowed: false
      }
    };
    return Object.assign({}, material, { stateDigest: Digest.canonicalDigest(material) });
  }

  const server = http.createServer(async function(request,response){
    try {
      const host = String(request.headers.host || '');
      if (!expectedOrigin || host !== expectedOrigin.slice('http://'.length)) { sendJson(response,421,errorEnvelope(Object.assign(new Error('host header is outside loopback Exposure Lab origin'),{code:'EXPOSURE_HOST_HEADER_REFUSED'}))); return; }
      const requestUrl = new URL(request.url, expectedOrigin);
      if (!requestUrl.pathname.startsWith(basePath)) { sendJson(response,404,errorEnvelope(Object.assign(new Error('route not found'),{code:'EXPOSURE_HOST_ROUTE_NOT_FOUND'}))); return; }
      const route = requestUrl.pathname.slice(basePath.length);
      if (request.method === 'GET' && route === '') { sendHtml(response, html); return; }
      if (request.method === 'GET' && route === 'state') { sendJson(response,200,state()); return; }
      if (request.method === 'POST' && route === 'search') {
        const origin = String(request.headers.origin || '');
        if (!origin || origin !== expectedOrigin) { sendJson(response,403,errorEnvelope(Object.assign(new Error('Exposure Lab mutations require exact loopback shell Origin'),{code:'EXPOSURE_HOST_ORIGIN_REFUSED'}))); return; }
        if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] || ''))) { sendJson(response,415,errorEnvelope(Object.assign(new Error('Exposure Lab search requires application/json'),{code:'EXPOSURE_HOST_CONTENT_TYPE_REFUSED'}))); return; }
        const body = await readJson(request,maxJsonBytes);
        const plan = Exposure.buildExposurePlan(body, options.searchConfig || {});
        const execution = await ExposureExecutor.executeExposurePlan(plan, Object.assign({}, options.executorOptions || {}, { networkAuthority: options.networkAuthority }));
        lastRun = execution;
        sendJson(response,200,state());
        return;
      }
      sendJson(response,405,errorEnvelope(Object.assign(new Error('method or route not allowed'),{code:'EXPOSURE_HOST_METHOD_REFUSED'})));
    } catch (error) {
      if (!response.headersSent) sendJson(response,422,errorEnvelope(error)); else response.destroy();
    }
  });
  server.on('clientError',(_error,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  server.requestTimeout=30000;server.headersTimeout=5000;server.keepAliveTimeout=1000;server.maxHeadersCount=40;
  await listen(server,port);
  const address = server.address();
  expectedOrigin = 'http://127.0.0.1:' + address.port;
  const material = {
    schema: EXPOSURE_LAB_HOST_RECEIPT_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    origin: expectedOrigin,
    exposureUrl: expectedOrigin + basePath,
    loopbackTransportUsed: true,
    provider: 'shodan',
    activeScanAvailable: false,
    targetConnectionAvailable: false,
    credentialTestingAvailable: false,
    exploitExecutionAvailable: false
  };
  return {
    server,
    url: material.exposureUrl,
    receipt: Object.assign({}, material, { receiptDigest: Digest.canonicalDigest(material) }),
    state,
    close: function () { return close(server); }
  };
}

module.exports = {
  EXPOSURE_LAB_HOST_RECEIPT_SCHEMA,
  EXPOSURE_LAB_STATE_SCHEMA,
  DEFAULT_MAX_JSON_BYTES,
  PERMISSIONS_POLICY,
  CONTROLLER_SOURCE,
  controllerHash,
  contentSecurityPolicy,
  renderExposureLabHtml,
  createExposureLabHost
};
