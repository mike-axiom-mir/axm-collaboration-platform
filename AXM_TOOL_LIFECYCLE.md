# AXM Tool Lifecycle

AXM tools are modular. A tool can be useful as a test tool without being permanent.

## Core idea

A tool folder is not canon forever.

A tool can be:

- added for testing
- improved
- disabled
- retired
- replaced
- deleted from the menu later

The important thing is that the tool menu and verifier know what status the tool has.

## Studio status

`AXM_WORKSHOP/tools/studio/` is the first tool.

It exists so AXM can test the workshop structure, tool loading, UI/menu behavior, file layout, and verifier logic.

Studio is not sacred. It is allowed to be rough, fixed, replaced, or retired later.

## Suggested statuses

Use honest tool status labels:

- `draft` — idea or early file only
- `test` — usable for experiments
- `working` — passes basic checks
- `known-fail` — kept visible because it teaches what is broken
- `retired` — no longer shown by default, kept for history/rollback
- `removed` — deleted after review

## Menu rule

The tool menu should eventually respect status.

Suggested behavior:

| Status | Menu behavior |
|---|---|
| `draft` | hidden unless dev/test mode is on |
| `test` | visible in test mode |
| `working` | visible normally |
| `known-fail` | visible only with warning |
| `retired` | hidden by default, available in archive/dev mode |
| `removed` | not listed |

## Retire instead of panic-delete

When possible, retire a tool before deleting it.

Retiring preserves:

- lessons learned
- rollback path
- examples for future agents
- history of why the tool changed

Deletion is still allowed when a tool is unsafe, useless, or only noise.

## AXM rule

A tool is allowed to be temporary.

The project should not pretend every first version is final.

No fake done. No sacred prototypes.
