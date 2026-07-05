# Hermes Module Index

Status: TEST / local module candidate.

Hermes is treated as a real external runnable agent with an AXM local wrapper around it.

Runtime is required.

The goal is not to remove runtime behavior.

The goal is to keep Hermes runnable while adding consent, settings, identity binding, package profiles, and review boundaries around it.

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

## Module slots

```text
prompt vault
templates
reasoning shell specialist
wisdom/log digest
task queue
bridge/provider adapter
identity connector binding
specialist command center
shell review
```

## Runtime split

```text
real Hermes runtime
  -> runs the actual Hermes agent

AXM control layer
  -> consent
  -> settings
  -> identity binding
  -> connector binding
  -> package profiles
  -> prompt/template/wisdom links
  -> shell review
```

## AXM shape

```text
AXM hub/tool
  -> AXM local module layer
    -> Hermes wrapper
      -> real Hermes agent
        -> AXM add-on slots
```

## Rule

Keep Hermes runnable.

Do not replace real Hermes with an AXM fake runner.

Do not give Hermes uncontrolled access.

Hermes is wrapped as an external local module so AXM can attach prompt vaults, templates, reasoning-shell specialists, wisdom logs, task queues, identity binding, package profiles, and bridge/provider adapters around it.

Runnable does not mean canon.
