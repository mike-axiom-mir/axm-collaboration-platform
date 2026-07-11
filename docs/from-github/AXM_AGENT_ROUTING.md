# AXM Agent Routing

This file gives helpers and AI agents a small mission map. Do not try to understand or change everything at once.

## Routing principle

Small task. Clear role. Draft PR. Human review.

## Roles

| Role | Works on | Should not touch |
|---|---|---|
| Verifier Agent | `AXM_WORKSHOP/verify.js`, test reports, GitHub Actions | unrelated UI rewrites |
| Bridge Agent | `AXM_WORKSHOP/bridge/`, bridge setup docs | real tokens, API keys |
| Studio Agent | `AXM_WORKSHOP/tools/studio/` | bridge internals unless issue says so |
| Template Agent | `AXM_WORKSHOP/tools/_templates/`, template docs | core roots without review |
| Docs Agent | README, setup guides, public explanation | code behavior without testing |
| Research Scout | `docs/RESEARCH_BACKLOG.md`, issue proposals | direct imports/copying code |
| Tool Module Agent | one proposed tool folder at a time | global architecture changes |

## Branch naming

Use branches like:

```text
axm/studio-dom-order-fix
axm/bridge-beginner-setup
axm/verify-workflow
axm/template-seams-docs
axm/research-backlog
```

## Done format

Every PR should say:

```text
What changed:
Why:
Tested:
Not tested:
Risks:
Next step:
```

## No-copy rule

Researching public repositories is allowed.

Copying code from another repository is not allowed unless the license is checked and the PR clearly says what was copied, from where, and why.

Prefer learning patterns and building AXM-native minimal versions.

## Merge gate

A PR can be technically good and still not be merged if it drifts from AXM roots.

Mike Tobi decides final merge acceptance.
