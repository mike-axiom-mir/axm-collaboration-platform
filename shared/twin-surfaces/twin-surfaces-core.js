'use strict';

const crypto = require('crypto');
const HIGH_RISK = new Set(['EXECUTE_TRUSTED', 'NETWORK_WRITE', 'PUBLIC_RELEASE', 'PHYSICAL_ACTUATION', 'PROMOTION', 'CANON_CHANGE', 'ROOT_CHANGE']);

class TwinError extends Error {
  constructor(code, message, details) { super(message); this.name = 'TwinError'; this.code = code; this.details = details || null; }
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function risk(effects, unknownDeclarations) {
  if (effects.some(value => HIGH_RISK.has(value))) return 'HIGH';
  if (unknownDeclarations.length) return 'UNKNOWN';
  if (effects.some(value => ['WRITE_CANDIDATE', 'EXECUTE_CONFINED', 'READ_PRIVATE', 'NETWORK_READ'].includes(value))) return 'MEDIUM';
  return 'LOW';
}

function compile(graph, schemaRegistry) {
  if (!graph || graph.schema !== 'axm.city-graph/v1' || !schemaRegistry || schemaRegistry.schema !== 'axm.schema-registry/v1') throw new TwinError('INVALID_TWIN_SOURCE', 'Twin compiler requires city graph and schema registry');
  if (schemaRegistry.graphDigest !== graph.semanticDigest) throw new TwinError('TWIN_SOURCE_DRIFT', 'Schema registry and city graph name different graph digests');
  const effectPackets = [];
  const machinePackets = graph.blocks.map(block => {
    const effects = block.effects.capable.slice().sort();
    const packetBase = { schema: 'axm.machine-capability-packet/v1', blockId: block.id, blockDigest: block.source.digest, kind: block.classification.kind, classificationState: block.classification.state, status: block.status, capabilities: block.sockets.provides.slice().sort(), consumes: block.sockets.consumes.slice().sort(), effects, unknownEffectDeclarations: block.effects.unknownDeclarations.slice().sort(), authorityGrants: [], risk: risk(effects, block.effects.unknownDeclarations) };
    const packet = { ...packetBase, packetDigest: sha256(canonical(packetBase)) };
    for (const effectClass of effects) {
      const effectBase = { schema: 'axm.effect-request-template/v1', blockId: block.id, blockDigest: block.source.digest, capabilityPacketDigest: packet.packetDigest, effectClass, requiresExactTargetDigest: true, requiresExactScope: true, requiresAuthorityDecision: effectClass !== 'NONE' && effectClass !== 'OBSERVE_LOCAL', grantsAuthority: false };
      effectPackets.push({ ...effectBase, packetDigest: sha256(canonical(effectBase)) });
    }
    return packet;
  }).sort((a, b) => a.blockId.localeCompare(b.blockId));
  effectPackets.sort((a, b) => `${a.blockId}:${a.effectClass}`.localeCompare(`${b.blockId}:${b.effectClass}`));
  const effectsByBlock = new Map();
  for (const packet of effectPackets) { if (!effectsByBlock.has(packet.blockId)) effectsByBlock.set(packet.blockId, []); effectsByBlock.get(packet.blockId).push(packet.packetDigest); }
  const humanLabels = machinePackets.map(packet => ({
    blockId: packet.blockId, name: graph.blocks.find(row => row.id === packet.blockId).name, status: packet.status, kind: packet.kind,
    beginnerSummary: `${packet.capabilities.length} declared capability(s); ${packet.effects.length} effect class(es); risk ${packet.risk}`,
    capabilities: packet.capabilities, effects: packet.effects, risk: packet.risk, machinePacketDigest: packet.packetDigest,
    effectPacketDigests: (effectsByBlock.get(packet.blockId) || []).slice(), safe: null, grantsAuthority: false
  }));
  const base = {
    schema: 'axm.twin-surface/v1', graphDigest: graph.semanticDigest, schemaRegistryDigest: schemaRegistry.registryDigest, machinePackets, effectPackets, humanLabels,
    truth: { humanSourceOfTruth: false, machinePacketGrantsAuthority: false, humanLabelGrantsAuthority: false, digestProvesSafety: false, missingEffectMeansSafe: false, beginnerViewPreservesCapabilities: true, beginnerViewPreservesRisk: true }
  };
  return { ...base, twinDigest: sha256(canonical(base)) };
}

function verify(twin) {
  if (!twin || twin.schema !== 'axm.twin-surface/v1') throw new TwinError('INVALID_TWIN', 'Expected axm.twin-surface/v1');
  const { twinDigest, ...base } = twin;
  if (sha256(canonical(base)) !== twinDigest) throw new TwinError('TWIN_DIGEST_DRIFT', 'Twin fields do not match twinDigest');
  const machine = new Map(twin.machinePackets.map(row => [row.packetDigest, row]));
  const effects = new Map(twin.effectPackets.map(row => [row.packetDigest, row]));
  if (machine.size !== twin.machinePackets.length) throw new TwinError('DUPLICATE_MACHINE_PACKET', 'Machine packet digests must be unique');
  if (effects.size !== twin.effectPackets.length) throw new TwinError('DUPLICATE_EFFECT_PACKET', 'Effect packet digests must be unique');
  if (twin.humanLabels.length !== twin.machinePackets.length || new Set(twin.humanLabels.map(row => row.blockId)).size !== twin.humanLabels.length) throw new TwinError('HUMAN_MACHINE_TWIN_OMISSION', 'Every machine block requires exactly one human label');
  for (const label of twin.humanLabels) {
    const packet = machine.get(label.machinePacketDigest);
    if (!packet || packet.blockId !== label.blockId || canonical(packet.capabilities) !== canonical(label.capabilities) || canonical(packet.effects) !== canonical(label.effects) || packet.risk !== label.risk) throw new TwinError('HUMAN_MACHINE_TWIN_DRIFT', `Human label ${label.blockId} exceeds or differs from machine packet`);
    for (const digest of label.effectPacketDigests) { const effect = effects.get(digest); if (!effect || effect.blockId !== label.blockId || !label.effects.includes(effect.effectClass)) throw new TwinError('HUMAN_EFFECT_PACKET_DRIFT', `Human effect for ${label.blockId} lacks an exact packet`); }
    if (label.effectPacketDigests.length !== label.effects.length) throw new TwinError('HUMAN_EFFECT_PACKET_DRIFT', `Human label ${label.blockId} does not map every effect`);
  }
  for (const packet of twin.machinePackets) if (!twin.humanLabels.some(label => label.machinePacketDigest === packet.packetDigest)) throw new TwinError('HUMAN_MACHINE_TWIN_OMISSION', `Machine packet ${packet.blockId} has no human twin`);
  return true;
}

function humanMarkdown(twin) {
  verify(twin);
  const lines = ['# AXM LEGO Software City — Beginner Twin', '', 'Status: **EXPERIMENTAL generated view**', '', `Twin digest: \`${twin.twinDigest}\``, '', 'Every row is derived from an exact machine packet. “Low” is relative declared-effect risk, not a safety claim. No row grants authority.', '', '| Block | Kind | Status | Capability | Effects | Risk | Exact packet |', '|---|---|---|---:|---|---|---|'];
  for (const row of twin.humanLabels) lines.push(`| ${row.blockId} | ${row.kind} | ${row.status} | ${row.capabilities.length} | ${row.effects.join(', ')} | ${row.risk} | \`${row.machinePacketDigest.slice(0, 16)}…\` |`);
  lines.push('', 'Human labels are downstream views. Exact effect templates are stored in `registry/generated/city-twins.json`; each requires target/scope binding and grants no authority.', '');
  return lines.join('\n');
}

module.exports = { HIGH_RISK, TwinError, canonical, sha256, risk, compile, verify, humanMarkdown };
