# Identifier Rules

Canonical pattern:

`axm:<entity-kind>:<stable-slug>`

Allowed entity kinds:
module, capability, interface, evidence, edge, need, research, direction, intervention,
decision, event, packet.

Regex:
`^axm:(module|capability|interface|evidence|edge|need|research|direction|intervention|decision|event|packet):[a-z0-9][a-z0-9._-]{2,127}$`

Rules:
1. IDs are lowercase and stable after assignment.
2. Versions are fields, not replacements for identity.
3. IDs are never recycled after deprecation.
4. Renames update canonical_name or aliases, not the ID.
5. Separate modules must not mint the same ID for different entities.
6. Imported foreign IDs are retained in metadata while an AXM ID is assigned.
7. Deterministic generated IDs should use canonical normalized inputs and a collision check.
8. Human-readable slugs are preferred; hashes may be appended when collision resistance is needed.
