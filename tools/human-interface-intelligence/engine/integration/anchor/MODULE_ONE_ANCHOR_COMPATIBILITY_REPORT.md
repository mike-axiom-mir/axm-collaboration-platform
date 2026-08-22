# Historic Module 1 anchor compatibility — checked by Module 2 v0.6.0

The packaged historic anchor remains **CONFLICTED** and the strict paired merge remains **BLOCKED**.

Positive evidence retained:

- package inventory and hashes pass;
- stable identities and requested export guarantees are present;
- canonicalization vectors reproduce;
- the ten fixture identities and producer run-evidence set are present.

Blocking evidence retained:

- the same shared-contract version is represented by different schema bytes;
- evidence-state serialization differs;
- the anchor declares shared fields or mandatory inference metadata not representable by the accepted standalone `0.1.0` schema;
- part of the fixture output fails the anchor's own strict evidence policy.

Module 2 generated no recommendation from this anchor, imported no producer code, and treated the ZIP only as a non-authoritative regression fixture. Local intake must use the latest Module 1 anchor instead.
