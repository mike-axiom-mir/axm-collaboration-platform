# Code Specialist Build Profile Registry v1 (TEST)

This is the extension seam for adding code families to the Code Capability
Fabric one reviewed rung at a time. It replaces builder-internal family wiring
with a byte-bound profile catalog. A profile binds all of these exactly:

- one existing Code Atlas language id;
- one exact specialist Organ profile and digest;
- one exact source-reviewed Capability Fabric recipe and builder digest;
- the capability family, evidence routes, repair gates, and typed gaps; and
- a zero-authority detached-candidate boundary.

The catalog contains four bounded build lanes: JSON schema validation, static
HTML page rendering, one typed CSS token stylesheet, and one string-only Python
record transform. It does not
claim that Python generally—or all languages—are implemented. A broader
Python, broader CSS, Rust, game-script, or other profile becomes eligible only after
its specialist binding and source-reviewed recipe exist. Missing or drifted
bindings emit typed gaps; a nearby recipe is never borrowed.

The registry validates and resolves profiles. It does not read source files,
generate or execute candidates, call providers, register itself, install,
integrate, publish, promote, or change `CANON`. Adding a catalog entry is still
a reviewable repository change gated by the four roots and Mike's merge
decision. Runtime proof remains domain-native work after separate consent.

To add a family safely:

1. classify it in the existing code-specialization catalog;
2. add a narrow source-reviewed recipe and builder with exact verifiers;
3. seal one build profile binding those exact bytes;
4. run the registry and specialist-builder adversarial suites;
5. obtain root review and Mike's separate merge decision; and
6. keep execution, installation, lesson admission, and publication in their
   own later gates.

Focused check:

```powershell
node shared/code-capability-fabric/selftest-code-specialist-build-profile-registry-v1.js
```
