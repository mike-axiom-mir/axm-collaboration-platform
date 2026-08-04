# FAMILY PACKAGES — v0.6

## Purpose

A family package is a focused local transfer packet for one mold and the related working context around it.

## Contents

- focus mold ID, controls, and variants;
- family graph metadata;
- related protected family molds for reference;
- related local presets and candidates;
- related local themes and extensions;
- related rollback snapshots;
- theme summaries and proof context;
- deterministic integrity fingerprint.

## Import behavior

- packet integrity is checked before merge;
- incoming local IDs are remapped;
- extension-parent, preset-parent, and theme references are remapped;
- imported local themes and extensions enter quarantine;
- imported approval is not trusted as local activation approval;
- existing records are never silently overwritten.

## Boundary

A family package does not rewrite protected package molds, hot-install executable renderer code, auto-approve imports, or claim downstream engine parity.

Use it when a focused mold-family handoff is more appropriate than exporting the complete workspace.
