# Runtime Stability and Honest Limits

`AXMRuntimeSupervisor` provides:

- DOM health checks for duplicate atmosphere/field/transition stages;
- owned-node and module-state snapshots;
- finite production-preset or scene switching;
- error and leak-signal collection;
- end-state restoration;
- optional finite interval watching and local history export.

It deliberately reports `memorySafetyProven: false`. DOM counts and module states can reveal obvious lifecycle failures, but they cannot prove that browser heap, canvas resources, compositor layers, or GPU memory are leak-free.

For production acceptance, combine the supervisor with:

- a real long-running session on target hardware;
- browser performance/memory tooling;
- repeated route mount/unmount tests;
- mobile thermal/battery observation;
- keyboard, screen-reader, reduced-motion, forced-colors, and zoom tests.
