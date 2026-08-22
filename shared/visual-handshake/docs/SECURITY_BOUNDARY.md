# Security and consent boundary

- The HTTP server binds only to loopback and rejects non-loopback Host headers.
- All private API requests require a cryptographically random per-run token.
- Same-origin checks and no CORS reduce cross-site calls into the local service.
- State-changing actions require an explicit browser or CLI command.
- HTML previews are rendered without script permission in a sandboxed iframe and served with a restrictive CSP.
- SVG files containing scripts, JavaScript URLs, event handlers, or foreign objects are rejected.
- Asset SHA-256 is checked before serving.
- Remote URL snapshots are blocked unless `--allow-network` is deliberately supplied.
- No screen is captured continuously or in the background.
- No packet is automatically deleted or silently replaced.

The remaining exact-target risks are browser screen-capture behavior, Windows PowerShell capture compatibility, local Codex image-reading support, and platform overlap. These require local evidence.
