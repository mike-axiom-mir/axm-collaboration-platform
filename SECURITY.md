# Security and Privacy

AXM Workshop is experimental local-first software. Its default boundary is one
device, not a public network service.

## Safe default

The Hub and local bridge bind to `127.0.0.1` by default. Do not expose them to a
LAN or the internet without authentication, scoped authorization, firewall
rules, and an explicit threat review.

Optional AI, remote-machine, Discord, and controller connections are separate
capabilities. Discovering a connection does not grant it permission to read,
write, execute, promote, or publish.

## Secrets

Keep provider keys in local environment variables. Never commit or post real
API keys, passwords, cookies, authorization headers, SSH keys, bridge tokens,
or session URLs.

The public package omits `bridge/bridge-token.txt`. The bridge creates a fresh
random token on first start; deleting the local file rotates it on next start.

## Local evidence

Logs, saves, sessions, generated state, caches, and verifier receipts may
contain actor names, task details, filenames, timestamps, or machine context.
They remain local and are excluded from public packages. Share the smallest
sanitized excerpt that can prove a bug.

## Reporting a vulnerability

Use GitHub's private vulnerability-reporting route when it is available under
the repository's **Security** tab. If it is unavailable, open a minimal public
issue titled `Private security contact requested` without including exploit
details or secrets. A maintainer can then arrange a private channel.

Ordinary bugs belong in the Bug report template. Remove tokens, private paths,
personal data, and raw logs before attaching evidence.
