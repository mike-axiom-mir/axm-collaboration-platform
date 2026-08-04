# Intake Readiness Gate

## Purpose

The gate compresses many status surfaces into one inspectable release decision without hiding warnings.

## Checks

- protected-core integrity;
- storage corruption and unresolved recovery issues;
- complete health report;
- active extension release-gate evidence;
- active theme approval and validation;
- project and batch failures or drafts;
- recent safety-capsule record;
- localhost versus direct-file mode;
- recorded Windows Chrome/Edge visual check;
- downstream adapter status.

## Results

### READY

No failures and no warnings.

### READY_WITH_LOCAL_VALIDATION

No blocking failures, but one or more warnings remain. Typical examples are target-engine adapter validation or draft records excluded from release claims.

### BLOCKED

One or more failures remain. The report marks blocking checks explicitly.

## Browser visual check

The Studio allows the user to record a manual Windows Chrome or Edge inspection note and timestamp. This is honest local evidence, not automated screenshot proof.

## Handoff packet

The local-intake handoff includes readiness, health, audit, core report, workspace, rescue summaries, and adapter status with an integrity fingerprint.
