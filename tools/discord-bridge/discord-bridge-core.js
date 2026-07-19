'use strict';

const crypto = require('crypto');

const SCHEMA = 'axm.discord-bridge/v1';
const MAX_PROPOSALS = 500;
const MINIMAL_PERMISSIONS = 3072; // View Channel + Send Messages.

function now() { return new Date().toISOString(); }
function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 1000); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function snowflake(value) { const out = text(value, 30); return /^\d{5,30}$/.test(out) ? out : ''; }

function defaults() {
  return {
    schema: SCHEMA,
    enabled: false,
    paused: true,
    commandsEnabled: false,
    feedPostingEnabled: false,
    ordinaryMessageReading: false,
    lessonIntakeEnabled: false,
    applicationId: '',
    guildId: '',
    channelId: '',
    updatedAt: null,
    updatedBy: null
  };
}

function publicSettings(input) {
  const source = Object.assign(defaults(), input || {});
  return {
    schema: SCHEMA,
    enabled: source.enabled === true,
    paused: source.paused !== false,
    commandsEnabled: source.commandsEnabled === true,
    feedPostingEnabled: source.feedPostingEnabled === true,
    ordinaryMessageReading: false,
    lessonIntakeEnabled: source.lessonIntakeEnabled === true,
    applicationId: snowflake(source.applicationId),
    guildId: snowflake(source.guildId),
    channelId: snowflake(source.channelId),
    updatedAt: source.updatedAt || null,
    updatedBy: source.updatedBy || null
  };
}

function updateSettings(current, patch, actor) {
  if (!actor || actor.kind !== 'human' || !text(actor.id, 100)) {
    throw new Error('A named human actor must approve Discord configuration changes');
  }
  const out = publicSettings(current);
  const requested = patch || {};
  ['enabled', 'paused', 'commandsEnabled', 'feedPostingEnabled', 'lessonIntakeEnabled'].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(requested, key)) out[key] = requested[key] === true;
  });
  ['applicationId', 'guildId', 'channelId'].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(requested, key)) {
      const value = text(requested[key], 30);
      if (value && !snowflake(value)) throw new Error(key + ' must be a Discord numeric ID');
      out[key] = value;
    }
  });
  out.ordinaryMessageReading = false;
  out.updatedAt = now();
  out.updatedBy = { id: text(actor.id, 100), kind: 'human', name: text(actor.name || actor.id, 120) };
  return out;
}

function installUrl(applicationId) {
  const id = snowflake(applicationId);
  if (!id) return '';
  return 'https://discord.com/oauth2/authorize?client_id=' + encodeURIComponent(id) +
    '&permissions=' + MINIMAL_PERMISSIONS + '&scope=bot%20applications.commands';
}

function safeActor(actor) {
  if (!actor) return null;
  return { id: text(actor.id, 100), kind: ['human', 'machine', 'service'].includes(actor.kind) ? actor.kind : 'service', name: text(actor.name || actor.id, 120) };
}

function sanitizeAction(action) {
  if (!action || action.schema !== 'axm.action/v1') throw new Error('Only axm.action/v1 receipts are accepted');
  if (!['COMPLETE', 'FAILED'].includes(action.state)) throw new Error('Only completed action receipts are accepted');
  const receipt = action.receipt || {};
  return {
    schema: 'axm.discord-action-receipt/v1',
    id: text(action.id, 120),
    name: text(action.name, 160),
    tool: text(action.tool, 100),
    operation: text(action.operation, 100),
    requestedPermission: text(action.requestedPermission, 100),
    actor: safeActor(action.actor),
    state: action.state,
    approval: action.approval ? {
      decision: text(action.approval.decision, 40),
      actor: safeActor(action.approval.actor),
      reason: text(action.approval.reason, 300),
      at: action.approval.at || null
    } : null,
    receipt: {
      ok: receipt.ok === true,
      evidence: (Array.isArray(receipt.evidence) ? receipt.evidence : []).map(item => text(typeof item === 'string' ? item : JSON.stringify(item), 280)).filter(Boolean).slice(0, 4),
      error: text(receipt.error, 300),
      actor: safeActor(receipt.actor),
      at: receipt.at || null
    },
    createdAt: action.createdAt || null,
    updatedAt: action.updatedAt || null
  };
}

function actorLine(actor) {
  if (!actor) return 'unrecorded';
  return (actor.name || actor.id || 'unknown') + ' (' + actor.kind + ')';
}

function renderReceipt(receipt) {
  const mark = receipt.state === 'COMPLETE' ? 'COMPLETE' : 'FAILED';
  const approval = receipt.approval ? receipt.approval.decision + ' by ' + actorLine(receipt.approval.actor) : 'no approval recorded';
  const evidence = receipt.receipt.evidence.length ? receipt.receipt.evidence.map(item => '- ' + item).join('\n') : '- no evidence text recorded';
  const error = receipt.receipt.error ? '\n**Error:** ' + receipt.receipt.error : '';
  return [
    '**AXM Machine-Honest Feed · ' + mark + '**',
    '**Action:** ' + (receipt.name || receipt.operation || 'Unnamed action'),
    '**Tool / operation:** `' + (receipt.tool || 'unknown') + '` / `' + (receipt.operation || 'unknown') + '`',
    '**Requested by:** ' + actorLine(receipt.actor),
    '**Gate:** ' + approval,
    '**Receipt by:** ' + actorLine(receipt.receipt.actor),
    '**Evidence:**', evidence + error,
    '_Attributed Workshop receipt; not independent proof. Raw inputs, outputs, prompts, and secrets are never posted._'
  ].join('\n').slice(0, 1950);
}

function proposalFromInteraction(interaction, body) {
  const memberUser = interaction && interaction.member && interaction.member.user;
  const directUser = interaction && interaction.user;
  const user = memberUser || directUser || {};
  const content = text(body, 1200);
  if (!content) throw new Error('Proposal text is required');
  return {
    schema: 'axm.discord-proposal/v1',
    id: 'discord-proposal-' + crypto.randomUUID(),
    source: 'discord-slash-command',
    body: content,
    state: 'PROPOSED',
    author: { discordUserId: snowflake(user.id), displayName: text(user.global_name || user.username || 'Discord member', 120) },
    guildId: snowflake(interaction.guild_id),
    channelId: snowflake(interaction.channel_id),
    interactionId: snowflake(interaction.id),
    createdAt: now(),
    trainingEligible: false,
    executionAuthorized: false
  };
}

function appendBounded(list, item, limit) {
  return (Array.isArray(list) ? list : []).concat([clone(item)]).slice(-Math.max(1, Number(limit) || MAX_PROPOSALS));
}

module.exports = {
  SCHEMA, MAX_PROPOSALS, MINIMAL_PERMISSIONS, defaults, publicSettings, updateSettings,
  installUrl, sanitizeAction, renderReceipt, proposalFromInteraction, appendBounded
};
