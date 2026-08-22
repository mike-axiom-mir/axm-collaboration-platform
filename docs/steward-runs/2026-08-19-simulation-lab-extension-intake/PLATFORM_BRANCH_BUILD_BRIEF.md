# Platform branch build brief — simulation-lab extension

Status: `EXPERIMENTAL INPUT REQUEST`

Build one dependency-free adapter or specialist extension for the existing AXM
simulation lab. Do not build a replacement baseline root. The current protected
host profile is bound as:

```text
sha256:07960a606ffb30d48a37cee29e1e795fe33c1789aabc5cd61b4e22c155744031
```

The returned folder must contain exactly the files it declares, including:

- `axm-branch-return.json`
- `axm-simulation-lab-extension.json`
- `manifest.json` with status `EXPERIMENTAL`
- `module.contract.json` with status `EXPERIMENTAL`
- one dependency-free entry file
- one self-test

Use a new module id distinct from `portable-baseline-capsule`,
`baseline-simulation-lab`, and `grounded-growth-challenger-lab`. Declare
relation `ADAPTER`, or `SPECIALIST_EXTENSION` only when the sole subject is
`SPECIALIST_MASK`. Map one or more of `SOFTWARE_REPOSITORY`,
`MIRROR_STATE`, and `SPECIALIST_MASK` through exact contract handoffs.
Preserve unsupported source fields by `DIGEST_BOUND_REFERENCE`; never claim
that translated data has the native source schema identity.

Required boundary state:

```json
{
  "truthRulesChanged": false,
  "rootReplacement": false,
  "originalSourceMutation": false,
  "candidateCodeExecuted": false,
  "installed": false,
  "promoted": false,
  "canonChanged": false,
  "permissionsRequested": []
}
```

The candidate must require no network, external package, package manager, native
component, host command, absolute path, branch runtime, or permissions. It must
remain `installed: false` and `promoted: false`. Static intake will not run
the candidate and cannot approve execution, adoption, merge, CANON, Foundation
mutation, model training, or human value. A static pass only makes a later,
explicitly authorized challenger-evaluation plan possible.

`PLATFORM_EXTENSION_EXAMPLE.json` is declaration-shape guidance only. It is
not a received candidate, package, assessment, installation, or endorsement.
