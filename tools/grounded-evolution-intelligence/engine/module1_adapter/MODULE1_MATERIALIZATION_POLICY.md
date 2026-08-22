# Module 1 Materialization Policy

## Two independent intake stages

### Stage A — software package admission

Verify the outer bundle bytes, nested payload bytes, manifests, inventories,
contract identity, schemas and authority boundary. A successful Stage A result is:

`PACKAGE_REHEARSAL_PASS_MATERIALIZATION_REQUIRED`

It is not `MERGE_READY` because the real registry run is `NOT_RUN` and the package
intentionally contains no real Capability Card corpus, producer receipts or batch plan.

### Stage B — local corpus materialization

Only after explicit local authorization:

1. run discovery verification against a read-only repository copy;
2. create the real local intake and measure provider/consumer roles;
3. generate the deterministic batch plan;
4. build every planned record;
5. verify producer and batch receipts;
6. verify zero missing and extra records;
7. verify the production manifest;
8. run Module 1 ↔ Module 2 round-trip checks;
9. run Module 3 graph, diagnosis and conflict checks;
10. request explicit Merge Gate review.

`COMPLETE_VERIFIED` proves source/plan/receipt-chain completeness only. It does not
prove runtime behavior and does not pass Merge Gate.

## No automatic execution

The adapter may produce the next command and required gates. It cannot execute the
commands, install the package, generate cards, accept results, promote proof or merge.
