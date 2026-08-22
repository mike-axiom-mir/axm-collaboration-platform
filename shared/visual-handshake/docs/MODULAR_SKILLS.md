# Modular skill map

The package installs five collaborating skills. Each user-facing task loads one narrow workflow while every command still reaches the same local application and packet store.

| Skill | Owns | Does not own |
| --- | --- | --- |
| `axm-visual-intake` | Receive and inspect Mike-to-Codex packets | Publishing or runtime lifecycle |
| `axm-visual-publish` | Publish existing files and notes | Browser rendering |
| `axm-visual-snapshot` | Render local URL or HTML previews | General file publishing or live UI claims |
| `axm-visual-runtime` | Status, dashboard views, and explicit stop | Packet inspection or publication |
| `axm-visual-handshake` | Ambiguous-request routing and shared launcher | Detailed task workflows |

## Shared launcher

Each focused skill has a tiny `scripts/handshake.py` wrapper. It delegates to the compatibility skill, which locates either the portable package or the stable Windows installation. There is one application implementation and one CLI contract; the skill split does not create competing packet stores.

## Installation unit

Install and roll back the five folders together. The four focused skills depend on the compatibility skill's shared launcher. Exchange history remains outside the program and skill folders.

## Compatibility

Existing prompts and integrations that invoke `axm-visual-handshake` continue to work. New prompts can name a focused skill directly, and implicit triggering can select the narrowest module.
