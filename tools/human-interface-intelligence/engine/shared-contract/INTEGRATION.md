# Shared Contract Integration

1. Import the schemas as an external dependency; do not copy and privately edit them inside either module.
2. Preserve the original `capability_id`, source revision, source location, and source hash.
3. Validate a capability record before consuming it.
4. Reject unknown major contract versions.
5. Run the compatibility checker before replacing a schema version.
6. Use the exact shared fixtures in both modules and compare normalized outputs.
7. Keep Atlas-only teaching fields outside the shared contract unless both modules require them.
8. Keep Interface-Intelligence scoring fields outside the capability record unless both modules require them.
