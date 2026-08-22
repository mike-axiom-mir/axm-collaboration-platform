# Beginner-Layer Planner

The planner chooses one of four explicit operation classes:

- `simplified_control`
- `restricted_safe_operation`
- `guided_advanced_operation`
- `full_expert_control`

It uses declared beginner-safe operations as the allow-list and advanced operations as the restricted list. It adds preview, confirmation, recovery, and hidden-control disclosure defaults from the risk and interaction profiles. It disables execution when critical information is unknown or conflicted.
