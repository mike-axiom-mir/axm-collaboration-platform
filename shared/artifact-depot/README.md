# AXM LEGO City Artifact Depot

Status: **EXPERIMENTAL**

The depot writes candidate bytes to a caller-selected local root under their
SHA-256 identity. A temporary partial file is fsynced before its atomic rename;
only complete digest-named files are discoverable. Existing artifacts are
re-read and verified instead of overwritten.

Leases and offline export manifests are data. They grant no execution,
promotion, merge, or CANON authority. There is intentionally no delete or
automatic garbage-collection API in v0.1.
