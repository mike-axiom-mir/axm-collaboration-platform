#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = 'axm.ci.web-security-sentinel/v1';
const MAX_FINDINGS = 64;

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function readSources(root) {
  const names = {
    hostFacade: 'src/local-browser-host.js',
    hostCore: 'src/local-browser-host-core.js',
    snapshot: 'examples/simple.browser-snapshot.html',
    svg: 'examples/simple.structure.svg'
  };
  const sources = {};
  Object.keys(names).forEach(function (key) {
    const relative = names[key];
    sources[key] = { relative, text: fs.readFileSync(path.join(root, relative), 'utf8') };
  });
  return sources;
}

function audit(sources) {
  const findings = [];
  let total = 0;
  let passed = 0;

  function check(condition, code, message) {
    total += 1;
    if (condition) {
      passed += 1;
      return;
    }
    if (findings.length < MAX_FINDINGS) findings.push({ code, message });
  }

  const facade = sources.hostFacade.text;
  const host = sources.hostCore.text;
  const html = sources.snapshot.text;
  const svg = sources.svg.text;

  check(!/require\(['"]node:(?:https|net|tls|dns|dgram|child_process|vm)['"]\)/.test(host), 'HOST_PRIVILEGED_MODULE', 'loopback host core imports a held privileged/network module');
  check(!/\b(?:eval\s*\(|new\s+Function\b)/.test(host), 'HOST_DYNAMIC_EVAL', 'loopback host core contains dynamic evaluation');
  check(!/(?:\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML\b|document\.write\b)/.test(host), 'HOST_HTML_INJECTION_SINK', 'trusted shell core contains an unsafe HTML injection sink');
  check(!/(?:new\s+WebSocket\b|new\s+EventSource\b|navigator\.sendBeacon\b)/.test(host), 'HOST_ACTIVE_NETWORK_CHANNEL', 'trusted shell core contains an undeclared active browser network channel');
  check(/server\.listen\(port, '127\.0\.0\.1'/.test(host), 'HOST_NOT_LOOPBACK_BOUND', 'server listener is not explicitly bound to 127.0.0.1');
  check(/crypto\.randomBytes\(24\)/.test(host), 'HOST_CAPABILITY_TOKEN_WEAKENED', 'capability path token is no longer generated from 24 random bytes');
  check(host.includes("const origin = String(request.headers.origin || '');") && host.includes('if (!origin)') && host.includes("code: 'HOST_ORIGIN_REQUIRED'"), 'HOST_ORIGIN_GUARD_MISSING', 'POST mutation path must fail closed when Origin is missing');
  check(host.includes("'Cross-Origin-Opener-Policy': 'same-origin'"), 'HOST_COOP_MISSING', 'trusted shell lost same-origin opener isolation');
  check(host.includes("'Cross-Origin-Resource-Policy': 'same-origin'"), 'HOST_CORP_MISSING', 'trusted shell lost same-origin resource policy');
  check(host.includes("'Permissions-Policy': PERMISSIONS_POLICY") && ['camera=()', 'microphone=()', 'geolocation=()', 'display-capture=()', 'usb=()', 'serial=()', 'hid=()', 'bluetooth=()'].every(function (directive) { return host.includes(directive); }), 'HOST_PERMISSIONS_POLICY_MISSING', 'trusted shell lost deny-all unused device capability policy');

  check(facade.includes("require('./local-browser-host-core')"), 'HOST_FACADE_CORE_BINDING_MISSING', 'host facade no longer delegates to the audited host core');
  check(facade.includes("require('./shell-policy')"), 'HOST_FACADE_POLICY_BINDING_MISSING', 'host facade no longer imports the shell policy');
  check(facade.includes('shellPolicySchema: shellPolicy.schema') && facade.includes('shellPolicyDigest: shellPolicy.policyDigest'), 'HOST_RECEIPT_POLICY_BINDING_MISSING', 'live host receipt no longer binds shell policy schema/digest');
  check(facade.includes('delete receiptMaterial.receiptDigest') && facade.includes('Digest.canonicalDigest(receiptMaterial)'), 'HOST_RECEIPT_REBIND_MISSING', 'policy-bound host receipt is not re-digested after adding policy lineage');
  check(!/\b(?:eval\s*\(|new\s+Function\b)/.test(facade), 'HOST_FACADE_DYNAMIC_EVAL', 'host policy facade contains dynamic evaluation');

  const fetchTargets = [];
  const fetchRe = /\bfetch\(\s*(['"])([^'"]+)\1/g;
  let match;
  while ((match = fetchRe.exec(host))) fetchTargets.push(match[2]);
  check(fetchTargets.length === 2 && fetchTargets.includes('action') && fetchTargets.includes('state'), 'HOST_FETCH_SURFACE_DRIFT', 'trusted shell fetch surface must remain exactly relative action/state routes');

  [
    "default-src 'none'",
    "connect-src 'self'",
    "img-src 'none'",
    "font-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "worker-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].forEach(function (directive) {
    check(host.includes(directive), 'HOST_CSP_DIRECTIVE_MISSING', 'trusted shell CSP lost directive: ' + directive);
  });

  check(!/<script\b/i.test(html), 'HTML_SCRIPT_ACTIVE', 'committed Structure View contains a script element');
  check(!/<(?:iframe|frame|object|embed|form|img|video|audio|source)\b/i.test(html), 'HTML_ACTIVE_ELEMENT', 'committed Structure View contains an active/resource-bearing element');
  check(!/\son[a-z]+\s*=/i.test(html), 'HTML_EVENT_HANDLER', 'committed Structure View contains an inline event handler');
  check(!/\s(?:src|srcset|action|formaction)\s*=/i.test(html), 'HTML_RESOURCE_ATTRIBUTE', 'committed Structure View contains an active resource/form attribute');
  const hrefs = Array.from(html.matchAll(/\shref="([^"]*)"/gi), function (item) { return item[1]; });
  check(hrefs.every(function (href) { return /^#(?:document-map|entry-[0-9]{4})$/.test(href); }), 'HTML_HREF_OUTSIDE_DOCUMENT', 'committed Structure View href escaped the trusted same-document anchor set');
  check(html.includes("default-src 'none'"), 'HTML_CSP_MISSING', 'committed Structure View lost deny-by-default CSP');

  check(!/<script\b/i.test(svg), 'SVG_SCRIPT_ACTIVE', 'committed SVG contains a script element');
  check(!/<foreignObject\b/i.test(svg), 'SVG_FOREIGN_OBJECT', 'committed SVG contains foreignObject');
  check(!/<(?:image|use|a)\b/i.test(svg), 'SVG_ACTIVE_REFERENCE_ELEMENT', 'committed SVG contains a reference-bearing element');
  check(!/\s(?:href|xlink:href|on[a-z]+)\s*=/i.test(svg), 'SVG_ACTIVE_ATTRIBUTE', 'committed SVG contains an active reference/event attribute');
  check(!/url\(\s*['"]?https?:/i.test(svg), 'SVG_EXTERNAL_URL', 'committed SVG contains an external URL reference');

  const material = {
    schema: SCHEMA,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    checks: { total, passed, failed: total - passed },
    findingCount: findings.length,
    findings,
    audited: {
      hostFacade: { path: sources.hostFacade.relative, sha256: sha256(facade) },
      hostCore: { path: sources.hostCore.relative, sha256: sha256(host) },
      snapshot: { path: sources.snapshot.relative, sha256: sha256(html) },
      svg: { path: sources.svg.relative, sha256: sha256(svg) }
    },
    authority: { mutationAllowed: false, promotionAllowed: false, canonAllowed: false }
  };
  return Object.assign({}, material, { sentinelDigest: sha256(JSON.stringify(material)) });
}

function requireFinding(result, code) {
  if (result.status !== 'FAIL' || !result.findings.some(function (finding) { return finding.code === code; })) {
    throw new Error('security sentinel selftest did not detect ' + code);
  }
}

function selftest(sources) {
  const clean = audit(sources);
  if (clean.status !== 'PASS') throw new Error('clean browser artifacts failed independent security sentinel');

  const hostEval = JSON.parse(JSON.stringify(sources));
  hostEval.hostCore.text += "\neval('1');\n";
  requireFinding(audit(hostEval), 'HOST_DYNAMIC_EVAL');

  const hostFetch = JSON.parse(JSON.stringify(sources));
  hostFetch.hostCore.text += "\nfetch('https://example.invalid/');\n";
  requireFinding(audit(hostFetch), 'HOST_FETCH_SURFACE_DRIFT');

  const hostOrigin = JSON.parse(JSON.stringify(sources));
  hostOrigin.hostCore.text = hostOrigin.hostCore.text.replace("code: 'HOST_ORIGIN_REQUIRED'", "code: 'HOST_ORIGIN_NOT_REQUIRED'");
  requireFinding(audit(hostOrigin), 'HOST_ORIGIN_GUARD_MISSING');

  const hostIsolation = JSON.parse(JSON.stringify(sources));
  hostIsolation.hostCore.text = hostIsolation.hostCore.text.replace("'Cross-Origin-Opener-Policy': 'same-origin'", "'Cross-Origin-Opener-Policy': 'unsafe-none'");
  requireFinding(audit(hostIsolation), 'HOST_COOP_MISSING');

  const facadeBinding = JSON.parse(JSON.stringify(sources));
  facadeBinding.hostFacade.text = facadeBinding.hostFacade.text.replace('shellPolicyDigest: shellPolicy.policyDigest', 'shellPolicyDigest: null');
  requireFinding(audit(facadeBinding), 'HOST_RECEIPT_POLICY_BINDING_MISSING');

  const htmlScript = JSON.parse(JSON.stringify(sources));
  htmlScript.snapshot.text += '<script>console.log(1)</script>';
  requireFinding(audit(htmlScript), 'HTML_SCRIPT_ACTIVE');

  const svgForeign = JSON.parse(JSON.stringify(sources));
  svgForeign.svg.text += '<foreignObject></foreignObject>';
  requireFinding(audit(svgForeign), 'SVG_FOREIGN_OBJECT');
}

function main(argv) {
  const args = argv.slice();
  const selftestRequested = args.includes('--selftest');
  const rootArg = args.find(function (arg) { return arg !== '--selftest'; }) || process.cwd();
  const root = path.resolve(rootArg);
  const sources = readSources(root);
  if (selftestRequested) selftest(sources);
  const result = audit(sources);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.status !== 'PASS') process.exitCode = 1;
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('independent native web security sentinel failed: ' + String(error && error.message || error) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { readSources, audit, selftest };
