# AXM Shell Guardian v0.1

Shell Guardian is an open-workshop circuit breaker. It does not sandbox Grok or prevent normal creation. It observes Grok's `PreToolUse` events and distinguishes:

- **allow** — normal tool use;
- **warn** — high-impact but commonly legitimate operations, logged without interruption;
- **trip** — a short list of severe, observable policy violations.

A trip denies the pending tool call, writes an audit record, marks the Guardian as tripped, and schedules termination of every `grok.exe` / `agent.exe` process tree. Killing the CLI cuts its active remote session connection. The human must review and reset the circuit before relaunching.

The system classifies evidence, not intent. A trip means "this action crossed a declared boundary," never "the AI is evil."

## Red triggers

- attempts to edit or disable Shell Guardian or its Grok hook;
- access to common credential/key stores through an agent tool;
- destructive disk/boot/root commands;
- persistence through services, scheduled tasks, Run keys, or new admin users;
- disabling Defender/firewall protections;
- encoded or download-and-immediately-execute shell payloads;
- privilege-elevation requests.

## Commands

```powershell
node "C:\axm workshop\tools\shell-guardian\guardian-control.js" status
node "C:\axm workshop\tools\shell-guardian\guardian-control.js" reset
node "C:\axm workshop\tools\shell-guardian\selftest.js"
```

The top-level selftest is the bounded promotion entrypoint. It exercises the
focused policy suite plus denial, isolated audit/state persistence, and process
termination scheduling without killing a real process. To run only the policy
classification assertions:

```powershell
node "C:\axm workshop\tools\shell-guardian\guardian-selftest.js"
```

Grok's personal hook is installed at `%USERPROFILE%\.grok\hooks\axm-shell-guardian.json`.
It calls the no-space wrapper `%USERPROFILE%\.grok\bin\axm-guardian.cmd` so the
Windows hook runner preserves stdin and exit codes. A malformed payload or an
internal Guardian failure is denied rather than silently allowed.

The reusable multi-model boundary built from this proof is documented in
`DREAMTEAM_CONNECTOR_CONTRACT.md`.
