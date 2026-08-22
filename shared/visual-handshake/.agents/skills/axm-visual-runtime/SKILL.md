---
name: axm-visual-runtime
description: Check, open, start, or stop the local AXM Visual Handshake dashboard without exchanging a packet. Use when Mike asks whether the handshake is running, asks to open its capture or latest-result view, or explicitly asks to stop the local dashboard.
---

# AXM Visual Runtime

Manage only the loopback dashboard lifecycle. Do not publish or inspect packets unless the request also invokes the relevant focused skill.

## Check status

```text
python scripts/handshake.py status
```

Report the machine-readable result without claiming the browser UI is visible.

## Open a view

Require a clear request before opening a browser window:

```text
python scripts/handshake.py open-dashboard --mode capture
python scripts/handshake.py open-dashboard --mode latest
```

Use `capture` for Mike-to-Codex input and `latest` for Codex-to-Mike output.

## Stop

Stop only after Mike explicitly asks:

```text
python scripts/handshake.py stop
```

## Boundaries

- Keep the service bound to loopback.
- Do not capture, publish, open a dashboard, or stop the service implicitly.
- A healthy status proves service availability, not that any visual was inspected or shown.

