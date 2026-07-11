# Hermes Settings Plan

Status: TEST / required before stronger Hermes use.

Hermes is a runnable agent, so AXM needs settings before it gets stronger.

The settings layer is not decoration. It is a control surface.

## Core settings needed

### Consent

Hermes must have a clear ON/OFF setting.

```text
consent = off by default
```

When consent is OFF:

- Hermes may show status.
- Hermes may show available modules.
- Hermes must not run tasks.
- Hermes must not read linked wisdom profiles.
- Hermes must not write proposals, logs, or queue files except basic local status.

When consent is ON:

- Hermes may run only within the configured limits.
- Hermes may use only enabled sources and modules.
- Hermes still does not become canon automatically.

## Run limits

Hermes needs limits per run.

Possible settings:

```text
max_run_minutes
max_actions_per_run
max_tool_calls_per_run
max_files_read_per_run
max_files_written_per_run
auto_stop_on_error
auto_stop_on_uncertainty
auto_stop_before_core_files
```

These settings protect Mike Tobi, the repo, and the local machine from agent drift or endless action.

## Wisdom profile settings

Hermes should support two wisdom profile modes:

```text
manual_upload
linked_folder
```

### Manual upload

Mike Tobi or AXM can place a wisdom profile into an approved local folder.

Example:

```text
wisdom-profiles/inbox/
```

Hermes can then import or summarize it only if consent is ON.

### Linked folder

Hermes can link to an approved local wisdom profile folder.

Example:

```text
AXM_WORKSHOP/wisdom/
```

This should be disabled by default until explicitly configured.

## Prompt vault link

Hermes should have a setting for the prompt vault.

```text
prompt_vault_enabled
prompt_vault_path
prompt_vault_mode
```

Modes:

```text
read_only
proposal_write
approved_write
```

Default should be read-only or off until tested.

## Template link

Hermes should later link to the AXM template system.

Template use must preserve AXM's rule:

```text
outer stable
inner flexible
```

Hermes may suggest templates, fill templates, or prepare template packets, but should not silently overwrite template roots.

## Specialist mask link

Hermes should later connect to AXM specialist masks.

Examples:

```text
reasoning-shell-specialist
visualassetagent
graphicupgrade
mergegate
sfx-forge-reviewer
code-routing-gate
```

Specialist masks should be chosen by setting, not random agent guessing.

## Log and proof settings

Hermes should record enough proof to review what happened.

Possible settings:

```text
log_level
keep_run_summary
keep_action_trace
redact_private_content
save_after_action_review
```

Default:

```text
redact_private_content = true
keep_run_summary = true
keep_action_trace = true
```

## Stop rules

Hermes should stop when:

- run limit is reached
- consent is turned OFF
- a source is not allowlisted
- a core AXM file would be changed
- action count is exceeded
- uncertainty is high
- a private file is detected
- a task asks Hermes to bypass review

## First settings file

The public repo should include only an example settings file.

Real local settings should stay local and ignored by Git.

Public:

```text
hermes-settings.example.json
```

Private/local:

```text
hermes-settings.local.json
```

## AXM rule

Hermes can be powerful later only if settings make restraint easy.

Run click is not enough.

The module needs visible boundaries, wisdom/profile links, prompt vault links, specialist mask links, and stop rules.
