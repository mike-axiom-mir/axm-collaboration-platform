# LEGO City Local Sync and Twin Surfaces v0.1 receipt

Status: **EXPERIMENTAL — WORKING IN FOCUSED TESTS**

- City graph: `1d8c3c36925df6b1b87d39f90eb649a735a4732c75e5dba5e7d01aecb4650cf1`.
- Schema registry: `d58fc36213e6dd23eef36766e6af5b89282e4b3216b9470e1c9098f3a567801b`.
- Twin surface: `0c3f51c98a9c8beb9d9f2020d0675a43a44143f7d4ceb42636399d37cee27628`.
- Local Sync assertions: 12 passed.
- Twin Surfaces assertions: 12 passed.
- Generated twins: 237 machine packets and 237 human labels.

Proven here: typed append-only and grow-only-set candidates are deterministic;
ID mutation conflicts; unproven CRDT strategies fail; last-writer and
single-authority selection hold; sensitive namespaces cannot auto-merge; and
merge results remain unapplied. Human labels cannot omit a machine block, hide
an effect, lower machine risk, omit capability lists, or expose an effect
without its exact non-authorizing packet.

Not claimed: persistence, transport, distributed convergence beyond the exact
G-Set rule, authenticated state ownership, safety, authorization, application
of a merge candidate, browser rendering/click behavior, promotion, merge to
repository, or CANON.
