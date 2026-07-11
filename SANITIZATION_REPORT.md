# Public-Safe Sanitization Report

**Source:** `AXM_WORKSHOP_v1_9_1_TOOL_FACTORY_v0_2_PRIVATE_EXPERIMENTAL(1).zip`  
**Source SHA-256:** `d917cb27d1cd1f2c4112aec2bbde91f73ec5e71754b3328eee3364ed622b78e3`  
**Output target:** `AXM_WORKSHOP_v1_9_1_TOOL_FACTORY_v0_2b_PUBLIC_SAFE_EXPERIMENTAL.zip`

## Public identity decision

The public package intentionally uses **Mike Tobi** as the founder and
collaboration name so people can connect it to the raw AXM Facebook development
log. No personal email address is published.

Project names, module names, AXM identity-wisdom material, and Tilburg context
remain. They are part of the system's history and growth model, not treated as
secrets.

Stable lowercase actor identifiers such as `mike` remain where they are data or
code identifiers. Canonical `axm-foundation.js` spine copies remain byte-identical
to the source because changing attribution comments inside them would break the
Foundation integrity hash.

## Removed private/generated files

- `bridge/bridge-token.txt`
- `bridge/bridge.log`
- `logs/workshop.log`
- `exports/route-prove-the-hub.json`
- `exports/verify-report.txt`
- `exports/verify-retirements.log`

These were runtime state, private history, or a real local authorization token.

## Added public examples and controls

- `bridge/bridge-token.example.txt`
- `bridge/bridge.log.example`
- `logs/workshop.log.example`
- `exports/route.example.json`
- `exports/verify-report.example.txt`
- `exports/verify-retirements.example.log`
- `.gitignore`
- `.env.example`
- public README, security, collaboration, license-status, verification, and
  sanitization documents

Examples are explicitly marked as examples and do not claim real execution.

## Fresh-token behavior

The bridge already contained safe first-start behavior: when
`bridge-token.txt` is absent, it creates a random 24-byte token encoded as 48
hexadecimal characters. The public package now ships without the old token and
Git ignores the generated replacement. This behavior was verified in an
isolated temporary bridge run.

## Documentation repairs

- replaced the stale statement that the Hub/browser had never been tested
- recorded Mike Tobi's manual browser pass
- recorded the OneDrive/cloud-placeholder environment failure separately
- preserved automated Playwright as UNRUN
- removed the obsolete instruction that Verification Desk requires `/api/run`
- documented the legal `EXPERIMENTAL` status lane
- documented 22 currently discoverable tools/modules and two underscore shelves
- documented Tool Factory's draft-only boundaries
- updated public attribution to Mike Tobi without rewriting stable actor IDs

## Focused functional repair

The first public-safe package still exposed a Windows direct-start defect: the
BAT opened the browser before the server and did not verify whether port 8788
belonged to the current build. Patch v0.2b adds a build-aware health check,
server readiness wait, explicit `/hub/index.html` opening, and explicit server
aliases for `/hub` and `/hub/`. It also removes an accidental leading backslash
from `START_AXM_FULL.bat`. This is a narrow startup/route repair, not a rewrite
of the Foundation or module system. Local Node/HTTP smoke tests passed; Windows
manual confirmation remains pending.

## Secret/privacy scan result

The final tree contains:

- no real bridge token
- no real API key
- no email address
- no Windows user profile path
- no Unix home-profile machine path
- no private runtime log

A 64-character value remains in `tools/agent-tool-forge/selftest.js`; it is the
published SHA-256 known-vector result for `abc`, used by the deterministic hash
test, not a credential.

## Preserved boundaries

The public-safe transformation does not add install, overwrite, execution,
delete, promotion, or canonization powers. Generated packages still begin
`EXPERIMENTAL`, and the machine adapter still requires a host authorization
decision.
