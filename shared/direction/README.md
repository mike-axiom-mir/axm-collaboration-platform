# AXM Workshop Direction v0.1

Workshop Direction compiles one human- or machine-authored goal into at most
eight bounded capability routes. The compiler is deterministic: after an
intelligence supplies the direction, ordinary local logic performs capability
matching, route splitting, hand inspection and quality-gate assembly without
another model inference.

Every route is labelled honestly:

- `AUTOMATABLE_CANDIDATE_ONLY` has a real Body Pulse adapter and may be queued.
- `WAITING_FOR_OPERATOR_OR_HAND` has a useful interactive workspace but no
  callable automation adapter.
- `HELD_MISSING_CAPABILITY` has no installed module for the required work.

Interactive and missing routes create `axm.workshop-direction.hand-request/v1`
records. A hand request names the target module, desired callable contract,
accepted task envelope, evidence output and acceptance exams. This makes a
limit inspectable and potentially buildable without pretending it has already
been overcome.

Direction never changes Body Pulse mode, enables a module, promotes a candidate,
publishes an output, or grants file/network/tool authority. It only compiles,
records and queues routes that already have declared bounded hands.
