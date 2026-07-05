# Agent Command Center Rules

Status: TEST / public module rules.

The Agent Command Center is a side-by-side AXM local module.

It is not owned by Hermes.

It can prepare package choices for Hermes, ChatGPT, Claude, LM Studio, local models, or future AI connectors through the AXM Hub.

## Correct split

```text
Agent Tool Forge
  -> prepares reusable AI parts

Agent Command Center
  -> assembles approved or test-ready parts into package profiles

Selected connector
  -> runs the selected package with consent

Shell Review
  -> analyzes run results, logs, growth, and repair history
```

## What the Command Center assembles

```text
identity profile
+ connector binding
+ specialist masks
+ skills
+ prompt packs
+ template packs
+ wisdom profile links
+ run settings
+ consent rules
= package profile
```

## What does not happen here

The Command Center should not be the main place to:

- create raw prompts from scratch
- create raw skills from scratch
- create raw specialist masks from scratch
- analyze wisdom logs
- analyze run growth
- decide canon
- run agents without consent

Those belong to other layers.

## Public-safe rule

Public mode should keep the module clear and generic.

No private user secrets.

No hidden connector tokens.

No raw private logs.

No identity auto-switching.

No package auto-runs by default.

## Assembly loop

```text
1. Choose task or situation type.
2. Select default identity.
3. Check connector binding.
4. Select specialist masks.
5. Select skills.
6. Link prompt packs.
7. Link template packs.
8. Link wisdom profile references.
9. Set run limits.
10. Set consent rule.
11. Save package as RAW, REVIEW, or ACCEPT FOR TEST.
12. Run only through selected connector with consent.
13. Send results to Shell Review.
```

## Status labels

```text
RAW
REVIEW
ACCEPT FOR TEST
WORKING
KNOWN FAIL
RETIRED
CANON only after MergeGate
```

## AXM rule

The Command Center assembles strength from finished or test-ready parts.

It does not replace the Hub.

It does not replace runtime.

It does not replace review.

It connects prepared parts to selected AI connectors through visible consent.
