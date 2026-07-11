# Hermes Shell Review Layer

Status: TEST / stability layer.

Hermes needs more than a start button.

It needs a shell review layer that records which setup was used and whether that setup helped.

## Purpose

The shell layer helps AXM track:

- selected shell profile
- selected wisdom profile
- selected template
- selected specialist mask
- run limits used
- result quality
- repair notes
- best combinations over time

## Shell inside Hermes

The AXM Reasoning Shell can become one specialist option inside Hermes.

Basic shape:

```text
Hermes task
  -> choose shell profile
  -> choose wisdom profile
  -> choose template
  -> choose specialist mask
  -> run within configured limits
  -> create review note
  -> update combo notes
```

## Combo record

Each run should record:

```text
run_id
run_goal
shell_profile
wisdom_profile
template_used
specialist_mask
max_minutes
max_actions
result_status
human_rating
repair_needed
notes
```

## Combo comparison

Hermes should learn locally which combo works best for each task type.

Examples:

```text
Task type: GitHub review
Useful shell: merge review shell
Useful specialist: code routing gate
Useful wisdom: AXM repo workflow
Useful template: PR review packet
```

```text
Task type: SFX intake
Useful shell: asset review shell
Useful specialist: SFX reviewer
Useful wisdom: asset status rules
Useful template: asset intake packet
```

## Review questions

After a run, Hermes should ask:

- Was the right shell used?
- Was the right specialist mask used?
- Did the wisdom profile help?
- Did the template reduce mess?
- Did the result need repair?
- Was the output useful?
- Should this combo be reused?

## Report folder idea

Future run reports can live locally in:

```text
run-reports/
```

A report should include:

```text
goal
settings used
combo used
summary
result
repair notes
reuse recommendation
```

## AXM rule

No sacred combo.

No fake improvement.

The best Hermes setup should be decided by repeated review, not by first impression.
