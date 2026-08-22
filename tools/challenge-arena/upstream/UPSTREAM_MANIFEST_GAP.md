# Upstream v0.6.0 manifest gap

This is a path-free Workshop summary of the inspected source `AXM_MODULE_MANIFEST.json`. The original file remains inside the sealed source release identified by `SOURCE_INTEGRITY.json`; it is not copied into the reviewable Workshop tree because it contains source-machine paths.

The file labels the module as version 0.6.0 but retains several v0.5-era verification values:

- automated test count: 158 instead of the v0.6 suite's 164 collected tests;
- pytest and unittest counts: 158 instead of the v0.6 release evidence;
- coverage: v0.5 measurements presented inside the versioned module manifest;
- wheel bytes/hash: the earlier v0.5 wheel values rather than the v0.6 wheel SHA-256 `0c747cba21e06fc16de9ac4dbff15db20eddd405ff2c80d6beb51628ceb1796d`;
- clean-install and demo evidence: older source-environment values and paths.

The separate v0.6 clean-intake reports, release hashes, and independent Workshop runs were used for current claims. This summary records the contradiction without silently fixing or adopting the upstream manifest.
