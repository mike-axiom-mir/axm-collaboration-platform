#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'registry');
const VERIFY = process.argv.includes('--verify');

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, ''));
}

function stableJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function build() {
  const index = readJson('tools-index.json');
  const byId = new Map(index.tools.map(tool => [tool.id, tool]));
  const modules = index.tools.map(tool => ({
    id: tool.id,
    name: tool.name,
    status: tool.status,
    kind: tool.kind,
    audience: tool.audience,
    source_path: 'tools/' + tool.folder,
    entry_path: tool.entry && tool.entry.exists ? tool.entry.path : null,
    manifest: tool.manifest,
    contract: {
      path: tool.contract.path,
      present: tool.contract.present,
      valid: tool.contract.valid,
      provides: tool.contract.provides,
      consumes: tool.contract.consumes,
      errors: tool.contract.errors
    },
    tests: tool.selftest.paths,
    verified_at: tool.verifiedAt,
    freshness: tool.freshness,
    promotion: tool.promotion
  }));

  const capabilities = index.capabilities.map(capability => ({
    schema: 'axm.public-capability/v1',
    id: capability.id,
    providers: capability.providers,
    consumers: capability.consumers,
    provider_statuses: capability.providers.map(id => ({
      id,
      status: byId.has(id) ? byId.get(id).status : 'UNKNOWN'
    })),
    truth: {
      declaration_is_runtime_proof: false,
      grants_authority: false
    }
  }));

  const modulesDocument = {
    schema: 'axm.public-modules/v1',
    generated_at: index.generatedAt,
    source: {
      path: 'tools-index.json',
      digest: index.sourceDigest
    },
    summary: index.summary,
    truth: index.truth,
    modules
  };

  const publicStatus = {
    schema: 'axm.public-status/v1',
    generated_at: index.generatedAt,
    release_status: 'EXPERIMENTAL',
    source_digest: index.sourceDigest,
    discovery: {
      modules: modules.length,
      declared_capabilities: capabilities.length,
      modules_registry: 'registry/modules.json',
      capabilities_registry: 'registry/capabilities.jsonl'
    },
    gates: {
      public_safe: {
        state: 'VERIFY_AT_PUBLICATION',
        evidence: 'Deterministic public-safety scan and exact publication plan are required for each outgoing snapshot.'
      },
      windows_source_launch: {
        state: 'TEST',
        evidence: 'tests/windows-clean-launch-smoke.ps1 and .github/workflows/public-launch.yml',
        limitation: 'First bootstrap needs internet when compatible Node.js is absent.'
      },
      bundled_runtime: {
        state: 'NOT_INCLUDED',
        evidence: 'Top-level runtime is deliberately excluded from public source sync.'
      },
      offline_first_launch: {
        state: 'NOT_CLAIMED',
        evidence: null
      },
      first_time_human_test: {
        state: 'NOT_RUN',
        evidence: null
      },
      proof_one_guided_demo: {
        state: 'PLANNED',
        evidence: null
      }
    },
    truth: {
      public_safe_is_runnable: false,
      declaration_is_runtime_proof: false,
      selftest_is_human_approval: false,
      automatic_promotion: false,
      canon_requires_human_merge_gate: true
    }
  };

  const proofs = {
    schema: 'axm.public-proofs/v1',
    generated_at: index.generatedAt,
    claims: [
      {
        id: 'discovery-structure',
        claim: 'The public capability and module maps match tools-index.json.',
        evidence: ['scripts/generate-public-discovery.js', 'tests/public-discovery-selftest.js'],
        proves: ['static structure', 'registry consistency'],
        does_not_prove: ['runtime behavior', 'usability', 'human approval']
      },
      {
        id: 'windows-clean-launch',
        claim: 'The extracted Windows source candidate can bootstrap a pinned runtime and answer the Hub health route.',
        evidence: ['tests/windows-clean-launch-smoke.ps1', '.github/workflows/public-launch.yml'],
        proves: ['Windows x64/ARM64 first-run launch when nodejs.org is reachable'],
        does_not_prove: ['offline first launch', 'macOS/Linux launch', 'first-time human comprehension']
      },
      {
        id: 'public-safety',
        claim: 'The exact outgoing snapshot contains no configured public-safety blockers.',
        evidence: ['tools/workshop-packager/package-planner.js', 'shared/operations/github-sync-service.js'],
        proves: ['only the exact digest verified during publication'],
        does_not_prove: ['production security', 'license clearance for every future use']
      }
    ]
  };

  const capabilitiesText = capabilities.map(row => JSON.stringify(row)).join('\n') + '\n';
  const outputs = new Map([
    ['registry/modules.json', stableJson(modulesDocument)],
    ['registry/capabilities.jsonl', capabilitiesText],
    ['registry/public-status.json', stableJson(publicStatus)],
    ['registry/proofs.json', stableJson(proofs)]
  ]);
  const contentDigest = digest(Array.from(outputs.entries()).map(([name, content]) => name + '\0' + digest(content)).join('\n'));
  return { outputs, modules: modules.length, capabilities: capabilities.length, contentDigest };
}

function main() {
  const built = build();
  if (VERIFY) {
    const mismatches = [];
    for (const [relative, expected] of built.outputs) {
      const absolute = path.join(ROOT, relative);
      const actual = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
      if (actual !== expected) mismatches.push(relative);
    }
    if (mismatches.length) throw new Error('public discovery registry is stale: ' + mismatches.join(', '));
    console.log('public discovery registry: PASS (' + built.modules + ' modules, ' + built.capabilities + ' declared capabilities, digest ' + built.contentDigest + ')');
    return;
  }
  fs.mkdirSync(REGISTRY, { recursive: true });
  for (const [relative, content] of built.outputs) fs.writeFileSync(path.join(ROOT, relative), content, 'utf8');
  console.log('public discovery registry: wrote ' + built.modules + ' modules and ' + built.capabilities + ' declared capabilities');
}

try { main(); }
catch (error) { console.error(error.stack || error.message || error); process.exitCode = 1; }
