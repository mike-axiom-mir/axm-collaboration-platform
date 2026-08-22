# Local Intake Card — Resource, Thermal, and Battery Proof

- **Module ID:** `axm.verify.resource-thermal-battery-proof`
- **Seed:** 057/100
- **Family:** 6. Visual, interaction, performance, and native proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/resource_thermal_battery_proof.py`
- **Primary class:** `ResourceThermalBatteryProof`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Record and evaluate bounded CPU, GPU, memory, disk, battery, and thermal behavior on named hardware.

## Optional upstream organs

- `axm.verify.hermetic-environment-descriptor`
- `axm.verify.performance-budget-verifier`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
