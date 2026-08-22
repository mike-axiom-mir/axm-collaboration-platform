# Citation and Quote Fidelity Checker

Detached AXM Verification & Proof organ for seed 009.

It checks whether a citation still points to the source binding it claims to use, whether quoted text is faithfully present in the supplied source excerpt, and whether attribution matches when declared. It can establish claim support only in a bounded `EXACT_TEXT` mode. Semantic support is never invented and returns `HUMAN_REVIEW`.

## Truth boundaries

- Citation identity and locator are exact checks.
- Quote fidelity checks source text, not the truth of the source.
- `EXACT_TEXT` support proves only textual containment.
- Semantic or contextual entailment remains `HUMAN_REVIEW`.
- A fidelity result cannot approve a claim, release, or CANON state.

Status: TEST-HOLD, detached, v0.1.0.
