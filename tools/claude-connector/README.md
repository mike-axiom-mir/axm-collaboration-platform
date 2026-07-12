# AXM Claude Code Connector (TEST v0.1)

This module is a **separate Claude identity and connector seat** in the AXM Dreamteam room. It is not merged memory with Grok, Nova, or any other seat.

## What it does

- Registers Claude Code Desktop / Code tab activity via `SessionStart` and `PreToolUse` hooks (template only in this folder).
- Reuses **only** the shared `classify()` policy from `tools/shell-guardian/guardian-hook.js` for severe triggers.
- Keeps its **own** audit and breaker state under `state/claude-guardian/` (not `state/shell-guardian/`).
- Writes a synchronous `lastSeenAt` on each hook event. The Workshop presence API derives Claude's live chip from that audited state with a 90-second TTL, so process exit cannot drop an in-flight HTTP heartbeat.
- On severe trips: denies the tool call using Claude's `hookSpecificOutput` shape and schedules **Claude.exe-only** process cutoff (helper in `claude-process-cutoff.js`).

## What it does not do

- Install or edit `~/.claude/settings.json` (see `settings.local.template.json` and `INSTALL_REVIEW.md`).
- Read credential file **contents** (path/command patterns may still trip; no file opens for secrets).
- Kill Grok or other agents' processes.

## Honest safety boundary

This is a deterministic interruption layer, not operating-system isolation. A
general shell call that literally references the Guardian, connector, status, or
Claude hook-settings paths is denied regardless of interpreter. Inline
interpreter calls such as `node -e` and `python -c` are always audit warnings.
Code that deliberately reconstructs a protected path without naming it may still
bypass pattern-based inspection because the acting Claude process runs with the
same Windows user permissions. Preventing that requires an OS boundary, which
this open-workshop design intentionally does not claim to provide.

## Files

| File | Role |
|------|------|
| `claude-guardian.js` | Hook entry (stdin JSON → stdout / exit code) |
| `claude-process-cutoff.js` | Post-trip Claude.exe cutoff (not run at build time) |
| `claude-guardian-selftest.js` | Deterministic policy and wiring checks |
| `index.html` | Human-facing connector status panel (no fake APIs) |

## Self-test

```text
node --check claude-guardian.js
node --check claude-process-cutoff.js
node claude-guardian-selftest.js
```

After a trip, Claude remains denied until an explicit local reset:

```text
node claude-guardian-control.js status
node claude-guardian-control.js reset
```
