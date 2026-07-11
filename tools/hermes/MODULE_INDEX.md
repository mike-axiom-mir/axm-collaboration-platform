# Hermes Module Index

Status: TEST / local module candidate.

Hermes is treated as a real external runnable agent with an AXM local wrapper around it.

Runtime is required.

The goal is not to remove runtime behavior.

The goal is to keep Hermes runnable while connecting it to AXM consent, settings, package profiles, and review boundaries.

Locked external source:

```text
NousResearch/hermes-agent
```

License:

```text
MIT
```

## Module parts

```text
hermes-bootstrap.js          setup/start wrapper for real Hermes
HERMES_BOOTSTRAP_README.md   setup notes and locked source
hermes-source.example.json   source/install/start config example
README.md                    AXM module overview
HERMES_LOCAL_MODULE_PLAN.md  adapter and safety plan
hermes-runner.js             early AXM local control-layer experiment, not a replacement for real Hermes
```

## Neighbor modules

```text
../agent-command-center/     package assembly and identity connector binding
../agent-tool-forge/         prompts, skills, masks, identities, templates, and task wrapper preparation
```

## Hermes-local slots

```text
profiles
templates
vault
queue
inbox
outbox
run-reports
logs
bridge/provider adapter
shell review
```

## Runtime split

```text
real Hermes runtime
  -> runs the actual Hermes agent

AXM control layer
  -> consent
  -> settings
  -> selected package profile
  -> selected identity binding
  -> prompt/template/wisdom links
  -> shell review
```

## AXM shape

```text
AXM hub/tool
  -> Agent Command Center selects package and identity binding
    -> Hermes wrapper starts/checks runtime
      -> real Hermes agent runs approved task
        -> Shell Review checks result
```

## Rule

Keep Hermes runnable.

Do not replace real Hermes with an AXM fake runner.

Do not give Hermes uncontrolled access.

Hermes is one runnable connector/body that can use packages prepared by the side-by-side Agent Command Center and Agent Tool Forge.

Runnable does not mean canon.
