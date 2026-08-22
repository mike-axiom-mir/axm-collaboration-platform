# AXM selective intake guide — Run 105

1. Start with `LOCAL_INTAKE_READINESS.json` and `LOCAL_INTAKE_DASHBOARD.txt`.
2. On the AXM machine, run `local_intake_tools/START_HERE_WINDOWS.bat` or the equivalent shell script.
3. Review the suggested first batch: seeds **003, 020, 081, 085, 090, and 099**.
4. Use `local_intake_tools/plan_selection.py 3 20 81 85 90 99` to print the dependency-complete order.
5. Stage the corresponding ZIP files from `selective_packs/` or the dedicated local-intake candidate bundle.
6. Do not enable or merge automatically. Record destination paths, results, and rollback evidence.

The package is installer-free by design. Ten shadow modules have no implementation and must remain excluded.
