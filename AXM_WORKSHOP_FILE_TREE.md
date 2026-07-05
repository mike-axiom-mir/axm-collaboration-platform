# AXM Workshop v0.10 — ZIP File Tree

This file makes the uploaded rollback ZIP visible for review in GitHub without needing to download it first.

## Source archive

`AXM_WORKSHOP-v0_10_LEGACY_PACK(2).zip`

## Import safety

The archive contains 73 real files.

For future extracted-source import, keep these local/private runtime files out of the visible source tree:

- `AXM_WORKSHOP/bridge/bridge-token.txt` → replace with `AXM_WORKSHOP/bridge/bridge-token.example.txt`
- `AXM_WORKSHOP/bridge/bridge.log` → local runtime log
- `AXM_WORKSHOP/logs/workshop.log` → local runtime log

## Verifier status from local inspection

`node verify.js` result: **1 FAIL / 0 warn**

Known fail:

- `AXM_WORKSHOP/tools/studio/index.html` references `mBuilt` and `mUp` before those DOM ids exist.

## Visible file tree from ZIP

```text
└── AXM_WORKSHOP
    ├── assets
    │   ├── local
    │   │   ├── launcher
    │   │   │   ├── favicon.svg
    │   │   │   ├── icon-tool-default.svg
    │   │   │   ├── logo.svg
    │   │   │   ├── SKIN_README.txt
    │   │   │   └── tokens.css
    │   │   └── template
    │   │       ├── index.json
    │   │       └── library-spec.txt
    │   ├── packs
    │   │   ├── lang
    │   │   │   └── base
    │   │   │       └── NAMESPACE.txt
    │   │   ├── launcher
    │   │   │   └── base
    │   │   │       └── NAMESPACE.txt
    │   │   ├── music
    │   │   │   └── base
    │   │   │       └── NAMESPACE.txt
    │   │   ├── sound
    │   │   │   └── base
    │   │   │       └── NAMESPACE.txt
    │   │   ├── template
    │   │   │   └── base
    │   │   │       └── NAMESPACE.txt
    │   │   └── video
    │   │       └── base
    │   │           └── NAMESPACE.txt
    │   └── README.txt
    ├── backups
    │   └── README.txt
    ├── bridge
    │   ├── axm-bridge.js
    │   ├── bridge-token.txt
    │   ├── bridge.log
    │   └── BRIDGE_SETUP.txt
    ├── export-recipes
    │   └── local
    │       └── README.txt
    ├── exports
    │   ├── README.txt
    │   └── verify-report.txt
    ├── launcher
    │   ├── axm-assets.js
    │   ├── axm-foundation.js
    │   ├── axm-registry.js
    │   ├── axm-settings.js
    │   └── index.html
    ├── logs
    │   ├── README.txt
    │   └── workshop.log
    ├── pocket
    │   ├── hub-mobile.html
    │   └── prehub-mobile.html
    ├── projects
    │   └── README.txt
    ├── prompts
    │   └── local
    │       ├── ai-handoff-header.txt
    │       ├── axm-core.txt
    │       ├── bridge-relay-test.txt
    │       ├── driftcheck-source-audit.txt
    │       └── README.txt
    ├── saves
    │   └── README.txt
    ├── tools
    │   ├── _templates
    │   │   ├── basic-tool
    │   │   │   ├── axm-foundation.js
    │   │   │   ├── index.html
    │   │   │   └── manifest.json
    │   │   └── README.txt
    │   ├── duo-test
    │   │   ├── axm-foundation.js
    │   │   ├── index.html
    │   │   └── manifest.json
    │   ├── prehub
    │   │   ├── axm-foundation.js
    │   │   ├── index.html
    │   │   └── manifest.json
    │   ├── reasoning-shell
    │   │   ├── axm-foundation.js
    │   │   ├── index.html
    │   │   ├── manifest.json
    │   │   ├── profiles.json
    │   │   └── SHELL_README.txt
    │   └── studio
    │       ├── axm-foundation.js
    │       ├── index.html
    │       └── manifest.json
    ├── PATCH_v0_2a_ROUTE_FIX.txt
    ├── PATCH_v0_5a_CORE_WORKING.txt
    ├── PATCH_v0_5b_ROOT_CANON.txt
    ├── PATCH_v0_6_STUDIO_TEST.txt
    ├── PATCH_v0_8a_TRUTH_EVENT_POLISH.txt
    ├── server.js
    ├── start-full.sh
    ├── start.sh
    ├── START_AXM.bat
    ├── START_AXM_FULL.bat
    ├── SUCCESSOR_BRIEFING.txt
    ├── SUITCASE_AND_ROLLBACK_SPEC.txt
    ├── TEMPLATE_SEAMS.txt
    ├── TRUST_CHARTER.txt
    ├── verify.js
    ├── WORKSHOP_README.txt
    └── WORKSHOP_TESTS_RUN.txt
```

## Review note

This file tree is not a replacement for fully extracted source. It is a readable bridge checkpoint so humans and AI reviewers can understand the project structure before the full source tree is unpacked into GitHub.
