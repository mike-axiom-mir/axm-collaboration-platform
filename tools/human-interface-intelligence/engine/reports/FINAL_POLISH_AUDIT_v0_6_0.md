# Final polish audit — v0.6.0

The final pass concentrated on failure modes that can hide beneath a visually correct recommendation:

- preference score overriding a hard boundary;
- malformed source data reaching field indexing;
- caller mutation changing an issued decision;
- a custom registry being reported with the default fingerprint;
- mutable registry data drifting after fingerprinting;
- receipts being generated from mismatched inputs;
- unknown accessibility needs being ignored;
- arbitrary budget vocabulary weakening deterministic comparison;
- archive paths being safe while archive size remains unbounded;
- parser acceptance of non-standard `NaN` or infinite JSON numbers;
- tests passing only because an external `/mnt/data` artifact exists;
- a structurally valid recommendation being mistaken for implementation readiness.

Each item now has code and regression coverage. The shared contract was not changed. The main remaining risk is external: the latest Module 1 and Module 3 packages must still be checked at local intake.
