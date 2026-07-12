# Install review checklist (human)

Before copying anything from `settings.local.template.json` into `~/.claude/settings.json`:

1. **Path** — Confirm the `node "C:/axm workshop/tools/claude-connector/claude-guardian.js"` command resolves on this machine (Node on PATH, workshop path unchanged).
2. **Scope** — Hooks affect **Claude Code / Desktop Code tab** sessions that share `~/.claude/settings.json`, not Grok hooks under `.grok/hooks`.
3. **Merge** — If `settings.json` already has `hooks`, merge `SessionStart` and `PreToolUse` entries without removing existing hooks; resolve duplicate PreToolUse ordering deliberately.
4. **Workshop server** — Heartbeats target `http://127.0.0.1:8788/api/presence/heartbeat`; server must be running for presence, not required for deny/allow decisions.
5. **Breaker behavior** — Severe trips deny via stdout JSON (`permissionDecision: deny`, exit 0) and schedule **Claude.exe** cutoff only; Grok Shell Guardian remains independent.
6. **State** — Expect writes to `state/claude-guardian/status.json` and `events.jsonl`; a trip persists until `node claude-guardian-control.js reset` is confirmed from an interactive local console. Resets record `resetBy=local-human-console`.
7. **Credentials** — Policy may block paths/commands that reference key stores; the hook does not open secret files.
8. **Rollback** — Keep a backup of `settings.json`; removal of the two hook commands disables this connector without deleting audit history.

Do not install until all items are explicitly accepted.
