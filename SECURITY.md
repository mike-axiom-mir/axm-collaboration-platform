# Security

AXM Workshop is an experimental local-first system, not a production security
certification. The core server binds to `127.0.0.1` by default. Optional
bridges, source connectors, device handoff, multiplayer transports, and machine
execution are separate permission surfaces.

## Report a vulnerability privately

Do **not** place secrets, exploit details, private paths, or personal data in a
public issue. Use GitHub's
[private vulnerability report](https://github.com/mike-axiom-mir/axm-collaboration-platform/security/advisories/new).

For ordinary non-sensitive bugs, use the repository's Bug Report template.

## Supported public line

Security fixes target the current `main` branch and newest experimental
prerelease. Older public test tags are historical evidence and may not receive
backports.

## Secrets

Provider keys enter local processes through environment variables such as
`ANTHROPIC_API_KEY` and `OPENAI_API_KEY`. Browser tools do not receive those
values. The local bridge token and local override files are excluded from public
packages.

Never copy tokens, keys, `.env` files, provider authentication stores, private
state, logs, or raw session history into issues, saves, packages, or reports.
The honest no-key behavior is an unavailable provider route—not a silent
success, guessed response, or false “AI connected” claim.

## Binding and network access

See [`docs/PORTS.md`](docs/PORTS.md) for the reviewed listener map and explicit
LAN exceptions. Any non-loopback listener is a separate capability requiring
deliberate startup, authentication review, and a bounded lifetime.

“Local-first” does not mean the entire tree can never make a network request.
It means the core remains useful locally and network authority stays declared.
The Windows bootstrap, optional AI providers, connectors, and update routes have
their own visible network boundaries.

The default loopback server rejects browser-originated state-changing requests
from cross-site, opaque, malformed, non-HTTP, or non-loopback origins before
they reach Workshop or proxied sidecar routes. Same-origin local browser calls
and origin-less local command-line clients remain available. An explicit
non-loopback listener is still a separate reviewed capability; this boundary is
not user authentication and does not make a LAN listener safe by itself.

## Dependency and release checks

`package-lock.json` pins installed package versions. Dependency advisories
require an online `npm audit` or maintained advisory database; AXM does not
fabricate that result. Every public release also requires its own inventory,
public-safety scan, pull-request checks, and receiver launch evidence.
