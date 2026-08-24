# AXM Code Language Organs v1

Status: `TEST`

This layer turns the 102-entry AXM Code Body Priority List into **102 separately
addressable physical code/language organs**. It is not one universal code blob.

PR 51 remains the exact source-reviewed donor rung. Python, HTML, and JSON Schema
now bind exact PR 51 profile/recipe/builder identities. Those bindings are not
runtime proof: generated-candidate execution, Python/runtime correctness, and
HTML visual behavior remain `UNKNOWN` unless separately verified. JavaScript is
recorded as an existing confirmed body without inventing a repository body path;
CSS stays `VERIFY_EXISTING`. The remaining organs are real descriptor/plan
capabilities, but their native execution status stays `LANGUAGE_ADAPTER_REQUIRED`
until an actual language-specific parser/toolchain/verifier binding exists.

Shared family knowledge is reused through `families.json`; identity, detection,
status, toolchain candidates and digest remain language-specific in each
`organs/NNN-name/organ.json`.

All organs expose the reference path:
`parse -> understand -> projectGraph -> dependencies -> api -> impact ->
affectedTests -> architecture -> refactor -> verificationAdapters -> sandbox ->
evidencePassport -> rollback -> governanceReturn`.

`registry.js` is deterministic and caller-data-only: basename, path context,
longest extension, then shebang. It loads one immutable, digest-checked process
snapshot and exposes a snapshot digest for evidence binding. It does not inspect
a workspace or execute tools. Ambiguous cases return `SELECTION_REQUIRED`, and
an explicit preferred organ that is not a candidate fails closed instead of
silently falling back.

Capability is not authority. The registry writes nothing, runs nothing, uses no
network, installs nothing, promotes nothing and cannot change CANON. Native
execution requires a separately bound adapter, host verifier, sandbox/resource
limits, receipted tool versions and exact input/output digests.

Run:

```powershell
node shared/code-capability-fabric/language-organs/selftest.js
node shared/code-capability-fabric/language-organs/selftest-adversarial.js
node shared/code-capability-fabric/language-organs/selftest-donors.js
```
