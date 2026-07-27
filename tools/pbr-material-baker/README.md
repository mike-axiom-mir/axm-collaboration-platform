# PBR Material Baker

P0 module #3. The baker creates deterministic albedo, OpenGL +Y tangent-space normal, packed ORM, emissive, and height maps using AXM-owned CPU algorithms.

The first six material families are brick, asphalt, painted metal, architectural glass, character skin, and metallic vehicle paint. The preview keeps one candidate in memory; only explicit export creates files, and export does not promote them.

Technical checks prove map dimensions, non-flat signal, decoded normal length, tangent convention, and independently meaningful ORM channels. Human review still decides whether a material looks good.

```powershell
node "C:\axm workshop\tools\pbr-material-baker\selftest.js"
```
