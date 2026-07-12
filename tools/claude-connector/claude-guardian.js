'use strict';

const fs = require('fs');
const path = require('path');
const { classify } = require('../shell-guardian/guardian-hook');
const { scheduleClaudeCutoff } = require('./claude-process-cutoff');

const WORKSHOP = path.resolve(__dirname, '..', '..');
const STATE_DIR = path.join(WORKSHOP, 'state', 'claude-guardian');
const STATUS_FILE = path.join(STATE_DIR, 'status.json');
const EVENT_FILE = path.join(STATE_DIR, 'events.jsonl');
const HEARTBEAT_TTL_MS = 90000;

const PROTECTED_TARGET = /(?:claude-connector|claude-guardian|\.claude[\\/]settings(?:\.local)?\.json)/i;
const MUTATING_ACTION = /(?:remove-item|del\b|erase\b|move-item|rename-item|set-content|add-content|out-file|copy-item)/i;
const CLAUDE_CREDENTIAL_PATTERN = /\.claude[\\/](?:credentials|auth)(?:\.json)?\b/i;
const SHELL_TOOL = /^(?:Bash|Shell|PowerShell|Cmd)$/i;
const INLINE_INTERPRETER = /(?:\bnode(?:\.exe)?\s+(?:--eval|-e)\b|\bpython(?:3|\.exe)?\s+-c\b|\bruby(?:\.exe)?\s+-e\b|\b(?:wscript|cscript|mshta)(?:\.exe)?\b)/i;

function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    hookEventName: String(raw.hook_event_name || raw.hookEventName || '').trim(),
    sessionId: raw.session_id || raw.sessionId || null,
    cwd: raw.cwd || null,
    toolName: raw.tool_name || raw.toolName || null,
    toolInput: raw.tool_input || raw.toolInput || {}
  };
}

function flattenToolText(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return '';
  const parts = [];
  for (const key of ['command', 'cmd', 'script', 'path', 'file_path', 'filePath', 'target', 'patch']) {
    if (typeof toolInput[key] === 'string') parts.push(toolInput[key]);
  }
  return parts.length ? parts.join('\n') : '';
}

function localTamperTrip(event) {
  const toolName = String(event.toolName || 'unknown');
  const input = event.toolInput || {};
  const target = String(input.file_path || input.filePath || input.path || input.target || '');
  const text = flattenToolText(input);
  const combined = toolName + '\n' + target + '\n' + text;
  if (SHELL_TOOL.test(toolName) && PROTECTED_TARGET.test(combined)) {
    return { decision: 'trip', severity: 'red', reason: 'protected Claude Guardian target referenced from a general shell tool', toolName, text };
  }
  if (/^(?:Edit|Write|MultiEdit|apply_patch)$/i.test(toolName) && PROTECTED_TARGET.test(target + '\n' + text)) {
    return { decision: 'trip', severity: 'red', reason: 'attempt to modify Claude Guardian, connector, or hook settings', toolName, text };
  }
  if (PROTECTED_TARGET.test(combined) && MUTATING_ACTION.test(combined)) {
    return { decision: 'trip', severity: 'red', reason: 'Claude Guardian or connector tampering pattern', toolName, text };
  }
  if (CLAUDE_CREDENTIAL_PATTERN.test(combined)) {
    return { decision: 'trip', severity: 'red', reason: 'Claude credential store access', toolName, text };
  }
  if (SHELL_TOOL.test(toolName) && INLINE_INTERPRETER.test(combined)) {
    return { decision: 'allow', severity: 'warn', reason: 'inline interpreter invocation requires audit attention', toolName, text };
  }
  return null;
}

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch (_) {
    return {
      schema: 'axm.claude-guardian-status/v1',
      connectorId: 'claude',
      tripped: false,
      tripCount: 0,
      resetCount: 0
    };
  }
}

function writeStatus(status) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2) + '\n');
}

function appendEvent(entry) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.appendFileSync(EVENT_FILE, JSON.stringify(entry) + '\n');
}

function buildDenyOutput(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'AXM CLAUDE GUARDIAN: ' + reason
    }
  };
}

function evaluatePreToolUse(event) {
  const local = localTamperTrip(event);
  const result = local || classify({
    tool_name: event.toolName,
    tool_input: event.toolInput,
    session_id: event.sessionId,
    cwd: event.cwd
  });
  return result;
}

function handleSessionStart(event, options) {
  options = options || {};
  const at = new Date().toISOString();
  appendEvent({
    schema: 'axm.claude-guardian-event/v1',
    at,
    hookEventName: 'SessionStart',
    sessionId: event.sessionId,
    cwd: event.cwd,
    severity: 'normal',
    decision: 'observe',
    reason: 'session heartbeat registered'
  });
  const status = readStatus();
  status.schema = 'axm.claude-guardian-status/v1';
  status.connectorId = 'claude';
  status.lastSeenAt = at;
  status.updatedAt = at;
  writeStatus(status);
  return { exitCode: 0, stdout: '', stderr: '' };
}

function handlePreToolUse(event, options) {
  options = options || {};
  const at = new Date().toISOString();

  const existing = readStatus();
  if (existing.tripped) {
    const locked = {
      schema: 'axm.claude-guardian-event/v1', at,
      hookEventName: 'PreToolUse', sessionId: event.sessionId, cwd: event.cwd,
      toolName: event.toolName || 'unknown', severity: 'red', decision: 'deny',
      reason: 'Claude circuit remains tripped until explicit reset', preview: ''
    };
    appendEvent(locked);
    return { exitCode: 0, stdout: JSON.stringify(buildDenyOutput(locked.reason)), stderr: '' };
  }

  let result;
  try {
    result = evaluatePreToolUse(event);
  } catch (error) {
    appendEvent({
      schema: 'axm.claude-guardian-event/v1',
      at,
      hookEventName: 'PreToolUse',
      severity: 'error',
      decision: 'deny',
      reason: 'Guardian internal error; failed closed',
      preview: String(error && error.message || error)
    });
    return {
      exitCode: 2,
      stdout: JSON.stringify(buildDenyOutput('internal policy failure')),
      stderr: 'AXM CLAUDE GUARDIAN ERROR: internal policy failure'
    };
  }

  const entry = {
    schema: 'axm.claude-guardian-event/v1',
    at,
    hookEventName: 'PreToolUse',
    sessionId: event.sessionId,
    cwd: event.cwd,
    toolName: result.toolName,
    severity: result.severity,
    decision: result.decision,
    reason: result.reason,
    preview: String(result.text || '').slice(0, 1200)
  };
  appendEvent(entry);

  const status = readStatus();
  status.schema = 'axm.claude-guardian-status/v1';
  status.connectorId = 'claude';
  status.lastEvent = entry;
  status.updatedAt = at;
  status.lastSeenAt = at;

  if (result.decision === 'trip') {
    status.tripped = true;
    status.trippedAt = at;
    status.tripCount = Number(status.tripCount || 0) + 1;
    status.reason = result.reason;
    status.connectionAction = 'claude process tree termination scheduled';
    writeStatus(status);
    if (!options.noCutoff) scheduleClaudeCutoff();
    return {
      exitCode: 0,
      stdout: JSON.stringify(buildDenyOutput(result.reason)),
      stderr: ''
    };
  }

  writeStatus(status);
  return { exitCode: 0, stdout: '', stderr: '' };
}

function handleEvent(raw, options) {
  const event = normalizeEvent(raw);
  if (!event) {
    return {
      exitCode: 2,
      stdout: JSON.stringify(buildDenyOutput('malformed hook event')),
      stderr: 'AXM CLAUDE GUARDIAN ERROR: malformed hook event'
    };
  }
  const hookName = event.hookEventName;
  if (hookName === 'SessionStart') return handleSessionStart(event, options);
  if (hookName === 'PreToolUse') return handlePreToolUse(event, options);
  if (!hookName) {
    return {
      exitCode: 2,
      stdout: JSON.stringify(buildDenyOutput('missing hook_event_name')),
      stderr: 'AXM CLAUDE GUARDIAN ERROR: unknown hook event'
    };
  }
  return { exitCode: 0, stdout: '', stderr: '' };
}

function main() {
  let raw;
  try {
    const text = (fs.readFileSync(0, 'utf8') || '{}').replace(/^\uFEFF/, '').replace(/^ï»¿/, '');
    raw = JSON.parse(text);
  } catch (error) {
    try {
      appendEvent({
        schema: 'axm.claude-guardian-event/v1',
        at: new Date().toISOString(),
        hookEventName: 'PreToolUse',
        severity: 'error',
        decision: 'deny',
        reason: 'malformed hook event; Guardian failed closed',
        preview: error.message
      });
    } catch (_) {}
    process.stderr.write('AXM CLAUDE GUARDIAN ERROR: malformed hook event\n');
    process.stdout.write(JSON.stringify(buildDenyOutput('malformed hook event')));
    process.exit(2);
  }

  const handled = handleEvent(raw);
  if (handled.stderr) process.stderr.write(handled.stderr + (handled.stderr.endsWith('\n') ? '' : '\n'));
  if (handled.stdout) process.stdout.write(handled.stdout);
  process.exit(handled.exitCode);
}

module.exports = {
  normalizeEvent,
  evaluatePreToolUse,
  handleEvent,
  handlePreToolUse,
  handleSessionStart,
  buildDenyOutput,
  STATUS_FILE,
  EVENT_FILE,
  STATE_DIR,
  HEARTBEAT_TTL_MS
};

if (require.main === module) main();
