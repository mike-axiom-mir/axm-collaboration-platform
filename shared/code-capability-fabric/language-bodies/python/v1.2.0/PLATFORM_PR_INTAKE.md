# Platform PR Intake — Python Capability Body v1.2.0

Repository target:

`shared/code-capability-fabric/language-bodies/python/v1.2.0/`

Branch:

`feat/python-capability-body-v1.2`

Purpose:

Provide one stable GitHub source tree that local intake and other chats can
inspect, test, compare, and reference without treating chat-generated local
files as trusted by default.

## Relationship to Code Capability Fabric

This body is a language-specific provider candidate for the existing
provider-neutral Fabric seam.

It does not modify the Fabric planner, registry, route policy, host observation,
assurance gates, workspace-boundary verifier, or CANON process.

`PROVIDER_CANDIDATE_v2.json` targets the existing
`axm.code-capability-provider/v2` contract but remains a candidate descriptor.

## Trust posture

PR presence proves only that bytes are reviewable and versioned in GitHub.

It does not prove:

- local installation
- provider host availability
- executor authenticity
- sandbox confinement
- external tool availability
- verification success on another host
- reuse-rights sufficiency
- promotion
- CANON

Those remain platform/local gates.

## Third-party research

`RESEARCH_DONORS_v1_2.md` records the Python ecosystem research used for this
release. No listed third-party implementation is vendored into this body.

Optional tools are discovered without installation or execution and remain
separate evidence providers.
