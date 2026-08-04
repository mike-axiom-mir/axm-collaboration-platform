# LOCAL EXTENSION REGISTRY — v0.6

## Purpose

The extension registry allows approved local mold growth to become usable without rewriting the protected 32-mold package registry.

## Separation model

```text
Protected package registry
  ├─ 3 root molds
  └─ 29 sparse derived molds

Local extension registry
  ├─ promoted approved candidates
  └─ quarantined imported extension packages
```

The Atlas and Editor combine package molds with local extensions only when an extension is both `ACTIVE` and `APPROVED`. Inactive records stay stored but are not presented as usable molds.

## Promotion is not activation

A candidate can be promoted only after explicit local approval and a clean candidate validation. Promotion creates a new extension ID in `QUARANTINED` state. It does **not** make the extension usable.

## Release gate

Before activation, the Studio verifies:

1. protected mold and theme integrity;
2. parent availability and parent-extension state;
3. organ dependencies;
4. active compatible theme dependencies;
5. base manifest checks;
6. an 18-case proof matrix;
7. regressions relative to the parent baseline.

Failures block activation. Warnings require explicit acknowledgement.

## Import gate

An imported extension package:

- is parsed as bounded data;
- is fingerprint-checked when fingerprinted;
- receives a new local ID;
- is downgraded to local experimental review state;
- enters `QUARANTINED`;
- requires fresh local approval, release preparation, and activation.

## State machine

```text
QUARANTINED --approve + release gate + explicit activation--> ACTIVE
ACTIVE      --explicit action-------------------------------> DEPRECATED
ACTIVE      --explicit action-------------------------------> ARCHIVED
DEPRECATED  --fresh release gate + explicit activation------> ACTIVE
ARCHIVED    --fresh release gate + explicit activation------> ACTIVE
```

No transition deletes the record.

## Dependency rules

- a child extension cannot activate while its local parent extension is inactive;
- an active parent extension cannot deactivate while an active child depends on it;
- an extension cannot activate with a missing or inactive required local theme;
- an active local theme cannot deactivate while an active extension depends on it.

## Rollback and presets

- snapshots targeting inactive extensions remain preserved but cannot restore until the target is active;
- presets targeting inactive extensions remain visible but cannot apply;
- deactivating the selected extension returns to a usable parent or protected root.
