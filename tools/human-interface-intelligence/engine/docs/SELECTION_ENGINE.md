# Deterministic selection engine

The engine validates the shared Capability Record and module-owned recommendation context before reading decision fields. It does not fill missing context values.

Selection has two layers:

1. **Hard eligibility** — explicit `unsafe_interface_patterns` and a required-offline boundary are non-negotiable. Ineligible patterns remain visible in the score trace but cannot be selected regardless of score.
2. **Preference scoring** — eligible patterns are ranked using task/input/output fit, user skill, devices, feedback and precision requirements, collaboration mode, risk and reversibility, interaction frequency, decision count, recovery cost, accessibility rules, supporting tools, compute, attention, and required feature fit.

Every score produces reasons and penalties. Ties are deterministic by pattern identifier. Near ties force a conditional recommendation and score-trace review.

The recommendation is a deep snapshot of the supplied capability/context. Its stable identity binds the complete capability, context, exact registry fingerprint, module version, contract version, selected pattern, and status. Runtime timestamps are excluded from decision receipts.

Recommendation status is not execution authority. Use Recommendation Assurance for implementation-readiness checks.
