# EXTENSION RELEASE GATE

## Purpose

Promotion proves that a candidate was approved. It does not prove that the resulting extension is ready for the usable Atlas. The release gate creates that separate boundary.

## Gate checks

1. Protected mold and theme integrity
2. Parent availability and active-parent rule
3. Organ dependencies
4. Active compatible theme dependencies
5. Base manifest validation
6. Eighteen proof cases covering content pressure, formats, themes, states, motion, performance, lineage, and dense content

## Parent baseline

Stress tests can reveal limitations already present in a parent mold. v0.5 compares every extension proof case with the parent’s equivalent result:

- new failures or warning regressions block release
- inherited failures remain visible as warnings
- no result is silently erased

## Activation

- any gate failure blocks activation
- warnings require explicit acknowledgement
- activation records the release packet and acknowledgement
- active children protect their parent from unsafe deactivation
