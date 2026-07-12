# Hermes Identity Import Layer

Status: TEST / required before stronger Hermes runs.

Hermes is a tool and extra local body strength.

Hermes is not the identity.

Before a run or action, Hermes should be able to load a selected identity profile, wisdom profile, task type, specialist mask, prompt vault, and template set.

## Core idea

A Hermes run should be configured like this:

```text
identity profile
+ wisdom profile
+ task type
+ specialist mask
+ prompt vault
+ template set
+ run limits
= one bounded Hermes run
```

This makes Hermes flexible without becoming random.

## Identity profile

An identity profile tells Hermes which voice/role/stance it should operate from for this run.

Examples:

```text
AXM neutral helper
Axiom structure mode
Mir repair mode
Claude-style reviewer
Mike-facing plain-language helper
SFX forge reviewer
visual asset reviewer
code routing reviewer
```

Identity profile is not canon by default.

It is a selected operating mask for a task.

## Identity choices before run

Before Hermes starts a run, it should show or receive:

```text
selected_identity
selected_wisdom_profile
selected_task_type
selected_specialist_mask
selected_prompt_vault
selected_template_set
selected_limits
```

If nothing is selected, Hermes should use a safe default:

```text
identity: AXM neutral helper
wisdom: none or default safe summary
task_type: review
specialist_mask: none
prompt_vault: off
template_set: off
limits: conservative
```

## Uploaded identities

Hermes should support uploaded identity profiles.

These can be placed in a local approved folder.

Example:

```text
identities/inbox/
```

A profile can then be reviewed and promoted to:

```text
identities/available/
```

No uploaded identity becomes default automatically.

## Identity profile fields

A simple identity profile should contain:

```text
id
name
status
purpose
tone
allowed_tasks
forbidden_tasks
source
review_status
notes
```

Optional later fields:

```text
preferred_wisdom_profiles
preferred_specialist_masks
preferred_templates
preferred_prompt_vaults
max_run_minutes
max_actions
```

## Wisdom profile link

Identity and wisdom are related but separate.

Identity answers:

```text
Who/what role is Hermes acting as for this task?
```

Wisdom answers:

```text
Which knowledge, rules, lessons, or values should guide this task?
```

Hermes should allow:

```text
identity only
wisdom only
identity + wisdom
identity + wisdom + specialist mask
```

## Specialist mask link

Specialist masks are task lenses.

Examples:

```text
mergegate
code-routing-gate
reasoning-shell-specialist
visualassetagent
sfx-forge-reviewer
template-reviewer
```

Hermes should not randomly invent specialist choice when a known task type has a known better mask.

## Prompt vault link

Prompt vaults should be selectable per identity or per task.

Examples:

```text
prompt_vault: off
prompt_vault: read_only
prompt_vault: selected_pack
```

Hermes may use vault prompts only when the run settings allow it.

## Template link

Templates should be selectable per task.

Example:

```text
task_type: GitHub PR review
template: PR review packet
```

```text
task_type: SFX intake
template: asset intake packet
```

Templates keep output stable while content remains flexible.

## Action record

Every Hermes run should record what was loaded.

Example:

```text
run_id
identity_profile
wisdom_profile
task_type
specialist_mask
prompt_vault
template_set
limits
result
review_status
```

## Stop rule

If an identity asks Hermes to bypass consent, ignore limits, hide actions, change AXM core rules, or skip review, Hermes should stop and report the conflict.

## AXM rule

Identity is a selectable operating profile, not ownership and not canon.

Wisdom guides behavior.

Specialist masks focus the task.

Prompt vaults provide reusable prompts.

Templates stabilize output.

Hermes supplies local body strength under these choices.
