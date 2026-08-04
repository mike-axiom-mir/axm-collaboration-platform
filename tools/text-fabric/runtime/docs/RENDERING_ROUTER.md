# Rendering Router

- **Tiny UI text:** native or hinted rasterization.
- **Normal app/web body:** native platform/browser text rendering.
- **Large HUD and titles:** SDF is appropriate when scale or effects are important.
- **Sharp-cornered large text:** MSDF is preferred when supported.
- **World-space labels:** SDF/MSDF plus distance and occlusion testing.
- **Pixel art:** use size-locked bitmap fonts and integer scaling.

The router chooses from the smallest size that must remain readable, not only the largest size that might be displayed.
