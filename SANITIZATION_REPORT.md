# Public-safe sanitization report

Generated: **2026-07-12**

## Source and output

- Source: live local `AXM Workshop`
- Output: `axm-workshop-public-20260712-045532-4e82e2.zip`
- Output SHA-256: `fa290100ae6cf9a498e2812e3ec5911e41f2b1a5ba851cb3e8c9809060482d42`
- Public package secret scan: **PASS**
- Public package restore test: **PASS**

## Excluded private/runtime directories

- `exports/` (generated packages remain local)
- `backups/`
- `logs/`
- `saves/`
- `state/` (guardian events, collaboration notices and shared-vision frames)
- `.claude/` and `.grok/` local connector settings
- `.git/`
- `node_modules/`

Nested copies of those directory names are removed from the public package as
well.

## Excluded sensitive files

- `private-preview.js`
- `PRIVATE_VERIFICATION_REPORT_v0_2b.md`
- `PRIVATE_VERIFICATION_REPORT_v0_2c.md`
- `PRIVATE_ZIP_LAYOUT_AND_ADAPTER.md`
- `bridge/bridge-token.txt`
- `bridge/bridge.log`
- environment files, private-key formats and private-labelled reports

The refusal report records only a path and rule name; it never repeats a secret
value. Any detected key/token pattern refuses and removes the generated ZIP.

## Repository-only public shell

The GitHub repository deliberately retains public README, security,
collaboration and license documents plus inert example files. These files are
not copied from private runtime state. `.gitignore` prevents regenerated local
tokens, logs, saves, state, screenshots and packages from entering later commits.

## Scan result

The publish candidate contains:

- no real bridge token or API key
- no GitHub/Claude/Grok authentication material
- no Windows user-profile path
- no local guardian event history
- no collaboration notice history
- no shared-screen screenshot
- no private backup or local save

Project/module names and the public collaboration name **Mike Tobi** remain by
design. Canonical Foundation copies remain byte-identical so their integrity
hash continues to verify.
