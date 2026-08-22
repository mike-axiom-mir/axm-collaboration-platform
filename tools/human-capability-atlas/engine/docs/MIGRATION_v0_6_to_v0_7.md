# Migration — Atlas v0.6.0 to v0.7.0

## Shared contract

No change. `axm.capability-interface-contract` remains exactly version `0.1.0`.

## Existing v0.6 outputs

Do not relabel v0.6 producer receipts as v0.7 RUN evidence.

You may preserve them for rollback/history. Rebuild through a v0.7 batch when
you want v0.7 batch-chain evidence.

## Recommended migration

1. Preserve v0.6 ZIP and checksum.
2. Stage v0.7 separately.
3. Run the v0.7 test suite.
4. Seal the raw source copy.
5. Run normalization with the seal and `--no-build-cards`.
6. Generate a deterministic batch plan.
7. Build/resume the planned batches.
8. Finalize and verify the production manifest.
9. Continue with Module Two only after source/identity holds are reviewed.

## Compatibility note

The new production artifacts are Module One orchestration sidecars. They do not
extend or fork the shared Capability Record contract.
