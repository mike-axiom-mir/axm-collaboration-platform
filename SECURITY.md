# AXM Workshop security posture

As of 2026-07-23, the core Workshop server defaults to `127.0.0.1`. Optional bridges, release adapters, source connectors, radio/Spotify features, device handoff, and multiplayer transports have separate explicit network surfaces. “Offline-first” does not mean “the entire tree can never make a network request.” It means the core remains useful without a network and network authority stays declared and bounded.

## Secrets

Provider keys enter processes through environment variables such as `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`. Browser tools do not receive those values. The local bridge keeps a random door token in `bridge/bridge-token.txt`; it and local override files are excluded by `.gitignore`. Do not copy tokens, keys, `.env` files, provider authentication stores, or private state into saves, packages, reports, or public releases.

The honest no-key behavior is an unavailable provider route. It must never become a silent success, guessed response, or “AI connected” claim.

## Binding and egress

See [docs/PORTS.md](docs/PORTS.md) for the reviewed default port map and explicit LAN exceptions. Any non-loopback listener is a separate capability requiring deliberate startup and a bounded lifetime. Source and deployment adapters use allowlisted HTTPS routes and explicit review gates; they are not proof that the core Hub itself needs internet access.

## Dependency and release checks

`package-lock.json` pins installed package versions. Dependency advisories require an online `npm audit` or a maintained offline advisory database; neither is fabricated by the local verifier. Vendored-library digest locking remains an open roadmap item. Public release still requires its own digest review and signing gates.
