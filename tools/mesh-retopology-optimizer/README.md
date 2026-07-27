# Mesh Retopology & Optimizer

P0 module #4. AXM-native bounded vertex clustering for building, vehicle, and rigged-person GLBs. It preserves primitive/material grouping, UV seams, hard-normal regions, joint sets and normalized skin weights; removes duplicate/degenerate triangles; and records exact geometric and attribute error.

The metric is a normalized vertex-envelope bound, not visual silhouette approval. Rig deformation also remains a human/live gate.

```powershell
node "C:\axm workshop\tools\mesh-retopology-optimizer\selftest.js"
```
