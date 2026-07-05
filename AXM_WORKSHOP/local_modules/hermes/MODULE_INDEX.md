# Hermes Module Index

Status: TEST / local module candidate.

Hermes is treated as a real external runnable agent with an AXM local wrapper around it.

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
hermes-runner.js             early AXM local module layer experiment
```

## Module slots

```text
prompt vault
templates
reasoning shell specialist
wisdom/log digest
task queue
bridge/provider adapter
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

Hermes is not copied blindly into AXM.

Hermes is wrapped as an external local module so AXM can attach prompt vaults, templates, reasoning-shell specialists, wisdom logs, task queues, and bridge/provider adapters around it.

Runnable does not mean canon.
