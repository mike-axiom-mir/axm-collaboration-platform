# Code Capability Fabric Workshop Shadow v0.5

Status: `TEST`

Objective: add one provider-neutral, deterministic improvement loop that can
observe an exact privacy-scoped current Workshop state and create an immutable
detached draft without source write-back, candidate execution, installation, or
lifecycle authority.

The implemented recipe is deliberately narrow:

```text
refresh-tools-index-v1
  exact scoped Workshop observation
  -> deterministic tools-index comparison
  -> one detached tools-index.json candidate when stale
  -> script-free current-snapshot review
```

This run did not implement a general code improver, repository recovery system,
arbitrary executor, automatic lesson admission, installer, publisher, promoter,
or CANON route. It did not attempt to reconstruct the files being restored in
the separate canonical recovery checkout.

The technical source commit is
`6fb342894d98c3f606d79a9f48225c658a0dfab4`. Mike remains the merge gate.

