# Visual Change Review Packet

Status: **TEST-HOLD-REVIEW**  
Candidate: `change-aetherglass-calm-tuning-a95f127b62d15514`  
Fingerprint: `a95f127b62d15514`  
Generated: 2026-07-28T09:52:21.958564+00:00

## Purpose

Reduce long-session glow while preserving the signature Aetherglass material hierarchy.

## Source and authorship

- Author: Mike — Axiom/Mir
- Source: Theme Laboratory v0.2
- Rollback pointer: `pack-v0.2.0-default-tokens`

## Token changes

| Token | Before | After | Canonical source |
|---|---|---|---|
| `--axm-control-radius` | `var(--axm-radius-sm)` | `0.8rem` | `src/tokens/component.css` |
| `--axm-effect-blur` | `var(--axm-blur-md)` | `12px` | `src/tokens/effects.css` |
| `--axm-effect-edge-glow` | `2.4rem` | `1.8rem` | `src/tokens/effects.css` |

## Required evidence

- [ ] Before screenshot
- [ ] After screenshot
- [ ] Phone and narrow-container check
- [ ] Keyboard and focus check
- [ ] Semantic contrast check
- [ ] Reduced-motion and reduced-transparency check
- [ ] Minimal-effects performance check
- [ ] Human decision recorded

## Boundary

This packet changed no canonical file and cannot promote itself.
