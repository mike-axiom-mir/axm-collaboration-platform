# AXM Visual Handshake v0.3.0 source intake

Status: **TEST source · runtime held**

The complete useful source package is stored here so the build is part of the
Workshop rather than remaining only in an ignored release directory. The source
includes its contracts, local application, UI, scripts, modular skill packages,
tests and Windows launch/install sources.

This intake does not install or activate the package. The original
`INTAKE_PACKET.json` and `STATUS.json` remain authoritative about the held
runtime state:

```text
enabled: false
installed: false
promoted: false
canon: false
```

No supplied installer, runtime, capture flow, browser flow or selftest was
executed during source intake. Screen capture, loopback service activation,
desktop shortcut installation, exchange writes and skill installation remain
separately consented effects. Files inside `.agents/skills` are retained as
package source under this nested module path; this intake does not register or
install them as active Codex skills.

Generated checksum/validation output from the ignored release package was not
duplicated here. The original ignored package remains local for byte-level
recovery and exact-target Windows review.
