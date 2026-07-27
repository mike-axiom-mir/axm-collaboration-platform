# Presentation Spine

This governed TEST module previews AXM's shared presentation profiles and displays the deterministic migration report.

Regenerate the report from the Workshop root:

```powershell
node shared/presentation-spine/migration-scanner.js --root . --out tools/presentation-spine/migration-report.json
```

The scan is read-only. It reports missing visual seams, missing profiles, inline styles, hard-coded inline CSS colors and external runtime references. It never edits a surface and cannot approve visual quality.

## Body, behavior, presentation, screen

The shared `axm.screen-contract/v1` boundary keeps four different concerns explicit:

1. **Body** provides the runtime substrate, files and available machinery.
2. **Behavior** owns what the module can do, its rules, data and permissions.
3. **Presentation** chooses how those capabilities are arranged and styled.
4. **Screen** is the rendered view; it has no authority over the other layers.

A module can declare `presentation.screenPreset`, `editableLayers` and `modeEditable` in its manifest. If it does not, the deterministic resolver selects a conservative preset from its declared purpose. Game and creative modules can expose more visual freedom; diagnostic and infrastructure modules expose less. Every preset refuses behavior edits, permission edits, runtime authority and hardware capability claims.

This means a control may move, glow, shrink or use a different skin while its action remains exactly the same. Hardware remains a separate future body: software may describe, schedule, verify or optimize real hardware, but never claim that a visual or code layer created physical capability.

The contract also records a **capability-first resource policy**. A lower-power body may choose reduced motion, flatter depth, fewer effects or lower-resolution assets while keeping the same compatible behavior modules. If a capability itself needs unavailable CPU, RAM, GPU or physical hardware, AXM must report that exception with evidence; it may not disguise missing capability as a lighter skin.
