# Changelog

## v0.3.0 — modular skill suite

- Split the umbrella workflow into focused intake, publish, snapshot, and runtime skills.
- Kept `axm-visual-handshake` as the backward-compatible router and shared launcher.
- Added precise trigger descriptions so only the smallest relevant workflow loads.
- Changed staged install and rollback to treat all five skills as one atomic suite.
- Added suite structure, wrapper, installer, and routing contract checks.
- Preserved the v0.2.0 local-only app, packet format, CLI commands, safety boundaries, and exchange data.

## v0.2.0 — final pre-intake polish

- Preserved the two-button direction and all v0.1.0 exchange contracts.
- Fixed repeated incoming-preview fetching and object-URL growth during polling.
- Preserved the server CSP for HTML previews by loading them directly in a sandboxed frame.
- Restricted raw HTML previews to static content; interactive pages should be sent as screenshots.
- Strengthened SVG, UTF-8, packet-record, stale-session, and exact-service validation.
- Made screen-capture stream cleanup unconditional.
- Added drag/drop, paste-anywhere, visible integrity metadata, upload-size-safe downscaling, keyboard view shortcuts, and reduced-motion support.
- Paused polling while the page is hidden and prevented overlapping refresh requests.
- Changed Windows startup to choose a free loopback port instead of assuming port 8765 is unused.
- Changed Windows installation to validate in staging before replacing the working version.
- Added a one-click previous-version restore path that preserves exchange data.
- Added explicit local-intake HOLD metadata and exact-target checklist.

No live platform integration, CANON promotion, continuous capture, cloud upload, telemetry, or remote control was added.
