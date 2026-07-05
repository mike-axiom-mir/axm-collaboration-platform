# Hermes Specialist Command

Status: TEST / AI wrapper creation layer.

Hermes is the local body/tool strength.

Specialist Command is the place where users and AXM create, organize, and tune the AI wrappers that Hermes can use.

This is not the shell review layer.

The shell reviews logs, growth, and which combinations worked.

Specialist Command creates and manages the actual usable wrappers.

## Purpose

Specialist Command is where these are created and maintained:

- identity profiles
- specialist masks
- skill wrappers
- prompt vault links
- template links
- package profiles

It is the place where everything grown for AI tuning comes together in a user-tweakable form.

## Main types

### Identity profile

An identity profile is the default operating stance for an AI body or run.

It answers:

```text
Who or what role is this AI acting as by default?
```

Examples:

```text
AXM neutral helper
Axiom structure mode
Mir repair mode
Mike-facing plain helper
local workshop guide
```

### Specialist mask

A specialist mask is a special role for a situation, domain, or longer work mode.

It answers:

```text
What special perspective or operating role should be used for this situation?
```

Examples:

```text
mergegate reviewer
code routing gate
visual asset reviewer
SFX intake reviewer
template stability reviewer
local bridge tester
```

Specialist masks are more than small skills. They can guide a whole session or situation.

### Skill wrapper

A skill wrapper is smaller than a specialist mask.

It is for a specific objective or action.

It answers:

```text
What small repeatable action should be done?
```

Examples:

```text
summarize issue into packet
check file status label
turn notes into task list
make asset intake card
prepare PR review checklist
```

### Prompt vault link

Prompt vault links connect reusable prompts to identities, specialist masks, skills, or packages.

Prompts should not randomly control a run.

They should be selected by consent, package, or task settings.

### Template link

Template links connect a stable output shape to a task.

Templates preserve the AXM rule:

```text
outer stable
inner flexible
```

### Package profile

A package profile is a full default bundle.

It can contain:

```text
one default identity
x specialist masks
x skill wrappers
x prompt vault links
x template links
x wisdom profile links
run settings
consent requirements
```

Package profiles let a user choose a ready-made AI setup without manually picking every part each time.

## Example package

```text
Package: GitHub Review Helper
Default identity: AXM neutral helper
Specialist masks:
- mergegate reviewer
- code routing gate
Skills:
- summarize PR
- check status labels
- create review packet
Prompt vault: github-review-prompts
Templates:
- PR review packet
Wisdom links:
- AXM repo workflow
- no fake done rule
Consent: required before action
```

## Specialist Command step loop

Every wrapper should be created through a simple loop.

```text
1. Define need
2. Choose wrapper type
3. Define purpose
4. Define allowed tasks
5. Define forbidden tasks
6. Define inputs
7. Define outputs
8. Define step loop
9. Define boundaries
10. Define consent rule
11. Save as RAW or REVIEW
12. Test in a bounded run
13. Promote only with evidence
```

## Wrapper status labels

Use AXM labels:

```text
RAW
REVIEW
ACCEPT FOR TEST
WORKING
KNOWN FAIL
RETIRED
CANON only after MergeGate
```

## Default wrapper template

Every wrapper should include:

```text
id
name
wrapper_type
status
purpose
best_for
not_for
allowed_inputs
allowed_outputs
step_loop
boundaries
consent_rule
linked_identity
linked_wisdom_profiles
linked_prompt_vaults
linked_templates
linked_skills
review_notes
```

## Consent use

A wrapper can be available without consent.

A wrapper can only act when consent and run settings allow it.

Package profiles should not auto-run by default.

They prepare the AI setup. The user still chooses when to run.

## Relationship to wisdom

Specialist Command does not analyze wisdom logs.

Wisdom profiles may be linked here, selected here, or packaged here.

The shell/log layer reviews whether the wisdom helped later.

## Relationship to shell

Specialist Command creates and organizes wrappers.

Shell review analyzes how wrappers performed.

Flow:

```text
Specialist Command creates package
Hermes runs with consent
Shell review checks result
Specialist Command updates package if approved
```

## Default run selection

Before a Hermes run, the user can choose:

```text
package profile
identity
specialist mask
skill wrapper
prompt vault
template
wisdom profile
run limits
```

If a package is chosen, Hermes can auto-load its linked identity, skills, specialist knowledge, prompts, templates, and wisdom links.

But the run still requires consent.

## AXM rule

No hidden identity switch.

No package acts without consent.

No wrapper becomes canon by default.

Specialist masks are for situations or longer roles.

Skills are for small objectives or actions.

Identity sets the default operating stance.

Package profiles let normal users tune any AI without rebuilding the system by hand.
