# Security and Privacy Notes

## Local binding

The Workshop and bridge bind to loopback by default. Do not change them to a
network-wide address without a separate threat review, authentication plan, and
explicit user choice.

## Secrets

Provider keys belong in local environment variables. Never commit real keys,
bridge tokens, cookies, session identifiers, or authorization headers.

The public package intentionally omits `bridge/bridge-token.txt`. The bridge
creates a fresh random token on first start. Keep that file private. Deleting it
rotates the local token on the next bridge start.

## Generated state

Runtime logs and generated verifier/route files are local evidence. They may
contain timestamps, actor names, task details, file names, or machine context.
They are ignored by Git and replaced by schema examples in this checkpoint.

## Machine adapter boundary

Machine-facing actions require a host-supplied authorization decision. Unknown
or forbidden actions must be refused. A successful draft/build response does not
mean install, execution, promotion, or canonization occurred.

## Reporting

No email address is published in this checkpoint. For responsible collaboration
or issue coordination, locate Mike Tobi through the AXM raw Facebook development
log and avoid posting secrets in public comments.
