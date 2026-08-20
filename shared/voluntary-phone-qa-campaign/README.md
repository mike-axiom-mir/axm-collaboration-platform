# Voluntary physical-phone QA campaign

Status: `TEST`

This read-only adapter turns the current Game Hub physical-phone warning list
into a sanitized, bounded, resumable human campaign. It reuses the existing
Browser, LAN & Hardware QA Lab as the candidate-capture hand; it does not modify
that Lab, any game, any manifest, or the verifier report.

The campaign groups at most one to five games per optional session, preserves a
six-observation checklist, allows stopping or skipping at every session, and
keeps candidate review separate from warning closure. Even an explicitly
accepted candidate remains `WARNING_STILL_OPEN` until the separate per-game
manifest evidence gate is reviewed.

The output removes source machine paths and raw notes. A review record is a
declared input, not authenticated human identity or physical-hardware proof.

Run the focused suite with:

```powershell
node shared/voluntary-phone-qa-campaign/selftest.js
```

