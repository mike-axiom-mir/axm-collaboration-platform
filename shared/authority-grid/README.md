# AXM LEGO City Authority Grid

Status: **EXPERIMENTAL**

The grid is a pure decision-packet compiler and verifier. Every request binds a
principal, action, resource, effect class, target SHA-256, structured scope,
time, and correlation ID into one digest. A decision binds that request to an
exact policy version and decision-maker.

Capabilities never grant authority. Stale, expired, drifted, denied, held, and
already-consumed decisions fail. High-risk effects require a human-labelled
decision-maker and one-use consumption. The caller remains responsible for the
legitimacy of policy and human identity; this module cannot appoint either.
Every permit additionally requires a caller-supplied decision-maker verifier;
a `human:` label and an unkeyed digest are not authentication.
