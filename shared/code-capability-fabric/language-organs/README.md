# AXM Code Language Organs v1

Status: `TEST`

This layer turns the 102-entry AXM Code Body Priority List into **102 separately
addressable physical code/language organs**. It is not one universal code blob.

PR 51 remains the proven Python executable-source donor. The Python organ binds
that exact donor identity and digests. HTML and JavaScript are recorded as
confirmed existing bodies without inventing repository paths; CSS stays
`VERIFY_EXISTING`. The other organs are real descriptor/plan capabilities, but
their native execution status stays `LANGUAGE_ADAPTER_REQUIRED` until an actual
language-specific parser/toolchain/verifier binding exists.

Shared family knowledge is reused through `families.json`; identity, detection,
status, toolchain candidates and digest remain language-specific in each
`organs/NNN-name/organ.json`.

All organs expose the reference path:
`parse -> understand -> projectGraph -> dependencies -> api -> impact ->
affectedTests -> architecture -> refactor -> verificationAdapters -> sandbox ->
evidencePassport -> rollback -> governanceReturn`.

`registry.js` is deterministic and caller-data-only: basename, path context,
longest extension, then shebang. It does not inspect a workspace or execute
tools. Ambiguous cases such as `.m` and `.v` return `SELECTION_REQUIRED` rather
than guessing.

Capability is not authority. The registry writes nothing, runs nothing, uses no
network, installs nothing, promotes nothing and cannot change CANON. Native
execution requires a separately bound adapter, host verifier, sandbox/resource
limits, receipted tool versions and exact input/output digests.

Run:

```powershell
node shared/code-capability-fabric/language-organs/selftest.js
```
