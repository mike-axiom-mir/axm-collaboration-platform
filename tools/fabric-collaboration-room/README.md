# Fabric Collaboration Room

Status: `TEST`

This local visualization makes the Code Capability Fabric's collaboration
model understandable on a laptop. Mike, Fabric, Code Atlas, optional AI,
Mirror, Evidence Desk and the Detached Candidate Nursery appear as separate
selectable collaborators around one shared goal.

The room distinguishes declared component state from live observation. It does
not call a provider, observe Mirror, run Fabric, read the Workshop, create or
execute a candidate, or authenticate a person. Scenario controls change only
the explanation. Human controls produce an ephemeral
`axm.collaboration-decision-draft/v1` record whose authority and effect are both
`NONE`.

`PREPARE_SANDBOX_TRIAL` requires an exact candidate SHA-256 and an explicit
draft-only acknowledgement. Even then, the next gate remains
`AUTHENTICATED_HUMAN_DECISION_REQUIRED`. The existing Review Inbox remains the
only exact review surface; this room links to it and never writes its queue.

Run the focused checks:

```powershell
node tools/fabric-collaboration-room/selftest.js
```

Then serve Workshop through its trusted local entry point and visually test:

```text
/tools/fabric-collaboration-room/index.html
```

A script check does not prove the rendered layout or interactions. Desktop and
narrow-width claims require an actual browser render and click test.
