'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const WORKSHOP = path.resolve(__dirname, '..', '..');
const STATE_DIR = path.join(WORKSHOP, 'state', 'shell-guardian');
const STATUS_FILE = path.join(STATE_DIR, 'status.json');
const EVENT_FILE = path.join(STATE_DIR, 'events.jsonl');

const RED_COMMANDS = [
  ['destructive disk or boot command', /(?:^|[;&|]\s*)(?:format(?:\.com)?\s+[a-z]:|diskpart\b|bcdedit\b|cipher\s+\/w:)/i],
  ['root filesystem destruction', /(?:rm\s+-[a-z]*r[a-z]*f|rm\s+-[a-z]*f[a-z]*r)\s+(?:\/|~|[a-z]:\\)(?:\s|$|\*)/i],
  ['Windows drive-root recursive deletion', /remove-item\s+['"]?[a-z]:\\(?:\*|['"]?\s).*(?:-recurse|-force)/i],
  ['credential or private-key access', /(?:\.ssh[\\/]|\.gnupg[\\/]|\.aws[\\/](?:credentials|config)|\.azure[\\/]|\.config[\\/]gcloud|\.grok[\\/]auth\.json|mcp_credentials\.json|credential\s*manager|cmdkey\s+\/list)/i],
  ['persistence through scheduled task or service', /(?:schtasks(?:\.exe)?\s+\/create|new-service\b|sc(?:\.exe)?\s+create\b|reg(?:\.exe)?\s+add\s+[^\r\n]*(?:\\run|\\runonce))/i],
  ['new or elevated administrator path', /(?:start-process[^\r\n]*-verb\s+runas|net(?:\.exe)?\s+(?:user|localgroup\s+administrators)\b|runas(?:\.exe)?\s+\/user:)/i],
  ['security control disable attempt', /(?:set-mppreference[^\r\n]*disable|stop-service\s+(?:windefend|mpssvc)|netsh\s+advfirewall[^\r\n]*state\s+off|set-netfirewallprofile[^\r\n]*-enabled\s+false)/i],
  ['encoded or download-and-execute payload', /(?:invoke-expression\b|\biex\b|-(?:enc|encodedcommand)\b|frombase64string\b|(?:irm|invoke-restmethod|iwr|invoke-webrequest|curl(?:\.exe)?)[^\r\n|]*\|\s*(?:iex|invoke-expression|bash|sh|powershell))/i],
  ['guardian or hook tampering', /(?:shell-guardian|axm-shell-guardian|\.grok[\\/]hooks)[^\r\n]*(?:remove-item|del\b|erase\b|move-item|rename-item|set-content|add-content|out-file|copy-item)/i]
];

const WARN_COMMANDS = [
  ['recursive deletion', /(?:remove-item[^\r\n]*(?:-recurse|-force)|rm\s+-[a-z]*r)/i],
  ['history-rewriting git command', /git\s+(?:reset\s+--hard|clean\s+-[a-z]*f|push\s+[^\r\n]*--force)/i],
  ['software installation', /(?:npm|pnpm|yarn|pip|winget|choco)\s+(?:install|add)/i],
  ['remote download', /(?:curl(?:\.exe)?|invoke-webrequest|invoke-restmethod|\biwr\b|\birm\b)\s+/i]
];

function flattenInput(input) {
  if (!input) return '';
  if (typeof input === 'string') return input;
  const preferred = ['command', 'cmd', 'script', 'path', 'file_path', 'filePath', 'target', 'patch'];
  const parts = [];
  for (const key of preferred) if (typeof input[key] === 'string') parts.push(input[key]);
  if (parts.length) return parts.join('\n');
  try { return JSON.stringify(input); } catch (_) { return String(input); }
}

function classify(event) {
  const toolName = String(event && (event.toolName || event.tool_name) || 'unknown');
  const input = event && (event.toolInput || event.tool_input) || {};
  const text = flattenInput(input);
  const target = String(input.file_path || input.filePath || input.path || input.target || '');
  const combined = toolName + '\n' + target + '\n' + text;

  if (/^(?:Edit|Write|MultiEdit|apply_patch)$/i.test(toolName) && /(?:shell-guardian|axm-shell-guardian|\.grok[\\/]hooks)/i.test(combined)) {
    return { decision: 'trip', severity: 'red', reason: 'attempt to modify Shell Guardian or its hook', toolName, text };
  }
  for (const [reason, pattern] of RED_COMMANDS) {
    if (pattern.test(combined)) return { decision: 'trip', severity: 'red', reason, toolName, text };
  }
  for (const [reason, pattern] of WARN_COMMANDS) {
    if (pattern.test(combined)) return { decision: 'allow', severity: 'warn', reason, toolName, text };
  }
  return { decision: 'allow', severity: 'normal', reason: 'no severe trigger', toolName, text };
}

function readStatus(statusFile) {
  try { return JSON.parse(fs.readFileSync(statusFile || STATUS_FILE, 'utf8')); }
  catch (_) { return { schema: 'axm.shell-guardian-status/v1', tripped: false, tripCount: 0, resetCount: 0 }; }
}
function writeStatus(status, statusFile) {
  const target = statusFile || STATUS_FILE;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(status, null, 2) + '\n');
}
function appendEvent(entry, eventFile) {
  const target = eventFile || EVENT_FILE;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, JSON.stringify(entry) + '\n');
}
function scheduleGrokKill() {
  const script = "Start-Sleep -Milliseconds 450; Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('grok.exe','agent.exe') } | ForEach-Object { try { taskkill.exe /PID $_.ProcessId /T /F | Out-Null } catch {} }";
  const child = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], {
    detached: true, windowsHide: true, stdio: 'ignore'
  });
  child.unref();
}

function handle(event, options) {
  options = options || {};
  const statusFile = options.statusFile || STATUS_FILE;
  const eventFile = options.eventFile || EVENT_FILE;
  const result = classify(event);
  const at = new Date().toISOString();
  const entry = {
    schema: 'axm.shell-guardian-event/v1', at,
    sessionId: event && (event.sessionId || event.session_id) || null,
    cwd: event && event.cwd || null,
    workspaceRoot: event && (event.workspaceRoot || event.workspace_root) || null,
    toolName: result.toolName,
    severity: result.severity,
    decision: result.decision,
    reason: result.reason,
    preview: result.text.slice(0, 1200)
  };
  appendEvent(entry, eventFile);
  const status = readStatus(statusFile);
  status.schema = 'axm.shell-guardian-status/v1';
  status.lastEvent = entry;
  status.updatedAt = at;
  if (result.decision === 'trip') {
    status.tripped = true;
    status.trippedAt = at;
    status.tripCount = Number(status.tripCount || 0) + 1;
    status.reason = result.reason;
    status.connectionAction = 'grok process tree termination scheduled';
    writeStatus(status, statusFile);
    if (!options.noKill) (options.scheduleKill || scheduleGrokKill)();
    return { result, hookOutput: { decision: 'deny', reason: 'AXM SHELL GUARDIAN TRIPPED: ' + result.reason } };
  }
  writeStatus(status, statusFile);
  return { result, hookOutput: null };
}

function main() {
  let event;
  try {
    const raw = (fs.readFileSync(0, 'utf8') || '{}').replace(/^\uFEFF/, '').replace(/^ï»¿/, '');
    event = JSON.parse(raw);
  }
  catch (error) {
    try { appendEvent({ schema: 'axm.shell-guardian-event/v1', at: new Date().toISOString(), severity: 'error', decision: 'deny', reason: 'malformed hook event; Guardian failed closed', preview: error.message }); } catch (_) {}
    process.stdout.write(JSON.stringify({ decision: 'deny', reason: 'AXM SHELL GUARDIAN ERROR: malformed hook event' }));
    process.exit(2);
  }
  try {
    const handled = handle(event);
    if (handled.hookOutput) {
      process.stdout.write(JSON.stringify(handled.hookOutput));
      process.exit(2);
    }
    process.exit(0);
  } catch (error) {
    try { appendEvent({ schema: 'axm.shell-guardian-event/v1', at: new Date().toISOString(), severity: 'error', decision: 'deny', reason: 'Guardian internal error; failed closed', preview: String(error && error.message || error) }); } catch (_) {}
    process.stdout.write(JSON.stringify({ decision: 'deny', reason: 'AXM SHELL GUARDIAN ERROR: internal policy failure' }));
    process.exit(2);
  }
}

module.exports = { classify, handle, flattenInput, readStatus, STATUS_FILE, EVENT_FILE };
if (require.main === module) main();
