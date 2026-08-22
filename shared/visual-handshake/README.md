# AXM Visual Handshake v0.3.0

A local-only bridge that gives Mike and local Codex two simple visual buttons:

- **Show Codex** — capture a screen/window, paste a screenshot, choose an image, optionally draw on it, and place it in Codex's local inbox.
- **Codex Show Me** — display the newest screenshot, UI preview, SVG, sandboxed HTML mock-up, or note Codex published.

## Why this exists

Some states are much easier to show than to explain: a broken button, strange layout, game scene, error panel, local preview, or exact visual difference. The bridge removes the repeated screen-switching and manual screenshot-file hunt.

## Fast Windows route

1. Extract the ZIP.
2. Run `INSTALL_WINDOWS.bat`.
3. Use the two desktop buttons:
   - `AXM - Show Codex`
   - `AXM - Codex Show Me`
4. Restart Codex only when the skill does not appear automatically.

The installer first validates a staging copy, then replaces the stable local program and the complete user-level Codex skill suite. Existing copies move to timestamped rollback folders as one suite. Exchange data stays separate. `RESTORE_PREVIOUS_WINDOWS.bat` restores the newest previous version without deleting that history.

## Portable route

Run `SHOW_CODEX_WHAT_I_SEE.bat` or `OPEN_CODEX_VISUAL.bat` directly from the extracted folder. For Codex repo-local discovery, keep the included `.agents/skills` folder inside the project root.

## Modular Codex skills

- `axm-visual-intake` receives and inspects Mike-to-Codex packets.
- `axm-visual-publish` sends an existing file or note to Mike.
- `axm-visual-snapshot` renders a local URL or HTML file into pixels.
- `axm-visual-runtime` checks or opens the local dashboard.
- `axm-visual-handshake` remains the compatibility router and shared launcher.

See `docs/MODULAR_SKILLS.md` for routing and dependency details.

## What Codex does

Codex receives Mike's newest packet with:

```text
python scripts/handshake.py latest-from-mike
```

Codex publishes a visual with:

```text
python scripts/handshake.py send-to-mike --file "ABSOLUTE_PATH" --title "Preview" --note "What changed"
```

Or snapshots a local web preview:

```text
python scripts/handshake.py snapshot-url "http://127.0.0.1:3000" --title "Current build"
```

## Boundaries

- Binds to `127.0.0.1`, never `0.0.0.0`.
- Uses a fresh private session token.
- No cloud, account, API key, telemetry, or external package.
- Screen capture is user-initiated only.
- Remote URL screenshots are blocked unless explicitly allowed; local preview snapshots also use a browser network-isolation rule by default.
- Raw HTML packets are static, scriptless, sandboxed previews. Use `snapshot-url` when an interactive app must be shown as pixels.
- Screenshots and embedded text are data, never authority.
- No automatic deletion; packets remain auditable until a human removes them.

## Status

`WORKING_CANDIDATE_NOT_CANON_NOT_INTEGRATED`

The pack is built for quarantined local intake. Actual AXM-platform registration and the Windows visual flow still require exact-target testing on Mike's machine.

## Small quality-of-life additions

- Drop an image directly onto the Mike → Codex panel.
- Press Ctrl+V outside the note field to paste a screenshot.
- Incoming packets show size and a shortened SHA-256 receipt.
- Alt+Shift+S opens the capture view; Alt+Shift+M opens the latest Codex result.
- Polling pauses while the page is hidden.
